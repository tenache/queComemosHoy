// Friends' picks (#23), on the phone: the group this phone is in
// (`settings.group`), the picks waiting to be sent, and the calls to the
// group function (netlify/functions/group.mjs, at /api/group). Pure except
// for the calls, which take `fetch` as an argument so the tests can fake it.
// The function imports cleanName and the code rules from here, so both sides
// agree on them.

import { STARTER_DISHES } from './dishes.js';

export const GROUP = {
  nameLength: 30,
  codeLength: 8,
  queueMax: 100, // picks waiting to be sent: the oldest go first when it's full
};
// No 0/O or 1/I/L, so a code read aloud or copied by hand can't be mistyped.
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const API_URL = './api/group';

// Only starter dishes are shared: every phone has them, under the same id.
const STARTER_IDS = new Set(STARTER_DISHES.map((d) => d.id));
const SECRET_RE = /^[0-9a-f]{32}$/;
const PICK_ID_RE = /^[0-9a-z]{6,24}$/;

/**
 * Trimmed, one space between words, no control characters and no broken
 * emoji halves, at most GROUP.nameLength characters (an emoji counts as one).
 */
export function cleanName(raw) {
  const text = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]|[\ud800-\udfff]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return [...text].slice(0, GROUP.nameLength).join('').trim();
}

