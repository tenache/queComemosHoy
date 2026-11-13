// The review page: one dish at a time, a tier per dish, then the sides for a
// main. Answers are saved on the phone after every tap, so it can be left and
// picked up again. The logic lives in review.js; this file only draws it.
// Not part of the app: it isn't in sw.js's SHELL and the app doesn't link to it.

import { STARTER_DISHES } from '../js/dishes.js';
import {
  NEVER,
  PAUSE_EVERY,
  TIERS,
  cleanReview,
  emptyReview,
  isDone,
  needsSides,
  nextDish,
  placedIn,
  previousDish,
  progress,
  reviewQueue,
  setNote,
  setSides,
  setTier,
  skip,
  summaryText,
} from './review.js';

const STORAGE_KEY = 'qch-revision:v1';
const EXAMPLES = 3; // dishes shown on each tier button

const byId = new Map(STARTER_DISHES.map((d) => [d.id, d]));
const queue = reviewQueue(STARTER_DISHES);
const sideOptions = STARTER_DISHES.filter((d) => d.role === 'side').map((d) => d.id);

const ui = { screen: 'intro', current: null, step: 'tier', picked: null, other: '', noteOpen: false, copied: false };
let review = load();

function load() {
  try {
    return cleanReview(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'), queue);
  } catch {
    return emptyReview();
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(review));
  } catch {
    // Private mode or full storage: the review still works, it just won't survive a reload.
  }
}

// ---- Tiny DOM helper (same as the app's) ----------------------------------

function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key.includes('-') || key === 'role') el.setAttribute(key, value);
    else el[key] = value;
  }
  el.append(...children.flat(Infinity).filter((c) => c != null && c !== false));
  return el;
}

const button = (label, onclick, cls = '', props = {}) =>
  h('button', { type: 'button', class: `btn ${cls}`.trim(), onclick, ...props }, label);

// ---- Moving through the dishes --------------------------------------------

function show(id) {
  const answer = review.answers[id];
  ui.screen = 'dish';
  ui.current = id;
  ui.step = 'tier';
  ui.noteOpen = Boolean(answer?.note);
  render();
}

function goNext({ includeSkipped = false } = {}) {
  const id = nextDish(queue, review, byId, { includeSkipped });
  if (!id) {
    ui.screen = 'end';
    render();
    return;
  }
  // Before the first side, say that the sides start now.
  const firstSide = byId.get(id).role === 'side' && !queue.some((x) => byId.get(x).role === 'side' && review.answers[x]);
  if (firstSide && ui.screen !== 'sidesIntro') {
    ui.screen = 'sidesIntro';
    ui.current = id;
    render();
    return;
  }
  show(id);
}

function finishDish() {
  save();
  const { done, total } = progress(queue, review, byId);
  if (done < total && done % PAUSE_EVERY === 0 && ui.screen === 'dish') {
    ui.screen = 'pause';
    render();
    return;
  }
  goNext();
}

function chooseTier(level) {
  const dish = byId.get(ui.current);
  setTier(review, dish.id, level);
  save();
  if (needsSides(dish, review.answers[dish.id])) {
    const answer = review.answers[dish.id];
    ui.step = 'sides';
    ui.picked = answer.sides ? new Set(answer.sides) : dish.sides.length ? new Set(dish.sides) : null;
    ui.other = answer.other ?? '';
    render();
  } else {
    finishDish();
  }
}

function back() {
  if (ui.step === 'sides') {
    ui.step = 'tier';
    render();
    return;
  }
  const prev = previousDish(queue, ui.current);
  if (prev) show(prev);
}

// ---- Screens --------------------------------------------------------------

