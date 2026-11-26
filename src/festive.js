/**
 * Seasonal extras: a string of lights, falling snow and a short melody. All of it is decorative, starts only
 * on request, makes no network request and stays out of the accessibility tree.
 */

const svgNS = 'http://www.w3.org/2000/svg';

/** A string of lights along the header rule: one scallop per bulb, so bulbs hang at the low points. */
export function buildGarland(container, bulbs = 18, random = Math.random) {
  const wire = document.createElementNS(svgNS, 'svg');
  wire.setAttribute('viewBox', `0 0 ${bulbs * 40} 14`);
  wire.setAttribute('preserveAspectRatio', 'none');
  wire.classList.add('garland-wire');
  const path = document.createElementNS(svgNS, 'path');
  let d = 'M0 1';
  for (let index = 0; index < bulbs; index++) d += ` q20 14 40 0`;
  path.setAttribute('d', d);
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  wire.append(path);

  // Real strings of lights drift apart, so each bulb gets its own rhythm, and every fifth one flickers.
  const lights = document.createElement('div');
  lights.className = 'garland-bulbs';
  for (let index = 0; index < bulbs; index++) {
    const bulb = document.createElement('i');
    bulb.style.setProperty('--dur', `${(2.2 + random() * 2.6).toFixed(2)}s`);
    bulb.style.setProperty('--delay', `${(-random() * 4).toFixed(2)}s`);
    if (index % 5 === 3) bulb.classList.add('flicker');
    lights.append(bulb);
  }
  container.replaceChildren(wire, lights);
  container.dataset.lights = 'on';
}

/**
 * Falling snow on a full-window canvas. With reduced motion the flakes are drawn once and stay still.
 * Drawing stops while the tab is hidden.
 */
export function createSnowfall(canvas, { reducedMotion }) {
  const context = canvas.getContext('2d');
  let flakes = [];
  let frame = 0;
  let running = false;
  let last = 0;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * ratio);
    canvas.height = Math.round(innerHeight * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.min(160, Math.round((innerWidth * innerHeight) / 9000));
    flakes = Array.from({ length: count }, () => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      radius: 1 + Math.random() * 2.6,
      speed: 18 + Math.random() * 42,
      drift: Math.random() * Math.PI * 2,
    }));
  }

  function draw() {
    context.clearRect(0, 0, innerWidth, innerHeight);
    context.fillStyle = getComputedStyle(canvas).color;
    // Slightly translucent, so text under a flake stays readable.
    context.globalAlpha = 0.8;
    context.beginPath();
    for (const flake of flakes) {
      context.moveTo(flake.x + flake.radius, flake.y);
      context.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
    }
    context.fill();
  }

  function step(time) {
    const seconds = Math.min((time - (last || time)) / 1000, 0.1);
    last = time;
    for (const flake of flakes) {
      flake.drift += seconds;
      flake.y += flake.speed * seconds;
      flake.x += Math.sin(flake.drift) * 12 * seconds;
      if (flake.y > innerHeight + 4) {
        flake.y = -4;
        flake.x = Math.random() * innerWidth;
      }
    }
    draw();
    frame = requestAnimationFrame(step);
  }

  function animate() {
    cancelAnimationFrame(frame);
    last = 0;
    if (running && !reducedMotion && !document.hidden) frame = requestAnimationFrame(step);
  }

  function onResize() {
    resize();
    draw();
  }

  return {
    get running() {
      return running;
    },
    start() {
      running = true;
      canvas.hidden = false;
      resize();
      draw();
      animate();
      addEventListener('resize', onResize);
      document.addEventListener('visibilitychange', animate);
    },
    stop() {
      running = false;
      cancelAnimationFrame(frame);
      canvas.hidden = true;
      removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', animate);
    },
  };
}

// "Jingle Bells" chorus (James Lord Pierpont, 1857; public domain) in C, as [note, beats].
const tune = [
  ['E5', 1], ['E5', 1], ['E5', 2], ['E5', 1], ['E5', 1], ['E5', 2],
  ['E5', 1], ['G5', 1], ['C5', 1.5], ['D5', 0.5], ['E5', 4],
  ['F5', 1], ['F5', 1], ['F5', 1.5], ['F5', 0.5], ['F5', 1], ['E5', 1], ['E5', 1], ['E5', 0.5], ['E5', 0.5],
  ['E5', 1], ['D5', 1], ['D5', 1], ['E5', 1], ['D5', 2], ['G5', 2],
  ['E5', 1], ['E5', 1], ['E5', 2], ['E5', 1], ['E5', 1], ['E5', 2],
  ['E5', 1], ['G5', 1], ['C5', 1.5], ['D5', 0.5], ['E5', 4],
  ['F5', 1], ['F5', 1], ['F5', 1.5], ['F5', 0.5], ['F5', 1], ['E5', 1], ['E5', 1], ['E5', 0.5], ['E5', 0.5],
  ['G5', 1], ['G5', 1], ['F5', 1], ['D5', 1], ['C5', 4],
]; // prettier-ignore

