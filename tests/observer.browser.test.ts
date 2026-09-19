import { describe, expect, it } from "vitest";
import { browserFixture } from "./helpers/browser-fixture.js";

describe("real-browser observation", () => {
  it("never sends a password value through candidate labels, focused field or page context", async () => {
    const f = await browserFixture('<main><input type="password" value="credential-do-not-copy"><button>Continue</button></main>');
    try {
      await f.page.locator("input").focus();
      const observed = await f.boundary.observe("test");
      expect(JSON.stringify(observed)).not.toContain("credential-do-not-copy");
      expect(observed.focusedField?.isText).toBe(false);
    } finally { await f.close(); }
  });
  it("keeps a live element reference stable when a new sibling is inserted before it", async () => {
    const f = await browserFixture('<main><button id="original">Original</button></main>');
    try {
      const first = await f.boundary.observe("test");
      await f.page.evaluate(() => { const button = document.createElement("button"); button.textContent = "New first item"; document.querySelector("main")!.prepend(button); });
      const next = await f.boundary.observe("test");
      expect(next.candidates.find(item => item.label.includes("Original"))?.ref).toBe(first.candidates[0].ref);
      expect(new Set(next.candidates.map(item => item.ref)).size).toBe(2);
    } finally { await f.close(); }
  });

  it("bounds detailed candidate inspection at 180 accepted controls and reports renderer timing", async () => {
    const controls = Array.from({ length: 1000 }, (_, i) => `<button aria-label="Item ${i}">x</button>`).join("");
    const f = await browserFixture(`<style>button{position:absolute;left:10px;top:10px;width:20px;height:20px}</style><main>${controls}</main>`);
    try {
      const observed = await f.boundary.observe("test");
      expect(observed.candidates).toHaveLength(180);
      expect(observed.metrics?.examinedCandidates).toBe(180);
      expect(observed.metrics?.totalMatches).toBe(1000);
      expect(observed.metrics?.domExtractMs).toBeGreaterThanOrEqual(0);
    } finally { await f.close(); }
  });

  it("reuses unchanged membership but rereads live focused-field properties", async () => {
    const f = await browserFixture('<main><input aria-label="Search"><button>Go</button></main>');
    try {
      const first = await f.boundary.observe("test");
      await f.page.locator("input").focus();
      await f.page.evaluate(() => { document.querySelector("input")!.value = "programmatic update"; });
      const next = await f.boundary.observe("test");
      expect(first.metrics?.mode).toBe("full");
      expect(next.metrics?.mode).toBe("focused");
      expect(next.focusedField?.value).toBe("programmatic update");
      expect(next.candidates.map(item => item.ref)).toEqual(first.candidates.map(item => item.ref));
    } finally { await f.close(); }
  });

  it("updates a changed subtree incrementally and drops disconnected controls", async () => {
    const f = await browserFixture('<main><button id="keep">Keep</button><section><button id="remove">Remove</button></section></main>');
    try {
      const first = await f.boundary.observe("test");
      await f.page.evaluate(() => { document.querySelector("section")!.innerHTML = '<button>Added</button>'; });
      const next = await f.boundary.observe("test");
      expect(next.metrics?.mode).toBe("incremental");
      expect(next.candidates.map(item => item.label)).toEqual(['button "Keep"', 'button "Added"']);
      expect(next.candidates[0].ref).toBe(first.candidates[0].ref);
      expect(next.candidates[1].ref).not.toBe(first.candidates[1].ref);
    } finally { await f.close(); }
  });

  it("exposes safe field metadata for direct filling without requiring a focus action", async () => {
    const f = await browserFixture('<main><input type="search" aria-label="Destination" placeholder="City" value="YVR"><button>Find</button></main>');
    try {
      const observed = await f.boundary.observe("test");
      expect(observed.candidates[0].field).toMatchObject({ label: "Destination", placeholder: "City", value: "YVR", isText: true });
      expect(observed.focusedField).toBeUndefined();
    } finally { await f.close(); }
  });

  it("excludes horizontally off-screen controls from actionable candidates", async () => {
    const f = await browserFixture('<button>Visible control</button><button style="position:absolute;left:10000px">Off-screen control</button>');
    try {
      const observed = await f.boundary.observe("test");
      expect(observed.candidates.map(item => item.label)).toEqual(['button "Visible control"']);
    } finally { await f.close(); }
  });

  it("separates renderer extraction from complete boundary timing and reports payload size", async () => {
    const f = await browserFixture('<main><button>Continue</button></main>');
    try {
      const observed = await f.boundary.observe("test");
      expect(observed.metrics?.boundaryMs).toBeGreaterThanOrEqual(observed.metrics!.domExtractMs);
      expect(observed.metrics?.payloadBytes).toBeGreaterThan(0);
      expect(observed.metrics?.screenshotMs).toBe(0);
    } finally { await f.close(); }
  });

  it("reports document and busy-region readiness instead of making the planner infer loading from text", async () => {
    const f = await browserFixture('<main aria-busy="true"><a href="https://fixture.test/next">Open destination</a></main>');
    try {
      const loading = await f.boundary.observe("test");
      expect(loading).toMatchObject({ readiness: { documentState: "complete", busy: true } });
      await f.page.locator("main").evaluate(element => element.setAttribute("aria-busy", "false"));
      const ready = await f.boundary.observe("test");
      expect(ready).toMatchObject({ readiness: { documentState: "complete", busy: false } });
    } finally { await f.close(); }
  });

});

it('uses a descendant accessible label when a clickable wrapper has only a terse visual label', async () => {
  const f = await browserFixture('<div role="button"><div aria-label="Tuesday, December 8, 2026">8</div></div>');
  try {
    const observation = await f.boundary.observe('test');
    expect(observation.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'button "Tuesday, December 8, 2026"' }),
    ]));
  } finally { await f.close(); }
}, 15000);


it('marks a text input described as a date editor as click-preferred without making it unsafe', async () => {
  const f = await browserFixture('<p id="hint">Enter a date or use the arrow keys to change the current date.</p><input aria-label="Departure" aria-describedby="hint">');
  try {
    const observation = await f.boundary.observe('test');
    expect(observation.candidates[0].field).toMatchObject({ isText: true, preferredAction: 'click' });
  } finally { await f.close(); }
}, 15000);


it('keeps an ordinary text date field fill-preferred when its hint does not describe a picker', async () => {
  const f = await browserFixture('<p id="hint">Enter a date as YYYY-MM-DD.</p><input aria-label="Invoice date" aria-describedby="hint">');
  try {
    const observation = await f.boundary.observe('test');
    expect(observation.candidates[0].field).toMatchObject({ isText: true, preferredAction: 'fill' });
  } finally { await f.close(); }
}, 15000);
