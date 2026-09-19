import assert from 'node:assert/strict';
import { createRunController } from '../../server/runs.ts';
import { failureCategory } from '../../integration/trace.mjs';

export const flightPrompt = 'find me a flight from hanoi to vancouver in  december for less than 2,500$';
const flightTaskGoal = `${flightPrompt}\nTest interpretation: use a December 2026 departure, one-way economy for one adult, and evaluate prices in CAD. Do not invent a return date.`;
const hosts = new Set(['google.com', 'www.google.com', 'www.google.ca', 'google.ca', 'www.kayak.com', 'www.kayak.ca', 'www.skyscanner.com', 'www.skyscanner.ca', 'www.expedia.com', 'www.expedia.ca', 'www.trip.com', 'www.aircanada.com', 'www.vietnamairlines.com']);
const prohibited = /\b(book(?:ing)?|buy|purchase|pay(?:ment)?|checkout|reserve|sign.?in|log.?in|confirm.*(?:flight|ticket|reservation))\b/i;

export function flightEvidence(observation) {
  const text = observation?.pageText ?? observation?.snapshot ?? '';
  const controls = (observation?.candidates ?? []).map(item =>
    [item.label, item.field?.label, item.field?.value].filter(Boolean).join(' ')).join('\n');
  const state = text + '\n' + controls;
  const origin = /\b(Hanoi|Hà Nội|HAN)\b/i;
  const destination = /\b(Vancouver|YVR)\b/i;
  const datedDecember = /\b(?:December|Dec)\.?\s+(?:[1-9]|[12]\d|3[01]),?\s+2026\b|\b2026-12-(?:0[1-9]|[12]\d|3[01])\b/i;
  const originPresent = origin.test(state);
  const destinationPresent = destination.test(state);
  const decemberPresent = datedDecember.test(state);
  const matchingLine = text.split("\n").find(line => {
    if (!origin.test(line) || !destination.test(line) || !datedDecember.test(line)) return false;
    const fare = line.match(/(?:CAD\s*\$?|CA\$|C\$)\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/);
    const amount = fare ? Number(fare[1].replaceAll(',', '')) : NaN;
    return amount > 0 && amount < 2500 && !/hotel|per night|budget|maximum|example|test data|fixture|baggage|bag fee|seat selection|insurance|ancillary|optional charge/i.test(line);
  });
  const resultContext = /search results|top flights|other flights|prices include required taxes|select flight/i.test(text)
    || /\/travel\/flights\/search/.test(observation?.url ?? '');
  const qualifyingFare = text.split("\n").some(line => {
    if (/hotel|per night|budget|maximum|example|test data|fixture|baggage|bag fee|seat selection|insurance|ancillary|optional charge/i.test(line)) return false;
    const fare = line.match(/(?:CAD\s*\$?|CA\$|C\$)\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/);
    const amount = fare ? Number(fare[1].replaceAll(',', '')) : NaN;
    return amount > 0 && amount < 2500;
  });
  return {
    originPresent, destinationPresent, decemberPresent,
    priceBelowLimitPresent: Boolean(matchingLine) || Boolean(resultContext && originPresent && destinationPresent && decemberPresent && qualifyingFare),
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
      assert(++plannerCalls <= 24, 'Flight planner budget exceeded');
      const action = await planner.plan(input);
      trace.push({
        step: plannerCalls, action: action.kind,
        confidence: Number.isFinite(action.confidence) ? action.confidence : null,
        candidates: input.observation.candidates.length,
        targetIndex: input.observation.candidates.findIndex(item => item.ref === action.target),
        optionCount: input.observation.candidates.filter(item => /^option\b/.test(item.label)).length,
        editableFieldCount: input.observation.candidates.filter(item => item.field?.isText).length,
        nonemptyFieldCount: input.observation.candidates.filter(item => item.field?.value).length,
        focusedFieldNonempty: Boolean(input.observation.focusedField?.value),
        ...flightEvidence(input.observation),
      });
      return action;
    } },
    writer: {
      generateUrl: async input => { assert(++writerCalls <= 8, 'Flight writer budget exceeded'); return writer.generateUrl(input); },
      generateText: async input => { assert(++writerCalls <= 8, 'Flight writer budget exceeded'); return writer.generateText(input); },
    },
    narrator: { acknowledge: async () => 'Starting flight search test.', summarize: async () => 'Flight search test finished.' },
  });
  const run = controller.start({ goal: flightTaskGoal });
  const timer = setTimeout(() => controller.stop(run.id), 180_000);
  try {
    await controller.settled(run.id);
    const evidence = flightEvidence(run.observation);
    const last = run.events.filter(event => event.type === 'plan').at(-1)?.data?.kind;
    report.publicFlight = {
      prompt: flightPrompt, acceptanceAssumptions: {month: "2026-12", currency: "CAD", oneWay: true, adults: 1}, status: run.status, stopped: Boolean(run.stopped),
      plannerCalls, writerCalls, trace, ...evidence,
      outcome: 'Public-site exploration, not a booking or a verified fare quote',
      ...(run.error ? { failed: true, failureCategory: failureCategory(run.error) } : {}),
    };
    if (run.error) throw new Error(run.error);
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
