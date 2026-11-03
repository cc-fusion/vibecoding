import * as THREE from 'three';
import { createTextureAtlas } from './engine/TextureAtlas.js';
import { World } from './world/World.js';
import { SkyWeather } from './atmosphere/SkyWeather.js';
import { EntityManager } from './entities/EntityManager.js';
import { PlayerController } from './physics/PlayerController.js';
import { Inventory } from './game/Inventory.js';
import { SoundManager } from './audio/SoundManager.js';
import { SaveManager } from './storage/SaveManager.js';
import { UIManager } from './ui/UIManager.js';
import { BLOCK } from './constants/Blocks.js';
import { SEA_LEVEL } from './world/WorldGen.js';

export class TerraCraftGame {
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
    this.renderer.autoClear = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 450);
    this.scene.add(this.camera);

    this.atlas = createTextureAtlas();
    this.sound = new SoundManager();
    this.saveManager = new SaveManager();
    this.sky = new SkyWeather(this.scene, this.atlas.sharedUniforms);

    this.world = null;
    this.entities = null;
    this.inventory = null;
    this.player = null;

    this.state = 'title'; // 'title' | 'playing' | 'inventory' | 'paused' | 'dead'
    this.currentWorldMeta = null;

    this.panoramaAngle = 0;
    this.panoramaCenter = new THREE.Vector3(0, 52, 0);

    this.lastTime = performance.now();
    this.fpsSmooth = 60;
    this.autoSaveTimer = 0;
    this.suppressNextPointerUnlockPause = false;
    this.pointerLockSupported = true;
    this.fallbackDragLook = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    this.ui = new UIManager(this);

    this.bindGlobalEvents();
    this.initTitlePanorama();
    this.ui.showTitleScreen();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initTitlePanorama() {
    this.cleanupWorld();
    this.world = new World(this.scene, this.atlas, 'EmeraldVista-2026');
    this.world.renderDistance = 4;
    const spawn = this.world.generator.findSpawnPoint();
    this.panoramaCenter.set(spawn.x, spawn.y + 12, spawn.z);
    this.world.preloadAround(spawn.x, spawn.z, 3);
    this.sky.timeOfDay = 0.14;
    this.sky.weatherMode = 'clear';
  }

  cleanupWorld() {
    if (this.player) {
      this.scene.remove(this.player.highlightBox);
      this.scene.remove(this.player.crackMesh);
      this.player = null;
    }
    if (this.entities) {
      this.entities.dispose();
      this.entities = null;
    }
    if (this.world) {
      this.world.dispose();
      this.world = null;
    }
  }

  createNewWorld(name, seed, mode = 'survival') {
    const id = `world_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.bootWorld({
      id,
      name,
      seed,
      mode,
      timeOfDay: 0.12,
      dayCount: 1,
      edits: null,
      playerState: null,
      inventoryData: null,
    });
    this.requestPointerLock();
  }

  async loadSavedWorld(id) {
    const record = await this.saveManager.getWorld(id);
    if (!record) return;
    this.bootWorld(record);
    this.requestPointerLock();
  }

  bootWorld(record) {
    this.cleanupWorld();

    const renderDist = Number(document.getElementById('slider-render-dist')?.value) || 5;
    this.world = new World(this.scene, this.atlas, record.seed, record.edits || null);
    this.world.renderDistance = renderDist;

    this.inventory = new Inventory(record.mode || 'survival');
    if (record.inventoryData) {
      this.inventory.deserialize(record.inventoryData);
    }

    this.entities = new EntityManager(this.scene, this.world, this.atlas, this.sound);
    this.player = new PlayerController(
      this.camera,
      this.scene,
      this.world,
      this.entities,
      this.inventory,
      this.atlas,
      this.sound,
      record.mode || 'survival'
    );

    const spawn = this.world.generator.findSpawnPoint();
    this.world.preloadAround(spawn.x, spawn.z, 2);
    const safeY = this.world.getSurfaceHeight(spawn.x, spawn.z) + 1.55;
    this.player.spawnPos.set(spawn.x, safeY, spawn.z);

    if (record.playerState) {
      const ps = record.playerState;
      this.world.preloadAround(ps.x, ps.z, 2);
      this.player.pos.set(ps.x, ps.y, ps.z);
      this.player.yaw = ps.yaw || 0;
      this.player.pitch = ps.pitch || 0;
      this.player.health = ps.health ?? 20;
      this.player.hunger = ps.hunger ?? 20;
      this.player.flying = Boolean(ps.flying);
    } else {
      this.player.pos.copy(this.player.spawnPos);
      this.spawnInitialWildlife(spawn.x, spawn.z);
    }

    this.sky.timeOfDay = record.timeOfDay ?? 0.12;
    this.sky.dayCount = record.dayCount ?? 1;

    this.currentWorldMeta = {
      id: record.id,
      name: record.name,
      seed: record.seed,
    };

    // Hook callbacks
    this.inventory.onChange = () => {
      this.ui.renderHotbar();
    };
    this.player.onStatsChange = () => {
      this.ui.renderVitals();
    };
    this.player.onOpenStation = (stationType) => {
      this.openInventory(stationType);
    };
    this.player.onDeath = () => {
      this.state = 'dead';
      this.suppressNextPointerUnlockPause = true;
      this.exitPointerLock();
      this.ui.elDeathModal.classList.remove('hidden');
    };

    this.state = 'playing';
    this.ui.syncPauseModeButtons();
    this.ui.showGameplayHUD();
    this.ui.renderHotbar(true);
    this.saveCurrentWorld();
  }

  spawnInitialWildlife(cx, cz) {
    const types = ['sheep', 'sheep', 'pig', 'chicken', 'pig'];
    for (let i = 0; i < types.length; i++) {
      const ang = (i / types.length) * Math.PI * 2 + 0.4;
      const dist = 8 + i * 3;
      const mx = Math.floor(cx + Math.cos(ang) * dist);
      const mz = Math.floor(cz + Math.sin(ang) * dist);
      const my = this.world.getSurfaceHeight(mx, mz);
      const ground = this.world.getBlock(mx, my, mz);
      if (ground !== BLOCK.WATER && my > SEA_LEVEL) {
        this.entities.spawnMob(types[i], mx + 0.5, my + 1.05, mz + 0.5);
      }
    }
  }

  setGameMode(mode) {
    if (!this.player) return;
    this.player.setMode(mode);
    this.ui.renderVitals();
  }

  async saveCurrentWorld() {
    if (!this.world || !this.player || !this.inventory || !this.currentWorldMeta) return null;
    const record = {
      id: this.currentWorldMeta.id,
      name: this.currentWorldMeta.name,
      seed: this.currentWorldMeta.seed,
      mode: this.player.mode,
      timeOfDay: this.sky.timeOfDay,
      dayCount: this.sky.dayCount,
      edits: this.world.exportEdits(),
      inventoryData: this.inventory.serialize(),
      playerState: {
        x: this.player.pos.x,
        y: this.player.pos.y,
        z: this.player.pos.z,
        yaw: this.player.yaw,
        pitch: this.player.pitch,
        health: this.player.health,
        hunger: this.player.hunger,
        flying: this.player.flying,
      },
    };
    return this.saveManager.saveWorld(record);
  }

  async exitToTitle() {
    await this.saveCurrentWorld();
    this.suppressNextPointerUnlockPause = true;
    this.exitPointerLock();
    this.state = 'title';
    this.currentWorldMeta = null;
    this.initTitlePanorama();
    await this.ui.showTitleScreen();
  }

  requestPointerLock() {
    try {
      this.canvas.requestPointerLock?.();
    } catch {
      // Ignore if restricted by sandbox
    }
  }

  exitPointerLock() {
    try {
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    } catch {
      // Ignore
    }
  }

  isPointerLocked() {
    return document.pointerLockElement === this.canvas;
  }

  openInventory(stationType = null) {
    if (this.state !== 'playing') return;
    this.state = 'inventory';
    this.player.keys = {};
    this.player.mouseDownLeft = false;
    this.player.mouseDownRight = false;
    this.suppressNextPointerUnlockPause = true;
    this.exitPointerLock();
    this.ui.openInventoryModal(stationType);
  }

  closeInventory() {
    if (this.state !== 'inventory') return;
    this.ui.closeInventoryModal();
    this.state = 'playing';
    this.requestPointerLock();
  }

  openPause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.player.keys = {};
    this.player.mouseDownLeft = false;
    this.player.mouseDownRight = false;
    this.suppressNextPointerUnlockPause = true;
    this.exitPointerLock();
    this.ui.syncPauseModeButtons();
    this.ui.elPauseModal.classList.remove('hidden');
    this.saveCurrentWorld();
  }

  resumeFromPause() {
    if (this.state !== 'paused') return;
    this.ui.elPauseModal.classList.add('hidden');
    this.state = 'playing';
    this.requestPointerLock();
  }

  bindGlobalEvents() {
    window.addEventListener('resize', () => {
      const aspect = window.innerWidth / window.innerHeight;
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
      if (this.player?.viewCamera) {
        this.player.viewCamera.aspect = aspect;
        this.player.viewCamera.updateProjectionMatrix();
      }
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Pointer lock transitions & iframe fallback support
    document.addEventListener('pointerlockerror', () => {
      this.pointerLockSupported = false;
      this.ui.elPointerPrompt.classList.add('hidden');
    });

    document.addEventListener('pointerlockchange', () => {
      const locked = this.isPointerLocked();
      if (locked) {
        this.pointerLockSupported = true;
        this.ui.elPointerPrompt.classList.add('hidden');
      } else {
        if (this.suppressNextPointerUnlockPause) {
          this.suppressNextPointerUnlockPause = false;
          return;
        }
        if (this.state === 'playing') {
          this.openPause();
        }
      }
    });

    // Clicking canvas during 'playing' acquires pointer lock or performs mining/placing
    this.canvas.addEventListener('mousedown', (e) => {
      this.sound.unlock();
      if (this.state !== 'playing') return;

      if (!this.isPointerLocked() && this.pointerLockSupported) {
        this.requestPointerLock();
        return;
      }

      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      if (!this.isPointerLocked()) {
        this.fallbackDragLook = true;
      }

      if (e.button === 0) {
        this.player.mouseDownLeft = true;
        this.player.handleLeftClickOnce();
      } else if (e.button === 2) {
        this.player.mouseDownRight = true;
        this.player.handleRightClick();
      }
    });

    window.addEventListener('mouseup', (e) => {
      this.fallbackDragLook = false;
      if (!this.player) return;
      if (e.button === 0) this.player.mouseDownLeft = false;
      if (e.button === 2) this.player.mouseDownRight = false;
    });

    window.addEventListener('contextmenu', (e) => {
      if (this.state !== 'title') e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (this.state !== 'playing' || !this.player) return;
      if (this.isPointerLocked()) {
        this.player.onMouseMove(e.movementX, e.movementY);
      } else if (this.fallbackDragLook) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.player.onMouseMove(dx * 1.6, dy * 1.6);
      }
    });

    window.addEventListener('wheel', (e) => {
      if (this.state === 'playing' && this.inventory) {
        this.inventory.cycleSlot(e.deltaY);
        this.ui.renderHotbar(true);
      }
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
      // Do not hijack typing in title screen inputs
      if (this.state === 'title' && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'F3') {
        e.preventDefault();
        this.ui.showDebug = !this.ui.showDebug;
        return;
      }

      if (e.code === 'KeyE') {
        if (this.state === 'playing') {
          e.preventDefault();
          this.openInventory(null);
          return;
        } else if (this.state === 'inventory') {
          e.preventDefault();
          this.closeInventory();
          return;
        }
      }

      if (e.code === 'Escape') {
        if (this.state === 'inventory') {
          e.preventDefault();
          this.closeInventory();
          return;
        }
        if (this.state === 'paused') {
          e.preventDefault();
          this.resumeFromPause();
          return;
        }
        if (this.state === 'playing' && !this.isPointerLocked()) {
          e.preventDefault();
          this.openPause();
          return;
        }
      }

      if (this.state === 'playing' && this.player) {
        if (e.code.startsWith('Digit')) {
          const num = Number(e.code.slice(5));
          if (num >= 1 && num <= 9) {
            this.inventory.selectSlot(num - 1);
            this.ui.renderHotbar(true);
            return;
          }
        }
        if (e.code === 'Space') e.preventDefault();
        this.player.onKeyDown(e.code);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.player) {
        this.player.onKeyUp(e.code);
      }
    });

    // Save automatically on tab hide / close
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.saveCurrentWorld();
      }
    });
    window.addEventListener('beforeunload', () => {
      this.saveCurrentWorld();
    });
  }

  animate(now) {
    requestAnimationFrame(this.animate);

    const rawDt = Math.max(0.001, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.1);
    this.fpsSmooth += (1 / rawDt - this.fpsSmooth) * 0.08;

    if (this.state === 'title') {
      // Gentle scenic orbit on Title Screen
      this.panoramaAngle += dt * 0.11;
      const radius = 26;
      const cx = this.panoramaCenter.x + Math.cos(this.panoramaAngle) * radius;
      const cz = this.panoramaCenter.z + Math.sin(this.panoramaAngle) * radius;
      this.camera.rotation.order = 'XYZ';
      this.camera.position.set(cx, this.panoramaCenter.y, cz);
      this.camera.lookAt(this.panoramaCenter.x, this.panoramaCenter.y - 7, this.panoramaCenter.z);

      this.world?.update(cx, cz, dt, 2);
      this.sky.update(dt * 0.5, this.camera.position, 'Emerald Plains');
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (!this.world || !this.player || !this.entities) return;

    // Show subtle click-to-resume prompt only when PointerLock is supported and unlocked
    if (this.state === 'playing' && !this.isPointerLocked() && this.pointerLockSupported) {
      this.ui.elPointerPrompt.classList.remove('hidden');
    } else {
      this.ui.elPointerPrompt.classList.add('hidden');
    }

    if (this.state !== 'paused') {
      const controlsActive = this.state === 'playing';
      this.player.update(dt, controlsActive);

      const biome = this.world.getBiomeAt(this.player.pos.x, this.player.pos.z);
      this.sky.update(dt, this.player.pos, biome);
      this.entities.update(dt, this.player, this.sky.isNight());
      this.world.update(this.player.pos.x, this.player.pos.z, dt, 3);

      // Periodic auto-save every 20 seconds
      this.autoSaveTimer += dt;
      if (this.autoSaveTimer >= 20) {
        this.autoSaveTimer = 0;
        this.saveCurrentWorld();
      }
    }

    this.ui.updateHUD(this.fpsSmooth);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (!this.player.dead) {
      this.renderer.clearDepth();
      this.renderer.render(this.player.viewScene, this.player.viewCamera);
    }
  }
}

window.__terracraft = new TerraCraftGame();
