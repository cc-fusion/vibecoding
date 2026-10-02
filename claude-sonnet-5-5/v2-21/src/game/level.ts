// ===== Procedural level generation =====
import { rng, clamp, DISTRICTS, DIFFS, PACKAGES } from './data';
import type { SegType, PkgKind, Contract, Save, Settings } from './data';

export type SolidKind = 'plat' | 'crate' | 'wall' | 'ceil' | 'train' | 'crane';
export interface Solid { x: number; y: number; w: number; h: number; kind: SolidKind; ox: number; oy: number; ax: number; ay: number; per: number; ph: number; dx: number; dy: number; seg: number; block?: boolean }
export type EntT = 'laser' | 'trip' | 'turret' | 'drone' | 'walker' | 'term' | 'chip' | 'vent' | 'zip' | 'hint' | 'gate' | 'pad';
export interface Ent {
  t: EntT; x: number; y: number; w: number; h: number; seg: number; kind?: string;
  per?: number; ph?: number; on?: number; cd?: number; state?: number; hp?: number; min?: number; max?: number; dir?: number;
  x2?: number; y2?: number; diff?: number; text?: string; act?: string; dis?: boolean; dead?: boolean; used?: boolean; off?: number;
  hx?: number; hy?: number; chase?: boolean; scan?: number; vx?: number; vy?: number; fade?: number; lock?: number; hit?: number; tm?: number;
}
export interface SegStats { len: number; gaps: number; drops: number; lasers: number; turrets: number; cops: number; drones: number; terms: number; chips: number; walls: number; crates: number; trips: number; vents: number; peds: number; pipes: number; zips: number; flat: number; threat: number }
export interface Segment { type: SegType; name: string; x0: number; x1: number; y1: number; solids: Solid[]; ents: Ent[]; stats: SegStats }
export interface BuildCtx { tier: number; leg: number; legs: number; dens: number; hunters: number; boss: boolean; pkg: PkgKind }
export const BASE_Y = 520;

export function makeCtx(contract: Contract, leg: number, save: Save, settings: Settings): BuildCtx {
  const di = contract.district, owner = DISTRICTS[di].owner;
  const rep = owner ? save.rep[owner] : 0;
  const hunters = rep <= -60 ? 2 : rep <= -25 ? 1 : 0;
  const heatF = 1 + (save.heat[di] / 100) * 0.6 + (save.notoriety / 100) * 0.3;
  const dens = DIFFS[settings.difficulty].dens * (settings.mods.includes('rush') ? 1.4 : 1) * heatF * (rep >= 20 ? 0.92 : 1);
  return { tier: di, leg, legs: contract.legs, dens, hunters, boss: contract.boss, pkg: contract.pkg };
}

interface Cfg { pw: [number, number]; gap: [number, number]; dy: number; lead: number; feat: [string, number][] }
const CFG: Record<SegType, Cfg> = {
  rooftops: { pw: [260, 540], gap: [110, 999], dy: 120, lead: 190, feat: [['none', 3], ['crate', 2], ['wall', 1], ['trip', 1.2], ['laser', 0.8], ['turret', 1], ['cop', 1.2], ['drone', 0.7], ['vent', 0.8], ['term', 0.5]] },
  alley: { pw: [560, 960], gap: [50, 180], dy: 50, lead: 210, feat: [['none', 1.5], ['wall', 3], ['trip', 2], ['laser', 2], ['turret', 1.5], ['crate', 2], ['cop', 0.8], ['term', 0.6]] },
  market: { pw: [900, 1500], gap: [0, 90], dy: 40, lead: 230, feat: [['none', 1.5], ['ped', 3], ['crate', 2], ['cop', 2], ['drone', 1], ['trip', 0.5], ['term', 1], ['vent', 0.3]] },
  crane: { pw: [210, 340], gap: [150, 999], dy: 100, lead: 120, feat: [['none', 4], ['turret', 1.2], ['vent', 1], ['crate', 0.8], ['wall', 0.5], ['trip', 0.4], ['term', 0.5]] },
  undercity: { pw: [620, 1000], gap: [40, 150], dy: 40, lead: 210, feat: [['none', 1.5], ['pipe', 3], ['vent', 1.5], ['trip', 1.5], ['laser', 1.2], ['crate', 1.5], ['cop', 0.5], ['turret', 0.5], ['term', 0.7]] },
  maglev: { pw: [300, 480], gap: [250, 999], dy: 80, lead: 140, feat: [['none', 3], ['drone', 1.5], ['turret', 1], ['wall', 0.8], ['cop', 0.5], ['term', 0.7], ['laser', 0.6], ['vent', 0.4]] },
};
const NAMES: Record<SegType, string> = { rooftops: 'ROOFTOP RUN', alley: 'NEON ALLEY', market: 'NIGHT MARKET', crane: 'CRANE YARD', undercity: 'UNDERCITY', maglev: 'MAGLEV YARD' };
const emptyStats = (): SegStats => ({ len: 0, gaps: 0, drops: 0, lasers: 0, turrets: 0, cops: 0, drones: 0, terms: 0, chips: 0, walls: 0, crates: 0, trips: 0, vents: 0, peds: 0, pipes: 0, zips: 0, flat: 0, threat: 1 });

