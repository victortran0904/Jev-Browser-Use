import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import type { Candidate, FocusedField, Observation, PlannedAction } from "./types.js";

const execFileAsync = promisify(execFile);
const cli = path.resolve("node_modules/.bin/browser-control");
const actionKinds = new Set(["open_site", "click_item", "type_text", "press_enter", "press_escape", "scroll_down", "scroll_up", "back", "wait", "done", "none"]);

export function parseSnapshot(snapshot: string): Candidate[] {
  const candidates: Candidate[] = [];
  for (const raw of snapshot.split("\n")) {
    const match = raw.match(/^(.*?)\s*\[ref=([\w-]+)\]/);
    if (!match) continue;
    candidates.push({ ref: match[2], label: match[1].trim().replace(/^[-\s]+/, "") });
    if (candidates.length === 240) break;
  }
  return candidates;
}

export function validateAction(action: PlannedAction, observation: Observation): PlannedAction {
  if (action.observationId !== observation.id) throw new Error("Stale observation: refresh before acting");
  if (!actionKinds.has(action.kind)) throw new Error("Unsupported browser action");
  if (action.kind === "click_item" && !observation.candidates.some((item) => item.ref === action.target)) throw new Error("Target is not in the current observation");
  if (action.kind === "type_text" && !observation.focusedField?.isText) throw new Error("No browser text field is focused");
  return action;
}

interface Envelope { ok: boolean; value?: unknown; text?: string; error?: { message?: string } | string }
interface BrowserTarget { id: string; type?: string; url?: string; owner?: string; browserControlSessionId?: string }
interface BrowserSession { id: string; pageUrl?: string | null }
interface BrowserStatus { targets: BrowserTarget[]; sessions: BrowserSession[] }
export type CommandRunner = (args: string[]) => Promise<string>;

const RELAY_ENDPOINT = process.env.BROWSER_CONTROL_ENDPOINT || "http://127.0.0.1:19989";

