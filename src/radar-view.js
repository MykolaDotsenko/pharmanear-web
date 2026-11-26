import { mapsUrl } from './core.js';
import { bearing, isNear, radarPoint, radarRange, rankedTargets, degrees } from './radar-geometry.js';
import { createRadarSession } from './radar-session.js';

const copy = {
  en: {
    title: 'Pharmacy radar',
    close: 'Close radar',
    target: 'Choose pharmacy',
    locating: 'Finding your live location…',
    stale: 'Waiting for a new GPS fix…',
    paused: 'Radar paused',
    denied: 'Location unavailable or denied.',
    unavailable: 'Waiting for GPS signal…',
    active: 'Live GPS',
    compass: 'Compass-up',
    motion: 'Direction of travel',
    north: 'North-up',
    accuracy: 'GPS accuracy',
    scale: 'Range',
    near: 'Near the mapped pharmacy. Look for its entrance.',
    uncertain: 'The pharmacy is within GPS uncertainty.',
    offscale: 'Target is outside the displayed range.',
    disclaimer:
      'Straight-line direction only, not a walking route. Live location stays on this device while the radar is open.',
    map: 'Open in OpenStreetMap',
    unnamed: 'Pharmacy — name unavailable',
    directions: ['North', 'North-east', 'East', 'South-east', 'South', 'South-west', 'West', 'North-west'],
    relative: [
      'Ahead',
      'Slightly right',
      'Right',
      'Behind right',
      'Behind',
      'Behind left',
      'Left',
      'Slightly left',
    ],
  },
  fi: {
    title: 'Apteekkitutka',
    close: 'Sulje tutka',
    target: 'Valitse apteekki',
    locating: 'Haetaan sijaintia…',
    stale: 'Odotetaan uutta GPS-sijaintia…',
    paused: 'Tutka tauolla',
    denied: 'Sijainti ei ole saatavilla tai lupaa ei annettu.',
    unavailable: 'Odotetaan GPS-signaalia…',
    active: 'GPS käytössä',
    compass: 'Kompassisuunta',
    motion: 'Kulkusuunta',
    north: 'Pohjoinen ylhäällä',
    accuracy: 'GPS-tarkkuus',
    scale: 'Kantama',
    near: 'Olet lähellä kartan apteekkia. Etsi sisäänkäynti.',
    uncertain: 'Apteekki on GPS-epävarmuusalueella.',
    offscale: 'Kohde on tutkan kantaman ulkopuolella.',
    disclaimer: 'Suunta linnuntietä, ei kävelyreitti. Sijainti pysyy laitteellasi tutkan ollessa auki.',
    map: 'Avaa OpenStreetMapissa',
    unnamed: 'Apteekki — nimi puuttuu',
    directions: ['Pohjoinen', 'Koillinen', 'Itä', 'Kaakko', 'Etelä', 'Lounas', 'Länsi', 'Luode'],
    relative: [
      'Suoraan',
      'Hieman oikealle',
      'Oikealle',
      'Takaviistoon oikealle',
      'Taakse',
      'Takaviistoon vasemmalle',
      'Vasemmalle',
      'Hieman vasemmalle',
    ],
  },
  sv: {
    title: 'Apoteksradar',
    close: 'Stäng radarn',
    target: 'Välj apotek',
    locating: 'Hämtar din position…',
    stale: 'Väntar på en ny GPS-position…',
    paused: 'Radarn pausad',
    denied: 'Positionen är otillgänglig eller nekad.',
    unavailable: 'Väntar på GPS-signal…',
    active: 'GPS aktiv',
    compass: 'Kompassriktning',
    motion: 'Färdriktning',
    north: 'Norr uppåt',
    accuracy: 'GPS-noggrannhet',
    scale: 'Räckvidd',
    near: 'Du är nära det kartlagda apoteket. Leta efter ingången.',
    uncertain: 'Apoteket ligger inom GPS-osäkerheten.',
    offscale: 'Målet ligger utanför radarns räckvidd.',
    disclaimer:
      'Riktning fågelvägen, inte en gångväg. Din position stannar på enheten medan radarn är öppen.',
    map: 'Öppna i OpenStreetMap',
    unnamed: 'Apotek — namn saknas',
    directions: ['Norr', 'Nordost', 'Öster', 'Sydost', 'Söder', 'Sydväst', 'Väster', 'Nordväst'],
    relative: [
      'Rakt fram',
      'Lite åt höger',
      'Höger',
      'Snett bakåt höger',
      'Bakåt',
      'Snett bakåt vänster',
      'Vänster',
      'Lite åt vänster',
    ],
  },
};

