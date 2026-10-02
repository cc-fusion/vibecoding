import { audio } from "../audio";
import { TAU, angDiff, clamp, lerp, pick } from "../util";
import { CX, CY, held, Inp, Mech, MechEnv, pressedAny, tableAt } from "./base";

const COUNT = [0, 2, 3, 3, 3, 4, 4, 4];
const TOLDEG = [0, 9, 8, 7, 6.5, 6, 5, 4.5];
const ROUT = 208;
const RW = 34;
const STEP = 41;
const HALFGAP = 0.21;

interface Link {
  from: number;
  to: number;
  f: number;
}

export class RingsMech extends Mech {
  readonly help = "↑/↓ pick ring · ←/→ rotate (or drag a ring). Turning a ring also drags the ring inside it — see the ratios.";
  private a: number[] = [];
  private links: Link[] = [];
  private sel = 0;
  private grabbed = false;
  private lastAng = 0;
  private kbHold = 0;
  private dwell = 0;
  private tolRad: number;
  private beam = 0;
  private lastDetent = 0;
  private moving = 0;

  constructor(env: MechEnv, level: number, rng: () => number) {
    super(env, level, rng);
    const n = tableAt(COUNT, level);
    this.tolRad = (tableAt(TOLDEG, level) * Math.PI) / 180;
    this.a = new Array(n).fill(0);
    const facs = [1, -1, 0.5, -0.5];
    for (let i = 0; i < n - 1; i++) this.links.push({ from: i, to: i + 1, f: level <= 1 ? pick(rng, [1, -1]) : pick(rng, facs) });
    if (level >= 6 && n >= 4) this.links.push({ from: 0, to: 2, f: pick(rng, [-1, 0.5]) });
    let tries = 0;
    do {
      this.a = new Array(n).fill(0);
      const moves = 4 + n * 2;
      for (let k = 0; k < moves; k++) {
        const ring = Math.floor(rng() * n);
        const ang = (rng() < 0.5 ? -1 : 1) * (0.7 + rng() * 2.2);
        this.rot(ring, ang);
      }
      tries++;
    } while (this.misaligned() < 2 && tries < 20);
    this.sel = 0;
  }

  private rot(i: number, d: number) {
    this.a[i] += d;
    for (const l of this.links) if (l.from === i) this.a[l.to] += l.f * d;
  }

  private off(i: number) {
    return angDiff(0, this.a[i]);
  }

  private misaligned() {
    let m = 0;
    for (let i = 0; i < this.a.length; i++) if (Math.abs(this.off(i)) > 0.5) m++;
    return m;
  }

  private tolE() {
    return Math.min(this.tolRad * this.env.tolMul, HALFGAP - 0.03);
  }

  private aligned(i: number) {
    return Math.abs(this.off(i)) <= this.tolE();
  }

  private radiusOf(i: number) {
    return { out: ROUT - i * STEP, inn: ROUT - i * STEP - RW };
  }

