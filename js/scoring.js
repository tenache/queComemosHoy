// Pure scoring: no DOM, no storage. Everything the app knows about "which dish
// next" lives here, and every weight is a named constant in this block.

export const WEIGHTS = {
  health: 1.0, // × (health - 1) / 4
  yum: 1.5, // × (yum - 1) / 4
  effort: 1.25, // × (effort - 1) / 4: hands-on work in the kitchen, hidden from the user
  cookTime: 1.5, // × (cookLevel(cookMinutes) - 1) / 4
  missingIngredient: 0.6, // per ingredient missing right now
  notTonight: 2.0, // per left swipe, × exp(-days / notTonightFadeDays)
  notTonightFadeDays: 1.5,
  repeat: 3.0, // per time this dish was eaten, × exp(-days / repeatFadeDays)
  repeatFadeDays: 5,
  fatigue: 1.5, // per OTHER dish eaten, × shared mains share × exp(-days / fatigueFadeDays)
  fatigueFadeDays: 2,
  fatigueWindowDays: 7,
  favorite: 0.75, // one of the user's favourites (at most FAVORITES_MAX of them)
};

// How many dishes can be favourites. Few, so the boost means something.
export const FAVORITES_MAX = 5;

// How each card action moves a dish's `liking`.
export const LIKING = {
  min: -2,
  max: 2,
  cook: 0.2,
  cookAnyway: 0.5,
  pick: 0.6, // chosen from the whole list: the strongest positive signal
  missingReject: -0.08, // light: about 1/3 of a left swipe
  reject: -0.25,
};

export const YUM = { min: 1, max: 5, step: 0.25 };

// Cooking time on a 1–5 scale for the score: level 1 at `minMinutes` or less,
// level 5 at `maxMinutes` or more, logarithmic in between, so each level about
// doubles the time (20 min ≈ 2, 40 ≈ 3, 75 ≈ 4). Cards still show minutes.
export const COOK_LEVEL = { minMinutes: 10, maxMinutes: 150 };

// Effort: 1–5, how much of the cooking time someone is actually working (not
// the total time). Hidden from the user; dishes without one get `default`.
export const EFFORT = { min: 1, max: 5, default: 3 };

// The side effort that counts for a main with several sides: this quantile of
// their efforts, interpolated (0.25: the first quartile). The app doesn't
// always pick the easiest side, so not the lowest (Thomas, 2026-11-13).
export const SIDE_EFFORT_QUANTILE = 0.25;

// Every dish that can appear keeps a minimum chance: this fraction of a fair
// share (1/N). A dish swiped left in the last `swipeWindowDays` gets no minimum.
export const FLOOR = { fairShareFraction: 1 / 8, swipeWindowDays: 4 };

// Softmax temperature per "variety" setting.
export const TEMPERATURE = { low: 0.7, medium: 1.0, high: 1.5 };

// After-meal question: asked from cookMinutes + delay after a meal, and
// dropped once the meal is too old to remember.
export const AFTER_MEAL = { delayMinutes: 60, maxAgeHours: 48 };

export const ACTIONS = {
  COOK: 'cook',
  COOK_ANYWAY: 'cookAnyway',
  PICK: 'pick', // picked from the whole list; counts as cooked
  MISSING_REJECT: 'missingReject',
  REJECT: 'reject',
  AFTER_MEAL: 'afterMeal',
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeName(name) {
  return String(name ?? '').trim().toLowerCase();
}

export function isEaten(event) {
  return event.action === ACTIONS.COOK || event.action === ACTIONS.COOK_ANYWAY || event.action === ACTIONS.PICK;
}

/** The dishes a meal event was made of: its main, plus its side if it had one. */
export function mealIds(event) {
  return event.sideId ? [event.dishId, event.sideId] : [event.dishId];
}

// Days from `time` to `now`. Events dated in the future (clock changes) count as "now".
function daysSince(time, now) {
  return Math.max(0, (now - time) / DAY_MS);
}

/** Cooking time on the 1–5 scale of COOK_LEVEL. */
export function cookLevel(minutes) {
  const { minMinutes, maxMinutes } = COOK_LEVEL;
  const m = clamp(Number(minutes) || 0, minMinutes, maxMinutes);
  return 1 + (4 * Math.log(m / minMinutes)) / Math.log(maxMinutes / minMinutes);
}

/** New liking after a card action. Unknown actions leave it unchanged. */
export function applyLiking(liking, action) {
  const delta = LIKING[action] ?? 0;
  return clamp((Number(liking) || 0) + delta, LIKING.min, LIKING.max);
}

/** New yumminess after the after-meal 👍 (up = true) or 👎 (up = false). */
export function applyYum(yum, up) {
  return clamp(Number(yum) + (up ? YUM.step : -YUM.step), YUM.min, YUM.max);
}

function sharedMainsShare(dish, other) {
  const mine = (dish.mains ?? []).map(normalizeName).filter(Boolean);
  if (mine.length === 0) return 0;
  const theirs = new Set((other.mains ?? []).map(normalizeName));
  return mine.filter((m) => theirs.has(m)).length / mine.length;
}

const effortOf = (dish) => dish.effort ?? EFFORT.default;

/**
 * The q-quantile of `values` (0…1), interpolating linearly between the two
 * nearest (like Excel's QUARTILE.INC): 0.25 of [2, 3] is 2.25.
 */
export function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = q * (sorted.length - 1);
  const below = Math.floor(at);
  const above = Math.min(below + 1, sorted.length - 1);
  return sorted[below] + (sorted[above] - sorted[below]) * (at - below);
}

