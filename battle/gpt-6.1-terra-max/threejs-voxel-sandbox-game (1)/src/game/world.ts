import * as THREE from 'three'
import { Block, isPlant, isSolid } from './blocks'
import { makeAtlas, tileFor, tileUV } from './textures'

export const CHUNK_SIZE = 16
export const WORLD_HEIGHT = 48
export const WATER_LEVEL = 8
const RENDER_DISTANCE = 3

interface Chunk {
  x: number
  z: number
  blocks: Uint8Array
  group: THREE.Group
}

interface MeshData {
  positions: number[]
  normals: number[]
  uvs: number[]
  colors: number[]
  indices: number[]
}

const FACES = [
  { dir: [1, 0, 0], points: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.87 },
  { dir: [-1, 0, 0], points: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.77 },
  { dir: [0, 1, 0], points: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { dir: [0, -1, 0], points: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.62 },
  { dir: [0, 0, 1], points: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], shade: 0.92 },
  { dir: [0, 0, -1], points: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.8 },
]

const key = (x: number, z: number) => `${x},${z}`
const blockKey = (x: number, y: number, z: number) => `${x},${y},${z}`
const indexOf = (x: number, y: number, z: number) => x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE
const floorDiv = (n: number, d: number) => Math.floor(n / d)
const mod = (n: number, d: number) => ((n % d) + d) % d

function hash(x: number, z: number, seed: number) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function smooth(t: number) { return t * t * (3 - 2 * t) }

function noise(x: number, z: number, seed: number) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = smooth(x - ix)
  const fz = smooth(z - iz)
  const a = hash(ix, iz, seed) * (1 - fx) + hash(ix + 1, iz, seed) * fx
  const b = hash(ix, iz + 1, seed) * (1 - fx) + hash(ix + 1, iz + 1, seed) * fx
  return a * (1 - fz) + b * fz
}

function emptyMesh(): MeshData {
  return { positions: [], normals: [], uvs: [], colors: [], indices: [] }
}

function addQuad(data: MeshData, points: number[][], normal: number[], tile: number, shade: number) {
  const start = data.positions.length / 3
  const [u0, v0, u1, v1] = tileUV(tile)
  const uv = [[u0, v0], [u0, v1], [u1, v1], [u1, v0]]
  for (let i = 0; i < 4; i++) {
    data.positions.push(...points[i])
    data.normals.push(...normal)
    data.uvs.push(...uv[i])
    data.colors.push(shade, shade, shade)
  }
  data.indices.push(start, start + 1, start + 2, start, start + 2, start + 3)
}

function geometry(data: MeshData) {
  const result = new THREE.BufferGeometry()
  result.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3))
  result.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3))
  result.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2))
  result.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3))
  result.setIndex(data.indices)
  result.computeBoundingSphere()
  return result
}

export class VoxelWorld {
  readonly seed: number
  readonly edits = new Map<string, number>()
  private scene: THREE.Scene
  private chunks = new Map<string, Chunk>()
  private heightCache = new Map<string, number>()
  private queue: [number, number][] = []
  private dirty = new Set<string>()
  private centerX = 99999
  private centerZ = 99999
  private texture: THREE.CanvasTexture
  private terrainMaterial: THREE.MeshLambertMaterial
  private plantMaterial: THREE.MeshLambertMaterial
  private waterMaterial: THREE.MeshLambertMaterial

  constructor(scene: THREE.Scene, seed: number, edits?: Record<string, number>) {
    this.scene = scene
    this.seed = seed
    if (edits) Object.entries(edits).forEach(([k, v]) => this.edits.set(k, v))
    this.texture = makeAtlas()
    this.terrainMaterial = new THREE.MeshLambertMaterial({ map: this.texture, vertexColors: true })
    this.plantMaterial = new THREE.MeshLambertMaterial({ map: this.texture, vertexColors: true, transparent: false, alphaTest: 0.5, side: THREE.DoubleSide })
    this.waterMaterial = new THREE.MeshLambertMaterial({ map: this.texture, vertexColors: true, transparent: true, opacity: 0.78, depthWrite: false })
  }

