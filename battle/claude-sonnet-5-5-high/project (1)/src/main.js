import './style.css';
import { complete } from './engine/complete.js';
import { Registry, defaultUnitsJson } from './engine/units.js';

/* --------------------------------- storage --------------------------------- */

const SETTINGS_KEY = 'smart-editor.settings.v1';
const TEXT_KEY = 'smart-editor.text.v1';

const DEFAULTS = {
  system: 'metric',
  angle: 'rad',
  theme: 'light',
  fontSize: 16,
  inline: true,
  debug: false,
  unitsJson: null, // null = built-in defaults
  devOpen: false,
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

const settings = { ...DEFAULTS, ...load(SETTINGS_KEY, {}) };

/* ---------------------------------- units ---------------------------------- */

function buildRegistry(jsonText) {
  const obj = JSON.parse(jsonText);
  return new Registry(Array.isArray(obj) ? obj : obj.units);
}

let registry;
try {
  registry = settings.unitsJson ? buildRegistry(settings.unitsJson) : new Registry();
} catch {
  settings.unitsJson = null;
  registry = new Registry();
}

/* ----------------------------------- DOM ----------------------------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const scroller = $('#scroller');
const editor = $('#editor');
const mirror = $('#mirror');
const chipsEl = $('#chips');
const unitSelect = $('#unit-select');
const angleSeg = $('#angle-seg');
const overlay = $('#overlay');
const panel = $('#panel');
const unitsJson = $('#units-json');
const unitsError = $('#units-error');

const log = (name, data) => {
  if (settings.debug) console.log(`[smart-editor] ${name}`, data);
};

/* --------------------------------- completion -------------------------------- */

const state = { cands: [], sel: 0, unit: null, override: null, key: null, unitSig: '' };

function recompute(force = false) {
  const text = editor.value;
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const key = `${start}:${end}:${text}`;
  if (!force && key === state.key) return;
  if (key !== state.key) state.override = null;
  state.key = key;
  const res = complete(text, start, {
    registry,
    system: settings.system,
    angle: settings.angle,
    unitOverride: state.override,
    selStart: start,
    selEnd: end,
    log: settings.debug ? log : null,
  });
  state.cands = res.candidates;
  state.unit = res.unit;
  state.sel = 0;
  render();
}

function accept(i) {
  const c = state.cands[i];
  if (!c) return;
  log('accept', c);
  editor.focus();
  editor.setSelectionRange(c.start, c.end);
  let done = false;
  try { done = document.execCommand('insertText', false, c.text); } catch { done = false; }
  if (!done) {
    editor.setRangeText(c.text, c.start, c.end, 'end');
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/* ---------------------------------- rendering --------------------------------- */

let caretEl = document.createElement('span');

function ghostLabel(s) {
  return s.length > 44 ? s.slice(0, 40) + '...' : s;
}

function renderMirror() {
  const text = editor.value;
  const pos = editor.selectionStart;
  const cand = state.cands[state.sel];
  const showGhost = settings.inline && cand && editor.selectionStart === editor.selectionEnd;
  caretEl = document.createElement('span');
  caretEl.className = 'caret';
  const frag = document.createDocumentFragment();
  if (showGhost) {
    const replacing = cand.end > cand.start;
    if (replacing) caretEl.classList.add('fake');
    const ghost = document.createElement('span');
    ghost.className = 'ghost';
    ghost.textContent = ghostLabel(cand.text);
    frag.append(text.slice(0, cand.start), caretEl, ghost, text.slice(cand.end));
    editor.classList.toggle('fake-caret', replacing);
  } else {
    frag.append(text.slice(0, pos), caretEl, text.slice(pos));
    editor.classList.remove('fake-caret');
  }
  frag.append('\u200b');
  mirror.replaceChildren(frag);
}

function renderChips() {
  const nodes = state.cands.map((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (i === state.sel ? ' sel' : '');
    b.setAttribute('role', 'option');
    b.setAttribute('aria-selected', String(i === state.sel));
    const label = document.createElement('span');
    label.textContent = c.chip;
    b.append(label);
    if (c.tag) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = c.tag;
      b.append(tag);
    }
    if (i === state.sel) {
      const k = document.createElement('kbd');
      k.textContent = 'Tab';
      b.append(k);
    }
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => accept(i));
    return b;
  });
  chipsEl.replaceChildren(...nodes);
  const el = chipsEl.children[state.sel];
  if (el) {
    const l = el.offsetLeft;
    const r = l + el.offsetWidth;
    if (l < chipsEl.scrollLeft) chipsEl.scrollLeft = Math.max(0, l - 8);
    else if (r > chipsEl.scrollLeft + chipsEl.clientWidth) chipsEl.scrollLeft = r - chipsEl.clientWidth + 8;
  }
}

function renderUnit() {
  const u = state.unit;
  if (!u) {
    unitSelect.hidden = true;
    state.unitSig = '';
    return;
  }
  const sig = JSON.stringify(u.options.map((o) => o.value)) + '|' + u.selected;
  if (sig !== state.unitSig) {
    state.unitSig = sig;
    const groups = new Map();
    const frag = document.createDocumentFragment();
    for (const o of u.options) {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.text;
      if (o.group) {
        if (!groups.has(o.group)) {
          const g = document.createElement('optgroup');
          g.label = o.group;
          groups.set(o.group, g);
          frag.append(g);
        }
        groups.get(o.group).append(opt);
      } else {
        frag.append(opt);
      }
    }
    unitSelect.replaceChildren(frag);
    unitSelect.value = u.selected;
  }
  unitSelect.hidden = false;
}

function renderAngle() {
  $$('button', angleSeg).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === settings.angle)));
}

