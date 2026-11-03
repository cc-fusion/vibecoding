// Procedural pixel-art texture atlas, item sprites, isometric icons, misc textures.
import * as THREE from 'three';
import { TILE, MATS, TOOLS, BLOCKS, K, TINT_TILE } from './blocks';
import { hash3 } from './noise';
import { ITEMDEF } from './items';

const TS = 16;
type C = number[];
let atlasCanvas: HTMLCanvasElement;
let atlasCtx: CanvasRenderingContext2D;
let atlasData: ImageData;
let atlasTex: THREE.CanvasTexture;

const clampB = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
let cur = 0;
const rn = (x: number, y: number, k = 0) => hash3(x, y, cur * 17 + k, 4242);
const vn = (x: number, y: number, s: number, k = 0) => {
  const P = TS / s, gx = x / s, gy = y / s, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const h = (a: number, b: number) => rn(((a % P) + P) % P, ((b % P) + P) % P, 100 + k);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return (h(x0, y0) * (1 - sx) + h(x0 + 1, y0) * sx) * (1 - sy) + (h(x0, y0 + 1) * (1 - sx) + h(x0 + 1, y0 + 1) * sx) * sy;
};
const jit = (b: C, amp: number, x: number, y: number, k = 0): C => {
  const f = 1 + (rn(x, y, k) - 0.5) * 2 * amp;
  return [b[0] * f, b[1] * f, b[2] * f];
};
const mul = (c: C, f: number): C => [c[0] * f, c[1] * f, c[2] * f];

type Fn = (x: number, y: number) => C | null;
function paint(name: string, fn: Fn) {
  const t = TILE[name];
  if (t === undefined) return;
  cur = t;
  const ox = (t & 15) * TS, oy = (t >> 4) * TS;
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const c = fn(x, y);
    const i = ((oy + y) * 256 + ox + x) * 4;
    if (!c) { atlasData.data[i + 3] = 0; continue; }
    atlasData.data[i] = clampB(c[0]); atlasData.data[i + 1] = clampB(c[1]); atlasData.data[i + 2] = clampB(c[2]);
    atlasData.data[i + 3] = c[3] === undefined ? 255 : clampB(c[3]);
  }
}

const DIRT: C = [121, 85, 58], PLANK: C = [176, 140, 86];
const stoneFn: Fn = (x, y) => { const c = 128 + (rn(x, y) - 0.5) * 24 + (vn(x, y, 4) - 0.5) * 26; return [c, c, c + 2]; };
const cobbleFn: Fn = (x, y) => {
  const cell = (Math.floor(y / 5) * 3 + Math.floor((x + (Math.floor(y / 5) % 2) * 3) / 6)) | 0;
  const edge = (y % 5 === 0) || ((x + (Math.floor(y / 5) % 2) * 3) % 6 === 0);
  const base = 118 + (hash3(cell, 1, 5, 9) - 0.5) * 40 + (rn(x, y) - 0.5) * 14;
  return mul([base, base, base + 2], edge ? 0.62 : 1);
};
const dirtFn: Fn = (x, y) => (rn(x, y, 3) > 0.9 ? mul(jit(DIRT, 0.1, x, y), 0.72) : jit(DIRT, 0.14, x, y));
const woolFn = (b: C): Fn => (x, y) => mul(b, 0.94 + rn(x, y) * 0.1 + (((x >> 1) + (y >> 1)) % 2 ? 0.03 : 0));
const planksFn: Fn = (x, y) => {
  const row = Math.floor(y / 4), seam = y % 4 === 3, jx = (x + row * 5) % 16;
  let c = jit(PLANK, 0.07, x, y);
  c = mul(c, 0.94 + vn(x, y, 8) * 0.1 + (rn(Math.floor(x / 2), row, 2) - 0.5) * 0.08);
  if (seam) c = mul(c, 0.72);
  if (jx === 0 && !seam) c = mul(c, 0.8);
  return c;
};
const oreFn = (col: C): Fn => (x, y) => {
  const s = stoneFn(x, y)!;
  const v = vn(x, y, 4, 3) * 0.75 + rn(x, y, 8) * 0.25;
  return v > 0.66 ? jit(col, 0.12, x, y, 4) : s;
};
const bevel = (base: C, hi: C, lo: C, x: number, y: number): C => (x === 0 || y === 0 ? hi : x === 15 || y === 15 ? lo : base);

