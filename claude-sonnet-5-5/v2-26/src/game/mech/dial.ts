import { audio } from "../audio";
import { TAU, angDiff, clamp, dialDiff, lerp, roundRect } from "../util";
import { CX, CY, held, Inp, Mech, MechEnv, pressedAny, tableAt } from "./base";

const COUNT = [0, 2, 3, 3, 4, 4, 5, 5];
const TOL = [0, 3.4, 3.0, 2.6, 2.2, 1.9, 1.6, 1.4];
const RAD = 190;

export class DialMech extends Mech {
  readonly help = "←/→ or drag to spin · wheel = fine tune · SPACE/ENTER locks a number. Watch the listening gauge.";
  private v = 0;
  private targets: number[] = [];
  private idx = 0;
  private lastMove = 0;
  private tol: number;
  private directional: boolean;
  private grabbed = false;
  private lastAng = 0;
  private kbHold = 0;
  private speed = 0;
  private cool = 0;
  private lastFloor = 0;
  private flash = 0;
  private prox = 0;
  private grindT = 0;

  constructor(env: MechEnv, level: number, rng: () => number) {
    super(env, level, rng);
    const n = tableAt(COUNT, level);
    this.tol = tableAt(TOL, level);
    this.directional = level >= 3;
    let prev = Math.floor(rng() * 100);
    this.v = prev;
    for (let i = 0; i < n; i++) {
      let t = Math.floor(rng() * 100);
      let guard = 0;
      while (Math.abs(dialDiff(prev, t)) < 16 && guard++ < 20) t = Math.floor(rng() * 100);
      this.targets.push(t);
      prev = t;
    }
    this.lastFloor = Math.floor(this.v);
  }

  private get target() {
    return this.targets[this.idx] ?? 0;
  }
  private get reqDir() {
    return this.idx % 2 === 0 ? 1 : -1;
  }
  private range() {
    return 12 + 8 * this.env.hint;
  }

  update(dt: number, inp: Inp, active: boolean) {
    this.cool = Math.max(0, this.cool - dt);
    this.flash = Math.max(0, this.flash - dt * 3);
    if (!active) {
      this.grabbed = false;
      this.speed = 0;
      return;
    }
    let dv = 0;
    // keyboard
    const left = held(inp, "ArrowLeft", "KeyA");
    const right = held(inp, "ArrowRight", "KeyD");
    if (pressedAny(inp, "ArrowLeft", "KeyA")) {
      dv -= 1;
      this.kbHold = 0;
    }
    if (pressedAny(inp, "ArrowRight", "KeyD")) {
      dv += 1;
      this.kbHold = 0;
    }
    if (left !== right) {
      this.kbHold += dt;
      if (this.kbHold > 0.2) {
        const sp = Math.min(60, 12 + (this.kbHold - 0.2) * 38);
        dv += (right ? 1 : -1) * sp * dt;
      }
    } else this.kbHold = 0;
    // wheel
    if (inp.wheel) dv += Math.sign(inp.wheel);
    // pointer drag
    const dx = inp.px - CX;
    const dy = inp.py - CY;
    const rad = Math.hypot(dx, dy);
    if (inp.pdown) {
      if (rad < 58) this.tryLock();
      else if (rad < RAD + 25) {
        this.grabbed = true;
        this.lastAng = Math.atan2(dy, dx);
      }
    }
    if (inp.pup || !inp.down) this.grabbed = false;
    if (this.grabbed && rad > 20) {
      const a = Math.atan2(dy, dx);
      const d = angDiff(this.lastAng, a);
      this.lastAng = a;
      dv += (d / TAU) * 100;
    }
    if (pressedAny(inp, "Space", "Enter")) this.tryLock();

    this.v = (((this.v + dv) % 100) + 100) % 100;
    if (Math.abs(dv) > 0.0005) {
      if (Math.abs(dv) > 0.04 || Math.abs(dv) / dt > 3) this.lastMove = Math.sign(dv);
    }
    const inst = Math.abs(dv) / Math.max(dt, 0.001);
    this.speed = lerp(this.speed, inst, clamp(dt * 8, 0, 1));
    // proximity
    const diff = dialDiff(this.v, this.target);
    this.prox = clamp(1 - Math.abs(diff) / this.range(), 0, 1);
    // ticks
    const f = Math.floor(this.v);
    if (f !== this.lastFloor) {
      const steps = Math.min(3, Math.abs(dialDiff(this.lastFloor, f)));
      this.lastFloor = f;
      if (steps > 0) audio.tick(this.prox, 0.05 + this.prox * 0.12);
      if (Math.abs(diff) <= this.tol * this.env.tolMul) {
        audio.clunk();
        this.flash = 1;
        this.env.fx.sparks(CX, CY - RAD, 4, "#9dffba");
      }
    }
    // clatter
    if (this.speed > 38) {
      this.env.noise(dt * 5);
      this.grindT -= dt;
      if (this.grindT <= 0) {
        audio.grind(0.05);
        this.grindT = 0.12;
        this.env.fx.text(CX, CY - RAD - 36, "clatter!", "#ffb08a", 15);
      }
    }
  }

