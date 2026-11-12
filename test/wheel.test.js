// Tests for the delivery wheel (js/wheel.js).

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SCHEMA_VERSION, defaultState, normalizeState } from '../js/state.js';
import {
  COOK,
  DEFAULT_CUISINES,
  WHEEL,
  addCuisine,
  buildSlices,
  cleanCuisines,
  cookShare,
  landingRotation,
  recentCount,
  removeCuisine,
  renameCuisine,
  setRecentCount,
  sliceAt,
  spin,
  wheelStats,
} from '../js/wheel.js';

const DAY = 24 * 60 * 60 * 1000;
// Local time, so the weekday is the same whatever the machine's time zone.
const MONDAY = new Date(2026, 10, 16, 20, 0, 0).getTime();
const WEEK = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((name, i) => [name, MONDAY + i * DAY]));
const FRIDAY = WEEK.fri;

const daysAgo = (now, ...days) => days.map((d) => ({ time: now - d * DAY, cuisine: null }));
/** One delivery a day for the past 30 days, the last one yesterday. */
const daily = (now) => daysAgo(now, ...Array.from({ length: 30 }, (_, i) => i + 1));

function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

test('the test dates are the weekdays they claim to be', () => {
  assert.equal(new Date(MONDAY).getDay(), 1);
  assert.equal(new Date(FRIDAY).getDay(), 5);
  assert.equal(new Date(WEEK.sun).getDay(), 0);
});

test('the four corners are exact', () => {
  assert.equal(cookShare([], FRIDAY), 1 / 8, 'Friday, never ordered');
  assert.equal(cookShare(daily(MONDAY), MONDAY), 15 / 16, 'Monday, delivery every day for 30 days');
  assert.equal(cookShare([], MONDAY), 1 / 4, 'Monday, never ordered');
  assert.equal(cookShare(daily(FRIDAY), FRIDAY), 7 / 8, 'Friday, delivery every day for 30 days');
});

test('the slice grows gradually: one delivery today gives about 37% on a weekday', () => {
  const one = cookShare(daysAgo(MONDAY, 0), MONDAY);
  assert.ok(Math.abs(one - 0.37) < 0.01, `one delivery today: ${(one * 100).toFixed(1)}%`);

  // A first delivery moves the slice by a fraction of its range, not most of it.
  const range = WHEEL.weekday.max - WHEEL.weekday.min;
  assert.ok(one - WHEEL.weekday.min < range / 4);
  // Each further delivery (one a day, most recent today) adds a bit more, with no big jump,
  // up to frequencyCap deliveries. After that the slice stays at its maximum.
  let previous = cookShare([], MONDAY);
  for (let n = 1; n <= 30; n++) {
    const share = cookShare(daysAgo(MONDAY, ...Array.from({ length: n }, (_, i) => i)), MONDAY);
    if (n <= WHEEL.frequencyCap) {
      assert.ok(share > previous, `${n} deliveries > ${n - 1}`);
      assert.ok(share - previous < range / 4, `step to ${n} deliveries is ${share - previous}`);
    } else {
      assert.equal(share, 15 / 16, `${n} deliveries stay at the maximum`);
    }
    previous = share;
  }
});

test('frequency tops out at frequencyCap deliveries in 30 days', () => {
  const at = (n) => cookShare(daysAgo(MONDAY, ...Array.from({ length: n }, (_, i) => i + 1)), MONDAY);
  assert.equal(WHEEL.frequencyCap, 12);
  assert.equal(at(12), 15 / 16, '12 deliveries, the last one yesterday, already fill the maximum');
  assert.equal(at(20), at(12));
  assert.ok(at(11) < at(12));
});

test('the slice is never outside [1/8, 15/16]', () => {
  const rng = seededRng(3);
  const histories = [[], daily(MONDAY)];
  // Far more deliveries than days, several today, some in the future, some ancient.
  histories.push(daysAgo(MONDAY, ...Array.from({ length: 200 }, (_, i) => i * 0.1)));
  histories.push(daysAgo(MONDAY, -3, -0.01, 0, 0, 0, 400, 1000));
  for (let i = 0; i < 300; i++) {
    histories.push(daysAgo(MONDAY, ...Array.from({ length: Math.floor(rng() * 60) }, () => rng() * 90 - 5)));
  }
  for (const history of histories) {
    for (const now of Object.values(WEEK)) {
      const share = cookShare(history, now);
      assert.ok(share >= 1 / 8 && share <= 15 / 16, `share ${share}`);
    }
  }
});

