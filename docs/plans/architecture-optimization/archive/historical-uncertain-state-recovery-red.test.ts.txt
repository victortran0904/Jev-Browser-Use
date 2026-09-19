// NOT IMPLEMENTED: changed-state recovery for uncertain model decisions.
// The behavior test failed; the implementation command was blocked before execution.
// Existing confidence behavior remains unchanged. This is not an active passing test.
import { expect, it } from 'vitest';
import { createRunController } from '../server/runs.js';

it('replans a low-confidence decision only after observing changed page state, without dispatching that decision', async () => {
  let observations = 0, decisions = 0, selected = false;
  const actions: string[] = [];
  const controller = createRunController({ enableScreenshots: false,
    browser: {
      begin: async () => {}, close: async () => {}, open: async () => 'opened',
      observe: async () => ({ id: String(++observations), url: 'https://example.com', title: 'Origin',
        snapshot: selected ? 'Selected Hanoi' : observations === 1 ? 'Loading suggestions' : 'Hanoi option loaded',
        candidates: selected ? [] : [{ ref: 'e1', label: observations === 1 ? 'Origin' : 'Hanoi option' }],
      }),
      act: async (_id, action) => { actions.push(action.kind); selected = true; return 'selected Hanoi'; },
    },
    planner: { plan: async ({ observation }) => {
      decisions++;
      return { kind: decisions === 1 ? 'press_enter' : selected ? 'done' : 'click_item',
        target: 'e1', observationId: observation.id, confidence: decisions === 1 ? 0.2 : 1 };
    } },
    narrator: { acknowledge: async () => 'Started', summarize: async () => 'Finished' },
  });
  const run = controller.start({ goal: 'Select Hanoi from the suggestions' });
  await controller.settled(run.id);
  expect(run.status).toBe('complete');
  expect(actions).toEqual(['click_item']);
  expect(run.observation?.snapshot).toBe('Selected Hanoi');
  expect(run.events.filter(e => e.type === 'state_refresh')).toHaveLength(1);
});
