
(function () {
'use strict';

/* =====================================================================
   GRID RUNNER — Warehouse Robotics Sim
   Pure HTML / CSS / vanilla JS. Canvas 2D rendering, Web Audio synthesis,
   fixed-step logic driven by requestAnimationFrame + delta time.
   ===================================================================== */

/* ---------------------------- constants ---------------------------- */
const TICK = 0.1;            // sim minutes per logic tick
const SHIFT_MIN = 300;       // sim minutes per shift (06:00 → 11:00)
const SIM_RATE = 1.2;        // sim minutes per real second at 1×
const T_FLOOR = 0, T_WALL = 1, T_STORE = 2, T_STATION = 3, T_CHARGER = 4, T_DOCK = 5, T_REPAIR = 6;
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];   // N E S W
const SKUS = [
  { name: 'Phones',  short: 'PHN', color: '#38bdf8', price: 95, unitTime: 0.10, w: 1.0 },
  { name: 'Apparel', short: 'APP', color: '#f472b6', price: 34, unitTime: 0.07, w: 1.1 },
  { name: 'Snacks',  short: 'SNK', color: '#fde047', price: 9,  unitTime: 0.05, w: 1.8 },
  { name: 'Drills',  short: 'DRL', color: '#34d399', price: 72, unitTime: 0.14, w: 0.6 },
  { name: 'Plush',   short: 'PLS', color: '#c4b5fd', price: 24, unitTime: 0.07, w: 0.9 },
  { name: 'Novels',  short: 'NVL', color: '#fb923c', price: 16, unitTime: 0.06, w: 0.8 }
];
const SKU_W_SUM = SKUS.reduce((a, s) => a + s.w, 0);
const STORE_CAP = 30;
const UNIT_COST = 0.55;               // purchase cost ratio of retail price
const PICKER_WAGE = 0.5, TECH_WAGE = 0.45, ROBOT_UPKEEP = 0.2; // $/min
const PARTS_FAIL = 120, TOW_FEE = 60, SERVICE_FEE = 25;
const CHARGE_DONE = 98;
const MOVE_DRAIN = 0.26, CARRY_DRAIN = 0.08, IDLE_DRAIN = 0.0035, WAIT_DRAIN = 0.006; // % battery
const POWER_COST = 0.1;               // $ per % charged
const MAX_ROBOTS = 16;
const BUILD_COST = { wall: 4, store: 70, station: 900, charger: 450, dock: 600, repair: 500, oneway: 2 };
const SHIFT_CLOCK0 = 360;             // 06:00 in minutes

const SCENARIOS = {
  starter: {
    name: 'Starter Depot', tier: 1, costMult: 1,
    blurb: 'One dock, one picking station, three robots. Learn the loop: lift, pick, return, charge.',
    map: [
      '########################',
      '#C.....P.....D........C#',
      '#......................#',
      '#..S.S.S.S.S.S.S.S.S.S.#',
      '#......................#',
      '#......................#',
      '#..S.S.S.S.S.S.S.S.S.S.#',
      '#......................#',
      '#......................#',
      '#r.....r.....r....R....#',
      '########################'
    ],
    robots: 3, cash: 7000, rent: 1.5, baseRate: 0.25, sla: 40, techs: 1, gridCap: 2, pickers: 1,
    events: { rush: 1, lunch: 1, supplier: 1, spill: 1, brownout: 0, recall: 0 },
    shifts: [
      { name: 'Opening Shift', demand: 1.0, target: 0.72 },
      { name: 'Lunch Wave', demand: 1.3, target: 0.80 },
      { name: 'Afternoon Crunch', demand: 1.6, target: 0.84 }
    ],
    tutorial: true
  },
  midmarket: {
    name: 'Mid-Market Fulfillment', tier: 2, costMult: 1.15,
    blurb: 'Four pick stations, a choke-point gap, and grid brownouts. Traffic becomes the real problem.',
    map: [
      '##############################',
      '#C......P.....C......P......D#',
      '#............................#',
      '#..S.S.S.S.S.S.S.S.S.S.S.S...#',
      '#............................#',
      '#..S.S.S.S.S.S.S.S.S.S.S.S...#',
      '#...........................D#',
      '#.############..############.#',
      '#............................#',
      '#..S.S.S.S.S.S.S.S.S.S.S.S...#',
      '#............................#',
      '#..S.S.S.S.S.S.S.S.S.S.S.S...#',
      '#r...........................#',
      '#.......P............P.......#',
      '#C..........................C#',
      '#.............R..............#',
      '#...r......r......r......r...#',
      '##############################'
    ],
    robots: 5, cash: 10000, rent: 2.4, baseRate: 0.36, sla: 42, techs: 1, gridCap: 3, pickers: 1,
    events: { rush: 1, lunch: 1, supplier: 1, spill: 2, brownout: 1, recall: 0 },
    shifts: [
      { name: 'Monday Ramp', demand: 1.0, target: 0.76 },
      { name: 'Tuesday Flow', demand: 1.15, target: 0.80 },
      { name: 'Wednesday Surge', demand: 1.35, target: 0.84 },
      { name: 'Thursday Push', demand: 1.5, target: 0.87 },
      { name: 'Friday Rush', demand: 1.7, target: 0.90 }
    ]
  },
  megahub: {
    name: 'Peak Season Megahub', tier: 3, costMult: 1.35,
    blurb: 'Eight pick stations, two inbound docks, two pod blocks. Survive peak season to earn the capstone.',
    map: [
      '####################################',
      '#.C..............................C.#',
      '#.....P........P....P........P.....#',
      '#..................................#',
      '#..................................#',
      '#...S.S.S.S.S.S.S.S.S.S.S.S.S.S....#',
      '#..................................#',
      '#...S.S.S.S.S.S.S.S.S.S.S.S.S.S....#',
      '#..................................#',
      '#..................................#',
      '#D...............C................D#',
      '#..######..##############..######..#',
      '#...........r...........r..........#',
      '#..................................#',
      '#...S.S.S.S.S.S.S.S.S.S.S.S.S.S....#',
      '#..................................#',
      '#...S.S.S.S.S.S.S.S.S.S.S.S.S.S....#',
      '#..................................#',
      '#...r....r....r.......r....r...r...#',
      '#..................................#',
      '#.C...P........P....P........P...C.#',
      '#################R##################'
    ],
    robots: 8, cash: 16000, rent: 4.0, baseRate: 0.42, sla: 38, techs: 2, gridCap: 3, pickers: 1,
    events: { rush: 2, lunch: 1, supplier: 1, spill: 2, brownout: 1, recall: 1 },
    shifts: [
      { name: 'Pre-Peak Build', demand: 1.0, target: 0.80 },
      { name: 'Peak Ramp', demand: 1.35, target: 0.85 },
      { name: 'Peak Day', demand: 1.7, target: 0.88 },
      { name: 'Peak Surge (Capstone)', demand: 2.2, target: 0.92, capstone: true }
    ]
  }
};
const DIFFS = {
  easy:   { label: 'Easy',   demand: 0.85, fail: 0.5, cash: 1.25, target: -0.03, blurb: 'Lighter order volume, rare breakdowns, generous budget.' },
  normal: { label: 'Normal', demand: 1.0,  fail: 1.0, cash: 1.0,  target: 0,     blurb: 'The intended challenge.' },
  hard:   { label: 'Hard',   demand: 1.12, fail: 1.5, cash: 0.9,  target: 0.02,  blurb: 'Heavier demand, frequent faults, tighter budget, fill targets +2 points.' }
};
const PERKS = [
  { id: 'charge_eff',  name: 'Regenerative Charging', cost: 4, desc: '+12% battery charge rate at every charger.' },
  { id: 'lean_cells',  name: 'Lean Battery Cells',    cost: 4, desc: '−12% battery drain while moving and carrying.' },
  { id: 'pro_pick',    name: 'Pro Pickers',           cost: 5, desc: '+15% pick speed at every station.' },
  { id: 'reliability', name: 'Reliability Engineering', cost: 7, desc: '−20% robot failure rate.' },
  { id: 'lean_ops',    name: 'Lean Operations',       cost: 6, desc: '−10% rent and labour costs.' },
  { id: 'cash_seed',   name: 'Seed Capital',          cost: 5, desc: '+$1,200 starting cash in every new run.' },
  { id: 'slot_velocity', name: 'Velocity Slotting',   cost: 6, desc: 'Unlocks the Velocity slotting policy: fast movers go nearest the stations.' },
  { id: 'slot_zoned',  name: 'Zoned Slotting',        cost: 9, desc: 'Unlocks the Zoned slotting policy: SKU families grouped by aisle.' }
];
const SHOP = [
  { id: 'robot',   name: 'Deploy AMR Robot',   base: 900, scale: 0.2, max: MAX_ROBOTS, desc: '+1 shelf-lifting robot. Adds upkeep and wear load.' },
  { id: 'grid',    name: 'Power Grid Upgrade', base: 700,  max: 6,  desc: '+1 charger at full rate before brownouts bite.' },
  { id: 'pack',    name: 'Battery Pack Upgrade', base: 900, max: 3, desc: '−12% battery drain per level.' },
  { id: 'drive',   name: 'Drive Firmware v2',  base: 1100, max: 2,  desc: 'Robots move one tick faster per level (more wear per shift).' },
  { id: 'picker',  name: 'Hire Station Picker', base: 300, scale: 0.5, max: 2,  desc: '+1 picker on the least-staffed station ($0.50/min wage).' },
  { id: 'tech',    name: 'Hire Technician',    base: 800,  max: 3,  desc: 'Another repair crew. Faster repairs and tows.' },
  { id: 'traffic', name: 'Traffic Control AI', base: 1000, max: 1,  desc: 'Breaks deadlocks instantly and routes around congestion.' }
];
const TOOLS = [
  { id: 'select',  key: '1', icon: '🔍', label: 'Inspect', tip: 'Inspect robots, pods and stations. Drag empty floor to pan.' },
  { id: 'wall',    key: '2', icon: '▮',  label: 'Wall',    tip: 'Block an aisle ($4). Layouts that cut off a facility are refused.' },
  { id: 'store',   key: '3', icon: '📦', label: 'Pod',     tip: 'Storage pod ($70) holding one SKU. Robots lift pods from here.' },
  { id: 'station', key: '4', icon: '👷', label: 'Station', tip: 'Pick station ($900). Pods are delivered here for picking.' },
  { id: 'charger', key: '5', icon: '⚡', label: 'Charger', tip: 'Charging dock ($450). Robots below the charge threshold come here.' },
  { id: 'dock',    key: '6', icon: '🚚', label: 'Dock',    tip: 'Inbound dock ($600). Restock trips are delivered here.' },
  { id: 'repair',  key: '7', icon: '🔧', label: 'Repair',  tip: 'Service bay ($500). Robots over the wear threshold are serviced when idle.' },
  { id: 'oneway',  key: '8', icon: '➜',  label: 'One-way', tip: 'Click to cycle a one-way lane ($2). Right-click clears it.' },
  { id: 'erase',   key: '9', icon: '🗑', label: 'Erase',   tip: 'Remove walls, facilities or empty pods. Right-click also erases.' }
];
const STATE_COLOR = {
  idle: '#94a3b8', toPick: '#38bdf8', toStation: '#38bdf8', toHome: '#60a5fa', toDock: '#818cf8',
  toCharge: '#2dd4bf', charging: '#22c55e', servicing: '#a78bfa', picking: '#facc15',
  dockWait: '#f472b6', failed: '#ef4444', stranded: '#64748b'
};
const STATE_LABEL = {
  idle: 'Idle', toPick: 'Fetching pod', toStation: 'Delivering to station', toHome: 'Returning pod',
  toDock: 'Carrying pod to dock', toCharge: 'Driving to charger', charging: 'Charging',
  servicing: 'In service bay', picking: 'Being picked', dockWait: 'Waiting for dock',
  failed: 'FAILED — awaiting technician', stranded: 'STRANDED — battery empty'
};

/* ---------------------------- storage ---------------------------- */
const Store = (function () {
  let ok = true, mem = {};
  try { const k = '__wr_probe'; window.localStorage.setItem(k, '1'); window.localStorage.removeItem(k); }
  catch (e) { ok = false; }
  return {
    ok: ok,
    get: function (k, d) {
      try {
        if (!ok) return mem[k] !== undefined ? mem[k] : d;
        const v = window.localStorage.getItem(k);
        return v === null ? d : JSON.parse(v);
      } catch (e) { return d; }
    },
    set: function (k, v) {
      try {
        if (!ok) { mem[k] = v; return false; }
        window.localStorage.setItem(k, JSON.stringify(v)); return true;
      } catch (e) { mem[k] = v; return false; }
    },
    remove: function (k) {
      try { if (ok) window.localStorage.removeItem(k); } catch (e) { /* ignore */ }
      delete mem[k];
    }
  };
})();
const KEY_CAMP = 'wr35_campaign_v1', KEY_SET = 'wr35_settings_v1', KEY_SAVE = 'wr35_save_v1';

function defaultCampaign() {
  return { v: 1, rp: 0, perks: {}, unlocked: { starter: true, midmarket: false, megahub: false },
    best: {}, wins: 0, shifts: 0, orders: 0, deadlocks: 0, failures: 0, bestFill: 0, hardUnlocked: false, coachHidden: false };
}
function defaultSettings() {
  return { master: 0.8, music: 0.5, sfx: 0.7, sound: true, muted: false, particles: true, reduced: false, coach: true };
}
let CAM = Object.assign(defaultCampaign(), Store.get(KEY_CAMP, {}) || {});
let SET = Object.assign(defaultSettings(), Store.get(KEY_SET, {}) || {});
function saveCampaign() { Store.set(KEY_CAMP, CAM); }
function saveSettings() { Store.set(KEY_SET, SET); }
function perk(id) { return !!(CAM.perks && CAM.perks[id]); }

/* ---------------------------- helpers ---------------------------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const money = v => (v < 0 ? '−$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');
const pct = v => Math.round(v * 100) + '%';
const pad2 = n => String(n).padStart(2, '0');
function clockStr(t) { const m = SHIFT_CLOCK0 + Math.floor(t); return pad2(Math.floor(m / 60) % 24) + ':' + pad2(m % 60); }
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h | 0; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function setHTML(el, html) { if (el && el._h !== html) { el.innerHTML = html; el._h = html; } }

/* ---------------------------- audio ---------------------------- */
const AU = { ctx: null, master: null, sfxBus: null, ambBus: null, comp: null, cool: {}, hum: null, hiss: null, drone: null, noiseBuf: null };
function auInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') { try { AU.ctx.resume(); } catch (e) { /* ignore */ } } return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    const ctx = new AC();
    AU.ctx = ctx;
    AU.comp = ctx.createDynamicsCompressor(); AU.comp.connect(ctx.destination);
    AU.master = ctx.createGain(); AU.master.connect(AU.comp);
    AU.sfxBus = ctx.createGain(); AU.sfxBus.connect(AU.master);
    AU.ambBus = ctx.createGain(); AU.ambBus.connect(AU.master);
    // brown-noise buffer (shared)
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    AU.noiseBuf = buf;
    // ambient drone: detuned saw + triangle through a slowly swept low-pass
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 0.7; lp.connect(AU.ambBus);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
    const g1 = ctx.createGain(); g1.gain.value = 0.03; o1.connect(g1); g1.connect(lp);
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 82.6;
    const g2 = ctx.createGain(); g2.gain.value = 0.018; o2.connect(g2); g2.connect(lp);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 90; lfo.connect(lg); lg.connect(lp.frequency);
    // HVAC hiss
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.5;
    const hg = ctx.createGain(); hg.gain.value = 0.04; src.connect(bp); bp.connect(hg); hg.connect(AU.ambBus);
    // motor hum (follows robot activity)
    const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 96;
    const hgn = ctx.createGain(); hgn.gain.value = 0; hum.connect(hgn); hgn.connect(AU.ambBus);
    [o1, o2, lfo, src, hum].forEach(n => { try { n.start(); } catch (e) { /* ignore */ } });
    AU.drone = { g1: g1, g2: g2, lp: lp };
    AU.hum = { osc: hum, gain: hgn };
    AU.hiss = hg;
    applyAudio();
  } catch (e) { AU.ctx = null; }
}
function applyAudio() {
  if (!AU.ctx) return;
  const now = AU.ctx.currentTime;
  const m = SET.muted || !SET.sound ? 0 : SET.master;
  AU.master.gain.setTargetAtTime(m, now, 0.02);
  AU.sfxBus.gain.setTargetAtTime(SET.sfx, now, 0.02);
  AU.ambBus.gain.setTargetAtTime(SET.music, now, 0.02);
}
function tone(freq, dur, type, vol, when, slide, bus) {
  const c = AU.ctx; if (!c) return;
  const t = c.currentTime + (when || 0);
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus || AU.sfxBus);
  o.start(t); o.stop(t + dur + 0.05);
  o.onended = function () { try { o.disconnect(); g.disconnect(); } catch (e) { /* ignore */ } };
}
function noiseBurst(dur, vol, when) {
  const c = AU.ctx; if (!c || !AU.noiseBuf) return;
  const t = c.currentTime + (when || 0);
  const s = c.createBufferSource(); s.buffer = AU.noiseBuf;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(AU.sfxBus);
  s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  s.onended = function () { try { s.disconnect(); f.disconnect(); g.disconnect(); } catch (e) { /* ignore */ } };
}
function siren() {
  const c = AU.ctx; if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'square';
  for (let i = 0; i < 6; i++) {
    o.frequency.linearRampToValueAtTime(520, t + i * 0.25 + 0.12);
    o.frequency.linearRampToValueAtTime(780, t + i * 0.25 + 0.25);
  }
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 0.03);
  g.gain.setValueAtTime(0.045, t + 1.45); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.55);
  o.connect(g); g.connect(AU.sfxBus);
  o.start(t); o.stop(t + 1.6);
  o.onended = function () { try { o.disconnect(); g.disconnect(); } catch (e) { /* ignore */ } };
}
const SFX = {
  pick: () => tone(660, 0.07, 'triangle', 0.10, 0, 1.6),
  deliver: () => { tone(523, 0.12, 'sine', 0.12); tone(784, 0.18, 'sine', 0.10, 0.09); },
  coin: () => { tone(1319, 0.09, 'square', 0.04); tone(1760, 0.14, 'sine', 0.07, 0.06); },
  charge: () => { tone(440, 0.12, 'sine', 0.08); tone(554, 0.12, 'sine', 0.08, 0.1); tone(659, 0.2, 'sine', 0.08, 0.2); },
  order: () => tone(1046, 0.06, 'sine', 0.05),
  alarm: () => siren(),
  fail: () => { tone(90, 0.45, 'sine', 0.30, 0, 0.5); noiseBurst(0.3, 0.22); },
  warn: () => { tone(330, 0.15, 'sawtooth', 0.05); tone(262, 0.2, 'sawtooth', 0.05, 0.18); },
  good: () => { tone(523, 0.14, 'triangle', 0.09); tone(659, 0.14, 'triangle', 0.09, 0.09); tone(784, 0.24, 'triangle', 0.09, 0.18); },
  click: () => tone(900, 0.03, 'square', 0.03),
  shift: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.09, i * 0.12)); },
  fanfare: () => { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.4, 'triangle', 0.10, i * 0.15)); }
};
function play(name) {
  if (!AU.ctx || SET.muted || !SET.sound || !SFX[name]) return;
  const now = AU.ctx.currentTime;
  const last = AU.cool[name] || -1;
  if (now - last < 0.045) return;
  AU.cool[name] = now;
  try { SFX[name](); } catch (e) { /* ignore */ }
}
function updateAmbient(g) {
  if (!AU.ctx || !g) return;
  const now = AU.ctx.currentTime;
  const active = g.robots.filter(r => r.state !== 'idle' && r.state !== 'failed' && r.state !== 'stranded' && r.state !== 'charging').length;
  const frac = g.robots.length ? active / g.robots.length : 0;
  const cong = clamp(g.cycles.length * 0.6 + g.gridlock / 20 + (g.breakUntil > g.t ? 0.2 : 0), 0, 1);
  if (AU.hum) {
    AU.hum.gain.gain.setTargetAtTime(SET.reduced ? 0.0 : 0.012 * frac, now, 0.3);
    AU.hum.osc.frequency.setTargetAtTime(92 + active * 2.5, now, 0.4);
  }
  if (AU.drone) AU.drone.lp.frequency.setTargetAtTime(330 + cong * 700 + frac * 120, now, 0.5);
  if (AU.hiss) AU.hiss.gain.setTargetAtTime(0.03 + cong * 0.05, now, 0.5);
}

