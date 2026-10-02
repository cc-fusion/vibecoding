import { Tpl, LOOT, rng32 } from './data';

export const T_FLOOR = 0, T_WALL = 1, T_STREET = 2, T_DOOR = 3;

export interface Pt { x: number; y: number }
export interface Door { id: number; x: number; y: number; lock: number; open: boolean; openT: number; vault: boolean; sealed: boolean; broken: boolean; rooms: [number, number] }
export interface Term { id: number; x: number; y: number; kind: string; hacked: boolean; room: number }
export interface Cam { id: number; x: number; y: number; a: number; sweep: number; speed: number; phase: number; range: number; fov: number; room: number; off: number; emp: number; susp: number; cool: number; alertT: number; ang: number }
export interface Laser { id: number; cells: Pt[]; period: number; duty: number; phase: number; solid: boolean; room: number }
export interface LootObj { id: number; x: number; y: number; kind: string; taken: boolean; hidden: boolean; value: number; safe: number }
export interface Safe { id: number; x: number; y: number; lock: number; opened: boolean; room: number }
export interface Panel { id: number; x: number; y: number; room: number; disabled: boolean }
export interface GuardSpec { id: number; type: 'guard' | 'heavy' | 'drone' | 'civilian' | 'warden'; x: number; y: number; route: Pt[]; post: boolean; dir: number }
export interface Room { id: number; x: number; y: number; w: number; h: number; cells: Pt[]; light: number; name: string; role: string }

export interface World {
  tpl: Tpl; w: number; h: number; bh: number;
  tiles: Uint8Array; roomOf: Int16Array; doorAt: Int16Array; laserAt: Int16Array;
  rooms: Room[]; doors: Door[]; terms: Term[]; cams: Cam[]; lasers: Laser[]; loot: LootObj[]; safes: Safe[]; panels: Panel[];
  guards: GuardSpec[]; van: Pt; front: Pt; vaultRoom: number; secRoom: number; entRoom: number; adj: number[][]; par: number;
}

export interface BuildOpts { guardMul: number; extraGuards: number; extraHeavy: number; mod: string; lootMul: number }

