// The delivery wheel screen. The odds and the log live in wheel.js; this file
// only draws them. The result of a spin is picked BEFORE the animation starts.

import {
  COOK,
  MAX_CUISINE_LENGTH,
  WHEEL,
  addCuisine,
  buildSlices,
  landingRotation,
  recentCount,
  removeCuisine,
  renameCuisine,
  setRecentCount,
  sortedDeliveries,
  spin,
  wheelStats,
} from './wheel.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 150;
const MIN_LABEL_DEGREES = 13; // thinner slices get no text
const MAX_LABEL_CHARS = 13;
const MAX_LISTED = 60;

function svg(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value != null) el.setAttribute(key, value);
  }
  el.append(...children.filter((c) => c != null && c !== false));
  return el;
}

/** Point on the wheel at `fraction` of a turn clockwise from the top. */
function point(fraction, radius) {
  const angle = fraction * 2 * Math.PI;
  return [CENTER + radius * Math.sin(angle), CENTER - radius * Math.cos(angle)];
}

function slicePath(slice) {
  const [x0, y0] = point(slice.start, RADIUS);
  const [x1, y1] = point(slice.end, RADIUS);
  const large = slice.end - slice.start > 0.5 ? 1 : 0;
  return `M${CENTER},${CENTER} L${x0.toFixed(2)},${y0.toFixed(2)} A${RADIUS},${RADIUS} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`;
}

// Hues from cyan round to yellow, skipping the greens so no cuisine looks like the "cook" slice.
const cuisineColor = (i, n) => `hsl(${Math.round(195 + (i * 215) / Math.max(n, 1)) % 360} 82% 64%)`;

/**
 * ctx = {h, button, t, lang, getState, ui, commit, render, reducedMotion}
 * `ui.wheel` holds this screen's state while it is open (null when closed).
 */
