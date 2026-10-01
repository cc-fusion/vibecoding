// Level data for Shadow Puppeteer. All coordinates are in TILE units (1 tile = 40px).
// Map is 24 x 14 tiles (960 x 560 px).

export type Motion =
  | { t: "static" }
  | { t: "orbit"; cx: number; cy: number; rx: number; ry: number; period: number; phase?: number }
  | { t: "patrol"; x1: number; y1: number; x2: number; y2: number; period: number; phase?: number }
  | { t: "pendulum"; px: number; py: number; len: number; amp: number; period: number; phase?: number };

export interface ConeDef {
  dir: number; // radians, 0 = right, PI/2 = down
  spread: number; // total opening angle
  sweep?: number; // amplitude of sweeping
  sweepPeriod?: number;
  sweepPhase?: number;
}

export interface LightDef {
  id?: string;
  x: number;
  y: number;
  r: number; // radius in tiles
  color?: [number, number, number];
  motion?: Motion;
  cone?: ConeDef;
  flicker?: { on: number; off: number; phase?: number };
}

export interface MoverDef {
  x: number;
  y: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
  period: number;
  phase?: number;
}

export interface LeverDef {
  ch: string;
  target: string;
  duration: number;
}

export interface LevelDef {
  name: string;
  subtitle: string;
  hints: string[];
  map: string[];
  lights: LightDef[];
  movers?: MoverDef[];
  levers?: LeverDef[];
  threads: number;
}

export const COLS = 24;
export const ROWS = 14;
export const TILE = 40;

class Grid {
  cells: string[][];
  constructor() {
    this.cells = [];
    for (let r = 0; r < ROWS; r++) {
      const row: string[] = [];
      for (let c = 0; c < COLS; c++) {
        const wall = c === 0 || c === COLS - 1 || r >= 12;
        row.push(wall ? "#" : ".");
      }
      this.cells.push(row);
    }
  }
  rect(c1: number, r1: number, c2: number, r2: number, ch = "#") {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) this.set(c, r, ch);
    return this;
  }
  set(c: number, r: number, ch: string) {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) this.cells[r][c] = ch;
    return this;
  }
  rows() {
    return this.cells.map((r) => r.join(""));
  }
}

const AMBER: [number, number, number] = [255, 208, 128];
const ROSE: [number, number, number] = [255, 150, 170];
const ICE: [number, number, number] = [190, 225, 255];
const MINT: [number, number, number] = [170, 255, 200];

// ---------- Level 1 : Ember Hall ----------
const l1 = new Grid()
  .rect(3, 9, 7, 9)
  .rect(10, 9, 13, 9)
  .rect(16, 9, 21, 9)
  .rect(8, 11, 9, 11)
  .set(1, 11, "P")
  .set(21, 11, "X")
  .set(9, 10, "*")
  .set(15, 10, "*")
  .set(11, 8, "*");

// ---------- Level 2 : The Pendulum ----------
const l2 = new Grid()
  .rect(1, 9, 5, 9)
  .rect(9, 9, 12, 9)
  .rect(17, 9, 21, 9)
  .rect(6, 11, 7, 11)
  .rect(14, 11, 15, 11)
  .set(1, 11, "P")
  .set(22, 11, "X")
  .set(6, 10, "*")
  .set(14, 10, "*")
  .set(10, 8, "*")
  .set(11, 11, "C");

// ---------- Level 3 : Midnight Patrol ----------
const l3 = new Grid()
  .rect(1, 9, 5, 9)
  .rect(6, 11, 7, 11)
  .rect(8, 9, 12, 9)
  .rect(8, 6, 11, 6)
  .rect(14, 7, 22, 7)
  .rect(16, 4, 22, 4)
  .set(1, 11, "P")
  .set(21, 6, "X")
  .set(10, 8, "C")
  .set(12, 8, "*")
  .set(14, 6, "*")
  .set(17, 11, "*");

// ---------- Level 4 : Twin Suns ----------
const l4 = new Grid()
  .rect(1, 7, 6, 7)
  .rect(9, 7, 13, 7)
  .rect(16, 7, 20, 7)
  .rect(4, 10, 5, 11)
  .rect(11, 10, 12, 11)
  .rect(18, 10, 19, 11)
  .set(1, 11, "P")
  .set(22, 11, "X")
  .set(5, 9, "*")
  .set(12, 9, "*")
  .set(8, 11, "C")
  .set(15, 10, "*");

