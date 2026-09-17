import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserBoundary} from '../server/browser.ts';
import {fixture} from './browser-fixture.mjs';
test('a relay child keeps its existing session and unrelated sessions are ignored',async()=>{
  let child=false;const visited=[];
  const source={snapshot:async()=>[{id:'root',session:'jev-parent'},...(child?[{id:'stranger',session:'other-run',opener:'other-root'},{id:'child',session:'child-session',opener:'root'}]:[])],close(){}};
  const boundary=createBrowserBoundary(async args=>{
    if(args[0]!=='execute')return JSON.stringify({ok:true});
    const session=args[args.indexOf('--session')+1];visited.push(session);
    return JSON.stringify({ok:true,value:{url:'about:blank',title:session,candidates:[],pageText:session}});
  },{targetSource:source});
  await boundary.begin('parent');await boundary.observe('parent');child=true;
  const current=await boundary.observe('parent');
  assert.equal(current.title,'child-session');assert(!visited.includes('other-run'));
  await boundary.close('parent');
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
