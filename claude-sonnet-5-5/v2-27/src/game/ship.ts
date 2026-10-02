import { MODS, HullDef, Layout, DmgType, ModId } from "./data";

export interface Analysis {
  mass: number; cap: number; cost: number; hp: number;
  gen: number; idleDraw: number; peakDraw: number; engineDraw: number; gyroDraw: number;
  thrust: number; torque: number; accel: number;
  shieldCap: number; shieldRegen: number;
  heatCap: number; dissip: number; idleHeat: number; engineHeat: number; fireHeat: number;
  overheatIn: number | null; idleEq: number;
  battery: number; crewSupply: number; crewNeed: number; crewUsed: number;
  dmgMult: number; dps: Record<DmgType, number>; credBonus: number; repair: number;
  manned: boolean[]; flows: number[][]; exposure: number[];
  disconnected: number[]; count: Record<string, number>;
  errors: string[]; warnings: string[];
  armorCells: number; turrets: number;
}

export function inMask(h: HullDef, x: number, y: number): boolean {
  if (y < 0 || y >= h.h || x < 0 || x >= h.w) return false;
  const wd = h.widths[y];
  const s = (h.w - wd) / 2;
  return x >= s && x < s + wd;
}
export function emptyLayout(h: HullDef): Layout {
  const l: Layout = new Array(h.w * h.h).fill(null);
  l[h.bridge.y * h.w + h.bridge.x] = "bridge";
  return l;
}
export function buildLayout(h: HullDef, items: [number, number, ModId][]): Layout {
  const l = emptyLayout(h);
  for (const [x, y, id] of items) if (inMask(h, x, y)) l[y * h.w + x] = id;
  return l;
}
export function layoutCost(l: Layout): number {
  let c = 0;
  for (const id of l) if (id) c += MODS[id].cost;
  return c;
}

const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]; // 4-neighbourhood

