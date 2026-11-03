// First-Person Player Controller: Physics, AABB Collision, Mining, Placement & 3D Viewmodel
import * as THREE from 'three';
import {
  PLAYER_RADIUS,
  PLAYER_HEIGHT,
  PLAYER_SNEAK_HEIGHT,
  PLAYER_EYE_HEIGHT,
  PLAYER_SNEAK_EYE_HEIGHT,
  GRAVITY,
  WATER_GRAVITY,
  JUMP_VELOCITY,
  TERMINAL_VELOCITY,
  WALK_SPEED,
  SPRINT_SPEED,
  SNEAK_SPEED,
  SWIM_SPEED,
  FLY_SPEED,
  FLY_SPRINT_SPEED,
  REACH_DISTANCE,
  MAX_HEALTH,
  MAX_AIR,
  GAME_MODES,
} from './constants.js';
import { BLOCK, ITEM, TILES, getDef } from './items.js';
import { getTileUVs } from './textures.js';

export class Player {
  constructor(camera, scene, world, inventory, entities, particles, sound, atlasTexture) {
    this.camera = camera;
    this.scene = scene;
    this.world = world;
    this.inventory = inventory;
    this.entities = entities;
    this.particles = particles;
    this.sound = sound;
    this.atlasTexture = atlasTexture;

    this.pos = new THREE.Vector3(0.5, 50, 0.5);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.12;

    this.onGround = false;
    this.inWater = false;
    this.headUnderwater = false;
    this.flying = false;
    this.sneaking = false;
    this.sprinting = false;

    this.health = MAX_HEALTH;
    this.air = MAX_AIR;
    this.dead = false;
    this.hurtCooldown = 0;
    this.regenTimer = 0;
    this.highestAirY = 50;

    // Input state
    this.keys = new Set();
    this.mouseDownLeft = false;
    this.mouseDownRight = false;
    this.lastSpacePress = 0;
    this.sensitivity = 0.0022;

    // Mining & interaction state
    this.targetHit = null;
    this.miningKey = null;
    this.miningProgress = 0;
    this.digTick = 0;
    this.breakCooldown = 0;
    this.placeCooldown = 0;
    this.attackCooldown = 0;

    // Walk bob & swing animation
    this.bobPhase = 0;
    this.bobAmount = 0;
    this.swingAnim = 0;
    this.stepDistance = 0;
    this.currentEyeH = PLAYER_EYE_HEIGHT;

    // Callbacks for UI
    this.onOpenStation = null;
    this.onStatsChange = null;
    this.onDamageFlash = null;

    this.buildTargetVisuals();
    this.buildHeldViewModel();
    this.refreshHeldModel();
  }

