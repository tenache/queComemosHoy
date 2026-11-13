// Tests for effort (hidden, 1–5) and cooking time on the 1–5 scale (issue #9).

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { STARTER_DISHES } from '../js/dishes.js';
import { COOK_LEVEL, EFFORT, WEIGHTS, cookLevel, scoreDish } from '../js/scoring.js';
import { SCHEMA_VERSION, normalizeState } from '../js/state.js';

const NOW = Date.UTC(2026, 10, 13, 20, 0, 0);
const ctx = () => ({ now: NOW, events: [], dishes: STARTER_DISHES });
const plain = { id: 'x', name: 'X', health: 3, yum: 3, effort: 3, cookMinutes: 30, liking: 0, mains: ['x'], ingredients: [] };
const score = (changes) => scoreDish({ ...plain, ...changes }, ctx());

test('cookLevel: 1 at 10 minutes or less, 5 at 2½ hours or more, logarithmic in between', () => {
  assert.deepEqual([COOK_LEVEL.minMinutes, COOK_LEVEL.maxMinutes], [10, 150]);
  assert.equal(cookLevel(0), 1);
  assert.equal(cookLevel(10), 1);
  assert.ok(Math.abs(cookLevel(150) - 5) < 1e-9);
  assert.equal(cookLevel(180), cookLevel(150));
  // Each level about doubles the time, so short dishes are told apart.
  for (const [minutes, level] of [[20, 2], [40, 3], [75, 4]]) {
    assert.ok(Math.abs(cookLevel(minutes) - level) < 0.1, `${minutes} min is level ${cookLevel(minutes)}`);
  }
  let previous = 0;
  for (let minutes = 10; minutes <= 150; minutes += 5) {
    assert.ok(cookLevel(minutes) > previous, `${minutes} min ranks above ${minutes - 5}`);
    previous = cookLevel(minutes);
  }
});

test('weights: cooking time counts as much as yum, effort between yum and health', () => {
  assert.equal(WEIGHTS.cookTime, WEIGHTS.yum);
  assert.ok(WEIGHTS.effort < WEIGHTS.yum && WEIGHTS.effort > WEIGHTS.health);
  // The full 1 → 5 range of each moves the score by exactly its weight.
  const close = (a, b) => Math.abs(a - b) < 1e-9;
  assert.ok(close(score({ yum: 5 }) - score({ yum: 1 }), WEIGHTS.yum));
  assert.ok(close(score({ cookMinutes: 10 }) - score({ cookMinutes: 150 }), WEIGHTS.cookTime));
  assert.ok(close(score({ effort: 1 }) - score({ effort: 5 }), WEIGHTS.effort));
  assert.ok(close(score({ health: 5 }) - score({ health: 1 }), WEIGHTS.health));
});

test('more effort or more time lowers the score; a dish with no effort counts as the default', () => {
  assert.ok(score({ effort: 2 }) > score({ effort: 4 }));
  assert.ok(score({ cookMinutes: 20 }) > score({ cookMinutes: 60 }));
  assert.equal(score({ effort: undefined }), score({ effort: EFFORT.default }));
  // Hands-on work, not total time: the oven chicken is easy, the empanadas are not.
  const effort = (id) => STARTER_DISHES.find((d) => d.id === id).effort;
  assert.ok(effort('pollo-horno-papas') < effort('empanadas-carne'));
});

test('starter efforts are consistent: a dish never takes less work than one it includes', () => {
  const effort = (id) => STARTER_DISHES.find((d) => d.id === id).effort;
  const includes = [
    ['pollo-curry', 'arroz-blanco'],
    ['wok-verduras', 'arroz-blanco'],
    ['arroz-atun', 'arroz-blanco'],
    ['croquetas-arroz', 'arroz-blanco'],
    ['fideos-huevo', 'huevos-fritos'],
    ['fideos-huevo', 'fideos-manteca'],
    ['ensalada-completa', 'ensalada-mixta'],
    ['tortilla-papas', 'papas-fritas'],
  ];
  for (const [dish, part] of includes) assert.ok(effort(dish) >= effort(part), `${dish} (${effort(dish)}) >= ${part} (${effort(part)})`);
  assert.equal(effort('pure-calabaza'), effort('pure'), 'both purés take the same work (Thomas, 2026-11-13)');
});

test('migration v4 → v5: starter dishes get their effort, the user\'s own get the default', () => {
  const pollo = STARTER_DISHES.find((d) => d.id === 'pollo-horno-papas');
  const { effort: _, ...polloV4 } = pollo;
  const state = normalizeState({
    schemaVersion: 4,
    dishes: [
      polloV4,
      { id: 'd-mine', name: 'Mi guiso', ingredients: ['carne'], mains: ['carne'], cookMinutes: 90, health: 3, yum: 4 },
    ],
  });
  assert.equal(state.schemaVersion, SCHEMA_VERSION);
  assert.equal(state.dishes.find((d) => d.id === 'pollo-horno-papas').effort, pollo.effort);
  assert.equal(state.dishes.find((d) => d.id === 'd-mine').effort, EFFORT.default);
});

test('effort survives a round trip and is clamped to 1–5', () => {
  const state = normalizeState({ schemaVersion: SCHEMA_VERSION, dishes: [{ ...plain, effort: 2 }, { ...plain, id: 'y', effort: 9 }] });
  const again = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(again.dishes.map((d) => d.effort), [2, 5]);
});