function buildTiles() {
  paint('white', () => [255, 255, 255]);
  paint('grass_top', (x, y) => { const g = 208 + (rn(x, y) - 0.5) * 40 + (vn(x, y, 4) - 0.5) * 30; return [g, g, g]; });
  paint('grass_side', (x, y) => {
    const d = 3 + (rn(x, 0, 5) > 0.5 ? 1 : 0) + (rn(x, 0, 6) > 0.88 ? 1 : 0);
    return y < d ? jit([92, 150, 58], 0.14, x, y) : dirtFn(x, y);
  });
  paint('grass_side_snow', (x, y) => {
    const d = 4 + (rn(x, 0, 5) > 0.5 ? 1 : 0) + (rn(x, 0, 6) > 0.85 ? 1 : 0);
    return y < d ? jit([240, 244, 248], 0.04, x, y) : dirtFn(x, y);
  });
  paint('dirt', dirtFn);
  paint('stone', stoneFn);
  paint('cobble', cobbleFn);
  paint('sand', (x, y) => jit([220, 206, 152], 0.05, x, y));
  paint('gravel', (x, y) => { const v = vn(x, y, 4); const g = v > 0.55 ? 150 : v > 0.35 ? 128 : 100; return mul([g, g - 3, g - 6], 0.9 + rn(x, y) * 0.2); });
  const logSide = (b: C, spots = false): Fn => (x, y) => {
    let c = mul(b, 0.82 + rn(x, 0, 1) * 0.3 + (rn(x, y, 2) - 0.5) * 0.1);
    if (spots && rn(x >> 0, y >> 1, 9) > 0.86) c = [40, 40, 40];
    return c;
  };
  const logTop = (ring: C, bark: C, inner: C): Fn => (x, y) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    if (d > 6) return jit(bark, 0.12, x, y);
    const r = Math.floor(Math.hypot(x - 7.5, y - 7.5));
    return jit(r % 2 === 0 ? ring : inner, 0.06, x, y);
  };
  paint('log_side', logSide([104, 82, 50]));
  paint('log_top', logTop([178, 142, 88], [104, 82, 50], [150, 116, 70]));
  paint('birch_side', (x, y) => { const c = logSide([222, 220, 212], true)(x, y); return c; });
  paint('birch_top', logTop([210, 190, 140], [222, 220, 212], [190, 168, 120]));
  paint('spruce_side', logSide([72, 54, 36]));
  paint('spruce_top', logTop([140, 106, 66], [72, 54, 36], [118, 86, 52]));
  const leaves = (b: C, tint: boolean): Fn => (x, y) => {
    const h = rn(x, y, 1);
    if (h < 0.16) return null;
    const v = 0.72 + rn(x, y, 2) * 0.4;
    return tint ? [200 * v, 200 * v, 200 * v] : mul(b, v);
  };
  paint('leaves_oak', leaves([0, 0, 0], true));
  paint('leaves_birch', leaves([128, 178, 74], false));
  paint('leaves_spruce', leaves([62, 106, 66], false));
  paint('planks', planksFn);
  paint('water', (x, y) => [40 + vn(x, y, 4) * 30, 100 + vn(x, y, 4) * 30, 205, 190]);
  paint('lava', (x, y) => { const v = vn(x, y, 4) * 0.6 + rn(x, y) * 0.4; return v > 0.62 ? [255, 215, 70] : v > 0.4 ? [240, 120, 20] : [200, 60, 10]; });
  paint('bedrock', (x, y) => { const g = 38 + vn(x, y, 4) * 70 + rn(x, y) * 30; return [g, g, g + 3]; });
  paint('coal_ore', oreFn([28, 28, 30]));
  paint('iron_ore', oreFn([214, 176, 150]));
  paint('gold_ore', oreFn([250, 226, 70]));
  paint('diamond_ore', oreFn([90, 225, 216]));
  paint('snow', (x, y) => jit([244, 247, 252], 0.025, x, y));
  paint('ice', (x, y) => [150 + rn(x, y) * 20, 195 + rn(x, y) * 15, 240, 175]);
  paint('sandstone_top', (x, y) => jit([220, 206, 152], 0.04, x, y));
  paint('sandstone_bottom', (x, y) => jit([208, 192, 140], 0.04, x, y));
  paint('sandstone_side', (x, y) => mul(jit([216, 200, 148], 0.04, x, y), y === 3 || y === 12 ? 0.86 : y % 8 === 4 ? 1.04 : 1));
  paint('cactus_top', (x, y) => (Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) > 5.5 ? [60, 100, 30] : jit([88, 140, 50], 0.1, x, y)));
  paint('cactus_side', (x, y) => {
    if (x === 0 || x === 15) return [58, 96, 32];
    if ((x === 4 || x === 8 || x === 12) && y % 4 === 1) return [226, 226, 200];
    return mul(jit([84, 132, 46], 0.08, x, y), x % 4 === 3 ? 0.88 : 1);
  });
  paint('glass', (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 ? [210, 235, 245, 255] : (x + y === 4 || x + y === 5 || x + y === 9 ? [235, 248, 255, 190] : null)));
  paint('stone_bricks', (x, y) => {
    const row = Math.floor(y / 4), off = row % 2 ? 4 : 0;
    const edge = y % 4 === 3 || (x + off) % 8 === 7;
    const c = 128 + (rn(x, y) - 0.5) * 14;
    return mul([c, c, c + 2], edge ? 0.7 : 1);
  });
  const darkWood: C = [104, 76, 40];
  paint('table_top', (x, y) => { const e = x < 1 || y < 1 || x > 14 || y > 14; const m = x === 7 || x === 8 || y === 7 || y === 8; return e ? mul(darkWood, 0.9) : m ? mul(planksFn(x, y)!, 0.7) : mul(planksFn(x, y)!, 1.05); });
  paint('table_side', (x, y) => (y < 3 ? mul(darkWood, 0.95 + rn(x, y) * 0.1) : (y > 3 && y < 10 && (x === 3 || x === 4 || x === 11 || x === 12)) ? [70, 70, 74] : planksFn(x, y)));
  paint('table_front', (x, y) => (y < 3 ? mul(darkWood, 0.95 + rn(x, y) * 0.1) : (x > 2 && x < 7 && y > 4 && y < 11 && (x === 3 || y === 5)) ? [180, 60, 50] : (x > 8 && x < 14 && y > 4 && y < 12 && (x === 13 || y === 5)) ? [80, 80, 90] : planksFn(x, y)));
  const front = (lit: boolean): Fn => (x, y) => {
    if (x > 3 && x < 12 && y > 7 && y < 15) return lit ? (y > 11 ? [255, 190 + rn(x, y) * 40, 60] : [230, 110, 30]) : (y === 8 ? [60, 60, 62] : [28, 28, 30]);
    if (x > 3 && x < 12 && y > 3 && y < 7) return mul(stoneFn(x, y)!, 0.6);
    return cobbleFn(x, y);
  };
  paint('furnace_front', front(false));
  paint('furnace_front_lit', front(true));
  paint('furnace_side', cobbleFn);
  paint('furnace_top', (x, y) => mul(stoneFn(x, y)!, 0.8));
  paint('chest_front', (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return [60, 40, 20];
    if (x >= 7 && x <= 8 && y >= 5 && y <= 8) return [210, 190, 120];
    if (y === 6 && (x < 7 || x > 8)) return [70, 48, 24];
    return mul(planksFn(x, y)!, 0.82);
  });
  paint('chest_side', (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 ? [60, 40, 20] : y === 6 ? [70, 48, 24] : mul(planksFn(x, y)!, 0.82)));
  paint('chest_top', (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 ? [60, 40, 20] : mul(planksFn(x, y)!, 0.9)));
  paint('torch', (x, y) => {
    if ((x === 7 || x === 8) && y >= 6) return mul([128, 94, 50], x === 8 ? 0.8 : 1);
    if ((x === 7 || x === 8) && y === 5) return [255, 235, 110];
    if ((x === 7 || x === 8) && y === 4) return [255, 150, 30];
    return null;
  });
  const blades = (base: C, seedK: number): Fn => (x, y) => {
    const cols = [1, 3, 4, 6, 8, 9, 11, 12, 14];
    if (!cols.includes(x)) return null;
    const h = 5 + Math.floor(hash3(x, 1, seedK, 5) * 9);
    if (y < 16 - h) return null;
    return mul(base, 0.8 + rn(x, y) * 0.35 + (16 - y) * 0.01);
  };
  paint('tallgrass', blades([205, 205, 205], 1));
  const flower = (petal: C): Fn => (x, y) => {
    if ((x === 7 || x === 8) && y >= 8) return [70 + rn(x, y) * 20, 130, 50];
    if (x >= 5 && x <= 10 && y >= 3 && y <= 8 && !((x === 5 || x === 10) && (y === 3 || y === 8))) return (x === 7 || x === 8) && (y === 5 || y === 6) ? [250, 220, 70] : jit(petal, 0.08, x, y);
    if ((x === 6 && y === 10) || (x === 9 && y === 11)) return [70, 140, 50];
    return null;
  };
  paint('flower_red', flower([215, 30, 40]));
  paint('flower_yellow', flower([250, 214, 40]));
  paint('deadbush', (x, y) => {
    const twig = (x === 7 && y > 7) || (y === 8 && x > 3 && x < 7) || (y === 6 && x > 7 && x < 12) || (x === 4 && y >= 6 && y <= 8) || (x === 11 && y >= 3 && y <= 6) || (x === 8 && y > 11);
    return twig ? mul([120, 86, 44], 0.85 + rn(x, y) * 0.3) : null;
  });
  paint('sapling', (x, y) => {
    if ((x === 7 || x === 8) && y >= 9) return [100, 76, 40];
    const d = Math.hypot(x - 7.5, y - 5.5);
    if (d < 4.6 && rn(x, y, 1) > 0.2) return mul([70, 130, 40], 0.75 + rn(x, y) * 0.5);
    return null;
  });
  for (const [n, c] of [['white', [234, 234, 234]], ['red', [176, 46, 38]], ['blue', [52, 70, 170]], ['green', [84, 124, 36]], ['yellow', [232, 200, 50]], ['black', [28, 28, 32]]] as [string, C][]) paint('wool_' + n, woolFn(c));
  paint('farmland_top', (x, y) => mul(jit([100, 66, 40], 0.1, x, y), x % 4 === 0 ? 0.78 : 1));
  const wheat = (h: number, c: C, head: boolean): Fn => (x, y) => {
    if (x % 3 !== 1) return null;
    const hh = h - ((x * 7) % 3);
    if (y < 16 - hh) return null;
    if (head && y < 16 - hh + 3 && x % 3 === 1) return mul([226, 190, 82], 0.85 + rn(x, y) * 0.3);
    return mul(c, 0.8 + rn(x, y) * 0.4);
  };
  paint('wheat_0', wheat(4, [90, 160, 50], false));
  paint('wheat_1', wheat(8, [100, 165, 55], false));
  paint('wheat_2', wheat(12, [150, 170, 60], false));
  paint('wheat_3', wheat(15, [196, 170, 70], true));
  paint('bookshelf', (x, y) => {
    if (y < 2 || y > 13 || (y > 6 && y < 9)) return planksFn(x, y);
    const cols: C[] = [[150, 50, 50], [50, 90, 150], [60, 130, 70], [190, 150, 60], [110, 60, 140]];
    const k = cols[Math.floor(hash3(x >> 1, y >> 3, 3, 7) * 5)];
    return mul(k, (x % 2 ? 0.8 : 1) * (0.9 + rn(x, y) * 0.2));
  });
  paint('tnt_top', (x, y) => (x > 6 && x < 9 && y > 6 && y < 9 ? [40, 40, 40] : mul([190, 40, 36], 0.9 + rn(x, y) * 0.2)));
  paint('tnt_bottom', (x, y) => mul([170, 36, 32], 0.9 + rn(x, y) * 0.2));
  paint('tnt_side', (x, y) => {
    if (y >= 6 && y <= 9) {
      const t = (y === 7 || y === 8) && ((x >= 3 && x <= 5) || (x >= 7 && x <= 8) || (x >= 10 && x <= 12));
      return t ? [30, 30, 30] : [230, 226, 214];
    }
    return mul([200, 44, 38], 0.9 + rn(x, y) * 0.2 + (x % 4 === 0 ? -0.08 : 0));
  });
  paint('lamp', (x, y) => {
    const e = x % 8 === 0 || y % 8 === 0;
    const v = 0.9 + rn(x, y) * 0.15;
    return e ? [190 * v, 140 * v, 70 * v] : [255 * v, 230 * v, 140 * v];
  });
  paint('iron_block', (x, y) => bevel(jit([218, 218, 220], 0.03, x, y), [245, 245, 247], [170, 170, 176], x, y));
  paint('gold_block', (x, y) => bevel(jit([248, 212, 66], 0.04, x, y), [255, 245, 150], [200, 150, 30], x, y));
  paint('diamond_block', (x, y) => bevel(jit([98, 232, 224], 0.05, x, y), [190, 255, 250], [50, 160, 160], x, y));
}

