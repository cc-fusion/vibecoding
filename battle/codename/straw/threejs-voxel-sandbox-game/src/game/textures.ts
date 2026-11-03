// Procedural pixel-art textures: painted on canvas, packed into a padded
// atlas (padding prevents mipmap bleeding). Also item icons + block iso icons.
import * as THREE from 'three';
import { mulberry32 } from './noise';
import { B, BLOCKS, blockDef } from './blocks';

type Ctx = CanvasRenderingContext2D;
type Rng = () => number;

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

export function canvasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- low-level pixel helpers (tile space is 16x16) ----------
function P(ctx: Ctx, x: number, y: number, c: string) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
function R(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function field(ctx: Ctx, rng: Rng, colors: string[]) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) P(ctx, x, y, colors[(rng() * colors.length) | 0]);
}
function speckle(ctx: Ctx, rng: Rng, c: string, n: number) {
  for (let i = 0; i < n; i++) P(ctx, (rng() * 16) | 0, (rng() * 16) | 0, c);
}
function blotch(ctx: Ctx, rng: Rng, colors: string[], n: number, sMin = 2, sMax = 4) {
  for (let i = 0; i < n; i++) {
    const w = sMin + ((rng() * (sMax - sMin + 1)) | 0), h = sMin + ((rng() * (sMax - sMin + 1)) | 0);
    R(ctx, (rng() * (16 - w)) | 0, (rng() * (16 - h)) | 0, w, h, colors[(rng() * colors.length) | 0]);
  }
}
function oreSpeckle(ctx: Ctx, rng: Rng, main: string, dark: string, light: string) {
  for (let i = 0; i < 5; i++) {
    const x = 1 + ((rng() * 12) | 0), y = 1 + ((rng() * 12) | 0);
    R(ctx, x, y, 2, 2, main); P(ctx, x + 2, y, main); P(ctx, x, y + 2, main);
    P(ctx, x, y, light); P(ctx, x + 1, y + 1, dark);
  }
}
function drawStoneBase(ctx: Ctx, rng: Rng) {
  field(ctx, rng, ['#7a7a7a', '#828282', '#757575', '#7f7f7f', '#787878']);
  blotch(ctx, rng, ['#6e6e6e', '#8a8a8a'], 4, 2, 3);
}
function drawDirtBase(ctx: Ctx, rng: Rng) {
  field(ctx, rng, ['#8a5f3c', '#7d5535', '#96693f', '#865c39', '#79522f']);
  speckle(ctx, rng, '#a57c50', 8); speckle(ctx, rng, '#6b4726', 8); speckle(ctx, rng, '#9c8a7a', 3);
}
function drawPlanksBase(ctx: Ctx, rng: Rng, tint = ['#a8834f', '#b08c54', '#9c7a47']) {
  field(ctx, rng, tint);
  for (let b = 0; b < 4; b++) {
    const y = b * 4;
    R(ctx, 0, y + 3, 16, 1, '#6f5630');
    R(ctx, (b % 2) * 8 + 3, y, 1, 3, '#7a6040');
    speckle(ctx, rng, '#8a6a42', 3);
  }
}
function drawLogRings(ctx: Ctx, rng: Rng, light: string, dark: string, bark: string) {
  R(ctx, 0, 0, 16, 16, bark);
  R(ctx, 1, 1, 14, 14, light);
  R(ctx, 3, 3, 10, 10, dark); R(ctx, 4, 4, 8, 8, light);
  R(ctx, 6, 6, 4, 4, dark); R(ctx, 7, 7, 2, 2, light);
  speckle(ctx, rng, dark, 6);
}

