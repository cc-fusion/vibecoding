// Core simulation for Clockwork Automaton Repair.
// Three coupled networks: steam conduits, gear trains and logic signals.
//  steam -> engines -> gears -> dynamos -> signals -> gates -> valves/clutches -> steam/gears ...

export interface Piece {
  type: string;
  rot: number; // unbounded quarter turns (visual friendly); logic uses rot & 3
  fixed: boolean;
  on?: boolean; // switch state
}
export type Cell = Piece | null;

// directions: 0=N 1=E 2=S 3=W
export const DR = [-1, 0, 1, 0];
export const DC = [0, 1, 0, -1];
export const opp = (d: number) => (d + 2) & 3;

export interface Def {
  name: string;
  desc: string;
  kind: 'steam' | 'gear' | 'logic' | 'misc';
  steam?: number[];
  wire?: number[];
  sigIn?: number[];
  sigOut?: number[];
  gear?: boolean;
  target?: boolean;
  period: number; // rotational symmetry period (1,2 or 4)
}

export const DEFS: Record<string, Def> = {
  B: { name: 'Boiler', desc: 'Fixed steam source. Pressure builds while you work!', kind: 'steam', steam: [0], period: 4 },
  I: { name: 'Straight Pipe', desc: 'Carries steam straight through. Click to rotate.', kind: 'steam', steam: [0, 2], period: 2 },
  L: { name: 'Elbow Pipe', desc: 'Turns steam around a corner. Click to rotate.', kind: 'steam', steam: [0, 1], period: 4 },
  T: { name: 'Tee Pipe', desc: 'Splits steam three ways. Click to rotate.', kind: 'steam', steam: [0, 1, 3], period: 4 },
  '#': { name: 'Cross Pipe', desc: 'Four-way steam junction.', kind: 'steam', steam: [0, 1, 2, 3], period: 1 },
  P: { name: 'Piston', desc: 'Target: needs steam at its inlet to extend.', kind: 'steam', steam: [0], target: true, period: 4 },
  Q: { name: 'Steam Engine', desc: 'Turns its gear clockwise whenever steam reaches its inlet.', kind: 'gear', steam: [0], gear: true, period: 4 },
  V: { name: 'Relay Valve', desc: 'Steam passes only while its side control wire carries a signal.', kind: 'steam', steam: [0, 2], sigIn: [1], period: 4 },
  G: { name: 'Gear', desc: 'Meshes with every adjacent gear. Neighbours spin the opposite way.', kind: 'gear', gear: true, period: 1 },
  F: { name: 'Flywheel (CW)', desc: 'Target: must be spinning clockwise.', kind: 'gear', gear: true, target: true, period: 1 },
  f: { name: 'Flywheel (CCW)', desc: 'Target: must be spinning counter-clockwise.', kind: 'gear', gear: true, target: true, period: 1 },
  U: { name: 'Dynamo', desc: 'A gear that emits a signal while it is spinning.', kind: 'gear', gear: true, sigOut: [0], period: 4 },
  K: { name: 'Clutch', desc: 'A gear that only meshes while its signal input is on.', kind: 'gear', gear: true, sigIn: [0], period: 4 },
  W: { name: 'Wire', desc: 'Carries signals straight. Click to rotate.', kind: 'logic', wire: [0, 2], period: 2 },
  C: { name: 'Corner Wire', desc: 'Carries signals around a corner.', kind: 'logic', wire: [0, 1], period: 4 },
  Y: { name: 'Tee Wire', desc: 'Splits a signal three ways.', kind: 'logic', wire: [0, 1, 3], period: 4 },
  '+': { name: 'Cross Wire', desc: 'Four-way signal junction.', kind: 'logic', wire: [0, 1, 2, 3], period: 1 },
  S: { name: 'Lever Switch', desc: 'Click to flip. Starts OFF.', kind: 'logic', sigOut: [0], period: 4 },
  s: { name: 'Lever Switch', desc: 'Click to flip. Starts ON.', kind: 'logic', sigOut: [0], period: 4 },
  Z: { name: 'Sensor (OFF)', desc: 'Locked sensor reading: always OFF.', kind: 'logic', sigOut: [0], period: 4 },
  z: { name: 'Sensor (ON)', desc: 'Locked sensor reading: always ON.', kind: 'logic', sigOut: [0], period: 4 },
  A: { name: 'AND Gate', desc: 'Outputs ON only if BOTH inputs are ON. Inputs: left & right, output: front.', kind: 'logic', sigIn: [3, 1], sigOut: [0], period: 4 },
  R: { name: 'OR Gate', desc: 'Outputs ON if EITHER input is ON. Inputs: left & right, output: front.', kind: 'logic', sigIn: [3, 1], sigOut: [0], period: 4 },
  E: { name: 'XOR Gate', desc: 'Outputs ON if exactly ONE input is ON. Inputs: left & right, output: front.', kind: 'logic', sigIn: [3, 1], sigOut: [0], period: 4 },
  N: { name: 'NOT Gate', desc: 'Inverts a signal. Input: back, output: front.', kind: 'logic', sigIn: [2], sigOut: [0], period: 4 },
  M: { name: 'Lamp (must glow)', desc: 'Target: needs a signal to light up.', kind: 'logic', sigIn: [0], target: true, period: 4 },
  m: { name: 'Alarm Bell (must be silent)', desc: 'Target: must NOT receive a signal.', kind: 'logic', sigIn: [0], target: true, period: 4 },
  X: { name: 'Bolted Plate', desc: 'Immovable obstruction.', kind: 'misc', period: 1 },
};

