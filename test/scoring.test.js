// Behaviour tests for scoring.js. They check directions and rough sizes,
// not exact numbers, so the weights can be tuned without rewriting them.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { STARTER_DISHES } from '../js/dishes.js';
import {
  ACTIONS,
  FLOOR,
  LIKING,
  TEMPERATURE,
  afterMealDue,
  applyLiking,
  applyYum,
  pickDish,
  probabilities,
  scoreDish,
} from '../js/scoring.js';

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const NOW = Date.UTC(2026, 10, 10, 20, 0, 0);

const dish = (id) => {
  const found = STARTER_DISHES.find((d) => d.id === id);
  assert.ok(found, `starter dish ${id} exists`);
  return found;
};
const ctx = (events = [], extra = {}) => ({ now: NOW, events, dishes: STARTER_DISHES, ...extra });
const event = (dishId, action, daysAgo, missing = []) => ({ dishId, action, time: NOW - daysAgo * DAY, missing });

/** Deterministic rng (mulberry32) so sampling tests can't flake. */
function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

test('not tonight fades: a left swipe costs a lot today and almost nothing after 4 days', () => {
  const tortilla = dish('tortilla-papas');
  const normal = scoreDish(tortilla, ctx());
  const today = scoreDish(tortilla, ctx([event(tortilla.id, ACTIONS.REJECT, 0)]));
  const fourDaysLater = scoreDish(tortilla, ctx([event(tortilla.id, ACTIONS.REJECT, 4)]));

  assert.ok(normal - today > 1.5, `big drop today (${normal - today})`);
  assert.ok(normal - fourDaysLater < 0.25, `nearly back after 4 days (${normal - fourDaysLater})`);
  assert.ok(normal - fourDaysLater > 0, 'still a trace of it');
});

// The dish everyone tolerates but nobody asks for, at the lowest liking.
const DISLIKED = 'milanesas-berenjena';
const withDisliked = () => STARTER_DISHES.map((d) => (d.id === DISLIKED ? { ...d, liking: LIKING.min } : d));
const pOf = (table, id) => table.find((r) => r.dish.id === id).p;

test('no bans: at the lowest liking and lowest variety a dish keeps an eighth of a fair share', () => {
  const dishes = withDisliked();
  const floor = FLOOR.fairShareFraction / dishes.length;
  assert.equal(FLOOR.fairShareFraction, 1 / 8);

  for (const variety of Object.keys(TEMPERATURE)) {
    const p = pOf(probabilities(dishes, ctx([], { dishes }), variety), DISLIKED);
    assert.ok(p >= floor, `${variety}: p = 1 in ${Math.round(1 / p)}, floor is 1 in ${Math.round(1 / floor)}`);
    assert.ok(p < 1 / dishes.length, `${variety}: still below a fair share`);
  }

  // The floor holds however bad the score gets, as long as there is no recent left swipe.
  const oldSwipes = Array.from({ length: 300 }, () => event(DISLIKED, ACTIONS.REJECT, FLOOR.swipeWindowDays + 0.5));
  const eatenToday = [event(DISLIKED, ACTIONS.COOK, 0), event(DISLIKED, ACTIONS.COOK, 0)];
  const allMissing = { dishes, isMissing: () => true };
  for (const [name, c] of Object.entries({
    oldSwipes: ctx(oldSwipes, { dishes }),
    eatenToday: ctx(eatenToday, { dishes }),
    allMissing: ctx([], allMissing),
  })) {
    for (const row of probabilities(dishes, c, 'low')) assert.ok(row.p >= floor, `${name}: ${row.dish.id} keeps the floor`);
  }

  // And the sampler delivers it: 20000 × floor picks expected from the floor alone
  // (52 with 48 starter dishes). Allow for sampling noise, well above zero.
  const rng = seededRng(1);
  let hits = 0;
  for (let i = 0; i < 20000; i++) {
    if (pickDish(dishes, ctx([], { dishes }), 'low', { rng }).id === DISLIKED) hits++;
  }
  assert.ok(hits >= 20000 * floor * 0.7, `picked ${hits} times in 20000`);
});

