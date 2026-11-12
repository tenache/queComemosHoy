// Tests for the wheel screen (js/wheel-view.js), run against a stub DOM:
// elements are plain objects, so the tests can find a button and call its
// onclick. They cover the screen's logic, not how it looks.

import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import { defaultState } from '../js/state.js';
import { WHEEL } from '../js/wheel.js';
import { createWheelView } from '../js/wheel-view.js';

function stubElement(tag, props = {}, children = []) {
  return {
    tag,
    props,
    children,
    style: {},
    listeners: {},
    isConnected: true,
    ...props,
    setAttribute(key, value) {
      this.props[key] = value;
    },
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    append(...more) {
      this.children.push(...more);
    },
  };
}

const h = (tag, props, ...children) => stubElement(tag, { ...props }, children.flat(Infinity).filter((c) => c != null && c !== false));
const button = (label, onclick, cls = '', props = {}) => h('button', { class: `btn ${cls}`.trim(), onclick, ...props }, label);

function* walk(node) {
  if (node == null || typeof node !== 'object') return;
  yield node;
  for (const child of node.children ?? []) yield* walk(child);
}
const textOf = (node) => (typeof node === 'string' ? node : (node?.children ?? []).map(textOf).join(''));
const findAll = (tree, test) => [...walk({ children: tree })].filter((n) => n.tag && test(n));
const findButton = (tree, label) => findAll(tree, (n) => n.tag === 'button' && textOf(n).includes(label))[0];

/** Opens the wheel screen on a fresh state. `screen.tree` is always the latest render. */
function openWheel({ reducedMotion = false } = {}) {
  const screen = { state: defaultState(), ui: { wheel: null }, tree: null, renders: 0 };
  const render = () => {
    screen.renders++;
    screen.tree = screen.ui.wheel ? view.view() : null;
  };
  const view = createWheelView({
    h,
    button,
    t: (key, vars = {}) => `${key}${Object.values(vars).join(',')}`,
    lang: 'es',
    ui: screen.ui,
    getState: () => screen.state,
    commit: render,
    render,
    reducedMotion: () => reducedMotion,
  });
  screen.view = view;
  view.open();
  return screen;
}

const spinEnd = () => new Promise((resolve) => setTimeout(resolve, WHEEL.spinMs + 200));
const realSpinMs = WHEEL.spinMs;
const realRandom = Math.random;

beforeEach(() => {
  WHEEL.spinMs = 20;
  const rotor = stubElement('g');
  globalThis.document = {
    createElementNS: (_ns, tag) => stubElement(tag),
    querySelector: () => rotor,
  };
  globalThis.window = { scrollTo() {} };
  globalThis.requestAnimationFrame = (fn) => fn();
});

afterEach(() => {
  WHEEL.spinMs = realSpinMs;
  Math.random = realRandom;
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.requestAnimationFrame;
});

test('a spin shows "Girando…", then the result that was picked before it started', async () => {
  const screen = openWheel();
  Math.random = () => 0.9; // lands on the last cuisine
  findButton(screen.tree, 'wheelSpin').props.onclick();

  assert.equal(screen.ui.wheel.spinning, true);
  assert.equal(findButton(screen.tree, 'wheelSpinning').props.disabled, true);
  assert.equal(findButton(screen.tree, 'wheelOrder'), undefined, 'no result yet');

  await spinEnd();
  assert.equal(screen.ui.wheel.spinning, false);
  assert.ok(textOf({ children: screen.tree }).includes('wheelLandedCuisineEmpanadas'));
  assert.equal(screen.state.deliveries.length, 0, 'spinning logs nothing');

  findButton(screen.tree, 'wheelOrder').props.onclick();
  assert.deepEqual(screen.state.deliveries.map((d) => d.cuisine), ['Empanadas'], 'only "¡Pedimos!" logs a delivery');
});

test('landing on "cook instead" offers to go and cook, and closes the wheel', async () => {
  const screen = openWheel();
  Math.random = () => 0.01;
  findButton(screen.tree, 'wheelSpin').props.onclick();
  await spinEnd();

  assert.ok(textOf({ children: screen.tree }).includes('wheelLandedCook'));
  findButton(screen.tree, 'wheelSeeCooking').props.onclick();
  assert.equal(screen.ui.wheel, null);
  assert.equal(screen.state.deliveries.length, 0);
});

