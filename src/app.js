import {mapsUrl, embedUrl} from './core.js';
import {strings, extra, ux} from './strings.js';
import {createSearchController} from './search-controller.js';
import {fetchPharmacies} from './provider.js';

const $ = id => document.getElementById(id);
let lang = 'en';
let expanded = false;
let selected = null;
const initialLimit = 5;
const tr = key => strings[lang][key] ?? extra[lang][key];
const controller = createSearchController({
  fetcher: fetchPharmacies,
  geolocation: navigator.geolocation,
  onChange(next) {
    state = next;
    if (next.busy) { expanded = false; closeMap(); }
    render();
  },
});
let state = controller.state;

function renderUX() {
  const { status, result } = state;
  const copy = ux[lang];
  const labels = {
    'privacy-summary': 'privacySummary',
    retry: 'retry',
    'fallback-directory': 'fallback',
    'distance-note': 'distanceNote',
    'change-location': 'changeLocation',
  };
  for (const [id, key] of Object.entries(labels)) $(id).textContent = copy[key];

  const failed = ['error', 'denied', 'empty'].includes(status);
  const found = status === 'found';
  $('recovery').hidden = !failed;
  $('directory').parentElement.hidden = failed;
  $('retry').hidden = !state.canRetry || status === 'denied' || status === 'empty';
  $('distance-note').hidden = !found;
  $('result-tools').hidden = !found;
  $('show-all').hidden = !found || result.results.length <= initialLimit;
  $('show-all').textContent = expanded ? copy.showLess : copy.showAll;
  $('show-all').setAttribute('aria-expanded', String(expanded));
  $('show-all').setAttribute('aria-controls', 'list');
  document.body.dataset.searchState = status;
}

function closeMap(restore = false) {
  const id = selected?.id;
  selected = null;
  $('map-panel').hidden = true;
  $('map-frame').replaceChildren();
  if (restore && id) {
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
  updateMapLabels();
  $('map-heading').focus();
}

function updateMapLabels() {
  $('close-map').textContent = tr('closeMap');
  $('map-privacy').textContent = tr('mapPrivacy');
  $('directory').textContent = tr('directory');
  $('map-disclosure').textContent = tr('mapPrivacy');
  $('map-disclosure').hidden = state.status !== 'found';
  if (selected) {
    const title = tr('mapTitle') + ' ' + (selected.name || tr('unnamed'));
    $('map-heading').textContent = title;
    const frame = $('map-frame').querySelector('iframe');
    if (frame) frame.title = title;
  }
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
    style: 'unit', unit: short ? 'meter' : 'kilometer',
    maximumFractionDigits: short ? 0 : 1,
  }).format(short ? meters : meters / 1000);
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
  info.append(element('p', 'hours', pharmacy.hours ? tr('hours') + ': ' + pharmacy.hours : tr('missingHours')));

  const action = element('div', 'pharmacy-action');
  const distance = element('span', 'distance', distanceText(pharmacy.distance));
  const preview = element('button', 'map-preview', tr('mapHere'));
  preview.type = 'button';
  preview.dataset.mapId = pharmacy.id;
  preview.setAttribute('aria-label', tr('mapHere') + ': ' + name);
  preview.setAttribute('aria-describedby', 'map-disclosure');
  preview.addEventListener('click', () => openMap(pharmacy));

  const link = element('a', '', tr('map'));
  link.href = mapsUrl(pharmacy);
  link.rel = 'noreferrer';
  link.setAttribute('aria-label', tr('map') + ': ' + name);
  action.append(distance, preview, link);
  row.append(rank, info, action);
  return row;
}

function render() {
  const { status, result, origin, busy } = state;
  document.documentElement.lang = lang;
  document.querySelector('.results').dataset.state = status;
  renderUX();
  updateMapLabels();

  const labels = {
    'language-label': 'language', eyebrow: 'eyebrow', heading: 'heading',
    intro: 'intro', 'locate-label': 'locate', privacy: 'privacy',
    'city-label': 'city', 'search-label': 'search', 'results-heading': 'results',
    cancel: 'cancel', disclaimer: 'disclaimer',
  };
  for (const [id, key] of Object.entries(labels)) $(id).textContent = tr(key);
  document.querySelector('.skip').textContent = tr('skip');
  $('loading-art').hidden = !busy;
  $('cancel').hidden = !busy;

  const list = $('list');
  list.setAttribute('aria-busy', String(busy));
  list.setAttribute('aria-label', tr('results'));
  list.replaceChildren();

  if (status !== 'found') {
    $('status').textContent = tr(status);
    return;
  }
  const locationName = origin === 'device' ? tr('device') : origin;
  const notes = [result.covered ? '' : tr('limited'), result.results.length > 20 ? tr('shown') : ''].filter(Boolean);
  $('status').textContent = tr('found') + ': ' + result.results.length + ' · ' + locationName + '. ' + notes.join(' ');
  for (const [index, pharmacy] of result.results.slice(0, expanded ? 20 : initialLimit).entries()) {
    list.append(pharmacyRow(pharmacy, index));
  }
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
const today = new Date();
const month = today.getMonth() + 1, day = today.getDate();
if ((month === 11 && day >= 25) || month === 12 || (month === 1 && day <= 6)) {
  document.body.dataset.season = 'christmas';
}
render();
