/**
 * Readable, localized OpenStreetMap opening hours.
 *
 * Only the common subset is translated: weekday ranges and lists, public holidays, time ranges, "off" and
 * "24/7". Anything else (months, comments, week numbers, sunrise…) returns null so the caller shows the
 * mapped text as it is. No rule is evaluated against today's date: the data is unverified, and a computed
 * "open now" would be wrong on public holidays.
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

/**
 * The rules of `value` in `language`, or null when the value uses syntax this module does not cover.
 * `words` holds the translated `daily`, `closed` and `holidays`.
 */
export function formatOpeningHours(value, language, words) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (text === '24/7') return ['24/7'];

  // ";" separates rules; ", " before a weekday adds one (the comma inside "Mo,We" has no space).
  const rules = text
    .split(/;|,\s+(?=Mo|Tu|We|Th|Fr|Sa|Su|PH)/)
    .map(part => part.trim())
    .filter(Boolean);
  const formatted = [];
  for (const part of rules) {
    const match = rule.exec(part);
    if (!match) return null;
    const [, days, times] = match;
    const when = days ? formatDays(days, language, words) : words.daily;
    formatted.push(`${when} ${formatTimes(times, language, words)}`);
  }
  return formatted;
}
