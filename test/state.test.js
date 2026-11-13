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
  planUndo,
  undoCardAction,
} from '../js/state.js';
import { STORAGE_KEY, loadState, readBackup, saveState } from '../js/storage.js';
import { NEW_IN_V3 } from '../js/dishes.js';

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

test('list pick: logged as a meal with the biggest boost; works for "never show" dishes; no other dish changes', () => {
  const state = defaultState();
  const hidden = state.dishes.find((d) => d.id === 'pato-naranja');
  hidden.neverShow = true;
  const before = JSON.stringify(state.dishes.filter((d) => d !== hidden));

  const event = logCardAction(state, hidden.id, ACTIONS.PICK, [], NOW);
  assert.equal(hidden.liking, 0.6);
  assert.deepEqual(state.events, [{ dishId: hidden.id, action: 'pick', time: NOW, missing: [] }]);
  assert.equal(JSON.stringify(state.dishes.filter((d) => d !== hidden)), before, 'the card that was showing is not penalised');
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))).events, [event], 'pick events survive save and load');
});

test('undo: reverts only what that action changed, keeping pantry changes made since', () => {
  const state = defaultState();
  markMissing(state, ['pan', 'curry']); // already on the list before the meal

  const plan = planUndo(state, 'pollo-curry', ['curry', 'crema', 'arroz']);
  const event = logCardAction(state, 'pollo-curry', ACTIONS.COOK_ANYWAY, ['curry', 'crema', 'arroz'], NOW);
  assert.deepEqual(state.missing, ['pan', 'curry', 'crema', 'arroz']);

  // Meanwhile, in the pantry: pan and arroz get bought, huevo runs out.
  markInStock(state, ['pan', 'arroz']);
  markMissing(state, ['huevo']);

  undoCardAction(state, event, plan);
  assert.deepEqual(state.events, []);
  assert.equal(state.dishes.find((d) => d.id === 'pollo-curry').liking, 0);
  assert.deepEqual(state.missing, ['curry', 'huevo'], 'crema (added by the meal) is gone; curry was there before; pan stays bought');
  assert.ok(state.inStock.includes('pan') && state.inStock.includes('arroz'), 'what was bought stays bought');
});

test('undo in manual pantry mode: puts back what the action took out of stock', () => {
  const state = defaultState();
  state.settings.pantryMode = 'manual';
  markInStock(state, ['curry', 'crema']);

  const plan = planUndo(state, 'pollo-curry', ['curry']);
  const event = logCardAction(state, 'pollo-curry', ACTIONS.COOK_ANYWAY, ['curry'], NOW);
  assert.equal(isMissing(state, 'curry'), true);

  undoCardAction(state, event, plan);
  assert.equal(isMissing(state, 'curry'), false);
  assert.deepEqual(state.missing, []);
  assert.deepEqual([...state.inStock].sort(), ['crema', 'curry']);
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
  logCardAction(state, 'milanesas-pure', ACTIONS.COOK, [], NOW + 2, 'pure');
  state.dishes.find((d) => d.id === 'salchichas').favorite = true;
  state.settings = { pantryMode: 'manual', variety: 'high', favoritesAsked: true, portions: 3 };
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
  // v1 data is migrated all the way, so the dishes v3 adds are there too.
  const mine = fixed.dishes.filter((d) => !NEW_IN_V3.includes(d.id));
  assert.equal(mine.length, 1);
  assert.deepEqual(mine[0], {
    id: 'a',
    name: 'Sopa',
    emoji: '🍽️',
    ingredients: [],
    mains: ['a', 'b', 'c'],
    cookMinutes: 0,
    effort: 3,
    health: 5,
    yum: 3,
    liking: -2,
    neverShow: false,
    role: 'main',
    sides: [],
    favorite: false,
  });
  assert.deepEqual(fixed.events, [{ dishId: 'a', action: 'cook', time: NOW, missing: [] }]);
  assert.deepEqual(fixed.missing, ['pan']);
  assert.deepEqual(fixed.settings, { pantryMode: 'lazy', variety: 'high', favoritesAsked: false, portions: 2 });

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
  assert.equal(garbled.raw, '{not json', 'the caller gets the text to offer as a download');
  assert.equal(readBackup(storage), '{not json', 'and it is kept, reachable later');
  assert.equal(readBackup(fakeStorage()), null);
  assert.equal(readBackup(brokenStorage), null);
});

test('storage: data from a newer app version is reported and left untouched', () => {
  const newer = JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, dishes: [], somethingNew: true });
  const storage = fakeStorage({ [STORAGE_KEY]: newer });
  const loaded = loadState(storage);

  assert.equal(loaded.problem, 'newer', 'so the app knows not to save over it');
  assert.ok(loaded.state.dishes.length > 0, 'the app still has something to show');
  assert.equal(storage.data.get(STORAGE_KEY), newer);
  assert.equal(readBackup(storage), null, 'nothing was lost, so nothing to back up');
});
