// Starter dishes: everyday home cooking in Argentina and Spain.
// `mains` are category tags (pasta, pollo, arroz…), never staples like
// cebolla, ajo, aceite or sal. They drive the "ingredient fatigue" penalty.
//
// A dish is either a `main` (it can be the suggestion card) or a `side` (it
// only ever goes with a main). A main lists the dishes that go with it in
// `sides`, by id; an empty list means it is a complete meal on its own.
// `sides` may point at another main too: milanesas go with ravioles con tuco.
//
// `effort` (1–5, hidden from the user) is the hands-on work, not the total
// time: pollo al horno takes an hour but is 1, empanadas are 5.

// prettier-ignore
const EFFORT = {
  'fideos-huevo': 2, 'tortilla-papas': 4, 'milanesas-berenjena': 4, 'pollo-curry': 3, 'sopa-pollo': 2,
  lentejas: 2, 'pato-naranja': 4, 'milanesas-pure': 4, 'ravioles-tuco': 2, noquis: 2, 'arroz-atun': 1,
  'tarta-jamon-queso': 2, 'tarta-acelga': 3, 'empanadas-carne': 5, pizza: 4, 'polenta-tuco': 2,
  'guiso-fideos': 3, 'pollo-horno-papas': 1, 'ensalada-completa': 2, 'revuelto-zapallitos': 2,
  hamburguesas: 3, 'fajitas-pollo': 3, 'merluza-ensalada': 1, paella: 4, gazpacho: 2,
  'garbanzos-espinaca': 2, tostado: 1, omelette: 1, 'wok-verduras': 3, asado: 4, 'cerdo-batatas': 1,
  'zapallitos-rellenos': 4, 'croquetas-arroz': 4, salchichas: 1, 'patitas-pollo': 1, 'huevos-fritos': 1,
  'bife-plancha': 1, 'pechuga-plancha': 1, 'fideos-manteca': 1,
  pure: 3, 'pure-calabaza': 2, 'ensalada-mixta': 2, 'ensalada-tomate': 1, 'papas-fritas': 3,
  'papas-horno': 2, 'batatas-horno': 1, 'arroz-blanco': 1, 'verduras-vapor': 2,
};

const dish = (role, id, name, emoji, cookMinutes, health, yum, mains, ingredients, sides = []) => ({
  id,
  name,
  emoji,
  role,
  sides,
  ingredients,
  mains,
  cookMinutes,
  effort: EFFORT[id],
  health,
  yum,
  liking: 0,
  neverShow: false,
  favorite: false,
});
const d = (...args) => dish('main', ...args);
const side = (...args) => dish('side', ...args);

// The usual sides for something fried or grilled.
const CON_PAPAS = ['pure', 'papas-fritas', 'ensalada-mixta'];

