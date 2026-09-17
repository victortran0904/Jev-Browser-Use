export default function register({ cases, routes, html, boundary, runtime, click, assert }) {
  routes.set('/private-fields', (_req, res) => res.end(html('<input aria-label="Payment field" autocomplete="cc-number" value="synthetic-private-value"><input aria-label="Verification field" autocomplete="one-time-code" value="synthetic-code"><button>Continue</button>')));
  cases.push(['05-sensitive-field-redaction', async id => {
    await boundary.begin(id);
    await boundary.open(id, runtime.url + '/private-fields');
    for (const label of ['Payment field', 'Verification field']) {
      await click(id, await boundary.observe(id), label);
      const o = await boundary.observe(id);
      assert.equal(o.focusedField?.value, '', 'Private values must not enter observations');
      assert.equal(o.focusedField?.isText, false, 'Sensitive fields must not be writer targets');
      assert(!JSON.stringify(o).includes('synthetic-private-value'));
      assert(!JSON.stringify(o).includes('synthetic-code'));
    }
    return { sensitiveValuesRedacted: true, sensitiveTypingDisabled: true };
  }]);
}
