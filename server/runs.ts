import path from "node:path";
import { rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { BrowserBoundary } from "./browser.js";
import { browserBoundary } from "./browser.js";
import { planner as defaultPlanner } from "./planner.js";
import { narrator as defaultNarrator, type Narrator } from "./narrator.js";
import { SITES } from "./sites.js";
import type { PlannedAction, Run, RunEvent } from "./types.js";
import { extractExplicitUrl } from "./urls.js";
import { writer as defaultWriter, type Writer } from "./writer.js";

interface Planner { plan(input: { goal: string; history: string[]; observation: NonNullable<Run["observation"]> }): Promise<PlannedAction> }
interface StartInput { goal: string }
type Listener = (event: RunEvent) => void;
const narratorUrl = (value: string) => { try { const url = new URL(value); return `${url.origin}${url.pathname}`; } catch { return ""; } };
const isNoop = (result: string) => ["refused", "failed", "waited"].some((word) => result.includes(word));

export interface RunControllerOptions {
  browser?: BrowserBoundary;
  planner?: Planner;
  narrator?: Narrator;
  writer?: Writer;
  enableScreenshots?: boolean;
}

export function createRunController(deps: RunControllerOptions = {}) {
  const browser = deps.browser ?? browserBoundary;
  const planner = deps.planner ?? defaultPlanner;
  const narrator = deps.narrator ?? defaultNarrator;
  const writer = deps.writer ?? defaultWriter;
  const enableScreenshots = deps.enableScreenshots ?? (process.env.ENABLE_SCREENSHOTS === "true");
  const runs = new Map<string, Run>();
  const listeners = new Map<string, Set<Listener>>();
  const promises = new Map<string, Promise<void>>();

  function emit(run: Run, type: string, message: string, data?: Record<string, unknown>) {
    const event: RunEvent = { id: run.events.length + 1, type, at: new Date().toISOString(), message, data };
    run.events.push(event);
    listeners.get(run.id)?.forEach((listener) => listener(event));
  }

  async function loop(run: Run): Promise<void> {
    const history: string[] = [];
    let consecutiveNoops = 0;
    let lastResult = "";
    let lastState = "";
    try {
      while (run.stepCount < 12 && !run.stopped) {
        const stepStart = Date.now();
        const screenshotPath = enableScreenshots ? path.resolve(".runs", run.id, "screenshot.png") : undefined;
        run.screenshotPath = screenshotPath;

        const observeStart = Date.now();
        const observation = await browser.observe(run.id, screenshotPath);
        const observeMs = Date.now() - observeStart;
        if (run.stopped || run.status !== "running") return;
        run.observation = observation;
        emit(run, "observation", `Observed ${observation.title || observation.url || "page"}`, {
          observationId: observation.id,
          url: observation.url,
          title: observation.title,
          screenshotUrl: observation.screenshotUrl,
          durationMs: observeMs,
          phase: "observe",
        });

        // Optimization 4: Parse explicit URLs directly without a model call
        const directUrl = run.stepCount === 0 && (observation.url === "about:blank" || !observation.url)
          ? extractExplicitUrl(run.goal)
          : null;

        let action: PlannedAction;
        let planMs = 0;

        if (directUrl) {
          run.stepCount += 1;
          action = {
            kind: "open_site",
            url: directUrl,
            observationId: observation.id,
            confidence: 1.0,
            probabilities: { open_site: 1.0 },
          };
          emit(run, "plan", `Jev detected explicit URL ${directUrl}`, {
            ...action,
            durationMs: 0,
            phase: "plan",
          });
        } else {
          const planStart = Date.now();
          action = await planner.plan({ goal: run.goal, history, observation });
          planMs = Date.now() - planStart;
          if (run.stopped || run.status !== "running") return;
          run.stepCount += 1;
          emit(run, "plan", `Jev chose ${action.kind}`, {
            ...action,
            durationMs: planMs,
            phase: "plan",
          });
          if ((action.confidence ?? 1) < 0.3) {
            run.status = "error";
            run.error = `Jev confidence ${(action.confidence ?? 0).toFixed(2)} was below 0.30`;
            emit(run, "run_error", run.error);
            return;
          }
          if (action.kind === "done" || action.kind === "none") {
            run.status = "complete";
            emit(run, "run_complete", action.kind === "done" ? "Goal marked complete by Jev" : "Jev found no useful next action");
            return;
          }
        }

        const actStart = Date.now();
        let result: string;
        if (action.kind === "open_site") {
          const knownUrl = action.site ? SITES[action.site] : "";
          const explicitUrl = extractExplicitUrl(run.goal);
          const url = action.url || knownUrl || (action.site === "other" ? (explicitUrl ?? await writer.generateUrl({ goal: run.goal, history })) : explicitUrl);
          result = url ? await browser.open(run.id, url) : "open_site refused: no catalog site matched and the writer supplied no valid URL";
        } else if (action.kind === "type_text") {
          if (!observation.focusedField?.isText) result = "type_text refused: no browser text field is focused";
          else {
            const generated = await writer.generateText({ goal: run.goal, history, observation });
            if (!generated.fill || !generated.text) result = `type_text refused: ${generated.reason || "writer declined"}`;
            else result = await browser.act(run.id, { ...action, value: generated.text }, observation);
          }
        } else {
          result = await browser.act(run.id, action, observation);
        }

        const actMs = Date.now() - actStart;
        const totalStepMs = Date.now() - stepStart;
        run.timings = { observeMs, planMs, actMs, totalMs: totalStepMs };

        history.push(result);
        emit(run, "action", result, {
          action,
          durationMs: actMs,
          phase: "act",
          stepDurationMs: totalStepMs,
        });

        const state = `${observation.url}\n${observation.snapshot}`;
        const repeated = result === lastResult && state === lastState;
        consecutiveNoops = isNoop(result) || repeated ? consecutiveNoops + 1 : 0;
        lastResult = result;
        lastState = state;
        if (consecutiveNoops >= 6) {
          run.status = "error";
          run.error = "Stopped after six repeated or ineffective actions";
          emit(run, "run_error", run.error);
          return;
        }
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
    } finally {
      await browser.close?.(run.id).catch(() => {});
      if (!enableScreenshots) {
        await rm(path.resolve(".runs", run.id), { recursive: true, force: true }).catch(() => {});
      }
    }
  }

  return {
    start(input: StartInput): Run {
      if (!input.goal.trim()) throw new Error("Goal is required");
      const run: Run = { id: randomUUID(), goal: input.goal.trim(), status: "running", events: [], createdAt: new Date().toISOString(), stepCount: 0 };
      runs.set(run.id, run);
      emit(run, "user_message", run.goal, { role: "user" });
      emit(run, "run_started", "Starting a neutral browser session");
      const acknowledgement = narrator.acknowledge(run.goal).catch(() => "I\u2019ll start working on that now.").then((message) => emit(run, "agent_message", message, { role: "agent" }));
      const browserTask = browser.begin(run.id).then(() => {
        if (run.stopped || run.status !== "running") return;
        return loop(run);
      }).catch((error) => {
        if (run.stopped) return;
        const message = error instanceof Error ? error.message : String(error);
        run.status = "error"; run.error = message; emit(run, "run_error", message);
      });
      const summary = Promise.all([browserTask, acknowledgement]).then(() => narrator.summarize({
        goal: run.goal,
        actions: run.events.filter((event) => event.type === "action").map((event) => event.message).slice(-12),
        finalUrl: narratorUrl(run.observation?.url ?? ""),
        outcome: run.status === "error" ? "error" : "complete",
      }).catch(() => run.status === "error" ? "The browser run ended with an error." : "The browser run is complete.").then((message) => emit(run, "agent_message", message, { role: "agent" })));
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
      run.stopped = true; run.status = "complete"; emit(run, "run_stopped", "Stopped by user");
      browser.close?.(run.id).catch(() => {});
      return run;
    },
  };
}

export const runs = createRunController();
export type RunController = ReturnType<typeof createRunController>;
