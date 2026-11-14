// Tests for the friends' group on the phone (js/group.js, #23): codes, names,
// the stored group, what gets shared, and the queue of picks waiting to be sent.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  FUNCTION_ORIGIN,
  GROUP,
  apiUrl,
  cleanGroup,
  cleanName,
  dropQueuedPicks,
  flushQueue,
  formatCode,
  isLocalHost,
  newPickId,
  newSecret,
  normalizeCode,
  queuePick,
  queueUnpick,
  shouldShare,
} from '../js/group.js';
import { defaultState, normalizeState } from '../js/state.js';

const NOW = Date.UTC(2026, 10, 14, 20, 0, 0);
const SECRET = 'a'.repeat(32);
const group = (fields = {}) => ({ code: 'ABCD2345', secret: SECRET, name: 'Ana', sharing: true, queue: [], ...fields });

test('normalizeCode: forgiving with case, spaces and dashes; strict with letters it never uses', () => {
  assert.equal(normalizeCode(' abcd-2345 '), 'ABCD2345');
  assert.equal(normalizeCode('ABCD 2345'), 'ABCD2345');
  assert.equal(normalizeCode('ABCD234'), null); // 7 characters
  assert.equal(normalizeCode('ABCD23450'), null);
  assert.equal(normalizeCode('OBCD2345'), null); // no O, 0, I, 1 or L in codes
  assert.equal(normalizeCode('IBCD2345'), null);
  assert.equal(normalizeCode(null), null);
  assert.equal(formatCode('ABCD2345'), 'ABCD-2345');
});

test('cleanName: trimmed, one space, no control characters, 30 characters at most', () => {
  assert.equal(cleanName('  Ana   María \n'), 'Ana María');
  assert.equal(cleanName('A\u0000na'), 'Ana');
  assert.equal(cleanName('x'.repeat(40)).length, GROUP.nameLength);
  assert.equal([...cleanName('💞'.repeat(40))].length, GROUP.nameLength); // an emoji counts as one
  assert.equal(cleanName(undefined), '');
});

test('newSecret and newPickId: the shapes the function accepts, different every time', () => {
  assert.match(newSecret(), /^[0-9a-f]{32}$/);
  assert.match(newPickId(), /^[0-9a-z]{12}$/);
  assert.notEqual(newSecret(), newSecret());
});

test('cleanGroup: keeps a valid group, drops a broken one', () => {
  assert.deepEqual(cleanGroup(group()), group());
  assert.deepEqual(cleanGroup({ ...group(), code: 'abcd-2345', sharing: undefined }), group()); // sharing defaults to on
  assert.equal(cleanGroup(group({ sharing: false })).sharing, false);
  assert.equal(cleanGroup(group({ code: 'nope' })), null);
  assert.equal(cleanGroup(group({ secret: 'short' })), null);
  assert.equal(cleanGroup(group({ name: '   ' })), null);
  assert.equal(cleanGroup(null), null);
  assert.equal(cleanGroup([]), null);
});

test('cleanGroup: keeps only well-formed calls in the queue, the newest GROUP.queueMax', () => {
  const queue = [
    { op: 'pick', pickId: 'pick000001', dishId: 'pizza', time: NOW },
    { op: 'pick', pickId: 'pick000002', dishId: 'd-mine', time: NOW }, // a dish of the user's own
    { op: 'pick', pickId: 'pick000003', dishId: 'pizza', time: 'today' },
    { op: 'unpick', pickId: 'pick000001' },
    { op: 'unpick', pickId: 'x/y' },
    { op: 'delete-everything', pickId: 'pick000004' },
    null,
  ];
  assert.deepEqual(cleanGroup(group({ queue })).queue, [queue[0], queue[3]]);
  const many = Array.from({ length: GROUP.queueMax + 5 }, (_, i) => ({ op: 'unpick', pickId: `pick${String(i).padStart(6, '0')}` }));
  const kept = cleanGroup(group({ queue: many })).queue;
  assert.equal(kept.length, GROUP.queueMax);
  assert.equal(kept[0].pickId, many[5].pickId);
});

