// Core rules, solver and procedural level generator for the Bureau of Impossible Architecture.
// Perspective rule: only gold-rimmed "Joint" tiles fuse when they line up on screen (Escher rule).

export type Pos = { x: number; y: number; z: number };
export type Role = "none" | "start" | "goal" | "switch" | "crank" | "portal" | "pivot" | "bridge" | "arm";
export interface Tile {
  x: number;
  y: number;
  z: number;
  kind: "floor" | "stair";
  f: number; // stair facing (world dir index, climbing direction)
  joint: boolean;
  role: Role;
  idx: number;
}
export type LinkType = "illusion" | "stairs" | "bridge" | "rotor" | "portal";
export interface Spec {
  name: string;
  wing: number;
  links: LinkType[];
  insp: number;
  decoys: number;
  minPar: number;
  blurb: string;
  tips: string[];
  boss?: boolean;
}
export interface Rotor {
  pivot: Pos;
  d0: number;
  len: number;
  crank: Pos;
}
export interface Bridge {
  tiles: Pos[];
  sw: number;
}
export interface Inspector {
  route: Pos[];
  off: number;
}
export interface CamInfo {
  cx: number;
  cz: number;
  cy: number;
  ax: number;
  ymin: number;
  ymax: number;
}
export interface Level {
  id: number;
  spec: Spec;
  staticMap: Map<number, Tile>;
  tiles: Tile[];
  start: Pos;
  goal: Pos;
  bridges: Bridge[];
  switches: Pos[];
  rotors: Rotor[];
  portals: [Pos, Pos][];
  portalMap: Map<number, Pos>;
  inspectors: Inspector[];
  period: number;
  docs: Pos[];
  coffee: Pos[];
  decoyKeys: Set<number>;
  par: number;
  cells: Pos[];
  cellIndex: Map<number, number>;
  worlds: Map<number, Map<number, Tile>>;
  cam: CamInfo;
}
export interface St {
  x: number;
  y: number;
  z: number;
  mech: number;
  t: number;
}
export interface TR extends St {
  kind: "walk" | "climb" | "hop" | "portal" | "wait";
  caught: boolean;
  fx: number;
  fy: number;
  fz: number;
  landed: Tile | null;
  toggled: number; // switch index toggled or -1
  cranked: number; // rotor index cranked or -1
}

