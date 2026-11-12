// Rough macros from recipes. Pure: no DOM, no storage.
//
// FOODS gives kcal, protein, carbs, fat and fiber per 100 g of the food as
// bought (raw meat, dry pasta and rice, drained canned food), rounded from
// USDA FoodData Central (public domain). Carbs are total carbohydrate, fiber
// included, as USDA lists them. These are averages: a real milanesa can be
// 20% off either way. The app shows them as "aprox." and never as advice.
//
// `aliases` are the words that point at a food in a recipe line ("2 bifes de
// cuadril" → carne magra). `each` is the weight of one unit, so "2 huevos"
// can be turned into grams. `minor` foods (ajo, limón…) on a line with no
// amount are seasoning, like "ajo, perejil y sal": not a gap in the macros.

export const FOODS = {
  'carne magra': { kcal: 135, protein: 22, carbs: 0, fat: 5, fiber: 0, aliases: ['carne', 'nalga', 'bife', 'bifes', 'cuadril', 'peceto', 'bola de lomo', 'roast beef', 'carnaza'] },
  'carne picada': { kcal: 215, protein: 18, carbs: 0, fat: 15, fiber: 0, aliases: ['carne picada', 'picada'] },
  asado: { kcal: 290, protein: 16, carbs: 0, fat: 25, fiber: 0, aliases: ['asado', 'tira de asado', 'vacio', 'costilla'] },
  chorizo: { kcal: 300, protein: 15, carbs: 2, fat: 26, fiber: 0, aliases: ['chorizo'], each: 100 },
  cerdo: { kcal: 200, protein: 17, carbs: 0, fat: 14, fiber: 0, aliases: ['cerdo', 'bondiola'] },
  pollo: { kcal: 190, protein: 18, carbs: 0, fat: 13, fiber: 0, aliases: ['pollo', 'pata muslo', 'muslo'] },
  pechuga: { kcal: 120, protein: 22.5, carbs: 0, fat: 2.6, fiber: 0, aliases: ['pechuga', 'suprema'] },
  patitas: { kcal: 260, protein: 14, carbs: 16, fat: 16, fiber: 1, aliases: ['patitas', 'medallones de pollo', 'nuggets'] },
  salchicha: { kcal: 270, protein: 11, carbs: 3, fat: 24, fiber: 0, aliases: ['salchicha', 'salchichas'], each: 40 },
  pato: { kcal: 250, protein: 17, carbs: 0, fat: 20, fiber: 0, aliases: ['pato'] },
  merluza: { kcal: 75, protein: 16, carbs: 0, fat: 1, fiber: 0, aliases: ['merluza', 'pescado'] },
  atun: { kcal: 115, protein: 26, carbs: 0, fat: 1, fiber: 0, aliases: ['atun'] },
  mariscos: { kcal: 85, protein: 16, carbs: 2, fat: 1.5, fiber: 0, aliases: ['mariscos', 'langostinos', 'calamar', 'mejillones'] },
  huevo: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0, aliases: ['huevo'], each: 50 },
  jamon: { kcal: 120, protein: 18, carbs: 2, fat: 4, fiber: 0, aliases: ['jamon'] },
  queso: { kcal: 300, protein: 22, carbs: 2, fat: 23, fiber: 0, aliases: ['queso', 'mozzarella', 'muzzarella', 'cremoso', 'tybo'] },
  'queso rallado': { kcal: 390, protein: 33, carbs: 3, fat: 27, fiber: 0, aliases: ['queso rallado', 'rallado', 'reggianito', 'parmesano'] },
  manteca: { kcal: 717, protein: 0.9, carbs: 0.1, fat: 81, fiber: 0, aliases: ['manteca'] },
  leche: { kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0, aliases: ['leche'] },
  crema: { kcal: 340, protein: 2, carbs: 3, fat: 36, fiber: 0, aliases: ['crema', 'crema de leche'] },
  aceite: { kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, aliases: ['aceite', 'oliva'] },
  harina: { kcal: 364, protein: 10, carbs: 76, fat: 1, fiber: 2.7, aliases: ['harina'] },
  'pan rallado': { kcal: 395, protein: 13, carbs: 72, fat: 5, fiber: 4.5, aliases: ['pan rallado'] },
  pan: { kcal: 270, protein: 9, carbs: 55, fat: 1.5, fiber: 2.5, aliases: ['pan', 'pan frances', 'pan lactal', 'miga'] },
  'pan de hamburguesa': { kcal: 280, protein: 9, carbs: 50, fat: 4.5, fiber: 2, aliases: ['pan de hamburguesa', 'panes de hamburguesa'], each: 60 },
  tortillas: { kcal: 300, protein: 8, carbs: 50, fat: 7.5, fiber: 3, aliases: ['tortillas', 'tortillas de trigo', 'rapiditas'], each: 40 },
  masa: { kcal: 330, protein: 7, carbs: 50, fat: 11, fiber: 2, aliases: ['tapa de tarta', 'tapas de tarta', 'tapas de empanada', 'masa', 'discos'] },
  fideos: { kcal: 371, protein: 13, carbs: 75, fat: 1.5, fiber: 3.2, aliases: ['fideos', 'spaghetti', 'tallarines', 'mostacholes', 'tirabuzones', 'cabello de angel', 'municiones'] },
  ravioles: { kcal: 220, protein: 9, carbs: 30, fat: 7, fiber: 2, aliases: ['ravioles', 'sorrentinos'] },
  noquis: { kcal: 135, protein: 3.5, carbs: 29, fat: 0.5, fiber: 1.5, aliases: ['noquis'] },
  arroz: { kcal: 360, protein: 7, carbs: 79, fat: 0.6, fiber: 1.3, aliases: ['arroz'] },
  polenta: { kcal: 365, protein: 8, carbs: 78, fat: 1.7, fiber: 4, aliases: ['polenta', 'harina de maiz'] },
  lentejas: { kcal: 352, protein: 25, carbs: 60, fat: 1, fiber: 11, aliases: ['lentejas'] },
  garbanzos: { kcal: 140, protein: 7, carbs: 22, fat: 2.5, fiber: 6, aliases: ['garbanzos'] },
  arvejas: { kcal: 80, protein: 5, carbs: 14, fat: 0.4, fiber: 5, aliases: ['arvejas'] },
  papa: { kcal: 77, protein: 2, carbs: 17, fat: 0.1, fiber: 2.2, aliases: ['papa'], each: 200 },
  batata: { kcal: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3, aliases: ['batata'], each: 250 },
  calabaza: { kcal: 45, protein: 1, carbs: 12, fat: 0.1, fiber: 2, aliases: ['calabaza', 'zapallo', 'anco'] },
  zanahoria: { kcal: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8, aliases: ['zanahoria'], each: 80 },
  cebolla: { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, aliases: ['cebolla', 'verdeo'], each: 150 },
  ajo: { kcal: 149, protein: 6.4, carbs: 33, fat: 0.5, fiber: 2.1, aliases: ['ajo', 'diente de ajo', 'dientes de ajo'], each: 5, minor: true },
  tomate: { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, aliases: ['tomate', 'cherry'], each: 120 },
  'tomate triturado': { kcal: 32, protein: 1.6, carbs: 7, fat: 0.3, fiber: 1.9, aliases: ['tomate triturado', 'pure de tomate', 'salsa de tomate', 'tuco'] },
  lechuga: { kcal: 15, protein: 1.4, carbs: 2.9, fat: 0.2, fiber: 1.3, aliases: ['lechuga', 'rucula', 'hojas verdes'] },
  pepino: { kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5, aliases: ['pepino'] },
  morron: { kcal: 26, protein: 1, carbs: 6, fat: 0.3, fiber: 2, aliases: ['morron', 'pimiento'], each: 150 },
  berenjena: { kcal: 25, protein: 1, carbs: 6, fat: 0.2, fiber: 3, aliases: ['berenjena'], each: 300 },
  zapallito: { kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fiber: 1, aliases: ['zapallito', 'zucchini'], each: 200 },
  acelga: { kcal: 19, protein: 1.8, carbs: 3.7, fat: 0.2, fiber: 1.6, aliases: ['acelga'] },
  espinaca: { kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, aliases: ['espinaca'] },
  brocoli: { kcal: 34, protein: 2.8, carbs: 6.6, fat: 0.4, fiber: 2.6, aliases: ['brocoli'] },
  apio: { kcal: 16, protein: 0.7, carbs: 3, fat: 0.2, fiber: 1.6, aliases: ['apio'] },
  limon: { kcal: 22, protein: 0.4, carbs: 6.9, fat: 0.2, fiber: 0.3, aliases: ['limon', 'jugo de limon'], minor: true },
  naranja: { kcal: 45, protein: 0.7, carbs: 10.4, fat: 0.2, fiber: 0.2, aliases: ['naranja', 'jugo de naranja'] },
  azucar: { kcal: 387, protein: 0, carbs: 100, fat: 0, fiber: 0, aliases: ['azucar', 'miel'] },
  vino: { kcal: 82, protein: 0.1, carbs: 2.6, fat: 0, fiber: 0, aliases: ['vino', 'vino blanco', 'vino tinto'] },
  caldo: { kcal: 5, protein: 0.5, carbs: 0.5, fat: 0.2, fiber: 0, aliases: ['caldo'], minor: true },
  aceitunas: { kcal: 145, protein: 1, carbs: 4, fat: 15, fiber: 3, aliases: ['aceitunas'] },
  levadura: { kcal: 325, protein: 40, carbs: 41, fat: 7.6, fiber: 27, aliases: ['levadura'] },
  'salsa de soja': { kcal: 53, protein: 8, carbs: 5, fat: 0.6, fiber: 0.8, aliases: ['salsa de soja', 'soja'] },
  vinagre: { kcal: 18, protein: 0, carbs: 0, fat: 0, fiber: 0, aliases: ['vinagre'], minor: true },
};

