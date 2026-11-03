// Procedural 16x16 texture atlas + item icon rendering (all canvas-based).
import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { BLOCKS, ITEMS, isBlock } from './blocks.js';

export const TILE = 16;
export const ATLAS_COLS = 8;

const tileNames = [];
const tileIndex = new Map();
function reg(name) {
  if (!tileIndex.has(name)) {
    tileIndex.set(name, tileNames.length);
    tileNames.push(name);
  }
  return tileIndex.get(name);
}

// ---------- pixel painters ----------
function px(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
function fillNoise(ctx, rand, base, vary, alpha = 1) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = (rand() - 0.5) * vary;
    ctx.fillStyle = shade(base, d, alpha);
    ctx.fillRect(x, y, 1, 1);
  }
}
function shade(hex, d, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + d * 255)));
  return `rgba(${f(r)},${f(g)},${f(b)},${alpha})`;
}

const painters = {
  grass_top(ctx, r) { fillNoise(ctx, r, '#8a8a8a', 0.16); }, // grayscale, tinted at mesh time
  dirt(ctx, r) { fillNoise(ctx, r, '#79553a', 0.13); sprinkle(ctx, r, '#5d4029', 10); sprinkle(ctx, r, '#8f6a48', 8); },
  grass_side(ctx, r) {
    painters.dirt(ctx, r);
    for (let x = 0; x < 16; x++) {
      const depth = 2 + Math.floor(r() * 3);
      for (let y = 0; y < depth; y++) px(ctx, x, y, shade('#6faa3c', (r() - 0.5) * 0.15));
    }
  },
  stone(ctx, r) { fillNoise(ctx, r, '#7f7f7f', 0.09); sprinkle(ctx, r, '#6b6b6b', 12); },
  cobble(ctx, r) {
    fillNoise(ctx, r, '#787878', 0.1);
    for (let i = 0; i < 7; i++) {
      const cx = Math.floor(r() * 16), cy = Math.floor(r() * 16), s = 2 + Math.floor(r() * 3);
      const c = shade('#8a8a8a', (r() - 0.5) * 0.2);
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) px(ctx, (cx + x) % 16, (cy + y) % 16, c);
    }
    sprinkle(ctx, r, '#5a5a5a', 16);
  },
  sand(ctx, r) { fillNoise(ctx, r, '#dbd08f', 0.08); sprinkle(ctx, r, '#c4b878', 10); },
  water(ctx, r) { fillNoise(ctx, r, '#3f76e4', 0.08, 1); sprinkle(ctx, r, '#5a8ff0', 12); },
  log_side(ctx, r) {
    for (let x = 0; x < 16; x++) {
      const c = shade('#6b4f2e', ((x % 4 === 0) ? -0.08 : 0) + (r() - 0.5) * 0.08);
      for (let y = 0; y < 16; y++) px(ctx, x, y, c);
    }
  },
  log_top(ctx, r) {
    fillNoise(ctx, r, '#6b4f2e', 0.06);
    for (let ring = 1; ring < 7; ring += 2) {
      ctx.strokeStyle = shade('#a5824f', (r() - 0.5) * 0.1);
      ctx.strokeRect(ring + 0.5, ring + 0.5, 15 - ring * 2, 15 - ring * 2);
    }
  },
  leaves(ctx, r) {
    ctx.clearRect(0, 0, 16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (r() < 0.82) px(ctx, x, y, shade('#8a8a8a', (r() - 0.5) * 0.3));
    }
  },
  planks(ctx, r) {
    fillNoise(ctx, r, '#a3824c', 0.07);
    for (let y = 0; y < 16; y += 4) {
      for (let x = 0; x < 16; x++) px(ctx, x, y, shade('#7c6136', (r() - 0.5) * 0.06));
      px(ctx, (y * 3 + 5) % 16, y + 1, '#7c6136'); px(ctx, (y * 3 + 5) % 16, y + 2, '#7c6136');
    }
  },
  coal_ore(ctx, r) { painters.stone(ctx, r); oreSpots(ctx, r, '#2e2e2e', '#171717'); },
  iron_ore(ctx, r) { painters.stone(ctx, r); oreSpots(ctx, r, '#d8af93', '#b98d6f'); },
  gold_ore(ctx, r) { painters.stone(ctx, r); oreSpots(ctx, r, '#f7d54a', '#d4af25'); },
  diamond_ore(ctx, r) { painters.stone(ctx, r); oreSpots(ctx, r, '#5fe8dc', '#3ec6bb'); },
  bedrock(ctx, r) { fillNoise(ctx, r, '#3d3d3d', 0.25); },
  snow(ctx, r) { fillNoise(ctx, r, '#f2f6f8', 0.04); },
  snow_grass_side(ctx, r) {
    painters.dirt(ctx, r);
    for (let x = 0; x < 16; x++) {
      const depth = 3 + Math.floor(r() * 2);
      for (let y = 0; y < depth; y++) px(ctx, x, y, shade('#eef3f6', (r() - 0.5) * 0.05));
    }
  },
  cactus_side(ctx, r) {
    fillNoise(ctx, r, '#5f8f3a', 0.08);
    for (let x = 0; x < 16; x += 3) for (let y = 0; y < 16; y++) px(ctx, x, y, shade('#4a732c', (r() - 0.5) * 0.06));
    sprinkle(ctx, r, '#dfe8c8', 6);
  },
  cactus_top(ctx, r) { fillNoise(ctx, r, '#6da344', 0.06); ctx.strokeStyle = '#4a732c'; ctx.strokeRect(2.5, 2.5, 11, 11); },
  glass(ctx, r) {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = 'rgba(200,225,240,0.22)'; ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = 'rgba(230,245,250,0.85)';
    ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1); ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
    px(ctx, 3, 3, 'rgba(255,255,255,0.7)'); px(ctx, 4, 4, 'rgba(255,255,255,0.7)'); px(ctx, 5, 5, 'rgba(255,255,255,0.5)');
  },
  table_top(ctx, r) {
    painters.planks(ctx, r);
    ctx.strokeStyle = '#5f4a28'; ctx.strokeRect(1.5, 1.5, 13, 13);
    ctx.strokeRect(4.5, 4.5, 7, 7);
  },
  table_side(ctx, r) {
    painters.planks(ctx, r);
    px(ctx, 3, 4, '#4a3a20'); px(ctx, 4, 4, '#4a3a20'); px(ctx, 3, 5, '#8a8a8a');
    px(ctx, 11, 4, '#4a3a20'); px(ctx, 12, 4, '#4a3a20'); px(ctx, 12, 5, '#8a8a8a');
  },
  furnace_side(ctx, r) {
    painters.cobble(ctx, r);
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(4, 8, 8, 6);
    ctx.fillStyle = '#ff9b2f'; ctx.fillRect(5, 10, 6, 3);
    ctx.fillStyle = '#ffd76e'; ctx.fillRect(6, 11, 4, 2);
  },
  furnace_top(ctx, r) { painters.cobble(ctx, r); ctx.strokeStyle = '#555'; ctx.strokeRect(3.5, 3.5, 9, 9); },
  torch(ctx, r) {
    ctx.clearRect(0, 0, 16, 16);
    for (let y = 6; y < 16; y++) { px(ctx, 7, y, '#6b4f2e'); px(ctx, 8, y, '#8a6a3e'); }
    px(ctx, 7, 5, '#ffd76e'); px(ctx, 8, 5, '#ffb52f'); px(ctx, 7, 4, '#ff9b2f'); px(ctx, 8, 4, '#ffd76e');
    px(ctx, 7, 3, '#fff3b0'); px(ctx, 8, 3, '#ffdd7e');
  },
  wool(ctx, r) { fillNoise(ctx, r, '#e8e8e8', 0.06); sprinkle(ctx, r, '#d5d5d5', 14); },
  gravel(ctx, r) { fillNoise(ctx, r, '#847e7a', 0.16); sprinkle(ctx, r, '#6a655f', 14); sprinkle(ctx, r, '#9b948e', 10); },
};

