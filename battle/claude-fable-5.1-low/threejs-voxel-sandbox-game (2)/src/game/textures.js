import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { BLOCKS, ITEMS, getDef } from './blocks.js';

export const TILE = 16;
export const ATLAS_COLS = 16;

const tileIndex = new Map();
const painters = {};
let atlasCanvas, atlasCtx;

// ---------- helpers ----------
function px(ctx, x, y, r, g, b, a = 1) {
  ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  ctx.fillRect(x, y, 1, 1);
}
function noiseFill(ctx, base, variance, rnd, fn) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const n = (rnd() - 0.5) * variance;
    let [r, g, b] = base;
    r += n; g += n; b += n;
    if (fn) { const o = fn(x, y, rnd); if (o) { [r, g, b] = o; } }
    px(ctx, x, y, r, g, b);
  }
}
function speck(ctx, rnd, count, color, size = 1) {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rnd() * TILE), y = Math.floor(rnd() * TILE);
    ctx.fillStyle = `rgb(${color.join(',')})`; ctx.fillRect(x, y, size, size);
  }
}
function oreTile(base, oreCol, oreCol2, seed) {
  return (ctx, rnd) => {
    painters.stone(ctx, rnd);
    const r2 = mulberry32(seed);
    for (let i = 0; i < 7; i++) {
      const x = 1 + Math.floor(r2() * 13), y = 1 + Math.floor(r2() * 13);
      px(ctx, x, y, ...oreCol); px(ctx, x + 1, y, ...oreCol2); px(ctx, x, y + 1, ...oreCol2); px(ctx, x + 1, y + 1, ...oreCol);
    }
  };
}
function clear(ctx) { ctx.clearRect(0, 0, TILE, TILE); }
function plank(ctx, rnd, base, dark) {
  noiseFill(ctx, base, 14, rnd);
  ctx.fillStyle = `rgb(${dark.join(',')})`;
  for (let y = 3; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
  ctx.fillRect(4, 0, 1, 3); ctx.fillRect(12, 4, 1, 3); ctx.fillRect(7, 8, 1, 3); ctx.fillRect(2, 12, 1, 3);
}
function logSide(ctx, rnd, base, dark) {
  noiseFill(ctx, base, 10, rnd);
  ctx.fillStyle = `rgb(${dark.join(',')})`;
  for (let x = 0; x < 16; x += 3) { for (let y = 0; y < 16; y++) if (rnd() < 0.75) ctx.fillRect(x, y, 1, 1); }
}
function logTop(ctx, rnd, bark, wood, ring) {
  noiseFill(ctx, bark, 10, rnd);
  ctx.fillStyle = `rgb(${wood.join(',')})`; ctx.fillRect(2, 2, 12, 12);
  ctx.fillStyle = `rgb(${ring.join(',')})`;
  ctx.strokeStyle = ctx.fillStyle; ctx.fillRect(4, 4, 8, 1); ctx.fillRect(4, 11, 8, 1); ctx.fillRect(4, 4, 1, 8); ctx.fillRect(11, 4, 1, 8);
  ctx.fillRect(7, 7, 2, 2);
}
function cross(ctx, rnd, col, dark) {
  clear(ctx);
  for (let i = 0; i < 20; i++) {
    const x = Math.floor(rnd() * 16), h = 4 + Math.floor(rnd() * 11);
    const c = rnd() < 0.5 ? col : dark;
    ctx.fillStyle = `rgb(${c.join(',')})`; ctx.fillRect(x, 16 - h, 1, h);
  }
}

// ---------- block tile painters ----------
painters.grass_top = (ctx, rnd) => noiseFill(ctx, [112, 170, 70], 26, rnd);
painters.dirt = (ctx, rnd) => { noiseFill(ctx, [134, 96, 67], 24, rnd); speck(ctx, rnd, 10, [100, 70, 45]); };
painters.grass_side = (ctx, rnd) => {
  painters.dirt(ctx, rnd);
  for (let x = 0; x < 16; x++) { const h = 2 + Math.floor(rnd() * 3); for (let y = 0; y < h; y++) px(ctx, x, y, 105 + rnd() * 20, 160 + rnd() * 20, 65); }
};
painters.snow_grass_side = (ctx, rnd) => {
  painters.dirt(ctx, rnd);
  for (let x = 0; x < 16; x++) { const h = 2 + Math.floor(rnd() * 3); for (let y = 0; y < h; y++) px(ctx, x, y, 235 + rnd() * 15, 240 + rnd() * 10, 248); }
};
painters.stone = (ctx, rnd) => { noiseFill(ctx, [125, 125, 125], 22, rnd); speck(ctx, rnd, 6, [105, 105, 105], 2); };
painters.cobble = (ctx, rnd) => {
  noiseFill(ctx, [110, 110, 110], 30, rnd);
  ctx.fillStyle = 'rgb(70,70,70)';
  const stones = [[0, 0, 5, 4], [6, 0, 6, 5], [13, 0, 3, 3], [0, 5, 4, 5], [5, 6, 5, 4], [11, 4, 5, 6], [0, 11, 6, 5], [7, 11, 4, 5], [12, 11, 4, 5]];
  for (const [x, y, w, h] of stones) { ctx.strokeStyle = 'rgba(60,60,60,0.9)'; ctx.fillStyle = `rgb(${110 + rnd() * 30 | 0},${110 + rnd() * 30 | 0},${110 + rnd() * 30 | 0})`; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(55,55,55,0.8)'; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h); }
};
painters.mossy_cobble = (ctx, rnd) => { painters.cobble(ctx, rnd); speck(ctx, rnd, 22, [80, 120, 60], 1); speck(ctx, rnd, 6, [90, 135, 65], 2); };
painters.sand = (ctx, rnd) => { noiseFill(ctx, [219, 207, 160], 16, rnd); speck(ctx, rnd, 8, [200, 185, 140]); };
painters.sandstone_top = (ctx, rnd) => noiseFill(ctx, [214, 200, 150], 10, rnd);
painters.sandstone_side = (ctx, rnd) => { noiseFill(ctx, [214, 200, 150], 8, rnd); ctx.fillStyle = 'rgb(190,175,125)'; ctx.fillRect(0, 3, 16, 1); ctx.fillRect(0, 9, 16, 1); ctx.fillRect(0, 14, 16, 1); };
painters.gravel = (ctx, rnd) => { noiseFill(ctx, [130, 125, 120], 40, rnd); speck(ctx, rnd, 10, [90, 88, 85], 2); speck(ctx, rnd, 6, [165, 160, 155], 2); };
painters.clay = (ctx, rnd) => noiseFill(ctx, [158, 164, 176], 14, rnd);
painters.water = (ctx, rnd) => noiseFill(ctx, [40, 90, 200], 20, rnd);
painters.lava = (ctx, rnd) => { noiseFill(ctx, [220, 100, 20], 50, rnd); speck(ctx, rnd, 12, [255, 220, 80], 2); };
painters.bedrock = (ctx, rnd) => noiseFill(ctx, [70, 70, 70], 70, rnd);
painters.snow = (ctx, rnd) => noiseFill(ctx, [240, 244, 250], 10, rnd);
painters.ice = (ctx, rnd) => { noiseFill(ctx, [150, 190, 240], 16, rnd); speck(ctx, rnd, 5, [200, 225, 255], 2); };
painters.coal_ore = oreTile(null, [30, 30, 30], [50, 50, 50], 11);
painters.iron_ore = oreTile(null, [215, 170, 140], [190, 140, 110], 12);
painters.gold_ore = oreTile(null, [250, 215, 60], [220, 180, 40], 13);
painters.diamond_ore = oreTile(null, [100, 240, 230], [60, 200, 210], 14);
painters.log_side = (ctx, rnd) => logSide(ctx, rnd, [104, 82, 50], [78, 60, 36]);
painters.log_top = (ctx, rnd) => logTop(ctx, rnd, [104, 82, 50], [190, 155, 100], [150, 120, 75]);
painters.birch_side = (ctx, rnd) => { noiseFill(ctx, [225, 225, 215], 12, rnd); ctx.fillStyle = 'rgb(40,40,40)'; for (let i = 0; i < 7; i++) ctx.fillRect(Math.floor(rnd() * 14), Math.floor(rnd() * 16), 2 + Math.floor(rnd() * 3), 1); };
painters.birch_top = (ctx, rnd) => logTop(ctx, rnd, [225, 225, 215], [210, 190, 140], [180, 160, 110]);
painters.spruce_side = (ctx, rnd) => logSide(ctx, rnd, [60, 42, 25], [45, 30, 18]);
painters.spruce_top = (ctx, rnd) => logTop(ctx, rnd, [60, 42, 25], [150, 115, 70], [120, 90, 55]);
painters.leaves = (ctx, rnd) => { clear(ctx); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (rnd() < 0.93) { const v = 165 + rnd() * 90; px(ctx, x, y, v, v, v); } } };
painters.planks = (ctx, rnd) => plank(ctx, rnd, [176, 142, 88], [130, 100, 60]);
painters.table_top = (ctx, rnd) => { painters.planks(ctx, rnd); ctx.fillStyle = 'rgb(90,70,45)'; ctx.fillRect(1, 1, 14, 1); ctx.fillRect(1, 14, 14, 1); ctx.fillRect(1, 1, 1, 14); ctx.fillRect(14, 1, 1, 14); ctx.fillRect(3, 3, 4, 4); ctx.fillRect(9, 3, 4, 4); ctx.fillRect(3, 9, 4, 4); ctx.fillRect(9, 9, 4, 4); };
painters.table_side = (ctx, rnd) => { painters.planks(ctx, rnd); ctx.fillStyle = 'rgb(90,70,45)'; ctx.fillRect(2, 3, 3, 4); ctx.fillRect(11, 3, 3, 4); ctx.fillRect(6, 5, 4, 2); ctx.fillStyle = 'rgb(200,200,200)'; ctx.fillRect(3, 4, 1, 2); ctx.fillRect(12, 4, 1, 2); };
painters.furnace_side = (ctx, rnd) => { painters.cobble(ctx, rnd); ctx.fillStyle = 'rgb(30,30,30)'; ctx.fillRect(4, 6, 8, 7); ctx.fillStyle = 'rgb(255,150,40)'; ctx.fillRect(5, 9, 6, 3); ctx.fillStyle = 'rgb(255,220,100)'; ctx.fillRect(6, 10, 1, 2); ctx.fillRect(9, 10, 1, 2); };
painters.furnace_top = (ctx, rnd) => { painters.cobble(ctx, rnd); };
painters.bricks = (ctx, rnd) => { noiseFill(ctx, [150, 80, 65], 14, rnd); ctx.fillStyle = 'rgb(200,195,185)'; for (let y = 0; y < 16; y += 4) { ctx.fillRect(0, y + 3, 16, 1); const off = (y / 4) % 2 ? 4 : 0; ctx.fillRect(off, y, 1, 3); ctx.fillRect(off + 8, y, 1, 3); } };
painters.stone_bricks = (ctx, rnd) => { noiseFill(ctx, [120, 120, 120], 12, rnd); ctx.fillStyle = 'rgb(80,80,80)'; ctx.fillRect(0, 7, 16, 1); ctx.fillRect(0, 15, 16, 1); ctx.fillRect(7, 0, 1, 7); ctx.fillRect(3, 8, 1, 7); ctx.fillRect(11, 8, 1, 7); ctx.fillStyle = 'rgb(145,145,145)'; ctx.fillRect(0, 0, 7, 1); ctx.fillRect(8, 0, 8, 1); };
painters.glass = (ctx) => { clear(ctx); ctx.fillStyle = 'rgba(220,240,255,0.25)'; ctx.fillRect(0, 0, 16, 16); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1); ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(2, 2, 1, 5); ctx.fillRect(3, 2, 2, 1); };
painters.torch = (ctx) => { clear(ctx); ctx.fillStyle = 'rgb(120,90,50)'; ctx.fillRect(7, 6, 2, 10); ctx.fillStyle = 'rgb(255,200,60)'; ctx.fillRect(7, 4, 2, 2); ctx.fillStyle = 'rgb(255,240,160)'; ctx.fillRect(7, 3, 2, 1); ctx.fillStyle = 'rgb(255,120,30)'; ctx.fillRect(6, 5, 1, 1); ctx.fillRect(9, 5, 1, 1); };
painters.tall_grass = (ctx, rnd) => cross(ctx, rnd, [210, 210, 210], [160, 160, 160]);
painters.dead_bush = (ctx, rnd) => { clear(ctx); ctx.fillStyle = 'rgb(120,85,45)'; ctx.fillRect(7, 8, 2, 8); for (let i = 0; i < 8; i++) { const x = 2 + Math.floor(rnd() * 12), y = 2 + Math.floor(rnd() * 8); ctx.fillRect(x, y, 1, 4); ctx.fillRect(Math.min(x, 8), y + 3, Math.abs(x - 8) + 1, 1); } };
painters.flower_red = (ctx, rnd) => { clear(ctx); ctx.fillStyle = 'rgb(60,130,50)'; ctx.fillRect(7, 8, 2, 8); ctx.fillRect(5, 11, 2, 1); ctx.fillRect(9, 12, 2, 1); ctx.fillStyle = 'rgb(220,40,40)'; ctx.fillRect(5, 4, 6, 5); ctx.fillRect(6, 3, 4, 1); ctx.fillStyle = 'rgb(40,30,30)'; ctx.fillRect(7, 5, 2, 2); };
painters.flower_yellow = (ctx, rnd) => { clear(ctx); ctx.fillStyle = 'rgb(60,130,50)'; ctx.fillRect(7, 8, 2, 8); ctx.fillRect(9, 11, 2, 1); ctx.fillStyle = 'rgb(250,220,60)'; ctx.fillRect(5, 4, 6, 5); ctx.fillRect(6, 3, 4, 1); ctx.fillRect(4, 5, 1, 3); ctx.fillRect(11, 5, 1, 3); ctx.fillStyle = 'rgb(200,150,30)'; ctx.fillRect(7, 5, 2, 2); };
painters.mushroom = (ctx) => { clear(ctx); ctx.fillStyle = 'rgb(220,210,190)'; ctx.fillRect(7, 9, 2, 7); ctx.fillStyle = 'rgb(190,40,40)'; ctx.fillRect(4, 6, 8, 4); ctx.fillRect(5, 5, 6, 1); ctx.fillStyle = 'rgb(255,255,255)'; ctx.fillRect(5, 7, 1, 1); ctx.fillRect(9, 6, 2, 1); ctx.fillRect(8, 8, 1, 1); };
painters.cactus_side = (ctx, rnd) => { noiseFill(ctx, [70, 130, 50], 16, rnd); ctx.fillStyle = 'rgb(40,90,30)'; ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16); for (let i = 0; i < 6; i++) ctx.fillRect(3 + (i % 3) * 5, 1 + i * 2, 1, 1); };
painters.cactus_top = (ctx, rnd) => { noiseFill(ctx, [90, 150, 70], 14, rnd); ctx.fillStyle = 'rgb(40,90,30)'; ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1); ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16); };
painters.glowstone = (ctx, rnd) => { noiseFill(ctx, [230, 190, 110], 30, rnd); speck(ctx, rnd, 8, [255, 240, 180], 2); speck(ctx, rnd, 6, [170, 130, 70], 1); };
painters.wool = (ctx, rnd) => { noiseFill(ctx, [235, 235, 235], 18, rnd); speck(ctx, rnd, 6, [210, 210, 210], 2); };
painters.obsidian = (ctx, rnd) => { noiseFill(ctx, [25, 18, 40], 20, rnd); speck(ctx, rnd, 6, [60, 40, 90], 1); };
painters.bookshelf = (ctx, rnd) => { painters.planks(ctx, rnd); ctx.fillStyle = 'rgb(60,45,30)'; ctx.fillRect(0, 1, 16, 6); ctx.fillRect(0, 9, 16, 6); const cols = [[180, 50, 50], [50, 90, 180], [60, 150, 70], [200, 180, 60], [150, 80, 160]]; let x = 1; while (x < 15) { const w = 1 + Math.floor(rnd() * 2); const c = cols[Math.floor(rnd() * cols.length)]; ctx.fillStyle = `rgb(${c.join(',')})`; ctx.fillRect(x, 2, w, 5); const c2 = cols[Math.floor(rnd() * cols.length)]; ctx.fillStyle = `rgb(${c2.join(',')})`; ctx.fillRect(x, 10, w, 5); x += w + (rnd() < 0.3 ? 1 : 0); } };
painters.pumpkin_side = (ctx, rnd) => { noiseFill(ctx, [225, 130, 30], 20, rnd); ctx.fillStyle = 'rgb(180,95,20)'; ctx.fillRect(3, 0, 1, 16); ctx.fillRect(8, 0, 1, 16); ctx.fillRect(12, 0, 1, 16); };
painters.pumpkin_top = (ctx, rnd) => { noiseFill(ctx, [210, 120, 30], 20, rnd); ctx.fillStyle = 'rgb(80,110,40)'; ctx.fillRect(6, 6, 4, 4); };
painters.pumpkin_face = (ctx, rnd) => { painters.pumpkin_side(ctx, rnd); ctx.fillStyle = 'rgb(255,230,120)'; ctx.fillRect(3, 4, 3, 3); ctx.fillRect(10, 4, 3, 3); ctx.fillRect(7, 7, 2, 2); ctx.fillRect(3, 10, 10, 2); ctx.fillStyle = 'rgb(225,130,30)'; ctx.fillRect(5, 10, 1, 1); ctx.fillRect(10, 10, 1, 1); };
painters.fence = (ctx) => { clear(ctx); ctx.fillStyle = 'rgb(160,128,78)'; ctx.fillRect(6, 0, 4, 16); ctx.fillRect(0, 3, 16, 3); ctx.fillRect(0, 9, 16, 3); ctx.fillStyle = 'rgb(120,95,55)'; ctx.fillRect(0, 5, 16, 1); ctx.fillRect(0, 11, 16, 1); };
painters.ladder = (ctx) => { clear(ctx); ctx.fillStyle = 'rgb(160,128,78)'; ctx.fillRect(2, 0, 2, 16); ctx.fillRect(12, 0, 2, 16); ctx.fillRect(2, 2, 12, 2); ctx.fillRect(2, 7, 12, 2); ctx.fillRect(2, 12, 12, 2); };