test('no bans: a dish swiped left in the last 4 days gets no floor, then gets it back', () => {
  const dishes = withDisliked();
  const floor = FLOOR.fairShareFraction / dishes.length;
  const at = (daysAgo) => {
    const table = probabilities(dishes, ctx([event(DISLIKED, ACTIONS.REJECT, daysAgo)], { dishes }), 'low');
    return table.find((r) => r.dish.id === DISLIKED);
  };

  const yesterday = at(1);
  assert.equal(yesterday.floored, false);
  assert.ok(yesterday.p < floor, `swiped yesterday: 1 in ${Math.round(1 / yesterday.p)}, below the floor`);
  assert.ok(yesterday.p > 0, 'but still not impossible');
  assert.ok(at(FLOOR.swipeWindowDays - 0.1).p < floor, 'no floor just inside the window');
  assert.ok(at(FLOOR.swipeWindowDays + 0.1).p >= floor, 'the floor is back just after it');

  // Other actions do not remove the floor: only a left swipe does.
  for (const action of [ACTIONS.MISSING_REJECT, ACTIONS.COOK, ACTIONS.COOK_ANYWAY, ACTIONS.PICK]) {
    const table = probabilities(dishes, ctx([event(DISLIKED, action, 0)], { dishes }), 'low');
    assert.ok(pOf(table, DISLIKED) >= floor, `${action} keeps the floor`);
  }
  // Everyone else keeps theirs while one dish is swiped.
  const table = probabilities(dishes, ctx([event(DISLIKED, ACTIONS.REJECT, 0)], { dishes }), 'low');
  for (const row of table) if (row.dish.id !== DISLIKED) assert.ok(row.p >= floor);
  assert.ok(Math.abs(table.reduce((a, r) => a + r.p, 0) - 1) < 1e-9, 'probabilities still sum to 1');
});

test('the floor is small: liking still decides how often a dish comes up', () => {
  const dishes = withDisliked();
  const neutral = pOf(probabilities(STARTER_DISHES, ctx(), 'low'), DISLIKED);
  const disliked = pOf(probabilities(dishes, ctx([], { dishes }), 'low'), DISLIKED);
  assert.ok(disliked < neutral / 2, 'the lowest liking makes it much rarer than neutral');
});

test('list pick: gives the biggest boost of any action, and counts as eaten', () => {
  const pick = applyLiking(0, ACTIONS.PICK);
  assert.ok(pick > applyLiking(0, ACTIONS.COOK_ANYWAY), 'more than "cook anyway"');
  assert.ok(pick > applyLiking(0, ACTIONS.COOK), 'more than "cook this"');

  const d = dish('fideos-huevo');
  const picked = scoreDish(d, ctx([event(d.id, ACTIONS.PICK, 1)]));
  const cooked = scoreDish(d, ctx([event(d.id, ACTIONS.COOK, 1)]));
  assert.equal(picked, cooked, 'same repeat penalty as a cooked meal');
  const soup = dish('sopa-pollo');
  assert.ok(scoreDish(soup, ctx([event('pollo-curry', ACTIONS.PICK, 1)])) < scoreDish(soup, ctx()), 'and it causes ingredient fatigue');
  assert.ok(afterMealDue([event(d.id, ACTIONS.PICK, 0.5)], STARTER_DISHES, NOW), 'and it gets the after-meal question');
});

test('no bans: liking beyond the clamp cannot push a dish further down', () => {
  const atMin = { ...dish('lentejas'), liking: LIKING.min };
  const wayBelow = { ...dish('lentejas'), liking: -50 };
  assert.equal(scoreDish(wayBelow, ctx()), scoreDish(atMin, ctx()));
  assert.equal(applyLiking(LIKING.min, ACTIONS.REJECT), LIKING.min);
  assert.equal(applyLiking(LIKING.max, ACTIONS.COOK_ANYWAY), LIKING.max);
});

test('penalty sizes: a cart rejection costs less than a left swipe', () => {
  const cart = applyLiking(0, ACTIONS.MISSING_REJECT);
  const swipe = applyLiking(0, ACTIONS.REJECT);
  assert.ok(cart < 0 && swipe < 0, 'both are penalties');
  assert.ok(cart > swipe, 'the cart one is lighter');
  assert.ok(Math.abs(cart) <= Math.abs(swipe) / 2, 'clearly lighter, not just barely');

  // The same holds for the score right after the action (the left swipe also adds "not tonight").
  const d = dish('pollo-curry');
  const afterCart = scoreDish({ ...d, liking: cart }, ctx([event(d.id, ACTIONS.MISSING_REJECT, 0)]));
  const afterSwipe = scoreDish({ ...d, liking: swipe }, ctx([event(d.id, ACTIONS.REJECT, 0)]));
  assert.ok(afterCart > afterSwipe);
});

test('penalty sizes: "cook anyway" gains more than "cook this"', () => {
  const cook = applyLiking(0, ACTIONS.COOK);
  const anyway = applyLiking(0, ACTIONS.COOK_ANYWAY);
  assert.ok(cook > 0, 'cooking is a positive signal');
  assert.ok(anyway > cook, 'cooking despite missing ingredients is a stronger one');
});

