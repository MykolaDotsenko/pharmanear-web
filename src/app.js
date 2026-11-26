import { mapsUrl, embedUrl } from './core.js';
import { messages, preferredLanguage } from './strings.js';
import { createSearchController } from './search-controller.js';
import { lookupPharmacies } from './catalog.js';
import { formatOpeningHours, todaysRule } from './hours.js';
import { finnishToday } from './holidays.js';
import { setUpSeason } from './festive.js';
import { setUpTheme } from './theme.js';
import { setUpEffects, transition } from './effects.js';
import { requestCompass } from './radar-session.js';

const $ = id => document.getElementById(id);
const root = document.documentElement;
const initialLimit = 5;
const maximumShown = 20;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let lang = preferredLanguage(navigator.languages);
let expanded = false;
let selected = null;
let radar = null;
let radarGeneration = 0;
// The result set on screen and how many of its rows the visitor has already seen arrive.
let shownResult = null;
let shownCount = 0;
const tr = key => messages[lang][key];

// The map panel moves into the selected row, so it is kept by reference rather than looked up by id.
const map = {
  panel: $('map-panel'),
  heading: $('map-heading'),
  frame: $('map-frame'),
  privacy: $('map-privacy'),
  close: $('close-map'),
};

const controller = createSearchController({
  lookup: lookupPharmacies,
  geolocation: navigator.geolocation,
  onChange(next) {
    const wasBusy = state.busy;
    const hadOutcome = hasOutcome(state);
    state = next;
    if (next.busy) {
      expanded = false;
      closeMap();
      closeRadar();
    }
    const update = () => {
      render();
      if (wasBusy && next.status === 'found' && matchMedia('(max-width: 760px)').matches) {
        // Keep keyboard focus with the control the user activated.
        if (!document.activeElement?.matches(':focus-visible')) {
          $('results-heading').scrollIntoView({
            block: 'start',
            behavior: reducedMotion.matches ? 'instant' : 'smooth',
          });
        }
      }
    };
    // The hero changes shape when an outcome first appears or goes; that change is animated.
    if (hasOutcome(next) !== hadOutcome) transition(update, reducedMotion);
    else update();
  },
});
let state = controller.state;

/** Whether the state shows an outcome (results or a failure), which compacts the hero. */
function hasOutcome({ status }) {
  return ['found', 'error', 'denied', 'empty'].includes(status);
}

function setText(labels) {
  for (const [id, key] of Object.entries(labels)) $(id).textContent = tr(key);
}

/** Icon buttons keep one name; aria-pressed says whether their feature is on. */
function labelIconButtons() {
  for (const [id, key] of [
    ['theme-toggle', 'theme'],
    ['snow-toggle', 'snow'],
    ['melody-toggle', 'melody'],
  ]) {
    $(id).setAttribute('aria-label', tr(key));
    $(id).title = tr(key);
  }
}

function renderDocument() {
  root.lang = lang;
  document.title = tr('title');
  document.querySelector('meta[name="description"]').content = tr('description');
  document.querySelector('.skip').textContent = tr('skip');
  $('language').value = lang;
  for (const option of $('city').options) option.textContent = tr('cities')[option.value];
  labelIconButtons();
}

