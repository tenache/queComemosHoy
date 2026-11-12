// Mains and sides, favourites, and the v2 → v3 migration (issue #6).

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NEW_IN_V3, STARTER_DISHES } from '../js/dishes.js';
import {
  ACTIONS,
  FAVORITES_MAX,
  WEIGHTS,
  afterMealDue,
  mainCandidates,
  mealMinutes,
  pickSide,
  probabilities,
  scoreDish,
  sidesOf,
} from '../js/scoring.js';
import {
  SCHEMA_VERSION,
  defaultState,
  favoriteCount,
  logCardAction,
  normalizeState,
  planUndo,
  setFavorites,
  splitMissing,
  toggleFavorite,
  undoCardAction,
} from '../js/state.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 12, 20, 0, 0);

const byId = (dishes, id) => dishes.find((d) => d.id === id);
const ctx = (events = [], dishes = STARTER_DISHES) => ({ now: NOW, events, dishes });

// ---- Mains, sides and the card ------------------------------------------

test('sides are never the card, and a pinned side keeps only the mains that go with it', () => {
  const mains = mainCandidates(STARTER_DISHES);
  assert.ok(mains.length > 0);
  assert.ok(mains.every((d) => d.role === 'main'));
  assert.ok(!mains.some((d) => d.id === 'pure'));

  const withPure = mainCandidates(STARTER_DISHES, 'pure');
  assert.ok(withPure.some((d) => d.id === 'milanesas-pure'));
  assert.ok(withPure.some((d) => d.id === 'salchichas'));
  assert.ok(withPure.every((d) => d.sides.includes('pure')));
  assert.ok(!withPure.some((d) => d.id === 'lentejas'), 'a complete dish never goes with a pinned side');
});

test('a suggested side is always one of that main\'s sides; a complete dish has none', () => {
  const milanesas = byId(STARTER_DISHES, 'milanesas-pure');
  const allowed = new Set(milanesas.sides);
  for (let i = 0; i < 200; i++) {
    const side = pickSide(milanesas, ctx(), 'high', { rng: () => (i + 0.5) / 200 });
    assert.ok(allowed.has(side.id), side.id);
  }
  assert.equal(pickSide(byId(STARTER_DISHES, 'lentejas'), ctx()), null);

  // A side the user hid, or deleted, is skipped.
  const hidden = STARTER_DISHES.map((d) => (d.id === 'pure' ? { ...d, neverShow: true } : d));
  assert.ok(!sidesOf(milanesas, hidden).some((d) => d.id === 'pure'));
  const deleted = STARTER_DISHES.filter((d) => d.id !== 'pure');
  assert.ok(!sidesOf(milanesas, deleted).some((d) => d.id === 'pure'));
});

test('a main can have another main as its side: milanesas con ravioles', () => {
  const milanesas = byId(STARTER_DISHES, 'milanesas-pure');
  assert.ok(sidesOf(milanesas, STARTER_DISHES).some((d) => d.id === 'ravioles-tuco' && d.role === 'main'));
});

test('a side eaten yesterday is a repeat for that side and ingredient fatigue for other dishes', () => {
  const meal = { dishId: 'milanesas-pure', sideId: 'pure', action: ACTIONS.COOK, time: NOW - DAY, missing: [] };
  const pure = byId(STARTER_DISHES, 'pure');
  const papasFritas = byId(STARTER_DISHES, 'papas-fritas'); // papa, like puré
  const tortilla = byId(STARTER_DISHES, 'tortilla-papas'); // papa, huevo
  const ensalada = byId(STARTER_DISHES, 'ensalada-mixta'); // nothing in common

  assert.ok(scoreDish(pure, ctx()) - scoreDish(pure, ctx([meal])) > 1, 'puré is less likely again today');
  assert.ok(scoreDish(papasFritas, ctx([meal])) < scoreDish(papasFritas, ctx()), 'papa fatigue on papas fritas');
  assert.ok(scoreDish(tortilla, ctx([meal])) < scoreDish(tortilla, ctx()), 'papa fatigue on tortilla de papas');
  assert.equal(scoreDish(ensalada, ctx([meal])), scoreDish(ensalada, ctx()));

  // So after milanesas con puré, the next card with milanesas leans away from puré.
  const milanesas = byId(STARTER_DISHES, 'milanesas-pure');
  const p = (events) => probabilities(sidesOf(milanesas, STARTER_DISHES), ctx(events)).find((r) => r.dish.id === 'pure').p;
  assert.ok(p([meal]) < p([]) / 2);
});

