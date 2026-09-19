import { expect, it } from 'vitest';
import { browserFixture } from './helpers/browser-fixture.js';

it('exposes visible autocomplete suggestions and selects one through normal browser input', async () => {
  const fixture = await browserFixture('<input aria-label="Origin" role="combobox"><div role="listbox"><div role="option" onclick="document.querySelector(\'input\').value=\'HAN\';this.parentElement.hidden=true">Hanoi Airport (HAN)</div><div role="option" hidden>Hidden suggestion</div></div>');
  try {
    const observation = await fixture.boundary.observe('test');
    const option = observation.candidates.find(item => item.label.includes('Hanoi Airport'));
    expect(option).toBeDefined();
    expect(observation.candidates.some(item => item.label.includes('Hidden suggestion'))).toBe(false);
    await fixture.boundary.act('test', { kind: 'click_item', target: option!.ref, observationId: observation.id }, observation);
    expect(await fixture.page.locator('input').inputValue()).toBe('HAN');
    expect(await fixture.page.locator('[role=listbox]').isVisible()).toBe(false);
  } finally { await fixture.close(); }
}, 15000);
