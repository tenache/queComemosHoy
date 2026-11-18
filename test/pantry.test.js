// Despensa (#42): what a tap does, "Tengo todo" / "No tengo nada" and
// "Compré todo", and taking each back.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  boughtAll,
  defaultState,
  hasEverything,
  hasNothing,
  haveEverything,
  haveNothing,
  isMissing,
  markMissing,
  pantryStatus,
  togglePantry,
  undoBoughtAll,
  undoPantry,
} from '../js/state.js';

const stateWith = (mode, { missing = [], inStock = [] } = {}) => {
  const s = defaultState();
  s.settings.pantryMode = mode;
  s.missing = [...missing];
  s.inStock = [...inStock];
  return s;
};

test('pantryStatus: had, on the list, or (manual) not had', () => {
  const lazy = stateWith('lazy', { missing: ['leche'] });
  assert.equal(pantryStatus(lazy, 'arroz'), 'have');
  assert.equal(pantryStatus(lazy, ' Leche '), 'out');
  const manual = stateWith('manual', { missing: ['leche'], inStock: ['arroz'] });
  assert.equal(pantryStatus(manual, 'arroz'), 'have');
  assert.equal(pantryStatus(manual, 'leche'), 'out');
  assert.equal(pantryStatus(manual, 'fideos'), 'none');
});

test('pantryStatus agrees with isMissing (what the suggestions use)', () => {
  for (const mode of ['lazy', 'manual']) {
    const s = stateWith(mode, { missing: ['leche'], inStock: ['arroz'] });
    for (const n of ['leche', 'arroz', 'fideos']) assert.equal(pantryStatus(s, n) !== 'have', isMissing(s, n), `${mode} ${n}`);
  }
});

test('togglePantry, lazy: had → on the list → had', () => {
  const s = stateWith('lazy');
  togglePantry(s, 'arroz');
  assert.deepEqual(s.missing, ['arroz']);
  togglePantry(s, 'arroz');
  assert.deepEqual(s.missing, []);
  assert.equal(pantryStatus(s, 'arroz'), 'have');
});

test('togglePantry, manual: had → not had (not onto the list) → had; on the list → had', () => {
  const s = stateWith('manual', { missing: ['leche'], inStock: ['arroz'] });
  togglePantry(s, 'arroz');
  assert.equal(pantryStatus(s, 'arroz'), 'none');
  assert.deepEqual(s.missing, ['leche'], 'the list is left alone');
  togglePantry(s, 'arroz');
  assert.equal(pantryStatus(s, 'arroz'), 'have');
  togglePantry(s, 'leche');
  assert.equal(pantryStatus(s, 'leche'), 'have');
  assert.deepEqual(s.missing, []);
});

test('haveNothing: manual with nothing had, the list untouched; undo puts it back', () => {
  const s = stateWith('lazy', { missing: ['leche'], inStock: ['arroz'] });
  const before = haveNothing(s);
  assert.equal(s.settings.pantryMode, 'manual');
  assert.deepEqual(s.inStock, []);
  assert.deepEqual(s.missing, ['leche']);
  assert.ok(hasNothing(s));
  assert.equal(pantryStatus(s, 'arroz'), 'none');
  undoPantry(s, before);
  assert.equal(s.settings.pantryMode, 'lazy');
  assert.deepEqual(s.inStock, ['arroz']);
  assert.deepEqual(s.missing, ['leche']);
});

test('haveEverything: lazy, everything had, the list bought; undo puts the manual pantry and the list back', () => {
  const s = stateWith('manual', { missing: ['leche'], inStock: ['arroz'] });
  const before = haveEverything(s);
  assert.ok(hasEverything(s));
  assert.equal(pantryStatus(s, 'fideos'), 'have');
  assert.equal(pantryStatus(s, 'leche'), 'have');
  assert.deepEqual(s.missing, []);
  undoPantry(s, before);
  assert.equal(s.settings.pantryMode, 'manual');
  assert.deepEqual(s.inStock, ['arroz']);
  assert.deepEqual(s.missing, ['leche']);
  assert.equal(pantryStatus(s, 'fideos'), 'none');
  assert.equal(pantryStatus(s, 'leche'), 'out');
});

test('undoPantry: a name put on the list since stays on it, off the pantry', () => {
  const s = stateWith('manual', { inStock: ['arroz', 'fideos'] });
  const before = haveEverything(s);
  togglePantry(s, 'arroz'); // lazy now: onto the list
  undoPantry(s, before);
  assert.deepEqual(s.missing, ['arroz']);
  assert.deepEqual(s.inStock, ['fideos']);
  assert.equal(pantryStatus(s, 'arroz'), 'out');
});

test('undoPantry after "No tengo nada" puts nothing back on the list: a row marked Comprado since stays off it', () => {
  const s = stateWith('manual', { missing: ['leche', 'pan'], inStock: ['arroz'] });
  const before = haveNothing(s);
  togglePantry(s, 'leche'); // Comprado on the list
  undoPantry(s, before);
  assert.deepEqual(s.missing, ['pan']);
  assert.deepEqual(s.inStock, ['arroz']);
});

test('undoPantry: a broken record falls back to lazy, never throws', () => {
  const s = stateWith('manual');
  undoPantry(s, { pantryMode: 'weird', inStock: null });
  assert.equal(s.settings.pantryMode, 'lazy');
  assert.deepEqual(s.inStock, []);
});

test('hasEverything / hasNothing: when the button would change nothing', () => {
  assert.ok(hasEverything(stateWith('lazy')));
  assert.ok(!hasEverything(stateWith('lazy', { missing: ['leche'] })), 'something on the list: not everything');
  assert.ok(!hasEverything(stateWith('manual')));
  assert.ok(hasNothing(stateWith('manual', { missing: ['leche'] })));
  assert.ok(!hasNothing(stateWith('manual', { inStock: ['arroz'] })));
  assert.ok(!hasNothing(stateWith('lazy')));
});

test('boughtAll and undoBoughtAll, in both modes', () => {
  for (const mode of ['lazy', 'manual']) {
    const s = stateWith(mode, { missing: ['leche', 'pan'], inStock: ['arroz'] });
    const names = boughtAll(s);
    assert.deepEqual(s.missing, []);
    for (const n of ['leche', 'pan', 'arroz']) assert.equal(pantryStatus(s, n), 'have', `${mode} ${n}`);
    markMissing(s, ['yerba']); // added since
    undoBoughtAll(s, names);
    assert.deepEqual([...s.missing].sort(), ['leche', 'pan', 'yerba']);
    assert.deepEqual(s.inStock, ['arroz']);
  }
});

test('a name both on the list and in the pantry (old or imported data): the list wins, so the chip and the suggestions agree', async () => {
  const { normalizeState } = await import('../js/state.js');
  const s = normalizeState({ ...defaultState(), missing: ['leche', 'Pan '], inStock: ['leche', 'arroz', 'pan'], settings: { ...defaultState().settings, pantryMode: 'manual' } });
  assert.deepEqual(s.inStock, ['arroz']);
  for (const n of ['leche', 'pan', 'arroz']) assert.equal(pantryStatus(s, n) !== 'have', isMissing(s, n), n);
});
