import { T, TILES, ITEMS, NPCS, B, BIOME_NAMES } from './data';
import type { World } from './world';
import { audio } from './audio';
import type { Game } from './game';
import { moveBody, isNight } from './game';
import type { Npc, Room } from './types';

export { onNewDay, onDusk, updateEvents } from './combat';
const rnd = Math.random;
const approach = (v: number, t: number, d: number) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));

export function makeNpc(g: Game, id: string, x: number, y: number): Npc | null {
  const def = NPCS[id]; if (!def) return null; void g;
  return { id, def, x, y, w: 12, h: 26, vx: 0, vy: 0, onGround: false, dir: 1, hp: 250, maxHp: 250, home: -1, t: rnd() * 5, tx: x, wait: 1, flash: 0, hitCd: 0, deadT: 0, walk: 0, jumpCd: 0 };
}
export function spawnGuide(g: Game) { const n = makeNpc(g, 'guide', g.world.spawn.x * 16 + 28, g.world.spawn.y * 16 - 30); if (n) g.npcs.push(n); }

// ---------- housing ----------
export interface RoomScan { ok: boolean; reasons: string[]; tiles: number[]; area: number; table: boolean; chair: boolean; light: boolean; walls: number; key: number; cx: number; cy: number; leaked: boolean; }
export function scanRoom(w: World, sx: number, sy: number): RoomScan {
  const W = w.W; const res: RoomScan = { ok: false, reasons: [], tiles: [], area: 0, table: false, chair: false, light: false, walls: 0, key: 0, cx: sx, cy: sy, leaked: false };
  const sd = TILES[w.get(sx, sy)];
  if (sd.solid || sd.door || sd.plat) { res.reasons.push('Not an open space'); return res; }
  const seen = new Set<number>(); const q = [sy * W + sx]; seen.add(q[0]); const MAX = 520; let minKey = q[0];
  while (q.length) {
    const i = q.pop()!; const x = i % W, y = (i / W) | 0; res.tiles.push(i); if (i < minKey) minKey = i;
    if (res.tiles.length > MAX) { res.leaked = true; break; }
    const t = w.tiles[i]; if (t === T.TABLE || t === T.WORKBENCH) res.table = true; if (t === T.CHAIR) res.chair = true; if (t === T.TORCH) res.light = true;
    if (TILES[t].liquid) { res.reasons.push('Contains liquid'); }
    if (w.wall(x, y)) res.walls++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 1 || nx >= W - 1 || ny <= 1 || ny >= w.H - 1) { res.leaked = true; continue; }
      const d = TILES[w.tiles[ny * W + nx]]; if (d.solid || d.door || d.plat) continue;
      const k = ny * W + nx; if (!seen.has(k)) { seen.add(k); q.push(k); }
    }
    if (res.leaked) break;
  }
  res.area = res.tiles.length; res.key = minKey;
  if (res.leaked) res.reasons.push('Not enclosed — open to the outside');
  else {
    if (res.area < 30) res.reasons.push(`Too small (${res.area}/30 tiles)`);
    if (res.walls < res.area * 0.8) res.reasons.push('Needs background walls behind the whole room');
  }
  if (!res.table) res.reasons.push('Needs a Table or Work Bench'); if (!res.chair) res.reasons.push('Needs a Chair'); if (!res.light) res.reasons.push('Needs a Torch (light source)');
  res.ok = res.reasons.length === 0;
  let sxSum = 0, sySum = 0; for (const i of res.tiles) { sxSum += i % W; sySum += (i / W) | 0; }
  const mx = sxSum / res.tiles.length, my = sySum / res.tiles.length; let best = res.tiles[0], bd = 1e9;
  for (const i of res.tiles) { const x = i % W, y = (i / W) | 0; if (w.solid(x, y + 1) && !TILES[w.get(x, y)].door) { const d = Math.hypot(x - mx, y - my); if (d < bd) { bd = d; best = i; } } }
  res.cx = best % W; res.cy = (best / W) | 0; return res;
}
export function arrival(g: Game, id: string): boolean {
  const p = g.player;
  switch (id) {
    case 'merchant': return p.coins >= 2500;
    case 'nurse': return p.maxHp >= 120;
    case 'arms_dealer': return p.inv.some(s => s && (ITEMS[s.id].kind === 'bow' || ITEMS[s.id].kind === 'gun' || ITEMS[s.id].kind === 'ammo'));
    case 'demolitionist': return g.countItem('bomb') > 0;
    case 'dryad': return g.flags.eoc;
    case 'wizard': return g.world.hardmode;
  }
  return false;
}
export function flagOK(g: Game, f?: string) { if (!f) return true; if (f === 'hm') return g.world.hardmode; return !!g.flags[f]; }
export function roomOf(g: Game, n: Npc): Room | undefined { return g.rooms.find(r => r.id === n.home); }
export function happiness(g: Game, n: Npc): { mult: number; notes: string[]; mood: string } {
  let m = 1; const notes: string[] = [];
  if (n.home < 0) notes.push('Homeless — no comfort');
  else {
    const r = roomOf(g, n); const b = r ? r.biome : B.FOREST;
    if (b === n.def.like) { m *= 0.9; notes.push(`Loves the ${BIOME_NAMES[b]} (−10%)`); } else if (b === n.def.dislike) { m *= 1.12; notes.push(`Dislikes the ${BIOME_NAMES[b]} (+12%)`); }
    let crowd = 0;
    for (const o of g.npcs) { if (o === n || o.home < 0) continue; const ro = roomOf(g, o); if (!ro || !r) continue; if (Math.hypot(ro.cx - r.cx, ro.cy - r.cy) < 28) { crowd++; if (o.id === n.def.likeN) { m *= 0.95; notes.push(`Likes living near the ${NPCS[o.id].name} (−5%)`); } if (o.id === n.def.dislikeN) { m *= 1.08; notes.push(`Dislikes the ${NPCS[o.id].name} nearby (+8%)`); } } }
    if (crowd > 3) { m *= 1.06; notes.push('Crowded neighborhood (+6%)'); }
    if (!notes.length) notes.push('Content with their home');
  }
  const t = 1 - 0.06 * (g.perks.trader || 0); if (t < 1) notes.push(`Your Trader's Eye perk (−${Math.round((1 - t) * 100)}%)`);
  m *= t; return { mult: m, notes, mood: m <= 0.93 ? 'Happy' : m <= 1.03 ? 'Content' : 'Unhappy' };
}
export function shopPrice(g: Game, n: Npc, id: string, qty = 1) { return Math.max(1, Math.ceil(ITEMS[id].value * qty * happiness(g, n).mult)); }
export function buy(g: Game, n: Npc, idx: number) {
  const e = n.def.shop[idx]; if (!e || !flagOK(g, e.flag)) return; const q = e.n || 1, price = shopPrice(g, n, e.id, q), p = g.player;
  if (p.coins < price) { g.say('Not enough coins.', '#ff9a80', 2); audio.sfx('error'); return; }
  if (!g.roomFor(e.id, q)) { g.say('Your inventory is full.', '#ff9a80', 2); audio.sfx('error'); return; }
  p.coins -= price; g.addItem(e.id, q); audio.sfx('coin'); g.ver++;
}
export function sell(g: Game, area: string, i: number) {
  const s = g.slotArr(area)[i]; if (!s) return; const d = ITEMS[s.id]; if (!d.value) { audio.sfx('error'); return; }
  const price = Math.max(1, Math.floor(d.value * 0.2 * s.n)); g.player.coins += price; g.slotArr(area)[i] = null; g.say(`Sold ${s.n}× ${d.name} for ${price} copper`, '#ffd84a', 2); audio.sfx('coin'); g.touchInv();
}
export function nurseCost(g: Game, n: Npc) { const p = g.player; return Math.ceil((p.maxHp - p.hp) * (2 + (g.world.hardmode ? 3 : 0)) * happiness(g, n).mult); }
export function nurseHeal(g: Game, n: Npc) {
  const p = g.player; const c = nurseCost(g, n); if (c <= 0) return; if (p.coins < c) { g.say('Not enough coins.', '#ff9a80', 2); audio.sfx('error'); return; }
  p.coins -= c; p.hp = p.maxHp; audio.sfx('heal'); g.burst(p.x + 6, p.y + 14, 20, '#ff8aa0', 80, -30, 0.8, 2, true); g.ftext(p.x, p.y - 8, 'Fully healed', '#6aff8a', 10); g.ver++;
}
export function talkTo(g: Game, n: Npc) {
  g.talk = n; g.panel = 'npc'; g.chestKey = null; (n as any).line = Math.floor(rnd() * 10); audio.sfx('npc'); g.ver++; g.cb.onChange && g.cb.onChange();
}

