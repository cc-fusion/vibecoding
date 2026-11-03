// ───────────────────────────────────────────────────────────────────────────
//  Procedural pixel-art texture generation.
//  Produces a DataArrayTexture for the voxel shader + canvas icons for the UI.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { makeRng, hash2 } from "./noise";

export const TILE = 16;

type Buf = Uint8ClampedArray;

function mk(): Buf {
  return new Uint8ClampedArray(TILE * TILE * 4);
}
function setPx(b: Buf, x: number, y: number, r: number, g: number, bl: number, a = 255) {
  const i = (y * TILE + x) * 4;
  b[i] = r;
  b[i + 1] = g;
  b[i + 2] = bl;
  b[i + 3] = a;
}
function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}


/** fill with base colour + per-pixel grain */
function grain(b: Buf, base: string, amount: number, seed: number, scale = 1) {
  const c = hex(base);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n =
        (hash2(Math.floor(x / scale), Math.floor(y / scale), seed) - 0.5) * 2 * amount;
      setPx(b, x, y, c[0] * (1 + n), c[1] * (1 + n), c[2] * (1 + n));
    }
  }
}

/** sprinkle random blobs of a secondary colour */
function speckle(b: Buf, color: string, seed: number, density: number, amount = 0.2) {
  const c = hex(color);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const h = hash2(x, y, seed);
      if (h < density) {
        const v = 1 + (hash2(x, y, seed + 31) - 0.5) * 2 * amount;
        setPx(b, x, y, c[0] * v, c[1] * v, c[2] * v);
      }
    }
  }
}

function clear(b: Buf) {
  b.fill(0);
}

// ── generators ─────────────────────────────────────────────────────────────
type Gen = (b: Buf) => void;

