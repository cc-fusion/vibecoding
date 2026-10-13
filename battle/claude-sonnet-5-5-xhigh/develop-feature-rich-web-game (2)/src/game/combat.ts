import { T, TILES, ITEMS, ENEMIES, B, WL, ItemDef } from './data';
import { HELL_TOP, WW, WH } from './world';
import { audio } from './audio';
import type { Game } from './game';
import { moveBody, collides, daylight, isNight } from './game';
import type { Enemy, Npc, Proj, Part } from './types';

const rnd = Math.random;
const approach = (v: number, t: number, d: number) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));
const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const getRects = (e: Enemy): Part[] => (e.boss ? e.rects : [{ id: 'main', x: e.x, y: e.y, w: e.w, h: e.h }]);
const hmBoost = (g: Game, e: Enemy) => (g.world.hardmode && !e.def.hm && !e.boss ? 1.4 : 1);

// ---------- creation ----------
export function makeEnemy(g: Game, id: string, x: number, y: number): Enemy {
  const def = ENEMIES[id]; const hp = Math.round(def.hp * g.diff.hp * (g.world.hardmode && !def.hm && !def.boss ? 1.4 : 1));
  return { x, y, w: def.w, h: def.h, vx: 0, vy: 0, onGround: false, dir: 1, uid: g.uid++, def, hp, maxHp: hp, flash: 0, t: rnd() * 10, a: {}, hitCd: 0, alpha: 1, dead: false, rects: [], boss: !!def.boss, kbT: 0, walk: 0 };
}
export function spawnEnemy(g: Game, id: string, x: number, y: number, ev?: string): Enemy { const e = makeEnemy(g, id, x, y); e.ev = ev; g.enemies.push(e); return e; }
export function spawnProj(g: Game, o: Partial<Proj> & { x: number; y: number; vx: number; vy: number; kind: string; dmg: number; friendly: boolean }): Proj {
  const p: Proj = { w: 8, h: 8, life: 3, grav: 0, pierce: 0, kb: 2, hit: null, rot: 0, col: '#fff', t: 0, ...o } as Proj;
  if (p.pierce > 0 || p.friendly) p.hit = new Set(); g.projs.push(p); return p;
}

// ---------- spawning ----------
interface Ctx { b: number; layer: number; night: boolean; hm: boolean; blood: boolean }
const SP: [string, number, (c: Ctx) => boolean][] = [
  ['slime', 10, c => c.layer === 1 && !c.night && c.b === B.FOREST], ['slime', 4, c => c.layer === 1 && c.night && c.b === B.FOREST],
  ['blue_slime', 8, c => c.layer === 2 || (c.layer === 3 && c.b === B.FOREST) || (c.layer === 3 && c.b === B.DESERT)], ['blue_slime', 5, c => c.layer === 1 && c.night && c.b === B.FOREST],
  ['zombie', 12, c => c.layer === 1 && c.night && (c.b === B.FOREST || c.b === B.BLIGHT || c.b === B.JUNGLE)],
  ['demon_eye', 8, c => c.layer <= 1 && c.night && c.b !== B.DESERT],
  ['ice_slime', 10, c => c.b === B.TUNDRA && c.layer >= 1 && c.layer <= 2], ['frozen_zombie', 10, c => c.b === B.TUNDRA && c.layer === 1 && c.night],
  ['ice_bat', 8, c => c.b === B.TUNDRA && c.layer >= 2 && c.layer < 4],
  ['sand_scarab', 10, c => c.b === B.DESERT && c.layer >= 1 && c.layer <= 3], ['vulture', 8, c => c.b === B.DESERT && c.layer <= 1 && !c.night],
  ['jungle_slime', 10, c => c.b === B.JUNGLE && c.layer >= 1 && c.layer <= 3], ['hornet', 8, c => c.b === B.JUNGLE && c.layer >= 1 && c.layer < 4],
  ['eater_souls', 12, c => c.b === B.BLIGHT && c.layer >= 1 && c.layer < 4], ['corrupt_slime', 8, c => c.b === B.BLIGHT && c.layer >= 1 && c.layer < 4],
  ['skeleton', 10, c => c.layer === 3], ['skel_archer', 5, c => c.layer === 3], ['cave_bat', 10, c => c.layer >= 2 && c.layer < 4],
  ['fire_imp', 10, c => c.layer === 4], ['hell_bat', 8, c => c.layer === 4], ['lava_slime', 8, c => c.layer === 4], ['demon', 4, c => c.layer === 4],
  ['wraith', 8, c => c.hm && ((c.layer <= 1 && c.night) || (c.layer >= 2 && c.layer < 4))], ['armored_skeleton', 8, c => c.hm && c.layer === 3],
  ['cursed_skull', 6, c => c.hm && c.layer >= 2 && c.layer < 4],
];
const FLYERS = new Set(['fly', 'bat', 'flyshoot', 'ghost', 'imp']);
function playerWall(w: number) { return w === WL.WOOD || w === WL.PSTONE || w === WL.PBRICK; }
function freeSpot(g: Game, tx: number, ty: number, wt: number, ht: number): boolean {
  for (let y = ty; y < ty + ht; y++) for (let x = tx; x < tx + wt; x++) { const d = TILES[g.world.get(x, y)]; if (d.solid || d.liquid || d.door) return false; if (playerWall(g.world.wall(x, y))) return false; }
  return true;
}
function findSpot(g: Game, def: typeof ENEMIES[string], ground: boolean, xr?: number): { x: number; y: number } | null {
  const p = g.player, w = g.world; const halfW = g.vw / 2 + 50, halfH = g.vh / 2 + 40; const wt = Math.ceil(def.w / 16), ht = Math.ceil(def.h / 16);
  for (let tries = 0; tries < 16; tries++) {
    const side = rnd() < 0.5 ? -1 : 1; const x = xr ?? (p.x + side * (halfW + rnd() * 200)); const tx = Math.floor(x / 16);
    if (tx < 3 || tx > WW - 4) continue;
    if (ground) {
      const y0 = Math.floor(p.y / 16) - 16 + Math.floor(rnd() * 8);
      for (let ty = y0; ty < y0 + 36; ty++) {
        if (w.solid(tx, ty + ht) && freeSpot(g, tx, ty, wt, ht)) { const px = tx * 16, py = (ty + ht) * 16 - def.h - 0.01; if (Math.abs(px - p.x) < halfW && Math.abs(py - p.y) < halfH) break; return { x: px, y: py }; }
      }
    } else {
      const ty = Math.floor(p.y / 16 + (rnd() * 2 - 1) * 20); if (ty < 4 || ty > WH - 6) continue;
      const px = tx * 16, py = ty * 16; if (freeSpot(g, tx, ty, wt, ht) && (Math.abs(px - p.x) > halfW || Math.abs(py - p.y) > halfH)) return { x: px, y: py };
    }
  }
  return null;
}
export function spawnTick(g: Game, dt: number) {
  const p = g.player; if (p.dead) return; const a = g as any;
  a._spawnT = (a._spawnT ?? 2) - dt; if (a._spawnT > 0) return;
  const night = isNight(g.time); const w = g.world;
  let npcNear = 0; for (const n of g.npcs) if (n.home >= 0 && n.deadT <= 0 && Math.hypot(n.x - p.x, n.y - p.y) < 800) npcNear++;
  const inHouse = g.rooms.some(r => Math.abs(r.cx * 16 - p.x) < 200 && Math.abs(r.cy * 16 - p.y) < 120);
  a.townFactor = 1 / (1 + npcNear * 0.45 + (inHouse ? 1 : 0));
  a._spawnT = (1.5 - (night ? 0.4 : 0) - (g.ev.blood ? 0.5 : 0)) / (g.diff.spawn * (g.mods.includes('bloodthirst') ? 1.1 : 1) * a.townFactor);
  let count = 0; for (const e of g.enemies) if (!e.dead && !e.boss && !e.ev) count++;
  let cap = 5 + (w.hardmode ? 2 : 0) + (g.ev.blood ? 4 : 0) + (night ? 1 : 0); cap = Math.round(cap * g.diff.spawn * Math.max(0.35, a.townFactor + 0.2)); if (g.boss) cap = Math.min(cap, 2);
  if (count >= cap) return;
  const px = p.x / 16, py = p.y / 16; const c: Ctx = { b: w.biomeAt(px, py), layer: w.layer(px, py), night: night || g.ev.blood, hm: w.hardmode, blood: g.ev.blood };
  const pool = SP.filter(s => s[2](c)); if (!pool.length) return;
  let tot = 0; for (const s of pool) tot += s[1] * (g.ev.blood && (s[0] === 'zombie' || s[0] === 'demon_eye') ? 2.5 : 1);
  let r = rnd() * tot, id = pool[0][0];
  for (const s of pool) { r -= s[1] * (g.ev.blood && (s[0] === 'zombie' || s[0] === 'demon_eye') ? 2.5 : 1); if (r <= 0) { id = s[0]; break; } }
  const def = ENEMIES[id]; const ground = !FLYERS.has(def.ai); const spot = findSpot(g, def, ground); if (!spot) return;
  const e = spawnEnemy(g, id, spot.x, spot.y);
  if (def.ai === 'ghost') e.alpha = 0.7;
}