  update(dt: number, inp: Inp, active: boolean) {
    const n = this.a.length;
    if (!active) {
      this.grabbed = false;
      return;
    }
    if (pressedAny(inp, "ArrowUp", "KeyW")) this.sel = clamp(this.sel - 1, 0, n - 1);
    if (pressedAny(inp, "ArrowDown", "KeyS")) this.sel = clamp(this.sel + 1, 0, n - 1);
    if (pressedAny(inp, "Tab")) this.sel = (this.sel + 1) % n;

    let d = 0;
    const left = held(inp, "ArrowLeft", "KeyA");
    const right = held(inp, "ArrowRight", "KeyD");
    if (pressedAny(inp, "ArrowLeft", "KeyA")) {
      d -= 0.035;
      this.kbHold = 0;
    }
    if (pressedAny(inp, "ArrowRight", "KeyD")) {
      d += 0.035;
      this.kbHold = 0;
    }
    if (left !== right) {
      this.kbHold += dt;
      if (this.kbHold > 0.15) d += (right ? 1 : -1) * Math.min(1.8, 0.5 + (this.kbHold - 0.15) * 1.6) * dt;
    } else this.kbHold = 0;
    if (inp.wheel) d += Math.sign(inp.wheel) * 0.035;

    const dx = inp.px - CX;
    const dy = inp.py - CY;
    const rad = Math.hypot(dx, dy);
    if (!this.grabbed && rad > 40 && rad < ROUT + 12) {
      for (let i = 0; i < n; i++) {
        const r = this.radiusOf(i);
        if (rad <= r.out + 4 && rad >= r.inn - 4) {
          if (inp.moved || inp.pdown) this.sel = i;
        }
      }
    }
    if (inp.pdown && rad > 40 && rad < ROUT + 12) {
      this.grabbed = true;
      this.lastAng = Math.atan2(dy, dx);
    }
    if (inp.pup || !inp.down) this.grabbed = false;
    if (this.grabbed && rad > 20) {
      const ang = Math.atan2(dy, dx);
      d += angDiff(this.lastAng, ang);
      this.lastAng = ang;
    }

    if (Math.abs(d) > 1e-5) {
      this.rot(this.sel, d);
      this.moving = 0.15;
      this.env.noise(Math.abs(d) * 1.6);
      const det = Math.floor(this.a[this.sel] / 0.1);
      if (det !== this.lastDetent) {
        this.lastDetent = det;
        audio.tick(0.1 + 0.4 * (this.aligned(this.sel) ? 1 : 0), 0.04);
      }
    } else this.moving = Math.max(0, this.moving - dt);

    let all = true;
    for (let i = 0; i < n; i++) if (!this.aligned(i)) all = false;
    if (all) {
      this.dwell += dt;
      if (this.dwell > 0.4) {
        audio.clunk();
        audio.setPin();
        this.env.fx.ring(CX, CY, "#ffe08a");
        this.env.fx.sparks(CX, CY - 150, 14);
        this.env.fx.text(CX, CY - 245, "LATCH DROPPED", "#9dffba", 22);
        this.finish();
      }
    } else this.dwell = 0;
  }

