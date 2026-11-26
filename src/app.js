import { mapsUrl, embedUrl } from './core.js';
import { messages, preferredLanguage } from './strings.js';
import { createSearchController } from './search-controller.js';
import { lookupPharmacies } from './catalog.js';

const $ = id => document.getElementById(id);
const initialLimit = 5;
const maximumShown = 20;

let lang = preferredLanguage(navigator.languages);
let expanded = false;
let selected = null;
const tr = key => messages[lang][key];

const controller = createSearchController({
  lookup: lookupPharmacies,
  geolocation: navigator.geolocation,
  onChange(next) {
    const wasBusy = state.busy;
    state = next;
    if (next.busy) {
      expanded = false;
      closeMap();
    }
    render();
    if (wasBusy && next.status === 'found' && matchMedia('(max-width: 760px)').matches) {
      // Keep keyboard focus with the control the user activated.
      if (!document.activeElement?.matches(':focus-visible')) {
        const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        $('results-heading').scrollIntoView({
          block: 'start',
          behavior: reduceMotion ? 'instant' : 'smooth',
        });
      }
    }
  },
});
let state = controller.state;

function setText(labels) {
  for (const [id, key] of Object.entries(labels)) $(id).textContent = tr(key);
}

function renderDocument() {
  document.documentElement.lang = lang;
  document.title = tr('title');
  document.querySelector('meta[name="description"]').content = tr('description');
  document.querySelector('.skip').textContent = tr('skip');
  $('language').value = lang;
  for (const option of $('city').options) option.textContent = tr('cities')[option.value];
}

function renderControls() {
  const { status, result, busy } = state;
  const failed = ['error', 'denied', 'empty'].includes(status);
  const found = status === 'found';

  setText({
    'language-label': 'language',
    eyebrow: 'eyebrow',
    heading: 'heading',
    intro: 'intro',
    'locate-label': 'locate',
    'privacy-summary': 'privacySummary',
    privacy: 'privacy',
    'city-label': 'city',
    'search-label': 'search',
    'results-heading': 'results',
    cancel: 'cancel',
    retry: 'retry',
    'fallback-directory': 'fallback',
    'result-details-label': 'resultDetails',
    'distance-note': 'distanceNote',
    'change-location': 'changeLocation',
    directory: 'directory',
    disclaimer: 'disclaimer',
  });

  document.body.dataset.searchState = status;
  document.body.toggleAttribute('data-outcome', found || failed);
  document.querySelector('.results').dataset.state = status;
  $('loading-art').hidden = !busy;
  $('cancel').hidden = !busy;
  $('recovery').hidden = !failed;
  $('directory').parentElement.hidden = failed;
  $('retry').hidden = !state.canRetry || status === 'denied' || status === 'empty';
  $('result-details').hidden = !found;
  $('result-tools').hidden = !found;

  const showAll = $('show-all');
  showAll.hidden = !found || result.results.length <= initialLimit;
  showAll.textContent = tr(expanded ? 'showLess' : 'showAll');
  showAll.setAttribute('aria-expanded', String(expanded));
}

function renderMapLabels() {
  $('close-map').textContent = tr('closeMap');
  $('map-privacy').textContent = tr('mapPrivacy');
  $('map-disclosure').textContent = tr('mapPrivacy');
  if (!selected) return;

  const title = `${tr('mapTitle')} ${selected.name || tr('unnamed')}`;
  $('map-heading').textContent = title;
  const frame = $('map-frame').querySelector('iframe');
  if (frame) frame.title = title;
}

function closeMap(restoreFocus = false) {
  const id = selected?.id;
  selected = null;
  $('map-panel').hidden = true;
  $('map-frame').replaceChildren();
  if (restoreFocus && id) {
    [...document.querySelectorAll('[data-map-id]')].find(button => button.dataset.mapId === id)?.focus();
  }
}

