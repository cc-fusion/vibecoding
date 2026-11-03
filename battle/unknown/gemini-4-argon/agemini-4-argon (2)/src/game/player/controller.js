import * as THREE from 'three';
import {
  CHUNK_HEIGHT,
  PLAYER_HALF_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_CROUCH_HEIGHT,
  PLAYER_EYE_HEIGHT,
  PLAYER_CROUCH_EYE_HEIGHT,
  GRAVITY,
  WATER_GRAVITY,
  TERMINAL_VELOCITY,
  JUMP_VELOCITY,
  WALK_SPEED,
  SPRINT_SPEED,
  CROUCH_SPEED,
  SWIM_SPEED,
  FLY_SPEED,
  REACH_DISTANCE,
  GAME_MODES,
} from '../constants.js';
import {
  BLOCK,
  getDef,
  canHarvestBlock,
  getRequiredToolHint,
  getMiningDuration,
} from '../blocks.js';
import {
  moveEntityWithCollisions,
  entityIntersectsBlock,
  isBoxInWater,
  aabbIntersectsSolid,
} from './physics.js';

export class PlayerController {
  constructor(camera, scene, world, inventory, textureManager, sound) {
    this.camera = camera;
    this.scene = scene;
    this.world = world;
    this.inventory = inventory;
    this.textureManager = textureManager;
    this.sound = sound;

    this.pos = new THREE.Vector3(0.5, 45, 0.5);
    this.spawnPoint = new THREE.Vector3(0.5, 45, 0.5);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.12;

    this.halfWidth = PLAYER_HALF_WIDTH;
    this.height = PLAYER_HEIGHT;
    this.currentEyeHeight = PLAYER_EYE_HEIGHT;

    this.onGround = false;
    this.inWater = false;
    this.headUnderwater = false;
    this.isFlying = false;
    this.isSprinting = false;
    this.isCrouching = false;

    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.lastSpaceTap = 0;
    this.lastWTap = 0;
    this.fallPeakY = null;
    this.stepDistanceAcc = 0;

    // Survival vitals
    this.maxHealth = 20;
    this.health = 20;
    this.maxHunger = 20;
    this.hunger = 20;
    this.maxOxygen = 10;
    this.oxygen = 10;
    this.regenTimer = 0;
    this.hungerTimer = 0;
    this.drownTimer = 0;
    this.hurtFlash = 0;
    this.invulnerableTimer = 0;

    // Input state
    this.keys = new Set();
    this.mouseDownLeft = false;
    this.mouseDownRight = false;
    this.placeCooldown = 0;
    this.attackCooldown = 0;

    // Target & mining state
    this.targetBlock = null;
    this.miningBlockKey = '';
    this.miningElapsed = 0;
    this.miningDuration = 1;
    this.miningTapTimer = 0;
    this.miningToolWarning = null;

    // Animation state
    this.walkBobPhase = 0;
    this.swingProgress = 0; // 0 = idle, 1..0 = swinging
    this.heldMeshId = -1;

    // External hooks set by Game
    this.gameMode = GAME_MODES.SURVIVAL;
    this.sensitivity = 1.0;
    this.baseFov = 75;
    this.onBlockBroken = null;
    this.onBlockPlaced = null;
    this.onOpenStation = null;
    this.onAttackRay = null;
    this.canPlaceAtEntityCheck = null;
    this.onPlayerDied = null;
    this.onToast = null;

    this._initTargetMeshes();
    this._initViewmodel();
  }

