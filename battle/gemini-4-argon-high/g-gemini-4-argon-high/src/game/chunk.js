import * as THREE from 'three';
import { BLOCK, REGISTRY, CHUNK_SIZE, CHUNK_HEIGHT } from './constants.js';

const FACE_DEFS = [
  {
    // +Y (Top)
    dir: [0, 1, 0],
    faceKey: 'top',
    shade: 1.0,
    corners: [
      { pos: [0, 1, 1], ao: [[-1, 1, 0], [0, 1, 1], [-1, 1, 1]], uv: [0, 0] },
      { pos: [1, 1, 1], ao: [[1, 1, 0], [0, 1, 1], [1, 1, 1]], uv: [1, 0] },
      { pos: [1, 1, 0], ao: [[1, 1, 0], [0, 1, -1], [1, 1, -1]], uv: [1, 1] },
      { pos: [0, 1, 0], ao: [[-1, 1, 0], [0, 1, -1], [-1, 1, -1]], uv: [0, 1] },
    ],
  },
  {
    // -Y (Bottom)
    dir: [0, -1, 0],
    faceKey: 'bottom',
    shade: 0.54,
    corners: [
      { pos: [0, 0, 0], ao: [[-1, -1, 0], [0, -1, -1], [-1, -1, -1]], uv: [0, 0] },
      { pos: [1, 0, 0], ao: [[1, -1, 0], [0, -1, -1], [1, -1, -1]], uv: [1, 0] },
      { pos: [1, 0, 1], ao: [[1, -1, 0], [0, -1, 1], [1, -1, 1]], uv: [1, 1] },
      { pos: [0, 0, 1], ao: [[-1, -1, 0], [0, -1, 1], [-1, -1, 1]], uv: [0, 1] },
    ],
  },
  {
    // +Z (South / Front)
    dir: [0, 0, 1],
    faceKey: 'side',
    shade: 0.85,
    corners: [
      { pos: [0, 0, 1], ao: [[-1, 0, 1], [0, -1, 1], [-1, -1, 1]], uv: [0, 0] },
      { pos: [1, 0, 1], ao: [[1, 0, 1], [0, -1, 1], [1, -1, 1]], uv: [1, 0] },
      { pos: [1, 1, 1], ao: [[1, 0, 1], [0, 1, 1], [1, 1, 1]], uv: [1, 1] },
      { pos: [0, 1, 1], ao: [[-1, 0, 1], [0, 1, 1], [-1, 1, 1]], uv: [0, 1] },
    ],
  },
  {
    // -Z (North / Back)
    dir: [0, 0, -1],
    faceKey: 'side',
    shade: 0.85,
    corners: [
      { pos: [1, 0, 0], ao: [[1, 0, -1], [0, -1, -1], [1, -1, -1]], uv: [0, 0] },
      { pos: [0, 0, 0], ao: [[-1, 0, -1], [0, -1, -1], [-1, -1, -1]], uv: [1, 0] },
      { pos: [0, 1, 0], ao: [[-1, 0, -1], [0, 1, -1], [-1, 1, -1]], uv: [1, 1] },
      { pos: [1, 1, 0], ao: [[1, 0, -1], [0, 1, -1], [1, 1, -1]], uv: [0, 1] },
    ],
  },
  {
    // +X (East / Right)
    dir: [1, 0, 0],
    faceKey: 'side',
    shade: 0.73,
    corners: [
      { pos: [1, 0, 1], ao: [[1, 0, 1], [1, -1, 0], [1, -1, 1]], uv: [0, 0] },
      { pos: [1, 0, 0], ao: [[1, 0, -1], [1, -1, 0], [1, -1, -1]], uv: [1, 0] },
      { pos: [1, 1, 0], ao: [[1, 0, -1], [1, 1, 0], [1, 1, -1]], uv: [1, 1] },
      { pos: [1, 1, 1], ao: [[1, 0, 1], [1, 1, 0], [1, 1, 1]], uv: [0, 1] },
    ],
  },
  {
    // -X (West / Left)
    dir: [-1, 0, 0],
    faceKey: 'side',
    shade: 0.73,
    corners: [
      { pos: [0, 0, 0], ao: [[-1, 0, -1], [-1, -1, 0], [-1, -1, -1]], uv: [0, 0] },
      { pos: [0, 0, 1], ao: [[-1, 0, 1], [-1, -1, 0], [-1, -1, 1]], uv: [1, 0] },
      { pos: [0, 1, 1], ao: [[-1, 0, 1], [-1, 1, 0], [-1, 1, 1]], uv: [1, 1] },
      { pos: [0, 1, 0], ao: [[-1, 0, -1], [-1, 1, 0], [-1, 1, -1]], uv: [0, 1] },
    ],
  },
];

const AO_CURVE = [0.5, 0.7, 0.86, 1.0];

export class Chunk {
  constructor(cx, cz, data, world) {
    this.cx = cx;
    this.cz = cz;
    this.data = data;
    this.world = world;
    this.opaqueMesh = null;
    this.transparentMesh = null;
    this.dirty = true;
    this.lightSources = [];
  }

