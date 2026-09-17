export default function register({ cases, routes, html, boundary, runtime, click, observeUntil, assert }) {
  // Both pages are local HTTPS test fixtures, with no external site traffic.
  routes.set('/delayed', (_req, res) => res.end(html(`<button onclick="setTimeout(()=>window.open('/delayed-result'),250)">Open delayed result</button>`)));
  routes.set('/delayed-result', (_req, res) => res.end(html('<h1>Delayed popup ready</h1><button>Result action</button>')));
  cases.push(['03-delayed-popup', async id => {
    await boundary.begin(id);
    await boundary.open(id, runtime.url + '/delayed');
    await click(id, await boundary.observe(id), 'Open delayed result');
    const result = await observeUntil(id, o => o.snapshot.includes('Delayed popup ready'));
    assert(result.url.endsWith('/delayed-result'));
    assert(result.candidates.some(c => c.label.includes('Result action')));
    return { delayedPopupRetained: true };
  }]);
}
