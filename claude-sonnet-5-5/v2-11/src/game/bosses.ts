import type { Engine, BulOpts } from "./engine";
import type { Enemy } from "./enemies";
import { spawnEnemy } from "./enemies";

export interface BossPhase {
  at: number; // hp fraction at which this phase begins
  name: string;
  enter?: (g: Engine, b: Enemy) => void;
  run: (g: Engine, b: Enemy, dt: number) => void;
}
export interface BossDef {
  id: string; name: string; title: string; hp: number; color: string; accent: string; petals: number; phases: BossPhase[];
}

const TAU = Math.PI * 2;
const angDiff = (a: number, b: number) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

const drift = (b: Enemy, dt: number, amp: number, spd: number, y: number) => {
  const B = b.boss!;
  b.x += (300 + Math.sin(B.pt * spd) * amp - b.x) * Math.min(1, dt * 3);
  b.y += (y - b.y) * Math.min(1, dt * 2);
};
const tick = (b: Enemy, k: number, iv: number, dt: number) => {
  const B = b.boss!;
  B.tms[k] = (B.tms[k] ?? iv * 0.5) - dt;
  if (B.tms[k] <= 0) { B.tms[k] += iv; return true; }
  return false;
};
const ring = (g: Engine, x: number, y: number, n: number, s: number, o: BulOpts, off = 0, gaps: number[] = [], gw = 0) => g.ringFrom(x, y, n, s, o, off, gaps, gw);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const beamCurtain = (g: Engine, n: number, w: number, warn: number, dur: number) => {
  // n beams, spaced so there is always a way through
  const slots = [60, 150, 240, 330, 420, 510].sort(() => Math.random() - 0.5).slice(0, Math.max(2, Math.min(n, 4)));
  g.sfx("beam_warn");
  for (const x of slots) g.beam({ x: x + rnd(-14, 14), y: 0, a: Math.PI / 2, w, warn, dur });
};

