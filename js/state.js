// The app's state as one versioned JSON object, plus pure helpers that change
// it. No DOM and no storage here, so `node --test` can cover it.

import { STARTER_DISHES } from './dishes.js';
import { ACTIONS, LIKING, YUM, applyLiking, applyYum, clamp, normalizeName } from './scoring.js';

export const SCHEMA_VERSION = 1;
export const PANTRY_MODES = ['lazy', 'manual'];
export const VARIETIES = ['low', 'medium', 'high'];
export const MAX_MAINS = 3;

export function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    dishes: STARTER_DISHES.map((d) => ({ ...d, ingredients: [...d.ingredients], mains: [...d.mains] })),
    events: [], // {dishId, action, time, missing[]} (+ mealTime, verdict on afterMeal)
    missing: [], // the shopping list: ingredients marked missing
    inStock: [], // manual pantry mode: ingredients the user says they have
    settings: { pantryMode: 'lazy', variety: 'medium' },
  };
}

/** Trimmed, lower-cased, de-duplicated list of names. */
export function cleanNames(list) {
  const seen = new Set();
  for (const item of Array.isArray(list) ? list : []) {
    const name = normalizeName(item);
    if (name) seen.add(name);
  }
  return [...seen];
}

function cleanNumber(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? clamp(n, min, max) : fallback;
}

export function cleanDish(raw) {
  const ingredients = cleanNames(raw.ingredients);
  return {
    id: String(raw.id),
    name: String(raw.name ?? '').trim(),
    emoji: String(raw.emoji ?? '').trim() || '🍽️',
    ingredients,
    mains: cleanNames(raw.mains).slice(0, MAX_MAINS),
    cookMinutes: Math.round(cleanNumber(raw.cookMinutes, 0, 24 * 60, 30)),
    health: cleanNumber(raw.health, 1, 5, 3),
    yum: cleanNumber(raw.yum, YUM.min, YUM.max, 3),
    liking: cleanNumber(raw.liking, LIKING.min, LIKING.max, 0),
    neverShow: raw.neverShow === true,
  };
}

function cleanEvent(raw) {
  const event = {
    dishId: String(raw.dishId),
    action: raw.action,
    time: Number(raw.time),
    missing: cleanNames(raw.missing),
  };
  if (raw.action === ACTIONS.AFTER_MEAL) {
    event.mealTime = Number(raw.mealTime);
    event.verdict = raw.verdict === 'up' || raw.verdict === 'down' ? raw.verdict : null;
  }
  return event;
}

/**
 * Turns anything read from storage or an imported file into a valid state,
 * migrating older schema versions. Throws if it can't be used at all.
 */
export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('not-an-object');
  if (!Number.isInteger(raw.schemaVersion) || raw.schemaVersion < 1) throw new Error('no-schema-version');
  if (raw.schemaVersion > SCHEMA_VERSION) throw new Error('newer-schema');
  if (!Array.isArray(raw.dishes)) throw new Error('no-dishes');
  // Migrations from older versions go here: if (raw.schemaVersion === 1) { …; raw.schemaVersion = 2 }

  const actions = new Set(Object.values(ACTIONS));
  const seenIds = new Set();
  const dishes = [];
  for (const d of raw.dishes) {
    if (!d || typeof d !== 'object' || d.id == null || !String(d.name ?? '').trim()) continue;
    const dish = cleanDish(d);
    if (seenIds.has(dish.id)) continue;
    seenIds.add(dish.id);
    dishes.push(dish);
  }
  const events = (Array.isArray(raw.events) ? raw.events : [])
    .filter((e) => e && typeof e === 'object' && actions.has(e.action) && Number.isFinite(Number(e.time)))
    .map(cleanEvent);
  const settings = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};

  return {
    schemaVersion: SCHEMA_VERSION,
    dishes,
    events,
    missing: cleanNames(raw.missing),
    inStock: cleanNames(raw.inStock),
    settings: {
      pantryMode: PANTRY_MODES.includes(settings.pantryMode) ? settings.pantryMode : 'lazy',
      variety: VARIETIES.includes(settings.variety) ? settings.variety : 'medium',
    },
  };
}

// ---- Pantry -----------------------------------------------------------

/**
 * Is this ingredient missing right now?
 * Lazy mode: only if it was marked missing. Manual mode: unless marked in stock.
 */
export function isMissing(state, name) {
  const n = normalizeName(name);
  if (state.settings.pantryMode === 'manual') return !state.inStock.includes(n);
  return state.missing.includes(n);
}

/** Puts ingredients on the shopping list (and out of the manual pantry). */
export function markMissing(state, names) {
  for (const n of cleanNames(names)) {
    if (!state.missing.includes(n)) state.missing.push(n);
    state.inStock = state.inStock.filter((x) => x !== n);
  }
}

/** "Bought": off the shopping list and back in the pantry. */
export function markInStock(state, names) {
  for (const n of cleanNames(names)) {
    state.missing = state.missing.filter((x) => x !== n);
    if (!state.inStock.includes(n)) state.inStock.push(n);
  }
}

/** Every ingredient the app knows about, sorted. */
export function allIngredients(state) {
  const all = new Set([...state.missing, ...state.inStock]);
  for (const dish of state.dishes) for (const i of dish.ingredients) all.add(i);
  return [...all].sort((a, b) => a.localeCompare(b, 'es'));
}

export function allMains(state) {
  const all = new Set();
  for (const dish of state.dishes) for (const m of dish.mains) all.add(m);
  return [...all].sort((a, b) => a.localeCompare(b, 'es'));
}

// ---- Events -----------------------------------------------------------

/** Appends a card action to the log and applies its effect on the dish. */
export function logCardAction(state, dishId, action, missing = [], now = Date.now()) {
  const dish = state.dishes.find((d) => d.id === dishId);
  if (!dish) return null;
  const event = { dishId, action, time: now, missing: cleanNames(missing) };
  state.events.push(event);
  dish.liking = applyLiking(dish.liking, action);
  markMissing(state, event.missing);
  return event;
}

/** Records the after-meal answer (or a skip, with no verdict and nothing missing). */
export function logAfterMeal(state, mealEvent, { missing = [], verdict = null } = {}, now = Date.now()) {
  const dish = state.dishes.find((d) => d.id === mealEvent.dishId);
  const event = {
    dishId: mealEvent.dishId,
    action: ACTIONS.AFTER_MEAL,
    time: now,
    missing: cleanNames(missing),
    mealTime: mealEvent.time,
    verdict,
  };
  state.events.push(event);
  if (dish && verdict) dish.yum = applyYum(dish.yum, verdict === 'up');
  markMissing(state, event.missing);
  return event;
}