export function analyze(layout: Layout, hull: HullDef, tech: Record<string, number>, withFlows = false): Analysis {
  const { w, h } = hull;
  const N = w * h;
  const T = (k: string) => tech[k] || 0;
  const defAt = (i: number) => (layout[i] ? MODS[layout[i]!] : null);

  // --- connectivity from the bridge
  const reach: boolean[] = new Array(N).fill(false);
  const bi = layout.findIndex((c) => c === "bridge");
  if (bi >= 0) {
    const st = [bi];
    reach[bi] = true;
    while (st.length) {
      const i = st.pop()!;
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (layout[j] && !reach[j]) { reach[j] = true; st.push(j); }
      }
    }
  }
  const disconnected: number[] = [];
  for (let i = 0; i < N; i++) if (layout[i] && !reach[i]) disconnected.push(i);

  // --- crew flow: passable components
  const comp = new Int32Array(N).fill(-1);
  const pool: number[] = [];
  let nc = 0;
  const provOf = (d: ReturnType<typeof defAt>) => (!d ? 0 : d.id === "quarters" ? d.crewProv + T("p_crew") : d.crewProv);
  for (let i = 0; i < N; i++) {
    const d = defAt(i);
    if (!d || !d.passable || comp[i] >= 0) continue;
    const st = [i];
    comp[i] = nc;
    let p = 0;
    while (st.length) {
      const k = st.pop()!;
      p += provOf(defAt(k));
      const x = k % w, y = (k / w) | 0;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        const dj = defAt(j);
        if (dj && dj.passable && comp[j] < 0) { comp[j] = nc; st.push(j); }
      }
    }
    pool.push(p);
    nc++;
  }
  const dist = new Int32Array(N).fill(-1);
  const parent = new Int32Array(N).fill(-1);
  const q: number[] = [];
  let crewSupply = 0;
  for (let i = 0; i < N; i++) {
    const d = defAt(i);
    if (d && provOf(d) > 0) { dist[i] = 0; q.push(i); crewSupply += provOf(d); }
  }
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi];
    const x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      const dj = defAt(j);
      if (dj && dj.passable && dist[j] < 0) { dist[j] = dist[i] + 1; parent[j] = i; q.push(j); }
    }
  }
  const manned: boolean[] = new Array(N).fill(false);
  const consumers: number[] = [];
  let crewNeed = 0;
  for (let i = 0; i < N; i++) {
    const d = defAt(i);
    if (!d) continue;
    if (d.crew === 0) manned[i] = true;
    else { consumers.push(i); crewNeed += d.crew; }
  }
  consumers.sort((a, b) => (dist[a] < 0 ? 9999 : dist[a]) - (dist[b] < 0 ? 9999 : dist[b]));
  const rem = pool.slice();
  let crewUsed = 0;
  const flows: number[][] = [];
  for (const i of consumers) {
    const d = defAt(i)!;
    const c = comp[i];
    if (c >= 0 && dist[i] >= 0 && rem[c] >= d.crew) {
      rem[c] -= d.crew;
      manned[i] = true;
      crewUsed += d.crew;
      if (withFlows && dist[i] > 0) {
        const path: number[] = [];
        let k = i;
        while (k >= 0) { path.push(k); k = parent[k]; }
        flows.push(path);
      }
    }
  }

  // --- aggregates
  const count: Record<string, number> = {};
  const exposure: number[] = new Array(N).fill(1);
  let mass = 0, cost = 0, hp = 0, gen = 0, idleDraw = 0, activeDraw = 0, engineDraw = 0, gyroDraw = 0;
  let thrust = 0, torque = 0, shieldCap = 0, shieldN = 0, heatCap = 60, dissipRaw = 2, idleHeat = 0, engineHeat = 0, fireHeat = 0;
  let battery = 0, targeting = 0, cargo = 0, repair = 0, armorCells = 0, turrets = 0;
  const weapons: { dmg: number; rate: number; type: DmgType }[] = [];
  for (let i = 0; i < N; i++) {
    const d = defAt(i);
    if (!d) continue;
    count[d.id] = (count[d.id] || 0) + 1;
    mass += d.mass; cost += d.cost; hp += d.hp;
    if (d.id === "armor") armorCells++;
    if (d.id === "turret") turrets++;
    if (!manned[i]) continue;
    if (d.power > 0) gen += d.power; else idleDraw += -d.power;
    activeDraw += -d.active;
    idleHeat += d.heat;
    if (d.thrust) { thrust += d.thrust; engineDraw += -d.active; engineHeat += d.heatActive; }
    if (d.torque) { torque += d.torque; gyroDraw += -d.active; }
    if (d.shield) { shieldCap += d.shield; shieldN++; }
    if (d.heatCap) heatCap += d.heatCap;
    if (d.dissip) {
      let exp = false;
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (!inMask(hull, nx, ny) || !layout[ny * w + nx]) exp = true;
      }
      exposure[i] = exp ? 1.5 : 0.5;
      dissipRaw += d.dissip * exposure[i];
    }
    if (d.battery) battery += d.battery;
    if (d.id === "targeting") targeting++;
    if (d.id === "cargo") cargo++;
    if (d.repair) repair += d.repair;
    if (d.weapon) {
      weapons.push({ dmg: d.weapon.dmg, rate: d.weapon.rate, type: d.weapon.type });
      fireHeat += d.weapon.rate * d.weapon.heatShot;
    }
  }
  const nonEngineActive = activeDraw - engineDraw - gyroDraw;
  gen *= 1 + 0.12 * T("p_reactor");
  thrust *= 1 + 0.12 * T("p_thrust");
  const sh = 1 + 0.2 * T("p_shield");
  const cool = 1 + 0.15 * T("p_coolant");
  const dissip = dissipRaw * cool;
  const dmgMult = (1 + 0.1 * T("p_ballistics")) * (1 + Math.min(0.4, 0.08 * targeting));
  const dps: Record<DmgType, number> = { energy: 0, kinetic: 0, explosive: 0 };
  for (const wp of weapons) dps[wp.type] += wp.dmg * wp.rate * dmgMult;
  const peakDraw = idleDraw + activeDraw;
  const accel = thrust / Math.max(10, mass);

  // heat simulation: sustained fire from cold
  const gHeat = idleHeat + fireHeat;
  let hs = 0, overheatIn: number | null = null;
  for (let t = 0; t < 120; t += 0.25) {
    hs += (gHeat - dissip * (0.4 + 1.2 * (hs / heatCap))) * 0.25;
    if (hs < 0) hs = 0;
    if (hs >= heatCap) { overheatIn = t; break; }
  }
  const idleEq = Math.max(0, Math.min(1.5, (idleHeat / dissip - 0.4) / 1.2));

  // --- validation
  const errors: string[] = [];
  const warnings: string[] = [];
  if (bi < 0) errors.push("No command bridge.");
  if (mass > hull.cap) errors.push(`Mass ${mass.toFixed(0)} exceeds hull capacity ${hull.cap}.`);
  if (disconnected.length) errors.push(`${disconnected.length} module(s) are not attached to the bridge.`);
  const unmanned = layout.reduce((a, c, i) => a + (c && !manned[i] ? 1 : 0), 0);
  if (unmanned) warnings.push(`${unmanned} module(s) have no crew path or crew – they are offline.`);
  if (gen <= 0) warnings.push("No power generation.");
  else if (peakDraw > gen && battery < 20) warnings.push("Peak demand exceeds output – expect brownouts (add reactors or capacitors).");
  if (thrust <= 0) warnings.push("No manned engines – you will barely move.");
  if (!weapons.length) warnings.push("No manned weapons.");
  if (overheatIn !== null) warnings.push(`Sustained fire overheats in ~${overheatIn.toFixed(0)}s – add radiators or heat sinks.`);
  void nonEngineActive;

  return {
    mass, cap: hull.cap, cost, hp: hp * (1 + 0.15 * T("p_alloy")),
    gen, idleDraw, peakDraw, engineDraw, gyroDraw, thrust, torque, accel,
    shieldCap: shieldCap * sh, shieldRegen: shieldN * 8 * sh,
    heatCap, dissip, idleHeat, engineHeat, fireHeat, overheatIn, idleEq,
    battery, crewSupply, crewNeed, crewUsed, dmgMult, dps,
    credBonus: Math.min(0.6, 0.12 * cargo), repair, manned, flows, exposure, disconnected, count,
    errors, warnings, armorCells, turrets,
  };
}
