// First-Person Controller, Sub-Stepped AABB Physics, Viewmodel, Mining, Placement & Survival Stats

import * as THREE from 'three';
import {
  FLY_SPEED,
  FLY_SPRINT_SPEED,
  GAME_MODES,
  GRAVITY,
  JUMP_VELOCITY,
  PLAYER_EYE_HEIGHT,
  PLAYER_HALF_W,
  PLAYER_HEIGHT,
  PLAYER_SNEAK_EYE_HEIGHT,
  REACH_CREATIVE,
  REACH_SURVIVAL,
  SNEAK_SPEED,
  SPRINT_SPEED,
  SWIM_SPEED,
  WALK_SPEED,
  WATER_GRAVITY,
  WORLD_HEIGHT,
} from '../constants.js';
import { BLOCK, BLOCK_DEFS, getBlockDef, isBlockSolid } from '../game/blocks.js';
import { getItemDef } from '../game/items.js';
import { raycastVoxel } from '../math/raycast.js';

export class PlayerController {
  constructor({
    camera,
    scene,
    chunkManager,
    inventory,
    textureManager,
    particles,
    drops,
    mobs,
    sound,
    callbacks = {},
  }) {
    this.camera = camera;
    this.scene = scene;
    this.chunkManager = chunkManager;
    this.inventory = inventory;
    this.textureManager = textureManager;
    this.particles = particles;
    this.drops = drops;
    this.mobs = mobs;
    this.sound = sound;
    this.callbacks = callbacks;

    this.position = new THREE.Vector3(8.5, 48, 8.5);
    this.spawnPoint = new THREE.Vector3(8.5, 48, 8.5);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.12;

    this.mode = GAME_MODES.SURVIVAL;
    this.flying = false;
    this.onGround = false;
    this.inWater = false;
    this.headUnderWater = false;

    this.maxHealth = 20;
    this.health = 20;
    this.maxHunger = 20;
    this.hunger = 20;
    this.hurtFlash = 0;
    this.invulnerableTimer = 0;
    this.highestAirY = null;
    this.regenTimer = 0;
    this.hungerTimer = 0;

    // Input state
    this.keys = new Set();
    this.mouseButtons = { left: false, right: false };
    this.lastSpaceTap = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.placeCooldown = 0;
    this.attackCooldown = 0;

    // Mining state
    this.targetHit = null;
    this.miningKey = null;
    this.miningProgress = 0;
    this.chipSoundTimer = 0;

    // Walk bob & swing animation
    this.bobPhase = 0;
    this.bobAmount = 0;
    this.swingProgress = 0;
    this.stepDistance = 0;

    // Looted ruin chests set ("x,y,z")
    this.openedChests = new Set();

    this.initSelectionVisuals();
    this.initHandViewmodel();
    this.inventory.onChange(() => this.refreshHeldMesh());
  }

