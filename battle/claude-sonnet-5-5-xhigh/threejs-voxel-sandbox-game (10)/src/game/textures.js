// Procedural pixel-art texture generation: block tiles (texture array), item sprites, UI icons.
import * as THREE from 'three';
import { TILE_NAMES, DEFS, I, B, S_CROSS, S_TORCH } from './blocks.js';
import { mulberry32, hash2 } from './noise.js';
import { DEFAULT_GRASS, DEFAULT_FOLIAGE } from './colors.js';

export const TS = 16;

// ---------------------------------------------------------------------------------------------
// pixel helpers
const newTile = () => new Uint8ClampedArray(TS * TS * 4);
function put(t, x, y, c, a = 255) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= TS || y >= TS) return;
  const i = (y * TS + x) * 4;
  t[i] = c[0]; t[i + 1] = c[1]; t[i + 2] = c[2]; t[i + 3] = a;
}
function get(t, x, y) {
  if (x < 0 || y < 0 || x >= TS || y >= TS) return [0, 0, 0, 0];
  const i = (y * TS + x) * 4;
  return [t[i], t[i + 1], t[i + 2], t[i + 3]];
}
const shade = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function fill(t, base, amp, rnd, alpha = 255) {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const f = 1 + (rnd() - 0.5) * amp;
    put(t, x, y, shade(base, f), alpha);
  }
}
function speckle(t, color, count, rnd, a = 255) {
  for (let i = 0; i < count; i++) put(t, (rnd() * TS) | 0, (rnd() * TS) | 0, shade(color, 0.9 + rnd() * 0.2), a);
}
function rect(t, x0, y0, x1, y1, c, a = 255) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(t, x, y, c, a);
}
function hline(t, y, x0, x1, c, a = 255) { for (let x = x0; x <= x1; x++) put(t, x, y, c, a); }
function vline(t, x, y0, y1, c, a = 255) { for (let y = y0; y <= y1; y++) put(t, x, y, c, a); }
function border(t, c, a = 255) {
  hline(t, 0, 0, 15, c, a); hline(t, 15, 0, 15, c, a); vline(t, 0, 0, 15, c, a); vline(t, 15, 0, 15, c, a);
}
function outline(t, c) {
  const copy = t.slice();
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const i = (y * TS + x) * 4;
    if (copy[i + 3] > 40) continue;
    let near = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= TS || yy >= TS) continue;
      if (copy[(yy * TS + xx) * 4 + 3] > 200) near = true;
    }
    if (near) put(t, x, y, c, 255);
  }
}
function periodic(x, y, kx, ky, ph = 0) {
  return Math.sin(((x * kx + y * ky) / TS) * Math.PI * 2 + ph);
}

const STONE = [128, 128, 128];
function stoneBase(t, rnd, base = STONE, amp = 0.16) {
  fill(t, base, amp, rnd);
  speckle(t, shade(base, 0.78), 12, rnd);
  speckle(t, shade(base, 1.15), 7, rnd);
}
function voronoi(t, rnd, base, n, amp, edge) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([rnd() * TS, rnd() * TS, 0.8 + rnd() * 0.4]);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    let d1 = 1e9, d2 = 1e9, k = 0;
    for (let i = 0; i < n; i++) {
      for (const ox of [-TS, 0, TS]) for (const oy of [-TS, 0, TS]) {
        const dx = x - pts[i][0] - ox, dy = y - pts[i][1] - oy;
        const d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; k = i; } else if (d < d2) d2 = d;
      }
    }
    const e = Math.sqrt(d2) - Math.sqrt(d1);
    let f = pts[k][2] + (rnd() - 0.5) * amp;
    if (e < 0.9) f *= edge;
    put(t, x, y, shade(base, f));
  }
}
function ore(t, rnd, colors) {
  stoneBase(t, rnd);
  for (let c = 0; c < 6; c++) {
    const cx = 1 + ((rnd() * 13) | 0), cy = 1 + ((rnd() * 13) | 0);
    const col = colors[(rnd() * colors.length) | 0];
    put(t, cx, cy, col); put(t, cx + 1, cy, shade(col, 0.9));
    if (rnd() < 0.8) put(t, cx, cy + 1, shade(col, 1.05));
    if (rnd() < 0.5) put(t, cx + 1, cy + 1, shade(col, 0.85));
    if (rnd() < 0.3) put(t, cx - 1, cy, shade(col, 0.8));
  }
}
function planksBase(t, rnd, base = [176, 136, 80]) {
  fill(t, base, 0.1, rnd);
  for (let r = 0; r < 4; r++) {
    hline(t, r * 4 + 3, 0, 15, shade(base, 0.72));
    const off = (r * 5 + 3) % 16;
    vline(t, off, r * 4, r * 4 + 2, shade(base, 0.8));
    for (let k = 0; k < 4; k++) put(t, (rnd() * TS) | 0, r * 4 + ((rnd() * 3) | 0), shade(base, 0.88));
  }
}
function rings(t, rnd, wood, dark, bark) {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const dx = x - 7.5, dy = y - 7.5;
    const d = Math.sqrt(dx * dx + dy * dy);
    const edge = Math.max(Math.abs(dx), Math.abs(dy));
    let c;
    if (edge > 6.4) c = shade(bark, 0.9 + rnd() * 0.2);
    else c = shade(Math.floor(d / 1.6) % 2 ? wood : dark, 0.95 + rnd() * 0.1);
    put(t, x, y, c);
  }
}
function barkSide(t, rnd, base, accent) {
  for (let x = 0; x < TS; x++) {
    const colF = 0.82 + hash2(x, 7, 99) * 0.3;
    for (let y = 0; y < TS; y++) {
      const f = colF * (0.92 + rnd() * 0.16);
      put(t, x, y, shade(base, f));
    }
  }
  for (let i = 0; i < 16; i++) put(t, (rnd() * TS) | 0, (rnd() * TS) | 0, accent);
}
function leaves(t, rnd, base, holes, amp = 0.35) {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const f = 1 + (rnd() - 0.5) * amp;
    const clump = (hash2(x >> 1, y >> 1, 5) < holes) && rnd() < 0.8;
    if (clump) put(t, x, y, [0, 0, 0], 0); else put(t, x, y, shade(base, f), 255);
  }
}
function dirtBase(t, rnd) {
  fill(t, [134, 96, 67], 0.2, rnd);
  speckle(t, [104, 74, 50], 14, rnd);
  speckle(t, [152, 112, 82], 6, rnd);
}

