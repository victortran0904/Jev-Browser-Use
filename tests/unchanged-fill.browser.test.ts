import { expect, it } from 'vitest';
import { browserFixture } from './helpers/browser-fixture.js';

it('does not retype or submit an observed field already containing the requested value', async () => {
  const f = await browserFixture('<form onsubmit="event.preventDefault();document.body.dataset.submitted=true"><input aria-label="Origin" value="Hanoi" oninput="document.body.dataset.changed=true"></form>');
  try {
    const observation = await f.boundary.observe('test');
    const result = await f.boundary.act('test', {
      kind: 'fill_item', target: observation.candidates[0].ref, value: 'Hanoi', observationId: observation.id,
    }, observation);
    expect(result).toMatch(/already has.*requested value/i);
    expect(result).not.toContain('Hanoi');
    expect(await f.page.locator('body').getAttribute('data-changed')).toBeNull();
    expect(await f.page.locator('body').getAttribute('data-submitted')).toBeNull();
  } finally { await f.close(); }
}, 15000);

it('does not repeat an unchanged fill through the focused-field typing path', async () => {
  const f = await browserFixture('<input aria-label="Search" value="Hanoi" oninput="document.body.dataset.changed=true">');
  try {
    await f.page.locator('input').focus();
    const observation = await f.boundary.observe('test');
    const result = await f.boundary.act('test', {
      kind: 'type_text', value: 'Hanoi', observationId: observation.id,
    }, observation);
    expect(result).toMatch(/already has.*requested value/i);
    expect(await f.page.locator('body').getAttribute('data-changed')).toBeNull();
  } finally { await f.close(); }
}, 15000);
