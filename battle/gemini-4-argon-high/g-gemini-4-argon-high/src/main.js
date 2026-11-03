import * as THREE from 'three';
import { REGISTRY } from './game/constants.js';
import { createTextureSystem } from './game/textures.js';
import { VoxelWorld } from './game/world.js';
import { SoundSystem } from './game/audio.js';
import { ParticleSystem } from './game/particles.js';
import { SkyWeatherSystem } from './game/skyWeather.js';
import { InventorySystem } from './game/inventory.js';
import { EntityManager } from './game/mobs.js';
import { PlayerController } from './game/player.js';
import { WorldStorage } from './game/storage.js';
import { UIController } from './game/ui.js';

export class VoxelGame {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      260
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.textures = createTextureSystem();
    this.audio = new SoundSystem();
    this.particles = new ParticleSystem(this.scene);
    this.sky = new SkyWeatherSystem(this.scene);
    this.inventory = new InventorySystem();
    this.storage = new WorldStorage();

    this.world = new VoxelWorld(this.scene, this.textures, 'EMERALD_VALLEY_2026');
    this.entities = new EntityManager(this.scene, this.world);
    this.player = new PlayerController(
      this.camera,
      this.scene,
      this.world,
      this.inventory,
      this.audio,
      this.particles,
      this.entities
    );

    this.ui = new UIController(this);

    // Load saved world in active slot or initialize fresh spawn
    this._loadOrInitActiveSlot();

    // Populate a few friendly passive creatures near spawn
    for (let i = 0; i < 6; i++) {
      this.entities.spawnMobNearPlayer(this.player.position, false, this.player.mode);
    }

    this.ui.renderHotbar();
    this.ui.updateHUD(0, 60);

    this._bindInputs();

    this.lastTime = performance.now();
    this.fpsSmooth = 60;
    this.autoSaveTimer = 0;
    this.torchFlameTimer = 0;

    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  _loadOrInitActiveSlot() {
    const saved = this.storage.loadWorld(this.storage.activeSlot);
    if (saved && saved.seed) {
      this.applyLoadedWorldData(saved);
    } else {
      this.player.spawnAtSafePosition(7, 0);
      this.saveCurrentWorld();
    }
  }

  teleportToBiome(biomeId) {
    if (biomeId === 'home') {
      this.player.yaw = 0;
      this.player.pitch = -0.1;
      this.player.spawnAtSafePosition(7, 0);
      this.ui.showHotbarToast('Teleported to Home Outpost');
      this.ui.updateHUD();
      return;
    }
    const target = this.world.generator.findBiomeCoordinates(
      biomeId,
      Math.floor(this.player.position.x),
      Math.floor(this.player.position.z)
    );
    this.player.spawnAtSafePosition(target.x, target.z);
    const biome = this.world.generator.getBiomeAt(target.x, target.z);
    this.ui.showHotbarToast(`Fast Traveled: ${biome.name}`);
    this.ui.updateHUD();
  }

  applyLoadedWorldData(data) {
    this.entities.clearAll();
    this.world.loadModifications(data.modifications || {}, data.seed || 'EMERALD_VALLEY_2026');

    if (data.inventory) {
      this.inventory.deserialize(data.inventory);
    } else {
      this.inventory.initStarterKit();
    }

    this.sky.timeOfDay = typeof data.timeOfDay === 'number' ? data.timeOfDay : 0.22;
    this.sky.dayCount = data.dayCount || 1;
    this.sky.setWeather(data.weather || 'clear');

    this.setGameMode(data.mode || 'survival');

    if (data.player && typeof data.player.x === 'number') {
      this.world.preloadSpawnArea(data.player.x, data.player.z, 2);
      this.player.position.set(data.player.x, data.player.y, data.player.z);
      this.player.yaw = data.player.yaw || 0;
      this.player.pitch = data.player.pitch || -0.15;
      this.player.health = data.player.health ?? 20;
      this.player.hunger = data.player.hunger ?? 20;
      this.player.level = data.player.level ?? 1;
      this.player.xp = data.player.xp ?? 0;
      this.player.flying = Boolean(data.player.flying);
      this.player.syncCamera(0);
    } else {
      this.player.spawnAtSafePosition(0, 0);
    }

    for (let i = 0; i < 5; i++) {
      this.entities.spawnMobNearPlayer(this.player.position, this.sky.isNight(), this.player.mode);
    }

    this.player.rebuildHeldMesh();
    this.ui.renderHotbar();
    this.ui.updateHUD(0, 60);
  }

