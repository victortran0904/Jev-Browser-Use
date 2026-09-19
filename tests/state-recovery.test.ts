import { expect, it } from "vitest";
import { StaleObservationError } from "../server/browser.js";
import { createRunController } from "../server/runs.js";

it("reobserves a changed page before replanning without replaying the rejected action", async () => {
  let observations = 0, attempts = 0, activations = 0;
  const controller = createRunController({
    browser: {
      begin: async () => {}, close: async () => {}, open: async () => "opened",
      observe: async () => ({ id: `o${++observations}`, url: "https://example.com", title: "Example", snapshot: activations ? "Done" : "Continue", candidates: [{ ref: "e1", label: "Continue" }] }),
      act: async () => { if (++attempts === 1) throw new StaleObservationError(); activations++; return "clicked Continue"; },
    },
    planner: { plan: async ({ observation }) => ({ kind: observation.snapshot === "Done" ? "done" : "click_item", target: "e1", observationId: observation.id, confidence: 1 }) },
    narrator: { acknowledge: async () => "Started", summarize: async () => "Finished" },
  });
  const run = controller.start({ goal: "Continue and verify Done" });
  await controller.settled(run.id);
  expect(run.status).toBe("complete");
  expect(activations).toBe(1);
  expect(run.observation?.snapshot).toBe("Done");
  expect(run.events.filter(event => event.type === "state_refresh")).toHaveLength(1);
});

it.each([
  { name: "an unknown mutation outcome, even with stale in its message", error: new Error("Stale response after input; outcome unknown"), attempts: 1, refreshes: 0 },
  { name: "a page that keeps changing before input", error: new StaleObservationError(), attempts: 3, refreshes: 2 },
])("stops safely for $name", async ({ error, attempts: expectedAttempts, refreshes }) => {
  let attempts = 0, observations = 0;
  const controller = createRunController({
    browser: {
      begin: async () => {}, close: async () => {}, open: async () => "opened",
      observe: async () => ({ id: `o${++observations}`, url: "https://example.com", title: "Example", snapshot: "Continue", candidates: [{ ref: "e1", label: "Continue" }] }),
      act: async () => { attempts++; throw error; },
    },
    planner: { plan: async ({ observation }) => ({ kind: "click_item", target: "e1", observationId: observation.id, confidence: 1 }) },
    narrator: { acknowledge: async () => "Started", summarize: async () => "Finished" },
  });
  const run = controller.start({ goal: "Continue" });
  await controller.settled(run.id);
  expect(run.status).toBe("error");
  expect(attempts).toBe(expectedAttempts);
  expect(run.events.filter(event => event.type === "state_refresh")).toHaveLength(refreshes);
});