/**
 * Effort of the side that counts for `main`: the pinned side if it goes with
 * this main, else the SIDE_EFFORT_QUANTILE of its sides' efforts, or the only
 * one. Null for a complete dish.
 */
export function sideEffort(main, dishes, pinnedSideId = null) {
  const sides = sidesOf(main, dishes);
  const pinned = pinnedSideId && sides.find((d) => d.id === pinnedSideId);
  if (pinned) return effortOf(pinned);
  if (sides.length === 0) return null;
  return quantile(sides.map(effortOf), SIDE_EFFORT_QUANTILE);
}

/**
 * Effort of the meal a main makes. Added in the score's own units (the
 * penalty grows with effort - 1), so main + side - 1, capped at EFFORT.max:
 * a side never makes a meal look like less work than its main alone.
 */
export function mealEffort(main, dishes, pinnedSideId = null) {
  const side = main.role === 'side' ? null : sideEffort(main, dishes, pinnedSideId);
  return side === null ? effortOf(main) : Math.min(EFFORT.max, effortOf(main) + side - 1);
}

/**
 * Score of one dish.
 * ctx = {
 *   now:          ms timestamp,
 *   events:       [{dishId, action, time, missing[]}],
 *   dishes:       all dishes (to look up the main ingredients of what was eaten, and a main's sides),
 *   isMissing:    (ingredientName) => boolean,
 *   pinnedSideId: the side the user pinned, if any (it is the side that counts for a main's effort),
 *   asSide:       true when the dishes are being scored as sides: each counts alone, without sides of its own,
 * }
 */
export function scoreDish(dish, ctx) {
  const { now, events = [], dishes = [], isMissing = () => false, pinnedSideId = null, asSide = false } = ctx;
  const W = WEIGHTS;
  const effort = asSide ? effortOf(dish) : mealEffort(dish, dishes, pinnedSideId);

  let score =
    (W.health * (dish.health - 1)) / 4 +
    (W.yum * (dish.yum - 1)) / 4 +
    clamp(Number(dish.liking) || 0, LIKING.min, LIKING.max) +
    (dish.favorite ? W.favorite : 0) -
    (W.effort * (effort - 1)) / 4 -
    (W.cookTime * (cookLevel(dish.cookMinutes) - 1)) / 4;

  const missingCount = (dish.ingredients ?? []).filter((i) => isMissing(i)).length;
  score -= W.missingIngredient * missingCount;

  // A meal counts for every dish in it: puré eaten as a side yesterday is a
  // repeat for puré today, and ingredient fatigue for anything with papa.
  let byId = null;
  for (const event of events) {
    const days = daysSince(event.time, now);
    if (event.action === ACTIONS.REJECT) {
      if (event.dishId === dish.id) score -= W.notTonight * Math.exp(-days / W.notTonightFadeDays);
      continue;
    }
    if (!isEaten(event)) continue;
    const ids = mealIds(event);
    if (ids.includes(dish.id)) {
      score -= W.repeat * Math.exp(-days / W.repeatFadeDays);
    } else if (days <= W.fatigueWindowDays) {
      byId ??= new Map(dishes.map((d) => [d.id, d]));
      for (const id of ids) {
        const other = byId.get(id);
        if (other) score -= W.fatigue * sharedMainsShare(dish, other) * Math.exp(-days / W.fatigueFadeDays);
      }
    }
  }
  return score;
}

/** Ids of the dishes swiped left within FLOOR.swipeWindowDays. */
function recentlySwiped(events, now) {
  const ids = new Set();
  for (const event of events) {
    if (event.action === ACTIONS.REJECT && daysSince(event.time, now) <= FLOOR.swipeWindowDays) ids.add(event.dishId);
  }
  return ids;
}