function progressBar() {
  const { done, total } = progress(queue, review, byId);
  return h(
    'div',
    { class: 'rv-progress' },
    h('div', { class: 'rv-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(done) },
      h('div', { class: 'rv-bar-fill', style: `width: ${(100 * done) / total}%` })),
    h('span', { class: 'muted' }, `${done} de ${total}`),
    button('Ver todo', () => {
      ui.screen = 'end';
      render();
    }, 'ghost small'),
  );
}

function viewIntro() {
  const { done, total } = progress(queue, review, byId);
  return [
    h('h1', { class: 'rv-title' }, 'Revisemos las comidas'),
    h('p', {}, `Son ${total} comidas. Para cada una, elegí cuánto trabajo te da hacerla.`),
    h('p', { class: 'help' }, 'No cuánto tarda en estar lista: cuánto rato estás cocinando de verdad. Un pollo al horno tarda una hora, pero casi no lo tocás.'),
    h('p', { class: 'help' }, 'Después, para los platos principales: con qué los acompañás.'),
    h('p', { class: 'help' }, 'Podés parar cuando quieras: se guarda solo. Volvés a este mismo link y seguís donde quedaste.'),
    button(done === 0 ? 'Empezar' : `Seguir (vas ${done} de ${total})`, () => goNext(), 'primary wide'),
  ];
}

function viewTier(dish) {
  const answer = review.answers[dish.id];
  return [
    h('div', { class: 'rv-dish' }, h('span', { class: 'rv-emoji', 'aria-hidden': 'true' }, dish.emoji), h('h1', {}, dish.name)),
    h('p', { class: 'rv-question' }, dish.role === 'side' ? '¿Cuánto trabajo te da este acompañamiento?' : '¿Cuánto trabajo te da?'),
    h(
      'div',
      { class: 'rv-tiers' },
      TIERS.map((tier) => {
        const examples = placedIn(queue, review, byId, tier.level, dish.id).slice(-EXAMPLES);
        return h(
          'button',
          { type: 'button', class: 'rv-tier', 'aria-pressed': String(answer?.tier === tier.level), onclick: () => chooseTier(tier.level) },
          h('strong', {}, tier.name),
          h('span', { class: 'rv-hint' }, tier.hint),
          examples.length > 0 && h('span', { class: 'rv-examples' }, `Como: ${examples.join(', ')}`),
        );
      }),
    ),
    h(
      'div',
      { class: 'rv-row' },
      button('No lo hacemos', () => {
        setTier(review, dish.id, NEVER);
        finishDish();
      }, `small${answer?.tier === NEVER ? ' rv-chosen' : ''}`),
      button('Saltear por ahora', () => {
        skip(review, dish.id);
        save();
        goNext();
      }, 'small'),
    ),
    noteField(dish),
    h('div', { class: 'rv-row' }, previousDish(queue, dish.id) && button('← Volver', back, 'ghost small')),
  ];
}

function noteField(dish) {
  if (!ui.noteOpen) {
    return button('💬 Agregar un comentario', () => {
      ui.noteOpen = true;
      render();
      document.getElementById('rv-note')?.focus();
    }, 'ghost small');
  }
  return h('textarea', {
    id: 'rv-note',
    class: 'rv-note',
    rows: 2,
    placeholder: 'Por ejemplo: depende de si hago la salsa',
    value: review.answers[dish.id]?.note ?? '',
    oninput: (e) => {
      setNote(review, dish.id, e.target.value);
      save();
    },
  });
}

function viewSides(dish) {
  const toggle = (id) => {
    ui.picked ??= new Set();
    if (ui.picked.has(id)) ui.picked.delete(id);
    else ui.picked.add(id);
    render();
  };
  const options = [...sideOptions, ...dish.sides.filter((id) => !sideOptions.includes(id))];
  const nothing = ui.picked !== null && ui.picked.size === 0;
  return [
    h('div', { class: 'rv-dish' }, h('span', { class: 'rv-emoji', 'aria-hidden': 'true' }, dish.emoji), h('h1', {}, dish.name)),
    h('p', { class: 'rv-question' }, '¿Con qué lo acompañás?'),
    h('p', { class: 'help' }, dish.sides.length > 0
      ? 'Marcados, los que la app sugiere ahora. Tocá para sacar o agregar.'
      : 'Ahora la app lo sugiere solo. ¿Le ponés algo al lado?'),
    h(
      'div',
      { class: 'chips' },
      options.map((id) => {
        const side = byId.get(id);
        return h('button', { type: 'button', class: 'chip', 'aria-pressed': String(ui.picked?.has(id) ?? false), onclick: () => toggle(id) }, `${side.emoji} ${side.name}`);
      }),
      h('button', { type: 'button', class: 'chip', 'aria-pressed': String(nothing), onclick: () => {
        ui.picked = new Set();
        render();
      } }, 'Nada, va solo'),
    ),
    h('label', { class: 'rv-other' }, h('span', { class: 'help' }, '¿Otro? Escribilo'),
      h('input', { type: 'text', value: ui.other, maxLength: 80, oninput: (e) => (ui.other = e.target.value) })),
    button('Listo, siguiente', () => {
      setSides(review, dish.id, [...(ui.picked ?? [])], ui.other);
      finishDish();
    }, 'primary wide', { disabled: ui.picked === null && !ui.other.trim() }),
    h('div', { class: 'rv-row' }, button('← Volver', back, 'ghost small')),
  ];
}

function viewPause() {
  const { done, total } = progress(queue, review, byId);
  return [
    h('h1', { class: 'rv-title' }, `¡Van ${done}! 🎉`),
    h('p', {}, `Quedan ${total - done}. ¿Seguimos o lo dejamos para otro rato?`),
    button('Seguimos', () => goNext(), 'primary wide'),
    button('Lo dejo para otro rato', () => {
      ui.screen = 'later';
      render();
    }, 'wide'),
  ];
}

function viewLater() {
  return [
    h('h1', { class: 'rv-title' }, '¡Gracias!'),
    h('p', {}, 'Quedó todo guardado. Cuando quieras, abrí este mismo link y seguís donde quedaste.'),
    button('Ah, no, sigo', () => goNext(), 'wide'),
  ];
}

function viewSidesIntro() {
  return [
    h('h1', { class: 'rv-title' }, 'Ahora los acompañamientos'),
    h('p', {}, 'Lo mismo: cuánto trabajo te da hacer cada uno.'),
    button('Dale', () => show(ui.current), 'primary wide'),
  ];
}

function viewEnd() {
  const { done, total } = progress(queue, review, byId);
  const pending = queue.filter((id) => !isDone(byId.get(id), review.answers[id]));
  const text = summaryText(queue, review, byId);
  const group = (title, ids) =>
    ids.length > 0 &&
    h('section', { class: 'rv-group' },
      h('p', { class: 'label' }, title),
      h('div', { class: 'chips' }, ids.map((id) => h('button', { type: 'button', class: 'chip small', onclick: () => show(id) }, byId.get(id).name))));
  const inTier = (tier) => queue.filter((id) => review.answers[id]?.tier === tier && isDone(byId.get(id), review.answers[id]));

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      ui.copied = true;
      render();
    } catch {
      // Cancelled, or no clipboard: the text is below to copy by hand.
    }
  };

  return [
    h('h1', { class: 'rv-title' }, pending.length === 0 ? '¡Listo! Gracias 🙌' : 'Cómo va'),
    h('p', { class: 'help' }, `${done} de ${total}. Tocá una comida para cambiarla.`),
    pending.length > 0 && button(`Seguir con las que faltan (${pending.length})`, () => goNext({ includeSkipped: true }), 'primary wide'),
    TIERS.map((tier) => group(tier.name, inTier(tier.level))),
    group('No lo hacemos', inTier(NEVER)),
    group('Sin contestar', pending),
    h('p', { class: 'help' }, 'Cuando termines, mandá las respuestas:'),
    button(ui.copied ? 'Copiado ✓' : 'Compartir respuestas', share, pending.length === 0 ? 'primary wide' : 'wide'),
    h('details', {}, h('summary', { class: 'help' }, 'Ver el texto'), h('textarea', { class: 'rv-note', rows: 10, readOnly: true, value: text })),
    h('div', { class: 'rv-row' },
      done < total && button('Volver', () => goNext(), 'ghost small'),
      button('Empezar de nuevo', () => {
        if (!confirm('¿Borrar todas las respuestas y empezar de nuevo?')) return;
        review = emptyReview();
        save();
        ui.screen = 'intro';
        render();
      }, 'ghost small')),
  ];
}

function render() {
  const view = document.getElementById('view');
  const dish = byId.get(ui.current);
  const body = {
    intro: viewIntro,
    dish: () => (ui.step === 'sides' ? viewSides(dish) : viewTier(dish)),
    pause: viewPause,
    later: viewLater,
    sidesIntro: viewSidesIntro,
    end: viewEnd,
  }[ui.screen]();
  view.replaceChildren(...[ui.screen === 'dish' && progressBar(), body].flat(Infinity).filter(Boolean));
  if (ui.screen !== 'end') ui.copied = false;
  // Back to the top on a new screen or dish, not on every tap (chips, comment).
  const at = `${ui.screen}/${ui.current}/${ui.step}`;
  if (at !== lastAt) window.scrollTo(0, 0);
  lastAt = at;
}

let lastAt = null;

render();
