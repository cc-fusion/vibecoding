// ---------- Procedural building generator + grid helpers ----------
import { VENUES, LOOT, mulberry32, ri, pick, shuffle } from './data';
import type { Contract, Loot, Skill, LootCat, Rng } from './data';

export interface Pt { x: number; y: number }
export const T_VOID = 0, T_FLOOR = 1, T_WALL = 2, T_COVER = 4, T_STREET = 6;
export type DoorKind = 'open' | 'locked' | 'keycard' | 'vault';
export interface Door { id: string; x: number; y: number; vert: boolean; kind: DoorKind; unlocked: boolean; open: number; locks: number; done: number }
export type ItemType = 'loot' | 'safe' | 'camTerm' | 'laserBox' | 'alarmPanel' | 'vaultLock';
export interface Item { id: string; x: number; y: number; type: ItemType; skill: Skill; time: number; noise: number; loot?: Loot; label: string; icon: string; room: number; done: boolean; primary?: boolean }
export interface Cam { id: string; x: number; y: number; base: number; sweep: number; speed: number; phase: number; range: number; fov: number }
export interface Laser { id: string; x: number; y1: number; y2: number; mode: 'solid' | 'pulse'; period: number; onFrac: number; phase: number }
export type GuardType = 'guard' | 'dog' | 'heavy' | 'swat';
export interface GuardDef { id: string; type: GuardType; route: { x: number; y: number; wait: number }[]; start: number; loop: Pt[]; sentry: boolean }
export interface Room { id: number; x: number; y: number; w: number; h: number; kind: 'corridor' | 'room' | 'office' | 'security' | 'vault'; name: string; row: 'top' | 'bot' | 'mid' }
export interface Level {
  w: number; h: number; tiles: Uint8Array; roomAt: Int16Array; doorAt: Int16Array; rooms: Room[]; doors: Door[]; items: Item[];
  cams: Cam[]; lasers: Laser[]; guards: GuardDef[]; exit: Pt; spawn: Pt[]; cy: number; x0: number; x1: number;
  venue: string; tier: number; title: string; target: Loot; timeLimit: number;
}

// ---------- pathfinding ----------
export interface Goal { x: number; y: number; adj?: boolean }
export function findPath(W: number, H: number, sx: number, sy: number, goal: Goal, pass: (x: number, y: number) => boolean, cost?: (x: number, y: number) => number): Pt[] | null {
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return null;
  const N = W * H;
  const g = new Float32Array(N).fill(1e9), fs = new Float32Array(N), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap: number[] = [];
  const push = (i: number) => {
    heap.push(i); let k = heap.length - 1;
    while (k > 0) { const p = (k - 1) >> 1; if (fs[heap[p]] <= fs[heap[k]]) break; const t = heap[p]; heap[p] = heap[k]; heap[k] = t; k = p; }
  };
  const pop = () => {
    const top = heap[0]; const last = heap.pop() as number;
    if (heap.length) {
      heap[0] = last; let k = 0;
      for (;;) {
        const l = 2 * k + 1, rr = l + 1; let m = k;
        if (l < heap.length && fs[heap[l]] < fs[heap[m]]) m = l;
        if (rr < heap.length && fs[heap[rr]] < fs[heap[m]]) m = rr;
        if (m === k) break; const t = heap[m]; heap[m] = heap[k]; heap[k] = t; k = m;
      }
    }
    return top;
  };
  const isGoal = (x: number, y: number) => (x === goal.x && y === goal.y) || (!!goal.adj && Math.abs(x - goal.x) + Math.abs(y - goal.y) === 1);
  const hf = (x: number, y: number) => { const dx = Math.abs(x - goal.x), dy = Math.abs(y - goal.y); return Math.max(0, dx + dy - 0.586 * Math.min(dx, dy) - (goal.adj ? 1 : 0)); };
  if (isGoal(sx, sy)) return [];
  const s = sy * W + sx; g[s] = 0; fs[s] = hf(sx, sy); push(s);
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
  while (heap.length) {
    const cur = pop(); if (closed[cur]) continue; closed[cur] = 1;
    const cx = cur % W, cy = (cur / W) | 0;
    if (isGoal(cx, cy)) {
      const path: Pt[] = []; let n = cur;
      while (n !== s && n >= 0) { path.push({ x: n % W, y: (n / W) | 0 }); n = from[n]; }
      return path.reverse();
    }
    for (let d = 0; d < 8; d++) {
      const nx = cx + DX[d], ny = cy + DY[d];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (!pass(nx, ny)) continue;
      const diag = d >= 4;
      if (diag && (!pass(cx + DX[d], cy) || !pass(cx, cy + DY[d]))) continue;
      const ni = ny * W + nx; if (closed[ni]) continue;
      const ng = g[cur] + (diag ? 1.414 : 1) + (cost ? cost(nx, ny) : 0);
      if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; fs[ni] = ng + hf(nx, ny); push(ni); }
    }
  }
  return null;
}

