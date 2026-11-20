// Search by name: Despensa's ingredients (#42) and Comidas' dishes (#46).
// Pure, so the tests can check how names match.

/** For search: lowercase, no accents ("Azúcar" → "azucar"). */
export const searchKey = (text) => String(text).normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim();

/** One word with its plural ending (and the z → c of "arroz/arroces") taken off, to compare names: "tomates" and "tomate" → "tomat". */
const singularWord = (w) => (w.length > 3 ? w.replace(/s$/, '').replace(/e$/, '').replace(/z$/, 'c') : w);

/**
 * Does a name (its searchKey) match what's typed (its searchKey)? Word by word, each typed word
 * the start of a word of the name, singular or plural alike: "aceit" finds aceite and aceite de oliva,
 * "huevos" huevo, "arroces" arroz, "tomates triturados" tomate triturado. → 'exact', 'match' or null.
 */
export function nameMatch(key, q) {
  const typed = q.split(' ').filter(Boolean).map(singularWord);
  const words = key.split(' ').map(singularWord);
  if (q && words.join(' ') === typed.join(' ')) return 'exact';
  return key.includes(q) || typed.every((w) => words.some((k) => k.startsWith(w))) ? 'match' : null;
}

/** A dish name or a search for one, as words: searchKey with punctuation as spaces ("Pan con tomate (pa amb tomàquet)" → "pan con tomate pa amb tomaquet"). */
export const wordsKey = (text) => searchKey(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Does a dish's name match a search typed in Comidas (#46)? Empty matches every dish. */
export const dishMatches = (dish, typed) => Boolean(nameMatch(wordsKey(dish.name), wordsKey(typed)));
