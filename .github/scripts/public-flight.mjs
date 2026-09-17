import assert from 'node:assert/strict';
import { createRunController } from '../../server/runs.ts';

export const flightPrompt = 'find me a flight from hanoi to vancouver in  december for less than 2,500$';
const hosts = new Set(['google.com', 'www.google.com', 'www.google.ca', 'google.ca', 'www.kayak.com', 'www.kayak.ca', 'www.skyscanner.com', 'www.skyscanner.ca', 'www.expedia.com', 'www.expedia.ca', 'www.trip.com', 'www.aircanada.com', 'www.vietnamairlines.com']);
const prohibited = /\b(book(?:ing)?|buy|purchase|pay(?:ment)?|checkout|reserve|sign.?in|log.?in|confirm.*(?:flight|ticket|reservation))\b/i;

export function flightEvidence(observation) {
  const text = observation?.pageText ?? observation?.snapshot ?? '';
  const prices = [...text.matchAll(/(?:CAD|CA\$|C\$|USD|US\$|\$)\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/g)]
    .map(match => Number(match[1].replaceAll(',', ''))).filter(value => Number.isFinite(value) && value > 0);
  return {
    originPresent: /\b(Hanoi|Hà Nội|HAN)\b/i.test(text),
    destinationPresent: /\b(Vancouver|YVR)\b/i.test(text),
    decemberPresent: /\b(December|Dec)\b|2026-12/.test(text),
    priceBelowLimitPresent: prices.some(price => price < 2500),
    blockedPage: /captcha|unusual traffic|verify you are human|access denied/i.test(text),
  };
}

/** Exploratory public-site task. Never buy, reserve, log in, or enter payment data. */
export async function runPublicFlight({ boundary, planner, writer, report }) {
  let plannerCalls = 0, writerCalls = 0;
  const trace = [];
  const safeBrowser = {
    begin: boundary.begin, observe: boundary.observe, close: boundary.close,
    open: (id, raw) => {
      const url = new URL(raw);
      assert(url.protocol === 'https:' && hosts.has(url.hostname), 'Flight test navigation outside approved public sites');
      return boundary.open(id, raw);
    },
    act: (id, action, observation) => {
      assert(hosts.has(new URL(observation.url).hostname), 'Flight test left approved public sites');
      const candidate = observation.candidates.find(item => item.ref === action.target);
      assert(!prohibited.test(candidate?.label ?? ''), 'Booking, payment and account actions are disabled');
      if (action.kind === 'press_enter') assert(observation.focusedField?.isText && !prohibited.test(observation.focusedField.label), 'Enter is limited to search text fields');
      if (action.kind === 'fill_item' || action.kind === 'type_text') {
        const field = action.kind === 'fill_item' ? candidate?.field : observation.focusedField;
        assert(field?.isText && !field.sensitive, 'Only safe search fields may be filled');
      }
      return boundary.act(id, action, observation);
    },
  };
  const controller = createRunController({
    browser: safeBrowser, enableScreenshots: false,
    planner: { plan: async input => {
      assert(++plannerCalls <= 12, 'Flight planner budget exceeded');
      const action = await planner.plan(input);
      trace.push({ step: plannerCalls, action: action.kind, candidates: input.observation.candidates.length, ...flightEvidence(input.observation) });
      return action;
    } },
    writer: {
      generateUrl: async input => { assert(++writerCalls <= 8, 'Flight writer budget exceeded'); return writer.generateUrl(input); },
      generateText: async input => { assert(++writerCalls <= 8, 'Flight writer budget exceeded'); return writer.generateText(input); },
    },
    narrator: { acknowledge: async () => 'Starting flight search test.', summarize: async () => 'Flight search test finished.' },
  });
  const run = controller.start({ goal: flightPrompt });
  const timer = setTimeout(() => controller.stop(run.id), 180_000);
  try {
    await controller.settled(run.id);
    const evidence = flightEvidence(run.observation);
    const last = run.events.filter(event => event.type === 'plan').at(-1)?.data?.kind;
    report.publicFlight = {
      prompt: flightPrompt, status: run.status, stopped: Boolean(run.stopped),
      plannerCalls, writerCalls, trace, ...evidence,
      outcome: 'Public-site exploration, not a booking or a verified fare quote',
      ...(run.error ? { failed: true, failureCategory: /TypeSafe/i.test(run.error) ? 'typesafe' : /Gemini/i.test(run.error) ? 'gemini' : /stale/i.test(run.error) ? 'stale-state' : /12-step/i.test(run.error) ? 'step-budget' : /budget/i.test(run.error) ? 'request-budget' : 'browser-or-policy' } : {}),
    };
    assert(!run.stopped, 'Flight test deadline exceeded');
    assert.equal(run.status, 'complete');
    assert.equal(last, 'done');
    assert(!evidence.blockedPage, 'Public site blocked automated browsing');
    assert(evidence.originPresent && evidence.destinationPresent && evidence.decemberPresent && evidence.priceBelowLimitPresent,
      'Flight search did not produce all required visible evidence');
    return { plannerCalls, writerCalls, ...evidence, notAConfirmedFareQuote: true };
  } finally {
    clearTimeout(timer);
    if (run.status === 'running') controller.stop(run.id);
    await boundary.close(run.id);
  }
}
