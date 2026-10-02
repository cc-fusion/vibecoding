import { audio } from "../audio";
import { TAU, clamp } from "../util";
import { CX, CY, Inp, Mech, MechEnv, pressedAny, tableAt } from "./base";

const BTNS = [0, 4, 4, 5, 5, 6, 6, 6];
const SEQ = [0, 3, 4, 4, 5, 6, 7, 8];
const GLYPH = ["☉", "☽", "✦", "❖", "⚚", "☿"];
const COL = ["#ffcf5a", "#9ad0ff", "#ff8a8a", "#8aff9a", "#c59aff", "#ff9ae0"];
const RR = 150;
const BR = 46;

type Phase = "intro" | "show" | "input" | "between";

export class RunesMech extends Mech {
  readonly help = "Click runes or press 1-6 to repeat the pattern. SPACE replays the sequence (adds a little noise without a Stethoscope).";
  private n: number;
  private len: number;
  private seq: number[] = [];
  private round = 1;
  private phase: Phase = "intro";
  private timer = 0.8;
  private showIdx = 0;
  private inIdx = 0;
  private lit: number[];
  private stepDur: number;

  constructor(env: MechEnv, level: number, rng: () => number) {
    super(env, level, rng);
    this.n = tableAt(BTNS, level);
    this.len = tableAt(SEQ, level);
    this.stepDur = Math.max(0.3, 0.62 - level * 0.045);
    for (let i = 0; i < this.len; i++) this.seq.push(Math.floor(rng() * this.n));
    this.lit = new Array(this.n).fill(0);
  }

  private pos(i: number) {
    const a = (i / this.n) * TAU - Math.PI / 2;
    return { x: CX + Math.cos(a) * RR, y: CY + Math.sin(a) * RR };
  }

  private flashRune(i: number, strength = 1) {
    this.lit[i] = strength;
    audio.rune(i);
    const p = this.pos(i);
    this.env.fx.burst(p.x, p.y, 6, COL[i], 90, 0.5, 100);
  }

  private startShow() {
    this.phase = "show";
    this.showIdx = 0;
    this.timer = 0.5;
  }

  update(dt: number, inp: Inp, active: boolean) {
    for (let i = 0; i < this.n; i++) this.lit[i] = Math.max(0, this.lit[i] - dt * 3.2);
    if (!active) return;
    this.timer -= dt;
    if (this.phase === "intro") {
      if (this.timer <= 0) this.startShow();
    } else if (this.phase === "show") {
      if (this.timer <= 0) {
        if (this.showIdx >= this.round) {
          this.phase = "input";
          this.inIdx = 0;
        } else {
          this.flashRune(this.seq[this.showIdx]);
          this.showIdx++;
          this.timer = this.stepDur;
        }
      }
    } else if (this.phase === "between") {
      if (this.timer <= 0) this.startShow();
    } else if (this.phase === "input") {
      if (pressedAny(inp, "Space")) {
        this.env.noise(this.env.hint >= 1 ? 0 : 2.5);
        this.startShow();
        return;
      }
      let hit = -1;
      for (let i = 0; i < this.n; i++) if (pressedAny(inp, `Digit${i + 1}`, `Numpad${i + 1}`)) hit = i;
      if (inp.pdown) {
        for (let i = 0; i < this.n; i++) {
          const p = this.pos(i);
          if (Math.hypot(inp.px - p.x, inp.py - p.y) <= BR + 6) hit = i;
        }
      }
      if (hit >= 0) this.press(hit);
    }
  }

  private press(i: number) {
    const p = this.pos(i);
    if (i === this.seq[this.inIdx]) {
      this.flashRune(i);
      this.inIdx++;
      if (this.inIdx >= this.round) {
        if (this.round >= this.len) {
          audio.setPin();
          this.env.fx.text(CX, CY - 8, "SEALS BROKEN", "#9dffba", 22);
          this.finish();
        } else {
          this.round++;
          this.phase = "between";
          this.timer = 0.7;
          this.env.fx.text(CX, CY + 40, "✓", "#9dffba", 26);
        }
      }
    } else {
      this.lit[i] = 0.6;
      this.env.fault(8, 1, p.x, p.y - 30, "WRONG RUNE");
      this.phase = "between";
      this.timer = 1.0;
    }
  }

  draw(g: CanvasRenderingContext2D, t: number) {
    // sigil ring
    g.strokeStyle = "rgba(214,168,76,0.35)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(CX, CY, RR + 70, 0, TAU);
    g.stroke();
    g.setLineDash([4, 8]);
    g.beginPath();
    g.arc(CX, CY, RR - 70, 0, TAU);
    g.stroke();
    g.setLineDash([]);
    for (let i = 0; i < this.n; i++) {
      const p = this.pos(i);
      const l = this.lit[i];
      const rg = g.createRadialGradient(p.x, p.y, 4, p.x, p.y, BR + 14 * l);
      rg.addColorStop(0, l > 0.02 ? COL[i] : "#2a2532");
      rg.addColorStop(1, l > 0.02 ? "rgba(0,0,0,0.2)" : "#15121a");
      g.shadowColor = COL[i];
      g.shadowBlur = 30 * l;
      g.fillStyle = rg;
      g.beginPath();
      g.arc(p.x, p.y, BR + 6 * l, 0, TAU);
      g.fill();
      g.shadowBlur = 0;
      g.lineWidth = 3;
      g.strokeStyle = COL[i];
      g.globalAlpha = 0.5 + l * 0.5;
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = l > 0.3 ? "#101010" : COL[i];
      g.font = "700 40px serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(GLYPH[i], p.x, p.y + 2);
      g.fillStyle = "rgba(255,255,255,0.6)";
      g.font = "600 12px Inter, sans-serif";
      g.fillText(String(i + 1), p.x, p.y + BR - 12);
    }
    // center
    g.fillStyle = "#f3d88d";
    g.font = "700 22px Cinzel, serif";
    g.textAlign = "center";
    g.fillText(`Round ${Math.min(this.round, this.len)} / ${this.len}`, CX, CY - 22);
    g.font = "600 15px Inter, sans-serif";
    g.fillStyle = this.phase === "input" ? "#9dffba" : "#ffd98a";
    const label =
      this.phase === "input"
        ? `Your turn… ${this.inIdx}/${this.round}`
        : this.phase === "show"
          ? "Watch the runes…"
          : this.phase === "between"
            ? "…"
            : "Focus…";
    g.fillText(label, CX, CY + 8);
    if (this.phase === "input") {
      g.fillStyle = "rgba(233,226,208,0.5)";
      g.font = "500 12px Inter, sans-serif";
      g.fillText("SPACE to replay", CX, CY + 32);
    }
    // progress dots
    for (let i = 0; i < this.round; i++) {
      const x = CX + (i - (this.round - 1) / 2) * 16;
      g.beginPath();
      g.arc(x, CY + 56, 4, 0, TAU);
      g.fillStyle = this.phase === "input" && i < this.inIdx ? "#7dffa8" : this.phase === "show" && i < this.showIdx ? "#ffd98a" : "rgba(255,255,255,0.2)";
      g.fill();
    }
    const pulse = clamp(0.5 + 0.5 * Math.sin(t * 3), 0, 1);
    g.strokeStyle = `rgba(214,168,76,${0.1 + pulse * 0.1})`;
    g.beginPath();
    g.arc(CX, CY, 78, 0, TAU);
    g.stroke();
  }
}
