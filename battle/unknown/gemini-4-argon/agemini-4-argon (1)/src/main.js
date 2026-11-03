import * as THREE from 'three';
import { GAME_MODES } from './game/constants.js';
import { TextureAtlas } from './game/rendering/TextureAtlas.js';
import { AudioEngine } from './game/audio/AudioEngine.js';
import { WorldStorage } from './game/storage/WorldStorage.js';
import { World } from './game/world/World.js';
import { SkyAndWeather } from './game/effects/SkyAndWeather.js';
import { ParticleSystem } from './game/effects/ParticleSystem.js';
import { EntityManager } from './game/entities/EntityManager.js';
import { Player } from './game/entities/Player.js';
import { UIManager } from './game/ui/UIManager.js';

class VoxelwildGame {
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
    this.camera = new THREE.PerspectiveCamera(
      74,
      window.innerWidth / window.innerHeight,
      0.08,
      600
    );
    this.scene.add(this.camera);

    this.storage = new WorldStorage();
    this.settings = this.storage.loadSettings();

    this.atlas = new TextureAtlas();
    this.audio = new AudioEngine();
    this.audio.setVolume(this.settings.volume);

    this.sky = new SkyAndWeather(this.scene);
    this.particles = new ParticleSystem(this.scene);

    this.world = null;
    this.entities = null;
    this.player = null;
    this.activeWorldMeta = null; // { id, name, seed, mode }

    this.isPlaying = false;
    this.pointerLocked = false;
    this.elapsedTime = 0;
    this.lastFrameTime = performance.now();
    this.fpsSmooth = 60;
    this.autoSaveTimer = 25.0;

    this.input = {
      keys: {},
      mouseLeft: false,
      mouseRight: false,
      justPressedLeft: false,
      justPressedRight: false,
    };

    this.ui = new UIManager({
      atlas: this.atlas,
      storage: this.storage,
      audio: this.audio,
      callbacks: {
        getPlayer: () => this.player,
        getActiveWorldId: () => (this.activeWorldMeta ? this.activeWorldMeta.id : null),
        onPlayOrResume: () => this.handlePlayOrResume(),
        onCreateWorld: (cfg) => this.createAndStartWorld(cfg),
        onSelectWorld: (id) => this.loadAndStartWorld(id),
        onDeleteWorld: (id) => this.handleDeleteWorld(id),
        onManualSave: () => this.saveCurrentWorld(),
        onSettingsChanged: (next) => this.applySettings(next),
        onSetTime: (t) => {
          this.sky.timeOfDay = t;
          this.ui.showToast('Updated world time');
        },
        onToggleWeather: () => {
          const biome = this.getCurrentBiome();
          const w = this.sky.cycleWeather(biome);
          this.ui.showToast(`Weather: ${w.charAt(0).toUpperCase() + w.slice(1)}`);
        },
        onCloseModal: () => this.closeModalAndResume(),
        onDropStack: (id, count) => this.dropItemsFromPlayer(id, count),
        onRespawn: () => {
          if (this.player) {
            this.player.respawn();
            this.requestGamePointerLock();
          }
        },
      },
    });

    this.ui.applyInitialSettings(this.settings);
    this.bindInputEvents();
    this.initPreviewBackdrop();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initPreviewBackdrop() {
    // Load a scenic live world backdrop for the title screen immediately
    this.world = new World({
      scene: this.scene,
      atlas: this.atlas,
      seed: 'emerald-valley-777',
      renderDistance: Math.min(4, this.settings.renderDistance),
    });
    const center = this.world.generator.findSafeSpawn();
    this.previewCenter = center;
    this.world.preloadAround(center.x, center.z, 2);
  }

