import { createElement, Settings2, X, Sun, Moon, Terminal, Play, RotateCcw, Trash2, Check, ChevronDown, ArrowRight, CircleAlert } from 'lucide';
import { getSuggestions, describeSuggestion } from './suggestions.js';
import { defaultUnits, validateUnits, compileUnits } from './units.js';
import { runChecks } from './checks.js';

const SETTINGS_KEY = 'smart-editor.settings.v1';
const UNITS_KEY = 'smart-editor.units.v1';
const DOCUMENT_KEY = 'smart-editor.document.v1';
const INITIAL_TEXT = '1 + 1 = 2\nsin(30) = -0.988\n1 km -> mi = 0.6214 mi\n\n1 kg + 2000 g =';
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const svg = (Icon, size = 18) => createElement(Icon, { width: size, height: size, 'stroke-width': 1.7, 'aria-hidden': 'true' }).outerHTML;

function readStorage(key, fallback) {
  try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); }
  catch { return fallback; }
}
function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Editing remains available when storage is unavailable. */ }
}

export function mountEditor(root) {
  const stored = readStorage(SETTINGS_KEY, {});
  const settings = {
    units: stored.units === 'imperial' ? 'imperial' : 'metric',
    angle: stored.angle === 'deg' ? 'deg' : 'rad',
    theme: stored.theme === 'dark' ? 'dark' : 'light',
    fontSize: Math.max(12, Math.min(28, Number(stored.fontSize) || 18)),
    inline: stored.inline !== false,
    developer: Boolean(stored.developer),
    logging: stored.logging !== false,
    calculationPrecision: 48,
  };
  let registry = defaultUnits();
  try { registry = validateUnits(readStorage(UNITS_KEY, registry)); } catch { /* Keep the valid defaults. */ }
  const savedDocument = readStorage(DOCUMENT_KEY, null);
  const state = { suggestion: null, selected: 0, overrideUnit: '', settingsOpen: false, composing: false, unitsDirty: false, logs: [], devTab: 'console', lastCursor: -1 };
  let refreshTimer, saveTimer, toastTimer;
  const controller = new AbortController();
  const on = (element, event, handler, options = {}) => element.addEventListener(event, handler, { ...options, signal: controller.signal });

  root.innerHTML = `
    <div class="editor-shell" data-theme="${settings.theme}">
      <button class="settings-trigger" type="button" aria-label="Open settings" aria-expanded="false">${svg(Settings2, 17)}<span>Settings</span></button>
      <main class="editor-surface" aria-label="Text editor">
        <div class="active-line" aria-hidden="true"></div>
        <div class="editor-mirror" aria-hidden="true"></div>
        <textarea class="editor-input" aria-label="Editor text" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off"></textarea>
      </main>
      <footer class="completion-bar" aria-label="Autocomplete">
        <div class="completion-main">
          <div class="suggestion-list" role="listbox" aria-label="Completion candidates"></div>
          <div class="keyboard-hint" aria-hidden="true"></div>
        </div>
        <div class="bar-controls">
          <label class="unit-picker" hidden><span class="unit-picker-label">Unit</span><span class="select-wrap"><select class="unit-select" aria-label="Convert to unit"></select>${svg(ChevronDown, 14)}</span></label>
          <div class="angle-switch" role="group" aria-label="Angle mode">
            <button type="button" data-angle="rad" aria-pressed="${settings.angle === 'rad'}">rad</button>
            <button type="button" data-angle="deg" aria-pressed="${settings.angle === 'deg'}">deg</button>
          </div>
        </div>
      </footer>
      <div class="settings-backdrop" hidden>
        <section class="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <header class="settings-header"><h2 id="settings-title">Settings</h2><button class="icon-button close-settings" type="button" aria-label="Close settings">${svg(X, 19)}</button></header>
          <div class="settings-body">
            <section class="setting-group">
              <h3>Appearance</h3>
              <div class="setting-row"><span class="setting-label">Theme</span><div class="segmented" role="group" aria-label="Theme"><button type="button" data-theme-value="light">${svg(Sun, 15)}Light</button><button type="button" data-theme-value="dark">${svg(Moon, 15)}Dark</button></div></div>
              <div class="font-setting"><div class="setting-row"><label class="setting-label" for="font-size">Font size</label><output class="font-value" for="font-size">${settings.fontSize}px</output></div><div class="font-slider"><span>A</span><input id="font-size" type="range" min="12" max="28" step="1" value="${settings.fontSize}" /><span>A</span></div></div>
            </section>
            <section class="setting-group">
              <h3>Suggestions</h3>
              <div class="setting-row"><div><span class="setting-label">Inline suggestions</span><p class="setting-help">Preview at the caret; keep candidates in the bar.</p></div><button class="switch" type="button" role="switch" aria-label="Inline suggestions" aria-checked="${settings.inline}"><span></span></button></div>
            </section>
            <section class="setting-group">
              <h3>Calculations</h3>
              <div class="setting-row"><span class="setting-label">Angle mode</span><div class="segmented" role="group" aria-label="Angle mode"><button type="button" data-angle="rad">Radians</button><button type="button" data-angle="deg">Degrees</button></div></div>
              <div class="setting-row"><span class="setting-label">Unit preference</span><div class="segmented" role="group" aria-label="Unit preference"><button type="button" data-units="metric">Metric</button><button type="button" data-units="imperial">Imperial</button></div></div>
            </section>
            <section class="setting-group developer-group">
              <div class="setting-row"><div><span class="setting-label">Developer tools</span><p class="setting-help">Logs, unit definitions, and validation.</p></div><button class="switch developer-switch" type="button" role="switch" aria-label="Developer tools" aria-checked="${settings.developer}"><span></span></button></div>
              <div class="developer-panel" hidden>
                <div class="dev-tabs" role="tablist"><button type="button" role="tab" data-dev-tab="console">Console</button><button type="button" role="tab" data-dev-tab="units">Units JSON</button><button type="button" role="tab" data-dev-tab="checks">Checks</button></div>
                <div class="dev-pane" data-dev-pane="console"><div class="dev-toolbar"><label class="check-label"><input class="logging-toggle" type="checkbox" ${settings.logging ? 'checked' : ''} /> Capture logs</label><button class="text-button clear-logs" type="button">${svg(Trash2, 14)}Clear</button></div><div class="log-list" aria-live="polite"></div></div>
                <div class="dev-pane" data-dev-pane="units" hidden><textarea class="units-json" aria-label="Known units JSON" spellcheck="false"></textarea><p class="json-message" role="status"></p><div class="dev-actions"><button class="small-button apply-units" type="button">Apply changes</button><button class="text-button reset-units" type="button">${svg(RotateCcw, 14)}Reset defaults</button></div></div>
                <div class="dev-pane" data-dev-pane="checks" hidden><div class="dev-actions"><button class="small-button run-checks" type="button">${svg(Play, 14)}Run checks</button><span class="checks-summary"></span></div><div class="checks-list"></div></div>
              </div>
            </section>
          </div>
          <footer class="settings-footer"><button class="done-button" type="button">Done${svg(ArrowRight, 16)}</button></footer>
        </section>
      </div>
      <div class="toast" role="status" aria-live="polite" hidden></div>
    </div>`;

  const shell = root.querySelector('.editor-shell');
  const textarea = root.querySelector('.editor-input');
  const mirror = root.querySelector('.editor-mirror');
  const activeLine = root.querySelector('.active-line');
  const surface = root.querySelector('.editor-surface');
  const bar = root.querySelector('.completion-bar');
  const list = root.querySelector('.suggestion-list');
  const hint = root.querySelector('.keyboard-hint');
  const unitPicker = root.querySelector('.unit-picker');
  const unitSelect = root.querySelector('.unit-select');
  const trigger = root.querySelector('.settings-trigger');
  const backdrop = root.querySelector('.settings-backdrop');
  const panel = root.querySelector('.settings-panel');
  const jsonEditor = root.querySelector('.units-json');
  const jsonMessage = root.querySelector('.json-message');
  const logList = root.querySelector('.log-list');
  const toast = root.querySelector('.toast');
  textarea.value = typeof savedDocument === 'string' ? savedDocument : INITIAL_TEXT;
  jsonEditor.value = JSON.stringify(registry, null, 2);

  function saveSettings() { writeStorage(SETTINGS_KEY, settings); }
  function saveDocument() { writeStorage(DOCUMENT_KEY, textarea.value); }
  function showToast(message, error = false) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle('error', error);
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  }
  function log(level, message) {
    if (!settings.logging) return;
    state.logs.push({ level, message, time: new Date().toLocaleTimeString([], { hour12: false }) });
    if (state.logs.length > 200) state.logs.shift();
    if (state.devTab === 'console') renderLogs();
  }
  function renderLogs() {
    logList.innerHTML = state.logs.length ? state.logs.slice(-80).map(entry => `<div class="log-entry ${entry.level}"><time>${escapeHtml(entry.time)}</time><span class="log-level">${escapeHtml(entry.level)}</span><span>${escapeHtml(entry.message)}</span></div>`).join('') : '<p class="empty-pane">No logs yet.</p>';
    logList.scrollTop = logList.scrollHeight;
  }
  function syncScroll() {
    mirror.scrollTop = textarea.scrollTop;
    mirror.scrollLeft = textarea.scrollLeft;
    updateActiveLine();
  }
  function updateActiveLine() {
    const style = getComputedStyle(textarea);
    const lineHeight = parseFloat(style.lineHeight) || settings.fontSize * 2;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const line = textarea.value.slice(0, textarea.selectionStart).split('\n').length - 1;
    activeLine.style.height = `${lineHeight}px`;
    activeLine.style.top = `${paddingTop + line * lineHeight - textarea.scrollTop}px`;
  }
  function renderMirror() {
    const text = textarea.value;
    const candidate = state.suggestion?.candidates[state.selected];
    const show = candidate && candidate.kind === 'inline' && settings.inline && !state.composing && candidate.start >= 0 && candidate.end <= text.length && candidate.end >= candidate.start;
    if (show) {
      const before = text.slice(0, candidate.start);
      const replaced = text.slice(candidate.start, candidate.end);
      const after = text.slice(candidate.end);
      mirror.innerHTML = escapeHtml(before) + (replaced ? `<span class="ghost-replaced">${escapeHtml(replaced)}</span>` : '') + `<span class="inline-ghost">${replaced ? '<span class="preview-caret"></span>' : ''}${escapeHtml(candidate.preview)}</span>` + escapeHtml(after) + '\n';
      textarea.classList.toggle('replacing', Boolean(replaced));
    } else {
      mirror.textContent = text + '\n';
      textarea.classList.remove('replacing');
    }
    mirror.classList.toggle('composing', state.composing);
    textarea.classList.toggle('composing', state.composing);
    syncScroll();
  }
  function renderUnitPicker() {
    const context = state.suggestion?.context;
    const options = context?.unitOptions || [];
    unitPicker.hidden = !options.length;
    if (!options.length) return;
    const selected = context.targetUnit || context.result?.display?.symbol || options[0].symbol;
    const groups = { metric: 'Metric', imperial: 'Imperial', other: 'Other' };
    unitSelect.innerHTML = '';
    for (const [system, label] of Object.entries(groups)) {
      const entries = options.filter(option => (option.system || 'other') === system);
      if (!entries.length) continue;
      const group = document.createElement('optgroup');
      group.label = label;
      for (const unit of entries) {
        const option = document.createElement('option');
        option.value = unit.symbol;
        option.textContent = unit.symbol;
        option.title = unit.name;
        group.append(option);
      }
      unitSelect.append(group);
    }
    unitSelect.value = selected;
  }
  function renderSuggestions() {
    list.innerHTML = '';
    const candidates = state.suggestion?.candidates || [];
    if (!candidates.length) {
      hint.innerHTML = '';
      unitPicker.hidden = true;
      bar.classList.remove('has-suggestions');
      return;
    }
    bar.classList.add('has-suggestions');
    candidates.forEach((candidate, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'suggestion-chip' + (index === state.selected ? ' selected' : '');
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(index === state.selected));
      button.title = candidate.title || candidate.fullText;
      const text = document.createElement('span');
      text.className = 'chip-text';
      text.textContent = candidate.text;
      button.append(text);
      if (candidate.badge) {
        const badge = document.createElement('span');
        badge.className = 'chip-badge';
        badge.textContent = candidate.badge;
        button.append(badge);
      }
      if (index === state.selected) {
        const key = document.createElement('kbd');
        key.textContent = 'Tab';
        button.append(key);
      }
      on(button, 'pointerdown', event => event.preventDefault());
      on(button, 'click', () => accept(index));
      list.append(button);
    });
    hint.innerHTML = `<kbd>Tab</kbd><span>${settings.inline ? 'accept' : 'insert'}</span>${candidates.length > 1 ? '<span class="hint-dot">·</span><kbd>←</kbd><kbd>→</kbd><span>switch</span>' : ''}`;
    renderUnitPicker();
  }
  function refresh() {
    clearTimeout(refreshTimer);
    const cursor = textarea.selectionStart;
    const text = textarea.value;
    try {
      state.suggestion = getSuggestions(text, cursor, settings, registry, state.overrideUnit);
      state.suggestionCursor = cursor;
      state.selected = 0;
      if (settings.developer && settings.logging) {
        const description = describeSuggestion(state.suggestion, compileUnits(registry));
        log('debug', description ? `${description.expression} → ${description.preview} (${description.candidates.length} candidate${description.candidates.length === 1 ? '' : 's'})` : 'No completion at caret');
      }
    } catch (error) {
      state.suggestion = null;
      log('error', error.message || 'Could not calculate a preview');
    }
    renderSuggestions();
    renderMirror();
  }
  function scheduleRefresh(delay = 45) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, delay);
  }
  function accept(index = state.selected) {
    const candidate = state.suggestion?.candidates[index];
    if (!candidate) return;
    const start = Math.max(0, Math.min(candidate.start, textarea.value.length));
    const end = Math.max(start, Math.min(candidate.end, textarea.value.length));
    textarea.focus();
    textarea.setSelectionRange(start, end);
    let inserted = false;
    try { inserted = document.execCommand('insertText', false, candidate.fullText); } catch { inserted = false; }
    if (!inserted || textarea.value.slice(start, start + candidate.fullText.length) !== candidate.fullText) {
      textarea.setRangeText(candidate.fullText, start, end, 'end');
    }
    const caret = start + candidate.fullText.length;
    textarea.setSelectionRange(caret, caret);
    state.overrideUnit = '';
    state.suggestion = null;
    state.selected = 0;
    saveDocument();
    renderSuggestions();
    renderMirror();
    scheduleRefresh(20);
  }
  function applySettings() {
    shell.dataset.theme = settings.theme;
    shell.style.setProperty('--editor-font-size', `${settings.fontSize}px`);
    root.querySelector('.font-value').textContent = `${settings.fontSize}px`;
    root.querySelector('#font-size').value = settings.fontSize;
    root.querySelector('.switch[aria-label="Inline suggestions"]').setAttribute('aria-checked', String(settings.inline));
    root.querySelector('.developer-switch').setAttribute('aria-checked', String(settings.developer));
    root.querySelector('.developer-panel').hidden = !settings.developer;
    root.querySelectorAll('[data-angle]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.angle === settings.angle)));
    root.querySelectorAll('[data-units]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.units === settings.units)));
    root.querySelectorAll('[data-theme-value]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeValue === settings.theme)));
    saveSettings();
    renderMirror();
    scheduleRefresh();
  }
  function applyUnits(silent = false) {
    try {
      const next = validateUnits(jsonEditor.value);
      registry = next;
      writeStorage(UNITS_KEY, registry);
      state.unitsDirty = false;
      jsonMessage.textContent = 'Unit registry saved.';
      jsonMessage.className = 'json-message success';
      log('info', `Loaded ${Object.keys(registry).length} unit definitions`);
      scheduleRefresh();
      if (!silent) showToast('Unit registry updated');
      return true;
    } catch (error) {
      jsonMessage.textContent = error.message;
      jsonMessage.className = 'json-message error';
      if (!silent) showToast('Check the unit JSON before applying', true);
      return false;
    }
  }
  function setDevTab(tab) {
    state.devTab = tab;
    root.querySelectorAll('[data-dev-tab]').forEach(button => {
      const selected = button.dataset.devTab === tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    root.querySelectorAll('[data-dev-pane]').forEach(pane => { pane.hidden = pane.dataset.devPane !== tab; });
    if (tab === 'console') renderLogs();
  }
  function openSettings() {
    state.settingsOpen = true;
    backdrop.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    surface.inert = true;
    bar.inert = true;
    jsonEditor.value = JSON.stringify(registry, null, 2);
    state.unitsDirty = false;
    jsonMessage.textContent = '';
    setDevTab(state.devTab);
    panel.querySelector('.close-settings').focus();
  }
  function closeSettings() {
    if (state.unitsDirty) {
      if (!applyUnits(true)) showToast('Preferences saved; invalid unit JSON was not applied', true);
    }
    saveSettings();
    saveDocument();
    state.settingsOpen = false;
    backdrop.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    surface.inert = false;
    bar.inert = false;
    textarea.focus();
    scheduleRefresh();
  }
  function renderChecks(report) {
    root.querySelector('.checks-summary').textContent = `${report.passed}/${report.total} passed`;
    root.querySelector('.checks-list').innerHTML = report.results.map(result => `<div class="check-result ${result.pass ? 'pass' : 'fail'}">${svg(result.pass ? Check : CircleAlert, 14)}<span>${escapeHtml(result.name)}</span>${result.pass ? '' : `<code>${escapeHtml(JSON.stringify(result.actual))} → ${escapeHtml(JSON.stringify(result.expected))}</code>`}</div>`).join('');
  }

  on(textarea, 'input', () => {
    state.suggestion = null;
    state.selected = 0;
    state.overrideUnit = '';
    renderSuggestions();
    renderMirror();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDocument, 250);
    scheduleRefresh();
  });
  on(textarea, 'keydown', event => {
    if (state.settingsOpen || state.composing) return;
    if (state.suggestion && (textarea.selectionStart !== state.suggestionCursor || textarea.selectionEnd !== textarea.selectionStart)) refresh();
    if (!state.suggestion) return;
    const candidates = state.suggestion.candidates;
    if (event.key === 'Tab') {
      event.preventDefault();
      accept(state.selected);
    } else if (event.key === 'ArrowLeft' && candidates.length > 1 && state.selected > 0) {
      event.preventDefault();
      state.selected--;
      renderSuggestions();
      renderMirror();
    } else if (event.key === 'ArrowRight' && candidates.length > 1 && state.selected < candidates.length - 1) {
      event.preventDefault();
      state.selected++;
      renderSuggestions();
      renderMirror();
    }
  });
  on(textarea, 'scroll', syncScroll);
  on(textarea, 'compositionstart', () => { state.composing = true; renderMirror(); });
  on(textarea, 'compositionend', () => { state.composing = false; scheduleRefresh(); });
  on(document, 'selectionchange', () => {
    if (document.activeElement !== textarea || state.composing) return;
    const cursor = textarea.selectionStart;
    if (cursor !== state.lastCursor) {
      state.lastCursor = cursor;
      updateActiveLine();
      scheduleRefresh();
    }
  });
  on(textarea, 'click', () => { state.overrideUnit = ''; scheduleRefresh(); });
  on(unitSelect, 'change', () => {
    const cursor = textarea.selectionStart;
    state.overrideUnit = unitSelect.value;
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
    refresh();
  });
  on(trigger, 'click', () => state.settingsOpen ? closeSettings() : openSettings());
  on(backdrop, 'pointerdown', event => { if (event.target === backdrop) closeSettings(); });
  on(root.querySelector('.close-settings'), 'click', closeSettings);
  on(root.querySelector('.done-button'), 'click', closeSettings);
  on(panel, 'keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeSettings(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...panel.querySelectorAll('button, input, select, textarea, [tabindex="0"]')].filter(element => !element.disabled && element.getClientRects().length && element.tabIndex !== -1);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  on(root.querySelector('#font-size'), 'input', event => { settings.fontSize = Number(event.target.value); applySettings(); });
  on(root.querySelector('.switch[aria-label="Inline suggestions"]'), 'click', () => { settings.inline = !settings.inline; applySettings(); });
  on(root.querySelector('.developer-switch'), 'click', () => { settings.developer = !settings.developer; applySettings(); });
  on(root.querySelector('.logging-toggle'), 'change', event => { settings.logging = event.target.checked; saveSettings(); });
  on(root.querySelector('.clear-logs'), 'click', () => { state.logs = []; renderLogs(); });
  on(root.querySelector('.apply-units'), 'click', () => applyUnits(false));
  on(root.querySelector('.reset-units'), 'click', () => { jsonEditor.value = JSON.stringify(defaultUnits(), null, 2); state.unitsDirty = true; jsonMessage.textContent = 'Defaults loaded. Apply changes to save.'; jsonMessage.className = 'json-message'; });
  on(jsonEditor, 'input', () => { state.unitsDirty = true; jsonMessage.textContent = 'Unsaved changes'; jsonMessage.className = 'json-message'; });
  on(root.querySelector('.run-checks'), 'click', event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Running…';
    setTimeout(() => {
      try { const report = runChecks(); renderChecks(report); log('info', `Validation: ${report.passed}/${report.total} checks passed`); }
      catch (error) { log('error', error.message); }
      button.disabled = false;
      button.innerHTML = `${svg(Play, 14)}Run checks`;
    }, 30);
  });
  on(panel, 'click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.angle) { settings.angle = button.dataset.angle; applySettings(); }
    if (button.dataset.units) { settings.units = button.dataset.units; applySettings(); }
    if (button.dataset.themeValue) { settings.theme = button.dataset.themeValue; applySettings(); }
    if (button.dataset.devTab) setDevTab(button.dataset.devTab);
  });
  on(bar, 'click', event => {
    const button = event.target.closest('[data-angle]');
    if (!button) return;
    settings.angle = button.dataset.angle;
    const cursor = textarea.selectionStart;
    applySettings();
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
  });
  on(window, 'resize', syncScroll);
  on(window, 'error', event => log('error', event.message));
  on(window, 'unhandledrejection', event => log('error', String(event.reason)));
  const observer = new ResizeObserver(syncScroll);
  observer.observe(textarea);

  shell.style.setProperty('--editor-font-size', `${settings.fontSize}px`);
  applySettings();
  renderLogs();
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  renderMirror();
  refresh();
  log('info', 'Editor ready');

  return () => {
    controller.abort();
    observer.disconnect();
    clearTimeout(refreshTimer);
    clearTimeout(saveTimer);
    clearTimeout(toastTimer);
    saveDocument();
    root.innerHTML = '';
  };
}
