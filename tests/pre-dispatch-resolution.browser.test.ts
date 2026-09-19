import { expect, it } from 'vitest';
import { browserFixture } from './helpers/browser-fixture.js';

it('reports a changed field as a proven pre-dispatch rejection instead of an unknown action failure', async () => {
  const f = await browserFixture('<input aria-label="Origin">');
  try {
    const observation = await f.boundary.observe('test');
    await f.page.locator('input').evaluate(el => { (el as HTMLInputElement).value = 'page supplied value'; });
    await expect(f.boundary.act('test', {kind:'fill_item', target:observation.candidates[0].ref, value:'old planned value', observationId:observation.id}, observation)).rejects.toMatchObject({name:'StaleObservationError', dispatched:false});
    expect(await f.page.locator('input').inputValue()).toBe('page supplied value');
  } finally { await f.close(); }
}, 15000);

it('reports focus changes before typing as non-dispatched and does not overwrite the field', async () => {
  const f = await browserFixture('<input aria-label="Origin"><input aria-label="Destination">');
  try {
    await f.page.getByRole('textbox', {name:'Origin'}).focus();
    const observation = await f.boundary.observe('test');
    await f.page.getByRole('textbox', {name:'Destination'}).focus();
    await expect(f.boundary.act('test', {kind:'type_text', value:'old planned value', observationId:observation.id}, observation)).rejects.toMatchObject({name:'StaleObservationError', dispatched:false});
    expect(await f.page.getByRole('textbox', {name:'Destination'}).inputValue()).toBe('');
  } finally { await f.close(); }
}, 15000);

it('reports a replaced click target as non-dispatched rather than replaying against its replacement', async () => {
  const f = await browserFixture('<button onclick="document.body.dataset.clicked=true">Continue</button>');
  try {
    const observation = await f.boundary.observe('test');
    await f.page.locator('button').evaluate(el => el.replaceWith(el.cloneNode(true)));
    await expect(f.boundary.act('test', {kind:'click_item', target:observation.candidates[0].ref, observationId:observation.id}, observation)).rejects.toMatchObject({name:'StaleObservationError', dispatched:false});
    expect(await f.page.locator('body').getAttribute('data-clicked')).toBeNull();
  } finally { await f.close(); }
}, 15000);
