import { describe, expect, it } from "vitest";
import { browserFixture } from "./helpers/browser-fixture.js";

describe("observation redaction at text-budget boundaries", { timeout: 15000 }, () => {
  it("redacts a known credential before a page-text budget can expose its prefix", async () => {
    const credential = "KNOWNCREDENTIAL0123456789";
    const fixture = await browserFixture(
      `<main><input type="password" value="${credential}"><p>${"x".repeat(5990)} ${credential}</p></main>`,
    );
    try {
      const observation = await fixture.boundary.observe("test");
      expect(observation.pageText).not.toContain("KNOWNCRED");
      expect(JSON.stringify(observation)).not.toContain(credential);
    } finally {
      await fixture.close();
    }
  });
  it("redacts overlapping credentials longest-first without exposing the longer suffix", async () => {
    const fixture = await browserFixture(
      '<main><input type="password" value="TOKENPREFIX"><input type="password" value="TOKENPREFIX-PRIVATE-SUFFIX"><p>TOKENPREFIX-PRIVATE-SUFFIX</p></main>',
    );
    try {
      const observation = await fixture.boundary.observe("test");
      expect(observation.pageText).not.toContain("PRIVATE-SUFFIX");
      expect(observation.pageText).toContain("[redacted]");
    } finally {
      await fixture.close();
    }
  });

  it("keeps redaction expansion within the page-text payload budget", async () => {
    const fixture = await browserFixture(
      `<main><input type="password" value="a"><p>${"a".repeat(2000)}</p></main>`,
    );
    try {
      const observation = await fixture.boundary.observe("test");
      expect(observation.pageText!.length).toBeLessThanOrEqual(12000);
    } finally { await fixture.close(); }
  });

});
