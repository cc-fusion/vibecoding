import * as THREE from 'three';
import {
  BLOCK_SHAPES,
  FLY_SPEED,
  FLY_SPRINT_SPEED,
  GAME_MODES,
  GRAVITY,
  JUMP_VELOCITY,
  PLAYER_EYE_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_SNEAK_EYE_HEIGHT,
  PLAYER_WIDTH,
  REACH_DISTANCE,
  SNEAK_SPEED,
  SPRINT_SPEED,
  SWIM_SPEED,
  WALK_SPEED,
  WATER_GRAVITY,
} from '../constants.js';
import { BLOCK, BLOCKS } from '../data/blocks.js';
import { getEntry, ITEM } from '../data/items.js';

export class Player {
  constructor(camera, scene, atlas, inventory) {
    this.camera = camera;
    this.scene = scene;
    this.atlas = atlas;
    this.inventory = inventory;

    this.pos = new THREE.Vector3(0.5, 50, 0.5);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.12;
    this.mouseSensitivity = 0.0022;
    this.baseFov = 74;

    this.gameMode = GAME_MODES.SURVIVAL;
    this.flying = false;
    this.onGround = false;
    this.inWater = false;
    this.eyesUnderwater = false;
    this.sneaking = false;
    this.sprinting = false;

    // Survival vitals
    this.maxHealth = 20;
    this.health = 20;
    this.maxHunger = 20;
    this.hunger = 20;
    this._exhaustion = 0;
    this._regenTimer = 0;
    this._hurtInvuln = 0;
    this._damageTilt = 0;
    this._peakAirY = 50;
    this.dead = false;
    this.spawnPoint = { x: 0.5, y: 50, z: 0.5 };

    // Input state
    this.keys = new Set();
    this.mouseLeftDown = false;
    this.mouseRightDown = false;
    this._lastSpacePress = 0;
    this._lastWPress = 0;

    // Raycast target & progressive mining state
    this.targetBlock = null;
    this._miningKey = '';
    this._miningProgress = 0; // 0..1
    this._digEffectTimer = 0;
    this._creativeBreakCooldown = 0;
    this._placeCooldown = 0;
    this._attackCooldown = 0;
    this._stepDistance = 0;
    this._cactusTimer = 0;

    // 3D Selection Wireframe + Progressive Crack Cube
    this._buildTargetOverlays();

    // Callbacks wired by Game
    this.onOpenCraftingTable = null;
    this.onOpenFurnace = null;
    this.onOpenChest = null;
    this.onToast = null;
    this.onDeath = null;
    this.onVitalsChange = null;
  }