// ---------- item sprites from ASCII masks ----------
const PAL = (o: Record<string, C>) => o;
function sprite(name: string, rows: string[], pal: Record<string, C>) {
  const mask: (C | null)[] = new Array(256).fill(null);
  rows.forEach((r, y) => { for (let x = 0; x < 16; x++) { const ch = r[x]; if (ch && ch !== '.' && pal[ch]) mask[y * 16 + x] = pal[ch]; } });
  paint(name, (x, y) => {
    const c = mask[y * 16 + x];
    if (!c) return null;
    const open = (dx: number, dy: number) => { const nx = x + dx, ny = y + dy; return nx < 0 || ny < 0 || nx > 15 || ny > 15 || !mask[ny * 16 + nx]; };
    let f = 1;
    if (open(0, 1) || open(1, 0)) f = 0.72; else if (open(0, -1) || open(-1, 0)) f = 1.14;
    return mul(c, f);
  });
}
const INGOT = ['................', '................', '................', '................', '......bbbbbbbbb.', '.....bbbbbbbbbb.', '....bbbbbbbbbb..', '...bbbbbbbbbb...', '..bbbbbbbbbb....', '..bbbbbbbbb.....', '................', '................', '................', '................', '................', '................'];
const STEAK = ['................', '................', '................', '....bbbbbb......', '...bbcbbbbbb....', '..bbcbbbbbdbb...', '..bbbbbbbbbdb...', '..bbbbbbbbbbb...', '...bbbbbbbbb....', '....bbbbbb......', '................', '................', '................', '................', '................', '................'];
const DRUM = ['................', '............bbb.', '...........bbcbb', '..........bbbbbb', '.........bbbbbb.', '........bbbbbb..', '.......bbbbbb...', '......bbbbbb....', '.....ebbbb......', '....eeebb.......', '...eee.ee.......', '....ee..........', '................', '................', '................', '................'];
const HANDLE = (m: string[]) => m;
const TOOLM: Record<string, string[]> = {
  pickaxe: HANDLE(['................', '................', '....hhhhhh......', '..hhhhhhhhhh....', '.hhh.....hhhh...', 'hh.......shhh...', '.........sshh...', '........ss.hh...', '.......ss...h...', '......ss........', '.....ss.........', '....ss..........', '...ss...........', '..ss............', '.ss.............', '................']),
  axe: HANDLE(['................', '.........hh.....', '.......hhhhh....', '......hhhhhhh...', '......hhhhshh...', '.......hhss.h...', '........ss......', '.......ss.......', '......ss........', '.....ss.........', '....ss..........', '...ss...........', '..ss............', '.ss.............', '................', '................']),
  shovel: HANDLE(['................', '..............hh', '.............hhh', '............hhhh', '...........hhhh.', '..........shhh..', '.........ss.h...', '........ss......', '.......ss.......', '......ss........', '.....ss.........', '....ss..........', '...ss...........', '..ss............', '.ss.............', '................']),
  sword: HANDLE(['..............hh', '.............hhh', '............hhh.', '...........hhh..', '..........hhh...', '.........hhh....', '..s.....hhh.....', '...s...hhh......', '....s.hhh.......', '.....sshh.......', '.....sss........', '....ss.s........', '...ss...........', '..ss............', '................', '................']),
  hoe: HANDLE(['................', '......hhhhh.....', '.....hhhhhhh....', '....hhh...hh....', '...........h....', '.......ss..h....', '......ss........', '.....ss.........', '....ss..........', '...ss...........', '..ss............', '.ss.............', '................', '................', '................', '................']),
};

