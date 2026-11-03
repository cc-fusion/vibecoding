import * as THREE from 'three';
import { BLOCK, REGISTRY, isSolidBlock } from '../constants/Blocks.js';
import { WORLD_HEIGHT } from '../world/WorldGen.js';

const PLAYER_HALF_W = 0.30;
const PLAYER_HEIGHT = 1.80;
const EYE_STAND = 1.62;
const EYE_SNEAK = 1.38;
const GRAVITY = 26.0;
const JUMP_VEL = 8.55;
const REACH = 5.6;

export class PlayerController {
  constructor(camera, scene, world, entities, inventory, atlas, sound, mode = 'survival') {
    this.camera = camera;
    this.scene = scene;
    this.world = world;
    this.entities = entities;
    this.inventory = inventory;
    this.atlas = atlas;
    this.sound = sound;

    this.mode = mode; // 'survival' | 'creative'
    this.flying = mode === 'creative';

    this.pos = new THREE.Vector3(0.5, 48, 0.5);
    this.spawnPos = new THREE.Vector3(0.5, 48, 0.5);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.12;
    this.sensitivity = 0.0022;
    this.baseFov = 75;

    this.onGround = false;
    this.coyoteTimer = 0;
    this.inWater = false;
    this.headUnderwater = false;

    // Survival stats
    this.maxHealth = 20;
    this.health = 20;
    this.maxHunger = 20;
    this.hunger = 20;
    this.maxOxygen = 15;
    this.oxygen = 15;
    this.dead = false;
    this.hurtImmunity = 0;
    this.damageFlash = 0;
    this.hungerTick = 0;
    this.regenTick = 0;
    this.peakFallVel = 0;

    // Input state
    this.keys = {};
    this.mouseDownLeft = false;
    this.mouseDownRight = false;
    this.lastSpaceTap = 0;
    this.lastWTap = 0;
    this.sprinting = false;

    // Mining & placement state
    this.targetHit = null;
    this.mineTargetKey = '';
    this.mineProgress = 0;
    this.mineSoundTimer = 0;
    this.creativeBreakCooldown = 0;
    this.placeCooldown = 0;
    this.swingTimer = 0;
    this.walkBob = 0;
    this.stepDistance = 0;

    // Callbacks hooked by UI/Game
    this.onOpenStation = null; // ('crafting' | 'furnace')
    this.onStatsChange = null;
    this.onDeath = null;

    this.initSelectionVisuals();
    this.initViewModel();
  }

