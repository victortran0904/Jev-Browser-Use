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