// ---------- Level 5 : Flicker Gallery ----------
const l5 = new Grid()
  .rect(2, 9, 5, 9)
  .rect(9, 9, 12, 9)
  .rect(16, 9, 19, 9)
  .rect(7, 11, 8, 11)
  .rect(14, 11, 15, 11)
  .set(1, 11, "P")
  .set(21, 11, "X")
  .set(10, 11, "C")
  .set(10, 8, "*")
  .set(17, 8, "*")
  .set(13, 10, "*");

// ---------- Level 6 : Searchlight Vault ----------
const l6 = new Grid()
  .rect(1, 9, 4, 9)
  .rect(10, 9, 13, 9)
  .rect(19, 9, 21, 9)
  .rect(7, 10, 8, 11)
  .rect(15, 10, 16, 11)
  .set(1, 11, "P")
  .set(22, 11, "X")
  .set(11, 11, "1")
  .set(20, 11, "2")
  .set(8, 9, "*")
  .set(12, 8, "*")
  .set(16, 9, "*")
  .set(3, 11, "C");

// ---------- Level 7 : Paper Screens ----------
const l7 = new Grid()
  .rect(1, 9, 3, 9)
  .rect(20, 9, 22, 9)
  .rect(9, 11, 10, 11)
  .rect(14, 11, 15, 11)
  .set(1, 11, "P")
  .set(22, 11, "X")
  .set(9, 10, "*")
  .set(15, 10, "*")
  .set(6, 11, "*")
  .set(12, 11, "C");

// ---------- Level 8 : The Puppet Master's Stage ----------
const l8 = new Grid()
  .rect(1, 9, 4, 9)
  .rect(6, 11, 6, 11)
  .rect(11, 4, 12, 10)
  .rect(14, 11, 14, 11)
  .rect(15, 9, 18, 9)
  .rect(20, 9, 22, 9)
  .set(1, 11, "P")
  .set(21, 11, "X")
  .set(3, 8, "*")
  .set(11, 11, "*")
  .set(17, 8, "*")
  .set(12, 11, "C")
  .set(17, 11, "1");

