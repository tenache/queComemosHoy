// Recipes and rough macros (issue #6, PR 2).

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { STARTER_DISHES } from '../js/dishes.js';
import { FOODS, formatItem, itemAmount, macrosOf, matchFood, mealMacros, parseItem } from '../js/nutrition.js';
import { STARTER_RECIPES, recipeFor } from '../js/recipes.js';
import { PORTIONS, SCHEMA_VERSION, cleanRecipe, defaultState, normalizeState } from '../js/state.js';

const byId = (id) => STARTER_DISHES.find((d) => d.id === id);
const close = (actual, expected, share, what) =>
  assert.ok(Math.abs(actual - expected) <= expected * share, `${what}: ${Math.round(actual)} vs about ${expected}`);

test('every starter dish has a recipe whose amounts all count toward the macros', () => {
  for (const dish of STARTER_DISHES) {
    const recipe = recipeFor(dish);
    assert.ok(recipe, `${dish.id} has a recipe`);
    assert.ok(recipe.serves >= 1 && recipe.items.length >= 1 && recipe.steps.length >= 1, `${dish.id} is complete`);
    for (const item of recipe.items) {
      if (item.grams) assert.ok(FOODS[item.food], `${dish.id}: "${item.text}" is a known food`);
      else assert.equal(item.food, undefined, `${dish.id}: "${item.text}" with no grams is seasoning`);
    }
    const macros = macrosOf(recipe);
    assert.deepEqual(macros.missing, [], `${dish.id} has no gaps`);
    assert.ok(macros.kcal > 50 && macros.kcal < 1500, `${dish.id}: ${Math.round(macros.kcal)} kcal a portion is plausible`);
  }
  assert.deepEqual(Object.keys(STARTER_RECIPES).sort(), STARTER_DISHES.map((d) => d.id).sort(), 'no recipe for a dish that does not exist');
});

test('macros land near the estimates in issue #6 (within 20%)', () => {
  const meal = (...ids) => mealMacros(...ids.map((id) => recipeFor(byId(id))));
  const checks = [
    [['milanesas-pure', 'pure'], 750, 45],
    [['milanesas-pure', 'ensalada-mixta'], 575, 40],
    [['milanesas-pure', 'ravioles-tuco'], 985, 59],
    [['croquetas-arroz', 'ensalada-mixta'], 710, 18],
    [['lentejas'], 475, 23],
  ];
  for (const [ids, kcal, protein] of checks) {
    const m = meal(...ids);
    close(m.kcal, kcal, 0.2, `${ids.join(' + ')} kcal`);
    close(m.protein, protein, 0.35, `${ids.join(' + ')} protein`);
  }
});

test('macros are the sum of grams × table ÷ portions, and a main plus its side add up', () => {
  const recipe = { serves: 2, items: [{ text: 'arroz', grams: 200, food: 'arroz' }, { text: 'aceite', grams: 10, food: 'aceite' }, { text: 'sal' }] };
  const m = macrosOf(recipe);
  assert.equal(m.kcal, (FOODS.arroz.kcal * 2 + FOODS.aceite.kcal * 0.1) / 2);
  assert.equal(m.fat, (FOODS.arroz.fat * 2 + 10) / 2);
  assert.deepEqual(m.missing, [], 'seasoning with no amount is not a gap');

  const doubled = macrosOf({ ...recipe, serves: 4, items: recipe.items.map((i) => (i.grams ? { ...i, grams: i.grams * 2 } : i)) });
  assert.ok(Math.abs(doubled.kcal - m.kcal) < 1e-9, 'the same dish written for 4 gives the same portion');

  const both = mealMacros(recipe, recipe);
  assert.ok(Math.abs(both.kcal - 2 * m.kcal) < 1e-9);
  assert.equal(mealMacros(recipe, null).kcal, m.kcal, 'no side, just the main');
  assert.equal(mealMacros(null, null), null);
});

test('macros report what they could not count, instead of hiding it', () => {
  const m = macrosOf({
    serves: 1,
    items: [
      { text: 'papa', grams: 100, food: 'papa' },
      { text: 'tofu ahumado', grams: 100 }, // grams, unknown food
      { text: 'huevos', food: 'huevo' }, // known food, no amount
    ],
  });
  assert.equal(m.kcal, FOODS.papa.kcal);
  assert.deepEqual(m.missing, ['tofu ahumado', 'huevos']);
});