export const STARTER_DISHES = [
  d('fideos-huevo', 'Fideos con huevo frito', '🍝', 15, 3, 4, ['pasta', 'huevo'], ['fideos', 'huevo', 'queso rallado']),
  d('tortilla-papas', 'Tortilla de papas', '🥔', 40, 3, 4, ['papa', 'huevo'], ['papa', 'huevo', 'cebolla']),
  d('milanesas-berenjena', 'Milanesas de berenjena', '🍆', 40, 4, 2, ['berenjena'], ['berenjena', 'huevo', 'pan rallado']),
  d('pollo-curry', 'Pollo al curry con arroz', '🍛', 40, 3, 4, ['pollo', 'arroz'], ['pollo', 'arroz', 'curry', 'cebolla', 'crema']),
  d('sopa-pollo', 'Sopa de pollo', '🍲', 50, 5, 3, ['pollo'], ['pollo', 'zanahoria', 'cebolla', 'apio', 'fideos']),
  d('lentejas', 'Lentejas', '🥘', 50, 5, 3, ['legumbres'], ['lentejas', 'cebolla', 'zanahoria', 'papa', 'pimentón']),
  d('pato-naranja', 'Pato a la naranja', '🦆', 150, 3, 5, ['pato'], ['pato', 'naranja', 'manteca', 'azúcar', 'vino blanco', 'caldo']),
  d('milanesas-pure', 'Milanesas', '🥩', 35, 2, 5, ['carne'], ['carne', 'huevo', 'pan rallado'], ['pure', 'ensalada-mixta', 'papas-fritas', 'ravioles-tuco', 'arroz-blanco']),
  d('ravioles-tuco', 'Ravioles con tuco', '🥟', 25, 3, 4, ['pasta'], ['ravioles', 'tomate triturado', 'cebolla', 'ajo', 'queso rallado']),
  d('noquis', 'Ñoquis con salsa', '🍝', 20, 2, 4, ['pasta'], ['ñoquis', 'tomate triturado', 'queso rallado']),
  d('arroz-atun', 'Arroz con atún', '🍚', 20, 3, 3, ['arroz', 'pescado'], ['arroz', 'atún', 'huevo']),
  d('tarta-jamon-queso', 'Tarta de jamón y queso', '🥧', 45, 2, 4, ['masa', 'queso'], ['tapa de tarta', 'jamón', 'queso', 'huevo']),
  d('tarta-acelga', 'Tarta de acelga', '🥬', 50, 4, 3, ['masa', 'verdura'], ['tapa de tarta', 'acelga', 'huevo', 'cebolla', 'queso']),
  d('empanadas-carne', 'Empanadas de carne', '🥟', 70, 2, 5, ['masa', 'carne'], ['tapas de empanada', 'carne picada', 'cebolla', 'huevo', 'aceitunas']),
  d('pizza', 'Pizza casera', '🍕', 80, 2, 5, ['masa', 'queso'], ['harina', 'levadura', 'tomate triturado', 'mozzarella']),
  d('polenta-tuco', 'Polenta con tuco', '🌽', 20, 3, 3, ['polenta'], ['polenta', 'tomate triturado', 'cebolla', 'queso rallado']),
  d('guiso-fideos', 'Guiso de fideos', '🍲', 45, 3, 4, ['pasta', 'carne'], ['fideos', 'carne', 'papa', 'zanahoria', 'tomate triturado', 'cebolla']),
  d('pollo-horno-papas', 'Pollo al horno', '🍗', 60, 4, 5, ['pollo'], ['pollo', 'limón', 'ajo'], ['papas-horno', 'batatas-horno', 'ensalada-mixta']),
  d('ensalada-completa', 'Ensalada completa', '🥗', 15, 5, 3, ['verdura', 'huevo'], ['lechuga', 'tomate', 'huevo', 'zanahoria', 'atún']),
  d('revuelto-zapallitos', 'Revuelto de zapallitos', '🥒', 20, 4, 3, ['verdura', 'huevo'], ['zapallito', 'huevo', 'cebolla', 'queso rallado']),
  d('hamburguesas', 'Hamburguesas caseras', '🍔', 30, 2, 5, ['carne', 'pan'], ['carne picada', 'pan de hamburguesa', 'lechuga', 'tomate', 'queso'], ['papas-fritas', 'ensalada-mixta']),
  d('fajitas-pollo', 'Fajitas de pollo', '🌮', 30, 3, 4, ['pollo'], ['pollo', 'tortillas', 'morrón', 'cebolla']),
  d('merluza-ensalada', 'Merluza al horno', '🐟', 25, 5, 3, ['pescado'], ['merluza', 'limón'], ['ensalada-mixta', 'pure', 'papas-horno']),
  d('paella', 'Paella', '🥘', 75, 4, 5, ['arroz', 'mariscos'], ['arroz', 'pollo', 'mariscos', 'morrón', 'arvejas', 'azafrán', 'caldo']),
  d('gazpacho', 'Gazpacho', '🍅', 15, 5, 3, ['tomate'], ['tomate', 'pepino', 'morrón', 'pan', 'ajo', 'vinagre']),
  d('garbanzos-espinaca', 'Garbanzos con espinaca', '🫘', 30, 5, 3, ['legumbres'], ['garbanzos', 'espinaca', 'ajo', 'pimentón']),
  d('tostado', 'Tostado de jamón y queso', '🥪', 10, 2, 3, ['pan', 'queso'], ['pan', 'jamón', 'queso']),
  d('omelette', 'Omelette de queso', '🍳', 10, 3, 3, ['huevo', 'queso'], ['huevo', 'queso', 'manteca']),
  d('wok-verduras', 'Wok de verduras con arroz', '🥦', 25, 5, 3, ['arroz', 'verdura'], ['arroz', 'brócoli', 'zanahoria', 'morrón', 'salsa de soja']),
  d('asado', 'Asado', '🔥', 180, 2, 5, ['carne'], ['asado', 'chorizo', 'carbón', 'pan', 'lechuga', 'tomate']),
  d('cerdo-batatas', 'Bondiola al horno', '🐖', 60, 3, 4, ['cerdo'], ['bondiola de cerdo', 'ajo'], ['batatas-horno', 'pure', 'ensalada-mixta']),
  d('zapallitos-rellenos', 'Zapallitos rellenos', '🫑', 60, 4, 4, ['verdura', 'carne'], ['zapallito', 'carne picada', 'cebolla', 'queso']),

  // Very simple mains (added in schema v3).
  d('croquetas-arroz', 'Croquetas de arroz', '🍙', 35, 3, 4, ['arroz', 'queso'], ['arroz', 'huevo', 'queso', 'pan rallado'], ['ensalada-mixta', 'ensalada-tomate', 'pure-calabaza']),
  d('salchichas', 'Salchichas', '🌭', 15, 1, 4, ['salchicha'], ['salchichas'], CON_PAPAS),
  d('patitas-pollo', 'Patitas de pollo', '🐔', 20, 2, 4, ['pollo'], ['patitas de pollo'], [...CON_PAPAS, 'arroz-blanco']),
  d('huevos-fritos', 'Huevos fritos', '🥚', 10, 3, 4, ['huevo'], ['huevo'], ['papas-fritas', 'arroz-blanco', 'ensalada-mixta']),
  d('bife-plancha', 'Bife a la plancha', '🍖', 15, 3, 4, ['carne'], ['bife'], ['ensalada-mixta', 'pure', 'papas-fritas', 'papas-horno']),
  d('pechuga-plancha', 'Pechuga a la plancha', '🐓', 15, 4, 3, ['pollo'], ['pechuga de pollo', 'limón'], ['ensalada-mixta', 'arroz-blanco', 'verduras-vapor', 'pure-calabaza']),
  d('fideos-manteca', 'Fideos con manteca y queso', '🧈', 12, 2, 4, ['pasta', 'queso'], ['fideos', 'manteca', 'queso rallado']),

  // Sides (added in schema v3).
  side('pure', 'Puré de papas', '🥔', 25, 3, 4, ['papa'], ['papa', 'leche', 'manteca']),
  side('pure-calabaza', 'Puré de calabaza', '🎃', 25, 4, 3, ['calabaza'], ['calabaza', 'manteca']),
  side('ensalada-mixta', 'Ensalada mixta', '🥗', 10, 5, 3, ['verdura'], ['lechuga', 'tomate', 'cebolla']),
  side('ensalada-tomate', 'Ensalada de tomate', '🍅', 5, 5, 3, ['tomate'], ['tomate', 'cebolla']),
  side('papas-fritas', 'Papas fritas', '🍟', 30, 1, 5, ['papa'], ['papa', 'aceite']),
  side('papas-horno', 'Papas al horno', '🥔', 45, 3, 4, ['papa'], ['papa', 'romero']),
  side('batatas-horno', 'Batatas al horno', '🍠', 45, 4, 4, ['batata'], ['batata']),
  side('arroz-blanco', 'Arroz blanco', '🍚', 20, 3, 3, ['arroz'], ['arroz']),
  side('verduras-vapor', 'Verduras al vapor', '🥕', 15, 5, 2, ['verdura'], ['brócoli', 'zanahoria', 'zapallito']),
];