  saveCurrentWorld() {
    const payload = {
      name: `World ${this.storage.activeSlot.replace('slot_', '#')}`,
      seed: this.world.seed,
      dayCount: this.sky.dayCount,
      timeOfDay: this.sky.timeOfDay,
      weather: this.sky.weather,
      mode: this.player.mode,
      player: {
        x: Number(this.player.position.x.toFixed(2)),
        y: Number(this.player.position.y.toFixed(2)),
        z: Number(this.player.position.z.toFixed(2)),
        yaw: Number(this.player.yaw.toFixed(3)),
        pitch: Number(this.player.pitch.toFixed(3)),
        health: this.player.health,
        hunger: this.player.hunger,
        level: this.player.level,
        xp: this.player.xp,
        flying: this.player.flying,
      },
      inventory: this.inventory.serialize(),
      modifications: this.world.serializeModifications(),
    };
    this.storage.saveWorld(this.storage.activeSlot, payload);
    return payload;
  }

  switchWorldSlot(slotId) {
    this.saveCurrentWorld();
    this.storage.setActiveSlot(slotId);
    const saved = this.storage.loadWorld(slotId);
    if (saved) {
      this.applyLoadedWorldData(saved);
    } else {
      this.createNewWorldInActiveSlot(`REALM_${slotId.toUpperCase()}_${Math.floor(Math.random() * 999)}`);
    }
  }

  createNewWorldInActiveSlot(newSeed) {
    this.entities.clearAll();
    this.world.loadModifications({}, newSeed);
    this.inventory.initStarterKit();
    this.player.health = 20;
    this.player.hunger = 20;
    this.player.level = 1;
    this.player.xp = 0;
    this.sky.timeOfDay = 0.22;
    this.sky.dayCount = 1;
    this.sky.setWeather('clear');
    this.player.yaw = 0;
    this.player.pitch = -0.1;
    this.player.spawnAtSafePosition(7, 0);
    for (let i = 0; i < 6; i++) {
      this.entities.spawnMobNearPlayer(this.player.position, false, this.player.mode);
    }
    this.player.rebuildHeldMesh();
    this.saveCurrentWorld();
    this.ui.renderHotbar();
    this.ui.updateHUD(0, 60);
    this.ui.showHotbarToast(`Generated Seed: ${newSeed}`);
  }

