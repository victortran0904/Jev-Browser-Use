import path from "node:path";
import { randomUUID } from "node:crypto";
import type { BrowserBoundary } from "./browser.js";
import { browserBoundary } from "./browser.js";
import { planner as defaultPlanner } from "./planner.js";
import { narrator as defaultNarrator, type Narrator } from "./narrator.js";
import type { PlannedAction, Run, RunEvent } from "./types.js";

interface Planner { plan(input: { goal: string; values: string[]; history: RunEvent[]; observation: NonNullable<Run["observation"]> }): Promise<PlannedAction> }
interface StartInput { goal: string; startUrl: string; values?: string[] }
type Listener = (event: RunEvent) => void;
const narratorUrl = (value: string) => { try { const url = new URL(value); return `${url.origin}${url.pathname}`; } catch { return ""; } };

export function createRunController(deps: { browser?: BrowserBoundary; planner?: Planner; narrator?: Narrator } = {}) {
  const browser = deps.browser ?? browserBoundary;
  const planner = deps.planner ?? defaultPlanner;
  const narrator = deps.narrator ?? defaultNarrator;
  const runs = new Map<string, Run>();
  const listeners = new Map<string, Set<Listener>>();
  const promises = new Map<string, Promise<void>>();

  function emit(run: Run, type: string, message: string, data?: Record<string, unknown>) {
    const event: RunEvent = { id: run.events.length + 1, type, at: new Date().toISOString(), message, data };
    run.events.push(event);
    listeners.get(run.id)?.forEach((listener) => listener(event));
  }

  async function loop(run: Run): Promise<void> {
    try {
      while (run.stepCount < 12 && !run.stopped) {
        const screenshotPath = path.resolve(".runs", run.id, `${randomUUID()}.png`);
        run.screenshotPath = screenshotPath;
        const observation = await browser.observe(run.id, screenshotPath);
        if (run.stopped || run.status !== "running") return;
        run.observation = observation;
        emit(run, "observation", `Observed ${observation.title || observation.url || "page"}`, { observationId: observation.id, url: observation.url, title: observation.title, screenshotUrl: observation.screenshotUrl });
        const action = await planner.plan({ goal: run.goal, values: run.values, history: run.events, observation });
        if (run.stopped || run.status !== "running") return;
        run.stepCount += 1;
        emit(run, "plan", `Jev chose ${action.kind}`, { ...action });
        if (action.kind === "done" || action.kind === "none") {
          run.status = "complete";
          emit(run, "run_complete", action.kind === "done" ? "Goal marked complete by Jev" : "Jev found no useful next action");
          return;
        }
        if (run.stopped || run.status !== "running") return;
        await browser.act(run.id, action, observation, run.values);
        if (run.stopped || run.status !== "running") return;
        emit(run, "action", `Executed ${action.kind}`, { action });
      }
      if (run.stopped) return;
      run.status = "error";
      run.error = "Reached the 12-step limit before the goal was complete";
      emit(run, "run_error", run.error);
    } catch (error) {
      if (run.stopped) return;
      const message = error instanceof Error ? error.message : String(error);
      run.status = "error";
      run.error = message;
      emit(run, "run_error", message);
    }
  }

  return {
    start(input: StartInput): Run {
      if (!input.goal.trim()) throw new Error("Goal is required");
      const url = new URL(input.startUrl);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Start URL must use http or https");
      const run: Run = { id: randomUUID(), goal: input.goal.trim(), startUrl: url.toString(), values: (input.values ?? []).filter(Boolean), status: "running", events: [], createdAt: new Date().toISOString(), stepCount: 0 };
      runs.set(run.id, run);
      emit(run, "user_message", run.goal, { role: "user" });
      emit(run, "run_started", `Opening ${url.hostname}`);
      const acknowledgement = narrator.acknowledge(run.goal).catch(() => "I’ll start working on that now.").then((message) => emit(run, "agent_message", message, { role: "agent" }));
      const browserTask = browser.navigate(run.id, run.startUrl).then(() => {
        if (run.stopped || run.status !== "running") return;
        return loop(run);
      }).catch((error) => {
        if (run.stopped) return;
        const message = error instanceof Error ? error.message : String(error);
        run.status = "error";
        run.error = message;
        emit(run, "run_error", message);
      });
      const summary = Promise.all([browserTask, acknowledgement]).then(() => narrator.summarize({ goal: run.goal, actions: run.events.filter((event) => event.type === "plan" || event.type === "action").map((event) => event.message).slice(-12), finalUrl: narratorUrl(run.observation?.url ?? run.startUrl), outcome: run.status === "error" ? "error" : "complete" }).catch(() => run.status === "error" ? "The browser run ended with an error." : "The browser run is complete.").then((message) => emit(run, "agent_message", message, { role: "agent" })));
      const task = Promise.all([acknowledgement, summary]).then(() => undefined);
      promises.set(run.id, task);
      return run;
    },
    get(id: string) { return runs.get(id); },
    list() { return [...runs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async settled(id: string) { await promises.get(id); },
    subscribe(id: string, listener: Listener) {
      const set = listeners.get(id) ?? new Set(); set.add(listener); listeners.set(id, set);
      return () => set.delete(listener);
    },
    stop(id: string) {
      const run = runs.get(id); if (!run) throw new Error("Run not found");
      run.stopped = true; run.status = "complete"; emit(run, "run_stopped", "Stopped by user"); return run;
    },
  };
}

export const runs = createRunController();
export type RunController = ReturnType<typeof createRunController>;
