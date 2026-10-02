import type { Game } from './game';
import { W, H, N, mod } from './world';
import { TRIBES } from './data';

const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

// ---------------------------------------------------------------- quakes
export function quake(g: Game, x: number, y: number, magIn: number | null, opts: { player?: boolean; titan?: boolean } = {}) {
  const cx = Math.floor(x), cy = Math.max(0, Math.min(H - 1, Math.floor(y)));
  const ex = mod(cx, W) + 0.5, ey = cy + 0.5;
  let S = 0;
  for (let dy = -5; dy <= 5; dy++) {
    const yy = cy + dy; if (yy < 0 || yy >= H) continue;
    for (let dx = -5; dx <= 5; dx++) if (dx * dx + dy * dy <= 25) S += g.stress[yy * W + mod(cx + dx, W)];
  }
  let mag = magIn ?? Math.min(8.6, 2 + Math.log10(S + 1) * 1.6);
  if (opts.player) mag = Math.min(7.4, mag);
  const R = opts.player ? 8 : 3 + mag;
  const Ri = Math.ceil(R);
  for (let dy = -Ri; dy <= Ri; dy++) {
    const yy = cy + dy; if (yy < 0 || yy >= H) continue;
    for (let dx = -Ri; dx <= Ri; dx++) {
      const d = Math.hypot(dx, dy); if (d > R) continue;
      const f = opts.player ? (d <= 6 ? 0.85 : 0.85 * (1 - (d - 6) / Math.max(0.5, R - 6))) : 0.9 * (1 - d / R);
      const j = yy * W + mod(cx + dx, W);
      g.stress[j] *= 1 - f;
      if (d <= 2 && g.oro[j] > 0 && mag > 4.5) g.oro[j] *= 0.88;
    }
  }
  g.stats.quakes++; g.stats.maxMag = Math.max(g.stats.maxMag, mag);
  const k = Math.max(0, Math.min(1, (mag - 2.5) / 5.5));
  g.shake = Math.max(g.shake, k * (opts.player ? 0.6 : 1));
  g.ring(ex, ey, R + 2, opts.player ? '#ffb347' : '#ff6b4a', 1.1, 0.35);
  g.ring(ex, ey, R * 0.6, '#ffe0a0', 0.7, 0.2);
  g.burst(ex, ey, Math.floor(8 + mag * 6), '#c9a37a', 2 + mag * 0.5, 1.1, false, 0.5);
  g.floatText(ex, ey - 0.5, opts.player && mag < 3.3 ? `M${mag.toFixed(1)} · no stress to vent` : `M${mag.toFixed(1)}`, '#ffd08a', 1 + k * 0.6);
  g.audio.sfx(opts.player ? 'tremor' : 'quake', k);

  // damage
  for (const s of g.settlements.slice()) {
    const d = g.dist(s.x, s.y, ex, ey), reach = R * 1.3;
    if (d > reach) continue;
    if (g.shielded(s.x, s.y)) { g.floatText(s.x, s.y - 1, 'Protected', '#9be7ff'); continue; }
    let frac = Math.max(0, Math.min(0.7, (mag - 3.3) * 0.075)) * Math.pow(1 - d / reach, 1.2);
    if (opts.player) frac *= d < 3.5 ? 0.35 : 0;
    const t = g.tribes[s.tribe];
    const res = (t.techs['masonry'] ? 0.65 : 1) * (t.techs['seismo'] ? 0.75 : 1) * (s.tribe === 2 ? 0.8 : 1) * (1 - g.upg('foundations') * 0.1) * g.diff.dmg;
    g.hurt(s, s.pop * frac * res, 'quake');
    if (frac * res > 0.02) { g.burst(s.x, s.y, 8, '#b08d68', 2, 0.8, false, 1); }
  }
  // titan vent
  const ti = g.titan;
  if (ti && !ti.dead && !opts.titan) {
    const d = g.dist(ti.x, ti.y, ex, ey);
    if (d <= 14) {
      const dmg = Math.max(0, mag - 4.3) * 5.5 * (1 - d / 15);
      if (dmg > 0.5) {
        ti.hp -= dmg; g.stats.titanDmg += dmg;
        g.floatText(ti.x, ti.y - 3, `-${Math.round(dmg)} Titan`, '#ffe08a', 1.5);
        g.burst(ti.x, ti.y, 24, '#ffb347', 6, 1, true);
        if (ti.hp <= 0) killTitan(g);
      } else g.floatText(ti.x, ti.y - 3, 'Too little pressure', '#aaa', 0.9);
    }
  }
  const near = g.nearestSettlement(ex, ey, 14);
  if (mag >= 4.8 && !opts.player) g.addLog(`Magnitude ${mag.toFixed(1)} quake${near ? ` near ${near.name}` : ' at sea'}.`, 'bad');
  const i = cy * W + mod(cx, W);
  // tsunami
  if (g.h[i] < g.sea - 0.04 && mag >= 5.2 && !opts.player) {
    g.tsunamis.push({ x: ex, y: ey, r: 1, maxR: 14 + (mag - 5) * 9, str: Math.min(1.2, (mag - 4.6) / 3), hit: new Set() });
    g.stats.tsunamis++; g.addLog('A tsunami races toward the coast!', 'bad'); g.warn('TSUNAMI!', 5); g.audio.sfx('tsunami');
  }
  // volcano breach
  if (!opts.player && !opts.titan && mag >= 5 && g.cnt[i] >= 2 && g.h[i] > g.sea - 0.3 && Math.random() < 0.35 && g.volcanoes.length < 8) spawnVolcano(g, ex, ey, false, 0.8);
  return mag;
}

