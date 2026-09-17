import { afterEach, describe, expect, it, vi } from "vitest";

const external = vi.hoisted(() => ({ submissions: 0, inheritedSecret: false }));
vi.mock("node:child_process", () => {
  const execFile = Object.assign(() => {}, {
    [Symbol.for("nodejs.util.promisify.custom")]: async (_file: string, args: string[], options: { env?: NodeJS.ProcessEnv }) => {
      external.inheritedSecret = Boolean((options.env ?? process.env).GEMINI_KEY);
      if (args[0] === "execute") external.submissions += 1;
      return { stdout: JSON.stringify({ ok: true, value: "pressed Enter" }), stderr: "" };
    },
  });
  return { execFile };
});
import { createBrowserBoundary, defaultCommandRunner } from "../server/browser.js";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); external.submissions = 0; external.inheritedSecret = false; });

describe("browser transport safety", () => {
  it("does not submit again when the relay performed the action but its response was lost", async () => {
    vi.stubGlobal("fetch", async (input: string | URL) => {
      if (String(input).endsWith("/cli/session/new")) return Response.json({ session: { id: "jev-lost" } });
      external.submissions += 1;
      throw new DOMException("Response lost after dispatch", "TimeoutError");
    });
    const boundary = createBrowserBoundary();
    const observation = { id: "o1", url: "https://example.com", title: "Form", snapshot: "", candidates: [] };
    const outcome = await boundary.act("lost", { kind: "press_enter", observationId: "o1" }, observation).catch(error => error);
    expect(external.submissions).toBe(1);
    expect(String(outcome)).toMatch(/outcome unknown/i);
  });
  it("surfaces an explicit relay rejection without replaying a submission through CLI", async () => {
    vi.stubGlobal("fetch", async (input: string | URL) => String(input).endsWith("/cli/session/new")
      ? Response.json({ session: { id: "jev-rejected" } })
      : Response.json({ error: "temporarily unavailable" }, { status: 503 }));
    const boundary = createBrowserBoundary();
    const observation = { id: "o1", url: "https://example.com", title: "Form", snapshot: "", candidates: [] };
    const outcome = await boundary.act("rejected", { kind: "press_enter", observationId: "o1" }, observation).catch(error => error);
    expect(external.submissions).toBe(0);
    expect(String(outcome)).toMatch(/relay.*503/i);
  });

  it("fails closed on a malformed success envelope without replay", async () => {
    vi.stubGlobal("fetch", async (input: string | URL) => String(input).endsWith("/cli/session/new")
      ? Response.json({ session: { id: "jev-malformed" } }) : Response.json({ unexpected: true }));
    const boundary = createBrowserBoundary();
    const observation = { id: "o1", url: "https://example.com", title: "Form", snapshot: "", candidates: [] };
    await expect(boundary.act("malformed", { kind: "press_enter", observationId: "o1" }, observation)).rejects.toThrow(/outcome unknown/i);
    expect(external.submissions).toBe(0);
  });

  it("does not retry session creation after an explicit relay error", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ error: "unavailable" }, { status: 503 }));
    const response = JSON.parse(await defaultCommandRunner(["session", "new", "jev-rejected-session"]));
    expect(response.ok).toBe(false);
    expect(response.error).toMatch(/503/);
  });

  it("does not pass model credentials to a CLI bootstrap process", async () => {
    vi.stubEnv("GEMINI_KEY", "synthetic-secret-not-real");
    vi.stubGlobal("fetch", async () => { throw Object.assign(new Error("Connection refused"), { cause: { code: "ECONNREFUSED" } }); });
    await defaultCommandRunner(["session", "new", "jev-bootstrap"]);
    expect(external.inheritedSecret).toBe(false);
  });

});
