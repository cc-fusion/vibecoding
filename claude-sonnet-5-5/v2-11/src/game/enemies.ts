import type { Engine } from "./engine";
import type { BossDef } from "./bosses";

export const W = 600;
export const H = 800;

export interface Enemy {
  id: number; type: string; x: number; y: number; r: number; hp: number; maxHp: number;
  t: number; k: number; tm: number; tm2: number; a: number; ox: number; p1: number; p2: number;
  vx: number; vy: number; flash: number; burn: number; burnDps: number; score: number;
  dead: boolean; haloCd: number; elite: boolean; ramCd: number;
  boss?: { def: BossDef; phase: number; inv: number; pt: number; tms: number[]; introT: number; spin: number };
}

export const ENEMY_BASE: Record<string, { hp: number; r: number; score: number; elite?: boolean }> = {
  cherub: { hp: 6, r: 12, score: 100 },
  chorister: { hp: 10, r: 11, score: 80 },
  zealot: { hp: 14, r: 12, score: 140 },
  thurifer: { hp: 26, r: 15, score: 300 },
  sentinel: { hp: 90, r: 20, score: 600, elite: true },
  weaver: { hp: 22, r: 13, score: 250 },
  bellringer: { hp: 190, r: 24, score: 1500, elite: true },
};

let EID = 1;

export function spawnEnemy(g: Engine, type: string, x: number, y: number, p1 = 0): Enemy {
  const b = ENEMY_BASE[type];
  const hp = Math.max(1, Math.round(b.hp * g.hpScale));
  const e: Enemy = {
    id: EID++, type, x, y, r: b.r, hp, maxHp: hp, t: 0, k: 0, tm: 0.6 + Math.random() * 0.8, tm2: 0, a: 0, ox: x, p1, p2: Math.random() * 6,
    vx: 0, vy: 0, flash: 0, burn: 0, burnDps: 0, score: b.score, dead: false, haloCd: 0, elite: !!b.elite, ramCd: 0,
  };
  if (type === "weaver") { e.vx = x < W / 2 ? 105 : -105; e.tm2 = 2.5; }
  if (type === "thurifer") e.p1 = 110 + Math.random() * 90;
  if (type === "sentinel") e.p1 = 120 + Math.random() * 40;
  if (type === "bellringer") e.p1 = 130;
  g.enemies.push(e);
  return e;
}

