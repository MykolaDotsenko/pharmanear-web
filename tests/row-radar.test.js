import test from 'node:test';
import assert from 'node:assert/strict';
import { createRowRadar } from '../src/row-radar.js';

/** Just enough DOM for the row radar: a list of rows, each with a Radar button. */
function fakeList(ids) {
  const node = () => ({
    children: [],
    parent: null,
    textContent: '',
    append(child) {
      child.remove?.();
      child.parent = this;
      this.children.push(child);
    },
    replaceChildren() {
      this.children = [];
      this.textContent = '';
    },
  });
  const rows = new Map();
  const focused = [];
  let buttons = [];
  const list = {
    ownerDocument: {
      createElement() {
        const host = node();
        host.remove = () => {
          if (!host.parent) return;
          host.parent.children = host.parent.children.filter(child => child !== host);
          host.parent = null;
        };
        return host;
      },
    },
    querySelectorAll: () => buttons,
  };
  const render = () => {
    buttons = ids.map(id => {
      const row = node();
      rows.set(id, row);
      const attributes = {};
      return {
        dataset: { radarId: id },
        setAttribute: (name, value) => (attributes[name] = value),
        expanded: () => attributes['aria-expanded'],
        closest: () => row,
        focus: () => focused.push(id),
      };
    });
  };
  render();
  return {
    list,
    focused,
    render,
    remove: id => {
      ids = ids.filter(other => other !== id);
      render();
    },
    button: id => buttons.find(button => button.dataset.radarId === id),
    hostIn: id => rows.get(id).children.find(child => child.className === 'radar-host'),
  };
}

function setUp({ ids = ['a', 'b'], load } = {}) {
  const dom = fakeList(ids);
  const opened = [];
  const closed = [];
  let mapsClosed = 0;
  const radar = createRowRadar({
    list: dom.list,
    options: () => ({ pharmacies: [], language: 'en', loading: 'Loading', failed: 'Failed' }),
    onOpen: () => mapsClosed++,
    load:
      load ??
      (async () => ({
        openRadar(settings) {
          opened.push(settings);
          return { close: () => closed.push(settings.targetId) };
        },
      })),
  });
  return { dom, radar, opened, closed, maps: () => mapsClosed };
}

test('opens in the chosen row, one at a time, and closes the map first', async () => {
  const { dom, radar, opened, closed, maps } = setUp();
  await radar.toggle({ id: 'a' });
  assert.equal(opened.at(-1).targetId, 'a');
  assert.equal(opened.at(-1).language, 'en');
  assert.equal(opened.at(-1).loading, undefined);
  assert.ok(dom.hostIn('a'));
  assert.equal(dom.button('a').expanded(), 'true');
  assert.equal(maps(), 1);

  await radar.toggle({ id: 'b' });
  assert.deepEqual(closed, ['a']);
  assert.equal(dom.hostIn('a'), undefined);
  assert.ok(dom.hostIn('b'));
  assert.equal(dom.button('a').expanded(), 'false');
  assert.equal(dom.button('b').expanded(), 'true');
  assert.ok(radar.isOpen('b') && !radar.isOpen('a'));
});

test('its own button and its close button close it and return focus to the button', async () => {
  const { dom, radar, opened, closed } = setUp();
  await radar.toggle({ id: 'a' });
  await radar.toggle({ id: 'a' });
  assert.deepEqual(closed, ['a']);
  assert.deepEqual(dom.focused, ['a']);
  assert.equal(dom.hostIn('a'), undefined);

  await radar.toggle({ id: 'b' });
  opened.at(-1).onClose();
  assert.deepEqual(dom.focused, ['a', 'b']);
  assert.equal(radar.isOpen('b'), false);
});

test('a view that loads after the radar was closed or moved is dropped', async () => {
  let finish;
  const { dom, radar, opened } = setUp({
    load: () =>
      new Promise(resolve => {
        finish = () => resolve({ openRadar: settings => (opened.push(settings), { close() {} }) });
      }),
  });
  const pending = radar.toggle({ id: 'a' });
  assert.equal(dom.hostIn('a').textContent, 'Loading');
  radar.close();
  finish();
  await pending;
  assert.deepEqual(opened, []);
  assert.equal(dom.hostIn('a'), undefined);
});

test('a failed load says so and leaves the button collapsed', async () => {
  const { dom, radar } = setUp({ load: () => Promise.reject(new Error('offline')) });
  await radar.toggle({ id: 'a' });
  assert.equal(dom.hostIn('a').textContent, 'Failed');
  assert.equal(dom.button('a').expanded(), 'false');
  assert.equal(radar.isOpen('a'), false);
});

test('rebuilt rows take the open radar along, and a row that went closes it', async () => {
  const { dom, radar, closed } = setUp();
  await radar.toggle({ id: 'b' });
  dom.render();
  radar.follow();
  assert.ok(dom.hostIn('b'));
  assert.deepEqual(closed, []);

  dom.remove('b');
  radar.follow();
  assert.deepEqual(closed, ['b']);
  assert.equal(radar.isOpen('b'), false);
});

test('nothing opens when there are no results to show', async () => {
  const dom = fakeList(['a']);
  let loads = 0;
  const radar = createRowRadar({
    list: dom.list,
    options: () => false,
    load: async () => (loads++, {}),
  });
  await radar.toggle({ id: 'a' });
  assert.equal(loads, 0);
  assert.equal(dom.hostIn('a'), undefined);
});

test('one press asks for the compass inside the click and starts the view with the answer', async () => {
  const dom = fakeList(['a']);
  const asked = [];
  const opened = [];
  const radar = createRowRadar({
    list: dom.list,
    options: () => ({ loading: 'Loading', failed: 'Failed' }),
    compass: () => {
      asked.push('compass');
      return Promise.resolve(true);
    },
    load: async () => ({ openRadar: settings => (opened.push(settings), { close() {} }) }),
  });
  const pending = radar.toggle({ id: 'a' });
  // Synchronously, before the view has loaded: Safari shows its prompt only during the gesture.
  assert.deepEqual(asked, ['compass']);
  await pending;
  assert.equal(await opened[0].compass, true);
  // Closing asks for nothing.
  await radar.toggle({ id: 'a' });
  assert.deepEqual(asked, ['compass']);
});