export const MANUAL_ORDER = ['B', 'I', 'L', 'T', '#', 'P', 'V', 'Q', 'G', 'F', 'f', 'U', 'K', 'S', 'z', 'W', 'C', 'Y', 'A', 'R', 'E', 'N', 'M', 'm', 'X'];

export const r4 = (p: Piece) => ((p.rot % 4) + 4) % 4;
const rp = (base: number[] | undefined, rot: number) => (base ? base.map((d) => (d + rot) & 3) : []);

export const steamPortsOf = (p: Piece) => rp(DEFS[p.type]?.steam, r4(p));
export const sigPortsOf = (p: Piece) => {
  const d = DEFS[p.type];
  if (!d) return [] as number[];
  const r = r4(p);
  return [...rp(d.wire, r), ...rp(d.sigIn, r), ...rp(d.sigOut, r)];
};

export interface SimResult {
  R: number;
  C: number;
  steam: boolean[];
  leaks: { i: number; d: number }[];
  spin: number[]; // 1 CW, -1 CCW, 0 none
  jammed: boolean[];
  jamCount: number;
  cellSig: boolean[];
  outVal: boolean[];
  inVals: boolean[][];
  valveOpen: boolean[];
  clutchOn: boolean[];
  satisfied: boolean[];
  isTarget: boolean[];
  targetsTotal: number;
  targetsDone: number;
  allDone: boolean;
}