async function httpCommand(args: string[]): Promise<string | null> {
  try {
    if (args[0] === "status") {
      const res = await fetch(`${RELAY_ENDPOINT}/extension/status`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return null;
      const data = await res.json();
      return JSON.stringify(data);
    }
    if (args[0] === "session" && args[1] === "new" && args[2]) {
      const res = await fetch(`${RELAY_ENDPOINT}/cli/session/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: args[2] }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return JSON.stringify({ ok: true, session: data.session });
    }
    if (args[0] === "execute") {
      const sessionIdx = args.indexOf("--session");
      const sessionId = sessionIdx !== -1 ? args[sessionIdx + 1] : undefined;
      const code = args.at(-1);
      if (!sessionId || !code) return null;
      const res = await fetch(`${RELAY_ENDPOINT}/cli/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, code, createIfMissing: true }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { ok?: boolean; isError?: boolean; error?: unknown; value?: unknown; text?: string };
      return JSON.stringify({
        ok: !data.isError && !data.error,
        value: data.value,
        text: data.text,
        error: data.error,
      });
    }
    if (args[0] === "session" && args[1] === "delete" && args[2]) {
      const res = await fetch(`${RELAY_ENDPOINT}/cli/session/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: args[2] }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      return JSON.stringify(await res.json());
    }
    return null;
  } catch {
    return null;
  }
}

export const defaultCommandRunner: CommandRunner = async (args) => {
  const httpResult = await httpCommand(args);
  if (httpResult !== null) return httpResult;
  return (await execFileAsync(cli, args, { maxBuffer: 8 * 1024 * 1024, timeout: 30_000 })).stdout;
};

function parseStatus(stdout: string): BrowserStatus {
  try {
    const value = JSON.parse(stdout) as { targets?: BrowserTarget[]; sessions?: BrowserSession[] };
    return {
      targets: Array.isArray(value.targets) ? value.targets : [],
      sessions: Array.isArray(value.sessions) ? value.sessions : [],
    };
  } catch {
    return { targets: [], sessions: [] };
  }
}

export interface BrowserBoundaryOptions {
  settleTimeoutMs?: number;
}

export interface BrowserBoundary {
  begin(runId: string): Promise<void>;
  observe(runId: string, screenshotPath?: string): Promise<Observation>;
  open(runId: string, url: string): Promise<string>;
  act(runId: string, action: PlannedAction, observation: Observation): Promise<string>;
  close?(runId: string): Promise<void>;
}

export function createBrowserBoundary(
  command: CommandRunner = defaultCommandRunner,
  options: BrowserBoundaryOptions = {},
): BrowserBoundary {
  const sessions = new Set<string>();
  const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  async function status(): Promise<BrowserStatus> {
    try { return parseStatus(await command(["status", "--json"])); }
    catch { return { targets: [], sessions: [] }; }
  }
  async function waitForNewPage(previousIds: Set<string>): Promise<BrowserTarget | null> {
    const currentStatus = await status();
    const discovered = currentStatus.targets.find((target) =>
      !previousIds.has(target.id) && target.type === "page" && target.owner === "relay" && /^https?:\/\//.test(target.url ?? ""),
    ) ?? null;

    if (!discovered) return null;

    // A newly opened target often starts on an intermediate POST URL before
    // redirecting. Wait briefly for its URL to settle before mirroring it into
    // the run's session page.
    const destination = (candidate: BrowserTarget, browserStatus: BrowserStatus) => {
      const sessionUrl = browserStatus.sessions.find((session) => session.id === candidate.browserControlSessionId)?.pageUrl;
      return typeof sessionUrl === "string" && /^https?:\/\//.test(sessionUrl) ? sessionUrl : candidate.url;
    };
    let latest = { ...discovered, url: destination(discovered, currentStatus) };
    let stableSince = Date.now();
    const settleDeadline = Date.now() + (options.settleTimeoutMs ?? 1500);
    let pollStatus = currentStatus;
    while (Date.now() < settleDeadline) {
      await pause(100);
      pollStatus = await status();
      const current = pollStatus.targets.find((target) => target.id === discovered.id);
      if (!current) break;
      const currentUrl = destination(current, pollStatus);
      if (currentUrl !== latest.url) {
        latest = { ...current, url: currentUrl };
        stableSince = Date.now();
      } else if (Date.now() - stableSince >= 250) {
        break;
      }
    }
    return latest;
  }
  async function ensureSession(session: string) {
    if (sessions.has(session)) return;
    try { await command(["session", "new", session]); sessions.add(session); }
    catch (error) { throw new Error(`Browser Control unavailable: ${error instanceof Error ? error.message : String(error)}`); }
  }
  async function execute(session: string, code: string): Promise<unknown> {
    await ensureSession(session);
    try {
      const stdout = await command(["execute", "--json", "--session", session, code]);
      const envelope = JSON.parse(stdout) as Envelope;
      if (!envelope.ok) throw new Error(typeof envelope.error === "string" ? envelope.error : envelope.error?.message ?? envelope.text ?? "Browser Control failed");
      return envelope.value;
    } catch (error) {
      throw new Error(`Browser Control unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    async begin(runId) {
      await execute(`jev-${runId}`, `await page.goto("about:blank"); return true`);
    },
    async observe(runId, screenshotPath) {
      if (screenshotPath) {
        await mkdir(path.dirname(screenshotPath), { recursive: true });
      }
      const screenshotSnippet = screenshotPath
        ? `await page.screenshot({ path: ${JSON.stringify(screenshotPath)}, scale: "css" });`
        : "";
      const observeScript = `
        const extract = async () => {
          return await page.evaluate(() => {
            document.querySelectorAll("[data-jev-ref]").forEach((el) => el.removeAttribute("data-jev-ref"));
            const selector = "a,button,input,textarea,select,[role=button],[role=link],[role=textbox],[role=searchbox],[contenteditable=true]";
            const elements = Array.from(document.querySelectorAll(selector)).filter((el) => {
              if (!(el instanceof HTMLElement)) return false;
              const rect = el.getBoundingClientRect();
              const style = getComputedStyle(el);
              if (el.tagName.toLowerCase() === "a" && (el.getAttribute("href") || "").startsWith("#")) return false;
              const name = el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("title") || el.getAttribute("alt") || (el instanceof HTMLInputElement ? el.value : "") || el.innerText || el.textContent || "";
              return Boolean(String(name).trim()) && rect.width > 0 && rect.height > 0 && rect.right >= 0 && rect.left <= innerWidth && rect.bottom >= 0 && rect.top <= innerHeight && style.visibility !== "hidden" && style.display !== "none";
            }).slice(0, 180);
            const candidates = elements.map((el, index) => {
              const ref = "e" + (index + 1);
              el.setAttribute("data-jev-ref", ref);
              const tag = el.tagName.toLowerCase();
              const type = (el.getAttribute("type") || "").toLowerCase();
              const role = el.getAttribute("role") || (tag === "a" ? "link" : tag === "button" ? "button" : tag === "select" ? "combobox" : tag === "textarea" ? "textbox" : tag === "input" ? (type === "search" ? "searchbox" : type === "submit" ? "button" : "textbox") : el.isContentEditable ? "textbox" : tag);
              const name = el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("title") || el.getAttribute("alt") || (el instanceof HTMLInputElement ? el.value : "") || el.innerText || el.textContent || "";
              return { ref, label: (role + " " + JSON.stringify(String(name).replace(/\\s+/g, " ").trim().slice(0, 220))).trim() };
            });
            const el = document.activeElement;
            let focusedField = null;
            if (el && el instanceof HTMLElement && el !== document.body) {
              const tag = el.tagName.toLowerCase();
              const role = el.getAttribute("role") || "";
              const isText = tag === "textarea" || (tag === "input" && !["button", "submit", "checkbox", "radio", "file", "hidden"].includes((el.getAttribute("type") || "text").toLowerCase())) || role === "textbox" || role === "searchbox" || el.isContentEditable;
              focusedField = { label: el.getAttribute("aria-label") || el.getAttribute("name") || el.getAttribute("id") || "", placeholder: el.getAttribute("placeholder") || "", value: "value" in el ? String(el.value || "").slice(0, 300) : String(el.textContent || "").slice(0, 300), isText };
            }
            return { candidates, focusedField, pageText: String(document.body?.innerText || "").replace(/\\n{3,}/g, "\\n\\n").slice(0, 12000) };
          });
        };
        let dom;
        try {
          dom = await extract();
        } catch (e) {
          if (String(e).includes("Execution context was destroyed") || String(e).includes("navigation")) {
            await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
            dom = await extract();
          } else {
            throw e;
          }
        }
        ${screenshotSnippet}
        return { ...dom, url: page.url(), title: await page.title() };
      `;
      const value = await execute(`jev-${runId}`, observeScript) as { candidates?: Candidate[]; pageText?: string; focusedField?: FocusedField | null; url?: string; title?: string };
      const candidates = value.candidates ?? [];
      const snapshot = `${candidates.map((item) => `${item.label} [ref=${item.ref}]`).join("\n")}\n\nVisible page text:\n${value.pageText ?? ""}`.slice(0, 30_000);
      return {
        id: randomUUID(), snapshot, candidates,
        url: String(value?.url ?? ""), title: String(value?.title ?? ""),
        ...(value.focusedField ? { focusedField: value.focusedField } : {}),
        ...(screenshotPath ? { screenshotUrl: `/api/runs/${runId}/screenshot` } : {}),
      };
    },
    async open(runId, rawUrl) {
      const url = new URL(rawUrl);
      if (url.protocol !== "https:") return "open_site refused: writer did not provide a valid HTTPS URL";
      const result = await execute(`jev-${runId}`, `await page.goto(${JSON.stringify(url.toString())}); return page.url()`);
      return `opened ${String(result || url.toString())}`;
    },
    async act(runId, action, observation) {
      validateAction(action, observation);
      const targetIdsBefore = action.kind === "click_item"
        ? new Set((await status()).targets.map((target) => target.id))
        : new Set<string>();
      const scripts: Record<string, string> = {
        click_item: `try {
          const popupPromise = page.waitForEvent("popup", { timeout: 1000 }).catch(() => null);
          await page.locator(${JSON.stringify(`[data-jev-ref="${action.target}"]`)}).click({ timeout: 5000 });
          const popup = await popupPromise;
          if (popup) {
            await popup.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
            const popupUrl = popup.url();
            if (popupUrl && popupUrl !== "about:blank" && !page.isClosed()) {
              await page.goto(popupUrl);
              await popup.close().catch(() => {});
              return ${JSON.stringify(`clicked ${observation.candidates.find((item) => item.ref === action.target)?.label ?? action.target}`)} + "; followed popup " + page.url();
            }
          }
          return ${JSON.stringify(`clicked ${observation.candidates.find((item) => item.ref === action.target)?.label ?? action.target}`)};
        } catch (error) { return "click_item failed: " + String(error && error.message ? error.message : error).slice(0, 180) }`,
        type_text: `try {
          await page.locator(":focus").fill(${JSON.stringify(action.value ?? "")}, { timeout: 2000 });
        } catch {
          await page.keyboard.insertText(${JSON.stringify(action.value ?? "")});
        }
        return ${JSON.stringify(`typed ${JSON.stringify(action.value ?? "")} into ${observation.focusedField?.label || observation.focusedField?.placeholder || "focused field"}`)};`,
        press_enter: `await page.keyboard.press("Enter"); return "pressed Enter"`,
        press_escape: `await page.keyboard.press("Escape"); return "pressed Escape"`,
        scroll_down: `await page.mouse.wheel(0, 650); return "scrolled down"`,
        scroll_up: `await page.mouse.wheel(0, -650); return "scrolled up"`,
        back: `await page.goBack(); return "went back"`,
        wait: `await page.waitForTimeout(1000); return "waited"`,
      };
      const script = scripts[action.kind];
      if (!script) throw new Error(`Action ${action.kind} cannot be executed by the browser boundary`);
      const result = String(await execute(`jev-${runId}`, script));
      if (action.kind !== "click_item" || result.includes("; followed popup ")) return result;

      // Browser Control can expose a click-created tab as a separate relay
      // session instead of a Playwright popup. Detect that target at the relay
      // boundary, then continue the run from its settled destination.
      const newPage = await waitForNewPage(targetIdsBefore);
      if (!newPage?.url) return result;
      await execute(`jev-${runId}`, `await page.goto(${JSON.stringify(newPage.url)}); return page.url()`);
      if (newPage.browserControlSessionId && newPage.browserControlSessionId !== `jev-${runId}`) {
        await command(["session", "delete", newPage.browserControlSessionId]).catch(() => undefined);
      }
      return `${result}; followed new page ${newPage.url}`;
    },
    async close(runId) {
      const session = `jev-${runId}`;
      sessions.delete(session);
      try {
        await command(["session", "delete", session]);
      } catch {
        // ignore errors during cleanup
      }
    },
  };
}

export const browserBoundary = createBrowserBoundary();
