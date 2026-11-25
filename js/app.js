// UI. All text comes from strings.js, all scoring from scoring.js, all state
// changes go through state.js and are saved by commit().

import { ACTIONS, FAVORITES_MAX, MOOD_IDS, afterMealDue, mainCandidates, mealMinutes, nothingAvailable, outOfIdeas, pickCard, pickDish, pickSide, probabilities, sidesOf } from './scoring.js';
import { PARAMS, PARAM_GROUPS, applyParams, cleanParams, defaultParam, paramSource, paramValue, paramsJson } from './params.js';
import {
  MAX_MAINS,
  PORTIONS,
  addIngredients,
  allIngredients,
  allMains,
  bannedToday,
  boughtAll,
  cleanDish,
  cleanNames,
  cleanRecipe,
  declineDelivery,
  deliveryDeclinedToday,
  favoriteCount,
  hasEverything,
  hasNothing,
  haveEverything,
  haveNothing,
  isMissing,
  logAfterMeal,
  logCardAction,
  localDay,
  markInStock,
  markMissing,
  moodToday,
  normalizeState,
  pantryStatus,
  planUndo,
  setFavorites,
  setMood,
  togglePantry,
  undoBoughtAll,
  undoPantry,
  splitMissing,
  toggleFavorite,
  undoCardAction,
} from './state.js';
import {
  GROUP,
  cleanName,
  createGroup,
  dropQueuedPicks,
  flushQueue,
  formatCode,
  friendCounts,
  friendsByDay,
  friendsPicks,
  isLocalHost,
  joinGroup,
  leaveGroup,
  listGroup,
  newPickId,
  newSecret,
  normalizeCode,
  queuePick,
  queueUnpick,
  renameGroup,
  shouldShare,
} from './group.js';
import { STARTER_DISHES } from './dishes.js';
import { formatItem, itemAmount, mealMacros, parseItem } from './nutrition.js';
import { recipeFor } from './recipes.js';
import { dishMatches, nameMatch, searchKey, wordsKey } from './search.js';
import { STORAGE_KEY, loadState, readBackup, saveState } from './storage.js';
import { lang, t } from './strings.js';
import { createWheelView } from './wheel-view.js';
import { wheelStats } from './wheel.js';

const SWIPE_THRESHOLD = 80; // px
const FLY_MS = 180;
const TAP_SLOP = 6; // px: a pointer that moved less than this was a tap

const loaded = loadState();
let state = loaded.state;

// ---- Tuning (params.js): code ← params.json ← this phone ------------------

const PARAMS_FILE_KEY = 'qch:params-file'; // the last params.json that could be read
const GROUP_LISTS_KEY = 'qch:group-lists'; // each group's last list, by code (#23, #33), for the 💞 while offline
const OLD_GROUP_LIST_KEY = 'qch:group-list'; // the one group's last list, before #33
const paramsFile = { values: readCachedParams(), status: null }; // status: null (not yet) | 'ok' | 'error'

function readCachedParams() {
  try {
    return cleanParams(JSON.parse(localStorage.getItem(PARAMS_FILE_KEY) ?? '{}'));
  } catch {
    return {};
  }
}

function applyTuning() {
  applyParams(paramsFile.values, state.settings.params);
}

/**
 * Reads params.json past every cache. When it can't be read (offline, a typo
 * in the JSON), the last copy that could be read stays in use.
 */
async function refreshParamsFile() {
  let values;
  try {
    const response = await fetch('./params.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    values = cleanParams(await response.json());
  } catch {
    paramsFile.status = 'error';
    if (ui.tab === 'settings') render();
    return;
  }
  const changed = JSON.stringify(values) !== JSON.stringify(paramsFile.values);
  paramsFile.status = 'ok';
  if (changed) {
    paramsFile.values = values;
    try {
      localStorage.setItem(PARAMS_FILE_KEY, JSON.stringify(values));
    } catch {
      // Not saved for offline use; it's read again next time.
    }
    applyTuning();
  }
  if (changed || ui.tab === 'settings') render();
}

applyTuning();

const ui = {
  tab: 'today',
  currentId: null, // dish on the suggestion card (always a main)
  placed: null, // a main put on the card on purpose (a friend's 💞): it shows even when the ideas have run out (#53); any draw clears it
  sideId: null, // the side shown with it, or null ("sin acompañamiento", or a complete dish)
  sideFor: null, // the card the side was drawn for: a new card draws a new side
  pinnedSide: null, // 📌 a side the user fixed: only mains that go with it are suggested
  sideSheet: null, // {mode: 'card' | 'pick', mainId, sideId} while the "¿Con qué?" sheet is open
  favorites: null, // Set of dish ids while the "choose your favourites" question shows
  mood: false, // while the "¿Cómo está nuestro cocinero hoy?" question shows
  recipe: null, // {mainId, sideId} while the recipe sheet is open
  cooked: null, // {dishId, event, undo, shareId, sharedWith: [codes]} while the "¡A cocinar!" panel shows
  sheet: null, // {dishId, sideId, selected:Set} while the 🛒 sheet is open
  picking: null, // Comidas in pick mode (#48): {from: 'today' | 'dishes', search: Comidas' search before, from Hoy}
  readOnly: false, // stored data is from a newer app version: never save over it
  afterMeal: null, // {event, dishId, selected:Set, verdict} while the question shows
  editing: null, // {id} (id null = new dish) while the dish form shows
  wheel: null, // the delivery wheel's screen state while it is open (see wheel-view.js)
  banners: [], // [{id, text, actionLabel?, action?, sticky?}]
  saveWarned: false,
  installPrompt: null,
  tuningOpen: false, // the "Ajustes finos" section is expanded
  tuningCopied: false,
  // Ajustes → Grupos de amigos: the fields (`rename`: a new name per group code), the error and where it
  // goes (`errorFor`: a group code, or null for the create/join form), and `secret`, kept until a first
  // create or join succeeds so a retried join is the same member.
  groupForm: newGroupForm(),
  groupLists: readCachedGroupLists(), // {code: {code, time, you, groupName, members, picks}}: each group's last list
  openGroups: new Set(), // the codes of the groups opened in Ajustes, to see their members
  friends: null, // dishId while the "💞 También lo eligieron" sheet is open (over the card, or over the list)
  keepCard: null, // the dish put on the card from Amigos (#40): the mood question, if it shows then, leaves it there
  dishSearch: '', // Comidas (#46): what's typed in the search
  groupInvited: null, // the code of the group whose invitation was copied ("Copiar")
  // Despensa (#42)
  pantryView: 'have', // 'have' (🧺 Qué tengo) or 'list' (🛒 Lista de compras)
  pantrySearch: '', // what's typed in the search
  pantryUndo: null, // {kind: 'all' | 'nothing' | 'bought', before, until}: the bulk action that can be taken back for a while
  shopRows: null, // the list's rows in the order shown: bought ones stay crossed out until you leave it
  shopAdd: '', // what's typed in the list's add box
  pantryAllDone: false, // "Tengo todo" pressed since coming to Despensa: "Listo, ¿qué cocinamos?" shows anyway
  pantryStart: null, // Map ingredient → status when you came to Despensa: from PANTRY_DONE_AFTER changed ones on, "Listo, ¿qué cocinamos?" shows
};

const $ = (id) => document.getElementById(id);

// ---- Tiny DOM helper ----------------------------------------------------

function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key.includes('-') || key === 'role' || key === 'for') el.setAttribute(key, value);
    else el[key] = value;
  }
  el.append(...children.flat(Infinity).filter((c) => c != null && c !== false));
  return el;
}

function button(label, onclick, cls = '', props = {}) {
  return h('button', { type: 'button', class: `btn ${cls}`.trim(), onclick, ...props }, label);
}

/** A row of mutually exclusive buttons. options = [[value, label]]. */
function segmented(label, options, value, onChange) {
  return h(
    'div',
    { class: 'segmented', role: 'group', 'aria-label': label },
    options.map(([v, text]) =>
      h('button', { type: 'button', 'aria-pressed': String(v === value), onclick: () => onChange(v) }, text),
    ),
  );
}

/** Tappable ingredient chips backed by a Set of selected names. */
function chipPicker(names, selected, onChange = null) {
  return h(
    'div',
    { class: 'chips' },
    names.map((name) => {
      const chip = h(
        'button',
        {
          type: 'button',
          class: 'chip',
          'aria-pressed': String(selected.has(name)),
          onclick: () => {
            if (selected.has(name)) selected.delete(name);
            else selected.add(name);
            chip.setAttribute('aria-pressed', String(selected.has(name)));
            onChange?.();
          },
        },
        name,
      );
      return chip;
    }),
  );
}

function hueOf(text) {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.codePointAt(0)) % 360;
  return hash;
}

function gradientFor(dish) {
  const hue = hueOf(dish.id);
  return `linear-gradient(140deg, hsl(${hue} 85% 66%), hsl(${(hue + 45) % 360} 80% 52%))`;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---- State plumbing -----------------------------------------------------

function commit() {
  save();
  render();
}

/** Saves the state (unless this copy is read-only), warning once if it can't. commit() also redraws. */
function save() {
  if (ui.readOnly) return;
  if (!saveState(state) && !ui.saveWarned) {
    ui.saveWarned = true;
    addBanner('save', t('storageSaveFailed'));
  }
}

function addBanner(id, text, { actionLabel, action, sticky = false } = {}) {
  ui.banners = ui.banners.filter((b) => b.id !== id);
  ui.banners.push({ id, text, actionLabel, action, sticky });
  renderBanners();
}

/** Takes a banner away (the 📌 one from Amigos goes on its own, or with the next card). */
function dropBanner(id) {
  if (!ui.banners.some((b) => b.id === id)) return;
  ui.banners = ui.banners.filter((b) => b.id !== id);
  renderBanners();
}

function downloadText(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = h('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const today = () => new Date().toISOString().slice(0, 10);
const downloadBackup = (text) => downloadText(text, `que-comemos-hoy-ilegible-${today()}.txt`);

/** Tells the user about a problem found by loadState(). */
function reportLoadProblem({ problem, raw }) {
  ui.readOnly = problem === 'newer';
  if (problem === 'unavailable') {
    ui.saveWarned = true;
    addBanner('storage', t('storageUnavailable'));
  } else if (problem === 'unreadable') {
    addBanner('storage', t('storageUnreadable'), { actionLabel: t('downloadCopy'), action: () => downloadBackup(raw) });
  } else if (problem === 'newer') {
    addBanner('storage', t('storageNewer'), { actionLabel: t('reload'), action: () => window.location.reload(), sticky: true });
  }
}

const dishById = (id) => state.dishes.find((d) => d.id === id);

function scoringContext() {
  const missing = (name) => isMissing(state, name);
  return {
    now: Date.now(),
    events: state.events,
    dishes: state.dishes,
    isMissing: missing,
    // Once per context, over every dish, so mains and sides always use the same mode (#52).
    pantryEmpty: nothingAvailable(state.dishes, missing),
    pinnedSideId: ui.pinnedSide,
    mood: moodToday(state, Date.now()),
    friends: friendCounts(currentGroupLists(), Date.now()),
  };
}

/** The mains the card can show: all of them, or only those that go with the pinned side. */
const cardCandidates = () => mainCandidates(state.dishes, ui.pinnedSide);

function pick(exclude = []) {
  const variety = state.settings.variety;
  const ctx = scoringContext();
  const candidates = cardCandidates();
  return pickCard(candidates, ctx, variety, { exclude, banned: bannedToday(state.events, ctx.now) });
}

/** Every main the card could draw is banned today (#53), and the card isn't one put there on purpose. */
function ranOut() {
  if (ui.currentId && ui.currentId === ui.placed) return false;
  return outOfIdeas(cardCandidates(), scoringContext(), bannedToday(state.events, Date.now()));
}

function nextCard() {
  ui.keepCard = null;
  dropBanner('pin');
  ui.currentId = pick(ui.currentId ? [ui.currentId] : [])?.id ?? null;
  ui.placed = null; // drawn, not put there: the same dish drawn later is an ordinary card
  ui.sideFor = null;
}

function ensureCurrent() {
  if (ui.pinnedSide && !dishById(ui.pinnedSide)) ui.pinnedSide = null;
  const current = dishById(ui.currentId);
  if (!current || current.neverShow || !cardCandidates().includes(current)) {
    ui.currentId = pick()?.id ?? null;
    ui.placed = null;
    ui.sideFor = null;
  }
  ensureSide();
}

/** Draws the side for the card once per card, and again if the one shown went away. */
function ensureSide() {
  const main = dishById(ui.currentId);
  if (!main) {
    ui.sideId = ui.sideFor = null;
    return;
  }
  const options = sidesOf(main, state.dishes);
  const stillThere = ui.sideId === null || options.some((d) => d.id === ui.sideId);
  if (ui.sideFor === main.id && stillThere) return;
  ui.sideFor = main.id;
  ui.sideId = options.some((d) => d.id === ui.pinnedSide)
    ? ui.pinnedSide
    : (pickSide(main, scoringContext(), state.settings.variety)?.id ?? null);
}

/** "Milanesas con puré de papas", or just the main's name. */
function mealName(main, side) {
  if (!side) return main.name;
  return t('mealWith', { main: main.name, side: side.name.charAt(0).toLocaleLowerCase('es') + side.name.slice(1) });
}

/** Ingredients of a main and its side, without repeats. */
const mealIngredients = (main, side) => [...new Set([...main.ingredients, ...(side?.ingredients ?? [])])];

function checkAfterMeal() {
  if (ui.afterMeal || ui.sheet || ui.sideSheet || ui.favorites || ui.friends) return;
  const due = afterMealDue(state.events, state.dishes, Date.now());
  if (!due) return;
  ui.afterMeal = { event: due.event, dishId: due.dish.id, selected: new Set(), verdict: null };
  ui.cooked = null;
}

// ---- Card actions -------------------------------------------------------

/** Logs a meal: the card's dish with its side, or any dish picked from the whole list. */
function cook(action, missing = [], dishId = ui.currentId, sideId = dishId === ui.currentId ? ui.sideId : null) {
  const dish = dishById(dishId);
  if (!dish) return;
  if (cookedToday()) dropCooked(); // picked in Comidas instead: the person said yes to replacing it (confirmReplaceCooked)
  const undo = planUndo(state, dish.id, missing, sideId);
  const event = logCardAction(state, dish.id, action, missing, Date.now(), sideId);
  // One pick, with one id, to every group sharing (#33), so "Deshacer" takes it back from all of them.
  const sharedWith = state.settings.groups.filter((g) => shouldShare(g, dish.id, window.location.hostname));
  const shareId = sharedWith.length > 0 ? newPickId() : null;
  for (const group of sharedWith) queuePick(group, dish.id, event.time, shareId);
  ui.cooked = { dishId: dish.id, event, undo, shareId, sharedWith: sharedWith.map((g) => g.code) };
  ui.sheet = null;
  ui.sideSheet = null;
  ui.pinnedSide = null; // the pin was for tonight's meal
  commit();
  flushGroup();
  if (ui.picking) {
    switchTab('today'); // picked in Comidas (#48): "¡A cocinar!" is on Hoy
    focusToday();
  }
}

/**
 * "Me falta" when only the side's ingredients are missing: the side gets the
 * light "missing" penalty and is swapped for another one. The main is untouched.
 */
function changeSideForMissing(missing) {
  const main = dishById(ui.currentId);
  const old = ui.sideId;
  if (!main || !old) return;
  logCardAction(state, old, ACTIONS.MISSING_REJECT, missing, Date.now(), null, true); // as a side: no ban on it as a main (#53)
  if (ui.pinnedSide === old) ui.pinnedSide = null;
  // Don't offer a side that needs what just ran out (papas fritas after "no hay papa").
  const options = sidesOf(main, state.dishes);
  const blocked = options.filter((d) => d.id === old || d.ingredients.some((i) => missing.includes(i))).map((d) => d.id);
  ui.sideId = pickDish(options, { ...scoringContext(), asSide: true }, state.settings.variety, { exclude: blocked })?.id ?? null;
  ui.sideFor = main.id;
  ui.sheet = null;
  commit();
}

function togglePin() {
  const side = dishById(ui.sideId);
  if (ui.pinnedSide) ui.pinnedSide = null;
  else if (side) ui.pinnedSide = side.id;
  dropBanner('pin');
  render();
}

function unpin() {
  ui.pinnedSide = null;
  render();
}

function openSideSheet(mode, mainId, sideId) {
  ui.sideSheet = { mode, mainId, sideId };
  render();
}

function reject(action, missing = []) {
  const dish = dishById(ui.currentId);
  if (!dish) return;
  logCardAction(state, dish.id, action, missing);
  ui.sheet = null;
  nextCard();
  commit();
}

function undoCook() {
  dropCooked(); // back to the card that was showing
  commit();
  flushGroup();
}

/**
 * "¡A cocinar!" of a meal logged today, or null. One from an earlier day (the screen left
 * open overnight) only leaves the screen: it was a real meal, and stays in the log.
 */
function cookedToday() {
  if (ui.cooked && localDay(ui.cooked.event.time) !== localDay(Date.now())) ui.cooked = null;
  return ui.cooked;
}

/** Takes back the meal "¡A cocinar!" shows: its log, and its pick in the groups. */
function dropCooked() {
  const { event, undo, shareId, sharedWith } = ui.cooked;
  undoCardAction(state, event, undo);
  for (const group of state.settings.groups) if (shareId && sharedWith.includes(group.code)) queueUnpick(group, shareId);
  ui.cooked = null;
}

function openMissingSheet() {
  const dish = dishById(ui.currentId);
  if (!dish) return;
  const side = dishById(ui.sideId);
  const selected = new Set(mealIngredients(dish, side).filter((i) => state.missing.includes(i)));
  ui.sheet = { dishId: dish.id, sideId: side?.id ?? null, selected };
  render();
}

/** Slides the card out, then runs the action. */
function flyCard(toRight, action) {
  const card = document.querySelector('.card');
  if (!card || reducedMotion()) return action();
  if (card.classList.contains('flying')) return; // already on its way out
  card.classList.add('flying');
  card.style.transform = `translateX(${toRight ? 140 : -140}%) rotate(${toRight ? 18 : -18}deg)`;
  card.style.opacity = '0';
  setTimeout(action, FLY_MS);
}

const swipeRight = () => flyCard(true, () => cook(ACTIONS.COOK));
const swipeLeft = () => flyCard(false, () => reject(ACTIONS.REJECT));

// The delivery card (#53): 👉 opens the wheel, 👈 declines it for today.
const deliveryRight = () =>
  flyCard(true, () => {
    wheelView.open(); // the card is still there when the wheel closes
  });
const deliveryLeft = () =>
  flyCard(false, () => {
    // A card left on screen past midnight: today's bans have lapsed, so there is nothing to decline.
    if (ranOut()) declineDelivery(state, Date.now());
    commit();
    focusToday();
  });

// What the arrow keys do on Hoy right now: set by viewToday(), null when nothing is swipeable.
let cardKeys = null;

/** Drag to swipe. `right`/`left` run past the threshold, `tap` (optional) on a tap. */
function attachSwipe(card, { right, left, tap = null }) {
  let startX = 0;
  let dx = 0;
  let pointerId = null;
  const stampYes = card.querySelector('.stamp-yes');
  const stampNo = card.querySelector('.stamp-no');

  const reset = () => {
    card.classList.remove('dragging');
    card.style.transform = '';
    stampYes.style.opacity = stampNo.style.opacity = '0';
  };

  card.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || card.classList.contains('flying')) return;
    if (e.target.closest('button')) return; // the side chip and the pin are taps, not drags
    pointerId = e.pointerId;
    startX = e.clientX;
    dx = 0;
    card.setPointerCapture(pointerId);
    card.classList.add('dragging');
  });
  card.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    dx = e.clientX - startX;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
    const strength = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD);
    stampYes.style.opacity = dx > 0 ? String(strength) : '0';
    stampNo.style.opacity = dx < 0 ? String(strength) : '0';
  });
  card.addEventListener('pointerup', (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    card.classList.remove('dragging');
    if (dx > SWIPE_THRESHOLD) right();
    else if (dx < -SWIPE_THRESHOLD) left();
    else {
      reset();
      if (tap && Math.abs(dx) < TAP_SLOP) tap(); // a tap, not a drag
    }
  });
  card.addEventListener('pointercancel', () => {
    pointerId = null;
    reset();
  });
}