export const MACROS = ['kcal', 'protein', 'carbs', 'fat', 'fiber'];

/** Lower case, no accents (ñ → n), single spaces. */
export function plain(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const ALIASES = Object.entries(FOODS)
  .flatMap(([key, food]) => food.aliases.map((alias) => ({ key, alias: plain(alias) })))
  .sort((a, b) => b.alias.length - a.alias.length); // longest first: "pan rallado" before "pan"

/**
 * The FOODS key a recipe line is about, or null. Whole words only, with an
 * optional plural. In Spanish the food is the first noun ("caldo de pollo",
 * "bife de chorizo"), so the match that starts earliest in the line wins, and
 * the longest one when two start at the same place ("pan rallado", not "pan").
 */
export function matchFood(text) {
  const words = ` ${plain(text)} `;
  let best = null;
  for (const { key, alias } of ALIASES) {
    for (const form of [alias, `${alias}s`, `${alias}es`]) {
      const at = words.indexOf(` ${form} `);
      if (at >= 0 && (best === null || at < best.at)) best = { key, at };
    }
  }
  return best?.key ?? null;
}

const empty = () => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

/**
 * Macros per portion of a recipe {serves, items: [{text, grams, food}]}.
 * Returns {kcal, protein, carbs, fat, fiber, missing: [texts]}, or null with
 * no recipe. `missing` lists lines that weigh something we can't count: grams
 * with no known food, or a known food with no grams. Lines with neither (sal,
 * pimienta) are seasoning and don't count.
 */
export function macrosOf(recipe) {
  if (!recipe) return null;
  const total = { ...empty(), missing: [] };
  for (const item of recipe.items ?? []) {
    const food = FOODS[item.food];
    const grams = Number(item.grams);
    if (food && grams > 0) {
      for (const m of MACROS) total[m] += (food[m] * grams) / 100;
    } else if (food || grams > 0) {
      total.missing.push(item.text);
    }
  }
  const serves = Math.max(1, Number(recipe.serves) || 1);
  for (const m of MACROS) total[m] /= serves;
  return total;
}

/** Macros of a main and its side, added up (a portion of each). */
export function mealMacros(...recipes) {
  const parts = recipes.map(macrosOf).filter(Boolean);
  if (parts.length === 0) return null;
  const sum = { ...empty(), missing: [] };
  for (const part of parts) {
    for (const m of MACROS) sum[m] += part[m];
    sum.missing.push(...part.missing);
  }
  return sum;
}

// ---- Recipe lines ---------------------------------------------------------
//
// A recipe line reads "<what>: <amount>", as the recipe sheet shows it:
//   "carne (nalga, en bifes finos): 300 g"
//   "huevos: 2 (100 g)"
//   "huevos: 2"            (grams from FOODS.huevo.each)
//   "sal y pimienta"       (no amount: seasoning)
// "300 g de carne picada" works too.

const NUM = '(\\d+(?:[.,]\\d+)?)';
const num = (s) => Number(String(s).replace(',', '.'));
const UNITS = { g: 1, gr: 1, grs: 1, gramos: 1, kg: 1000, ml: 1, cc: 1, l: 1000 };

/** One line of a recipe's ingredient list → {text, grams?, food?, each?}. Null for a blank line. */
export function parseItem(line) {
  const raw = String(line ?? '').replace(/\s+/g, ' ').trim().replace(/^[-•*]\s*/, '');
  if (!raw) return null;
  let text = raw;
  let grams = null;
  let count = null;

  const lead = raw.match(new RegExp(`^${NUM}\\s*(kg|grs|gramos|gr|g|ml|cc|l)\\s+(?:de\\s+)?(.+)$`, 'i'));
  const colon = raw.lastIndexOf(':');
  if (lead) {
    grams = num(lead[1]) * UNITS[lead[2].toLowerCase()];
    text = lead[3];
  } else if (colon > 0) {
    const amount = raw.slice(colon + 1).trim();
    const weight = amount.match(new RegExp(`^${NUM}\\s*(kg|grs|gramos|gr|g|ml|cc|l)$`, 'i'));
    const units = amount.match(new RegExp(`^${NUM}(?:\\s*\\(\\s*${NUM}\\s*g\\s*\\))?$`, 'i'));
    if (weight) grams = num(weight[1]) * UNITS[weight[2].toLowerCase()];
    else if (units) {
      count = num(units[1]);
      if (units[2]) grams = num(units[2]);
    }
    if (weight || units) text = raw.slice(0, colon).trim();
  }

  const item = { text };
  const food = matchFood(text);
  if (count && !grams && FOODS[food]?.each) grams = count * FOODS[food].each;
  if (food && (grams > 0 || !FOODS[food].minor)) item.food = food;
  if (grams > 0) item.grams = Math.round(grams);
  if (count && grams > 0) item.each = Math.round((grams / count) * 10) / 10;
  return item;
}

const roundGrams = (g) => (g >= 100 ? Math.round(g / 10) * 10 : g >= 10 ? Math.round(g / 5) * 5 : Math.round(g));
const roundCount = (n) => Math.max(0.5, Math.round(n * 2) / 2);
const showNumber = (n) => String(n).replace('.', ',');

/** The amount of an item for `portions`, given a recipe for `serves`: "300 g", "2 (100 g)", or "" for seasoning. */
export function itemAmount(item, serves = 1, portions = serves) {
  if (!(item.grams > 0)) return '';
  const grams = (item.grams * portions) / Math.max(1, serves);
  if (item.each > 0) return `${showNumber(roundCount(grams / item.each))} (${roundGrams(grams)} g)`;
  return `${roundGrams(grams)} g`;
}

/** One recipe line, the way parseItem() reads it back. */
export function formatItem(item, serves = 1, portions = serves) {
  const amount = itemAmount(item, serves, portions);
  return amount ? `${item.text}: ${amount}` : item.text;
}