  _initTargetMeshes() {
    // Crisp block selection wireframe
    const boxGeom = new THREE.BoxGeometry(1.006, 1.006, 1.006);
    const edges = new THREE.EdgesGeometry(boxGeom);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x15181e,
      transparent: true,
      opacity: 0.72,
    });
    this.selectionWire = new THREE.LineSegments(edges, lineMat);
    this.selectionWire.visible = false;
    this.scene.add(this.selectionWire);

    // Progressive crack overlay box
    const crackGeom = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    this.crackMat = new THREE.MeshBasicMaterial({
      map: this.textureManager.crackTextures[0],
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.crackMesh = new THREE.Mesh(crackGeom, this.crackMat);
    this.crackMesh.visible = false;
    this.crackMesh.renderOrder = 3;
    this.scene.add(this.crackMesh);
  }

  _initViewmodel() {
    this.handRig = new THREE.Group();
    this.handPivot = new THREE.Group();
    this.handRig.position.set(0.38, -0.26, -0.66);
    this.handRig.add(this.handPivot);
    this.camera.add(this.handRig);
    this._rebuildHeldMesh(0);
  }

  _rebuildHeldMesh(itemId) {
    while (this.handPivot.children.length > 0) {
      const child = this.handPivot.children.pop();
      if (child.geometry && !child.userData.sharedGeom) child.geometry.dispose();
      if (child.material && child.material !== this.world.materials.solidMaterial) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    }

    this.heldMeshId = itemId;

    if (!itemId) {
      // Bare voxel arm
      const armGeom = new THREE.BoxGeometry(0.16, 0.44, 0.16);
      const armMat = new THREE.MeshBasicMaterial({ color: 0xd9a37c });
      const arm = new THREE.Mesh(armGeom, armMat);
      arm.rotation.set(0.55, -0.35, -0.25);
      arm.position.set(0.06, -0.08, 0.05);
      arm.renderOrder = 999;
      armMat.depthTest = false;
      this.handPivot.add(arm);
      return;
    }

    const def = getDef(itemId);
    if (def.isBlock && !def.crossMesh) {
      // Held 3D miniature block using exact block face UVs
      const geom = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      const uvAttr = geom.attributes.uv;
      // BoxGeometry face order: +x, -x, +y, -y, +z, -z
      const faceDirs = ['side', 'side', 'top', 'bottom', 'side', 'side'];
      const faceShades = [0.78, 0.78, 1.0, 0.6, 0.9, 0.9];
      const colors = [];

      for (let f = 0; f < 6; f++) {
        const uv = this.textureManager.getBlockFaceUV(itemId, faceDirs[f]);
        const base = f * 4;
        uvAttr.setXY(base + 0, uv.u0, uv.v1);
        uvAttr.setXY(base + 1, uv.u1, uv.v1);
        uvAttr.setXY(base + 2, uv.u0, uv.v0);
        uvAttr.setXY(base + 3, uv.u1, uv.v0);
        const s = faceShades[f];
        for (let k = 0; k < 4; k++) colors.push(s, s, s);
      }
      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      const mat = new THREE.MeshBasicMaterial({
        map: this.textureManager.atlasTexture,
        vertexColors: true,
        transparent: Boolean(def.cutoutCube),
        alphaTest: def.cutoutCube ? 0.45 : 0,
        depthTest: false,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.set(0.28, -0.68, 0.08);
      mesh.renderOrder = 999;
      this.handPivot.add(mesh);
      return;
    }

    // 3D Extruded voxel tool, weapon, torch, food, or flora held in hand
    const extGeom = this.textureManager.getExtrudedItemGeometry(itemId);
    if (extGeom) {
      const mat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        depthTest: false,
      });
      const mesh = new THREE.Mesh(extGeom, mat);
      mesh.userData.sharedGeom = true;
      mesh.rotation.set(0.08, -0.58, 0.14);
      mesh.renderOrder = 999;
      this.handPivot.add(mesh);
    }
  }

  triggerSwing() {
    if (this.swingProgress <= 0.15) {
      this.swingProgress = 1.0;
    }
  }

  onMouseMove(movementX, movementY) {
    const sens = 0.0022 * this.sensitivity;
    this.yaw -= movementX * sens;
    this.pitch -= movementY * sens;
    const maxPitch = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  handleKeyDown(code, repeat = false) {
    if (!repeat) {
      const now = performance.now();
      if (code === 'Space') {
        this.jumpBufferTimer = 0.12;
        if (this.gameMode === GAME_MODES.CREATIVE) {
          if (now - this.lastSpaceTap < 280) {
            this.isFlying = !this.isFlying;
            this.vel.y = 0;
            this.lastSpaceTap = 0;
          } else {
            this.lastSpaceTap = now;
          }
        }
      }
      if (code === 'KeyW') {
        if (now - this.lastWTap < 260) {
          this.isSprinting = true;
        }
        this.lastWTap = now;
      }
      if (code.startsWith('Digit')) {
        const num = parseInt(code.slice(5), 10);
        if (num >= 1 && num <= 9) {
          this.inventory.selectHotbar(num - 1);
        }
      }
    }
    this.keys.add(code);
  }

  handleKeyUp(code) {
    this.keys.delete(code);
    if (code === 'KeyW') {
      this.isSprinting = false;
    }
  }

  clearInputs() {
    this.keys.clear();
    this.mouseDownLeft = false;
    this.mouseDownRight = false;
    this.isSprinting = false;
    this.isCrouching = false;
    this._resetMining();
  }

  _resetMining() {
    this.miningBlockKey = '';
    this.miningElapsed = 0;
    this.miningToolWarning = null;
    this.crackMesh.visible = false;
  }

  takeDamage(amount, knockbackDir = null) {
    if (this.gameMode === GAME_MODES.CREATIVE || this.invulnerableTimer > 0 || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtFlash = 1.0;
    this.invulnerableTimer = 0.55;
    this.sound.playHurt();

    if (knockbackDir) {
      this.vel.x += knockbackDir.x * 6.5;
      this.vel.z += knockbackDir.z * 6.5;
      this.vel.y = Math.max(this.vel.y, 4.8);
    }

    if (this.health <= 0) {
      this.respawn();
    }
  }

  respawn() {
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this.oxygen = this.maxOxygen;
    this.vel.set(0, 0, 0);
    this.fallPeakY = null;
    this.pos.copy(this.spawnPoint);
    this.world.preloadAround(this.pos.x, this.pos.z, 1);
    // Ensure spawn column is clear above surface
    while (
      this.pos.y < CHUNK_HEIGHT - 3 &&
      aabbIntersectsSolid(
        this.world,
        this.pos.x - this.halfWidth,
        this.pos.y,
        this.pos.z - this.halfWidth,
        this.pos.x + this.halfWidth,
        this.pos.y + this.height,
        this.pos.z + this.halfWidth
      )
    ) {
      this.pos.y += 1.0;
    }
    if (typeof this.onPlayerDied === 'function') {
      this.onPlayerDied();
    }
  }

  getEyePosition(target = new THREE.Vector3()) {
    return target.set(this.pos.x, this.pos.y + this.currentEyeHeight, this.pos.z);
  }

  getLookDirection(target = new THREE.Vector3()) {
    const cosPitch = Math.cos(this.pitch);
    return target.set(
      -Math.sin(this.yaw) * cosPitch,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cosPitch
    ).normalize();
  }

  update(dt, controlsEnabled = true) {
    if (this.gameMode !== GAME_MODES.CREATIVE && this.isFlying) {
      this.isFlying = false;
    }

    // Optional arrow-key camera look fallback
    if (controlsEnabled) {
      const keyTurnSpeed = 2.1 * dt;
      if (this.keys.has('ArrowLeft')) this.yaw += keyTurnSpeed;
      if (this.keys.has('ArrowRight')) this.yaw -= keyTurnSpeed;
      if (this.keys.has('ArrowUp')) this.pitch = Math.min(Math.PI / 2 - 0.02, this.pitch + keyTurnSpeed * 0.8);
      if (this.keys.has('ArrowDown')) this.pitch = Math.max(-Math.PI / 2 + 0.02, this.pitch - keyTurnSpeed * 0.8);
    }

    // Crouch check (also verify headroom before standing up)
    const wantCrouch = controlsEnabled && !this.isFlying && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.keys.has('KeyC'));
    if (wantCrouch) {
      this.isCrouching = true;
      this.height = PLAYER_CROUCH_HEIGHT;
    } else if (this.isCrouching) {
      const blockedAbove = aabbIntersectsSolid(
        this.world,
        this.pos.x - this.halfWidth,
        this.pos.y,
        this.pos.z - this.halfWidth,
        this.pos.x + this.halfWidth,
        this.pos.y + PLAYER_HEIGHT,
        this.pos.z + this.halfWidth
      );
      if (!blockedAbove) {
        this.isCrouching = false;
        this.height = PLAYER_HEIGHT;
      }
    }

    const targetEye = this.isCrouching ? PLAYER_CROUCH_EYE_HEIGHT : PLAYER_EYE_HEIGHT;
    this.currentEyeHeight += (targetEye - this.currentEyeHeight) * Math.min(1, dt * 14);

    // Water checks
    const prevInWater = this.inWater;
    this.inWater = isBoxInWater(this.world, this.pos, this.halfWidth, this.height);
    const eyeBlock = this.world.getBlock(this.pos.x, this.pos.y + this.currentEyeHeight, this.pos.z);
    this.headUnderwater = eyeBlock === BLOCK.WATER;

    if (this.inWater && !prevInWater && Math.abs(this.vel.y) > 2.5) {
      this.sound.playSplash();
    }

    // Movement vector
    let forward = 0;
    let strafe = 0;
    if (controlsEnabled) {
      if (this.keys.has('KeyW')) forward += 1;
      if (this.keys.has('KeyS')) forward -= 1;
      if (this.keys.has('KeyD')) strafe += 1;
      if (this.keys.has('KeyA')) strafe -= 1;
    }

    const sprintKey = this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has('KeyR');
    const sprinting = controlsEnabled && forward > 0 && !this.isCrouching && (sprintKey || this.isSprinting) && this.hunger > 4;

    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);
    let wishX = -sinYaw * forward + cosYaw * strafe;
    let wishZ = -cosYaw * forward - sinYaw * strafe;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 0.001) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }

    // Physics modes: Flying vs Swimming vs Ground/Air
    if (this.isFlying) {
      const speed = sprinting ? FLY_SPEED * 1.55 : FLY_SPEED;
      this.vel.x += (wishX * speed - this.vel.x) * Math.min(1, dt * 12);
      this.vel.z += (wishZ * speed - this.vel.z) * Math.min(1, dt * 12);
      let vy = 0;
      if (controlsEnabled && this.keys.has('Space')) vy += speed * 0.8;
      if (controlsEnabled && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'))) vy -= speed * 0.8;
      this.vel.y += (vy - this.vel.y) * Math.min(1, dt * 12);

      const res = moveEntityWithCollisions(this.world, this, dt, false);
      if (res.hitGround && vy < 0) {
        this.isFlying = false;
      }
      this.fallPeakY = null;
    } else if (this.inWater) {
      const speed = SWIM_SPEED * (sprinting ? 1.25 : 1.0);
      this.vel.x += (wishX * speed - this.vel.x) * Math.min(1, dt * 8);
      this.vel.z += (wishZ * speed - this.vel.z) * Math.min(1, dt * 8);

      if (controlsEnabled && this.keys.has('Space')) {
        this.vel.y = Math.min(4.2, this.vel.y + 18.0 * dt);
      } else if (controlsEnabled && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'))) {
        this.vel.y = Math.max(-4.5, this.vel.y - 14.0 * dt);
      } else {
        this.vel.y = Math.max(-2.2, this.vel.y - WATER_GRAVITY * dt);
      }

      const res = moveEntityWithCollisions(this.world, this, dt, false);
      // Help hop onto shoreline ledges out of water
      if (res.hitWall && controlsEnabled && (this.keys.has('Space') || wishLen > 0.2)) {
        this.vel.y = 5.6;
      }
      this.fallPeakY = null;
    } else {
      // Standard land & air physics
      const underBlock = this.world.getBlock(this.pos.x, this.pos.y - 0.1, this.pos.z);
      const onIce = this.onGround && underBlock === BLOCK.ICE;

      const targetSpeed = this.isCrouching
        ? CROUCH_SPEED
        : sprinting
        ? SPRINT_SPEED
        : WALK_SPEED;

      const accel = this.onGround ? (onIce ? 4.2 : 16.0) : 5.5;
      this.vel.x += (wishX * targetSpeed - this.vel.x) * Math.min(1, dt * accel);
      this.vel.z += (wishZ * targetSpeed - this.vel.z) * Math.min(1, dt * accel);

      if (this.onGround) {
        this.coyoteTimer = 0.11;
      } else {
        this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
        if (this.fallPeakY === null || this.pos.y > this.fallPeakY) {
          this.fallPeakY = this.pos.y;
        }
      }

      if (this.jumpBufferTimer > 0) {
        this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
      }

      const holdJump = controlsEnabled && this.keys.has('Space');
      if ((this.jumpBufferTimer > 0 || (holdJump && this.onGround)) && this.coyoteTimer > 0) {
        this.vel.y = JUMP_VELOCITY;
        this.onGround = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.fallPeakY = this.pos.y;
      }

      this.vel.y = Math.max(-TERMINAL_VELOCITY, this.vel.y - GRAVITY * dt);

      const wasAirborne = !this.onGround;
      const peakBefore = this.fallPeakY;
      const res = moveEntityWithCollisions(this.world, this, dt, this.isCrouching);

      if (wasAirborne && res.hitGround) {
        if (peakBefore !== null && !this.inWater) {
          const fallDist = peakBefore - this.pos.y;
          if (fallDist > 3.85) {
            const dmg = Math.floor(fallDist - 3.3);
            this.takeDamage(dmg);
          } else if (fallDist > 1.2) {
            const groundId = this.world.getBlock(this.pos.x, this.pos.y - 0.2, this.pos.z);
            this.sound.playStep(getDef(groundId).sound || 'grass');
          }
        }
        this.fallPeakY = null;
      }

      // Footsteps
      if (this.onGround && wishLen > 0.1) {
        const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
        this.stepDistanceAcc += horizSpeed * dt;
        const stride = this.isCrouching ? 2.3 : sprinting ? 1.85 : 2.05;
        if (this.stepDistanceAcc >= stride) {
          this.stepDistanceAcc = 0;
          const groundId = this.world.getBlock(this.pos.x, this.pos.y - 0.2, this.pos.z);
          if (!this.isCrouching) {
            this.sound.playStep(getDef(groundId).sound || 'grass');
          }
        }
      }
    }

    // Dynamic FOV kick while sprinting
    const desiredFov = this.baseFov + (sprinting ? 6.5 : 0);
    if (Math.abs(this.camera.fov - desiredFov) > 0.05) {
      this.camera.fov += (desiredFov - this.camera.fov) * Math.min(1, dt * 10);
      this.camera.updateProjectionMatrix();
    }

    // Update Survival Vitals
    this._updateVitals(dt, wishLen > 0.1 && sprinting);

    // Update Camera Transform + Subtle Walk Bob
    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    if ((this.onGround || this.inWater) && horizSpeed > 0.25 && !this.isFlying) {
      this.walkBobPhase += dt * horizSpeed * 2.1;
    } else {
      this.walkBobPhase += dt * 1.2;
    }
    const bobOffsetY = (this.onGround && horizSpeed > 0.25) ? Math.sin(this.walkBobPhase * 2) * 0.032 : 0;

    this.camera.position.set(
      this.pos.x,
      this.pos.y + this.currentEyeHeight + bobOffsetY,
      this.pos.z
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = this.hurtFlash > 0 ? Math.sin(this.hurtFlash * Math.PI) * 0.045 : 0;

    // Update Block Raycast & Interactions
    this._updateTargetAndActions(dt, controlsEnabled);

    // Update 3D Viewmodel
    this._updateViewmodel(dt, horizSpeed);
  }

  _updateVitals(dt, isSprintingMoving) {
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3.2);
    if (this.invulnerableTimer > 0) this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);

    if (this.gameMode === GAME_MODES.CREATIVE) {
      this.health = this.maxHealth;
      this.hunger = this.maxHunger;
      this.oxygen = this.maxOxygen;
      return;
    }

    // Underwater oxygen
    if (this.headUnderwater) {
      this.oxygen = Math.max(0, this.oxygen - dt * 0.65);
      if (this.oxygen <= 0) {
        this.drownTimer += dt;
        if (this.drownTimer >= 1.1) {
          this.drownTimer = 0;
          this.takeDamage(2);
        }
      }
    } else {
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + dt * 3.0);
      this.drownTimer = 0;
    }

    // Gentle hunger drain
    this.hungerTimer += dt * (isSprintingMoving ? 2.6 : 0.45);
    if (this.hungerTimer >= 26) {
      this.hungerTimer = 0;
      this.hunger = Math.max(2, this.hunger - 1);
    }

    // Natural health regeneration when well-fed
    if (this.health < this.maxHealth && this.hunger >= 15) {
      this.regenTimer += dt;
      if (this.regenTimer >= 3.2) {
        this.regenTimer = 0;
        this.health = Math.min(this.maxHealth, this.health + 1);
      }
    } else {
      this.regenTimer = 0;
    }
  }

  _updateTargetAndActions(dt, controlsEnabled) {
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    const origin = this.getEyePosition();
    const dir = this.getLookDirection();
    const hit = controlsEnabled ? this.world.raycast(origin, dir, REACH_DISTANCE) : null;
    this.targetBlock = hit;

    if (hit) {
      this.selectionWire.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      this.selectionWire.visible = true;
    } else {
      this.selectionWire.visible = false;
    }

    if (!controlsEnabled) {
      this._resetMining();
      return;
    }

    // Left-click: Attack Mob or Mine Block
    if (this.mouseDownLeft) {
      this.triggerSwing();

      // Check mob hit first if attack cooldown ready
      if (this.attackCooldown <= 0 && typeof this.onAttackRay === 'function') {
        const maxMobDist = hit ? Math.min(3.9, hit.distance + 0.25) : 3.9;
        const hitMob = this.onAttackRay(origin, dir, maxMobDist);
        if (hitMob) {
          this.attackCooldown = 0.42;
          this._resetMining();
          return;
        }
      }

      if (hit) {
        const def = getDef(hit.blockId);
        if (def.unbreakable && this.gameMode !== GAME_MODES.CREATIVE) {
          this._resetMining();
          return;
        }

        const key = `${hit.x},${hit.y},${hit.z},${hit.blockId}`;
        const heldId = this.inventory.getHeldId();

        if (this.gameMode === GAME_MODES.CREATIVE) {
          if (this.attackCooldown <= 0) {
            this.attackCooldown = 0.16;
            this._finishBreakBlock(hit);
          }
          return;
        }

        if (this.miningBlockKey !== key) {
          this.miningBlockKey = key;
          this.miningElapsed = 0;
          this.miningTapTimer = 0;
        }

        this.miningDuration = getMiningDuration(hit.blockId, heldId, this.headUnderwater, this.onGround);
        this.miningToolWarning = canHarvestBlock(hit.blockId, heldId) ? null : getRequiredToolHint(hit.blockId);
        this.miningElapsed += dt;
        this.miningTapTimer += dt;

        if (this.miningTapTimer >= 0.22) {
          this.miningTapTimer = 0;
          this.sound.playHit(def.sound || 'stone');
        }

        const ratio = Math.min(0.999, this.miningElapsed / this.miningDuration);
        const stage = Math.floor(ratio * 10);
        this.crackMat.map = this.textureManager.crackTextures[stage];
        this.crackMat.needsUpdate = true;
        this.crackMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
        this.crackMesh.visible = true;

        if (this.miningElapsed >= this.miningDuration) {
          this._finishBreakBlock(hit);
          this._resetMining();
        }
      } else {
        this._resetMining();
      }
    } else {
      this._resetMining();
    }

    // Right-click: Interact Station, Eat Food, or Place Block
    if (this.mouseDownRight && this.placeCooldown <= 0) {
      this.handleRightClickAction();
    }
  }

  _finishBreakBlock(hit) {
    const blockId = hit.blockId;
    const def = getDef(blockId);
    const heldId = this.inventory.getHeldId();
    const canHarvest = this.gameMode === GAME_MODES.CREATIVE || canHarvestBlock(blockId, heldId);

    this.world.setBlock(hit.x, hit.y, hit.z, BLOCK.AIR, true);
    this.sound.playBreak(def.sound || 'stone');

    if (this.gameMode === GAME_MODES.SURVIVAL) {
      const dmgRes = this.inventory.damageHeldTool(1);
      if (dmgRes === 'broke') {
        this.sound.playToolBreak();
        if (this.onToast) this.onToast('Your tool wore out!');
      }
    }

    if (typeof this.onBlockBroken === 'function') {
      this.onBlockBroken(hit.x, hit.y, hit.z, blockId, canHarvest);
    }
  }

  handleRightClickAction() {
    this.placeCooldown = 0.21;
    const hit = this.targetBlock;
    const heldSlot = this.inventory.getHeldSlot();
    const heldDef = heldSlot ? getDef(heldSlot.id) : null;

    // 1. Right-click Crafting Table or Furnace (unless sneaking to place against it)
    if (hit && !this.isCrouching) {
      const targetDef = getDef(hit.blockId);
      if (targetDef.interactive && typeof this.onOpenStation === 'function') {
        this.onOpenStation(targetDef.interactive);
        return;
      }
    }

    // 2. Eat held food if hungry or injured
    if (heldDef && heldDef.food) {
      if (this.gameMode === GAME_MODES.SURVIVAL && (this.hunger < this.maxHunger || this.health < this.maxHealth)) {
        this.hunger = Math.min(this.maxHunger, this.hunger + heldDef.food);
        this.health = Math.min(this.maxHealth, this.health + (heldDef.heal || 1));
        this.inventory.consumeHeld(1);
        this.triggerSwing();
        this.sound.playEat();
        if (this.onToast) this.onToast(`Ate ${heldDef.name} (+${heldDef.food} Hunger)`);
      }
      return;
    }

    // 3. Place held block
    if (!hit || !heldDef || !heldDef.isBlock || heldSlot.id === BLOCK.AIR) return;

    const targetCurrent = this.world.getBlock(hit.x, hit.y, hit.z);
    const targetCurrentDef = getDef(targetCurrent);
    // Replace tall grass / dry shrub directly when clicked
    const px = targetCurrentDef.replaceable ? hit.x : hit.placePos.x;
    const py = targetCurrentDef.replaceable ? hit.y : hit.placePos.y;
    const pz = targetCurrentDef.replaceable ? hit.z : hit.placePos.z;

    if (py < 0 || py >= CHUNK_HEIGHT) return;

    const existing = this.world.getBlock(px, py, pz);
    const existingDef = getDef(existing);
    if (existing !== BLOCK.AIR && !existingDef.replaceable) return;

    // Torches/flowers require a solid block below (or solid wall for torch, let's allow torch anywhere adjacent to solid!)
    if (heldDef.crossMesh && !heldDef.isTorch) {
      const below = this.world.getBlock(px, py - 1, pz);
      if (!getDef(below).solid) return;
    }

    // Prevent placing solid block intersecting player or creatures
    if (heldDef.solid) {
      if (entityIntersectsBlock(this.pos, this.halfWidth, this.height, px, py, pz)) {
        return;
      }
      if (typeof this.canPlaceAtEntityCheck === 'function' && !this.canPlaceAtEntityCheck(px, py, pz)) {
        return;
      }
    }

    const placed = this.world.setBlock(px, py, pz, heldSlot.id, true);
    if (placed) {
      this.triggerSwing();
      this.sound.playPlace(heldDef.sound || 'stone');
      if (this.gameMode === GAME_MODES.SURVIVAL) {
        this.inventory.consumeHeld(1);
      }
      if (typeof this.onBlockPlaced === 'function') {
        this.onBlockPlaced(px, py, pz, heldSlot.id);
      }
    }
  }

  pickTargetedBlock() {
    if (!this.targetBlock) return;
    const id = this.targetBlock.blockId;
    if (id === BLOCK.AIR || id === BLOCK.BEDROCK || id === BLOCK.WATER) return;

    // If already in hotbar, select it
    for (let i = 0; i < 9; i++) {
      if (this.inventory.slots[i] && this.inventory.slots[i].id === id) {
        this.inventory.selectHotbar(i);
        return;
      }
    }
    // If in backpack, swap into current hotbar slot
    for (let i = 9; i < 36; i++) {
      if (this.inventory.slots[i] && this.inventory.slots[i].id === id) {
        this.inventory.swapSlots(i, this.inventory.selectedHotbar);
        return;
      }
    }
    // In Creative mode, populate into selected hotbar slot
    if (this.gameMode === GAME_MODES.CREATIVE) {
      this.inventory.slots[this.inventory.selectedHotbar] = { id, count: 64 };
      this.inventory.notify();
    }
  }

  _updateViewmodel(dt, horizSpeed) {
    const heldId = this.inventory.getHeldId();
    if (heldId !== this.heldMeshId) {
      this._rebuildHeldMesh(heldId);
    }

    if (this.swingProgress > 0) {
      this.swingProgress = Math.max(0, this.swingProgress - dt * 4.6);
    }

    const swingAngle = Math.sin((1 - this.swingProgress) * Math.PI);
    const walkSwayX = Math.cos(this.walkBobPhase) * 0.024 * Math.min(1, horizSpeed * 0.3);
    const walkSwayY = Math.abs(Math.sin(this.walkBobPhase)) * -0.026 * Math.min(1, horizSpeed * 0.3);

    this.handPivot.position.set(
      walkSwayX - swingAngle * 0.12,
      walkSwayY - swingAngle * 0.08,
      -swingAngle * 0.16
    );
    this.handPivot.rotation.set(
      -swingAngle * 0.85,
      swingAngle * 0.35,
      swingAngle * 0.25
    );
  }

  serialize() {
    return {
      pos: [this.pos.x, this.pos.y, this.pos.z],
      spawnPoint: [this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.z],
      yaw: this.yaw,
      pitch: this.pitch,
      health: this.health,
      hunger: this.hunger,
      isFlying: this.isFlying,
    };
  }

  deserialize(data) {
    if (!data) return;
    if (Array.isArray(data.pos) && data.pos.length === 3) {
      this.pos.set(data.pos[0], data.pos[1], data.pos[2]);
    }
    if (Array.isArray(data.spawnPoint) && data.spawnPoint.length === 3) {
      this.spawnPoint.set(data.spawnPoint[0], data.spawnPoint[1], data.spawnPoint[2]);
    }
    if (typeof data.yaw === 'number') this.yaw = data.yaw;
    if (typeof data.pitch === 'number') this.pitch = data.pitch;
    if (typeof data.health === 'number') this.health = data.health;
    if (typeof data.hunger === 'number') this.hunger = data.hunger;
    if (typeof data.isFlying === 'boolean') this.isFlying = data.isFlying;
  }
}
