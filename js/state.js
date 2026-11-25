// The app's state as one versioned JSON object, plus pure helpers that change
// it. No DOM and no storage here, so `node --test` can cover it.

import { CHANGED_IN_V6, NEW_IN_V3, NEW_IN_V6, NEW_IN_V8, SIDES_IN_V8, SPLIT_IN_V3, STARTER_DISHES, starterEffort, starterKeys } from './dishes.js';
import { ACTIONS, EFFORT, FAVORITES_MAX, LIKING, MOOD_IDS, YUM, applyLiking, applyYum, clamp, isEaten, normalizeName } from './scoring.js';
import { FOODS } from './nutrition.js';
import { cleanGroup, cleanGroups } from './group.js';
import { cleanParams } from './params.js';
import { DEFAULT_CUISINES, NEW_CUISINES_IN_V6, NEW_CUISINES_IN_V8, addCuisine, cleanCuisine, cleanCuisines } from './wheel.js';

// 1: the v1 app. 2: adds the delivery wheel (`cuisines`, `deliveries`).
// 3: mains and sides (`role`, `sides`, `sideId` on meals) and favourites.
// 4: recipes the user wrote (`recipe` on a dish) and the portions setting.
// 5: `effort` on a dish (hidden from the user).
// 6: no new fields: the starter menu and the wheel change (#29, #30).
// 7: several friends' groups (#33): `settings.group` becomes `settings.groups`.
// 8: no new fields: the Mediterranean dishes, and "Mediterránea" on the wheel (#36).
// 9: `keyIngredients` on a dish (#52), the 🔑 ones.
export const SCHEMA_VERSION = 9;
export const PORTIONS = { min: 1, max: 12, default: 2 };
const MAX_RECIPE_ITEMS = 40;
const MAX_RECIPE_STEPS = 30;
const MAX_TEXT = 300;
export const ROLES = ['main', 'side'];
export const PANTRY_MODES = ['lazy', 'manual'];
export const VARIETIES = ['low', 'medium', 'high'];
export const MAX_MAINS = 3;

const copyStarter = (d) => ({ ...d, ingredients: [...d.ingredients], keyIngredients: [...d.keyIngredients], mains: [...d.mains], sides: [...d.sides] });

export function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    dishes: STARTER_DISHES.map(copyStarter),
    events: [], // {dishId, action, time, missing[]} (+ sideId on meals; mealTime, verdict on afterMeal; asSide on a side swapped away)
    missing: [], // the shopping list: ingredients marked missing
    inStock: [], // manual pantry mode: ingredients the user says they have
    // favoritesAsked: the "choose your favourites" question was answered or skipped.
    // params: this phone's tuning (params.js), {key: number}; empty = the defaults.
    // mood: the last answer to "¿Cómo está nuestro cocinero hoy?", {day: 'YYYY-MM-DD', id}; null = never asked.
    // groups: the friends' groups this phone is in (group.js, #23, #33); [] = none.
    // deliveryDeclined: the day the delivery card was swiped away (#53), {day: 'YYYY-MM-DD'}; null = not today.
    settings: { pantryMode: 'lazy', variety: 'medium', favoritesAsked: false, portions: PORTIONS.default, params: {}, mood: null, groups: [], pantryAdded: [], deliveryDeclined: null },
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
    // The 🔑 ones (#52): always some of `ingredients`, so a renamed ingredient loses its key.
    keyIngredients: cleanNames(raw.keyIngredients).filter((n) => ingredients.includes(n)),
    mains: cleanNames(raw.mains).slice(0, MAX_MAINS),
    cookMinutes: Math.round(cleanNumber(raw.cookMinutes, 0, 24 * 60, 30)),
    effort: cleanNumber(raw.effort, EFFORT.min, EFFORT.max, EFFORT.default),
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
  if (raw.asSide === true) event.asSide = true; // a side swapped away (#53): not a "no" to it as a main
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
  if (blob.schemaVersion === 4) {
    // v5 adds effort: starter dishes get theirs, the user's own get EFFORT.default from cleanDish.
    blob.dishes = blob.dishes.map((d) => {
      const effort = d && typeof d === 'object' && d.effort == null ? starterEffort(String(d.id)) : undefined;
      return effort == null ? d : { ...d, effort };
    });
    blob.schemaVersion = 5;
  }
  if (blob.schemaVersion === 5) migrateToV6(blob);
  if (blob.schemaVersion === 6) {
    // v7: the one group becomes the first of several (#33).
    const { group, ...settings } = blob.settings && typeof blob.settings === 'object' ? blob.settings : {};
    const kept = cleanGroup(group);
    blob.settings = { ...settings, groups: kept ? [kept] : [] };
    blob.schemaVersion = 7;
  }
  if (blob.schemaVersion === 7) {
    // v8: the Mediterranean dishes, and "Mediterránea" on the wheel (#36).
    addStarters(blob, NEW_IN_V8);
    giveSides(blob, SIDES_IN_V8);
    blob.cuisines = withCuisines(blob.cuisines, NEW_CUISINES_IN_V8);
    blob.schemaVersion = 8;
  }
  if (blob.schemaVersion === 8) {
    // v9: key ingredients (#52). A starter dish still under its starter name gets its 🔑,
    // those still in its ingredients; an edited dish is the user's, as in giveSides.
    blob.dishes = blob.dishes.map((raw) => {
      const starter = raw && typeof raw === 'object' ? STARTERS.get(String(raw.id)) : undefined;
      if (!starter || String(raw.name ?? '').trim() !== starter.name) return raw;
      const have = cleanNames(raw.ingredients);
      return { ...raw, keyIngredients: starterKeys(starter.id).filter((k) => have.includes(k)) };
    });
    blob.schemaVersion = 9;
  }
  return blob;
}