export function createWheelView(ctx) {
  const { h, button, t, ui } = ctx;
  const state = () => ctx.getState();

  function open() {
    ui.wheel = { rotation: 0, slices: null, spinning: false, result: null, ordered: null, error: null, timer: null, show: {} };
    ctx.render();
    window.scrollTo(0, 0);
  }

  function close() {
    if (ui.wheel) clearTimeout(ui.wheel.timer);
    ui.wheel = null;
  }

  function doSpin() {
    const w = ui.wheel;
    if (w.spinning) return;
    const s = state();
    const slices = buildSlices(s.cuisines, s.deliveries, Date.now());
    const index = spin(slices); // the result is decided here; the rest is for show
    const target = landingRotation(slices, index, { from: w.rotation });
    Object.assign(w, { slices, spinning: true, result: null, ordered: null, error: null });
    ctx.render();

    const finish = () => {
      if (ui.wheel !== w) return; // the screen was closed meanwhile
      Object.assign(w, { rotation: target % 360, spinning: false, result: index });
      ctx.render();
    };
    if (ctx.reducedMotion()) return finish();

    const rotor = document.querySelector('.wheel-rotor');
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!rotor.isConnected) return;
        rotor.style.transition = `transform ${WHEEL.spinMs}ms cubic-bezier(0.12, 0.72, 0.14, 1)`;
        rotor.style.transform = `rotate(${target}deg)`;
      }),
    );
    w.timer = setTimeout(finish, WHEEL.spinMs + 120);
  }

  function order(cuisine) {
    const w = ui.wheel;
    state().deliveries.push({ time: Date.now(), cuisine });
    Object.assign(w, { slices: null, result: null, ordered: cuisine });
    ctx.commit();
  }

  // ---- Drawing ----

  function drawWheel(slices, rotation) {
    const cuisines = slices.length - 1;
    const rotor = svg('g', { class: 'wheel-rotor', style: `transform: rotate(${rotation}deg)` });
    slices.forEach((slice, i) => {
      const isCook = slice.kind === COOK;
      rotor.append(svg('path', { d: slicePath(slice), class: isCook ? 'wheel-slice cook' : 'wheel-slice', fill: isCook ? null : cuisineColor(i - 1, cuisines) }));

      const degrees = (slice.end - slice.start) * 360;
      if (degrees < MIN_LABEL_DEGREES) return;
      const mid = ((slice.start + slice.end) / 2) * 360;
      let text = isCook ? `🍳 ${t('wheelCookShort')}` : slice.name;
      if (text.length > MAX_LABEL_CHARS + 1 && !isCook) text = `${text.slice(0, MAX_LABEL_CHARS)}…`;
      // Written along the radius, turned so it is never upside down.
      const leftHalf = mid > 180;
      const label = svg(
        'text',
        {
          class: 'wheel-label',
          x: CENTER,
          y: CENTER,
          dx: leftHalf ? -(RADIUS - 12) : RADIUS - 12,
          'text-anchor': leftHalf ? 'start' : 'end',
          'dominant-baseline': 'central',
          transform: `rotate(${leftHalf ? mid + 90 : mid - 90} ${CENTER} ${CENTER})`,
        },
        text,
      );
      rotor.append(label);
    });

    return svg(
      'svg',
      { class: 'wheel', viewBox: `0 0 ${SIZE} ${SIZE}`, role: 'img', 'aria-label': t('wheelTitle') },
      rotor,
      svg('circle', { class: 'wheel-hub', cx: CENTER, cy: CENTER, r: 16 }),
      svg('path', { class: 'wheel-pointer', d: `M${CENTER - 13},2 L${CENTER + 13},2 L${CENTER},30 Z` }),
    );
  }

  function explanation(stats) {
    const why = [];
    if (stats.daysSince === null) why.push(t('wheelWhyNever'));
    else {
      why.push(stats.count === 1 ? t('wheelWhyCountOne') : t('wheelWhyCount', { n: stats.count }));
      const days = Math.floor(stats.daysSince);
      why.push(days === 0 ? t('wheelWhyToday') : days === 1 ? t('wheelWhyYesterday') : t('wheelWhyDays', { n: days }));
    }
    why.push(stats.weekend ? t('wheelWhyWeekend') : t('wheelWhyWeekday'));
    const text = why.join(' · ');
    return [
      h('p', { class: 'wheel-size' }, t('wheelCookSize', { percent: Math.round(stats.cook * 100) })),
      h('p', { class: 'help' }, `${text.charAt(0).toUpperCase()}${text.slice(1)}.`),
    ];
  }

  function resultPanel(w) {
    if (w.ordered) {
      return h('section', { class: 'wheel-result', role: 'status' }, h('p', { class: 'wheel-result-text' }, `🛵 ${t('wheelOrdered', { name: w.ordered })}`));
    }
    if (w.result === null) return null;
    const slice = w.slices[w.result];
    const again = button(t('wheelSpinAgain'), doSpin);
    if (slice.kind === COOK) {
      return h(
        'section',
        { class: 'wheel-result', role: 'status' },
        h('p', { class: 'wheel-result-text' }, `🍳 ${t('wheelLandedCook')}`),
        h(
          'div',
          { class: 'row' },
          again,
          button(
            t('wheelSeeCooking'),
            () => {
              close();
              ctx.render();
              window.scrollTo(0, 0);
            },
            'primary',
          ),
        ),
      );
    }
    return h(
      'section',
      { class: 'wheel-result', role: 'status' },
      h('p', { class: 'wheel-result-text' }, `🎉 ${t('wheelLandedCuisine', { name: slice.name })}`),
      h('div', { class: 'row' }, again, button(t('wheelOrder'), () => order(slice.name), 'primary')),
    );
  }

  // ---- Cuisines and delivery history ----

  /** A <details> whose open state survives re-renders. */
  function foldable(key, title, ...children) {
    const w = ui.wheel;
    const el = h('details', { class: 'fold', open: Boolean(w.show[key]) }, h('summary', null, title), h('div', { class: 'fold-body' }, children));
    el.addEventListener('toggle', () => {
      w.show[key] = el.open;
    });
    return el;
  }

  function fail(key) {
    ui.wheel.error = t(key.key ?? key, key.vars);
    ctx.render();
  }

  function applyCuisines(next, renamed) {
    if (!next) return fail('cuisineTaken');
    const s = state();
    if (renamed) {
      for (const d of s.deliveries) if (d.cuisine === renamed.from) d.cuisine = renamed.to;
    }
    s.cuisines = next;
    Object.assign(ui.wheel, { slices: null, result: null, ordered: null, error: null });
    ctx.commit();
  }

  function cuisinesSection() {
    const s = state();
    const addInput = h('input', { type: 'text', maxLength: MAX_CUISINE_LENGTH, placeholder: t('cuisineAddPlaceholder'), 'aria-label': t('cuisineAddPlaceholder'), autocomplete: 'off' });
    return foldable(
      'cuisines',
      `${t('cuisinesTitle')} (${s.cuisines.length})`,
      h(
        'ul',
        { class: 'list' },
        s.cuisines.map((name, i) => {
          const input = h('input', { type: 'text', value: name, maxLength: MAX_CUISINE_LENGTH, 'aria-label': t('cuisineName'), autocomplete: 'off' });
          input.addEventListener('change', () => {
            const next = renameCuisine(s.cuisines, i, input.value);
            applyCuisines(next, next && { from: name, to: next[i] });
          });
          return h(
            'li',
            { class: 'edit-row' },
            input,
            button('✕', () => (s.cuisines.length <= 1 ? fail('cuisineLast') : applyCuisines(removeCuisine(s.cuisines, i))), 'small', {
              'aria-label': t('cuisineRemove', { name }),
              disabled: s.cuisines.length <= 1,
            }),
          );
        }),
      ),
      h(
        'form',
        {
          class: 'add-row',
          onsubmit: (e) => {
            e.preventDefault();
            applyCuisines(addCuisine(s.cuisines, addInput.value));
          },
        },
        addInput,
        h('button', { type: 'submit', class: 'btn' }, t('add')),
      ),
    );
  }

  const isoDay = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const showDay = (time) => new Date(time).toLocaleDateString(ctx.lang, { weekday: 'short', day: 'numeric', month: 'short' });

  function changeDeliveries(next) {
    state().deliveries = next;
    Object.assign(ui.wheel, { slices: null, result: null, ordered: null, error: null });
    ctx.commit();
  }

  function historySection() {
    const s = state();
    const now = Date.now();
    const count = recentCount(s.deliveries, now);
    const logged = recentCount(s.deliveries.filter((d) => !d.manual), now);

    const countInput = h('input', { id: 'w-count', type: 'number', min: '0', max: '99', step: '1', inputMode: 'numeric', value: String(count) });
    const setCount = (e) => {
      e.preventDefault();
      const n = Number(countInput.value);
      if (countInput.value.trim() === '' || !Number.isFinite(n) || n < 0) return;
      if (n < logged) return fail({ key: 'deliveriesCountTooLow', vars: { n: logged } });
      changeDeliveries(setRecentCount(s.deliveries, n, Date.now()));
    };

    const dateInput = h('input', { id: 'w-date', type: 'date', value: isoDay(new Date()), max: isoDay(new Date()), required: true });
    const cuisineSelect = h(
      'select',
      { id: 'w-cuisine' },
      h('option', { value: '' }, t('deliveriesNoCuisine')),
      s.cuisines.map((name) => h('option', { value: name }, name)),
    );
    const addPast = (e) => {
      e.preventDefault();
      const [y, m, d] = dateInput.value.split('-').map(Number);
      if (!y || !m || !d) return;
      // Noon on that day, local time; never in the future.
      const time = Math.min(new Date(y, m - 1, d, 12).getTime(), Date.now());
      changeDeliveries([...s.deliveries, { time, cuisine: cuisineSelect.value || null }]);
    };

    const all = sortedDeliveries(s.deliveries);
    const listed = all.slice(0, MAX_LISTED);

    return foldable(
      'history',
      t('deliveriesSummary', { n: count }),
      h('p', { class: 'help' }, t('deliveriesHelp')),
      h(
        'form',
        { class: 'field', onsubmit: setCount },
        h('label', { for: 'w-count' }, t('deliveriesCountLabel')),
        h('div', { class: 'add-row' }, countInput, h('button', { type: 'submit', class: 'btn' }, t('deliveriesCountSet'))),
      ),
      h(
        'form',
        { class: 'field', onsubmit: addPast },
        h('span', { class: 'field-label' }, t('deliveriesAddTitle')),
        h(
          'div',
          { class: 'past-row' },
          h('label', { class: 'sr-only', for: 'w-date' }, t('deliveriesDate')),
          dateInput,
          h('label', { class: 'sr-only', for: 'w-cuisine' }, t('deliveriesCuisine')),
          cuisineSelect,
          h('button', { type: 'submit', class: 'btn' }, t('add')),
        ),
      ),
      all.length === 0
        ? h('p', { class: 'muted' }, t('deliveriesEmpty'))
        : h(
            'ul',
            { class: 'list' },
            listed.map((d) =>
              h(
                'li',
                { class: 'shop-row' },
                h('span', null, `${showDay(d.time)} · ${d.cuisine ?? t('deliveriesNoCuisine')}`, d.manual && h('span', { class: 'badge inline' }, t('deliveriesManual'))),
                button('✕', () => changeDeliveries(s.deliveries.filter((x) => x !== d)), 'small', {
                  'aria-label': t('deliveriesDelete', { date: showDay(d.time) }),
                }),
              ),
            ),
          ),
      all.length > listed.length && h('p', { class: 'muted' }, t('deliveriesMore', { n: all.length - listed.length })),
    );
  }

  // ---- The screen ----

  function view() {
    const w = ui.wheel;
    const s = state();
    const now = Date.now();
    // While spinning or showing a result, keep the wheel that was spun.
    const slices = w.slices ?? buildSlices(s.cuisines, s.deliveries, now);
    const stats = wheelStats(s.deliveries, now);

    return [
      h(
        'header',
        { class: 'top' },
        button(
          `‹ ${t('back')}`,
          () => {
            close();
            ctx.render();
          },
          'ghost',
        ),
        h('h1', null, t('wheelTitle')),
      ),
      h('div', { class: 'wheel-wrap' }, drawWheel(slices, w.rotation)),
      resultPanel(w) ?? button(w.spinning ? t('wheelSpinning') : `🎡 ${t('wheelSpin')}`, doSpin, 'primary wide spin', { disabled: w.spinning }),
      w.ordered && button(`🎡 ${t('wheelSpinAgain')}`, doSpin, 'wide'),
      explanation(stats),
      w.error && h('p', { class: 'error', role: 'alert' }, w.error),
      cuisinesSection(),
      historySection(),
    ];
  }

  return { open, close, view };
}