// ---------------------------------------------------------------------------------------------
// tile painters
const P = {};
P.stone = (t, r) => stoneBase(t, r);
P.dirt = (t, r) => dirtBase(t, r);
P.grass_top = (t, r) => { fill(t, [208, 208, 208], 0.2, r); speckle(t, [170, 170, 170], 18, r); speckle(t, [235, 235, 235], 8, r); };
P.grass_side = (t, r) => {
  dirtBase(t, r);
  for (let x = 0; x < TS; x++) {
    const depth = 3 + ((r() * 3) | 0);
    for (let y = 0; y < depth; y++) {
      const f = 0.78 + r() * 0.25;
      put(t, x, y, [215 * f, 215 * f, 215 * f], 128); // alpha 128 == "tint me" mask
    }
  }
};
P.cobble = (t, r) => voronoi(t, r, [125, 125, 125], 10, 0.2, 0.62);
P.planks = (t, r) => planksBase(t, r);
P.sand = (t, r) => { fill(t, [219, 207, 153], 0.08, r); speckle(t, [199, 187, 135], 16, r); speckle(t, [236, 226, 175], 8, r); };
P.gravel = (t, r) => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const g = 95 + hash2(x >> 1, y >> 1, 31) * 70 + (r() - 0.5) * 25;
    put(t, x, y, [g, g * 0.98, g * 0.96]);
  }
  speckle(t, [70, 68, 66], 14, r);
};
P.log_side = (t, r) => barkSide(t, r, [104, 82, 50], [62, 46, 26]);
P.log_top = (t, r) => rings(t, r, [180, 146, 92], [150, 118, 70], [100, 78, 46]);
P.birch_log_side = (t, r) => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) put(t, x, y, shade([228, 226, 214], 0.94 + r() * 0.1));
  for (let i = 0; i < 9; i++) { const x = (r() * 14) | 0, y = (r() * 15) | 0; hline(t, y, x, x + 1 + ((r() * 3) | 0), [40, 38, 36]); }
  speckle(t, [190, 188, 176], 14, r);
};
P.birch_log_top = (t, r) => rings(t, r, [214, 196, 148], [190, 170, 122], [228, 226, 214]);
P.spruce_log_side = (t, r) => barkSide(t, r, [72, 52, 32], [40, 28, 16]);
P.spruce_log_top = (t, r) => rings(t, r, [138, 104, 62], [112, 82, 48], [70, 50, 30]);
P.leaves = (t, r) => leaves(t, r, [208, 208, 208], 0.22);
P.birch_leaves = (t, r) => leaves(t, r, [126, 168, 84], 0.2);
P.spruce_leaves = (t, r) => leaves(t, r, [62, 104, 62], 0.18);
P.water = (t, r) => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const w = periodic(x, y, 1, 2, 0) * 0.5 + periodic(x, y, 2, -1, 1.7) * 0.5;
    const f = 1 + w * 0.12 + (r() - 0.5) * 0.06;
    put(t, x, y, shade([48, 98, 205], f), 185);
  }
};
P.bedrock = (t, r) => {
  fill(t, [86, 86, 86], 0.5, r);
  for (let i = 0; i < 22; i++) { const g = 20 + r() * 25; put(t, (r() * TS) | 0, (r() * TS) | 0, [g, g, g]); }
};
P.coal_ore = (t, r) => ore(t, r, [[38, 38, 40], [52, 50, 54], [28, 28, 30]]);
P.iron_ore = (t, r) => ore(t, r, [[216, 175, 148], [196, 150, 120], [230, 195, 170]]);
P.gold_ore = (t, r) => ore(t, r, [[252, 222, 60], [235, 195, 40], [255, 240, 120]]);
P.diamond_ore = (t, r) => ore(t, r, [[92, 240, 226], [60, 200, 205], [170, 255, 250]]);
P.snow = (t, r) => { fill(t, [246, 248, 252], 0.05, r); speckle(t, [220, 228, 240], 10, r); };
P.snow_side = (t, r) => {
  dirtBase(t, r);
  for (let x = 0; x < TS; x++) {
    const depth = 4 + ((r() * 3) | 0);
    for (let y = 0; y < depth; y++) put(t, x, y, shade([246, 248, 252], 0.95 + r() * 0.08));
  }
};
P.ice = (t, r) => {
  fill(t, [150, 196, 245], 0.1, r, 225);
  for (let i = 0; i < 12; i++) { const x = (r() * 14) | 0; put(t, x, 15 - x, [220, 240, 255], 235); put(t, (x + 3) % 16, (18 - x) % 16, [210, 235, 255], 230); }
};
P.sandstone_side = (t, r) => {
  fill(t, [216, 202, 150], 0.07, r);
  hline(t, 3, 0, 15, [190, 175, 125]); hline(t, 4, 0, 15, [228, 214, 164]);
  hline(t, 12, 0, 15, [190, 175, 125]); hline(t, 13, 0, 15, [228, 214, 164]);
  speckle(t, [196, 182, 132], 10, r);
};
P.sandstone_top = (t, r) => { fill(t, [222, 208, 156], 0.06, r); border(t, [205, 191, 140]); speckle(t, [205, 191, 140], 8, r); };
P.cactus_side = (t, r) => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const rib = (x % 4 === 0 || x % 4 === 3) ? 0.82 : 1;
    put(t, x, y, shade([58, 132, 52], rib * (0.94 + r() * 0.12)));
  }
  for (let i = 0; i < 12; i++) put(t, 2 + ((r() * 12) | 0), (r() * 16) | 0, [214, 236, 160]);
};
P.cactus_top = (t, r) => {
  fill(t, [64, 144, 56], 0.1, r); border(t, [38, 96, 36]);
  rect(t, 4, 4, 11, 11, [46, 110, 42]); rect(t, 6, 6, 9, 9, [86, 168, 74]);
};
P.glass = (t, r) => {
  rect(t, 0, 0, 15, 15, [0, 0, 0], 0);
  border(t, [205, 232, 240], 230);
  for (let i = 2; i < 6; i++) put(t, i, i, [255, 255, 255], 210);
  put(t, 3, 7, [255, 255, 255], 190); put(t, 7, 3, [255, 255, 255], 190);
  put(t, 12, 11, [235, 248, 255], 160); put(t, 11, 12, [235, 248, 255], 160);
};
P.crafting_top = (t, r) => {
  planksBase(t, r, [160, 120, 70]);
  border(t, [88, 60, 32]);
  for (const k of [5, 10]) { hline(t, k, 1, 14, [100, 70, 38]); vline(t, k, 1, 14, [100, 70, 38]); }
};
P.crafting_side = (t, r) => {
  planksBase(t, r, [166, 126, 74]);
  rect(t, 0, 0, 15, 2, [110, 78, 42]); rect(t, 0, 3, 15, 3, [84, 58, 30]);
  rect(t, 3, 6, 4, 12, [90, 90, 96]); rect(t, 2, 5, 5, 6, [150, 150, 158]);
  rect(t, 10, 6, 12, 7, [160, 160, 168]); vline(t, 11, 8, 13, [100, 70, 38]);
};
P.crafting_front = (t, r) => {
  planksBase(t, r, [166, 126, 74]);
  rect(t, 0, 0, 15, 2, [110, 78, 42]); rect(t, 0, 3, 15, 3, [84, 58, 30]);
  rect(t, 2, 6, 6, 7, [170, 170, 176]); vline(t, 3, 8, 13, [100, 70, 38]);
  rect(t, 9, 5, 13, 12, [92, 62, 34]); rect(t, 10, 6, 12, 11, [124, 88, 48]);
};
P.furnace_side = (t, r) => stoneBase(t, r, [112, 112, 114], 0.2);
P.furnace_top = (t, r) => { stoneBase(t, r, [120, 120, 122], 0.12); border(t, [90, 90, 92]); };
P.furnace_front = (t, r) => {
  stoneBase(t, r, [112, 112, 114], 0.2);
  rect(t, 3, 7, 12, 13, [26, 26, 28]); rect(t, 4, 8, 11, 12, [40, 40, 44]);
  hline(t, 5, 3, 12, [56, 56, 58]); hline(t, 4, 3, 12, [70, 70, 72]);
  rect(t, 3, 14, 12, 14, [70, 70, 72]);
};
P.furnace_front_lit = (t, r) => {
  stoneBase(t, r, [112, 112, 114], 0.2);
  rect(t, 3, 7, 12, 13, [60, 20, 8]);
  for (let x = 4; x <= 11; x++) for (let y = 9; y <= 12; y++) put(t, x, y, mixc([255, 120, 20], [255, 220, 90], r()));
  for (let x = 4; x <= 11; x++) put(t, x, 8, [150, 50, 10]);
  hline(t, 5, 3, 12, [56, 56, 58]); hline(t, 4, 3, 12, [70, 70, 72]);
  rect(t, 3, 14, 12, 14, [70, 70, 72]);
};
P.chest_top = (t, r) => { planksBase(t, r, [148, 108, 58]); border(t, [84, 56, 28]); hline(t, 1, 1, 14, [166, 126, 74]); };
P.chest_side = (t, r) => { planksBase(t, r, [148, 108, 58]); border(t, [84, 56, 28]); hline(t, 5, 0, 15, [84, 56, 28]); };
P.chest_front = (t, r) => {
  planksBase(t, r, [148, 108, 58]); border(t, [84, 56, 28]); hline(t, 5, 0, 15, [84, 56, 28]);
  rect(t, 7, 4, 8, 7, [200, 200, 205]); rect(t, 7, 6, 8, 6, [90, 90, 96]);
};
P.torch = (t) => {
  rect(t, 0, 0, 15, 15, [0, 0, 0], 0);
  for (let y = 8; y <= 15; y++) { put(t, 7, y, [138, 100, 50]); put(t, 8, y, [108, 76, 36]); }
  put(t, 7, 6, [255, 238, 120]); put(t, 8, 6, [255, 210, 70]);
  put(t, 7, 7, [255, 190, 60]); put(t, 8, 7, [255, 150, 40]);
};
P.tall_grass = (t, r) => {
  rect(t, 0, 0, 15, 15, [0, 0, 0], 0);
  for (const bx of [2, 4, 6, 8, 9, 11, 13]) {
    const h = 6 + ((r() * 8) | 0);
    for (let y = 0; y < h; y++) {
      const x = bx + (y > h - 3 && r() < 0.5 ? (r() < 0.5 ? -1 : 1) : 0);
      const g = 170 + ((y / h) * 60) + r() * 20;
      put(t, x, 15 - y, [g, g, g]);
    }
  }
};
function flower(t, r, petal, center) {
  rect(t, 0, 0, 15, 15, [0, 0, 0], 0);
  for (let y = 7; y <= 15; y++) put(t, 7, y, [60, 140, 44]);
  put(t, 8, 12, [70, 150, 50]); put(t, 9, 11, [70, 150, 50]); put(t, 6, 10, [70, 150, 50]); put(t, 5, 9, [70, 150, 50]);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) put(t, 7 + dx + (dx === 1 ? 0 : 0), 5 + dy, shade(petal, 0.9 + r() * 0.2));
  put(t, 7, 5, center); put(t, 8, 5, shade(petal, 0.95)); put(t, 8, 4, shade(petal, 1.0)); put(t, 8, 6, shade(petal, 0.85));
}
P.flower_red = (t, r) => flower(t, r, [212, 32, 38], [250, 210, 60]);
P.flower_yellow = (t, r) => flower(t, r, [250, 214, 40], [200, 130, 20]);
P.sapling = (t, r) => {
  rect(t, 0, 0, 15, 15, [0, 0, 0], 0);
  for (let y = 9; y <= 15; y++) put(t, 7, y, [104, 80, 44]);
  for (let y = 2; y < 10; y++) for (let x = 3; x < 13; x++) {
    const dx = x - 7.5, dy = y - 6;
    if (dx * dx + dy * dy * 1.3 < 17 && r() < 0.85) put(t, x, y, shade([70, 150, 52], 0.8 + r() * 0.4));
  }
};
P.dead_bush = (t, r) => {
  rect(t, 0, 0, 15, 15, [0, 0, 0], 0);
  const c = [112, 84, 44];
  for (let y = 8; y <= 15; y++) put(t, 7, y, c);
  const twig = (x, y, dx, dy, n) => { for (let i = 0; i < n; i++) { put(t, x + dx * i, y + dy * i, shade(c, 0.9 + r() * 0.3)); } };
  twig(7, 10, -1, -1, 4); twig(7, 9, 1, -1, 5); twig(5, 8, 1, -1, 2); twig(9, 11, 1, -1, 3); twig(7, 12, -1, -1, 3);
};
P.bricks = (t, r) => {
  fill(t, [152, 74, 58], 0.2, r);
  for (let row = 0; row < 4; row++) {
    hline(t, row * 4 + 3, 0, 15, [196, 190, 180]);
    const off = row % 2 ? 4 : 0;
    for (const bx of [0, 8]) vline(t, (bx + off) % 16, row * 4, row * 4 + 2, [196, 190, 180]);
  }
};
P.stone_bricks = (t, r) => {
  fill(t, [126, 126, 128], 0.14, r);
  for (let row = 0; row < 2; row++) {
    hline(t, row * 8 + 7, 0, 15, [86, 86, 90]);
    const off = row ? 4 : 0;
    for (const bx of [0, 8]) vline(t, (bx + off) % 16, row * 8, row * 8 + 6, [86, 86, 90]);
  }
  speckle(t, [150, 150, 152], 6, r);
};
P.lava = (t, r) => {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const w = periodic(x, y, 1, 1, 0) * 0.4 + periodic(x, y, 2, -1, 2.0) * 0.35 + periodic(x, y, -1, 3, 4) * 0.25;
    const c = mixc([170, 50, 10], [255, 200, 50], clamp01(0.5 + w * 0.7 + (r() - 0.5) * 0.25));
    put(t, x, y, c);
  }
};
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
P.wool = (t, r) => {
  fill(t, [234, 234, 232], 0.07, r);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) if ((x + y) % 4 === 0) put(t, x, y, [218, 218, 216]);
};
P.bed_top = (t, r) => {
  fill(t, [176, 32, 38], 0.1, r);
  rect(t, 0, 0, 15, 5, [240, 240, 238]); hline(t, 6, 0, 15, [200, 200, 198]);
  border(t, [120, 20, 24]);
};
P.bed_side = (t, r) => {
  planksBase(t, r, [160, 120, 70]);
  rect(t, 0, 0, 15, 11, [176, 32, 38]); hline(t, 11, 0, 15, [120, 20, 24]);
  speckle(t, [150, 24, 30], 14, r);
};
P.deepslate = (t, r) => {
  fill(t, [74, 74, 82], 0.16, r);
  for (let y = 0; y < TS; y++) { const f = hash2(y >> 1, 3, 12) * 0.3 + 0.85; for (let x = 0; x < TS; x++) { const i = (y * TS + x) * 4; t[i] *= f; t[i + 1] *= f; t[i + 2] *= f; } }
  speckle(t, [44, 44, 52], 12, r);
};
P.deepslate_top = (t, r) => { fill(t, [66, 66, 74], 0.14, r); speckle(t, [90, 90, 98], 10, r); border(t, [56, 56, 64]); };
const GLYPH = { T: ['111', '010', '010', '010', '010'], N: ['101', '111', '111', '101', '101'] };
P.tnt_side = (t, r) => {
  fill(t, [206, 54, 44], 0.12, r);
  rect(t, 0, 5, 15, 10, [226, 222, 208]);
  const word = ['T', 'N', 'T'];
  word.forEach((ch, k) => GLYPH[ch].forEach((row, yy) => [...row].forEach((v, xx) => { if (v === '1') put(t, 3 + k * 4 + xx, 5 + yy, [50, 50, 50]); })));
  hline(t, 4, 0, 15, [150, 30, 24]); hline(t, 11, 0, 15, [150, 30, 24]);
};
P.tnt_top = (t, r) => {
  fill(t, [196, 160, 120], 0.1, r); border(t, [150, 30, 24]);
  rect(t, 6, 6, 9, 9, [70, 70, 74]); put(t, 7, 7, [210, 210, 214]);
};
P.tnt_bottom = (t, r) => { fill(t, [196, 160, 120], 0.1, r); border(t, [150, 30, 24]); };

