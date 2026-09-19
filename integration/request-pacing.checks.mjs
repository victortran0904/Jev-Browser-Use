import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequestGate} from './request-pacing.mjs';
test('concurrent verification requests reserve separate slots instead of a burst',async()=>{
  const waits=[];
  const gate=createRequestGate({spacingMs:4500,now:()=>0,sleep:async ms=>{waits.push(ms);}});
  await Promise.all([gate(),gate(),gate()]);
  assert.deepEqual(waits,[4500,9000]);
});