/** A code as typed or pasted (" abcd-2345 ") → "ABCD2345", or null if it can't be one. */
export function normalizeCode(text) {
  const code = String(text ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');
  return code.length === GROUP.codeLength && [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

/** "ABCD2345" → "ABCD-2345", easier to read and dictate. */
export const formatCode = (code) => `${code.slice(0, 4)}-${code.slice(4)}`;

const randomBytes = (n, crypto) => crypto.getRandomValues(new Uint8Array(n));

/** This phone's secret in the group: 32 random hex characters. The server only ever keeps a hash of it. */
export function newSecret(crypto = globalThis.crypto) {
  return [...randomBytes(16, crypto)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** An id for one pick, so it can be taken back with "Deshacer". */
export function newPickId(crypto = globalThis.crypto) {
  return [...randomBytes(12, crypto)].map((b) => (b % 36).toString(36)).join('');
}

function cleanOp(raw) {
  if (!raw || typeof raw !== 'object' || !PICK_ID_RE.test(String(raw.pickId))) return null;
  if (raw.op === 'unpick') return { op: 'unpick', pickId: raw.pickId };
  const time = Number(raw.time);
  if (raw.op === 'pick' && STARTER_IDS.has(raw.dishId) && Number.isFinite(time)) {
    return { op: 'pick', pickId: raw.pickId, dishId: raw.dishId, time };
  }
  return null;
}

/**
 * `settings.group`: {code, secret, name, sharing, queue}, or null when this
 * phone isn't in a group. `sharing` false pauses sending (for testing);
 * `queue` holds the calls not sent yet, in order.
 */
export function cleanGroup(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const code = normalizeCode(raw.code);
  const secret = SECRET_RE.test(String(raw.secret)) ? raw.secret : null;
  const name = cleanName(raw.name);
  if (!code || !secret || !name) return null;
  const queue = (Array.isArray(raw.queue) ? raw.queue : []).map(cleanOp).filter(Boolean).slice(-GROUP.queueMax);
  return { code, secret, name, sharing: raw.sharing !== false, queue };
}

/** The address bar says this copy runs on the computer it's being worked on: it never sends picks. */
export const isLocalHost = (hostname) =>
  hostname === '' || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');

/** Should a meal of this dish be sent to the group? */
export function shouldShare(group, dishId, hostname) {
  return Boolean(group && group.sharing && STARTER_IDS.has(dishId) && !isLocalHost(hostname));
}

/** Queues a pick. Returns its id, for queueUnpick(). */
export function queuePick(group, dishId, time, pickId = newPickId()) {
  group.queue.push({ op: 'pick', pickId, dishId, time });
  if (group.queue.length > GROUP.queueMax) group.queue.splice(0, group.queue.length - GROUP.queueMax);
  return pickId;
}

/**
 * Takes a pick back: from the queue if it wasn't sent yet, else from the
 * server. The first call in the queue may be on its way right now, so a pick
 * there stays, and the unpick goes after it.
 */
export function queueUnpick(group, pickId) {
  const waiting = group.queue.findIndex((o) => o.op === 'pick' && o.pickId === pickId);
  if (waiting > 0) group.queue.splice(waiting, 1);
  else group.queue.push({ op: 'unpick', pickId });
}

/**
 * Who in the group picked each dish today or yesterday, by this phone's
 * calendar, from a `list` answer {you, members, picks}: Map dishId →
 * [{member, name, today}], newest first, one entry per friend. Your own
 * picks, picks of someone no longer in the group and dishes that aren't
 * starters are left out.
 */
export function friendsPicks(list, now) {
  const out = new Map();
  if (!list || !Array.isArray(list.members) || !Array.isArray(list.picks)) return out;
  const names = new Map(list.members.map((m) => [m.id, m.name]));
  const d = new Date(now);
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const yesterday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1).getTime();
  for (const pick of [...list.picks].sort((a, b) => b.time - a.time)) {
    if (pick.member === list.you || !names.has(pick.member) || !STARTER_IDS.has(pick.dishId) || !(pick.time >= yesterday)) continue;
    const who = out.get(pick.dishId) ?? [];
    if (who.some((w) => w.member === pick.member)) continue;
    who.push({ member: pick.member, name: names.get(pick.member), today: pick.time >= today });
    out.set(pick.dishId, who);
  }
  return out;
}

/** friendsPicks() as counts, for the score: Map dishId → number of friends. */
export function friendCounts(list, now) {
  return new Map([...friendsPicks(list, now)].map(([dishId, who]) => [dishId, who.length]));
}

/** "Compartir mis elecciones" turned off: picks not sent yet never will be. Unpicks still go. */
export function dropQueuedPicks(group) {
  group.queue = group.queue.filter((o) => o.op !== 'pick');
}

/** One call to the group function. → {ok, status, data}, with status 0 when the network failed. */
export async function callGroup(body, fetchImpl = globalThis.fetch) {
  let response;
  try {
    response = await fetchImpl(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 0, data: null };
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    // Not JSON (no function behind the address): the status says enough.
  }
  return { ok: response.ok, status: response.status, data };
}

export const createGroup = (secret, name, fetchImpl) => callGroup({ action: 'create', secret, name }, fetchImpl);
export const joinGroup = (code, secret, name, fetchImpl) => callGroup({ action: 'join', code, secret, name }, fetchImpl);
export const leaveGroup = (group, fetchImpl) => callGroup({ action: 'leave', code: group.code, secret: group.secret }, fetchImpl);
export const listGroup = (group, fetchImpl) => callGroup({ action: 'list', code: group.code, secret: group.secret }, fetchImpl);

/**
 * Sends the queue in order, one call at a time. `getGroup()` returns the
 * group in the CURRENT state, which may be replaced while a call is out (an
 * import, another tab): each sent call is removed from that group's queue,
 * and `save()` runs after each one.
 *
 * Stops at a network failure, a server error (5xx) or Netlify's rate limit
 * (a 429 that isn't the function's own "too-many"), to try again later. Any
 * other answer drops the call, since sending it again would get the same
 * answer. Returns 'gone' when the server says this phone isn't in the group,
 * 'later' when it stopped early, and 'done' otherwise.
 */
export async function flushQueue(getGroup, save, fetchImpl = globalThis.fetch) {
  for (;;) {
    const group = getGroup();
    const op = group?.queue[0];
    if (!op) return 'done';
    const { op: action, ...fields } = op;
    const res = await callGroup({ action, code: group.code, secret: group.secret, ...fields }, fetchImpl);
    if (res.status === 0 || res.status >= 500 || (res.status === 429 && res.data?.error !== 'too-many')) return 'later';
    const current = getGroup();
    if (!current || current.code !== group.code || current.secret !== group.secret) return 'done';
    if (res.status === 403 && res.data?.error === 'not-member') return 'gone';
    current.queue = current.queue.filter((o) => !(o.op === op.op && o.pickId === op.pickId));
    save();
  }
}
