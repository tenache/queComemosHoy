// UI. All text comes from strings.js, all scoring from scoring.js, all state
// changes go through state.js and are saved by commit().

import { ACTIONS, afterMealDue, pickDish } from './scoring.js';
import {
  MAX_MAINS,
  allIngredients,
  allMains,
  cleanDish,
  cleanNames,
  isMissing,
  logAfterMeal,
  logCardAction,
  markInStock,
  markMissing,
  normalizeState,
  planUndo,
  undoCardAction,
} from './state.js';
import { STORAGE_KEY, loadState, readBackup, saveState } from './storage.js';
import { lang, t } from './strings.js';
import { createWheelView } from './wheel-view.js';

const SWIPE_THRESHOLD = 80; // px
const FLY_MS = 180;

const loaded = loadState();
let state = loaded.state;

const ui = {
  tab: 'today',
  currentId: null, // dish on the suggestion card
  cooked: null, // {dishId, event, undo} while the "¡A cocinar!" panel shows
  sheet: null, // {dishId, selected:Set} while the 🛒 sheet is open
  picking: false, // while the "pick from the whole list" sheet is open
  readOnly: false, // stored data is from a newer app version: never save over it
  afterMeal: null, // {event, dishId, selected:Set, verdict} while the question shows
  editing: null, // {id} (id null = new dish) while the dish form shows
  wheel: null, // the delivery wheel's screen state while it is open (see wheel-view.js)
  banners: [], // [{id, text, actionLabel?, action?, sticky?}]
  saveWarned: false,
  installPrompt: null,
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
function chipPicker(names, selected) {
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
  };
}

function pick(exclude = []) {
  const variety = state.settings.variety;
  const ctx = scoringContext();
  // Don't show the same card twice in a row, unless it's the only one left.
  return pickDish(state.dishes, ctx, variety, { exclude }) ?? pickDish(state.dishes, ctx, variety);
}

function nextCard() {
  ui.currentId = pick(ui.currentId ? [ui.currentId] : [])?.id ?? null;
}

function ensureCurrent() {
  const current = dishById(ui.currentId);
  if (!current || current.neverShow) ui.currentId = pick()?.id ?? null;
}

function checkAfterMeal() {
  if (ui.afterMeal || ui.sheet || ui.picking) return;
  const due = afterMealDue(state.events, state.dishes, Date.now());
  if (!due) return;
  ui.afterMeal = { event: due.event, dishId: due.dish.id, selected: new Set(), verdict: null };
  ui.cooked = null;
}

// ---- Card actions -------------------------------------------------------

