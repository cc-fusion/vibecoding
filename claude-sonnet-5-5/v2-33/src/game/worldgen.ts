import type { Game } from './engine';
import { WORLD_W, WORLD_H, FACTIONS, dist, emptyBag, bagValue, RES_LIST } from './data';
import type { Wreck, WreckKind, ResBag } from './data';

const NAMES: Record<WreckKind, string[]> = {
  hull: ['Frigate Hull', 'Destroyer Keel', 'Corvette Husk', 'Gunboat Wreck', 'Cruiser Spine'],
  cargo: ['Cargo Barge', 'Freighter Pod', 'Container Stack', 'Hauler Carcass'],
  reactor: ['Reactor Hulk', 'Fusion Tender', 'Core Barge', 'Unstable Dynamo'],
  vault: ['Data Vault', 'Archive Pod', 'Black Box Cluster', 'Cipher Hold'],
  relic: ['Relic Ship', 'Ancient Ark', 'Shrine Vessel', 'Precursor Shell'],
  leviathan: ['The Leviathan'],
};

export function makeLoot(g: Game, kind: WreckKind, scale: number): ResBag {
  const b = emptyBag();
  const R = (a: number, c: number) => g.rr(a, c) * scale;
  switch (kind) {
    case 'hull': b.scrap = R(45, 90); b.alloy = R(4, 12); break;
    case 'cargo': b.alloy = R(14, 28); b.scrap = R(8, 20); b.cores = g.rng() < 0.3 ? R(1, 2) : 0; break;
    case 'reactor': b.cores = R(7, 13); b.alloy = R(3, 8); break;
    case 'vault': b.data = R(7, 13); b.alloy = R(4, 8); b.relics = g.rng() < 0.3 ? 1 : 0; break;
    case 'relic': b.relics = R(1, 3); b.data = R(3, 6); b.alloy = R(6, 12); break;
    case 'leviathan': b.scrap = 300; b.alloy = 160; b.cores = 40; b.data = 50; b.relics = 14; break;
  }
  for (const r of RES_LIST) b[r] = Math.round(b[r]);
  return b;
}