  heightAt(x: number, z: number) {
    const k = key(x, z)
    const cached = this.heightCache.get(k)
    if (cached !== undefined) return cached
    const broad = noise(x / 55, z / 55, this.seed)
    const rolling = noise(x / 22, z / 22, this.seed + 13)
    const detail = noise(x / 9, z / 9, this.seed + 47)
    // A shallow lake and a distant ridge give every new world a welcoming first view.
    const lake = Math.exp(-(((x + 15) / 14) ** 2 + ((z + 23) / 12) ** 2)) * 6
    const ridge = Math.exp(-(((x - 1) / 26) ** 2 + ((z + 47) / 15) ** 2)) * 5
    const height = Math.max(3, Math.min(29, Math.floor(5 + broad * 7 + rolling * 5 + detail * 2 - lake + ridge)))
    this.heightCache.set(k, height)
    return height
  }

  biomeAt(x: number, z: number) {
    if (this.heightAt(Math.floor(x), Math.floor(z)) <= WATER_LEVEL + 1) return 'Riverside'
    return noise(x / 65, z / 65, this.seed + 102) > 0.46 ? 'Oak Woodland' : 'Sunlit Meadow'
  }

  private treeAt(gx: number, gz: number) {
    const x = gx * 7 + 1 + Math.floor(hash(gx, gz, this.seed + 211) * 5)
    const z = gz * 7 + 1 + Math.floor(hash(gx, gz, this.seed + 317) * 5)
    const y = this.heightAt(x, z)
    const forest = noise(x / 65, z / 65, this.seed + 102) > 0.46
    const chance = forest ? 0.76 : 0.38
    const inSpawnClearing = x * x + z * z < 190
    const inScenicOpening = z < 0 && z > -28 && Math.abs(x - z * 0.35) < 6
    const exists = hash(gx, gz, this.seed + 617) < chance && y > WATER_LEVEL + 1 && !inSpawnClearing && !inScenicOpening
    return { x, y, z, exists, height: 4 + Math.floor(hash(gx, gz, this.seed + 11) * 3) }
  }

