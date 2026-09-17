import test from 'node:test';
import assert from 'node:assert/strict';
import { runPublicFlight } from '../.github/scripts/public-flight.mjs';

test('public flight failures preserve low-confidence diagnosis without recording raw errors', async () => {
  const report = {};
  const boundary = {
    begin: async () => {}, close: async () => {},
    observe: async () => ({ id: 'test', url: 'about:blank', title: '', snapshot: '', candidates: [] }),
  };
  const planner = { plan: async ({ observation }) => ({ kind: 'none', confidence: 0.1, observationId: observation.id }) };
  const writer = { generateUrl: async () => { throw Error('Unexpected writer call'); }, generateText: async () => { throw Error('Unexpected writer call'); } };
  await assert.rejects(runPublicFlight({ boundary, planner, writer, report }));
  assert.equal(report.publicFlight.failureCategory, 'low-confidence');
  assert.equal(report.publicFlight.trace[0].confidence, 0.1);
  assert.equal(Object.hasOwn(report.publicFlight, 'error'), false);
});
