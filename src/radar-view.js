import { formatDistance } from './core.js';
import { bearing, degrees, isNear, radarPoint, radarRange, rankedTargets } from './radar-geometry.js';
import { createRadarSession } from './radar-session.js';

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
 * The radar panel for one pharmacy, the one whose card opened it. It starts at once: the Radar button is the
 * visitor's request, and the compass permission was asked for in that click (`compass`). The distance and
 * the direction come first, then the dial with only that pharmacy on it. `pharmacies` is the result set,
 * used only to tell when every result is far away. `text` is the language's `radarView` copy.
 */
export function openRadar({
  container,
  pharmacies,
  targetId,
  language,
  text: t,
  reducedMotion,
  compass = Promise.resolve(false),
  onClose,
}) {
  const format = meters => formatDistance(meters, language);
  const selected = pharmacies.find(p => p.id === targetId) ?? pharmacies[0];
  let scale = null;
  let near = false;
  let pending = null;
  let frame = 0;
  let spoken = null;

  const panel = node('section', '', container, 'radar-panel');
  panel.setAttribute('aria-labelledby', 'radar-title');
  const header = node('div', '', panel, 'result-header');
  // Inside a pharmacy's row, under its h3.
  const title = node('h4', t.title, header);
  title.id = 'radar-title';
  title.tabIndex = -1;
  const close = node('button', t.close, header, 'text-button');
  close.type = 'button';
  close.addEventListener('click', onClose);

  const body = node('div', '', panel, 'radar-body');
  const readout = node('div', '', body, 'radar-readout');
  const status = node('p', t.locating, readout, 'radar-status');
  status.setAttribute('role', 'status');
  const distance = node('p', '', readout, 'radar-distance');
  const direction = node('p', '', readout, 'radar-direction');
  const note = node('p', '', readout, 'radar-note');
  const chart = shape('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true', class: 'radar-chart' }, body);
  const details = node('div', '', body, 'radar-details');
  const meta = node('p', '', details, 'radar-meta');
  node('p', t.disclaimer, details, 'radar-meta');
  const announcer = node('p', '', details, 'radar-sr-only');
  announcer.setAttribute('role', 'status');

  function render(next) {
    if (status.textContent !== t[next.status]) status.textContent = t[next.status];
    chart.replaceChildren();
    // A denied location leaves nothing to point with; otherwise the dial shows at once, even while locating.
    chart.toggleAttribute('hidden', next.status === 'denied');
    const chartHeading = reducedMotion.matches ? 0 : next.heading;
    if (!next.position) {
      meta.textContent = '';
      distance.textContent = '';
      direction.textContent = '';
      note.textContent = '';
      if (next.status !== 'denied') dial(chartHeading, null);
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
      !fresh || near || azimuth === null || uncertain
        ? ''
        : next.mode === 'north'
          ? t.directions[Math.round(azimuth / 45) % 8]
          : t.relative[Math.round(relative / 45) % 8];
    // With reduced motion the dial stays north-up; the words still say where to turn.
    meta.textContent = [
      t[reducedMotion.matches ? 'north' : next.mode],
      `${t.accuracy} ±${format(accuracy)}`,
      `${t.scale} ${format(scale)}`,
    ].join(' · ');
    distance.textContent = format(target.distance);
    direction.textContent = guidance;
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
    dial(chartHeading, next, target, Boolean(guidance));
  }

  // Screen readers hear the distance and direction when something meaningful changes, not on every fix.
  function announce(target, guidance, fresh) {
    if (!fresh) return;
    const now = Date.now();
    const changed =
      !spoken ||
      spoken.note !== note.textContent ||
      Math.abs(target.distance - spoken.distance) >= Math.max(10, spoken.distance / 4) ||
      (spoken.guidance !== guidance && now - spoken.at >= announceEvery);
    if (!changed) return;
    announcer.textContent = [distance.textContent, guidance, note.textContent].filter(Boolean).join('. ');
    spoken = { note: note.textContent, distance: target.distance, guidance, at: now };
  }

  /** The dial: rings, north, you in the middle and, once there is a fix, the one pharmacy and its needle. */
  function dial(heading, next, target, needle) {
    for (const r of [10.25, 20.5, 30.75, 41])
      shape('circle', { cx: 50, cy: 50, r, class: 'radar-ring' }, chart);
    shape('path', { d: 'M9 50H91M50 9V91', class: 'radar-axis' }, chart);
    const north = radarPoint(0, heading, 1, 1);
    shape('text', { x: north.x, y: north.y - 2, class: 'radar-north' }, chart).textContent = t.northLetter;
    if (next && target) {
      const accuracyRadius = Math.min(41, (next.position.accuracy / scale) * 41);
      shape('circle', { cx: 50, cy: 50, r: accuracyRadius, class: 'radar-accuracy' }, chart);
      const towards = bearing(next.position, target);
      const point = (towards !== null && radarPoint(towards, heading, target.distance, scale)) || {
        x: 50,
        y: 50,
      };
      if (needle && Math.hypot(point.x - 50, point.y - 50) > 6) {
        shape('line', { x1: 50, y1: 50, x2: point.x, y2: point.y, class: 'radar-needle' }, chart);
      }
      // A target beyond the range sits on the edge as a ring, so it never looks closer than it is.
      const className = point.clipped ? 'radar-target radar-edge' : 'radar-target';
      shape('circle', { cx: point.x, cy: point.y, r: 5.5, class: className }, chart);
      shape('path', { d: `M${point.x - 1.8} ${point.y}h3.6m-1.8 -1.8v3.6`, class: 'radar-cross' }, chart);
    }
    shape(
      'circle',
      { cx: 50, cy: 50, r: 2.2, class: next ? 'radar-user' : 'radar-user radar-waiting' },
      chart,
    );
  }

  // Compass events arrive up to sixty times a second; the panel redraws at most once per frame.
  function schedule(next) {
    pending = next;
    frame ||= requestAnimationFrame(() => {
      frame = 0;
      render(pending);
    });
  }

  render({ status: 'locating', position: null, heading: null, mode: 'north' });
  const session = createRadarSession({ onChange: schedule, compass });
  // Focus moves to the heading without jumping; then the whole panel scrolls into view, so the dial is
  // seen at once without scrolling for it.
  title.focus({ preventScroll: true });
  panel.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  return {
    close() {
      cancelAnimationFrame(frame);
      session.close();
      panel.remove();
    },
  };
}
