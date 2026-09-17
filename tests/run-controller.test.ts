import { describe, expect, it } from "vitest";
import { createRunController } from "../server/runs.js";

const observation = { id: "obs-1", url: "https://example.com", title: "Example", snapshot: "button Submit [ref=e1]", candidates: [{ ref: "e1", label: "button Submit" }] };

describe("run controller", () => {
  it("runs observe-plan-act repeatedly until Jev selects done", async () => {
    let plans = 0;
    let actions = 0;
    const controller = createRunController({ browser: { navigate: async () => {}, observe: async () => ({ ...observation, id: `obs-${plans + 1}` }), act: async () => { actions += 1; } }, planner: { plan: async ({ observation: current }) => ++plans === 1 ? { kind: "click", target: "e1", observationId: current.id, confidence: 0.9 } : { kind: "done", observationId: current.id, confidence: 0.9 } } });
    const run = controller.start({ goal: "submit", startUrl: "https://example.com", values: [] });
    await controller.settled(run.id);
    expect(controller.get(run.id)?.status).toBe("complete");
    expect(actions).toBe(1);
    expect(controller.get(run.id)?.events.map((event) => event.type)).toEqual(expect.arrayContaining(["observation", "plan", "action", "run_complete"]));
  });

  it("finishes immediately when Jev selects none", async () => {
    let plans = 0;
    const controller = createRunController({ browser: { navigate: async () => {}, observe: async () => observation, act: async () => {} }, planner: { plan: async () => { plans += 1; return { kind: "none", observationId: "obs-1", confidence: 0.9 }; } } });
    const run = controller.start({ goal: "try once", startUrl: "https://example.com", values: [] });
    await controller.settled(run.id);
    expect(controller.get(run.id)?.status).toBe("complete");
    expect(plans).toBe(1);
  });

  it("stops at the 12-step cap", async () => {
    let actions = 0;
    let narratedOutcome: string | undefined;
    const controller = createRunController({ browser: { navigate: async () => {}, observe: async () => observation, act: async () => { actions += 1; } }, planner: { plan: async () => ({ kind: "wait", observationId: "obs-1", confidence: 0.9 }) }, narrator: { acknowledge: async () => "Starting.", summarize: async (input) => { narratedOutcome = input.outcome; return "Could not finish within the step limit."; } } });
    const run = controller.start({ goal: "keep trying", startUrl: "https://example.com", values: [] });
    await controller.settled(run.id);
    expect(controller.get(run.id)?.status).toBe("error");
    expect(controller.get(run.id)?.error).toMatch(/step limit/i);
    expect(narratedOutcome).toBe("error");
    expect(actions).toBe(12);
  });

  it("does not emit or act on observations that finish after Stop", async () => {
    let release!: (value: typeof observation) => void;
    let acted = false;
    const controller = createRunController({ browser: { navigate: async () => {}, observe: async () => new Promise((resolve) => { release = resolve; }), act: async () => { acted = true; } }, planner: { plan: async () => ({ kind: "click", target: "e1", observationId: "obs-1", confidence: 0.9 }) } });
    const run = controller.start({ goal: "open", startUrl: "https://example.com", values: [] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.stop(run.id); release(observation); await controller.settled(run.id);
    expect(acted).toBe(false);
    expect(controller.get(run.id)?.status).toBe("complete");
    expect(controller.get(run.id)?.events.map((event) => event.type)).toContain("run_stopped");
  });

  it("reports initial navigation errors", async () => {
    const controller = createRunController({ browser: { navigate: async () => { throw new Error("extension offline"); }, observe: async () => observation, act: async () => {} }, planner: { plan: async () => ({ kind: "done", observationId: "obs-1" }) } });
    const run = controller.start({ goal: "visit", startUrl: "https://example.com", values: [] });
    await controller.settled(run.id);
    expect(controller.get(run.id)?.status).toBe("error");
    expect(controller.get(run.id)?.events).toContainEqual(expect.objectContaining({ type: "run_error", message: "extension offline" }));
  });

  it("emits narrator messages using only the goal and bounded action summary", async () => {
    const narratorCalls: unknown[] = [];
    const controller = createRunController({
      browser: { navigate: async () => {}, observe: async () => ({ ...observation, snapshot: "PRIVATE DOM", url: "https://example.com/final?token=PRIVATE_URL_SECRET" }), act: async () => {} },
      planner: { plan: async () => ({ kind: "done", observationId: "obs-1", confidence: 0.9 }) },
      narrator: { acknowledge: async (goal: string) => { narratorCalls.push(goal); await new Promise((resolve) => setTimeout(resolve, 10)); return "On it."; }, summarize: async (input: unknown) => { narratorCalls.push(input); return "Finished."; } },
    });
    const run = controller.start({ goal: "find docs", startUrl: "https://example.com", values: ["PRIVATE VALUE"] });
    await controller.settled(run.id);
    expect(controller.get(run.id)?.events.filter((event) => event.type === "agent_message").map((event) => event.message)).toEqual(["On it.", "Finished."]);
    const serialized = JSON.stringify(narratorCalls);
    expect(serialized).not.toContain("PRIVATE DOM");
    expect(serialized).not.toContain("PRIVATE VALUE");
    expect(serialized).not.toContain("PRIVATE_URL_SECRET");
    expect(serialized).toContain("https://example.com/final");
  });
});