// ---------- damage ----------
export function hurtPlayer(g: Game, raw: number, srcX: number, kind: string) {
  const p = g.player; if (p.dead) return; if (kind === 'hit' && p.invT > 0) return;
  let d = raw * g.diff.dmg * (g.mods.includes('glass') ? 1.25 : 1); d = Math.max(1, Math.round(d - p.st.def * 0.5 * (kind === 'fall' || kind === 'lava' ? 0.3 : 1)));
  p.hp -= d; p.invT = kind === 'hit' ? 0.9 : 0.35; g.stats.dmgTaken += d; p.recall = 0; p.sleeping = false;
  g.ftext(p.x + 6, p.y - 4, `${d}`, '#ff4040', 11); audio.sfx('hurt'); g.shake(Math.min(9, 2 + d / 12)); (g as any).hurtFlash = 0.35;
  g.burst(p.x + 6, p.y + 14, 8, '#c02020', 90, 300, 0.6, 2);
  if (!p.st.kbImmune && kind === 'hit') { p.vx = (p.x + p.w / 2 < srcX ? -1 : 1) * 190; p.vy = Math.min(p.vy, -190); p.hook = null; }
  if (p.hp <= 0) {
    if (p.windLeft > 0) { p.windLeft--; p.hp = Math.round(p.maxHp * 0.5); p.invT = 2.5; g.say('Second Wind! You cheat death.', '#9affff', 6); audio.sfx('level'); g.burst(p.x + 6, p.y + 14, 40, '#9affff', 150, 0, 1, 3, true); g.shake(8); }
    else { p.hp = 0; g.killPlayer(kind === 'fall' ? 'a long fall' : kind === 'lava' ? 'molten lava' : 'monsters'); }
  }
}
export function damageEnemy(g: Game, e: Enemy, raw: number, kb: number, dirx: number, crit = false, part = 'main'): number {
  if (e.dead || e.a.fled) return 0; const def = e.def;
  let target: any = e;
  if (def.id === 'lunar' && e.a.hands) {
    if (part === 'handL' || part === 'handR') { const h = e.a.hands[part === 'handL' ? 'L' : 'R']; if (!h.alive) return 0; target = h; }
    else if (e.a.hands.L.alive || e.a.hands.R.alive) { g.ftext(e.x + e.w / 2, e.y, 'Shielded!', '#80e0ff', 9); audio.sfx('dig_metal'); return 0; }
  }
  let dmg = raw * (0.9 + rnd() * 0.2); if (crit) dmg *= 2; dmg = Math.max(1, Math.round(dmg - def.def * 0.5));
  target.hp -= dmg; e.flash = 0.1; g.stats.dmgDealt += dmg;
  g.ftext(e.x + e.w / 2 + (rnd() - 0.5) * 10, e.y - 2, `${dmg}`, crit ? '#ffb030' : '#ffffff', crit ? 12 : 9);
  audio.sfx(crit ? 'crit' : 'hit'); g.burst(e.x + e.w / 2, e.y + e.h / 2, crit ? 8 : 4, def.col, 70, 200, 0.4, 2);
  if (!e.boss) { const k = kb * (1 - def.kb); e.vx = dirx * k * 55; e.vy = -90 * Math.min(1, k); e.kbT = 0.22; }
  if (e.a.state === 'idle') e.a.state = 'wake';
  if (target !== e && target.hp <= 0) { target.alive = false; g.shake(8); audio.sfx('explosion'); g.burst(target.x, target.y, 30, '#80e0ff', 160, 100, 0.9, 3, true); g.say('The Colossus loses a hand!', '#80e0ff', 4); }
  if (e.hp <= 0) killEnemy(g, e);
  return dmg;
}
export function killEnemy(g: Game, e: Enemy) {
  if (e.dead) return; e.dead = true; const def = e.def, p = g.player;
  g.stats.kills++; g.meta.totalKills++; audio.sfx(e.boss ? 'explosion' : 'kill');
  g.burst(e.x + e.w / 2, e.y + e.h / 2, e.boss ? 60 : 14, def.col, e.boss ? 200 : 100, 200, e.boss ? 1.2 : 0.6, e.boss ? 3 : 2); g.shake(e.boss ? 10 : 1);
  const trader = 1 + 0.12 * (g.perks.trader || 0);
  if (def.coin[1] > 0) {
    const c = Math.round((def.coin[0] + rnd() * (def.coin[1] - def.coin[0])) * g.diff.loot * trader * (g.mods.includes('bloodthirst') ? 1.25 : 1) * (g.ev.blood ? 1.5 : 1) * (g.world.hardmode && !def.hm && !def.boss ? 1.5 : 1));
    p.coins += c; g.stats.coinsEarned += c; g.ftext(e.x + e.w / 2, e.y - 10, `+${c < 100 ? c + 'c' : c < 10000 ? (c / 100).toFixed(1) + 's' : (c / 10000).toFixed(1) + 'g'}`, '#ffd84a', 9); audio.sfx('coin');
  }
  const luck = g.diff.loot * (1 + 0.12 * (g.perks.fortune || 0));
  for (const [id, ch, mn, mx] of def.loot) if (rnd() < ch * luck) g.dropItem(e.x + e.w / 2, e.y + e.h / 2, id, mn + Math.floor(rnd() * (mx - mn + 1)));
  if (e.ev === 'goblin' && g.ev.goblin) { g.ev.goblin.kills += def.goblin || 1; if (g.ev.goblin.kills >= g.ev.goblin.total) endGoblin(g); }
  if (e.boss) bossDefeated(g, e);
}

