import test from 'node:test';
import assert from 'node:assert/strict';
import {availableActions} from '../server/action-availability.ts';
const empty={id:'o',url:'about:blank',title:'',snapshot:'',candidates:[]};

test('empty viewports cannot produce clicks on placeholder candidates',()=>{
  const result=availableActions({click_item:'click',scroll_down:'scroll',done:'done',wait:'wait'},empty);
  assert(!('click_item' in result));
  assert('scroll_down' in result);
});
test('text entry is unavailable without a currently eligible focused field',()=>{
  const criteria={click_item:'click',type_text:'type',press_enter:'submit',done:'done',wait:'wait'};
  const result=availableActions(criteria,{...empty,candidates:[{ref:'e1',label:'Search'}]});
  assert(!('type_text' in result));
  assert(!('press_enter' in result));
  assert('click_item' in result);
  assert('type_text' in availableActions(criteria,{...empty,focusedField:{label:'Search',placeholder:'',value:'',isText:true}}));
});


test('click-preferred focused date editors do not offer free-text entry',()=>{
  const criteria={click_item:'click',fill_item:'fill',type_text:'type',press_enter:'submit',done:'done',wait:'wait'};
  const field={label:'Departure',placeholder:'Departure',value:'',isText:true,preferredAction:'click'};
  const result=availableActions(criteria,{...empty,candidates:[{ref:'e1',label:'textbox "Departure"',field}],focusedField:field});
  assert(!('type_text' in result));
  assert(!('press_enter' in result));
  assert(!('fill_item' in result));
  assert('click_item' in result);
});
