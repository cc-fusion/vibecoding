import { audio } from "../audio";
import { TAU, clamp, lerp } from "../util";
import { CX, CY, Inp, Mech, MechEnv, pressedAny, tableAt } from "./base";

const HITS = [0, 3, 3, 4, 4, 5, 5, 6];
const WIDTH = [0, 0.2, 0.17, 0.15, 0.13, 0.115, 0.1, 0.088];
const SPEED = [0, 0.42, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

const GX = CX;
const GY = CY + 150;
const GR = 250;
const A0 = Math.PI * 1.1;
const A1 = Math.PI * 1.9;

export class SweepMech extends Mech {
  readonly help = "SPACE / click / tap as the needle crosses the golden band. Each hit speeds the needle and narrows the band.";
  private hits: number;
  private prog = 0;
  private width: number;
  private speed: number;
  private phase = 0;
  private p = 0;
  private zone = 0.5;
  private cool = 0;
  private trail: number[] = [];
  private flash = 0;
  private zoneAnim = 1;

  constructor(env: MechEnv, level: number, rng: () => number) {
    super(env, level, rng);
    this.hits = tableAt(HITS, level);
    this.width = tableAt(WIDTH, level);
    this.speed = tableAt(SPEED, level) * (env.hint >= 2 ? 0.85 : 1);
    this.phase = rng();
    this.zone = this.newZone(rng);
  }

  private newZone(rng: () => number) {
    let z = this.zone;
    for (let i = 0; i < 8 && Math.abs(z - this.zone) < 0.2; i++) z = 0.14 + rng() * 0.72;
    return z;
  }

  update(dt: number, inp: Inp, active: boolean) {
    this.cool = Math.max(0, this.cool - dt);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.zoneAnim = Math.min(1, this.zoneAnim + dt * 4);
    if (!active) return;
    this.phase += this.speed * dt;
    const f = this.phase - Math.floor(this.phase);
    this.p = 1 - Math.abs(2 * f - 1);
    this.trail.push(this.p);
    if (this.trail.length > 14) this.trail.shift();
    if ((pressedAny(inp, "Space", "Enter") || inp.pdown) && this.cool <= 0) {
      this.cool = 0.22;
      const half = (this.width / 2) * this.env.tolMul;
      const ang = lerp(A0, A1, this.p);
      const x = GX + Math.cos(ang) * GR;
      const y = GY + Math.sin(ang) * GR;
      if (Math.abs(this.p - this.zone) <= half) {
        this.prog++;
        audio.needleHit();
        this.env.fx.sparks(x, y, 12);
        this.env.fx.text(x, y - 24, "HIT", "#9dffba", 20);
        this.env.fx.addShake(1.5);
        if (this.prog >= this.hits) {
          audio.setPin();
          this.finish();
          return;
        }
        this.speed *= 1.08;
        this.width = Math.max(0.04, this.width * 0.94);
        this.zone = this.newZone(this.rng);
        this.zoneAnim = 0;
      } else {
        this.env.fault(9, 1, x, y - 20, "MISS");
        this.prog = Math.max(0, this.prog - 1);
        this.flash = 1;
      }
    }
  }

  draw(g: CanvasRenderingContext2D) {
    // track
    g.lineCap = "round";
    g.lineWidth = 46;
    g.strokeStyle = "#17141d";
    g.beginPath();
    g.arc(GX, GY, GR, A0 - 0.03, A1 + 0.03);
    g.stroke();
    g.lineWidth = 36;
    g.strokeStyle = "#2d2938";
    g.beginPath();
    g.arc(GX, GY, GR, A0, A1);
    g.stroke();
    // zone
    const half = (this.width / 2) * this.env.tolMul;
    const za0 = lerp(A0, A1, clamp(this.zone - half, 0, 1));
    const za1 = lerp(A0, A1, clamp(this.zone + half, 0, 1));
    g.lineWidth = 36;
    g.strokeStyle = `rgba(255,208,90,${0.55 + 0.45 * this.zoneAnim})`;
    g.shadowColor = "#ffd05a";
    g.shadowBlur = 16 * this.zoneAnim + 6;
    g.beginPath();
    g.arc(GX, GY, GR, za0, za1);
    g.stroke();
    g.shadowBlur = 0;
    g.lineCap = "butt";
    // ticks
    g.strokeStyle = "rgba(255,255,255,0.18)";
    g.lineWidth = 1.5;
    for (let i = 0; i <= 20; i++) {
      const a = lerp(A0, A1, i / 20);
      g.beginPath();
      g.moveTo(GX + Math.cos(a) * (GR + 26), GY + Math.sin(a) * (GR + 26));
      g.lineTo(GX + Math.cos(a) * (GR + (i % 5 === 0 ? 38 : 32)), GY + Math.sin(a) * (GR + (i % 5 === 0 ? 38 : 32)));
      g.stroke();
    }
    // trail
    this.trail.forEach((p, i) => {
      const a = lerp(A0, A1, p);
      g.strokeStyle = `rgba(255,255,255,${(i / this.trail.length) * 0.35})`;
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(GX + Math.cos(a) * (GR - 16), GY + Math.sin(a) * (GR - 16));
      g.lineTo(GX + Math.cos(a) * (GR + 16), GY + Math.sin(a) * (GR + 16));
      g.stroke();
    });
    // needle
    const a = lerp(A0, A1, this.p);
    const inZone = Math.abs(this.p - this.zone) <= half;
    g.strokeStyle = inZone ? "#b8ffd0" : "#f4f1e8";
    g.lineWidth = 4;
    g.shadowColor = inZone ? "#7dffa8" : "#fff";
    g.shadowBlur = inZone ? 16 : 6;
    g.beginPath();
    g.moveTo(GX, GY);
    g.lineTo(GX + Math.cos(a) * (GR + 22), GY + Math.sin(a) * (GR + 22));
    g.stroke();
    g.shadowBlur = 0;
    // hub
    const hg = g.createRadialGradient(GX - 6, GY - 6, 3, GX, GY, 30);
    hg.addColorStop(0, "#f1d48a");
    hg.addColorStop(1, "#6a4a14");
    g.fillStyle = hg;
    g.beginPath();
    g.arc(GX, GY, 26, 0, TAU);
    g.fill();
    // pips
    for (let i = 0; i < this.hits; i++) {
      const x = CX + (i - (this.hits - 1) / 2) * 38;
      const y = CY - 20;
      g.beginPath();
      g.arc(x, y, 12, 0, TAU);
      g.fillStyle = i < this.prog ? "#7dffa8" : "#241f28";
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = i < this.prog ? "#d6ffe3" : "#6b6070";
      g.stroke();
    }
    g.textAlign = "center";
    g.fillStyle = "rgba(233,226,208,0.7)";
    g.font = "600 14px Inter, sans-serif";
    g.fillText("Strike when the needle crosses the golden band", CX, CY + 20);
    if (this.flash > 0) {
      g.fillStyle = `rgba(255,60,60,${this.flash * 0.18})`;
      g.fillRect(0, 0, 960, 560);
    }
  }
}
