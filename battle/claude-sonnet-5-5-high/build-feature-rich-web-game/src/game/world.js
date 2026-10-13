// ===== Pocket Valley world: combat, NPCs, animals, festivals, shops, crafting, bundles =====
import * as D from './data.js';
import * as M from './maps.js';

export function installWorld(G) {
  const T = D.TILE, rnd = Math.random;
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  // =================== COMBAT ===================
  G.spawnMon = (type, x, y, boss) => {
    const S = G.S, floor = S.mineFloor || 1, df = D.DIFFS[S.diff];
    const base = boss ? D.BOSSES[boss] : D.MON[type];
    const sc = boss ? 1 : 1 + 0.07 * floor;
    const mo = { type: boss ? base.id : type, boss: !!boss, bossFloor: boss || 0, def: base, x, y, kx: 0, ky: 0, flash: 0, anim: rnd() * 6, st: 0, t: 0.5 + rnd(), t2: 3, cd: 1 + rnd() * 2, hidden: type === 'crab' && !boss, r: base.r };
    mo.hp = Math.round(base.hp * sc * (S.mods.surge ? 1.35 : 1) * (df.dmg < 1 ? 0.85 : 1)); mo.mhp = mo.hp;
    G.monsters.push(mo); void df; return mo;
  };
  G.spawnMonsters = () => {
    const m = G.map, S = G.S, f = m.floor; m.rockTotal = m.objs.filter(o => o.t === 'rock').length; m.broken = 0;
    G.monsters = []; G.projs = [];
    const bdef = D.BOSSES[f];
    if (m.boss && bdef && !S.mine.bosses[f]) {
      G.spawnMon(null, 28.5 * T, 14.5 * T, f);
      G.toast('Boss: ' + bdef.n + '!', '👹'); G.sfx('bossroar'); G.shake(6); G.updateMusic(true);
      return;
    }
    if (m.boss && f < 15) { const cx = 19, cy = 13; M.addObj(m, { t: 'down', x: cx, y: cy }); }
    let n = Math.round((4 + f * 0.6) * (S.mods.surge ? 1.5 : 1)); if (m.boss) n = Math.round(n * 0.6);
    const types = f <= 4 ? ['slime', 'slime', 'slime', 'bat', 'bat', f >= 3 ? 'crab' : 'slime']
      : f <= 9 ? ['slime', 'slime', 'bat', 'bat', 'crab', 'crab', 'skeleton', 'skeleton', f >= 7 ? 'ghost' : 'skeleton']
        : ['skeleton', 'skeleton', 'skeleton', 'ghost', 'ghost', 'sprite', 'sprite', 'sprite', 'bat', 'crab', 'slime'];
    let tries = 0;
    while (n > 0 && tries++ < 400) {
      const x = 1 + Math.floor(rnd() * (m.w - 2)), y = 1 + Math.floor(rnd() * (m.h - 2)), i = y * m.w + x;
      if (m.dist[i] < 9 || M.solidAt(m, x, y)) continue;
      G.spawnMon(pick(types), (x + 0.5) * T, (y + 0.5) * T); n--;
    }
  };
  function mmove(mo, dx, dy) {
    const m = G.map, r = mo.r * 0.55;
    const ok = (x, y) => mo.def.ghost || !(M.solidAt(m, Math.floor((x - r) / T), Math.floor((y - r) / T)) || M.solidAt(m, Math.floor((x + r) / T), Math.floor((y - r) / T)) || M.solidAt(m, Math.floor((x - r) / T), Math.floor((y + r) / T)) || M.solidAt(m, Math.floor((x + r) / T), Math.floor((y + r) / T)));
    if (ok(mo.x + dx, mo.y)) mo.x += dx; if (ok(mo.x, mo.y + dy)) mo.y += dy;
    mo.x = Math.max(8, Math.min(m.w * T - 8, mo.x)); mo.y = Math.max(8, Math.min(m.h * T - 8, mo.y));
  }
  const shoot = (mo, a, sp, kind, dmg) => { G.projs.push({ x: mo.x, y: mo.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: dmg || mo.def.dmg, life: 3.2, r: kind === 'fire' ? 6 : 5, kind }); };

  G.updateMonsters = (dt) => {
    const p = G.p, px = p.x, py = p.y - 10;
    for (let i = G.monsters.length - 1; i >= 0; i--) {
      const mo = G.monsters[i], d = mo.def; mo.anim += dt; mo.flash = Math.max(0, mo.flash - dt);
      if (Math.abs(mo.kx) + Math.abs(mo.ky) > 5) { mmove(mo, mo.kx * dt, mo.ky * dt); const f = Math.pow(0.01, dt); mo.kx *= f; mo.ky *= f; }
      const dx = px - mo.x, dy = py - mo.y, dist = Math.hypot(dx, dy) || 1, nx = dx / dist, ny = dy / dist;
      if (mo.boss) bossAI(mo, dt, dist, nx, ny, px, py);
      else {
        const aggro = dist < 250; mo.cd -= dt; mo.t -= dt;
        if (mo.type === 'slime') {
          if (mo.t <= 0) { mo.hop = !mo.hop; mo.t = mo.hop ? 0.5 : 0.5 + rnd() * 0.6; mo.wa = rnd() * 6.28; }
          if (mo.hop) { if (aggro) mmove(mo, nx * d.sp * 1.9 * dt, ny * d.sp * 1.9 * dt); else mmove(mo, Math.cos(mo.wa) * 20 * dt, Math.sin(mo.wa) * 20 * dt); }
        } else if (mo.type === 'bat') {
          if (aggro) { const w = Math.sin(mo.anim * 5) * 0.9; mmove(mo, (nx - ny * w) * d.sp * dt, (ny + nx * w) * d.sp * dt); }
          else { if (mo.t <= 0) { mo.t = 1 + rnd(); mo.wa = rnd() * 6.28; } mmove(mo, Math.cos(mo.wa) * 25 * dt, Math.sin(mo.wa) * 25 * dt); }
        } else if (mo.type === 'crab') {
          if (mo.hidden) { if (dist < 70) { mo.hidden = false; G.sfx('hit'); G.burst(mo.x, mo.y, 8, '#888'); } }
          else if (aggro) mmove(mo, nx * d.sp * dt, ny * d.sp * dt);
        } else if (mo.type === 'skeleton') {
          if (aggro) {
            if (dist > 150) mmove(mo, nx * d.sp * dt, ny * d.sp * dt); else if (dist < 95) mmove(mo, -nx * d.sp * dt, -ny * d.sp * dt); else mmove(mo, -ny * d.sp * 0.6 * dt, nx * d.sp * 0.6 * dt);
            if (mo.cd <= 0 && dist < 260) { shoot(mo, Math.atan2(dy, dx), 125, 'bone'); mo.cd = 2.2 + rnd(); G.sfx('shoot'); }
          }
        } else if (mo.type === 'ghost') {
          if (dist < 300) mmove(mo, nx * d.sp * dt + Math.sin(mo.anim * 2) * 14 * dt, ny * d.sp * dt + Math.cos(mo.anim * 2) * 14 * dt);
        } else if (mo.type === 'sprite') {
          if (aggro) {
            if (dist > 140) mmove(mo, nx * d.sp * dt, ny * d.sp * dt); else if (dist < 90) mmove(mo, -nx * d.sp * dt, -ny * d.sp * dt); else mmove(mo, -ny * d.sp * 0.8 * dt, nx * d.sp * 0.8 * dt);
            if (mo.cd <= 0) { shoot(mo, Math.atan2(dy, dx), 115, 'fire'); mo.cd = 2.4 + rnd(); G.sfx('shoot'); }
          }
        }
      }
      if (!mo.hidden && dist < mo.r + 8 && p.inv <= 0 && !(mo.st === 1 && mo.type === 'bonelord')) G.hurt(d.dmg, mo.x, mo.y);
    }
    for (let i = G.projs.length - 1; i >= 0; i--) {
      const q = G.projs[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.life <= 0 || M.solidAt(G.map, Math.floor(q.x / T), Math.floor(q.y / T))) { G.burst(q.x, q.y, 4, q.kind === 'fire' ? '#ff8a2e' : '#eee', { sp: 40, g: 0 }); G.projs.splice(i, 1); continue; }
      if (Math.hypot(q.x - p.x, q.y - 10 - p.y) < q.r + 8 && p.inv <= 0) { G.hurt(q.dmg, q.x - q.vx * 0.05, q.y - q.vy * 0.05); G.projs.splice(i, 1); }
    }
  };
  function bossAI(mo, dt, dist, nx, ny, px, py) {
    const hpf = mo.hp / mo.mhp; mo.t -= dt; mo.t2 -= dt;
    if (mo.type === 'slimeking') {
      if (mo.st === 0) { mmove(mo, nx * 42 * dt, ny * 42 * dt); if (mo.t <= 0) { mo.st = 1; mo.t = 0.7; } }
      else if (mo.st === 1) { if (mo.t <= 0) { mo.st = 2; mo.t = 0.55; mo.jx = nx; mo.jy = ny; G.sfx('swing'); } }
      else { mmove(mo, mo.jx * 240 * dt, mo.jy * 240 * dt); if (mo.t <= 0) { mo.st = 0; mo.t = 1.1 + hpf * 0.8; G.shake(7); G.sfx('boom'); G.burst(mo.x, mo.y, 30, '#7fe06a', { sp: 140, g: 0 }); if (dist < 80) G.hurt(mo.def.dmg, mo.x, mo.y); } }
      [0.75, 0.5, 0.25].forEach(th => { if (hpf < th && !mo['s' + th]) { mo['s' + th] = 1; for (let k = 0; k < 3; k++) G.spawnMon('slime', mo.x + (rnd() - 0.5) * 80, mo.y + (rnd() - 0.5) * 80); G.toast('The Slime King calls his subjects!', '👑'); G.sfx('bossroar'); } });
    } else if (mo.type === 'bonelord') {
      if (mo.st === 0) {
        const want = dist > 150 ? 1 : dist < 100 ? -1 : 0; mmove(mo, (nx * want - ny * 0.7) * 55 * dt, (ny * want + nx * 0.7) * 55 * dt);
        if (mo.t <= 0) { mo.st = 1; mo.t = 0.7; mo.jx = nx; mo.jy = ny; G.sfx('bossroar'); }
        else if (mo.t2 <= 0) { const n = hpf < 0.5 ? 14 : 9, off = rnd() * 6.28; for (let k = 0; k < n; k++) shoot(mo, off + k / n * 6.28, 110, 'bone', mo.def.dmg * 0.8); mo.t2 = 3.6; G.sfx('shoot'); G.shake(3); }
      } else if (mo.st === 1) { mo.jx = nx; mo.jy = ny; if (mo.t <= 0) { mo.st = 2; mo.t = 0.5; } }
      else { mmove(mo, mo.jx * 320 * dt, mo.jy * 320 * dt); if (Math.random() < 0.5) G.burst(mo.x, mo.y, 1, '#eee', { sp: 20, g: 0 }); if (mo.t <= 0) { mo.st = 0; mo.t = 2.4 + hpf * 1.5; } }
    } else if (mo.type === 'golem') {
      const sp = hpf < 0.5 ? 54 : 36;
      if (mo.st === 0) {
        mmove(mo, nx * sp * dt, ny * sp * dt);
        if (mo.t <= 0) { mo.st = 1; mo.t = 0.95; G.sfx('bossroar'); }
        else if (mo.t2 <= 0) { mo.spin = 1.8; mo.t2 = 5.5 - (hpf < 0.5 ? 1.5 : 0); mo.ang = rnd() * 6.28; }
      } else if (mo.st === 1) {
        if (mo.t <= 0) { mo.st = 0; mo.t = 3.2; G.shake(12); G.sfx('boom'); G.burst(mo.x, mo.y, 50, ['#ff6a2e', '#ffb02e', '#555'], { sp: 200, g: 0, life: 0.7 }); if (dist < 100) G.hurt(mo.def.dmg * 1.3, mo.x, mo.y); }
      }
      if (mo.spin > 0) { mo.spin -= dt; mo.sc = (mo.sc || 0) - dt; if (mo.sc <= 0) { mo.sc = 0.1; mo.ang += 0.6; shoot(mo, mo.ang, 105, 'fire', mo.def.dmg * 0.7); shoot(mo, mo.ang + 3.14, 105, 'fire', mo.def.dmg * 0.7); } }
    }
    void px; void py;
  }
  G.damageMonster = (mo, dmg, kx, ky, silent) => {
    const d = mo.def; if (mo.hidden) mo.hidden = false;
    if (d.armor) dmg *= 1 - d.armor;
    dmg = Math.max(1, Math.round(dmg)); mo.hp -= dmg; mo.flash = 0.14;
    if (mo.boss) { mo.kx += kx * 0.08; mo.ky += ky * 0.08; } else { mo.kx += kx; mo.ky += ky; }
    G.float(mo.x, mo.y - mo.r - 6, String(dmg), '#fff'); if (!silent) G.sfx('hit'); G.shake(mo.boss ? 2 : 1.2);
    G.burst(mo.x, mo.y, 6, d.col, { sp: 80 });
    if (mo.hp <= 0) killMonster(mo);
  };
  function killMonster(mo) {
    const S = G.S, k = G.monsters.indexOf(mo); if (k >= 0) G.monsters.splice(k, 1);
    G.burst(mo.x, mo.y, mo.boss ? 80 : 16, [mo.def.col, '#fff'], { sp: mo.boss ? 200 : 100, life: 0.8 });
    G.sfx('break'); S.stats.kills++; G.gainXP('combat', mo.def.xp);
    if (mo.boss) {
      G.shake(14); G.sfx('fanfare'); S.stats.bossKills++; S.mine.bosses[mo.bossFloor] = 1;
      const b = D.BOSSES[mo.bossFloor]; G.addItem(b.drop, 1); const gold = 150 * (mo.bossFloor / 5) * 2; G.addGold(gold);
      S.maxHp += 10; S.hp = Math.min(S.maxHp, S.hp + 40);
      G.toast(b.n + ' defeated! +' + gold + 'g, +10 max HP', '🏆'); G.float(mo.x, mo.y - 30, D.ITEMS[b.drop].icon + ' ' + D.ITEMS[b.drop].name, '#ffe14d');
      G.monsters.forEach(x => x.hp = 0); G.monsters = [];
      if (mo.bossFloor < 15) M.addObj(G.map, { t: 'down', x: Math.floor(mo.x / T), y: Math.floor(mo.y / T) });
      G.updateMusic(true); return;
    }
    mo.def.drops.forEach(([id, ch]) => { if (rnd() < ch * (S.mods.surge ? 1.3 : 1)) { const n = G.addItem(id, 1); if (n) G.float(mo.x + (rnd() - 0.5) * 16, mo.y - 10, '+1 ' + D.ITEMS[id].icon, '#fff'); } });
    if (rnd() < 0.07) { G.addGold(10 + Math.floor(rnd() * 15)); G.float(mo.x, mo.y - 20, '+gold', '#ffe14d'); }
    if (rnd() < 0.08) { S.hp = Math.min(S.maxHp, S.hp + 8); G.float(mo.x, mo.y - 24, '+8 ❤', '#ff6b6b'); }
  }
  G.swordAttack = () => {
    const S = G.S, p = G.p, tier = S.tools.sword; p.slash = 0.22;
    const base = 9 + tier * 5 + G.skill('combat') * 1.2 + G.buffVal('combat') * 2;
    G.sfx('swing');
    G.monsters.slice().forEach(mo => {
      if (mo.hidden && Math.hypot(mo.x - p.x, mo.y - p.y + 10) > 50) return;
      const dx = mo.x - p.x, dy = mo.y - (p.y - 10), dist = Math.hypot(dx, dy) || 1;
      if (dist < 50 + mo.r) { const dot = (dx * p.fx + dy * p.fy) / dist; if (dot > 0.15 || dist < mo.r + 18) { const crit = rnd() < 0.1; if (crit) { G.float(mo.x, mo.y - 24, 'CRIT!', '#ffd23f'); G.shake(3); } G.damageMonster(mo, base * (0.9 + rnd() * 0.3) * (crit ? 1.8 : 1), dx / dist * 230, dy / dist * 230); } }
    });
    const t = G.ptile(), rx = -p.fy, ry = p.fx;
    for (let k = 1; k <= 2; k++) for (let w = -1; w <= 1; w++) {
      const o = M.objAt(G.map, t.x + p.fx * k + rx * w, t.y + p.fy * k + ry * w); if (o && o.t === 'weed') G.clearDebris(G.map, o);
    }
  };
  G.hurt = (dmg, fx, fy) => {
    const S = G.S, p = G.p; if (p.inv > 0 || G.fade.busy) return;
    const df = D.DIFFS[S.diff], d = Math.max(1, Math.round(dmg * df.dmg * (1 - Math.min(0.4, G.skill('combat') * 0.03))));
    S.hp -= d; if (S.hp < 0) S.hp = 0; p.inv = 0.9; const a = Math.atan2(p.y - 10 - fy, p.x - fx); p.kx = Math.cos(a) * 280; p.ky = Math.sin(a) * 280;
    G.sfx('hurt'); G.shake(7); G.float(p.x, p.y - 30, '-' + d, '#ff5a5a'); G.burst(p.x, p.y - 12, 10, '#ff5a5a'); G.hitFlash = 0.35;
  };

  // =================== NPCs ===================
  const FEST_SPOTS = { edda: 'fountain', mabel: 'plaza', brom: 'plaza2', hazel: 'bench', otto: 'saloon_front', lily: 'plaza', rook: 'plaza2' };
  G.festWindow = () => { const S = G.S; return S.festIdx >= 0 && S.time >= 540 && S.time < 840; };
  function sched(id) {
    const n = D.NPCS[id], S = G.S, t = S.time;
    if (id !== 'salty' && G.festWindow()) return { name: FEST_SPOTS[id] || 'plaza', hide: false };
    let list = n.sched; if (id !== 'salty' && (S.weather === 'rain' || S.weather === 'storm')) list = [[1000, 'saloon_front'], [1300, 'home']];
    let cur = 'home'; for (const [mt, sp] of list) if (t >= mt) cur = sp;
    if (t < list[0][0]) cur = 'home';
    if (cur === 'home') return { name: n.home, hide: true };
    return { name: cur, hide: false };
  }
  G.spawnNPCs = () => {
    G.npcs = []; if (!G.S) return; const mn = G.mapName;
    Object.keys(D.NPCS).forEach((id, i) => {
      const s = sched(id), sp = M.SPOTS[s.name]; if (!sp || sp.map !== mn) return;
      G.npcs.push({ id, x: (sp.x + 0.5) * T + ((i % 3) - 1) * 9, y: (sp.y + 1) * T - 4 - (i % 2) * 6, path: [], spot: s.name + (s.hide ? '!' : ''), hide: s.hide, face: 'down', anim: 0, ox: ((i % 3) - 1) * 9, oy: -(i % 2) * 6 });
    });
  };
  G.npcTick = () => {
    if (!G.S || !G.npcs.length) return;
    G.npcs.forEach(n => {
      const s = sched(n.id), key = s.name + (s.hide ? '!' : ''); if (key === n.spot) return;
      const sp = M.SPOTS[s.name], np = D.NPCS[n.id];
      if (n.hide) { const hs = M.SPOTS[np.home]; n.x = (hs.x + 0.5) * T + n.ox; n.y = (hs.y + 1) * T - 4 + n.oy; n.path = []; n.hide = false; }
      n.spot = key; n.goHide = s.hide;
      const sx = Math.floor(n.x / T), sy = Math.floor((n.y - 4) / T);
      const path = M.bfsPath(G.map, sx, sy, sp.x, sp.y, 3000);
      if (path) n.path = path; else { n.x = (sp.x + 0.5) * T + n.ox; n.y = (sp.y + 1) * T - 4 + n.oy; n.path = []; if (s.hide) n.hide = true; }
    });
  };
  G.updateNPCs = (dt) => {
    G.npcs.forEach(n => {
      if (n.hide) return;
      if (n.path.length) {
        const w = n.path[0], tx = (w.x + 0.5) * T + n.ox, ty = (w.y + 1) * T - 4 + n.oy, dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy);
        const st = 52 * dt;
        if (d <= st) { n.x = tx; n.y = ty; n.path.shift(); if (!n.path.length && n.goHide) n.hide = true; }
        else { n.x += dx / d * st; n.y += dy / d * st; n.anim += dt * 8; n.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
      } else { n.anim = 0; const p = G.p, dx = p.x - n.x, dy = p.y - n.y; if (Math.hypot(dx, dy) < 70) n.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
    });
  };
  G.nearNPC = () => {
    const p = G.p; let best = null, bd = 44;
    G.npcs.forEach(n => { if (n.hide) return; const d = Math.hypot(n.x - p.x - p.fx * 8, n.y - p.y - p.fy * 8); if (d < bd) { bd = d; best = n; } });
    return best;
  };
  G.isBirthday = (id) => { const n = D.NPCS[id]; return n.bday[0] === G.seasonOf() && n.bday[1] === G.domOf(); };
  G.npcLine = (id) => {
    const S = G.S, n = D.NPCS[id], h = G.hearts(id);
    if (G.isBirthday(id)) return n.bdayLine;
    if ((S.weather === 'rain' || S.weather === 'storm') && rnd() < 0.4) return n.rain;
    const tier = h < 3 ? 0 : h < 7 ? 1 : 2; const l = n.talk[tier]; let s = pick(l); if (s === S.lastLine) s = pick(l); S.lastLine = s; return s;
  };
  G.npcCheck = (id) => {
    const S = G.S, n = D.NPCS[id], f = S.friends[id], h = G.hearts(id), msgs = [];
    if (n.reward && !f.rew && h >= n.reward.h) {
      f.rew = 1; const r = n.reward;
      if (r.item) G.addItem(r.item, r.n); if (r.recipe) S.recipes[r.recipe] = 1; if (r.gold) G.addGold(r.gold);
      msgs.push(n.n + ' gave you ' + r.msg + '!'); G.sfx('fanfare');
    }
    D.RECIPES.forEach(r => { if (r.src && r.src.npc === id && h >= r.src.h && !S.recipes[r.id]) { S.recipes[r.id] = 1; msgs.push(n.n + ' taught you to cook ' + r.n + '!'); G.sfx('levelup'); } });
    return msgs;
  };
  const addFriend = (id, pts) => {
    const S = G.S, f = S.friends[id], before = G.hearts(id); f.p = Math.max(0, Math.min(1000, f.p + pts)); const after = G.hearts(id);
    if (after > before) { G.sfx('heart'); G.toast('❤️ ' + D.NPCS[id].n + ': ' + after + ' hearts!', '❤️'); G.burst(G.p.x, G.p.y - 24, 14, ['#ff6b8a', '#ff9ab0'], { up: 1 }); }
  };
  G.npcTalk = (id) => {
    const S = G.S, f = S.friends[id]; let gained = 0;
    if (f.talk !== S.day) { f.talk = S.day; gained = 10 + (G.isBirthday(id) ? 0 : 0); addFriend(id, gained); }
    return { text: G.npcLine(id), gained, msgs: G.npcCheck(id) };
  };
  G.giftReaction = (id, itemId) => {
    const n = D.NPCS[id], it = D.ITEMS[itemId]; if (!it) return 'neutral';
    if (n.loves.includes(itemId)) return 'love'; if (n.hates.includes(itemId) || itemId === 'junk') return 'hate'; if (n.likes.includes(itemId)) return 'like';
    const c = it.cat;
    if (id === 'salty' && c === 'fish') return 'like'; if (id === 'lily' && c === 'forage') return 'like'; if (id === 'rook' && (c === 'gem' || c === 'ore')) return 'like';
    if (id === 'brom' && c === 'bar') return 'like'; if (id === 'hazel' && c === 'animal') return 'like'; if (id === 'mabel' && c === 'crop') return 'like'; if (c === 'trophy') return 'like';
    return 'neutral';
  };
  G.npcGift = (id, idx) => {
    const S = G.S, f = S.friends[id], s = S.inv[idx];
    if (f.gift === S.day) return { err: "You've already given " + D.NPCS[id].n + ' a gift today.' };
    if (!s || !s.id) return { err: 'Choose an item from your pack.' };
    const r = G.giftReaction(id, s.id); let pts = { love: 60, like: 30, neutral: 12, hate: -30 }[r]; if (G.isBirthday(id) && pts > 0) pts *= 6; if (s.q && pts > 0) pts = Math.round(pts * (1 + s.q * 0.15));
    f.gift = S.day; S.stats.gifts++; G.removeItem(s.id, 1); G.sfx('gift'); addFriend(id, pts);
    return { r, text: D.NPCS[id].gift[r], pts, msgs: G.npcCheck(id) };
  };

  // =================== ANIMALS ===================
  const ANIMALS = { chicken: { n: 'Hen', i: '🐔', price: 400, prod: 'egg', big: 'large_egg', cap: 4, snd: 'cluck' }, cow: { n: 'Cow', i: '🐄', price: 1000, prod: 'milk', big: 'large_milk', cap: 4, snd: 'moo' } };
  G.ANIMALS = ANIMALS;
  const NAMES = ['Clucky', 'Maple', 'Daisy', 'Bessie', 'Pecan', 'Nugget', 'Biscuit', 'Clover', 'Buttercup', 'Henrietta', 'Moo', 'Pebbles', 'Sunny', 'Truffle', 'Waffles', 'Poppy'];
  G.animalsOf = (kind) => G.S.animals.filter(a => (kind === 'coop' ? 'chicken' : kind === 'barn' ? 'cow' : kind) === a.kind);
  G.animalBuy = (kind) => {
    const S = G.S, a = ANIMALS[kind], price = G.buyPrice(a.price);
    if (G.animalsOf(kind).length >= a.cap) { G.toast('Your ' + (kind === 'chicken' ? 'coop' : 'barn') + ' is full.', '🚫'); return false; }
    if (S.gold < price) { G.toast('Not enough gold.', '💰'); G.sfx('error'); return false; }
    S.gold -= price; const used = S.animals.map(x => x.name), nm = NAMES.filter(x => !used.includes(x)); S.animals.push({ id: Date.now() + Math.floor(rnd() * 1000), kind, name: pick(nm.length ? nm : NAMES), fr: 0, fed: 0, pet: 0, prod: null, pn: 0 });
    G.sfx(a.snd); G.sfx('coin'); G.toast('Welcome, ' + S.animals[S.animals.length - 1].name + '!', a.i); return true;
  };
  G.animalFeed = (kind) => {
    const list = G.animalsOf(kind).filter(a => !a.fed); if (!list.length) { G.toast('Everyone is already fed.', '🌾'); return; }
    const hay = G.itemCount('hay'); if (!hay) { G.toast('You have no hay! Buy some at the Ranch or cut tall weeds.', '🌾'); G.sfx('error'); return; }
    const n = Math.min(hay, list.length); G.removeItem('hay', n); for (let i = 0; i < n; i++) list[i].fed = 1; G.sfx('pickup'); G.toast('Fed ' + n + ' animal' + (n > 1 ? 's' : '') + '.', '🌾');
  };
  G.animalPet = (a) => { if (a.pet) { G.toast(a.name + ' has been petted today.', '💕'); return; } a.pet = 1; a.fr = Math.min(1000, a.fr + 15); G.sfx(ANIMALS[a.kind].snd); G.toast(a.name + ' loves it! 💕', ANIMALS[a.kind].i); };
  G.animalCollect = (kind) => {
    let got = 0; G.animalsOf(kind).forEach(a => { if (a.prod && a.pn > 0) { const n = G.addItem(a.prod, a.pn, a.pq || 0); got += n; a.pn -= n; if (a.pn <= 0) a.prod = null; } });
    if (got) { G.sfx('pickup'); G.toast('Collected ' + got + ' item' + (got > 1 ? 's' : '') + '.', '🧺'); } else G.toast('Nothing to collect yet.', '🧺');
  };
  G.nightAnimals = (rep) => {
    const S = G.S; let hungry = 0, made = 0;
    S.animals.forEach(a => {
      const d = ANIMALS[a.kind];
      if (a.fed) {
        const big = a.fr >= 120 && rnd() < a.fr / 500 + (G.perk('hazel') ? 0.2 : 0), id = big ? d.big : d.prod;
        if (a.prod && a.prod !== id) { /* keep older stack */ } else { a.prod = id; a.pn = Math.min(4, (a.pn || 0) + 1); a.pq = (G.perk('hazel') && rnd() < 0.3) ? 1 : 0; made++; }
        a.fr = Math.min(1000, a.fr + 4 + (a.pet ? 6 : 0));
      } else { hungry++; a.fr = Math.max(0, a.fr - 10); }
      a.fed = 0; a.pet = 0;
    });
    if (hungry) rep.lines.push('🐔 ' + hungry + ' animal' + (hungry > 1 ? 's' : '') + ' went hungry. Keep hay stocked!');
    if (made) rep.lines.push('🥚 Your animals produced ' + made + ' product' + (made > 1 ? 's' : '') + '.');
  };

  // =================== FESTIVALS ===================
  G.festCheck = () => { const S = G.S; S.festIdx = G.domOf() === D.FESTIVAL_DAY ? G.seasonOf() : -1; };
  G.festTick = () => {
    const S = G.S; if (S.festIdx < 0) return;
    if (S.time === 540) { G.toast('The ' + D.FESTIVALS[S.festIdx].n + ' begins in Town! Talk to Granny Edda.', D.FESTIVALS[S.festIdx].i); G.npcTick(); }
    if (S.time === 840) { if (!G.fest && !S.festDone[S.day]) G.toast('The festival has ended.', '🎪'); G.npcTick(); }
  };
  G.festStart = () => {
    const S = G.S, idx = S.festIdx;
    if (idx < 0 || !G.festWindow()) { G.toast('There is no festival right now.', '🎪'); return; }
    if (S.festDone[S.day]) { G.toast("You've already taken part today!", '🎪'); return; }
    G.ui.hideAll();
    if (idx === 0) {
      G.fest = { type: 'egg', t: 60, score: 0, max: 60 }; const m = G.map; let n = 30, tries = 0;
      while (n > 0 && tries++ < 500) { const x = 3 + Math.floor(rnd() * 42), y = 9 + Math.floor(rnd() * 11); if (!M.tileFree(m, x, y) || m.g[y * m.w + x] === M.WA || M.objAt(m, x, y)) continue; M.addObj(m, { t: 'egg', x, y, c: Math.floor(rnd() * 5) }); n--; }
      G.toast('Egg Hunt! Collect eggs for 60 seconds!', '🥚'); G.sfx('fanfare'); G.updateMusic(true);
    } else if (idx === 1) {
      G.fest = { type: 'derby', t: 90, score: 0, max: 90 }; G.goto('beach', 17, 10); G.toast('Fishing Derby! Fish for 90 seconds!', '🎣'); G.updateMusic(true);
    } else if (idx === 2) G.ui.show('fair');
    else G.ui.show('star');
  };
  G.updateFest = (dt) => { const f = G.fest; if (!f) return; if (f.t > 0) f.t -= dt; if (f.t <= 0 && (f.type === 'egg' || f.type === 'derby')) endFest(); };
  function endFest() {
    const S = G.S, f = G.fest; G.fest = null; S.festDone[S.day] = 1; let title = '', lines = [], gold = 0;
    if (f.type === 'egg') {
      const town = G.getMap('town'); town.objs.filter(o => o.t === 'egg').forEach(o => M.removeObj(town, o));
      gold = f.score >= 20 ? 700 : f.score >= 12 ? 350 : 120; title = f.score >= 20 ? '🥇 Egg Hunt Champion!' : f.score >= 12 ? '🥈 Great Hunter!' : '🥉 Nice Try!';
      lines.push('You collected ' + f.score + ' eggs.');
      if (f.score >= 20) { G.addItem('hay', 5); lines.push('Prize: 5 Hay + gold'); }
    } else {
      gold = f.score >= 350 ? 900 : f.score >= 150 ? 450 : 150; title = f.score >= 350 ? '🥇 Derby Champion!' : f.score >= 150 ? '🥈 Skilled Angler!' : '🥉 Nice Catch!';
      lines.push('Your catch was worth ' + f.score + 'g.'); G.goto('town', 22, 10);
    }
    G.addGold(gold); lines.push('Reward: ' + gold + 'g'); Object.keys(D.NPCS).forEach(id => addFriend(id, 15)); lines.push('Everyone enjoyed your company (+friendship).');
    G.sfx('fanfare'); G.updateMusic(true); G.ui.show('festResult', { title, lines });
  }
  G.fairScore = (idxs) => {
    const S = G.S; let pts = 0; const cats = new Set();
    idxs.forEach(i => { const s = S.inv[i]; if (!s || !s.id) return; const it = D.ITEMS[s.id]; pts += Math.min(24, Math.round(it.price / 12)) + (s.q || 0) * 4; cats.add(it.cat); });
    return pts + cats.size * 8;
  };
  G.fairSubmit = (idxs) => {
    const S = G.S; const pts = G.fairScore(idxs); S.festDone[S.day] = 1;
    const gold = pts >= 100 ? 1200 : pts >= 65 ? 600 : 250; const title = pts >= 100 ? '🥇 Blue Ribbon!' : pts >= 65 ? '🥈 Red Ribbon!' : '🥉 Participation Ribbon';
    G.addGold(gold); Object.keys(D.NPCS).forEach(id => addFriend(id, 15)); G.sfx('fanfare');
    G.ui.show('festResult', { title, lines: ['Display score: ' + pts, 'Reward: ' + gold + 'g', 'Everyone admired your goods (+friendship).'] });
  };
  G.starTarget = () => Object.keys(D.NPCS)[(G.S.seed + G.S.day) % 8];
  G.starGift = (idx) => {
    const S = G.S, s = S.inv[idx]; if (!s || !s.id) { G.toast('Choose an item to gift.', '🎁'); return; }
    const id = G.starTarget(), r = G.giftReaction(id, s.id), pts = { love: 220, like: 140, neutral: 70, hate: 0 }[r];
    G.removeItem(s.id, 1); S.festDone[S.day] = 1; addFriend(id, pts); G.sfx('gift');
    const ret = pick([['gold_bar', 1], ['amethyst', 2], ['coffee', 3], ['large_milk', 2], ['sashimi', 2]]); G.addItem(ret[0], ret[1]); const gold = 150; G.addGold(gold);
    S.energy = S.maxEnergy; S.hp = S.maxHp; Object.keys(D.NPCS).forEach(i2 => addFriend(i2, 10));
    G.ui.show('festResult', { title: '⭐ A Wonderful Feast!', lines: [D.NPCS[id].n + ': "' + D.NPCS[id].gift[r] + '"', 'You received ' + ret[1] + 'x ' + D.ITEMS[ret[0]].name + ' and ' + gold + 'g.', 'You feast and feel fully restored.'] });
  };

  // =================== SHOPS ===================
  G.shopItems = (shop) => {
    const S = G.S, season = G.seasonOf(), list = [], bp = (x) => G.buyPrice(Math.round(x));
    const itm = (id, price, note) => { const it = D.ITEMS[id]; list.push({ kind: 'item', id, name: it.name, icon: it.icon, price, desc: note || it.desc || '', qty: 1 }); };
    if (shop === 'general') {
      Object.values(D.CROPS).forEach(c => {
        const inS = c.s.includes(season); if (!inS && !S.flags.greenhouse) return;
        let price = c.sp * (inS ? 1 : 1.25); if (G.perk('mabel')) price *= 0.85;
        itm(c.id + '_seed', bp(price), c.d + ' days to grow' + (c.rg ? ', regrows every ' + c.rg + 'd' : '') + (inS ? '' : ' · Greenhouse only'));
      });
      itm('fertilizer', bp(40), 'Boosts crop quality.'); itm('wood', bp(25), 'Handy for crafting.');
      if (S.invSize < 36) list.push({ kind: 'pack', name: 'Large Backpack', icon: '🎒', price: bp(1500), desc: '+12 pack slots', qty: 0 });
    } else if (shop === 'ranch') {
      list.push({ kind: 'animal', animal: 'chicken', name: 'Hen', icon: '🐔', price: bp(400), desc: 'Lays eggs daily when fed. (' + G.animalsOf('chicken').length + '/4)', qty: 0 });
      list.push({ kind: 'animal', animal: 'cow', name: 'Cow', icon: '🐄', price: bp(1000), desc: 'Gives milk daily when fed. (' + G.animalsOf('cow').length + '/4)', qty: 0 });
      itm('hay', bp(45), 'Feed for your animals.');
    } else if (shop === 'saloon') {
      itm('coffee', bp(100), 'Speed buff for 2 hours.');
      list.push({ kind: 'meal', name: 'Hearty Meal', icon: '🍽️', price: bp(130), desc: 'Eat now: +120 energy, +50 health.', qty: 0 });
      D.RECIPES.forEach(r => { if (r.src && r.src.shop && !S.recipes[r.id]) list.push({ kind: 'recipe', id: r.id, name: 'Recipe: ' + r.n, icon: r.i, price: bp(r.src.shop), desc: r.ing.map(x => x[1] + ' ' + (x[0].startsWith('any:') ? 'any ' + x[0].slice(4) : D.ITEMS[x[0]].name)).join(', '), qty: 0 }); });
    } else if (shop === 'smith') {
      ['hoe', 'can', 'pickaxe', 'axe', 'sword'].forEach(k => {
        const tier = S.tools[k]; if (tier >= 3) return; const c = D.UPGRADE_COST[tier], price = Math.round(G.buyPrice(c[0]) * (G.perk('brom') ? 0.75 : 1));
        list.push({ kind: 'upgrade', tool: k, tier: tier + 1, bar: c[1], bars: 5, name: D.TIER_NAME[tier + 1] + ' ' + D.TOOLS[k].n, icon: D.TOOLS[k].i, price, desc: '5 ' + D.ITEMS[c[1]].name + ' · ready in 2 days', qty: 0 });
      });
      itm('coal', bp(120), 'Fuel for furnaces.');
    } else if (shop === 'tackle') {
      const tier = S.tools.rod; if (tier < 3) list.push({ kind: 'rod', tier: tier + 1, name: ['', 'Fiberglass Rod', 'Carbon Rod', 'Master Rod'][tier + 1], icon: '🎣', price: bp(D.ROD_COST[tier]), desc: 'Wider catch bar (+5% per tier).', qty: 0 });
      itm('coffee', bp(100), 'Speed buff for 2 hours.');
    }
    return list;
  };
  G.shopBuy = (e, qty) => {
    const S = G.S; qty = qty || 1; const total = e.price * (e.qty ? qty : 1);
    if (S.gold < total) { G.toast('Not enough gold.', '💰'); G.sfx('error'); return false; }
    if (e.kind === 'item') { const n = G.addItem(e.id, qty); if (!n) return false; S.gold -= e.price * n; }
    else if (e.kind === 'pack') { S.invSize = 36; S.gold -= total; G.toast('Backpack expanded to 36 slots!', '🎒'); }
    else if (e.kind === 'animal') { return G.animalBuy(e.animal); }
    else if (e.kind === 'meal') { S.gold -= total; S.energy = Math.min(S.maxEnergy, S.energy + 120 * (G.perk('otto') ? 1.25 : 1)); S.hp = Math.min(S.maxHp, S.hp + 50); G.sfx('eat'); G.toast('Delicious!', '🍽️'); }
    else if (e.kind === 'recipe') { S.gold -= total; S.recipes[e.id] = 1; G.toast('Learned ' + e.name.replace('Recipe: ', '') + '!', '📖'); }
    else if (e.kind === 'upgrade') {
      if (S.upgrades.length) { G.toast('Brom is already working on something.', '🔨'); G.sfx('error'); return false; }
      if (G.itemCount(e.bar) < e.bars) { G.toast('You need ' + e.bars + ' ' + D.ITEMS[e.bar].name + '.', '🔨'); G.sfx('error'); return false; }
      G.removeItem(e.bar, e.bars); S.gold -= total; S.upgrades.push({ tool: e.tool, tier: e.tier, day: S.day + 2 }); G.toast('Brom will have it ready in 2 days.', '🔨');
    } else if (e.kind === 'rod') { S.gold -= total; S.tools.rod = e.tier; G.toast('Your fishing rod is upgraded!', '🎣'); }
    G.sfx('coin'); return true;
  };

  // =================== BIN / CRAFT / COOK / BUNDLES ===================
  G.binAdd = (idx, all) => {
    const S = G.S, s = S.inv[idx]; if (!s || !s.id) return; const it = D.ITEMS[s.id]; if (!it || it.cat === 'craft' && false) return;
    const n = all ? s.n : 1; const e = S.bin.find(b => b.id === s.id && (b.q || 0) === (s.q || 0));
    if (e) e.n += n; else S.bin.push({ id: s.id, n, q: s.q || 0 });
    s.n -= n; if (s.n <= 0) S.inv[idx] = null; G.sfx('coin');
  };
  G.binTake = (i) => { const S = G.S, b = S.bin[i]; if (!b) return; const n = G.addItem(b.id, b.n, b.q); b.n -= n; if (b.n <= 0) S.bin.splice(i, 1); };
  G.countCat = (cat) => { let n = 0; G.S.inv.forEach(s => { if (s && s.id && D.ITEMS[s.id].cat === cat) n += s.n; }); return n; };
  G.hasIng = (ing) => ing.every(([id, n]) => id.startsWith('any:') ? G.countCat(id.slice(4)) >= n : G.itemCount(id) >= n);
  G.useIng = (ing) => {
    ing.forEach(([id, n]) => {
      if (!id.startsWith('any:')) { G.removeItem(id, n); return; }
      const cat = id.slice(4);
      while (n > 0) {
        let bi = -1; G.S.inv.forEach((s, i) => { if (s && s.id && D.ITEMS[s.id].cat === cat && (bi < 0 || D.ITEMS[s.id].price < D.ITEMS[G.S.inv[bi].id].price)) bi = i; });
        if (bi < 0) break; G.S.inv[bi].n--; if (G.S.inv[bi].n <= 0) G.S.inv[bi] = null; n--;
      }
    });
  };
  G.craftOk = (c) => G.skill(c.sk[0]) >= c.sk[1];
  G.craft = (c) => {
    if (!G.craftOk(c)) { G.toast('Requires ' + c.sk[0] + ' level ' + c.sk[1] + '.', '🔒'); G.sfx('error'); return; }
    if (!G.hasIng(c.ing)) { G.toast('Missing ingredients.', '🚫'); G.sfx('error'); return; }
    const n = G.addItem(c.id, c.out || 1); if (!n) return;
    G.useIng(c.ing); G.sfx('craft'); G.toast('Crafted ' + (c.out || 1) + 'x ' + c.n, c.i); G.gainXP('foraging', 2);
  };
  G.cook = (r) => {
    const S = G.S; if (!S.recipes[r.id]) return;
    if (!G.hasIng(r.ing)) { G.toast('Missing ingredients.', '🚫'); G.sfx('error'); return; }
    const n = G.addItem(r.id, 1); if (!n) return; G.useIng(r.ing); S.stats.cooked++; G.sfx('craft'); G.toast('Cooked ' + r.n + '!', r.i); G.burst(G.p.x, G.p.y - 16, 10, ['#ffd23f', '#fff'], { up: 1 });
  };
  G.bundleDeposit = (bid, idx) => {
    const S = G.S, b = D.BUNDLES.find(x => x.id === bid); if (!b || S.bundles[bid][idx]) return false;
    if (!G.removeItem(b.items[idx], 1)) { G.toast("You don't have a " + D.ITEMS[b.items[idx]].name + '.', '🚫'); G.sfx('error'); return false; }
    S.bundles[bid][idx] = 1; G.sfx('coin'); G.ev('bundle'); G.burst(G.p.x, G.p.y - 20, 12, ['#ffd23f', '#fff'], { up: 1 });
    if (S.bundles[bid].every(x => x)) completeBundle(b); return true;
  };
  function completeBundle(b) {
    const S = G.S, r = b.reward; G.sfx('fanfare'); G.shake(4);
    if (r.gold) G.addGold(r.gold); if (r.items) r.items.forEach(([id, n]) => G.addItem(id, n)); if (r.unlock === 'greenhouse') { S.flags.greenhouse = 1; }
    if (r.rod) S.tools.rod = Math.max(S.tools.rod, r.rod); if (r.hp) { S.maxHp += r.hp; S.hp = S.maxHp; }
    G.toast(b.n + ' complete! ' + r.txt, b.i);
    Object.keys(D.NPCS).forEach(id => addFriend(id, 10));
    if (G.allBundlesDone()) setTimeout(() => { if (G.S && !G.S.won && G.mode === 'play') G.win(); }, 1200);
  }
}
