/**
 * Santa's sleigh: in the Christmas season, pressing a result's Map preview, Radar or OpenStreetMap action
 * sends a sleigh with two reindeer from the pharmacy's name to that action, trailing gold dust, and it
 * vanishes there in a small burst. Purely decorative: hidden from assistive technology, never takes a click,
 * under two seconds (WCAG 2.2.2), and never with reduced motion. It follows the name and the action every
 * frame, so it stays on them while the page scrolls or a panel opens.
 */

const duration = 1900;
const dustEvery = 45;

/**
 * The flight from `start` to `end` (viewport points): a cubic curve that rises a little above both, so the
 * sleigh takes off from the name and comes down at the action, never higher than `ceiling`. Returns the
 * point, the heading in degrees (limited to ±22, so the sleigh never noses over) and whether it flies
 * leftwards.
 */
export function flightAt(start, end, t, ceiling = -Infinity) {
  const dx = end.x - start.x;
  const lift = Math.min(110, Math.max(44, Math.abs(dx) * 0.12));
  const top = Math.max(ceiling, Math.min(start.y, end.y) - lift);
  const c1 = { x: start.x + dx * 0.28, y: top };
  const c2 = { x: start.x + dx * 0.72, y: top };
  const u = 1 - t;
  const along = (a, b, c, d) => u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  const slope = (a, b, c, d) => 3 * u * u * (b - a) + 6 * u * t * (c - b) + 3 * t * t * (d - c);
  const x = along(start.x, c1.x, c2.x, end.x);
  const y = along(start.y, c1.y, c2.y, end.y);
  const vx = slope(start.x, c1.x, c2.x, end.x);
  const vy = slope(start.y, c1.y, c2.y, end.y);
  const leftwards = dx < 0;
  const raw = (Math.atan2(vy, Math.abs(vx) || 1e-6) * 180) / Math.PI;
  const angle = Math.max(-22, Math.min(22, raw)) * (leftwards ? -1 : 1);
  return { x, y, angle, leftwards };
}

/** Eases in and out, so the sleigh gathers speed after take-off and slows for the landing. */
export const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function reindeer(x, y, scale, shade) {
  const leg = (lx, ly, phase) => `
    <g transform="translate(${lx} ${ly})"><g class="sleigh-leg ${phase}">
      <path d="M0 0 L1.5 9 L-0.5 16" fill="none" stroke="#4a2e17" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-2 16 h3.6" stroke="#1e130a" stroke-width="2.4" stroke-linecap="round"/>
    </g></g>`;
  return `
  <g transform="translate(${x} ${y}) scale(${scale})" opacity="${shade}">
    ${leg(22, 38, 'back-far')}${leg(52, 37, 'front-far')}
    <path d="M14 30 C10 24 12 20 17 22 C15 25 16 28 18 30 Z" fill="#f3ead8"/>
    <ellipse cx="37" cy="33" rx="22" ry="11.5" fill="url(#sleigh-fur)"/>
    <ellipse cx="38" cy="40" rx="15" ry="3.6" fill="#e2c19a" opacity="0.65"/>
    <path d="M49 29 C55 25 58 16 62 10 L70 13 C66 20 61 30 57 37 Z" fill="url(#sleigh-fur)"/>
    <path d="M51 31 C55 31 58 27 60 22" fill="none" stroke="#f3ead8" stroke-width="2.2" stroke-linecap="round" opacity="0.8"/>
    <g transform="rotate(-14 69 11)">
      <ellipse cx="68" cy="11" rx="8.5" ry="5.6" fill="url(#sleigh-fur)"/>
      <ellipse cx="76" cy="12.5" rx="4.4" ry="3.2" fill="#a8774c"/>
      <circle cx="79.6" cy="12" r="1.7" fill="#24150c"/>
      <circle cx="67" cy="9" r="1.05" fill="#140b05"/>
      <circle cx="67.4" cy="8.6" r="0.35" fill="#fff"/>
    </g>
    <path d="M62 7 L55 3 L60 9 Z" fill="#6b4423"/>
    <g fill="none" stroke="url(#sleigh-antler)" stroke-width="1.7" stroke-linecap="round">
      <path d="M63 6 C61 0 57 -4 52 -6 M58 -1 L54 1 M60.5 3 L57 4.5 M55 -4 L54.5 -8"/>
      <path d="M67 5 C67 -1 70 -5 75 -7 M69.2 0 L73.5 0.5 M71.5 -4 L72 -8.5"/>
    </g>
    <path d="M48 25 Q53 33 49 42" fill="none" stroke="#b3122e" stroke-width="3" stroke-linecap="round"/>
    <path d="M30 24 Q34 32 31 43" fill="none" stroke="#b3122e" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="50" cy="42.5" r="2.3" fill="url(#sleigh-gold)"/>
    ${leg(25, 39, 'back-near')}${leg(55, 38, 'front-near')}
  </g>`;
}

