import { createServer } from "node:https";
import type { IncomingMessage, ServerResponse } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";

/** Ephemeral loopback origin for redirects and POST/new-tab browser behavior. */
export async function httpsFixture(handler: (request: IncomingMessage, response: ServerResponse) => void) {
  const dir = await mkdtemp(path.join(tmpdir(), "jev-fixture-"));
  try {
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", path.join(dir, "key.pem"), "-out", path.join(dir, "cert.pem"), "-days", "1", "-subj", "/CN=127.0.0.1"], { stdio: "ignore" });
    const server = createServer({ key: await readFile(path.join(dir, "key.pem")), cert: await readFile(path.join(dir, "cert.pem")) }, handler);
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    const port = (server.address() as { port: number }).port;
    return { url: `https://127.0.0.1:${port}`, close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(dir, { recursive: true, force: true }); } };
  } catch (error) { await rm(dir, { recursive: true, force: true }); throw error; }
}
