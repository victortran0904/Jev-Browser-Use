import { expect, it } from "vitest";
import { browserFixture } from "./helpers/browser-fixture.js";
import { httpsFixture } from "./helpers/https-fixture.js";

it("10 searches a flight fixture with route, December date and budget preserved", async () => {
  let submitted: Record<string, string> | undefined;
  const site = await httpsFixture((req, res) => {
    const url = new URL(req.url!, "https://fixture.test");
    res.writeHead(200, { "content-type": "text/html" });
    if (url.pathname === "/flights") {
      submitted = Object.fromEntries(url.searchParams);
      res.end('<main><h1>Flight search results</h1><p role="status">Fixture only: HAN to YVR, December 2026, CAD 2200, under CAD 2500</p></main>');
    } else res.end('<main><form action="/flights"><input name="from" aria-label="From"><input name="to" aria-label="To"><input name="month" aria-label="Month"><input name="budget" aria-label="Budget CAD"><button>Find flights</button></form></main>');
  });
  const f = await browserFixture("Start");
  try {
    await f.boundary.open("test", site.url + "/");
    for (const [label, value] of [["From", "HAN"], ["To", "YVR"], ["Month", "2026-12"], ["Budget CAD", "2500"]]) {
      const observed = await f.boundary.observe("test");
      const target = observed.candidates.find(item => item.label.includes(label))!;
      await f.boundary.act("test", { kind: "fill_item", target: target.ref, value, observationId: observed.id }, observed);
    }
    const observed = await f.boundary.observe("test");
    const submit = observed.candidates.find(item => item.label.includes("Find flights"))!;
    await f.boundary.act("test", { kind: "click_item", target: submit.ref, observationId: observed.id }, observed);
    await expect.poll(async () => (await f.boundary.observe("test")).pageText).toContain("under CAD 2500");
    expect(submitted).toEqual({ from: "HAN", to: "YVR", month: "2026-12", budget: "2500" });
  } finally { await f.close(); await site.close(); }
}, 15000);