export const LEVELS: LevelDef[] = [
  {
    name: "Ember Hall",
    subtitle: "A single flame. Learn to belong to the dark.",
    hints: [
      "Light dissolves you. Shadow is your only home.",
      "A / D move  ·  W / Space jump  ·  Shift dash",
      "Hide beneath the canopies and dash across the lit gaps.",
      "Collect the glimmering memory shards for extra stars.",
    ],
    map: l1.rows(),
    threads: 4,
    lights: [{ id: "flame", x: 12, y: 1.5, r: 18 }],
  },
  {
    name: "The Pendulum",
    subtitle: "The lantern swings. So do the shadows.",
    hints: [
      "Shadows slide as the light moves. Watch their edges.",
      "Touch a candle totem to keep your place. Rest in shade to recover essence.",
    ],
    map: l2.rows(),
    threads: 4,
    lights: [
      { id: "swing", x: 12, y: 6.5, r: 17, motion: { t: "pendulum", px: 12, py: 0, len: 6.5, amp: 1.15, period: 5 } },
    ],
  },
  {
    name: "Midnight Patrol",
    subtitle: "Climb the stage while the lamp walks the ceiling.",
    hints: [
      "Overhangs are safe only while the lamp is above them.",
      "Jump from ledge to ledge — the exit waits at the top right.",
    ],
    map: l3.rows(),
    threads: 4,
    lights: [
      {
        id: "patrol",
        x: 2,
        y: 1.5,
        r: 17,
        motion: { t: "patrol", x1: 2, y1: 1.5, x2: 22, y2: 1.5, period: 9 },
      },
    ],
  },
  {
    name: "Twin Suns",
    subtitle: "Two lanterns circle each other. There is always a gap.",
    hints: ["Low walls cast short shadows. Canopies cast long ones.", "When one sun rises, the other sets."],
    map: l4.rows(),
    threads: 4,
    lights: [
      {
        id: "sunA",
        x: 12,
        y: 3.5,
        r: 14,
        motion: { t: "orbit", cx: 12, cy: 3.6, rx: 10.5, ry: 2, period: 10 },
      },
      {
        id: "sunB",
        x: 12,
        y: 3.5,
        r: 13,
        color: ROSE,
        motion: { t: "orbit", cx: 12, cy: 3.6, rx: 10.5, ry: 2, period: 10, phase: Math.PI },
      },
    ],
  },
  {
    name: "Flicker Gallery",
    subtitle: "The bulbs are failing. You will see them coming.",
    hints: [
      "A dim shimmer means a lamp is about to ignite.",
      "Steps lead up to the canopy roofs — a bolder route with shards.",
    ],
    map: l5.rows(),
    threads: 4,
    lights: [
      { id: "f1", x: 4, y: 1.5, r: 10, flicker: { on: 1.5, off: 2.5, phase: 0 } },
      { id: "f2", x: 10, y: 1.5, r: 10, flicker: { on: 1.6, off: 2.4, phase: 1.1 } },
      { id: "f3", x: 15, y: 1.5, r: 10, color: MINT, flicker: { on: 1.5, off: 2.5, phase: 2.3 } },
      { id: "f4", x: 21, y: 1.5, r: 10, flicker: { on: 1.7, off: 2.3, phase: 3.2 } },
    ],
  },
  {
    name: "Searchlight Vault",
    subtitle: "The sentries never sleep. Perhaps they can be blinded.",
    hints: [
      "Searchlights sweep in cones. Walls block them completely.",
      "Stand at a lever and press E to blind a sentry for a while.",
    ],
    map: l6.rows(),
    threads: 4,
    levers: [
      { ch: "1", target: "sentA", duration: 9 },
      { ch: "2", target: "sentB", duration: 9 },
    ],
    lights: [
      {
        id: "sentA",
        x: 6,
        y: 0.6,
        r: 17,
        color: ICE,
        cone: { dir: Math.PI / 2, spread: 0.8, sweep: 0.95, sweepPeriod: 5, sweepPhase: 0 },
      },
      {
        id: "sentB",
        x: 17,
        y: 0.6,
        r: 17,
        color: ICE,
        cone: { dir: Math.PI / 2, spread: 0.8, sweep: 0.95, sweepPeriod: 5.6, sweepPhase: 2 },
      },
      {
        id: "sentC",
        x: 22.4,
        y: 6.5,
        r: 14,
        color: ROSE,
        cone: { dir: Math.PI * 0.93, spread: 0.6, sweep: 0.5, sweepPeriod: 6, sweepPhase: 1 },
      },
    ],
  },
  {
    name: "Paper Screens",
    subtitle: "Ride the moving shadows of hanging screens.",
    hints: [
      "Paper screens drift above. You can pass through them — their shadows are your bridge.",
      "Follow a shadow, then leap to the next before it drifts away.",
    ],
    map: l7.rows(),
    threads: 4,
    movers: [
      { x: 7.5, y: 6, w: 3, h: 0.4, dx: 2.2, dy: 0, period: 7, phase: 0 },
      { x: 11.5, y: 6, w: 3, h: 0.4, dx: 2.2, dy: 0.5, period: 7.5, phase: Math.PI },
      { x: 15.5, y: 6, w: 3, h: 0.4, dx: 2.2, dy: 0, period: 7, phase: Math.PI / 2 },
    ],
    lights: [{ id: "high", x: 12, y: 0.6, r: 22, color: AMBER }],
  },
  {
    name: "The Puppet Master's Stage",
    subtitle: "Every light in the theatre is watching. Take your bow.",
    hints: [
      "The great wall has a crawlspace — a sanctuary from every lamp.",
      "A lever near the exit will blind the sentry. Time it well.",
    ],
    map: l8.rows(),
    threads: 5,
    levers: [{ ch: "1", target: "eye", duration: 9 }],
    movers: [{ x: 15, y: 6.5, w: 3, h: 0.4, dx: 2, dy: 0, period: 6, phase: 0 }],
    lights: [
      {
        id: "sun",
        x: 12,
        y: 2,
        r: 15,
        motion: { t: "orbit", cx: 12, cy: 2, rx: 9, ry: 0.8, period: 10 },
      },
      { id: "moth", x: 3, y: 4, r: 8, color: ROSE, flicker: { on: 2, off: 2, phase: 0 } },
      {
        id: "eye",
        x: 22.4,
        y: 3,
        r: 15,
        color: ICE,
        cone: { dir: 2.4, spread: 0.65, sweep: 0.7, sweepPeriod: 6, sweepPhase: 0 },
      },
    ],
  },
];
