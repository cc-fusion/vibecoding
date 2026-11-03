// Procedural 16x16 Pixel-Art Atlas with 8px Gutter Extrusion + True 3D Isometric Icon Renderer

import * as THREE from 'three';
import {
  ATLAS_COLS,
  ATLAS_HEIGHT,
  ATLAS_ROWS,
  ATLAS_WIDTH,
  SLOT_PAD,
  SLOT_PX,
  TILE_PX,
} from '../constants.js';
import { BLOCK_DEFS, TEX } from '../game/blocks.js';
import { getItemDef } from '../game/items.js';
import { mulberry32 } from '../math/noise.js';

function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function shadeRgb(rgb, mul) {
  return [clampByte(rgb[0] * mul), clampByte(rgb[1] * mul), clampByte(rgb[2] * mul)];
}

export class TextureManager {
  constructor() {
    this.tileCanvases = new Map();
    this.iconCache = new Map();
    this.atlasCanvas = document.createElement('canvas');
    this.atlasCanvas.width = ATLAS_WIDTH;
    this.atlasCanvas.height = ATLAS_HEIGHT;
    this.ctx = this.atlasCanvas.getContext('2d', { willReadFrequently: true });

    this.generateAllTiles();

    this.texture = new THREE.CanvasTexture(this.atlasCanvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestMipmapLinearFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = true;
    this.texture.anisotropy = 4;
    this.texture.needsUpdate = true;

    this.waterTexture = this.texture.clone();
    this.waterTexture.needsUpdate = true;

    this.crackTextures = this.generateCrackTextures();
  }

  getTileUV(tileIndex) {
    const col = tileIndex % ATLAS_COLS;
    const row = Math.floor(tileIndex / ATLAS_COLS);
    // Inset slightly inside the 16x16 core (which already has 8px extruded border padding)
    const eps = 0.04;
    const x0 = col * SLOT_PX + SLOT_PAD + eps;
    const x1 = col * SLOT_PX + SLOT_PAD + TILE_PX - eps;
    const yTop = row * SLOT_PX + SLOT_PAD + eps;
    const yBot = row * SLOT_PX + SLOT_PAD + TILE_PX - eps;

    return {
      u0: x0 / ATLAS_WIDTH,
      u1: x1 / ATLAS_WIDTH,
      v0: 1.0 - yBot / ATLAS_HEIGHT,
      v1: 1.0 - yTop / ATLAS_HEIGHT,
    };
  }

  makeTile(tileIndex, painterFn) {
    const c = document.createElement('canvas');
    c.width = TILE_PX;
    c.height = TILE_PX;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const img = ctx.createImageData(TILE_PX, TILE_PX);
    const data = img.data;
    const rng = mulberry32(9001 + tileIndex * 7919);

    const setPx = (x, y, r, g, b, a = 255) => {
      if (x < 0 || x >= TILE_PX || y < 0 || y >= TILE_PX) return;
      const i = (y * TILE_PX + x) * 4;
      data[i] = clampByte(r);
      data[i + 1] = clampByte(g);
      data[i + 2] = clampByte(b);
      data[i + 3] = clampByte(a);
    };

    const fillNoise = (hex, variance = 0.09, alpha = 255) => {
      const base = hexToRgb(hex);
      for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
          const n = 1 + (rng() * 2 - 1) * variance;
          setPx(x, y, base[0] * n, base[1] * n, base[2] * n, alpha);
        }
      }
    };