// ---------------------------------------------------------------- volcanoes
export function spawnVolcano(g: Game, x: number, y: number, player: boolean, power = 1) {
  if (g.volcanoes.length >= 8) {
    const idx = Math.max(0, g.volcanoes.findIndex((v) => v.state === 'dormant'));
    g.volcanoes.splice(idx, 1);
  }
  const v = { id: g.nextId++, x: mod(Math.floor(x), W) + 0.5, y: Math.max(1, Math.min(H - 2, Math.floor(y))) + 0.5, state: 'rising' as const, t: 0, dur: 3, budget: 0, front: [] as number[], cone: 0, step: 0, next: 0, player, power };
  g.volcanoes.push(v);
  g.shake = Math.max(g.shake, 0.35);
  g.ring(v.x, v.y, 6, '#ff8a3a', 1);
  g.burst(v.x, v.y, 30, '#ff9a3a', 5, 1, true, 3);
  g.audio.sfx('volcano');
  g.addLog(player ? 'You raise a volcano from the crust.' : 'A volcano tears through the crust!', player ? 'info' : 'bad');
}

function erupt(g: Game, v: Game['volcanoes'][number]) {
  v.state = 'erupting'; v.t = 0; v.dur = 7 + Math.random() * 4; v.step = 0;
  v.budget = Math.round((38 + Math.random() * 30) * v.power);
  const c = g.idx(v.x, v.y); v.front = [c]; g.lavaT[c] = 12;
  g.stats.eruptions++; g.shake = Math.max(g.shake, 0.45);
  g.ring(v.x, v.y, 9, '#ff6a2a', 1.2, 0.4);
  const cx = Math.floor(v.x), cy = Math.floor(v.y);
  for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) {
    const d = Math.hypot(dx, dy); if (d > 9) continue;
    const yy = cy + dy; if (yy < 0 || yy >= H) continue;
    const j = yy * W + mod(cx + dx, W); g.ash[j] = Math.min(1, g.ash[j] + 0.7 * (1 - d / 9));
  }
  g.audio.sfx('volcano');
  const near = g.nearestSettlement(v.x, v.y, 14);
  g.addLog(`A volcano erupts${near ? ` near ${near.name}` : ''}!`, 'bad');
}