// ---------- tile painters ----------
const PAINTERS: Record<string, (ctx: Ctx, rng: Rng) => void> = {
  grass_top(ctx, rng) { field(ctx, rng, ['#6abe30', '#62b32f', '#71c93b', '#5da832', '#67b835']); speckle(ctx, rng, '#4f9427', 10); speckle(ctx, rng, '#84d94e', 6); },
  dirt(ctx, rng) { drawDirtBase(ctx, rng); },
  grass_side(ctx, rng) {
    drawDirtBase(ctx, rng);
    for (let x = 0; x < 16; x++) {
      const d = 3 + ((rng() * 3) | 0);
      for (let y = 0; y < d; y++) P(ctx, x, y, ['#6abe30', '#5da832', '#71c93b'][(rng() * 3) | 0]);
      if (rng() < 0.3) P(ctx, x, d, '#57a02c');
    }
  },
  snow_side(ctx, rng) {
    drawDirtBase(ctx, rng);
    for (let x = 0; x < 16; x++) {
      const d = 3 + ((rng() * 2) | 0);
      for (let y = 0; y < d; y++) P(ctx, x, y, ['#f2fbfb', '#e6f4f4', '#ffffff'][(rng() * 3) | 0]);
    }
  },
  stone(ctx, rng) { drawStoneBase(ctx, rng); speckle(ctx, rng, '#666', 6); },
  cobble(ctx, rng) {
    R(ctx, 0, 0, 16, 16, '#4f4f4f');
    const cells: [number, number, number, number][] = [[0, 0, 6, 5], [6, 0, 6, 4], [12, 0, 4, 6], [0, 5, 5, 5], [5, 4, 7, 6], [12, 6, 4, 4], [0, 10, 6, 6], [6, 10, 5, 6], [11, 10, 5, 6]];
    for (const [x, y, w, h] of cells) {
      const base = ['#8a8a8a', '#7f7f7f', '#949494', '#787878'][(rng() * 4) | 0];
      R(ctx, x + 1, y + 1, w - 1, h - 1, base);
      R(ctx, x + 1, y + 1, w - 2, 1, '#a8a8a8'); R(ctx, x + 1, y + 1, 1, h - 2, '#9c9c9c');
      R(ctx, x + 1, y + h - 1, w - 1, 1, '#5c5c5c');
    }
  },
  sand(ctx, rng) { field(ctx, rng, ['#e3d9a0', '#dbcf96', '#eae0aa', '#d8cb90']); speckle(ctx, rng, '#c9b978', 8); },
  sandstone_top(ctx, rng) { PAINTERS.sand(ctx, rng); R(ctx, 0, 0, 16, 1, '#c9bc83'); R(ctx, 0, 15, 16, 1, '#c9bc83'); R(ctx, 0, 0, 1, 16, '#c9bc83'); R(ctx, 15, 0, 1, 16, '#c9bc83'); },
  sandstone_side(ctx, rng) {
    PAINTERS.sand(ctx, rng);
    R(ctx, 0, 0, 16, 1, '#bfb181'); R(ctx, 0, 4, 16, 1, '#cfc08c'); R(ctx, 0, 12, 16, 1, '#cfc08c'); R(ctx, 0, 15, 16, 1, '#bfb181');
    R(ctx, 6, 7, 4, 3, '#c4b586'); P(ctx, 7, 8, '#a08d5f'); P(ctx, 8, 8, '#a08d5f');
  },
  log_side(ctx, rng) {
    field(ctx, rng, ['#6b4f2a', '#5f4525', '#75572f']);
    for (let x = 0; x < 16; x += 3) R(ctx, x, 0, 1, 16, '#4e3820');
    speckle(ctx, rng, '#84643c', 10); speckle(ctx, rng, '#3f2c18', 8);
  },
  log_top(ctx, rng) { drawLogRings(ctx, rng, '#b08c54', '#8a6a42', '#6b4f2a'); },
  birch_side(ctx, rng) {
    field(ctx, rng, ['#d8d3c3', '#cfc8b8', '#e0dbcb']);
    for (let i = 0; i < 7; i++) R(ctx, (rng() * 12) | 0, (rng() * 15) | 0, 2 + ((rng() * 3) | 0), 1, '#3a3a36');
  },
  birch_top(ctx, rng) { drawLogRings(ctx, rng, '#c9b98a', '#a8935f', '#d8d3c3'); },
  pine_side(ctx, rng) {
    field(ctx, rng, ['#4a3620', '#41301c', '#53401f']);
    for (let x = 0; x < 16; x += 3) R(ctx, x, 0, 1, 16, '#2f2113');
    speckle(ctx, rng, '#5f4830', 10);
  },
  pine_top(ctx, rng) { drawLogRings(ctx, rng, '#8a6a42', '#6b4f2a', '#4a3620'); },
  leaves(ctx, rng) {
    field(ctx, rng, ['#3f7d26', '#478a2b', '#387020', '#3c7824']);
    speckle(ctx, rng, '#1e4d14', 42); speckle(ctx, rng, '#57a639', 16); speckle(ctx, rng, '#2a5c1c', 28);
  },
  pine_leaves(ctx, rng) {
    field(ctx, rng, ['#2c5a34', '#26502e', '#33663c', '#2a5432']);
    speckle(ctx, rng, '#14301e', 40); speckle(ctx, rng, '#44804f', 12);
  },
  planks(ctx, rng) { drawPlanksBase(ctx, rng); },
  glass(ctx, rng) {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#eaf7f7';
    ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1); ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    P(ctx, 4, 10, '#ffffff'); P(ctx, 5, 9, '#ffffff'); P(ctx, 6, 8, '#ffffff'); P(ctx, 7, 7, '#ffffff');
    P(ctx, 9, 12, '#ffffff'); P(ctx, 10, 11, '#ffffff');
    void rng;
  },
  bedrock(ctx, rng) { field(ctx, rng, ['#3a3a3a', '#2e2e2e', '#454545']); blotch(ctx, rng, ['#1f1f1f', '#555'], 6, 3, 5); },
  water(ctx, rng) { field(ctx, rng, ['#3f76e4', '#3a6fd8', '#457fe8']); for (let i = 0; i < 5; i++) R(ctx, (rng() * 12) | 0, (rng() * 16) | 0, 3, 1, '#5a90ee'); speckle(ctx, rng, '#2f5fc4', 10); },
  lava(ctx, rng) { field(ctx, rng, ['#e25822', '#d94e1e', '#eb6328']); blotch(ctx, rng, ['#f58a3a', '#ffc93f'], 6, 2, 3); blotch(ctx, rng, ['#b03a14'], 4, 2, 3); },
  coal_ore(ctx, rng) { drawStoneBase(ctx, rng); oreSpeckle(ctx, rng, '#232323', '#101010', '#4a4a4a'); },
  iron_ore(ctx, rng) { drawStoneBase(ctx, rng); oreSpeckle(ctx, rng, '#d8a583', '#b07a56', '#ecc3a3'); },
  gold_ore(ctx, rng) { drawStoneBase(ctx, rng); oreSpeckle(ctx, rng, '#f7d154', '#c9a227', '#ffe98a'); },
  diamond_ore(ctx, rng) { drawStoneBase(ctx, rng); oreSpeckle(ctx, rng, '#6fe8dd', '#3fb8ac', '#b8fff6'); },
  snow(ctx, rng) { field(ctx, rng, ['#f2fbfb', '#edf7f7', '#ffffff', '#e8f2f4']); speckle(ctx, rng, '#d8ecec', 6); },
  ice(ctx, rng) {
    field(ctx, rng, ['#a8d8f0', '#9fd0ee', '#b2e0f4']);
    ctx.fillStyle = '#e8f8ff';
    for (let i = 0; i < 4; i++) { let x = (rng() * 12) | 0, y = (rng() * 12) | 0; for (let j = 0; j < 5; j++) { P(ctx, x, y, '#e8f8ff'); x += rng() < 0.6 ? 1 : 0; y += rng() < 0.5 ? 1 : 0; if (x > 15 || y > 15) break; } }
  },
  cactus_side(ctx, rng) {
    field(ctx, rng, ['#2e7d32', '#2a7530', '#35853a']);
    for (let x = 1; x < 16; x += 4) R(ctx, x, 0, 1, 16, '#1f5c24');
    speckle(ctx, rng, '#cfe8b8', 14);
  },
  cactus_top(ctx, rng) {
    field(ctx, rng, ['#2e7d32', '#35853a']);
    R(ctx, 7, 2, 2, 12, '#43a047'); R(ctx, 2, 7, 12, 2, '#43a047'); speckle(ctx, rng, '#cfe8b8', 8);
  },
  torch(ctx, rng) {
    ctx.clearRect(0, 0, 16, 16);
    R(ctx, 7, 8, 2, 8, '#8a6a42'); P(ctx, 7, 9, '#6f5630'); P(ctx, 8, 12, '#6f5630');
    R(ctx, 6, 5, 4, 3, '#4a4a4a');
    R(ctx, 7, 2, 2, 3, '#ffc93f'); P(ctx, 6, 3, '#ff9d2e'); P(ctx, 9, 4, '#ff9d2e'); P(ctx, 7, 1, '#ffe98a'); P(ctx, 8, 3, '#fff3b0');
    void rng;
  },
  crafting_top(ctx, rng) {
    drawPlanksBase(ctx, rng);
    R(ctx, 0, 0, 16, 16, 'rgba(0,0,0,0)');
    ctx.fillStyle = '#5f4830';
    ctx.fillRect(5, 0, 1, 16); ctx.fillRect(10, 0, 1, 16); ctx.fillRect(0, 5, 16, 1); ctx.fillRect(0, 10, 16, 1);
    ctx.fillStyle = '#3f2c18'; ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1); ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
  },
  crafting_side(ctx, rng) {
    drawPlanksBase(ctx, rng);
    R(ctx, 0, 0, 16, 3, '#8a6a42'); R(ctx, 0, 3, 16, 1, '#5f4830');
    R(ctx, 2, 6, 5, 6, '#7a6040'); R(ctx, 3, 7, 3, 1, '#4a4a4a'); R(ctx, 4, 8, 1, 3, '#4a4a4a');
    R(ctx, 10, 6, 4, 4, '#6f5630'); P(ctx, 11, 7, '#c9c9c9'); P(ctx, 12, 8, '#c9c9c9');
  },
  crafting_side2(ctx, rng) {
    drawPlanksBase(ctx, rng);
    R(ctx, 0, 0, 16, 3, '#8a6a42'); R(ctx, 0, 3, 16, 1, '#5f4830');
    R(ctx, 5, 6, 6, 6, '#7a6040'); R(ctx, 7, 7, 1, 4, '#3f2c18'); R(ctx, 6, 8, 3, 1, '#3f2c18');
  },
  furnace_front(ctx, rng) {
    field(ctx, rng, ['#6e6e6e', '#757575', '#666']);
    R(ctx, 0, 0, 16, 2, '#828282'); R(ctx, 0, 14, 16, 2, '#555');
    R(ctx, 4, 5, 8, 7, '#2a2a2a'); R(ctx, 5, 4, 6, 1, '#2a2a2a');
    R(ctx, 4, 5, 8, 1, '#4a4a4a');
    R(ctx, 5, 10, 6, 1, '#e25822'); P(ctx, 6, 9, '#f58a3a'); P(ctx, 9, 9, '#ffc93f');
  },
  furnace_side(ctx, rng) {
    field(ctx, rng, ['#6e6e6e', '#757575', '#666']);
    R(ctx, 0, 0, 16, 2, '#828282'); R(ctx, 0, 14, 16, 2, '#555'); R(ctx, 0, 0, 2, 16, '#5c5c5c'); R(ctx, 14, 0, 2, 16, '#5c5c5c');
    R(ctx, 4, 6, 8, 4, '#5c5c5c');
  },
  furnace_top(ctx, rng) {
    field(ctx, rng, ['#757575', '#6e6e6e', '#7d7d7d']);
    R(ctx, 3, 3, 10, 10, '#666'); R(ctx, 5, 5, 6, 6, '#757575');
  },
  gravel(ctx, rng) { field(ctx, rng, ['#8a837e', '#7a726c', '#9a928a', '#6e655e', '#a39a90']); blotch(ctx, rng, ['#5f574f', '#b5aca2', '#8a6a52'], 6, 2, 3); },
  tallgrass(ctx, rng) {
    ctx.clearRect(0, 0, 16, 16);
    for (let i = 0; i < 9; i++) {
      const x = 1 + ((rng() * 14) | 0), h = 5 + ((rng() * 8) | 0);
      const c = ['#4f9427', '#5da832', '#478a2b'][(rng() * 3) | 0];
      for (let y = 0; y < h; y++) P(ctx, x + (y > h - 3 ? (rng() < 0.5 ? 1 : 0) : 0), 15 - y, c);
    }
  },
  flower_red(ctx, rng) {
    ctx.clearRect(0, 0, 16, 16);
    R(ctx, 7, 8, 1, 8, '#3c7824'); P(ctx, 6, 11, '#478a2b'); P(ctx, 5, 11, '#478a2b'); P(ctx, 8, 13, '#478a2b');
    R(ctx, 5, 3, 6, 4, '#d23c2a'); P(ctx, 5, 3, '#e85a44'); P(ctx, 10, 6, '#b02a1c'); P(ctx, 7, 4, '#3a2a1a'); P(ctx, 8, 5, '#3a2a1a'); P(ctx, 6, 5, '#ff7a5c');
    void rng;
  },
  flower_yellow(ctx, rng) {
    ctx.clearRect(0, 0, 16, 16);
    R(ctx, 7, 8, 1, 8, '#3c7824'); P(ctx, 8, 11, '#478a2b'); P(ctx, 9, 11, '#478a2b');
    R(ctx, 5, 3, 6, 4, '#f2d41e'); P(ctx, 7, 4, '#c9a227'); P(ctx, 5, 3, '#ffec6e'); P(ctx, 10, 6, '#d9b81c'); P(ctx, 8, 5, '#c9a227');
    void rng;
  },
  deadbush(ctx, rng) {
    ctx.clearRect(0, 0, 16, 16);
    const c = '#8a6a42', c2 = '#6f5630';
    R(ctx, 7, 9, 1, 7, c);
    for (let i = 0; i < 8; i++) { P(ctx, 6 - i > 0 ? 7 - ((i / 2) | 0) : 7, 12 - i, i % 2 ? c : c2); P(ctx, 7 + ((i / 2) | 0), 11 - i, i % 2 ? c2 : c); }
    void rng;
  },
  wool(ctx, rng) { field(ctx, rng, ['#e8e8e8', '#e2e2e2', '#ededed']); speckle(ctx, rng, '#cfcfcf', 30); speckle(ctx, rng, '#f7f7f7', 20); },
  stone_bricks(ctx, rng) {
    field(ctx, rng, ['#7a7a7a', '#828282', '#757575']);
    R(ctx, 0, 3, 16, 1, '#555'); R(ctx, 0, 7, 16, 1, '#555'); R(ctx, 0, 11, 16, 1, '#555'); R(ctx, 0, 15, 16, 1, '#555');
    R(ctx, 7, 0, 1, 3, '#555'); R(ctx, 3, 4, 1, 3, '#555'); R(ctx, 11, 4, 1, 3, '#555'); R(ctx, 7, 8, 1, 3, '#555'); R(ctx, 3, 12, 1, 3, '#555'); R(ctx, 11, 12, 1, 3, '#555');
    speckle(ctx, rng, '#666', 8);
  },
  sapling(ctx, rng) {
    ctx.clearRect(0, 0, 16, 16);
    R(ctx, 7, 10, 1, 6, '#6b4f2a');
    R(ctx, 4, 4, 4, 4, '#478a2b'); R(ctx, 8, 6, 4, 3, '#3f7d26'); R(ctx, 6, 2, 3, 3, '#57a639');
    speckle(ctx, rng, '#2a5c1c', 4);
  },
  chest_side(ctx, rng) {
    drawPlanksBase(ctx, rng, ['#9c7a3f', '#a88347', '#94713a']);
    ctx.fillStyle = '#5f4830';
    ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1); ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16); ctx.fillRect(0, 5, 16, 1);
    R(ctx, 7, 5, 2, 3, '#c9c9c9'); P(ctx, 7, 6, '#555');
  },
  chest_top(ctx, rng) {
    drawPlanksBase(ctx, rng, ['#9c7a3f', '#a88347', '#94713a']);
    ctx.fillStyle = '#5f4830';
    ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1); ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
  },
  pumpkin_side(ctx, rng) {
    field(ctx, rng, ['#d98324', '#cf7a1f', '#e08c2c']);
    for (let x = 2; x < 16; x += 4) R(ctx, x, 0, 1, 16, '#b86614');
    speckle(ctx, rng, '#c46c18', 10);
  },
  pumpkin_top(ctx, rng) { PAINTERS.pumpkin_side(ctx, rng); R(ctx, 7, 6, 2, 3, '#5da832'); },
  pumpkin_face(ctx, rng) {
    PAINTERS.pumpkin_side(ctx, rng);
    R(ctx, 3, 5, 3, 2, '#3a2008'); R(ctx, 10, 5, 3, 2, '#3a2008');
    R(ctx, 4, 10, 8, 1, '#3a2008'); R(ctx, 5, 11, 6, 1, '#3a2008'); P(ctx, 6, 10, '#d98324'); P(ctx, 9, 10, '#d98324'); P(ctx, 7, 8, '#3a2008');
  },
};

