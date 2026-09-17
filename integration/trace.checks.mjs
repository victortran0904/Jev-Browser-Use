import test from 'node:test';
import assert from 'node:assert/strict';
import {traceStep} from './trace.mjs';
test('direct fills are recorded as valid without copying field values',()=>{
  const output=traceStep({kind:'fill_item',target:'e1',value:'PRIVATE_TYPED_VALUE',confidence:1},{candidates:[{ref:'e1',label:'Origin'}]});
  assert.equal(output.kind,'fill_item');
  assert(!JSON.stringify(output).includes('PRIVATE_TYPED_VALUE'));
});

test('bounded flight writer exhaustion is reported as request-budget, not an unknown runtime error', async () => {
  const { failureCategory } = await import('./trace.mjs');
  assert.equal(failureCategory(new Error('Flight writer budget exceeded')), 'request-budget');
});
