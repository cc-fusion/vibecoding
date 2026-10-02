import { clamp } from "./util";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  grav: number;
  spark: boolean;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  max: number;
}

const MAX_PARTS = 700;

export class Fx {
  parts: Particle[] = [];
  floats: FloatText[] = [];
  shake = 0;
  flash = 0;
  flashColor = "#ffffff";
  enableShake = true;
  density = 1;

  burst(x: number, y: number, n: number, color: string, speed = 160, life = 0.7, grav = 260, spark = false) {
    const count = Math.round(n * this.density);
    for (let i = 0; i < count && this.parts.length < MAX_PARTS; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.9);
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - speed * 0.2,
        life: life * (0.6 + Math.random() * 0.6),
        max: life,
        size: 1.5 + Math.random() * 3,
        color,
        grav,
        spark,
      });
    }
  }

  sparks(x: number, y: number, n: number, color = "#ffd98a") {
    this.burst(x, y, n, color, 260, 0.45, 520, true);
  }

  ring(x: number, y: number, color: string) {
    const count = Math.round(24 * this.density);
    for (let i = 0; i < count && this.parts.length < MAX_PARTS; i++) {
      const a = (i / count) * Math.PI * 2;
      this.parts.push({ x, y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, life: 0.5, max: 0.5, size: 2.4, color, grav: 0, spark: false });
    }
  }

  text(x: number, y: number, text: string, color = "#ffe9a8", size = 20) {
    if (this.floats.length > 24) this.floats.shift();
    this.floats.push({ x, y, text, color, size, life: 1.1, max: 1.1 });
  }

  addShake(a: number) {
    if (!this.enableShake) return;
    this.shake = clamp(this.shake + a, 0, 24);
  }

  doFlash(color: string, a = 0.5) {
    this.flash = a;
    this.flashColor = color;
  }

  update(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts[i] = this.parts[this.parts.length - 1];
        this.parts.pop();
        continue;
      }
      p.vy += p.grav * dt;
      p.vx *= 1 - dt * 1.2;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      f.y -= 38 * dt;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 2.2);
  }

  draw(g: CanvasRenderingContext2D) {
    for (const p of this.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      g.globalAlpha = a;
      g.fillStyle = p.color;
      if (p.spark) {
        g.strokeStyle = p.color;
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        g.stroke();
      } else {
        g.beginPath();
        g.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const f of this.floats) {
      const a = clamp(f.life / f.max, 0, 1);
      const pop = f.max - f.life < 0.12 ? 1 + (1 - (f.max - f.life) / 0.12) * 0.4 : 1;
      g.globalAlpha = Math.min(1, a * 1.6);
      g.font = `700 ${f.size * pop}px Cinzel, Georgia, serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(0,0,0,0.75)";
      g.strokeText(f.text, f.x, f.y);
      g.fillStyle = f.color;
      g.fillText(f.text, f.x, f.y);
    }
    g.globalAlpha = 1;
  }
}
