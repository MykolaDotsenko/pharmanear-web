/**
 * The radar inside a result row. One is open at a time: its row's Radar button opens and closes it, closing
 * returns focus to that button, and an open radar keeps running when the rows are rebuilt, moving into its
 * pharmacy's new row. The view loads on first use.
 *
 * `options()` gives the view's settings for the results on screen, plus the `loading` and `failed` texts, or
 * null when nothing can be shown. `onOpen` runs before a radar opens, so the page can close the map.
 */
export function createRowRadar({ list, options, onOpen = () => {}, load = () => import('./radar-view.js') }) {
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
