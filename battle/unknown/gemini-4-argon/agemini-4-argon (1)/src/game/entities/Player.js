import * as THREE from 'three';
import {
  GRAVITY,
  JUMP_VELOCITY,
  TERMINAL_VELOCITY,
  PLAYER_HALF_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_EYE_HEIGHT,
  PLAYER_CROUCH_EYE_HEIGHT,
  WALK_SPEED,
  SPRINT_SPEED,
  CROUCH_SPEED,
  SWIM_SPEED,
  FLY_SPEED,
  REACH_DISTANCE,
  GAME_MODES,
  MESH_SHAPE,
} from '../constants.js';
import { BLOCK_IDS, getItemDef } from '../data/blocks.js';
import { Inventory } from '../systems/Inventory.js';

export class Player {
  constructor({ camera, scene, world, atlas, entities, particles, audio, mode = GAME_MODES.SURVIVAL }) {
    this.camera = camera;
    this.scene = scene;
    this.world = world;
    this.atlas = atlas;
    this.entities = entities;
    this.particles = particles;
    this.audio = audio;
    this.mode = mode;

    this.inventory = new Inventory(mode);
    this.inventory.initDefaultForMode(mode);

    const safe = world.generator.findSafeSpawn();
    this.spawnPoint = { ...safe };
    this.position = new THREE.Vector3(safe.x, safe.y, safe.z);
    this.velocity = new THREE.Vector3(0, 0, 0);

    this.yaw = 0;
    this.pitch = -0.12;
    this.sensitivity = 1.0;
    this.invertY = false;
    this.baseFov = 74;

    this.onGround = false;
    this.inWater = false;
    this.headUnderwater = false;
    this.onLadder = false;
    this.flying = false;
    this.crouching = false;
    this.sprinting = false;

    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.lastSpaceTapTime = 0;
    this.fallPeakY = safe.y;
    this.stepDistance = 0;

    // Survival vitals
    this.maxHealth = 20;
    this.health = 20;
    this.maxHunger = 20;
    this.hunger = 20;
    this.maxAir = 10;
    this.air = 10;
    this.regenTimer = 0;
    this.hungerTimer = 0;
    this.hurtFlash = 0;
    this.invulnerableTimer = 0;
    this.isDead = false;

    // Block targeting & mining state
    this.targetHit = null;
    this.miningBlockKey = null;
    this.miningProgress = 0; // 0..1
    this.digSoundTimer = 0;
    this.placeCooldown = 0;
    this.attackCooldown = 0;

    // Viewmodel animation
    this.swingTimer = 0;
    this.bobPhase = 0;
    this.currentViewItemId = -1;

    // Callbacks for UI / Progression hooks
    this.onBlockBroken = null;
    this.onBlockPlaced = null;
    this.onItemCollected = null;
    this.onInteractBlock = null;
    this.onHintMessage = null;
    this.onDeath = null;

    this.initTargetBoxes();
    this.initViewmodel();

    this.inventory.onChange = () => {
      this.refreshViewmodelItem();
      if (this.onInventoryUpdated) this.onInventoryUpdated();
    };
    this.refreshViewmodelItem();
  }

