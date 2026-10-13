// Civilization Micro — game controller: screens, turns, input, progression
import {
  G, SEL, bus, SQ3, TECH, newGame, loadSaveData, writeSave, clearSave, hasSave, loadMeta, saveMeta,
  resetMeta, loadSettings, saveSettings, reach, moveTo, attack, targetsFrom, foundCity, startBuild,
  setProduction, buyItem, setResearch, beginTurnUnits, processCivEconomy, checkVictory, updateVision,
  cityAt, unitsAt, log, civScore, setRel, researchable, generateMap, civResources,
} from './engine.js';
import { aiTurn, barbarianTurn, respond } from './ai.js';
import * as A from './audio.js';
import * as RN from './render.js';
import * as UI from './ui.js';
import { CIVS, LEGACY, MAX_TURN } from './data.js';

let root = null;
let teardown = [];
let rafId = 0;
let lastT = 0;
let alive = false;
let busBound = false;
let screen = 'title';
let meta = loadMeta();
let settings = loadSettings();
let cfg = { civ: 0, diff: 'monarch', size: 'standard', fog: true, barb: true, sci: true, cul: true, tutorial: true, seed: '' };
let lastOpts = null;
let titleWorld = null;
let titleCam = { x: 0, y: 0, z: 1 };
let pendingWar = -1;
let openCityId = null;
let pinch = 0;
const ptrs = new Map();
const keys = new Set();
let drag = null;

const $ = (s) => (root ? root.querySelector(s) : null);
const eraIdx = (civ) => civ.researched.reduce((a, id) => Math.max(a, TECH[id] ? TECH[id].era : 0), 0);
const warWithPlayer = () => !!G.civs && G.civs.some((c) => c.i > 0 && c.alive && G.rel[0] && G.rel[0][c.i] === 'war');
const toast = (m, k) => UI.toast(m, k);

/* ---------------- audio & settings ---------------- */

function ensureAudio() {
  A.initAudio();
  A.applyVolumes({ vol: settings.vol, music: settings.music, sfx: settings.sfx });
  A.startMusic();
}

function applySettings() {
  A.applyVolumes({ vol: settings.vol, music: settings.music, sfx: settings.sfx });
  RN.setRenderOptions({ shake: settings.shake, quality: settings.particles === 'high' ? 'high' : 'low' });
  saveSettings(settings);
}

function syncMusic() {
  if (G.civs && G.civs[0]) A.setMusicEra(eraIdx(G.civs[0]), warWithPlayer());
}

/* ---------------- tutorial ---------------- */

const TUT = [
  { text: 'Your <b>Settler 🧭</b> is ready. Click it and press <kbd>C</kbd> to found your capital on a good tile.', done: () => G.cities.some((c) => c.o === 0) },
  { text: 'Click your new city to <b>manage production</b>. Warriors defend, Settlers expand, Workers improve tiles.', done: () => !!G.tutFlags.prod },
  { text: 'Open <b>Research 🔬</b> (<kbd>T</kbd>) and pick a technology. Science accumulates every turn.', done: () => !!G.civs[0].researching },
  { text: 'Select your <b>Warrior</b> and click a <b>blue hex</b> to move. Red hexes are attacks; hover for details.', done: () => !!G.tutFlags.moved },
  { text: 'Press <kbd>Enter</kbd> to end the turn. Cities grow, borders expand with culture and AI rivals take their turns.', done: () => G.turn >= 2 },
  { text: 'You are on your way, leader! Open <b>☰ Menu → How to play</b> for controls and systems. Good luck!', done: () => !!G.tutDone, canNext: true },
];

function tutCurrent() {
  if (screen !== 'game' || !G.opts || !G.opts.tutorial || G.tutDone || !settings.hints) return null;
  const idx = TUT.findIndex((s) => !s.done());
  if (idx < 0) { G.tutDone = true; return null; }
  const s = TUT[idx];
  return { n: idx + 1, total: TUT.length, text: s.text, canNext: !!s.canNext };
}

/* ---------------- rendering helpers ---------------- */

