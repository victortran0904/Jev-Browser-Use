import { httpsFixture } from "./helpers/https-fixture.js";
import { describe, expect, it } from "vitest";
import { browserFixture } from "./helpers/browser-fixture.js";

/** Real-browser workflows; model/relay network is replaced only at the external boundary. */
describe("browsing end-to-end", { timeout: 15000 }, () => {
  it("01 searches a real form without paying a popup timeout for a focus click", async () => {
    const f = await browserFixture('<main><form action="https://fixture.test/search"><input name="q" aria-label="Search query"><button>Search</button></form></main>');
    try {
      await f.page.route("https://fixture.test/search*", route => route.fulfill({ contentType: "text/html", body: `<h1>Search complete: ${new URL(route.request().url()).searchParams.get("q")}</h1>` }));
      let observed = await f.boundary.observe("test");
      const input = observed.candidates.find(item => item.label.includes("Search query"))!;
      const start = performance.now();
      await f.boundary.act("test", { kind: "click_item", target: input.ref, observationId: observed.id }, observed);
      const focusClickMs = performance.now() - start;
      expect(focusClickMs).toBeLessThan(800);
      observed = await f.boundary.observe("test");
      await f.boundary.act("test", { kind: "type_text", value: "architecture smoke", observationId: observed.id }, observed);
      observed = await f.boundary.observe("test");
      await f.boundary.act("test", { kind: "press_enter", observationId: observed.id }, observed);
      await expect.poll(async () => (await f.boundary.observe("test")).snapshot).toContain("Search complete: architecture smoke");
    } finally { await f.close(); }
  });
  it("02 follows a redirect and exposes usable content before a slow image finishes", async () => {
    const site = await httpsFixture((req, res) => {
      if (req.url === "/redirect") { res.writeHead(302, { location: "/ready" }); res.end(); return; }
      if (req.url === "/slow.png") { setTimeout(() => res.end("image"), 1800).unref(); return; }
      res.writeHead(200, { "content-type": "text/html" });
      res.end('<main><h1>Ready after redirect</h1><button>Continue</button><img src="/slow.png"></main>');
    });
    const f = await browserFixture("<main>Start</main>");
    try {
      const start = performance.now();
      await f.boundary.open("test", site.url + "/redirect");
      expect(performance.now() - start).toBeLessThan(1200);
      const observed = await f.boundary.observe("test");
      expect(observed.url).toBe(site.url + "/ready");
      expect(observed.snapshot).toContain("Ready after redirect");
    } finally { await f.close(); await site.close(); }
  });
  it("03 continues in a delayed popup without reloading away its tab-local state", async () => {
    const site = await httpsFixture((req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(req.url === "/popup"
        ? '<main><h1>Popup ready</h1><script>document.querySelector("h1").textContent = sessionStorage.getItem("marker") || "State lost"</script></main>'
        : `<main><button onclick="setTimeout(() => { const w = window.open('about:blank'); w.sessionStorage.setItem('marker', 'Original popup state'); w.location = '/popup'; }, 250)">Open details</button></main>`);
    });
    const f = await browserFixture("<main>Start</main>");
    try {
      await f.boundary.open("test", site.url + "/");
      const observed = await f.boundary.observe("test");
      await f.boundary.act("test", { kind: "click_item", target: observed.candidates[0].ref, observationId: observed.id }, observed);
      await expect.poll(async () => (await f.boundary.observe("test")).snapshot, { timeout: 4000 }).toContain("Original popup state");
      expect(f.page.url()).toBe(site.url + "/");
    } finally { await f.close(); await site.close(); }
  });

  it("04 follows a POST-created tab without converting it into a second GET", async () => {
    const requests: string[] = [];
    const site = await httpsFixture((req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      if (req.url === "/result") {
        requests.push(req.method!);
        res.end(`<main><h1>${req.method === "POST" ? "Original POST result" : "Incorrect GET replay"}</h1></main>`);
      } else res.end('<main><form action="/result" method="POST" target="_blank"><button>View report</button></form></main>');
    });
    const f = await browserFixture("Start");
    try {
      await f.boundary.open("test", site.url + "/");
      const observed = await f.boundary.observe("test");
      await f.boundary.act("test", { kind: "click_item", target: observed.candidates[0].ref, observationId: observed.id }, observed);
      await expect.poll(async () => (await f.boundary.observe("test")).snapshot).toContain("Original POST result");
      expect(requests).toEqual(["POST"]);
    } finally { await f.close(); await site.close(); }
  });

  it("05 rejects a replaced element even when the replacement copies its reference attribute", async () => {
    const f = await browserFixture('<main><h1>Not activated</h1><button id="target">Original action</button></main>');
    try {
      const observed = await f.boundary.observe("test");
      await f.page.evaluate(() => {
        const old = document.querySelector("button")!;
        const replacement = old.cloneNode(true) as HTMLButtonElement;
        replacement.textContent = "Different action";
        replacement.onclick = () => { document.querySelector("h1")!.textContent = "Wrong action activated"; };
        old.replaceWith(replacement);
      });
      await expect(f.boundary.act("test", { kind: "click_item", target: observed.candidates[0].ref, observationId: observed.id }, observed)).rejects.toThrow(/stale/i);
      expect(await f.page.locator("h1").innerText()).toBe("Not activated");
    } finally { await f.close(); }
  });

  it("06 isolates concurrent popup runs and never recreates a session after closing it", async () => {
    const f = await browserFixture(`<button onclick="const w=window.open();w.document.write('<h1>Run A details</h1>')">Open A</button>`);
    try {
      await f.boundary.begin("other");
      const other = f.sessions.get("jev-other")!.page;
      await other.setContent(`<button onclick="const w=window.open();w.document.write('<h1>Run B details</h1>')">Open B</button>`);
      const [a, b] = await Promise.all([f.boundary.observe("test"), f.boundary.observe("other")]);
      await Promise.all([
        f.boundary.act("test", { kind: "click_item", target: a.candidates[0].ref, observationId: a.id }, a),
        f.boundary.act("other", { kind: "click_item", target: b.candidates[0].ref, observationId: b.id }, b),
      ]);
      await expect.poll(async () => (await f.boundary.observe("test")).snapshot).toContain("Run A details");
      await expect.poll(async () => (await f.boundary.observe("other")).snapshot).toContain("Run B details");
      await f.boundary.close!("test");
      await expect(f.boundary.act("test", { kind: "click_item", target: a.candidates[0].ref, observationId: a.id }, a)).rejects.toThrow();
      expect(f.sessions.has("jev-test")).toBe(false);
      expect((await f.boundary.observe("other")).snapshot).toContain("Run B details");
    } finally { await f.close(); }
  });

  it("07 keeps modal completion evidence ahead of a long navigation menu", async () => {
    const f = await browserFixture(`<nav>${"Long navigation text ".repeat(1500)}</nav><dialog open style="position:fixed;top:10px"><h2>Reservation search complete</h2><p role="status">Found a matching option</p><button>Close results</button></dialog>`);
    try {
      const observed = await f.boundary.observe("test");
      expect(observed.pageText?.slice(0, 2000)).toContain("Found a matching option");
      expect(observed.snapshot).toContain("Reservation search complete");
    } finally { await f.close(); }
  });

  it("08 scrolls to new content and refreshes asynchronously rendered controls", async () => {
    const f = await browserFixture(`<main><h1>Top of page</h1><div style="height:900px"></div><button onclick="setTimeout(() => { const result = document.createElement('p'); result.setAttribute('role','status'); result.textContent='Dynamic result complete'; document.querySelector('main').append(result); }, 100)">Load details</button></main>`);
    try {
      const first = await f.boundary.observe("test");
      expect(first.candidates.some(item => item.label.includes("Load details"))).toBe(false);
      await f.boundary.act("test", { kind: "scroll_down", observationId: first.id }, first);
      let next = await f.boundary.observe("test");
      await expect.poll(async () => { next = await f.boundary.observe("test"); return next.candidates.some(item => item.label.includes("Load details")); }).toBe(true);
      await f.boundary.act("test", { kind: "click_item", target: next.candidates.find(item => item.label.includes("Load details"))!.ref, observationId: next.id }, next);
      await expect.poll(async () => (await f.boundary.observe("test")).pageText).toContain("Dynamic result complete");
    } finally { await f.close(); }
  });

  it("09 redacts payment and one-time codes and refuses typing after focus changes", async () => {
    const f = await browserFixture('<main><input aria-label="Search"><input autocomplete="cc-number" value="4111111111111111"><input autocomplete="one-time-code" value="OTP987654"><p>OTP987654</p><button>Go</button></main>');
    try {
      await f.page.locator('[aria-label="Search"]').focus();
      const observed = await f.boundary.observe("test");
      expect(JSON.stringify(observed)).not.toContain("4111111111111111");
      expect(JSON.stringify(observed)).not.toContain("OTP987654");
      await f.page.locator('[autocomplete="cc-number"]').focus();
      await expect(f.boundary.act("test", { kind: "type_text", value: "search words", observationId: observed.id }, observed)).rejects.toThrow(/stale|sensitive|focus/i);
      expect(await f.page.locator('[autocomplete="cc-number"]').inputValue()).toBe("4111111111111111");
    } finally { await f.close(); }
  });

});
