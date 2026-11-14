// Tests for friends' picks in the suggestions (#23, part 2): the boost curve,
// who counts, and what the boost does to the score.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { friendCounts, friendsPicks } from '../js/group.js';
import { applyParams, paramValue } from '../js/params.js';
import { FRIENDS, friendsBoost, probabilities, scoreDish } from '../js/scoring.js';
import { defaultState } from '../js/state.js';

const NOON = new Date(2026, 10, 14, 12, 0, 0).getTime(); // local time: "today" and "yesterday" are local days
const HOUR = 60 * 60 * 1000;
const round2 = (x) => Math.round(x * 100) / 100;

test('friendsBoost: 0.75 for one friend, then the logistic curve toward 2 (r = 1)', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => round2(friendsBoost(n))), [0.75, 1.24, 1.63, 1.85, 1.94]);
  assert.ok(friendsBoost(30) < FRIENDS.max && friendsBoost(30) > 1.99);
  assert.equal(friendsBoost(0), 0);
  assert.equal(friendsBoost(undefined), 0);
});

test('friendsBoost: odd tuning stays sane (no NaN, never negative)', () => {
  const saved = { ...FRIENDS };
  try {
    Object.assign(FRIENDS, { first: 3, max: 2 }); // first above max: flat at max
    assert.equal(friendsBoost(1), 2);
    assert.equal(friendsBoost(5), 2);
    Object.assign(FRIENDS, { first: 0.75, max: 0 });
    assert.equal(friendsBoost(1), 0);
    Object.assign(FRIENDS, { first: 0, max: 2 });
    assert.equal(friendsBoost(3), 0);
  } finally {
    Object.assign(FRIENDS, saved);
  }
});

test('FRIENDS can be tuned like any other number (params.json, Ajustes finos)', () => {
  try {
    applyParams({ 'FRIENDS.rate': 1.5 }, { 'FRIENDS.first': 0.5 });
    assert.equal(paramValue('FRIENDS.rate'), 1.5);
    assert.equal(paramValue('FRIENDS.first'), 0.5);
    assert.equal(round2(friendsBoost(1)), 0.5);
  } finally {
    applyParams();
  }
  assert.deepEqual(FRIENDS, { first: 0.75, max: 2, rate: 1 });
});

/** A `list` answer: you are 'me'. */
const list = (picks, members = ['me', 'nico', 'lucia', 'leo']) => ({
  you: 'me',
  members: members.map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1) })),
  picks,
});

test('friendsPicks: friends who picked each dish today or yesterday, newest first, once each', () => {
  const picks = [
    { member: 'nico', dishId: 'milanesas-pure', time: NOON - 30 * HOUR }, // yesterday, early morning
    { member: 'lucia', dishId: 'milanesas-pure', time: NOON - 1 * HOUR },
    { member: 'nico', dishId: 'milanesas-pure', time: NOON - 2 * HOUR }, // Nico again: counts once
    { member: 'leo', dishId: 'pizza', time: NOON - 40 * HOUR }, // the day before yesterday
    { member: 'me', dishId: 'pizza', time: NOON }, // mine
    { member: 'gone', dishId: 'pizza', time: NOON }, // not in the group any more
    { member: 'nico', dishId: 'd-mine', time: NOON }, // not a starter dish
  ];
  const got = friendsPicks(list(picks), NOON);
  assert.deepEqual([...got.keys()], ['milanesas-pure']);
  assert.deepEqual(got.get('milanesas-pure'), [
    { member: 'lucia', name: 'Lucia', today: true },
    { member: 'nico', name: 'Nico', today: true },
  ]);
  const early = friendsPicks(list([{ member: 'nico', dishId: 'pizza', time: NOON - 30 * HOUR }]), NOON);
  assert.deepEqual(early.get('pizza'), [{ member: 'nico', name: 'Nico', today: false }]);
  assert.deepEqual(friendCounts(list(picks), NOON), new Map([['milanesas-pure', 2]]));
});

test('friendsPicks: nothing to show without a list', () => {
  assert.equal(friendsPicks(null, NOON).size, 0);
  assert.equal(friendsPicks({ you: 'me' }, NOON).size, 0);
});

test('scoreDish: friends lift a main by friendsBoost(n), and leave sides alone', () => {
  const state = defaultState();
  const dish = state.dishes.find((d) => d.id === 'milanesas-pure');
  const ctx = { now: NOON, events: [], dishes: state.dishes };
  const friends = new Map([['milanesas-pure', 2]]);
  assert.equal(round2(scoreDish(dish, { ...ctx, friends }) - scoreDish(dish, ctx)), 1.24);
  assert.equal(scoreDish(dish, { ...ctx, friends: new Map() }), scoreDish(dish, ctx));
  const pure = state.dishes.find((d) => d.id === 'pure');
  const asPure = new Map([['pure', 3]]);
  assert.equal(scoreDish(pure, { ...ctx, asSide: true, friends: asPure }), scoreDish(pure, { ...ctx, asSide: true }));
});

test('probabilities: a dish three friends picked comes up about five times as often as before', () => {
  const state = defaultState();
  const ctx = { now: NOON, events: [], dishes: state.dishes };
  const p = (friends) => probabilities(state.dishes, { ...ctx, friends }).find((r) => r.dish.id === 'lentejas').p;
  const ratio = p(new Map([['lentejas', 3]])) / p(null);
  assert.ok(ratio > 3.5 && ratio < 5.1, `×${ratio.toFixed(2)}`); // e^1.63 ≈ 5.1, less once the others share
});
