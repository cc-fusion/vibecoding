import { UnitEngine, DEFAULT_UNITS } from './units.js';
import { computeAutocomplete } from './autocomplete.js';
import { logger } from './logger.js';

const STORAGE_KEY = 'smart_text_editor_settings_v1';
const CUSTOM_UNITS_KEY = 'smart_text_editor_units_v1';

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

class SmartTextEditorApp {
  constructor() {
    this.settings = {
      unitSystem: 'metric',
      angleMode: 'rad',
      theme: 'light',
      fontSize: 16,
      inlineSuggestions: true,
    };

    this.loadSavedSettings();
    this.unitEngine = new UnitEngine(this.loadSavedUnits());

    // Active autocomplete state
    this.candidates = [];
    this.compatibleUnits = [];
    this.activeUnitSymbol = null;
    this.selectedIndex = 0;
    this.dropdownUnitOverride = null;
    this.lastDocCursorKey = '';
    this.unitsJsonDirty = false;

    this.cacheElements();
    this.applySettingsToDOM();
    this.bindEvents();
    this.subscribeDebugLogs();
    this.updateEditorState(true);
  }

  loadSavedSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.unitSystem === 'metric' || parsed.unitSystem === 'imperial') {
        this.settings.unitSystem = parsed.unitSystem;
      }
      if (parsed.angleMode === 'rad' || parsed.angleMode === 'deg') {
        this.settings.angleMode = parsed.angleMode;
      }
      if (parsed.theme === 'light' || parsed.theme === 'dark') {
        this.settings.theme = parsed.theme;
      }
      if (typeof parsed.fontSize === 'number' && parsed.fontSize >= 12 && parsed.fontSize <= 28) {
        this.settings.fontSize = parsed.fontSize;
      }
      if (typeof parsed.inlineSuggestions === 'boolean') {
        this.settings.inlineSuggestions = parsed.inlineSuggestions;
      }
    } catch {
      // Ignore corrupt storage
    }
  }

  saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore storage quota errors
    }
  }

  loadSavedUnits() {
    try {
      const raw = localStorage.getItem(CUSTOM_UNITS_KEY);
      if (!raw) return DEFAULT_UNITS;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // Fallback to defaults
    }
    return DEFAULT_UNITS;
  }

  cacheElements() {
    this.appShell = document.getElementById('app-shell');
    this.editor = document.getElementById('editor');
    this.backdrop = document.getElementById('editor-backdrop');
    this.chipsContainer = document.getElementById('chips-container');
    this.unitDropdownWrap = document.getElementById('unit-dropdown-wrap');
    this.unitSelect = document.getElementById('unit-select');
    this.angleQuickBtn = document.getElementById('angle-quick-btn');

    this.settingsBtn = document.getElementById('settings-btn');
    this.settingsOverlay = document.getElementById('settings-overlay');
    this.settingsCard = document.getElementById('settings-card');

    this.btnMetric = document.getElementById('pref-metric');
    this.btnImperial = document.getElementById('pref-imperial');
    this.btnRad = document.getElementById('pref-rad');
    this.btnDeg = document.getElementById('pref-deg');
    this.btnLight = document.getElementById('pref-light');
    this.btnDark = document.getElementById('pref-dark');
    this.fontSizeRange = document.getElementById('font-size-range');
    this.fontSizeVal = document.getElementById('font-size-val');
    this.inlineToggle = document.getElementById('inline-toggle');

    this.devToggleBtn = document.getElementById('dev-toggle-btn');
    this.devChevron = document.getElementById('dev-chevron');
    this.devPanel = document.getElementById('dev-panel');
    this.devTabLogs = document.getElementById('dev-tab-logs');
    this.devTabUnits = document.getElementById('dev-tab-units');
    this.devLogsView = document.getElementById('dev-logs-view');
    this.devUnitsView = document.getElementById('dev-units-view');
    this.devLogOutput = document.getElementById('dev-log-output');
    this.clearLogsBtn = document.getElementById('clear-logs-btn');
    this.unitsJsonEditor = document.getElementById('units-json-editor');
    this.unitsJsonError = document.getElementById('units-json-error');
    this.applyUnitsBtn = document.getElementById('apply-units-btn');
    this.resetUnitsBtn = document.getElementById('reset-units-btn');
  }

  applySettingsToDOM() {
    document.documentElement.setAttribute('data-theme', this.settings.theme);
    document.documentElement.style.setProperty('--editor-font-size', `${this.settings.fontSize}px`);

    this.angleQuickBtn.textContent = this.settings.angleMode;

    this.btnMetric.classList.toggle('active', this.settings.unitSystem === 'metric');
    this.btnImperial.classList.toggle('active', this.settings.unitSystem === 'imperial');
    this.btnRad.classList.toggle('active', this.settings.angleMode === 'rad');
    this.btnDeg.classList.toggle('active', this.settings.angleMode === 'deg');
    this.btnLight.classList.toggle('active', this.settings.theme === 'light');
    this.btnDark.classList.toggle('active', this.settings.theme === 'dark');

    this.fontSizeRange.value = String(this.settings.fontSize);
    this.fontSizeVal.textContent = `${this.settings.fontSize}px`;
    this.inlineToggle.checked = this.settings.inlineSuggestions;
  }

  bindEvents() {
    // Synchronize scroll between textarea and backdrop
    this.editor.addEventListener('scroll', () => {
      this.backdrop.scrollTop = this.editor.scrollTop;
      this.backdrop.scrollLeft = this.editor.scrollLeft;
    });

    // Re-evaluate on text input
    this.editor.addEventListener('input', () => {
      this.dropdownUnitOverride = null;
      this.selectedIndex = 0;
      this.updateEditorState(true);
    });

    // Keyboard behavior: Tab accepts, Left/Right cycle within bounds, Up/Down/Enter preserved
    this.editor.addEventListener('keydown', (e) => {
      if (e.isComposing) return;

      // Tab accepts active completion when available
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (this.candidates.length > 0) {
          e.preventDefault();
          this.acceptCandidate(this.selectedIndex);
          return;
        }
        // Preserve ordinary tab behavior when no suggestion is active
        return;
      }

      // Left / Right arrows cycle through alternatives when available;
      // Left at first candidate and Right at last candidate preserve normal cursor movement.
      if (
        (e.key === 'ArrowRight' || e.key === 'ArrowLeft') &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        this.editor.selectionStart === this.editor.selectionEnd &&
        this.candidates.length > 1
      ) {
        if (e.key === 'ArrowRight' && this.selectedIndex < this.candidates.length - 1) {
          e.preventDefault();
          this.selectedIndex += 1;
          this.renderBackdrop();
          this.renderBottomBar();
          return;
        }
        if (e.key === 'ArrowLeft' && this.selectedIndex > 0) {
          e.preventDefault();
          this.selectedIndex -= 1;
          this.renderBackdrop();
          this.renderBottomBar();
          return;
        }
      }

      // Up / Down arrows and Enter naturally fall through with zero interference
    });

    // Track cursor movement via mouse or arrow keys without resetting selectedIndex if cursor did not move
    const onCursorCheck = () => {
      this.updateEditorState(false);
    };
    this.editor.addEventListener('keyup', onCursorCheck);
    this.editor.addEventListener('mouseup', onCursorCheck);
    this.editor.addEventListener('focus', () => this.renderBackdrop());
    this.editor.addEventListener('blur', () => this.renderBackdrop());
    document.addEventListener('selectionchange', () => {
      if (document.activeElement === this.editor) {
        this.updateEditorState(false);
      }
    });

    // Bottom bar: Unit Dropdown
    this.unitSelect.addEventListener('change', () => {
      this.dropdownUnitOverride = this.unitSelect.value;
      this.selectedIndex = 0;
      this.updateEditorState(true);
      this.editor.focus();
    });

    // Bottom bar: Rightmost Degrees / Radians quick switch
    this.angleQuickBtn.addEventListener('mousedown', (e) => e.preventDefault());
    this.angleQuickBtn.addEventListener('click', () => {
      this.setAngleMode(this.settings.angleMode === 'rad' ? 'deg' : 'rad');
      this.editor.focus();
    });

    // Top-right Settings overlay open / outside-click close & save
    this.settingsBtn.addEventListener('click', () => {
      this.openSettings();
    });

    let backdropMouseDown = false;
    this.settingsOverlay.addEventListener('mousedown', (e) => {
      backdropMouseDown = e.target === this.settingsOverlay;
    });
    this.settingsOverlay.addEventListener('click', (e) => {
      if (backdropMouseDown && e.target === this.settingsOverlay) {
        this.closeAndSaveSettings();
      }
      backdropMouseDown = false;
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.settingsOverlay.classList.contains('hidden')) {
        e.preventDefault();
        this.closeAndSaveSettings();
      }
    });

    // Settings controls
    this.btnMetric.addEventListener('click', () => this.setUnitSystem('metric'));
    this.btnImperial.addEventListener('click', () => this.setUnitSystem('imperial'));
    this.btnRad.addEventListener('click', () => this.setAngleMode('rad'));
    this.btnDeg.addEventListener('click', () => this.setAngleMode('deg'));
    this.btnLight.addEventListener('click', () => this.setTheme('light'));
    this.btnDark.addEventListener('click', () => this.setTheme('dark'));

    this.fontSizeRange.addEventListener('input', () => {
      this.settings.fontSize = Number(this.fontSizeRange.value);
      this.applySettingsToDOM();
      this.saveSettings();
    });

    this.inlineToggle.addEventListener('change', () => {
      this.settings.inlineSuggestions = this.inlineToggle.checked;
      this.saveSettings();
      this.renderBackdrop();
    });

    // Developer Menu controls
    this.devToggleBtn.addEventListener('click', () => {
      const willOpen = this.devPanel.classList.contains('hidden');
      this.devPanel.classList.toggle('hidden', !willOpen);
      this.devToggleBtn.setAttribute('aria-expanded', String(willOpen));
      this.devChevron.style.transform = willOpen ? 'rotate(180deg)' : '';
      if (willOpen && !this.unitsJsonDirty) {
        this.unitsJsonEditor.value = this.unitEngine.toJSON();
      }
    });

    this.devTabLogs.addEventListener('click', () => {
      this.devTabLogs.classList.add('active');
      this.devTabUnits.classList.remove('active');
      this.devLogsView.classList.remove('hidden');
      this.devUnitsView.classList.add('hidden');
    });

    this.devTabUnits.addEventListener('click', () => {
      this.devTabUnits.classList.add('active');
      this.devTabLogs.classList.remove('active');
      this.devUnitsView.classList.remove('hidden');
      this.devLogsView.classList.add('hidden');
      if (!this.unitsJsonDirty) {
        this.unitsJsonEditor.value = this.unitEngine.toJSON();
      }
    });

    this.clearLogsBtn.addEventListener('click', () => {
      logger.clear();
    });

    this.unitsJsonEditor.addEventListener('input', () => {
      this.unitsJsonDirty = true;
      this.unitsJsonError.textContent = '';
    });

    this.applyUnitsBtn.addEventListener('click', () => {
      this.tryApplyCustomUnitsJSON();
    });

    this.resetUnitsBtn.addEventListener('click', () => {
      this.unitEngine.loadUnits(DEFAULT_UNITS);
      try {
        localStorage.removeItem(CUSTOM_UNITS_KEY);
      } catch {}
      this.unitsJsonEditor.value = this.unitEngine.toJSON();
      this.unitsJsonDirty = false;
      this.unitsJsonError.textContent = '';
      this.updateEditorState(true);
    });
  }

  openSettings() {
    if (!this.unitsJsonDirty) {
      this.unitsJsonEditor.value = this.unitEngine.toJSON();
      this.unitsJsonError.textContent = '';
    }
    this.appShell.classList.add('blurred');
    this.settingsOverlay.classList.remove('hidden');
  }

  closeAndSaveSettings() {
    if (this.unitsJsonDirty) {
      this.tryApplyCustomUnitsJSON();
    }
    this.saveSettings();
    this.settingsOverlay.classList.add('hidden');
    this.appShell.classList.remove('blurred');
    this.updateEditorState(true);
    this.editor.focus();
  }

  tryApplyCustomUnitsJSON() {
    const raw = this.unitsJsonEditor.value.trim();
    try {
      const parsed = JSON.parse(raw);
      this.unitEngine.loadUnits(parsed);
      try {
        localStorage.setItem(CUSTOM_UNITS_KEY, JSON.stringify(parsed));
      } catch {}
      this.unitsJsonDirty = false;
      this.unitsJsonError.textContent = '';
      this.updateEditorState(true);
      return true;
    } catch (err) {
      this.unitsJsonError.textContent = err.message;
      logger.log('units-error', err.message);
      return false;
    }
  }

  setUnitSystem(sys) {
    this.settings.unitSystem = sys;
    this.dropdownUnitOverride = null;
    this.selectedIndex = 0;
    this.applySettingsToDOM();
    this.saveSettings();
    this.updateEditorState(true);
  }

  setAngleMode(mode) {
    this.settings.angleMode = mode;
    this.selectedIndex = 0;
    this.applySettingsToDOM();
    this.saveSettings();
    this.updateEditorState(true);
  }

  setTheme(theme) {
    this.settings.theme = theme;
    this.applySettingsToDOM();
    this.saveSettings();
  }

  subscribeDebugLogs() {
    const renderLogs = (entries) => {
      if (!this.devLogOutput) return;
      this.devLogOutput.innerHTML = entries
        .map(
          (e) =>
            `<div class="log-line"><span>${escapeHtml(e.time)}</span> <span class="log-cat">[${escapeHtml(e.category)}]</span> ${escapeHtml(e.message)}</div>`
        )
        .join('');
      this.devLogOutput.scrollTop = this.devLogOutput.scrollHeight;
    };
    renderLogs(logger.entries);
    logger.subscribe(renderLogs);
  }

  updateEditorState(forceRecompute = false) {
    const text = this.editor.value;
    const selStart = this.editor.selectionStart;
    const selEnd = this.editor.selectionEnd;

    if (selStart !== selEnd) {
      // Non-collapsed text selection: suppress autocomplete so selection remains clean
      this.lastDocCursorKey = `${text.length}:${selStart}:${selEnd}`;
      this.candidates = [];
      this.compatibleUnits = [];
      this.activeUnitSymbol = null;
      this.selectedIndex = 0;
      this.renderBackdrop();
      this.renderBottomBar();
      return;
    }

    const docCursorKey = `${text}:${selStart}`;
    if (!forceRecompute && docCursorKey === this.lastDocCursorKey) {
      return;
    }

    if (docCursorKey !== this.lastDocCursorKey) {
      this.dropdownUnitOverride = null;
      this.selectedIndex = 0;
      this.lastDocCursorKey = docCursorKey;
    }

    const result = computeAutocomplete(text, selStart, {
      unitEngine: this.unitEngine,
      angleMode: this.settings.angleMode,
      unitSystem: this.settings.unitSystem,
      dropdownUnitOverride: this.dropdownUnitOverride,
    });

    this.candidates = result.candidates;
    this.compatibleUnits = result.compatibleUnits;
    this.activeUnitSymbol = result.activeUnitSymbol;
    if (this.selectedIndex >= this.candidates.length) {
      this.selectedIndex = 0;
    }

    this.renderBackdrop();
    this.renderBottomBar();
  }

  acceptCandidate(idx) {
    const cand = this.candidates[idx];
    if (!cand) return;

    const text = this.editor.value;
    const cursor = this.editor.selectionStart;
    const start = Math.max(0, cursor - (cand.deleteBefore || 0));
    const end = Math.min(text.length, cursor + (cand.deleteAfter || 0));

    const nextText = text.slice(0, start) + cand.insertText + text.slice(end);
    const nextCursor = start + cand.insertText.length;

    // Remember angle selection when user accepts a rad/deg candidate!
    if (cand.angleBadge === 'rad' || cand.angleBadge === 'deg') {
      if (this.settings.angleMode !== cand.angleBadge) {
        this.settings.angleMode = cand.angleBadge;
        this.applySettingsToDOM();
        this.saveSettings();
      }
    }

    this.editor.value = nextText;
    this.editor.focus();
    this.editor.setSelectionRange(nextCursor, nextCursor);

    logger.log('accept', `Inserted "${cand.insertText}" (delBefore=${cand.deleteBefore || 0})`);

    this.dropdownUnitOverride = null;
    this.selectedIndex = 0;
    this.updateEditorState(true);
  }

  renderBackdrop() {
    const text = this.editor.value;
    const selStart = this.editor.selectionStart;
    const selEnd = this.editor.selectionEnd;

    // Note: Per Section 2 ("The inline completion is always the first bottom-bar candidate"),
    // candidate[0] is the inline candidate by default; if the user cycles via Left/Right arrows,
    // previewing candidates[selectedIndex] keeps inline preview synced with what Tab inserts.
    const activeCand =
      this.settings.inlineSuggestions &&
      selStart === selEnd &&
      this.candidates.length > 0 &&
      this.candidates[this.selectedIndex]?.allowInline
        ? this.candidates[this.selectedIndex]
        : null;

    if (!activeCand) {
      this.editor.classList.remove('hide-native-caret');
      this.backdrop.innerHTML = escapeHtml(text) + '\n';
      this.backdrop.scrollTop = this.editor.scrollTop;
      return;
    }

    const delBefore = activeCand.deleteBefore || 0;
    const delAfter = activeCand.deleteAfter || 0;
    const keptBefore = text.slice(0, Math.max(0, selStart - delBefore));
    const afterText = text.slice(Math.min(text.length, selStart + delAfter));

    // When characters before the cursor are visually hidden & replaced (e.g. `2` in `pi=3.142"15"`),
    // render a synchronized virtual caret at the exact replacement point and hide the shifted native caret.
    const useVirtualCaret = delBefore > 0 && document.activeElement === this.editor;
    this.editor.classList.toggle('hide-native-caret', useVirtualCaret);

    const caretSpan = useVirtualCaret ? '<span class="virtual-caret"></span>' : '';
    const ghostSpan = `<span class="inline-ghost" data-inline-ghost="true">${escapeHtml(activeCand.displayInline)}</span>`;

    this.backdrop.innerHTML =
      escapeHtml(keptBefore) + caretSpan + ghostSpan + escapeHtml(afterText) + '\n';
    this.backdrop.scrollTop = this.editor.scrollTop;
  }

  renderBottomBar() {
    this.chipsContainer.innerHTML = '';

    this.candidates.forEach((cand, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `suggestion-chip${idx === this.selectedIndex ? ' selected' : ''}`;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', String(idx === this.selectedIndex));

      const labelSpan = document.createElement('span');
      labelSpan.className = 'chip-text';
      labelSpan.textContent = cand.displayChip;
      btn.appendChild(labelSpan);

      if (cand.angleBadge) {
        const badge = document.createElement('span');
        badge.className = 'chip-badge';
        badge.textContent = cand.angleBadge;
        btn.appendChild(badge);
      }

      // Prevent textarea blur on mousedown
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => {
        this.acceptCandidate(idx);
      });

      this.chipsContainer.appendChild(btn);
    });

    // Conditional Unit Dropdown: ONLY appear if a unit is being suggested
    if (this.candidates.length > 0 && this.compatibleUnits.length > 0) {
      this.unitDropdownWrap.classList.remove('hidden');
      this.unitSelect.innerHTML = '';
      for (const sym of this.compatibleUnits) {
        const opt = document.createElement('option');
        opt.value = sym;
        opt.textContent = sym;
        if (sym === this.activeUnitSymbol) opt.selected = true;
        this.unitSelect.appendChild(opt);
      }
    } else {
      this.unitDropdownWrap.classList.add('hidden');
      this.unitSelect.innerHTML = '';
    }
  }
}

const app = new SmartTextEditorApp();
window.__SMART_EDITOR__ = app;