function renderAll() {
  if (screen !== 'game' || !G.civs) return;
  UI.renderTop();
  UI.renderSide();
  UI.renderBottom();
  UI.renderLog();
  UI.renderTutorial(tutCurrent());
}

function clearSel() {
  SEL.kind = null; SEL.id = null; SEL.i = -1;
  SEL.moves = new Set();
  SEL.attacks = new Map();
}

function selectUnit(u, silent) {
  SEL.kind = 'unit'; SEL.id = u.id; SEL.i = u.i;
  const r = u.mp > 0 ? reach(u) : new Map();
  SEL.moves = new Set(r.keys());
  SEL.attacks = new Map();
  if (u.mp > 0) {
    for (const f of [u.i, ...r.keys()]) {
      for (const t of targetsFrom(u, f)) if (!SEL.attacks.has(t.j)) SEL.attacks.set(t.j, t.kind);
    }
  }
  if (!silent) A.sfx('select');
}

function selectCity(c) {
  SEL.kind = 'city'; SEL.id = c.id; SEL.i = c.i;
  SEL.moves = new Set(); SEL.attacks = new Map();
}

function selectTile(i) {
  SEL.kind = 'tile'; SEL.id = null; SEL.i = i;
  SEL.moves = new Set(); SEL.attacks = new Map();
}

function refreshSel() {
  if (SEL.kind === 'unit') {
    const u = G.units.find((x) => x.id === SEL.id && x.o === 0);
    if (!u) clearSel(); else selectUnit(u, true);
  } else if (SEL.kind === 'city') {
    if (!G.cities.find((x) => x.id === SEL.id)) clearSel();
  }
}

function centerCapital() {
  const cap = G.cities.find((c) => c.o === 0 && c.cap) || G.cities.find((c) => c.o === 0);
  if (cap) return RN.centerOn(cap.i);
  const u = G.units.find((x) => x.o === 0);
  if (u) RN.centerOn(u.i);
}

function nextUnit() {
  const list = G.units.filter((u) => u.o === 0 && u.mp > 0 && !u.fort && !(u.type === 'worker' && u.job));
  if (!list.length) { toast('No idle units — nice work!', 'good'); clearSel(); renderAll(); return; }
  const idx = list.findIndex((u) => u.id === SEL.id);
  const n = list[(idx + 1) % list.length];
  selectUnit(n);
  RN.centerOn(n.i);
  renderAll();
}

/* ---------------- player actions ---------------- */

function onMapClick(i) {
  if (screen !== 'game' || G.over || UI.isModalOpen() || i < 0) return;
  const u = SEL.kind === 'unit' ? G.units.find((x) => x.id === SEL.id && x.o === 0) : null;
  const own = unitsAt(i).find((v) => v.o === 0);
  if (own) { selectUnit(own); renderAll(); return; }
  if (u) {
    if (SEL.moves.has(i)) return doMove(u, i);
    if (SEL.attacks.has(i)) return doAttack(u, i);
  }
  const c = cityAt(i);
  if (c && c.o === 0) selectCity(c);
  else selectTile(i);
  renderAll();
}

function doMove(u, i) {
  if (!moveTo(u, i)) { toast('Cannot move there.', 'bad'); return; }
  G.tutFlags.moved = true;
  A.sfx('move');
  refreshSel();
  renderAll();
}

function doAttack(u, j) {
  const inRange = targetsFrom(u, u.i).some((t) => t.j === j);
  if (!inRange) {
    const r = reach(u);
    let best = -1, bc = Infinity;
    for (const [to, c] of r) {
      if (to !== u.i && c < bc && c < u.mp && targetsFrom(u, to).some((t) => t.j === j)) { best = to; bc = c; }
    }
    if (best < 0) { toast('No path to that target this turn.', 'bad'); return; }
    moveTo(u, best);
    G.tutFlags.moved = true;
  }
  const res = attack(u, j);
  if (!res) { toast('That unit cannot attack now.', 'bad'); return; }
  refreshSel();
  renderAll();
}