function applyCone(g: Game, v: Game['volcanoes'][number], p: number) {
  const dp = p - v.cone; v.cone = p;
  const cx = Math.floor(v.x), cy = Math.floor(v.y);
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const d = Math.hypot(dx, dy); if (d > 3.8) continue;
    const yy = cy + dy; if (yy < 0 || yy >= H) continue;
    g.extra[yy * W + mod(cx + dx, W)] += dp * 1.0 * Math.pow(1 - d / 3.8, 1.3);
  }
}

function spread(g: Game, v: Game['volcanoes'][number]) {
  const next: number[] = [];
  const off = Math.floor(Math.random() * 8);
  for (const c of v.front) {
    if (v.budget <= 0) break;
    const x = c % W, y = (c / W) | 0; let sp = 0;
    for (let k = 0; k < 8 && sp < 2; k++) {
      const [dx, dy] = D8[(k + off) % 8];
      const yy = y + dy; if (yy < 0 || yy >= H) continue;
      const j = yy * W + mod(x + dx, W);
      if (g.lavaT[j] > 0) continue;
      if (g.h[j] <= g.h[c] + 0.03 || Math.random() < 0.12) {
        if (g.h[j] < g.sea) {
          g.extra[j] += 0.16; g.burst(mod(x + dx, W) + 0.5, yy + 0.5, 4, '#dfe8ee', 1.5, 1, false, -1); g.audio.sfx('splash');
        } else { g.lavaT[j] = 10 + Math.random() * 5; next.push(j); }
        v.budget--; sp++;
      }
    }
    if (Math.random() < 0.35) next.push(c);
  }
  v.front = v.budget > 0 ? (next.length ? next.slice(0, 40) : [g.idx(v.x, v.y)]) : [];
}

export function updateVolcanoes(g: Game, dt: number) {
  for (const v of g.volcanoes.slice()) {
    const i = g.idx(v.x, v.y);
    if (v.state === 'rising') {
      v.t += dt; applyCone(g, v, Math.min(1, v.t / v.dur));
      if (Math.random() < dt * 20) g.particles.push({ x: v.x + (Math.random() - 0.5) * 2, y: v.y, vx: (Math.random() - 0.5), vy: -1.5, life: 1.2, max: 1.2, size: 0.4, color: 'rgba(120,100,95,0.6)', g: 0, add: false });
      if (v.t >= v.dur) erupt(g, v);
    } else if (v.state === 'erupting') {
      v.t += dt; v.step -= dt;
      const n = Math.floor(dt * 70 + Math.random());
      for (let k = 0; k < n; k++) {
        if (g.particles.length > 1500) break;
        g.particles.push({ x: v.x + (Math.random() - 0.5) * 0.8, y: v.y - 0.3, vx: (Math.random() - 0.5) * 4, vy: -3 - Math.random() * 5, life: 0.9, max: 0.9, size: 0.22, color: Math.random() < 0.5 ? '#ff9a3a' : '#ffd36a', g: 9, add: true });
      }
      if (Math.random() < dt * 8) g.particles.push({ x: v.x, y: v.y - 1, vx: (Math.random() - 0.5) * 1.5, vy: -2, life: 2.5, max: 2.5, size: 0.7, color: 'rgba(60,55,55,0.55)', g: -0.3, add: false });
      g.shake = Math.max(g.shake, 0.08);
      if (v.step <= 0) { v.step = 0.4; spread(g, v); }
      if (v.t >= v.dur) { v.state = 'dormant'; v.next = 80 + Math.random() * 100; }
    } else {
      v.next -= dt;
      if (Math.random() < dt * 0.8) g.particles.push({ x: v.x, y: v.y - 0.5, vx: 0.2, vy: -0.8, life: 2, max: 2, size: 0.4, color: 'rgba(160,150,150,0.35)', g: 0, add: false });
      if (g.h[i] < g.sea - 0.1) { g.volcanoes = g.volcanoes.filter((q) => q !== v); continue; }
      if (v.next <= 0 && !g.tutShield && g.state === 'playing') erupt(g, v);
      else if (v.next <= 0) v.next = 30;
    }
  }
}