function openMap(pharmacy) {
  selected = pharmacy;
  const frame = document.createElement('iframe');
  frame.src = embedUrl(pharmacy);
  frame.referrerPolicy = 'no-referrer';
  $('map-frame').replaceChildren(frame);
  $('map-panel').hidden = false;
  renderMapLabels();
  $('map-heading').focus();
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function distanceText(meters) {
  const short = meters < 1000;
  return new Intl.NumberFormat(lang, {
    style: 'unit',
    unit: short ? 'meter' : 'kilometer',
    maximumFractionDigits: short ? 0 : 1,
  }).format(short ? meters : meters / 1000);
}

function hoursLine(pharmacy) {
  const hours = element('p', 'hours');
  if (!pharmacy.hours) {
    hours.textContent = tr('missingHours');
    return hours;
  }
  const readable = pharmacy.hours
    .split(';')
    .map(part => part.trim())
    .join(' · ');
  hours.append(element('span', 'hours-label', tr('hours')), element('span', 'hours-value', readable));
  return hours;
}

function pharmacyRow(pharmacy, index) {
  const name = pharmacy.name || tr('unnamed');
  const row = element('li', index === 0 ? 'pharmacy closest' : 'pharmacy');

  const rank = element('span', 'rank', String(index + 1).padStart(2, '0'));
  rank.setAttribute('aria-hidden', 'true');

  const info = element('div', 'pharmacy-info');
  if (index === 0) info.append(element('p', 'closest-label', tr('nearest')));
  info.append(element('h3', '', name));
  if (pharmacy.address) info.append(element('p', '', pharmacy.address));
  info.append(hoursLine(pharmacy));

  const preview = element('button', 'map-preview', tr('mapHere'));
  preview.type = 'button';
  preview.dataset.mapId = pharmacy.id;
  preview.setAttribute('aria-label', `${tr('mapHere')}: ${name}`);
  preview.setAttribute('aria-describedby', 'map-disclosure');
  preview.addEventListener('click', () => openMap(pharmacy));

  const link = element('a', '', tr('map'));
  link.href = mapsUrl(pharmacy);
  link.rel = 'noreferrer';
  link.setAttribute('aria-label', `${tr('map')}: ${name}`);

  const action = element('div', 'pharmacy-action');
  action.append(element('span', 'distance', distanceText(pharmacy.distance)), preview, link);
  row.append(rank, info, action);
  return row;
}

function renderResults() {
  const { status, result, origin, busy } = state;
  const list = $('list');
  list.setAttribute('aria-busy', String(busy));
  list.setAttribute('aria-label', tr('results'));
  list.replaceChildren();

  if (status !== 'found') {
    $('status').textContent = tr(status);
    return;
  }

  const place = origin === 'device' ? tr('device') : tr('cities')[origin];
  const count = result.results.length;
  const noun = tr('resultCount')[new Intl.PluralRules(lang).select(count)] ?? tr('resultCount').other;
  $('status').textContent = `${count} ${noun} · ${place}`;
  const notes =
    result.source === 'catalog'
      ? [`${tr('catalogDate')}: ${result.sourceDate.slice(0, 10)}`, tr('catalogScope')]
      : [result.covered ? '' : tr('limited')];
  if (result.results.length > maximumShown) notes.push(tr('shown'));
  $('source-note').textContent = notes.filter(Boolean).join(' ');

  const visible = result.results.slice(0, expanded ? maximumShown : initialLimit);
  list.append(...visible.map(pharmacyRow));
}

function render() {
  renderDocument();
  renderControls();
  renderMapLabels();
  renderResults();
}

function isChristmasSeason(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return (month === 11 && day >= 25) || month === 12 || (month === 1 && day <= 6);
}

$('locate').addEventListener('click', () => controller.locate());
$('city-form').addEventListener('submit', event => {
  event.preventDefault();
  controller.city($('city').value);
});
$('retry').addEventListener('click', () => controller.retry());
$('cancel').addEventListener('click', () => {
  controller.cancel();
  $('locate').focus();
});
$('close-map').addEventListener('click', () => closeMap(true));
$('show-all').addEventListener('click', () => {
  expanded = !expanded;
  closeMap();
  render();
  $('show-all').focus();
});
$('change-location').addEventListener('click', event => {
  event.preventDefault();
  $('locate').focus();
});
$('language').addEventListener('change', event => {
  lang = event.target.value;
  render();
});

if (isChristmasSeason(new Date())) document.body.dataset.season = 'christmas';
render();
