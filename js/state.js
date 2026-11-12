// The app's state as one versioned JSON object, plus pure helpers that change
// it. No DOM and no storage here, so `node --test` can cover it.

import { NEW_IN_V3, SPLIT_IN_V3, STARTER_DISHES } from './dishes.js';
import { ACTIONS, FAVORITES_MAX, LIKING, YUM, applyLiking, applyYum, clamp, isEaten, normalizeName } from './scoring.js';
import { FOODS } from './nutrition.js';
import { DEFAULT_CUISINES, cleanCuisine, cleanCuisines } from './wheel.js';

// 1: the v1 app. 2: adds the delivery wheel (`cuisines`, `deliveries`).
// 3: mains and sides (`role`, `sides`, `sideId` on meals) and favourites.
// 4: recipes the user wrote (`recipe` on a dish) and the portions setting.
export const SCHEMA_VERSION = 4;
export const PORTIONS = { min: 1, max: 12, default: 2 };
const MAX_RECIPE_ITEMS = 40;
const MAX_RECIPE_STEPS = 30;
const MAX_TEXT = 300;
export const ROLES = ['main', 'side'];
export const PANTRY_MODES = ['lazy', 'manual'];
export const VARIETIES = ['low', 'medium', 'high'];
export const MAX_MAINS = 3;

const copyStarter = (d) => ({ ...d, ingredients: [...d.ingredients], mains: [...d.mains], sides: [...d.sides] });

export function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    dishes: STARTER_DISHES.map(copyStarter),
    events: [], // {dishId, action, time, missing[]} (+ sideId on meals; mealTime, verdict on afterMeal)
    missing: [], // the shopping list: ingredients marked missing
    inStock: [], // manual pantry mode: ingredients the user says they have
    // favoritesAsked: the "choose your favourites" question was answered or skipped.
    settings: { pantryMode: 'lazy', variety: 'medium', favoritesAsked: false, portions: PORTIONS.default },
    cuisines: [...DEFAULT_CUISINES], // the delivery wheel's slices
    deliveries: [], // {time, cuisine | null, manual?: true}
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
    role: ROLES.includes(raw.role) ? raw.role : 'main',
    sides: cleanIds(raw.sides),
    favorite: raw.favorite === true,
    ...withRecipe(cleanRecipe(raw.recipe)),
  };
}

// Only a dish with a recipe of its own carries the key, so starter dishes stay as they are.
const withRecipe = (recipe) => (recipe ? { recipe } : {});

const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);

/**
 * A recipe the user wrote: {serves, items: [{text, grams?, food?, each?}], steps: [text]}.
 * Null when there is none (starter dishes show theirs from recipes.js).
 */
export function cleanRecipe(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .filter((i) => i && typeof i === 'object' && cleanText(i.text))
    .slice(0, MAX_RECIPE_ITEMS)
    .map((i) => {
      const item = { text: cleanText(i.text) };
      const grams = Number(i.grams);
      if (Number.isFinite(grams) && grams > 0) item.grams = Math.min(Math.round(grams), 100000);
      if (typeof i.food === 'string' && Object.hasOwn(FOODS, i.food)) item.food = i.food;
      const each = Number(i.each);
      if (item.grams && Number.isFinite(each) && each > 0) item.each = each;
      return item;
    });
  const steps = (Array.isArray(raw.steps) ? raw.steps : []).map(cleanText).filter(Boolean).slice(0, MAX_RECIPE_STEPS);
  if (items.length === 0 && steps.length === 0) return null;
  return { serves: Math.round(cleanNumber(raw.serves, PORTIONS.min, PORTIONS.max, PORTIONS.default)), items, steps };
}

/** Distinct non-empty ids, in order. */
function cleanIds(list) {
  return [...new Set((Array.isArray(list) ? list : []).filter((x) => x != null && String(x) !== '').map(String))];
}

function cleanEvent(raw) {
  const event = {
    dishId: String(raw.dishId),
    action: raw.action,
    time: Number(raw.time),
    missing: cleanNames(raw.missing),
  };
  if (isEaten(raw) && raw.sideId != null && String(raw.sideId) !== '') event.sideId = String(raw.sideId);
  if (raw.action === ACTIONS.AFTER_MEAL) {
    event.mealTime = Number(raw.mealTime);
    event.verdict = raw.verdict === 'up' || raw.verdict === 'down' ? raw.verdict : null;
  }
  return event;
}