function sprinkle(ctx, r, color, n) {
  for (let i = 0; i < n; i++) px(ctx, Math.floor(r() * 16), Math.floor(r() * 16), color);
}
function oreSpots(ctx, r, c1, c2) {
  for (let i = 0; i < 5; i++) {
    const x = 1 + Math.floor(r() * 12), y = 1 + Math.floor(r() * 12);
    px(ctx, x, y, c1); px(ctx, x + 1, y, c2); px(ctx, x, y + 1, c2); px(ctx, x + 1, y + 1, c1);
  }
}

// ---------- atlas build ----------
let atlasCanvas = null;
export function getAtlasCanvas() {
  if (atlasCanvas) return atlasCanvas;
  // register all tiles used by blocks
  for (const id of Object.keys(BLOCKS)) {
    for (const t of BLOCKS[id].tiles) reg(t);
  }
  const rows = Math.ceil(tileNames.length / ATLAS_COLS);
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * TILE;
  canvas.height = Math.max(rows, 1) * TILE;
  const ctx = canvas.getContext('2d');
  tileNames.forEach((name, i) => {
    const cx = (i % ATLAS_COLS) * TILE, cy = Math.floor(i / ATLAS_COLS) * TILE;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath(); ctx.rect(0, 0, TILE, TILE); ctx.clip();
    const r = mulberry32(1000 + i * 77);
    (painters[name] || painters.stone)(ctx, r);
    ctx.restore();
  });
  atlasCanvas = canvas;
  return canvas;
}