// ---------------------------------------------------------------- tsunamis
export function updateTsunamis(g: Game, dt: number) {
  for (const t of g.tsunamis) {
    t.r += 11 * dt;
    const fade = 1 - (t.r / t.maxR) * 0.6;
    for (const s of g.settlements.slice()) {
      if (t.hit.has(s.id)) continue;
      const d = g.dist(s.x, s.y, t.x, t.y);
      if (Math.abs(d - t.r) > 1.6) continue;
      t.hit.add(s.id);
      const i = g.idx(s.x, s.y); const e = g.h[i] - g.sea;
      if (g.shielded(s.x, s.y)) { g.floatText(s.x, s.y - 1, 'Protected', '#9be7ff'); continue; }
      if (g.dw[i] > 5 || e > 0.3) continue;
      const tr = g.tribes[s.tribe];
      const res = (tr.techs['levees'] ? 0.45 : 1) * (s.tribe === 1 ? 0.7 : 1) * g.diff.dmg;
      g.hurt(s, s.pop * 0.5 * t.str * fade * Math.max(0.15, 1 - e / 0.3) * res, 'flood');
      g.burst(s.x, s.y, 14, '#8fd8ff', 3, 1, false, 1);
      g.audio.sfx('splash');
    }
    // flood visuals
    const lo = Math.max(0, Math.floor(t.y - t.r - 2)), hi = Math.min(H - 1, Math.ceil(t.y + t.r + 2));
    for (let y = lo; y <= hi; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (g.dw[i] > 5 || g.h[i] - g.sea > 0.25 || g.h[i] < g.sea) continue;
      const d = g.dist(x + 0.5, y + 0.5, t.x, t.y);
      if (Math.abs(d - t.r) < 1.6) g.flood[i] = 3.5;
    }
  }
  g.tsunamis = g.tsunamis.filter((t) => t.r < t.maxR);
}

// ---------------------------------------------------------------- natural hazards from stress
export function naturalHazards(g: Game, dt: number) {
  if (g.tutShield) return;
  g.quakeCd -= dt;
  const freq = g.diff.freq * (g.hasMod('restless') ? 1.2 : 1);
  if (g.quakeCd <= 0) {
    let best = -1, bi = -1, cand = -1;
    for (let i = 0; i < N; i++) {
      const s = g.stress[i];
      if (s >= 100) { if (s > best) { best = s; bi = i; } }
      else if (s > 70) { const p = Math.pow((s - 70) / 30, 2) * 0.0015 * freq; if (Math.random() < p) cand = i; }
    }
    const pick = bi >= 0 ? bi : cand;
    if (pick >= 0) { quake(g, (pick % W) + 0.5, Math.floor(pick / W) + 0.5, null); g.quakeCd = 2.5; }
  }
  if (g.volcanoes.length < 8) {
    for (let k = 0; k < 10; k++) {
      const i = Math.floor(Math.random() * N);
      if ((g.cnt[i] >= 2 || g.cnt[i] === 0) && g.stress[i] > 55 && g.h[i] > g.sea - 0.45 && Math.random() < 0.006 * freq * ((g.stress[i] - 50) / 50)) {
        spawnVolcano(g, (i % W) + 0.5, Math.floor(i / W) + 0.5, false); break;
      }
    }
  }
}