function buildItems() {
  const ing = (n: string, b: C, c: C, a: C) => sprite(n, INGOT, PAL({ b, c, a }));
  ing('iron_ingot', [214, 214, 218], [240, 240, 244], [150, 150, 156]);
  ing('gold_ingot', [246, 208, 62], [255, 238, 140], [190, 146, 30]);
  sprite('coal', ['................', '................', '.....bbbbb......', '...bbbbcbbbb....', '..bbcbbbbbbbb...', '..bbbbbbabbbb...', '..bbbbbbbbbbb...', '..bbabbbbbcbb...', '...bbbbbbbbb....', '.....bbbbbb.....', '................', '................', '................', '................', '................', '................'], PAL({ b: [40, 40, 44], c: [90, 90, 96], a: [20, 20, 22] }));
  sprite('diamond', ['................', '................', '................', '......cccc......', '.....cbbbbc.....', '....cbbbbbbc....', '...cbbbbbbbbc...', '....abbbbbba....', '.....abbbba.....', '......abba......', '.......aa.......', '................', '................', '................', '................', '................'], PAL({ b: [92, 232, 224], c: [200, 255, 252], a: [40, 150, 160] }));
  sprite('flint', ['................', '................', '......bb........', '.....bbbb.......', '....bbcbbb......', '...bbbbbbbb.....', '...bbbbbbbb.....', '....bbbbbb......', '.....bbbb.......', '................', '................', '................', '................', '................', '................', '................'], PAL({ b: [70, 70, 76], c: [130, 130, 138] }));
  sprite('feather', ['..............cc', '.............ccb', '............ccbb', '...........ccbb.', '..........ccbb..', '.........ccbb...', '........ccbb....', '.......ccbb.....', '......ccb.......', '.....cb.b.......', '....c...........', '...c............', '................', '................', '................', '................'], PAL({ b: [225, 225, 225], c: [255, 255, 255] }));
  sprite('leather', ['................', '................', '....bbbbbbbb....', '...bbbbbbbbbb...', '..bbbcbbbbbbbb..', '..bbbbbbbbbbbb..', '..bbbbbbdbbbbb..', '...bbbbbbbbbb...', '....bbbbbbbb....', '................', '................', '................', '................', '................', '................', '................'], PAL({ b: [158, 96, 52], c: [196, 130, 76], d: [110, 62, 30] }));
  const meat = (n: string, b: C, c: C, d: C) => sprite(n, STEAK, PAL({ b, c, d }));
  meat('raw_pork', [238, 150, 150], [255, 196, 196], [214, 110, 112]);
  meat('cooked_pork', [168, 100, 60], [204, 136, 84], [128, 72, 38]);
  meat('raw_beef', [190, 52, 52], [224, 96, 88], [148, 30, 32]);
  meat('cooked_beef', [122, 70, 40], [160, 100, 60], [88, 48, 26]);
  meat('raw_mutton', [214, 110, 112], [240, 160, 150], [180, 80, 84]);
  meat('cooked_mutton', [150, 90, 56], [186, 124, 82], [108, 60, 34]);
  meat('rotten_flesh', [130, 120, 60], [160, 150, 80], [90, 90, 40]);
  sprite('raw_chicken', DRUM, PAL({ b: [236, 202, 172], c: [255, 230, 205], e: [240, 235, 220] }));
  sprite('cooked_chicken', DRUM, PAL({ b: [190, 120, 60], c: [224, 156, 90], e: [240, 235, 220] }));
  sprite('apple', ['................', '.........d......', '........d.......', '....bbb.bbb.....', '...bbbbbbbbb....', '..bbbcbbbbbbb...', '..bbcbbbbbbbb...', '..bbbbbbbbbbb...', '..bbbbbbbbbbb...', '...bbbbbbbbb....', '....bbb.bbb.....', '................', '................', '................', '................', '................'], PAL({ b: [208, 36, 36], c: [250, 120, 110], d: [96, 66, 30] }));
  sprite('bread', ['................', '................', '................', '....bbbbbbbb....', '..bbbcccbbbbbb..', '.bbcbbbbbcbbbbb.', '.bbbbbbbbbbbbbb.', '.bbbbbbbbbbbbbb.', '..bbbbbbbbbbbb..', '....dddddddd....', '................', '................', '................', '................', '................', '................'], PAL({ b: [200, 146, 70], c: [232, 184, 104], d: [140, 92, 40] }));
  sprite('wheat', ['................', '..........b.....', '.........bcb....', '....b.....bb.b..', '...bcb..b..b.cb.', '...bbb.bcb..bb..', '....d..bbb..d...', '....d...d...d...', '....d...d...d...', '....d...d..d....', '.....d..d..d....', '.....d..d.d.....', '......d.dd......', '......dd........', '................', '................'], PAL({ b: [214, 180, 80], c: [240, 214, 120], d: [140, 130, 50] }));
  sprite('seeds', ['................', '................', '................', '....bb..........', '....bb....bb....', '..........bb....', '.....bb.........', '.....bb...bb....', '..........bb....', '..bb............', '..bb............', '................', '................', '................', '................', '................'], PAL({ b: [110, 150, 50] }));
  sprite('bone', ['............cc..', '...........cbbc.', '..........bbbc..', '.........bbb....', '........bbb.....', '.......bbb......', '......bbb.......', '.....bbb........', '..cc.bb.........', '.cbbc...........', '..cc............', '................', '................', '................', '................', '................'], PAL({ b: [232, 228, 214], c: [250, 248, 240] }));
  sprite('gunpowder', ['................', '................', '................', '......bb........', '.....bbbb.......', '....bbcbbb......', '...bbbbbbbb.....', '..bbbbbbbbbb....', '.bbbbabbbbbbb...', '.bbbbbbbbbbbb...', '................', '................', '................', '................', '................', '................'], PAL({ b: [110, 110, 114], c: [160, 160, 166], a: [70, 70, 74] }));
  sprite('stick', ['................', '..............bb', '.............bb.', '............bb..', '...........bb...', '..........bb....', '.........bb.....', '........bb......', '.......bb.......', '......bb........', '.....bb.........', '....bb..........', '...bb...........', '..bb............', '................', '................'], PAL({ b: [138, 100, 52] }));
  sprite('flint_steel', ['................', '..aaaaaaa.......', '.abbbbbbba......', '.abcbbbbba......', '.abbbbbbba..dd..', '..aaaaaaa..dee..', '.........dee....', '........dee.....', '.......dee......', '......dd........', '................', '................', '................', '................', '................', '................'], PAL({ a: [90, 90, 96], b: [180, 180, 186], c: [230, 230, 236], d: [60, 60, 66], e: [100, 100, 108] }));
  const mc: C[] = [[168, 126, 72], [136, 136, 138], [224, 224, 228], [96, 232, 224]];
  const hc: C[] = [[200, 160, 100], [166, 166, 168], [250, 250, 252], [180, 255, 250]];
  MATS.forEach((m, mi) => TOOLS.forEach((t) => sprite(`${m}_${t}`, TOOLM[t], PAL({ h: mc[mi], s: [120, 84, 44], c: hc[mi] }))));
}

