// Every UI string lives here. To add English, add an `en` block with the
// same keys and switch LANG. (Starter dish names are data: see dishes.js.
// The installed app's name is in manifest.webmanifest.)

const STRINGS = {
  es: {
    appName: '¿Qué comemos hoy?',

    // Tabs
    tabToday: 'Hoy',
    tabDishes: 'Comidas',
    tabPantry: 'Despensa',
    tabSettings: 'Ajustes',

    // Suggestion card
    variety: 'Variedad',
    varietyLow: 'Poca',
    varietyMedium: 'Media',
    varietyHigh: 'Mucha',
    minutes: '{n} min',
    health: 'Salud',
    yum: 'Rico',
    outOf5: '{n} de 5',
    mainIngredients: 'Ingredientes principales',
    missingNow: 'Te falta: {list}',
    actionReject: 'Esta no',
    actionMissing: 'Me falta algo',
    actionCook: 'Cocinar esta',
    pickFromList: 'Elegir de la lista',
    pickTitle: '¿Qué vas a cocinar?',
    pickHelp: 'Tocá cualquier comida, también las ocultas. Queda anotada como la comida de hoy.',
    swipeHint: 'Deslizá: 👉 la cocino · 👈 hoy no',
    noDishesTitle: 'No hay comidas para sugerir',
    noDishesText: 'Agregá comidas o destildá "No mostrar nunca" en alguna.',
    goToDishes: 'Ir a Comidas',

    // Missing ingredients sheet
    missingTitle: '¿Qué te falta?',
    missingHelp: 'Tocá lo que no tenés. Va a la lista de compras.',
    cookAnyway: 'La hago igual, lo compro',
    otherOption: 'Otra opción',
    cancel: 'Cancelar',

    // Cooked
    cookedTitle: '¡A cocinar!',
    cookedText: 'Anotado: hoy comemos {name}.',
    cookedToBuy: 'Para comprar: {list}',
    ingredients: 'Ingredientes',
    undo: 'Deshacer',
    suggestAnother: 'Sugerir otra',

    // After-meal question
    afterMealTitle: '¿Cómo salió?',
    ranOut: '¿Se te acabó algo?',
    ranOutHelp: 'Tocá lo que se terminó. Va a la lista de compras.',
    howWasIt: '¿Qué tal estuvo?',
    thumbsUp: 'Rico',
    thumbsDown: 'No tanto',
    done: 'Listo',
    skip: 'Saltar',

    // Dishes
    dishesTitle: 'Comidas',
    addDish: 'Agregar comida',
    editDish: 'Editar comida',
    newDish: 'Nueva comida',
    hidden: 'Oculta',
    fieldName: 'Nombre',
    fieldEmoji: 'Emoji',
    fieldIngredients: 'Ingredientes',
    fieldIngredientsHelp: 'Separados por comas. Ej.: fideos, huevo, queso rallado',
    fieldMains: 'Ingredientes principales (1 a 3)',
    fieldMainsHelp:
      'Categorías, no la lista completa: fideos, ravioles y ñoquis son "pasta". No pongas cebolla, ajo, aceite ni sal.',
    fieldMinutes: 'Minutos de cocina',
    fieldHealth: 'Salud (1 a 5)',
    fieldYum: 'Rico (1 a 5)',
    fieldNeverShow: 'No mostrar nunca',
    save: 'Guardar',
    back: 'Volver',
    delete: 'Borrar',
    confirmDelete: '¿Borrar "{name}"? No se puede deshacer.',
    errorName: 'Poné un nombre.',
    errorMains: 'Poné entre 1 y 3 ingredientes principales.',
    errorMinutes: 'Los minutos tienen que ser un número, 0 o más.',

    // Pantry and shopping list
    shoppingTitle: 'Lista de compras',
    shoppingEmpty: 'No falta nada. 🎉',
    bought: 'Comprado',
    addItemPlaceholder: 'Agregar a la lista…',
    add: 'Agregar',
    pantryTitle: 'Despensa',
    pantryHelpLazy: 'Todo cuenta como disponible. Tocá lo que te falta y pasa a la lista de compras.',
    pantryHelpManual: 'Tocá lo que tenés en casa. Lo que no esté marcado cuenta como faltante.',
    have: 'tengo',
    missing: 'falta',

    // Settings
    settingsTitle: 'Ajustes',
    pantryMode: 'Modo de despensa',
    pantryLazy: 'Relajado',
    pantryLazyHelp: 'Todo está disponible hasta que marques que falta.',
    pantryManual: 'Manual',
    pantryManualHelp: 'Vos mantenés la despensa: lo que no marcaste como disponible cuenta como faltante.',
    varietyHelp: 'Con poca variedad salen casi siempre las mejores opciones; con mucha, más sorpresas.',
    backup: 'Copia de seguridad',
    backupHelp: 'Tus datos están solo en este dispositivo. Exportalos para guardarlos o pasarlos a otro.',
    exportData: 'Exportar JSON',
    importData: 'Importar JSON',
    confirmImport: 'Importar reemplaza todos los datos actuales ({dishes} comidas). ¿Seguir?',
    importOk: 'Datos importados.',
    importError: 'Ese archivo no es una copia válida de la app.',
    importNewer: 'Esa copia es de una versión más nueva de la app. Actualizá la app primero.',
    install: 'Instalar la app',
    installHelp: 'Agregala a la pantalla de inicio para abrirla como una app.',

    // Banners
    updateAvailable: 'Hay una versión nueva',
    reload: 'Recargar',
    storageUnavailable: 'No se pueden guardar datos en este navegador. Lo que hagas se pierde al cerrar.',
    storageUnreadable: 'Los datos guardados no se pudieron leer. Empezamos de cero.',
    storageNewer: 'Tus datos son de una versión más nueva de la app. Hasta que recargues no se guarda nada.',
    downloadCopy: 'Descargar copia',
    unreadableTitle: 'Datos que no se pudieron leer',
    unreadableHelp: 'Quedó guardada una copia de los datos que la app no pudo leer. Podés descargarla para arreglarla a mano e importarla.',
    storageSaveFailed: 'No se pudo guardar el último cambio.',
    close: 'Cerrar',
  },
};

const LANG = 'es';

/** t('minutes', {n: 20}) → '20 min' */
export function t(key, vars = {}) {
  const text = STRINGS[LANG][key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));
}

export const lang = LANG;
