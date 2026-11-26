/**
 * Readable, localized OpenStreetMap opening hours.
 *
 * Only the common subset is translated: weekday ranges and lists, public holidays, time ranges, "off" and
 * "24/7". Anything else (months, comments, week numbers, sunrise…) returns null so the caller shows the
 * mapped text as it is. The rule for today can be named, but whether a pharmacy is open is never computed:
 * the data is unverified, and an "open now" would be a promise the map cannot keep.
 */
const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const day = '(?:Mo|Tu|We|Th|Fr|Sa|Su)';
const dayItem = `(?:${day}(?:-${day})?|PH)`;
const time = '(?:[01]\\d|2[0-4]):[0-5]\\d';
const span = `${time}-${time}`;
const rule = new RegExp(`^(?:(${dayItem}(?:,${dayItem})*)\\s+)?(${span}(?:,${span})*|off|closed)$`);

/** Short weekday names from the platform, so no translation table is needed (Mon, ma, mån…). */
function weekdayName(code, language) {
  const monday = Date.UTC(2024, 0, 1);
  const date = new Date(monday + weekdays.indexOf(code) * 86_400_000);
  return new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' }).format(date);
}

/** 24:00 is valid in opening hours but not in date formatters, so times are spelled out directly. */
function clock(value, language) {
  return language === 'fi' ? value.replace(':', '.') : value;
}

function formatDays(days, language, words) {
  return days
    .split(',')
    .map(item => {
      if (item === 'PH') return words.holidays;
      return item
        .split('-')
        .map(code => weekdayName(code, language))
        .join('–');
    })
    .join(', ');
}

function formatTimes(times, language, words) {
  if (times === 'off' || times === 'closed') return words.closed;
  return times
    .split(',')
    .map(range =>
      range
        .split('-')
        .map(value => clock(value, language))
        .join('–'),
    )
    .join(', ');
}

/** The rules of a value as [days, times] pairs, or null when any rule is outside the subset. */
function parseRules(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  // ";" separates rules; ", " before a weekday adds one (the comma inside "Mo,We" has no space).
  const rules = [];
  for (const part of text.split(/;|,\s+(?=Mo|Tu|We|Th|Fr|Sa|Su|PH)/)) {
    if (!part.trim()) continue;
    const match = rule.exec(part.trim());
    if (!match) return null;
    rules.push([match[1], match[2]]);
  }
  return rules;
}

/**
 * The rules of `value` in `language`, or null when the value uses syntax this module does not cover.
 * `words` holds the translated `daily`, `closed` and `holidays`.
 */
export function formatOpeningHours(value, language, words) {
  if (String(value ?? '').trim() === '24/7') return ['24/7'];
  return (
    parseRules(value)?.map(([days, times]) => {
      const when = days ? formatDays(days, language, words) : words.daily;
      return `${when} ${formatTimes(times, language, words)}`;
    }) ?? null
  );
}

/** The weekdays (0 for Monday … 6) and "PH" a day list covers; ranges may wrap, as in "Fr-Mo". */
function coveredDays(days) {
  const covered = new Set();
  for (const item of days.split(',')) {
    if (item === 'PH') {
      covered.add('PH');
      continue;
    }
    const [from, to = from] = item.split('-').map(code => weekdays.indexOf(code));
    for (let day = from; ; day = (day + 1) % 7) {
      covered.add(day);
      if (day === to) break;
    }
  }
  return covered;
}

/**
 * The index of the rule that applies `today` ({ weekday: 0 for Monday … 6, holiday }), or -1 when no rule
 * can be named: syntax outside the subset, no rule for the day, or a day off the value does not mention.
 * A later rule overrides an earlier one, as in OpenStreetMap.
 */
export function todaysRule(value, today) {
  if (String(value ?? '').trim() === '24/7') return 0;
  let found = -1;
  parseRules(value)?.forEach(([days, times], index) => {
    const covered = days ? coveredDays(days) : null;
    if (today.holiday ? covered?.has('PH') : !covered || covered.has(today.weekday)) found = index;
  });
  return found;
}
