import test from 'node:test';
import assert from 'node:assert/strict';
import {modelPage} from '../server/model-context.ts';
test('model state uses separate context instead of repeating candidate choices',()=>{
  const page=modelPage({id:'o',url:'about:blank',title:'Page',candidates:[{ref:'e1',label:'button Continue'}],snapshot:'button Continue [ref=e1]\nCurrent details',pageContext:'Current details'});
  assert.equal(page.semantic_dom,'Current details');
});
test('model state excludes internal reference signatures',()=>{
  const page=modelPage({id:'o',url:'about:blank',title:'Page',candidates:[],snapshot:'',focusedField:{ref:'e1',signature:'opaque-internal',label:'Query',placeholder:'Search',value:'typed text',isText:true}});
  assert.deepEqual(page.focused_field,{label:'Query',placeholder:'Search',value:'typed text',isText:true});
});