export function updateEnemy(g: Engine, e: Enemy, dt: number) {
  e.t += dt;
  const act = g.act;
  switch (e.type) {
    case "cherub": {
      e.y += (95 + act * 8) * dt;
      e.x = e.ox + Math.sin(e.t * 2 + e.p2) * 55;
      e.tm -= dt;
      if (e.tm <= 0 && e.y > 20 && e.y < H - 220) {
        e.tm = g.iv(1.7 + Math.random() * 0.7);
        const a = g.aim(e.x, e.y);
        const n = act >= 2 ? 3 : 2;
        for (let i = 0; i < n; i++) g.bul(e.x, e.y, a + (i - (n - 1) / 2) * 0.17, 200, { c: 0, r: 5 });
      }
      if (e.y > H + 30) e.dead = true;
      break;
    }
    case "chorister": {
      e.y += 78 * dt;
      e.x = e.ox + Math.sin(e.t * 2.1 + e.p1) * 70;
      e.tm -= dt;
      if (e.tm <= 0 && e.y > 10) {
        e.tm = g.iv(1.4);
        g.bul(e.x, e.y, Math.PI / 2, 190, { c: 1, r: 4 });
      }
      if (e.y > H + 30) e.dead = true;
      break;
    }
    case "zealot": {
      if (e.k === 0) {
        e.y += 170 * dt;
        e.x += Math.sin(e.t * 3 + e.p2) * 30 * dt;
        if (e.y > 90 + (e.p2 % 3) * 40) { e.k = 1; e.tm = 0.65; }
      } else if (e.k === 1) {
        e.tm -= dt;
        e.a = g.aim(e.x, e.y);
        if (e.tm <= 0) { e.k = 2; e.tm = 2.4; g.sfx("beam_warn"); }
      } else {
        e.x += Math.cos(e.a) * 400 * dt;
        e.y += Math.sin(e.a) * 400 * dt;
        e.tm -= dt;
      }
      if (e.y > H + 40 || e.y < -80 || e.x < -60 || e.x > W + 60 || (e.k === 2 && e.tm <= 0)) e.dead = true;
      break;
    }
    case "thurifer": {
      if (e.k === 0) {
        e.y += 120 * dt;
        if (e.y >= e.p1) { e.k = 1; e.tm2 = 0; }
      } else {
        e.x = e.ox + Math.sin(e.t * 0.8) * 45;
        e.tm2 += dt;
        e.tm -= dt;
        if (e.tm <= 0) {
          e.tm = g.iv(0.14);
          e.a += 0.52;
          g.bul(e.x, e.y, e.a, 135, { c: 3, r: 4.5 });
          if (act >= 2) g.bul(e.x, e.y, e.a + Math.PI, 135, { c: 3, r: 4.5 });
        }
        if (e.tm2 > 11) e.y -= 130 * dt;
      }
      if (e.y < -40 && e.t > 3) e.dead = true;
      break;
    }
    case "sentinel": {
      if (e.k === 0) {
        e.y += 65 * dt;
        if (e.y >= e.p1) { e.k = 1; e.tm = 0.8; e.tm2 = 0; }
      } else {
        e.tm2 += dt;
        e.x = e.ox + Math.sin(e.t * 0.5) * 30;
        e.tm -= dt;
        if (e.tm <= 0) {
          e.tm = g.iv(2.7);
          const a = g.aim(e.x, e.y);
          const off = Math.random() * 6;
          g.ringFrom(e.x, e.y, 16, 120, { c: 1, r: 5 }, off, [a], 0.34);
          g.later(0.45, () => { if (!e.dead) g.ringFrom(e.x, e.y, 16, 120, { c: 0, r: 5 }, off + Math.PI / 16, [g.aim(e.x, e.y)], 0.34); });
        }
        if (e.tm2 > 22) e.y -= 100 * dt;
      }
      if (e.y < -50 && e.t > 4) e.dead = true;
      break;
    }
    case "weaver": {
      e.x += e.vx * dt;
      e.y = 95 + (e.p2 % 3) * 38 + Math.sin(e.t * 1.5) * 12;
      e.tm -= dt;
      if (e.tm <= 0 && e.x > 20 && e.x < W - 20) {
        e.tm = g.iv(1.7);
        const n = g.dn(7);
        for (let i = 0; i < n; i++) g.bul(e.x, e.y, Math.PI / 2 + (i / (n - 1) - 0.5) * 1.5, 225, { c: 2, r: 4, shape: 1 });
      }
      if (act >= 2) {
        e.tm2 -= dt;
        if (e.tm2 <= 0 && e.x > 40 && e.x < W - 40) {
          e.tm2 = g.iv(5.5);
          g.beam({ x: e.x, y: e.y, a: Math.PI / 2, w: 26, warn: 0.95, dur: 0.5 });
        }
      }
      if (e.x < -60 || e.x > W + 60) e.dead = true;
      break;
    }
    case "bellringer": {
      if (e.k === 0) {
        e.y += 55 * dt;
        if (e.y >= e.p1) { e.k = 1; e.tm = 1.2; e.tm2 = 3; }
      } else {
        e.x = 300 + Math.sin(e.t * 0.4) * 150;
        e.tm -= dt;
        e.tm2 -= dt;
        if (e.tm <= 0) {
          e.tm = g.iv(3.1);
          g.sfx("bell");
          const a = g.aim(e.x, e.y);
          const off = Math.random() * 6;
          g.ringFrom(e.x, e.y, 20, 118, { c: 3, r: 6 }, off, [a], 0.32);
          g.later(0.35, () => { if (!e.dead) g.ringFrom(e.x, e.y, 20, 118, { c: 1, r: 6 }, off + Math.PI / 20, [a + 0.5, a - 0.5], 0.2); });
        }
        if (e.tm2 <= 0) {
          e.tm2 = 8;
          spawnEnemy(g, "cherub", e.x - 40, e.y);
          spawnEnemy(g, "cherub", e.x + 40, e.y);
        }
        if (e.t > 28) e.y -= 90 * dt;
      }
      if (e.y < -60 && e.t > 5) e.dead = true;
      break;
    }
  }
}

