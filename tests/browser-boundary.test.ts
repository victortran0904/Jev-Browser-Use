import { describe, expect, it } from "vitest";
import { createBrowserBoundary, parseSnapshot, validateAction } from "../server/browser.js";

describe("browser boundary", () => {
  it("extracts a bounded set of stable refs from a semantic snapshot", () => {
    const snapshot = Array.from({ length: 205 }, (_, index) => `button \"Item ${index}\" [ref=e${index}]`).join("\n");
    const candidates = parseSnapshot(snapshot);
    expect(candidates).toHaveLength(200);
    expect(candidates[0]).toEqual({ ref: "e0", label: "button \"Item 0\"" });
    expect(candidates.at(-1)?.ref).toBe("e199");
  });

  it("rejects stale actions and values the user did not supply", () => {
    expect(() => validateAction({ kind: "fill", target: "e2", value: "secret", observationId: "old" }, "new", [{ ref: "e2", label: "Password" }], ["secret"])).toThrow(/stale/i);
    expect(() => validateAction({ kind: "fill", target: "e2", value: "invented", observationId: "new" }, "new", [{ ref: "e2", label: "Search" }], ["allowed"])).toThrow(/supplied/i);
  });

  it("creates each named Browser Control session once before executing commands", async () => {
    const calls: string[][] = [];
    const boundary = createBrowserBoundary(async (args) => {
      calls.push(args);
      return args[0] === "session" ? "" : JSON.stringify({ ok: true, value: { url: "https://example.com" } });
    });
    await boundary.navigate("run-1", "https://example.com");
    await boundary.navigate("run-1", "https://example.com/about");
    expect(calls[0]).toEqual(["session", "new", "jev-run-1"]);
    expect(calls.filter((args) => args[0] === "session")).toHaveLength(1);
    expect(calls[1].slice(0, 4)).toEqual(["execute", "--json", "--session", "jev-run-1"]);
  });
});