// The chorus's usual harmony, one chord per bar: a bass note on beats 1 and 3, the chord on 2 and 4.
const changes = ['C', 'C', 'C', 'C', 'F', 'C', 'D7', 'G7', 'C', 'C', 'C', 'C', 'F', 'C', 'G7', 'C'];
const chords = {
  C: { bass: ['C3', 'G2'], tones: ['G3', 'C4', 'E4'] },
  F: { bass: ['F2', 'C3'], tones: ['A3', 'C4', 'F4'] },
  D7: { bass: ['D3', 'A2'], tones: ['F#3', 'A3', 'C4'] },
  G7: { bass: ['G2', 'D3'], tones: ['B3', 'D4', 'F4'] },
};

/**
 * Voices as additive partials: frequency ratio, level and decay time constant in seconds. The melody is a
 * celesta-like struck bar, its upper partials slightly sharp and dying sooner, with a faintly detuned copy of
 * the fundamental for the shimmer of a real instrument. The accompaniment is rounder and quieter.
 */
const celesta = [
  { ratio: 1, level: 1, decay: 1.2 },
  { ratio: 1.0016, level: 0.16, decay: 1.2 },
  { ratio: 2.004, level: 0.3, decay: 0.55 },
  { ratio: 3.012, level: 0.1, decay: 0.3 },
  { ratio: 4.24, level: 0.045, decay: 0.14 },
];
const round = [
  { ratio: 1, level: 1, decay: 0.8 },
  { ratio: 2.002, level: 0.16, decay: 0.35 },
];

const beat = 0.38;
const bars = changes.length;
// The last two bars slow down by up to a third, as a player would end.
const slowFrom = (bars - 2) * 4;
const slowing = 0.35;
// The final chord rings out for this long after its beat.
const ringOut = 2.6;

/** Seconds from the start to `position`, in beats, including the closing ritardando. */
function timeAt(position) {
  const late = Math.max(0, position - slowFrom);
  return (position - late) * beat + beat * (late + (slowing * late * late) / 16);
}

/** Total length of the melody in seconds, until the last chord has rung out. */
export const melodyDuration = timeAt(bars * 4) + ringOut;

const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function frequency(note) {
  const [, letter, sharp, octave] = /^([A-G])(#?)(\d)$/.exec(note);
  const midi = 12 * (Number(octave) + 1) + semitones[letter] + (sharp ? 1 : 0);
  return 440 * 2 ** ((midi - 69) / 12);
}

/** A small room: stereo noise that decays and darkens, as later reflections do. */
function roomImpulse(audio, random, seconds = 2.2) {
  const rate = audio.sampleRate;
  const length = Math.floor(rate * seconds);
  const impulse = audio.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let smooth = 0;
    for (let index = 0; index < length; index++) {
      const time = index / rate;
      const darkening = 0.2 + 0.7 * (time / seconds);
      smooth += (random() * 2 - 1 - smooth) * (1 - darkening);
      data[index] = smooth * Math.exp(-3.4 * time);
    }
  }
  return impulse;
}

/**
 * Schedules the whole arrangement on `audio` from `start`, into `destination`, and returns its master gain
 * so it can be faded out. Live playback and the offline test share it, so the test hears what visitors do.
 * `random` humanizes timing and touch, and seeds the room.
 */
