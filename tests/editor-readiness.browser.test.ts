import { expect, it } from 'vitest';
import { browserFixture } from './helpers/browser-fixture.js';

it('waits for a declared delayed editor before collecting the next actionable state', async () => {
  const f = await browserFixture(`<input aria-label="Origin" role="combobox" aria-expanded="false" oninput="setTimeout(()=>{const d=document.createElement('div');d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-label','Choose origin');d.innerHTML='<input aria-label=Query value=Hanoi><div role=option>Hanoi HAN</div>';document.body.append(d);d.querySelector('input').focus();},180)">`);
  try {
    let observation = await f.boundary.observe('test');
    await f.boundary.act('test', {kind:'fill_item', target:observation.candidates[0].ref, value:'Hanoi', observationId:observation.id}, observation);
    observation = await f.boundary.observe('test');
    expect(observation.pageText).toContain('Choose origin');
    expect(observation.candidates.some(item => item.label === 'option "Hanoi HAN"')).toBe(true);
    expect(observation.candidates.some(item => item.label === 'combobox "Origin"')).toBe(false);
  } finally { await f.close(); }
}, 15000);

it('waits for a declared editor after focused typing without adding a delay to ordinary fields', async () => {
  const f = await browserFixture(`<input aria-label="Date" aria-haspopup="dialog" oninput="setTimeout(()=>{const d=document.createElement('div');d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-label','Choose date');d.innerHTML='<input aria-label=Date>';document.body.append(d);d.querySelector('input').focus();},180)">`);
  try {
    await f.page.locator('input').focus();
    let observation = await f.boundary.observe('test');
    await f.boundary.act('test', {kind:'type_text', value:'December 8', observationId:observation.id}, observation);
    observation = await f.boundary.observe('test');
    expect(observation.pageText).toContain('Choose date');
  } finally { await f.close(); }
}, 15000);

it('fills an ordinary field without an unrelated editor deadline', async () => {
  const f = await browserFixture('<input aria-label="Search">');
  try {
    const observation = await f.boundary.observe('test');
    const start = performance.now();
    await f.boundary.act('test', {kind:'fill_item', target:observation.candidates[0].ref, value:'query', observationId:observation.id}, observation);
    expect(performance.now()-start).toBeLessThan(700);
    expect(await f.page.locator('input').inputValue()).toBe('query');
  } finally { await f.close(); }
}, 15000);


it('does not treat aria-expanded as ready until a visible combobox option arrives', async () => {
  const f = await browserFixture(`<input aria-label="Origin" role="combobox" aria-controls="airports" aria-expanded="false"
    oninput="this.setAttribute('aria-expanded','true');setTimeout(()=>{const o=document.createElement('div');o.id='airports';o.innerHTML='<div role=option>Hanoi HAN</div>';document.body.append(o);},500)">`);
  try {
    let observation = await f.boundary.observe('test');
    await f.boundary.act('test', {kind:'fill_item', target:observation.candidates[0].ref, value:'Hanoi', observationId:observation.id}, observation);
    observation = await f.boundary.observe('test');
    expect(observation.candidates.some(item => item.label === 'option "Hanoi HAN"')).toBe(true);
  } finally { await f.close(); }
}, 15000);
