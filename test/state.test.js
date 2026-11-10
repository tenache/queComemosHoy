// Tests for the state helpers and the storage wrapper (with a fake localStorage).

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ACTIONS, probabilities } from '../js/scoring.js';
import {
  SCHEMA_VERSION,
  allIngredients,
  defaultState,
  isMissing,
  logAfterMeal,
  logCardAction,
  markInStock,
  markMissing,
  normalizeState,
} from '../js/state.js';
import { STORAGE_KEY, loadState, saveState } from '../js/storage.js';

const NOW = Date.UTC(2026, 10, 10, 20, 0, 0);

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    data,
  };
}
const brokenStorage = {
  getItem() {
    throw new Error('denied');
  },
  setItem() {
    throw new Error('quota');
  },
};

test('card actions: each one logs an event and moves liking as the spec table says', () => {
  const state = defaultState();
  const liking = (id) => state.dishes.find((d) => d.id === id).liking;

  logCardAction(state, 'lentejas', ACTIONS.COOK, [], NOW);
  logCardAction(state, 'pollo-curry', ACTIONS.COOK_ANYWAY, ['Curry ', 'crema'], NOW);
  logCardAction(state, 'paella', ACTIONS.MISSING_REJECT, ['mariscos'], NOW);
  logCardAction(state, 'asado', ACTIONS.REJECT, [], NOW);

  assert.equal(liking('lentejas'), 0.2);
  assert.equal(liking('pollo-curry'), 0.5);
  assert.equal(liking('paella'), -0.08);
  assert.equal(liking('asado'), -0.25);
  assert.deepEqual(
    state.events.map((e) => [e.dishId, e.action, e.time, e.missing]),
    [
      ['lentejas', 'cook', NOW, []],
      ['pollo-curry', 'cookAnyway', NOW, ['curry', 'crema']],
      ['paella', 'missingReject', NOW, ['mariscos']],
      ['asado', 'reject', NOW, []],
    ],
  );
  assert.deepEqual(state.missing, ['curry', 'crema', 'mariscos'], 'tapped items are on the shopping list');
});

test('liking is clamped to [-2, 2] however often an action repeats', () => {
  const state = defaultState();
  for (let i = 0; i < 50; i++) logCardAction(state, 'asado', ACTIONS.REJECT, [], NOW);
  for (let i = 0; i < 50; i++) logCardAction(state, 'lentejas', ACTIONS.COOK_ANYWAY, [], NOW);
  assert.equal(state.dishes.find((d) => d.id === 'asado').liking, -2);
  assert.equal(state.dishes.find((d) => d.id === 'lentejas').liking, 2);
});

test('after-meal answer: moves yum by 0.25 within 1 to 5 and adds what ran out', () => {
  const state = defaultState();
  const meal = logCardAction(state, 'lentejas', ACTIONS.COOK, [], NOW);
  const dish = state.dishes.find((d) => d.id === 'lentejas');

  logAfterMeal(state, meal, { missing: ['lentejas'], verdict: 'up' }, NOW + 1);
  assert.equal(dish.yum, 3.25);
  assert.deepEqual(state.missing, ['lentejas']);
  assert.equal(state.events.at(-1).mealTime, meal.time);

  logAfterMeal(state, meal, {}, NOW + 2); // a skip changes nothing
  assert.equal(dish.yum, 3.25);

  dish.yum = 1;
  logAfterMeal(state, meal, { verdict: 'down' }, NOW + 3);
  assert.equal(dish.yum, 1);
});

test('lazy pantry: everything is in stock until marked missing; "bought" puts it back', () => {
  const state = defaultState();
  assert.equal(isMissing(state, 'huevo'), false);
  markMissing(state, ['Huevo']);
  assert.equal(isMissing(state, 'huevo'), true);
  assert.deepEqual(state.missing, ['huevo']);
  markMissing(state, ['huevo']);
  assert.deepEqual(state.missing, ['huevo'], 'no duplicates');
  markInStock(state, ['huevo']);
  assert.equal(isMissing(state, 'huevo'), false);
  assert.deepEqual(state.missing, []);
});

