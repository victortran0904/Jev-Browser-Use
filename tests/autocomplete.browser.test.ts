import { expect, it } from 'vitest';
import { browserFixture } from './helpers/browser-fixture.js';

it('selects a visible autocomplete option through the browser boundary', async () => {
  const f = await browserFixture(`<input aria-label="Origin" role="combobox" aria-controls="airports">
    <div role="listbox" id="airports"><div role="option" onclick="document.querySelector('input').value='HAN';document.querySelector('p').textContent='Selected Hanoi HAN'">Hanoi (HAN)</div></div><p role="status"></p>`);
  try {
    const observation = await f.boundary.observe('test');
    const option = observation.candidates.find(item => item.label === 'option "Hanoi (HAN)"');
    expect(option).toBeDefined();
    await f.boundary.act('test', { kind: 'click_item', target: option!.ref, observationId: observation.id }, observation);
    expect((await f.boundary.observe('test')).pageText).toContain('Selected Hanoi HAN');
  } finally { await f.close(); }
});

it('reports an unchanged direct fill without firing another input event', async () => {
  const f = await browserFixture(`<input aria-label="Origin" oninput="document.querySelector('p').textContent='Input events: '+(++window.changes)"><p role="status">Input events: 0</p><script>window.changes=0</script>`);
  try {
    let observation = await f.boundary.observe('test');
    const ref = observation.candidates[0].ref;
    await f.boundary.act('test', { kind: 'fill_item', target: ref, value: 'Hanoi', observationId: observation.id }, observation);
    observation = await f.boundary.observe('test');
    const result = await f.boundary.act('test', { kind: 'fill_item', target: ref, value: 'Hanoi', observationId: observation.id }, observation);
    expect(result).toMatch(/already (?:has|contains)/i);
    expect((await f.boundary.observe('test')).pageText).toContain('Input events: 1');
  } finally { await f.close(); }
});

it('reports an unchanged focused fill without firing another input event', async () => {
  const f = await browserFixture(`<input aria-label="Origin" oninput="document.querySelector('p').textContent='Input events: '+(++window.changes)"><p role="status">Input events: 0</p><script>window.changes=0</script>`);
  try {
    let observation = await f.boundary.observe('test');
    await f.boundary.act('test', { kind: 'fill_item', target: observation.candidates[0].ref, value: 'Hanoi', observationId: observation.id }, observation);
    observation = await f.boundary.observe('test');
    const result = await f.boundary.act('test', { kind: 'type_text', value: 'Hanoi', observationId: observation.id }, observation);
    expect(result).toMatch(/already (?:has|contains)/i);
    expect((await f.boundary.observe('test')).pageText).toContain('Input events: 1');
  } finally { await f.close(); }
});
