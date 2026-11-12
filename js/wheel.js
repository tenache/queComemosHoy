// The delivery wheel: how big the "cook instead" slice is, what the wheel
// lands on, and the delivery log it is computed from. Pure: no DOM, no storage.
// Every number lives in WHEEL.

export const WHEEL = {
  // Size of the "cook instead" slice at pressure 0 (min) and pressure 1 (max).
  weekday: { min: 1 / 4, max: 15 / 16 }, // Monday to Thursday
  weekend: { min: 1 / 8, max: 7 / 8 }, // Friday to Sunday
  weekendDays: [5, 6, 0], // Date.getDay(): Friday, Saturday, Sunday

  // pressure = recencyWeight · recency + frequencyWeight · frequency
  recencyWeight: 0.5,
  frequencyWeight: 0.5,
  recencyGraceDays: 1, // a delivery up to this long ago counts as "just now"
  recencyFadeDays: 7, // after that, recency = exp(-days / this)
  windowDays: 30, // frequency = deliveries in this window / windowDays

  // The spin animation. It is only for show: the result is picked first.
  spinTurns: 5,
  spinMs: 4200,
  landingMargin: 0.12, // keep this share of a slice clear at each edge, so the pointer never sits on a line
};

export const DEFAULT_CUISINES = ['China', 'Mexicana', 'Hamburguesas', 'Pizza', 'Sushi', 'Empanadas'];
export const MAX_CUISINE_LENGTH = 24;
export const COOK = 'cook';

const DAY_MS = 24 * 60 * 60 * 1000;

// ---- Size of the "cook instead" slice -------------------------------------

/**
 * Everything the slice size is made of, for a delivery log [{time}] at `now`:
 * {daysSince, count, recency, frequency, pressure, weekend, cook}.
 * `daysSince` is null when there has never been a delivery. Entries dated in
 * the future are ignored.
 */
export function wheelStats(deliveries, now) {
  let last = null;
  let count = 0;
  for (const d of deliveries) {
    const days = (now - d.time) / DAY_MS;
    if (days < 0) continue;
    if (last === null || days < last) last = days;
    if (days <= WHEEL.windowDays) count++;
  }

  const recency = last === null ? 0 : Math.exp(-Math.max(last - WHEEL.recencyGraceDays, 0) / WHEEL.recencyFadeDays);
  const frequency = Math.min(count, WHEEL.windowDays) / WHEEL.windowDays;
  const pressure = WHEEL.recencyWeight * recency + WHEEL.frequencyWeight * frequency;
  const weekend = WHEEL.weekendDays.includes(new Date(now).getDay());
  const { min, max } = weekend ? WHEEL.weekend : WHEEL.weekday;

  return { daysSince: last, count, recency, frequency, pressure, weekend, cook: min + (max - min) * pressure };
}

/** Share of the wheel (0…1) taken by the "cook instead" slice. */
export function cookShare(deliveries, now) {
  return wheelStats(deliveries, now).cook;
}

// ---- Slices and spinning --------------------------------------------------

/**
 * The wheel's slices, clockwise from the top: "cook instead" first, then the
 * cuisines sharing the rest equally.
 * Returns [{kind: 'cook' | 'cuisine', name, share, start, end}], with start
 * and end as fractions of a full turn.
 */
export function buildSlices(cuisines, deliveries, now) {
  const cook = cookShare(deliveries, now);
  const each = (1 - cook) / cuisines.length;
  const slices = [{ kind: COOK, name: null, share: cook, start: 0, end: cook }];
  cuisines.forEach((name, i) => {
    slices.push({ kind: 'cuisine', name, share: each, start: cook + i * each, end: cook + (i + 1) * each });
  });
  slices[slices.length - 1].end = 1; // close the circle exactly, whatever the rounding
  return slices;
}

