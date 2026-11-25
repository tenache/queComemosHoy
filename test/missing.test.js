// What you have comes first (#52): exact odds between the ideally good and
// ideally bad meals, the floor among the dishes you can make, and the
// fallback when nothing is available. Checked on probabilities(), no sampling.

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { STARTER_DISHES } from '../js/dishes.js';
import { applyParams } from '../js/params.js';
import { FLOOR, FRIENDS, LIKING, MISSING, MOOD_IDS, TEMPERATURE, WEIGHTS, idealGap, pickSide, probabilities, scoreDish } from '../js/scoring.js';
import { SCHEMA_VERSION, cleanDish, defaultState, normalizeState } from '../js/state.js';

const NOW = Date.UTC(2026, 10, 25, 20, 0, 0);

afterEach(() => applyParams()); // back to the code's values

// The two imaginary dishes of #52, each with two ingredients of its own.
const igm = (extra = {}) => ({
  id: 'igm',
  name: 'IGM',
  role: 'main',
  sides: [],
  ingredients: ['oro', 'plata'],
  keyIngredients: ['oro'],
  mains: ['x'],
  cookMinutes: 0,
  effort: 1,
  health: 5,
  yum: 5,
  liking: LIKING.max,
  favorite: true,
  ...extra,
});
const ibm = (extra = {}) => ({
  id: 'ibm',
  name: 'IBM',
  role: 'main',
  sides: [],
  ingredients: ['barro', 'piedra'],
  keyIngredients: [],
  mains: ['y'],
  cookMinutes: 600,
  effort: 5,
  health: 1,
  yum: 1,
  liking: LIKING.min,
  favorite: false,
  ...extra,
});

const missingFrom = (names) => (i) => names.includes(i);
const ctxFor = (dishes, missing, extra = {}) => ({
  now: NOW,
  events: [],
  dishes,
  isMissing: missingFrom(missing),
  friends: new Map([['igm', 50]]),
  ...extra,
});
const p = (table, id) => table.find((r) => r.dish.id === id).p;
const ratio = (dishes, missing, variety, extra = {}) => {
  const table = probabilities(dishes, ctxFor(dishes, missing, extra), variety);
  return p(table, 'ibm') / p(table, 'igm');
};
const close = (actual, expected, what) => assert.ok(Math.abs(actual / expected - 1) < 1e-6, `${what}: ${actual}, wanted ${expected}`);

test('the gap between the ideal meals is 12 with the defaults, and the mood counts double', () => {
  assert.equal(idealGap(), 12);
  assert.equal(idealGap('yum'), 12 + WEIGHTS.yum);
  assert.equal(idealGap('different'), 12);
});

test('IBM complete vs IGM missing 1 secondary: 2:1; 1 key: 10:1; 2 secondary: 4:1, at every mood and temperature', () => {
  applyParams({ 'FLOOR.fairShareFraction': 0 });
  for (const mood of [null, ...MOOD_IDS]) {
    for (const T of [0.7, 1, 2.25, 15]) {
      applyParams({ 'FLOOR.fairShareFraction': 0, 'TEMPERATURE.medium': Math.min(T, 5) });
      if (T > 5) TEMPERATURE.medium = T; // above the panel's range: still exact
      const extra = { mood };
      const what = `${mood} at T=${T}`;
      close(ratio([ibm(), igm()], ['plata'], 'medium', extra), MISSING.secondaryOdds, `${what}, secondary`);
      close(ratio([ibm(), igm()], ['oro'], 'medium', extra), MISSING.keyOdds, `${what}, key`);
      close(ratio([ibm(), igm({ keyIngredients: [] })], ['oro', 'plata'], 'medium', extra), 4, `${what}, 2 secondary`);
      close(ratio([ibm(), igm()], ['oro', 'plata'], 'medium', extra), 20, `${what}, key + secondary`);
    }
  }
});

test('the odds hold with FRIENDS.first above FRIENDS.max, and at every variety', () => {
  applyParams({ 'FLOOR.fairShareFraction': 0, 'FRIENDS.first': 3, 'FRIENDS.max': 2 });
  for (const variety of Object.keys(TEMPERATURE)) {
    // One friend: friendsBoost(1) = first = 3, the most it can be.
    close(ratio([ibm(), igm()], ['plata'], variety, { friends: new Map([['igm', 1]]) }), 2, variety);
  }
  assert.equal(FRIENDS.first, 3);
});

test('the number of dishes does not change the odds between two of them', () => {
  applyParams({ 'FLOOR.fairShareFraction': 0 });
  const twice = [ibm(), igm(), ibm({ id: 'ibm2' }), igm({ id: 'igm2' }), ...STARTER_DISHES];
  close(ratio(twice, ['plata'], 'medium'), 2, 'with every dish duplicated and the starters');
});