/**
 * Probabilities over the dishes that may be shown: a softmax of the scores,
 * mixed with an even share so no dish is banned in practice.
 *
 *   p = (1 - ε) · softmax + ε · uniform(E),   ε = |E| · fraction / N
 *
 * N is the number of candidates and E the ones with no recent left swipe, so
 * every dish in E gets at least fraction / N (an eighth of a fair share).
 * Returns [{dish, score, p, floored}]. "Never show" dishes and ids in `exclude` are left out.
 */
export function probabilities(dishes, ctx, variety = 'medium', exclude = []) {
  const T = TEMPERATURE[variety] ?? TEMPERATURE.medium;
  const skip = new Set(exclude);
  const candidates = dishes.filter((d) => !d.neverShow && !skip.has(d.id));
  if (candidates.length === 0) return [];

  const fullCtx = { ...ctx, dishes: ctx.dishes ?? dishes };
  const scores = candidates.map((d) => scoreDish(d, fullCtx));
  const top = Math.max(...scores); // subtract the max so exp() can't overflow
  const weights = scores.map((s) => Math.exp((s - top) / T));
  const total = weights.reduce((a, b) => a + b, 0);

  const swiped = recentlySwiped(fullCtx.events ?? [], fullCtx.now);
  const floor = FLOOR.fairShareFraction / candidates.length;
  const floored = candidates.map((d) => !swiped.has(d.id));
  const epsilon = floor * floored.filter(Boolean).length;
  return candidates.map((dish, i) => ({
    dish,
    score: scores[i],
    p: ((1 - epsilon) * weights[i]) / total + (floored[i] ? floor : 0),
    floored: floored[i],
  }));
}

// ---- Mains and sides ------------------------------------------------------

/**
 * Dishes that can be the suggestion card: mains only. With `pinnedSideId`,
 * only the mains that go with that side ("hoy con puré, ¿con qué?").
 */
export function mainCandidates(dishes, pinnedSideId = null) {
  return dishes.filter((d) => d.role !== 'side' && (!pinnedSideId || (d.sides ?? []).includes(pinnedSideId)));
}

/** The dishes that go with `main`, in its order, skipping ids that no longer exist and "never show" ones. */
export function sidesOf(main, dishes) {
  const byId = new Map(dishes.map((d) => [d.id, d]));
  return (main?.sides ?? [])
    .map((id) => byId.get(id))
    .filter((d) => d && d.id !== main.id && !d.neverShow);
}

/**
 * Draws the side to suggest with `main`, with the same scores and variety as
 * the mains (repeat, fatigue, missing ingredients…). Null for a complete dish.
 */
export function pickSide(main, ctx, variety = 'medium', { rng = Math.random, exclude = [] } = {}) {
  const sides = sidesOf(main, ctx.dishes ?? []);
  if (sides.length === 0) return null;
  const sideCtx = { ...ctx, asSide: true };
  return pickDish(sides, sideCtx, variety, { rng, exclude }) ?? pickDish(sides, sideCtx, variety, { rng });
}

/** Samples one dish from probabilities(). The only source of randomness. */
export function pickDish(dishes, ctx, variety = 'medium', { rng = Math.random, exclude = [] } = {}) {
  const table = probabilities(dishes, ctx, variety, exclude);
  if (table.length === 0) return null;
  let r = rng();
  for (const row of table) {
    r -= row.p;
    if (r < 0) return row.dish;
  }
  return table[table.length - 1].dish; // rounding left r a hair above 0
}

/** Cooking time of a main with its side: they cook at the same time, so the longer of the two. */
export function mealMinutes(main, side = null) {
  return Math.max(main.cookMinutes, side?.cookMinutes ?? 0);
}

/**
 * The meal the after-meal question should ask about now, or null.
 * Only the most recent meal counts, each meal is asked about at most once
 * (an `afterMeal` event with its `mealTime` marks it done), and meals older
 * than AFTER_MEAL.maxAgeHours are dropped.
 */
export function afterMealDue(events, dishes, now) {
  let meal = null;
  for (const event of events) {
    if (isEaten(event) && (!meal || event.time >= meal.time)) meal = event;
  }
  if (!meal) return null;
  const dish = dishes.find((d) => d.id === meal.dishId);
  if (!dish) return null;
  const side = (meal.sideId && dishes.find((d) => d.id === meal.sideId)) || null;
  const asked = events.some((e) => e.action === ACTIONS.AFTER_MEAL && e.mealTime === meal.time);
  if (asked) return null;
  const age = now - meal.time;
  if (age < (mealMinutes(dish, side) + AFTER_MEAL.delayMinutes) * 60 * 1000) return null;
  if (age > AFTER_MEAL.maxAgeHours * 60 * 60 * 1000) return null;
  return { event: meal, dish, side };
}