test('factor 1: the more recent the last delivery, the bigger the slice', () => {
  const at = (days) => cookShare(daysAgo(MONDAY, days), MONDAY);
  assert.ok(at(2) > at(5) && at(5) > at(10) && at(10) > at(25), 'shrinks as the last delivery gets older');
  assert.equal(at(0), at(1), 'today and yesterday both count as "just now"');
  assert.ok(at(25) > cookShare([], MONDAY), 'any delivery in the window still counts for more than none');
  // Outside the 30-day window only recency is left, and it keeps fading.
  assert.ok(at(40) > at(80) && at(80) > cookShare([], MONDAY) - 1e-12);
  assert.ok(at(400) - cookShare([], MONDAY) < 1e-9, 'a delivery from long ago is as good as never');
});

test('factor 2: the more deliveries in the last 30 days, the bigger the slice', () => {
  // Same most recent delivery (3 days ago), more and more before it.
  const withCount = (n) => cookShare(daysAgo(MONDAY, ...Array.from({ length: n }, (_, i) => 3 + i * 0.5)), MONDAY);
  for (let n = 1; n < WHEEL.frequencyCap; n++) assert.ok(withCount(n + 1) > withCount(n), `${n + 1} deliveries > ${n}`);
  assert.equal(withCount(30), withCount(WHEEL.frequencyCap), `capped at ${WHEEL.frequencyCap} deliveries`);

  const old = daysAgo(MONDAY, 3, 31, 35, 60);
  assert.equal(recentCount(old, MONDAY), 1, 'deliveries older than 30 days are not counted');
});

test('factor 3: Friday to Sunday give a smaller slice than Monday to Thursday', () => {
  const histories = [[], daysAgo(MONDAY - 10 * DAY, 2), daysAgo(MONDAY - 10 * DAY, 1, 4, 9, 20), daily(MONDAY - 10 * DAY)];
  for (const history of histories) {
    // The same history seen from each day of one week: shift it so only the weekday differs.
    const shares = Object.fromEntries(
      Object.entries(WEEK).map(([name, now]) => [name, cookShare(history.map((d) => ({ ...d, time: d.time + (now - MONDAY) + 10 * DAY })), now)]),
    );
    for (const weekend of ['fri', 'sat', 'sun']) {
      for (const weekday of ['mon', 'tue', 'wed', 'thu']) assert.ok(shares[weekend] < shares[weekday], `${weekend} < ${weekday}`);
    }
    assert.equal(shares.mon, shares.thu);
    assert.equal(shares.fri, shares.sun);
  }
});

test('wheelStats explains the size', () => {
  const never = wheelStats([], MONDAY);
  assert.deepEqual([never.daysSince, never.count, never.pressure, never.weekend], [null, 0, 0, false]);
  const full = wheelStats(daily(FRIDAY), FRIDAY);
  assert.deepEqual([full.daysSince, full.count, full.pressure, full.weekend], [1, 30, 1, true]);
});

