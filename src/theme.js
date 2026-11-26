/**
 * Light and dark theme. theme-init.js applies the stored or system theme before the first paint; this module
 * keeps the toggle, the stored choice and the browser's theme colour in step, and follows the system until
 * the visitor chooses.
 */
const themeKey = 'pharmanear.theme';
const root = document.documentElement;

function storedTheme() {
  try {
    return localStorage.getItem(themeKey);
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(themeKey, theme);
  } catch {
    // Without storage the choice lasts until the page is closed.
  }
}

/** The new theme spreads in a circle from the button where the browser supports view transitions. */
function reveal(change, button, reducedMotion) {
  if (!document.startViewTransition || reducedMotion.matches) {
    change();
    return;
  }
  const { left, top, width, height } = button.getBoundingClientRect();
  const x = left + width / 2;
  const y = top + height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.dataset.transition = 'theme';
  const transition = document.startViewTransition(change);
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
  const done = () => delete root.dataset.transition;
  transition.finished.then(done, done);
}

export function setUpTheme({ toggle, reducedMotion }) {
  const systemDark = matchMedia('(prefers-color-scheme: dark)');

  function apply(theme) {
    root.dataset.theme = theme;
    toggle.setAttribute('aria-pressed', String(theme === 'dark'));
    document.querySelector('meta[name="theme-color"]').content = getComputedStyle(root)
      .getPropertyValue('--paper')
      .trim();
  }

  toggle.addEventListener('click', () => {
    const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    storeTheme(theme);
    reveal(() => apply(theme), toggle, reducedMotion);
  });
  systemDark.addEventListener('change', event => {
    if (!storedTheme()) apply(event.matches ? 'dark' : 'light');
  });
  apply(root.dataset.theme ?? (systemDark.matches ? 'dark' : 'light'));
}