export type Rng = () => number;
export function mulberry32(a: number): Rng {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const W4: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
export const SD: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
export const K = (x: number, y: number, z: number) => ((x + 32) * 128 + (y + 32)) * 128 + (z + 32);
export const KP = (p: Pos) => K(p.x, p.y, p.z);
export function rotOff(r: number, a: number, b: number): [number, number] {
  switch (r & 3) {
    case 0:
      return [a, b];
    case 1:
      return [-b, a];
    case 2:
      return [-a, -b];
    default:
      return [b, -a];
  }
}
export function invRot(r: number, a: number, b: number): [number, number] {
  return rotOff((4 - (r & 3)) & 3, a, b);
}
export function hopOff(s: number, dy: number): [number, number] {
  switch (s) {
    case 0:
      return [dy + 1, dy];
    case 1:
      return [dy, dy + 1];
    case 2:
      return [dy - 1, dy];
    default:
      return [dy, dy - 1];
  }
}
const DY_ORDER = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
function dirIndex(dx: number, dz: number) {
  if (dx === 1) return 0;
  if (dz === 1) return 1;
  if (dx === -1) return 2;
  return 3;
}

// ---------- world (dynamic tile set) ----------
export function getWorld(L: Level, mech: number): Map<number, Tile> {
  let w = L.worlds.get(mech);
  if (w) return w;
  w = new Map(L.staticMap);
  for (const b of L.bridges) {
    if ((mech >> b.sw) & 1) {
      for (const p of b.tiles) {
        const k = KP(p);
        if (!w.has(k)) w.set(k, { x: p.x, y: p.y, z: p.z, kind: "floor", f: 0, joint: false, role: "bridge", idx: b.sw });
      }
    }
  }
  L.rotors.forEach((r, i) => {
    const st = (mech >> (3 + 2 * i)) & 3;
    const d = (r.d0 + st) & 3;
    for (let j = 1; j <= r.len; j++) {
      const x = r.pivot.x + W4[d][0] * j;
      const z = r.pivot.z + W4[d][1] * j;
      const k = K(x, r.pivot.y, z);
      if (!w!.has(k)) w!.set(k, { x, y: r.pivot.y, z, kind: "floor", f: 0, joint: false, role: "arm", idx: i });
    }
  });
  L.worlds.set(mech, w);
  return w;
}

export function inspPos(L: Level, i: number, t: number): Pos {
  const ins = L.inspectors[i];
  const n = ins.route.length;
  const per = Math.max(1, 2 * (n - 1));
  let idx = (((t + ins.off) % per) + per) % per;
  if (idx >= n) idx = per - idx;
  return ins.route[idx];
}

export function stepTarget(
  W: Map<number, Tile>,
  P: Tile,
  view: number,
  s: number,
  noHop = false
): { tile: Tile; hop: boolean } | null {
  const [dx, dz] = invRot(view, SD[s][0], SD[s][1]);
  const di = dirIndex(dx, dz);
  if (P.kind === "stair") {
    if (di === P.f) {
      const top = W.get(K(P.x + dx, P.y + 1, P.z + dz));
      return top && top.kind === "floor" ? { tile: top, hop: false } : null;
    }
    if (di === ((P.f + 2) & 3)) {
      const b = W.get(K(P.x + dx, P.y, P.z + dz));
      return b && b.kind === "floor" ? { tile: b, hop: false } : null;
    }
    return null;
  }
  const q = W.get(K(P.x + dx, P.y, P.z + dz));
  if (q) {
    if (q.kind === "stair") return q.f === di ? { tile: q, hop: false } : null;
    return { tile: q, hop: false };
  }
  const lo = W.get(K(P.x + dx, P.y - 1, P.z + dz));
  if (lo && lo.kind === "stair" && lo.f === ((di + 2) & 3)) return { tile: lo, hop: false };
  if (P.joint && !noHop) {
    for (const dy of DY_ORDER) {
      const [drx, drz] = hopOff(s, dy);
      if (Math.max(Math.abs(drx), Math.abs(drz)) < 2) continue;
      const [wx, wz] = invRot(view, drx, drz);
      const h = W.get(K(P.x + wx, P.y + dy, P.z + wz));
      if (h && h.joint) return { tile: h, hop: true };
    }
  }
  return null;
}

export function transition(L: Level, st: St, view: number, s: number, noHop = false): TR | null {
  const W = getWorld(L, st.mech);
  let nx = st.x,
    ny = st.y,
    nz = st.z;
  let mech = st.mech;
  let kind: TR["kind"] = "wait";
  let landed: Tile | null = null;
  let toggled = -1;
  let cranked = -1;
  if (s >= 0) {
    const P = W.get(K(st.x, st.y, st.z));
    if (!P) return null;
    const q = stepTarget(W, P, view, s, noHop);
    if (!q) return null;
    const T = q.tile;
    landed = T;
    kind = q.hop ? "hop" : T.y !== P.y ? "climb" : "walk";
    nx = T.x;
    ny = T.y;
    nz = T.z;
    if (T.role === "switch") {
      mech ^= 1 << T.idx;
      toggled = T.idx;
    } else if (T.role === "crank") {
      const sh = 3 + 2 * T.idx;
      const r = (mech >> sh) & 3;
      mech = (mech & ~(3 << sh)) | (((r + 1) & 3) << sh);
      cranked = T.idx;
    } else if (T.role === "portal") {
      const partner = L.portalMap.get(K(T.x, T.y, T.z));
      if (partner) {
        nx = partner.x;
        ny = partner.y;
        nz = partner.z;
        kind = "portal";
      }
    }
  }
  const nt = (st.t + 1) % L.period;
  let caught = false;
  for (let i = 0; i < L.inspectors.length; i++) {
    const a = inspPos(L, i, st.t);
    const b = inspPos(L, i, nt);
    if (b.x === nx && b.y === ny && b.z === nz) caught = true;
    else if (a.x === nx && a.y === ny && a.z === nz && b.x === st.x && b.y === st.y && b.z === st.z) caught = true;
  }
  return { x: nx, y: ny, z: nz, mech, t: nt, kind, caught, fx: st.x, fy: st.y, fz: st.z, landed, toggled, cranked };
}

// ---------- BFS solver (free view rotation: view is a free choice every move) ----------
export interface SearchOpts {
  views?: number[];
  noHop?: boolean;
  target?: Pos;
  explore?: boolean;
}
export interface SearchRes {
  found: boolean;
  acts: { view: number; s: number }[];
  cells: Set<number>;
}
export function search(L: Level, st: St, o: SearchOpts = {}): SearchRes {
  const views = o.views ?? [0, 1, 2, 3];
  const P = L.period;
  const total = L.cells.length * 128 * P;
  const parent = new Int32Array(total).fill(-2);
  const pact = new Int8Array(total);
  const queue = new Int32Array(total);
  const cells = new Set<number>();
  const goalKey = KP(L.goal);
  const targetKey = o.target ? KP(o.target) : goalKey;
  const enc = (x: number, y: number, z: number, mech: number, t: number) => {
    const ci = L.cellIndex.get(K(x, y, z));
    if (ci === undefined) return -1;
    return (ci * 128 + mech) * P + (t % P);
  };
  const sid = enc(st.x, st.y, st.z, st.mech, st.t);
  if (sid < 0) return { found: false, acts: [], cells };
  parent[sid] = -1;
  let head = 0;
  let tail = 0;
  queue[tail++] = sid;
  let foundId = -1;
  while (head < tail) {
    const id = queue[head++];
    const t = id % P;
    const rest = (id - t) / P;
    const mech = rest & 127;
    const c = L.cells[rest >> 7];
    const ck = K(c.x, c.y, c.z);
    cells.add(ck);
    if (ck === targetKey) {
      if (foundId < 0) {
        foundId = id;
        if (!o.explore) break;
      }
      continue;
    }
    if (ck === goalKey) continue;
    const cur: St = { x: c.x, y: c.y, z: c.z, mech, t };
    for (let a = -1; a < views.length * 4; a++) {
      const v = a < 0 ? 0 : views[(a / 4) | 0];
      const s = a < 0 ? -1 : a % 4;
      const n = transition(L, cur, v, s, o.noHop);
      if (!n || n.caught) continue;
      const nid = enc(n.x, n.y, n.z, n.mech, n.t);
      if (nid < 0 || parent[nid] !== -2) continue;
      parent[nid] = id;
      pact[nid] = a < 0 ? 16 : v * 4 + s;
      queue[tail++] = nid;
    }
  }
  if (foundId < 0) return { found: false, acts: [], cells };
  const acts: { view: number; s: number }[] = [];
  let id = foundId;
  while (parent[id] >= 0) {
    const a = pact[id];
    acts.push(a === 16 ? { view: -1, s: -1 } : { view: a >> 2, s: a & 3 });
    id = parent[id];
  }
  acts.reverse();
  return { found: true, acts, cells };
}

/** Joint pairs currently aligned on screen in this view (for rendering fuse-links). */
export function visibleLinks(L: Level, mech: number, view: number): [Tile, Tile][] {
  const W = getWorld(L, mech);
  const out: [Tile, Tile][] = [];
  const seen = new Set<string>();
  for (const p of W.values()) {
    if (!p.joint) continue;
    for (let s = 0; s < 4; s++) {
      const r = stepTarget(W, p, view, s);
      if (r && r.hop) {
        const a = K(p.x, p.y, p.z);
        const b = K(r.tile.x, r.tile.y, r.tile.z);
        const key = a < b ? a + "|" + b : b + "|" + a;
        if (!seen.has(key)) {
          seen.add(key);
          out.push([p, r.tile]);
        }
      }
    }
  }
  return out;
}

// ---------- campaign specs ----------
export const WINGS = [
  { name: "The Foyer", sub: "Where perspective begins" },
  { name: "Machine Rooms", sub: "Switches and sleeping bridges" },
  { name: "The Rotunda", sub: "Rotors and pneumatic tubes" },
  { name: "The Inspectorate", sub: "Mind the patrols" },
];
const S = (
  name: string,
  wing: number,
  links: LinkType[],
  insp: number,
  decoys: number,
  minPar: number,
  blurb: string,
  tips: string[] = [],
  boss = false
): Spec => ({ name, wing, links, insp, decoys, minPar, blurb, tips, boss });

export const SPECS: Spec[] = [
  S("Orientation Day", 0, ["illusion"], 0, 0, 4, "A single impossible join.", ["Gold-rimmed Joints fuse when two of them line up on screen. Rotate the building until the gap closes."]),
  S("Lost Paperwork", 0, ["illusion", "illusion"], 0, 0, 6, "Two joins in a row."),
  S("Spiral Annex", 0, ["stairs", "illusion"], 0, 1, 7, "Stairs climb. Joints bend.", ["Stairs are real. Walk onto the bottom step and climb up. Side doors are locked."]),
  S("The Long Corridor", 0, ["illusion", "illusion", "illusion"], 0, 1, 9, "Three joins, one corridor."),
  S("Mezzanine Mix-up", 0, ["stairs", "illusion", "illusion"], 0, 1, 10, "Climb, then look sideways."),
  S("Atrium Audit", 0, ["illusion", "stairs", "illusion", "illusion"], 0, 2, 12, "Wing capstone: the Atrium.", ["Coffee cups restore energy. Documents are optional, but the Bureau loves paperwork."], true),
  S("Lever Lounge", 1, ["bridge"], 0, 0, 5, "A sleeping bridge.", ["Stepping on a coloured button toggles the bridge of the same colour. Bridges can also be retracted - careful!"]),
  S("Cross the Gap", 1, ["bridge", "illusion"], 0, 0, 8, "Bridge, then bend."),
  S("Stairwell Switch", 1, ["illusion", "bridge", "stairs"], 0, 1, 10, "Three kinds of path."),
  S("Double Duty", 1, ["bridge", "bridge", "illusion"], 0, 1, 12, "Two buttons, two bridges."),
  S("Gearless Gallery", 1, ["illusion", "bridge", "illusion", "bridge"], 0, 1, 14, "Alternate and conquer."),
  S("Foundry Floor", 1, ["bridge", "illusion", "stairs", "bridge", "illusion"], 0, 2, 16, "Wing capstone: the Foundry.", [], true),
  S("First Rotation", 2, ["rotor"], 0, 0, 6, "A turning arm.", ["Step on the gear tile to turn the arm of the same colour a quarter turn."]),
  S("Spin Cycle", 2, ["rotor", "illusion"], 0, 1, 9, "Spin, then fuse."),
  S("Pneumatic Post", 2, ["portal", "illusion", "stairs"], 0, 1, 11, "Whoosh.", ["Pneumatic tubes come in pairs. Step on one and you pop out of the other."]),
  S("Carousel Hall", 2, ["rotor", "bridge", "illusion"], 0, 1, 13, "Everything turns."),
  S("Tube Network", 2, ["portal", "rotor", "illusion"], 0, 2, 15, "Mind the loop."),
  S("The Grand Rotunda", 2, ["rotor", "illusion", "portal", "bridge"], 0, 2, 18, "Wing capstone: the Rotunda.", [], true),
  S("Night Watch", 3, ["illusion", "illusion"], 1, 1, 8, "Inspectors patrol fixed routes.", ["Inspectors patrol the physical floor. They ignore illusions - use that. Press Space to wait a beat."]),
  S("Cold Tea Run", 3, ["bridge", "illusion", "stairs"], 1, 1, 10, "Time your crossings."),
  S("Surprise Inspection", 3, ["rotor", "illusion", "bridge"], 1, 2, 12, "Turn, fuse, sneak."),
  S("Double Shift", 3, ["portal", "illusion", "rotor", "illusion"], 2, 2, 14, "Two inspectors."),
  S("Red Tape Labyrinth", 3, ["bridge", "illusion", "rotor", "portal", "illusion"], 2, 2, 17, "Almost there."),
  S("The Impossible Tower", 3, ["illusion", "stairs", "bridge", "rotor", "portal", "illusion", "illusion"], 2, 3, 22, "FINAL AUDIT: the Chief Auditor's tower.", ["The Chief Auditor and his deputy patrol every floor. Use everything you have learned."], true),
];
export const LEVEL_COUNT = SPECS.length;

// ---------- generator ----------
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

interface Island {
  tiles: Tile[];
  entry: Tile | null;
  decoy: boolean;
}
interface Extras {
  bridges: Bridge[];
  switches: Pos[];
  rotors: Rotor[];
  portals: [Pos, Pos][];
  inspectors: Inspector[];
  decoyKeys: Set<number>;
}

function mkTile(x: number, y: number, z: number): Tile {
  return { x, y, z, kind: "floor", f: 0, joint: false, role: "none", idx: 0 };
}

function jointPairs(tmap: Map<number, Tile>): Set<string> {
  const res = new Set<string>();
  for (const p of tmap.values()) {
    if (!p.joint) continue;
    for (let r = 0; r < 4; r++) {
      for (let s = 0; s < 4; s++) {
        for (const dy of DY_ORDER) {
          const [drx, drz] = hopOff(s, dy);
          if (Math.max(Math.abs(drx), Math.abs(drz)) < 2) continue;
          const [wx, wz] = invRot(r, drx, drz);
          const q = tmap.get(K(p.x + wx, p.y + dy, p.z + wz));
          if (q && q.joint) {
            const a = K(p.x, p.y, p.z);
            const b = K(q.x, q.y, q.z);
            res.add(a < b ? a + "|" + b : b + "|" + a);
          }
        }
      }
    }
  }
  return res;
}
function pairKey(p: Pos, q: Pos) {
  const a = KP(p);
  const b = KP(q);
  return a < b ? a + "|" + b : b + "|" + a;
}
function sameSet(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

function computeCam(L: Level): CamInfo {
  let minX = 99,
    maxX = -99,
    minZ = 99,
    maxZ = -99,
    minY = 99,
    maxY = -99;
  for (const c of L.cells) {
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minZ = Math.min(minZ, c.z);
    maxZ = Math.max(maxZ, c.z);
    minY = Math.min(minY, c.y);
    maxY = Math.max(maxY, c.y);
  }
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const cy = (minY + maxY) / 2;
  let ax = 1,
    ymin = 99,
    ymax = -99;
  for (let a = 0; a < 24; a++) {
    const th = (a / 24) * Math.PI * 2;
    const co = Math.cos(th);
    const si = Math.sin(th);
    for (const c of L.cells) {
      for (const [ox, oz] of [
        [-0.55, -0.55],
        [0.55, -0.55],
        [0.55, 0.55],
        [-0.55, 0.55],
      ]) {
        const dx = c.x + ox - cx;
        const dz = c.z + oz - cz;
        const rx = dx * co - dz * si;
        const rz = dx * si + dz * co;
        const sx = rx - rz;
        const sy = (rx + rz) / 2 - (c.y - cy);
        ax = Math.max(ax, Math.abs(sx));
        ymin = Math.min(ymin, sy - 1.5);
        ymax = Math.max(ymax, sy + 0.7);
      }
    }
  }
  return { cx, cz, cy, ax, ymin, ymax };
}

function finish(id: number, spec: Spec, tmap: Map<number, Tile>, ex: Extras, rng: Rng, requireHopCheck: boolean): Level | null {
  let start: Pos | null = null;
  let goal: Pos | null = null;
  for (const t of tmap.values()) {
    if (t.role === "start") start = { x: t.x, y: t.y, z: t.z };
    if (t.role === "goal") goal = { x: t.x, y: t.y, z: t.z };
  }
  if (!start || !goal) return null;
  const cellsMap = new Map<number, Pos>();
  for (const t of tmap.values()) cellsMap.set(K(t.x, t.y, t.z), { x: t.x, y: t.y, z: t.z });
  for (const b of ex.bridges) for (const p of b.tiles) cellsMap.set(KP(p), { x: p.x, y: p.y, z: p.z });
  for (const r of ex.rotors)
    for (let d = 0; d < 4; d++)
      for (let j = 1; j <= r.len; j++) {
        const p = { x: r.pivot.x + W4[d][0] * j, y: r.pivot.y, z: r.pivot.z + W4[d][1] * j };
        cellsMap.set(KP(p), p);
      }
  const cells = Array.from(cellsMap.values());
  const cellIndex = new Map<number, number>();
  cells.forEach((c, i) => cellIndex.set(KP(c), i));
  let period = 1;
  for (const ins of ex.inspectors) {
    const per = Math.max(1, 2 * (ins.route.length - 1));
    period = (period * per) / gcd(period, per);
  }
  const portalMap = new Map<number, Pos>();
  for (const [a, b] of ex.portals) {
    portalMap.set(KP(a), b);
    portalMap.set(KP(b), a);
  }
  const L: Level = {
    id,
    spec,
    staticMap: tmap,
    tiles: Array.from(tmap.values()),
    start,
    goal,
    bridges: ex.bridges,
    switches: ex.switches,
    rotors: ex.rotors,
    portals: ex.portals,
    portalMap,
    inspectors: ex.inspectors,
    period,
    docs: [],
    coffee: [],
    decoyKeys: ex.decoyKeys,
    par: 0,
    cells,
    cellIndex,
    worlds: new Map(),
    cam: { cx: 0, cz: 0, cy: 0, ax: 1, ymin: -1, ymax: 1 },
  };
  for (let i = 0; i < L.inspectors.length; i++) {
    const p = inspPos(L, i, 0);
    if (p.x === start.x && p.y === start.y && p.z === start.z) return null;
  }
  const st0: St = { x: start.x, y: start.y, z: start.z, mech: 0, t: 0 };
  const res = search(L, st0, { explore: true });
  if (!res.found) return null;
  if (requireHopCheck && spec.links.includes("illusion") && search(L, st0, { noHop: true }).found) return null;
  L.par = res.acts.length;
  // docs & coffee on reachable floor tiles
  const startK = KP(start);
  const goalK = KP(goal);
  const cand = L.tiles.filter(
    (t) => t.kind === "floor" && (t.role === "none") && res.cells.has(K(t.x, t.y, t.z)) && K(t.x, t.y, t.z) !== startK && K(t.x, t.y, t.z) !== goalK
  );
  const shuffle = <T,>(a: T[]) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const dec = shuffle(cand.filter((t) => ex.decoyKeys.has(K(t.x, t.y, t.z))));
  const oth = shuffle(cand.filter((t) => !ex.decoyKeys.has(K(t.x, t.y, t.z))));
  const ordered = [...dec, ...oth];
  const used = new Set<number>();
  const take = (n: number, from: Tile[]) => {
    const out: Pos[] = [];
    for (const t of from) {
      const k = K(t.x, t.y, t.z);
      if (out.length >= n) break;
      if (used.has(k)) continue;
      used.add(k);
      out.push({ x: t.x, y: t.y, z: t.z });
    }
    return out;
  };
  L.docs = take(3, ordered);
  L.coffee = take(spec.links.length >= 3 ? 3 : 2, shuffle([...cand]));
  L.cam = computeCam(L);
  return L;
}

function genAttempt(id: number, spec: Spec, rng: Rng): Level | null {
  const nl = spec.links.length;
  const SZ = Math.max(6, Math.min(8, 5 + nl));
  const HH = Math.max(4, Math.min(6, 3 + Math.ceil(nl * 0.7)));
  const inB = (x: number, y: number, z: number) => x >= 0 && x < SZ && z >= 0 && z < SZ && y >= 0 && y < HH;
  const ri = (n: number) => Math.floor(rng() * n);
  const pick = <T,>(a: T[]): T => a[ri(a.length)];
  const tmap = new Map<number, Tile>();
  const intended = new Set<string>();
  const ex: Extras = { bridges: [], switches: [], rotors: [], portals: [], inspectors: [], decoyKeys: new Set() };
  const islands: Island[] = [];
  const size = () => 4 + ri(3);

  const okCell = (c: Pos, set: Set<number>) => {
    if (!inB(c.x, c.y, c.z)) return false;
    if (tmap.has(KP(c)) || set.has(KP(c))) return false;
    for (const [dx, dz] of W4) if (tmap.has(K(c.x + dx, c.y, c.z + dz))) return false;
    return true;
  };
  const grow = (start: Pos, n: number): Pos[] | null => {
    const set = new Set<number>();
    if (!okCell(start, set)) return null;
    const cells: Pos[] = [start];
    set.add(KP(start));
    let guard = 0;
    while (cells.length < n && guard++ < 40) {
      const src = rng() < 0.6 ? [cells[cells.length - 1]] : cells;
      const fr: Pos[] = [];
      for (const c of src)
        for (const [dx, dz] of W4) {
          const nc = { x: c.x + dx, y: c.y, z: c.z + dz };
          if (okCell(nc, set) && !fr.some((f) => f.x === nc.x && f.z === nc.z)) fr.push(nc);
        }
      if (!fr.length) continue;
      const c = pick(fr);
      cells.push(c);
      set.add(KP(c));
    }
    return cells.length >= 3 ? cells : null;
  };
  const commit = (cells: Pos[], entryIdx = 0): Island => {
    const tiles = cells.map((c) => mkTile(c.x, c.y, c.z));
    for (const t of tiles) tmap.set(K(t.x, t.y, t.z), t);
    return { tiles, entry: tiles[entryIdx] ?? null, decoy: false };
  };
  const freeTiles = (isl: Island) => isl.tiles.filter((t) => t.kind === "floor" && t.role === "none" && !t.joint && t !== isl.entry);

  const linkIllusion = (par: Island): Island | null => {
    for (let a = 0; a < 90; a++) {
      const pool = freeTiles(par);
      if (!pool.length) return null;
      const p = pick(pool);
      const r = ri(4);
      const s = ri(4);
      const dy = (rng() < 0.5 ? 1 : -1) * (1 + ri(3));
      const [drx, drz] = hopOff(s, dy);
      if (Math.max(Math.abs(drx), Math.abs(drz)) < 2) continue;
      const [wx, wz] = invRot(r, drx, drz);
      const q = { x: p.x + wx, y: p.y + dy, z: p.z + wz };
      if (!inB(q.x, q.y, q.z)) continue;
      const cells = grow(q, size());
      if (!cells) continue;
      const nt = cells.map((c) => mkTile(c.x, c.y, c.z));
      nt[0].joint = true;
      const test = new Map(tmap);
      for (const t of nt) test.set(K(t.x, t.y, t.z), t);
      const was = p.joint;
      p.joint = true;
      const key = pairKey(p, nt[0]);
      const allowed = new Set(intended);
      allowed.add(key);
      const f = stepTarget(test, p, r, s, false);
      const b = stepTarget(test, nt[0], r, (s + 2) & 3, false);
      if (!sameSet(jointPairs(test), allowed) || !f || f.tile !== nt[0] || !b || b.tile !== p) {
        p.joint = was;
        continue;
      }
      for (const t of nt) tmap.set(K(t.x, t.y, t.z), t);
      intended.add(key);
      return { tiles: nt, entry: nt[0], decoy: false };
    }
    return null;
  };

  const linkStairs = (par: Island): Island | null => {
    for (let a = 0; a < 90; a++) {
      const pool = freeTiles(par);
      if (!pool.length) return null;
      const Sx = pick(pool);
      const f = ri(4);
      const [dx, dz] = W4[f];
      const bottom = tmap.get(K(Sx.x - dx, Sx.y, Sx.z - dz));
      if (!bottom || !par.tiles.includes(bottom) || bottom.kind !== "floor") continue;
      if (tmap.has(K(Sx.x + dx, Sx.y, Sx.z + dz))) continue;
      const T = { x: Sx.x + dx, y: Sx.y + 1, z: Sx.z + dz };
      if (!inB(T.x, T.y, T.z)) continue;
      // island must stay connected without the stair tile
      const rest = par.tiles.filter((t) => t !== Sx);
      const seen = new Set<Tile>([rest[0]]);
      const stack = [rest[0]];
      while (stack.length) {
        const c = stack.pop()!;
        for (const [ax, az] of W4) {
          const n = tmap.get(K(c.x + ax, c.y, c.z + az));
          if (n && n !== Sx && rest.includes(n) && !seen.has(n)) {
            seen.add(n);
            stack.push(n);
          }
        }
      }
      if (seen.size !== rest.length) continue;
      const cells = grow(T, size());
      if (!cells) continue;
      Sx.kind = "stair";
      Sx.f = f;
      return commit(cells);
    }
    return null;
  };

  const linkBridge = (par: Island, idxPar: number): Island | null => {
    if (ex.switches.length >= 3) return null;
    for (let a = 0; a < 90; a++) {
      const pool = freeTiles(par);
      if (pool.length < 2) return null;
      const t = pick(pool);
      const d = ri(4);
      const g = 1 + ri(2);
      const [dx, dz] = W4[d];
      const [px, pz] = W4[(d + 1) & 3];
      let ok = true;
      const gap: Pos[] = [];
      for (let j = 1; j <= g; j++) {
        const c = { x: t.x + dx * j, y: t.y, z: t.z + dz * j };
        if (!inB(c.x, c.y, c.z) || tmap.has(KP(c)) || tmap.has(K(c.x + px, c.y, c.z + pz)) || tmap.has(K(c.x - px, c.y, c.z - pz))) ok = false;
        gap.push(c);
      }
      if (!ok) continue;
      const b = { x: t.x + dx * (g + 1), y: t.y, z: t.z + dz * (g + 1) };
      const cells = grow(b, size());
      if (!cells) continue;
      // switch lives on this island (or one before)
      const src = idxPar > 0 && rng() < 0.35 ? islands[idxPar - 1] : par;
      const sp = freeTiles(src).filter((x) => x !== t);
      if (!sp.length) continue;
      const sw = pick(sp);
      sw.role = "switch";
      sw.idx = ex.switches.length;
      ex.switches.push({ x: sw.x, y: sw.y, z: sw.z });
      ex.bridges.push({ tiles: gap, sw: sw.idx });
      return commit(cells);
    }
    return null;
  };

  const linkRotor = (par: Island): Island | null => {
    if (ex.rotors.length >= 2) return null;
    for (let a = 0; a < 90; a++) {
      const pool = freeTiles(par);
      if (pool.length < 2) return null;
      const P = pick(pool);
      const d0 = ri(4);
      const k = 1 + ri(3);
      const dt = (d0 + k) & 3;
      const [dx, dz] = W4[dt];
      const a1 = { x: P.x + dx, y: P.y, z: P.z + dz };
      const a2 = { x: P.x + dx * 2, y: P.y, z: P.z + dz * 2 };
      const b = { x: P.x + dx * 3, y: P.y, z: P.z + dz * 3 };
      if (tmap.has(KP(a1)) || tmap.has(KP(a2))) continue;
      const cells = grow(b, size());
      if (!cells) continue;
      const cp = pool.filter((t) => t !== P);
      const crank = pick(cp);
      const i = ex.rotors.length;
      P.role = "pivot";
      P.idx = i;
      crank.role = "crank";
      crank.idx = i;
      ex.rotors.push({ pivot: { x: P.x, y: P.y, z: P.z }, d0, len: 2, crank: { x: crank.x, y: crank.y, z: crank.z } });
      return commit(cells);
    }
    return null;
  };

  const linkPortal = (par: Island): Island | null => {
    if (ex.portals.length >= 2) return null;
    for (let a = 0; a < 90; a++) {
      const pool = freeTiles(par);
      if (!pool.length) return null;
      const p = pick(pool);
      const c = { x: ri(SZ), y: ri(HH), z: ri(SZ) };
      const cells = grow(c, size());
      if (!cells) continue;
      const isl = commit(cells, 1 + ri(cells.length - 1));
      const q = isl.entry!;
      p.role = "portal";
      p.idx = ex.portals.length;
      q.role = "portal";
      q.idx = ex.portals.length;
      ex.portals.push([
        { x: p.x, y: p.y, z: p.z },
        { x: q.x, y: q.y, z: q.z },
      ]);
      return isl;
    }
    return null;
  };

  // island 0
  let first: Island | null = null;
  for (let a = 0; a < 40 && !first; a++) {
    const cells = grow({ x: ri(SZ), y: ri(HH), z: ri(SZ) }, size());
    if (cells) first = commit(cells);
  }
  if (!first) return null;
  first.entry = null;
  islands.push(first);
  for (const link of spec.links) {
    const par = islands[islands.length - 1];
    let child: Island | null = null;
    const ip = islands.length - 1;
    if (link === "illusion") child = linkIllusion(par);
    else if (link === "stairs") child = linkStairs(par);
    else if (link === "bridge") child = linkBridge(par, ip);
    else if (link === "rotor") child = linkRotor(par);
    else child = linkPortal(par);
    if (!child) return null;
    islands.push(child);
  }
  const firstI = islands[0];
  const lastI = islands[islands.length - 1];
  const sc = freeTiles(firstI);
  if (!sc.length) return null;
  const stt = pick(sc);
  stt.role = "start";
  const entry = lastI.entry;
  const gc = freeTiles(lastI);
  if (!gc.length) return null;
  gc.sort((a, b) => {
    const da = entry ? Math.abs(a.x - entry.x) + Math.abs(a.z - entry.z) : 0;
    const db = entry ? Math.abs(b.x - entry.x) + Math.abs(b.z - entry.z) : 0;
    return db - da;
  });
  const gt = gc[ri(Math.min(2, gc.length))];
  gt.role = "goal";
  // decoys
  const chainCount = islands.length;
  for (let k = 0; k < spec.decoys; k++) {
    const base = pick(islands.slice(0, chainCount));
    const c = linkIllusion(base);
    if (c) {
      c.decoy = true;
      islands.push(c);
      for (const t of c.tiles) ex.decoyKeys.add(K(t.x, t.y, t.z));
    }
  }
  // inspectors
  for (let k = 0; k < spec.insp; k++) {
    let placed = false;
    for (let a = 0; a < 40 && !placed; a++) {
      const isl = pick(islands.slice(0, chainCount));
      const len = 3 + ri(2);
      const startT = pick(isl.tiles.filter((t) => t.kind === "floor" && t.role !== "start" && t.role !== "goal"));
      if (!startT) continue;
      const path: Tile[] = [startT];
      while (path.length < len) {
        const cur = path[path.length - 1];
        const opts: Tile[] = [];
        for (const [dx, dz] of W4) {
          const n = tmap.get(K(cur.x + dx, cur.y, cur.z + dz));
          if (n && n.kind === "floor" && n.role !== "start" && n.role !== "goal" && !path.includes(n)) opts.push(n);
        }
        if (!opts.length) break;
        path.push(pick(opts));
      }
      if (path.length < len) continue;
      const per = 2 * (len - 1);
      ex.inspectors.push({ route: path.map((t) => ({ x: t.x, y: t.y, z: t.z })), off: ri(per) });
      placed = true;
    }
  }
  return finish(id, spec, tmap, ex, rng, true);
}

function fallbackLevel(id: number, spec: Spec): Level {
  const tmap = new Map<number, Tile>();
  const add = (x: number, y: number, z: number, role: Role = "none", joint = false) => {
    const t = mkTile(x, y, z);
    t.role = role;
    t.joint = joint;
    tmap.set(K(x, y, z), t);
  };
  add(0, 0, 1, "start");
  add(1, 0, 1, "none", true);
  add(3, 1, 2, "none", true);
  add(4, 1, 2, "goal");
  add(4, 1, 3);
  add(1, 0, 2);
  const rng = mulberry32(id + 5);
  const ex: Extras = { bridges: [], switches: [], rotors: [], portals: [], inspectors: [], decoyKeys: new Set() };
  const L = finish(id, { ...spec, links: ["illusion"] }, tmap, ex, rng, false);
  return L as Level;
}

const cache = new Map<number, Level>();
export function getLevel(id: number): Level {
  const hit = cache.get(id);
  if (hit) return hit;
  const spec = SPECS[Math.max(0, Math.min(SPECS.length - 1, id))];
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  let best: Level | null = null;
  let relaxed: Level | null = null;
  for (let a = 0; a < 120; a++) {
    let L: Level | null = null;
    try {
      L = genAttempt(id, spec, mulberry32(id * 1013 + a * 7919 + 17));
    } catch {
      L = null;
    }
    if (L) {
      if (!relaxed || L.par > relaxed.par) relaxed = L;
      if (L.par >= spec.minPar) {
        best = L;
        break;
      }
    }
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    if (relaxed && now - t0 > 1400) break;
    if (now - t0 > 3500) break;
  }
  let L = best ?? relaxed;
  // degrade gracefully: drop trailing links until a solvable layout is found
  for (let n = spec.links.length - 1; !L && n >= 1; n--) {
    const reduced: Spec = { ...spec, links: spec.links.slice(0, n), decoys: Math.min(spec.decoys, 1) };
    for (let a = 0; a < 40 && !L; a++) {
      try {
        L = genAttempt(id, reduced, mulberry32(id * 733 + a * 31 + n * 7 + 3));
      } catch {
        L = null;
      }
    }
  }
  if (!L) L = fallbackLevel(id, spec);
  cache.set(id, L);
  return L;
}
