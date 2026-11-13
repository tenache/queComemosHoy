# queComemosHoy
Un programa para no tener que decidir qué comer

Seguro que te pasó: estás en la tuya, trabajando, estudiando, o viendo Tik Toks y de repente tu panza suena. Le preguntás a la persona que vive con vos: gordo/a, tengo hambre, qué podemos comer? Desde otra habitación, la voz amada responde lo que tenemos escuchar: No sé, elegí vos! 
 Qué comemos hoy es un programa para evitar los conflictos con las personas con las que vivís, y los conflictos dentro de vos mismo. Tiene en cuenta: salud, sabor, reciencia de la comida (para no comer siempre lo mismo), y obvio, el costo (el sanguchazo del delivery es riquísimo, pero no nos queremos fundir tampoco).

## La app (v1)

Desde 2026 *Qué comemos hoy* es una app para el celular (una PWA): se abre en el navegador, se puede instalar en la pantalla de inicio y funciona sin conexión. Ya trae unas 40 comidas caseras y 9 acompañamientos, así que no hay que cargar nada para empezar.

- **¿Cómo está nuestro cocinero hoy?** Una vez por día la app pregunta: con fiaca, apurado, con ganas de algo rico, de algo saludable o de algo distinto, o como siempre. Las sugerencias de ese día se acomodan a la respuesta (lo más fácil, lo más rápido, lo más rico, lo más sano, más variedad, o nada). Se cambia tocando el emoji al lado del título.
- **Una tarjeta por vez.** Deslizá a la derecha (👉) si la cocinás, a la izquierda (👈) si hoy no, o tocá 🛒 si te falta algún ingrediente.
- **Plato y acompañamiento.** La tarjeta muestra el plato con un acompañamiento sugerido ("Milanesas · Con: puré"). Tocalo para cambiarlo. Si lo que querés es el acompañamiento, fijalo con 📌 y las tarjetas siguientes son platos que van con eso.
- **O elegí vos.** Con "Elegir de la lista" ves todas las comidas y anotás la que quieras, o fijás primero el acompañamiento.
- **Recetas y macros.** Tocá la tarjeta (o "📝 Receta") y ves la receta del plato y la del acompañamiento, con las cantidades para las porciones que elijas, y las calorías, proteínas, hidratos, grasas y fibra aproximadas por porción. Las recetas se pueden editar en Comidas.
- **Tus favoritas.** Al empezar elegís hasta 5 comidas favoritas (⭐), que salen un poco más seguido. Se cambian en Comidas.
- **Ruleta del delivery.** Para las noches de pedir: girás y sale una cocina (china, pizza, sushi…) o "¿Y si cocinamos?". Esa porción crece cuando venís pidiendo mucho y se achica si hace rato que no pedís o es fin de semana.
- **Aprende de lo que elegís.** Lo que cocinás sube, lo que rechazás baja, y nada desaparece salvo que marques "No mostrar nunca": hasta la comida menos querida vuelve a salir cada tanto.
- **No repite.** Baja las comidas que comiste hace poco y las que comparten ingrediente principal con lo de ayer.
- **Lista de compras.** Lo que marcás como faltante queda anotado hasta que toques "Comprado".
- **Todo queda en tu dispositivo.** No hay cuentas ni servidor. En Ajustes podés exportar e importar una copia en JSON.

### Cómo correrla

No hay nada que compilar ni instalar. Hace falta un servidor de archivos estáticos (abrir `index.html` con doble clic no alcanza):

```bash
python -m http.server 8000
```

y después abrí <http://localhost:8000> en el navegador.

### Cómo instalarla

- **Chrome (computadora):** ícono de instalar en la barra de direcciones, o Ajustes → "Instalar la app" dentro de la app.
- **Android (Chrome):** menú ⋮ → "Agregar a la pantalla principal".
- **iPhone (Safari):** Compartir → "Agregar a inicio".

Fuera de `localhost` los navegadores solo dejan instalar una PWA si se sirve por HTTPS.

### Cómo probarla

Las pruebas usan el test runner que viene con Node (20 o más nuevo), sin dependencias:

```bash
node --test
```

### Ajustes finos

Los números con los que la app elige (los pesos del puntaje, la ruleta, la variedad…) se leen en tres capas, y cada una pisa a la anterior:

1. **El código** (`js/scoring.js`, `js/wheel.js`): los valores revisados.
2. **`params.json`**: valores para todos los teléfonos. Se edita en GitHub (el lápiz ✏️ sobre el archivo) y se guarda directo en `main`, **sin issue, PR ni revisión**. Es la única excepción al proceso, y solo para cambios que no tocan nada más que `params.json`. Netlify lo publica en un par de minutos, y cada teléfono lo lee la próxima vez que abre la app (no hace falta cambiar `VERSION` en `sw.js`).
3. **Este teléfono**: Ajustes → Ajustes finos. Se nota al instante, con una vista previa, y vale solo en ese teléfono. "Copiar mis valores" da las líneas para pegar en `params.json`.

Un ejemplo de `params.json`:

```json
{
  "WHEEL.frequencyCap": 15,
  "WEIGHTS.effort": 1.5
}
```

Las claves son las de `js/params.js`. Un valor fuera de rango se recorta, una clave desconocida o que empieza con `_` se ignora, y si el archivo no se puede leer la app sigue con la última copia que funcionó: un error de tipeo no rompe nada.