// ---- Views --------------------------------------------------------------

function setVariety(value) {
  state.settings.variety = value;
  commit();
}

function varietyControl() {
  return segmented(
    t('variety'),
    [
      ['low', t('varietyLow')],
      ['medium', t('varietyMedium')],
      ['high', t('varietyHigh')],
    ],
    state.settings.variety,
    setVariety,
  );
}

const MOOD_EMOJI = { lazy: '🛋️', rushed: '⏱️', yum: '😋', healthy: '🥦', different: '✨', usual: '🙂' };

const openMood = () => {
  ui.mood = true;
  render();
};

/** Today's mood next to the title: just its emoji, so Hoy needs no extra row on small phones. Tapping reopens the question. */
function moodChip() {
  const id = moodToday(state, Date.now()) ?? 'usual';
  const label = t('moodChange', { name: t(`moodShort:${id}`) });
  return h(
    'button',
    { type: 'button', class: 'side-chip mood-chip', 'aria-label': label, title: label, onclick: openMood },
    MOOD_EMOJI[id],
    h('span', { class: 'caret', 'aria-hidden': 'true' }, '▾'),
  );
}

function dots(value) {
  const n = Math.round(value);
  return h('span', { class: 'dots', 'aria-hidden': 'true' }, '●'.repeat(n), h('span', { class: 'dots-off' }, '●'.repeat(5 - n)));
}

function rating(label, value) {
  return h('span', { class: 'rating', 'aria-label': `${label}: ${t('outOf5', { n: Math.round(value) })}` }, `${label} `, dots(value));
}

const wheelView = createWheelView({
  h,
  button,
  t,
  lang,
  ui,
  getState: () => state,
  commit: () => commit(),
  render: () => render(),
  reducedMotion,
});

const wheelButton = (cls = '') => button(`🎡 ${t('wheelOpen')}`, wheelView.open, cls);

function viewToday() {
  if (ui.wheel) return wheelView.view();

  const header = h(
    'header',
    { class: 'top' },
    h('h1', null, t('appName')),
    moodChip(),
    h('div', { class: 'variety' }, h('span', { class: 'label' }, t('variety')), varietyControl()),
  );

  cardKeys = null;
  if (ui.cooked && dishById(ui.cooked.dishId)) return [header, viewCooked()];

  ensureCurrent();
  const pinned = dishById(ui.pinnedSide);
  // The ideas have run out (#53): no card for now. Drawn again when a dish comes back.
  const out = ranOut();
  if (out) ui.currentId = ui.sideFor = ui.sideId = null;
  const dish = dishById(ui.currentId);
  const pinNote =
    pinned &&
    h('div', { class: 'pin-note', role: 'status' }, h('span', null, t('pinnedNote', { name: pinned.name.toLocaleLowerCase('es') })), button(t('unpinShort'), unpin, 'small ghost'));
  if (!dish && pinned) {
    const name = pinned.name.toLocaleLowerCase('es');
    return [
      header,
      h(
        'section',
        { class: 'empty' },
        h('div', { class: 'empty-emoji', 'aria-hidden': 'true' }, pinned.emoji),
        h('h2', null, t(out ? 'pinnedRanOut' : 'pinnedNone', { name })),
        h('p', null, t(out ? 'pinnedRanOutText' : 'pinnedNoneText', { name })),
        button(`📌 ${t('unpinShort')}`, unpin, 'primary'),
      ),
    ];
  }
  if (out && !deliveryDeclinedToday(state, Date.now())) return [header, ...viewDeliveryCard()];
  if (out) {
    return [
      header,
      h(
        'section',
        { class: 'empty out-of-ideas' },
        h('h2', null, t('outOfIdeasTitle')),
        h('p', null, t('outOfIdeasText')),
        button(`📖 ${t('pickFromList')}`, openPicker, 'pick-open'),
      ),
      wheelButton('wide'),
    ];
  }
  if (!dish) {
    return [
      header,
      h(
        'section',
        { class: 'empty' },
        h('div', { class: 'empty-emoji', 'aria-hidden': 'true' }, '🍽️'),
        h('h2', null, t('noDishesTitle')),
        h('p', null, t('noDishesText')),
        button(t('goToDishes'), () => switchTab('dishes'), 'primary'),
        state.dishes.length > 0 && button(`📖 ${t('pickFromList')}`, openPicker, 'pick-open'),
      ),
      wheelButton('wide'),
    ];
  }

  const side = dishById(ui.sideId);
  const hasSides = sidesOf(dish, state.dishes).length > 0;
  const missingNow = mealIngredients(dish, side).filter((i) => isMissing(state, i));
  const isPinned = Boolean(side && ui.pinnedSide === side.id);
  const sideRow =
    hasSides &&
    h(
      'div',
      { class: 'side-row' },
      h('span', { class: 'label' }, t('withSide')),
      h(
        'button',
        {
          type: 'button',
          class: 'side-chip',
          'aria-label': t('changeSide', { name: dish.name }),
          onclick: () => openSideSheet('card', dish.id, ui.sideId),
        },
        side ? `${side.emoji} ${side.name}` : t('noSide'),
        h('span', { class: 'caret', 'aria-hidden': 'true' }, '▾'),
      ),
      side &&
        h(
          'button',
          {
            type: 'button',
            class: 'pin',
            'aria-pressed': String(isPinned),
            'aria-label': isPinned ? t('unpin', { name: side.name }) : t('pin', { name: side.name }),
            title: isPinned ? t('unpin', { name: side.name }) : t('pin', { name: side.name }),
            onclick: togglePin,
          },
          '📌',
        ),
    );
  const card = h(
    'article',
    { class: 'card', 'aria-label': dish.name },
    h(
      'div',
      { class: 'card-art', style: `background:${gradientFor(dish)}` },
      h('span', { class: 'card-emoji', 'aria-hidden': 'true' }, dish.emoji),
      friendsPicks(currentGroupLists(), Date.now()).has(dish.id) &&
        h(
          'button',
          { type: 'button', class: 'friends-mark', 'aria-label': t('friendsMark'), title: t('friendsMark'), onclick: () => openFriends(dish.id) },
          '💞',
        ),
      h('span', { class: 'stamp stamp-yes', 'aria-hidden': 'true' }, `👉 ${t('actionCook')}`),
      h('span', { class: 'stamp stamp-no', 'aria-hidden': 'true' }, `👈 ${t('actionReject')}`),
    ),
    h(
      'div',
      { class: 'card-body' },
      h('h2', null, dish.favorite && h('span', { class: 'fav', 'aria-label': t('favorite') }, '⭐ '), dish.name),
      sideRow,
      h(
        'p',
        { class: 'meta' },
        h('span', null, `⏱ ${t('minutes', { n: mealMinutes(dish, side) })}`),
        rating(t('health'), dish.health),
        rating(t('yum'), dish.yum),
      ),
      h('p', { class: 'label' }, t('mainIngredients')),
      h('div', { class: 'chips static' }, dish.mains.map((m) => h('span', { class: 'chip' }, m))),
      missingNow.length > 0 && h('p', { class: 'missing-now' }, t('missingNow', { list: missingNow.join(', ') })),
      cardFoot(dish, side),
    ),
  );
  attachSwipe(card, { right: swipeRight, left: swipeLeft, tap: () => openRecipe(ui.currentId, ui.sideId) });
  cardKeys = { right: swipeRight, left: swipeLeft };

  return [
    header,
    pinNote,
    h('div', { class: 'card-area' }, card),
    h(
      'div',
      { class: 'actions' },
      h('button', { type: 'button', class: 'action no', onclick: swipeLeft }, h('span', { 'aria-hidden': 'true' }, '👈'), t('actionReject')),
      h('button', { type: 'button', class: 'action cart', onclick: openMissingSheet }, h('span', { 'aria-hidden': 'true' }, '🛒'), t('actionMissing')),
      h('button', { type: 'button', class: 'action yes', onclick: swipeRight }, h('span', { 'aria-hidden': 'true' }, '👉'), t('actionCook')),
    ),
    h('div', { class: 'row more' }, button(`📖 ${t('pickFromList')}`, openPicker, 'pick-open'), wheelButton()),
    h('p', { class: 'hint' }, t('swipeHint')),
  ];
}

/** "¿Pedimos?" (#53): when the ideas run out, 👉 opens the delivery wheel and 👈 declines it for today. */
function viewDeliveryCard() {
  const card = h(
    'article',
    { class: 'card delivery-card', 'aria-label': t('deliveryCardTitle') },
    h(
      'div',
      { class: 'card-art', style: 'background:linear-gradient(135deg, #f6d365, #fda085)' },
      h('span', { class: 'card-emoji', 'aria-hidden': 'true' }, '🛵'),
      h('span', { class: 'stamp stamp-yes', 'aria-hidden': 'true' }, `👉 ${t('deliveryYes')}`),
      h('span', { class: 'stamp stamp-no', 'aria-hidden': 'true' }, `👈 ${t('deliveryNo')}`),
    ),
    h('div', { class: 'card-body' }, h('h2', null, t('deliveryCardTitle')), h('p', null, t('deliveryCardText'))),
  );
  attachSwipe(card, { right: deliveryRight, left: deliveryLeft });
  cardKeys = { right: deliveryRight, left: deliveryLeft };
  return [
    h('div', { class: 'card-area' }, card),
    h(
      'div',
      { class: 'actions two' },
      h('button', { type: 'button', class: 'action no', onclick: deliveryLeft }, h('span', { 'aria-hidden': 'true' }, '👈'), t('deliveryNo')),
      h('button', { type: 'button', class: 'action yes', onclick: deliveryRight }, h('span', { 'aria-hidden': 'true' }, '👉'), t('deliveryYes')),
    ),
    h('div', { class: 'row more' }, button(`📖 ${t('pickFromList')}`, openPicker, 'pick-open')),
  ];
}

function viewCooked() {
  const dish = dishById(ui.cooked.dishId);
  const side = dishById(ui.cooked.event.sideId);
  const toBuy = ui.cooked.event.missing;
  return h(
    'section',
    { class: 'cooked' },
    h(
      'div',
      { class: 'cooked-art', style: `background:${gradientFor(dish)}` },
      h('span', { 'aria-hidden': 'true' }, side ? `${dish.emoji}${side.emoji}` : dish.emoji),
    ),
    h('h2', null, t('cookedTitle')),
    h('p', null, t('cookedText', { name: mealName(dish, side).toLocaleLowerCase('es') })),
    h('p', { class: 'label' }, t('ingredients')),
    h('div', { class: 'chips static' }, mealIngredients(dish, side).map((i) => h('span', { class: 'chip' }, i))),
    toBuy.length > 0 && h('p', { class: 'missing-now' }, `🛒 ${t('cookedToBuy', { list: toBuy.join(', ') })}`),
    h(
      'div',
      { class: 'row' },
      button(t('undo'), undoCook),
      button(`📝 ${t('recipe')}`, () => openRecipe(dish.id, side?.id ?? null)),
      button(
        t('suggestAnother'),
        () => {
          ui.cooked = null;
          nextCard();
          render();
        },
        'primary',
      ),
    ),
  );
}

function starButton(dish) {
  return h(
    'button',
    {
      type: 'button',
      class: 'star',
      'aria-pressed': String(dish.favorite),
      'aria-label': dish.favorite ? t('favoriteRemove', { name: dish.name }) : t('favoriteAdd', { name: dish.name }),
      onclick: () => {
        if (toggleFavorite(state, dish.id)) commit();
        else addBanner('favorites', t('favoritesFull', { n: FAVORITES_MAX }));
      },
    },
    dish.favorite ? '⭐' : '☆',
  );
}