const gens: Record<string, Gen> = {
  stone: (b) => {
    grain(b, "#7e7e7e", 0.11, 11);
    speckle(b, "#6e6e6e", 12, 0.22, 0.12);
    speckle(b, "#8e8e8e", 13, 0.12, 0.1);
  },
  cobblestone: (b) => {
    grain(b, "#6f6f6f", 0.08, 21);
    // chunky stones with dark mortar
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const cx = Math.floor(x / 4) * 4 + 2;
        const cy = Math.floor(y / 4) * 4 + 2;
        const jitter = hash2(cx, cy, 7) * 1.2;
        const d = Math.max(Math.abs(x - cx), Math.abs(y - cy)) + jitter * 0.6;
        const tone = d > 2.1 ? 0.52 : 0.78 + hash2(x, y, 9) * 0.45;
        setPx(b, x, y, 118 * tone, 118 * tone, 120 * tone);
      }
  },
  mossy_cobblestone: (b) => {
    gens.cobblestone(b);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        if (hash2(x, y, 55) < 0.4) {
          const i = (y * TILE + x) * 4;
          b[i] = b[i] * 0.45 + 40;
          b[i + 1] = b[i + 1] * 0.5 + 72;
          b[i + 2] = b[i + 2] * 0.4 + 32;
        }
      }
  },
  dirt: (b) => {
    grain(b, "#8a6240", 0.14, 31);
    speckle(b, "#6f4e32", 32, 0.3, 0.18);
    speckle(b, "#9c7049", 33, 0.14, 0.12);
  },
  grass_top: (b) => {
    grain(b, "#6aa84f", 0.13, 41);
    speckle(b, "#5c9644", 42, 0.3, 0.14);
    speckle(b, "#7cba5a", 43, 0.17, 0.12);
  },
  grass_side: (b) => {
    gens.dirt(b);
    const g = hex("#6aa84f");
    for (let x = 0; x < TILE; x++) {
      const h = 3 + Math.floor(hash2(x, 0, 44) * 3);
      for (let y = 0; y < h; y++) {
        const v = 0.85 + hash2(x, y, 45) * 0.35;
        setPx(b, x, y, g[0] * v, g[1] * v, g[2] * v);
      }
    }
  },
  grass_side_snow: (b) => {
    gens.dirt(b);
    for (let x = 0; x < TILE; x++) {
      const h = 3 + Math.floor(hash2(x, 0, 46) * 3);
      for (let y = 0; y < h; y++) {
        const v = 0.92 + hash2(x, y, 47) * 0.1;
        setPx(b, x, y, 240 * v, 247 * v, 255 * v);
      }
    }
  },
  snow: (b) => {
    grain(b, "#f2f7ff", 0.045, 51);
    speckle(b, "#ffffff", 52, 0.18, 0.02);
  },
  ice: (b) => {
    grain(b, "#9ec6f0", 0.08, 53);
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(hash2(i, 1, 54) * TILE);
      const y = Math.floor(hash2(i, 2, 54) * TILE);
      setPx(b, x, y, 220, 240, 255);
    }
  },
  sand: (b) => {
    grain(b, "#e2d3a2", 0.07, 61);
    speckle(b, "#d2c08c", 62, 0.22, 0.08);
  },
  sandstone_top: (b) => {
    grain(b, "#ded0a0", 0.06, 63);
    speckle(b, "#cbbb88", 64, 0.18, 0.07);
  },
  sandstone_side: (b) => {
    grain(b, "#ded0a0", 0.05, 65);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        if (y % 5 === 0) {
          const i = (y * TILE + x) * 4;
          b[i] *= 0.82;
          b[i + 1] *= 0.82;
          b[i + 2] *= 0.82;
        }
      }
  },
  gravel: (b) => {
    grain(b, "#8a8785", 0.1, 71);
    speckle(b, "#6b6866", 72, 0.3, 0.2);
    speckle(b, "#a5a2a0", 73, 0.2, 0.15);
  },
  clay: (b) => {
    grain(b, "#a4a8b4", 0.07, 74);
    speckle(b, "#949aa8", 75, 0.2, 0.08);
  },
  bedrock: (b) => {
    grain(b, "#3b3b3f", 0.3, 81);
    speckle(b, "#1b1b1e", 82, 0.3, 0.3);
    speckle(b, "#5a5a60", 83, 0.2, 0.3);
  },
  oak_log_side: (b) => {
    grain(b, "#8b6a3f", 0.07, 91);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const w = Math.sin(x * 1.5 + hash2(0, y, 92) * 2) * 0.1;
        const i = (y * TILE + x) * 4;
        const f = 1 + w - (x % 5 === 0 ? 0.18 : 0);
        b[i] *= f;
        b[i + 1] *= f;
        b[i + 2] *= f;
      }
  },
  oak_log_top: (b) => {
    const c = hex("#b58b53");
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5);
        const ring = Math.sin(d * 2.2) * 0.12;
        const f = (d > 7 ? 0.62 : 1) + ring;
        setPx(b, x, y, c[0] * f, c[1] * f, c[2] * f);
      }
  },
  birch_log_side: (b) => {
    grain(b, "#dcd8cf", 0.05, 93);
    for (let i = 0; i < 9; i++) {
      const y = Math.floor(hash2(i, 5, 94) * TILE);
      const x = Math.floor(hash2(i, 6, 94) * (TILE - 4));
      const w = 2 + Math.floor(hash2(i, 7, 94) * 3);
      for (let k = 0; k < w; k++) setPx(b, x + k, y, 60, 58, 54);
    }
  },
  birch_log_top: (b) => {
    const c = hex("#d4c9ab");
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5);
        const f = (d > 7 ? 0.8 : 1) + Math.sin(d * 2.4) * 0.09;
        setPx(b, x, y, c[0] * f, c[1] * f, c[2] * f);
      }
  },
  spruce_log_side: (b) => {
    grain(b, "#5a4027", 0.09, 95);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++)
        if (x % 4 === 1) {
          const i = (y * TILE + x) * 4;
          b[i] *= 0.75;
          b[i + 1] *= 0.75;
          b[i + 2] *= 0.75;
        }
  },
  oak_planks: (b) => {
    grain(b, "#b08a54", 0.06, 101);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const i = (y * TILE + x) * 4;
        if (y % 4 === 3) {
          b[i] *= 0.68;
          b[i + 1] *= 0.68;
          b[i + 2] *= 0.68;
        }
        const row = Math.floor(y / 4);
        if ((x + row * 5) % 8 === 0) {
          b[i] *= 0.8;
          b[i + 1] *= 0.8;
          b[i + 2] *= 0.8;
        }
      }
  },
  birch_planks: (b) => {
    grain(b, "#cdbc8a", 0.05, 102);
    for (let y = 0; y < TILE; y++)
      if (y % 4 === 3)
        for (let x = 0; x < TILE; x++) {
          const i = (y * TILE + x) * 4;
          b[i] *= 0.74;
          b[i + 1] *= 0.74;
          b[i + 2] *= 0.74;
        }
  },
  spruce_planks: (b) => {
    grain(b, "#7a5a36", 0.06, 103);
    for (let y = 0; y < TILE; y++)
      if (y % 4 === 3)
        for (let x = 0; x < TILE; x++) {
          const i = (y * TILE + x) * 4;
          b[i] *= 0.7;
          b[i + 1] *= 0.7;
          b[i + 2] *= 0.7;
        }
  },
  oak_leaves: (b) => leaves(b, "#3f7f31", 111),
  birch_leaves: (b) => leaves(b, "#6a9c47", 112),
  spruce_leaves: (b) => leaves(b, "#2d5c39", 113),
  jungle_leaves: (b) => leaves(b, "#2f8b2a", 114),
  coal_ore: (b) => ore(b, "#26262a", 121),
  iron_ore: (b) => ore(b, "#c6a07a", 122),
  gold_ore: (b) => ore(b, "#f6d445", 123),
  diamond_ore: (b) => ore(b, "#5decdd", 124),
  redstone_ore: (b) => ore(b, "#e0383a", 125),
  emerald_ore: (b) => ore(b, "#30d96a", 126),
  lapis_ore: (b) => ore(b, "#2f54c4", 127),
  water: (b) => {
    grain(b, "#2a5fc4", 0.07, 131);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const w = Math.sin((x + y * 0.6) * 0.8) * 0.08;
        const i = (y * TILE + x) * 4;
        b[i] *= 1 + w;
        b[i + 1] *= 1 + w;
        b[i + 2] *= 1 + w * 0.5;
        b[i + 3] = 200;
      }
  },
  lava: (b) => {
    grain(b, "#e2601a", 0.16, 132);
    speckle(b, "#ffd34d", 133, 0.16, 0.14);
    speckle(b, "#8c2a06", 134, 0.2, 0.2);
  },
  glass: (b) => {
    clear(b);
    for (let i = 0; i < TILE; i++) {
      setPx(b, i, 0, 215, 237, 247, 165);
      setPx(b, i, TILE - 1, 215, 237, 247, 165);
      setPx(b, 0, i, 215, 237, 247, 165);
      setPx(b, TILE - 1, i, 215, 237, 247, 165);
    }
    for (let i = 2; i < 8; i++) setPx(b, i, 10 - i, 255, 255, 255, 120);
    for (let i = 2; i < 5; i++) setPx(b, i + 6, 14 - i, 255, 255, 255, 90);
    for (let y = 1; y < TILE - 1; y++)
      for (let x = 1; x < TILE - 1; x++) {
        const i = (y * TILE + x) * 4;
        if (b[i + 3] === 0) {
          setPx(b, x, y, 190, 220, 236, 36);
        }
      }
  },
  bricks: (b) => {
    grain(b, "#9a4a38", 0.06, 141);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const row = Math.floor(y / 4);
        const off = (row % 2) * 4;
        if (y % 4 === 3 || (x + off) % 8 === 0) setPx(b, x, y, 196, 190, 184);
      }
  },
  stone_bricks: (b) => {
    grain(b, "#7d7d7d", 0.07, 142);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const row = Math.floor(y / 8);
        const off = (row % 2) * 4;
        if (y % 8 === 7 || (x + off) % 8 === 0) {
          const i = (y * TILE + x) * 4;
          b[i] *= 0.62;
          b[i + 1] *= 0.62;
          b[i + 2] *= 0.62;
        }
      }
  },
  crafting_table_top: (b) => {
    gens.oak_planks(b);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        if (x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1) continue;
        const gx = Math.floor((x - 1) / 4.66);
        const gy = Math.floor((y - 1) / 4.66);
        if ((gx + gy) % 2 === 0) {
          const i = (y * TILE + x) * 4;
          b[i] *= 0.74;
          b[i + 1] *= 0.72;
          b[i + 2] *= 0.68;
        }
      }
  },
  crafting_table_side: (b) => {
    gens.oak_planks(b);
    for (let y = 2; y < 12; y++)
      for (let x = 2; x < 14; x++) {
        if (y === 2 || y === 11 || x === 2 || x === 13 || x === 7 || y === 7)
          setPx(b, x, y, 96, 70, 40);
      }
  },
  furnace_side: (b) => {
    grain(b, "#6d6d6d", 0.08, 151);
    speckle(b, "#5e5e5e", 152, 0.2, 0.1);
  },
  furnace_top: (b) => {
    grain(b, "#777777", 0.07, 153);
    for (let x = 4; x < 12; x++) {
      setPx(b, x, 4, 60, 60, 60);
      setPx(b, x, 11, 60, 60, 60);
    }
    for (let y = 4; y < 12; y++) {
      setPx(b, 4, y, 60, 60, 60);
      setPx(b, 11, y, 60, 60, 60);
    }
  },
  furnace_front: (b) => {
    gens.furnace_side(b);
    for (let y = 5; y < 13; y++)
      for (let x = 3; x < 13; x++) {
        const edge = y === 5 || y === 12 || x === 3 || x === 12;
        setPx(b, x, y, edge ? 54 : 34, edge ? 54 : 34, edge ? 58 : 38);
      }
  },
  furnace_front_lit: (b) => {
    gens.furnace_side(b);
    for (let y = 5; y < 13; y++)
      for (let x = 3; x < 13; x++) {
        const edge = y === 5 || y === 12 || x === 3 || x === 12;
        if (edge) setPx(b, x, y, 54, 54, 58);
        else {
          const f = Math.max(0, 1 - (y - 7) / 6) * (0.6 + hash2(x, y, 155) * 0.6);
          setPx(b, x, y, 40 + 220 * f, 30 + 130 * f, 30 + 30 * f);
        }
      }
  },
  cactus_side: (b) => {
    grain(b, "#2f7d3c", 0.07, 161);
    for (let y = 0; y < TILE; y++) {
      setPx(b, 0, y, 24, 70, 30);
      setPx(b, 15, y, 24, 70, 30);
      if (y % 4 === 1) {
        setPx(b, 4, y, 220, 230, 210);
        setPx(b, 11, y, 220, 230, 210);
      }
    }
  },
  cactus_top: (b) => {
    grain(b, "#3f9a4a", 0.07, 162);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++)
        if (Math.hypot(x - 7.5, y - 7.5) > 6.6) setPx(b, x, y, 28, 78, 34);
  },
  tall_grass: (b) => {
    clear(b);
    for (let x = 1; x < 15; x++) {
      if (hash2(x, 1, 170) < 0.45) continue;
      const h = 4 + Math.floor(hash2(x, 3, 171) * 7);
      const bend = Math.floor(hash2(x, 4, 171) * 2);
      for (let y = 0; y < h; y++) {
        const yy = 15 - y;
        const xx = Math.min(15, x + (y > h - 3 ? bend : 0));
        const v = 0.66 + (y / h) * 0.6;
        setPx(b, xx, yy, 96 * v, 150 * v, 62 * v);
      }
    }
  },
  fern: (b) => {
    clear(b);
    for (let x = 2; x < 14; x++) {
      if (hash2(x, 8, 172) < 0.42) continue;
      const h = 3 + Math.floor(hash2(x, 9, 172) * 6);
      for (let y = 0; y < h; y++) {
        const v = 0.62 + (y / h) * 0.55;
        setPx(b, x, 15 - y, 70 * v, 125 * v, 70 * v);
      }
    }
  },
  flower_red: (b) => flower(b, "#d6302f", "#ffd94a"),
  flower_yellow: (b) => flower(b, "#f1d637", "#b57f16"),
  flower_blue: (b) => flower(b, "#6f8ef0", "#dfe7ff"),
  dead_bush: (b) => {
    clear(b);
    for (let x = 3; x < 13; x++) {
      const h = 3 + Math.floor(hash2(x, 2, 173) * 6);
      for (let y = 0; y < h; y++) setPx(b, x, 15 - y, 120, 92, 44);
    }
  },
  mushroom_red: (b) => {
    clear(b);
    for (let x = 6; x < 10; x++) for (let y = 9; y < 14; y++) setPx(b, x, y, 220, 212, 196);
    for (let x = 4; x < 12; x++)
      for (let y = 5; y < 10; y++) {
        if (Math.hypot(x - 7.5, y - 9.5) < 4.2) {
          const spot = hash2(x, y, 174) < 0.25;
          setPx(b, x, y, spot ? 240 : 196, spot ? 240 : 40, spot ? 240 : 40);
        }
      }
  },
  torch: (b) => {
    clear(b);
    for (let y = 6; y < 16; y++) for (let x = 7; x < 9; x++) setPx(b, x, y, 128, 94, 52);
    for (let y = 3; y < 7; y++)
      for (let x = 6; x < 10; x++) {
        const f = 1 - (y - 3) / 5;
        setPx(b, x, y, 255, 170 + 70 * f, 40 + 60 * f);
      }
    setPx(b, 7, 2, 255, 240, 170);
    setPx(b, 8, 2, 255, 240, 170);
  },
  ladder: (b) => {
    clear(b);
    for (let y = 0; y < TILE; y++) {
      for (let x = 2; x < 4; x++) setPx(b, x, y, 140, 104, 56);
      for (let x = 12; x < 14; x++) setPx(b, x, y, 140, 104, 56);
    }
    for (let y = 2; y < TILE; y += 5)
      for (let x = 3; x < 13; x++) {
        setPx(b, x, y, 164, 124, 68);
        setPx(b, x, y + 1, 128, 94, 50);
      }
  },
  glowstone: (b) => {
    grain(b, "#c8a040", 0.1, 181);
    speckle(b, "#ffe58a", 182, 0.3, 0.15);
    speckle(b, "#8d6c22", 183, 0.15, 0.2);
  },
  obsidian: (b) => {
    grain(b, "#17131f", 0.25, 184);
    speckle(b, "#3b2e5a", 185, 0.14, 0.3);
  },
  coal_block: (b) => {
    grain(b, "#18181c", 0.2, 191);
    speckle(b, "#30303a", 192, 0.2, 0.3);
  },
  iron_block: (b) => {
    grain(b, "#d6d6d6", 0.05, 193);
    speckle(b, "#bdbdbd", 194, 0.2, 0.06);
  },
  gold_block: (b) => {
    grain(b, "#f3cf3c", 0.06, 195);
    speckle(b, "#ddb423", 196, 0.2, 0.08);
  },
  diamond_block: (b) => {
    grain(b, "#5fe3d6", 0.07, 197);
    speckle(b, "#9bf5ec", 198, 0.2, 0.1);
  },
  wool_white: (b) => {
    grain(b, "#eceff2", 0.05, 201);
    speckle(b, "#dde1e6", 202, 0.3, 0.04);
  },
  wool_red: (b) => {
    grain(b, "#b03030", 0.07, 203);
    speckle(b, "#8f2626", 204, 0.3, 0.07);
  },
  wool_blue: (b) => {
    grain(b, "#3a52a8", 0.07, 205);
    speckle(b, "#2c3f86", 206, 0.3, 0.07);
  },
  wool_yellow: (b) => {
    grain(b, "#d8c030", 0.07, 207);
    speckle(b, "#b8a124", 208, 0.3, 0.07);
  },
  wool_black: (b) => {
    grain(b, "#242428", 0.1, 209);
    speckle(b, "#1a1a1d", 210, 0.3, 0.12);
  },
  pumpkin_side: (b) => {
    grain(b, "#d9821f", 0.06, 211);
    for (let x = 0; x < TILE; x += 4)
      for (let y = 0; y < TILE; y++) {
        const i = (y * TILE + x) * 4;
        b[i] *= 0.78;
        b[i + 1] *= 0.78;
        b[i + 2] *= 0.78;
      }
  },
  pumpkin_top: (b) => {
    grain(b, "#c4761c", 0.06, 212);
    for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) setPx(b, x, y, 96, 128, 48);
  },
  farmland: (b) => {
    grain(b, "#5e4228", 0.1, 213);
    for (let y = 0; y < TILE; y += 5)
      for (let x = 0; x < TILE; x++) {
        const i = (y * TILE + x) * 4;
        b[i] *= 0.7;
        b[i + 1] *= 0.7;
        b[i + 2] *= 0.7;
      }
  },
  wheat_crop: (b) => {
    clear(b);
    for (let x = 2; x < 15; x += 4)
      for (let y = 2; y < 16; y++) {
        const v = 0.7 + (y / 16) * 0.5;
        setPx(b, x, y, 196 * v, 178 * v, 72 * v);
        if (y < 7 && y % 2 === 0) setPx(b, x + 1, y, 220, 200, 90);
      }
  },
  snow_layer: (b) => {
    grain(b, "#f6fbff", 0.04, 214);
  },
  chest_top: (b) => {
    grain(b, "#9a6c33", 0.06, 220);
    for (let x = 0; x < TILE; x++) {
      setPx(b, x, 0, 86, 60, 28);
      setPx(b, x, 15, 86, 60, 28);
    }
    for (let y = 0; y < TILE; y++) {
      setPx(b, 0, y, 86, 60, 28);
      setPx(b, 15, y, 86, 60, 28);
    }
    for (let x = 6; x < 10; x++) for (let y = 0; y < TILE; y++) setPx(b, x, y, 118, 84, 40);
  },
  chest_side: (b) => {
    grain(b, "#8d6230", 0.06, 221);
    for (let x = 0; x < TILE; x++) {
      setPx(b, x, 4, 70, 48, 22);
      setPx(b, x, 5, 70, 48, 22);
      setPx(b, x, 0, 76, 52, 24);
      setPx(b, x, 15, 76, 52, 24);
    }
  },
  chest_front: (b) => {
    grain(b, "#8d6230", 0.06, 222);
    for (let x = 0; x < TILE; x++) {
      setPx(b, x, 4, 70, 48, 22);
      setPx(b, x, 5, 70, 48, 22);
      setPx(b, x, 0, 76, 52, 24);
      setPx(b, x, 15, 76, 52, 24);
    }
    for (let y = 4; y < 9; y++)
      for (let x = 7; x < 10; x++) setPx(b, x, y, 198, 180, 96);
    setPx(b, 8, 6, 60, 50, 24);
    setPx(b, 8, 7, 60, 50, 24);
  },
  sapling: (b) => {
    clear(b);
    for (let y = 8; y < 15; y++) setPx(b, 7, y, 92, 66, 38);
    const pts = [
      [7, 4], [6, 5], [8, 5], [5, 6], [7, 6], [9, 6], [4, 7], [6, 7], [8, 7], [10, 7],
      [5, 8], [7, 8], [9, 8], [6, 9], [8, 9], [7, 10],
    ];
    for (const [x, y] of pts) {
      const v = 0.78 + hash2(x, y, 215) * 0.45;
      setPx(b, x, y, 72 * v, 136 * v, 54 * v);
    }
  },
  sapling_spruce: (b) => {
    clear(b);
    for (let y = 9; y < 15; y++) setPx(b, 7, y, 76, 54, 30);
    for (let r = 0; r < 6; r++) {
      const w = r;
      for (let x = 7 - w; x <= 7 + w; x++) {
        const v = 0.7 + hash2(x, r, 216) * 0.4;
        setPx(b, x, 3 + r + Math.floor(r * 0.6), 44 * v, 100 * v, 58 * v);
      }
    }
  },
};

