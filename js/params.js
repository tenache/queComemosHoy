// Tuning: the numbers that shape suggestions and the wheel, in three layers,
// each overriding the one before:
//   1. the code: the constants in scoring.js and wheel.js (reviewed defaults);
//   2. params.json at the site root: values for everyone, edited on GitHub and
//      committed straight to main with no issue or PR (Thomas's rule, #17);
//   3. this phone: `settings.params`, set in Ajustes → Ajustes finos.
// Layers are applied by writing into those constant objects, which the code
// reads at call time. Every value is checked against PARAMS and clamped, so a
// typo or a broken params.json can't break the app. Pure: no DOM, no storage.

import { AFTER_MEAL, COOK_LEVEL, FLOOR, LIKING, SIDE_EFFORT, TEMPERATURE, WEIGHTS, YUM } from './scoring.js';
import { WHEEL } from './wheel.js';

const TARGETS = { WEIGHTS, WHEEL, TEMPERATURE, FLOOR, LIKING, YUM, COOK_LEVEL, SIDE_EFFORT, AFTER_MEAL };

// One row per number: [key, group, min, max, step, percent?]. `percent` shows
// a 0–1 share as 0–100 in the panel. Labels and help are in strings.js under
// `param:<key>` and `paramHelp:<key>`.
const ROWS = [
  ['WHEEL.weekday.min', 'wheel', 0, 1, 0.01, true],
  ['WHEEL.weekday.max', 'wheel', 0, 1, 0.01, true],
  ['WHEEL.weekend.min', 'wheel', 0, 1, 0.01, true],
  ['WHEEL.weekend.max', 'wheel', 0, 1, 0.01, true],
  ['WHEEL.frequencyCap', 'wheel', 1, 60, 1],
  ['WHEEL.windowDays', 'wheel', 1, 120, 1],
  ['WHEEL.recencyWeight', 'wheel', 0, 1, 0.05],
  ['WHEEL.pressureExponent', 'wheel', 0.25, 4, 0.05],
  ['WHEEL.recencyGraceDays', 'wheel', 0, 14, 0.5],
  ['WHEEL.recencyFadeDays', 'wheel', 0.5, 60, 0.5],

  ['WEIGHTS.yum', 'score', 0, 5, 0.05],
  ['WEIGHTS.health', 'score', 0, 5, 0.05],
  ['WEIGHTS.effort', 'score', 0, 5, 0.05],
  ['WEIGHTS.cookTime', 'score', 0, 5, 0.05],
  ['WEIGHTS.favorite', 'score', 0, 5, 0.05],
  ['WEIGHTS.missingIngredient', 'score', 0, 5, 0.05],
  ['SIDE_EFFORT.quantile', 'score', 0, 1, 0.05],
  ['COOK_LEVEL.minMinutes', 'score', 1, 120, 5],
  ['COOK_LEVEL.maxMinutes', 'score', 10, 600, 5],

  ['WEIGHTS.repeat', 'variety', 0, 10, 0.1],
  ['WEIGHTS.repeatFadeDays', 'variety', 0.5, 60, 0.5],
  ['WEIGHTS.fatigue', 'variety', 0, 10, 0.1],
  ['WEIGHTS.fatigueFadeDays', 'variety', 0.5, 30, 0.5],
  ['WEIGHTS.fatigueWindowDays', 'variety', 1, 30, 1],
  ['WEIGHTS.notTonight', 'variety', 0, 10, 0.1],
  ['WEIGHTS.notTonightFadeDays', 'variety', 0.5, 30, 0.5],
  ['TEMPERATURE.low', 'variety', 0.1, 5, 0.05],
  ['TEMPERATURE.medium', 'variety', 0.1, 5, 0.05],
  ['TEMPERATURE.high', 'variety', 0.1, 5, 0.05],
  ['FLOOR.fairShareFraction', 'variety', 0, 1, 0.01],
  ['FLOOR.swipeWindowDays', 'variety', 0, 30, 0.5],

  ['LIKING.cook', 'learning', 0, 1, 0.01],
  ['LIKING.cookAnyway', 'learning', 0, 1, 0.01],
  ['LIKING.pick', 'learning', 0, 1, 0.01],
  ['LIKING.missingReject', 'learning', -1, 0, 0.01],
  ['LIKING.reject', 'learning', -1, 0, 0.01],
  ['YUM.step', 'learning', 0, 1, 0.05],
  ['AFTER_MEAL.delayMinutes', 'learning', 0, 600, 5],
];

export const PARAM_GROUPS = ['wheel', 'score', 'variety', 'learning'];
export const PARAMS = ROWS.map(([key, group, min, max, step, percent = false]) => ({ key, group, min, max, step, percent }));
const BY_KEY = new Map(PARAMS.map((p) => [p.key, p]));

function holder(key) {
  const path = key.split('.');
  let obj = TARGETS[path[0]];
  for (const part of path.slice(1, -1)) obj = obj[part];
  return [obj, path[path.length - 1]];
}

/** The value in effect now. */
export function paramValue(key) {
  const [obj, field] = holder(key);
  return obj[field];
}

function write(key, value) {
  const [obj, field] = holder(key);
  obj[field] = value;
}

// The code's values, read once before any layer is applied.
const BASELINE = Object.fromEntries(PARAMS.map((p) => [p.key, paramValue(p.key)]));

/**
 * Known keys with finite numbers, clamped to their range. Anything else is
 * dropped: unknown keys, keys starting with "_" (notes in params.json), text.
 */
export function cleanParams(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    const p = BY_KEY.get(key);
    if (!p || typeof value !== 'number' || !Number.isFinite(value)) continue;
    out[key] = Math.min(p.max, Math.max(p.min, value));
  }
  return out;
}

let layers = { file: {}, phone: {} };

/** Sets every number to code ← file ← phone. Call again whenever a layer changes. */
export function applyParams(file = {}, phone = {}) {
  layers = { file: cleanParams(file), phone: cleanParams(phone) };
  for (const { key } of PARAMS) write(key, layers.phone[key] ?? layers.file[key] ?? BASELINE[key]);
  // Pairs that must stay in order, and the weight that is the rest of 1.
  for (const day of ['weekday', 'weekend']) WHEEL[day].min = Math.min(WHEEL[day].min, WHEEL[day].max);
  COOK_LEVEL.maxMinutes = Math.max(COOK_LEVEL.maxMinutes, COOK_LEVEL.minMinutes + 5);
  WHEEL.frequencyWeight = 1 - WHEEL.recencyWeight;
}

/** Where the value in effect comes from: 'phone', 'file' or 'code'. */
export function paramSource(key) {
  if (key in layers.phone) return 'phone';
  if (key in layers.file) return 'file';
  return 'code';
}

/** The value without this phone's change: what "reset" goes back to. */
export function defaultParam(key) {
  return layers.file[key] ?? BASELINE[key];
}

/** This phone's changes as params.json lines, sorted like PARAMS. */
export function paramsJson(phone) {
  const clean = cleanParams(phone);
  const entries = PARAMS.filter((p) => p.key in clean).map((p) => [p.key, clean[p.key]]);
  return JSON.stringify(Object.fromEntries(entries), null, 2);
}