/* ---------------------------- rng ---------------------------- */
let RNGOBJ = null;
function rnd() {
  const o = RNGOBJ || G;
  o.rs = (o.rs + 0x6D2B79F5) | 0;
  let t = o.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function weightedSku() {
  let r = rnd() * SKU_W_SUM;
  for (let i = 0; i < SKUS.length; i++) { r -= SKUS[i].w; if (r <= 0) return i; }
  return SKUS.length - 1;
}

/* ---------------------------- state ---------------------------- */
let G = null;
const UI = {
  screen: 'title', paused: false, autoPaused: false, hold: null, speed: 1, tool: 'select', overlay: 'off',
  tab: 'ops', selected: null, cam: { zoom: 1, panX: 0, panY: 0 }, drag: null, painting: false, lastPaint: -1,
  hover: -1, checkpoint: null, acc: 0, lastHud: 0, lastSide: 0, lastFx: 0, pointers: new Map(), pinch: 0,
  diff: 'normal', scn: 'starter', mouse: { x: 0, y: 0 }, inspectorKey: '', coachKey: '', titleFlow: 'title', tipOn: true
};
let CW = 800, CH = 500, DPR = 1;
let FX = { parts: [], floats: [] };

function emptyStat() {
  return {
    created: 0, picks: 0, units: 0, restocks: 0, restockUnits: 0, revenue: 0, deadlocks: 0, resolved: 0, deadlockTicks: 0,
    fails: 0, strandings: 0, robotTicks: 0, busyTicks: 0, moves: 0, onTime: 0, late: 0, lost: 0, battSum: 0, battN: 0,
    costs: { labor: 0, rent: 0, upkeep: 0, power: 0, restock: 0, parts: 0, penalties: 0 }
  };
}
function totalCost(stat) { let t = 0; for (const k in stat.costs) t += stat.costs[k]; return t; }

function newRobot(g, cell, hueSeed) {
  const id = g.nextId++;
  const r = {
    id: id, cell: cell, prevCell: cell, goal: -1, goalType: '', path: [], state: 'idle', prevState: null,
    moveCd: 0, sinceMove: 9, moveDur: TICK * 6, facing: 1, battery: 100, wear: 0, cargo: -1, job: null,
    claims: [], waitFor: -1, waitTicks: 0, markT: -1, inDead: false, wasDead: false, techAssigned: false,
    yieldReq: false, timer: 0, station: -1, dockCell: -1, noPath: 0, hue: (hueSeed != null ? hueSeed : id * 67) % 360,
    stats: { moves: 0, picks: 0, units: 0, fails: 0, busy: 0, live: 0, charged: 0, dist: 0, deadTicks: 0 }
  };
  g.occ[cell] = id;
  g.robots.push(r);
  return r;
}
function robotById(g, id) { for (let i = 0; i < g.robots.length; i++) if (g.robots[i].id === id) return g.robots[i]; return null; }
function stationAt(g, c) { for (const s of g.stations) if (s.cell === c) return s; return null; }
function chargerAt(g, c) { for (const s of g.chargers) if (s.cell === c) return s; return null; }
function dockAt(g, c) { for (const s of g.docks) if (s.cell === c) return s; return null; }
function repairAt(g, c) { for (const s of g.repairs) if (s.cell === c) return s; return null; }
function manh(g, a, b) { return Math.abs(a % g.W - b % g.W) + Math.abs(((a / g.W) | 0) - ((b / g.W) | 0)); }
function xyOf(g, c) { return { x: c % g.W, y: (c / g.W) | 0 }; }
function robotName(r) { return 'R' + r.id; }
function moveTicks(g) { return Math.max(4, 6 - g.drive); }
function moveDurFor(g) { return moveTicks(g) * TICK; }

function dirAllowed(g, a, b, d) {
  const da = g.dir[a]; if (da && da !== d + 1) return false;
  const db = g.dir[b]; if (db && db !== d + 1) return false;
  return true;
}
function passable(g, c) { return g.type[c] !== T_WALL && !g.hazard[c]; }

function reachFrom(g, start, reverse) {
  const seen = new Uint8Array(g.W * g.H);
  const q = [start]; seen[start] = 1; let h = 0;
  while (h < q.length) {
    const c = q[h++]; const x = c % g.W, y = (c / g.W) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= g.W || ny >= g.H) continue;
      const nb = ny * g.W + nx;
      if (seen[nb] || !passable(g, nb)) continue;
      const ok = reverse ? dirAllowed(g, nb, c, (d + 2) % 4) : dirAllowed(g, c, nb, d);
      if (!ok) continue;
      seen[nb] = 1; q.push(nb);
    }
  }
  return seen;
}
function layoutProblem(g) {
  const start = g.chargers.length ? g.chargers[0].cell : -1;
  if (start < 0) return 'Robots need at least one charger.';
  const fwd = reachFrom(g, start, false), rev = reachFrom(g, start, true);
  const targets = [];
  g.stations.forEach(s => targets.push(s.cell));
  g.chargers.forEach(s => targets.push(s.cell));
  g.docks.forEach(s => targets.push(s.cell));
  g.repairs.forEach(s => targets.push(s.cell));
  g.shelves.forEach(s => { if (s) targets.push(s.home); });
  for (const t of targets) if (!fwd[t] || !rev[t]) return 'That layout would trap part of the warehouse.';
  return null;
}
function computeDist(g) {
  g.distSt = new Array(g.W * g.H).fill(999);
  const q = [];
  g.stations.forEach(s => { g.distSt[s.cell] = 0; q.push(s.cell); });
  let h = 0;
  while (h < q.length) {
    const c = q[h++]; const x = c % g.W, y = (c / g.W) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= g.W || ny >= g.H) continue;
      const nb = ny * g.W + nx;
      if (g.type[nb] === T_WALL || g.distSt[nb] <= g.distSt[c] + 1) continue;
      g.distSt[nb] = g.distSt[c] + 1; q.push(nb);
    }
  }
}

/* ---------------------------- slotting ---------------------------- */
function assignSlots(g, policy) {
  const list = g.shelves.filter(s => s);
  if (!list.length) return 0;
  let changed = 0;
  if (policy === 'random') {
    list.forEach(s => { const k = weightedSku(); if (k !== s.sku) changed++; s.sku = k; });
  } else {
    const sorted = list.slice().sort((a, b) => {
      if (policy === 'velocity') return (g.distSt[a.home] - g.distSt[b.home]) || (a.id - b.id);
      return (a.home - b.home);
    });
    const total = sorted.length;
    const counts = SKUS.map(k => Math.max(1, Math.round(total * k.w / SKU_W_SUM)));
    let sum = counts.reduce((a, b) => a + b, 0);
    while (sum > total) { let mi = 0; counts.forEach((c, i) => { if (c > counts[mi]) mi = i; }); counts[mi]--; sum--; }
    while (sum < total) { let mi = 0; SKUS.forEach((k, i) => { if (k.w > SKUS[mi].w) mi = i; }); counts[mi]++; sum++; }
    const order = SKUS.map((_, i) => i);
    if (policy === 'velocity') order.sort((a, b) => SKUS[b].w - SKUS[a].w);
    const seq = [];
    order.forEach(i => { for (let k = 0; k < counts[i]; k++) seq.push(i); });
    sorted.forEach((s, i) => { if (s.sku !== seq[i]) changed++; s.sku = seq[i]; });
  }
  return changed;
}

/* ---------------------------- new game ---------------------------- */
function newGame(scnId, diffId, seed) {
  const S = SCENARIOS[scnId], D = DIFFS[diffId];
  const lines = S.map;
  // (rnd() is bound to the game object below once it exists)
  const H = lines.length;
  const W = Math.max.apply(null, lines.map(l => l.length));
  const N = W * H;
  const g = {
    v: 3, scn: scnId, diff: diffId, W: W, H: H, N: N,
    type: new Array(N).fill(T_FLOOR), dir: new Array(N).fill(0), shelfAt: new Array(N).fill(-1),
    occ: new Array(N).fill(-1), traffic: new Array(N).fill(0), hazard: new Array(N).fill(0),
    distSt: new Array(N).fill(999), failedAt: new Array(N).fill(0),
    robots: [], shelves: [], stations: [], chargers: [], docks: [], repairs: [], techs: [], orders: [],
    nextId: 1, shiftIdx: 0, t: 0, ticks: 0, rs: (seed != null ? seed : hashStr(scnId + ':' + diffId)) | 0,
    cash: Math.round(S.cash * D.cash) + (perk('cash_seed') ? 1200 : 0), rep: 70,
    gridCap: S.gridCap, pack: 0, drive: 0, trafficAI: false, pmThreshold: 75, chargeAt: 30, policy: 'random',
    pendingPolicy: null, rushUntil: -1, breakUntil: -1, brownUntil: -1, chargeScale: 1, schedule: [], log: [],
    tips: {}, bankrupt: 0, gridlock: 0, movesRecent: 0, movesThisTick: 0, cycles: [],
    hist: { t: [], fill: [], active: [], batt: [], backlog: [] }, stat: emptyStat(), totals: { created: 0, onTime: 0, late: 0, lost: 0, revenue: 0, cost: 0, moves: 0, picks: 0, units: 0, deadlocks: 0, fails: 0, strandings: 0 },
    perks: JSON.parse(JSON.stringify(CAM.perks || {})), over: null, nextOrder: 1, rushCount: 0, shiftFail: false, dirty: true
  };
  // parse layout
  const spawn = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = (lines[y] && lines[y][x]) || '#';
      const c = y * W + x;
      switch (ch) {
        case '#': g.type[c] = T_WALL; break;
        case 'S': g.type[c] = T_STORE; break;
        case 'P': g.type[c] = T_STATION; g.stations.push({ cell: c, occ: -1, target: -1, workers: S.pickers || 1, fatigue: 0, served: 0 }); break;
        case 'C': g.type[c] = T_CHARGER; g.chargers.push({ cell: c, occ: -1, target: -1 }); break;
        case 'D': g.type[c] = T_DOCK; g.docks.push({ cell: c, blockedUntil: -1 }); break;
        case 'R': g.type[c] = T_REPAIR; g.repairs.push({ cell: c, occ: -1, target: -1 }); break;
        case 'r': spawn.push(c); break;
        case '^': g.dir[c] = 1; break;
        case '>': g.dir[c] = 2; break;
        case 'v': g.dir[c] = 3; break;
        case '<': g.dir[c] = 4; break;
        default: break;
      }
      if (ch === 'S') addShelf(g, c, 0);
    }
  }
  RNGOBJ = g;
  computeDist(g);
  assignSlots(g, 'random');
  for (let i = 0; i < S.techs; i++) g.techs.push({ busy: -1, timer: 0 });
  for (let i = 0; i < S.robots; i++) {
    const c = i < spawn.length ? spawn[i] : spawnNearCharger(g);
    if (c >= 0) newRobot(g, c);
  }
  g.schedule = makeSchedule(g);
  logMsg(g, 'Warehouse online. ' + g.robots.length + ' robots, ' + g.shelves.filter(s => s).length + ' pods, ' + g.stations.length + ' stations.', 'info');
  return g;
}
function spawnNearCharger(g) {
  if (!g.chargers.length) return -1;
  const start = g.chargers[0].cell;
  const seen = new Uint8Array(g.N); const q = [start]; seen[start] = 1; let h = 0;
  while (h < q.length) {
    const c = q[h++];
    if (g.occ[c] < 0 && g.type[c] === T_FLOOR && !g.hazard[c] && g.shelfAt[c] < 0) return c;
    const x = c % g.W, y = (c / g.W) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= g.W || ny >= g.H) continue;
      const nb = ny * g.W + nx;
      if (!seen[nb] && passable(g, nb)) { seen[nb] = 1; q.push(nb); }
    }
  }
  return -1;
}
function addShelf(g, cell, sku) {
  const id = g.shelves.length;
  g.shelves.push({ id: id, home: cell, sku: sku, stock: STORE_CAP, cap: STORE_CAP, carriedBy: -1, reservedBy: -1 });
  g.shelfAt[cell] = id;
  return id;
}

/* ---------------------------- schedule & events ---------------------------- */
function makeSchedule(g) {
  const S = SCENARIOS[g.scn], ev = S.events, out = [];
  const at = (lo, hi) => lo + rnd() * (hi - lo);
  const add = (t, type) => out.push({ at: Math.round(t * 10) / 10, type: type, done: false });
  for (let i = 0; i < (ev.rush || 0); i++) add(at(25, 230), 'rush');
  for (let i = 0; i < (ev.lunch || 0); i++) add(140, 'lunch');
  for (let i = 0; i < (ev.supplier || 0); i++) add(at(60, 200), 'supplier');
  let sp = ev.spill || 0; if (g.diff === 'hard') sp += 1;
  for (let i = 0; i < sp; i++) add(at(20, 270), 'spill');
  for (let i = 0; i < (ev.brownout || 0); i++) add(at(100, 230), 'brownout');
  for (let i = 0; i < (ev.recall || 0); i++) add(at(120, 260), 'recall');
  if (g.diff === 'hard' && (S.shifts[g.shiftIdx] || {}).demand >= 1.5) add(at(60, 240), 'rush');
  out.sort((a, b) => a.at - b.at);
  return out;
}
function fireEvent(g, ev) {
  ev.done = true;
  const t = g.t;
  if (ev.type === 'rush') {
    g.rushUntil = t + 25; g.rushCount++;
    logMsg(g, 'RUSH WAVE: order volume +60% for 25 minutes.', 'warn');
    alertBox('Rush wave: orders +60% for 25 min', 'warn');
    play('warn'); toast('Rush wave incoming — order volume up 60% for 25 min.', 'warn');
  } else if (ev.type === 'supplier') {
    if (!g.docks.length) return;
    g.docks.forEach(d => { d.blockedUntil = t + 35; });
    logMsg(g, 'SUPPLIER DELAY: docks offline for 35 min. Restocking stalls.', 'bad');
    alertBox('Supplier delay: docks offline for 35 min', 'bad');
    play('warn'); tip(g, 'supplier', 'Supplier delay: pods that run low will stay empty until the dock reopens. Stock your fastest SKUs near stations.');
  } else if (ev.type === 'lunch') {
    g.breakUntil = t + 15;
    logMsg(g, 'Lunch break: pickers off the floor for 15 min. Stations stop.', 'warn');
    alertBox('Lunch break: stations paused for 15 min', 'warn');
    toast('Lunch break — pick stations paused for 15 min.', 'warn');
  } else if (ev.type === 'brownout') {
    g.brownUntil = t + 40;
    logMsg(g, 'GRID BROWNOUT: chargers at 45% for 40 min.', 'bad');
    alertBox('Grid brownout: chargers at 45% for 40 min', 'bad');
    play('warn'); tip(g, 'brownout', 'Brownout: chargers deliver less power. Add grid capacity or raise the charge threshold so robots charge earlier.');
  } else if (ev.type === 'spill') {
    const cells = [];
    for (let c = 0; c < g.N; c++) if (g.type[c] === T_FLOOR && g.occ[c] < 0 && !g.hazard[c] && g.shelfAt[c] < 0 && g.dir[c] === 0) cells.push(c);
    if (!cells.length) return;
    const c = cells[Math.floor(rnd() * cells.length) % cells.length];
    // do not spill if it would trap anything
    g.hazard[c] = 1;
    if (layoutProblem(g)) { g.hazard[c] = 0; return; }
    g.hazard[c] = t + 18;
    const xy = xyOf(g, c);
    logMsg(g, 'PALLET SPILL at (' + xy.x + ',' + xy.y + '): aisle impassable for 18 min.', 'bad');
    alertBox('Pallet spill: aisle blocked for 18 min', 'warn');
    play('warn'); floatText(c, 'SPILL', '#fbbf24');
    tip(g, 'spill', 'Spills block an aisle. Robots route around them, but a spill in a choke-point can jam the whole floor.');
  } else if (ev.type === 'recall') {
    const cands = g.robots.filter(r => r.state === 'idle' || r.state === 'toPick' || r.state === 'toHome' || r.state === 'toStation');
    if (!cands.length) return;
    failRobot(g, cands[Math.floor(rnd() * cands.length) % cands.length], 'firmware recall');
  }
}
function tip(g, key, text) {
  if (!g || g.tips[key]) return;
  g.tips[key] = 1;
  logMsg(g, 'TIP: ' + text, 'tip');
  if (UI.tipOn) toast(text, 'tip', 7000);
}

/* ---------------------------- orders ---------------------------- */
function orderRate(g) {
  const S = SCENARIOS[g.scn], D = DIFFS[g.diff], sh = S.shifts[g.shiftIdx];
  const curve = 0.75 + 0.45 * Math.sin(Math.PI * clamp(g.t / SHIFT_MIN, 0, 1)) + 0.08 * Math.sin(g.t / 9);
  const rush = g.t < g.rushUntil ? 1.6 : 1;
  const rep = 0.5 + g.rep / 200;
  return S.baseRate * D.demand * sh.demand * curve * rush * rep;
}
function spawnOrder(g) {
  const S = SCENARIOS[g.scn];
  const n = 1 + (rnd() < 0.45 ? 1 : 0) + (rnd() < 0.2 ? 1 : 0) + (rnd() < 0.05 ? 1 : 0);
  const lines = []; let value = 3;
  for (let i = 0; i < n; i++) {
    const sku = weightedSku();
    const qty = rnd() < 0.7 ? 1 : (rnd() < 0.8 ? 2 : 3);
    lines.push({ sku: sku, qty: qty, done: false, claimed: -1 });
    value += SKUS[sku].price * qty;
  }
  g.orders.push({ id: g.nextOrder++, created: g.t, due: g.t + S.sla, lines: lines, left: lines.length, status: 'open', value: Math.round(value), pastDue: false, shipT: -1 });
  g.stat.created++; g.totals.created++;
  play('order');
}
function findOrder(g, id) { for (let i = g.orders.length - 1; i >= 0; i--) if (g.orders[i].id === id) return g.orders[i]; return null; }
function openOrders(g) { let n = 0; for (const o of g.orders) if (o.status === 'open') n++; return n; }
function computeFill(g) {
  let on = 0, late = 0, lost = 0, pastOpen = 0;
  for (const o of g.orders) {
    if (o.status === 'shipped') { if (o.shipT <= o.due) on++; else late++; }
    else if (o.status === 'lost') lost++;
    else if (o.status === 'open' && g.t > o.due) pastOpen++;
  }
  const den = on + late + lost + pastOpen;
  return { on: on, late: late, lost: lost, pastOpen: pastOpen, fill: den ? on / den : 1 };
}
function shipOrder(g, o, cell) {
  o.status = 'shipped'; o.shipT = g.t;
  const onTime = g.t <= o.due;
  const rev = onTime ? o.value : Math.round(o.value * 0.5);
  g.cash += rev; g.stat.revenue += rev;
  if (onTime) { g.rep = Math.min(100, g.rep + 0.6); g.stat.onTime++; }
  else { g.rep = Math.max(0, g.rep - 0.8); g.stat.late++; }
  floatText(cell, (onTime ? '+' : 'late +') + money(rev), onTime ? '#34d399' : '#fbbf24');
  play(onTime ? 'coin' : 'warn');
}
function updateOrders(g) {
  const sla = SCENARIOS[g.scn].sla;
  for (const o of g.orders) {
    if (o.status !== 'open') continue;
    if (!o.pastDue && g.t > o.due) { o.pastDue = true; g.rep = Math.max(0, g.rep - 0.5); }
    if (g.t > o.created + 2 * sla) {
      o.status = 'lost'; g.stat.lost++; g.totals.lost++;
      g.rep = Math.max(0, g.rep - 2.5); g.cash -= 3; g.stat.costs.penalties += 3;
      logMsg(g, 'Order #' + o.id + ' cancelled after 2× SLA. Reputation hit.', 'bad');
    }
  }
}
function pendingBySku(g) {
  const p = new Array(SKUS.length).fill(0);
  for (const o of g.orders) {
    if (o.status !== 'open') continue;
    for (const L of o.lines) if (!L.done && L.claimed < 0) p[L.sku] += L.qty;
  }
  return p;
}
function claimLines(g, rid, sh) {
  let remaining = sh.stock, total = 0; const claims = [];
  for (const o of g.orders) {
    if (o.status !== 'open') continue;
    for (let i = 0; i < o.lines.length; i++) {
      const L = o.lines[i];
      if (L.done || L.claimed >= 0 || L.sku !== sh.sku) continue;
      if (L.qty <= remaining) {
        L.claimed = rid; remaining -= L.qty; total += L.qty;
        claims.push({ o: o.id, i: i, sku: L.sku, qty: L.qty });
      }
    }
    if (claims.length >= 14) break;
  }
  sh.stock -= total;
  return claims;
}

/* ---------------------------- economy ---------------------------- */
function costsTick(g) {
  const lean = g.perks.lean_ops ? 0.9 : 1;
  const rent = SCENARIOS[g.scn].rent * TICK * lean;
  const up = g.robots.length * ROBOT_UPKEEP * TICK;
  const lab = g.stations.reduce((a, s) => a + s.workers, 0) * PICKER_WAGE * TICK * lean;
  const tech = g.techs.length * TECH_WAGE * TICK * lean;
  g.cash -= rent + up + lab + tech;
  g.stat.costs.rent += rent; g.stat.costs.upkeep += up; g.stat.costs.labor += lab + tech;
}

