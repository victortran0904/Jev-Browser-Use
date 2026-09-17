import assert from 'node:assert/strict';

export function registerScenarios({ routes, cases, boundary, url, html, click, observeUntil, choose }) {
  const start = async (id, pathname) => { await boundary.begin(id); await boundary.open(id, url + pathname); };
  const fill = async (id, label, value) => {
    const o = await boundary.observe(id);
    await boundary.act(id, { kind: 'fill_item', target: choose(o, label), value, observationId: o.id }, o);
  };
  routes.set('/delayed', (_req, res) => res.end(html(`<button onclick="setTimeout(() => { const w=window.open('about:blank'); w.sessionStorage.setItem('marker','Original tab state'); w.location='/delayed-result'; }, 200)">Open details</button>`)));
  routes.set('/delayed-result', (_req, res) => res.end(html(`<h1 id="result"></h1><script>document.querySelector('#result').textContent=sessionStorage.getItem('marker') || 'State lost'</script>`)));
  cases.push(['03-delayed-popup', async id => {
    await start(id, '/delayed'); await click(id, await boundary.observe(id), 'Open details');
    await observeUntil(id, o => o.pageText.includes('Original tab state'));
    return { popupStatePreserved: true };
  }]);
  routes.set('/redirect', (_req, res) => { res.writeHead(302, { location: '/ready' }); res.end(); });
  routes.set('/ready', (_req, res) => res.end(html('<h1>Ready after redirect</h1><button>Continue</button><img src="/slow.png">')));
  routes.set('/slow.png', (_req, res) => { setTimeout(() => res.end('image'), 2500).unref(); });
  cases.push(['04-redirect-readiness', async id => {
    await boundary.begin(id); const at = performance.now(); await boundary.open(id, url + '/redirect');
    const navigationMs = Math.round(performance.now() - at);
    assert(navigationMs < 1500, 'Navigation unnecessarily waited for a slow image');
    const o = await boundary.observe(id); assert(o.url.endsWith('/ready')); assert(o.pageText.includes('Ready after redirect'));
    return { navigationMs };
  }]);
  routes.set('/search', (_req, res) => res.end(html('<form action="/search-result"><input name="q" aria-label="Search query"><button>Submit search</button></form>')));
  routes.set('/search-result', (_req, res, query) => res.end(html(`<h1>${query.searchParams.get('q') === 'architecture smoke' ? 'Exact search complete' : 'Incorrect search'}</h1>`)));
  cases.push(['05-form-and-back', async id => {
    await start(id, '/search'); await fill(id, 'Search query', 'architecture smoke');
    await click(id, await boundary.observe(id), 'Submit search');
    const o = await observeUntil(id, o => o.pageText.includes('Exact search complete'));
    const backStarted = performance.now();
    await boundary.act(id, { kind: 'back', observationId: o.id }, o);
    const back = await boundary.observe(id); assert(back.candidates.some(c => c.label.includes('Search query')));
    const backRecoveryMs = Math.round(performance.now() - backStarted);
    assert(backRecoveryMs < 1500, `Back navigation paid an unnecessary load-state timeout: ${backRecoveryMs}ms`);
    return { exactSearchAndBack: true, backRecoveryMs };
  }]);
  routes.set('/dynamic', (_req, res) => res.end(html(`<button onclick="document.querySelector('dialog').showModal()">Show results</button><nav>${'Long navigation text '.repeat(1000)}</nav><dialog><h2>Search complete</h2><p role="status">Matching option found</p><button onclick="this.closest('dialog').close()">Close results</button></dialog>`)));
  cases.push(['06-dynamic-dialog-context', async id => {
    await start(id, '/dynamic'); await click(id, await boundary.observe(id), 'Show results');
    const o = await observeUntil(id, o => o.candidates.some(c => c.label.includes('Close results')));
    assert(o.pageText.slice(0, 2000).includes('Matching option found'));
    await click(id, o, 'Close results');
    const closed = await boundary.observe(id); assert(!closed.candidates.some(c => c.label.includes('Close results')));
    return { dialogEvidencePreserved: true };
  }]);
  routes.set('/scroll', (_req, res) => res.end(html(`<h1>Scroll fixture</h1><div style="height:900px"></div><button onclick="setTimeout(() => this.insertAdjacentHTML('afterend','<p role=status>Dynamic result complete</p>'),100)">Load details</button>`)));
  cases.push(['07-scroll-and-update', async id => {
    await start(id, '/scroll'); const o = await boundary.observe(id);
    assert(!o.candidates.some(c => c.label.includes('Load details')));
    await boundary.act(id, { kind: 'scroll_down', observationId: o.id }, o);
    await click(id, await observeUntil(id, o => o.candidates.some(c => c.label.includes('Load details'))), 'Load details');
    await observeUntil(id, o => o.pageText.includes('Dynamic result complete'));
    return { offscreenContentDiscovered: true };
  }]);
  routes.set('/stale', (_req, res) => res.end(html(`<h1>Not activated</h1><button id="original">Original action</button><button onclick="const old=document.querySelector('#original');const next=old.cloneNode(true);next.textContent='Different action';next.onclick=()=>document.querySelector('h1').textContent='Wrong action';old.replaceWith(next)">Replace original</button>`)));
  cases.push(['08-stale-target-guard', async id => {
    await start(id, '/stale'); const o = await boundary.observe(id);
    await click(id, o, 'Replace original');
    await assert.rejects(click(id, o, 'Original action'), /stale/i);
    assert((await boundary.observe(id)).pageText.includes('Not activated'));
    return { replacementNotActivated: true };
  }]);
  routes.set('/owned-a', (_req, res) => res.end(html('<a href="/result-a" target="_blank">Open A</a>')));
  routes.set('/owned-b', (_req, res) => res.end(html('<a href="/result-b" target="_blank">Open B</a>')));
  routes.set('/result-a', (_req, res) => res.end(html('<h1>Run A details</h1>')));
  routes.set('/result-b', (_req, res) => res.end(html('<h1>Run B details</h1>')));
  cases.push(['09-run-isolation-and-close', async id => {
    const other = id + '-other';
    try {
      await Promise.all([start(id, '/owned-a'), start(other, '/owned-b')]);
      const [a, b] = await Promise.all([boundary.observe(id), boundary.observe(other)]);
      await Promise.all([click(id, a, 'Open A'), click(other, b, 'Open B')]);
      await observeUntil(id, o => o.pageText.includes('Run A details'));
      await observeUntil(other, o => o.pageText.includes('Run B details'));
      await boundary.close(id);
      await assert.rejects(boundary.observe(id), /closed/i);
      assert((await boundary.observe(other)).pageText.includes('Run B details'));
      return { causalOwnershipPreserved: true };
    } finally { await boundary.close(other); }
  }]);
  let submitted;
  routes.set('/flight', (_req, res) => res.end(html('<form action="/flight-result"><input name="from" aria-label="From"><input name="to" aria-label="To"><input name="month" aria-label="Month"><input name="budget" aria-label="Budget CAD"><button>Find flights</button></form>')));
  routes.set('/flight-result', (_req, res, query) => {
    submitted = Object.fromEntries(query.searchParams);
    const matched = submitted.from === 'HAN' && submitted.to === 'YVR' && submitted.month === '2026-12' && submitted.budget === '2500';
    res.end(html(`<h1>Flight fixture</h1><p role="status">${matched ? 'Fixture match: HAN to YVR in December 2026, CAD 2200 under CAD 2500' : 'Incorrect flight constraints'}</p>`));
  });
  cases.push(['10-flight-route-month-budget', async id => {
    submitted = undefined; await start(id, '/flight');
    for (const [label, value] of [['From', 'HAN'], ['To', 'YVR'], ['Month', '2026-12'], ['Budget CAD', '2500']]) await fill(id, label, value);
    await click(id, await boundary.observe(id), 'Find flights');
    await observeUntil(id, o => o.pageText.includes('under CAD 2500'));
    assert.deepEqual(submitted, { from: 'HAN', to: 'YVR', month: '2026-12', budget: '2500' });
    return { routeMonthBudgetPreserved: true, syntheticFixtureNotFareQuote: true };
  }]);
}
