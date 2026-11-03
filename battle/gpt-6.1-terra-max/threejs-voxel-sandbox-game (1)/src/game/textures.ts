import * as THREE from 'three'
import { Block } from './blocks'

const TILE = 16
const COLS = 8
const ROWS = 4

const T = {
  grassTop: 0, grassSide: 1, dirt: 2, stone: 3, logSide: 4, logTop: 5,
  leaves: 6, planks: 7, sand: 8, water: 9, flower: 10, tallGrass: 11,
  cobble: 12, tableSide: 13, tableTop: 14, coal: 15, iron: 16, wool: 17, furnace: 18,
}

function random(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

export function makeAtlas() {
  const canvas = document.createElement('canvas')
  canvas.width = TILE * COLS
  canvas.height = TILE * ROWS
  const ctx = canvas.getContext('2d')!

  const paint = (index: number, base: string | null, palette: string[], seed: number, count = 70) => {
    const x = (index % COLS) * TILE
    const y = Math.floor(index / COLS) * TILE
    if (base) {
      ctx.fillStyle = base
      ctx.fillRect(x, y, TILE, TILE)
    }
    const rand = random(seed)
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = palette[Math.floor(rand() * palette.length)]
      ctx.fillRect(x + Math.floor(rand() * 16), y + Math.floor(rand() * 16), rand() > 0.7 ? 2 : 1, rand() > 0.8 ? 2 : 1)
    }
  }
  const rect = (index: number, color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color
    ctx.fillRect((index % COLS) * TILE + x, Math.floor(index / COLS) * TILE + y, w, h)
  }

  paint(T.grassTop, '#78aa54', ['#84b85b', '#6f9d4d', '#92be62', '#709e4d', '#8bb95f'], 1, 135)
  paint(T.dirt, '#8e6548', ['#a87855', '#79543e', '#997052', '#b0805b'], 2, 105)
  paint(T.grassSide, '#8e6548', ['#a87855', '#79543e', '#997052', '#b0805b'], 2, 105)
  rect(T.grassSide, '#74a64f', 0, 0, 16, 4)
  rect(T.grassSide, '#8cba61', 0, 0, 16, 1)
  ;[0, 3, 4, 8, 11, 14].forEach((x, i) => rect(T.grassSide, i % 2 ? '#79a950' : '#699746', x, 3, 2, 2 + (i % 3)))
  paint(T.stone, '#929d94', ['#a6b0a5', '#7f8c84', '#9da89e', '#b1b8aa'], 4, 95)
  paint(T.logSide, '#8c6845', ['#755638', '#a47c50', '#6f5137', '#a78053'], 5, 50)
  ;[1, 5, 10, 14].forEach((x) => rect(T.logSide, '#755538', x, 0, 1, 16))
  ;[3, 8, 13].forEach((x) => rect(T.logSide, '#a88155', x, 1, 1, 13))
  paint(T.logTop, '#c6a475', ['#d4b787', '#b89264'], 6, 35)
  rect(T.logTop, '#97754e', 2, 2, 12, 1)
  rect(T.logTop, '#97754e', 2, 13, 12, 1)
  rect(T.logTop, '#97754e', 2, 2, 1, 12)
  rect(T.logTop, '#97754e', 13, 2, 1, 12)
  rect(T.logTop, '#ab875a', 5, 5, 6, 6)
  rect(T.logTop, '#d1ae7d', 6, 6, 4, 4)
  paint(T.leaves, '#558d49', ['#68a350', '#487e42', '#74ac58', '#4a8242', '#80b45f'], 7, 160)
  paint(T.planks, '#c49a67', ['#d2ad78', '#b3885a', '#d4ad78'], 8, 60)
  ;[0, 5, 10, 15].forEach((y) => rect(T.planks, '#9b744f', 0, y, 16, 1))
  rect(T.planks, '#a77d50', 5, 1, 1, 4)
  rect(T.planks, '#a77d50', 11, 6, 1, 4)
  rect(T.planks, '#a77d50', 3, 11, 1, 4)
  paint(T.sand, '#d8ca98', ['#e5d8aa', '#c9bc8d', '#ede0b0'], 9, 90)
  paint(T.water, '#72c5c8', ['#82d0d0', '#69b9c1', '#93d6d3'], 10, 35)
  rect(T.water, '#a2ddda', 2, 4, 5, 1)
  rect(T.water, '#a2ddda', 10, 11, 4, 1)
  paint(T.cobble, '#8e9990', ['#a6afa4', '#78867e', '#b0b9aa'], 12, 80)
  ;[4, 10, 15].forEach((y) => rect(T.cobble, '#748078', 0, y, 16, 1))
  rect(T.cobble, '#748078', 5, 0, 1, 4)
  rect(T.cobble, '#748078', 11, 5, 1, 5)
  rect(T.cobble, '#748078', 4, 11, 1, 4)
  paint(T.tableSide, '#9d754f', ['#b68c5d', '#805d3e', '#c39a68'], 13, 60)
  rect(T.tableSide, '#6d5039', 0, 0, 16, 2)
  rect(T.tableSide, '#6d5039', 2, 3, 2, 13)
  rect(T.tableSide, '#6d5039', 12, 3, 2, 13)
  rect(T.tableSide, '#cfaa74', 5, 5, 6, 5)
  paint(T.tableTop, '#c69b65', ['#d7b47d', '#a77b4e'], 14, 40)
  rect(T.tableTop, '#765539', 0, 0, 16, 2)
  rect(T.tableTop, '#765539', 0, 14, 16, 2)
  rect(T.tableTop, '#765539', 0, 0, 2, 16)
  rect(T.tableTop, '#765539', 14, 0, 2, 16)
  rect(T.tableTop, '#916b45', 7, 2, 2, 12)
  rect(T.tableTop, '#916b45', 2, 7, 12, 2)
  paint(T.coal, '#929d94', ['#a6b0a5', '#7f8c84', '#9da89e'], 4, 75)
  ;[[2, 3], [9, 2], [5, 9], [12, 11]].forEach(([x, y]) => rect(T.coal, '#414b47', x, y, 3, 3))
  paint(T.iron, '#929d94', ['#a6b0a5', '#7f8c84', '#9da89e'], 4, 75)
  ;[[2, 3], [9, 2], [5, 9], [12, 11]].forEach(([x, y]) => rect(T.iron, '#c9a68c', x, y, 3, 3))
  paint(T.wool, '#e2e3d4', ['#f0f0e4', '#d0d5c6', '#f9f8ed'], 17, 100)
  paint(T.furnace, '#8e9990', ['#a6afa4', '#78867e', '#b0b9aa'], 18, 70)
  rect(T.furnace, '#59655e', 2, 3, 12, 10)
  rect(T.furnace, '#333f3a', 4, 4, 8, 5)
  rect(T.furnace, '#b4bcae', 4, 11, 8, 1)

  // The transparent plant tiles are rendered as crossed quads in the terrain mesh.
  rect(T.flower, '#568348', 7, 7, 2, 9)
  rect(T.flower, '#74a451', 4, 10, 4, 2)
  rect(T.flower, '#74a451', 9, 12, 4, 2)
  rect(T.flower, '#f5f3dd', 5, 2, 6, 7)
  rect(T.flower, '#fffdf0', 3, 4, 10, 3)
  rect(T.flower, '#edc65f', 7, 4, 3, 3)
  rect(T.tallGrass, '#74a651', 3, 8, 2, 8)
  rect(T.tallGrass, '#6d9f4d', 6, 4, 2, 12)
  rect(T.tallGrass, '#83b55c', 9, 7, 2, 9)
  rect(T.tallGrass, '#5f9447', 12, 10, 2, 6)

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function tileFor(block: Block, face: number) {
  switch (block) {
    case Block.Grass: return face === 2 ? T.grassTop : face === 3 ? T.dirt : T.grassSide
    case Block.Dirt: return T.dirt
    case Block.Stone: return T.stone
    case Block.Log: return face === 2 || face === 3 ? T.logTop : T.logSide
    case Block.Leaves: return T.leaves
    case Block.Planks: return T.planks
    case Block.Sand: return T.sand
    case Block.Water: return T.water
    case Block.Flower: return T.flower
    case Block.TallGrass: return T.tallGrass
    case Block.Cobblestone: return T.cobble
    case Block.CraftingTable: return face === 2 ? T.tableTop : T.tableSide
    case Block.CoalOre: return T.coal
    case Block.IronOre: return T.iron
    case Block.Wool: return T.wool
    case Block.Furnace: return face === 2 || face === 3 ? T.stone : T.furnace
    default: return T.dirt
  }
}

export function tileUV(tile: number) {
  const x = tile % COLS
  const y = Math.floor(tile / COLS)
  const inset = 0.001
  return [x / COLS + inset, 1 - (y + 1) / ROWS + inset, (x + 1) / COLS - inset, 1 - y / ROWS - inset]
}