/* ---------------------------- movement ---------------------------- */
function moveRobotTo(g, r, nx, d) {
  const ox = r.cell;
  if (r.station >= 0) { /* station reference cleared when leaving */ }
  const st = stationAt(g, ox); if (st && st.occ === r.id) st.occ = -1;
  const ch = chargerAt(g, ox); if (ch && ch.occ === r.id) ch.occ = -1;
  const rp = repairAt(g, ox); if (rp && rp.occ === r.id) rp.occ = -1;
  g.occ[ox] = -1;
  r.prevCell = ox; r.cell = nx; g.occ[nx] = r.id;
  r.sinceMove = 0; r.moveDur = moveDurFor(g); r.facing = d;
  g.traffic[nx] = Math.min(40, g.traffic[nx] + 1);
  g.movesThisTick++; r.stats.moves++; r.stats.dist++; g.stat.moves++; g.totals.moves++;
}
function tryStep(g, r) {
  const nx = r.path[0];
  if (nx === undefined) return 'none';
  const ox = r.cell;
  if (g.type[nx] === T_WALL || g.hazard[nx] || g.failedAt[nx]) return 'bad';
  const dx = (nx % g.W) - (ox % g.W), dy = ((nx / g.W) | 0) - ((ox / g.W) | 0);
  let d = -1;
  for (let k = 0; k < 4; k++) if (DX[k] === dx && DY[k] === dy) d = k;
  if (d < 0 || !dirAllowed(g, ox, nx, d)) return 'bad';
  const o = g.occ[nx];
  if (o >= 0 && o !== r.id) { r.waitFor = o; return 'blocked'; }
  r.path.shift();
  moveRobotTo(g, r, nx, d);
  r.wear += 0.18 * (r.cargo >= 0 ? 1.25 : 1);
  const dm = (1 - 0.12 * g.pack) * (perk('lean_cells') ? 0.88 : 1);
  r.battery = Math.max(0, r.battery - (MOVE_DRAIN + (r.cargo >= 0 ? CARRY_DRAIN : 0)) * dm);
  if (rnd() < failChance(g, r)) failRobot(g, r, 'motor fault');
  return 'moved';
}
function failChance(g, r) {
  const S = DIFFS[g.diff].fail;
  const rel = perk('reliability') ? 0.8 : 1;
  let p = 0.0006 * S * rel * (1 + r.wear / 35) * (r.cargo >= 0 ? 1.2 : 1);
  if (r.wear >= 100) p *= 2.5;
  return p;
}
function replan(g, r) {
  if (r.goal < 0) { r.path = []; return; }
  const p = astar(g, r.cell, r.goal, r.id);
  r.path = p || [];
  if (!p) r.noPath++;
}
function astar(g, s, goal, rid) {
  if (s === goal) return [];
  const N = g.N, W = g.W;
  const gS = new Float64Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = [];
  const push = (f, c) => {
    heap.push([f, c]); let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, rr = l + 1; let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (rr < heap.length && heap[rr][0] < heap[m][0]) m = rr;
        if (m === i) break;
        const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m;
      }
    }
    return top;
  };
  const gx = goal % W, gy = (goal / W) | 0;
  gS[s] = 0; push(0, s);
  let iter = 0;
  const wTraffic = g.trafficAI ? 0.25 : 0.05;
  while (heap.length && iter++ < 4000) {
    const cur = pop()[1];
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const x = cur % W, y = (cur / W) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= W || ny >= g.H) continue;
      const nb = ny * W + nx;
      if (closed[nb] || g.type[nb] === T_WALL || g.hazard[nb] || g.failedAt[nb] && nb !== goal) continue;
      if (!dirAllowed(g, cur, nb, d)) continue;
      const o = g.occ[nb];
      let cost = 1 + Math.min(40, g.traffic[nb]) * wTraffic;
      if (o >= 0 && o !== rid) cost += 4;
      const ng = gS[cur] + cost;
      if (ng < gS[nb]) {
        gS[nb] = ng; came[nb] = cur;
        const h = Math.abs(nx - gx) + Math.abs(ny - gy);
        push(ng + h, nb);
      }
    }
  }
  if (came[goal] < 0 && goal !== s) return null;
  const path = [];
  let c = goal;
  while (c !== s && c >= 0) { path.push(c); c = came[c]; }
  path.reverse();
  return path;
}

function sidestep(g, r) {
  let best = -1, bestT = 1e9, bestD = -1;
  for (let d = 0; d < 4; d++) {
    const x = r.cell % g.W + DX[d], y = ((r.cell / g.W) | 0) + DY[d];
    if (x < 0 || y < 0 || x >= g.W || y >= g.H) continue;
    const nb = y * g.W + x;
    if (!passable(g, nb) || g.occ[nb] >= 0 || g.failedAt[nb] || !dirAllowed(g, r.cell, nb, d)) continue;
    const fac = g.type[nb] !== T_FLOOR && g.type[nb] !== T_STORE ? 3 : 0;
    const score = g.traffic[nb] + fac;
    if (score < bestT) { bestT = score; best = nb; bestD = d; }
  }
  if (best < 0) return false;
  moveRobotTo(g, r, best, bestD);
  r.path = []; r.waitTicks = 0; r.waitFor = -1; r.moveCd = moveTicks(g) - 1;
  return true;
}

/* ---------------------------- dispatch & jobs ---------------------------- */
function nearestFree(g, from, list) {
  let best = null, bd = 1e9;
  for (const f of list) {
    const d = manh(g, from, f.cell) + (f.occ >= 0 || f.target >= 0 ? 6 : 0);
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}
function chooseJob(g, r) {
  const restockJob = () => {
    if (!g.docks.length) return null;
    let rb = null, rd = 1e9;
    for (const s of g.shelves) {
      if (!s || s.carriedBy >= 0 || s.reservedBy >= 0 || s.stock >= s.cap * 0.4) continue;
      const d = manh(g, r.cell, s.home) + (s.cap - s.stock) * 0.02 - (s.stock === 0 ? 6 : 0);
      if (d < rd) { rd = d; rb = s; }
    }
    if (!rb) return null;
    rb.reservedBy = r.id;
    return { type: 'restock', shelf: rb.id };
  };
  // keep the pods stocked: one restock trip per four robots is always prioritised
  const inProg = g.robots.reduce((a, x) => a + (x.job && x.job.type === 'restock' && x !== r ? 1 : 0), 0);
  if (inProg < Math.max(1, Math.floor(g.robots.length / 4)) && g.shelves.some(s => s && s.carriedBy < 0 && s.reservedBy < 0 && s.stock === 0)) {
    const j = restockJob(); if (j) return j;
  }
  const pend = pendingBySku(g);
  let best = null, bs = 1e9;
  for (const s of g.shelves) {
    if (!s || s.carriedBy >= 0 || s.reservedBy >= 0 || s.stock <= 0 || pend[s.sku] <= 0) continue;
    const d = manh(g, r.cell, s.home);
    const sc = d + g.distSt[s.home] * 1.1 - Math.min(pend[s.sku], s.stock) * 0.6;
    if (sc < bs) { bs = sc; best = s; }
  }
  if (best) {
    const claims = claimLines(g, r.id, best);
    if (claims.length) { best.reservedBy = r.id; r.claims = claims; return { type: 'pick', shelf: best.id }; }
  }
  return restockJob();
}
function dispatch(g, r) {
  if (r.battery < g.chargeAt && r.cargo < 0) { if (goCharge(g, r)) return; }
  if (r.wear >= g.pmThreshold && g.repairs.length && r.cargo < 0) {
    // only an unclaimed, unoccupied bay: queueing for service would jam the aisles
    let rp = null, rd = 1e9;
    for (const b of g.repairs) if (b.occ < 0 && b.target < 0) { const d = manh(g, r.cell, b.cell); if (d < rd) { rd = d; rp = b; } }
    if (rp) { rp.target = r.id; r.goal = rp.cell; r.goalType = 'service'; r.state = 'toService'; r.path = []; return; }
  }
  const job = chooseJob(g, r);
  if (job) {
    r.job = job;
    const sh = g.shelves[job.shelf];
    r.goal = sh.home; r.goalType = 'pod'; r.state = 'toPick'; r.path = [];
    return;
  }
  if (r.battery < 85 && r.cargo < 0) goCharge(g, r);
}
function goCharge(g, r) {
  const c = nearestFree(g, r.cell, g.chargers);
  if (!c) return false;
  c.target = r.id;
  r.goal = c.cell; r.goalType = 'charge'; r.state = 'toCharge'; r.path = [];
  return true;
}
function abortJob(g, r) {
  for (const c of r.claims) {
    const o = findOrder(g, c.o);
    if (o && o.lines[c.i]) o.lines[c.i].claimed = -1;
    if (r.job && g.shelves[r.job.shelf]) g.shelves[r.job.shelf].stock += c.qty;
  }
  if (r.job && g.shelves[r.job.shelf]) g.shelves[r.job.shelf].reservedBy = -1;
  r.claims = []; r.job = null; r.state = 'idle'; r.goal = -1; r.path = [];
}
function arrive(g, r) {
  const s = r.state;
  if (s === 'toPick') {
    const sh = r.job ? g.shelves[r.job.shelf] : null;
    if (!sh || sh.home !== r.cell || sh.carriedBy >= 0) { abortJob(g, r); return; }
    g.shelfAt[sh.home] = -1; sh.carriedBy = r.id; r.cargo = sh.id;
    if (r.job.type === 'pick') {
      const st = nearestFree(g, r.cell, g.stations);
      if (!st) { dropShelf(g, r); return; }
      st.target = r.id; r.station = st.cell; r.goal = st.cell; r.goalType = 'station'; r.state = 'toStation';
    } else {
      const dk = nearestFree(g, r.cell, g.docks);
      if (!dk) { dropShelf(g, r); return; }
      r.dockCell = dk.cell; r.goal = dk.cell; r.goalType = 'dock'; r.state = 'toDock';
    }
    r.path = [];
    return;
  }
  if (s === 'toStation') {
    const st = stationAt(g, r.cell);
    if (!st) { r.state = 'toHome'; r.goal = g.shelves[r.job.shelf].home; r.path = []; return; }
    st.occ = r.id; st.target = -1;
    let units = 0, work = 0.5;
    for (const c of r.claims) { units += c.qty; work += c.qty * SKUS[c.sku].unitTime; }
    const eff = Math.max(0.08, st.workers * (1 - 0.45 * st.fatigue) * (g.breakUntil > g.t ? 0.0 : 1) * (perk('pro_pick') ? 1.15 : 1));
    r.timer = work / eff + (g.breakUntil > g.t ? 9999 : 0) * 0;
    r.timer = Math.min(r.timer, 60);
    r.units = units;
    r.state = 'picking'; r.goal = -1; r.path = [];
    return;
  }
  if (s === 'toHome') { dropShelf(g, r); return; }
  if (s === 'toDock') {
    const dk = dockAt(g, r.cell);
    if (!dk) { abortShelfReturn(g, r); return; }
    if (g.t >= dk.blockedUntil) deliverRestock(g, r, dk);
    else { r.state = 'dockWait'; r.goal = -1; r.path = []; }
    return;
  }
  if (s === 'toCharge') {
    const c = chargerAt(g, r.cell);
    if (!c) { r.state = 'idle'; r.goal = -1; r.path = []; return; }
    c.occ = r.id; c.target = -1; r.state = 'charging'; r.goal = -1; r.path = [];
    return;
  }
  if (s === 'toService') {
    const rp = repairAt(g, r.cell);
    if (!rp) { r.state = 'idle'; r.goal = -1; r.path = []; return; }
    rp.occ = r.id; rp.target = -1; r.state = 'servicing'; r.timer = 8; r.goal = -1; r.path = [];
    return;
  }
  r.goal = -1; r.path = [];
}
function abortShelfReturn(g, r) {
  const sh = r.job ? g.shelves[r.job.shelf] : null;
  if (sh) { r.state = 'toHome'; r.goal = sh.home; r.path = []; }
  else { r.state = 'idle'; r.goal = -1; r.cargo = -1; r.job = null; }
}
function dropShelf(g, r) {
  const sh = r.job ? g.shelves[r.job.shelf] : null;
  if (!sh) { r.cargo = -1; r.job = null; r.state = 'idle'; r.goal = -1; r.path = []; return; }
  // stand-in if the home is taken (should not happen): stay and retry
  if (g.shelfAt[sh.home] >= 0 && g.shelfAt[sh.home] !== sh.id) return;
  g.shelfAt[sh.home] = sh.id;
  sh.carriedBy = -1; sh.reservedBy = -1;
  r.cargo = -1; r.job = null; r.claims = [];
  r.state = 'idle'; r.goal = -1; r.path = [];
  spark(g, sh.home, '#94a3b8', 4);
}
function deliverRestock(g, r, dk) {
  const sh = g.shelves[r.job.shelf];
  if (!sh) { abortShelfReturn(g, r); return; }
  const need = sh.cap - sh.stock;
  const cost = need * SKUS[sh.sku].price * UNIT_COST;
  sh.stock = sh.cap;
  g.cash -= cost; g.stat.costs.restock += cost;
  g.stat.restocks++; g.stat.restockUnits += need; g.totals.picks += 0;
  floatText(dk.cell, '−' + money(cost), '#f472b6');
  spark(g, dk.cell, SKUS[sh.sku].color, 8);
  r.state = 'toHome'; r.goal = sh.home; r.path = []; r.goalType = 'pod';
  play('deliver');
}
function finishPicking(g, r) {
  const st = stationAt(g, r.cell);
  if (st) { st.occ = -1; st.fatigue = Math.min(1, st.fatigue + (r.units || 0) * 0.0022); st.served++; }
  const sh = r.job ? g.shelves[r.job.shelf] : null;
  let units = 0;
  for (const c of r.claims) {
    units += c.qty;
    const o = findOrder(g, c.o);
    if (!o) continue;
    const L = o.lines[c.i];
    if (!L) continue;
    L.claimed = -1;
    if (o.status === 'open') {
      L.done = true; o.left--;
      if (o.left <= 0) shipOrder(g, o, r.cell);
    } else if (sh) {
      sh.stock = Math.min(sh.cap, sh.stock + c.qty); // lost order: return stock to pod
    }
  }
  g.stat.picks++; g.stat.units += units; g.totals.picks++; g.totals.units += units;
  r.stats.picks++; r.stats.units += units;
  r.claims = [];
  spark(g, r.cell, sh ? SKUS[sh.sku].color : '#facc15', 10);
  play('pick');
  if (!sh) { r.state = 'idle'; r.job = null; r.cargo = -1; r.goal = -1; r.path = []; return; }
  r.state = 'toHome'; r.goal = sh.home; r.path = []; r.goalType = 'pod';
}
function chargeTick(g, r) {
  const dm = 1;
  const rate = 1.2 * (perk('charge_eff') ? 1.12 : 1) * (1 + 0.1 * g.pack) * g.chargeScale * dm;
  const add = Math.min(rate, 100 - r.battery);
  r.battery = Math.min(100, r.battery + rate);
  g.cash -= add * POWER_COST; g.stat.costs.power += add * POWER_COST;
  if (Math.random() < 0.25) spark(g, r.cell, '#34d399', 1, 'bolt');
  if (r.battery >= CHARGE_DONE) {
    const c = chargerAt(g, r.cell);
    if (c && c.occ === r.id) c.occ = -1;
    r.state = 'idle'; r.goal = -1; r.path = []; r.stats.charged++;
    play('charge');
  }
}
function robotTick(g, r) {
  const s = r.state;
  r.sinceMove += TICK;
  if (s === 'failed' || s === 'stranded') { r.waitFor = -1; r.waitTicks = 0; return; }
  g.stat.robotTicks++;
  if (s !== 'idle' && s !== 'charging' && s !== 'servicing') { g.stat.busyTicks++; r.stats.busy++; }
  if (s === 'charging') { chargeTick(g, r); return; }
  if (s === 'servicing') {
    r.timer -= TICK;
    if (r.timer <= 0) {
      r.wear = 0; r.state = 'idle'; r.goal = -1; r.path = [];
      const rp = repairAt(g, r.cell); if (rp && rp.occ === r.id) rp.occ = -1;
      g.cash -= SERVICE_FEE; g.stat.costs.parts += SERVICE_FEE;
      logMsg(g, robotName(r) + ' serviced. Wear reset.', 'good');
    }
    return;
  }
  if (s === 'picking') {
    r.timer -= TICK;
    if (r.timer <= 0) finishPicking(g, r);
    return;
  }
  if (s === 'dockWait') {
    const dk = dockAt(g, r.dockCell);
    if (!dk) { abortShelfReturn(g, r); return; }
    if (g.t >= dk.blockedUntil) deliverRestock(g, r, dk);
    return;
  }
  // movement-capable: idle (parked/unassigned), toPick, toStation, toHome, toDock, toCharge, toService
  if (s === 'idle' && r.goal < 0) {
    if (r.yieldReq) { r.yieldReq = false; sidestep(g, r); }
    r.battery = Math.max(0, r.battery - IDLE_DRAIN * (1 - 0.12 * g.pack));
    if (r.goal < 0) dispatch(g, r);
    if (r.goal < 0) { r.waitFor = -1; r.waitTicks = 0; checkStrand(g, r); return; }
  }
  if (r.cell === r.goal && r.path.length === 0 && r.goal >= 0) { arrive(g, r); return; }
  if (r.moveCd > 0) { r.moveCd--; return; }
  if (r.path.length === 0) {
    replan(g, r);
    if (r.path.length === 0) {
      if (r.cell === r.goal) { arrive(g, r); return; }
      r.waitTicks++;
      if (r.goal >= 0 && r.waitTicks % 20 === 0) {
        // unreachable goal: re-dispatch to a different job
        if (r.job) abortJob(g, r); else { r.goal = -1; r.state = 'idle'; }
      }
      return;
    }
  }
  const res = tryStep(g, r);
  if (res === 'moved') {
    r.moveCd = moveTicks(g) - 1; r.waitTicks = 0; r.waitFor = -1;
  } else if (res === 'blocked') {
    r.waitTicks++;
    r.battery = Math.max(0, r.battery - WAIT_DRAIN);
    const b = robotById(g, r.waitFor);
    if (b && b.state === 'idle' && r.waitTicks >= 4) b.yieldReq = true;
    if (r.waitTicks % 8 === 0) replan(g, r);
  } else {
    r.waitFor = -1;
    replan(g, r);
    r.waitTicks++;
  }
  checkStrand(g, r);
}
function checkStrand(g, r) {
  if (r.battery <= 0 && r.state !== 'charging' && r.state !== 'failed' && r.state !== 'stranded') {
    r.prevState = r.state; r.state = 'stranded'; r.waitFor = -1; r.waitTicks = 0; r.techAssigned = false;
    g.stat.strandings++; g.totals.strandings++;
    logMsg(g, robotName(r) + ' stranded with an empty battery. Tow required.', 'bad');
    alertBox(robotName(r) + ' stranded: battery empty', 'bad');
    play('fail');
    tip(g, 'strand', 'A stranded robot blocks its aisle until a technician tows it. Add chargers or lower the charge threshold to prevent this.');
    spark(g, r.cell, '#94a3b8', 10, 'smoke');
  }
}
function failRobot(g, r, cause) {
  if (r.state === 'failed' || r.state === 'stranded') return;
  r.prevState = r.state; r.state = 'failed'; r.waitFor = -1; r.waitTicks = 0; r.techAssigned = false;
  r.stats.fails++; g.stat.fails++; g.totals.fails++;
  const xy = xyOf(g, r.cell);
  logMsg(g, robotName(r) + ' FAILED (' + cause + ') at (' + xy.x + ',' + xy.y + '). Aisle blocked until repaired.', 'bad');
  alertBox(robotName(r) + ' failed (' + cause + '). Technician dispatched.', 'bad');
  play('fail');
  floatText(r.cell, 'FAULT', '#f87171');
  spark(g, r.cell, '#ef4444', 14, 'smoke');
  tip(g, 'fail', 'Failed robots block their cell. Technicians repair them, but backlog jams aisles. A lower service threshold reduces breakdowns.');
}
function techTick(g) {
  const base = g.chargers.length ? g.chargers[0].cell : (g.repairs.length ? g.repairs[0].cell : 0);
  for (const t of g.techs) {
    if (t.busy >= 0) {
      const r = robotById(g, t.busy);
      if (!r) { t.busy = -1; continue; }
      t.timer -= TICK;
      if (t.timer <= 0) { repairRobot(g, r); t.busy = -1; }
    } else {
      let best = null, bd = 1e9;
      for (const r of g.robots) {
        if ((r.state === 'failed' || r.state === 'stranded') && !r.techAssigned) {
          const d = manh(g, base, r.cell);
          if (d < bd) { bd = d; best = r; }
        }
      }
      if (best) {
        best.techAssigned = true; t.busy = best.id;
        t.timer = 0.4 * bd + (best.state === 'failed' ? 8 : 12);
      }
    }
  }
}
function repairRobot(g, r) {
  const wasStr = r.state === 'stranded';
  const restore = r.prevState || 'idle';
  r.state = restore; r.prevState = null; r.techAssigned = false;
  r.wear = Math.max(0, r.wear * 0.25);
  if (wasStr) { r.battery = Math.max(r.battery, 25); g.cash -= TOW_FEE; g.stat.costs.parts += TOW_FEE; }
  else { g.cash -= PARTS_FAIL; g.stat.costs.parts += PARTS_FAIL; }
  r.path = []; r.moveCd = 0; r.waitTicks = 0; r.waitFor = -1;
  if (restore === 'idle') r.goal = -1;
  logMsg(g, robotName(r) + ' repaired and back in service.', 'good');
  play('good');
  spark(g, r.cell, '#34d399', 10);
}

/* ---------------------------- deadlocks & gridlock ---------------------------- */
function detectDeadlocks(g) {
  const cycles = [];
  for (const r of g.robots) r.inDead = false;
  for (const r0 of g.robots) {
    if (r0.waitFor < 0 || r0.waitTicks < 1 || r0.markT === g.ticks) continue;
    const seq = []; let cur = r0;
    while (cur && cur.waitFor >= 0 && cur.waitTicks >= 1 && cur.markT !== g.ticks) {
      cur.markT = g.ticks; seq.push(cur);
      cur = robotById(g, cur.waitFor);
    }
    if (cur && cur.markT === g.ticks) {
      const k = seq.indexOf(cur);
      if (k >= 0) cycles.push(seq.slice(k));
    }
  }
  g.cycles = cycles.map(c => c.map(r => r.id));
  for (const cyc of cycles) {
    for (const r of cyc) r.inDead = true;
    const isNew = cyc.some(r => !r.wasDead);
    g.stat.deadlockTicks += cyc.length;
    cyc.forEach(r => { r.stats.deadTicks++; });
    if (isNew) {
      g.stat.deadlocks++; g.totals.deadlocks++;
      logMsg(g, 'DEADLOCK: ' + cyc.map(robotName).join(' → ') + ' → loop.', 'bad');
      alertBox('Deadlock: ' + cyc.map(robotName).join(' ↔ ') + ' are waiting in a loop', 'bad');
      play('alarm');
      tip(g, 'deadlock', 'Deadlock: robots wait in a loop and none can move. Paint one-way lanes (key 8) or buy Traffic Control AI to clear them automatically.');
    }
    const maxW = Math.max.apply(null, cyc.map(r => r.waitTicks));
    const limit = g.trafficAI ? 1 : 25;
    if (maxW >= limit) {
      const order = cyc.slice().sort((a, b) => (b.waitTicks - a.waitTicks) || (a.id - b.id));
      for (const v of order) {
        if (sidestep(g, v)) {
          g.stat.resolved++;
          logMsg(g, robotName(v) + ' sidesteps to break the deadlock.', 'warn');
          spark(g, v.cell, '#fbbf24', 6);
          break;
        }
      }
    }
  }
  for (const r of g.robots) r.wasDead = r.inDead;
}
function checkFailures(g) {
  if (g.over) return;
  if (g.cash < 0) g.bankrupt += TICK; else g.bankrupt = Math.max(0, g.bankrupt - TICK * 2);
  if (g.cash < -2500 || g.bankrupt >= 25) return gameOver(g, 'bankrupt');
  if (g.rep <= 0) return gameOver(g, 'walkout');
  const active = g.robots.filter(r => r.state !== 'failed' && r.state !== 'stranded' && r.state !== 'idle').length;
  const working = active > 0 || g.robots.some(r => r.state === 'idle' && r.goal >= 0);
  if (working && g.movesRecent < 0.02 && openOrders(g) > 0) g.gridlock += TICK;
  else g.gridlock = Math.max(0, g.gridlock - TICK * 2);
  if (g.gridlock >= 25) return gameOver(g, 'gridlock');
}

/* ---------------------------- tick ---------------------------- */
function logicTick(g) {
  g.t += TICK; g.ticks++;
  const tm = g.t;
  for (const ev of g.schedule) if (!ev.done && tm >= ev.at) fireEvent(g, ev);
  for (let c = 0; c < g.N; c++) if (g.hazard[c] && g.hazard[c] !== 1 && tm >= g.hazard[c]) {
    g.hazard[c] = 0; floatText(c, 'cleared', '#34d399');
  }
  // orders
  if (openOrders(g) < 160 && rnd() < orderRate(g) * TICK) spawnOrder(g);
  updateOrders(g);
  // stations & docks
  for (const s of g.stations) {
    if (s.occ < 0 && s.fatigue > 0) s.fatigue = Math.max(0, s.fatigue - 0.0006);
  }
  // charging scale
  let chg = 0;
  for (const r of g.robots) if (r.state === 'charging') chg++;
  const brown = tm < g.brownUntil ? 0.45 : 1;
  g.chargeScale = Math.min(1, g.gridCap / Math.max(1, chg)) * brown;
  // failed-cell mask
  g.failedAt.fill(0);
  for (const r of g.robots) if (r.state === 'failed' || r.state === 'stranded') g.failedAt[r.cell] = 1;
  g.movesThisTick = 0;
  // robots in rotating order
  const n = g.robots.length;
  for (let k = 0; k < n; k++) {
    const r = g.robots[(k + g.ticks) % n];
    if (r) robotTick(g, r);
  }
  techTick(g);
  detectDeadlocks(g);
  g.movesRecent = g.movesRecent * 0.97 + g.movesThisTick;
  // traffic decay
  if (g.ticks % 5 === 0) for (let c = 0; c < g.N; c++) if (g.traffic[c] > 0) g.traffic[c] = Math.max(0, g.traffic[c] * 0.97 - 0.01);
  costsTick(g);
  // battery stats
  if (g.ticks % 10 === 0) for (const r of g.robots) { g.stat.battSum += r.battery; g.stat.battN++; }
  checkFailures(g);
  if (g.ticks % 30 === 0) sample(g);
  if (!g.over && g.t >= SHIFT_MIN) endShift(g);
}
function sample(g) {
  const f = computeFill(g);
  const act = g.robots.filter(r => r.state !== 'idle' && r.state !== 'failed' && r.state !== 'stranded' && r.state !== 'charging').length;
  const avgB = g.robots.length ? g.robots.reduce((a, r) => a + r.battery, 0) / g.robots.length : 0;
  const H = g.hist;
  H.t.push(g.t); H.fill.push(f.fill * 100); H.active.push(g.robots.length ? act / g.robots.length * 100 : 0);
  H.batt.push(avgB); H.backlog.push(openOrders(g));
  if (H.t.length > 150) { H.t.shift(); H.fill.shift(); H.active.shift(); H.batt.shift(); H.backlog.shift(); }
}

/* ---------------------------- events & fx helpers ---------------------------- */
function logMsg(g, text, kind) {
  if (!g) return;
  g.log.unshift({ t: clockStr(g.t), text: text, kind: kind || 'info' });
  if (g.log.length > 160) g.log.length = 160;
  g.dirty = true;
  if (UI.tab === 'log') UI.lastSide = 0;
}
function spark(g, cell, color, n, kind) {
  if (!SET.particles || SET.reduced || !g) return;
  const xy = xyOf(g, cell);
  for (let i = 0; i < (n || 6); i++) {
    if (FX.parts.length > 420) FX.parts.shift();
    const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.4;
    FX.parts.push({ x: xy.x, y: xy.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'smoke' ? 0.4 : 0.6),
      life: 0.6 + Math.random() * 0.5, max: 1.1, color: color, size: kind === 'smoke' ? 0.22 : 0.09, kind: kind || 'spark' });
  }
}
function floatText(cell, text, color) {
  if (!G || !SET.particles) return;
  const xy = xyOf(G, cell);
  FX.floats.push({ x: xy.x, y: xy.y - 0.2, text: text, color: color, life: 1.6 });
  if (FX.floats.length > 40) FX.floats.shift();
}
function toast(text, kind, ms) {
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.textContent = text;
  box.appendChild(el);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(function () { el.style.opacity = '0'; setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 450); }, ms || 3600);
}
function alertBox(text, kind) {
  const box = $('#alerts'); if (!box) return;
  const el = document.createElement('div');
  el.className = 'alert ' + (kind || '');
  el.textContent = text;
  box.appendChild(el);
  while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 4200);
}