// ---------- atlas ----------
const ATLAS_COLS = 16, CELL = 32, TILE = 16, PAD = 8;
let atlasTex: THREE.Texture | null = null;
const tileCanvases = new Map<string, HTMLCanvasElement>();
const tileUVs = new Map<string, [number, number, number, number]>();
export const ATLAS_W = ATLAS_COLS * CELL;
export const ATLAS_H = 256;

export function initTextures(): THREE.Texture {
  if (atlasTex) return atlasTex;
  const names = Object.keys(PAINTERS);
  const [ac, actx] = makeCanvas(ATLAS_W, ATLAS_H);
  names.forEach((name, i) => {
    const [tc, tctx] = makeCanvas(TILE, TILE);
    PAINTERS[name](tctx, mulberry32(1337 + i * 7919));
    tileCanvases.set(name, tc);
    const col = i % ATLAS_COLS, row = (i / ATLAS_COLS) | 0;
    const cx = col * CELL, cy = row * CELL;
    // center
    actx.drawImage(tc, cx + PAD, cy + PAD);
    // edge padding (stretch border pixels outward)
    actx.drawImage(tc, 0, 0, TILE, 1, cx + PAD, cy, TILE, PAD);           // top
    actx.drawImage(tc, 0, TILE - 1, TILE, 1, cx + PAD, cy + PAD + TILE, TILE, PAD); // bottom
    actx.drawImage(tc, 0, 0, 1, TILE, cx, cy + PAD, PAD, TILE);           // left
    actx.drawImage(tc, TILE - 1, 0, 1, TILE, cx + PAD + TILE, cy + PAD, PAD, TILE); // right
    actx.drawImage(tc, 0, 0, 1, 1, cx, cy, PAD, PAD);
    actx.drawImage(tc, TILE - 1, 0, 1, 1, cx + PAD + TILE, cy, PAD, PAD);
    actx.drawImage(tc, 0, TILE - 1, 1, 1, cx, cy + PAD + TILE, PAD, PAD);
    actx.drawImage(tc, TILE - 1, TILE - 1, 1, 1, cx + PAD + TILE, cy + PAD + TILE, PAD, PAD);
    const u0 = (cx + PAD) / ATLAS_W, u1 = (cx + PAD + TILE) / ATLAS_W;
    const v1 = 1 - (cy + PAD) / ATLAS_H, v0 = 1 - (cy + PAD + TILE) / ATLAS_H;
    tileUVs.set(name, [u0, v0, u1, v1]);
  });
  atlasTex = canvasTexture(ac);
  atlasTex.generateMipmaps = true;
  atlasTex.minFilter = THREE.LinearMipmapLinearFilter;
  return atlasTex;
}

