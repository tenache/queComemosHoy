// The starter menu and wheel changes of #29 and #30, and the v5 → v6 migration
// that brings them to phones that already have the app.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NEW_IN_V3, NEW_IN_V6, STARTER_DISHES } from '../js/dishes.js';
import { STARTER_RECIPES, recipeFor } from '../js/recipes.js';
import { SCHEMA_VERSION, defaultState, normalizeState } from '../js/state.js';
import { DEFAULT_CUISINES } from '../js/wheel.js';

const NOW = Date.UTC(2026, 10, 15, 20, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const byId = (dishes, id) => dishes.find((d) => d.id === id);
const named = (dishes, name) => dishes.filter((d) => d.name.toLowerCase() === name.toLowerCase());
const V5_CUISINES = ['China', 'Mexicana', 'Hamburguesas', 'Pizza', 'Sushi', 'Empanadas'];
const MILANESA_SIDES = ['pure', 'ensalada-mixta', 'papas-fritas', 'ravioles-tuco', 'arroz-blanco'];

/** A v5 blob as the app saved it before #29 and #30. */
function v5Blob() {
  const fresh = JSON.parse(JSON.stringify(defaultState()));
  const dishes = fresh.dishes
    .filter((d) => !NEW_IN_V6.includes(d.id))
    .map((d) => (d.id === 'lentejas' ? { ...d, name: 'Lentejas' } : d.id === 'milanesas-berenjena' ? { ...d, sides: [] } : d));
  return {
    ...fresh,
    schemaVersion: 5,
    dishes,
    cuisines: [...V5_CUISINES],
    events: [{ dishId: 'lentejas', action: 'pick', time: NOW - DAY, missing: [] }],
  };
}

/** A user's own dish (any id that isn't a starter's). */
const own = (id, name, role = 'side') => ({ id, name, emoji: '🍽️', role, sides: [], ingredients: ['algo'], mains: ['algo'], cookMinutes: 20, health: 3, yum: 3 });

test('the menu: milanesas de berenjena take the milanesas\' sides, "Guiso de lentejas", and pulled pork', () => {
  assert.deepEqual(byId(STARTER_DISHES, 'milanesas-berenjena').sides, MILANESA_SIDES);
  assert.deepEqual(byId(STARTER_DISHES, 'milanesas-pure').sides, MILANESA_SIDES);
  assert.equal(byId(STARTER_DISHES, 'lentejas').name, 'Guiso de lentejas');

  const pork = byId(STARTER_DISHES, 'pulled-pork');
  assert.equal(pork.role, 'main');
  assert.equal(pork.name, 'Pulled pork');
  assert.equal(pork.emoji, '🥪');
  assert.deepEqual(pork.ingredients, ['bondiola de cerdo', 'pan de hamburguesa']);
  assert.deepEqual(pork.mains, ['cerdo', 'pan']);
  assert.deepEqual(pork.sides, ['papas-fritas', 'ensalada-mixta'], "the hamburguesas' sides");
  assert.deepEqual(pork.sides, byId(STARTER_DISHES, 'hamburguesas').sides);
  assert.deepEqual([pork.cookMinutes, pork.effort, pork.health, pork.yum], [240, 2, 2, 5]);
  const toppings = STARTER_RECIPES['pulled-pork'].items.map((i) => i.text);
  assert.ok(toppings.includes('mostaza, salsa romesco o palta, a elección'), 'the toppings are options in the recipe');

  assert.deepEqual(DEFAULT_CUISINES.slice(0, V5_CUISINES.length + 1), [...V5_CUISINES, 'Árabe']);
});

test('migration v5 → v6: an untouched phone gets the new menu and Árabe, history kept', () => {
  const blob = v5Blob();
  const before = JSON.stringify(blob);
  const state = normalizeState(blob);
  assert.equal(JSON.stringify(blob), before, 'the input is not changed');
  assert.equal(state.schemaVersion, SCHEMA_VERSION);

  assert.deepEqual(byId(state.dishes, 'milanesas-berenjena').sides, MILANESA_SIDES);
  assert.equal(byId(state.dishes, 'lentejas').name, 'Guiso de lentejas');
  assert.deepEqual(state.events.map((e) => e.dishId), ['lentejas'], 'its meals are still its own');
  const pork = byId(state.dishes, 'pulled-pork');
  assert.deepEqual(pork, byId(defaultState().dishes, 'pulled-pork'), 'pulled pork as a new install has it');
  assert.deepEqual(state.cuisines, DEFAULT_CUISINES);

  // The same as a fresh install, and saving and loading again changes nothing.
  assert.deepEqual(state.dishes.map((d) => d.id).sort(), defaultState().dishes.map((d) => d.id).sort());
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))), state);
});

