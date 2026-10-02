import { ROOMS, HALL, WORLD, DOOR_W, doorX, gapY, npcDef, type Room } from "./data";
import type { Game, NpcState } from "./game";

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const rr = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
};

interface Prop { x: number; y: number; w: number; h: number; room: Room }
const PROPS: Prop[] = (() => {
  const out: Prop[] = [];
  let s = 424242;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (const r of ROOMS) {
    let x = r.x + 14;
    while (x < r.x + r.w - 60) {
      const w = 28 + rnd() * 40, h = 16 + rnd() * 14;
      if (rnd() < 0.75) out.push({ x, y: r.top ? r.y + 10 : r.y + r.h - 10 - h, w, h, room: r });
      x += w + 10 + rnd() * 20;
    }
    for (const side of [0, 1]) {
      const w = 12 + rnd() * 8, h = 40 + rnd() * 40;
      out.push({ x: side ? r.x + r.w - 8 - w : r.x + 8, y: r.y + r.h / 2 - h / 2 + (rnd() - 0.5) * 60, w, h, room: r });
    }
  }
  return out;
})();

export function drawGame(c: CanvasRenderingContext2D, g: Game, W: number, H: number, now: number) {
  const sc = Math.min(W / WORLD.w, H / WORLD.h);
  const ox = (W - WORLD.w * sc) / 2, oy = (H - WORLD.h * sc) / 2;
  g.view = { sc, ox, oy };
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = "#03050a";
  c.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    const sx = ((i * 7919) % 1000) / 1000 * W, sy = ((i * 104729) % 1000) / 1000 * H;
    c.fillStyle = `rgba(160,200,255,${0.15 + 0.15 * Math.sin(now * 1.5 + i)})`;
    c.fillRect(sx, sy, 1.5, 1.5);
  }
  const shx = g.shake > 0.2 ? (Math.random() - 0.5) * g.shake * sc : 0;
  const shy = g.shake > 0.2 ? (Math.random() - 0.5) * g.shake * sc : 0;
  c.setTransform(sc, 0, 0, sc, ox + shx, oy + shy);
  const pz = g.pz();
  const bo = g.blackout;

  // hull
  rr(c, 40, 40, WORLD.w - 80, WORLD.h - 80, 34);
  c.fillStyle = "#070b14"; c.fill();
  c.strokeStyle = "#1a2a48"; c.lineWidth = 3; c.stroke();

  // hall
  c.fillStyle = pz === "hall" ? "#0e1626" : "#0a111e";
  c.fillRect(HALL.x, HALL.y, HALL.w, HALL.h);
  c.strokeStyle = "rgba(92,200,255,0.14)"; c.lineWidth = 2; c.setLineDash([18, 18]);
  c.beginPath(); c.moveTo(HALL.x, 450); c.lineTo(HALL.x + HALL.w, 450); c.stroke(); c.setLineDash([]);
  c.strokeStyle = "rgba(92,200,255,0.5)"; c.lineWidth = 3;
  c.strokeRect(HALL.x, HALL.y, HALL.w, HALL.h);

  // rooms
  for (const r of ROOMS) {
    const here = pz === r.id;
    c.fillStyle = "#0a101c"; c.fillRect(r.x, r.y, r.w, r.h);
    c.fillStyle = rgba(r.color, here ? 0.11 : 0.06); c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = "rgba(255,255,255,0.04)"; c.lineWidth = 1;
    c.beginPath();
    for (let x = r.x + 40; x < r.x + r.w; x += 40) { c.moveTo(x, r.y); c.lineTo(x, r.y + r.h); }
    for (let y = r.y + 40; y < r.y + r.h; y += 40) { c.moveTo(r.x, y); c.lineTo(r.x + r.w, y); }
    c.stroke();
    for (const p of PROPS) {
      if (p.room !== r) continue;
      c.fillStyle = rgba(r.color, 0.12); c.fillRect(p.x, p.y, p.w, p.h);
      c.strokeStyle = rgba(r.color, 0.3); c.lineWidth = 1; c.strokeRect(p.x, p.y, p.w, p.h);
    }
    c.fillStyle = rgba(r.color, 0.95); c.font = "bold 15px 'Chakra Petch', ui-monospace, monospace"; c.textAlign = "left";
    c.fillText(r.name.toUpperCase(), r.x + 12, r.y + 24 + (r.top ? 0 : 0));
    if (g.cd.restricted.includes(r.id)) {
      c.fillStyle = "rgba(255,159,67,0.9)"; c.font = "10px ui-monospace, monospace";
      c.fillText("▲ RESTRICTED", r.x + 12, r.y + 40);
    }
    if (g.cd.cameras.includes(r.id)) {
      c.font = "16px serif"; c.textAlign = "right"; c.fillStyle = "#fff";
      c.fillText("📷", r.x + r.w - 12, r.y + 26);
      c.fillStyle = !bo && Math.sin(now * 5) > 0 ? "#ff3b4e" : "#3a1018";
      c.beginPath(); c.arc(r.x + r.w - 40, r.y + 21, 3, 0, 7); c.fill();
      c.textAlign = "left";
    }
    // walls with door gap
    c.strokeStyle = rgba(r.color, here ? 0.95 : 0.5); c.lineWidth = 4; c.lineCap = "square";
    const dx = doorX(r), gy = gapY(r), wy = r.top ? r.y + r.h : r.y;
    c.beginPath();
    c.moveTo(r.x, wy); c.lineTo(dx - DOOR_W / 2, wy); c.moveTo(dx + DOOR_W / 2, wy); c.lineTo(r.x + r.w, wy);
    const fy2 = r.top ? r.y : r.y + r.h;
    c.moveTo(r.x, fy2); c.lineTo(r.x + r.w, fy2);
    c.moveTo(r.x, r.y); c.lineTo(r.x, r.y + r.h); c.moveTo(r.x + r.w, r.y); c.lineTo(r.x + r.w, r.y + r.h);
    c.stroke();
    // door shutter
    if (g.doorLocked(r.id)) {
      c.fillStyle = "rgba(255,77,109,0.55)"; c.fillRect(dx - DOOR_W / 2, gy, DOOR_W, 20);
      c.strokeStyle = "#ff4d6d"; c.lineWidth = 2; c.strokeRect(dx - DOOR_W / 2, gy, DOOR_W, 20);
    } else {
      c.fillStyle = "rgba(77,255,176,0.12)"; c.fillRect(dx - DOOR_W / 2, gy, DOOR_W, 20);
    }
    if (!here) { c.fillStyle = "rgba(2,4,10,0.58)"; c.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); }
  }
  if (pz !== "hall") { c.fillStyle = "rgba(2,4,10,0.35)"; c.fillRect(HALL.x, HALL.y, HALL.w, HALL.h); }

  // objects
  const near = g.nearest();
  for (const o of g.allObjs()) {
    const inZ = o.room === pz;
    const pulse = 0.5 + 0.5 * Math.sin(now * 3 + o.x * 0.1);
    c.globalAlpha = inZ ? 1 : 0.4;
    c.fillStyle = "rgba(92,200,255,0.12)";
    c.beginPath(); c.arc(o.x, o.y, 20 + pulse * 4, 0, 7); c.fill();
    c.strokeStyle = near?.obj === o ? "#ffd166" : "rgba(92,200,255,0.55)"; c.lineWidth = near?.obj === o ? 3 : 1.5;
    c.beginPath(); c.arc(o.x, o.y, 19, 0, 7); c.stroke();
    c.font = "21px serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#fff";
    c.fillText(o.icon, o.x, o.y + 1);
    c.globalAlpha = 1;
    if (near?.obj === o) {
      c.font = "bold 12px 'Chakra Petch', ui-monospace, monospace";
      const tw = c.measureText(o.name).width + 16;
      c.fillStyle = "rgba(5,10,20,0.9)"; rr(c, o.x - tw / 2, o.y - 46, tw, 20, 6); c.fill();
      c.fillStyle = "#ffd166"; c.fillText(o.name, o.x, o.y - 35);
    }
  }
  c.textBaseline = "alphabetic";

  // npcs
  for (const n of g.npcs) {
    const vis = n.zone === pz || g.pulseT > 0 || n.dead;
    if (!vis) continue;
    drawNpc(c, n, n.zone !== pz && !n.dead, now, near?.npc === n);
  }

  // player
  const p = g.player;
  g.trail.forEach((t, i) => {
    c.fillStyle = `rgba(92,200,255,${(i / g.trail.length) * 0.22})`;
    c.beginPath(); c.arc(t.x, t.y, 8, 0, 7); c.fill();
  });
  const gr = c.createRadialGradient(p.x, p.y, 4, p.x, p.y, 80);
  gr.addColorStop(0, "rgba(92,200,255,0.22)"); gr.addColorStop(1, "rgba(92,200,255,0)");
  c.fillStyle = gr; c.beginPath(); c.arc(p.x, p.y, 80, 0, 7); c.fill();
  const bob = Math.sin(p.walk * 12) * 1.2;
  c.fillStyle = "rgba(0,0,0,0.4)"; c.beginPath(); c.ellipse(p.x, p.y + 12, 10, 4, 0, 0, 7); c.fill();
  c.save(); c.translate(p.x, p.y + bob); c.rotate(p.face);
  c.fillStyle = "#e8f6ff"; c.beginPath(); c.moveTo(16, 0); c.lineTo(8, -6); c.lineTo(8, 6); c.closePath(); c.fill();
  c.restore();
  c.fillStyle = "#5cc8ff"; c.strokeStyle = "#fff"; c.lineWidth = 2;
  c.beginPath(); c.arc(p.x, p.y + bob, 10, 0, 7); c.fill(); c.stroke();
  c.fillStyle = "#06101c"; c.font = "bold 9px ui-monospace, monospace"; c.textAlign = "center"; c.fillText("W", p.x, p.y + bob + 3);

  if (p.path.length) {
    c.strokeStyle = "rgba(92,200,255,0.4)"; c.setLineDash([5, 6]); c.lineWidth = 2;
    c.beginPath(); c.moveTo(p.x, p.y);
    for (const q of p.path) c.lineTo(q.x, q.y);
    c.stroke(); c.setLineDash([]);
  }
  if (g.pulseT > 0) {
    const k = (5 - g.pulseT) / 5;
    c.strokeStyle = `rgba(92,200,255,${1 - k})`; c.lineWidth = 4;
    c.beginPath(); c.arc(p.x, p.y, k * 1000, 0, 7); c.stroke();
  }

  // particles + floaters
  for (const q of g.particles) {
    c.globalAlpha = Math.max(0, q.life / q.max);
    c.fillStyle = q.color; c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  c.globalAlpha = 1;
  c.font = "bold 15px 'Chakra Petch', ui-monospace, monospace"; c.textAlign = "center";
  for (const f of g.floaters) {
    c.globalAlpha = Math.min(1, f.life * 1.4);
    c.fillStyle = "#000"; c.fillText(f.text, f.x + 1, f.y + 1);
    c.fillStyle = f.color; c.fillText(f.text, f.x, f.y);
  }
  c.globalAlpha = 1;

  // blackout darkness
  if (bo) {
    const d = c.createRadialGradient(p.x, p.y, 40, p.x, p.y, 300);
    d.addColorStop(0, "rgba(0,0,12,0.15)"); d.addColorStop(1, "rgba(0,0,12,0.93)");
    c.fillStyle = d; c.fillRect(-200, -200, WORLD.w + 400, WORLD.h + 400);
    c.fillStyle = `rgba(255,40,60,${0.04 + 0.04 * Math.sin(now * 6)})`; c.fillRect(-200, -200, WORLD.w + 400, WORLD.h + 400);
  }

  // screen-space overlays
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (g.sus > 25) {
    const a = Math.min(0.55, (g.sus - 25) / 130) * (g.chaseOn ? 0.7 + 0.3 * Math.sin(now * 8) : 1);
    const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, "rgba(255,40,60,0)"); v.addColorStop(1, `rgba(255,40,60,${a})`);
    c.fillStyle = v; c.fillRect(0, 0, W, H);
  }
  if (g.flash > 0.01) { c.fillStyle = `rgba(${g.flashColor},${Math.min(1, g.flash)})`; c.fillRect(0, 0, W, H); }
  if (g.phase === "rewind") {
    const k = g.phaseT / 2.6;
    for (let i = 0; i < 16; i++) {
      const y = Math.random() * H, h = 2 + Math.random() * 18;
      c.fillStyle = `rgba(92,200,255,${0.06 + Math.random() * 0.16 * Math.sin(k * Math.PI)})`;
      c.fillRect(Math.random() * 40 * (1 - k), y, W, h);
    }
  }
  if (g.phase === "crime") {
    c.fillStyle = `rgba(120,0,16,${0.25 + 0.1 * Math.sin(now * 12)})`; c.fillRect(0, 0, W, H);
  }
}