// ---------------------------------------------------------------- scheduled world events
const EVENTS = [
  { kind: 'sea', w: 3, min: 0, text: 'Distant ice shelves are cracking… the seas will rise.' },
  { kind: 'glacial', w: 2, min: 1, text: 'A bitter wind from the poles… a glacial snap approaches.' },
  { kind: 'drought', w: 2, min: 0, text: 'The skies turn dry and hard… drought approaches.' },
  { kind: 'swarm', w: 3, min: 0, text: 'Faults whisper beneath the crust… a quake swarm approaches.' },
  { kind: 'eruption', w: 2, min: 1, text: 'Magma stirs below the land… an eruption approaches.' },
  { kind: 'tsunami', w: 1.5, min: 1, text: 'The sea draws back from the shore…' },
];

function pickEruptionSite(g: Game) {
  let bx = -1, by = -1, bs = -1;
  for (let k = 0; k < 40; k++) {
    const i = Math.floor(Math.random() * N); if (g.h[i] < g.sea + 0.02) continue;
    const x = (i % W) + 0.5, y = Math.floor(i / W) + 0.5;
    const s = g.nearestSettlement(x, y, 5); if (s) continue;
    const sc = g.stress[i] + Math.random() * 30;
    if (sc > bs) { bs = sc; bx = x; by = y; }
  }
  return bx < 0 ? null : { x: bx, y: by };
}

export function updateEvents(g: Game, dt: number) {
  if (g.state !== 'playing' || g.tutShield) return;
  for (const l of g.loads) {
    l.t -= dt;
    for (let dy = -6; dy <= 6; dy++) {
      const yy = l.y + dy; if (yy < 0 || yy >= H) continue;
      for (let dx = -6; dx <= 6; dx++) {
        const d = Math.hypot(dx, dy); if (d > 6) continue;
        const j = yy * W + mod(l.x + dx, W);
        g.stress[j] = Math.min(140, g.stress[j] + 4 * (1 - d / 6.5) * dt);
      }
    }
  }
  g.loads = g.loads.filter((l) => l.t > 0);
  g.eventT -= dt;
  if (g.eventT <= 0) {
    const era = g.era;
    const base = Math.max(16, 52 - era * 6) * (era >= 4 || g.endless ? 1.5 : 1);
    g.eventT = (base / g.diff.freq) * (0.7 + Math.random() * 0.6);
    const pool = EVENTS.filter((e) => e.min <= Math.min(era, 3));
    let tot = pool.reduce((a, e) => a + e.w, 0), r = Math.random() * tot, ev = pool[0];
    for (const e of pool) { r -= e.w; if (r <= 0) { ev = e; break; } }
    let x = -1, y = -1;
    if (ev.kind === 'eruption') { const p = pickEruptionSite(g); if (!p) return; x = p.x; y = p.y; }
    if (ev.kind === 'tsunami') {
      let best = 1e9;
      for (let k = 0; k < 80; k++) {
        const i = Math.floor(Math.random() * N); if (g.h[i] > g.sea - 0.15) continue;
        const px = (i % W) + 0.5, py = Math.floor(i / W) + 0.5;
        const s = g.nearestSettlement(px, py, 26); if (!s) continue;
        const d = g.dist(px, py, s.x, s.y); if (d < 9) continue;
        if (d < best) { best = d; x = px; y = py; }
      }
      if (x < 0) return;
    }
    tot = 0;
    g.addLog(ev.text, 'bad'); g.warn(ev.text.split('…')[0] + '…', 6);
    g.pending.push({ kind: ev.kind, t: 5.5, x, y });
    if (x >= 0) g.ring(x, y, 8, '#ffcc66', 5.5, 0.2);
  }
  for (const p of g.pending) p.t -= dt;
  const due = g.pending.filter((p) => p.t <= 0);
  g.pending = g.pending.filter((p) => p.t > 0);
  for (const p of due) fireEvent(g, p.kind, p.x, p.y);
}

