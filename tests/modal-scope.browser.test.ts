import { expect, it } from 'vitest';
import { browserFixture } from './helpers/browser-fixture.js';

it('offers only controls within the active modal and restores background controls after dismissal', async () => {
  const f = await browserFixture(`<input aria-label="Background search"><div role="dialog" aria-modal="true" aria-label="Choose an airport"><input aria-label="Where else?"><div role="option" onclick="document.querySelector('[role=dialog]').remove()">Hanoi HAN</div></div>`);
  try {
    let observation = await f.boundary.observe('test');
    expect(observation.candidates.some(item => item.label.includes('Background search'))).toBe(false);
    const option = observation.candidates.find(item => item.label.includes('Hanoi HAN'));
    expect(option).toBeDefined();
    await f.boundary.act('test', {kind:'click_item', target:option!.ref, observationId:observation.id}, observation);
    observation = await f.boundary.observe('test');
    expect(observation.candidates.some(item => item.label.includes('Background search'))).toBe(true);
  } finally { await f.close(); }
}, 15000);

it('retains the active dialog name as context for an ambiguously named field', async () => {
  const f = await browserFixture('<div role="dialog" aria-modal="true" aria-label="Enter your origin"><input aria-label="Where else?"><div role="option">Hanoi</div></div>');
  try {
    const observation = await f.boundary.observe('test');
    expect(observation.pageText).toContain('Enter your origin');
  } finally { await f.close(); }
}, 15000);

it('refuses an old background fill if a modal opens after planning', async () => {
  const f = await browserFixture('<input aria-label="Background search">');
  try {
    const observation = await f.boundary.observe('test');
    await f.page.evaluate(() => {
      const modal = document.createElement('div');
      modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
      modal.textContent = 'Choose an airport'; document.body.append(modal);
    });
    await expect(f.boundary.act('test', {kind:'fill_item', target:observation.candidates[0].ref, value:'wrong field', observationId:observation.id}, observation)).rejects.toThrow(/stale|modal/i);
    expect(await f.page.locator('input').inputValue()).toBe('');
  } finally { await f.close(); }
}, 15000);

it('lets a clicked menu option settle for a bounded frame window before the next observation', async () => {
  const f = await browserFixture(`<input aria-label="Background search"><div role="dialog" aria-modal="true"><div role="option"
    onclick="setTimeout(()=>document.querySelector('[role=dialog]').remove(),65)">One way</div></div>`);
  try {
    let observation = await f.boundary.observe('test');
    const option = observation.candidates.find(item => item.label.includes('One way'));
    expect(option).toBeDefined();
    await f.boundary.act('test', {kind:'click_item', target:option!.ref, observationId:observation.id}, observation);
    observation = await f.boundary.observe('test');
    expect(observation.candidates.some(item => item.label.includes('Background search'))).toBe(true);
    expect(observation.candidates.some(item => item.label.includes('One way'))).toBe(false);
  } finally { await f.close(); }
}, 15000);
