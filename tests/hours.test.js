import test from 'node:test';
import assert from 'node:assert/strict';
import { formatOpeningHours as format, todaysRule } from '../src/hours.js';
import { messages } from '../src/strings.js';

const formatOpeningHours = (value, language) => format(value, language, messages[language].openingHours);

test('weekday ranges, times and closed days are localized', () => {
  const hours = 'Mo-Fr 09:00-20:00; Sa 10:00-19:00; Su off';
  assert.deepEqual(formatOpeningHours(hours, 'en'), ['Mon–Fri 09:00–20:00', 'Sat 10:00–19:00', 'Sun closed']);
  assert.deepEqual(formatOpeningHours(hours, 'fi'), ['ma–pe 09.00–20.00', 'la 10.00–19.00', 'su suljettu']);
  assert.deepEqual(formatOpeningHours(hours, 'sv'), ['mån–fre 09:00–20:00', 'lör 10:00–19:00', 'sön stängt']);
});

test('lists, split shifts, public holidays, every day and 24/7', () => {
  assert.deepEqual(formatOpeningHours('Mo,We 08:00-12:00,13:00-17:00', 'en'), [
    'Mon, Wed 08:00–12:00, 13:00–17:00',
  ]);
  assert.deepEqual(formatOpeningHours('Mo-Su 08:00-23:00; PH 12:00-18:00', 'fi'), [
    'ma–su 08.00–23.00',
    'Pyhäpäivät 12.00–18.00',
  ]);
  assert.deepEqual(formatOpeningHours('10:00-24:00', 'sv'), ['Dagligen 10:00–24:00']);
  assert.deepEqual(formatOpeningHours('24/7', 'fi'), ['24/7']);
});

test('syntax outside the common subset is left to the caller', () => {
  for (const value of [
    'Mo-Fr 09:00-18:00; Dec 24 off',
    'Mo-Fr 09:00-18:00 "by appointment"',
    'sunrise-sunset',
    'Mo-Fr 9-18',
    '',
    undefined,
  ]) {
    assert.equal(formatOpeningHours(value, 'en'), null, String(value));
  }
});

test('a comma and space before a weekday starts another rule', () => {
  assert.deepEqual(formatOpeningHours('Mo-Fr 08:30-19:00, Sa 09:00-16:00, Su closed', 'en'), [
    'Mon–Fri 08:30–19:00',
    'Sat 09:00–16:00',
    'Sun closed',
  ]);
  assert.deepEqual(formatOpeningHours('Su,PH off', 'en'), ['Sun, Public holidays closed']);
});

test('stray separators and spaces are tolerated', () => {
  assert.deepEqual(formatOpeningHours(' Mo-Fr 09:00-18:00 ; ', 'en'), ['Mon–Fri 09:00–18:00']);
});

test("today's rule follows the weekday, and a later rule overrides an earlier one", () => {
  const hours = 'Mo-Su 08:00-22:00; Sa 10:00-19:00; Su off; PH 12:00-16:00';
  const on = weekday => todaysRule(hours, { weekday, holiday: false });
  assert.deepEqual([0, 4, 5, 6].map(on), [0, 0, 1, 2]);
  assert.equal(todaysRule('Fr-Mo 10:00-14:00', { weekday: 0, holiday: false }), 0);
  assert.equal(todaysRule('Mo,We 08:00-12:00', { weekday: 1, holiday: false }), -1);
  assert.equal(todaysRule('10:00-20:00', { weekday: 2, holiday: false }), 0);
  assert.equal(todaysRule('24/7', { weekday: 6, holiday: true }), 0);
});

test('on a day off only a public-holiday rule is named', () => {
  assert.equal(todaysRule('Mo-Fr 09:00-18:00; PH off', { weekday: 0, holiday: true }), 1);
  assert.equal(todaysRule('Su,PH 12:00-16:00', { weekday: 2, holiday: true }), 0);
  // The value says nothing about holidays, so no rule is marked rather than a guess.
  assert.equal(todaysRule('Mo-Fr 09:00-18:00', { weekday: 0, holiday: true }), -1);
  assert.equal(todaysRule('10:00-20:00', { weekday: 0, holiday: true }), -1);
});

test('unsupported syntax names no rule for today', () => {
  assert.equal(todaysRule('Mo-Fr 9-18', { weekday: 0, holiday: false }), -1);
  assert.equal(todaysRule('', { weekday: 0, holiday: false }), -1);
  assert.equal(todaysRule(undefined, { weekday: 0, holiday: false }), -1);
});
