export default function register({ cases, routes, html, boundary, runtime, click, observeUntil, assert }) {
  routes.set('/parallel', (_req, res, url) => {
    const token = url.searchParams.get('run') === 'A' ? 'A' : 'B';
    res.end(html(`<a href="/parallel-result?run=${token}" target="_blank">Open owned result</a>`));
  });
  routes.set('/parallel-result', (_req, res, url) => res.end(html(`<h1>Owned result ${url.searchParams.get('run') === 'A' ? 'A' : 'B'}</h1>`)));
  cases.push(['09-concurrent-run-isolation', async id => {
    const other = id + '-other';
    try {
      await Promise.all([boundary.begin(id), boundary.begin(other)]);
      await Promise.all([boundary.open(id, runtime.url + '/parallel?run=A'), boundary.open(other, runtime.url + '/parallel?run=B')]);
      const [a, b] = await Promise.all([boundary.observe(id), boundary.observe(other)]);
      await Promise.all([click(id, a, 'Open owned result'), click(other, b, 'Open owned result')]);
      const [ra, rb] = await Promise.all([
        observeUntil(id, o => o.snapshot.includes('Owned result A')),
        observeUntil(other, o => o.snapshot.includes('Owned result B')),
      ]);
      assert(!ra.snapshot.includes('Owned result B'));
      assert(!rb.snapshot.includes('Owned result A'));
      return { concurrentRuns: 2, targetIsolation: true };
    } finally { await boundary.close(other); }
  }]);
}
