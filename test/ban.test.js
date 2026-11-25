// A "no" lasts all day; when the ideas run out, the delivery card (#53).
// Pure functions only: app.js has no UI test harness.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ACTIONS, outOfIdeas, pickCard } from '../js/scoring.js';
import { bannedToday, declineDelivery, defaultState, deliveryDeclinedToday, logCardAction, normalizeState } from '../js/state.js';

// Local times, so "today" is the phone's day whatever the test machine's zone.
const at = (y, m, d, hh, mm = 0) => new Date(y, m - 1, d, hh, mm).getTime();
const NOW = at(2026, 11, 25, 22);
const ev = (dishId, action, time, extra = {}) => ({ dishId, action, time, missing: [], ...extra });

test('bannedToday: 👈 and 🛒 → "Otra opción" from the card ban the main; a side swapped away does not', () => {
  const events = [
    ev('patitas', ACTIONS.REJECT, at(2026, 11, 25, 21)),
    ev('pato', ACTIONS.MISSING_REJECT, at(2026, 11, 25, 21, 5)),
    ev('ravioles', ACTIONS.MISSING_REJECT, at(2026, 11, 25, 21, 10), { asSide: true }),
    ev('fideos', ACTIONS.COOK, at(2026, 11, 25, 20)),
  ];
  assert.deepEqual([...bannedToday(events, NOW)].sort(), ['patitas', 'pato']);
});

test("bannedToday: yesterday's events don't count, across local midnight", () => {
  const events = [ev('a', ACTIONS.REJECT, at(2026, 11, 24, 23, 59)), ev('b', ACTIONS.REJECT, at(2026, 11, 25, 0, 1))];
  assert.deepEqual([...bannedToday(events, at(2026, 11, 25, 0, 2))], ['b']);
  assert.deepEqual([...bannedToday(events, at(2026, 11, 24, 23, 59, 30))], ['a']);
  assert.deepEqual([...bannedToday(events, at(2026, 11, 26, 0, 0))], [], 'the next day, every ban lapses');
});

test('old events without the flag count as card events', () => {
  assert.ok(bannedToday([ev('x', ACTIONS.MISSING_REJECT, NOW - 1000)], NOW).has('x'));
});

test('logCardAction stores asSide, and it survives a save/load round trip', () => {
  const state = defaultState();
  const side = logCardAction(state, 'pure', ACTIONS.MISSING_REJECT, ['papa'], NOW, null, true);
  const card = logCardAction(state, 'milanesas-pure', ACTIONS.REJECT, [], NOW);
  assert.equal(side.asSide, true);
  assert.equal('asSide' in card, false);
  const back = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(back.events[0].asSide, true);
  assert.equal('asSide' in back.events[1], false);
  assert.deepEqual([...bannedToday(back.events, NOW)], ['milanesas-pure']);
  // Junk isn't kept.
  const junk = normalizeState({ ...JSON.parse(JSON.stringify(state)), events: [{ ...ev('pure', ACTIONS.REJECT, NOW), asSide: 'yes' }] });
  assert.equal('asSide' in junk.events[0], false);
});

// Three complete-able mains with plain scores.
const main = (id, ingredients = [], extra = {}) => ({
  id,
  name: id,
  role: 'main',
  sides: [],
  ingredients,
  keyIngredients: [],
  mains: [id],
  cookMinutes: 20,
  effort: 2,
  health: 3,
  yum: 3,
  liking: 0,
  ...extra,
});
const ctxFor = (dishes, missing = []) => ({ now: NOW, events: [], dishes, isMissing: (i) => missing.includes(i) });

/** Deterministic rng (mulberry32). */
function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

test('pickCard: a banned main is never drawn, even when it is the last one left', () => {
  const dishes = [main('a'), main('b'), main('c')];
  const ctx = ctxFor(dishes);
  const rng = seededRng(7);
  for (let i = 0; i < 2000; i++) {
    const got = pickCard(dishes, ctx, 'high', { rng, exclude: ['a'], banned: new Set(['b']) });
    assert.equal(got.id, 'c');
  }
  // The card on screen may come back when nothing else is left; a banned one never.
  assert.equal(pickCard(dishes, ctx, 'medium', { rng, exclude: ['a'], banned: new Set(['b', 'c']) }).id, 'a');
  assert.equal(pickCard(dishes, ctx, 'medium', { rng, exclude: ['a'], banned: new Set(['a', 'b', 'c']) }), null);
});

test('outOfIdeas: pantry mode with every complete main banned → true, even with incomplete ones left', () => {
  const dishes = [main('a', ['huevo']), main('b', ['pan']), main('c', ['pato'])];
  const ctx = ctxFor(dishes, ['pato']);
  assert.equal(outOfIdeas(dishes, ctx, new Set(['a'])), false);
  assert.equal(outOfIdeas(dishes, ctx, new Set(['a', 'b'])), true, 'c is incomplete: it does not come after them');
});

test('outOfIdeas: pantry mode with no complete main → only when all are banned', () => {
  const dishes = [main('a', ['huevo', 'pato']), main('b', ['pan', 'pato'])];
  const ctx = ctxFor(dishes, ['pato']);
  assert.equal(outOfIdeas(dishes, ctx, new Set(['a'])), false);
  assert.equal(outOfIdeas(dishes, ctx, new Set(['a', 'b'])), true);
});

test('outOfIdeas: fallback mode (nothing available) → only when all are banned', () => {
  const dishes = [main('a', ['huevo']), main('b', ['pan'])];
  const ctx = ctxFor(dishes, ['huevo', 'pan']);
  assert.equal(outOfIdeas(dishes, ctx, new Set(['a'])), false);
  assert.equal(outOfIdeas(dishes, ctx, new Set(['a', 'b'])), true);
});

test('outOfIdeas: "never show" mains are ignored; no visible mains → false (the no-dishes screen)', () => {
  const dishes = [main('a', ['huevo']), main('h', ['huevo'], { neverShow: true })];
  const ctx = ctxFor(dishes);
  assert.equal(outOfIdeas(dishes, ctx, new Set(['a'])), true);
  assert.equal(outOfIdeas([main('h', [], { neverShow: true })], ctx, new Set()), false);
  assert.equal(outOfIdeas([], ctx, new Set()), false);
});

test('outOfIdeas: a dish that comes back (marked "lo tengo") ends it', () => {
  const dishes = [main('a', ['huevo']), main('b', ['pato'])];
  assert.equal(outOfIdeas(dishes, ctxFor(dishes, ['pato']), new Set(['a'])), true);
  assert.equal(outOfIdeas(dishes, ctxFor(dishes, []), new Set(['a'])), false, 'pato in stock: b is complete and not banned');
});

test('settings.deliveryDeclined: kept on reload the same day, ignored the next day', () => {
  const state = defaultState();
  assert.equal(deliveryDeclinedToday(state, NOW), false);
  declineDelivery(state, NOW);
  const back = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(back.settings.deliveryDeclined, state.settings.deliveryDeclined);
  assert.equal(deliveryDeclinedToday(back, at(2026, 11, 25, 23, 59)), true);
  assert.equal(deliveryDeclinedToday(back, at(2026, 11, 26, 0, 1)), false);
  for (const junk of ['2026-11-25', { day: 'hoy' }, { day: 5 }, []]) {
    assert.equal(normalizeState({ ...JSON.parse(JSON.stringify(state)), settings: { deliveryDeclined: junk } }).settings.deliveryDeclined, null);
  }
});
