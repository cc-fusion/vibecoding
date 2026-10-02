import { audio } from "../audio";
import { TAU, roundRect, shuffle } from "../util";
import { CX, H, Inp, Mech, MechEnv, pressedAny, tableAt } from "./base";

const LEN = [0, 3, 3, 4, 4, 4, 5, 5];
const SYMS = [0, 5, 6, 6, 6, 7, 7, 8];
const TRIES = [0, 7, 8, 8, 8, 9, 9, 10];
const GLYPHS = ["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ"];
const COLORS = ["#ff7a6a", "#ffc65a", "#8aff9a", "#6ad0ff", "#b08aff", "#ff8ad0", "#e8e8e8", "#c0884a"];

interface Row {
  guess: number[];
  exact: number;
  near: number;
}

const KEYS_X0 = 600;
const KEYS_Y0 = 150;
const KEY = 64;

export class CipherMech extends Mech {
  readonly help = "Type 1-8 or click glyphs · BACKSPACE removes · ENTER submits. Green = right glyph & place, amber = right glyph, wrong place.";
  private len: number;
  private syms: number;
  private tries: number;
  private dups: boolean;
  private code: number[] = [];
  private known: boolean[] = [];
  private cur: (number | null)[] = [];
  private rows: Row[] = [];
  private pulse = 0;
  private shakeT = 0;

  constructor(env: MechEnv, level: number, rng: () => number) {
    super(env, level, rng);
    this.len = tableAt(LEN, level);
    this.syms = tableAt(SYMS, level);
    this.tries = tableAt(TRIES, level);
    this.dups = level >= 5;
    this.newCode();
  }

  private newCode() {
    const r = this.rng;
    if (this.dups) {
      this.code = Array.from({ length: this.len }, () => Math.floor(r() * this.syms));
    } else {
      this.code = shuffle(r, Array.from({ length: this.syms }, (_, i) => i)).slice(0, this.len);
    }
    this.rows = [];
    this.known = new Array(this.len).fill(false);
    const reveal = Math.min(this.env.hint, this.len - 2);
    const idxs = shuffle(r, Array.from({ length: this.len }, (_, i) => i)).slice(0, reveal);
    idxs.forEach((i) => (this.known[i] = true));
    this.cur = this.code.map((c, i) => (this.known[i] ? c : null));
  }

  private symAt(i: number) {
    return { x: KEYS_X0 + (i % 4) * (KEY + 12), y: KEYS_Y0 + Math.floor(i / 4) * (KEY + 12) };
  }

  private add(s: number) {
    const slot = this.cur.findIndex((v, i) => v === null && !this.known[i]);
    if (slot < 0) return;
    this.cur[slot] = s;
    audio.tick(0.5, 0.1);
  }

  private remove() {
    for (let i = this.cur.length - 1; i >= 0; i--) {
      if (this.cur[i] !== null && !this.known[i]) {
        this.cur[i] = null;
        audio.tick(0.15, 0.08);
        return;
      }
    }
  }

  private submit() {
    if (this.cur.some((v) => v === null)) {
      this.env.fx.text(CX - 100, 120, "Fill every slot", "#ffd98a", 16);
      return;
    }
    const guess = this.cur as number[];
    let exact = 0;
    const cc: number[] = new Array(this.syms).fill(0);
    const gc: number[] = new Array(this.syms).fill(0);
    guess.forEach((g, i) => {
      if (g === this.code[i]) exact++;
      else {
        cc[this.code[i]]++;
        gc[g]++;
      }
    });
    let near = 0;
    for (let s = 0; s < this.syms; s++) near += Math.min(cc[s], gc[s]);
    if (exact === this.len) {
      this.rows.push({ guess: guess.slice(), exact, near });
      audio.setPin();
      this.env.fx.burst(CX - 100, 300, 24, "#9dffba", 200, 0.8, 300);
      this.env.fx.text(CX - 100, 110, "CODE ACCEPTED", "#9dffba", 22);
      this.finish();
      return;
    }
    this.rows.push({ guess: guess.slice(), exact, near });
    this.pulse = 1;
    this.env.fault(4, 0, CX - 100, 110, exact === 0 && near === 0 ? "NOTHING MATCHES" : "WRONG CODE");
    this.cur = this.code.map((_, i) => (this.known[i] ? this.code[i] : null));
    if (this.rows.length >= this.tries) {
      this.env.fault(18, 1, CX - 100, 160, "MECHANISM RESET");
      this.shakeT = 1;
      this.newCode();
    }
  }

  update(_dt: number, inp: Inp, active: boolean) {
    this.pulse = Math.max(0, this.pulse - _dt * 3);
    this.shakeT = Math.max(0, this.shakeT - _dt * 2);
    if (!active) return;
    for (let d = 1; d <= this.syms; d++) {
      if (pressedAny(inp, `Digit${d}`, `Numpad${d}`)) this.add(d - 1);
    }
    if (pressedAny(inp, "Backspace", "Delete")) this.remove();
    if (pressedAny(inp, "Enter")) this.submit();
    if (inp.pdown) {
      for (let i = 0; i < this.syms; i++) {
        const k = this.symAt(i);
        if (inp.px >= k.x && inp.px <= k.x + KEY && inp.py >= k.y && inp.py <= k.y + KEY) this.add(i);
      }
      // submit & back buttons
      if (inp.px >= 600 && inp.px <= 720 && inp.py >= 360 && inp.py <= 408) this.submit();
      if (inp.px >= 736 && inp.px <= 856 && inp.py >= 360 && inp.py <= 408) this.remove();
      // slot click
      for (let i = 0; i < this.len; i++) {
        const sx = 120 + i * 62;
        if (inp.px >= sx && inp.px <= sx + 54 && inp.py >= 440 && inp.py <= 494 && !this.known[i] && this.cur[i] !== null) {
          this.cur[i] = null;
        }
      }
    }
  }