function cleanDelivery(raw) {
  const delivery = { time: Number(raw.time), cuisine: cleanCuisine(raw.cuisine) || null };
  if (raw.manual === true) delivery.manual = true;
  return delivery;
}

/** Brings a blob from an older schema version up to SCHEMA_VERSION, one step at a time. Returns a copy. */
function migrate(raw) {
  const blob = { ...raw };
  if (blob.schemaVersion === 1) {
    // v2 adds the delivery wheel: start with the default cuisines and an empty log.
    blob.cuisines = [...DEFAULT_CUISINES];
    blob.deliveries = [];
    blob.schemaVersion = 2;
  }
  if (blob.schemaVersion === 2) migrateToV3(blob);
  // v4 only adds optional fields (`recipe`, `settings.portions`): normalizeState fills them in.
  if (blob.schemaVersion === 3) blob.schemaVersion = 4;
  return blob;
}

/**
 * v3 adds mains and sides. Every dish becomes a main with no sides, except
 * the starter dishes the user hasn't renamed: those get their v3 sides, and
 * the four that were "main con side" (milanesas con puré…) become the main
 * alone, with their old meals marked as having had that side. The new
 * starter dishes are added, so existing users see them too.
 */
function migrateToV3(blob) {
  const starters = new Map(STARTER_DISHES.map((d) => [d.id, d]));
  const split = new Set();
  blob.dishes = blob.dishes.map((raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    const dish = { ...raw, role: raw.role === 'side' ? 'side' : 'main', sides: Array.isArray(raw.sides) ? raw.sides : [] };
    const starter = starters.get(String(raw.id));
    if (!starter) return dish;
    const name = String(raw.name ?? '').trim();
    const old = SPLIT_IN_V3[starter.id];
    if (old && name === old.oldName) {
      split.add(starter.id);
      const { name: newName, ingredients, mains, cookMinutes, sides } = copyStarter(starter);
      return { ...dish, name: newName, ingredients, mains, cookMinutes, sides };
    }
    if (name === starter.name) dish.sides = [...starter.sides];
    return dish;
  });
  blob.events = (Array.isArray(blob.events) ? blob.events : []).map((e) =>
    e && typeof e === 'object' && split.has(String(e.dishId)) && isEaten(e) && !e.sideId
      ? { ...e, sideId: SPLIT_IN_V3[e.dishId].sideId }
      : e,
  );
  // A new starter the user already has under its name (their own "Salchichas")
  // isn't added twice: the starters' sides and old meals point at theirs instead.
  const have = new Set(blob.dishes.map((d) => String(d?.id)));
  const mine = new Map(blob.dishes.filter((d) => d && typeof d === 'object').map((d) => [normalizeName(d.name), String(d.id)]));
  const alias = new Map();
  for (const id of NEW_IN_V3) {
    if (have.has(id)) continue;
    const theirs = mine.get(normalizeName(starters.get(id).name));
    if (theirs) alias.set(id, theirs);
    else blob.dishes.push(copyStarter(starters.get(id)));
  }
  for (const d of blob.dishes) if (d && Array.isArray(d.sides)) d.sides = d.sides.map((id) => alias.get(id) ?? id);
  blob.events = blob.events.map((e) => (e && alias.has(e.sideId) ? { ...e, sideId: alias.get(e.sideId) } : e));
  blob.schemaVersion = 3;
}

/**
 * Turns anything read from storage or an imported file into a valid state,
 * migrating older schema versions. Throws if it can't be used at all.
 */
