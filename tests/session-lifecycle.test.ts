import { expect, it } from "vitest";
import { createBrowserBoundary } from "../server/browser.js";

it("does not resurrect a session when close races with initialization", async () => {
  let release!: () => void;
  let live = false;
  let executions = 0;
  const boundary = createBrowserBoundary(async args => {
    if (args[0] === "session" && args[1] === "new") {
      return new Promise(resolve => { release = () => { live = true; resolve(JSON.stringify({ ok: true })); }; });
    }
    if (args[0] === "session" && args[1] === "delete") { live = false; return JSON.stringify({ deleted: true }); }
    executions += 1;
    return JSON.stringify({ ok: true, value: true });
  });
  const beginning = boundary.begin("race").catch(error => error);
  await expect.poll(() => typeof release).toBe("function");
  const closing = boundary.close!("race");
  release();
  const [result] = await Promise.all([beginning, closing]);
  expect(String(result)).toMatch(/closed/i);
  expect(executions).toBe(0);
  expect(live).toBe(false);
});