/** Picks a slice index with the shares as odds. This is the spin's only randomness that matters. */
export function spin(slices, rng = Math.random) {
  let r = rng();
  for (let i = 0; i < slices.length; i++) {
    r -= slices[i].share;
    if (r < 0) return i;
  }
  return slices.length - 1; // rounding left r a hair above 0
}

const mod = (value, n) => ((value % n) + n) % n;

/**
 * The rotation (degrees, clockwise) that brings slice `index` under the
 * pointer at the top, starting from rotation `from` and turning forwards by
 * at least WHEEL.spinTurns full turns. `rng` only chooses where inside the
 * slice the pointer stops.
 */
export function landingRotation(slices, index, { from = 0, rng = Math.random, turns = WHEEL.spinTurns } = {}) {
  const { start, end } = slices[index];
  const m = WHEEL.landingMargin;
  const stop = start + (end - start) * (m + rng() * (1 - 2 * m)); // fraction of a turn, inside the slice
  // Turning the wheel by R degrees puts wheel angle -R under the pointer.
  const target = mod(-stop * 360, 360);
  return from + turns * 360 + mod(target - from, 360);
}

/** Index of the slice under the pointer when the wheel is rotated by `rotation` degrees. */
export function sliceAt(slices, rotation) {
  const at = mod(-rotation, 360) / 360;
  const index = slices.findIndex((s) => at >= s.start && at < s.end);
  return index === -1 ? slices.length - 1 : index;
}

// ---- The delivery log -----------------------------------------------------

/** Newest first. */
export function sortedDeliveries(deliveries) {
  return [...deliveries].sort((a, b) => b.time - a.time);
}

/** Deliveries inside the frequency window. */
export function recentCount(deliveries, now) {
  return wheelStats(deliveries, now).count;
}

/**
 * Makes the log say "`total` deliveries in the last 30 days", for orders made
 * outside the app. Deliveries logged one by one are kept; earlier `manual`
 * entries are replaced by as many new ones as it takes to reach `total`,
 * spread evenly over the window so they age out one by one.
 * If more than `total` were logged one by one, none are removed: delete those by hand.
 */
export function setRecentCount(deliveries, total, now) {
  const kept = deliveries.filter((d) => !d.manual);
  const needed = Math.max(0, Math.min(Math.round(total), 999) - recentCount(kept, now));
  const step = (WHEEL.windowDays * DAY_MS) / Math.max(needed, 1);
  const manual = Array.from({ length: needed }, (_, i) => ({
    time: Math.round(now - (i + 0.5) * step),
    cuisine: null,
    manual: true,
  }));
  return [...kept, ...manual];
}

// ---- Cuisines -------------------------------------------------------------

export function cleanCuisine(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_CUISINE_LENGTH);
}

const sameName = (a, b) => a.toLocaleLowerCase('es') === b.toLocaleLowerCase('es');

/** Trimmed, de-duplicated (ignoring case) list. Falls back to the defaults if nothing is left. */
export function cleanCuisines(list) {
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    const name = cleanCuisine(item);
    if (name && !out.some((x) => sameName(x, name))) out.push(name);
  }
  return out.length > 0 ? out : [...DEFAULT_CUISINES];
}

/** Returns the new list, or null if the name is empty or already there. */
export function addCuisine(cuisines, name) {
  const clean = cleanCuisine(name);
  if (!clean || cuisines.some((x) => sameName(x, clean))) return null;
  return [...cuisines, clean];
}

/** Returns the new list, or null if the new name is empty or taken by another cuisine. */
export function renameCuisine(cuisines, index, name) {
  const clean = cleanCuisine(name);
  if (!clean || cuisines.some((x, i) => i !== index && sameName(x, clean))) return null;
  return cuisines.map((x, i) => (i === index ? clean : x));
}

/** Returns the new list, or null if it would leave no cuisine. */
export function removeCuisine(cuisines, index) {
  if (cuisines.length <= 1) return null;
  return cuisines.filter((_, i) => i !== index);
}