  initTargetBoxes() {
    // Crisp dark wireframe outline around targeted block
    const boxGeom = new THREE.BoxGeometry(1.006, 1.006, 1.006);
    const edges = new THREE.EdgesGeometry(boxGeom);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x14181f,
      transparent: true,
      opacity: 0.72,
    });
    this.selectionBox = new THREE.LineSegments(edges, lineMat);
    this.selectionBox.visible = false;
    this.scene.add(this.selectionBox);

    // Crack overlay box
    const crackGeom = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    this.crackMat = new THREE.MeshBasicMaterial({
      map: this.atlas.crackTextures[0] || null,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.crackBox = new THREE.Mesh(crackGeom, this.crackMat);
    this.crackBox.visible = false;
    this.crackBox.renderOrder = 5;
    this.scene.add(this.crackBox);
  }

  initViewmodel() {
    this.viewmodelPivot = new THREE.Group();
    this.viewmodelHandGroup = new THREE.Group();
    this.viewmodelPivot.add(this.viewmodelHandGroup);
    this.camera.add(this.viewmodelPivot);
  }

  refreshViewmodelItem() {
    const slot = this.inventory.getSelectedSlot();
    const itemId = slot ? slot.id : 0;
    if (itemId === this.currentViewItemId) return;
    this.currentViewItemId = itemId;

    while (this.viewmodelHandGroup.children.length > 0) {
      const child = this.viewmodelHandGroup.children[0];
      this.viewmodelHandGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    if (!itemId) {
      // Cozy voxel hand
      const skinMat = new THREE.MeshLambertMaterial({ color: 0xe0ac8b, depthTest: false });
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.38), skinMat);
      hand.renderOrder = 999;
      hand.position.set(0.36, -0.32, -0.48);
      hand.rotation.set(0.22, -0.32, 0.1);
      this.viewmodelHandGroup.add(hand);
      return;
    }

    const def = getItemDef(itemId);
    if (def.isBlock && def.shape !== MESH_SHAPE.CROSS && def.shape !== MESH_SHAPE.TORCH && def.shape !== MESH_SHAPE.LADDER) {
      const h = def.shape === MESH_SHAPE.BED ? 0.14 : 0.25;
      const geom = new THREE.BoxGeometry(0.25, h, 0.25);
      const uvAttr = geom.getAttribute('uv');
      const faceNames = ['px', 'nx', 'top', 'bottom', 'pz', 'nz'];
      const faceShades = [0.72, 0.72, 1.0, 0.55, 0.86, 0.86];
      const colors = new Float32Array(24 * 3);
      for (let f = 0; f < 6; f++) {
        const rect = this.atlas.getBlockFaceUV(def, faceNames[f], 2);
        const s = faceShades[f];
        const base = f * 4;
        uvAttr.setXY(base + 0, rect.u0, rect.v1);
        uvAttr.setXY(base + 1, rect.u1, rect.v1);
        uvAttr.setXY(base + 2, rect.u0, rect.v0);
        uvAttr.setXY(base + 3, rect.u1, rect.v0);
        for (let v = 0; v < 4; v++) {
          const ci = (base + v) * 3;
          colors[ci] = s;
          colors[ci + 1] = s;
          colors[ci + 2] = s;
        }
      }
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.MeshBasicMaterial({
        map: this.atlas.texture,
        vertexColors: true,
        transparent: true,
        alphaTest: 0.2,
        depthTest: false,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.renderOrder = 999;
      mesh.position.set(0.36, -0.28, -0.52);
      mesh.rotation.set(0.22, 0.68, -0.08);
      this.viewmodelHandGroup.add(mesh);
      return;
    }

    // Tool / Weapon / Plant card in hand
    const url = this.atlas.getIconUrl(itemId);
    if (url && typeof Image !== 'undefined') {
      const tex = new THREE.TextureLoader().load(url);
      tex.magFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.25,
        side: THREE.DoubleSide,
        depthTest: false,
      });
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), mat);
      card.renderOrder = 999;
      card.position.set(0.36, -0.27, -0.5);
      card.rotation.set(0.08, -0.45, -0.15);
      this.viewmodelHandGroup.add(card);
    }
  }

  triggerSwing() {
    this.swingTimer = 0.22;
  }

  rotateLook(movementX, movementY) {
    if (this.isDead) return;
    const scale = 0.0022 * this.sensitivity;
    this.yaw -= movementX * scale;
    const ySign = this.invertY ? -1 : 1;
    this.pitch -= movementY * scale * ySign;
    const maxPitch = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  getEyePosition(out = new THREE.Vector3()) {
    const eyeH = this.crouching ? PLAYER_CROUCH_EYE_HEIGHT : PLAYER_EYE_HEIGHT;
    return out.set(this.position.x, this.position.y + eyeH, this.position.z);
  }

  getLookDirection(out = new THREE.Vector3()) {
    const cosPitch = Math.cos(this.pitch);
    return out.set(
      -Math.sin(this.yaw) * cosPitch,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cosPitch
    ).normalize();
  }

  getBlockTopAt(bx, by, bz) {
    const id = this.world.getBlock(bx, by, bz);
    if (id === BLOCK_IDS.AIR) return null;
    const def = getItemDef(id);
    if (!def.solid) return null;
    if (def.shape === MESH_SHAPE.BED) return by + 0.5625;
    return by + 1.0;
  }

  collidesAt(px, py, pz) {
    const hw = PLAYER_HALF_WIDTH;
    const minX = Math.floor(px - hw);
    const maxX = Math.floor(px + hw - 1e-5);
    const minY = Math.floor(py);
    const maxY = Math.floor(py + PLAYER_HEIGHT - 1e-4);
    const minZ = Math.floor(pz - hw);
    const maxZ = Math.floor(pz + hw - 1e-5);

    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          const topY = this.getBlockTopAt(bx, by, bz);
          if (topY === null) continue;
          if (py < topY && py + PLAYER_HEIGHT > by) {
            return true;
          }
        }
      }
    }
    return false;
  }

  hasSupportBelow(px, py, pz) {
    const hw = PLAYER_HALF_WIDTH * 0.9;
    const checkY = py - 0.12;
    const minX = Math.floor(px - hw);
    const maxX = Math.floor(px + hw);
    const minZ = Math.floor(pz - hw);
    const maxZ = Math.floor(pz + hw);
    const by = Math.floor(checkY);

    for (let bz = minZ; bz <= maxZ; bz++) {
      for (let bx = minX; bx <= maxX; bx++) {
        const topY = this.getBlockTopAt(bx, by, bz);
        if (topY !== null && checkY <= topY) return true;
      }
    }
    return false;
  }

  handleSpacePress(nowSeconds) {
    if (this.mode === GAME_MODES.CREATIVE) {
      if (nowSeconds - this.lastSpaceTapTime < 0.28) {
        this.flying = !this.flying;
        this.velocity.y = 0;
        this.lastSpaceTapTime = 0;
        if (this.onHintMessage) {
          this.onHintMessage(this.flying ? 'Creative Flight Enabled' : 'Creative Flight Disabled');
        }
        return;
      }
      this.lastSpaceTapTime = nowSeconds;
    }
    this.jumpBufferTimer = 0.12;
  }

  toggleFlight() {
    if (this.mode !== GAME_MODES.CREATIVE) return;
    this.flying = !this.flying;
    this.velocity.y = 0;
    if (this.onHintMessage) {
      this.onHintMessage(this.flying ? 'Creative Flight Enabled' : 'Creative Flight Disabled');
    }
  }

  takeDamage(amount, knockX = 0, knockZ = 0) {
    if (this.mode === GAME_MODES.CREATIVE || this.isDead || this.invulnerableTimer > 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtFlash = 0.35;
    this.invulnerableTimer = 0.48;
    this.audio.playHurt();

    if (knockX !== 0 || knockZ !== 0) {
      this.velocity.x += knockX * 5.2;
      this.velocity.y = Math.max(this.velocity.y, 4.2);
      this.velocity.z += knockZ * 5.2;
    }

    if (this.health <= 0) {
      this.isDead = true;
      this.miningProgress = 0;
      if (this.onDeath) this.onDeath();
    }
  }

  respawn() {
    this.isDead = false;
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this.air = this.maxAir;
    this.velocity.set(0, 0, 0);
    this.world.preloadAround(this.spawnPoint.x, this.spawnPoint.z, 1);

    // Ensure spawn column is clear above spawnPoint
    let sy = Math.floor(this.spawnPoint.y);
    while (sy < 120 && this.collidesAt(this.spawnPoint.x, sy, this.spawnPoint.z)) {
      sy++;
    }
    this.position.set(this.spawnPoint.x, sy + 0.05, this.spawnPoint.z);
    this.fallPeakY = this.position.y;
  }

  computeMiningDuration(blockId) {
    if (this.mode === GAME_MODES.CREATIVE) return 0.06;
    const blockDef = getItemDef(blockId);
    if (blockDef.hardness < 0) return Infinity;
    if (blockDef.hardness <= 0.08) return 0.06;

    const heldDef = this.inventory.getSelectedDef();
    const matchesTool =
      blockDef.preferredTool &&
      heldDef.toolType === blockDef.preferredTool;

    const hasRequiredTier =
      blockDef.minToolTier <= 0 ||
      (matchesTool && heldDef.toolTier >= blockDef.minToolTier);

    let speedMult = matchesTool ? heldDef.miningSpeed : 1.0;
    if (!hasRequiredTier) {
      speedMult *= 0.32;
    }
    if (this.headUnderwater) speedMult *= 0.5;

    return Math.max(0.08, blockDef.hardness / speedMult);
  }

  canHarvestDrops(blockId) {
    if (this.mode === GAME_MODES.CREATIVE) return false;
    const blockDef = getItemDef(blockId);
    if (blockDef.minToolTier <= 0) return true;
    const heldDef = this.inventory.getSelectedDef();
    return (
      heldDef.toolType === blockDef.preferredTool &&
      heldDef.toolTier >= blockDef.minToolTier
    );
  }

  tryAttackOrMine(dt, leftMouseHeld, justPressedLeft) {
    if (this.isDead) return;
    const eye = this.getEyePosition();
    const dir = this.getLookDirection();

    // 1. Check creature attack on fresh click
    if (justPressedLeft && this.attackCooldown <= 0) {
      const hitMob = this.entities.raycastMob(eye, dir, 4.1);
      if (hitMob) {
        this.attackCooldown = 0.34;
        this.triggerSwing();
        this.audio.playSwing();
        const heldDef = this.inventory.getSelectedDef();
        const dmg = heldDef.attackDamage || 1;
        this.entities.damageMob(hitMob, dmg, dir.x, dir.z);
        this.inventory.damageSelectedTool(1);
        return;
      }
    }

    if (!leftMouseHeld) {
      this.miningBlockKey = null;
      this.miningProgress = 0;
      return;
    }

    if (!this.targetHit) {
      if (justPressedLeft) {
        this.triggerSwing();
        this.audio.playSwing();
      }
      this.miningBlockKey = null;
      this.miningProgress = 0;
      return;
    }

    const { x, y, z, blockId, def, normal } = this.targetHit;
    if (def.hardness < 0 && this.mode !== GAME_MODES.CREATIVE) {
      this.miningProgress = 0;
      return;
    }

    const key = `${x},${y},${z}`;
    if (key !== this.miningBlockKey) {
      this.miningBlockKey = key;
      this.miningProgress = 0;
    }

    // Warn helpfully if mining high-tier ore without proper pickaxe
    if (justPressedLeft && this.mode === GAME_MODES.SURVIVAL && !this.canHarvestDrops(blockId)) {
      const tierNames = ['', 'Wooden', 'Stone', 'Iron'];
      const needed = tierNames[def.minToolTier] || 'Pickaxe';
      if (this.onHintMessage) {
        this.onHintMessage(`Requires ${needed} Pickaxe to harvest ${def.name}`);
      }
    }

    const duration = this.computeMiningDuration(blockId);
    this.miningProgress += dt / duration;

    if (this.swingTimer <= 0.04) {
      this.triggerSwing();
    }

    this.digSoundTimer -= dt;
    if (this.digSoundTimer <= 0) {
      this.digSoundTimer = 0.21;
      this.audio.playDig(def.sound);
      this.particles.emitMiningChip(x, y, z, normal, blockId);
    }

    if (this.miningProgress >= 1.0) {
      this.miningProgress = 0;
      this.miningBlockKey = null;

      const harvest = this.canHarvestDrops(blockId);
      this.world.removeContainerAt(x, y, z);
      this.world.setBlock(x, y, z, BLOCK_IDS.AIR, 0, true);
      this.audio.playBreak(def.sound);
      this.particles.emitBlockBreak(x, y, z, blockId);

      if (harvest) {
        let drop = null;
        if (typeof def.drops === 'function') drop = def.drops();
        else if (def.drops) drop = { ...def.drops };
        else drop = { id: blockId, count: 1 };

        if (drop && drop.id && drop.count > 0) {
          this.entities.spawnDroppedItem(x + 0.5, y + 0.35, z + 0.5, drop.id, drop.count);
        }
      }

      const brokeTool = this.inventory.damageSelectedTool(1);
      if (brokeTool && this.onHintMessage) {
        this.onHintMessage('Your tool wore out!');
      }

      if (this.onBlockBroken) {
        this.onBlockBroken(blockId);
      }
    }
  }

  tryRightClickUse() {
    if (this.isDead || this.placeCooldown > 0) return;
    this.placeCooldown = 0.18;

    // 1. Interact with targeted block unless crouching!
    if (this.targetHit && !this.crouching) {
      const { x, y, z, def } = this.targetHit;
      if (def.interactive === 'berry') {
        // Harvest berries and replace with tall grass so bush feels harvested cleanly!
        this.world.setBlock(x, y, z, BLOCK_IDS.TALL_GRASS, 0, true);
        this.entities.spawnDroppedItem(x + 0.5, y + 0.4, z + 0.5, getItemDef(BLOCK_IDS.BERRY_BUSH).drops.id, 2);
        this.audio.playStep(def.sound);
        this.triggerSwing();
        return;
      }
      if (def.interactive && this.onInteractBlock) {
        this.triggerSwing();
        this.onInteractBlock(def.interactive, x, y, z);
        return;
      }
    }

    const slot = this.inventory.getSelectedSlot();
    if (!slot) return;
    const itemDef = getItemDef(slot.id);

    // 2. Eat food item!
    if (itemDef.food) {
      if (this.mode === GAME_MODES.SURVIVAL && (this.hunger < this.maxHunger || this.health < this.maxHealth)) {
        this.hunger = Math.min(this.maxHunger, this.hunger + itemDef.food.hunger);
        this.health = Math.min(this.maxHealth, this.health + itemDef.food.heal);
        this.inventory.consumeSelected(1);
        this.audio.playEat();
        this.triggerSwing();
        if (this.onHintMessage) {
          this.onHintMessage(`Ate ${itemDef.name} (+${itemDef.food.hunger} Stamina)`);
        }
      } else if (this.onHintMessage) {
        this.onHintMessage('Already full!');
      }
      return;
    }

    // 3. Place voxel block!
    if (itemDef.isBlock && this.targetHit) {
      const targetDef = this.targetHit.def;
      // Replace tall grass / dead bush directly if clicked on
      const placeX = targetDef.replaceable && !targetDef.liquid ? this.targetHit.x : this.targetHit.placePos.x;
      const placeY = targetDef.replaceable && !targetDef.liquid ? this.targetHit.y : this.targetHit.placePos.y;
      const placeZ = targetDef.replaceable && !targetDef.liquid ? this.targetHit.z : this.targetHit.placePos.z;

      if (placeY < 0 || placeY >= 127) return;

      const existing = this.world.getBlock(placeX, placeY, placeZ);
      const existingDef = getItemDef(existing);
      if (existing !== BLOCK_IDS.AIR && !existingDef.replaceable) return;

      // Require solid floor beneath torches / flowers
      if (
        (itemDef.shape === MESH_SHAPE.TORCH || itemDef.shape === MESH_SHAPE.CROSS) &&
        !getItemDef(this.world.getBlock(placeX, placeY - 1, placeZ)).solid
      ) {
        return;
      }

      // Compute directional metadata facing player for Furnace, Chest, Ladder
      let meta = 0;
      const look = this.getLookDirection();
      if (Math.abs(look.x) > Math.abs(look.z)) {
        meta = look.x > 0 ? 3 : 1; // face back toward player (-X or +X)
      } else {
        meta = look.z > 0 ? 0 : 2; // face back toward player (-Z or +Z)
      }

      if (itemDef.shape === MESH_SHAPE.LADDER) {
        const n = this.targetHit.normal;
        if (n.y !== 0) return; // Ladders mount on vertical walls
        if (n.z === -1) meta = 0;
        else if (n.x === 1) meta = 1;
        else if (n.z === 1) meta = 2;
        else if (n.x === -1) meta = 3;
      }

      // Prevent placing solid blocks inside player's own AABB
      if (itemDef.solid) {
        this.world.setBlock(placeX, placeY, placeZ, slot.id, meta, false);
        const overlapsSelf = this.collidesAt(this.position.x, this.position.y, this.position.z);
        if (overlapsSelf) {
          this.world.setBlock(placeX, placeY, placeZ, existing, 0, false);
          return;
        }
        // Commit with full light + mesh update
        this.world.setBlock(placeX, placeY, placeZ, existing, 0, false);
      }

      if (this.inventory.consumeSelected(1)) {
        this.world.setBlock(placeX, placeY, placeZ, slot.id, meta, true);
        this.audio.playPlace(itemDef.sound);
        this.triggerSwing();
        if (this.onBlockPlaced) {
          this.onBlockPlaced(slot.id);
        }
      }
    }
  }

  update(dt, input, pointerLocked) {
    if (this.placeCooldown > 0) this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    if (this.attackCooldown > 0) this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.invulnerableTimer > 0) this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);

    // Check water / ladder environment
    const feetBlock = this.world.getBlock(this.position.x, this.position.y + 0.15, this.position.z);
    const waistBlock = this.world.getBlock(this.position.x, this.position.y + 0.9, this.position.z);
    const eyePos = this.getEyePosition();
    const eyeBlock = this.world.getBlock(eyePos.x, eyePos.y, eyePos.z);

    const wasInWater = this.inWater;
    this.inWater = feetBlock === BLOCK_IDS.WATER || waistBlock === BLOCK_IDS.WATER;
    this.headUnderwater = eyeBlock === BLOCK_IDS.WATER;
    this.onLadder =
      feetBlock === BLOCK_IDS.LADDER || waistBlock === BLOCK_IDS.LADDER;

    if (!wasInWater && this.inWater && this.velocity.y < -4.5) {
      this.audio.playSplash();
      this.particles.emitSplash(this.position.x, Math.floor(this.position.y) + 0.9, this.position.z);
    }

    if (feetBlock === BLOCK_IDS.LAVA || waistBlock === BLOCK_IDS.LAVA) {
      this.takeDamage(4);
      this.fallPeakY = this.position.y;
    }

    if (this.inWater || this.onLadder || this.flying) {
      this.fallPeakY = this.position.y;
    }

    // Movement input vector
    let moveForward = 0;
    let moveRight = 0;
    if (pointerLocked && !this.isDead) {
      if (input.keys.KeyW || input.keys.ArrowUp) moveForward += 1;
      if (input.keys.KeyS || input.keys.ArrowDown) moveForward -= 1;
      if (input.keys.KeyD || input.keys.ArrowRight) moveRight += 1;
      if (input.keys.KeyA || input.keys.ArrowLeft) moveRight -= 1;
    }

    const inputLen = Math.hypot(moveForward, moveRight);
    if (inputLen > 1) {
      moveForward /= inputLen;
      moveRight /= inputLen;
    }

    this.crouching = Boolean(pointerLocked && !this.flying && input.keys.KeyC);
    this.sprinting = Boolean(
      pointerLocked &&
      !this.crouching &&
      moveForward > 0.2 &&
      (input.keys.ShiftLeft || input.keys.ShiftRight) &&
      (this.mode === GAME_MODES.CREATIVE || this.hunger > 4)
    );

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const wishX = -sinY * moveForward + cosY * moveRight;
    const wishZ = -cosY * moveForward - sinY * moveRight;

    if (this.flying && this.mode === GAME_MODES.CREATIVE) {
      const flySpeed = this.sprinting ? FLY_SPEED * 1.65 : FLY_SPEED;
      this.velocity.x += (wishX * flySpeed - this.velocity.x) * Math.min(1, dt * 11.0);
      this.velocity.z += (wishZ * flySpeed - this.velocity.z) * Math.min(1, dt * 11.0);

      let vert = 0;
      if (pointerLocked && input.keys.Space) vert += 1;
      if (pointerLocked && (input.keys.KeyC || input.keys.ControlLeft)) vert -= 1;
      this.velocity.y += (vert * flySpeed * 0.85 - this.velocity.y) * Math.min(1, dt * 11.0);
    } else if (this.inWater) {
      const swimSpd = SWIM_SPEED;
      this.velocity.x += (wishX * swimSpd - this.velocity.x) * Math.min(1, dt * 7.0);
      this.velocity.z += (wishZ * swimSpd - this.velocity.z) * Math.min(1, dt * 7.0);

      if (pointerLocked && input.keys.Space) {
        // Breach smoothly onto shore when near water surface
        const aboveWaist = this.world.getBlock(this.position.x, this.position.y + 1.25, this.position.z);
        this.velocity.y = aboveWaist === BLOCK_IDS.AIR ? 6.4 : 4.2;
      } else {
        this.velocity.y = Math.max(-3.2, this.velocity.y - GRAVITY * 0.25 * dt);
      }
    } else if (this.onLadder) {
      this.velocity.x = wishX * 2.8;
      this.velocity.z = wishZ * 2.8;
      if (pointerLocked && (input.keys.Space || moveForward > 0.1)) {
        this.velocity.y = 4.2;
      } else if (this.crouching) {
        this.velocity.y = 0;
      } else {
        this.velocity.y = -2.6;
      }
    } else {
      const targetSpeed = this.crouching
        ? CROUCH_SPEED
        : this.sprinting
          ? SPRINT_SPEED
          : WALK_SPEED;

      const accel = this.onGround ? 16.0 : 6.5;
      this.velocity.x += (wishX * targetSpeed - this.velocity.x) * Math.min(1, dt * accel);
      this.velocity.z += (wishZ * targetSpeed - this.velocity.z) * Math.min(1, dt * accel);

      if (this.onGround) {
        this.coyoteTimer = 0.11;
      } else {
        this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      }

      if (pointerLocked && input.keys.Space) {
        this.jumpBufferTimer = 0.11;
      } else {
        this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
      }

      if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
        this.velocity.y = JUMP_VELOCITY;
        this.onGround = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
      }

      this.velocity.y = Math.max(-TERMINAL_VELOCITY, this.velocity.y - GRAVITY * dt);
    }

    // Sub-stepped AABB collision resolution
    const speedMag = this.velocity.length() * dt;
    const steps = Math.max(1, Math.min(6, Math.ceil(speedMag / 0.24)));
    const subDt = dt / steps;
    const prevX = this.position.x;
    const prevZ = this.position.z;

    for (let s = 0; s < steps; s++) {
      // X axis
      const nextX = this.position.x + this.velocity.x * subDt;
      if (!this.collidesAt(nextX, this.position.y, this.position.z)) {
        if (this.crouching && this.onGround && !this.hasSupportBelow(nextX, this.position.y, this.position.z)) {
          this.velocity.x = 0;
        } else {
          this.position.x = nextX;
        }
      } else {
        this.velocity.x = 0;
      }

      // Z axis
      const nextZ = this.position.z + this.velocity.z * subDt;
      if (!this.collidesAt(this.position.x, this.position.y, nextZ)) {
        if (this.crouching && this.onGround && !this.hasSupportBelow(this.position.x, this.position.y, nextZ)) {
          this.velocity.z = 0;
        } else {
          this.position.z = nextZ;
        }
      } else {
        this.velocity.z = 0;
      }

      // Y axis
      const nextY = this.position.y + this.velocity.y * subDt;
      if (!this.collidesAt(this.position.x, nextY, this.position.z)) {
        this.position.y = nextY;
        this.onGround = false;
        if (this.position.y > this.fallPeakY) {
          this.fallPeakY = this.position.y;
        }
      } else {
        if (this.velocity.y < 0) {
          // Landed!
          const fallDist = this.fallPeakY - this.position.y;
          const landedBlock = this.world.getBlock(this.position.x, this.position.y - 0.2, this.position.z);
          if (
            !this.flying &&
            !this.inWater &&
            landedBlock !== BLOCK_IDS.BED &&
            fallDist > 3.7
          ) {
            const dmg = Math.floor(fallDist - 3.2);
            if (dmg > 0) this.takeDamage(dmg);
          }
          if (this.flying) this.flying = false;
          this.onGround = true;
          this.fallPeakY = this.position.y;
        }
        this.velocity.y = 0;
      }
    }

    // Footstep SFX
    const movedHoriz = Math.hypot(this.position.x - prevX, this.position.z - prevZ);
    if (this.onGround && !this.inWater && movedHoriz > 0.001) {
      this.stepDistance += movedHoriz;
      if (this.stepDistance >= (this.crouching ? 2.2 : 1.75)) {
        this.stepDistance = 0;
        const groundId = this.world.getBlock(this.position.x, this.position.y - 0.2, this.position.z);
        if (groundId !== BLOCK_IDS.AIR) {
          this.audio.playStep(getItemDef(groundId).sound);
        }
      }
    }

    // Survival Air, Hunger & Regeneration
    if (this.mode === GAME_MODES.SURVIVAL && !this.isDead) {
      if (this.headUnderwater) {
        this.air = Math.max(0, this.air - dt * 0.65);
        if (this.air <= 0) {
          this.regenTimer += dt;
          if (this.regenTimer >= 1.2) {
            this.regenTimer = 0;
            this.takeDamage(2);
          }
        }
      } else {
        this.air = Math.min(this.maxAir, this.air + dt * 3.2);
      }

      if (this.sprinting && movedHoriz > 0.01) {
        this.hungerTimer += dt * 1.4;
      } else if (movedHoriz > 0.01) {
        this.hungerTimer += dt * 0.22;
      }
      if (this.hungerTimer >= 14.0) {
        this.hungerTimer = 0;
        this.hunger = Math.max(0, this.hunger - 1);
      }

      if (this.hunger >= 15 && this.health < this.maxHealth && !this.headUnderwater) {
        this.regenTimer += dt;
        if (this.regenTimer >= 3.5) {
          this.regenTimer = 0;
          this.health = Math.min(this.maxHealth, this.health + 1);
        }
      }
    }

    // Update Camera Position, Rotation & Sprint FOV Kick
    const targetEye = this.crouching ? PLAYER_CROUCH_EYE_HEIGHT : PLAYER_EYE_HEIGHT;
    const horizSpd = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.onGround && horizSpd > 0.3 && !this.flying) {
      this.bobPhase += dt * horizSpd * 2.1;
    }

    const headBobY = this.onGround && !this.flying ? Math.sin(this.bobPhase * 2) * 0.032 * Math.min(1, horizSpd / 4) : 0;
    this.camera.position.set(this.position.x, this.position.y + targetEye + headBobY, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    const desiredFov = this.baseFov + (this.sprinting ? 7 : 0) + (this.headUnderwater ? -5 : 0);
    if (Math.abs(this.camera.fov - desiredFov) > 0.05) {
      this.camera.fov += (desiredFov - this.camera.fov) * Math.min(1, dt * 10);
      this.camera.updateProjectionMatrix();
    }

    // Raycast Targeted Block
    const rayOrigin = this.getEyePosition();
    const rayDir = this.getLookDirection();
    this.targetHit = this.world.raycast(rayOrigin, rayDir, REACH_DISTANCE);

    if (this.targetHit && !this.isDead) {
      const { x, y, z, def } = this.targetHit;
      const boxH = def.shape === MESH_SHAPE.BED ? 0.5625 : 1.0;
      this.selectionBox.visible = true;
      this.selectionBox.scale.set(1, boxH, 1);
      this.selectionBox.position.set(x + 0.5, y + boxH * 0.5, z + 0.5);

      if (this.miningProgress > 0.03 && this.atlas.crackTextures.length > 0) {
        const stage = Math.min(
          this.atlas.crackTextures.length - 1,
          Math.floor(this.miningProgress * this.atlas.crackTextures.length)
        );
        this.crackMat.map = this.atlas.crackTextures[stage];
        this.crackMat.needsUpdate = true;
        this.crackBox.visible = true;
        this.crackBox.scale.set(1, boxH, 1);
        this.crackBox.position.set(x + 0.5, y + boxH * 0.5, z + 0.5);
      } else {
        this.crackBox.visible = false;
      }
    } else {
      this.selectionBox.visible = false;
      this.crackBox.visible = false;
    }

    // Interactions when pointer is locked
    if (pointerLocked && !this.isDead) {
      this.tryAttackOrMine(dt, input.mouseLeft, input.justPressedLeft);
      if (input.justPressedRight) {
        this.tryRightClickUse();
      }
    } else {
      this.miningProgress = 0;
      this.miningBlockKey = null;
      this.crackBox.visible = false;
    }

    // Animate First-Person Held Viewmodel
    if (this.swingTimer > 0) {
      this.swingTimer = Math.max(0, this.swingTimer - dt);
    }
    const swingProgress = this.swingTimer > 0 ? 1.0 - this.swingTimer / 0.22 : 0;
    const swingAngle = swingProgress > 0 ? Math.sin(swingProgress * Math.PI) : 0;

    const bobX = Math.cos(this.bobPhase) * 0.018 * Math.min(1, horizSpd / 4);
    const bobY = Math.abs(Math.sin(this.bobPhase)) * -0.022 * Math.min(1, horizSpd / 4);
    this.viewmodelPivot.position.set(bobX - swingAngle * 0.08, bobY - swingAngle * 0.09, -swingAngle * 0.12);
    this.viewmodelPivot.rotation.set(-swingAngle * 0.72, swingAngle * 0.35, swingAngle * 0.22);
  }

  serialize() {
    return {
      pos: [this.position.x, this.position.y, this.position.z],
      yaw: this.yaw,
      pitch: this.pitch,
      health: this.health,
      hunger: this.hunger,
      flying: this.flying,
      spawnPoint: { ...this.spawnPoint },
      inventory: this.inventory.serialize(),
    };
  }

  deserialize(data) {
    if (!data) return;
    if (Array.isArray(data.pos) && data.pos.length === 3) {
      this.position.set(data.pos[0], data.pos[1], data.pos[2]);
      this.fallPeakY = data.pos[1];
    }
    if (typeof data.yaw === 'number') this.yaw = data.yaw;
    if (typeof data.pitch === 'number') this.pitch = data.pitch;
    if (typeof data.health === 'number') this.health = data.health;
    if (typeof data.hunger === 'number') this.hunger = data.hunger;
    if (typeof data.flying === 'boolean' && this.mode === GAME_MODES.CREATIVE) {
      this.flying = data.flying;
    }
    if (data.spawnPoint) {
      this.spawnPoint = { ...data.spawnPoint };
    }
    if (data.inventory) {
      this.inventory.deserialize(data.inventory);
    }
    this.refreshViewmodelItem();
  }

  dispose() {
    this.scene.remove(this.selectionBox);
    this.scene.remove(this.crackBox);
    this.camera.remove(this.viewmodelPivot);
  }
}