### Cómo está armada

HTML, CSS y JavaScript sin framework ni build.

| Archivo | Qué tiene |
|---|---|
| `js/scoring.js` | El puntaje de cada comida y el sorteo. Módulo puro, con todos los pesos como constantes al principio. |
| `js/wheel.js` | La ruleta del delivery: el tamaño de la porción "¿Y si cocinamos?", el sorteo y el registro de pedidos. Módulo puro, con todos los números en `WHEEL`. |
| `js/wheel-view.js` | La pantalla de la ruleta. |
| `js/params.js` | Los números que se pueden ajustar sin tocar el código: la lista, sus rangos y las tres capas (código, `params.json`, este teléfono). Módulo puro. |
| `params.json` | Valores para todos los teléfonos (ver Ajustes finos). |
| `js/state.js` | El estado (un solo objeto JSON con `schemaVersion`), la despensa y el registro de eventos. |
| `js/storage.js` | Lectura y escritura en `localStorage` (clave `qch:v1`). |
| `js/strings.js` | Todos los textos de la interfaz, para poder agregar otro idioma. |
| `js/dishes.js` | Las comidas iniciales, con sus acompañamientos. |
| `js/recipes.js` | Las recetas de las comidas iniciales. |
| `js/nutrition.js` | Calorías y macros por 100 g de unos 60 alimentos (redondeados de USDA FoodData Central), el cálculo por porción y la lectura de las líneas de una receta. Módulo puro. |
| `js/app.js` | La interfaz. |
| `sw.js` | El service worker: guarda la app para usarla sin conexión. |
| `revisar/` | Una página aparte (no es parte de la app ni se instala) para revisar con quien cocina cuánto trabajo da cada comida inicial y con qué se acompaña. Se abre en `/revisar/`. |
| `test/` | Las pruebas. |
| `tools/sw-version.js` | Calcula y actualiza `VERSION` en `sw.js`. |
| `tools/make_icons.py` | Genera los íconos de `icons/`. |

**Después de cambiar cualquier archivo de la app** hay que actualizar `VERSION` en `sw.js`:

```bash
node tools/sw-version.js --write
```

`VERSION` termina con un hash de los archivos de la app. Ese cambio es lo que hace que los navegadores bajen la versión nueva y muestren el aviso "Hay una versión nueva". Si te olvidás, `node --test` falla y te lo recuerda.

Lo que queda para la v2: autocompletar comidas con IA y recordatorios a la hora de comer (los dos necesitan un servidor).

## La versión de 2021

El programa original en Python está en la rama [`master`](https://github.com/tenache/queComemosHoy/tree/master). Lo que sigue es su descripción original.

### Lo que hay que subir en el programa
Para funcionar, el programa necesita una lista de las comidas y una lista de las guarniciones (incluire un ejemplo de estos dos archivos). Las comidas deben tener las siguientes columnas: comidas, guarniciones, ingredientes, salud, rico, tiempo, costo. Los nombres de las columnas son bastante auto-explicativos, pero vale aclarar que en las columnas de las guarniciones debe haber una lista de las guarniciones que van con esa comida (separadas por comas, sin espacios). En la columna de los ingredientes también va una lista con las mismas características. 
 Luego, se sube otro archivo que es el de las guarniciones, que tiene las columnas: ingredientes, salud, rico, reciente, costo. 
### La idea
 Como verán viendo de los archivos que se suben, la idea es que el programa elija una comida al azar. Digamos que hayamos subido tres posibilidades: guiso, polenta y ravioles. Las garniciones (en realidad acompañamiento), para el giso: no tiene, para la polenta: salsa Bolognesa,salsa Pomarola, para los ravioles: salsa Bolognesa, salsa Pomarola, salsa Mixta, y salsa de Champigniones. El programa elegirá al azar una comida al azar (de entre los platos principales), pero favoreciendo los platos con mayores score en salud, gusto, y menor score en tiempo que nosotros mismos subimos (podemos ahorrarnos este paso, y todas tendrán los mismos scores por default), y luego elegirá una guarnición al azar de entre las posibilidades de ese plato (digamos que haya elegido ravioles, elegirá al azar entre las distintas salsas). También vale aclarar que como le subimos los ingredientes, también tendrá en cuenta la reciencia con la que comimos estos. Si bien nunca hacemos los ravioles de 0, podemos subir como ingrediente "harina"; esto evitará que comamos pastas demasiados días seguidos, por ejempolo. Ahora bien, el programa también hace el proceso inverso, eligiendo una comida a partir de la lista completa de guarniciones primero, y seleccionando entre las comidas posibles (por ejemplo, digamos que haya elegido salsa bolognesa, entonces elegir{a al azar entre ravioles y poolenta). Una vez elegidas las dos comidas mediante los dos m{etodos, las compoara teniendo en cuenta los mismos scores que mencionamos y ofrece lacomida de mayor score). Cuando se haya elegido la commida, aceptada por el usuario(este puede solicitar repetir el poroceso las veces que quiera), se modifican los scores de recienciade as comidas y los ingredientes y el programa est{alisto para elegir una comdia al dia siguiente. Eventualmente quiero que esto sea una apps con notificaciones en el momento justo para salir a comporar los ingredientes necesarios....  

