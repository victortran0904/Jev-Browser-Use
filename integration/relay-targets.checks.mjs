import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './browser-fixture.mjs';
test('a run follows only its own real popup and keeps the unrelated session intact',async()=>{
  const f=await fixture(url=>url.pathname==='/child'?'<h1>Original child result</h1>':'<a href="/child" target="_blank">Open child</a>');
  try {
    await f.boundary.begin('stranger');
    await f.sessions.get('jev-stranger').page.setContent('<h1>Unrelated session</h1>');
    const o=await f.boundary.observe('test');
    const popup=f.page.waitForEvent('popup');
    await f.boundary.act('test',{kind:'click_item',target:o.candidates[0].ref,observationId:o.id},o);
    await (await popup).waitForLoadState('domcontentloaded');
    assert((await f.boundary.observe('test')).snapshot.includes('Original child result'));
    assert.equal(f.requests.filter(r=>new URL(r.url).pathname==='/child').length,1);
    await f.boundary.close('test');
    assert((await f.boundary.observe('stranger')).snapshot.includes('Unrelated session'));
  } finally {await f.boundary.close('stranger');await f.close();}
});
test('Enter refuses a field that changed focus after planning',async()=>{
  const f=await fixture('<input aria-label="First"><input aria-label="Second">');
  try{
    await f.page.locator('input').first().focus();
    const o=await f.boundary.observe('test');
    await f.page.locator('input').last().focus();
    await assert.rejects(f.boundary.act('test',{kind:'press_enter',observationId:o.id},o),/stale/i);
  }finally{await f.close();}
});
