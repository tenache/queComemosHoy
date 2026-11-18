// The Mediterranean dishes and "Mediterránea" on the wheel (#36), and the
// v7 → v8 migration that brings them to phones that already have the app.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NEW_IN_V3, NEW_IN_V8, SIDES_IN_V8, STARTER_DISHES } from '../js/dishes.js';
import { shouldShare } from '../js/group.js';
import { matchFood, parseItem } from '../js/nutrition.js';
import { STARTER_RECIPES, recipeFor } from '../js/recipes.js';
import { SCHEMA_VERSION, defaultState, normalizeState } from '../js/state.js';
import { DEFAULT_CUISINES } from '../js/wheel.js';
import { DISH_ID_RE } from '../netlify/group-core.mjs';

const NOW = Date.UTC(2026, 10, 18, 20, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const byId = (dishes, id) => dishes.find((d) => d.id === id);
const named = (dishes, name) => dishes.filter((d) => d.name.toLowerCase() === name.toLowerCase());
const V7_CUISINES = ['China', 'Mexicana', 'Hamburguesas', 'Pizza', 'Sushi', 'Empanadas', 'Árabe'];

/** A v7 blob as the app saved it before #36: no new dishes, and tortilla without sides. */
function v7Blob() {
  const fresh = JSON.parse(JSON.stringify(defaultState()));
  return {
    ...fresh,
    schemaVersion: 7,
    dishes: fresh.dishes.filter((d) => !NEW_IN_V8.includes(d.id)).map((d) => (SIDES_IN_V8.includes(d.id) ? { ...d, sides: [] } : d)),
    cuisines: [...V7_CUISINES],
    events: [{ dishId: 'paella', action: 'pick', time: NOW - DAY, missing: [] }],
  };
}

/** A user's own dish (any id that isn't a starter's). */
const own = (id, name, role = 'side') => ({ id, name, emoji: '🍽️', role, sides: [], ingredients: ['algo'], mains: ['algo'], cookMinutes: 20, health: 3, yum: 3 });

test('the menu: 37 Mediterranean mains and 8 sides, each with its recipe, and Mediterránea on the wheel', () => {
  const added = NEW_IN_V8.map((id) => byId(STARTER_DISHES, id));
  assert.ok(added.every(Boolean), 'every new id is a starter dish');
  assert.equal(new Set(NEW_IN_V8).size, NEW_IN_V8.length);
  assert.equal(added.filter((d) => d.role === 'main').length, 37);
  assert.deepEqual(
    added.filter((d) => d.role === 'side').map((d) => d.id),
    ['pan-tomate', 'escalivada', 'espinacas-catalana', 'ensalada-griega', 'ensalada-caprese', 'hummus', 'tabule', 'cuscus'],
  );
  for (const d of added) assert.equal(recipeFor(d), STARTER_RECIPES[d.id], `${d.id} shows its recipe`);

  // Every new side goes with at least one main, so it can come up.
  for (const side of added.filter((d) => d.role === 'side')) {
    assert.ok(STARTER_DISHES.some((d) => d.sides.includes(side.id)), `${side.id} goes with some main`);
  }
  assert.deepEqual(byId(STARTER_DISHES, 'falafel').sides, ['hummus', 'tabule', 'ensalada-griega']);
  assert.deepEqual(byId(STARTER_DISHES, 'ratatouille').sides, ['arroz-blanco', 'cuscus', 'huevos-fritos'], 'a side can be a main');
  assert.deepEqual(byId(STARTER_DISHES, 'tortilla-papas').sides, ['pan-tomate', 'ensalada-mixta'], 'tortilla with pan con tomate');

  // The ones the menu already had are not added twice.
  for (const name of ['Paella', 'Gazpacho', 'Tortilla de papas', 'Garbanzos con espinaca']) {
    assert.equal(named(STARTER_DISHES, name).length, 1, name);
  }
  assert.equal(new Set(STARTER_DISHES.map((d) => d.name.toLowerCase())).size, STARTER_DISHES.length, 'names are unique');

  assert.deepEqual(DEFAULT_CUISINES, [...V7_CUISINES, 'Mediterránea']);
});

test('liquids that cook a dish scale with the portions: they are amounts, not seasoning', () => {
  for (const id of ['fideua', 'arroz-negro', 'suquet', 'minestrone', 'sopa-lentejas-rojas', 'cuscus-verduras', 'arroz-horno']) {
    const broth = STARTER_RECIPES[id].items.find((i) => i.food === 'caldo');
    assert.ok(broth?.grams > 0, `${id} has its broth as an amount`);
    assert.ok(!STARTER_RECIPES[id].items.some((i) => !i.grams && /caldo|litro/.test(i.text)), `${id}: no broth in a seasoning line`);
  }
});

test('the new foods: the recipe words find them, herbs with no amount are seasoning, and "as bought" foods only match when the line says so', () => {
  const cases = {
    'judías blancas cocidas': 'porotos',
    'porotos blancos': 'porotos',
    'porotos secos': 'porotos secos',
    'judías verdes': 'chauchas',
    'judía verde': 'chauchas',
    chauchas: 'chauchas',
    'queso feta': 'feta',
    'queso rallado': 'queso rallado',
    queso: 'queso',
    'pan de pita': 'pan de pita',
    'pan pita': 'pan de pita',
    pitas: 'pan de pita',
    'pan rallado': 'pan rallado',
    'garbanzos secos': 'garbanzos secos',
    'garbanzos cocidos': 'garbanzos',
    gambas: 'mariscos',
    gamba: 'mariscos',
    mejillones: 'mariscos',
    'mejillones con valva': 'mejillones',
    'almejas con valva': 'almejas',
    'sardinas enteras': 'sardinas',
    'cordero con hueso (paletilla)': 'cordero',
    'doradas enteras': 'dorada',
    'paletilla de cerdo': 'cerdo',
    'filetes de anchoa': 'anchoas',
    butifarras: 'butifarra',
    botifarra: 'butifarra',
    'jamón serrano': 'jamon crudo',
    'jamón cocido': 'jamon',
    'mejillón': 'mariscos',
    'poroto seco': 'porotos secos',
    'piñones': 'pinones',
    'pasas de uva': 'pasas',
    'cuscús': 'cuscus',
    'cous cous': 'cuscus',
    espaguetis: 'fideos',
    'yogur griego': 'yogur griego',
    'yogur natural': 'yogur',
  };
  for (const [text, food] of Object.entries(cases)) assert.equal(matchFood(text), food, text);
  // Canned, shelled or boneless: not counted with the "as bought" values.
  for (const text of ['sardinas en lata', 'almejas en lata', 'berberechos', 'cordero picado', 'chiles serranos']) assert.equal(matchFood(text), null, text);

  assert.deepEqual(parseItem('albahaca y sal'), { text: 'albahaca y sal' });
  assert.deepEqual(parseItem('perejil: 30 g'), { text: 'perejil', food: 'perejil', grams: 30 });
  assert.deepEqual(parseItem('butifarras: 2'), { text: 'butifarras', food: 'butifarra', grams: 300, each: 150 });
});

test('migration v7 → v8: an untouched phone ends up like a new install, history kept', () => {
  const blob = v7Blob();
  const before = JSON.stringify(blob);
  const state = normalizeState(blob);
  assert.equal(JSON.stringify(blob), before, 'the input is not changed');
  assert.equal(state.schemaVersion, SCHEMA_VERSION);
  assert.equal(SCHEMA_VERSION, 8);

  const fresh = defaultState();
  for (const id of [...NEW_IN_V8, ...SIDES_IN_V8]) assert.deepEqual(byId(state.dishes, id), byId(fresh.dishes, id), `${id} as a new install has it`);
  assert.deepEqual(state.dishes.map((d) => d.id).sort(), fresh.dishes.map((d) => d.id).sort());
  assert.deepEqual(state.dishes.slice(0, blob.dishes.length).map((d) => d.id), blob.dishes.map((d) => d.id), "the phone's dishes keep their place; the new ones go after");
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
  assert.deepEqual(byId(state.dishes, 'tortilla-papas').sides, ['pan-tomate', 'mi-ensalada'], 'and on tortilla too');

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

test('migration v7 → v8: accents, case and spacing don\'t make a second dish', () => {
  const blob = v7Blob();
  blob.dishes.push(own('mi-tabule', 'Tabule'), own('mi-cuscus', 'CUSCUS'), own('mi-pan', 'Pan  con  tomate'), own('mi-fideua', 'fideua', 'main'));
  const state = normalizeState(blob);
  for (const id of ['tabule', 'cuscus', 'pan-tomate', 'fideua']) assert.equal(byId(state.dishes, id), undefined, `${id}: theirs is the one`);
  assert.deepEqual(byId(state.dishes, 'falafel').sides, ['hummus', 'mi-tabule', 'ensalada-griega']);
  assert.deepEqual(byId(state.dishes, 'tajin-pollo').sides, ['mi-cuscus', 'arroz-blanco']);
  assert.deepEqual(byId(state.dishes, 'tortilla-papas').sides, ['mi-pan', 'ensalada-mixta']);
});

test('migration v7 → v8: an id used twice counts as the first dish, as the load keeps it', () => {
  const blob = v7Blob();
  blob.dishes.push({ ...own('d-dup', 'Mi pasta', 'main') }, { ...own('d-dup', 'Hummus') });
  const state = normalizeState(blob);
  assert.equal(named(state.dishes, 'Hummus').length, 1, 'the starter hummus is added: the second d-dup is dropped');
  assert.deepEqual(byId(state.dishes, 'falafel').sides, ['hummus', 'tabule', 'ensalada-griega']);
});

test('migration v7 → v8: tortilla gets its sides only if it is still the starter, with none', () => {
  const renamed = v7Blob();
  byId(renamed.dishes, 'tortilla-papas').name = 'Tortilla de papas de la abuela';
  assert.deepEqual(byId(normalizeState(renamed).dishes, 'tortilla-papas').sides, [], 'renamed: theirs');

  const chosen = v7Blob();
  byId(chosen.dishes, 'tortilla-papas').sides = ['ensalada-tomate'];
  assert.deepEqual(byId(normalizeState(chosen).dishes, 'tortilla-papas').sides, ['ensalada-tomate'], 'sides they chose stay');
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
  byId(state.dishes, 'tortilla-papas').sides = [];
  state.cuisines = V7_CUISINES;
  const again = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(byId(again.dishes, 'falafel'), undefined, 'a deleted dish stays deleted');
  assert.equal(byId(again.dishes, 'hummus'), undefined);
  assert.deepEqual(byId(again.dishes, 'musaka').sides, []);
  assert.deepEqual(byId(again.dishes, 'tortilla-papas').sides, []);
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
  assert.deepEqual(byId(state.dishes, 'tortilla-papas').sides, ['pan-tomate', 'ensalada-mixta']);
  assert.deepEqual(state.cuisines, DEFAULT_CUISINES);

  // Their own pan con tomate on a v2 phone: tortilla points at it (v3 leaves tortilla's sides to v8).
  const mine = normalizeState({ ...v2, dishes: [...v2.dishes, { id: 'mi-pan', name: 'Pan con tomate', emoji: '🍞', ingredients: [], mains: ['pan'], cookMinutes: 10, health: 3, yum: 3 }] });
  assert.equal(byId(mine.dishes, 'pan-tomate'), undefined);
  assert.deepEqual(byId(mine.dishes, 'tortilla-papas').sides, ['mi-pan', 'ensalada-mixta']);
});

test('the new dishes are starters, so friends see them (#23)', () => {
  const group = { sharing: true };
  for (const id of NEW_IN_V8) {
    assert.equal(shouldShare(group, id, 'tenache.github.io'), true, id);
    assert.match(id, DISH_ID_RE, `${id} is a dish id the function accepts`);
  }
});
