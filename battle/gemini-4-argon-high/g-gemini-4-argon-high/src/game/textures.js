import * as THREE from 'three';
import { BLOCK, ITEM, TEX, REGISTRY } from './constants.js';

const TILE_SIZE = 16;
const ATLAS_COLS = 8;
const ATLAS_ROWS = 8;

// Deterministic PRNG for texture pixel grain
function hashPixel(x, y, seed = 1) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function shadeHex(hex, factor) {
  const r = Math.min(255, Math.max(0, Math.round(((hex >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((hex >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((hex & 255) * factor)));
  return `rgb(${r},${g},${b})`;
}

function paintTile(ctx, tileIndex, drawFn) {
  const col = tileIndex % ATLAS_COLS;
  const row = Math.floor(tileIndex / ATLAS_COLS);
  const ox = col * TILE_SIZE;
  const oy = row * TILE_SIZE;

  const setPx = (x, y, color) => {
    if (x < 0 || x >= TILE_SIZE || y < 0 || y >= TILE_SIZE) return;
    ctx.fillStyle = color;
    ctx.fillRect(ox + x, oy + y, 1, 1);
  };

  drawFn(setPx, ox, oy);
}

export function createTextureSystem() {
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = TILE_SIZE * ATLAS_COLS;
  atlasCanvas.height = TILE_SIZE * ATLAS_ROWS;
  const ctx = atlasCanvas.getContext('2d');

  // Helper for noisy base fill
  const fillNoise = (setPx, baseHex, variance, seed) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const n = (hashPixel(x, y, seed) - 0.5) * variance;
        setPx(x, y, shadeHex(baseHex, 1 + n));
      }
    }
  };

  // 0: GRASS_TOP
  paintTile(ctx, TEX.GRASS_TOP, (setPx) => {
    fillNoise(setPx, 0x5ea843, 0.22, 10);
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(hashPixel(i, 1, 11) * 16);
      const y = Math.floor(hashPixel(i, 2, 11) * 16);
      setPx(x, y, '#73bf54');
    }
  });

  // 1: GRASS_SIDE
  paintTile(ctx, TEX.GRASS_SIDE, (setPx) => {
    fillNoise(setPx, 0x7b5639, 0.24, 20);
    for (let x = 0; x < 16; x++) {
      const grassDepth = 2 + Math.floor(hashPixel(x, 0, 21) * 3);
      for (let y = 0; y < grassDepth; y++) {
        const n = (hashPixel(x, y, 22) - 0.5) * 0.18;
        setPx(x, y, shadeHex(0x5ea843, 1 + n));
      }
      setPx(x, grassDepth, shadeHex(0x4c8a35, 0.95));
    }
  });

  // 2: DIRT
  paintTile(ctx, TEX.DIRT, (setPx) => {
    fillNoise(setPx, 0x7b5639, 0.26, 30);
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(hashPixel(i, 3, 31) * 16);
      const y = Math.floor(hashPixel(i, 4, 31) * 16);
      setPx(x, y, '#593d28');
    }
  });

  // 3: STONE
  paintTile(ctx, TEX.STONE, (setPx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const streak = hashPixel(Math.floor(x / 2), y, 40);
        const n = (streak - 0.5) * 0.22;
        setPx(x, y, shadeHex(0x808285, 1 + n));
      }
    }
  });

  // 4: COBBLESTONE
  paintTile(ctx, TEX.COBBLESTONE, (setPx) => {
    fillNoise(setPx, 0x6f7173, 0.32, 50);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if ((x + (y % 4) * 2) % 5 === 0 || (y + (x % 3)) % 5 === 0) {
          setPx(x, y, '#47494b');
        }
      }
    }
  });

  // 5: SAND
  paintTile(ctx, TEX.SAND, (setPx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const wave = Math.sin((x + y * 0.5) * 0.6) * 0.04;
        const n = (hashPixel(x, y, 60) - 0.5) * 0.14 + wave;
        setPx(x, y, shadeHex(0xdfd397, 1 + n));
      }
    }
  });

  // 6: SANDSTONE_SIDE
  paintTile(ctx, TEX.SANDSTONE_SIDE, (setPx) => {
    fillNoise(setPx, 0xd8ca8a, 0.14, 70);
    for (let x = 0; x < 16; x++) {
      setPx(x, 3, '#b8a86b');
      setPx(x, 4, '#eadfa8');
      setPx(x, 10, '#c2b374');
    }
  });

  // 7: SANDSTONE_TOP
  paintTile(ctx, TEX.SANDSTONE_TOP, (setPx) => {
    fillNoise(setPx, 0xe2d69b, 0.12, 80);
  });

  // 8: SNOW_GRASS_SIDE
  paintTile(ctx, TEX.SNOW_GRASS_SIDE, (setPx) => {
    fillNoise(setPx, 0x7b5639, 0.24, 90);
    for (let x = 0; x < 16; x++) {
      const depth = 3 + Math.floor(hashPixel(x, 1, 91) * 3);
      for (let y = 0; y < depth; y++) {
        setPx(x, y, y === depth - 1 ? '#cfe3ee' : '#f4f9fc');
      }
    }
  });

  // 9: SNOW
  paintTile(ctx, TEX.SNOW, (setPx) => {
    fillNoise(setPx, 0xf2f8fc, 0.08, 100);
  });

  // 10: ICE
  paintTile(ctx, TEX.ICE, (setPx) => {
    fillNoise(setPx, 0x8cbef7, 0.12, 110);
    for (let i = 0; i < 12; i++) {
      setPx(i, (i * 2) % 16, '#c7e2ff');
      setPx((i + 5) % 16, i, '#d8ebff');
    }
  });

  // 11: OAK_LOG_SIDE
  paintTile(ctx, TEX.OAK_LOG_SIDE, (setPx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const stripe = (hashPixel(x, 0, 120) - 0.5) * 0.24;
        const grain = (hashPixel(x, y, 121) - 0.5) * 0.12;
        setPx(x, y, shadeHex(0x6d5231, 1 + stripe + grain));
      }
    }
  });

  // 12: OAK_LOG_TOP
  paintTile(ctx, TEX.OAK_LOG_TOP, (setPx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dist = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        if (dist > 6.5) {
          setPx(x, y, '#6d5231');
        } else if (Math.round(dist) % 2 === 0) {
          setPx(x, y, '#b59463');
        } else {
          setPx(x, y, '#9c7c4c');
        }
      }
    }
  });

  // 13: SPRUCE_LOG_SIDE
  paintTile(ctx, TEX.SPRUCE_LOG_SIDE, (setPx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const stripe = (hashPixel(x, 0, 130) - 0.5) * 0.22;
        const grain = (hashPixel(x, y, 131) - 0.5) * 0.12;
        setPx(x, y, shadeHex(0x422d1b, 1 + stripe + grain));
      }
    }
  });

  // 14: BIRCH_LOG_SIDE
  paintTile(ctx, TEX.BIRCH_LOG_SIDE, (setPx) => {
    fillNoise(setPx, 0xe3dfd5, 0.09, 140);
    for (let y = 2; y < 15; y += 4) {
      const startX = Math.floor(hashPixel(y, 1, 141) * 11);
      for (let dx = 0; dx < 4; dx++) {
        setPx((startX + dx) % 16, y, '#383632');
      }
    }
  });

  // 15: OAK_LEAVES
  paintTile(ctx, TEX.OAK_LEAVES, (setPx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = hashPixel(x, y, 150);
        if (r < 0.22) setPx(x, y, '#255219');
        else if (r < 0.65) setPx(x, y, '#397b27');
        else setPx(x, y, '#4a9634');
      }
    }
  });

  // 16: SPRUCE_LEAVES
  paintTile(ctx, TEX.SPRUCE_LEAVES, (setPx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = hashPixel(x, y, 160);
        if (r < 0.25) setPx(x, y, '#1b3d22');
        else if (r < 0.75) setPx(x, y, '#2b5b34');
        else setPx(x, y, '#467a52');
      }
    }
  });

  // 17: CACTUS_SIDE
  paintTile(ctx, TEX.CACTUS_SIDE, (setPx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const rib = x % 4 === 0 ? -0.15 : 0.05;
        setPx(x, y, shadeHex(0x458931, 1 + rib));
        if (x % 4 === 2 && y % 5 === 2) {
          setPx(x, y, '#e6dfa8');
        }
      }
    }
  });

  // 18: CACTUS_TOP
  paintTile(ctx, TEX.CACTUS_TOP, (setPx) => {
    fillNoise(setPx, 0x529b3b, 0.14, 180);
  });

  // 19: PLANKS
  paintTile(ctx, TEX.PLANKS, (setPx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const n = (hashPixel(x, y, 190) - 0.5) * 0.12;
        let col = shadeHex(0xab8952, 1 + n);
        if (y % 4 === 0) col = '#7d6136';
        if ((y % 8 < 4 && x === 7) || (y % 8 >= 4 && x === 14)) col = '#7d6136';
        setPx(x, y, col);
      }
    }
  });

  // 20: BRICKS
  paintTile(ctx, TEX.BRICKS, (setPx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const mortarY = y % 4 === 0;
        const offset = Math.floor(y / 4) % 2 === 0 ? 0 : 4;
        const mortarX = (x + offset) % 8 === 0;
        if (mortarY || mortarX) {
          setPx(x, y, '#b8b2a6');
        } else {
          const n = (hashPixel(x, y, 200) - 0.5) * 0.18;
          setPx(x, y, shadeHex(0x9e483a, 1 + n));
        }
      }
    }
  });

  // 21: GLASS
  paintTile(ctx, TEX.GLASS, (setPx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (x === 0 || x === 15 || y === 0 || y === 15) {
          setPx(x, y, '#d9f4ff');
        } else if ((x + y === 5 || x + y === 6) && x > 1 && y > 1) {
          setPx(x, y, '#ffffff');
        } else {
          setPx(x, y, 'rgba(185, 232, 250, 0.22)');
        }
      }
    }
  });

  // Helper for Ores
  const paintOre = (tile, oreColor, highlightColor, seed) => {
    paintTile(ctx, tile, (setPx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (hashPixel(Math.floor(x / 2), y, 40) - 0.5) * 0.22;
          setPx(x, y, shadeHex(0x808285, 1 + n));
        }
      }
      const spots = [
        [3, 4], [4, 4], [4, 5],
        [10, 3], [11, 3], [10, 4],
        [5, 11], [6, 11], [6, 12],
        [11, 10], [12, 10], [11, 11],
      ];
      spots.forEach(([sx, sy], idx) => {
        setPx(sx, sy, idx % 3 === 0 ? highlightColor : oreColor);
      });
    });
  };

  paintOre(TEX.COAL_ORE, '#222426', '#3d4042', 220);
  paintOre(TEX.IRON_ORE, '#d9b193', '#f2d5be', 230);
  paintOre(TEX.GOLD_ORE, '#f5c731', '#fff282', 240);
  paintOre(TEX.DIAMOND_ORE, '#3be6d4', '#a8fff7', 250);

  // 26: CRAFT_TOP
  paintTile(ctx, TEX.CRAFT_TOP, (setPx) => {
    fillNoise(setPx, 0x9c7444, 0.12, 260);
    for (let i = 0; i < 16; i++) {
      setPx(i, 0, '#593e22');
      setPx(i, 15, '#593e22');
      setPx(0, i, '#593e22');
      setPx(15, i, '#593e22');
    }
    for (let y = 3; y <= 12; y++) {
      for (let x = 3; x <= 12; x++) {
        if (x === 3 || x === 6 || x === 9 || x === 12 || y === 3 || y === 6 || y === 9 || y === 12) {
          setPx(x, y, '#4a3219');
        }
      }
    }
  });

  // 27: CRAFT_SIDE
  paintTile(ctx, TEX.CRAFT_SIDE, (setPx) => {
    fillNoise(setPx, 0x9e7948, 0.14, 270);
    for (let x = 0; x < 16; x++) {
      setPx(x, 0, '#593e22');
      setPx(x, 1, '#593e22');
      setPx(x, 15, '#593e22');
    }
    // Tool silhouettes
    for (let y = 4; y < 12; y++) {
      setPx(4, y, '#47494b');
      setPx(5, y, '#cfd4d8');
      setPx(11, y, '#593e22');
    }
  });

  // 28: FURNACE_FRONT
  paintTile(ctx, TEX.FURNACE_FRONT, (setPx) => {
    fillNoise(setPx, 0x6b6d70, 0.22, 280);
    for (let y = 3; y < 7; y++) {
      for (let x = 4; x < 12; x++) {
        setPx(x, y, '#292b2c');
      }
    }
    for (let y = 9; y < 14; y++) {
      for (let x = 4; x < 12; x++) {
        setPx(x, y, y > 10 ? '#ff9d2e' : '#ff5519');
      }
    }
  });

  // 29: FURNACE_SIDE
  paintTile(ctx, TEX.FURNACE_SIDE, (setPx) => {
    fillNoise(setPx, 0x737578, 0.2, 290);
    for (let i = 0; i < 16; i++) {
      setPx(i, 0, '#4f5154');
      setPx(i, 15, '#4f5154');
    }
  });

  // 30: TORCH
  paintTile(ctx, TEX.TORCH, (setPx) => {
    fillNoise(setPx, 0x8f6b3e, 0.18, 300);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 16; x++) {
        setPx(x, y, y < 2 ? '#fff699' : '#ff9914');
      }
    }
  });

  // 31: WATER
  paintTile(ctx, TEX.WATER, (setPx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const wave = Math.sin((x + y) * 0.7) * 0.08;
        setPx(x, y, shadeHex(0x2874d8, 1 + wave));
      }
    }
  });

  // 32: BEDROCK
  paintTile(ctx, TEX.BEDROCK, (setPx) => {
    fillNoise(setPx, 0x2b2b2e, 0.55, 320);
  });

  // 33: TNT_SIDE
  paintTile(ctx, TEX.TNT_SIDE, (setPx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (y >= 5 && y <= 10) {
          setPx(x, y, '#f2efe9');
        } else {
          setPx(x, y, x % 4 === 0 ? '#a82216' : '#d63324');
        }
      }
    }
    // Simple pixel "TNT" marks
    setPx(3, 7, '#111'); setPx(4, 7, '#111'); setPx(5, 7, '#111'); setPx(4, 8, '#111'); setPx(4, 9, '#111');
    setPx(7, 7, '#111'); setPx(7, 8, '#111'); setPx(7, 9, '#111'); setPx(8, 8, '#111'); setPx(9, 7, '#111'); setPx(9, 9, '#111');
    setPx(11, 7, '#111'); setPx(12, 7, '#111'); setPx(13, 7, '#111'); setPx(12, 8, '#111'); setPx(12, 9, '#111');
  });

  // 34: TNT_TOP
  paintTile(ctx, TEX.TNT_TOP, (setPx) => {
    fillNoise(setPx, 0xc92c1e, 0.15, 340);
    setPx(7, 7, '#222');
    setPx(8, 7, '#eee');
    setPx(7, 8, '#eee');
    setPx(8, 8, '#222');
  });

  // 35: TNT_BOTTOM
  paintTile(ctx, TEX.TNT_BOTTOM, (setPx) => {
    fillNoise(setPx, 0xa82519, 0.15, 350);
  });

  // 36: BOOKSHELF
  paintTile(ctx, TEX.BOOKSHELF, (setPx) => {
    fillNoise(setPx, 0x9c7746, 0.1, 360);
    const colors = ['#b83227', '#2b6cb0', '#2f855a', '#d69e2e', '#805ad5'];
    for (let row = 0; row < 2; row++) {
      const yStart = row === 0 ? 2 : 9;
      for (let x = 1; x < 15; x++) {
        const bookColor = colors[Math.floor((x + row * 5) / 2) % colors.length];
        for (let y = yStart; y < yStart + 5; y++) {
          setPx(x, y, x % 3 === 0 ? '#2d2318' : bookColor);
        }
      }
    }
  });

  // 37: GLOWSTONE
  paintTile(ctx, TEX.GLOWSTONE, (setPx) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = hashPixel(x, y, 370);
        if (r > 0.72) setPx(x, y, '#fff8bd');
        else if (r > 0.35) setPx(x, y, '#f5c842');
        else setPx(x, y, '#a87425');
      }
    }
  });

  // 38: WOOL
  paintTile(ctx, TEX.WOOL, (setPx) => {
    fillNoise(setPx, 0xf0f2f5, 0.1, 380);
  });

  const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
  atlasTexture.magFilter = THREE.NearestFilter;
  atlasTexture.minFilter = THREE.NearestFilter;
  atlasTexture.colorSpace = THREE.SRGBColorSpace;
  atlasTexture.needsUpdate = true;

  // Build 32x32 UI Icons for all blocks & items
  const iconUrls = {};
  for (const key of Object.keys(REGISTRY)) {
    const id = Number(key);
    iconUrls[id] = renderItemIcon(id, atlasCanvas);
  }

  return {
    atlasTexture,
    atlasCanvas,
    iconUrls,
    getTileUV(tileIndex) {
      const col = tileIndex % ATLAS_COLS;
      const row = Math.floor(tileIndex / ATLAS_COLS);
      const pad = 0.0015; // Inset slightly to avoid any seam bleeding
      const u0 = col / ATLAS_COLS + pad;
      const u1 = (col + 1) / ATLAS_COLS - pad;
      // Note: Canvas Y is top-down, Three.js UV V is bottom-up
      const v1 = 1 - row / ATLAS_ROWS - pad;
      const v0 = 1 - (row + 1) / ATLAS_ROWS + pad;
      return { u0, v0, u1, v1 };
    },
  };
}

