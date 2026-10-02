import { clamp, DTYPES, fmt } from "./data";
import { alive } from "./helpers";
import type { District, Sim } from "./types";

export type Lens = "infection" | "panic" | "rumor" | "hunger";
export interface View { w: number; h: number; t: number; lens: Lens; hoverD: number; hoverE: number; }

export function toScreen(nx: number, ny: number, v: View) {
  return { x: 40 + nx * (v.w - 80), y: 46 + ny * (v.h - 130) };
}

export function nodeRadius(d: District, v: View, n: number) {
  const k = clamp(Math.min(v.w * 0.62, v.h) / 650, 0.6, 1.35) * (n > 15 ? 0.85 : 1);
  return (12 + Math.sqrt(d.pop0 / 1000) * 5.5) * k;
}

export function hitTest(s: Sim, v: View, px: number, py: number): { kind: "d" | "e"; id: number } | null {
  const n = s.districts.length;
  let best: { kind: "d" | "e"; id: number } | null = null, bd = Infinity;
  for (const d of s.districts) {
    const p = toScreen(d.x, d.y, v);
    const dist = Math.hypot(px - p.x, py - p.y);
    if (dist <= nodeRadius(d, v, n) + 10 && dist < bd) { bd = dist; best = { kind: "d", id: d.id }; }
  }
  if (best) return best;
  bd = 11;
  for (const e of s.edges) {
    const a = toScreen(s.districts[e.a].x, s.districts[e.a].y, v);
    const b = toScreen(s.districts[e.b].x, s.districts[e.b].y, v);
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy || 1;
    const t = clamp(((px - a.x) * dx + (py - a.y) * dy) / l2, 0.08, 0.92);
    const dist = Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
    if (dist < bd) { bd = dist; best = { kind: "e", id: e.id }; }
  }
  return best;
}

const blobs = Array.from({ length: 7 }, (_, i) => ({ x: (i * 0.173 + 0.1) % 1, y: (i * 0.311 + 0.2) % 1, r: 0.18 + (i % 3) * 0.08, sp: 0.004 + i * 0.0012 }));
const lensColor = (lens: Lens, d: District): { val: number; color: string } => {
  if (lens === "panic") return { val: d.panic, color: `hsl(${50 - d.panic * 0.5}, 85%, 55%)` };
  if (lens === "rumor") return { val: d.rumor, color: "#a77bd0" };
  return { val: d.hunger * 100, color: "#e08a3f" };
};

function arcSeg(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a0: number, frac: number, color: string) {
  if (frac <= 0.0005) return a0;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.arc(x, y, r, a0, a0 + Math.PI * 2 * Math.min(1, frac));
  ctx.stroke();
  return a0 + Math.PI * 2 * frac;
}

