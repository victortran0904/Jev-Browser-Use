import { expect, it } from 'vitest';
import { createRunController } from '../server/runs.js';

it('allows extra model decisions while keeping browser actions capped at twelve', async () => {
  let observations = 0, decisions = 0, actions = 0;
  const controller = createRunController({ enableScreenshots: false,
    browser: {
      begin: async () => {}, close: async () => {}, open: async () => 'opened',
      observe: async () => ({ id: String(++observations), url: 'https://example.com', title: 'Dynamic',
        snapshot: observations === 1 ? 'Loading control' : `Current control ${actions}`, candidates: [{ ref: 'e1', label: 'button "Continue"' }] }),
      act: async () => { actions += 1; return 'clicked Continue'; },
    },
    planner: { plan: async ({ observation }) => {
      decisions += 1;
      if (decisions === 1) return { kind: 'click_item', target: 'e1', observationId: observation.id, confidence: 0.2 };
      if (actions < 12) return { kind: 'click_item', target: 'e1', observationId: observation.id, confidence: 1 };
      return { kind: 'done', observationId: observation.id, confidence: 1 };
    } },
    narrator: { acknowledge: async () => 'Started', summarize: async () => 'Finished' },
  });
  const run = controller.start({ goal: 'Complete a dynamic twelve-action flow' });
  await controller.settled(run.id);
  expect(run.status).toBe('complete');
  expect(actions).toBe(12);
  expect(decisions).toBe(14);
  expect(run.stepCount).toBe(14);
});

it('never executes a thirteenth browser action even when decision budget remains', async () => {
  let actions = 0, observations = 0;
  const controller = createRunController({ enableScreenshots: false,
    browser: {
      begin: async () => {}, close: async () => {}, open: async () => 'opened',
      observe: async () => ({ id: String(++observations), url: 'https://example.com', title: 'Bounded',
        snapshot: `State ${actions}`, candidates: [{ ref: 'e1', label: 'button "Continue"' }] }),
      act: async () => { actions += 1; return `clicked ${actions}`; },
    },
    planner: { plan: async ({ observation }) => ({ kind: 'click_item', target: 'e1', observationId: observation.id, confidence: 1 }) },
    narrator: { acknowledge: async () => 'Started', summarize: async () => 'Finished' },
  });
  const run = controller.start({ goal: 'Keep clicking' });
  await controller.settled(run.id);
  expect(run.status).toBe('error');
  expect(run.error).toMatch(/12-browser-action limit/);
  expect(actions).toBe(12);
  expect(run.stepCount).toBe(13);
});