// ---------- atlas lifecycle ----------
export function initAtlas() {
  if (atlasTex) return atlasTex;
  atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = atlasCanvas.height = 256;
  atlasCtx = atlasCanvas.getContext('2d', { willReadFrequently: true })!;
  atlasData = atlasCtx.createImageData(256, 256);
  buildTiles();
  buildItems();
  atlasCtx.putImageData(atlasData, 0, 0);
  atlasTex = new THREE.CanvasTexture(atlasCanvas);
  atlasTex.magFilter = THREE.NearestFilter;
  atlasTex.minFilter = THREE.NearestMipmapLinearFilter;
  atlasTex.generateMipmaps = true;
  atlasTex.anisotropy = 4;
  return atlasTex;
}
export const getAtlasData = () => atlasData;
export const getAtlasCanvas = () => atlasCanvas;
export function tileRect(tile: number) { return { u: (tile & 15) / 16, v: 1 - ((tile >> 4) + 1) / 16, s: 1 / 16 }; }

export function tileCanvas(tile: number, tint?: C): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = TS;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(TS, TS);
  const ox = (tile & 15) * TS, oy = (tile >> 4) * TS;
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const s = ((oy + y) * 256 + ox + x) * 4, d = (y * TS + x) * 4;
    for (let k = 0; k < 3; k++) img.data[d + k] = clampB(atlasData.data[s + k] * (tint ? tint[k] : 1));
    img.data[d + 3] = atlasData.data[s + 3];
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const avgCache = new Map<number, C>();
export function tileAverage(tile: number): C {
  let c = avgCache.get(tile);
  if (c) return c;
  let r = 0, g = 0, b = 0, n = 0;
  const ox = (tile & 15) * TS, oy = (tile >> 4) * TS;
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const i = ((oy + y) * 256 + ox + x) * 4;
    if (atlasData.data[i + 3] < 128) continue;
    r += atlasData.data[i]; g += atlasData.data[i + 1]; b += atlasData.data[i + 2]; n++;
  }
  c = n ? [r / n, g / n, b / n] : [0, 0, 0];
  avgCache.set(tile, c);
  return c;
}
export const TINT_GRASS: C = [0.45, 0.76, 0.27], TINT_FOLIAGE: C = [0.36, 0.66, 0.2];
export function blockColor(id: number): C {
  const b = BLOCKS[id];
  if (!b) return [0, 0, 0];
  const t = b.tiles[2];
  const a = tileAverage(t);
  const ti = TINT_TILE[t];
  return ti === 1 ? [a[0] * TINT_GRASS[0], a[1] * TINT_GRASS[1], a[2] * TINT_GRASS[2]] : ti === 2 ? [a[0] * TINT_FOLIAGE[0], a[1] * TINT_FOLIAGE[1], a[2] * TINT_FOLIAGE[2]] : a;
}