function dishRow(dish, friends, picking) {
  const sideCount = dish.role === 'main' ? sidesOf(dish, state.dishes).length : 0;
  const sidesText = sideCount === 0 ? '' : ` · ${sideCount === 1 ? t('sidesCountOne') : t('sidesCount', { n: sideCount })}`;
  const picked = friends.has(dish.id);
  return h(
    'li',
    { class: 'list-item', 'data-dish': dish.id },
    h(
      'span',
      { class: 'dish-row' },
      h(
        'button',
        {
          type: 'button',
          class: 'list-row',
          'aria-describedby': picking ? (dish.role === 'side' ? 'dish-sides-help' : 'pick-help') : null,
          onclick: () => (!picking ? openDishForm(dish.id) : dish.role === 'side' ? pinFromList(dish) : pickFromList(dish)),
        },
        h('span', { class: 'list-emoji', style: `background:${gradientFor(dish)}`, 'aria-hidden': 'true' }, dish.emoji),
        h(
          'span',
          { class: 'list-text' },
          h('span', { class: 'list-name' }, dish.name),
          h(
            'span',
            { class: 'list-meta' },
            `⏱ ${t('minutes', { n: dish.cookMinutes })} · ${t('health')} ${Math.round(dish.health)} · ${t('yum')} ${Math.round(dish.yum)}${sidesText}`,
          ),
        ),
        dish.neverShow && h('span', { class: 'badge' }, t('hidden')),
        picking && dish.role === 'side' && h('span', { class: 'badge' }, `📌 ${t('pinBadge')}`), // a tap pins it, not logs it
      ),
      picked &&
        h(
          'button',
          {
            type: 'button',
            class: 'pick-mark dish-mark',
            'aria-label': t('friendsMarkOf', { name: dish.name }),
            title: t('friendsMark'),
            onclick: () => openFriends(dish.id),
          },
          h('span', { 'aria-hidden': 'true' }, '💞'),
        ),
    ),
    recipeFor(dish) &&
      h(
        'button',
        { type: 'button', class: 'star', 'aria-label': t('recipeOf', { name: dish.name }), onclick: () => openRecipe(dish.id, null) },
        '📝',
      ),
    dish.role === 'main' && starButton(dish),
  );
}

/** The dishes with a 💞 in Comidas (#46). viewDishes() keeps what it drew, so a refresh redraws only when they change. */
const dishMarks = () => JSON.stringify([...friendsPicks(currentGroupLists(), Date.now()).keys()].filter((id) => dishById(id)).sort());
let dishMarksDrawn = null;

function viewDishes() {
  if (ui.editing) return viewDishForm();
  const picking = Boolean(ui.picking);
  // Picking (#48), only the sides a pin can show on Hoy: not hidden, and going with some main.
  const pinnable = (d) => !d.neverShow && mainCandidates(state.dishes, d.id).length > 0;
  const sides = state.dishes.filter((d) => d.role === 'side' && (!picking || pinnable(d)));
  const friends = friendsPicks(currentGroupLists(), Date.now());
  dishMarksDrawn = dishMarks();
  const row = (dish) => dishRow(dish, friends, picking);
  const search = h('input', {
    id: 'dish-search',
    type: 'search',
    value: ui.dishSearch,
    placeholder: picking ? t('pickSearch') : t('dishSearch'), // the mode, where the eye is once scrolled down
    'aria-label': picking ? t('pickSearch') : t('dishSearch'),
    autocomplete: 'off',
    autocapitalize: 'none',
    enterKeyHint: 'search',
    oninput: (e) => {
      ui.dishSearch = e.target.value;
      filterDishes();
    },
    onkeydown: (e) => {
      if (e.key === 'Enter') e.target.blur(); // closes the phone's keyboard, to see the list
    },
  });
  const clear = button('✕', () => {
    ui.dishSearch = '';
    search.value = '';
    filterDishes();
    search.focus({ preventScroll: true });
  }, 'search-clear ghost', { 'aria-label': t('dishSearchClear') });
  return [
    h('header', { class: 'top' }, h('h1', { id: 'dish-title', tabIndex: -1 }, picking ? t('pickTitle') : t('dishesTitle'))),
    picking
      ? h('p', { class: 'help', id: 'pick-help' }, t('pickHelp'))
      : h(
          'div',
          { class: 'row' },
          button(`＋ ${t('addDish')}`, () => openDishForm(null), 'primary'),
          mainCandidates(state.dishes).length > 0 && button(`🍽️ ${t('pickHere')}`, openPicker, 'pick-enter'),
        ),
    h(
      'div',
      { class: 'dish-bar' },
      h('div', { class: 'search-row dish-search' }, search, clear),
      picking && button(t('cancel'), closePicker, 'pick-cancel'), // in reach wherever the list is scrolled
    ),
    h('ul', { class: 'list dish-list' }, mainCandidates(state.dishes).map(row)),
    sides.length > 0 && h('h2', { class: 'list-heading dish-sides-heading' }, picking ? t('pickSidesFirst') : t('sidesSection')),
    sides.length > 0 && picking && h('p', { class: 'help dish-sides-help', id: 'dish-sides-help' }, t('pickSidesFirstHelp')),
    sides.length > 0 && h('ul', { class: 'list dish-list dish-sides' }, sides.map(row)),
    h('p', { class: 'muted dish-none', role: 'status' }), // always there, so a screen reader hears its text come
  ];
}

/** Shows only the dishes whose name matches the search (#46). In place, so the keyboard stays up. */
function filterDishes() {
  let shown = 0;
  for (const item of document.querySelectorAll('#view .dish-list > .list-item')) {
    const dish = dishById(item.dataset.dish);
    item.hidden = !(dish && dishMatches(dish, ui.dishSearch));
    if (!item.hidden) shown++;
  }
  const anySide = Boolean(document.querySelector('#view .dish-sides > .list-item:not([hidden])'));
  for (const el of document.querySelectorAll('#view .dish-sides-heading, #view .dish-sides-help')) el.hidden = !anySide;
  const none = document.querySelector('#view .dish-none');
  if (none) none.textContent = shown > 0 || wordsKey(ui.dishSearch) === '' ? '' : t('dishNoMatch');
  const clear = document.querySelector('#view .dish-search .search-clear');
  if (clear) clear.hidden = ui.dishSearch === '';
}

function openDishForm(id) {
  ui.editing = { id };
  render();
  window.scrollTo(0, 0);
}

function closeDishForm() {
  ui.editing = null;
  render();
}

const splitList = (text) => cleanNames(String(text).split(','));

function viewDishForm() {
  const original = ui.editing.id ? dishById(ui.editing.id) : null;
  const dish = original ?? { name: '', emoji: '🍽️', ingredients: [], mains: [], cookMinutes: 30, health: 3, yum: 3, neverShow: false, role: 'main', sides: [] };
  const picked = { health: Math.round(dish.health), yum: Math.round(dish.yum), role: dish.role };
  const chosenSides = new Set(dish.sides);

  const name = h('input', { id: 'f-name', type: 'text', value: dish.name, autocomplete: 'off', required: true });

  // The recipe: the dish's own, or the starter one it shows until the user changes it.
  const shownRecipe = original ? recipeFor(original) : null;
  let recipeTouched = false;
  const touch = () => {
    recipeTouched = true;
  };
  const serves = h('input', {
    id: 'f-serves',
    type: 'number',
    min: String(PORTIONS.min),
    max: String(PORTIONS.max),
    step: '1',
    inputMode: 'numeric',
    value: String(shownRecipe?.serves ?? PORTIONS.default),
    oninput: touch,
  });
  const recipeItems = h('textarea', {
    id: 'f-recipe-items',
    rows: 6,
    autocapitalize: 'none',
    value: (shownRecipe?.items ?? []).map((i) => formatItem(i, shownRecipe.serves)).join('\n'),
    oninput: touch,
  });
  const recipeSteps = h('textarea', {
    id: 'f-recipe-steps',
    rows: 6,
    value: (shownRecipe?.steps ?? []).join('\n'),
    oninput: touch,
  });
  const emoji = h('input', { id: 'f-emoji', type: 'text', value: dish.emoji, autocomplete: 'off', class: 'emoji-input' });
  const ingredients = h('input', { id: 'f-ingredients', type: 'text', value: dish.ingredients.join(', '), autocomplete: 'off', autocapitalize: 'none' });
  // The 🔑 ingredients (#52): one chip per ingredient. Changing an ingredient's text drops its key
  // on save (cleanDish keeps only keys among the ingredients), not while typing: "spato" on the way
  // to "sal, pato" mustn't lose pato's 🔑.
  const keys = new Set(dish.keyIngredients ?? []);
  const keyChips = h('div', { class: 'chips', role: 'group', 'aria-labelledby': 'f-keys-label' });
  const keyChip = (name) => {
    const chip = h('button', {
      type: 'button',
      class: 'chip small',
      onclick: () => {
        if (keys.has(name)) keys.delete(name);
        else keys.add(name);
        paint();
      },
    });
    const paint = () => {
      chip.setAttribute('aria-pressed', String(keys.has(name)));
      chip.textContent = keys.has(name) ? `🔑 ${name}` : name;
    };
    paint();
    return chip;
  };
  const syncKeys = () => keyChips.replaceChildren(...splitList(ingredients.value).map(keyChip));
  ingredients.addEventListener('input', syncKeys);
  syncKeys();
  const mains = h('input', { id: 'f-mains', type: 'text', value: dish.mains.join(', '), autocomplete: 'off', autocapitalize: 'none' });
  const minutes = h('input', { id: 'f-minutes', type: 'number', min: '0', max: '1440', step: '5', inputMode: 'numeric', value: String(dish.cookMinutes) });
  const neverShow = h('input', { id: 'f-never', type: 'checkbox', checked: dish.neverShow });
  const error = h('p', { class: 'error', role: 'alert' });

  // Existing category tags as shortcuts for the "main ingredients" field.
  const tagChips = h(
    'div',
    { class: 'chips' },
    allMains(state).map((tag) => {
      const chip = h(
        'button',
        {
          type: 'button',
          class: 'chip small',
          onclick: () => {
            const current = splitList(mains.value);
            const next = current.includes(tag) ? current.filter((x) => x !== tag) : [...current, tag];
            if (next.length > MAX_MAINS) return;
            mains.value = next.join(', ');
            syncTags();
          },
        },
        tag,
      );
      chip.dataset.tag = tag;
      return chip;
    }),
  );
  const syncTags = () => {
    const current = splitList(mains.value);
    for (const chip of tagChips.children) chip.setAttribute('aria-pressed', String(current.includes(chip.dataset.tag)));
  };
  mains.addEventListener('input', syncTags);
  syncTags();

  const scale = (key, label) => {
    const group = h('div', { class: 'segmented', role: 'group', 'aria-label': label });
    const draw = () =>
      group.replaceChildren(
        ...[1, 2, 3, 4, 5].map((n) =>
          h(
            'button',
            {
              type: 'button',
              'aria-pressed': String(picked[key] === n),
              onclick: () => {
                picked[key] = n;
                draw();
              },
            },
            String(n),
          ),
        ),
      );
    draw();
    return group;
  };

  // Role (plato / acompañamiento), and for a plato the dishes that go with it.
  const roleHelp = h('p', { class: 'help' });
  const sidesField = h('div', { class: 'field' });
  const otherDishes = state.dishes.filter((d) => d.id !== original?.id);
  const sideOptions = [...otherDishes.filter((d) => d.role === 'side'), ...otherDishes.filter((d) => d.role === 'main')];
  const roleGroup = h('div', { class: 'segmented', role: 'group', 'aria-label': t('fieldRole') });
  const drawRole = () => {
    roleGroup.replaceChildren(
      ...[
        ['main', t('roleMain')],
        ['side', t('roleSide')],
      ].map(([value, label]) =>
        h(
          'button',
          {
            type: 'button',
            'aria-pressed': String(picked.role === value),
            onclick: () => {
              picked.role = value;
              drawRole();
            },
          },
          label,
        ),
      ),
    );
    roleHelp.textContent = picked.role === 'side' ? t('roleHelpSide') : t('roleHelpMain');
    sidesField.hidden = picked.role === 'side';
  };
  sidesField.append(
    h('span', { class: 'field-label' }, t('fieldSides')),
    h('p', { class: 'help' }, t('fieldSidesHelp')),
    h(
      'div',
      { class: 'chips' },
      sideOptions.map((option) => {
        const chip = h(
          'button',
          {
            type: 'button',
            class: 'chip small',
            'aria-pressed': String(chosenSides.has(option.id)),
            onclick: () => {
              if (chosenSides.has(option.id)) chosenSides.delete(option.id);
              else chosenSides.add(option.id);
              chip.setAttribute('aria-pressed', String(chosenSides.has(option.id)));
            },
          },
          `${option.emoji} ${option.name}`,
        );
        return chip;
      }),
    ),
  );
  drawRole();

  const save = (e) => {
    e.preventDefault();
    const mainsList = splitList(mains.value);
    const minutesValue = Number(minutes.value);
    let problem = null;
    if (!name.value.trim()) problem = 'errorName';
    else if (mainsList.length < 1 || mainsList.length > MAX_MAINS) problem = 'errorMains';
    else if (minutes.value.trim() === '' || !Number.isFinite(minutesValue) || minutesValue < 0) problem = 'errorMinutes';
    if (problem) {
      error.textContent = t(problem);
      return;
    }
    // Health and yum can hold fractions (after-meal 👍/👎): keep them unless the user picked another number.
    const keep = (key) => (original && Math.round(original[key]) === picked[key] ? original[key] : picked[key]);
    const saved = cleanDish({
      id: original?.id ?? `d-${Date.now().toString(36)}`,
      name: name.value,
      emoji: emoji.value,
      ingredients: splitList(ingredients.value),
      keyIngredients: [...keys],
      mains: mainsList,
      cookMinutes: minutesValue,
      effort: original?.effort, // hidden: an edit keeps it, a new dish gets the default
      health: keep('health'),
      yum: keep('yum'),
      liking: original?.liking ?? 0,
      neverShow: neverShow.checked,
      role: picked.role,
      sides: picked.role === 'side' ? [] : sideOptions.filter((o) => chosenSides.has(o.id)).map((o) => o.id),
      favorite: picked.role === 'main' && original?.favorite === true,
      recipe: recipeTouched
        ? cleanRecipe({
            serves: serves.value,
            items: recipeItems.value.split('\n').map(parseItem).filter(Boolean),
            steps: recipeSteps.value.split('\n').map((line) => line.replace(/^\s*\d+[.)]\s*/, '')),
          })
        : // Untouched: keep its own, and keep the starter recipe if the dish is renamed (it would stop showing).
          (original?.recipe ?? (shownRecipe && name.value.trim() !== original?.name ? shownRecipe : null)),
    });
    // Look the dish up again by id: the state may have been reloaded while the form was open.
    const index = state.dishes.findIndex((d) => d.id === saved.id);
    if (index >= 0) state.dishes[index] = { ...saved, liking: state.dishes[index].liking };
    else state.dishes.push(saved);
    // A dish that became a side can't be the card or be pinned as a main.
    if (saved.role === 'side' && ui.currentId === saved.id) ui.currentId = null;
    if (saved.role === 'main' && ui.pinnedSide === saved.id) ui.pinnedSide = null;
    ui.sideFor = null;
    ui.editing = null;
    // It would be hidden by the search (#46): search for it instead (a name of only emoji or punctuation can't be searched).
    if (!dishMatches(saved, ui.dishSearch)) ui.dishSearch = wordsKey(saved.name) ? saved.name : '';
    commit();
  };

  const remove = () => {
    if (!window.confirm(t('confirmDelete', { name: original.name }))) return;
    state.dishes = state.dishes.filter((d) => d.id !== original.id);
    for (const d of state.dishes) d.sides = d.sides.filter((id) => id !== original.id);
    if (ui.currentId === original.id) ui.currentId = null;
    if (ui.pinnedSide === original.id) ui.pinnedSide = null;
    if (ui.cooked?.dishId === original.id) ui.cooked = null;
    ui.editing = null;
    commit();
  };

  const field = (input, label, help) =>
    h('div', { class: 'field' }, h('label', { for: input.id }, label), input, help && h('p', { class: 'help' }, help));

  return [
    h(
      'header',
      { class: 'top' },
      button(`‹ ${t('back')}`, closeDishForm, 'ghost'),
      h('h1', null, original ? t('editDish') : t('newDish')),
    ),
    h(
      'form',
      { class: 'form', onsubmit: save, noValidate: true },
      h('div', { class: 'field-row' }, field(emoji, t('fieldEmoji')), field(name, t('fieldName'))),
      field(ingredients, t('fieldIngredients'), t('fieldIngredientsHelp')),
      h('div', { class: 'field' }, h('span', { class: 'field-label', id: 'f-keys-label' }, t('fieldKeyIngredients')), keyChips, h('p', { class: 'help' }, t('fieldKeyIngredientsHelp'))),
      field(mains, t('fieldMains'), t('fieldMainsHelp')),
      tagChips,
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('fieldRole')), roleGroup, roleHelp),
      sidesField,
      field(minutes, t('fieldMinutes')),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('fieldHealth')), scale('health', t('fieldHealth'))),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('fieldYum')), scale('yum', t('fieldYum'))),
      h('h2', { class: 'section' }, `📝 ${t('recipe')}`),
      field(serves, t('fieldServes')),
      field(recipeItems, t('fieldRecipeItems'), t('fieldRecipeItemsHelp')),
      field(recipeSteps, t('fieldRecipeSteps'), t('fieldRecipeStepsHelp')),
      h('label', { class: 'check' }, neverShow, t('fieldNeverShow')),
      error,
      h(
        'div',
        { class: 'row' },
        original && button(t('delete'), remove, 'danger'),
        h('button', { type: 'submit', class: 'btn primary' }, t('save')),
      ),
    ),
  ];
}

