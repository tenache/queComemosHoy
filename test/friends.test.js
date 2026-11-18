// Tests for friends' picks in the suggestions (#23, part 2): the boost curve,
// who counts, and what the boost does to the score.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { friendCounts, friendsByDay, friendsPicks } from '../js/group.js';
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
    Object.assign(FRIENDS, { first: 3, max: 2 }); // first above max: one friend gives first, more come down toward max
    assert.equal(friendsBoost(1), 3);
    assert.ok(friendsBoost(2) < 3 && friendsBoost(2) > friendsBoost(5) && friendsBoost(5) > 2);
    Object.assign(FRIENDS, { first: 2, max: 2 });
    assert.equal(friendsBoost(4), 2);
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
  assert.equal(friendsPicks([], NOON).size, 0);
  assert.equal(friendsPicks([null, { you: 'me' }], NOON).size, 0);
});

test('friendsPicks across groups (#33): no distinction, and a friend in two groups counts once', () => {
  // You and Sol are in both groups (the same phone: the same member id in each); Nico only in one, Leo only in the other.
  const family = { you: 'me', members: [{ id: 'me', name: 'Yo' }, { id: 'sol', name: 'Sol' }, { id: 'nico', name: 'Nico' }], picks: [
    { member: 'nico', dishId: 'pizza', time: NOON - 2 * HOUR },
    { member: 'sol', dishId: 'milanesas-pure', time: NOON - 3 * HOUR },
  ] };
  const club = { you: 'me', members: [{ id: 'me', name: 'Yo' }, { id: 'sol', name: 'Sol' }, { id: 'leo', name: 'Leo' }], picks: [
    { member: 'leo', dishId: 'pizza', time: NOON - 1 * HOUR },
    { member: 'sol', dishId: 'milanesas-pure', time: NOON - 3 * HOUR }, // the same pick, sent to both groups
    { member: 'me', dishId: 'paella', time: NOON }, // mine, in this group too
  ] };
  const got = friendsPicks([family, club], NOON);
  assert.deepEqual(got.get('pizza'), [
    { member: 'leo', name: 'Leo', today: true },
    { member: 'nico', name: 'Nico', today: true },
  ]);
  assert.deepEqual(got.get('milanesas-pure'), [{ member: 'sol', name: 'Sol', today: true }], 'Sol once');
  assert.equal(got.has('paella'), false);
  assert.deepEqual(friendCounts([family, club], NOON), new Map([['pizza', 2], ['milanesas-pure', 1]]));
  // Someone who left one group still counts through the other, where they are.
  const clubWithoutSol = { ...club, members: club.members.filter((m) => m.id !== 'sol') };
  assert.deepEqual(friendCounts([family, clubWithoutSol], NOON).get('milanesas-pure'), 1);
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

test('friendsByDay (#40): Hoy and Ayer, newest first, a friend who picked a dish both days only under Hoy', () => {
  const picks = [
    { member: 'nico', dishId: 'pizza', time: NOON - 30 * HOUR }, // yesterday, then again today: Hoy only
    { member: 'nico', dishId: 'pizza', time: NOON - 2 * HOUR },
    { member: 'lucia', dishId: 'pizza', time: NOON - 1 * HOUR },
    { member: 'leo', dishId: 'paella', time: NOON - 3 * HOUR },
    { member: 'lucia', dishId: 'paella', time: NOON - 20 * HOUR }, // yesterday evening: paella is under both days
    { member: 'leo', dishId: 'milanesas-pure', time: NOON - 15 * HOUR }, // yesterday, later than Lucía's paella
    { member: 'leo', dishId: 'ravioles-tuco', time: NOON - 40 * HOUR }, // the day before yesterday
    { member: 'me', dishId: 'ravioles-tuco', time: NOON }, // mine
    { member: 'nico', dishId: 'd-mine', time: NOON }, // not a starter dish
  ];
  assert.deepEqual(friendsByDay(list(picks), NOON), {
    today: [
      { dishId: 'pizza', names: ['Lucia', 'Nico'] },
      { dishId: 'paella', names: ['Leo'] },
    ],
    yesterday: [
      { dishId: 'milanesas-pure', names: ['Leo'] },
      { dishId: 'paella', names: ['Lucia'] },
    ],
  });
});

test('friendsByDay: empty without lists, and a friend in two groups once (#33)', () => {
  assert.deepEqual(friendsByDay(null, NOON), { today: [], yesterday: [] });
  assert.deepEqual(friendsByDay([], NOON), { today: [], yesterday: [] });
  const sol = { member: 'sol', dishId: 'pizza', time: NOON - HOUR };
  const a = { you: 'me', members: [{ id: 'me', name: 'Yo' }, { id: 'sol', name: 'Sol' }], picks: [sol] };
  const b = { you: 'me', members: [{ id: 'me', name: 'Yo' }, { id: 'sol', name: 'Sol' }], picks: [sol] };
  assert.deepEqual(friendsByDay([a, b], NOON), { today: [{ dishId: 'pizza', names: ['Sol'] }], yesterday: [] });
});

test('friendsByDay agrees with friendsPicks: the same friends for each dish', () => {
  const picks = [
    { member: 'nico', dishId: 'pizza', time: NOON - 30 * HOUR },
    { member: 'lucia', dishId: 'pizza', time: NOON - 1 * HOUR },
    { member: 'leo', dishId: 'paella', time: NOON - 20 * HOUR },
  ];
  const byDay = friendsByDay(list(picks), NOON);
  for (const [dishId, who] of friendsPicks(list(picks), NOON)) {
    const today = byDay.today.find((d) => d.dishId === dishId)?.names ?? [];
    const yesterday = byDay.yesterday.find((d) => d.dishId === dishId)?.names ?? [];
    assert.deepEqual(today, who.filter((w) => w.today).map((w) => w.name));
    assert.deepEqual(yesterday, who.filter((w) => !w.today).map((w) => w.name));
  }
});
