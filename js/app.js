// UI. All text comes from strings.js, all scoring from scoring.js, all state
// changes go through state.js and are saved by commit().

import { ACTIONS, FAVORITES_MAX, afterMealDue, mainCandidates, mealMinutes, pickDish, pickSide, probabilities, sidesOf } from './scoring.js';
import { PARAMS, PARAM_GROUPS, applyParams, cleanParams, defaultParam, paramSource, paramValue, paramsJson } from './params.js';
import {
  MAX_MAINS,
  PORTIONS,
  allIngredients,
  allMains,
  cleanDish,
  cleanNames,
  cleanRecipe,
  favoriteCount,
  isMissing,
  logAfterMeal,
  logCardAction,
  markInStock,
  markMissing,
  normalizeState,
  planUndo,
  setFavorites,
  splitMissing,
  toggleFavorite,
  undoCardAction,
} from './state.js';
import { formatItem, itemAmount, mealMacros, parseItem } from './nutrition.js';
import { recipeFor } from './recipes.js';
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
  sideId: null, // the side shown with it, or null ("sin acompañamiento", or a complete dish)
  sideFor: null, // the card the side was drawn for: a new card draws a new side
  pinnedSide: null, // 📌 a side the user fixed: only mains that go with it are suggested
  sideSheet: null, // {mode: 'card' | 'pick', mainId, sideId} while the "¿Con qué?" sheet is open
  favorites: null, // Set of dish ids while the "choose your favourites" question shows
  recipe: null, // {mainId, sideId} while the recipe sheet is open
  cooked: null, // {dishId, event, undo} while the "¡A cocinar!" panel shows
  sheet: null, // {dishId, sideId, selected:Set} while the 🛒 sheet is open
  picking: false, // while the "pick from the whole list" sheet is open
  readOnly: false, // stored data is from a newer app version: never save over it
  afterMeal: null, // {event, dishId, selected:Set, verdict} while the question shows
  editing: null, // {id} (id null = new dish) while the dish form shows
  wheel: null, // the delivery wheel's screen state while it is open (see wheel-view.js)
  banners: [], // [{id, text, actionLabel?, action?, sticky?}]
  saveWarned: false,
  installPrompt: null,
  tuningOpen: false, // the "Ajustes finos" section is expanded
  tuningCopied: false,
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
  if (ui.readOnly) return render();
  if (!saveState(state) && !ui.saveWarned) {
    ui.saveWarned = true;
    addBanner('save', t('storageSaveFailed'));
  }
  render();
}

function addBanner(id, text, { actionLabel, action, sticky = false } = {}) {
  ui.banners = ui.banners.filter((b) => b.id !== id);
  ui.banners.push({ id, text, actionLabel, action, sticky });
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
  return {
    now: Date.now(),
    events: state.events,
    dishes: state.dishes,
    isMissing: (name) => isMissing(state, name),
    pinnedSideId: ui.pinnedSide,
  };
}

/** The mains the card can show: all of them, or only those that go with the pinned side. */
const cardCandidates = () => mainCandidates(state.dishes, ui.pinnedSide);

function pick(exclude = []) {
  const variety = state.settings.variety;
  const ctx = scoringContext();
  const candidates = cardCandidates();
  // Don't show the same card twice in a row, unless it's the only one left.
  return pickDish(candidates, ctx, variety, { exclude }) ?? pickDish(candidates, ctx, variety);
}

function nextCard() {
  ui.currentId = pick(ui.currentId ? [ui.currentId] : [])?.id ?? null;
  ui.sideFor = null;
}