/**
 * The v2 starter dishes that became "main + side" in v3: their old name, and
 * the side their past meals had. The v2 → v3 migration only reshapes a dish
 * that still has its old name (an edited dish is the user's, and stays).
 */
export const SPLIT_IN_V3 = {
  'milanesas-pure': { oldName: 'Milanesas con puré', sideId: 'pure' },
  'merluza-ensalada': { oldName: 'Merluza al horno con ensalada', sideId: 'ensalada-mixta' },
  'pollo-horno-papas': { oldName: 'Pollo al horno con papas', sideId: 'papas-horno' },
  'cerdo-batatas': { oldName: 'Bondiola de cerdo con batatas', sideId: 'batatas-horno' },
};

/** The starter effort of a dish id, or undefined for the user's own dishes. */
export const starterEffort = (id) => EFFORT[id];

/** Starter dishes that v3 adds to existing data. */
export const NEW_IN_V3 = [
  'croquetas-arroz', 'salchichas', 'patitas-pollo', 'huevos-fritos', 'bife-plancha', 'pechuga-plancha', 'fideos-manteca',
  'pure', 'pure-calabaza', 'ensalada-mixta', 'ensalada-tomate', 'papas-fritas', 'papas-horno', 'batatas-horno', 'arroz-blanco', 'verduras-vapor',
];
