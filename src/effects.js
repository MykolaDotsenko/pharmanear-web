/**
 * Decorative pointer effects and page transitions. None of them carries information, every one is skipped
 * with reduced motion or without a fine hover pointer, and the script only sets custom properties, which
 * the stylesheet turns into light and depth (see styles/motion.css and styles/enhancements.css).
 */
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

/** Runs `update` once per frame at most, with the latest pointer event. */
function perFrame(update) {
  let frame = 0;
  let latest = null;
  return event => {
    latest = event;
    frame ||= requestAnimationFrame(() => {
      frame = 0;
      update(latest);
    });
  };
}

export function setUpEffects({ list, hero, reducedMotion }) {
  // A soft light follows a mouse pointer across a result card.
  list.addEventListener(
    'pointermove',
    perFrame(event => {
      if (event.pointerType !== 'mouse') return;
      const card = event.target.closest('.pharmacy');
      if (!card) return;
      const box = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${event.clientX - box.left}px`);
      card.style.setProperty('--my', `${event.clientY - box.top}px`);
    }),
  );

  // The artwork leans towards the pointer and its layers shift at different depths.
  const art = hero.querySelector('.landscape');
  const lean = (x, y) => {
    art.style.setProperty('--lean-x', x.toFixed(3));
    art.style.setProperty('--lean-y', y.toFixed(3));
  };
  hero.addEventListener(
    'pointermove',
    perFrame(event => {
      if (event.pointerType !== 'mouse' || !finePointer.matches || reducedMotion.matches) return;
      const box = art.getBoundingClientRect();
      const x = ((event.clientX - box.left) / box.width) * 2 - 1;
      const y = ((event.clientY - box.top) / box.height) * 2 - 1;
      lean(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));
    }),
  );
  hero.addEventListener('pointerleave', () => lean(0, 0));
}

/**
 * Applies `update` inside a view transition, so the hero settles into its compact form and the results
 * fade in, instead of the layout jumping. Without the API or with reduced motion, `update` runs at once.
 */
export function transition(update, reducedMotion) {
  const root = document.documentElement;
  if (!document.startViewTransition || reducedMotion.matches || root.dataset.transition) {
    update();
    return;
  }
  root.dataset.transition = 'outcome';
  const change = document.startViewTransition(update);
  const done = () => {
    if (root.dataset.transition === 'outcome') delete root.dataset.transition;
  };
  change.finished.then(done, done);
}