const STARTERS = new Map(STARTER_DISHES.map((d) => [d.id, d]));

/**
 * A dish name for telling whether two dishes are the same one: case, accents
 * and spacing don't count ("Tabule" is "Tabulé"), as on the wheel. Only the
 * migrations use it; the rest of the app keeps normalizeName.
 */
const nameKey = (name) => String(name ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');

/**
 * The user's dishes as the starters see them: `ids`, `names` (nameKey → id),
 * and `local(id)`, a starter as this user has it: under its id, or their own
 * dish with its name; undefined if neither. Only the dishes normalizeState
 * keeps count: one it drops (no id, no name, or an id already used) can't
 * stand in for a starter.
 */
function localDishes(dishes) {
  const ids = new Set();
  const names = new Map();
  for (const d of dishes) {
    if (!d || typeof d !== 'object' || d.id == null || !String(d.name ?? '').trim() || ids.has(String(d.id))) continue;
    ids.add(String(d.id));
    names.set(nameKey(d.name), String(d.id));
  }
  const local = (id) => (ids.has(id) ? id : names.get(nameKey(STARTERS.get(id).name)));
  return { ids, names, local };
}

/**
 * Adds new starter dishes to existing data (v6, v8), unless the user has a
 * dish with that id or their own dish with that name: then theirs is the one.
 * The new dishes' sides point at the user's own dish when it has the side's
 * name, and leave out a side they deleted. All the new dishes count before
 * any sides are set, so a new main can point at a new side.
 */
function addStarters(blob, newIds) {
  const { ids, names, local } = localDishes(blob.dishes);
  const added = newIds.map((id) => STARTERS.get(id)).filter((s) => !ids.has(s.id) && !names.has(nameKey(s.name)));
  for (const s of added) {
    ids.add(s.id);
    names.set(nameKey(s.name), s.id);
  }
  // A new array: blob.dishes may still be the caller's.
  blob.dishes = [...blob.dishes, ...added.map((s) => ({ ...copyStarter(s), sides: s.sides.map(local).filter(Boolean) }))];
}

/**
 * Gives older starter dishes their new sides (v8: tortilla de papas), only if
 * the dish still has its starter name and no sides: an edited dish is the
 * user's, and stays. Runs after addStarters, so the new sides are there.
 */
function giveSides(blob, starterIds) {
  const { local } = localDishes(blob.dishes);
  blob.dishes = blob.dishes.map((raw) => {
    const starter = raw && typeof raw === 'object' && starterIds.includes(String(raw.id)) ? STARTERS.get(String(raw.id)) : undefined;
    if (!starter || String(raw.name ?? '').trim() !== starter.name) return raw;
    if (Array.isArray(raw.sides) && raw.sides.length > 0) return raw;
    return { ...raw, sides: starter.sides.map(local).filter(Boolean) };
  });
}

/** The wheel's cuisines plus `names`, each only if a cuisine with that name (any case or accent) isn't there. */
function withCuisines(list, names) {
  let cuisines = cleanCuisines(list);
  for (const name of names) cuisines = addCuisine(cuisines, name) ?? cuisines;
  return cuisines;
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
    // Sides that came with v8 (tortilla's pan con tomate) are v8's to give: giveSides finds the user's own.
    if (name === starter.name) dish.sides = SIDES_IN_V8.includes(starter.id) ? [] : [...starter.sides];
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
 * v6 changes the starter menu (#30) and the wheel (#29). A dish in
 * CHANGED_IN_V6 that still has its v5 name gets its new name (unless another
 * dish has it already) and, if it has no sides, the starter's. Pulled pork is
 * added, and "Árabe" joins the wheel. As in v3, a starter the user already has
 * under its name is theirs: sides point at theirs, and nothing is added twice.
 * Names compare with nameKey (since #36: case, accents and spacing don't count).
 */
function migrateToV6(blob) {
  const { names, local } = localDishes(blob.dishes);
  blob.dishes = blob.dishes.map((raw) => {
    const oldName = raw && typeof raw === 'object' ? CHANGED_IN_V6[String(raw.id)] : undefined;
    if (!oldName || String(raw.name ?? '').trim() !== oldName) return raw;
    const starter = STARTERS.get(String(raw.id));
    const dish = { ...raw };
    const taken = names.get(nameKey(starter.name));
    if (taken === undefined || taken === String(raw.id)) dish.name = starter.name;
    if (!Array.isArray(raw.sides) || raw.sides.length === 0) dish.sides = starter.sides.map(local).filter(Boolean);
    return dish;
  });
  addStarters(blob, NEW_IN_V6);
  blob.cuisines = withCuisines(blob.cuisines, NEW_CUISINES_IN_V6);
  blob.schemaVersion = 6;
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

  const missing = cleanNames(raw.missing);
  return {
    schemaVersion: SCHEMA_VERSION,
    dishes,
    events,
    missing,
    // Never on the list and in the pantry at once (#42): the list wins, as in markMissing.
    inStock: cleanNames(raw.inStock).filter((n) => !missing.includes(n)),
    settings: {
      pantryMode: PANTRY_MODES.includes(settings.pantryMode) ? settings.pantryMode : 'lazy',
      variety: VARIETIES.includes(settings.variety) ? settings.variety : 'medium',
      favoritesAsked: settings.favoritesAsked === true,
      portions: Math.round(cleanNumber(settings.portions, PORTIONS.min, PORTIONS.max, PORTIONS.default)),
      // Optional and only read on this phone: older copies of the app just drop it, so no schema step.
      params: cleanParams(settings.params),
      mood: cleanMood(settings.mood),
      groups: cleanGroups(settings.groups),
      // Ingredients added from Despensa's search (#42), so they stay listed when not had (also optional, no schema step).
      pantryAdded: cleanNames(settings.pantryAdded),
      // The delivery card declined today (#53): optional too, and only today's counts.
      deliveryDeclined: cleanDayMark(settings.deliveryDeclined),
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

// ---- Despensa (#42) ------------------------------------------------------

/**
 * One ingredient in the pantry: 'have', 'out' (on the shopping list) or
 * 'none' (manual mode: not marked as had, not on the list either). The
 * list and the manual pantry never share a name (markMissing/markInStock).
 */
export function pantryStatus(state, name) {
  const n = normalizeName(name);
  if (state.missing.includes(n)) return 'out';
  if (state.settings.pantryMode === 'manual' && !state.inStock.includes(n)) return 'none';
  return 'have';
}

/**
 * A tap on an ingredient. Had: in lazy mode it goes on the list (there,
 * "missing" is the list), in manual mode it's just not had any more.
 * Not had, or on the list: had (and off the list).
 */
export function togglePantry(state, name) {
  const n = normalizeName(name);
  if (pantryStatus(state, n) !== 'have') markInStock(state, [n]);
  else if (state.settings.pantryMode === 'manual') state.inStock = state.inStock.filter((x) => x !== n);
  else markMissing(state, [n]);
}

/** What "Tengo todo" and "No tengo nada" change, to put it back with undoPantry(). */
const pantryBefore = (state) => ({ pantryMode: state.settings.pantryMode, inStock: [...state.inStock], bought: [] });

/** Would "Tengo todo" / "No tengo nada" change anything? */
export const hasEverything = (state) => state.settings.pantryMode === 'lazy' && state.missing.length === 0;
export const hasNothing = (state) => state.settings.pantryMode === 'manual' && state.inStock.length === 0;

/**
 * "Tengo todo": everything counts as available (lazy mode), so nothing is
 * missing: what was on the shopping list is bought. Returns the undo.
 */
export function haveEverything(state) {
  const before = { ...pantryBefore(state), bought: [...state.missing] };
  state.settings.pantryMode = 'lazy';
  markInStock(state, state.missing);
  return before;
}

/** "No tengo nada": nothing counts as available (manual mode, nothing marked). The list stays. Returns the undo. */
export function haveNothing(state) {
  const before = pantryBefore(state);
  state.settings.pantryMode = 'manual';
  state.inStock = [];
  return before;
}

/**
 * Takes back "Tengo todo" or "No tengo nada": the mode and the manual
 * pantry as they were, and what "Tengo todo" took off the shopping list
 * back on it (only that: a row marked Comprado since stays bought). A
 * name added to the list since stays on it, off the pantry.
 */
export function undoPantry(state, before) {
  state.settings.pantryMode = PANTRY_MODES.includes(before.pantryMode) ? before.pantryMode : 'lazy';
  markMissing(state, cleanNames(before.bought));
  state.inStock = cleanNames(before.inStock).filter((n) => !state.missing.includes(n));
}

/** "Compré todo": everything on the list is bought. Returns the names, for undoBoughtAll(). */
export function boughtAll(state) {
  const names = [...state.missing];
  markInStock(state, names);
  return names;
}

/** Takes back "Compré todo": those names on the list again (and out of the pantry, as they were). */
export function undoBoughtAll(state, names) {
  markMissing(state, names);
}

/** Ingredients added from Despensa's search: listed even when not had nor on the list (the list's box doesn't: paper, batteries…). */
export function addIngredients(state, names) {
  const added = state.settings.pantryAdded ?? (state.settings.pantryAdded = []);
  for (const n of cleanNames(names)) if (!added.includes(n)) added.push(n);
}

/** Every ingredient the app knows about, sorted. */
export function allIngredients(state) {
  const all = new Set([...state.missing, ...state.inStock, ...(state.settings.pantryAdded ?? [])]);
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
export function logCardAction(state, dishId, action, missing = [], now = Date.now(), sideId = null, asSide = false) {
  const dish = state.dishes.find((d) => d.id === dishId);
  if (!dish) return null;
  const event = { dishId, action, time: now, missing: cleanNames(missing) };
  if (asSide) event.asSide = true;
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

// ---- The cook's mood (#21) ----------------------------------------------

/** The local calendar day of a timestamp, as YYYY-MM-DD: an answer lasts one of these. */
export function localDay(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function cleanMood(raw) {
  if (!raw || typeof raw !== 'object' || !MOOD_IDS.includes(raw.id)) return null;
  return typeof raw.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.day) ? { day: raw.day, id: raw.id } : null;
}

// ---- A "no" lasts all day (#53) -------------------------------------------

/**
 * The mains banned for the rest of today: a 👈 or a 🛒 → "Otra opción" from
 * the card since the start of the local day. A side swapped away for missing
 * ingredients (`asSide`) isn't a "no" to it as a main.
 */
export function bannedToday(events, now) {
  const today = localDay(now);
  const ids = new Set();
  for (const e of events) {
    if ((e.action === ACTIONS.REJECT || e.action === ACTIONS.MISSING_REJECT) && !e.asSide && localDay(e.time) === today) ids.add(e.dishId);
  }
  return ids;
}

function cleanDayMark(raw) {
  return raw && typeof raw === 'object' && typeof raw.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.day) ? { day: raw.day } : null;
}

/** "Se nos acabaron las ideas" instead of the delivery card: it was swiped away today. */
export const deliveryDeclinedToday = (state, now) => state.settings.deliveryDeclined?.day === localDay(now);

export function declineDelivery(state, now) {
  state.settings.deliveryDeclined = { day: localDay(now) };
}

/** Today's answer, or null when it hasn't been asked today. */
export function moodToday(state, now) {
  const mood = state.settings.mood;
  return mood && mood.day === localDay(now) ? mood.id : null;
}

export function setMood(state, id, now) {
  if (MOOD_IDS.includes(id)) state.settings.mood = { day: localDay(now), id };
}
