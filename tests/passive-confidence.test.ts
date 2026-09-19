import { expect, it } from 'vitest';
import { createRunController } from '../server/runs.js';

it('allows a low-confidence Escape because it cannot type, submit, or activate a target', async () => {
  const actions: string[] = [];
  let plans = 0;
  const observation = { id:'o1', url:'https://example.com', title:'Dialog', snapshot:'Calendar open', pageText:'Calendar open', candidates:[] };
  const controller = createRunController({
    enableScreenshots:false,
    browser:{
      begin:async()=>{}, close:async()=>{}, open:async()=> 'opened',
      observe:async()=>observation,
      act:async(_id, action)=>{ actions.push(action.kind); return action.kind === 'press_escape' ? 'pressed Escape' : 'acted'; },
    },
    planner:{ plan:async()=> ++plans === 1
      ? {kind:'press_escape', observationId:'o1', confidence:0.18}
      : {kind:'done', observationId:'o1', confidence:1} },
    narrator:{acknowledge:async()=>'', summarize:async()=>''},
  });
  const run=controller.start({goal:'Close the open calendar'});
  await controller.settled(run.id);
  expect(actions).toEqual(['press_escape']);
  expect(run.status).toBe('complete');
});
