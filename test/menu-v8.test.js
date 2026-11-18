// The Mediterranean dishes and "Mediterránea" on the wheel (#36), and the
// v7 → v8 migration that brings them to phones that already have the app.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NEW_IN_V3, NEW_IN_V8, STARTER_DISHES } from '../js/dishes.js';
import { shouldShare } from '../js/group.js';
import { matchFood, parseItem } from '../js/nutrition.js';
import { STARTER_RECIPES, recipeFor } from '../js/recipes.js';
import { SCHEMA_VERSION, defaultState, normalizeState } from '../js/state.js';
import { DEFAULT_CUISINES } from '../js/wheel.js';

const NOW = Date.UTC(2026, 10, 18, 20, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const byId = (dishes, id) => dishes.find((d) => d.id === id);
const named = (dishes, name) => dishes.filter((d) => d.name.toLowerCase() === name.toLowerCase());
const V7_CUISINES = ['China', 'Mexicana', 'Hamburguesas', 'Pizza', 'Sushi', 'Empanadas', 'Árabe'];

/** A v7 blob as the app saved it before #36. */
function v7Blob() {
  const fresh = JSON.parse(JSON.stringify(defaultState()));
  return {
    ...fresh,
    schemaVersion: 7,
    dishes: fresh.dishes.filter((d) => !NEW_IN_V8.includes(d.id)),
    cuisines: [...V7_CUISINES],
    events: [{ dishId: 'paella', action: 'pick', time: NOW - DAY, missing: [] }],
  };
}

/** A user's own dish (any id that isn't a starter's). */
const own = (id, name, role = 'side') => ({ id, name, emoji: '🍽️', role, sides: [], ingredients: ['algo'], mains: ['algo'], cookMinutes: 20, health: 3, yum: 3 });

test('the menu: 29 Mediterranean mains and 8 sides, each with its recipe, and Mediterránea on the wheel', () => {
  const added = NEW_IN_V8.map((id) => byId(STARTER_DISHES, id));
  assert.ok(added.every(Boolean), 'every new id is a starter dish');
  assert.equal(new Set(NEW_IN_V8).size, NEW_IN_V8.length);
  assert.equal(added.filter((d) => d.role === 'main').length, 29);
  assert.deepEqual(
    added.filter((d) => d.role === 'side').map((d) => d.id),
    ['pan-tomate', 'escalivada', 'espinacas-catalana', 'ensalada-griega', 'ensalada-caprese', 'hummus', 'tabule', 'cuscus'],
  );
  for (const d of added) assert.equal(recipeFor(d), STARTER_RECIPES[d.id], `${d.id} shows its recipe`);

  // A few that matter: the falafel's sides, the sides that point at a main, a complete dish.
  assert.deepEqual(byId(STARTER_DISHES, 'falafel').sides, ['hummus', 'tabule', 'ensalada-griega']);
  assert.deepEqual(byId(STARTER_DISHES, 'ratatouille').sides, ['arroz-blanco', 'cuscus', 'huevos-fritos']);
  assert.deepEqual(byId(STARTER_DISHES, 'fideua').sides, []);
  assert.equal(byId(STARTER_DISHES, 'cuscus-verduras').effort >= byId(STARTER_DISHES, 'cuscus').effort, true, 'the dish includes the side\'s work');

  // The ones the menu already had are not added twice.
  for (const name of ['Paella', 'Gazpacho', 'Tortilla de papas', 'Garbanzos con espinaca']) {
    assert.equal(named(STARTER_DISHES, name).length, 1, name);
  }
  assert.equal(new Set(STARTER_DISHES.map((d) => d.name.toLowerCase())).size, STARTER_DISHES.length, 'names are unique');

  assert.deepEqual(DEFAULT_CUISINES, [...V7_CUISINES, 'Mediterránea']);
});

test('the new foods: the recipe words find them, and herbs with no amount are seasoning', () => {
  const cases = {
    'judías blancas cocidas': 'porotos',
    'porotos blancos': 'porotos',
    'judías verdes': 'chauchas',
    chauchas: 'chauchas',
    'queso feta': 'feta',
    'queso rallado': 'queso rallado',
    queso: 'queso',
    'pan de pita': 'pan de pita',
    pitas: 'pan de pita',
    'pan rallado': 'pan rallado',
    'garbanzos secos': 'garbanzos secos',
    'garbanzos cocidos': 'garbanzos',
    gambas: 'mariscos',
    'almejas (con valva)': 'almejas',
    'filetes de anchoa': 'anchoas',
    'cordero (paletilla)': 'cordero',
    butifarras: 'butifarra',
    'piñones': 'pinones',
    'pasas de uva': 'pasas',
    'cuscús': 'cuscus',
    'yogur griego': 'yogur',
  };
  for (const [text, food] of Object.entries(cases)) assert.equal(matchFood(text), food, text);

  assert.deepEqual(parseItem('albahaca y sal'), { text: 'albahaca y sal' });
  assert.deepEqual(parseItem('perejil: 30 g'), { text: 'perejil', food: 'perejil', grams: 30 });
  assert.deepEqual(parseItem('butifarras: 2'), { text: 'butifarras', food: 'butifarra', grams: 300, each: 150 });
});

test('migration v7 → v8: an untouched phone gets the new dishes and Mediterránea, history kept', () => {
  const blob = v7Blob();
  const before = JSON.stringify(blob);
  const state = normalizeState(blob);
  assert.equal(JSON.stringify(blob), before, 'the input is not changed');
  assert.equal(state.schemaVersion, SCHEMA_VERSION);
  assert.equal(SCHEMA_VERSION, 8);

  const fresh = defaultState();
  for (const id of NEW_IN_V8) assert.deepEqual(byId(state.dishes, id), byId(fresh.dishes, id), `${id} as a new install has it`);
  assert.deepEqual(state.dishes.map((d) => d.id).sort(), fresh.dishes.map((d) => d.id).sort());
  assert.deepEqual(state.cuisines, DEFAULT_CUISINES);
  assert.deepEqual(state.events.map((e) => e.dishId), ['paella'], 'the meals are still there');

  // Saving and loading again changes nothing.
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))), state);
});

