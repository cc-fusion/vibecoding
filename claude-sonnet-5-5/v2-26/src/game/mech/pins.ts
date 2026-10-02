import { audio } from "../audio";
import { clamp, lerp, roundRect, shuffle } from "../util";
import { H, held, Inp, Mech, MechEnv, pressedAny, tableAt, W } from "./base";

interface Pin {
  t: number;
  h: number;
  set: boolean;
  kl: number;
  vib: number;
  glow: number;
}

const COUNT = [0, 3, 4, 4, 5, 5, 6, 7];
const TOL = [0, 0.075, 0.065, 0.058, 0.05, 0.045, 0.04, 0.034];

const YB = 440; // key-pin bottom at rest
const SY = 250; // shear line
const R = 160; // travel
const TOP = 150; // chamber top
const X0 = 150;
const X1 = 810;

export class PinsMech extends Mech {
  readonly help = "←/→ select pin · ↑/↓ lift (or drag with mouse). The binding pin trembles — hold it in the sweet spot.";
  private pins: Pin[] = [];
  private order: number[] = [];
  private oi = 0;
  private sel = 0;
  private grabbed = false;
  private grabOff = 0;
  private kbMode = false;
  private dwell = 0;
  private creakT = 0;
  private tol: number;
  private pop: boolean;
  private pickX = 0;
  private pickY = 470;
  private shake = 0;

  constructor(env: MechEnv, level: number, rng: () => number) {
    super(env, level, rng);
    const n = tableAt(COUNT, level);
    this.tol = tableAt(TOL, level);
    this.pop = level >= 3;
    for (let i = 0; i < n; i++) {
      const t = 0.24 + rng() * 0.58;
      this.pins.push({ t, h: 0, set: false, kl: YB - SY - t * R, vib: 0, glow: 0 });
    }
    this.order = shuffle(rng, this.pins.map((_, i) => i));
    this.sel = Math.floor(n / 2);
    this.pickX = this.px(this.sel);
  }

  private px(i: number) {
    return X0 + ((i + 0.5) * (X1 - X0)) / this.pins.length;
  }

  private get binding() {
    return this.order[this.oi] ?? -1;
  }

  update(dt: number, inp: Inp, active: boolean) {
    const n = this.pins.length;
    const tolE = this.tol * this.env.tolMul;
    if (!active) {
      this.grabbed = false;
      for (const p of this.pins) if (!p.set) p.h = Math.max(0, p.h - 1.8 * dt);
      return;
    }
    if (inp.moved || inp.pdown) this.kbMode = false;
    if (pressedAny(inp, "ArrowLeft", "KeyA")) {
      this.sel = clamp(this.sel - 1, 0, n - 1);
      this.kbMode = true;
      audio.tick(0.2, 0.06);
    }
    if (pressedAny(inp, "ArrowRight", "KeyD")) {
      this.sel = clamp(this.sel + 1, 0, n - 1);
      this.kbMode = true;
      audio.tick(0.3, 0.06);
    }
    // pointer hover / grab
    const inBand = inp.py > 100 && inp.py < 500 && inp.px > X0 - 30 && inp.px < X1 + 30;
    if (!this.kbMode && inBand && !this.grabbed) {
      const idx = clamp(Math.floor(((inp.px - X0) / (X1 - X0)) * n), 0, n - 1);
      this.sel = idx;
    }
    if (inp.pdown && inBand) {
      const p = this.pins[this.sel];
      this.grabbed = true;
      this.grabOff = p.h - (YB - inp.py) / R;
    }
    if (inp.pup || !inp.down) this.grabbed = false;

    const sp = this.pins[this.sel];
    const isBinding = this.sel === this.binding;
    let pushing = false;
    if (!sp.set) {
      const near = isBinding && Math.abs(sp.h - sp.t) < 0.13;
      const up = held(inp, "ArrowUp", "KeyW", "Space");
      const dn = held(inp, "ArrowDown", "KeyS");
      if (this.grabbed) {
        const target = clamp((YB - inp.py) / R + this.grabOff, 0, 1.05);
        const vmax = isBinding && sp.h > 0.05 ? (near ? 0.42 : 0.85) : 3;
        const d = target - sp.h;
        sp.h += clamp(d, -3.2 * dt, vmax * dt);
        pushing = d > 0.002;
      } else if (up !== dn) {
        const spd = isBinding ? (near ? 0.26 : 0.5) : 0.95;
        sp.h = clamp(sp.h + (up ? 1 : -1) * spd * dt, 0, 1.05);
        pushing = up;
      }
      sp.h = clamp(sp.h, 0, 1.05);
    }
    // fall for pins that aren't held
    this.pins.forEach((p, i) => {
      if (p.set) return;
      const holdingIt = i === this.sel && (this.grabbed || this.kbMode);
      if (!holdingIt) p.h = Math.max(0, p.h - 1.7 * dt);
      p.glow = Math.max(0, p.glow - dt * 3);
    });

    // binding feedback
    let vibTarget = 0;
    if (isBinding && !sp.set) {
      const c = clamp(1 - Math.abs(sp.h - sp.t) / 0.22, 0, 1);
      if (sp.h > 0.05 && (pushing || this.grabbed)) {
        vibTarget = 1.3 + 3.5 * c;
        this.creakT -= dt;
        if (this.creakT <= 0) {
          audio.creak(c);
          this.creakT = 0.22 - c * 0.14;
        }
      }
      if (Math.abs(sp.h - sp.t) <= tolE) {
        this.dwell += dt;
        vibTarget = 5;
        if (this.dwell >= 0.26) this.setPin(sp);
      } else {
        this.dwell = Math.max(0, this.dwell - dt * 2);
        if (sp.h > sp.t + tolE + 0.015) this.overset(sp);
      }
    } else {
      this.dwell = 0;
    }
    for (let i = 0; i < n; i++) {
      const p = this.pins[i];
      const target = i === this.sel ? vibTarget : 0;
      p.vib = lerp(p.vib, target, clamp(dt * 14, 0, 1));
    }
    this.shake = clamp(this.shake - dt * 4, 0, 1);
  }

