// Non-mob entities: dropped items, arrows, primed TNT, falling blocks.
import * as THREE from 'three';
import type { Game } from './game';
import { newBody, moveBody, collides, type Body } from './physics';
import { B, BLOCKS, T_KIND, K, T_SOLID } from './blocks';
import { ITEMDEF, type Stack } from './items';
import { itemGeometry, itemMaterial, cubeGeometry } from './models';
import { addToSlots } from './inventory';

export interface Entity { update(dt: number, g: Game): boolean; dispose(g: Game): void }

export class ItemEntity implements Entity {
  body: Body; obj = new THREE.Group(); mat: THREE.MeshBasicMaterial; age = 0; delay = 0.6; bright = 1; lt = 0; merge = 0.5;
  constructor(g: Game, public stack: Stack, x: number, y: number, z: number, vx = 0, vy = 3, vz = 0) {
    this.body = newBody(0.25, 0.25, x, y, z);
    this.body.vx = vx; this.body.vy = vy; this.body.vz = vz;
    const m = itemGeometry(stack.id);
    this.mat = itemMaterial(m.textured);
    const mesh = new THREE.Mesh(m.geo, this.mat);
    mesh.scale.setScalar(m.textured ? 0.26 : 0.4);
    this.obj.add(mesh);
    g.scene.add(this.obj);
  }
  update(dt: number, g: Game) {
    this.age += dt; this.delay -= dt;
    const b = this.body, w = g.world!;
    const inWater = w.getBlock(Math.floor(b.x), Math.floor(b.y + 0.1), Math.floor(b.z)) === B.WATER;
    if (w.getBlock(Math.floor(b.x), Math.floor(b.y + 0.1), Math.floor(b.z)) === B.LAVA) { g.particles.puff(b.x, b.y, b.z, 0.2, 0.2, 0.2, 6, 1, 0.8); g.audio.play('fizz', b, 0.5); return false; }
    if (!w.isLoaded(Math.floor(b.x), Math.floor(b.z))) return true;
    b.vy -= (inWater ? 3 : 22) * dt;
    if (inWater) { b.vy = Math.min(b.vy + 14 * dt, 1.2); b.vx *= 1 - dt * 3; b.vz *= 1 - dt * 3; }
    if (b.onGround) { b.vx *= 0.8; b.vz *= 0.8; }
    // magnet / pickup
    const p = g.player;
    if (p && !p.dead && this.delay <= 0) {
      const dx = p.body.x - b.x, dy = p.body.y + 0.8 - b.y, dz = p.body.z - b.z, d = Math.hypot(dx, dy, dz);
      if (d < 0.9) {
        const left = g.inv.add(this.stack);
        if (left < this.stack.n) { g.audio.play('pop', undefined, 0.6, 0.9 + Math.random() * 0.4); g.onPickup(this.stack.id); }
        this.stack.n = left;
        if (left <= 0) return false;
      } else if (d < 2.6 && g.inv.canAdd(this.stack.id)) {
        const s = (1 - d / 2.6) * 9 + 2;
        b.vx += (dx / d) * s * dt * 6; b.vy += (dy / d) * s * dt * 6 + 22 * dt * 0.9; b.vz += (dz / d) * s * dt * 6;
      }
    }
    moveBody(w, b, dt);
    this.merge -= dt;
    if (this.merge <= 0) {
      this.merge = 0.6 + Math.random() * 0.3;
      for (const o of g.items) {
        if (o === this || o.stack.id !== this.stack.id || o.stack.d !== undefined || this.stack.d !== undefined) continue;
        if (Math.abs(o.body.x - b.x) < 1 && Math.abs(o.body.y - b.y) < 1 && Math.abs(o.body.z - b.z) < 1) {
          const max = ITEMDEF[this.stack.id]!.max;
          if (o.stack.n + this.stack.n <= max && o.age >= this.age) { o.stack.n += this.stack.n; return false; }
        }
      }
    }
    this.lt -= dt;
    if (this.lt <= 0) { this.lt = 0.3; this.bright = g.brightnessAt(b.x, b.y + 0.3, b.z); this.mat.color.setScalar(this.bright); }
    this.obj.position.set(b.x, b.y + 0.22 + Math.sin(this.age * 2.4) * 0.05, b.z);
    this.obj.rotation.y = this.age * 1.6;
    return this.age < 300 && b.y > -20;
  }
  dispose(g: Game) { g.scene.remove(this.obj); this.mat.dispose(); }
}

