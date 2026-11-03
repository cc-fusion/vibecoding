import * as THREE from 'three';
import { BLOCK, REGISTRY } from './blocks.js';
import { createRng } from './noise.js';

const ATLAS_COLS = 8;
const ATLAS_ROWS = 8;
const TILE_INNER = 16;
const TILE_PAD = 8;
const CELL_SIZE = TILE_INNER + TILE_PAD * 2; // 32
const ATLAS_WIDTH = ATLAS_COLS * CELL_SIZE;  // 256
const ATLAS_HEIGHT = ATLAS_ROWS * CELL_SIZE; // 256

function clamp(v, lo = 0, hi = 255) {
  return v < lo ? lo : v > hi ? hi : Math.round(v);
}

function makeTileCanvas() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  return c;
}

function setPx(data, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
  const idx = (y * 16 + x) * 4;
  data[idx] = clamp(r);
  data[idx + 1] = clamp(g);
  data[idx + 2] = clamp(b);
  data[idx + 3] = clamp(a);
}

function fillNoise(ctx, seed, baseRGB, variance = 16, speckles = null) {
  const rng = createRng(seed);
  const img = ctx.createImageData(16, 16);
  const d = img.data;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = (rng() - 0.5) * 2 * variance;
      let r = baseRGB[0] + n;
      let g = baseRGB[1] + n;
      let b = baseRGB[2] + n;
      if (speckles && rng() < speckles.chance) {
        r += speckles.delta[0];
        g += speckles.delta[1];
        b += speckles.delta[2];
      }
      setPx(d, x, y, r, g, b, 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return img;
}

function drawOreFlecks(ctx, seed, fleckColors) {
  const rng = createRng(seed);
  const img = ctx.getImageData(0, 0, 16, 16);
  const d = img.data;
  const spots = [
    [3, 4], [4, 4], [3, 5],
    [10, 3], [11, 3], [11, 4],
    [6, 9], [7, 9], [7, 10], [6, 10],
    [12, 11], [13, 11], [12, 12],
    [2, 12], [3, 13],
  ];
  for (const [bx, by] of spots) {
    const ox = bx + (rng() > 0.65 ? 1 : 0);
    const oy = by + (rng() > 0.65 ? -1 : 0);
    const col = fleckColors[Math.floor(rng() * fleckColors.length)];
    setPx(d, ox % 15, (oy + 16) % 15, col[0], col[1], col[2], 255);
  }
  ctx.putImageData(img, 0, 0);
}

function paintAllTiles() {
  const tiles = {};
  const create = (name, painter) => {
    const c = makeTileCanvas();
    const ctx = c.getContext('2d');
    painter(ctx, c);
    tiles[name] = c;
  };

  // Grass Top (neutral bright textured blades, tinted per biome in mesher)
  create('grass_top', (ctx) => {
    const rng = createRng(101);
    const img = ctx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const v = 212 + (rng() - 0.5) * 42;
        const blade = (x + y * 2) % 5 === 0 ? 12 : 0;
        setPx(img.data, x, y, v - 6, v + blade, v - 10, 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  // Dirt
  create('dirt', (ctx) => {
    fillNoise(ctx, 102, [132, 92, 60], 16, { chance: 0.14, delta: [-22, -18, -14] });
  });

  // Grass Side
  create('grass_side', (ctx) => {
    ctx.drawImage(tiles.dirt, 0, 0);
    const rng = createRng(103);
    const img = ctx.getImageData(0, 0, 16, 16);
    for (let x = 0; x < 16; x++) {
      const overhang = 3 + Math.floor(rng() * 3.6);
      for (let y = 0; y < overhang; y++) {
        const shade = (rng() - 0.5) * 24 - y * 3;
        setPx(img.data, x, y, 88 + shade, 168 + shade, 64 + shade, 255);
      }
      // Subtle dark shadow just below grass lip
      setPx(img.data, x, overhang, 98, 66, 42, 255);
    }
    ctx.putImageData(img, 0, 0);
  });

  // Snowy Grass Side
  create('snow_grass_side', (ctx) => {
    ctx.drawImage(tiles.dirt, 0, 0);
    const rng = createRng(104);
    const img = ctx.getImageData(0, 0, 16, 16);
    for (let x = 0; x < 16; x++) {
      const overhang = 3 + Math.floor(rng() * 4);
      for (let y = 0; y < overhang; y++) {
        const s = 238 + (rng() - 0.5) * 16;
        setPx(img.data, x, y, s - 4, s, s + 6, 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  // Stone
  create('stone', (ctx) => {
    const rng = createRng(105);
    const img = ctx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const streak = Math.sin(y * 0.9 + x * 0.25) * 8;
        const v = 126 + streak + (rng() - 0.5) * 20;
        setPx(img.data, x, y, v, v + 1, v + 4, 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  // Cobblestone
  create('cobblestone', (ctx) => {
    fillNoise(ctx, 106, [116, 116, 120], 20);
    const img = ctx.getImageData(0, 0, 16, 16);
    const mortar = [
      [0, 4], [1, 4], [2, 5], [3, 5], [4, 4], [5, 3], [6, 3], [7, 4],
      [8, 5], [9, 5], [10, 4], [11, 4], [12, 5], [13, 5], [14, 4], [15, 4],
      [4, 0], [4, 1], [5, 2], [11, 0], [11, 1], [10, 2], [10, 3],
      [0, 10], [1, 11], [2, 11], [3, 10], [4, 9], [5, 9], [6, 10], [7, 11],
      [8, 11], [9, 10], [10, 9], [11, 9], [12, 10], [13, 11], [14, 11], [15, 10],
      [7, 5], [7, 6], [7, 7], [7, 8], [13, 6], [13, 7], [13, 8], [2, 6], [2, 7],
      [5, 12], [5, 13], [5, 14], [5, 15], [11, 12], [11, 13], [11, 14], [11, 15],
    ];
    for (const [x, y] of mortar) {
      setPx(img.data, x, y, 68, 69, 73, 255);
      setPx(img.data, (x + 1) % 16, (y + 1) % 16, 146, 146, 150, 255);
    }
    ctx.putImageData(img, 0, 0);
  });

  // Bedrock
  create('bedrock', (ctx) => {
    fillNoise(ctx, 107, [54, 54, 58], 34, { chance: 0.25, delta: [-26, -26, -26] });
  });

  // Sand
  create('sand', (ctx) => {
    const rng = createRng(108);
    const img = ctx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const wave = Math.sin((x + y * 2) * 0.5) * 6;
        const n = (rng() - 0.5) * 16 + wave;
        setPx(img.data, x, y, 224 + n, 206 + n, 150 + n, 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  // Sandstone
  create('sandstone_top', (ctx) => {
    fillNoise(ctx, 109, [218, 198, 142], 12);
  });
  create('sandstone_bottom', (ctx) => {
    fillNoise(ctx, 110, [196, 174, 120], 16);
  });
  create('sandstone_side', (ctx) => {
    fillNoise(ctx, 111, [212, 190, 134], 10);
    const img = ctx.getImageData(0, 0, 16, 16);
    for (let x = 0; x < 16; x++) {
      setPx(img.data, x, 3, 232, 214, 162, 255);
      setPx(img.data, x, 4, 182, 160, 108, 255);
      setPx(img.data, x, 11, 186, 164, 110, 255);
    }
    ctx.putImageData(img, 0, 0);
  });

  // Gravel & Clay
  create('gravel', (ctx) => {
    fillNoise(ctx, 112, [132, 126, 124], 26, { chance: 0.2, delta: [22, 18, 16] });
  });
  create('clay', (ctx) => {
    fillNoise(ctx, 113, [156, 164, 178], 14, { chance: 0.15, delta: [-14, -12, -8] });
  });

  // Snow & Ice
  create('snow', (ctx) => {
    fillNoise(ctx, 114, [242, 247, 252], 9, { chance: 0.1, delta: [-10, -6, 4] });
  });
  create('ice', (ctx) => {
    const rng = createRng(115);
    const img = ctx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const diag = (x + y === 10 || x + y === 11 || x - y === 5) ? 24 : 0;
        const n = (rng() - 0.5) * 10;
        setPx(img.data, x, y, 145 + diag + n, 198 + diag + n, 246 + n, 218);
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  // Ores
  create('coal_ore', (ctx) => {
    ctx.drawImage(tiles.stone, 0, 0);
    drawOreFlecks(ctx, 201, [[28, 28, 32], [44, 44, 50], [18, 18, 22]]);
  });
  create('iron_ore', (ctx) => {
    ctx.drawImage(tiles.stone, 0, 0);
    drawOreFlecks(ctx, 202, [[216, 175, 142], [192, 144, 112], [234, 198, 168]]);
  });
  create('gold_ore', (ctx) => {
    ctx.drawImage(tiles.stone, 0, 0);
    drawOreFlecks(ctx, 203, [[250, 214, 58], [228, 176, 32], [255, 240, 128]]);
  });
  create('diamond_ore', (ctx) => {
    ctx.drawImage(tiles.stone, 0, 0);
    drawOreFlecks(ctx, 204, [[74, 242, 238], [42, 204, 218], [185, 255, 255]]);
  });
  create('crystal_ore', (ctx) => {
    ctx.drawImage(tiles.stone, 0, 0);
    drawOreFlecks(ctx, 205, [[214, 118, 255], [244, 176, 255], [164, 78, 238]]);
  });

  // Wood Logs
  const paintLogTop = (ctx, ringDark, ringLight, bark) => {
    const img = ctx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const edge = x === 0 || x === 15 || y === 0 || y === 15;
        if (edge) {
          setPx(img.data, x, y, bark[0], bark[1], bark[2], 255);
        } else {
          const dist = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
          const col = Math.floor(dist) % 2 === 0 ? ringLight : ringDark;
          setPx(img.data, x, y, col[0], col[1], col[2], 255);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  };

  create('oak_log_top', (ctx) => paintLogTop(ctx, [162, 128, 78], [188, 152, 98], [98, 74, 44]));
  create('oak_log_side', (ctx) => {
    const rng = createRng(301);
    const img = ctx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const groove = x % 4 === 0 ? -18 : (x % 4 === 2 ? 8 : 0);
        const n = (rng() - 0.5) * 16 + groove;
        setPx(img.data, x, y, 108 + n, 82 + n, 48 + n, 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  create('spruce_log_top', (ctx) => paintLogTop(ctx, [122, 92, 56], [148, 114, 72], [62, 44, 28]));
  create('spruce_log_side', (ctx) => {
    const rng = createRng(302);
    const img = ctx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const groove = x % 3 === 0 ? -14 : 6;
        const n = (rng() - 0.5) * 14 + groove;
        setPx(img.data, x, y, 68 + n, 48 + n, 32 + n, 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  create('birch_log_top', (ctx) => paintLogTop(ctx, [196, 180, 134], [218, 204, 158], [216, 212, 204]));
  create('birch_log_side', (ctx) => {
    fillNoise(ctx, 303, [226, 222, 214], 10);
    const img = ctx.getImageData(0, 0, 16, 16);
    const knots = [
      [2, 3], [3, 3], [4, 3],
      [10, 6], [11, 6], [12, 6], [11, 7],
      [4, 11], [5, 11], [6, 11],
      [12, 14], [13, 14],
    ];
    for (const [x, y] of knots) setPx(img.data, x, y, 58, 56, 52, 255);
    ctx.putImageData(img, 0, 0);
  });

  // Leaves (alpha cutout holes for lush dappled canopy light!)
  const paintLeaves = (ctx, seed, baseVal) => {
    const rng = createRng(seed);
    const img = ctx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const hole = rng() < 0.16 && x > 0 && x < 15 && y > 0 && y < 15;
        if (hole) {
          setPx(img.data, x, y, 0, 0, 0, 0);
        } else {
          const v = baseVal + (rng() - 0.5) * 52;
          setPx(img.data, x, y, v, v + 12, v - 8, 255);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  };
  create('oak_leaves', (ctx) => paintLeaves(ctx, 310, 208));
  create('spruce_leaves', (ctx) => paintLeaves(ctx, 311, 186));
  create('birch_leaves', (ctx) => paintLeaves(ctx, 312, 220));

  // Cactus
  create('cactus_top', (ctx) => {
    fillNoise(ctx, 320, [82, 148, 58], 14);
  });
  create('cactus_side', (ctx) => {
    const rng = createRng(321);
    const img = ctx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const rib = x % 4 === 0 ? -18 : (x % 4 === 2 ? 12 : 0);
        const n = (rng() - 0.5) * 10 + rib;
        setPx(img.data, x, y, 68 + n, 138 + n, 48 + n, 255);
        if ((x === 2 || x === 6 || x === 10 || x === 14) && (y === 3 || y === 9 || y === 13)) {
          setPx(img.data, x, y, 226, 222, 168, 255);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  // Crossed Flora
  create('tall_grass', (ctx) => {
    const rng = createRng(330);
    const img = ctx.createImageData(16, 16);
    const stalks = [2, 4, 6, 8, 10, 12, 13];
    for (const sx of stalks) {
      const topY = 4 + Math.floor(rng() * 5);
      let cx = sx;
      for (let y = 15; y >= topY; y--) {
        if (y < 10 && rng() < 0.3) cx += rng() < 0.5 ? -1 : 1;
        const b = 198 + (15 - y) * 3;
        setPx(img.data, clamp(cx, 1, 14), y, b - 10, b + 14, b - 14, 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  create('red_flower', (ctx) => {
    const img = ctx.createImageData(16, 16);
    for (let y = 9; y < 16; y++) setPx(img.data, 7 + (y > 12 ? 1 : 0), y, 54, 138, 46, 255);
    setPx(img.data, 6, 12, 58, 148, 48, 255);
    setPx(img.data, 9, 11, 58, 148, 48, 255);
    const petals = [
      [6, 5], [7, 5], [8, 5],
      [5, 6], [6, 6], [8, 6], [9, 6],
      [5, 7], [6, 7], [8, 7], [9, 7],
      [6, 8], [7, 8], [8, 8],
    ];
    for (const [x, y] of petals) setPx(img.data, x, y, 232, 44, 52, 255);
    setPx(img.data, 7, 6, 250, 206, 54, 255);
    setPx(img.data, 7, 7, 48, 28, 24, 255);
    ctx.putImageData(img, 0, 0);
  });

  create('yellow_flower', (ctx) => {
    const img = ctx.createImageData(16, 16);
    for (let y = 9; y < 16; y++) setPx(img.data, 7, y, 58, 146, 48, 255);
    setPx(img.data, 6, 13, 58, 148, 48, 255);
    setPx(img.data, 8, 12, 58, 148, 48, 255);
    for (let y = 5; y <= 8; y++) {
      for (let x = 5; x <= 9; x++) {
        if ((x === 5 || x === 9) && (y === 5 || y === 8)) continue;
        setPx(img.data, x, y, 250, 218, 42, 255);
      }
    }
    setPx(img.data, 7, 6, 255, 245, 138, 255);
    ctx.putImageData(img, 0, 0);
  });

  create('glow_shroom', (ctx) => {
    const img = ctx.createImageData(16, 16);
    for (let y = 10; y < 16; y++) {
      setPx(img.data, 7, y, 185, 224, 232, 255);
      setPx(img.data, 8, y, 160, 204, 214, 255);
    }
    for (let y = 5; y <= 9; y++) {
      const half = y === 5 ? 2 : (y === 6 ? 3 : 4);
      for (let x = 7 - half; x <= 8 + half; x++) {
        const spot = (x + y) % 4 === 0;
        setPx(
          img.data,
          x,
          y,
          spot ? 185 : 54,
          spot ? 255 : 228,
          spot ? 255 : 212,
          255
        );
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  // Water & Lava
  create('water', (ctx) => {
    const rng = createRng(340);
    const img = ctx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const ripple = Math.sin((x + y) * 0.8) * 14 + (rng() - 0.5) * 10;
        setPx(img.data, x, y, 36 + ripple * 0.6, 118 + ripple, 222 + ripple, 188);
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  create('lava', (ctx) => {
    const rng = createRng(341);
    const img = ctx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const swirl = Math.sin(x * 0.6) * Math.cos(y * 0.6) * 35 + (rng() - 0.5) * 20;
        setPx(img.data, x, y, 245, 112 + swirl * 1.4, 18 + Math.max(0, swirl), 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  // Planks
  const paintPlanks = (ctx, seed, base) => {
    const rng = createRng(seed);
    const img = ctx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) {
      const seamY = y % 4 === 3;
      const jointX = (Math.floor(y / 4) % 2 === 0) ? 7 : 13;
      for (let x = 0; x < 16; x++) {
        const seam = seamY || x === jointX;
        const n = (rng() - 0.5) * 14 + (seam ? -28 : 0);
        setPx(img.data, x, y, base[0] + n, base[1] + n, base[2] + n, 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  };
  create('oak_planks', (ctx) => paintPlanks(ctx, 350, [182, 144, 88]));
  create('spruce_planks', (ctx) => paintPlanks(ctx, 351, [126, 92, 56]));
  create('birch_planks', (ctx) => paintPlanks(ctx, 352, [214, 198, 146]));

  // Crafting Table
  create('crafting_top', (ctx) => {
    ctx.drawImage(tiles.oak_planks, 0, 0);
    const img = ctx.getImageData(0, 0, 16, 16);
    for (let i = 0; i < 16; i++) {
      setPx(img.data, i, 0, 92, 66, 36, 255);
      setPx(img.data, i, 15, 92, 66, 36, 255);
      setPx(img.data, 0, i, 92, 66, 36, 255);
      setPx(img.data, 15, i, 92, 66, 36, 255);
    }
    for (let y = 2; y <= 13; y++) {
      for (let x = 2; x <= 13; x++) {
        if (x === 2 || x === 6 || x === 9 || x === 13 || y === 2 || y === 6 || y === 9 || y === 13) {
          setPx(img.data, x, y, 86, 56, 30, 255);
        } else {
          setPx(img.data, x, y, 164, 118, 68, 255);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  create('crafting_side', (ctx) => {
    ctx.drawImage(tiles.oak_planks, 0, 0);
    const img = ctx.getImageData(0, 0, 16, 16);
    for (let x = 0; x < 16; x++) {
      setPx(img.data, x, 0, 98, 68, 38, 255);
      setPx(img.data, x, 1, 128, 88, 48, 255);
    }
    // Mini saw & hammer silhouette
    for (let y = 5; y <= 11; y++) {
      setPx(img.data, 4, y, 185, 192, 202, 255);
      setPx(img.data, 5, y, 152, 158, 168, 255);
      setPx(img.data, 11, y, 112, 78, 42, 255);
    }
    setPx(img.data, 10, 5, 190, 196, 206, 255);
    setPx(img.data, 11, 5, 190, 196, 206, 255);
    setPx(img.data, 12, 5, 190, 196, 206, 255);
    ctx.putImageData(img, 0, 0);
  });

  // Furnace
  create('furnace_top', (ctx) => {
    fillNoise(ctx, 360, [118, 118, 124], 14);
    const img = ctx.getImageData(0, 0, 16, 16);
    for (let i = 1; i < 15; i++) {
      setPx(img.data, i, 1, 78, 78, 84, 255);
      setPx(img.data, i, 14, 78, 78, 84, 255);
      setPx(img.data, 1, i, 78, 78, 84, 255);
      setPx(img.data, 14, i, 78, 78, 84, 255);
    }
    ctx.putImageData(img, 0, 0);
  });
  create('furnace_side', (ctx) => {
    ctx.drawImage(tiles.cobblestone, 0, 0);
    const img = ctx.getImageData(0, 0, 16, 16);
    for (let x = 0; x < 16; x++) {
      setPx(img.data, x, 0, 86, 86, 92, 255);
      setPx(img.data, x, 15, 76, 76, 82, 255);
    }
    ctx.putImageData(img, 0, 0);
  });
  create('furnace_front', (ctx) => {
    ctx.drawImage(tiles.furnace_side, 0, 0);
    const img = ctx.getImageData(0, 0, 16, 16);
    for (let y = 4; y <= 13; y++) {
      for (let x = 4; x <= 11; x++) {
        if (y === 8) {
          setPx(img.data, x, y, 72, 72, 78, 255);
        } else if (y > 8) {
          // Warm glowing ember grate!
          const glow = (x + y) % 2 === 0;
          setPx(img.data, x, y, glow ? 248 : 196, glow ? 142 : 76, 28, 255);
        } else {
          setPx(img.data, x, y, 36, 34, 38, 255);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  // Torch & Lantern
  create('torch', (ctx) => {
    const img = ctx.createImageData(16, 16);
    for (let y = 6; y < 16; y++) {
      setPx(img.data, 7, y, 162, 122, 68, 255);
      setPx(img.data, 8, y, 134, 98, 52, 255);
    }
    // Flame head
    setPx(img.data, 7, 5, 255, 165, 36, 255);
    setPx(img.data, 8, 5, 255, 145, 28, 255);
    setPx(img.data, 7, 4, 255, 238, 120, 255);
    setPx(img.data, 8, 4, 255, 220, 88, 255);
    setPx(img.data, 7, 3, 255, 252, 200, 255);
    setPx(img.data, 8, 3, 255, 240, 160, 255);
    ctx.putImageData(img, 0, 0);
  });

  create('lantern_top', (ctx) => {
    fillNoise(ctx, 370, [68, 72, 82], 10);
  });
  create('lantern_side', (ctx) => {
    fillNoise(ctx, 371, [64, 68, 78], 8);
    const img = ctx.getImageData(0, 0, 16, 16);
    for (let y = 3; y <= 12; y++) {
      for (let x = 3; x <= 12; x++) {
        const center = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        if (center < 2.2) {
          setPx(img.data, x, y, 255, 246, 186, 255);
        } else {
          setPx(img.data, x, y, 252, 192, 74, 255);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  // Glass
  create('glass', (ctx) => {
    const img = ctx.createImageData(16, 16);
    for (let i = 0; i < 16; i++) {
      setPx(img.data, i, 0, 212, 242, 252, 255);
      setPx(img.data, i, 15, 186, 224, 240, 255);
      setPx(img.data, 0, i, 212, 242, 252, 255);
      setPx(img.data, 15, i, 186, 224, 240, 255);
    }
    // Crisp specular shine streaks
    setPx(img.data, 3, 3, 240, 252, 255, 255);
    setPx(img.data, 4, 3, 240, 252, 255, 255);
    setPx(img.data, 3, 4, 240, 252, 255, 255);
    setPx(img.data, 11, 11, 225, 246, 255, 255);
    setPx(img.data, 12, 11, 225, 246, 255, 255);
    ctx.putImageData(img, 0, 0);
  });

  // Bricks & Stone Bricks
  create('bricks', (ctx) => {
    const rng = createRng(380);
    const img = ctx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) {
      const mortarY = y % 4 === 3;
      const mortarX = (Math.floor(y / 4) % 2 === 0) ? 7 : 15;
      for (let x = 0; x < 16; x++) {
        if (mortarY || x === mortarX || (Math.floor(y / 4) % 2 === 1 && x === 3)) {
          setPx(img.data, x, y, 206, 198, 188, 255);
        } else {
          const n = (rng() - 0.5) * 20;
          setPx(img.data, x, y, 178 + n, 76 + n * 0.6, 62 + n * 0.5, 255);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  create('stone_bricks', (ctx) => {
    const rng = createRng(381);
    const img = ctx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) {
      const mortarY = y === 7 || y === 15;
      const mortarX = y < 7 ? 7 : 15;
      for (let x = 0; x < 16; x++) {
        if (mortarY || x === mortarX) {
          setPx(img.data, x, y, 74, 76, 80, 255);
        } else {
          const bevel = (y === 0 || y === 8) ? 14 : 0;
          const n = (rng() - 0.5) * 14 + bevel;
          setPx(img.data, x, y, 134 + n, 136 + n, 140 + n, 255);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  // Wool, Bed, Bookshelf
  create('wool', (ctx) => {
    fillNoise(ctx, 390, [242, 238, 230], 14);
  });
  create('bed_top', (ctx) => {
    const img = ctx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (y < 5) {
          setPx(img.data, x, y, 242, 240, 234, 255);
        } else if (y === 5) {
          setPx(img.data, x, y, 218, 214, 206, 255);
        } else {
          setPx(img.data, x, y, 198, 46, 52, 255);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  create('bed_side', (ctx) => {
    ctx.drawImage(tiles.oak_planks, 0, 0);
    const img = ctx.getImageData(0, 0, 16, 16);
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 16; x++) {
        if (x < 4) setPx(img.data, x, y, 240, 238, 232, 255);
        else setPx(img.data, x, y, 196, 44, 50, 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  create('bookshelf', (ctx) => {
    ctx.drawImage(tiles.oak_planks, 0, 0);
    const img = ctx.getImageData(0, 0, 16, 16);
    const bookColors = [
      [182, 48, 48], [46, 118, 178], [56, 148, 72], [198, 154, 46], [134, 68, 168],
    ];
    for (const rowStart of [3, 10]) {
      for (let x = 1; x < 15; x++) {
        const bc = bookColors[Math.floor(x / 3) % bookColors.length];
        const spine = x % 3 === 0 ? -24 : 0;
        for (let y = rowStart; y < rowStart + 4; y++) {
          setPx(img.data, x, y, bc[0] + spine, bc[1] + spine, bc[2] + spine, 255);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  return tiles;
}

function extrudeTileIntoAtlas(atlasCtx, tileCanvas, col, row) {
  const ox = col * CELL_SIZE + TILE_PAD;
  const oy = row * CELL_SIZE + TILE_PAD;
  atlasCtx.drawImage(tileCanvas, ox, oy);

  // Extrude top & bottom rows by TILE_PAD
  for (let p = 1; p <= TILE_PAD; p++) {
    atlasCtx.drawImage(tileCanvas, 0, 0, 16, 1, ox, oy - p, 16, 1);
    atlasCtx.drawImage(tileCanvas, 0, 15, 16, 1, ox, oy + 15 + p, 16, 1);
  }
  // Extrude left & right columns (including corners!)
  for (let p = 1; p <= TILE_PAD; p++) {
    atlasCtx.drawImage(
      atlasCtx.canvas,
      ox,
      oy - TILE_PAD,
      1,
      CELL_SIZE,
      ox - p,
      oy - TILE_PAD,
      1,
      CELL_SIZE
    );
    atlasCtx.drawImage(
      atlasCtx.canvas,
      ox + 15,
      oy - TILE_PAD,
      1,
      CELL_SIZE,
      ox + 15 + p,
      oy - TILE_PAD,
      1,
      CELL_SIZE
    );
  }
}

function renderIsometricBlockIcon(def, tiles) {
  const size = 48;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  if (def.renderType === 'cross' || def.renderType === 'torch') {
    const texName = def.textures?.all || 'grass_top';
    const src = tiles[texName] || tiles.stone;
    ctx.drawImage(src, 6, 6, 36, 36);
    if (def.tintType) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(92, 198, 72, 0.35)';
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'source-over';
    }
    return c.toDataURL();
  }

  const topTex = tiles[def.textures?.top || def.textures?.all] || tiles.stone;
  const leftTex = tiles[def.textures?.front || def.textures?.side || def.textures?.all] || tiles.stone;
  const rightTex = tiles[def.textures?.side || def.textures?.all] || tiles.stone;

  // Prepare tinted top if grass/leaf
  const makeTinted = (src, rMul, gMul, bMul) => {
    const tc = makeTileCanvas();
    const tctx = tc.getContext('2d');
    tctx.drawImage(src, 0, 0);
    const img = tctx.getImageData(0, 0, 16, 16);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = clamp(img.data[i] * rMul);
      img.data[i + 1] = clamp(img.data[i + 1] * gMul);
      img.data[i + 2] = clamp(img.data[i + 2] * bMul);
    }
    tctx.putImageData(img, 0, 0);
    return tc;
  };

  let topCanvas = topTex;
  let leftCanvas = leftTex;
  let rightCanvas = rightTex;

  if (def.tintType === 'grass_top') {
    topCanvas = makeTinted(topTex, 0.50, 0.84, 0.38);
  } else if (def.tintType === 'leaf') {
    topCanvas = makeTinted(topTex, 0.42, 0.78, 0.34);
    leftCanvas = makeTinted(leftTex, 0.36, 0.68, 0.29);
    rightCanvas = makeTinted(rightTex, 0.29, 0.56, 0.24);
  } else {
    leftCanvas = makeTinted(leftTex, 0.86, 0.86, 0.88);
    rightCanvas = makeTinted(rightTex, 0.68, 0.68, 0.72);
  }

  // Isometric transforms onto 48x48 icon
  ctx.save();
  ctx.translate(24, 6);
  ctx.transform(1.12, 0.56, -1.12, 0.56, 0, 0);
  ctx.drawImage(topCanvas, 0, 0, 16, 16);
  ctx.restore();

  ctx.save();
  ctx.translate(6.1, 15.0);
  ctx.transform(1.12, 0.56, 0, 1.22, 0, 0);
  ctx.drawImage(leftCanvas, 0, 0, 16, 16);
  ctx.restore();

  ctx.save();
  ctx.translate(24.0, 24.0);
  ctx.transform(1.12, -0.56, 0, 1.22, 0, 0);
  ctx.drawImage(rightCanvas, 0, 0, 16, 16);
  ctx.restore();

  return c.toDataURL();
}

function renderItemPixelSprite(iconName) {
  const c = makeTileCanvas();
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(16, 16);
  const d = img.data;
  const px = (x, y, col) => setPx(d, x, y, col[0], col[1], col[2], 255);

  const HANDLE = [142, 98, 52];
  const HANDLE_DARK = [104, 70, 36];
  const TIER_COLORS = {
    wood: [[182, 138, 78], [146, 106, 56], [206, 164, 102]],
    stone: [[148, 150, 156], [108, 110, 116], [182, 184, 190]],
    iron: [[224, 228, 236], [172, 178, 190], [250, 252, 255]],
    diamond: [[68, 236, 232], [36, 182, 192], [188, 255, 255]],
  };

  const drawHandle = (len = 10) => {
    for (let i = 2; i < 2 + len; i++) {
      px(i, 15 - i, HANDLE);
      if (i < 11) px(i + 1, 15 - i, HANDLE_DARK);
    }
  };

  if (iconName.endsWith('_pickaxe')) {
    const tier = iconName.split('_')[0];
    const [mid, dark, hi] = TIER_COLORS[tier];
    drawHandle(10);
    const head = [
      [8, 2, hi], [9, 2, hi], [10, 2, mid], [11, 3, mid], [12, 4, mid], [13, 5, dark], [13, 6, dark],
      [7, 3, mid], [9, 3, mid], [10, 3, hi], [11, 4, hi], [12, 5, mid],
    ];
    for (const [x, y, col] of head) px(x, y, col);
  } else if (iconName.endsWith('_axe')) {
    const tier = iconName.split('_')[0];
    const [mid, dark, hi] = TIER_COLORS[tier];
    drawHandle(10);
    const head = [
      [8, 2, hi], [9, 2, hi], [10, 2, mid],
      [7, 3, hi], [8, 3, mid], [9, 3, mid], [10, 3, dark], [11, 4, dark],
      [7, 4, mid], [8, 4, mid], [9, 4, dark],
      [8, 5, dark],
    ];
    for (const [x, y, col] of head) px(x, y, col);
  } else if (iconName.endsWith('_shovel')) {
    const tier = iconName.split('_')[0];
    const [mid, dark, hi] = TIER_COLORS[tier];
    drawHandle(9);
    const head = [
      [10, 2, hi], [11, 2, hi], [12, 2, mid],
      [10, 3, hi], [11, 3, mid], [12, 3, mid], [13, 3, dark],
      [10, 4, mid], [11, 4, mid], [12, 4, dark], [13, 4, dark],
      [11, 5, dark], [12, 5, dark],
    ];
    for (const [x, y, col] of head) px(x, y, col);
  } else if (iconName.endsWith('_sword')) {
    const tier = iconName.split('_')[0];
    const [mid, dark, hi] = TIER_COLORS[tier];
    px(2, 13, HANDLE_DARK);
    px(3, 12, HANDLE);
    px(4, 11, HANDLE);
    // Crossguard
    px(4, 9, dark); px(5, 10, mid); px(6, 11, dark); px(3, 8, hi); px(7, 12, dark);
    for (let i = 0; i < 8; i++) {
      px(6 + i, 9 - i, hi);
      px(7 + i, 9 - i, mid);
      if (i < 7) px(7 + i, 10 - i, dark);
    }
  } else if (iconName === 'stick') {
    drawHandle(11);
  } else if (iconName === 'coal' || iconName === 'flint') {
    const col = iconName === 'coal' ? [42, 42, 48] : [68, 70, 78];
    const hi = iconName === 'coal' ? [74, 74, 84] : [132, 136, 148];
    for (let y = 4; y <= 12; y++) {
      for (let x = 4; x <= 11; x++) {
        if ((x + y) > 7 && (x + y) < 21) px(x, y, (x < 7 && y < 8) ? hi : col);
      }
    }
  } else if (iconName === 'iron_ingot' || iconName === 'gold_ingot' || iconName === 'brick_item') {
    const map = {
      iron_ingot: [[224, 228, 236], [168, 174, 186], [250, 252, 255]],
      gold_ingot: [[248, 206, 48], [198, 144, 22], [255, 244, 148]],
      brick_item: [[188, 82, 66], [138, 54, 42], [218, 114, 96]],
    };
    const [mid, dark, hi] = map[iconName];
    for (let y = 5; y <= 10; y++) {
      for (let x = 3; x <= 12; x++) {
        px(x, y, y === 5 ? hi : (y >= 9 ? dark : mid));
      }
    }
  } else if (iconName === 'raw_iron' || iconName === 'raw_gold' || iconName === 'clay_ball') {
    const map = {
      raw_iron: [[212, 168, 134], [156, 114, 84]],
      raw_gold: [[246, 198, 48], [188, 136, 22]],
      clay_ball: [[164, 172, 188], [124, 132, 148]],
    };
    const [hi, lo] = map[iconName];
    for (let y = 4; y <= 11; y++) {
      for (let x = 4; x <= 11; x++) {
        const d2 = (x - 7.5) ** 2 + (y - 7.5) ** 2;
        if (d2 <= 13) px(x, y, x + y < 14 ? hi : lo);
      }
    }
  } else if (iconName === 'diamond' || iconName === 'crystal_shard') {
    const isDia = iconName === 'diamond';
    const hi = isDia ? [190, 255, 255] : [248, 196, 255];
    const mid = isDia ? [64, 236, 232] : [206, 108, 252];
    const lo = isDia ? [32, 174, 188] : [142, 62, 208];
    for (let y = 3; y <= 12; y++) {
      const span = y < 7 ? y - 2 : 13 - y;
      for (let x = 8 - span; x <= 7 + span; x++) {
        px(x, y, x < 7 && y < 8 ? hi : (x > 8 ? lo : mid));
      }
    }
  } else if (iconName === 'apple') {
    px(8, 2, [74, 158, 52]); px(9, 2, [74, 158, 52]);
    px(7, 3, HANDLE);
    for (let y = 4; y <= 12; y++) {
      for (let x = 4; x <= 11; x++) {
        const d2 = (x - 7.5) ** 2 + (y - 8) ** 2;
        if (d2 <= 15) px(x, y, (x < 7 && y < 7) ? [255, 118, 118] : [224, 42, 48]);
      }
    }
  } else if (iconName === 'raw_meat' || iconName === 'cooked_meat' || iconName === 'bread') {
    const map = {
      raw_meat: [[224, 92, 96], [248, 218, 214], [176, 58, 62]],
      cooked_meat: [[148, 84, 44], [198, 134, 78], [98, 52, 26]],
      bread: [[224, 172, 68], [248, 210, 116], [168, 116, 38]],
    };
    const [mid, hi, lo] = map[iconName];
    for (let y = 5; y <= 11; y++) {
      for (let x = 3; x <= 12; x++) {
        const d2 = ((x - 7.5) * 0.85) ** 2 + (y - 8) ** 2;
        if (d2 <= 13) px(x, y, y <= 6 ? hi : (y >= 10 ? lo : mid));
      }
    }
  }

  ctx.putImageData(img, 0, 0);

  // Scale cleanly to 48x48 for sharp HUD display
  const out = document.createElement('canvas');
  out.width = 48;
  out.height = 48;
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(c, 4, 4, 40, 40);
  return out.toDataURL();
}

export function buildCrackTextures() {
  const textures = [];
  for (let stage = 0; stage < 6; stage++) {
    const c = makeTileCanvas();
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(16, 16);
    const rng = createRng(900 + stage);
    const branches = 2 + stage * 2;
    for (let b = 0; b < branches; b++) {
      let cx = 8;
      let cy = 8;
      const angle = (b / branches) * Math.PI * 2 + rng() * 0.5;
      const len = 2 + stage * 1.4;
      for (let s = 0; s < len; s++) {
        cx += Math.cos(angle + (rng() - 0.5) * 0.8);
        cy += Math.sin(angle + (rng() - 0.5) * 0.8);
        setPx(img.data, Math.round(cx), Math.round(cy), 18, 18, 22, 195);
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    textures.push(tex);
  }
  return textures;
}

export function buildTextureSystem() {
  const tiles = paintAllTiles();
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = ATLAS_WIDTH;
  atlasCanvas.height = ATLAS_HEIGHT;
  const atlasCtx = atlasCanvas.getContext('2d');

  const uvMap = {};
  const tileNames = Object.keys(tiles);

  tileNames.forEach((name, idx) => {
    const col = idx % ATLAS_COLS;
    const row = Math.floor(idx / ATLAS_COLS);
    extrudeTileIntoAtlas(atlasCtx, tiles[name], col, row);

    const u0 = (col * CELL_SIZE + TILE_PAD) / ATLAS_WIDTH;
    const u1 = (col * CELL_SIZE + TILE_PAD + TILE_INNER) / ATLAS_WIDTH;
    // Canvas y=0 is top; Three.js flipY=true maps v=1 to top
    const vTop = 1.0 - (row * CELL_SIZE + TILE_PAD) / ATLAS_HEIGHT;
    const vBot = 1.0 - (row * CELL_SIZE + TILE_PAD + TILE_INNER) / ATLAS_HEIGHT;

    uvMap[name] = { u0, v0: vBot, u1, v1: vTop };
  });

  const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
  atlasTexture.magFilter = THREE.NearestFilter;
  atlasTexture.minFilter = THREE.NearestFilter;
  atlasTexture.generateMipmaps = false;
  atlasTexture.needsUpdate = true;

  // Build crisp UI icons + standalone item canvas textures for 3D held viewmodel / dropped items
  const iconUrls = {};
  const itemCanvases = {};

  for (const key of Object.keys(REGISTRY)) {
    const id = Number(key);
    if (id === BLOCK.AIR) continue;
    const def = REGISTRY[id];
    if (def.isBlock) {
      iconUrls[id] = renderIsometricBlockIcon(def, tiles);
    } else {
      const dataUrl = renderItemPixelSprite(def.icon || 'stick');
      iconUrls[id] = dataUrl;
      const imgEl = new Image();
      imgEl.src = dataUrl;
      itemCanvases[id] = imgEl;
    }
  }

  const crackTextures = buildCrackTextures();

  return {
    atlasTexture,
    uvMap,
    tiles,
    iconUrls,
    crackTextures,
  };
}