export function getTileUV(name: string): [number, number, number, number] {
  return tileUVs.get(name) ?? [0, 0, 0.01, 0.01];
}
export function getTileCanvas(name: string): HTMLCanvasElement | undefined { return tileCanvases.get(name); }

// Liquid textures scroll independently -> own small textures.
let waterTex: THREE.Texture | null = null, lavaTex: THREE.Texture | null = null;
export function getWaterTexture(): THREE.Texture {
  if (waterTex) return waterTex;
  const [c, ctx] = makeCanvas(16, 16); PAINTERS.water(ctx, mulberry32(42));
  waterTex = canvasTexture(c); waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  return waterTex;
}
export function getLavaTexture(): THREE.Texture {
  if (lavaTex) return lavaTex;
  const [c, ctx] = makeCanvas(16, 16); PAINTERS.lava(ctx, mulberry32(43));
  lavaTex = canvasTexture(c); lavaTex.wrapS = lavaTex.wrapT = THREE.RepeatWrapping;
  return lavaTex;
}

// Materials for mini block meshes (held item, drops): atlas sub-rect clones.
const faceMatCache = new Map<string, THREE.Material>();
export function getTileMaterial(tile: string, lit = true): THREE.Material {
  const key = tile + (lit ? '' : 'u');
  let m = faceMatCache.get(key);
  if (m) return m;
  initTextures();
  const [u0, v0, u1, v1] = getTileUV(tile);
  const tex = atlasTex!.clone();
  tex.repeat.set(u1 - u0, v1 - v0); tex.offset.set(u0, v0);
  tex.needsUpdate = true;
  m = lit
    ? new THREE.MeshLambertMaterial({ map: tex, alphaTest: tile === 'glass' ? 0.5 : 0 })
    : new THREE.MeshBasicMaterial({ map: tex });
  faceMatCache.set(key, m);
  return m;
}
const blockMatCache = new Map<number, THREE.Material[]>();
export function getBlockMaterials(id: number): THREE.Material[] {
  let m = blockMatCache.get(id);
  if (m) return m;
  m = blockDef(id).tiles.map(t => getTileMaterial(t));
  blockMatCache.set(id, m);
  return m;
}

