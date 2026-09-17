import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

export type CommandRunner = (args: string[]) => Promise<string>;
const execFileAsync = promisify(execFile);
const cli = path.resolve("node_modules/.bin/browser-control");

const RELAY_ENDPOINT = process.env.BROWSER_CONTROL_ENDPOINT || "http://127.0.0.1:19989";

async function httpCommand(args: string[]): Promise<string | null> {
  try {
    if (args[0] === "status") {
      const res = await fetch(`${RELAY_ENDPOINT}/extension/status`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return null;
      const data = await res.json();
      return JSON.stringify(data);
    }
    if (args[0] === "session" && args[1] === "new" && args[2]) {
      const res = await fetch(`${RELAY_ENDPOINT}/cli/session/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: args[2] }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return JSON.stringify({ ok: true, session: data.session });
    }
    if (args[0] === "execute") {
      const sessionIdx = args.indexOf("--session");
      const sessionId = sessionIdx !== -1 ? args[sessionIdx + 1] : undefined;
      const code = args.at(-1);
      if (!sessionId || !code) return null;
      const res = await fetch(`${RELAY_ENDPOINT}/cli/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, code, createIfMissing: true }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) return JSON.stringify({ ok: false, error: `Relay HTTP ${res.status}; action was not retried` });
      const data = (await res.json()) as { ok?: boolean; isError?: boolean; error?: unknown; value?: unknown; text?: string };
      if (!data || (typeof data.isError !== "boolean" && typeof data.ok !== "boolean")) {
        throw new Error("Malformed relay execution response");
      }
      return JSON.stringify({
        ok: data.ok !== false && !data.isError && !data.error,
        value: data.value,
        text: data.text,
        error: data.error,
      });
    }
    if (args[0] === "session" && args[1] === "delete" && args[2]) {
      const res = await fetch(`${RELAY_ENDPOINT}/cli/session/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: args[2] }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      return JSON.stringify(await res.json());
    }
    return null;
  } catch (error) {
    if (args[0] === "execute") {
      // Only a connection failure before dispatch is safe to replay. A lost
      // response says nothing about whether the browser performed the action.
      const failure = error as { code?: string; cause?: { code?: string } };
      const code = failure.cause?.code ?? failure.code;
      if (!["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"].includes(code ?? "")) {
        throw new Error("Browser Control execution outcome unknown; action was not retried", { cause: error });
      }
    }
    return null;
  }
}

export const defaultCommandRunner: CommandRunner = async (args) => {
  const httpResult = await httpCommand(args);
  if (httpResult !== null) return httpResult;
  return (await execFileAsync(cli, args, { maxBuffer: 8 * 1024 * 1024, timeout: 30_000 })).stdout;
};
