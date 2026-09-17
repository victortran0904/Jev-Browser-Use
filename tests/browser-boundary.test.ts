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

  it("excludes horizontally off-screen candidates from observations", async () => {
    const calls: string[][] = [];
    const boundary = createBrowserBoundary(async (args) => {
      calls.push(args);
      return args[0] === "session" ? "" : JSON.stringify({ ok: true, value: {} });
    });

    await boundary.observe("run-1", "/tmp/jev-browser-boundary.png");

    const observationScript = calls.find((args) => args[0] === "execute")?.at(-1) ?? "";
    expect(observationScript).toContain("rect.right >= 0 && rect.left <= innerWidth");
  });

  it("follows a popup created by a click in the session page", async () => {
    const calls: string[][] = [];
    const boundary = createBrowserBoundary(async (args) => {
      calls.push(args);
      return args[0] === "session" ? "" : JSON.stringify({ ok: true, value: "clicked" });
    });
    const observation = {
      id: "obs-1",
      url: "https://example.com/item",
      title: "Item",
      snapshot: 'button "Add to Cart" [ref=e1]',
      candidates: [{ ref: "e1", label: 'button "Add to Cart"' }],
    };

    await boundary.act("run-1", { kind: "click_item", target: "e1", observationId: "obs-1" }, observation);

    const clickScript = calls.find((args) => args[0] === "execute")?.at(-1) ?? "";
    expect(clickScript).toContain('page.waitForEvent("popup"');
    expect(clickScript).toContain("timeout: 1000");
    expect(clickScript).toContain("await page.goto(popupUrl)");
    expect(clickScript).toContain("await popup.close()");
  });

  it("follows a click-created page exposed as a separate relay session", async () => {
    const calls: string[][] = [];
    let statusCalls = 0;
    const boundary = createBrowserBoundary(async (args) => {
      calls.push(args);
      if (args[0] === "session") return "";
      if (args[0] === "status") {
        statusCalls += 1;
        const targets = statusCalls === 1
          ? [{ id: "original", type: "page", url: "https://example.com/item", owner: "relay", browserControlSessionId: "jev-run-1" }]
          : [{ id: "original", type: "page", url: "https://example.com/item", owner: "relay", browserControlSessionId: "jev-run-1" }, { id: "new", type: "page", url: "https://example.com/intermediate", owner: "relay", browserControlSessionId: "generated-popup" }];
        const sessions = statusCalls === 1
          ? [{ id: "jev-run-1", pageUrl: "https://example.com/item" }]
          : [{ id: "jev-run-1", pageUrl: "https://example.com/item" }, { id: "generated-popup", pageUrl: "https://example.com/cart" }];
        return JSON.stringify({ targets, sessions });
      }
      return JSON.stringify({ ok: true, value: "clicked" });
    });
    const observation = {
      id: "obs-1",
      url: "https://example.com/item",
      title: "Item",
      snapshot: 'button "Add to Cart" [ref=e1]',
      candidates: [{ ref: "e1", label: 'button "Add to Cart"' }],
    };

    const result = await boundary.act("run-1", { kind: "click_item", target: "e1", observationId: "obs-1" }, observation);

    expect(result).toBe("clicked; followed new page https://example.com/cart");
    expect(calls.some((args) => args[0] === "execute" && args.at(-1)?.includes('page.goto("https://example.com/cart")'))).toBe(true);
    expect(calls).toContainEqual(["session", "delete", "generated-popup"]);
  });
});
