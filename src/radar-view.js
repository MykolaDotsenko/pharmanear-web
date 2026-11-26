import { formatDistance, mapsUrl } from './core.js';
import { bearing, degrees, isNear, radarPoint, radarRange, rankedTargets } from './radar-geometry.js';
import { createRadarSession, requestCompass } from './radar-session.js';

const svgNS = 'http://www.w3.org/2000/svg';
// When even the nearest result is this far away, the results were searched for somewhere else.
const farAway = 5000;
// A direction that merely wobbles is re-announced at most this often.
const announceEvery = 8000;

function node(tag, text, parent, className) {
  const item = document.createElement(tag);
  item.textContent = text;
  if (className) item.className = className;
  parent?.append(item);
  return item;
}

function shape(tag, attrs, parent) {
  const item = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attrs)) item.setAttribute(key, String(value));
  parent.append(item);
  return item;
}

/**
 * The radar panel. It explains itself first and asks for location and compass only when the visitor starts
 * it. `text` is the language's `radarView` copy from strings.js.
 */
export function openRadar({
  container,
  pharmacies,
  targetId,
  language,
  text: t,
  unnamed,
  mapLabel,
  reducedMotion,
  onClose,
}) {
  const label = pharmacy =>
    pharmacy.name || (pharmacy.address ? `${unnamed} (${pharmacy.address})` : unnamed);
  const format = meters => formatDistance(meters, language);
  let selected = pharmacies.find(p => p.id === targetId) ?? pharmacies[0];
  let scale = null;
  let near = false;
  let snapshot = null;
  let pending = null;
  let frame = 0;
  let spoken = null;
  let session = null;

  const panel = node('section', '', container, 'radar-panel');
  panel.setAttribute('aria-labelledby', 'radar-title');
  const header = node('div', '', panel, 'result-header');
  const title = node('h3', t.title, header);
  title.id = 'radar-title';
  title.tabIndex = -1;
  const close = node('button', t.close, header, 'text-button');
  close.type = 'button';
  close.addEventListener('click', onClose);

  const intro = node('p', t.intro, panel, 'radar-intro');
  const start = node('button', t.start, panel, 'secondary radar-start');
  start.type = 'button';

  const live = node('div', '', panel, 'radar-live');
  live.hidden = true;
  const status = node('p', '', live);
  status.setAttribute('role', 'status');
  const meta = node('p', '', live, 'radar-meta');
  const chart = shape('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true', class: 'radar-chart' }, live);
  chart.setAttribute('hidden', '');
  const readout = node('div', '', live, 'radar-readout');
  const name = node('strong', '', readout);
  const address = node('p', '', readout);
  const detail = node('p', '', readout);
  const note = node('p', '', readout);
  const link = node('a', mapLabel, readout);
  link.rel = 'noreferrer';
  const chooserLabel = node('label', t.target, live);
  chooserLabel.htmlFor = 'radar-target';
  const chooser = node('select', '', live);
  chooser.id = 'radar-target';
  const announcer = node('p', '', live, 'radar-sr-only');
  announcer.setAttribute('role', 'status');
  node('p', t.disclaimer, live, 'radar-meta');

  // The choices keep the search's order, so live GPS updates never rebuild an open picker. Entries that read
  // the same (unnamed pharmacies at one address) are numbered.
  const firstEight = pharmacies.slice(0, 8);
  const choices = firstEight.some(p => p.id === selected.id) ? firstEight : [...firstEight, selected];
  const seen = new Map();
  for (const pharmacy of choices) {
    const text = label(pharmacy);
    const count = (seen.get(text) ?? 0) + 1;
    seen.set(text, count);
    node('option', count > 1 ? `${text} (${count})` : text, chooser).value = pharmacy.id;
  }
  chooser.value = selected.id;

  function showSelected() {
    name.textContent = label(selected);
    address.textContent = selected.name ? selected.address : '';
    link.href = mapsUrl(selected);
    link.setAttribute('aria-label', `${mapLabel}: ${label(selected)}`);
  }
  showSelected();

  function render(next) {
    snapshot = next;
    if (status.textContent !== t[next.status]) status.textContent = t[next.status];
    chart.replaceChildren();
    chart.toggleAttribute('hidden', !next.position);
    if (!next.position) {
      meta.textContent = '';
      detail.textContent = '';
      note.textContent = '';
      return;
    }
    const candidates = rankedTargets(pharmacies, next.position, selected.id);
    const target = candidates.find(p => p.id === selected.id);
    if (!target) return;
    const { accuracy } = next.position;
    const fresh = next.status === 'active';
    scale = radarRange(target.distance, scale);
    // A merely stale fix still counts for "near": someone waiting at the door gets no new fixes.
    near = (fresh || next.status === 'stale') && isNear(target.distance, accuracy, near);
    // Inside the GPS uncertainty a direction would be noise, so none is given.
    const uncertain = !near && target.distance <= accuracy;
    const azimuth = bearing(next.position, target);
    const relative = degrees(azimuth === null ? null : azimuth - (next.heading ?? 0));
    const guidance =
      azimuth === null || uncertain
        ? ''
        : next.mode === 'north'
          ? t.directions[Math.round(azimuth / 45) % 8]
          : t.relative[Math.round(relative / 45) % 8];
    // With reduced motion the chart stays north-up; the words still say where to turn.
    const chartHeading = reducedMotion.matches ? 0 : next.heading;
    meta.textContent = [
      t[reducedMotion.matches ? 'north' : next.mode],
      `${t.accuracy} ±${format(accuracy)}`,
      `${t.scale} ${format(scale)}`,
    ].join(' · ');
    detail.textContent = format(target.distance) + (fresh && !near && guidance ? ` · ${guidance}` : '');
    note.textContent = near
      ? t.near
      : uncertain
        ? t.uncertain
        : candidates[0].distance > farAway
          ? t.farResults
          : target.distance > scale
            ? t.offscale
            : '';
    announce(target, guidance, fresh);
    draw(next, target, candidates, chartHeading, fresh && !near && !uncertain);
  }

  // Screen readers hear the distance and direction when something meaningful changes, not on every fix.
  function announce(target, guidance, fresh) {
    if (!fresh) return;
    const now = Date.now();
    const changed =
      !spoken ||
      spoken.id !== selected.id ||
      spoken.note !== note.textContent ||
      Math.abs(target.distance - spoken.distance) >= Math.max(10, spoken.distance / 4) ||
      (spoken.guidance !== guidance && now - spoken.at >= announceEvery);
    if (!changed) return;
    announcer.textContent = [detail.textContent, note.textContent].filter(Boolean).join('. ');
    spoken = { id: selected.id, note: note.textContent, distance: target.distance, guidance, at: now };
  }

  function draw(next, target, candidates, heading, needle) {
    for (const r of [10.25, 20.5, 30.75, 41])
      shape('circle', { cx: 50, cy: 50, r, class: 'radar-ring' }, chart);
    shape('path', { d: 'M9 50H91M50 9V91', class: 'radar-axis' }, chart);
    const north = radarPoint(0, heading, scale, scale);
    shape('text', { x: north.x, y: north.y - 2, class: 'radar-north' }, chart).textContent = t.northLetter;
    const accuracyRadius = Math.min(41, (next.position.accuracy / scale) * 41);
    shape('circle', { cx: 50, cy: 50, r: accuracyRadius, class: 'radar-accuracy' }, chart);
    const drawn = [];
    for (const pharmacy of [target, ...candidates.filter(p => p.id !== target.id)]) {
      const active = pharmacy === target;
      if (!active && pharmacy.distance > scale) continue;
      const direction = bearing(next.position, pharmacy);
      const point =
        direction === null ? { x: 50, y: 50 } : radarPoint(direction, heading, pharmacy.distance, scale);
      if (!point) continue;
      const crowded =
        Math.hypot(point.x - 50, point.y - 50) < 8 ||
        drawn.some(other => Math.hypot(point.x - other.x, point.y - other.y) < 10);
      if (!active && crowded) continue;
      drawn.push(point);
      if (active && needle && Math.hypot(point.x - 50, point.y - 50) > 6) {
        shape('line', { x1: 50, y1: 50, x2: point.x, y2: point.y, class: 'radar-needle' }, chart);
      }
      // A target beyond the range sits on the edge as a ring, so it never looks closer than it is.
      const className = active
        ? point.clipped
          ? 'radar-target radar-edge'
          : 'radar-target'
        : 'radar-marker';
      shape('circle', { cx: point.x, cy: point.y, r: active ? 5 : 3.5, class: className }, chart);
      shape('path', { d: `M${point.x - 1.6} ${point.y}h3.2m-1.6 -1.6v3.2`, class: 'radar-cross' }, chart);
    }
    shape('circle', { cx: 50, cy: 50, r: 2, class: 'radar-user' }, chart);
  }

  // Compass events arrive up to sixty times a second; the panel redraws at most once per frame.
  function schedule(next) {
    pending = next;
    frame ||= requestAnimationFrame(() => {
      frame = 0;
      render(pending);
    });
  }

  chooser.addEventListener('change', () => {
    selected = pharmacies.find(p => p.id === chooser.value) ?? selected;
    scale = null;
    near = false;
    showSelected();
    if (snapshot) render(snapshot);
  });

  start.addEventListener('click', () => {
    // Safari shows its compass prompt only inside this click, so that request comes before anything else.
    const compass = requestCompass();
    intro.hidden = true;
    start.remove();
    live.hidden = false;
    status.textContent = t.locating;
    session = createRadarSession({ onChange: schedule, compass });
    title.focus();
  });

  title.focus();
  return {
    close() {
      cancelAnimationFrame(frame);
      session?.close();
      panel.remove();
    },
  };
}