function leaves(b: Buf, base: string, seed: number) {
  const c = hex(base);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const h = hash2(x, y, seed);
      if (h < 0.1) {
        setPx(b, x, y, 0, 0, 0, 0);
        continue;
      }
      const v = 0.7 + h * 0.7;
      const dark = hash2(x, y, seed + 1) < 0.25 ? 0.72 : 1;
      setPx(b, x, y, c[0] * v * dark, c[1] * v * dark, c[2] * v * dark, 255);
    }
}

function ore(b: Buf, color: string, seed: number) {
  gens.stone(b);
  const c = hex(color);
  const spots: [number, number, number][] = [];
  const rng = makeRng(seed);
  for (let i = 0; i < 5; i++)
    spots.push([2 + rng() * 12, 2 + rng() * 12, 1.2 + rng() * 1.4]);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      for (const [sx, sy, r] of spots) {
        const d = Math.hypot(x - sx, y - sy);
        if (d < r) {
          const f = 0.72 + (1 - d / r) * 0.5;
          setPx(b, x, y, c[0] * f, c[1] * f, c[2] * f);
          break;
        }
      }
    }
}

function flower(b: Buf, petal: string, center: string) {
  clear(b);
  const p = hex(petal);
  const ce = hex(center);
  for (let y = 9; y < 16; y++) setPx(b, 7, y, 60, 118, 48);
  setPx(b, 6, 11, 70, 132, 52);
  setPx(b, 8, 13, 70, 132, 52);
  const pts = [
    [6, 5], [7, 4], [8, 5], [5, 6], [9, 6], [5, 7], [9, 7], [6, 8], [7, 9], [8, 8],
  ];
  for (const [x, y] of pts) setPx(b, x, y, p[0], p[1], p[2]);
  setPx(b, 7, 6, ce[0], ce[1], ce[2]);
  setPx(b, 7, 7, ce[0], ce[1], ce[2]);
  setPx(b, 8, 6, ce[0] * 0.85, ce[1] * 0.85, ce[2] * 0.85);
}