function drawNpc(c: CanvasRenderingContext2D, n: NpcState, ghost: boolean, now: number, hl: boolean) {
  const d = npcDef(n.id);
  const moving = n.path.length > 0;
  const bob = moving ? Math.sin(n.walk * 10) * 1.8 : 0;
  c.save();
  c.globalAlpha = ghost ? 0.6 : 1;
  c.translate(n.x, n.y + bob);
  c.fillStyle = "rgba(0,0,0,0.4)"; c.beginPath(); c.ellipse(0, 12 - bob, 11, 4, 0, 0, 7); c.fill();
  if (n.dead) {
    c.rotate(1.35);
    c.fillStyle = "#58606e"; rr(c, -14, -8, 28, 16, 8); c.fill();
    c.strokeStyle = "#ff4d6d"; c.lineWidth = 2; c.stroke();
    c.rotate(-1.35);
    c.fillStyle = "#ff4d6d"; c.font = "bold 14px ui-monospace"; c.textAlign = "center"; c.fillText("✖", 0, -16);
    c.restore();
    return;
  }
  if (n.chase) {
    c.strokeStyle = `rgba(255,60,80,${0.5 + 0.5 * Math.sin(now * 10)})`; c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, 18 + 3 * Math.sin(now * 10), 0, 7); c.stroke();
  }
  if (ghost) { c.strokeStyle = d.color; c.setLineDash([3, 3]); c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 16, 0, 7); c.stroke(); c.setLineDash([]); }
  c.shadowColor = d.color; c.shadowBlur = ghost ? 0 : 10;
  c.fillStyle = d.color; c.beginPath(); c.arc(0, 0, 11, 0, 7); c.fill();
  c.shadowBlur = 0;
  c.fillStyle = "#0a0f1a"; c.beginPath(); c.arc(0, 0, 7.5, 0, 7); c.fill();
  c.fillStyle = d.color; c.font = "bold 8px ui-monospace, monospace"; c.textAlign = "center"; c.fillText(d.init, 0, 3);
  if (hl) { c.strokeStyle = "#ffd166"; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, 16, 0, 7); c.stroke(); }
  if (!ghost) {
    c.font = "bold 10px 'Chakra Petch', ui-monospace, monospace";
    c.fillStyle = "rgba(0,0,0,0.7)"; c.fillText(d.name.split(" ").slice(-1)[0], 1, 27);
    c.fillStyle = d.color; c.fillText(d.name.split(" ").slice(-1)[0], 0, 26);
  }
  if (n.chase) { c.fillStyle = "#ff4d6d"; c.font = "bold 18px ui-monospace"; c.fillText("!", 0, -20); }
  if (n.bubT > 0 && n.bubble && !ghost) {
    c.font = "11px 'Chakra Petch', ui-monospace, monospace";
    const tw = Math.min(260, c.measureText(n.bubble).width + 14);
    c.fillStyle = "rgba(240,248,255,0.95)"; rr(c, -tw / 2, -46, tw, 20, 7); c.fill();
    c.fillStyle = "#0a0f1a"; c.fillText(n.bubble, 0, -32, tw - 8);
  }
  c.restore();
}
