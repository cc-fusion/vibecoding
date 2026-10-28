// ── Smart Text Editor — application body (plain HTML/JS/CSS, no framework) ──
import { createIcons, Settings, X, ChevronDown, Check, Trash2, RotateCcw, Terminal, Braces, Sun, Moon } from "lucide";
import { getSuggestions } from "./suggest.js";
import { UnitEngine, DEFAULT_UNITS, validateUnitDefs } from "./units.js";

const ICONS = { Settings, X, ChevronDown, Check, Trash2, RotateCcw, Terminal, Braces, Sun, Moon };
const LS = { settings: "ste:settings", doc: "ste:doc", units: "ste:units" };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function loadJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}

function unitsToJSON(defs) {
  const rows = Object.entries(defs).map(([sym, d]) => `  ${JSON.stringify(sym)}: ${JSON.stringify(d)}`);
  return "{\n" + rows.join(",\n") + "\n}";
}

export function mountSmartEditor(root) {
  // ── state ──────────────────────────────────────────────────────────────────
  const settings = Object.assign(
    { system: "metric", angle: "rad", theme: "light", fontSize: 15, inline: true, dev: false },
    loadJSON(LS.settings, {})
  );
  let engine = new UnitEngine();
  let engineVersion = 0;
  const savedUnits = loadJSON(LS.units, null);
  if (savedUnits) { try { engine = validateUnitDefs(savedUnits).eng; engineVersion++; } catch { /* fall back */ } }

  let sug = { candidates: [], dropdown: null, key: "" };
  let selected = 0;
  let dismissed = false;
  let override = null;
  let panelOpen = false;
  let lastSig = "";
  let logs = [];
  let docTimer = 0;

  // ── DOM ────────────────────────────────────────────────────────────────────
  root.classList.add("ste-root");
  root.innerHTML = `
    <div class="ste-editor">
      <div class="ste-mirror ste-surface" aria-hidden="true"></div>
      <textarea class="ste-input ste-surface" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="soft" aria-label="Smart text editor"></textarea>
    </div>
    <button class="ste-gear" title="Settings" aria-label="Settings"><i data-lucide="settings"></i></button>
    <div class="ste-bar">
      <div class="ste-chips" role="listbox" aria-label="Completions"></div>
      <div class="ste-unit" hidden>
        <button class="ste-unit-btn" title="Convert to unit" aria-label="Convert to unit"><span class="ste-unit-active"></span><i data-lucide="chevron-down"></i></button>
        <div class="ste-unit-pop" hidden></div>
      </div>
      <div class="ste-angle" role="group" aria-label="Angle mode">
        <button data-angle="rad" title="Radians">rad</button><button data-angle="deg" title="Degrees">deg</button>
      </div>
    </div>
    <div class="ste-overlay"></div>
    <div class="ste-panel" role="dialog" aria-label="Settings">
      <div class="ste-panel-head">
        <h2>Settings</h2>
        <button class="ste-x" data-act="close" aria-label="Close settings"><i data-lucide="x"></i></button>
      </div>
      <div class="ste-row">
        <div><div class="ste-row-label">Units</div><div class="ste-row-sub">Preferred suggestion system</div></div>
        <div class="ste-seg" data-key="system">
          <button data-val="metric">Metric</button><button data-val="imperial">Imperial</button>
        </div>
      </div>
      <div class="ste-row">
        <div><div class="ste-row-label">Angles</div><div class="ste-row-sub">For sin, cos, tan…</div></div>
        <div class="ste-seg" data-key="angle">
          <button data-val="rad">Radians</button><button data-val="deg">Degrees</button>
        </div>
      </div>
      <div class="ste-row">
        <div class="ste-row-label">Theme</div>
        <div class="ste-seg" data-key="theme">
          <button data-val="light"><i data-lucide="sun"></i>Light</button><button data-val="dark"><i data-lucide="moon"></i>Dark</button>
        </div>
      </div>
      <div class="ste-row">
        <div class="ste-row-label">Font size</div>
        <div class="ste-range">
          <input type="range" min="12" max="24" step="1" data-key="fontSize" aria-label="Font size" />
          <span class="val"></span>
        </div>
      </div>
      <div class="ste-row">
        <div><div class="ste-row-label">Inline suggestions</div><div class="ste-row-sub">Ghost text at the caret</div></div>
        <label class="ste-switch"><input type="checkbox" data-key="inline" /><span class="track"></span></label>
      </div>
      <div class="ste-row">
        <div><div class="ste-row-label">Developer</div><div class="ste-row-sub">Console logs &amp; unit definitions</div></div>
        <label class="ste-switch"><input type="checkbox" data-key="dev" /><span class="track"></span></label>
      </div>
      <div class="ste-dev" hidden>
        <div class="ste-dev-head">
          <span><i data-lucide="terminal"></i>Console</span>
          <button class="ste-mini-btn" data-act="clear-log"><i data-lucide="trash-2"></i>Clear</button>
        </div>
        <div class="ste-log"></div>
        <div class="ste-dev-head">
          <span><i data-lucide="braces"></i>Units · JSON</span>
          <button class="ste-mini-btn" data-act="reset-units"><i data-lucide="rotate-ccw"></i>Reset</button>
        </div>
        <textarea class="ste-json" spellcheck="false" aria-label="Unit definitions JSON"></textarea>
        <div class="ste-json-actions">
          <button class="ste-mini-btn is-primary" data-act="apply-units"><i data-lucide="check"></i>Apply</button>
          <span class="ste-json-msg"></span>
        </div>
      </div>
    </div>
  `;

  const $ = (s) => root.querySelector(s);
  const ta = $(".ste-input");
  const mirror = $(".ste-mirror");
  const chipsEl = $(".ste-chips");
  const unitWrap = $(".ste-unit");
  const unitBtn = $(".ste-unit-btn");
  const unitActive = $(".ste-unit-active");
  const unitPop = $(".ste-unit-pop");
  const angleEl = $(".ste-angle");
  const gear = $(".ste-gear");
  const overlay = $(".ste-overlay");
  const panel = $(".ste-panel");
  const devEl = $(".ste-dev");
  const logEl = $(".ste-log");
  const jsonEl = $(".ste-json");
  const jsonMsg = $(".ste-json-msg");

  ta.value = loadJSON(LS.doc, "");
  createIcons({ icons: ICONS });

  // ── debug log ──────────────────────────────────────────────────────────────
  function dbg(msg, data) {
    if (!settings.dev) return;
    const t = new Date();
    const time = t.toTimeString().slice(0, 8) + "." + String(t.getMilliseconds()).padStart(3, "0");
    let d = "";
    if (data !== undefined) {
      d = typeof data === "string" ? data : JSON.stringify(data);
      if (d && d.length > 180) d = d.slice(0, 177) + "...";
    }
    logs.push({ time, msg, data: d });
    if (logs.length > 300) logs = logs.slice(-300);
    try { console.debug("[smart-editor]", msg, data ?? ""); } catch { /* noop */ }
    if (panelOpen) renderLogs();
  }
  function renderLogs() {
    logEl.innerHTML = logs.length
      ? logs.map((l) => `<div><span class="t">${l.time}</span>  <span class="m">${esc(l.msg)}</span>  ${esc(l.data)}</div>`).join("")
      : `<span class="empty">No events yet — type an expression in the editor.</span>`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  // ── persistence ────────────────────────────────────────────────────────────
  const saveSettings = () => { try { localStorage.setItem(LS.settings, JSON.stringify(settings)); } catch { /* noop */ } };
  const persistDoc = () => {
    clearTimeout(docTimer);
    docTimer = setTimeout(() => { try { localStorage.setItem(LS.doc, JSON.stringify(ta.value)); } catch { /* noop */ } }, 250);
  };

  // ── settings application ───────────────────────────────────────────────────
  function applySettings() {
    root.dataset.theme = settings.theme;
    root.style.setProperty("--ste-fs", settings.fontSize + "px");
    panel.querySelectorAll(".ste-seg").forEach((seg) => {
      const key = seg.dataset.key;
      seg.querySelectorAll("button").forEach((b) => b.classList.toggle("is-active", b.dataset.val === String(settings[key])));
    });
    const range = panel.querySelector('input[data-key="fontSize"]');
    range.value = settings.fontSize;
    panel.querySelector(".ste-range .val").textContent = settings.fontSize + "px";
    panel.querySelector('input[data-key="inline"]').checked = settings.inline;
    panel.querySelector('input[data-key="dev"]').checked = settings.dev;
    devEl.hidden = !settings.dev;
    angleEl.querySelectorAll("button").forEach((b) => b.classList.toggle("is-active", b.dataset.angle === settings.angle));
  }

  // ── suggestion lifecycle ───────────────────────────────────────────────────
  function recompute(force = false) {
    const sig = JSON.stringify([ta.value, ta.selectionStart, ta.selectionEnd, settings.angle, settings.system, engineVersion, override ? override.expr : null]);
    if (!force && sig === lastSig) return;
    lastSig = sig;
    dismissed = false;
    selected = 0;
    if (ta.selectionStart !== ta.selectionEnd) {
      sug = { candidates: [], dropdown: null, key: "" };
    } else {
      try {
        sug = getSuggestions(ta.value, ta.selectionStart, {
          engine, system: settings.system, angle: settings.angle, targetOverride: override, log: dbg,
        });
      } catch (e) {
        dbg("engine error", String(e && e.message));
        sug = { candidates: [], dropdown: null, key: "" };
      }
    }
    if (override && override.key !== sug.key) override = null;
    renderMirror();
    renderBar();
  }

  const activeCand = () =>
    !dismissed && sug.candidates.length && ta.selectionStart === ta.selectionEnd ? sug.candidates[selected] : null;

  function renderMirror() {
    const v = ta.value;
    const caret = ta.selectionStart;
    const cand = settings.inline ? activeCand() : null;
    mirror.replaceChildren();
    if (!v && !cand) {
      const ph = document.createElement("span");
      ph.className = "ste-placeholder";
      ph.textContent = "Type a calculation — 1 + 1, sin(30), 1 km to mi, 40oz…";
      mirror.appendChild(ph);
    } else if (cand) {
      const from = caret - cand.replaceBefore;
      mirror.appendChild(document.createTextNode(v.slice(0, from)));
      if (cand.replaceBefore > 0) {
        const rep = document.createElement("span");
        rep.className = "ste-replace";
        rep.textContent = v.slice(from, caret);
        mirror.appendChild(rep);
      }
      const gh = document.createElement("span");
      gh.className = "ste-ghost";
      gh.textContent = cand.insert;
      mirror.appendChild(gh);
      mirror.appendChild(document.createTextNode(v.slice(caret) + "\u200b"));
    } else {
      mirror.textContent = v + "\u200b";
    }
    syncScroll();
  }

  function syncScroll() {
    mirror.scrollTop = ta.scrollTop;
    mirror.scrollLeft = ta.scrollLeft;
  }

  function renderBar() {
    const show = !dismissed ? sug.candidates : [];
    chipsEl.innerHTML = show.map((c, i) =>
      `<button class="ste-chip${i === selected ? " is-selected" : ""}" data-i="${i}" role="option" aria-selected="${i === selected}">` +
      `${esc(c.label)}` +
      (c.badge ? `<span class="ste-chip-badge">${esc(c.badge)}</span>` : "") +
      (i === selected ? `<span class="ste-chip-kbd">Tab</span>` : "") +
      `</button>`
    ).join("");
    const dd = !dismissed && sug.dropdown && show.length ? sug.dropdown : null;
    unitWrap.hidden = !dd;
    if (dd) unitActive.textContent = dd.active;
    closeUnitPop();
  }

  // ── accepting ──────────────────────────────────────────────────────────────
  function accept(i) {
    const cand = sug.candidates[i];
    if (!cand) return;
    const caret = ta.selectionStart;
    const from = caret - cand.replaceBefore;
    ta.focus();
    ta.setSelectionRange(from, caret);
    let ok = false;
    try { ok = document.execCommand("insertText", false, cand.insert); } catch { ok = false; }
    if (!ok) ta.setRangeText(cand.insert, from, caret, "end");
    if (cand.setAngle) {
      settings.angle = cand.setAngle;
      saveSettings();
      applySettings();
    }
    dbg("accept", { insert: cand.insert, replaceBefore: cand.replaceBefore });
    override = null;
    persistDoc();
    recompute(true);
  }

  // ── editor events ──────────────────────────────────────────────────────────
  function onKeydown(e) {
    const n = dismissed ? 0 : sug.candidates.length;
    const collapsed = ta.selectionStart === ta.selectionEnd;
    if (e.key === "Tab" && n && collapsed) {
      e.preventDefault();
      accept(selected);
    } else if (e.key === "ArrowRight" && n && collapsed && selected < n - 1) {
      e.preventDefault();
      selected++;
      renderMirror(); renderBar(); scrollChip();
    } else if (e.key === "ArrowLeft" && n && collapsed && selected > 0) {
      e.preventDefault();
      selected--;
      renderMirror(); renderBar(); scrollChip();
    } else if (e.key === "Escape" && n) {
      e.preventDefault();
      dismissed = true;
      renderMirror(); renderBar();
    }
    // Enter, Up, Down (and arrows at the ends) keep their ordinary behavior
  }
  function scrollChip() {
    const el = chipsEl.children[selected];
    if (el && el.scrollIntoView) el.scrollIntoView({ inline: "nearest", block: "nearest" });
  }

  const onInput = () => { persistDoc(); recompute(); };
  const onSelectChange = () => { if (document.activeElement === ta) recompute(); };
  const onScroll = () => syncScroll();

  ta.addEventListener("keydown", onKeydown);
  ta.addEventListener("input", onInput);
  ta.addEventListener("scroll", onScroll);
  document.addEventListener("selectionchange", onSelectChange);

  chipsEl.addEventListener("mousedown", (e) => e.preventDefault());
  chipsEl.addEventListener("click", (e) => {
    const chip = e.target.closest(".ste-chip");
    if (chip) accept(Number(chip.dataset.i));
  });

  angleEl.addEventListener("mousedown", (e) => e.preventDefault());
  angleEl.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-angle]");
    if (!b) return;
    settings.angle = b.dataset.angle;
    dbg("angle mode", settings.angle);
    saveSettings();
    applySettings();
    recompute(true);
  });

  // ── unit dropdown ──────────────────────────────────────────────────────────
  function openUnitPop() {
    const dd = sug.dropdown;
    if (!dd) return;
    unitPop.innerHTML = dd.options.map((o) =>
      `<button class="ste-unit-item${o.label === dd.active ? " is-active" : ""}" data-expr="${esc(o.expr)}">` +
      `<span class="sym">${esc(o.label)}</span><span class="name">${esc(o.name)}</span>` +
      (o.label === dd.active ? `<i data-lucide="check"></i>` : "") +
      `</button>`
    ).join("");
    createIcons({ icons: ICONS });
    unitPop.hidden = false;
    unitWrap.classList.add("is-open");
  }
  function closeUnitPop() {
    unitPop.hidden = true;
    unitWrap.classList.remove("is-open");
  }
  unitBtn.addEventListener("mousedown", (e) => e.preventDefault());
  unitBtn.addEventListener("click", () => (unitPop.hidden ? openUnitPop() : closeUnitPop()));
  unitPop.addEventListener("mousedown", (e) => e.preventDefault());
  unitPop.addEventListener("click", (e) => {
    const item = e.target.closest(".ste-unit-item");
    if (!item) return;
    override = { key: sug.key, expr: item.dataset.expr };
    dbg("unit target", override.expr);
    closeUnitPop();
    recompute(true);
  });
  const onDocMouseDown = (e) => {
    if (!unitPop.hidden && !unitWrap.contains(e.target)) closeUnitPop();
  };
  document.addEventListener("mousedown", onDocMouseDown);

  // ── settings panel ─────────────────────────────────────────────────────────
  function openPanel() {
    panelOpen = true;
    overlay.classList.add("is-open");
    panel.classList.add("is-open");
    if (settings.dev) {
      if (!jsonEl.value) jsonEl.value = unitsToJSON(engine.defs);
      renderLogs();
    }
  }
  function closePanel() {
    panelOpen = false;
    overlay.classList.remove("is-open");
    panel.classList.remove("is-open");
    saveSettings(); // clicking outside saves changes
    ta.focus();
  }
  gear.addEventListener("click", () => (panelOpen ? closePanel() : openPanel()));
  overlay.addEventListener("click", closePanel);

  panel.addEventListener("click", (e) => {
    const seg = e.target.closest(".ste-seg button");
    if (seg) {
      const key = seg.closest(".ste-seg").dataset.key;
      settings[key] = seg.dataset.val;
      dbg("setting", { [key]: settings[key] });
      saveSettings();
      applySettings();
      recompute(true);
      return;
    }
    const act = e.target.closest("[data-act]");
    if (!act) return;
    switch (act.dataset.act) {
      case "close": closePanel(); break;
      case "clear-log": logs = []; renderLogs(); break;
      case "reset-units":
        engine = new UnitEngine();
        engineVersion++;
        try { localStorage.removeItem(LS.units); } catch { /* noop */ }
        jsonEl.value = unitsToJSON(engine.defs);
        jsonMsg.textContent = "Defaults restored";
        jsonMsg.className = "ste-json-msg ok";
        dbg("units reset", "default table");
        recompute(true);
        break;
      case "apply-units":
        try {
          const { clean, eng } = validateUnitDefs(JSON.parse(jsonEl.value));
          engine = eng;
          engineVersion++;
          try { localStorage.setItem(LS.units, JSON.stringify(clean)); } catch { /* noop */ }
          jsonMsg.textContent = `Applied ${Object.keys(clean).length} units`;
          jsonMsg.className = "ste-json-msg ok";
          dbg("units applied", Object.keys(clean).length + " definitions");
          recompute(true);
        } catch (err) {
          jsonMsg.textContent = err.message || "Invalid JSON";
          jsonMsg.className = "ste-json-msg err";
          dbg("units error", String(err.message));
        }
        break;
    }
  });

  panel.addEventListener("input", (e) => {
    const key = e.target.dataset.key;
    if (!key) return;
    if (key === "fontSize") {
      settings.fontSize = Number(e.target.value);
      saveSettings();
      applySettings();
      renderMirror();
    } else if (key === "inline") {
      settings.inline = e.target.checked;
      dbg("setting", { inline: settings.inline });
      saveSettings();
      renderMirror();
    } else if (key === "dev") {
      settings.dev = e.target.checked;
      saveSettings();
      applySettings();
      if (settings.dev) {
        if (!jsonEl.value) jsonEl.value = unitsToJSON(engine.defs);
        renderLogs();
        dbg("developer mode", "enabled");
      }
    }
  });

  const onGlobalKey = (e) => {
    if (e.key === "Escape") {
      if (!unitPop.hidden) closeUnitPop();
      else if (panelOpen) closePanel();
    }
  };
  document.addEventListener("keydown", onGlobalKey);

  // ── boot ──────────────────────────────────────────────────────────────────
  applySettings();
  renderMirror();
  recompute(true);
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);

  return function dispose() {
    clearTimeout(docTimer);
    try { localStorage.setItem(LS.doc, JSON.stringify(ta.value)); } catch { /* noop */ }
    document.removeEventListener("selectionchange", onSelectChange);
    document.removeEventListener("mousedown", onDocMouseDown);
    document.removeEventListener("keydown", onGlobalKey);
    root.innerHTML = "";
    root.classList.remove("ste-root");
  };
}