// ---------- crack overlays ----------
let crackTexes: THREE.Texture[] | null = null;
export function getCrackTextures(): THREE.Texture[] {
  if (crackTexes) return crackTexes;
  crackTexes = [];
  for (let s = 0; s < 5; s++) {
    const [c, ctx] = makeCanvas(16, 16);
    const rng = mulberry32(555 + s);
    ctx.strokeStyle = 'rgba(10,10,10,0.85)'; ctx.lineWidth = 1;
    const lines = 2 + s * 2;
    for (let i = 0; i < lines; i++) {
      let x = 8 + (rng() * 4 - 2), y = 8 + (rng() * 4 - 2);
      ctx.beginPath(); ctx.moveTo(x, y);
      const ang = rng() * Math.PI * 2;
      for (let j = 0; j < 4 + s; j++) { x += Math.cos(ang + (rng() - 0.5)) * 2.2; y += Math.sin(ang + (rng() - 0.5)) * 2.2; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    crackTexes.push(canvasTexture(c));
  }
  return crackTexes;
}

// ---------- clouds ----------
let cloudTex: THREE.Texture | null = null;
export function getCloudTexture(): THREE.Texture {
  if (cloudTex) return cloudTex;
  const S = 128;
  const [c, ctx] = makeCanvas(S, S);
  const rng = mulberry32(999);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (let i = 0; i < 26; i++) {
    const x = (rng() * S) | 0, y = (rng() * S) | 0, w = 12 + ((rng() * 30) | 0), h = 6 + ((rng() * 12) | 0);
    for (const [ox, oy] of [[0, 0], [-S, 0], [S, 0], [0, -S], [0, S], [-S, -S], [S, S], [-S, S], [S, -S]] as const) {
      ctx.fillRect(x + ox, y + oy, w, h);
      ctx.fillRect(x + ox + 2, y + oy - 2, w - 6, 2);
    }
  }
  cloudTex = canvasTexture(c);
  cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping;
  return cloudTex;
}

// ---------- item icons ----------
function art(ctx: Ctx, rows: string[], pal: Record<string, string>) {
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = pal[row[x]]; if (c) P(ctx, x, y, c); } });
}