export class Arrow implements Entity {
  body: Body; obj: THREE.Mesh; stuck = 0; age = 0;
  constructor(g: Game, x: number, y: number, z: number, vx: number, vy: number, vz: number) {
    this.body = newBody(0.15, 0.15, x, y, z);
    this.body.vx = vx; this.body.vy = vy; this.body.vz = vz;
    this.obj = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.6), new THREE.MeshBasicMaterial({ color: 0xb0a080 }));
    g.scene.add(this.obj);
  }
  update(dt: number, g: Game) {
    this.age += dt;
    const b = this.body, w = g.world!;
    if (this.stuck > 0) { this.stuck -= dt; return this.stuck > 0; }
    b.vy -= 14 * dt;
    const ox = b.x, oy = b.y, oz = b.z;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (w.solidAt(Math.floor(b.x), Math.floor(b.y), Math.floor(b.z))) {
      b.x = ox; b.y = oy; b.z = oz; this.stuck = 1.2; g.audio.play('arrow_hit', b, 0.7); return true;
    }
    const p = g.player;
    if (p && !p.dead && Math.abs(b.x - p.body.x) < 0.45 && Math.abs(b.z - p.body.z) < 0.45 && b.y > p.body.y && b.y < p.body.y + 1.8) {
      g.damagePlayer(3.5, b.x, b.z, 'arrow');
      g.audio.play('arrow_hit', b, 0.8);
      return false;
    }
    const sp = Math.hypot(b.vx, b.vy, b.vz) || 1;
    this.obj.position.set(b.x, b.y, b.z);
    this.obj.lookAt(b.x + b.vx / sp, b.y + b.vy / sp, b.z + b.vz / sp);
    return this.age < 12;
  }
  dispose(g: Game) { g.scene.remove(this.obj); this.obj.geometry.dispose(); (this.obj.material as THREE.Material).dispose(); }
}

export class PrimedTnt implements Entity {
  body: Body; obj: THREE.Mesh; fuse: number; mat: THREE.MeshBasicMaterial;
  constructor(g: Game, x: number, y: number, z: number, fuse = 3.5) {
    this.body = newBody(0.98, 0.98, x, y, z);
    this.body.vy = 4; this.body.vx = (Math.random() - 0.5) * 1.5; this.body.vz = (Math.random() - 0.5) * 1.5;
    this.fuse = fuse;
    this.mat = itemMaterial(true);
    this.obj = new THREE.Mesh(cubeGeometry(B.TNT, 0.98), this.mat);
    g.scene.add(this.obj);
    g.audio.play('fuse', this.body, 1);
  }
  update(dt: number, g: Game) {
    const b = this.body;
    this.fuse -= dt;
    b.vy -= 24 * dt;
    if (b.onGround) { b.vx *= 0.7; b.vz *= 0.7; }
    moveBody(g.world!, b, dt);
    const flash = Math.floor(this.fuse * 5) % 2 === 0 && this.fuse < 3;
    this.mat.color.setScalar(flash ? 2.2 : g.brightnessAt(b.x, b.y, b.z));
    const s = 1 + (this.fuse < 0.6 ? (0.6 - this.fuse) * 0.3 : 0);
    this.obj.scale.setScalar(s);
    this.obj.position.set(b.x, b.y + 0.49, b.z);
    if (Math.random() < 0.4) g.particles.puff(b.x, b.y + 1.05, b.z, 0.3, 0.3, 0.3, 1, 0.3, 0.9, 0.18, 0.5);
    if (this.fuse <= 0) { g.explode(b.x, b.y + 0.5, b.z, 3.9, 'tnt'); return false; }
    return true;
  }
  dispose(g: Game) { g.scene.remove(this.obj); this.obj.geometry.dispose(); this.mat.dispose(); }
}

export class FallingBlock implements Entity {
  body: Body; obj: THREE.Mesh; mat: THREE.MeshBasicMaterial;
  constructor(g: Game, public id: number, x: number, y: number, z: number) {
    this.body = newBody(0.98, 0.98, x, y, z);
    this.mat = itemMaterial(true);
    this.obj = new THREE.Mesh(cubeGeometry(id, 0.98), this.mat);
    g.scene.add(this.obj);
  }
  update(dt: number, g: Game) {
    const b = this.body, w = g.world!;
    b.vy = Math.max(-40, b.vy - 28 * dt);
    moveBody(w, b, dt);
    this.mat.color.setScalar(g.brightnessAt(b.x, b.y + 0.5, b.z));
    this.obj.position.set(b.x, b.y + 0.49, b.z);
    if (b.onGround || b.y < 0) {
      const x = Math.floor(b.x), y = Math.floor(b.y + 0.3), z = Math.floor(b.z);
      const cur = w.getBlock(x, y, z);
      if (cur === 0 || BLOCKS[cur]?.repl || T_KIND[cur] === K.CROSS) { g.setBlockAndUpdate(x, y, z, this.id); g.audio.block('place', BLOCKS[this.id].sound, { x, y, z }); }
      else if (!T_SOLID[cur]) { g.setBlockAndUpdate(x, y, z, this.id); }
      else g.spawnItem(this.id, 1, b.x, b.y + 0.5, b.z);
      return false;
    }
    if (collides(w, b) && b.y < -10) return false;
    return true;
  }
  dispose(g: Game) { g.scene.remove(this.obj); this.obj.geometry.dispose(); this.mat.dispose(); }
}

export const _addToSlots = addToSlots;