// ---------- melee / ranged / magic ----------
export function startSwing(g: Game, d: ItemDef) {
  const p = g.player; const dur = Math.max(0.12, (d.use || 0.4) * p.st.melee);
  p.swing = { t: 0, dur, dir: p.dir, hits: new Set(), id: d.id }; p.useCd = dur; audio.sfx('swing');
  const sx = p.x + p.w / 2, sy = p.y + 10, m = g.mouse, ang = Math.atan2(m.wy - sy, m.wx - sx);
  if (d.proj === 'frost') spawnProj(g, { x: sx, y: sy, vx: Math.cos(ang) * (d.speed || 460), vy: Math.sin(ang) * (d.speed || 460), kind: 'frost', dmg: d.dmg! * 0.7 * p.st.dmg, friendly: true, life: 1.2, col: '#9fe0ff', pierce: 1, light: 0.6 });
  if (d.proj === 'starcall') for (let i = 0; i < 2; i++) { const tx = m.wx + (rnd() - 0.5) * 60, tyy = m.wy; const fx = tx + (rnd() - 0.5) * 200, fy = p.y - 260 - rnd() * 80; const dx = tx - fx, dy = tyy - fy, dd = Math.hypot(dx, dy); spawnProj(g, { x: fx, y: fy, vx: dx / dd * 520, vy: dy / dd * 520, kind: 'star', dmg: d.dmg! * 0.9 * p.st.dmg, friendly: true, life: 1.6, col: '#ffe060', light: 0.9, pierce: 1 }); }
}
export function swingHit(g: Game) {
  const p = g.player, s = p.swing!; const d = ITEMS[s.id]; if (!d) return;
  const f = s.t / s.dur; if (f < 0.12 || f > 0.9) return;
  const pcx = p.x + p.w / 2, pcy = p.y + 12, reach = (d.reach || 34), a = -100 + 160 * f;
  for (const e of g.enemies) {
    if (e.dead || e.a.fled) continue;
    for (const r of getRects(e)) {
      if (s.hits.has(e.uid * 10 + (r.id === 'main' ? 0 : r.id.length))) continue;
      const nx = Math.max(r.x, Math.min(pcx, r.x + r.w)), ny = Math.max(r.y, Math.min(pcy, r.y + r.h));
      const dx = (nx - pcx) * s.dir, dy = ny - pcy; if (Math.hypot(dx, dy) > reach + 4 || dx < -8) continue;
      const ang = Math.atan2(dy, Math.max(0.01, dx)) * 57.3; if (Math.abs(ang - a) > 62 && Math.hypot(dx, dy) > 14) continue;
      s.hits.add(e.uid * 10 + (r.id === 'main' ? 0 : r.id.length));
      const crit = rnd() * 100 < p.st.crit; damageEnemy(g, e, d.dmg! * p.st.dmg, d.kb || 4, s.dir, crit, r.id); g.shake(1.2);
      if (d.id === 'starfury' || d.id === 'ice_blade') g.burst(nx, ny, 4, d.col, 60, 0, 0.4, 2, true);
    }
  }
  for (const pr of g.projs) if (!pr.friendly && pr.kind !== 'beam' && Math.hypot(pr.x - pcx - s.dir * 16, pr.y - pcy) < reach * 0.8 && f > 0.2 && f < 0.7) { pr.life = 0; g.burst(pr.x, pr.y, 5, pr.col, 60, 0, 0.3, 2, true); }
}
export function shootRanged(g: Game, d: ItemDef) {
  const p = g.player, m = g.mouse; const sx = p.x + p.w / 2, sy = p.y + 10;
  let ai = -1; for (let i = 0; i < p.inv.length; i++) { const s = p.inv[i]; if (s && ITEMS[s.id].ammoType === d.ammo) { ai = i; break; } }
  if (ai < 0) { p.useCd = 0.4; if (m.edge) { g.say(`You need ${d.ammo === 'arrow' ? 'arrows' : 'bullets'}!`, '#ff9a80', 2); audio.sfx('error'); } return; }
  const am = ITEMS[p.inv[ai]!.id]; const free = d.id === 'megashark' && rnd() < 0.66;
  if (!free) { p.inv[ai]!.n--; if (p.inv[ai]!.n <= 0) p.inv[ai] = null; g.touchInv(); }
  const ang = Math.atan2(m.wy - sy, m.wx - sx); const n = d.pellets || 1; const fire = d.fx === 'fire' || am.fx === 'fire';
  p.useCd = d.use || 0.4; p.dir = Math.cos(ang) >= 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const a = ang + (n > 1 ? (rnd() - 0.5) * 0.35 : d.id === 'megashark' ? (rnd() - 0.5) * 0.12 : 0), sp = d.speed || 600;
    spawnProj(g, { x: sx + Math.cos(a) * 10, y: sy + Math.sin(a) * 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind: d.ammo === 'arrow' ? 'parrow' : 'bullet', dmg: ((d.dmg || 5) + (am.dmg || 0)) * p.st.dmg, friendly: true, life: 2, grav: d.ammo === 'arrow' ? 260 : 0, col: fire ? '#ff9a30' : d.ammo === 'arrow' ? '#d8b078' : '#ffe9a0', pierce: d.ammo === 'arrow' ? 1 : 0, fire, kb: 3, w: 6, h: 6, light: fire ? 0.7 : 0.3 });
  }
  audio.sfx(d.ammo === 'arrow' ? 'shoot' : 'gun'); g.burst(sx + Math.cos(ang) * 12, sy + Math.sin(ang) * 12, 3, '#ffe9a0', 60, 0, 0.2, 1, true);
}
export function castSpell(g: Game, d: ItemDef) {
  const p = g.player, m = g.mouse; if (p.mana < (d.mana || 0)) { p.useCd = 0.3; if (m.edge) { g.say('Not enough mana!', '#8090ff', 2); audio.sfx('error'); } return; }
  p.mana -= d.mana || 0; p.manaT = -0.6; p.useCd = d.use || 0.4;
  const sx = p.x + p.w / 2, sy = p.y + 10, ang = Math.atan2(m.wy - sy, m.wx - sx), sp = d.speed || 450; p.dir = Math.cos(ang) >= 0 ? 1 : -1;
  const base = { x: sx, y: sy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, dmg: d.dmg! * p.st.dmg, friendly: true };
  switch (d.proj) {
    case 'spark': spawnProj(g, { ...base, kind: 'spark', life: 1.6, col: '#ffe060', pierce: 0, light: 0.7, grav: 0 }); audio.sfx('magic'); break;
    case 'fireball': spawnProj(g, { ...base, kind: 'fireball', life: 2, col: '#ff7a30', pierce: 0, light: 0.9, fire: true, big: 1 }); audio.sfx('fire'); break;
    case 'skull': spawnProj(g, { ...base, kind: 'skull', life: 2.6, col: '#e8e4d0', pierce: 1, light: 0.5, homing: 2.2 }); audio.sfx('magic', 0.7); break;
    case 'rainbow': spawnProj(g, { ...base, kind: 'rainbow', life: 2.2, col: '#ff80ff', pierce: 3, light: 1, w: 12, h: 12 }); audio.sfx('magic', 1.3); break;
  }
}
export function throwItem(g: Game, d: ItemDef) {
  const p = g.player, m = g.mouse; const sx = p.x + p.w / 2, sy = p.y + 8; const dx = m.wx - sx, dy = m.wy - sy, dist = Math.min(260, Math.hypot(dx, dy)); const ang = Math.atan2(dy, dx);
  const sp = 120 + dist * 1.4;
  spawnProj(g, { x: sx, y: sy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 80, kind: d.fx === 'purify' ? 'powder' : 'bomb', dmg: d.dmg || 0, friendly: true, life: d.fx === 'purify' ? 1.2 : 99, fuse: 1.6, grav: 700, col: d.col, w: 8, h: 8, big: 1 });
  p.useCd = d.use || 0.5; g.consumeSel(); audio.sfx('swing', 0.8);
}
export function purify(g: Game, x: number, y: number, r: number) {
  const w = g.world, cx = Math.floor(x / 16), cy = Math.floor(y / 16); let n = 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r) continue; const t = w.get(cx + dx, cy + dy);
    if (t === T.EBON) { w.set(cx + dx, cy + dy, T.STONE); n++; } else if (t === T.BGRASS) { w.set(cx + dx, cy + dy, T.GRASS); n++; } else if (t === T.LEAVES_BLIGHT) { w.set(cx + dx, cy + dy, T.LEAVES); n++; }
  }
  g.burst(x, y, 30, '#a0ffb0', 100, -20, 1, 2, true); audio.sfx('heal'); if (n > 0) g.ftext(x, y - 10, `Cleansed ${n} tiles`, '#a0ffb0', 9);
}
export function explode(g: Game, x: number, y: number, r: number, dmg: number, byPlayer: boolean, tiles = true) {
  const w = g.world, cx = Math.floor(x / 16), cy = Math.floor(y / 16), p = g.player;
  if (tiles) { audio.sfx('explosion'); g.shake(9); g.burst(x, y, 40, '#ff9030', 220, 100, 0.8, 3, true); g.burst(x, y, 24, '#555555', 120, -30, 1, 3); }
  else { audio.sfx('fire'); g.shake(1.5); g.burst(x, y, 14, '#ff9030', 120, 60, 0.5, 2, true); }
  if (tiles) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r + 1) continue; const t = w.get(cx + dx, cy + dy); const td = TILES[t];
    if (t !== T.AIR && !td.liquid && td.pick <= 65 && cy + dy < HELL_TOP + 40) g.breakTile(cx + dx, cy + dy, true);
  }
  for (const e of g.enemies) { if (e.dead) continue; const d = Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y); if (d < r * 16 + 12) damageEnemy(g, e, dmg * (1 - d / (r * 16 + 40) * 0.5), 8, e.x + e.w / 2 < x ? -1 : 1); }
  for (const n of g.npcs) { const d = Math.hypot(n.x - x, n.y - y); if (d < r * 16 && n.deadT <= 0) { n.hp -= Math.round(dmg * 0.5); n.flash = 0.2; if (n.hp <= 0) npcDie(g, n); } }
  const pd = Math.hypot(p.x + p.w / 2 - x, p.y + p.h / 2 - y); if (pd < r * 16 + 8 && !p.dead) { hurtPlayer(g, dmg * 0.6, x, 'hit'); p.vx += (p.x < x ? -1 : 1) * 180; p.vy = -250; }
  void byPlayer;
}
export function npcDie(g: Game, n: Npc) { n.deadT = 150; n.hp = 0; g.say(`${n.def.name} was slain!`, '#ff8080', 6); g.burst(n.x + 6, n.y + 12, 20, '#c02020', 100, 300, 0.8, 2); audio.sfx('die'); }

