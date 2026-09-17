import test from 'node:test';
import assert from 'node:assert/strict';
import {flightEvidence} from '../.github/scripts/public-flight.mjs';

test('an unrelated cheap price is not evidence of a matching dated flight', () => {
  const evidence = flightEvidence({pageText: 'Hanoi to Vancouver in December 2026\nHotel promotion CAD 99 per night'});
  assert.equal(evidence.priceBelowLimitPresent, false);
});

test('dated explicitly denominated itinerary evidence is accepted but vague prices are not', () => {
  assert.equal(flightEvidence({pageText:'Hanoi HAN to Vancouver YVR | December 8, 2026 | CAD 2200'}).priceBelowLimitPresent, true);
  assert.equal(flightEvidence({pageText:'Hanoi HAN to Vancouver YVR | December | CAD 2200'}).priceBelowLimitPresent, false);
  assert.equal(flightEvidence({pageText:'Hanoi HAN to Vancouver YVR | December 8, 2026 | USD 2200'}).priceBelowLimitPresent, false);
  assert.equal(flightEvidence({pageText:'Hanoi HAN to Vancouver YVR | December 8, 2026 | CAD 2500'}).priceBelowLimitPresent, false);
});