export function lineClear(blocks: (x: number, y: number) => boolean, x0: number, y0: number, x1: number, y1: number): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0); const n = Math.ceil(d / 0.22);
  for (let i = 1; i < n; i++) {
    const t = i / n; if (blocks(Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t))) return false;
  }
  return true;
}

export const angDiff = (a: number, b: number) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

// ---------- generator ----------
export function genLevel(ct: Contract, heat: number): Level {
  const V = VENUES[ct.venue]; const r: Rng = mulberry32((ct.seed ^ 0x9e3779b1) >>> 0);
  const W = V.w, H = V.h, tier = ct.tier;
  const tiles = new Uint8Array(W * H), roomAt = new Int16Array(W * H).fill(-1), doorAt = new Int16Array(W * H).fill(-1);
  const x0 = 4, x1 = W - 2, cy = Math.floor(H / 2) - 1;
  const I = (x: number, y: number) => y * W + x;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles[I(x, y)] = x < x0 ? T_STREET : (x <= x1 && y >= 1 && y <= H - 2 ? T_WALL : T_VOID);

  const rooms: Room[] = [];
  const carve = (rm: Room) => { for (let y = rm.y; y < rm.y + rm.h; y++) for (let x = rm.x; x < rm.x + rm.w; x++) { tiles[I(x, y)] = T_FLOOR; roomAt[I(x, y)] = rm.id; } };
  const mk = (x: number, y: number, w: number, h: number, kind: Room['kind'], name: string, row: Room['row']): Room => {
    const rm: Room = { id: rooms.length, x, y, w, h, kind, name, row }; rooms.push(rm); carve(rm); return rm;
  };
  mk(x0 + 1, cy, x1 - x0 - 1, 3, 'corridor', 'Main Corridor', 'mid');
  const tw = x1 - x0 - 1;

  const doors: Door[] = [];
  const addDoor = (x: number, y: number, vert: boolean, kind: Door['kind']): Door => {
    const d: Door = { id: 'd' + doors.length, x, y, vert, kind, unlocked: false, open: 0, locks: 0, done: 0 };
    doors.push(d); tiles[I(x, y)] = T_FLOOR; doorAt[I(x, y)] = doors.length - 1; return d;
  };

  const roomDoor: Record<number, Door> = {};
  const buildRow = (row: 'top' | 'bot', range: [number, number], vault: boolean): Room[] => {
    let n = ri(r, range[0], range[1]); if (vault) n = Math.max(n, 3);
    const minsFor = (k: number) => Array.from({ length: k }, (_, i) => (vault && i === k - 1 ? 8 : 5));
    while (n > 1 && minsFor(n).reduce((a, b) => a + b, 0) + (n - 1) > tw) n--;
    const widths = minsFor(n); let rem = tw - (n - 1) - widths.reduce((a, b) => a + b, 0);
    while (rem-- > 0) widths[ri(r, 0, n - 1)]++;
    const ry = row === 'top' ? 2 : cy + 4, rh = row === 'top' ? cy - 3 : H - cy - 6;
    const out: Room[] = []; let xs = x0 + 1;
    for (let i = 0; i < n; i++) {
      const rm = mk(xs, ry, widths[i], rh, 'room', 'Room', row); out.push(rm); xs += widths[i] + 1;
      if (!(vault && i === n - 1)) roomDoor[rm.id] = addDoor(rm.x + ri(r, 1, rm.w - 2), row === 'top' ? cy - 1 : cy + 3, false, 'open');
    }
    return out;
  };
  const topRooms = buildRow('top', V.top, V.vault);
  const botRooms = buildRow('bot', V.bot, false);
  const all = [...topRooms, ...botRooms];

  // kinds
  let vaultRoom: Room | null = null, office: Room;
  if (V.vault) { vaultRoom = topRooms[topRooms.length - 1]; vaultRoom.kind = 'vault'; vaultRoom.name = 'THE VAULT'; office = topRooms[topRooms.length - 2]; }
  else office = pick(r, all);
  office.kind = 'office'; office.name = V.id === 'bank' || V.id === 'meridian' ? "Manager's Office" : 'Executive Office';
  const secCands = all.filter((q) => q !== office && q !== vaultRoom);
  const security = secCands.length ? pick(r, secCands) : office;
  if (security !== office) { security.kind = 'security'; security.name = 'Security Office'; }
  const namePool = shuffle(r, V.rooms); let ni = 0;
  for (const q of all) if (q.kind === 'room') q.name = namePool[ni++ % namePool.length];

  // side doors
  const sideDoors: Door[] = [];
  for (const row of [topRooms, botRooms]) {
    for (let i = 0; i < row.length - 1; i++) {
      const a = row[i], b = row[i + 1];
      const isVault = V.vault && b === vaultRoom;
      if (isVault || r() < 0.4) {
        const d = addDoor(a.x + a.w, a.y + ri(r, 1, Math.max(1, a.h - 2)), true, isVault ? 'vault' : 'open');
        if (!isVault) sideDoors.push(d);
      }
    }
  }
  addDoor(x0, cy + 1, true, 'open'); // entrance

  // lock assignments
  let kc = V.keycards, lk = V.locked + (tier >= 3 ? 1 : 0);
  const take = (d: Door | undefined, pref: 'keycard' | 'locked') => {
    if (!d || d.kind !== 'open') return;
    if (pref === 'keycard' && kc > 0) { d.kind = 'keycard'; kc--; } else if (lk > 0) { d.kind = 'locked'; lk--; } else if (kc > 0) { d.kind = 'keycard'; kc--; }
  };
  take(roomDoor[office.id], 'keycard');
  if (security !== office) take(roomDoor[security.id], 'keycard');
  const others = shuffle(r, [...Object.values(roomDoor).filter((d) => d.kind === 'open'), ...sideDoors.filter((d) => d.kind === 'open')]);
  for (const d of others) { if (kc > 0 && r() < 0.5) { d.kind = 'keycard'; kc--; } else if (lk > 0) { d.kind = 'locked'; lk--; } else if (kc > 0) { d.kind = 'keycard'; kc--; } }
  const vd = doors.find((d) => d.kind === 'vault'); if (vd) vd.locks = V.vaultLocks.length;

  // cover
  const nearDoor = (x: number, y: number) => doors.some((d) => Math.abs(d.x - x) <= 1 && Math.abs(d.y - y) <= 1);
  for (const q of all) {
    if (q.w >= 6 && q.h >= 5) {
      const nCover = ri(r, 0, 2);
      for (let k = 0; k < nCover; k++) {
        const x = q.x + ri(r, 1, q.w - 2), y = q.y + ri(r, 1, q.h - 2);
        if (!nearDoor(x, y) && tiles[I(x, y)] === T_FLOOR) tiles[I(x, y)] = T_COVER;
      }
    }
  }

  const occ = new Set<number>();
  // lasers
  const lasers: Laser[] = [];
  const nL = Math.min(4, ri(r, V.lasers[0], V.lasers[1]) + (tier >= 4 && V.lasers[1] > 0 ? 1 : 0));
  for (const q of shuffle(r, all.filter((z) => z.w >= 6))) {
    if (lasers.length >= nL) break;
    const badX = new Set(doors.filter((d) => !d.vert && d.x >= q.x && d.x < q.x + q.w).map((d) => d.x));
    const xs: number[] = []; for (let x = q.x + 2; x <= q.x + q.w - 3; x++) if (!badX.has(x)) xs.push(x);
    if (!xs.length) continue;
    const lx = pick(r, xs);
    for (let y = q.y; y < q.y + q.h; y++) { if (tiles[I(lx, y)] === T_COVER) tiles[I(lx, y)] = T_FLOOR; occ.add(I(lx, y)); }
    lasers.push({ id: 'l' + lasers.length, x: lx, y1: q.y, y2: q.y + q.h - 1, mode: r() < 0.5 ? 'pulse' : 'solid', period: 4.5 + r() * 3, onFrac: 0.58, phase: r() * 8 });
  }

  const freeTile = (q: Room): Pt | null => {
    for (let k = 0; k < 80; k++) {
      const x = q.x + ri(r, 0, q.w - 1), y = q.y + ri(r, 0, q.h - 1);
      if (tiles[I(x, y)] !== T_FLOOR || occ.has(I(x, y)) || nearDoor(x, y)) continue;
      occ.add(I(x, y)); return { x, y };
    }
    return null;
  };

  // cameras
  const cams: Cam[] = [];
  const nC = ri(r, V.cams[0], V.cams[1]) + Math.floor(tier / 3) + (heat >= 40 ? 1 : 0) + (heat >= 70 ? 1 : 0);
  const camRooms = shuffle(r, all);
  for (let i = 0; i < nC; i++) {
    if (i === 0 || (i === 1 && r() < 0.5) || (i % 4 === 3)) {
      const left = i % 2 === 0;
      const cx = left ? x0 + 1 : x1 - 1, cyy = left ? cy : cy + 2;
      cams.push({ id: 'c' + cams.length, x: cx, y: cyy, base: left ? 0.06 : Math.PI - 0.06, sweep: 0.5, speed: 0.7 + r() * 0.4, phase: r() * 6, range: 12, fov: 0.95 });
      occ.add(I(cx, cyy));
      continue;
    }
    const q = camRooms[i % camRooms.length];
    const px = r() < 0.5 ? q.x : q.x + q.w - 1; const py = q.row === 'top' ? q.y : q.y + q.h - 1;
    const base = Math.atan2(q.y + q.h / 2 - py, q.x + q.w / 2 - px);
    cams.push({ id: 'c' + cams.length, x: px, y: py, base, sweep: 0.55, speed: 0.6 + r() * 0.5, phase: r() * 6, range: Math.max(5, Math.min(11, Math.hypot(q.w, q.h) * 0.9)), fov: 1.0 });
    occ.add(I(px, py));
  }

  // items
  const items: Item[] = [];
  let lootN = 0;
  const mkLoot = (cat: LootCat, mult = 1, name?: string, primary?: boolean): Loot => {
    const L = LOOT[cat];
    return { id: 'L' + lootN++, cat, name: name ?? pick(r, L.items), value: Math.round((ri(r, L.min, L.max) * mult * (0.9 + 0.1 * tier)) / 10) * 10, weight: L.weight, primary };
  };
  const addItem = (q: Room, p: Partial<Item> & { type: ItemType; label: string; icon: string; skill: Skill; time: number }): Item | null => {
    const t = freeTile(q); if (!t) return null;
    const it: Item = { id: 'i' + items.length, x: t.x, y: t.y, noise: 0, room: q.id, done: false, ...p };
    items.push(it); return it;
  };
  const addLootItem = (q: Room, loot: Loot) => {
    const L = LOOT[loot.cat];
    return addItem(q, { type: 'loot', label: loot.name, icon: L.icon, skill: L.skill, time: L.time * (loot.primary ? 1.3 : 1), loot, primary: loot.primary });
  };
  const addSafe = (q: Room, loot: Loot) => addItem(q, { type: 'safe', label: loot.primary ? 'Target Safe' : 'Wall Safe', icon: '🔐', skill: 'crack', time: 7 + tier * 0.6 + (loot.primary ? 2 : 0), noise: 4, loot, primary: loot.primary });

  // security electronics
  if (security !== office || !V.vault) {
    if (V.cams[1] > 0) addItem(security, { type: 'camTerm', label: 'Camera Console', icon: '🖥️', skill: 'tech', time: 4.5, noise: 0 });
    addItem(security, { type: 'alarmPanel', label: 'Alarm Panel', icon: '🚨', skill: 'tech', time: 6, noise: 0 });
    if (lasers.length) addItem(security, { type: 'laserBox', label: 'Laser Power Box', icon: '⚡', skill: 'tech', time: 4, noise: 0 });
  }
  // vault locks
  if (vaultRoom) {
    const lockRooms = [office, security !== office ? security : office, pick(r, all.filter((q) => q !== vaultRoom))];
    V.vaultLocks.forEach((sk, i) => {
      const lab = sk === 'crack' ? 'Tumbler Lock' : sk === 'tech' ? 'Biometric Scanner' : 'Thermal Plate';
      addItem(lockRooms[i] ?? office, { type: 'vaultLock', label: lab, icon: '🔑', skill: sk, time: sk === 'crack' ? 10 + tier : sk === 'tech' ? 8 : 6, noise: sk === 'force' ? 11 : sk === 'crack' ? 3 : 0 });
    });
    const vc = V.loot.filter((c) => c === 'gold' || c === 'relic'); const vcats: LootCat[] = vc.length ? vc : ['gold'];
    const nv = ri(r, 3, 4) + Math.floor(tier / 3);
    for (let i = 0; i < nv; i++) addLootItem(vaultRoom, mkLoot(pick(r, vcats), 1.1));
  }
  // target
  const tcat = V.targetCat; const tLoot = mkLoot(tcat, 2.6, ct.targetName, true);
  if (vaultRoom) addLootItem(vaultRoom, tLoot);
  else if (V.safes[1] > 0) addSafe(office, tLoot);
  else addLootItem(office, tLoot);
  // safes
  const nS = ri(r, V.safes[0], V.safes[1]) + (tier >= 4 && V.safes[1] > 0 ? 1 : 0);
  const safeCats = V.loot.filter((c) => c === 'cash' || c === 'jewels' || c === 'gold' || c === 'data'); const sc: LootCat[] = safeCats.length ? safeCats : ['cash'];
  const safeRooms = shuffle(r, all.filter((q) => q !== vaultRoom && q !== security));
  for (let i = 0; i < nS; i++) addSafe(i === 0 && V.safes[1] > 0 && !items.some((x) => x.type === 'safe' && x.room === office.id) ? office : safeRooms[i % safeRooms.length], mkLoot(pick(r, sc), 1.4));
  // loot
  const nLoot = ri(r, V.lootN[0], V.lootN[1]) + Math.floor(tier / 3);
  const lootRooms = all.filter((q) => q !== vaultRoom && q !== security);
  for (let i = 0; i < nLoot; i++) addLootItem(lootRooms[i % lootRooms.length], mkLoot(pick(r, V.loot)));

  // guards
  const spawn: Pt[] = [{ x: 2, y: cy + 1 }, { x: 2, y: cy }, { x: 2, y: cy + 2 }, { x: 1, y: cy + 1 }, { x: 1, y: cy }];
  const exit: Pt = { x: 2, y: cy + 1 };
  const gpass = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const t = tiles[I(x, y)]; if (t !== T_FLOOR) return false;
    const di = doorAt[I(x, y)]; if (di >= 0 && doors[di].kind === 'vault') return false; return true;
  };
  const centerTile = (q: Room): Pt => {
    const cx = q.x + Math.floor(q.w / 2), cyy = q.y + Math.floor(q.h / 2);
    for (let rad = 0; rad < 6; rad++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      const x = cx + dx, y = cyy + dy;
      if (x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h && tiles[I(x, y)] === T_FLOOR && !occ.has(I(x, y))) return { x, y };
    }
    return { x: cx, y: cyy };
  };
  const guardRooms = all.filter((q) => q !== vaultRoom);
  const nG = Math.min(9, ri(r, V.guards[0], V.guards[1]) + Math.floor((tier - 1) / 2) + (heat >= 25 ? 1 : 0) + (heat >= 60 ? 1 : 0));
  const nHeavy = V.heavy + (tier >= 5 && V.heavy > 0 ? 1 : 0);
  const types: GuardDef['type'][] = [];
  for (let i = 0; i < nG; i++) types.push('guard');
  for (let i = 0; i < V.dogs; i++) types.push('dog');
  for (let i = 0; i < nHeavy; i++) types.push('heavy');
  const guards: GuardDef[] = [];
  types.forEach((type, gi) => {
    const sentry = type === 'guard' && gi === nG - 1 && nG >= 3 && security.kind === 'security';
    const pts: { x: number; y: number; wait: number }[] = [];
    if (sentry) { const c = centerTile(security); pts.push({ x: c.x, y: c.y, wait: 99 }); }
    else {
      const k = ri(r, 2, 3); const rr = shuffle(r, guardRooms);
      for (let i = 0; i < k; i++) {
        pts.push({ x: ri(r, x0 + 3, x1 - 3), y: cy + ri(r, 0, 2), wait: type === 'dog' ? 0.8 : 1.4 });
        const c = centerTile(rr[i % rr.length]); pts.push({ x: c.x, y: c.y, wait: type === 'dog' ? 1.2 : 3.2 });
      }
    }
    const loop: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const seg = findPath(W, H, a.x, a.y, { x: b.x, y: b.y }, gpass);
      loop.push({ x: a.x, y: a.y }); if (seg) for (const p of seg) loop.push(p);
    }
    guards.push({ id: 'g' + gi, type, route: pts, start: ri(r, 0, pts.length - 1), loop, sentry });
  });

  // reachability prune
  const seen = new Uint8Array(W * H); const q: number[] = [I(exit.x, exit.y)]; seen[q[0]] = 1;
  while (q.length) {
    const c = q.pop() as number; const cx = c % W, cyy = (c / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cyy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const t = tiles[I(nx, ny)]; if ((t !== T_FLOOR && t !== T_STREET) || seen[I(nx, ny)]) continue; seen[I(nx, ny)] = 1; q.push(I(nx, ny));
    }
  }
  const finalItems = items.filter((it) => seen[I(it.x, it.y)]);

  return {
    w: W, h: H, tiles, roomAt, doorAt, rooms, doors, items: finalItems, cams, lasers, guards, exit, spawn, cy, x0, x1,
    venue: V.id, tier, title: V.name, target: tLoot, timeLimit: V.time,
  };
}