// ---------------------------------------------------------------------------------------------
// public: tiles
const tileCache = new Map();
export function tileData(name) {
  if (tileCache.has(name)) return tileCache.get(name);
  const t = newTile();
  const painter = P[name];
  if (!painter) throw new Error('No painter for tile ' + name);
  let h = 7;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  painter(t, mulberry32(h));
  // alpha bleeding: transparent texels take the average opaque colour so mip-mapping doesn't darken edges
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < t.length; i += 4) if (t[i + 3] > 200) { r += t[i]; g += t[i + 1]; b += t[i + 2]; n++; }
  if (n > 0) for (let i = 0; i < t.length; i += 4) if (t[i + 3] < 10) { t[i] = r / n; t[i + 1] = g / n; t[i + 2] = b / n; }
  tileCache.set(name, t);
  return t;
}

const avgColors = [];
export function tileAverage(layer) {
  if (avgColors[layer]) return avgColors[layer];
  const t = tileData(TILE_NAMES[layer]);
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < t.length; i += 4) if (t[i + 3] > 100) { r += t[i]; g += t[i + 1]; b += t[i + 2]; n++; }
  n = Math.max(n, 1);
  avgColors[layer] = [r / n, g / n, b / n];
  return avgColors[layer];
}

export function buildAtlasTexture() {
  const layers = TILE_NAMES.length;
  const data = new Uint8Array(TS * TS * 4 * layers);
  TILE_NAMES.forEach((name, i) => data.set(tileData(name), i * TS * TS * 4));
  const tex = new THREE.DataArrayTexture(data, TS, TS, layers);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------------------------
// item sprites
const HANDLE = [132, 96, 50], HANDLE_D = [92, 64, 32];
const MAT = {
  wood: { m: [168, 128, 70], d: [122, 88, 46], l: [198, 158, 98] },
  stone: { m: [140, 140, 142], d: [100, 100, 104], l: [172, 172, 176] },
  iron: { m: [222, 222, 226], d: [168, 168, 176], l: [248, 248, 252] },
  diamond: { m: [72, 226, 218], d: [38, 160, 182], l: [190, 255, 250] },
};
function pts(t, list, c) { for (const [x, y] of list) put(t, x, y, c); }
function drawHandle(t, from, to) {
  const n = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(from[0] + ((to[0] - from[0]) * i) / n), y = Math.round(from[1] + ((to[1] - from[1]) * i) / n);
    put(t, x, y, i % 2 ? HANDLE : [146, 108, 58]); put(t, x + 1, y, HANDLE_D);
  }
}
function toolSprite(type, mat) {
  const t = newTile(), c = MAT[mat];
  if (type === 'pickaxe') {
    drawHandle(t, [2, 14], [9, 7]);
    pts(t, [[5, 3], [6, 2], [7, 2], [8, 2], [9, 2], [10, 3], [11, 4], [12, 5], [13, 6], [13, 7]], c.m);
    pts(t, [[6, 3], [7, 3], [8, 3], [9, 3], [10, 4], [11, 5], [12, 6], [12, 7]], c.d);
    pts(t, [[6, 2], [7, 2], [8, 2], [4, 4], [5, 4]], c.l);
    pts(t, [[4, 5], [4, 4], [13, 8]], c.d);
  } else if (type === 'axe') {
    drawHandle(t, [2, 14], [9, 6]);
    pts(t, [[8, 2], [9, 2], [10, 2], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4], [8, 5], [9, 5], [10, 5], [11, 5], [12, 5], [11, 6], [12, 6]], c.m);
    pts(t, [[7, 3], [7, 4], [8, 5], [9, 5], [9, 4]], c.d);
    pts(t, [[12, 4], [12, 5], [12, 6], [11, 6], [10, 2]], c.l);
  } else if (type === 'shovel') {
    drawHandle(t, [2, 14], [10, 6]);
    pts(t, [[11, 2], [12, 2], [10, 3], [11, 3], [12, 3], [13, 3], [10, 4], [11, 4], [12, 4], [13, 4], [11, 5], [12, 5]], c.m);
    pts(t, [[10, 3], [10, 4], [11, 5]], c.d);
    pts(t, [[12, 2], [13, 3], [13, 4]], c.l);
  } else { // sword
    for (let i = 0; i < 10; i++) { put(t, 5 + i, 10 - i, c.l); put(t, 6 + i, 10 - i, c.m); put(t, 7 + i, 10 - i, i < 9 ? c.d : [0, 0, 0], i < 9 ? 255 : 0); }
    put(t, 14, 1, c.m);
    pts(t, [[3, 10], [4, 11], [5, 12], [2, 9], [6, 13]], [118, 86, 50]);
    pts(t, [[3, 11], [4, 12]], [170, 130, 70]);
    pts(t, [[3, 12], [2, 13]], HANDLE);
    pts(t, [[1, 14], [2, 14]], HANDLE_D);
  }
  outline(t, [28, 22, 18]);
  return t;
}
function blob(t, cx, cy, rx, ry, c, rnd, a = 255) {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    if (dx * dx + dy * dy <= 1) put(t, x, y, shade(c, 0.88 + rnd() * 0.24), a);
  }
}
function meat(rawCol, fat, bone, drum, rnd) {
  const t = newTile();
  if (drum) {
    blob(t, 9, 6, 4.6, 4, rawCol, rnd);
    for (let i = 0; i < 6; i++) { put(t, 6 - i * 0.8, 9 + i * 0.8, [236, 230, 214]); put(t, 7 - i * 0.8, 9 + i * 0.8, [214, 206, 190]); }
    put(t, 2, 14, [236, 230, 214]); put(t, 3, 14, [236, 230, 214]); put(t, 1, 13, [236, 230, 214]); put(t, 2, 15, [236, 230, 214]);
    blob(t, 9.6, 5.4, 2, 1.6, shade(rawCol, 1.18), rnd);
  } else {
    blob(t, 8, 8, 6, 4.5, fat, rnd);
    blob(t, 8, 8, 4.8, 3.4, rawCol, rnd);
    blob(t, 7, 6.6, 2.4, 1.4, shade(rawCol, 1.15), rnd);
    if (bone) { put(t, 11, 7, [236, 230, 214]); put(t, 12, 8, [236, 230, 214]); put(t, 11, 8, [214, 206, 190]); }
  }
  outline(t, shade(rawCol, 0.3));
  return t;
}
function ingot(c1, c2, c3) {
  const t = newTile();
  for (let i = 0; i < 4; i++) { hline(t, 6 + i, 2 + (3 - i), 11 + (3 - i), c1); }
  for (let i = 0; i < 4; i++) { put(t, 2 + (3 - i), 6 + i, c3); put(t, 11 + (3 - i), 6 + i, c2); }
  hline(t, 10, 2, 11, c2);
  hline(t, 5, 5, 14, c3);
  for (let i = 0; i < 4; i++) put(t, 14 - i, 6 + i, c2);
  hline(t, 6, 5, 13, mixc(c1, c3, 0.5));
  outline(t, shade(c2, 0.35));
  return t;
}
function itemSprite(id) {
  const rnd = mulberry32(id * 7919);
  const t = newTile();
  switch (id) {
    case I.STICK: drawHandle(t, [3, 13], [12, 4]); outline(t, [30, 22, 14]); return t;
    case I.COAL: case I.CHARCOAL: {
      const base = id === I.COAL ? [44, 44, 48] : [60, 50, 48];
      blob(t, 6, 8, 3.8, 3.4, base, rnd); blob(t, 10, 9, 3.6, 3.2, shade(base, 1.2), rnd); blob(t, 8, 5.5, 3, 2.6, shade(base, 0.9), rnd);
      put(t, 5, 7, [110, 110, 120]); put(t, 9, 5, [120, 120, 130]); put(t, 11, 8, [100, 100, 110]);
      outline(t, [12, 12, 14]); return t;
    }
    case I.IRON_INGOT: return ingot([216, 216, 220], [160, 160, 168], [244, 244, 248]);
    case I.GOLD_INGOT: return ingot([250, 214, 52], [196, 150, 20], [255, 244, 140]);
    case I.DIAMOND: {
      const c = [84, 232, 222];
      const rows = [[6, 9], [4, 11], [3, 12], [3, 12], [4, 11], [5, 10], [6, 9], [7, 8]];
      rows.forEach(([a, b], k) => { for (let x = a; x <= b; x++) put(t, x, 3 + k, shade(c, 0.85 + ((x + k) % 3) * 0.1)); });
      for (let x = 4; x <= 11; x++) put(t, x, 5, [190, 255, 250]);
      put(t, 6, 4, [220, 255, 255]); put(t, 7, 4, [200, 255, 252]);
      for (let k = 0; k < 4; k++) put(t, 8 + k % 2, 7 + k, [40, 160, 180]);
      outline(t, [20, 90, 110]); return t;
    }
    case I.FLINT: {
      pts(t, [[7, 3], [6, 4], [7, 4], [8, 4], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [6, 9], [7, 9], [8, 9], [9, 9]], [64, 64, 70]);
      pts(t, [[6, 5], [7, 5], [5, 6], [6, 6]], [110, 110, 120]); pts(t, [[9, 8], [10, 8], [9, 9]], [38, 38, 44]);
      outline(t, [14, 14, 16]); return t;
    }
    case I.FLINT_STEEL: {
      rect(t, 3, 8, 10, 12, [170, 172, 180]); rect(t, 4, 9, 9, 11, [20, 20, 24]); rect(t, 5, 6, 7, 7, [170, 172, 180]);
      pts(t, [[11, 4], [12, 4], [10, 5], [11, 5], [12, 5], [11, 6], [12, 6]], [64, 64, 70]); pts(t, [[11, 5], [11, 4]], [120, 120, 130]);
      pts(t, [[3, 8], [4, 8], [5, 8]], [220, 222, 230]);
      outline(t, [20, 20, 26]); return t;
    }
    case I.GUNPOWDER: {
      for (let k = 0; k < 40; k++) { const x = 3 + ((rnd() * 10) | 0), y = 5 + ((rnd() * 8) | 0); const dx = x - 8, dy = (y - 9) * 1.4; if (dx * dx + dy * dy < 26) put(t, x, y, shade([100, 100, 104], 0.7 + rnd() * 0.6)); }
      outline(t, [30, 30, 34]); return t;
    }
    case I.APPLE: {
      blob(t, 8, 9, 5, 4.6, [206, 36, 40], rnd); blob(t, 6.5, 8, 1.6, 1.8, [250, 120, 110], rnd);
      put(t, 8, 4, [100, 70, 30]); put(t, 8, 5, [100, 70, 30]); put(t, 9, 3, [70, 160, 50]); put(t, 10, 3, [70, 160, 50]); put(t, 10, 4, [60, 140, 44]);
      outline(t, [70, 14, 18]); return t;
    }
    case I.RAW_PORK: return meat([236, 140, 140], [250, 214, 206], false, false, rnd);
    case I.COOKED_PORK: return meat([166, 96, 54], [210, 160, 110], false, false, rnd);
    case I.RAW_BEEF: return meat([196, 52, 52], [230, 190, 180], true, false, rnd);
    case I.COOKED_BEEF: return meat([128, 66, 36], [170, 110, 70], true, false, rnd);
    case I.RAW_MUTTON: return meat([212, 92, 92], [244, 220, 210], true, false, rnd);
    case I.COOKED_MUTTON: return meat([150, 82, 44], [196, 140, 96], true, false, rnd);
    case I.RAW_CHICKEN: return meat([246, 190, 170], [250, 220, 200], false, true, rnd);
    case I.COOKED_CHICKEN: return meat([204, 134, 56], [226, 170, 96], false, true, rnd);
    case I.ROTTEN_FLESH: {
      blob(t, 8, 8, 6, 4.5, [112, 124, 62], rnd); blob(t, 7, 7, 3, 2, [138, 96, 70], rnd);
      speckle(t, [80, 60, 40], 6, rnd); put(t, 11, 9, [150, 40, 40]); put(t, 5, 9, [150, 40, 40]);
      outline(t, [44, 52, 22]); return t;
    }
    case I.BONE: {
      for (let i = 0; i < 9; i++) { put(t, 4 + i, 11 - i, [236, 232, 218]); put(t, 5 + i, 11 - i, [200, 196, 182]); }
      pts(t, [[3, 11], [3, 12], [4, 12], [2, 12], [12, 3], [12, 2], [13, 3], [11, 2], [13, 4]], [240, 236, 224]);
      outline(t, [90, 86, 76]); return t;
    }
    case I.BONE_MEAL: {
      for (let k = 0; k < 44; k++) { const x = 3 + ((rnd() * 10) | 0), y = 5 + ((rnd() * 8) | 0); const dx = x - 8, dy = (y - 9) * 1.4; if (dx * dx + dy * dy < 26) put(t, x, y, shade([240, 240, 236], 0.8 + rnd() * 0.25)); }
      outline(t, [150, 150, 146]); return t;
    }
    default: {
      const d = DEFS[id];
      if (d && d.tool) return toolSprite(d.tool, d.toolTier);
    }
  }
  return t;
}

