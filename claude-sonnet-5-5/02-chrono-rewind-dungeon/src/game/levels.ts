export const TS = 40;
export const COLS = 20;
export const ROWS = 13;

export interface LevelDef {
  name: string;
  hint: string;
  time: number; // seconds of timeline
  maxGhosts: number;
  par: number; // echoes for 3 stars
  rows: string[];
  boss?: boolean;
}

/*
 Legend
  #  wall            .  floor          P  player start     E  exit portal
  1-4 pressure plate (channel 1-4)     a-d timed plate (channel 1-4, stays lit for 2.5s)
  A-D door (channel 1-4)               K  crimson gate (opens when every slime is slain)
  S / s  spike trap (two alternating phases)
  > < ^ v  wall turret firing in that direction
  m / n  slime patrolling horizontally / vertically
*/
class B {
  g: string[][];
  constructor() {
    this.g = Array.from({ length: ROWS }, (_, y) =>
      Array.from({ length: COLS }, (_, x) => (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 ? '#' : '.')),
    );
  }
  set(x: number, y: number, c: string) {
    this.g[y][x] = c;
    return this;
  }
  rect(x1: number, y1: number, x2: number, y2: number, c: string) {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) this.g[y][x] = c;
    return this;
  }
  checker(x1: number, y1: number, x2: number, y2: number) {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) this.g[y][x] = (x + y) % 2 === 0 ? 'S' : 's';
    return this;
  }
  vline(x: number, y1: number, y2: number, c: string) {
    return this.rect(x, y1, x, y2, c);
  }
  out() {
    return this.g.map((r) => r.join(''));
  }
}

export const LEVELS: LevelDef[] = [
  {
    name: 'First Echo',
    hint: 'Stand on the glowing plate, then press R to rewind. Your echo will hold it down while you walk through the door.',
    time: 25,
    maxGhosts: 2,
    par: 1,
    rows: new B().vline(10, 1, 11, '#').set(10, 6, 'A').set(2, 6, 'P').set(4, 9, '1').set(17, 6, 'E').out(),
  },
  {
    name: 'Two Locks',
    hint: 'Echoes stack. Each past run keeps doing exactly what you did, while you start a brand new one.',
    time: 35,
    maxGhosts: 3,
    par: 2,
    rows: new B()
      .vline(7, 1, 11, '#')
      .set(7, 6, 'A')
      .vline(13, 1, 11, '#')
      .set(13, 6, 'B')
      .set(2, 6, 'P')
      .set(3, 2, '1')
      .set(10, 10, '2')
      .set(17, 6, 'E')
      .out(),
  },
  {
    name: 'Blade Dance',
    hint: 'Slay every slime to open the crimson gate. SPACE / J slashes. Echoes fight too, and their blades never tire.',
    time: 40,
    maxGhosts: 3,
    par: 1,
    rows: new B()
      .vline(14, 1, 11, '#')
      .set(14, 6, 'K')
      .rect(5, 3, 5, 3, '#')
      .rect(5, 9, 5, 9, '#')
      .rect(9, 6, 9, 6, '#')
      .set(2, 6, 'P')
      .set(8, 2, 'm')
      .set(11, 4, 'n')
      .set(7, 10, 'm')
      .set(18, 6, 'E')
      .out(),
  },
  {
    name: 'Needle Garden',
    hint: 'Both plates must be held at once. Echoes walk through spikes unharmed, and you can dash through them (SHIFT / K).',
    time: 40,
    maxGhosts: 3,
    par: 2,
    rows: new B()
      .vline(9, 1, 11, '#')
      .set(9, 6, 'A')
      .set(3, 2, 'a')
      .set(3, 10, 'a')
      .checker(12, 1, 15, 11)
      .set(2, 6, 'P')
      .set(18, 6, 'E')
      .out(),
  },
  {
    name: 'Crossfire',
    hint: 'Turrets cannot hurt echoes. Send them into the firing lanes, then slip past the bolts (slashes can cut bolts down).',
    time: 40,
    maxGhosts: 3,
    par: 2,
    rows: new B()
      .vline(16, 1, 11, '#')
      .set(16, 6, 'A')
      .set(9, 3, '1')
      .set(9, 9, '1')
      .set(9, 0, 'v')
      .set(9, 12, '^')
      .set(5, 0, 'v')
      .set(13, 12, '^')
      .set(0, 2, '>')
      .set(0, 10, '>')
      .set(2, 6, 'P')
      .set(18, 6, 'E')
      .out(),
  },
  {
    name: 'Chain Reaction',
    hint: 'The second door needs BOTH blue-pink plates lit. One of them lies beyond the first door. Plan your echoes in order.',
    time: 55,
    maxGhosts: 4,
    par: 3,
    rows: new B()
      .vline(7, 1, 11, '#')
      .set(7, 6, 'A')
      .vline(14, 1, 11, '#')
      .set(14, 6, 'B')
      .set(3, 2, '1')
      .set(3, 10, '2')
      .set(10, 3, '2')
      .set(11, 6, 'n')
      .set(2, 6, 'P')
      .set(18, 6, 'E')
      .out(),
  },
  {
    name: 'The Reliquary',
    hint: 'Open the vault, slaughter its guardians, cross the needle bridge, and unlock the last door with a lingering echo.',
    time: 55,
    maxGhosts: 4,
    par: 2,
    rows: new B()
      .vline(7, 1, 11, '#')
      .set(7, 6, 'A')
      .set(3, 2, '1')
      .set(3, 10, 'b')
      .vline(14, 1, 11, '#')
      .set(14, 6, 'K')
      .vline(17, 1, 11, '#')
      .set(17, 6, 'B')
      .checker(15, 1, 16, 11)
      .set(10, 2, 'm')
      .set(10, 10, 'm')
      .set(12, 5, 'n')
      .set(9, 7, 'n')
      .set(11, 0, 'v')
      .set(12, 12, '^')
      .set(2, 6, 'P')
      .set(18, 6, 'E')
      .out(),
  },
  {
    name: 'The Chronos Warden',
    hint: 'The Warden is shielded until BOTH rune plates glow. Let echoes hold the runes and strike while you dodge. Bank damage with R.',
    time: 60,
    maxGhosts: 5,
    par: 4,
    boss: true,
    rows: new B()
      .set(2, 2, '1')
      .set(17, 2, '1')
      .rect(5, 4, 5, 4, '#')
      .rect(14, 4, 14, 4, '#')
      .rect(5, 8, 5, 8, '#')
      .rect(14, 8, 14, 8, '#')
      .rect(1, 11, 2, 11, 'S')
      .rect(17, 11, 18, 11, 's')
      .set(9, 11, 'P')
      .set(9, 6, 'E')
      .out(),
  },
];