  _buildTargetOverlays() {
    const boxGeo = new THREE.BoxGeometry(1.006, 1.006, 1.006);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x14161a,
      transparent: true,
      opacity: 0.68,
    });
    this.selectionBox = new THREE.LineSegments(edges, lineMat);
    this.selectionBox.visible = false;
    this.scene.add(this.selectionBox);

    const crackGeo = new THREE.BoxGeometry(1.012, 1.012, 1.012);
    this.crackMat = new THREE.MeshBasicMaterial({
      map: this.atlas.crackTextures[0],
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.crackMesh = new THREE.Mesh(crackGeo, this.crackMat);
    this.crackMesh.visible = false;
    this.crackMesh.renderOrder = 5;
    this.scene.add(this.crackMesh);
  }

  setGameMode(mode) {
    this.gameMode = mode;
    if (mode === GAME_MODES.SURVIVAL) {
      this.flying = false;
    } else {
      this.health = this.maxHealth;
      this.hunger = this.maxHunger;
      this.dead = false;
    }
    if (this.onVitalsChange) this.onVitalsChange();
  }

  setPositionSafe(x, y, z) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this._peakAirY = y;
  }

  respawn(world) {
    world.preloadAround(this.spawnPoint.x, this.spawnPoint.z, 2);
    let sy = Math.floor(this.spawnPoint.y);
    while (sy < 90 && (
      BLOCKS[world.getBlock(Math.floor(this.spawnPoint.x), sy, Math.floor(this.spawnPoint.z))]?.solid ||
      BLOCKS[world.getBlock(Math.floor(this.spawnPoint.x), sy + 1, Math.floor(this.spawnPoint.z))]?.solid
    )) {
      sy++;
    }
    this.setPositionSafe(this.spawnPoint.x, sy + 0.05, this.spawnPoint.z);
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this.dead = false;
    if (this.onVitalsChange) this.onVitalsChange();
  }

  onMouseMove(dx, dy, viewModel) {
    if (this.dead) return;
    // Ignore large synthetic cursor warp deltas when Pointer Lock engages
    if (Math.abs(dx) > 160 || Math.abs(dy) > 160) return;
    this.yaw -= dx * this.mouseSensitivity;
    this.pitch -= dy * this.mouseSensitivity;
    const maxPitch = Math.PI / 2 - 0.015;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    if (viewModel) viewModel.addLookSway(dx, dy);
  }

  onKeyDown(code) {
    const wasDown = this.keys.has(code);
    this.keys.add(code);
    if (wasDown || this.dead) return;

    const now = performance.now();
    if (code === 'Space') {
      if (this.gameMode === GAME_MODES.CREATIVE && now - this._lastSpacePress < 300) {
        this.flying = !this.flying;
        this.vel.y = 0;
        this._peakAirY = this.pos.y;
        if (this.onToast) this.onToast(this.flying ? 'Flight enabled' : 'Flight disabled');
      }
      this._lastSpacePress = now;
    } else if (code === 'KeyF' && this.gameMode === GAME_MODES.CREATIVE) {
      this.flying = !this.flying;
      this.vel.y = 0;
      if (this.onToast) this.onToast(this.flying ? 'Flight enabled' : 'Flight disabled');
    } else if (code === 'KeyW') {
      if (now - this._lastWPress < 280) {
        this.sprinting = true;
      }
      this._lastWPress = now;
    }
  }

  onKeyUp(code) {
    this.keys.delete(code);
    if (code === 'KeyW') {
      this.sprinting = false;
    }
  }

  clearInputs() {
    this.keys.clear();
    this.mouseLeftDown = false;
    this.mouseRightDown = false;
    this.sprinting = false;
    this._resetMining();
  }

  tossHeldItem(itemDrops, sound) {
    const slot = this.inventory.getHeldSlot();
    if (!slot || slot.count <= 0) return;

    const dir = this.getLookDirection();
    const dropId = slot.id;
    const dropDur = slot.durability;

    if (this.gameMode === GAME_MODES.SURVIVAL) {
      this.inventory.consumeHeld(1, this.gameMode);
    }

    itemDrops.spawnDrop(
      this.pos.x + dir.x * 0.45,
      this.pos.y + PLAYER_EYE_HEIGHT - 0.25,
      this.pos.z + dir.z * 0.45,
      dropId,
      1,
      dropDur,
      { x: dir.x * 6.2, y: dir.y * 5.0 + 2.2, z: dir.z * 6.2 },
      1.25
    );
    sound.playSwing();
  }

  getLookDirection() {
    const dir = new THREE.Vector3(0, 0, -1);
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    dir.applyEuler(euler);
    return dir.normalize();
  }

  applyDamage(amount, knockback = null, sound = null) {
    if (this.gameMode === GAME_MODES.CREATIVE || this.dead || amount <= 0) return;
    if (this._hurtInvuln > 0) return;

    this._hurtInvuln = 0.48;
    this._damageTilt = 0.14;
    this.health = Math.max(0, this.health - amount);
    if (knockback) {
      this.vel.x += knockback.x || 0;
      this.vel.y = Math.max(this.vel.y, knockback.y || 3.5);
      this.vel.z += knockback.z || 0;
    }
    if (sound) sound.playHit(true);
    if (this.onVitalsChange) this.onVitalsChange();

    if (this.health <= 0) {
      this.dead = true;
      this.clearInputs();
      if (this.onDeath) this.onDeath();
    }
  }

  _blockBoxHeight(id) {
    if (id === BLOCK.BED_BLOCK) return 0.56;
    return 1.0;
  }

  _collidesWorld(world, px, py, pz) {
    const hw = PLAYER_WIDTH * 0.5;
    const minX = Math.floor(px - hw);
    const maxX = Math.floor(px + hw);
    const minY = Math.floor(py);
    const maxY = Math.floor(py + PLAYER_HEIGHT - 0.001);
    const minZ = Math.floor(pz - hw);
    const maxZ = Math.floor(pz + hw);

    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          const id = world.getBlock(bx, by, bz);
          const def = BLOCKS[id];
          if (def && def.solid) {
            const topY = by + this._blockBoxHeight(id);
            if (py < topY && py + PLAYER_HEIGHT > by) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  _hasGroundSupport(world, px, py, pz) {
    // Check if there is solid ground within 0.55 blocks below feet (for Shift sneak edge guard!)
    return this._collidesWorld(world, px, py - 0.52, pz);
  }

  update(dt, controlsLocked, world, viewModel, itemDrops, particles, sound, mobManager, tntManager, skyWeather) {
    if (this._hurtInvuln > 0) this._hurtInvuln -= dt;
    if (this._damageTilt > 0) this._damageTilt = Math.max(0, this._damageTilt - dt * 0.65);
    if (this._attackCooldown > 0) this._attackCooldown -= dt;
    if (this._placeCooldown > 0) this._placeCooldown -= dt;
    if (this._creativeBreakCooldown > 0) this._creativeBreakCooldown -= dt;

    if (!this.dead) {
      this._stepPhysics(dt, controlsLocked, world, particles, sound);
      this._updateVitals(dt);
    }

    // Update camera transform & dynamic FOV
    const targetEye = this.sneaking && !this.flying ? PLAYER_SNEAK_EYE_HEIGHT : PLAYER_EYE_HEIGHT;
    if (this._curEye === undefined) this._curEye = targetEye;
    this._curEye += (targetEye - this._curEye) * Math.min(1, dt * 14);

    this.camera.position.set(this.pos.x, this.pos.y + this._curEye, this.pos.z);
    const euler = new THREE.Euler(this.pitch, this.yaw, this._damageTilt, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    const targetFov = this.sprinting && (this.keys.has('KeyW') || this.keys.has('ArrowUp'))
      ? this.baseFov + 8
      : this.baseFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 10);
      this.camera.updateProjectionMatrix();
    }

    // Check if camera eye is submerged in water
    const eyeBlock = world.getBlock(
      Math.floor(this.camera.position.x),
      Math.floor(this.camera.position.y),
      Math.floor(this.camera.position.z)
    );
    this.eyesUnderwater = eyeBlock === BLOCK.WATER;

    // Raycast target block & handle interaction if pointer locked
    if (controlsLocked && !this.dead) {
      this._updateTargetingAndActions(dt, world, viewModel, itemDrops, particles, sound, mobManager, tntManager, skyWeather);
    } else {
      this.selectionBox.visible = false;
      this._resetMining();
    }

    // Update ViewModel
    const heldSlot = this.inventory.getHeldSlot();
    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    const bx = Math.floor(this.pos.x);
    const by = Math.floor(this.pos.y + 1);
    const bz = Math.floor(this.pos.z);
    const localSky = (world.getSkyLight(bx, by, bz) / 15) * skyWeather.skyState.brightness;
    const localBlk = world.getBlockLight(bx, by, bz) / 15;
    const heldGlow = heldSlot && BLOCKS[heldSlot.id]?.lightLevel ? 0.95 : 0;
    const localBright = Math.max(localSky, localBlk, heldGlow, 0.25);

    viewModel.update(dt, heldSlot ? heldSlot.id : 0, horizSpeed, this.onGround, localBright);
  }

  _stepPhysics(dt, controlsLocked, world, particles, sound) {
    // Wait for current chunk to exist so player never falls into ungenerated void
    const { cx, cz } = world.worldToChunk(Math.floor(this.pos.x), Math.floor(this.pos.z));
    if (!world.getChunk(cx, cz)) return;

    const forwardInput = controlsLocked
      ? ((this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
         (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0))
      : 0;
    const strafeInput = controlsLocked
      ? ((this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
         (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0))
      : 0;

    const jumpHeld = controlsLocked && this.keys.has('Space');
    const shiftHeld = controlsLocked && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'));
    const ctrlHeld = controlsLocked && (this.keys.has('ControlLeft') || this.keys.has('ControlRight'));

    if (ctrlHeld && forwardInput > 0 && !shiftHeld && this.hunger > 4) {
      this.sprinting = true;
    }
    if (forwardInput <= 0 || shiftHeld || this.hunger <= 4) {
      this.sprinting = false;
    }
    this.sneaking = shiftHeld && !this.flying;

    // Movement basis vectors in XZ plane
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    let moveX = -sinY * forwardInput + cosY * strafeInput;
    let moveZ = -cosY * forwardInput - sinY * strafeInput;
    const moveLen = Math.hypot(moveX, moveZ);
    if (moveLen > 1e-4) {
      moveX /= moveLen;
      moveZ /= moveLen;
    }

    // Water & Ground state check
    const feetBlock = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.15), Math.floor(this.pos.z));
    const torsoBlock = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.9), Math.floor(this.pos.z));
    const wasInWater = this.inWater;
    this.inWater = feetBlock === BLOCK.WATER || torsoBlock === BLOCK.WATER;

    if (this.inWater && !wasInWater && this.vel.y < -3.0) {
      sound.playSplash();
      particles.emitSplash(this.pos.x, this.pos.y + 0.2, this.pos.z, 14);
    }

    if (this.inWater || this.flying) {
      this._peakAirY = this.pos.y;
    }

    // Determine target horizontal velocity
    if (this.flying) {
      const fSpeed = (ctrlHeld || this.sprinting) ? FLY_SPRINT_SPEED : FLY_SPEED;
      const accel = Math.min(1, dt * 11.0);
      this.vel.x += (moveX * fSpeed - this.vel.x) * accel;
      this.vel.z += (moveZ * fSpeed - this.vel.z) * accel;

      let targetVy = 0;
      if (jumpHeld) targetVy += fSpeed * 0.8;
      if (shiftHeld) targetVy -= fSpeed * 0.8;
      this.vel.y += (targetVy - this.vel.y) * Math.min(1, dt * 12.0);
    } else if (this.inWater) {
      const accel = Math.min(1, dt * 8.0);
      this.vel.x += (moveX * SWIM_SPEED - this.vel.x) * accel;
      this.vel.z += (moveZ * SWIM_SPEED - this.vel.z) * accel;
      if (jumpHeld) {
        this.vel.y += (4.3 - this.vel.y) * Math.min(1, dt * 8.0);
      } else if (shiftHeld) {
        this.vel.y += (-3.4 - this.vel.y) * Math.min(1, dt * 6.0);
      } else {
        this.vel.y -= WATER_GRAVITY * dt;
        this.vel.y = Math.max(this.vel.y, -3.2);
      }
    } else {
      const underBlock = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.1), Math.floor(this.pos.z));
      const onIce = this.onGround && BLOCKS[underBlock]?.slippery;

      let speed = WALK_SPEED;
      if (this.sneaking) speed = SNEAK_SPEED;
      else if (this.sprinting) speed = SPRINT_SPEED;

      const responsiveness = this.onGround ? (onIce ? 2.6 : 16.0) : 5.5;
      const blend = Math.min(1, dt * responsiveness);
      this.vel.x += (moveX * speed - this.vel.x) * blend;
      this.vel.z += (moveZ * speed - this.vel.z) * blend;

      if (jumpHeld && this.onGround) {
        this.vel.y = JUMP_VELOCITY;
        this.onGround = false;
        this._exhaustion += 0.15;
      }

      this.vel.y -= GRAVITY * dt;
      if (this.vel.y < -48) this.vel.y = -48;
    }

    // Sub-stepped Swept AABB Collision
    const steps = Math.max(1, Math.ceil(dt / 0.02));
    const subDt = dt / steps;

    for (let s = 0; s < steps; s++) {
      // 1. Resolve Y
      const nextY = this.pos.y + this.vel.y * subDt;
      if (!this._collidesWorld(world, this.pos.x, nextY, this.pos.z)) {
        this.pos.y = nextY;
        this.onGround = false;
        if (this.pos.y > this._peakAirY) this._peakAirY = this.pos.y;
      } else {
        if (this.vel.y < 0) {
          // Landed on ground! Check fall damage
          const fallDist = this._peakAirY - this.pos.y;
          if (!this.flying && !this.inWater && fallDist > 3.6) {
            const dmg = Math.floor(fallDist - 3.2);
            if (dmg > 0) this.applyDamage(dmg, null, sound);
          }
          this.onGround = true;
          if (this.flying) this.flying = false; // Touching down exits creative flight naturally
        }
        this._peakAirY = this.pos.y;
        this.vel.y = 0;
      }

      // 2. Resolve X (with Sneak Ledge Guard!)
      let nextX = this.pos.x + this.vel.x * subDt;
      if (this.sneaking && this.onGround && !this._hasGroundSupport(world, nextX, this.pos.y, this.pos.z)) {
        nextX = this.pos.x;
        this.vel.x = 0;
      }
      if (!this._collidesWorld(world, nextX, this.pos.y, this.pos.z)) {
        this.pos.x = nextX;
      } else {
        this.vel.x = 0;
      }

      // 3. Resolve Z (with Sneak Ledge Guard!)
      let nextZ = this.pos.z + this.vel.z * subDt;
      if (this.sneaking && this.onGround && !this._hasGroundSupport(world, this.pos.x, this.pos.y, nextZ)) {
        nextZ = this.pos.z;
        this.vel.z = 0;
      }
      if (!this._collidesWorld(world, this.pos.x, this.pos.y, nextZ)) {
        this.pos.z = nextZ;
      } else {
        this.vel.z = 0;
      }
    }

    // Footsteps & exhaustion
    const movedHoriz = Math.hypot(this.vel.x, this.vel.z) * dt;
    if ((this.onGround || this.inWater) && movedHoriz > 0.001) {
      this._stepDistance += movedHoriz;
      this._exhaustion += movedHoriz * (this.sprinting ? 0.045 : 0.015);
      const stride = this.inWater ? 1.9 : this.sprinting ? 1.85 : 2.15;
      if (this._stepDistance >= stride) {
        this._stepDistance = 0;
        if (this.inWater) {
          sound.playStep('water');
        } else {
          const groundId = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.2), Math.floor(this.pos.z));
          sound.playStep(BLOCKS[groundId]?.sound || 'grass');
        }
      }
    }

    // Cactus prickle check
    this._cactusTimer -= dt;
    if (this._cactusTimer <= 0) {
      this._cactusTimer = 0.5;
      const bx = Math.floor(this.pos.x);
      const by = Math.floor(this.pos.y + 0.5);
      const bz = Math.floor(this.pos.z);
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (world.getBlock(bx + ox, by, bz + oz) === BLOCK.CACTUS) {
          const distEdge = Math.hypot((bx + ox + 0.5) - this.pos.x, (bz + oz + 0.5) - this.pos.z);
          if (distEdge < 0.88) {
            this.applyDamage(1, { x: -ox * 3, y: 2.5, z: -oz * 3 }, sound);
          }
        }
      }
    }
  }

  _updateVitals(dt) {
    if (this.gameMode !== GAME_MODES.SURVIVAL) return;

    if (this._exhaustion >= 4.0) {
      this._exhaustion -= 4.0;
      if (this.hunger > 0) {
        this.hunger = Math.max(0, this.hunger - 1);
        if (this.onVitalsChange) this.onVitalsChange();
      }
    }

    // Natural regeneration when well-fed
    if (this.hunger >= 16 && this.health < this.maxHealth && this.health > 0) {
      this._regenTimer += dt;
      if (this._regenTimer >= 3.5) {
        this._regenTimer = 0;
        this.health = Math.min(this.maxHealth, this.health + 1);
        this._exhaustion += 1.2;
        if (this.onVitalsChange) this.onVitalsChange();
      }
    } else {
      this._regenTimer = 0;
    }
  }

  _resetMining() {
    this._miningKey = '';
    this._miningProgress = 0;
    this.crackMesh.visible = false;
  }

  _computeMiningRate(blockDef, heldEntry) {
    if (!blockDef.breakable || blockDef.hardness === Infinity) return 0;
    if (blockDef.hardness <= 0.1) return 20.0; // Instant pop for flowers/tall grass/torches

    let speedMult = 1.0;
    const hasPreferred = heldEntry && heldEntry.toolType === blockDef.preferredTool;
    if (hasPreferred) {
      speedMult = heldEntry.miningSpeed || 2.0;
    }

    const meetsTier = !blockDef.minTier ||
      (heldEntry && heldEntry.toolType === blockDef.preferredTool && heldEntry.toolTier >= blockDef.minTier);

    const baseTime = meetsTier ? (blockDef.hardness * 1.15) / speedMult : (blockDef.hardness * 3.6) / speedMult;
    return 1.0 / Math.max(0.08, baseTime);
  }

  _canHarvestDrops(blockDef, heldEntry) {
    if (!blockDef.minTier) return true;
    return Boolean(heldEntry && heldEntry.toolType === blockDef.preferredTool && heldEntry.toolTier >= blockDef.minTier);
  }

  _updateTargetingAndActions(dt, world, viewModel, itemDrops, particles, sound, mobManager, tntManager, skyWeather) {
    const origin = this.camera.position;
    const dir = this.getLookDirection();

    const hit = world.raycast(origin, dir, REACH_DISTANCE, false);
    const mobHit = mobManager.raycastMob(origin, dir, 4.1);
    const mobCloser = mobHit && (!hit || mobHit.distance < hit.distance);

    this.targetBlock = (!mobCloser && hit) ? hit : null;

    this.interactionPrompt = '';
    if (this.targetBlock) {
      const bId = this.targetBlock.blockId;
      const h = this._blockBoxHeight(bId);
      this.selectionBox.visible = true;
      this.selectionBox.scale.set(1, h, 1);
      this.selectionBox.position.set(
        this.targetBlock.x + 0.5,
        this.targetBlock.y + h * 0.5,
        this.targetBlock.z + 0.5
      );

      if (!this.sneaking) {
        if (bId === BLOCK.CRAFTING_TABLE) this.interactionPrompt = 'Right-Click · Open Crafting Table';
        else if (bId === BLOCK.FURNACE || bId === BLOCK.FURNACE_LIT) this.interactionPrompt = 'Right-Click · Open Furnace';
        else if (bId === BLOCK.CHEST) this.interactionPrompt = 'Right-Click · Open Chest';
        else if (bId === BLOCK.BED_BLOCK) this.interactionPrompt = 'Right-Click · Rest / Set Spawn';
        else if (bId === BLOCK.TNT) this.interactionPrompt = 'Right-Click · Ignite TNT';
      }
    } else {
      this.selectionBox.visible = false;
    }

    // LEFT CLICK: Attack mob OR Mine block
    if (this.mouseLeftDown) {
      if (mobCloser) {
        this._resetMining();
        if (this._attackCooldown <= 0) {
          this._attackCooldown = 0.38;
          viewModel.triggerSwing();
          sound.playSwing();
          const held = this.inventory.getHeldEntry();
          const dmg = held?.attackDamage || 2;
          mobManager.hitMob(mobHit.mob, dmg, { x: dir.x, z: dir.z }, itemDrops, particles, sound);
          if (held?.maxDurability) {
            if (this.inventory.damageHeldTool(1, this.gameMode)) sound.playToolBreak();
          }
          this._exhaustion += 0.2;
        }
      } else if (this.targetBlock) {
        const tb = this.targetBlock;
        const bDef = BLOCKS[tb.blockId];
        if (this.gameMode === GAME_MODES.CREATIVE) {
          if (this._creativeBreakCooldown <= 0) {
            this._creativeBreakCooldown = 0.18;
            viewModel.triggerSwing();
            particles.emitBlockBreak(tb.x, tb.y, tb.z, tb.blockId, 18);
            sound.playBreak(bDef.sound);
            world.setBlock(tb.x, tb.y, tb.z, BLOCK.AIR, true, true);
          }
        } else if (bDef && bDef.breakable) {
          const key = `${tb.x},${tb.y},${tb.z}`;
          if (key !== this._miningKey) {
            this._miningKey = key;
            this._miningProgress = 0;
          }

          const heldEntry = this.inventory.getHeldEntry();
          const rate = this._computeMiningRate(bDef, heldEntry);
          this._miningProgress += rate * dt;
          viewModel.triggerSwing();

          this._digEffectTimer -= dt;
          if (this._digEffectTimer <= 0) {
            this._digEffectTimer = 0.19;
            sound.playDig(bDef.sound);
            particles.emitBlockChip(tb.hitPos, tb.normal, tb.blockId);
          }

          if (this._miningProgress >= 1.0) {
            // Break block!
            particles.emitBlockBreak(tb.x, tb.y, tb.z, tb.blockId, 24);
            sound.playBreak(bDef.sound);
            const canDrop = this._canHarvestDrops(bDef, heldEntry);
            world.setBlock(tb.x, tb.y, tb.z, BLOCK.AIR, true, true);

            if (canDrop) {
              const drops = bDef.drop ? bDef.drop() : [{ id: tb.blockId, count: 1 }];
              for (const d of drops) {
                if (d.count > 0) {
                  itemDrops.spawnDrop(tb.x + 0.5, tb.y + 0.45, tb.z + 0.5, d.id, d.count);
                }
              }
            } else if (this.onToast) {
              this.onToast(`Requires a ${bDef.minTier >= 3 ? 'Iron' : bDef.minTier >= 2 ? 'Stone' : 'Wooden'} Pickaxe to harvest`);
            }

            if (heldEntry?.maxDurability) {
              if (this.inventory.damageHeldTool(1, this.gameMode)) {
                sound.playToolBreak();
                if (this.onToast) this.onToast(`${heldEntry.name} broke!`);
              }
            }

            this._exhaustion += 0.08;
            this._resetMining();
          } else {
            const stage = Math.min(9, Math.floor(this._miningProgress * 10));
            const h = this._blockBoxHeight(tb.blockId);
            this.crackMat.map = this.atlas.crackTextures[stage];
            this.crackMat.needsUpdate = true;
            this.crackMesh.scale.set(1, h, 1);
            this.crackMesh.position.set(tb.x + 0.5, tb.y + h * 0.5, tb.z + 0.5);
            this.crackMesh.visible = true;
          }
        } else {
          this._resetMining();
        }
      } else {
        this._resetMining();
        if (this._attackCooldown <= 0) {
          this._attackCooldown = 0.35;
          viewModel.triggerSwing();
          sound.playSwing();
        }
      }
    } else {
      this._resetMining();
    }

    // RIGHT CLICK: Interact, Use Bucket/Food/Flint, or Place Block
    if (this.mouseRightDown && this._placeCooldown <= 0) {
      this._placeCooldown = 0.23;
      this._handleRightClick(origin, dir, world, viewModel, particles, sound, mobManager, tntManager, skyWeather);
    }
  }

  _handleRightClick(origin, dir, world, viewModel, particles, sound, mobManager, tntManager, skyWeather) {
    const heldSlot = this.inventory.getHeldSlot();
    const heldEntry = this.inventory.getHeldEntry();

    // 1. Interactive world blocks (when not sneaking)
    if (this.targetBlock && !this.sneaking) {
      const tb = this.targetBlock;
      if (tb.blockId === BLOCK.CRAFTING_TABLE) {
        this.mouseRightDown = false;
        if (this.onOpenCraftingTable) this.onOpenCraftingTable();
        return;
      }
      if (tb.blockId === BLOCK.FURNACE || tb.blockId === BLOCK.FURNACE_LIT) {
        this.mouseRightDown = false;
        if (this.onOpenFurnace) this.onOpenFurnace(tb.x, tb.y, tb.z);
        return;
      }
      if (tb.blockId === BLOCK.CHEST) {
        this.mouseRightDown = false;
        if (this.onOpenChest) this.onOpenChest(tb.x, tb.y, tb.z);
        return;
      }
      if (tb.blockId === BLOCK.BED_BLOCK) {
        this.mouseRightDown = false;
        this.spawnPoint = { x: tb.x + 0.5, y: tb.y + 1.0, z: tb.z + 0.5 };
        if (skyWeather.canSleepNow()) {
          skyWeather.sleepToMorning();
          this.health = Math.min(this.maxHealth, this.health + 6);
          if (this.onVitalsChange) this.onVitalsChange();
          if (this.onToast) this.onToast('Rested until sunrise — Respawn point set');
        } else {
          if (this.onToast) this.onToast('Respawn point set (you can sleep at dusk or night)');
        }
        sound.playPlace('cloth');
        return;
      }
      if (tb.blockId === BLOCK.TNT) {
        this.mouseRightDown = false;
        viewModel.triggerSwing();
        tntManager.igniteAt(tb.x, tb.y, tb.z, world, sound);
        if (heldEntry?.id === ITEM.FLINT_AND_STEEL) {
          this.inventory.damageHeldTool(1, this.gameMode);
        }
        return;
      }
    }

    if (!heldSlot || !heldEntry) return;

    // 2. Empty Bucket -> Scoop Water
    if (heldEntry.id === ITEM.BUCKET) {
      const waterHit = world.raycast(origin, dir, REACH_DISTANCE, true);
      if (waterHit && waterHit.blockId === BLOCK.WATER) {
        world.setBlock(waterHit.x, waterHit.y, waterHit.z, BLOCK.AIR, true, true);
        sound.playSplash();
        viewModel.triggerSwing();
        if (this.gameMode === GAME_MODES.SURVIVAL) {
          this.inventory.consumeHeld(1, this.gameMode);
          this.inventory.addItem(ITEM.WATER_BUCKET, 1);
        }
        return;
      }
    }

    // 3. Water Bucket -> Place Water source
    if (heldEntry.id === ITEM.WATER_BUCKET && this.targetBlock) {
      const tb = this.targetBlock;
      const px = tb.x + tb.normal.x;
      const py = tb.y + tb.normal.y;
      const pz = tb.z + tb.normal.z;
      const cur = world.getBlock(px, py, pz);
      if (cur === BLOCK.AIR || BLOCKS[cur]?.replaceable) {
        world.setBlock(px, py, pz, BLOCK.WATER, true, true);
        sound.playSplash();
        particles.emitSplash(px + 0.5, py + 0.5, pz + 0.5, 10);
        viewModel.triggerSwing();
        if (this.gameMode === GAME_MODES.SURVIVAL) {
          this.inventory.slots[this.inventory.selectedHotbar] = { id: ITEM.BUCKET, count: 1 };
          this.inventory.notify();
        }
        return;
      }
    }

    // 4. Food consumption
    if (heldEntry.foodRestore > 0) {
      if (this.gameMode === GAME_MODES.SURVIVAL && this.hunger < this.maxHunger) {
        this.hunger = Math.min(this.maxHunger, this.hunger + heldEntry.foodRestore);
        this.inventory.consumeHeld(1, this.gameMode);
        sound.playEat();
        viewModel.triggerSwing();
        if (this.onVitalsChange) this.onVitalsChange();
        return;
      } else if (this.gameMode === GAME_MODES.SURVIVAL && !heldEntry.isBlock) {
        if (this.onToast) this.onToast('Hunger is already full');
        return;
      }
    }

    // 5. Place Block
    if (heldEntry.isBlock && this.targetBlock) {
      const tb = this.targetBlock;
      const clickedDef = BLOCKS[tb.blockId];

      // Replace tall grass directly if clicked, otherwise place on hit normal face
      let px = tb.x + tb.normal.x;
      let py = tb.y + tb.normal.y;
      let pz = tb.z + tb.normal.z;
      if (clickedDef?.replaceable && tb.blockId !== BLOCK.WATER) {
        px = tb.x; py = tb.y; pz = tb.z;
      }

      if (py < 0 || py >= 95) return;
      const existing = world.getBlock(px, py, pz);
      if (existing !== BLOCK.AIR && !BLOCKS[existing]?.replaceable) return;

      const placeDef = BLOCKS[heldEntry.id];
      // Require solid ground below flora/torches/beds
      if (placeDef.shape === BLOCK_SHAPES.CROSS || heldEntry.id === BLOCK.TORCH || heldEntry.id === BLOCK.BED_BLOCK) {
        if (!BLOCKS[world.getBlock(px, py - 1, pz)]?.solid) return;
      }

      // Prevent placing solid block overlapping player or mob AABB
      if (placeDef.solid) {
        const hw = PLAYER_WIDTH * 0.5 - 0.02;
        const pMinX = this.pos.x - hw, pMaxX = this.pos.x + hw;
        const pMinY = this.pos.y + 0.01, pMaxY = this.pos.y + PLAYER_HEIGHT - 0.01;
        const pMinZ = this.pos.z - hw, pMaxZ = this.pos.z + hw;
        const blockTop = py + this._blockBoxHeight(heldEntry.id);

        const overlapsPlayer = (
          px + 1 > pMinX && px < pMaxX &&
          blockTop > pMinY && py < pMaxY &&
          pz + 1 > pMinZ && pz < pMaxZ
        );
        if (overlapsPlayer) return;
        if (mobManager.intersectsAnyMob(px, py, pz)) return;
      }

      if (world.setBlock(px, py, pz, heldEntry.id, true, true)) {
        viewModel.triggerSwing();
        sound.playPlace(placeDef.sound);
        this.inventory.consumeHeld(1, this.gameMode);
      }
    }
  }

  serialize() {
    return {
      pos: { x: this.pos.x, y: this.pos.y, z: this.pos.z },
      yaw: this.yaw,
      pitch: this.pitch,
      health: this.health,
      hunger: this.hunger,
      flying: this.flying,
      spawnPoint: { ...this.spawnPoint },
      inventory: this.inventory.serialize(),
    };
  }

  restore(data) {
    if (!data) return;
    if (data.pos) this.pos.set(data.pos.x, data.pos.y, data.pos.z);
    this._peakAirY = this.pos.y;
    this.yaw = data.yaw ?? 0;
    this.pitch = data.pitch ?? -0.12;
    this.health = data.health ?? 20;
    this.hunger = data.hunger ?? 20;
    this.flying = Boolean(data.flying && this.gameMode === GAME_MODES.CREATIVE);
    if (data.spawnPoint) this.spawnPoint = { ...data.spawnPoint };
    if (data.inventory) this.inventory.restore(data.inventory);
    if (this.onVitalsChange) this.onVitalsChange();
  }
}
