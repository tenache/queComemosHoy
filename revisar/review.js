// The menu review (issue #15): a person who cooks places every starter dish
// in an effort tier and says what each main goes with. Pure: no DOM, no
// storage. The answers leave the phone as text plus a code (encodeReview),
// and a later PR turns them into STARTER_EFFORT and `sides` in js/dishes.js.

// Named tiers instead of numbers. `level` is the effort it becomes.
export const TIERS = [
  { level: 1, name: 'Lo pongo y me olvido', hint: 'Casi no estás en la cocina: lo preparás rápido y esperás.' },
  { level: 2, name: 'Un ratito', hint: 'Unos minutos de cortar, revolver o dar vuelta.' },
  { level: 3, name: 'Media hora en la cocina', hint: 'Un buen rato con las manos ocupadas.' },
  { level: 4, name: 'Bastante laburo', hint: 'Hay que preparar mucho: rebozar, freír, rellenar, amasar.' },
  { level: 5, name: 'Me lleva la tarde', hint: 'Casi todo el tiempo cocinando.' },
];

export const NEVER = 'never'; // "no lo hacemos": no tier, no sides
export const PAUSE_EVERY = 10; // offer a break after this many answers
export const CODE_PREFIX = 'QCH1.';
const MAX_TEXT = 200;

/** Deterministic rng (mulberry32), so the order is the same on every visit. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The order dishes are asked in: the mains shuffled (so similar dishes don't
 * come in a row), then the sides. Ids only.
 */
export function reviewQueue(dishes, seed = 15) {
  const rng = seeded(seed);
  const mains = dishes.filter((d) => d.role !== 'side').map((d) => d.id);
  for (let i = mains.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [mains[i], mains[j]] = [mains[j], mains[i]];
  }
  return [...mains, ...dishes.filter((d) => d.role === 'side').map((d) => d.id)];
}

/** answers: {dishId: {tier: 1-5 | NEVER, sides?: [ids], other?: text, note?: text}}. skipped: ids left for later. */
export function emptyReview() {
  return { answers: {}, skipped: [] };
}

const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
const isTier = (tier) => tier === NEVER || TIERS.some((x) => x.level === tier);

/** Anything read back from storage or a code, made safe. Unknown dish ids are dropped. */
export function cleanReview(raw, ids) {
  const known = new Set(ids);
  const review = emptyReview();
  const answers = raw && typeof raw === 'object' && raw.answers && typeof raw.answers === 'object' ? raw.answers : {};
  for (const [id, a] of Object.entries(answers)) {
    if (!known.has(id) || !a || typeof a !== 'object') continue;
    const answer = {};
    if (isTier(a.tier)) answer.tier = a.tier;
    if (Array.isArray(a.sides)) answer.sides = [...new Set(a.sides.map(String).filter((s) => known.has(s) && s !== id))];
    if (cleanText(a.other)) answer.other = cleanText(a.other);
    if (cleanText(a.note)) answer.note = cleanText(a.note);
    if (Object.keys(answer).length > 0) review.answers[id] = answer;
  }
  if (raw && Array.isArray(raw.skipped)) review.skipped = [...new Set(raw.skipped.map(String).filter((id) => known.has(id)))];
  return review;
}

/** A main gets the "¿con qué lo acompañás?" question, unless it's never cooked. */
export function needsSides(dish, answer) {
  return dish.role !== 'side' && answer?.tier !== NEVER;
}

/** Answered in full: a tier, and for a main the sides question too. */
export function isDone(dish, answer) {
  return answer?.tier != null && (!needsSides(dish, answer) || Array.isArray(answer.sides));
}

/** The first dish not done and not skipped, or null. With `includeSkipped`, skipped ones count too. */
export function nextDish(queue, review, byId, { includeSkipped = false } = {}) {
  return (
    queue.find((id) => !isDone(byId.get(id), review.answers[id]) && (includeSkipped || !review.skipped.includes(id))) ?? null
  );
}

