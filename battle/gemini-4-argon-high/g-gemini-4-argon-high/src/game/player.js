import * as THREE from 'three';
import { BLOCK, REGISTRY } from './constants.js';

export class PlayerController {
  constructor(camera, scene, world, inventory, audio, particles, entities) {
    this.camera = camera;
    this.scene = scene;
    this.world = world;
    this.inventory = inventory;
    this.audio = audio;
    this.particles = particles;
    this.entities = entities;

    // Position is at player's feet center
    this.position = new THREE.Vector3(0.5, 35, 0.5);
    this.velocity = new THREE.Vector3(0, 0, 0);

    this.yaw = 0;
    this.pitch = -0.15;

    this.halfWidth = 0.3;
    this.height = 1.75;
    this.eyeHeight = 1.58;

    this.mode = 'survival'; // 'survival' | 'creative'
    this.flying = false;
    this.onGround = false;
    this.inWater = false;
    this.headInWater = false;
    this.sprinting = false;
    this.crouching = false;

    // Survival stats
    this.health = 20;
    this.maxHealth = 20;
    this.hunger = 20;
    this.maxHunger = 20;
    this.xp = 0;
    this.level = 1;
    this.fallDistance = 0;
    this.regenTimer = 0;
    this.damageFlash = 0;

    // Input state
    this.keys = {};
    this.mouseDownLeft = false;
    this.mouseDownRight = false;
    this.placeCooldown = 0;

    // Mining state
    this.targetHit = null;
    this.miningBlockKey = null;
    this.mineProgress = 0; // 0..1
    this.mineTickTimer = 0;

    // Animation state
    this.walkBobPhase = 0;
    this.stepSoundDist = 0;
    this.swingPhase = 0;
    this.isSwinging = false;
    this.lastHeldId = -1;

    this._initTargetHighlight();
    this._initFirstPersonHand();
  }