  exportCurrentWorldJSON() {
    const payload = this.saveCurrentWorld();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voxel_realm_${this.world.seed.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importWorldJSONFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed && parsed.seed) {
          this.applyLoadedWorldData(parsed);
          this.saveCurrentWorld();
          this.ui.closeAllModals(true);
          this.ui.showHotbarToast(`Imported World: ${parsed.seed}`);
        }
      } catch (err) {
        console.error('Failed to import world JSON:', err);
      }
    };
    reader.readAsText(file);
  }

  setGameMode(mode) {
    this.player.mode = mode === 'creative' ? 'creative' : 'survival';
    if (this.player.mode === 'survival') {
      this.player.flying = false;
    }
    this.ui.updateHUD();
  }

  requestPointerLockSafe() {
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // Ignore in environments that restrict pointer lock
    }
  }

  _bindInputs() {
    const canvas = this.renderer.domElement;
    let isDraggingLook = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('mousedown', (e) => {
      if (this.ui.isAnyModalOpen()) return;

      // Request pointer lock on canvas click if not locked
      if (!document.pointerLockElement) {
        this.requestPointerLockSafe();
      }

      if (e.button === 0) {
        this.player.mouseDownLeft = true;
        isDraggingLook = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      } else if (e.button === 2) {
        this.player.mouseDownRight = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.player.mouseDownLeft = false;
        isDraggingLook = false;
      } else if (e.button === 2) {
        this.player.mouseDownRight = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.ui.isAnyModalOpen()) return;

      if (document.pointerLockElement === canvas) {
        this.player.rotateCamera(e.movementX * 0.0022, e.movementY * 0.0022);
      } else if (isDraggingLook) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        this.player.rotateCamera(dx * 0.004, dy * 0.004);
      }
    });

    // Scroll wheel hotbar selection
    window.addEventListener(
      'wheel',
      (e) => {
        if (this.ui.isAnyModalOpen()) return;
        const delta = e.deltaY > 0 ? 1 : -1;
        const heldDef = this.inventory.selectSlot(this.inventory.selectedHotbar + delta);
        this.player.rebuildHeldMesh();
        this.ui.renderHotbar();
        if (heldDef) this.ui.showHotbarToast(heldDef.name);
      },
      { passive: true }
    );

    window.addEventListener('keydown', (e) => {
      // Allow typing in seed input when Pause Modal is open
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        if (e.code === 'Escape') {
          this.ui.closeAllModals(false);
        }
        return;
      }

      this.player.keys[e.code] = true;

      if (e.code === 'KeyE') {
        e.preventDefault();
        this.ui.toggleInventoryModal();
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        this.ui.togglePauseModal();
        return;
      }

      if (this.ui.isAnyModalOpen()) return;

      // Hotbar keys 1..9
      if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        if (num >= 1 && num <= 9) {
          const heldDef = this.inventory.selectSlot(num - 1);
          this.player.rebuildHeldMesh();
          this.ui.renderHotbar();
          if (heldDef) this.ui.showHotbarToast(heldDef.name);
        }
      }

      // Fly mode toggle ('F')
      if (e.code === 'KeyF') {
        this.player.flying = !this.player.flying;
        this.player.velocity.y = 0;
        this.ui.showHotbarToast(this.player.flying ? 'Flight Enabled' : 'Flight Disabled');
        this.ui.updateHUD();
      }

      // Controls card toggle ('H')
      if (e.code === 'KeyH') {
        this.ui.elControlsToggle?.click();
      }

      // Telemetry toggle ('F3')
      if (e.code === 'F3') {
        e.preventDefault();
        if (this.ui.elTelemetry) {
          this.ui.elTelemetry.classList.toggle('hidden');
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.player.keys[e.code] = false;
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('beforeunload', () => {
      this.saveCurrentWorld();
    });
  }

  _animate(now) {
    requestAnimationFrame(this._animate);

    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(0.08, Math.max(0.001, rawDt));

    const instFps = 1 / Math.max(0.001, rawDt);
    this.fpsSmooth = this.fpsSmooth * 0.92 + instFps * 0.08;

    const modalOpen = this.ui.isAnyModalOpen();

    if (!modalOpen) {
      this.player.update(
        dt,
        () => {
          this.ui.renderHotbar();
          this.ui.updateHUD(dt, this.fpsSmooth);
        },
        () => {
          this.ui.toggleInventoryModal();
        }
      );

      this.world.updateStreaming(this.player.position.x, this.player.position.z, 2);
      this.world.updatePrimedTNTs(dt);

      this.entities.update(dt, this.player, this.sky.isNight(), this.audio, (itemId, count) => {
        if (this.inventory.addItem(itemId, count)) {
          this.audio.playPickup();
          this.player.rebuildHeldMesh();
          this.ui.renderHotbar();
          const def = REGISTRY[itemId];
          if (def) this.ui.showHotbarToast(`+${count} ${def.name}`);
        }
      });

      this.particles.update(dt);
      this.sky.update(dt, this.player.position, this.world.renderDistance);
      this.audio.updateAmbientMusic(dt);

      // Ambient torch flame particles for nearby torches
      this.torchFlameTimer += dt;
      if (this.torchFlameTimer > 0.22) {
        this.torchFlameTimer = 0;
        const { cx, cz } = this.world.worldToChunk(this.player.position.x, this.player.position.z);
        const curChunk = this.world.getChunk(cx, cz);
        if (curChunk && curChunk.lightSources.length > 0) {
          for (const ls of curChunk.lightSources) {
            if (Math.random() < 0.45) {
              this.particles.spawnTorchFlame(ls.wx, ls.wy + 0.15, ls.wz);
            }
          }
        }
      }

      // Auto-save every 10 seconds
      this.autoSaveTimer += dt;
      if (this.autoSaveTimer >= 10.0) {
        this.autoSaveTimer = 0;
        this.saveCurrentWorld();
      }

      this.ui.updateHUD(dt, this.fpsSmooth);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Start the game once DOM is ready
function bootstrap() {
  if (!window.__VOXEL_GAME__) {
    window.__VOXEL_GAME__ = new VoxelGame();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