  draw(g: CanvasRenderingContext2D, t: number) {
    const n = this.a.length;
    // backplate
    let grd = g.createRadialGradient(CX, CY, 30, CX, CY, ROUT + 30);
    grd.addColorStop(0, "#1c1a22");
    grd.addColorStop(1, "#0d0c11");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(CX, CY, ROUT + 20, 0, TAU);
    g.fill();
    g.strokeStyle = "#6a5222";
    g.lineWidth = 5;
    g.stroke();

    // beam
    let beamEnd = ROUT + 22;
    for (let j = n - 1; j >= 0; j--) {
      if (!this.aligned(j)) {
        beamEnd = this.radiusOf(j).inn;
        break;
      }
    }
    this.beam = lerp(this.beam, beamEnd, 0.2);
    const bg = g.createLinearGradient(0, CY, 0, CY - this.beam);
    bg.addColorStop(0, "rgba(255,240,170,0.95)");
    bg.addColorStop(1, "rgba(255,200,90,0.2)");
    g.fillStyle = bg;
    g.fillRect(CX - 5, CY - this.beam, 10, this.beam);

    const tolE = this.tolE();
    const firstBad = (() => {
      for (let i = 0; i < n; i++) if (!this.aligned(i)) return i;
      return -1;
    })();

    for (let i = 0; i < n; i++) {
      const r = this.radiusOf(i);
      const ang = this.a[i];
      const ok = this.aligned(i);
      const rg = g.createRadialGradient(CX, CY, r.inn, CX, CY, r.out);
      rg.addColorStop(0, ok ? "#6fa883" : "#8a7a58");
      rg.addColorStop(0.5, ok ? "#a6e6bb" : "#d8c08a");
      rg.addColorStop(1, ok ? "#4f8a64" : "#6e5a34");
      g.fillStyle = rg;
      g.beginPath();
      g.arc(CX, CY, r.out, ang + HALFGAP - Math.PI / 2, ang - HALFGAP - Math.PI / 2 + TAU);
      g.arc(CX, CY, r.inn, ang - HALFGAP - Math.PI / 2 + TAU, ang + HALFGAP - Math.PI / 2, true);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(0,0,0,0.5)";
      g.lineWidth = 1.5;
      g.stroke();
      // gear teeth
      g.strokeStyle = "rgba(0,0,0,0.28)";
      g.lineWidth = 1;
      const teeth = 18 + i * 6;
      for (let k = 0; k < teeth; k++) {
        const aa = ang + (k / teeth) * TAU - Math.PI / 2;
        if (Math.abs(angDiff(aa + Math.PI / 2, ang)) < HALFGAP + 0.03) continue;
        g.beginPath();
        g.moveTo(CX + Math.cos(aa) * (r.inn + 5), CY + Math.sin(aa) * (r.inn + 5));
        g.lineTo(CX + Math.cos(aa) * (r.out - 5), CY + Math.sin(aa) * (r.out - 5));
        g.stroke();
      }
      // selection
      if (i === this.sel) {
        g.strokeStyle = "#ffe08a";
        g.lineWidth = 3;
        g.shadowColor = "#ffcf5a";
        g.shadowBlur = 12;
        g.beginPath();
        g.arc(CX, CY, r.out + 2, 0, TAU);
        g.stroke();
        g.beginPath();
        g.arc(CX, CY, r.inn - 2, 0, TAU);
        g.stroke();
        g.shadowBlur = 0;
      }
      if (this.env.hint >= 2 && i === firstBad && i !== this.sel) {
        g.strokeStyle = `rgba(110,200,255,${0.4 + 0.4 * Math.sin(t * 6)})`;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(CX, CY, r.out + 2, 0, TAU);
        g.stroke();
      }
    }

    // latch marker (top)
    g.fillStyle = "#ff5a4a";
    g.shadowColor = "#ff5a4a";
    g.shadowBlur = 10;
    g.beginPath();
    g.moveTo(CX, CY - ROUT - 6);
    g.lineTo(CX - 12, CY - ROUT - 30);
    g.lineTo(CX + 12, CY - ROUT - 30);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;

    // tolerance wedge preview on top
    g.strokeStyle = "rgba(255,255,255,0.25)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(CX, CY);
    g.lineTo(CX + Math.sin(-tolE) * (ROUT + 8), CY - Math.cos(tolE) * (ROUT + 8));
    g.moveTo(CX, CY);
    g.lineTo(CX + Math.sin(tolE) * (ROUT + 8), CY - Math.cos(tolE) * (ROUT + 8));
    g.stroke();

    // core
    const cg = g.createRadialGradient(CX, CY, 2, CX, CY, 46);
    cg.addColorStop(0, this.dwell > 0 ? "#fffbe0" : "#f3d88d");
    cg.addColorStop(1, "#6a4a14");
    g.fillStyle = cg;
    g.beginPath();
    g.arc(CX, CY, 44, 0, TAU);
    g.fill();
    g.strokeStyle = "#2a1d08";
    g.lineWidth = 3;
    g.stroke();

    // link badges
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const l of this.links) {
      const rb = this.radiusOf(l.to).out + 3;
      const direct = l.to === l.from + 1;
      const ang = direct ? Math.PI / 4 : Math.PI * 0.85;
      const x = CX + Math.cos(ang) * (direct ? rb : this.radiusOf(l.to).inn + 17);
      const y = CY + Math.sin(ang) * (direct ? rb : this.radiusOf(l.to).inn + 17);
      g.fillStyle = "#15121a";
      g.strokeStyle = "#d6a84c";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, 14, 0, TAU);
      g.fill();
      g.stroke();
      g.fillStyle = l.f < 0 ? "#ff9a7a" : "#9dd8ff";
      g.font = "700 11px Inter, sans-serif";
      const txt = `${l.f < 0 ? "−" : "×"}${Math.abs(l.f) === 1 ? "1" : Math.abs(l.f) === 0.5 ? "½" : String(Math.abs(l.f))}`;
      g.fillText(l.f < 0 ? txt : txt, x, y);
      if (!direct) {
        g.fillStyle = "rgba(233,226,208,0.6)";
        g.font = "600 10px Inter, sans-serif";
        g.fillText(`#${l.from + 1}→#${l.to + 1}`, x, y + 22);
      }
    }
    // side readouts
    g.textAlign = "left";
    g.font = "600 13px Inter, sans-serif";
    for (let i = 0; i < n; i++) {
      const y = CY - 60 + i * 30 - ((n - 1) * 30) / 2 + 60;
      g.fillStyle = this.aligned(i) ? "#7dffa8" : "#e9e2d0";
      g.fillText(`Ring ${i + 1}${i === 0 ? " (outer)" : ""}`, 70, y);
      if (this.env.hint >= 1) {
        g.fillStyle = "rgba(160,225,255,0.95)";
        g.fillText(`${Math.round((this.off(i) * 180) / Math.PI)}°`, 190, y);
      }
    }
    g.textAlign = "right";
    g.fillStyle = "rgba(233,226,208,0.6)";
    g.fillText("Fix outer → inner. Turning a ring only", 900, CY + 120);
    g.fillText("disturbs rings linked inside it.", 900, CY + 138);
  }
}
