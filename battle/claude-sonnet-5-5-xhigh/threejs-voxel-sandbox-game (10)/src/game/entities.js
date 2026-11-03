// Non-mob entities: dropped items, falling blocks, primed TNT, arrows.
import * as THREE from 'three';
import { B, DEFS, LIQUID, maxStack } from './blocks.js';
import { moveBox } from './physics.js';
import { createItemMesh, setItemMeshLight, blockGeometry } from './itemmodels.js';
import { createVoxelMaterial } from './materials.js';

export class Entities {
  constructor(game) {
    this.game = game;
    this.items = [];
    this.falling = [];
    this.tnt = [];
    this.arrows = [];
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.mergeTimer = 0;
    this.arrowGeo = new THREE.BoxGeometry(0.05, 0.05, 0.7);
    this.arrowMat = new THREE.MeshBasicMaterial({ color: 0xb8a58a });
  }

  blockMat() { return createVoxelMaterial(this.game.shared); }

  clear() {
    for (const list of [this.items, this.falling, this.tnt, this.arrows]) {
      for (const e of list) this.group.remove(e.mesh);
      list.length = 0;
    }
  }

  // ---- dropped items --------------------------------------------------------------------------------
  spawnItem(x, y, z, stack, vx, vy, vz, delay = 0.6, maxAge = 300) {
    if (!stack || stack.count <= 0) return;
    if (this.items.length > 220) { const old = this.items.shift(); this.group.remove(old.mesh); }
    const mesh = createItemMesh(stack.id, () => this.blockMat());
    const flat = mesh.userData.flat;
    mesh.scale.setScalar(flat ? 0.42 : 0.26);
    const holder = new THREE.Group();
    holder.add(mesh);
    holder.position.set(x, y, z);
    this.group.add(holder);
    this.items.push({
      x, y, z, vx: vx === undefined ? (Math.random() - 0.5) * 2 : vx, vy: vy === undefined ? 3 : vy, vz: vz === undefined ? (Math.random() - 0.5) * 2 : vz,
      stack: { ...stack }, age: 0, delay, maxAge, hw: 0.12, h: 0.25, onGround: false, mesh: holder, inner: mesh, flat, phase: Math.random() * 6.28,
    });
  }

  dropStacks(x, y, z, drops) {
    for (const [id, n] of drops) this.spawnItem(x, y, z, { id, count: n });
  }

