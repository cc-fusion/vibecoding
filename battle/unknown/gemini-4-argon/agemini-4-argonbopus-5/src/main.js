import * as THREE from 'three';
import {
  GAME_MODES,
  WEATHER_TYPES,
  BIOMES,
  PLAYER_EYE_HEIGHT,
  PLAYER_CROUCH_EYE_HEIGHT,
} from './game/constants.js';
import { BLOCK, ITEM, getItemDef } from './game/blocks.js';
import { MILESTONES } from './game/recipes.js';
import { buildTextureSystem } from './game/textures.js';
import { createVoxelMaterials } from './game/materials.js';
import { World } from './game/world.js';
import { stepPlayerPhysics, raycastVoxel, canPlaceBlockAt } from './game/physics.js';
import { Inventory } from './game/inventory.js';
import { EnvironmentSystem } from './game/environment.js';
import { ParticleSystem } from './game/particles.js';
import { EntityManager } from './game/entities.js';
import { HandAndTargetView } from './game/hand.js';
import { SoundEngine } from './game/audio.js';
import { WorldStorage } from './game/storage.js';
import { GameUI } from './game/ui.js';

class TerravoxGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.08, 360);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // Core subsystems
    this.textures = buildTextureSystem();
    this.materials = createVoxelMaterials(this.textures.atlasTexture);
    this.env = new EnvironmentSystem(this.scene, this.materials.uniforms);
    this.particles = new ParticleSystem(this.scene);
    this.handView = new HandAndTargetView(this.scene, this.camera, this.textures);
    this.audio = new SoundEngine();
    this.storage = new WorldStorage();
    this.inventory = new Inventory();

    this.world = null;
    this.entities = null;

    // Settings
    this.settings = {
      renderDistance: 5,
      fov: 78,
      sensitivity: 1.0,
      volume: 0.65,
    };

    // Active world metadata & player state
    this.state = 'title'; // 'title' | 'playing' | 'inventory' | 'paused' | 'dead'
    this.worldMeta = {
      id: '',
      name: 'Emerald Frontier',
      seed: 'emerald-valley-7',
      mode: GAME_MODES.SURVIVAL,
    };

    this.player = {
      pos: new THREE.Vector3(8.5, 65, 8.5),
      vel: new THREE.Vector3(0, 0, 0),
      spawnPos: { x: 8.5, y: 65, z: 8.5 },
      yaw: 0,
      pitch: -0.12,
      onGround: false,
      crouching: false,
      flying: false,
      inWater: false,
      inLava: false,
      headUnderwater: false,
      fallPeakY: 65,
      health: 20,
      hunger: 20,
      oxygen: 20,
      hurtImmunity: 0,
      regenTimer: 0,
      exertion: 0,
    };

    this.completedMilestones = new Set();
    this.stats = { placedTable: false, blocksMined: 0, blocksPlaced: 0 };

    // Input & Mining state
    this.keys = new Set();
    this.mouseDownLeft = false;
    this.mouseDownRight = false;
    this.rightClickCooldown = 0;
    this.attackCooldown = 0;
    this.creativeBreakCooldown = 0;
    this.lastSpaceTap = 0;

    this.mining = {
      active: false,
      bx: 0, by: 0, bz: 0,
      progress: 0,
      chipTimer: 0,
      warnedTier: false,
    };

    this.currentRayHit = null;
    this.hadPointerLock = false;
    this.lastPauseOpenTime = 0;
    this.torchEmberTimer = 0;
    this.flyoverAngle = 0;
    this.autoSaveTimer = 0;
    this.fpsFrames = 0;
    this.fpsAccum = 0;
    this.fpsDisplay = 60;

    this.ui = new GameUI({
      textures: this.textures,
      callbacks: {
        onCreateWorld: (cfg) => this.startNewWorld(cfg),
        onLoadWorld: (id) => this.loadExistingWorld(id),
        onDeleteWorld: (id) => this.deleteSavedWorld(id),
        onSelectHotbar: (idx) => this.selectHotbarSlot(idx),
        onCloseModal: () => this.resumeGameplay(),
        onRefreshWorkshop: () => this.refreshOpenWorkshop(),
        onCraftRecipe: (r) => this.handleCraft(r),
        onSmeltRecipe: (sr) => this.handleSmelt(sr),
        onResume: () => this.resumeGameplay(),
        onSaveNow: () => this.saveCurrentWorld(true),
        onSaveAndExit: () => this.saveAndReturnToTitle(),
        onSettingChange: (k, v) => this.applySetting(k, v),
        onSetTime: (t) => {
          this.env.setTimeOfDay(t);
          this.ui.showToast(`Time set to ${this.env.getPhaseLabel()}`);
        },
        onCycleWeather: () => this.cycleWeather(),
        onRespawn: () => this.respawnPlayer(),
      },
    });

    this.bindInputEvents();
    this.initTitleShowcase();

    this.lastTime = performance.now();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  async initTitleShowcase() {
    this.disposeActiveWorld();
    this.world = new World({
      scene: this.scene,
      seed: 'emerald-valley-7',
      materials: this.materials,
      uvMap: this.textures.uvMap,
      renderDistance: 4,
    });
    const center = this.world.terrain.findSafeSpawn();
    this.showcaseCenter = center;
    this.world.preloadAround(center.x, center.z, 3);
    this.env.setTimeOfDay(0.34);
    this.handView.handPivot.visible = false;
    this.handView.updateTarget(null, 0);

    const saved = await this.storage.listWorlds();
    this.ui.showTitleScreen(saved);
  }

  disposeActiveWorld() {
    if (this.world) {
      this.world.dispose();
      this.world = null;
    }
    if (this.entities) {
      this.entities.dispose();
      this.entities = null;
    }
  }

  async startNewWorld({ name, seed, mode }) {
    this.audio.unlock();
    this.disposeActiveWorld();

    const id = `world_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.worldMeta = { id, name, seed, mode };

    this.world = new World({
      scene: this.scene,
      seed,
      materials: this.materials,
      uvMap: this.textures.uvMap,
      renderDistance: this.settings.renderDistance,
    });

    this.entities = new EntityManager(this.scene, this.textures.iconUrls);

    const spawn = this.world.terrain.findSafeSpawn();
    this.world.preloadAround(spawn.x, spawn.z, 3);
    const exactSurface = this.world.getSurfaceHeight(spawn.x, spawn.z);
    const startY = exactSurface + 1.05;

    this.player.pos.set(spawn.x, startY, spawn.z);
    this.player.vel.set(0, 0, 0);
    this.player.spawnPos = { x: spawn.x, y: startY, z: spawn.z };
    this.player.yaw = 0.4;
    this.player.pitch = -0.1;
    this.player.flying = false;
    this.player.health = 20;
    this.player.hunger = 20;
    this.player.oxygen = 20;
    this.player.fallPeakY = startY;

    this.inventory.initStarterKit(mode);
    this.completedMilestones.clear();
    this.stats = { placedTable: false, blocksMined: 0, blocksPlaced: 0 };

    this.env.dayCount = 1;
    this.env.setTimeOfDay(0.31);
    this.env.setWeather(WEATHER_TYPES.CLEAR);

    // Seed initial nearby passive fauna so the world feels vibrant immediately
    this.seedInitialWildlife(spawn.x, spawn.z);

    this.enterGameplayState();
    await this.saveCurrentWorld(false);
  }

  async loadExistingWorld(id) {
    this.audio.unlock();
    const record = await this.storage.loadWorld(id);
    if (!record) return;

    this.disposeActiveWorld();
    this.worldMeta = {
      id: record.id,
      name: record.name,
      seed: record.seed,
      mode: record.mode || GAME_MODES.SURVIVAL,
    };

    this.world = new World({
      scene: this.scene,
      seed: record.seed,
      materials: this.materials,
      uvMap: this.textures.uvMap,
      savedDeltas: record.deltas || null,
      renderDistance: this.settings.renderDistance,
    });

    this.entities = new EntityManager(this.scene, this.textures.iconUrls);

    const p = record.player || {};
    const px = p.pos?.x ?? 8.5;
    const pz = p.pos?.z ?? 8.5;
    this.world.preloadAround(px, pz, 3);
    const py = p.pos?.y ?? (this.world.getSurfaceHeight(px, pz) + 1.05);

    this.player.pos.set(px, py, pz);
    this.player.vel.set(0, 0, 0);
    this.player.spawnPos = p.spawnPos || { x: px, y: py, z: pz };
    this.player.yaw = p.yaw ?? 0;
    this.player.pitch = p.pitch ?? -0.1;
    this.player.flying = Boolean(p.flying && this.worldMeta.mode === GAME_MODES.CREATIVE);
    this.player.health = p.health ?? 20;
    this.player.hunger = p.hunger ?? 20;
    this.player.oxygen = p.oxygen ?? 20;
    this.player.fallPeakY = py;

    this.inventory.importState(record.inventory);
    this.completedMilestones = new Set(record.milestones || []);
    this.stats = record.stats || { placedTable: false, blocksMined: 0, blocksPlaced: 0 };

    this.env.dayCount = record.dayCount || 1;
    this.env.setTimeOfDay(record.timeOfDay ?? 0.32);
    this.env.setWeather(record.weather || WEATHER_TYPES.CLEAR);

    this.seedInitialWildlife(px, pz);
    this.enterGameplayState();
  }

  seedInitialWildlife(cx, cz) {
    const types = ['sheep', 'sheep', 'pig', 'cow'];
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + 0.5;
      const wx = Math.floor(cx + Math.cos(ang) * 11);
      const wz = Math.floor(cz + Math.sin(ang) * 11);
      const wy = this.world.getSurfaceHeight(wx, wz);
      const ground = this.world.getBlock(wx, wy, wz);
      if (ground === BLOCK.GRASS || ground === BLOCK.SNOW_GRASS) {
        this.entities.spawnCreature(types[i], wx + 0.5, wy + 1.05, wz + 0.5);
      }
    }
  }

  async deleteSavedWorld(id) {
    await this.storage.deleteWorld(id);
    const saved = await this.storage.listWorlds();
    this.ui.renderSavedWorlds(saved);
  }

  enterGameplayState() {
    this.state = 'playing';
    this.handView.handPivot.visible = true;
    this.ui.showGameplayHUD(this.worldMeta.mode);
    this.ui.renderHotbar(this.inventory);
    this.ui.renderVitals(this.player.health, this.player.hunger, this.player.oxygen, false);
    this.ui.updateObjective(this.completedMilestones, this.worldMeta.mode);
    this.syncHeldView();
    this.requestPointerLockSafe();
  }

  requestPointerLockSafe() {
    try {
      if (document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock?.();
      }
    } catch {
      // Safe fallback when pointer lock is restricted
    }
  }

  releasePointerLockSafe() {
    this.hadPointerLock = false;
    try {
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    } catch {
      // Ignore
    }
  }

  async saveCurrentWorld(notify = false) {
    if (!this.world || !this.worldMeta.id) return;
    const biome = this.world.getBiomeAt(this.player.pos.x, this.player.pos.z);
    const record = {
      id: this.worldMeta.id,
      name: this.worldMeta.name,
      seed: this.worldMeta.seed,
      mode: this.worldMeta.mode,
      biomeName: biome.name,
      dayCount: this.env.dayCount,
      timeOfDay: this.env.timeOfDay,
      weather: this.env.weather,
      player: {
        pos: { x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z },
        spawnPos: this.player.spawnPos,
        yaw: this.player.yaw,
        pitch: this.player.pitch,
        flying: this.player.flying,
        health: this.player.health,
        hunger: this.player.hunger,
        oxygen: this.player.oxygen,
      },
      inventory: this.inventory.exportState(),
      milestones: Array.from(this.completedMilestones),
      stats: this.stats,
      deltas: this.world.exportDeltas(),
    };
    await this.storage.saveWorld(record);
    if (notify) {
      this.ui.showToast('World saved');
    }
  }

  async saveAndReturnToTitle() {
    await this.saveCurrentWorld(false);
    this.releasePointerLockSafe();
    this.state = 'title';
    await this.initTitleShowcase();
  }

  applySetting(key, val) {
    this.settings[key] = val;
    if (key === 'renderDistance' && this.world) {
      this.world.setRenderDistance(val);
    } else if (key === 'fov') {
      this.camera.fov = val;
      this.camera.updateProjectionMatrix();
    } else if (key === 'volume') {
      this.audio.setVolume(val);
    }
  }

  cycleWeather() {
    const order = [WEATHER_TYPES.CLEAR, WEATHER_TYPES.RAIN, WEATHER_TYPES.SNOW];
    const next = order[(order.indexOf(this.env.weather) + 1) % order.length];
    this.env.setWeather(next);
    const label = next === WEATHER_TYPES.CLEAR ? 'Clear Skies' : (next === WEATHER_TYPES.SNOW ? 'Snowfall' : 'Rain');
    this.ui.showToast(`Weather: ${label}`);
  }

  selectHotbarSlot(idx) {
    this.inventory.selectSlot(idx);
    this.ui.renderHotbar(this.inventory);
    const def = this.inventory.getActiveItemDef();
    this.ui.showHeldItemBanner(def ? def.name : '');
    this.syncHeldView();
    this.mining.progress = 0;
  }

  syncHeldView() {
    const st = this.inventory.getActiveStack();
    this.handView.setHeldItem(st ? st.id : 0);
  }

  getStationContext() {
    const hasTable = this.world
      ? this.world.hasBlockNearby(this.player.pos.x, this.player.pos.y + 0.8, this.player.pos.z, BLOCK.CRAFTING_TABLE, 4)
      : false;
    const hasFurnace = this.world
      ? this.world.hasBlockNearby(this.player.pos.x, this.player.pos.y + 0.8, this.player.pos.z, BLOCK.FURNACE, 4)
      : false;
    const isCreative = this.worldMeta.mode === GAME_MODES.CREATIVE;
    return { inventory: this.inventory, hasTable, hasFurnace, isCreative };
  }

  openInventory(initialTab = 'craft', forceStation = null) {
    if (this.state !== 'playing' && this.state !== 'inventory') return;
    this.state = 'inventory';
    this.keys.clear();
    this.mouseDownLeft = false;
    this.mouseDownRight = false;
    this.releasePointerLockSafe();

    const ctx = this.getStationContext();
    if (forceStation === 'table') ctx.hasTable = true;
    if (forceStation === 'furnace') ctx.hasFurnace = true;
    this.forcedStation = forceStation;

    this.ui.openInventoryModal({ ...ctx, initialTab });
  }

  refreshOpenWorkshop() {
    if (this.state !== 'inventory') return;
    const ctx = this.getStationContext();
    if (this.forcedStation === 'table') ctx.hasTable = true;
    if (this.forcedStation === 'furnace') ctx.hasFurnace = true;
    this.ui.refreshWorkshop(ctx);
  }

  openPauseMenu() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.lastPauseOpenTime = performance.now();
    this.keys.clear();
    this.mouseDownLeft = false;
    this.mouseDownRight = false;
    this.releasePointerLockSafe();
    this.ui.openPauseModal(this.worldMeta);
  }

  resumeGameplay() {
    if (this.state === 'inventory') {
      this.ui.closeInventoryModal(this.inventory);
      this.forcedStation = null;
    } else if (this.state === 'paused') {
      this.ui.closePauseModal();
    }
    this.state = 'playing';
    this.ui.renderHotbar(this.inventory);
    this.syncHeldView();
    this.requestPointerLockSafe();
  }

  handleCraft(recipe) {
    const ctx = this.getStationContext();
    if (this.forcedStation === 'table') ctx.hasTable = true;
    const res = this.inventory.craft(recipe, ctx.hasTable, ctx.isCreative);
    if (res && res.crafted) {
      this.audio.playCraft();
      if (res.leftover > 0 && this.entities) {
        this.entities.spawnDrop(res.result.id, res.leftover, this.player.pos.x, this.player.pos.y + 1.1, this.player.pos.z);
      }
      this.ui.renderHotbar(this.inventory);
      this.syncHeldView();
      this.refreshOpenWorkshop();
      this.checkMilestones();
    }
  }

  handleSmelt(smeltRecipe) {
    const ctx = this.getStationContext();
    if (this.forcedStation === 'furnace') ctx.hasFurnace = true;
    const res = this.inventory.smelt(smeltRecipe, ctx.hasFurnace, ctx.isCreative);
    if (res && res.smelted) {
      this.audio.playCraft();
      if (res.leftover > 0 && this.entities) {
        this.entities.spawnDrop(res.output.id, res.leftover, this.player.pos.x, this.player.pos.y + 1.1, this.player.pos.z);
      }
      this.ui.renderHotbar(this.inventory);
      this.syncHeldView();
      this.refreshOpenWorkshop();
      this.checkMilestones();
    }
  }

  checkMilestones() {
    if (this.worldMeta.mode === GAME_MODES.CREATIVE) return;
    let changed = false;
    for (const m of MILESTONES) {
      if (!this.completedMilestones.has(m.id) && m.check(this.inventory, this.stats)) {
        this.completedMilestones.add(m.id);
        this.ui.showToast(`Milestone Unlocked: ${m.title}!`);
        this.audio.playCraft();
        changed = true;
      }
    }
    if (changed) {
      this.ui.updateObjective(this.completedMilestones, this.worldMeta.mode);
    }
  }

  bindInputEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === this.canvas) {
        this.hadPointerLock = true;
        this.pointerLockEngageTime = performance.now();
      } else if (this.hadPointerLock) {
        this.hadPointerLock = false;
        if (this.state === 'playing') {
          this.openPauseMenu();
        }
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

      if (e.code === 'F3') {
        e.preventDefault();
        if (this.state === 'playing') this.ui.toggleDebug();
        return;
      }

      if (e.code === 'KeyE') {
        e.preventDefault();
        if (this.state === 'playing') this.openInventory('craft');
        else if (this.state === 'inventory') this.resumeGameplay();
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        if (!this.ui.el.controlsModal.classList.contains('hidden')) {
          this.ui.el.controlsModal.classList.add('hidden');
          return;
        }
        if (this.state === 'inventory') {
          this.resumeGameplay();
        } else if (this.state === 'paused') {
          if (performance.now() - this.lastPauseOpenTime > 180) {
            this.resumeGameplay();
          }
        } else if (this.state === 'playing') {
          this.openPauseMenu();
        }
        return;
      }

      if (this.state !== 'playing') return;

      // Hotbar 1-9
      if (e.code.startsWith('Digit')) {
        const num = Number(e.code.slice(5));
        if (num >= 1 && num <= 9) {
          this.selectHotbarSlot(num - 1);
          return;
        }
      }

      // Creative Flight Toggle (F or double-tap Space)
      if (e.code === 'KeyF' && this.worldMeta.mode === GAME_MODES.CREATIVE && !e.repeat) {
        this.toggleCreativeFlight();
        return;
      }

      if (e.code === 'Space' && !e.repeat && this.worldMeta.mode === GAME_MODES.CREATIVE) {
        const now = performance.now();
        if (now - this.lastSpaceTap < 290) {
          this.toggleCreativeFlight();
          this.lastSpaceTap = 0;
        } else {
          this.lastSpaceTap = now;
        }
      }

      this.keys.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('mousedown', (e) => {
      this.audio.unlock();
      if (this.state !== 'playing') return;
      if (e.target && e.target.closest && e.target.closest('.hotbar, .overlay-screen')) return;

      if (document.pointerLockElement !== this.canvas) {
        this.requestPointerLockSafe();
      }

      if (e.button === 0) {
        this.mouseDownLeft = true;
        this.tryMeleeAttack();
      } else if (e.button === 2) {
        this.mouseDownRight = true;
        this.handleRightClickAction();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouseDownLeft = false;
        this.mining.progress = 0;
      } else if (e.button === 2) {
        this.mouseDownRight = false;
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mousemove', (e) => {
      if (this.state !== 'playing') return;
      if (this.pointerLockEngageTime && performance.now() - this.pointerLockEngageTime < 65) return;
      if (Math.abs(e.movementX) > 180 || Math.abs(e.movementY) > 180) return;

      if (document.pointerLockElement === this.canvas || (e.buttons === 1 && !this.currentRayHit)) {
        const sens = 0.0022 * this.settings.sensitivity;
        this.player.yaw -= e.movementX * sens;
        this.player.pitch = Math.max(
          -Math.PI * 0.495,
          Math.min(Math.PI * 0.495, this.player.pitch - e.movementY * sens)
        );
      }
    });

    window.addEventListener('wheel', (e) => {
      if (this.state !== 'playing') return;
      const dir = e.deltaY > 0 ? 1 : -1;
      this.selectHotbarSlot(this.inventory.selectedSlot + dir);
    }, { passive: true });

    window.addEventListener('beforeunload', () => {
      if (this.world && this.state !== 'title') {
        this.saveCurrentWorld(false);
      }
    });
  }

  toggleCreativeFlight() {
    this.player.flying = !this.player.flying;
    this.player.vel.y = 0;
    this.player.fallPeakY = this.player.pos.y;
    this.ui.showToast(this.player.flying ? 'Flight Enabled' : 'Flight Disabled');
  }

  getEyePosition() {
    const eyeH = this.player.crouching && !this.player.flying
      ? PLAYER_CROUCH_EYE_HEIGHT
      : PLAYER_EYE_HEIGHT;
    return {
      x: this.player.pos.x,
      y: this.player.pos.y + eyeH,
      z: this.player.pos.z,
    };
  }

  getLookDirection() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(new THREE.Euler(this.player.pitch, this.player.yaw, 0, 'YXZ'));
    return dir;
  }

  tryMeleeAttack() {
    if (!this.entities || this.attackCooldown > 0) return false;
    const eye = this.getEyePosition();
    const dir = this.getLookDirection();
    const mobHit = this.entities.raycastCreature(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, 4.3);

    if (mobHit && (!this.currentRayHit || mobHit.distance < this.currentRayHit.distance + 0.25)) {
      this.attackCooldown = 0.38;
      this.handView.triggerSwing();
      this.audio.playAttack();

      const activeDef = this.inventory.getActiveItemDef();
      const dmg = this.worldMeta.mode === GAME_MODES.CREATIVE ? 20 : (activeDef?.damage || 1.5);

      this.entities.hitCreature(mobHit.creature, dmg, this.player.pos, {
        onHitEffect: (hx, hy, hz) => this.particles.emitHitSpark(hx, hy, hz),
      });

      if (this.worldMeta.mode === GAME_MODES.SURVIVAL && activeDef?.durability) {
        const res = this.inventory.damageActiveTool(1);
        if (res.broke) {
          this.ui.showToast(`${activeDef.name} broke!`);
          this.syncHeldView();
        }
        this.ui.renderHotbar(this.inventory);
      }
      return true;
    }
    return false;
  }

  handleRightClickAction() {
    if (this.rightClickCooldown > 0 || !this.world) return;
    this.rightClickCooldown = 0.22;

    const hit = this.currentRayHit;
    const sneaking = this.keys.has('KeyC');

    // 1. Interact with world utility blocks (Crafting Table, Stone Furnace, Cozy Bed)
    if (hit && !sneaking) {
      const targetDef = getItemDef(hit.blockId);
      if (targetDef.interactive === 'crafting') {
        this.openInventory('craft', 'table');
        return;
      }
      if (targetDef.interactive === 'furnace') {
        this.openInventory('smelt', 'furnace');
        return;
      }
      if (targetDef.interactive === 'bed') {
        this.useCozyBed(hit.bx, hit.by, hit.bz);
        return;
      }
    }

    const activeStack = this.inventory.getActiveStack();
    if (!activeStack) return;
    const itemDef = getItemDef(activeStack.id);

    // 2. Eat Food in Survival Mode
    if (itemDef.food && this.worldMeta.mode === GAME_MODES.SURVIVAL) {
      if (this.player.hunger < 20 || this.player.health < 20) {
        this.audio.playEat();
        this.handView.triggerSwing();
        this.player.hunger = Math.min(20, this.player.hunger + itemDef.food.hunger);
        this.player.health = Math.min(20, this.player.health + itemDef.food.heal);
        this.inventory.consumeFromSlot(this.inventory.selectedSlot, 1);
        this.ui.renderHotbar(this.inventory);
        this.ui.renderVitals(this.player.health, this.player.hunger, this.player.oxygen, this.player.headUnderwater);
        this.syncHeldView();
      } else {
        this.ui.showToast('Already well-fed!');
      }
      return;
    }

    // 3. Place Voxel Block
    if (itemDef.isBlock && hit) {
      const tx = hit.bx + hit.nx;
      const ty = hit.by + hit.ny;
      const tz = hit.bz + hit.nz;

      const existing = this.world.getBlock(tx, ty, tz);
      const replaceable =
        existing === BLOCK.AIR ||
        existing === BLOCK.WATER ||
        existing === BLOCK.LAVA ||
        existing === BLOCK.TALL_GRASS;

      if (!replaceable) return;

      // Crossed flora requires dirt/grass/sand below
      if (itemDef.renderType === 'cross') {
        const below = this.world.getBlock(tx, ty - 1, tz);
        if (below !== BLOCK.GRASS && below !== BLOCK.DIRT && below !== BLOCK.SNOW_GRASS && below !== BLOCK.STONE) {
          return;
        }
      }

      if (!canPlaceBlockAt(this.world, tx, ty, tz, this.player, activeStack.id)) {
        return;
      }

      const placed = this.world.setBlock(tx, ty, tz, activeStack.id, true);
      if (placed && placed.changed) {
        this.handView.triggerSwing();
        this.audio.playBlockPlace(itemDef.soundGroup);
        this.stats.blocksPlaced++;
        if (activeStack.id === BLOCK.CRAFTING_TABLE) {
          this.stats.placedTable = true;
        }

        if (this.worldMeta.mode === GAME_MODES.SURVIVAL) {
          this.inventory.consumeFromSlot(this.inventory.selectedSlot, 1);
          this.ui.renderHotbar(this.inventory);
          this.syncHeldView();
        }
        this.checkMilestones();
      }
    }
  }

  useCozyBed(bx, by, bz) {
    this.player.spawnPos = { x: bx + 0.5, y: by + 1.0, z: bz + 0.5 };
    const t = this.env.timeOfDay;
    const isDuskOrNight = t >= 0.70 || t < 0.25;

    if (isDuskOrNight) {
      this.ui.el.screenFx.classList.add('sleeping');
      setTimeout(() => {
        this.env.dayCount++;
        this.env.setTimeOfDay(0.28);
        this.env.setWeather(WEATHER_TYPES.CLEAR);
        this.player.health = Math.min(20, this.player.health + 6);
        this.ui.renderVitals(this.player.health, this.player.hunger, this.player.oxygen, false);
        this.ui.el.screenFx.classList.remove('sleeping');
        this.ui.showToast('Rested until dawn · Respawn point set');
      }, 480);
    } else {
      this.ui.showToast('Respawn point set at Cozy Bed (sleep at nightfall)');
    }
  }

  updateMining(dt) {
    if (this.creativeBreakCooldown > 0) this.creativeBreakCooldown -= dt;

    if (!this.mouseDownLeft || !this.currentRayHit) {
      this.mining.progress = 0;
      this.mining.warnedTier = false;
      return;
    }

    const hit = this.currentRayHit;
    const targetDef = getItemDef(hit.blockId);
    if (!Number.isFinite(targetDef.hardness)) {
      this.mining.progress = 0;
      return;
    }

    // Creative Mode: crisp instant block breaking with anti-spam cooldown
    if (this.worldMeta.mode === GAME_MODES.CREATIVE) {
      if (this.creativeBreakCooldown <= 0) {
        this.creativeBreakCooldown = 0.17;
        this.handView.triggerSwing();
        this.completeBlockBreak(hit, targetDef, true);
      }
      return;
    }

    // Reset progress if crosshair moved onto a different block
    if (this.mining.bx !== hit.bx || this.mining.by !== hit.by || this.mining.bz !== hit.bz) {
      this.mining.bx = hit.bx;
      this.mining.by = hit.by;
      this.mining.bz = hit.bz;
      this.mining.progress = 0;
      this.mining.warnedTier = false;
    }

    const activeTool = this.inventory.getActiveItemDef();
    const toolMatches = activeTool && activeTool.toolType === targetDef.preferredTool;
    const playerTier = activeTool?.toolType === 'pickaxe' ? (activeTool.tier || 0) : 0;
    const meetsTier = targetDef.minTier === 0 || playerTier >= targetDef.minTier;

    if (!meetsTier && !this.mining.warnedTier) {
      this.mining.warnedTier = true;
      const tierNames = ['', 'Wooden Pickaxe', 'Stone Pickaxe', 'Iron Pickaxe'];
      this.ui.showToast(`Needs ${tierNames[targetDef.minTier] || 'better Pickaxe'} to harvest ${targetDef.name}`);
    }

    let speedMult = toolMatches ? activeTool.speed : 1.0;
    if (!meetsTier) speedMult *= 0.28;
    if (this.player.headUnderwater) speedMult *= 0.45;

    const duration = Math.max(0.06, targetDef.hardness / speedMult);
    this.mining.progress += dt / duration;

    this.mining.chipTimer -= dt;
    if (this.mining.chipTimer <= 0) {
      this.mining.chipTimer = 0.18;
      this.audio.playMineHit(targetDef.soundGroup);
      this.particles.emitMiningChip(hit.bx, hit.by, hit.bz, hit.nx, hit.ny, hit.nz, hit.blockId);
    }

    if (this.mining.progress >= 1.0) {
      this.mining.progress = 0;
      this.completeBlockBreak(hit, targetDef, meetsTier);
    }
  }

  completeBlockBreak(hit, targetDef, canHarvestDrop) {
    const res = this.world.setBlock(hit.bx, hit.by, hit.bz, BLOCK.AIR, true);
    if (!res || !res.changed) return;

    this.stats.blocksMined++;
    this.audio.playBlockBreak(targetDef.soundGroup);
    this.particles.emitBlockBreak(hit.bx, hit.by, hit.bz, hit.blockId, 18);

    if (this.worldMeta.mode === GAME_MODES.SURVIVAL && this.entities) {
      if (canHarvestDrop) {
        const dropId = targetDef.drop !== undefined ? targetDef.drop : hit.blockId;
        const dropCount = targetDef.dropCount || 1;
        if (dropId !== BLOCK.AIR) {
          this.entities.spawnDrop(dropId, dropCount, hit.bx + 0.5, hit.by + 0.5, hit.bz + 0.5);
        }

        // Bonus organic drops (Apples/Sticks from Leaves, Flint from Gravel)
        if (hit.blockId === BLOCK.OAK_LEAVES || hit.blockId === BLOCK.BIRCH_LEAVES) {
          if (Math.random() < 0.14) {
            this.entities.spawnDrop(ITEM.APPLE, 1, hit.bx + 0.5, hit.by + 0.5, hit.bz + 0.5);
          } else if (Math.random() < 0.22) {
            this.entities.spawnDrop(ITEM.STICK, 1, hit.bx + 0.5, hit.by + 0.5, hit.bz + 0.5);
          }
        } else if (hit.blockId === BLOCK.GRAVEL && Math.random() < 0.22) {
          this.entities.spawnDrop(ITEM.FLINT, 1, hit.bx + 0.5, hit.by + 0.5, hit.bz + 0.5);
        }
      }

      // Spawn drops for any flora/torches that popped off top
      if (res.poppedDrops) {
        for (const pd of res.poppedDrops) {
          this.entities.spawnDrop(pd.id, 1, pd.x, pd.y, pd.z);
        }
      }

      // Tool durability wear
      const activeDef = this.inventory.getActiveItemDef();
      if (activeDef?.durability && targetDef.hardness > 0.1) {
        const dmgRes = this.inventory.damageActiveTool(1);
        if (dmgRes.broke) {
          this.ui.showToast(`${activeDef.name} broke!`);
          this.syncHeldView();
        }
        this.ui.renderHotbar(this.inventory);
      }
    }
  }

  applyPlayerDamage(amount, reason) {
    if (this.worldMeta.mode === GAME_MODES.CREATIVE || this.state !== 'playing') return;
    if (this.player.hurtImmunity > 0) return;

    this.player.hurtImmunity = 0.65;
    this.player.health = Math.max(0, this.player.health - amount);
    this.audio.playHurt();

    this.ui.el.screenFx.classList.add('hurt');
    setTimeout(() => this.ui.el.screenFx.classList.remove('hurt'), 220);

    this.ui.renderVitals(this.player.health, this.player.hunger, this.player.oxygen, this.player.headUnderwater);

    if (this.player.health <= 0) {
      this.state = 'dead';
      this.keys.clear();
      this.mouseDownLeft = false;
      this.releasePointerLockSafe();
      this.ui.showRespawnModal(reason);
    }
  }

  respawnPlayer() {
    this.ui.hideRespawnModal();
    const sp = this.player.spawnPos;
    this.world.preloadAround(sp.x, sp.z, 2);
    const safeY = Math.max(sp.y, this.world.getSurfaceHeight(sp.x, sp.z) + 1.05);

    this.player.pos.set(sp.x, safeY, sp.z);
    this.player.vel.set(0, 0, 0);
    this.player.fallPeakY = safeY;
    this.player.health = 20;
    this.player.hunger = 20;
    this.player.oxygen = 20;

    this.state = 'playing';
    this.ui.renderVitals(20, 20, 20, false);
    this.requestPointerLockSafe();
  }

  updateSurvivalVitals(dt, moveSpeed) {
    if (this.worldMeta.mode === GAME_MODES.CREATIVE) return;
    if (this.player.hurtImmunity > 0) this.player.hurtImmunity -= dt;

    // Oxygen underwater
    if (this.player.headUnderwater) {
      this.player.oxygen = Math.max(0, this.player.oxygen - dt * 1.45);
      if (this.player.oxygen <= 0) {
        this.applyPlayerDamage(2, 'Ran out of air underwater.');
      }
    } else if (this.player.oxygen < 20) {
      this.player.oxygen = Math.min(20, this.player.oxygen + dt * 5.0);
    }

    // Gentle hunger drain during active movement
    if (moveSpeed > 1.0) {
      const rate = moveSpeed > 5.5 ? 0.045 : 0.015;
      this.player.exertion += rate * dt;
      if (this.player.exertion >= 1.0) {
        this.player.exertion -= 1.0;
        this.player.hunger = Math.max(0, this.player.hunger - 1);
      }
    }

    // Natural health regeneration when nourished
    if (this.player.hunger >= 15 && this.player.health > 0 && this.player.health < 20) {
      this.player.regenTimer += dt;
      if (this.player.regenTimer >= 3.5) {
        this.player.regenTimer = 0;
        this.player.health = Math.min(20, this.player.health + 1);
      }
    }

    this.ui.renderVitals(this.player.health, this.player.hunger, this.player.oxygen, this.player.headUnderwater);
  }

  animate(now) {
    requestAnimationFrame(this.animate);

    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(0.25, Math.max(0.001, rawDt));

    // FPS tracking
    this.fpsFrames++;
    this.fpsAccum += rawDt;
    if (this.fpsAccum >= 0.5) {
      this.fpsDisplay = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsFrames = 0;
      this.fpsAccum = 0;
    }

    if (this.state === 'title' && this.world) {
      this.flyoverAngle += dt * 0.11;
      const rad = 26;
      const cx = this.showcaseCenter.x + Math.cos(this.flyoverAngle) * rad;
      const cz = this.showcaseCenter.z + Math.sin(this.flyoverAngle) * rad;
      const cy = this.showcaseCenter.y + 15 + Math.sin(this.flyoverAngle * 1.7) * 2.5;

      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(this.showcaseCenter.x, this.showcaseCenter.y + 3, this.showcaseCenter.z);

      const biome = this.world.getBiomeAt(cx, cz);
      this.env.update(dt * 0.6, this.camera.position, biome, 4, false);
      this.world.updateStreaming(cx, cz, dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (!this.world) return;

    if (this.state === 'playing') {
      // Arrow-key camera look fallback (helpful on trackpads & automated tests!)
      const turnSpeed = 2.0 * dt;
      if (this.keys.has('ArrowLeft')) this.player.yaw += turnSpeed;
      if (this.keys.has('ArrowRight')) this.player.yaw -= turnSpeed;
      if (this.keys.has('ArrowUp')) this.player.pitch = Math.min(1.54, this.player.pitch + turnSpeed * 0.8);
      if (this.keys.has('ArrowDown')) this.player.pitch = Math.max(-1.54, this.player.pitch - turnSpeed * 0.8);

      const input = {
        moveForward: (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0),
        moveRight: (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0),
        jump: this.keys.has('Space'),
        sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
        crouch: this.keys.has('KeyC'),
      };

      stepPlayerPhysics(this.player, this.world, input, dt, {
        onStep: (blockId) => this.audio.playStep(getItemDef(blockId).soundGroup),
        onSplash: (intensity) => {
          this.audio.playSplash(intensity);
          this.particles.emitSplash(this.player.pos.x, this.player.pos.y, this.player.pos.z, intensity);
        },
        onFallImpact: (fallDist, blockId) => {
          this.audio.playBlockBreak(getItemDef(blockId).soundGroup);
          const dmg = Math.max(1, Math.floor(fallDist - 3.3));
          this.applyPlayerDamage(dmg, 'Fell from a high cliff.');
        },
        onHazard: (type) => {
          if (type === 'lava') this.applyPlayerDamage(4, 'Swam in molten lava.');
          else if (type === 'cactus') this.applyPlayerDamage(1, 'Pricked by a desert cactus.');
        },
      });

      if (this.rightClickCooldown > 0) this.rightClickCooldown -= dt;
      if (this.attackCooldown > 0) this.attackCooldown -= dt;
      if (this.mouseDownRight && this.rightClickCooldown <= 0) {
        this.handleRightClickAction();
      }

      // Sync Camera to Player Eye
      const eye = this.getEyePosition();
      this.camera.position.set(eye.x, eye.y, eye.z);
      this.camera.rotation.set(this.player.pitch, this.player.yaw, 0, 'YXZ');

      // Underwater screen vignette
      this.ui.el.screenFx.classList.toggle('underwater', Boolean(this.player.headUnderwater));

      // Raycast target voxel
      const look = this.getLookDirection();
      this.currentRayHit = raycastVoxel(this.world, eye.x, eye.y, eye.z, look.x, look.y, look.z);

      // Update mining & target highlight
      this.updateMining(dt);
      this.handView.updateTarget(this.currentRayHit, this.mining.progress);

      const horizSpeed = Math.hypot(this.player.vel.x, this.player.vel.z);
      this.handView.update(dt, horizSpeed, this.player.onGround, this.mouseDownLeft && Boolean(this.currentRayHit));
      this.updateSurvivalVitals(dt, horizSpeed);

      // Entities & Drops
      if (this.entities) {
        this.entities.update(
          dt,
          this.world,
          this.player,
          this.inventory,
          this.env.isNight(),
          this.worldMeta.mode,
          {
            onPickup: () => {
              this.audio.playPickup();
              this.ui.renderHotbar(this.inventory);
              this.syncHeldView();
              this.checkMilestones();
            },
            onPlayerDamaged: (dmg, sourceName, mob) => {
              const kx = this.player.pos.x - mob.x;
              const kz = this.player.pos.z - mob.z;
              const kl = Math.hypot(kx, kz) || 1;
              this.player.vel.x += (kx / kl) * 5.5;
              this.player.vel.z += (kz / kl) * 5.5;
              this.player.vel.y = 4.0;
              this.applyPlayerDamage(dmg, `Struck down by a ${sourceName}.`);
            },
          }
        );
      }

      // Periodic Auto-Save
      this.autoSaveTimer += dt;
      if (this.autoSaveTimer >= 35) {
        this.autoSaveTimer = 0;
        this.saveCurrentWorld(false);
      }
    }

    // Stream chunks & update environment/particles
    this.world.updateStreaming(this.player.pos.x, this.player.pos.z, dt);
    const curBiome = this.world.getBiomeAt(this.player.pos.x, this.player.pos.z);

    if (this.state === 'playing' || this.state === 'inventory') {
      this.env.update(
        dt,
        this.camera.position,
        curBiome,
        this.settings.renderDistance,
        this.player.headUnderwater
      );
      this.audio.updateWeather(
        this.env.rainIntensity,
        curBiome.precipitation === WEATHER_TYPES.SNOW || this.env.weather === WEATHER_TYPES.SNOW
      );

      this.torchEmberTimer -= dt;
      if (this.torchEmberTimer <= 0) {
        this.torchEmberTimer = 0.26;
        const pChunk = this.world.getChunkAtBlock(this.player.pos.x, this.player.pos.z);
        if (pChunk && pChunk.lightSources.length > 0) {
          for (const src of pChunk.lightSources) {
            if (this.world.getBlock(src.wx, src.y, src.wz) === BLOCK.TORCH) {
              const d2 = (src.wx - this.player.pos.x) ** 2 + (src.wz - this.player.pos.z) ** 2;
              if (d2 < 144 && Math.random() < 0.65) {
                this.particles.spawnOne({
                  x: src.wx + 0.5 + (Math.random() - 0.5) * 0.08,
                  y: src.y + 0.68,
                  z: src.wz + 0.5 + (Math.random() - 0.5) * 0.08,
                  vx: (Math.random() - 0.5) * 0.25,
                  vy: 0.75 + Math.random() * 0.45,
                  vz: (Math.random() - 0.5) * 0.25,
                  gravity: -0.2,
                  scale: 0.055,
                  maxLife: 0.45,
                  hex: Math.random() < 0.5 ? 0xffd54f : 0xff8a3d,
                });
              }
            }
          }
        }
      }

      this.particles.update(dt, this.world);
    }

    // Update HUD
    if (this.state === 'playing') {
      this.ui.updateHUDStatus({
        dayCount: this.env.dayCount,
        clock: this.env.getClockLabel(),
        phase: this.env.getPhaseLabel(),
        biomeName: curBiome.name,
        weather: curBiome === BIOMES.DESERT ? WEATHER_TYPES.CLEAR : this.env.weather,
        isSnowBiome: curBiome.precipitation === WEATHER_TYPES.SNOW,
        flying: this.player.flying,
        breakProgress: this.mining.progress,
        hasTarget: Boolean(this.currentRayHit),
      });

      if (this.ui.debugVisible) {
        const wStats = this.world.getStats();
        const pl = this.world.getPackedLight(this.player.pos.x, this.player.pos.y + 1, this.player.pos.z);
        this.ui.updateDebug({
          fps: this.fpsDisplay,
          loadedChunks: wStats.loadedChunks,
          triangles: wStats.triangles,
          x: this.player.pos.x,
          y: this.player.pos.y,
          z: this.player.pos.z,
          skyLight: (pl >> 4) & 0x0f,
          blockLight: pl & 0x0f,
        });
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.terravox = new TerravoxGame();
});
