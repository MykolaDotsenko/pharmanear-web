// Runs before the first paint, so the page never flashes the wrong theme or season.
// A classic script rather than a module: modules are deferred until after parsing.
(function () {
  const root = document.documentElement;
  let theme = null;
  try {
    theme = localStorage.getItem('pharmanear.theme');
  } catch {
    // Storage can be unavailable (private browsing, blocked site data); the system theme applies.
  }
  if (theme !== 'light' && theme !== 'dark') {
    theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  root.dataset.theme = theme;

  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  if ((month === 11 && day >= 25) || month === 12 || (month === 1 && day <= 6)) {
    root.dataset.season = 'christmas';
  }
})();
