// Local synthetic DOM fixtures only. No external sites or account mutations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,candidate} from './browser-fixture.mjs';

test('focus clicks have no unrelated popup delay',async()=>{
  const f=await fixture('<input aria-label="Search" id="search">');
  try {
    const o=await f.boundary.observe('test'); const start=performance.now();
    await f.boundary.act('test',{kind:'click_item',target:candidate(o,'Search'),observationId:o.id},o);
    assert.equal(await f.page.locator(':focus').getAttribute('id'),'search');
    assert(performance.now()-start<850);
  } finally {await f.close();}
});
test('refs stay stable after an earlier sibling is inserted',async()=>{
  const f=await fixture('<button>Continue</button>');
  try {
    const a=await f.boundary.observe('test');
    await f.page.evaluate(()=>{const e=document.createElement('button');e.textContent='Other';document.body.prepend(e);});
    const b=await f.boundary.observe('test');
    assert.equal(candidate(a,'Continue'),candidate(b,'Continue'));
  } finally {await f.close();}
});
test('a changed target rejects the previous observation',async()=>{
  const f=await fixture('<button>First action</button>');
  try {
    const o=await f.boundary.observe('test');
    await f.page.locator('button').evaluate(e=>e.textContent='Different action');
    await assert.rejects(f.boundary.act('test',{kind:'click_item',target:candidate(o,'First action'),observationId:o.id},o),/stale/i);
  } finally {await f.close();}
});
test('focused snapshots refresh live properties while reusing page context',async()=>{
  const f=await fixture('<main><h1>Search</h1><input aria-label="Query"></main>');
  try {
    const a=await f.boundary.observe('test');
    await f.page.locator('input').focus();
    await f.page.locator('input').evaluate(e=>e.value='fixture query');
    const b=await f.boundary.observe('test');
    assert.equal(b.focusedField.value,'fixture query');
    assert.equal(b.pageText,a.pageText);
    assert.equal(b.metrics.mode,'focused');
  } finally {await f.close();}
});
test('closed runs are not recreated by later observations',async()=>{
  const f=await fixture('<h1>Temporary</h1>');
  try {
    await f.boundary.close('test');
    await assert.rejects(f.boundary.observe('test'),/closed/i);
    assert.equal(f.sessions.size,0);
  } finally {await f.close();}
});