function fireEvent(g: Game, kind: string, x: number, y: number) {
  switch (kind) {
    case 'sea': {
      const add = 0.05 + g.era * 0.015;
      g.seaTarget = Math.min(0.36, g.seaTarget + add);
      g.seaBase = Math.min(0.3, g.seaBase + add * 0.4);
      g.banner_('Rising Seas', 'Meltwater floods the coasts'); g.audio.sfx('tide'); g.shake = Math.max(g.shake, 0.2); break;
    }
    case 'glacial':
      g.glacialT = 45; g.tempOff = -0.3; g.seaTarget = Math.max(-0.3, g.seaTarget - 0.07);
      g.banner_('Glacial Snap', 'Frost grips the north; the seas retreat'); g.audio.sfx('tide'); break;
    case 'drought':
      g.droughtT = 40; g.banner_('Drought', 'Fields crack far from the sea'); g.audio.sfx('tide');
      for (const t of g.tribes) t.danger.dry += 8; break;
    case 'swarm': {
      const spots: { x: number; y: number }[] = [];
      for (let k = 0; k < 300 && spots.length < 12; k++) {
        const i = Math.floor(Math.random() * N); const xx = i % W, yy = Math.floor(i / W);
        if (xx >= W - 1 || yy >= H - 1) continue;
        const boundary = g.top[i] !== g.top[i + 1] || g.top[i] !== g.top[i + W] || g.cnt[i] !== 1;
        if (boundary) spots.push({ x: xx, y: yy });
      }
      spots.sort((a, b) => (g.nearestSettlement(a.x, a.y, 40) ? g.dist(a.x, a.y, g.nearestSettlement(a.x, a.y, 40)!.x, g.nearestSettlement(a.x, a.y, 40)!.y) : 99) - (g.nearestSettlement(b.x, b.y, 40) ? g.dist(b.x, b.y, g.nearestSettlement(b.x, b.y, 40)!.x, g.nearestSettlement(b.x, b.y, 40)!.y) : 99));
      const chosen = spots.slice(0, 3);
      for (const s of chosen) {
        for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
          const d = Math.hypot(dx, dy); if (d > 5) continue;
          const yy = s.y + dy; if (yy < 0 || yy >= H) continue;
          const j = yy * W + mod(s.x + dx, W); g.stress[j] += 55 * (1 - d / 6);
        }
        g.loads.push({ x: s.x, y: s.y, t: 20 });
        g.ring(s.x, s.y, 6, '#ff6b6b', 1.2);
      }
      g.banner_('Quake Swarm', 'Faults are loading — vent them with Tremor!'); g.audio.sfx('tremor'); break;
    }
    case 'eruption':
      spawnVolcano(g, x, y, false, 1 + g.era * 0.1); g.banner_('Eruption', 'The mountain wakes'); break;
    case 'tsunami':
      quake(g, x, y, 6.1 + Math.random() * 0.6, {}); break;
    default: break;
  }
}

// ---------------------------------------------------------------- the Titan (capstone boss)
export function spawnTitan(g: Game) {
  let bx = W / 2, by = H / 2, bs = -1;
  for (let k = 0; k < 60; k++) {
    const x = Math.random() * W, y = 12 + Math.random() * (H - 24);
    const s = g.nearestSettlement(x, y, 40);
    const d = s ? g.dist(x, y, s.x, s.y) : 40;
    if (d < 11) continue;
    if (d > bs) { bs = d; bx = x; by = y; }
  }
  const max = g.diff.titan;
  g.titan = { x: Math.floor(bx) + 0.5, y: Math.floor(by) + 0.5, hp: max, max, phase: 0, pulseT: 8, tele: 0, dead: false, deadT: 0, born: g.t };
  const cx = Math.floor(bx), cy = Math.floor(by);
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
    const d = Math.hypot(dx, dy); if (d > 5.5) continue;
    const yy = cy + dy; if (yy < 0 || yy >= H) continue;
    g.extra[yy * W + mod(cx + dx, W)] += 0.7 * (1 - d / 6);
  }
  g.banner_('THE TITAN AWAKENS', 'Vent its pressure with Tremors before it tears the world apart');
  g.addLog('The Titan Beneath awakens! Vent its pressure with Tremors.', 'era');
  g.audio.sfx('titan'); g.shake = 1;
  g.ring(g.titan.x, g.titan.y, 20, '#ff4a2a', 2, 0.6);
}