const spriteCache = new Map();
export function spriteData(id) {
  if (spriteCache.has(id)) return spriteCache.get(id);
  const d = DEFS[id];
  let data;
  if (d && d.kind === 'block' && (d.shape === S_CROSS || d.shape === S_TORCH)) {
    data = tileData(d.tileSide).slice();
    if (d.tint === 1) tintInPlace(data, DEFAULT_GRASS);
  } else data = itemSprite(id);
  spriteCache.set(id, data);
  return data;
}

function tintInPlace(data, tint) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (data[i] * tint[0]) / 255; data[i + 1] = (data[i + 1] * tint[1]) / 255; data[i + 2] = (data[i + 2] * tint[2]) / 255;
  }
}

// ---------------------------------------------------------------------------------------------
// UI icons (data URLs)
const iconCache = new Map();
function tileCanvas(name, tint, maskMode) {
  const data = tileData(name).slice();
  if (tint) {
    for (let i = 0; i < data.length; i += 4) {
      const m = maskMode ? (data[i + 3] < 250 ? 1 : 0) : 1;
      if (m) { data[i] = (data[i] * tint[0]) / 255; data[i + 1] = (data[i + 1] * tint[1]) / 255; data[i + 2] = (data[i + 2] * tint[2]) / 255; }
      if (maskMode) data[i + 3] = 255;
    }
  }
  const c = document.createElement('canvas');
  c.width = c.height = TS;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data), TS, TS), 0, 0);
  return c;
}
function spriteCanvas(id) {
  const c = document.createElement('canvas');
  c.width = c.height = TS;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(spriteData(id)), TS, TS), 0, 0);
  return c;
}

