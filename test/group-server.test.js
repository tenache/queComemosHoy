// Tests for the friends' group function (netlify/group-core.mjs, #23), with an in-memory store.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LIMITS, dayOf, handle, memberIdOf, prune } from '../netlify/group-core.mjs';
import { CODE_ALPHABET, flushQueue, queuePick, queueUnpick } from '../js/group.js';

const NOW = Date.UTC(2026, 10, 14, 20, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const secret = (n) => n.toString(16).padStart(32, '0');
const ANA = secret(1);
const NICO = secret(2);
const LEO = secret(3);

/** The parts of a Netlify Blobs store that the function uses. */
function memoryStore() {
  const data = new Map();
  return {
    data,
    async set(key, value) {
      data.set(key, value);
      return { modified: true };
    },
    async delete(key) {
      data.delete(key);
    },
    async list({ prefix = '' } = {}) {
      return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, etag: '' })), directories: [] };
    },
  };
}

async function call(store, body, now = NOW, method = 'POST') {
  const init = method === 'POST' ? { method, body: typeof body === 'string' ? body : JSON.stringify(body) } : { method };
  const res = await handle(new Request('https://example.netlify.app/api/group', init), store, now);
  return { status: res.status, data: await res.json() };
}

async function groupOf(store, ...members) {
  const [first, ...rest] = members;
  const { data } = await call(store, { action: 'create', secret: first[0], name: first[1] });
  for (const [s, name] of rest) await call(store, { action: 'join', code: data.code, secret: s, name });
  return data.code;
}

const pick = (store, code, s, pickId, dishId = 'milanesas-pure', time = NOW) =>
  call(store, { action: 'pick', code, secret: s, pickId, dishId, time });

test('create: a new code, and you as its only member', async () => {
  const store = memoryStore();
  const { status, data } = await call(store, { action: 'create', secret: ANA, name: '  Ana  ' });
  assert.equal(status, 200);
  assert.equal(data.code.length, 8);
  assert.ok([...data.code].every((c) => CODE_ALPHABET.includes(c)));
  assert.equal(data.you, memberIdOf(ANA));
  assert.deepEqual(data.members, [{ id: memberIdOf(ANA), name: 'Ana' }]);
  assert.deepEqual(data.picks, []);
});

test('create: needs a name and a well-formed secret', async () => {
  const store = memoryStore();
  assert.equal((await call(store, { action: 'create', secret: ANA, name: '   ' })).data.error, 'bad-name');
  assert.equal((await call(store, { action: 'create', secret: 'short', name: 'Ana' })).data.error, 'bad-secret');
  assert.equal(store.data.size, 0);
});

test('join: with the code; an unknown or malformed code is refused', async () => {
  const store = memoryStore();
  const code = await groupOf(store, [ANA, 'Ana']);
  const joined = await call(store, { action: 'join', code, secret: NICO, name: 'Nico' });
  assert.equal(joined.status, 200);
  assert.deepEqual(joined.data.members.map((m) => m.name).sort(), ['Ana', 'Nico']);

  const unknown = code === 'ZZZZZZZZ' ? 'YYYYYYYY' : 'ZZZZZZZZ';
  assert.equal((await call(store, { action: 'join', code: unknown, secret: LEO, name: 'Leo' })).data.error, 'no-group');
  assert.equal((await call(store, { action: 'join', code: 'abcd', secret: LEO, name: 'Leo' })).data.error, 'bad-code');
});

test('join again with the same secret: a new name, still one member', async () => {
  const store = memoryStore();
  const code = await groupOf(store, [ANA, 'Ana'], [NICO, 'Nico']);
  const { data } = await call(store, { action: 'join', code, secret: NICO, name: 'Nicolás / Nico' });
  assert.deepEqual(data.members.map((m) => m.name).sort(), ['Ana', 'Nicolás / Nico']);
});

test(`join: at most ${LIMITS.members} members, but a member can still change their name`, async () => {
  const store = memoryStore();
  const members = Array.from({ length: LIMITS.members }, (_, i) => [secret(100 + i), `P${i}`]);
  const code = await groupOf(store, ...members);
  const full = await call(store, { action: 'join', code, secret: secret(999), name: 'One more' });
  assert.equal(full.status, 409);
  assert.equal(full.data.error, 'full');
  const rename = await call(store, { action: 'join', code, secret: members[5][0], name: 'Renamed' });
  assert.equal(rename.status, 200);
  assert.equal(rename.data.members.length, LIMITS.members);
});