test('the portions setting scales the amounts shown, never the macros per portion', () => {
  const huevos = { text: 'huevos', grams: 100, food: 'huevo', each: 50 };
  const carne = { text: 'carne', grams: 300, food: 'carne magra' };
  assert.equal(itemAmount(huevos, 2, 2), '2 (100 g)');
  assert.equal(itemAmount(huevos, 2, 3), '3 (150 g)');
  assert.equal(itemAmount(huevos, 2, 1), '1 (50 g)');
  assert.equal(itemAmount(carne, 2, 4), '600 g');
  assert.equal(itemAmount(carne, 2, 1), '150 g');
  assert.equal(itemAmount({ text: 'sal' }, 2, 4), '', 'seasoning has no amount');
});

test('recipe lines: what the form shows reads back the same, for every starter recipe', () => {
  for (const [id, recipe] of Object.entries(STARTER_RECIPES)) {
    for (const item of recipe.items) {
      const back = parseItem(formatItem(item, recipe.serves));
      assert.equal(back.text, item.text, `${id}: text of "${item.text}"`);
      assert.equal(back.grams, item.grams, `${id}: grams of "${item.text}"`);
      assert.equal(back.food, item.food, `${id}: food of "${item.text}"`);
    }
  }
});

test('recipe lines a person types', () => {
  assert.deepEqual(parseItem('carne picada: 300 g'), { text: 'carne picada', food: 'carne picada', grams: 300 });
  assert.deepEqual(parseItem('300 g de carne picada'), { text: 'carne picada', food: 'carne picada', grams: 300 });
  assert.deepEqual(parseItem('Huevos: 2'), { text: 'Huevos', food: 'huevo', grams: 100, each: 50 });
  assert.deepEqual(parseItem('leche: 0,5 l'), { text: 'leche', food: 'leche', grams: 500 });
  assert.deepEqual(parseItem('- sal y pimienta'), { text: 'sal y pimienta' });
  assert.deepEqual(parseItem('tofu: 200 g'), { text: 'tofu', grams: 200 });
  assert.equal(parseItem('   '), null);

  // Longest name wins, whole words only, accents don't matter.
  assert.equal(matchFood('pan rallado'), 'pan rallado');
  assert.equal(matchFood('crema de leche'), 'crema');
  assert.equal(matchFood('ñoquis de papa'), 'noquis');
  assert.equal(matchFood('patitas de pollo'), 'patitas');
  assert.equal(matchFood('papas'), 'papa');
  assert.equal(matchFood('aceitunas'), 'aceitunas');
  assert.equal(matchFood('jamón'), 'jamon');
  assert.equal(matchFood('espárragos'), null);
});

test('a starter recipe only shows while the dish is still that starter; a dish\'s own recipe wins', () => {
  const burger = byId('hamburguesas');
  assert.ok(recipeFor(burger));
  assert.equal(recipeFor({ ...burger, name: 'Hamburguesas de lentejas' }), null, 'renamed: it is the user\'s dish now');
  const mine = { serves: 1, items: [{ text: 'lentejas', grams: 100, food: 'lentejas' }], steps: ['Cocinar.'] };
  assert.equal(recipeFor({ ...burger, name: 'Hamburguesas de lentejas', recipe: mine }), mine);
  assert.equal(recipeFor({ id: 'd-x', name: 'Algo mío' }), null);
});

test('cleanRecipe keeps a valid recipe and repairs or drops the rest', () => {
  assert.equal(cleanRecipe(null), null);
  assert.equal(cleanRecipe({ items: [], steps: ['  '] }), null, 'nothing in it');
  assert.deepEqual(
    cleanRecipe({
      serves: 99,
      items: [{ text: ' arroz ', grams: '150', food: 'arroz', each: 3 }, { text: 'x', grams: -5, food: 'nope' }, { text: '' }, null],
      steps: [' Hervir. ', '', 7],
    }),
    { serves: PORTIONS.max, items: [{ text: 'arroz', grams: 150, food: 'arroz', each: 3 }, { text: 'x' }], steps: ['Hervir.', '7'] },
  );
});

test('schema v4: own recipes and portions survive a round trip; v3 data moves up unchanged', () => {
  const state = defaultState();
  state.dishes[0].recipe = { serves: 3, items: [{ text: 'fideos', grams: 300, food: 'fideos' }], steps: ['Hervir.'] };
  state.settings.portions = 4;
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))), state);
  assert.equal(state.dishes[1].recipe, undefined, 'starter dishes carry no recipe key');

  const v3 = JSON.parse(JSON.stringify(defaultState()));
  v3.schemaVersion = 3;
  delete v3.settings.portions;
  const up = normalizeState(v3);
  assert.equal(up.schemaVersion, SCHEMA_VERSION);
  assert.equal(up.settings.portions, PORTIONS.default);
  assert.deepEqual(up.dishes, defaultState().dishes);
});
