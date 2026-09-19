import { describe, expect, it } from "vitest";
import { browserFixture } from "./helpers/browser-fixture.js";

describe("form submission freshness", { timeout: 15000 }, () => {
  it("rejects a submit button when its associated form destination changes after observation", async () => {
    const fixture = await browserFixture(
      '<form id="search" action="https://fixture.test/search"><button>Search</button></form>',
    );
    let submitted = false;
    try {
      await fixture.page.route("https://fixture.test/**", route => {
        submitted = true;
        return route.fulfill({ contentType: "text/html", body: "Unexpected submission" });
      });
      const observation = await fixture.boundary.observe("test");
      await fixture.page.evaluate(() => {
        document.querySelector("form")!.action = "https://fixture.test/changed-destination";
      });
      await expect(fixture.boundary.act("test", {
        kind: "click_item", target: observation.candidates[0].ref, observationId: observation.id,
      }, observation)).rejects.toThrow(/stale/i);
      expect(submitted).toBe(false);
    } finally {
      await fixture.close();
    }
  });
  it("rejects Enter when the focused field's form changes after observation", async () => {
    const fixture = await browserFixture(
      '<form action="https://fixture.test/search"><input aria-label="Search" value="query"><button>Search</button></form>',
    );
    let submitted = false;
    try {
      await fixture.page.route("https://fixture.test/**", route => {
        submitted = true;
        return route.fulfill({ contentType: "text/html", body: "Unexpected submission" });
      });
      await fixture.page.locator("input").focus();
      const observation = await fixture.boundary.observe("test");
      await fixture.page.evaluate(() => { document.querySelector("form")!.method = "post"; });
      await expect(fixture.boundary.act("test", {
        kind: "press_enter", observationId: observation.id,
      }, observation)).rejects.toThrow(/stale/i);
      expect(submitted).toBe(false);
    } finally { await fixture.close(); }
  });

});
