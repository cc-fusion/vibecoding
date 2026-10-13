// ===== Pocket Valley core: state, loop, input, day cycle =====
import * as D from './data.js';
import * as M from './maps.js';
import { createSound } from './audio.js';
import { installActions } from './actions.js';
import { installRender } from './render.js';
import { installUI } from './ui.js';

const LS = (() => {
  let ok = true; const mem = {};
  try { localStorage.setItem('__pv', '1'); localStorage.removeItem('__pv'); } catch (e) { ok = false; }
  return {
    get(k) { try { return ok ? localStorage.getItem(k) : (mem[k] || null); } catch (e) { return mem[k] || null; } },
    set(k, v) { try { if (ok) localStorage.setItem(k, v); else mem[k] = v; } catch (e) { mem[k] = v; } },
    del(k) { try { if (ok) localStorage.removeItem(k); else delete mem[k]; } catch (e) { delete mem[k]; } },
  };
})();
const jparse = (s, d) => { try { const v = JSON.parse(s); return v && typeof v === 'object' ? v : d; } catch (e) { return d; } };

export function startGame(root) {
  root.innerHTML = '<div class="pv"><canvas class="pv-cv"></canvas><div class="pv-ui"></div></div>';
  const wrap = root.firstChild, cv = wrap.querySelector('canvas'), uiEl = wrap.querySelector('.pv-ui');
  const ctx = cv.getContext('2d');
  const G = {
    D, M, root, wrap, cv, ctx, uiEl, S: null, mode: 'title', overlay: null, keys: new Set(), t: 0, W: 800, H: 600, z: 2, dpr: 1,
    mouse: { x: 0, y: 0, down: false, active: false }, pad: { x: 0, y: 0 }, touch: { x: 0, y: 0, on: false },
    cam: { x: 0, y: 0, shk: 0 }, parts: [], floats: [], monsters: [], npcs: [], projs: [], maps: {}, map: null, mapName: 'farm',
    p: { x: 100, y: 100, face: 'down', fx: 0, fy: 1, moving: false, swing: 0, swingMax: 0.25, cool: 0, inv: 0, kx: 0, ky: 0, stepT: 0, anim: 0, dash: 0 },
    fade: { a: 0, to: 0, cb: null, busy: false }, fishing: null, fest: null, timeAcc: 0, doorCd: 0, musicT: 0, hudT: 0, prevPad: [],
  };
  G.LS = LS;
  G.set = Object.assign({ master: 0.7, music: 0.6, sfx: 0.8, mute: false, dayLen: 1, shake: true, particles: true, touch: 'auto' }, jparse(LS.get('pv_settings'), {}));
  G.meta = Object.assign({ lp: 0, upg: {}, hall: [], runs: 0, wins: 0 }, jparse(LS.get('pv_meta'), {}));
  G.snd = createSound(G.set);
  G.saveSettings = () => LS.set('pv_settings', JSON.stringify(G.set));
  G.saveMeta = () => LS.set('pv_meta', JSON.stringify(G.meta));
  G.hasSave = () => !!LS.get('pv_save');

  installActions(G); installRender(G); installUI(G);

  // ---------- helpers ----------
  G.abs = () => (G.S.day - 1) * 1440 + G.S.time;
  G.seasonOf = (day) => Math.floor(((day || G.S.day) - 1) / D.SEASON_DAYS) % 4;
  G.domOf = (day) => ((day || G.S.day) - 1) % D.SEASON_DAYS + 1;
  G.yearOf = (day) => Math.floor(((day || G.S.day) - 1) / (D.SEASON_DAYS * 4)) + 1;
  G.toast = (msg, icon) => G.ui.toast(msg, icon);
  G.sfx = (n) => G.snd.sfx(n);
  G.skill = (id) => D.lvlOf(G.S.xp[id] || 0);
  G.hearts = (id) => { const f = G.S.friends[id]; return f ? Math.min(10, Math.floor(f.p / D.HEART)) : 0; };
  G.perk = (id) => G.hearts(id) >= 4;
  G.buffVal = (t) => { const b = G.S && G.S.buff; return b && b.t === t && G.abs() < b.until ? b.v : 0; };
  G.gainXP = (id, n) => {
    const S = G.S, b = D.lvlOf(S.xp[id]); S.xp[id] = (S.xp[id] || 0) + n; const a = D.lvlOf(S.xp[id]);
    if (a > b) {
      G.sfx('levelup'); G.toast(D.SKILLS.find(s => s.id === id).n + ' level ' + a + '!', '⭐'); G.float(G.p.x, G.p.y - 30, 'Level Up!', '#ffe14d'); G.burst(G.p.x, G.p.y - 10, 24, '#ffe14d', { up: 1 });
      if (id === 'combat') { S.maxHp += 5; }
    }
  };
  G.addGold = (n) => { G.S.gold += n; if (n > 0) G.S.stats.earned += n; };
  G.ev = (n) => { const S = G.S; if (!S || S.tut[n]) return; S.tut[n] = 1; if (!G.tutCur()) { S.tutDone = true; } };
  G.tutCur = () => { const S = G.S; if (!S || S.tutDone) return null; return D.TUTORIAL.find(t => !S.tut[t.id]) || null; };
  G.float = (x, y, text, col) => { if (G.floats.length < 60) G.floats.push({ x, y, text, col: col || '#fff', life: 1.2, max: 1.2 }); };
  G.burst = (x, y, n, col, o) => {
    if (!G.set.particles) n = Math.ceil(n / 3); o = o || {};
    for (let i = 0; i < n && G.parts.length < 700; i++) {
      const a = o.up ? -Math.PI / 2 + (Math.random() - 0.5) * 2 : Math.random() * Math.PI * 2, s = (o.sp || 60) * (0.3 + Math.random());
      G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up ? 40 : 0), life: (o.life || 0.6) * (0.6 + Math.random() * 0.6), max: o.life || 0.6, size: (o.size || 3) * (0.6 + Math.random() * 0.8), col: Array.isArray(col) ? col[Math.floor(Math.random() * col.length)] : col, g: o.g === undefined ? 120 : o.g });
    }
  };
  G.shake = (a) => { if (G.set.shake) G.cam.shk = Math.max(G.cam.shk, a); };

  // ---------- inventory ----------
  G.itemCount = (id) => { let n = 0; G.S.inv.forEach(s => { if (s && s.id === id) n += s.n; }); return n; };
  G.addItem = (id, n, q) => {
    const S = G.S, it = D.ITEMS[id]; q = q || 0; if (!it || n <= 0) return 0; let left = n;
    for (let i = 6; i < S.invSize && left > 0; i++) { const s = S.inv[i]; if (s && s.id === id && (s.q || 0) === q && s.n < 99) { const a = Math.min(left, 99 - s.n); s.n += a; left -= a; } }
    for (let i = 6; i < S.invSize && left > 0; i++) { if (!S.inv[i]) { const a = Math.min(left, 99); S.inv[i] = { id, n: a, q }; left -= a; } }
    if (left > 0) G.toast('Pack is full! Lost ' + left + ' ' + it.name, '🎒');
    return n - left;
  };
  G.removeItem = (id, n) => {
    if (G.itemCount(id) < n) return false; const S = G.S;
    const idxs = []; S.inv.forEach((s, i) => { if (s && s.id === id) idxs.push(i); });
    idxs.sort((a, b) => (S.inv[a].q || 0) - (S.inv[b].q || 0));
    for (const i of idxs) { const s = S.inv[i], a = Math.min(n, s.n); s.n -= a; n -= a; if (s.n <= 0) S.inv[i] = null; if (n <= 0) break; }
    return true;
  };
  G.priceOf = (it, q) => Math.round(it.price * D.QMULT[q || 0]);
  G.sellPrice = (it, q) => {
    const S = G.S, df = D.DIFFS[S.diff]; let m = df.sell; if (S.mods.frugal) m *= 1.15; if (G.perk('edda')) m *= 1.1;
    return Math.max(1, Math.round(it.price * D.QMULT[q || 0] * m));
  };
  G.buyPrice = (p) => { let m = 1; if (G.S.mods.frugal) m = 1.3; return Math.round(p * m); };
  G.selItem = () => G.S.inv[G.S.sel] || null;

  // ---------- state ----------
  function newState(o) {
    const df = D.DIFFS[o.diff], up = G.meta.upg, has = (k) => !!up[k];
    const S = {
      v: 1, name: o.name || 'Farmer', farm: o.farm || 'Pocket', diff: o.diff, mods: o.mods || {}, look: { shirt: o.shirt || '#3b82c4', hair: o.hair || '#5a3a22' },
      seed: Math.floor(Math.random() * 1e6) + 1, day: 1, time: 360, weather: 'sun', nextWeather: 'sun', gold: df.gold + (has('nest') ? 300 : 0),
      maxEnergy: 150 + (has('back') ? 30 : 0), maxHp: 100 + (has('skin') ? 25 : 0), invSize: 24,
      inv: new Array(36).fill(null), tools: { hoe: has('copper') ? 1 : 0, can: has('copper') ? 1 : 0, pickaxe: 0, axe: 0, rod: 0, sword: 0 }, sel: 0,
      xp: { farming: 0, mining: 0, fishing: 0, foraging: 0, combat: 0 }, friends: {}, bundles: {}, recipes: { fried_egg: 1, salad: 1 }, animals: [], bin: [],
      mine: { max: 0, elev: 0, bosses: {} }, stats: { earned: 0, crops: 0, fish: 0, forage: 0, kills: 0, mined: 0, cooked: 0, gifts: 0, sold: 0, trees: 0, deaths: 0, bossKills: 0, steps: 0 },
      flags: {}, tut: {}, tutDone: false, deadline: df.days + (has('time') ? 10 : 0), upgrades: [], buff: null, mapsData: {}, festDone: {}, caught: {}, won: false, log: [],
    };
    S.energy = S.maxEnergy; S.hp = S.maxHp; S.water = D.CAN_CAP[S.tools.can];
    ['hoe', 'axe', 'pickaxe', 'can', 'sword', 'rod'].forEach((t, i) => { S.inv[i] = { tool: t }; });
    S.inv[6] = { id: 'parsnip_seed', n: 10 + (has('seeds') ? 15 : 0), q: 0 };
    Object.keys(D.NPCS).forEach(id => { S.friends[id] = { p: has('friends') ? 40 : 0, talk: 0, gift: 0, rew: 0 }; });
    D.BUNDLES.forEach(b => { S.bundles[b.id] = b.items.map(() => 0); });
    return S;
  }
  G.newState = newState;

  // ---------- maps ----------
  G.getMap = (name) => {
    if (G.maps[name]) return G.maps[name];
    const S = G.S, m = M.buildMap(name, S.seed);
    const sd = S.mapsData && S.mapsData[name];
    if (sd) { m.objs = sd.objs; m.soil = sd.soil; M.rebuildGrid(m); }
    if (name === 'farm') m.farmUnlocked = !!S.flags.greenhouse;
    G.maps[name] = m; return m;
  };
  G.setMap = (name, tx, ty, floor) => {
    const S = G.S;
    if (name === 'mine') { G.map = M.buildMap('mine', S.seed + S.day * 7, floor); S.mineFloor = floor; }
    else G.map = G.getMap(name);
    G.mapName = name; G.monsters = []; G.projs = []; G.npcs = []; G.parts.length = 0; G.fishing = null; G.stopped = 0;
    G.placePlayer(tx, ty);
    if (name === 'mine') {
      G.spawnMonsters(); S.mine.max = Math.max(S.mine.max, floor);
      if (floor % 5 === 0 && floor > S.mine.elev) { S.mine.elev = floor; G.toast('Elevator unlocked at floor ' + floor, '🛗'); }
      G.toast('Mine floor ' + floor, '⛏️');
    } else G.spawnNPCs();
    if (name === 'town') G.ev('town');
    G.snapCam(); G.updateMusic(true); G.doorCd = 0.7;
    if (G.fest && G.fest.type === 'derby' && name !== 'beach') { /* leaving derby area keeps timer */ }
  };
  G.goto = (name, tx, ty, floor) => {
    if (G.fade.busy) return; G.fade.busy = true; G.fade.to = 1;
    G.fade.cb = () => { G.setMap(name, tx, ty, floor); G.fade.to = 0; };
  };
  G.placePlayer = (tx, ty) => { G.p.x = (tx + 0.5) * D.TILE; G.p.y = (ty + 1) * D.TILE - 4; G.p.kx = G.p.ky = 0; };
  G.snapCam = () => { const p = G.p; G.cam.x = p.x - G.W / G.z / 2; G.cam.y = p.y - G.H / G.z / 2; G.clampCam(); };
  G.clampCam = () => {
    const c = G.cam, m = G.map; if (!m) return; const vw = G.W / G.z, vh = G.H / G.z, mw = m.w * D.TILE, mh = m.h * D.TILE;
    c.x = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, c.x));
    c.y = mh <= vh ? (mh - vh) / 2 : Math.max(0, Math.min(mh - vh, c.y));
  };
  G.ptile = () => ({ x: Math.floor(G.p.x / D.TILE), y: Math.floor((G.p.y - 4) / D.TILE) });

  // ---------- music ----------
  G.updateMusic = (force) => {
    if (G.mode !== 'play' || !G.S) { return; }
    const S = G.S; let m;
    if (G.fest) m = 'festival';
    else if (G.mapName === 'mine') m = G.monsters.some(x => x.boss) ? 'boss' : 'mine';
    else if (S.time >= 1140 || S.time < 400) m = 'night';
    else m = ['spring', 'summer', 'fall', 'winter'][G.seasonOf()];
    if (G.snd.getMode() !== m || force) G.snd.setMode(m);
    const rainy = (S.weather === 'rain' || S.weather === 'storm') && G.map && G.map.outdoor;
    G.snd.setRain(rainy ? (S.weather === 'storm' ? 1.4 : 1) : 0);
  };

  // ---------- new / load / save ----------
  G.startRun = (S, fromSave) => {
    G.S = S; G.maps = {}; G.mode = 'play'; G.overlay = null; G.fest = null; G.fishing = null; G.timeAcc = 0; G.floats.length = 0; G.parts.length = 0;
    const w = S.where;
    if (!fromSave) { G.getMap('farm'); G.getMap('town'); G.getMap('beach'); G.morningSpawn(true); G.festCheck(); }
    G.ui.hideAll(); G.ui.showHud(true);
    if (fromSave && w) { const nm = (w.map === 'mine' || !w.map) ? 'farm' : w.map; const tx = (w.map === 'mine' || !w.map) ? 27 : w.x, ty = (w.map === 'mine' || !w.map) ? 6 : w.y; G.setMap(nm, tx, ty); }
    else G.setMap('farm', 7, 8);
    G.fade.a = 1; G.fade.to = 0; G.fade.busy = true;
    G.snd.init(); G.updateMusic(true);
    if (!fromSave) G.ui.show('intro');
  };
  G.newGame = (opts) => { G.meta.runs++; G.saveMeta(); G.startRun(newState(opts), false); };
  G.save = (quiet) => {
    const S = G.S; if (!S) return;
    const t = G.ptile(); S.where = { map: G.mapName, x: t.x, y: t.y };
    S.mapsData = {}; Object.keys(G.maps).forEach(k => { const m = G.maps[k]; S.mapsData[k] = { objs: m.objs, soil: m.soil }; });
    try { LS.set('pv_save', JSON.stringify(S)); if (!quiet) G.toast('Game saved', '💾'); } catch (e) { if (!quiet) G.toast('Could not save', '⚠️'); }
  };
  G.load = () => {
    const S = jparse(LS.get('pv_save'), null);
    if (!S || !S.inv || !S.day) { G.toast('No valid save found', '⚠️'); return false; }
    if (!S.invSize) S.invSize = 24; if (!S.tools) return false;
    G.startRun(S, true); G.toast('Welcome back, ' + S.name + '!', '🌾'); return true;
  };
  G.toTitle = () => {
    G.mode = 'title'; G.overlay = null; G.fest = null; G.fishing = null; G.S = null; G.map = null; G.ui.hideAll(); G.ui.showHud(false); G.snd.setMode('title'); G.snd.setRain(0); G.ui.show('title');
  };

  // ---------- day cycle ----------
  G.sleep = (why) => {
    if (G.fade.busy || !G.S) return; const S = G.S;
    G.fade.busy = true; G.fade.to = 1; G.overlay = 'sleeping'; G.sfx(why ? 'lose' : 'sleep'); G.fest = null;
    G.fade.cb = () => { G.endDay(why); };
  };
  G.endDay = (why) => {
    const S = G.S, df = D.DIFFS[S.diff], rep = { why, shipped: [], earned: 0, lines: [] };
    // shipping bin
    S.bin.forEach(s => { const it = D.ITEMS[s.id]; if (!it) return; const v = G.sellPrice(it, s.q) * s.n; rep.earned += v; rep.shipped.push({ id: s.id, n: s.n, q: s.q, v }); S.stats.sold += s.n; });
    S.bin = []; G.addGold(rep.earned);
    if (why) {
      const loss = Math.min(600, Math.floor(S.gold * 0.1)); S.gold -= loss; S.stats.deaths++;
      rep.lines.push(why === 'ko' ? '💀 You were knocked out in the mines and lost ' + loss + 'g.' : '😴 You passed out from exhaustion and lost ' + loss + 'g.');
    }
    const late = S.time > 1440;
    const prevSeason = G.seasonOf();
    S.day++; S.time = 360; S.timeAcc = 0;
    const season = G.seasonOf();
    S.weather = S.nextWeather; S.nextWeather = G.rollWeather(S.day + 1);
    if (G.domOf() === D.FESTIVAL_DAY) S.weather = 'sun';
    S.energy = why ? Math.round(S.maxEnergy * 0.5) : (late ? Math.round(S.maxEnergy * 0.75) : S.maxEnergy);
    S.hp = why === 'ko' ? Math.round(S.maxHp * 0.5) : S.maxHp; S.buff = null;
    if (S.hp < S.maxHp * 0.5) S.hp = S.maxHp * 0.5;
    S.water = D.CAN_CAP[S.tools.can];
    G.nightCrops(rep, prevSeason !== season);
    G.nightAnimals(rep);
    G.morningSpawn(false);
    G.festCheck();
    // tool upgrades arriving
    S.upgrades = S.upgrades.filter(u => {
      if (u.day <= S.day) { S.tools[u.tool] = u.tier; const t = D.TOOLS[u.tool]; rep.lines.push('🔨 Brom finished your ' + D.TIER_NAME[u.tier] + ' ' + t.n + '!'); if (u.tool === 'can') S.water = D.CAN_CAP[u.tier]; return false; }
      return true;
    });
    const dom = G.domOf();
    Object.keys(D.NPCS).forEach(id => { const n = D.NPCS[id]; if (n.bday[0] === season && n.bday[1] === dom) rep.lines.push('🎂 Today is ' + n.n + "'s birthday!"); });
    if (dom === 1) rep.lines.push('🗓️ A new season begins: ' + D.SEASONS[season] + '!' + (season === 0 && S.day > 1 ? ' Happy new year!' : ''));
    if (S.festIdx >= 0) rep.lines.push('🎉 Festival today: ' + D.FESTIVALS[S.festIdx].n + ' in Town (9am-2pm)!');
    const left = S.deadline - S.day + 1;
    if (!S.won && left <= 10) rep.lines.push('⏰ Only ' + left + ' day' + (left === 1 ? '' : 's') + ' left to restore the Community Center!');
    G.checkAchievements(rep);
    rep.day = S.day; rep.forecast = S.nextWeather; rep.weather = S.weather;
    // lose check
    if (!S.won && S.day > S.deadline && !G.allBundlesDone()) { G.fade.to = 0; G.fade.busy = false; G.overlay = null; G.lose('deadline'); return; }
    G.setMap('house', 9, 3);
    G.save(true);
    G.fade.to = 0; G.overlay = null;
    G.ev('sleep'); G.updateMusic(true);
    G.ui.show('summary', rep);
  };
  G.checkAchievements = (rep) => { void rep; };
  G.allBundlesDone = () => D.BUNDLES.every(b => G.S.bundles[b.id].every(x => x));
  G.bundlesDone = () => D.BUNDLES.filter(b => G.S.bundles[b.id].every(x => x)).length;

  // ---------- end states ----------
  G.runStats = () => {
    const S = G.S, df = D.DIFFS[S.diff]; let hearts = 0; Object.keys(S.friends).forEach(id => { hearts += G.hearts(id); });
    let mult = df.lp; Object.keys(S.mods).forEach(k => { if (S.mods[k]) mult += D.MODS[k].lp; });
    const bd = G.bundlesDone();
    const lp = Math.round((bd * 8 + S.stats.bossKills * 12 + (S.won ? 60 : 0) + Math.floor(S.day / 5) + Math.floor(hearts / 2)) * mult);
    return { days: S.day, bd, hearts, lp, ...S.stats, gold: S.gold, mult };
  };
  G.finish = (kind, reason) => {
    const S = G.S; const st = G.runStats();
    G.meta.lp += st.lp; if (kind === 'win') G.meta.wins++;
    G.meta.hall.unshift({ name: S.name, farm: S.farm, kind, days: S.day, bd: st.bd, diff: S.diff, lp: st.lp });
    G.meta.hall = G.meta.hall.slice(0, 8); G.saveMeta();
    G.mode = 'over'; G.overlay = 'end'; G.fest = null;
    G.snd.setMode(kind === 'win' ? 'win' : 'lose'); G.snd.sfx(kind === 'win' ? 'fanfare' : 'lose');
    if (kind === 'lose') LS.del('pv_save');
    G.ui.show(kind === 'win' ? 'victory' : 'gameover', { st, reason });
  };
  G.win = () => { G.S.won = true; G.save(true); G.finish('win'); };
  G.lose = (reason) => { G.finish('lose', reason); };
  G.keepPlaying = () => { G.mode = 'play'; G.overlay = null; G.ui.hideAll(); G.ui.showHud(true); G.fade.to = 0; G.fade.busy = false; G.updateMusic(true); G.toast('Free play: no deadline. Enjoy the valley!', '🌻'); };

  // ---------- time ----------
  function timeStep() {
    const S = G.S; S.time += 10;
    G.npcTick(); G.festTick();
    if (S.buff && G.abs() >= S.buff.until) { S.buff = null; G.toast('Your buff wore off.', '⌛'); }
    if (S.time === 1500) G.toast("It's getting very late... you should sleep!", '🌙');
    if (S.time >= D.DAY_END) { G.sleep('late'); return; }
    if (S.time === 1200) G.toast('Night falls over the valley.', '🌙');
    G.updateMusic(false);
  }
  G.timeSpeed = () => 1.35 * G.set.dayLen * (G.S.mods.fast ? 0.75 : 1);

  // ---------- update ----------
  function movePlayer(dt) {
    const S = G.S, p = G.p, m = G.map, k = G.keys;
    let ix = 0, iy = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) ix -= 1; if (k.has('KeyD') || k.has('ArrowRight')) ix += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) iy -= 1; if (k.has('KeyS') || k.has('ArrowDown')) iy += 1;
    ix += G.pad.x + G.touch.x; iy += G.pad.y + G.touch.y;
    const len = Math.hypot(ix, iy); if (len > 1) { ix /= len; iy /= len; }
    const locked = G.fishing || G.fade.busy;
    if (locked) { ix = 0; iy = 0; }
    p.moving = len > 0.15;
    let spd = 104 * (1 + G.buffVal('speed') * 0.12) * (p.swing > 0 ? 0.7 : 1);
    if (p.dash > 0) spd *= 2.6;
    if (p.moving) {
      if (Math.abs(ix) > Math.abs(iy)) { p.face = ix > 0 ? 'right' : 'left'; p.fx = ix > 0 ? 1 : -1; p.fy = 0; } else { p.face = iy > 0 ? 'down' : 'up'; p.fy = iy > 0 ? 1 : -1; p.fx = 0; }
      if (len > 0.15 && (k.size)) G.mouse.active = false;
      p.anim += dt * 9; p.stepT -= dt;
      if (p.stepT <= 0) { p.stepT = 0.34; G.sfx('step'); S.stats.steps++; G.ev('move'); }
    } else p.anim = 0;
    const mx = (ix * spd + p.kx) * dt, my = (iy * spd + p.ky) * dt;
    p.kx *= Math.pow(0.002, dt); p.ky *= Math.pow(0.002, dt);
    const ok = (x, y) => !M.solidAt(m, Math.floor((x - 7) / 32), Math.floor((y - 8) / 32)) && !M.solidAt(m, Math.floor((x + 7) / 32), Math.floor((y - 8) / 32)) && !M.solidAt(m, Math.floor((x - 7) / 32), Math.floor((y - 0.01) / 32)) && !M.solidAt(m, Math.floor((x + 7) / 32), Math.floor((y - 0.01) / 32));
    if (ok(p.x + mx, p.y)) p.x += mx; if (ok(p.x, p.y + my)) p.y += my;
    p.x = Math.max(8, Math.min(m.w * 32 - 8, p.x)); p.y = Math.max(8, Math.min(m.h * 32 - 1, p.y));
  }
  function checkTriggers() {
    const m = G.map, t = G.ptile(); if (G.doorCd > 0 || G.fade.busy) return;
    for (const w of m.warps) if (t.x >= w.x && t.x < w.x + w.w && t.y >= w.y && t.y < w.y + w.h) { G.sfx('door'); G.goto(w.to, t.x + w.dx, t.y + w.dy); return; }
    for (const d of m.doors) if (d.x === t.x && d.y === t.y) { G.onDoor(d); return; }
    if (G.mapName === 'mine') {
      const o = M.objAt(m, t.x, t.y);
      if (o && o.t === 'down') { G.sfx('stairs'); G.goMine(G.S.mineFloor + 1); }
      else if (o && o.t === 'up') {
        const f = G.S.mineFloor; G.sfx('stairs');
        if (f <= 1) G.goto('farm', 27, 6); else G.goMine(f - 1);
      }
    }
  }
  G.onDoor = (d) => {
    const S = G.S, t = S.time; const back = () => { G.placePlayer(d.x, d.y + 1); G.doorCd = 0.5; };
    const open = (a, b) => t >= a && t < b;
    G.sfx('door');
    if (d.type === 'warp') { G.goto(d.to, d.tx, d.ty); return; }
    if (d.type === 'locked') { G.toast(d.msg, '🔒'); back(); return; }
    if (d.type === 'greenhouse') { if (S.flags.greenhouse) { G.goto('greenhouse', 5, 7); } else { G.toast('The Greenhouse is boarded up. The Community Center might help...', '🔒'); back(); } return; }
    if (d.type === 'mine') { back(); if (S.mine.elev >= 5) G.ui.show('mineSelect'); else G.goMine(1); return; }
    if (d.type === 'coop' || d.type === 'barn') { back(); G.ui.show('animals', { kind: d.type }); return; }
    if (d.type === 'center') { back(); G.ui.show('bundles'); return; }
    if (d.type === 'shop') {
      const hrs = { general: [540, 1020], saloon: [720, 1440], smith: [540, 1020], ranch: [540, 1020], tackle: [360, 1200] }[d.shop];
      back();
      if (!open(hrs[0], hrs[1])) { G.toast('Closed. Hours: ' + D.fmtTime(hrs[0]) + ' - ' + D.fmtTime(hrs[1] % 1440), '🔒'); return; }
      G.ui.show('shop', { shop: d.shop });
    }
  };
  G.goMine = (floor) => {
    G.fade.busy = true; G.fade.to = 1; G.fade.cb = () => { G.setMap('mine', 0, 0, floor); const mm = G.map; G.placePlayer(mm.start.x, mm.start.y); G.snapCam(); G.fade.to = 0; };
  };

  function update(dt) {
    const S = G.S, p = G.p;
    // time
    if (!G.fade.busy) { S.timeAcc = (S.timeAcc || 0) + dt; const st = G.timeSpeed(); while (S.timeAcc >= st && G.overlay === null && G.mode === 'play') { S.timeAcc -= st; timeStep(); if (G.fade.busy) break; } }
    if (G.mode !== 'play') return;
    p.cool = Math.max(0, p.cool - dt); p.swing = Math.max(0, p.swing - dt); p.inv = Math.max(0, p.inv - dt); p.dash = Math.max(0, p.dash - dt); G.doorCd = Math.max(0, G.doorCd - dt);
    movePlayer(dt);
    checkTriggers();
    G.updateActions(dt);
    // held action auto-repeat
    if (G.mouse.down || G.keys.has('Space')) { const hs = S.inv[S.sel]; if (!G.fishing && p.cool <= 0 && G.overlay === null && !(hs && hs.tool === 'rod')) G.useTool(false); }
    // particles
    for (let i = G.parts.length - 1; i >= 0; i--) { const q = G.parts[i]; q.life -= dt; if (q.life <= 0) { G.parts.splice(i, 1); continue; } q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    for (let i = G.floats.length - 1; i >= 0; i--) { const f = G.floats[i]; f.life -= dt; f.y -= 22 * dt; if (f.life <= 0) G.floats.splice(i, 1); }
    // weather particles are drawn in render; ambient emitters
    G.musicT -= dt; if (G.musicT <= 0) { G.musicT = 1; G.updateMusic(false); }
    if (S.weather === 'storm' && G.map.outdoor && Math.random() < dt * 0.05) { G.flash = 0.7; G.sfx('thunder'); G.shake(4); }
    if (G.flash) G.flash = Math.max(0, G.flash - dt * 1.6);
    // hp / energy
    if (S.energy < 0) S.energy = 0;
    if (S.hp <= 0 && !G.fade.busy) { G.toast('You were knocked out!', '💀'); G.sleep('ko'); }
    // camera
    const c = G.cam, vw = G.W / G.z, vh = G.H / G.z, tx = p.x - vw / 2, ty = p.y - 10 - vh / 2;
    const k = 1 - Math.pow(0.0005, dt); c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
    G.clampCam();
  }

  // ---------- gamepad ----------
  function pollPad() {
    G.pad.x = 0; G.pad.y = 0;
    let gp = null; try { const l = navigator.getGamepads ? navigator.getGamepads() : []; for (const g of l) if (g && g.connected) { gp = g; break; } } catch (e) { gp = null; }
    if (!gp) return;
    const dz = (v) => Math.abs(v) > 0.25 ? v : 0;
    G.pad.x = dz(gp.axes[0] || 0) + ((gp.buttons[15] && gp.buttons[15].pressed) ? 1 : 0) - ((gp.buttons[14] && gp.buttons[14].pressed) ? 1 : 0);
    G.pad.y = dz(gp.axes[1] || 0) + ((gp.buttons[13] && gp.buttons[13].pressed) ? 1 : 0) - ((gp.buttons[12] && gp.buttons[12].pressed) ? 1 : 0);
    const pr = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed), prev = G.prevPad;
    const edge = (i) => pr(i) && !prev[i];
    if (G.mode === 'play' && G.overlay === null) {
      if (edge(0)) G.useTool(true); if (edge(2)) G.interact(); if (edge(3)) G.ui.show('journal', { tab: 'pack' });
      if (edge(4)) G.cycleSel(-1); if (edge(5)) G.cycleSel(1); if (edge(9)) G.ui.show('pause');
    } else if (edge(9) || edge(1)) G.ui.back();
    G.prevPad = [0, 1, 2, 3, 4, 5, 9].reduce((a, i) => { a[i] = pr(i); return a; }, []);
  }
  G.cycleSel = (d) => { const S = G.S; S.sel = (S.sel + d + 12) % 12; G.sfx('click'); };

  // ---------- frame ----------
  let raf = 0, last = 0, errOnce = false, dead = false;
  function frame(ts) {
    if (dead) return; raf = requestAnimationFrame(frame);
    let dt = (ts - last) / 1000; last = ts; if (!(dt > 0)) dt = 0.016; if (dt > 0.1) dt = 0.1;
    G.t += dt;
    try {
      pollPad();
      // fade
      const f = G.fade; if (f.a !== f.to) { const s = 4.5 * dt; f.a = f.a < f.to ? Math.min(f.to, f.a + s) : Math.max(f.to, f.a - s); if (f.a === f.to) { if (f.to === 1 && f.cb) { const cb = f.cb; f.cb = null; cb(); } else if (f.to === 0) f.busy = false; } }
      if (G.mode === 'play' && G.S && G.map) { if (G.overlay === null || G.overlay === 'sleeping') { if (G.overlay === null) update(dt); } G.cam.shk = Math.max(0, G.cam.shk - dt * 18); }
      G.render(dt);
      G.ui.hud(dt);
    } catch (e) { if (!errOnce) { errOnce = true; console.error(e); } }
  }
  // ---------- input ----------
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); cleanup.push(() => t.removeEventListener(ev, fn, o)); };
  const cleanup = [];
  function resize() {
    G.dpr = Math.min(2, window.devicePixelRatio || 1); G.W = wrap.clientWidth || window.innerWidth; G.H = wrap.clientHeight || window.innerHeight;
    cv.width = Math.floor(G.W * G.dpr); cv.height = Math.floor(G.H * G.dpr);
    G.z = Math.max(0.85, Math.min(3, Math.min(G.W / (20 * 32), G.H / (12 * 32))));
    if (G.map) G.clampCam();
  }
  on(window, 'resize', resize); resize();
  on(window, 'keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) { if (e.code === 'Escape') e.target.blur(); return; }
    G.snd.init();
    const c = e.code;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c) && G.mode === 'play') e.preventDefault();
    if (G.mode === 'play' && G.overlay === null) G.keys.add(c);
    if (c === 'KeyM' && !e.repeat) { G.set.mute = !G.set.mute; G.snd.apply(); G.saveSettings(); G.toast(G.set.mute ? 'Sound muted' : 'Sound on', G.set.mute ? '🔇' : '🔊'); G.ui.refresh(); return; }
    if (e.repeat) return;
    if (G.mode === 'play' && G.S) {
      if (c === 'Escape') { if (G.overlay) G.ui.back(); else G.ui.show('pause'); return; }
      if (G.overlay === null) {
        if (c === 'Space') { if (!G.fishing) G.useTool(true); else G.fishAction(); }
        else if (c === 'KeyE' || c === 'Enter') G.interact();
        else if (c === 'KeyI' || c === 'Tab') G.ui.show('journal', { tab: 'pack' });
        else if (c === 'KeyC') G.ui.show('journal', { tab: 'craft' });
        else if (c === 'KeyJ') G.ui.show('journal', { tab: 'bundles' });
        else if (c === 'KeyF') G.ui.show('journal', { tab: 'social' });
        else if (c === 'KeyH') G.ui.show('journal', { tab: 'help' });
        else if (c === 'KeyQ') G.cycleSel(-1);
        else if (c === 'KeyR') G.cycleSel(1);
        else if (c === 'ShiftLeft' || c === 'ShiftRight') G.dashMove();
        else if (/^Digit[0-9]$/.test(c)) { const n = c === 'Digit0' ? 9 : parseInt(c.slice(5), 10) - 1; G.S.sel = n; G.sfx('click'); }
        else if (c === 'Minus') G.S.sel = 10; else if (c === 'Equal') G.S.sel = 11;
      } else if (G.overlay === 'journal' && (c === 'KeyI' || c === 'Tab')) G.ui.back();
      else if (G.overlay !== null && G.overlay !== 'sleeping') G.ui.key(c);
    } else if (G.mode !== 'play') { if (c === 'Escape') G.ui.back(); }
  });
  on(window, 'keyup', (e) => { G.keys.delete(e.code); if (e.code === 'Space') G.fishRelease && G.fishRelease(); });
  on(window, 'blur', () => { G.keys.clear(); G.mouse.down = false; if (G.mode === 'play' && G.overlay === null && G.S) G.ui.show('pause'); });
  on(document, 'visibilitychange', () => { if (document.hidden) { G.keys.clear(); G.mouse.down = false; if (G.mode === 'play' && G.overlay === null && G.S) G.ui.show('pause'); } });
  on(cv, 'mousemove', (e) => { const r = cv.getBoundingClientRect(); G.mouse.x = e.clientX - r.left; G.mouse.y = e.clientY - r.top; G.mouse.active = true; });
  on(cv, 'mousedown', (e) => {
    G.snd.init(); const r = cv.getBoundingClientRect(); G.mouse.x = e.clientX - r.left; G.mouse.y = e.clientY - r.top; G.mouse.active = true;
    if (G.mode !== 'play' || G.overlay !== null || !G.S) return;
    if (e.button === 0) { G.mouse.down = true; if (G.fishing) G.fishAction(); else G.useTool(true); } else if (e.button === 2) G.interact();
  });
  on(window, 'mouseup', (e) => { if (e.button === 0) { G.mouse.down = false; G.fishRelease && G.fishRelease(); } });
  on(cv, 'contextmenu', (e) => e.preventDefault());
  on(cv, 'wheel', (e) => { if (G.mode === 'play' && G.overlay === null && G.S) { G.cycleSel(e.deltaY > 0 ? 1 : -1); e.preventDefault(); } }, { passive: false });
  G.mouseTile = () => { const x = (G.mouse.x / G.z + G.cam.x) / 32, y = (G.mouse.y / G.z + G.cam.y) / 32; return { x: Math.floor(x), y: Math.floor(y), fx: x, fy: y }; };

  G.toTitle();
  raf = requestAnimationFrame(frame);
  return function destroy() {
    dead = true; cancelAnimationFrame(raf); cleanup.forEach(f => f()); try { G.snd.destroy(); } catch (e) { /* ignore */ }
    if (G.ui && G.ui.destroy) G.ui.destroy(); root.innerHTML = '';
  };
}