// ---------- icons ----------
const iconCache = new Map<number, string>();
export function getIcon(id: number): string {
  let url = iconCache.get(id);
  if (url) return url;
  const def = ITEMDEF[id];
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const bd = def && def.block ? BLOCKS[def.block] : null;
  if (def && bd && (bd.kind === K.CUBE || bd.kind === K.CACTUS)) {
    const face = (tile: number, m: number[], dark: number) => {
      const t = TINT_TILE[tile];
      const src = tileCanvas(tile, t === 1 ? TINT_GRASS : t === 2 ? TINT_FOLIAGE : undefined);
      ctx.save();
      ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      ctx.drawImage(src, 0, 0);
      if (dark > 0) { ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(0, 0, 16, 16); }
      ctx.restore();
    };
    const k = 26 / 16;
    face(bd.tiles[2], [k, -k / 2, k, k / 2, 6, 19.5], 0);
    face(bd.tiles[4], [k, k / 2, 0, k * 1.0, 6, 19.5], 0.22);
    face(bd.tiles[0], [k, -k / 2, 0, k * 1.0, 32, 32.5], 0.4);
  } else if (def) {
    ctx.drawImage(tileCanvas(def.tile), 0, 0, 64, 64);
  }
  url = c.toDataURL();
  iconCache.set(id, url);
  return url;
}