test('cook time of a meal is the longer of main and side', () => {
  const milanesas = byId(STARTER_DISHES, 'milanesas-pure');
  assert.equal(mealMinutes(milanesas, byId(STARTER_DISHES, 'papas-horno')), 45);
  assert.equal(mealMinutes(milanesas, byId(STARTER_DISHES, 'ensalada-mixta')), milanesas.cookMinutes);
  assert.equal(mealMinutes(milanesas), milanesas.cookMinutes);
});

// ---- Card actions with a side -------------------------------------------

test('cooking a main with a side: one event with sideId, both likings move, undo restores both', () => {
  const state = defaultState();
  const liking = (id) => byId(state.dishes, id).liking;
  const undo = planUndo(state, 'milanesas-pure', ['pan rallado'], 'pure');
  const event = logCardAction(state, 'milanesas-pure', ACTIONS.COOK_ANYWAY, ['pan rallado'], NOW, 'pure');

  assert.equal(event.sideId, 'pure');
  assert.equal(state.events.length, 1);
  assert.equal(liking('milanesas-pure'), 0.5);
  assert.equal(liking('pure'), 0.2, 'the side gets the plain cook bump');

  undoCardAction(state, event, undo);
  assert.equal(state.events.length, 0);
  assert.equal(liking('milanesas-pure'), 0);
  assert.equal(liking('pure'), 0);
  assert.deepEqual(state.missing, []);
});

test('a left swipe touches only the main; a side is never attached to a rejection', () => {
  const state = defaultState();
  const event = logCardAction(state, 'milanesas-pure', ACTIONS.REJECT, [], NOW, 'pure');
  assert.equal(byId(state.dishes, 'milanesas-pure').liking, -0.25);
  assert.equal(byId(state.dishes, 'pure').liking, 0);
  assert.equal(event.sideId, undefined);
});

test('"me falta": only the side\'s ingredients missing never counts against the main', () => {
  const milanesas = byId(STARTER_DISHES, 'milanesas-pure'); // carne, huevo, pan rallado
  const pure = byId(STARTER_DISHES, 'pure'); // papa, leche, manteca
  assert.deepEqual(splitMissing(milanesas, pure, ['Leche', 'papa']), { main: [], side: ['leche', 'papa'] });
  assert.deepEqual(splitMissing(milanesas, pure, ['huevo', 'leche']), { main: ['huevo'], side: ['leche'] });
  assert.deepEqual(splitMissing(milanesas, null, ['huevo']), { main: ['huevo'], side: [] });

  // What the app does for "Cambiar acompañamiento": a light reject on the side only.
  const state = defaultState();
  logCardAction(state, 'pure', ACTIONS.MISSING_REJECT, ['leche'], NOW);
  assert.equal(byId(state.dishes, 'milanesas-pure').liking, 0);
  assert.equal(byId(state.dishes, 'pure').liking, -0.08);
  assert.deepEqual(state.missing, ['leche']);
});

test('the after-meal question waits for the longer of main and side', () => {
  const meal = { dishId: 'milanesas-pure', sideId: 'papas-horno', action: ACTIONS.COOK, time: NOW, missing: [] };
  const at = (minutes) => afterMealDue([meal], STARTER_DISHES, NOW + minutes * 60 * 1000);
  assert.equal(at(35 + 60 + 1), null, 'papas al horno take 45 min, so not yet');
  const due = at(45 + 60 + 1);
  assert.equal(due.dish.id, 'milanesas-pure');
  assert.equal(due.side.id, 'papas-horno');
});