/** The picture, facing right; its viewBox is 300 × 124. */
export const sleighArt = `
<svg viewBox="-6 -16 300 124" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="sleigh-fur" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7a4a22"/><stop offset="0.6" stop-color="#9b6534"/><stop offset="1" stop-color="#c08a55"/>
    </linearGradient>
    <linearGradient id="sleigh-antler" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#b8996c"/><stop offset="1" stop-color="#efe1c2"/>
    </linearGradient>
    <linearGradient id="sleigh-red" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e8384c"/><stop offset="0.55" stop-color="#b3172c"/><stop offset="1" stop-color="#6e0c1a"/>
    </linearGradient>
    <linearGradient id="sleigh-coat" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e3304a"/><stop offset="1" stop-color="#9c1226"/>
    </linearGradient>
    <linearGradient id="sleigh-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff2b8"/><stop offset="0.45" stop-color="#e6b54a"/><stop offset="1" stop-color="#9c6a17"/>
    </linearGradient>
    <radialGradient id="sleigh-face" cx="0.45" cy="0.4" r="0.6">
      <stop offset="0" stop-color="#ffdcc4"/><stop offset="1" stop-color="#e9a987"/>
    </radialGradient>
  </defs>
  <g class="sleigh-reins" fill="none" stroke="#3b2414" stroke-width="1.1" stroke-linecap="round">
    <path d="M90 52 C112 47 132 50 152 54"/>
    <path d="M90 53 C140 40 190 38 222 44"/>
  </g>
  ${reindeer(118, 26, 0.92, 0.94)}
  ${reindeer(196, 14, 1, 1)}
  <g class="sleigh-body">
    <path d="M7 54 C2 40 13 28 24 32 C30 23 42 28 38 41 C42 49 35 57 23 57 Z" fill="#8a5a2b"/>
    <path d="M14 40 C18 37 24 37 28 40" fill="none" stroke="#5e3b19" stroke-width="1.2"/>
    <rect x="12" y="30" width="11" height="10" rx="1.2" fill="#2a7d4f" transform="rotate(-8 17 35)"/>
    <path d="M17.5 29.5 v11 M12 35 h11" stroke="url(#sleigh-gold)" stroke-width="1.6" transform="rotate(-8 17 35)"/>
    <rect x="25" y="25" width="10" height="11" rx="1.2" fill="#1f5fa8" transform="rotate(10 30 30)"/>
    <path d="M30 24.5 v12 M25 30 h10" stroke="#f4f0e6" stroke-width="1.5" transform="rotate(10 30 30)"/>
    <path d="M44 66 C41 50 47 38 59 37 C71 37 77 47 77 61 L77 66 Z" fill="url(#sleigh-coat)"/>
    <rect x="44" y="55" width="33" height="5" fill="#1d1512"/>
    <rect x="57" y="54.2" width="7" height="6.6" rx="1" fill="none" stroke="url(#sleigh-gold)" stroke-width="1.6"/>
    <path d="M69 46 C77 46 83 48 89 51" fill="none" stroke="url(#sleigh-coat)" stroke-width="6.5" stroke-linecap="round"/>
    <path d="M70 43.5 C71 46 71 48 70 50" fill="none" stroke="#fbf7ee" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="90.5" cy="51.5" r="3.4" fill="#1f6b3c"/>
    <circle cx="60" cy="27" r="8" fill="url(#sleigh-face)"/>
    <path d="M52.2 24 C50.8 27 51 30 52.5 32 C51 29 51.5 26.5 53.5 24.5 Z" fill="#f4f2ec"/>
    <circle cx="64.6" cy="29" r="2.1" fill="#ef8a8a" opacity="0.55"/>
    <path d="M61.6 23.6 q1.8 -1 3.6 0" fill="none" stroke="#f7f5f0" stroke-width="1.1" stroke-linecap="round"/>
    <circle cx="63.4" cy="25.4" r="1" fill="#2a1a12"/>
    <circle cx="63.7" cy="25.1" r="0.32" fill="#fff"/>
    <circle cx="67.2" cy="27.6" r="1.7" fill="#e38f76"/>
    <path d="M52.5 28 C51.5 40.5 57 47.8 62 47.8 C68 47.8 71.8 40 69.2 30.6 C67 34 64 34.4 61 33.4 C58 32.4 55.2 30.6 52.5 28 Z" fill="#fbfaf6"/>
    <path d="M55 39.5 C57 43.5 61 45.6 64.5 44.8 M59 36.5 C60.5 40 63 41.6 66 41" fill="none" stroke="#dcd8d0" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M60.6 31.6 C62.8 29.6 66.8 29.6 69.2 31.8 C67 33.8 62.8 33.8 60.6 31.6 Z" fill="#f1efe9"/>
    <path d="M52.6 19.6 C50.6 10.4 42.4 7 35.4 11.6 C33.4 13.2 32.4 15.4 32.8 17.6 C37.6 15.6 42.6 16.6 47.6 20 Z" fill="url(#sleigh-coat)"/>
    <circle cx="32.8" cy="18.2" r="3.6" fill="#fbfaf6"/>
    <rect x="50.6" y="17" width="20.4" height="5.6" rx="2.8" fill="#fbfaf6"/>
    <path d="M44 64 h33 v4 h-33 Z" fill="#fbfaf6"/>
    <path d="M9 90 C4 72 6 56 14 50 L33 50 C37 62 47 67 63 67 L99 65 C108 65 112 71 107 81 C103 89 93 91 83 91 L17 91 Z" fill="url(#sleigh-red)"/>
    <path d="M14 50 C22 47.5 28 47.5 33 50" fill="none" stroke="url(#sleigh-gold)" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M34 79 c6 -9 15 -9 17 -1 c2 6 -6 9 -8.5 4.5 M63 76 c5 -6 12 -6 14 0 c1.5 4.5 -4.5 6.5 -6.5 3" fill="none" stroke="url(#sleigh-gold)" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M12 88 C40 89 80 89 104 82" fill="none" stroke="#f4c86a" stroke-width="1" opacity="0.55"/>
    <path d="M24 91 L27 100 M74 91 L70 100" stroke="url(#sleigh-gold)" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M3 100 L97 100 C113 100 117 87 109 81 C104 77 98 81 102 86" fill="none" stroke="url(#sleigh-gold)" stroke-width="3.6" stroke-linecap="round"/>
  </g>
</svg>`;