test('state: a valid group survives a save and load, a broken one is dropped', () => {
  assert.equal(defaultState().settings.group, null);
  const state = defaultState();
  state.settings.group = group();
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))).settings.group, group());
  state.settings.group = { code: 'nope' };
  assert.equal(normalizeState(state).settings.group, null);
  const old = defaultState();
  delete old.settings.group; // saved by a copy of the app from before #23
  assert.equal(normalizeState(old).settings.group, null);
});

test('isLocalHost: the computer the app is being worked on', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]', '', 'app.localhost']) assert.equal(isLocalHost(host), true, host);
  for (const host of ['quecomemoshoy89.netlify.app', 'deploy-preview-24--quecomemoshoy89.netlify.app']) assert.equal(isLocalHost(host), false, host);
});

test('shouldShare: starter dishes only, in a group, with sharing on, never from localhost', () => {
  const host = 'quecomemoshoy89.netlify.app';
  assert.equal(shouldShare(group(), 'milanesas-pure', host), true);
  assert.equal(shouldShare(null, 'milanesas-pure', host), false);
  assert.equal(shouldShare(group({ sharing: false }), 'milanesas-pure', host), false);
  assert.equal(shouldShare(group(), 'd-lzx1k2', host), false); // a dish the user added
  assert.equal(shouldShare(group(), 'milanesas-pure', 'localhost'), false);
});

test('queueUnpick: a pick waiting behind another just leaves the queue; a sent one is taken back', () => {
  const g = group();
  queuePick(g, 'pizza', NOW, 'pick000001');
  queuePick(g, 'paella', NOW, 'pick000002');
  queueUnpick(g, 'pick000002');
  assert.deepEqual(g.queue, [{ op: 'pick', pickId: 'pick000001', dishId: 'pizza', time: NOW }]);
  g.queue = []; // sent
  queueUnpick(g, 'pick000001');
  assert.deepEqual(g.queue, [{ op: 'unpick', pickId: 'pick000001' }]);
});

test('queueUnpick: the first pick may be on its way, so it stays and the unpick goes after it', () => {
  const g = group();
  queuePick(g, 'pizza', NOW, 'pick000001');
  queueUnpick(g, 'pick000001');
  assert.deepEqual(g.queue, [
    { op: 'pick', pickId: 'pick000001', dishId: 'pizza', time: NOW },
    { op: 'unpick', pickId: 'pick000001' },
  ]);
});

test('dropQueuedPicks: sharing off sends no more picks, but still takes back the ones sent', () => {
  const g = group();
  queuePick(g, 'pizza', NOW, 'pick000001');
  queueUnpick(g, 'pick000009');
  queuePick(g, 'paella', NOW, 'pick000002');
  dropQueuedPicks(g);
  assert.deepEqual(g.queue, [{ op: 'unpick', pickId: 'pick000009' }]);
});

test('queuePick: when the queue is full, the oldest call goes', () => {
  const g = group();
  for (let i = 0; i < GROUP.queueMax + 1; i++) queuePick(g, 'pizza', NOW, `pick${String(i).padStart(6, '0')}`);
  assert.equal(g.queue.length, GROUP.queueMax);
  assert.equal(g.queue[0].pickId, 'pick000001');
});

/** A fetch that answers from a list of [status, body] (or 'offline'), and records what it was sent. */
function fakeFetch(answers) {
  const sent = [];
  const fetchImpl = async (url, init) => {
    sent.push({ url, ...JSON.parse(init.body) });
    const answer = answers.shift() ?? [200, { ok: true }];
    if (answer === 'offline') throw new TypeError('Failed to fetch');
    return new Response(JSON.stringify(answer[1]), { status: answer[0] });
  };
  return { fetchImpl, sent };
}