  initSelectionVisuals() {
    // Crisp 3D block outline box
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    const lineMat = new THREE.LineBasicMaterial({ color: 0x11161d, transparent: true, opacity: 0.78 });
    this.highlightBox = new THREE.LineSegments(edges, lineMat);
    this.highlightBox.visible = false;
    this.scene.add(this.highlightBox);

    // Progressive block fracture overlay cube
    this.crackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.004, 1.004, 1.004),
      this.atlas.crackMaterials[0]
    );
    this.crackMesh.visible = false;
    this.crackMesh.renderOrder = 3;
    this.scene.add(this.crackMesh);
  }

  initViewModel() {
    this.viewScene = new THREE.Scene();
    this.viewCamera = new THREE.PerspectiveCamera(70, this.camera.aspect || 1.6, 0.05, 10);
    this.viewPivot = new THREE.Group();
    this.viewScene.add(this.viewPivot);

    this.heldMesh = null;
    this.heldMat = null;
    this.heldItemId = -1;
    this.rebuildViewModel();
  }

  buildTexturedHeldCube(def) {
    const s = 0.12; // half-size -> 0.24 cube
    const texMap = def.textures || {};
    const getUv = (key) => this.atlas.uvMap?.[key] || this.atlas.uvMap?.stone || { u0: 0, v0: 0, u1: 1, v1: 1 };

    const faces = [
      { uv: getUv(texMap.top || texMap.all), shade: 1.0, tint: def.tintTop || def.tintAll, pts: [[-s, s, s], [s, s, s], [s, s, -s], [-s, s, -s]] },
      { uv: getUv(texMap.bottom || texMap.all), shade: 0.6, tint: def.tintAll, pts: [[-s, -s, -s], [s, -s, -s], [s, -s, s], [-s, -s, s]] },
      { uv: getUv(texMap.front || texMap.side || texMap.all), shade: 0.88, tint: def.tintAll, pts: [[-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s]] },
      { uv: getUv(texMap.side || texMap.all), shade: 0.82, tint: def.tintAll, pts: [[s, -s, -s], [-s, -s, -s], [-s, s, -s], [s, s, -s]] },
      { uv: getUv(texMap.side || texMap.all), shade: 0.74, tint: def.tintAll, pts: [[s, -s, s], [s, -s, -s], [s, s, -s], [s, s, s]] },
      { uv: getUv(texMap.side || texMap.all), shade: 0.74, tint: def.tintAll, pts: [[-s, -s, -s], [-s, -s, s], [-s, s, s], [-s, s, -s]] },
    ];

    const pos = [];
    const uvs = [];
    const cols = [];
    const idx = [];
    let vc = 0;

    for (const f of faces) {
      const { u0, v0, u1, v1 } = f.uv;
      const fUvs = [[u0, v1], [u1, v1], [u1, v0], [u0, v0]];
      const tr = f.tint ? 0.84 : 1.0;
      const tg = f.tint ? 1.06 : 1.0;
      const tb = f.tint ? 0.74 : 1.0;
      for (let i = 0; i < 4; i++) {
        pos.push(f.pts[i][0], f.pts[i][1], f.pts[i][2]);
        uvs.push(fUvs[i][0], fUvs[i][1]);
        cols.push(tr * f.shade, tg * f.shade, tb * f.shade);
      }
      idx.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
      vc += 4;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setIndex(idx);

    const mat = new THREE.MeshBasicMaterial({
      map: this.atlas.texture || null,
      vertexColors: true,
      alphaTest: 0.4,
      depthTest: true,
      depthWrite: true,
    });
    return { mesh: new THREE.Mesh(geo, mat), mat };
  }

  buildExtrudedItemMesh(rgba) {
    const p = 0.023;
    const z0 = -0.015;
    const z1 = 0.015;
    const pos = [];
    const cols = [];
    const idx = [];
    let vc = 0;
    const tmpCol = new THREE.Color();

    const isOpaque = (x, y) => {
      if (x < 0 || x >= 16 || y < 0 || y >= 16) return false;
      return rgba[(y * 16 + x) * 4 + 3] > 100;
    };

    const pushQuad = (pts, cr, cg, cb) => {
      for (let i = 0; i < 4; i++) {
        pos.push(pts[i][0], pts[i][1], pts[i][2]);
        cols.push(cr, cg, cb);
      }
      idx.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
      vc += 4;
    };

    for (let py = 0; py < 16; py++) {
      for (let px = 0; px < 16; px++) {
        if (!isOpaque(px, py)) continue;
        const off = (py * 16 + px) * 4;
        tmpCol.setRGB(rgba[off] / 255, rgba[off + 1] / 255, rgba[off + 2] / 255, THREE.SRGBColorSpace);
        const r = tmpCol.r, g = tmpCol.g, b = tmpCol.b;

        const x0 = (px - 8) * p;
        const x1 = x0 + p;
        const y0 = (7 - py) * p;
        const y1 = y0 + p;

        // Front (+Z) & Back (-Z)
        pushQuad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], r, g, b);
        pushQuad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], r * 0.92, g * 0.92, b * 0.92);

        // Exposed 3D voxel rim edges
        if (!isOpaque(px, py - 1)) {
          pushQuad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], r * 0.95, g * 0.95, b * 0.95);
        }
        if (!isOpaque(px, py + 1)) {
          pushQuad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], r * 0.62, g * 0.62, b * 0.62);
        }
        if (!isOpaque(px + 1, py)) {
          pushQuad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], r * 0.78, g * 0.78, b * 0.78);
        }
        if (!isOpaque(px - 1, py)) {
          pushQuad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], r * 0.78, g * 0.78, b * 0.78);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setIndex(idx);

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      depthTest: true,
      depthWrite: true,
    });
    return { mesh: new THREE.Mesh(geo, mat), mat };
  }

  rebuildViewModel() {
    const sel = this.inventory.getSelected();
    const id = sel ? sel.id : 0;
    if (id === this.heldItemId && this.heldMesh) return;
    this.heldItemId = id;

    if (this.heldMesh) {
      this.viewPivot.remove(this.heldMesh);
      this.heldMesh = null;
      this.heldMat = null;
    }

    const group = new THREE.Group();
    const def = REGISTRY[id];

    if (!sel || !def || id === BLOCK.AIR) {
      // Classic 3D voxel arm/hand
      const mat = new THREE.MeshBasicMaterial({ color: 0xdca784 });
      this.heldMat = mat;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.48, 0.16), mat);
      arm.position.set(0.42, -0.38, -0.54);
      arm.rotation.set(0.55, -0.32, -0.22);
      group.add(arm);
    } else if (def.isBlock && def.renderType === 'cube') {
      const { mesh: cube, mat } = this.buildTexturedHeldCube(def);
      this.heldMat = mat;
      cube.position.set(0.44, -0.34, -0.60);
      cube.rotation.set(0.26, 0.72, 0.04);
      group.add(cube);
    } else {
      // Extrude 16x16 pixel sprite into a true 3D voxel-thick tool/item mesh
      const rgba = this.atlas.itemPixels?.[id];
      if (rgba) {
        const { mesh, mat } = this.buildExtrudedItemMesh(rgba);
        this.heldMat = mat;
        mesh.position.set(0.42, -0.29, -0.56);
        mesh.rotation.set(0.08, -0.62, -0.12);
        group.add(mesh);
      }
    }

    this.heldMesh = group;
    this.viewPivot.add(group);
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'survival') {
      this.flying = false;
    }
    if (this.onStatsChange) this.onStatsChange();
  }

  respawn() {
    const sy = this.world.getSurfaceHeight(this.spawnPos.x, this.spawnPos.z);
    this.pos.set(this.spawnPos.x, Math.max(sy + 1.5, this.spawnPos.y), this.spawnPos.z);
    this.vel.set(0, 0, 0);
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this.oxygen = this.maxOxygen;
    this.dead = false;
    this.peakFallVel = 0;
    if (this.onStatsChange) this.onStatsChange();
  }

  takeDamage(amount, knockX = 0, knockZ = 0) {
    if (this.mode === 'creative' || this.dead || this.hurtImmunity > 0 || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtImmunity = 0.48;
    this.damageFlash = 0.32;
    this.sound.playHurt();

    const len = Math.hypot(knockX, knockZ);
    if (len > 0.001) {
      this.vel.x += (knockX / len) * 5.2;
      this.vel.y = Math.max(this.vel.y, 4.0);
      this.vel.z += (knockZ / len) * 5.2;
    }

    if (this.onStatsChange) this.onStatsChange();
    if (this.health <= 0) {
      this.dead = true;
      if (this.onDeath) this.onDeath();
    }
  }

  onMouseMove(movementX, movementY) {
    if (this.dead) return;
    this.yaw -= movementX * this.sensitivity;
    this.pitch -= movementY * this.sensitivity;
    const limit = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }

  onKeyDown(code) {
    if (this.dead) return;
    const now = performance.now();

    if (code === 'KeyW' && !this.keys.KeyW) {
      if (now - this.lastWTap < 280) this.sprinting = true;
      this.lastWTap = now;
    }

    if (code === 'Space' && !this.keys.Space) {
      if (this.mode === 'creative' && now - this.lastSpaceTap < 280) {
        this.flying = !this.flying;
        this.vel.y = 0;
      }
      this.lastSpaceTap = now;
    }

    if (code === 'KeyF' && !this.keys.KeyF) {
      if (this.mode === 'creative') {
        this.flying = !this.flying;
        this.vel.y = 0;
      }
    }

    this.keys[code] = true;
  }

  onKeyUp(code) {
    this.keys[code] = false;
    if (code === 'KeyW') this.sprinting = false;
  }

  triggerSwing() {
    this.swingTimer = 0.24;
  }

  // Exact 3D Voxel Amanatides & Woo DDA Raycast
  raycastVoxel() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const ox = this.camera.position.x;
    const oy = this.camera.position.y;
    const oz = this.camera.position.z;

    let x = Math.floor(ox);
    let y = Math.floor(oy);
    let z = Math.floor(oz);

    const stepX = dir.x >= 0 ? 1 : -1;
    const stepY = dir.y >= 0 ? 1 : -1;
    const stepZ = dir.z >= 0 ? 1 : -1;

    const tDeltaX = Math.abs(dir.x) < 1e-8 ? Infinity : Math.abs(1 / dir.x);
    const tDeltaY = Math.abs(dir.y) < 1e-8 ? Infinity : Math.abs(1 / dir.y);
    const tDeltaZ = Math.abs(dir.z) < 1e-8 ? Infinity : Math.abs(1 / dir.z);

    let tMaxX = Math.abs(dir.x) < 1e-8 ? Infinity : ((stepX > 0 ? x + 1 - ox : ox - x) * tDeltaX);
    let tMaxY = Math.abs(dir.y) < 1e-8 ? Infinity : ((stepY > 0 ? y + 1 - oy : oy - y) * tDeltaY);
    let tMaxZ = Math.abs(dir.z) < 1e-8 ? Infinity : ((stepZ > 0 ? z + 1 - oz : oz - z) * tDeltaZ);

    let nx = 0, ny = 0, nz = 0;
    let dist = 0;

    for (let i = 0; i < 32 && dist <= REACH; i++) {
      const id = this.world.getBlock(x, y, z);
      if (id !== BLOCK.AIR && id !== BLOCK.WATER) {
        return { bx: x, by: y, bz: z, nx, ny, nz, blockId: id, dist };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          dist = tMaxX;
          tMaxX += tDeltaX;
          x += stepX;
          nx = -stepX; ny = 0; nz = 0;
        } else {
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          z += stepZ;
          nx = 0; ny = 0; nz = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          dist = tMaxY;
          tMaxY += tDeltaY;
          y += stepY;
          nx = 0; ny = -stepY; nz = 0;
        } else {
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          z += stepZ;
          nx = 0; ny = 0; nz = -stepZ;
        }
      }
    }

    return null;
  }

  handleLeftClickOnce() {
    if (this.dead) return;
    this.triggerSwing();

    // Check mob melee hit first
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const mob = this.entities.raycastMob(this.camera.position, dir, 4.3);
    if (mob) {
      const sel = this.inventory.getSelected();
      const heldDef = sel ? REGISTRY[sel.id] : null;
      const dmg = (heldDef && heldDef.damage) ? heldDef.damage : 2;
      this.entities.damageMob(mob, dmg, dir.x, dir.z);
      if (this.mode === 'survival' && heldDef?.maxDurability) {
        if (this.inventory.damageSelectedTool(1) === 'broke') {
          this.sound.playToolBreak();
        }
      }
    }
  }

  handleRightClick() {
    if (this.dead || this.placeCooldown > 0) return;
    const sneaking = Boolean(this.keys.ShiftLeft || this.keys.ShiftRight);
    const hit = this.targetHit;

    // 1. Interactive block activation (Crafting Table, Furnace, TNT)
    if (hit && !sneaking) {
      const targetDef = REGISTRY[hit.blockId];
      if (targetDef?.interactive === 'crafting') {
        this.sound.playClick();
        if (this.onOpenStation) this.onOpenStation('crafting');
        this.placeCooldown = 0.25;
        return;
      }
      if (targetDef?.interactive === 'furnace') {
        this.sound.playClick();
        if (this.onOpenStation) this.onOpenStation('furnace');
        this.placeCooldown = 0.25;
        return;
      }
      if (targetDef?.interactive === 'tnt') {
        this.triggerSwing();
        this.entities.igniteTNT(hit.bx, hit.by, hit.bz);
        this.placeCooldown = 0.25;
        return;
      }
    }

    const sel = this.inventory.getSelected();
    if (!sel) return;
    const heldDef = REGISTRY[sel.id];
    if (!heldDef) return;

    // 2. Eating food
    if (heldDef.food) {
      if (this.mode === 'survival' && (this.hunger < this.maxHunger || this.health < this.maxHealth)) {
        this.triggerSwing();
        this.sound.playEat();
        this.hunger = Math.min(this.maxHunger, this.hunger + heldDef.food);
        this.health = Math.min(this.maxHealth, this.health + (heldDef.heal || 1));
        this.inventory.consumeSelected(1);
        this.placeCooldown = 0.32;
        if (this.onStatsChange) this.onStatsChange();
      }
      return;
    }

    // 3. Block Placement
    if (!heldDef.isBlock || !hit) return;

    const hitDef = REGISTRY[hit.blockId];
    const px = hitDef?.replaceable ? hit.bx : hit.bx + hit.nx;
    const py = hitDef?.replaceable ? hit.by : hit.by + hit.ny;
    const pz = hitDef?.replaceable ? hit.bz : hit.bz + hit.nz;

    if (py <= 0 || py >= WORLD_HEIGHT - 1) return;
    const existing = this.world.getBlock(px, py, pz);
    if (existing !== BLOCK.AIR && existing !== BLOCK.WATER && !REGISTRY[existing]?.replaceable) {
      return;
    }

    // Prevent placing solid block overlapping player hitbox
    if (heldDef.solid) {
      const pMinX = this.pos.x - PLAYER_HALF_W + 0.01;
      const pMaxX = this.pos.x + PLAYER_HALF_W - 0.01;
      const pMinY = this.pos.y + 0.01;
      const pMaxY = this.pos.y + PLAYER_HEIGHT - 0.01;
      const pMinZ = this.pos.z - PLAYER_HALF_W + 0.01;
      const pMaxZ = this.pos.z + PLAYER_HALF_W - 0.01;

      const overlaps =
        pMaxX > px && pMinX < px + 1 &&
        pMaxY > py && pMinY < py + 1 &&
        pMaxZ > pz && pMinZ < pz + 1;
      if (overlaps) return;
    }

    if (this.world.setBlock(px, py, pz, sel.id, true)) {
      this.triggerSwing();
      this.sound.playPlace(heldDef.sound || 'stone');
      if (this.mode === 'survival') {
        this.inventory.consumeSelected(1);
      }
      this.placeCooldown = 0.19;
    }
  }

  getNearbyStations() {
    const res = { table: false, furnace: false };
    const cx = Math.floor(this.pos.x);
    const cy = Math.floor(this.pos.y + 0.8);
    const cz = Math.floor(this.pos.z);
    for (let dy = -3; dy <= 3; dy++) {
      for (let dz = -4; dz <= 4; dz++) {
        for (let dx = -4; dx <= 4; dx++) {
          const id = this.world.getBlock(cx + dx, cy + dy, cz + dz);
          if (id === BLOCK.CRAFTING_TABLE) res.table = true;
          if (id === BLOCK.FURNACE) res.furnace = true;
          if (res.table && res.furnace) return res;
        }
      }
    }
    return res;
  }

  updateMining(dt) {
    if (!this.mouseDownLeft || !this.targetHit || this.dead) {
      this.mineProgress = 0;
      this.mineTargetKey = '';
      this.crackMesh.visible = false;
      return;
    }

    const { bx, by, bz, blockId } = this.targetHit;
    const def = REGISTRY[blockId];
    if (!def || def.unbreakable) {
      this.crackMesh.visible = false;
      return;
    }

    // Creative Mode instant break with comfortable hold repeat
    if (this.mode === 'creative') {
      if (this.creativeBreakCooldown <= 0) {
        this.triggerSwing();
        this.entities.spawnBlockParticles(bx, by, bz, blockId, 14);
        this.sound.playBreak(def.sound || 'stone');
        this.world.setBlock(bx, by, bz, BLOCK.AIR, true);
        this.creativeBreakCooldown = 0.16;
      }
      this.crackMesh.visible = false;
      return;
    }

    // Survival progressive mining
    const key = `${bx},${by},${bz}`;
    if (key !== this.mineTargetKey) {
      this.mineTargetKey = key;
      this.mineProgress = 0;
    }

    const sel = this.inventory.getSelected();
    const heldDef = sel ? REGISTRY[sel.id] : null;
    let speedMul = 1.0;
    if (heldDef && heldDef.toolType) {
      if (def.tool && heldDef.toolType === def.tool) {
        speedMul = heldDef.speed || 2.5;
      } else if (heldDef.toolType === 'sword' && (def.renderType === 'cross' || blockId === BLOCK.OAK_LEAVES)) {
        speedMul = 2.0;
      }
    }
    if (this.headUnderwater) speedMul *= 0.45;

    const totalTime = Math.max(0.05, (def.hardness || 1.0) / speedMul);
    this.mineProgress += dt / totalTime;
    this.swingTimer = Math.max(this.swingTimer, 0.12);

    this.mineSoundTimer -= dt;
    if (this.mineSoundTimer <= 0) {
      this.mineSoundTimer = 0.21;
      this.sound.playMineHit(def.sound || 'stone');
      this.entities.spawnBlockParticles(bx, by, bz, blockId, 2);
    }

    if (this.mineProgress >= 1.0) {
      this.mineProgress = 0;
      this.mineTargetKey = '';
      this.crackMesh.visible = false;

      this.sound.playBreak(def.sound || 'stone');
      this.entities.spawnBlockParticles(bx, by, bz, blockId, 16);
      this.world.setBlock(bx, by, bz, BLOCK.AIR, true);

      // Spawn drops
      const dropChance = def.dropChance ?? 1.0;
      if (Math.random() <= dropChance) {
        const dropId = def.drop || blockId;
        const dropCount = def.dropCount || 1;
        if (dropId !== BLOCK.AIR) {
          this.entities.spawnDrop(bx + 0.5, by + 0.45, bz + 0.5, dropId, dropCount);
        }
      }
      if (def.bonusDrop && Math.random() < def.bonusDrop.chance) {
        this.entities.spawnDrop(bx + 0.5, by + 0.5, bz + 0.5, def.bonusDrop.id, 1);
      }

      if (heldDef?.maxDurability) {
        if (this.inventory.damageSelectedTool(1) === 'broke') {
          this.sound.playToolBreak();
        }
      }
    } else {
      const stage = Math.min(7, Math.floor(this.mineProgress * 8));
      this.crackMesh.material = this.atlas.crackMaterials[stage];
      this.crackMesh.position.set(bx + 0.5, by + 0.5, bz + 0.5);
      this.crackMesh.visible = true;
    }
  }

  updateSurvivalStats(dt, movingHoriz) {
    if (this.hurtImmunity > 0) this.hurtImmunity -= dt;
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt);
    if (this.mode !== 'survival' || this.dead) return;

    let changed = false;

    // Underwater oxygen
    if (this.headUnderwater) {
      const prevOx = Math.ceil(this.oxygen);
      this.oxygen = Math.max(0, this.oxygen - dt);
      if (Math.ceil(this.oxygen) !== prevOx) changed = true;
      if (this.oxygen <= 0) {
        this.regenTick += dt;
        if (this.regenTick >= 1.0) {
          this.regenTick = 0;
          this.takeDamage(2);
        }
      }
    } else if (this.oxygen < this.maxOxygen) {
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + dt * 3.5);
      changed = true;
    }

    // Gradual hunger drain during exertion
    const drainRate = this.sprinting && movingHoriz ? 0.045 : movingHoriz ? 0.016 : 0.004;
    this.hungerTick += dt * drainRate;
    if (this.hungerTick >= 1.0) {
      this.hungerTick -= 1.0;
      if (this.hunger > 0) {
        this.hunger = Math.max(0, this.hunger - 1);
        changed = true;
      }
    }

    // Natural health regeneration when well-fed (hunger >= 15)
    if (this.hunger >= 15 && this.health < this.maxHealth && !this.headUnderwater) {
      this.regenTick += dt;
      if (this.regenTick >= 3.0) {
        this.regenTick = 0;
        this.health = Math.min(this.maxHealth, this.health + 1);
        changed = true;
      }
    }

    if (changed && this.onStatsChange) this.onStatsChange();
  }

  update(dt, controlsEnabled = true) {
    if (this.creativeBreakCooldown > 0) this.creativeBreakCooldown -= dt;
    if (this.placeCooldown > 0) this.placeCooldown -= dt;

    // Sub-step physics if frame delta is large to guarantee zero tunneling
    const clampedDt = Math.min(dt, 0.06);
    const steps = clampedDt > 0.025 ? 2 : 1;
    const subDt = clampedDt / steps;

    const sneaking = controlsEnabled && !this.flying && Boolean(this.keys.ShiftLeft || this.keys.ShiftRight);
    const sprintHeld = controlsEnabled && Boolean(this.keys.ControlLeft || this.keys.ControlRight || this.sprinting);

    for (let s = 0; s < steps; s++) {
      this.stepPhysics(subDt, controlsEnabled && !this.dead, sneaking, sprintHeld);
    }

    // Smooth camera eye height & dynamic sprint FOV
    const targetEye = sneaking ? EYE_SNEAK : EYE_STAND;
    const curEye = this.camera.position.y - this.pos.y;
    const nextEye = curEye + (targetEye - curEye) * Math.min(1, clampedDt * 14);

    // Subtle head bobbing while walking on solid ground
    const speedH = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && speedH > 0.3 && !this.flying) {
      this.walkBob += clampedDt * speedH * 2.1;
    } else {
      this.walkBob *= 0.88;
    }
    const bobY = this.onGround ? Math.sin(this.walkBob * 2) * 0.032 * Math.min(1, speedH / 4) : 0;

    this.camera.position.set(this.pos.x, this.pos.y + nextEye + bobY, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    const targetFov = sprintHeld && speedH > 3.5 ? this.baseFov + 7 : this.baseFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, clampedDt * 10);
      this.camera.updateProjectionMatrix();
    }

    // Underwater check at eye level
    const eyeBlock = this.world.getBlock(this.camera.position.x, this.camera.position.y, this.camera.position.z);
    this.headUnderwater = eyeBlock === BLOCK.WATER;
    this.atlas.sharedUniforms.uUnderwater.value = this.headUnderwater ? 1.0 : 0.0;

    // Survival stats
    this.updateSurvivalStats(clampedDt, speedH > 0.4);

    // Raycast & Mining/Placement
    if (controlsEnabled && !this.dead) {
      this.targetHit = this.raycastVoxel();
      if (this.targetHit) {
        this.highlightBox.position.set(this.targetHit.bx + 0.5, this.targetHit.by + 0.5, this.targetHit.bz + 0.5);
        this.highlightBox.visible = true;
      } else {
        this.highlightBox.visible = false;
      }
      this.updateMining(clampedDt);
      if (this.mouseDownRight) {
        this.handleRightClick();
      }
    } else {
      this.highlightBox.visible = false;
      this.crackMesh.visible = false;
    }

    // Animate 3D held viewModel & modulate brightness with local daylight/torchlight
    this.rebuildViewModel();
    if (this.heldMat) {
      const sun = this.atlas.sharedUniforms.uSunLevel?.value ?? 1.0;
      const skyExp = this.world.getSkyLight(this.pos.x, this.pos.y + 1, this.pos.z) / 15;
      const blkExp = this.world.getVoxelLight(this.pos.x, this.pos.y + 1, this.pos.z) / 15;
      const sel = this.inventory.getSelected();
      const selfEmit = sel ? (REGISTRY[sel.id]?.light || 0) / 15 : 0;
      const lit = Math.max(0.32, skyExp * sun, blkExp, selfEmit);
      if (!sel || sel.id === BLOCK.AIR) {
        this.heldMat.color.setRGB(0.86 * lit, 0.65 * lit, 0.52 * lit);
      } else {
        this.heldMat.color.setScalar(lit);
      }
    }
    if (this.swingTimer > 0) {
      this.swingTimer = Math.max(0, this.swingTimer - clampedDt);
    }
    const swingPhase = this.swingTimer > 0 ? Math.sin((1 - this.swingTimer / 0.24) * Math.PI) : 0;
    this.viewPivot.position.set(
      Math.cos(this.walkBob) * 0.018 * Math.min(1, speedH / 4),
      Math.abs(Math.sin(this.walkBob)) * -0.022 * Math.min(1, speedH / 4) - swingPhase * 0.08,
      -swingPhase * 0.10
    );
    this.viewPivot.rotation.set(-swingPhase * 0.72, swingPhase * 0.28, swingPhase * 0.18);
  }

  stepPhysics(dt, activeInput, sneaking, sprinting) {
    // Auxiliary smooth Arrow-key camera look (helpful on trackpads or restricted iframes)
    if (activeInput) {
      const turnRate = 2.15 * dt;
      if (this.keys.ArrowLeft) this.yaw += turnRate;
      if (this.keys.ArrowRight) this.yaw -= turnRate;
      if (this.keys.ArrowUp) this.pitch = Math.min(Math.PI / 2 - 0.02, this.pitch + turnRate * 0.8);
      if (this.keys.ArrowDown) this.pitch = Math.max(-Math.PI / 2 + 0.02, this.pitch - turnRate * 0.8);
    }

    // Movement direction in XZ plane
    let moveF = 0;
    let moveR = 0;
    if (activeInput) {
      if (this.keys.KeyW) moveF += 1;
      if (this.keys.KeyS) moveF -= 1;
      if (this.keys.KeyD) moveR += 1;
      if (this.keys.KeyA) moveR -= 1;
    }
    const len = Math.hypot(moveF, moveR);
    if (len > 1) {
      moveF /= len;
      moveR /= len;
    }

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const wishX = -sinY * moveF + cosY * moveR;
    const wishZ = -cosY * moveF - sinY * moveR;

    // Check water immersion
    const feetWater = this.world.getBlock(this.pos.x, this.pos.y + 0.2, this.pos.z) === BLOCK.WATER;
    const waistWater = this.world.getBlock(this.pos.x, this.pos.y + 0.9, this.pos.z) === BLOCK.WATER;
    const wasInWater = this.inWater;
    this.inWater = feetWater || waistWater;
    if (this.inWater && !wasInWater && this.vel.y < -3.5) {
      this.sound.playSplash();
      this.entities.spawnCustomParticles(this.pos.x, this.pos.y + 0.4, this.pos.z, 0x74c0fc, 12, 3.2, 9);
    }

    if (this.flying) {
      const flySpeed = sprinting ? 16.5 : 10.5;
      this.vel.x += (wishX * flySpeed - this.vel.x) * Math.min(1, dt * 11);
      this.vel.z += (wishZ * flySpeed - this.vel.z) * Math.min(1, dt * 11);
      let flyY = 0;
      if (activeInput && this.keys.Space) flyY += 1;
      if (activeInput && (this.keys.ShiftLeft || this.keys.ShiftRight)) flyY -= 1;
      this.vel.y += (flyY * 8.5 - this.vel.y) * Math.min(1, dt * 12);
      this.peakFallVel = 0;
    } else if (this.inWater) {
      const swimSpeed = sprinting ? 4.8 : 3.5;
      this.vel.x += (wishX * swimSpeed - this.vel.x) * Math.min(1, dt * 7);
      this.vel.z += (wishZ * swimSpeed - this.vel.z) * Math.min(1, dt * 7);
      this.vel.y -= GRAVITY * 0.26 * dt;
      this.vel.y *= Math.pow(0.25, dt);
      if (activeInput && this.keys.Space) {
        this.vel.y = waistWater ? 4.2 : 6.6; // Extra boost at water surface to step onto shore effortlessly
      } else if (activeInput && (this.keys.ShiftLeft || this.keys.ShiftRight)) {
        this.vel.y = -3.4;
      }
      this.peakFallVel = 0;
    } else {
      const groundId = this.world.getBlock(this.pos.x, this.pos.y - 0.15, this.pos.z);
      const slippery = Boolean(REGISTRY[groundId]?.slippery);
      const targetSpeed = sneaking ? 2.15 : (sprinting && this.hunger > 4 ? 6.45 : 4.55);
      const accel = this.onGround ? (slippery ? 3.2 : 16.0) : 5.5;

      this.vel.x += (wishX * targetSpeed - this.vel.x) * Math.min(1, dt * accel);
      this.vel.z += (wishZ * targetSpeed - this.vel.z) * Math.min(1, dt * accel);

      if (this.onGround) this.coyoteTimer = 0.085;
      else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

      if (activeInput && this.keys.Space && this.coyoteTimer > 0) {
        this.vel.y = JUMP_VEL;
        this.onGround = false;
        this.coyoteTimer = 0;
      }

      this.vel.y -= GRAVITY * dt;
      if (this.vel.y < -38) this.vel.y = -38;
      if (this.vel.y < this.peakFallVel) this.peakFallVel = this.vel.y;
    }

    // Axis-separated AABB resolution: Y -> X -> Z
    const prevGround = this.onGround;
    const dy = this.vel.y * dt;
    if (this.collidesAt(this.pos.x, this.pos.y + dy, this.pos.z)) {
      if (dy < 0) {
        this.pos.y = Math.floor(this.pos.y + dy) + 1.0001;
        this.onGround = true;
        // Survival fall damage if falling faster than ~4 blocks (> 13.5 m/s)
        if (!prevGround && this.peakFallVel < -13.8 && !this.inWater && !this.flying) {
          const dmg = Math.floor((-this.peakFallVel - 12.2) * 0.65);
          if (dmg > 0) this.takeDamage(dmg);
        }
        this.peakFallVel = 0;
      } else if (dy > 0) {
        this.pos.y = Math.floor(this.pos.y + PLAYER_HEIGHT + dy) - PLAYER_HEIGHT - 0.0002;
      }
      this.vel.y = 0;
    } else {
      this.pos.y += dy;
      this.onGround = false;
    }

    // X movement + Shift sneak edge-guard
    let dx = this.vel.x * dt;
    if (sneaking && this.onGround && dx !== 0) {
      if (!this.collidesAt(this.pos.x + dx, this.pos.y - 0.12, this.pos.z)) {
        dx = 0;
        this.vel.x = 0;
      }
    }
    if (!this.collidesAt(this.pos.x + dx, this.pos.y, this.pos.z)) {
      this.pos.x += dx;
    } else {
      this.vel.x = 0;
    }

    // Z movement + Shift sneak edge-guard
    let dz = this.vel.z * dt;
    if (sneaking && this.onGround && dz !== 0) {
      if (!this.collidesAt(this.pos.x, this.pos.y - 0.12, this.pos.z + dz)) {
        dz = 0;
        this.vel.z = 0;
      }
    }
    if (!this.collidesAt(this.pos.x, this.pos.y, this.pos.z + dz)) {
      this.pos.z += dz;
    } else {
      this.vel.z = 0;
    }

    // Footstep audio cadence
    if (this.onGround && !sneaking) {
      const moved = Math.hypot(dx, dz);
      this.stepDistance += moved;
      if (this.stepDistance >= 2.05) {
        this.stepDistance = 0;
        const underId = this.world.getBlock(this.pos.x, this.pos.y - 0.2, this.pos.z);
        const matSound = REGISTRY[underId]?.sound || 'grass';
        this.sound.playStep(matSound);
      }
    }
  }

  collidesAt(x, y, z) {
    const minX = Math.floor(x - PLAYER_HALF_W);
    const maxX = Math.floor(x + PLAYER_HALF_W);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + PLAYER_HEIGHT - 0.001);
    const minZ = Math.floor(z - PLAYER_HALF_W);
    const maxZ = Math.floor(z + PLAYER_HALF_W);

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
}
