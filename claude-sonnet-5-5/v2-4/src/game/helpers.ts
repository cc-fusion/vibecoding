import { clamp, DIFFS, STRAINS, TECHS } from "./data";
import type { District, Sim } from "./types";

export function rnd(s: Sim): number {
  // mulberry32 on the sim's own state so runs are reproducible per seed
  s.rs = (s.rs + 0x6d2b79f5) | 0;
  let t = Math.imul(s.rs ^ (s.rs >>> 15), 1 | s.rs);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const diffOf = (s: Sim) => DIFFS.find((d) => d.id === s.cfg.diffId) || DIFFS[1];
export const strainOf = (s: Sim) => STRAINS[Math.min(s.strain, STRAINS.length - 1)];
export const hasMod = (s: Sim, id: string) => s.cfg.mods.includes(id);
export const perk = (s: Sim, id: string) => s.cfg.perks[id] || 0;
export const techCost = (id: string) => TECHS.find((t) => t.id === id)?.cost ?? 0;

export function alive(d: District) { return d.S + d.E + d.I + d.H + d.R; }
export function active(d: District) { return d.E + d.I + d.H; }

export function sfx(s: Sim, name: string) {
  if (s.sfxQueue.length < 24) s.sfxQueue.push(name);
}

export function addLog(s: Sim, text: string, kind: "info" | "warn" | "bad" | "good" | "event" = "info") {
  s.log.unshift({ day: s.day, text, kind });
  if (s.log.length > 80) s.log.length = 80;
}

export function floater(s: Sim, x: number, y: number, text: string, color = "#e8d9b5", size = 14) {
  if (s.vis.floaters.length > 60) s.vis.floaters.shift();
  s.vis.floaters.push({ x, y, text, color, life: 2.2, max: 2.2, size });
}

export function floaterAt(s: Sim, d: District, text: string, color = "#e8d9b5", size = 14) {
  floater(s, d.x + (Math.random() - 0.5) * 0.03, d.y - 0.045, text, color, size);
}

export function burst(s: Sim, x: number, y: number, color: string, n = 14, speed = 0.12) {
  for (let i = 0; i < n; i++) {
    if (s.vis.particles.length > 500) break;
    const a = Math.random() * Math.PI * 2;
    const sp = speed * (0.3 + Math.random());
    s.vis.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.8 + Math.random() * 0.6, max: 1.4, color, size: 1.5 + Math.random() * 2.5 });
  }
}

export function ring(s: Sim, x: number, y: number, color: string, r = 0.07) {
  if (s.vis.rings.length > 20) s.vis.rings.shift();
  s.vis.rings.push({ x, y, r, life: 0.9, max: 0.9, color });
}

export function shake(s: Sim, amt: number) { s.vis.shake = Math.min(26, s.vis.shake + amt); }
export function flash(s: Sim, color: string, a = 0.35) { s.vis.flashColor = color; s.vis.flash = Math.max(s.vis.flash, a); }
export function banner(s: Sim, text: string, sub: string, color = "#e8d9b5") {
  s.vis.banner = text; s.vis.bannerSub = sub; s.vis.bannerT = 4.2; s.vis.bannerColor = color;
}

export function adjTrust(s: Sim, amt: number) {
  s.trust = clamp(s.trust + amt, 0, 100);
  if (s.trust < s.stats.minTrust) s.stats.minTrust = s.trust;
}

export function neighbors(s: Sim, d: District): District[] {
  return d.edges.map((ei) => {
    const e = s.edges[ei];
    return s.districts[e.a === d.id ? e.b : e.a];
  });
}

export function compliance(s: Sim, d: District): number {
  let c = 0.35 + s.trust / 150 - d.panic / 200 - d.rumor / 250;
  if (s.techs.watch) c += 0.15;
  if (d.type === "barracks") c += 0.12;
  else if (neighbors(s, d).some((n) => n.type === "barracks")) c += 0.08;
  return clamp(c, 0.2, 1);
}

export function leak(s: Sim, d: District): number {
  const watch = 1 - 0.12 * perk(s, "watchp");
  return (0.05 + (1 - compliance(s, d)) * 0.45) * (s.techs.protocols ? 0.6 : 1) * watch;
}

export function bedsFor(s: Sim, d: District): number {
  const per = [0, 0.035, 0.07, 0.12][d.hosp] || 0;
  return Math.round(d.pop0 * per * (s.techs.pesthouse ? 1.3 : 1));
}

export function hospitalCost(s: Sim, d: District): number {
  const base = [120, 200, 340][d.hosp] || 0;
  return Math.round(base * (s.techs.pesthouse ? 0.75 : 1) * (1 - 0.1 * perk(s, "charter")));
}

export function totals(s: Sim) {
  let aliveN = 0, dead = 0, act = 0, seen = 0, rec = 0, H = 0, beds = 0;
  for (const d of s.districts) {
    aliveN += alive(d); dead += d.D; act += active(d); seen += d.detected ? d.seenI : 0; rec += d.R; H += d.H; beds += d.beds;
  }
  return { alive: aliveN, dead, active: act, seen, recovered: rec, hospitalized: H, beds };
}

export function avgPanic(s: Sim): number {
  let sum = 0, w = 0;
  for (const d of s.districts) { const a = alive(d); sum += d.panic * a; w += a; }
  return w > 0 ? sum / w : 0;
}

export function resolveEffective(s: Sim): number { return s.techs.adaptive ? 0.9 : s.techs.prototype ? 0.5 : 0; }
