import { formatDistance, mapsUrl } from './core.js';
import { reviewedDetails, possibleDuplicate } from './pharmacy-details.js';
import { formatOpeningHours, todaysRule } from './hours.js';

/** Creates an element with an optional class and text. */
export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Localized rules when the mapped value is simple enough, with today's rule marked; otherwise the mapped
 * rules as they are. Nothing says whether the pharmacy is open: the hours are unverified.
 */
function hoursLine(pharmacy, { today, checked, lang, tr }) {
  const hours = element('p', 'hours');
  if (!pharmacy.hours) {
    hours.textContent = tr('missingHours');
    hours.classList.add('hours-missing');
    return hours;
  }
  const rules =
    formatOpeningHours(pharmacy.hours, lang, tr('openingHours')) ??
    pharmacy.hours
      .split(';')
      .map(part => part.trim())
      .filter(Boolean);
  const current = todaysRule(pharmacy.hours, today);
  // The separator stays with the rule before it, so a wrapped line never starts with "·".
  const value = element('span', 'hours-value');
  rules.forEach((rule, index) => {
    const last = index === rules.length - 1;
    const item = element('span', index === current ? 'hours-rule today' : 'hours-rule', rule);
    if (index === current) item.append(' ', element('span', 'today-tag', tr('today')));
    if (!last) item.append(' ·');
    value.append(item);
    if (!last) value.append(' ');
  });
  // Only hours that match a recently checked source drop the "unverified" qualifier.
  hours.append(element('span', 'hours-label', tr(checked ? 'hoursChecked' : 'hours')), value);
  return hours;
}

/** A compact row action whose accessible name carries the pharmacy, because every row repeats it. */
function action(tag, label, name) {
  const node = element(tag, tag === 'button' ? 'map-preview' : '', label);
  if (tag === 'button') node.type = 'button';
  node.setAttribute('aria-label', `${label}: ${name}`);
  return node;
}

/**
 * One result: rank, name, address, mapped hours with today's rule, their source, the distance, and the map
 * preview, radar and OpenStreetMap actions.
 *
 * `index` is the row's rank, `entrance` its place among the rows arriving now (negative for a row already on
 * screen), `results` the whole result set (to recognise a duplicate entry), and `today` Finnish today.
 * `onMap` and `onRadar` open the row's map and radar; `radarOpen` says whether this row's radar is open.
 */
export function pharmacyRow(pharmacy, context) {
  const { index, entrance, today, results, lang, tr, radarOpen, onMap, onRadar } = context;
  const review = reviewedDetails(pharmacy);
  const name = pharmacy.name || tr('unnamed');
  const row = element('li', index === 0 ? 'pharmacy closest' : 'pharmacy');
  if (entrance >= 0) {
    row.classList.add('arriving');
    row.style.setProperty('--i', String(entrance));
  }

  const rank = element('span', 'rank', String(index + 1).padStart(2, '0'));
  rank.setAttribute('aria-hidden', 'true');

  const info = element('div', 'pharmacy-info');
  if (index === 0) info.append(element('p', 'closest-label', tr('nearest')));
  info.append(element('h3', '', name));
  const address = review?.address || pharmacy.address;
  if (address) info.append(element('p', '', address));
  else if (pharmacy.name) info.append(element('p', 'missing-detail', tr('missingAddress')));
  if (!pharmacy.name) {
    const message = possibleDuplicate(pharmacy, results) ? tr('possibleDuplicate') : tr('incompleteEntry');
    info.append(element('p', 'missing-detail', message));
  }
  info.append(hoursLine(pharmacy, { today, checked: review?.checked, lang, tr }));
  const sourceLink = (text, href) => {
    const source = action('a', text, name);
    source.className = 'hours-source';
    source.href = href;
    source.rel = 'noreferrer';
    info.append(source);
  };
  if (review) {
    const date =
      review.checked &&
      new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date(review.checked),
      );
    sourceLink(date ? `${tr('sourceChecked')} ${date}` : tr('sourceLink'), review.url);
  } else if (!pharmacy.hours) {
    sourceLink(tr('checkHours'), 'https://www.apteekki.fi/apteekkihaku');
  }

  const preview = action('button', tr('mapHere'), name);
  preview.dataset.mapId = pharmacy.id;
  preview.setAttribute('aria-describedby', 'map-disclosure');
  preview.addEventListener('click', () => onMap(pharmacy));

  const radar = action('button', tr('radarHere'), name);
  radar.dataset.radarId = pharmacy.id;
  radar.setAttribute('aria-expanded', String(radarOpen));
  radar.addEventListener('click', () => onRadar(pharmacy));

  // A short visible label keeps three actions on one line on phones; the accessible name says it all.
  const link = element('a', '', tr('mapShort'));
  link.href = mapsUrl(pharmacy);
  link.rel = 'noreferrer';
  link.setAttribute('aria-label', `${tr('map')}: ${name}`);

  const actions = element('div', 'pharmacy-action');
  actions.append(preview, radar, link);
  row.append(rank, info, element('span', 'distance', formatDistance(pharmacy.distance, lang)), actions);
  return row;
}