test("migration v7 → v8: the user's own dishes with a new dish's name are used, not duplicated", () => {
  const blob = v7Blob();
  blob.dishes.push(own('mi-hummus', 'hummus'), own('mi-shakshuka', 'Shakshuka', 'main'));
  // Their own ensalada mixta stands in for the deleted starter one.
  blob.dishes = blob.dishes.filter((d) => d.id !== 'ensalada-mixta');
  blob.dishes.push(own('mi-ensalada', 'Ensalada mixta'));
  const state = normalizeState(blob);

  assert.equal(byId(state.dishes, 'hummus'), undefined, 'their hummus is the one');
  assert.equal(named(state.dishes, 'Hummus').length, 1);
  assert.equal(byId(state.dishes, 'shakshuka'), undefined);
  assert.equal(named(state.dishes, 'Shakshuka').length, 1);
  assert.deepEqual(byId(state.dishes, 'falafel').sides, ['mi-hummus', 'tabule', 'ensalada-griega'], 'new sides and theirs');
  assert.deepEqual(byId(state.dishes, 'calamares-romana').sides, ['mi-ensalada', 'papas-fritas']);

  // A deleted side is left out, not pointed at.
  const noRice = v7Blob();
  noRice.dishes = noRice.dishes.filter((d) => d.id !== 'arroz-blanco');
  assert.deepEqual(byId(normalizeState(noRice).dishes, 'tajin-pollo').sides, ['cuscus']);

  // Entries the load throws away (no id, no name) don't count as having it.
  for (const junk of [{ name: 'Falafel' }, { id: 'falafel', name: '  ' }, null]) {
    const b = v7Blob();
    b.dishes.push(junk);
    assert.equal(normalizeState(b).dishes.filter((d) => d.id === 'falafel').length, 1, JSON.stringify(junk));
  }
});

test('migration v7 → v8: Mediterránea joins the wheel once', () => {
  const wheel = (cuisines) => normalizeState({ ...v7Blob(), cuisines }).cuisines;
  assert.deepEqual(wheel(['Pizza']), ['Pizza', 'Mediterránea']);
  assert.deepEqual(wheel(['Pizza', 'mediterránea']), ['Pizza', 'mediterránea'], 'already added by hand, in any case');
  assert.deepEqual(wheel(['Pizza', 'Mediterranea']), ['Pizza', 'Mediterranea'], 'or without the accent');
  assert.deepEqual(wheel([]), DEFAULT_CUISINES);
});

test('v8 data: what the user changed after the migration stays changed', () => {
  const state = normalizeState(v7Blob());
  state.dishes = state.dishes.filter((d) => !['falafel', 'hummus'].includes(d.id));
  byId(state.dishes, 'musaka').sides = [];
  state.cuisines = V7_CUISINES;
  const again = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(byId(again.dishes, 'falafel'), undefined, 'a deleted dish stays deleted');
  assert.equal(byId(again.dishes, 'hummus'), undefined);
  assert.deepEqual(byId(again.dishes, 'musaka').sides, []);
  assert.deepEqual(again.cuisines, V7_CUISINES);
});

test('migration v2 → v8: an old phone ends up with every new dish once', () => {
  const blob = v7Blob();
  const v2 = {
    ...blob,
    schemaVersion: 2,
    dishes: blob.dishes.filter((d) => !NEW_IN_V3.includes(d.id) && d.id !== 'pulled-pork').map(({ role, sides, favorite, effort, ...d }) => d),
    settings: { pantryMode: 'lazy', variety: 'medium' },
  };
  const state = normalizeState(v2);
  assert.deepEqual(state.dishes.map((d) => d.id).sort(), defaultState().dishes.map((d) => d.id).sort());
  assert.deepEqual(byId(state.dishes, 'falafel').sides, ['hummus', 'tabule', 'ensalada-griega']);
  assert.deepEqual(state.cuisines, DEFAULT_CUISINES);
});

test('the new dishes are starters, so friends see them (#23)', () => {
  const group = { sharing: true };
  for (const id of NEW_IN_V8) assert.equal(shouldShare(group, id, 'tenache.github.io'), true, id);
  for (const id of NEW_IN_V8) assert.match(id, /^[a-z0-9-]{1,40}$/, `${id} is a dish id the function accepts`);
});
