import * as THREE from 'three';
import { BLOCK, ITEM, REGISTRY, isSolidBlock } from '../constants/Blocks.js';
import { SEA_LEVEL, BIOME } from '../world/WorldGen.js';

const GRAVITY = 24.0;

export class EntityManager {
  constructor(scene, world, atlas, sound) {
    this.scene = scene;
    this.world = world;
    this.atlas = atlas;
    this.sound = sound;

    this.drops = [];
    this.particles = [];
    this.tnts = [];
    this.mobs = [];
    this.spawnTimer = 2.0;

    // Shared unit cube geometry for fast particle/item rendering
    this.unitBox = new THREE.BoxGeometry(1, 1, 1);
  }

  // ==================== PARTICLES ====================
  spawnBlockParticles(wx, wy, wz, blockId, count = 14) {
    const baseCol = this.atlas.blockColors[blockId] || new THREE.Color(0.75, 0.75, 0.75);
    for (let i = 0; i < count; i++) {
      const shade = 0.75 + Math.random() * 0.4;
      const mat = new THREE.MeshBasicMaterial({
        color: baseCol.clone().multiplyScalar(shade),
      });
      const size = 0.10 + Math.random() * 0.10;
      const mesh = new THREE.Mesh(this.unitBox, mat);
      mesh.scale.set(size, size, size);
      mesh.position.set(
        wx + 0.2 + Math.random() * 0.6,
        wy + 0.2 + Math.random() * 0.6,
        wz + 0.2 + Math.random() * 0.6
      );
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 4.2,
        vy: 1.8 + Math.random() * 3.6,
        vz: (Math.random() - 0.5) * 4.2,
        life: 0.45 + Math.random() * 0.45,
        gravity: 16.0,
      });
    }
  }

  spawnCustomParticles(x, y, z, hexColor, count = 10, speed = 3.5, gravity = 8.0) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: hexColor });
      const size = 0.09 + Math.random() * 0.11;
      const mesh = new THREE.Mesh(this.unitBox, mat);
      mesh.scale.set(size, size, size);
      mesh.position.set(x + (Math.random() - 0.5) * 0.5, y + (Math.random() - 0.5) * 0.5, z + (Math.random() - 0.5) * 0.5);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * speed * 2,
        vy: Math.random() * speed,
        vz: (Math.random() - 0.5) * speed * 2,
        life: 0.4 + Math.random() * 0.5,
        gravity,
      });
    }
  }

  // ==================== DROPPED ITEMS ====================
  spawnDrop(x, y, z, itemId, count = 1) {
    const def = REGISTRY[itemId];
    if (!def || itemId === BLOCK.AIR) return;

    let mesh;
    if (def.isBlock && def.renderType === 'cube') {
      const col = this.atlas.blockColors[itemId] || new THREE.Color(0.8, 0.8, 0.8);
      const mat = new THREE.MeshLambertMaterial({ color: col });
      mesh = new THREE.Mesh(this.unitBox, mat);
      mesh.scale.set(0.28, 0.28, 0.28);
    } else {
      const iconUrl = this.atlas.iconUrls[itemId];
      const tex = new THREE.TextureLoader().load(iconUrl);
      tex.magFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: tex });
      mesh = new THREE.Sprite(mat);
      mesh.scale.set(0.42, 0.42, 0.42);
    }

    mesh.position.set(x, y, z);
    this.scene.add(mesh);

    this.drops.push({
      id: itemId,
      count,
      mesh,
      x,
      y,
      z,
      vx: (Math.random() - 0.5) * 2.4,
      vy: 3.4 + Math.random() * 1.4,
      vz: (Math.random() - 0.5) * 2.4,
      age: 0,
      pickupDelay: 0.28,
    });
  }

  // ==================== IGNITED TNT ====================
  igniteTNT(bx, by, bz) {
    this.world.setBlock(bx, by, bz, BLOCK.AIR, true);
    this.sound.playFuse();

    const mat = new THREE.MeshLambertMaterial({ color: 0xdb362d });
    const mesh = new THREE.Mesh(this.unitBox, mat);
    mesh.scale.set(0.98, 0.98, 0.98);
    mesh.position.set(bx + 0.5, by + 0.5, bz + 0.5);
    this.scene.add(mesh);

    this.tnts.push({
      mesh,
      mat,
      x: bx + 0.5,
      y: by + 0.5,
      z: bz + 0.5,
      vy: 3.5,
      fuse: 3.0,
    });
  }

  detonate(tnt, player) {
    this.sound.playExplosion();
    this.spawnCustomParticles(tnt.x, tnt.y, tnt.z, 0xff922b, 28, 8.0, 6.0);
    this.spawnCustomParticles(tnt.x, tnt.y, tnt.z, 0xf1f3f5, 22, 6.5, 2.0);

    const R = 3.4;
    const cx = Math.floor(tnt.x);
    const cy = Math.floor(tnt.y);
    const cz = Math.floor(tnt.z);
    const rCeil = Math.ceil(R);

    for (let dy = -rCeil; dy <= rCeil; dy++) {
      for (let dz = -rCeil; dz <= rCeil; dz++) {
        for (let dx = -rCeil; dx <= rCeil; dx++) {
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > R * R) continue;
          const bx = cx + dx;
          const by = cy + dy;
          const bz = cz + dz;
          const id = this.world.getBlock(bx, by, bz);
          if (id === BLOCK.AIR || id === BLOCK.BEDROCK || id === BLOCK.WATER) continue;
          if (id === BLOCK.TNT) {
            this.igniteTNT(bx, by, bz);
            continue;
          }
          const def = REGISTRY[id];
          this.world.setBlock(bx, by, bz, BLOCK.AIR, false);
          if (def && Math.random() < 0.35) {
            const dropId = def.drop || id;
            this.spawnDrop(bx + 0.5, by + 0.5, bz + 0.5, dropId, 1);
          }
        }
      }
    }

    // Rebuild affected chunks cleanly once after batch blast
    this.world.update(tnt.x, tnt.z, 0.016, 16);

    // Knockback & blast damage to mobs & survival player
    for (const mob of this.mobs) {
      const dx = mob.x - tnt.x;
      const dy = mob.y - tnt.y;
      const dz = mob.z - tnt.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 6.5) {
        const force = (1 - dist / 6.5) * 14;
        this.damageMob(mob, Math.ceil(force * 1.4), dx / (dist || 1), dz / (dist || 1));
      }
    }

    if (player && player.mode === 'survival') {
      const dx = player.pos.x - tnt.x;
      const dy = player.pos.y - tnt.y;
      const dz = player.pos.z - tnt.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 6.0) {
        const factor = 1 - dist / 6.0;
        player.vel.x += (dx / (dist || 1)) * factor * 12;
        player.vel.y += 6 * factor;
        player.vel.z += (dz / (dist || 1)) * factor * 12;
        player.takeDamage(Math.round(factor * 12));
      }
    }
  }

  // ==================== VOXEL CREATURES ====================
  createMobModel(type) {
    const group = new THREE.Group();
    const parts = { legs: [], head: null, materials: [] };

    const addBox = (w, h, d, color, x, y, z, parent = group) => {
      const mat = new THREE.MeshLambertMaterial({ color });
      parts.materials.push({ mat, baseHex: color });
      const mesh = new THREE.Mesh(this.unitBox, mat);
      mesh.scale.set(w, h, d);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };

    const addPivotLeg = (w, h, d, color, px, py, pz) => {
      const pivot = new THREE.Group();
      pivot.position.set(px, py, pz);
      addBox(w, h, d, color, 0, -h / 2, 0, pivot);
      group.add(pivot);
      parts.legs.push(pivot);
      return pivot;
    };

    if (type === 'sheep') {
      addBox(0.68, 0.56, 0.96, 0xf4f5f7, 0, 0.68, 0); // Wool body
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 0.86, 0.52);
      addBox(0.42, 0.40, 0.44, 0xd8c3b0, 0, 0, 0.12, headPivot);
      addBox(0.46, 0.18, 0.36, 0xf4f5f7, 0, 0.18, 0.08, headPivot);
      addBox(0.07, 0.07, 0.05, 0x222222, -0.13, 0.03, 0.34, headPivot);
      addBox(0.07, 0.07, 0.05, 0x222222, 0.13, 0.03, 0.34, headPivot);
      group.add(headPivot);
      parts.head = headPivot;
      for (const [lx, lz] of [[-0.20, 0.32], [0.20, 0.32], [-0.20, -0.32], [0.20, -0.32]]) {
        addPivotLeg(0.18, 0.42, 0.18, 0xd8c3b0, lx, 0.42, lz);
      }
    } else if (type === 'pig') {
      addBox(0.62, 0.50, 0.88, 0xf4a3b4, 0, 0.56, 0);
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 0.68, 0.46);
      addBox(0.44, 0.42, 0.42, 0xf4a3b4, 0, 0, 0.14, headPivot);
      addBox(0.22, 0.16, 0.10, 0xe58298, 0, -0.06, 0.38, headPivot); // Snout
      addBox(0.07, 0.07, 0.05, 0x222222, -0.14, 0.06, 0.35, headPivot);
      addBox(0.07, 0.07, 0.05, 0x222222, 0.14, 0.06, 0.35, headPivot);
      group.add(headPivot);
      parts.head = headPivot;
      for (const [lx, lz] of [[-0.18, 0.28], [0.18, 0.28], [-0.18, -0.28], [0.18, -0.28]]) {
        addPivotLeg(0.17, 0.34, 0.17, 0xe88fa2, lx, 0.34, lz);
      }
    } else if (type === 'chicken') {
      addBox(0.38, 0.34, 0.46, 0xffffff, 0, 0.38, 0);
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 0.56, 0.20);
      addBox(0.24, 0.28, 0.24, 0xffffff, 0, 0.08, 0.06, headPivot);
      addBox(0.12, 0.08, 0.12, 0xf59f00, 0, 0.06, 0.22, headPivot); // Beak
      addBox(0.08, 0.10, 0.08, 0xe03131, 0, -0.02, 0.18, headPivot); // Wattle
      group.add(headPivot);
      parts.head = headPivot;
      addPivotLeg(0.07, 0.22, 0.07, 0xf59f00, -0.10, 0.22, 0);
      addPivotLeg(0.07, 0.22, 0.07, 0xf59f00, 0.10, 0.22, 0);
    } else if (type === 'zombie') {
      addBox(0.50, 0.72, 0.28, 0x2b8a9e, 0, 1.06, 0); // Shirt
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 1.42, 0);
      addBox(0.46, 0.46, 0.46, 0x5c9449, 0, 0.23, 0, headPivot);
      addBox(0.09, 0.07, 0.05, 0x191d1a, -0.11, 0.24, 0.23, headPivot);
      addBox(0.09, 0.07, 0.05, 0x191d1a, 0.11, 0.24, 0.23, headPivot);
      group.add(headPivot);
      parts.head = headPivot;
      // Outstretched zombie arms
      addBox(0.20, 0.20, 0.66, 0x5c9449, -0.36, 1.30, 0.26);
      addBox(0.20, 0.20, 0.66, 0x5c9449, 0.36, 1.30, 0.26);
      addPivotLeg(0.22, 0.70, 0.22, 0x3b4990, -0.13, 0.70, 0);
      addPivotLeg(0.22, 0.70, 0.22, 0x3b4990, 0.13, 0.70, 0);
    } else if (type === 'slime') {
      const outerMat = new THREE.MeshLambertMaterial({ color: 0x51cf66, transparent: true, opacity: 0.76 });
      parts.materials.push({ mat: outerMat, baseHex: 0x51cf66 });
      const outer = new THREE.Mesh(this.unitBox, outerMat);
      outer.scale.set(0.76, 0.76, 0.76);
      outer.position.set(0, 0.38, 0);
      group.add(outer);
      addBox(0.44, 0.44, 0.44, 0x2b8a3e, 0, 0.38, 0);
      addBox(0.10, 0.10, 0.06, 0x16381d, -0.15, 0.46, 0.38);
      addBox(0.10, 0.10, 0.06, 0x16381d, 0.15, 0.46, 0.38);
    }

    return { group, parts };
  }

  spawnMob(type, x, y, z) {
    const { group, parts } = this.createMobModel(type);
    group.position.set(x, y, z);
    this.scene.add(group);

    const hostile = type === 'zombie' || type === 'slime';
    const maxHp = type === 'zombie' ? 16 : type === 'slime' ? 10 : type === 'chicken' ? 6 : 10;
    const height = type === 'zombie' ? 1.85 : type === 'chicken' ? 0.75 : 0.95;
    const radius = type === 'chicken' ? 0.24 : 0.36;

    this.mobs.push({
      type,
      hostile,
      hp: maxHp,
      maxHp,
      group,
      parts,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.random() * Math.PI * 2,
      radius,
      height,
      onGround: false,
      aiTimer: 1 + Math.random() * 2,
      moveSpeed: 0,
      fleeTimer: 0,
      hurtFlash: 0,
      attackCooldown: 0,
      walkPhase: Math.random() * 10,
    });
  }

  tryNaturalSpawns(player, isNight) {
    if (this.mobs.length >= 18) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = 16 + Math.random() * 22;
    const sx = Math.floor(player.pos.x + Math.cos(angle) * dist);
    const sz = Math.floor(player.pos.z + Math.sin(angle) * dist);
    const sy = this.world.getSurfaceHeight(sx, sz);
    const groundId = this.world.getBlock(sx, sy, sz);

    if (groundId === BLOCK.WATER || sy <= SEA_LEVEL) return;

    const biome = this.world.getBiomeAt(sx, sz);

    if (isNight && player.mode === 'survival') {
      const torchLight = this.world.getVoxelLight(sx, sy + 1, sz);
      if (torchLight < 6) {
        const type = Math.random() < 0.7 ? 'zombie' : 'slime';
        this.spawnMob(type, sx + 0.5, sy + 1.05, sz + 0.5);
        return;
      }
    }

    if (!isNight && biome !== BIOME.DESERT) {
      const r = Math.random();
      const type = r < 0.42 ? 'sheep' : r < 0.76 ? 'pig' : 'chicken';
      this.spawnMob(type, sx + 0.5, sy + 1.05, sz + 0.5);
    }
  }

  raycastMob(origin, dir, maxDist = 4.6) {
    let closest = null;
    let closestT = maxDist;

    for (const mob of this.mobs) {
      // Ray vs expanded cylinder/AABB centered at (mob.x, mob.y + mob.height/2, mob.z)
      const r = mob.radius + 0.15;
      const minX = mob.x - r, maxX = mob.x + r;
      const minY = mob.y, maxY = mob.y + mob.height + 0.1;
      const minZ = mob.z - r, maxZ = mob.z + r;

      let tmin = -Infinity, tmax = Infinity;
      const axes = [
        [origin.x, dir.x, minX, maxX],
        [origin.y, dir.y, minY, maxY],
        [origin.z, dir.z, minZ, maxZ],
      ];
      let hit = true;
      for (const [o, d, mn, mx] of axes) {
        if (Math.abs(d) < 1e-6) {
          if (o < mn || o > mx) {
            hit = false;
            break;
          }
        } else {
          let t1 = (mn - o) / d;
          let t2 = (mx - o) / d;
          if (t1 > t2) [t1, t2] = [t2, t1];
          tmin = Math.max(tmin, t1);
          tmax = Math.min(tmax, t2);
          if (tmin > tmax) {
            hit = false;
            break;
          }
        }
      }
      if (hit && tmax >= 0 && tmin < closestT) {
        closestT = Math.max(0, tmin);
        closest = mob;
      }
    }
    return closest;
  }

  damageMob(mob, amount, knockX = 0, knockZ = 0) {
    mob.hp -= amount;
    mob.hurtFlash = 0.24;
    mob.vx += knockX * 6.2;
    mob.vy = 4.2;
    mob.vz += knockZ * 6.2;
    if (!mob.hostile) {
      mob.fleeTimer = 3.5;
      mob.yaw = Math.atan2(knockX, knockZ);
    }
    this.sound.playHitMob();
    this.spawnCustomParticles(mob.x, mob.y + mob.height * 0.5, mob.z, 0xff6b6b, 6, 2.6, 10);

    if (mob.hp <= 0) {
      this.spawnCustomParticles(mob.x, mob.y + 0.5, mob.z, 0xf1f3f5, 14, 3.2, 4);
      if (mob.type === 'sheep') {
        this.spawnDrop(mob.x, mob.y + 0.4, mob.z, BLOCK.WOOL, 1 + (Math.random() < 0.4 ? 1 : 0));
        this.spawnDrop(mob.x, mob.y + 0.4, mob.z, ITEM.RAW_MEAT, 1);
      } else if (mob.type === 'pig') {
        this.spawnDrop(mob.x, mob.y + 0.4, mob.z, ITEM.RAW_MEAT, 1 + (Math.random() < 0.5 ? 1 : 0));
      } else if (mob.type === 'chicken') {
        this.spawnDrop(mob.x, mob.y + 0.4, mob.z, ITEM.RAW_MEAT, 1);
      } else if (mob.type === 'zombie') {
        this.spawnDrop(mob.x, mob.y + 0.5, mob.z, Math.random() < 0.4 ? ITEM.IRON_INGOT : ITEM.COAL, 1);
      } else if (mob.type === 'slime') {
        this.spawnDrop(mob.x, mob.y + 0.4, mob.z, ITEM.GLOW_DUST, 1 + (Math.random() < 0.5 ? 1 : 0));
      }
      this.scene.remove(mob.group);
      const idx = this.mobs.indexOf(mob);
      if (idx !== -1) this.mobs.splice(idx, 1);
    }
  }

  update(dt, player, isNight) {
    // 1. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      const nx = p.mesh.position.x + p.vx * dt;
      const ny = p.mesh.position.y + p.vy * dt;
      const nz = p.mesh.position.z + p.vz * dt;
      if (isSolidBlock(this.world.getBlock(nx, ny, nz))) {
        p.vy = Math.abs(p.vy) * 0.25;
        p.vx *= 0.6;
        p.vz *= 0.6;
      } else {
        p.mesh.position.set(nx, ny, nz);
      }
    }

    // 2. Update dropped items & magnetic pickup
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      if (d.age > 180) {
        this.scene.remove(d.mesh);
        this.drops.splice(i, 1);
        continue;
      }

      d.vy -= GRAVITY * 0.75 * dt;
      const ny = d.y + d.vy * dt;
      if (isSolidBlock(this.world.getBlock(d.x, ny - 0.14, d.z))) {
        d.vy = 0;
        d.vx *= 0.82;
        d.vz *= 0.82;
      } else {
        d.y = ny;
      }
      if (!isSolidBlock(this.world.getBlock(d.x + d.vx * dt, d.y, d.z))) d.x += d.vx * dt;
      if (!isSolidBlock(this.world.getBlock(d.x, d.y, d.z + d.vz * dt))) d.z += d.vz * dt;

      // Magnetic attraction to player
      if (d.age >= d.pickupDelay && !player.dead) {
        const px = player.pos.x;
        const py = player.pos.y + 0.85;
        const pz = player.pos.z;
        const dist = Math.hypot(px - d.x, py - d.y, pz - d.z);
        if (dist < 2.35) {
          d.x += (px - d.x) * Math.min(1, dt * 11);
          d.y += (py - d.y) * Math.min(1, dt * 11);
          d.z += (pz - d.z) * Math.min(1, dt * 11);
          if (dist < 0.75) {
            const leftover = player.inventory.addItem(d.id, d.count);
            if (leftover === 0) {
              this.sound.playPickup();
              this.scene.remove(d.mesh);
              this.drops.splice(i, 1);
              continue;
            } else {
              d.count = leftover;
            }
          }
        }
      }

      d.mesh.position.set(d.x, d.y + Math.sin(d.age * 3.5) * 0.07 + 0.08, d.z);
      d.mesh.rotation.y = d.age * 2.2;
    }

    // 3. Update Ignited TNT
    for (let i = this.tnts.length - 1; i >= 0; i--) {
      const t = this.tnts[i];
      t.fuse -= dt;
      t.vy -= GRAVITY * dt;
      const ny = t.y + t.vy * dt;
      if (isSolidBlock(this.world.getBlock(t.x, ny - 0.49, t.z))) {
        t.vy = 0;
      } else {
        t.y = ny;
      }
      t.mesh.position.set(t.x, t.y, t.z);
      const flash = Math.floor(t.fuse * 8) % 2 === 0;
      t.mat.color.setHex(flash ? 0xffffff : 0xdb362d);
      const swell = 1.0 + Math.max(0, (0.6 - t.fuse) * 0.28);
      t.mesh.scale.set(swell, swell, swell);

      if (t.fuse <= 0) {
        this.scene.remove(t.mesh);
        t.mat.dispose();
        this.tnts.splice(i, 1);
        this.detonate(t, player);
      }
    }

    // 4. Natural Mob Spawning & Mob AI
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 3.2;
      this.tryNaturalSpawns(player, isNight);
    }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const distToPlayer = Math.hypot(player.pos.x - m.x, player.pos.z - m.z);

      // Despawn far-away mobs
      if (distToPlayer > 68) {
        this.scene.remove(m.group);
        this.mobs.splice(i, 1);
        continue;
      }

      // Zombies burn in bright daylight
      if (m.type === 'zombie' && !isNight && this.world.getSkyLight(m.x, m.y + 1, m.z) >= 13) {
        m.hp -= dt * 3.5;
        if (Math.random() < 0.25) {
          this.spawnCustomParticles(m.x, m.y + 1.1, m.z, 0xff922b, 1, 1.4, -2.0);
        }
        if (m.hp <= 0) {
          this.scene.remove(m.group);
          this.mobs.splice(i, 1);
          continue;
        }
      }

      // Hurt flash color recovery
      if (m.hurtFlash > 0) {
        m.hurtFlash -= dt;
        const red = m.hurtFlash > 0;
        for (const entry of m.parts.materials) {
          entry.mat.color.setHex(red ? 0xff4d4d : entry.baseHex);
        }
      }

      if (m.attackCooldown > 0) m.attackCooldown -= dt;

      // AI decisions
      if (m.hostile && player.mode === 'survival' && !player.dead && distToPlayer < 17) {
        m.yaw = Math.atan2(player.pos.x - m.x, player.pos.z - m.z);
        m.moveSpeed = m.type === 'zombie' ? 2.45 : 2.1;
        if (m.type === 'slime' && m.onGround && Math.random() < 0.08) {
          m.vy = 6.4;
        }
        if (distToPlayer < 1.15 && Math.abs(player.pos.y - m.y) < 1.6 && m.attackCooldown <= 0) {
          m.attackCooldown = 1.1;
          player.takeDamage(m.type === 'zombie' ? 3 : 2, (player.pos.x - m.x), (player.pos.z - m.z));
        }
      } else if (m.fleeTimer > 0) {
        m.fleeTimer -= dt;
        m.moveSpeed = 3.4;
      } else {
        m.aiTimer -= dt;
        if (m.aiTimer <= 0) {
          m.aiTimer = 1.8 + Math.random() * 3.2;
          if (Math.random() < 0.55) {
            m.yaw += (Math.random() - 0.5) * 2.4;
            m.moveSpeed = m.type === 'chicken' ? 1.5 : 1.25;
          } else {
            m.moveSpeed = 0;
          }
        }
      }

      // Horizontal desired velocity + knockback decay
      const dirX = Math.sin(m.yaw);
      const dirZ = Math.cos(m.yaw);
      const targetVx = dirX * m.moveSpeed;
      const targetVz = dirZ * m.moveSpeed;
      m.vx += (targetVx - m.vx) * Math.min(1, dt * 7);
      m.vz += (targetVz - m.vz) * Math.min(1, dt * 7);

      // Buoyancy in water or gravity
      const inWater = this.world.getBlock(m.x, m.y + 0.35, m.z) === BLOCK.WATER;
      if (inWater) {
        m.vy += 12.0 * dt;
        m.vy = Math.min(2.6, m.vy);
      } else {
        m.vy -= ((m.type === 'chicken' && m.vy < 0) ? GRAVITY * 0.35 : GRAVITY) * dt;
      }

      // Vertical collision
      const nextY = m.y + m.vy * dt;
      if (m.vy <= 0 && this.checkMobSolid(m.x, nextY, m.z, m.radius, m.height)) {
        m.y = Math.floor(nextY) + 1.001;
        m.vy = 0;
        m.onGround = true;
      } else {
        m.y = nextY;
        m.onGround = false;
      }

      // Horizontal movement + auto-jump 1-block ledges
      const nx = m.x + m.vx * dt;
      const nz = m.z + m.vz * dt;
      let blocked = false;
      if (!this.checkMobSolid(nx, m.y, m.z, m.radius, m.height)) {
        m.x = nx;
      } else {
        blocked = true;
      }
      if (!this.checkMobSolid(m.x, m.y, nz, m.radius, m.height)) {
        m.z = nz;
      } else {
        blocked = true;
      }

      if (blocked && m.onGround && m.moveSpeed > 0.2) {
        m.vy = 6.8;
        m.onGround = false;
      }

      // Animate legs & head
      m.group.position.set(m.x, m.y, m.z);
      m.group.rotation.y = m.yaw;

      const speedHoriz = Math.hypot(m.vx, m.vz);
      if (speedHoriz > 0.15) {
        m.walkPhase += dt * speedHoriz * 5.2;
        const swing = Math.sin(m.walkPhase) * 0.62;
        m.parts.legs.forEach((leg, idx) => {
          leg.rotation.x = idx % 2 === 0 ? swing : -swing;
        });
      } else {
        m.parts.legs.forEach((leg) => {
          leg.rotation.x *= 0.85;
        });
      }
      if (m.parts.head && distToPlayer < 7 && !m.hostile) {
        const lookYaw = Math.atan2(player.pos.x - m.x, player.pos.z - m.z) - m.yaw;
        if (Math.abs(lookYaw) < 1.1) {
          m.parts.head.rotation.y = lookYaw * 0.5;
        }
      }
    }
  }

  checkMobSolid(x, y, z, r, h) {
    const minX = Math.floor(x - r), maxX = Math.floor(x + r);
    const minY = Math.floor(y), maxY = Math.floor(y + h);
    const minZ = Math.floor(z - r), maxZ = Math.floor(z + r);
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (isSolidBlock(this.world.getBlock(bx, by, bz))) return true;
        }
      }
    }
    return false;
  }

  dispose() {
    for (const p of this.particles) this.scene.remove(p.mesh);
    for (const d of this.drops) this.scene.remove(d.mesh);
    for (const t of this.tnts) this.scene.remove(t.mesh);
    for (const m of this.mobs) this.scene.remove(m.group);
    this.particles = [];
    this.drops = [];
    this.tnts = [];
    this.mobs = [];
  }
}
