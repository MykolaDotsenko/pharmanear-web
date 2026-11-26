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

test('reviewed evidence supplies missing address and dated matching hours only', () => {
  const review = reviewedDetails(citycenter);
  assert.equal(review.address, 'Kaivokatu 8, Helsinki');
  assert.equal(review.checked, '2026-11-26');
  assert.equal(reviewedDetails({ ...citycenter, hours: '24/7' }).checked, null);
  assert.equal(reviewedDetails({ ...citycenter, name: 'Other pharmacy' }), null);
  assert.equal(reviewedDetails({ ...citycenter, lat: 60.18 }), null);
});

test('ambiguous nearby blank records are flagged, not discarded', () => {
  const blank = { id: 'node/12976930478', name: '', address: '', hours: '', lat: 60.170065, lon: 24.941644 };
  assert.equal(possibleDuplicate(blank, [citycenter, blank]), true);
  assert.equal(possibleDuplicate({ ...blank, name: 'Different pharmacy' }, [citycenter]), false);
  assert.equal(possibleDuplicate({ ...blank, lat: 60.18 }, [citycenter]), false);
  assert.equal(possibleDuplicate(blank, [blank]), false);
});