export function simulate(grid: Cell[], R: number, C: number): SimResult {
  const n = R * C;
  const nb = (i: number, d: number) => {
    const r = Math.floor(i / C) + DR[d];
    const c = (i % C) + DC[d];
    if (r < 0 || c < 0 || r >= R || c >= C) return -1;
    return r * C + c;
  };

  // ---- static signal nets (union-find over port nodes) ----
  const parent = Array.from({ length: n * 4 }, (_, k) => k);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  const sigPorts: number[][] = grid.map((p) => (p ? sigPortsOf(p) : []));
  for (let i = 0; i < n; i++) {
    const p = grid[i];
    if (!p) continue;
    const def = DEFS[p.type];
    if (def.wire) {
      const ports = rp(def.wire, r4(p));
      for (let k = 1; k < ports.length; k++) union(i * 4 + ports[0], i * 4 + ports[k]);
    }
    for (const d of sigPorts[i]) {
      const j = nb(i, d);
      if (j >= 0 && sigPorts[j].includes(opp(d))) union(i * 4 + d, j * 4 + opp(d));
    }
  }

  let valveOpen: boolean[] = Array(n).fill(false);
  let clutchOn: boolean[] = Array(n).fill(false);
  let gateOut: boolean[] = Array(n).fill(false);

  let steam: boolean[] = [];
  let leaks: { i: number; d: number }[] = [];
  let spin: number[] = [];
  let jammed: boolean[] = [];
  let jamCount = 0;
  let netVal: Map<number, boolean> = new Map();
  let outVal: boolean[] = [];
  let inVals: boolean[][] = [];

  for (let iter = 0; iter < 30; iter++) {
    // ---- steam ----
    steam = Array(n).fill(false);
    leaks = [];
    const queue: number[] = [];
    for (let i = 0; i < n; i++) {
      if (grid[i]?.type === 'B') {
        steam[i] = true;
        queue.push(i);
      }
    }
    while (queue.length) {
      const i = queue.pop()!;
      const p = grid[i]!;
      for (const d of steamPortsOf(p)) {
        if (p.type === 'V' && !valveOpen[i]) continue;
        const j = nb(i, d);
        const q = j >= 0 ? grid[j] : null;
        if (q && steamPortsOf(q).includes(opp(d))) {
          if (q.type === 'V' && !valveOpen[j]) continue; // blocked, not a leak
          if (!steam[j]) {
            steam[j] = true;
            queue.push(j);
          }
        } else if (p.type !== 'B') {
          leaks.push({ i, d });
        }
      }
    }

    // ---- gears ----
    const isGear = (j: number) => {
      const q = grid[j];
      if (!q) return false;
      if (!DEFS[q.type].gear) return false;
      if (q.type === 'K' && !clutchOn[j]) return false;
      return true;
    };
    const dir: number[] = Array(n).fill(0);
    const comp: number[] = Array(n).fill(-1);
    const jamComp = new Set<number>();
    let comps = 0;
    for (let e = 0; e < n; e++) {
      if (grid[e]?.type !== 'Q' || !steam[e]) continue;
      if (comp[e] !== -1) {
        if (dir[e] !== 1) jamComp.add(comp[e]);
        continue;
      }
      const id = comps++;
      dir[e] = 1;
      comp[e] = id;
      const gq = [e];
      while (gq.length) {
        const i = gq.pop()!;
        for (let d = 0; d < 4; d++) {
          const j = nb(i, d);
          if (j < 0 || !isGear(j)) continue;
          const expected = -dir[i];
          if (comp[j] === -1) {
            comp[j] = id;
            dir[j] = expected;
            gq.push(j);
          } else if (dir[j] !== expected) {
            jamComp.add(id);
          }
        }
      }
    }
    spin = Array(n).fill(0);
    jammed = Array(n).fill(false);
    for (let i = 0; i < n; i++) {
      if (comp[i] >= 0) {
        if (jamComp.has(comp[i])) jammed[i] = true;
        else spin[i] = dir[i];
      }
    }
    jamCount = jamComp.size;

    // ---- signals ----
    netVal = new Map();
    const setNet = (node: number) => netVal.set(find(node), true);
    for (let i = 0; i < n; i++) {
      const p = grid[i];
      if (!p) continue;
      const r = r4(p);
      const outPort = DEFS[p.type].sigOut ? (DEFS[p.type].sigOut![0] + r) & 3 : -1;
      if (outPort < 0) continue;
      let v = false;
      if (p.type === 'S' || p.type === 's') v = !!p.on;
      else if (p.type === 'z') v = true;
      else if (p.type === 'Z') v = false;
      else if (p.type === 'U') v = spin[i] !== 0;
      else v = gateOut[i];
      if (v) setNet(i * 4 + outPort);
    }
    const readIn = (i: number, k: number) => {
      const p = grid[i]!;
      const port = (DEFS[p.type].sigIn![k] + r4(p)) & 3;
      return netVal.get(find(i * 4 + port)) === true;
    };
    const newValve: boolean[] = Array(n).fill(false);
    const newClutch: boolean[] = Array(n).fill(false);
    const newGate: boolean[] = Array(n).fill(false);
    inVals = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      const p = grid[i];
      if (!p) continue;
      const def = DEFS[p.type];
      if (def.sigIn) {
        inVals[i] = def.sigIn.map((_, k) => readIn(i, k));
      }
      if (p.type === 'V') newValve[i] = inVals[i][0];
      else if (p.type === 'K') newClutch[i] = inVals[i][0];
      else if (p.type === 'A') newGate[i] = inVals[i][0] && inVals[i][1];
      else if (p.type === 'R') newGate[i] = inVals[i][0] || inVals[i][1];
      else if (p.type === 'E') newGate[i] = inVals[i][0] !== inVals[i][1];
      else if (p.type === 'N') newGate[i] = !inVals[i][0];
    }
    const same =
      newValve.every((v, k) => v === valveOpen[k]) &&
      newClutch.every((v, k) => v === clutchOn[k]) &&
      newGate.every((v, k) => v === gateOut[k]);
    valveOpen = newValve;
    clutchOn = newClutch;
    gateOut = newGate;
    if (same) break;
  }

  // ---- final per-cell readouts ----
  const cellSig: boolean[] = Array(n).fill(false);
  outVal = Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    const p = grid[i];
    if (!p) continue;
    const ports = sigPorts[i];
    cellSig[i] = ports.some((d) => netVal.get(find(i * 4 + d)) === true);
    const def = DEFS[p.type];
    if (def.sigOut) {
      const port = (def.sigOut[0] + r4(p)) & 3;
      outVal[i] = netVal.get(find(i * 4 + port)) === true;
    }
  }

  const satisfied: boolean[] = Array(n).fill(false);
  const isTarget: boolean[] = Array(n).fill(false);
  let targetsTotal = 0;
  let targetsDone = 0;
  for (let i = 0; i < n; i++) {
    const p = grid[i];
    if (!p || !DEFS[p.type].target) continue;
    isTarget[i] = true;
    targetsTotal++;
    let ok = false;
    switch (p.type) {
      case 'P':
        ok = steam[i];
        break;
      case 'F':
        ok = spin[i] === 1;
        break;
      case 'f':
        ok = spin[i] === -1;
        break;
      case 'M':
        ok = inVals[i][0] === true;
        break;
      case 'm':
        ok = inVals[i][0] !== true;
        break;
    }
    satisfied[i] = ok;
    if (ok) targetsDone++;
  }

  return {
    R,
    C,
    steam,
    leaks,
    spin,
    jammed,
    jamCount,
    cellSig,
    outVal,
    inVals,
    valveOpen,
    clutchOn,
    satisfied,
    isTarget,
    targetsTotal,
    targetsDone,
    allDone: targetsTotal > 0 && targetsDone === targetsTotal,
  };
}