function fortify(u) {
  u.fort = true; u.mp = 0; u.busy = true;
  A.sfx('click');
  nextUnit();
}

function skip(u) {
  u.mp = 0;
  nextUnit();
}

function found(u) {
  const err = foundCity(u);
  if (err) { toast(err, 'bad'); return; }
  clearSel();
  RN.centerOn(u.i);
  renderAll();
}

function openCity(cid) {
  const c = G.cities.find((x) => x.id === cid && x.o === 0);
  if (!c) return;
  openCityId = c.id;
  G.tutFlags.opened = true;
  selectCity(c);
  UI.modalCity(c);
  renderAll();
}

function refreshCityModal() {
  const c = openCityId ? G.cities.find((x) => x.id === openCityId) : null;
  if (c && UI.isModalOpen()) UI.modalCity(c);
  else openCityId = null;
}

function diplo(kind, ci) {
  const o = G.civs[ci];
  if (!o || !o.alive) return;
  const P = G.civs[0];
  const r = G.rel[0][ci];
  if (kind === 'peace') {
    if (r !== 'war') return;
    if (respond('peace', ci)) { setRel(0, ci, 'peace'); o.op += 6; toast(`${o.name} accepts peace.`, 'good'); A.sfx('deal'); log(`${o.name} accepts peace with you.`, 'good'); }
    else { o.op -= 2; toast(`${o.name} rejects peace.`, 'bad'); }
  } else if (kind === 'ally') {
    if (r !== 'peace') return;
    if (respond('ally', ci)) { setRel(0, ci, 'ally'); o.op += 6; toast(`${o.name} forms an alliance!`, 'good'); A.sfx('deal'); log(`Alliance with ${o.name}.`, 'good'); }
    else { o.op -= 3; toast(`${o.name} is not ready for an alliance.`, 'bad'); }
  } else if (kind === 'trade') {
    if (r === 'war') return;
    if (G.deals.some((d) => (d.a === 0 && d.b === ci) || (d.a === ci && d.b === 0))) { toast('Already trading.', ''); return; }
    if (P.gold < 15) { toast('You need 15 gold for a trade deal.', 'bad'); return; }
    if (!respond('trade', ci)) { toast(`${o.name} refuses to trade.`, 'bad'); return; }
    P.gold -= 15;
    G.deals.push({ a: 0, b: ci, t: 12 });
    o.op += 2;
    toast('Trade deal signed: +3 gold per turn for 12 turns.', 'good');
    A.sfx('coin');
  } else if (kind === 'war') {
    if (pendingWar !== ci) { pendingWar = ci; toast(`Press "Declare war" again to confirm against ${o.name}.`, 'bad'); return; }
    pendingWar = -1;
    setRel(0, ci, 'war');
    o.op -= 30;
    G.deals = G.deals.filter((d) => d.a !== ci && d.b !== ci);
    log(`You declared war on ${o.name}!`, 'bad');
    A.sfx('war');
  }
  UI.modalDiplo();
  renderAll();
  syncMusic();
}

function endTurn() {
  if (screen !== 'game' || !G.civs || G.over || UI.isModalOpen()) return;
  A.sfx('turn');
  processCivEconomy(0);
  for (const c of G.civs) {
    if (c.i === 0 || !c.alive) continue;
    aiTurn(c.i);
    processCivEconomy(c.i);
  }
  barbarianTurn();
  G.deals.forEach((d) => { d.t--; });
  G.deals = G.deals.filter((d) => d.t > 0 && G.civs[d.a].alive && G.civs[d.b].alive);
  G.turn++;
  beginTurnUnits();
  updateVision();
  const res = checkVictory();
  if (res) { onGameEnd(res); return; }
  writeSave();
  UI.turnBanner(`Turn ${G.turn}`);
  if (!G.civs[0].researching) toast('Research is idle — press T to choose a technology.', 'bad');
  syncMusic();
  refreshSel();
  renderAll();
  RN.drawMinimap();
}

