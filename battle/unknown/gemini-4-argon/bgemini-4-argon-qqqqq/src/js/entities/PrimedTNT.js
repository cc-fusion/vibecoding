import * as THREE from 'three';
import { BLOCK, BLOCKS } from '../data/blocks.js';

export class PrimedTNTManager {
  constructor(scene, atlas) {
    this.scene = scene;
    this.atlas = atlas;
    this.list = [];
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.baseGeo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
    const uvAttr = this.baseGeo.attributes.uv;
    const faceNames = ['side', 'side', 'top', 'bottom', 'side', 'side'];
    for (let f = 0; f < 6; f++) {
      const rect = this.atlas.getBlockFaceUV(BLOCK.TNT, faceNames[f]);
      const base = f * 4;
      uvAttr.setXY(base + 0, rect.u0, rect.v1);
      uvAttr.setXY(base + 1, rect.u1, rect.v1);
      uvAttr.setXY(base + 2, rect.u0, rect.v0);
      uvAttr.setXY(base + 3, rect.u1, rect.v0);
    }
    uvAttr.needsUpdate = true;
  }

  igniteAt(bx, by, bz, world, sound, fuse = 3.2) {
    world.setBlock(bx, by, bz, BLOCK.AIR, true, true);
    if (sound) sound.playFuse();

    const mat = new THREE.MeshLambertMaterial({
      map: this.atlas.texture,
      emissive: new THREE.Color(0x000000),
    });
    const mesh = new THREE.Mesh(this.baseGeo, mat);
    mesh.position.set(bx + 0.5, by + 0.5, bz + 0.5);
    this.group.add(mesh);

    this.list.push({
      x: bx + 0.5,
      y: by + 0.5,
      z: bz + 0.5,
      vx: (Math.random() - 0.5) * 1.4,
      vy: 4.2,
      vz: (Math.random() - 0.5) * 1.4,
      fuse,
      mesh,
      mat,
    });
  }

  update(dt, world, particles, sound, itemDrops, player, mobManager) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      t.fuse -= dt;

      // Simple gravity & bounce
      t.vy -= 22.0 * dt;
      const ny = t.y + t.vy * dt;
      if (BLOCKS[world.getBlock(Math.floor(t.x), Math.floor(ny - 0.48), Math.floor(t.z))]?.solid) {
        t.y = Math.floor(ny - 0.48) + 1.48;
        t.vy = 0;
        t.vx *= 0.78;
        t.vz *= 0.78;
      } else {
        t.y = ny;
      }

      const nx = t.x + t.vx * dt;
      if (!BLOCKS[world.getBlock(Math.floor(nx), Math.floor(t.y), Math.floor(t.z))]?.solid) {
        t.x = nx;
      } else {
        t.vx *= -0.4;
      }

      const nz = t.z + t.vz * dt;
      if (!BLOCKS[world.getBlock(Math.floor(t.x), Math.floor(t.y), Math.floor(nz))]?.solid) {
        t.z = nz;
      } else {
        t.vz *= -0.4;
      }

      // Flash white faster as fuse approaches zero, swelling slightly right before blast
      const flash = Math.sin((3.5 - t.fuse) * 18.0) > 0;
      t.mat.emissive.setHex(flash ? 0xdddddd : 0x110000);
      const swell = t.fuse < 0.35 ? 1.0 + (0.35 - t.fuse) * 0.7 : 1.0;
      t.mesh.scale.setScalar(swell);
      t.mesh.position.set(t.x, t.y, t.z);

      if (t.fuse <= 0) {
        this._detonate(t, world, particles, sound, itemDrops, player, mobManager);
        this.group.remove(t.mesh);
        t.mat.dispose();
        this.list.splice(i, 1);
      }
    }
  }

  _detonate(t, world, particles, sound, itemDrops, player, mobManager) {
    sound.playExplosion();
    particles.emitExplosion(t.x, t.y, t.z);

    const radius = 3.6;
    const cx = Math.floor(t.x);
    const cy = Math.floor(t.y);
    const cz = Math.floor(t.z);
    const rCeil = Math.ceil(radius);
    const touchedChunks = new Set();

    for (let dy = -rCeil; dy <= rCeil; dy++) {
      for (let dz = -rCeil; dz <= rCeil; dz++) {
        for (let dx = -rCeil; dx <= rCeil; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > radius * (0.82 + Math.random() * 0.25)) continue;
          const bx = cx + dx;
          const by = cy + dy;
          const bz = cz + dz;
          const id = world.getBlock(bx, by, bz);
          if (id === BLOCK.AIR || id === BLOCK.WATER) continue;
          const def = BLOCKS[id];
          if (!def || !def.breakable) continue;

          if (id === BLOCK.TNT) {
            // Chain reaction with shorter fuse!
            this.igniteAt(bx, by, bz, world, null, 0.45 + Math.random() * 0.4);
            continue;
          }

          world.setBlock(bx, by, bz, BLOCK.AIR, true, false);
          const { cx: chx, cz: chz } = world.worldToChunk(bx, bz);
          const chunk = world.getChunk(chx, chz);
          if (chunk) touchedChunks.add(chunk);
          for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nb = world.getChunk(chx + ox, chz + oz);
            if (nb) touchedChunks.add(nb);
          }

          if (Math.random() < 0.35 && def.drop) {
            const drops = def.drop();
            for (const d of drops) {
              if (d.count > 0) {
                itemDrops.spawnDrop(bx + 0.5, by + 0.5, bz + 0.5, d.id, d.count);
              }
            }
          }
        }
      }
    }

    for (const c of touchedChunks) {
      world.recomputeChunkLighting(c);
    }
    for (const c of touchedChunks) {
      world.mesher.buildChunkMeshes(c, world, world.materials, world.scene);
    }

    // Knockback & blast damage to player and mobs
    if (player) {
      const dx = player.pos.x - t.x;
      const dy = (player.pos.y + 0.9) - t.y;
      const dz = player.pos.z - t.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 6.5) {
        const power = (1.0 - dist / 6.5);
        player.applyDamage(Math.round(power * 12), {
          x: (dx / (dist || 1)) * power * 11,
          y: 6.5 * power,
          z: (dz / (dist || 1)) * power * 11,
        });
      }
    }

    if (mobManager) {
      mobManager.applyExplosion(t.x, t.y, t.z, 6.5, itemDrops, particles, sound);
    }
  }

  clear() {
    for (const t of this.list) {
      this.group.remove(t.mesh);
      t.mat.dispose();
    }
    this.list = [];
  }
}