// ---------- grappling hook ----------
export function fireHook(g: Game) {
  const p = g.player; if (p.hook) { p.hook = null; return; }
  const m = g.mouse, sx = p.x + p.w / 2, sy = p.y + 10, ang = Math.atan2(m.wy - sy, m.wx - sx);
  p.hook = { x: sx, y: sy, vx: Math.cos(ang) * 760, vy: Math.sin(ang) * 760, state: 'fly', t: 0 }; audio.sfx('grapple');
}
export function updateHook(g: Game, dt: number) {
  const p = g.player, h = p.hook; if (!h) return; h.t += dt;
  if (h.state === 'fly') {
    for (let i = 0; i < 3; i++) { h.x += h.vx * dt / 3; h.y += h.vy * dt / 3; if (g.world.solid(Math.floor(h.x / 16), Math.floor(h.y / 16))) { h.state = 'hang'; audio.sfx('dig_metal'); g.burst(h.x, h.y, 5, '#cccccc', 40, 100, 0.3, 1); break; } }
    if (h.t > 0.55) p.hook = null;
  } else if (!g.world.solid(Math.floor(h.x / 16), Math.floor(h.y / 16)) || h.t > 6) p.hook = null;
}

// ---------- projectiles ----------
export function updateProjs(g: Game, dt: number) {
  const p = g.player, w = g.world;
  for (let i = g.projs.length - 1; i >= 0; i--) {
    const pr = g.projs[i]; pr.t += dt; pr.life -= dt;
    if (pr.fuse !== undefined && pr.kind === 'bomb') { pr.fuse -= dt; if (pr.fuse <= 0) { explode(g, pr.x, pr.y, 4, pr.dmg, true); g.projs.splice(i, 1); continue; } }
    if (pr.life <= 0) { if (pr.kind === 'powder') purify(g, pr.x, pr.y, 6); if (pr.kind === 'fallstar') starLand(g, pr); g.projs.splice(i, 1); continue; }
    if (pr.homing) {
      let best: { x: number; y: number } | null = null, bd = 260;
      if (pr.friendly) { for (const e of g.enemies) if (!e.dead) { const d = Math.hypot(e.x + e.w / 2 - pr.x, e.y + e.h / 2 - pr.y); if (d < bd) { bd = d; best = { x: e.x + e.w / 2, y: e.y + e.h / 2 }; } } }
      else if (!p.dead) best = { x: p.x + p.w / 2, y: p.y + p.h / 2 };
      if (best) { const sp = Math.hypot(pr.vx, pr.vy), a = Math.atan2(pr.vy, pr.vx), ta = Math.atan2(best.y - pr.y, best.x - pr.x); let da = ta - a; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283; const na = a + Math.max(-pr.homing * dt, Math.min(pr.homing * dt, da)); pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp; }
    }
    pr.vy += pr.grav * dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(pr.vx, pr.vy) * dt / 6)); let dead = false;
    for (let s = 0; s < steps && !dead; s++) {
      const nx = pr.x + pr.vx * dt / steps, ny = pr.y + pr.vy * dt / steps;
      const solid = w.solid(Math.floor(nx / 16), Math.floor(ny / 16));
      if (solid) {
        if (pr.kind === 'bomb') { if (w.solid(Math.floor(nx / 16), Math.floor(pr.y / 16))) pr.vx *= -0.5; else { pr.vy *= -0.35; pr.vx *= 0.8; if (Math.abs(pr.vy) < 20) pr.vy = 0; } continue; }
        if (pr.kind === 'fallstar') { pr.x = nx; pr.y = ny; starLand(g, pr); dead = true; break; }
        if (pr.kind === 'powder') { purify(g, pr.x, pr.y, 6); dead = true; break; }
        if (pr.kind === 'fireball' && pr.friendly) { explode(g, pr.x, pr.y, 1, pr.dmg * 1.2, true, false); dead = true; break; }
        if (pr.kind === 'beam') { pr.x = nx; pr.y = ny; continue; }
        g.burst(pr.x, pr.y, 4, pr.col, 50, 100, 0.3, 1); dead = true; break;
      }
      pr.x = nx; pr.y = ny;
      if (pr.friendly && pr.kind !== 'bomb' && pr.kind !== 'powder' && pr.kind !== 'fallstar') {
        for (const e of g.enemies) {
          if (e.dead || e.a.fled) continue;
          for (const r of getRects(e)) {
            if (!(pr.x + pr.w / 2 > r.x && pr.x - pr.w / 2 < r.x + r.w && pr.y + pr.h / 2 > r.y && pr.y - pr.h / 2 < r.y + r.h)) continue;
            const key = e.uid * 10 + (r.id === 'main' ? 0 : r.id.length); if (pr.hit && pr.hit.has(key)) continue; pr.hit && pr.hit.add(key);
            if (pr.kind === 'fallstar') continue;
            const crit = rnd() * 100 < p.st.crit; damageEnemy(g, e, pr.dmg, pr.kb, Math.sign(pr.vx) || 1, crit, r.id);
            if (pr.kind === 'fireball') { explode(g, pr.x, pr.y, 1, pr.dmg * 0.5, true, false); dead = true; } else if (pr.pierce <= 0) dead = true; else pr.pierce--;
            break;
          }
          if (dead) break;
        }
      } else if (!p.dead && pr.kind !== 'beam') {
        if (pr.x + pr.w / 2 > p.x && pr.x - pr.w / 2 < p.x + p.w && pr.y + pr.h / 2 > p.y && pr.y - pr.h / 2 < p.y + p.h && p.invT <= 0) { hurtPlayer(g, pr.dmg, pr.x - pr.vx, 'hit'); dead = true; }
      }
    }
    pr.rot = pr.kind === 'scythe' || pr.kind === 'skullbolt' || pr.kind === 'skull' ? pr.rot + dt * 12 : Math.atan2(pr.vy, pr.vx);
    if (!dead && (pr.light || pr.kind === 'rainbow') && rnd() < 0.7) g.burst(pr.x, pr.y, 1, pr.kind === 'rainbow' ? `hsl(${(pr.t * 600) % 360},100%,65%)` : pr.col, 15, 0, 0.3, 2, true);
    if (dead || pr.y > w.H * 16 + 100 || pr.x < -50 || pr.x > w.W * 16 + 50) g.projs.splice(i, 1);
  }
}
function starLand(g: Game, pr: Proj) {
  const w = g.world; let y = Math.floor(pr.y / 16); while (y > 0 && w.solid(Math.floor(pr.x / 16), y)) y--;
  g.dropItem(pr.x, y * 16 + 8, 'fallen_star', 1, true); g.burst(pr.x, y * 16, 20, '#ffe060', 100, 50, 0.9, 2, true); audio.sfx('star'); g.drops[g.drops.length - 1].delay = 0.1;
  const dd = g.drops[g.drops.length - 1]; if (dd) dd.star = true;
}