test('slices: sizes add up to 1, cuisines get equal shares, cook comes first', () => {
  for (const cuisines of [DEFAULT_CUISINES, ['Pizza'], ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k']]) {
    for (const history of [[], daysAgo(FRIDAY, 2, 6), daily(MONDAY)]) {
      for (const now of [MONDAY, FRIDAY]) {
        const slices = buildSlices(cuisines, history, now);
        assert.equal(slices.length, cuisines.length + 1);
        assert.equal(slices[0].kind, COOK);
        assert.equal(slices[0].share, cookShare(history, now));
        assert.ok(Math.abs(slices.reduce((a, s) => a + s.share, 0) - 1) < 1e-12, 'shares add up to 1');

        const shares = slices.slice(1).map((s) => s.share);
        for (const share of shares) assert.ok(Math.abs(share - shares[0]) < 1e-15, 'cuisines are equal');
        assert.deepEqual(slices.slice(1).map((s) => s.name), cuisines);

        // The slices tile the circle with no gaps or overlaps.
        assert.equal(slices[0].start, 0);
        assert.equal(slices.at(-1).end, 1);
        for (let i = 1; i < slices.length; i++) assert.ok(Math.abs(slices[i].start - slices[i - 1].end) < 1e-12);
        for (const s of slices) assert.ok(Math.abs(s.end - s.start - s.share) < 1e-12);
      }
    }
  }
});

test('over many spins, each slice comes up as often as its size says', () => {
  const cases = [
    buildSlices(DEFAULT_CUISINES, [], FRIDAY), // cook = 1/8
    buildSlices(DEFAULT_CUISINES, daysAgo(MONDAY, 2, 8, 15), MONDAY),
    buildSlices(['Pizza', 'Sushi'], daily(MONDAY), MONDAY), // cook = 15/16
  ];
  const rng = seededRng(42);
  const spins = 200000;
  for (const slices of cases) {
    const hits = new Array(slices.length).fill(0);
    for (let i = 0; i < spins; i++) hits[spin(slices, rng)]++;
    slices.forEach((slice, i) => {
      // 5 standard deviations of a binomial share: a correct sampler all but never fails this.
      const tolerance = 5 * Math.sqrt((slice.share * (1 - slice.share)) / spins);
      assert.ok(Math.abs(hits[i] / spins - slice.share) < tolerance, `slice ${i}: ${hits[i] / spins} vs ${slice.share}`);
    });
  }
});

test('spin follows the rng across the whole wheel', () => {
  const slices = buildSlices(DEFAULT_CUISINES, [], MONDAY); // cook = 1/4
  assert.equal(spin(slices, () => 0), 0);
  assert.equal(spin(slices, () => 0.2499), 0);
  assert.equal(spin(slices, () => 0.2501), 1);
  assert.equal(spin(slices, () => 0.999999999), slices.length - 1);
});

test('the landing angle always falls inside the chosen slice', () => {
  const rng = seededRng(9);
  const wheels = [
    buildSlices(DEFAULT_CUISINES, [], FRIDAY),
    buildSlices(DEFAULT_CUISINES, daily(MONDAY), MONDAY), // cuisine slices are 1/96 of the wheel each
    buildSlices(['Pizza'], daysAgo(MONDAY, 3), MONDAY),
    buildSlices(Array.from({ length: 40 }, (_, i) => `c${i}`), daily(MONDAY), MONDAY),
  ];
  for (const slices of wheels) {
    let from = 0;
    for (let i = 0; i < 2000; i++) {
      const index = Math.floor(rng() * slices.length);
      const rotation = landingRotation(slices, index, { from, rng });
      assert.equal(sliceAt(slices, rotation), index, `spin ${i} landed outside slice ${index}`);
      assert.ok(rotation - from >= WHEEL.spinTurns * 360, 'turns forwards by at least the full turns');
      assert.ok(rotation - from < (WHEEL.spinTurns + 1) * 360);
      from = rotation % 360; // the next spin starts where this one stopped
    }
    // The extremes of the rng stay clear of the slice edges too.
    for (const edge of [() => 0, () => 0.999999999]) {
      slices.forEach((_, index) => assert.equal(sliceAt(slices, landingRotation(slices, index, { rng: edge })), index));
    }
  }
});

test('the spin picks the result and the animation lands on it', () => {
  const slices = buildSlices(DEFAULT_CUISINES, daysAgo(MONDAY, 2), MONDAY);
  const rng = seededRng(5);
  for (let i = 0; i < 500; i++) {
    const index = spin(slices, rng);
    assert.equal(sliceAt(slices, landingRotation(slices, index, { rng })), index);
  }
});

test('typed number: manual entries reach the total, are spread over 30 days, and age out', () => {
  const log = setRecentCount([], 12, MONDAY);
  assert.equal(log.length, 12);
  assert.ok(log.every((d) => d.manual === true && d.cuisine === null));
  assert.equal(recentCount(log, MONDAY), 12);

  const ages = log.map((d) => (MONDAY - d.time) / DAY).sort((a, b) => a - b);
  assert.ok(ages[0] > 0 && ages.at(-1) < 30, 'all inside the window');
  for (let i = 1; i < ages.length; i++) assert.ok(Math.abs(ages[i] - ages[i - 1] - 30 / 12) < 1e-6, 'evenly spaced');

  // They age out one by one, and are all gone 30 days later.
  let previous = 12;
  for (let day = 1; day <= 30; day++) {
    const count = recentCount(log, MONDAY + day * DAY);
    assert.ok(count <= previous && previous - count <= 1, `day ${day}: ${count}`);
    previous = count;
  }
  assert.equal(recentCount(log, MONDAY + 15 * DAY), 6, 'half are left after 15 days');
  assert.equal(recentCount(log, MONDAY + 30 * DAY), 0);
  assert.ok(cookShare(log, MONDAY + 30 * DAY) < cookShare(log, MONDAY), 'and the slice shrinks with them');
});

test('typed number: keeps deliveries logged one by one and replaces earlier manual entries', () => {
  const logged = [
    { time: MONDAY - 2 * DAY, cuisine: 'Pizza' },
    { time: MONDAY - 40 * DAY, cuisine: 'Sushi' }, // outside the window: not counted, but kept
  ];
  const first = setRecentCount(logged, 5, MONDAY);
  assert.equal(recentCount(first, MONDAY), 5);
  assert.equal(first.filter((d) => d.manual).length, 4, '1 logged + 4 manual');
  assert.ok(logged.every((d) => first.includes(d)));

  const second = setRecentCount(first, 3, MONDAY);
  assert.equal(recentCount(second, MONDAY), 3);
  assert.equal(second.filter((d) => d.manual).length, 2, 'the earlier manual entries were replaced, not added to');

  const zero = setRecentCount(second, 0, MONDAY);
  assert.deepEqual(zero, logged, 'it never deletes a delivery logged one by one');
  assert.equal(setRecentCount([], 30, MONDAY).length, 30);
  assert.equal(cookShare(setRecentCount([], 30, MONDAY), MONDAY), 15 / 16, '30 typed deliveries reach the top corner');
});

test('cuisines: add, rename and remove, with at least one left and no duplicates', () => {
  const list = ['Pizza', 'Sushi'];
  assert.deepEqual(addCuisine(list, '  Thai  '), ['Pizza', 'Sushi', 'Thai']);
  assert.equal(addCuisine(list, 'pizza'), null, 'duplicates are refused, ignoring case');
  assert.equal(addCuisine(list, '   '), null);
  assert.deepEqual(renameCuisine(list, 1, 'Japonesa'), ['Pizza', 'Japonesa']);
  assert.deepEqual(renameCuisine(list, 0, 'PIZZA'), ['PIZZA', 'Sushi'], 'a cuisine can change its own capitals');
  assert.equal(renameCuisine(list, 1, 'Pizza'), null);
  assert.equal(renameCuisine(list, 1, ''), null);
  assert.deepEqual(removeCuisine(list, 0), ['Sushi']);
  assert.equal(removeCuisine(['Sushi'], 0), null, 'the last one cannot be removed');
  assert.deepEqual(list, ['Pizza', 'Sushi'], 'the input list is never changed');

  assert.deepEqual(cleanCuisines([' Pizza ', 'pizza', '', 7, null]), ['Pizza', '7']);
  assert.deepEqual(cleanCuisines([]), DEFAULT_CUISINES);
  assert.deepEqual(cleanCuisines('nope'), DEFAULT_CUISINES);
  assert.deepEqual(DEFAULT_CUISINES, ['China', 'Mexicana', 'Hamburguesas', 'Pizza', 'Sushi', 'Empanadas']);
});

test('state: v1 data migrates to v2 with the default cuisines and an empty log', () => {
  const v1 = JSON.parse(JSON.stringify(defaultState()));
  v1.schemaVersion = 1;
  delete v1.cuisines;
  delete v1.deliveries;
  v1.events.push({ dishId: 'lentejas', action: 'cook', time: MONDAY, missing: [] });
  const before = JSON.stringify(v1);

  const migrated = normalizeState(v1);
  assert.ok(SCHEMA_VERSION >= 2);
  assert.equal(migrated.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(migrated.cuisines, DEFAULT_CUISINES);
  assert.deepEqual(migrated.deliveries, []);
  assert.equal(migrated.events.length, 1, 'everything else is kept');
  assert.equal(migrated.dishes.length, v1.dishes.length);
  assert.equal(JSON.stringify(v1), before, 'the input is not changed');
});

test('state: the wheel data survives export and import, and bad entries are dropped', () => {
  const state = defaultState();
  state.cuisines = ['Thai', 'Pizza'];
  state.deliveries = [{ time: MONDAY, cuisine: 'Thai' }, ...setRecentCount([], 2, MONDAY)];
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))), state);

  const repaired = normalizeState({
    schemaVersion: 2,
    dishes: [],
    cuisines: [],
    deliveries: [{ time: MONDAY, cuisine: '  Pizza ' }, { time: 'x' }, null, { cuisine: 'Sushi' }, { time: MONDAY, manual: 'yes' }],
  });
  assert.deepEqual(repaired.cuisines, DEFAULT_CUISINES, 'at least one cuisine always remains');
  assert.deepEqual(repaired.deliveries, [
    { time: MONDAY, cuisine: 'Pizza' },
    { time: MONDAY, cuisine: null },
  ]);
});
