import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createBrowserBoundary } from '../server/browser.ts';
import { createRunController } from '../server/runs.ts';

export const flightPrompt = 'find me a flight from hanoi to vancouver in  december for less than 2,500$';
export async function testFlight({ planner, writer, classify, registerActive }) {
  const boundary = createBrowserBoundary();
  let finalObservation, planCount = 0, writerCount = 0;
  const report = {
    prompt: flightPrompt,
    assumptions: { month: '2026-12', currency: 'CAD', adults: 1, trip: 'one-way', maximumPriceExclusive: 2500 },
    scope: 'Live public-site search using the application; no booking or payment authorized',
    steps: [],
  };
  const browser = {
    begin: boundary.begin,
    observe: async (id, screenshotPath) => {
      const observation = await boundary.observe(id, screenshotPath);
      finalObservation = observation;
      return observation;
    },
    open: async (id, value) => {
      const url = new URL(value);
      assert(url.protocol === 'https:' && !url.username && !url.password, 'Public HTTPS navigation required');
      return boundary.open(id, value);
    },
    act: async (id, action, observation) => {
      const label = observation.candidates.find(c => c.ref === action.target)?.label ?? '';
      if (action.kind === 'click_item' && /\b(pay|purchase|checkout|confirm booking|sign in|log in)\b/i.test(label)) {
        throw new Error('Consequential action blocked in search-only test');
      }
      const start = performance.now();
      const result = await boundary.act(id, action, observation);
      report.steps.push({ kind: action.kind, durationMs: Math.round(performance.now() - start) });
      return result;
    },
    close: boundary.close,
  };
  const controller = createRunController({
    browser, enableScreenshots: false,
    planner: { plan: input => { if (++planCount > 12) throw new Error('Flight planner request budget exceeded'); return planner.plan(input); } },
    writer: {
      generateText: input => { if (++writerCount > 8) throw new Error('Flight writer request budget exceeded'); return writer.generateText(input); },
      generateUrl: input => { if (++writerCount > 8) throw new Error('Flight writer request budget exceeded'); return writer.generateUrl(input); },
    },
    narrator: { acknowledge: async () => 'Starting flight search test.', summarize: async () => 'Flight search test finished.' },
  });
  const goal = flightPrompt + '\nTest assumptions: December 2026, one adult, one-way, economy, budget CAD 2,500. Search public sites only. No booking, payment, login, or account creation. Respect site access restrictions and stop at a human-verification challenge. Stop only when a matching dated fare is visibly shown, not a generic route-price advertisement.';
  const run = controller.start({ goal });
  registerActive(controller, run);
  await controller.settled(run.id);
  const text = finalObservation?.pageText ?? finalObservation?.snapshot ?? '';
  const candidatePrices = [...text.matchAll(/(?:CAD|CA\$|C\$)\s*([0-9][0-9,]*(?:\.\d{2})?)/gi)].map(m => Number(m[1].replaceAll(',', ''))).filter(n => n > 0 && n < 2500);
  const evidence = {
    originVisible: /\bHanoi\b|\bHAN\b/i.test(text),
    destinationVisible: /\bVancouver\b|\bYVR\b/i.test(text),
    december2026Visible: /2026/.test(text) && /\bDec(?:ember)?\b|2026-12/i.test(text),
    qualifyingCadPriceVisible: candidatePrices.length > 0,
    challengeVisible: /captcha|unusual traffic|verify (?:you are|that you are) human/i.test(text),
  };
  const actions = run.events.filter(e => e.type === 'plan').map(e => e.data?.kind);
  let excerpt = text.slice(0, 12000);
  for (const key of [process.env.GEMINI_KEY, process.env.TYPESAFE_API_KEY].filter(Boolean)) excerpt = excerpt.replaceAll(key, '[redacted]');
  Object.assign(report, {
    status: run.status, plannerCalls: planCount, writerCalls: writerCount, actions, evidence,
    candidatePrices, requiresManualItineraryReview: true,
    // Fresh, unauthenticated public browsing only; no provider response bodies.
    publicPageExcerpt: excerpt,
    finalOrigin: (() => { try { return new URL(finalObservation?.url).origin; } catch { return ''; } })(),
    ...(run.error ? classify(new Error(run.error)) : {}),
  });
  await mkdir('.ci-results', { recursive: true });
  await writeFile('.ci-results/flight.json', JSON.stringify(report, null, 2));
  assert(!evidence.challengeVisible, 'Public flight site requires human verification');
  assert.equal(run.status, 'complete', 'Flight browsing did not complete');
  assert.equal(actions.at(-1), 'done', 'Flight task did not reach evidenced completion');
  assert(evidence.originVisible && evidence.destinationVisible && evidence.december2026Visible && evidence.qualifyingCadPriceVisible, 'No matching dated CAD fare evidence in final page');
  return { plannerCalls: planCount, writerCalls: writerCount, searchEvidencePresent: true, requiresManualItineraryReview: true };
}