const TIER_COLORS: Record<string, { main: string; dark: string; light: string }> = {
  wood: { main: '#a8834f', dark: '#7a5c33', light: '#c9a05e' },
  stone: { main: '#8a8a8a', dark: '#5f5f5f', light: '#adadad' },
  iron: { main: '#d8d8d8', dark: '#9a9a9a', light: '#f4f4f4' },
  diamond: { main: '#5fe8dd', dark: '#2fb8ac', light: '#b8fff6' },
  gold: { main: '#f7d154', dark: '#c9a227', light: '#ffe98a' },
};

function drawTool(ctx: Ctx, kind: string, tier: string) {
  const T = TIER_COLORS[tier];
  const hd = '#8a6a42', hl = '#a8834f';
  // handle: diagonal from (3,12) up to (9,6)
  for (let i = 0; i < 7; i++) { P(ctx, 3 + i, 12 - i, hd); P(ctx, 4 + i, 12 - i, hl); }
  if (kind === 'pickaxe') {
    const pts: [number, number][] = [[2, 3], [3, 2], [4, 2], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 2], [11, 2], [12, 3], [13, 4], [3, 4], [4, 3], [10, 3], [11, 4], [6, 2], [7, 2], [8, 2], [9, 2]];
    for (const [x, y] of pts) P(ctx, x, y, T.main);
    P(ctx, 5, 1, T.light); P(ctx, 8, 1, T.light); P(ctx, 12, 3, T.dark); P(ctx, 2, 3, T.dark);
  } else if (kind === 'axe') {
    R(ctx, 8, 1, 4, 2, T.main); R(ctx, 9, 3, 4, 2, T.main); R(ctx, 10, 5, 3, 2, T.main);
    P(ctx, 12, 1, T.light); P(ctx, 13, 3, T.light); P(ctx, 12, 6, T.dark); R(ctx, 7, 3, 2, 2, T.dark);
  } else if (kind === 'shovel') {
    R(ctx, 9, 1, 4, 4, T.main); P(ctx, 9, 1, T.light); P(ctx, 12, 4, T.dark); R(ctx, 8, 4, 2, 2, T.dark);
  } else if (kind === 'sword') {
    for (let i = 0; i < 8; i++) { P(ctx, 6 + i, 9 - i, T.main); P(ctx, 7 + i, 9 - i, T.main); }
    P(ctx, 13, 1, T.light); P(ctx, 14, 1, T.main); P(ctx, 13, 2, T.main);
    P(ctx, 5, 8, '#c9a227'); P(ctx, 6, 9, '#c9a227'); P(ctx, 7, 10, '#c9a227'); P(ctx, 5, 10, '#c9a227'); P(ctx, 4, 9, '#c9a227');
  }
}

