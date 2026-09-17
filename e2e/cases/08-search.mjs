export default function register({ cases, routes, html, boundary, runtime, click, observeUntil, assert }) {
  let submitted;
  routes.set('/flight-form', (_req, res) => res.end(html('<form action="/flight-results"><input name="from" aria-label="Origin"><input name="to" aria-label="Destination"><input type="month" name="month" aria-label="Month"><input type="number" name="budget" aria-label="Maximum budget"><button>Search flights</button></form>')));
  routes.set('/flight-results', (_req, res, url) => {
    submitted = Object.fromEntries(url.searchParams);
    res.end(html('<h1>Flight fixture search complete</h1><p>Synthetic test results only; not a real airfare.</p>'));
  });
  cases.push(['08-multifield-flight-search', async id => {
    submitted = undefined;
    await boundary.begin(id);
    await boundary.open(id, runtime.url + '/flight-form');
    const fields = [['Origin', 'Hanoi'], ['Destination', 'Vancouver'], ['Month', '2026-12'], ['Maximum budget', '2500']];
    for (const [label, value] of fields) {
      await click(id, await boundary.observe(id), label);
      const o = await boundary.observe(id);
      await boundary.act(id, { kind: 'type_text', value, observationId: o.id }, o);
    }
    await click(id, await boundary.observe(id), 'Search flights');
    await observeUntil(id, o => o.snapshot.includes('Flight fixture search complete'));
    assert.deepEqual(submitted, { from: 'Hanoi', to: 'Vancouver', month: '2026-12', budget: '2500' });
    return { exactFormValuesSubmitted: true, syntheticOnly: true };
  }]);
}
