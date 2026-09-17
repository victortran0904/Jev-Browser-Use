export default function register({ cases, routes, html, boundary, runtime, click, choose, observeUntil, assert }) {
  routes.set('/dynamic', (_req, res) => res.end(html(`<button onclick="this.before(Object.assign(document.createElement('button'),{textContent:'Inserted control'}))">Insert control</button><button>Keep identity</button><script>new MutationObserver(rs=>{if(rs.some(r=>r.attributeName==='data-jev-ref'))document.title='Scanner mutated page'}).observe(document.documentElement,{subtree:true,attributes:true})</script>`)));
  cases.push(['04-dynamic-stable-refs', async id => {
    await boundary.begin(id);
    await boundary.open(id, runtime.url + '/dynamic');
    const before = await boundary.observe(id);
    assert.equal(before.title, "Browser fixture", "Observation must not mutate page attributes");
    const original = choose(before, 'Keep identity');
    await click(id, before, 'Insert control');
    const after = await observeUntil(id, o => o.candidates.some(c => c.label.includes('Inserted control')));
    assert.equal(choose(after, 'Keep identity'), original, 'Unchanged elements need stable document-scoped identity');
    return { stableReference: true, insertedControlDiscovered: true };
  }]);
}