// ── build atlas ────────────────────────────────────────────────────────────
export const TEX_NAMES: string[] = Object.keys(gens);
const texIndexMap = new Map<string, number>();
TEX_NAMES.forEach((n, i) => texIndexMap.set(n, i));

export function texId(name: string): number {
  const i = texIndexMap.get(name);
  if (i === undefined) {
    console.warn("missing texture", name);
    return 0;
  }
  return i;
}

let cachedLayers: Buf[] | null = null;
export function buildLayers(): Buf[] {
  if (cachedLayers) return cachedLayers;
  cachedLayers = TEX_NAMES.map((n) => {
    const b = mk();
    b.fill(255);
    gens[n](b);
    return b;
  });
  return cachedLayers;
}

export function buildArrayTexture(): THREE.DataArrayTexture {
  const layers = buildLayers();
  const data = new Uint8Array(TILE * TILE * 4 * layers.length);
  layers.forEach((l, i) => data.set(l, i * TILE * TILE * 4));
  const tex = new THREE.DataArrayTexture(data, TILE, TILE, layers.length);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ── UI icons ───────────────────────────────────────────────────────────────
const ICON_SIZE = 48;

function layerToCanvas(layer: Buf): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = TILE;
  c.height = TILE;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(TILE, TILE);
  img.data.set(layer);
  ctx.putImageData(img, 0, 0);
  return c;
}

