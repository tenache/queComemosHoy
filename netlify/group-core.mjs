// The friends' group (#23), server side: who is in each group and which
// starter dishes they picked. Everything lives in the KEYS of a blob store,
// so one list() call reads a whole group and no two writes touch the same key:
//
//   g/<code>/m/<memberId>/<seen>/<name, base64url>   a member, last seen on day <seen> (YYYYMMDD, UTC)
//   g/<code>/p/<memberId>/<pickId>/<dishId>/<time>   a pick
//
// memberId is a hash of the phone's secret, so the group sees ids and names
// but never secrets. Picks older than LIMITS.keepDays, picks of people no
// longer in the group, and members not seen for LIMITS.inactiveDays are
// deleted by prune(), which runs every hour (functions/prune.mjs) and on each
// pick. Pure: the store comes in as an argument (getStore() on Netlify, a Map
// in the tests).

import { createHash, randomInt } from 'node:crypto';

import { CODE_ALPHABET, GROUP, cleanName } from '../js/group.js';

export const LIMITS = {
  members: 30, // a safety ceiling in case a code leaks, not a design limit (Thomas, 2026-11-14)
  keepDays: 3, // today and yesterday, plus a day for time zones
  inactiveDays: 60, // a phone that hasn't opened the app in this long (lost, or the app deleted) leaves the group
  picksPerMember: 60, // within keepDays: someone testing with sharing on
  bodyBytes: 2000,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${GROUP.codeLength}}$`);
const SECRET_RE = /^[0-9a-f]{32}$/;
const PICK_ID_RE = /^[0-9a-z]{6,24}$/;
const DISH_ID_RE = /^[a-z0-9-]{1,40}$/;
const DAY_RE = /^\d{8}$/;

export const memberIdOf = (secret) => createHash('sha256').update(secret).digest('hex').slice(0, 16);

/** The UTC day of a timestamp as YYYYMMDD: when a member was last seen. */
export const dayOf = (time) => new Date(time).toISOString().slice(0, 10).replace(/-/g, '');
const dayStart = (day) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(4, 6)) - 1, Number(day.slice(6, 8)));

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

/**
 * Parses a group's keys. A member can briefly have two keys (a new name or
 * a new day is written before the old key is deleted): `members` has one
 * entry per member, the most recently seen, and `memberKeys` all of them.
 */
function parseGroup(list) {
  const members = new Map();
  const memberKeys = [];
  const picks = [];
  for (const key of list) {
    const [, , kind, member, ...rest] = key.split('/');
    if (kind === 'm' && rest.length === 2 && DAY_RE.test(rest[0])) {
      const [seen, name] = rest;
      memberKeys.push({ id: member, key });
      if (!members.has(member) || members.get(member).seen <= seen) {
        members.set(member, { id: member, seen, name: Buffer.from(name, 'base64url').toString(), key });
      }
    } else if (kind === 'p' && rest.length === 3) {
      const [pickId, dishId, time] = rest;
      picks.push({ member, pickId, dishId, time: Number(time), key });
    }
  }
  return { members: [...members.values()], memberKeys, picks };
}

const readGroup = async (store, code) => parseGroup(await keys(store, `g/${code}/`));

/** What a member sees: names, and the recent picks of people still in the group. No keys, no secrets. */
function view(group, you, now) {
  const since = now - LIMITS.keepDays * DAY_MS;
  const ids = new Set(group.members.map((m) => m.id));
  return {
    you,
    members: group.members.map(({ id, name }) => ({ id, name })),
    picks: group.picks.filter((p) => p.time >= since && ids.has(p.member)).map(({ member, dishId, time }) => ({ member, dishId, time })),
  };
}

async function deleteAll(store, list) {
  await Promise.all(list.map((key) => store.delete(key)));
}

/**
 * Writes your member key (a new name, or today as your last-seen day), and
 * only then deletes your older keys: you are never missing from the group,
 * even for a moment.
 */
async function writeMember(store, code, group, you, name, now) {
  // base64url: only letters, digits, - and _, which every store keeps as they are (a % in a key does not survive).
  const key = `g/${code}/m/${you}/${dayOf(now)}/${Buffer.from(name).toString('base64url')}`;
  const mine = group.memberKeys.filter((m) => m.id === you).map((m) => m.key);
  if (!mine.includes(key)) await store.set(key, '1');
  await deleteAll(store, mine.filter((k) => k !== key));
  group.members = [...group.members.filter((m) => m.id !== you), { id: you, seen: dayOf(now), name, key }];
  group.memberKeys = [...group.memberKeys.filter((m) => m.id !== you), { id: you, key }];
}

/** Marks you as seen today (once a day), so prune() keeps you. */
async function touch(store, code, group, you, now) {
  const me = group.members.find((m) => m.id === you);
  if (me && me.seen !== dayOf(now)) await writeMember(store, code, group, you, me.name, now);
}

/**
 * Deletes what nobody should see any more: picks older than keepDays,
 * picks of people no longer in their group, and members not seen for
 * inactiveDays (with their picks). `codes` limits it to some groups;
 * without it, it goes through the whole store (the daily run).
 */
export async function prune(store, now = Date.now(), codes = null) {
  const byCode = new Map();
  const prefixes = codes ? codes.map((c) => `g/${c}/`) : ['g/'];
  for (const prefix of prefixes) {
    for (const key of await keys(store, prefix)) {
      const code = key.split('/')[1];
      if (!byCode.has(code)) byCode.set(code, []);
      byCode.get(code).push(key);
    }
  }
  const since = now - LIMITS.keepDays * DAY_MS;
  const gone = [];
  for (const list of byCode.values()) {
    const group = parseGroup(list);
    const inactive = new Set(group.members.filter((m) => now - dayStart(m.seen) > LIMITS.inactiveDays * DAY_MS).map((m) => m.id));
    const active = new Set(group.members.filter((m) => !inactive.has(m.id)).map((m) => m.id));
    gone.push(...group.memberKeys.filter((m) => inactive.has(m.id)).map((m) => m.key));
    gone.push(...group.picks.filter((p) => p.time < since || !active.has(p.member)).map((p) => p.key));
  }
  await deleteAll(store, gone);
  return gone.length;
}

const isText = (value, re) => typeof value === 'string' && re.test(value);

const ACTIONS = {
  async create(store, body, now) {
    const name = cleanName(body.name);
    if (!name) return fail(400, 'bad-name');
    const you = memberIdOf(body.secret);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      if ((await keys(store, `g/${code}/`)).length > 0) continue;
      const group = parseGroup([]);
      await writeMember(store, code, group, you, name, now);
      return json(200, { code, ...view(group, you, now) });
    }
    return fail(503, 'try-again');
  },

  async join(store, body, now, code) {
    const name = cleanName(body.name);
    if (!name) return fail(400, 'bad-name');
    const group = await readGroup(store, code);
    if (group.members.length === 0) return fail(404, 'no-group');
    const you = memberIdOf(body.secret);
    const wasMember = group.members.some((m) => m.id === you);
    if (!wasMember && group.members.length >= LIMITS.members) return fail(409, 'full');
    await writeMember(store, code, group, you, name, now);
    if (!wasMember) {
      // Joins at the same moment can all see room for one more: count again, and step back if over.
      const after = await readGroup(store, code);
      if (after.members.length > LIMITS.members) {
        await deleteAll(store, after.memberKeys.filter((m) => m.id === you).map((m) => m.key));
        return fail(409, 'full');
      }
    }
    return json(200, { code, ...view(group, you, now) });
  },

  async leave(store, body, now, code, group, you) {
    const mine = [...group.memberKeys.filter((m) => m.id === you), ...group.picks.filter((p) => p.member === you)];
    await deleteAll(store, mine.map((x) => x.key));
    return json(200, { ok: true });
  },

  async list(store, body, now, code, group, you) {
    await touch(store, code, group, you, now);
    return json(200, view(group, you, now));
  },

  async pick(store, body, now, code, group, you) {
    const { pickId, dishId } = body;
    if (!isText(pickId, PICK_ID_RE) || !isText(dishId, DISH_ID_RE) || !Number.isFinite(body.time)) return fail(400, 'bad-pick');
    // A phone whose clock runs ahead: its pick happened now, not in the future.
    const time = Math.round(Math.min(body.time, now));
    const since = now - LIMITS.keepDays * DAY_MS;
    await touch(store, code, group, you, now);
    await prune(store, now, [code]);
    // Too old to count: sent late by a phone that was offline. Nothing to keep.
    if (time < since) return json(200, { ok: true, kept: false });
    const mine = group.picks.filter((p) => p.member === you && p.time >= since);
    // The same pick sent twice (a retry) is the same pick: nothing new.
    if (mine.some((p) => p.pickId === pickId)) return json(200, { ok: true, kept: true });
    if (mine.length >= LIMITS.picksPerMember) return fail(429, 'too-many');
    const key = `g/${code}/p/${you}/${pickId}/${dishId}/${time}`;
    await store.set(key, '1');
    // Picks sent at the same moment can all see room for one more: count again, and step back if over.
    if ((await keys(store, `g/${code}/p/${you}/`)).length > LIMITS.picksPerMember) {
      await store.delete(key);
      return fail(429, 'too-many');
    }
    return json(200, { ok: true, kept: true });
  },

  async unpick(store, body, now, code, group, you) {
    const { pickId } = body;
    if (!isText(pickId, PICK_ID_RE)) return fail(400, 'bad-pick');
    await deleteAll(store, group.picks.filter((p) => p.member === you && p.pickId === pickId).map((p) => p.key));
    return json(200, { ok: true });
  },
};

// Actions that need you to be in the group already.
const MEMBER_ONLY = new Set(['leave', 'list', 'pick', 'unpick']);

// The app is published by GitHub Pages and calls this function from there
// (#26): only that origin gets CORS headers, so no other site's page can use it.
export const ALLOWED_ORIGINS = new Set(['https://tenache.github.io']);
const CORS = {
  'access-control-allow-methods': 'POST',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '7200',
};

/**
 * One POST with a JSON body: {action, secret, code?, ...}. Every answer is
 * JSON: the result, or {error} with a 4xx/5xx status. A browser's preflight
 * (OPTIONS) from an allowed origin gets 204.
 */
export async function handle(request, store, now = Date.now()) {
  const origin = request.headers.get('origin');
  const allowed = ALLOWED_ORIGINS.has(origin);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: allowed ? 204 : 403, headers: allowed ? { ...CORS, 'access-control-allow-origin': origin, vary: 'Origin' } : {} });
  }
  const response = await route(request, store, now);
  response.headers.set('vary', 'Origin');
  if (allowed) response.headers.set('access-control-allow-origin', origin);
  return response;
}

async function route(request, store, now) {
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
  if (!isText(body.secret, SECRET_RE)) return fail(400, 'bad-secret');
  if (body.action === 'create') return ACTIONS.create(store, body, now);

  if (!isText(body.code, CODE_RE)) return fail(400, 'bad-code');
  const { code } = body;
  if (body.action === 'join') return ACTIONS.join(store, body, now, code);

  const group = await readGroup(store, code);
  const you = memberIdOf(body.secret);
  if (MEMBER_ONLY.has(body.action) && !group.members.some((m) => m.id === you)) return fail(403, 'not-member');
  return ACTIONS[body.action](store, body, now, code, group, you);
}
