import rawUnitsData from "./data/units.json";
import { analyzeEditorAtCursor } from "./engine/mathEngine.js";
import { UnitEngine } from "./engine/unitEngine.js";

const STORAGE_KEY = "smart_text_editor_settings_v1";

function loadInitialSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        unitPreference: parsed.unitPreference === "imperial" ? "imperial" : "metric",
        angleMode: parsed.angleMode === "deg" ? "deg" : "rad",
        theme: parsed.theme === "dark" ? "dark" : "light",
        fontSize:
          typeof parsed.fontSize === "number" && parsed.fontSize >= 12 && parsed.fontSize <= 28
            ? parsed.fontSize
            : 16,
        inlineEnabled: typeof parsed.inlineEnabled === "boolean" ? parsed.inlineEnabled : true,
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    unitPreference: "metric",
    angleMode: "rad",
    theme: "light",
    fontSize: 16,
    inlineEnabled: true,
  };
}

function saveSettingsToStorage(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const EDITOR_TEMPLATE_HTML = `
  <div class="smart-editor-root" id="smart-editor-root">
    <button
      type="button"
      class="settings-trigger-btn"
      id="settings-trigger-btn"
      title="Settings"
      aria-label="Settings"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    </button>

    <div class="main-surface" id="main-surface">
      <div class="editor-container" id="editor-container">
        <div class="editor-shared-layer editor-mirror" id="editor-mirror" aria-hidden="true"></div>
        <textarea
          class="editor-shared-layer editor-textarea"
          id="editor-textarea"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          aria-label="Text editor"
        ></textarea>
      </div>

      <div class="bottom-bar" id="bottom-bar">
        <div class="chips-container" id="chips-container" role="listbox" aria-label="Autocomplete suggestions"></div>
        <div class="bottom-bar-right">
          <select
            class="unit-select-dropdown"
            id="unit-select-dropdown"
            aria-label="Select target unit"
            style="display: none;"
          ></select>
          <button
            type="button"
            class="angle-switch-btn"
            id="angle-switch-btn"
            title="Toggle angle mode (Radians / Degrees)"
          >rad</button>
        </div>
      </div>
    </div>

    <div class="settings-backdrop hidden" id="settings-backdrop">
      <div class="settings-modal" id="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div class="settings-header">
          <span class="settings-title" id="settings-title">Settings</span>
          <button type="button" class="settings-close-btn" id="settings-close-btn" aria-label="Close settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="settings-body">
          <div class="setting-row">
            <span class="setting-label">Unit System</span>
            <div class="segmented-control">
              <button type="button" class="segmented-btn" id="pref-metric-btn">Metric</button>
              <button type="button" class="segmented-btn" id="pref-imperial-btn">Imperial</button>
            </div>
          </div>

          <div class="setting-row">
            <span class="setting-label">Angle Mode</span>
            <div class="segmented-control">
              <button type="button" class="segmented-btn" id="angle-rad-btn">Radians</button>
              <button type="button" class="segmented-btn" id="angle-deg-btn">Degrees</button>
            </div>
          </div>

          <div class="setting-row">
            <span class="setting-label">Theme</span>
            <div class="segmented-control">
              <button type="button" class="segmented-btn" id="theme-light-btn">Light</button>
              <button type="button" class="segmented-btn" id="theme-dark-btn">Dark</button>
            </div>
          </div>

          <div class="setting-row">
            <span class="setting-label">Font Size</span>
            <div class="font-size-control">
              <input
                type="range"
                min="12"
                max="28"
                step="1"
                class="font-size-slider"
                id="font-size-slider"
              />
              <span class="font-size-value" id="font-size-value">16px</span>
            </div>
          </div>

          <div class="setting-row">
            <span class="setting-label">Inline Suggestions</span>
            <button
              type="button"
              class="switch-toggle on"
              id="inline-toggle-btn"
              role="switch"
              aria-checked="true"
            >
              <span class="switch-thumb"></span>
            </button>
          </div>

          <div class="dev-section">
            <button type="button" class="dev-toggle-header" id="dev-toggle-header">
              <span>Developer Menu</span>
              <span id="dev-chevron">▸</span>
            </button>

            <div class="dev-content hidden" id="dev-content">
              <div class="dev-tabs">
                <button type="button" class="dev-tab-btn active" id="dev-tab-logs">Console Logs</button>
                <button type="button" class="dev-tab-btn" id="dev-tab-units">Units JSON</button>
              </div>

              <div id="dev-panel-logs">
                <div class="dev-logs-box" id="dev-logs-box"></div>
                <div class="dev-actions-row" style="margin-top: 8px;">
                  <span class="dev-status-msg" id="dev-logs-count">0 events</span>
                  <button type="button" class="dev-btn" id="dev-clear-logs-btn">Clear</button>
                </div>
              </div>

              <div id="dev-panel-units" style="display: none;">
                <textarea
                  class="dev-units-textarea"
                  id="dev-units-textarea"
                  spellcheck="false"
                ></textarea>
                <div class="dev-actions-row" style="margin-top: 8px;">
                  <span class="dev-status-msg" id="dev-units-status"></span>
                  <div style="display: flex; gap: 6px;">
                    <button type="button" class="dev-btn" id="dev-reset-units-btn">Reset</button>
                    <button type="button" class="dev-btn" id="dev-apply-units-btn">Apply JSON</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

export function initSmartTextEditor(container) {
  const host = container || document.getElementById("root") || document.body;
  const settings = loadInitialSettings();
  const unitEngine = new UnitEngine(rawUnitsData);

  let currentResult = null;
  let selectedIndex = 0;
  let overrideTargetUnit = null;
  let isSettingsOpen = false;
  let isDevOpen = false;
  let isProgrammaticInsert = false;
  const debugLogs = [];

  if (!host.querySelector("#editor-textarea")) {
    host.innerHTML = EDITOR_TEMPLATE_HTML;
  }

  function addLog(message) {
    const now = new Date();
    const ts =
      now.toTimeString().split(" ")[0] + "." + String(now.getMilliseconds()).padStart(3, "0");
    const entry = `[${ts}] ${message}`;
    debugLogs.push(entry);
    if (debugLogs.length > 200) debugLogs.shift();
    console.debug("[SmartEditor]", message);
    renderLogsPanel();
  }

  // Query DOM elements
  const mainSurface = host.querySelector("#main-surface");
  const mirrorEl = host.querySelector("#editor-mirror");
  const textareaEl = host.querySelector("#editor-textarea");
  const chipsContainer = host.querySelector("#chips-container");
  const unitDropdown = host.querySelector("#unit-select-dropdown");
  const angleSwitchBtn = host.querySelector("#angle-switch-btn");

  const settingsTriggerBtn = host.querySelector("#settings-trigger-btn");
  const settingsBackdrop = host.querySelector("#settings-backdrop");
  const settingsModal = host.querySelector("#settings-modal");
  const settingsCloseBtn = host.querySelector("#settings-close-btn");

  const prefMetricBtn = host.querySelector("#pref-metric-btn");
  const prefImperialBtn = host.querySelector("#pref-imperial-btn");
  const angleRadBtn = host.querySelector("#angle-rad-btn");
  const angleDegBtn = host.querySelector("#angle-deg-btn");
  const themeLightBtn = host.querySelector("#theme-light-btn");
  const themeDarkBtn = host.querySelector("#theme-dark-btn");
  const fontSizeSlider = host.querySelector("#font-size-slider");
  const fontSizeValue = host.querySelector("#font-size-value");
  const inlineToggleBtn = host.querySelector("#inline-toggle-btn");

  const devToggleHeader = host.querySelector("#dev-toggle-header");
  const devChevron = host.querySelector("#dev-chevron");
  const devContent = host.querySelector("#dev-content");
  const devTabLogs = host.querySelector("#dev-tab-logs");
  const devTabUnits = host.querySelector("#dev-tab-units");
  const devPanelLogs = host.querySelector("#dev-panel-logs");
  const devPanelUnits = host.querySelector("#dev-panel-units");
  const devLogsBox = host.querySelector("#dev-logs-box");
  const devLogsCount = host.querySelector("#dev-logs-count");
  const devClearLogsBtn = host.querySelector("#dev-clear-logs-btn");
  const devUnitsTextarea = host.querySelector("#dev-units-textarea");
  const devUnitsStatus = host.querySelector("#dev-units-status");
  const devResetUnitsBtn = host.querySelector("#dev-reset-units-btn");
  const devApplyUnitsBtn = host.querySelector("#dev-apply-units-btn");

  devUnitsTextarea.value = unitEngine.getUnitsJson();
  devUnitsStatus.textContent = `${unitEngine.getUnits().length} units loaded`;

  function applySettingsToUI() {
    document.documentElement.setAttribute("data-theme", settings.theme);
    document.documentElement.style.setProperty("--editor-font-size", `${settings.fontSize}px`);

    angleSwitchBtn.textContent = settings.angleMode;

    prefMetricBtn.classList.toggle("active", settings.unitPreference === "metric");
    prefImperialBtn.classList.toggle("active", settings.unitPreference === "imperial");

    angleRadBtn.classList.toggle("active", settings.angleMode === "rad");
    angleDegBtn.classList.toggle("active", settings.angleMode === "deg");

    themeLightBtn.classList.toggle("active", settings.theme === "light");
    themeDarkBtn.classList.toggle("active", settings.theme === "dark");

    fontSizeSlider.value = String(settings.fontSize);
    fontSizeValue.textContent = `${settings.fontSize}px`;

    inlineToggleBtn.classList.toggle("on", settings.inlineEnabled);
    inlineToggleBtn.setAttribute("aria-checked", String(settings.inlineEnabled));

    saveSettingsToStorage(settings);
  }

  function renderLogsPanel() {
    if (!devLogsBox) return;
    devLogsBox.textContent = debugLogs.join("\n");
    devLogsBox.scrollTop = devLogsBox.scrollHeight;
    devLogsCount.textContent = `${debugLogs.length} events`;
  }

  function syncScroll() {
    mirrorEl.scrollTop = textareaEl.scrollTop;
    mirrorEl.scrollLeft = textareaEl.scrollLeft;
  }

  function renderMirror() {
    const text = textareaEl.value;
    const selStart = textareaEl.selectionStart;
    const selEnd = textareaEl.selectionEnd;

    const activeCand =
      currentResult &&
      currentResult.showInline &&
      settings.inlineEnabled &&
      selStart === selEnd
        ? currentResult.candidates[selectedIndex] || currentResult.candidates[0]
        : null;

    if (!activeCand) {
      let html = escapeHtml(text);
      if (text.endsWith("\n")) html += " ";
      mirrorEl.innerHTML = html;
      syncScroll();
      return;
    }

    const replaceBack = activeCand.replaceBack || 0;
    const safeReplaceStart = Math.max(0, selStart - replaceBack);
    const beforeText = text.slice(0, safeReplaceStart);
    const afterText = text.slice(selStart);

    // Requirement 1: Never truncate inline previews! Always use full insertText for inline preview.
    const fullInlineText = activeCand.insertText;
    const inPlaceReplacement =
      replaceBack > 0 ? fullInlineText.slice(0, replaceBack) : "";
    const ghostRemainder =
      replaceBack > 0 ? fullInlineText.slice(replaceBack) : fullInlineText;

    let html = escapeHtml(beforeText);
    if (inPlaceReplacement) {
      html += `<span class="inline-replaced">${escapeHtml(inPlaceReplacement)}</span>`;
    }
    if (ghostRemainder) {
      html += `<span class="inline-ghost">${escapeHtml(ghostRemainder)}</span>`;
    }
    html += escapeHtml(afterText);
    if (afterText.endsWith("\n") || (afterText === "" && text.endsWith("\n"))) {
      html += " ";
    }

    mirrorEl.innerHTML = html;
    syncScroll();
  }

  function renderBottomBar() {
    chipsContainer.innerHTML = "";

    if (!currentResult || currentResult.candidates.length === 0) {
      unitDropdown.style.display = "none";
      return;
    }

    currentResult.candidates.forEach((cand, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `suggestion-chip${idx === selectedIndex ? " active" : ""}`;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", String(idx === selectedIndex));

      const labelSpan = document.createElement("span");
      // Requirement 1: Only truncate with "..." on the bottom bar (cand.displayText)
      labelSpan.textContent = cand.displayText;
      btn.appendChild(labelSpan);

      if (currentResult?.angleDependent && cand.angleBadge) {
        const badge = document.createElement("span");
        badge.className = "chip-angle-badge";
        badge.textContent = cand.angleBadge;
        btn.appendChild(badge);
      }

      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        acceptCandidate(idx);
      });

      chipsContainer.appendChild(btn);
    });

    if (currentResult.compatibleUnits && currentResult.compatibleUnits.length > 0) {
      unitDropdown.style.display = "inline-block";
      unitDropdown.innerHTML = "";
      const activeSym =
        currentResult.candidates[selectedIndex]?.unit?.symbol ||
        currentResult.activeUnit?.symbol ||
        "";

      for (const u of currentResult.compatibleUnits) {
        const opt = document.createElement("option");
        opt.value = u.symbol;
        opt.textContent = `${u.symbol} (${u.unit})`;
        if (u.symbol === activeSym) {
          opt.selected = true;
        }
        unitDropdown.appendChild(opt);
      }
    } else {
      unitDropdown.style.display = "none";
    }
  }

  function evaluateCurrentState(source) {
    const text = textareaEl.value;
    const cursor = textareaEl.selectionStart;

    if (textareaEl.selectionStart !== textareaEl.selectionEnd) {
      currentResult = null;
      selectedIndex = 0;
      renderMirror();
      renderBottomBar();
      return;
    }

    const res = analyzeEditorAtCursor(text, cursor, {
      angleMode: settings.angleMode,
      unitPreference: settings.unitPreference,
      inlineEnabled: settings.inlineEnabled,
      unitEngine,
      overrideTargetUnit,
    });

    currentResult = res;
    if (!res || selectedIndex >= res.candidates.length) {
      selectedIndex = 0;
    }

    if (res?.debugInfo && source !== "cursor") {
      addLog(res.debugInfo);
    }

    renderMirror();
    renderBottomBar();
  }

  function replaceEditorRangeWithUndo(start, end, text) {
    isProgrammaticInsert = true;
    try {
      let actualStart = start;
      let actualText = text;
      // Use a non-collapsed selection when inserting at the caret so browser engines
      // never coalesce the autocompletion with preceding keystrokes in the native undo stack.
      if (actualStart === end && actualStart > 0) {
        actualStart = end - 1;
        actualText = textareaEl.value.slice(actualStart, end) + text;
      }

      textareaEl.focus();
      textareaEl.setSelectionRange(actualStart, end);

      const expectedValue =
        textareaEl.value.slice(0, actualStart) + actualText + textareaEl.value.slice(end);
      let inserted = false;
      try {
        if (typeof document.execCommand === "function") {
          inserted = document.execCommand("insertText", false, actualText);
        }
      } catch {
        inserted = false;
      }

      if (!inserted || textareaEl.value !== expectedValue) {
        if (typeof textareaEl.setRangeText === "function") {
          textareaEl.setRangeText(actualText, actualStart, end, "end");
        } else {
          textareaEl.value = expectedValue;
        }
      }

      const newCursor = actualStart + actualText.length;
      textareaEl.blur();
      textareaEl.focus();
      textareaEl.setSelectionRange(newCursor, newCursor);
    } finally {
      isProgrammaticInsert = false;
    }
  }

  function acceptCandidate(index) {
    if (!currentResult || !currentResult.candidates[index]) return;
    const cand = currentResult.candidates[index];

    if (cand.angleBadge && cand.angleBadge !== settings.angleMode) {
      settings.angleMode = cand.angleBadge;
      applySettingsToUI();
      addLog(`Angle mode remembered as '${settings.angleMode}'`);
    }

    const cursor = textareaEl.selectionStart;
    const replaceBack = cand.replaceBack || 0;
    const replaceStart = Math.max(0, cursor - replaceBack);

    replaceEditorRangeWithUndo(replaceStart, cursor, cand.insertText);

    addLog(`Accepted completion "${cand.insertText}" (replaceBack=${replaceBack})`);

    overrideTargetUnit = null;
    selectedIndex = 0;
    evaluateCurrentState("accept");
  }

  // Textarea event listeners
  textareaEl.addEventListener("input", () => {
    if (isProgrammaticInsert) return;
    overrideTargetUnit = null;
    selectedIndex = 0;
    evaluateCurrentState("input");
  });

  textareaEl.addEventListener("scroll", () => {
    syncScroll();
  });

  textareaEl.addEventListener("click", () => {
    overrideTargetUnit = null;
    selectedIndex = 0;
    evaluateCurrentState("cursor");
  });

  textareaEl.addEventListener("keyup", (e) => {
    if (
      e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "Home" ||
      e.key === "End" ||
      e.key === "PageUp" ||
      e.key === "PageDown"
    ) {
      overrideTargetUnit = null;
      selectedIndex = 0;
      evaluateCurrentState("cursor");
    }
  });

  textareaEl.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey) {
      const keyLow = e.key.toLowerCase();
      const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || "");
      const isAltModifier =
        (isMac && e.ctrlKey && !e.metaKey) || (!isMac && e.metaKey && !e.ctrlKey);
      if (isAltModifier || !e.isTrusted) {
        if (keyLow === "z" && !e.shiftKey) {
          e.preventDefault();
          if (typeof document.execCommand === "function") {
            document.execCommand("undo");
          }
          return;
        }
        if ((keyLow === "z" && e.shiftKey) || (keyLow === "y" && !e.shiftKey)) {
          e.preventDefault();
          if (typeof document.execCommand === "function") {
            document.execCommand("redo");
          }
          return;
        }
      }
    }

    if (e.key === "Tab") {
      if (currentResult && currentResult.candidates.length > 0) {
        e.preventDefault();
        acceptCandidate(selectedIndex);
      }
      return;
    }

    if (e.key === "ArrowRight") {
      if (
        currentResult &&
        currentResult.candidates.length > 1 &&
        selectedIndex < currentResult.candidates.length - 1
      ) {
        e.preventDefault();
        selectedIndex++;
        const newlySelected = currentResult.candidates[selectedIndex];
        if (newlySelected?.angleBadge) {
          settings.angleMode = newlySelected.angleBadge;
          applySettingsToUI();
        }
        renderMirror();
        renderBottomBar();
        return;
      }
      setTimeout(() => {
        overrideTargetUnit = null;
        selectedIndex = 0;
        evaluateCurrentState("cursor");
      }, 0);
      return;
    }

    if (e.key === "ArrowLeft") {
      if (
        currentResult &&
        currentResult.candidates.length > 1 &&
        selectedIndex > 0
      ) {
        e.preventDefault();
        selectedIndex--;
        const newlySelected = currentResult.candidates[selectedIndex];
        if (newlySelected?.angleBadge) {
          settings.angleMode = newlySelected.angleBadge;
          applySettingsToUI();
        }
        renderMirror();
        renderBottomBar();
        return;
      }
      setTimeout(() => {
        overrideTargetUnit = null;
        selectedIndex = 0;
        evaluateCurrentState("cursor");
      }, 0);
      return;
    }
  });

  unitDropdown.addEventListener("change", () => {
    const chosenSym = unitDropdown.value;
    const unitDef = unitEngine.lookupExactUnit(chosenSym);
    if (!unitDef) return;

    const cursor = textareaEl.selectionStart;
    const lastNewline = textareaEl.value.lastIndexOf("\n", cursor - 1);
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
    const beforeCursor = textareaEl.value.slice(lineStart, cursor);

    const convMatch = beforeCursor.match(
      /^(.*?(?:\bto\b|->)\s*)([a-zA-ZµμΩ°*^0-9/\s-]+?)(\s*=?\s*)$/
    );
    if (convMatch) {
      const targetStart = lineStart + convMatch[1].length;
      const targetEnd = cursor - convMatch[3].length;
      replaceEditorRangeWithUndo(targetStart, targetEnd, unitDef.symbol);
      const newCursor = targetStart + unitDef.symbol.length + convMatch[3].length;
      textareaEl.setSelectionRange(newCursor, newCursor);
    }

    overrideTargetUnit = unitDef;
    selectedIndex = 0;
    addLog(`Switched target unit to '${unitDef.symbol}' (${unitDef.unit})`);
    evaluateCurrentState("unit-dropdown");
    textareaEl.focus();
  });

  angleSwitchBtn.addEventListener("click", () => {
    settings.angleMode = settings.angleMode === "rad" ? "deg" : "rad";
    applySettingsToUI();
    addLog(`Angle mode switched to '${settings.angleMode}'`);
    evaluateCurrentState("angle-switch");
    textareaEl.focus();
  });

  function openSettings() {
    isSettingsOpen = true;
    mainSurface.classList.add("blurred");
    settingsBackdrop.classList.remove("hidden");
  }

  function applyUnitsJsonFromTextarea(silentIfUnchanged = false) {
    const currentJson = unitEngine.getUnitsJson();
    if (silentIfUnchanged && devUnitsTextarea.value.trim() === currentJson.trim()) {
      return true;
    }
    const res = unitEngine.setUnitsFromJson(devUnitsTextarea.value);
    if (res.ok) {
      devUnitsStatus.textContent = `Saved (${res.count} units active)`;
      devUnitsStatus.className = "dev-status-msg success";
      addLog(`Updated unit engine JSON (${res.count} units)`);
      evaluateCurrentState("units-json");
      return true;
    } else {
      devUnitsStatus.textContent = res.error || "Invalid JSON";
      devUnitsStatus.className = "dev-status-msg error";
      addLog(`Unit JSON error: ${res.error}`);
      return false;
    }
  }

  function closeAndSaveSettings() {
    if (!isSettingsOpen) return;
    applyUnitsJsonFromTextarea(true);
    saveSettingsToStorage(settings);
    isSettingsOpen = false;
    mainSurface.classList.remove("blurred");
    settingsBackdrop.classList.add("hidden");
    evaluateCurrentState("settings-close");
    textareaEl.focus();
  }

  settingsTriggerBtn.addEventListener("click", () => {
    if (isSettingsOpen) {
      closeAndSaveSettings();
    } else {
      openSettings();
    }
  });

  settingsCloseBtn.addEventListener("click", () => {
    closeAndSaveSettings();
  });

  settingsBackdrop.addEventListener("mousedown", (e) => {
    if (e.target === settingsBackdrop) {
      closeAndSaveSettings();
    }
  });

  settingsModal.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });

  prefMetricBtn.addEventListener("click", () => {
    settings.unitPreference = "metric";
    overrideTargetUnit = null;
    applySettingsToUI();
    addLog("Unit preference set to Metric");
    evaluateCurrentState("settings");
  });

  prefImperialBtn.addEventListener("click", () => {
    settings.unitPreference = "imperial";
    overrideTargetUnit = null;
    applySettingsToUI();
    addLog("Unit preference set to Imperial");
    evaluateCurrentState("settings");
  });

  angleRadBtn.addEventListener("click", () => {
    settings.angleMode = "rad";
    applySettingsToUI();
    addLog("Angle mode set to Radians");
    evaluateCurrentState("settings");
  });

  angleDegBtn.addEventListener("click", () => {
    settings.angleMode = "deg";
    applySettingsToUI();
    addLog("Angle mode set to Degrees");
    evaluateCurrentState("settings");
  });

  themeLightBtn.addEventListener("click", () => {
    settings.theme = "light";
    applySettingsToUI();
    addLog("Theme set to Light");
  });

  themeDarkBtn.addEventListener("click", () => {
    settings.theme = "dark";
    applySettingsToUI();
    addLog("Theme set to Dark");
  });

  fontSizeSlider.addEventListener("input", () => {
    settings.fontSize = parseInt(fontSizeSlider.value, 10) || 16;
    applySettingsToUI();
    renderMirror();
  });

  inlineToggleBtn.addEventListener("click", () => {
    settings.inlineEnabled = !settings.inlineEnabled;
    applySettingsToUI();
    addLog(`Inline suggestions ${settings.inlineEnabled ? "enabled" : "disabled"}`);
    evaluateCurrentState("settings");
  });

  devToggleHeader.addEventListener("click", () => {
    isDevOpen = !isDevOpen;
    devContent.classList.toggle("hidden", !isDevOpen);
    devChevron.textContent = isDevOpen ? "▾" : "▸";
  });

  devTabLogs.addEventListener("click", () => {
    devTabLogs.classList.add("active");
    devTabUnits.classList.remove("active");
    devPanelLogs.style.display = "block";
    devPanelUnits.style.display = "none";
  });

  devTabUnits.addEventListener("click", () => {
    devTabUnits.classList.add("active");
    devTabLogs.classList.remove("active");
    devPanelUnits.style.display = "block";
    devPanelLogs.style.display = "none";
  });

  devClearLogsBtn.addEventListener("click", () => {
    debugLogs.length = 0;
    renderLogsPanel();
  });

  devApplyUnitsBtn.addEventListener("click", () => {
    applyUnitsJsonFromTextarea(false);
  });

  devResetUnitsBtn.addEventListener("click", () => {
    unitEngine.setUnits(rawUnitsData);
    devUnitsTextarea.value = unitEngine.getUnitsJson();
    devUnitsStatus.textContent = `Reset to default (${unitEngine.getUnits().length} units)`;
    devUnitsStatus.className = "dev-status-msg";
    addLog("Reset units JSON to default list");
    evaluateCurrentState("units-reset");
  });

  const onWindowKeyDown = (e) => {
    if (e.key === "Escape" && isSettingsOpen) {
      closeAndSaveSettings();
    }
  };
  window.addEventListener("keydown", onWindowKeyDown);

  applySettingsToUI();
  renderMirror();
  renderBottomBar();
  addLog("Smart Text Editor initialized");
  textareaEl.focus();

  return () => {
    window.removeEventListener("keydown", onWindowKeyDown);
  };
}