// ---- Despensa (#42) ------------------------------------------------------

// How long "Deshacer" stays on a bulk button.
const PANTRY_UNDO_MS = 20_000;

// After this many changes in Qué tengo, "Listo, ¿qué cocinamos?" offers to go to the cards (like the wheel's "¿Y si cocinamos?").
const PANTRY_DONE_AFTER = 2;

const pantrySnapshot = () => new Map(allIngredients(state).map((n) => [n, pantryStatus(state, n)]));

/**
 * Time for "Listo, ¿qué cocinamos?": "Tengo todo" was pressed, or enough ingredients differ from when you came
 * (a tap and its undo don't count), or (Manual) you already have a couple marked as had, from this visit or an
 * earlier one: coming back to a pantry you filled before shows it too.
 */
function pantryDoneDue() {
  if (pantryUndoFor('all') || ui.pantryAllDone) return true; // "Tengo todo" says it all at once, however little it changed
  const names = allIngredients(state);
  if (state.settings.pantryMode === 'manual' && names.filter((n) => pantryStatus(state, n) === 'have').length >= PANTRY_DONE_AFTER) return true;
  const start = ui.pantryStart ?? new Map();
  let changed = 0;
  for (const n of names) if (pantryStatus(state, n) !== start.get(n) && ++changed >= PANTRY_DONE_AFTER) return true;
  return false;
}

/** Shows or hides the button after a change made in place (a chip tap). */
function pantryEdited() {
  const due = pantryDoneDue();
  for (const done of document.querySelectorAll('.pantry-done, .pantry-done-inline')) done.hidden = !due;
}

/**
 * "Listo, ¿qué cocinamos?": to Hoy. The card you were deciding on stays,
 * unless it now lacks something: then a new one is drawn for the pantry
 * as it is now (or just a new side, if only the side lacks something).
 */
function doneWithPantry() {
  const main = dishById(ui.currentId);
  const side = dishById(ui.sideId);
  const lacks = (dish) => Boolean(dish && dish.ingredients.some((i) => isMissing(state, i)));
  if (!ui.cooked && (!main || lacks(main))) {
    ui.currentId = null; // drawn again by ensureCurrent()
    ui.sideFor = null;
  } else if (!ui.cooked && lacks(side) && ui.pinnedSide !== side.id) {
    ui.sideFor = null; // a new side, same main
  }
  switchTab('today');
}

const PANTRY_MARK = { have: '✓', out: '🛒', none: '✗' };

/** The bulk action that can still be taken back, if any. */
function pantryUndoFor(kind) {
  const undo = ui.pantryUndo;
  return undo && undo.kind === kind && Date.now() < undo.until ? undo : null;
}

/** A bulk action: done now, "Deshacer" on its button for PANTRY_UNDO_MS. */
// Each bulk action: its label, what it does, and when it would change nothing.
const BULK = {
  all: { label: () => `✓ ${t('pantryHaveAll')}`, apply: haveEverything, done: () => hasEverything(state) },
  nothing: { label: () => `✗ ${t('pantryHaveNothing')}`, apply: haveNothing, done: () => hasNothing(state) },
  bought: { label: () => `✓ ${t('shopBoughtAll')}`, apply: boughtAll, done: () => state.missing.length === 0 },
};

// A second tap of a double-tap lands on the "Deshacer" that took the button's place: it's ignored this long.
const UNDO_GUARD_MS = 500;

function bulkPantry(kind) {
  // "Tengo todo" also empties the shopping list: ask first, since the next tap on a chip ends its Deshacer.
  const n = state.missing.length;
  if (kind === 'all' && n > 0 && !window.confirm(n === 1 ? t('pantryAllConfirmOne', { name: state.missing[0] }) : t('pantryAllConfirm', { n }))) return;
  const before = BULK[kind].apply(state);
  // After "No tengo nada" you still have to tick what you have: count from there.
  if (kind === 'nothing') ui.pantryStart = pantrySnapshot();
  ui.pantryAllDone = kind === 'all' || (kind !== 'nothing' && ui.pantryAllDone);
  const undo = { kind, before, since: Date.now(), until: Date.now() + PANTRY_UNDO_MS };
  ui.pantryUndo = undo;
  setTimeout(() => {
    if (ui.pantryUndo !== undo) return;
    ui.pantryUndo = null;
    // Just the buttons: a redraw would close the keyboard and lose what's being typed. On an empty list, the
    // "Compré todo" row goes altogether (nothing left to buy), which is a redraw.
    if (ui.tab === 'pantry' && ui.pantryView === 'list' && state.missing.length === 0) redrawKeepingFocus();
    else refreshBulkButtons();
  }, PANTRY_UNDO_MS + 50);
  commit();
}

/**
 * A change by hand after a bulk action (a chip, the list, adding) ends its
 * Deshacer: taking the bulk action back would quietly undo that change too.
 * "Compré todo" only ends with a change on the list.
 */
function endPantryUndo({ list = true } = {}) {
  if (ui.pantryUndo && (ui.pantryUndo.kind !== 'bought' || list)) ui.pantryUndo = null;
}

function undoBulkPantry(kind) {
  const undo = pantryUndoFor(kind);
  if (undo && Date.now() - undo.since < UNDO_GUARD_MS) return;
  if (undo) {
    if (kind === 'bought') undoBoughtAll(state, undo.before);
    else undoPantry(state, undo.before);
    if (kind === 'all') ui.pantryAllDone = false;
  }
  ui.pantryUndo = null;
  commit(); // also when it ran out meanwhile (a phone that slept): the button goes back to what it was
}

/** A bulk button, or its "↩ Deshacer" while the action can be taken back. */
function bulkButton(kind) {
  const { label, done } = BULK[kind];
  const el = pantryUndoFor(kind)
    ? button(`↩ ${t('undo')}`, () => undoBulkPantry(kind), 'bulk', { 'aria-label': t('pantryUndoOf', { action: label() }) })
    : button(label(), () => bulkPantry(kind), 'bulk', done() ? { disabled: true, title: t('pantryAlready') } : {});
  el.dataset.kind = kind;
  return el;
}

/** Puts each bulk button on the page back in step with the state (after a tap, or when its Deshacer runs out). */
function refreshBulkButtons() {
  for (const old of document.querySelectorAll('.pantry-bulk [data-kind]')) {
    const focused = document.activeElement === old;
    const fresh = bulkButton(old.dataset.kind);
    old.replaceWith(fresh);
    if (focused) fresh.focus({ preventScroll: true });
  }
  for (const hint of document.querySelectorAll('.pantry-hint')) hint.textContent = pantryHint(hint.dataset.view) || '\u00a0';
}

/**
 * The line under the count: what a tap does, or, while Deshacer shows,
 * what it would take back. Always one line, so the chips never move.
 */
function pantryHint(view) {
  const undo = ui.pantryUndo && Date.now() < ui.pantryUndo.until ? ui.pantryUndo : null;
  if (view === 'list') return undo?.kind === 'bought' ? t('shopBoughtAllDone') : '';
  if (undo?.kind === 'all') return t(undo.before.bought.length > 0 ? 'pantryAllDoneList' : 'pantryAllDone');
  if (undo?.kind === 'nothing') return t('pantryNothingDone');
  return state.settings.pantryMode === 'manual' ? t('pantryTapManual') : t('pantryTapLazy');
}

/** Redraws, keeping a search or Despensa's add box focused with the cursor where it was (a redraw replaces them; their text is in `ui`). */
function redrawKeepingFocus() {
  const typing = document.activeElement?.matches?.('#pantry-search, #shop-add, #dish-search') ? document.activeElement : null;
  const caret = typing?.selectionStart;
  render();
  if (typing) {
    const again = $(typing.id);
    again?.focus({ preventScroll: true });
    if (again && caret != null) again.setSelectionRange(caret, caret);
  }
}

/** The counts Despensa shows, kept current after a tap without a redraw. */
function updatePantryCounts() {
  const names = allIngredients(state);
  const have = names.filter((n) => pantryStatus(state, n) === 'have').length;
  const summary = document.querySelector('.pantry-summary');
  if (summary) summary.textContent = t('pantrySummary', { have, total: names.length });
  const listButton = document.querySelector('.pantry-switch [data-view="list"]');
  if (listButton) listButton.textContent = t('pantryListView', { n: state.missing.length });
  renderTabs();
}

/** One ingredient chip. A tap changes it in place: nothing else on the page moves, and the search keeps its text. */
function pantryChip(name) {
  const chip = h('button', {
    type: 'button',
    'data-key': searchKey(name),
    // Searching: the tap leaves the focus in the search, so the keyboard stays up to look for the next one.
    onpointerdown: (e) => {
      if (document.activeElement?.id === 'pantry-search') e.preventDefault();
    },
    onclick: () => {
      togglePantry(state, name);
      endPantryUndo({ list: false }); // "Compré todo" can still be taken back: it only puts its names back on the list
      pantryEdited();
      save();
      paint();
      updatePantryCounts();
      refreshBulkButtons(); // "already done" now, or not any more; Deshacer gone
    },
  });
  const paint = () => {
    const status = pantryStatus(state, name);
    chip.className = `chip pantry ${status}`;
    chip.setAttribute('aria-pressed', String(status === 'have'));
    chip.setAttribute('aria-label', `${name}: ${t(`pantryStatus:${status}`)}`);
    chip.replaceChildren(h('span', { class: 'chip-mark', 'aria-hidden': 'true' }, PANTRY_MARK[status]), name);
  };
  paint();
  return chip;
}

/** Shows only the chips that match the search, and offers to add what isn't there. In place, so the keyboard stays up. */
function filterPantry() {
  const q = searchKey(ui.pantrySearch);
  let shown = 0;
  let exact = false;
  for (const chip of document.querySelectorAll('.pantry-chips .chip')) {
    const match = nameMatch(chip.dataset.key, q);
    chip.hidden = !match;
    if (match) shown++;
    if (match === 'exact') exact = true;
  }
  const none = document.querySelector('.pantry-none');
  if (none) none.hidden = shown > 0;
  // Not there by that name (it may be inside a longer one: "sal" in salsa): offer to add it, under the chips.
  const add = document.querySelector('.pantry-add');
  if (add) {
    const names = splitList(ui.pantrySearch);
    add.hidden = names.length === 0 || exact || q.length < 2; // "té" (two letters) can be added; one letter can't
    add.querySelector('.pantry-add-text').textContent = t('pantryAddNew', { name: names.join(', ') });
  }
  const clear = document.querySelector('.search-clear');
  if (clear) clear.hidden = q === '';
}

function viewPantryHave() {
  const manual = state.settings.pantryMode === 'manual';
  const search = h('input', {
    id: 'pantry-search',
    type: 'search',
    value: ui.pantrySearch,
    placeholder: t('pantrySearch'),
    'aria-label': t('pantrySearch'),
    autocomplete: 'off',
    autocapitalize: 'none',
    enterKeyHint: 'search',
    oninput: (e) => {
      ui.pantrySearch = e.target.value;
      filterPantry();
    },
    onkeydown: (e) => {
      if (e.key === 'Enter') e.target.blur(); // closes the phone's keyboard, to see the chips
    },
  });
  const clear = button('✕', () => {
    ui.pantrySearch = '';
    search.value = '';
    filterPantry();
    search.focus();
  }, 'search-clear ghost', { 'aria-label': t('pantrySearchClear') });
  // Something typed that isn't an ingredient yet: add it, as had or to buy.
  const addNew = (mark) => () => {
    const names = splitList(ui.pantrySearch);
    if (names.length === 0) return;
    mark(state, names);
    addIngredients(state, names);
    endPantryUndo(); // marked by hand, as a chip tap: a Deshacer would undo it too
    // Show what was added: the one name, or (several) everything.
    ui.pantrySearch = names.length === 1 ? names[0] : '';
    redrawAfter(commit);
  };
  const keepSearchFocus = (e) => {
    if (document.activeElement?.id === 'pantry-search') e.preventDefault();
  };
  const addRow = h(
    'div',
    { class: 'pantry-add', hidden: true },
    h('span', { class: 'pantry-add-text' }),
    h(
      'div',
      { class: 'row' },
      button(`✓ ${t('pantryAddHave')}`, addNew(markInStock), 'small', { onpointerdown: keepSearchFocus }),
      button(`🛒 ${t('pantryAddToList')}`, addNew(markMissing), 'small', { onpointerdown: keepSearchFocus }),
    ),
  );

  const names = allIngredients(state);
  const have = names.filter((n) => pantryStatus(state, n) === 'have').length;
  return [
    h(
      'div',
      { class: 'pantry-bar' },
      h('div', { class: 'search-row' }, search, clear),
      // While typing a search the floating "Listo" would sit over the results (keyboard up): it's up here instead.
      h(
        'div',
        { class: 'pantry-done-inline', hidden: !pantryDoneDue() },
        button(`🍳 ${t('pantryDoneShort')}`, doneWithPantry, 'primary small', { onpointerdown: (e) => e.preventDefault() }),
      ),
    ),
    h('div', { class: 'pantry-bulk' }, bulkButton('all'), bulkButton('nothing')),
    h(
      'p',
      { class: 'help pantry-help' },
      h('span', { class: 'pantry-summary' }, t('pantrySummary', { have, total: names.length })),
      h('span', { class: 'pantry-hint', 'data-view': 'have' }, pantryHint('have')),
    ),
    h('div', { class: 'chips pantry-chips' }, names.map(pantryChip)),
    h('p', { class: 'muted pantry-none', hidden: true }, t('pantryNoMatch')),
    addRow,
    // Floats over the bottom of the page, above the tabs: showing it moves nothing.
    h(
      'div',
      { class: 'pantry-done', hidden: !pantryDoneDue() },
      button(`🍳 ${t('pantryDone')}`, doneWithPantry, 'primary', { onpointerdown: (e) => document.activeElement?.id === 'pantry-search' && e.preventDefault() }),
    ),
  ];
}

/** Runs a change that redraws (commit), keeping the search box's focus. */
function redrawAfter(change) {
  const focused = document.activeElement?.matches?.('#pantry-search');
  change();
  if (focused) $('pantry-search')?.focus({ preventScroll: true });
}

