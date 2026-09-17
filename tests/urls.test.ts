import { describe, expect, it } from "vitest";
import { extractExplicitUrl } from "../server/urls.js";

describe("extractExplicitUrl", () => {
  it("extracts direct https URLs", () => {
    expect(extractExplicitUrl("go to https://google.com/travel/flights")).toBe("https://google.com/travel/flights");
  });

  it("extracts direct http URLs and upgrades to https", () => {
    expect(extractExplicitUrl("open http://example.com/search?q=test")).toBe("https://example.com/search?q=test");
  });

  it("extracts www domains as https", () => {
    expect(extractExplicitUrl("look at www.kayak.com/flights")).toBe("https://www.kayak.com/flights");
  });

  it("strips trailing punctuation", () => {
    expect(extractExplicitUrl("navigate to https://amazon.ca/cart.")).toBe("https://amazon.ca/cart");
    expect(extractExplicitUrl("check (https://news.ycombinator.com)")).toBe("https://news.ycombinator.com/");
  });

  it("returns null when no explicit URL is present", () => {
    expect(extractExplicitUrl("navigate to amazon.ca")).toBeNull();
    expect(extractExplicitUrl("find me a flight to hanoi from vancouver in december that's less than 2,500$")).toBeNull();
  });
});
