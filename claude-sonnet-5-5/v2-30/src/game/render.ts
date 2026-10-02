import { EDGES, RECT, ROLES, ROOMS, ROOM_MAP, WORLD_H, WORLD_W, type RoomId } from "./data";
import type { Game, Npc } from "./engine";

export interface View {
  w: number;
  h: number;
  dpr: number;
  hoverNpc: number | null;
  hoverRoom: RoomId | null;
  hoverSquad: number | null;
  showWeb: boolean;
  shake: boolean;
  mx: number; // pointer, screen px
  my: number;
  pointerIn: boolean;
}

export function layoutOf(w: number, h: number) {
  const s = Math.max(0.1, Math.min(w / WORLD_W, h / WORLD_H));
  return { s, ox: (w - WORLD_W * s) / 2, oy: (h - WORLD_H * s) / 2 };
}
export function toWorld(px: number, py: number, w: number, h: number) {
  const { s, ox, oy } = layoutOf(w, h);
  return { x: (px - ox) / s, y: (py - oy) / s };
}

const EMOJI = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function crownColor(v: number) {
  return v > 70 ? "#5aa0e8" : v > 45 ? "#c9c36a" : v > 25 ? "#e08a3c" : "#e04a4a";
}

export function roomAt(wx: number, wy: number): RoomId | null {
  for (const r of ROOMS) {
    const q = RECT[r.id];
    if (wx >= q.x && wx <= q.x + q.w && wy >= q.y && wy <= q.y + q.h) return r.id;
  }
  return null;
}