export const BOSSES: BossDef[] = [
  {
    id: "bell", name: "The Bell Warden", title: "Keeper of the Ninth Hour", hp: 1800, color: "#d9a441", accent: "#fff0b8", petals: 8,
    phases: [
      {
        at: 1, name: "Matins Toll",
        run: (g, b, dt) => {
          drift(b, dt, 150, 0.5, 130);
          if (tick(b, 0, g.iv(2.4), dt)) { g.sfx("bell"); ring(g, b.x, b.y, 24, 125, { c: 1, r: 5 }, rnd(0, 6), [g.aim(b.x, b.y)], 0.3); }
          if (tick(b, 1, g.iv(4.4), dt)) {
            const a = g.aim(b.x, b.y);
            for (let i = -2; i <= 2; i++) g.bul(b.x, b.y, a + i * 0.15, 285, { c: 0, r: 4, shape: 1 });
          }
        },
      },
      {
        at: 0.6, name: "Pendulum Vespers",
        run: (g, b, dt) => {
          drift(b, dt, 120, 0.4, 120);
          const B = b.boss!;
          if (tick(b, 0, g.iv(0.09), dt)) g.bul(b.x, b.y, Math.PI / 2 + Math.sin(B.pt * 1.5) * 0.95, 205, { c: 0, r: 4 });
          if (tick(b, 1, g.iv(3.2), dt)) { g.sfx("bell"); ring(g, b.x, b.y, 14, 95, { c: 3, r: 9 }, rnd(0, 6)); }
          if (tick(b, 2, g.iv(4.8), dt)) for (let i = 0; i < 3; i++) g.bul(rnd(60, 540), -10, Math.PI / 2, 150, { c: 1, r: 12, sp: 1, st: 1.1, sn: 8 });
        },
      },
      {
        at: 0.25, name: "Midnight Tolling",
        run: (g, b, dt) => {
          drift(b, dt, 90, 0.7, 115);
          const B = b.boss!;
          if (tick(b, 0, g.iv(1.9), dt)) {
            g.sfx("bell");
            const a = g.aim(b.x, b.y), off = rnd(0, 6);
            ring(g, b.x, b.y, 26, 135, { c: 0, r: 5 }, off, [a], 0.3);
            g.later(0.35, () => { if (!b.dead) ring(g, b.x, b.y, 26, 135, { c: 1, r: 5 }, off + TAU / 52, [a], 0.34); });
          }
          if (tick(b, 1, g.iv(1.5), dt)) {
            const a = g.aim(b.x, b.y);
            for (let i = -1; i <= 1; i++) g.bul(b.x, b.y, a + i * 0.1, 305, { c: 4, r: 4, shape: 1 });
          }
          if (tick(b, 2, g.iv(0.15), dt)) g.bul(b.x, b.y, Math.PI / 2 + Math.sin(B.pt * 2.2) * 0.5, 170, { c: 3, r: 4 });
        },
      },
    ],
  },
  {
    id: "choir", name: "Choirmaster Mortis", title: "Conductor of the Last Verse", hp: 3000, color: "#8d5bd6", accent: "#e1ccff", petals: 12,
    phases: [
      {
        at: 1, name: "Kyrie Eleison",
        enter: (g) => { for (let i = 0; i < 4; i++) g.later(i * 0.4, () => spawnEnemy(g, "chorister", 130 + i * 110, -20, i)); },
        run: (g, b, dt) => {
          drift(b, dt, 140, 0.55, 105);
          const B = b.boss!;
          if (tick(b, 0, g.iv(0.085), dt)) { const a0 = B.pt * 2.1; g.bul(b.x, b.y, a0, 150, { c: 3, r: 4 }); g.bul(b.x, b.y, a0 + Math.PI, 150, { c: 3, r: 4 }); }
          if (tick(b, 1, g.iv(3.6), dt)) {
            const a = g.aim(b.x, b.y), n = g.dn(7);
            for (let i = 0; i < n; i++) g.bul(b.x, b.y, a + (i / (n - 1) - 0.5) * 0.95, 165, { c: 1, r: 6 });
          }
        },
      },
      {
        at: 0.62, name: "Dies Irae Verse",
        run: (g, b, dt) => {
          drift(b, dt, 170, 0.45, 100);
          if (tick(b, 0, g.iv(3.8), dt)) beamCurtain(g, 3, 40, 1.15, 0.7);
          if (tick(b, 1, g.iv(0.5), dt)) ring(g, b.x, b.y, 8, 115, { c: 2, r: 5, da: 0.8, sp: 3, st: 1.3 }, rnd(0, 6));
          if (tick(b, 2, g.iv(1.5), dt)) g.bul(b.x, b.y, g.aim(b.x, b.y), 205, { c: 0, r: 10 });
        },
      },
      {
        at: 0.28, name: "Crescendo",
        enter: (g, b) => { b.boss!.tms = []; g.later(0.8, () => { if (!b.dead) g.sfx("warn"); }); },
        run: (g, b, dt) => {
          drift(b, dt, 60, 0.6, 115);
          const B = b.boss!;
          if (tick(b, 0, g.iv(7.5), dt)) {
            const a = rnd(0.4, 2.7);
            g.sfx("beam_warn");
            g.beam({ follow: b, a, w: 30, warn: 1.3, dur: 4, angVel: 0.42 });
            g.beam({ follow: b, a: a + Math.PI, w: 30, warn: 1.3, dur: 4, angVel: 0.42 });
          }
          if (tick(b, 1, g.iv(0.11), dt)) for (let k = 0; k < 3; k++) g.bul(b.x, b.y, B.pt * 1.7 + (k * TAU) / 3, 140, { c: 3, r: 4 });
          if (tick(b, 2, g.iv(0.32), dt)) g.bul(rnd(20, 580), -10, Math.PI / 2, 210, { c: 2, r: 4, shape: 1 });
        },
      },
    ],
  },
  {
    id: "cardinal", name: "The Hollow Cardinal", title: "Bishop of Static Glass", hp: 4800, color: "#e03a55", accent: "#ffe6ea", petals: 6,
    phases: [
      {
        at: 1, name: "Rosette",
        run: (g, b, dt) => {
          drift(b, dt, 0, 1, 140);
          const B = b.boss!;
          if (tick(b, 0, g.iv(0.12), dt)) for (let k = 0; k < 6; k++) g.bul(b.x, b.y, B.pt * 1.1 + (k * TAU) / 6, 95, { c: k % 2 ? 0 : 1, r: 4, ds: 45, smax: 250 });
          if (tick(b, 1, g.iv(4), dt)) { g.sfx("bell"); ring(g, b.x, b.y, 16, 240, { c: 4, r: 4, shape: 1 }, 0, [g.aim(b.x, b.y)], 0.3); }
        },
      },
      {
        at: 0.72, name: "Stained Glass Rain",
        run: (g, b, dt) => {
          drift(b, dt, 220, 0.35, 95);
          const B = b.boss!;
          const safe = 300 + Math.sin(B.pt * 0.55) * 190;
          if (tick(b, 0, g.iv(0.13), dt)) {
            let x = rnd(10, 590), tries = 0;
            while (Math.abs(x - safe) < 62 && tries++ < 8) x = rnd(10, 590);
            g.bul(x, -10, Math.PI / 2, 175 + Math.random() * 80, { c: Math.floor(Math.random() * 6), r: 5, shape: 3 });
          }
          if (tick(b, 1, g.iv(4.8), dt)) for (let i = 0; i < 2; i++) g.bul(b.x, b.y, g.aim(b.x, b.y) + (i - 0.5) * 0.5, 150, { c: 3, r: 12, sp: 1, st: 1.2, sn: 10 });
          if (tick(b, 2, g.iv(2.6), dt)) {
            const a = g.aim(b.x, b.y);
            for (let i = -1; i <= 1; i++) g.bul(b.x, b.y, a + i * 0.12, 290, { c: 4, r: 4, shape: 1 });
          }
        },
      },
      {
        at: 0.46, name: "Judgement Wheel",
        enter: (g, b) => { b.boss!.tms = []; g.later(0.6, () => { if (!b.dead) g.sfx("warn"); }); },
        run: (g, b, dt) => {
          drift(b, dt, 0, 1, 190);
          const B = b.boss!;
          if (tick(b, 0, g.iv(8.5), dt)) {
            g.sfx("beam_warn");
            const base = rnd(0, TAU);
            const dir = Math.random() < 0.5 ? 1 : -1;
            for (let k = 0; k < 4; k++) g.beam({ follow: b, a: base + (k * Math.PI) / 2, w: 28, warn: 1.4, dur: 5.5, angVel: 0.32 * dir });
          }
          if (tick(b, 1, g.iv(2), dt)) { const a = g.aim(b.x, b.y); ring(g, b.x, b.y, 22, 100, { c: 1, r: 5 }, B.pt, [a, a + Math.PI], 0.3); }
          if (tick(b, 2, g.iv(0.7), dt)) g.bul(b.x, b.y, g.aim(b.x, b.y), 245, { c: 0, r: 5 });
        },
      },
      {
        at: 0.2, name: "Dies Irae",
        enter: (g, b) => { b.boss!.tms = []; g.later(0.6, () => { if (!b.dead) g.sfx("warn"); }); },
        run: (g, b, dt) => {
          drift(b, dt, 80, 0.5, 130);
          const B = b.boss!;
          if (tick(b, 0, g.iv(0.1), dt)) { const a0 = B.pt * 2.3; g.bul(b.x, b.y, a0, 150, { c: 0, r: 4 }); g.bul(b.x, b.y, a0 + Math.PI, 150, { c: 3, r: 4 }); }
          if (tick(b, 1, g.iv(1.7), dt)) {
            const a = g.aim(b.x, b.y);
            for (let i = -2; i <= 2; i++) g.bul(b.x, b.y, a + i * 0.13, 325, { c: 4, r: 4, shape: 1 });
          }
          if (tick(b, 2, g.iv(5.2), dt)) beamCurtain(g, 3, 38, 1.1, 0.7);
          if (tick(b, 3, g.iv(2.9), dt)) { g.sfx("bell"); ring(g, b.x, b.y, 20, 112, { c: 3, r: 6 }, rnd(0, 6), [g.aim(b.x, b.y)], 0.34); }
          if (tick(b, 4, g.iv(0.24), dt)) for (let k = 0; k < 4; k++) g.bul(b.x, b.y, -B.pt * 1.3 + (k * TAU) / 4, 100, { c: 1, r: 4, ds: 40, smax: 230 });
        },
      },
    ],
  },
];

export { angDiff };