// ---------- enemy AI ----------
function targetOf(g: Game, e: Enemy): { x: number; y: number; npc?: Npc } {
  const p = g.player; let tx = p.x + p.w / 2, ty = p.y + p.h / 2, bd = Math.hypot(tx - e.x - e.w / 2, ty - e.y - e.h / 2); let npc: Npc | undefined;
  if (e.boss) return { x: tx, y: ty };
  for (const n of g.npcs) { if (n.deadT > 0) continue; const d = Math.hypot(n.x - e.x, n.y - e.y); if (d < 260 && d < bd * 0.7) { bd = d; tx = n.x + 6; ty = n.y + 12; npc = n; } }
  if (p.dead && !npc) { tx = e.x + e.dir * 100; }
  return { x: tx, y: ty, npc };
}
function enemyShoot(g: Game, e: Enemy, tg: { x: number; y: number }, kind: string, spd: number, dmg: number, col: string, spread = 0.08, grav = 0) {
  const sx = e.x + e.w / 2, sy = e.y + e.h * 0.4; const a = Math.atan2(tg.y - sy, tg.x - sx) + (rnd() - 0.5) * spread;
  spawnProj(g, { x: sx, y: sy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - (grav ? Math.abs(tg.x - sx) * 0.12 : 0), kind, dmg, friendly: false, life: 4, grav, col, light: kind === 'arrow' || kind === 'stinger' ? 0 : 0.7, w: 8, h: 8, homing: kind === 'phantom' ? 0.9 : kind === 'skullbolt' ? 0.5 : 0 });
  audio.sfx(kind === 'arrow' ? 'shoot' : 'magic', 0.7);
}
function steer(e: Enemy, tx: number, ty: number, acc: number, max: number, dt: number) {
  const dx = tx - (e.x + e.w / 2), dy = ty - (e.y + e.h / 2), d = Math.hypot(dx, dy) || 1; e.vx += dx / d * acc * dt; e.vy += dy / d * acc * dt;
  const sp = Math.hypot(e.vx, e.vy); if (sp > max) { e.vx *= max / sp; e.vy *= max / sp; }
}
function aiEnemy(g: Game, e: Enemy, dt: number) {
  const def = e.def, w = g.world; const tg = targetOf(g, e); const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  const dx = tg.x - cx, dy = tg.y - cy, dist = Math.hypot(dx, dy); const sgn = Math.sign(dx) || 1; const spd = def.spd * (g.diff.id === 'veteran' ? 1.1 : 1);
  if (e.kbT > 0) e.kbT -= dt;
  const shoot = def.shoot; if (shoot) e.a.cd = (e.a.cd ?? 1 + rnd() * 2) - dt;
  switch (def.ai) {
    case 'slime': {
      e.vy = Math.min(e.vy + 1200 * dt, 700); e.a.cd = (e.a.cd ?? rnd()) - dt;
      if (e.onGround) { if (e.kbT <= 0) e.vx *= 0.8; if (e.a.cd <= 0 && e.kbT <= 0) { e.vx = sgn * spd * (1 + rnd() * 0.5); e.vy = -(def.jump || 300) * (0.8 + rnd() * 0.5); e.a.cd = 0.7 + rnd() * 0.9; e.dir = sgn; } }
      moveBody(w, e, dt, {}); break;
    }
    case 'walk': case 'archer': {
      e.vy = Math.min(e.vy + 1300 * dt, 700);
      let want = Math.abs(dx) > 6 ? sgn : 0;
      if (def.ai === 'archer') { if (Math.abs(dx) < 110) want = -sgn * 0.7; else if (Math.abs(dx) < (shoot?.range ?? 250) * 0.8) want = 0; }
      if (e.kbT <= 0) e.vx = approach(e.vx, want * spd, 900 * dt); if (want) e.dir = want > 0 ? 1 : -1; else e.dir = sgn;
      moveBody(w, e, dt, {});
      if ((e as any).hitWall && e.onGround && e.kbT <= 0) e.vy = -(def.jump || 360);
      else if (e.onGround && dy < -48 && Math.abs(dx) < 50 && rnd() < dt * 1.5) e.vy = -(def.jump || 360) * 1.05;
      if (shoot && e.a.cd <= 0 && dist < shoot.range && !(g.player.dead)) { enemyShoot(g, e, tg, shoot.proj, shoot.spd, shoot.dmg * hmBoost(g, e), '#d8b078', 0.15, 260); e.a.cd = shoot.rate * (0.8 + rnd() * 0.4); }
      e.walk += Math.abs(e.vx) * dt * 0.1; break;
    }
    case 'fly': case 'bat': case 'ghost': {
      if (def.ai === 'bat') { e.a.turn = (e.a.turn ?? 0) - dt; if (e.a.turn <= 0) { e.a.turn = 0.3 + rnd() * 0.5; e.a.ox = (rnd() - 0.5) * 140; e.a.oy = (rnd() - 0.5) * 90; } steer(e, tg.x + e.a.ox, tg.y + e.a.oy, def.accel || 300, spd, dt); }
      else { steer(e, tg.x, tg.y + Math.sin(e.t * 2 + e.uid) * 24, (def.accel || 200) * (e.kbT > 0 ? 0.2 : 1), spd, dt); }
      if (def.ai === 'ghost') { e.x += e.vx * dt; e.y += e.vy * dt; e.alpha = 0.55 + Math.sin(e.t * 3) * 0.2; }
      else { moveBody(w, e, dt, {}); if ((e as any).hitWall) e.vx = -(e as any).hitWall * 40; if (e.onGround) e.vy = -60; }
      e.dir = e.vx >= 0 ? 1 : -1; break;
    }
    case 'flyshoot': case 'imp': {
      const keep = (shoot?.range ?? 200) * 0.55; let ox = 0, oy = -50 + Math.sin(e.t * 1.7 + e.uid) * 24;
      if (dist > keep * 1.3) { ox = 0; } else if (dist < keep * 0.6) { ox = -sgn * 120; }
      steer(e, tg.x + ox - sgn * (dist > keep ? 0 : 0), tg.y + oy, (def.accel || 200), spd, dt);
      if (def.ai === 'imp' && e.kbT <= 0) { e.vx *= 0.99; }
      moveBody(w, e, dt, {}); if ((e as any).hitWall) e.vx = -(e as any).hitWall * 40; e.dir = sgn;
      if (shoot && e.a.cd <= 0 && dist < shoot.range && !g.player.dead) { enemyShoot(g, e, tg, shoot.proj, shoot.spd, shoot.dmg * hmBoost(g, e), def.col2, 0.12); e.a.cd = shoot.rate * (0.8 + rnd() * 0.4); }
      if (def.id === 'fire_imp') { e.a.tele = (e.a.tele ?? 4) - dt; if (e.a.tele <= 0 && dist > 260) { const sp = findSpot(g, def, false); if (sp) { g.burst(e.x, e.y, 14, '#ff8a30', 80, -20, 0.5, 2, true); e.x = sp.x; e.y = sp.y; g.burst(e.x, e.y, 14, '#ff8a30', 80, -20, 0.5, 2, true); } e.a.tele = 5; } }
      break;
    }
  }
}

function contact(g: Game, e: Enemy, dt: number) {
  const p = g.player; e.hitCd -= dt;
  const dmg = e.def.dmg * hmBoost(g, e);
  if (!p.dead && p.invT <= 0) { for (const r of getRects(e)) if (overlap(r, p)) { hurtPlayer(g, dmg, r.x + r.w / 2, 'hit'); break; } }
  if (e.hitCd <= 0) for (const n of g.npcs) if (!e.boss && n.deadT <= 0 && overlap(getRects(e)[0], n)) { e.hitCd = 0.7; n.hp -= Math.max(1, Math.round(dmg * 0.6)); n.flash = 0.2; n.vx = (n.x < e.x ? -1 : 1) * 80; n.vy = -100; g.burst(n.x + 6, n.y + 12, 4, '#c02020', 60, 200, 0.4, 1); if (n.hp <= 0) npcDie(g, n); }
}
export function updateEnemies(g: Game, dt: number) {
  const p = g.player; const day = daylight(g.time) > 0.5;
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i]; if (e.dead) { g.enemies.splice(i, 1); continue; }
    e.t += dt; e.flash -= dt;
    const far = Math.hypot(e.x - p.x, e.y - p.y);
    if (!e.boss && (far > 1700 || (e.y > WH * 16 + 50))) { g.enemies.splice(i, 1); continue; }
    if (!e.boss && e.def.night && day && !g.ev.blood && far > g.vw * 0.7 && rnd() < dt * 0.4) { g.enemies.splice(i, 1); continue; }
    if (e.boss) bossAI(g, e, dt); else aiEnemy(g, e, dt);
    if (!e.a.fled) contact(g, e, dt);
    if (e.def.fire === undefined && !e.boss && g.world.get(Math.floor((e.x + e.w / 2) / 16), Math.floor((e.y + e.h - 2) / 16)) === T.LAVA && rnd() < dt * 3) damageEnemy(g, e, 12, 0, 0);
    if (e.def.light && rnd() < dt * 3) g.burst(e.x + e.w / 2, e.y + e.h / 2, 1, e.def.col2, 20, -30, 0.5, 1, true);
  }
  if (g.boss && (g.boss.dead || !g.enemies.includes(g.boss))) g.boss = null;
}

