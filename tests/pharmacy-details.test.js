import test from 'node:test';
import assert from 'node:assert/strict';
import { possibleDuplicate, reviewedDetails } from '../src/pharmacy-details.js';

const citycenter = {
  id: 'node/11771777459',
  name: 'Apteekki CityCenter',
  lat: 60.170001,
  lon: 24.941615,
  address: '',
  hours: 'Mo-Fr 08:00-19:00; Sa 10:00-17:00; Su off',
};

const soon = Date.parse('2026-12-10T12:00:00Z');

test('reviewed evidence supplies missing address and dated matching hours only', () => {
  const review = reviewedDetails(citycenter, soon);
  assert.equal(review.address, 'Kaivokatu 8, Helsinki');
  assert.equal(review.checked, '2026-11-26');
  assert.equal(reviewedDetails({ ...citycenter, hours: '24/7' }, soon).checked, null);
  assert.equal(reviewedDetails({ ...citycenter, name: 'Other pharmacy' }, soon), null);
  assert.equal(reviewedDetails({ ...citycenter, lat: 60.18 }, soon), null);
});

test('an old check keeps the source link but no longer vouches for the hours', () => {
  const later = Date.parse('2027-03-01T12:00:00Z');
  const review = reviewedDetails(citycenter, later);
  assert.equal(review.checked, null);
  assert.match(review.url, /^https:\/\//);
  // A clock before the review date is treated as unknown, not as fresh.
  assert.equal(reviewedDetails(citycenter, Date.parse('2026-11-01T00:00:00Z')).checked, null);
});

test('ambiguous nearby blank records are flagged, not discarded', () => {
  const blank = { id: 'node/12976930478', name: '', address: '', hours: '', lat: 60.170065, lon: 24.941644 };
  assert.equal(possibleDuplicate(blank, [citycenter, blank]), true);
  assert.equal(possibleDuplicate({ ...blank, name: 'Different pharmacy' }, [citycenter]), false);
  assert.equal(possibleDuplicate({ ...blank, lat: 60.18 }, [citycenter]), false);
  assert.equal(possibleDuplicate(blank, [blank]), false);
});