export function draw(ctx: CanvasRenderingContext2D, s: Sim, v: View) {
  const { w, h, t } = v;
  const D = s.districts;
  const n = D.length;
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, Math.max(w, h) * 0.75);
  bg.addColorStop(0, "#241c15"); bg.addColorStop(1, "#0d0a08");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  ctx.save();
  if (s.vis.shake > 0) ctx.translate((Math.random() - 0.5) * s.vis.shake, (Math.random() - 0.5) * s.vis.shake);

  // drifting fog
  const sick = s.bossEmerged ? "120,30,20" : "90,110,60";
  for (const b of blobs) {
    const bx = ((b.x + t * b.sp) % 1.2 - 0.1) * w, by = b.y * h + Math.sin(t * 0.2 + b.x * 9) * 20;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, b.r * w);
    g.addColorStop(0, `rgba(${sick},0.07)`); g.addColorStop(1, `rgba(${sick},0)`);
    ctx.fillStyle = g; ctx.fillRect(bx - b.r * w, by - b.r * w, b.r * w * 2, b.r * w * 2);
  }
  // faint parchment grid
  ctx.strokeStyle = "rgba(180,150,100,0.045)"; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  // ---- edges (the contact graph)
  for (const e of s.edges) {
    const da = D[e.a], db = D[e.b];
    const A = toScreen(da.x, da.y, v), B = toScreen(db.x, db.y, v);
    const tracing = da.trace > 0 || db.trace > 0;
    const f = e.fab + e.fba;
    const hov = v.hoverE === e.id || (s.selected.kind === "e" && s.selected.id === e.id);
    ctx.lineCap = "round";
    ctx.setLineDash(e.closed ? [4, 7] : []);
    ctx.lineWidth = 1 + e.traffic * 2 + (hov ? 1.5 : 0);
    ctx.strokeStyle = e.closed ? "rgba(216,69,47,0.6)" : hov ? "rgba(255,230,170,0.7)" : da.quarantine || db.quarantine ? "rgba(224,165,63,0.3)" : "rgba(190,170,130,0.27)";
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
    ctx.setLineDash([]);
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    if (e.closed) {
      ctx.strokeStyle = "#d8452f"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(mx - 6, my - 6); ctx.lineTo(mx + 6, my + 6); ctx.moveTo(mx + 6, my - 6); ctx.lineTo(mx - 6, my + 6); ctx.stroke();
    }
    if ((e.revealed || tracing) && (f > 0.03 || e.revealed)) {
      const inten = clamp(0.25 + f * 0.1, 0.25, 0.95);
      ctx.strokeStyle = `rgba(255,70,50,${inten * (tracing ? 1 : 0.55)})`;
      ctx.lineWidth = 2 + Math.min(5, f * 0.5);
      if (tracing) { ctx.setLineDash([9, 8]); ctx.lineDashOffset = -t * 28 * (e.fab >= e.fba ? 1 : -1); }
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
      // direction arrow
      const dirAB = e.fab >= e.fba;
      const from = dirAB ? A : B, to = dirAB ? B : A;
      const ang = Math.atan2(to.y - from.y, to.x - from.x);
      const ax = from.x + (to.x - from.x) * 0.58, ay = from.y + (to.y - from.y) * 0.58;
      ctx.fillStyle = `rgba(255,90,70,${inten})`;
      ctx.beginPath();
      ctx.moveTo(ax + Math.cos(ang) * 8, ay + Math.sin(ang) * 8);
      ctx.lineTo(ax + Math.cos(ang + 2.5) * 7, ay + Math.sin(ang + 2.5) * 7);
      ctx.lineTo(ax + Math.cos(ang - 2.5) * 7, ay + Math.sin(ang - 2.5) * 7);
      ctx.closePath(); ctx.fill();
    }
    if (!e.closed) {
      const cnt = e.traffic > 0.7 ? 2 : 1;
      for (let i = 0; i < cnt; i++) {
        let u = (t * 0.1 * (0.6 + e.traffic * 0.5) + i * 0.5 + e.id * 0.37) % 1;
        const forward = (i + e.id) % 2 === 0;
        if (!forward) u = 1 - u;
        const infected = (e.revealed || tracing) && (forward ? e.fab : e.fba) > 0.3;
        ctx.fillStyle = infected ? "#ff5a3a" : "rgba(232,217,181,0.5)";
        ctx.beginPath(); ctx.arc(A.x + (B.x - A.x) * u, A.y + (B.y - A.y) * u, infected ? 2.4 : 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // ---- nodes
  for (const d of D) {
    const p = toScreen(d.x, d.y, v);
    const r = nodeRadius(d, v, n);
    const sel = s.selected.kind === "d" && s.selected.id === d.id;
    const hov = v.hoverD === d.id;
    if (d.panic > 35 && v.lens === "infection") {
      const pa = (d.panic - 35) / 65;
      ctx.fillStyle = `rgba(224,165,63,${0.07 + pa * 0.2 * (0.6 + 0.4 * Math.sin(t * 6 + d.id))})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * (1.5 + pa * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    if (s.bossOrigin.includes(d.id) && s.bossEmerged && alive(d) > 0 && d.I + d.E > 1) {
      ctx.fillStyle = `rgba(255,40,30,${0.12 + 0.08 * Math.sin(t * 4)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.9, 0, Math.PI * 2); ctx.fill();
    }
    if (d.pulse > 0) {
      ctx.strokeStyle = `rgba(255,220,160,${d.pulse})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r + (1 - d.pulse) * 36, 0, Math.PI * 2); ctx.stroke();
    }
    // base
    ctx.fillStyle = "#1c1612";
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    if (v.lens !== "infection") {
      const lc = lensColor(v.lens, d);
      ctx.globalAlpha = 0.15 + (lc.val / 100) * 0.5;
      ctx.fillStyle = lc.color; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.lineWidth = hov ? 2.5 : 1.5; ctx.strokeStyle = hov ? "#fff3d0" : "rgba(232,217,181,0.5)";
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();

    // ring
    ctx.lineWidth = 5; ctx.lineCap = "butt";
    const rr = r - 3;
    if (v.lens === "infection") {
      if (d.detected) {
        let a0 = -Math.PI / 2;
        const p0 = Math.max(1, d.pop0);
        a0 = arcSeg(ctx, p.x, p.y, rr, a0, d.D / p0, "#7d7a74");
        a0 = arcSeg(ctx, p.x, p.y, rr, a0, d.R / p0, "#55b3b0");
        a0 = arcSeg(ctx, p.x, p.y, rr, a0, Math.max(d.seenI > 0.5 ? 0.04 : 0, d.seenI / p0), "#d8452f");
        if (d.trace > 0) a0 = arcSeg(ctx, p.x, p.y, rr, a0, d.E / p0 + 0.01, "#e0a53f");
        arcSeg(ctx, p.x, p.y, rr, a0, 1 - (a0 + Math.PI / 2) / (Math.PI * 2), "rgba(143,207,116,0.6)");
      } else {
        ctx.setLineDash([3, 5]); ctx.strokeStyle = "rgba(200,190,160,0.35)";
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
    } else {
      const lc = lensColor(v.lens, d);
      ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.stroke();
      arcSeg(ctx, p.x, p.y, rr, -Math.PI / 2, lc.val / 100, lc.color);
    }
    ctx.lineCap = "round";

    // icon
    ctx.font = `${Math.round(r * 0.95)}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(DTYPES[d.type].icon, p.x, p.y + 1);

    // quarantine barrier
    if (d.quarantine) {
      ctx.setLineDash([7, 5]); ctx.lineDashOffset = -t * 22; ctx.strokeStyle = "#ff9a4a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 7, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
      ctx.font = "12px serif"; ctx.fillText("🔒", p.x - r - 4, p.y - r - 2);
    }
    if (d.trace > 0) {
      ctx.setLineDash([3, 6]); ctx.lineDashOffset = t * 30; ctx.strokeStyle = "#55b3b0"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 13, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
      ctx.font = "12px serif"; ctx.fillText("🔍", p.x + r + 2, p.y + r);
    }
    if (d.hosp > 0 || d.build) {
      const bx = p.x + r * 0.8, by = p.y - r * 0.8;
      ctx.fillStyle = d.hosp > 0 ? "#2e5d27" : "#5b4515"; ctx.strokeStyle = "#cfe8c0"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(bx, by, 7.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif"; ctx.fillText(d.hosp > 0 ? String(d.hosp) : "⚒", bx, by + 0.5);
      if (d.build) {
        ctx.strokeStyle = "#e0a53f"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(bx, by, 10.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - d.build.left / 3)); ctx.stroke();
      }
    }
    if (sel) {
      ctx.strokeStyle = `rgba(255,243,208,${0.6 + 0.4 * Math.sin(t * 5)})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 17 + Math.sin(t * 5) * 1.5, 0, Math.PI * 2); ctx.stroke();
    }
    // tutorial hint ring on seed
    if (s.cfg.tutorial && s.tutStep === 0 && d.id === s.seedId) {
      ctx.strokeStyle = `rgba(216,69,47,${0.5 + 0.5 * Math.sin(t * 6)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 22 + Math.sin(t * 6) * 4, 0, Math.PI * 2); ctx.stroke();
    }

    // label
    const fs = Math.round(clamp(Math.min(w * 0.7, h) / 56, 10, 13));
    ctx.font = `600 ${fs}px Cinzel, Georgia, serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(10,8,6,0.9)";
    ctx.strokeText(d.name, p.x, p.y + r + 13);
    ctx.fillStyle = "#e8d9b5"; ctx.fillText(d.name, p.x, p.y + r + 13);
    ctx.font = `${fs}px "IM Fell English", Georgia, serif`;
    let sub = "", col = "#a8977a";
    if (v.lens === "infection") {
      if (d.detected) { sub = `${d.trace > 0 ? "" : "~"}${fmt(d.seenI)} ill · † ${fmt(d.D)}`; col = d.seenI > 1 ? "#ff8a6a" : "#8fcf74"; }
      else sub = "no reports";
    } else { const lc = lensColor(v.lens, d); sub = `${Math.round(lc.val)}%`; col = lc.color; }
    ctx.strokeText(sub, p.x, p.y + r + 13 + fs + 2);
    ctx.fillStyle = col; ctx.fillText(sub, p.x, p.y + r + 13 + fs + 2);
  }

  // ---- fx
  for (const rg of s.vis.rings) {
    const p = toScreen(rg.x, rg.y, v);
    ctx.strokeStyle = rg.color; ctx.globalAlpha = clamp(rg.life / rg.max, 0, 1); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, rg.r * Math.min(w, h), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const q of s.vis.particles) {
    const p = toScreen(q.x, q.y, v);
    ctx.globalAlpha = clamp(q.life / q.max, 0, 1) * 0.85;
    ctx.fillStyle = q.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, q.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const f of s.vis.floaters) {
    const p = toScreen(f.x, f.y, v);
    const age = f.max - f.life;
    const pop = age < 0.18 ? 0.6 + (age / 0.18) * 0.5 : 1.1 - Math.min(0.1, (age - 0.18) * 0.2);
    ctx.globalAlpha = clamp(f.life / 0.8, 0, 1);
    ctx.font = `700 ${Math.round(f.size * pop)}px Cinzel, Georgia, serif`;
    ctx.lineWidth = 3.5; ctx.strokeStyle = "rgba(8,6,4,0.95)"; ctx.strokeText(f.text, p.x, p.y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // boss vignette
  if (s.bossEmerged && !s.over) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, "rgba(120,0,0,0)"); g.addColorStop(1, `rgba(150,10,0,${0.28 + 0.1 * Math.sin(t * 2.5)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  if (s.vis.flash > 0) { ctx.globalAlpha = s.vis.flash; ctx.fillStyle = s.vis.flashColor; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }

  // banner
  if (s.vis.bannerT > 0) {
    const a = clamp(Math.min(s.vis.bannerT / 0.5, (4.2 - s.vis.bannerT) / 0.3), 0, 1);
    const ease = 1 - Math.pow(1 - a, 3);
    ctx.globalAlpha = ease;
    const by = h * 0.18 - (1 - ease) * 20;
    const bg2 = ctx.createLinearGradient(0, by - 40, 0, by + 40);
    bg2.addColorStop(0, "rgba(10,6,4,0)"); bg2.addColorStop(0.5, "rgba(10,6,4,0.88)"); bg2.addColorStop(1, "rgba(10,6,4,0)");
    ctx.fillStyle = bg2; ctx.fillRect(0, by - 46, w, 92);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = s.vis.bannerColor; ctx.font = `900 ${Math.round(clamp(w / 28, 18, 34))}px Cinzel, Georgia, serif`;
    ctx.fillText(s.vis.banner, w / 2, by - 8);
    ctx.fillStyle = "#e8d9b5"; ctx.font = `${Math.round(clamp(w / 52, 12, 17))}px "IM Fell English", Georgia, serif`;
    ctx.fillText(s.vis.bannerSub.length > 110 ? s.vis.bannerSub.slice(0, 107) + "…" : s.vis.bannerSub, w / 2, by + 20);
    ctx.globalAlpha = 1;
  }
}
