import * as THREE from 'three';
import { BLOCK_SHAPES } from '../constants.js';
import { BLOCK, BLOCKS } from '../data/blocks.js';
import { getEntry } from '../data/items.js';

export class ItemDropManager {
  constructor(scene, atlas) {
    this.scene = scene;
    this.atlas = atlas;
    this.drops = [];
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this._geometryCache = new Map();
    this._materialCache = new Map();
    this._blockMat = new THREE.MeshLambertMaterial({
      map: this.atlas.texture,
      alphaTest: 0.4,
    });
  }

  _getDropMesh(id) {
    const entry = getEntry(id);
    if (!entry) return null;

    if (entry.isBlock && BLOCKS[id].shape !== BLOCK_SHAPES.CROSS && BLOCKS[id].shape !== BLOCK_SHAPES.TORCH) {
      let geo = this._geometryCache.get(id);
      if (!geo) {
        geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
        // Remap BoxGeometry UVs per face (+x, -x, +y, -y, +z, -z)
        const uvAttr = geo.attributes.uv;
        const faceNames = ['side', 'side', 'top', 'bottom', 'front', 'side'];
        for (let f = 0; f < 6; f++) {
          const rect = this.atlas.getBlockFaceUV(id, faceNames[f]);
          const base = f * 4;
          uvAttr.setXY(base + 0, rect.u0, rect.v1);
          uvAttr.setXY(base + 1, rect.u1, rect.v1);
          uvAttr.setXY(base + 2, rect.u0, rect.v0);
          uvAttr.setXY(base + 3, rect.u1, rect.v0);
        }
        uvAttr.needsUpdate = true;
        this._geometryCache.set(id, geo);
      }
      return new THREE.Mesh(geo, this._blockMat);
    }

    // Flat item / flora sprite
    let mat = this._materialCache.get(id);
    if (!mat) {
      let tex;
      if (entry.isBlock) {
        const tileName = BLOCKS[id].textures.all || BLOCKS[id].textures.side || 'stone';
        const tileCanvas = this.atlas.tiles[tileName] || this.atlas.tiles.stone;
        tex = new THREE.CanvasTexture(tileCanvas);
      } else {
        const itemCanvas = this.atlas.getItemCanvas(id);
        tex = new THREE.CanvasTexture(itemCanvas);
      }
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      mat = new THREE.MeshLambertMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.4,
        side: THREE.DoubleSide,
      });
      this._materialCache.set(id, mat);
    }

    let planeGeo = this._geometryCache.get('sprite_plane');
    if (!planeGeo) {
      planeGeo = new THREE.PlaneGeometry(0.34, 0.34);
      this._geometryCache.set('sprite_plane', planeGeo);
    }
    return new THREE.Mesh(planeGeo, mat);
  }

  spawnDrop(x, y, z, id, count = 1, durability = undefined, velocity = null, pickupDelay = 0.28) {
    if (!id || count <= 0) return;
    if (this.drops.length > 160) {
      const oldest = this.drops.shift();
      if (oldest) this.group.remove(oldest.mesh);
    }

    // Merge with nearby identical stackable drop if possible
    const entry = getEntry(id);
    if (entry && entry.stackSize > 1 && !entry.maxDurability && !velocity) {
      for (const existing of this.drops) {
        if (existing.id === id && existing.count + count <= entry.stackSize) {
          const dx = existing.x - x;
          const dy = existing.y - y;
          const dz = existing.z - z;
          if (dx * dx + dy * dy + dz * dz < 0.85) {
            existing.count += count;
            existing.mesh.scale.setScalar(1.12);
            return;
          }
        }
      }
    }

    const mesh = this._getDropMesh(id);
    if (!mesh) return;
    mesh.position.set(x, y, z);
    this.group.add(mesh);

    this.drops.push({
      id,
      count,
      durability,
      x, y, z,
      vx: velocity ? velocity.x : (Math.random() - 0.5) * 2.4,
      vy: velocity ? velocity.y : 2.8 + Math.random() * 1.4,
      vz: velocity ? velocity.z : (Math.random() - 0.5) * 2.4,
      age: 0,
      pickupDelay,
      phase: Math.random() * Math.PI * 2,
      mesh,
    });
  }

  update(dt, world, playerPos, inventory, sound) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;

      if (d.age > 240) {
        this.group.remove(d.mesh);
        this.drops.splice(i, 1);
        continue;
      }

      // Gravity & buoyancy
      const inWater = world.getBlock(Math.floor(d.x), Math.floor(d.y), Math.floor(d.z)) === BLOCK.WATER;
      if (inWater) {
        d.vy += (2.5 - d.vy) * Math.min(1, dt * 4);
        d.vx *= 0.9;
        d.vz *= 0.9;
      } else {
        d.vy -= 18.0 * dt;
      }

      // Magnetic pull toward player when ready
      const targetY = playerPos.y + 0.85;
      const dx = playerPos.x - d.x;
      const dy = targetY - d.y;
      const dz = playerPos.z - d.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (d.age >= d.pickupDelay && distSq < 3.6) {
        const dist = Math.sqrt(distSq) || 0.001;
        if (dist < 0.75) {
          const leftover = inventory.addItem(d.id, d.count, d.durability);
          if (leftover < d.count) {
            sound.playPickup();
          }
          if (leftover <= 0) {
            this.group.remove(d.mesh);
            this.drops.splice(i, 1);
            continue;
          } else {
            d.count = leftover;
          }
        } else {
          const pull = 12.0 * dt;
          d.vx += (dx / dist) * pull * 4.5;
          d.vy += (dy / dist) * pull * 4.5;
          d.vz += (dz / dist) * pull * 4.5;
        }
      }

      // Move & collide against solid blocks
      const nx = d.x + d.vx * dt;
      if (!BLOCKS[world.getBlock(Math.floor(nx), Math.floor(d.y), Math.floor(d.z))]?.solid) {
        d.x = nx;
      } else {
        d.vx *= -0.3;
      }

      const nz = d.z + d.vz * dt;
      if (!BLOCKS[world.getBlock(Math.floor(d.x), Math.floor(d.y), Math.floor(nz))]?.solid) {
        d.z = nz;
      } else {
        d.vz *= -0.3;
      }

      const ny = d.y + d.vy * dt;
      if (!BLOCKS[world.getBlock(Math.floor(d.x), Math.floor(ny - 0.14), Math.floor(d.z))]?.solid) {
        d.y = ny;
      } else {
        d.y = Math.floor(ny - 0.14) + 1.15;
        d.vy = Math.abs(d.vy) > 1.8 ? Math.abs(d.vy) * 0.25 : 0;
        d.vx *= 0.80;
        d.vz *= 0.80;
      }

      // Spin & gentle hover bob
      const bob = Math.sin(d.age * 3.0 + d.phase) * 0.06;
      d.mesh.position.set(d.x, d.y + bob + 0.06, d.z);
      d.mesh.rotation.y += dt * 1.9;
    }
  }

  clear() {
    for (const d of this.drops) {
      this.group.remove(d.mesh);
    }
    this.drops = [];
  }
}