// ---------- bosses ----------
export function spawnBoss(g: Game, id: string): Enemy {
  const p = g.player, def = ENEMIES[id]; const px = p.x, py = p.y; let x = px - def.w / 2, y = py - 260;
  if (id === 'eoc') { x = px + (rnd() < 0.5 ? -260 : 260); y = py - 300; }
  if (id === 'flesh_wall') { const side = px < WW * 8 ? 1 : -1; x = px + side * 720; y = (WH - 28) * 16 - def.h / 2; }
  if (id === 'mech_worm') { x = px + 420; y = py - 330; }
  const e = spawnEnemy(g, id, x, y); e.boss = true; g.boss = e; e.a = { state: 'hover', timer: 2.5, phase: 1, charges: 0 };
  if (id === 'mech_worm') { const n = 26; e.a.segs = []; for (let i = 0; i < n; i++) e.a.segs.push({ x: x + 13 + i * 12, y: y + 13 }); e.a.ang = Math.PI; e.a.shootT = 2; }
  if (id === 'lunar') { const hp = Math.round(3800 * g.diff.hp); e.a.hands = { L: { hp, max: hp, alive: true, x: 0, y: 0 }, R: { hp, max: hp, alive: true, x: 0, y: 0 } }; e.a.atkT = 3; e.a.handT = 1.5; e.a.beam = null; }
  g.say(`${def.name} has awoken!`, '#ff5050', 6); audio.sfx('boss'); g.shake(10); g.burst(e.x + e.w / 2, e.y + e.h / 2, 40, def.col, 200, 0, 1, 3, true);
  return e;
}
export function bossFlee(g: Game) {
  const e = g.boss; if (!e || e.a.fled) return; e.a.fled = true; e.a.fleeT = 6;
  if (e.def.summon) g.addItem(e.def.summon, 1); g.say(`${e.def.name} retreats...`, '#ffd080', 5); g.boss = null;
}
export function useSummon(g: Game, d: ItemDef): boolean {
  const p = g.player; const id = d.boss!;
  if (id === 'goblin') { if (g.ev.goblin) { g.say('A Goblin Army is already invading!', '#ff9a80'); return false; } startGoblin(g, false); return true; }
  if (g.boss) { g.say('A boss is already active!', '#ff9a80'); audio.sfx('error'); return false; }
  if (id === 'eoc' && !isNight(g.time)) { g.say('The Eye of Cthulhu only awakens at night.', '#ffd080'); audio.sfx('error'); return false; }
  if (id === 'flesh_wall' && p.y < HELL_TOP * 16) { g.say('The doll must be used in the Underworld.', '#ffd080'); audio.sfx('error'); return false; }
  if (id === 'flesh_wall' && g.flags.wof) { g.say('The Wall of Flesh has already fallen... but the doll crumbles anyway.', '#ffd080'); }
  spawnBoss(g, id); return true;
}
function angDiff(a: number, b: number) { let d = b - a; while (d > Math.PI) d -= 6.283; while (d < -Math.PI) d += 6.283; return d; }
function bossAI(g: Game, e: Enemy, dt: number) {
  const p = g.player, a = e.a; const px = p.x + p.w / 2, py = p.y + p.h / 2, cx = e.x + e.w / 2, cy = e.y + e.h / 2; e.dir = px >= cx ? 1 : -1;
  if (a.fled) { e.vy -= 500 * dt; e.x += e.vx * dt; e.y += e.vy * dt; a.fleeT -= dt; e.alpha = Math.max(0, a.fleeT / 3); e.rects = []; if (a.fleeT <= 0 || e.y < -300) { e.dead = true; } return; }
  if (p.dead) { a.timer = 2; steer(e, cx, cy - 400, 200, 200, dt); e.x += e.vx * dt; e.y += e.vy * dt; }
  const hp = e.hp / e.maxHp;
  switch (e.def.id) {
    case 'eoc': {
      if (!isNight(g.time) && !g.ev.blood) { a.dayT = (a.dayT || 0) + dt; if (a.dayT > 3) { bossFlee(g); return; } } else a.dayT = 0;
      const ph = hp < 0.5 ? 2 : 1; if (ph === 2 && a.phase === 1) { a.phase = 2; a.state = 'hover'; a.timer = 0.8; audio.sfx('roar'); g.shake(10); g.say('The Eye of Cthulhu enters a rage!', '#ff5050', 4); g.burst(cx, cy, 40, '#ff4040', 200, 0, 0.8, 3, true); }
      a.timer -= dt; a.servT = (a.servT ?? 2) - dt;
      if (a.state === 'hover') {
        steer(e, px + Math.sin(e.t * 1.2) * 180, py - 170, 560, ph === 1 ? 240 : 280, dt);
        if (a.servT <= 0) { let n = 0; for (const o of g.enemies) if (!o.dead && o.def.id === 'servant') n++; if (n < (ph === 1 ? 4 : 6)) { spawnEnemy(g, 'servant', cx, cy); audio.sfx('npc', 0.5); } a.servT = ph === 1 ? 2.2 : 3.5; }
        if (a.timer <= 0) { a.state = 'windup'; a.timer = 0.45; a.charges = ph === 1 ? 3 : 5; }
      } else if (a.state === 'windup') { e.vx *= 0.9; e.vy *= 0.9; if (a.timer <= 0) { const d = Math.hypot(px - cx, py - cy) || 1, sp = ph === 1 ? 420 : 560; e.vx = (px - cx + p.vx * 0.2) / d * sp; e.vy = (py - cy) / d * sp; a.state = 'dash'; a.timer = ph === 1 ? 0.65 : 0.5; audio.sfx('roar', 1.3); } }
      else { if (a.timer <= 0) { a.charges--; if (a.charges > 0) { a.state = 'windup'; a.timer = ph === 1 ? 0.3 : 0.18; } else { a.state = 'hover'; a.timer = ph === 1 ? 2.4 : 1.1; } } }
      e.x += e.vx * dt; e.y += e.vy * dt; e.rects = [{ id: 'main', x: e.x, y: e.y, w: e.w, h: e.h }]; break;
    }
    case 'bone_lord': {
      const ph = hp < 0.2 ? 3 : hp < 0.55 ? 2 : 1; if (ph > a.phase) { a.phase = ph; audio.sfx('roar'); g.shake(9); g.say(ph === 2 ? 'The Bone Lord spins in fury!' : 'The Bone Lord is enraged!', '#ff5050', 4); }
      a.timer -= dt; a.shootT = (a.shootT ?? 2) - dt; a.ang = (a.ang || 0) + dt * (a.state === 'spin' ? 7 : 2.2);
      if (a.state === 'hover') {
        steer(e, px + Math.sin(e.t * 0.9) * 150, py - 150, 480, 210, dt);
        if (a.shootT <= 0) { for (let k = -1; k <= 1; k++) { const sx = cx, sy = cy, an = Math.atan2(py - sy, px - sx) + k * 0.28; spawnProj(g, { x: sx, y: sy, vx: Math.cos(an) * 230, vy: Math.sin(an) * 230, kind: 'skullbolt', dmg: 26, friendly: false, life: 4, col: '#40ff90', light: 0.7, homing: 0.6 }); } audio.sfx('magic', 0.6); a.shootT = ph === 1 ? 2.2 : 1.7; }
        if (ph >= 2 && a.timer <= 0) { a.state = 'spin'; a.timer = ph === 2 ? 3.6 : 4.6; audio.sfx('roar', 0.8); }
      } else {
        steer(e, px, py, 700, ph === 2 ? 270 : 350, dt); a.ringT = (a.ringT ?? 0.5) - dt;
        if (a.ringT <= 0) { for (let k = 0; k < 6; k++) { const an = k * 1.047 + a.ang; spawnProj(g, { x: cx, y: cy, vx: Math.cos(an) * 170, vy: Math.sin(an) * 170, kind: 'skullbolt', dmg: 22, friendly: false, life: 3, col: '#40ff90', light: 0.7 }); } a.ringT = 0.8; }
        if (a.timer <= 0) { a.state = 'hover'; a.timer = ph === 3 ? 1.8 : 3.2; a.shootT = 0.8; }
      }
      e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= 0.995; e.vy *= 0.995;
      const hr = a.state === 'spin' ? 50 : 56; e.rects = [{ id: 'main', x: e.x, y: e.y, w: e.w, h: e.h }, { id: 'handL', x: cx + Math.cos(a.ang) * hr - 10, y: cy + Math.sin(a.ang) * hr * 0.8 - 10, w: 20, h: 20 }, { id: 'handR', x: cx - Math.cos(a.ang) * hr - 10, y: cy - Math.sin(a.ang) * hr * 0.8 - 10, w: 20, h: 20 }]; break;
    }
    case 'flesh_wall': {
      const ph = hp < 0.25 ? 3 : hp < 0.5 ? 2 : 1; if (ph > a.phase) { a.phase = ph; audio.sfx('roar'); g.shake(8); g.say('The Wall of Flesh surges forward!', '#ff5050', 4); }
      if (py < (HELL_TOP - 8) * 16) { a.awayT = (a.awayT || 0) + dt; if (a.awayT > 8) { bossFlee(g); return; } } else a.awayT = 0;
      const sp = 38 * (ph === 1 ? 1 : ph === 2 ? 1.6 : 2.1); const dir = Math.sign(px - cx) || 1; e.vx = approach(e.vx, dir * sp, 60 * dt); e.x += e.vx * dt;
      const yMin = HELL_TOP * 16 + e.h * 0.25, yMax = (WH - 3) * 16 - e.h * 0.25; const ty = Math.max(yMin, Math.min(yMax, py)); e.y += (ty - e.h / 2 - e.y) * Math.min(1, dt * 2);
      e.dir = dir; a.eyeT = (a.eyeT ?? 2) - dt; a.mouthT = (a.mouthT ?? 3) - dt;
      if (a.eyeT <= 0 && !p.dead) { for (const oy of [-60, 50]) { const sx = cx + dir * 16, sy = cy + oy; const an = Math.atan2(py - sy, px - sx) + (rnd() - 0.5) * 0.1; spawnProj(g, { x: sx, y: sy, vx: Math.cos(an) * 340, vy: Math.sin(an) * 340, kind: 'laser', dmg: 36, friendly: false, life: 3.5, col: '#ff3050', light: 0.8, w: 6, h: 6 }); } audio.sfx('laser'); a.eyeT = ph === 1 ? 1.9 : ph === 2 ? 1.4 : 1.0; }
      if (a.mouthT <= 0) { let n = 0; for (const o of g.enemies) if (!o.dead && o.def.id === 'hungry') n++; if (n < 4 + ph * 2) { const h = spawnEnemy(g, 'hungry', cx + dir * 24, cy + 90 + (rnd() - 0.5) * 60); h.vx = dir * 120; audio.sfx('npc', 0.4); } a.mouthT = ph === 1 ? 2.8 : 1.8; }
      e.rects = [{ id: 'main', x: e.x, y: e.y, w: e.w, h: e.h }]; break;
    }
    case 'mech_worm': {
      const ph = hp < 0.5 ? 2 : 1; if (ph > a.phase) { a.phase = ph; audio.sfx('roar'); g.shake(9); g.say('The Destroyer overloads!', '#ff5050', 4); }
      const tgt = Math.atan2(py - cy, px - cx); const turn = (ph === 1 ? 1.7 : 2.3) * dt; const d = angDiff(a.ang, tgt); a.ang += Math.max(-turn, Math.min(turn, d));
      const sp = ph === 1 ? 280 : 350; e.vx = Math.cos(a.ang) * sp; e.vy = Math.sin(a.ang) * sp; e.x += e.vx * dt; e.y += e.vy * dt;
      const segs = a.segs as { x: number; y: number }[]; let prev = { x: e.x + e.w / 2, y: e.y + e.h / 2 };
      for (const s of segs) { const dx = prev.x - s.x, dy = prev.y - s.y, dd = Math.hypot(dx, dy) || 1; if (dd > 17) { s.x = prev.x - dx / dd * 17; s.y = prev.y - dy / dd * 17; } prev = s; }
      a.shootT -= dt; if (a.shootT <= 0 && !p.dead) { const s = segs[Math.floor(rnd() * segs.length)]; const an = Math.atan2(py - s.y, px - s.x); spawnProj(g, { x: s.x, y: s.y, vx: Math.cos(an) * 300, vy: Math.sin(an) * 300, kind: 'laser', dmg: 34, friendly: false, life: 3, col: '#ff3040', light: 0.8, w: 6, h: 6 }); audio.sfx('laser'); a.shootT = ph === 1 ? 1.3 : 0.7; }
      e.rects = [{ id: 'main', x: e.x, y: e.y, w: e.w, h: e.h }, ...segs.map((s, i) => ({ id: 's' + i, x: s.x - 9, y: s.y - 9, w: 18, h: 18 }))]; break;
    }
    case 'lunar': {
      const H = a.hands; const handsUp = H.L.alive || H.R.alive; const enr = hp < 0.3;
      steer(e, px + Math.sin(e.t * 0.5) * 120, py - 250 + Math.sin(e.t * 0.9) * 20, 300, 150, dt); e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= 0.97; e.vy *= 0.97;
      const bob = Math.sin(e.t * 1.3) * 12; H.L.x = cx - 150; H.L.y = cy + 30 + bob; H.R.x = cx + 150; H.R.y = cy + 30 - bob;
      a.handT -= dt;
      if (a.handT <= 0 && !p.dead) { for (const k of ['L', 'R']) if (H[k].alive) { const an = Math.atan2(py - H[k].y, px - H[k].x); for (let j = -1; j <= 1; j += (enr ? 1 : 2)) spawnProj(g, { x: H[k].x, y: H[k].y, vx: Math.cos(an + j * 0.25) * 200, vy: Math.sin(an + j * 0.25) * 200, kind: 'phantom', dmg: 40, friendly: false, life: 5, col: '#40e0ff', light: 0.8, homing: 0.8, w: 10, h: 10 }); } audio.sfx('magic', 0.5); a.handT = handsUp ? 2.0 : 3; }
      if (!handsUp) {
        a.atkT -= dt;
        if (a.atkT <= 0 && !a.beam && !p.dead) {
          const r = rnd();
          if (r < 0.4) { const n = enr ? 18 : 12; const off = rnd() * 6; for (let k = 0; k < n; k++) { const an = k / n * 6.283 + off; spawnProj(g, { x: cx, y: cy, vx: Math.cos(an) * 180, vy: Math.sin(an) * 180, kind: 'bolt', dmg: 38, friendly: false, life: 4.5, col: '#80f0ff', light: 0.8, w: 8, h: 8 }); } audio.sfx('magic', 0.6); a.atkT = enr ? 2.0 : 3.0; }
          else if (r < 0.75) { const an0 = Math.atan2(py - cy, px - cx); a.beam = { t: -1.1, ang0: an0 - 0.7 * (rnd() < 0.5 ? 1 : -1), sweep: 1.4, dur: 1.5, hit: 0 }; a.atkT = enr ? 3 : 4.2; audio.sfx('laser', 0.5); }
          else { let n = 0; for (const o of g.enemies) if (!o.dead && o.def.id === 'true_eye') n++; if (n < 3) { for (let k = 0; k < 2; k++) spawnEnemy(g, 'true_eye', cx + (k ? 60 : -60), cy + 20); audio.sfx('npc', 0.4); } a.atkT = enr ? 2.5 : 3.5; }
        }
        if (a.beam) {
          const b = a.beam; b.t += dt; b.hit -= dt;
          if (b.t > b.dur) a.beam = null;
          else if (b.t > 0) {
            const an = b.ang0 + b.sweep * (b.t / b.dur); const bx = Math.cos(an), by = Math.sin(an); const rx = px - cx, ry = py - cy; const along = rx * bx + ry * by; const perp = Math.abs(rx * by - ry * bx);
            if (along > 0 && along < 900 && perp < 14 && p.invT <= 0 && !p.dead) hurtPlayer(g, 80, cx, 'hit');
            if (rnd() < 0.5) g.burst(cx + bx * along * rnd(), cy + by * along * rnd(), 1, '#80f0ff', 10, 0, 0.3, 3, true);
          }
        }
      }
      e.rects = [{ id: 'main', x: cx - 26, y: cy - 30, w: 52, h: 60 }];
      if (H.L.alive) e.rects.push({ id: 'handL', x: H.L.x - 22, y: H.L.y - 22, w: 44, h: 44 });
      if (H.R.alive) e.rects.push({ id: 'handR', x: H.R.x - 22, y: H.R.y - 22, w: 44, h: 44 });
      break;
    }
  }
}
export function bossDefeated(g: Game, e: Enemy) {
  const def = e.def, id = def.id, p = g.player; g.stats.bosses[id] = (g.stats.bosses[id] || 0) + 1; g.meta.totalBosses++;
  const first = g.stats.bosses[id] === 1; g.boss = null; g.shake(14); audio.sfx('win');
  g.say(`${def.name} has been defeated!`, '#ffe060', 8);
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  g.burst(cx, cy, 80, def.col, 260, 60, 1.6, 3, true); g.burst(cx, cy, 50, '#ffffff', 300, 0, 1.2, 3, true);
  for (const [item, mn, mx] of def.bossLoot || []) g.dropItem(cx, cy, item, mn + Math.floor(rnd() * (mx - mn + 1)));
  p.coins += def.coin[0]; g.stats.coinsEarned += def.coin[0]; g.ftext(cx, cy - 20, `+${(def.coin[0] / 10000).toFixed(1)}g`, '#ffd84a', 13);
  for (const o of g.enemies) if (!o.boss && (o.def.id === 'servant' || o.def.id === 'hungry' || o.def.id === 'true_eye')) o.dead = true;
  for (const pr of g.projs) if (!pr.friendly) pr.life = 0;
  const shards: Record<string, number> = { eoc: 5, bone_lord: 8, flesh_wall: 15, mech_worm: 20, lunar: 50 };
  if (first) g.award(Math.round((shards[id] || 5) * (g.diff.perma ? 1.5 : 1)), `${def.name} defeated`);
  if (id === 'eoc') { g.flags.eoc = true; g.say('A Dryad senses the Blight — and goblins stir in the distance...', '#a0ffb0', 7); }
  if (id === 'bone_lord') { g.flags.skel = true; g.say('The dungeon curse lifts. Demolitionists may now settle!', '#ffe9a0', 7); }
  if (id === 'flesh_wall') { g.flags.wof = true; if (!g.world.hardmode) hardmodeStart(g); }
  if (id === 'mech_worm') { g.flags.worm = true; g.say('A Mechanical Core drops — the Celestial Sigil can now be forged.', '#ffe9a0', 7); }
  if (id === 'lunar') { g.flags.lunar = true; g.won = true; g.meta.wins++; g.award(g.diff.perma ? 30 : 10, 'Victory!'); g.save(); g.cb.onWin && g.cb.onWin(); }
  g.save();
}
function hardmodeStart(g: Game) {
  const w = g.world; w.hardmode = true; audio.sfx('roar'); g.shake(14);
  g.say('The ancient spirits of light and dark have been released!', '#ff80ff', 9); g.say('Hardmode begins: Cobalt & Adamant ore now lurk in the depths. The Blight spreads faster!', '#ff80ff', 10);
  const REP = new Set<number>([T.STONE, T.EBON]);
  const blob = (bx: number, by: number, r: number, t: number) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (dx * dx + dy * dy <= r * r * (0.6 + rnd() * 0.5) && REP.has(w.get(bx + dx, by + dy))) w.set(bx + dx, by + dy, t); } };
  const sc = g.mods.includes('scarce') ? 0.6 : 1;
  for (let k = 0; k < 90 * sc; k++) blob(8 + Math.floor(rnd() * (WW - 16)), 130 + Math.floor(rnd() * 95), 2 + Math.floor(rnd() * 2), T.COBALT);
  for (let k = 0; k < 70 * sc; k++) blob(8 + Math.floor(rnd() * (WW - 16)), 170 + Math.floor(rnd() * 60), 2 + Math.floor(rnd() * 2), T.ADAMANT);
}