// ---------- item icon painters (16x16 pixel art) ----------
const MAT = {
  wood: { h: [160, 128, 78], m: [120, 95, 55] }, stone: { h: [160, 128, 78], m: [130, 130, 130] },
  iron: { h: [160, 128, 78], m: [225, 225, 225] }, diamond: { h: [160, 128, 78], m: [90, 230, 220] },
};
function pattern(ctx, rows, map) {
  clear(ctx);
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = map[row[x]]; if (c) px(ctx, x, y, ...c); } });
}
const PICK = ['....MMMMMMM.....', '..MMM.....MMM...', '.MM.........MM..', '.M......H....M..', '.M.....HH....M..', '......HH........', '.....HH.........', '....HH..........', '...HH...........', '..HH............', '.HH.............', 'HH..............'];
const SWORD = ['............MM..', '...........MMM..', '..........MMM...', '.........MMM....', '........MMM.....', '.......MMM......', '..D...MMM.......', '...D.MMM........', '....DMM.........', '...DDD..........', '..HH.DD.........', '.HH.............', 'HH..............'];
const AXE = ['......MMMM......', '.....MMMMMM.....', '....MMMMMMM.....', '....MMMMMMM.....', '....MMMHHMM.....', '.....MMHH.......', '......HH........', '.....HH.........', '....HH..........', '...HH...........', '..HH............', '.HH.............', 'HH..............'];
const SHOVEL = ['..........MMM...', '.........MMMMM..', '.........MMMMM..', '.........MMMMM..', '..........MHM...', '.........HH.....', '........HH......', '.......HH.......', '......HH........', '.....HH.........', '....HH..........', '...HH...........', '..HH............'];
function toolIcon(rows, mat) { return (ctx) => pattern(ctx, rows, { M: MAT[mat].m, H: MAT[mat].h, D: [90, 90, 90] }); }
for (const m of ['wood', 'stone', 'iron', 'diamond']) {
  painters['pick_' + m] = toolIcon(PICK, m); painters['sword_' + m] = toolIcon(SWORD, m);
  painters['axe_' + m] = toolIcon(AXE, m); painters['shovel_' + m] = toolIcon(SHOVEL, m);
}
painters.stick = (ctx) => pattern(ctx, ['..............', '............HH', '...........HH.', '..........HH..', '.........HH...', '........HH....', '.......HH.....', '......HH......', '.....HH.......', '....HH........', '...HH.........', '..HH..........', '.HH...........'], { H: [140, 105, 60] });
const blob = (c1, c2) => (ctx) => pattern(ctx, ['................', '................', '......AAAA......', '....AABBBBAA....', '...ABBBBBBBBA...', '...ABBBBBBBBA...', '..ABBBBAABBBBA..', '..ABBBBBBBBBBA..', '..ABBBBBBBBBBA..', '...ABBBBBBBBA...', '...ABBBBBBBBA...', '....AABBBBAA....', '......AAAA......'], { A: c2, B: c1 });
painters.coal = blob([35, 35, 35], [15, 15, 15]);
const ingot = (c1, c2) => (ctx) => pattern(ctx, ['................', '................', '................', '................', '.....BBBBBBBB...', '....BAAAAAAABB..', '...BAAAAAAAAAB..', '..BAAAAAAAAAAB..', '..BAAAAAAAAABB..', '..BBBBBBBBBBB...', '................'], { A: c1, B: c2 });
painters.ingot_iron = ingot([230, 230, 230], [150, 150, 150]);
painters.ingot_gold = ingot([250, 220, 70], [190, 150, 30]);
painters.diamond = (ctx) => pattern(ctx, ['................', '................', '.....AAAAAA.....', '....ABBBBBBA....', '...ABBWBBBBBA...', '...ABBBBBBBBA...', '....ABBBBBBA....', '.....ABBBBA.....', '......ABBA......', '.......AA.......'], { A: [40, 170, 170], B: [110, 240, 230], W: [240, 255, 255] });
const meat = (c1, c2, bone) => (ctx) => pattern(ctx, ['................', '..........BB....', '.........BBB....', '........BB......', '....AAAABB......', '...ACCCAA.......', '..ACCCCCA.......', '..ACCCCCA.......', '..ACCCCCA.......', '...ACCCA........', '....AAA.........'], { A: c2, C: c1, B: bone });
painters.pork_raw = meat([240, 150, 160], [200, 100, 110], [230, 225, 210]);
painters.pork_cooked = meat([170, 110, 60], [120, 75, 40], [230, 225, 210]);
painters.mutton_raw = meat([220, 90, 90], [170, 50, 50], [230, 225, 210]);
painters.mutton_cooked = meat([150, 90, 50], [100, 60, 35], [230, 225, 210]);
painters.chicken_raw = meat([240, 200, 190], [210, 160, 150], [230, 225, 210]);
painters.chicken_cooked = meat([200, 140, 70], [150, 95, 45], [230, 225, 210]);
painters.rotten = blob([110, 80, 60], [70, 50, 40]);
painters.apple = (ctx) => pattern(ctx, ['................', '.......H........', '......H.........', '....RRRRRR......', '...RRRRRRRR.....', '..RRWRRRRRRR....', '..RRRRRRRRRR....', '..RRRRRRRRRR....', '...RRRRRRRR.....', '....RRR.RRR.....'], { R: [210, 40, 40], W: [255, 200, 200], H: [90, 60, 30] });
painters.brick = ingot([170, 90, 70], [120, 60, 50]);
painters.feather = (ctx) => pattern(ctx, ['..........WW....', '.........WWWW...', '........WWWWW...', '.......WWWWW....', '......WWWWW.....', '.....WWWWW......', '....WWWW........', '...GWW..........', '..GG............', '.GG.............'], { W: [245, 245, 245], G: [160, 160, 160] });
painters.bread = (ctx) => pattern(ctx, ['................', '................', '.........BB.....', '.......BBAAB....', '.....BBAAAAB....', '...BBAAAAAB.....', '..BAAAAAAB......', '..BAAAAAB.......', '..BAAABB........', '...BBB..........'], { A: [210, 160, 90], B: [150, 100, 50] });
painters.wheat = (ctx) => pattern(ctx, ['......Y.........', '.....YYY..Y.....', '......Y..YYY....', '.....YYY..Y.....', '......Y..YYY....', '.....YYY..Y.....', '......G..YYY....', '......G...G.....', '......G...G.....', '.......G.G......', '........G.......'], { Y: [220, 190, 80], G: [120, 150, 60] });