  private tryLock() {
    if (this.cool > 0 || this.done) return;
    this.cool = 0.3;
    const diff = dialDiff(this.v, this.target);
    if (Math.abs(diff) <= this.tol * this.env.tolMul) {
      if (this.directional && this.lastMove !== this.reqDir) {
        this.env.fault(5, 0, CX, CY - RAD - 20, "WRONG DIRECTION");
        return;
      }
      audio.setPin();
      this.env.fx.ring(CX, CY, "#ffe08a");
      this.env.fx.burst(CX, CY - RAD, 14, "#9dffba", 160, 0.6, 300);
      this.env.fx.text(CX, CY - RAD - 30, `LOCKED ${Math.round(this.target)}`, "#9dffba", 22);
      this.idx++;
      this.lastMove = 0;
      if (this.idx >= this.targets.length) this.finish();
    } else {
      this.env.fault(7, 0.5, CX, CY - RAD - 20, "MISSED");
    }
  }

  draw(g: CanvasRenderingContext2D, t: number) {
    const diff = dialDiff(this.v, this.target);
    const inZone = !this.done && Math.abs(diff) <= this.tol * this.env.tolMul;
    // bezel
    let grd = g.createRadialGradient(CX - 40, CY - 60, 40, CX, CY, RAD + 30);
    grd.addColorStop(0, "#6a6f7c");
    grd.addColorStop(0.7, "#2c303a");
    grd.addColorStop(1, "#14161c");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(CX, CY, RAD + 28, 0, TAU);
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = inZone ? "#7dffa8" : `rgba(214,168,76,${0.45 + this.prox * 0.5})`;
    g.shadowColor = inZone ? "#7dffa8" : "#d6a84c";
    g.shadowBlur = 6 + this.prox * 22;
    g.beginPath();
    g.arc(CX, CY, RAD + 26, 0, TAU);
    g.stroke();
    g.shadowBlur = 0;

    // rotating face
    g.save();
    g.translate(CX + (inZone ? Math.sin(t * 90) * 1.2 : 0), CY);
    g.rotate((this.v / 100) * TAU);
    grd = g.createRadialGradient(0, 0, 20, 0, 0, RAD);
    grd.addColorStop(0, "#d9dce4");
    grd.addColorStop(0.6, "#9298a6");
    grd.addColorStop(1, "#555b68");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, RAD, 0, TAU);
    g.fill();
    for (let i = 0; i < 100; i++) {
      const a = (i / 100) * TAU - Math.PI / 2;
      const major = i % 10 === 0;
      const mid = i % 5 === 0;
      const r1 = RAD - (major ? 28 : mid ? 20 : 13);
      g.strokeStyle = major ? "#15171c" : "#2b2f38";
      g.lineWidth = major ? 3 : 1.4;
      g.beginPath();
      g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      g.lineTo(Math.cos(a) * (RAD - 5), Math.sin(a) * (RAD - 5));
      g.stroke();
      if (major) {
        g.save();
        g.translate(Math.cos(a) * (RAD - 48), Math.sin(a) * (RAD - 48));
        g.rotate(a + Math.PI / 2);
        g.fillStyle = "#15171c";
        g.font = "700 20px Cinzel, serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(String(i), 0, 0);
        g.restore();
      }
    }
    // hint marker
    if (this.env.hint >= 2 && !this.done && Math.abs(diff) < 26) {
      const a = (this.target / 100) * TAU - Math.PI / 2;
      g.fillStyle = "rgba(60,150,255,0.9)";
      g.beginPath();
      g.arc(Math.cos(a) * (RAD - 8), Math.sin(a) * (RAD - 8), 5, 0, TAU);
      g.fill();
    }
    g.restore();