export function tileUV(name) {
  getAtlasCanvas();
  const i = tileIndex.get(name) ?? 0;
  const rows = Math.ceil(tileNames.length / ATLAS_COLS);
  const u0 = (i % ATLAS_COLS) / ATLAS_COLS;
  const v0 = 1 - (Math.floor(i / ATLAS_COLS) + 1) / rows;
  return { u0, v0, du: 1 / ATLAS_COLS, dv: 1 / rows };
}

export function makeAtlasTexture() {
  const tex = new THREE.CanvasTexture(getAtlasCanvas());
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  return tex;
}

// ---------- crack overlay textures ----------
export function makeCrackTextures() {
  const texs = [];
  for (let stage = 0; stage < 10; stage++) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const r = mulberry32(42);
    ctx.strokeStyle = 'rgba(20,20,20,0.85)';
    ctx.lineWidth = 1;
    const lines = 2 + stage * 2;
    for (let i = 0; i < lines; i++) {
      let x = 8 + (r() - 0.5) * 4, y = 8 + (r() - 0.5) * 4;
      ctx.beginPath(); ctx.moveTo(x, y);
      const steps = 2 + Math.floor(stage / 2);
      for (let s = 0; s < steps; s++) {
        x += (r() - 0.5) * (4 + stage); y += (r() - 0.5) * (4 + stage);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    texs.push(tex);
  }
  return texs;
}

// ---------- item icons (dataURL cache) ----------
const iconCache = new Map();
const TINTS = { grass: '#79b64a', leaves: '#5ea83e' };

export function iconURL(id) {
  if (iconCache.has(id)) return iconCache.get(id);
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (isBlock(id)) drawBlockIcon(ctx, id);
  else drawItemIcon(ctx, id);
  const url = c.toDataURL();
  iconCache.set(id, url);
  return url;
}

function tileCanvas(name, tint) {
  const atlas = getAtlasCanvas();
  const i = tileIndex.get(name) ?? 0;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d');
  ctx.drawImage(atlas, (i % ATLAS_COLS) * TILE, Math.floor(i / ATLAS_COLS) * TILE, 16, 16, 0, 0, 16, 16);
  if (tint) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = tint; ctx.fillRect(0, 0, 16, 16);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(c, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }
  return c;
}

function drawBlockIcon(ctx, id) {
  const def = BLOCKS[id];
  const tint = def.tint ? TINTS[def.tint] : null;
  if (def.shape === 'torch' || def.cutout) {
    ctx.drawImage(tileCanvas(def.tiles[2], tint), 8, 8, 32, 32);
    return;
  }
  const top = tileCanvas(def.tiles[0], tint);
  const side = tileCanvas(def.tiles[2], tint);
  const S = 13; // half-width scale
  const cx = 24, cy = 14;
  // top face (diamond)
  ctx.save();
  ctx.transform(1, 0.5, -1, 0.5, cx, cy);
  ctx.drawImage(top, 0, 0, 16, 16, 0, 0, S, S);
  ctx.restore();
  // left face
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, cx - S, cy + S * 0.5);
  ctx.drawImage(side, 0, 0, 16, 16, 0, 0, S, S * 1.15);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, S, S * 1.15);
  ctx.restore();
  // right face
  ctx.save();
  ctx.transform(1, -0.5, 0, 1, cx, cy + S);
  ctx.drawImage(side, 0, 0, 16, 16, 0, 0, S, S * 1.15);
  ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fillRect(0, 0, S, S * 1.15);
  ctx.restore();
}