test('migration v5 → v6: a dish the user edited stays as they made it', () => {
  const renamed = v5Blob();
  byId(renamed.dishes, 'milanesas-berenjena').name = 'Milanesas de berenjena al horno';
  byId(renamed.dishes, 'lentejas').name = 'Lentejas con chorizo';
  const a = normalizeState(renamed);
  assert.equal(byId(a.dishes, 'milanesas-berenjena').name, 'Milanesas de berenjena al horno');
  assert.deepEqual(byId(a.dishes, 'milanesas-berenjena').sides, [], 'renamed: no sides added');
  assert.equal(byId(a.dishes, 'lentejas').name, 'Lentejas con chorizo');

  const edited = v5Blob();
  byId(edited.dishes, 'milanesas-berenjena').sides = ['ensalada-tomate'];
  edited.dishes.push(own('mi-guiso', 'Guiso de lentejas', 'main'));
  const b = normalizeState(edited);
  assert.deepEqual(byId(b.dishes, 'milanesas-berenjena').sides, ['ensalada-tomate'], 'sides they chose stay');
  assert.equal(byId(b.dishes, 'lentejas').name, 'Lentejas', 'not renamed onto a name they already use');
  assert.equal(named(b.dishes, 'Guiso de lentejas').length, 1);
  assert.equal(recipeFor(byId(b.dishes, 'lentejas')), STARTER_RECIPES.lentejas, 'and it keeps its recipe');
  assert.equal(recipeFor(byId(a.dishes, 'lentejas')), null, 'a renamed starter is theirs: no starter recipe');
});

test("migration v5 → v6: the user's own dishes with a starter's name are used, not duplicated", () => {
  const blob = v5Blob();
  // Their own puré (the starter one deleted), no arroz blanco at all, their own papas fritas.
  blob.dishes = blob.dishes.filter((d) => !['pure', 'arroz-blanco', 'papas-fritas'].includes(d.id));
  blob.dishes.push(own('mi-pure', 'Puré de papas'), own('mis-papas', 'papas fritas'));
  const state = normalizeState(blob);
  assert.deepEqual(byId(state.dishes, 'milanesas-berenjena').sides, ['mi-pure', 'ensalada-mixta', 'mis-papas', 'ravioles-tuco']);
  assert.deepEqual(byId(state.dishes, 'pulled-pork').sides, ['mis-papas', 'ensalada-mixta']);

  const theirs = v5Blob();
  theirs.dishes.push(own('mi-pulled', 'Pulled Pork', 'main'));
  const withTheirs = normalizeState(theirs);
  assert.equal(byId(withTheirs.dishes, 'pulled-pork'), undefined, 'their own pulled pork is the one');
  assert.equal(named(withTheirs.dishes, 'Pulled pork').length, 1);

  // Entries the load throws away (no id, no name) don't count as having it.
  for (const junk of [{ name: 'Pulled pork' }, { id: 'pulled-pork', name: '  ' }]) {
    const blob5 = v5Blob();
    blob5.dishes.push(junk);
    assert.equal(normalizeState(blob5).dishes.filter((d) => d.id === 'pulled-pork').length, 1, JSON.stringify(junk));
  }
});

test('migration v5 → v6: Árabe joins the wheel once', () => {
  const wheel = (cuisines) => normalizeState({ ...v5Blob(), cuisines }).cuisines;
  // v8 then adds Mediterránea (#36).
  assert.deepEqual(wheel(['Pizza']), ['Pizza', 'Árabe', 'Mediterránea']);
  assert.deepEqual(wheel(['Pizza', 'árabe']), ['Pizza', 'árabe', 'Mediterránea'], 'already added by hand, in any case');
  assert.deepEqual(wheel(['Pizza', 'Arabe']), ['Pizza', 'Arabe', 'Mediterránea'], 'or without the accent');
  assert.deepEqual(wheel('nope'), DEFAULT_CUISINES);
});

test('v6 data: what the user changed after the migration stays changed', () => {
  const state = normalizeState(v5Blob());
  state.dishes = state.dishes.filter((d) => d.id !== 'pulled-pork');
  byId(state.dishes, 'lentejas').name = 'Lentejas';
  byId(state.dishes, 'milanesas-berenjena').sides = [];
  state.cuisines = V5_CUISINES;
  const again = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(byId(again.dishes, 'pulled-pork'), undefined, 'a deleted pulled pork stays deleted');
  assert.equal(byId(again.dishes, 'lentejas').name, 'Lentejas');
  assert.deepEqual(byId(again.dishes, 'milanesas-berenjena').sides, []);
  assert.deepEqual(again.cuisines, V5_CUISINES);
});

test('migration v2 → v6: an old phone ends up with the v6 menu, pulled pork once', () => {
  const blob = v5Blob();
  const v2 = {
    ...blob,
    schemaVersion: 2,
    dishes: blob.dishes.filter((d) => !NEW_IN_V3.includes(d.id)).map(({ role, sides, favorite, effort, ...d }) => d),
    settings: { pantryMode: 'lazy', variety: 'medium' },
  };
  const state = normalizeState(v2);
  assert.deepEqual(byId(state.dishes, 'milanesas-berenjena').sides, MILANESA_SIDES);
  assert.equal(byId(state.dishes, 'lentejas').name, 'Guiso de lentejas');
  assert.equal(state.dishes.filter((d) => d.id === 'pulled-pork').length, 1);
  assert.deepEqual(state.cuisines, DEFAULT_CUISINES);
});
