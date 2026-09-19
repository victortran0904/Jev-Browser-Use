import { InvalidActionTargetError, StaleObservationError } from "./browser-errors.js";
export { StaleObservationError } from "./browser-errors.js";
import { focusedFillScript, targetFillScript } from "./browser-actions.js";
import { sessionPrelude, sessionCleanup } from "./browser-session.js";
import { observerSource } from "./observer.js";
import { defaultCommandRunner, type CommandRunner } from "./browser-transport.js";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Candidate, FocusedField, Observation, ObservationMetrics, PlannedAction } from "./types.js";

// A physical browser has one focused tab/cursor even when run sessions are isolated.
// Share only the input lock across boundaries using the same external transport.
const inputQueues = new WeakMap<CommandRunner, Promise<void>>();
async function withBrowserInput<T>(command: CommandRunner, work: () => Promise<T>): Promise<T> {
  const prior = inputQueues.get(command) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>(resolve => { release = resolve; });
  inputQueues.set(command, prior.then(() => next));
  await prior;
  try { return await work(); } finally { release(); }
}

const actionKinds = new Set(["open_site", "click_item", "fill_item", "type_text", "press_enter", "press_escape", "scroll_down", "scroll_up", "back", "wait", "done", "none"]);

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
  if ((action.kind === "click_item" || action.kind === "fill_item") && !observation.candidates.some((item) => item.ref === action.target)) throw new InvalidActionTargetError();
  if (action.kind === "type_text" && !observation.focusedField?.isText) throw new Error("No browser text field is focused");
  return action;
}

interface Envelope { ok: boolean; value?: unknown; text?: string; error?: { message?: string } | string }
export type { CommandRunner } from "./browser-transport.js";
export { defaultCommandRunner } from "./browser-transport.js";