  initSelectionVisuals() {
    // Crisp wireframe highlight around targeted voxel
    const boxGeo = new THREE.BoxGeometry(1.008, 1.008, 1.008);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x11161d,
      transparent: true,
      opacity: 0.72,
    });
    this.highlightBox = new THREE.LineSegments(edges, lineMat);
    this.highlightBox.visible = false;
    this.scene.add(this.highlightBox);

    // Mining crack decal quad on targeted block face
    const crackGeo = new THREE.PlaneGeometry(1.004, 1.004);
    this.crackMat = new THREE.MeshBasicMaterial({
      map: this.textureManager.crackTextures[0],
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.crackMesh = new THREE.Mesh(crackGeo, this.crackMat);
    this.crackMesh.visible = false;
    this.scene.add(this.crackMesh);
  }

  initHandViewmodel() {
    this.handPivot = new THREE.Group();
    this.camera.add(this.handPivot);
    if (!this.camera.parent) {
      this.scene.add(this.camera);
    }

    this.heldContainer = new THREE.Group();
    this.handPivot.add(this.heldContainer);
    this.refreshHeldMesh();
  }

  refreshHeldMesh() {
    while (this.heldContainer.children.length > 0) {
      const child = this.heldContainer.children[0];
      this.heldContainer.remove(child);
    }

    const held = this.inventory.getHeldDef();
    if (!held) {
      // Clean warm voxel forearm viewmodel when empty-handed
      const skinMat = new THREE.MeshLambertMaterial({ color: 0xe3b08e, depthTest: false });
      const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x3b78b8, depthTest: false });
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.56), skinMat);
      arm.position.set(0.42, -0.36, -0.58);
      arm.rotation.set(0.32, -0.35, -0.18);
      arm.renderOrder = 999;

      const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.195, 0.195, 0.22), sleeveMat);
      cuff.position.set(0, 0, 0.22);
      cuff.renderOrder = 999;
      arm.add(cuff);

      this.heldContainer.add(arm);
      return;
    }

    if (
      held.blockId !== undefined &&
      BLOCK_DEFS[held.blockId]?.renderType === 'cube'
    ) {
      const b = BLOCK_DEFS[held.blockId];
      // Build 6-material mini voxel block matching exact top/side/front faces!
      const mats = [0, 1, 2, 3, 4, 5].map((faceIdx) => {
        const tile = this.textureManager.tileCanvases.get(b.faces[faceIdx]);
        const tex = new THREE.CanvasTexture(tile);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        return new THREE.MeshLambertMaterial({
          map: tex,
          alphaTest: 0.4,
          depthTest: false,
        });
      });
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.30, 0.30), mats);
      cube.position.set(0.44, -0.34, -0.66);
      cube.rotation.set(0.24, 0.68, -0.10);
      cube.renderOrder = 999;
      this.heldContainer.add(cube);
      return;
    }

    // Crisp tool / torch / item sprite held in hand
    const url = this.textureManager.getItemIconUrl(held.id);
    const img = new Image();
    img.src = url;
    const tex = new THREE.Texture(img);
    img.onload = () => {
      tex.needsUpdate = true;
    };
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.42),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.3,
        side: THREE.DoubleSide,
        depthTest: false,
      })
    );
    plane.position.set(0.44, -0.32, -0.65);
    plane.rotation.set(0.08, -0.45, -0.12);
    plane.renderOrder = 999;
    this.heldContainer.add(plane);
  }

  triggerSwing() {
    if (this.swingProgress <= 0.15) {
      this.swingProgress = 1.0;
    }
  }

  setGameMode(mode) {
    this.mode = mode === GAME_MODES.CREATIVE ? GAME_MODES.CREATIVE : GAME_MODES.SURVIVAL;
    if (this.mode === GAME_MODES.SURVIVAL) {
      this.flying = false;
    }
    if (this.callbacks.onModeChange) this.callbacks.onModeChange(this.mode, this.flying);
  }

  toggleFlight() {
    this.flying = !this.flying;
    this.velocity.y = 0;
    this.highestAirY = null;
    if (this.callbacks.onModeChange) this.callbacks.onModeChange(this.mode, this.flying);
  }

  onKeyDown(code) {
    this.keys.add(code);
    if (code === 'Space') {
      this.jumpBufferTimer = 0.12;
      const now = performance.now();
      if (now - this.lastSpaceTap < 280 && this.mode === GAME_MODES.CREATIVE) {
        this.toggleFlight();
        this.lastSpaceTap = 0;
      } else {
        this.lastSpaceTap = now;
      }
    } else if (code === 'KeyF') {
      // Friendly flight toggle anytime so players can inspect builds & vistas effortlessly
      this.toggleFlight();
    } else if (code === 'KeyQ') {
      this.dropSelectedStackItem();
    }
  }

  onKeyUp(code) {
    this.keys.delete(code);
  }

  dropSelectedStackItem() {
    const stack = this.inventory.getHeldStack();
    if (!stack) return;
    const itemId = stack.id;
    this.inventory.consumeSelected(1);
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.drops.spawnDrop(
      this.position.x + dir.x * 0.6,
      this.position.y + PLAYER_EYE_HEIGHT - 0.25,
      this.position.z + dir.z * 0.6,
      itemId,
      1,
      1.35,
      { x: dir.x * 5.2, y: dir.y * 4.0 + 1.8, z: dir.z * 5.2 }
    );
    this.triggerSwing();
  }

  takeDamage(amount, knockX = 0, knockZ = 0) {
    if (this.mode === GAME_MODES.CREATIVE || this.invulnerableTimer > 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtFlash = 0.35;
    this.invulnerableTimer = 0.5;
    this.velocity.y = 4.2;
    this.velocity.x -= knockX * 5.5;
    this.velocity.z -= knockZ * 5.5;
    this.sound.playHit(true);

    if (this.health <= 0) {
      this.respawn();
    }
    if (this.callbacks.onStatsChange) this.callbacks.onStatsChange();
  }

  respawn() {
    const surf = this.chunkManager.findSurfaceY(this.spawnPoint.x, this.spawnPoint.z);
    this.position.set(this.spawnPoint.x, surf.y + 0.1, this.spawnPoint.z);
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this.highestAirY = null;
    if (this.callbacks.onToast) {
      this.callbacks.onToast('Respawned at World Spawn');
    }
  }

  onMouseMove(movementX, movementY, sensitivity = 0.0022) {
    this.yaw -= movementX * sensitivity;
    this.pitch -= movementY * sensitivity;
    const limit = Math.PI * 0.495;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }

  update(dt, controlsActive = true) {
    // Clamp large tab-switch dt spikes safely while sub-stepping at 120Hz
    const frameDt = Math.min(0.1, dt);

    if (!controlsActive) {
      this.keys.clear();
      this.mouseButtons.left = false;
      this.mouseButtons.right = false;
    }

    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - frameDt);
    this.hurtFlash = Math.max(0, this.hurtFlash - frameDt * 1.8);
    this.placeCooldown = Math.max(0, this.placeCooldown - frameDt);
    this.attackCooldown = Math.max(0, this.attackCooldown - frameDt);
    this.coyoteTimer = Math.max(0, this.coyoteTimer - frameDt);
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - frameDt);

    // Sub-step physics at >= 120Hz equivalent accuracy to guarantee zero tunneling!
    const steps = Math.max(1, Math.ceil(frameDt / (1 / 120)));
    const subDt = frameDt / steps;
    for (let s = 0; s < steps; s++) {
      this.stepPhysics(subDt);
    }

    // Update camera transform & view bobbing
    const sneaking = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const targetEye = sneaking && !this.flying ? PLAYER_SNEAK_EYE_HEIGHT : PLAYER_EYE_HEIGHT;
    this.currentEye = THREE.MathUtils.lerp(this.currentEye ?? PLAYER_EYE_HEIGHT, targetEye, Math.min(1, frameDt * 14));

    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.onGround && !this.flying && horizSpeed > 0.35) {
      this.bobPhase += frameDt * horizSpeed * 2.15;
      this.bobAmount = THREE.MathUtils.lerp(this.bobAmount, 1.0, Math.min(1, frameDt * 10));
      this.stepDistance += horizSpeed * frameDt;
      if (this.stepDistance > 2.05) {
        this.stepDistance = 0;
        const groundId = this.chunkManager.getBlock(this.position.x, this.position.y - 0.2, this.position.z);
        this.sound.playFootstep(getBlockDef(groundId).sound || 'grass');
      }
    } else {
      this.bobAmount = THREE.MathUtils.lerp(this.bobAmount, 0.0, Math.min(1, frameDt * 10));
    }

    const bobY = Math.sin(this.bobPhase * 2.0) * 0.042 * this.bobAmount;
    const bobX = Math.cos(this.bobPhase) * 0.028 * this.bobAmount;

    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.position.set(
      this.position.x + Math.cos(this.yaw) * bobX,
      this.position.y + this.currentEye + bobY,
      this.position.z - Math.sin(this.yaw) * bobX
    );

    // Subtle dynamic FOV boost when sprinting/flying fast
    const sprinting = (this.keys.has('ControlLeft') || this.keys.has('KeyR')) && horizSpeed > 3.5;
    const targetFov = sprinting ? 80 : 74;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, frameDt * 9));
      this.camera.updateProjectionMatrix();
    }

    // Animate hand swing & walk sway
    if (this.swingProgress > 0) {
      this.swingProgress = Math.max(0, this.swingProgress - frameDt * 4.6);
    }
    const swingSin = Math.sin(this.swingProgress * Math.PI);
    this.handPivot.position.set(
      Math.cos(this.bobPhase) * 0.018 * this.bobAmount - swingSin * 0.10,
      Math.abs(Math.sin(this.bobPhase)) * -0.02 * this.bobAmount - swingSin * 0.08,
      -swingSin * 0.12
    );
    this.handPivot.rotation.set(-swingSin * 0.65, swingSin * 0.35, swingSin * 0.25);

    // Survival hunger & gentle health regeneration
    this.updateSurvivalStats(frameDt, horizSpeed);

    // Raycast voxel selection, mining, combat & placement
    this.updateRaycastAndActions(frameDt, controlsActive);
  }

  stepPhysics(dt) {
    let moveForward = 0;
    let moveRight = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveForward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveForward -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveRight += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveRight -= 1;

    const len = Math.hypot(moveForward, moveRight);
    if (len > 1) {
      moveForward /= len;
      moveRight /= len;
    }

    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);
    // Forward in Three.js -Z camera space is (-sinYaw, 0, -cosYaw); Right is (cosYaw, 0, -sinYaw)
    const wishX = -sinYaw * moveForward + cosYaw * moveRight;
    const wishZ = -cosYaw * moveForward - sinYaw * moveRight;

    const sneaking = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const sprinting = this.keys.has('ControlLeft') || this.keys.has('KeyR');

    // Check water immersion
    const feetBlock = this.chunkManager.getBlock(this.position.x, this.position.y + 0.15, this.position.z);
    const bodyBlock = this.chunkManager.getBlock(this.position.x, this.position.y + 0.9, this.position.z);
    const eyeBlock = this.chunkManager.getBlock(this.position.x, this.position.y + PLAYER_EYE_HEIGHT, this.position.z);

    const wasInWater = this.inWater;
    this.inWater = feetBlock === BLOCK.WATER || bodyBlock === BLOCK.WATER;
    this.headUnderWater = eyeBlock === BLOCK.WATER;

    if (this.inWater && !wasInWater && this.velocity.y < -4) {
      this.sound.playBlockSound('water', true);
      this.particles.emitSplash(this.position.x, this.position.y + 0.4, this.position.z, 14);
      this.highestAirY = null;
    }

    // Cactus prick check in survival
    if (this.mode === GAME_MODES.SURVIVAL) {
      const nearCactus =
        this.chunkManager.getBlock(this.position.x + 0.34, this.position.y + 0.5, this.position.z) === BLOCK.CACTUS ||
        this.chunkManager.getBlock(this.position.x - 0.34, this.position.y + 0.5, this.position.z) === BLOCK.CACTUS ||
        this.chunkManager.getBlock(this.position.x, this.position.y + 0.5, this.position.z + 0.34) === BLOCK.CACTUS ||
        this.chunkManager.getBlock(this.position.x, this.position.y + 0.5, this.position.z - 0.34) === BLOCK.CACTUS;
      if (nearCactus) {
        this.takeDamage(1, 0, 0);
      }
    }

    if (this.flying) {
      const speed = sprinting ? FLY_SPRINT_SPEED : FLY_SPEED;
      const accel = Math.min(1, dt * 12);
      this.velocity.x += (wishX * speed - this.velocity.x) * accel;
      this.velocity.z += (wishZ * speed - this.velocity.z) * accel;

      let flyY = 0;
      if (this.keys.has('Space')) flyY += 1;
      if (sneaking || this.keys.has('KeyC')) flyY -= 1;
      this.velocity.y += (flyY * speed * 0.82 - this.velocity.y) * accel;
    } else if (this.inWater) {
      const accel = Math.min(1, dt * 9);
      this.velocity.x += (wishX * SWIM_SPEED - this.velocity.x) * accel;
      this.velocity.z += (wishZ * SWIM_SPEED - this.velocity.z) * accel;
      this.velocity.y -= WATER_GRAVITY * dt;
      this.velocity.y *= Math.max(0, 1 - dt * 3.5);
      if (this.keys.has('Space')) {
        this.velocity.y = Math.min(4.4, this.velocity.y + 20 * dt);
      } else if (sneaking) {
        this.velocity.y = Math.max(-4.2, this.velocity.y - 14 * dt);
      }
      this.highestAirY = null;
    } else {
      const targetSpeed = sneaking ? SNEAK_SPEED : sprinting ? SPRINT_SPEED : WALK_SPEED;
      const control = this.onGround ? 15.0 : 6.5;
      const accel = Math.min(1, dt * control);
      this.velocity.x += (wishX * targetSpeed - this.velocity.x) * accel;
      this.velocity.z += (wishZ * targetSpeed - this.velocity.z) * accel;
      this.velocity.y -= GRAVITY * dt;

      if (this.onGround) {
        this.coyoteTimer = 0.1;
      }

      const wantsJump = this.keys.has('Space') || this.jumpBufferTimer > 0;
      if (wantsJump && this.coyoteTimer > 0) {
        this.velocity.y = JUMP_VELOCITY;
        this.onGround = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
      }
    }

    // Clamp terminal velocity
    this.velocity.y = Math.max(-48, Math.min(48, this.velocity.y));

    // Resolve X (with sneak edge-fall protection when grounded!)
    const nextX = this.position.x + this.velocity.x * dt;
    if (!this.collidesAABB(nextX, this.position.y, this.position.z)) {
      if (sneaking && this.onGround && !this.flying && !this.hasGroundSupport(nextX, this.position.y, this.position.z)) {
        this.velocity.x = 0;
      } else {
        this.position.x = nextX;
      }
    } else {
      this.velocity.x = 0;
    }

    // Resolve Z (with sneak edge-fall protection!)
    const nextZ = this.position.z + this.velocity.z * dt;
    if (!this.collidesAABB(this.position.x, this.position.y, nextZ)) {
      if (sneaking && this.onGround && !this.flying && !this.hasGroundSupport(this.position.x, this.position.y, nextZ)) {
        this.velocity.z = 0;
      } else {
        this.position.z = nextZ;
      }
    } else {
      this.velocity.z = 0;
    }

    // Resolve Y & track fall damage cleanly
    const nextY = this.position.y + this.velocity.y * dt;
    if (!this.collidesAABB(this.position.x, nextY, this.position.z)) {
      this.position.y = nextY;
      this.onGround = false;
      if (!this.flying && !this.inWater) {
        this.highestAirY =
          this.highestAirY === null ? this.position.y : Math.max(this.highestAirY, this.position.y);
      }
    } else {
      if (this.velocity.y < 0) {
        this.position.y = Math.floor(nextY) + 1.0002;
        this.onGround = true;

        if (!this.flying && !this.inWater && this.highestAirY !== null) {
          const fallDist = this.highestAirY - this.position.y;
          if (fallDist > 3.7 && this.mode === GAME_MODES.SURVIVAL) {
            const dmg = Math.max(1, Math.floor(fallDist - 3.2));
            this.takeDamage(dmg, 0, 0);
          }
        }
        this.highestAirY = null;
        // Landing on solid ground optionally exits Creative flight smoothly if descending onto floor
      } else if (this.velocity.y > 0) {
        this.velocity.y = 0;
      }
      this.velocity.y = 0;
    }

    // Safety net against falling below bedrock
    if (this.position.y < -6) {
      this.position.y = WORLD_HEIGHT - 4;
      this.velocity.y = 0;
    }
  }

  collidesAABB(px, py, pz) {
    const minX = Math.floor(px - PLAYER_HALF_W);
    const maxX = Math.floor(px + PLAYER_HALF_W);
    const minY = Math.floor(py);
    const maxY = Math.floor(py + PLAYER_HEIGHT - 0.001);
    const minZ = Math.floor(pz - PLAYER_HALF_W);
    const maxZ = Math.floor(pz + PLAYER_HALF_W);

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (isBlockSolid(this.chunkManager.getBlock(x, y, z))) {
            return true;
          }
        }
      }
    }
    return false;
  }

  hasGroundSupport(px, py, pz) {
    const checkY = Math.floor(py - 0.12);
    const minX = Math.floor(px - PLAYER_HALF_W + 0.02);
    const maxX = Math.floor(px + PLAYER_HALF_W - 0.02);
    const minZ = Math.floor(pz - PLAYER_HALF_W + 0.02);
    const maxZ = Math.floor(pz + PLAYER_HALF_W - 0.02);

    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        if (isBlockSolid(this.chunkManager.getBlock(x, checkY, z))) {
          return true;
        }
      }
    }
    return false;
  }

  updateSurvivalStats(dt, horizSpeed) {
    if (this.mode !== GAME_MODES.SURVIVAL) return;

    this.hungerTimer += dt * (horizSpeed > 4.8 ? 1.8 : horizSpeed > 0.5 ? 0.65 : 0.12);
    if (this.hungerTimer >= 26) {
      this.hungerTimer = 0;
      if (this.hunger > 1) {
        this.hunger = Math.max(1, this.hunger - 1);
        if (this.callbacks.onStatsChange) this.callbacks.onStatsChange();
      }
    }

    // Regenerate health when well-fed!
    if (this.health < this.maxHealth && this.hunger >= 14) {
      this.regenTimer += dt;
      if (this.regenTimer >= 3.2) {
        this.regenTimer = 0;
        this.health = Math.min(this.maxHealth, this.health + 1);
        if (this.callbacks.onStatsChange) this.callbacks.onStatsChange();
      }
    }
  }

  updateRaycastAndActions(dt, controlsActive) {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const reach = this.mode === GAME_MODES.CREATIVE ? REACH_CREATIVE : REACH_SURVIVAL;

    this.targetHit = raycastVoxel(
      (x, y, z) => this.chunkManager.getBlock(x, y, z),
      this.camera.position,
      dir,
      reach,
      (id) => Boolean(BLOCK_DEFS[id]?.targetable)
    );

    if (this.targetHit) {
      this.highlightBox.visible = true;
      this.highlightBox.position.set(
        this.targetHit.x + 0.5,
        this.targetHit.y + 0.5,
        this.targetHit.z + 0.5
      );
      const sunBrightness = this.chunkManager.materials.sharedUniforms.uSunLight.value.r;
      const darkEnv = sunBrightness < 0.42 || this.position.y < 32;
      this.highlightBox.material.color.setHex(darkEnv ? 0xddeeff : 0x121822);
      this.highlightBox.material.opacity = darkEnv ? 0.52 : 0.72;
    } else {
      this.highlightBox.visible = false;
      this.crackMesh.visible = false;
      this.miningProgress = 0;
      this.miningKey = null;
    }

    if (!controlsActive) return;

    // Left Mouse Button: Combat hit check first, then block mining
    if (this.mouseButtons.left) {
      const hitMob = this.mobs.raycastMob(this.camera.position, dir, 4.5);
      if (hitMob && (!this.targetHit || this.targetHit.distance > 2.2)) {
        if (this.attackCooldown <= 0) {
          this.attackCooldown = 0.42;
          this.triggerSwing();
          const held = this.inventory.getHeldDef();
          const attackPower = held?.attack || 2;
          this.mobs.damageMob(hitMob, attackPower, dir.x, dir.z);
          if (this.mode === GAME_MODES.SURVIVAL) {
            this.inventory.damageSelectedTool(1);
          }
        }
        this.crackMesh.visible = false;
        this.miningProgress = 0;
      } else if (this.targetHit) {
        this.processMining(dt);
      } else if (this.attackCooldown <= 0) {
        this.attackCooldown = 0.35;
        this.triggerSwing();
        this.sound.playSwing();
      }
    } else {
      this.miningProgress = 0;
      this.miningKey = null;
      this.crackMesh.visible = false;
    }

    // Right Mouse Button: Interact / Eat / Bucket / Place Block
    if (this.mouseButtons.right && this.placeCooldown <= 0) {
      this.placeCooldown = 0.21;
      this.handleRightClickAction(dir);
    }
  }

  getMiningSpeedFor(blockDef) {
    if (this.mode === GAME_MODES.CREATIVE) return 999;
    const held = this.inventory.getHeldDef();
    if (!held || !held.toolType) return 1.0;
    if (held.toolType === blockDef.tool) {
      return held.speed || 2.0;
    }
    return 1.1;
  }

  canHarvestDrop(blockDef) {
    if (!blockDef.minTier || blockDef.minTier <= 0) return true;
    const held = this.inventory.getHeldDef();
    if (!held || held.toolType !== blockDef.tool) return false;
    return (held.tier || 0) >= blockDef.minTier;
  }

  processMining(dt) {
    const hit = this.targetHit;
    const def = getBlockDef(hit.blockId);
    const key = `${hit.x},${hit.y},${hit.z},${hit.blockId}`;

    if (this.mode === GAME_MODES.CREATIVE) {
      this.breakBlockAt(hit, def, false);
      this.placeCooldown = 0.16;
      this.mouseButtons.left = false; // Crisp single-block break per click or rapid tap in Creative
      return;
    }

    if (!Number.isFinite(def.hardness)) {
      this.crackMesh.visible = false;
      return;
    }

    if (this.miningKey !== key) {
      this.miningKey = key;
      this.miningProgress = 0;
    }

    this.triggerSwing();

    const speed = this.getMiningSpeedFor(def);
    const penalty = this.canHarvestDrop(def) ? 1.0 : 0.35;
    const breakDuration = Math.max(0.06, (def.hardness * 1.15) / (speed * penalty));

    this.miningProgress += dt / breakDuration;
    this.chipSoundTimer -= dt;
    if (this.chipSoundTimer <= 0) {
      this.chipSoundTimer = 0.22;
      this.sound.playBlockSound(def.sound || 'stone', false);
      this.particles.emitBlockChip(hit.x, hit.y, hit.z, hit.normal, def.particleColor);
    }

    // Position crack overlay flush on hit face
    const stage = Math.min(5, Math.floor(this.miningProgress * 6));
    this.crackMat.map = this.textureManager.crackTextures[stage];
    this.crackMat.needsUpdate = true;
    this.crackMesh.visible = def.renderType === 'cube';
    this.crackMesh.position.set(
      hit.x + 0.5 + hit.normal.x * 0.504,
      hit.y + 0.5 + hit.normal.y * 0.504,
      hit.z + 0.5 + hit.normal.z * 0.504
    );
    this.crackMesh.lookAt(
      this.crackMesh.position.x + hit.normal.x,
      this.crackMesh.position.y + hit.normal.y,
      this.crackMesh.position.z + hit.normal.z
    );

    if (this.miningProgress >= 1.0) {
      this.breakBlockAt(hit, def, true);
      this.miningProgress = 0;
      this.miningKey = null;
      this.crackMesh.visible = false;
    }
  }

  breakBlockAt(hit, def, spawnDrops = true) {
    this.triggerSwing();
    this.sound.playBlockSound(def.sound || 'stone', true);
    this.particles.emitBlockBreak(hit.x, hit.y, hit.z, def.particleColor, 20);
    this.chunkManager.setBlock(hit.x, hit.y, hit.z, BLOCK.AIR, true);

    if (spawnDrops) {
      if (this.canHarvestDrop(def) && def.drop) {
        const passChance = def.dropChance === undefined || Math.random() < def.dropChance;
        if (passChance) {
          this.drops.spawnDrop(hit.x + 0.5, hit.y + 0.35, hit.z + 0.5, def.drop, 1);
        }
      }
      if (def.bonusDrop && Math.random() < def.bonusDrop.chance) {
        this.drops.spawnDrop(hit.x + 0.5, hit.y + 0.35, hit.z + 0.5, def.bonusDrop.item, 1);
      }

      const res = this.inventory.damageSelectedTool(1);
      if (res.broke && this.callbacks.onToast) {
        this.callbacks.onToast(`Your ${res.name} wore out!`);
      }
    }

    if (this.callbacks.onBlockBroken) {
      this.callbacks.onBlockBroken(hit.blockId);
    }
  }

  handleRightClickAction(dir) {
    const sneaking = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    // 1. Interactive world blocks (Crafting Table, Furnace, Ruin Treasure Chest!)
    if (this.targetHit && !sneaking) {
      const targetDef = getBlockDef(this.targetHit.blockId);
      if (targetDef.interactive === 'craft') {
        if (this.callbacks.onOpenStation) this.callbacks.onOpenStation('crafting');
        return;
      }
      if (targetDef.interactive === 'smelt') {
        if (this.callbacks.onOpenStation) this.callbacks.onOpenStation('smelting');
        return;
      }
      if (targetDef.interactive === 'chest') {
        this.openRuinChest(this.targetHit.x, this.targetHit.y, this.targetHit.z);
        return;
      }
    }

    const held = this.inventory.getHeldDef();
    if (!held) return;

    // 2. Eat food items
    if (held.food) {
      if (this.mode === GAME_MODES.SURVIVAL && (this.hunger < this.maxHunger || this.health < this.maxHealth)) {
        this.hunger = Math.min(this.maxHunger, this.hunger + held.food);
        this.health = Math.min(this.maxHealth, this.health + (held.heal || 1));
        this.inventory.consumeSelected(1);
        this.sound.playEat();
        this.triggerSwing();
        if (this.callbacks.onStatsChange) this.callbacks.onStatsChange();
        if (this.callbacks.onToast) this.callbacks.onToast(`Ate ${held.name}`);
      }
      return;
    }

    // 3. Bucket water scoop & pour!
    if (held.id === 'item:bucket') {
      const waterHit = raycastVoxel(
        (x, y, z) => this.chunkManager.getBlock(x, y, z),
        this.camera.position,
        dir,
        5.5,
        (id) => id === BLOCK.WATER
      );
      if (waterHit) {
        this.chunkManager.setBlock(waterHit.x, waterHit.y, waterHit.z, BLOCK.AIR, true);
        this.inventory.consumeSelected(1);
        this.inventory.addItem('item:water_bucket', 1);
        this.sound.playBlockSound('water', true);
        this.triggerSwing();
      }
      return;
    }

    if (held.placesFluid !== undefined && this.targetHit) {
      const { x, y, z } = this.targetHit.placePos;
      if (y > 0 && y < WORLD_HEIGHT - 1) {
        this.chunkManager.setBlock(x, y, z, held.placesFluid, true);
        if (this.mode === GAME_MODES.SURVIVAL) {
          this.inventory.consumeSelected(1);
          this.inventory.addItem('item:bucket', 1);
        }
        this.sound.playBlockSound('water', true);
        this.triggerSwing();
      }
      return;
    }

    // 4. Place Block in World
    if (held.blockId !== undefined && this.targetHit) {
      const targetBlock = this.chunkManager.getBlock(this.targetHit.x, this.targetHit.y, this.targetHit.z);
      const replaceInPlace = Boolean(BLOCK_DEFS[targetBlock]?.replaceable);

      const px = replaceInPlace ? this.targetHit.x : this.targetHit.placePos.x;
      const py = replaceInPlace ? this.targetHit.y : this.targetHit.placePos.y;
      const pz = replaceInPlace ? this.targetHit.z : this.targetHit.placePos.z;

      if (py < 0 || py >= WORLD_HEIGHT) return;

      const existing = this.chunkManager.getBlock(px, py, pz);
      if (existing !== BLOCK.AIR && existing !== BLOCK.WATER && !BLOCK_DEFS[existing]?.replaceable) {
        return;
      }

      const placingDef = getBlockDef(held.blockId);
      // Pillar-jump forgiveness: smoothly boost feet atop block when nearly cleared!
      if (placingDef.solid && this.blockIntersectsPlayer(px, py, pz)) {
        if (this.position.y >= py + 0.78 && this.velocity.y >= -1.5 && !this.collidesAABB(this.position.x, py + 1.001, this.position.z)) {
          this.position.y = py + 1.0002;
          this.velocity.y = Math.max(0, this.velocity.y);
        } else {
          return;
        }
      }

      this.chunkManager.setBlock(px, py, pz, held.blockId, true);
      this.sound.playBlockSound(placingDef.sound || 'wood', false);
      this.triggerSwing();

      if (this.mode === GAME_MODES.SURVIVAL) {
        this.inventory.consumeSelected(1);
      }
      if (this.callbacks.onBlockPlaced) {
        this.callbacks.onBlockPlaced(held.blockId);
      }
    }
  }

  openRuinChest(x, y, z) {
    const key = `${x},${y},${z}`;
    this.triggerSwing();
    if (this.openedChests.has(key)) {
      if (this.callbacks.onToast) this.callbacks.onToast('This chest has already been looted');
      return;
    }
    this.openedChests.add(key);
    this.sound.playCraft();
    this.particles.emitPuff(x + 0.5, y + 0.8, z + 0.5, '#ffe066', 18);

    const lootTable = [
      { id: 'item:iron_ingot', count: 3 },
      { id: 'item:bread', count: 3 },
      { id: `block:${BLOCK.TORCH}`, count: 6 },
      { id: 'item:gold_ingot', count: 2 },
      { id: 'item:diamond', count: 1 },
    ];
    for (const entry of lootTable) {
      this.drops.spawnDrop(x + 0.5, y + 1.05, z + 0.5, entry.id, entry.count, 0.15);
    }
    if (this.callbacks.onToast) {
      this.callbacks.onToast('Treasure Chest opened! Collect your loot!');
    }
  }

  blockIntersectsPlayer(bx, by, bz) {
    const pMinX = this.position.x - PLAYER_HALF_W + 0.02;
    const pMaxX = this.position.x + PLAYER_HALF_W - 0.02;
    const pMinY = this.position.y + 0.02;
    const pMaxY = this.position.y + PLAYER_HEIGHT - 0.02;
    const pMinZ = this.position.z - PLAYER_HALF_W + 0.02;
    const pMaxZ = this.position.z + PLAYER_HALF_W - 0.02;

    return (
      pMaxX > bx &&
      pMinX < bx + 1 &&
      pMaxY > by &&
      pMinY < by + 1 &&
      pMaxZ > bz &&
      pMinZ < bz + 1
    );
  }

  serialize() {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      spawnX: this.spawnPoint.x,
      spawnY: this.spawnPoint.y,
      spawnZ: this.spawnPoint.z,
      yaw: this.yaw,
      pitch: this.pitch,
      mode: this.mode,
      flying: this.flying,
      health: this.health,
      hunger: this.hunger,
      openedChests: Array.from(this.openedChests),
    };
  }

  deserialize(data) {
    if (!data) return;
    this.position.set(data.x ?? 8.5, data.y ?? 48, data.z ?? 8.5);
    this.spawnPoint.set(data.spawnX ?? data.x ?? 8.5, data.spawnY ?? data.y ?? 48, data.spawnZ ?? data.z ?? 8.5);
    this.yaw = data.yaw ?? 0;
    this.pitch = data.pitch ?? -0.12;
    this.mode = data.mode ?? GAME_MODES.SURVIVAL;
    this.flying = Boolean(data.flying);
    this.health = data.health ?? 20;
    this.hunger = data.hunger ?? 20;
    this.openedChests = new Set(data.openedChests || []);
    this.velocity.set(0, 0, 0);
    this.highestAirY = null;
  }
}
