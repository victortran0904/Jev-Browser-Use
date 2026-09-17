import express from "express";
import cors from "cors";
import path from "node:path";
import { existsSync } from "node:fs";
import { runs as defaultRuns, type RunController } from "./runs.js";

export function createApp(controller: RunController = defaultRuns) {
  const app = express();
  app.use(cors({ origin: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }));
  app.use(express.json({ limit: "32kb" }));
  app.get("/api/status", (_req, res) => res.json({ ok: true, service: "Jev Browser Agent", runs: controller.list().length }));
  app.get("/api/runs", (_req, res) => res.json(controller.list()));
  app.post("/api/runs", (req, res, next) => {
    try { res.status(201).json(controller.start({ goal: String(req.body.goal ?? "") })); }
    catch (error) { next(error); }
  });
  app.get("/api/runs/:id", (req, res) => { const run = controller.get(req.params.id); if (!run) return res.status(404).json({ error: "Run not found" }); res.json(run); });
  app.get("/api/runs/:id/events", (req, res) => {
    const run = controller.get(req.params.id); if (!run) return res.status(404).end();
    res.setHeader("Content-Type", "text/event-stream"); res.setHeader("Cache-Control", "no-cache"); res.setHeader("Connection", "keep-alive"); res.flushHeaders();
    run.events.forEach((event) => res.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`));
    const unsubscribe = controller.subscribe(run.id, (event) => res.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`));
    req.on("close", unsubscribe);
  });
  app.post("/api/runs/:id/stop", (req, res, next) => { try { res.json(controller.stop(req.params.id)); } catch (error) { next(error); } });
  app.get("/api/runs/:id/screenshot", (req, res) => {
    const file = controller.get(req.params.id)?.screenshotPath;
    if (!file || !existsSync(file)) return res.status(404).json({ error: "No screenshot yet" });
    res.sendFile(file);
  });
  const dist = path.resolve("dist");
  if (existsSync(dist)) { app.use(express.static(dist)); app.get("*splat", (_req, res) => res.sendFile(path.join(dist, "index.html"))); }
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(400).json({ error: error instanceof Error ? error.message : String(error) }));
  return app;
}