function viewPantryList() {
  // The rows in the order first shown; bought ones stay, crossed out, until you leave the list.
  ui.shopRows = [...new Set([...(ui.shopRows ?? []), ...state.missing])];
  const ingredients = allIngredients(state);
  // "huevos" typed is the "huevo" you already have: the same name, not a second one.
  // The name exactly as typed wins if it exists ("fideos" when there's fideo and fideos).
  const known = (name) =>
    ingredients.find((n) => searchKey(n) === searchKey(name)) ?? ingredients.find((n) => nameMatch(searchKey(n), searchKey(name)) === 'exact') ?? name;
  const addNames = (names) => {
    if (names.length === 0) return;
    markMissing(state, names.map(known));
    ui.shopAdd = '';
    endPantryUndo();
    commit();
    $('shop-add')?.focus(); // to add another
  };
  const suggest = h('ul', { class: 'shop-suggest', id: 'shop-suggest', role: 'listbox', 'aria-label': t('shopSuggestLabel'), hidden: true });
  const addInput = h('input', {
    id: 'shop-add',
    type: 'text',
    value: ui.shopAdd,
    oninput: (e) => {
      ui.shopAdd = e.target.value;
      fillSuggestions();
    },
    onfocus: () => fillSuggestions(),
    onblur: (e) => {
      if (!suggest.contains(e.relatedTarget)) suggest.hidden = true;
    },
    onkeydown: (e) => {
      if (e.key === 'Escape') suggest.hidden = true;
      if (e.key === 'ArrowDown' && !suggest.hidden) {
        e.preventDefault();
        suggest.querySelector('button')?.focus();
      }
    },
    placeholder: t('addItemPlaceholder'),
    'aria-label': t('addItemPlaceholder'),
    'aria-controls': 'shop-suggest',
    autocomplete: 'off',
    autocapitalize: 'none',
    enterKeyHint: 'done',
  });
  // What you might mean, as you type ("aceit" → aceite, aceite de oliva): a tap adds it. Over the rows, so nothing moves.
  function fillSuggestions() {
    const q = searchKey(ui.shopAdd.split(',').at(-1) ?? '');
    // The name as typed first, then its singular/plural, then those starting with what's typed, then the rest
    // (a stable sort keeps them alphabetical within each).
    const rank = (n, m) => (searchKey(n) === q ? 0 : m === 'exact' ? 1 : searchKey(n).startsWith(q) ? 2 : 3);
    const found = q.length < 2 ? [] : ingredients.filter((n) => !state.missing.includes(n)).map((n) => [n, nameMatch(searchKey(n), q)]).filter(([, m]) => m);
    found.sort(([a, ma], [b, mb]) => rank(a, ma) - rank(b, mb));
    // Already on the list by that name ("huevos" with huevo there): say so, instead of nothing happening.
    const onList = q.length >= 2 && state.missing.find((n) => nameMatch(searchKey(n), q) === 'exact');
    // Fewer on a short screen (keyboard up), so none hides under the keyboard.
    const room = (window.visualViewport?.height ?? window.innerHeight) < 600 ? 4 : 6;
    suggest.replaceChildren(
      onList && h('li', { class: 'muted shop-suggest-note' }, t('shopSuggestOnList', { name: onList })),
      ...found.slice(0, room).map(([name]) =>
        h(
          'li',
          { role: 'option' },
          h(
            'button',
            {
              type: 'button',
              onpointerdown: (e) => e.preventDefault(), // the add box keeps the focus (and the keyboard)
              // Keyboard: arrows move through the suggestions, Escape goes back to the box.
              onkeydown: (e) => {
                const items = [...suggest.querySelectorAll('button')];
                const i = items.indexOf(e.currentTarget);
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  (items[i + (e.key === 'ArrowDown' ? 1 : -1)] ?? addInput).focus();
                } else if (e.key === 'Escape') addInput.focus();
              },
              onblur: (e) => {
                if (!suggest.contains(e.relatedTarget) && e.relatedTarget !== addInput) suggest.hidden = true;
              },
              onclick: () => addNames([...splitList(ui.shopAdd).slice(0, -1), name]),
            },
            h('span', null, `🛒 ${name}`),
            pantryStatus(state, name) === 'have' && h('span', { class: 'muted' }, t('shopSuggestHave')),
          ),
        ),
      ),
    );
    suggest.hidden = (found.length === 0 && !onList) || (document.activeElement !== addInput && !suggest.contains(document.activeElement));
  }
  const addItem = (e) => {
    e.preventDefault();
    addNames(splitList(addInput.value));
  };
  const anyBought = ui.shopRows.some((n) => !state.missing.includes(n));
  return [
    h('form', { class: 'add-row', onsubmit: addItem }, addInput, h('button', { type: 'submit', class: 'btn' }, t('add')), suggest),
    // At the top, so it's in reach however long the list is; it and its line keep their size, so the rows never move.
    // Also on an empty list while "Compré todo" can still be taken back (left and came back to it).
    (ui.shopRows.length > 0 || pantryUndoFor('bought')) && h('div', { class: 'pantry-bulk' }, bulkButton('bought')),
    (ui.shopRows.length > 0 || pantryUndoFor('bought')) && h('p', { class: 'help pantry-help' }, h('span', { class: 'pantry-hint', 'data-view': 'list' }, pantryHint('list') || '\u00a0')),
    ui.shopRows.length === 0
      ? h('p', { class: 'muted' }, t('shoppingEmpty'))
      : [
          h(
            'ul',
            { class: 'list' },
            ui.shopRows.map((name) => {
              const bought = !state.missing.includes(name);
              return h(
                'li',
                { class: bought ? 'shop-row bought' : 'shop-row' },
                h('span', null, name),
                bought
                  ? button(`↩ ${t('undo')}`, () => {
                      markMissing(state, [name]);
                      endPantryUndo();
                      commit();
                    }, 'small', { 'aria-label': t('shopUnbuy', { name }) })
                  : button(`✓ ${t('bought')}`, () => {
                      markInStock(state, [name]);
                      endPantryUndo();
                      commit();
                    }, 'small', { 'aria-label': t('shopBuy', { name }) }),
              );
            }),
          ),
          anyBought && h('p', { class: 'help' }, t('shopBoughtHelp')),
        ],
  ];
}

function setPantryView(view) {
  if (ui.pantryView === view) return;
  ui.pantryView = view;
  ui.shopRows = null;
  render();
  window.scrollTo(0, 0);
}

function viewPantry() {
  return [
    h('header', { class: 'top' }, h('h1', null, t('pantryTitle'))),
    h(
      'div',
      { class: 'segmented pantry-switch', role: 'group', 'aria-label': t('pantryTitle') },
      [
        ['have', t('pantryHaveView')],
        ['list', t('pantryListView', { n: state.missing.length })],
      ].map(([v, text]) => h('button', { type: 'button', 'data-view': v, 'aria-pressed': String(ui.pantryView === v), onclick: () => setPantryView(v) }, text)),
    ),
    ui.pantryView === 'list' ? viewPantryList() : viewPantryHave(),
  ];
}

function exportData() {
  // The groups stay out: a copy imported on another phone must not take over this one's place in them.
  const copy = { ...state, settings: { ...state.settings, groups: [] } };
  downloadText(JSON.stringify(copy, null, 2), `que-comemos-hoy-${today()}.json`);
}

async function importData(file) {
  let next;
  try {
    next = normalizeState(JSON.parse(await file.text()));
  } catch (err) {
    window.alert(t(err?.message === 'newer-schema' ? 'importNewer' : 'importError'));
    return;
  }
  if (!window.confirm(t('confirmImport', { dishes: state.dishes.length }))) return;
  next.settings.groups = state.settings.groups; // this phone's groups, whatever the file says
  state = next;
  applyTuning();
  wheelView.close();
  Object.assign(ui, { currentId: null, cooked: null, sheet: null, picking: null, afterMeal: null, editing: null });
  commit();
  window.alert(t('importOk'));
}

function viewSettings() {
  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: () => {
      if (fileInput.files[0]) importData(fileInput.files[0]);
      fileInput.value = '';
    },
  });
  const mode = (value, label, help) =>
    h(
      'label',
      { class: 'radio' },
      h('input', {
        type: 'radio',
        name: 'pantry-mode',
        checked: state.settings.pantryMode === value,
        onchange: () => {
          state.settings.pantryMode = value;
          commit();
        },
      }),
      h('span', null, h('strong', null, label), h('span', { class: 'help' }, help)),
    );

  const backup = readBackup();

  return [
    h('header', { class: 'top' }, h('h1', null, t('settingsTitle'))),
    h('h2', { class: 'section' }, t('pantryMode')),
    mode('lazy', t('pantryLazy'), t('pantryLazyHelp')),
    mode('manual', t('pantryManual'), t('pantryManualHelp')),
    h('p', { class: 'help' }, t('pantryModeNote')),
    h('h2', { class: 'section' }, t('variety')),
    varietyControl(),
    h('p', { class: 'help' }, t('varietyHelp')),
    h('h2', { class: 'section' }, t('portions')),
    portionsControl(),
    h('p', { class: 'help' }, t('portionsHelp')),
    groupSection(),
    tuningSection(),
    h('h2', { class: 'section' }, t('backup')),
    h('p', { class: 'help' }, t('backupHelp')),
    h('div', { class: 'row' }, button(t('exportData'), exportData), button(t('importData'), () => fileInput.click())),
    fileInput,
    backup != null && [
      h('h2', { class: 'section' }, t('unreadableTitle')),
      h('p', { class: 'help' }, t('unreadableHelp')),
      button(t('downloadCopy'), () => downloadBackup(backup)),
    ],
    ui.installPrompt && [
      h('h2', { class: 'section' }, t('install')),
      h('p', { class: 'help' }, t('installHelp')),
      button(
        t('install'),
        async () => {
          const prompt = ui.installPrompt;
          ui.installPrompt = null;
          await prompt.prompt();
          render();
        },
        'primary',
      ),
    ],
  ];
}

// ---- Friends' groups (group.js, #23, #33) ---------------------------------

let flushing = null; // the run of flushGroup() under way, if any
const leaving = new Set(); // codes of the groups being left: nothing more is sent to them or fetched

/** Saves the state, unless this copy is read-only (a newer copy of the app saved over it). */
function saveGroups() {
  if (!ui.readOnly) saveState(state);
}

/** A group as the state has it now: another tab or an import may have replaced the objects held across a call. */
const groupByCode = (code) => state.settings.groups.find((g) => g.code === code);

/** Sends the picks waiting in each group's queue, one group after another. Safe to call often: one run at a time. */
function flushGroup() {
  const waiting = () => state.settings.groups.filter((g) => g.queue.length > 0 && !leaving.has(g.code));
  if (flushing || ui.readOnly || waiting().length === 0) return flushing;
  flushing = (async () => {
    const results = [];
    for (const { code } of waiting()) {
      // The group as the state has it now, which another tab or an import may have replaced.
      results.push([code, await flushQueue(() => groupByCode(code), saveGroups)]);
    }
    return results;
  })().finally(() => {
    flushing = null;
  });
  return flushing.then((results) => {
    for (const [code, result] of results) if (result === 'gone') leftGroup(code, true);
    // A pick queued while the last call was out: send it too (unless a group is waiting for the network).
    if (results.every(([, result]) => result !== 'later') && waiting().length > 0) flushGroup();
    else if (canRedrawSettings()) render(); // the "waiting" lines
  });
}

/**
 * Ajustes can be drawn again without getting in the way: it's showing, and
 * nobody is typing in it (a redraw replaces the inputs, closing the keyboard
 * and losing a number not confirmed yet).
 */
function canRedrawSettings() {
  return ui.tab === 'settings' && !ui.editing && !document.activeElement?.closest?.('#view input, #view textarea, #view select');
}

function newGroupForm() {
  return { name: '', groupName: '', code: '', rename: {}, error: null, errorFor: null, busy: false };
}

/** What a group is called on this phone: its name, or its code until someone names it. */
const groupLabel = (group) => group.groupName ?? t('groupUnnamed', { code: formatCode(group.code) });

/** This phone is out of a group (it left, or the server says it isn't in it: `gone`): forget it and its list. */
function leftGroup(code, gone = false) {
  const group = groupByCode(code);
  if (!group) return render(); // already gone (another tab, or a "gone" answer first): just redraw
  state.settings.groups = state.settings.groups.filter((g) => g !== group);
  ui.groupLists.delete(code);
  saveGroupLists();
  ui.openGroups.delete(code);
  ui.friends = null;
  if (ui.groupInvited === code) ui.groupInvited = null;
  delete ui.groupForm.rename[code];
  if (ui.groupForm.errorFor === code) ui.groupForm.error = null;
  commit();
  if (gone) addBanner('group', t('groupGone', { name: groupLabel(group) }));
}

/** Each group's last list, kept for the 💞 while offline. The one list kept before #33 is the first group's. */
function readCachedGroupLists() {
  const usable = (list) => list && typeof list === 'object' && typeof list.code === 'string' && Array.isArray(list.picks);
  try {
    const lists = JSON.parse(localStorage.getItem(GROUP_LISTS_KEY));
    if (lists && typeof lists === 'object') return new Map(Object.values(lists).filter(usable).map((l) => [l.code, l]));
    const old = JSON.parse(localStorage.getItem(OLD_GROUP_LIST_KEY));
    return new Map(usable(old) ? [[old.code, old]] : []);
  } catch {
    return new Map();
  }
}

function saveGroupLists() {
  // Only the groups this phone is in: a list of one left in another tab is not written back.
  for (const code of ui.groupLists.keys()) if (!groupByCode(code)) ui.groupLists.delete(code);
  try {
    localStorage.setItem(GROUP_LISTS_KEY, JSON.stringify(Object.fromEntries(ui.groupLists)));
    localStorage.removeItem(OLD_GROUP_LIST_KEY);
  } catch {
    // Not kept for offline use: fetched again next time.
  }
}

/** The last lists of the groups this phone is in now (another tab may have changed them). */
function currentGroupLists() {
  return state.settings.groups.map((g) => ui.groupLists.get(g.code)).filter(Boolean);
}

// How often the 💞 are fetched again while the app stays open.
const GROUP_REFRESH_MS = 3 * 60 * 1000;
let listing = null; // the list calls on their way, if any: leaving waits for them

/**
 * Fetches who is in each group, its name and what they picked: for the 💞 on
 * the card, the score and Ajustes. At most every GROUP_REFRESH_MS per group
 * unless `force`. Also notices a group this phone was taken out of.
 */
async function refreshGroupList(force = false) {
  if (listing || ui.readOnly) return;
  // A little slack: `time` is when the last answer came, so the 3-minute timer would skip every other tick.
  const due = state.settings.groups.filter(
    (g) => !leaving.has(g.code) && (force || !(Date.now() - (ui.groupLists.get(g.code)?.time ?? 0) < GROUP_REFRESH_MS - 10_000)),
  );
  if (due.length === 0) return;
  const shown = () => JSON.stringify(currentGroupLists().map((l) => [l.code, l.you, l.groupName, l.members]));
  const before = shown();
  const markBefore = ui.currentId && friendsPicks(currentGroupLists(), Date.now()).has(ui.currentId);
  const friendsLoading = ui.tab === 'friends' && currentGroupLists().length === 0; // "Cargando…" until this ends, whatever the answer
  listing = Promise.all(due.map(async (group) => [group, await listGroup(group)]));
  let results;
  try {
    results = await listing;
  } finally {
    listing = null;
  }
  for (const [group, res] of results) {
    if (!state.settings.groups.includes(group) || leaving.has(group.code)) continue; // left, or replaced by another tab
    if (res.status === 403 && res.data?.error === 'not-member') leftGroup(group.code, true);
    else if (res.ok) setGroupList(group, res.data);
  }
  const markNow = ui.currentId && friendsPicks(currentGroupLists(), Date.now()).has(ui.currentId);
  // Redraw only what changed where it shows: never under someone typing, nor a card being dragged or flying out.
  const moving = document.querySelector('.card.dragging, .card.flying');
  if (shown() !== before && canRedrawSettings()) render();
  else if (ui.tab === 'today' && markBefore !== markNow && !moving) render();
  else if (ui.tab === 'friends' && !ui.afterMeal && (friendsLoading || (friendsShown() !== friendsDrawn && !focusInView()))) render();
  else if (dishMarksChanged()) render();
}

/**
 * Comidas shows other 💞 than it drew (#46), and a redraw won't take a dish form, a search or an open
 * sheet (a recipe scrolled down, who picked) from under someone: closing a sheet redraws anyway.
 */
const dishMarksChanged = () =>
  ui.tab === 'dishes' && !ui.editing && !$('overlay').hasChildNodes() && dishMarks() !== dishMarksDrawn && !focusInView();

/** Someone is on a button or field of the page: a redraw would drop them back to the top. */
const focusInView = () => Boolean(document.activeElement?.closest?.('#view'));

/** Keeps a group's list answer, and the group's name as its members last set it. */
function setGroupList(group, data) {
  const groupName = data.groupName == null ? null : cleanName(data.groupName) || null;
  ui.groupLists.set(group.code, { code: group.code, time: Date.now(), you: data.you, groupName, members: data.members ?? [], picks: data.picks ?? [] });
  saveGroupLists();
  if (data.groupName !== undefined && group.groupName !== groupName) {
    group.groupName = groupName;
    saveGroups();
  }
}

function openFriends(dishId) {
  ui.friends = dishId;
  render();
  document.querySelector('#overlay .sheet-foot button')?.focus();
}

/**
 * Back to what was under who picked: the card, or Comidas (#46), on the 💞
 * that opened it (or its row, if that 💞 is gone now).
 */