// ---------- events ----------
export function startGoblin(g: Game, natural: boolean) {
  if (g.ev.goblin) return; const side = rnd() < 0.5 ? -1 : 1; g.ev.goblin = { kills: 0, total: Math.min(60, 26 + g.day + (g.world.hardmode ? 14 : 0)), side }; g.stats.events++;
  g.say(`A Goblin Army is approaching from the ${side < 0 ? 'west' : 'east'}!`, '#8aff6a', 8); audio.sfx('boss'); g.shake(5); void natural;
}
function endGoblin(g: Game) {
  g.ev.goblin = null; g.flags.goblin = true; const p = g.player; g.say('The Goblin Army has been defeated!', '#ffe060', 8); audio.sfx('win');
  g.dropItem(p.x, p.y - 20, 'shadow_bar', 6 + Math.floor(rnd() * 5)); g.dropItem(p.x, p.y - 20, 'gold_bar', 4 + Math.floor(rnd() * 4)); g.dropItem(p.x, p.y - 20, 'heal', 2); if (rnd() < 0.5) g.dropItem(p.x, p.y - 20, 'hermes', 1);
  p.coins += 20000; g.stats.coinsEarned += 20000; g.award(3, 'Goblin Army repelled');
  for (const e of g.enemies) if (e.ev === 'goblin') e.dead = true;
}
export function onNewDay(g: Game) {
  if (g.ev.blood) { g.ev.blood = false; g.say('The Blood Moon fades with the dawn.', '#ffd0a0'); }
  for (const n of g.npcs) if (n.deadT > 0) n.deadT = Math.min(n.deadT, 5);
  if (g.day > 2 && g.day % 3 === 0) g.award(1, `Survived to day ${g.day}`);
  if (g.flags.eoc && !g.ev.goblin && rnd() < (g.mods.includes('bloodthirst') ? 0.28 : 0.14)) startGoblin(g, true);
  if (g.day >= 2 && !g.ev.rain && rnd() < (g.mods.includes('bloodthirst') ? 0.28 : 0.14)) { g.ev.rain = 80; g.stats.events++; g.say('Slime is falling from the sky!', '#7affa0', 6); audio.sfx('roar', 1.4); }
  g.save();
}
export function onDusk(g: Game) {
  if (g.day >= 2 && rnd() < (g.mods.includes('bloodthirst') ? 0.32 : 0.14)) { g.ev.blood = true; g.stats.events++; g.say('The Blood Moon is rising...', '#ff5050', 7); audio.sfx('boss'); g.shake(4); }
  else g.say('Night falls. Zombies stir...', '#a0b0ff', 4);
  if (!g.flags.eoc && !g.boss && g.player.maxHp >= 120 && g.nightCount >= 3 && rnd() < 0.3) { spawnBoss(g, 'eoc'); }
}
export function updateEvents(g: Game, dt: number) {
  const p = g.player, a = g as any;
  if (g.ev.rain > 0) {
    g.ev.rain -= dt; a._rainT = (a._rainT ?? 0) - dt;
    if (a._rainT <= 0 && !p.dead) { a._rainT = 0.55 / g.diff.spawn; const x = p.x + (rnd() - 0.5) * 760, y = p.y - 300, r = rnd(); const id = r < 0.6 ? 'slime' : r < 0.9 ? 'blue_slime' : (g.world.hardmode ? 'jungle_slime' : 'blue_slime');
      if (!g.world.solid(Math.floor(x / 16), Math.floor(y / 16)) && g.enemies.filter(e => e.ev === 'rain').length < 14) { const e = spawnEnemy(g, id, x, y, 'rain'); e.vy = 100; } }
    if (g.ev.rain <= 0) { g.say('The slime rain has ended.', '#a0ffb0'); g.ev.rain = 0; for (const e of g.enemies) if (e.ev === 'rain') e.ev = undefined; }
  }
  if (g.ev.goblin) {
    a._gobT = (a._gobT ?? 1) - dt;
    if (a._gobT <= 0 && !p.dead) {
      a._gobT = 2.4 / g.diff.spawn; if (g.enemies.filter(e => e.ev === 'goblin' && !e.dead).length < 8 + Math.floor(g.diff.spawn * 2)) {
        const r = rnd() * 16, id = r < 5 ? 'goblin_peon' : r < 8 ? 'goblin_thief' : r < 11 ? 'goblin_warrior' : r < 14 ? 'goblin_archer' : 'goblin_sorc'; const def = ENEMIES[id];
        const x = Math.max(60, Math.min(WW * 16 - 60, p.x + g.ev.goblin.side * (g.vw / 2 + 120 + rnd() * 160))); const tx = Math.floor(x / 16); let ty = 0; while (ty < WH - 5 && !g.world.solid(tx, ty)) ty++;
        const e = spawnEnemy(g, id, tx * 16, ty * 16 - def.h - 1, 'goblin'); if (def.ai === 'imp') e.y -= 60;
      }
    }
  }
}
export { collides };
void WL;