test('manual pantry: unmarked ingredients count as missing but do not flood the shopping list', () => {
  const state = defaultState();
  state.settings.pantryMode = 'manual';
  assert.equal(isMissing(state, 'huevo'), true);
  assert.deepEqual(state.missing, []);
  markInStock(state, ['huevo']);
  assert.equal(isMissing(state, 'huevo'), false);
  markMissing(state, ['huevo']);
  assert.equal(isMissing(state, 'huevo'), true);
  assert.deepEqual(state.missing, ['huevo']);
  assert.deepEqual(state.inStock, []);
});

test('missing ingredients make a dish less likely to be suggested', () => {
  const state = defaultState();
  const p = () => {
    const ctx = { now: NOW, events: [], isMissing: (i) => isMissing(state, i) };
    return probabilities(state.dishes, ctx).find((r) => r.dish.id === 'pollo-curry').p;
  };
  const before = p();
  markMissing(state, ['curry', 'crema']);
  assert.ok(p() < before);
});

test('allIngredients: every dish ingredient plus anything added by hand, no duplicates', () => {
  const state = defaultState();
  markMissing(state, ['servilletas']);
  const all = allIngredients(state);
  assert.ok(all.includes('servilletas') && all.includes('huevo'));
  assert.equal(new Set(all).size, all.length);
});

test('normalizeState: a saved state survives a round trip through JSON', () => {
  const state = defaultState();
  const meal = logCardAction(state, 'lentejas', ACTIONS.COOK_ANYWAY, ['papa'], NOW);
  logAfterMeal(state, meal, { verdict: 'down' }, NOW + 1);
  state.settings = { pantryMode: 'manual', variety: 'high' };
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))), state);
});

test('normalizeState: repairs bad values and rejects what it cannot use', () => {
  const fixed = normalizeState({
    schemaVersion: 1,
    dishes: [
      { id: 'a', name: ' Sopa ', health: 99, yum: 'x', liking: -9, cookMinutes: -5, mains: ['A', 'b', 'c', 'd'], ingredients: 'nope' },
      { id: 'a', name: 'duplicate id' },
      { id: 'b' }, // no name
      null,
    ],
    events: [{ dishId: 'a', action: 'cook', time: NOW }, { dishId: 'a', action: 'hack', time: NOW }, { action: 'cook' }, 7],
    missing: ['Pan', 'pan', ''],
    settings: { pantryMode: 'weird', variety: 'high' },
  });
  assert.equal(fixed.dishes.length, 1);
  assert.deepEqual(fixed.dishes[0], {
    id: 'a',
    name: 'Sopa',
    emoji: '🍽️',
    ingredients: [],
    mains: ['a', 'b', 'c'],
    cookMinutes: 0,
    health: 5,
    yum: 3,
    liking: -2,
    neverShow: false,
  });
  assert.deepEqual(fixed.events, [{ dishId: 'a', action: 'cook', time: NOW, missing: [] }]);
  assert.deepEqual(fixed.missing, ['pan']);
  assert.deepEqual(fixed.settings, { pantryMode: 'lazy', variety: 'high' });

  for (const bad of [null, [], 'x', {}, { schemaVersion: 1 }, { schemaVersion: 0, dishes: [] }]) {
    assert.throws(() => normalizeState(bad));
  }
  assert.throws(() => normalizeState({ schemaVersion: SCHEMA_VERSION + 1, dishes: [] }), /newer-schema/);
});

test('storage: first run gives the starter dishes; saved state loads back', () => {
  const storage = fakeStorage();
  const first = loadState(storage);
  assert.equal(first.problem, null);
  assert.equal(first.state.schemaVersion, SCHEMA_VERSION);
  assert.ok(first.state.dishes.length >= 28);

  logCardAction(first.state, 'lentejas', ACTIONS.COOK, [], NOW);
  assert.equal(saveState(first.state, storage), true);
  assert.equal(JSON.parse(storage.data.get(STORAGE_KEY)).schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(loadState(storage).state, first.state);
});

test('storage: the app stays usable when storage throws or holds garbage', () => {
  const failed = loadState(brokenStorage);
  assert.equal(failed.problem, 'unavailable');
  assert.ok(failed.state.dishes.length > 0);
  assert.equal(saveState(failed.state, brokenStorage), false);

  const storage = fakeStorage({ [STORAGE_KEY]: '{not json' });
  const garbled = loadState(storage);
  assert.equal(garbled.problem, 'unreadable');
  assert.ok(garbled.state.dishes.length > 0);
  assert.equal(storage.data.get('qch:v1:unreadable'), '{not json', 'the unreadable blob is kept, not destroyed');
});