function closeFriends() {
  const dishId = ui.friends;
  ui.friends = null;
  render();
  const item = ui.tab === 'dishes' && document.querySelector(`#view .dish-list > .list-item[data-dish="${CSS.escape(dishId)}"]`);
  const back = item ? (item.querySelector('.pick-mark') ?? item.querySelector('.list-row')) : document.querySelector('.friends-mark');
  back?.focus({ preventScroll: true });
}

// ---- 💞 Amigos (#40) --------------------------------------------------------

/**
 * What the Amigos tab shows from the groups' lists. viewFriends() keeps what
 * it drew, so a refresh redraws only when it would change, midnight included.
 */
function friendsShown() {
  const lists = currentGroupLists();
  return JSON.stringify([state.settings.groups.length, lists.length, Boolean(listing), listsStale(lists), navigator.onLine, friendsByDay(lists, Date.now())]);
}

/** Some group's list wasn't fetched again for a while (offline, or the server failing). */
const listsStale = (lists) => lists.length > 0 && Date.now() - Math.min(...lists.map((l) => l.time)) > 2 * GROUP_REFRESH_MS;
let friendsDrawn = null;

/** A dish your friends picked, on the card in Hoy: unpinning a side it doesn't go with. */
function showOnToday(dish) {
  const cooked = ui.cooked && dishById(ui.cooked.dishId);
  if (cooked === dish) {
    switchTab('today'); // the dish you just logged: its "¡A cocinar!" stays, with Deshacer
    return focusToday();
  }
  if (cooked && !window.confirm(t('friendsReplaceCooked', { cooked: cooked.name, name: dish.name }))) {
    document.activeElement?.blur(); // a tapped row keeps the focus, and would hold back the list's redraws
    return;
  }
  const pinned = dishById(ui.pinnedSide);
  if (pinned && !mainCandidates(state.dishes, pinned.id).includes(dish)) {
    ui.pinnedSide = null;
    addBanner('pin', t('friendsUnpinned', { side: pinned.name.toLocaleLowerCase('es'), name: dish.name }));
    const banner = ui.banners.at(-1);
    setTimeout(() => ui.banners.includes(banner) && dropBanner('pin'), 6000);
  }
  ui.currentId = dish.id;
  ui.placed = dish.id; // on purpose: it shows even if banned today and the ideas have run out (#53)
  ui.keepCard = dish.id;
  ui.sideFor = null;
  ui.cooked = null;
  switchTab('today');
  if (!ui.mood) ui.keepCard = null; // only for a mood question showing now, not a later change from the chip
  focusToday();
}

/** Keyboard and screen readers land on what Hoy shows: the mood question if it's due, else the card or "¡A cocinar!". */
function focusToday() {
  const title = document.querySelector('#overlay .sheet button') ?? document.querySelector('#view .card h2, #view h2');
  if (title && !title.matches('button')) title.tabIndex = -1;
  title?.focus();
}

/** One dish your friends picked: tapped, it goes to the card in Hoy (unless it can't be shown there). */
function friendsRow({ dishId, names }) {
  const dish = dishById(dishId);
  const shown = dish ?? STARTER_DISHES.find((d) => d.id === dishId); // deleted on this phone: still say what it was
  const canShow = Boolean(dish && !dish.neverShow && mainCandidates(state.dishes).includes(dish));
  // Why it can't go to Hoy: hidden has its badge; deleted, or not a main any more, a line.
  const why = canShow || dish?.neverShow ? null : t(dish ? 'friendsNotAMain' : 'friendsDeleted');
  const content = [
    h('span', { class: 'list-emoji', style: `background:${gradientFor(shown)}`, 'aria-hidden': 'true' }, shown.emoji),
    h(
      'span',
      { class: 'list-text' },
      h('span', { class: 'list-name' }, shown.name),
      h('span', { class: 'list-meta' }, listText(names)),
      why && h('span', { class: 'list-meta' }, why),
    ),
    dish?.neverShow && h('span', { class: 'badge' }, t('hidden')),
  ];
  return h(
    'li',
    null,
    canShow
      ? h('button', { type: 'button', class: 'list-row', 'aria-label': t(names.length > 1 ? 'friendsShowOnTodayMany' : 'friendsShowOnToday', { name: shown.name, who: listText(names) }), onclick: () => showOnToday(dish) }, ...content)
      : h('div', { class: 'list-row off' }, ...content),
  );
}

/** "Nico", "Nico y Lucía", "Nico, Lucía e Inés" (Intl knows the "e"; an old browser without it gets commas). */
let listFormat;
function listText(names) {
  try {
    listFormat ??= new Intl.ListFormat(lang, { type: 'conjunction' });
    return listFormat.format(names);
  } catch {
    return names.join(', ');
  }
}

/** "hoy a las 19:37", "ayer a las 19:37", "el martes a las 19:37", by this phone's calendar. */
function whenText(time) {
  const d = new Date(time);
  const now = new Date();
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86_400_000);
  const day = days === 0 ? t('friendsToday') : days === 1 ? t('friendsYesterday') : t('friendsOnDay', { day: d.toLocaleDateString(lang, { weekday: 'long' }) });
  return t('friendsAt', { day, time: d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) });
}

function viewFriends() {
  const header = h('header', { class: 'top' }, h('h1', null, t('friendsTabTitle')));
  if (state.settings.groups.length === 0) {
    return [
      header,
      h(
        'section',
        { class: 'empty' },
        h('div', { class: 'empty-emoji', 'aria-hidden': 'true' }, '💞'),
        h('h2', null, t('friendsNoGroupTitle')),
        h('p', null, t('friendsNoGroupText')),
        button(t('friendsGoToSettings'), () => switchTab('settings'), 'primary'),
      ),
    ];
  }
  friendsDrawn = friendsShown();
  const lists = currentGroupLists();
  const retry = button(t('friendsRetry'), () => {
    refreshGroupList(true);
    render();
  });
  const offline = navigator.onLine === false && h('p', { class: 'help' }, t('friendsOffline'));
  if (lists.length === 0) {
    return [header, h('p', { class: 'muted' }, t(listing ? 'friendsLoading' : 'friendsNotLoaded')), !listing && !ui.readOnly && retry];
  }
  // A list kept from a while ago: say when it's from.
  const oldest = Math.min(...lists.map((l) => l.time));
  const stale =
    !listing &&
    listsStale(lists) &&
    h('p', { class: 'help' }, t('friendsStale', { when: whenText(oldest) }), offline ? ` ${t('friendsOffline')}` : '', ' ', retry);
  const { today, yesterday } = friendsByDay(lists, Date.now());
  if (today.length === 0 && yesterday.length === 0) return [header, h('p', { class: 'muted' }, t('friendsEmpty')), stale];
  const day = (title, rows) => rows.length > 0 && [h('h2', { class: 'list-heading' }, title), h('ul', { class: 'list' }, rows.map(friendsRow))];
  return [header, h('p', { class: 'help' }, t('friendsTabHelp')), stale, day(t('friendsTodayTitle'), today), day(t('friendsYesterdayTitle'), yesterday)];
}

function overlayFriends() {
  const who = friendsPicks(currentGroupLists(), Date.now()).get(ui.friends) ?? [];
  return sheet(
    `${t('friendsTitle')}: ${dishById(ui.friends)?.name ?? ''}`,
    // Empty when the 💞 that opened it was drawn before the picks changed (an open list isn't redrawn).
    who.length === 0
      ? h('p', { class: 'help' }, t('friendsNone'))
      : h(
          'ul',
          { class: 'friends-list' },
          who.map((w) => h('li', null, h('span', null, w.name), h('span', { class: 'muted' }, t(w.today ? 'friendsToday' : 'friendsYesterday')))),
        ),
    h('div', { class: 'row sheet-foot' }, button(t('close'), closeFriends)),
  );
}

function groupError({ status, data }) {
  if (status === 0) return t('groupOffline');
  const key = { 'no-group': 'groupNoGroup', full: 'groupFull', 'bad-name': 'groupNameMissing', 'bad-group-name': 'groupNameMissingGroup' }[data?.error];
  return t(key ?? 'groupError');
}

/** Runs one call to the group function from Ajustes, showing "busy" and any error (in that group's box, or the form's). */
async function groupCall(call, onOk, errorFor = null) {
  const form = ui.groupForm;
  form.busy = true;
  form.error = null;
  form.errorFor = errorFor;
  render();
  const res = await call;
  form.busy = false;
  if (res.ok) onOk(res.data);
  // The server says this phone isn't in that group any more: drop it, with a banner, instead of "try again".
  else if (errorFor && errorFor !== 'me' && res.status === 403 && res.data?.error === 'not-member') return leftGroup(errorFor, true);
  else form.error = groupError(res);
  commit();
}

/** "Crear un grupo" (create = true) or "Unirme": with your name and this phone's secret, the same in every group (#33). */
function enterGroup(create) {
  const form = ui.groupForm;
  const groups = state.settings.groups;
  // Your name, the same in every group. One saved before the stricter rule (#34), like "...",
  // is refused by the server: it has to be changed first, in "Tu nombre".
  const name = cleanName(groups.length > 0 ? groups[0].name : form.name);
  const groupName = cleanName(form.groupName);
  const code = create ? null : normalizeCode(form.code);
  form.errorFor = groups.length > 0 && !name ? 'me' : null;
  form.error =
    groups.length >= GROUP.max
      ? t('groupMaxReached', { n: GROUP.max })
      : !name
        ? t(groups.length > 0 ? 'groupNameFixFirst' : 'groupNameMissing')
        : create && !groupName
          ? t('groupNameMissingGroup')
          : !create && !code
            ? t('groupBadCode')
            : !create && groups.some((g) => g.code === code)
              ? t('groupAlreadyIn')
              : null;
  if (form.error) return render();
  // The phone's secret. Before its first group, a join retried after a lost answer must be
  // the same member (the server then just renames), not a second one: the form keeps it until then.
  const secret = groups[0]?.secret ?? (form.secret ??= newSecret());
  groupCall(create ? createGroup(secret, name, groupName) : joinGroup(code, secret, name), (data) => {
    if (groupByCode(data.code)) return; // two taps: already in
    // Another tab added a group meanwhile (the cap reached, or a first group with another
    // secret), or this copy turned read-only: it can't be kept, so out of it again.
    const first = state.settings.groups[0];
    if (ui.readOnly || state.settings.groups.length >= GROUP.max || (first && first.secret !== secret)) {
      leaveGroup({ code: data.code, secret });
      ui.groupForm.error = state.settings.groups.length >= GROUP.max ? t('groupMaxReached', { n: GROUP.max }) : t('groupError');
      return;
    }
    const group = { code: data.code, secret, name, groupName: null, sharing: true, queue: [] };
    state.settings.groups.push(group);
    setGroupList(group, data);
    ui.openGroups = new Set([group.code]); // the new one open, to invite people to it
    ui.groupForm = newGroupForm();
  });
}

/**
 * A new name for you, in every group: joining again with the same secret
 * renames you. A group where it fails keeps your old name, and the error,
 * under "Tu nombre", says which; "Cambiar" again tries them all.
 */
async function renameMe() {
  const form = ui.groupForm;
  const name = cleanName(form.name);
  form.errorFor = 'me';
  if (!name) {
    form.error = t('groupNameMissing');
    return render();
  }
  form.busy = true;
  form.error = null;
  render();
  const failed = [];
  let offline = false;
  for (const { code } of [...state.settings.groups]) {
    // Each group as the state has it now: one left meanwhile (here or in another tab) is skipped,
    // or the join would put you back in it.
    const group = groupByCode(code);
    if (!group || leaving.has(code)) continue;
    const res = await joinGroup(code, group.secret, name);
    const now = groupByCode(code);
    if (res.ok && now) {
      now.name = name;
      setGroupList(now, res.data);
    } else if (res.ok) {
      leaveGroup({ code, secret: group.secret }); // left while the join was out: out of it again
    } else if (res.status === 404 && res.data?.error === 'no-group') {
      leftGroup(code, true); // nobody is in it any more
    } else {
      failed.push(groupLabel(now ?? group));
      offline ||= res.status === 0;
    }
  }
  ui.groupForm.busy = false;
  ui.groupForm.errorFor = 'me';
  if (failed.length > 0) ui.groupForm.error = t(offline ? 'groupRenameFailedOffline' : 'groupRenameFailed', { groups: failed.join(', ') });
  else ui.groupForm.name = '';
  commit();
}

/** A new name for a group, for everyone in it. */
function renameTheGroup(group) {
  const form = ui.groupForm;
  const groupName = cleanName(form.rename[group.code] ?? '');
  if (!groupName) {
    form.errorFor = group.code;
    form.error = t('groupNameMissingGroup');
    return render();
  }
  groupCall(
    renameGroup(group, groupName),
    (data) => {
      const now = groupByCode(group.code);
      if (now) setGroupList(now, data);
      delete ui.groupForm.rename[group.code];
    },
    group.code,
  );
}

async function leaveTheGroup(group) {
  const { code } = group;
  if (!window.confirm(t('groupLeaveConfirm', { name: groupLabel(group) }))) return;
  ui.groupForm.busy = true;
  ui.groupForm.error = null;
  render();
  // Nothing more goes out to this group. A pick on its way lands before the leave deletes it,
  // and a list on its way can't mark you "seen today" (a new key) after the leave.
  leaving.add(code);
  const unpicks = group.queue.filter((o) => o.op === 'unpick');
  group.queue = [];
  saveGroups();
  await flushing;
  await listing;
  const res = await leaveGroup(group);
  leaving.delete(code);
  ui.groupForm.busy = false;
  // Not in it on the server either: nothing left there to delete.
  if (res.ok || (res.status === 403 && res.data?.error === 'not-member')) return leftGroup(code);
  // Still in the group: picks already taken back with "Deshacer" must still go.
  const now = groupByCode(code);
  if (now) now.queue = [...unpicks, ...now.queue];
  ui.groupForm.errorFor = code;
  ui.groupForm.error = res.status === 0 ? t('groupOfflineLeave') : t('groupError');
  commit();
  flushGroup();
}

/** The invitation: the group's name, the app's address, the steps and the code. */
function inviteText(group) {
  const url = new URL('./', window.location.href).href;
  const code = formatCode(group.code);
  return group.groupName ? t('groupInviteTextNamed', { url, code, group: group.groupName }) : t('groupInviteText', { url, code });
}

/** "Invitar": the phone's share sheet (WhatsApp…). Only shown where there is one. */
async function shareInvite(group) {
  try {
    await navigator.share({ text: inviteText(group) });
  } catch {
    // The share sheet was closed: nothing to do.
  }
}

/** "Copiar": the whole invitation, to paste anywhere. */
async function copyInvite(group) {
  const text = inviteText(group);
  try {
    await navigator.clipboard.writeText(text);
    ui.groupInvited = group.code;
  } catch {
    window.prompt(t('groupInviteCopy'), text);
  }
  render();
}

const groupInput = (id, value, onInput, props = {}) =>
  h('input', { id, type: 'text', value, autocomplete: 'off', oninput: (e) => onInput(e.target.value), ...props });
const groupField = (input, label) => h('div', { class: 'field' }, h('label', { for: input.id }, label), input);
const groupErrorLine = (code) => h('p', { class: 'error', role: 'alert' }, ui.groupForm.errorFor === code ? (ui.groupForm.error ?? '') : '');

