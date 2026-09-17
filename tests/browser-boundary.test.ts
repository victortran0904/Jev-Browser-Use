import { describe, expect, it } from "vitest";
import { createBrowserBoundary, parseSnapshot, validateAction } from "../server/browser.js";

describe("browser boundary", () => {
  it("extracts a bounded set of stable refs from a semantic snapshot", () => {
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

  it("creates each named Browser Control session once before executing commands", async () => {
    const calls: string[][] = [];
    const boundary = createBrowserBoundary(async (args) => {
      calls.push(args);
      return args[0] === "session" ? "" : JSON.stringify({ ok: true, value: { url: "https://example.com" } });
    });
    await boundary.begin("run-1");
    await boundary.begin("run-1");
    expect(calls[0]).toEqual(["session", "new", "jev-run-1"]);
    expect(calls.filter((args) => args[0] === "session")).toHaveLength(1);
    expect(calls[1].slice(0, 4)).toEqual(["execute", "--json", "--session", "jev-run-1"]);
  });

  // Popup timing, native POST tabs and cross-run ownership are exercised by
  // tests/browser-e2e.test.ts and e2e/browsing.mjs against actual browsers.
});
