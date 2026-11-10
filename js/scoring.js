// Pure scoring: no DOM, no storage. Everything the app knows about "which dish
// next" lives here, and every weight is a named constant in this block.

export const WEIGHTS = {
  health: 1.0, // × (health - 1) / 4
  yum: 1.5, // × (yum - 1) / 4
  cookTimePerHour: 0.8, // × cookMinutes / 60
  missingIngredient: 0.6, // per ingredient missing right now
  notTonight: 2.0, // per left swipe, × exp(-days / notTonightFadeDays)
  notTonightFadeDays: 1.5,
  repeat: 3.0, // per time this dish was eaten, × exp(-days / repeatFadeDays)
  repeatFadeDays: 5,
  fatigue: 1.5, // per OTHER dish eaten, × shared mains share × exp(-days / fatigueFadeDays)
  fatigueFadeDays: 2,
  fatigueWindowDays: 7,
};

// How each card action moves a dish's `liking`.
export const LIKING = {
  min: -2,
  max: 2,
  cook: 0.2,
  cookAnyway: 0.5, // strongest positive signal
  missingReject: -0.08, // light: about 1/3 of a left swipe
  reject: -0.25,
};

export const YUM = { min: 1, max: 5, step: 0.25 };

// Softmax temperature per "variety" setting.
export const TEMPERATURE = { low: 0.7, medium: 1.0, high: 1.5 };

// After-meal question: asked from cookMinutes + delay after a meal, and
// dropped once the meal is too old to remember.
export const AFTER_MEAL = { delayMinutes: 60, maxAgeHours: 48 };

export const ACTIONS = {
  COOK: 'cook',
  COOK_ANYWAY: 'cookAnyway',
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
  return event.action === ACTIONS.COOK || event.action === ACTIONS.COOK_ANYWAY;
}

// Days from `time` to `now`. Events dated in the future (clock changes) count as "now".
function daysSince(time, now) {
  return Math.max(0, (now - time) / DAY_MS);
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

/**
 * Score of one dish.
 * ctx = {
 *   now:       ms timestamp,
 *   events:    [{dishId, action, time, missing[]}],
 *   dishes:    all dishes (to look up the main ingredients of what was eaten),
 *   isMissing: (ingredientName) => boolean,
 * }
 */
export function scoreDish(dish, ctx) {
  const { now, events = [], dishes = [], isMissing = () => false } = ctx;
  const W = WEIGHTS;

  let score =
    (W.health * (dish.health - 1)) / 4 +
    (W.yum * (dish.yum - 1)) / 4 +
    clamp(Number(dish.liking) || 0, LIKING.min, LIKING.max) -
    (W.cookTimePerHour * dish.cookMinutes) / 60;

  const missingCount = (dish.ingredients ?? []).filter((i) => isMissing(i)).length;
  score -= W.missingIngredient * missingCount;

  let byId = null;
  for (const event of events) {
    const days = daysSince(event.time, now);
    if (event.dishId === dish.id) {
      if (event.action === ACTIONS.REJECT) {
        score -= W.notTonight * Math.exp(-days / W.notTonightFadeDays);
      } else if (isEaten(event)) {
        score -= W.repeat * Math.exp(-days / W.repeatFadeDays);
      }
    } else if (isEaten(event) && days <= W.fatigueWindowDays) {
      byId ??= new Map(dishes.map((d) => [d.id, d]));
      const other = byId.get(event.dishId);
      if (other) {
        score -= W.fatigue * sharedMainsShare(dish, other) * Math.exp(-days / W.fatigueFadeDays);
      }
    }
  }
  return score;
}

/**
 * Softmax probabilities over the dishes that may be shown.
 * Returns [{dish, score, p}]. "Never show" dishes and ids in `exclude` are left out.
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
  return candidates.map((dish, i) => ({ dish, score: scores[i], p: weights[i] / total }));
}

/** Samples one dish with p ∝ exp(score / T). The only source of randomness. */
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
  const asked = events.some((e) => e.action === ACTIONS.AFTER_MEAL && e.mealTime === meal.time);
  if (asked) return null;
  const age = now - meal.time;
  if (age < (dish.cookMinutes + AFTER_MEAL.delayMinutes) * 60 * 1000) return null;
  if (age > AFTER_MEAL.maxAgeHours * 60 * 60 * 1000) return null;
  return { event: meal, dish };
}
