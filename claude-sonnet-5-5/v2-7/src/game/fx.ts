// Particle / floating text / screen-shake juice layer (singleton)
interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; rot: number; vr: number; kind: "dot" | "feather" | "coin" | "ring" | "star"; g: number; }
interface T { x: number; y: number; text: string; color: string; life: number; max: number; size: number; vy: number; }

class Fx {
  parts: P[] = []; texts: T[] = [];
  shakeMag = 0; shakeOn = true; ambient = false; reduce = false;
  private amb = 0;

  private push(p: P) { if (this.parts.length < 700) this.parts.push(p); }
  burst(x: number, y: number, color: string, n = 16, kind: P["kind"] = "dot", speed = 220, g = 300) {
    const c = this.reduce ? Math.ceil(n / 3) : n;
    for (let i = 0; i < c; i++) {
      const a = Math.random() * Math.PI * 2; const s = speed * (0.35 + Math.random() * 0.8);
      this.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (kind === "coin" ? 140 : 40), life: 0, max: 0.6 + Math.random() * 0.8, size: 2 + Math.random() * 4, color, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, kind, g });
    }
  }
  ring(x: number, y: number, color: string) { this.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.6, size: 6, color, rot: 0, vr: 0, kind: "ring", g: 0 }); }
  feathers(x: number, y: number, n = 14, color = "#1c1830") { this.burst(x, y, color, n, "feather", 160, 90); }
  coins(x: number, y: number, n = 10) { this.burst(x, y, "#f2c14e", n, "coin", 240, 520); }
  stars(x: number, y: number, color = "#f2c14e", n = 18) { this.burst(x, y, color, n, "star", 300, 200); }
  text(x: number, y: number, text: string, color = "#fff", size = 20) { if (this.texts.length < 40) this.texts.push({ x, y, text, color, life: 0, max: 1.5, size, vy: -46 }); }
  private center(sel: string): [number, number] {
    try { const el = document.querySelector(sel); if (el) { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; } } catch { /* ignore */ }
    return [window.innerWidth / 2, window.innerHeight / 2.4];
  }
  textAt(sel: string, text: string, color = "#fff", size = 20) { const [x, y] = this.center(sel); this.text(x + (Math.random() - 0.5) * 30, y, text, color, size); }
  burstAt(sel: string, color: string, n = 14, kind: P["kind"] = "dot") { const [x, y] = this.center(sel); this.burst(x, y, color, n, kind); }
  coinsAt(sel: string, n = 10) { const [x, y] = this.center(sel); this.coins(x, y, n); }
  feathersAt(sel: string, n = 12) { const [x, y] = this.center(sel); this.feathers(x, y, n); }
  shake(m: number) { if (this.shakeOn && !this.reduce) this.shakeMag = Math.min(24, Math.max(this.shakeMag, m)); }
  clear() { this.parts.length = 0; this.texts.length = 0; this.shakeMag = 0; }

  update(dt: number, w: number) {
    if (this.ambient && !this.reduce) {
      this.amb += dt;
      if (this.amb > 0.5) { this.amb = 0; this.push({ x: Math.random() * w, y: -10, vx: (Math.random() - 0.5) * 30, vy: 30 + Math.random() * 40, life: 0, max: 9, size: 4 + Math.random() * 4, color: "#241f45", rot: Math.random() * 6, vr: (Math.random() - 0.5) * 2, kind: "feather", g: 0 }); }
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.life += dt;
      if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
      p.vy += p.g * dt; if (p.kind === "feather") { p.vx *= 0.985; p.vy *= 0.985; p.vx += Math.sin(p.life * 3 + p.rot) * 20 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]; t.life += dt; t.y += t.vy * dt; t.vy *= 0.97;
      if (t.life >= t.max) this.texts.splice(i, 1);
    }
    this.shakeMag *= Math.pow(0.001, dt); if (this.shakeMag < 0.2) this.shakeMag = 0;
  }
  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.parts) {
      const k = 1 - p.life / p.max; ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.4));
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (p.kind === "feather") { ctx.fillStyle = p.color; ctx.strokeStyle = "rgba(167,139,250,.5)"; ctx.beginPath(); ctx.ellipse(0, 0, p.size * 2.2, p.size * 0.8, 0, 0, 6.3); ctx.fill(); ctx.stroke(); }
      else if (p.kind === "coin") { ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, p.size * 1.2, p.size * Math.abs(Math.cos(p.life * 8)) + 0.5, 0, 0, 6.3); ctx.fill(); ctx.strokeStyle = "#fff6c8"; ctx.stroke(); }
      else if (p.kind === "ring") { ctx.strokeStyle = p.color; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.arc(0, 0, p.size + (1 - k) * 70, 0, 6.3); ctx.stroke(); }
      else if (p.kind === "star") { ctx.fillStyle = p.color; ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; ctx.lineTo(Math.cos(a) * p.size * 1.6, Math.sin(a) * p.size * 1.6); ctx.lineTo(Math.cos(a + Math.PI / 4) * p.size * 0.5, Math.sin(a + Math.PI / 4) * p.size * 0.5); } ctx.closePath(); ctx.fill(); }
      else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, p.size * k + 0.5, 0, 6.3); ctx.fill(); }
      ctx.restore();
    }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const t of this.texts) {
      const k = t.life / t.max; const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : 1.15 - Math.min(0.15, (k - 0.12) * 0.4);
      ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      ctx.font = `700 ${Math.round(t.size * pop)}px Cinzel, Georgia, serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(8,6,20,.9)"; ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
export const fx = new Fx();