  private setPin(p: Pin) {
    p.set = true;
    p.h = p.t;
    p.glow = 1;
    this.dwell = 0;
    this.oi++;
    const x = this.px(this.pins.indexOf(p));
    audio.setPin();
    this.env.fx.burst(x, SY, 16, "#8cffb0", 170, 0.6, 320);
    this.env.fx.sparks(x, SY, 8);
    this.env.fx.text(x, SY - 40, "SET", "#9dffba", 22);
    this.env.fx.addShake(2);
    if (this.oi >= this.pins.length) this.finish();
  }

  private overset(p: Pin) {
    const x = this.px(this.pins.indexOf(p));
    p.h = Math.max(0, p.t - 0.4);
    this.grabbed = false;
    this.dwell = 0;
    this.env.fault(10, 1, x, SY - 30, "OVERSET!");
    if (this.pop && this.oi > 0) {
      const prev = this.pins[this.order[this.oi - 1]];
      prev.set = false;
      prev.h = Math.max(0, prev.t - 0.3);
      this.oi--;
      this.env.fx.text(this.px(this.order[this.oi]), SY - 70, "POPPED!", "#ff9a7a", 18);
    }
  }

  draw(g: CanvasRenderingContext2D, t: number) {
    const n = this.pins.length;
    // housing
    let grd = g.createLinearGradient(0, 110, 0, SY);
    grd.addColorStop(0, "#2a2f3a");
    grd.addColorStop(1, "#444b5a");
    g.fillStyle = grd;
    roundRect(g, 90, 110, 780, SY - 110, 10);
    g.fill();
    // plug
    grd = g.createLinearGradient(0, SY, 0, 480);
    grd.addColorStop(0, "#d8b25a");
    grd.addColorStop(0.5, "#a97f30");
    grd.addColorStop(1, "#5e4416");
    g.fillStyle = grd;
    roundRect(g, 90, SY, 780, 230, 10);
    g.fill();
    // keyway
    g.fillStyle = "#0b0907";
    roundRect(g, 90, 452, 780, 22, 6);
    g.fill();
    // shear line
    g.strokeStyle = "rgba(255,240,170,0.85)";
    g.lineWidth = 2;
    g.setLineDash([10, 7]);
    g.beginPath();
    g.moveTo(90, SY);
    g.lineTo(870, SY);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = "rgba(255,240,170,0.7)";
    g.font = "600 12px Inter, sans-serif";
    g.textAlign = "left";
    g.fillText("SHEAR LINE", 98, SY - 6);

    const bind = this.binding;
    for (let i = 0; i < n; i++) {
      const p = this.pins[i];
      const x = this.px(i) + Math.sin(t * 90 + i) * p.vib;
      // chamber
      g.fillStyle = "#07060a";
      g.fillRect(x - 23, TOP, 46, 452 - TOP);
      const kBot = YB - p.h * R;
      const kTop = kBot - p.kl;
      const dBot = kTop;
      const dTop = Math.max(TOP + 2, dBot - 100);
      // spring
      g.strokeStyle = "#9aa3b4";
      g.lineWidth = 2;
      g.beginPath();
      const coils = 9;
      for (let k = 0; k <= coils; k++) {
        const yy = TOP + ((dTop - TOP) * k) / coils;
        const xx = x + (k % 2 === 0 ? -13 : 13);
        if (k === 0) g.moveTo(x, TOP);
        else g.lineTo(xx, yy);
      }
      g.lineTo(x, dTop);
      g.stroke();
      // driver pin
      g.fillStyle = p.set ? "#bfe8cc" : "#cfd3dc";
      g.fillRect(x - 16, dTop, 32, Math.max(2, dBot - dTop));
      g.fillStyle = "rgba(255,255,255,0.25)";
      g.fillRect(x - 12, dTop, 5, Math.max(2, dBot - dTop));
      // key pin
      const kg = g.createLinearGradient(x - 16, 0, x + 16, 0);
      kg.addColorStop(0, "#b9783a");
      kg.addColorStop(0.5, "#f0b878");
      kg.addColorStop(1, "#9a5f2a");
      g.fillStyle = kg;
      g.beginPath();
      g.moveTo(x - 15, kTop);
      g.lineTo(x + 15, kTop);
      g.lineTo(x + 15, kBot - 10);
      g.lineTo(x, kBot + 2);
      g.lineTo(x - 15, kBot - 10);
      g.closePath();
      g.fill();
      // set glow
      if (p.set || p.glow > 0) {
        g.fillStyle = `rgba(120,255,170,${p.set ? 0.55 : 0.55 * p.glow})`;
        g.fillRect(x - 22, SY - 3, 44, 6);
      }
      // indicator
      g.beginPath();
      g.arc(x, 128, 7, 0, Math.PI * 2);
      g.fillStyle = p.set ? "#7dffa8" : "#241f28";
      g.fill();
      g.strokeStyle = p.set ? "#d6ffe3" : "#6b6070";
      g.lineWidth = 2;
      g.stroke();
      // hints
      if (this.env.hint >= 1 && i === bind && !p.set) {
        g.strokeStyle = `rgba(110,200,255,${0.5 + 0.4 * Math.sin(t * 6)})`;
        g.lineWidth = 3;
        roundRect(g, x - 26, TOP - 6, 52, 310, 8);
        g.stroke();
      }
      if (this.env.hint >= 2 && i === bind && !p.set) {
        const ty = YB - p.t * R;
        const tolPx = this.tol * this.env.tolMul * R;
        g.fillStyle = "rgba(110,200,255,0.35)";
        g.fillRect(x + 20, ty - tolPx, 14, tolPx * 2);
        g.fillStyle = "rgba(160,225,255,0.9)";
        g.fillRect(x + 20, ty - 1, 14, 2);
      }
    }

    // pick and tension wrench
    const tx = this.px(this.sel);
    const sp = this.pins[this.sel];
    const ty = YB - sp.h * R + 12;
    this.pickX = lerp(this.pickX, tx, 0.35);
    this.pickY = lerp(this.pickY, ty, 0.5);
    g.save();
    g.strokeStyle = "#e8edf5";
    g.lineWidth = 3;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(this.pickX + 220, 463);
    g.lineTo(this.pickX + 30, 463);
    g.lineTo(this.pickX + 6, Math.min(463, this.pickY));
    g.stroke();
    g.strokeStyle = "#8a93a4";
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(this.pickX + 220, 463);
    g.lineTo(this.pickX + 300, 463);
    g.stroke();
    g.restore();
    // wrench
    const prog = this.oi / n;
    g.save();
    g.translate(100, 466);
    g.rotate(-0.1 - prog * 0.35);
    g.fillStyle = "#6a7283";
    g.fillRect(-60, -3, 70, 6);
    g.fillRect(6, -26, 6, 29);
    g.restore();

    // order hint text
    g.fillStyle = "rgba(233,226,208,0.65)";
    g.font = "500 13px Inter, sans-serif";
    g.textAlign = "center";
    g.fillText(`Pins set: ${this.oi}/${n}   ·   probe each pin — only the binding pin resists`, W / 2, H - 28);
  }
}
