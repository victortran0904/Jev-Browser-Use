import { expect, it } from "vitest";
import { browserFixture } from "./helpers/browser-fixture.js";

it("distinguishes a stale document rejected before browser input from an unknown action outcome", async () => {
  const fixture = await browserFixture('<button>Continue</button>');
  try {
    const observation = await fixture.boundary.observe("test");
    await fixture.page.goto('data:text/html,<button>Different document</button>');
    let failure: unknown;
    try {
      await fixture.boundary.act("test", { kind: "click_item", target: observation.candidates[0].ref, observationId: observation.id }, observation);
    } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).name).toBe("StaleObservationError");
  } finally { await fixture.close(); }
});