export function updateHousing(g: Game, dt: number) {
  const a = g as any; a._houseT = (a._houseT ?? 0) - dt;
  if (g.panel === 'housing') { // live preview of room under the cursor
    const tx = Math.floor(g.mouse.wx / 16), ty = Math.floor(g.mouse.wy / 16); g.hoverRoom = scanRoom(g.world, tx, ty);
  } else g.hoverRoom = null;
  if (a._houseT > 0) return; a._houseT = 3;
  const w = g.world, W = w.W; const rooms: Room[] = []; const seen = new Set<number>(); let count = 0;
  for (let i = 0; i < w.tiles.length && count < 60; i++) {
    if (w.tiles[i] !== T.CHAIR) continue; count++;
    const s = scanRoom(w, i % W, (i / W) | 0); if (!s.ok || seen.has(s.key)) continue; seen.add(s.key);
    rooms.push({ id: s.key, key: s.key, cx: s.cx, cy: s.cy, area: s.area, tiles: s.tiles, biome: w.biomes[Math.max(0, Math.min(W - 1, s.cx))] });
  }
  g.rooms = rooms;
  const free = () => rooms.filter(r => !g.npcs.some(n => n.home === r.id));
  for (const n of g.npcs) if (n.home >= 0 && !rooms.some(r => r.id === n.home)) { n.home = -1; if (n.deadT <= 0) g.say(`${n.def.name} lost their home!`, '#ffb080', 4); }
  for (const n of g.npcs) {
    if (n.home >= 0) continue; const fr = free(); if (!fr.length) break;
    let best = fr[0], bs = -9; for (const r of fr) { const s = r.biome === n.def.like ? 2 : r.biome === n.def.dislike ? -2 : 0; if (s > bs) { bs = s; best = r; } }
    n.home = best.id; if (n.deadT <= 0) { g.say(`${n.def.name} moved into a house.`, '#a0ffb0', 4); audio.sfx('npc'); }
  }
  a._arrT = (a._arrT ?? 0) - 3;
  if (a._arrT <= 0) {
    a._arrT = 6;
    for (const id of Object.keys(NPCS)) {
      if (id === 'guide' || g.npcs.some(n => n.id === id)) continue; if (!arrival(g, id)) continue;
      const fr = free(); if (!fr.length || rnd() > 0.5) continue;
      const r = fr[0]; const px = r.cx * 16, py = r.cy * 16 - 26;
      if (Math.hypot(px - g.player.x, py - g.player.y) < g.vw * 0.6) { a._arrWait = a._arrWait || {}; a._arrWait[id] = (a._arrWait[id] || 0) + 6; if (a._arrWait[id] < 24) continue; }
      const n = makeNpc(g, id, px, py); if (!n) continue; g.burst(px + 6, py + 12, 16, '#a0ffb0', 70, -20, 0.8, 2, true); n.home = r.id; g.npcs.push(n); g.stats.npcsMet++; g.say(`${n.def.name} has arrived!`, '#a0ffb0', 6); audio.sfx('npc');
    }
  }
}

