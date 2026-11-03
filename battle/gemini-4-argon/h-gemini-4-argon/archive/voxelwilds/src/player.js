import * as THREE from 'three';
import {
  GRAVITY,
  JUMP_VELOCITY,
  SWIM_UP_ACCEL,
  WATER_DRAG,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_EYE_HEIGHT,
  PLAYER_SNEAK_EYE_HEIGHT,
  WALK_SPEED,
  SPRINT_SPEED,
  SNEAK_SPEED,
  FLY_SPEED,
  REACH_DISTANCE,
  GAME_MODES,
  CHUNK_HEIGHT,
} from './constants.js';
import { BLOCK, getBlockDef, isSolidBlock, isWaterBlock } from './blocks.js';

export class PlayerController {
  constructor({
    camera,
    scene,
    domElement,
    world,
    inventory,
    entities,
    particles,
    sound,
    textures,
    materials,
    onOpenStation,
    onStatsChange,
    onPlayerDeath,
  }) {
    this.camera = camera;
    this.scene = scene;
    this.domElement = domElement;
    this.world = world;
    this.inventory = inventory;
    this.entities = entities;
    this.particles = particles;
    this.sound = sound;
    this.textures = textures;
    this.materials = materials;
    this.onOpenStation = onOpenStation;
    this.onStatsChange = onStatsChange;
    this.onPlayerDeath = onPlayerDeath;

    this.scene.add(this.camera);

    this.position = new THREE.Vector3(0.5, 45, 0.5);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.spawnPoint = new THREE.Vector3(0.5, 45, 0.5);

    this.yaw = 0;
    this.pitch = -0.12;
    this.baseFov = 75;

    this.gameMode = GAME_MODES.SURVIVAL;
    this.flying = false;
    this.onGround = false;
    this.inWater = false;
    this.headUnderwater = false;
    this.sneaking = false;
    this.sprinting = false;

    this.maxHealth = 20;
    this.health = 20;
    this.maxOxygen = 10;
    this.oxygen = 10;
    this.hurtFlash = 0;
    this.regenTimer = 0;
    this.drownTimer = 0;
    this.cactusTimer = 0;
    this.highestAirY = 45;

    this.keys = new Set();
    this.mouseDownLeft = false;
    this.mouseDownRight = false;
    this.draggingLook = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.controlsEnabled = false;
    this.lastSpacePress = 0;
    this.lastWPress = 0;

    // Mining & interaction state
    this.targetedHit = null;
    this.miningKey = '';
    this.breakProgress = 0;
    this.chipTimer = 0;
    this.creativeBreakCooldown = 0;
    this.placeCooldown = 0;
    this.attackCooldown = 0;

    // Walk bob & hand swing
    this.walkDistance = 0;
    this.stepSoundDist = 0;
    this.swingProgress = 0;
    this.swinging = false;
    this.currentHeldId = -999;

    // 3D Target Wireframe Highlight + Break Overlay Cube
    const wireGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.008, 1.008, 1.008));
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x11151c,
      transparent: true,
      opacity: 0.72,
    });
    this.highlightMesh = new THREE.LineSegments(wireGeom, wireMat);
    this.highlightMesh.visible = false;
    this.scene.add(this.highlightMesh);

    const crackGeom = new THREE.BoxGeometry(1.012, 1.012, 1.012);
    this.crackMat = new THREE.MeshBasicMaterial({
      color: 0x141414,
      transparent: true,
      opacity: 0,
      wireframe: false,
      depthWrite: false,
    });
    this.crackOverlay = new THREE.Mesh(crackGeom, this.crackMat);
    this.crackOverlay.visible = false;
    this.scene.add(this.crackOverlay);

    // Dynamic point light for entity/hand illumination when holding a torch or lantern
    this.heldEntityLight = new THREE.PointLight(0xffb34f, 0, 14, 1.4);
    this.heldEntityLight.position.set(0.3, -0.15, -0.4);
    this.camera.add(this.heldEntityLight);

    // First-person held item rig attached to camera
    this.handPivot = new THREE.Group();
    this.handPivot.position.set(0.42, -0.36, -0.58);
    this.camera.add(this.handPivot);
    this.handMeshGroup = new THREE.Group();
    this.handPivot.add(this.handMeshGroup);
    this.rebuildHeldRig();

    this.bindEvents();
  }

  setWorld(world, spawn) {
    this.world = world;
    if (spawn) {
      this.spawnPoint.set(spawn.x, spawn.y, spawn.z);
      this.position.copy(this.spawnPoint);
      this.highestAirY = spawn.y;
    }
    this.velocity.set(0, 0, 0);
  }

  setGameMode(mode) {
    this.gameMode = mode;
    this.inventory.setMode(mode);
    if (mode === GAME_MODES.SURVIVAL) {
      this.flying = false;
    } else {
      this.health = this.maxHealth;
      this.oxygen = this.maxOxygen;
    }
    this.onStatsChange?.();
  }

  notifyInventoryChange() {
    this.rebuildHeldRig(true);
    this.onStatsChange?.();
  }

  bindEvents() {
    this._onKeyDown = (e) => {
      if (!this.controlsEnabled) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      if (!e.repeat) {
        const now = performance.now();
        if (e.code === 'Space' && this.gameMode === GAME_MODES.CREATIVE) {
          if (now - this.lastSpacePress < 290) {
            this.flying = !this.flying;
            this.velocity.y = 0;
            this.highestAirY = this.position.y;
            this.onStatsChange?.();
          }
          this.lastSpacePress = now;
        }
        if (e.code === 'KeyF' && this.gameMode === GAME_MODES.CREATIVE) {
          this.flying = !this.flying;
          this.velocity.y = 0;
          this.highestAirY = this.position.y;
          this.onStatsChange?.();
        }
        if (e.code === 'KeyW') {
          if (now - this.lastWPress < 260) {
            this.sprinting = true;
          }
          this.lastWPress = now;
        }
        if (e.code.startsWith('Digit')) {
          const num = parseInt(e.code.slice(5), 10);
          if (num >= 1 && num <= 9) {
            this.inventory.selectHotbar(num - 1);
            this.rebuildHeldRig();
            this.onStatsChange?.();
          }
        }
      }

      this.keys.add(e.code);
    };

    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyW') {
        this.sprinting = false;
      }
    };

    this._onMouseMove = (e) => {
      if (!this.controlsEnabled) return;
      const sens = 0.0022;
      if (document.pointerLockElement === this.domElement) {
        this.yaw -= e.movementX * sens;
        this.pitch -= e.movementY * sens;
        this.pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, this.pitch));
      } else if (this.draggingLook) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.yaw -= dx * sens * 1.3;
        this.pitch -= dy * sens * 1.3;
        this.pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, this.pitch));
      }
    };

    this._onMouseDown = (e) => {
      if (!this.controlsEnabled) return;
      this.sound.unlock();

      if (document.pointerLockElement !== this.domElement && this.domElement.requestPointerLock) {
        try {
          const p = this.domElement.requestPointerLock();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch {
          // Ignore pointer lock rejection in automated/sandboxed environments
        }
      }

      if (e.button === 0) {
        this.mouseDownLeft = true;
        this.draggingLook = document.pointerLockElement !== this.domElement;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.handlePrimaryAttackOrClick();
      } else if (e.button === 2) {
        this.mouseDownRight = true;
        this.handleSecondaryAction();
      }
    };

    this._onMouseUp = (e) => {
      if (e.button === 0) {
        this.mouseDownLeft = false;
        this.draggingLook = false;
        this.resetMining();
      } else if (e.button === 2) {
        this.mouseDownRight = false;
      }
    };

    this._onWheel = (e) => {
      if (!this.controlsEnabled) return;
      if (Math.abs(e.deltaY) > 0) {
        this.inventory.stepHotbar(e.deltaY > 0 ? 1 : -1);
        this.rebuildHeldRig();
        this.onStatsChange?.();
      }
    };

    this._onContextMenu = (e) => {
      if (this.controlsEnabled) e.preventDefault();
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    this.domElement.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('wheel', this._onWheel, { passive: true });
    this.domElement.addEventListener('contextmenu', this._onContextMenu);
  }

  setControlsEnabled(enabled) {
    this.controlsEnabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.mouseDownLeft = false;
      this.mouseDownRight = false;
      this.draggingLook = false;
      this.resetMining();
    }
  }

  triggerSwing() {
    this.swinging = true;
    this.swingProgress = 0;
  }

  rebuildHeldRig(force = false) {
    const slot = this.inventory.getSelectedSlot();
    const heldId = slot ? slot.id : 0;
    if (!force && heldId === this.currentHeldId) return;
    this.currentHeldId = heldId;

    while (this.handMeshGroup.children.length > 0) {
      const child = this.handMeshGroup.children.pop();
      child.geometry?.dispose();
      child.material?.dispose();
    }

    if (heldId === 0) {
      // Friendly voxel player hand/forearm
      const armGeom = new THREE.BoxGeometry(0.18, 0.48, 0.18);
      const armMat = new THREE.MeshLambertMaterial({ color: 0xe3af8a });
      const arm = new THREE.Mesh(armGeom, armMat);
      arm.rotation.set(0.75, 0.32, -0.24);
      arm.position.set(0.08, -0.06, 0.04);
      this.handMeshGroup.add(arm);
      return;
    }

    const def = getBlockDef(heldId);
    if (def.isBlock && def.renderType !== 'cross' && def.renderType !== 'torch') {
      const geom = new THREE.BoxGeometry(0.32, 0.32, 0.32);
      const uvAttr = geom.attributes.uv;
      const dirs = ['east', 'west', 'top', 'bottom', 'south', 'north'];
      for (let f = 0; f < 6; f++) {
        const uv = this.textures.getBlockFaceUVs(heldId, dirs[f]);
        const base = f * 4;
        uvAttr.setXY(base + 0, uv.u0, uv.v1);
        uvAttr.setXY(base + 1, uv.u1, uv.v1);
        uvAttr.setXY(base + 2, uv.u0, uv.v0);
        uvAttr.setXY(base + 3, uv.u1, uv.v0);
      }
      uvAttr.needsUpdate = true;
      const mat =
        def.lightLevel > 0
          ? new THREE.MeshBasicMaterial({ map: this.textures.atlasTexture })
          : new THREE.MeshLambertMaterial({ map: this.textures.atlasTexture });
      const cube = new THREE.Mesh(geom, mat);
      cube.rotation.set(0.24, -0.68, 0.08);
      this.handMeshGroup.add(cube);
      return;
    }

    // Held Tool / Torch / Flora / Food rendered as crisp voxelized pixel mesh
    const srcCanvas = def.isBlock
      ? this.textures.getTileCanvas(def.textures.all)
      : this.textures.getItemCanvas(heldId);

    if (srcCanvas) {
      const ctx = srcCanvas.getContext('2d');
      const img = ctx.getImageData(0, 0, 16, 16).data;
      const pxSize = 0.024;
      const boxes = [];

      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const o = (y * 16 + x) * 4;
          if (img[o + 3] > 60) {
            boxes.push({
              x: (x - 8) * pxSize,
              y: (8 - y) * pxSize,
              r: img[o] / 255,
              g: img[o + 1] / 255,
              b: img[o + 2] / 255,
            });
          }
        }
      }

      if (boxes.length > 0) {
        const instGeom = new THREE.BoxGeometry(pxSize * 1.02, pxSize * 1.02, 0.042);
        const instMat =
          def.lightLevel > 0
            ? new THREE.MeshBasicMaterial({ color: 0xffffff })
            : new THREE.MeshLambertMaterial({ color: 0xffffff });
        const inst = new THREE.InstancedMesh(instGeom, instMat, boxes.length);
        const dummy = new THREE.Object3D();
        const col = new THREE.Color();

        boxes.forEach((b, idx) => {
          dummy.position.set(b.x, b.y, 0);
          dummy.updateMatrix();
          inst.setMatrixAt(idx, dummy.matrix);
          col.setRGB(b.r, b.g, b.b);
          inst.setColorAt(idx, col);
        });
        inst.rotation.set(0.12, -0.75, -0.18);
        this.handMeshGroup.add(inst);
      }
    }
  }

  getEyePosition(out = new THREE.Vector3()) {
    const eyeH = this.sneaking && !this.flying ? PLAYER_SNEAK_EYE_HEIGHT : PLAYER_EYE_HEIGHT;
    return out.set(this.position.x, this.position.y + eyeH, this.position.z);
  }

  getLookDirection(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(
      -Math.sin(this.yaw) * cp,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cp
    ).normalize();
  }

  handlePrimaryAttackOrClick() {
    this.triggerSwing();
    if (this.attackCooldown > 0) return;

    const origin = this.getEyePosition();
    const dir = this.getLookDirection();

    // Check melee hit against nearby mobs first
    const hitMob = this.entities.raycastMob(origin, dir, 4.1);
    if (hitMob && (!this.targetedHit || origin.distanceTo(new THREE.Vector3(hitMob.x, hitMob.y + 0.5, hitMob.z)) < this.targetedHit.distance + 0.6)) {
      this.attackCooldown = 0.34;
      this.sound.playSwing();
      const slot = this.inventory.getSelectedSlot();
      const def = slot ? getBlockDef(slot.id) : null;
      let dmg = def?.attackDamage || 2;
      // Critical jump bonus
      if (!this.onGround && this.velocity.y < -0.5) dmg = Math.round(dmg * 1.4);

      this.entities.damageMob(hitMob, dmg, dir.x, dir.z);
      if (def?.maxDurability) {
        const res = this.inventory.damageSelectedTool(1);
        if (res === 'broke') this.sound.playBreakBlock('wood');
        this.rebuildHeldRig(true);
        this.onStatsChange?.();
      }
      return;
    }
  }

  handleSecondaryAction() {
    if (this.placeCooldown > 0) return;

    // 1. Interactive station check (Crafting Table or Furnace)
    if (this.targetedHit && !this.sneaking) {
      const targetDef = this.targetedHit.def;
      if (targetDef.interactive === 'crafting' || targetDef.interactive === 'furnace') {
        this.onOpenStation?.(targetDef.interactive);
        return;
      }
    }

    const slot = this.inventory.getSelectedSlot();
    if (!slot) return;
    const heldDef = getBlockDef(slot.id);

    // 2. Eating food to restore health in Survival
    if (heldDef.foodHeal && this.gameMode === GAME_MODES.SURVIVAL) {
      if (this.health < this.maxHealth) {
        this.health = Math.min(this.maxHealth, this.health + heldDef.foodHeal);
        this.inventory.consumeSelected(1);
        this.sound.playEat();
        this.triggerSwing();
        this.rebuildHeldRig(true);
        this.onStatsChange?.();
        this.placeCooldown = 0.25;
      }
      return;
    }

    // 3. Block Placement
    if (!heldDef.isBlock || !this.targetedHit) return;

    const { placeX, placeY, placeZ } = this.targetedHit;
    if (placeY <= 0 || placeY >= CHUNK_HEIGHT) return;

    const existing = this.world.getBlock(placeX, placeY, placeZ);
    const existingDef = getBlockDef(existing);
    if (existing !== BLOCK.AIR && existing !== BLOCK.WATER && !existingDef.replaceable) return;

    // Torches & flora need solid support below (or adjacent wall for torch, let's check support)
    if (heldDef.renderType === 'cross') {
      const below = this.world.getBlock(placeX, placeY - 1, placeZ);
      if (below !== BLOCK.GRASS && below !== BLOCK.DIRT && below !== BLOCK.SNOW_GRASS && below !== BLOCK.SAND) {
        return;
      }
    }

    // Prevent placing a solid block overlapping the player's own body AABB
    if (heldDef.solid) {
      const hw = PLAYER_WIDTH * 0.5 - 0.02;
      const pMinX = this.position.x - hw;
      const pMaxX = this.position.x + hw;
      const pMinY = this.position.y + 0.01;
      const pMaxY = this.position.y + PLAYER_HEIGHT - 0.02;
      const pMinZ = this.position.z - hw;
      const pMaxZ = this.position.z + hw;

      const overlaps =
        pMaxX > placeX &&
        pMinX < placeX + 1 &&
        pMaxY > placeY &&
        pMinY < placeY + 1 &&
        pMaxZ > placeZ &&
        pMinZ < placeZ + 1;

      if (overlaps) return;
    }

    if (this.world.setBlock(placeX, placeY, placeZ, slot.id)) {
      this.sound.playPlaceBlock(heldDef.soundType);
      this.inventory.consumeSelected(1);
      this.triggerSwing();
      this.rebuildHeldRig(true);
      this.onStatsChange?.();
      this.placeCooldown = 0.18;
    }
  }

  resetMining() {
    this.miningKey = '';
    this.breakProgress = 0;
    this.crackOverlay.visible = false;
  }

  getMiningSpeedInfo(targetDef) {
    const slot = this.inventory.getSelectedSlot();
    const heldDef = slot ? getBlockDef(slot.id) : null;

    let speedMult = 1.0;
    let canHarvest = true;

    if (targetDef.minTier > 0) {
      const hasValidTool =
        heldDef &&
        heldDef.toolType === targetDef.preferredTool &&
        (heldDef.toolTier || 0) >= targetDef.minTier;
      canHarvest = Boolean(hasValidTool);
    }

    if (heldDef && heldDef.toolType && heldDef.toolType === targetDef.preferredTool) {
      speedMult = heldDef.miningSpeed || 2.0;
    } else if (!canHarvest) {
      speedMult = 0.35; // Slower mining without proper pickaxe tier
    }

    return { speedMult, canHarvest };
  }

  updateMining(dt) {
    if (this.creativeBreakCooldown > 0) this.creativeBreakCooldown -= dt;

    if (!this.mouseDownLeft || !this.targetedHit) {
      this.resetMining();
      return;
    }

    const { x, y, z, nx, ny, nz, blockId, def } = this.targetedHit;
    const key = `${x},${y},${z},${blockId}`;

    // Creative Mode instant break with comfortable repeat rate
    if (this.gameMode === GAME_MODES.CREATIVE) {
      if (this.creativeBreakCooldown <= 0) {
        this.creativeBreakCooldown = 0.17;
        this.world.setBlock(x, y, z, BLOCK.AIR);
        this.particles.spawnBlockBreak(x, y, z, blockId);
        this.sound.playBreakBlock(def.soundType);
        this.triggerSwing();
      }
      return;
    }

    // Survival Mode progressive mining
    if (!Number.isFinite(def.hardness)) {
      this.resetMining();
      return;
    }

    if (this.miningKey !== key) {
      this.miningKey = key;
      this.breakProgress = 0;
      this.chipTimer = 0;
    }

    const { speedMult, canHarvest } = this.getMiningSpeedInfo(def);
    const duration = Math.max(0.05, def.hardness / speedMult);
    this.breakProgress += dt / duration;

    // Continuous hand swing & chip particles
    if (!this.swinging) this.triggerSwing();
    this.chipTimer += dt;
    if (this.chipTimer >= 0.16) {
      this.chipTimer = 0;
      this.particles.spawnBlockChip(x, y, z, nx, ny, nz, blockId);
      this.sound.playHitBlock(def.soundType);
    }

    this.crackOverlay.visible = true;
    this.crackOverlay.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.crackMat.opacity = Math.min(0.52, this.breakProgress * 0.52);

    if (this.breakProgress >= 1.0) {
      this.world.setBlock(x, y, z, BLOCK.AIR);
      this.particles.spawnBlockBreak(x, y, z, blockId);
      this.sound.playBreakBlock(def.soundType);

      if (canHarvest) {
        const dropInfo = typeof def.drop === 'function' ? def.drop() : { id: blockId, count: 1 };
        if (dropInfo && dropInfo.id) {
          this.entities.spawnDrop(x + 0.5, y + 0.45, z + 0.5, dropInfo.id, dropInfo.count || 1);
        }
      }

      const slot = this.inventory.getSelectedSlot();
      if (slot && getBlockDef(slot.id).maxDurability && def.hardness > 0.1) {
        const res = this.inventory.damageSelectedTool(1);
        if (res === 'broke') this.sound.playBreakBlock('wood');
        this.rebuildHeldRig(true);
      }

      this.resetMining();
      this.onStatsChange?.();
    }
  }

  takeDamage(amount, knockX = 0, knockZ = 0) {
    if (this.gameMode === GAME_MODES.CREATIVE || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtFlash = 0.35;
    this.regenTimer = 6.0;
    this.sound.playHurt();

    if (knockX !== 0 || knockZ !== 0) {
      this.velocity.x += knockX * 5.2;
      this.velocity.z += knockZ * 5.2;
      this.velocity.y = Math.max(this.velocity.y, 4.0);
    }

    this.onStatsChange?.();
    if (this.health <= 0) {
      this.onPlayerDeath?.();
    }
  }

  respawn() {
    const safe = this.world.findSafeSpawn(this.spawnPoint.x, this.spawnPoint.z);
    this.position.set(safe.x, safe.y, safe.z);
    this.velocity.set(0, 0, 0);
    this.highestAirY = safe.y;
    this.health = this.maxHealth;
    this.oxygen = this.maxOxygen;
    this.hurtFlash = 0;
    this.onStatsChange?.();
  }

  collidesAt(x, y, z) {
    const hw = PLAYER_WIDTH * 0.5;
    const minX = Math.floor(x - hw);
    const maxX = Math.floor(x + hw);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + PLAYER_HEIGHT - 0.001);
    const minZ = Math.floor(z - hw);
    const maxZ = Math.floor(z + hw);

    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (isSolidBlock(this.world.getBlock(bx, by, bz))) {
            return true;
          }
        }
      }
    }
    return false;
  }

  hasGroundSupportAt(x, y, z) {
    const hw = PLAYER_WIDTH * 0.5;
    const checkY = Math.floor(y - 0.12);
    const minX = Math.floor(x - hw);
    const maxX = Math.floor(x + hw);
    const minZ = Math.floor(z - hw);
    const maxZ = Math.floor(z + hw);

    for (let bz = minZ; bz <= maxZ; bz++) {
      for (let bx = minX; bx <= maxX; bx++) {
        if (isSolidBlock(this.world.getBlock(bx, checkY, bz))) {
          return true;
        }
      }
    }
    return false;
  }

  stepPhysics(dt) {
    // Arrow keys camera rotation accessibility
    const turnSpeed = 2.1;
    if (this.keys.has('ArrowLeft')) this.yaw += turnSpeed * dt;
    if (this.keys.has('ArrowRight')) this.yaw -= turnSpeed * dt;
    if (this.keys.has('ArrowUp')) this.pitch = Math.min(Math.PI / 2 - 0.02, this.pitch + turnSpeed * 0.8 * dt);
    if (this.keys.has('ArrowDown')) this.pitch = Math.max(-Math.PI / 2 + 0.02, this.pitch - turnSpeed * 0.8 * dt);

    this.sneaking = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    if (this.keys.has('ControlLeft') || this.keys.has('ControlRight')) {
      if (this.keys.has('KeyW')) this.sprinting = true;
    }
    if (this.sneaking) this.sprinting = false;

    // Movement input vector on XZ plane
    let forward = 0;
    let strafe = 0;
    if (this.keys.has('KeyW')) forward += 1;
    if (this.keys.has('KeyS')) forward -= 1;
    if (this.keys.has('KeyD')) strafe += 1;
    if (this.keys.has('KeyA')) strafe -= 1;

    const len = Math.hypot(forward, strafe);
    if (len > 0) {
      forward /= len;
      strafe /= len;
    }

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const moveDirX = -sinY * forward + cosY * strafe;
    const moveDirZ = -cosY * forward - sinY * strafe;

    // Check water state
    const wasInWater = this.inWater;
    const waistBlock = this.world.getBlock(this.position.x, this.position.y + 0.55, this.position.z);
    const feetBlock = this.world.getBlock(this.position.x, this.position.y + 0.1, this.position.z);
    this.inWater = isWaterBlock(waistBlock) || isWaterBlock(feetBlock);

    const eyePos = this.getEyePosition();
    this.headUnderwater = isWaterBlock(this.world.getBlock(eyePos.x, eyePos.y, eyePos.z));

    if (!wasInWater && this.inWater && this.velocity.y < -4.5) {
      this.sound.playSplash();
      this.particles.spawnSplash(this.position.x, this.position.y + 0.4, this.position.z);
    }
    if (this.inWater || this.flying) {
      this.highestAirY = this.position.y;
    }

    // Target speed
    let targetSpeed = WALK_SPEED;
    if (this.flying) {
      targetSpeed = this.sprinting ? FLY_SPEED * 1.5 : FLY_SPEED;
    } else if (this.inWater) {
      targetSpeed = WALK_SPEED * 0.68;
    } else if (this.sneaking) {
      targetSpeed = SNEAK_SPEED;
    } else if (this.sprinting && forward > 0) {
      targetSpeed = SPRINT_SPEED;
    }

    const accel = this.flying ? 14 : this.onGround ? 18 : 7.5;
    this.velocity.x += (moveDirX * targetSpeed - this.velocity.x) * Math.min(1, accel * dt);
    this.velocity.z += (moveDirZ * targetSpeed - this.velocity.z) * Math.min(1, accel * dt);

    if (this.flying) {
      let climb = 0;
      if (this.keys.has('Space')) climb += 1;
      if (this.sneaking) climb -= 1;
      this.velocity.y += (climb * FLY_SPEED * 0.85 - this.velocity.y) * Math.min(1, 12 * dt);
    } else if (this.inWater) {
      this.velocity.y -= GRAVITY * 0.25 * dt;
      if (this.keys.has('Space')) {
        this.velocity.y += SWIM_UP_ACCEL * dt;
        // Assist stepping onto shore lip
        if (
          this.collidesAt(this.position.x + moveDirX * 0.4, this.position.y, this.position.z + moveDirZ * 0.4) &&
          !this.collidesAt(this.position.x + moveDirX * 0.4, this.position.y + 1.1, this.position.z + moveDirZ * 0.4)
        ) {
          this.velocity.y = Math.max(this.velocity.y, 6.2);
        }
      }
      this.velocity.y *= Math.pow(WATER_DRAG, dt * 10);
      this.velocity.y = Math.max(-5.5, Math.min(4.8, this.velocity.y));
    } else {
      this.velocity.y -= GRAVITY * dt;
      if (this.keys.has('Space') && this.onGround) {
        this.velocity.y = JUMP_VELOCITY;
        this.onGround = false;
      }
    }

    // Axis-separated AABB resolution
    // 1. X Axis (with Sneak Edge-Guard!)
    const nextX = this.position.x + this.velocity.x * dt;
    if (!this.collidesAt(nextX, this.position.y, this.position.z)) {
      if (this.onGround && this.sneaking && !this.flying && !this.hasGroundSupportAt(nextX, this.position.y, this.position.z)) {
        this.velocity.x = 0;
      } else {
        this.position.x = nextX;
      }
    } else {
      this.velocity.x = 0;
    }

    // 2. Z Axis (with Sneak Edge-Guard!)
    const nextZ = this.position.z + this.velocity.z * dt;
    if (!this.collidesAt(this.position.x, this.position.y, nextZ)) {
      if (this.onGround && this.sneaking && !this.flying && !this.hasGroundSupportAt(this.position.x, this.position.y, nextZ)) {
        this.velocity.z = 0;
      } else {
        this.position.z = nextZ;
      }
    } else {
      this.velocity.z = 0;
    }

    // 3. Y Axis + Fall damage detection
    const nextY = this.position.y + this.velocity.y * dt;
    if (!this.collidesAt(this.position.x, nextY, this.position.z)) {
      this.position.y = nextY;
      this.onGround = false;
      if (!this.inWater && !this.flying) {
        this.highestAirY = Math.max(this.highestAirY, this.position.y);
      }
    } else {
      if (this.velocity.y < 0) {
        // Landed on ground
        if (!this.onGround && !this.inWater && !this.flying && this.gameMode === GAME_MODES.SURVIVAL) {
          const fallDist = this.highestAirY - this.position.y;
          if (fallDist > 3.85) {
            const dmg = Math.floor(fallDist - 3.2);
            if (dmg > 0) this.takeDamage(dmg);
          }
        }
        this.position.y = Math.floor(nextY) + 1.0005;
        this.onGround = true;
        this.flying = false;
        this.highestAirY = this.position.y;
      } else if (this.velocity.y > 0) {
        // Hit ceiling
        this.position.y = Math.floor(nextY + PLAYER_HEIGHT) - PLAYER_HEIGHT - 0.001;
      }
      this.velocity.y = 0;
    }

    // Keep above void floor
    if (this.position.y < 1.05) {
      this.position.y = 1.05;
      this.velocity.y = 0;
      this.onGround = true;
    }

    // Footstep sounds & walk bobbing
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if ((this.onGround || this.inWater) && horizSpeed > 0.35 && !this.flying) {
      const stepDelta = horizSpeed * dt;
      this.walkDistance += stepDelta;
      this.stepSoundDist += stepDelta;
      if (this.stepSoundDist >= (this.inWater ? 2.1 : 1.85)) {
        this.stepSoundDist = 0;
        if (this.inWater) {
          this.sound.playStep('water');
        } else {
          const underId = this.world.getBlock(this.position.x, this.position.y - 0.2, this.position.z);
          this.sound.playStep(getBlockDef(underId).soundType);
        }
      }
    }
  }

  updateSurvivalVitals(dt) {
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.placeCooldown > 0) this.placeCooldown -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.mouseDownRight && this.placeCooldown <= 0) {
      this.handleSecondaryAction();
    }

    if (this.gameMode !== GAME_MODES.SURVIVAL) return;

    // Underwater oxygen bubbles
    const prevOxy = Math.ceil(this.oxygen);
    if (this.headUnderwater) {
      this.oxygen = Math.max(0, this.oxygen - dt * 0.72);
      if (this.oxygen <= 0) {
        this.drownTimer += dt;
        if (this.drownTimer >= 1.1) {
          this.drownTimer = 0;
          this.takeDamage(2);
        }
      }
    } else if (this.oxygen < this.maxOxygen) {
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + dt * 3.2);
      this.drownTimer = 0;
    }
    if (Math.ceil(this.oxygen) !== prevOxy) {
      this.onStatsChange?.();
    }

    // Gentle passive health recovery after out-of-combat delay
    if (this.regenTimer > 0) {
      this.regenTimer -= dt;
    } else if (this.health > 0 && this.health < this.maxHealth) {
      const prevHp = Math.ceil(this.health);
      this.health = Math.min(this.maxHealth, this.health + dt * 0.45);
      if (Math.ceil(this.health) !== prevHp) this.onStatsChange?.();
    }

    // Cactus prickle check
    this.cactusTimer -= dt;
    if (this.cactusTimer <= 0) {
      const hw = PLAYER_WIDTH * 0.5 + 0.08;
      const touchingCactus =
        this.world.getBlock(this.position.x + hw, this.position.y + 0.5, this.position.z) === BLOCK.CACTUS ||
        this.world.getBlock(this.position.x - hw, this.position.y + 0.5, this.position.z) === BLOCK.CACTUS ||
        this.world.getBlock(this.position.x, this.position.y + 0.5, this.position.z + hw) === BLOCK.CACTUS ||
        this.world.getBlock(this.position.x, this.position.y + 0.5, this.position.z - hw) === BLOCK.CACTUS;
      if (touchingCactus) {
        this.cactusTimer = 0.8;
        this.takeDamage(1);
      }
    }
  }

  update(dt) {
    if (!this.world) return;

    // Sub-step physics so fast falls never tunnel through floors
    let rem = Math.min(dt, 0.1);
    const maxStep = 0.022;
    while (rem > 0) {
      const step = Math.min(rem, maxStep);
      if (this.controlsEnabled && this.health > 0) {
        this.stepPhysics(step);
      }
      rem -= step;
    }

    this.updateSurvivalVitals(dt);

    // Sync Camera position, view bob, sprint FOV, and hurt tilt
    const eye = this.getEyePosition();
    const bobScale = this.onGround && !this.flying ? Math.min(1, Math.hypot(this.velocity.x, this.velocity.z) / WALK_SPEED) : 0;
    const bobY = Math.sin(this.walkDistance * 3.1) * 0.042 * bobScale;
    const bobX = Math.cos(this.walkDistance * 1.55) * 0.025 * bobScale;

    this.camera.position.set(eye.x + bobX, eye.y + bobY, eye.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = this.hurtFlash > 0 ? Math.sin(this.hurtFlash * 25) * 0.05 : 0;

    // Dynamic sprint FOV boost
    const targetFov = this.baseFov + (this.sprinting && this.keys.has('KeyW') ? 8 : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 10);
      this.camera.updateProjectionMatrix();
    }

    // Raycast target block
    if (this.controlsEnabled && this.health > 0) {
      const dir = this.getLookDirection();
      this.targetedHit = this.world.raycast(eye, dir, REACH_DISTANCE);
    } else {
      this.targetedHit = null;
    }

    if (this.targetedHit) {
      this.highlightMesh.visible = true;
      this.highlightMesh.position.set(
        this.targetedHit.x + 0.5,
        this.targetedHit.y + 0.5,
        this.targetedHit.z + 0.5
      );
    } else {
      this.highlightMesh.visible = false;
    }

    this.updateMining(dt);

    // Animate First-Person Held Rig
    this.rebuildHeldRig();
    if (this.swinging) {
      this.swingProgress += dt * 4.8;
      if (this.swingProgress >= 1.0) {
        this.swingProgress = 0;
        this.swinging = false;
      }
    }
    const swingSin = Math.sin(this.swingProgress * Math.PI);
    this.handPivot.position.set(
      0.42 - swingSin * 0.14 + bobX * 0.5,
      -0.36 + Math.abs(bobY) * 0.6 - swingSin * 0.08,
      -0.58 - swingSin * 0.12
    );
    this.handPivot.rotation.set(-swingSin * 0.95, swingSin * 0.45, swingSin * 0.32);

    // Dynamic Held Torch / Lantern warm point light in voxel shader & entity PointLight!
    const slot = this.inventory.getSelectedSlot();
    const heldEmit = slot ? getBlockDef(slot.id).lightLevel : 0;
    const uniforms = this.materials.sharedUniforms;
    if (heldEmit > 0) {
      uniforms.uHeldLightPos.value.set(eye.x, eye.y, eye.z);
      uniforms.uHeldLightIntensity.value = heldEmit / 15;
      this.heldEntityLight.intensity = 1.65;
    } else {
      uniforms.uHeldLightIntensity.value = 0;
      this.heldEntityLight.intensity = 0;
    }
  }

  serialize() {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      yaw: this.yaw,
      pitch: this.pitch,
      health: this.health,
      oxygen: this.oxygen,
      flying: this.flying,
      gameMode: this.gameMode,
      spawnPoint: { x: this.spawnPoint.x, y: this.spawnPoint.y, z: this.spawnPoint.z },
    };
  }

  deserialize(data) {
    if (!data) return;
    if (typeof data.x === 'number') this.position.set(data.x, data.y, data.z);
    if (typeof data.yaw === 'number') this.yaw = data.yaw;
    if (typeof data.pitch === 'number') this.pitch = data.pitch;
    if (typeof data.health === 'number') this.health = Math.max(1, data.health);
    if (typeof data.oxygen === 'number') this.oxygen = data.oxygen;
    if (data.spawnPoint) this.spawnPoint.set(data.spawnPoint.x, data.spawnPoint.y, data.spawnPoint.z);
    this.highestAirY = this.position.y;
    if (data.gameMode) this.setGameMode(data.gameMode);
    if (typeof data.flying === 'boolean' && this.gameMode === GAME_MODES.CREATIVE) {
      this.flying = data.flying;
    }
  }
}
