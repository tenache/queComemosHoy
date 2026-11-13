// Tests for the cook's mood: "¿Cómo está nuestro cocinero hoy?" (issue #21).

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyParams } from '../js/params.js';
import { MOOD, MOOD_IDS, TEMPERATURE, WEIGHTS, moodWeights, probabilities, temperature } from '../js/scoring.js';
import { defaultState, localDay, moodToday, normalizeState, setMood } from '../js/state.js';

const NOW = new Date(2026, 10, 13, 20, 0, 0).getTime(); // local time: the mood day is local
const plain = { id: 'x', name: 'X', role: 'main', health: 3, yum: 3, effort: 3, cookMinutes: 30, liking: 0, mains: ['x'], ingredients: [], sides: [] };
const dish = (id, changes) => ({ ...plain, id, name: id, mains: [id], ...changes });
const share = (dishes, mood, id, variety = 'medium') =>
  probabilities(dishes, { now: NOW, events: [], dishes, mood }, variety).find((r) => r.dish.id === id).p;

test('mood: each of the four answers multiplies its own weight by MOOD.boost and leaves the rest alone', () => {
  assert.equal(MOOD.boost, 2);
  const own = { lazy: 'effort', rushed: 'cookTime', yum: 'yum', healthy: 'health' };
  for (const [mood, key] of Object.entries(own)) {
    const W = moodWeights(mood);
    assert.equal(W[key], WEIGHTS[key] * MOOD.boost, mood);
    for (const other of Object.keys(WEIGHTS)) if (other !== key) assert.equal(W[other], WEIGHTS[other], `${mood}: ${other}`);
  }
  for (const mood of ['different', 'usual', null, 'nonsense']) assert.deepEqual(moodWeights(mood), WEIGHTS, String(mood));
});

test('mood: "algo distinto" multiplies the temperature by MOOD.variety, whatever the variety setting', () => {
  assert.equal(MOOD.variety, 1.5);
  for (const variety of ['low', 'medium', 'high']) {
    assert.equal(temperature(variety, 'different'), TEMPERATURE[variety] * MOOD.variety);
    for (const mood of [null, 'usual', 'lazy', 'yum']) assert.equal(temperature(variety, mood), TEMPERATURE[variety]);
  }
});

test('mood: each answer moves the suggestions its way, and "como siempre" moves nothing', () => {
  const pairs = {
    lazy: [dish('easy', { effort: 1 }), dish('hard', { effort: 5 })],
    rushed: [dish('easy', { cookMinutes: 10 }), dish('hard', { cookMinutes: 150 })],
    yum: [dish('easy', { yum: 5 }), dish('hard', { yum: 1 })],
    healthy: [dish('easy', { health: 5 }), dish('hard', { health: 1 })],
  };
  for (const [mood, dishes] of Object.entries(pairs)) {
    assert.ok(share(dishes, mood, 'easy') > share(dishes, null, 'easy'), `${mood} favours its dish more`);
    assert.equal(share(dishes, 'usual', 'easy'), share(dishes, null, 'easy'), `usual changes nothing (${mood} pair)`);
    // Another mood's answer doesn't touch this factor.
    const other = Object.keys(pairs).find((m) => m !== mood);
    assert.equal(share(dishes, other, 'easy'), share(dishes, null, 'easy'), `${other} leaves the ${mood} pair alone`);
  }
  // "Algo distinto": the favourite of the day gets a smaller share, the others more.
  const dishes = [dish('best', { yum: 5 }), dish('mid', { yum: 3 }), dish('low', { yum: 1 })];
  assert.ok(share(dishes, 'different', 'best') < share(dishes, null, 'best'));
  assert.ok(share(dishes, 'different', 'low') > share(dishes, null, 'low'));
});

test('mood: MOOD.boost and MOOD.variety are tunable (params.json or this phone), and 1 means no effect', () => {
  try {
    applyParams({ 'MOOD.boost': 3 }, { 'MOOD.variety': 2 });
    assert.equal(moodWeights('yum').yum, WEIGHTS.yum * 3);
    assert.equal(temperature('medium', 'different'), TEMPERATURE.medium * 2);
    applyParams({ 'MOOD.boost': 1, 'MOOD.variety': 1 });
    assert.deepEqual(moodWeights('lazy'), WEIGHTS);
    assert.equal(temperature('medium', 'different'), TEMPERATURE.medium);
  } finally {
    applyParams();
  }
  assert.deepEqual([MOOD.boost, MOOD.variety], [2, 1.5]);
});

test('mood: the answer lasts for the local day it was given', () => {
  const state = defaultState();
  assert.equal(state.settings.mood, null);
  assert.equal(moodToday(state, NOW), null);
  setMood(state, 'lazy', NOW);
  assert.deepEqual(state.settings.mood, { day: '2026-11-13', id: 'lazy' });
  assert.equal(moodToday(state, NOW + 3 * 3600e3), 'lazy'); // 23:00, same day
  assert.equal(moodToday(state, new Date(2026, 10, 14, 0, 5).getTime()), null); // 00:05 the next day
  setMood(state, 'nonsense', NOW);
  assert.equal(moodToday(state, NOW), 'lazy', 'an unknown answer is ignored');
  assert.equal(localDay(new Date(2026, 0, 2, 23, 59).getTime()), '2026-01-02');
  assert.deepEqual(MOOD_IDS, ['lazy', 'rushed', 'yum', 'healthy', 'different', 'usual']);
});

test('mood: normalizeState keeps a valid answer and drops a broken one', () => {
  const withMood = (mood) => {
    const raw = JSON.parse(JSON.stringify(defaultState()));
    raw.settings.mood = mood;
    return normalizeState(raw).settings.mood;
  };
  assert.deepEqual(withMood({ day: '2026-11-13', id: 'healthy' }), { day: '2026-11-13', id: 'healthy' });
  for (const bad of [{ day: '2026-11-13', id: 'hungry' }, { day: 'ayer', id: 'yum' }, { id: 'yum' }, 'yum', 7, undefined]) {
    assert.equal(withMood(bad), null, JSON.stringify(bad));
  }
});
