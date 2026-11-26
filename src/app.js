import { mapsUrl, embedUrl } from './core.js';
import { messages, preferredLanguage } from './strings.js';
import { createSearchController } from './search-controller.js';
import { lookupPharmacies } from './catalog.js';
import { formatOpeningHours } from './hours.js';
import { buildGarland, createMelody, createSnowfall } from './festive.js';

const $ = id => document.getElementById(id);
const root = document.documentElement;
const initialLimit = 5;
const maximumShown = 20;
const themeKey = 'pharmanear.theme';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const systemDark = matchMedia('(prefers-color-scheme: dark)');

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
        $('results-heading').scrollIntoView({
          block: 'start',
          behavior: reducedMotion.matches ? 'instant' : 'smooth',
        });
      }
    }
  },
});
let state = controller.state;

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

/** Localized rules when the mapped value is simple enough; otherwise the mapped rules as they are. */
function hoursLine(pharmacy) {
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
  // The separator stays with the rule before it, so a wrapped line never starts with "·".
  const value = element('span', 'hours-value');
  rules.forEach((rule, index) => {
    const last = index === rules.length - 1;
    value.append(element('span', 'hours-rule', last ? rule : `${rule} ·`));
    if (!last) value.append(' ');
  });
  hours.append(element('span', 'hours-label', tr('hours')), value);
  return hours;
}

/** `entrance` is the row's place among the rows arriving now, or negative for a row already on screen. */
function pharmacyRow(pharmacy, index, entrance) {
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
  list.append(...visible.map((pharmacy, index) => pharmacyRow(pharmacy, index, index - seen)));
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

// Theme: the system's unless the visitor chose one; theme-init.js applied it before the first paint.
function storedTheme() {
  try {
    return localStorage.getItem(themeKey);
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  $('theme-toggle').setAttribute('aria-pressed', String(theme === 'dark'));
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(root)
    .getPropertyValue('--paper')
    .trim();
}

/** The new theme spreads in a circle from the button where the browser supports view transitions. */
function revealTheme(theme, button) {
  if (!document.startViewTransition || reducedMotion.matches) {
    applyTheme(theme);
    return;
  }
  const { left, top, width, height } = button.getBoundingClientRect();
  const x = left + width / 2;
  const y = top + height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const transition = document.startViewTransition(() => applyTheme(theme));
  transition.ready
    .then(() =>
      root.animate(
        { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        {
          duration: 550,
          easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      ),
    )
    .catch(() => {});
}

$('theme-toggle').addEventListener('click', event => {
  const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(themeKey, theme);
  } catch {
    // Without storage the choice lasts until the page is closed.
  }
  revealTheme(theme, event.currentTarget);
});
systemDark.addEventListener('change', event => {
  if (!storedTheme()) applyTheme(event.matches ? 'dark' : 'light');
});

// Season: lights, snow and a melody, each only on request and only from 25 November to 6 January.
function setUpSeason() {
  buildGarland($('garland'));
  const snowButton = $('snow-toggle');
  const melodyButton = $('melody-toggle');
  const snow = createSnowfall($('snowfall'), { reducedMotion: reducedMotion.matches });
  const melody = createMelody({ onEnd: () => melodyButton.setAttribute('aria-pressed', 'false') });

  snowButton.addEventListener('click', () => {
    if (snow.running) snow.stop();
    else snow.start();
    snowButton.setAttribute('aria-pressed', String(snow.running));
  });
  melodyButton.addEventListener('click', async () => {
    if (melody.playing) {
      melody.stop();
      melodyButton.setAttribute('aria-pressed', 'false');
      return;
    }
    melodyButton.setAttribute('aria-pressed', 'true');
    try {
      await melody.play();
    } catch {
      melodyButton.setAttribute('aria-pressed', 'false');
    }
  });
}

// A soft light follows the pointer across result cards (hover-capable pointers only; see style.css).
$('list').addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse') return;
  const card = event.target.closest('.pharmacy');
  if (!card) return;
  const box = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${event.clientX - box.left}px`);
  card.style.setProperty('--my', `${event.clientY - box.top}px`);
});

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

if (root.dataset.season === 'christmas') setUpSeason();
applyTheme(root.dataset.theme ?? (systemDark.matches ? 'dark' : 'light'));
render();
