// Tests for the tuning layers (js/params.js, issue #17): code ← params.json ← this phone.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { PARAMS, PARAM_GROUPS, applyParams, cleanParams, defaultParam, paramSource, paramValue, paramsJson } from '../js/params.js';
import { SIDE_EFFORT, WEIGHTS } from '../js/scoring.js';
import { defaultState, normalizeState } from '../js/state.js';
import { t } from '../js/strings.js';
import { WHEEL, cookShare } from '../js/wheel.js';

const CODE = Object.fromEntries(PARAMS.map((p) => [p.key, paramValue(p.key)]));
const DAY = 24 * 60 * 60 * 1000;
const MONDAY = new Date(2026, 10, 9, 20, 0, 0).getTime(); // local time, like wheel.test.js
const daily = (n) => Array.from({ length: n }, (_, i) => ({ time: MONDAY - (i + 1) * DAY, cuisine: 'Pizza' }));

/** Runs `fn` with these layers, then puts the code's values back. */
function withLayers(file, phone, fn) {
  try {
    applyParams(file, phone);
    fn();
  } finally {
    applyParams();
  }
}

test('every tuning number exists in the code, in a known group, with a range that holds the code value, and has a label and help', () => {
  assert.equal(new Set(PARAMS.map((p) => p.key)).size, PARAMS.length, 'keys are unique');
  for (const p of PARAMS) {
    assert.equal(typeof CODE[p.key], 'number', `${p.key} is a number in the code`);
    assert.ok(PARAM_GROUPS.includes(p.group), `${p.key}: group ${p.group}`);
    assert.ok(p.min <= CODE[p.key] && CODE[p.key] <= p.max, `${p.key}: ${CODE[p.key]} within ${p.min}…${p.max}`);
    for (const prefix of ['param', 'paramHelp']) assert.notEqual(t(`${prefix}:${p.key}`), `${prefix}:${p.key}`, `${prefix}:${p.key} in strings.js`);
  }
  for (const group of PARAM_GROUPS) assert.notEqual(t(`tuningGroup:${group}`), `tuningGroup:${group}`);
});

test('cleanParams keeps known numbers, clamped, and drops the rest', () => {
  assert.deepEqual(cleanParams(null), {});
  assert.deepEqual(cleanParams([1, 2]), {});
  assert.deepEqual(
    cleanParams({
      'WHEEL.frequencyCap': 15,
      'WEIGHTS.yum': 99,
      'LIKING.reject': -7,
      'WEIGHTS.health': '2',
      'WEIGHTS.effort': Number.NaN,
      'WHEEL.nope': 3,
      _ayuda: 'a note',
    }),
    { 'WHEEL.frequencyCap': 15, 'WEIGHTS.yum': 5, 'LIKING.reject': -1 },
  );
});

test('layers: params.json overrides the code, this phone overrides params.json, and no layers puts the code back', () => {
  withLayers({ 'WHEEL.frequencyCap': 15, 'WEIGHTS.yum': 2 }, { 'WEIGHTS.yum': 3, 'SIDE_EFFORT.quantile': 0.5 }, () => {
    assert.equal(WHEEL.frequencyCap, 15);
    assert.equal(WEIGHTS.yum, 3);
    assert.equal(SIDE_EFFORT.quantile, 0.5);
    assert.deepEqual(
      ['WHEEL.frequencyCap', 'WEIGHTS.yum', 'WEIGHTS.health'].map(paramSource),
      ['file', 'phone', 'code'],
    );
    assert.equal(defaultParam('WEIGHTS.yum'), 2, 'reset on this phone goes back to the file');
    assert.equal(defaultParam('WEIGHTS.health'), CODE['WEIGHTS.health']);
  });
  for (const p of PARAMS) assert.equal(paramValue(p.key), CODE[p.key], `${p.key} is back to the code`);
  assert.equal(WHEEL.frequencyWeight, 1 - WHEEL.recencyWeight);
});

test('the numbers really change what the app does: a higher frequency cap needs more deliveries to fill the slice', () => {
  const full = cookShare(daily(12), MONDAY);
  assert.equal(full, WHEEL.weekday.max, '12 deliveries fill it with the code values');
  withLayers({}, { 'WHEEL.frequencyCap': 15 }, () => {
    assert.ok(cookShare(daily(12), MONDAY) < full, 'with 15, 12 deliveries are not enough');
    assert.equal(cookShare(daily(15), MONDAY), WHEEL.weekday.max);
  });
});

test('pairs stay in order, and the frequency weight is the rest of the recency weight', () => {
  withLayers({}, { 'WHEEL.weekday.min': 0.9, 'WHEEL.weekday.max': 0.5, 'COOK_LEVEL.minMinutes': 100, 'COOK_LEVEL.maxMinutes': 60, 'WHEEL.recencyWeight': 0.4 }, () => {
    assert.equal(WHEEL.weekday.min, 0.5, 'min never above max');
    assert.ok(paramValue('COOK_LEVEL.maxMinutes') > paramValue('COOK_LEVEL.minMinutes'));
    assert.ok(Math.abs(WHEEL.frequencyWeight - 0.6) < 1e-12);
  });
});

test('"Copiar mis valores" gives params.json lines that read back the same', () => {
  const json = paramsJson({ 'WEIGHTS.yum': 2, 'WHEEL.frequencyCap': 17, junk: 1 });
  assert.equal(json, '{\n  "WHEEL.frequencyCap": 17,\n  "WEIGHTS.yum": 2\n}', 'in PARAMS order, junk dropped');
  assert.deepEqual(cleanParams(JSON.parse(json)), { 'WHEEL.frequencyCap': 17, 'WEIGHTS.yum': 2 });
  assert.equal(paramsJson({}), '{}');
});

test("the repo's params.json is valid JSON with only known keys, all in range", () => {
  const file = JSON.parse(readFileSync(new URL('../params.json', import.meta.url), 'utf8'));
  const values = Object.fromEntries(Object.entries(file).filter(([key]) => !key.startsWith('_')));
  assert.deepEqual(cleanParams(values), values, 'nothing unknown, nothing clamped');
});

test("this phone's numbers are saved with the state, cleaned", () => {
  assert.deepEqual(defaultState().settings.params, {});
  const state = defaultState();
  state.settings.params = { 'WHEEL.frequencyCap': 15, 'WEIGHTS.yum': 50, nope: 1 };
  const back = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(back.settings.params, { 'WHEEL.frequencyCap': 15, 'WEIGHTS.yum': 5 });
  const old = defaultState();
  delete old.settings.params;
  assert.deepEqual(normalizeState(old).settings.params, {}, 'data from before #17 gets none');
});
