// The friends' group (#23), server side: who is in each group and which
// starter dishes they picked. Everything lives in the KEYS of a blob store,
// so one list() call reads a whole group and no two writes touch the same key:
//
//   g/<code>/m/<memberId>/<name, URI-encoded>        a member
//   g/<code>/p/<memberId>/<pickId>/<dishId>/<time>   a pick
//
// memberId is a hash of the phone's secret, so the group sees ids and names
// but never secrets. Picks older than LIMITS.keepDays are deleted on the next
// write. Pure: the store comes in as an argument (getStore() in production,
// a Map in the tests).

import { createHash, randomInt } from 'node:crypto';

import { CODE_ALPHABET, GROUP, cleanName } from '../js/group.js';

export const LIMITS = {
  members: 30, // a safety ceiling in case a code leaks, not a design limit (Thomas, 2026-11-14)
  keepDays: 3, // today and yesterday, plus a day for time zones
  picksPerMember: 60, // within keepDays: someone testing with sharing on
  bodyBytes: 2000,
  futureMinutes: 10, // a phone's clock may run a little ahead
};

const DAY_MS = 24 * 60 * 60 * 1000;
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${GROUP.codeLength}}$`);
const SECRET_RE = /^[0-9a-f]{32}$/;
const PICK_ID_RE = /^[0-9a-z]{6,24}$/;
const DISH_ID_RE = /^[a-z0-9-]{1,40}$/;

export const memberIdOf = (secret) => createHash('sha256').update(secret).digest('hex').slice(0, 16);

function newCode() {
  let code = '';
  for (let i = 0; i < GROUP.codeLength; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const fail = (status, error) => json(status, { error });

async function keys(store, prefix) {
  const { blobs } = await store.list({ prefix });
  return blobs.map((b) => b.key);
}

/** Members and picks of a group, parsed from its keys. */
async function readGroup(store, code) {
  const members = [];
  const picks = [];
  for (const key of await keys(store, `g/${code}/`)) {
    const [, , kind, member, ...rest] = key.split('/');
    if (kind === 'm' && rest.length === 1) {
      members.push({ id: member, name: decodeURIComponent(rest[0]), key });
    } else if (kind === 'p' && rest.length === 3) {
      const [pickId, dishId, time] = rest;
      picks.push({ member, pickId, dishId, time: Number(time), key });
    }
  }
  return { members, picks };
}

/** What a member sees: names and picks, with no store keys. */
function view(group, you, now) {
  const since = now - LIMITS.keepDays * DAY_MS;
  return {
    you,
    members: group.members.map(({ id, name }) => ({ id, name })),
    picks: group.picks.filter((p) => p.time >= since).map(({ member, dishId, time }) => ({ member, dishId, time })),
  };
}

async function deleteAll(store, list) {
  await Promise.all(list.map((key) => store.delete(key)));
}

async function addMember(store, code, group, you, name) {
  // A new name replaces the old one: the member's key holds it.
  await deleteAll(store, group.members.filter((m) => m.id === you).map((m) => m.key));
  const key = `g/${code}/m/${you}/${encodeURIComponent(name)}`;
  await store.set(key, '1');
  group.members = [...group.members.filter((m) => m.id !== you), { id: you, name, key }];
}

const ACTIONS = {
  async create(store, body, now) {
    const name = cleanName(body.name);
    if (!name) return fail(400, 'bad-name');
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      if ((await keys(store, `g/${code}/`)).length > 0) continue;
      const group = { members: [], picks: [] };
      await addMember(store, code, group, memberIdOf(body.secret), name);
      return json(200, { code, ...view(group, memberIdOf(body.secret), now) });
    }
    return fail(503, 'try-again');
  },

  async join(store, body, now, code) {
    const name = cleanName(body.name);
    if (!name) return fail(400, 'bad-name');
    const group = await readGroup(store, code);
    if (group.members.length === 0) return fail(404, 'no-group');
    const you = memberIdOf(body.secret);
    const isMember = group.members.some((m) => m.id === you);
    if (!isMember && group.members.length >= LIMITS.members) return fail(409, 'full');
    await addMember(store, code, group, you, name);
    return json(200, { code, ...view(group, you, now) });
  },

  async leave(store, body, now, code, group, you) {
    await deleteAll(store, [...group.members, ...group.picks].filter((x) => (x.id ?? x.member) === you).map((x) => x.key));
    return json(200, { ok: true });
  },

  async list(store, body, now, code, group, you) {
    return json(200, view(group, you, now));
  },

  async pick(store, body, now, code, group, you) {
    const { pickId, dishId } = body;
    const time = Number(body.time);
    if (!PICK_ID_RE.test(String(pickId)) || !DISH_ID_RE.test(String(dishId)) || !Number.isFinite(time)) return fail(400, 'bad-pick');
    if (time > now + LIMITS.futureMinutes * 60 * 1000) return fail(400, 'bad-time');
    const since = now - LIMITS.keepDays * DAY_MS;
    await deleteAll(store, group.picks.filter((p) => p.time < since).map((p) => p.key));
    // Too old to count: sent late by a phone that was offline. Nothing to keep.
    if (time < since) return json(200, { ok: true, kept: false });
    const mine = group.picks.filter((p) => p.member === you && p.time >= since);
    // The same pick sent twice (a retry) is the same key: nothing new.
    if (mine.some((p) => p.pickId === pickId)) return json(200, { ok: true, kept: true });
    if (mine.length >= LIMITS.picksPerMember) return fail(429, 'too-many');
    await store.set(`g/${code}/p/${you}/${pickId}/${dishId}/${Math.round(time)}`, '1');
    return json(200, { ok: true, kept: true });
  },

  async unpick(store, body, now, code, group, you) {
    const { pickId } = body;
    if (!PICK_ID_RE.test(String(pickId))) return fail(400, 'bad-pick');
    await deleteAll(store, group.picks.filter((p) => p.member === you && p.pickId === pickId).map((p) => p.key));
    return json(200, { ok: true });
  },
};

// Actions that need you to be in the group already.
const MEMBER_ONLY = new Set(['leave', 'list', 'pick', 'unpick']);

/**
 * One POST with a JSON body: {action, secret, code?, ...}. Every answer is
 * JSON: the result, or {error} with a 4xx/5xx status.
 */
export async function handle(request, store, now = Date.now()) {
  if (request.method !== 'POST') return fail(405, 'post-only');
  const text = await request.text();
  if (text.length > LIMITS.bodyBytes) return fail(413, 'too-big');
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, 'bad-json');
  }
  if (!body || typeof body !== 'object' || !Object.hasOwn(ACTIONS, body.action)) return fail(400, 'bad-action');
  if (!SECRET_RE.test(String(body.secret))) return fail(400, 'bad-secret');
  if (body.action === 'create') return ACTIONS.create(store, body, now);

  const code = String(body.code ?? '');
  if (!CODE_RE.test(code)) return fail(400, 'bad-code');
  if (body.action === 'join') return ACTIONS.join(store, body, now, code);

  const group = await readGroup(store, code);
  const you = memberIdOf(body.secret);
  if (MEMBER_ONLY.has(body.action) && !group.members.some((m) => m.id === you)) return fail(403, 'not-member');
  return ACTIONS[body.action](store, body, now, code, group, you);
}
