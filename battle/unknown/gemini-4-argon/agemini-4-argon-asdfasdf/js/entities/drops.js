// Physical 3D Spinning & Bobbing Dropped Item Entities with Magnetic Pickup

import * as THREE from 'three';
import { BLOCK_DEFS, isBlockSolid } from '../game/blocks.js';
import { getItemDef } from '../game/items.js';

export class DropManager {
  constructor(scene, chunkManager, textureManager, soundEngine) {
    this.scene = scene;
    this.chunkManager = chunkManager;
    this.textureManager = textureManager;
    this.sound = soundEngine;
    this.drops = [];
    this.materialCache = new Map();
    this.cubeGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    this.flatGeo = new THREE.PlaneGeometry(0.36, 0.36);
  }

  getItemMaterial(itemId) {
    if (this.materialCache.has(itemId)) return this.materialCache.get(itemId);
    const def = getItemDef(itemId);
    if (!def) return null;

    const url = this.textureManager.getItemIconUrl(itemId);
    const img = new Image();
    img.src = url;
    const tex = new THREE.Texture(img);
    img.onload = () => {
      tex.needsUpdate = true;
    };
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;

    let mat;
    if (def.blockId !== undefined && BLOCK_DEFS[def.blockId]?.renderType === 'cube') {
      const tile = this.textureManager.tileCanvases.get(BLOCK_DEFS[def.blockId].faces[0]);
      const blockTex = new THREE.CanvasTexture(tile);
      blockTex.magFilter = THREE.NearestFilter;
      blockTex.minFilter = THREE.NearestFilter;
      blockTex.colorSpace = THREE.SRGBColorSpace;
      mat = new THREE.MeshLambertMaterial({ map: blockTex, alphaTest: 0.4 });
    } else {
      mat = new THREE.MeshLambertMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.35,
        side: THREE.DoubleSide,
      });
    }
    this.materialCache.set(itemId, mat);
    return mat;
  }

  spawnDrop(x, y, z, itemId, count = 1, pickupDelay = 0.25, tossVel = null) {
    const def = getItemDef(itemId);
    if (!def) return;

    const mat = this.getItemMaterial(itemId);
    const isCube = def.blockId !== undefined && BLOCK_DEFS[def.blockId]?.renderType === 'cube';
    const mesh = new THREE.Mesh(isCube ? this.cubeGeo : this.flatGeo, mat);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);

    this.drops.push({
      itemId,
      count,
      mesh,
      x,
      y,
      z,
      vx: tossVel ? tossVel.x : (Math.random() - 0.5) * 2.1,
      vy: tossVel ? tossVel.y : 2.8 + Math.random() * 1.4,
      vz: tossVel ? tossVel.z : (Math.random() - 0.5) * 2.1,
      age: 0,
      pickupDelay,
    });
  }

  update(dt, playerPos, inventory, onPickupToast) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;

      if (d.age > 240) {
        this.scene.remove(d.mesh);
        this.drops.splice(i, 1);
        continue;
      }

      const dx = playerPos.x - d.x;
      const dy = playerPos.y + 0.85 - d.y;
      const dz = playerPos.z - d.z;
      const dist = Math.hypot(dx, dy, dz);
      const magnetizing = d.age >= d.pickupDelay && dist < 2.85;

      if (magnetizing) {
        // Smoothly fly item up out of holes or down from branches directly into player's hands!
        const pullSpeed = Math.min(dist, 9.5 * dt);
        d.x += (dx / Math.max(0.05, dist)) * pullSpeed;
        d.y += (dy / Math.max(0.05, dist)) * pullSpeed;
        d.z += (dz / Math.max(0.05, dist)) * pullSpeed;
        d.vy = 0;

        if (dist < 1.15) {
          const rem = inventory.addItem(d.itemId, d.count);
          if (rem < d.count) {
            this.sound.playPickup();
            if (onPickupToast) onPickupToast(d.itemId, d.count - rem);
            if (rem <= 0) {
              this.scene.remove(d.mesh);
              this.drops.splice(i, 1);
              continue;
            } else {
              d.count = rem;
            }
          }
        }
      } else {
        // Standard gravity + bounce when resting in the world
        d.vy -= 18.0 * dt;
        const nx = d.x + d.vx * dt;
        const ny = d.y + d.vy * dt;
        const nz = d.z + d.vz * dt;

        if (!isBlockSolid(this.chunkManager.getBlock(nx, d.y, d.z))) {
          d.x = nx;
        } else {
          d.vx = 0;
        }
        if (!isBlockSolid(this.chunkManager.getBlock(d.x, d.y, nz))) {
          d.z = nz;
        } else {
          d.vz = 0;
        }

        if (isBlockSolid(this.chunkManager.getBlock(d.x, ny - 0.16, d.z))) {
          d.y = Math.floor(ny - 0.16) + 1.16;
          d.vy = 0;
          d.vx *= 0.82;
          d.vz *= 0.82;
        } else {
          d.y = ny;
        }
      }

      // Smooth hover bobbing + spin
      d.mesh.position.set(d.x, d.y + Math.sin(d.age * 3.1) * 0.07, d.z);
      d.mesh.rotation.y = d.age * 1.9;
    }
  }

  clearAll() {
    for (const d of this.drops) this.scene.remove(d.mesh);
    this.drops = [];
  }
}