export function npcAt(g: Game, wx: number, wy: number): Npc | null {
  let best: Npc | null = null, bd = 17 * 17;
  for (const n of g.npcs) {
    if (n.status === "dead") continue;
    const d = (n.x - wx) ** 2 + (n.y - wy) ** 2;
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

export function squadAt(g: Game, wx: number, wy: number): number | null {
  const c = g.coup;
  if (!c) return null;
  for (const s of c.squads) {
    if (s.side !== "rebel" || s.count <= 0.05) continue;
    if (Math.abs(s.x - wx) < 20 && Math.abs(s.y - wy) < 13) return s.id;
  }
  return null;
}

export function draw(ctx: CanvasRenderingContext2D, g: Game, v: View) {
  const { w, h, dpr } = v;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // backdrop
  const bg = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, Math.max(w, h) * 0.75);
  bg.addColorStop(0, "#1a1420");
  bg.addColorStop(1, "#08060a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const { s, ox, oy } = layoutOf(w, h);
  const sh = v.shake && g.fx.shake > 0 ? g.fx.shake : 0;
  ctx.save();
  ctx.translate(ox + (sh ? (Math.random() - 0.5) * sh : 0), oy + (sh ? (Math.random() - 0.5) * sh : 0));
  ctx.scale(s, s);
  const T = g.realT;
  const coup = g.coup;

  // corridors
  ctx.lineCap = "round";
  for (const [a, b] of EDGES) {
    const p = RECT[a], q = RECT[b];
    ctx.strokeStyle = "#0e0a12";
    ctx.lineWidth = 22;
    ctx.beginPath(); ctx.moveTo(p.cx, p.cy); ctx.lineTo(q.cx, q.cy); ctx.stroke();
    ctx.strokeStyle = "#2a2133";
    ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(p.cx, p.cy); ctx.lineTo(q.cx, q.cy); ctx.stroke();
  }

  const sel = g.npc(g.selected);
  const abilityRoom = sel && sel.status === "conspirator" ? ROLES[sel.role].ability?.room : undefined;

  // rooms
  for (const def of ROOMS) {
    const r = RECT[def.id];
    const hover = v.hoverRoom === def.id;
    const owner = coup ? coup.owner[def.id] : "crown";
    const grd = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    grd.addColorStop(0, def.color);
    grd.addColorStop(1, "#120d16");
    rr(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fillStyle = grd;
    ctx.fill();
    // floor pattern
    ctx.save();
    rr(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let gx = r.x; gx < r.x + r.w; gx += 26) { ctx.beginPath(); ctx.moveTo(gx, r.y); ctx.lineTo(gx, r.y + r.h); ctx.stroke(); }
    for (let gy = r.y; gy < r.y + r.h; gy += 26) { ctx.beginPath(); ctx.moveTo(r.x, gy); ctx.lineTo(r.x + r.w, gy); ctx.stroke(); }
    if (owner === "rebel") { ctx.fillStyle = "rgba(227,185,90,0.14)"; ctx.fillRect(r.x, r.y, r.w, r.h); }
    if (hover) { ctx.fillStyle = "rgba(255,240,200,0.07)"; ctx.fillRect(r.x, r.y, r.w, r.h); }
    // combat flash
    if (coup) {
      const fighting = coup.squads.some((q) => q.room === def.id && q.path.length === 0 && q.flash > 0.1);
      if (fighting) { ctx.fillStyle = `rgba(255,70,50,${0.08 + 0.08 * Math.sin(T * 18)})`; ctx.fillRect(r.x, r.y, r.w, r.h); }
    }
    ctx.restore();
    // border
    let bc = "#5a4a34", bw = 2;
    if (owner === "rebel") { bc = "#e3b95a"; bw = 3; }
    if (hover) { bc = "#fff0c8"; bw = 3; }
    if (abilityRoom && (abilityRoom === def.id || abilityRoom === "any")) { bc = `rgba(255,214,120,${0.55 + 0.4 * Math.sin(T * 4)})`; bw = 3; }
    if (sel && sel.room === def.id && !sel.moving) { bc = "#ffffff"; bw = 2.5; }
    rr(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.strokeStyle = bc;
    ctx.lineWidth = bw;
    ctx.stroke();
    // label
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = `15px ${EMOJI}`;
    ctx.fillStyle = "#fff";
    ctx.fillText(def.icon, r.x + 10, r.y + 16);
    ctx.font = '600 12px "Cinzel", Georgia, serif';
    ctx.fillStyle = owner === "rebel" ? "#ffe08a" : "#cdbd9a";
    ctx.fillText(def.name.toUpperCase(), r.x + 32, r.y + 17);
    // torches
    const fl = 0.7 + 0.3 * Math.sin(T * 9 + r.x);
    for (const [tx, ty] of [[r.x + 8, r.y + r.h - 8], [r.x + r.w - 8, r.y + 8]] as [number, number][]) {
      const gl = ctx.createRadialGradient(tx, ty, 0, tx, ty, 26);
      gl.addColorStop(0, `rgba(255,170,70,${0.38 * fl})`);
      gl.addColorStop(1, "rgba(255,170,70,0)");
      ctx.fillStyle = gl;
      ctx.fillRect(tx - 26, ty - 26, 52, 52);
      ctx.fillStyle = `rgba(255,200,110,${0.9 * fl})`;
      ctx.beginPath(); ctx.arc(tx, ty, 2.2, 0, 7); ctx.fill();
    }
    // ability star
    if (abilityRoom && (abilityRoom === def.id)) {
      ctx.font = `12px ${EMOJI}`;
      ctx.fillStyle = "#ffd27a";
      ctx.textAlign = "right";
      ctx.fillText("✦ power", r.x + r.w - 8, r.y + 17);
      ctx.textAlign = "left";
    }
    // garrison dots (coup)
    if (coup) {
      const gcount = coup.garrison[def.id];
      if (gcount > 0.05) {
        const n = Math.min(12, Math.ceil(gcount));
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = "#c0334a";
          ctx.strokeStyle = "#ff9aa8";
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(r.x + r.w - 14 - i * 9, r.y + 36, 3.4, 0, 7); ctx.fill(); ctx.stroke();
        }
        ctx.font = '700 11px "Cinzel", serif';
        ctx.fillStyle = "#ffb0ba";
        ctx.textAlign = "right";
        ctx.fillText(`🛡 ${gcount.toFixed(0)}`, r.x + r.w - 10, r.y + 52);
        ctx.textAlign = "left";
      }
    }
  }

  // social web
  const webNpc = sel ?? g.npc(v.hoverNpc);
  const lines = (n: Npc, alpha: number) => {
    for (const rel of n.relations) {
      const o = g.npc(rel.id);
      if (!o || o.status === "dead") continue;
      ctx.strokeStyle = rel.kind === "ally" ? `rgba(110,220,140,${alpha})` : rel.kind === "rival" ? `rgba(230,90,90,${alpha})` : `rgba(240,130,200,${alpha})`;
      ctx.lineWidth = 1.6;
      ctx.setLineDash(rel.kind === "rival" ? [4, 4] : []);
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(o.x, o.y); ctx.stroke();
    }
    ctx.setLineDash([]);
  };
  if (v.showWeb) g.npcs.forEach((n) => { if (n.status !== "dead") lines(n, 0.28); });
  if (webNpc && webNpc.status !== "dead") lines(webNpc, 0.85);

  // order previews
  if (g.phase === "plan" && sel && sel.status === "conspirator" && v.hoverRoom && !g.targeting) {
    const r = RECT[v.hoverRoom];
    ctx.strokeStyle = "rgba(227,185,90,0.8)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -T * 20;
    ctx.beginPath(); ctx.moveTo(sel.x, sel.y); ctx.lineTo(r.cx, r.cy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `20px ${EMOJI}`;
    ctx.textAlign = "center";
    ctx.fillText("📍", r.cx, r.cy - 4 + Math.sin(T * 5) * 2);
    ctx.textAlign = "left";
  }
  if (coup && coup.sel.length && v.hoverRoom) {
    const r = RECT[v.hoverRoom];
    coup.squads.filter((q) => coup.sel.includes(q.id)).forEach((q) => {
      ctx.strokeStyle = "rgba(255,224,138,0.7)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -T * 24;
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(r.cx, r.cy); ctx.stroke();
    });
    ctx.setLineDash([]);
  }
  // squad planned paths
  if (coup) {
    coup.squads.forEach((q) => {
      if (q.path.length === 0 || q.count <= 0.05) return;
      ctx.strokeStyle = q.side === "rebel" ? "rgba(227,185,90,0.5)" : "rgba(255,90,90,0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(q.x, q.y);
      q.path.forEach((rid) => ctx.lineTo(RECT[rid].cx, RECT[rid].cy + 24));
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  // NPC tokens
  const rumorKnown = new Set<number>();
  g.rumors.forEach((r) => r.known.forEach((id) => rumorKnown.add(id)));
  const ordered = g.npcs.filter((n) => n.status !== "dead").sort((a, b) => a.y - b.y);
  for (const n of ordered) drawNpc(ctx, g, n, v, T, rumorKnown.has(n.id));

  // squads
  if (coup) {
    for (const q of coup.squads) {
      if (q.count <= 0.05) continue;
      const rebel = q.side === "rebel";
      const selected = coup.sel.includes(q.id);
      const bw = 34, bh = 20;
      ctx.save();
      ctx.translate(q.x, q.y);
      const bob = q.path.length ? Math.sin(T * 10 + q.id) * 1.5 : 0;
      ctx.translate(0, bob);
      rr(ctx, -bw / 2, -bh / 2, bw, bh, 5);
      ctx.fillStyle = q.flash > 0.3 ? "#fff" : rebel ? "#6b4d12" : "#6e1626";
      ctx.fill();
      ctx.strokeStyle = rebel ? "#ffd56a" : "#ff6a7a";
      ctx.lineWidth = selected ? 3 : 1.6;
      ctx.stroke();
      if (selected) { ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(T * 8)})`; ctx.lineWidth = 1.5; rr(ctx, -bw / 2 - 4, -bh / 2 - 4, bw + 8, bh + 8, 8); ctx.stroke(); }
      ctx.fillStyle = rebel ? "#fff1c2" : "#ffd0d6";
      ctx.font = '700 12px "Cinzel", serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${rebel ? "⚑" : "🛡"}${Math.ceil(q.count)}`, 0, 1);
      ctx.restore();
    }
    // champion bar + monarch capture ring
    const mon = g.byRole("monarch");
    if (mon) {
      if (coup.capture > 0) {
        ctx.strokeStyle = "#ffe08a";
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(coup.mx, coup.my, 24, -Math.PI / 2, -Math.PI / 2 + (coup.capture / 4) * Math.PI * 2); ctx.stroke();
      }
    }
    if (coup.champHp > 0) {
      const bx = coup.mx - 26, by = coup.my - 34;
      ctx.fillStyle = "#1a0f14"; ctx.fillRect(bx, by, 52, 6);
      ctx.fillStyle = coup.fury ? "#ff3b3b" : "#d05a6a"; ctx.fillRect(bx, by, 52 * (coup.champHp / Math.max(1, coup.champMax)), 6);
      ctx.strokeStyle = "#ffb0ba"; ctx.lineWidth = 1; ctx.strokeRect(bx, by, 52, 6);
    }
  }

  // fx
  for (const p of g.fx.particles) {
    const k = 1 - p.t / p.life;
    ctx.globalAlpha = Math.max(0, p.kind === "dust" ? k * 0.35 : k);
    ctx.fillStyle = p.color;
    if (p.kind === "coin") { ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.kind === "smoke" ? 1 + (1 - k) * 2 : 1), 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  for (const r of g.fx.rings) {
    const k = r.t / r.life;
    const e = 1 - Math.pow(1 - k, 3);
    ctx.strokeStyle = r.color;
    ctx.globalAlpha = 1 - k;
    ctx.lineWidth = 3 * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(r.x, r.y, 8 + r.r * e, 0, 7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const f of g.fx.floaters) {
    const k = f.t / f.life;
    const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : 1.15 - Math.min(0.15, (k - 0.12) * 0.4);
    ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    ctx.font = `700 ${f.size * pop}px "Crimson Text", Georgia, serif, ${EMOJI}`;
    const y = f.y - 40 * (1 - Math.pow(1 - k, 2));
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.strokeText(f.text, f.x, y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, y);
  }
  ctx.globalAlpha = 1;

  // night
  const nt = g.nightness();
  if (nt > 0.01) {
    ctx.fillStyle = `rgba(10,14,48,${0.38 * nt})`;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }
  ctx.restore();

  // vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.8);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, g.evidence > 70 ? `rgba(120,10,30,${0.25 + 0.15 * Math.sin(T * 4)})` : "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  if (g.fx.flash > 0.01) {
    ctx.globalAlpha = Math.min(1, g.fx.flash);
    ctx.fillStyle = g.fx.flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // tooltip
  if (v.pointerIn) drawTooltip(ctx, g, v);
}

function drawNpc(ctx: CanvasRenderingContext2D, g: Game, n: Npc, v: View, T: number, hasRumor: boolean) {
  const def = ROLES[n.role];
  const r = 12.5;
  const sel = g.selected === n.id;
  const hov = v.hoverNpc === n.id;
  const x = n.x, y = n.y + (n.moving ? Math.sin(T * 12 + n.id) * 1.2 : 0);
  ctx.save();
  ctx.translate(x, y);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath(); ctx.ellipse(0, r - 1, r * 0.9, 4, 0, 0, 7); ctx.fill();
  const tgt = g.targeting;
  const eligible = tgt && n.id !== tgt.spreader && (n.status === "free" || n.status === "conspirator") && n.role !== "monarch";
  if (eligible) {
    ctx.strokeStyle = `rgba(201,166,255,${0.5 + 0.5 * Math.sin(T * 7)})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, 7); ctx.stroke();
  }
  if (sel || hov) {
    ctx.strokeStyle = sel ? `rgba(255,255,255,${0.7 + 0.3 * Math.sin(T * 6)})` : "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r + 4 + (sel ? Math.sin(T * 6) : 0), 0, 7); ctx.stroke();
  }
  if (n.role === "monarch") {
    const gl = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
    gl.addColorStop(0, "rgba(255,210,100,0.5)");
    gl.addColorStop(1, "rgba(255,210,100,0)");
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7);
  ctx.fillStyle = n.status === "arrested" ? "#2e2e32" : n.status === "conspirator" ? "#3d2e0e" : "#1d1823";
  ctx.fill();
  ctx.lineWidth = n.status === "conspirator" ? 3 : 2;
  ctx.strokeStyle = n.status === "conspirator" ? "#e3b95a" : n.status === "arrested" ? "#777" : def.color;
  if (n.status === "arrested") ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `15px ${EMOJI}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = n.status === "arrested" ? 0.55 : 1;
  ctx.fillStyle = "#fff";
  ctx.fillText(def.icon, 0, 1);
  ctx.globalAlpha = 1;
  // exposure arc
  if (n.status === "conspirator" && n.exposure > 1) {
    ctx.strokeStyle = n.exposure > 60 ? "#ff3b3b" : "#ff9a4d";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r + 2.5, -Math.PI / 2, -Math.PI / 2 + (Math.min(100, n.exposure) / 100) * Math.PI * 2); ctx.stroke();
  }
  // loyalty bar if known
  if (n.known && n.status === "free" && n.role !== "monarch") {
    ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(-10, r + 3, 20, 3);
    ctx.fillStyle = crownColor(n.crown); ctx.fillRect(-10, r + 3, 20 * (n.crown / 100), 3);
  }
  // badges
  if (hasRumor) { ctx.font = "9px sans-serif"; ctx.fillStyle = "#c9a6ff"; ctx.beginPath(); ctx.arc(r - 1, -r + 1, 4, 0, 7); ctx.fill(); ctx.fillStyle = "#1a1030"; ctx.fillText("…", r - 1, -r - 1); }
  if (n.status === "conspirator" && n.post) { ctx.font = `10px ${EMOJI}`; ctx.fillText("📍", -r + 1, -r); }
  if (n.heat > 40 || n.disgrace > 40) { ctx.font = `10px ${EMOJI}`; ctx.fillText("⚠️", 0, -r - 7); }
  if (n.status === "arrested") { ctx.font = `10px ${EMOJI}`; ctx.fillText("⛓️", r - 2, r - 2); }
  if (n.coerced && n.status === "conspirator") { ctx.font = `9px ${EMOJI}`; ctx.fillText("🩸", r - 2, r - 2); }
  if (sel || hov) {
    ctx.font = '700 12px "Crimson Text", Georgia, serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.9)";
    ctx.strokeText(n.name, 0, -r - 14);
    ctx.fillStyle = "#fff4d6";
    ctx.fillText(n.name, 0, -r - 14);
  }
  ctx.restore();
}

function drawTooltip(ctx: CanvasRenderingContext2D, g: Game, v: View) {
  let l1 = "", l2 = "";
  const n = g.npc(v.hoverNpc);
  if (n) {
    const d = ROLES[n.role];
    l1 = `${d.icon} ${n.name} — ${d.title}`;
    l2 = n.status === "conspirator" ? "Your agent" : n.status === "arrested" ? "Imprisoned" : n.known ? "Click to inspect" : "Unknown depths — Eavesdrop to learn more";
    if (g.phase === "coup") l2 = n.status === "conspirator" ? "Rebel leader" : "";
  } else if (v.hoverSquad !== null && g.coup) {
    const q = g.coup.squads.find((s) => s.id === v.hoverSquad);
    if (q) { l1 = `⚑ ${q.name} ×${Math.ceil(q.count)}`; l2 = "Click to select, then click a room"; }
  } else if (v.hoverRoom) {
    const rd = ROOM_MAP[v.hoverRoom];
    l1 = `${rd.icon} ${rd.name}`;
    l2 = rd.desc;
  }
  if (!l1) return;
  ctx.save();
  ctx.font = '700 13px "Crimson Text", Georgia, serif, ' + EMOJI;
  const w1 = ctx.measureText(l1).width;
  ctx.font = '12px "Crimson Text", Georgia, serif';
  const w2 = l2 ? ctx.measureText(l2).width : 0;
  const bw = Math.min(v.w - 10, Math.max(w1, w2) + 20), bh = l2 ? 44 : 28;
  let bx = v.mx + 16, by = v.my + 16;
  if (bx + bw > v.w - 4) bx = v.mx - bw - 12;
  if (by + bh > v.h - 4) by = v.my - bh - 12;
  bx = Math.max(4, bx); by = Math.max(4, by);
  rr(ctx, bx, by, bw, bh, 7);
  ctx.fillStyle = "rgba(14,10,18,0.94)";
  ctx.fill();
  ctx.strokeStyle = "#a8823a";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff0c8";
  ctx.font = '700 13px "Crimson Text", Georgia, serif, ' + EMOJI;
  ctx.fillText(l1, bx + 10, by + 14);
  if (l2) { ctx.fillStyle = "#b9ab8c"; ctx.font = '12px "Crimson Text", Georgia, serif'; ctx.fillText(l2, bx + 10, by + 31); }
  ctx.restore();
}