/** One group in Ajustes: its name; tapped open, its members, code, invitation, name, sharing and "Salir". */
function groupBox(group) {
  const form = ui.groupForm;
  const busy = form.busy || ui.readOnly;
  const list = ui.groupLists.get(group.code);
  const others = (list?.members ?? []).filter((m) => m.id !== list.you).map((m) => m.name);
  const label = groupLabel(group);
  const box = h(
    'details',
    { class: 'fold group', open: ui.openGroups.has(group.code) },
    // The comma is for screen readers, which would otherwise read "Cluben pausa".
    h('summary', null, label, !group.sharing && [h('span', { class: 'sr-only' }, ', '), h('span', { class: 'badge inline' }, t('groupPaused'))]),
    h(
      'div',
      { class: 'fold-body' },
      list && h('p', { class: 'help' }, others.length > 0 ? t('groupMembers', { list: others.join(', ') }) : t('groupAlone')),
      h('p', { class: 'group-code' }, h('span', { class: 'label' }, t('groupCodeLabel')), h('strong', null, formatCode(group.code))),
      h(
        'div',
        { class: 'row' },
        navigator.share && button(t('groupInvite'), () => shareInvite(group), 'primary', { disabled: ui.readOnly }),
        button(ui.groupInvited === group.code ? t('groupInvited') : t('groupCopy'), () => copyInvite(group), navigator.share ? '' : 'primary', {
          disabled: ui.readOnly,
        }),
      ),
      h(
        'div',
        { class: 'field' },
        h('label', { for: `g-rename-${group.code}` }, t('groupRenameLabel')),
        h(
          'div',
          { class: 'row' },
          groupInput(`g-rename-${group.code}`, form.rename[group.code] ?? '', (v) => (form.rename[group.code] = v), { maxLength: 30, placeholder: label }),
          button(t('groupSaveName'), () => renameTheGroup(group), '', { disabled: busy }),
        ),
      ),
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: group.sharing,
          disabled: ui.readOnly,
          onchange: (e) => {
            group.sharing = e.target.checked;
            if (!group.sharing) dropQueuedPicks(group);
            commit();
          },
        }),
        h('span', null, h('strong', null, t('groupSharing')), h('span', { class: 'help' }, t('groupSharingHelp'))),
      ),
      group.queue.length > 0 && h('p', { class: 'help' }, t('groupWaiting', { n: group.queue.length })),
      button(t('groupLeave'), () => leaveTheGroup(group), 'danger', { disabled: busy }),
      groupErrorLine(group.code),
    ),
  );
  // Opened or closed, it stays that way through redraws.
  box.addEventListener('toggle', () => (box.open ? ui.openGroups.add(group.code) : ui.openGroups.delete(group.code)));
  return box;
}

function groupSection() {
  const groups = state.settings.groups;
  const form = ui.groupForm;
  const busy = form.busy || ui.readOnly;
  const me = groups[0];
  return [
    h('h2', { class: 'section' }, t('groupTitle')),
    h('p', { class: 'help' }, t('groupHelp')),
    // Your name, the same in every group.
    me &&
      h(
        'div',
        { class: 'field' },
        h('label', { for: 'g-rename' }, t('groupYourName')),
        h(
          'div',
          { class: 'row' },
          groupInput('g-rename', form.name, (v) => (form.name = v), { maxLength: 30, placeholder: me.name }),
          button(t('groupSaveName'), renameMe, '', { disabled: busy }),
        ),
      ),
    me && groupErrorLine('me'),
    groups.length > 0 && h('div', { class: 'groups' }, groups.map(groupBox)),
    groups.length >= GROUP.max
      ? h('p', { class: 'help' }, t('groupMaxReached', { n: GROUP.max }))
      : [
          groups.length > 0 && h('h3', { class: 'groups-add' }, t('groupAddTitle')),
          !me && groupField(groupInput('g-name', form.name, (v) => (form.name = v), { maxLength: 30 }), t('groupYourName')),
          groupField(
            groupInput('g-group-name', form.groupName, (v) => (form.groupName = v), { maxLength: 30, placeholder: t('groupNamePlaceholder') }),
            t('groupNameLabel'),
          ),
          button(t('groupCreate'), () => enterGroup(true), 'primary', { disabled: busy }),
          groupField(
            groupInput('g-code', form.code, (v) => (form.code = v), { placeholder: 'ABCD-2345', autocapitalize: 'characters', spellcheck: false }),
            t('groupCodeLabel'),
          ),
          button(t('groupJoin'), () => enterGroup(false), '', { disabled: busy }),
        ],
    isLocalHost(window.location.hostname) && h('p', { class: 'help' }, t('groupLocalhost')),
    h('p', { class: 'help' }, t('groupPrivacy')),
    groupErrorLine(null),
  ];
}

// ---- Ajustes finos --------------------------------------------------------

const roundShown = (value) => String(Number(value.toFixed(4)));

/** One tuning number: label, help, the field, and its default (with a reset when this phone changed it). */
function tuningRow(p) {
  const scale = p.percent ? 100 : 1;
  const shown = (value) => roundShown(value * scale);
  const label = t(`param:${p.key}`);
  const setPhone = (value) => {
    if (value === null) delete state.settings.params[p.key];
    else state.settings.params[p.key] = value;
    state.settings.params = cleanParams(state.settings.params);
    ui.tuningCopied = false;
    applyTuning();
    commit();
  };
  const input = h('input', {
    type: 'number',
    inputMode: 'decimal',
    min: String(p.min * scale),
    max: String(p.max * scale),
    step: String(p.step * scale),
    value: shown(paramValue(p.key)),
    'aria-label': label,
    onchange: (e) => {
      // Text the browser can't read as a number also arrives as "": put the value back, don't reset it.
      if (e.target.validity.badInput) {
        render();
        return;
      }
      const text = String(e.target.value).trim();
      const n = Number(text);
      setPhone(text === '' || !Number.isFinite(n) ? null : n / scale);
    },
  });
  const changed = paramSource(p.key) === 'phone';
  const fallback = t('tuningDefault', { value: shown(defaultParam(p.key)) });
  return h(
    'div',
    { class: `tuning-row${changed ? ' changed' : ''}` },
    h('div', { class: 'tuning-text' }, h('strong', null, label), h('span', { class: 'help' }, t(`paramHelp:${p.key}`))),
    input,
    h(
      'p',
      { class: 'help tuning-default' },
      changed ? `${t('tuningChanged')} · ${fallback}` : fallback,
      !changed && paramSource(p.key) === 'file' && ` ${t('tuningFromFile')}`,
      changed && button('↺', () => setPhone(null), 'small ghost', { 'aria-label': t('tuningReset'), title: t('tuningReset') }),
    ),
  );
}

/** What the numbers do right now: the wheel's cook share today and the most likely dishes. */
function tuningPreview() {
  const cook = wheelStats(state.deliveries, Date.now()).cook;
  const top = probabilities(mainCandidates(state.dishes), scoringContext(), state.settings.variety, [...bannedToday(state.events, Date.now())])
    .sort((a, b) => b.p - a.p)
    .slice(0, 5)
    .map((r) => `${r.dish.name} ${Math.round(r.p * 100)}%`);
  return h(
    'div',
    { class: 'tuning-preview' },
    h('p', { class: 'label' }, t('tuningPreview')),
    h('p', null, t('tuningWheelNow', { pct: Math.round(cook * 100) })),
    top.length > 0 && h('p', null, t('tuningTopDishes', { list: top.join(', ') })),
  );
}

function tuningSection() {
  const mine = Object.keys(state.settings.params).length > 0;
  const json = paramsJson(state.settings.params);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      ui.tuningCopied = true;
      render();
    } catch {
      // No clipboard: the text is shown above to copy by hand.
    }
  };
  const fileStatus = { ok: 'tuningFileOk', error: 'tuningFileError' }[paramsFile.status];
  return h(
    'details',
    {
      class: 'tuning',
      open: ui.tuningOpen,
      ontoggle: (e) => {
        ui.tuningOpen = e.target.open;
      },
    },
    h('summary', { class: 'section' }, t('tuningTitle')),
    h('p', { class: 'help' }, t('tuningHelp')),
    fileStatus && h('p', { class: 'help' }, t(fileStatus)),
    tuningPreview(),
    PARAM_GROUPS.map((group) => [
      h('h3', { class: 'tuning-group' }, t(`tuningGroup:${group}`)),
      PARAMS.filter((p) => p.group === group).map(tuningRow),
    ]),
    h('h3', { class: 'tuning-group' }, t('tuningCopy')),
    mine
      ? [
          h('p', { class: 'help' }, t('tuningCopyHelp')),
          h('textarea', { class: 'tuning-json', rows: Math.min(12, json.split('\n').length), readOnly: true, value: json }),
          h(
            'div',
            { class: 'row' },
            button(ui.tuningCopied ? t('tuningCopied') : t('tuningCopy'), copy, 'primary'),
            button(t('tuningResetAll'), () => {
              state.settings.params = {};
              applyTuning();
              commit();
            }),
          ),
        ]
      : h('p', { class: 'help' }, t('tuningNone')),
  );
}

// ---- Overlays -----------------------------------------------------------

function sheet(title, ...children) {
  return h(
    'div',
    { class: 'backdrop' },
    h('section', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('h2', null, title), children),
  );
}

function overlayMissing() {
  const dish = dishById(ui.sheet.dishId);
  const side = dishById(ui.sheet.sideId);
  const selected = ui.sheet.selected;
  const sideOnly = side ? side.ingredients.filter((i) => !dish.ingredients.includes(i)) : [];
  // When everything marked is the side's, the way out is another side, not another dish.
  const other = button(t('otherOption'), () => {
    const split = splitMissing(dish, side, [...selected]);
    if (side && split.main.length === 0 && split.side.length > 0) changeSideForMissing(split.side);
    else reject(ACTIONS.MISSING_REJECT, [...selected]);
  });
  const syncOther = () => {
    const split = splitMissing(dish, side, [...selected]);
    other.textContent = side && split.main.length === 0 && split.side.length > 0 ? t('missingSideOnly') : t('otherOption');
  };
  syncOther();
  return sheet(
    `🛒 ${t('missingTitle')}`,
    h('p', { class: 'help' }, t('missingHelp')),
    h('p', { class: 'sheet-dish' }, `${dish.emoji} ${dish.name}`),
    chipPicker(dish.ingredients, selected, syncOther),
    sideOnly.length > 0 && h('p', { class: 'sheet-dish' }, `${side.emoji} ${side.name}`),
    sideOnly.length > 0 && chipPicker(sideOnly, selected, syncOther),
    h(
      'div',
      { class: 'stack' },
      button(t('cookAnyway'), () => cook(ACTIONS.COOK_ANYWAY, [...selected]), 'primary'),
      other,
      button(
        t('cancel'),
        () => {
          ui.sheet = null;
          render();
        },
        'ghost',
      ),
    ),
  );
}

/**
 * "Elegir de la lista" on Hoy, and 🍽️ Elegir in Comidas: Comidas in pick mode (#48), with its search.
 * From Hoy the search starts empty, so one typed earlier doesn't hide what you came to pick.
 */
function openPicker() {
  const from = ui.tab;
  const search = ui.dishSearch;
  if (from !== 'dishes') {
    ui.dishSearch = '';
    switchTab('dishes');
  }
  ui.picking = { from, search };
  render();
  $('dish-title')?.focus({ preventScroll: true });
}

/** Leaves pick mode. Entered from Hoy, Comidas gets back the search it had: the one typed to pick was for that. */
function endPicking() {
  if (ui.picking?.from === 'today') ui.dishSearch = ui.picking.search;
  ui.picking = null;
}

/** Cancelar or Escape: back to where pick mode was entered from. */
function closePicker() {
  const from = ui.picking.from;
  endPicking();
  if (from !== 'dishes') {
    switchTab('today');
    return document.querySelector('#view .pick-open')?.focus();
  }
  render();
  document.querySelector('#view .pick-enter')?.focus({ preventScroll: true });
}

/**
 * Picking in Comidas while "¡A cocinar!" shows a meal already logged (#48): asks before
 * the new pick replaces it (cook() takes it back, Deshacer and all). False: stay.
 */
function confirmReplaceCooked() {
  const cooked = cookedToday() && dishById(ui.cooked.dishId);
  if (!cooked || window.confirm(t('pickReplaceCooked', { cooked: cooked.name.toLocaleLowerCase('es') }))) return true;
  document.activeElement?.blur(); // a tapped row keeps the focus, and would hold back the list's redraws
  return false;
}

/** A main picked from the list: straight to "¡A cocinar!", or first "¿Con qué?" if it takes a side. */
function pickFromList(dish) {
  const noSides = sidesOf(dish, state.dishes).length === 0;
  if (noSides && cookedToday()?.dishId === dish.id) {
    switchTab('today'); // the meal already logged: its "¡A cocinar!" stays, with Deshacer
    return focusToday();
  }
  if (!confirmReplaceCooked()) return;
  if (noSides) return cook(ACTIONS.PICK, [], dish.id, null);
  const suggested = pickSide(dish, scoringContext(), state.settings.variety);
  openSideSheet('pick', dish.id, suggested?.id ?? null);
}

/** A side chosen first: pin it, and show a main that goes with it on Hoy. */
function pinFromList(side) {
  if (!confirmReplaceCooked()) return;
  if (cookedToday()) {
    dropCooked();
    commit();
    flushGroup();
  }
  ui.pinnedSide = side.id;
  const current = dishById(ui.currentId);
  if (current && sidesOf(current, state.dishes).some((d) => d.id === side.id)) {
    ui.sideId = side.id;
    ui.sideFor = current.id;
  } else {
    ui.currentId = null;
  }
  switchTab('today');
  focusToday();
}

/** "¿Con qué?" closed without a choice: in pick mode, back on the row that opened it. */
function closeSideSheet() {
  const mainId = ui.sideSheet?.mode === 'pick' && ui.picking ? ui.sideSheet.mainId : null;
  ui.sideSheet = null;
  render();
  if (mainId) document.querySelector(`#view .dish-list > .list-item[data-dish="${CSS.escape(mainId)}"] .list-row`)?.focus();
}

/** "¿Con qué?": the main's sides. On the card it only changes the suggestion; after a list pick it logs the meal. */
function overlaySide() {
  const ss = ui.sideSheet;
  const main = dishById(ss.mainId);
  const options = sidesOf(main, state.dishes);
  const choose = (sideId) => {
    if (ss.mode === 'pick') return cook(ACTIONS.PICK, [], main.id, sideId);
    ui.sideId = sideId;
    ui.sideFor = main.id;
    if (ui.pinnedSide && ui.pinnedSide !== sideId) ui.pinnedSide = null; // a new choice replaces the pin
    ui.sideSheet = null;
    render();
  };
  const row = (dish, label, meta) =>
    h(
      'li',
      null,
      h(
        'button',
        { type: 'button', class: 'list-row', 'aria-pressed': String((dish?.id ?? null) === ss.sideId), onclick: () => choose(dish?.id ?? null) },
        h('span', { class: 'list-emoji', style: dish ? `background:${gradientFor(dish)}` : '', 'aria-hidden': 'true' }, dish?.emoji ?? '—'),
        h('span', { class: 'list-text' }, h('span', { class: 'list-name' }, label), meta && h('span', { class: 'list-meta' }, meta)),
      ),
    );
  return sheet(
    `${main.emoji} ${t('sideTitle')}`,
    h('p', { class: 'sheet-dish' }, main.name),
    h('p', { class: 'help' }, ss.mode === 'pick' ? t('sidePickHelp') : t('sideHelp')),
    h(
      'ul',
      { class: 'list' },
      options.map((d) => {
        const missing = d.ingredients.filter((i) => isMissing(state, i));
        return row(d, d.name, [`⏱ ${t('minutes', { n: d.cookMinutes })}`, missing.length > 0 && t('missingNow', { list: missing.join(', ') })].filter(Boolean).join(' · '));
      }),
      row(null, t('noSide'), null),
    ),
    h(
      'div',
      { class: 'row sheet-foot' },
      button(t('cancel'), closeSideSheet),
    ),
  );
}

// ---- Recipes and macros ------------------------------------------------

function openRecipe(mainId, sideId = null) {
  if (!dishById(mainId)) return;
  ui.recipe = { mainId, sideId };
  render();
}

const round = (n) => Math.round(n);

/** Macros and the recipe link at the bottom of the card. */
function cardFoot(main, side) {
  const macros = mealMacros(recipeFor(main), recipeFor(side));
  return h(
    'div',
    { class: 'card-foot' },
    macros && macros.kcal > 0 && h('span', { class: 'macros-short' }, t('macrosShort', { kcal: round(macros.kcal), protein: round(macros.protein) })),
    button(`📝 ${t('recipe')}`, () => openRecipe(main.id, side?.id ?? null), 'small ghost'),
  );
}

function setPortions(n) {
  state.settings.portions = Math.min(PORTIONS.max, Math.max(PORTIONS.min, n));
  commit();
}

/** − N + for how many people the amounts are for. */
function portionsControl() {
  const n = state.settings.portions;
  return h(
    'div',
    { class: 'stepper', role: 'group', 'aria-label': t('portions') },
    h('button', { type: 'button', 'aria-label': t('portionsLess'), disabled: n <= PORTIONS.min, onclick: () => setPortions(n - 1) }, '−'),
    h('span', { 'aria-live': 'polite' }, t('portionsN', { n })),
    h('button', { type: 'button', 'aria-label': t('portionsMore'), disabled: n >= PORTIONS.max, onclick: () => setPortions(n + 1) }, '+'),
  );
}

