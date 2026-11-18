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
// time: pollo al horno takes an hour but is 1, empanadas are 5. A main's effort
// is the main alone; its side has its own. Some ids still name the v2 side
// (`merluza-ensalada` is just "Merluza al horno", see SPLIT_IN_V3). A dish that
// includes another one's work (curry with its rice) is never below that dish.

// prettier-ignore
const STARTER_EFFORT = {
  'fideos-huevo': 2, 'tortilla-papas': 4, 'milanesas-berenjena': 4, 'pollo-curry': 3, 'sopa-pollo': 2,
  lentejas: 2, 'pato-naranja': 4, 'milanesas-pure': 4, 'ravioles-tuco': 2, noquis: 2, 'arroz-atun': 1,
  'tarta-jamon-queso': 2, 'tarta-acelga': 3, 'empanadas-carne': 5, pizza: 4, 'polenta-tuco': 2,
  'guiso-fideos': 3, 'pollo-horno-papas': 1, 'ensalada-completa': 2, 'revuelto-zapallitos': 2,
  hamburguesas: 3, 'fajitas-pollo': 3, 'merluza-ensalada': 1, paella: 4, gazpacho: 2,
  'garbanzos-espinaca': 2, tostado: 1, omelette: 1, 'wok-verduras': 3, asado: 4, 'cerdo-batatas': 1,
  'zapallitos-rellenos': 4, 'croquetas-arroz': 4, salchichas: 1, 'patitas-pollo': 1, 'huevos-fritos': 1,
  'bife-plancha': 1, 'pechuga-plancha': 1, 'fideos-manteca': 1, 'pulled-pork': 2,
  pure: 3, 'pure-calabaza': 3, 'ensalada-mixta': 2, 'ensalada-tomate': 1, 'papas-fritas': 3,
  'papas-horno': 2, 'batatas-horno': 1, 'arroz-blanco': 1, 'verduras-vapor': 2,
  // Mediterranean (v8, #36).
  fideua: 3, 'arroz-negro': 3, 'butifarra-judias': 1, salmorejo: 2, 'gambas-ajillo': 1, 'calamares-romana': 3,
  sardinas: 2, suquet: 3, 'pasta-pesto': 2, 'pasta-puttanesca': 2, 'pasta-aglio-olio': 1, 'espaguetis-almejas': 2,
  'pasta-norma': 2, 'berenjenas-parmesana': 4, minestrone: 2, musaka: 5, souvlaki: 3, 'tarta-espinaca-feta': 3,
  'tomates-rellenos': 4, 'albondigas-griegas': 4, 'cordero-horno': 1, 'sopa-lentejas-rojas': 2, falafel: 4,
  'lentejas-arroz': 2, shakshuka: 2, 'cuscus-verduras': 2, 'tajin-pollo': 2, ratatouille: 3, 'ensalada-nizarda': 2,
  'dorada-horno': 1, 'mejillones-marinera': 2, 'pollo-ajillo': 2, 'shawarma-pollo': 2, canelones: 5, 'arroz-horno': 2,
  'tajin-kefta': 3, 'gigantes-horno': 2,
  'pan-tomate': 1, escalivada: 2, 'espinacas-catalana': 2, 'ensalada-griega': 2, 'ensalada-caprese': 1,
  hummus: 1, tabule: 3, cuscus: 1,
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
  effort: STARTER_EFFORT[id],
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
// Milanesas' sides, of meat or of eggplant.
const CON_MILANESA = ['pure', 'ensalada-mixta', 'papas-fritas', 'ravioles-tuco', 'arroz-blanco'];

export const STARTER_DISHES = [
  d('fideos-huevo', 'Fideos con huevo frito', '🍝', 15, 3, 4, ['pasta', 'huevo'], ['fideos', 'huevo', 'queso rallado']),
  d('tortilla-papas', 'Tortilla de papas', '🥔', 40, 3, 4, ['papa', 'huevo'], ['papa', 'huevo', 'cebolla'], ['pan-tomate', 'ensalada-mixta']),
  d('milanesas-berenjena', 'Milanesas de berenjena', '🍆', 40, 4, 2, ['berenjena'], ['berenjena', 'huevo', 'pan rallado'], CON_MILANESA),
  d('pollo-curry', 'Pollo al curry con arroz', '🍛', 40, 3, 4, ['pollo', 'arroz'], ['pollo', 'arroz', 'curry', 'cebolla', 'crema']),
  d('sopa-pollo', 'Sopa de pollo', '🍲', 50, 5, 3, ['pollo'], ['pollo', 'zanahoria', 'cebolla', 'apio', 'fideos']),
  d('lentejas', 'Guiso de lentejas', '🥘', 50, 5, 3, ['legumbres'], ['lentejas', 'cebolla', 'zanahoria', 'papa', 'pimentón']),
  d('pato-naranja', 'Pato a la naranja', '🦆', 150, 3, 5, ['pato'], ['pato', 'naranja', 'manteca', 'azúcar', 'vino blanco', 'caldo']),
  d('milanesas-pure', 'Milanesas', '🥩', 35, 2, 5, ['carne'], ['carne', 'huevo', 'pan rallado'], CON_MILANESA),
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

  // Added in schema v6 (#30): a big piece for everyone to make sandwiches.
  d('pulled-pork', 'Pulled pork', '🥪', 240, 2, 5, ['cerdo', 'pan'], ['bondiola de cerdo', 'pan de hamburguesa'], ['papas-fritas', 'ensalada-mixta']),

  // Mediterranean cooking, added in schema v8 (#36): Spain and Catalonia, Italy,
  // Greece, Turkey and the Levant, North Africa, Provence. The menu already had
  // paella, gazpacho, tortilla de papas, garbanzos con espinaca, pizza and ñoquis.
  // Yum and health follow the older dishes' scale: a 5 is a crowd favourite.
  d('fideua', 'Fideuá', '🦐', 40, 4, 4, ['pasta', 'mariscos'], ['fideos de fideuá', 'langostinos', 'calamar', 'tomate triturado', 'caldo de pescado']),
  d('arroz-negro', 'Arroz negro', '🦑', 45, 4, 4, ['arroz', 'mariscos'], ['arroz', 'calamar', 'tinta de calamar', 'caldo de pescado', 'cebolla']),
  d('butifarra-judias', 'Butifarra con judías', '🫘', 25, 2, 4, ['cerdo', 'legumbres'], ['butifarra', 'porotos blancos', 'ajo', 'perejil'], ['pan-tomate', 'escalivada']),
  d('salmorejo', 'Salmorejo', '🍅', 15, 4, 3, ['tomate', 'pan'], ['tomate', 'pan', 'aceite de oliva', 'huevo', 'jamón crudo']),
  d('gambas-ajillo', 'Gambas al ajillo', '🧄', 15, 4, 4, ['mariscos'], ['gambas', 'ajo', 'aceite de oliva', 'guindilla', 'pan']),
  d('calamares-romana', 'Calamares a la romana', '🍤', 25, 2, 5, ['mariscos'], ['calamar', 'harina', 'huevo', 'limón'], ['ensalada-mixta', 'papas-fritas']),
  d('sardinas', 'Sardinas a la plancha', '🐟', 20, 5, 3, ['pescado'], ['sardinas', 'limón', 'ajo', 'perejil'], ['ensalada-tomate', 'escalivada', 'espinacas-catalana', 'papas-horno', 'pan-tomate']),
  d('suquet', 'Suquet de pescado', '🍲', 45, 4, 4, ['pescado', 'papa'], ['merluza', 'papa', 'tomate', 'almendras', 'caldo de pescado']),
  d('pasta-pesto', 'Pasta al pesto', '🌿', 15, 3, 4, ['pasta'], ['fideos', 'albahaca', 'piñones', 'queso rallado', 'aceite de oliva'], ['ensalada-caprese']),
  d('pasta-puttanesca', 'Pasta puttanesca', '🫒', 20, 3, 4, ['pasta'], ['fideos', 'tomate triturado', 'aceitunas', 'alcaparras', 'anchoas']),
  d('pasta-aglio-olio', 'Espaguetis aglio e olio', '🌶️', 15, 2, 4, ['pasta'], ['fideos', 'ajo', 'aceite de oliva', 'ají molido'], ['ensalada-caprese']),
  d('espaguetis-almejas', 'Espaguetis con almejas', '🐚', 50, 3, 4, ['pasta', 'mariscos'], ['fideos', 'almejas', 'vino blanco', 'ajo', 'perejil']),
  d('pasta-norma', 'Pasta con berenjena a la Norma', '🍝', 50, 3, 4, ['pasta', 'berenjena'], ['fideos', 'berenjena', 'tomate triturado', 'ricota salada', 'albahaca']),
  d('berenjenas-parmesana', 'Berenjenas a la parmesana', '🧀', 75, 3, 4, ['berenjena', 'queso'], ['berenjena', 'tomate triturado', 'mozzarella', 'queso rallado', 'albahaca']),
  d('minestrone', 'Minestrone', '🥣', 45, 5, 3, ['verdura', 'legumbres'], ['zanahoria', 'apio', 'zapallito', 'papa', 'porotos blancos', 'tomate triturado', 'fideos']),
  d('musaka', 'Musaka', '🍆', 100, 3, 5, ['berenjena', 'carne'], ['berenjena', 'carne picada', 'papa', 'tomate triturado', 'leche', 'harina', 'manteca'], ['ensalada-griega']),
  d('souvlaki', 'Souvlaki de cerdo', '🍢', 55, 3, 4, ['cerdo', 'pan'], ['cerdo', 'pan de pita', 'yogur', 'pepino', 'tomate'], ['ensalada-griega', 'papas-fritas']),
  d('tarta-espinaca-feta', 'Tarta de espinaca y feta', '🥧', 70, 4, 4, ['masa', 'verdura', 'queso'], ['masa filo', 'espinaca', 'queso feta', 'huevo', 'cebolla de verdeo']),
  d('tomates-rellenos', 'Tomates rellenos de arroz', '🍅', 90, 4, 3, ['verdura', 'arroz'], ['tomate', 'morrón', 'arroz', 'cebolla', 'papa'], ['ensalada-griega']),
  d('albondigas-griegas', 'Albóndigas griegas', '🍖', 45, 2, 4, ['carne'], ['carne picada', 'pan', 'huevo', 'yogur', 'pepino'], ['ensalada-griega', 'papas-fritas', 'cuscus']),
  d('cordero-horno', 'Cordero al horno', '🐑', 150, 2, 4, ['cordero'], ['cordero', 'limón', 'ajo', 'romero'], ['papas-horno', 'ensalada-griega', 'escalivada', 'espinacas-catalana']),
  d('sopa-lentejas-rojas', 'Sopa de lentejas rojas', '🥣', 30, 5, 3, ['legumbres'], ['lentejas rojas', 'cebolla', 'zanahoria', 'limón']),
  d('falafel', 'Falafel', '🧆', 40, 3, 4, ['legumbres', 'pan'], ['garbanzos secos', 'perejil', 'cebolla', 'pan de pita', 'tahini'], ['hummus', 'tabule', 'ensalada-griega']),
  d('lentejas-arroz', 'Lentejas con arroz', '🍚', 45, 4, 3, ['legumbres', 'arroz'], ['lentejas', 'arroz', 'cebolla', 'yogur']),
  d('shakshuka', 'Shakshuka', '🍳', 25, 4, 4, ['huevo', 'tomate'], ['huevo', 'tomate triturado', 'morrón', 'cebolla', 'pan']),
  d('cuscus-verduras', 'Cuscús con verduras', '🥘', 45, 5, 3, ['cuscús', 'verdura', 'legumbres'], ['cuscús', 'garbanzos', 'zanahoria', 'zapallito', 'calabaza']),
  d('tajin-pollo', 'Tajín de pollo con limón', '🍋', 90, 4, 4, ['pollo'], ['pollo', 'limón', 'aceitunas', 'cebolla'], ['cuscus', 'arroz-blanco']),
  d('ratatouille', 'Ratatouille', '🫑', 60, 5, 3, ['verdura', 'berenjena'], ['berenjena', 'zapallito', 'morrón', 'tomate', 'cebolla'], ['arroz-blanco', 'cuscus', 'huevos-fritos']),
  d('ensalada-nizarda', 'Ensalada nizarda', '🥗', 35, 5, 3, ['verdura', 'pescado', 'huevo'], ['atún', 'huevo', 'papa', 'chauchas', 'tomate', 'aceitunas']),
  d('dorada-horno', 'Dorada al horno con papas', '🐠', 50, 5, 4, ['pescado', 'papa'], ['dorada o lubina', 'papa', 'cebolla', 'vino blanco']),
  d('mejillones-marinera', 'Mejillones a la marinera', '🦪', 30, 4, 4, ['mariscos'], ['mejillones', 'tomate triturado', 'cebolla', 'vino blanco', 'pan']),
  d('pollo-ajillo', 'Pollo al ajillo', '🍗', 40, 3, 4, ['pollo'], ['pollo', 'ajo', 'vino blanco'], ['papas-fritas', 'ensalada-mixta', 'arroz-blanco']),
  d('shawarma-pollo', 'Shawarma de pollo al horno', '🥙', 60, 4, 4, ['pollo', 'pan'], ['pollo', 'pan de pita', 'yogur', 'tahini', 'cebolla morada', 'tomate'], ['hummus', 'tabule', 'papas-fritas']),
  d('canelones', 'Canelones de carne', '🍝', 90, 2, 5, ['pasta', 'carne'], ['placas de canelones', 'carne picada', 'leche', 'harina', 'manteca', 'queso rallado'], ['ensalada-mixta']),
  d('arroz-horno', 'Arroz al horno', '🥘', 60, 3, 4, ['arroz', 'cerdo', 'legumbres'], ['arroz', 'costillas de cerdo', 'morcilla', 'garbanzos', 'papa', 'tomate']),
  d('tajin-kefta', 'Tajín de albóndigas con huevo', '🍳', 40, 3, 4, ['carne', 'huevo'], ['carne picada', 'tomate triturado', 'huevo', 'cebolla', 'pan']),
  d('gigantes-horno', 'Porotos al horno a la griega', '🫘', 65, 5, 3, ['legumbres'], ['porotos pallares', 'tomate triturado', 'cebolla', 'zanahoria', 'queso feta']),

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

  // Mediterranean sides (v8, #36). They go with the new mains, and with tortilla de papas (SIDES_IN_V8).
  side('pan-tomate', 'Pan con tomate', '🍞', 10, 3, 4, ['pan'], ['pan', 'tomate', 'aceite de oliva']),
  side('escalivada', 'Escalivada', '🫑', 70, 5, 4, ['verdura'], ['berenjena', 'morrón', 'cebolla']),
  side('espinacas-catalana', 'Espinacas a la catalana', '🥬', 15, 5, 3, ['verdura'], ['espinaca', 'pasas de uva', 'piñones']),
  side('ensalada-griega', 'Ensalada griega', '🥗', 10, 4, 4, ['verdura', 'queso'], ['tomate', 'pepino', 'cebolla morada', 'aceitunas', 'queso feta']),
  side('ensalada-caprese', 'Ensalada caprese', '🍅', 5, 4, 4, ['tomate', 'queso'], ['tomate', 'mozzarella', 'albahaca']),
  side('hummus', 'Hummus', '🫘', 10, 4, 4, ['legumbres'], ['garbanzos', 'tahini', 'limón']),
  side('tabule', 'Tabulé', '🌿', 25, 5, 3, ['verdura'], ['bulgur', 'perejil', 'tomate', 'menta', 'limón']),
  side('cuscus', 'Cuscús', '🌾', 10, 3, 3, ['cuscús'], ['cuscús']),
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
export const starterEffort = (id) => STARTER_EFFORT[id];

/** Starter dishes that v3 adds to existing data. */
export const NEW_IN_V3 = [
  'croquetas-arroz', 'salchichas', 'patitas-pollo', 'huevos-fritos', 'bife-plancha', 'pechuga-plancha', 'fideos-manteca',
  'pure', 'pure-calabaza', 'ensalada-mixta', 'ensalada-tomate', 'papas-fritas', 'papas-horno', 'batatas-horno', 'arroz-blanco', 'verduras-vapor',
];

/**
 * The v5 starter dishes that v6 changes (#30), by their v5 name. The v5 → v6
 * migration only changes a dish that still has that name, and gives it its
 * sides only if it has none (an edited dish is the user's, and stays):
 * milanesas de berenjena get sides, lentejas become "Guiso de lentejas".
 */
export const CHANGED_IN_V6 = {
  'milanesas-berenjena': 'Milanesas de berenjena',
  lentejas: 'Lentejas',
};

/** Starter dishes that v6 adds to existing data. */
export const NEW_IN_V6 = ['pulled-pork'];

/** Starter dishes that v8 adds to existing data (#36): the Mediterranean ones. */
export const NEW_IN_V8 = [
  'fideua', 'arroz-negro', 'butifarra-judias', 'salmorejo', 'gambas-ajillo', 'calamares-romana', 'sardinas', 'suquet',
  'pasta-pesto', 'pasta-puttanesca', 'pasta-aglio-olio', 'espaguetis-almejas', 'pasta-norma', 'berenjenas-parmesana', 'minestrone',
  'musaka', 'souvlaki', 'tarta-espinaca-feta', 'tomates-rellenos', 'albondigas-griegas', 'cordero-horno',
  'sopa-lentejas-rojas', 'falafel', 'lentejas-arroz', 'shakshuka', 'cuscus-verduras', 'tajin-pollo', 'ratatouille', 'ensalada-nizarda',
  'dorada-horno', 'mejillones-marinera', 'pollo-ajillo', 'shawarma-pollo', 'canelones', 'arroz-horno', 'tajin-kefta', 'gigantes-horno',
  'pan-tomate', 'escalivada', 'espinacas-catalana', 'ensalada-griega', 'ensalada-caprese', 'hummus', 'tabule', 'cuscus',
];

/**
 * Older starter dishes that v8 gives sides to (#36): tortilla de papas goes
 * with pan con tomate. As in v6, only a dish that still has its starter name
 * and no sides gets them (an edited dish is the user's, and stays).
 */
export const SIDES_IN_V8 = ['tortilla-papas'];