    painterFn({ setPx, fillNoise, rng, hexToRgb, shadeRgb });
    ctx.putImageData(img, 0, 0);
    this.tileCanvases.set(tileIndex, c);
    this.blitWithPadding(tileIndex, c);
  }

  // Extrude every edge & corner pixel by SLOT_PAD (8px) so mipmapping never bleeds across tiles!
  blitWithPadding(tileIndex, tileCanvas) {
    const col = tileIndex % ATLAS_COLS;
    const row = Math.floor(tileIndex / ATLAS_COLS);
    const ox = col * SLOT_PX;
    const oy = row * SLOT_PX;
    const ctx = this.ctx;

    // Center 16x16
    ctx.drawImage(tileCanvas, ox + SLOT_PAD, oy + SLOT_PAD);

    // Top & bottom edge strips
    ctx.drawImage(tileCanvas, 0, 0, TILE_PX, 1, ox + SLOT_PAD, oy, TILE_PX, SLOT_PAD);
    ctx.drawImage(
      tileCanvas,
      0,
      TILE_PX - 1,
      TILE_PX,
      1,
      ox + SLOT_PAD,
      oy + SLOT_PAD + TILE_PX,
      TILE_PX,
      SLOT_PAD
    );

    // Left & right edge strips
    ctx.drawImage(tileCanvas, 0, 0, 1, TILE_PX, ox, oy + SLOT_PAD, SLOT_PAD, TILE_PX);
    ctx.drawImage(
      tileCanvas,
      TILE_PX - 1,
      0,
      1,
      TILE_PX,
      ox + SLOT_PAD + TILE_PX,
      oy + SLOT_PAD,
      SLOT_PAD,
      TILE_PX
    );

    // 4 corners
    ctx.drawImage(tileCanvas, 0, 0, 1, 1, ox, oy, SLOT_PAD, SLOT_PAD);
    ctx.drawImage(tileCanvas, TILE_PX - 1, 0, 1, 1, ox + SLOT_PAD + TILE_PX, oy, SLOT_PAD, SLOT_PAD);
    ctx.drawImage(tileCanvas, 0, TILE_PX - 1, 1, 1, ox, oy + SLOT_PAD + TILE_PX, SLOT_PAD, SLOT_PAD);
    ctx.drawImage(
      tileCanvas,
      TILE_PX - 1,
      TILE_PX - 1,
      1,
      1,
      ox + SLOT_PAD + TILE_PX,
      oy + SLOT_PAD + TILE_PX,
      SLOT_PAD,
      SLOT_PAD
    );
  }

  generateAllTiles() {
    // 0: Grass Top (natural lush meadow green with warm blades)
    this.makeTile(TEX.GRASS_TOP, ({ setPx, rng }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const r = rng();
          if (r < 0.16) setPx(x, y, 76, 148, 54);
          else if (r < 0.34) setPx(x, y, 108, 179, 68);
          else setPx(x, y, 91, 164, 60);
        }
      }
    });

    // 2: Dirt
    this.makeTile(TEX.DIRT, ({ setPx, fillNoise, rng }) => {
      fillNoise('#865b3d', 0.12);
      for (let i = 0; i < 24; i++) {
        const x = (rng() * 16) | 0;
        const y = (rng() * 16) | 0;
        if (rng() < 0.45) setPx(x, y, 109, 77, 54);
        else setPx(x, y, 148, 120, 96);
      }
    });

    // 1: Grass Side (dirt base + overhanging green grass skirt)
    this.makeTile(TEX.GRASS_SIDE, ({ setPx, rng }) => {
      const dirtImg = this.tileCanvases
        .get(TEX.DIRT)
        .getContext('2d')
        .getImageData(0, 0, 16, 16).data;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const idx = (y * 16 + x) * 4;
          setPx(x, y, dirtImg[idx], dirtImg[idx + 1], dirtImg[idx + 2]);
        }
      }
      for (let x = 0; x < 16; x++) {
        const skirt = 3 + ((Math.sin(x * 1.4) * 1.3 + rng() * 1.8) | 0);
        for (let y = 0; y < skirt; y++) {
          const shade = y === skirt - 1 ? 0.84 : 1 + (rng() * 0.16 - 0.08);
          setPx(x, y, 91 * shade, 164 * shade, 60 * shade);
        }
        // Subtle shadow directly below grass overhang
        if (skirt < 15) {
          const idx = (skirt * 16 + x) * 4;
          setPx(x, skirt, dirtImg[idx] * 0.78, dirtImg[idx + 1] * 0.78, dirtImg[idx + 2] * 0.78);
        }
      }
    });

    // 3: Stone (natural stratified stone)
    this.makeTile(TEX.STONE, ({ setPx, rng }) => {
      for (let y = 0; y < 16; y++) {
        const band = Math.sin(y * 0.9) * 6;
        for (let x = 0; x < 16; x++) {
          let v = 132 + band + (rng() * 18 - 9);
          if ((y % 4 === 3 && (x + y * 3) % 7 < 4) || rng() < 0.06) v -= 16;
          setPx(x, y, v, v + 2, v + 5);
        }
      }
    });

    // 4: Cobblestone
    this.makeTile(TEX.COBBLESTONE, ({ setPx, rng }) => {
      const centers = [
        [3, 3], [9, 2], [14, 4],
        [1, 8], [6, 7], [12, 9],
        [4, 13], [10, 14], [15, 13],
      ];
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          let d1 = 999;
          let d2 = 999;
          let ci = 0;
          for (let i = 0; i < centers.length; i++) {
            const [cx, cy] = centers[i];
            const dx = Math.min(Math.abs(x - cx), 16 - Math.abs(x - cx));
            const dy = Math.min(Math.abs(y - cy), 16 - Math.abs(y - cy));
            const d = Math.hypot(dx, dy);
            if (d < d1) {
              d2 = d1;
              d1 = d;
              ci = i;
            } else if (d < d2) {
              d2 = d;
            }
          }
          const edge = d2 - d1;
          let v = edge < 0.95 ? 74 + rng() * 12 : 122 + ((ci * 13) % 26) + (rng() * 14 - 7);
          setPx(x, y, v, v + 1, v + 4);
        }
      }
    });

    // 5: Bedrock
    this.makeTile(TEX.BEDROCK, ({ setPx, rng }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const v = rng() < 0.35 ? 36 + rng() * 18 : rng() < 0.65 ? 64 + rng() * 20 : 94 + rng() * 16;
          setPx(x, y, v, v, v + 3);
        }
      }
    });

    // 6: Sand
    this.makeTile(TEX.SAND, ({ setPx, rng }) => {
      for (let y = 0; y < 16; y++) {
        const wave = Math.sin((y + (xOffset(y))) * 0.8) * 6;
        for (let x = 0; x < 16; x++) {
          const w = Math.sin((y * 1.2 + x * 0.35)) * 6 + wave * 0.25 + (rng() * 10 - 5);
          setPx(x, y, 226 + w, 211 + w, 156 + w);
        }
      }
      function xOffset(row) {
        return row % 2;
      }
    });

    // 7 & 8: Sandstone Side & Top
    this.makeTile(TEX.SANDSTONE_SIDE, ({ setPx, rng }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          let m = 1.0 + (rng() * 0.06 - 0.03);
          if (y === 3 || y === 8 || y === 13) m -= 0.13;
          if (y < 3) m += 0.05;
          setPx(x, y, 220 * m, 202 * m, 144 * m);
        }
      }
    });
    this.makeTile(TEX.SANDSTONE_TOP, ({ fillNoise }) => fillNoise('#e2d098', 0.05));

    // 9: Gravel
    this.makeTile(TEX.GRAVEL, ({ setPx, rng }) => {
      const palette = ['#7b7675', '#958f8d', '#a9a29e', '#686464'];
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const c = hexToRgb(palette[(rng() * palette.length) | 0]);
          setPx(x, y, c[0], c[1], c[2]);
        }
      }
    });

    // 10: Clay
    this.makeTile(TEX.CLAY, ({ fillNoise }) => fillNoise('#9da8ba', 0.06));

    // 11: Water (bright oceanic turquoise-cerulean with wave highlights)
    this.makeTile(TEX.WATER, ({ setPx, rng }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const wave = Math.sin(x * 0.8 + y * 0.6) * 0.5 + 0.5;
          const glint = wave > 0.86 || rng() < 0.04 ? 28 : 0;
          setPx(
            x,
            y,
            40 + wave * 24 + glint,
            138 + wave * 34 + glint,
            216 + wave * 24 + glint,
            205
          );
        }
      }
    });

    // 12 & 13: Snow Top & Snowy Grass Side
    this.makeTile(TEX.SNOW_TOP, ({ setPx, rng }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = rng() * 10;
          setPx(x, y, 238 + n, 245 + n * 0.8, 255);
        }
      }
    });
    this.makeTile(TEX.SNOW_SIDE, ({ setPx, rng }) => {
      const dirtImg = this.tileCanvases
        .get(TEX.DIRT)
        .getContext('2d')
        .getImageData(0, 0, 16, 16).data;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const idx = (y * 16 + x) * 4;
          setPx(x, y, dirtImg[idx], dirtImg[idx + 1], dirtImg[idx + 2]);
        }
      }
      for (let x = 0; x < 16; x++) {
        const skirt = 4 + ((Math.cos(x * 1.2) * 1.4 + rng() * 1.5) | 0);
        for (let y = 0; y < skirt; y++) {
          const edge = y === skirt - 1 ? 215 : 242 + rng() * 10;
          setPx(x, y, edge, edge + 5, 255);
        }
      }
    });

    // 14: Ice
    this.makeTile(TEX.ICE, ({ setPx, rng }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const streak = ((x + y) % 7 === 0 || (x + y) % 11 === 0) ? 28 : 0;
          const n = rng() * 8;
          setPx(x, y, 138 + streak + n, 200 + streak + n, 248 + streak, 228);
        }
      }
    });

    // Helper for Logs, Planks, and Leaves
    const makeLog = (sideIdx, topIdx, barkHex, innerHex, ringHex) => {
      const bark = hexToRgb(barkHex);
      const inner = hexToRgb(innerHex);
      const ring = hexToRgb(ringHex);
      this.makeTile(sideIdx, ({ setPx, rng }) => {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const groove = x % 4 === 0 ? 0.78 : x % 4 === 2 ? 1.1 : 0.96;
            const m = groove * (1 + (rng() * 0.14 - 0.07));
            setPx(x, y, bark[0] * m, bark[1] * m, bark[2] * m);
          }
        }
      });
      this.makeTile(topIdx, ({ setPx, rng }) => {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const dist = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
            if (dist > 6.4) {
              const m = 0.92 + rng() * 0.14;
              setPx(x, y, bark[0] * m, bark[1] * m, bark[2] * m);
            } else {
              const c = Math.round(dist) % 2 === 0 ? inner : ring;
              const m = 0.96 + rng() * 0.08;
              setPx(x, y, c[0] * m, c[1] * m, c[2] * m);
            }
          }
        }
      });
    };

    const makePlanks = (tileIdx, baseHex) => {
      const base = hexToRgb(baseHex);
      this.makeTile(tileIdx, ({ setPx, rng }) => {
        for (let y = 0; y < 16; y++) {
          const plank = (y / 4) | 0;
          const seam = y % 4 === 3;
          const jointX = (plank * 7 + 3) % 16;
          for (let x = 0; x < 16; x++) {
            let m = 1 + ((plank % 2 === 0 ? 0.04 : -0.03)) + (rng() * 0.08 - 0.04);
            if (seam || x === jointX) m *= 0.76;
            setPx(x, y, base[0] * m, base[1] * m, base[2] * m);
          }
        }
      });
    };

    const makeLeaves = (tileIdx, lightHex, midHex, darkHex) => {
      const l = hexToRgb(lightHex);
      const m = hexToRgb(midHex);
      const d = hexToRgb(darkHex);
      this.makeTile(tileIdx, ({ setPx, rng }) => {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const r = rng();
            if (r < 0.14 && (x + y) % 2 === 0) {
              setPx(x, y, d[0] * 0.55, d[1] * 0.55, d[2] * 0.55, 0); // crisp leaf gaps!
            } else if (r < 0.42) {
              setPx(x, y, d[0], d[1], d[2], 255);
            } else if (r < 0.78) {
              setPx(x, y, m[0], m[1], m[2], 255);
            } else {
              setPx(x, y, l[0], l[1], l[2], 255);
            }
          }
        }
      });
    };

    // Oak
    makeLog(TEX.OAK_LOG_SIDE, TEX.OAK_LOG_TOP, '#6f5335', '#c8a26a', '#9e7847');
    makePlanks(TEX.OAK_PLANKS, '#b88f58');
    makeLeaves(TEX.OAK_LEAVES, '#69b848', '#4d9836', '#357026');

    // Birch (special white bark with black horizontal lenticels!)
    makeLog(TEX.BIRCH_LOG_SIDE, TEX.BIRCH_LOG_TOP, '#e6e3da', '#dfd2a8', '#c2b285');
    this.makeTile(TEX.BIRCH_LOG_SIDE, ({ setPx, rng }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const v = 228 + (rng() * 16 - 8);
          setPx(x, y, v, v - 2, v - 8);
        }
      }
      const marks = [[2, 3, 4], [10, 6, 3], [4, 10, 5], [11, 13, 4], [1, 14, 3]];
      for (const [mx, my, len] of marks) {
        for (let i = 0; i < len; i++) {
          setPx((mx + i) % 16, my, 52, 48, 44);
        }
      }
    });
    makePlanks(TEX.BIRCH_PLANKS, '#d8c998');
    makeLeaves(TEX.BIRCH_LEAVES, '#88c556', '#6da640', '#4d7c2d');

    // Spruce
    makeLog(TEX.SPRUCE_LOG_SIDE, TEX.SPRUCE_LOG_TOP, '#4a3320', '#9f7648', '#785631');
    makePlanks(TEX.SPRUCE_PLANKS, '#7f5b38');
    makeLeaves(TEX.SPRUCE_LEAVES, '#4a8559', '#356944', '#244b30');

    // Cactus
    this.makeTile(TEX.CACTUS_SIDE, ({ setPx, rng }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const rib = x % 4 === 0 ? 0.78 : 1.04;
          const n = 1 + (rng() * 0.08 - 0.04);
          setPx(x, y, 56 * rib * n, 136 * rib * n, 52 * rib * n);
          if (x % 4 === 2 && y % 5 === 2) setPx(x, y, 225, 232, 190);
        }
      }
    });
    this.makeTile(TEX.CACTUS_TOP, ({ setPx, rng }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const d = Math.hypot(x - 7.5, y - 7.5);
          const m = d < 2.2 ? 1.25 : 0.95 + rng() * 0.1;
          setPx(x, y, 64 * m, 146 * m, 58 * m);
        }
      }
    });

    // Ores: copy Stone base + paint rich mineral clusters
    const makeOre = (tileIdx, mainHex, hiHex) => {
      const stoneImg = this.tileCanvases
        .get(TEX.STONE)
        .getContext('2d')
        .getImageData(0, 0, 16, 16).data;
      const main = hexToRgb(mainHex);
      const hi = hexToRgb(hiHex);
      const flecks = [
        [3, 3], [4, 3], [3, 4],
        [10, 4], [11, 4], [11, 5],
        [5, 9], [6, 9], [5, 10], [6, 10],
        [12, 11], [13, 11], [12, 12],
        [2, 13], [3, 13],
      ];
      this.makeTile(tileIdx, ({ setPx }) => {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const idx = (y * 16 + x) * 4;
            setPx(x, y, stoneImg[idx], stoneImg[idx + 1], stoneImg[idx + 2]);
          }
        }
        for (let i = 0; i < flecks.length; i++) {
          const [fx, fy] = flecks[i];
          const c = i % 3 === 0 ? hi : main;
          setPx(fx, fy, c[0], c[1], c[2]);
        }
      });
    };

    makeOre(TEX.COAL_ORE, '#22262b', '#434952');
    makeOre(TEX.IRON_ORE, '#c68d6b', '#f0c4a6');
    makeOre(TEX.GOLD_ORE, '#e5b822', '#fff078');
    makeOre(TEX.DIAMOND_ORE, '#2bd6cf', '#9ffffb');

    // Glow Crystal (radiant amber-gold & starlight facets)
    this.makeTile(TEX.GLOW_CRYSTAL, ({ setPx, rng }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
          const core = Math.max(0, 1 - d / 11);
          const sparkle = rng() < 0.2 ? 32 : 0;
          setPx(
            x,
            y,
            195 + core * 60 + sparkle,
            150 + core * 92 + sparkle,
            78 + core * 120 + sparkle
          );
        }
      }
    });

    // Glass (crisp cyan-white frame + subtle diagonal specular highlight + transparent center!)
    this.makeTile(TEX.GLASS, ({ setPx }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x === 0 || x === 15 || y === 0 || y === 15;
          const glint = (x + y === 5 || x + y === 6) && x > 1 && y > 1 && x < 7 && y < 7;
          const glint2 = (x + y === 21) && x > 9 && y > 9 && x < 14 && y < 14;
          if (border) {
            setPx(x, y, 206, 238, 252, 245);
          } else if (glint || glint2) {
            setPx(x, y, 236, 250, 255, 220);
          } else {
            setPx(x, y, 180, 225, 245, 0);
          }
        }
      }
    });

    // Red Clay Bricks
    this.makeTile(TEX.BRICKS, ({ setPx, rng }) => {
      for (let y = 0; y < 16; y++) {
        const row = (y / 4) | 0;
        const mortarY = y % 4 === 3;
        for (let x = 0; x < 16; x++) {
          const mortarX = (x + (row % 2) * 4) % 8 === 7;
          if (mortarY || mortarX) {
            const m = 205 + rng() * 16;
            setPx(x, y, m, m - 6, m - 14);
          } else {
            const n = rng() * 20 - 10;
            setPx(x, y, 174 + n, 78 + n * 0.6, 62 + n * 0.5);
          }
        }
      }
    });

    // Chiseled Stone Bricks
    this.makeTile(TEX.STONE_BRICKS, ({ setPx, rng }) => {
      for (let y = 0; y < 16; y++) {
        const row = (y / 8) | 0;
        const mortarY = y % 8 === 7;
        const hiY = y % 8 === 0;
        for (let x = 0; x < 16; x++) {
          const mortarX = (x + row * 8) % 16 === 15;
          let v = 132 + (rng() * 12 - 6);
          if (mortarY || mortarX) v = 82;
          else if (hiY) v = 152;
          setPx(x, y, v, v + 2, v + 5);
        }
      }
    });

    // Crafting Table Top & Side
    this.makeTile(TEX.CRAFT_TOP, ({ setPx, rng }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const frame = x < 2 || x > 13 || y < 2 || y > 13;
          const grid = x === 5 || x === 10 || y === 5 || y === 10;
          const m = 0.96 + rng() * 0.08;
          if (frame) setPx(x, y, 118 * m, 84 * m, 48 * m);
          else if (grid) setPx(x, y, 92 * m, 64 * m, 36 * m);
          else setPx(x, y, 186 * m, 146 * m, 92 * m);
        }
      }
    });

    this.makeTile(TEX.CRAFT_SIDE, ({ setPx }) => {
      const planks = this.tileCanvases
        .get(TEX.OAK_PLANKS)
        .getContext('2d')
        .getImageData(0, 0, 16, 16).data;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const i = (y * 16 + x) * 4;
          if (y < 3) setPx(x, y, 112, 78, 45);
          else setPx(x, y, planks[i], planks[i + 1], planks[i + 2]);
        }
      }
      // Pixel saw + hammer hanging on workbench side
      for (let y = 5; y <= 12; y++) {
        setPx(4, y, 206, 214, 224);
        if (y < 10) setPx(5, y, 180, 188, 200);
        setPx(11, y, 108, 72, 38);
      }
      setPx(4, 4, 130, 82, 42);
      setPx(5, 4, 130, 82, 42);
      for (let x = 9; x <= 13; x++) setPx(x, 5, 196, 204, 214);
    });

    // Furnace Front & Side
    this.makeTile(TEX.FURNACE_SIDE, ({ setPx }) => {
      const sb = this.tileCanvases
        .get(TEX.STONE_BRICKS)
        .getContext('2d')
        .getImageData(0, 0, 16, 16).data;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const i = (y * 16 + x) * 4;
          const border = x === 0 || x === 15 || y === 0 || y === 15 ? 0.78 : 1;
          setPx(x, y, sb[i] * border, sb[i + 1] * border, sb[i + 2] * border);
        }
      }
    });

    this.makeTile(TEX.FURNACE_FRONT, ({ setPx }) => {
      const side = this.tileCanvases
        .get(TEX.FURNACE_SIDE)
        .getContext('2d')
        .getImageData(0, 0, 16, 16).data;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const i = (y * 16 + x) * 4;
          setPx(x, y, side[i], side[i + 1], side[i + 2]);
          if (x >= 4 && x <= 11 && y >= 3 && y <= 7) {
            setPx(x, y, 42, 45, 50);
          }
          if (x >= 4 && x <= 11 && y >= 10 && y <= 13) {
            if (y >= 12 && (x === 6 || x === 9 || x === 7)) setPx(x, y, 255, 146, 42);
            else if (y === 13) setPx(x, y, 215, 78, 28);
            else setPx(x, y, 48, 42, 40);
          }
        }
      }
    });

    // Torch
    this.makeTile(TEX.TORCH, ({ setPx }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) setPx(x, y, 0, 0, 0, 0);
      }
      for (let y = 6; y < 16; y++) {
        setPx(7, y, 162, 118, 66, 255);
        setPx(8, y, 134, 94, 50, 255);
      }
      // Glowing flame head
      setPx(7, 5, 255, 168, 38, 255);
      setPx(8, 5, 255, 148, 28, 255);
      setPx(7, 4, 255, 232, 110, 255);
      setPx(8, 4, 255, 212, 74, 255);
      setPx(7, 3, 255, 250, 190, 255);
    });

    // Lantern Side & Top
    this.makeTile(TEX.LANTERN_SIDE, ({ setPx }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const iron = x < 3 || x > 12 || y < 3 || y > 13;
          if (iron) setPx(x, y, 58, 64, 74);
          else {
            const core = Math.max(0, 1 - Math.hypot(x - 7.5, y - 8) / 6);
            setPx(x, y, 235 + core * 20, 175 + core * 70, 68 + core * 110);
          }
        }
      }
    });
    this.makeTile(TEX.LANTERN_TOP, ({ setPx }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const ring = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
          setPx(x, y, ring < 3 ? 96 : 56, ring < 3 ? 102 : 62, ring < 3 ? 114 : 72);
        }
      }
    });

    // Flora cutouts (Tall Grass, Poppy, Dandelion, Blue Orchid, Red Mushroom, Sugar Cane)
    this.makeTile(TEX.TALL_GRASS, ({ setPx, rng }) => {
      const cols = [2, 4, 6, 8, 9, 11, 13];
      for (const bx of cols) {
        const top = 3 + ((rng() * 6) | 0);
        for (let y = 15; y >= top; y--) {
          const sway = y < 8 ? ((rng() * 2 - 0.5) | 0) : 0;
          const g = 148 + (15 - y) * 3;
          setPx(bx + sway, y, 78, g, 54, 255);
        }
      }
    });

    const makeFlower = (tileIdx, petalHex, centerHex) => {
      const petal = hexToRgb(petalHex);
      const center = hexToRgb(centerHex);
      this.makeTile(tileIdx, ({ setPx }) => {
        for (let y = 8; y < 16; y++) {
          setPx(7, y, 68, 148, 52, 255);
          if (y === 12) {
            setPx(6, 12, 78, 160, 58, 255);
            setPx(8, 11, 78, 160, 58, 255);
          }
        }
        for (let py = 3; py <= 8; py++) {
          for (let px = 5; px <= 10; px++) {
            const d = Math.hypot(px - 7.5, py - 5.5);
            if (d < 1.3) setPx(px, py, center[0], center[1], center[2], 255);
            else if (d < 2.9) setPx(px, py, petal[0], petal[1], petal[2], 255);
          }
        }
      });
    };

    makeFlower(TEX.POPPY, '#e53935', '#2d2424');
    makeFlower(TEX.DANDELION, '#ffdf38', '#f59f1a');
    makeFlower(TEX.BLUE_ORCHID, '#3dc2ff', '#e8f9ff');

    // Red Mushroom
    this.makeTile(TEX.RED_MUSHROOM, ({ setPx }) => {
      for (let y = 10; y < 16; y++) {
        setPx(7, y, 236, 228, 210, 255);
        setPx(8, y, 220, 212, 194, 255);
      }
      for (let y = 5; y <= 10; y++) {
        const half = y === 5 ? 2 : y < 8 ? 4 : 5;
        for (let x = 8 - half; x <= 7 + half; x++) {
          const spot = (x === 6 && y === 7) || (x === 9 && y === 8) || (x === 8 && y === 6);
          if (spot) setPx(x, y, 250, 246, 240, 255);
          else setPx(x, y, 216, 48, 42, 255);
        }
      }
    });

    // Sugar Cane
    this.makeTile(TEX.SUGAR_CANE, ({ setPx }) => {
      for (const sx of [4, 8, 12]) {
        for (let y = 0; y < 16; y++) {
          const node = y % 5 === 0 ? 1.18 : 0.96;
          setPx(sx, y, 122 * node, 204 * node, 78 * node, 255);
          setPx(sx + 1, y, 102 * node, 182 * node, 64 * node, 255);
        }
      }
    });

    // Pumpkin
    this.makeTile(TEX.PUMPKIN_SIDE, ({ setPx, rng }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const rib = x % 4 === 0 ? 0.78 : 1.04;
          const n = 1 + (rng() * 0.06 - 0.03);
          setPx(x, y, 228 * rib * n, 126 * rib * n, 34 * rib * n);
        }
      }
    });
    this.makeTile(TEX.PUMPKIN_TOP, ({ setPx }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const d = Math.hypot(x - 7.5, y - 7.5);
          if (d < 2.1) setPx(x, y, 98, 128, 52);
          else setPx(x, y, 226, 128, 36);
        }
      }
    });

    // White & Red Wool
    this.makeTile(TEX.WOOL_WHITE, ({ setPx, rng }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const weave = ((x + y) % 2 === 0 ? 6 : -4) + rng() * 8;
          setPx(x, y, 238 + weave, 238 + weave, 234 + weave);
        }
      }
    });
    this.makeTile(TEX.WOOL_RED, ({ setPx, rng }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const weave = ((x + y) % 2 === 0 ? 8 : -6) + rng() * 8;
          setPx(x, y, 198 + weave, 52 + weave * 0.4, 52 + weave * 0.4);
        }
      }
    });

    // Bookshelf Side
    this.makeTile(TEX.BOOKSHELF_SIDE, ({ setPx }) => {
      const bookColors = ['#b83b3b', '#2f6fb8', '#3c8f4c', '#c89b2c', '#7a45a8', '#b86832'];
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (y < 2 || y === 7 || y === 8 || y > 13 || x === 0 || x === 15) {
            setPx(x, y, 178, 138, 84);
          } else {
            const shelf = y < 7 ? 0 : 3;
            const c = hexToRgb(bookColors[((x / 2 + shelf) | 0) % bookColors.length]);
            const spine = x % 2 === 0 ? 1.05 : 0.85;
            setPx(x, y, c[0] * spine, c[1] * spine, c[2] * spine);
          }
        }
      }
    });

    // Chest Top, Side, Front
    this.makeTile(TEX.CHEST_TOP, ({ setPx }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x < 2 || x > 13 || y < 2 || y > 13;
          setPx(x, y, border ? 104 : 182, border ? 72 : 128, border ? 38 : 58);
        }
      }
    });
    this.makeTile(TEX.CHEST_SIDE, ({ setPx }) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const rim = x < 2 || x > 13 || y < 2 || y > 13 || y === 5;
          setPx(x, y, rim ? 102 : 184, rim ? 70 : 130, rim ? 36 : 58);
        }
      }
    });
    this.makeTile(TEX.CHEST_FRONT, ({ setPx }) => {
      const side = this.tileCanvases
        .get(TEX.CHEST_SIDE)
        .getContext('2d')
        .getImageData(0, 0, 16, 16).data;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const i = (y * 16 + x) * 4;
          setPx(x, y, side[i], side[i + 1], side[i + 2]);
          if (x >= 7 && x <= 8 && y >= 4 && y <= 7) {
            setPx(x, y, 245, 212, 78);
          }
        }
      }
    });
  }

  generateCrackTextures() {
    const textures = [];
    for (let stage = 0; stage < 6; stage++) {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 16, 16);
      ctx.fillStyle = `rgba(18, 20, 24, ${0.45 + stage * 0.08})`;
      const rays = 3 + stage * 2;
      const len = 2 + stage * 1.4;
      for (let r = 0; r < rays; r++) {
        const angle = (r / rays) * Math.PI * 2 + 0.4;
        for (let d = 0; d < len; d += 0.7) {
          const wobble = Math.sin(d * 1.7 + r) * 0.8;
          const px = Math.round(7.5 + Math.cos(angle) * d + wobble);
          const py = Math.round(7.5 + Math.sin(angle) * d - wobble);
          ctx.fillRect(px, py, 1, 1);
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      textures.push(tex);
    }
    return textures;
  }

  // Render crisp 48x48 UI icon for any item or block (True 3D isometric cube for solid blocks!)
  getItemIconUrl(itemId) {
    if (!itemId) return '';
    if (this.iconCache.has(itemId)) return this.iconCache.get(itemId);

    const def = getItemDef(itemId);
    if (!def) return '';

    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 48;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    if (def.blockId !== undefined) {
      const b = BLOCK_DEFS[def.blockId];
      if (b.renderType === 'cross' || b.renderType === 'torch') {
        const tile = this.tileCanvases.get(b.faces[0]);
        if (tile) ctx.drawImage(tile, 6, 6, 36, 36);
      } else {
        // Draw genuine shaded 3D isometric block using actual top, front, and right face tiles!
        const topTile = this.tileCanvases.get(b.faces[2]);
        const leftTile = this.tileCanvases.get(b.faces[4]);
        const rightTile = this.tileCanvases.get(b.faces[0]);

        // Top diamond
        ctx.save();
        ctx.translate(24, 6);
        ctx.transform(1.15, 0.575, -1.15, 0.575, 0, 0);
        if (topTile) ctx.drawImage(topTile, 0, 0, 16, 16);
        ctx.restore();

        // Left face
        ctx.save();
        ctx.translate(5.6, 15.2);
        ctx.transform(1.15, 0.575, 0, 1.22, 0, 0);
        if (leftTile) ctx.drawImage(leftTile, 0, 0, 16, 16);
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(0, 0, 16, 16);
        ctx.restore();

        // Right face
        ctx.save();
        ctx.translate(24, 24.4);
        ctx.transform(1.15, -0.575, 0, 1.22, 0, 0);
        if (rightTile) ctx.drawImage(rightTile, 0, 0, 16, 16);
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.fillRect(0, 0, 16, 16);
        ctx.restore();
      }
    } else {
      this.drawToolOrItemSprite(ctx, def);
    }

    const url = c.toDataURL();
    this.iconCache.set(itemId, url);
    return url;
  }

  drawToolOrItemSprite(ctx, def) {
    const px = (x, y, hex) => {
      ctx.fillStyle = hex;
      ctx.fillRect(x * 3, y * 3, 3, 3);
    };
    const head = def.color || '#d0d7e2';
    const hi = '#ffffff';
    const handle = '#8d6238';
    const handleDark = '#5d3e20';

    switch (def.sprite) {
      case 'pickaxe': {
        for (let i = 2; i <= 11; i++) {
          px(i, 15 - i, i % 2 === 0 ? handle : handleDark);
        }
        const arc = [
          [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 3], [10, 3],
          [11, 4], [12, 5], [13, 6], [13, 7], [13, 8], [13, 9], [13, 10],
          [6, 3], [7, 3], [8, 3], [9, 4], [10, 5], [11, 6], [12, 7], [12, 8],
        ];
        for (const [x, y] of arc) px(x, y, head);
        px(6, 2, hi);
        px(7, 2, hi);
        break;
      }
      case 'axe': {
        for (let i = 2; i <= 12; i++) px(i, 15 - i, i % 2 === 0 ? handle : handleDark);
        const blade = [
          [6, 2], [7, 2], [8, 2],
          [5, 3], [6, 3], [7, 3], [8, 3], [9, 3],
          [5, 4], [6, 4], [7, 4], [8, 4], [9, 4],
          [6, 5], [7, 5], [8, 5], [10, 5],
          [7, 6], [8, 6], [11, 6],
        ];
        for (const [x, y] of blade) px(x, y, head);
        px(6, 2, hi);
        break;
      }
      case 'shovel': {
        for (let i = 2; i <= 10; i++) px(i, 15 - i, i % 2 === 0 ? handle : handleDark);
        for (let x = 9; x <= 13; x++) {
          for (let y = 2; y <= 6; y++) {
            if (x + y >= 13 && x + y <= 18) px(x, y, head);
          }
        }
        px(11, 3, hi);
        break;
      }
      case 'sword': {
        px(2, 13, handleDark);
        px(3, 12, handle);
        px(4, 11, handle);
        // Guard
        px(3, 9, '#c7a246');
        px(4, 10, '#c7a246');
        px(5, 11, '#c7a246');
        px(6, 12, '#c7a246');
        // Blade
        for (let i = 5; i <= 13; i++) {
          px(i, 15 - i, head);
          if (i < 13) px(i, 16 - i, head);
        }
        px(9, 6, hi);
        px(11, 4, hi);
        break;
      }
      case 'stick': {
        for (let i = 3; i <= 12; i++) {
          px(i, 15 - i, handle);
          if (i % 2 === 0) px(i + 1, 15 - i, handleDark);
        }
        break;
      }
      case 'ingot': {
        for (let y = 5; y <= 10; y++) {
          const inset = Math.floor((y - 5) * 0.4);
          for (let x = 3 + inset; x <= 12 - inset; x++) {
            px(x, y, y === 6 && x < 9 ? hi : head);
          }
        }
        break;
      }
      case 'gem':
      case 'coal': {
        for (let y = 3; y <= 12; y++) {
          for (let x = 4; x <= 11; x++) {
            const d = Math.hypot(x - 7.5, y - 7.5);
            if (d < 4.2) px(x, y, x < 7 && y < 7 && def.sprite === 'gem' ? hi : head);
          }
        }
        break;
      }
      case 'apple': {
        px(8, 2, handle);
        px(9, 3, '#52b846');
        for (let y = 4; y <= 12; y++) {
          for (let x = 4; x <= 11; x++) {
            if (Math.hypot(x - 7.5, y - 8) < 4.3) px(x, y, x === 6 && y === 6 ? '#ff9994' : head);
          }
        }
        break;
      }
      case 'bread': {
        for (let y = 6; y <= 11; y++) {
          for (let x = 2; x <= 13; x++) {
            if (Math.hypot((x - 7.5) * 0.65, y - 8.5) < 3.6) {
              px(x, y, y <= 7 ? '#f2ba5c' : head);
            }
          }
        }
        break;
      }
      case 'meat': {
        for (let y = 4; y <= 12; y++) {
          for (let x = 3; x <= 12; x++) {
            if (Math.hypot((x - 7.5) * 0.85, y - 8) < 4.3) {
              px(x, y, x === 6 && y === 7 ? '#f7d6c4' : head);
            }
          }
        }
        break;
      }
      case 'bucket':
      case 'bucket_water': {
        for (let y = 4; y <= 12; y++) {
          const half = y < 8 ? 4 : 3;
          for (let x = 8 - half; x <= 7 + half; x++) {
            if (y <= 6 && def.sprite === 'bucket_water' && x > 8 - half && x < 7 + half) {
              px(x, y, '#3898ff');
            } else {
              px(x, y, x < 7 ? '#dce4f0' : '#9aa6b8');
            }
          }
        }
        break;
      }
      default: {
        for (let y = 4; y <= 11; y++) {
          for (let x = 4; x <= 11; x++) px(x, y, head);
        }
      }
    }
  }
}
