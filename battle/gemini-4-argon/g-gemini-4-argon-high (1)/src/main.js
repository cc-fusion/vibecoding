// VoxelRealms — Main Application Coordinator & Game Loop
import * as THREE from 'three';
import { DEFAULT_RENDER_DISTANCE, GAME_MODES } from './game/constants.js';
import { buildTextureAtlas } from './game/textures.js';
import { createVoxelMaterials } from './game/shader.js';
import { World } from './game/world.js';
import { Inventory } from './game/inventory.js';
import { Player } from './game/player.js';
import { EntityManager } from './game/entities.js';
import { ParticleSystem } from './game/particles.js';
import { SkySystem } from './game/sky.js';
import { SoundEngine } from './game/audio.js';
import { WorldStorage } from './game/storage.js';
import { GameUI } from './game/ui.js';

export class VoxelRealmsApp {
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
    this.renderer.autoClear = true;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.08,
      420
    );
    this.scene.add(this.camera);

    // Core subsystems
    const { texture, iconUrls } = buildTextureAtlas();
    this.atlasTexture = texture;
    this.materials = createVoxelMaterials(this.atlasTexture);
    this.sound = new SoundEngine();
    this.storage = new WorldStorage();

    this.world = null;
    this.sky = new SkySystem(this.scene, this.materials.uniforms);
    this.particles = null;
    this.entities = null;
    this.inventory = null;
    this.player = null;

    this.state = 'title'; // 'title' | 'playing'
    this.worldId = null;
    this.worldName = 'Emerald Valley';
    this.gameMode = GAME_MODES.SURVIVAL;
    this.isLocked = false;
    this.suppressPauseOnUnlock = false;

    this.lastTime = performance.now();
    this.fpsAccum = 0;
    this.fpsFrames = 0;
    this.currentFps = 60;
    this.autoSaveTimer = 25;
    this.panoramaAngle = 0;

    this.ui = new GameUI(this, iconUrls);

    this.setupGlobalListeners();
    this.initTitlePanorama();
    this.ui.showTitleScreen();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initTitlePanorama() {
    this.teardownActiveSession(false);
    this.world = new World(this.scene, this.materials, 'EmeraldValley');
    this.world.renderDistance = 4;
    this.world.updateStreaming(0, 0, 3);
    this.sky.timeOfDay = 0.12;
  }

  teardownActiveSession(keepSky = true) {
    if (this.player && this.player.handPivot) {
      this.camera.remove(this.player.handPivot);
    }
    if (this.player && this.player.selectionBox) {
      this.scene.remove(this.player.selectionBox);
    }
    if (this.player && this.player.crackMesh) {
      this.scene.remove(this.player.crackMesh);
    }
    if (this.entities) {
      this.entities.dispose();
      this.entities = null;
    }
    if (this.particles) {
      this.particles.dispose();
      this.particles = null;
    }
    if (this.world) {
      this.world.dispose();
      this.world = null;
    }
    this.player = null;
    this.inventory = null;
    if (!keepSky && this.sky) {
      this.sky.dispose();
    }
  }

  async startNewWorld({ name, seed, mode }) {
    this.sound.ensureContext();
    this.teardownActiveSession();

    this.worldId = `world_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.worldName = name;
    this.gameMode = mode || GAME_MODES.SURVIVAL;

    this.world = new World(this.scene, this.materials, seed);
    this.world.renderDistance = Number(this.ui.renderDistSlider.value) || DEFAULT_RENDER_DISTANCE;

    this.particles = new ParticleSystem(this.scene);
    this.entities = new EntityManager(this.scene, this.world, this.particles, this.sound);
    this.inventory = new Inventory();
    this.inventory.giveStarterKit(this.gameMode);

    this.player = new Player(
      this.camera,
      this.scene,
      this.world,
      this.inventory,
      this.entities,
      this.particles,
      this.sound,
      this.atlasTexture
    );

    const spawn = this.world.findSpawnPoint();
    this.player.pos.set(spawn.x, spawn.y, spawn.z);
    this.player.highestAirY = spawn.y;

    this.sky.timeOfDay = 0.14;
    this.sky.dayCount = 1;
    this.sky.weatherMode = 'auto';

    // Spawn a couple friendly meadow creatures nearby so the world feels immediately alive
    this.spawnInitialWildlife(spawn.x, spawn.z);

    this.wirePlayerCallbacks();
    this.state = 'playing';
    this.ui.showHUD();
    await this.saveCurrentWorld();
    this.requestLock();
  }

  async loadSavedWorld(id) {
    this.sound.ensureContext();
    const saved = await this.storage.getWorld(id);
    if (!saved) return;

    this.teardownActiveSession();

    this.worldId = saved.id;
    this.worldName = saved.name || 'Saved World';
    this.gameMode = saved.mode || GAME_MODES.SURVIVAL;

    this.world = new World(this.scene, this.materials, saved.seed, saved.mods || null);
    this.world.renderDistance = Number(this.ui.renderDistSlider.value) || DEFAULT_RENDER_DISTANCE;

    this.particles = new ParticleSystem(this.scene);
    this.entities = new EntityManager(this.scene, this.world, this.particles, this.sound);
    this.inventory = new Inventory();
    this.inventory.deserialize(saved.inventory);

    this.player = new Player(
      this.camera,
      this.scene,
      this.world,
      this.inventory,
      this.entities,
      this.particles,
      this.sound,
      this.atlasTexture
    );
    this.player.deserialize(saved.player);

    this.world.updateStreaming(this.player.pos.x, this.player.pos.z, 2);

    this.sky.timeOfDay = saved.timeOfDay ?? 0.14;
    this.sky.dayCount = saved.dayCount ?? 1;

    this.spawnInitialWildlife(this.player.pos.x, this.player.pos.z);

    this.wirePlayerCallbacks();
    this.state = 'playing';
    this.ui.showHUD();
    this.requestLock();
  }

  spawnInitialWildlife(cx, cz) {
    const types = ['sheep', 'pig', 'cow', 'chicken'];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const r = 8 + i * 2.5;
      const mx = Math.floor(cx + Math.cos(a) * r);
      const mz = Math.floor(cz + Math.sin(a) * r);
      this.world.ensureChunkData(Math.floor(mx / 16), Math.floor(mz / 16));
      const topY = this.world.getTopSolidY(mx, mz);
      if (topY > 34) {
        this.entities.spawnMob(types[i % types.length], mx + 0.5, topY + 1.05, mz + 0.5);
      }
    }
  }

  wirePlayerCallbacks() {
    this.inventory.onChange = () => {
      this.ui.renderHotbar();
    };
    this.player.onStatsChange = () => {
      this.ui.renderStats();
    };
    this.player.onDamageFlash = () => {
      this.ui.flashDamage();
    };
    this.player.onOpenStation = (stationType) => {
      if (stationType === 'bed') {
        this.player.homePos = {
          x: this.player.pos.x,
          y: this.player.pos.y,
          z: this.player.pos.z,
        };
        if (this.sky.isNight() || this.sky.getPhaseLabel() === 'Sunset') {
          this.sky.timeOfDay = 0.03;
          this.sky.dayCount += 1;
          this.sky.precipActive = false;
          this.player.health = Math.min(20, this.player.health + 8);
          this.ui.renderStats();
          this.sound.playPickup();
          this.saveCurrentWorld();
          this.ui.showStatusToast(`Rested until dawn — Day ${this.sky.dayCount}`);
        } else {
          this.sound.playClick();
          this.saveCurrentWorld();
          this.ui.showStatusToast('Home respawn point set (sleep at sunset or night)');
        }
        return;
      }
      this.suppressPauseOnUnlock = true;
      if (document.pointerLockElement) document.exitPointerLock();
      this.ui.openInventory(stationType);
    };
  }

  setGameMode(mode) {
    this.gameMode = mode;
    if (this.player) {
      if (mode !== GAME_MODES.CREATIVE) {
        this.player.flying = false;
        this.player.highestAirY = this.player.pos.y;
      }
      this.ui.renderStats();
    }
  }

  async saveCurrentWorld() {
    if (this.state !== 'playing' || !this.world || !this.player || !this.inventory) return;
    const record = {
      id: this.worldId,
      name: this.worldName,
      seed: this.world.seed,
      mode: this.gameMode,
      timeOfDay: this.sky.timeOfDay,
      dayCount: this.sky.dayCount,
      player: this.player.serialize(),
      inventory: this.inventory.serialize(),
      mods: this.world.exportMods(),
    };
    await this.storage.saveWorld(record);
  }

  async saveAndReturnToTitle() {
    await this.saveCurrentWorld();
    this.suppressPauseOnUnlock = true;
    if (document.pointerLockElement) document.exitPointerLock();
    this.state = 'title';
    this.initTitlePanorama();
    this.ui.showTitleScreen();
  }

  isAnyModalOpen() {
    return (
      !this.ui.titleScreen.classList.contains('hidden') ||
      !this.ui.invModal.classList.contains('hidden') ||
      !this.ui.pauseModal.classList.contains('hidden') ||
      !this.ui.deathModal.classList.contains('hidden')
    );
  }

  requestLock() {
    if (this.state !== 'playing' || (this.player && this.player.dead)) return;
    this.sound.ensureContext();
    try {
      const p = this.canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) {}
  }

  closeModalsAndLock() {
    this.ui.closeModals();
    this.requestLock();
  }

  setupGlobalListeners() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.canvas;
      if (!this.isLocked) {
        if (this.player) this.player.clearInputs();
        if (
          this.state === 'playing' &&
          !this.suppressPauseOnUnlock &&
          !this.isAnyModalOpen()
        ) {
          this.saveCurrentWorld();
          this.ui.openPause();
        }
        this.suppressPauseOnUnlock = false;
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing') return;
      if (!this.isLocked && !this.isAnyModalOpen()) {
        this.requestLock();
        return;
      }
      if (!this.isLocked || !this.player) return;
      if (e.button === 0) this.player.mouseDownLeft = true;
      else if (e.button === 1) {
        e.preventDefault();
        this.player.pickBlock(this.gameMode === GAME_MODES.CREATIVE);
      } else if (e.button === 2) this.player.mouseDownRight = true;
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.player) return;
      if (e.button === 0) this.player.mouseDownLeft = false;
      else if (e.button === 2) this.player.mouseDownRight = false;
    });

    window.addEventListener('contextmenu', (e) => {
      if (this.state === 'playing') e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isLocked && this.player && this.state === 'playing') {
        this.player.onMouseMove(e.movementX || 0, e.movementY || 0);
      }
    });

    window.addEventListener(
      'wheel',
      (e) => {
        if (this.state === 'playing' && this.isLocked && this.inventory) {
          e.preventDefault();
          if (e.deltaY !== 0) {
            this.inventory.cycleSlot(e.deltaY > 0 ? 1 : -1);
          }
        }
      },
      { passive: false }
    );

    window.addEventListener('keydown', (e) => {
      if (this.state !== 'playing' || !this.player) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

      // Toggle FPS diagnostic in top pill
      if (e.code === 'F3') {
        e.preventDefault();
        this.ui.showFps = !this.ui.showFps;
        return;
      }

      // Inventory & Crafting toggle (E)
      if (e.code === 'KeyE') {
        e.preventDefault();
        if (this.player.dead) return;
        const invOpen = !this.ui.invModal.classList.contains('hidden');
        if (invOpen) {
          this.closeModalsAndLock();
        } else if (this.ui.pauseModal.classList.contains('hidden')) {
          this.suppressPauseOnUnlock = true;
          if (document.pointerLockElement) document.exitPointerLock();
          this.ui.openInventory();
        }
        return;
      }

      // Escape closes open modal or pauses game
      if (e.code === 'Escape') {
        if (!this.ui.invModal.classList.contains('hidden')) {
          e.preventDefault();
          this.ui.closeModals();
          return;
        }
        if (!this.ui.pauseModal.classList.contains('hidden')) {
          e.preventDefault();
          this.closeModalsAndLock();
          return;
        }
      }

      // Number keys 1..9 select hotbar slot
      if (e.code.startsWith('Digit')) {
        const num = Number(e.code.slice(5));
        if (num >= 1 && num <= 9 && this.inventory) {
          this.inventory.selectSlot(num - 1);
          return;
        }
      }

      if (this.isLocked) {
        if (e.code === 'KeyQ') {
          e.preventDefault();
          this.player.tossSelectedItem(e.ctrlKey || e.metaKey);
          return;
        }
        if (e.code === 'KeyG') {
          e.preventDefault();
          this.player.pickBlock(this.gameMode === GAME_MODES.CREATIVE);
          return;
        }
        this.player.onKeyDown(e.code, this.gameMode);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.player) this.player.onKeyUp(e.code);
    });

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

    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.1);

    // FPS counter smoothing
    this.fpsAccum += rawDt;
    this.fpsFrames += 1;
    if (this.fpsAccum >= 0.5) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    // Global shader time & subtle warm torch flicker
    const tSec = now * 0.001;
    this.materials.uniforms.uTime.value = tSec;
    this.materials.uniforms.uTorchFlicker.value =
      0.97 + Math.sin(tSec * 11.3) * 0.02 + Math.cos(tSec * 19.7) * 0.015;

    if (this.state === 'title') {
      // Gently orbit panoramic camera over the sunlit preview world
      this.panoramaAngle += dt * 0.08;
      const rad = 26;
      const px = Math.cos(this.panoramaAngle) * rad;
      const pz = Math.sin(this.panoramaAngle) * rad;
      this.camera.position.set(px, 56, pz);
      this.camera.lookAt(0, 40, 0);
      if (this.world) this.world.updateStreaming(0, 0, 0);
      this.sky.update(dt * 0.4, this.camera.position, null, 4, false);
      this.materials.uniforms.uPlayerLightStrength.value = 0;
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const paused = !this.ui.pauseModal.classList.contains('hidden');
    const simDt = paused ? 0 : dt;

    if (this.player && this.world) {
      if (simDt > 0) {
        this.player.update(simDt, this.gameMode, this.isLocked);
        this.world.updateStreaming(this.player.pos.x, this.player.pos.z, 0);
        this.world.tickWater(simDt);
        this.entities.update(simDt, this.player, this.sky.isNight(), this.gameMode);
        this.particles.update(simDt, this.world);

        this.autoSaveTimer -= simDt;
        if (this.autoSaveTimer <= 0) {
          this.autoSaveTimer = 25;
          this.saveCurrentWorld();
        }
      }

      // Dynamic handheld light when player holds a Torch, Lantern, or Sunstone Lamp
      const heldLight = this.player.getHeldLightStrength();
      this.materials.uniforms.uPlayerLightStrength.value = heldLight;
      if (heldLight > 0) {
        this.materials.uniforms.uPlayerLightPos.value.set(
          this.player.pos.x,
          this.player.pos.y + 1.35,
          this.player.pos.z
        );
      }

      const biome = this.world.terrain.getBiomeAt(this.player.pos.x, this.player.pos.z);
      const weatherInfo = this.sky.update(
        simDt,
        this.player.pos,
        biome,
        this.world.renderDistance,
        this.player.headUnderwater
      );
      this.sound.updateWeather(weatherInfo.isRaining && !paused, simDt);

      this.ui.updateHUDLive(
        biome.name,
        this.sky.dayCount,
        this.sky.getPhaseLabel(),
        this.player.pos,
        this.currentFps,
        this.isLocked,
        this.isAnyModalOpen(),
        this.player.headUnderwater
      );
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__voxelApp = new VoxelRealmsApp();
});