    // inner hub
    grd = g.createRadialGradient(CX - 10, CY - 12, 4, CX, CY, 64);
    grd.addColorStop(0, "#f1d48a");
    grd.addColorStop(1, "#7a5a1f");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(CX, CY, 56, 0, TAU);
    g.fill();
    g.strokeStyle = "#2a1d08";
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = "#2a1d08";
    g.font = "700 15px Cinzel, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("LOCK", CX, CY - 8);
    g.font = "700 22px Cinzel, serif";
    g.fillText(String(Math.round(this.v) % 100), CX, CY + 14);

    // pointer
    g.fillStyle = "#ff5a4a";
    g.shadowColor = "#ff5a4a";
    g.shadowBlur = 10;
    g.beginPath();
    g.moveTo(CX, CY - RAD - 2);
    g.lineTo(CX - 13, CY - RAD - 30);
    g.lineTo(CX + 13, CY - RAD - 30);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;

    // progress pips (left)
    g.textBaseline = "middle";
    this.targets.forEach((_, i) => {
      const y = CY - 60 + i * 34 - ((this.targets.length - 1) * 34) / 2 + 60;
      const x = 110;
      g.beginPath();
      g.arc(x, y, 11, 0, TAU);
      g.fillStyle = i < this.idx ? "#7dffa8" : i === this.idx ? "#f3d88d" : "#241f28";
      g.fill();
      g.strokeStyle = "#8a6a2c";
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = "#e9e2d0";
      g.font = "600 13px Inter, sans-serif";
      g.textAlign = "left";
      g.fillText(i < this.idx ? "locked" : i === this.idx ? "listening…" : "—", x + 20, y);
    });
    // direction hint
    g.textAlign = "center";
    g.fillStyle = "#f3d88d";
    g.font = "700 15px Cinzel, serif";
    if (this.directional && !this.done) {
      g.fillText(this.reqDir > 0 ? "Next: turn CLOCKWISE ↻" : "Next: turn COUNTER-CLOCKWISE ↺", CX, 52);
    } else {
      g.fillText("Any direction", CX, 52);
    }
    // gauge (right)
    const gx = 830;
    const gy = CY + 110;
    const gh = 220;
    g.fillStyle = "#14121a";
    roundRect(g, gx - 16, gy - gh, 32, gh, 8);
    g.fill();
    const segs = 14;
    for (let i = 0; i < segs; i++) {
      const on = this.prox * segs > i;
      const col = i > segs * 0.75 ? "#7dffa8" : i > segs * 0.45 ? "#ffd05a" : "#ff8a5a";
      g.fillStyle = on ? col : "rgba(255,255,255,0.07)";
      g.fillRect(gx - 11, gy - 8 - i * (gh / segs), 22, gh / segs - 4);
    }
    g.fillStyle = "rgba(233,226,208,0.8)";
    g.font = "600 12px Inter, sans-serif";
    g.fillText("LISTEN", gx, gy + 18);
    if (this.env.hint >= 1) {
      g.fillText(`Δ ${Math.abs(Math.round(diff))}`, gx, gy - gh - 12);
    }
  }
}