/** Logs a meal: the card's dish, or any dish picked from the whole list. */
function cook(action, missing = [], dishId = ui.currentId) {
  const dish = dishById(dishId);
  if (!dish) return;
  const undo = planUndo(state, dish.id, missing);
  const event = logCardAction(state, dish.id, action, missing);
  ui.cooked = { dishId: dish.id, event, undo };
  ui.sheet = null;
  ui.picking = false;
  commit();
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
  ui.sheet = { dishId: dish.id, selected: new Set(dish.ingredients.filter((i) => state.missing.includes(i))) };
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
    else reset();
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

  const missingNow = dish.ingredients.filter((i) => isMissing(state, i));
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
      h('h2', null, dish.name),
      h(
        'p',
        { class: 'meta' },
        h('span', null, `⏱ ${t('minutes', { n: dish.cookMinutes })}`),
        rating(t('health'), dish.health),
        rating(t('yum'), dish.yum),
      ),
      h('p', { class: 'label' }, t('mainIngredients')),
      h('div', { class: 'chips static' }, dish.mains.map((m) => h('span', { class: 'chip' }, m))),
      missingNow.length > 0 && h('p', { class: 'missing-now' }, t('missingNow', { list: missingNow.join(', ') })),
    ),
  );
  attachSwipe(card);

  return [
    header,
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
  const toBuy = ui.cooked.event.missing;
  return h(
    'section',
    { class: 'cooked' },
    h('div', { class: 'cooked-art', style: `background:${gradientFor(dish)}` }, h('span', { 'aria-hidden': 'true' }, dish.emoji)),
    h('h2', null, t('cookedTitle')),
    h('p', null, t('cookedText', { name: dish.name })),
    h('p', { class: 'label' }, t('ingredients')),
    h('div', { class: 'chips static' }, dish.ingredients.map((i) => h('span', { class: 'chip' }, i))),
    toBuy.length > 0 && h('p', { class: 'missing-now' }, `🛒 ${t('cookedToBuy', { list: toBuy.join(', ') })}`),
    h(
      'div',
      { class: 'row' },
      button(t('undo'), undoCook),
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

function viewDishes() {
  if (ui.editing) return viewDishForm();
  return [
    h('header', { class: 'top' }, h('h1', null, t('dishesTitle'))),
    button(`＋ ${t('addDish')}`, () => openDishForm(null), 'primary wide'),
    h(
      'ul',
      { class: 'list' },
      state.dishes.map((dish) =>
        h(
          'li',
          null,
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
                `⏱ ${t('minutes', { n: dish.cookMinutes })} · ${t('health')} ${Math.round(dish.health)} · ${t('yum')} ${Math.round(dish.yum)}`,
              ),
            ),
            dish.neverShow && h('span', { class: 'badge' }, t('hidden')),
          ),
        ),
      ),
    ),
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
  const dish = original ?? { name: '', emoji: '🍽️', ingredients: [], mains: [], cookMinutes: 30, health: 3, yum: 3, neverShow: false };
  const picked = { health: Math.round(dish.health), yum: Math.round(dish.yum) };

  const name = h('input', { id: 'f-name', type: 'text', value: dish.name, autocomplete: 'off', required: true });
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
      health: keep('health'),
      yum: keep('yum'),
      liking: original?.liking ?? 0,
      neverShow: neverShow.checked,
    });
    // Look the dish up again by id: the state may have been reloaded while the form was open.
    const index = state.dishes.findIndex((d) => d.id === saved.id);
    if (index >= 0) state.dishes[index] = { ...saved, liking: state.dishes[index].liking };
    else state.dishes.push(saved);
    ui.editing = null;
    commit();
  };

  const remove = () => {
    if (!window.confirm(t('confirmDelete', { name: original.name }))) return;
    state.dishes = state.dishes.filter((d) => d.id !== original.id);
    if (ui.currentId === original.id) ui.currentId = null;
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
      field(minutes, t('fieldMinutes')),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('fieldHealth')), scale('health', t('fieldHealth'))),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, t('fieldYum')), scale('yum', t('fieldYum'))),
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
  const selected = ui.sheet.selected;
  return sheet(
    `🛒 ${t('missingTitle')}`,
    h('p', { class: 'sheet-dish' }, `${dish.emoji} ${dish.name}`),
    h('p', { class: 'help' }, t('missingHelp')),
    chipPicker(dish.ingredients, selected),
    h(
      'div',
      { class: 'stack' },
      button(t('cookAnyway'), () => cook(ACTIONS.COOK_ANYWAY, [...selected]), 'primary'),
      button(t('otherOption'), () => reject(ACTIONS.MISSING_REJECT, [...selected])),
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

/** The whole dish list, "never show" ones included. Tapping one logs it as tonight's meal. */
function overlayPicker() {
  return sheet(
    `📖 ${t('pickTitle')}`,
    h('p', { class: 'help' }, t('pickHelp')),
    h(
      'ul',
      { class: 'list' },
      state.dishes.map((dish) =>
        h(
          'li',
          null,
          h(
            'button',
            { type: 'button', class: 'list-row', onclick: () => cook(ACTIONS.PICK, [], dish.id) },
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

function overlayAfterMeal() {
  const am = ui.afterMeal;
  const dish = dishById(am.dishId);
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
    h('p', { class: 'sheet-dish' }, `${dish.emoji} ${dish.name}`),
    h('p', { class: 'label' }, t('ranOut')),
    h('p', { class: 'help' }, t('ranOutHelp')),
    chipPicker(dish.ingredients, am.selected),
    h('p', { class: 'label' }, t('howWasIt')),
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

  const overlay = ui.afterMeal ? overlayAfterMeal() : ui.sheet ? overlayMissing() : ui.picking ? overlayPicker() : null;
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
  reportLoadProblem(reloaded);
  // These hold objects from the old state. An open dish form keeps what was typed.
  ui.cooked = null;
  ui.afterMeal = null;
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
  const before = ui.afterMeal;
  checkAfterMeal();
  if (ui.afterMeal !== before) render();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !ui.afterMeal && (ui.sheet || ui.picking)) {
    ui.sheet = null;
    ui.picking = false;
    render();
    return;
  }
  if (ui.tab !== 'today' || ui.wheel || ui.cooked || ui.sheet || ui.picking || ui.afterMeal) return;
  if (e.target.closest?.('input, textarea, select')) return;
  if (e.key === 'ArrowRight') swipeRight();
  else if (e.key === 'ArrowLeft') swipeLeft();
});

checkAfterMeal();
render();
watchServiceWorker();
