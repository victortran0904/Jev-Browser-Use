import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../server/app.js";
import { createRunController } from "../server/runs.js";

describe("HTTP API", () => {
  it("starts and stops a run through public endpoints", async () => {
    const controller = createRunController({ browser: { begin: async () => {}, open: async (_id, url) => `opened ${url}`, observe: async () => new Promise(() => {}), act: async () => "acted" }, planner: { plan: async () => { throw new Error("not reached"); } } });
    const app = createApp(controller);
    expect((await request(app).get("/api/status")).body).toMatchObject({ ok: true });
    const started = await request(app).post("/api/runs").send({ goal: "visit example" }).expect(201);
    const stopped = await request(app).post(`/api/runs/${started.body.id}/stop`).expect(200);
    expect(stopped.body.status).toBe("complete");
  });
});

it("rejects a screenshot request for a superseded observation", async () => {
  const controller = createRunController({
    enableScreenshots: true,
    browser: {
      begin: async () => {}, open: async () => "opened", act: async () => "acted",
      observe: async () => ({ id: "current-observation", url: "https://example.com", title: "Example", snapshot: "", candidates: [] }),
    },
    planner: { plan: async () => ({ kind: "done", observationId: "current-observation", confidence: 1 }) },
    narrator: { acknowledge: async () => "Starting", summarize: async () => "Finished" },
  });
  const run = controller.start({ goal: "Inspect page" });
  await controller.settled(run.id);
  await request(createApp(controller)).get(`/api/runs/${run.id}/screenshot?observationId=old-observation`).expect(409);
});