test('pick: the group sees who picked what, and when', async () => {
  const store = memoryStore();
  const code = await groupOf(store, [ANA, 'Ana'], [NICO, 'Nico']);
  assert.equal((await pick(store, code, NICO, 'pick000001')).status, 200);
  const { data } = await call(store, { action: 'list', code, secret: ANA });
  assert.equal(data.you, memberIdOf(ANA));
  assert.deepEqual(data.picks, [{ member: memberIdOf(NICO), dishId: 'milanesas-pure', time: NOW }]);
});

test('pick: only members, only well-formed picks', async () => {
  const store = memoryStore();
  const code = await groupOf(store, [ANA, 'Ana']);
  assert.equal((await pick(store, code, NICO, 'pick000001')).data.error, 'not-member');
  assert.equal((await pick(store, code, ANA, 'p/1')).data.error, 'bad-pick');
  assert.equal((await pick(store, code, ANA, 'pick000001', 'Milanesas/con puré')).data.error, 'bad-pick');
  assert.equal((await pick(store, code, ANA, ['pick000001'])).data.error, 'bad-pick');
  assert.equal((await pick(store, code, ANA, 'pick000001', 'pizza', String(NOW))).data.error, 'bad-pick');
});

test('pick: a phone whose clock runs ahead picked now, not in the future', async () => {
  const store = memoryStore();
  const code = await groupOf(store, [ANA, 'Ana'], [NICO, 'Nico']);
  assert.equal((await pick(store, code, ANA, 'pick000001', 'pizza', NOW + 60 * 60 * 1000)).status, 200);
  const { data } = await call(store, { action: 'list', code, secret: NICO });
  assert.deepEqual(data.picks, [{ member: memberIdOf(ANA), dishId: 'pizza', time: NOW }]);
});

test('pick: the same pick sent twice (a retry) is kept once', async () => {
  const store = memoryStore();
  const code = await groupOf(store, [ANA, 'Ana']);
  await pick(store, code, ANA, 'pick000001');
  await pick(store, code, ANA, 'pick000001');
  assert.equal((await call(store, { action: 'list', code, secret: ANA })).data.picks.length, 1);
});

test('pick: older than keepDays is not kept, and old picks are deleted on the next write', async () => {
  const store = memoryStore();
  const code = await groupOf(store, [ANA, 'Ana'], [NICO, 'Nico']);
  const late = await pick(store, code, ANA, 'pick000001', 'pizza', NOW - (LIMITS.keepDays + 1) * DAY);
  assert.deepEqual(late.data, { ok: true, kept: false });

  await pick(store, code, NICO, 'pick000002', 'pizza', NOW - 2 * DAY);
  // Three days later, Nico's pick is five days old: Ana's next pick deletes it.
  const later = NOW + 3 * DAY;
  await call(store, { action: 'pick', code, secret: ANA, pickId: 'pick000003', dishId: 'paella', time: later }, later);
  const keys = [...store.data.keys()].filter((k) => k.includes('/p/'));
  assert.equal(keys.length, 1);
  assert.ok(keys[0].includes('pick000003'));
});

test(`pick: at most ${LIMITS.picksPerMember} per member within keepDays`, async () => {
  const store = memoryStore();
  const code = await groupOf(store, [ANA, 'Ana']);
  for (let i = 0; i < LIMITS.picksPerMember; i++) await pick(store, code, ANA, `pick${String(i).padStart(6, '0')}`);
  const res = await pick(store, code, ANA, 'pickextra1');
  assert.equal(res.status, 429);
  assert.equal(res.data.error, 'too-many');
});

test('unpick: takes back your own pick only', async () => {
  const store = memoryStore();
  const code = await groupOf(store, [ANA, 'Ana'], [NICO, 'Nico']);
  await pick(store, code, ANA, 'pick000001');
  await pick(store, code, NICO, 'pick000002');
  await call(store, { action: 'unpick', code, secret: NICO, pickId: 'pick000001' }); // Ana's: not Nico's to take back
  await call(store, { action: 'unpick', code, secret: ANA, pickId: 'pick000001' });
  const { data } = await call(store, { action: 'list', code, secret: ANA });
  assert.deepEqual(data.picks.map((p) => p.member), [memberIdOf(NICO)]);
});