export function buildWorld(tpl: Tpl, seed: number, o: BuildOpts): World {
  for (let a = 0; a < 40; a++) {
    const w = tryBuild(tpl, seed + a * 7919, o);
    if (w) return w;
  }
  // very unlikely fallback: simpler layout
  const simple = { ...tpl, rooms: Math.max(3, tpl.rooms - 3) };
  for (let a = 0; a < 80; a++) {
    const w = tryBuild(simple, seed + 99991 + a * 31, o);
    if (w) return w;
  }
  throw new Error('map generation failed');
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function tryBuild(tpl: Tpl, seed: number, o: BuildOpts): World | null {
  const rnd = rng32(seed);
  const W = tpl.w, H = tpl.h, BH = H - 3;
  const tiles = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles[y * W + x] = y >= BH ? T_STREET : (x > 0 && x < W - 1 && y > 0 && y < BH - 1 ? T_FLOOR : T_WALL);

  // --- BSP
  type R = { x: number; y: number; w: number; h: number };
  const leaves: R[] = [{ x: 1, y: 1, w: W - 2, h: BH - 2 }];
  const splits: { v: boolean; p: number; a: number; b: number }[] = [];
  const M = 4;
  while (leaves.length < tpl.rooms) {
    let bi = -1, ba = 0;
    leaves.forEach((r, i) => { if ((r.w >= 2 * M + 1 || r.h >= 2 * M + 1) && r.w * r.h > ba) { ba = r.w * r.h; bi = i; } });
    if (bi < 0) break;
    const r = leaves[bi];
    const canV = r.w >= 2 * M + 1, canH = r.h >= 2 * M + 1;
    const v = canV && canH ? (r.w / r.h > 1.15 ? true : r.h / r.w > 1.15 ? false : rnd() < 0.5) : canV;
    if (v) {
      const p = r.x + M + Math.floor(rnd() * (r.w - 2 * M));
      for (let y = r.y; y < r.y + r.h; y++) tiles[y * W + p] = T_WALL;
      splits.push({ v: true, p, a: r.y, b: r.y + r.h - 1 });
      leaves.splice(bi, 1, { x: r.x, y: r.y, w: p - r.x, h: r.h }, { x: p + 1, y: r.y, w: r.x + r.w - 1 - p, h: r.h });
    } else {
      const p = r.y + M + Math.floor(rnd() * (r.h - 2 * M));
      for (let x = r.x; x < r.x + r.w; x++) tiles[p * W + x] = T_WALL;
      splits.push({ v: false, p, a: r.x, b: r.x + r.w - 1 });
      leaves.splice(bi, 1, { x: r.x, y: r.y, w: r.w, h: p - r.y }, { x: r.x, y: p + 1, w: r.w, h: r.y + r.h - 1 - p });
    }
  }

  // --- doors
  const doors: Door[] = [];
  const lockFor = () => {
    if (tpl.tier === 0) return 0;
    if (rnd() < 0.3) return 0;
    const mx = Math.min(3, 1 + Math.floor(tpl.tier / 1.5));
    return 1 + Math.floor(rnd() * mx);
  };
  const addDoor = (x: number, y: number, lock: number) => {
    tiles[y * W + x] = T_DOOR;
    doors.push({ id: doors.length, x, y, lock, open: lock === 0, openT: 0, vault: false, sealed: false, broken: false, rooms: [-1, -1] });
  };
  const isFloor = (x: number, y: number) => tiles[y * W + x] === T_FLOOR;
  for (let si = splits.length - 1; si >= 0; si--) {
    const s = splits[si];
    const n = 1 + ((s.b - s.a) > 9 && rnd() < 0.6 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const cands: number[] = [];
      for (let t = s.a; t <= s.b; t++) {
        const x = s.v ? s.p : t, y = s.v ? t : s.p;
        if (tiles[y * W + x] !== T_WALL) continue;
        const ax = s.v ? x - 1 : x, ay = s.v ? y : y - 1, bx = s.v ? x + 1 : x, by = s.v ? y : y + 1;
        if (!isFloor(ax, ay) || !isFloor(bx, by)) continue;
        const px = s.v ? x : x - 1, py = s.v ? y - 1 : y, qx = s.v ? x : x + 1, qy = s.v ? y + 1 : y;
        if (tiles[py * W + px] === T_DOOR || tiles[qy * W + qx] === T_DOOR) continue;
        cands.push(t);
      }
      let t: number;
      if (cands.length) t = cands[Math.floor(rnd() * cands.length)];
      else if (k === 0) {
        t = Math.floor((s.a + s.b) / 2);
        const x = s.v ? s.p : t, y = s.v ? t : s.p;
        if (s.v) { tiles[y * W + x - 1] = T_FLOOR; tiles[y * W + x + 1] = T_FLOOR; } else { tiles[(y - 1) * W + x] = T_FLOOR; tiles[(y + 1) * W + x] = T_FLOOR; }
      } else break;
      addDoor(s.v ? s.p : t, s.v ? t : s.p, lockFor());
    }
  }

  // --- rooms
  const roomOf = new Int16Array(W * H).fill(-1);
  for (let y = BH; y < H; y++) for (let x = 0; x < W; x++) roomOf[y * W + x] = -2;
  const rooms: Room[] = [];
  for (let y = 0; y < BH; y++) for (let x = 0; x < W; x++) {
    if (tiles[y * W + x] !== T_FLOOR || roomOf[y * W + x] !== -1) continue;
    const id = rooms.length;
    const cells: Pt[] = [];
    const stack = [{ x, y }];
    roomOf[y * W + x] = id;
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = c.x + dx, ny = c.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= BH) continue;
        if (tiles[ny * W + nx] === T_FLOOR && roomOf[ny * W + nx] === -1) { roomOf[ny * W + nx] = id; stack.push({ x: nx, y: ny }); }
      }
    }
    let x0 = 999, y0 = 999, x1 = -1, y1 = -1;
    for (const c of cells) { x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x); y1 = Math.max(y1, c.y); }
    rooms.push({ id, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, cells, light: 1, name: 'Room', role: 'room' });
  }
  if (rooms.length < 2) return null;
  const rof = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : roomOf[y * W + x]);
  for (const d of doors) {
    const hz = tiles[d.y * W + d.x - 1] !== T_WALL && tiles[d.y * W + d.x + 1] !== T_WALL;
    d.rooms = hz ? [rof(d.x - 1, d.y), rof(d.x + 1, d.y)] : [rof(d.x, d.y - 1), rof(d.x, d.y + 1)];
    if (d.rooms[0] < 0 || d.rooms[1] < 0) return null;
  }

  // --- front door
  const bottom = rooms.filter(r => r.cells.some(c => c.y === BH - 2) && r.cells.length >= 6);
  if (!bottom.length) return null;
  const entRoom = bottom[Math.floor(rnd() * bottom.length)].id;
  const fcells = rooms[entRoom].cells.filter(c => c.y === BH - 2 && c.x > 1 && c.x < W - 2);
  if (!fcells.length) return null;
  const fc = fcells[Math.floor(rnd() * fcells.length)];
  addDoor(fc.x, BH - 1, tpl.tier >= 2 ? 1 : 0);
  doors[doors.length - 1].rooms = [entRoom, -2];
  const front = { x: fc.x, y: BH - 1 };
  const van = { x: fc.x, y: BH + 1 };

  // --- graph
  const buildAdj = () => {
    const a: number[][] = rooms.map(() => []);
    for (const d of doors) { const [p, q] = d.rooms; if (p >= 0 && q >= 0 && p !== q) { if (!a[p].includes(q)) a[p].push(q); if (!a[q].includes(p)) a[q].push(p); } }
    return a;
  };
  let adj = buildAdj();
  const dist = new Array(rooms.length).fill(-1);
  dist[entRoom] = 0;
  const q = [entRoom];
  while (q.length) { const r = q.shift()!; for (const n of adj[r]) if (dist[n] < 0) { dist[n] = dist[r] + 1; q.push(n); } }
  if (dist.some(d => d < 0)) return null;

  // --- vault
  let vaultRoom = -1;
  if (tpl.vault) {
    const cand = rooms.filter(r => r.id !== entRoom && r.cells.length >= 9);
    const leaf = cand.filter(r => adj[r.id].length === 1);
    const pool = leaf.length ? leaf : cand;
    if (!pool.length) return null;
    pool.sort((a, b) => dist[b.id] - dist[a.id] || b.cells.length - a.cells.length);
    const top = pool.filter(r => dist[r.id] === dist[pool[0].id]);
    vaultRoom = top[Math.floor(rnd() * top.length)].id;
    const vd = doors.filter(d => d.rooms[0] === vaultRoom || d.rooms[1] === vaultRoom);
    if (adj[vaultRoom].length === 1) {
      vd.slice(1).forEach(d => { tiles[d.y * W + d.x] = T_WALL; (d as any).remove = true; });
    }
    vd.filter(d => !(d as any).remove).forEach(d => { d.lock = 4; d.vault = true; d.open = false; });
  }
  const kept = doors.filter(d => !(d as any).remove);
  kept.forEach((d, i) => { d.id = i; });
  doors.length = 0; doors.push(...kept);
  adj = buildAdj();
  if (tpl.id === 'training') doors.forEach((d, i) => { if (d.rooms[1] !== -2) { d.lock = i === 0 ? 1 : 0; d.open = d.lock === 0; } });

  const doorAt = new Int16Array(W * H).fill(-1);
  doors.forEach(d => { doorAt[d.y * W + d.x] = d.id; });

  // --- roles & names
  const names = shuffle(tpl.roomNames, rnd);
  let ni = 0;
  const others = rooms.filter(r => r.id !== entRoom && r.id !== vaultRoom);
  let secRoom = -1;
  if (others.length) {
    const big = others.filter(r => r.cells.length >= 9);
    const pool = (big.length ? big : others).slice().sort((a, b) => dist[b.id] - dist[a.id]);
    secRoom = pool[Math.floor(rnd() * Math.min(2, pool.length))].id;
  }
  rooms.forEach(r => {
    if (r.id === entRoom) { r.name = tpl.roomNames[0]; r.role = 'entrance'; r.light = 1; }
    else if (r.id === vaultRoom) { r.name = 'Vault'; r.role = 'vault'; r.light = 0.6; }
    else if (r.id === secRoom) { r.name = 'Security Office'; r.role = 'security'; r.light = 0.8; }
    else { r.name = names[ni++ % names.length]; const l = rnd(); r.light = (l < 0.55 ? 1 : l < 0.88 ? 0.65 : 0.4) * (o.mod === 'night' ? 0.7 : 1); r.role = 'room'; }
  });

  // --- placement helpers
  const occ = new Set<number>();
  const isWall = (x: number, y: number) => tiles[y * W + x] === T_WALL;
  const nearDoor = (x: number, y: number) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (tiles[(y + dy) * W + x + dx] === T_DOOR) return true; return false; };
  const isEdge = (c: Pt) => isWall(c.x - 1, c.y) || isWall(c.x + 1, c.y) || isWall(c.x, c.y - 1) || isWall(c.x, c.y + 1);
  const isCorner = (c: Pt) => (isWall(c.x - 1, c.y) || isWall(c.x + 1, c.y)) && (isWall(c.x, c.y - 1) || isWall(c.x, c.y + 1));
  const pick = (rid: number, opt: { edge?: boolean; corner?: boolean } = {}): Pt | null => {
    const r = rooms[rid];
    const tries = [opt, opt.corner ? { edge: true } : {}, {}];
    for (const t of tries as { edge?: boolean; corner?: boolean }[]) {
      const cs = r.cells.filter(c => !occ.has(c.y * W + c.x) && !nearDoor(c.x, c.y) && (!t.edge || isEdge(c)) && (!t.corner || isCorner(c)));
      if (cs.length) { const c = cs[Math.floor(rnd() * cs.length)]; occ.add(c.y * W + c.x); return c; }
    }
    return null;
  };
  const pickIn = (ids: number[], opt: { edge?: boolean; corner?: boolean } = {}) => {
    for (const id of shuffle(ids, rnd)) { const c = pick(id, opt); if (c) return { c, id }; }
    return null;
  };
  const allIds = rooms.map(r => r.id);
  const nonVault = allIds.filter(i => i !== vaultRoom);
  const roamPool = nonVault.filter(i => i !== entRoom || rooms.length < 4);

  // lasers
  const lasers: Laser[] = [];
  const laserAt = new Int16Array(W * H).fill(-1);
  const antechamber = vaultRoom >= 0 ? adj[vaultRoom][0] : -1;
  const laserRooms = shuffle(nonVault.filter(i => i !== entRoom && (rooms[i].w >= 5 || rooms[i].h >= 5)), rnd);
  if (antechamber >= 0 && antechamber !== entRoom && laserRooms.includes(antechamber)) { laserRooms.splice(laserRooms.indexOf(antechamber), 1); laserRooms.unshift(antechamber); }
  for (const rid of laserRooms) {
    if (lasers.length >= tpl.lasers) break;
    const r = rooms[rid];
    const vert = r.w >= r.h;
    const pos = vert ? r.x + 1 + Math.floor(rnd() * Math.max(1, r.w - 2)) : r.y + 1 + Math.floor(rnd() * Math.max(1, r.h - 2));
    const cells: Pt[] = [];
    if (vert) { for (let y = r.y; y < r.y + r.h; y++) if (tiles[y * W + pos] === T_FLOOR && roomOf[y * W + pos] === rid && !occ.has(y * W + pos)) cells.push({ x: pos, y }); }
    else { for (let x = r.x; x < r.x + r.w; x++) if (tiles[pos * W + x] === T_FLOOR && roomOf[pos * W + x] === rid && !occ.has(pos * W + x)) cells.push({ x, y: pos }); }
    if (cells.length < 3) continue;
    const id = lasers.length;
    const period = 3.2 + rnd() * 1.6;
    lasers.push({ id, cells, period, duty: 0.5, phase: rnd() * period, solid: !!tpl.solid || (tpl.tier >= 2 && rnd() < 0.35), room: rid });
    cells.forEach(c => { occ.add(c.y * W + c.x); laserAt[c.y * W + c.x] = id; });
  }

  // terminals
  const terms: Term[] = [];
  const addTerm = (kind: string, rid: number) => {
    const c = pick(rid, { edge: true });
    if (c) terms.push({ id: terms.length, x: c.x, y: c.y, kind, hacked: false, room: rid });
  };
  for (const kind of tpl.terms) {
    let rid: number;
    if (kind === 'cams') rid = secRoom >= 0 ? secRoom : nonVault[0];
    else if (kind === 'vault') rid = antechamber >= 0 && antechamber !== entRoom ? antechamber : (roamPool[0] ?? 0);
    else { const pool = roamPool.filter(i => i !== secRoom); rid = pool.length ? pool[Math.floor(rnd() * pool.length)] : secRoom; }
    if (rid < 0) rid = 0;
    addTerm(kind, rid);
  }
  // alarm panels
  const panels: Panel[] = [];
  if (tpl.tier > 0) {
    const np = 2 + Math.floor(rooms.length / 5);
    const prooms = shuffle(roamPool, rnd);
    for (let i = 0; i < np && i < prooms.length; i++) { const c = pick(prooms[i], { edge: true }); if (c) panels.push({ id: panels.length, x: c.x, y: c.y, room: prooms[i], disabled: false }); }
  }
  // cameras
  const cams: Cam[] = [];
  const nc = tpl.cams + (o.mod === 'tight' ? 2 : 0);
  const crooms = shuffle(allIds, rnd);
  for (let i = 0; i < nc; i++) {
    const rid = crooms[i % crooms.length];
    const c = pick(rid, { corner: true });
    if (!c) continue;
    const r = rooms[rid];
    const a = Math.atan2(r.y + r.h / 2 - c.y, r.x + r.w / 2 - c.x);
    cams.push({ id: cams.length, x: c.x, y: c.y, a, sweep: 0.75, speed: 0.5 + rnd() * 0.5, phase: rnd() * 6, range: 7, fov: 0.85, room: rid, off: 0, emp: 0, susp: 0, cool: 0, alertT: 0, ang: a });
  }

  // loot
  const loot: LootObj[] = [];
  const safes: Safe[] = [];
  const addLoot = (kind: string, rid: number, mul: number, hidden = false, c0?: Pt) => {
    const c = c0 ?? pick(rid, { edge: rnd() < 0.6 });
    if (!c) return null;
    const l: LootObj = { id: loot.length, x: c.x, y: c.y, kind, taken: false, hidden, value: Math.round(LOOT[kind].value * mul * o.lootMul / 10) * 10, safe: -1 };
    loot.push(l);
    return l;
  };
  const lmul = o.mod === 'rich' ? 1.35 : 1;
  for (const spec of tpl.loot) {
    for (let i = 0; i < spec.n; i++) {
      if (spec.where === 'vault' && vaultRoom >= 0) addLoot(spec.kind, vaultRoom, lmul);
      else { const p = pickIn(roamPool.length ? roamPool : allIds, { edge: rnd() < 0.5 }); if (p) addLoot(spec.kind, p.id, lmul, false, p.c); }
    }
  }
  const safeKinds = Array.from(new Set(tpl.loot.map(l => l.kind).filter(k => k !== 'core')));
  const saferooms = vaultRoom >= 0 ? [vaultRoom, ...shuffle(roamPool, rnd)] : shuffle(roamPool, rnd);
  for (let i = 0; i < tpl.safes && i < saferooms.length + 2; i++) {
    const rid = i < 1 ? saferooms[0] : saferooms[(i % saferooms.length)];
    const c = pick(rid, { edge: true });
    if (!c) continue;
    const sid = safes.length;
    const lock = Math.min(4, Math.max(1, Math.ceil(tpl.tier * 0.8) + (rnd() < 0.4 ? 1 : 0)));
    safes.push({ id: sid, x: c.x, y: c.y, lock, opened: false, room: rid });
    const kind = safeKinds[Math.floor(rnd() * safeKinds.length)] ?? 'cash';
    const l = addLoot(kind, rid, 1.5 * lmul, true, c);
    if (l) l.safe = sid;
  }

  // guards
  const specs: GuardSpec[] = [];
  const route = (k: number, pool: number[]): Pt[] => {
    const rs = shuffle(pool, rnd).slice(0, Math.max(1, Math.min(k, pool.length)));
    return rs.map(id => { const r = rooms[id]; return r.cells[Math.floor(rnd() * r.cells.length)]; });
  };
  const addG = (type: GuardSpec['type'], rt: Pt[], post: boolean) => {
    const p = rt[0];
    const r = rooms[rof(p.x, p.y)] ?? rooms[0];
    specs.push({ id: specs.length, type, x: p.x, y: p.y, route: rt, post, dir: Math.atan2(r.y + r.h / 2 - p.y, r.x + r.w / 2 - p.x) });
  };
  const gAll = roamPool.length ? roamPool : allIds;
  let ng = tpl.guards > 0 ? Math.max(1, Math.round((tpl.guards + (o.mod === 'rich' ? 1 : 0) + o.extraGuards) * o.guardMul)) : 0;
  const nh = tpl.heavy > 0 ? Math.round(tpl.heavy * (0.5 + o.guardMul / 2)) + o.extraHeavy : o.extraHeavy;
  if (ng > 1 && antechamber >= 0 && antechamber !== entRoom) { addG('guard', [pickCell(rooms[antechamber], rnd)], true); ng--; }
  for (let i = 0; i < ng; i++) addG('guard', i % 3 === 2 && ng > 2 ? [pickCell(rooms[gAll[Math.floor(rnd() * gAll.length)]], rnd)] : route(3 + Math.floor(rnd() * 2), gAll), i % 3 === 2 && ng > 2);
  for (let i = 0; i < nh; i++) addG('heavy', route(3, gAll), false);
  for (let i = 0; i < tpl.drones; i++) addG('drone', route(4, gAll), false);
  const civPool = gAll.filter(i => i !== secRoom);
  for (let i = 0; i < tpl.civs; i++) addG('civilian', route(2, civPool.length ? civPool : gAll), false);
  if (tpl.boss) addG('warden', route(8, gAll), false);

  // validate reachability from front for every room cell center-ish
  const world: World = {
    tpl, w: W, h: H, bh: BH, tiles, roomOf, doorAt, laserAt, rooms, doors, terms, cams, lasers, loot, safes, panels, guards: specs,
    van, front, vaultRoom, secRoom, entRoom, adj, par: 60 + rooms.length * 14,
  };
  return world;
}