function mkSolid(x: number, y: number, w: number, h: number, kind: SolidKind, seg: number): Solid {
  return { x, y, w, h, kind, ox: x, oy: y, ax: 0, ay: 0, per: 1, ph: 0, dx: 0, dy: 0, seg };
}
function mkEnt(t: EntT, x: number, y: number, seg: number, extra: Partial<Ent> = {}): Ent {
  return { t, x, y, w: 0, h: 0, seg, ...extra };
}

export function buildSegment(type: SegType, seed: number, x0: number, y0: number, segIdx: number, c: BuildCtx): Segment {
  const r = rng(seed);
  const rr = (a: number, b: number) => a + (b - a) * r();
  const S: Solid[] = [], E: Ent[] = [];
  const st = emptyStats();
  const cfg = CFG[type];
  const len = 4400 + c.tier * 140 + rr(0, 500);
  const gapMax = Math.min(330, 175 + c.tier * 30 + c.leg * 6) + (type === 'maglev' ? 20 : 0);
  const pickW = (list: [string, number][]) => {
    const tot = list.reduce((a, b) => a + (b[0] === 'none' ? b[1] / Math.max(0.5, c.dens) : b[1]), 0);
    let v = r() * tot;
    for (const [k, w] of list) { v -= k === 'none' ? w / Math.max(0.5, c.dens) : w; if (v <= 0) return k; }
    return 'none';
  };
  const arc = (xa: number, xb: number, yb: number, n: number, amp: number) => {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      E.push(mkEnt('chip', xa + (xb - xa) * t, yb - Math.sin(t * Math.PI) * amp, segIdx)); st.chips++;
    }
  };
  let x = x0, y = y0;
  E.push(mkEnt('gate', x0 + 260, y0, segIdx, { text: NAMES[type], kind: type }));
  S.push(mkSolid(x, y, 460, 1400, 'plat', segIdx)); x += 460;
  let flatW = 0;
  while (x < x0 + len) {
    const gLo = Math.min(cfg.gap[0], gapMax - 20), gHi = Math.min(cfg.gap[1], gapMax);
    const gap = rr(gLo, gHi);
    const gx = x; x += gap;
    if (gap >= 100) st.gaps++;
    let ny = clamp(y + rr(-cfg.dy * 0.7, cfg.dy), 330, 600);
    if (ny < y - 80) ny = y - 80;
    if (ny - y > 90) st.drops++;
    // gap fill
    if (type === 'crane' && gap > 200 && r() < 0.75) {
      const m = mkSolid(gx + gap / 2 - 55, (y + ny) / 2 + 10, 110, 16, 'crane', segIdx);
      m.ax = Math.min(gap * 0.28, 90); m.per = rr(3, 4.5); m.ph = rr(0, 6.28); S.push(m);
    }
    if (type === 'crane' && gap > 240 && r() < 0.4) {
      E.push(mkEnt('zip', gx - 40, y - 130, segIdx, { x2: gx + gap + 40, y2: ny - 110 })); st.zips++;
    }
    if (type === 'maglev' && gap >= 200) {
      const w = clamp(gap * 0.55, 150, 260);
      const m = mkSolid(gx + gap / 2 - w / 2, Math.max(y, ny) + 14, w, 60, 'train', segIdx);
      m.ax = Math.max(10, (gap - w) / 2 * 0.7); m.per = rr(3.4, 4.6); m.ph = rr(0, 6.28); S.push(m);
    }
    if (gap > 170 && r() < 0.5) arc(gx + 20, gx + gap - 20, Math.min(y, ny) - 70, 5, 55);
    // platform
    const pw = rr(cfg.pw[0], cfg.pw[1]);
    const px = x, py = ny;
    S.push(mkSolid(px, py, pw, 1400, 'plat', segIdx));
    if (pw >= 700) flatW += pw;
    let cx = px + cfg.lead; const end = px + pw - 150;
    let termHere = false, relayDone = false;
    if (c.boss && !relayDone && px > x0 + len * 0.45 && pw >= 300 && !E.some((e) => e.t === 'term' && e.kind === 'relay')) {
      E.push(mkEnt('term', px + pw * 0.45, py, segIdx, { kind: 'relay', diff: c.tier + c.leg })); st.terms++; relayDone = true; termHere = true; cx = Math.max(cx, px + pw * 0.45 + 160);
    }
    if (r() < 0.55) arc(px + 100, px + Math.min(pw - 100, 340), py - 60, 5, 40);
    while (cx < end) {
      const k = pickW(cfg.feat);
      switch (k) {
        case 'crate': S.push(mkSolid(cx, py - 40, 40, 40, 'crate', segIdx)); st.crates++; cx += 240; break;
        case 'wall': { const h = rr(120, 240); S.push(mkSolid(cx, py - h, 60, h, 'wall', segIdx)); st.walls++; cx += 420; break; }
        case 'pipe': S.push(mkSolid(cx, py - 32 - 70, 160, 70, 'ceil', segIdx)); st.pipes++; cx += 430; break;
        case 'trip': E.push(mkEnt('trip', cx, py, segIdx)); st.trips++; cx += 270; break;
        case 'laser': E.push(mkEnt('laser', cx, py, segIdx, { h: 140, per: rr(2.2, 3), on: 0.5, ph: rr(0, 3) })); st.lasers++; cx += 380; break;
        case 'turret': E.push(mkEnt('turret', cx, py - 26, segIdx, { cd: rr(0.5, 2) })); st.turrets++; cx += 520; break;
        case 'cop': {
          if (pw < 300) { cx += 200; break; }
          const hunt = c.hunters > 0 && r() < 0.35 * c.hunters;
          E.push(mkEnt('walker', cx, py, segIdx, { kind: hunt ? 'hunter' : 'cop', min: px + 30, max: px + pw - 60, state: 0, dir: -1 })); st.cops++; cx += 430; break;
        }
        case 'ped': {
          const n = 2 + Math.floor(r() * 2);
          for (let i = 0; i < n; i++) E.push(mkEnt('walker', cx + i * 70, py, segIdx, { kind: 'ped', min: px + 20, max: px + pw - 40, state: 0, dir: -1 }));
          st.peds += n; cx += 560; break;
        }
        case 'drone': E.push(mkEnt('drone', cx, py - rr(170, 230), segIdx, { hx: cx, hy: py - rr(170, 230), ph: rr(0, 6), cd: rr(1, 2.5), hp: 1 })); st.drones++; cx += 650; break;
        case 'vent': E.push(mkEnt('vent', cx, py, segIdx, { w: 54, cd: 0 })); st.vents++; arc(cx - 40, cx + 40, py - 190, 4, 30); cx += 480; break;
        case 'term':
          if (termHere || pw < 300) { cx += 200; break; }
          { const roll = r(); const kind = roll < 0.35 ? 'grid' : roll < 0.65 ? 'cache' : roll < 0.85 ? 'calm' : 'rep';
            E.push(mkEnt('term', cx, py, segIdx, { kind, diff: c.tier + (c.leg >> 1) })); st.terms++; termHere = true; cx += 430; }
          break;
        default: cx += rr(180, 320);
      }
    }
    x += pw; y = py;
  }
  S.push(mkSolid(x, y, 520, 1400, 'plat', segIdx)); x += 520;
  st.len = x - x0; st.flat = flatW / st.len;
  const km = st.len / 1000;
  const raw = (st.lasers * 1.2 + st.turrets + st.cops * 0.8 + st.drones * 1.1 + st.gaps * 0.35 + st.walls * 0.4 + st.trips * 0.45 + st.peds * 0.15 + st.pipes * 0.3) / km;
  st.threat = clamp(Math.round(raw / 0.9), 1, 5);
  return { type, name: NAMES[type], x0, x1: x, y1: y, solids: S, ents: E, stats: st };
}

