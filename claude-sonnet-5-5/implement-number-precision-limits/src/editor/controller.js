// UI controller: wires the textarea, the ghost-text mirror and the suggestion bar together.
import { suggestFor } from './suggest.js';
import { setAnglePref } from './prefs.js';
import { analyzeLine, findExpression } from './analyze.js';
import { formatValue } from './format.js';
import { parseText, show } from './parser.js';
import { resolveUnitWord } from './units.js';
import { D } from './numeric.js';

const STORAGE_KEY = 'calc-notes-v1';

export function createEditor({ ta, mirror, mi, bar, chipsEl }) {
  const ac = new AbortController();
  const on = (target, type, fn) => target.addEventListener(type, fn, { signal: ac.signal });

  const state = { chips: [], hi: 0, sig: '', dismissed: false, composing: false };

  /* ---- rendering ---- */
  function ghostText() {
    const c = state.chips[state.hi];
    return (c && c.inlineEligible && !state.dismissed) ? c.insertText : '';
  }
  function mid(s, max) {
    if (s.length <= max) return s;
    const a = Math.ceil((max - 1) / 2), b = Math.floor((max - 1) / 2);
    return s.slice(0, a) + '\u2026' + s.slice(s.length - b);
  }
  function renderMirror() {
    mirror.style.width = ta.clientWidth + 'px';
    const g = ghostText();
    mi.textContent = '';
    if (g) {
      mi.appendChild(document.createTextNode(ta.value.slice(0, ta.selectionStart)));
      const sp = document.createElement('span');
      sp.className = 'ghost'; sp.textContent = g;
      mi.appendChild(sp);
    }
    mi.style.transform = 'translateY(' + (-ta.scrollTop) + 'px)';
  }
  function renderBar() {
    chipsEl.textContent = '';
    bar.classList.toggle('has', state.chips.length > 0);
    state.chips.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'chip' + (i === state.hi ? ' active' : '');
      el.dataset.i = String(i);
      if (i < 9) { const n = document.createElement('span'); n.className = 'num'; n.textContent = String(i + 1); el.appendChild(n); }
      const d = document.createElement('span'); d.className = 'dim'; d.textContent = mid(c.dim, 44); el.appendChild(d);
      const s = document.createElement('span'); s.className = 'ins'; s.textContent = mid(c.ins, 34); el.appendChild(s);
      if (c.ins.length > 34 || c.dim.length > 44) el.title = c.dim + c.ins;   // clipped: full text on hover
      if (c.tag) { const t = document.createElement('span'); t.className = 'tag'; t.textContent = c.tag; el.appendChild(t); }
      if (c.kind === 'replace') { const t = document.createElement('span'); t.className = 'kind'; t.textContent = 'replace'; el.appendChild(t); }
      chipsEl.appendChild(el);
    });
    const el = chipsEl.children[state.hi];
    if (el) {
      const l = el.offsetLeft, r = l + el.offsetWidth;
      if (l < chipsEl.scrollLeft) chipsEl.scrollLeft = Math.max(0, l - 8);
      else if (r > chipsEl.scrollLeft + chipsEl.clientWidth) chipsEl.scrollLeft = r - chipsEl.clientWidth + 8;
    }
  }
  function render() { renderBar(); renderMirror(); }

  function setChips(chips) {
    const sig = chips.map(c => c.insertText + '|' + c.replaceLen + '|' + (c.tag || '') + '|' + c.dim).join('\u00a6');
    if (sig !== state.sig) { state.hi = 0; state.sig = sig; }
    state.chips = chips;
    if (state.hi >= chips.length) state.hi = 0;
    render();
  }

  /* ---- suggestion scheduling ---- */
  function computeSuggestions() {
    if (state.composing || state.dismissed) return [];
    if (document.activeElement !== ta) return [];
    if (ta.selectionStart !== ta.selectionEnd) return [];
    return suggestFor(ta.value, ta.selectionStart);
  }
  let timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(run, 30); }
  function run() {
    let chips = [];
    try { chips = computeSuggestions(); } catch (e) { chips = []; }
    setChips(chips);
  }
  function clearAll() { clearTimeout(timer); setChips([]); }

  /* ---- accepting ---- */
  function insertText(t) {
    ta.focus();
    let ok = false;
    try { ok = document.execCommand('insertText', false, t); } catch (e) { ok = false; }
    if (!ok) {
      ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  function accept(i) {
    const c = state.chips[i];
    if (!c) return;
    if (c.tag === 'rad' || c.tag === 'deg') setAnglePref(c.tag);   // remember radians vs degrees
    ta.focus();
    if (c.replaceLen) {
      const p = ta.selectionStart;
      ta.setSelectionRange(Math.max(0, p - c.replaceLen), p);
    }
    insertText(c.insertText);
  }

  /* ---- events ---- */
  on(ta, 'keydown', (e) => {
    if (e.isComposing || state.composing || e.keyCode === 229) return;
    const k = e.key;
    if (k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta' || k === 'CapsLock') return;

    if (k === 'Escape') { state.dismissed = true; clearAll(); return; }
    state.dismissed = false;

    if (e.altKey && !e.ctrlKey && !e.metaKey && /^(Digit|Numpad)[1-9]$/.test(e.code)) {
      const i = parseInt(e.code.slice(-1), 10) - 1;
      if (state.chips[i]) { e.preventDefault(); accept(i); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const have = state.chips.length > 0;

    if (k === 'Tab') {
      if (e.shiftKey) return;
      e.preventDefault();
      // Tab always accepts the selected cell, inline or not
      if (have) accept(state.hi); else insertText('\t');
      return;
    }
    if (have && !e.shiftKey) {
      if ((k === 'ArrowLeft' || k === 'ArrowUp') && state.hi > 0) {
        e.preventDefault(); state.hi--; render(); return;
      }
      if ((k === 'ArrowRight' || k === 'ArrowDown') && state.hi < state.chips.length - 1) {
        e.preventDefault(); state.hi++; render(); return;
      }
    }
  });

  on(chipsEl, 'mousedown', (e) => { if (e.target.closest('.chip')) e.preventDefault(); });
  on(chipsEl, 'click', (e) => {
    const el = e.target.closest('.chip');
    if (el) accept(parseInt(el.dataset.i, 10));
  });

  /* ---- persistence ---- */
  let saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(flush, 250);
  }
  function flush() { try { localStorage.setItem(STORAGE_KEY, ta.value); } catch (e) { /* ignore */ } }

  on(ta, 'input', () => { state.dismissed = false; schedule(); save(); });
  on(document, 'selectionchange', () => { if (document.activeElement === ta) schedule(); });
  on(ta, 'focus', schedule);
  on(ta, 'blur', clearAll);
  on(ta, 'scroll', () => { mi.style.transform = 'translateY(' + (-ta.scrollTop) + 'px)'; });
  on(ta, 'compositionstart', () => { state.composing = true; clearAll(); });
  on(ta, 'compositionend', () => { state.composing = false; schedule(); });
  on(window, 'resize', renderMirror);
  on(window, 'beforeunload', flush);

  try { ta.value = localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { /* ignore */ }
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  render();

  // debugging: calcDebug.suggest('1g + 2g = ') -> [{insertText, dim, ins, tag, inlineEligible, kind}]
  window.calcDebug = {
    suggest: (text) => suggestFor(text, text.length),
    analyzeLine, findExpression, formatValue, parseText, show, resolveUnitWord, D
  };

  return {
    destroy() {
      ac.abort();
      clearTimeout(timer);
      clearTimeout(saveT);
      flush();
      delete window.calcDebug;
    }
  };
}
