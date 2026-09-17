export default function register({ cases, routes, html, boundary, runtime, click, choose, assert }) {
  routes.set('/stale', (_req, res) => res.end(html(`<button onclick="const t=document.getElementById('target');t.replaceWith(t.cloneNode(true))">Replace control</button><button id="target" onclick="document.getElementById('effect').textContent='Wrong click'">Original control</button><output id="effect">No click</output>`)));
  cases.push(['07-reject-replaced-target', async id => {
    await boundary.begin(id);
    await boundary.open(id, runtime.url + '/stale');
    const before = await boundary.observe(id);
    await click(id, before, 'Replace control');
    const action = { kind: 'click_item', target: choose(before, 'Original control'), observationId: before.id };
    const result = await boundary.act(id, action, before).catch(error => error);
    assert(result instanceof Error, 'A replaced node must invalidate its old action');
    assert.match(result.message, /stale|changed|refresh/i);
    assert(!(await boundary.observe(id)).snapshot.includes('Wrong click'));
    return { staleActionRejected: true };
  }]);
}