export function updateNpcs(g: Game, dt: number) {
  const w = g.world; const night = isNight(g.time) || g.ev.blood;
  for (const n of g.npcs) {
    if (n.deadT > 0) {
      n.deadT -= dt;
      if (n.deadT <= 0) { const r = roomOf(g, n); n.hp = n.maxHp; n.x = r ? r.cx * 16 : w.spawn.x * 16; n.y = (r ? r.cy : w.spawn.y) * 16 - 26; n.vx = n.vy = 0; g.say(`${n.def.name} has returned.`, '#a0ffb0', 4); }
      continue;
    }
    n.t += dt; n.flash -= dt; n.hitCd -= dt; n.jumpCd -= dt;
    const r = roomOf(g, n); const hx = r ? r.cx * 16 : w.spawn.x * 16 + 28;
    let threat: { x: number; y: number } | null = null; for (const e of g.enemies) if (!e.dead && Math.abs(e.x - n.x) < 130 && Math.abs(e.y - n.y) < 60) { threat = e; break; }
    n.wait -= dt;
    if (threat) { n.tx = hx; } else if (night && r) { n.tx = hx; }
    else if (n.wait <= 0) { n.wait = 2 + rnd() * 5; n.tx = hx + (rnd() - 0.5) * (r ? 200 : 360); }
    const dx = n.tx - n.x; const sp = threat ? 78 : 42; const want = Math.abs(dx) > 8 && (n.wait < 3.5 || threat || night) ? Math.sign(dx) : 0;
    n.vx = approach(n.vx, want * sp, 600 * dt); if (want) n.dir = want; n.vy = Math.min(n.vy + 1300 * dt, 700);
    moveBody(w, n, dt, { friendly: true });
    if ((n as any).hitWall && n.onGround && n.jumpCd <= 0) { n.vy = -380; n.jumpCd = 0.5; }
    n.walk += Math.abs(n.vx) * dt * 0.1;
    if (r && Math.abs(n.x - hx) < 120 && n.hp < n.maxHp) n.hp = Math.min(n.maxHp, n.hp + dt * 3);
    if (n.y > w.H * 16) { n.y = w.spawn.y * 16 - 30; n.x = w.spawn.x * 16; }
  }
}

