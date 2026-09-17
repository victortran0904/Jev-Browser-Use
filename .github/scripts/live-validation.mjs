// Verification only: imports the application unchanged; never prints API keys,
// raw provider errors/responses, browser logs, page contents, or model prompts.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, readFile, mkdir, writeFile, rm, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import https from "node:https";
import { once } from "node:events";
import { chromium } from "playwright-core";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { createPlanner } from "../../server/planner.ts";
import { createWriter } from "../../server/writer.ts";
import { createBrowserBoundary } from "../../server/browser.ts";
import { createRunController } from "../../server/runs.ts";
import { geminiModel, geminiFallbackModel } from "../../server/gemini.ts";

const actionKinds = new Set(["open_site", "click_item", "type_text", "press_enter", "press_escape", "scroll_down", "scroll_up", "back", "wait", "done", "none"]);
const report = {
  schemaVersion: 1,
  runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT || 1),
  commit: /^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA || "") ? process.env.GITHUB_SHA : "local",
  scope: "Unmodified application baseline; live API + real extension/local fixture; not an optimized-build comparison",
  tests: [], requests: [], browserTrace: [],
};
const safeName = (value) => /^[a-zA-Z0-9._/-]{1,100}$/.test(value || "") ? value : "unavailable";
function classify(error) {
  const text = String(error?.message || error || "");
  const status = Number(error?.status || text.match(/\b(400|401|403|404|408|429|500|502|503|504)\b/)?.[1]);
  const category = /missing.*secret|secret.*missing/i.test(text) ? "missing-secret"
    : /budget/i.test(text) ? "request-budget-exceeded"
    : /401|unauthorized|API.key.not.valid|invalid.api.key|authentication/i.test(text) ? "authentication"
    : /403|permission.denied|forbidden/i.test(text) ? "permission"
    : /404|not.found|not.supported/i.test(text) ? "model-or-endpoint-unavailable"
    : /429|quota|rate.limit/i.test(text) ? "quota-or-rate-limit"
    : /timeout|timed.out|aborted/i.test(text) ? "timeout"
    : /503|unavailable|overload/i.test(text) ? "provider-unavailable"
    : error?.code === "ERR_ASSERTION" ? "assertion-failed"
    : /extension/i.test(text) ? "extension-startup"
    : /Browser Control/i.test(text) ? "browser-control"
    : "verification-failed";
  return { category, ...(status >= 400 && status <= 599 ? { httpStatus: status } : {}) };
}
async function check(name, test) {
  const started = performance.now();
  try {
    const details = await test();
    report.tests.push({ name, status: "pass", durationMs: Math.round(performance.now() - started), ...details });
    console.log(`PASS ${name}`);
    return true;
  } catch (error) {
    report.tests.push({ name, status: "fail", durationMs: Math.round(performance.now() - started), ...classify(error) });
    console.log(`FAIL ${name}: ${classify(error).category}`);
    return false;
  }
}
function skip(name, reason) { report.tests.push({ name, status: "not-run", reason }); }
async function saveReport() {
  await mkdir(".ci-results", { recursive: true });
  await writeFile(".ci-results/live-validation.json", JSON.stringify(report, null, 2) + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = report.tests.map(t => `| ${t.name} | ${t.status} | ${t.durationMs ?? "—"} | ${t.category ?? t.reason ?? ""} |`).join("\n");
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Live baseline validation\n\n${report.scope}\n\n| Test | Result | ms | Note |\n|---|---|---:|---|\n${rows}\n\nOnly allowlisted metadata is uploaded. No credentials, raw provider errors, browser profiles, or logs are included.\n`);
  }
}

if (process.argv.includes("--self-test")) {
  assert.deepEqual(classify(new Error("503 UNAVAILABLE credential-do-not-copy")), { category: "provider-unavailable", httpStatus: 503 });
  assert.equal(JSON.stringify(classify(new Error("unrecognized credential-do-not-copy"))).includes("credential-do-not-copy"), false);
  assert.equal(safeName("not a model?secret=value"), "unavailable");
  assert.equal(safeName("gemini-3.5-flash-lite"), "gemini-3.5-flash-lite");
  console.log("PASS verification-harness-safety (4 assertions; no external requests)");
  process.exit(0);
}

const originalFetch = globalThis.fetch;
const counts = { typesafe: 0, gemini: 0 };
// Bound billable requests including SDK retries, and prohibit redirects carrying credentials.
// Only loopback Browser Control and the two official provider hosts are allowed.
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const provider = url.hostname === "api.typesafe.ai" ? "typesafe"
    : url.hostname === "generativelanguage.googleapis.com" ? "gemini" : null;
  if (!provider) {
    assert(["127.0.0.1", "localhost"].includes(url.hostname), "Unexpected network destination");
    return originalFetch(input, init);
  }
  assert.equal(url.protocol, "https:");
  if (++counts[provider] > (provider === "typesafe" ? 12 : 10)) throw new Error("Request budget exceeded");
  const started = performance.now();
  const record = { provider, number: counts[provider], model: safeName(url.pathname.match(/\/models\/([^:]+):/)?.[1] || (provider === "typesafe" ? "jev-latest" : "catalog")) };
  report.requests.push(record);
  const suppliedSignal = init?.signal || (input instanceof Request ? input.signal : undefined);
  const signal = suppliedSignal ? AbortSignal.any([suppliedSignal, AbortSignal.timeout(25_000)]) : AbortSignal.timeout(25_000);
  try {
    const response = await originalFetch(input, { ...init, signal, redirect: "error" });
    record.httpStatus = response.status;
    record.latencyToHeadersMs = Math.round(performance.now() - started);
    return response;
  } catch (error) {
    Object.assign(record, classify(error));
    throw error;
  }
};

// Explicitly spawned Chrome, openssl and relay processes receive no model credentials.
const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  ["PATH", "HOME", "DISPLAY", "XAUTHORITY", "TMPDIR", "LANG", "LD_LIBRARY_PATH"].includes(key)));
let browserProcess, relayProcess, fixtureServer, temp, activeController, activeRun;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit").catch(() => {});
  child.kill("SIGTERM");
  await Promise.race([exited, pause(2000)]);
  if (child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await exited; }
}
async function cleanup() {
  if (activeController && activeRun?.status === "running") activeController.stop(activeRun.id);
  await stopChild(browserProcess);
  await stopChild(relayProcess);
  fixtureServer?.closeAllConnections();
  if (fixtureServer?.listening) await new Promise(resolve => fixtureServer.close(resolve));
  if (temp) await rm(temp, { recursive: true, force: true });
}
// This is a bounded verification process, not an SDD implementation worker.
const watchdog = setTimeout(async () => {
  report.tests.push({ name: "overall-deadline", status: "fail", category: "timeout" });
  await saveReport();
  await cleanup();
  process.exit(1);
}, 240_000);

try {
  const keysPresent = await check("repository-secrets-present", async () => {
    if (!process.env.GEMINI_KEY?.trim() || !process.env.TYPESAFE_API_KEY?.trim()) throw new Error("Missing repository secret");
    return { geminiPresent: true, typesafePresent: true };
  });
  let planner, writer;
  if (keysPresent) {
    const logger = { debug() {}, info() {}, warn() {}, error() {} };
    planner = createPlanner(new TypeSafeClient({ timeout: 25_000, retry: { maxRetries: 2, backoffInitialMs: 500, backoffMaxMs: 1500, maxRetryAfterMs: 2000 }, logger }));
    writer = createWriter();
  }
  const catalogOk = keysPresent && await check("gemini-key-and-model-catalog", async () => {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", {
      headers: { "x-goog-api-key": process.env.GEMINI_KEY },
    });
    if (!response.ok) { const e = new Error(`Gemini catalog HTTP ${response.status}`); e.status = response.status; throw e; }
    const body = await response.json();
    assert(Array.isArray(body.models));
    const available = new Set(body.models.map(model => String(model.name).replace(/^models\//, "")));
    return { httpStatus: response.status, primaryModel: safeName(geminiModel()), primaryListed: available.has(geminiModel()), fallbackModel: safeName(geminiFallbackModel()), fallbackListed: available.has(geminiFallbackModel()) };
  });
  const observation = {
    id: "api-smoke", url: "https://example.com/fixture", title: "Synthetic search fixture",
    snapshot: 'searchbox "Search query" [ref=e1]\nbutton "Search" [ref=e2]\n\nVisible page text:\nSearch fixture',
    candidates: [{ ref: "e1", label: 'searchbox "Search query"' }, { ref: "e2", label: 'button "Search"' }],
    focusedField: { label: "Search query", placeholder: "Search query", value: "", isText: true },
  };
  const typesafeOk = keysPresent && await check("typesafe-live-application-planner", async () => {
    const action = await planner.plan({ goal: "Type the exact words architecture smoke into the currently focused search field. Do not submit it yet.", history: [], observation });
    assert.equal(action.kind, "type_text");
    assert.equal(action.observationId, observation.id);
    assert(Number.isFinite(action.confidence));
    assert(action.confidence >= 0.3);
    return { action: action.kind, confidence: action.confidence };
  });
  const geminiOk = keysPresent && await check("gemini-live-application-text-writer", async () => {
    const generated = await writer.generateText({ goal: "Type the exact words architecture smoke into the Search query field.", history: [], observation });
    assert.equal(generated.fill, true);
    assert.equal(generated.text, "architecture smoke");
    return { exactSyntheticTextMatched: true };
  });
  if (keysPresent) await check("gemini-live-application-url-writer", async () => {
    const generated = await writer.generateUrl({ goal: "Open the public example website at https://example.com/", history: [] });
    assert.equal(new URL(generated).href, "https://example.com/");
    return { expectedPublicUrlMatched: true };
  });
  if (!keysPresent) {
    for (const name of ["gemini-key-and-model-catalog", "typesafe-live-application-planner", "gemini-live-application-text-writer", "gemini-live-application-url-writer"]) skip(name, "missing-secrets");
  }

  const searches = [];
  let fixtureUrl;
  const browserReady = await check("real-extension-and-loopback-fixture-startup", async () => {
    temp = await mkdtemp(path.join(tmpdir(), "jev-live-validation-"));
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", path.join(temp, "key.pem"), "-out", path.join(temp, "cert.pem"), "-days", "1", "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1"], { env: childEnv, stdio: "ignore" });
    fixtureServer = https.createServer({ key: await readFile(path.join(temp, "key.pem")), cert: await readFile(path.join(temp, "cert.pem")) }, (request, response) => {
      const url = new URL(request.url, "https://127.0.0.1");
      if (!["/", "/search"].includes(url.pathname)) { response.writeHead(404); response.end(); return; }
      const matched = url.pathname === "/search" && url.searchParams.get("q") === "architecture smoke";
      if (matched) searches.push(true);
      response.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" });
      response.end(matched
        ? '<!doctype html><html><head><title>Search complete</title></head><body><main><h1>Search complete: architecture smoke</h1><p>The requested search was submitted successfully.</p></main></body></html>'
        : '<!doctype html><html><head><title>Local search fixture</title></head><body><main><h1>Local search fixture</h1><form action="/search"><input type="search" name="q" aria-label="Search query" placeholder="Search query"><button type="submit">Search</button></form></main></body></html>');
    });
    fixtureServer.listen(0, "127.0.0.1"); await once(fixtureServer, "listening");
    fixtureUrl = `https://127.0.0.1:${fixtureServer.address().port}/`;
    relayProcess = spawn(process.execPath, [path.resolve("node_modules/@opencode-ai/browser-control/dist/cli.js"), "serve"], { env: childEnv, stdio: "ignore" });
    relayProcess.on("error", () => {});
    const extension = path.resolve("node_modules/@opencode-ai/browser-control/extension/dist");
    browserProcess = spawn(chromium.executablePath(), [
      `--user-data-dir=${path.join(temp, "profile")}`, `--disable-extensions-except=${extension}`, `--load-extension=${extension}`,
      "--no-first-run", "--no-default-browser-check", "--no-sandbox", "--disable-dev-shm-usage", "--ignore-certificate-errors", "--disable-background-networking", "about:blank",
    ], { env: childEnv, stdio: "ignore" });
    browserProcess.on("error", () => {});
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      if (browserProcess.exitCode !== null || relayProcess.exitCode !== null) throw new Error("Extension runtime process exited");
      try {
        const response = await fetch("http://127.0.0.1:19989/extension/status", { signal: AbortSignal.timeout(1000) });
        if (response.ok) {
          const status = await response.json();
          if (status.connected && status.protocolCompatible !== false) return { extensionConnected: true, extensionVersion: safeName(status.version), actualRelay: true };
        }
      } catch { /* The local runtime is still starting; no action is replayed. */ }
      await pause(250);
    }
    throw new Error("Extension startup timeout");
  });
  const browserOk = browserReady && await check("real-browser-navigation-observation-and-actions", async () => {
    const boundary = createBrowserBoundary();
    const id = "ci-deterministic";
    const timings = {};
    const trace = (stage, details = {}) => report.browserTrace.push({ stage, ...details });
    try {
      await boundary.begin(id); trace("session-created");
      let start = performance.now(); await boundary.open(id, fixtureUrl); timings.navigationMs = Math.round(performance.now() - start); trace("navigation-returned");
      const durations = [];
      let observed;
      for (let i = 0; i < 10; i++) {
        start = performance.now(); observed = await boundary.observe(id); durations.push(performance.now() - start);
        trace("observed", { sample: i, titleMatched: observed.title === "Local search fixture", candidates: observed.candidates.length, localOriginMatched: new URL(observed.url).origin === new URL(fixtureUrl).origin });
        assert.equal(observed.title, "Local search fixture"); assert.equal(observed.candidates.length, 2);
      }
      durations.sort((a, b) => a - b);
      timings.observationMedianMs = Math.round((durations[4] + durations[5]) / 2);
      timings.observationP95Ms = Math.round(durations[9]);
      const target = observed.candidates.find(item => item.label.includes("Search query")); trace("target-selected", { found: Boolean(target) }); assert(target);
      start = performance.now(); await boundary.act(id, { kind: "click_item", target: target.ref, observationId: observed.id }, observed); timings.focusClickMs = Math.round(performance.now() - start); trace("click-returned", { durationMs: timings.focusClickMs });
      observed = await boundary.observe(id); trace("focus-verified", { isText: observed.focusedField?.isText === true }); assert.equal(observed.focusedField?.isText, true);
      await boundary.act(id, { kind: "type_text", value: "architecture smoke", observationId: observed.id }, observed);
      observed = await boundary.observe(id); trace("fill-verified", { exactTextMatched: observed.focusedField?.value === "architecture smoke" }); assert.equal(observed.focusedField?.value, "architecture smoke");
      await boundary.act(id, { kind: "press_enter", observationId: observed.id }, observed);
      // Keyboard completion is not a guarantee that the resulting document is loaded.
      const readinessDeadline = Date.now() + 5000;
      do {
        observed = await boundary.observe(id);
        if (observed.snapshot.includes("Search complete: architecture smoke")) break;
        await pause(100);
      } while (Date.now() < readinessDeadline);
      trace("submission-verified", { successVisible: observed.snapshot.includes("Search complete: architecture smoke"), exactSubmissionReceived: searches.length > 0 });
      assert(observed.snapshot.includes("Search complete: architecture smoke"));
      assert(searches.length > 0);
      return { ...timings, observationSamples: 10, exactSearchSubmitted: true, transport: "real-browser-control-relay-and-extension" };
    } finally { await boundary.close(id); }
  });
  // Exercise the complete agent independently: a transient preflight failure
  // must not prevent testing the real integration. All earlier failures remain failures.
  if (browserOk && keysPresent) await check("live-agent-end-to-end-local-search", async () => {
    const boundary = createBrowserBoundary();
    const countBefore = searches.length;
    let planCount = 0, writerCount = 0;
    const safeBoundary = {
      begin: boundary.begin, observe: boundary.observe, act: boundary.act, close: boundary.close,
      open: (id, url) => { assert.equal(new URL(url).origin, new URL(fixtureUrl).origin, "Only the local fixture can be opened"); return boundary.open(id, url); },
    };
    activeController = createRunController({
      browser: safeBoundary, enableScreenshots: false,
      planner: { plan: async input => { if (++planCount > 6) throw new Error("Planner request budget exceeded"); return planner.plan(input); } },
      writer: {
        generateText: async input => { if (++writerCount > 3) throw new Error("Writer request budget exceeded"); return writer.generateText(input); },
        generateUrl: async () => { throw new Error("External navigation is disabled in this fixture"); },
      },
      // Narration is UI-only and outside this smoke test; avoid two unnecessary paid calls.
      narrator: { acknowledge: async () => "Starting local fixture test.", summarize: async () => "Local fixture test finished." },
    });
    activeRun = activeController.start({ goal: `At ${fixtureUrl} search for the exact words architecture smoke using the Search query field and submit the search. Stop when the page visibly says Search complete: architecture smoke. Do not open any other site.` });
    await activeController.settled(activeRun.id);
    const run = activeController.get(activeRun.id);
    const actions = run.events.filter(e => e.type === "plan").map(e => e.data?.kind).filter(kind => actionKinds.has(kind));
    report.agent = { status: run.status, steps: run.stepCount, plannerCalls: planCount, writerCalls: writerCount, actions, exactSearchSubmitted: searches.length > countBefore, ...(run.error ? classify(new Error(run.error)) : {}) };
    assert.equal(run.status, "complete");
    assert.equal(actions.at(-1), "done");
    assert(searches.length > countBefore);
    assert(run.observation?.snapshot.includes("Search complete: architecture smoke"));
    return { plannerCalls: planCount, writerCalls: writerCount, actionCount: actions.length, exactSearchSubmitted: true };
  });
  else skip("live-agent-end-to-end-local-search", "missing-secrets-or-browser-check-failed");
  if (!browserReady) skip("real-browser-navigation-observation-and-actions", "browser-startup-failed");
  report.requestCounts = counts;
} catch (error) {
  report.tests.push({ name: "harness", status: "fail", ...classify(error) });
} finally {
  clearTimeout(watchdog);
  await cleanup();
  globalThis.fetch = originalFetch;
  await saveReport();
}
process.exitCode = report.tests.some(test => test.status === "fail" || test.status === "not-run") ? 1 : 0;