/** isometric cube icon from top/left/right texture layers */
export function cubeIcon(topName: string, sideName: string, side2Name?: string): string {
  const layers = buildLayers();
  const c = document.createElement("canvas");
  c.width = ICON_SIZE;
  c.height = ICON_SIZE;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const top = layerToCanvas(layers[texId(topName)]);
  const left = layerToCanvas(layers[texId(sideName)]);
  const right = layerToCanvas(layers[texId(side2Name ?? sideName)]);

  const S = ICON_SIZE;
  const cx = S / 2;
  const hw = S * 0.44;
  const hh = S * 0.24;
  const bodyH = S * 0.36;
  const topY = S * 0.1;

  function drawFace(
    img: HTMLCanvasElement,
    quad: [number, number][],
    brightness: number,
  ) {
    // rasterise texture across quad using per-scanline interpolation
    const tmp = document.createElement("canvas");
    tmp.width = S;
    tmp.height = S;
    const tctx = tmp.getContext("2d")!;
    tctx.imageSmoothingEnabled = false;
    tctx.save();
    tctx.beginPath();
    tctx.moveTo(quad[0][0], quad[0][1]);
    for (let i = 1; i < 4; i++) tctx.lineTo(quad[i][0], quad[i][1]);
    tctx.closePath();
    tctx.clip();
    // affine approximation: map texture square to parallelogram
    const [p0, p1, , p3] = quad;
    const m11 = (p1[0] - p0[0]) / TILE;
    const m12 = (p1[1] - p0[1]) / TILE;
    const m21 = (p3[0] - p0[0]) / TILE;
    const m22 = (p3[1] - p0[1]) / TILE;
    tctx.setTransform(m11, m12, m21, m22, p0[0], p0[1]);
    tctx.drawImage(img, 0, 0);
    tctx.restore();
    ctx.globalAlpha = 1;
    ctx.filter = `brightness(${brightness})`;
    ctx.drawImage(tmp, 0, 0);
    ctx.filter = "none";
  }

  drawFace(
    top,
    [
      [cx, topY],
      [cx + hw, topY + hh],
      [cx, topY + hh * 2],
      [cx - hw, topY + hh],
    ],
    1.0,
  );
  drawFace(
    left,
    [
      [cx - hw, topY + hh],
      [cx, topY + hh * 2],
      [cx, topY + hh * 2 + bodyH],
      [cx - hw, topY + hh + bodyH],
    ],
    0.72,
  );
  drawFace(
    right,
    [
      [cx, topY + hh * 2],
      [cx + hw, topY + hh],
      [cx + hw, topY + hh + bodyH],
      [cx, topY + hh * 2 + bodyH],
    ],
    0.86,
  );
  return c.toDataURL();
}