function ensureCaretVisible() {
  const r = caretEl.getBoundingClientRect();
  const s = scroller.getBoundingClientRect();
  const pad = 28;
  if (r.bottom > s.bottom - pad) scroller.scrollTop += r.bottom - s.bottom + pad;
  else if (r.top < s.top + pad) scroller.scrollTop -= s.top + pad - r.top;
}

function render() {
  renderMirror();
  renderChips();
  renderUnit();
  renderAngle();
}

/* ------------------------------- editor events ------------------------------- */

let saveTimer = 0;
editor.addEventListener('input', () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save(TEXT_KEY, editor.value), 250);
  recompute();
  ensureCaretVisible();
});

editor.addEventListener('keydown', (e) => {
  if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const n = state.cands.length;
  if (!n) return;
  if (e.key === 'Tab') {
    e.preventDefault();
    accept(state.sel);
  } else if (e.key === 'ArrowRight' && n > 1 && state.sel < n - 1) {
    e.preventDefault();
    state.sel++;
    render();
  } else if (e.key === 'ArrowLeft' && n > 1 && state.sel > 0) {
    e.preventDefault();
    state.sel--;
    render();
  }
});

['keyup', 'mouseup', 'focus', 'click'].forEach((ev) => editor.addEventListener(ev, () => recompute()));
document.addEventListener('selectionchange', () => {
  if (document.activeElement === editor) recompute();
});

scroller.addEventListener('mousedown', (e) => {
  if (e.target === scroller) {
    e.preventDefault();
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
  }
});

unitSelect.addEventListener('change', () => {
  state.override = unitSelect.value;
  state.unitSig = '';
  recompute(true);
  editor.focus();
});

angleSeg.addEventListener('mousedown', (e) => e.preventDefault());
angleSeg.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  setSetting('angle', b.dataset.v);
  recompute(true);
});

/* --------------------------------- settings --------------------------------- */

function applySettings() {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.style.setProperty('--fs', `${settings.fontSize}px`);
}

function setSetting(key, value) {
  settings[key] = value;
  save(SETTINGS_KEY, settings);
  applySettings();
  syncPanel();
  renderAngle();
  log('setting', { [key]: value });
}

function syncPanel() {
  $$('.seg[data-setting]', panel).forEach((seg) => {
    const key = seg.dataset.setting;
    $$('button', seg).forEach((b) => b.setAttribute('aria-pressed', String(String(settings[key]) === b.dataset.v)));
  });
  $$('.switch', panel).forEach((s) => s.setAttribute('aria-checked', String(!!settings[s.dataset.toggle])));
  $('#font-size').value = settings.fontSize;
  $('#font-size-out').textContent = settings.fontSize;
  $('#dev-toggle').setAttribute('aria-expanded', String(settings.devOpen));
  $('#dev').hidden = !settings.devOpen;
}

const currentUnitsText = () => settings.unitsJson || defaultUnitsJson();

function showUnitsError(message) {
  unitsError.replaceChildren(document.createTextNode(message));
  const discard = document.createElement('button');
  discard.type = 'button';
  discard.className = 'link';
  discard.textContent = 'Discard edits';
  discard.addEventListener('click', () => {
    unitsJson.value = currentUnitsText();
    unitsError.hidden = true;
  });
  unitsError.append(discard);
  unitsError.hidden = false;
}

function openSettings() {
  unitsJson.value = currentUnitsText();
  unitsError.hidden = true;
  syncPanel();
  overlay.hidden = false;
}

/** Saves the units JSON; returns false (and stays open) if it is invalid. */
function commitUnits() {
  const text = unitsJson.value.trim();
  if (text === currentUnitsText().trim()) return true;
  try {
    const reg = buildRegistry(text);
    registry = reg;
    settings.unitsJson = text === defaultUnitsJson().trim() ? null : text;
    save(SETTINGS_KEY, settings);
    log('units updated', { count: reg.defs.length });
    return true;
  } catch (err) {
    showUnitsError(`Units JSON can't be saved: ${err.message}`);
    return false;
  }
}

function closeSettings() {
  if (overlay.hidden) return;
  if (!commitUnits()) return;
  save(SETTINGS_KEY, settings);
  overlay.hidden = true;
  editor.focus();
  recompute(true);
}

$('#settings-btn').addEventListener('click', openSettings);
overlay.addEventListener('mousedown', (e) => {
  if (e.target === overlay) closeSettings();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) {
    e.preventDefault();
    closeSettings();
  }
});

panel.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const seg = btn.closest('.seg[data-setting]');
  if (seg) {
    setSetting(seg.dataset.setting, btn.dataset.v);
    return;
  }
  if (btn.dataset.toggle) {
    setSetting(btn.dataset.toggle, !settings[btn.dataset.toggle]);
    return;
  }
  if (btn.id === 'dev-toggle') {
    setSetting('devOpen', !settings.devOpen);
    return;
  }
  if (btn.id === 'units-reset') {
    unitsJson.value = defaultUnitsJson();
    unitsError.hidden = true;
  }
});

$('#font-size').addEventListener('input', (e) => setSetting('fontSize', Number(e.target.value)));

/* ----------------------------------- boot ----------------------------------- */

applySettings();
editor.value = load(TEXT_KEY, '') || '';
if (typeof editor.value !== 'string') editor.value = '';
editor.focus();
recompute(true);
window.addEventListener('beforeunload', () => save(TEXT_KEY, editor.value));
window.addEventListener('resize', () => render());
