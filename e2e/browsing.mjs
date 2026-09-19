import { registerScenarios } from "./scenarios.mjs";
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createBrowserBoundary } from '../server/browser.ts';
import { createRuntime } from './runtime.mjs';

const cases = [];
const routes = new Map();
function html(body, title = 'Browser fixture') { return `<!doctype html><html><head><title>${title}</title></head><body><main>${body}</main></body></html>`; }
const runtime = await createRuntime((req, res) => {
  const url = new URL(req.url, 'https://127.0.0.1');
  const route = routes.get(url.pathname);
  if (!route) { res.writeHead(404); res.end('Not found'); return; }
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-type', 'text/html');
  route(req, res, url);
}, { relay: process.argv.includes('--relay') });
const boundary = createBrowserBoundary(runtime.command);
const report = { scope: 'real browser boundary end-to-end; deterministic fixtures, not live model planning', relay: process.argv.includes('--relay'), tests: [] };
const choose = (o, label) => { const c = o.candidates.find(c => c.label.includes(label)); assert(c, `Missing candidate: ${label}`); return c.ref; };
const click = (id, o, label) => boundary.act(id, { kind: 'click_item', target: choose(o, label), observationId: o.id }, o);
const observeUntil = async (id, predicate) => {
  const deadline = performance.now() + 5000;
  do { const o = await boundary.observe(id); if (predicate(o)) return o; await new Promise(r => setTimeout(r, 30)); } while (performance.now() < deadline);
  throw new Error('Expected browser state did not appear');
};

routes.set('/focus', (_req, res) => res.end(html('<label>Search query<input aria-label="Search query"></label><button>Unrelated button</button>')));
cases.push(['01-fast-focus', async id => {
  await boundary.begin(id); await boundary.open(id, runtime.url + '/focus');
  const durations = [];
  for (let i = 0; i < 3; i++) {
    const o = await boundary.observe(id);
    const start = performance.now(); await click(id, o, 'Search query'); durations.push(performance.now() - start);
    assert.equal((await boundary.observe(id)).focusedField?.isText, true);
  }
  const median = durations.sort((a,b) => a-b)[1];
  assert(median < 900, `Ordinary focus click median ${Math.round(median)}ms still pays a popup deadline`);
  return { focusClickMedianMs: Math.round(median) };
}]);

let postRequests = [];
routes.set('/post-entry', (_req, res) => res.end(html('<form action="/post-result" method="POST" target="_blank"><button>Open report</button></form>')));
routes.set('/post-result', (req, res) => { postRequests.push(req.method); res.end(html(`<h1>${req.method === 'POST' ? 'Original POST result' : 'Incorrect GET replay'}</h1>`)); });
cases.push(['02-post-popup', async id => {
  postRequests = [];
  await boundary.begin(id); await boundary.open(id, runtime.url + '/post-entry');
  await click(id, await boundary.observe(id), 'Open report');
  const result = await observeUntil(id, o => o.snapshot.includes('Original POST result'));
  assert(result.url.endsWith('/post-result'));
  assert.deepEqual(postRequests, ['POST']);
  return { originalPostPreserved: true };
}]);

registerScenarios({ routes, cases, boundary, url: runtime.url, html, click, observeUntil, choose });

try {
  const selected = process.argv.find(a => a.startsWith('--case='))?.split('=')[1];
  for (const [name, test] of cases.filter(([name]) => !selected || name.startsWith(selected))) {
    const id = 'e2e-' + name + '-' + Date.now(); const start = performance.now();
    try { const detail = await test(id); report.tests.push({ name, status: 'pass', durationMs: Math.round(performance.now() - start), ...detail }); console.log('PASS', name, JSON.stringify(detail ?? {})); }
    catch (error) { report.tests.push({ name, status: 'fail', durationMs: Math.round(performance.now() - start), category: error.code === 'ERR_ASSERTION' ? 'assertion' : 'browser-operation' }); console.log('FAIL', name, error.message); }
    finally { await boundary.close(id); }
  }
} finally {
  await runtime.close();
  await mkdir('.ci-results', { recursive: true });
  await writeFile('.ci-results/browsing.json', JSON.stringify(report, null, 2));
}
process.exitCode = report.tests.length > 0 && report.tests.every(t => t.status === 'pass') ? 0 : 1;
