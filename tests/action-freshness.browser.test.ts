import { expect, it } from "vitest";
import { browserFixture } from "./helpers/browser-fixture.js";

it("rejects a connected control whose meaning changed after observation", async () => {
  const f = await browserFixture('<main><h1>Not activated</h1><button onclick="document.querySelector(\'h1\').textContent=\'Activated\'">View details</button></main>');
  try {
    const observed = await f.boundary.observe("test");
    await f.page.locator("button").evaluate(element => { element.textContent = "Confirm purchase"; });
    await expect(f.boundary.act("test", { kind: "click_item", target: observed.candidates[0].ref, observationId: observed.id }, observed)).rejects.toThrow(/stale/i);
    expect(await f.page.locator("h1").innerText()).toBe("Not activated");
  } finally { await f.close(); }
});

it("rejects an old observation after a newer observation has been issued", async () => {
  const f = await browserFixture('<main><button>Continue</button></main>');
  try {
    const old = await f.boundary.observe("test");
    await f.boundary.observe("test");
    await expect(f.boundary.act("test", { kind: "click_item", target: old.candidates[0].ref, observationId: old.id }, old)).rejects.toThrow(/stale/i);
  } finally { await f.close(); }
});

it("does not press Enter in a document navigated after the observation", async () => {
  const f = await browserFixture('<main><input aria-label="Search"></main>');
  try {
    await f.page.locator("input").focus();
    const old = await f.boundary.observe("test");
    await f.page.goto('data:text/html,<form><input autofocus><button>Submit different form</button></form>');
    await expect(f.boundary.act("test", { kind: "press_enter", observationId: old.id }, old)).rejects.toThrow(/stale/i);
  } finally { await f.close(); }
});

it("allows a read-only wait after navigation without authorizing stale input", async () => {
  const f = await browserFixture('<main><input aria-label="Search"></main>');
  try {
    const old = await f.boundary.observe("test");
    await f.page.goto('data:text/html,<h1>New document</h1>');
    await expect(f.boundary.act("test", { kind: "wait", observationId: old.id }, old)).resolves.toBe("waited");
    await expect(f.boundary.act("test", { kind: "press_enter", observationId: old.id }, old)).rejects.toThrow(/stale/i);
  } finally { await f.close(); }
});