/* ---------------------------- shifts & outcomes ---------------------------- */
function shiftTarget(g) {
  const sh = SCENARIOS[g.scn].shifts[g.shiftIdx];
  return clamp(sh.target + DIFFS[g.diff].target, 0.5, 0.99);
}
function startShift(g, isRetry) {
  g.over = null; g.t = 0; g.ticks = g.ticks || 0;
  g.orders = []; g.stat = emptyStat(); g.hist = { t: [], fill: [], active: [], batt: [], backlog: [] };
  g.rushUntil = -1; g.breakUntil = -1; g.brownUntil = -1; g.bankrupt = 0; g.gridlock = 0; g.movesRecent = 0;
  g.hazard.fill(0);
  g.docks.forEach(d => { d.blockedUntil = -1; });
  g.schedule = makeSchedule(g);
  // overnight slotting
  if (g.pendingPolicy) {
    const changed = assignSlots(g, g.pendingPolicy);
    const cost = changed * 14;
    g.cash -= cost; g.stat.costs.labor += cost;
    g.shelves.forEach(s => { if (s && s.sku != null) s.stock = Math.max(s.stock, Math.round(s.cap * 0.5)); });
    logMsg(g, 'Overnight re-slot to ' + g.pendingPolicy + ': ' + changed + ' pods relabelled (' + money(cost) + ').', 'info');
    g.policy = g.pendingPolicy; g.pendingPolicy = null;
  }
  const S = SCENARIOS[g.scn], sh = S.shifts[g.shiftIdx];
  logMsg(g, '=== ' + sh.name + ' started. Target: ' + pct(shiftTarget(g)) + ' on-time fill. ===', 'info');
  if (sh.capstone) logMsg(g, 'CAPSTONE: Peak demand at 2.2×. Hold ' + pct(shiftTarget(g)) + ' or the contract is lost.', 'warn');
  if (!isRetry) { UI.checkpoint = JSON.stringify(g); }
  g.dirty = true;
  play('shift');
}
function endShift(g) {
  if (g.over) return;
  const S = SCENARIOS[g.scn], sh = S.shifts[g.shiftIdx];
  const f = computeFill(g);
  const target = shiftTarget(g);
  const cost = totalCost(g.stat);
  const profit = g.stat.revenue - cost;
  const pass = f.fill >= target;
  // unresolved orders at close count as lost for the contract
  g.orders.forEach(o => { if (o.status === 'open') { o.status = 'lost'; g.stat.lost++; } });
  const util = g.stat.robotTicks ? g.stat.busyTicks / g.stat.robotTicks : 0;
  const avgBatt = g.stat.battN ? g.stat.battSum / g.stat.battN : 100;
  let stars = 0;
  if (pass) {
    stars = 1;
    if (f.fill >= target + 0.07 && g.stat.deadlocks <= 3) stars++;
    if (f.fill >= 0.95 && profit > 0 && g.stat.strandings === 0) stars++;
  }
  const rp = pass ? 2 + stars : 0;
  g.lastStars = stars;
  g.totals.created += 0;
  g.totals.onTime += g.stat.onTime; g.totals.late += g.stat.late; g.totals.lost += g.stat.lost;
  g.totals.revenue += g.stat.revenue; g.totals.cost += cost;
  g.over = { type: 'shift', pass: pass, fill: f.fill, target: target, stars: stars, rp: rp, profit: profit, cost: cost, util: util, avgBatt: avgBatt, shift: sh.name, capstone: !!sh.capstone, last: g.shiftIdx === S.shifts.length - 1 };
  // campaign progress
  CAM.shifts++; CAM.orders += g.stat.created;
  CAM.deadlocks += g.stat.deadlocks;
  CAM.bestFill = Math.max(CAM.bestFill || 0, f.fill);
  const key = g.scn + ':' + g.diff;
  CAM.best[key] = Math.max(CAM.best[key] || 0, pass ? stars : 0, 0);
  if (pass) CAM.rp += rp;
  saveCampaign();
  saveGameState();
  if (!pass) { gameOver(g, 'breach'); return; }
  if (sh.capstone || g.shiftIdx === S.shifts.length - 1) { victory(g); return; }
  UI.hold = 'report';
  showReport(g);
}
function gameOver(g, why) {
  if (g.over && g.over.type !== 'shift') return;
  g.over = { type: 'fail', why: why, fill: computeFill(g).fill, target: shiftTarget(g), shift: SCENARIOS[g.scn].shifts[g.shiftIdx].name };
  UI.hold = 'fail';
  CAM.failures++; saveCampaign();
  Store.remove(KEY_SAVE);
  play('fail');
  showFail(g);
}
function victory(g) {
  const S = SCENARIOS[g.scn];
  const stars = g.lastStars || 1;
  const firstWin = !CAM.unlocked[g.scn + '_won' + g.diff];
  let bonus = 6;
  CAM.wins++;
  CAM.rp += bonus + (firstWin ? 6 : 0);
  if (g.scn === 'starter') CAM.unlocked.midmarket = true;
  if (g.scn === 'midmarket') CAM.unlocked.megahub = true;
  if (g.diff !== 'easy') CAM.hardUnlocked = true;
  CAM.unlocked[g.scn + '_won' + g.diff] = true;
  saveCampaign();
  const f = computeFill(g);
  g.over = { type: 'victory', scn: g.scn, scnName: S.name, diff: g.diff, rp: bonus + (firstWin ? 6 : 0), fill: f.fill, stars: stars, totals: g.totals, stat: g.stat, cash: g.cash, rep: g.rep, lastFill: f.fill };
  UI.hold = 'end';
  play('fanfare');
  Store.remove(KEY_SAVE);
  showVictory(g);
}

/* ---------------------------- save/load ---------------------------- */
function saveGameState(silent) {
  if (!G) return false;
  try {
    const payload = { v: 3, game: JSON.stringify(G), checkpoint: UI.checkpoint, savedAt: Date.now() };
    const ok = Store.set(KEY_SAVE, payload);
    if (!silent) toast(ok ? 'Game saved.' : 'Saved in memory (storage unavailable).', ok ? 'good' : 'warn');
    return ok;
  } catch (e) { return false; }
}
function loadSave() {
  const p = Store.get(KEY_SAVE, null);
  if (!p || !p.game) return null;
  return p;
}
function restoreFromString(str) {
  const g = JSON.parse(str);
  if (!g || !g.W || !g.type) throw new Error('bad save');
  G = g; RNGOBJ = g;
  UI.paused = false; UI.hold = null; UI.selected = null; FX.parts = []; FX.floats = [];
  G.over = null;
  G.hist = G.hist || { t: [], fill: [], active: [], batt: [], backlog: [] };
  G.failedAt = G.failedAt || new Array(G.N).fill(0);
  G.cycles = G.cycles || [];
  G.dirty = true;
  return g;
}

/* ---------------------------- UI: screens ---------------------------- */
function showScreen(name) {
  UI.screen = name;
  ['title', 'select', 'research', 'help', 'settings', 'game'].forEach(n => {
    const el = $('#scr-' + n); if (el) el.classList.toggle('active', n === name);
  });
  if (name === 'title') refreshTitle();
  if (name === 'select') buildSelect();
  if (name === 'research') buildResearch();
  if (name === 'settings') refreshSettings();
  if (name !== 'game') closeAllOverlays();
  if (name === 'game') resizeCanvas();
}
function openOv(id) { const el = $('#' + id); if (el) el.classList.add('open'); }
function closeOv(id) { const el = $('#' + id); if (el) el.classList.remove('open'); }
function closeAllOverlays() { ['ovPause', 'ovReport', 'ovShop', 'ovEnd', 'ovFail'].forEach(closeOv); }

function refreshTitle() {
  const has = !!loadSave();
  $('#btnContinue').classList.toggle('hidden', !has);
  const sum = $('#campSummary');
  const ok = Store.ok ? '' : ' <span class="warn">(progress is not saved: storage unavailable)</span>';
  sum.innerHTML = '<span>Research points <b>' + CAM.rp + '</b></span><span>Campaign wins <b>' + CAM.wins +
    '</b></span><span>Shifts run <b>' + CAM.shifts + '</b></span><span>Orders shipped/processed <b>' + CAM.orders.toLocaleString('en-US') +
    '</b></span>' + (Store.ok ? '' : ok);
}
function buildSelect() {
  const cards = $('#scnCards');
  let html = '';
  Object.keys(SCENARIOS).forEach(id => {
    const S = SCENARIOS[id];
    const locked = !CAM.unlocked[id];
    const sel = UI.scn === id;
    const best = CAM.best[id + ':' + UI.diff] || 0;
    html += '<div class="panel card' + (sel ? ' sel' : '') + (locked ? ' locked' : '') + '" data-scn="' + id + '">' +
      '<div class="thumb"><canvas data-thumb="' + id + '"></canvas></div>' +
      '<div class="row"><h3 style="margin:0;color:var(--text);text-transform:none;font-size:16px">' + esc(S.name) + '</h3><span class="spacer"></span>' +
      (locked ? '<span class="muted small">🔒 locked</span>' : '<span class="stars">' + '★'.repeat(best) + '<span class="muted">' + '☆'.repeat(3 - best) + '</span></span>') + '</div>' +
      '<p class="small muted" style="margin:0">' + esc(S.blurb) + '</p>' +
      '<div class="small muted">' + S.shifts.length + ' shifts · ' + S.robots + ' robots · ' + S.map[0].length + '×' + S.map.length + ' floor' +
      (id === 'megahub' ? ' · ends in a <b style="color:var(--amber)">capstone</b>' : '') + '</div>' +
      (locked ? '<div class="small warn">' + (id === 'midmarket' ? 'Win Starter Depot to unlock.' : 'Win Mid-Market Fulfillment to unlock.') + '</div>' : '') +
      '</div>';
  });
  setHTML(cards, html);
  $$('#diffSeg button').forEach(b => b.classList.toggle('on', b.getAttribute('data-diff') === UI.diff));
  const d = DIFFS[UI.diff];
  $('#diffBlurb').textContent = d.label + ': ' + d.blurb;
  $('#scnBlurb').textContent = SCENARIOS[UI.scn].blurb;
  $('#selRp').textContent = 'RP ' + CAM.rp;
  const lock = !CAM.unlocked[UI.scn];
  $('#btnLaunch').disabled = lock;
  $$('[data-scn]', cards).forEach(el => {
    const canvas = $('canvas', el);
    if (canvas) drawThumb(canvas, el.getAttribute('data-scn'));
  });
}
function drawThumb(canvas, id) {
  const S = SCENARIOS[id]; if (!S) return;
  const w = canvas.clientWidth || 260, h = canvas.clientHeight || 110;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const c = canvas.getContext('2d'); if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const H = S.map.length, W = S.map[0].length;
  const cs = Math.min(w / W, h / H);
  const ox = (w - W * cs) / 2, oy = (h - H * cs) / 2;
  c.fillStyle = '#0a1322'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = S.map[y][x];
    let col = '#16223a';
    if (ch === '#') col = '#05080f';
    else if (ch === 'S') col = '#2f6f91';
    else if (ch === 'P') col = '#f5b400';
    else if (ch === 'C') col = '#22c55e';
    else if (ch === 'D') col = '#e7c64a';
    else if (ch === 'R') col = '#a78bfa';
    c.fillStyle = col;
    c.fillRect(ox + x * cs + 0.5, oy + y * cs + 0.5, cs - 1, cs - 1);
  }
}
function buildResearch() {
  $('#resRp').textContent = 'RP balance: ' + CAM.rp;
  let html = '';
  PERKS.forEach(p => {
    const owned = perk(p.id);
    const canBuy = !owned && CAM.rp >= p.cost;
    html += '<div class="panel perk' + (owned ? ' owned' : '') + '"><div class="row"><b>' + esc(p.name) + '</b><span class="spacer"></span>' +
      (owned ? '<span class="good small">✔ owned</span>' : '<span class="warn small">' + p.cost + ' RP</span>') + '</div>' +
      '<p class="small muted" style="margin:0">' + esc(p.desc) + '</p>' +
      (owned ? '' : '<button data-perk="' + p.id + '" ' + (canBuy ? '' : 'disabled') + '>' + (canBuy ? 'Research' : 'Need ' + (p.cost - CAM.rp) + ' more RP') + '</button>') +
      '</div>';
  });
  setHTML($('#perkGrid'), html);
}
function refreshSettings() {
  $('#setMaster').value = SET.master; $('#setMusic').value = SET.music; $('#setSfx').value = SET.sfx;
  $('#setSound').checked = !!SET.sound; $('#setParticles').checked = !!SET.particles;
  $('#setReduced').checked = !!SET.reduced; $('#setCoach').checked = !!SET.coach;
  $('#lblMaster').textContent = pct(SET.master); $('#lblMusic').textContent = pct(SET.music); $('#lblSfx').textContent = pct(SET.sfx);
  $('#storeNote').textContent = Store.ok ? 'Settings and campaign progress are stored in this browser.' : 'Storage unavailable: progress lasts only for this session.';
}

/* ---------------------------- UI: game setup ---------------------------- */
function startNewRun(scn, diff) {
  auInit();
  G = newGame(scn, diff);
  UI.paused = false; UI.hold = null; UI.selected = null; UI.speed = 1; UI.tool = 'select';
  UI.cam = { zoom: 1, panX: 0, panY: 0 };
  FX.parts = []; FX.floats = []; UI.acc = 0;
  G.dirty = true;
  showScreen('game');
  buildTools();
  buildLegend();
  startShift(G, false);
  setSpeedButtons();
  if (SCENARIOS[scn].tutorial && SET.coach && !CAM.coachHidden) toast('Welcome to the Starter Depot. Watch the coach panel for your first objectives.', 'tip', 6000);
  saveGameState(true);
  updateHUD(true);
  refreshShopIfOpen();
}
function continueSave() {
  auInit();
  const p = loadSave();
  if (!p) return;
  try {
    restoreFromString(p.game);
    UI.checkpoint = p.checkpoint || UI.checkpoint || p.game;
  } catch (e) { toast('Save was unreadable. Starting a new run instead.', 'bad'); Store.remove(KEY_SAVE); return; }
  UI.paused = false; UI.hold = null; UI.speed = 1; UI.tool = 'select';
  G.over = null;
  showScreen('game'); buildTools(); buildLegend(); setSpeedButtons();
  toast('Save loaded — ' + SCENARIOS[G.scn].shifts[G.shiftIdx].name, 'good');
  updateHUD(true);
}
function retryShift() {
  if (!UI.checkpoint) { toast('No checkpoint for this shift.', 'warn'); return; }
  try {
    restoreFromString(UI.checkpoint);
  } catch (e) { toast('Could not restore the checkpoint.', 'bad'); return; }
  G.over = null; UI.hold = null; UI.paused = false;
  closeAllOverlays();
  G.hold = false;
  startShift(G, true);
  updateHUD(true);
  toast('Shift restarted from its opening state.', 'good');
}
function restartCampaign() {
  closeAllOverlays();
  startNewRun(UI.scn, UI.diff);
}

