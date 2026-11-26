/**
 * Today in Finland, for marking which mapped opening-hours rule applies. Days off are the public holidays
 * plus Midsummer Eve and Christmas Eve, which are not statutory but on which shops keep holiday hours, as
 * OpenStreetMap's "PH" is commonly read in Finland.
 */

/** Easter Sunday in the Gregorian calendar (the anonymous Gregorian algorithm), as [month, day]. */
function easter(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}

const fixed = new Set(['1-1', '1-6', '5-1', '12-6', '12-24', '12-25', '12-26']);
// Days after Easter Sunday: Good Friday, Easter Sunday and Monday, Ascension Day, Whit Sunday.
const easterOffsets = new Set([-2, 0, 1, 39, 49]);

/** Whether the Finnish calendar date (month 1–12) is a public holiday or a customary day off. */
export function isFinnishHoliday(year, month, day) {
  if (fixed.has(`${month}-${day}`)) return true;
  const date = Date.UTC(year, month - 1, day);
  const [easterMonth, easterDay] = easter(year);
  if (easterOffsets.has(Math.round((date - Date.UTC(year, easterMonth - 1, easterDay)) / 86_400_000))) {
    return true;
  }
  const weekday = new Date(date).getUTCDay();
  // Midsummer Eve and Day: the Friday and Saturday between 19 and 26 June.
  if (
    month === 6 &&
    ((weekday === 5 && day >= 19 && day <= 25) || (weekday === 6 && day >= 20 && day <= 26))
  ) {
    return true;
  }
  // All Saints' Day: the Saturday between 31 October and 6 November.
  return weekday === 6 && ((month === 10 && day === 31) || (month === 11 && day <= 6));
}

const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const helsinki = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Helsinki',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
});

/** Today's weekday in Finland (0 for Monday … 6 for Sunday) and whether it is a day off. */
export function finnishToday(now = new Date()) {
  const parts = Object.fromEntries(helsinki.formatToParts(now).map(({ type, value }) => [type, value]));
  return {
    weekday: weekdayNames.indexOf(parts.weekday),
    holiday: isFinnishHoliday(Number(parts.year), Number(parts.month), Number(parts.day)),
  };
}
