import * as THREE from 'three';
import { GRAVITY } from '../constants.js';
import { getDef, isSolidBlock } from '../blocks.js';

export class ItemDropsManager {
  constructor(scene, world, textureManager, inventory, sound) {
    this.scene = scene;
    this.world = world;
    this.textureManager = textureManager;
    this.inventory = inventory;
    this.sound = sound;

    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.drops = [];
    this.geomCache = new Map();
  }

  _createDropMesh(id) {
    const def = getDef(id);
    if (def.isBlock && !def.crossMesh) {
      let geom = this.geomCache.get(id);
      if (!geom) {
        geom = new THREE.BoxGeometry(0.28, 0.28, 0.28);
        const uvAttr = geom.attributes.uv;
        const faceDirs = ['side', 'side', 'top', 'bottom', 'side', 'side'];
        const shades = [0.8, 0.8, 1.0, 0.6, 0.9, 0.9];
        const colors = [];
        for (let f = 0; f < 6; f++) {
          const uv = this.textureManager.getBlockFaceUV(id, faceDirs[f]);
          const base = f * 4;
          uvAttr.setXY(base + 0, uv.u0, uv.v1);
          uvAttr.setXY(base + 1, uv.u1, uv.v1);
          uvAttr.setXY(base + 2, uv.u0, uv.v0);
          uvAttr.setXY(base + 3, uv.u1, uv.v0);
          for (let k = 0; k < 4; k++) colors.push(shades[f], shades[f], shades[f]);
        }
        geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        this.geomCache.set(id, geom);
      }
      const mat = new THREE.MeshBasicMaterial({
        map: this.textureManager.atlasTexture,
        vertexColors: true,
        transparent: Boolean(def.cutoutCube),
        alphaTest: def.cutoutCube ? 0.45 : 0,
      });
      return new THREE.Mesh(geom, mat);
    }

    const extGeom = this.textureManager.getExtrudedItemGeometry(id);
    if (extGeom) {
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
      const mesh = new THREE.Mesh(extGeom, mat);
      mesh.userData.sharedGeom = true;
      return mesh;
    }

    const tex = this.textureManager.getItemTexture(id);
    const geom = new THREE.PlaneGeometry(0.34, 0.34);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
    });
    return new THREE.Mesh(geom, mat);
  }

  spawnDrop(x, y, z, itemId, count = 1, customVel = null, pickupDelay = 0.32) {
    if (!itemId || count <= 0) return;
    const mesh = this._createDropMesh(itemId);
    mesh.position.set(x, y, z);
    this.group.add(mesh);

    const vx = customVel ? customVel.x : (Math.random() - 0.5) * 2.4;
    const vy = customVel ? customVel.y : 2.6 + Math.random() * 1.4;
    const vz = customVel ? customVel.z : (Math.random() - 0.5) * 2.4;

    this.drops.push({
      id: itemId,
      count,
      mesh,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(vx, vy, vz),
      age: 0,
      pickupDelay,
    });
  }

  spawnBlockHarvest(bx, by, bz, blockId) {
    const def = getDef(blockId);
    if (def.drop) {
      this.spawnDrop(bx + 0.5, by + 0.45, bz + 0.5, def.drop, 1);
    } else if (Array.isArray(def.dropChance)) {
      for (const entry of def.dropChance) {
        if (Math.random() < entry.chance) {
          this.spawnDrop(bx + 0.5, by + 0.45, bz + 0.5, entry.id, 1);
          break;
        }
      }
    }
  }

  update(dt, playerPos) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;

      if (d.age > 180) {
        this._removeAt(i);
        continue;
      }

      // Physics step
      d.vel.y = Math.max(-18, d.vel.y - GRAVITY * 0.65 * dt);
      const nextY = d.pos.y + d.vel.y * dt;
      if (isSolidBlock(this.world.getBlock(d.pos.x, nextY - 0.16, d.pos.z))) {
        d.pos.y = Math.floor(nextY - 0.16) + 1.16;
        d.vel.y = 0;
        d.vel.x *= 0.82;
        d.vel.z *= 0.82;
      } else {
        d.pos.y = nextY;
      }

      const nextX = d.pos.x + d.vel.x * dt;
      if (!isSolidBlock(this.world.getBlock(nextX, d.pos.y, d.pos.z))) {
        d.pos.x = nextX;
      } else {
        d.vel.x *= -0.4;
      }

      const nextZ = d.pos.z + d.vel.z * dt;
      if (!isSolidBlock(this.world.getBlock(d.pos.x, d.pos.y, nextZ))) {
        d.pos.z = nextZ;
      } else {
        d.vel.z *= -0.4;
      }

      // Magnetic pickup toward player waist
      if (d.age >= d.pickupDelay) {
        const tx = playerPos.x - d.pos.x;
        const ty = (playerPos.y + 0.85) - d.pos.y;
        const tz = playerPos.z - d.pos.z;
        const dist = Math.sqrt(tx * tx + ty * ty + tz * tz);

        if (dist < 2.25) {
          const pull = (2.4 - dist) * 9.5 * dt;
          d.pos.x += (tx / Math.max(0.05, dist)) * pull;
          d.pos.y += (ty / Math.max(0.05, dist)) * pull;
          d.pos.z += (tz / Math.max(0.05, dist)) * pull;

          if (dist < 0.65) {
            const leftover = this.inventory.addItem(d.id, d.count);
            if (leftover === 0) {
              this.sound.playPickup();
              this._removeAt(i);
              continue;
            } else if (leftover < d.count) {
              d.count = leftover;
              this.sound.playPickup();
            }
          }
        }
      }

      const bob = Math.sin(d.age * 3.4 + i) * 0.07;
      d.mesh.position.set(d.pos.x, d.pos.y + bob, d.pos.z);
      d.mesh.rotation.y = d.age * 1.9 + i;
    }
  }

  _removeAt(idx) {
    const d = this.drops[idx];
    this.group.remove(d.mesh);
    if (d.mesh.material) d.mesh.material.dispose();
    if (!this.geomCache.has(d.id) && !d.mesh.userData.sharedGeom && d.mesh.geometry) {
      d.mesh.geometry.dispose();
    }
    this.drops.splice(idx, 1);
  }

  dispose() {
    while (this.drops.length > 0) this._removeAt(0);
    for (const g of this.geomCache.values()) g.dispose();
    this.geomCache.clear();
    this.scene.remove(this.group);
  }
}