export function scheduleMelody(
  audio,
  destination,
  { start = audio.currentTime + 0.05, random = Math.random } = {},
) {
  const master = audio.createGain();
  master.gain.value = 0.22;
  const compressor = audio.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 18;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.2;
  const tone = audio.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 7000;
  tone.Q.value = 0.5;
  const room = audio.createConvolver();
  room.buffer = roomImpulse(audio, random);
  const wet = audio.createGain();
  wet.gain.value = 0.3;
  tone.connect(compressor);
  tone.connect(room).connect(wet).connect(compressor);
  compressor.connect(master).connect(destination);

  function voice(pan) {
    const panner = audio.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(tone);
    return { panner, last: null };
  }
  const melody = voice(0.05);
  const bass = voice(-0.22);
  const harmony = voice(0.26);
  const bells = voice(0);

  // Each voice damps its previous note when it strikes the next, like a damper, so repeats never pile up.
  // The celesta's hammer is quick; the accompaniment swells in gently, which also avoids clicks.
  function strike(part, note, at, velocity, partials, attack = partials === celesta ? 0.004 : 0.018) {
    const pitch = frequency(note);
    // Lower notes ring longer, as longer bars do.
    const sustain = (523 / pitch) ** 0.3;
    const envelopes = partials.map(({ ratio, level, decay }) => {
      const oscillator = audio.createOscillator();
      oscillator.frequency.value = pitch * ratio;
      const envelope = audio.createGain();
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(level * velocity, at + attack);
      envelope.gain.setTargetAtTime(0, at + attack, decay * sustain);
      oscillator.connect(envelope).connect(part.panner);
      oscillator.start(at);
      oscillator.stop(at + Math.min(6 * decay * sustain, 4) + 0.05);
      return envelope;
    });
    for (const envelope of part.last ?? []) envelope.gain.setTargetAtTime(0, at, 0.06);
    part.last = envelopes;
  }

  const noise = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.25), audio.sampleRate);
  const samples = noise.getChannelData(0);
  for (let index = 0; index < samples.length; index++) samples[index] = random() * 2 - 1;

  // A short band of noise: the felt hammer's tick on a celesta note, or a shake of sleigh bells.
  function burst(at, level, centre, length) {
    const source = audio.createBufferSource();
    source.buffer = noise;
    source.playbackRate.value = 0.8 + random() * 0.4;
    const band = audio.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = centre;
    band.Q.value = 1.4;
    const envelope = audio.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(level, at + 0.003);
    envelope.gain.setTargetAtTime(0, at + 0.003, length / 3);
    source.connect(band).connect(envelope).connect(bells.panner);
    source.start(at);
    source.stop(at + length + 0.05);
  }

  const human = (spread = 0.006) => (random() * 2 - 1) * spread;
  const touch = base => base * (0.93 + random() * 0.14);
  const at = position => start + timeAt(position) + (position > 0 ? human() : 0);

  let position = 0;
  for (const [note, beats] of tune) {
    const onBeat = position % 1 === 0;
    const accent = position % 4 === 0 ? 1 : position % 2 === 0 ? 0.86 : onBeat ? 0.76 : 0.68;
    const time = at(position);
    strike(melody, note, time, touch(accent * (beats >= 2 ? 1.05 : 1)), celesta);
    burst(time, 0.05 * accent, 3600, 0.012);
    position += beats;
  }

  changes.forEach((name, bar) => {
    const { bass: notes, tones } = chords[name];
    const first = bar * 4;
    const last = bar === bars - 1;
    strike(bass, notes[0], at(first), touch(0.42), round);
    if (last) {
      // The closing chord is rolled from the bottom, as a hand plays it.
      tones.forEach((note, index) =>
        strike(harmony, note, at(first) + 0.03 * (index + 1), touch(0.26), round),
      );
      return;
    }
    strike(bass, notes[1], at(first + 2), touch(0.34), round);
    for (const offset of [1, 3]) {
      const chordTime = at(first + offset);
      tones.forEach(note => strike(harmony, note, chordTime, touch(0.17), round));
      // Two quick shakes of sleigh bells on the off-beats.
      burst(chordTime, 0.06, 7200, 0.07);
      burst(chordTime + 0.045 + human(0.01), 0.04, 6400, 0.06);
    }
  });

  return master;
}

/**
 * The arrangement as a short Web Audio performance. It plays once; `stop` fades it out at once.
 */
export function createMelody({ onEnd = () => {} } = {}) {
  let audio = null;
  let output = null;
  let timer = 0;
  let generation = 0;
  let starting = false;

  function stop() {
    generation++;
    starting = false;
    clearTimeout(timer);
    if (!output) return;
    const fading = output;
    output = null;
    fading.gain.setTargetAtTime(0, audio.currentTime, 0.05);
    setTimeout(() => fading.disconnect(), 400);
  }

  return {
    get playing() {
      return starting || output !== null;
    },
    async play() {
      stop();
      const attempt = generation;
      starting = true;
      try {
        audio ??= new AudioContext();
        await audio.resume();
      } finally {
        if (attempt === generation) starting = false;
      }
      // Turned off while the audio was still starting: nothing is scheduled.
      if (attempt !== generation) return;
      const start = audio.currentTime + 0.05;
      output = scheduleMelody(audio, audio.destination, { start });
      timer = setTimeout(
        () => {
          stop();
          onEnd();
        },
        (start + melodyDuration - audio.currentTime) * 1000,
      );
    },
    stop,
  };
}

