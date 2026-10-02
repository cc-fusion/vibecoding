import type { Cam, Door, GuardDef, HeistDef, Laser, LockKind, LootCat, LootItem, P, Room, Safe, Terminal, Thing, World, Loot } from './types';
import { LOOT_NAMES } from './data';

export interface Rng { f: () => number; i: (a: number, b: number) => number; pick: <T>(a: T[]) => T; shuffle: <T>(a: T[]) => T[] }

export function makeRng(seed: number): Rng {
  let a = seed | 0;
  const f = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const i = (lo: number, hi: number) => lo + Math.floor(f() * (hi - lo + 1));
  const pick = <T,>(arr: T[]) => arr[Math.floor(f() * arr.length)];
  const shuffle = <T,>(arr: T[]) => {
    const o = arr.slice();
    for (let k = o.length - 1; k > 0; k--) {
      const j = Math.floor(f() * (k + 1));
      [o[k], o[j]] = [o[j], o[k]];
    }
    return o;
  };
  return { f, i, pick, shuffle };
}

/* ---------- Pathfinding (Dijkstra to any goal, 8-neighbour) ---------- */
class Heap {
  k: number[] = [];
  v: number[] = [];
  get size() { return this.k.length; }
  push(key: number, val: number) {
    let i = this.k.length;
    this.k.push(key); this.v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.k[p] <= this.k[i]) break;
      [this.k[p], this.k[i]] = [this.k[i], this.k[p]];
      [this.v[p], this.v[i]] = [this.v[i], this.v[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const rk = this.k[0], rv = this.v[0];
    const lk = this.k.pop()!, lv = this.v.pop()!;
    const n = this.k.length;
    if (n > 0) {
      this.k[0] = lk; this.v[0] = lv;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < n && this.k[l] < this.k[m]) m = l;
        if (r < n && this.k[r] < this.k[m]) m = r;
        if (m === i) break;
        [this.k[m], this.k[i]] = [this.k[i], this.k[m]];
        [this.v[m], this.v[i]] = [this.v[i], this.v[m]];
        i = m;
      }
    }
    return [rk, rv];
  }
}

export function findPath(w: number, h: number, sx: number, sy: number, goals: number[], cost: (i: number) => number): P[] | null {
  if (!goals.length) return null;
  const n = w * h;
  const dist = new Float32Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const gs = new Set(goals);
  const s = sy * w + sx;
  if (s < 0 || s >= n) return null;
  dist[s] = 0;
  const hp = new Heap();
  hp.push(0, s);
  while (hp.size) {
    const [d, i] = hp.pop();
    if (d > dist[i]) continue;
    if (gs.has(i)) {
      const out: P[] = [];
      let c = i;
      while (c !== s && c >= 0) { out.push({ x: (c % w) + 0.5, y: Math.floor(c / w) + 0.5 }); c = prev[c]; }
      return out.reverse();
    }
    const x = i % w, y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        const c = cost(ni);
        if (c < 0) continue;
        if (dx && dy && (cost(y * w + nx) < 0 || cost(ny * w + x) < 0)) continue;
        const nd = d + c * (dx && dy ? 1.414 : 1);
        if (nd < dist[ni]) { dist[ni] = nd; prev[ni] = i; hp.push(nd, ni); }
      }
    }
  }
  return null;
}

/* ---------- World generation ---------- */
interface BN { r: { x: number; y: number; w: number; h: number }; a?: BN; b?: BN; room?: Room }