test('ingredient fatigue: chicken soup scores lower after chicken curry than after lentils', () => {
  const soup = dish('sopa-pollo');
  const fresh = scoreDish(soup, ctx());
  const afterCurry = scoreDish(soup, ctx([event('pollo-curry', ACTIONS.COOK, 1)]));
  const afterLentils = scoreDish(soup, ctx([event('lentejas', ACTIONS.COOK, 1)]));

  assert.ok(afterCurry < afterLentils, 'chicken yesterday counts against chicken today');
  assert.equal(afterLentils, fresh, 'lentils share no main ingredient, so no penalty');
});

test('ingredient fatigue: partial for partly shared mains, gone after a week', () => {
  const curry = dish('pollo-curry'); // pollo + arroz
  const soup = dish('sopa-pollo'); // pollo
  const curryDrop = scoreDish(curry, ctx()) - scoreDish(curry, ctx([event(soup.id, ACTIONS.COOK, 1)])); // 1 of 2 shared
  const soupDrop = scoreDish(soup, ctx()) - scoreDish(soup, ctx([event(curry.id, ACTIONS.COOK, 1)])); // 1 of 1 shared

  assert.ok(curryDrop > 0);
  assert.ok(curryDrop < soupDrop, 'half-shared mains cost less than fully shared');
  assert.equal(scoreDish(curry, ctx([event(soup.id, ACTIONS.COOK, 8)])), scoreDish(curry, ctx()), 'outside the 7-day window');
});

test('ingredient fatigue: staples in the ingredient list do not count, only main tags', () => {
  // Tortilla and lentejas both list cebolla and papa, but the only main tag of lentejas is "legumbres".
  const lentejas = dish('lentejas');
  assert.equal(scoreDish(lentejas, ctx([event('tortilla-papas', ACTIONS.COOK, 1)])), scoreDish(lentejas, ctx()));
});

test('repeats: the same dish yesterday scores much lower than 3 weeks ago', () => {
  const d = dish('fideos-huevo');
  const fresh = scoreDish(d, ctx());
  const yesterday = scoreDish(d, ctx([event(d.id, ACTIONS.COOK, 1)]));
  const threeWeeks = scoreDish(d, ctx([event(d.id, ACTIONS.COOK_ANYWAY, 21)]));

  assert.ok(threeWeeks - yesterday > 1.5, `much lower yesterday (${threeWeeks - yesterday})`);
  assert.ok(fresh - threeWeeks < 0.2, 'three weeks on it is nearly forgotten');
});

test('never show: a dish marked "never show" is never picked', () => {
  const hidden = { ...dish('pato-naranja'), neverShow: true, liking: LIKING.max, yum: 5, health: 5, cookMinutes: 0 };
  const dishes = STARTER_DISHES.map((d) => (d.id === hidden.id ? hidden : d));
  const rng = seededRng(7);

  assert.ok(!probabilities(dishes, ctx([], { dishes }), 'high').some((r) => r.dish.id === hidden.id));
  for (let i = 0; i < 5000; i++) {
    assert.notEqual(pickDish(dishes, ctx([], { dishes }), 'high', { rng }).id, hidden.id);
  }
  assert.equal(pickDish([hidden], ctx([], { dishes: [hidden] })), null, 'nothing to pick if it is the only dish');
});

test('missing ingredients lower the score, more for each one', () => {
  const d = dish('pollo-curry');
  const none = scoreDish(d, ctx());
  const one = scoreDish(d, ctx([], { isMissing: (i) => i === 'curry' }));
  const two = scoreDish(d, ctx([], { isMissing: (i) => i === 'curry' || i === 'crema' }));
  assert.ok(none > one && one > two);
});

test('simple, quick dishes beat ambitious ones on a neutral day', () => {
  // The app should lean toward fideos con huevo rather than pato a la naranja.
  assert.ok(scoreDish(dish('fideos-huevo'), ctx()) > scoreDish(dish('pato-naranja'), ctx()));
});

test('softmax: probabilities sum to 1 and lower variety concentrates on the best dishes', () => {
  const sum = (variety) => probabilities(STARTER_DISHES, ctx(), variety).reduce((a, r) => a + r.p, 0);
  const top = (variety) => Math.max(...probabilities(STARTER_DISHES, ctx(), variety).map((r) => r.p));

  for (const variety of Object.keys(TEMPERATURE)) assert.ok(Math.abs(sum(variety) - 1) < 1e-9);
  assert.ok(top('low') > top('medium') && top('medium') > top('high'));
});

