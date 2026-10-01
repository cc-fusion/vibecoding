import { Cell, DEFS, DR, DC, opp } from './engine';

export interface LevelDef {
  id: string;
  name: string;
  patient: string;
  blurb: string;
  tip: string;
  rows: string[];
  decoys: Record<string, number>;
  time: number; // seconds until the boiler bursts with no leaks
}

export interface Parsed {
  R: number;
  C: number;
  solution: Cell[];
  start: Cell[];
  tray: Record<string, number>;
}

export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Token format: <type><rot><flag>   flag: '*' bolted (fixed), '^' pre-installed but loose (scrambled), none = from tray
export function parseLevel(def: LevelDef, seed = 1): Parsed {
  const R = def.rows.length;
  const rows = def.rows.map((r) => r.trim().split(/\s+/));
  const C = rows[0].length;
  const solution: Cell[] = [];
  const start: Cell[] = [];
  const tray: Record<string, number> = {};
  const rnd = mulberry32(seed * 977 + 13);
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const tok = rows[r][c];
      if (!tok || tok === '..') {
        solution.push(null);
        start.push(null);
        continue;
      }
      const type = tok[0];
      const rot = parseInt(tok[1], 10) || 0;
      const flag = tok[2] || '';
      const on = type === 's';
      solution.push({ type, rot, fixed: flag === '*', on });
      if (flag === '*') {
        start.push({ type, rot, fixed: true, on });
      } else if (flag === '^') {
        const period = DEFS[type].period;
        let off = 0;
        if (period === 2) off = rnd() < 0.5 ? 1 : 3;
        else if (period === 4) off = 1 + Math.floor(rnd() * 3);
        start.push({ type, rot: rot + off, fixed: false, on });
      } else {
        start.push(null);
        tray[type] = (tray[type] || 0) + 1;
      }
    }
  }
  for (const [k, v] of Object.entries(def.decoys)) tray[k] = (tray[k] || 0) + v;
  return { R, C, solution, start, tray };
}

export const LEVELS: LevelDef[] = [
  {
    id: 'L1',
    name: 'Tin Tinker',
    patient: 'RUSTY, Tin Tinker',
    blurb: "Rusty's boiler roars, but the steam never reaches his piston arm. Connect the pipework before the boiler bursts!",
    tip: 'Pick a part from the tray, then click an empty tile. Click a placed part to rotate it. Right-click salvages it.',
    rows: ['B1* I1^ L2^ .. ..', '.. .. I0 .. ..', '.. .. L0 I1 P3*'],
    decoys: {},
    time: 75,
  },
  {
    id: 'L2',
    name: 'Brass Butler',
    patient: 'JEEVES-9, Brass Butler',
    blurb: 'Jeeves has TWO pistons for pouring tea and both are dry. Use a Tee pipe to split the steam. Mind the leaks: open pipe ends make the boiler heat faster!',
    tip: 'A pipe that carries steam but points at nothing is a leak. Leaks speed up the pressure gauge.',
    rows: ['.. L1 I1 I1^ P3*', '.. I0 .. .. ..', 'B1* T3^ .. .. ..', '.. L0^ I1 I1 P3*'],
    decoys: { L: 1, T: 1 },
    time: 90,
  },
  {
    id: 'L3',
    name: 'Cogsworth',
    patient: 'COGSWORTH, Clockwork Clerk',
    blurb: "A steam engine drives Cogsworth's gear train. Gears mesh with every neighbour and reverse its direction. Deliver clockwork to the clockwise flywheel around the plate.",
    tip: 'Adjacent gears spin opposite ways. The CCW flywheel is already turning; the CW one needs a gear route around the bolted plate. Gears do not rotate, so click one to pick it up.',
    rows: ['.. .. G0 G0 G0 ..', 'B1* Q3* G0 X0* G0 F0*', '.. f0* .. .. .. ..'],
    decoys: { G: 1 },
    time: 100,
  },
  {
    id: 'L4',
    name: 'Switchboard Sam',
    patient: 'SAM, Telegraph Operator',
    blurb: "Sam's steam line passes through a relay valve that opens only when it gets a signal. Wire the lever switch to the valve, then flip the lever.",
    tip: 'Signals travel along copper wires. Click the lever switch to flip it on. The valve control input is on its side.',
    rows: ['B1* I1 I1^ V1* I1^ P3*', '.. .. .. W0 .. ..', '.. S1* W1 C3^ .. ..'],
    decoys: { C: 1, L: 1 },
    time: 100,
  },
  {
    id: 'L5',
    name: 'Gatekeeper Gus',
    patient: 'GUS, Logic Sentry',
    blurb: "Gus's eyes are lamps wired to locked sensors. Lamps need the right logic gate between sensor and bulb. Sensor readings can't be changed, so pick your gates well.",
    tip: 'Gates take two inputs on their sides and output at the front. A NOT gate has one input at its back. Sensors: lit = ON, dark = OFF.',
    rows: ['z1* W1 C2^ .. ..', '.. .. R1 W1 M3*', 'Z1* W1 C3^ .. ..', '.. .. .. .. ..', 'Z1* W1 N1 W1 M3*'],
    decoys: { A: 1, E: 1, Y: 1 },
    time: 120,
  },
  {
    id: 'L6',
    name: 'Dynamo Dolly',
    patient: 'DOLLY, Dancing Doll',
    blurb: "Dolly's engine turns a dynamo, which should light her lamp AND open the valve that feeds her piston. A full chain: steam to gears to signal to steam.",
    tip: 'A dynamo emits a signal whenever it spins. Use a Tee wire to split one signal to two places.',
    rows: ['B1* I1 Q3* G0 G0 U2*', '.. .. .. C1^ W1 Y3^', '.. .. .. W0 .. M0*', 'B1* I1 I1^ V3* I1 P3*'],
    decoys: { G: 1, T: 1 },
    time: 150,
  },
  {
    id: 'L7',
    name: 'Clutch Colonel',
    patient: 'COLONEL BRASSBOTTOM',
    blurb: "The Colonel's drive train is disengaged by a clutch that needs a signal. The only signal on hand is a sensor reading OFF. Invert it, and get both flywheels turning the right way.",
    tip: 'A clutch only meshes while its signal input is ON. NOT gates flip signals.',
    rows: ['Z1* N1 W1 W1 C2^ ..', 'B1* Q3* G0 G0 K0* F0*', '.. .. .. f0* .. ..'],
    decoys: { A: 1, R: 1, G: 1 },
    time: 110,
  },
  {
    id: 'L8',
    name: 'The Grand Orrery',
    patient: 'ORRERY PRIME, Grand Automaton',
    blurb: 'The finale. Two boilers, a dynamo, an AND gate and a relay valve guard two pistons. Everything is connected to everything. Repair the Grand Orrery!',
    tip: 'The AND gate wants BOTH the dynamo signal and the locked sensor. Gate output is on its front. Trace each network separately.',
    rows: [
      'B1* Q3* G0 G0 U1* C2^',
      '.. .. P2* C1 W1 A3',
      '.. .. I0 W0 .. z0*',
      '.. .. V0* C3^ .. ..',
      'B1* I1 T0 I1 I1 P3*',
    ],
    decoys: { R: 1, E: 1, N: 1, L: 1, Y: 1 },
    time: 220,
  },
];