export function legMul(st: SegStats) { return 1 + (st.threat - 3) * 0.08; }

export function fitFor(pkg: PkgKind, s: SegStats): { stars: number; why: string } {
  const km = s.len / 1000;
  const grade = (v: number, a: number, b: number) => (v < a ? 3 : v < b ? 2 : 1);
  switch (pkg) {
    case 'fragile': return { stars: grade(s.drops / km + s.walls / km * 0.6, 1.4, 2.6), why: `${s.drops} drops, ${s.walls} walls — glass hates falls` };
    case 'volatile': return { stars: grade(s.flat * 10, 3.5, 6), why: `${Math.round(s.flat * 100)}% long flat roads — redline danger` };
    case 'live': return { stars: grade((s.walls + s.crates + s.peds + s.cops + s.pipes) / km, 4, 8), why: `${s.walls + s.crates + s.peds + s.pipes} slowdowns on the way` };
    case 'data': return { stars: grade((s.drones * 1.5 + s.turrets * 0.5) / km, 1.2, 2.5), why: `${s.drones} drones, ${s.turrets} turrets scanning` };
    case 'heavy': return { stars: grade(s.gaps / km, 2.2, 3.6), why: `${s.gaps} gaps — heavy jumps are weak` };
    default: return { stars: 2, why: 'Nothing special' };
  }
}
export function pkgFitLabel(pkg: PkgKind) { return PACKAGES[pkg].tip; }