export function previousDish(queue, id) {
  const i = queue.indexOf(id);
  return i > 0 ? queue[i - 1] : null;
}

export function setTier(review, id, tier) {
  if (!isTier(tier)) return;
  const answer = { ...review.answers[id], tier };
  if (tier === NEVER) delete answer.sides;
  review.answers[id] = answer;
  review.skipped = review.skipped.filter((x) => x !== id);
}

/** Sides chosen for a main ([] = "nada, va solo") and an optional side that isn't in the list. */
export function setSides(review, id, sides, other = '') {
  const answer = { ...review.answers[id], sides: [...new Set(sides)] };
  if (cleanText(other)) answer.other = cleanText(other);
  else delete answer.other;
  review.answers[id] = answer;
}

export function setNote(review, id, note) {
  const answer = { ...review.answers[id] };
  if (cleanText(note)) answer.note = cleanText(note);
  else delete answer.note;
  review.answers[id] = answer;
}

export function skip(review, id) {
  if (!review.skipped.includes(id)) review.skipped.push(id);
}

export function progress(queue, review, byId) {
  return { done: queue.filter((id) => isDone(byId.get(id), review.answers[id])).length, total: queue.length };
}

/** Names of the dishes already placed in `tier`, in queue order: the examples on each tier button. */
export function placedIn(queue, review, byId, tier, except = null) {
  return queue.filter((id) => id !== except && review.answers[id]?.tier === tier).map((id) => byId.get(id).name);
}

const lower = (name) => name.charAt(0).toLocaleLowerCase('es') + name.slice(1);

/** The answers as text to send by message, ending with the code. */
export function summaryText(queue, review, byId) {
  const { done, total } = progress(queue, review, byId);
  const lines = [`Revisión de comidas (${done} de ${total})`, ''];
  for (const tier of TIERS) {
    const names = placedIn(queue, review, byId, tier.level);
    if (names.length) lines.push(`${tier.name}: ${names.join(', ')}`);
  }
  const never = placedIn(queue, review, byId, NEVER);
  if (never.length) lines.push(`No lo hacemos: ${never.join(', ')}`);

  const withSides = queue.filter((id) => Array.isArray(review.answers[id]?.sides) && needsSides(byId.get(id), review.answers[id]));
  if (withSides.length) {
    lines.push('', 'Acompañamientos:');
    for (const id of withSides) {
      const { sides, other } = review.answers[id];
      const parts = sides.map((s) => lower(byId.get(s).name));
      if (other) parts.push(`otro: ${other}`);
      lines.push(`• ${byId.get(id).name}: ${parts.length ? parts.join(', ') : 'nada, va solo'}`);
    }
  }
  const notes = queue.filter((id) => review.answers[id]?.note);
  if (notes.length) {
    lines.push('', 'Comentarios:');
    for (const id of notes) lines.push(`• ${byId.get(id).name}: ${review.answers[id].note}`);
  }
  const pending = queue.filter((id) => !isDone(byId.get(id), review.answers[id]));
  if (pending.length) lines.push('', `Sin contestar: ${pending.map((id) => byId.get(id).name).join(', ')}`);
  lines.push('', `Código: ${encodeReview(review)}`);
  return lines.join('\n');
}

// Base64url of UTF-8 JSON, so accents in comments survive a chat app.
export function encodeReview(review) {
  const bytes = new TextEncoder().encode(JSON.stringify({ answers: review.answers, skipped: review.skipped }));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return CODE_PREFIX + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The review inside a code (or a whole message ending in one). Throws if there is none. */
export function decodeReview(text, ids) {
  const code = String(text).match(/QCH1\.([A-Za-z0-9_-]+)/)?.[1];
  if (!code) throw new Error('no-code');
  const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  const json = new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  return cleanReview(JSON.parse(json), ids);
}
