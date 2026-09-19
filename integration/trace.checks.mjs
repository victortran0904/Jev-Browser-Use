import test from 'node:test';
import assert from 'node:assert/strict';
import {traceStep,failureCategory} from './trace.mjs';
test('direct fills are recorded as valid without copying field values',()=>{
  const output=traceStep({kind:'fill_item',target:'e1',value:'PRIVATE_TYPED_VALUE',confidence:1},{candidates:[{ref:'e1',label:'Origin'}]});
  assert.equal(output.kind,'fill_item');
  assert(!JSON.stringify(output).includes('PRIVATE_TYPED_VALUE'));
});

test('bounded flight writer exhaustion is reported as request-budget, not an unknown runtime error', async () => {
  const { failureCategory } = await import('./trace.mjs');
  assert.equal(failureCategory(new Error('Flight writer budget exceeded')), 'request-budget');
});

test('model output failures have safe actionable categories without response content',()=>{
  assert.equal(failureCategory(new SyntaxError('Unexpected end of JSON input PRIVATE')), 'invalid-model-json');
  assert.equal(failureCategory(new Error('Gemini returned no structured response')), 'empty-model-response');
});
