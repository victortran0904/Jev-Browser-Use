import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { once } from 'node:events';
import { chromium } from 'playwright-core';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const childEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  ['PATH', 'HOME', 'DISPLAY', 'XAUTHORITY', 'TMPDIR', 'LANG', 'LD_LIBRARY_PATH', 'PLAYWRIGHT_BROWSERS_PATH'].includes(key)));

// This fixture adapter replaces ONLY the external relay transport. The actual
// boundary scripts and normal Playwright actionability run in real Chromium.
export async function createRuntime(route, { relay = false } = {}) {
  const temp = await mkdtemp(path.join(tmpdir(), 'jev-e2e-'));
  const children = [], sessions = new Map();
  let browser, server;
  async function close() {
    await browser?.close().catch(() => {});
    for (const child of children) {
      if (child.exitCode !== null || child.signalCode !== null) continue;
      const exited = once(child, 'exit').catch(() => {});
      child.kill('SIGTERM');
      await Promise.race([exited, pause(1500)]);
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      await exited;
    }
    server?.closeAllConnections();
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await rm(temp, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  }
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(temp, 'key.pem'), '-out', path.join(temp, 'cert.pem'), '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { env: childEnv(), stdio: 'ignore' });
    server = https.createServer({ key: await readFile(path.join(temp, 'key.pem')), cert: await readFile(path.join(temp, 'cert.pem')) }, route);
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const url = `https://127.0.0.1:${server.address().port}`;
    if (relay) {
      children.push(spawn(process.execPath, [path.resolve('node_modules/@opencode-ai/browser-control/dist/cli.js'), 'serve'], { env: childEnv(), stdio: 'ignore' }));
      const extension = path.resolve('node_modules/@opencode-ai/browser-control/extension/dist');
      children.push(spawn(chromium.executablePath(), [`--user-data-dir=${path.join(temp, 'profile')}`, `--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-first-run', '--no-default-browser-check', '--no-sandbox', '--disable-dev-shm-usage', '--ignore-certificate-errors', 'about:blank'], { env: childEnv(), stdio: 'ignore' }));
      let ready = false;
      for (let i = 0; i < 180; i++) {
        if (children.some(child => child.exitCode !== null)) throw new Error('Browser runtime exited');
        try {
          const response = await fetch('http://127.0.0.1:19989/extension/status', { signal: AbortSignal.timeout(1000) });
          const status = await response.json();
          if (status.connected && status.protocolCompatible !== false) { ready = true; break; }
        } catch {}
        await pause(250);
      }
      if (!ready) throw new Error('Browser extension startup timeout');
      return { url, close, command: undefined };
    }
    browser = await chromium.launch({ headless: true, env: childEnv(), args: ['--no-sandbox'] });
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    async function command(args) {
      const id = args[0] === 'execute' ? args[args.indexOf('--session') + 1] : args[2];
      if (args[0] === 'session') {
        if (args[1] === 'new') {
          const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
          const page = await context.newPage();
          sessions.set(id, { page, context, state: {} });
        } else { await sessions.get(id)?.context.close(); sessions.delete(id); }
        return JSON.stringify({ ok: true });
      }
      if (args[0] === 'status') return JSON.stringify({ targets: [], sessions: [...sessions].map(([id, s]) => ({ id, pageUrl: s.page.url() })) });
      const s = sessions.get(id);
      if (!s) throw new Error('Session missing');
      try {
        const value = await new AsyncFunction('page', 'state', 'context', 'browser', args.at(-1))(s.page, s.state, s.context, browser);
        return JSON.stringify({ ok: true, value });
      } catch (error) { return JSON.stringify({ ok: false, error: error.message }); }
    }
    return { url, close, command };
  } catch (error) { await close(); throw error; }
}