test('flushQueue: sends in order, with the code and secret, saving after each', async () => {
  const g = group();
  queuePick(g, 'pizza', NOW, 'pick000001');
  queueUnpick(g, 'pick000009');
  const { fetchImpl, sent } = fakeFetch([]);
  let saves = 0;
  assert.equal(await flushQueue(() => g, () => saves++, fetchImpl), 'done');
  assert.deepEqual(sent, [
    { url: './api/group', action: 'pick', code: 'ABCD2345', secret: SECRET, pickId: 'pick000001', dishId: 'pizza', time: NOW },
    { url: './api/group', action: 'unpick', code: 'ABCD2345', secret: SECRET, pickId: 'pick000009' },
  ]);
  assert.deepEqual(g.queue, []);
  assert.equal(saves, 2);
});

test('flushQueue: offline or a server error keeps the call for later', async () => {
  for (const answer of ['offline', [503, { error: 'try-again' }]]) {
    const g = group();
    queuePick(g, 'pizza', NOW, 'pick000001');
    const { fetchImpl } = fakeFetch([answer]);
    assert.equal(await flushQueue(() => g, () => {}, fetchImpl), 'later');
    assert.equal(g.queue.length, 1);
  }
});

test('flushQueue: a refused call is dropped, since sending it again gets the same answer', async () => {
  const g = group();
  queuePick(g, 'pizza', NOW, 'pick000001');
  queuePick(g, 'paella', NOW, 'pick000002');
  const { fetchImpl, sent } = fakeFetch([[429, { error: 'too-many' }]]);
  assert.equal(await flushQueue(() => g, () => {}, fetchImpl), 'done');
  assert.equal(sent.length, 2);
  assert.deepEqual(g.queue, []);
});

test("flushQueue: Netlify's rate limit (a 429 with no 'too-many') keeps the call for later", async () => {
  const g = group();
  queuePick(g, 'pizza', NOW, 'pick000001');
  const { fetchImpl } = fakeFetch([[429, 'Too Many Requests']]);
  assert.equal(await flushQueue(() => g, () => {}, fetchImpl), 'later');
  assert.equal(g.queue.length, 1);
});

test('flushQueue: Deshacer while the pick is on its way still takes it back', async () => {
  const g = group();
  queuePick(g, 'pizza', NOW, 'pick000001');
  const { fetchImpl, sent } = fakeFetch([]);
  const slow = async (url, init) => {
    if (sent.length === 0) queueUnpick(g, 'pick000001'); // tapped while the first call is out
    return fetchImpl(url, init);
  };
  assert.equal(await flushQueue(() => g, () => {}, slow), 'done');
  assert.deepEqual(sent.map((s) => s.action), ['pick', 'unpick']);
  assert.deepEqual(g.queue, []);
});

test("flushQueue: 'gone' when the server says this phone isn't in the group", async () => {
  const g = group();
  queuePick(g, 'pizza', NOW, 'pick000001');
  const { fetchImpl } = fakeFetch([[403, { error: 'not-member' }]]);
  assert.equal(await flushQueue(() => g, () => {}, fetchImpl), 'gone');
});

test('flushQueue: a group replaced while a call is out (an import, another tab) is left alone', async () => {
  let current = group();
  queuePick(current, 'pizza', NOW, 'pick000001');
  const other = group({ code: 'WXYZ6789', queue: [{ op: 'unpick', pickId: 'pick000001' }] });
  const fetchImpl = async () => {
    current = other;
    return new Response('{"ok":true}', { status: 200 });
  };
  assert.equal(await flushQueue(() => current, () => {}, fetchImpl), 'done');
  assert.deepEqual(other.queue, [{ op: 'unpick', pickId: 'pick000001' }]);
});

test('apiUrl: from GitHub Pages, the function on Netlify; on Netlify itself or localhost, its own address', () => {
  assert.equal(apiUrl({ hostname: 'tenache.github.io' }), `${FUNCTION_ORIGIN}/api/group`);
  assert.equal(FUNCTION_ORIGIN, 'https://quecomemoshoy89.netlify.app');
  for (const hostname of ['quecomemoshoy89.netlify.app', 'deploy-preview-27--quecomemoshoy89.netlify.app', 'localhost', '127.0.0.1']) {
    assert.equal(apiUrl({ hostname }), './api/group', hostname);
  }
  assert.equal(apiUrl(undefined), './api/group'); // node, in these tests
});
