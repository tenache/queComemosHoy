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

test('cookLevel: 1 at 10 minutes or less, 5 at 2½ hours or more, a straight line in between', () => {
  assert.deepEqual([COOK_LEVEL.minMinutes, COOK_LEVEL.maxMinutes], [10, 150]);
  assert.equal(cookLevel(0), 1);
  assert.equal(cookLevel(10), 1);
  assert.equal(cookLevel(45), 2);
  assert.equal(cookLevel(80), 3);
  assert.equal(cookLevel(150), 5);
  assert.equal(cookLevel(180), 5);
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