  private glyph(g: CanvasRenderingContext2D, s: number, x: number, y: number, size: number, dim = false) {
    g.fillStyle = dim ? "#1a171f" : "#221e28";
    roundRect(g, x, y, size, size, 8);
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = COLORS[s];
    g.globalAlpha = dim ? 0.4 : 1;
    g.stroke();
    g.fillStyle = COLORS[s];
    g.font = `700 ${size * 0.5}px serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(GLYPHS[s], x + size / 2, y + size / 2 + 1);
    g.font = `600 ${Math.max(9, size * 0.17)}px Inter, sans-serif`;
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.fillText(String(s + 1), x + size - 9, y + size - 8);
    g.globalAlpha = 1;
  }

  draw(g: CanvasRenderingContext2D) {
    g.textBaseline = "middle";
    // panel
    g.fillStyle = "rgba(20,17,26,0.9)";
    roundRect(g, 90, 60, 450, 440, 14);
    g.fill();
    g.strokeStyle = "rgba(214,168,76,0.5)";
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = "#f3d88d";
    g.font = "700 15px Cinzel, serif";
    g.textAlign = "left";
    g.fillText(`CODE HISTORY  ·  tries ${this.rows.length}/${this.tries}`, 112, 84);
    // history rows
    const maxRows = this.tries;
    const rowH = Math.min(36, 300 / maxRows);
    for (let r = 0; r < maxRows; r++) {
      const y = 104 + r * rowH;
      const row = this.rows[r];
      g.fillStyle = r % 2 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.05)";
      g.fillRect(104, y, 422, rowH - 3);
      const size = rowH - 7;
      for (let i = 0; i < this.len; i++) {
        const x = 112 + i * (size + 6);
        if (row) this.glyph(g, row.guess[i], x, y + 2, size);
        else {
          g.strokeStyle = "rgba(255,255,255,0.08)";
          g.lineWidth = 1;
          g.strokeRect(x, y + 2, size, size);
        }
      }
      if (row) {
        let px = 112 + this.len * (size + 6) + 24;
        for (let i = 0; i < row.exact; i++, px += 16) {
          g.fillStyle = "#6dff9a";
          g.beginPath();
          g.arc(px, y + rowH / 2 - 1, 6, 0, TAU);
          g.fill();
        }
        for (let i = 0; i < row.near; i++, px += 16) {
          g.fillStyle = "#ffb84a";
          g.beginPath();
          g.arc(px, y + rowH / 2 - 1, 6, 0, TAU);
          g.fill();
        }
      }
    }
    // current guess
    g.fillStyle = "rgba(233,226,208,0.7)";
    g.font = "600 13px Inter, sans-serif";
    g.textAlign = "left";
    g.fillText("YOUR GUESS (revealed glyphs are locked in)", 112, 424);
    for (let i = 0; i < this.len; i++) {
      const sx = 120 + i * 62 + (this.shakeT > 0 ? Math.sin(this.shakeT * 60) * 4 : 0);
      const v = this.cur[i];
      if (v !== null) {
        this.glyph(g, v, sx, 440, 54);
        if (this.known[i]) {
          g.strokeStyle = "#6ad0ff";
          g.lineWidth = 3;
          roundRect(g, sx - 2, 438, 58, 58, 9);
          g.stroke();
        }
      } else {
        g.strokeStyle = "rgba(214,168,76,0.6)";
        g.setLineDash([5, 4]);
        g.lineWidth = 2;
        roundRect(g, sx, 440, 54, 54, 8);
        g.stroke();
        g.setLineDash([]);
      }
    }
    // keypad
    g.fillStyle = "#f3d88d";
    g.font = "700 15px Cinzel, serif";
    g.textAlign = "left";
    g.fillText("GLYPH KEYPAD", KEYS_X0, 124);
    for (let i = 0; i < this.syms; i++) {
      const k = this.symAt(i);
      this.glyph(g, i, k.x, k.y, KEY);
    }
    // buttons
    const btn = (x: number, label: string, col: string) => {
      g.fillStyle = col;
      roundRect(g, x, 360, 120, 48, 10);
      g.fill();
      g.fillStyle = "#1a1206";
      g.font = "700 15px Cinzel, serif";
      g.textAlign = "center";
      g.fillText(label, x + 60, 385);
    };
    btn(600, "TURN  ⏎", "#d6a84c");
    btn(736, "BACK ⌫", "#8a93a4");
    // legend
    g.textAlign = "left";
    g.font = "500 12px Inter, sans-serif";
    g.fillStyle = "#6dff9a";
    g.fillText("● right glyph, right place", 600, 440);
    g.fillStyle = "#ffb84a";
    g.fillText("● right glyph, wrong place", 600, 460);
    g.fillStyle = "rgba(233,226,208,0.6)";
    g.fillText(this.dups ? "Glyphs may repeat." : "No glyph repeats.", 600, 480);
    if (this.pulse > 0) {
      g.fillStyle = `rgba(255,70,70,${this.pulse * 0.12})`;
      g.fillRect(0, 0, 960, H);
    }
  }
}
