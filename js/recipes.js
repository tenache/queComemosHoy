// Recipes for the starter dishes: short, home-style, written for this app.
// Amounts are for `serves` portions; grams are what the macros are counted
// from (oil for frying counts what the food absorbs, not what's in the pan).
// A dish the user gave a recipe of their own uses that one instead.

import { STARTER_DISHES } from './dishes.js';

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
};

const STARTER_NAMES = new Map(STARTER_DISHES.map((d) => [d.id, d.name]));

/**
 * The recipe to show for a dish: its own, else the starter recipe if it is
 * still that starter dish (same id and name: a starter the user renamed, say
 * into "Hamburguesas de lentejas", is theirs now), else null.
 */
export function recipeFor(dish) {
  if (!dish) return null;
  if (dish.recipe) return dish.recipe;
  return STARTER_NAMES.get(dish.id) === dish.name ? (STARTER_RECIPES[dish.id] ?? null) : null;
}
