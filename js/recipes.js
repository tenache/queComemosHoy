// Recipes for the starter dishes: short, home-style, written for this app.
// Amounts are for `serves` portions; grams are what the macros are counted
// from (oil for frying counts what the food absorbs, not what's in the pan).
// A dish the user gave a recipe of their own uses that one instead.

import { CHANGED_IN_V6, STARTER_DISHES } from './dishes.js';

/** An ingredient line: FOODS key, grams for the whole recipe, label, and grams per unit for countable things. */
const x = (food, grams, text, each) => (each ? { text, grams, food, each } : { text, grams, food });
/** A line with no amount that counts for nothing (salt, spices). */
const s = (text) => ({ text });
const r = (serves, items, steps) => ({ serves, items, steps });

const FRY = 'aceite (lo que absorbe al freír)';

export const STARTER_RECIPES = {
  'fideos-huevo': r(2, [x('fideos', 200, 'fideos secos'), x('huevo', 100, 'huevos', 50), x('aceite', 10, 'aceite'), x('queso rallado', 20, 'queso rallado'), s('sal')], [
    'Herví los fideos en agua con sal el tiempo que diga el paquete.',
    'Mientras, freí los huevos en una sartén con el aceite, con la yema blanda.',
    'Colá los fideos, serví un huevo arriba de cada plato y terminá con queso rallado.',
  ]),
  'tortilla-papas': r(2, [x('papa', 600, 'papas', 200), x('huevo', 200, 'huevos', 50), x('cebolla', 150, 'cebolla', 150), x('aceite', 40, FRY), s('sal')], [
    'Pelá las papas y cortalas en láminas finas; la cebolla, en tiras.',
    'Cocinalas a fuego medio en bastante aceite hasta que estén tiernas, sin dorar. Escurrilas.',
    'Batí los huevos con sal, mezclalos con las papas y dejá reposar 5 minutos.',
    'Volcá todo en una sartén con un hilo de aceite y cociná 5 minutos a fuego bajo.',
    'Dala vuelta con un plato y cociná 2 o 3 minutos más.',
  ]),
  'milanesas-berenjena': r(2, [x('berenjena', 300, 'berenjena', 300), x('huevo', 100, 'huevos', 50), x('pan rallado', 80, 'pan rallado'), x('aceite', 30, FRY), s('ajo, perejil y sal')], [
    'Cortá la berenjena en rodajas de 1 cm, salalas y dejalas 15 minutos. Secalas con papel.',
    'Pasalas por los huevos batidos con ajo y perejil picados, y después por pan rallado.',
    'Freílas hasta dorar de los dos lados, o hacelas al horno fuerte 20 minutos dándolas vuelta una vez.',
  ]),
  'pollo-curry': r(2, [x('pollo', 400, 'pollo (pata muslo sin piel, en cubos)'), x('arroz', 150, 'arroz'), x('cebolla', 150, 'cebolla', 150), x('crema', 100, 'crema de leche'), x('aceite', 15, 'aceite'), s('curry (2 cucharadas) y sal')], [
    'Poné a hervir el arroz en agua con sal.',
    'Rehogá la cebolla picada en el aceite hasta que esté transparente.',
    'Sumá el pollo y doralo. Agregá el curry y revolvé un minuto.',
    'Echá la crema y medio vaso de agua, y cociná 15 minutos a fuego bajo.',
    'Serví el curry sobre el arroz.',
  ]),
  'sopa-pollo': r(2, [x('pollo', 300, 'pollo (presas con hueso)'), x('zanahoria', 160, 'zanahorias', 80), x('cebolla', 150, 'cebolla', 150), x('apio', 60, 'apio'), x('fideos', 60, 'fideos cabello de ángel o municiones'), s('agua (1,5 litros), sal y pimienta')], [
    'Poné el pollo en una olla con el agua fría y sal, y llevá a hervor. Sacá la espuma.',
    'Agregá la zanahoria, la cebolla y el apio picados, y cociná 35 minutos a fuego bajo.',
    'Sacá el pollo, desmenuzalo sin piel ni huesos y devolvelo a la olla.',
    'Sumá los fideos y cociná lo que diga el paquete.',
  ]),
  lentejas: r(2, [x('lentejas', 160, 'lentejas secas'), x('cebolla', 150, 'cebolla', 150), x('zanahoria', 80, 'zanahoria', 80), x('papa', 200, 'papa', 200), x('tomate triturado', 100, 'tomate triturado'), x('aceite', 15, 'aceite'), s('pimentón, laurel y sal')], [
    'Lavá las lentejas (si son de las que lo piden, remojalas 1 hora).',
    'Rehogá la cebolla y la zanahoria picadas en el aceite. Sumá el pimentón y el tomate.',
    'Agregá las lentejas, la papa en cubos, el laurel y agua que las cubra de sobra.',
    'Cociná 35 a 40 minutos a fuego bajo, hasta que estén tiernas. Salá al final.',
  ]),
  'pato-naranja': r(2, [x('pato', 600, 'pato (dos presas)'), x('naranja', 200, 'jugo de naranja'), x('azucar', 30, 'azúcar'), x('manteca', 20, 'manteca'), x('vino', 100, 'vino blanco'), x('caldo', 200, 'caldo'), s('sal y pimienta')], [
    'Marcá la piel del pato en rombos, salpimentá y dorala en una sartén sin aceite, del lado de la piel, 8 minutos.',
    'Pasalo a una fuente y terminá en horno a 180 °C, 20 minutos las pechugas o 90 las patas.',
    'En una olla, derretí el azúcar hasta caramelo claro. Sumá el vino, el jugo y el caldo.',
    'Reducí a la mitad y terminá la salsa con la manteca, fuera del fuego.',
    'Cortá el pato en láminas y servilo con la salsa.',
  ]),
  'milanesas-pure': r(2, [x('carne magra', 300, 'carne (nalga, en bifes finos)'), x('huevo', 50, 'huevo', 50), x('pan rallado', 60, 'pan rallado'), x('aceite', 30, FRY), s('ajo, perejil y sal')], [
    'Si los bifes son gruesos, aplanalos entre dos papeles con un palo de amasar.',
    'Batí el huevo con ajo y perejil picados y sal. Pasá cada bife por el huevo y después por pan rallado, apretando bien.',
    'Freílas en aceite caliente, 2 o 3 minutos por lado, hasta que estén doradas. Escurrilas en papel.',
    'Si preferís, hacelas al horno fuerte con un hilo de aceite, 10 minutos por lado.',
  ]),
  'ravioles-tuco': r(2, [x('ravioles', 400, 'ravioles frescos'), x('tomate triturado', 300, 'tomate triturado'), x('cebolla', 100, 'cebolla'), x('ajo', 5, 'diente de ajo', 5), x('aceite', 15, 'aceite'), x('queso rallado', 20, 'queso rallado'), s('orégano, laurel y sal')], [
    'Rehogá la cebolla y el ajo picados en el aceite.',
    'Sumá el tomate, el orégano, el laurel y sal, y cociná el tuco 20 minutos a fuego bajo.',
    'Herví los ravioles en abundante agua con sal, 4 o 5 minutos.',
    'Escurrilos con cuidado y servilos con el tuco y el queso rallado.',
  ]),
  noquis: r(2, [x('noquis', 500, 'ñoquis de papa'), x('tomate triturado', 300, 'tomate triturado'), x('aceite', 10, 'aceite'), x('queso rallado', 20, 'queso rallado'), s('ajo, albahaca y sal')], [
    'Cociná el tomate con el aceite, ajo y sal 15 minutos.',
    'Herví los ñoquis en abundante agua con sal: están listos cuando suben a la superficie.',
    'Sacalos con espumadera, mezclalos con la salsa y terminá con albahaca y queso.',
  ]),
  'arroz-atun': r(2, [x('arroz', 150, 'arroz'), x('atun', 120, 'atún al natural (escurrido)'), x('huevo', 100, 'huevos', 50), x('aceite', 10, 'aceite'), x('limon', 20, 'jugo de limón'), s('sal')], [
    'Herví el arroz en agua con sal y los huevos en otra olla, 10 minutos.',
    'Colá el arroz y enfrialo bajo la canilla si lo querés frío.',
    'Mezclalo con el atún, los huevos picados, el aceite y el limón.',
  ]),
  'tarta-jamon-queso': r(4, [x('masa', 400, 'tapas de tarta (2)'), x('jamon', 200, 'jamón cocido'), x('queso', 250, 'queso cremoso o mozzarella'), x('huevo', 150, 'huevos', 50), s('pimienta y nuez moscada')], [
    'Prendé el horno a 200 °C y forrá una tartera con una tapa.',
    'Batí los huevos con pimienta y nuez moscada.',
    'Armá capas de jamón y queso, y echá los huevos por encima.',
    'Tapá con la otra tapa, cerrá los bordes, pinchala y horneá 30 a 35 minutos.',
  ]),
  'tarta-acelga': r(4, [x('masa', 400, 'tapas de tarta (2)'), x('acelga', 800, 'acelga'), x('cebolla', 150, 'cebolla', 150), x('huevo', 150, 'huevos', 50), x('queso rallado', 50, 'queso rallado'), x('aceite', 15, 'aceite'), s('sal, pimienta y nuez moscada')], [
    'Lavá la acelga, hervila 3 minutos, escurrila muy bien y picala.',
    'Rehogá la cebolla en el aceite y mezclala con la acelga, los huevos, el queso y los condimentos.',
    'Forrá la tartera con una tapa, rellená y tapá con la otra.',
    'Horneá a 200 °C 35 minutos, hasta que esté dorada.',
  ]),
  'empanadas-carne': r(4, [x('masa', 360, 'tapas de empanada (12)'), x('carne picada', 500, 'carne picada'), x('cebolla', 300, 'cebollas', 150), x('huevo', 100, 'huevos duros', 50), x('aceitunas', 50, 'aceitunas verdes'), x('aceite', 20, 'aceite'), s('pimentón, comino, ají molido y sal')], [
    'Rehogá la cebolla picada en el aceite. Sumá la carne y cociná hasta que pierda el color rosado.',
    'Condimentá con pimentón, comino, ají y sal. Dejá enfriar el relleno (mejor de un día para el otro).',
    'Rellená cada tapa con una cucharada, un pedazo de huevo duro y una aceituna, y cerralas con repulgue.',
    'Horneá a 220 °C 15 a 20 minutos, hasta que estén doradas.',
  ]),
  pizza: r(4, [x('harina', 500, 'harina 000'), x('levadura', 10, 'levadura seca'), x('aceite', 30, 'aceite'), x('tomate triturado', 300, 'tomate triturado'), x('queso', 400, 'mozzarella'), s('agua tibia (300 ml), sal y orégano')], [
    'Mezclá la harina, la levadura, la sal, el aceite y el agua tibia, y amasá 10 minutos.',
    'Dejá levar tapado 1 hora, hasta que duplique.',
    'Estirá en dos pizzeras aceitadas, cubrí con el tomate condimentado y horneá a 220 °C 12 minutos.',
    'Sumá la mozzarella y el orégano, y horneá 8 minutos más.',
  ]),
  'polenta-tuco': r(2, [x('polenta', 200, 'polenta instantánea'), x('tomate triturado', 300, 'tomate triturado'), x('cebolla', 100, 'cebolla'), x('aceite', 15, 'aceite'), x('queso rallado', 40, 'queso rallado'), s('agua (800 ml) y sal')], [
    'Hacé un tuco rápido: cebolla rehogada en el aceite, tomate y sal, 15 minutos.',
    'Herví el agua con sal, echá la polenta en lluvia y revolvé 2 o 3 minutos hasta que espese.',
    'Serví la polenta con el tuco y el queso rallado.',
  ]),
  'guiso-fideos': r(4, [x('carne magra', 400, 'carne para guiso (en cubos)'), x('fideos', 250, 'fideos mostacholes o tirabuzones'), x('papa', 400, 'papas', 200), x('zanahoria', 160, 'zanahorias', 80), x('tomate triturado', 300, 'tomate triturado'), x('cebolla', 150, 'cebolla', 150), x('aceite', 20, 'aceite'), s('pimentón, laurel, caldo y sal')], [
    'Dorá la carne en el aceite en una olla grande. Sumá la cebolla y la zanahoria picadas.',
    'Agregá el tomate, el pimentón, el laurel y 1,5 litros de caldo. Cociná 30 minutos.',
    'Sumá las papas en cubos y, a los 10 minutos, los fideos.',
    'Cociná hasta que los fideos estén a punto, agregando caldo si hace falta.',
  ]),
  'pollo-horno-papas': r(2, [x('pollo', 450, 'pollo (2 pata muslos)'), x('limon', 30, 'jugo de limón'), x('ajo', 15, 'dientes de ajo', 5), x('aceite', 10, 'aceite'), s('romero, sal y pimienta')], [
    'Prendé el horno a 200 °C.',
    'Frotá el pollo con el ajo picado, el limón, el aceite, romero, sal y pimienta.',
    'Horneá 50 a 60 minutos, dándolo vuelta a mitad de camino, hasta que la piel esté dorada.',
  ]),
  'ensalada-completa': r(2, [x('lechuga', 150, 'lechuga'), x('tomate', 240, 'tomates', 120), x('huevo', 100, 'huevos duros', 50), x('zanahoria', 80, 'zanahoria rallada', 80), x('atun', 120, 'atún al natural (escurrido)'), x('aceite', 20, 'aceite'), x('vinagre', 10, 'vinagre'), s('sal')], [
    'Herví los huevos 10 minutos y pelalos.',
    'Lavá y cortá la lechuga y los tomates; rallá la zanahoria.',
    'Armá la ensalada con el atún y los huevos en cuartos, y condimentá con aceite, vinagre y sal.',
  ]),
  'revuelto-zapallitos': r(2, [x('zapallito', 600, 'zapallitos', 200), x('huevo', 200, 'huevos', 50), x('cebolla', 150, 'cebolla', 150), x('queso rallado', 30, 'queso rallado'), x('aceite', 15, 'aceite'), s('sal y pimienta')], [
    'Rehogá la cebolla picada en el aceite.',
    'Sumá los zapallitos en cubos y cociná 10 minutos, hasta que estén tiernos.',
    'Agregá los huevos batidos con el queso y revolvé a fuego bajo hasta que cuajen.',
  ]),
  hamburguesas: r(2, [x('carne picada', 300, 'carne picada'), x('pan de hamburguesa', 120, 'panes de hamburguesa', 60), x('queso', 40, 'queso en fetas'), x('lechuga', 30, 'lechuga'), x('tomate', 120, 'tomate', 120), x('aceite', 5, 'aceite'), s('sal y pimienta')], [
    'Armá dos medallones con la carne, sin apretar mucho, y salpimentalos.',
    'Cocinalos en una plancha bien caliente con el aceite, 3 o 4 minutos por lado. Al final, poné el queso encima.',
    'Tostá los panes y armá las hamburguesas con lechuga y tomate.',
  ]),
  'fajitas-pollo': r(2, [x('pechuga', 400, 'pechuga de pollo en tiras'), x('tortillas', 240, 'tortillas de trigo', 40), x('morron', 150, 'morrón', 150), x('cebolla', 150, 'cebolla', 150), x('aceite', 15, 'aceite'), x('limon', 20, 'jugo de limón'), s('comino, pimentón y sal')], [
    'Condimentá el pollo con comino, pimentón, sal y el limón.',
    'Saltealo en una sartén bien caliente con el aceite, 5 minutos.',
    'Sumá el morrón y la cebolla en tiras, y cociná 5 minutos más, que queden un poco crocantes.',
    'Calentá las tortillas y rellenalas en la mesa.',
  ]),
  'merluza-ensalada': r(2, [x('merluza', 400, 'filetes de merluza'), x('limon', 30, 'jugo de limón'), x('ajo', 5, 'diente de ajo', 5), x('aceite', 15, 'aceite'), s('perejil, sal y pimienta')], [
    'Prendé el horno a 200 °C y aceitá una fuente.',
    'Acomodá los filetes, rociálos con el limón y el aceite, y poné ajo y perejil picados por encima.',
    'Horneá 12 a 15 minutos, hasta que el pescado se separe en lajas.',
  ]),
  paella: r(4, [x('arroz', 320, 'arroz (mejor de grano corto)'), x('pollo', 400, 'pollo en presas chicas'), x('mariscos', 400, 'mariscos'), x('morron', 150, 'morrón', 150), x('arvejas', 100, 'arvejas'), x('tomate triturado', 100, 'tomate triturado'), x('aceite', 40, 'aceite de oliva'), x('caldo', 1000, 'caldo'), s('azafrán o colorante, pimentón y sal')], [
    'En una paellera o sartén grande, dorá el pollo en el aceite. Sumá el morrón en tiras.',
    'Agregá el tomate y el pimentón, y después el arroz, revolviendo un minuto.',
    'Echá el caldo caliente con el azafrán y no revuelvas más. Cociná 10 minutos a fuego fuerte.',
    'Repartí los mariscos y las arvejas por encima y cociná 8 a 10 minutos a fuego bajo.',
    'Apagá, tapá con un repasador y dejá reposar 5 minutos.',
  ]),
  gazpacho: r(2, [x('tomate', 800, 'tomates bien maduros', 120), x('pepino', 150, 'pepino'), x('morron', 75, 'morrón'), x('pan', 50, 'pan del día anterior'), x('ajo', 5, 'diente de ajo', 5), x('aceite', 30, 'aceite de oliva'), x('vinagre', 15, 'vinagre'), s('sal')], [
    'Cortá todo en trozos y remojá el pan en un poco de agua.',
    'Procesá todo con el aceite, el vinagre y sal hasta que quede liso.',
    'Pasalo por un colador si lo querés fino, y enfrialo al menos 1 hora.',
  ]),
  'garbanzos-espinaca': r(2, [x('garbanzos', 500, 'garbanzos cocidos (escurridos)'), x('espinaca', 300, 'espinaca'), x('ajo', 10, 'dientes de ajo', 5), x('aceite', 20, 'aceite de oliva'), s('pimentón, comino y sal')], [
    'Dorá el ajo en láminas en el aceite. Sumá el pimentón y el comino un instante.',
    'Agregá la espinaca y dejala bajar.',
    'Sumá los garbanzos y un chorrito de agua, y cociná 10 minutos. Salá a gusto.',
  ]),
  tostado: r(2, [x('pan', 160, 'pan lactal (4 fetas grandes)'), x('jamon', 80, 'jamón cocido'), x('queso', 80, 'queso en fetas'), x('manteca', 10, 'manteca')], [
    'Armá dos sándwiches de jamón y queso.',
    'Untá el pan por fuera con manteca.',
    'Tostalos en una sandwichera o sartén, aplastando, hasta que el queso se derrita.',
  ]),
  omelette: r(2, [x('huevo', 200, 'huevos', 50), x('queso', 60, 'queso'), x('leche', 20, 'leche'), x('manteca', 10, 'manteca'), s('sal y pimienta')], [
    'Batí los huevos con la leche, sal y pimienta.',
    'Derretí la manteca en una sartén a fuego medio y echá los huevos.',
    'Cuando estén casi cuajados, poné el queso en una mitad, doblá y serví.',
  ]),
  'wok-verduras': r(2, [x('arroz', 150, 'arroz'), x('brocoli', 250, 'brócoli'), x('zanahoria', 160, 'zanahorias', 80), x('morron', 150, 'morrón', 150), x('salsa de soja', 30, 'salsa de soja'), x('aceite', 20, 'aceite'), s('ajo y jengibre')], [
    'Herví el arroz en agua con sal.',
    'Cortá las verduras en trozos chicos y parejos.',
    'Saltealas en el aceite bien caliente con ajo y jengibre, 5 a 6 minutos, revolviendo siempre.',
    'Sumá la salsa de soja y el arroz, y salteá un minuto más.',
  ]),
  asado: r(4, [x('asado', 1000, 'tira de asado'), x('chorizo', 400, 'chorizos', 100), x('pan', 200, 'pan'), x('lechuga', 150, 'lechuga'), x('tomate', 240, 'tomates', 120), x('aceite', 15, 'aceite para la ensalada'), s('carbón o leña, sal gruesa')], [
    'Prendé el fuego y esperá a tener brasas, unos 40 minutos.',
    'Poné la parrilla a unos 15 cm de las brasas. Los chorizos van primero.',
    'Salá el asado con sal gruesa y ponelo del lado del hueso, a fuego suave, 1 hora.',
    'Dalo vuelta y cociná 20 a 30 minutos más.',
    'Mientras, armá la ensalada de lechuga y tomate.',
  ]),
  'cerdo-batatas': r(2, [x('cerdo', 500, 'bondiola de cerdo'), x('vino', 100, 'vino blanco'), x('ajo', 15, 'dientes de ajo', 5), x('aceite', 10, 'aceite'), s('romero, pimentón y sal')], [
    'Frotá la bondiola con el ajo picado, el aceite, el pimentón, el romero y sal.',
    'Ponela en una fuente con el vino y tapala con papel de aluminio.',
    'Horneá a 180 °C 50 minutos, destapá y horneá 15 más para dorar.',
    'Dejala reposar 5 minutos antes de cortar.',
  ]),
  'zapallitos-rellenos': r(2, [x('zapallito', 800, 'zapallitos redondos', 200), x('carne picada', 250, 'carne picada'), x('cebolla', 150, 'cebolla', 150), x('queso', 80, 'queso'), x('pan rallado', 20, 'pan rallado'), x('aceite', 10, 'aceite'), s('sal y pimienta')], [
    'Herví los zapallitos enteros 8 minutos. Cortales una tapa y vaciá la pulpa con una cuchara.',
    'Rehogá la cebolla en el aceite, sumá la carne y la pulpa picada, y cociná 10 minutos.',
    'Rellená los zapallitos, poné el queso y el pan rallado arriba.',
    'Horneá a 200 °C 20 minutos, hasta gratinar.',
  ]),

  // Very simple mains
  'croquetas-arroz': r(2, [x('arroz', 140, 'arroz'), x('huevo', 100, 'huevos', 50), x('queso', 60, 'queso en cubitos'), x('pan rallado', 60, 'pan rallado'), x('aceite', 25, FRY), s('sal y pimienta')], [
    'Herví el arroz bien cocido, colalo y dejalo enfriar (sirve el que sobró).',
    'Mezclalo con un huevo, sal y pimienta. Armá bolitas con un cubito de queso adentro.',
    'Pasalas por el otro huevo batido y por pan rallado.',
    'Freílas hasta que estén doradas, o hacelas al horno fuerte 20 minutos.',
  ]),
  salchichas: r(2, [x('salchicha', 240, 'salchichas', 40)], [
    'Herví agua y apagá el fuego.',
    'Poné las salchichas 5 minutos en el agua caliente, o doralas en una sartén.',
  ]),
  'patitas-pollo': r(2, [x('patitas', 300, 'patitas o medallones de pollo (congelados)')], [
    'Prendé el horno a 200 °C.',
    'Acomodá las patitas en una fuente y horneá 15 a 20 minutos, dándolas vuelta a mitad de camino.',
  ]),
  'huevos-fritos': r(2, [x('huevo', 200, 'huevos', 50), x('aceite', 20, FRY), s('sal')], [
    'Calentá el aceite en una sartén a fuego medio.',
    'Rompé los huevos de a uno en un plato y deslizalos a la sartén.',
    'Bañá la clara con el aceite con una cuchara hasta que cuaje, con la yema blanda. Salá.',
  ]),
  'bife-plancha': r(2, [x('carne magra', 400, 'bifes de cuadril o nalga'), x('aceite', 5, 'aceite'), s('sal gruesa')], [
    'Sacá los bifes de la heladera 15 minutos antes.',
    'Calentá la plancha o sartén hasta que humee, con unas gotas de aceite.',
    'Cociná los bifes 2 a 4 minutos por lado, según el punto. Salá al final.',
  ]),
  'pechuga-plancha': r(2, [x('pechuga', 400, 'pechugas de pollo'), x('limon', 20, 'jugo de limón'), x('aceite', 10, 'aceite'), s('ajo, orégano y sal')], [
    'Abrí las pechugas al medio para que queden finas.',
    'Condimentalas con el limón, ajo, orégano y sal.',
    'Cocinalas en una plancha caliente con el aceite, 4 a 5 minutos por lado.',
  ]),
  'fideos-manteca': r(2, [x('fideos', 200, 'fideos secos'), x('manteca', 30, 'manteca'), x('queso rallado', 30, 'queso rallado'), s('sal')], [
    'Herví los fideos en agua con sal el tiempo que diga el paquete.',
    'Colalos y mezclalos enseguida con la manteca y el queso rallado.',
  ]),
  'pulled-pork': r(2, [x('cerdo', 500, 'bondiola de cerdo'), x('pan de hamburguesa', 240, 'panes de hamburguesa', 60), x('azucar', 10, 'azúcar'), s('pimentón, comino, sal y pimienta'), s('mostaza, salsa romesco o palta, a elección')], [
    'Conviene hacer una pieza grande: rinde para todos y lo que sobra se congela.',
    'Frotá la bondiola con el azúcar, el pimentón, el comino, sal y pimienta.',
    'Ponela en una fuente con un vaso de agua, tapada con papel de aluminio, y horneá a 150 °C hasta que se deshaga con un tenedor: unas 4 horas una pieza de 1,5 a 2 kg, unas 2 horas y media una de medio kilo (en olla lenta, el doble).',
    'Desmechala con dos tenedores y mezclala con el jugo de la fuente.',
    'Tostá los panes y armá los sándwiches con mostaza, salsa romesco o palta, a elección.',
  ]),

  // Sides
  pure: r(2, [x('papa', 500, 'papas', 200), x('leche', 100, 'leche'), x('manteca', 20, 'manteca'), s('sal y nuez moscada')], [
    'Pelá las papas, cortalas en trozos y hervilas en agua con sal 20 minutos, hasta que estén tiernas.',
    'Colalas y pisalas en caliente.',
    'Sumá la manteca y la leche caliente, y batí con cuchara de madera. Condimentá con sal y nuez moscada.',
  ]),
  'pure-calabaza': r(2, [x('calabaza', 700, 'calabaza'), x('manteca', 15, 'manteca'), s('sal y nuez moscada')], [
    'Pelá la calabaza, cortala en trozos y hervila o cocinala al vapor 15 a 20 minutos.',
    'Colala bien y pisala con la manteca, sal y nuez moscada.',
  ]),
  'ensalada-mixta': r(2, [x('lechuga', 100, 'lechuga'), x('tomate', 240, 'tomates', 120), x('cebolla', 40, 'cebolla'), x('aceite', 20, 'aceite'), x('vinagre', 10, 'vinagre'), s('sal')], [
    'Lavá y secá la lechuga, y cortala en trozos.',
    'Cortá los tomates en gajos y la cebolla en pluma fina.',
    'Condimentá en el momento con aceite, vinagre y sal.',
  ]),
  'ensalada-tomate': r(2, [x('tomate', 360, 'tomates', 120), x('cebolla', 50, 'cebolla'), x('aceite', 15, 'aceite'), s('orégano y sal')], [
    'Cortá los tomates en rodajas y la cebolla en pluma fina.',
    'Condimentá con aceite, orégano y sal.',
  ]),
  'papas-fritas': r(2, [x('papa', 500, 'papas', 200), x('aceite', 40, FRY), s('sal')], [
    'Pelá las papas y cortalas en bastones parejos. Lavalas y secalas muy bien.',
    'Freílas en aceite a fuego medio 6 a 7 minutos, sin que se doren. Sacalas.',
    'Subí el fuego y volvé a freírlas 2 o 3 minutos, hasta que estén doradas y crocantes. Salá.',
  ]),
  'papas-horno': r(2, [x('papa', 600, 'papas', 200), x('aceite', 20, 'aceite'), s('romero, ajo y sal')], [
    'Prendé el horno a 220 °C.',
    'Cortá las papas en gajos (con cáscara, bien lavadas) y mezclalas con el aceite, romero, ajo y sal.',
    'Horneá 40 minutos en una sola capa, dándolas vuelta a mitad de camino.',
  ]),
  'batatas-horno': r(2, [x('batata', 500, 'batatas', 250), x('aceite', 15, 'aceite'), s('sal y pimentón')], [
    'Prendé el horno a 200 °C.',
    'Cortá las batatas en rodajas o bastones y mezclalas con el aceite, sal y pimentón.',
    'Horneá 35 a 40 minutos, hasta que estén tiernas y doradas en los bordes.',
  ]),
  'arroz-blanco': r(2, [x('arroz', 150, 'arroz'), x('aceite', 5, 'aceite'), s('sal')], [
    'Herví abundante agua con sal.',
    'Sumá el arroz y cociná el tiempo que diga el paquete, unos 15 minutos.',
    'Colalo y mezclalo con el aceite.',
  ]),
  'verduras-vapor': r(2, [x('brocoli', 200, 'brócoli'), x('zanahoria', 160, 'zanahorias', 80), x('zapallito', 200, 'zapallito', 200), x('aceite', 10, 'aceite de oliva'), x('limon', 15, 'jugo de limón'), s('sal')], [
    'Cortá todo en trozos parejos.',
    'Cocinalo al vapor 8 a 10 minutos: la zanahoria primero, el resto 3 minutos después.',
    'Condimentá con aceite, limón y sal.',
  ]),

  // ---- Mediterranean (v8, #36) ----
  fideua: r(2, [x('fideos', 200, 'fideos finos (de fideuá)'), x('mariscos', 200, 'langostinos'), x('mariscos', 150, 'calamar en anillos'), x('tomate triturado', 100, 'tomate triturado'), x('aceite', 30, 'aceite de oliva'), s('caldo de pescado (medio litro), ajo, pimentón, azafrán y sal')], [
    'En una paellera o sartén grande, dorá los fideos con la mitad del aceite, revolviendo, hasta que estén tostados. Sacalos.',
    'En el resto del aceite dorá los langostinos y sacalos. Rehogá el calamar con el ajo picado, sumá el tomate y el pimentón y cociná 5 minutos.',
    'Volvé a poner los fideos, echá el caldo caliente con el azafrán y sal, y cociná a fuego medio unos 10 minutos, sin revolver, hasta que se absorba.',
    'Poné los langostinos arriba, dejá reposar 5 minutos y serví, si te gusta, con alioli.',
  ]),
  'arroz-negro': r(2, [x('arroz', 160, 'arroz (redondo o bomba)'), x('mariscos', 300, 'calamar o sepia en trozos'), x('cebolla', 150, 'cebolla', 150), x('tomate triturado', 100, 'tomate triturado'), x('aceite', 30, 'aceite de oliva'), s('caldo de pescado (medio litro), tinta de calamar (2 sobres), ajo y sal')], [
    'Rehogá la cebolla y el ajo picados en el aceite. Sumá el calamar y cocinalo hasta que suelte su agua y se seque.',
    'Agregá el tomate y cociná 5 minutos. Sumá el arroz y revolvé un minuto.',
    'Echá el caldo caliente con la tinta disuelta, salá y cociná 18 minutos sin revolver: fuerte los primeros 10, bajo el resto.',
    'Dejá reposar 5 minutos tapado. Va muy bien con alioli.',
  ]),
  'butifarra-judias': r(2, [x('butifarra', 300, 'butifarras', 150), x('porotos', 400, 'judías blancas cocidas (escurridas)'), x('aceite', 15, 'aceite de oliva'), s('ajo, perejil y sal')], [
    'Pinchá las butifarras y cocinalas en una sartén con un hilo de aceite, a fuego medio, 12 a 15 minutos, dándolas vuelta.',
    'Sacalas y, en la misma sartén, saltá las judías con el ajo picado hasta que se doren un poco.',
    'Terminá con perejil y serví las butifarras sobre las judías. En Cataluña van con alioli.',
  ]),
  salmorejo: r(2, [x('tomate', 600, 'tomates maduros', 120), x('pan', 100, 'pan del día anterior'), x('aceite', 50, 'aceite de oliva'), x('huevo', 50, 'huevo duro', 50), x('jamon', 40, 'jamón crudo picado'), s('ajo y sal')], [
    'Procesá los tomates con el pan, medio diente de ajo y sal hasta que no queden trozos.',
    'Con la procesadora andando, sumá el aceite de a poco: tiene que quedar una crema espesa.',
    'Enfrialo al menos una hora en la heladera.',
    'Serví con el huevo duro y el jamón picados por arriba.',
  ]),
  'gambas-ajillo': r(2, [x('mariscos', 400, 'gambas o langostinos pelados'), x('ajo', 20, 'dientes de ajo', 5), x('aceite', 40, 'aceite de oliva'), x('pan', 120, 'pan para mojar'), s('guindilla o ají molido, perejil y sal')], [
    'Calentá el aceite en una cazuela de barro o sartén chica, a fuego medio, con el ajo en láminas y la guindilla.',
    'Cuando el ajo empiece a dorarse, sumá las gambas con sal y cocinalas 2 o 3 minutos, hasta que cambien de color.',
    'Terminá con perejil picado y serví enseguida, en la misma cazuela, con pan para mojar.',
  ]),
  'calamares-romana': r(2, [x('mariscos', 400, 'calamar en anillos'), x('harina', 60, 'harina'), x('huevo', 50, 'huevo', 50), x('aceite', 40, FRY), s('limón y sal')], [
    'Secá bien los anillos de calamar con papel y salalos.',
    'Pasalos por harina, después por el huevo batido, y freílos en tandas en aceite bien caliente, 1 o 2 minutos, hasta dorar.',
    'Escurrilos en papel y servilos enseguida, con limón.',
  ]),
  sardinas: r(2, [x('sardinas', 800, 'sardinas frescas enteras'), x('aceite', 15, 'aceite de oliva'), s('limón, ajo, perejil y sal gruesa')], [
    'Si no vienen limpias, sacales las tripas y enjuagalas (las escamas salen frotando con los dedos bajo la canilla).',
    'Secalas, pincelalas con aceite y poneles sal gruesa.',
    'Hacelas en una plancha o sartén bien caliente, 2 o 3 minutos por lado.',
    'Serví con limón y un majado de ajo, perejil y aceite.',
  ]),
  suquet: r(2, [x('merluza', 400, 'merluza o rape en trozos'), x('papa', 400, 'papas', 200), x('tomate', 120, 'tomate rallado', 120), x('almendras', 20, 'almendras tostadas'), x('aceite', 30, 'aceite de oliva'), s('caldo de pescado (medio litro), ajo, perejil, pimentón y sal')], [
    'En una cazuela, dorá el ajo laminado en el aceite. Sumá el tomate rallado y el pimentón y cociná 5 minutos.',
    'Agregá las papas en rodajas gruesas y el caldo caliente, y cociná 15 minutos.',
    'Mientras, machacá las almendras con un diente de ajo y perejil (es la picada) y sumala a la cazuela.',
    'Poné el pescado salado arriba de las papas y cociná 6 a 8 minutos más, moviendo la cazuela en vez de revolver.',
  ]),
  'pasta-pesto': r(2, [x('fideos', 200, 'fideos (trofie, linguine o spaghetti)'), x('albahaca', 40, 'albahaca fresca'), x('pinones', 20, 'piñones'), x('queso rallado', 30, 'queso rallado (parmesano)'), x('aceite', 50, 'aceite de oliva'), s('ajo y sal')], [
    'Procesá la albahaca con los piñones, el ajo, el queso, sal y el aceite hasta tener una pasta (o machacalo en un mortero).',
    'Herví los fideos en abundante agua con sal. Guardá medio vaso del agua de cocción.',
    'Mezclá los fideos con el pesto fuera del fuego, aflojando con un poco del agua si hace falta.',
  ]),
  'pasta-puttanesca': r(2, [x('fideos', 200, 'fideos (spaghetti)'), x('tomate triturado', 300, 'tomate triturado'), x('aceitunas', 40, 'aceitunas negras'), x('anchoas', 15, 'filetes de anchoa'), x('aceite', 20, 'aceite de oliva'), s('alcaparras, ajo, ají molido y perejil')], [
    'Dorá el ajo laminado y las anchoas en el aceite, aplastándolas hasta que se deshagan.',
    'Sumá el tomate, las aceitunas, las alcaparras y el ají, y cociná 10 minutos.',
    'Herví los fideos, colalos y terminalos un minuto en la salsa. Perejil por arriba.',
  ]),
  'pasta-aglio-olio': r(2, [x('fideos', 200, 'spaghetti'), x('ajo', 20, 'dientes de ajo', 5), x('aceite', 40, 'aceite de oliva'), s('ají molido, perejil y sal')], [
    'Herví los fideos en abundante agua con sal.',
    'Mientras, calentá el aceite a fuego bajo con el ajo en láminas y el ají, hasta que el ajo esté apenas dorado.',
    'Pasá los fideos a la sartén con un cucharón del agua de cocción y revolvé fuerte un minuto, hasta que la salsa se ligue. Perejil por arriba.',
  ]),
  'espaguetis-almejas': r(2, [x('fideos', 200, 'spaghetti'), x('almejas', 500, 'almejas (con valva)'), x('vino', 100, 'vino blanco'), x('aceite', 30, 'aceite de oliva'), s('ajo, ají molido, perejil y sal')], [
    'Dejá las almejas en agua con sal 30 minutos para que suelten la arena.',
    'Herví los fideos en abundante agua con sal.',
    'En una sartén grande, dorá el ajo en el aceite con el ají, sumá las almejas y el vino y tapá: en 3 o 4 minutos se abren (tirá las que no se abran).',
    'Pasá los fideos a la sartén, mezclá un minuto con el jugo de las almejas y terminá con perejil.',
  ]),
  'pasta-norma': r(2, [x('fideos', 200, 'fideos (rigatoni o spaghetti)'), x('berenjena', 300, 'berenjena', 300), x('tomate triturado', 300, 'tomate triturado'), x('aceite', 40, 'aceite de oliva'), x('ricota', 60, 'ricota (o queso rallado)'), s('ajo, albahaca y sal')], [
    'Cortá la berenjena en cubos, salala y dorala en el aceite hasta que esté tierna. Sacala.',
    'En la misma sartén, rehogá el ajo, sumá el tomate y cociná 10 minutos.',
    'Herví los fideos, colalos y mezclalos con la salsa y la berenjena.',
    'Serví con la ricota desmenuzada y hojas de albahaca.',
  ]),
  'berenjenas-parmesana': r(2, [x('berenjena', 600, 'berenjenas', 300), x('tomate triturado', 400, 'tomate triturado'), x('queso', 200, 'mozzarella'), x('queso rallado', 40, 'queso rallado (parmesano)'), x('aceite', 40, 'aceite de oliva'), s('ajo, albahaca y sal')], [
    'Cortá las berenjenas en rodajas de 1 cm, pincelalas con aceite y hacelas al horno fuerte 20 minutos, dándolas vuelta una vez (o fritas, como en Sicilia).',
    'Mientras, cociná el tomate con el ajo y sal 15 minutos y sumá la albahaca.',
    'En una fuente, armá capas de salsa, berenjena, mozzarella y queso rallado, y terminá con salsa y queso.',
    'Horneá a 200 °C unos 25 minutos, hasta que gratine. Dejala reposar 10 minutos antes de cortar.',
  ]),
  minestrone: r(2, [x('cebolla', 150, 'cebolla', 150), x('zanahoria', 160, 'zanahorias', 80), x('apio', 60, 'apio'), x('papa', 200, 'papa', 200), x('zapallito', 200, 'zapallito', 200), x('tomate triturado', 200, 'tomate triturado'), x('porotos', 200, 'porotos blancos cocidos'), x('fideos', 60, 'fideos chicos (dedalitos o municiones)'), x('aceite', 20, 'aceite de oliva'), x('queso rallado', 20, 'queso rallado'), s('ajo, caldo (1 litro) y sal')], [
    'Rehogá la cebolla, la zanahoria y el apio picados en el aceite, 5 minutos.',
    'Sumá la papa y el zapallito en cubos, el tomate y el caldo, y cociná 20 minutos.',
    'Agregá los porotos y los fideos y cociná lo que diga el paquete.',
    'Serví con queso rallado y un hilo de aceite de oliva.',
  ]),
  musaka: r(4, [x('berenjena', 600, 'berenjenas', 300), x('carne picada', 400, 'carne picada (de cordero o de vaca)'), x('papa', 200, 'papa', 200), x('cebolla', 150, 'cebolla', 150), x('tomate triturado', 200, 'tomate triturado'), x('aceite', 40, 'aceite de oliva'), x('leche', 400, 'leche'), x('harina', 30, 'harina'), x('manteca', 30, 'manteca'), x('queso rallado', 30, 'queso rallado'), s('canela, nuez moscada, orégano y sal')], [
    'Cortá las berenjenas en rodajas, pincelalas con aceite y hacelas al horno fuerte 20 minutos. Cortá la papa en rodajas finas y hervila 5 minutos.',
    'Rehogá la cebolla picada, sumá la carne y dorala. Agregá el tomate, una pizca de canela, orégano y sal, y cociná 15 minutos.',
    'Para la bechamel, derretí la manteca, sumá la harina y, de a poco, la leche, revolviendo hasta que espese. Nuez moscada y sal.',
    'En una fuente, armá capas: papas, berenjenas, carne y berenjenas. Cubrí con la bechamel y el queso.',
    'Horneá a 180 °C unos 40 minutos, hasta que esté dorada. Dejala reposar 15 minutos antes de cortar.',
  ]),
  souvlaki: r(2, [x('cerdo', 400, 'cerdo (bondiola o carré, en cubos)'), x('pan de pita', 240, 'pitas', 60), x('yogur', 200, 'yogur natural (o griego)'), x('pepino', 100, 'pepino'), x('tomate', 120, 'tomate', 120), x('cebolla', 50, 'cebolla morada'), x('aceite', 20, 'aceite de oliva'), s('limón, ajo, orégano y sal')], [
    'Mariná el cerdo con aceite, jugo de limón, ajo, orégano y sal, al menos 30 minutos.',
    'Para el tzatziki, rallá el pepino, escurrilo apretándolo y mezclalo con el yogur, ajo rallado y sal.',
    'Ensartá la carne en brochetas y hacela en plancha o parrilla bien caliente, 10 a 12 minutos, dándola vuelta.',
    'Calentá las pitas y serví la carne con el tzatziki, y tomate y cebolla en rodajas.',
  ]),
  'tarta-espinaca-feta': r(4, [x('masa', 250, 'masa filo (o dos tapas de tarta)'), x('espinaca', 500, 'espinaca fresca'), x('feta', 200, 'queso feta'), x('huevo', 100, 'huevos', 50), x('cebolla', 60, 'cebolla de verdeo'), x('aceite', 40, 'aceite de oliva'), s('eneldo o menta, nuez moscada y pimienta')], [
    'Cociná la espinaca en una olla sin agua hasta que se achique, escurrila bien apretándola y picala.',
    'Mezclala con el verdeo picado, el feta desmenuzado, los huevos, el eneldo y pimienta (no hace falta sal: el feta es salado).',
    'Pincelá una fuente con aceite y poné la mitad de las hojas de filo, pincelando cada una. Sumá el relleno y tapá con el resto, también pinceladas.',
    'Marcá las porciones con un cuchillo y horneá a 180 °C unos 40 minutos, hasta que esté dorada.',
  ]),
  'tomates-rellenos': r(2, [x('tomate', 500, 'tomates grandes', 250), x('morron', 300, 'morrones', 150), x('arroz', 100, 'arroz'), x('cebolla', 150, 'cebolla', 150), x('papa', 200, 'papa', 200), x('aceite', 40, 'aceite de oliva'), s('menta o perejil, ajo y sal')], [
    'Cortá una tapa a los tomates y a los morrones. Vaciá los tomates con una cuchara y guardá la pulpa picada; a los morrones sacales las semillas.',
    'Rehogá la cebolla picada en la mitad del aceite, sumá el arroz crudo, la pulpa de tomate, la menta, sal y un vaso de agua, y cociná 5 minutos.',
    'Rellená las verduras hasta tres cuartos (el arroz crece), tapalas y acomodalas en una fuente con la papa en gajos alrededor.',
    'Rociá con el resto del aceite y horneá a 180 °C una hora y cuarto, hasta que el arroz esté tierno.',
  ]),
  'albondigas-griegas': r(2, [x('carne picada', 400, 'carne picada'), x('pan', 60, 'miga de pan remojada en leche'), x('cebolla', 75, 'cebolla rallada'), x('huevo', 50, 'huevo', 50), x('harina', 20, 'harina (para pasarlas)'), x('aceite', 30, FRY), x('yogur', 200, 'yogur natural (o griego)'), x('pepino', 100, 'pepino'), s('menta, orégano, ajo y sal')], [
    'Mezclá la carne con la miga escurrida, la cebolla, el huevo, la menta y el orégano picados y sal. Dejá descansar 15 minutos.',
    'Formá albóndigas chicas, pasalas por harina y freílas en tandas hasta dorar, 6 a 8 minutos.',
    'Para el tzatziki, rallá el pepino, escurrilo apretándolo y mezclalo con el yogur, ajo y sal.',
    'Serví las albóndigas con el tzatziki.',
  ]),
  'cordero-horno': r(4, [x('cordero', 1500, 'cordero (pierna o paletilla, con hueso)'), x('vino', 100, 'vino blanco'), x('aceite', 30, 'aceite de oliva'), s('limón, ajo, romero, orégano y sal')], [
    'Frotá el cordero con aceite, ajo machacado, romero, orégano, jugo de limón y sal. Si podés, dejalo así unas horas en la heladera.',
    'Ponelo en una fuente con el vino y medio vaso de agua, tapado con papel aluminio.',
    'Horneá a 160 °C 2 horas; destapá, subí a 200 °C y dorá 20 a 30 minutos más, hasta que la carne se separe del hueso.',
  ]),
  'sopa-lentejas-rojas': r(2, [x('lentejas', 150, 'lentejas rojas'), x('cebolla', 150, 'cebolla', 150), x('zanahoria', 80, 'zanahoria', 80), x('aceite', 20, 'aceite de oliva'), x('limon', 30, 'jugo de limón'), s('caldo o agua (1 litro), comino, pimentón y sal')], [
    'Rehogá la cebolla y la zanahoria picadas en el aceite, 5 minutos. Sumá el comino y el pimentón.',
    'Agregá las lentejas lavadas y el caldo, y cociná 20 minutos: las rojas se deshacen solas.',
    'Procesala hasta que quede cremosa, salá y serví con jugo de limón.',
  ]),
  falafel: r(2, [x('garbanzos secos', 200, 'garbanzos secos (remojados desde la noche anterior)'), x('cebolla', 75, 'cebolla'), x('perejil', 30, 'perejil y cilantro'), x('aceite', 40, FRY), x('pan de pita', 120, 'pitas', 60), x('tahini', 30, 'tahini'), x('tomate', 120, 'tomate', 120), s('ajo, comino, limón y sal')], [
    'Remojá los garbanzos secos desde la noche anterior (no sirven los cocidos: el falafel se desarma).',
    'Escurrilos y procesalos con la cebolla, el ajo, el perejil, el cilantro, comino y sal, hasta tener una pasta granulosa.',
    'Formá bolitas apenas aplastadas y freílas en tandas en aceite caliente, 3 o 4 minutos, hasta que estén bien doradas.',
    'Para la salsa, mezclá el tahini con jugo de limón, agua y sal. Serví el falafel en las pitas, con tomate y la salsa.',
  ]),
  'lentejas-arroz': r(2, [x('lentejas', 150, 'lentejas (pardinas o marrones)'), x('arroz', 100, 'arroz'), x('cebolla', 450, 'cebollas', 150), x('aceite', 40, 'aceite de oliva'), x('yogur', 150, 'yogur natural'), s('comino y sal')], [
    'Herví las lentejas en agua sin sal 15 minutos: tienen que quedar firmes.',
    'Mientras, cortá las cebollas en pluma y cocinalas en el aceite a fuego medio, 25 a 30 minutos, hasta que estén bien doradas y casi crocantes.',
    'Sumá a las lentejas el arroz, el comino, sal y la mitad de la cebolla, con agua que apenas cubra, y cociná tapado 15 minutos, hasta que el arroz esté tierno.',
    'Serví con el resto de la cebolla arriba y yogur al costado. Es la mujaddara de Líbano y Siria.',
  ]),
  shakshuka: r(2, [x('huevo', 200, 'huevos', 50), x('tomate triturado', 400, 'tomate triturado'), x('morron', 150, 'morrón rojo', 150), x('cebolla', 150, 'cebolla', 150), x('aceite', 20, 'aceite de oliva'), x('pan', 100, 'pan para mojar'), s('ajo, comino, pimentón, perejil y sal')], [
    'Rehogá la cebolla y el morrón en tiras en el aceite, 10 minutos. Sumá el ajo, el comino y el pimentón.',
    'Agregá el tomate y sal, y cociná 10 minutos hasta que espese.',
    'Hacé cuatro huecos en la salsa, rompé un huevo en cada uno, tapá y cociná 5 a 7 minutos, con la yema blanda.',
    'Terminá con perejil y serví en la misma sartén, con pan para mojar.',
  ]),
  'cuscus-verduras': r(2, [x('cuscus', 150, 'cuscús'), x('garbanzos', 240, 'garbanzos cocidos'), x('zanahoria', 160, 'zanahorias', 80), x('calabaza', 200, 'calabaza'), x('zapallito', 200, 'zapallito', 200), x('cebolla', 150, 'cebolla', 150), x('aceite', 30, 'aceite de oliva'), s('caldo (medio litro), comino, cúrcuma, canela y sal')], [
    'Rehogá la cebolla picada en el aceite. Sumá las especias y revolvé un minuto.',
    'Agregá la zanahoria y la calabaza en trozos grandes y el caldo, y cociná 15 minutos. Sumá el zapallito y los garbanzos y cociná 10 minutos más.',
    'Mientras, poné el cuscús en un bol con sal, cubrilo con el mismo volumen de caldo hirviendo de la olla, tapalo 5 minutos y desgranalo con un tenedor.',
    'Serví el cuscús con las verduras y su caldo por arriba.',
  ]),
  'tajin-pollo': r(2, [x('pollo', 600, 'pollo (patas muslo)'), x('cebolla', 300, 'cebollas', 150), x('aceitunas', 60, 'aceitunas verdes'), x('aceite', 30, 'aceite de oliva'), s('limón (mejor en conserva), ajo, jengibre, cúrcuma, comino, cilantro y sal')], [
    'Mariná el pollo con el ajo, las especias, aceite y sal, al menos 30 minutos.',
    'Doralo en una cazuela (o en un tajín) y sumá la cebolla en pluma. Cociná 5 minutos.',
    'Agregá medio vaso de agua, tapá y cociná a fuego bajo 40 minutos.',
    'Sumá el limón en gajos y las aceitunas, y cociná 10 minutos más destapado, hasta que la salsa espese. Terminá con cilantro.',
  ]),
  ratatouille: r(2, [x('berenjena', 300, 'berenjena', 300), x('zapallito', 200, 'zapallito', 200), x('morron', 150, 'morrón rojo', 150), x('tomate', 360, 'tomates', 120), x('cebolla', 150, 'cebolla', 150), x('aceite', 40, 'aceite de oliva'), s('ajo, tomillo, laurel y sal')], [
    'Cortá todas las verduras en cubos parejos. Salá la berenjena, dejala 15 minutos y secala.',
    'Dorá por separado, en el aceite, la berenjena, el zapallito y el morrón, y reservalos.',
    'En la misma olla, rehogá la cebolla y el ajo, sumá el tomate, el tomillo y el laurel y cociná 10 minutos.',
    'Volvé a poner las verduras y cociná tapado a fuego bajo 25 minutos. Es mejor al día siguiente.',
  ]),
  'ensalada-nizarda': r(2, [x('atun', 160, 'atún en lata (escurrido)'), x('huevo', 100, 'huevos duros', 50), x('papa', 200, 'papa', 200), x('chauchas', 150, 'chauchas'), x('tomate', 240, 'tomates', 120), x('aceitunas', 40, 'aceitunas negras'), x('anchoas', 15, 'filetes de anchoa'), x('aceite', 30, 'aceite de oliva'), s('mostaza, vinagre y sal')], [
    'Herví la papa en cubos (12 minutos) y las chauchas (5 minutos) en agua con sal, y los huevos 10 minutos.',
    'Enfriá todo y armá la ensalada con los tomates en gajos, las aceitunas, el atún, los huevos en cuartos y las anchoas.',
    'Condimentá con el aceite batido con una cucharadita de mostaza, vinagre y sal.',
  ]),
  'pan-tomate': r(2, [x('pan', 160, 'pan de campo o de barra'), x('tomate', 240, 'tomates maduros', 120), x('aceite', 15, 'aceite de oliva'), s('ajo y sal')], [
    'Tostá el pan en rodajas. Si te gusta, frotalo con medio diente de ajo.',
    'Cortá los tomates por la mitad y frotalos sobre el pan hasta que quede solo la piel.',
    'Terminá con aceite de oliva y sal.',
  ]),
  escalivada: r(2, [x('berenjena', 300, 'berenjena', 300), x('morron', 300, 'morrones rojos', 150), x('cebolla', 150, 'cebolla', 150), x('aceite', 20, 'aceite de oliva'), s('sal')], [
    'Poné la berenjena, los morrones y la cebolla enteros en una fuente, con un hilo de aceite.',
    'Asalos en horno fuerte (200 °C) unos 50 minutos, dándolos vuelta a mitad de camino, hasta que estén blandos y con la piel quemada.',
    'Tapalos 10 minutos para que se pelen fácil. Pelalos y cortalos en tiras.',
    'Condimentá con el resto del aceite y sal. Se come tibia o fría.',
  ]),
  'espinacas-catalana': r(2, [x('espinaca', 400, 'espinaca fresca'), x('pasas', 25, 'pasas de uva'), x('pinones', 20, 'piñones'), x('aceite', 15, 'aceite de oliva'), s('ajo y sal')], [
    'Remojá las pasas en agua tibia 10 minutos.',
    'Dorá los piñones en una sartén sin aceite, con cuidado de que no se quemen, y sacalos.',
    'En la misma sartén, dorá el ajo laminado en el aceite. Sumá la espinaca y cociná hasta que se achique.',
    'Agregá las pasas escurridas y los piñones, y salá.',
  ]),
  'ensalada-griega': r(2, [x('tomate', 240, 'tomates', 120), x('pepino', 150, 'pepino'), x('cebolla', 50, 'cebolla morada'), x('morron', 75, 'morrón verde'), x('aceitunas', 40, 'aceitunas negras'), x('feta', 100, 'queso feta'), x('aceite', 20, 'aceite de oliva'), s('orégano y sal')], [
    'Cortá los tomates y el pepino en trozos grandes, y la cebolla y el morrón en aros finos.',
    'Sumá las aceitunas y el queso feta, en un bloque o en cubos.',
    'Condimentá con orégano, aceite de oliva y sal.',
  ]),
  'ensalada-caprese': r(2, [x('tomate', 240, 'tomates', 120), x('queso', 120, 'mozzarella fresca'), x('aceite', 15, 'aceite de oliva'), s('albahaca fresca, sal y pimienta')], [
    'Cortá los tomates y la mozzarella en rodajas.',
    'Alternalas en un plato con hojas de albahaca.',
    'Terminá con aceite de oliva, sal y pimienta.',
  ]),
  hummus: r(2, [x('garbanzos', 240, 'garbanzos cocidos (escurridos)'), x('tahini', 30, 'tahini'), x('limon', 30, 'jugo de limón'), x('aceite', 15, 'aceite de oliva'), s('ajo, comino, pimentón y sal')], [
    'Procesá los garbanzos con el tahini, el jugo de limón, medio diente de ajo, comino, sal y 3 o 4 cucharadas de agua fría, hasta que quede bien liso.',
    'Probá y ajustá de limón y sal.',
    'Serví con un hilo de aceite de oliva y pimentón por arriba.',
  ]),
  tabule: r(2, [x('bulgur', 50, 'bulgur fino (o cuscús)'), x('perejil', 100, 'perejil (dos atados)'), x('tomate', 240, 'tomates', 120), x('cebolla', 30, 'cebolla de verdeo'), x('limon', 40, 'jugo de limón'), x('aceite', 25, 'aceite de oliva'), s('menta fresca y sal')], [
    'Remojá el bulgur en el jugo de limón con un poco de agua, 15 minutos.',
    'Mientras, picá bien fino el perejil (sin los tallos gruesos), la menta, el verdeo y los tomates.',
    'Mezclá todo con el bulgur, el aceite y sal. Tiene que quedar más verde que trigo.',
  ]),
  cuscus: r(2, [x('cuscus', 150, 'cuscús'), x('manteca', 10, 'manteca (o aceite de oliva)'), s('agua o caldo caliente y sal')], [
    'Poné el cuscús en un bol con sal y la manteca.',
    'Cubrilo con el mismo volumen de agua o caldo hirviendo, tapalo y dejalo 5 minutos.',
    'Desgranalo con un tenedor.',
  ]),
};

const STARTER_NAMES = new Map(STARTER_DISHES.map((d) => [d.id, d.name]));

/**
 * The recipe to show for a dish: its own, else the starter recipe if it is
 * still that starter dish (same id, and its name or its v5 name, which v6
 * keeps when the new one was taken: a starter the user renamed, say into
 * "Hamburguesas de lentejas", is theirs now), else null.
 */
export function recipeFor(dish) {
  if (!dish) return null;
  if (dish.recipe) return dish.recipe;
  const starter = STARTER_NAMES.get(dish.id) === dish.name || CHANGED_IN_V6[dish.id] === dish.name;
  return starter ? (STARTER_RECIPES[dish.id] ?? null) : null;
}