function onGameEnd(res) {
  let earned = 0;
  if (!G.metaCounted) {
    G.metaCounted = true;
    meta.games++;
    if (res.win) meta.wins++;
    earned = Math.max(1, Math.floor(G.turn / 12)) + (res.win ? 5 : 0) + G.stats.wonders * 2;
    meta.lp += earned;
    const lt = meta.lifetime;
    lt.kills += G.stats.kills;
    lt.cities += G.stats.founded;
    lt.wonders += G.stats.wonders;
    lt.techs += G.stats.techs;
    lt.turns += G.turn;
    meta.best = Math.max(meta.best, civScore(0));
    saveMeta(meta);
  }
  clearSave();
  if (res.win) A.sfx('victory'); else A.sfx('defeat');
  UI.modalResult(res, meta, earned, true);
  renderAll();
}

function startGame(o) {
  ensureAudio();
  lastOpts = { ...o };
  pendingWar = -1;
  openCityId = null;
  newGame({ ...o, civ: CIVS[Number(o.civ) || 0].id, perks: meta.perks, seed: o.seed ? Number(o.seed) : undefined });
  G.metaCounted = false;
  G.tutFlags = { prod: false, moved: false, opened: false };
  G.tutDone = false;
  clearSel();
  enterGame();
  const s = G.units.find((u) => u.o === 0 && u.type === 'settler');
  if (s) RN.centerOn(s.i, true);
  UI.turnBanner('Turn 1 — the age begins');
}

function enterGame() {
  screen = 'game';
  UI.showScreen('game');
  RN.resizeRender();
  if (!G.tutFlags) G.tutFlags = { prod: false, moved: false, opened: false };
  syncMusic();
  renderAll();
  RN.drawMinimap();
}

function continueSaved() {
  if (!loadSaveData()) { toast('No saved game found.', 'bad'); return false; }
  openCityId = null;
  clearSel();
  G.tutFlags = G.tutFlags || { prod: false, moved: false, opened: false };
  enterGame();
  centerCapital();
  toast('Game loaded.', 'good');
  return true;
}

function showTitle() {
  screen = 'title';
  clearSel();
  UI.closeModal();
  UI.showScreen('title');
  UI.renderTitle(meta, hasSave());
  A.setMusicEra(0, false);
}

function showSetup() {
  screen = 'setup';
  UI.showScreen('setup');
  if (meta.wins < CIVS[cfg.civ].unlock) cfg.civ = 0;
  UI.renderSetup(cfg, meta);
}

function quitToTitle() {
  if (screen === 'game' && G.civs && !G.over) writeSave();
  openCityId = null;
  showTitle();
}

/* ---------------- actions ---------------- */