export function getIcon(id) {
  if (iconCache.has(id)) return iconCache.get(id);
  const d = DEFS[id];
  let url = '';
  if (!d) return url;
  if (d.kind === 'item' || d.flatIcon) {
    url = spriteCanvas(id).toDataURL();
  } else {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const tintTop = d.tint === 1 ? DEFAULT_GRASS : d.tint === 2 ? DEFAULT_FOLIAGE : null;
    const top = tileCanvas(d.tileTop, tintTop, false);
    const side = tileCanvas(d.tileFront, d.id === B.GRASS ? DEFAULT_GRASS : (d.tint === 2 ? DEFAULT_FOLIAGE : null), d.id === B.GRASS);
    const right = tileCanvas(d.tileSide, d.id === B.GRASS ? DEFAULT_GRASS : (d.tint === 2 ? DEFAULT_FOLIAGE : null), d.id === B.GRASS);
    const h = d.shape === 6 && d.box ? d.box[4] / 16 : 1;
    // top
    ctx.save(); ctx.setTransform(14 / 16, 7 / 16, -14 / 16, 7 / 16, 16, 2 + (1 - h) * 14); ctx.drawImage(top, 0, 0); ctx.restore();
    // left
    ctx.save(); ctx.setTransform(14 / 16, 7 / 16, 0, (14 * h) / 16, 2, 9 + (1 - h) * 14); ctx.drawImage(side, 0, 0); ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.moveTo(2, 9 + (1 - h) * 14); ctx.lineTo(16, 16 + (1 - h) * 14); ctx.lineTo(16, 30); ctx.lineTo(2, 23); ctx.closePath(); ctx.fill();
    // right
    ctx.save(); ctx.setTransform(14 / 16, -7 / 16, 0, (14 * h) / 16, 16, 16 + (1 - h) * 14); ctx.drawImage(right, 0, 0); ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath(); ctx.moveTo(16, 16 + (1 - h) * 14); ctx.lineTo(30, 9 + (1 - h) * 14); ctx.lineTo(30, 23); ctx.lineTo(16, 30); ctx.closePath(); ctx.fill();
    url = c.toDataURL();
  }
  iconCache.set(id, url);
  return url;
}

// crack overlay textures for block breaking
export function makeCrackCanvases() {
  const out = [];
  const rnd = mulberry32(4242);
  const order = [];
  for (let i = 0; i < 256; i++) order.push(i);
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
  // seed crack as random walks
  const cells = new Set();
  for (let s = 0; s < 6; s++) {
    let x = 8 + ((rnd() * 8 - 4) | 0), y = 8 + ((rnd() * 8 - 4) | 0);
    const seq = [];
    for (let k = 0; k < 40; k++) {
      seq.push(x + y * 16);
      x += (rnd() * 3 | 0) - 1; y += (rnd() * 3 | 0) - 1;
      x = Math.max(0, Math.min(15, x)); y = Math.max(0, Math.min(15, y));
    }
    cells.add(seq);
  }
  const all = [...cells].flat();
  const seen = [...new Set(all)];
  for (let stage = 0; stage < 10; stage++) {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const ctx = c.getContext('2d');
    const n = Math.floor(((stage + 1) / 10) * seen.length);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    for (let i = 0; i < n; i++) { const p = seen[i]; ctx.fillRect(p % 16, (p / 16) | 0, 1, 1); }
    out.push(c);
  }
  return out;
}
