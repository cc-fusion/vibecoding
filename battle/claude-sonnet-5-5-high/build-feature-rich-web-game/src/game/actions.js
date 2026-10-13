// ===== Pocket Valley actions: tools, crops, fishing, machines, daily processing =====
import * as D from './data.js';
import * as M from './maps.js';
import { installWorld } from './world.js';

D.ITEMS.junk = { id: 'junk', name: 'Soggy Driftwood', icon: '🪵', price: 1, cat: 'misc' };

export function installActions(G) {
  const T = D.TILE, rnd = Math.random;
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  G.target = () => {
    const p = G.p, t = G.ptile(); let x = t.x + p.fx, y = t.y + p.fy;
    if (G.mouse.active && !G.touch.on) {
      const mt = G.mouseTile(), dx = mt.fx - p.x / T, dy = mt.fy - (p.y - 10) / T;
      if (Math.hypot(dx, dy) <= 3.2) {
        x = mt.x; y = mt.y;
        if (Math.abs(dx) > Math.abs(dy)) { p.face = dx > 0 ? 'right' : 'left'; p.fx = dx > 0 ? 1 : -1; p.fy = 0; } else { p.face = dy > 0 ? 'down' : 'up'; p.fy = dy > 0 ? 1 : -1; p.fx = 0; }
      }
    }
    return { x, y };
  };
  const pattern = (tier, tx, ty) => {
    const p = G.p, fx = p.fx, fy = p.fy, rx = -fy, ry = fx, out = [];
    const ws = tier >= 2 ? [-1, 0, 1] : [0], ls = (tier === 1 || tier >= 3) ? [0, 1, 2] : [0];
    ls.forEach(l => ws.forEach(w => out.push([tx + fx * l + rx * w, ty + fy * l + ry * w])));
    return out;
  };
  const soilKey = (m, x, y) => y * m.w + x;
  const soilAt = (m, x, y) => m.soil[soilKey(m, x, y)];
  G.soilAt = soilAt;
  const isWater = (m, x, y) => M.inb(m, x, y) && m.g[y * m.w + x] === M.WA;
  const energyCost = (tool) => {
    const S = G.S, df = D.DIFFS[S.diff]; let c = { hoe: 2, can: 1.5, pickaxe: 2.5, axe: 2.5, rod: 1.5, sword: 0 }[tool] * df.energy;
    if (tool === 'hoe' || tool === 'can') c *= 1 - 0.04 * G.skill('farming');
    if (tool === 'pickaxe') c *= (1 - 0.04 * G.skill('mining')) * (1 - 0.12 * G.buffVal('mining'));
    if (tool === 'axe') c *= 1 - 0.03 * G.skill('foraging');
    if (tool === 'rod') c *= 1 - 0.03 * G.skill('fishing');
    return c;
  };
  const faceTo = (tx, ty) => {
    const p = G.p, t = G.ptile(), dx = tx - t.x, dy = ty - t.y;
    if (dx === 0 && dy === 0) return;
    if (Math.abs(dx) >= Math.abs(dy)) { p.face = dx > 0 ? 'right' : 'left'; p.fx = dx > 0 ? 1 : -1; p.fy = 0; } else { p.face = dy > 0 ? 'down' : 'up'; p.fy = dy > 0 ? 1 : -1; p.fx = 0; }
  };

  // ---------- main use ----------
  G.useTool = (edge) => {
    const S = G.S, p = G.p, m = G.map; if (p.cool > 0 || G.fishing || G.fade.busy) return;
    const slot = S.inv[S.sel]; if (!slot) { return; }
    const tg = G.target();
    if (slot.tool) { toolUse(slot.tool, tg.x, tg.y); return; }
    const it = D.ITEMS[slot.id]; if (!it) return;
    const sl = soilAt(m, tg.x, tg.y);
    if (it.seed) { plantSeed(it, tg.x, tg.y); return; }
    if (sl && sl.crop && isRipe(sl.crop)) { harvest(m, tg.x, tg.y); return; }
    if (it.id === 'fertilizer') { if (sl && !sl.fert && (!sl.crop || sl.crop.g === 0)) { sl.fert = 1; G.removeItem('fertilizer', 1); G.sfx('plant'); G.burst((tg.x + 0.5) * T, (tg.y + 0.5) * T, 8, '#6b4a2a'); p.cool = 0.25; } else if (edge) { G.toast('Use fertilizer on tilled, unplanted soil.', '🟤'); } return; }
    if (it.place) { placeItem(it, tg.x, tg.y, edge); return; }
    if (it.cat === 'food' && edge) { G.eat(S.sel); }
  };
  const isRipe = (c) => c && D.CROPS[c.id] && c.g >= D.CROPS[c.id].d;
  G.isRipe = isRipe;

  function toolUse(tool, tx, ty) {
    const S = G.S, p = G.p, m = G.map;
    if (S.upgrades.some(u => u.tool === tool)) { G.toast('Brom is still upgrading your ' + D.TOOLS[tool].n + '.', '🔨'); G.sfx('error'); p.cool = 0.3; return; }
    const tier = S.tools[tool], cost = energyCost(tool);
    if (tool !== 'sword' && S.energy < cost) { G.toast("You're too tired! Eat something or sleep.", '😴'); G.sfx('error'); p.cool = 0.5; return; }
    const sl = soilAt(m, tx, ty);
    faceTo(tx, ty);
    if (tool !== 'sword' && sl && sl.crop && isRipe(sl.crop) && tool !== 'pickaxe') { harvest(m, tx, ty); return; }
    const swing = (cd) => { p.swing = 0.24; p.swingMax = 0.24; p.cool = cd; p.tool = tool; };
    if (tool === 'hoe') {
      swing(0.34); let did = 0;
      pattern(tier, tx, ty).forEach(([x, y]) => { if (hoeTile(x, y)) did++; });
      if (did) { S.energy -= cost; G.sfx('hoe'); G.gainXP('farming', 1); } else if (!G.touchedTile) { G.sfx('error'); }
    } else if (tool === 'can') {
      swing(0.3);
      if (isWater(m, tx, ty) || waterNear(tx, ty)) { S.water = D.CAN_CAP[tier]; G.sfx('splash'); G.burst((tx + 0.5) * T, (ty + 0.5) * T, 12, '#8fd3ff', { up: 1 }); G.toast('Watering can refilled', '💧'); S.energy -= 0.5; return; }
      if (S.water <= 0) { G.toast('Out of water! Refill at a pond, river or the sea.', '💧'); G.sfx('error'); return; }
      let did = 0; pattern(tier, tx, ty).forEach(([x, y]) => { if (S.water > 0 && waterTile(x, y)) did++; });
      if (did) { S.energy -= cost; G.sfx('water'); }
    } else if (tool === 'pickaxe') {
      swing(0.4); pickTile(tx, ty, cost);
    } else if (tool === 'axe') {
      swing(0.42); axeTile(tx, ty, cost);
    } else if (tool === 'sword') {
      swing(0.36); G.swordAttack();
    } else if (tool === 'rod') {
      if (G.fest && G.fest.type !== 'derby') { G.toast('Not now!', '🎣'); return; }
      castRod(tx, ty, cost);
    }
  }
  const waterNear = (x, y) => isWater(G.map, x, y);
  function hoeTile(x, y) {
    const m = G.map, S = G.S; G.touchedTile = false;
    if (!M.inb(m, x, y)) return false;
    const o = M.objAt(m, x, y), i = soilKey(m, x, y);
    if (o && (o.t === 'weed' || o.t === 'twig')) { clearDebris(m, o); return true; }
    if (o) return false;
    if (!m.farm) { G.touchedTile = true; return false; }
    const g = m.g[i]; if (m.s[i] || m.soil[i]) return false;
    if (!(g === M.GR || (m.greenhouse && g === M.DI))) { return false; }
    m.soil[i] = { tilled: 1, wet: (S.weather === 'rain' || S.weather === 'storm') && m.outdoor ? 1 : 0 };
    G.burst((x + 0.5) * T, (y + 0.6) * T, 8, ['#7a5230', '#5a3a1c'], { sp: 50 }); G.ev('till'); return true;
  }
  function clearDebris(m, o) {
    const S = G.S;
    M.removeObj(m, o);
    if (o.t === 'weed') { if (rnd() < 0.5) G.addItem('fiber', 1); if (rnd() < 0.08 + 0.04 * G.skill('foraging')) G.addItem('hay', 1); G.burst((o.x + 0.5) * T, (o.y + 0.6) * T, 8, ['#58b84a', '#3e8a35'], { sp: 60 }); G.gainXP('foraging', 1); }
    else { G.addItem('wood', 1 + (rnd() < 0.4 ? 1 : 0)); G.burst((o.x + 0.5) * T, (o.y + 0.6) * T, 6, '#8a5a2a'); G.gainXP('foraging', 1); }
    G.sfx('chop'); G.ev('clear'); void S;
  }
  G.clearDebris = clearDebris;
  function waterTile(x, y) {
    const m = G.map, S = G.S, sl = soilAt(m, x, y); if (!sl || sl.wet) return false;
    sl.wet = 1; S.water--; G.burst((x + 0.5) * T, (y + 0.5) * T, 6, '#7fc4ff', { up: 1, sp: 50 }); if (sl.crop) G.ev('water'); return true;
  }
  function pickTile(tx, ty, cost) {
    const S = G.S, m = G.map, tier = S.tools.pickaxe, o = M.objAt(m, tx, ty), sl = soilAt(m, tx, ty);
    if (o && o.t === 'rock') {
      const dmg = 2 + tier * 1.6 + G.skill('mining') * 0.3 + G.buffVal('mining') * 0.8; o.hp -= dmg; S.energy -= cost; o.hit = 0.15;
      G.sfx('mine'); G.shake(1.5); G.burst((tx + 0.5) * T, (ty + 0.5) * T, 6, ['#bbb', '#888', '#eee'], { sp: 70 });
      if (o.hp <= 0) G.breakRock(m, o);
    } else if (o && o.t === 'twig' || o && o.t === 'weed') { clearDebris(m, o); S.energy -= cost * 0.5; }
    else if (o && (o.t === 'sprinkler' || o.t === 'qsprinkler' || o.t === 'scarecrow' || o.t === 'furnace' || o.t === 'jar')) {
      if (o.st === 'busy' || o.st === 'done') { G.toast('Empty it first!', '⚠️'); return; }
      M.removeObj(m, o); G.addItem(o.t, 1); G.sfx('pickup'); G.burst((tx + 0.5) * T, (ty + 0.5) * T, 6, '#fff');
    } else if (sl && !sl.crop) { delete m.soil[soilKey(m, tx, ty)]; G.sfx('hoe'); S.energy -= cost * 0.4; }
    else if (sl && sl.crop) { delete sl.crop; G.sfx('chop'); S.energy -= cost * 0.4; G.float((tx + 0.5) * T, ty * T, 'Uprooted', '#ccc'); }
    else { G.sfx('error'); }
  }
  G.breakRock = (m, o, bonus) => {
    const S = G.S; M.removeObj(m, o); G.sfx('break'); G.shake(2.5);
    const col = { stone: '#aaa', coal: '#333', copper: '#d9803f', iron: '#cfd8e0', gold: '#ffd23f', gem: '#b46bff' }[o.k];
    G.burst((o.x + 0.5) * T, (o.y + 0.5) * T, 16, [col, '#888', '#ccc'], { sp: 90 });
    const bn = (rnd() < 0.12 + G.skill('mining') * 0.02 + (G.perk('rook') ? 0.25 : 0) + (bonus ? 0.3 : 0)) ? 1 : 0;
    const give = (id, n) => { const a = G.addItem(id, n); if (a) G.float((o.x + 0.5) * T, o.y * T, '+' + a + ' ' + D.ITEMS[id].icon, '#fff'); };
    let xp = 2;
    if (o.k === 'stone') { give('stone', 1 + (rnd() < 0.5 ? 1 : 0)); if (m.mine && rnd() < 0.06) give('coal', 1); }
    else if (o.k === 'coal') { give('coal', 1 + bn); xp = 5; }
    else if (o.k === 'copper') { give('copper_ore', 1 + (rnd() < 0.5 ? 1 : 0) + bn); xp = 6; }
    else if (o.k === 'iron') { give('iron_ore', 1 + (rnd() < 0.4 ? 1 : 0) + bn); xp = 9; }
    else if (o.k === 'gold') { give('gold_ore', 1 + (rnd() < 0.3 ? 1 : 0) + bn); xp = 14; }
    else if (o.k === 'gem') {
      const f = m.floor || 1, q = rnd(); let g = 'quartz';
      if (f >= 12 && q < 0.15) g = 'ruby'; else if (f >= 8 && q < 0.4) g = 'topaz'; else if (f >= 4 && q < 0.6) g = 'amethyst';
      give(g, 1); xp = 12;
    }
    G.gainXP('mining', xp); S.stats.mined++; G.ev('clear');
    if (o.stairs) { M.addObj(m, { t: 'down', x: o.x, y: o.y }); G.toast('A ladder down was revealed!', '🪜'); G.sfx('stairs'); G.burst((o.x + 0.5) * T, (o.y + 0.5) * T, 20, '#ffe14d', { up: 1 }); }
    if (m.mine) {
      m.broken = (m.broken || 0) + 1;
      if (S.mods.surge && rnd() < 0.08) G.spawnMon('slime', (o.x + 0.5) * T, (o.y + 0.5) * T);
      if (!m.boss && m.rockTotal && m.broken >= m.rockTotal * 0.55) {
        const hid = m.objs.find(q => q.t === 'rock' && q.stairs);
        if (hid) { hid.stairs = false; M.removeObj(m, hid); M.addObj(m, { t: 'down', x: hid.x, y: hid.y }); G.toast('A ladder down was revealed!', '🪜'); }
      }
    }
  };
  function axeTile(tx, ty, cost) {
    const S = G.S, m = G.map, o = M.objAt(m, tx, ty), tier = S.tools.axe;
    if (o && o.t === 'tree') {
      S.energy -= cost; o.hp -= 1 + tier * 0.7 + G.skill('foraging') * 0.1; o.shk = 0.2; G.sfx('chop'); G.shake(1.2);
      G.burst((tx + 0.5) * T, (ty - 0.3) * T, 6, ['#3e8a35', '#58b84a', '#8a5a2a'], { sp: 60 });
      if (o.hp <= 0) {
        M.removeObj(m, o); G.sfx('break'); G.shake(3); S.stats.trees++;
        const n = 6 + Math.floor(rnd() * 5) + (G.skill('foraging') >= 4 ? 2 : 0); G.addItem('wood', n); G.float((tx + 0.5) * T, ty * T, '+' + n + ' 🪵', '#e8c38a');
        if (rnd() < 0.3) G.addItem('hazelnut', 1); G.gainXP('foraging', 8);
        G.burst((tx + 0.5) * T, (ty - 0.5) * T, 24, ['#3e8a35', '#58b84a', '#2f6e2c'], { sp: 100 }); G.ev('clear');
      }
    } else if (o && (o.t === 'twig' || o.t === 'weed')) { clearDebris(m, o); S.energy -= cost * 0.4; }
    else if (o && (o.t === 'sprinkler' || o.t === 'qsprinkler' || o.t === 'scarecrow')) { M.removeObj(m, o); G.addItem(o.t, 1); G.sfx('pickup'); }
    else if (o && o.t === 'bush') { S.energy -= cost * 0.5; G.sfx('chop'); o.hp = (o.hp || 3) - 1; G.burst((tx + 0.5) * T, (ty + 0.5) * T, 6, '#3e8a35'); if (o.hp <= 0) { M.removeObj(m, o); G.addItem('wood', 2); G.addItem('fiber', 2); } }
    else G.sfx('error');
  }

  // ---------- crops ----------
  function plantSeed(it, x, y) {
    const S = G.S, m = G.map, sl = soilAt(m, x, y), cd = D.CROPS[it.seed], p = G.p;
    faceTo(x, y);
    if (!sl) { if (!G.seedHint || G.t - G.seedHint > 1.5) { G.toast('Till the soil with the hoe first.', '⚒️'); G.seedHint = G.t; } p.cool = 0.2; return; }
    if (sl.crop) { p.cool = 0.15; return; }
    const season = G.seasonOf();
    if (!cd.s.includes(season) && !m.greenhouse) { if (!G.seedHint || G.t - G.seedHint > 1.5) { G.toast(cd.n + " won't grow in " + D.SEASONS[season] + '.', '🚫'); G.seedHint = G.t; } G.sfx('error'); p.cool = 0.3; return; }
    sl.crop = { id: it.seed, g: 0 }; G.removeItem(it.id, 1); p.cool = 0.2; p.swing = 0.15; p.swingMax = 0.15; p.tool = 'seed';
    G.sfx('plant'); G.burst((x + 0.5) * T, (y + 0.6) * T, 6, '#6b4a2a'); G.gainXP('farming', 1); G.ev('plant');
  }
  function harvest(m, x, y) {
    const S = G.S, sl = soilAt(m, x, y), c = sl.crop, cd = D.CROPS[c.id], p = G.p;
    const lvl = G.skill('farming'), gq = 0.02 * lvl + (sl.fert ? 0.2 : 0) + G.buffVal('luck') * 0.03, sq = 0.08 * lvl * 0.5 + (sl.fert ? 0.2 : 0);
    let q = 0; const r = rnd(); if (r < gq) q = 2; else if (r < gq + sq + 0.05) q = 1;
    let n = 1; if (lvl >= 6 && rnd() < 0.12) n = 2; if (cd.id === 'corn' && rnd() < 0.15) n++;
    const got = G.addItem(c.id, n, q); if (!got) return;
    if (cd.rg > 0) { c.g = Math.max(0, cd.d - cd.rg); } else delete sl.crop;
    S.stats.crops += got; G.gainXP('farming', 6 + Math.round(cd.p / 25)); G.sfx('harvest');
    G.float((x + 0.5) * T, (y - 0.2) * T, '+' + got + ' ' + cd.i + D.QSTAR[q], q ? '#ffe14d' : '#fff');
    G.burst((x + 0.5) * T, (y + 0.4) * T, 12, [cd.id === 'pumpkin' ? '#ff9a2e' : '#7fe06a', '#fff', '#ffd23f'], { up: 1, sp: 90 });
    p.cool = 0.25; p.swing = 0.16; p.swingMax = 0.16; p.tool = 'seed'; G.ev('harvest');
  }
  G.harvestAt = harvest;

  G.nightCrops = (rep, seasonChanged) => {
    const S = G.S, season = G.seasonOf(); let withered = 0, grown = 0, ripe = 0;
    ['farm', 'greenhouse'].forEach(name => {
      const m = G.maps[name]; if (!m) return; const out = name === 'farm';
      for (const k in m.soil) {
        const sl = m.soil[k], c = sl.crop;
        if (c && D.CROPS[c.id]) {
          const cd = D.CROPS[c.id];
          if (out && seasonChanged && !cd.s.includes(season)) { delete sl.crop; withered++; }
          else if (sl.wet) { let add = 1; if (G.meta.upg.thumb && rnd() < 0.12) add++; c.g = Math.min(cd.d, c.g + add); grown++; if (c.g >= cd.d) ripe++; }
        }
        sl.wet = m.greenhouse ? 1 : 0;
      }
    });
    if (withered) rep.lines.push('🥀 ' + withered + ' crop' + (withered > 1 ? 's' : '') + ' withered with the change of season.');
    if (ripe) rep.lines.push('🌾 ' + ripe + ' crop' + (ripe > 1 ? 's are' : ' is') + ' ready to harvest!');
    // crows
    const fm = G.maps.farm;
    if (fm && season !== 3) {
      const crops = []; for (const k in fm.soil) if (fm.soil[k].crop) crops.push(k);
      if (crops.length >= 3 && rnd() < 0.3) {
        const scares = fm.objs.filter(o => o.t === 'scarecrow'); let eaten = 0, saved = 0; const n = 1 + Math.floor(crops.length / 20);
        for (let i = 0; i < n; i++) {
          const k = pick(crops), x = k % fm.w, y = (k / fm.w) | 0;
          if (scares.some(s => Math.hypot(s.x - x, s.y - y) <= 7)) { saved++; continue; }
          if (fm.soil[k].crop) { delete fm.soil[k].crop; eaten++; }
        }
        if (eaten) rep.lines.push('🐦 Crows ate ' + eaten + ' of your crops! Build a scarecrow.');
        else if (saved) rep.lines.push('🧑‍🌾 Your scarecrow scared off the crows!');
      }
    }
    // rain + sprinklers
    ['farm', 'greenhouse'].forEach(name => {
      const m = G.maps[name]; if (!m) return;
      if (name === 'farm' && (S.weather === 'rain' || S.weather === 'storm')) for (const k in m.soil) m.soil[k].wet = 1;
      m.objs.forEach(o => {
        if (o.t !== 'sprinkler' && o.t !== 'qsprinkler') return;
        const offs = o.t === 'sprinkler' ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        offs.forEach(([dx, dy]) => { const sl = m.soil[(o.y + dy) * m.w + o.x + dx]; if (sl) sl.wet = 1; });
      });
    });
    void grown;
  };

  G.rollWeather = (day) => {
    const S = G.S, se = G.seasonOf(day), dom = G.domOf(day), r = rnd();
    if (day <= 2 || dom === D.FESTIVAL_DAY) return 'sun';
    const dr = S.mods.drought ? 0.3 : 1;
    if (se === 0) return r < 0.28 * dr ? 'rain' : 'sun';
    if (se === 1) return r < 0.12 * dr ? 'storm' : r < 0.27 * dr ? 'rain' : 'sun';
    if (se === 2) return r < 0.06 * dr ? 'storm' : r < 0.34 * dr ? 'rain' : 'sun';
    return r < 0.38 ? 'snow' : 'sun';
  };

  // ---------- daily spawns ----------
  G.morningSpawn = (initial) => {
    const S = G.S, season = G.seasonOf();
    const cfg = { farm: { n: 6, g: M.GR }, town: { n: 8, g: M.GR }, beach: { n: 7, g: M.SA } };
    Object.keys(cfg).forEach(name => {
      const m = G.getMap(name);
      m.objs.filter(o => o.t === 'forage' || o.t === 'egg').forEach(o => M.removeObj(m, o));
      const pool = D.FORAGE.filter(f => f[4].includes(season) && (name === 'beach' ? (f[0] === 'seashell' || f[0] === 'crab') || rnd() < 0.2 : (f[0] !== 'seashell' && f[0] !== 'crab')));
      if (!pool.length) return;
      let n = cfg[name].n + (G.perk('lily') ? 2 : 0), tries = 0;
      while (n > 0 && tries++ < 200) {
        const x = 3 + Math.floor(rnd() * (m.w - 6)), y = 3 + Math.floor(rnd() * (m.h - 6));
        if (m.g[y * m.w + x] !== cfg[name].g || !M.tileFree(m, x, y) || m.soil[y * m.w + x]) continue;
        if (name === 'beach' && y > 12) continue; if (name === 'town' && (y < 9 || y > 19)) continue;
        if (name === 'farm' && (x < 3 || y < 7)) continue;
        const f = pick(pool); M.addObj(m, { t: 'forage', item: f[0], x, y }); n--;
      }
    });
    const fm = G.getMap('farm');
    if (season !== 3 && !initial) {
      let n = 4 + Math.floor(rnd() * 4), tries = 0;
      while (n > 0 && tries++ < 150) {
        const x = 3 + Math.floor(rnd() * 42), y = 7 + Math.floor(rnd() * 23);
        if (fm.g[y * fm.w + x] !== M.GR || !M.tileFree(fm, x, y) || fm.soil[y * fm.w + x] || M.objAt(fm, x, y)) continue;
        if (x >= 33 && x <= 41 && y <= 15) continue;
        M.addObj(fm, { t: 'weed', x, y, hp: 1, v: Math.floor(rnd() * 3) }); n--;
      }
    }
  };

  // ---------- eating ----------
  G.edible = (it) => {
    if (it.food) return it.food;
    if (['crop', 'forage', 'fish', 'animal', 'artisan'].includes(it.cat)) return { e: Math.min(60, Math.round(it.price * 0.3) + 5), h: Math.round(it.price * 0.12) };
    return null;
  };
  G.eat = (idx) => {
    const S = G.S, s = S.inv[idx]; if (!s || !s.id) return false;
    const it = D.ITEMS[s.id], f = G.edible(it); if (!f) { G.toast("You can't eat that.", '🚫'); return false; }
    let e = f.e * (it.cat === 'food' && G.perk('otto') ? 1.25 : 1), h = f.h;
    e = Math.round(e); S.energy = Math.min(S.maxEnergy, S.energy + e); S.hp = Math.min(S.maxHp, S.hp + h);
    if (f.buff) { S.buff = { t: f.buff[0], v: f.buff[1], until: G.abs() + f.buff[2], name: D.BUFF_NAME[f.buff[0]] }; G.toast(D.BUFF_NAME[f.buff[0]] + ' +' + f.buff[1] + ' buff!', '✨'); }
    G.removeItem(s.id, 1); G.sfx('eat'); G.float(G.p.x, G.p.y - 24, '+' + e + ' ⚡', '#ffe14d'); if (h) G.float(G.p.x + 10, G.p.y - 38, '+' + h + ' ❤', '#ff6b6b');
    G.burst(G.p.x, G.p.y - 16, 8, ['#ffe14d', '#fff'], { up: 1 }); return true;
  };

  // ---------- placement ----------
  function placeItem(it, x, y, edge) {
    const S = G.S, m = G.map, p = G.p;
    if (!M.tileFree(m, x, y) || isWater(m, x, y) || (m.soil[soilKey(m, x, y)] && m.soil[soilKey(m, x, y)].crop)) { if (edge) { G.sfx('error'); G.toast("Can't place that there.", '🚫'); } return; }
    if (it.id !== 'bomb' && !m.farm) { if (edge) G.toast('Place it on your farm.', '🏡'); return; }
    const o = { t: it.id, x, y, solid: it.id !== 'bomb' };
    if (it.id === 'bomb') { o.timer = 2.2; o.solid = false; } else if (it.id === 'furnace' || it.id === 'jar') o.st = 'idle';
    M.addObj(m, o); G.removeItem(it.id, 1); G.sfx('pickup'); p.cool = 0.3; faceTo(x, y);
    G.burst((x + 0.5) * T, (y + 0.7) * T, 8, '#ddd'); void S;
  }
  function explode(m, o) {
    G.sfx('boom'); G.shake(9); M.removeObj(m, o);
    const cx = (o.x + 0.5) * T, cy = (o.y + 0.5) * T;
    G.burst(cx, cy, 50, ['#ffb02e', '#ff6a2e', '#555', '#ffe14d'], { sp: 170, life: 0.8, size: 4 });
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy > 6) continue; const q = M.objAt(m, o.x + dx, o.y + dy);
      if (q && q.t === 'rock') G.breakRock(m, q, true); else if (q && (q.t === 'weed' || q.t === 'twig')) M.removeObj(m, q);
    }
    G.monsters.slice().forEach(mo => { const d = Math.hypot(mo.x - cx, mo.y - cy); if (d < 90) G.damageMonster(mo, 45, (mo.x - cx) / (d || 1) * 200, (mo.y - cy) / (d || 1) * 200, true); });
    const dp = Math.hypot(G.p.x - cx, G.p.y - 10 - cy); if (dp < 70) G.hurt(22, cx, cy);
  }

  // ---------- machines ----------
  G.useMachine = (o) => {
    const S = G.S, m = G.map, now = G.abs();
    if (o.st === 'done' || (o.st === 'busy' && now >= o.ready)) {
      const n = G.addItem(o.out, 1); if (n) { G.sfx('pickup'); G.float((o.x + 0.5) * T, o.y * T, '+1 ' + D.ITEMS[o.out].icon, '#fff'); o.st = 'idle'; o.out = null; G.gainXP(o.t === 'furnace' ? 'mining' : 'farming', 8); }
      return;
    }
    if (o.st === 'busy') { const mins = o.ready - now; G.toast('Working... ready in ' + (mins >= 120 ? Math.round(mins / 60) + ' hours' : mins + ' min'), '⏳'); return; }
    if (o.t === 'furnace') {
      const sel = G.selItem(), order = (sel && sel.id && sel.id.endsWith('_ore')) ? [sel.id, 'gold_ore', 'iron_ore', 'copper_ore'] : ['gold_ore', 'iron_ore', 'copper_ore'];
      const ore = order.find(id => G.itemCount(id) >= 5);
      if (!ore) { G.toast('Needs 5 ore and 1 coal.', '🔥'); G.sfx('error'); return; }
      if (G.itemCount('coal') < 1) { G.toast('Needs 1 coal as fuel.', '🔥'); G.sfx('error'); return; }
      G.removeItem(ore, 5); G.removeItem('coal', 1); o.st = 'busy'; o.out = ore.replace('_ore', '_bar'); o.ready = now + 120; G.sfx('craft'); G.burst((o.x + 0.5) * T, o.y * T, 10, ['#ff9a2e', '#555'], { up: 1 });
      G.toast('Smelting ' + D.ITEMS[o.out].name + '...', '🔥');
    } else if (o.t === 'jar') {
      const sel = G.selItem(); let id = sel && sel.id && D.ITEMS[sel.id] && D.ITEMS[sel.id].cat === 'crop' ? sel.id : null;
      if (!id) { const f = S.inv.find(s => s && s.id && D.ITEMS[s.id].cat === 'crop'); id = f ? f.id : null; }
      if (!id) { G.toast('Put a crop inside to make Jelly or Pickles.', '🏺'); G.sfx('error'); return; }
      G.removeItem(id, 1); o.st = 'busy'; o.out = D.CROPS[id].fr ? 'jelly' : 'pickles'; o.ready = now + 2880; G.sfx('craft'); G.toast('Preserving ' + D.ITEMS[id].name + '... (2 days)', '🏺');
    }
    void m;
  };

  // ---------- fishing ----------
  function castRod(tx, ty, cost) {
    const S = G.S, m = G.map, p = G.p, t = G.ptile(); let wx = -1, wy = -1;
    if (isWater(m, tx, ty)) { wx = tx; wy = ty; }
    else for (let k = 1; k <= 5; k++) { const x = t.x + p.fx * k, y = t.y + p.fy * k; if (!M.inb(m, x, y)) break; if (isWater(m, x, y)) { wx = x; wy = y; break; } if (M.solidAt(m, x, y)) break; }
    if (wx < 0 || !m.fish) { G.toast('Face the water to cast your line.', '🎣'); G.sfx('error'); p.cool = 0.3; return; }
    S.energy -= cost; G.sfx('cast'); p.swing = 0.3; p.swingMax = 0.3; p.cool = 0.3; p.tool = 'rod';
    const bt = Math.max(0.8, 2 + rnd() * 3 - G.skill('fishing') * 0.12 - G.buffVal('fishing') * 0.25 - ((S.weather === 'rain' || S.weather === 'storm') ? 0.6 : 0));
    G.fishing = { phase: 'cast', t: 0.5, wx, wy, wait: bt, loc: m.fish, hold: false };
  }
  G.fishAction = () => {
    const f = G.fishing; if (!f) return;
    if (f.phase === 'wait') { G.fishing = null; G.toast('Reeled in too early.', '🎣'); G.sfx('lost'); G.p.cool = 0.3; }
    else if (f.phase === 'bite') { startFishGame(f); }
  };
  G.fishRelease = () => { };
  function chooseFish(loc) {
    const S = G.S, season = G.seasonOf(), h = S.time / 60, rain = S.weather === 'rain' || S.weather === 'storm', lv = G.skill('fishing');
    const pool = D.FISH.filter(f => f.loc === loc && f.se.includes(season) && h >= f.h[0] && h < f.h[1] && (!f.w || rain) && (!f.legend || lv >= f.lvl));
    const norm = pool.filter(f => !f.legend), leg = pool.find(f => f.legend);
    if (leg && rnd() < 0.04 + lv * 0.004) return leg;
    if (rnd() < 0.1 || !norm.length) return null;
    const w = norm.map(f => 1 + (lv * f.p) / 400 + (rain && f.w ? 1.5 : 0)); let r = rnd() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < norm.length; i++) { r -= w[i]; if (r <= 0) return norm[i]; }
    return norm[0];
  }
  function startFishGame(f) {
    const S = G.S, fish = f.fish; const rod = S.tools.rod;
    const bs = 0.17 + G.skill('fishing') * 0.012 + rod * 0.05 + (G.perk('salty') ? 0.04 : 0) + G.buffVal('fishing') * 0.02;
    f.phase = 'game'; f.bar = 0.3; f.bv = 0; f.size = Math.min(0.5, bs); f.fp = 0.6; f.ft = 0.6; f.fcd = 0; f.prog = 0.3; f.perfect = true; f.spd = 0.35 + (fish ? fish.d : 15) / 90; f.age = 0;
    G.sfx('click');
  }
  function updateFishing(dt) {
    const f = G.fishing; if (!f) return; const p = G.p;
    if (f.phase === 'cast') { f.t -= dt; if (f.t <= 0) { f.phase = 'wait'; G.sfx('splash'); } }
    else if (f.phase === 'wait') {
      f.wait -= dt; if (rnd() < dt * 3) G.burst((f.wx + 0.5) * T, (f.wy + 0.5) * T, 1, '#cfeaff', { sp: 20, g: 0, life: 0.5 });
      if (f.wait <= 0) { f.fish = chooseFish(f.loc); f.phase = 'bite'; f.t = 0.75; G.sfx('bite'); G.shake(1); }
    } else if (f.phase === 'bite') {
      f.t -= dt; if (f.t <= 0) { G.fishing = null; G.toast('The fish got away...', '🎣'); G.sfx('lost'); p.cool = 0.3; }
    } else if (f.phase === 'game') {
      f.age += dt; const hold = G.mouse.down || G.keys.has('Space');
      f.bv += (hold ? -1 : 1) * 1.25 * dt * (hold ? 1.2 : 1); f.bv *= Math.pow(0.18, dt); f.bar += f.bv * dt * 1.4;
      if (f.bar < 0) { f.bar = 0; f.bv = Math.abs(f.bv) * 0.3; } if (f.bar > 1 - f.size) { f.bar = 1 - f.size; f.bv = -Math.abs(f.bv) * 0.3; }
      f.fcd -= dt; if (f.fcd <= 0) { f.ft = rnd(); f.fcd = 0.5 + rnd() * 0.9 - (f.fish ? f.fish.d : 20) / 300; }
      const d = f.ft - f.fp; f.fp += Math.sign(d) * Math.min(Math.abs(d), f.spd * dt * (0.6 + rnd() * 0.8));
      const inb = f.fp >= f.bar - 0.02 && f.fp <= f.bar + f.size + 0.02;
      if (inb) f.prog += dt * 0.3; else { f.prog -= dt * 0.17; f.perfect = false; }
      if (hold && rnd() < dt * 12) G.sfx('reel');
      if (f.prog >= 1) endFish(true); else if (f.prog <= 0) endFish(false);
    }
  }
  function endFish(ok) {
    const S = G.S, f = G.fishing; G.fishing = null; G.p.cool = 0.4;
    if (!ok) { G.toast('The fish got away!', '🎣'); G.sfx('lost'); return; }
    const fish = f.fish;
    if (!fish) { G.addItem('junk', 1); G.toast('You reeled in some junk.', '🪵'); G.sfx('pickup'); G.gainXP('fishing', 1); return; }
    let q = 0; if (!fish.legend) { const r = rnd(); const gq = (f.perfect ? 0.3 : 0.02) + G.skill('fishing') * 0.02; if (r < gq * 0.5) q = 2; else if (r < gq + (f.perfect ? 0.25 : 0.08)) q = 1; }
    const n = G.addItem(fish.id, 1, q); if (!n) return;
    S.stats.fish++; S.caught[fish.id] = (S.caught[fish.id] || 0) + 1;
    G.gainXP('fishing', 6 + Math.round(fish.p / 12) + (f.perfect ? 6 : 0)); G.sfx('catch');
    G.float(G.p.x, G.p.y - 36, fish.i + ' ' + fish.n + D.QSTAR[q] + (f.perfect ? ' PERFECT!' : ''), q || f.perfect ? '#ffe14d' : '#fff');
    G.burst(G.p.x, G.p.y - 20, 16, ['#8fd3ff', '#fff', '#ffe14d'], { up: 1, sp: 100 }); G.ev('fish');
    if (fish.legend) { G.toast('You caught the legendary Golden Koi!!', '🐡'); G.shake(5); }
    if (G.fest && G.fest.type === 'derby') { G.fest.score += Math.round(fish.p * D.QMULT[q]); }
  }

  // ---------- interaction ----------
  G.interact = () => {
    const S = G.S, m = G.map, p = G.p; if (G.fade.busy || G.overlay) return;
    const tg = G.target(), t = G.ptile();
    // NPC
    const n = G.nearNPC(); if (n) { G.ui.show('npc', { id: n.id }); G.sfx('click'); return; }
    // crop
    const sl = soilAt(m, tg.x, tg.y);
    if (sl && sl.crop && isRipe(sl.crop)) { harvest(m, tg.x, tg.y); return; }
    const cand = [[tg.x, tg.y], [t.x, t.y], [t.x + p.fx, t.y + p.fy]];
    for (const [x, y] of cand) {
      const o = M.objAt(m, x, y); if (!o) continue;
      if (o.t === 'forage') { G.pickForage(m, o); return; }
      if (o.t === 'bed') { G.ui.show('confirmSleep'); return; }
      if (o.t === 'bin') { G.ui.show('bin'); return; }
      if (o.t === 'stove') { G.ui.show('cook'); return; }
      if (o.t === 'tv') { G.ui.show('tv'); return; }
      if (o.t === 'furnace' || o.t === 'jar') { G.useMachine(o); return; }
    }
    if (isWater(m, tg.x, tg.y) && S.water < D.CAN_CAP[S.tools.can]) { S.water = D.CAN_CAP[S.tools.can]; G.sfx('splash'); G.toast('Watering can refilled', '💧'); return; }
    const sel = G.selItem(); if (sel && sel.id && G.edible(D.ITEMS[sel.id])) { G.eat(S.sel); }
  };
  G.pickForage = (m, o) => {
    const S = G.S, lv = G.skill('foraging'); let q = 0; const r = rnd();
    if (r < 0.02 * lv + (G.perk('lily') ? 0.1 : 0)) q = 2; else if (r < 0.07 * lv + (G.perk('lily') ? 0.25 : 0.04)) q = 1;
    const n = G.addItem(o.item, 1, q); if (!n) return;
    M.removeObj(m, o); S.stats.forage++; G.gainXP('foraging', 3); G.sfx('pickup');
    G.float((o.x + 0.5) * T, o.y * T, '+1 ' + D.ITEMS[o.item].icon + D.QSTAR[q], '#fff'); G.burst((o.x + 0.5) * T, (o.y + 0.5) * T, 8, ['#fff', '#ffe14d'], { up: 1 });
  };

  G.dashMove = () => {
    const S = G.S, p = G.p; if (G.overlay || G.fishing || G.fade.busy) return;
    if ((p.dcd || 0) > G.t || S.energy < 3) return;
    p.dcd = G.t + 0.9; p.dash = 0.16; p.inv = Math.max(p.inv, 0.3); S.energy -= 2; G.sfx('dash');
    if (!p.moving) { p.kx += p.fx * 520; p.ky += p.fy * 520; }
    G.burst(p.x, p.y - 4, 10, '#e8dcc4', { sp: 60, g: 0 });
  };

  G.updateActions = (dt) => {
    const S = G.S, m = G.map, p = G.p, t = G.ptile();
    updateFishing(dt);
    G.updateMonsters(dt); G.updateNPCs(dt);
    // objects: bombs & hit shakes
    for (let i = m.objs.length - 1; i >= 0; i--) {
      const o = m.objs[i];
      if (o.t === 'bomb') { o.timer -= dt; if (o.timer <= 0) explode(m, o); } else { if (o.hit > 0) o.hit -= dt; if (o.shk > 0) o.shk -= dt; }
    }
    // walk-over pickups
    const o = M.objAt(m, t.x, t.y);
    if (o && o.t === 'forage' && !G.fishing) G.pickForage(m, o);
    if (o && o.t === 'egg' && G.fest && G.fest.type === 'egg') { M.removeObj(m, o); G.fest.score++; G.sfx('egg'); G.float((o.x + 0.5) * T, o.y * T, '🥚 ' + G.fest.score, '#ffe14d'); G.burst((o.x + 0.5) * T, (o.y + 0.5) * T, 8, ['#ff8fb8', '#ffe14d', '#8fd3ff'], { up: 1 }); }
    G.updateFest(dt);
    // buff expiry hud handled elsewhere; water refill when standing near water with can selected is manual
    void S; void p;
  };

  installWorld(G);
}
