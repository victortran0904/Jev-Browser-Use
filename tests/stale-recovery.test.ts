import { expect, it } from 'vitest';
import { createRunController } from '../server/runs.js';
import { StaleObservationError } from '../server/browser-errors.js';
import type { BrowserBoundary } from '../server/browser.js';

function fixture(error: Error) {
  let observations = 0, actions = 0;
  const browser: BrowserBoundary = {
    begin: async () => {}, close: async () => {}, open: async () => 'opened',
    observe: async () => ({ id: String(++observations), url: 'https://example.com', title: 'Details', snapshot: observations === 1 ? 'Open destination' : 'Destination ready', candidates: [{ ref: 'e1', label: 'Open destination' }] }),
    act: async () => { actions++; throw error; },
  };
  const controller = createRunController({ browser, enableScreenshots: false,
    planner: { plan: async ({ observation }) => ({ kind: observation.id === '1' ? 'click_item' : 'done', target: 'e1', observationId: observation.id, confidence: 1 }) },
    narrator: { acknowledge: async () => 'Started', summarize: async () => 'Finished' },
  });
  return { controller, counts: () => ({ observations, actions }) };
}

it('reobserves a proven pre-dispatch popup transition and makes a new decision without replaying the old action', async () => {
  const { controller, counts } = fixture(new StaleObservationError());
  const run = controller.start({ goal: 'Open destination' });
  await controller.settled(run.id);
  expect(run.status).toBe('complete');
  expect(counts()).toEqual({ observations: 2, actions: 1 });
  expect(run.events.some(event => event.type === 'state_refresh')).toBe(true);
});

it('never treats an ambiguous transport error mentioning stale state as safe to replay', async () => {
  const { controller, counts } = fixture(new Error('Outcome unknown after dispatch; stale transport response'));
  const run = controller.start({ goal: 'Open destination' });
  await controller.settled(run.id);
  expect(run.status).toBe('error');
  expect(counts()).toEqual({ observations: 1, actions: 1 });
  expect(run.events.some(event => event.type === 'state_refresh')).toBe(false);
});

it('limits safe re-observation to two refreshes without expanding the twelve-decision limit', async () => {
  let actions = 0;
  const controller = createRunController({ enableScreenshots: false,
    browser: {
      begin: async () => {}, close: async () => {}, open: async () => 'opened',
      observe: async () => ({ id: String(actions), url: 'https://example.com', title: '', snapshot: '', candidates: [{ ref: 'e1', label: 'Next' }] }),
      act: async () => { actions++; throw new StaleObservationError(); },
    },
    planner: { plan: async ({ observation }) => ({ kind: 'click_item', target: 'e1', observationId: observation.id, confidence: 1 }) },
    narrator: { acknowledge: async () => 'Started', summarize: async () => 'Finished' },
  });
  const run = controller.start({ goal: 'Show next page' });
  await controller.settled(run.id);
  expect(run.status).toBe('error');
  expect(run.error).toMatch(/Stale/);
  expect(actions).toBe(3);
  expect(run.stepCount).toBeLessThanOrEqual(12);
});

it('asks for a fresh decision when the model selects an unavailable placeholder target', async () => {
  const { createBrowserBoundary } = await import('../server/browser.js');
  const rejectingBoundary = createBrowserBoundary(async () => { throw Error('No browser command should be sent for an invalid target'); });
  let observations = 0;
  const controller = createRunController({ enableScreenshots: false,
    browser: {
      begin: async () => {}, close: async () => {}, open: async () => 'opened', act: rejectingBoundary.act,
      observe: async () => ({ id: String(++observations), url: 'https://example.com', title: 'Details', snapshot: observations === 1 ? 'Open destination' : 'Destination ready', candidates: [{ ref: 'e1', label: 'Next' }] }),
    },
    planner: { plan: async ({ observation }) => ({ kind: observation.id === '1' ? 'click_item' : 'done', target: 'no_item', observationId: observation.id, confidence: 0.8 }) },
    narrator: { acknowledge: async () => 'Started', summarize: async () => 'Finished' },
  });
  const run = controller.start({ goal: 'Open destination' });
  await controller.settled(run.id);
  expect(run.status).toBe('complete');
  expect(observations).toBe(2);
  expect(run.events.some(event => event.type === 'state_refresh')).toBe(true);
});