function handleAct(act, d) {
  switch (act) {
    // title & setup
    case 'title-new': return showSetup();
    case 'title-continue': return continueSaved();
    case 'back-title': return showTitle();
    case 'pick-civ': cfg.civ = Number(d.i); return UI.renderSetup(cfg, meta);
    case 'pick-diff': cfg.diff = d.k; return UI.renderSetup(cfg, meta);
    case 'pick-size': cfg.size = d.k; return UI.renderSetup(cfg, meta);
    case 'toggle-mod': cfg[d.k] = !cfg[d.k]; return UI.renderSetup(cfg, meta);
    case 'reseed': cfg.seed = String(Math.floor(Math.random() * 999999)); return UI.renderSetup(cfg, meta);
    case 'start-game': return startGame(cfg);

    // menus
    case 'open-legacy': return UI.modalLegacy(meta);
    case 'open-stats': return UI.modalStats('Statistics', meta, screen === 'game' && !!G.civs);
    case 'open-help': return UI.modalHelp('basics');
    case 'help-tab': return UI.modalHelp(d.tab);
    case 'open-settings': return UI.modalSettings(settings);
    case 'open-pause': return UI.modalPause(hasSave(), screen === 'game');
    case 'resume': return UI.closeModal();
    case 'close-modal': return UI.closeModal();
    case 'save': {
      const ok = writeSave();
      return toast(ok ? 'Game saved.' : 'Could not save (storage unavailable).', ok ? 'good' : 'bad');
    }
    case 'load': {
      UI.closeModal();
      return continueSaved();
    }
    case 'quit': UI.closeModal(); return quitToTitle();
    case 'continue':
      G.continued = true;
      G.over = false;
      G.result = null;
      UI.closeModal();
      log('You chose to continue your reign. The world awaits.', 'good');
      return renderAll();
    case 'new-same': {
      UI.closeModal();
      return startGame({ ...(lastOpts || cfg), seed: '' });
    }
    case 'buy-perk': {
      const p = LEGACY.find((x) => x.id === d.id);
      if (!p || meta.perks[p.id]) return;
      if (meta.lp < p.cost) return toast('Not enough Legacy Points.', 'bad');
      meta.lp -= p.cost;
      meta.perks[p.id] = true;
      saveMeta(meta);
      toast(`${p.name} unlocked!`, 'good');
      A.sfx('tech');
      return UI.modalLegacy(meta);
    }
    case 'toggle-set': {
      settings[d.key] = !settings[d.key];
      applySettings();
      return UI.modalSettings(settings);
    }
    case 'particles': {
      settings.particles = settings.particles === 'high' ? 'low' : 'high';
      applySettings();
      return UI.modalSettings(settings);
    }
    case 'reset-meta': {
      resetMeta();
      meta = loadMeta();
      toast('Legacy and statistics reset.', 'bad');
      if (screen === 'title') UI.renderTitle(meta, hasSave());
      return UI.modalSettings(settings);
    }

    // game
    case 'end-turn': return endTurn();
    case 'next-unit': return nextUnit();
    case 'center-capital': return centerCapital();
    case 'zoom-in': return RN.zoomBy(1.2);
    case 'zoom-out': return RN.zoomBy(1 / 1.2);
    case 'toggle-log': {
      const el = $('#log');
      if (el) el.classList.toggle('hidden');
      return renderAll();
    }
    case 'select-unit': {
      const u = G.units.find((x) => x.id === Number(d.uid) && x.o === 0);
      if (u) { selectUnit(u); RN.centerOn(u.i); renderAll(); }
      return;
    }
    case 'fortify': {
      const u = G.units.find((x) => x.id === SEL.id && x.o === 0);
      if (u) fortify(u);
      return;
    }
    case 'skip': {
      const u = G.units.find((x) => x.id === SEL.id && x.o === 0);
      if (u) skip(u);
      return;
    }
    case 'found': {
      const u = G.units.find((x) => x.id === SEL.id && x.o === 0);
      if (u && u.type === 'settler') found(u);
      return;
    }
    case 'build': {
      const u = G.units.find((x) => x.id === SEL.id && x.o === 0);
      if (!u || u.type !== 'worker') return;
      if (d.t) {
        const err = startBuild(u, d.t);
        if (err) return toast(err, 'bad');
        UI.closeModal();
        u.mp = 0;
        A.sfx('build');
        toast('Workers begin the improvement. Stay on the tile until it is done.', 'good');
        return nextUnit();
      }
      return UI.modalBuild(u);
    }
    case 'open-city': return openCity(Number(d.cid));
    case 'prod': {
      const c = G.cities.find((x) => x.id === Number(d.cid) && x.o === 0);
      if (!c) return;
      const err = setProduction(c, d.k, d.id);
      if (err) return toast(err, 'bad');
      G.tutFlags.prod = true;
      A.sfx('click');
      refreshCityModal();
      return renderAll();
    }
    case 'buy': {
      const c = G.cities.find((x) => x.id === Number(d.cid) && x.o === 0);
      if (!c) return;
      const err = buyItem(c);
      if (err) return toast(err, 'bad');
      toast(`Purchased in ${c.name}.`, 'good');
      refreshCityModal();
      return renderAll();
    }
    case 'research': {
      const P = G.civs[0];
      const err = setResearch(P, d.id);
      if (err) return toast(err, 'bad');
      toast(`Research started: ${TECH[d.id].name}`, 'good');
      A.sfx('click');
      UI.modalTech();
      return renderAll();
    }
    case 'dip': return diplo(d.kind, Number(d.ci));
    case 'tut-skip':
    case 'tut-next':
      G.tutDone = true;
      return renderAll();
    default:
      return;
  }
}