// ---- Favourites ---------------------------------------------------------

test('favourites: a fixed boost, at most FAVORITES_MAX of them', () => {
  const lentejas = byId(STARTER_DISHES, 'lentejas');
  assert.ok(Math.abs(scoreDish({ ...lentejas, favorite: true }, ctx()) - scoreDish(lentejas, ctx()) - WEIGHTS.favorite) < 1e-9);

  const state = defaultState();
  const mains = state.dishes.filter((d) => d.role === 'main').map((d) => d.id);
  for (const id of mains.slice(0, FAVORITES_MAX)) assert.ok(toggleFavorite(state, id));
  assert.equal(toggleFavorite(state, mains[FAVORITES_MAX]), false, 'a sixth is refused');
  assert.equal(favoriteCount(state), FAVORITES_MAX);
  assert.ok(toggleFavorite(state, mains[0]), 'unstarring always works');
  assert.equal(favoriteCount(state), FAVORITES_MAX - 1);

  setFavorites(state, mains.slice(10, 20));
  assert.equal(favoriteCount(state), FAVORITES_MAX, 'the question keeps only the first five');
  assert.equal(state.settings.favoritesAsked, true);
  setFavorites(defaultState(), []); // skipping is allowed
});

// ---- Migration v2 → v3 --------------------------------------------------

/** A v2 blob as the wheel version of the app saved it: no role, sides or favourites. */
function v2Blob(overrides = {}) {
  const fresh = JSON.parse(JSON.stringify(defaultState()));
  const v2Names = {
    'milanesas-pure': 'Milanesas con puré',
    'merluza-ensalada': 'Merluza al horno con ensalada',
    'pollo-horno-papas': 'Pollo al horno con papas',
    'cerdo-batatas': 'Bondiola de cerdo con batatas',
  };
  const dishes = fresh.dishes
    .filter((d) => !NEW_IN_V3.includes(d.id))
    .map(({ role, sides, favorite, ...d }) => ({ ...d, name: v2Names[d.id] ?? d.name }));
  return {
    ...fresh,
    schemaVersion: 2,
    dishes,
    settings: { pantryMode: 'lazy', variety: 'medium' },
    events: [
      { dishId: 'milanesas-pure', action: 'cook', time: NOW - 3 * DAY, missing: [] },
      { dishId: 'milanesas-pure', action: 'reject', time: NOW - 2 * DAY, missing: [] },
      { dishId: 'lentejas', action: 'pick', time: NOW - DAY, missing: [] },
    ],
    ...overrides,
  };
}

test('migration v2 → v3: split dishes become main + side, history and likings are kept', () => {
  const blob = v2Blob();
  byId(blob.dishes, 'milanesas-pure').liking = 1.2;
  byId(blob.dishes, 'milanesas-pure').yum = 4.75;
  const before = JSON.stringify(blob);
  const state = normalizeState(blob);
  assert.equal(JSON.stringify(blob), before, 'the input is not changed');

  assert.equal(state.schemaVersion, SCHEMA_VERSION);
  const milanesas = byId(state.dishes, 'milanesas-pure');
  assert.equal(milanesas.name, 'Milanesas');
  assert.equal(milanesas.role, 'main');
  assert.deepEqual(milanesas.ingredients, ['carne', 'huevo', 'pan rallado']);
  assert.ok(milanesas.sides.includes('pure') && milanesas.sides.includes('ravioles-tuco'));
  assert.equal(milanesas.liking, 1.2, 'liking kept');
  assert.equal(milanesas.yum, 4.75, 'yum kept');

  assert.deepEqual(
    state.events.map((e) => [e.dishId, e.action, e.sideId]),
    [
      ['milanesas-pure', 'cook', 'pure'],
      ['milanesas-pure', 'reject', undefined],
      ['lentejas', 'pick', undefined],
    ],
  );
  assert.equal(byId(state.dishes, 'merluza-ensalada').name, 'Merluza al horno');
  assert.deepEqual(byId(state.dishes, 'hamburguesas').sides, ['papas-fritas', 'ensalada-mixta']);
  assert.deepEqual(byId(state.dishes, 'lentejas').sides, []);
  for (const id of NEW_IN_V3) assert.ok(byId(state.dishes, id), `${id} added`);
  assert.equal(byId(state.dishes, 'pure').role, 'side');
  assert.equal(state.settings.favoritesAsked, false, 'existing users get the favourites question once');
});