const svgNS = 'http://www.w3.org/2000/svg';
function node(tag, text, parent) {
  const item = document.createElement(tag);
  item.textContent = text;
  parent?.append(item);
  return item;
}
function shape(tag, attrs, parent) {
  const item = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attrs)) item.setAttribute(key, String(value));
  parent.append(item);
  return item;
}

export function openRadar({ container, pharmacies, targetId, language, compass, onClose }) {
  const t = copy[language] ?? copy.en;
  let selected = pharmacies.find(p => p.id === targetId) ?? pharmacies[0];
  let scale = null;
  let near = false;
  let snapshot;
  let lastSpoken = null;
  const panel = node('section', '', container);
  panel.className = 'radar-panel';
  panel.setAttribute('aria-labelledby', 'radar-title');
  const header = node('div', '', panel);
  header.className = 'result-header';
  const title = node('h3', t.title, header);
  title.id = 'radar-title';
  title.tabIndex = -1;
  const close = node('button', t.close, header);
  close.type = 'button';
  close.className = 'text-button';
  close.addEventListener('click', onClose);
  const status = node('p', t.locating, panel);
  status.setAttribute('role', 'status');
  const meta = node('p', '', panel);
  meta.className = 'radar-meta';
  const chart = shape('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true', class: 'radar-chart' }, panel);
  const readout = node('div', '', panel);
  readout.className = 'radar-readout';
  const name = node('strong', selected.name || t.unnamed, readout);
  const address = node('p', selected.address, readout);
  const detail = node('p', '', readout);
  const note = node('p', '', readout);
  const link = node('a', t.map, readout);
  link.rel = 'noreferrer';
  link.href = mapsUrl(selected);
  const label = node('label', t.target, panel);
  label.htmlFor = 'radar-target';
  const chooser = node('select', '', panel);
  chooser.id = 'radar-target';
  const live = node('p', '', panel);
  live.className = 'radar-sr-only';
  live.setAttribute('role', 'status');
  const disclaimer = node('p', t.disclaimer, panel);
  disclaimer.className = 'radar-meta';

  function options(candidates) {
    const ids = candidates.map(p => p.id).join('|');
    if (chooser.dataset.ids !== ids) {
      chooser.replaceChildren();
      candidates.forEach(p => {
        const option = node('option', p.name || t.unnamed, chooser);
        option.value = p.id;
      });
      chooser.dataset.ids = ids;
    }
    chooser.value = selected.id;
  }
  options(
    pharmacies.slice(0, 8).some(p => p.id === selected.id)
      ? pharmacies.slice(0, 8)
      : [...pharmacies.slice(0, 8), selected],
  );
  const format = meters =>
    new Intl.NumberFormat(language, {
      style: 'unit',
      unit: meters < 1000 ? 'meter' : 'kilometer',
      maximumFractionDigits: meters < 1000 ? 0 : 1,
    }).format(meters < 1000 ? meters : meters / 1000);
  function render(next) {
    snapshot = next;
    if (status.textContent !== t[next.status]) status.textContent = t[next.status];
    name.textContent = selected.name || t.unnamed;
    address.textContent = selected.address;
    link.href = mapsUrl(selected);
    chart.replaceChildren();
    chart.hidden = !next.position;
    if (!next.position) {
      meta.textContent = '';
      detail.textContent = '';
      note.textContent = '';
      return;
    }
    const candidates = rankedTargets(pharmacies, next.position, selected.id);
    options(candidates);
    const target = candidates.find(p => p.id === selected.id);
    if (!target) return;
    scale = radarRange(target.distance, scale);
    near = next.status === 'active' && isNear(target.distance, next.position.accuracy, near);
    const azimuth = bearing(next.position, target);
    const relative = degrees(azimuth === null ? null : azimuth - (next.heading ?? 0));
    const guidance =
      azimuth === null
        ? ''
        : next.mode === 'north'
          ? t.directions[Math.round(azimuth / 45) % 8]
          : t.relative[Math.round(relative / 45) % 8];
    meta.textContent = [
      t[next.mode],
      t.accuracy + ' ±' + format(next.position.accuracy),
      t.scale + ' ' + format(scale),
    ].join(' · ');
    const fresh = next.status === 'active';
    detail.textContent = format(target.distance) + (fresh && !near && guidance ? ' · ' + guidance : '');
    note.textContent = near
      ? t.near
      : fresh && target.distance <= next.position.accuracy
        ? t.uncertain
        : target.distance > scale
          ? t.offscale
          : '';
    const now = Date.now();
    if (
      fresh &&
      (!lastSpoken ||
        lastSpoken.id !== selected.id ||
        lastSpoken.near !== near ||
        Math.abs(target.distance - lastSpoken.distance) >= Math.max(10, lastSpoken.distance / 4) ||
        (lastSpoken.guidance !== guidance && now - lastSpoken.at >= 8000))
    ) {
      live.textContent = detail.textContent + (near ? '. ' + t.near : '');
      lastSpoken = { id: selected.id, near, distance: target.distance, guidance, at: now };
    }
    for (const r of [10.25, 20.5, 30.75, 41])
      shape('circle', { cx: 50, cy: 50, r, class: 'radar-ring' }, chart);
    shape('path', { d: 'M9 50H91M50 9V91', class: 'radar-axis' }, chart);
    const north = radarPoint(0, next.heading, scale, scale);
    const northLabel = shape('text', { x: north.x, y: north.y - 2, class: 'radar-north' }, chart);
    northLabel.textContent = 'N';
    shape(
      'circle',
      { cx: 50, cy: 50, r: Math.min(41, (next.position.accuracy / scale) * 41), class: 'radar-accuracy' },
      chart,
    );
    const drawn = [];
    const ordered = [target, ...candidates.filter(p => p.id !== target.id)];
    for (const p of ordered) {
      const active = p.id === target.id;
      if (!active && p.distance > scale) continue;
      const b = bearing(next.position, p);
      const point = b === null ? { x: 50, y: 50 } : radarPoint(b, next.heading, p.distance, scale);
      if (
        !point ||
        (!active &&
          (Math.hypot(point.x - 50, point.y - 50) < 8 ||
            drawn.some(q => Math.hypot(point.x - q.x, point.y - q.y) < 10)))
      )
        continue;
      drawn.push(point);
      if (active && fresh && !near && Math.hypot(point.x - 50, point.y - 50) > 6)
        shape('line', { x1: 50, y1: 50, x2: point.x, y2: point.y, class: 'radar-needle' }, chart);
      shape(
        'circle',
        { cx: point.x, cy: point.y, r: active ? 5 : 3.5, class: active ? 'radar-target' : 'radar-marker' },
        chart,
      );
      shape(
        'path',
        { d: 'M' + (point.x - 1.6) + ' ' + point.y + 'h3.2m-1.6 -1.6v3.2', class: 'radar-cross' },
        chart,
      );
    }
    shape('circle', { cx: 50, cy: 50, r: 2, class: 'radar-user' }, chart);
  }
  chooser.addEventListener('change', () => {
    selected = pharmacies.find(p => p.id === chooser.value) ?? selected;
    scale = null;
    near = false;
    if (snapshot) render(snapshot);
  });
  const session = createRadarSession({ onChange: render, compass });
  title.focus();
  return {
    close() {
      session.close();
      panel.remove();
    },
  };
}