// ---------- atlas build ----------
export function buildAtlas() {
  const names = Object.keys(painters);
  const rows = Math.ceil(names.length / ATLAS_COLS);
  atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = ATLAS_COLS * TILE; atlasCanvas.height = rows * TILE;
  atlasCtx = atlasCanvas.getContext('2d');
  const tile = document.createElement('canvas'); tile.width = TILE; tile.height = TILE;
  const tctx = tile.getContext('2d');
  names.forEach((name, i) => {
    const rnd = mulberry32(i * 7919 + 17);
    painters[name](tctx, rnd);
    atlasCtx.drawImage(tile, (i % ATLAS_COLS) * TILE, Math.floor(i / ATLAS_COLS) * TILE);
    tileIndex.set(name, i);
  });
  const tex = new THREE.CanvasTexture(atlasCanvas);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.generateMipmaps = true; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { texture: tex, rows, canvas: atlasCanvas };
}
export function tileOf(name) { return tileIndex.get(name) ?? 0; }
export function blockTiles(id) {
  const d = BLOCKS[id];
  if (!d || !d.tex) return [0, 0, 0];
  if (Array.isArray(d.tex)) return d.tex.map(tileOf);
  const t = tileOf(d.tex); return [t, t, t];
}

// ---------- item icon rendering (isometric cube for blocks, flat sprite for items) ----------
const iconCache = new Map();
export function iconCanvas(id) {
  if (iconCache.has(id)) return iconCache.get(id).cloneNode ? cloneCanvas(iconCache.get(id)) : null;
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const d = getDef(id);
  if (!d) return c;
  if (id < 100) {
    if (d.shape === 'cross') {
      const t = tileOf(Array.isArray(d.tex) ? d.tex[1] : d.tex);
      drawTile(ctx, t, 0, 0, 32, 32, d.tint);
    } else {
      const [top, side] = blockTiles(id);
      drawIsoCube(ctx, top, side, d.tint, d.tintSide);
    }
  } else {
    drawTile(ctx, tileOf(d.icon), 0, 0, 32, 32);
  }
  iconCache.set(id, c);
  return cloneCanvas(c);
}
function cloneCanvas(src) { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); return c; }
function drawTile(ctx, t, dx, dy, dw, dh, tint) {
  const sx = (t % ATLAS_COLS) * TILE, sy = Math.floor(t / ATLAS_COLS) * TILE;
  ctx.drawImage(atlasCanvas, sx, sy, TILE, TILE, dx, dy, dw, dh);
  if (tint) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${tint[0] * 255 | 0},${tint[1] * 255 | 0},${tint[2] * 255 | 0})`; ctx.fillRect(dx, dy, dw, dh); ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(atlasCanvas, sx, sy, TILE, TILE, dx, dy, dw, dh); ctx.globalCompositeOperation = 'source-over'; }
}
function drawIsoCube(ctx, top, side, tint) {
  const tmp = document.createElement('canvas'); tmp.width = 16; tmp.height = 16;
  const tc = tmp.getContext('2d'); tc.imageSmoothingEnabled = false;
  const draw = (t, transform, shade) => {
    tc.clearRect(0, 0, 16, 16);
    drawTile(tc, t, 0, 0, 16, 16, tint);
    tc.globalCompositeOperation = 'multiply'; tc.fillStyle = `rgba(0,0,0,${1 - shade})`; tc.fillRect(0, 0, 16, 16);
    tc.globalCompositeOperation = 'destination-in'; drawTile(tc, t, 0, 0, 16, 16); tc.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(...transform); ctx.drawImage(tmp, 0, 0, 16, 16, 0, 0, 14, 14); ctx.restore();
  };
  // top (rhombus), left face, right face
  draw(top, [1, -0.5, 1, 0.5, 2, 9], 1.0);
  draw(side, [1, 0.5, 0, 1, 2, 9], 0.7);
  draw(side, [1, -0.5, 0, 1, 16, 16], 0.5);
}
void ITEMS;