// ---------- misc textures ----------
export function makeCrackTexture() {
  const c = document.createElement('canvas');
  c.width = 160; c.height = 16;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(160, 16);
  for (let s = 0; s < 10; s++) {
    const count = 8 + s * 14;
    for (let i = 0; i < count; i++) {
      const cx = 8 + Math.sin(i * 12.9898 + 4.1) * 7, cy = 8 + Math.cos(i * 78.233 + 1.3) * 7;
      const prog = (i / count) * 0.5 + 0.5;
      const ang = (i * 2.399) % (Math.PI * 2);
      for (let k = 0; k < 4 + s; k++) {
        const x = Math.round(8 + (cx - 8) * prog * 0.5 + Math.cos(ang) * k * 0.9 * (1 + s * 0.1)), y = Math.round(8 + (cy - 8) * prog * 0.5 + Math.sin(ang) * k * 0.9 * (1 + s * 0.1));
        if (x < 0 || x > 15 || y < 0 || y > 15 || k > i % (3 + s) + 2 + s / 2) continue;
        const o = (y * 160 + s * 16 + x) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 10; img.data[o + 3] = 200;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.repeat.set(0.1, 1);
  return t;
}

export function makeCelestial(kind: 'sun' | 'moon') {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  if (kind === 'sun') {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const d = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5));
      if (d < 9) { const v = 1 - d / 28; ctx.fillStyle = `rgb(255,${230 + (v * 20) | 0},${150 + ((1 - d / 9) * 80) | 0})`; ctx.fillRect(x, y, 1, 1); }
      else if (d < 15) { ctx.fillStyle = `rgba(255,220,120,${0.22 * (1 - (d - 9) / 6)})`; ctx.fillRect(x, y, 1, 1); }
    }
  } else {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const d = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5));
      if (d < 8) {
        const crater = hash3(x >> 2, y >> 2, 3, 5) > 0.72;
        const v = crater ? 190 : 232;
        ctx.fillStyle = `rgb(${v},${v},${v + 12})`; ctx.fillRect(x, y, 1, 1);
      } else if (d < 13) { ctx.fillStyle = `rgba(200,210,255,${0.12 * (1 - (d - 8) / 5)})`; ctx.fillRect(x, y, 1, 1); }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}

export function makeCloudTexture() {
  const N = 128;
  const data = new Uint8Array(N * N);
  const g = (x: number, y: number, s: number) => hash3(((x % (N / s)) + N / s) % (N / s), ((y % (N / s)) + N / s) % (N / s), s, 31337);
  const sm = (x: number, y: number, s: number) => {
    const gx = x / s, gy = y / s, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (g(x0, y0, s) * (1 - sx) + g(x0 + 1, y0, s) * sx) * (1 - sy) + (g(x0, y0 + 1, s) * (1 - sx) + g(x0 + 1, y0 + 1, s) * sx) * sy;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) data[y * N + x] = Math.min(255, (sm(x, y, 32) * 0.55 + sm(x, y, 16) * 0.3 + sm(x, y, 8) * 0.15) * 255);
  const t = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