  teardownCurrentSession() {
    if (this.player) {
      this.player.dispose();
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

  async handlePlayOrResume() {
    this.audio.ensureContext();

    if (this.activeWorldMeta && this.player) {
      this.resumeGameplay();
      return;
    }

    const existing = await this.storage.listWorlds();
    if (existing.length > 0) {
      await this.loadAndStartWorld(existing[0].id);
    } else {
      await this.createAndStartWorld({
        name: 'Emerald Valley',
        seed: `emerald-${Math.floor(100 + Math.random() * 900)}`,
        mode: GAME_MODES.SURVIVAL,
      });
    }
  }

  async createAndStartWorld({ name, seed, mode }) {
    this.audio.ensureContext();
    if (this.activeWorldMeta) {
      await this.saveCurrentWorld();
    }

    const id = `world_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.startWorldInstance({
      id,
      name,
      seed,
      mode,
      timeOfDay: 0.30,
      dayCount: 1,
      guideStep: 0,
      milestones: { placedTable: false, placedFurnace: false, placedTorch: false },
      worldData: null,
      playerData: null,
    });
    await this.saveCurrentWorld();
    this.resumeGameplay();
  }

  async loadAndStartWorld(worldId) {
    this.audio.ensureContext();
    if (this.activeWorldMeta && this.activeWorldMeta.id === worldId && this.player) {
      this.resumeGameplay();
      return;
    }
    if (this.activeWorldMeta) {
      await this.saveCurrentWorld();
    }

    const record = await this.storage.loadWorld(worldId);
    if (!record) return;

    this.startWorldInstance(record);
    this.resumeGameplay();
  }

  async handleDeleteWorld(worldId) {
    await this.storage.deleteWorld(worldId);
    if (this.activeWorldMeta && this.activeWorldMeta.id === worldId) {
      this.activeWorldMeta = null;
      this.isPlaying = false;
      this.teardownCurrentSession();
      this.initPreviewBackdrop();
      this.ui.setMenuVisible(true, null);
    }
  }

  startWorldInstance(record) {
    this.teardownCurrentSession();

    this.activeWorldMeta = {
      id: record.id,
      name: record.name,
      seed: record.seed,
      mode: record.mode || GAME_MODES.SURVIVAL,
    };

    this.sky.timeOfDay = typeof record.timeOfDay === 'number' ? record.timeOfDay : 0.30;
    this.sky.dayCount = record.dayCount || 1;
    if (record.weather) this.sky.weather = record.weather;

    this.world = new World({
      scene: this.scene,
      atlas: this.atlas,
      seed: this.activeWorldMeta.seed,
      renderDistance: this.settings.renderDistance,
      savedState: record.worldData || null,
    });

    this.entities = new EntityManager(
      this.scene,
      this.world,
      this.atlas,
      this.particles,
      this.audio
    );

    this.player = new Player({
      camera: this.camera,
      scene: this.scene,
      world: this.world,
      atlas: this.atlas,
      entities: this.entities,
      particles: this.particles,
      audio: this.audio,
      mode: this.activeWorldMeta.mode,
    });

    if (record.playerData) {
      this.player.deserialize(record.playerData);
    }

    this.ui.guideStep = record.guideStep || 0;
    this.ui.guideDismissed = Boolean(record.guideDismissed);
    this.ui.milestones = record.milestones
      ? { ...record.milestones }
      : { placedTable: false, placedFurnace: false, placedTorch: false };

    // Preload chunks around player spawn so ground is immediately solid and rendered!
    this.world.preloadAround(this.player.position.x, this.player.position.z, 2);

    // Ensure player stands cleanly on sunlit natural ground (never atop tree leaves) on fresh spawn
    if (!record.playerData) {
      const baseX = Math.floor(this.player.position.x);
      const baseZ = Math.floor(this.player.position.z);
      let chosen = null;

      for (let r = 0; r <= 10 && !chosen; r++) {
        for (let dz = -r; dz <= r && !chosen; dz++) {
          for (let dx = -r; dx <= r && !chosen; dx++) {
            const wx = baseX + dx;
            const wz = baseZ + dz;
            const surfH = this.world.generator.getSurfaceInfo(wx, wz).height;
            if (
              surfH > 45 &&
              !this.player.collidesAt(wx + 0.5, surfH + 1.05, wz + 0.5) &&
              this.world.getSkyLight(wx, surfH + 2, wz) >= 14
            ) {
              chosen = { x: wx + 0.5, y: surfH + 1.05, z: wz + 0.5 };
            }
          }
        }
      }

      if (chosen) {
        this.player.position.set(chosen.x, chosen.y, chosen.z);
      } else {
        let sy = Math.floor(this.player.position.y);
        while (sy < 120 && this.player.collidesAt(this.player.position.x, sy, this.player.position.z)) {
          sy++;
        }
        this.player.position.y = sy + 0.05;
      }

      this.player.fallPeakY = this.player.position.y;
      this.player.spawnPoint = {
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
      };
    }

    this.applySettings(this.settings, false);

    // Hook Player -> UI events
    this.player.onHintMessage = (msg) => this.ui.showToast(msg);
    this.player.onBlockPlaced = (blockId) => this.ui.recordBlockPlaced(blockId);
    this.player.onInteractBlock = (kind, x, y, z) => this.handleBlockInteraction(kind, x, y, z);
    this.player.onDeath = () => {
      this.exitPointerLock();
      this.ui.closeModal();
      this.ui.deathModal.classList.remove('hidden');
    };
  }

  handleBlockInteraction(kind, x, y, z) {
    if (kind === 'crafting') {
      this.exitPointerLock();
      this.ui.openModal({ station: 'crafting', workbench: true });
    } else if (kind === 'furnace') {
      const fState = this.world.getOrCreateFurnace(x, y, z);
      this.exitPointerLock();
      this.ui.openModal({ station: 'furnace', furnaceState: fState });
    } else if (kind === 'chest') {
      const slots = this.world.getOrCreateChest(x, y, z);
      this.exitPointerLock();
      this.ui.openModal({ station: 'chest', chestSlots: slots });
    } else if (kind === 'bed') {
      this.player.spawnPoint = { x: x + 0.5, y: y + 1.05, z: z + 0.5 };
      if (this.sky.isNight() || this.sky.weather !== 'clear') {
        this.sky.skipToMorning();
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 4);
        this.ui.showToast('Rested until dawn — Respawn point set!', 3.0);
      } else {
        this.ui.showToast('Respawn point set to this Bed!');
      }
      this.saveCurrentWorld();
    }
  }

  async saveCurrentWorld() {
    if (!this.activeWorldMeta || !this.world || !this.player) return false;
    const record = {
      id: this.activeWorldMeta.id,
      name: this.activeWorldMeta.name,
      seed: this.activeWorldMeta.seed,
      mode: this.activeWorldMeta.mode,
      timeOfDay: this.sky.timeOfDay,
      dayCount: this.sky.dayCount,
      weather: this.sky.weather,
      guideStep: this.ui.guideStep,
      guideDismissed: this.ui.guideDismissed,
      milestones: { ...this.ui.milestones },
      playerData: this.player.serialize(),
      worldData: this.world.serializeWorldData(),
    };
    return this.storage.saveWorld(record);
  }

  applySettings(next, persist = true) {
    this.settings = persist ? this.storage.saveSettings(next) : { ...this.settings, ...next };
    this.audio.setVolume(this.settings.volume);
    if (this.world && this.activeWorldMeta) {
      this.world.setRenderDistance(this.settings.renderDistance);
    }
    if (this.player) {
      this.player.baseFov = this.settings.fov;
      this.player.sensitivity = this.settings.sensitivity;
      this.player.invertY = this.settings.invertY;
      this.camera.fov = this.settings.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  resumeGameplay() {
    if (!this.player) return;
    this.isPlaying = true;
    this.ui.closeModal();
    this.ui.setMenuVisible(false, this.activeWorldMeta);
    this.ui.announceHotbarSelection(this.player);
    this.requestGamePointerLock();
  }

  pauseGameplay() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.exitPointerLock();
    this.ui.closeModal();
    this.ui.setMenuVisible(true, this.activeWorldMeta);
    this.saveCurrentWorld();
  }

  closeModalAndResume() {
    this.ui.closeModal();
    if (this.isPlaying && this.player && !this.player.isDead) {
      this.requestGamePointerLock();
    }
  }

  requestGamePointerLock() {
    if (this.canvas && this.canvas.requestPointerLock) {
      try {
        const res = this.canvas.requestPointerLock();
        if (res && typeof res.catch === 'function') res.catch(() => {});
      } catch (_) {}
    }
  }

  exitPointerLock() {
    if (document.pointerLockElement && document.exitPointerLock) {
      try {
        document.exitPointerLock();
      } catch (_) {}
    }
  }

  dropItemsFromPlayer(id, count = 1) {
    if (!this.player || !this.entities) return;
    const eye = this.player.getEyePosition();
    const dir = this.player.getLookDirection();
    this.entities.spawnDroppedItem(
      eye.x + dir.x * 0.5,
      eye.y - 0.2,
      eye.z + dir.z * 0.5,
      id,
      count,
      dir
    );
  }

  getCurrentBiome() {
    if (this.world && this.player) {
      return this.world.generator.getBiomeAt(this.player.position.x, this.player.position.z);
    }
    return null;
  }

  bindInputEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (!this.pointerLocked) {
        this.input.keys = {};
        this.input.mouseLeft = false;
        this.input.mouseRight = false;
        // If playing and neither inventory nor death modal was intentionally opened, show pause menu
        if (
          this.isPlaying &&
          !this.ui.isModalOpen() &&
          (!this.player || !this.player.isDead)
        ) {
          this.pauseGameplay();
        }
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.audio.ensureContext();
      if (!this.isPlaying || this.ui.isModalOpen() || (this.player && this.player.isDead)) {
        return;
      }
      if (!this.pointerLocked) {
        this.requestGamePointerLock();
        return;
      }
      if (e.button === 0) {
        this.input.mouseLeft = true;
        this.input.justPressedLeft = true;
      } else if (e.button === 2) {
        this.input.mouseRight = true;
        this.input.justPressedRight = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.input.mouseLeft = false;
      if (e.button === 2) this.input.mouseRight = false;
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked && this.isPlaying && this.player) {
        this.player.rotateLook(e.movementX || 0, e.movementY || 0);
      }
    });

    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.isPlaying || !this.pointerLocked || !this.player) return;
        if (Math.abs(e.deltaY) < 1) return;
        const step = e.deltaY > 0 ? 1 : -1;
        this.player.inventory.selectSlot(this.player.inventory.selectedHotbar + step);
        this.ui.announceHotbarSelection(this.player);
      },
      { passive: true }
    );

    window.addEventListener('keydown', (e) => {
      // Allow typing normally inside menu inputs
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'F3') {
        e.preventDefault();
        this.ui.showDebug = !this.ui.showDebug;
        return;
      }

      if (e.code === 'Escape') {
        if (this.ui.isModalOpen()) {
          e.preventDefault();
          this.closeModalAndResume();
          return;
        }
        if (this.isPlaying) {
          this.pauseGameplay();
          return;
        }
      }

      if (!this.isPlaying || !this.player || this.player.isDead) return;

      if (e.code === 'KeyE') {
        e.preventDefault();
        if (this.ui.isModalOpen()) {
          this.closeModalAndResume();
        } else {
          const nearTable = this.world.isNearbyCraftingTable(
            this.player.position.x,
            this.player.position.y,
            this.player.position.z,
            4
          );
          this.exitPointerLock();
          this.ui.openModal({ station: 'inventory', workbench: nearTable });
        }
        return;
      }

      if (this.ui.isModalOpen()) {
        if (e.code === 'KeyQ' && this.ui.heldCursorItem) {
          this.dropItemsFromPlayer(this.ui.heldCursorItem.id, this.ui.heldCursorItem.count);
          this.ui.heldCursorItem = null;
          this.ui.updateCursorVisual();
          this.ui.refreshModalView();
        }
        return;
      }

      if (!e.repeat && e.code === 'Space') {
        this.player.handleSpacePress(performance.now() * 0.001);
      }

      if (!e.repeat && e.code === 'KeyF') {
        this.player.toggleFlight();
      }

      if (!e.repeat && e.code === 'KeyQ') {
        const slot = this.player.inventory.getSelectedSlot();
        if (slot) {
          const dropCount = e.shiftKey ? slot.count : 1;
          const id = slot.id;
          if (this.player.inventory.consumeSelected(dropCount)) {
            this.dropItemsFromPlayer(id, dropCount);
          }
        }
      }

      if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.slice(5), 10);
        if (num >= 1 && num <= 9) {
          this.player.inventory.selectSlot(num - 1);
          this.ui.announceHotbarSelection(this.player);
        }
      }

      this.input.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.input.keys[e.code] = false;
    });

    window.addEventListener('beforeunload', () => {
      this.saveCurrentWorld();
    });
  }

  animate(nowMs) {
    requestAnimationFrame(this.animate);

    const rawDt = (nowMs - this.lastFrameTime) * 0.001;
    this.lastFrameTime = nowMs;
    const dt = Math.min(0.05, Math.max(0.0005, rawDt));
    this.elapsedTime += dt;

    const instFps = 1.0 / Math.max(0.001, rawDt);
    this.fpsSmooth += (instFps - this.fpsSmooth) * 0.08;

    if (this.isPlaying && this.player && this.world) {
      const modalOpen = this.ui.isModalOpen();
      const activeControl = this.pointerLocked && !modalOpen && !this.player.isDead;

      this.player.update(dt, this.input, activeControl);

      const currentBiome = this.getCurrentBiome();
      this.sky.update(
        dt,
        this.elapsedTime,
        this.camera.position,
        this.world,
        currentBiome,
        this.player.headUnderwater
      );

      this.world.update(
        dt,
        this.player.position.x,
        this.player.position.z,
        this.elapsedTime
      );

      this.entities.update(
        dt,
        this.elapsedTime,
        this.player,
        this.sky.isNight(),
        this.player.mode
      );

      this.particles.update(dt, this.world);
      this.audio.updateAmbience(dt, {
        weather: this.sky.weather,
        underwater: this.player.headUnderwater,
        paused: false,
      });

      this.ui.updateHUD(dt, {
        player: this.player,
        sky: this.sky,
        currentBiome,
        fps: this.fpsSmooth,
      });

      // Periodic silent autosave
      this.autoSaveTimer -= dt;
      if (this.autoSaveTimer <= 0) {
        this.autoSaveTimer = 25.0;
        this.saveCurrentWorld();
      }
    } else if (this.world) {
      // Scenic panoramic camera flyover while on Title / Pause Menu!
      const focus = this.player
        ? this.player.position
        : this.previewCenter || { x: 0, y: 60, z: 0 };

      if (!this.player) {
        const angle = this.elapsedTime * 0.09;
        const radius = 26;
        const cx = focus.x + Math.cos(angle) * radius;
        const cz = focus.z + Math.sin(angle) * radius;
        this.camera.position.set(cx, focus.y + 16, cz);
        this.camera.lookAt(focus.x, focus.y + 2, focus.z);
      }

      const biome = this.world.generator.getBiomeAt(focus.x, focus.z);
      this.sky.update(dt * 0.25, this.elapsedTime, this.camera.position, this.world, biome, false);
      this.world.update(dt, focus.x, focus.z, this.elapsedTime);
      this.audio.updateAmbience(dt, { paused: true });
    }

    this.input.justPressedLeft = false;
    this.input.justPressedRight = false;

    this.renderer.render(this.scene, this.camera);
  }
}

window.__VOXELWILD__ = new VoxelwildGame();