const ITEM_COLORS = {
  stick: '#8a6a3e', coal: '#2b2b2b', diamond: '#5fe8dc',
  iron_ingot: '#d8d8d8', gold_ingot: '#f7d54a',
  pork_raw: '#f0a0a0', pork_cooked: '#c07840', apple: '#d8342c',
};
const MAT_COLORS = { w: '#a3824c', s: '#8a8a8a', i: '#d8d8d8', d: '#5fe8dc' };

function drawItemIcon(ctx, id) {
  const def = ITEMS[id];
  if (!def) return;
  ctx.translate(24, 24);
  const icon = def.icon;
  if (def.tool) {
    const mat = MAT_COLORS[icon.split('_')[1]];
    ctx.rotate(-Math.PI / 4);
    // handle
    ctx.fillStyle = '#8a6a3e';
    ctx.fillRect(-3, -4, 6, 24);
    ctx.fillStyle = mat;
    if (def.tool === 'pick') {
      ctx.fillRect(-14, -14, 28, 7);
      ctx.fillRect(-16, -10, 6, 8); ctx.fillRect(10, -10, 6, 8);
    } else if (def.tool === 'axe') {
      ctx.fillRect(-12, -16, 14, 14);
      ctx.fillRect(-15, -12, 5, 8);
    } else if (def.tool === 'shovel') {
      ctx.fillRect(-6, -18, 12, 14);
    } else if (def.tool === 'sword') {
      ctx.fillRect(-3.5, -22, 7, 22);
      ctx.fillRect(-9, -2, 18, 5);
    }
  } else if (icon === 'stick') {
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = ITEM_COLORS.stick; ctx.fillRect(-3, -16, 6, 32);
  } else if (icon === 'coal' || icon === 'diamond') {
    ctx.fillStyle = ITEM_COLORS[icon];
    ctx.beginPath();
    ctx.moveTo(0, -13); ctx.lineTo(11, -4); ctx.lineTo(7, 11); ctx.lineTo(-7, 11); ctx.lineTo(-11, -4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-4, -7, 5, 5);
  } else if (icon.endsWith('ingot')) {
    ctx.fillStyle = ITEM_COLORS[icon];
    ctx.beginPath();
    ctx.moveTo(-13, 2); ctx.lineTo(-8, -7); ctx.lineTo(12, -7); ctx.lineTo(14, 2); ctx.lineTo(9, 9); ctx.lineTo(-11, 9);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-7, -5, 16, 3);
  } else if (icon.startsWith('pork')) {
    ctx.fillStyle = ITEM_COLORS[icon];
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 9, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(3, -2, 5, 3, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8dcc8'; ctx.fillRect(-15, 4, 7, 4);
  } else if (icon === 'apple') {
    ctx.fillStyle = ITEM_COLORS.apple;
    ctx.beginPath(); ctx.arc(0, 2, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-1.5, -14, 3, 7);
    ctx.fillStyle = '#5ea83e'; ctx.beginPath(); ctx.ellipse(5, -11, 5, 3, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(-4, -2, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// Flat texture for held item planes / dropped item sprites
export function makeIconTexture(id) {
  const img = new Image();
  img.src = iconURL(id);
  const tex = new THREE.Texture(img);
  img.onload = () => { tex.needsUpdate = true; };
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Build a small textured cube geometry for a block id (held item / drops)
export function makeBlockGeometry(id) {
  const def = BLOCKS[id];
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const uv = geo.attributes.uv;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z
  const faces = [def.tiles[2], def.tiles[2], def.tiles[0], def.tiles[1], def.tiles[2], def.tiles[2]];
  for (let f = 0; f < 6; f++) {
    const { u0, v0, du, dv } = tileUV(faces[f]);
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv);
    }
  }
  const colors = new Float32Array(24 * 3).fill(1);
  if (def.tint) {
    const color = new THREE.Color(TINTS[def.tint]);
    for (let i = 0; i < 24; i++) {
      const face = Math.floor(i / 4);
      const useTint = def.tint === 'leaves' || face === 2;
      if (useTint) { colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b; }
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}