  index(lx, y, lz) {
    return y * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;
  }

  getLocal(lx, y, lz) {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK.AIR;
    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      return this.data[this.index(lx, y, lz)];
    }
    return this.world.getBlock(this.cx * CHUNK_SIZE + lx, y, this.cz * CHUNK_SIZE + lz);
  }

  setLocal(lx, y, lz, blockId) {
    if (y < 0 || y >= CHUNK_HEIGHT || lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
    this.data[this.index(lx, y, lz)] = blockId;
    this.dirty = true;
  }

  isOccluder(lx, y, lz) {
    const id = this.getLocal(lx, y, lz);
    if (id === BLOCK.AIR) return false;
    const def = REGISTRY[id];
    if (!def || def.transparent || def.isTorch) return false;
    return true;
  }

  rebuildMesh(textures, opaqueMaterial, transparentMaterial) {
    this.disposeMeshes();
    this.lightSources = [];

    // Scan light-emitting blocks in this chunk & 1-chunk margin
    for (let y = 1; y < CHUNK_HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const id = this.data[this.index(lx, y, lz)];
          const def = REGISTRY[id];
          if (def && def.light) {
            this.lightSources.push({
              wx: this.cx * CHUNK_SIZE + lx + 0.5,
              wy: y + 0.5,
              wz: this.cz * CHUNK_SIZE + lz + 0.5,
              level: def.light,
            });
          }
        }
      }
    }

    // Also include light sources from immediate neighbor chunks
    const nearbyLights = [...this.lightSources];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const nChunk = this.world.getChunk(this.cx + dx, this.cz + dz);
        if (nChunk && nChunk.lightSources && nChunk.lightSources.length > 0) {
          for (const ls of nChunk.lightSources) {
            nearbyLights.push(ls);
          }
        }
      }
    }

    const opaque = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
    const trans = { positions: [], normals: [], uvs: [], colors: [], indices: [] };

    const worldStartX = this.cx * CHUNK_SIZE;
    const worldStartZ = this.cz * CHUNK_SIZE;

    const computeLightBoost = (wx, wy, wz) => {
      if (nearbyLights.length === 0) return 0;
      let maxBoost = 0;
      for (let i = 0; i < nearbyLights.length; i++) {
        const ls = nearbyLights[i];
        const dx = wx - ls.wx;
        const dy = wy - ls.wy;
        const dz = wz - ls.wz;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < 64) {
          const dist = Math.sqrt(distSq);
          const b = Math.max(0, (1 - dist / 8.0) * (ls.level / 15));
          if (b > maxBoost) maxBoost = b;
        }
      }
      return maxBoost;
    };

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const id = this.data[this.index(lx, y, lz)];
          if (id === BLOCK.AIR) continue;
          const def = REGISTRY[id];
          if (!def) continue;

          const wx = worldStartX + lx;
          const wz = worldStartZ + lz;

          if (def.isTorch) {
            this._emitTorchGeometry(opaque, wx, y, wz, textures.getTileUV(def.faces.all));
            continue;
          }

          const target = def.transparent ? trans : opaque;
          const isWater = id === BLOCK.WATER;
          const topIsAir = isWater && this.getLocal(lx, y + 1, lz) === BLOCK.AIR;

          for (let f = 0; f < 6; f++) {
            const face = FACE_DEFS[f];
            const nx = lx + face.dir[0];
            const ny = y + face.dir[1];
            const nz = lz + face.dir[2];

            const neighborId = this.getLocal(nx, ny, nz);
            if (neighborId !== BLOCK.AIR) {
              const nDef = REGISTRY[neighborId];
              if (nDef && !nDef.isTorch) {
                if (!def.transparent && !nDef.transparent) continue; // Opaque hidden by opaque
                if (def.transparent && neighborId === id) continue; // Same translucent type
                if (def.transparent && !nDef.transparent) continue; // Translucent hidden by solid
              }
            }

            const tileIdx = def.faces[face.faceKey] ?? def.faces.all ?? 0;
            const uvRect = textures.getTileUV(tileIdx);

            const vBase = target.positions.length / 3;
            const aoVals = [3, 3, 3, 3];

            for (let c = 0; c < 4; c++) {
              const corner = face.corners[c];
              let vx = wx + corner.pos[0];
              let vy = y + corner.pos[1];
              let vz = wz + corner.pos[2];

              if (topIsAir && corner.pos[1] === 1) {
                vy -= 0.12; // Lower water surface slightly
              }

              target.positions.push(vx, vy, vz);
              target.normals.push(face.dir[0], face.dir[1], face.dir[2]);

              const u = corner.uv[0] === 0 ? uvRect.u0 : uvRect.u1;
              const v = corner.uv[1] === 0 ? uvRect.v0 : uvRect.v1;
              target.uvs.push(u, v);

              // Vertex AO calculation
              const s1 = this.isOccluder(lx + corner.ao[0][0], y + corner.ao[0][1], lz + corner.ao[0][2]) ? 1 : 0;
              const s2 = this.isOccluder(lx + corner.ao[1][0], y + corner.ao[1][1], lz + corner.ao[1][2]) ? 1 : 0;
              const sc = this.isOccluder(lx + corner.ao[2][0], y + corner.ao[2][1], lz + corner.ao[2][2]) ? 1 : 0;
              const aoLevel = s1 && s2 ? 0 : 3 - (s1 + s2 + sc);
              aoVals[c] = aoLevel;

              const baseLight = face.shade * AO_CURVE[aoLevel];
              const torchBoost = def.light ? 0.45 : computeLightBoost(vx, vy, vz);

              const r = Math.min(1.15, baseLight + torchBoost * 0.55);
              const g = Math.min(1.12, baseLight + torchBoost * 0.46);
              const b = Math.min(1.05, baseLight + torchBoost * 0.28);
              target.colors.push(r, g, b);
            }

            // Flip diagonal if needed for smooth AO interpolation
            if (aoVals[0] + aoVals[2] > aoVals[1] + aoVals[3]) {
              target.indices.push(vBase, vBase + 1, vBase + 2, vBase, vBase + 2, vBase + 3);
            } else {
              target.indices.push(vBase + 1, vBase + 2, vBase + 3, vBase + 1, vBase + 3, vBase);
            }
          }
        }
      }
    }

    if (opaque.positions.length > 0) {
      const geo = this._buildBufferGeometry(opaque);
      this.opaqueMesh = new THREE.Mesh(geo, opaqueMaterial);
      this.opaqueMesh.castShadow = true;
      this.opaqueMesh.receiveShadow = true;
      this.world.scene.add(this.opaqueMesh);
    }

    if (trans.positions.length > 0) {
      const geo = this._buildBufferGeometry(trans);
      this.transparentMesh = new THREE.Mesh(geo, transparentMaterial);
      this.transparentMesh.renderOrder = 1;
      this.world.scene.add(this.transparentMesh);
    }

    this.dirty = false;
  }

  _emitTorchGeometry(target, wx, wy, wz, uvRect) {
    const minX = wx + 0.41;
    const maxX = wx + 0.59;
    const minY = wy;
    const maxY = wy + 0.64;
    const minZ = wz + 0.41;
    const maxZ = wz + 0.59;

    const faces = [
      // +Z
      [
        [minX, minY, maxZ, uvRect.u0, uvRect.v0],
        [maxX, minY, maxZ, uvRect.u1, uvRect.v0],
        [maxX, maxY, maxZ, uvRect.u1, uvRect.v1],
        [minX, maxY, maxZ, uvRect.u0, uvRect.v1],
      ],
      // -Z
      [
        [maxX, minY, minZ, uvRect.u0, uvRect.v0],
        [minX, minY, minZ, uvRect.u1, uvRect.v0],
        [minX, maxY, minZ, uvRect.u1, uvRect.v1],
        [maxX, maxY, minZ, uvRect.u0, uvRect.v1],
      ],
      // +X
      [
        [maxX, minY, maxZ, uvRect.u0, uvRect.v0],
        [maxX, minY, minZ, uvRect.u1, uvRect.v0],
        [maxX, maxY, minZ, uvRect.u1, uvRect.v1],
        [maxX, maxY, maxZ, uvRect.u0, uvRect.v1],
      ],
      // -X
      [
        [minX, minY, minZ, uvRect.u0, uvRect.v0],
        [minX, minY, maxZ, uvRect.u1, uvRect.v0],
        [minX, maxY, maxZ, uvRect.u1, uvRect.v1],
        [minX, maxY, minZ, uvRect.u0, uvRect.v1],
      ],
      // Top
      [
        [minX, maxY, maxZ, uvRect.u0, uvRect.v1],
        [maxX, maxY, maxZ, uvRect.u1, uvRect.v1],
        [maxX, maxY, minZ, uvRect.u1, uvRect.v1],
        [minX, maxY, minZ, uvRect.u0, uvRect.v1],
      ],
    ];

    for (const quad of faces) {
      const vBase = target.positions.length / 3;
      for (const [px, py, pz, u, v] of quad) {
        target.positions.push(px, py, pz);
        target.normals.push(0, 1, 0);
        target.uvs.push(u, v);
        target.colors.push(1.15, 1.08, 0.9);
      }
      target.indices.push(vBase, vBase + 1, vBase + 2, vBase, vBase + 2, vBase + 3);
    }
  }

  _buildBufferGeometry(buffers) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(buffers.positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(buffers.normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(buffers.uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(buffers.colors, 3));
    geo.setIndex(buffers.indices);
    geo.computeBoundingSphere();
    return geo;
  }

  disposeMeshes() {
    if (this.opaqueMesh) {
      this.world.scene.remove(this.opaqueMesh);
      this.opaqueMesh.geometry.dispose();
      this.opaqueMesh = null;
    }
    if (this.transparentMesh) {
      this.world.scene.remove(this.transparentMesh);
      this.transparentMesh.geometry.dispose();
      this.transparentMesh = null;
    }
  }
}