/* ---------------------------- UI: reports & shop ---------------------------- */
function showReport(g) {
  const o = g.over;
  const S = SCENARIOS[g.scn];
  const f = computeFill(g);
  const st = g.stat;
  const grade = '★'.repeat(o.stars) + '☆'.repeat(3 - o.stars);
  const profit = o.profit;
  const kv = (k, v, cls) => '<tr><td>' + k + '</td><td class="' + (cls || '') + '">' + v + '</td></tr>';
  let html = '<div class="row"><div><div class="muted small">Shift ' + (g.shiftIdx + 1) + ' of ' + S.shifts.length + ' · ' + esc(o.shift) + '</div><h2 style="margin:0">Shift report</h2></div><span class="spacer"></span><div class="grade">' + grade + '</div></div>';
  html += '<div class="verdict"><b class="' + (o.pass ? 'good' : 'bad') + '">' + (o.pass ? 'Target met' : 'Below target') + '</b> — on-time fill <b>' + pct(f.fill) + '</b> vs target <b>' + pct(o.target) + '</b>. ' +
    (o.pass ? 'Earned <b>' + o.rp + ' RP</b>.' : '') + '</div>';
  html += '<div class="report-cols" style="margin-top:12px"><div><h3>Service</h3><table class="kv">' +
    kv('Orders created', st.created) + kv('Shipped on time', st.onTime, 'good') + kv('Shipped late', st.late, st.late ? 'warn' : '') +
    kv('Cancelled', st.lost, st.lost ? 'bad' : '') + kv('Open past deadline', f.pastOpen, f.pastOpen ? 'warn' : '') +
    kv('Pods picked / units', st.picks + ' / ' + st.units) + kv('Restocks / units', st.restocks + ' / ' + st.restockUnits) + '</table></div>' +
    '<div><h3>Money</h3><table class="kv">' + kv('Revenue', money(st.revenue), 'good') +
    kv('Labour', money(-st.costs.labor)) + kv('Rent', money(-st.costs.rent)) + kv('Robot upkeep', money(-st.costs.upkeep)) +
    kv('Power', money(-st.costs.power)) + kv('Restock stock', money(-st.costs.restock)) + kv('Parts & tows', money(-st.costs.parts)) +
    kv('Penalties', money(-st.costs.penalties)) + kv('<b>Profit</b>', '<b>' + money(profit) + '</b>', profit >= 0 ? 'good' : 'bad') + '</table></div>' +
    '<div><h3>Robots</h3><table class="kv">' + kv('Robot-utilisation', pct(o.util)) + kv('Average battery', Math.round(o.avgBatt) + '%') +
    kv('Breakdowns', st.fails, st.fails ? 'warn' : '') + kv('Stranded', st.strandings, st.strandings ? 'bad' : '') + '</table></div>' +
    '<div><h3>Traffic</h3><table class="kv">' + kv('Deadlocks', st.deadlocks, st.deadlocks ? 'warn' : '') +
    kv('Deadlock robot-minutes', (st.deadlockTicks * TICK).toFixed(1)) + kv('Rush waves', g.rushCount) + kv('Robot moves', st.moves) + '</table></div></div>';
  html += '<h3>On-time fill over the shift</h3><canvas id="repChart" style="width:100%;height:120px;background:#0a1322;border:1px solid #1d2c47;border-radius:8px;display:block"></canvas>';
  html += '<p class="small muted">Tip: fill rate reflects only shipments and cancellations. A pod that runs empty during a supplier delay costs more than a late robot.</p>';
  setHTML($('#reportBody'), html);
  $('#btnNextShift').disabled = false;
  openOv('ovReport');
  setTimeout(function () { drawChart($('#repChart'), [{ data: g.hist.fill, color: '#34d399', min: 0, max: 100 }], { unit: '%' }); }, 30);
  g.dirty = true;
}
function refreshShopIfOpen() { if ($('#ovShop') && $('#ovShop').classList.contains('open')) buildShop(); }
function shopCost(id) {
  const it = SHOP.find(s => s.id === id); const S = SCENARIOS[G.scn];
  const lvl = currentLevel(id);
  return Math.round(it.base * S.costMult * (1 + lvl * (it.scale || 0.35)));
}
function currentLevel(id) {
  if (!G) return 0;
  if (id === 'robot') return G.robots.length;
  if (id === 'grid') return G.gridCap - SCENARIOS[G.scn].gridCap;
  if (id === 'pack') return G.pack;
  if (id === 'drive') return G.drive;
  if (id === 'picker') return G.stations.reduce((a, s) => a + Math.max(0, s.workers - 1), 0);
  if (id === 'tech') return G.techs.length - SCENARIOS[G.scn].techs;
  if (id === 'traffic') return G.trafficAI ? 1 : 0;
  return 0;
}
function buyShop(id) {
  if (!G) return;
  const it = SHOP.find(s => s.id === id);
  const lvl = currentLevel(id);
  if (lvl >= it.max) { toast('Already at maximum.', 'warn'); return; }
  const cost = shopCost(id);
  if (G.cash < cost) { toast('Not enough cash for ' + it.name + ' (' + money(cost) + ').', 'bad'); play('warn'); return; }
  if (id === 'robot') {
    if (G.robots.length >= MAX_ROBOTS) { toast('Robot cap reached.', 'warn'); return; }
    const c = spawnNearCharger(G);
    if (c < 0) { toast('No free aisle to deploy a robot.', 'bad'); return; }
    newRobot(G, c);
    logMsg(G, 'Deployed ' + robotName(G.robots[G.robots.length - 1]) + ' from the charging bay.', 'good');
  } else if (id === 'grid') G.gridCap += 1;
  else if (id === 'pack') G.pack += 1;
  else if (id === 'drive') G.drive += 1;
  else if (id === 'picker') {
    const st = G.stations.slice().sort((a, b) => a.workers - b.workers)[0];
    if (!st || st.workers >= 3) { toast('Stations are fully staffed.', 'warn'); return; }
    st.workers += 1;
  } else if (id === 'tech') G.techs.push({ busy: -1, timer: 0 });
  else if (id === 'traffic') G.trafficAI = true;
  G.cash -= cost;
  G.stat.costs.labor += 0;
  logMsg(G, 'Purchased: ' + it.name + ' (' + money(cost) + ').', 'good');
  play('click');
  floatText(G.stations.length ? G.stations[0].cell : 0, '−' + money(cost), '#fbbf24');
  buildShop(); updateHUD(true);
}
function buildShop() {
  if (!G) return;
  $('#shopCash').textContent = 'Cash ' + money(G.cash);
  let html = '';
  SHOP.forEach(it => {
    const lvl = currentLevel(it.id);
    const maxed = lvl >= it.max;
    const cost = shopCost(it.id);
    const can = !maxed && G.cash >= cost;
    html += '<div class="shop-item"><div class="row"><b>' + esc(it.name) + '</b><span class="spacer"></span><span class="small muted">Lv ' + lvl + '/' + it.max + '</span></div>' +
      '<div class="small muted" style="min-height:34px">' + esc(it.desc) + '</div>' +
      '<div class="row"><span class="price">' + (maxed ? 'MAX' : money(cost)) + '</span><span class="spacer"></span>' +
      '<button data-buy="' + it.id + '" ' + (can ? '' : 'disabled') + '>' + (maxed ? 'Owned' : 'Buy') + '</button></div></div>';
  });
  setHTML($('#shopGrid'), html);
  let ph = '';
  const pols = [
    { id: 'random', name: 'Random', ok: true, desc: 'Pods hold random SKUs.' },
    { id: 'velocity', name: 'Velocity (ABC)', ok: perk('slot_velocity'), desc: 'Fast movers nearest stations.' },
    { id: 'zoned', name: 'Zoned families', ok: perk('slot_zoned'), desc: 'SKU families grouped by aisle.' }
  ];
  pols.forEach(p => {
    const active = G.policy === p.id && !G.pendingPolicy;
    const pend = G.pendingPolicy === p.id;
    ph += '<button data-policy="' + p.id + '" class="' + (active || pend ? 'on' : '') + '" ' + (p.ok ? '' : 'disabled') + ' title="' + esc(p.desc) + '">' +
      (p.ok ? '' : '🔒 ') + esc(p.name) + (pend ? ' (queued)' : '') + '</button>';
  });
  setHTML($('#shopPolicy'), ph + '<span class="small muted">Applies at next shift start.</span>');
}

/* ---------------------------- victory & failure screens ---------------------------- */
function showVictory(g) {
  const o = g.over;
  const t = g.totals;
  const stars = o.stars;
  const fillPct = pct(o.fill);
  const profit = t.revenue - t.cost;
  let html = '<div class="muted small">Campaign complete · ' + esc(o.scnName) + ' · ' + o.diff.toUpperCase() + '</div>' +
    '<h2 style="margin:4px 0">' + (g.scn === 'megahub' ? 'PEAK SEASON SURVIVED' : 'SCENARIO CLEARED') + '</h2>' +
    '<div class="grade">' + '★'.repeat(stars) + '☆'.repeat(3 - stars) + '</div>' +
    '<p>' + (g.scn === 'megahub' ? 'You held the contract through the Peak Surge. Your fleet, slotting and traffic rules now run a real fulfilment centre.' :
      'Every shift target met. The next scenario is unlocked.') + '</p>' +
    '<div class="report-cols"><div><h3>Operations</h3><table class="kv">' +
    '<tr><td>Orders created</td><td>' + t.created + '</td></tr>' +
    '<tr><td>Shipped on time</td><td class="good">' + t.onTime + '</td></tr>' +
    '<tr><td>Shipped late</td><td class="warn">' + t.late + '</td></tr>' +
    '<tr><td>Cancelled</td><td class="bad">' + t.lost + '</td></tr>' +
    '<tr><td>Pods picked / units</td><td>' + t.picks + ' / ' + t.units + '</td></tr>' +
    '<tr><td>Robot moves</td><td>' + t.moves + '</td></tr>' +
    '</table></div><div><h3>Finance & reliability</h3><table class="kv">' +
    '<tr><td>Revenue</td><td class="good">' + money(t.revenue) + '</td></tr>' +
    '<tr><td>Total costs</td><td>' + money(-t.cost) + '</td></tr>' +
    '<tr><td>Net profit (campaign)</td><td class="' + (profit >= 0 ? 'good' : 'bad') + '">' + money(profit) + '</td></tr>' +
    '<tr><td>Deadlocks</td><td>' + t.deadlocks + '</td></tr>' +
    '<tr><td>Breakdowns / strandings</td><td>' + t.fails + ' / ' + t.strandings + '</td></tr>' +
    '<tr><td>Research points earned</td><td class="warn">+' + o.rp + '</td></tr>' +
    '</table></div></div>';
  setHTML($('#endModal'), html + '<div class="btns"><button id="btnEndTitle">Title</button><button id="btnEndSelect" class="primary">Choose next scenario</button></div>');
  closeOv('ovReport');
  openOv('ovEnd');
  $('#btnEndTitle').onclick = () => { play('click'); closeAllOverlays(); showScreen('title'); };
  $('#btnEndSelect').onclick = () => { play('click'); closeAllOverlays(); showScreen('select'); };
}
function showFail(g) {
  const o = g.over;
  const titles = { bankrupt: 'BANKRUPT', gridlock: 'GRIDLOCK', walkout: 'CLIENTS WALKED', breach: 'CONTRACT BREACH' };
  const why = {
    bankrupt: 'Cash stayed negative too long. Restock waste, idle robots, and an under-used floor drained the budget. Keep stock lean and throughput high.',
    gridlock: 'Robots stopped moving for 25 minutes. Deadlocks and a jammed choke-point locked the floor. Use one-way lanes, Traffic Control AI, and a service threshold that avoids breakdowns in aisles.',
    walkout: 'Reputation fell to zero. Customers pulled their volume. Keep late shipments rare.',
    breach: 'The shift closed below its on-time fill target (' + pct(o.target) + '). Your fill rate was ' + pct(o.fill) + '.'
  };
  const html = '<div class="muted small">' + esc(o.shift || SCENARIOS[g.scn].shifts[g.shiftIdx].name) + '</div>' +
    '<h2 style="color:var(--red);margin:4px 0">' + titles[o.why] + '</h2><p>' + why[o.why] + '</p>' +
    '<div class="small muted">Cash ' + money(g.cash) + ' · Reputation ' + Math.round(g.rep) + ' · Shift clock ' + clockStr(g.t) + '</div>' +
    '<div class="btns"><button id="btnFailTitle">Title</button><button id="btnFailRestart">New run</button><button id="btnFailRetry" class="primary">↺ Retry this shift</button></div>';
  setHTML($('#failModal'), html);
  closeOv('ovReport'); closeOv('ovPause');
  openOv('ovFail');
  $('#btnFailTitle').onclick = () => { play('click'); closeAllOverlays(); UI.hold = null; showScreen('title'); };
  $('#btnFailRestart').onclick = () => { play('click'); restartCampaign(); };
  $('#btnFailRetry').onclick = () => { play('click'); retryShift(); };
}
function nextShift() {
  if (!G) return;
  G.shiftIdx += 1;
  G.over = null; UI.hold = null; UI.paused = false;
  closeAllOverlays();
  startShift(G, false);
  updateHUD(true);
  saveGameState(true);
  toast('Shift started: ' + SCENARIOS[G.scn].shifts[G.shiftIdx].name, 'good');
}

/* ---------------------------- UI: tools, legend, HUD ---------------------------- */
function buildTools() {
  const box = $('#tools');
  let html = '';
  TOOLS.forEach(t => {
    html += '<button data-tool="' + t.id + '" data-tip="' + esc(t.tip) + '" class="' + (UI.tool === t.id ? 'on' : '') + '"><span class="ic">' + t.icon + '</span><span>' + t.label + '</span><span class="k">' + t.key + '</span></button>';
  });
  html += '<button data-overlay="1" data-tip="Overlay: traffic heat, then pick distance, then off (V)"><span class="ic">🌡</span><span>Overlay</span><span class="k" id="ovLbl">off</span></button>';
  setHTML(box, html);
  box.querySelectorAll('[data-overlay]').forEach(b => b.addEventListener('click', cycleOverlay));
}
function cycleOverlay() {
  UI.overlay = UI.overlay === 'off' ? 'traffic' : UI.overlay === 'traffic' ? 'pick' : 'off';
  const l = $('#ovLbl'); if (l) l.textContent = UI.overlay;
  buildLegend();
}
function buildLegend() {
  const items = [['#94a3b8', 'Idle'], ['#38bdf8', 'Moving'], ['#fb923c', 'Carrying'], ['#facc15', 'Picking'], ['#22c55e', 'Charging'], ['#a78bfa', 'Service'], ['#ef4444', 'Failed'], ['#64748b', 'Stranded']];
  let h = items.map(i => '<span><i style="background:' + i[0] + '"></i>' + i[1] + '</span>').join('');
  if (UI.overlay === 'traffic') h += '<span><i style="background:linear-gradient(90deg,#1e293b,#f87171)"></i>Traffic heat</span>';
  if (UI.overlay === 'pick') h += '<span><i style="background:linear-gradient(90deg,#22c55e,#ef4444)"></i>Pick distance (near → far)</span>';
  setHTML($('#legend'), h);
}
function setSpeedButtons() {
  $$('#speedBtns button').forEach(b => b.classList.toggle('on', Number(b.getAttribute('data-speed')) === UI.speed));
}
function updateHUD(force) {
  if (!G || UI.screen !== 'game') return;
  const S = SCENARIOS[G.scn], sh = S.shifts[G.shiftIdx];
  $('#hudScn').textContent = S.name + ' · ' + DIFFS[G.diff].label;
  $('#hudShift').textContent = 'Shift ' + (G.shiftIdx + 1) + '/' + S.shifts.length + ' · ' + sh.name + (sh.capstone ? ' ★ CAPSTONE' : '');
  $('#hudClock').textContent = clockStr(G.t) + '  ·  ' + Math.floor(G.t) + ' / ' + SHIFT_MIN + ' min';
  $('#hudBar').style.width = clamp(G.t / SHIFT_MIN * 100, 0, 100) + '%';
  const f = computeFill(G);
  const tgt = shiftTarget(G);
  const fillEl = $('#kFill');
  fillEl.textContent = pct(f.fill);
  fillEl.style.color = f.fill >= tgt ? 'var(--green)' : (f.fill >= tgt - 0.08 ? 'var(--amber)' : 'var(--red)');
  $('#kCash').textContent = money(G.cash);
  $('#kCash').style.color = G.cash < 0 ? 'var(--red)' : (G.cash < 1500 ? 'var(--amber)' : 'var(--text)');
  $('#kRep').textContent = Math.round(G.rep);
  $('#kRep').style.color = G.rep < 30 ? 'var(--red)' : (G.rep < 55 ? 'var(--amber)' : 'var(--text)');
  const working = G.robots.filter(r => r.state !== 'idle' && r.state !== 'failed' && r.state !== 'stranded' && r.state !== 'charging' && r.state !== 'servicing').length;
  $('#kFleet').textContent = working + '/' + G.robots.length;
  $('#btnPause').textContent = UI.paused || UI.hold ? '▶' : '⏸';
  $('#btnMute').textContent = (SET.muted || !SET.sound) ? '🔇' : '🔊';
  const fc = $('#forecast');
  const up = G.schedule.filter(e => !e.done).slice(0, 3);
  const evName = { rush: 'Rush wave', lunch: 'Lunch break', supplier: 'Supplier delay', spill: 'Pallet spill', brownout: 'Grid brownout', recall: 'Firmware recall' };
  let fh = '<span>Forecast:</span>';
  if (!up.length) fh += '<b>no more events this shift</b>';
  up.forEach(e => { fh += '<b>' + (evName[e.type] || e.type) + '</b> at ' + clockStr(e.at) + ' · '; });
  fh += '<span class="spacer" style="flex:1"></span><span>Pod low-stock: ' + G.shelves.filter(s => s && s.stock < s.cap * 0.4).length +
    ' · Open orders: <b>' + openOrders(G) + '</b> · Charging: <b>' + G.robots.filter(r => r.state === 'charging').length + '</b>' +
    (G.t < G.brownUntil ? ' · <b class="bad">BROWNOUT</b>' : '') + (G.t < G.breakUntil ? ' · <b class="warn">LUNCH</b>' : '') + '</span>';
  setHTML(fc, fh);
  if (UI.selected !== null) updateInspector();
  if (force || UI.screen === 'game') {
    if (G.over) return;
  }
}
function updateCoach() {
  const el = $('#coach');
  if (!G || UI.screen !== 'game') { el.classList.add('hidden'); return; }
  const S = SCENARIOS[G.scn];
  const show = S.tutorial && SET.coach && !CAM.coachHidden && G.shiftIdx === 0;
  if (!show) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const items = [
    { t: 'Watch a robot lift a pod and deliver it to the station (👷).', d: G.stat.picks >= 1 },
    { t: 'Ship 8 orders on time.', d: G.stat.onTime >= 8 },
    { t: 'Add a second charger (press 5, click a floor tile) so robots stop queueing.', d: G.chargers.length >= 2 },
    { t: 'Add a second pick station (press 4) once orders queue up.', d: G.stations.length >= 2 },
    { t: 'Keep the dock online. Restocks ship from the dock (🚚) when a pod drops below 40%.', d: G.stat.restocks >= 2 },
    { t: 'Paint at least 3 one-way lane tiles (press 8) to cut head-on deadlocks.', d: G.dir.filter(x => x).length >= 3 }
  ];
  const doneN = items.filter(i => i.d).length;
  const key = doneN + '|' + G.shiftIdx;
  if (UI.coachKey === key && el._h) return;
  UI.coachKey = key;
  let h = '<h4><span>Coach · first shift</span><button class="x" id="coachX" title="Hide coach">×</button></h4><ul>' +
    items.map(i => '<li class="' + (i.d ? 'done' : '') + '"><span class="box">' + (i.d ? '✓' : '') + '</span><span>' + esc(i.t) + '</span></li>').join('') + '</ul>' +
    '<p class="small muted" style="margin:6px 0 0">Target this shift: <b>' + pct(shiftTarget(G)) + '</b> on-time fill. ' + (doneN === items.length ? '<span class="good">Objectives complete — go for it.</span>' : '') + '</p>';
  setHTML(el, h);
  const x = $('#coachX'); if (x) x.onclick = () => { CAM.coachHidden = true; saveCampaign(); el.classList.add('hidden'); };
}
function updateInspector() {
  const el = $('#inspector');
  if (!G || UI.selected === null) { el.classList.add('hidden'); return; }
  const sel = UI.selected;
  let html = '';
  if (sel.kind === 'robot') {
    const r = robotById(G, sel.id);
    if (!r) { UI.selected = null; el.classList.add('hidden'); return; }
    const xy = xyOf(G, r.cell);
    html = '<h4><span style="color:' + 'hsl(' + r.hue + ',80%,65%)' + '">■ ' + robotName(r) + '</span><button class="x" data-close>×</button></h4>' +
      '<div>' + esc(STATE_LABEL[r.state] || r.state) + '</div>' +
      '<div class="small muted">Cell (' + xy.x + ',' + xy.y + ') · moves ' + r.stats.moves + ' · picks ' + r.stats.picks + ' · charged ' + r.stats.charged + '</div>' +
      barRow('Battery', r.battery, r.battery < 25 ? '#f87171' : '#34d399') +
      barRow('Wear (service at ' + G.pmThreshold + '%)', r.wear, r.wear >= G.pmThreshold ? '#f87171' : '#fbbf24') +
      (r.cargo >= 0 ? '<div class="small">Carrying pod: <b>' + SKUS[G.shelves[r.cargo].sku].name + '</b></div>' : '') +
      (r.waitTicks > 0 ? '<div class="small warn">Waiting ' + (r.waitTicks * TICK).toFixed(1) + ' min' + (r.waitFor >= 0 ? ' behind ' + robotName(robotById(G, r.waitFor) || { id: '?' }) : '') + '</div>' : '') +
      (r.inDead ? '<div class="small bad">In a deadlock loop</div>' : '') +
      '<div class="small muted">Deadlock time: ' + (r.stats.deadTicks * TICK).toFixed(1) + ' min</div>';
  } else if (sel.kind === 'shelf') {
    const s = G.shelves[sel.id];
    if (!s) { UI.selected = null; el.classList.add('hidden'); return; }
    const sku = SKUS[s.sku];
    html = '<h4><span style="color:' + sku.color + '">▣ ' + sku.name + ' pod</span><button class="x" data-close>×</button></h4>' +
      barRow('Stock', s.stock / s.cap * 100, s.stock / s.cap < 0.4 ? '#f87171' : '#34d399') +
      '<div class="small">' + s.stock + ' / ' + s.cap + ' units' + (s.carriedBy >= 0 ? ' · <span class="warn">in transit</span>' : '') + '</div>' +
      '<div class="small muted">Pick distance to nearest station: <b>' + (G.distSt[s.home] >= 999 ? '—' : G.distSt[s.home]) + '</b> cells · demand weight ' + sku.w + '</div>' +
      '<div class="small muted">Pending demand: ' + pendingBySku(G)[s.sku] + ' units</div>';
  } else if (sel.kind === 'station') {
    const st = stationAt(G, sel.cell);
    if (!st) { UI.selected = null; el.classList.add('hidden'); return; }
    html = '<h4><span>👷 Pick station</span><button class="x" data-close>×</button></h4>' +
      '<div class="small">Pickers: <b>' + st.workers + '</b> · served ' + st.served + ' pods</div>' +
      barRow('Fatigue', st.fatigue * 100, st.fatigue > 0.6 ? '#f87171' : '#fbbf24') +
      '<div class="small muted">Pick speed: ' + Math.round((1 - 0.45 * st.fatigue) * 100) + '% · ' + (G.t < G.breakUntil ? '<span class="warn">on lunch break</span>' : 'working') + '</div>';
  } else if (sel.kind === 'charger') {
    const c = chargerAt(G, sel.cell);
    if (!c) { UI.selected = null; el.classList.add('hidden'); return; }
    html = '<h4><span>⚡ Charging dock</span><button class="x" data-close>×</button></h4>' +
      '<div class="small">' + (c.occ >= 0 ? 'In use by ' + robotName(robotById(G, c.occ) || { id: '?' }) : 'Free') + '</div>' +
      '<div class="small muted">Grid: ' + G.gridCap + ' full-rate slots · scale ' + Math.round(G.chargeScale * 100) + '%' + (G.t < G.brownUntil ? ' · <b class="bad">brownout</b>' : '') + '</div>';
  } else if (sel.kind === 'dock') {
    const d = dockAt(G, sel.cell);
    if (!d) { UI.selected = null; el.classList.add('hidden'); return; }
    const off = G.t < d.blockedUntil;
    html = '<h4><span>🚚 Inbound dock</span><button class="x" data-close>×</button></h4>' +
      '<div class="small ' + (off ? 'bad' : 'good') + '">' + (off ? 'OFFLINE — supplier delay' : 'Online') + '</div>' +
      '<div class="small muted">Restocks fill a pod to ' + STORE_CAP + ' units at ' + Math.round(UNIT_COST * 100) + '% of retail.</div>';
  } else if (sel.kind === 'repair') {
    html = '<h4><span>🔧 Service bay</span><button class="x" data-close>×</button></h4><div class="small muted">Robots above ' + G.pmThreshold + '% wear are serviced here when idle (8 min, $' + SERVICE_FEE + ').</div>';
  } else {
    html = '<h4><span>Empty floor</span><button class="x" data-close>×</button></h4><div class="small muted">Cell (' + sel.x + ',' + sel.y + ')' +
      (G.hazard[sel.cell] ? ' · <span class="bad">spill</span>' : '') + (G.dir[sel.cell] ? ' · one-way ' + ['', '↑', '→', '↓', '←'][G.dir[sel.cell]] : '') +
      (G.traffic[sel.cell] > 1 ? ' · busy aisle (' + G.traffic[sel.cell].toFixed(0) + ')' : '') + '</div>';
  }
  setHTML(el, html);
  el.classList.remove('hidden');
  const x = el.querySelector('[data-close]'); if (x) x.onclick = () => { UI.selected = null; el.classList.add('hidden'); };
}
function barRow(label, v, col) {
  const p = clamp(v, 0, 100);
  return '<div class="small" style="margin-top:4px;display:flex;justify-content:space-between"><span>' + esc(label) + '</span><span>' + Math.round(p) + '%</span></div>' +
    '<div class="mini"><i style="width:' + p + '%;background:' + col + '"></i></div>';
}