  private generate(cx: number, cz: number) {
    const chunk: Chunk = { x: cx, z: cz, blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT), group: new THREE.Group() }
    const baseX = cx * CHUNK_SIZE
    const baseZ = cz * CHUNK_SIZE
    const setLocal = (wx: number, y: number, wz: number, block: Block, replace = false) => {
      const x = wx - baseX
      const z = wz - baseZ
      if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT) return
      const i = indexOf(x, y, z)
      if (replace || chunk.blocks[i] === Block.Air || isPlant(chunk.blocks[i])) chunk.blocks[i] = block
    }

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = baseX + x
        const wz = baseZ + z
        const height = this.heightAt(wx, wz)
        const shore = height <= WATER_LEVEL + 1
        for (let y = 0; y <= height; y++) {
          let block = y === height ? (shore ? Block.Sand : Block.Grass) : y > height - 4 ? (shore ? Block.Sand : Block.Dirt) : Block.Stone
          if (block === Block.Stone && y > 1 && y < height - 3) {
            const mineral = hash(wx * 13 + y * 7, wz * 17 - y * 11, this.seed + 920)
            if (mineral > 0.987) block = Block.CoalOre
            else if (mineral < 0.007 && y < 10) block = Block.IronOre
          }
          chunk.blocks[indexOf(x, y, z)] = block
        }
        for (let y = height + 1; y <= WATER_LEVEL; y++) chunk.blocks[indexOf(x, y, z)] = Block.Water
        if (!shore) {
          const flora = hash(wx, wz, this.seed + 741)
          if (flora > 0.985) setLocal(wx, height + 1, wz, Block.Flower)
          else if (flora > 0.92) setLocal(wx, height + 1, wz, Block.TallGrass)
        }
      }
    }

    for (let gx = floorDiv(baseX - 3, 7); gx <= floorDiv(baseX + CHUNK_SIZE + 3, 7); gx++) {
      for (let gz = floorDiv(baseZ - 3, 7); gz <= floorDiv(baseZ + CHUNK_SIZE + 3, 7); gz++) {
        const tree = this.treeAt(gx, gz)
        if (!tree.exists) continue
        for (let y = 1; y <= tree.height; y++) setLocal(tree.x, tree.y + y, tree.z, Block.Log, true)
        for (let dy = -2; dy <= 1; dy++) {
          const radius = dy === 1 ? 1 : 2
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              if (Math.abs(dx) === radius && Math.abs(dz) === radius && hash(tree.x + dx, tree.z + dz + dy, this.seed) > 0.38) continue
              setLocal(tree.x + dx, tree.y + tree.height + dy, tree.z + dz, Block.Leaves)
            }
          }
        }
      }
    }

    this.edits.forEach((block, position) => {
      const [x, y, z] = position.split(',').map(Number)
      if (floorDiv(x, CHUNK_SIZE) === cx && floorDiv(z, CHUNK_SIZE) === cz && y >= 0 && y < WORLD_HEIGHT) {
        chunk.blocks[indexOf(mod(x, CHUNK_SIZE), y, mod(z, CHUNK_SIZE))] = block
      }
    })
    this.chunks.set(key(cx, cz), chunk)
    this.scene.add(chunk.group)
    return chunk
  }

  initialize(x: number, z: number) {
    const cx = floorDiv(x, CHUNK_SIZE)
    const cz = floorDiv(z, CHUNK_SIZE)
    for (let dx = -2; dx <= 2; dx++) for (let dz = -3; dz <= 2; dz++) this.generate(cx + dx, cz + dz)
    this.chunks.forEach((chunk) => this.rebuild(chunk))
    this.recenter(x, z)
  }

  private recenter(x: number, z: number) {
    const cx = floorDiv(x, CHUNK_SIZE)
    const cz = floorDiv(z, CHUNK_SIZE)
    if (cx === this.centerX && cz === this.centerZ) return
    this.centerX = cx
    this.centerZ = cz
    this.queue = []
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        if (!this.chunks.has(key(cx + dx, cz + dz))) this.queue.push([cx + dx, cz + dz])
      }
    }
    this.queue.sort((a, b) => ((a[0] - cx) ** 2 + (a[1] - cz) ** 2) - ((b[0] - cx) ** 2 + (b[1] - cz) ** 2))
    this.chunks.forEach((chunk, k) => {
      if (Math.abs(chunk.x - cx) > RENDER_DISTANCE + 1 || Math.abs(chunk.z - cz) > RENDER_DISTANCE + 1) {
        this.disposeChunk(chunk)
        this.chunks.delete(k)
        this.dirty.delete(k)
      }
    })
    if (this.heightCache.size > 100000) this.heightCache.clear()
  }

  update(x: number, z: number) {
    this.recenter(x, z)
    const next = this.queue.shift()
    if (next && !this.chunks.has(key(next[0], next[1]))) {
      this.generate(next[0], next[1])
      this.dirty.add(key(next[0], next[1]))
      ;[[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => {
        const neighbor = key(next[0] + dx, next[1] + dz)
        if (this.chunks.has(neighbor)) this.dirty.add(neighbor)
      })
    }
    for (let i = 0; i < 2 && this.dirty.size; i++) {
      const k = this.dirty.values().next().value as string
      this.dirty.delete(k)
      const chunk = this.chunks.get(k)
      if (chunk) this.rebuild(chunk)
    }
  }

  getBlock(x: number, y: number, z: number): Block {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z)
    if (y < 0) return Block.Stone
    if (y >= WORLD_HEIGHT) return Block.Air
    const chunk = this.chunks.get(key(floorDiv(x, CHUNK_SIZE), floorDiv(z, CHUNK_SIZE)))
    if (!chunk) return Block.Air
    return chunk.blocks[indexOf(mod(x, CHUNK_SIZE), y, mod(z, CHUNK_SIZE))] as Block
  }

  setBlock(x: number, y: number, z: number, block: Block) {
    const cx = floorDiv(x, CHUNK_SIZE)
    const cz = floorDiv(z, CHUNK_SIZE)
    const chunk = this.chunks.get(key(cx, cz))
    if (!chunk || y <= 0 || y >= WORLD_HEIGHT) return false
    chunk.blocks[indexOf(mod(x, CHUNK_SIZE), y, mod(z, CHUNK_SIZE))] = block
    this.edits.set(blockKey(x, y, z), block)
    this.dirty.add(key(cx, cz))
    if (mod(x, CHUNK_SIZE) === 0) this.dirty.add(key(cx - 1, cz))
    if (mod(x, CHUNK_SIZE) === CHUNK_SIZE - 1) this.dirty.add(key(cx + 1, cz))
    if (mod(z, CHUNK_SIZE) === 0) this.dirty.add(key(cx, cz - 1))
    if (mod(z, CHUNK_SIZE) === CHUNK_SIZE - 1) this.dirty.add(key(cx, cz + 1))
    return true
  }

  private rebuild(chunk: Chunk) {
    while (chunk.group.children.length) {
      const child = chunk.group.children[0] as THREE.Mesh
      chunk.group.remove(child)
      child.geometry.dispose()
    }
    const solid = emptyMesh()
    const water = emptyMesh()
    const plants = emptyMesh()
    const bx = chunk.x * CHUNK_SIZE
    const bz = chunk.z * CHUNK_SIZE
    for (let y = 1; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const block = chunk.blocks[indexOf(x, y, z)] as Block
          if (block === Block.Air) continue
          const wx = bx + x
          const wz = bz + z
          const variation = 0.94 + hash(wx, wz, this.seed + y) * 0.06
          if (isPlant(block)) {
            const tile = tileFor(block, 0)
            addQuad(plants, [[wx + 0.12, y, wz + 0.12], [wx + 0.12, y + 1, wz + 0.12], [wx + 0.88, y + 1, wz + 0.88], [wx + 0.88, y, wz + 0.88]], [0.7, 0, -0.7], tile, variation)
            addQuad(plants, [[wx + 0.88, y, wz + 0.12], [wx + 0.88, y + 1, wz + 0.12], [wx + 0.12, y + 1, wz + 0.88], [wx + 0.12, y, wz + 0.88]], [-0.7, 0, -0.7], tile, variation)
            continue
          }
          for (let face = 0; face < FACES.length; face++) {
            const { dir, points, shade } = FACES[face]
            const neighbor = this.getBlock(wx + dir[0], y + dir[1], wz + dir[2])
            if (block === Block.Water ? (neighbor === Block.Water || isSolid(neighbor)) : isSolid(neighbor)) continue
            const target = block === Block.Water ? water : solid
            addQuad(target, points.map((p) => [wx + p[0], y + p[1], wz + p[2]]), dir, tileFor(block, face), shade * variation)
          }
        }
      }
    }
    ;[[solid, this.terrainMaterial], [plants, this.plantMaterial], [water, this.waterMaterial]].forEach(([data, material]) => {
      const meshData = data as MeshData
      if (!meshData.indices.length) return
      const mesh = new THREE.Mesh(geometry(meshData), material as THREE.Material)
      mesh.castShadow = material !== this.waterMaterial
      mesh.receiveShadow = true
      chunk.group.add(mesh)
    })
  }

  private disposeChunk(chunk: Chunk) {
    this.scene.remove(chunk.group)
    chunk.group.children.forEach((child) => (child as THREE.Mesh).geometry.dispose())
  }

  dispose() {
    this.chunks.forEach((chunk) => this.disposeChunk(chunk))
    this.texture.dispose()
    this.terrainMaterial.dispose()
    this.plantMaterial.dispose()
    this.waterMaterial.dispose()
  }
}