import * as THREE from 'three';
import { GAME_MODES } from './constants.js';
import { createTextureSystem } from './textures.js';
import { createVoxelMaterials } from './materials.js';
import { World } from './world.js';
import { Inventory } from './inventory.js';
import { EntityManager } from './entities.js';
import { ParticleSystem } from './particles.js';
import { SkyWeatherSystem } from './skyWeather.js';
import { SoundEngine } from './audio.js';
import { WorldStorage } from './storage.js';
import { PlayerController } from './player.js';
import { GameUI } from './ui.js';

class VoxelWildsGame {
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
      75,
      window.innerWidth / window.innerHeight,
      0.08,
      420
    );

    this.textures = createTextureSystem();
    this.materials = createVoxelMaterials(this.textures.atlasTexture);
    this.sound = new SoundEngine();
    this.storage = new WorldStorage();

    this.sky = new SkyWeatherSystem(this.scene, this.materials);
    this.particles = new ParticleSystem(this.scene, null);
    this.entities = new EntityManager({
      scene: this.scene,
      world: null,
      textures: this.textures,
      particles: this.particles,
      sound: this.sound,
    });

    this.inventory = new Inventory(GAME_MODES.SURVIVAL);
    this.inventory.onChange = () => {
      this.player?.rebuildHeldRig();
      this.ui?.renderHotbar();
    };
    this.world = null;
    this.worldMeta = {
      id: null,
      name: 'Emerald Valley',
      seed: 'VoxelWilds',
      gameMode: GAME_MODES.SURVIVAL,
    };

    this.ui = new GameUI({
      textures: this.textures,
      sound: this.sound,
      storage: this.storage,
      callbacks: {
        getGameContext: () => ({
          world: this.world,
          worldMeta: this.worldMeta,
          player: this.player,
          inventory: this.inventory,
          sky: this.sky,
          entities: this.entities,
        }),
        onCreateWorld: (opts) => this.startNewWorld(opts),
        onLoadSavedWorld: (id) => this.loadExistingWorld(id),
        onSaveWorld: () => this.saveCurrentWorld(),
        onResume: () => {
          this.player.setControlsEnabled(true);
        },
        onPauseControls: () => {
          this.player.setControlsEnabled(false);
        },
        onChangeMode: (mode) => {
          this.worldMeta.gameMode = mode;
          this.player.setGameMode(mode);
          this.ui.renderHotbar();
          this.ui.renderVitals();
        },
        onSetTime: (t) => {
          this.sky.timeOfDay = t;
        },
        onToggleWeather: () => this.sky.toggleWeather(),
        onChangeRenderDistance: (dist) => {
          if (this.world) this.world.setRenderDistance(dist);
        },
        onRespawn: () => {
          this.player.respawn();
        },
        onExitToTitle: async () => {
          await this.saveCurrentWorld();
          this.player.setControlsEnabled(false);
          await this.ui.showTitleScreen();
        },
      },
    });

    this.player = new PlayerController({
      camera: this.camera,
      scene: this.scene,
      domElement: this.canvas,
      world: null,
      inventory: this.inventory,
      entities: this.entities,
      particles: this.particles,
      sound: this.sound,
      textures: this.textures,
      materials: this.materials,
      onOpenStation: (stationType) => {
        this.ui.openInventory(stationType);
      },
      onStatsChange: () => {
        this.ui.renderHotbar();
        this.ui.renderVitals();
      },
      onPlayerDeath: () => {
        this.ui.showDeathScreen();
      },
    });

    this.previewAngle = 0;
    this.autoSaveTimer = 0;
    this.fps = 60;
    this.lastTime = performance.now();
    this.elapsed = 0;

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('beforeunload', () => {
      if (this.worldMeta.id && this.ui.state !== 'title') {
        this.saveCurrentWorld();
      }
    });

    this.initTitlePreview();
    this.ui.showTitleScreen();
    requestAnimationFrame((t) => this.loop(t));
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  initTitlePreview() {
    this.mountWorld({
      seed: 'EmeraldPreview-77',
      renderDistance: 4,
      initialEdits: null,
    });
    const center = this.world.findSafeSpawn(0, 0);
    this.previewCenter = center;
    this.world.prewarmAround(center.x, center.z, 3);
    this.player.handPivot.visible = false;
  }

  mountWorld({ seed, renderDistance = 5, initialEdits = null }) {
    if (this.world) {
      this.world.dispose();
    }
    this.world = new World({
      scene: this.scene,
      seed,
      textures: this.textures,
      materials: this.materials,
      renderDistance,
      initialEdits,
    });
    this.particles.setWorld(this.world);
    this.entities.setWorld(this.world);
  }

  seedInitialWildlife(spawn) {
    const types = ['sheep', 'pig', 'chicken', 'sheep'];
    types.forEach((type, idx) => {
      const a = (idx / types.length) * Math.PI * 2 + 0.5;
      const dist = 7 + idx * 2.5;
      const mx = Math.floor(spawn.x + Math.cos(a) * dist) + 0.5;
      const mz = Math.floor(spawn.z + Math.sin(a) * dist) + 0.5;
      const my = this.world.getSurfaceHeight(mx, mz);
      if (my > 30) {
        this.entities.spawnMob(type, mx, my + 1.02, mz);
      }
    });
  }

  async startNewWorld({ name, seed, gameMode }) {
    const id = `world_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.worldMeta = { id, name, seed, gameMode };

    const renderDist = parseInt(document.getElementById('slider-render-dist').value, 10) || 5;
    this.mountWorld({ seed, renderDistance: renderDist, initialEdits: null });

    const spawn = this.world.findSafeSpawn(0, 0);
    this.world.prewarmAround(spawn.x, spawn.z, 3);

    this.sky.timeOfDay = 0.30;
    this.sky.dayCount = 1;
    this.sky.setWeather('clear');

    this.inventory.initDefaults(gameMode);
    this.player.setWorld(this.world, spawn);
    this.player.yaw = 0.4;
    this.player.pitch = -0.1;
    this.player.health = this.player.maxHealth;
    this.player.oxygen = this.player.maxOxygen;
    this.player.setGameMode(gameMode);
    this.player.handPivot.visible = true;
    this.player.rebuildHeldRig(true);

    this.seedInitialWildlife(spawn);

    this.ui.resumeGameplay();
    await this.saveCurrentWorld();
  }

  async loadExistingWorld(id) {
    const saved = await this.storage.loadWorld(id);
    if (!saved) return;

    this.worldMeta = {
      id: saved.id,
      name: saved.name,
      seed: saved.seed,
      gameMode: saved.gameMode || GAME_MODES.SURVIVAL,
    };

    const renderDist = parseInt(document.getElementById('slider-render-dist').value, 10) || 5;
    this.mountWorld({
      seed: saved.seed,
      renderDistance: renderDist,
      initialEdits: saved.edits || null,
    });

    const pSaved = saved.player;
    const startX = pSaved?.x ?? 0.5;
    const startZ = pSaved?.z ?? 0.5;
    this.world.prewarmAround(startX, startZ, 3);

    const fallbackSpawn = this.world.findSafeSpawn(0, 0);
    this.player.setWorld(this.world, fallbackSpawn);

    this.inventory.initDefaults(this.worldMeta.gameMode);
    if (saved.inventory) {
      this.inventory.deserialize(saved.inventory);
    }
    if (pSaved) {
      this.player.deserialize(pSaved);
    }

    this.sky.timeOfDay = typeof saved.timeOfDay === 'number' ? saved.timeOfDay : 0.30;
    this.sky.dayCount = saved.dayCount || 1;
    this.sky.setWeather(saved.weatherMode || 'clear');

    this.player.handPivot.visible = true;
    this.player.rebuildHeldRig(true);
    this.seedInitialWildlife(this.player.position);

    this.ui.resumeGameplay();
  }

  async saveCurrentWorld() {
    if (!this.world || !this.worldMeta.id) return false;
    const record = {
      id: this.worldMeta.id,
      name: this.worldMeta.name,
      seed: this.worldMeta.seed,
      gameMode: this.player.gameMode,
      dayCount: this.sky.dayCount,
      timeOfDay: this.sky.timeOfDay,
      weatherMode: this.sky.weatherMode,
      player: this.player.serialize(),
      inventory: this.inventory.serialize(),
      edits: this.world.exportEdits(),
    };
    return this.storage.saveWorld(record);
  }

  loop(now) {
    requestAnimationFrame((t) => this.loop(t));

    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.1);
    this.elapsed += dt;
    this.fps = this.fps * 0.92 + (1 / Math.max(0.001, rawDt)) * 0.08;

    if (!this.world) return;

    if (this.ui.state === 'title') {
      // Gentle scenic camera orbit on title screen
      this.previewAngle += dt * 0.14;
      const cx = (this.previewCenter?.x ?? 0) + Math.cos(this.previewAngle) * 18;
      const cz = (this.previewCenter?.z ?? 0) + Math.sin(this.previewAngle) * 18;
      const cy = (this.previewCenter?.y ?? 42) + 12;

      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(
        this.previewCenter?.x ?? 0,
        (this.previewCenter?.y ?? 36) + 2,
        this.previewCenter?.z ?? 0
      );

      this.sky.update(dt * 0.5, this.elapsed, this.camera.position, false, this.world.renderDistance);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const isPaused = this.ui.state === 'paused' || this.ui.state === 'dead';
    const simDt = isPaused ? 0 : dt;

    if (simDt > 0) {
      this.player.update(simDt);
      this.world.updateStreaming(this.player.position.x, this.player.position.z);

      const biome = this.world.generator.getBiomeAt(this.player.position.x, this.player.position.z);
      this.sky.update(
        simDt,
        this.elapsed,
        this.player.position,
        this.player.headUnderwater,
        this.world.renderDistance
      );
      this.sound.setWeatherRain(
        biome === 'Snowy Taiga' || biome === 'Golden Dunes' ? 0 : this.sky.weatherIntensity
      );

      this.entities.update(
        simDt,
        this.player,
        this.inventory,
        this.sky.isNight(),
        this.player.gameMode
      );

      this.particles.update(simDt, this.player.position, this.sky.weatherIntensity, biome);

      // Periodic background auto-save
      this.autoSaveTimer += simDt;
      if (this.autoSaveTimer >= 25) {
        this.autoSaveTimer = 0;
        this.saveCurrentWorld();
      }
    }

    this.ui.updateFrameHUD({
      player: this.player,
      world: this.world,
      sky: this.sky,
      entities: this.entities,
      fps: this.fps,
    });

    this.renderer.render(this.scene, this.camera);
  }
}

const game = new VoxelWildsGame();
window.__VOXEL_WILDS__ = game;
