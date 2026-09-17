import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import type { Candidate, Observation, PlannedAction } from "./types.js";

const execFileAsync = promisify(execFile);
const cli = path.resolve("node_modules/.bin/browser-control");
const actionKinds = new Set(["click", "fill", "press_enter", "press_escape", "scroll_down", "scroll_up", "back", "wait", "done", "none"]);

export function parseSnapshot(snapshot: string): Candidate[] {
  const candidates: Candidate[] = [];
  for (const raw of snapshot.split("\n")) {
    const match = raw.match(/^(.*?)\s*\[ref=([\w-]+)\]/);
    if (!match) continue;
    candidates.push({ ref: match[2], label: match[1].trim().replace(/^[-\s]+/, "") });
    if (candidates.length === 200) break;
  }
  return candidates;
}

export function validateAction(action: PlannedAction, observationId: string, candidates: Candidate[], values: string[]): PlannedAction {
  if (action.observationId !== observationId) throw new Error("Stale observation: refresh before acting");
  if (!actionKinds.has(action.kind)) throw new Error("Unsupported browser action");
  if (action.kind === "click" || action.kind === "fill") {
    const candidate = candidates.find((item) => item.ref === action.target);
    if (!candidate) throw new Error("Target is not in the current observation");
    if (action.kind === "fill") {
      if (!action.value || !values.includes(action.value)) throw new Error("Fill value must be exactly user supplied");
    }
  }
  return action;
}

interface Envelope { ok: boolean; value?: unknown; text?: string; error?: { message?: string } | string; session?: { id?: string } }
type CommandRunner = (args: string[]) => Promise<string>;
const runCommand: CommandRunner = async (args) => (await execFileAsync(cli, args, { maxBuffer: 8 * 1024 * 1024, timeout: 30_000 })).stdout;

export interface BrowserBoundary {
  observe(runId: string, screenshotPath: string): Promise<Observation>;
  navigate(runId: string, url: string): Promise<void>;
  act(runId: string, action: PlannedAction, observation: Observation, values: string[]): Promise<void>;
}

export function createBrowserBoundary(command: CommandRunner = runCommand): BrowserBoundary {
  const sessions = new Set<string>();
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
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Browser Control unavailable: ${message}`);
    }
  }
  return {
  async navigate(runId, url) {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Start URL must use http or https");
    await execute(`jev-${runId}`, `await page.goto(${JSON.stringify(parsed.toString())}); return { url: page.url() }`);
  },
  async observe(runId, screenshotPath) {
    await mkdir(path.dirname(screenshotPath), { recursive: true });
    const value = await execute(`jev-${runId}`, `const semantic = await snapshot(); await page.screenshot({ path: ${JSON.stringify(screenshotPath)}, scale: "css" }); return { snapshot: semantic, url: page.url(), title: await page.title() }`) as { snapshot?: string; url?: string; title?: string };
    const snapshot = String(value?.snapshot ?? "").slice(0, 24_000);
    return { id: randomUUID(), snapshot, candidates: parseSnapshot(snapshot), url: String(value?.url ?? ""), title: String(value?.title ?? ""), screenshotUrl: `/api/runs/${runId}/screenshot` };
  },
  async act(runId, action, observation, values) {
    validateAction(action, observation.id, observation.candidates, values);
    const ref = JSON.stringify(action.target);
    const value = JSON.stringify(action.value);
    const scripts: Record<string, string> = {
      click: `await ref(${ref}).click(); return true`,
      fill: `await ref(${ref}).fill(${value}); return true`,
      press_enter: `await page.keyboard.press("Enter"); return true`,
      press_escape: `await page.keyboard.press("Escape"); return true`,
      scroll_down: `await page.mouse.wheel(0, 600); return true`,
      scroll_up: `await page.mouse.wheel(0, -600); return true`,
      back: `await page.goBack(); return true`,
      wait: `await page.waitForTimeout(1000); return true`,
    };
    if (scripts[action.kind]) await execute(`jev-${runId}`, scripts[action.kind]);
  },
  };
}

export const browserBoundary = createBrowserBoundary();
