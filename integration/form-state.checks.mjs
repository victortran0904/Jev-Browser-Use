import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,candidate} from './browser-fixture.mjs';

test('action history identifies controls without echoing typed values',async()=>{
  const f=await fixture('<input aria-label="Destination"><button>View details</button>');
  try {
    let o=await f.boundary.observe('test');
    const clicked=await f.boundary.act('test',{kind:'click_item',target:candidate(o,'Destination'),observationId:o.id},o);
    assert(clicked.includes('Destination'));
    o=await f.boundary.observe('test');
    const typed=await f.boundary.act('test',{kind:'type_text',value:'fixture-city',observationId:o.id},o);
    assert(typed.includes('Destination'));
    assert(!typed.includes('fixture-city'));
  }finally{await f.close();}
});
test('multi-field forms expose safe current values even outside focused fields',async()=>{
  const f=await fixture('<input aria-label="Origin"><input aria-label="Destination">');
  try {
    await f.page.locator('input').first().fill('Hanoi');
    await f.page.locator('input').last().focus();
    await f.boundary.observe('test');
    await f.page.locator('input').first().evaluate(e=>e.value='HAN');
    const current=await f.boundary.observe('test');
    assert(current.candidates.find(c=>c.label.includes('Origin')).label.includes('HAN'));
  }finally{await f.close();}
});
test('sensitive fields and mirrored metadata are redacted before observation',async()=>{
  const f=await fixture('<input type="password" value="fixture-private-value"><button title="fixture-private-value">Continue</button><a href="https://example.com/?value=fixture-private-value">Link</a>');
  try {
    await f.page.locator('input').focus();
    const o=await f.boundary.observe('test');
    assert(!JSON.stringify(o).includes('fixture-private-value'));
    assert.equal(o.focusedField.isText,false);
    assert(o.candidates.every(c=>!c.signature.includes('https:')));
  }finally{await f.close();}
});