/** One dish's recipe, with amounts for the portions setting. */
function recipeSection(dish) {
  const recipe = recipeFor(dish);
  const portions = state.settings.portions;
  const head = h('h3', { class: 'recipe-title' }, `${dish.emoji} ${dish.name}`);
  if (!recipe) {
    return h(
      'section',
      { class: 'recipe' },
      head,
      h('p', { class: 'help' }, t('noRecipe')),
      button(t('addRecipe'), () => {
        ui.recipe = null;
        ui.tab = 'dishes';
        openDishForm(dish.id);
      }, 'small'),
    );
  }
  return h(
    'section',
    { class: 'recipe' },
    head,
    h('p', { class: 'list-meta' }, `⏱ ${t('minutes', { n: dish.cookMinutes })}`),
    h(
      'ul',
      { class: 'recipe-items' },
      recipe.items.map((item) => {
        const amount = itemAmount(item, recipe.serves, portions);
        return h('li', null, h('span', null, item.text), amount && h('span', { class: 'amount' }, amount));
      }),
    ),
    recipe.steps.length > 0 && h('ol', { class: 'recipe-steps' }, recipe.steps.map((step) => h('li', null, step))),
  );
}

/** Per-portion macros of the meal, with what couldn't be counted. */
function macrosTable(main, side) {
  const macros = mealMacros(recipeFor(main), recipeFor(side));
  if (!macros || macros.kcal <= 0) return null;
  const row = (label, value, unit) => h('div', { class: 'macro' }, h('span', { class: 'macro-value' }, `${round(value)}${unit}`), h('span', { class: 'macro-label' }, label));
  return h(
    'section',
    { class: 'macros' },
    h('p', { class: 'label' }, side ? t('macrosTitleMeal') : t('macrosTitle')),
    h(
      'div',
      { class: 'macro-grid' },
      row(t('kcal'), macros.kcal, ''),
      row(t('protein'), macros.protein, ' g'),
      row(t('carbs'), macros.carbs, ' g'),
      row(t('fat'), macros.fat, ' g'),
      row(t('fiber'), macros.fiber, ' g'),
    ),
    macros.missing.length > 0 && h('p', { class: 'help' }, t('macrosMissing', { list: macros.missing.join(', ') })),
    h('p', { class: 'help' }, t('macrosNote')),
  );
}

function overlayRecipe() {
  const main = dishById(ui.recipe.mainId);
  const side = dishById(ui.recipe.sideId);
  return sheet(
    `📝 ${side ? mealName(main, side) : main.name}`,
    h('div', { class: 'row portions-row' }, h('span', { class: 'label' }, t('portions')), portionsControl()),
    recipeSection(main),
    side && recipeSection(side),
    macrosTable(main, side),
    h(
      'div',
      { class: 'row sheet-foot' },
      button(t('close'), () => {
        ui.recipe = null;
        render();
      }),
    ),
  );
}

/** First run (and once after the update that added favourites): choose up to FAVORITES_MAX favourites. */
function overlayFavorites() {
  const chosen = ui.favorites;
  const count = h('p', { class: 'label' });
  const sync = () => {
    count.textContent = t('favoritesCount', { n: chosen.size, max: FAVORITES_MAX });
  };
  sync();
  const finish = (ids) => {
    if (ids) setFavorites(state, ids);
    else state.settings.favoritesAsked = true;
    ui.favorites = null;
    ui.sideFor = null;
    commit();
  };
  return sheet(
    t('favoritesTitle', { n: FAVORITES_MAX }),
    h('p', { class: 'help' }, t('favoritesHelp')),
    count,
    h(
      'div',
      { class: 'chips' },
      mainCandidates(state.dishes)
        .filter((d) => !d.neverShow)
        .map((dish) => {
          const chip = h(
            'button',
            {
              type: 'button',
              class: 'chip',
              'aria-pressed': String(chosen.has(dish.id)),
              onclick: () => {
                if (chosen.has(dish.id)) chosen.delete(dish.id);
                else if (chosen.size < FAVORITES_MAX) chosen.add(dish.id);
                chip.setAttribute('aria-pressed', String(chosen.has(dish.id)));
                sync();
              },
            },
            `${dish.emoji} ${dish.name}`,
          );
          return chip;
        }),
    ),
    h(
      'div',
      { class: 'row sheet-foot' },
      button(t('favoritesLater'), () => finish(null), 'ghost'),
      button(t('done'), () => finish([...chosen]), 'primary'),
    ),
  );
}

function overlayMood() {
  const current = moodToday(state, Date.now());
  const choose = (id) => {
    setMood(state, id, Date.now());
    ui.mood = false;
    const keep = ui.keepCard;
    ui.keepCard = null;
    // Another mood weighs the dishes differently: draw the card and its side again,
    // unless it's a dish just chosen from Amigos (#40).
    if (id !== current && !(keep && keep === ui.currentId)) {
      ui.currentId = null;
      ui.sideFor = null;
    }
    commit();
  };
  return sheet(
    t('moodTitle'),
    h('p', { class: 'help' }, t('moodHelp')),
    h(
      'ul',
      { class: 'list' },
      MOOD_IDS.map((id) =>
        h(
          'li',
          null,
          h(
            'button',
            { type: 'button', class: 'list-row', 'aria-pressed': String(id === current), onclick: () => choose(id) },
            h('span', { class: 'list-emoji', style: `background:${gradientFor({ id: `mood-${id}` })}`, 'aria-hidden': 'true' }, MOOD_EMOJI[id]),
            h('span', { class: 'list-text' }, h('span', { class: 'list-name' }, t(`mood:${id}`)), h('span', { class: 'list-meta' }, t(`moodMeta:${id}`))),
          ),
        ),
      ),
    ),
    // Reopened from the chip, there is an answer to keep: a way back without changing it.
    current &&
      h(
        'div',
        { class: 'row sheet-foot' },
        button(t('cancel'), () => {
          ui.mood = false;
          render();
        }),
      ),
  );
}

function overlayAfterMeal() {
  const am = ui.afterMeal;
  const dish = dishById(am.dishId);
  const side = dishById(am.event.sideId);
  const finish = (answer) => {
    logAfterMeal(state, am.event, answer);
    ui.afterMeal = null;
    commit();
  };
  const verdictButton = (value, emoji, label) => {
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'thumb',
        'aria-pressed': String(am.verdict === value),
        onclick: () => {
          am.verdict = am.verdict === value ? null : value;
          for (const b of btn.parentElement.children) b.setAttribute('aria-pressed', String(b === btn && am.verdict === value));
        },
      },
      h('span', { 'aria-hidden': 'true' }, emoji),
      label,
    );
    return btn;
  };
  return sheet(
    t('afterMealTitle'),
    h('p', { class: 'sheet-dish' }, `${dish.emoji}${side?.emoji ?? ''} ${mealName(dish, side)}`),
    h('p', { class: 'label' }, t('ranOut')),
    h('p', { class: 'help' }, t('ranOutHelp')),
    chipPicker(mealIngredients(dish, side), am.selected),
    // The 👍/👎 moves the main's "rico" score, so say which dish it is about.
    h('p', { class: 'label' }, side ? t('howWasItMain', { name: dish.name.toLocaleLowerCase('es') }) : t('howWasIt')),
    h('div', { class: 'thumbs' }, verdictButton('up', '👍', t('thumbsUp')), verdictButton('down', '👎', t('thumbsDown'))),
    h(
      'div',
      { class: 'row' },
      button(t('skip'), () => finish({}), 'ghost'),
      button(t('done'), () => finish({ missing: [...am.selected], verdict: am.verdict }), 'primary'),
    ),
  );
}

// ---- Render -------------------------------------------------------------

const TABS = [
  ['today', '🍽️', 'tabToday', viewToday],
  ['dishes', '📖', 'tabDishes', viewDishes],
  ['pantry', '🛒', 'tabPantry', viewPantry],
  ['friends', '💞', 'tabFriends', viewFriends],
  ['settings', '⚙️', 'tabSettings', viewSettings],
];

function switchTab(tab) {
  if (tab !== ui.tab) ui.shopRows = null; // Despensa: rows bought go when you leave the list
  if (tab === 'pantry' && ui.tab !== 'pantry') {
    ui.pantryStart = pantrySnapshot();
    ui.pantryAllDone = false;
  }
  ui.tab = tab;
  ui.editing = null;
  endPicking(); // another tab, or Comidas' own button: a list to edit again
  wheelView.close();
  if (tab === 'settings' || tab === 'friends') refreshGroupList(true);
  if (tab === 'today' || tab === 'dishes') refreshGroupList();
  render();
  window.scrollTo(0, 0);
}

function renderBanners() {
  $('banners').replaceChildren(
    ...ui.banners.map((b) =>
      h(
        'div',
        { class: 'banner', role: 'status' },
        h('span', null, b.text),
        b.action && button(b.actionLabel, b.action, 'small primary'),
        !b.sticky &&
          button('✕', () => {
            ui.banners = ui.banners.filter((x) => x !== b);
            renderBanners();
          }, 'small ghost', { 'aria-label': t('close') }),
      ),
    ),
  );
}

/** The tab bar. Despensa redraws it alone after a tap, for its count. */
function renderTabs() {
  $('tabs').replaceChildren(
    ...TABS.map(([id, icon, label]) =>
      h(
        'button',
        { type: 'button', class: 'tab', 'aria-current': id === ui.tab ? 'page' : null, onclick: () => switchTab(id) },
        h('span', { class: 'tab-icon', 'aria-hidden': 'true' }, icon),
        h('span', { class: 'tab-label' }, t(label)),
        id === 'pantry' && state.missing.length > 0 && h('span', { class: 'count' }, String(state.missing.length)),
      ),
    ),
  );
}

function render() {
  if (ui.afterMeal && !dishById(ui.afterMeal.dishId)) ui.afterMeal = null;
  if (ui.sheet && !dishById(ui.sheet.dishId)) ui.sheet = null;
  if (ui.sideSheet && !dishById(ui.sideSheet.mainId)) ui.sideSheet = null;
  if (ui.recipe && !dishById(ui.recipe.mainId)) ui.recipe = null;
  // Ask how the cook is once a day, then (only the first time) for favourites:
  // on Hoy, when nothing else is open.
  const quiet = !ui.afterMeal && !ui.sheet && !ui.sideSheet && !ui.recipe && !ui.friends && !ui.cooked && !ui.wheel;
  if (!ui.mood && !ui.favorites && moodToday(state, Date.now()) === null && !ui.readOnly && ui.tab === 'today' && quiet) {
    ui.mood = true;
  }
  if (!ui.mood && !ui.favorites && !state.settings.favoritesAsked && !ui.readOnly && ui.tab === 'today' && quiet) {
    ui.favorites = new Set(state.dishes.filter((d) => d.favorite).map((d) => d.id));
  }

  const view = TABS.find(([id]) => id === ui.tab)[3];
  const main = $('view');
  main.className = `view view-${ui.tab}`;
  main.replaceChildren(...[view()].flat(Infinity).filter(Boolean));

  renderTabs();
  if (ui.tab === 'pantry' && ui.pantryView === 'have') filterPantry(); // the search typed before a redraw
  if (ui.tab === 'dishes' && !ui.editing) filterDishes(); // the same in Comidas (#46)

  const overlay = ui.afterMeal
    ? overlayAfterMeal()
    : ui.mood
      ? overlayMood()
      : ui.favorites
        ? overlayFavorites()
        : ui.sheet
          ? overlayMissing()
          : ui.sideSheet
            ? overlaySide()
            : ui.friends
              ? overlayFriends()
              : ui.recipe
                ? overlayRecipe()
                : null;
  $('overlay').replaceChildren(...(overlay ? [overlay] : []));
  document.body.classList.toggle('has-overlay', Boolean(overlay));
}

// ---- Service worker and install -----------------------------------------

function watchServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const offerUpdate = (registration) => {
    addBanner('update', t('updateAvailable'), {
      actionLabel: t('reload'),
      // The waiting worker takes over, `controllerchange` fires, and the page reloads.
      action: () => registration.waiting?.postMessage({ type: 'SKIP_WAITING' }),
      sticky: true,
    });
  };

  navigator.serviceWorker
    .register('./sw.js')
    .then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration);
      // Stored data from a newer version means this copy is stale: go and get the update.
      if (ui.readOnly) registration.update().catch(() => {});
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(registration);
        });
      });
      // An installed PWA can stay open for days: look for updates whenever it comes back to the front.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      });
    })
    .catch(() => {
      /* no service worker (e.g. opened from file://): the app still works online */
    });

  // Reload when a NEW version takes over (from this tab or another one). The
  // very first install also fires `controllerchange`; that one needs no reload.
  let controlled = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlled) {
      controlled = true;
      return;
    }
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

// ---- Start --------------------------------------------------------------

document.documentElement.lang = lang;
document.title = t('appName');

reportLoadProblem(loaded);

// Another copy of the app (a second tab, or the installed app next to a tab)
// saved: take its state, so this copy's next save can't drop its events.
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY && e.key !== null) return;
  const reloaded = loadState();
  state = reloaded.state;
  applyTuning();
  reportLoadProblem(reloaded);
  // These hold objects from the old state. An open dish form keeps what was typed.
  ui.cooked = null;
  ui.afterMeal = null;
  ui.sideFor = null;
  checkAfterMeal();
  ui.pantryUndo = null; // its record is of the old state
  if (!ui.editing) redrawKeepingFocus(); // a plain render() off Despensa
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  ui.installPrompt = e;
  if (ui.tab === 'settings') render();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  refreshParamsFile();
  flushGroup();
  refreshGroupList();
  const before = ui.afterMeal;
  checkAfterMeal();
  // Back on a new day: render() asks how the cook is (only on Hoy, so an open dish form keeps what was typed).
  const moodDue = !ui.mood && ui.tab === 'today' && moodToday(state, Date.now()) === null;
  // Amigos and Comidas' 💞 (#46): today may be yesterday now.
  if (ui.afterMeal !== before || moodDue || (ui.tab === 'friends' && !ui.afterMeal) || dishMarksChanged()) render();
});

document.addEventListener('keydown', (e) => {
  // Who picked closes alone (back to the list it may have come from), when it's the sheet showing (see render()).
  if (e.key === 'Escape' && ui.friends && !ui.afterMeal && !ui.mood && !ui.favorites && !ui.sheet && !ui.sideSheet) {
    closeFriends();
    return;
  }
  if (e.key === 'Escape' && ui.sideSheet && !ui.afterMeal && !ui.favorites && !ui.sheet) {
    closeSideSheet();
    return;
  }
  if (e.key === 'Escape' && !ui.afterMeal && !ui.favorites && (ui.sheet || ui.sideSheet || ui.recipe)) {
    ui.sheet = null;
    ui.sideSheet = null;
    ui.recipe = null;
    render();
    return;
  }
  // Comidas in pick mode (#48): Escape leaves it, when no sheet is over it.
  if (e.key === 'Escape' && ui.picking && ui.tab === 'dishes' && !ui.editing && !$('overlay').hasChildNodes()) {
    closePicker();
    return;
  }
  if (ui.tab !== 'today' || ui.wheel || ui.cooked || ui.sheet || ui.sideSheet || ui.favorites || ui.mood || ui.recipe || ui.friends || ui.afterMeal) return;
  if (e.target.closest?.('input, textarea, select')) return;
  if (e.key === 'ArrowRight') cardKeys?.right();
  else if (e.key === 'ArrowLeft') cardKeys?.left();
});

window.addEventListener('online', () => {
  flushGroup();
  refreshGroupList();
  if (ui.tab === 'friends' && !ui.afterMeal) render(); // "Sin conexión." goes
});
window.addEventListener('offline', () => {
  if (ui.tab === 'friends' && !ui.afterMeal) render(); // "Sin conexión." shows
});
// The app can stay open for a long dinner decision: look again now and then,
// and retry picks that a server error (5xx) or the rate limit held back.
setInterval(() => {
  if (document.visibilityState !== 'visible') return;
  refreshGroupList();
  flushGroup();
}, GROUP_REFRESH_MS);

checkAfterMeal();
render();
watchServiceWorker();
refreshParamsFile();
flushGroup();
refreshGroupList();