function pickCell(r: Room, rnd: () => number): Pt { return r.cells[Math.floor(rnd() * r.cells.length)]; }

export const roomAt = (w: World, x: number, y: number): number => {
  const ix = Math.floor(x), iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= w.w || iy >= w.h) return -1;
  const di = w.doorAt[iy * w.w + ix];
  if (di >= 0) return w.doors[di].rooms[0];
  return w.roomOf[iy * w.w + ix];
};

// ---------------------------------------------------------------- pathfinding
export function findPath(w: World, sx: number, sy: number, tx: number, ty: number, crew = false): Pt[] | null {
  const W = w.w, H = w.h;
  sx = Math.floor(sx); sy = Math.floor(sy); tx = Math.floor(tx); ty = Math.floor(ty);
  if (sx < 0 || sy < 0 || sx >= W || sy >= H || tx < 0 || ty < 0 || tx >= W || ty >= H) return null;
  if (w.tiles[ty * W + tx] === T_WALL) return null;
  if (sx === tx && sy === ty) return [];
  const N = W * H;
  const g = new Float32Array(N).fill(1e9);
  const par = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const hf: number[] = [], hi: number[] = [];
  const push = (f: number, i: number) => {
    let n = hf.length; hf.push(f); hi.push(i);
    while (n > 0) { const p = (n - 1) >> 1; if (hf[p] <= hf[n]) break; [hf[p], hf[n]] = [hf[n], hf[p]]; [hi[p], hi[n]] = [hi[n], hi[p]]; n = p; }
  };
  const pop = () => {
    const top = hi[0];
    const lf = hf.pop()!, li = hi.pop()!;
    if (hf.length) {
      hf[0] = lf; hi[0] = li;
      let n = 0;
      for (;;) {
        const l = 2 * n + 1, r = l + 1; let m = n;
        if (l < hf.length && hf[l] < hf[m]) m = l;
        if (r < hf.length && hf[r] < hf[m]) m = r;
        if (m === n) break;
        [hf[m], hf[n]] = [hf[n], hf[m]]; [hi[m], hi[n]] = [hi[n], hi[m]]; n = m;
      }
    }
    return top;
  };
  const h = (x: number, y: number) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); };
  const si = sy * W + sx;
  g[si] = 0; push(h(sx, sy), si);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let found = false;
  while (hf.length) {
    const cur = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % W, cy = (cur / W) | 0;
    if (cx === tx && cy === ty) { found = true; break; }
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (closed[ni] || w.tiles[ni] === T_WALL) continue;
      let cost = 1;
      if (dx !== 0 && dy !== 0) {
        if (w.tiles[cy * W + nx] === T_WALL || w.tiles[ny * W + cx] === T_WALL) continue;
        if (w.tiles[ni] === T_DOOR || w.tiles[cur] === T_DOOR) continue;
        cost = 1.414;
      }
      if (crew) {
        const di = w.doorAt[ni];
        if (di >= 0) { const d = w.doors[di]; if (!(d.open || d.openT > 0)) cost += 3 + 2 * d.lock; }
        const li = w.laserAt[ni];
        if (li >= 0) cost += w.lasers[li].solid ? 9 : 3;
      }
      const ng = g[cur] + cost;
      if (ng < g[ni]) { g[ni] = ng; par[ni] = cur; push(ng + h(nx, ny), ni); }
    }
  }
  if (!found) return null;
  const out: Pt[] = [];
  let c = ty * W + tx;
  while (c !== si && c >= 0) { out.push({ x: (c % W) + 0.5, y: ((c / W) | 0) + 0.5 }); c = par[c]; }
  out.reverse();
  return out;
}
