import { describe, expect, it } from "vitest";
import type { BrowserBoundary } from "../server/browser.js";
import { createRunController } from "../server/runs.js";

const observation = { id: "obs-1", url: "https://example.com", title: "Example", snapshot: "button Submit [ref=e1]", candidates: [{ ref: "e1", label: "button Submit" }] };
const makeBrowser = (overrides: Partial<BrowserBoundary> = {}): BrowserBoundary => ({
  begin: async () => {},
  open: async (_id, url) => `opened ${url}`,
  observe: async () => observation,
  act: async () => "acted",
  close: async () => {},
  ...overrides,
});

describe("run controller", () => {
  it("starts neutral and lets Jev open an unknown site through Gemini", async () => {
    const calls: string[] = [];
    let step = 0;
    const controller = createRunController({
      browser: makeBrowser({
        observe: async () => ({ ...observation, id: `obs-${++step}`, url: step === 1 ? "about:blank" : "https://www.amazon.ca" }),
        open: async (_runId, url) => { calls.push(url); return `opened ${url}`; },
      }),
      planner: { plan: async ({ observation: current }) => current.url === "about:blank" ? { kind: "open_site", site: "other", observationId: current.id, confidence: 0.9 } : { kind: "done", observationId: current.id, confidence: 0.9 } },
      writer: { generateUrl: async () => "https://www.amazon.ca", generateText: async () => ({ fill: true, text: "", reason: "" }) },
    });
    const run = controller.start({ goal: "navigate to amazon.ca" });
    await controller.settled(run.id);
    expect(calls).toEqual(["https://www.amazon.ca"]);
    expect(controller.get(run.id)?.events).toContainEqual(expect.objectContaining({ type: "action", message: "opened https://www.amazon.ca" }));
  });

  it("opens explicit URLs directly without calling planner or writer", async () => {
    const openedUrls: string[] = [];
    let planCalled = false;
    let step = 0;
    const controller = createRunController({
      browser: makeBrowser({
        observe: async () => ({ ...observation, id: `obs-${++step}`, url: step === 1 ? "about:blank" : "https://www.google.com/travel/flights" }),
        open: async (_runId, url) => { openedUrls.push(url); return `opened ${url}`; },
      }),
      planner: {
        plan: async ({ observation: current }) => {
          planCalled = true;
          return { kind: "done", observationId: current.id, confidence: 0.9 };
        },
      },
    });
    const run = controller.start({ goal: "go to https://www.google.com/travel/flights" });
    await controller.settled(run.id);
    expect(openedUrls).toEqual(["https://www.google.com/travel/flights"]);
    const events = controller.get(run.id)?.events ?? [];
    const directPlan = events.find((e) => e.type === "plan");
    expect(directPlan?.message).toContain("Jev detected explicit URL");
    expect(planCalled).toBe(true); // called on step 2 for done
  });

  it("emits phase timings on observation, plan, and action events", async () => {
    const controller = createRunController({
      browser: makeBrowser({
        act: async () => "scrolled down",
      }),
      planner: {
        plan: async ({ observation: current }) => ({ kind: "done", observationId: current.id, confidence: 0.9 }),
      },
    });
    const run = controller.start({ goal: "check something" });
    await controller.settled(run.id);
    const events = controller.get(run.id)?.events ?? [];
    const obsEvent = events.find((e) => e.type === "observation");
    expect(obsEvent?.data).toHaveProperty("durationMs");
    expect(obsEvent?.data?.phase).toBe("observe");

    const planEvent = events.find((e) => e.type === "plan");
    expect(planEvent?.data).toHaveProperty("durationMs");
    expect(planEvent?.data?.phase).toBe("plan");
  });

  it("disables screenshots by default and enables them only when configured", async () => {
    const observedPaths: (string | undefined)[] = [];
    const defaultController = createRunController({
      browser: makeBrowser({
        observe: async (_id, screenshotPath) => {
          observedPaths.push(screenshotPath);
          return observation;
        },
      }),
      planner: { plan: async ({ observation: current }) => ({ kind: "done", observationId: current.id, confidence: 0.9 }) },
    });
    const run1 = defaultController.start({ goal: "no screenshots" });
    await defaultController.settled(run1.id);
    expect(observedPaths).toEqual([undefined]);

    const enabledController = createRunController({
      enableScreenshots: true,
      browser: makeBrowser({
        observe: async (_id, screenshotPath) => {
          observedPaths.push(screenshotPath);
          return observation;
        },
      }),
      planner: { plan: async ({ observation: current }) => ({ kind: "done", observationId: current.id, confidence: 0.9 }) },
    });
    const run2 = enabledController.start({ goal: "with screenshots" });
    await enabledController.settled(run2.id);
    expect(observedPaths[1]).toContain("screenshot.png");
  });

  it("repeats observe, choose, execute, and result feedback until done", async () => {
    let plans = 0;
    const histories: string[][] = [];
    const controller = createRunController({
      browser: makeBrowser({ act: async () => "clicked button Submit" }),
      planner: { plan: async ({ observation: current, history }) => { histories.push([...history]); return ++plans === 1 ? { kind: "click_item", target: "e1", observationId: current.id, confidence: 0.9 } : { kind: "done", observationId: current.id, confidence: 0.9 }; } },
    });
    const run = controller.start({ goal: "submit" });
    await controller.settled(run.id);
    expect(controller.get(run.id)?.status).toBe("complete");
    expect(histories).toEqual([[], ["clicked button Submit"]]);
  });

  it("stops after six repeated ineffective actions", async () => {
    let actions = 0;
    const controller = createRunController({
      browser: makeBrowser({ act: async () => { actions += 1; return "scrolled down"; } }),
      planner: { plan: async () => ({ kind: "scroll_down", observationId: "obs-1", confidence: 0.9 }) },
    });
    const run = controller.start({ goal: "find something" });
    await controller.settled(run.id);
    expect(actions).toBe(7);
    expect(controller.get(run.id)?.error).toMatch(/repeated/i);
  });

  it("does not act on an observation that finishes after Stop", async () => {
    let release!: (value: typeof observation) => void;
    let acted = false;
    const controller = createRunController({
      browser: makeBrowser({ observe: async () => new Promise((resolve) => { release = resolve; }), act: async () => { acted = true; return "acted"; } }),
      planner: { plan: async () => ({ kind: "click_item", target: "e1", observationId: "obs-1", confidence: 0.9 }) },
    });
    const run = controller.start({ goal: "open" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.stop(run.id); release(observation); await controller.settled(run.id);
    expect(acted).toBe(false);
    expect(controller.get(run.id)?.status).toBe("complete");
  });

  it("reports neutral-session startup errors", async () => {
    const controller = createRunController({ browser: makeBrowser({ begin: async () => { throw new Error("extension offline"); } }), planner: { plan: async () => ({ kind: "done", observationId: "obs-1" }) } });
    const run = controller.start({ goal: "visit" });
    await controller.settled(run.id);
    expect(controller.get(run.id)?.events).toContainEqual(expect.objectContaining({ type: "run_error", message: "extension offline" }));
  });

  it("keeps DOM and URL secrets out of narrator messages", async () => {
    const calls: unknown[] = [];
    const controller = createRunController({
      browser: makeBrowser({ observe: async () => ({ ...observation, snapshot: "PRIVATE DOM", url: "https://example.com/final?token=PRIVATE_URL_SECRET" }) }),
      planner: { plan: async () => ({ kind: "done", observationId: "obs-1", confidence: 0.9 }) },
      narrator: { acknowledge: async (goal) => { calls.push(goal); return "On it."; }, summarize: async (input) => { calls.push(input); return "Finished."; } },
    });
    const run = controller.start({ goal: "find docs" });
    await controller.settled(run.id);
    const serialized = JSON.stringify(calls);
    expect(serialized).not.toContain("PRIVATE DOM");
    expect(serialized).not.toContain("PRIVATE_URL_SECRET");
    expect(serialized).toContain("https://example.com/final");
  });
  it("does not type when Stop happens while the writer is still generating text", async () => {
    let release!: (value: { fill: boolean; text: string; reason: string }) => void;
    let acted = false;
    const controller = createRunController({
      browser: makeBrowser({ observe: async () => ({ ...observation, focusedField: { label: "Search", placeholder: "", value: "", isText: true } }), act: async () => { acted = true; return "typed"; } }),
      planner: { plan: async () => ({ kind: "type_text", observationId: observation.id, confidence: 1 }) },
      writer: { generateUrl: async () => "", generateText: async () => new Promise(resolve => { release = resolve; }) },
      narrator: { acknowledge: async () => "Starting", summarize: async () => "Stopped" },
    });
    const run = controller.start({ goal: "Search" });
    await expect.poll(() => typeof release).toBe("function");
    controller.stop(run.id);
    release({ fill: true, text: "query", reason: "" });
    await controller.settled(run.id);
    expect(acted).toBe(false);
    expect(run.events.filter(event => event.type === "action")).toHaveLength(0);
  });

  it("fills a selected observed field directly with text generated for that field", async () => {
    const actions: unknown[] = []; let plans = 0; let writerLabel = "";
    const field = { label: "Destination", placeholder: "Destination", value: "", isText: true };
    const current = { ...observation, candidates: [{ ref: "e2", label: 'textbox "Destination"', field }] };
    const controller = createRunController({
      browser: makeBrowser({ observe: async () => current, act: async (_id, action) => { actions.push(action); return "filled observed text field"; } }),
      planner: { plan: async () => ++plans === 1 ? { kind: "fill_item", target: "e2", observationId: current.id, confidence: 1 } : { kind: "done", observationId: current.id, confidence: 1 } },
      writer: { generateUrl: async () => "", generateText: async input => { writerLabel = input.observation.focusedField?.label ?? ""; return { fill: true, text: "YVR", reason: "" }; } },
      narrator: { acknowledge: async () => "Starting", summarize: async () => "Finished" },
    });
    const run = controller.start({ goal: "Find a flight to Vancouver" }); await controller.settled(run.id);
    expect(writerLabel).toBe("Destination");
    expect(actions).toEqual([expect.objectContaining({ kind: "fill_item", target: "e2", value: "YVR" })]);
  });

  it("reports writer latency separately from browser action latency", async () => {
    let plans = 0;
    const controller = createRunController({
      browser: makeBrowser({ observe: async () => ({ ...observation, focusedField: { label: "Search", placeholder: "", value: "", isText: true } }) }),
      planner: { plan: async () => ({ kind: ++plans === 1 ? "type_text" : "done", observationId: observation.id, confidence: 1 }) },
      writer: { generateUrl: async () => "", generateText: async () => { await new Promise(resolve => setTimeout(resolve, 30)); return { fill: true, text: "query", reason: "" }; } },
      narrator: { acknowledge: async () => "Starting", summarize: async () => "Finished" },
    });
    const run = controller.start({ goal: "Search" }); await controller.settled(run.id);
    const action = run.events.find(event => event.type === "action")!;
    expect(action.data?.writerMs).toBeGreaterThanOrEqual(20);
    expect(action.data?.browserMs).toBeGreaterThanOrEqual(0);
    expect(run.timings?.writerMs).toBe(action.data?.writerMs);
  });

  it("opens an explicit initial URL before requesting a costly browser observation", async () => {
    let opened = false;
    const controller = createRunController({
      browser: makeBrowser({ open: async () => { opened = true; return "opened"; }, observe: async () => { if (!opened) throw new Error("Blank page was unnecessarily scanned"); return observation; } }),
      planner: { plan: async () => ({ kind: "done", observationId: observation.id, confidence: 1 }) },
      narrator: { acknowledge: async () => "Starting", summarize: async () => "Finished" },
    });
    const run = controller.start({ goal: "Visit https://example.com" }); await controller.settled(run.id);
    expect(run.status).toBe("complete");
    expect(opened).toBe(true);
    expect(run.events.find(event => event.type === "observation")?.data?.synthetic).toBe(true);
  });

});
