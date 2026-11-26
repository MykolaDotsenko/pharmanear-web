import test from 'node:test';
import assert from 'node:assert/strict';
import { finnishToday, isFinnishHoliday } from '../src/holidays.js';

test('fixed and Easter-based Finnish holidays', () => {
  for (const [year, month, day] of [
    [2026, 1, 1],
    [2026, 1, 6],
    [2026, 4, 3], // Good Friday
    [2026, 4, 5], // Easter Sunday
    [2026, 4, 6], // Easter Monday
    [2026, 5, 1],
    [2026, 5, 14], // Ascension Day
    [2026, 5, 24], // Whit Sunday
    [2026, 12, 6],
    [2026, 12, 24],
    [2026, 12, 25],
    [2026, 12, 26],
    [2027, 3, 26], // Good Friday, Easter in March
    [2027, 3, 29], // Easter Monday
  ]) {
    assert.equal(isFinnishHoliday(year, month, day), true, `${year}-${month}-${day}`);
  }
});

test('Midsummer and All Saints move with the weekday', () => {
  assert.equal(isFinnishHoliday(2026, 6, 19), true); // Midsummer Eve, Friday
  assert.equal(isFinnishHoliday(2026, 6, 20), true); // Midsummer Day, Saturday
  assert.equal(isFinnishHoliday(2026, 6, 26), false); // the next Friday
  assert.equal(isFinnishHoliday(2026, 6, 27), false); // the next Saturday
  assert.equal(isFinnishHoliday(2026, 10, 31), true); // All Saints' Day, Saturday
  assert.equal(isFinnishHoliday(2025, 11, 1), true);
  assert.equal(isFinnishHoliday(2026, 11, 7), false);
});

test('ordinary days are not holidays', () => {
  for (const [month, day] of [
    [4, 7],
    [5, 2],
    [11, 26],
    [12, 23],
    [12, 27],
  ]) {
    assert.equal(isFinnishHoliday(2026, month, day), false, `2026-${month}-${day}`);
  }
});

test('today is read in Helsinki time', () => {
  // 22:30 UTC on Thursday 26 November is already Friday in Helsinki.
  assert.deepEqual(finnishToday(new Date('2026-11-26T22:30:00Z')), { weekday: 4, holiday: false });
  // Independence Day starts at midnight Helsinki time, on a Sunday in 2026.
  assert.deepEqual(finnishToday(new Date('2026-12-05T22:30:00Z')), { weekday: 6, holiday: true });
  assert.deepEqual(finnishToday(new Date('2026-12-05T21:30:00Z')), { weekday: 5, holiday: false });
});