/**
 * Starts the sleigh on presses of a result row's actions inside `list`. `reducedMotion` is the media query.
 */
export function setUpSleigh({ list, reducedMotion, random = Math.random }) {
  let layer = null;
  let flight = null;

  function ensureLayer() {
    if (layer?.isConnected) return layer;
    layer = document.createElement('div');
    layer.className = 'sleigh-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
    return layer;
  }

  /** Where the pharmacy's name ends on screen: the sleigh takes off just above its last letters. */
  function nameEnd(heading) {
    const range = document.createRange();
    range.selectNodeContents(heading);
    const box = range.getBoundingClientRect();
    return { x: box.right, y: box.top };
  }

  function dust(x, y, burst = false) {
    const speck = document.createElement('span');
    speck.className = burst ? 'sleigh-dust sleigh-burst' : 'sleigh-dust';
    ensureLayer().append(speck);
    const angle = random() * Math.PI * 2;
    const reach = burst ? 18 + random() * 34 : 4 + random() * 10;
    const fall = burst ? random() * 10 : 14 + random() * 22;
    const size = burst ? 3 + random() * 4 : 2 + random() * 3.5;
    speck.style.setProperty('--size', `${size.toFixed(1)}px`);
    const from = `translate(${x - size / 2}px, ${y - size / 2}px)`;
    const animation = speck.animate(
      [
        { transform: `${from} scale(1)`, opacity: 1 },
        {
          transform: `${from} translate(${Math.cos(angle) * reach}px, ${Math.sin(angle) * reach + fall}px) scale(0.2)`,
          opacity: 0,
        },
      ],
      {
        duration: burst ? 700 + random() * 300 : 650 + random() * 450,
        easing: 'cubic-bezier(0.2, 0.6, 0.3, 1)',
      },
    );
    const done = () => speck.remove();
    animation.addEventListener('finish', done);
    animation.addEventListener('cancel', done);
  }

  function fly(heading, action) {
    flight?.stop();
    const sleigh = document.createElement('div');
    sleigh.className = 'sleigh';
    sleigh.innerHTML = sleighArt;
    ensureLayer().append(sleigh);
    const width = sleigh.offsetWidth;
    const height = sleigh.offsetHeight;
    const clamp = point => ({
      x: Math.min(Math.max(point.x, width / 2 + 6), innerWidth - width / 2 - 6),
      y: Math.max(point.y, height / 2 + 6),
    });
    // The sleigh appears just above the end of the name and comes to the action with the lead reindeer
    // above it, so neither the name nor the action is covered while it flies. Both points are shifted the
    // same way, so the sleigh always flies the way its reindeer face, even when the action is right under
    // the name, as on a phone.
    const anchors = (name, action) => {
      const target = { x: action.left + action.width / 2, y: action.top };
      const shift = (target.x < name.x ? -1 : 1) * width * 0.36;
      return [
        clamp({ x: name.x - shift, y: name.y - height * 0.42 }),
        clamp({ x: target.x - shift, y: target.y - height * 0.44 }),
      ];
    };
    let start = nameEnd(heading);
    let end = action.getBoundingClientRect();
    let began = null;
    let lastDust = 0;
    let frame = 0;

    function step(now) {
      began ??= now;
      const t = Math.min(1, (now - began) / duration);
      // Followed every frame: opening a panel or scrolling moves the name and the action.
      if (heading.isConnected) start = nameEnd(heading);
      if (action.isConnected) end = action.getBoundingClientRect();
      const target = { x: end.left + end.width / 2, y: end.top + end.height / 2 };
      const [from, to] = anchors(start, end);
      const { x, y, angle, leftwards } = flightAt(from, to, ease(t), height / 2 + 6);
      const bob = Math.sin(t * Math.PI * 7) * 2.5;
      const appear = Math.min(1, t / 0.14);
      const vanish = t > 0.84 ? (t - 0.84) / 0.16 : 0;
      const scale = (0.7 + 0.3 * appear) * (1 - 0.35 * vanish);
      sleigh.style.opacity = String(appear * (1 - vanish));
      sleigh.style.transform =
        `translate(${x - width / 2}px, ${y - height / 2 + bob}px) rotate(${angle}deg) ` +
        `scale(${leftwards ? -scale : scale}, ${scale})`;
      // Gold dust trails from the back of the sleigh.
      if (t < 0.86 && now - lastDust > dustEvery) {
        lastDust = now;
        const back = (leftwards ? 1 : -1) * width * 0.42;
        dust(x + back, y + height * 0.28 + bob);
      }
      if (t < 1) frame = requestAnimationFrame(step);
      else {
        for (let count = 0; count < 12; count++) dust(target.x, target.y, true);
        stop();
      }
    }
    function stop() {
      cancelAnimationFrame(frame);
      sleigh.remove();
      if (flight?.sleigh === sleigh) flight = null;
    }
    flight = { sleigh, stop };
    frame = requestAnimationFrame(step);
  }

  list.addEventListener('click', event => {
    if (reducedMotion.matches) return;
    const action = event.target.closest?.('.pharmacy-action a, .pharmacy-action button');
    const heading = action?.closest('li')?.querySelector('h3');
    if (heading) fly(heading, action);
  });
}