function split(n: BN, rng: Rng, min: number, depth: number) {
  const { w, h } = n.r;
  const canV = w >= min * 2, canH = h >= min * 2;
  if (!canV && !canH) return;
  if (depth > 1 && w * h < min * min * 4.5 && rng.f() < 0.3) return;
  const vertical = canV && (!canH || (w / h > 1.2 ? true : h / w > 1.2 ? false : rng.f() < 0.5));
  if (vertical) {
    const s = rng.i(min, w - min);
    n.a = { r: { x: n.r.x, y: n.r.y, w: s, h } };
    n.b = { r: { x: n.r.x + s, y: n.r.y, w: w - s, h } };
  } else {
    const s = rng.i(min, h - min);
    n.a = { r: { x: n.r.x, y: n.r.y, w, h: s } };
    n.b = { r: { x: n.r.x, y: n.r.y + s, w, h: h - s } };
  }
  split(n.a, rng, min, depth + 1);
  split(n.b, rng, min, depth + 1);
}

export const tc = (t: { x: number; y: number }): P => ({ x: t.x + 0.5, y: t.y + 0.5 });

export function genWorld(def: HeistDef, extraGuards: number): World {
  const rng = makeRng(def.seed);
  const { w, h } = def;
  const tiles = new Uint8Array(w * h);
  const roomId = new Int16Array(w * h);
  const rooms: Room[] = [];
  const root: BN = { r: { x: 0, y: 0, w, h } };
  split(root, rng, 7, 0);

  const mkRooms = (n: BN) => {
    if (n.a && n.b) { mkRooms(n.a); mkRooms(n.b); return; }
    const r = n.r;
    const rw = rng.i(Math.min(4, r.w - 2), r.w - 2), rh = rng.i(Math.min(4, r.h - 2), r.h - 2);
    const rx = r.x + 1 + rng.i(0, r.w - 2 - rw), ry = r.y + 1 + rng.i(0, r.h - 2 - rh);
    const room: Room = { id: rooms.length, x: rx, y: ry, w: rw, h: rh, name: '', dark: false, kind: 'room' };
    rooms.push(room);
    n.room = room;
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) { tiles[y * w + x] = 1; roomId[y * w + x] = room.id + 1; }
  };
  mkRooms(root);

  const carve = (ax: number, ay: number, bx: number, by: number) => {
    const hz = rng.f() < 0.5;
    const set = (x: number, y: number) => { if (tiles[y * w + x] === 0) tiles[y * w + x] = 1; };
    if (hz) {
      for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) set(x, ay);
      for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) set(bx, y);
    } else {
      for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) set(ax, y);
      for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) set(x, by);
    }
  };
  const conn = (n: BN): Room[] => {
    if (!n.a || !n.b) return [n.room!];
    const ra = conn(n.a), rb = conn(n.b);
    const A = rng.pick(ra), B = rng.pick(rb);
    carve(A.x + (A.w >> 1), A.y + (A.h >> 1), B.x + (B.w >> 1), B.y + (B.h >> 1));
    return ra.concat(rb);
  };
  conn(root);

  const T = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : tiles[y * w + x]);
  const R = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : roomId[y * w + x]);

  // door candidates
  const cand: { x: number; y: number; vert: boolean; room: number }[] = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (tiles[y * w + x] !== 1 || roomId[y * w + x] !== 0) continue;
    if (T(x - 1, y) && T(x + 1, y) && !T(x, y - 1) && !T(x, y + 1) && (R(x - 1, y) || R(x + 1, y))) cand.push({ x, y, vert: true, room: (R(x - 1, y) || R(x + 1, y)) - 1 });
    else if (T(x, y - 1) && T(x, y + 1) && !T(x - 1, y) && !T(x + 1, y) && (R(x, y - 1) || R(x, y + 1))) cand.push({ x, y, vert: false, room: (R(x, y - 1) || R(x, y + 1)) - 1 });
  }
  const ents: number[] = rooms.map(() => 0);
  cand.forEach(c => { ents[c.room]++; });

  // BFS distance from entrance room
  const e0 = rooms[0];
  let sIdx = -1;
  for (let y = e0.y; y < e0.y + e0.h && sIdx < 0; y++) for (let x = e0.x; x < e0.x + e0.w; x++) { sIdx = y * w + x; break; }
  const bfs = (): { dist: Int32Array; count: number } => {
    const dist = new Int32Array(w * h).fill(-1);
    const q = [sIdx];
    dist[sIdx] = 0;
    let count = 1;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % w, y = (i - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (tiles[ni] !== 1 || dist[ni] >= 0) continue;
        dist[ni] = dist[i] + 1; count++; q.push(ni);
      }
    }
    return { dist, count };
  };
  const { dist } = bfs();
  let vault = -1, best = -1;
  const pickVault = (deadEnd: boolean) => {
    rooms.forEach(r => {
      if (r.id === 0 || (deadEnd && ents[r.id] !== 1)) return;
      const d = dist[(r.y + (r.h >> 1)) * w + r.x + (r.w >> 1)];
      if (d > best) { best = d; vault = r.id; }
    });
  };
  pickVault(true);
  if (vault < 0) pickVault(false);
  if (vault < 0) vault = rooms.length - 1;

  const things: Thing[] = [];
  let nid = 1;
  const doorAt = new Map<number, Door>();
  const mkDoor = (c: { x: number; y: number; vert: boolean }, lock: LockKind, isVault: boolean) => {
    const d: Door = { kind: 'door', id: nid++, x: c.x, y: c.y, vert: c.vert, lock, locked: lock !== 'none', open: 0, tampered: false, vault: isVault };
    doorAt.set(c.y * w + c.x, d);
    things.push(d);
  };
  cand.filter(c => c.room === vault).forEach(c => { if (!doorAt.has(c.y * w + c.x)) mkDoor(c, def.vaultLock, true); });
  const [m0, m1, m2] = def.lockMix;
  cand.forEach(c => {
    if (c.room === vault || doorAt.has(c.y * w + c.x)) return;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => doorAt.has((c.y + dy) * w + c.x + dx));
    if (near || rng.f() > 0.88) return;
    const r = rng.f();
    let lock: LockKind = r < m0 ? 'pick' : r < m0 + m1 ? 'hack' : r < m0 + m1 + m2 ? 'breach' : 'none';
    if (c.room === 0) lock = 'none';
    mkDoor(c, lock, false);
  });

  // naming / lighting
  const names = rng.shuffle(def.names);
  rooms.forEach((r, i) => {
    r.name = r.id === 0 ? 'Loading Dock' : r.id === vault ? def.vaultName : names[i % names.length];
    r.dark = r.id !== 0 && r.id !== vault && rng.f() < 0.35;
    r.kind = r.id === 0 ? 'dock' : r.id === vault ? 'vault' : 'room';
  });

  // furniture
  let floorCount = 0;
  for (let i = 0; i < tiles.length; i++) if (tiles[i] === 1) floorCount++;
  const nearDoor = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (doorAt.has((y + dy) * w + x + dx)) return true;
    return false;
  };
  rooms.forEach(r => {
    if (r.id === 0) return;
    const tries = Math.floor((r.w * r.h) / 7);
    for (let k = 0; k < tries; k++) {
      const x = rng.i(r.x, r.x + r.w - 1), y = rng.i(r.y, r.y + r.h - 1);
      const i = y * w + x;
      if (tiles[i] !== 1 || roomId[i] !== r.id + 1) continue;
      if (!(x === r.x || x === r.x + r.w - 1 || y === r.y || y === r.y + r.h - 1)) continue;
      if (nearDoor(x, y)) continue;
      let bad = false;
      for (let dy = -1; dy <= 1 && !bad; dy++) for (let dx = -1; dx <= 1; dx++) {
        const t = T(x + dx, y + dy);
        if (t === 2 || (t === 1 && R(x + dx, y + dy) === 0)) { bad = true; break; }
      }
      if (bad) continue;
      tiles[i] = 2;
      if (bfs().count !== floorCount - 1) tiles[i] = 1; else floorCount--;
    }
  });

  // placement helpers
  const used = new Set<number>();
  const freeIn = (room: Room): P | null => {
    for (let k = 0; k < 60; k++) {
      const x = rng.i(room.x, room.x + room.w - 1), y = rng.i(room.y, room.y + room.h - 1), i = y * w + x;
      if (tiles[i] !== 1 || roomId[i] !== room.id + 1 || used.has(i) || nearDoor(x, y)) continue;
      used.add(i);
      return { x, y };
    }
    return null;
  };
  const anyIn = (room: Room): P => {
    for (let k = 0; k < 60; k++) {
      const x = rng.i(room.x, room.x + room.w - 1), y = rng.i(room.y, room.y + room.h - 1);
      if (tiles[y * w + x] === 1) return { x: x + 0.5, y: y + 0.5 };
    }
    return { x: room.x + 0.5, y: room.y + 0.5 };
  };
  const inner = rooms.filter(r => r.id !== 0 && r.id !== vault);
  const pool = inner.length ? inner : rooms;
  const scale = 0.7 + def.fee / 9000;
  const genItem = (cat: LootCat): LootItem => {
    const t = rng.pick(LOOT_NAMES[cat]);
    return { name: t.n, cat, value: Math.round((rng.i(t.v[0], t.v[1]) * scale) / 10) * 10, weight: t.w, icon: t.icon };
  };

  // van & spawns
  const vanRoom = rooms[0];
  const floors: P[] = [];
  for (let y = vanRoom.y; y < vanRoom.y + vanRoom.h; y++) for (let x = vanRoom.x; x < vanRoom.x + vanRoom.w; x++) if (tiles[y * w + x] === 1) floors.push({ x, y });
  floors.sort((a, b) => a.x + a.y - (b.x + b.y));
  const vanT = floors[0];
  used.add(vanT.y * w + vanT.x);
  const spawns = floors.slice(1).sort((a, b) => Math.hypot(a.x - vanT.x, a.y - vanT.y) - Math.hypot(b.x - vanT.x, b.y - vanT.y)).slice(0, 6).map(tc);
  floors.forEach(f => used.add(f.y * w + f.x));

  // vault contents
  const vr = rooms[vault];
  const vp = freeIn(vr) ?? { x: vr.x, y: vr.y };
  const vSafe: Safe = { kind: 'safe', id: nid++, x: vp.x, y: vp.y, tier: Math.min(3, 1 + Math.floor(def.fee / 3000)), stages: def.vaultStages, stage: 0, opened: false, contents: [{ ...def.prime }], vault: true };
  things.push(vSafe);
  for (let k = 0; k < 2; k++) {
    const p = freeIn(vr);
    if (p) things.push({ kind: 'loot', id: nid++, x: p.x, y: p.y, item: genItem(rng.pick(def.pool)), taken: false } as Loot);
  }

  // safes, loot, terminals
  for (let k = 0; k < def.safes; k++) {
    const p = freeIn(rng.pick(pool));
    if (!p) continue;
    const contents = [genItem(rng.pick(def.pool))];
    if (rng.f() < 0.4) contents.push(genItem(rng.pick(def.pool)));
    things.push({ kind: 'safe', id: nid++, x: p.x, y: p.y, tier: 1 + (rng.f() < 0.4 ? 1 : 0) + (def.fee > 5000 ? 1 : 0), stages: 1, stage: 0, opened: false, contents, vault: false } as Safe);
  }
  for (let k = 0; k < def.loose; k++) {
    const p = freeIn(rng.pick(pool));
    if (p) things.push({ kind: 'loot', id: nid++, x: p.x, y: p.y, item: genItem(rng.pick(def.pool)), taken: false } as Loot);
  }
  def.terminals.forEach(effect => {
    const p = freeIn(rng.pick(pool));
    if (p) things.push({ kind: 'terminal', id: nid++, x: p.x, y: p.y, effect, done: false } as Terminal);
  });

  // cameras
  const camRooms = rng.shuffle(rooms.filter(r => r.id !== 0));
  for (let k = 0; k < def.cams; k++) {
    const r = camRooms[k % camRooms.length];
    for (let t = 0; t < 30; t++) {
      const side = rng.i(0, 3);
      let x = 0, y = 0, base = 0;
      if (side === 0) { x = rng.i(r.x + 1, r.x + r.w - 2); y = r.y - 1; base = Math.PI / 2; }
      else if (side === 1) { x = rng.i(r.x + 1, r.x + r.w - 2); y = r.y + r.h; base = -Math.PI / 2; }
      else if (side === 2) { x = r.x - 1; y = rng.i(r.y + 1, r.y + r.h - 2); base = 0; }
      else { x = r.x + r.w; y = rng.i(r.y + 1, r.y + r.h - 2); base = Math.PI; }
      if (T(x, y) !== 0 || things.some(o => o.kind === 'camera' && o.x === x && o.y === y)) continue;
      const cam: Cam = { kind: 'camera', id: nid++, x, y, base, sweep: 0.7, speed: 0.5 + rng.f() * 0.4, phase: rng.f() * 6, fov: 1.05, range: 7.5, off: 0, sus: 0, cool: 0, ang: base };
      things.push(cam);
      break;
    }
  }

  // lasers
  const lasers: Laser[] = [];
  const lr = rng.shuffle(pool.filter(r => r.w >= 5 || r.h >= 5));
  for (let k = 0; k < def.lasers && k < lr.length; k++) {
    const r = lr[k];
    const horiz = r.w >= r.h;
    for (let t = 0; t < 12; t++) {
      const tl: P[] = [];
      if (horiz) { const y = rng.i(r.y, r.y + r.h - 1); for (let x = r.x; x < r.x + r.w; x++) if (tiles[y * w + x] === 1) tl.push({ x, y }); }
      else { const x = rng.i(r.x, r.x + r.w - 1); for (let y = r.y; y < r.y + r.h; y++) if (tiles[y * w + x] === 1) tl.push({ x, y }); }
      if (tl.length >= 3 && !tl.some(p => nearDoor(p.x, p.y) && false) && !tl.some(p => things.some(o => o.kind !== 'door' && o.x === p.x && o.y === p.y))) {
        lasers.push({ id: nid++, tiles: tl, period: 4 + rng.f() * 1.5, onT: 2.6, phase: rng.f() * 5, off: 0 });
        break;
      }
    }
  }

  // guards
  const guards: GuardDef[] = [];
  const mkRoute = (n: number, includeDock: boolean): P[] => {
    const rs = rng.shuffle(includeDock ? rooms.filter(r => r.id !== vault) : pool).slice(0, Math.max(2, n));
    return rs.map(anyIn);
  };
  const addG = (type: GuardDef['type'], route: P[]) => guards.push({ id: nid++, type, x: route[0].x, y: route[0].y, route });
  for (let k = 0; k < def.guards + extraGuards; k++) addG('guard', mkRoute(rng.i(3, 4), rng.f() < 0.25));
  for (let k = 0; k < def.sentinels; k++) addG('sentinel', [anyIn(rng.pick(pool))]);
  for (let k = 0; k < def.k9; k++) addG('k9', mkRoute(5, true));
  for (let k = 0; k < def.drones; k++) addG('drone', mkRoute(4, true));
  if (def.captain) {
    const vc = { x: vr.x + vr.w / 2, y: vr.y + vr.h / 2 };
    const near = pool.slice().sort((a, b) => Math.hypot(a.x - vc.x, a.y - vc.y) - Math.hypot(b.x - vc.x, b.y - vc.y)).slice(0, 3);
    addG('captain', near.map(anyIn));
  }

  return { w, h, tiles, roomId, rooms, things, lasers, guards, spawns, van: tc(vanT), vaultRoom: vault, def };
}
