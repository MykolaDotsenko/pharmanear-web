/**
 * Seasonal extras: a string of lights, falling snow and a short melody. All of it is decorative, starts only
 * on request, makes no network request and stays out of the accessibility tree.
 */

const svgNS = 'http://www.w3.org/2000/svg';

/** A string of lights along the header rule: one scallop per bulb, so bulbs hang at the low points. */
export function buildGarland(container, bulbs = 18) {
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

  const lights = document.createElement('div');
  lights.className = 'garland-bulbs';
  for (let index = 0; index < bulbs; index++) lights.append(document.createElement('i'));
  container.replaceChildren(wire, lights);
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
const jingleBells = [
  ['E5', 1], ['E5', 1], ['E5', 2], ['E5', 1], ['E5', 1], ['E5', 2],
  ['E5', 1], ['G5', 1], ['C5', 1.5], ['D5', 0.5], ['E5', 4],
  ['F5', 1], ['F5', 1], ['F5', 1.5], ['F5', 0.5], ['F5', 1], ['E5', 1], ['E5', 1], ['E5', 0.5], ['E5', 0.5],
  ['E5', 1], ['D5', 1], ['D5', 1], ['E5', 1], ['D5', 2], ['G5', 2],
  ['E5', 1], ['E5', 1], ['E5', 2], ['E5', 1], ['E5', 1], ['E5', 2],
  ['E5', 1], ['G5', 1], ['C5', 1.5], ['D5', 0.5], ['E5', 4],
  ['F5', 1], ['F5', 1], ['F5', 1.5], ['F5', 0.5], ['F5', 1], ['E5', 1], ['E5', 1], ['E5', 0.5], ['E5', 0.5],
  ['G5', 1], ['G5', 1], ['F5', 1], ['D5', 1], ['C5', 4],
]; // prettier-ignore

const frequencies = { C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99 };
const beat = 0.4;

/** Total length of the melody in seconds. */
export const melodyDuration = jingleBells.reduce((sum, [, beats]) => sum + beats, 0) * beat;

/**
 * A soft music-box rendition with the Web Audio API: each note is a sine with a quieter octave above it and
 * a bell-like decay. It plays once; `stop` silences it at once.
 */
export function createMelody({ onEnd = () => {} } = {}) {
  let audio = null;
  let output = null;
  let timer = 0;

  function stop() {
    clearTimeout(timer);
    if (!output) return;
    const fading = output;
    output = null;
    fading.gain.setTargetAtTime(0, audio.currentTime, 0.03);
    setTimeout(() => fading.disconnect(), 200);
  }

  return {
    get playing() {
      return output !== null;
    },
    async play() {
      stop();
      audio ??= new AudioContext();
      await audio.resume();
      output = audio.createGain();
      output.gain.value = 0.16;
      output.connect(audio.destination);

      let at = audio.currentTime + 0.05;
      for (const [note, beats] of jingleBells) {
        const length = beats * beat;
        for (const [multiple, level] of [
          [1, 1],
          [2, 0.25],
        ]) {
          const tone = audio.createOscillator();
          const envelope = audio.createGain();
          tone.frequency.value = frequencies[note] * multiple;
          envelope.gain.setValueAtTime(0.0001, at);
          envelope.gain.exponentialRampToValueAtTime(level, at + 0.01);
          envelope.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(length, 0.35) * 0.95);
          tone.connect(envelope).connect(output);
          tone.start(at);
          tone.stop(at + Math.max(length, 0.35));
        }
        at += length;
      }
      timer = setTimeout(
        () => {
          stop();
          onEnd();
        },
        (at - audio.currentTime) * 1000,
      );
    },
    stop,
  };
}
