export default function register({ cases, routes, html, boundary, runtime, click, observeUntil, assert }) {
  routes.set('/redirect', (_req, res) => { res.writeHead(302, { location: '/ready' }); res.end(); });
  routes.set('/slow-image', (_req, res) => {
    const timer = setTimeout(() => { res.setHeader('content-type', 'image/svg+xml'); res.end('<svg xmlns="http://www.w3.org/2000/svg"/>'); }, 2500);
    res.on('close', () => clearTimeout(timer));
  });
  routes.set('/ready', (_req, res) => res.end(html(`<img src="/slow-image"><button onclick="setTimeout(()=>document.getElementById('results').textContent='SPA results ready',150)">Load results</button><section id="results"></section>`)));
  cases.push(['06-redirect-and-spa-readiness', async id => {
    await boundary.begin(id);
    const start = performance.now();
    await boundary.open(id, runtime.url + '/redirect');
    const navigationMs = Math.round(performance.now() - start);
    assert(navigationMs < 1200, 'Navigation must not wait for the decorative image');
    const initial = await boundary.observe(id);
    assert(initial.url.endsWith('/ready'));
    await click(id, initial, 'Load results');
    await observeUntil(id, o => o.snapshot.includes('SPA results ready'));
    return { navigationMs, redirected: true, asynchronousContentObserved: true };
  }]);
}