test('a dish with no 🔑 counts every missing ingredient as secondary', () => {
  applyParams({ 'FLOOR.fairShareFraction': 0 });
  close(ratio([ibm(), igm({ keyIngredients: [] })], ['oro'], 'medium'), 2, 'oro without its key');
});

test('two incomplete dishes: missing a key ingredient is 5× less likely than missing a secondary one', () => {
  applyParams({ 'FLOOR.fairShareFraction': 0 });
  const a = igm({ id: 'a', ingredients: ['oro', 'plata'] });
  const b = igm({ id: 'b', ingredients: ['oro2', 'plata2'], keyIngredients: ['oro2'] });
  const dishes = [a, b, ibm()];
  const table = probabilities(dishes, ctxFor(dishes, ['oro', 'plata2']), 'medium');
  close(p(table, 'b') / p(table, 'a'), 5, 'secondary vs key');
});

test('the floor goes only to the dishes you can make, and N counts only them', () => {
  const dishes = [ibm(), igm(), igm({ id: 'igm2' }), igm({ id: 'igm3' })];
  const table = probabilities(dishes, ctxFor(dishes, ['plata']), 'low');
  for (const row of table) assert.equal(row.floored, row.dish.id === 'ibm', `${row.dish.id} floored`);
  // One complete dish: it alone shares the floor, fraction / 1.
  assert.ok(p(table, 'ibm') >= FLOOR.fairShareFraction);

  // No complete dish: the ones missing the least share it (the IGMs miss 1 secondary, the IBM 2).
  const none = probabilities(dishes, ctxFor(dishes, ['plata', 'barro', 'piedra']), 'low');
  assert.deepEqual(
    none.filter((r) => r.floored).map((r) => r.dish.id),
    ['igm', 'igm2', 'igm3'],
  );
  const probs = none.map((r) => r.p);
  assert.ok(Math.abs(probs.reduce((s, x) => s + x, 0) - 1) < 1e-9, 'still sums to 1');
});

test('in pantry mode, the least liked dish you can make still keeps its floor (scoring.test.js no-bans, pantry version)', () => {
  const dishes = STARTER_DISHES.map((d) => (d.id === 'milanesas-berenjena' ? { ...d, liking: LIKING.min } : d));
  const have = new Set(['berenjena', 'huevo', 'pan rallado', 'fideos', 'queso rallado']);
  const ctx = { now: NOW, events: [], dishes, isMissing: (i) => !have.has(i) };
  const complete = dishes.filter((d) => d.ingredients.every((i) => have.has(i)));
  assert.ok(complete.some((d) => d.id === 'milanesas-berenjena'));
  for (const variety of Object.keys(TEMPERATURE)) {
    const table = probabilities(dishes, ctx, variety);
    const floor = FLOOR.fairShareFraction / complete.length;
    for (const d of complete) assert.ok(p(table, d.id) >= floor, `${variety}: ${d.id} keeps the floor`);
    const incomplete = table.filter((r) => !complete.includes(r.dish)).reduce((s, r) => s + r.p, 0);
    assert.ok(incomplete < 0.01, `${variety}: all incomplete dishes together ${incomplete}`);
  }
});

test('fallback: with nothing available, probabilities are exactly as before #52', () => {
  const dishes = STARTER_DISHES;
  // Before #52: 0.6 per missing ingredient, floor over every candidate.
  const before = (isMissing) => {
    const ctx = { now: NOW, events: [], dishes, isMissing, pantryEmpty: true };
    const scores = dishes.map((d) => scoreDish(d, ctx));
    const top = Math.max(...scores);
    const w = scores.map((s) => Math.exp(s - top));
    const total = w.reduce((a, b) => a + b, 0);
    const floor = FLOOR.fairShareFraction / dishes.length;
    return w.map((x) => ((1 - floor * dishes.length) * x) / total + floor);
  };
  const used = new Set(dishes.flatMap((d) => d.ingredients));
  const cases = {
    'nothing in stock': () => true,
    'only an item no dish uses': (i) => i !== 'servilletas',
  };
  for (const [name, isMissing] of Object.entries(cases)) {
    const table = probabilities(dishes, { now: NOW, events: [], dishes, isMissing }, 'medium');
    const want = before(isMissing);
    table.forEach((r, i) => close(r.p, want[i], `${name}: ${r.dish.id}`));
    // scoreDish still subtracts 0.6 per missing ingredient here.
    const d = dishes[0];
    assert.equal(
      scoreDish(d, { now: NOW, events: [], dishes, isMissing }),
      scoreDish(d, { now: NOW, events: [], dishes, isMissing: () => false }) - WEIGHTS.missingIngredient * d.ingredients.length,
    );
  }
  assert.ok(!used.has('servilletas'));

  // One ingredient some dish uses is enough to leave fallback mode.
  const one = probabilities(dishes, { now: NOW, events: [], dishes, isMissing: (i) => i !== 'huevo' }, 'medium');
  const huevos = one.find((r) => r.dish.id === 'huevos-fritos');
  assert.ok(huevos.p > 0.5, `huevos fritos, the only complete main, gets ${huevos.p}`);
});

