import { describe, expect, it } from "vitest";
import { createBrowserBoundary, parseSnapshot, validateAction } from "../server/browser.js";

// Geometry, popup timing and POST state now run against real Chromium in
// integration/browser.checks.mjs and the ten relay-backed E2E journeys.
describe("browser boundary", () => {
  it("extracts bounded references from a semantic snapshot", () => {
    const snapshot = Array.from({ length: 205 }, (_, index) => `button \"Item ${index}\" [ref=e${index}]`).join("\n");
    const candidates = parseSnapshot(snapshot);
    expect(candidates).toHaveLength(205);
    expect(candidates[0]).toEqual({ ref: "e0", label: "button \"Item 0\"" });
    expect(candidates.at(-1)?.ref).toBe("e204");
  });
  it("rejects stale actions and typing without a focused field", () => {
    const observation = { id: "new", url: "about:blank", title: "", snapshot: "", candidates: [{ ref: "e2", label: "Search" }] };
    expect(() => validateAction({ kind: "click_item", target: "e2", observationId: "old" }, observation)).toThrow(/stale/i);
    expect(() => validateAction({ kind: "type_text", value: "notebook", observationId: "new" }, observation)).toThrow(/focused/i);
  });
  it("creates each named external session once", async () => {
    const sessions = new Set<string>();
    const boundary = createBrowserBoundary(async (args) => {
      if (args[0] === "session" && args[1] === "new") {
        if (sessions.has(args[2])) throw new Error("Duplicate session");
        sessions.add(args[2]);
      }
      return JSON.stringify({ ok: true, value: true });
    });
    await boundary.begin("run-1");
    await boundary.begin("run-1");
    expect(sessions.has("jev-run-1")).toBe(true);
  });
  it("refuses a target absent from the observation", () => {
    expect(() => validateAction({kind:"click_item",target:"not-observed",observationId:"o"},{id:"o",url:"about:blank",title:"",snapshot:"",candidates:[]})).toThrow(/current observation/i);
  });
  it("does not recreate a closed run", async () => {
    const boundary=createBrowserBoundary(async()=>JSON.stringify({ok:true,value:true}));
    await boundary.begin("run-closed");
    await boundary.close?.("run-closed");
    await expect(boundary.begin("run-closed")).rejects.toThrow(/closed/i);
  });
});