  _initTargetHighlight() {
    // Wireframe selection box
    const boxGeo = new THREE.BoxGeometry(1.006, 1.006, 1.006);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.75 });
    this.highlightBox = new THREE.LineSegments(edges, lineMat);
    this.highlightBox.visible = false;
    this.scene.add(this.highlightBox);

    // Mining progress crack overlay box
    const crackGeo = new THREE.BoxGeometry(1.012, 1.012, 1.012);
    this.crackMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      wireframe: true,
      transparent: true,
      opacity: 0,
    });
    this.crackMesh = new THREE.Mesh(crackGeo, this.crackMat);
    this.crackMesh.visible = false;
    this.scene.add(this.crackMesh);
  }

  _initFirstPersonHand() {
    this.handGroup = new THREE.Group();
    this.camera.add(this.handGroup);
    this.scene.add(this.camera);

    this.heldMeshGroup = new THREE.Group();
    this.heldMeshGroup.position.set(0.42, -0.34, -0.58);
    this.handGroup.add(this.heldMeshGroup);
    this.rebuildHeldMesh();
  }

  rebuildHeldMesh() {
    const heldSlot = this.inventory.getHeldItem();
    const heldId = heldSlot ? heldSlot.id : 0;
    if (heldId === this.lastHeldId) return;
    this.lastHeldId = heldId;

    while (this.heldMeshGroup.children.length > 0) {
      const child = this.heldMeshGroup.children[0];
      this.heldMeshGroup.remove(child);
    }

    if (!heldSlot) {
      // Bare voxel arm
      const armGeo = new THREE.BoxGeometry(0.14, 0.14, 0.42);
      const armMat = new THREE.MeshLambertMaterial({ color: 0xe0ac8b, depthTest: false });
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.renderOrder = 999;
      arm.rotation.set(0.25, -0.3, 0);
      this.heldMeshGroup.add(arm);
      return;
    }

    const def = REGISTRY[heldId];
    if (!def) return;

    if (def.isBlock) {
      if (heldId === BLOCK.TORCH) {
        const stickGeo = new THREE.BoxGeometry(0.06, 0.28, 0.06);
        const stickMat = new THREE.MeshLambertMaterial({ color: 0x7a5830, depthTest: false });
        const stick = new THREE.Mesh(stickGeo, stickMat);
        stick.renderOrder = 999;
        const headGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const headMat = new THREE.MeshBasicMaterial({ color: 0xffb833, depthTest: false });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.16;
        head.renderOrder = 999;
        this.heldMeshGroup.add(stick);
        this.heldMeshGroup.add(head);
      } else {
        const geo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
        const mat = new THREE.MeshLambertMaterial({
          color: def.particleColor || 0xaaaaaa,
          depthTest: false,
        });
        const cube = new THREE.Mesh(geo, mat);
        cube.renderOrder = 999;
        cube.rotation.set(0.2, 0.65, 0);
        this.heldMeshGroup.add(cube);
      }
    } else if (def.isTool) {
      const handleGeo = new THREE.BoxGeometry(0.05, 0.34, 0.05);
      const handleMat = new THREE.MeshLambertMaterial({ color: 0x7c5832, depthTest: false });
      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.renderOrder = 999;
      handle.rotation.x = -0.35;
      this.heldMeshGroup.add(handle);

      const tierColors = { 1: 0xb88c51, 2: 0x8a8d91, 3: 0xe1e6eb, 4: 0x42f5e3 };
      const headColor = tierColors[def.tier] || 0xcccccc;
      const headGeo =
        def.toolType === 'sword'
          ? new THREE.BoxGeometry(0.06, 0.32, 0.1)
          : new THREE.BoxGeometry(0.24, 0.08, 0.07);
      const headMat = new THREE.MeshLambertMaterial({ color: headColor, depthTest: false });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(0, 0.16, -0.06);
      head.rotation.x = -0.35;
      head.renderOrder = 999;
      this.heldMeshGroup.add(head);
    } else {
      const itemGeo = new THREE.BoxGeometry(0.16, 0.16, 0.08);
      const itemMat = new THREE.MeshLambertMaterial({
        color: def.isFood ? 0xd94e3b : 0x52d6cb,
        depthTest: false,
      });
      const item = new THREE.Mesh(itemGeo, itemMat);
      item.renderOrder = 999;
      this.heldMeshGroup.add(item);
    }
  }

  triggerSwing() {
    this.isSwinging = true;
    this.swingPhase = 0;
  }

  spawnAtSafePosition(wx = 7, wz = 0) {
    this.world.preloadSpawnArea(wx, wz, 2);
    const groundY = this.world.getHighestSolidY(wx, wz);
    this.position.set(wx + 0.5, groundY + 1.05, wz + 0.5);
    this.velocity.set(0, 0, 0);
    this.fallDistance = 0;
    this.syncCamera(0);
  }

  rotateCamera(deltaYaw, deltaPitch) {
    this.yaw -= deltaYaw;
    const maxPitch = Math.PI / 2 - 0.04;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch - deltaPitch));
  }

  getForwardVector() {
    const dir = new THREE.Vector3(0, 0, -1);
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    dir.applyEuler(euler);
    return dir.normalize();
  }

  getEyePosition() {
    const curEye = this.crouching ? 1.32 : this.eyeHeight;
    return new THREE.Vector3(this.position.x, this.position.y + curEye, this.position.z);
  }

  takeDamage(amount, audio) {
    if (this.mode === 'creative') return;
    this.health = Math.max(0, this.health - amount);
    this.damageFlash = 0.35;
    if (audio) audio.playHit(true);
    if (this.health <= 0) {
      // Respawn at world origin with restored health
      this.health = 20;
      this.hunger = 20;
      this.spawnAtSafePosition(0, 0);
    }
  }

  tryEatHeldFood() {
    const def = this.inventory.getHeldDef();
    if (!def || !def.isFood) return false;
    if (this.health >= this.maxHealth && this.hunger >= this.maxHunger) return false;

    this.health = Math.min(this.maxHealth, this.health + (def.heal || 4));
    this.hunger = Math.min(this.maxHunger, this.hunger + (def.hunger || 5));
    this.inventory.consumeHeld(1);
    this.triggerSwing();
    if (this.audio) this.audio.playEat();
    this.rebuildHeldMesh();
    return true;
  }

  update(dt, onUIUpdate, onOpenCrafting) {
    this.rebuildHeldMesh();

    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt);
    if (this.placeCooldown > 0) this.placeCooldown = Math.max(0, this.placeCooldown - dt);

    // Arrow key camera rotation support
    const keyTurnSpeed = 2.1;
    if (this.keys['ArrowLeft']) this.rotateCamera(-keyTurnSpeed * dt, 0);
    if (this.keys['ArrowRight']) this.rotateCamera(keyTurnSpeed * dt, 0);
    if (this.keys['ArrowUp']) this.rotateCamera(0, -keyTurnSpeed * 0.8 * dt);
    if (this.keys['ArrowDown']) this.rotateCamera(0, keyTurnSpeed * 0.8 * dt);

    // Check water status
    const footBlock = this.world.getBlock(this.position.x, this.position.y + 0.2, this.position.z);
    const headBlock = this.world.getBlock(this.position.x, this.position.y + 1.5, this.position.z);
    this.inWater = footBlock === BLOCK.WATER || headBlock === BLOCK.WATER;
    this.headInWater = headBlock === BLOCK.WATER;

    // Movement input vector
    this.crouching = Boolean(this.keys['KeyC']);
    this.sprinting = Boolean((this.keys['ShiftLeft'] || this.keys['ShiftRight']) && !this.crouching && !this.flying);

    let forwardInput = 0;
    let strafeInput = 0;
    if (this.keys['KeyW']) forwardInput += 1;
    if (this.keys['KeyS']) forwardInput -= 1;
    if (this.keys['KeyD']) strafeInput += 1;
    if (this.keys['KeyA']) strafeInput -= 1;

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);

    // Forward in Three.js (-Z when yaw=0) is (-sinY, -cosY), Right is (cosY, -sinY)
    let moveX = -sinY * forwardInput + cosY * strafeInput;
    let moveZ = -cosY * forwardInput - sinY * strafeInput;
    const moveLen = Math.hypot(moveX, moveZ);
    if (moveLen > 0) {
      moveX /= moveLen;
      moveZ /= moveLen;
    }

    const baseSpeed = this.flying ? 11.5 : this.crouching ? 2.5 : this.sprinting ? 6.8 : 4.6;
    const waterMult = this.inWater && !this.flying ? 0.65 : 1.0;
    const targetVx = moveX * baseSpeed * waterMult;
    const targetVz = moveZ * baseSpeed * waterMult;

    const accel = this.onGround || this.flying ? 18.0 : 8.5;
    this.velocity.x += (targetVx - this.velocity.x) * Math.min(1, accel * dt);
    this.velocity.z += (targetVz - this.velocity.z) * Math.min(1, accel * dt);

    // Vertical movement & gravity
    if (this.flying) {
      let flyY = 0;
      if (this.keys['Space']) flyY += 8.0;
      if (this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['KeyC']) flyY -= 8.0;
      this.velocity.y = flyY;
      this.fallDistance = 0;
    } else if (this.inWater) {
      this.fallDistance = 0;
      if (this.keys['Space']) {
        this.velocity.y = 3.8;
      } else {
        this.velocity.y = Math.max(-2.4, this.velocity.y - 7.5 * dt);
      }
    } else {
      if (this.keys['Space'] && this.onGround) {
        this.velocity.y = 8.15;
        this.onGround = false;
      }
      this.velocity.y = Math.max(-32.0, this.velocity.y - 24.5 * dt);
    }

    // Apply swept AABB collision
    const prevY = this.position.y;
    this._moveAndCollide(dt);

    // Fall damage calculation
    if (!this.onGround && !this.flying && !this.inWater && this.velocity.y < 0) {
      this.fallDistance += Math.max(0, prevY - this.position.y);
    } else if (this.onGround) {
      if (this.fallDistance > 4.2 && this.mode === 'survival' && !this.inWater) {
        const dmg = Math.floor((this.fallDistance - 3.5) * 1.6);
        if (dmg > 0) this.takeDamage(dmg, this.audio);
      }
      this.fallDistance = 0;
    }

    // Hunger & health regen in survival
    if (this.mode === 'survival') {
      if (moveLen > 0.1) {
        this.hunger = Math.max(0, this.hunger - (this.sprinting ? 0.05 : 0.018) * dt);
      }
      if (this.hunger >= 15 && this.health < this.maxHealth) {
        this.regenTimer += dt;
        if (this.regenTimer >= 3.0) {
          this.regenTimer = 0;
          this.health = Math.min(this.maxHealth, this.health + 1);
        }
      }
    }

    // Footstep sounds & view bob
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizSpeed > 0.4 && (this.onGround || this.inWater) && !this.flying) {
      this.walkBobPhase += dt * horizSpeed * 2.1;
      this.stepSoundDist += horizSpeed * dt;
      if (this.stepSoundDist >= 1.95) {
        this.stepSoundDist = 0;
        const groundId = this.world.getBlock(this.position.x, this.position.y - 0.2, this.position.z);
        const matSound = this.inWater ? 'water' : REGISTRY[groundId]?.sound || 'grass';
        if (this.audio) this.audio.playStep(matSound);
      }
    } else {
      this.walkBobPhase = 0;
    }

    // Update camera & hand animation
    this.syncCamera(dt, horizSpeed);

    // Raycast target block
    const eyePos = this.getEyePosition();
    const lookDir = this.getForwardVector();
    this.targetHit = this.world.raycast(eyePos, lookDir, 6.0);

    if (this.targetHit) {
      this.highlightBox.visible = true;
      this.highlightBox.position.set(
        this.targetHit.x + 0.5,
        this.targetHit.y + 0.5,
        this.targetHit.z + 0.5
      );
    } else {
      this.highlightBox.visible = false;
    }

    // Handle Left-Click / 'B' Key (Attack Mob or Mine Block)
    const isMiningInput = this.mouseDownLeft || Boolean(this.keys['KeyB']);
    if (isMiningInput) {
      this._handleMining(dt, eyePos, lookDir, onUIUpdate);
    } else {
      this.mineProgress = 0;
      this.miningBlockKey = null;
      this.crackMesh.visible = false;
    }

    // Handle Right-Click / 'V' Key (Place Block / Interact / Eat)
    const isPlaceInput = this.mouseDownRight || Boolean(this.keys['KeyV']);
    if (isPlaceInput && this.placeCooldown <= 0) {
      this.placeCooldown = 0.22;
      this._handleRightClick(onUIUpdate, onOpenCrafting);
    }
  }

  _handleMining(dt, eyePos, lookDir, onUIUpdate) {
    if (!this.isSwinging) this.triggerSwing();

    // First check if a mob is directly in front of the player within combat reach
    if (this.mineProgress === 0 && this.entities) {
      const dmg = this.inventory.getAttackDamage();
      const mobHit = this.entities.tryAttackMob(eyePos, lookDir, dmg, this.audio, this.particles, 3.9);
      if (mobHit) {
        this.mouseDownLeft = false; // Single swing per click for combat
        if (mobHit.killed) {
          this.xp += 15;
          if (this.xp >= this.level * 40) {
            this.xp = 0;
            this.level += 1;
            if (this.audio) this.audio.playCraft();
          }
        }
        if (onUIUpdate) onUIUpdate();
        return;
      }
    }

    if (!this.targetHit) {
      this.mineProgress = 0;
      this.crackMesh.visible = false;
      return;
    }

    const { x, y, z, nx, ny, nz, blockId } = this.targetHit;
    const def = REGISTRY[blockId];
    if (!def || def.unbreakable) {
      this.mineProgress = 0;
      this.crackMesh.visible = false;
      return;
    }

    const key = `${x},${y},${z}`;
    if (this.miningBlockKey !== key) {
      this.miningBlockKey = key;
      this.mineProgress = 0;
    }

    // Instant break in Creative mode or for torches
    const speedMult = this.mode === 'creative' ? 50 : this.inventory.getMiningSpeed(blockId);
    const hardness = Math.max(0.1, def.hardness || 1.0);
    this.mineProgress += (dt * speedMult) / hardness;

    this.mineTickTimer += dt;
    if (this.mineTickTimer >= 0.16) {
      this.mineTickTimer = 0;
      if (this.audio) this.audio.playMineTick(def.sound || 'stone', this.mineProgress);
      if (this.particles) this.particles.spawnMiningChip(x, y, z, nx, ny, nz, blockId);
    }

    this.crackMesh.visible = true;
    this.crackMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    const s = 0.25 + Math.min(0.76, this.mineProgress * 0.76);
    this.crackMesh.scale.set(s, s, s);
    this.crackMat.opacity = Math.min(0.85, this.mineProgress * 0.9);

    if (this.mineProgress >= 1.0) {
      // Break block!
      this.world.setBlock(x, y, z, BLOCK.AIR, true);
      if (this.audio) this.audio.playBlockBreak(def.sound || 'stone');
      if (this.particles) this.particles.spawnBlockBreak(x, y, z, blockId, 22);

      // Spawn physical dropped item or add directly
      if (def.drop && this.mode === 'survival') {
        const dropCount = def.dropCount || 1;
        this.entities.spawnDroppedItem(x + 0.5, y + 0.35, z + 0.5, def.drop, dropCount);
        if (def.bonusDrop && Math.random() < def.bonusDrop.chance) {
          this.entities.spawnDroppedItem(x + 0.5, y + 0.4, z + 0.5, def.bonusDrop.id, 1);
        }
        this.inventory.damageHeldTool(1);
        this.xp += 3;
        if (this.xp >= this.level * 40) {
          this.xp = 0;
          this.level += 1;
        }
      }

      this.mineProgress = 0;
      this.miningBlockKey = null;
      this.crackMesh.visible = false;
      if (onUIUpdate) onUIUpdate();
    }
  }

  _handleRightClick(onUIUpdate, onOpenCrafting) {
    // 1. Check if interacting with a special targeted block (TNT or Crafting Table)
    if (this.targetHit) {
      const { x, y, z, blockId } = this.targetHit;
      if (blockId === BLOCK.TNT) {
        this.triggerSwing();
        this.world.igniteTNT(x, y, z, this.audio, this.particles, (cx, cy, cz, radius, drops) => {
          for (const d of drops) {
            this.entities.spawnDroppedItem(d.x, d.y, d.z, d.id, 1);
          }
          const dist = this.position.distanceTo(new THREE.Vector3(cx, cy, cz));
          if (dist < radius + 1.5) {
            this.takeDamage(Math.ceil((radius + 2 - dist) * 3), this.audio);
          }
          if (onUIUpdate) onUIUpdate();
        });
        return;
      }

      if (blockId === BLOCK.CRAFTING_TABLE && !this.crouching) {
        if (onOpenCrafting) onOpenCrafting();
        return;
      }
    }

    // 2. Check if holding food
    const heldDef = this.inventory.getHeldDef();
    if (heldDef && heldDef.isFood) {
      if (this.tryEatHeldFood() && onUIUpdate) onUIUpdate();
      return;
    }

    // 3. Place held block
    if (!heldDef || !heldDef.isBlock || !this.targetHit) return;

    const { placeX, placeY, placeZ } = this.targetHit;
    if (placeY < 1 || placeY >= 63) return;

    // Prevent placing a solid block inside the player's own bounding box
    if (!heldDef.nonSolid) {
      const pMinX = this.position.x - this.halfWidth + 0.02;
      const pMaxX = this.position.x + this.halfWidth - 0.02;
      const pMinY = this.position.y + 0.02;
      const pMaxY = this.position.y + this.height - 0.02;
      const pMinZ = this.position.z - this.halfWidth + 0.02;
      const pMaxZ = this.position.z + this.halfWidth - 0.02;

      const overlapsPlayer =
        placeX + 1 > pMinX &&
        placeX < pMaxX &&
        placeY + 1 > pMinY &&
        placeY < pMaxY &&
        placeZ + 1 > pMinZ &&
        placeZ < pMaxZ;

      if (overlapsPlayer) return;
    }

    const existing = this.world.getBlock(placeX, placeY, placeZ);
    if (existing !== BLOCK.AIR && existing !== BLOCK.WATER) return;

    const placed = this.world.setBlock(placeX, placeY, placeZ, heldDef.id, true);
    if (placed) {
      this.triggerSwing();
      if (this.audio) this.audio.playBlockPlace(heldDef.sound || 'stone');
      if (this.mode === 'survival') {
        this.inventory.consumeHeld(1);
      }
      this.rebuildHeldMesh();
      if (onUIUpdate) onUIUpdate();
    }
  }

  _moveAndCollide(dt) {
    const hw = this.halfWidth;
    const h = this.crouching ? 1.48 : this.height;

    // Sneak edge protection on X
    let dx = this.velocity.x * dt;
    if (this.crouching && this.onGround) {
      if (!this.world.isSolidAt(this.position.x + dx, this.position.y - 0.3, this.position.z)) {
        dx = 0;
        this.velocity.x = 0;
      }
    }
    this.position.x += dx;
    if (this._checkAABBCollision(this.position.x, this.position.y, this.position.z, hw, h)) {
      this.position.x -= dx;
      this.velocity.x = 0;
    }

    // Sneak edge protection on Z
    let dz = this.velocity.z * dt;
    if (this.crouching && this.onGround) {
      if (!this.world.isSolidAt(this.position.x, this.position.y - 0.3, this.position.z + dz)) {
        dz = 0;
        this.velocity.z = 0;
      }
    }
    this.position.z += dz;
    if (this._checkAABBCollision(this.position.x, this.position.y, this.position.z, hw, h)) {
      this.position.z -= dz;
      this.velocity.z = 0;
    }

    // Vertical Y resolution
    const dy = this.velocity.y * dt;
    this.position.y += dy;
    this.onGround = false;

    if (this._checkAABBCollision(this.position.x, this.position.y, this.position.z, hw, h)) {
      if (dy < 0) {
        this.position.y = Math.floor(this.position.y) + 1.0001;
        this.onGround = true;
      } else if (dy > 0) {
        this.position.y -= dy;
      }
      this.velocity.y = 0;
    }

    // Keep within vertical world bounds
    if (this.position.y < 1.05) {
      this.position.y = 1.05;
      this.velocity.y = 0;
      this.onGround = true;
    }
  }

  _checkAABBCollision(px, py, pz, hw, h) {
    const minX = Math.floor(px - hw);
    const maxX = Math.floor(px + hw);
    const minY = Math.floor(py);
    const maxY = Math.floor(py + h);
    const minZ = Math.floor(pz - hw);
    const maxZ = Math.floor(pz + hw);

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (this.world.isSolidAt(x, y, z)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  syncCamera(dt = 0, horizSpeed = 0) {
    const curEye = this.crouching ? 1.32 : this.eyeHeight;
    const bobY = Math.sin(this.walkBobPhase * 2) * 0.045 * Math.min(1, horizSpeed / 4);
    const bobX = Math.cos(this.walkBobPhase) * 0.03 * Math.min(1, horizSpeed / 4);

    this.camera.position.set(this.position.x + bobX, this.position.y + curEye + bobY, this.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // First-person hand swing & bob
    if (this.isSwinging) {
      this.swingPhase += dt * 11;
      if (this.swingPhase >= Math.PI) {
        this.swingPhase = 0;
        this.isSwinging = false;
      }
    }
    const swingSin = Math.sin(this.swingPhase);
    this.heldMeshGroup.position.set(
      0.42 - swingSin * 0.14 + bobX * 0.5,
      -0.34 - swingSin * 0.1 + bobY * 0.6,
      -0.58 - swingSin * 0.12
    );
    this.heldMeshGroup.rotation.set(-swingSin * 0.85, swingSin * 0.4, -swingSin * 0.35);
  }
}