const ICON_PAINTERS: Record<string, (ctx: Ctx, rng: Rng) => void> = {
  stick(ctx) { for (let i = 0; i < 10; i++) { P(ctx, 3 + i, 12 - i, '#8a6a42'); P(ctx, 4 + i, 12 - i, '#6f5630'); } },
  coal(ctx, rng) { R(ctx, 3, 8, 5, 5, '#232323'); R(ctx, 8, 6, 5, 6, '#2e2e2e'); R(ctx, 5, 11, 6, 3, '#1a1a1a'); P(ctx, 4, 8, '#555'); P(ctx, 9, 7, '#666'); speckle(ctx, rng, '#444', 5); },
  charcoal(ctx, rng) { ICON_PAINTERS.coal(ctx, rng); speckle(ctx, rng, '#6b4f2a', 6); },
  flint(ctx) { R(ctx, 4, 6, 6, 6, '#3f3a36'); R(ctx, 8, 4, 4, 4, '#55504a'); P(ctx, 10, 4, '#8a837e'); P(ctx, 5, 7, '#6e655e'); },
  iron_ingot(ctx) { art(ctx, ['................', '................', '................', '....llllllll....', '...lmmmmmmmmd...', '..lmmmmmmmmmmd..', '..mmmmmmmmmmmd..', '..dddddddddddd..', '................'], { l: '#f4f4f4', m: '#d8d8d8', d: '#9a9a9a' }); },
  gold_ingot(ctx) { art(ctx, ['................', '................', '................', '....llllllll....', '...lmmmmmmmmd...', '..lmmmmmmmmmmd..', '..mmmmmmmmmmmd..', '..dddddddddddd..', '................'], { l: '#fff3a0', m: '#f7d154', d: '#c9a227' }); },
  diamond(ctx) {
    art(ctx, ['................', '................', '...ddddddddd....', '..dllllllllld...', '..dlmmmmmmmld...', '...dmmmmmmmd....', '....dmmmmmd.....', '.....dmmmd......', '......dmd.......', '.......d........'], { d: '#2fb8ac', l: '#b8fff6', m: '#5fe8dd' });
  },
  apple(ctx) {
    art(ctx, ['................', '.......s........', '......sll.......', '.....s.lll......', '....rrrrrrr.....', '...rRrrrrrrr....', '..rRrrrrrrrr....', '..rrrrrrrrrr....', '..rrrrrrrrrr....', '...rrrrrrrrr....', '....rrrrrrr.....', '.....rr.rr......'], { s: '#6b4f2a', l: '#57a639', r: '#d92b20', R: '#ff8a7a' });
  },
  raw_pork(ctx) { meatIcon(ctx, '#e88a9a', '#d16a7e', '#f7c9d4'); },
  cooked_pork(ctx) { meatIcon(ctx, '#b85c2e', '#96431c', '#d98a4e'); },
  raw_beef(ctx) { meatIcon(ctx, '#c94f43', '#a83a30', '#e88a7a'); },
  steak(ctx) { meatIcon(ctx, '#9c5636', '#7c4024', '#c47a4e'); },
  raw_chicken(ctx) { drumstick(ctx, '#e8b8b0', '#d69a90'); },
  cooked_chicken(ctx) { drumstick(ctx, '#c98a4e', '#a86c34'); },
  rotten_flesh(ctx) { meatIcon(ctx, '#7a8a3a', '#5f6e2c', '#9aa85c'); },
  feather(ctx) {
    art(ctx, ['................', '.........ww.....', '........wwww....', '.......wwwwww...', '......wwwwww....', '.....wwwwww.....', '....wwwwww......', '....wwwww.......', '...wwww.........', '...www..........', '..ww............', '..q.............'], { w: '#f0f0f0', q: '#c9b98a' });
  },
  egg(ctx) { art(ctx, ['................', '......wwww......', '.....wwwwww.....', '....wwwwwwww....', '....wwwwwwww....', '...wwwwwwwwww...', '...wwwwwwwwww...', '...wwwwwwwwww...', '....wwwwwwww....', '.....wwwwww.....'], { w: '#f2e8d8' }); },
  bread(ctx) { art(ctx, ['................', '....bbbbbbbb....', '..bbbbbbbbbbbb..', '..bbbbbbbbbbbb..', '..bbbbbbbbbbbb..', '...bbbbbbbbbb...', '....bbbbbbbb....'], { b: '#d9a44e' }); },
};