function renderItemIcon(id, atlasCanvas) {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const def = REGISTRY[id];
  if (!def) return '';

  if (def.isBlock) {
    if (id === BLOCK.TORCH) {
      // Draw crisp upright torch icon
      ctx.fillStyle = '#755329';
      ctx.fillRect(14, 12, 4, 16);
      ctx.fillStyle = '#ff9914';
      ctx.fillRect(13, 6, 6, 6);
      ctx.fillStyle = '#fff599';
      ctx.fillRect(14, 7, 4, 4);
      return c.toDataURL();
    }

    const sideTile = def.faces.side ?? def.faces.all ?? 0;
    const topTile = def.faces.top ?? def.faces.all ?? 0;

    // Draw isometric-style 2.5D block preview
    const drawSubTile = (tile, dx, dy, dw, dh, brightness = 1) => {
      const col = tile % ATLAS_COLS;
      const row = Math.floor(tile / ATLAS_COLS);
      ctx.drawImage(atlasCanvas, col * 16, row * 16, 16, 16, dx, dy, dw, dh);
      if (brightness < 1) {
        ctx.fillStyle = `rgba(0,0,0,${1 - brightness})`;
        ctx.fillRect(dx, dy, dw, dh);
      }
    };

    // Top face strip + front-left + front-right cues
    drawSubTile(topTile, 4, 3, 24, 9, 1.0);
    drawSubTile(sideTile, 4, 11, 12, 18, 0.88);
    drawSubTile(sideTile, 16, 11, 12, 18, 0.72);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(3.5, 2.5, 25, 27);
    return c.toDataURL();
  }

  // Render Tool, Material, or Food pixel sprite
  const drawHandle = () => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#8c6638' : '#704f28';
      ctx.fillRect(6 + i * 2, 24 - i * 2, 3, 3);
    }
  };

  const tierColors = {
    1: '#b88c51', // Wood
    2: '#8a8d91', // Stone
    3: '#e1e6eb', // Iron
    4: '#42f5e3', // Diamond
  };

  if (def.isTool) {
    const headCol = tierColors[def.tier] || '#ccc';
    drawHandle();
    ctx.fillStyle = headCol;
    if (def.toolType === 'pickaxe') {
      ctx.fillRect(14, 5, 11, 4);
      ctx.fillRect(22, 8, 4, 9);
      ctx.fillRect(11, 7, 4, 4);
    } else if (def.toolType === 'axe') {
      ctx.fillRect(15, 5, 10, 9);
      ctx.fillRect(13, 7, 4, 9);
    } else if (def.toolType === 'shovel') {
      ctx.fillRect(18, 5, 8, 8);
    } else if (def.toolType === 'sword') {
      ctx.fillStyle = '#5c4022';
      ctx.fillRect(6, 22, 5, 5);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(9, 17, 8, 4);
      ctx.fillStyle = headCol;
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(13 + i * 2, 15 - i * 2, 4, 4);
      }
    }
    return c.toDataURL();
  }

  // Materials & Food
  if (id === ITEM.STICK) {
    drawHandle();
  } else if (id === ITEM.COAL) {
    ctx.fillStyle = '#252729';
    ctx.fillRect(9, 8, 14, 15);
    ctx.fillStyle = '#43474a';
    ctx.fillRect(11, 10, 6, 6);
  } else if (id === ITEM.IRON_INGOT || id === ITEM.GOLD_INGOT) {
    ctx.fillStyle = id === ITEM.GOLD_INGOT ? '#f7c82a' : '#d8dee3';
    ctx.fillRect(6, 11, 20, 10);
    ctx.fillStyle = id === ITEM.GOLD_INGOT ? '#fff28c' : '#ffffff';
    ctx.fillRect(8, 13, 14, 4);
  } else if (id === ITEM.DIAMOND) {
    ctx.fillStyle = '#36ebda';
    ctx.fillRect(10, 6, 12, 20);
    ctx.fillRect(7, 10, 18, 12);
    ctx.fillStyle = '#bafff8';
    ctx.fillRect(12, 9, 6, 6);
  } else if (id === ITEM.APPLE) {
    ctx.fillStyle = '#d92b2b';
    ctx.fillRect(8, 9, 16, 16);
    ctx.fillStyle = '#509e2f';
    ctx.fillRect(15, 4, 5, 5);
  } else if (id === ITEM.COOKED_MEAT || id === ITEM.BREAD) {
    ctx.fillStyle = id === ITEM.BREAD ? '#d49b3d' : '#8f4926';
    ctx.fillRect(6, 10, 20, 13);
    ctx.fillStyle = id === ITEM.BREAD ? '#f0c46c' : '#b8673e';
    ctx.fillRect(9, 12, 14, 7);
  }

  return c.toDataURL();
}