/* side panels */
function updateSide(force) {
  if (!G || UI.screen !== 'game') return;
  const tab = UI.tab;
  if (tab === 'ops') renderOps();
  else if (tab === 'fleet') renderFleet();
  else if (tab === 'charts') renderCharts();
  else if (tab === 'log') renderLog();
}
function renderOps() {
  const pane = $('#pane-ops');
  const S = SCENARIOS[G.scn];
  const pols = [
    { id: 'random', name: 'Random', ok: true, desc: 'Free default. Pods hold random SKUs.' },
    { id: 'velocity', name: 'Velocity', ok: perk('slot_velocity'), desc: 'Fast movers go nearest stations: shorter trips.' },
    { id: 'zoned', name: 'Zoned', ok: perk('slot_zoned'), desc: 'Families grouped along aisles: fewer long crossings.' }
  ];
  const cur = G.pendingPolicy || G.policy;
  const key = [cur, G.trafficAI, G.chargers.length, G.docks.length, G.repairs.length, G.techs.length, G.stations.length,
    perk('slot_velocity'), perk('slot_zoned'), G.gridCap, G.scn].join('|');
  if (pane._key !== key) {
    pane._key = key;
    const polHTML = pols.map(p => '<button data-policy="' + p.id + '" class="' + (cur === p.id ? 'on' : '') + '" ' + (p.ok ? '' : 'disabled') + ' title="' + esc(p.desc) + '">' + (p.ok ? '' : '🔒 ') + p.name + '</button>').join('');
    pane.innerHTML =
      '<div class="panel" style="padding:10px 12px">' +
      '<div class="row"><b>On-time fill</b><span class="spacer"></span><b data-v="fill"></b><span class="muted small" data-v="fillT"></span></div>' +
      '<div class="mini" style="height:9px"><i data-v="fillBar" style="width:0%;background:linear-gradient(90deg,#38bdf8,#34d399)"></i></div>' +
      '<div class="small muted" style="margin-top:6px" data-v="burn"></div></div>' +
      '<h3>Slotting policy</h3><div class="row" style="gap:6px">' + polHTML + '</div>' +
      '<div class="small muted" style="margin-top:4px">' + esc(pols.find(p => p.id === cur).desc) + ' Applies overnight at the next shift start.</div>' +
      '<h3>Maintenance</h3>' +
      '<div class="field"><label class="small">Service robots above <b data-v="pmVal">' + G.pmThreshold + '%</b> wear</label><input type="range" min="40" max="95" step="5" value="' + G.pmThreshold + '" data-slider="pm"></div>' +
      '<div class="small muted">Lower = fewer breakdowns, more robots in the bay. Higher = more breakdowns in the aisles.</div>' +
      '<h3>Charging</h3>' +
      '<div class="field"><label class="small">Idle robots charge below <b data-v="chVal">' + G.chargeAt + '%</b></label><input type="range" min="10" max="60" step="5" value="' + G.chargeAt + '" data-slider="charge"></div>' +
      '<div class="small muted" data-v="power"></div>' +
      '<h3>Crew</h3>' +
      '<div class="row"><button data-act="crew">Crew handover ($150)</button></div>' +
      '<div class="small muted">Resets picker fatigue but pauses picking for 4 minutes. Fatigue slows stations and backs robots up.</div>' +
      '<h3>Traffic</h3>' +
      '<div class="small" data-v="traffic"></div>' +
      '<h3>Floor stats</h3>' +
      '<table class="kv">' +
      '<tr><td>Pods</td><td data-v="pods"></td></tr>' +
      '<tr><td>Stations / chargers / docks / bays</td><td data-v="fac"></td></tr>' +
      '<tr><td>Technicians</td><td data-v="tech"></td></tr>' +
      '<tr><td>Deadlocks this shift</td><td data-v="dl"></td></tr>' +
      '<tr><td>Breakdowns this shift</td><td data-v="fails"></td></tr>' +
      '<tr><td>Revenue this shift</td><td class="good" data-v="rev"></td></tr></table>';
  }
  const q = k => pane.querySelector('[data-v="' + k + '"]');
  const put = (k, v) => { const el = q(k); if (el && el.textContent !== String(v)) el.textContent = v; };
  const f = computeFill(G), tgt = shiftTarget(G);
  const working = G.robots.filter(r => r.state !== 'idle' && r.state !== 'failed' && r.state !== 'stranded' && r.state !== 'charging').length;
  const burn = S.rent + G.stations.reduce((a, s) => a + s.workers, 0) * PICKER_WAGE + G.techs.length * TECH_WAGE + G.robots.length * ROBOT_UPKEEP;
  put('fill', pct(f.fill));
  put('fillT', '/ ' + pct(tgt));
  const fb = q('fillBar'); if (fb) { fb.style.width = clamp(f.fill * 100, 0, 100) + '%'; fb.style.background = f.fill >= tgt ? 'linear-gradient(90deg,#34d399,#22c55e)' : 'linear-gradient(90deg,#38bdf8,#fbbf24)'; }
  put('burn', 'Burn rate ' + money(-burn) + '/min · Working ' + working + '/' + G.robots.length);
  put('power', 'Chargers: ' + G.chargers.length + ' · full-rate slots: ' + G.gridCap + ' · live scale ' + Math.round(G.chargeScale * 100) + '%' + (G.t < G.brownUntil ? ' (brownout)' : ''));
  put('traffic', G.trafficAI ? 'Traffic Control AI online: deadlocks clear instantly; routes avoid busy aisles.' : 'Manual traffic: deadlocks clear after ~2.5 minutes. Buy Traffic Control AI in the shop.');
  put('pods', G.shelves.filter(s => s).length);
  put('fac', G.stations.length + ' / ' + G.chargers.length + ' / ' + G.docks.length + ' / ' + G.repairs.length);
  put('tech', G.techs.length + (G.techs.some(t => t.busy >= 0) ? ' (busy)' : ' (free)'));
  put('dl', G.stat.deadlocks);
  put('fails', G.stat.fails);
  put('rev', money(G.stat.revenue));
  const crew = pane.querySelector('[data-act="crew"]'); if (crew) crew.disabled = G.cash < 150;
  const pmv = q('pmVal'); if (pmv) pmv.textContent = G.pmThreshold + '%';
  const chv = q('chVal'); if (chv) chv.textContent = G.chargeAt + '%';
}
function renderFleet() {
  const pane = $('#pane-fleet');
  const key = G.robots.map(r => r.id).join(',');
  if (pane._key !== key) {
    pane._key = key;
    pane.innerHTML = '<div class="small muted" style="margin-bottom:8px">Click a robot to inspect and focus the camera.</div>' +
      G.robots.map(r => '<div class="fleet-item" data-robot="' + r.id + '"><span class="dot"></span><div>' +
        '<div class="row" style="gap:6px"><b>' + robotName(r) + '</b><span class="small muted f-state"></span></div>' +
        '<div class="mini"><i class="f-bat"></i></div><div class="mini"><i class="f-wear"></i></div></div>' +
        '<div class="small muted f-num" style="text-align:right"></div></div>').join('');
  }
  const rows = $$('[data-robot]', pane);
  rows.forEach((row, i) => {
    const r = G.robots[i]; if (!r) return;
    row.classList.toggle('sel', !!(UI.selected && UI.selected.kind === 'robot' && UI.selected.id === r.id));
    const dot = row.querySelector('.dot'); if (dot) dot.style.background = STATE_COLOR[r.state] || '#94a3b8';
    const st = row.querySelector('.f-state'); const stxt = STATE_LABEL[r.state] || r.state; if (st.textContent !== stxt) st.textContent = stxt;
    const bat = row.querySelector('.f-bat'); bat.style.width = clamp(r.battery, 0, 100) + '%'; bat.style.background = r.battery < 25 ? '#f87171' : '#34d399';
    const wr = row.querySelector('.f-wear'); wr.style.width = clamp(r.wear, 0, 100) + '%'; wr.style.background = r.wear >= G.pmThreshold ? '#f87171' : '#fbbf24';
    const num = row.querySelector('.f-num'); const ntxt = Math.round(r.battery) + '%<br>' + Math.round(r.wear) + '%';
    if (num.innerHTML !== ntxt) num.innerHTML = ntxt;
  });
}
function renderCharts() {
  const pane = $('#pane-charts');
  if (!pane._built) {
    pane.innerHTML = '<div class="chart-box"><div class="lbl"><span>On-time fill %</span><span id="cLblFill"></span></div><canvas id="cFill"></canvas></div>' +
      '<div class="chart-box"><div class="lbl"><span>Robots working %</span><span id="cLblAct"></span></div><canvas id="cAct"></canvas></div>' +
      '<div class="chart-box"><div class="lbl"><span>Average battery %</span><span id="cLblBatt"></span></div><canvas id="cBatt"></canvas></div>' +
      '<div class="chart-box"><div class="lbl"><span>Open orders (backlog)</span><span id="cLblBack"></span></div><canvas id="cBack"></canvas></div>';
    pane._built = true;
  }
  const H = G.hist;
  const last = (a) => a.length ? a[a.length - 1] : 0;
  $('#cLblFill').textContent = pct(computeFill(G).fill);
  $('#cLblAct').textContent = Math.round(last(H.active)) + '%';
  $('#cLblBatt').textContent = Math.round(last(H.batt)) + '%';
  $('#cLblBack').textContent = last(H.backlog);
  drawChart($('#cFill'), [{ data: H.fill, color: '#34d399', min: 0, max: 100 }, { data: H.t.map(() => shiftTarget(G) * 100), color: '#fbbf24', dash: true, min: 0, max: 100 }], { unit: '%' });
  drawChart($('#cAct'), [{ data: H.active, color: '#38bdf8', min: 0, max: 100 }], { unit: '%' });
  drawChart($('#cBatt'), [{ data: H.batt, color: '#a78bfa', min: 0, max: 100 }], { unit: '%' });
  drawChart($('#cBack'), [{ data: H.backlog, color: '#fb923c', min: 0 }], { unit: '' });
}
function renderLog() {
  if (!G) return;
  let html = '';
  G.log.slice(0, 80).forEach(e => { html += '<div class="logitem ' + e.kind + '"><div class="t">' + e.t + '</div>' + esc(e.text) + '</div>'; });
  if (!html) html = '<div class="muted">No events yet.</div>';
  setHTML($('#pane-log'), html);
}
function drawChart(canvas, series, opts) {
  if (!canvas) return;
  const w = canvas.clientWidth || 300, h = canvas.clientHeight || 110;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const c = canvas.getContext('2d'); if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#0a1322'; c.fillRect(0, 0, w, h);
  let max = -Infinity, min = Infinity, n = 0;
  series.forEach(s => {
    s.data.forEach(v => { if (isFinite(v)) { max = Math.max(max, v); min = Math.min(min, v); } });
    n = Math.max(n, s.data.length);
  });
  if (!isFinite(max)) { c.fillStyle = '#5b6f90'; c.font = '12px system-ui'; c.fillText('collecting data…', 10, h / 2); return; }
  const lo = series[0].min != null ? series[0].min : Math.min(0, min);
  const hi = series[0].max != null ? series[0].max : Math.max(max * 1.15, lo + 1);
  const span = Math.max(1e-6, hi - lo);
  c.strokeStyle = '#1b2a44'; c.lineWidth = 1;
  for (let i = 1; i < 4; i++) { const y = Math.round(h * i / 4) + 0.5; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  series.forEach(s => {
    const d = s.data; if (d.length < 2) return;
    c.strokeStyle = s.color; c.lineWidth = s.dash ? 1.2 : 2; c.setLineDash(s.dash ? [4, 4] : []);
    c.beginPath();
    d.forEach((v, i) => {
      const x = i / (n - 1 || 1) * (w - 4) + 2;
      const y = h - 4 - (clamp(v, lo, hi) - lo) / span * (h - 8);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    });
    c.stroke(); c.setLineDash([]);
  });
  c.fillStyle = '#7d91b3'; c.font = '10px ui-monospace, Menlo, monospace';
  c.fillText(Math.round(hi) + (opts && opts.unit || ''), 4, 11);
  c.fillText(Math.round(lo) + (opts && opts.unit || ''), 4, h - 4);
}

/* ---------------------------- rendering ---------------------------- */
function resizeCanvas() {
  const stage = $('#stage'); const cv = $('#cv');
  if (!stage || !cv) return;
  const w = Math.max(10, stage.clientWidth), h = Math.max(10, stage.clientHeight);
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
  CW = w; CH = h;
}
function baseCs() { return G ? Math.min(CW / (G.W + 2), CH / (G.H + 2)) : 20; }
function camCs() { return baseCs() * UI.cam.zoom; }
function cellCenter(x, y, cs) {
  return [CW / 2 + (x - G.W / 2 + 0.5 - UI.cam.panX) * cs, CH / 2 + (y - G.H / 2 + 0.5 - UI.cam.panY) * cs];
}
function screenToCell(sx, sy) {
  const cs = camCs();
  const x = Math.round((sx - CW / 2) / cs + G.W / 2 - 0.5 + UI.cam.panX);
  const y = Math.round((sy - CH / 2) / cs + G.H / 2 - 0.5 + UI.cam.panY);
  if (x < 0 || y < 0 || x >= G.W || y >= G.H) return -1;
  return y * G.W + x;
}
function robotVis(g, r) {
  const p = clamp(r.sinceMove / Math.max(TICK, r.moveDur || TICK), 0, 1);
  const e = SET.reduced ? 1 : easeInOut(p);
  const a = xyOf(g, r.prevCell), b = xyOf(g, r.cell);
  return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) };
}
function render(now) {
  const c = $('#cv').getContext('2d');
  if (!c || !G) return;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.fillStyle = '#0a1322'; c.fillRect(0, 0, CW, CH);
  const cs = camCs();
  const g = G;
  const x0 = Math.floor(cellCenter(0, 0, cs)[0] - cs / 2);
  // floor and objects
  for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) {
    const i = y * g.W + x;
    const [px, py] = cellCenter(x, y, cs);
    const left = px - cs / 2, top = py - cs / 2;
    drawCell(c, g, i, left, top, cs);
  }
  // overlays
  if (UI.overlay !== 'off') drawOverlay(c, g, cs);
  // deadlock cycles
  drawCycles(c, g, cs);
  // selected robot path
  if (UI.selected && UI.selected.kind === 'robot') {
    const r = robotById(g, UI.selected.id);
    if (r && r.path.length) {
      c.save(); c.strokeStyle = 'rgba(56,189,248,0.8)'; c.lineWidth = Math.max(1.5, cs * 0.07); c.setLineDash([cs * 0.12, cs * 0.12]);
      c.beginPath();
      const v = robotVis(g, r); let [sx, sy] = cellCenter(v.x, v.y, cs); c.moveTo(sx, sy);
      r.path.forEach(cc => { const q = xyOf(g, cc); const [qx, qy] = cellCenter(q.x, q.y, cs); c.lineTo(qx, qy); });
      c.stroke(); c.restore();
    }
  }
  // robots
  for (const r of g.robots) drawRobot(c, g, r, cs);
  // particles and floats
  drawFx(c, cs);
  // hover
  if (UI.hover >= 0 && UI.tool !== 'select') {
    const xy = xyOf(g, UI.hover); const [px, py] = cellCenter(xy.x, xy.y, cs);
    c.strokeStyle = 'rgba(251,191,36,0.9)'; c.lineWidth = 2;
    c.strokeRect(px - cs / 2 + 1, py - cs / 2 + 1, cs - 2, cs - 2);
  } else if (UI.hover >= 0) {
    const xy = xyOf(g, UI.hover); const [px, py] = cellCenter(xy.x, xy.y, cs);
    c.strokeStyle = 'rgba(148,163,184,0.5)'; c.lineWidth = 1;
    c.strokeRect(px - cs / 2 + 0.5, py - cs / 2 + 0.5, cs - 1, cs - 1);
  }
  // paused veil
  if (UI.paused || UI.hold) {
    c.fillStyle = 'rgba(3,7,14,0.25)'; c.fillRect(0, 0, CW, CH);
  }
  void x0;
}
function drawCell(c, g, i, left, top, cs) {
  const t = g.type[i];
  const x = i % g.W, y = (i / g.W) | 0;
  const shade = ((x + y) & 1) ? '#162236' : '#172538';
  // floor
  c.fillStyle = shade; c.fillRect(left, top, cs, cs);
  c.strokeStyle = 'rgba(40,62,94,0.45)'; c.lineWidth = 1;
  c.strokeRect(left + 0.5, top + 0.5, cs - 1, cs - 1);
  if (g.hazard[i]) {
    c.save(); c.beginPath(); c.rect(left, top, cs, cs); c.clip();
    c.fillStyle = 'rgba(250,204,21,0.55)'; c.fillRect(left, top, cs, cs);
    c.strokeStyle = 'rgba(15,15,15,0.7)'; c.lineWidth = Math.max(2, cs * 0.18);
    for (let k = -cs; k < cs * 2; k += cs * 0.4) { c.beginPath(); c.moveTo(left + k, top + cs); c.lineTo(left + k + cs, top); c.stroke(); }
    c.restore();
    if (cs > 24) { c.fillStyle = '#0f172a'; c.font = 'bold ' + Math.round(cs * 0.45) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', left + cs / 2, top + cs / 2); }
  }
  if (t === T_WALL) {
    c.fillStyle = '#060a12'; c.fillRect(left, top, cs, cs);
    c.fillStyle = '#2b3f60'; c.fillRect(left + 1, top + 1, cs - 2, Math.max(2, cs * 0.18));
    c.fillStyle = '#0f1828'; c.fillRect(left + 1, top + cs * 0.22, cs - 2, cs * 0.76);
    return;
  }
  if (t === T_STORE) {
    const sh = g.shelves[g.shelfAt[i]] || null;
    const inset = cs * 0.1;
    if (sh) {
      const k = SKUS[sh.sku];
      const ratio = sh.stock / sh.cap;
      c.fillStyle = k.color; c.globalAlpha = 0.22 + ratio * 0.55;
      roundRect(c, left + inset, top + inset, cs - inset * 2, cs - inset * 2, cs * 0.12); c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = k.color; c.lineWidth = 1.5;
      roundRect(c, left + inset, top + inset, cs - inset * 2, cs - inset * 2, cs * 0.12); c.stroke();
      // stock bar
      const bw = (cs - inset * 2 - 4), bh = Math.max(2, cs * 0.08);
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(left + inset + 2, top + cs - inset - bh - 2, bw, bh);
      c.fillStyle = ratio < 0.4 ? '#f87171' : '#34d399';
      c.fillRect(left + inset + 2, top + cs - inset - bh - 2, bw * clamp(ratio, 0, 1), bh);
      if (cs >= 34) {
        c.fillStyle = '#e6edf7'; c.font = 'bold ' + Math.round(cs * 0.26) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(k.short, left + cs / 2, top + cs * 0.4);
      }
      if (sh.reservedBy >= 0 && sh.carriedBy < 0 && cs > 20) {
        c.strokeStyle = '#fbbf24'; c.setLineDash([3, 3]); c.lineWidth = 1;
        c.strokeRect(left + inset - 1, top + inset - 1, cs - inset * 2 + 2, cs - inset * 2 + 2); c.setLineDash([]);
      }
    } else {
      c.strokeStyle = 'rgba(120,150,190,0.35)'; c.setLineDash([3, 4]); c.lineWidth = 1;
      c.strokeRect(left + inset, top + inset, cs - inset * 2, cs - inset * 2); c.setLineDash([]);
    }
  } else if (t === T_STATION) {
    c.fillStyle = '#3d2c0c'; c.fillRect(left + 1, top + 1, cs - 2, cs - 2);
    c.strokeStyle = '#fbbf24'; c.lineWidth = 2; c.strokeRect(left + 2, top + 2, cs - 4, cs - 4);
    const st = stationAt(g, i);
    if (cs >= 22) {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = Math.round(cs * 0.5) + 'px system-ui';
      c.fillText('👷', left + cs / 2, top + cs / 2);
      if (st && st.workers > 1) { c.font = 'bold ' + Math.round(cs * 0.22) + 'px system-ui'; c.fillStyle = '#fde68a'; c.fillText('×' + st.workers, left + cs * 0.82, top + cs * 0.82); }
    }
    if (st && st.occ >= 0) { c.fillStyle = 'rgba(250,204,21,0.15)'; c.fillRect(left, top, cs, cs); }
    if (g.t < g.breakUntil) { c.fillStyle = 'rgba(10,15,25,0.5)'; c.fillRect(left, top, cs, cs); }
  } else if (t === T_CHARGER) {
    c.fillStyle = '#0c3427'; c.fillRect(left + 1, top + 1, cs - 2, cs - 2);
    const ch = chargerAt(g, i);
    const busy = ch && ch.occ >= 0;
    c.strokeStyle = busy ? '#86efac' : '#34d399'; c.lineWidth = busy ? 2.5 : 1.5;
    c.strokeRect(left + 2, top + 2, cs - 4, cs - 4);
    if (cs >= 22) { c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = Math.round(cs * 0.5) + 'px system-ui'; c.fillText('⚡', left + cs / 2, top + cs / 2); }
    if (busy) { const p = 0.5 + 0.5 * Math.sin(performance.now() / 180); c.fillStyle = 'rgba(52,211,153,' + (0.1 + 0.15 * p) + ')'; c.fillRect(left, top, cs, cs); }
  } else if (t === T_DOCK) {
    c.save(); c.beginPath(); c.rect(left + 1, top + 1, cs - 2, cs - 2); c.clip();
    c.fillStyle = '#2a2305'; c.fillRect(left, top, cs, cs);
    c.fillStyle = '#e7c64a';
    for (let k = -cs; k < cs * 2; k += cs * 0.5) { c.beginPath(); c.moveTo(left + k, top + cs); c.lineTo(left + k + cs * 0.25, top + cs); c.lineTo(left + k + cs * 0.25 + cs * 0.5, top); c.lineTo(left + k + cs * 0.5, top); c.closePath(); c.fill(); }
    c.restore();
    const dk = dockAt(g, i);
    if (dk && g.t < dk.blockedUntil) { c.fillStyle = 'rgba(248,113,113,0.5)'; c.fillRect(left, top, cs, cs); }
    if (cs >= 22) { c.fillStyle = '#fff7d1'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold ' + Math.round(cs * 0.22) + 'px system-ui'; c.fillText('DOCK', left + cs / 2, top + cs * 0.5); }
  } else if (t === T_REPAIR) {
    c.fillStyle = '#2b1f4d'; c.fillRect(left + 1, top + 1, cs - 2, cs - 2);
    c.strokeStyle = '#a78bfa'; c.lineWidth = 1.5; c.strokeRect(left + 2, top + 2, cs - 4, cs - 4);
    if (cs >= 22) { c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = Math.round(cs * 0.5) + 'px system-ui'; c.fillText('🔧', left + cs / 2, top + cs / 2); }
  }
  // one-way lane arrow
  const d = g.dir[i];
  if (d && t !== T_WALL) {
    const cx = left + cs / 2, cy = top + cs / 2;
    const ang = [0, -Math.PI / 2, 0, Math.PI / 2, Math.PI][d];
    const angle = [0, -Math.PI / 2, 0, Math.PI / 2, Math.PI][d];
    c.save(); c.translate(cx, cy); c.rotate(angle);
    c.fillStyle = 'rgba(56,189,248,0.55)';
    c.beginPath(); c.moveTo(cs * 0.3, 0); c.lineTo(-cs * 0.15, -cs * 0.22); c.lineTo(-cs * 0.15, cs * 0.22); c.closePath(); c.fill();
    c.restore();
    void ang;
  }
  if (t === T_FLOOR && i === UI.hover && UI.tool === 'select') { /* hover handled elsewhere */ }
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
function drawOverlay(c, g, cs) {
  for (let i = 0; i < g.N; i++) {
    const x = i % g.W, y = (i / g.W) | 0;
    const [px, py] = cellCenter(x, y, cs);
    const left = px - cs / 2, top = py - cs / 2;
    if (UI.overlay === 'traffic') {
      const v = g.traffic[i];
      if (v > 0.5 && g.type[i] !== T_WALL) { c.fillStyle = 'rgba(248,113,113,' + clamp(v / 30, 0, 0.6) + ')'; c.fillRect(left, top, cs, cs); }
    } else if (UI.overlay === 'pick') {
      if (g.type[i] !== T_WALL && g.distSt[i] < 999) {
        const maxD = 26;
        const k = clamp(g.distSt[i] / maxD, 0, 1);
        c.fillStyle = 'rgba(' + Math.round(34 + k * 214) + ',' + Math.round(197 - k * 150) + ',' + Math.round(94 - k * 40) + ',0.35)';
        c.fillRect(left, top, cs, cs);
        if (cs >= 30 && g.type[i] === T_STORE) { c.fillStyle = '#e6edf7'; c.font = Math.round(cs * 0.28) + 'px ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(g.distSt[i], left + cs * 0.5, top + cs * 0.82); }
      }
    }
  }
}
function drawCycles(c, g, cs) {
  if (!g.cycles.length) return;
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 150);
  c.save(); c.strokeStyle = 'rgba(248,113,113,' + (0.5 + pulse * 0.45) + ')'; c.lineWidth = Math.max(2, cs * 0.12); c.setLineDash([cs * 0.2, cs * 0.12]);
  g.cycles.forEach(ids => {
    const rs = ids.map(id => robotById(g, id)).filter(Boolean);
    if (rs.length < 2) return;
    c.beginPath();
    rs.forEach((r, k) => {
      const v = robotVis(g, r); const [px, py] = cellCenter(v.x, v.y, cs);
      if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
    });
    const f = rs[0]; const v = robotVis(g, f); const [fx, fy] = cellCenter(v.x, v.y, cs); c.lineTo(fx, fy);
    c.stroke();
  });
  c.restore();
}
function drawRobot(c, g, r, cs) {
  const v = robotVis(g, r);
  const [px, py] = cellCenter(v.x, v.y, cs);
  const s = cs * 0.66;
  const col = STATE_COLOR[r.state] || '#94a3b8';
  const now = performance.now();
  // shadow
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath(); c.ellipse(px, py + cs * 0.12, s * 0.5, s * 0.25, 0, 0, Math.PI * 2); c.fill();
  // carried pod (under the robot body)
  if (r.cargo >= 0 && g.shelves[r.cargo]) {
    const sh = g.shelves[r.cargo];
    const k = SKUS[sh.sku];
    c.fillStyle = k.color; c.globalAlpha = 0.9;
    roundRect(c, px - s * 0.62, py - s * 0.62, s * 1.24, s * 1.24, s * 0.18); c.fill();
    c.globalAlpha = 1;
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1; c.stroke();
  }
  // body
  let fillCol = col;
  if (r.state === 'failed') fillCol = (Math.floor(now / 250) % 2) ? '#ef4444' : '#7f1d1d';
  if (r.state === 'picking') fillCol = (Math.floor(now / 200) % 2) ? '#facc15' : '#a16207';
  if (r.state === 'charging') fillCol = (Math.floor(now / 400) % 2) ? '#22c55e' : '#14532d';
  c.fillStyle = fillCol;
  const bs = s * 0.5;
  roundRect(c, px - bs, py - bs, bs * 2, bs * 2, bs * 0.3); c.fill();
  c.strokeStyle = 'hsl(' + r.hue + ',80%,70%)'; c.lineWidth = Math.max(1, cs * 0.05); c.stroke();
  // direction nub
  const dx = DX[r.facing] || 0, dy = DY[r.facing] || 0;
  c.fillStyle = '#e6edf7';
  c.beginPath(); c.arc(px + dx * bs * 0.7, py + dy * bs * 0.7, Math.max(1.5, cs * 0.07), 0, Math.PI * 2); c.fill();
  // deadlock ring
  if (r.inDead) { c.strokeStyle = 'rgba(248,113,113,' + (0.6 + 0.4 * Math.sin(now / 120)) + ')'; c.lineWidth = 2.5; c.beginPath(); c.arc(px, py, s * 0.78, 0, Math.PI * 2); c.stroke(); }
  // charging ring
  if (r.state === 'charging') { c.strokeStyle = 'rgba(34,197,94,0.8)'; c.lineWidth = 2; c.beginPath(); c.arc(px, py, s * 0.7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(r.battery / 100, 0, 1)); c.stroke(); }
  // status icon
  if (cs >= 26) {
    c.font = Math.round(cs * 0.34) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (r.state === 'failed') c.fillText('✖', px, py - s * 0.85);
    else if (r.state === 'stranded') c.fillText('⌀', px, py - s * 0.85);
    else if (r.waitTicks > 5 && r.state !== 'idle') c.fillText('…', px, py - s * 0.85);
    else if (r.state === 'servicing') c.fillText('🔧', px, py - s * 0.85);
  }
  // battery bar
  const bw = cs * 0.7, bh = Math.max(2, cs * 0.07);
  c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(px - bw / 2, py + bs + 2, bw, bh);
  c.fillStyle = r.battery < 25 ? '#f87171' : (r.battery < 55 ? '#fbbf24' : '#34d399');
  c.fillRect(px - bw / 2, py + bs + 2, bw * clamp(r.battery / 100, 0, 1), bh);
  if (cs >= 34) { c.fillStyle = '#e6edf7'; c.font = Math.round(cs * 0.22) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText(robotName(r), px, py - bs - 2); }
  if (UI.selected && UI.selected.kind === 'robot' && UI.selected.id === r.id) {
    c.strokeStyle = '#38bdf8'; c.lineWidth = 2; c.beginPath(); c.arc(px, py, s * 0.9, 0, Math.PI * 2); c.stroke();
  }
}
function drawFx(c, cs) {
  const dt = 1 / 60;
  for (const p of FX.parts) {
    const a = clamp(p.life / p.max, 0, 1);
    const [px, py] = cellCenter(p.x, p.y, cs);
    c.globalAlpha = a;
    c.fillStyle = p.color;
    const rr = Math.max(1, cs * p.size * (p.kind === 'smoke' ? (1 + (1 - a) * 1.5) : 1));
    c.beginPath(); c.arc(px + p.vx * cs * 0.2, py + p.vy * cs * 0.2, rr, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  for (const f of FX.floats) {
    const k = 1 - f.life / 1.6;
    const [px, py] = cellCenter(f.x, f.y, cs);
    c.globalAlpha = clamp(f.life / 0.6, 0, 1);
    c.fillStyle = f.color;
    c.font = 'bold ' + Math.round(Math.max(11, cs * 0.34)) + 'px system-ui';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3;
    const yy = py - easeOut(k) * cs * 0.9;
    c.strokeText(f.text, px, yy); c.fillText(f.text, px, yy);
  }
  c.globalAlpha = 1;
  void dt;
}
function updateFx(dt) {
  for (const p of FX.parts) { p.life -= dt; p.x += p.vx * dt * 0.4; p.y += p.vy * dt * 0.4; p.vy += 0.2 * dt; }
  FX.parts = FX.parts.filter(p => p.life > 0);
  for (const f of FX.floats) f.life -= dt;
  FX.floats = FX.floats.filter(f => f.life > 0);
}

/* ---------------------------- title background ---------------------------- */
const TB = { robots: [], t: 0 };
function renderTitleBg(dt) {
  const cv = $('#titleBg'); if (!cv) return;
  const w = cv.clientWidth || window.innerWidth, h = cv.clientHeight || window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); TB.robots = []; }
  const c = cv.getContext('2d'); if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = '#070d17'; c.fillRect(0, 0, w, h);
  const cs = 44;
  c.strokeStyle = 'rgba(56,189,248,0.08)'; c.lineWidth = 1;
  for (let x = 0; x < w; x += cs) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  for (let y = 0; y < h; y += cs) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  if (!TB.robots.length) {
    for (let i = 0; i < 14; i++) TB.robots.push({ x: Math.floor(Math.random() * w / cs) * cs, y: Math.floor(Math.random() * h / cs) * cs, dir: Math.floor(Math.random() * 4), t: 0, col: ['#38bdf8', '#fb923c', '#34d399', '#f472b6'][i % 4] });
  }
  TB.t += dt;
  TB.robots.forEach(r => {
    r.t += dt;
    if (r.t > 0.8) {
      r.t = 0;
      if (Math.random() < 0.3) r.dir = Math.floor(Math.random() * 4);
      r.x += DX[r.dir] * cs; r.y += DY[r.dir] * cs;
      if (r.x < 0 || r.x > w || r.y < 0 || r.y > h) { r.dir = (r.dir + 2) % 4; r.x = clamp(r.x, 0, w); r.y = clamp(r.y, 0, h); }
    }
    const p = easeInOut(clamp(r.t / 0.8, 0, 1));
    const px = r.x + DX[r.dir] * cs * p, py = r.y + DY[r.dir] * cs * p;
    c.fillStyle = r.col; c.globalAlpha = 0.5;
    roundRect(c, px + cs / 2 - 10, py + cs / 2 - 10, 20, 20, 5); c.fill();
    c.globalAlpha = 1;
  });
}

/* ---------------------------- inputs ---------------------------- */
function setTool(id) {
  UI.tool = id;
  $$('#tools [data-tool]').forEach(b => b.classList.toggle('on', b.getAttribute('data-tool') === id));
  play('click');
}
function paintAt(cell, right) {
  if (!G || cell < 0) return;
  let tool = UI.tool;
  if (right) tool = 'erase';
  if (tool === 'select') return;
  if (right && UI.tool === 'oneway') { applyBuild(cell, 'oneway', true); return; }
  applyBuild(cell, tool, false);
}
function applyBuild(cell, tool, clearArrow) {
  const g = G;
  if (g.over) return;
  const t = g.type[cell];
  const xy = xyOf(g, cell);
  const fail = (msg) => { toast(msg, 'bad', 2600); play('warn'); };
  if (tool === 'erase') {
    if (g.occ[cell] >= 0) return fail('A robot is standing there.');
    if (g.hazard[cell]) { g.hazard[cell] = 0; spark(g, cell, '#fbbf24', 4); return; }
    if (t === T_STORE) {
      const id = g.shelfAt[cell];
      const sh = id >= 0 ? g.shelves[id] : null;
      if (sh && (sh.carriedBy >= 0 || sh.reservedBy >= 0)) return fail('That pod is in use.');
      if (sh) { g.shelves[id] = null; g.shelfAt[cell] = -1; }
      g.type[cell] = T_FLOOR;
      refund(20);
    } else if (t === T_STATION) {
      const st = stationAt(g, cell);
      if (st && (st.occ >= 0 || st.target >= 0)) return fail('The station is busy.');
      if (g.stations.length <= 1) return fail('Keep at least one pick station.');
      g.stations = g.stations.filter(s => s.cell !== cell); g.type[cell] = T_FLOOR; refund(450);
    } else if (t === T_CHARGER) {
      const ch = chargerAt(g, cell);
      if (ch && ch.occ >= 0) return fail('A robot is charging there.');
      if (g.chargers.length <= 1) return fail('Keep at least one charger.');
      g.chargers = g.chargers.filter(s => s.cell !== cell); g.type[cell] = T_FLOOR; refund(225);
    } else if (t === T_DOCK) {
      g.docks = g.docks.filter(s => s.cell !== cell); g.type[cell] = T_FLOOR; refund(300);
    } else if (t === T_REPAIR) {
      const rp = repairAt(g, cell);
      if (rp && rp.occ >= 0) return fail('A robot is in the bay.');
      g.repairs = g.repairs.filter(s => s.cell !== cell); g.type[cell] = T_FLOOR; refund(250);
    } else if (t === T_WALL) {
      g.type[cell] = T_FLOOR; refund(2);
    } else if (g.dir[cell]) {
      g.dir[cell] = 0; refund(1);
    } else return;
    if (g.dir[cell] && t !== T_FLOOR) g.dir[cell] = 0;
    afterLayoutChange(cell);
    return;
  }
  if (g.occ[cell] >= 0) return fail('A robot is standing there.');
  if (g.hazard[cell]) return fail('Clear the spill first (erase it).');
  if (tool === 'oneway') {
    if (t !== T_FLOOR && t !== T_STORE) return fail('One-way lanes go on open floor or pod aisles.');
    const old = g.dir[cell];
    g.dir[cell] = clearArrow ? 0 : (old + 1) % 5;
    const prob = layoutProblem(g);
    if (prob) { g.dir[cell] = old; return fail('That lane would trap robots.'); }
    if (g.dir[cell] !== old) { charge(2); }
    afterLayoutChange(cell);
    return;
  }
  if (tool === 'wall') {
    if (t !== T_FLOOR || g.shelfAt[cell] >= 0 || g.dir[cell]) return fail('Only empty floor can become a wall.');
    g.type[cell] = T_WALL;
    const prob = layoutProblem(g);
    if (prob) { g.type[cell] = T_FLOOR; return fail(prob); }
    charge(BUILD_COST.wall);
    afterLayoutChange(cell);
    return;
  }
  if (tool === 'store') {
    if (t !== T_FLOOR) return fail('Pods go on open floor.');
    if (g.dir[cell]) g.dir[cell] = 0;
    if (g.cash < BUILD_COST.store) return fail('Not enough cash for a pod.');
    g.type[cell] = T_STORE;
    addShelf(g, cell, weightedSku());
    charge(BUILD_COST.store);
    logMsg(g, 'New pod at (' + xy.x + ',' + xy.y + ').', 'info');
    afterLayoutChange(cell);
    return;
  }
  const facility = { station: T_STATION, charger: T_CHARGER, dock: T_DOCK, repair: T_REPAIR }[tool];
  if (facility !== undefined) {
    if (t !== T_FLOOR || g.shelfAt[cell] >= 0 || g.dir[cell]) return fail('Facilities need an empty floor tile.');
    const cost = BUILD_COST[tool];
    if (g.cash < cost) return fail('Not enough cash (' + money(cost) + ').');
    g.type[cell] = facility;
    if (tool === 'station') g.stations.push({ cell: cell, occ: -1, target: -1, workers: 1, fatigue: 0, served: 0 });
    if (tool === 'charger') g.chargers.push({ cell: cell, occ: -1, target: -1 });
    if (tool === 'dock') g.docks.push({ cell: cell, blockedUntil: -1 });
    if (tool === 'repair') g.repairs.push({ cell: cell, occ: -1, target: -1 });
    const prob = layoutProblem(g);
    if (prob && tool !== 'dock' && tool !== 'repair') { undoFacility(cell); return fail(prob); }
    charge(cost);
    logMsg(g, 'Built ' + tool + ' at (' + xy.x + ',' + xy.y + ') for ' + money(cost) + '.', 'good');
    afterLayoutChange(cell);
    play('click');
  }
}
function undoFacility(cell) {
  const g = G;
  g.type[cell] = T_FLOOR;
  g.stations = g.stations.filter(s => s.cell !== cell);
  g.chargers = g.chargers.filter(s => s.cell !== cell);
  g.docks = g.docks.filter(s => s.cell !== cell);
  g.repairs = g.repairs.filter(s => s.cell !== cell);
}
function charge(v) { G.cash -= v; G.stat.costs.labor += 0; }
function refund(v) { G.cash += v; }
function afterLayoutChange(cell) {
  const g = G;
  computeDist(g);
  // robots whose goals vanished go back to idle
  for (const r of g.robots) {
    if (r.goal < 0) continue;
    const t = g.type[r.goal];
    const want = { toStation: T_STATION, toCharge: T_CHARGER, toDock: T_DOCK, toService: T_REPAIR }[r.state];
    if (want !== undefined && t !== want) {
      if (r.state === 'toStation' && r.cargo >= 0) {
        const st = nearestFree(g, r.cell, g.stations);
        if (st) { r.goal = st.cell; r.path = []; st.target = r.id; continue; }
      }
      if (r.state === 'toCharge') { const c = nearestFree(g, r.cell, g.chargers); if (c) { r.goal = c.cell; r.path = []; c.target = r.id; continue; } }
      if (r.state === 'toDock' && r.cargo >= 0) { const d = nearestFree(g, r.cell, g.docks); if (d) { r.goal = d.cell; r.dockCell = d.cell; r.path = []; continue; } }
      if (r.state === 'toService') { const oldB = repairAt(g, r.goal); if (oldB && oldB.target === r.id) oldB.target = -1; r.state = 'idle'; r.goal = -1; r.path = []; continue; }
      if (r.cargo >= 0) { r.goal = g.shelves[r.job.shelf].home; r.state = 'toHome'; r.path = []; }
      else { r.state = 'idle'; r.goal = -1; r.path = []; }
    }
    r.path = [];
  }
  g.dirty = true;
  buildLegend();
  updateHUD(true);
}

function selectAt(cell) {
  if (!G || cell < 0) { UI.selected = null; return; }
  const g = G;
  const occ = g.occ[cell];
  if (occ >= 0) { UI.selected = { kind: 'robot', id: occ }; return; }
  const t = g.type[cell];
  if (t === T_STORE && g.shelfAt[cell] >= 0) { UI.selected = { kind: 'shelf', id: g.shelfAt[cell] }; return; }
  if (t === T_STATION) { UI.selected = { kind: 'station', cell: cell }; return; }
  if (t === T_CHARGER) { UI.selected = { kind: 'charger', cell: cell }; return; }
  if (t === T_DOCK) { UI.selected = { kind: 'dock', cell: cell }; return; }
  if (t === T_REPAIR) { UI.selected = { kind: 'repair', cell: cell }; return; }
  const xy = xyOf(g, cell);
  UI.selected = { kind: 'empty', cell: cell, x: xy.x, y: xy.y };
}
function focusRobot(r) {
  const v = xyOf(G, r.cell);
  UI.cam.panX = v.x - G.W / 2 + 0.5; UI.cam.panY = v.y - G.H / 2 + 0.5;
  UI.cam.zoom = Math.max(UI.cam.zoom, 1.8);
}
function canvasPoint(e) {
  const rect = $('#cv').getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
function bindCanvas() {
  const cv = $('#cv');
  cv.addEventListener('pointerdown', e => {
    if (!G) return;
    cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
    UI.pointers.set(e.pointerId, canvasPoint(e));
    if (UI.pointers.size === 2) { UI.pinch = pinchDist(); UI.drag = null; return; }
    const p = canvasPoint(e);
    UI.drag = { x0: p.x, y0: p.y, lastX: p.x, lastY: p.y, moved: false, btn: e.button };
    const cell = screenToCell(p.x, p.y);
    if (UI.tool !== 'select' && e.button !== 2) { UI.painting = true; UI.lastPaint = cell; paintAt(cell, false); }
    else if (e.button === 2) { if (UI.tool !== 'select') { UI.painting = true; UI.lastPaint = cell; paintAt(cell, true); } }
  });
  cv.addEventListener('pointermove', e => {
    if (!G) return;
    const p = canvasPoint(e);
    if (UI.pointers.has(e.pointerId)) UI.pointers.set(e.pointerId, p);
    if (UI.pointers.size === 2) {
      const d = pinchDist();
      if (UI.pinch > 0) UI.cam.zoom = clamp(UI.cam.zoom * d / UI.pinch, 0.5, 3.5);
      UI.pinch = d; return;
    }
    const cell = screenToCell(p.x, p.y);
    UI.hover = cell;
    updateTooltipFor(cell, e);
    if (UI.drag) {
      const dx = p.x - UI.drag.x0, dy = p.y - UI.drag.y0;
      if (Math.abs(dx) + Math.abs(dy) > 6) UI.drag.moved = true;
      if (UI.tool === 'select' && UI.drag.moved) {
        const cs = camCs();
        UI.cam.panX -= (p.x - UI.drag.lastX) / cs; UI.cam.panY -= (p.y - UI.drag.lastY) / cs;
      } else if (UI.painting && cell !== UI.lastPaint && cell >= 0) {
        UI.lastPaint = cell;
        const right = UI.drag.btn === 2;
        paintAt(cell, right);
      }
      UI.drag.lastX = p.x; UI.drag.lastY = p.y;
    }
  });
  const endPtr = e => {
    UI.pointers.delete(e.pointerId);
    if (UI.pointers.size < 2) UI.pinch = 0;
    if (UI.drag && UI.pointers.size === 0) {
      const d = UI.drag;
      if (!d.moved && UI.tool === 'select' && d.btn !== 2) {
        const p = canvasPoint(e);
        selectAt(screenToCell(p.x, p.y));
        if (UI.selected && UI.selected.kind === 'robot') { play('click'); }
      } else if (!d.moved && d.btn === 2 && UI.tool === 'select') {
        UI.selected = null;
      }
      UI.drag = null;
    }
    if (UI.pointers.size === 0) { UI.painting = false; UI.lastPaint = -1; }
    updateHUD(true);
  };
  cv.addEventListener('pointerup', endPtr);
  cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('pointerleave', () => { UI.hover = -1; hideTip(); });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => {
    if (!G) return;
    e.preventDefault();
    UI.cam.zoom = clamp(UI.cam.zoom * Math.pow(1.1, -e.deltaY / 100), 0.5, 3.5);
  }, { passive: false });
}
function pinchDist() {
  const pts = Array.from(UI.pointers.values());
  if (pts.length < 2) return 0;
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
}
function updateTooltipFor(cell, e) {
  const tip = $('#tip');
  if (!G || cell < 0) { hideTip(); return; }
  const g = G, t = g.type[cell];
  let txt = '';
  const occ = g.occ[cell];
  if (occ >= 0) { const r = robotById(g, occ); if (r) txt = robotName(r) + ' · ' + (STATE_LABEL[r.state] || r.state) + ' · battery ' + Math.round(r.battery) + '%'; }
  else if (t === T_STORE && g.shelfAt[cell] >= 0) { const sh = g.shelves[g.shelfAt[cell]]; txt = 'Pod · ' + SKUS[sh.sku].name + ' · ' + sh.stock + '/' + sh.cap; }
  else if (t === T_STATION) txt = 'Pick station · click to inspect';
  else if (t === T_CHARGER) txt = 'Charging dock';
  else if (t === T_DOCK) txt = 'Inbound dock' + (g.t < (dockAt(g, cell) || { blockedUntil: -1 }).blockedUntil ? ' · OFFLINE' : '');
  else if (t === T_REPAIR) txt = 'Service bay';
  else if (t === T_WALL) txt = 'Wall';
  else if (g.hazard[cell]) txt = 'Pallet spill (impassable)';
  else if (g.dir[cell]) txt = 'One-way lane ' + ['', '↑', '→', '↓', '←'][g.dir[cell]];
  else txt = 'Floor · traffic ' + g.traffic[cell].toFixed(0);
  if (UI.tool !== 'select') txt = '[' + (TOOLS.find(x => x.id === UI.tool) || {}).label + '] ' + txt;
  if (!txt) { hideTip(); return; }
  tip.textContent = txt;
  tip.style.display = 'block';
  tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 14) + 'px';
}
function hideTip() { const t = $('#tip'); if (t) t.style.display = 'none'; }
function bindTooltips() {
  let host = null;
  document.addEventListener('pointerover', e => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (!el || el === host) return;
    host = el;
    const t = $('#tip');
    t.textContent = el.getAttribute('data-tip');
    t.style.display = 'block';
  });
  document.addEventListener('pointerout', e => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el && el === host) { host = null; hideTip(); }
  });
  document.addEventListener('pointermove', e => {
    if (!host) return;
    const t = $('#tip');
    if (t.style.display !== 'block') return;
    t.style.left = (e.clientX + 14) + 'px'; t.style.top = (e.clientY + 14) + 'px';
  });
}

