import * as THREE from 'three';
import { BLOCKS, ITEMS } from './blocks.js';

const TILE = 16;
const COLS = 8;
const iconCache = new Map();

function rngFor(text) {
  let seed = 1779033703;
  for (let i = 0; i < text.length; i++) seed = Math.imul(seed ^ text.charCodeAt(i), 3432918353);
  return () => {
    seed = Math.imul(seed ^ (seed >>> 16), 2246822507);
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
    return ((seed ^= seed >>> 16) >>> 0) / 4294967296;
  };
}

function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (value >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((value >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (value & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

function noisyBase(ctx, random, base, variation = 18) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const broad = Math.sin(x * 0.8) * 3 + Math.cos(y * 0.63) * 3;
      ctx.fillStyle = shade(base, Math.round((random() - 0.5) * variation + broad));
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function speckles(ctx, random, color, count, size = 1) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) ctx.fillRect(Math.floor(random() * TILE), Math.floor(random() * TILE), size, size);
}

function oreTile(ctx, random, base, ore, dark) {
  noisyBase(ctx, random, base, 22);
  for (let cluster = 0; cluster < 5; cluster++) {
    const cx = 2 + Math.floor(random() * 12);
    const cy = 2 + Math.floor(random() * 12);
    for (let i = 0; i < 5; i++) {
      const x = Math.max(0, Math.min(15, cx + Math.floor(random() * 5) - 2));
      const y = Math.max(0, Math.min(15, cy + Math.floor(random() * 5) - 2));
      ctx.fillStyle = random() > 0.35 ? ore : dark;
      ctx.fillRect(x, y, random() > 0.7 ? 2 : 1, random() > 0.7 ? 2 : 1);
    }
  }
}

function paintTile(name, canvas) {
  const ctx = canvas.getContext('2d');
  const random = rngFor(name);
  ctx.clearRect(0, 0, TILE, TILE);
  const bases = {
    dirt: '#765037', stone: '#777b7b', sand: '#d6bd78', snow: '#e7f0ed',
    sandstone_top: '#cdb274', clay: '#9caaa9', gravel: '#89827c', mud: '#51443a',
    bedrock: '#353b3d', obsidian: '#211d35', planks: '#a87845', mossy_stone: '#687366',
  };
  if (bases[name]) {
    noisyBase(ctx, random, bases[name], name === 'snow' ? 10 : 25);
    if (name === 'dirt' || name === 'mud') speckles(ctx, random, '#3f352c', 18);
    if (name === 'sand' || name === 'sandstone_top') speckles(ctx, random, '#f0d994', 22);
    if (name === 'stone' || name === 'gravel') speckles(ctx, random, '#525859', 20);
    if (name === 'bedrock') speckles(ctx, random, '#111719', 36, 2);
    if (name === 'obsidian') {
      speckles(ctx, random, '#51416c', 20);
      ctx.fillStyle = '#34284b';
      for (let i = 0; i < 4; i++) ctx.fillRect(Math.floor(random() * 13), Math.floor(random() * 15), 4, 1);
    }
    if (name === 'mossy_stone') speckles(ctx, random, '#3f5d36', 34, 2);
    if (name === 'planks') {
      ctx.fillStyle = '#67472f';
      for (let y = 3; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
      for (let y = 0; y < 16; y += 4) ctx.fillRect((y * 3) % 13, y, 1, 4);
      speckles(ctx, random, '#c18e52', 18);
    }
    return;
  }

  switch (name) {
    case 'grass_top':
      noisyBase(ctx, random, '#629344', 28);
      speckles(ctx, random, '#8dad4f', 28);
      speckles(ctx, random, '#365f37', 20);
      break;
    case 'grass_side':
      noisyBase(ctx, random, '#765037', 22);
      for (let x = 0; x < 16; x++) {
        const depth = 3 + Math.floor(random() * 3);
        for (let y = 0; y < depth; y++) {
          ctx.fillStyle = shade('#629344', Math.floor((random() - 0.5) * 30));
          ctx.fillRect(x, y, 1, 1);
        }
      }
      speckles(ctx, random, '#493a2c', 12);
      break;
    case 'water':
      noisyBase(ctx, random, '#4c9db4', 15);
      ctx.fillStyle = 'rgba(191,235,229,.35)';
      for (let y = 2; y < 16; y += 5) {
        const start = Math.floor(random() * 6);
        ctx.fillRect(start, y, 6 + Math.floor(random() * 5), 1);
      }
      break;
    case 'oak_log':
    case 'pine_log': {
      const pine = name === 'pine_log';
      noisyBase(ctx, random, pine ? '#66503b' : '#725035', 20);
      for (let x = 1; x < 16; x += 3 + Math.floor(random() * 3)) {
        ctx.fillStyle = pine ? '#3e382e' : '#493523';
        ctx.fillRect(x, 0, 1, 16);
        if (random() > 0.4) ctx.fillRect(x + 1, Math.floor(random() * 10), 1, 5);
      }
      break;
    }
    case 'oak_log_top':
    case 'pine_log_top': {
      const pine = name === 'pine_log_top';
      noisyBase(ctx, random, pine ? '#a1845a' : '#b08a57', 16);
      ctx.strokeStyle = pine ? '#66503b' : '#765333';
      ctx.lineWidth = 1;
      for (let r = 2; r < 9; r += 2) {
        ctx.strokeRect(8 - r, 8 - r, r * 2 - 1, r * 2 - 1);
      }
      ctx.fillStyle = '#5e422e';
      ctx.fillRect(7, 7, 2, 2);
      break;
    }
    case 'oak_leaves':
    case 'pine_leaves':
    case 'jungle_leaves': {
      const base = name === 'oak_leaves' ? '#3e713b' : name === 'pine_leaves' ? '#315e4c' : '#347341';
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (random() < 0.13 && x > 0 && x < 15 && y > 0 && y < 15) continue;
        ctx.fillStyle = shade(base, Math.floor((random() - 0.5) * 45));
        ctx.fillRect(x, y, 1, 1);
      }
      speckles(ctx, random, name === 'jungle_leaves' ? '#78a944' : '#719044', 18);
      break;
    }
    case 'coal_ore': oreTile(ctx, random, '#777b7b', '#292e31', '#111619'); break;
    case 'iron_ore': oreTile(ctx, random, '#777b7b', '#c29375', '#785f50'); break;
    case 'crystal_ore': oreTile(ctx, random, '#555f68', '#67e4dc', '#247f8e'); break;
    case 'glowstone':
      noisyBase(ctx, random, '#c99843', 35);
      speckles(ctx, random, '#fff1a0', 42, 2);
      speckles(ctx, random, '#765029', 18);
      break;
    case 'crystal_block':
      noisyBase(ctx, random, '#3da8ac', 25);
      ctx.fillStyle = '#8ef4df';
      for (let i = 0; i < 7; i++) {
        const x = Math.floor(random() * 14);
        const y = Math.floor(random() * 14);
        ctx.fillRect(x, y, 2, 2);
        ctx.fillRect(x + 1, Math.max(0, y - 1), 1, 4);
      }
      break;
    case 'sandstone_side':
      noisyBase(ctx, random, '#cdb274', 17);
      ctx.fillStyle = '#a98e55';
      ctx.fillRect(0, 4, 16, 1); ctx.fillRect(0, 12, 16, 1);
      speckles(ctx, random, '#e4ca8b', 16);
      break;
    case 'cactus_side':
      noisyBase(ctx, random, '#3f813f', 18);
      ctx.fillStyle = '#83a953';
      for (let x = 2; x < 16; x += 5) ctx.fillRect(x, 0, 1, 16);
      speckles(ctx, random, '#d4d99b', 12);
      break;
    case 'cactus_top':
      noisyBase(ctx, random, '#5b9748', 18);
      ctx.fillStyle = '#2f6d3c'; ctx.fillRect(3, 3, 10, 10);
      ctx.fillStyle = '#79a958'; ctx.fillRect(5, 5, 6, 6);
      break;
    case 'crafting_top':
      noisyBase(ctx, random, '#9a6b3e', 15);
      ctx.fillStyle = '#503a29';
      ctx.fillRect(0, 0, 16, 2); ctx.fillRect(0, 14, 16, 2); ctx.fillRect(0, 0, 2, 16); ctx.fillRect(14, 0, 2, 16);
      ctx.fillRect(7, 2, 2, 12); ctx.fillRect(2, 7, 12, 2);
      break;
    case 'crafting_side':
      noisyBase(ctx, random, '#91613b', 18);
      ctx.fillStyle = '#4c3526'; ctx.fillRect(2, 3, 12, 2); ctx.fillRect(3, 5, 2, 9); ctx.fillRect(11, 5, 2, 9);
      ctx.fillStyle = '#c0965b'; ctx.fillRect(5, 7, 6, 2);
      break;
    case 'furnace_side':
      noisyBase(ctx, random, '#686e6e', 22);
      ctx.fillStyle = '#303638'; ctx.fillRect(3, 6, 10, 8);
      ctx.fillStyle = '#171d20'; ctx.fillRect(5, 8, 6, 4);
      ctx.fillStyle = '#969b94'; ctx.fillRect(4, 2, 8, 2);
      break;
    case 'bricks':
      noisyBase(ctx, random, '#a45e4d', 18);
      ctx.fillStyle = '#c2aa91';
      for (let y = 3; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
      for (let y = 0; y < 16; y += 4) for (let x = (y % 8 ? 3 : 7); x < 16; x += 8) ctx.fillRect(x, y, 1, 4);
      break;
    case 'stone_bricks':
      noisyBase(ctx, random, '#808786', 16);
      ctx.fillStyle = '#555d5e';
      for (let y = 7; y < 16; y += 8) ctx.fillRect(0, y, 16, 1);
      ctx.fillRect(7, 0, 1, 7); ctx.fillRect(3, 8, 1, 8); ctx.fillRect(12, 8, 1, 8);
      break;
    case 'glass':
      ctx.fillStyle = 'rgba(187,225,224,.85)'; ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1); ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
      ctx.fillStyle = 'rgba(220,248,242,.5)'; ctx.fillRect(3, 3, 5, 1); ctx.fillRect(3, 4, 1, 4); ctx.fillRect(11, 9, 1, 4);
      break;
    case 'flower':
      ctx.fillStyle = '#47743c'; ctx.fillRect(7, 7, 2, 9); ctx.fillRect(5, 11, 2, 2); ctx.fillRect(9, 9, 3, 2);
      ctx.fillStyle = '#e9c55d'; ctx.fillRect(6, 3, 4, 4);
      ctx.fillStyle = '#e68b8b'; ctx.fillRect(5, 2, 2, 2); ctx.fillRect(9, 2, 2, 2); ctx.fillRect(5, 6, 2, 2); ctx.fillRect(9, 6, 2, 2);
      break;
    case 'tall_grass':
      ctx.fillStyle = '#557c3b';
      for (let i = 0; i < 8; i++) {
        const x = 2 + Math.floor(random() * 12);
        const h = 5 + Math.floor(random() * 9);
        ctx.fillRect(x, 16 - h, 1, h);
        if (random() > 0.5) ctx.fillRect(x + (random() > 0.5 ? 1 : -1), 16 - h, 1, 3);
      }
      break;
    case 'berry_bush':
      for (let i = 0; i < 45; i++) {
        const x = 2 + Math.floor(random() * 12); const y = 3 + Math.floor(random() * 12);
        ctx.fillStyle = shade('#3e6d3b', Math.floor(random() * 25)); ctx.fillRect(x, y, 2, 2);
      }
      ctx.fillStyle = '#b94652';
      for (let i = 0; i < 12; i++) ctx.fillRect(2 + Math.floor(random() * 12), 5 + Math.floor(random() * 9), 2, 2);
      break;
    case 'torch':
      ctx.fillStyle = '#6e472b'; ctx.fillRect(7, 7, 2, 9);
      ctx.fillStyle = '#f5b942'; ctx.fillRect(6, 3, 4, 5); ctx.fillRect(5, 4, 6, 2);
      ctx.fillStyle = '#fff0a0'; ctx.fillRect(7, 2, 2, 4);
      break;
    case 'pumpkin_side':
      noisyBase(ctx, random, '#c9792f', 18);
      ctx.fillStyle = '#8b4b25'; for (let x = 2; x < 16; x += 4) ctx.fillRect(x, 0, 1, 16);
      break;
    case 'pumpkin_top':
      noisyBase(ctx, random, '#d18435', 16);
      ctx.fillStyle = '#61713b'; ctx.fillRect(6, 6, 4, 4);
      break;
    default:
      noisyBase(ctx, random, '#ff00ff', 10);
  }
}

export function createTextureAtlas() {
  const names = [...new Set(BLOCKS.flatMap((b) => Object.values(b.tiles || {})).filter((n) => n && n !== 'air'))];
  const rows = Math.ceil(names.length / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TILE;
  canvas.height = rows * TILE;
  const ctx = canvas.getContext('2d');
  const tiles = {};
  const tileCanvases = {};
  names.forEach((name, index) => {
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = TILE; tileCanvas.height = TILE;
    paintTile(name, tileCanvas);
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    ctx.drawImage(tileCanvas, col * TILE, row * TILE);
    tiles[name] = {
      u0: col / COLS, u1: (col + 1) / COLS,
      v0: 1 - (row + 1) / rows, v1: 1 - row / rows,
    };
    tileCanvases[name] = tileCanvas;
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, tiles, tileCanvases, canvas };
}

export function createWorldMaterials(atlas) {
  const materials = {
    opaque: new THREE.MeshLambertMaterial({ map: atlas.texture, vertexColors: true }),
    cutout: new THREE.MeshLambertMaterial({ map: atlas.texture, vertexColors: true, alphaTest: 0.35, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true }),
    glow_cutout: new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true, alphaTest: 0.25, side: THREE.DoubleSide }),
    water: new THREE.MeshPhongMaterial({
      map: atlas.texture, vertexColors: true, transparent: true, opacity: 0.68,
      depthWrite: false, side: THREE.DoubleSide, shininess: 75, specular: new THREE.Color('#a5d8dd'),
    }),
  };
  materials.water.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      transformed.y += sin((position.x + position.z) * 1.7 + uTime * 1.8) * 0.025;
    `);
    materials.water.userData.shader = shader;
  };
  return materials;
}

function baseIcon() {
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  return [canvas, canvas.getContext('2d')];
}

export function itemIcon(key, atlas) {
  if (iconCache.has(key)) return iconCache.get(key);
  const item = ITEMS[key];
  const [canvas, ctx] = baseIcon();
  ctx.imageSmoothingEnabled = false;
  if (item?.block) {
    const def = BLOCKS[item.block];
    const tile = atlas.tileCanvases[def.tiles.side || def.tiles.top];
    if (tile) {
      ctx.drawImage(tile, 3, 3, 26, 26);
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(3, 3, 26, 2); ctx.fillRect(3, 3, 2, 26);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(3, 27, 26, 2); ctx.fillRect(27, 3, 2, 26);
    }
  } else if (item?.tool) {
    const colors = { wood: '#aa7849', stone: '#929999', iron: '#e0e5df', crystal: '#6df2e3', guardian: '#e4c35d' };
    const color = colors[item.material] || '#ddd';
    ctx.fillStyle = '#6d482d';
    for (let i = 0; i < 15; i++) ctx.fillRect(7 + i, 22 - i, 3, 3);
    ctx.fillStyle = color;
    if (item.tool === 'pickaxe') {
      ctx.fillRect(5, 4, 22, 4); ctx.fillRect(3, 7, 5, 4); ctx.fillRect(24, 7, 4, 4); ctx.fillRect(14, 7, 4, 5);
    } else if (item.tool === 'axe') {
      ctx.fillRect(12, 3, 12, 5); ctx.fillRect(9, 7, 14, 6); ctx.fillRect(17, 12, 6, 3);
    } else if (item.tool === 'shovel') {
      ctx.fillRect(16, 3, 9, 8); ctx.fillRect(13, 8, 12, 6);
    } else {
      ctx.fillRect(17, 2, 5, 18); ctx.fillRect(14, 5, 5, 14); ctx.fillRect(8, 19, 16, 4); ctx.fillStyle = '#76502f'; ctx.fillRect(7, 22, 5, 8);
    }
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(17, 3, 2, 10);
  } else {
    const random = rngFor(key);
    const colors = {
      stick: '#8b5b34', coal: '#30363a', raw_iron: '#b88367', iron_ingot: '#d7dfdc', crystal: '#62e4db',
      plant_fiber: '#7a9b4c', guardian_core: '#e8bd55', guardian_idol: '#79d9cc', apple: '#c94f45',
      berries: '#b84256', raw_meat: '#c77772', cooked_meat: '#a96b3f', bandage: '#e5dfc7', pumpkin: '#cf7b31',
    };
    ctx.fillStyle = colors[key] || '#b9b9b9';
    if (key === 'stick') {
      for (let i = 0; i < 18; i++) ctx.fillRect(6 + i, 24 - i, 3, 3);
    } else if (key === 'iron_ingot' || key === 'raw_iron') {
      ctx.fillRect(5, 12, 22, 10); ctx.fillRect(9, 8, 14, 5); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(9, 9, 12, 3);
    } else if (key === 'crystal' || key === 'guardian_core') {
      ctx.fillRect(12, 3, 8, 25); ctx.fillRect(7, 9, 18, 12); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(12, 5, 3, 16);
    } else if (key === 'bandage') {
      ctx.fillRect(4, 10, 24, 12); ctx.fillStyle = '#b9b49f'; ctx.fillRect(13, 10, 6, 12); ctx.fillRect(10, 13, 12, 6);
    } else if (key === 'guardian_idol') {
      ctx.fillRect(8, 5, 16, 22); ctx.fillStyle = '#254f55'; ctx.fillRect(11, 10, 4, 4); ctx.fillRect(18, 10, 4, 4); ctx.fillRect(12, 20, 9, 3);
    } else if (key === 'plant_fiber') {
      for (let i = 0; i < 6; i++) ctx.fillRect(6 + i * 3, 5 + Math.floor(random() * 8), 2, 20);
    } else {
      for (let i = 0; i < 8; i++) {
        const x = 6 + Math.floor(random() * 15); const y = 7 + Math.floor(random() * 14);
        ctx.fillRect(x, y, 7, 7);
      }
      if (key === 'apple') { ctx.fillStyle = '#5d793d'; ctx.fillRect(17, 3, 3, 7); }
    }
  }
  const url = canvas.toDataURL();
  iconCache.set(key, url);
  return url;
}
