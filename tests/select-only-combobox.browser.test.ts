import { expect, it } from 'vitest';
import { browserFixture } from './helpers/browser-fixture.js';

it('observes and activates a select-only combobox without treating it as a text field', async () => {
  const f = await browserFixture(`<div role="combobox" aria-label="Trip type" aria-expanded="false" onclick="this.setAttribute('aria-expanded','true');document.querySelector('[role=listbox]').hidden=false">Round trip</div><div role="listbox" hidden><div role="option" onclick="document.querySelector('[role=combobox]').textContent='One way';this.parentElement.hidden=true">One way</div></div>`);
  try {
    let observation = await f.boundary.observe('test');
    const combo = observation.candidates.find(item => item.label.includes('Trip type'));
    expect(combo).toBeDefined();
    expect(combo!.field?.isText).not.toBe(true);
    await f.boundary.act('test', {kind:'click_item', target:combo!.ref, observationId:observation.id}, observation);
    observation = await f.boundary.observe('test');
    const option = observation.candidates.find(item => item.label === 'option "One way"');
    expect(option).toBeDefined();
    await f.boundary.act('test', {kind:'click_item', target:option!.ref, observationId:observation.id}, observation);
    expect(await f.page.getByRole('combobox').innerText()).toBe('One way');
  } finally { await f.close(); }
}, 15000);
