export default function register({ cases, routes, html, boundary, runtime, assert }) {
  routes.set('/lifecycle', (_req, res) => res.end(html('<input aria-label="Lifecycle field"><button>Lifecycle action</button>')));
  cases.push(['10-closed-run-cannot-resurrect', async id => {
    await boundary.begin(id);
    assert.equal((await boundary.observe(id)).url, "about:blank");
    await boundary.open(id, runtime.url + '/lifecycle');
    await boundary.observe(id);
    await boundary.close(id);
    await assert.rejects(() => boundary.observe(id), /closed|stopped/i);
    await assert.rejects(() => boundary.open(id, runtime.url + '/lifecycle'), /closed|stopped/i);
    await boundary.close(id);
    return { closedRunRejected: true, cleanupIdempotent: true };
  }]);
}