export function spawnWreck(g: Game, kind: WreckKind, x: number, y: number, special: Wreck['special'] = '', lootOverride?: ResBag, radius?: number, mass?: number): Wreck {
  let r = 20, m = 50;
  switch (kind) {
    case 'hull': r = g.rr(22, 34); m = g.rr(40, 110); break;
    case 'cargo': r = g.rr(16, 26); m = g.rr(25, 60); break;
    case 'reactor': r = g.rr(20, 28); m = g.rr(60, 120); break;
    case 'vault': r = g.rr(24, 32); m = g.rr(80, 150); break;
    case 'relic': r = g.rr(28, 38); m = g.rr(120, 200); break;
    case 'leviathan': r = 120; m = 600; break;
  }
  if (radius) r = radius;
  if (mass) m = mass;
  const scale = 1 + 0.1 * Math.max(0, Math.min(g.sector, 8) - 1);
  const loot = lootOverride ?? makeLoot(g, kind, scale);
  const pts: number[] = [];
  const n = kind === 'leviathan' ? 16 : 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rad = r * (0.66 + g.rng() * 0.34);
    pts.push(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  const names = NAMES[kind];
  const w: Wreck = {
    id: g.nextId++, x, y, vx: g.rr(-4, 4), vy: g.rr(-4, 4), rot: g.rr(0, 6.28), rv: g.rr(-0.15, 0.15), r, mass: m, kind,
    name: kind === 'leviathan' ? 'The Leviathan' : `${names[Math.floor(g.rng() * names.length)]} ${Math.floor(g.rr(100, 999))}`,
    loot, value0: Math.max(1, bagValue(loot)), revealed: false, owner: -1, instab: 0, tugs: [], pts, special, poached: [], fade: 0,
    speed: 0, leader: -1, cutting: 0, stalled: false,
  };
  g.wrecks.push(w);
  g.wreckMap.set(w.id, w);
  return w;
}

export function addGuards(g: Game, w: Wreck) {
  const mines = g.rng() < 0.4;
  const k = 1 + Math.floor(g.rng() * 3);
  if (mines) {
    for (let i = 0; i < k + 2; i++) {
      const a = g.rng() * Math.PI * 2;
      const d = w.r + 70 + g.rng() * 50;
      g.spawn('mine', 4, w.x + Math.cos(a) * d, w.y + Math.sin(a) * d, 'guard');
    }
  } else {
    const a0 = g.rng() * Math.PI * 2;
    for (let i = 0; i < k; i++) {
      const a = a0 + (i / k) * Math.PI * 2;
      g.spawn('sentry', 4, w.x + Math.cos(a) * (w.r + 55), w.y + Math.sin(a) * (w.r + 55), 'guard');
    }
  }
}

export function generateSector(g: Game) {
  const sd = g.sd;
  const st = g.station;
  const bases = [1, 2, 3].map((f) => FACTIONS[f]);
  const lair = FACTIONS[4];
  const LEV = { x: 2750, y: 1650 };
  let tries = 0;
  let n = 0;
  while (n < sd.wrecks && tries < 5000) {
    tries++;
    const x = g.rr(170, WORLD_W - 170), y = g.rr(170, WORLD_H - 170);
    if (dist(x, y, st.x, st.y) < 230) continue;
    if (bases.some((b) => dist(x, y, b.bx, b.by) < 300)) continue;
    if (dist(x, y, lair.bx, lair.by) < 420) continue;
    if (sd.boss && dist(x, y, LEV.x, LEV.y) < 480) continue;
    if (g.wrecks.some((w) => dist(x, y, w.x, w.y) < 120)) continue;
    const d = dist(x, y, st.x, st.y) / 1900;
    const roll = g.rng();
    let kind: WreckKind;
    if (d < 0.35) kind = roll < 0.5 ? 'hull' : roll < 0.85 ? 'cargo' : 'reactor';
    else if (d < 0.7) kind = roll < 0.3 ? 'hull' : roll < 0.55 ? 'cargo' : roll < 0.8 ? 'reactor' : 'vault';
    else kind = roll < 0.15 ? 'hull' : roll < 0.3 ? 'cargo' : roll < 0.5 ? 'reactor' : roll < 0.75 ? 'vault' : 'relic';
    const w = spawnWreck(g, kind, x, y);
    n++;
    let near = -1, nd = 700;
    for (const b of bases) { const dd = dist(x, y, b.bx, b.by); if (dd < nd) { nd = dd; near = b.id; } }
    if (near > 0 && g.rng() < 0.6) w.owner = near;
    if (sd.guarded > 0 && d > 0.35 && (kind === 'vault' || kind === 'relic' || kind === 'reactor' || kind === 'cargo') && g.rng() < sd.guarded * (kind === 'cargo' ? 0.8 : 1.6)) addGuards(g, w);
  }
  for (const w of g.wrecks) if (dist(w.x, w.y, st.x, st.y) < 650) w.revealed = true;
  for (const b of bases) {
    for (let i = 0; i < sd.rivalTugs; i++) {
      const s = g.spawn('tug', b.id, b.bx + g.rr(-90, 90), b.by + g.rr(-90, 90), b.id === 3 && i % 2 === 0 ? 'thief' : 'salvage');
      s.name = b.tag;
    }
    for (let i = 0; i < sd.rivalGuns; i++) {
      const s = g.spawn('gunship', b.id, b.bx + g.rr(-90, 90), b.by + g.rr(-90, 90), 'guard');
      s.name = b.tag;
    }
  }
  if (sd.boss) {
    const lev = spawnWreck(g, 'leviathan', LEV.x, LEV.y, 'leviathan');
    lev.revealed = true;
    lev.rv = 0.02;
    lev.vx = 0; lev.vy = 0;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      g.spawn('sentry', 4, LEV.x + Math.cos(a) * 230, LEV.y + Math.sin(a) * 230, 'guard');
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.spawn('mine', 4, LEV.x + Math.cos(a) * 340, LEV.y + Math.sin(a) * 340, 'guard');
    }
    const boss = g.spawn('boss', 4, LEV.x + 120, LEV.y + 120, 'boss');
    boss.name = 'MAW';
    g.bossId = boss.id;
    g.markExplored(LEV.x, LEV.y, 380);
    g.msg('Long-range sensors have located the Leviathan to the south-east. MAW guards it.', '#ffd36e');
  }
}
