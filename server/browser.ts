import { createTargetTracker } from "./browser-targets.js";
import { targetSource } from "./action-target.js";
import { collectorSource } from "./observer.js";
import { defaultCommandRunner, type CommandRunner } from "./browser-transport.js";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Candidate, FocusedField, Observation, PlannedAction } from "./types.js";

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
export type { CommandRunner } from "./browser-transport.js";
export { defaultCommandRunner } from "./browser-transport.js";


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
  const targets = createTargetTracker(command);
  const closed = new Set<string>();
  async function ensureSession(session: string) {
    if (closed.has(session)) throw new Error("Browser run is closed");
    if (sessions.has(session)) return;
    try { await command(["session", "new", session]); if (closed.has(session)) { await command(["session", "delete", session]); throw new Error("Browser run is closed"); } sessions.add(session); }
    catch (error) { throw new Error(`Browser Control unavailable: ${error instanceof Error ? error.message : String(error)}`); }
  }
  async function execute(session: string, code: string, cleanup = false): Promise<unknown> {
    if (!cleanup) await ensureSession(session);
    const activeSession = targets.active(session);
    try {
      const wrapped = `
        const rootPage = page;
        const runtime = state.jevRuntime || (state.jevRuntime = { active: rootPage, pending: [], watched: new Map() });
        const watch = (p) => {
          if (runtime.watched.has(p)) return;
          const onPopup = (child) => { watch(child); runtime.pending.push(child); };
          runtime.watched.set(p, onPopup);
          p.on("popup", onPopup);
        };
        watch(rootPage);
        if (!runtime.cdp) {
          runtime.cdp = await rootPage.context().newCDPSession(rootPage);
          runtime.popupVersion = 0;
          runtime.cdp.on("Page.windowOpen", () => { runtime.popupVersion++; });
          await runtime.cdp.send("Page.enable");
          runtime.targetId = (await runtime.cdp.send("Target.getTargetInfo")).targetInfo.targetId;
        }
        while (!${cleanup} && runtime.pending.length) {
          const next = runtime.pending.shift();
          if (!next.isClosed()) {
            runtime.active = next;
            await next.waitForLoadState("domcontentloaded", { timeout: 8000 });
          }
        }
        const output = await (async () => { const page = runtime.active; ${code} })();
        return { __jevBoundary: true, value: output, targetId: runtime.targetId,
          popupVersion: runtime.popupVersion, localPopup: runtime.active !== rootPage };
      `;
      const stdout = await command(["execute", "--json", "--session", activeSession, wrapped]);
      const envelope = JSON.parse(stdout) as Envelope;
      if (!envelope.ok) throw new Error(typeof envelope.error === "string" ? envelope.error : envelope.error?.message ?? envelope.text ?? "Browser Control failed");
      const packet = envelope.value as { __jevBoundary?: boolean; value?: unknown; targetId?: string; popupVersion?: number; localPopup?: boolean };
      if (packet?.__jevBoundary) {
        targets.remember(session, activeSession, packet);
        return packet.value;
      }
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
          return await page.evaluate(${JSON.stringify(collectorSource)});
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
      const root = `jev-${runId}`;
      if (closed.has(root)) throw new Error("Browser run is closed");
      await targets.discover(root);
      let raw = await execute(root, observeScript);
      if (await targets.discover(root)) raw = await execute(root, observeScript);
      const value = raw as { documentId?: string; candidates?: Candidate[]; pageText?: string; focusedField?: FocusedField | null; url?: string; title?: string };
      const candidates = value.candidates ?? [];
      const snapshot = `${candidates.map((item) => `${item.label} [ref=${item.ref}]`).join("\n")}\n\nVisible page text:\n${value.pageText ?? ""}`.slice(0, 30_000);
      return {
        id: randomUUID(), documentId: value.documentId, snapshot, candidates,
        url: String(value?.url ?? ""), title: String(value?.title ?? ""),
        ...(value.focusedField ? { focusedField: value.focusedField } : {}),
        ...(screenshotPath ? { screenshotUrl: `/api/runs/${runId}/screenshot` } : {}),
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
      const scripts: Record<string, string> = {
        click_item: `const handle = await ${targetSource(action.target, observation.documentId)}; try { const target = handle.asElement(); if (!target) throw new Error("Stale target: refresh before acting"); await target.click({ timeout: 5000 }); } finally { await handle.dispose(); } return ${JSON.stringify(`clicked ${observation.candidates.find((item) => item.ref === action.target)?.label ?? action.target}`)}`,
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
        back: `await page.goBack({ waitUntil: "domcontentloaded", timeout: 15000 }); return "went back"`,
        wait: `await page.waitForTimeout(1000); return "waited"`,
      };
      const script = scripts[action.kind];
      if (!script) throw new Error(`Action ${action.kind} cannot be executed by the browser boundary`);
      const result = String(await execute(`jev-${runId}`, `await page.bringToFront(); ${script}`));
      return result;
    },
    async close(runId) {
      const session = `jev-${runId}`;
      if (closed.has(session)) return;
      closed.add(session);
      if (sessions.has(session)) {
        for (const ownedSession of targets.owned(session).reverse()) {
          await command(["execute", "--json", "--session", ownedSession, "--existing", `
            const runtime = state.jevRuntime;
            if (runtime) {
              for (const [owned, listener] of runtime.watched) {
                owned.off("popup", listener);
                if (owned !== page && !owned.isClosed()) await owned.close().catch(() => {});
              }
              await runtime.cdp?.detach().catch(() => {});
              delete state.jevRuntime;
            }
            return true;
          `]).catch(() => {});
          await command(["session", "delete", ownedSession]).catch(() => {});
        }
      }
      sessions.delete(session);
      targets.forget(session);
    },
  };
}

export const browserBoundary = createBrowserBoundary();