  buildTargetVisuals() {
    if (!this.scene) return;

    // Crisp selection wireframe box
    const boxGeom = new THREE.BoxGeometry(1.006, 1.006, 1.006);
    const edges = new THREE.EdgesGeometry(boxGeom);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x11151c,
      transparent: true,
      opacity: 0.72,
    });
    this.selectionBox = new THREE.LineSegments(edges, lineMat);
    this.selectionBox.visible = false;
    this.scene.add(this.selectionBox);
    boxGeom.dispose();

    // Progressive 6-stage pixel crack overlay cube
    this.crackGeom = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    this.crackMat = new THREE.MeshBasicMaterial({
      map: this.atlasTexture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.crackMesh = new THREE.Mesh(this.crackGeom, this.crackMat);
    this.crackMesh.visible = false;
    this.crackMesh.renderOrder = 5;
    this.scene.add(this.crackMesh);
    this.currentCrackStage = -1;
  }

  setCrackStage(stage) {
    if (!this.crackGeom || stage === this.currentCrackStage) return;
    this.currentCrackStage = stage;
    const [u0, v0, u1, v1] = getTileUVs(TILES.CRACK_0 + stage);
    const uvAttr = this.crackGeom.getAttribute('uv');
    for (let f = 0; f < 6; f++) {
      const base = f * 4;
      uvAttr.setXY(base + 0, u0, v0);
      uvAttr.setXY(base + 1, u1, v0);
      uvAttr.setXY(base + 2, u0, v1);
      uvAttr.setXY(base + 3, u1, v1);
    }
    uvAttr.needsUpdate = true;
  }

  buildHeldViewModel() {
    if (!this.camera) return;
    this.handPivot = new THREE.Group();
    this.handPivot.position.set(0.42, -0.36, -0.62);
    this.camera.add(this.handPivot);
    this.heldMesh = null;
    this.lastHeldId = -1;
  }

  refreshHeldModel() {
    if (!this.handPivot) return;
    const sel = this.inventory.getSelected();
    const id = sel ? sel.id : 0;
    if (id === this.lastHeldId) return;
    this.lastHeldId = id;

    if (this.heldMesh) {
      this.handPivot.remove(this.heldMesh);
      this.heldMesh.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          o.material.dispose();
        }
      });
      this.heldMesh = null;
    }

    if (id === 0) {
      // Cozy voxel arm when empty-handed
      const geom = new THREE.BoxGeometry(0.16, 0.16, 0.48);
      const mat = new THREE.MeshLambertMaterial({ color: 0xe2b18c, depthTest: false });
      const arm = new THREE.Mesh(geom, mat);
      arm.renderOrder = 20;
      arm.rotation.set(0.22, -0.28, 0.08);
      this.heldMesh = arm;
      this.handPivot.add(arm);
      return;
    }

    const def = getDef(id);
    if (def.isBlock && def.renderType === 'cube') {
      const geom = new THREE.BoxGeometry(0.28, 0.28, 0.28);
      const uvAttr = geom.getAttribute('uv');
      // BoxGeometry face order: +X (east), -X (west), +Y (top), -Y (bottom), +Z (south), -Z (north)
      const faceKeys = ['east', 'west', 'top', 'bottom', 'south', 'north'];
      for (let f = 0; f < 6; f++) {
        const [u0, v0, u1, v1] = getTileUVs(def.faces[faceKeys[f]]);
        const base = f * 4;
        uvAttr.setXY(base + 0, u0, v0);
        uvAttr.setXY(base + 1, u1, v0);
        uvAttr.setXY(base + 2, u0, v1);
        uvAttr.setXY(base + 3, u1, v1);
      }
      uvAttr.needsUpdate = true;
      const mat = new THREE.MeshLambertMaterial({
        map: this.atlasTexture,
        transparent: def.translucent || def.alphaTest,
        alphaTest: def.alphaTest ? 0.4 : 0,
        depthTest: false,
      });
      const cube = new THREE.Mesh(geom, mat);
      cube.renderOrder = 20;
      cube.rotation.set(0.25, 0.68, 0);
      this.heldMesh = cube;
      this.handPivot.add(cube);
    } else if (id === BLOCK.TORCH) {
      const grp = new THREE.Group();
      const stick = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.3, 0.06),
        new THREE.MeshLambertMaterial({ color: 0x8d6538, depthTest: false })
      );
      const flame = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.09, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xffcf40, depthTest: false })
      );
      flame.position.y = 0.18;
      stick.renderOrder = 20;
      flame.renderOrder = 21;
      grp.add(stick, flame);
      grp.rotation.set(0.25, -0.2, 0.15);
      this.heldMesh = grp;
      this.handPivot.add(grp);
    } else {
      // Crisp 3D voxel tool / item representation
      const grp = new THREE.Group();
      const handleCol = 0x7b5531;
      const headCol = def.iconColor || def.particleColor || '#cccccc';
      if (def.toolType) {
        const handle = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 0.36, 0.05),
          new THREE.MeshLambertMaterial({ color: handleCol, depthTest: false })
        );
        handle.renderOrder = 20;
        grp.add(handle);

        const headW = def.toolType === 'pickaxe' ? 0.26 : def.toolType === 'sword' ? 0.08 : 0.16;
        const headH = def.toolType === 'sword' ? 0.32 : 0.11;
        const head = new THREE.Mesh(
          new THREE.BoxGeometry(headW, headH, 0.06),
          new THREE.MeshLambertMaterial({ color: headCol, depthTest: false })
        );
        head.position.y = def.toolType === 'sword' ? 0.2 : 0.16;
        head.renderOrder = 21;
        grp.add(head);
        grp.rotation.set(0.35, -0.5, 0.2);
      } else {
        const itemBox = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.18, 0.07),
          new THREE.MeshLambertMaterial({ color: headCol, depthTest: false })
        );
        itemBox.renderOrder = 20;
        itemBox.rotation.set(0.15, -0.35, 0.1);
        grp.add(itemBox);
      }
      this.heldMesh = grp;
      this.handPivot.add(grp);
    }
  }

  triggerSwing() {
    this.swingAnim = 1.0;
  }

  onMouseMove(dx, dy) {
    if (this.dead) return;
    const zoomScale = this.keys.has('KeyC') ? 0.35 : 1.0;
    this.yaw -= dx * this.sensitivity * zoomScale;
    this.pitch -= dy * this.sensitivity * zoomScale;
    const maxPitch = Math.PI * 0.5 - 0.015;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  pickBlock(isCreative = false) {
    const hit = this.world.raycast(this.getEyePosition(), this.getLookDirection(), REACH_DISTANCE);
    if (!hit || !hit.id) return false;
    const targetId = hit.id === BLOCK.SNOW_GRASS ? BLOCK.GRASS : hit.id;

    // 1. Check if block already exists in Hotbar (0..8)
    for (let i = 0; i < 9; i++) {
      const s = this.inventory.slots[i];
      if (s && s.id === targetId) {
        this.inventory.selectSlot(i);
        return true;
      }
    }

    // 2. Check Backpack (9..35) and swap into selected hotbar slot
    for (let i = 9; i < 36; i++) {
      const s = this.inventory.slots[i];
      if (s && s.id === targetId) {
        const prev = this.inventory.slots[this.inventory.selectedSlot];
        this.inventory.slots[this.inventory.selectedSlot] = s;
        this.inventory.slots[i] = prev;
        this.inventory.notify();
        return true;
      }
    }

    // 3. In Creative mode, materialize the picked block directly into selected slot
    if (isCreative) {
      this.inventory.slots[this.inventory.selectedSlot] = this.inventory.makeStack(targetId, 1);
      this.inventory.notify();
      return true;
    }
    return false;
  }

  tossSelectedItem(tossStack = false) {
    const sel = this.inventory.getSelected();
    if (!sel || !this.entities) return false;
    const dropCount = tossStack ? sel.count : 1;
    const id = sel.id;
    sel.count -= dropCount;
    if (sel.count <= 0) this.inventory.slots[this.inventory.selectedSlot] = null;
    this.inventory.notify();

    const dir = this.getLookDirection();
    const eye = this.getEyePosition();
    this.triggerSwing();
    this.entities.spawnDrop(
      eye.x + dir.x * 0.45,
      eye.y - 0.2,
      eye.z + dir.z * 0.45,
      id,
      dropCount,
      {
        vx: dir.x * 6.5,
        vy: dir.y * 5.0 + 2.4,
        vz: dir.z * 6.5,
        pickupDelay: 1.25,
      }
    );
    if (this.sound) this.sound.playSwing();
    return true;
  }

  onKeyDown(code, gameMode) {
    if (code === 'Space' && !this.keys.has('Space')) {
      const now = performance.now();
      if (gameMode === GAME_MODES.CREATIVE && now - this.lastSpacePress < 300) {
        this.flying = !this.flying;
        this.vel.y = 0;
        this.highestAirY = this.pos.y;
        this.lastSpacePress = 0;
      } else {
        this.lastSpacePress = now;
      }
    }
    if (code === 'KeyF' && gameMode === GAME_MODES.CREATIVE) {
      this.flying = !this.flying;
      this.vel.y = 0;
      this.highestAirY = this.pos.y;
    }
    this.keys.add(code);
  }

  onKeyUp(code) {
    this.keys.delete(code);
  }

  clearInputs() {
    this.keys.clear();
    this.mouseDownLeft = false;
    this.mouseDownRight = false;
    this.resetMining();
  }

  getEyePosition() {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.currentEyeH, this.pos.z);
  }

  getLookDirection() {
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    return new THREE.Vector3(0, 0, -1).applyEuler(euler).normalize();
  }

  getNearbyStations() {
    const stations = { crafting: false, smelting: false };
    const px = Math.floor(this.pos.x);
    const py = Math.floor(this.pos.y + 0.8);
    const pz = Math.floor(this.pos.z);
    for (let dy = -3; dy <= 3; dy++) {
      for (let dz = -4; dz <= 4; dz++) {
        for (let dx = -4; dx <= 4; dx++) {
          const b = this.world.getBlock(px + dx, py + dy, pz + dz);
          if (b === BLOCK.CRAFTING_TABLE) stations.crafting = true;
          else if (b === BLOCK.FURNACE) stations.smelting = true;
        }
      }
    }
    return stations;
  }

  takeDamage(amount, knockX = 0, knockZ = 0) {
    if (this.dead || this.hurtCooldown > 0 || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtCooldown = 0.55;
    this.regenTimer = 0;

    if (knockX !== 0 || knockZ !== 0) {
      const len = Math.hypot(knockX, knockZ) || 1;
      this.vel.x += (knockX / len) * 5.5;
      this.vel.z += (knockZ / len) * 5.5;
      this.vel.y = Math.max(this.vel.y, 4.2);
    }

    if (this.sound) this.sound.playHurt();
    if (typeof this.onDamageFlash === 'function') this.onDamageFlash();
    if (this.health <= 0) {
      this.dead = true;
      this.clearInputs();
    }
    if (typeof this.onStatsChange === 'function') this.onStatsChange();
  }

  respawn() {
    const sp = this.homePos || this.world.findSpawnPoint();
    this.pos.set(sp.x, sp.y, sp.z);
    this.vel.set(0, 0, 0);
    this.health = MAX_HEALTH;
    this.air = MAX_AIR;
    this.dead = false;
    this.highestAirY = sp.y;
    if (typeof this.onStatsChange === 'function') this.onStatsChange();
  }

  update(dt, gameMode, controlsLocked) {
    if (gameMode !== GAME_MODES.CREATIVE && this.flying) {
      this.flying = false;
      this.highestAirY = this.pos.y;
    }

    this.refreshHeldModel();

    if (this.hurtCooldown > 0) this.hurtCooldown -= dt;
    if (this.breakCooldown > 0) this.breakCooldown -= dt;
    if (this.placeCooldown > 0) this.placeCooldown -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    if (!this.dead) {
      // Sub-step physics if dt > 0.025 so fast falls never tunnel
      const steps = dt > 0.03 ? 2 : 1;
      const subDt = Math.min(dt, 0.08) / steps;
      for (let s = 0; s < steps; s++) {
        this.stepPhysics(subDt, gameMode, controlsLocked);
      }

      this.updateSurvivalStats(dt, gameMode);
    }

    this.updateCamera(dt);

    if (controlsLocked && !this.dead) {
      this.updateInteractions(dt, gameMode);
    } else {
      this.resetMining();
      if (this.selectionBox) this.selectionBox.visible = false;
    }
  }

  stepPhysics(dt, gameMode, controlsLocked) {
    const moveForward = controlsLocked ? (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) : 0;
    const moveRight = controlsLocked ? (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) : 0;
    const wantJump = controlsLocked && this.keys.has('Space');
    const wantSneak = controlsLocked && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'));
    const wantSprint = controlsLocked && (this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has('KeyR'));

    // Check water immersion
    const feetBlock = this.world.getBlock(this.pos.x, this.pos.y + 0.18, this.pos.z);
    const chestBlock = this.world.getBlock(this.pos.x, this.pos.y + 0.9, this.pos.z);
    const eyeBlock = this.world.getBlock(this.pos.x, this.pos.y + this.currentEyeH, this.pos.z);
    const nowInWater = feetBlock === BLOCK.WATER || chestBlock === BLOCK.WATER;

    if (nowInWater && !this.inWater && this.vel.y < -3.5) {
      if (this.sound) this.sound.playSplash();
      if (this.particles) this.particles.emitSplash(this.pos.x, this.pos.y + 0.2, this.pos.z, 18);
    }
    this.inWater = nowInWater;
    this.headUnderwater = eyeBlock === BLOCK.WATER;
    if (this.inWater) this.highestAirY = this.pos.y;

    // Stand-up clearance check when releasing sneak
    if (!wantSneak && this.sneaking) {
      if (!this.collidesAt(this.pos.x, this.pos.y, this.pos.z, PLAYER_HEIGHT)) {
        this.sneaking = false;
      }
    } else if (wantSneak && !this.flying) {
      this.sneaking = true;
    } else if (this.flying) {
      this.sneaking = false;
    }

    this.sprinting = Boolean(wantSprint && moveForward > 0 && !this.sneaking && !this.inWater);

    // Forward & Right horizontal vectors from yaw
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    let wishX = -sinY * moveForward + cosY * moveRight;
    let wishZ = -cosY * moveForward - sinY * moveRight;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 1e-5) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }

    let speed = WALK_SPEED;
    if (this.flying) speed = wantSprint ? FLY_SPRINT_SPEED : FLY_SPEED;
    else if (this.inWater) speed = SWIM_SPEED;
    else if (this.sneaking) speed = SNEAK_SPEED;
    else if (this.sprinting) speed = SPRINT_SPEED;

    const accel = this.flying ? 14.0 : this.onGround ? 18.0 : 7.5;
    this.vel.x += (wishX * speed - this.vel.x) * Math.min(1, dt * accel);
    this.vel.z += (wishZ * speed - this.vel.z) * Math.min(1, dt * accel);

    if (this.flying) {
      let vyTarget = 0;
      if (wantJump) vyTarget += speed * 0.78;
      if (wantSneak) vyTarget -= speed * 0.78;
      this.vel.y += (vyTarget - this.vel.y) * Math.min(1, dt * 12.0);
      this.highestAirY = this.pos.y;
    } else if (this.inWater) {
      if (wantJump) {
        this.vel.y += 18.0 * dt;
        this.vel.y = Math.min(this.vel.y, 4.4);
      } else {
        this.vel.y -= WATER_GRAVITY * dt;
        this.vel.y = Math.max(this.vel.y, -3.2);
      }
      if (wantSneak) this.vel.y -= 8.0 * dt;
    } else {
      if (wantJump && this.onGround) {
        this.vel.y = JUMP_VELOCITY;
        this.onGround = false;
      }
      this.vel.y = Math.max(-TERMINAL_VELOCITY, this.vel.y - GRAVITY * dt);
    }

    const playerH = this.sneaking ? PLAYER_SNEAK_HEIGHT : PLAYER_HEIGHT;
    const prevX = this.pos.x;
    const prevZ = this.pos.z;
    const wasOnGround = this.onGround;

    // --- Axis-Separated Swept Collision ---
    // 1. Y Axis
    const nextY = this.pos.y + this.vel.y * dt;
    if (!this.collidesAt(this.pos.x, nextY, this.pos.z, playerH)) {
      this.pos.y = nextY;
      this.onGround = false;
      if (this.pos.y > this.highestAirY) this.highestAirY = this.pos.y;
    } else {
      if (this.vel.y < 0) {
        // Landed on floor!
        const fallDist = this.highestAirY - this.pos.y;
        if (
          fallDist > 3.8 &&
          !this.inWater &&
          !this.flying &&
          gameMode !== GAME_MODES.CREATIVE
        ) {
          const dmg = Math.floor(fallDist - 3.3);
          if (dmg > 0) this.takeDamage(dmg);
        }
        this.pos.y = Math.floor(nextY) + 1.0002;
        this.onGround = true;
        this.highestAirY = this.pos.y;
      } else if (this.vel.y > 0) {
        // Hit ceiling
        this.pos.y = Math.floor(nextY + playerH) - playerH - 0.0002;
      }
      this.vel.y = 0;
    }

    // 2. X Axis (with Sneak Ledge-Fall Protection!)
    const nextX = this.pos.x + this.vel.x * dt;
    if (!this.collidesAt(nextX, this.pos.y, this.pos.z, playerH)) {
      if (this.sneaking && wasOnGround && !this.hasGroundSupport(nextX, this.pos.y, this.pos.z)) {
        this.vel.x = 0;
      } else {
        this.pos.x = nextX;
      }
    } else {
      this.vel.x = 0;
    }

    // 3. Z Axis (with Sneak Ledge-Fall Protection!)
    const nextZ = this.pos.z + this.vel.z * dt;
    if (!this.collidesAt(this.pos.x, this.pos.y, nextZ, playerH)) {
      if (this.sneaking && wasOnGround && !this.hasGroundSupport(this.pos.x, this.pos.y, nextZ)) {
        this.vel.z = 0;
      } else {
        this.pos.z = nextZ;
      }
    } else {
      this.vel.z = 0;
    }

    // Footstep sound tracking
    const movedHoriz = Math.hypot(this.pos.x - prevX, this.pos.z - prevZ);
    if (this.onGround && !this.inWater && movedHoriz > 0.001) {
      this.stepDistance += movedHoriz;
      if (this.stepDistance >= (this.sneaking ? 2.4 : 1.85)) {
        this.stepDistance = 0;
        const groundBlock = this.world.getBlock(this.pos.x, this.pos.y - 0.2, this.pos.z);
        if (groundBlock !== BLOCK.AIR && this.sound) {
          this.sound.playStep(getDef(groundBlock).sound);
        }
      }
    }
  }

  collidesAt(x, y, z, height) {
    const r = PLAYER_RADIUS;
    const minX = Math.floor(x - r);
    const maxX = Math.floor(x + r);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + height - 1e-4);
    const minZ = Math.floor(z - r);
    const maxZ = Math.floor(z + r);

    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (getDef(this.world.getBlock(bx, by, bz)).solid) {
            return true;
          }
        }
      }
    }
    return false;
  }

  hasGroundSupport(x, y, z) {
    const r = PLAYER_RADIUS * 0.92;
    const minX = Math.floor(x - r);
    const maxX = Math.floor(x + r);
    const checkY = Math.floor(y - 0.08);
    const minZ = Math.floor(z - r);
    const maxZ = Math.floor(z + r);

    for (let bz = minZ; bz <= maxZ; bz++) {
      for (let bx = minX; bx <= maxX; bx++) {
        if (getDef(this.world.getBlock(bx, checkY, bz)).solid) {
          return true;
        }
      }
    }
    return false;
  }

  updateSurvivalStats(dt, gameMode) {
    if (gameMode === GAME_MODES.CREATIVE) {
      this.health = MAX_HEALTH;
      this.air = MAX_AIR;
      return;
    }

    let changed = false;

    // Underwater oxygen bubbles
    if (this.headUnderwater) {
      const prevAir = Math.ceil(this.air);
      this.air = Math.max(0, this.air - dt * 0.75);
      if (Math.ceil(this.air) !== prevAir) changed = true;
      if (this.air <= 0) {
        this.takeDamage(2);
      }
    } else if (this.air < MAX_AIR) {
      const prevAir = Math.ceil(this.air);
      this.air = Math.min(MAX_AIR, this.air + dt * 3.0);
      if (Math.ceil(this.air) !== prevAir) changed = true;
    }

    // Contact hazard checks (Lava / Cactus)
    const feet = this.world.getBlock(this.pos.x, this.pos.y + 0.1, this.pos.z);
    if (feet === BLOCK.LAVA) {
      this.takeDamage(4);
    } else {
      // Check close cactus contact
      const r = PLAYER_RADIUS + 0.05;
      const contacts = [
        this.world.getBlock(this.pos.x + r, this.pos.y + 0.5, this.pos.z),
        this.world.getBlock(this.pos.x - r, this.pos.y + 0.5, this.pos.z),
        this.world.getBlock(this.pos.x, this.pos.y + 0.5, this.pos.z + r),
        this.world.getBlock(this.pos.x, this.pos.y + 0.5, this.pos.z - r),
      ];
      if (contacts.includes(BLOCK.CACTUS)) {
        this.takeDamage(1);
      }
    }

    // Gentle natural health regeneration when safe
    if (this.health > 0 && this.health < MAX_HEALTH) {
      this.regenTimer += dt;
      const interval = gameMode === GAME_MODES.PEACEFUL ? 2.2 : 5.5;
      if (this.regenTimer >= interval) {
        this.regenTimer = 0;
        this.health = Math.min(MAX_HEALTH, this.health + 1);
        changed = true;
      }
    }

    if (changed && typeof this.onStatsChange === 'function') {
      this.onStatsChange();
    }
  }

  updateCamera(dt) {
    if (!this.camera) return;

    const targetEye = this.sneaking ? PLAYER_SNEAK_EYE_HEIGHT : PLAYER_EYE_HEIGHT;
    this.currentEyeH += (targetEye - this.currentEyeH) * Math.min(1, dt * 14.0);

    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    const movingOnGround = this.onGround && !this.flying && horizSpeed > 0.35;
    if (movingOnGround) {
      this.bobPhase += dt * horizSpeed * 2.35;
      this.bobAmount += (1.0 - this.bobAmount) * Math.min(1, dt * 10.0);
    } else {
      this.bobAmount += (0.0 - this.bobAmount) * Math.min(1, dt * 10.0);
    }

    const bobY = Math.sin(this.bobPhase * 2.0) * 0.042 * this.bobAmount;
    const bobX = Math.cos(this.bobPhase) * 0.025 * this.bobAmount;

    this.camera.position.set(this.pos.x + bobX, this.pos.y + this.currentEyeH + bobY, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // Smooth Scout Zoom (C) & Sprint FOV
    const zooming = this.keys.has('KeyC');
    const targetFov = zooming ? 26 : this.sprinting ? 83 : 75;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 12.0);
      this.camera.updateProjectionMatrix();
    }

    // Animate 3D held viewmodel
    if (this.handPivot) {
      if (this.swingAnim > 0) {
        this.swingAnim = Math.max(0, this.swingAnim - dt * 4.5);
      }
      const swingSin = Math.sin(this.swingAnim * Math.PI);
      this.handPivot.position.set(
        0.42 - swingSin * 0.14 + bobX * 0.6,
        -0.36 + swingSin * 0.08 + bobY * 0.7,
        -0.62 - swingSin * 0.16
      );
      this.handPivot.rotation.set(-swingSin * 0.85, swingSin * 0.35, swingSin * 0.25);
    }
  }

  updateInteractions(dt, gameMode) {
    const origin = this.getEyePosition();
    const dir = this.getLookDirection();
    const isCreative = gameMode === GAME_MODES.CREATIVE;

    this.targetHit = this.world.raycast(origin, dir, REACH_DISTANCE);

    if (this.selectionBox) {
      if (this.targetHit) {
        this.selectionBox.visible = true;
        this.selectionBox.position.set(
          this.targetHit.x + 0.5,
          this.targetHit.y + 0.5,
          this.targetHit.z + 0.5
        );
      } else {
        this.selectionBox.visible = false;
      }
    }

    // Left-click: Attack Mob first if in melee reach, otherwise Mine Block
    if (this.mouseDownLeft) {
      const hitMob = this.entities ? this.entities.raycastMob(origin, dir, 4.0) : null;
      if (hitMob && (!this.targetHit || this.targetHit.dist > 3.2)) {
        if (this.attackCooldown <= 0) {
          this.attackCooldown = 0.38;
          this.triggerSwing();
          const sel = this.inventory.getSelected();
          const dmg = sel ? (getDef(sel.id).damage || 1) : 2;
          if (this.sound) this.sound.playSwing();
          this.entities.hitMob(hitMob, dmg, dir.x, dir.z);
          if (sel) this.inventory.damageSelectedTool(1, isCreative);
        }
        this.resetMining();
      } else if (this.targetHit) {
        this.processMining(dt, this.targetHit, isCreative);
      } else {
        if (this.swingAnim <= 0 && this.attackCooldown <= 0) {
          this.attackCooldown = 0.35;
          this.triggerSwing();
          if (this.sound) this.sound.playSwing();
        }
        this.resetMining();
      }
    } else {
      this.resetMining();
    }

    // Right-click: Use Station / Eat Food / Scoop or Place Water / Place Block
    if (this.mouseDownRight && this.placeCooldown <= 0) {
      this.performRightClick(origin, dir, isCreative);
    }
  }

  processMining(dt, hit, isCreative) {
    const def = hit.def;
    if (def.unbreakable && !isCreative) {
      this.resetMining();
      return;
    }

    if (isCreative) {
      if (this.breakCooldown <= 0) {
        this.breakCooldown = 0.16;
        this.completeBreakBlock(hit, true);
      }
      return;
    }

    const key = `${hit.x},${hit.y},${hit.z}`;
    if (this.miningKey !== key) {
      this.miningKey = key;
      this.miningProgress = 0;
      this.digTick = 0;
    }

    const sel = this.inventory.getSelected();
    const heldDef = sel ? getDef(sel.id) : null;

    let speedMult = 1.0;
    if (heldDef && heldDef.toolType) {
      if (def.tool && heldDef.toolType === def.tool) {
        speedMult = heldDef.speed;
      } else if (heldDef.toolType === 'sword' && def.renderType === 'cross') {
        speedMult = 3.0;
      }
    }

    // Penalty if mining hard stone/ore without required pickaxe tier
    const hasRequiredTier =
      def.minTier === 0 ||
      (heldDef && heldDef.toolType === def.tool && heldDef.tier >= def.minTier);

    const effectiveTime = Math.max(0.06, (def.hardness / speedMult) * (hasRequiredTier ? 0.85 : 2.6));
    this.miningProgress += dt / effectiveTime;

    this.digTick += dt;
    if (this.digTick >= 0.21) {
      this.digTick = 0;
      this.triggerSwing();
      if (this.sound) this.sound.playDig(def.sound);
      if (this.particles) {
        this.particles.emitBlockChip(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, hit.id);
      }
    }

    if (this.crackMesh) {
      this.crackMesh.visible = true;
      this.crackMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      const stage = Math.min(5, Math.floor(this.miningProgress * 6));
      this.setCrackStage(stage);
    }

    if (this.miningProgress >= 1.0) {
      this.completeBreakBlock(hit, false, hasRequiredTier);
    }
  }

  completeBreakBlock(hit, isCreative, canHarvest = true) {
    const { x, y, z, id, def } = hit;
    this.triggerSwing();
    if (this.particles) this.particles.emitBlockBreak(x, y, z, id, 22);
    if (this.sound) this.sound.playBreak(def.sound);

    this.world.setBlock(x, y, z, BLOCK.AIR, true);

    if (!isCreative && this.entities) {
      if (canHarvest && def.drop) {
        this.entities.spawnDrop(x + 0.5, y + 0.35, z + 0.5, def.drop, def.dropCount || 1);
      }
      // Bonus natural drops from Oak/Birch/Spruce leaves (Apples & Sticks!)
      if (id === BLOCK.OAK_LEAVES || id === BLOCK.BIRCH_LEAVES || id === BLOCK.SPRUCE_LEAVES) {
        const r = Math.random();
        if (r < 0.14 && id === BLOCK.OAK_LEAVES) {
          this.entities.spawnDrop(x + 0.5, y + 0.35, z + 0.5, ITEM.APPLE, 1);
        } else if (r < 0.28) {
          this.entities.spawnDrop(x + 0.5, y + 0.35, z + 0.5, ITEM.STICK, 1);
        }
      }
      this.inventory.damageSelectedTool(1, false);
    }

    this.resetMining();
  }

  resetMining() {
    this.miningKey = null;
    this.miningProgress = 0;
    if (this.crackMesh) this.crackMesh.visible = false;
  }

  performRightClick(origin, dir, isCreative) {
    // 1. Check interactive station (Crafting Table / Furnace) unless sneaking
    if (this.targetHit && this.targetHit.def.interactive && !this.sneaking) {
      this.placeCooldown = 0.3;
      this.mouseDownRight = false;
      if (typeof this.onOpenStation === 'function') {
        this.onOpenStation(this.targetHit.def.interactive);
      }
      return;
    }

    const sel = this.inventory.getSelected();
    if (!sel) return;
    const itemDef = getDef(sel.id);

    // 2. Eat food if holding edible item
    if (itemDef.heal > 0) {
      if (this.health < MAX_HEALTH || isCreative) {
        this.placeCooldown = 0.42;
        this.triggerSwing();
        this.health = Math.min(MAX_HEALTH, this.health + itemDef.heal);
        this.inventory.consumeSelected(1, isCreative);
        if (this.sound) this.sound.playEat();
        if (typeof this.onStatsChange === 'function') this.onStatsChange();
      }
      return;
    }

    // 3. Bucket scoop / pour water
    if (sel.id === ITEM.EMPTY_BUCKET) {
      const waterHit = this.world.raycast(origin, dir, REACH_DISTANCE, { includeWater: true });
      if (waterHit && waterHit.id === BLOCK.WATER) {
        this.placeCooldown = 0.3;
        this.triggerSwing();
        this.world.setBlock(waterHit.x, waterHit.y, waterHit.z, BLOCK.AIR, true);
        if (!isCreative) {
          this.inventory.slots[this.inventory.selectedSlot] = this.inventory.makeStack(ITEM.WATER_BUCKET, 1);
          this.inventory.notify();
        }
        if (this.sound) this.sound.playSplash();
      }
      return;
    }

    if (sel.id === ITEM.WATER_BUCKET && this.targetHit) {
      const { placeX, placeY, placeZ } = this.targetHit;
      this.placeCooldown = 0.3;
      this.triggerSwing();
      if (this.world.setBlock(placeX, placeY, placeZ, BLOCK.WATER, true)) {
        if (!isCreative) {
          this.inventory.slots[this.inventory.selectedSlot] = this.inventory.makeStack(ITEM.EMPTY_BUCKET, 1);
          this.inventory.notify();
        }
        if (this.sound) this.sound.playSplash();
      }
      return;
    }

    // 4. Place Block
    if (!itemDef.isBlock || !this.targetHit) return;

    // If targeting replaceable tall grass, replace directly; otherwise place against hit face
    const replaceInPlace = this.targetHit.def.replaceable;
    const px = replaceInPlace ? this.targetHit.x : this.targetHit.placeX;
    const py = replaceInPlace ? this.targetHit.y : this.targetHit.placeY;
    const pz = replaceInPlace ? this.targetHit.z : this.targetHit.placeZ;

    if (py <= 0 || py >= 95) return;

    const existing = getDef(this.world.getBlock(px, py, pz));
    if (!existing.replaceable && this.world.getBlock(px, py, pz) !== BLOCK.AIR) return;

    // Prevent placing solid block overlapping player's own AABB
    if (itemDef.solid) {
      const h = this.sneaking ? PLAYER_SNEAK_HEIGHT : PLAYER_HEIGHT;
      const pMinX = this.pos.x - PLAYER_RADIUS + 0.01;
      const pMaxX = this.pos.x + PLAYER_RADIUS - 0.01;
      const pMinY = this.pos.y + 0.01;
      const pMaxY = this.pos.y + h - 0.01;
      const pMinZ = this.pos.z - PLAYER_RADIUS + 0.01;
      const pMaxZ = this.pos.z + PLAYER_RADIUS - 0.01;

      const overlaps =
        pMaxX > px &&
        pMinX < px + 1 &&
        pMaxY > py &&
        pMinY < py + 1 &&
        pMaxZ > pz &&
        pMinZ < pz + 1;
      if (overlaps) return;
    }

    if (this.world.setBlock(px, py, pz, sel.id, true)) {
      this.placeCooldown = 0.2;
      this.triggerSwing();
      this.inventory.consumeSelected(1, isCreative);
      if (this.sound) this.sound.playPlace(itemDef.sound);
    }
  }

  getHeldLightStrength() {
    const sel = this.inventory.getSelected();
    if (!sel) return 0;
    const def = getDef(sel.id);
    return def.light ? def.light / 15.0 : 0;
  }

  serialize() {
    return {
      x: this.pos.x,
      y: this.pos.y,
      z: this.pos.z,
      yaw: this.yaw,
      pitch: this.pitch,
      health: this.health,
      air: this.air,
      flying: this.flying,
      homePos: this.homePos || null,
    };
  }

  deserialize(data) {
    if (!data) return;
    this.pos.set(Number(data.x) || 0.5, Number(data.y) || 50, Number(data.z) || 0.5);
    this.yaw = Number(data.yaw) || 0;
    this.pitch = Number(data.pitch) || 0;
    this.health = data.health !== undefined ? data.health : MAX_HEALTH;
    this.air = data.air !== undefined ? data.air : MAX_AIR;
    this.flying = Boolean(data.flying);
    this.homePos = data.homePos || null;
    this.highestAirY = this.pos.y;
  }
}