  updateItems(dt) {
    const g = this.game, w = g.world, p = g.player;
    this.mergeTimer -= dt;
    const doMerge = this.mergeTimer <= 0;
    if (doMerge) this.mergeTimer = 0.5;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const e = this.items[i];
      e.age += dt;
      if (e.age > e.maxAge) { this.group.remove(e.mesh); this.items.splice(i, 1); continue; }
      const inWater = LIQUID[w.getBlock(Math.floor(e.x), Math.floor(e.y + 0.1), Math.floor(e.z))] === 1;
      if (inWater) { e.vy += (e.vy < 1 ? 14 : -4) * dt; e.vy *= 0.92; e.vx *= 0.94; e.vz *= 0.94; }
      else e.vy -= 24 * dt;
      // magnet towards the player
      if (e.age > e.delay && !p.dead && g.inventory.canAdd(e.stack.id, 1)) {
        const dx = p.x - e.x, dy = p.y + 0.8 - e.y, dz = p.z - e.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 0.8 * 0.8 + 0.4) {
          const left = g.addToInventory(e.stack.id, e.stack.count, e.stack.dmg || 0);
          if (left < e.stack.count) g.audio.play('pickup', { pos: [e.x, e.y, e.z], vol: 0.8 });
          if (left <= 0) { this.group.remove(e.mesh); this.items.splice(i, 1); continue; }
          e.stack.count = left;
        } else if (d2 < 2.6 * 2.6) {
          const d = Math.sqrt(d2), s = 9 * dt;
          e.vx += (dx / d) * s * 6; e.vy += (dy / d) * s * 6; e.vz += (dz / d) * s * 6;
          const sp = Math.hypot(e.vx, e.vy, e.vz);
          if (sp > 9) { e.vx *= 9 / sp; e.vy *= 9 / sp; e.vz *= 9 / sp; }
        }
      }
      moveBox(w, e, e.vx * dt, e.vy * dt, e.vz * dt);
      if (e.hitY) e.vy = e.vy < 0 ? -e.vy * 0.25 : 0;
      if (e.hitX) e.vx = -e.vx * 0.4;
      if (e.hitZ) e.vz = -e.vz * 0.4;
      if (e.onGround) { e.vx *= 0.8; e.vz *= 0.8; if (Math.abs(e.vy) < 0.5) e.vy = 0; }
      if (e.y < -10) { this.group.remove(e.mesh); this.items.splice(i, 1); continue; }
      // burn in lava
      if (w.getBlock(Math.floor(e.x), Math.floor(e.y + 0.1), Math.floor(e.z)) === B.LAVA) {
        g.particles.smoke(e.x, e.y + 0.2, e.z, 6, 0.25);
        g.audio.play('lava', { pos: [e.x, e.y, e.z], vol: 0.4 });
        this.group.remove(e.mesh); this.items.splice(i, 1); continue;
      }
      if (doMerge) {
        for (let j = i - 1; j >= 0; j--) {
          const o = this.items[j];
          if (o.stack.id === e.stack.id && maxStack(e.stack.id) > 1 && o.stack.count + e.stack.count <= maxStack(e.stack.id)
            && Math.abs(o.x - e.x) < 0.7 && Math.abs(o.y - e.y) < 0.7 && Math.abs(o.z - e.z) < 0.7) {
            o.stack.count += e.stack.count; o.age = Math.min(o.age, e.age);
            this.group.remove(e.mesh); this.items.splice(i, 1); break;
          }
        }
        if (!this.items[i] || this.items[i] !== e) continue;
      }
      const bob = Math.sin(e.age * 2.5 + e.phase) * 0.06 + 0.18;
      e.mesh.position.set(e.x, e.y + bob, e.z);
      e.mesh.rotation.y = e.age * 1.4 + e.phase;
      const L = g.lightAt(e.x, e.y + 0.3, e.z);
      setItemMeshLight(e.inner, L);
    }
  }

  // ---- falling blocks ----------------------------------------------------------------------------
  spawnFalling(x, y, z, id) {
    const geo = blockGeometry(id);
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, this.blockMat());
    mesh.scale.setScalar(0.98);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.group.add(mesh);
    this.falling.push({ x: x + 0.5, y, z: z + 0.5, vy: 0, id, mesh });
  }

  updateFalling(dt) {
    const w = this.game.world;
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const e = this.falling[i];
      e.vy -= 26 * dt;
      e.y += e.vy * dt;
      const bx = Math.floor(e.x), bz = Math.floor(e.z), by = Math.floor(e.y - 0.001);
      if (w.isSolid(bx, by, bz) || e.y < -5) {
        const ly = by + 1;
        const cur = w.getBlock(bx, ly, bz);
        const d = DEFS[cur];
        if (cur === 0 || LIQUID[cur] || (d && d.replaceable)) {
          w.setBlock(bx, ly, bz, e.id);
          this.game.audio.blockSound(e.id, 'place', [bx, ly, bz], 0.9);
        } else this.spawnItem(bx + 0.5, ly + 0.3, bz + 0.5, { id: e.id, count: 1 });
        this.group.remove(e.mesh); this.falling.splice(i, 1);
        continue;
      }
      e.mesh.position.set(e.x, e.y + 0.5, e.z);
      setItemMeshLight(e.mesh, this.game.lightAt(e.x, e.y + 0.5, e.z));
    }
  }

  // ---- TNT ------------------------------------------------------------------------------------
  spawnTNT(x, y, z, fuse = 4, vx = 0, vy = 0.2, vz = 0) {
    const mesh = new THREE.Mesh(blockGeometry(B.TNT), this.blockMat());
    mesh.scale.setScalar(0.98);
    this.group.add(mesh);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.tnt.push({ x: x + 0.5, y, z: z + 0.5, vx, vy, vz, fuse, hw: 0.49, h: 0.98, onGround: false, mesh });
    this.game.audio.play('fuse', { pos: [x, y, z] });
  }

  updateTNT(dt) {
    const g = this.game;
    for (let i = this.tnt.length - 1; i >= 0; i--) {
      const e = this.tnt[i];
      e.fuse -= dt;
      e.vy -= 24 * dt;
      moveBox(g.world, e, e.vx * dt, e.vy * dt, e.vz * dt);
      if (e.hitY) e.vy = 0;
      if (e.onGround) { e.vx *= 0.7; e.vz *= 0.7; }
      if (e.fuse <= 0) {
        this.group.remove(e.mesh); this.tnt.splice(i, 1);
        g.explode(e.x, e.y + 0.5, e.z, 3.6, null);
        continue;
      }
      e.mesh.position.set(e.x, e.y + 0.5, e.z);
      const flash = Math.floor(e.fuse * 5) % 2 === 0 ? 1.0 : 2.8;
      const L = g.lightAt(e.x, e.y + 0.5, e.z);
      e.mesh.material.uniforms.uEntTint.value.set(L * flash, L * flash, L * flash);
      const s = 0.98 + (e.fuse < 1 ? (1 - e.fuse) * 0.1 * Math.sin(e.fuse * 40) : 0);
      e.mesh.scale.setScalar(s);
      if (Math.random() < dt * 14) g.particles.smoke(e.x, e.y + 1.05, e.z, 1, 0.2, 0.08);
    }
  }

  // ---- arrows (skeletons) ------------------------------------------------------------------------
  spawnArrow(x, y, z, vx, vy, vz, damage = 3) {
    const mesh = new THREE.Mesh(this.arrowGeo, this.arrowMat);
    this.group.add(mesh);
    this.arrows.push({ x, y, z, vx, vy, vz, life: 6, stuck: 0, damage, mesh });
    this.game.audio.play('bow', { pos: [x, y, z] });
  }

  updateArrows(dt) {
    const g = this.game, p = g.player;
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      if (a.stuck > 0) { a.stuck -= dt; if (a.stuck <= 0 || a.life <= 0) { this.group.remove(a.mesh); this.arrows.splice(i, 1); } continue; }
      if (a.life <= 0) { this.group.remove(a.mesh); this.arrows.splice(i, 1); continue; }
      a.vy -= 14 * dt;
      const nx = a.x + a.vx * dt, ny = a.y + a.vy * dt, nz = a.z + a.vz * dt;
      if (g.world.isSolid(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
        a.stuck = 1.5; g.audio.play('hit', { pos: [a.x, a.y, a.z], vol: 0.5, pitch: 1.4 });
        continue;
      }
      a.x = nx; a.y = ny; a.z = nz;
      if (!p.dead && Math.abs(a.x - p.x) < 0.45 && a.y > p.y - 0.1 && a.y < p.y + p.height + 0.1 && Math.abs(a.z - p.z) < 0.45) {
        const sp = Math.hypot(a.vx, a.vz) || 1;
        g.damagePlayer(a.damage, 'was shot by a Skeleton', a.vx / sp, a.vz / sp, 5);
        this.group.remove(a.mesh); this.arrows.splice(i, 1);
        continue;
      }
      a.mesh.position.set(a.x, a.y, a.z);
      a.mesh.lookAt(a.x + a.vx, a.y + a.vy, a.z + a.vz);
    }
  }

  update(dt) {
    this.updateItems(dt);
    this.updateFalling(dt);
    this.updateTNT(dt);
    this.updateArrows(dt);
  }
}