test('fallback is worked out over the visible dishes only: an ingredient of a hidden dish does not count', () => {
  const dishes = [ibm(), igm({ neverShow: true })];
  const ctx = { now: NOW, events: [], dishes, isMissing: (i) => i !== 'oro' };
  const all = probabilities(dishes, ctx, 'medium');
  assert.equal(all.length, 1);
  assert.equal(all[0].floored, true);
  assert.equal(all[0].score, scoreDish(dishes[0], { ...ctx, pantryEmpty: true }));
});

test('sides: a complete side is drawn before an incomplete one', () => {
  const main = { ...igm({ id: 'main', ingredients: [] }), sides: ['good', 'bad'] };
  const good = ibm({ id: 'good', role: 'side', ingredients: ['papa'] });
  const bad = igm({ id: 'bad', role: 'side', ingredients: ['batata', 'manteca'], keyIngredients: ['batata'] });
  const dishes = [main, good, bad];
  const ctx = ctxFor(dishes, ['batata']);
  let goods = 0;
  let r = 0;
  const rng = () => ((r = (r * 9301 + 49297) % 233280), r / 233280);
  for (let i = 0; i < 500; i++) if (pickSide(main, ctx, 'medium', { rng }).id === 'good') goods++;
  assert.ok(goods > 450, `complete side ${goods}/500`);
});

test('keyIngredients: cleanDish keeps them, normalized and only among the ingredients', () => {
  const d = cleanDish({ id: 'x', name: 'X', ingredients: ['Pato', 'naranja'], keyIngredients: [' PATO ', 'pollo', 'pato'] });
  assert.deepEqual(d.keyIngredients, ['pato']);
  assert.deepEqual(cleanDish({ id: 'y', name: 'Y', ingredients: ['a'] }).keyIngredients, []);
  assert.deepEqual(cleanDish({ id: 'z', name: 'Z', ingredients: ['a'], keyIngredients: 'a' }).keyIngredients, []);
});

test('every starter key ingredient is one of its ingredients; only Minestrone and Verduras al vapor have none', () => {
  for (const d of STARTER_DISHES) for (const k of d.keyIngredients) assert.ok(d.ingredients.includes(k), `${d.id}: ${k}`);
  assert.deepEqual(STARTER_DISHES.filter((d) => d.keyIngredients.length === 0).map((d) => d.id), ['minestrone', 'verduras-vapor']);
  assert.deepEqual(STARTER_DISHES.find((d) => d.id === 'pato-naranja').keyIngredients, ['pato']);
});

const v8Blob = () => {
  const s = defaultState();
  return JSON.parse(
    JSON.stringify({
      ...s,
      schemaVersion: 8,
      dishes: s.dishes.map(({ keyIngredients, ...d }) => d),
    }),
  );
};

test('migration v8 → v9: starters get their 🔑; renamed starters and the user\'s own dishes do not', () => {
  const blob = v8Blob();
  const patoAt = blob.dishes.findIndex((d) => d.id === 'pato-naranja');
  blob.dishes[patoAt].name = 'Pato de la abuela';
  const tortilla = blob.dishes.find((d) => d.id === 'tortilla-papas');
  tortilla.ingredients = ['papa', 'huevos', 'cebolla']; // edited the ingredient: its key goes
  blob.dishes.push({ id: 'mio', name: 'Mi guiso', ingredients: ['carne'], mains: ['carne'] });
  const before = JSON.stringify(blob);

  const state = normalizeState(blob);
  assert.equal(JSON.stringify(blob), before, 'the input is not changed');
  assert.equal(state.schemaVersion, SCHEMA_VERSION);
  assert.equal(SCHEMA_VERSION, 9);
  const byId = (id) => state.dishes.find((d) => d.id === id);
  assert.deepEqual(byId('pato-naranja').keyIngredients, [], 'renamed: the user\'s');
  assert.deepEqual(byId('tortilla-papas').keyIngredients, ['papa'], 'only the keys still among its ingredients');
  assert.deepEqual(byId('mio').keyIngredients, []);
  assert.deepEqual(byId('fideua').keyIngredients, ['fideos de fideuá']);
  // An untouched phone ends up like a new install.
  const untouched = normalizeState(v8Blob());
  assert.deepEqual(untouched.dishes, defaultState().dishes);
});

test('keyIngredients survive export and import (a JSON round trip)', () => {
  const s = defaultState();
  s.dishes.push(cleanDish({ id: 'mio', name: 'Mío', ingredients: ['a', 'b'], keyIngredients: ['b'] }));
  const back = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.dishes.find((d) => d.id === 'mio').keyIngredients, ['b']);
  assert.deepEqual(back, s);
});
