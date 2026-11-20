// Search by name (#42, #46): how a typed search matches ingredient and dish names.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { STARTER_DISHES } from '../js/dishes.js';
import { dishMatches, nameMatch, searchKey, wordsKey } from '../js/search.js';

const dish = (name) => ({ name });
const names = (typed) => STARTER_DISHES.filter((d) => dishMatches(d, typed)).map((d) => d.name);

test('searchKey: lowercase, no accents', () => {
  assert.equal(searchKey('  Azúcar '), 'azucar');
  assert.equal(searchKey('Ñoquis'), 'noquis');
});

test('nameMatch: Despensa as before (#42)', () => {
  assert.equal(nameMatch('aceite de oliva', 'aceit'), 'match');
  assert.equal(nameMatch('huevo', 'huevos'), 'exact');
  assert.equal(nameMatch('arroz', 'arroces'), 'exact');
  assert.equal(nameMatch('tomate triturado', 'tomates triturados'), 'exact');
  assert.equal(nameMatch('salsa', 'sal'), 'match');
  assert.equal(nameMatch('ajo', 'cebolla'), null);
});

test('wordsKey: punctuation is a space between words', () => {
  assert.equal(wordsKey('Pan con tomate (pa amb tomàquet)'), 'pan con tomate pa amb tomaquet');
  assert.equal(wordsKey('Milanesas, con puré'), 'milanesas con pure');
  assert.equal(wordsKey('  ¿¡ '), '');
});

test('dishMatches: an empty search, or only spaces or punctuation, shows every dish', () => {
  for (const typed of ['', '   ', '¿?']) assert.ok(dishMatches(dish('Tortilla de papas'), typed), JSON.stringify(typed));
});

test('dishMatches: no accents or capitals needed, singular and plural alike', () => {
  assert.ok(dishMatches(dish('Puré de calabaza'), 'pure'));
  assert.ok(dishMatches(dish('Ñoquis con salsa'), 'ÑOQUIS'));
  assert.ok(dishMatches(dish('Milanesas de berenjena'), 'milanesa'));
  assert.ok(dishMatches(dish('Empanadas de carne'), 'empanada carne'));
  assert.ok(dishMatches(dish('Tortilla de papas'), 'tortillas'));
});

test('dishMatches: each typed word starts a word of the name, in any order', () => {
  assert.ok(dishMatches(dish('Pollo al horno con papas'), 'papas pollo'));
  assert.ok(dishMatches(dish('Pollo al horno con papas'), 'hor'));
  assert.ok(!dishMatches(dish('Pollo al horno con papas'), 'pollo arroz'));
  assert.ok(!dishMatches(dish('Tortilla de papas'), 'pizza'));
});

test('dishMatches: words inside brackets or after a comma count', () => {
  assert.ok(dishMatches(dish('Pan con tomate (pa amb tomàquet)'), 'tomaquet'));
  assert.ok(dishMatches(dish('Pan con tomate (pa amb tomàquet)'), '(pa amb'));
});

test('dishMatches on the starter menu', () => {
  assert.ok(names('milanesa').includes('Milanesas de berenjena'));
  assert.ok(names('milanesa').every((n) => searchKey(n).includes('milanesa')));
  assert.ok(names('pollo').length >= 3);
  assert.deepEqual(names('zzz'), []);
});