function killTitan(g: Game) {
  const t = g.titan; if (!t) return;
  t.dead = true; t.deadT = 0; t.hp = 0;
  g.shake = 1; g.ring(t.x, t.y, 30, '#ffe9a0', 2.5, 0.6);
  g.burst(t.x, t.y, 120, '#ffd36a', 9, 2, true, 1);
  g.banner_('THE TITAN SLEEPS', 'Calm settles over the crust');
  g.addLog('The Titan is calmed. The world exhales.', 'good');
  g.audio.sfx('quake', 1);
  for (const v of g.volcanoes) if (v.state === 'erupting') { v.state = 'dormant'; v.next = 200; }
  g.pending = [];
}

export function updateTitan(g: Game, dt: number) {
  const t = g.titan; if (!t || g.state !== 'playing') return;
  if (t.dead) { t.deadT += dt; if (t.deadT > 3.5) g.win(); return; }
  t.phase = t.hp / t.max > 0.66 ? 0 : t.hp / t.max > 0.33 ? 1 : 2;
  t.hp = Math.min(t.max, t.hp + 0.8 * dt);
  // pressure generation
  const cx = Math.floor(t.x), cy = Math.floor(t.y), rate = (2.4 + t.phase * 1.4) * (g.diff.freq > 1 ? 1.2 : 1);
  for (let dy = -10; dy <= 10; dy++) {
    const yy = cy + dy; if (yy < 0 || yy >= H) continue;
    for (let dx = -10; dx <= 10; dx++) {
      const d = Math.hypot(dx, dy); if (d > 10) continue;
      const j = yy * W + mod(cx + dx, W);
      g.stress[j] = Math.min(140, g.stress[j] + rate * (1 - d / 12) * dt);
    }
  }
  if (Math.random() < dt * 10) g.particles.push({ x: t.x + (Math.random() - 0.5) * 3, y: t.y, vx: (Math.random() - 0.5), vy: -2 - Math.random() * 2, life: 1.2, max: 1.2, size: 0.3, color: '#ff7a3a', g: 0, add: true });
  const interval = [9, 7, 5][t.phase] / Math.sqrt(g.diff.freq);
  t.pulseT -= dt;
  if (t.tele <= 0 && t.pulseT <= 2.5) { t.tele = 2.5; g.audio.sfx('warn'); g.ring(t.x, t.y, 16, '#ff3a2a', 2.5, 0.3); }
  if (t.tele > 0) {
    t.tele -= dt;
    if (t.tele <= 0) {
      t.tele = 0; t.pulseT = interval;
      g.audio.sfx('pulse'); g.shake = Math.max(g.shake, 0.8);
      g.ring(t.x, t.y, 26, '#ff5a2a', 1.4, 0.6);
      const n = 2 + Math.round(t.phase * 1.5);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * 6.283, r = 4 + Math.random() * 10;
        spawnVolcano(g, t.x + Math.cos(a) * r, t.y + Math.sin(a) * r, false, 0.7);
      }
      quake(g, t.x, t.y, 5.2 + t.phase * 0.6, { titan: true });
      if (t.phase >= 1) {
        g.tsunamis.push({ x: t.x, y: t.y, r: 1, maxR: 40, str: 0.7, hit: new Set() }); g.stats.tsunamis++;
        g.seaTarget = Math.min(0.36, g.seaTarget + (t.phase === 1 ? 0.012 : 0.02));
      }
      const names = TRIBES.map((x) => x.name);
      if (names.length) g.addLog(`The Titan pulses (phase ${t.phase + 1})!`, 'bad');
    }
  }
}
