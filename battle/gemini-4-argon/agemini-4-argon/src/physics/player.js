import * as THREE from 'three';
import { CHUNK_HEIGHT, SOUND_GROUP } from '../world/constants.js';
import { BLOCK, getDef } from '../world/blocks.js';

const GRAVITY = 27.0;
const JUMP_VELOCITY = 8.9;
const WALK_SPEED = 4.6;
const SPRINT_SPEED = 6.7;
const CROUCH_SPEED = 2.2;
const FLY_SPEED = 11.5;

export class Player {
  constructor(camera, world, inventory, textureManager, sound) {
    this.camera = camera;
    this.world = world;
    this.inventory = inventory;
    this.textureManager = textureManager;
    this.sound = sound;

    this.pos = new THREE.Vector3(0.5, 42, 0.5);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.12;

    this.halfW = 0.3;
    this.height = 1.78;
    this.eyeHeight = 1.62;
    this.currentEyeHeight = 1.62;

    this.mode = 'survival'; // 'survival' | 'creative'
    this.flying = false;

    this.onGround = false;
    this.coyoteTimer = 0;
    this.inWater = false;
    this.headUnderWater = false;
    this.inLava = false;
    this.fallPeakY = null;

    // Survival vitals
    this.maxHealth = 20;
    this.health = 20;
    this.maxHunger = 20;
    this.hunger = 20;
    this.maxOxygen = 10;
    this.oxygen = 10;
    this.hurtCooldown = 0;
    this.regenTimer = 0;
    this.hungerTimer = 0;
    this.stepDistance = 0;

    // Input state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      crouch: false,
    };
    this.sensitivity = 0.0022;
    this.baseFov = 75;

    // Held 3D viewmodel rendered in dedicated depth-cleared overlay pass
    this.viewmodelGroup = new THREE.Group();
    this.heldMesh = null;
    this.heldItemKey = null;
    this.swingProgress = 0;
    this.swingActive = false;
    this.bobTime = 0;
    this.buildHeldViewmodel(null);