function renderControls() {
  const { status, result, busy } = state;
  const failed = ['error', 'denied', 'empty'].includes(status);
  const found = status === 'found';

  setText({
    'language-label': 'language',
    eyebrow: 'eyebrow',
    greeting: 'greeting',
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
  document.body.toggleAttribute('data-outcome', hasOutcome(state));
  document.querySelector('.results').dataset.state = status;
  $('loading-art').hidden = !busy;
  $('cancel').hidden = !busy;
  $('recovery').hidden = !failed;
  $('directory').parentElement.hidden = failed;
  $('retry').hidden = !state.canRetry || status === 'denied' || status === 'empty';
  $('result-details').hidden = !found;
  $('result-tools').hidden = !found;
  $('open-radar').hidden = !found;
  $('open-radar').textContent = tr('radar');

  const showAll = $('show-all');
  showAll.hidden = !found || result.results.length <= initialLimit;
  showAll.textContent = tr(expanded ? 'showLess' : 'showAll');
  showAll.setAttribute('aria-expanded', String(expanded));
}

function renderMapLabels() {
  map.close.textContent = tr('closeMap');
  map.privacy.textContent = tr('mapPrivacy');
  $('map-disclosure').textContent = tr('mapPrivacy');
  if (!selected) return;

  const title = `${tr('mapTitle')} ${selected.name || tr('unnamed')}`;
  map.heading.textContent = title;
  const frame = map.frame.querySelector('iframe');
  if (frame) frame.title = title;
}

function previewButton(id) {
  return [...document.querySelectorAll('[data-map-id]')].find(button => button.dataset.mapId === id);
}

function closeMap(restoreFocus = false) {
  const id = selected?.id;
  selected = null;
  map.panel.hidden = true;
  map.frame.replaceChildren();
  $('list').before(map.panel);
  if (restoreFocus && id) previewButton(id)?.focus();
}

/** Opens the map inside the pharmacy's own row, so its context stays in view. */
function openMap(pharmacy) {
  closeRadar();
  selected = pharmacy;
  const frame = document.createElement('iframe');
  frame.src = embedUrl(pharmacy);
  frame.referrerPolicy = 'no-referrer';
  map.frame.replaceChildren(frame);
  previewButton(pharmacy.id).closest('li').append(map.panel);
  map.panel.hidden = false;
  renderMapLabels();
  map.heading.focus();
}

function closeRadar(restoreFocus = false) {
  radarGeneration++;
  radar?.close();
  radar = null;
  $('radar-host').replaceChildren();
  $('open-radar').setAttribute('aria-expanded', 'false');
  if (restoreFocus) $('open-radar').focus();
}

async function showRadar() {
  if (state.status !== 'found') return;
  if ($('open-radar').getAttribute('aria-expanded') === 'true') {
    closeRadar(true);
    return;
  }
  const compass = requestCompass();
  closeMap();
  const generation = ++radarGeneration;
  $('open-radar').setAttribute('aria-expanded', 'true');
  $('radar-host').textContent = tr('radarLoading');
  try {
    const { openRadar } = await import('./radar-view.js');
    if (generation !== radarGeneration) return;
    $('radar-host').replaceChildren();
    radar = openRadar({
      container: $('radar-host'),
      pharmacies: state.result.results,
      targetId: state.result.results[0].id,
      language: lang,
      compass,
      onClose: () => closeRadar(true),
    });
  } catch {
    if (generation !== radarGeneration) return;
    closeRadar();
    $('radar-host').textContent = tr('radarError');
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
    style: 'unit',
    unit: short ? 'meter' : 'kilometer',
    maximumFractionDigits: short ? 0 : 1,
  }).format(short ? meters : meters / 1000);
}

/**
 * Localized rules when the mapped value is simple enough, with today's rule marked; otherwise the mapped
 * rules as they are. Nothing says whether the pharmacy is open: the hours are unverified.
 */
function hoursLine(pharmacy, today) {
  const hours = element('p', 'hours');
  if (!pharmacy.hours) {
    hours.textContent = tr('missingHours');
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
  hours.append(element('span', 'hours-label', tr('hours')), value);
  return hours;
}

/** `entrance` is the row's place among the rows arriving now, or negative for a row already on screen. */
function pharmacyRow(pharmacy, index, entrance, today) {
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
  if (pharmacy.address) info.append(element('p', '', pharmacy.address));
  info.append(hoursLine(pharmacy, today));

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
  action.append(preview, link);
  row.append(rank, info, element('span', 'distance', distanceText(pharmacy.distance)), action);
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
  $('source-notes').replaceChildren(...notes.filter(Boolean).map(note => element('p', '', note)));

  const visible = result.results.slice(0, expanded ? maximumShown : initialLimit);
  // Rows are rebuilt on every render; only new results and newly shown rows animate in, not a language switch.
  const seen = result === shownResult ? shownCount : 0;
  shownResult = result;
  shownCount = visible.length;
  const today = finnishToday();
  list.append(...visible.map((pharmacy, index) => pharmacyRow(pharmacy, index, index - seen, today)));
  if (selected) {
    const button = previewButton(selected.id);
    if (button) button.closest('li').append(map.panel);
    else closeMap();
  }
}

function render() {
  renderDocument();
  renderControls();
  renderMapLabels();
  renderResults();
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
map.close.addEventListener('click', () => closeMap(true));
$('open-radar').addEventListener('click', showRadar);
window.addEventListener('pagehide', () => closeRadar());
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
  closeRadar();
  lang = event.target.value;
  render();
});

setUpTheme({ toggle: $('theme-toggle'), reducedMotion });
if (root.dataset.season === 'christmas') {
  setUpSeason({
    garland: $('garland'),
    snowButton: $('snow-toggle'),
    melodyButton: $('melody-toggle'),
    canvas: $('snowfall'),
    reducedMotion: reducedMotion.matches,
  });
}
setUpEffects({ list: $('list'), hero: document.querySelector('.hero'), reducedMotion });
render();
