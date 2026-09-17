import { afterEach, describe, expect, it, vi } from "vitest";
import { withGeminiFallback } from "../server/gemini.js";

describe("Gemini model fallback", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("retries temporary availability failures once with 3.1 Flash Lite", async () => {
    const generate = vi.fn(async (model: string) => {
      if (model === "gemini-3.5-flash-lite") throw { code: 503, status: "UNAVAILABLE", message: "high demand" };
      return "ok";
    });

    await expect(withGeminiFallback(generate)).resolves.toBe("ok");
    expect(generate.mock.calls.map(([model]) => model)).toEqual([
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
    ]);
  });

  it("does not retry non-temporary errors", async () => {
    const error = new Error("Invalid API key");
    const generate = vi.fn(async () => { throw error; });

    await expect(withGeminiFallback(generate)).rejects.toBe(error);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("keeps GEMINI_MODEL compatible as the primary override", async () => {
    vi.stubEnv("GEMINI_MODEL", "custom-primary");
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "custom-fallback");
    const generate = vi.fn(async (model: string) => {
      if (model === "custom-primary") throw new Error("503 UNAVAILABLE");
      return model;
    });

    await expect(withGeminiFallback(generate)).resolves.toBe("custom-fallback");
  });
});