function meatIcon(ctx: Ctx, main: string, dark: string, fat: string) {
  R(ctx, 3, 5, 10, 6, main); R(ctx, 4, 4, 8, 1, main); R(ctx, 4, 11, 8, 1, dark);
  R(ctx, 3, 5, 10, 1, fat); P(ctx, 6, 7, fat); P(ctx, 9, 8, fat); P(ctx, 5, 9, fat); P(ctx, 11, 6, dark);
}
function drumstick(ctx: Ctx, main: string, dark: string) {
  R(ctx, 6, 2, 7, 6, main); R(ctx, 7, 8, 4, 2, main); P(ctx, 12, 7, dark); R(ctx, 6, 2, 7, 1, '#f7e0c8');
  R(ctx, 8, 10, 2, 3, '#f2ead8'); P(ctx, 7, 13, '#f2ead8'); P(ctx, 10, 13, '#f2ead8'); P(ctx, 8, 14, '#f2ead8');
}

for (const tier of ['wood', 'stone', 'iron', 'diamond']) {
  for (const kind of ['pickaxe', 'axe', 'shovel', 'sword']) {
    ICON_PAINTERS[`${kind}_${tier}`] = (ctx) => drawTool(ctx, kind, tier);
  }
}

// Icons resolved through item defs (injected to avoid circular import at module init)
let iconResolver: ((id: number) => { icon: string; isBlock: boolean }) | null = null;
export function setIconResolver(fn: (id: number) => { icon: string; isBlock: boolean }) { iconResolver = fn; }

const iconCache = new Map<number, string>();
export function getItemIcon(id: number): string {
  const hit = iconCache.get(id);
  if (hit) return hit;
  initTextures();
  const info = iconResolver ? iconResolver(id) : { icon: '', isBlock: id < 256 };
  let url: string;
  if (info.isBlock) url = drawBlockIcon(id);
  else {
    const [c, ctx] = makeCanvas(16, 16);
    (ICON_PAINTERS[info.icon] ?? ICON_PAINTERS.stick)(ctx, mulberry32(id * 31));
    // scale up
    const [c2, x2] = makeCanvas(48, 48); x2.drawImage(c, 0, 0, 48, 48);
    url = c2.toDataURL();
  }
  iconCache.set(id, url);
  return url;
}

function drawBlockIcon(id: number): string {
  const d = BLOCKS[id];
  const S = 48;
  const [c, ctx] = makeCanvas(S, S);
  if (!d || d.shape === 'cross' || id === B.Glass || d.shape === 'liquid') {
    const tc = getTileCanvas(d?.tiles[0] ?? 'stone');
    if (tc) ctx.drawImage(tc, 4, 4, 40, 40);
    return c.toDataURL();
  }
  const top = getTileCanvas(d.tiles[2])!, sideL = getTileCanvas(d.tiles[4])!, sideR = getTileCanvas(d.tiles[0])!;
  const a = (S / 2 - 2) / 16; // x scale per tile px
  // top face
  ctx.setTransform(a, a / 2, -a, a / 2, S / 2, 2);
  ctx.drawImage(top, 0, 0);
  // left face
  ctx.setTransform(a, a / 2, 0, a * 0.95, 2, 2 + 8 * a);
  ctx.drawImage(sideL, 0, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(0, 0, 16, 16);
  // right face
  ctx.setTransform(a, -a / 2, 0, a * 0.95, S / 2, 2 + 16 * a);
  ctx.drawImage(sideR, 0, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, 0, 16, 16);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return c.toDataURL();
}