// ---------- objectives (interactive tutorial + guidance) ----------
export interface Objective { id: string; title: string; desc: string; check: (g: Game) => boolean; coins: number; shards: number; }
export const OBJECTIVES: Objective[] = [
  { id: 'move', title: 'Take a walk', desc: 'Use A / D (or ←/→) to run and Space to jump. Wander about 20 tiles to get a feel for the world.', check: g => g.stats.dist >= 20, coins: 50, shards: 0 },
  { id: 'wood', title: 'Gather wood', desc: 'You start with a pickaxe: walk up to a tree and hold Left Click on its trunk. Collect 15 wood.', check: g => (g.stats.collected.wood || 0) >= 15, coins: 100, shards: 0 },
  { id: 'bench', title: 'Craft a Work Bench', desc: 'Press E to open your inventory, then click “Work Bench” in the crafting list on the left.', check: g => (g.stats.crafted.workbench || 0) >= 1, coins: 100, shards: 0 },
  { id: 'place', title: 'Place the Work Bench', desc: 'Select it on your hotbar (keys 1–0 or mouse wheel) and Left Click an empty tile close to you.', check: g => (g.stats.placed[T.WORKBENCH] || 0) >= 1, coins: 100, shards: 0 },
  { id: 'stone', title: 'Dig for stone', desc: 'Hold Left Click on dirt and stone with your pickaxe to dig. Collect 30 stone.', check: g => (g.stats.collected.stone || 0) >= 30, coins: 150, shards: 0 },
  { id: 'furnace', title: 'Build a Furnace', desc: 'At a Work Bench craft a Furnace (20 stone, 4 wood, 3 torches) and place it.', check: g => (g.stats.placed[T.FURNACE] || 0) >= 1, coins: 200, shards: 1 },
  { id: 'ore', title: 'Smelt a bar', desc: 'Dig deeper for copper or iron ore (coloured flecks in stone). Stand near a Furnace and craft a bar from 3 ore.', check: g => (g.stats.crafted.copper_bar || 0) + (g.stats.crafted.iron_bar || 0) >= 1, coins: 300, shards: 0 },
  { id: 'gear', title: 'Forge & equip armor', desc: 'Make an Iron Anvil (5 iron bars, at a Work Bench), forge armor from bars, then right-click it in your inventory to equip.', check: g => g.player.armor.some(Boolean), coins: 500, shards: 1 },
  { id: 'house', title: 'Build a house', desc: 'Enclose a room of 30+ tiles with background walls, add a Door, Table, Chair and Torch. Press H to inspect rooms under your cursor. The Guide will move in!', check: g => g.npcs.some(n => n.home >= 0), coins: 800, shards: 1 },
  { id: 'crystal', title: 'Find a Life Crystal', desc: 'Pink Life Crystals glow in caves. Smash one with your pickaxe, then use it to raise your max life.', check: g => (g.stats.collected.life_crystal || 0) >= 1, coins: 500, shards: 1 },
  { id: 'eoc', title: 'Slay the Eye of Cthulhu', desc: 'Collect 6 Lens from Demon Eyes (they roam at night), craft a Suspicious Looking Eye and use it at night. Bring potions!', check: g => g.flags.eoc, coins: 2000, shards: 0 },
  { id: 'shadow', title: 'Delve into the Blight', desc: 'The purple Blight biome hides Shadowite ore in deep chasms. Smelt 4 ore into a bar (Furnace) and forge Shadow gear.', check: g => (g.stats.crafted.shadow_bar || 0) >= 1, coins: 1500, shards: 1 },
  { id: 'skel', title: 'Slay the Bone Lord', desc: 'Skeletons drop bones. At an Anvil craft a Cursed Skull (20 bones, 4 shadowite bars) and use it. Keep moving!', check: g => g.flags.skel, coins: 3000, shards: 0 },
  { id: 'hell', title: 'Reach the Underworld', desc: 'Dig down to the bottom of the world. Hellstone needs a pickaxe with 65%+ power. Beware of lava — Obsidian Skin helps!', check: g => g.flags.hell, coins: 2000, shards: 1 },
  { id: 'wof', title: 'Slay the Wall of Flesh', desc: 'Craft a Fleshy Voodoo Doll at a Hellforge (6 hellstone bars + 8 bones) and use it in the Underworld. Run, shoot, survive — this changes the world.', check: g => g.flags.wof, coins: 5000, shards: 0 },
  { id: 'hmore', title: 'Harvest Hardmode ore', desc: 'Cobalt and Adamant now lurk in the stone. Mine 10 of each (you need Molten and Cobalt pickaxes) and forge their gear at an Arcane Anvil.', check: g => (g.stats.collected.cobalt_ore || 0) >= 10 && (g.stats.collected.adamant_ore || 0) >= 10, coins: 4000, shards: 2 },
  { id: 'worm', title: 'Slay The Destroyer', desc: 'Hardmode monsters drop Soul Shards. Forge a Mechanical Worm (arcane anvil) and fight it at night.', check: g => g.flags.worm, coins: 8000, shards: 0 },
  { id: 'lunar', title: 'Defeat the Lunar Colossus', desc: 'Forge a Celestial Sigil (15 Soul Shards, 12 Adamant bars, Mechanical Core). Destroy both hands first, then the head!', check: g => g.flags.lunar, coins: 0, shards: 0 },
];
export function currentObjective(g: Game): Objective | null { return OBJECTIVES.find(o => !g.objDone[o.id]) || null; }
export function updateObjectives(g: Game, dt: number) {
  const a = g as any; a._objT = (a._objT ?? 0) - dt; if (a._objT > 0) return; a._objT = 0.5;
  for (let guard = 0; guard < 4; guard++) {
    const o = currentObjective(g); if (!o) return; if (!o.check(g)) return;
    g.objDone[o.id] = true; g.say(`Objective complete: ${o.title}`, '#ffe060', 6); audio.sfx('level');
    if (o.coins) { g.player.coins += o.coins; g.stats.coinsEarned += o.coins; }
    if (o.shards) g.award(o.shards, o.title); g.ver++;
  }
}