/** flat sprite icon (plants, items) */
export function flatIcon(name: string): string {
  const layers = buildLayers();
  const src = layerToCanvas(layers[texId(name)]);
  const c = document.createElement("canvas");
  c.width = ICON_SIZE;
  c.height = ICON_SIZE;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 2, 2, ICON_SIZE - 4, ICON_SIZE - 4);
  return c.toDataURL();
}

// pixel-art item sprites ────────────────────────────────────────────────────
const SPRITE_PALETTE: Record<string, string> = {
  h: "#9a6b3a", // handle
  H: "#7a5229",
  s: "#caa06a", // stick light
};

export function spriteIcon(rows: string[], colors: Record<string, string>): string {
  const c = document.createElement("canvas");
  const n = rows.length;
  c.width = ICON_SIZE;
  c.height = ICON_SIZE;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const tmp = document.createElement("canvas");
  tmp.width = n;
  tmp.height = n;
  const tctx = tmp.getContext("2d")!;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === "." || ch === " ") continue;
      const col = colors[ch] ?? SPRITE_PALETTE[ch];
      if (!col) continue;
      tctx.fillStyle = col;
      tctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.drawImage(tmp, 1, 1, ICON_SIZE - 2, ICON_SIZE - 2);
  return c.toDataURL();
}