const flakeShape =
  'M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5M3.6 10.6 7 9.7 6 6.4M20.4 13.4 17 14.3l1 3.3M3.6 13.4l3.4.9-1 3.3M20.4 10.6l-3.4-.9 1-3.3';
const sparkleShape = 'M12 2.5 13.6 10.4 21.5 12 13.6 13.6 12 21.5 10.4 13.6 2.5 12 10.4 10.4Z';
// Enough flakes to feel generous, few enough that a fast mouse never floods the page.
const maximumFlakes = 30;
const flakeInterval = 50;

/**
 * Snowflakes, with the odd golden sparkle, fly out from the pointer over `art`: up and away, turning, then
 * drifting down as they fade. A touch makes a small burst. They live in a fixed layer that never widens the
 * page, last under two and a half seconds, and never appear with reduced motion.
 */
export function setUpFlakes(art, { reducedMotion, random = Math.random }) {
  let layer = null;
  let alive = 0;
  let last = 0;

  function spawn(x, y) {
    if (alive >= maximumFlakes) return;
    if (!layer?.isConnected) {
      layer = document.createElement('div');
      layer.className = 'flake-layer';
      layer.setAttribute('aria-hidden', 'true');
      document.body.append(layer);
    }
    const sparkle = random() < 0.25;
    const size = sparkle ? 11 + random() * 8 : 16 + random() * 16;
    const flake = document.createElementNS(svgNS, 'svg');
    flake.setAttribute('viewBox', '0 0 24 24');
    flake.classList.add('flake');
    if (sparkle) flake.classList.add('sparkle');
    flake.style.setProperty('--size', `${size.toFixed(1)}px`);
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', sparkle ? sparkleShape : flakeShape);
    if (sparkle) path.setAttribute('fill', 'currentColor');
    else {
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.7');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
    }
    flake.append(path);
    layer.append(flake);
    alive++;

    const angle = random() * Math.PI * 2;
    const reach = 28 + random() * 52;
    const away = Math.cos(angle) * reach;
    const rise = -(18 + random() * 36);
    const fall = 46 + random() * 40;
    const drift = (random() - 0.5) * 40;
    const spin = (random() < 0.5 ? -1 : 1) * (120 + random() * 200);
    const from = `translate(${x - size / 2}px, ${y - size / 2}px)`;
    const flight = flake.animate(
      [
        { transform: `${from} scale(0.2) rotate(0deg)`, opacity: 0 },
        {
          transform: `${from} translate(${away * 0.55}px, ${rise}px) scale(1) rotate(${spin * 0.35}deg)`,
          opacity: 1,
          offset: 0.3,
        },
        {
          transform: `${from} translate(${away + drift}px, ${rise + fall}px) scale(0.55) rotate(${spin}deg)`,
          opacity: 0,
        },
      ],
      { duration: 1500 + random() * 900, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
    );
    const done = () => {
      flake.remove();
      alive--;
    };
    flight.addEventListener('finish', done);
    flight.addEventListener('cancel', done);
  }

  art.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || reducedMotion.matches) return;
    if (event.timeStamp - last < flakeInterval) return;
    last = event.timeStamp;
    spawn(event.clientX, event.clientY);
  });
  art.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' || reducedMotion.matches) return;
    for (let count = 0; count < 7; count++) spawn(event.clientX, event.clientY);
  });
}

/**
 * Wires the seasonal extras to their toggle buttons. The lights glow at once and their button switches them
 * off; snow and the melody start only when pressed; each button's aria-pressed says whether its extra is on.
 * `reducedMotion` is the media query list, read whenever motion would start.
 */
export function setUpSeason({ garland, lightsButton, snowButton, melodyButton, canvas, art, reducedMotion }) {
  buildGarland(garland);
  lightsButton.addEventListener('click', () => {
    const on = garland.dataset.lights !== 'on';
    garland.dataset.lights = on ? 'on' : 'off';
    lightsButton.setAttribute('aria-pressed', String(on));
  });
  setUpFlakes(art, { reducedMotion });
  const snow = createSnowfall(canvas, { reducedMotion: reducedMotion.matches });
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
      melodyButton.setAttribute('aria-pressed', String(melody.playing));
    }
  });
}
