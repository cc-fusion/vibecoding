import * as THREE from 'three';
import { DEFAULT_RENDER_DISTANCE, GAME_MODES } from './constants.js';
import { BLOCK } from './data/blocks.js';
import { TextureAtlas } from './graphics/TextureAtlas.js';
import { VoxelMaterials } from './graphics/VoxelMaterials.js';
import { World } from './world/World.js';
import { WorldPersistence } from './world/WorldPersistence.js';
import { Inventory } from './player/Inventory.js';
import { Player } from './player/Player.js';
import { ViewModel } from './player/ViewModel.js';
import { ItemDropManager } from './entities/ItemDropManager.js';
import { PrimedTNTManager } from './entities/PrimedTNT.js';
import { MobManager } from './entities/MobManager.js';
import { SkyWeather } from './atmosphere/SkyWeather.js';
import { ParticleSystem } from './atmosphere/ParticleSystem.js';
import { SoundManager } from './audio/SoundManager.js';
import { UIManager } from './ui/UIManager.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 450);

    // Core subsystems
    this.atlas = new TextureAtlas();
    this.materials = new VoxelMaterials(this.atlas.texture);
    this.sound = new SoundManager();
    this.persistence = new WorldPersistence();

    this.skyWeather = new SkyWeather(this.scene);
    this.particles = new ParticleSystem(this.scene, this.atlas);
    this.itemDrops = new ItemDropManager(this.scene, this.atlas);
    this.tntManager = new PrimedTNTManager(this.scene, this.atlas);
    this.mobManager = new MobManager(this.scene);

    this.inventory = new Inventory();
    this.viewModel = new ViewModel(this.atlas);
    this.player = new Player(this.camera, this.scene, this.atlas, this.inventory);

    this.world = null;
    this.currentWorldId = null;
    this.currentWorldName = '';
    this.inTitle = true;

    // Timers & FPS tracking
    this._lastTime = performance.now();
    this._elapsed = 0;
    this._autosaveTimer = 25;
    this._emberTimer = 0;
    this._fpsFrames = 0;
    this._fpsAccum = 0;
    this.fps = 60;
    this._wasPointerLocked = false;
    this._dragLookActive = false;

    // UI Controller
    this.ui = new UIManager(this);

    this._wireCallbacks();
    this._bindGlobalInput();
    this._initTitlePanorama();

    this.ui.showTitleScreen();
    requestAnimationFrame((t) => this._loop(t));
  }

  _wireCallbacks() {
    this.inventory.onChange = () => {
      if (!this.inTitle) {
        this.ui.renderHotbar();
      }
    };

    this.player.onOpenCraftingTable = () => {
      this.ui.openStationModal('crafting_table');
    };
    this.player.onOpenFurnace = (x, y, z) => {
      const f = this.world.getOrCreateFurnace(x, y, z);
      this.ui.openStationModal('furnace', f);
    };
    this.player.onOpenChest = (x, y, z) => {
      const slots = this.world.getOrCreateChest(x, y, z);
      this.ui.openStationModal('chest', slots);
    };
    this.player.onToast = (msg) => {
      this.ui.showToast(msg);
    };
    this.player.onVitalsChange = () => {
      if (this.player.health < this._prevHealth) {
        this.ui.flashHurt();
      }
      this._prevHealth = this.player.health;
      this.ui.renderVitals();
    };
    this.player.onDeath = () => {
      this.ui.openDeathModal();
    };
  }

  _bindGlobalInput() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.viewModel.onResize(w / h);
      this.renderer.setSize(w, h);
    });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      if (locked && !this._wasPointerLocked) {
        this._lockEngageTime = performance.now();
      }
      if (this._wasPointerLocked && !locked && !this.inTitle && !this.ui.activeModal) {
        this.player.clearInputs();
        this.ui.openPauseModal();
      }
      this._wasPointerLocked = locked;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (this.inTitle || this.ui.activeModal) return;
      this.sound.unlock();

      if (document.pointerLockElement !== this.canvas) {
        this.requestPointerLock();
        this._dragLookActive = true;
      }

      if (e.button === 0) this.player.mouseLeftDown = true;
      if (e.button === 2) this.player.mouseRightDown = true;
    });

    window.addEventListener('mouseup', (e) => {
      this._dragLookActive = false;
      if (e.button === 0) this.player.mouseLeftDown = false;
      if (e.button === 2) this.player.mouseRightDown = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (this.inTitle || this.ui.activeModal) return;
      if (this._lockEngageTime && performance.now() - this._lockEngageTime < 85) return;
      if (document.pointerLockElement === this.canvas || this._dragLookActive) {
        this.player.onMouseMove(e.movementX || 0, e.movementY || 0, this.viewModel);
      }
    });

    window.addEventListener('wheel', (e) => {
      if (this.inTitle || this.ui.activeModal) return;
      if (Math.abs(e.deltaY) > 0) {
        this.inventory.cycleHotbar(e.deltaY);
      }
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
      // Allow typing normally inside text/search inputs
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.code === 'Escape') {
          document.activeElement.blur();
        }
        return;
      }

      if (this.inTitle) {
        if (e.code === 'Escape' && this.ui.activeModal === 'controls') {
          this.ui._closeControlsReturn();
        }
        return;
      }

      if (e.code === 'F3') {
        e.preventDefault();
        this.ui.showDebug = !this.ui.showDebug;
        this.ui.debugOverlay.classList.toggle('hidden', !this.ui.showDebug);
        return;
      }

      if (e.code === 'KeyE') {
        e.preventDefault();
        this.sound.unlock();
        if (this.ui.activeModal === 'inventory') {
          this.ui.closeModalsAndLock();
        } else if (!this.ui.activeModal) {
          this.player.clearInputs();
          this.ui.openStationModal('inventory');
        }
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        if (this.ui.activeModal === 'inventory') {
          this.ui.closeModalsAndLock();
        } else if (this.ui.activeModal === 'controls') {
          this.ui._closeControlsReturn();
        } else if (this.ui.activeModal === 'pause') {
          this.ui.closeModalsAndLock();
        } else if (!this.ui.activeModal) {
          this.player.clearInputs();
          this.ui.openPauseModal();
        }
        return;
      }

      if (this.ui.activeModal) return;

      // Hotbar keys 1..9
      if (e.code.startsWith('Digit')) {
        const num = Number(e.code.slice(5));
        if (num >= 1 && num <= 9) {
          this.inventory.selectHotbar(num - 1);
          return;
        }
      }

      if (e.code === 'KeyQ') {
        this.player.tossHeldItem(this.itemDrops, this.sound);
        return;
      }

      this.player.onKeyDown(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.player.onKeyUp(e.code);
    });

    window.addEventListener('beforeunload', () => {
      if (!this.inTitle && this.currentWorldId) {
        this.saveCurrentWorld();
      }
    });
  }

  requestPointerLock() {
    try {
      if (this.canvas.requestPointerLock) {
        const p = this.canvas.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch {
      // Fallback gracefully if blocked by sandbox
    }
  }

  unlockPointer() {
    try {
      if (document.pointerLockElement === this.canvas && document.exitPointerLock) {
        document.exitPointerLock();
      }
    } catch {
      // Ignore
    }
  }

  _clearEntitiesAndWorld() {
    this.itemDrops.clear();
    this.tntManager.clear();
    this.mobManager.clear();
    if (this.world) {
      this.world.dispose();
      this.world = null;
    }
  }

  _initTitlePanorama() {
    this._clearEntitiesAndWorld();
    this.inTitle = true;
    this.world = new World(this.scene, this.atlas, this.materials, 'VoxterraPanorama-2026');
    this.world.renderDistance = 4;
    const center = this.world.generator.findSpawnPoint();
    this._panoramaCenter = center;
    this._panoramaAngle = 0;
    this.world.preloadAround(center.x, center.z, 3);
    this.skyWeather.timeOfDay = 0.32;
    this.skyWeather.weather = 'clear';
  }

  async startNewWorld({ name, seed, gameMode }) {
    this._clearEntitiesAndWorld();

    this.currentWorldId = `world_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.currentWorldName = name;
    this.inTitle = false;

    const sliderDist = Number(document.getElementById('render-dist-slider')?.value) || DEFAULT_RENDER_DISTANCE;
    this.world = new World(this.scene, this.atlas, this.materials, seed);
    this.world.renderDistance = sliderDist;
    this.world.onSpawnDrop = (x, y, z, id, count, dur) => {
      this.itemDrops.spawnDrop(x, y, z, id, count, dur);
    };

    const rawSpawn = this.world.generator.findSpawnPoint();
    this.world.preloadAround(rawSpawn.x, rawSpawn.z, 2);

    // Pick a nearby column free of tree canopy with open sky above
    let sx = Math.floor(rawSpawn.x);
    let sz = Math.floor(rawSpawn.z);
    let sy = Math.floor(rawSpawn.y);
    outer: for (let r = 0; r <= 6; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const tx = Math.floor(rawSpawn.x) + dx;
          const tz = Math.floor(rawSpawn.z) + dz;
          for (let y = 78; y >= 34; y--) {
            const b = this.world.getBlock(tx, y, tz);
            if (b === BLOCK.GRASS || b === BLOCK.SAND || b === BLOCK.SNOW_GRASS || b === BLOCK.STONE) {
              if (this.world.getBlock(tx, y + 1, tz) === BLOCK.AIR &&
                  this.world.getBlock(tx, y + 2, tz) === BLOCK.AIR &&
                  this.world.getSkyLight(tx, y + 2, tz) >= 14) {
                sx = tx;
                sz = tz;
                sy = y + 1;
                break outer;
              }
              break;
            } else if (b !== BLOCK.AIR && b !== BLOCK.TALL_GRASS && b !== BLOCK.RED_FLOWER && b !== BLOCK.YELLOW_FLOWER) {
              break;
            }
          }
        }
      }
    }

    // Face the direction with the most open view 8 blocks away
    let bestYaw = 0;
    let lowestAhead = 999;
    for (let a = 0; a < 8; a++) {
      const candidateYaw = (a / 8) * Math.PI * 2;
      const checkX = Math.round(sx - Math.sin(candidateYaw) * 8);
      const checkZ = Math.round(sz - Math.cos(candidateYaw) * 8);
      const colH = this.world.generator.sampleColumnCached(checkX, checkZ).height;
      if (colH < lowestAhead) {
        lowestAhead = colH;
        bestYaw = candidateYaw;
      }
    }

    const finalSpawn = { x: sx + 0.5, y: sy + 0.02, z: sz + 0.5 };
    this.player.setGameMode(gameMode);
    this.player.spawnPoint = { ...finalSpawn };
    this.player.setPositionSafe(finalSpawn.x, finalSpawn.y, finalSpawn.z);
    this.player.yaw = bestYaw;
    this.player.pitch = -0.08;
    this.player.health = 20;
    this.player.hunger = 20;
    this.player.dead = false;
    this._prevHealth = 20;

    this.inventory.initDefaultForMode(gameMode);
    this.skyWeather.timeOfDay = 0.29;
    this.skyWeather.dayNumber = 1;
    this.skyWeather.weather = 'clear';

    this.ui.enterGameplayHUD();
    await this.saveCurrentWorld();
    this.requestPointerLock();
  }

  async loadExistingWorld(id) {
    const record = await this.persistence.loadWorld(id);
    if (!record) {
      this.ui.showToast('Could not load saved world');
      return;
    }

    this._clearEntitiesAndWorld();
    this.currentWorldId = record.id;
    this.currentWorldName = record.name;
    this.inTitle = false;

    const sliderDist = Number(document.getElementById('render-dist-slider')?.value) || DEFAULT_RENDER_DISTANCE;
    this.world = new World(this.scene, this.atlas, this.materials, record.seedString || record.worldData?.seed);
    this.world.renderDistance = sliderDist;
    this.world.onSpawnDrop = (x, y, z, itemId, count, dur) => {
      this.itemDrops.spawnDrop(x, y, z, itemId, count, dur);
    };
    this.world.restoreState(record.worldData);

    this.player.setGameMode(record.gameMode || GAME_MODES.SURVIVAL);
    this.player.restore(record.playerData);
    this._prevHealth = this.player.health;

    this.world.preloadAround(this.player.pos.x, this.player.pos.z, 2);

    if (record.envData) {
      this.skyWeather.timeOfDay = record.envData.timeOfDay ?? 0.30;
      this.skyWeather.dayNumber = record.envData.dayNumber ?? 1;
      this.skyWeather.weather = record.envData.weather ?? 'clear';
    }

    this.ui.enterGameplayHUD();
    this.requestPointerLock();
  }

  setGameMode(mode) {
    this.player.setGameMode(mode);
    if (mode === GAME_MODES.CREATIVE) {
      // Ensure hotbar has creative starter blocks if completely empty
      const hasAny = this.inventory.slots.some((s) => s && s.count > 0);
      if (!hasAny) this.inventory.initDefaultForMode(GAME_MODES.CREATIVE);
    }
    this.ui.renderVitals();
    this.ui.renderHotbar();
  }

  respawnPlayer() {
    this.player.respawn(this.world);
    this.ui.closeModalsAndLock();
  }

  async saveCurrentWorld() {
    if (this.inTitle || !this.currentWorldId || !this.world) return;
    const record = {
      id: this.currentWorldId,
      name: this.currentWorldName,
      seedString: this.world.seedString,
      gameMode: this.player.gameMode,
      worldData: this.world.serializeState(),
      playerData: this.player.serialize(),
      envData: {
        timeOfDay: this.skyWeather.timeOfDay,
        dayNumber: this.skyWeather.dayNumber,
        weather: this.skyWeather.weather,
      },
    };
    await this.persistence.saveWorld(record);
  }

  async returnToTitle() {
    await this.saveCurrentWorld();
    this.unlockPointer();
    this._initTitlePanorama();
    this.ui.showTitleScreen();
  }

  _emitNearbyTorchParticles(dt) {
    this._emberTimer -= dt;
    if (this._emberTimer > 0 || !this.world) return;
    this._emberTimer = 0.25;

    const px = Math.floor(this.player.pos.x);
    const py = Math.floor(this.player.pos.y);
    const pz = Math.floor(this.player.pos.z);

    for (let tries = 0; tries < 10; tries++) {
      const bx = px + Math.floor((Math.random() - 0.5) * 14);
      const by = py + Math.floor((Math.random() - 0.5) * 8);
      const bz = pz + Math.floor((Math.random() - 0.5) * 14);
      const id = this.world.getBlock(bx, by, bz);
      if (id === BLOCK.TORCH || id === BLOCK.FURNACE_LIT) {
        this.particles.emitTorchEmber(bx + 0.5, by, bz + 0.5);
        break;
      }
    }
  }

  _loop(now) {
    requestAnimationFrame((t) => this._loop(t));

    const rawDt = (now - this._lastTime) / 1000;
    this._lastTime = now;
    const dt = Math.min(0.08, Math.max(0.0005, rawDt));
    this._elapsed += dt;

    // FPS calculation
    this._fpsFrames++;
    this._fpsAccum += rawDt;
    if (this._fpsAccum >= 0.5) {
      this.fps = Math.round(this._fpsFrames / this._fpsAccum);
      this._fpsFrames = 0;
      this._fpsAccum = 0;
    }

    if (this.inTitle) {
      // Orbit scenic title panorama
      this._panoramaAngle += dt * 0.14;
      const r = 22;
      const cx = this._panoramaCenter.x + Math.cos(this._panoramaAngle) * r;
      const cz = this._panoramaCenter.z + Math.sin(this._panoramaAngle) * r;
      const cy = this._panoramaCenter.y + 15 + Math.sin(this._panoramaAngle * 0.7) * 2.5;
      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(this._panoramaCenter.x, this._panoramaCenter.y + 2, this._panoramaCenter.z);

      this.world.updateStreaming(this._panoramaCenter.x, this._panoramaCenter.z, dt);
      const biome = this.world.getBiomeAt(this._panoramaCenter.x, this._panoramaCenter.z);
      this.skyWeather.update(dt, this.camera.position, biome, 0.35);
      this.materials.update(this._elapsed, this.skyWeather.skyState, this.world.renderDistance, false);

      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Active Gameplay Simulation (pauses world/mob physics when Pause modal is open)
    const isPaused = this.ui.activeModal === 'pause' || this.ui.activeModal === 'controls';
    const controlsActive = !this.ui.activeModal;

    if (!isPaused && this.world) {
      const wx = Math.floor(this.player.pos.x);
      const wz = Math.floor(this.player.pos.z);
      const currentBiome = this.world.getBiomeAt(wx, wz);

      this.world.updateStreaming(this.player.pos.x, this.player.pos.z, dt);
      this.world.updateFurnaces(dt);

      this.skyWeather.update(dt, this.player.pos, currentBiome, 1.0);
      this.player.update(
        dt,
        controlsActive,
        this.world,
        this.viewModel,
        this.itemDrops,
        this.particles,
        this.sound,
        this.mobManager,
        this.tntManager,
        this.skyWeather
      );

      this.mobManager.update(dt, this.world, this.player, this.skyWeather, this.itemDrops, this.particles, this.sound);
      this.itemDrops.update(dt, this.world, this.player.pos, this.inventory, this.sound);
      this.tntManager.update(dt, this.world, this.particles, this.sound, this.itemDrops, this.player, this.mobManager);
      this.particles.update(dt, this.world);
      this._emitNearbyTorchParticles(dt);

      this.materials.update(
        this._elapsed,
        this.skyWeather.skyState,
        this.world.renderDistance,
        this.player.eyesUnderwater
      );
      this.sound.update(dt, this.skyWeather.activePrecipitation === 'rain');

      // Periodic autosave
      this._autosaveTimer -= dt;
      if (this._autosaveTimer <= 0) {
        this._autosaveTimer = 25;
        this.saveCurrentWorld();
      }
    }

    this.ui.updateFrameHUD(this.fps);

    // Render 3D World + 3D First-Person Held ViewModel
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (!this.player.dead) {
      this.viewModel.render(this.renderer);
    }
  }
}
