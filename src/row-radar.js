/**
 * Asks for compass access where the browser requires it (iOS Safari). Safari shows its prompt only during a
 * user gesture, so this runs inside the Radar click, before the view loads. Resolves to whether the compass
 * may be read.
 */
export function requestCompass(api = globalThis.DeviceOrientationEvent) {
  if (typeof api?.requestPermission !== 'function') return Promise.resolve(Boolean(api));
  try {
    return api.requestPermission(true).then(
      value => value === 'granted',
      () => false,
    );
  } catch {
    return Promise.resolve(false);
  }
}

/**
 * The radar inside a result row. One press of a row's Radar button opens and starts it, pointing to that
 * row's pharmacy; the same button closes it and closing returns focus there. One is open at a time, and an
 * open radar keeps running when the rows are rebuilt, moving into its pharmacy's new row. The view loads on
 * first use.
 *
 * `options()` gives the view's settings for the results on screen, plus the `loading` and `failed` texts, or
 * null when nothing can be shown. `onOpen` runs before a radar opens, so the page can close the map.
 * `compass` asks for compass access; it runs inside the click.
 */
export function createRowRadar({
  list,
  options,
  onOpen = () => {},
  load = () => import('./radar-view.js'),
  compass = requestCompass,
}) {
  const host = list.ownerDocument.createElement('div');
  host.className = 'radar-host';
  let view = null;
  let openId = null;
  // Every open and close starts a new generation, so a view that finishes loading too late is dropped.
  let generation = 0;

  const buttons = () => [...list.querySelectorAll('[data-radar-id]')];
  const buttonFor = id => buttons().find(button => button.dataset.radarId === id);

  function close(restoreFocus = false) {
    const id = openId;
    generation++;
    view?.close();
    view = null;
    openId = null;
    host.replaceChildren();
    host.remove();
    for (const button of buttons()) button.setAttribute('aria-expanded', 'false');
    if (restoreFocus && id) buttonFor(id)?.focus();
  }

  async function toggle(pharmacy) {
    if (openId === pharmacy.id) {
      close(true);
      return;
    }
    const settings = options();
    const button = buttonFor(pharmacy.id);
    if (!settings || !button) return;
    // Asked for now, while the click still counts as a gesture; the view starts with the answer.
    const compassAllowed = compass();
    close();
    onOpen();
    const { loading, failed, ...viewSettings } = settings;
    const current = ++generation;
    openId = pharmacy.id;
    button.setAttribute('aria-expanded', 'true');
    button.closest('li').append(host);
    host.textContent = loading;
    try {
      const { openRadar } = await load();
      if (current !== generation) return;
      host.replaceChildren();
      view = openRadar({
        ...viewSettings,
        container: host,
        targetId: pharmacy.id,
        compass: compassAllowed,
        onClose: () => close(true),
      });
    } catch {
      if (current !== generation) return;
      openId = null;
      button.setAttribute('aria-expanded', 'false');
      host.textContent = failed;
    }
  }

  /** After the rows are rebuilt: moves the open radar into its pharmacy's new row, or closes it. */
  function follow() {
    if (!openId) return;
    const button = buttonFor(openId);
    if (button) button.closest('li').append(host);
    else close();
  }

  return { toggle, close, follow, isOpen: id => openId === id };
}