function ensureCurrent() {
  if (ui.pinnedSide && !dishById(ui.pinnedSide)) ui.pinnedSide = null;
  const current = dishById(ui.currentId);
  if (!current || current.neverShow || !cardCandidates().includes(current)) {
    ui.currentId = pick()?.id ?? null;
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
  if (ui.afterMeal || ui.sheet || ui.picking || ui.sideSheet || ui.favorites) return;
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
  const undo = planUndo(state, dish.id, missing, sideId);
  const event = logCardAction(state, dish.id, action, missing, Date.now(), sideId);
  ui.cooked = { dishId: dish.id, event, undo };
  ui.sheet = null;
  ui.sideSheet = null;
  ui.picking = false;
  ui.pinnedSide = null; // the pin was for tonight's meal
  commit();
}

/**
 * "Me falta" when only the side's ingredients are missing: the side gets the
 * light "missing" penalty and is swapped for another one. The main is untouched.
 */
function changeSideForMissing(missing) {
  const main = dishById(ui.currentId);
  const old = ui.sideId;
  if (!main || !old) return;
  logCardAction(state, old, ACTIONS.MISSING_REJECT, missing);
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
  const { event, undo } = ui.cooked;
  undoCardAction(state, event, undo);
  ui.cooked = null; // back to the card that was showing
  commit();
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

function attachSwipe(card) {
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
    if (dx > SWIPE_THRESHOLD) swipeRight();
    else if (dx < -SWIPE_THRESHOLD) swipeLeft();
    else {
      reset();
      if (Math.abs(dx) < TAP_SLOP) openRecipe(ui.currentId, ui.sideId); // a tap, not a drag
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
    h('div', { class: 'variety' }, h('span', { class: 'label' }, t('variety')), varietyControl()),
  );

  if (ui.cooked && dishById(ui.cooked.dishId)) return [header, viewCooked()];

  ensureCurrent();
  const dish = dishById(ui.currentId);
  const pinned = dishById(ui.pinnedSide);
  const pinNote =
    pinned &&
    h('div', { class: 'pin-note', role: 'status' }, h('span', null, t('pinnedNote', { name: pinned.name.toLocaleLowerCase('es') })), button(t('unpinShort'), unpin, 'small ghost'));
  if (!dish && pinned) {
    return [
      header,
      h(
        'section',
        { class: 'empty' },
        h('div', { class: 'empty-emoji', 'aria-hidden': 'true' }, pinned.emoji),
        h('h2', null, t('pinnedNone', { name: pinned.name.toLocaleLowerCase('es') })),
        h('p', null, t('pinnedNoneText', { name: pinned.name.toLocaleLowerCase('es') })),
        button(`📌 ${t('unpinShort')}`, unpin, 'primary'),
      ),
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
        state.dishes.length > 0 && button(`📖 ${t('pickFromList')}`, openPicker),
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
  attachSwipe(card);

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
    h('div', { class: 'row more' }, button(`📖 ${t('pickFromList')}`, openPicker), wheelButton()),
    h('p', { class: 'hint' }, t('swipeHint')),
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

function dishRow(dish) {
  const sideCount = dish.role === 'main' ? sidesOf(dish, state.dishes).length : 0;
  const sidesText = sideCount === 0 ? '' : ` · ${sideCount === 1 ? t('sidesCountOne') : t('sidesCount', { n: sideCount })}`;
  return h(
    'li',
    { class: 'list-item' },
    h(
      'button',
      { type: 'button', class: 'list-row', onclick: () => openDishForm(dish.id) },
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

function viewDishes() {
  if (ui.editing) return viewDishForm();
  const sides = state.dishes.filter((d) => d.role === 'side');
  return [
    h('header', { class: 'top' }, h('h1', null, t('dishesTitle'))),
    button(`＋ ${t('addDish')}`, () => openDishForm(null), 'primary wide'),
    h('ul', { class: 'list' }, mainCandidates(state.dishes).map(dishRow)),
    sides.length > 0 && h('h2', { class: 'list-heading' }, t('sidesSection')),
    sides.length > 0 && h('ul', { class: 'list' }, sides.map(dishRow)),
  ];
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

function viewPantry() {
  const manual = state.settings.pantryMode === 'manual';
  const addInput = h('input', { type: 'text', placeholder: t('addItemPlaceholder'), 'aria-label': t('addItemPlaceholder'), autocomplete: 'off', autocapitalize: 'none' });
  const addItem = (e) => {
    e.preventDefault();
    const names = splitList(addInput.value);
    if (names.length === 0) return;
    markMissing(state, names);
    commit();
  };

  return [
    h('header', { class: 'top' }, h('h1', null, t('shoppingTitle'))),
    state.missing.length === 0
      ? h('p', { class: 'muted' }, t('shoppingEmpty'))
      : h(
          'ul',
          { class: 'list' },
          state.missing.map((name) =>
            h(
              'li',
              { class: 'shop-row' },
              h('span', null, name),
              button(`✓ ${t('bought')}`, () => {
                markInStock(state, [name]);
                commit();
              }, 'small'),
            ),
          ),
        ),
    h('form', { class: 'add-row', onsubmit: addItem }, addInput, h('button', { type: 'submit', class: 'btn' }, t('add'))),
    h('h2', { class: 'section' }, t('pantryTitle')),
    h('p', { class: 'help' }, manual ? t('pantryHelpManual') : t('pantryHelpLazy')),
    h(
      'div',
      { class: 'chips' },
      allIngredients(state).map((name) => {
        const onList = state.missing.includes(name);
        const have = manual ? state.inStock.includes(name) : !onList;
        const status = have ? 'have' : onList ? 'out' : 'unknown';
        return h(
          'button',
          {
            type: 'button',
            class: `chip pantry ${status}`,
            'aria-pressed': String(have),
            'aria-label': `${name}: ${have ? t('have') : t('missing')}`,
            onclick: () => {
              if (have) markMissing(state, [name]);
              else markInStock(state, [name]);
              commit();
            },
          },
          h('span', { 'aria-hidden': 'true' }, have ? '✓ ' : onList ? '🛒 ' : ''),
          name,
        );
      }),
    ),
  ];
}

function exportData() {
  downloadText(JSON.stringify(state, null, 2), `que-comemos-hoy-${today()}.json`);
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
  state = next;
  applyTuning();
  wheelView.close();
  Object.assign(ui, { currentId: null, cooked: null, sheet: null, picking: false, afterMeal: null, editing: null });
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
    h('h2', { class: 'section' }, t('variety')),
    varietyControl(),
    h('p', { class: 'help' }, t('varietyHelp')),
    h('h2', { class: 'section' }, t('portions')),
    portionsControl(),
    h('p', { class: 'help' }, t('portionsHelp')),
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
  const top = probabilities(mainCandidates(state.dishes), scoringContext(), state.settings.variety)
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

function openPicker() {
  ui.picking = true;
  render();
}

/** A main picked from the list: straight to "¡A cocinar!", or first "¿Con qué?" if it takes a side. */
function pickFromList(dish) {
  if (sidesOf(dish, state.dishes).length === 0) return cook(ACTIONS.PICK, [], dish.id, null);
  const suggested = pickSide(dish, scoringContext(), state.settings.variety);
  ui.picking = false;
  openSideSheet('pick', dish.id, suggested?.id ?? null);
}

/** A side chosen first: pin it, and show a main that goes with it. */
function pinFromList(side) {
  ui.pinnedSide = side.id;
  ui.picking = false;
  const current = dishById(ui.currentId);
  if (current && sidesOf(current, state.dishes).some((d) => d.id === side.id)) {
    ui.sideId = side.id;
    ui.sideFor = current.id;
  } else {
    ui.currentId = null;
  }
  ui.cooked = null;
  render();
}

/** The whole dish list, "never show" ones included. Tapping one logs it as tonight's meal. */
function overlayPicker() {
  // Sides that go with at least one main can be chosen first.
  const pinnable = state.dishes.filter((d) => d.role === 'side' && mainCandidates(state.dishes, d.id).length > 0);
  return sheet(
    `📖 ${t('pickTitle')}`,
    h('p', { class: 'help' }, t('pickHelp')),
    h(
      'ul',
      { class: 'list' },
      mainCandidates(state.dishes).map((dish) =>
        h(
          'li',
          null,
          h(
            'button',
            { type: 'button', class: 'list-row', onclick: () => pickFromList(dish) },
            h('span', { class: 'list-emoji', style: `background:${gradientFor(dish)}`, 'aria-hidden': 'true' }, dish.emoji),
            h(
              'span',
              { class: 'list-text' },
              h('span', { class: 'list-name' }, dish.name),
              h('span', { class: 'list-meta' }, `⏱ ${t('minutes', { n: dish.cookMinutes })}`),
            ),
            dish.neverShow && h('span', { class: 'badge' }, t('hidden')),
          ),
        ),
      ),
    ),
    pinnable.length > 0 && h('p', { class: 'label' }, t('pickSidesFirst')),
    pinnable.length > 0 && h('p', { class: 'help' }, t('pickSidesFirstHelp')),
    pinnable.length > 0 &&
      h(
        'div',
        { class: 'chips' },
        pinnable.map((side) => button(`📌 ${side.emoji} ${side.name}`, () => pinFromList(side), 'chip')),
      ),
    button(
      t('cancel'),
      () => {
        ui.picking = false;
        render();
      },
      'sheet-foot',
    ),
  );
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
    button(
      t('cancel'),
      () => {
        ui.sideSheet = null;
        render();
      },
      'sheet-foot',
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
    button(
      t('close'),
      () => {
        ui.recipe = null;
        render();
      },
      'sheet-foot',
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
  ['settings', '⚙️', 'tabSettings', viewSettings],
];

function switchTab(tab) {
  ui.tab = tab;
  ui.editing = null;
  wheelView.close();
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

function render() {
  if (ui.afterMeal && !dishById(ui.afterMeal.dishId)) ui.afterMeal = null;
  if (ui.sheet && !dishById(ui.sheet.dishId)) ui.sheet = null;
  if (ui.sideSheet && !dishById(ui.sideSheet.mainId)) ui.sideSheet = null;
  if (ui.recipe && !dishById(ui.recipe.mainId)) ui.recipe = null;
  // Ask for favourites once, on Hoy, when nothing else is open.
  const quiet = !ui.afterMeal && !ui.sheet && !ui.picking && !ui.sideSheet && !ui.cooked && !ui.wheel;
  if (!ui.favorites && !state.settings.favoritesAsked && !ui.readOnly && ui.tab === 'today' && quiet) {
    ui.favorites = new Set(state.dishes.filter((d) => d.favorite).map((d) => d.id));
  }

  const view = TABS.find(([id]) => id === ui.tab)[3];
  const main = $('view');
  main.className = `view view-${ui.tab}`;
  main.replaceChildren(...[view()].flat(Infinity).filter(Boolean));

  $('tabs').replaceChildren(
    ...TABS.map(([id, icon, label]) =>
      h(
        'button',
        { type: 'button', class: 'tab', 'aria-current': id === ui.tab ? 'page' : null, onclick: () => switchTab(id) },
        h('span', { class: 'tab-icon', 'aria-hidden': 'true' }, icon),
        h('span', null, t(label)),
        id === 'pantry' && state.missing.length > 0 && h('span', { class: 'count' }, String(state.missing.length)),
      ),
    ),
  );

  const overlay = ui.afterMeal
    ? overlayAfterMeal()
    : ui.favorites
      ? overlayFavorites()
      : ui.sheet
        ? overlayMissing()
        : ui.sideSheet
          ? overlaySide()
          : ui.picking
            ? overlayPicker()
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
  if (!ui.editing) render();
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  ui.installPrompt = e;
  if (ui.tab === 'settings') render();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  refreshParamsFile();
  const before = ui.afterMeal;
  checkAfterMeal();
  if (ui.afterMeal !== before) render();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !ui.afterMeal && !ui.favorites && (ui.sheet || ui.picking || ui.sideSheet || ui.recipe)) {
    ui.sheet = null;
    ui.picking = false;
    ui.sideSheet = null;
    ui.recipe = null;
    render();
    return;
  }
  if (ui.tab !== 'today' || ui.wheel || ui.cooked || ui.sheet || ui.picking || ui.sideSheet || ui.favorites || ui.recipe || ui.afterMeal) return;
  if (e.target.closest?.('input, textarea, select')) return;
  if (e.key === 'ArrowRight') swipeRight();
  else if (e.key === 'ArrowLeft') swipeLeft();
});

checkAfterMeal();
render();
watchServiceWorker();
refreshParamsFile();
