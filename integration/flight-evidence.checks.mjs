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

test('accepts a verified Google Flights result when route/date controls and fare are rendered separately', () => {
  const evidence = flightEvidence({
    url: 'https://www.google.com/travel/flights/search?tfs=opaque',
    pageText: 'Search results\n9 results returned.\nTop flights\nCA$548\nTrack prices from Hanoi to Vancouver departing 2026-12-08',
    candidates: [
      {ref:'e1', label:'combobox "One way"'},
      {ref:'e2', label:'combobox "Where from?"', field:{label:'Where from?', value:'Hanoi', isText:true}},
      {ref:'e3', label:'combobox "Where to?"', field:{label:'Where to?', value:'Vancouver', isText:true}},
      {ref:'e4', label:'textbox "Departure"', field:{label:'Departure', value:'Tue, Dec 8', isText:true}},
    ],
  });
  assert.deepEqual(
    [evidence.originPresent, evidence.destinationPresent, evidence.decemberPresent, evidence.priceBelowLimitPresent],
    [true, true, true, true],
  );
});

test('does not treat ancillary fees on a matching results page as the flight fare', () => {
  const evidence = flightEvidence({
    url: 'https://www.google.com/travel/flights/search?tfs=opaque',
    pageText: 'Search results\nTrack prices from Hanoi to Vancouver departing 2026-12-08\nChecked baggage CA$60\nSeat selection CA$35',
    candidates: [
      {ref:'e1', label:'combobox "Where from?"', field:{label:'Where from?', value:'Hanoi', isText:true}},
      {ref:'e2', label:'combobox "Where to?"', field:{label:'Where to?', value:'Vancouver', isText:true}},
      {ref:'e3', label:'textbox "Departure"', field:{label:'Departure', value:'Tue, Dec 8', isText:true}},
    ],
  });
  assert.equal(evidence.priceBelowLimitPresent, false);
});