    this.onDamage = null;
    this.onDeath = null;
  }

  setMode(mode) {
    this.mode = mode === 'creative' ? 'creative' : 'survival';
    if (this.mode === 'survival') {
      this.flying = false;
    }
  }

  toggleFlight() {
    if (this.mode === 'creative') {
      this.flying = !this.flying;
      this.vel.y = 0;
      this.fallPeakY = this.pos.y;
      return this.flying;
    }
    return false;
  }

  triggerSwing() {
    if (!this.swingActive || this.swingProgress > 0.45) {
      this.swingActive = true;
      this.swingProgress = 0;
    }
  }

  rotateLook(movementX, movementY) {
    this.yaw -= movementX * this.sensitivity;
    this.pitch -= movementY * this.sensitivity;
    const limit = Math.PI / 2 - 0.015;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }

  getLookDirection(target = new THREE.Vector3()) {
    const cosP = Math.cos(this.pitch);
    target.set(
      -Math.sin(this.yaw) * cosP,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cosP
    );
    return target.normalize();
  }

  getEyePosition(target = new THREE.Vector3()) {
    return target.set(this.pos.x, this.pos.y + this.currentEyeHeight, this.pos.z);
  }

  intersectsBlock(bx, by, bz) {
    const minX = this.pos.x - this.halfW + 0.001;
    const maxX = this.pos.x + this.halfW - 0.001;
    const minY = this.pos.y + 0.001;
    const maxY = this.pos.y + this.height - 0.001;
    const minZ = this.pos.z - this.halfW + 0.001;
    const maxZ = this.pos.z + this.halfW - 0.001;

    return (
      maxX > bx && minX < bx + 1 &&
      maxY > by && minY < by + 1 &&
      maxZ > bz && minZ < bz + 1
    );
  }

  collidesAt(px, py, pz) {
    const minX = Math.floor(px - this.halfW);
    const maxX = Math.floor(px + this.halfW - 1e-5);
    const minY = Math.floor(py);
    const maxY = Math.floor(py + this.height - 1e-5);
    const minZ = Math.floor(pz - this.halfW);
    const maxZ = Math.floor(pz + this.halfW - 1e-5);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const id = this.world.getBlock(x, y, z);
          if (id !== BLOCK.AIR && getDef(id).solid) {
            return true;
          }
        }
      }
    }
    return false;
  }

  hasGroundSupportAt(px, py, pz) {
    const checkY = py - 0.08;
    const minX = Math.floor(px - this.halfW);
    const maxX = Math.floor(px + this.halfW - 1e-5);
    const minZ = Math.floor(pz - this.halfW);
    const maxZ = Math.floor(pz + this.halfW - 1e-5);
    const by = Math.floor(checkY);

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const id = this.world.getBlock(x, by, z);
        if (id !== BLOCK.AIR && getDef(id).solid) return true;
      }
    }
    return false;
  }

  damage(amount, knockDir = null) {
    if (this.mode === 'creative' || this.hurtCooldown > 0 || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtCooldown = 0.55;
    if (knockDir) {
      this.vel.x += knockDir.x * 5.5;
      this.vel.z += knockDir.z * 5.5;
      this.vel.y = Math.max(this.vel.y, 4.2);
    }
    if (this.sound) this.sound.playHurt();
    if (this.onDamage) this.onDamage(amount);
    if (this.health <= 0 && this.onDeath) {
      this.onDeath();
    }
  }

  respawn(spawnPos) {
    this.pos.set(spawnPos.x, spawnPos.y, spawnPos.z);
    this.vel.set(0, 0, 0);
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this.oxygen = this.maxOxygen;
    this.fallPeakY = spawnPos.y;
    this.hurtCooldown = 1.0;
  }

  tryEatActiveItem() {
    const slot = this.inventory.getActiveSlot();
    if (!slot) return false;
    const def = getDef(slot.id);
    if (!def || !def.food) return false;
    if (this.mode === 'survival' && this.hunger >= this.maxHunger && this.health >= this.maxHealth) {
      return false;
    }

    this.hunger = Math.min(this.maxHunger, this.hunger + def.food);
    this.health = Math.min(this.maxHealth, this.health + (def.heal || 0));
    this.inventory.consumeActive(1, this.mode === 'creative');
    this.triggerSwing();
    if (this.sound) this.sound.playEat();
    return true;
  }

  update(rawDt) {
    const dt = Math.min(0.05, rawDt);
    if (this.hurtCooldown > 0) this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);

    // Check fluid states
    const feetBlock = this.world.getBlock(this.pos.x, this.pos.y + 0.35, this.pos.z);
    const waistBlock = this.world.getBlock(this.pos.x, this.pos.y + 0.95, this.pos.z);
    const eyeBlock = this.world.getBlock(this.pos.x, this.pos.y + this.currentEyeHeight, this.pos.z);

    const wasInWater = this.inWater;
    this.inWater = feetBlock === BLOCK.WATER || waistBlock === BLOCK.WATER;
    this.headUnderWater = eyeBlock === BLOCK.WATER;
    this.inLava = feetBlock === BLOCK.LAVA || waistBlock === BLOCK.LAVA;

    if (this.inWater && !wasInWater && this.vel.y < -3.0 && this.sound) {
      this.sound.playSplash();
    }

    // Crouch height smoothing
    const crouching = this.keys.crouch && !this.flying && !this.inWater;
    this.height = crouching ? 1.5 : 1.78;
    const targetEye = crouching ? 1.3 : 1.62;
    this.currentEyeHeight += (targetEye - this.currentEyeHeight) * Math.min(1, dt * 14);

    // Desired horizontal wish direction
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    let moveX = 0;
    let moveZ = 0;
    if (this.keys.forward) { moveX += forwardX; moveZ += forwardZ; }
    if (this.keys.backward) { moveX -= forwardX; moveZ -= forwardZ; }
    if (this.keys.right) { moveX += rightX; moveZ += rightZ; }
    if (this.keys.left) { moveX -= rightX; moveZ -= rightZ; }

    const moveLen = Math.hypot(moveX, moveZ);
    if (moveLen > 1e-4) {
      moveX /= moveLen;
      moveZ /= moveLen;
    }

    const canSprint = this.keys.sprint && this.keys.forward && !crouching && (this.hunger > 4 || this.mode === 'creative');
    let targetSpeed = WALK_SPEED;
    if (this.flying) targetSpeed = canSprint ? FLY_SPEED * 1.65 : FLY_SPEED;
    else if (this.inWater) targetSpeed = canSprint ? 3.8 : 2.9;
    else if (crouching) targetSpeed = CROUCH_SPEED;
    else if (canSprint) targetSpeed = SPRINT_SPEED;

    // SmoothFOV response to sprinting
    const desiredFov = (canSprint && moveLen > 0.1) ? this.baseFov + 7 : this.baseFov;
    if (Math.abs(this.camera.fov - desiredFov) > 0.05) {
      this.camera.fov += (desiredFov - this.camera.fov) * Math.min(1, dt * 10);
      this.camera.updateProjectionMatrix();
    }

    if (this.flying) {
      const accel = 14 * dt;
      this.vel.x += (moveX * targetSpeed - this.vel.x) * Math.min(1, accel);
      this.vel.z += (moveZ * targetSpeed - this.vel.z) * Math.min(1, accel);
      let vy = 0;
      if (this.keys.jump) vy += FLY_SPEED * 0.8;
      if (this.keys.crouch) vy -= FLY_SPEED * 0.8;
      this.vel.y += (vy - this.vel.y) * Math.min(1, 14 * dt);
      this.fallPeakY = this.pos.y;
    } else if (this.inWater) {
      const accel = 8 * dt;
      this.vel.x += (moveX * targetSpeed - this.vel.x) * Math.min(1, accel);
      this.vel.z += (moveZ * targetSpeed - this.vel.z) * Math.min(1, accel);
      this.vel.y -= GRAVITY * 0.22 * dt;
      this.vel.y *= Math.pow(0.85, dt * 10);
      if (this.keys.jump) {
        this.vel.y = Math.min(4.4, this.vel.y + 16 * dt);
      } else if (this.keys.crouch) {
        this.vel.y = Math.max(-4.2, this.vel.y - 12 * dt);
      }
      this.fallPeakY = this.pos.y;
    } else {
      const control = this.onGround ? 16 : 6.5;
      this.vel.x += (moveX * targetSpeed - this.vel.x) * Math.min(1, control * dt);
      this.vel.z += (moveZ * targetSpeed - this.vel.z) * Math.min(1, control * dt);
      this.vel.y = Math.max(-44, this.vel.y - GRAVITY * dt);

      if (this.onGround) {
        this.coyoteTimer = 0.1;
      } else {
        this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      }

      if (this.keys.jump && this.coyoteTimer > 0) {
        this.vel.y = JUMP_VELOCITY;
        this.onGround = false;
        this.coyoteTimer = 0;
      }
    }

    // Sub-stepped axis-separated AABB collision
    const steps = Math.max(1, Math.ceil((this.vel.length() * dt) / 0.3));
    const stepDt = dt / steps;
    const prevPos = this.pos.clone();

    for (let s = 0; s < steps; s++) {
      this.moveSingleStep(stepDt, crouching);
    }

    // Clamp inside world ceiling/floor safety
    if (this.pos.y < 1.05) {
      this.pos.y = 1.05;
      this.vel.y = 0;
      this.onGround = true;
    } else if (this.pos.y > CHUNK_HEIGHT + 16) {
      this.pos.y = CHUNK_HEIGHT + 16;
      this.vel.y = Math.min(0, this.vel.y);
    }

    // Footstep sounds
    const horizMoved = Math.hypot(this.pos.x - prevPos.x, this.pos.z - prevPos.z);
    if (this.onGround && !this.flying && horizMoved > 0.001) {
      this.stepDistance += horizMoved;
      const stride = crouching ? 1.9 : canSprint ? 2.15 : 1.95;
      if (this.stepDistance >= stride) {
        this.stepDistance = 0;
        const groundId = this.world.getBlock(this.pos.x, this.pos.y - 0.2, this.pos.z);
        const gDef = getDef(groundId);
        if (this.sound && groundId !== BLOCK.AIR) {
          this.sound.playStep(gDef.sound || SOUND_GROUP.GRASS);
        }
      }
    }

    // Survival vitals update
    this.updateSurvivalVitals(dt, horizMoved, canSprint);

    // Sync camera transform + head bob
    this.updateCameraAndViewmodel(dt, horizMoved / Math.max(dt, 1e-4));
  }

  moveSingleStep(dt, crouching) {
    // 1. Y axis
    const nextY = this.pos.y + this.vel.y * dt;
    if (!this.collidesAt(this.pos.x, nextY, this.pos.z)) {
      if (this.vel.y < 0 && !this.flying && !this.inWater) {
        if (this.fallPeakY === null || this.pos.y > this.fallPeakY) {
          this.fallPeakY = this.pos.y;
        }
      }
      this.pos.y = nextY;
      this.onGround = false;
    } else {
      if (this.vel.y < 0) {
        // Landed! Check fall damage
        if (!this.flying && !this.inWater && this.fallPeakY !== null) {
          const fallDist = this.fallPeakY - this.pos.y;
          if (fallDist > 3.9) {
            const dmg = Math.floor((fallDist - 3.4) * 1.15);
            if (dmg > 0) this.damage(dmg);
          }
        }
        this.fallPeakY = this.pos.y;
        this.onGround = true;
      }
      this.vel.y = 0;
    }

    // 2. X axis (with sneak edge-guard)
    let nextX = this.pos.x + this.vel.x * dt;
    if (crouching && this.onGround && !this.hasGroundSupportAt(nextX, this.pos.y, this.pos.z)) {
      this.vel.x = 0;
    } else if (!this.collidesAt(nextX, this.pos.y, this.pos.z)) {
      this.pos.x = nextX;
    } else {
      // Auto-swim hop out onto 1-block shoreline when in water!
      if (this.inWater && !this.collidesAt(nextX, this.pos.y + 1.05, this.pos.z)) {
        this.vel.y = 5.4;
      } else {
        this.vel.x = 0;
      }
    }

    // 3. Z axis (with sneak edge-guard)
    let nextZ = this.pos.z + this.vel.z * dt;
    if (crouching && this.onGround && !this.hasGroundSupportAt(this.pos.x, this.pos.y, nextZ)) {
      this.vel.z = 0;
    } else if (!this.collidesAt(this.pos.x, this.pos.y, nextZ)) {
      this.pos.z = nextZ;
    } else {
      if (this.inWater && !this.collidesAt(this.pos.x, this.pos.y + 1.05, nextZ)) {
        this.vel.y = 5.4;
      } else {
        this.vel.z = 0;
      }
    }
  }

  updateSurvivalVitals(dt, horizMoved, sprinting) {
    if (this.mode !== 'survival') {
      this.health = this.maxHealth;
      this.hunger = this.maxHunger;
      this.oxygen = this.maxOxygen;
      return;
    }

    // Underwater oxygen
    if (this.headUnderWater) {
      this.oxygen = Math.max(0, this.oxygen - dt * 0.75);
      if (this.oxygen <= 0) {
        this.damage(1.5);
      }
    } else {
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + dt * 2.8);
    }

    // Lava & Cactus contact hazards
    if (this.inLava) {
      this.damage(3.5);
    } else {
      const nearBlock = this.world.getBlock(this.pos.x, this.pos.y + 0.5, this.pos.z);
      if (getDef(nearBlock).hurts > 0) {
        this.damage(getDef(nearBlock).hurts);
      }
    }

    // Gentle hunger drain from exertion (friendly pace, never annoying)
    this.hungerTimer += dt * (sprinting && horizMoved > 0.01 ? 2.4 : horizMoved > 0.01 ? 0.65 : 0.12);
    if (this.hungerTimer >= 22) {
      this.hungerTimer = 0;
      this.hunger = Math.max(0, this.hunger - 1);
    }

    // Health regeneration when well-fed
    if (this.hunger >= 14 && this.health < this.maxHealth) {
      this.regenTimer += dt;
      if (this.regenTimer >= 2.8) {
        this.regenTimer = 0;
        this.health = Math.min(this.maxHealth, this.health + 1);
      }
    } else {
      this.regenTimer = 0;
    }
  }

  updateCameraAndViewmodel(dt, currentSpeed) {
    // Check if held item changed
    const slot = this.inventory.getActiveSlot();
    const key = slot ? slot.id : 0;
    if (key !== this.heldItemKey) {
      this.heldItemKey = key;
      this.buildHeldViewmodel(slot ? slot.id : null);
    }

    const moving = this.onGround && !this.flying && currentSpeed > 0.35;
    if (moving) {
      this.bobTime += dt * Math.min(11, 4.5 + currentSpeed * 0.95);
    } else {
      this.bobTime += dt * 1.4;
    }

    const camBobY = moving ? Math.sin(this.bobTime * 2) * 0.036 : 0;
    const camBobX = moving ? Math.cos(this.bobTime) * 0.02 : 0;

    this.camera.position.set(
      this.pos.x + camBobX,
      this.pos.y + this.currentEyeHeight + camBobY,
      this.pos.z
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // Swing animation
    if (this.swingActive) {
      this.swingProgress += dt * 4.6;
      if (this.swingProgress >= 1) {
        this.swingProgress = 0;
        this.swingActive = false;
      }
    }

    const swingSin = Math.sin(this.swingProgress * Math.PI);
    const walkSwayX = moving ? Math.cos(this.bobTime) * 0.025 : Math.cos(this.bobTime) * 0.004;
    const walkSwayY = moving ? Math.abs(Math.sin(this.bobTime)) * -0.028 : Math.sin(this.bobTime) * 0.006;

    this.viewmodelGroup.position.set(
      0.42 + walkSwayX - swingSin * 0.14,
      -0.36 + walkSwayY - swingSin * 0.08,
      -0.58 - swingSin * 0.12
    );
    this.viewmodelGroup.rotation.set(
      -swingSin * 0.85,
      0.35 + swingSin * 0.45,
      swingSin * 0.3
    );
  }

  buildHeldViewmodel(id) {
    while (this.viewmodelGroup.children.length > 0) {
      const ch = this.viewmodelGroup.children.pop();
      ch.traverse?.((node) => {
        if (node.geometry) node.geometry.dispose();
        if (node.material && node.material.dispose) node.material.dispose();
      });
    }

    if (!id) {
      // Cozy voxel hand/arm
      const geo = new THREE.BoxGeometry(0.16, 0.44, 0.16);
      const mat = new THREE.MeshLambertMaterial({ color: 0xe3ac86 });
      const arm = new THREE.Mesh(geo, mat);
      arm.rotation.set(0.75, -0.25, -0.2);
      arm.position.set(0.06, -0.08, -0.05);
      this.viewmodelGroup.add(arm);
      return;
    }

    const def = getDef(id);
    if (def.isBlock && def.solid) {
      // Textured 3D mini-cube using atlas UVs
      const geo = new THREE.BoxGeometry(0.29, 0.29, 0.29);
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
      const cube = new THREE.Mesh(geo, mat);
      cube.rotation.set(0.2, 0.65, 0);
      this.viewmodelGroup.add(cube);
      return;
    }

    if (id === BLOCK.TORCH || id === BLOCK.LANTERN) {
      const stickGeo = new THREE.BoxGeometry(0.075, 0.34, 0.075);
      const stickMat = new THREE.MeshLambertMaterial({ color: id === BLOCK.LANTERN ? 0x434954 : 0x8a6236 });
      const stick = new THREE.Mesh(stickGeo, stickMat);

      const tipGeo = new THREE.BoxGeometry(id === BLOCK.LANTERN ? 0.14 : 0.095, id === BLOCK.LANTERN ? 0.18 : 0.095, id === BLOCK.LANTERN ? 0.14 : 0.095);
      const tipMat = new THREE.MeshBasicMaterial({ color: 0xffcf54 });
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.y = id === BLOCK.LANTERN ? 0.06 : 0.19;

      const grp = new THREE.Group();
      grp.add(stick, tip);
      grp.rotation.set(0.22, 0.1, 0.12);
      this.viewmodelGroup.add(grp);
      return;
    }

    // 3D Extruded Voxel Tool / Weapon / Food / Flora mesh
    const voxels = this.textureManager.getItemVoxels16(id);
    if (voxels.length > 0) {
      const s = 0.025;
      const thickness = 0.032;
      const pixGeo = new THREE.BoxGeometry(s, s, thickness);
      const pixMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const inst = new THREE.InstancedMesh(pixGeo, pixMat, voxels.length);

      const dummy = new THREE.Object3D();
      const col = new THREE.Color();
      voxels.forEach((v, idx) => {
        dummy.position.set((v.x - 7.5) * s, (7.5 - v.y) * s, 0);
        dummy.updateMatrix();
        inst.setMatrixAt(idx, dummy.matrix);
        col.set(v.color);
        inst.setColorAt(idx, col);
      });
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;

      inst.rotation.set(0.08, -0.72, -0.14);
      this.viewmodelGroup.add(inst);
    }
  }

  serialize() {
    return {
      pos: [this.pos.x, this.pos.y, this.pos.z],
      yaw: this.yaw,
      pitch: this.pitch,
      mode: this.mode,
      flying: this.flying,
      health: this.health,
      hunger: this.hunger,
      oxygen: this.oxygen,
    };
  }

  deserialize(data) {
    if (!data) return;
    if (Array.isArray(data.pos) && data.pos.length === 3) {
      this.pos.set(data.pos[0], data.pos[1], data.pos[2]);
      this.fallPeakY = this.pos.y;
    }
    this.yaw = data.yaw ?? 0;
    this.pitch = data.pitch ?? -0.12;
    this.setMode(data.mode || 'survival');
    this.flying = Boolean(data.flying && this.mode === 'creative');
    this.health = data.health ?? this.maxHealth;
    this.hunger = data.hunger ?? this.maxHunger;
    this.oxygen = data.oxygen ?? this.maxOxygen;
  }
}