// ---------------- Overtime (procedural pipe shifts) ----------------

const PATIENTS = [
  'TICKER', 'SPROCKET', 'BELLOWS', 'WHISTLE', 'GRUMBLE', 'COPPERTOP', 'DOUBLEDIAL', 'PISTONPETE',
  'LADY LATCH', 'SIR RIVET', 'MADAM MAINSPRING', 'BOLTWIN', 'CLANKER', 'ZEPHYR', 'ROOK-77', 'WIDGET',
];

function shapeOf(mask: number): { type: string; rot: number } {
  const dirs = [0, 1, 2, 3].filter((d) => mask & (1 << d));
  if (dirs.length === 4) return { type: '#', rot: 0 };
  if (dirs.length === 3) {
    const missing = [0, 1, 2, 3].find((d) => !(mask & (1 << d)))!;
    return { type: 'T', rot: (missing + 2) & 3 };
  }
  if (dirs.length === 2) {
    if (mask === 5) return { type: 'I', rot: 0 };
    if (mask === 10) return { type: 'I', rot: 1 };
    if (mask === 3) return { type: 'L', rot: 0 };
    if (mask === 6) return { type: 'L', rot: 1 };
    if (mask === 12) return { type: 'L', rot: 2 };
    return { type: 'L', rot: 3 }; // 9
  }
  return { type: 'I', rot: 0 };
}

function saw(
  start: number,
  goal: number,
  blocked: Set<number>,
  R: number,
  C: number,
  rnd: () => number,
  extra: number
): number[] | null {
  const gr = Math.floor(goal / C);
  const gc = goal % C;
  const dist = (i: number) => Math.abs(Math.floor(i / C) - gr) + Math.abs((i % C) - gc);
  const maxLen = dist(start) + extra;
  const visited = new Set<number>([start]);
  const path = [start];
  let steps = 0;
  const dfs = (i: number): boolean => {
    if (i === goal) return true;
    if (++steps > 4000) return false;
    if (path.length - 1 >= maxLen) return false;
    const r = Math.floor(i / C);
    const c = i % C;
    const opts: { j: number; k: number }[] = [];
    for (let d = 0; d < 4; d++) {
      const rr = r + DR[d];
      const cc = c + DC[d];
      if (rr < 0 || cc < 0 || rr >= R || cc >= C) continue;
      const j = rr * C + cc;
      if (visited.has(j)) continue;
      if (blocked.has(j) && j !== goal) continue;
      opts.push({ j, k: dist(j) + rnd() * 2.4 });
    }
    opts.sort((a, b) => a.k - b.k);
    for (const o of opts) {
      visited.add(o.j);
      path.push(o.j);
      if (dfs(o.j)) return true;
      path.pop();
    }
    return false;
  };
  return dfs(start) ? path.slice() : null;
}