export interface BrowserBoundaryOptions {
  /** Activates only this run's owned tab before input; disable for background-only operation. */
  activateTargetBeforeAction?: boolean;
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
  const closedSessions = new Set<string>();
  const latestObservations = new Map<string, string>();
  async function ensureSession(session: string) {
    if (closedSessions.has(session)) throw new Error("Browser run is closed");
    if (sessions.has(session)) return;
    try {
      const response = await command(["session", "new", session]);
      if (response.trim().startsWith("{")) {
        const envelope = JSON.parse(response) as Envelope;
        if (envelope.ok === false || envelope.error) throw new Error("Browser session creation failed");
      }
      if (closedSessions.has(session)) {
        await command(["session", "delete", session]);
        throw new Error("Browser run is closed");
      }
      sessions.add(session);
    }
    catch (error) { throw new Error(`Browser Control unavailable: ${error instanceof Error ? error.message : String(error)}`); }
  }
  async function execute(session: string, code: string): Promise<unknown> {
    await ensureSession(session);
    if (closedSessions.has(session)) throw new Error("Browser run is closed");
    try {
      const stdout = await command(["execute", "--json", "--session", session, sessionPrelude + code]);
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
      const observationStarted = performance.now();
      if (screenshotPath) {
        await mkdir(path.dirname(screenshotPath), { recursive: true });
      }
      const screenshotSnippet = screenshotPath
        ? `const screenshotStarted = performance.now(); await page.screenshot({ path: ${JSON.stringify(screenshotPath)}, scale: "css" }); dom.metrics.screenshotMs = performance.now() - screenshotStarted;`
        : "";
      const observeScript = `
        jevSession.observers ??= new Map();
        const extract = async () => {
          let observer = jevSession.observers.get(page);
          if (!observer) {
            observer = await page.evaluateHandle(${JSON.stringify(observerSource(randomUUID()))});
            jevSession.observers.set(page, observer);
          }
          return await observer.evaluate(value => value.observe());
        };
        let dom;
        try {
          dom = await extract();
        } catch (e) {
          if (String(e).includes("Execution context was destroyed") || String(e).includes("navigation")) {
            const oldObserver = jevSession.observers.get(page);
            jevSession.observers.delete(page);
            await oldObserver?.dispose().catch(() => {});
            // BFCache restores may not emit another DOMContentLoaded event.
            // Read the current document readiness instead of paying an event timeout.
            await page.waitForFunction(() => document.readyState !== "loading" && Boolean(document.body), null, { timeout: 8000 });
            dom = await extract();
          } else {
            throw e;
          }
        }
        if (dom.metrics) dom.metrics.screenshotMs = 0;
        ${screenshotSnippet}
        return dom;
      `;
      const value = await execute(`jev-${runId}`, observeScript) as { readiness?: Observation["readiness"]; metrics?: ObservationMetrics; documentId?: string; candidates?: Candidate[]; pageText?: string; focusedField?: FocusedField | null; url?: string; title?: string };
      const candidates = value.candidates ?? [];
      const snapshot = `${candidates.map((item) => `${item.label} [ref=${item.ref}]`).join("\n")}\n\nVisible page text:\n${value.pageText ?? ""}`.slice(0, 30_000);
      if (value.metrics) Object.assign(value.metrics, {
        boundaryMs: performance.now() - observationStarted,
        payloadBytes: Buffer.byteLength(JSON.stringify(value), "utf8"),
      });
      const observationId = randomUUID();
      latestObservations.set(runId, observationId);
      return {
        id: observationId, snapshot, candidates, pageText: value.pageText, documentId: value.documentId, metrics: value.metrics, readiness: value.readiness,
        url: String(value?.url ?? ""), title: String(value?.title ?? ""),
        ...(value.focusedField ? { focusedField: value.focusedField } : {}),
        ...(screenshotPath ? { screenshotUrl: `/api/runs/${runId}/screenshot?observationId=${observationId}` } : {}),
      };
    },
    async open(runId, rawUrl) {
      const url = new URL(rawUrl);
      if (url.protocol !== "https:") return "open_site refused: writer did not provide a valid HTTPS URL";
      const result = await execute(`jev-${runId}`, `await page.goto(${JSON.stringify(url.toString())}, { waitUntil: "domcontentloaded", timeout: 15000 }); return page.url()`);
      return `opened ${String(result || url.toString())}`;
    },
    async act(runId, action, observation) {
      validateAction(action, observation);
      const latest = latestObservations.get(runId);
      if (latest && latest !== observation.id) throw new Error("Stale observation: a newer state is available");
      const scripts: Record<string, string> = {
        click_item: `const observer = jevSession.observers?.get(page);
          if (!observer) throw new Error("Stale document; observe again");
          let handle;
          try {
            handle = await observer.evaluateHandle((value, input) => value.resolve(input.ref, input.documentId), ${JSON.stringify({ ref: action.target, documentId: observation.documentId })});
          } catch { return { _jevOutcome: "stale-observation", dispatched: false }; }
          try {
            const target = handle.asElement();
            if (!target) throw new Error("Stale browser target; observe again");
            const popupChoice = await target.evaluate(el => {
              const role = el.getAttribute("role");
              return role === "option" || role === "menuitem" || Boolean(el.closest('[role="listbox"],[role="menu"],dialog,[role="dialog"]'));
            }).catch(() => false);
            await target.click({ timeout: 5000 });
            if (popupChoice) {
              await page.waitForFunction(el => {
                if (!el.isConnected) return true;
                const hidden = node => {
                  if (!node?.isConnected) return true;
                  const rect = node.getBoundingClientRect();
                  const style = getComputedStyle(node);
                  return rect.width <= 0 || rect.height <= 0 || style.display === "none" || style.visibility === "hidden";
                };
                if (hidden(el)) return true;
                const owner = el.closest('[role="listbox"],[role="menu"],dialog,[role="dialog"]');
                return owner ? hidden(owner) : false;
              }, target, { timeout: 100 }).catch(() => undefined);
            } else {
              const settle = page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))).catch(() => undefined);
              await Promise.race([settle, page.waitForTimeout(50)]);
            }
          } finally { await handle.dispose(); }
          return ${JSON.stringify(`clicked ${observation.candidates.find((item) => item.ref === action.target)?.label ?? action.target}`)};`,
        fill_item: targetFillScript(observation.documentId, action.target, action.value ?? "", observation.candidates.find(item => item.ref === action.target)?.field?.label || "observed text field"),
        type_text: focusedFillScript(observation.documentId, action.value ?? "", observation.focusedField?.label || observation.focusedField?.placeholder || "focused field"),
        press_enter: `await page.keyboard.press("Enter"); return "pressed Enter"`,
        press_escape: `await page.keyboard.press("Escape"); return "pressed Escape"`,
        scroll_down: `await page.mouse.wheel(0, 650); return "scrolled down"`,
        scroll_up: `await page.mouse.wheel(0, -650); return "scrolled up"`,
        back: `await page.goBack({ waitUntil: "commit", timeout: 15000 }); return "went back"`,
        wait: `await page.waitForTimeout(1000); return "waited"`,
      };
      const script = scripts[action.kind];
      if (!script) throw new Error(`Action ${action.kind} cannot be executed by the browser boundary`);
      const documentGuard = observation.documentId && action.kind !== "wait" ? `
        try {
          const observer = jevSession.observers?.get(page);
          if (!observer || jevSession.active !== page) throw new Error("Document changed");
          await observer.evaluate((value, input) => value.verifyDocument(input.id, input.url), ${JSON.stringify({ id: observation.documentId, url: observation.url })});
          ${action.kind === "press_enter" && observation.focusedField ? `await observer.evaluate((value, id) => { value.resolveFocus(id); return true; }, ${JSON.stringify(observation.documentId)});` : ""}
        } catch { return { _jevOutcome: "stale-observation", dispatched: false }; }
      ` : "";
      const activate = options.activateTargetBeforeAction === false ? "" : "await page.bringToFront();\n";
      const result = await withBrowserInput(command, () => execute(`jev-${runId}`, documentGuard + activate + script));
      if (result && typeof result === "object"
          && (result as { _jevOutcome?: unknown })._jevOutcome === "stale-observation"
          && (result as { dispatched?: unknown }).dispatched === false) throw new StaleObservationError();
      return String(result);
    },
    async close(runId) {
      const session = `jev-${runId}`;
      if (closedSessions.has(session)) return;
      closedSessions.add(session);
      latestObservations.delete(runId);
      if (sessions.has(session)) {
        await command(["execute", "--json", "--session", session, sessionCleanup]).catch(() => undefined);
      }
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
