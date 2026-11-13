// Tests for the menu review page's logic (revisar/review.js, issue #15).

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { STARTER_DISHES } from '../js/dishes.js';
import {
  NEVER,
  TIERS,
  cleanReview,
  decodeReview,
  emptyReview,
  encodeReview,
  isDone,
  nextDish,
  placedIn,
  previousDish,
  progress,
  reviewQueue,
  setNote,
  setSides,
  setTier,
  skip,
  summaryText,
} from '../revisar/review.js';

const byId = new Map(STARTER_DISHES.map((d) => [d.id, d]));
const queue = reviewQueue(STARTER_DISHES);
const ids = STARTER_DISHES.map((d) => d.id);

test('five named tiers, levels 1 to 5, no numbers in the names', () => {
  assert.deepEqual(TIERS.map((t) => t.level), [1, 2, 3, 4, 5]);
  for (const t of TIERS) assert.ok(t.name && t.hint && !/\d/.test(t.name), t.name);
});

test('the queue asks every starter dish once: mains shuffled, then sides; the same order on every visit', () => {
  assert.deepEqual([...queue].sort(), [...ids].sort());
  const firstSide = queue.findIndex((id) => byId.get(id).role === 'side');
  assert.ok(queue.slice(firstSide).every((id) => byId.get(id).role === 'side'), 'sides come last');
  assert.notDeepEqual(queue.slice(0, firstSide), ids.filter((id) => byId.get(id).role !== 'side'), 'mains are shuffled');
  assert.deepEqual(reviewQueue(STARTER_DISHES), queue);
});

test('a main is done after its tier and sides; a side, or a dish never cooked, after its tier', () => {
  const review = emptyReview();
  setTier(review, 'bife-plancha', 1);
  assert.equal(isDone(byId.get('bife-plancha'), review.answers['bife-plancha']), false, 'still needs sides');
  setSides(review, 'bife-plancha', ['ensalada-mixta', 'pure']);
  assert.equal(isDone(byId.get('bife-plancha'), review.answers['bife-plancha']), true);

  setTier(review, 'pure', 3);
  assert.equal(isDone(byId.get('pure'), review.answers.pure), true, 'a side has no sides question');

  setSides(review, 'asado', ['ensalada-mixta']);
  setTier(review, 'asado', NEVER);
  assert.equal(isDone(byId.get('asado'), review.answers.asado), true);
  assert.equal(review.answers.asado.sides, undefined, '"no lo hacemos" drops its sides');

  setTier(review, 'tostado', 2);
  setSides(review, 'tostado', []);
  assert.equal(isDone(byId.get('tostado'), review.answers.tostado), true, '"nada, va solo" is an answer');
  setTier(review, 'tostado', 9);
  assert.equal(review.answers.tostado.tier, 2, 'an unknown tier is ignored');
});

test('next, skip, back and progress', () => {
  const review = emptyReview();
  assert.equal(nextDish(queue, review, byId), queue[0]);
  skip(review, queue[0]);
  assert.equal(nextDish(queue, review, byId), queue[1], 'a skipped dish waits');
  assert.equal(nextDish(queue, review, byId, { includeSkipped: true }), queue[0], 'and comes back at the end');
  setTier(review, queue[0], NEVER);
  assert.deepEqual(review.skipped, [], 'answering takes it off the skipped list');
  assert.equal(previousDish(queue, queue[1]), queue[0]);
  assert.equal(previousDish(queue, queue[0]), null);
  assert.deepEqual(progress(queue, review, byId), { done: 1, total: ids.length });

  for (const id of queue) {
    setTier(review, id, 2);
    if (byId.get(id).role !== 'side') setSides(review, id, []);
  }
  assert.equal(nextDish(queue, review, byId, { includeSkipped: true }), null);
  assert.equal(progress(queue, review, byId).done, ids.length);
});

test('each tier shows the dishes already in it, leaving out the one being asked', () => {
  const review = emptyReview();
  setTier(review, 'pollo-horno-papas', 1);
  setTier(review, 'bife-plancha', 1);
  setTier(review, 'empanadas-carne', 5);
  const order = queue.filter((id) => ['pollo-horno-papas', 'bife-plancha'].includes(id)).map((id) => byId.get(id).name);
  assert.deepEqual(placedIn(queue, review, byId, 1), order);
  assert.deepEqual(placedIn(queue, review, byId, 1, 'bife-plancha'), ['Pollo al horno']);
  assert.deepEqual(placedIn(queue, review, byId, 5), ['Empanadas de carne']);
});

test('the summary lists tiers, sides, comments and what is left, and ends with the code', () => {
  const review = emptyReview();
  setTier(review, 'milanesas-pure', 4);
  setSides(review, 'milanesas-pure', ['pure', 'ensalada-mixta'], 'papas al horno con romero');
  setTier(review, 'tostado', 1);
  setSides(review, 'tostado', []);
  setTier(review, 'pato-naranja', NEVER);
  setNote(review, 'milanesas-pure', '  depende   de la carne ');
  const text = summaryText(queue, review, byId);
  assert.match(text, /^Revisión de comidas \(3 de \d+\)/);
  assert.match(text, /Bastante laburo: Milanesas\n/);
  assert.match(text, /Lo pongo y me olvido: Tostado de jamón y queso/);
  assert.match(text, /No lo hacemos: Pato a la naranja/);
  assert.match(text, /• Milanesas: puré de papas, ensalada mixta, otro: papas al horno con romero/);
  assert.match(text, /• Tostado de jamón y queso: nada, va solo/);
  assert.match(text, /• Milanesas: depende de la carne/);
  assert.match(text, /Sin contestar: /);
  assert.match(text, /Código: QCH1\.[A-Za-z0-9_-]+$/);
});

test('the code round-trips, accents included, and can be pasted with the whole message', () => {
  const review = emptyReview();
  setTier(review, 'noquis', 2);
  setSides(review, 'noquis', ['ensalada-tomate'], 'pan con ajo');
  setNote(review, 'noquis', 'los ñoquis caseros son otra cosa: ¡mucho más!');
  skip(review, 'paella');
  const back = decodeReview(`hola\n\n${summaryText(queue, review, byId)}\n`, ids);
  assert.deepEqual(back, review);
  assert.equal(encodeReview(back), encodeReview(review));
  assert.throws(() => decodeReview('sin código', ids), /no-code/);
});

test('cleanReview keeps what is valid and drops the rest', () => {
  assert.deepEqual(cleanReview(null, ids), emptyReview());
  assert.deepEqual(cleanReview('garbage', ids), emptyReview());
  const clean = cleanReview(
    {
      answers: {
        pizza: { tier: 4, sides: ['ensalada-mixta', 'ensalada-mixta', 'nope', 'pizza'], other: ' x ', note: '' },
        unknown: { tier: 1 },
        asado: { tier: 'muchísimo' },
        lentejas: 'no',
      },
      skipped: ['paella', 'nope', 'paella'],
    },
    ids,
  );
  assert.deepEqual(clean, { answers: { pizza: { tier: 4, sides: ['ensalada-mixta'], other: 'x' } }, skipped: ['paella'] });
});