test('leave: deletes you and your picks, and nothing of anyone else', async () => {
  const store = memoryStore();
  const code = await groupOf(store, [ANA, 'Ana'], [NICO, 'Nico']);
  await pick(store, code, ANA, 'pick000001');
  await pick(store, code, NICO, 'pick000002');
  assert.equal((await call(store, { action: 'leave', code, secret: NICO })).status, 200);
  assert.equal((await call(store, { action: 'list', code, secret: NICO })).data.error, 'not-member');
  const { data } = await call(store, { action: 'list', code, secret: ANA });
  assert.deepEqual(data.members.map((m) => m.name), ['Ana']);
  assert.deepEqual(data.picks.map((p) => p.member), [memberIdOf(ANA)]);
});

test('the last one to leave takes the group with them', async () => {
  const store = memoryStore();
  const code = await groupOf(store, [ANA, 'Ana']);
  await pick(store, code, ANA, 'pick000001');
  await call(store, { action: 'leave', code, secret: ANA });
  assert.equal(store.data.size, 0);
  assert.equal((await call(store, { action: 'join', code, secret: NICO, name: 'Nico' })).data.error, 'no-group');
});

test('secrets are never stored or sent back, only their hash', async () => {
  const store = memoryStore();
  const code = await groupOf(store, [ANA, 'Ana'], [NICO, 'Nico']);
  await pick(store, code, ANA, 'pick000001');
  const listed = await call(store, { action: 'list', code, secret: NICO });
  const everything = JSON.stringify([...store.data.keys(), ...store.data.values(), listed.data]);
  assert.ok(!everything.includes(ANA) && !everything.includes(NICO));
});

test('names: cleaned, at most 30 characters, any character (kept safe in the key)', async () => {
  const store = memoryStore();
  const { data } = await call(store, { action: 'create', secret: ANA, name: 'Ana\u0007 María / la de 💞 y más texto que sobra' });
  assert.equal(data.members[0].name, 'Ana María / la de 💞 y más text');
  // Netlify Blobs doesn't keep a % in a key as it is (found with its local server): letters, digits, -, _ and / only.
  assert.ok([...store.data.keys()].every((k) => /^[A-Za-z0-9/_-]+$/.test(k)), [...store.data.keys()].join(' '));
  const half = await call(store, { action: 'create', secret: NICO, name: 'Ni\ud83dco' }); // half an emoji
  assert.equal(half.data.members[0].name, 'Nico');
  const listed = await call(store, { action: 'list', code: data.code, secret: ANA });
  assert.equal(listed.data.members[0].name, data.members[0].name);
});

test('bad requests: not POST, too big, not JSON, unknown action', async () => {
  const store = memoryStore();
  assert.equal((await call(store, null, NOW, 'GET')).status, 405);
  assert.equal((await call(store, { action: 'create', secret: ANA, name: 'x'.repeat(LIMITS.bodyBytes) })).status, 413);
  assert.equal((await call(store, '{nope')).data.error, 'bad-json');
  assert.equal((await call(store, { action: 'delete-everything', secret: ANA })).data.error, 'bad-action');
  assert.equal((await call(store, { action: 'constructor', secret: ANA })).data.error, 'bad-action');
});

test('end to end: picks queued on one phone reach the other through the function', async () => {
  const store = memoryStore();
  const fetchImpl = (url, init) => handle(new Request(new URL(url, 'https://example.netlify.app/'), init), store, NOW);
  const code = await groupOf(store, [ANA, 'Ana'], [NICO, 'Nico']);
  const nico = { code, secret: NICO, name: 'Nico', sharing: true, queue: [] };
  queuePick(nico, 'milanesas-pure', NOW, 'pick000001');
  const undone = queuePick(nico, 'pizza', NOW, 'pick000002');
  assert.equal(await flushQueue(() => nico, () => {}, fetchImpl), 'done');
  queueUnpick(nico, undone); // "Deshacer" after it was sent
  assert.equal(await flushQueue(() => nico, () => {}, fetchImpl), 'done');
  assert.deepEqual(nico.queue, []);
  const { data } = await call(store, { action: 'list', code, secret: ANA });
  assert.deepEqual(data.picks, [{ member: memberIdOf(NICO), dishId: 'milanesas-pure', time: NOW }]);
});

/** memoryStore() with every call taking a few ms, so calls overlap like they do on Netlify. */
function slowStore() {
  const store = memoryStore();
  const later = (fn) => async (...args) => {
    await new Promise((r) => setTimeout(r, 1 + Math.random() * 4));
    return fn(...args);
  };
  return { data: store.data, set: later(store.set), delete: later(store.delete), list: later(store.list) };
}