export function normalizeState(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('not-an-object');
  if (!Number.isInteger(input.schemaVersion) || input.schemaVersion < 1) throw new Error('no-schema-version');
  if (input.schemaVersion > SCHEMA_VERSION) throw new Error('newer-schema');
  if (!Array.isArray(input.dishes)) throw new Error('no-dishes');
  const raw = migrate(input);

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
  // A side never has sides of its own; a main's sides must exist and can't be itself.
  for (const dish of dishes) {
    dish.sides = dish.role === 'side' ? [] : dish.sides.filter((id) => id !== dish.id && seenIds.has(id));
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
      favoritesAsked: settings.favoritesAsked === true,
      portions: Math.round(cleanNumber(settings.portions, PORTIONS.min, PORTIONS.max, PORTIONS.default)),
    },
    cuisines: cleanCuisines(raw.cuisines),
    deliveries: (Array.isArray(raw.deliveries) ? raw.deliveries : [])
      .filter((d) => d && typeof d === 'object' && Number.isFinite(Number(d.time)))
      .map(cleanDelivery),
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

/**
 * Appends a card action to the log and applies its effect on the dish.
 * A meal (cook, cook anyway, pick) can carry the side it was eaten with:
 * the side gets the plain "cook" bump, whatever the main got.
 */
export function logCardAction(state, dishId, action, missing = [], now = Date.now(), sideId = null) {
  const dish = state.dishes.find((d) => d.id === dishId);
  if (!dish) return null;
  const event = { dishId, action, time: now, missing: cleanNames(missing) };
  const side = sideId && isEaten(event) ? state.dishes.find((d) => d.id === sideId && d.id !== dishId) : null;
  if (side) event.sideId = side.id;
  state.events.push(event);
  dish.liking = applyLiking(dish.liking, action);
  if (side) side.liking = applyLiking(side.liking, ACTIONS.COOK);
  markMissing(state, event.missing);
  return event;
}

/**
 * What a card action is about to change, so undoCardAction() can revert
 * exactly that and nothing else. Call it BEFORE logCardAction().
 */
export function planUndo(state, dishId, missing = [], sideId = null) {
  const names = cleanNames(missing);
  const side = sideId ? state.dishes.find((d) => d.id === sideId) : null;
  return {
    dishId,
    liking: state.dishes.find((d) => d.id === dishId)?.liking ?? 0,
    sideId: side?.id ?? null,
    sideLiking: side?.liking ?? 0,
    added: names.filter((n) => !state.missing.includes(n)), // newly put on the shopping list
    unstocked: names.filter((n) => state.inStock.includes(n)), // taken out of the manual pantry
  };
}

/**
 * Reverts one card action: drops its event, restores the dish's liking, and
 * undoes only this event's own shopping-list and pantry changes. Anything
 * the user changed in the pantry since then stays as it is.
 */
export function undoCardAction(state, event, plan) {
  state.events = state.events.filter((e) => e !== event);
  const dish = state.dishes.find((d) => d.id === plan.dishId);
  if (dish) dish.liking = plan.liking;
  const side = plan.sideId ? state.dishes.find((d) => d.id === plan.sideId) : null;
  if (side) side.liking = plan.sideLiking;
  state.missing = state.missing.filter((n) => !plan.added.includes(n));
  for (const n of plan.unstocked) {
    if (!state.inStock.includes(n)) state.inStock.push(n);
  }
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

// ---- Favourites -------------------------------------------------------

export const favoriteCount = (state) => state.dishes.filter((d) => d.favorite).length;

/** Stars or unstars a dish. Returns false (and changes nothing) when starring would go over FAVORITES_MAX. */
export function toggleFavorite(state, dishId) {
  const dish = state.dishes.find((d) => d.id === dishId);
  if (!dish) return false;
  if (!dish.favorite && favoriteCount(state) >= FAVORITES_MAX) return false;
  dish.favorite = !dish.favorite;
  return true;
}

/** The answer to "choose your favourites": exactly these dishes (up to FAVORITES_MAX) are favourites. */
export function setFavorites(state, ids) {
  const chosen = new Set([...ids].slice(0, FAVORITES_MAX));
  for (const dish of state.dishes) dish.favorite = chosen.has(dish.id);
  state.settings.favoritesAsked = true;
}

// ---- Mains and sides --------------------------------------------------

/**
 * Splits the ingredients marked missing between a main and its side. An
 * ingredient in both counts as the main's. Used to tell "the side is the
 * problem, change it" apart from "the main can't be made tonight".
 */
export function splitMissing(main, side, names) {
  const ofMain = new Set(main.ingredients);
  const clean = cleanNames(names);
  return {
    main: clean.filter((n) => ofMain.has(n)),
    side: side ? clean.filter((n) => !ofMain.has(n)) : [],
  };
}