export function generateShift(shift: number): LevelDef {
  const rnd = mulberry32(shift * 7919 + Math.floor(Math.random() * 1e7));
  const C = Math.min(9, 5 + Math.floor(shift / 2));
  const R = Math.min(6, 4 + Math.floor(shift / 3));
  const nP = Math.min(3, 1 + Math.floor((shift - 1) / 2));
  const idx = (r: number, c: number) => r * C + c;

  for (let attempt = 0; attempt < 80; attempt++) {
    const mask: number[] = Array(R * C).fill(0);
    const used = new Set<number>();
    const ends = new Set<number>();
    const link = (a: number, b: number) => {
      for (let d = 0; d < 4; d++) {
        const r = Math.floor(a / C) + DR[d];
        const c = (a % C) + DC[d];
        if (r >= 0 && c >= 0 && r < R && c < C && idx(r, c) === b) {
          mask[a] |= 1 << d;
          mask[b] |= 1 << opp(d);
        }
      }
    };
    const boiler = idx(Math.floor(rnd() * R), 0);
    used.add(boiler);
    ends.add(boiler);
    let ok = true;
    for (let k = 0; k < nP && ok; k++) {
      // choose piston location
      const cands: number[] = [];
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const i = idx(r, c);
        if (used.has(i)) continue;
        if (k === 0 ? c === C - 1 : c === C - 1 || r === 0 || r === R - 1) {
          if (c > 1) cands.push(i);
        }
      }
      if (!cands.length) { ok = false; break; }
      const goal = cands[Math.floor(rnd() * cands.length)];
      // choose start
      let startCell = boiler;
      if (k > 0) {
        const mids = [...used].filter((i) => !ends.has(i));
        if (!mids.length) { ok = false; break; }
        startCell = mids[Math.floor(rnd() * mids.length)];
      }
      const blocked = new Set<number>(used);
      blocked.delete(startCell);
      const path = saw(startCell, goal, blocked, R, C, rnd, 6 + Math.floor(shift / 2));
      if (!path || path.length < 3) { ok = false; break; }
      for (let q = 0; q + 1 < path.length; q++) link(path[q], path[q + 1]);
      for (const p of path) used.add(p);
      ends.add(goal);
    }
    if (!ok) continue;

    const mids = [...used].filter((i) => !ends.has(i));
    if (mids.length < 3) continue;
    const plain = new Set<number>();
    for (const i of mids) if (rnd() < 0.62) plain.add(i);
    if (plain.size === 0) plain.add(mids[0]);
    if (plain.size === mids.length) plain.delete(mids[mids.length - 1]);

    const rows: string[] = [];
    const decoys: Record<string, number> = { L: 1, I: 1 };
    if (shift >= 3) decoys.T = 1;
    for (let r = 0; r < R; r++) {
      const toks: string[] = [];
      for (let c = 0; c < C; c++) {
        const i = idx(r, c);
        if (used.has(i)) {
          const m = mask[i];
          if (ends.has(i)) {
            const d = [0, 1, 2, 3].find((dd) => m & (1 << dd))!;
            toks.push((i === boiler ? 'B' : 'P') + d + '*');
          } else {
            const s = shapeOf(m);
            toks.push(s.type + s.rot + (plain.has(i) ? '' : '^'));
          }
        } else if (rnd() < Math.min(0.28, 0.1 + shift * 0.02)) {
          toks.push('X0*');
        } else toks.push('..');
      }
      rows.push(toks.join(' '));
    }
    const time = Math.round(Math.max(50, Math.min(190, (34 + mids.length * 7) * (1 - Math.min(0.3, shift * 0.02)))));
    return {
      id: 'OT' + shift,
      name: `Overtime Shift ${shift}`,
      patient: PATIENTS[Math.floor(rnd() * PATIENTS.length)] + ' (rush job)',
      blurb: `Rush order #${shift}: ${nP} piston${nP > 1 ? 's' : ''} to connect. The boss wants it done yesterday.`,
      tip: 'Overtime shifts are procedurally generated pipe puzzles. One burst boiler ends your shift!',
      rows,
      decoys,
      time,
    };
  }
  // fallback: simple straight line
  return {
    id: 'OT' + shift,
    name: `Overtime Shift ${shift}`,
    patient: 'SPROCKET (rush job)',
    blurb: 'Rush order. A simple straight line this time.',
    tip: 'Rotate pipes with a click.',
    rows: ['B1* I1^ I1 I1 P3*', '.. .. .. .. ..', '.. .. .. .. ..', '.. .. .. .. ..'],
    decoys: { L: 1 },
    time: 70,
  };
}