test('rename, and the daily "seen" mark: you are never missing from the group, not even between two writes', async () => {
  const store = memoryStore();
  const code = await groupOf(store, [ANA, 'Ana'], [NICO, 'Nico']);
  const prefix = `g/${code}/m/${memberIdOf(NICO)}/`;
  const missing = [];
  const del = store.delete;
  store.delete = async (key) => {
    await del(key);
    if (![...store.data.keys()].some((k) => k.startsWith(prefix))) missing.push(key);
  };
  await call(store, { action: 'join', code, secret: NICO, name: 'Nicolás' }); // a new name
  await call(store, { action: 'list', code, secret: NICO }, NOW + DAY); // a new day
  assert.deepEqual(missing, []);
  assert.equal([...store.data.keys()].filter((k) => k.startsWith(prefix)).length, 1);
});

test(`join: the ${LIMITS.members}-member ceiling holds when many join at once`, async () => {
  const store = slowStore();
  const code = await groupOf(store, [ANA, 'Ana']);
  const joins = await Promise.all(Array.from({ length: 40 }, (_, i) => call(store, { action: 'join', code, secret: secret(500 + i), name: `P${i}` })));
  const { data } = await call(store, { action: 'list', code, secret: ANA });
  assert.ok(data.members.length <= LIMITS.members, `${data.members.length} members`);
  // Everyone told "full" is really out; everyone let in is really in.
  const ids = new Set(data.members.map((m) => m.id));
  joins.forEach((res, i) => assert.equal(ids.has(memberIdOf(secret(500 + i))), res.status === 200));
});

test(`pick: the ${LIMITS.picksPerMember}-pick cap holds when many arrive at once`, async () => {
  const store = slowStore();
  const code = await groupOf(store, [ANA, 'Ana']);
  await Promise.all(Array.from({ length: 80 }, (_, i) => pick(store, code, ANA, `pick${String(i).padStart(6, '0')}`)));
  const stored = [...store.data.keys()].filter((k) => k.includes('/p/'));
  assert.ok(stored.length <= LIMITS.picksPerMember, `${stored.length} picks`);
});

test('leave while a pick is on its way: the group never sees it, and the next clean-up deletes it', async () => {
  const store = memoryStore();
  const code = await groupOf(store, [ANA, 'Ana'], [NICO, 'Nico']);
  // The pick passed the member check just before the leave, and lands just after it.
  await call(store, { action: 'leave', code, secret: NICO });
  await store.set(`g/${code}/p/${memberIdOf(NICO)}/pick000001/pizza/${NOW}`, '1');
  const { data } = await call(store, { action: 'list', code, secret: ANA });
  assert.deepEqual(data.picks, []);
  await prune(store, NOW);
  assert.ok(![...store.data.keys()].some((k) => k.includes('/p/')));
});

test('prune: a quiet group keeps nothing older than keepDays, with no new pick needed', async () => {
  const store = memoryStore();
  const code = await groupOf(store, [ANA, 'Ana'], [NICO, 'Nico']);
  await pick(store, code, NICO, 'pick000001');
  assert.equal(await prune(store, NOW + 2 * DAY), 0);
  assert.equal(await prune(store, NOW + (LIMITS.keepDays + 1) * DAY), 1);
  assert.ok(![...store.data.keys()].some((k) => k.includes('/p/')));
});

test(`prune: someone who hasn't opened the app in ${LIMITS.inactiveDays} days leaves the group, with their picks`, async () => {
  const store = memoryStore();
  const code = await groupOf(store, [ANA, 'Ana'], [NICO, 'Nico']);
  const later = NOW + LIMITS.inactiveDays * DAY - DAY;
  await call(store, { action: 'list', code, secret: ANA }, later); // Ana opens the app; Nico never does
  assert.ok([...store.data.keys()].some((k) => k.startsWith(`g/${code}/m/${memberIdOf(ANA)}/${dayOf(later)}/`)), 'list marks Ana as seen');
  await prune(store, NOW + (LIMITS.inactiveDays + 2) * DAY);
  const { data } = await call(store, { action: 'list', code, secret: ANA }, NOW + (LIMITS.inactiveDays + 2) * DAY);
  assert.deepEqual(data.members.map((m) => m.name), ['Ana']);
  assert.equal((await call(store, { action: 'list', code, secret: NICO })).data.error, 'not-member');
});

test('bad requests: a secret or code that is not a string is refused, not a crash', async () => {
  const store = memoryStore();
  assert.equal((await call(store, { action: 'create', secret: [ANA], name: 'Ana' })).data.error, 'bad-secret');
  assert.equal((await call(store, { action: 'join', secret: ANA, code: ['ABCD2345'], name: 'Ana' })).data.error, 'bad-code');
});