test('migration v2 → v3: an edited starter dish is left as the user made it', () => {
  const blob = v2Blob();
  byId(blob.dishes, 'milanesas-pure').name = 'Milanesas napolitanas con puré';
  byId(blob.dishes, 'milanesas-pure').ingredients = ['carne', 'huevo', 'pan rallado', 'papa', 'jamón'];
  byId(blob.dishes, 'hamburguesas').name = 'Hamburguesas de lentejas';
  const state = normalizeState(blob);
  const mine = byId(state.dishes, 'milanesas-pure');
  assert.equal(mine.name, 'Milanesas napolitanas con puré');
  assert.deepEqual(mine.sides, []);
  assert.ok(mine.ingredients.includes('papa'), 'ingredients untouched');
  assert.equal(state.events[0].sideId, undefined, 'its meals get no side');
  assert.deepEqual(byId(state.dishes, 'hamburguesas').sides, []);
});

test('migration v2 → v3: a user dish with a new starter\'s name is reused, not duplicated', () => {
  const blob = v2Blob();
  blob.dishes.push(
    { id: 'd-mine1', name: 'Salchichas', emoji: '🌭', ingredients: ['salchichas', 'pan'], mains: ['salchicha'], cookMinutes: 10, health: 2, yum: 5 },
    { id: 'd-mine2', name: 'puré de papas ', emoji: '🥔', ingredients: ['papa', 'leche'], mains: ['papa'], cookMinutes: 20, health: 3, yum: 5 },
  );
  const before = JSON.stringify(blob);
  const state = normalizeState(blob);
  assert.equal(JSON.stringify(blob), before, 'the input is not changed');

  const names = state.dishes.map((d) => d.name.trim().toLowerCase());
  assert.equal(names.filter((n) => n === 'salchichas').length, 1);
  assert.equal(names.filter((n) => n === 'puré de papas').length, 1);
  assert.equal(byId(state.dishes, 'salchichas'), undefined);
  assert.equal(byId(state.dishes, 'pure'), undefined);
  assert.equal(byId(state.dishes, 'milanesas-pure').sides[0], 'd-mine2', 'milanesas go with their puré');
  assert.equal(state.events[0].sideId, 'd-mine2', 'the old milanesas con puré meal had their puré');
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))), state, 'a second pass changes nothing');
});

test('migration v2 → v3: a deleted starter is not brought back, and a dish already there is not duplicated', () => {
  const blob = v2Blob();
  blob.dishes = blob.dishes.filter((d) => d.id !== 'ravioles-tuco');
  blob.dishes.push({ id: 'pure', name: 'Mi puré', emoji: '🥔', ingredients: ['papa'], mains: ['papa'], cookMinutes: 20, health: 3, yum: 5 });
  const state = normalizeState(blob);
  assert.equal(byId(state.dishes, 'ravioles-tuco'), undefined);
  assert.ok(!byId(state.dishes, 'milanesas-pure').sides.includes('ravioles-tuco'), 'sides only point at dishes that exist');
  assert.equal(state.dishes.filter((d) => d.id === 'pure').length, 1);
  assert.equal(byId(state.dishes, 'pure').name, 'Mi puré');

  // Saving and loading again changes nothing.
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))), state);
});