test('softmax: huge score gaps do not break the maths', () => {
  const swipes = Array.from({ length: 2000 }, () => event('asado', ACTIONS.REJECT, 0));
  const table = probabilities(STARTER_DISHES, ctx(swipes), 'low');
  assert.ok(table.every((r) => Number.isFinite(r.p) && r.p >= 0));
  assert.ok(Math.abs(table.reduce((a, r) => a + r.p, 0) - 1) < 1e-9);
});

test('pickDish: follows the rng and honours `exclude`', () => {
  const table = probabilities(STARTER_DISHES, ctx());
  const first = table[0].dish.id;
  assert.equal(pickDish(STARTER_DISHES, ctx(), 'medium', { rng: () => 0 }).id, first);
  assert.equal(pickDish(STARTER_DISHES, ctx(), 'medium', { rng: () => 0.999999999 }).id, table.at(-1).dish.id);
  assert.notEqual(pickDish(STARTER_DISHES, ctx(), 'medium', { rng: () => 0, exclude: [first] }).id, first);
});

test('after-meal yumminess stays within 1 to 5', () => {
  assert.equal(applyYum(3, true), 3.25);
  assert.equal(applyYum(3, false), 2.75);
  assert.equal(applyYum(5, true), 5);
  assert.equal(applyYum(1, false), 1);
});

test('after-meal question: due from cook minutes + 60 min, once per meal, not for old meals', () => {
  const d = dish('tortilla-papas'); // 40 min
  const meal = { dishId: d.id, action: ACTIONS.COOK, time: NOW, missing: [] };
  const at = (minutes, events = [meal]) => afterMealDue(events, STARTER_DISHES, NOW + minutes * MIN);

  assert.equal(at(99), null, 'too early');
  assert.equal(at(100)?.event, meal, 'due at cook minutes + 60');
  assert.equal(at(100).dish.id, d.id);
  assert.equal(at(49 * 60), null, 'too old to ask');

  const answered = { dishId: d.id, action: ACTIONS.AFTER_MEAL, time: NOW + 120 * MIN, missing: [], mealTime: meal.time, verdict: 'up' };
  assert.equal(at(180, [meal, answered]), null, 'asked at most once');

  const rejected = { dishId: 'lentejas', action: ACTIONS.REJECT, time: NOW, missing: [] };
  assert.equal(at(600, [rejected]), null, 'only meals count');
  assert.equal(afterMealDue([], STARTER_DISHES, NOW), null);
});

test('starter dishes: about 30 to 40 mains plus sides, valid, and include the ones the spec names', () => {
  const mains = STARTER_DISHES.filter((d) => d.role === 'main');
  assert.ok(mains.length >= 28 && mains.length <= 45, `${mains.length} mains`);
  assert.ok(STARTER_DISHES.every((d) => d.role === 'main' || d.role === 'side'));
  const ids = new Set(STARTER_DISHES.map((d) => d.id));
  for (const d of STARTER_DISHES) {
    for (const s of d.sides) assert.ok(ids.has(s) && s !== d.id, `${d.id}: side ${s} is a starter dish`);
    if (d.role === 'side') assert.deepEqual(d.sides, [], `${d.id}: a side has no sides`);
  }
  assert.equal(new Set(STARTER_DISHES.map((d) => d.id)).size, STARTER_DISHES.length, 'ids are unique');

  const staples = ['cebolla', 'ajo', 'aceite', 'sal'];
  for (const d of STARTER_DISHES) {
    assert.ok(d.name && d.emoji, `${d.id} has a name and emoji`);
    assert.ok(d.mains.length >= 1 && d.mains.length <= 3, `${d.id} has 1 to 3 mains`);
    assert.ok(!d.mains.some((m) => staples.includes(m)), `${d.id} does not tag staples`);
    assert.ok(d.ingredients.length >= 1, `${d.id} has ingredients`);
    for (const key of ['health', 'yum', 'effort']) assert.ok(d[key] >= 1 && d[key] <= 5, `${d.id} ${key} is 1 to 5`);
    assert.ok(d.cookMinutes > 0);
  }

  const names = STARTER_DISHES.map((d) => d.name.toLowerCase());
  const wanted = [
    'fideos con huevo frito',
    'tortilla de papas',
    'milanesas de berenjena',
    'pollo al curry con arroz',
    'sopa de pollo',
    'lentejas',
    'pato a la naranja',
  ];
  for (const name of wanted) assert.ok(names.includes(name), `includes ${name}`);

  const berenjena = dish('milanesas-berenjena');
  assert.equal(berenjena.yum, 2);
  assert.equal(berenjena.health, 4);
  for (const pasta of ['fideos-huevo', 'ravioles-tuco', 'noquis']) assert.ok(dish(pasta).mains.includes('pasta'));
});