/* ---------------- input ---------------- */

function onKey(e) {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT') { if (e.key === 'Escape') e.target.blur(); return; }
  const k = e.key.toLowerCase();
  if (screen !== 'game') {
    if (k === 'escape' && UI.isModalOpen()) UI.closeModal();
    return;
  }
  if (UI.isModalOpen()) {
    if (k === 'escape') UI.closeModal();
    return;
  }
  if (k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright') {
    keys.add(k);
    e.preventDefault();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  switch (k) {
    case 'escape': return UI.modalPause(hasSave(), true);
    case 'enter': e.preventDefault(); return endTurn();
    case ' ': e.preventDefault(); return nextUnit();
    case '+': case '=': return RN.zoomBy(1.15);
    case '-': case '_': return RN.zoomBy(1 / 1.15);
    case 'home': e.preventDefault(); return centerCapital();
    case 'f': { const u = G.units.find((x) => x.id === SEL.id && x.o === 0); if (u) fortify(u); return; }
    case 's': { const u = G.units.find((x) => x.id === SEL.id && x.o === 0); if (u) skip(u); return; }
    case 'c': { const u = G.units.find((x) => x.id === SEL.id && x.o === 0); if (u && u.type === 'settler') found(u); return; }
    case 'b': { const u = G.units.find((x) => x.id === SEL.id && x.o === 0); if (u && u.type === 'worker') UI.modalBuild(u); return; }
    case 't': return UI.modalTech();
    case 'd': return UI.modalDiplo();
    case 'l': { const el = $('#log'); if (el) el.classList.toggle('hidden'); return renderAll(); }
    case 'm': { settings.music = !settings.music; settings.sfx = settings.music; applySettings(); toast(settings.music ? 'Sound on' : 'Sound muted', ''); return; }
    case '?': case 'h': return UI.modalHelp('basics');
    default: return;
  }
}

function bindEvents() {
  const on = (target, ev, fn, opts) => {
    target.addEventListener(ev, fn, opts);
    teardown.push(() => target.removeEventListener(ev, fn, opts));
  };
  on(root, 'click', (e) => {
    const t = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t) return;
    ensureAudio();
    if (t.tagName === 'BUTTON' && !t.disabled) { A.sfx('click'); t.blur(); }
    handleAct(t.dataset.act, t.dataset);
  });
  on(root, 'input', (e) => {
    const t = e.target;
    if (!t || !t.dataset) return;
    if (t.dataset.set === 'vol') {
      settings.vol = Number(t.value);
      applySettings();
      const b = t.parentNode && t.parentNode.querySelector('b');
      if (b) b.textContent = Math.round(settings.vol * 100) + '%';
    }
    if (t.id === 'seed') cfg.seed = t.value.replace(/\D/g, '').slice(0, 9);
  });

  const cv = $('#map');
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  on(cv, 'pointerdown', (e) => {
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const [x, y] = pos(e);
    ptrs.set(e.pointerId, { x, y });
    drag = { x, y, sx: x, sy: y, moved: false, btn: e.button };
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
      drag.moved = true;
    }
  });
  on(cv, 'pointermove', (e) => {
    const [x, y] = pos(e);
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x, y });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0 && d > 0) RN.zoomBy(d / pinch);
      pinch = d;
      return;
    }
    if (drag && e.buttons) {
      if (Math.hypot(x - drag.sx, y - drag.sy) > 6) drag.moved = true;
      if (drag.moved) RN.panBy(-(x - drag.x), -(y - drag.y));
      drag.x = x; drag.y = y;
    }
    if (e.pointerType === 'mouse' && screen === 'game') RN.setHover(RN.pickTile(x, y));
  });
  const endPtr = (e) => {
    const [x, y] = pos(e);
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = 0;
    if (drag && !drag.moved && ptrs.size === 0 && screen === 'game') {
      if (e.type === 'pointerup' && e.button === 2) { clearSel(); renderAll(); }
      else if (e.type === 'pointerup') onMapClick(RN.pickTile(x, y));
    }
    if (ptrs.size === 0) drag = null;
  };
  on(cv, 'pointerup', endPtr);
  on(cv, 'pointercancel', (e) => { ptrs.delete(e.pointerId); if (ptrs.size === 0) drag = null; });
  on(cv, 'pointerleave', () => RN.setHover(-1));
  on(cv, 'wheel', (e) => { e.preventDefault(); RN.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
  on(cv, 'contextmenu', (e) => e.preventDefault());

  const mm = $('#mm');
  let mmDown = false;
  const mmGo = (e) => {
    const r = mm.getBoundingClientRect();
    const i = RN.minimapToTile((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    if (i >= 0) RN.centerOn(i);
  };
  on(mm, 'pointerdown', (e) => { mmDown = true; mmGo(e); });
  on(mm, 'pointermove', (e) => { if (mmDown) mmGo(e); });
  on(window, 'pointerup', () => { mmDown = false; });

  on(window, 'keydown', onKey);
  on(window, 'keyup', (e) => keys.delete(e.key.toLowerCase()));
  on(window, 'blur', () => { keys.clear(); ptrs.clear(); drag = null; });
  on(window, 'resize', () => RN.resizeRender());
  on(document, 'visibilitychange', () => A.suspendAudio(document.hidden));
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => RN.resizeRender());
    const st = $('#stage');
    if (st) ro.observe(st);
    teardown.push(() => ro.disconnect());
  }
}

function panKeys(dt) {
  if (!keys.size) return;
  let vx = 0, vy = 0;
  if (keys.has('arrowleft')) vx -= 1;
  if (keys.has('arrowright')) vx += 1;
  if (keys.has('arrowup')) vy -= 1;
  if (keys.has('arrowdown')) vy += 1;
  if (vx || vy) RN.panBy(vx * 520 * dt, vy * 520 * dt);
}

function makeTitleWorld() {
  if (titleWorld) return;
  const m = generateMap('large', Math.floor(Math.random() * 1e9));
  titleWorld = { W: m.W, H: m.H, tiles: m.tiles, cities: [], units: [], camps: [], civs: [], opts: { fog: false }, vis: null, exp: null };
  titleCam = { x: m.W * 0.75 * RN.HEX, y: m.H * 0.5 * SQ3 * RN.HEX, z: 0.95 };
}

function bindBus() {
  if (busBound) return;
  busBound = true;
  bus.on('sfx', (n) => A.sfx(n));
  bus.on('log', (e) => { if (e && (e.type === 'bad' || e.type === 'good')) toast(e.text, e.type); });
}

function loop(t) {
  if (!alive) return;
  const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
  lastT = t;
  if (screen === 'game' && G.tiles && G.tiles.length) {
    panKeys(dt);
    RN.renderFrame(dt, t, t / 1000);
  } else if (screen === 'title' && titleWorld) {
    titleCam.x += dt * 14;
    const wrap = titleWorld.W * 1.5 * RN.HEX;
    if (titleCam.x > wrap) titleCam.x -= wrap * 0.5;
    const bg = $('#title-bg');
    if (bg) RN.drawBackdrop(bg, titleWorld, titleCam, t / 1000);
  }
  rafId = requestAnimationFrame(loop);
}

/* ---------------- mount ---------------- */

export function mountGame(el) {
  root = el;
  UI.buildShell(root);
  RN.initRender($('#map'), $('#mm'));
  bindBus();
  bindEvents();
  applySettings();
  makeTitleWorld();
  alive = true;
  lastT = performance.now();
  rafId = requestAnimationFrame(loop);
  showTitle();
  return () => {
    alive = false;
    cancelAnimationFrame(rafId);
    A.stopMusic();
    for (const f of teardown) f();
    teardown = [];
    if (root) root.innerHTML = '';
    root = null;
  };
}
