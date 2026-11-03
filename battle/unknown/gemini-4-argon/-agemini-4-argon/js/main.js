// TerraCraft Main Orchestrator — Three.js Scene, World Lifecycle, Input & Persistence Loop

import * as THREE from 'three';
import { SoundEngine } from './audio/sound.js';
import { GAME_MODES } from './constants.js';
import { DropManager } from './entities/drops.js';
import { MobManager } from './entities/mobs.js';
import { Inventory } from './game/inventory.js';
import { ParticleSystem } from './graphics/particles.js';
import { TextureManager } from './graphics/textures.js';
import { PlayerController } from './player/player.js';
import { WorldStorage } from './storage/persistence.js';
import { UIManager } from './ui/uiManager.js';
import { AtmosphereSystem } from './world/atmosphere.js';
import { ChunkManager } from './world/chunkManager.js';
import { WorldGenerator } from './world/worldGen.js';

class TerraCraftGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 420);

    this.textures = new TextureManager();
    this.sound = new SoundEngine();
    this.storage = new WorldStorage();
    this.inventory = new Inventory();

    this.currentWorldMeta = {
      id: 'preview',
      name: 'Emerald Valley',
      seed: 'Terra-2026',
      mode: GAME_MODES.SURVIVAL,
    };

    this.worldReady = false;
    this.hadPointerLock = false;
    this.elapsedTime = 0;
    this.lastFrameTime = performance.now();
    this.fpsAccum = 0;
    this.fpsFrames = 0;
    this.displayFps = 60;
    this.autoSaveTimer = 0;
    this.panoramaAngle = 0;

    this.ui = new UIManager(this);

    // Initialize live scenic background world behind the Title screen immediately!
    this.mountWorldSystems(this.currentWorldMeta, null, true);

    this.bindGlobalInput();
    this.ui.refreshWorldList();

    // Auto-save safely before tab close
    window.addEventListener('beforeunload', () => {
      if (this.ui.activeModal !== 'title' && this.worldReady) {
        this.saveCurrentWorld();
      }
    });

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  mountWorldSystems(meta, savedData = null, isTitlePreview = false) {
    // Clean up previous world systems if switching worlds
    if (this.chunkManager) this.chunkManager.dispose();
    if (this.drops) this.drops.clearAll();
    if (this.mobs) this.mobs.clearAll();
    if (this.player) {
      this.scene.remove(this.player.highlightBox);
      this.scene.remove(this.player.crackMesh);
      this.camera.remove(this.player.handPivot);
    }

    this.currentWorldMeta = { ...meta };
    this.worldGen = new WorldGenerator(meta.seed);
    this.chunkManager = new ChunkManager(
      this.scene,
      this.worldGen,
      this.textures,
      Number(this.ui.el.renderDistSlider?.value || 6)
    );

    if (savedData?.deltas) {
      this.chunkManager.loadSavedDeltas(savedData.deltas);
    }

    if (!this.atmosphere) {
      this.atmosphere = new AtmosphereSystem(this.scene, this.chunkManager.materials.sharedUniforms);
    } else {
      this.atmosphere.sharedUniforms = this.chunkManager.materials.sharedUniforms;
    }

    if (!this.particles) {
      this.particles = new ParticleSystem(this.scene, this.chunkManager);
    } else {
      this.particles.chunkManager = this.chunkManager;
    }

    this.drops = new DropManager(this.scene, this.chunkManager, this.textures, this.sound);
    this.mobs = new MobManager(this.scene, this.chunkManager, this.drops, this.particles, this.sound);

    this.player = new PlayerController({
      camera: this.camera,
      scene: this.scene,
      chunkManager: this.chunkManager,
      inventory: this.inventory,
      textureManager: this.textures,
      particles: this.particles,
      drops: this.drops,
      mobs: this.mobs,
      sound: this.sound,
      callbacks: {
        onStatsChange: () => this.ui.renderVitals(),
        onModeChange: () => {
          this.ui.renderVitals();
          this.ui.syncPauseState();
        },
        onOpenStation: (tab) => this.ui.openInventory(tab),
        onToast: (msg) => this.ui.showToast(msg),
        onBlockBroken: () => this.ui.updateGoals(),
        onBlockPlaced: () => this.ui.updateGoals(),
      },
    });

    const scenic = this.worldGen.findScenicSpawn();
    this.chunkManager.warmStartAround(scenic.x, scenic.z, isTitlePreview ? 3 : 4);
    const ground = this.chunkManager.findSurfaceY(scenic.x, scenic.z);

    this.player.spawnPoint.set(scenic.x, ground.y + 0.001, scenic.z);
    this.player.position.set(scenic.x, ground.y + 0.001, scenic.z);
    this.player.onGround = true;

    // Face toward open downhill vista at spawn so the opening view is expansive & unobstructed!
    let openYaw = 0;
    let lowestFront = Infinity;
    for (let a = 0; a < 8; a++) {
      const testYaw = (a / 8) * Math.PI * 2;
      const fx = scenic.x - Math.sin(testYaw) * 6;
      const fz = scenic.z - Math.cos(testYaw) * 6;
      const fy = this.chunkManager.findSurfaceY(fx, fz).y;
      if (fy < lowestFront) {
        lowestFront = fy;
        openYaw = testYaw;
      }
    }
    this.player.yaw = openYaw;

    if (savedData) {
      this.player.deserialize(savedData.player);
      this.inventory.deserialize(savedData.inventory);
      this.atmosphere.timeOfDay = savedData.timeOfDay ?? 0.20;
      this.atmosphere.dayCount = savedData.dayCount ?? 1;
      if (savedData.weather) this.atmosphere.setWeather(savedData.weather);
      this.chunkManager.warmStartAround(this.player.position.x, this.player.position.z, 3);
    } else {
      this.player.setGameMode(meta.mode || GAME_MODES.SURVIVAL);
      this.inventory.initDefaultKit(meta.mode || GAME_MODES.SURVIVAL);
      this.atmosphere.timeOfDay = 0.20;
      this.atmosphere.dayCount = 1;
    }

    this.lastFrameTime = performance.now();

    this.mobs.populateInitialWildlife(this.player.position);
    this.ui.renderHotbar();
    this.ui.renderVitals();
    this.ui.goalIndex = 0;
    this.ui.goalsDismissed = false;
    this.player.refreshHeldMesh();
    this.worldReady = true;
  }

  async startNewWorld({ name, seed, mode }) {
    this.sound.ensureContext();
    const id = `world_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const meta = { id, name, seed, mode };
    this.mountWorldSystems(meta, null, false);
    this.player.handPivot.visible = true;
    await this.saveCurrentWorld();
    this.ui.setModal('none');
    this.requestGamePointerLock();
    this.ui.showToast(`Entered "${name}"`);
  }

  async loadExistingWorld(worldId) {
    this.sound.ensureContext();
    const saved = await this.storage.loadWorld(worldId);
    if (!saved) {
      this.ui.showToast('Saved world not found');
      return;
    }
    const meta = {
      id: saved.id,
      name: saved.name,
      seed: saved.seed,
      mode: saved.mode || GAME_MODES.SURVIVAL,
    };
    this.mountWorldSystems(meta, saved, false);
    this.player.handPivot.visible = true;
    this.ui.setModal('none');
    this.requestGamePointerLock();
    this.ui.showToast(`Loaded "${saved.name}"`);
  }

  async saveCurrentWorld() {
    if (!this.worldReady || this.currentWorldMeta.id === 'preview') return null;
    const record = {
      id: this.currentWorldMeta.id,
      name: this.currentWorldMeta.name,
      seed: this.currentWorldMeta.seed,
      mode: this.player.mode,
      timeOfDay: this.atmosphere.timeOfDay,
      dayCount: this.atmosphere.dayCount,
      weather: this.atmosphere.weather,
      player: this.player.serialize(),
      inventory: this.inventory.serialize(),
      deltas: this.chunkManager.exportDeltas(),
    };
    return this.storage.saveWorld(record);
  }

  async returnToTitle() {
    await this.ui.refreshWorldList();
    this.ui.setModal('title');
  }

  switchMode(mode) {
    this.player.setGameMode(mode);
    if (mode === GAME_MODES.CREATIVE && this.inventory.countMatching('tag:planks') === 0) {
      // Conveniently fill empty inventory slots with Creative building blocks without wiping existing gear!
      const prevSelected = this.inventory.selectedSlot;
      const hasAnyItems = this.inventory.slots.some((s) => s !== null);
      if (!hasAnyItems) {
        this.inventory.initDefaultKit('creative');
      }
      this.inventory.selectSlot(prevSelected);
    }
    this.ui.renderHotbar();
    this.ui.renderVitals();
    this.ui.showToast(`Switched to ${mode === GAME_MODES.CREATIVE ? 'Creative' : 'Survival'} Mode`);
  }

  pickTargetedBlock() {
    const hit = this.player?.targetHit;
    if (!hit) return;
    // Map grass/snow/stone blocks cleanly to placeable item IDs
    const targetItemId = `block:${hit.blockId}`;
    const existingHotbar = this.inventory.slots.findIndex((s, idx) => idx < 9 && s?.id === targetItemId);
    if (existingHotbar !== -1) {
      this.inventory.selectSlot(existingHotbar);
      this.ui.renderHotbar();
      return;
    }
    const existingBag = this.inventory.slots.findIndex((s, idx) => idx >= 9 && s?.id === targetItemId);
    if (existingBag !== -1) {
      const tmp = this.inventory.slots[this.inventory.selectedSlot];
      this.inventory.slots[this.inventory.selectedSlot] = this.inventory.slots[existingBag];
      this.inventory.slots[existingBag] = tmp;
      this.inventory.emitChange();
      this.ui.renderHotbar();
      return;
    }
    if (this.player.mode === GAME_MODES.CREATIVE) {
      this.inventory.slots[this.inventory.selectedSlot] = { id: targetItemId, count: 64 };
      this.inventory.emitChange();
      this.ui.renderHotbar();
    }
  }

  requestGamePointerLock() {
    if (this.ui.activeModal !== 'none') return;
    try {
      const promise = this.canvas.requestPointerLock?.();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {});
      }
    } catch {
      // Sandboxed iframe / headless environment fallback: gameplay remains 100% active without lock
    }
  }

  bindGlobalInput() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      if (locked) {
        this.hadPointerLock = true;
      } else if (this.hadPointerLock && this.ui.activeModal === 'none') {
        this.hadPointerLock = false;
        this.ui.openPause();
      }
    });

    window.addEventListener('contextmenu', (e) => {
      if (this.ui.activeModal === 'none' || e.target === this.canvas) {
        e.preventDefault();
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.sound.ensureContext();
      if (this.ui.activeModal !== 'none') return;
      if (document.pointerLockElement !== this.canvas) {
        this.requestGamePointerLock();
      }
      this.dragLookLast = { x: e.clientX, y: e.clientY };
      if (e.button === 0) this.player.mouseButtons.left = true;
      if (e.button === 1) {
        e.preventDefault();
        this.pickTargetedBlock();
      }
      if (e.button === 2) this.player.mouseButtons.right = true;
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.player.mouseButtons.left = false;
      if (e.button === 2) this.player.mouseButtons.right = false;
      this.dragLookLast = null;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.ui.activeModal !== 'none') return;
      if (document.pointerLockElement === this.canvas) {
        this.player.onMouseMove(e.movementX, e.movementY);
      } else if (this.dragLookLast && (this.player.mouseButtons.left || this.player.mouseButtons.right)) {
        const dx = e.clientX - this.dragLookLast.x;
        const dy = e.clientY - this.dragLookLast.y;
        this.dragLookLast = { x: e.clientX, y: e.clientY };
        this.player.onMouseMove(dx * 1.4, dy * 1.4);
      }
    });

    window.addEventListener(
      'wheel',
      (e) => {
        if (this.ui.activeModal !== 'none') return;
        const step = e.deltaY > 0 ? 1 : -1;
        this.inventory.selectSlot(this.inventory.selectedSlot + step);
        this.ui.renderHotbar();
      },
      { passive: true }
    );

    window.addEventListener('keydown', (e) => {
      // Allow typing cleanly inside visible Title Screen text inputs!
      if (
        this.ui.activeModal === 'title' &&
        e.target &&
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if (e.code === 'KeyE') {
        e.preventDefault();
        if (this.ui.activeModal === 'none') {
          this.ui.openInventory();
        } else if (this.ui.activeModal === 'inventory') {
          this.ui.resumeGameplay();
        }
        return;
      }

      if (e.code === 'Escape') {
        if (this.ui.activeModal === 'inventory' || this.ui.activeModal === 'controls') {
          if (this.ui.activeModal === 'controls' && this.ui.prevModalBeforeControls === 'title') {
            this.ui.setModal('title');
          } else {
            this.ui.resumeGameplay();
          }
        } else if (this.ui.activeModal === 'pause') {
          this.ui.resumeGameplay();
        } else if (this.ui.activeModal === 'none') {
          this.ui.openPause();
        }
        return;
      }

      if (e.code === 'F3') {
        e.preventDefault();
        this.ui.showDebugCoords = !this.ui.showDebugCoords;
        return;
      }

      if (this.ui.activeModal !== 'none') return;

      // Hotbar keys Digit1 .. Digit9
      if (e.code.startsWith('Digit')) {
        const num = Number(e.code.slice(5));
        if (num >= 1 && num <= 9) {
          this.inventory.selectSlot(num - 1);
          this.ui.renderHotbar();
          return;
        }
      }

      if (e.code === 'KeyG') {
        const next =
          this.player.mode === GAME_MODES.SURVIVAL ? GAME_MODES.CREATIVE : GAME_MODES.SURVIVAL;
        this.switchMode(next);
        return;
      }

      if (e.code === 'KeyV') {
        this.pickTargetedBlock();
        return;
      }

      if (e.code === 'KeyT') {
        const t = this.atmosphere.timeOfDay;
        const nextPreset = t < 0.16 ? 'day' : t < 0.42 ? 'sunset' : t < 0.65 ? 'night' : 'dawn';
        const labels = { dawn: 'Golden Dawn', day: 'Bright Noon', sunset: 'Fiery Sunset', night: 'Starlit Night' };
        this.atmosphere.setTimePreset(nextPreset);
        this.ui.showToast(`Time: ${labels[nextPreset]}`);
        return;
      }

      if (e.code === 'KeyY') {
        const order = ['clear', 'rain', 'snow'];
        const nextW = order[(order.indexOf(this.atmosphere.weather) + 1) % order.length];
        this.atmosphere.setWeather(nextW);
        this.ui.showToast(`Weather: ${nextW.charAt(0).toUpperCase() + nextW.slice(1)}`);
        return;
      }

      this.player.onKeyDown(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.player.onKeyUp(e.code);
    });
  }

  animate(now) {
    requestAnimationFrame(this.animate);

    const rawDt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    const dt = Math.min(0.1, Math.max(0.0005, rawDt));
    this.elapsedTime += dt;

    // FPS counter update every 0.4s
    this.fpsAccum += rawDt;
    this.fpsFrames += 1;
    if (this.fpsAccum >= 0.4) {
      this.displayFps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    if (!this.worldReady) return;

    const onTitle = this.ui.activeModal === 'title';
    const isPaused = this.ui.activeModal === 'pause' || this.ui.activeModal === 'controls';

    if (onTitle) {
      // Scenic aerial orbital camera glide over the live 3D voxel landscape!
      this.player.handPivot.visible = false;
      this.player.highlightBox.visible = false;
      this.player.crackMesh.visible = false;
      this.panoramaAngle += dt * 0.085;
      const radius = 20;
      const cx = this.player.spawnPoint.x + Math.cos(this.panoramaAngle) * radius;
      const cz = this.player.spawnPoint.z + Math.sin(this.panoramaAngle) * radius;
      const cy = this.player.spawnPoint.y + 15.5 + Math.sin(this.panoramaAngle * 2) * 2.2;
      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(
        this.player.spawnPoint.x,
        this.player.spawnPoint.y + 3.0,
        this.player.spawnPoint.z
      );

      this.chunkManager.updateStreaming(cx, cz, 7.0);
      this.atmosphere.underwater = false;
      this.atmosphere.update(dt * 0.6, this.camera.position, this.elapsedTime, 'Emerald Plains');
      this.mobs.update(dt, this.player, this.atmosphere);
    } else if (!isPaused) {
      this.player.handPivot.visible = true;
      const controlsActive = this.ui.activeModal === 'none';

      this.chunkManager.updateStreaming(this.player.position.x, this.player.position.z, 6.5);
      this.player.update(dt, controlsActive);

      // Sync underwater fog state & restore render fog when surfacing
      if (this.atmosphere.underwater !== this.player.headUnderWater) {
        this.atmosphere.underwater = this.player.headUnderWater;
        if (!this.player.headUnderWater) {
          this.chunkManager.updateFogForDistance();
        }
      }

      const col = this.worldGen.sampleColumn(
        Math.floor(this.player.position.x),
        Math.floor(this.player.position.z)
      );
      this.atmosphere.update(dt, this.player.position, this.elapsedTime, col.biome);
      this.particles.update(dt);
      this.drops.update(dt, this.player.position, this.inventory, () => {
        this.ui.renderHotbar();
        this.ui.updateGoals();
      });
      this.mobs.update(dt, this.player, this.atmosphere);
      this.sound.updateAmbience(dt, this.atmosphere.weather);
      this.ui.updateHUD(dt, this.displayFps);

      // Periodic non-blocking auto-save every 20 seconds
      this.autoSaveTimer += dt;
      if (this.autoSaveTimer >= 20) {
        this.autoSaveTimer = 0;
        this.saveCurrentWorld();
      }
    } else {
      // Paused: still allow sky/weather/time tweaks from Pause Menu to immediately preview live behind glass!
      this.atmosphere.update(0, this.player.position, this.elapsedTime, '');
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Launch game and expose clean runtime handle for diagnostics & verification
const game = new TerraCraftGame();
window.__TERRACRAFT__ = game;
