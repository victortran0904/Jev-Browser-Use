export default function register({ cases, routes, html, boundary, runtime, click, observeUntil, assert }) {
  let posts = 0, gets = 0;
  routes.set('/popup', (_req, res) => res.end(html('<form action="/popup-result" method="POST" target="_blank"><button>Open result</button></form>')));
  routes.set('/popup-result', (req, res) => {
    if (req.method === 'POST') {
      posts++; req.resume();
      res.end(html('<h1>POST state preserved</h1><button>Continue in actual popup</button>'));
    } else {
      gets++; res.end(html('<h1>State lost on GET</h1>'));
    }
  });
  cases.push(['02-post-popup', async id => {
    posts = 0; gets = 0;
    await boundary.begin(id);
    await boundary.open(id, runtime.url + '/popup');
    await click(id, await boundary.observe(id), 'Open result');
    const o = await observeUntil(id, o => o.snapshot.includes('POST state preserved'));
    assert.equal(posts, 1);
    assert.equal(gets, 0, 'Popup destination must not be reloaded');
    assert(o.candidates.some(c => c.label.includes('Continue in actual popup')));
    return { originalPostPreserved: true, duplicateNavigations: gets };
  }]);
}
