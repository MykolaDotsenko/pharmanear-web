import { embedUrl } from './core.js';
import { messages, preferredLanguage } from './strings.js';
import { createSearchController } from './search-controller.js';
import { lookupPharmacies } from './catalog.js';
import { finnishToday } from './holidays.js';
import { element, pharmacyRow } from './pharmacy-row.js';
import { createRowRadar } from './row-radar.js';
import { setUpSeason } from './festive.js';
import { setUpTheme } from './theme.js';
import { setUpEffects, transition } from './effects.js';

const $ = id => document.getElementById(id);
const root = document.documentElement;
const initialLimit = 5;
const maximumShown = 20;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let lang = preferredLanguage(navigator.languages);
let expanded = false;
let selected = null;
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

// The radar opens inside a row, like the map; opening one closes the other.
const radar = createRowRadar({
  list: $('list'),
  options: () =>
    state.status === 'found' && {
      pharmacies: state.result.results,
      language: lang,
      text: tr('radarView'),
      reducedMotion,
      loading: tr('radarLoading'),
      failed: tr('radarError'),
    },
  onOpen: () => closeMap(),
});

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
      radar.close();
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
    ['lights-toggle', 'lights'],
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
  $('hours-disclosure').hidden = !found;
  $('hours-disclosure').textContent = tr('hoursDisclosure');

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
  radar.close();
  selected = pharmacy;
  const frame = document.createElement('iframe');
  // OpenStreetMap gets no cookies or lasting storage (credentialless, where supported) and no referrer, and
  // its page cannot navigate this one, submit forms or open dialogs; only its scripts and its own links run.
  frame.setAttribute('credentialless', '');
  frame.sandbox = 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox';
  frame.referrerPolicy = 'no-referrer';
  frame.src = embedUrl(pharmacy);
  map.frame.replaceChildren(frame);
  previewButton(pharmacy.id).closest('li').append(map.panel);
  map.panel.hidden = false;
  renderMapLabels();
  map.heading.focus();
}

/**
 * The status is a polite live region: it is written only when its words change, so expanding the list or
 * any other render says nothing twice.
 */
function announce(text) {
  const status = $('status');
  if (status.textContent.trim() !== text) status.textContent = text;
}

function renderResults() {
  const { status, result, origin, busy } = state;
  const list = $('list');
  list.setAttribute('aria-busy', String(busy));
  list.setAttribute('aria-label', tr('results'));
  list.replaceChildren();

  if (status !== 'found') {
    announce(tr(status));
    return;
  }

  const place = origin === 'device' ? tr('device') : tr('cities')[origin];
  const count = result.results.length;
  const noun = tr('resultCount')[new Intl.PluralRules(lang).select(count)] ?? tr('resultCount').other;
  announce(`${count} ${noun} · ${place}`);
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
  list.append(
    ...visible.map((pharmacy, index) =>
      pharmacyRow(pharmacy, {
        index,
        entrance: index - seen,
        today,
        results: result.results,
        lang,
        tr,
        radarOpen: radar.isOpen(pharmacy.id),
        onMap: openMap,
        onRadar: radar.toggle,
      }),
    ),
  );
  if (selected) {
    const button = previewButton(selected.id);
    if (button) button.closest('li').append(map.panel);
    else closeMap();
  }
  // Rows are rebuilt on every render; an open radar keeps running and moves into its new row.
  radar.follow();
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
window.addEventListener('pagehide', () => radar.close());
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
  radar.close();
  lang = event.target.value;
  render();
});

setUpTheme({ toggle: $('theme-toggle'), reducedMotion });
if (root.dataset.season === 'christmas') {
  setUpSeason({
    garland: $('garland'),
    lightsButton: $('lights-toggle'),
    snowButton: $('snow-toggle'),
    melodyButton: $('melody-toggle'),
    canvas: $('snowfall'),
    art: document.querySelector('.landscape'),
    reducedMotion,
  });
}
setUpEffects({ list: $('list'), hero: document.querySelector('.hero'), reducedMotion });
render();