test('the cuisines and the history cannot be used while the wheel is spinning', async () => {
  const screen = openWheel();
  const folds = () => findAll(screen.tree, (n) => n.tag === 'details');
  assert.deepEqual(folds().map((f) => Boolean(f.props.inert)), [false, false]);

  findButton(screen.tree, 'wheelSpin').props.onclick();
  assert.deepEqual(folds().map((f) => f.props.inert), [true, true]);

  await spinEnd();
  assert.deepEqual(folds().map((f) => Boolean(f.props.inert)), [false, false]);
});

test('an edit that lands during a spin does not break the result', async () => {
  // The folds are inert during a spin, but the state can still change under
  // the wheel (another tab saving, say). Each of these used to crash the
  // render at the end of the spin and leave the screen stuck on "Girando…".
  const edits = {
    'delete a delivery': (screen) => findAll(screen.tree, (n) => n.tag === 'li' && n.props.class === 'shop-row')[0].children.at(-1).props.onclick(),
    'remove a cuisine': (screen) => findAll(screen.tree, (n) => n.tag === 'li' && n.props.class === 'edit-row')[0].children.at(-1).props.onclick(),
    'add a cuisine': (screen) => {
      const form = findAll(screen.tree, (n) => n.tag === 'form' && n.props.class === 'add-row')[0];
      form.children[0].value = 'Thai';
      form.props.onsubmit({ preventDefault() {} });
    },
    'set the count': (screen) => {
      const form = findAll(screen.tree, (n) => n.tag === 'form' && n.props.class === 'field')[0];
      findAll([form], (n) => n.tag === 'input')[0].value = '9';
      form.props.onsubmit({ preventDefault() {} });
    },
  };

  for (const [name, edit] of Object.entries(edits)) {
    const screen = openWheel();
    screen.state.deliveries.push({ time: Date.now() - 1000, cuisine: 'Pizza' });
    Math.random = () => 0.9;
    findButton(screen.tree, 'wheelSpin').props.onclick();
    const spun = screen.ui.wheel.slices;
    const before = JSON.stringify([screen.state.cuisines, screen.state.deliveries]);

    edit(screen);
    assert.notEqual(JSON.stringify([screen.state.cuisines, screen.state.deliveries]), before, `${name}: the edit went through`);
    await spinEnd();

    const w = screen.ui.wheel;
    assert.equal(w.spinning, false, `${name}: the spin ended`);
    assert.equal(w.slices, spun, `${name}: the result is read from the wheel that was spun`);
    assert.ok(textOf({ children: screen.tree }).includes('wheelLandedCuisineEmpanadas'), `${name}: the result is shown`);
    assert.ok(findButton(screen.tree, 'wheelSpinAgain'), `${name}: and the buttons with it`);
  }
});

test('a re-render during a spin keeps the same wheel element', async () => {
  const screen = openWheel();
  const wheelOf = () => findAll(screen.tree, (n) => n.props.class === 'wheel-wrap')[0].children[0];
  const idle = wheelOf();

  findButton(screen.tree, 'wheelSpin').props.onclick();
  const spinning = wheelOf();
  assert.notEqual(spinning, idle, 'the spin draws the wheel it spins');
  screen.ui.wheel.error = 'x';
  screen.view.view();
  screen.tree = screen.view.view();
  assert.equal(wheelOf(), spinning, 'not redrawn at the starting angle');

  await spinEnd();
  assert.notEqual(wheelOf(), spinning, 'redrawn at the final angle once it stops');
});

test('reduced motion: the result shows at once, with no timer', () => {
  const screen = openWheel({ reducedMotion: true });
  Math.random = () => 0.9;
  findButton(screen.tree, 'wheelSpin').props.onclick();
  assert.equal(screen.ui.wheel.spinning, false);
  assert.ok(findButton(screen.tree, 'wheelOrder'));
});

test('closing the wheel during a spin cancels the result', async () => {
  const screen = openWheel();
  findButton(screen.tree, 'wheelSpin').props.onclick();
  screen.view.close();
  const renders = screen.renders;
  await spinEnd();
  assert.equal(screen.ui.wheel, null);
  assert.equal(screen.renders, renders, 'nothing is drawn after closing');
});