function togglePause() {
  if (!G || UI.screen !== 'game') return;
  if (G.over) return;
  if (UI.hold) return;
  UI.paused = !UI.paused;
  if (UI.paused) openPause(); else closeOv('ovPause');
  updateHUD(true);
}
function openPause() {
  UI.paused = true;
  openOv('ovPause');
  $('#pauseNote').textContent = UI.autoPaused ? 'Paused because the tab lost focus.' : 'The shift clock is stopped. Robots hold their positions.';
  updateHUD(true);
}
function resumeGame() {
  UI.paused = false; UI.autoPaused = false;
  closeOv('ovPause');
  updateHUD(true);
}
function setSpeed(v) { UI.speed = v; setSpeedButtons(); }
function bindUI() {
  // title & navigation
  $('#btnNew').onclick = () => { auInit(); play('click'); UI.scn = UI.scn || 'starter'; showScreen('select'); };
  $('#btnContinue').onclick = () => { play('click'); continueSave(); };
  $('#btnResearch').onclick = () => { play('click'); showScreen('research'); };
  $('#btnHowTitle').onclick = () => { play('click'); UI.helpFrom = 'title'; showScreen('help'); };
  $('#btnSettingsTitle').onclick = () => { play('click'); UI.setFrom = 'title'; showScreen('settings'); };
  $('#helpBack').onclick = () => { play('click'); leaveHelp(); };
  document.body.addEventListener('click', e => {
    const go = e.target.closest && e.target.closest('[data-go]');
    if (go) {
      const dest = go.getAttribute('data-go');
      play('click');
      if (dest === 'back') { if (UI.setFrom === 'game') returnToGame(); else showScreen('title'); }
      else showScreen(dest);
      return;
    }
  });
  // select
  $('#scnCards').addEventListener('click', e => {
    const card = e.target.closest('[data-scn]'); if (!card) return;
    const id = card.getAttribute('data-scn');
    if (!CAM.unlocked[id]) { toast('Win the previous scenario to unlock this one.', 'warn'); play('warn'); return; }
    UI.scn = id; play('click'); buildSelect();
  });
  $('#diffSeg').addEventListener('click', e => {
    const b = e.target.closest('[data-diff]'); if (!b) return;
    UI.diff = b.getAttribute('data-diff'); play('click'); buildSelect();
  });
  $('#btnLaunch').onclick = () => { play('click'); startNewRun(UI.scn, UI.diff); };
  // research
  $('#perkGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-perk]'); if (!b) return;
    const p = PERKS.find(x => x.id === b.getAttribute('data-perk'));
    if (!p || perk(p.id) || CAM.rp < p.cost) return;
    CAM.rp -= p.cost; CAM.perks[p.id] = true; saveCampaign(); play('good');
    toast('Researched: ' + p.name, 'good');
    buildResearch();
  });
  // settings
  const bindSlider = (id, key) => {
    $(id).addEventListener('input', e => {
      SET[key] = clamp(Number(e.target.value) || 0, 0, 1);
      saveSettings(); applyAudio(); refreshSettings();
    });
  };
  bindSlider('#setMaster', 'master'); bindSlider('#setMusic', 'music'); bindSlider('#setSfx', 'sfx');
  $('#setSound').addEventListener('change', e => { SET.sound = !!e.target.checked; saveSettings(); applyAudio(); });
  $('#setParticles').addEventListener('change', e => { SET.particles = !!e.target.checked; saveSettings(); });
  $('#setReduced').addEventListener('change', e => { SET.reduced = !!e.target.checked; saveSettings(); });
  $('#setCoach').addEventListener('change', e => { SET.coach = !!e.target.checked; CAM.coachHidden = !SET.coach; saveSettings(); saveCampaign(); });
  $('#btnResetProgress').addEventListener('click', e => {
    const b = e.currentTarget;
    if (b.getAttribute('data-arm') !== '1') { b.setAttribute('data-arm', '1'); b.textContent = 'Click again to erase everything'; setTimeout(() => { b.setAttribute('data-arm', '0'); b.textContent = 'Erase all campaign progress'; }, 3500); return; }
    b.setAttribute('data-arm', '0'); b.textContent = 'Erase all campaign progress';
    Store.remove(KEY_CAMP); Store.remove(KEY_SAVE);
    CAM = defaultCampaign();
    toast('Campaign progress erased.', 'warn');
    refreshSettings();
  });
  // game HUD
  $('#speedBtns').addEventListener('click', e => {
    const b = e.target.closest('[data-speed]'); if (!b) return;
    setSpeed(Number(b.getAttribute('data-speed'))); play('click');
  });
  $('#btnPause').onclick = () => { play('click'); togglePause(); };
  $('#btnMute').onclick = () => { toggleMute(); };
  $('#btnHelpGame').onclick = () => { openHelpFromGame(); };
  $('#btnMenu').onclick = () => { if (!G || G.over) return; play('click'); UI.autoPaused = false; openPause(); };
  $('#btnResume').onclick = () => { play('click'); resumeGame(); };
  $('#btnSave').onclick = () => { play('click'); saveGameState(false); };
  $('#btnRetry').onclick = () => { play('click'); retryShift(); };
  $('#btnPauseHelp').onclick = () => { play('click'); UI.helpFrom = 'game'; UI.pausedBeforeHelp = true; UI.paused = true; showScreen('help'); };
  $('#btnPauseSettings').onclick = () => { play('click'); UI.setFrom = 'game'; showScreen('settings'); };
  $('#btnQuit').onclick = () => { play('click'); saveGameState(true); closeAllOverlays(); UI.paused = false; UI.hold = null; showScreen('title'); };
  $('#btnToShop').onclick = () => { play('click'); closeOv('ovReport'); buildShop(); openOv('ovShop'); };
  $('#btnNextShift').onclick = () => { play('click'); nextShift(); };
  $('#btnShopBack').onclick = () => { closeOv('ovShop'); if (G && G.over && G.over.type === 'shift') openOv('ovReport'); };
  $('#btnShopNext').onclick = () => { play('click'); nextShift(); };
  $('#shopGrid').addEventListener('click', e => { const b = e.target.closest('[data-buy]'); if (b) buyShop(b.getAttribute('data-buy')); });
  $('#shopPolicy').addEventListener('click', e => { const b = e.target.closest('[data-policy]'); if (b) setPolicy(b.getAttribute('data-policy')); });
  $('#pane-ops').addEventListener('click', e => {
    const p = e.target.closest('[data-policy]'); if (p) { setPolicy(p.getAttribute('data-policy')); return; }
    const c = e.target.closest('[data-act="crew"]');
    if (c && G && !G.over) {
      if (G.cash < 150) return toast('Not enough cash for a crew handover.', 'warn');
      G.cash -= 150; G.stat.costs.labor += 150;
      G.stations.forEach(s => { s.fatigue = 0; });
      G.breakUntil = Math.max(G.breakUntil, G.t + 4);
      logMsg(G, 'Crew handover: fatigue reset, picking paused for 4 min.', 'info');
      play('click'); updateHUD(true);
    }
  });
  $('#pane-ops').addEventListener('input', e => {
    const s = e.target.closest('[data-slider]'); if (!s || !G) return;
    const v = Number(s.value);
    if (s.getAttribute('data-slider') === 'pm') { G.pmThreshold = v; }
    else { G.chargeAt = v; }
    const lab = s.parentNode.querySelector('b'); if (lab) lab.textContent = v + '%';
  });
  $('#pane-fleet').addEventListener('click', e => {
    const it = e.target.closest('[data-robot]'); if (!it || !G) return;
    const r = robotById(G, Number(it.getAttribute('data-robot')));
    if (!r) return;
    UI.selected = { kind: 'robot', id: r.id }; focusRobot(r); play('click'); updateSide(true);
  });
  // tabs
  $$('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => {
    UI.tab = b.getAttribute('data-tab');
    $$('.tabs [data-tab]').forEach(x => x.classList.toggle('on', x === b));
    $$('.tabpane').forEach(p => p.classList.toggle('hidden', p.id !== 'pane-' + UI.tab));
    play('click');
    updateSide(true);
  }));
  // zoom
  $('#zIn').onclick = () => { UI.cam.zoom = clamp(UI.cam.zoom * 1.2, 0.5, 3.5); };
  $('#zOut').onclick = () => { UI.cam.zoom = clamp(UI.cam.zoom / 1.2, 0.5, 3.5); };
  $('#zFit').onclick = () => { UI.cam = { zoom: 1, panX: 0, panY: 0 }; };
  // tools
  $('#tools').addEventListener('click', e => {
    const b = e.target.closest('[data-tool]'); if (!b) return;
    setTool(b.getAttribute('data-tool'));
  });
  // resize & blur
  window.addEventListener('resize', () => { resizeCanvas(); buildLegend(); });
  window.addEventListener('blur', autoPauseNow);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) autoPauseNow();
    else if (UI.autoPaused) { UI.autoPaused = false; if (G && !G.over && !UI.hold) { UI.paused = false; closeOv('ovPause'); updateHUD(true); } }
  });
  // keyboard
  window.addEventListener('keydown', onKey);
  bindCanvas();
  bindTooltips();
}
function autoPauseNow() {
  if (!G || UI.screen !== 'game' || UI.paused || G.over || UI.hold) return;
  UI.autoPaused = true; openPause();
}
function openHelpFromGame() {
  UI.helpFrom = 'game';
  if (G) { UI.pausedBeforeHelp = UI.paused; UI.paused = true; }
  showScreen('help');
}
function leaveHelp() {
  if (UI.helpFrom === 'game') { UI.paused = !!UI.pausedBeforeHelp; returnToGame(); }
  else showScreen('title');
}
function returnToGame() {
  showScreen('game');
  if (!G) return;
  if (G.over) {
    if (G.over.type === 'shift') showReport(G);
    else if (G.over.type === 'victory') showVictory(G);
    else showFail(G);
  } else if (UI.paused) openPause();
  else closeOv('ovPause');
  updateHUD(true);
}
function setPolicy(id) {
  if (!G || G.over) return;
  const ok = id === 'random' || (id === 'velocity' && perk('slot_velocity')) || (id === 'zoned' && perk('slot_zoned'));
  if (!ok) { toast('Unlock this policy in the Research Lab.', 'warn'); play('warn'); return; }
  G.pendingPolicy = id === G.policy ? null : id;
  logMsg(G, 'Slotting policy set to ' + id + ' (applies at next shift start).', 'info');
  play('click');
  buildShop(); renderOps(); updateHUD(true);
}
function toggleMute() {
  SET.muted = !SET.muted; saveSettings(); applyAudio();
  $('#btnMute').textContent = SET.muted ? '🔇' : '🔊';
  toast(SET.muted ? 'Sound muted' : 'Sound on', 'good', 1400);
}
function onKey(e) {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  const k = e.key;
  if (UI.screen !== 'game') {
    if (k === 'Escape') {
      if (UI.screen === 'help') leaveHelp();
      else if (UI.screen === 'settings' && UI.setFrom === 'game') returnToGame();
      else if (UI.screen === 'settings' || UI.screen === 'research' || UI.screen === 'select') showScreen('title');
    }
    return;
  }
  if (k === 'Escape') {
    if ($('#ovShop').classList.contains('open')) { closeOv('ovShop'); if (G && G.over) openOv('ovReport'); return; }
    if ($('#ovReport').classList.contains('open') || $('#ovEnd').classList.contains('open') || $('#ovFail').classList.contains('open')) return;
    if ($('#ovPause').classList.contains('open')) { resumeGame(); return; }
    if (G && !G.over) { UI.autoPaused = false; openPause(); }
    return;
  }
  if (k === 'h' || k === 'H' || k === 'F1') { e.preventDefault(); openHelpFromGame(); return; }
  if (k === 'm' || k === 'M') { toggleMute(); return; }
  if (k === ' ' || k === 'p' || k === 'P') { if (k === ' ') e.preventDefault(); togglePause(); return; }
  if (k === 'v' || k === 'V') { cycleOverlay(); return; }
  if (k === 'z' || k === 'Z') { setSpeed(0.5); return; }
  if (k === 'x' || k === 'X') { setSpeed(1); return; }
  if (k === 'c' || k === 'C') { setSpeed(2); return; }
  if (k === 'b' || k === 'B') { setSpeed(4); return; }
  if (k === '+' || k === '=') { UI.cam.zoom = clamp(UI.cam.zoom * 1.2, 0.5, 3.5); return; }
  if (k === '-' || k === '_') { UI.cam.zoom = clamp(UI.cam.zoom / 1.2, 0.5, 3.5); return; }
  if (k === 'n' || k === 'N') { if (G && G.over && G.over.type === 'shift') nextShift(); return; }
  if (/^[1-9]$/.test(k)) {
    const t = TOOLS.find(x => x.key === k); if (t) setTool(t.id);
  }
}

