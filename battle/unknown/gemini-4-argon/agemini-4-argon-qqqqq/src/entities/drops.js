import * as THREE from 'three';
import { BLOCK, getDef } from '../world/blocks.js';

export class DropManager {
  constructor(scene, world, textureManager, inventory, sound) {
    this.scene = scene;
    this.world = world;
    this.textureManager = textureManager;
    this.inventory = inventory;
    this.sound = sound;
    this.drops = [];
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.meshProtoCache = new Map();
  }

  createDropMesh(id) {
    const def = getDef(id);
    if (def.isBlock && def.solid) {
      const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
      const uvAttr = geo.attributes.uv;
      const faceNames = [def.tex.side, def.tex.side, def.tex.top, def.tex.bottom, def.tex.front, def.tex.side];
      for (let f = 0; f < 6; f++) {
        const uv = this.textureManager.getUV(faceNames[f]);
        const base = f * 4;
        uvAttr.setXY(base + 0, uv.u0, uv.v0);
        uvAttr.setXY(base + 1, uv.u1, uv.v0);
        uvAttr.setXY(base + 2, uv.u0, uv.v1);
        uvAttr.setXY(base + 3, uv.u1, uv.v1);
      }
      uvAttr.needsUpdate = true;
      const mat = new THREE.MeshLambertMaterial({
        map: this.textureManager.atlasTexture,
        alphaTest: 0.4,
      });
      return new THREE.Mesh(geo, mat);
    }

    if (typeof document !== 'undefined') {
      const url = this.textureManager.getIconUrl(id);
      if (url) {
        const tex = new THREE.TextureLoader().load(url);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        const geo = new THREE.PlaneGeometry(0.36, 0.36);
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          alphaTest: 0.2,
          side: THREE.DoubleSide,
        });
        return new THREE.Mesh(geo, mat);
      }
    }

    const fallbackGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    const fallbackMat = new THREE.MeshLambertMaterial({ color: def.color || '#ffffff' });
    return new THREE.Mesh(fallbackGeo, fallbackMat);
  }

  spawnDrop(x, y, z, id, count = 1, durability = null, pickupDelay = 0.22, throwVel = null) {
    if (!id || id === BLOCK.AIR || count <= 0) return;

    // Merge into nearby identical stack to keep scene clean
    if (!durability && !throwVel) {
      for (const d of this.drops) {
        if (d.id === id && d.count + count <= 64 && d.pos.distanceToSquared({ x, y, z }) < 1.2) {
          d.count += count;
          return;
        }
      }
    }

    if (this.drops.length > 140) {
      const oldest = this.drops.shift();
      this.disposeDrop(oldest);
    }

    const mesh = this.createDropMesh(id);
    const pos = new THREE.Vector3(x, y, z);
    const vel = throwVel
      ? throwVel.clone()
      : new THREE.Vector3((Math.random() - 0.5) * 2.2, 3.2 + Math.random() * 1.4, (Math.random() - 0.5) * 2.2);

    mesh.position.copy(pos);
    this.group.add(mesh);

    this.drops.push({
      id,
      count,
      durability,
      pos,
      vel,
      mesh,
      age: 0,
      pickupDelay,
      phase: Math.random() * Math.PI * 2,
    });
  }

  spawnBlockDrops(bx, by, bz, blockId) {
    const def = getDef(blockId);
    if (!def) return;
    if (def.drop && def.drop !== BLOCK.AIR) {
      this.spawnDrop(bx + 0.5, by + 0.45, bz + 0.5, def.drop, def.dropCount || 1);
    }
    if (Array.isArray(def.bonusDrop)) {
      for (const bonus of def.bonusDrop) {
        if (Math.random() < bonus.chance) {
          this.spawnDrop(bx + 0.5, by + 0.45, bz + 0.5, bonus.id, bonus.count || 1);
        }
      }
    }
  }

  update(dt, playerPos) {
    const clampedDt = Math.min(0.05, dt);

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += clampedDt;
      if (d.age > 180) {
        this.disposeDrop(d);
        this.drops.splice(i, 1);
        continue;
      }

      // Gravity & simple ground collision
      d.vel.y = Math.max(-18, d.vel.y - 20 * clampedDt);
      const nextY = d.pos.y + d.vel.y * clampedDt;
      const belowBlock = this.world.getBlock(d.pos.x, nextY - 0.16, d.pos.z);

      if (d.vel.y < 0 && belowBlock !== BLOCK.AIR && getDef(belowBlock).solid) {
        d.pos.y = Math.floor(nextY - 0.16) + 1.16;
        d.vel.y = 0;
        d.vel.x *= Math.pow(0.12, clampedDt);
        d.vel.z *= Math.pow(0.12, clampedDt);
      } else {
        d.pos.y = nextY;
      }

      const nextX = d.pos.x + d.vel.x * clampedDt;
      if (!getDef(this.world.getBlock(nextX, d.pos.y, d.pos.z)).solid) {
        d.pos.x = nextX;
      } else {
        d.vel.x = 0;
      }

      const nextZ = d.pos.z + d.vel.z * clampedDt;
      if (!getDef(this.world.getBlock(d.pos.x, d.pos.y, nextZ)).solid) {
        d.pos.z = nextZ;
      } else {
        d.vel.z = 0;
      }

      // Magnetic pull toward player
      if (d.age >= d.pickupDelay) {
        const targetY = playerPos.y + 0.9;
        const dx = playerPos.x - d.pos.x;
        const dy = targetY - d.pos.y;
        const dz = playerPos.z - d.pos.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < 4.8) {
          const dist = Math.sqrt(distSq) || 0.001;
          const pull = 10.5 * clampedDt;
          d.pos.x += (dx / dist) * pull;
          d.pos.y += (dy / dist) * pull;
          d.pos.z += (dz / dist) * pull;

          if (dist < 0.85) {
            const leftover = this.inventory.addItem(d.id, d.count, d.durability);
            if (leftover < d.count) {
              if (this.sound) this.sound.playPickup();
              if (leftover <= 0) {
                this.disposeDrop(d);
                this.drops.splice(i, 1);
                continue;
              } else {
                d.count = leftover;
              }
            }
          }
        }
      }

      d.mesh.position.set(
        d.pos.x,
        d.pos.y + Math.sin(d.age * 3.0 + d.phase) * 0.07,
        d.pos.z
      );
      d.mesh.rotation.y = d.age * 2.1 + d.phase;
    }
  }

  disposeDrop(d) {
    this.group.remove(d.mesh);
    if (d.mesh.geometry) d.mesh.geometry.dispose();
    if (d.mesh.material) {
      if (d.mesh.material.map && d.mesh.material.map !== this.textureManager.atlasTexture) {
        d.mesh.material.map.dispose();
      }
      d.mesh.material.dispose();
    }
  }

  clear() {
    for (const d of this.drops) this.disposeDrop(d);
    this.drops.length = 0;
  }
}