function poly(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, n: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i * Math.PI * 2) / n;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  const { x, y, r } = e;
  const f = e.flash > 0;
  ctx.save();
  ctx.translate(x, y);
  const fill = (c: string) => (f ? "#ffffff" : c);
  ctx.lineWidth = 2;
  switch (e.type) {
    case "cherub": {
      const flap = Math.sin(e.t * 12) * 0.35;
      ctx.fillStyle = fill("#ffd9e8");
      for (const s of [-1, 1]) {
        ctx.save(); ctx.scale(s, 1); ctx.rotate(flap);
        ctx.beginPath(); ctx.moveTo(4, -2); ctx.quadraticCurveTo(26, -16, 20, 8); ctx.quadraticCurveTo(12, 2, 4, 6); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = fill("#fff4f8"); ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
      ctx.fillStyle = "#ff3b5c"; ctx.beginPath(); ctx.arc(0, 2, 3, 0, 7); ctx.fill();
      break;
    }
    case "chorister": {
      ctx.fillStyle = fill("#ffb43b"); ctx.strokeStyle = "#fff0c0";
      poly(ctx, 0, 0, r, 4, Math.PI / 4 + Math.sin(e.t * 3) * 0.2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#3a1500"; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill();
      break;
    }
    case "zealot": {
      ctx.rotate(e.k === 0 ? Math.PI / 2 : e.a);
      ctx.fillStyle = fill(e.k === 1 && Math.floor(e.t * 16) % 2 ? "#ffffff" : "#ff3b3b"); ctx.strokeStyle = "#ffc0c0";
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-4, 0); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case "thurifer": {
      ctx.rotate(e.t * 1.5);
      ctx.strokeStyle = "#d6b8ff"; ctx.fillStyle = fill("#5a2d9e");
      poly(ctx, 0, 0, r, 6, 0); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.stroke();
      ctx.fillStyle = fill("#e9d6ff"); ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill();
      break;
    }
    case "sentinel": {
      ctx.strokeStyle = "#f6d37a"; ctx.lineWidth = 3; ctx.fillStyle = fill("#33406e");
      poly(ctx, 0, 0, r, 6, Math.PI / 6); ctx.fill(); ctx.stroke();
      ctx.rotate(-e.t * 0.8); ctx.fillStyle = fill("#7da2ff"); poly(ctx, 0, 0, r * 0.5, 3, 0); ctx.fill();
      break;
    }
    case "weaver": {
      ctx.rotate(Math.sin(e.t * 2) * 0.25);
      ctx.strokeStyle = "#52e5ff"; ctx.fillStyle = fill("#0f4b63");
      ctx.beginPath(); ctx.arc(0, 0, r, 0.2, Math.PI * 2 - 0.2); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r); ctx.stroke();
      break;
    }
    case "bellringer": {
      ctx.fillStyle = fill("#d9a441"); ctx.strokeStyle = "#fff0b8";
      ctx.beginPath(); ctx.moveTo(-r, r * 0.6); ctx.quadraticCurveTo(-r, -r, 0, -r); ctx.quadraticCurveTo(r, -r, r, r * 0.6); ctx.lineTo(r * 1.2, r * 0.8); ctx.lineTo(-r * 1.2, r * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#4a2a00"; ctx.beginPath(); ctx.arc(Math.sin(e.t * 3) * 6, r * 0.9, 5, 0, 7); ctx.fill();
      break;
    }
  }
  ctx.restore();
  if (e.elite && !e.boss) {
    const w = 40, hpf = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x - w / 2, y - r - 12, w, 4);
    ctx.fillStyle = "#ff5d7a"; ctx.fillRect(x - w / 2, y - r - 12, w * hpf, 4);
  }
  if (e.burn > 0) {
    ctx.fillStyle = "rgba(255,140,40,0.55)";
    ctx.beginPath(); ctx.arc(x + Math.sin(e.t * 20) * 3, y - r * 0.4, r * 0.55, 0, 7); ctx.fill();
  }
}