/* ---------------------------- main loop ---------------------------- */
let lastNow = performance.now();
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
  lastNow = now;
  if (UI.screen === 'title') renderTitleBg(dt);
  if (G && UI.screen === 'game') {
    const running = !UI.paused && !UI.hold && !G.over;
    if (running) {
      UI.acc += dt * SIM_RATE * UI.speed;
      let steps = 0;
      while (UI.acc >= TICK && steps < 60) {
        try { logicTick(G); } catch (err) { console.error(err); UI.acc = 0; break; }
        UI.acc -= TICK; steps++;
        if (G.over || UI.hold) { UI.acc = 0; break; }
      }
    } else UI.acc = 0;
    updateFx(dt);
    try { render(now); } catch (err) { console.error(err); }
    if (now - UI.lastHud > 180) { UI.lastHud = now; updateHUD(false); updateCoach(); updateAmbient(G); }
    if (now - UI.lastSide > 350) {
      UI.lastSide = now;
      if (G.dirty || UI.tab !== 'log') { updateSide(false); }
      G.dirty = false;
    }
    if (G.over && G.over.type === 'shift' && !$('#ovReport').classList.contains('open') && !$('#ovShop').classList.contains('open')) { /* report pending */ }
  }
  requestAnimationFrame(frame);
}

/* ---------------------------- init ---------------------------- */
function init() {
  bindUI();
  resizeCanvas();
  buildTools();
  setSpeedButtons();
  if (!Store.ok) { /* storage unavailable: progress is kept in memory only */ }
  showScreen('title');
  // hide "continue" if nothing to continue
  refreshTitle();
  applyAudio();
  if (SET.muted || !SET.sound) { /* silent start */ }
  requestAnimationFrame(function (t) { lastNow = t; requestAnimationFrame(frame); });
}
window.addEventListener('pointerdown', function firstGesture() {
  auInit();
  window.removeEventListener('pointerdown', firstGesture);
}, { once: false });

// test hooks (read-only access to the simulation for debugging)
window.WarehouseSim = {
  get state() { return G; }, newGame: newGame, logicTick: logicTick, computeFill: computeFill,
  applyBuild: applyBuild, startShift: startShift, endShift: endShift, buyShop: buyShop, SCENARIOS: SCENARIOS, DIFFS: DIFFS,
  setCurrent: function (g) { G = g; RNGOBJ = g; }, layoutProblem: layoutProblem, shopCost: shopCost, currentLevel: currentLevel
};

if (typeof document !== 'undefined' && document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init);
})();