// ===== Tutorial level =====
export function buildTutorial(): Segment {
  const S: Solid[] = [], E: Ent[] = [];
  const y = BASE_Y;
  const plat = (x: number, w: number) => S.push(mkSolid(x, y, w, 1400, 'plat', 0));
  const hint = (x: number, text: string, act?: string) => E.push(mkEnt('hint', x, y, 0, { text, act }));
  const st = emptyStats(); st.len = 7600;
  plat(0, 1500);
  hint(80, 'HOLD → / D to build MOMENTUM.  ← / A brakes.  Tip: higher momentum = faster, farther jumps.');
  hint(750, 'SPACE / W / ↑ — JUMP.  Hold for height, tap for a short hop.');
  E.push(mkEnt('gate', 300, y, 0, { text: 'TRAINING YARD', kind: 'rooftops' }));
  hint(1250, 'Gaps need a jump — run fast, jump at the very edge.');
  plat(1720, 1580);
  S.push(mkSolid(2150, y - 40, 40, 40, 'crate', 0));
  hint(1860, 'Low crates are auto-VAULTED when you hit them with speed. Style = combo points!');
  E.push(mkEnt('trip', 2600, y, 0));
  hint(2380, 'Tripwires raise HEAT.  SLIDE with S / ↓ to duck under them. (Tap S just before landing for a ROLL.)');
  E.push(...[0, 1, 2, 3, 4].map((i) => mkEnt('chip', 2700 + i * 40, y - 60 - Math.sin(i / 4 * Math.PI) * 40, 0)));
  S.push(mkSolid(3000, y - 190, 60, 190, 'wall', 0));
  hint(2800, 'Tall wall? HOLD JUMP into it to WALL-RUN to the top.');
  hint(3200, 'Big gap ahead! Press SHIFT / right-click to DASH in mid-air. Dash also gives brief invulnerability.');
  plat(3660, 1000);
  E.push(mkEnt('walker', 4250, y, 0, { kind: 'cop', min: 3700, max: 4600, state: 0, dir: -1 }));
  hint(3900, 'Sentinels chase you. STOMP from above, SLIDE into them, or DASH through. Touching them hurts the package.');
  plat(4780, 1300);
  E.push(mkEnt('term', 5050, y, 0, { kind: 'cache', diff: 0 }));
  hint(4850, 'Press E (or tap HACK) beside a terminal. Time slows while you crack it. Arrow keys / Space / 1-4 depending on the puzzle.');
  E.push(mkEnt('laser', 5600, y, 0, { h: 140, per: 2.6, on: 0.5, ph: 0 }));
  hint(5400, 'Laser gates blink on and off. Time them — or dash through.');
  E.push(mkEnt('vent', 5900, y, 0, { w: 54, cd: 0 }));
  hint(5750, 'Steam vents launch you skyward. Chips float above them.');
  E.push(...[0, 1, 2, 3].map((i) => mkEnt('chip', 5870 + i * 20, y - 200 - i * 12, 0)));
  plat(6200, 1500);
  hint(6260, 'HEAT draws the Sentinel PACK from behind. Keep moving — if it catches you, you are BUSTED. Q = EMP, R = Smoke Bomb.', 'heat');
  hint(6900, 'Your package integrity is your payout. Reach the drop pad to finish training!');
  return { type: 'rooftops', name: 'TRAINING YARD', x0: 0, x1: 7700, y1: y, solids: S, ents: E, stats: st };
}
