import * as THREE from 'three';
import { GAME_MODES } from './constants.js';
import { BLOCK, getDef } from './blocks.js';
import { TextureManager } from './textures.js';
import { World } from './world/world.js';
import { SkyAtmosphere } from './atmosphere/sky.js';
import { Inventory } from './gameplay/inventory.js';
import { ProgressionTracker } from './gameplay/progression.js';
import { PlayerController } from './player/controller.js';
import { ParticleManager } from './entities/particles.js';
import { ItemDropsManager } from './entities/drops.js';
import { MobManager } from './entities/mobs.js';
import { SoundManager } from './audio/sound.js';
import { SaveManager } from './storage/saveManager.js';
import { UIManager } from './ui/uiManager.js';

export class TerraVoxGame {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 420);
    this.scene.add(this.camera);

    this.textures = new TextureManager();
    this.sound = new SoundManager();
    this.saveManager = new SaveManager();
    this.settings = this.saveManager.loadSettings();

    this.world = null;
    this.sky = null;
    this.inventory = null;
    this.progression = null;
    this.player = null;
    this.particles = null;
    this.drops = null;
    this.mobs = null;

    this.isWorldActive = false;
    this.worldMeta = null;
    this.gameMode = GAME_MODES.SURVIVAL;
    this.autoSaveTimer = 25;

    // Scenic background panorama for Title Screen
    this.previewAngle = 0;
    this.previewCenter = new THREE.Vector3(0, 44, 0);

    this.lastFrameTime = performance.now();
    this.fps = 60;

    this.ui = new UIManager(this);
    this.applySettings();

    this._bindGlobalEvents();
    this._setupTitlePanorama();
    this.ui.showTitleScreen();

    requestAnimationFrame((t) => this._loop(t));
  }

  _setupTitlePanorama() {
    this._teardownWorld();
    this.sky = new SkyAtmosphere(this.scene);
    this.sky.timeOfDay = 0.30;
    this.world = new World(this.scene, this.textures, 'EmeraldValley');
    const spawn = this.world.generator.findSafeSpawn();
    this.previewCenter.set(spawn.x, spawn.y + 12, spawn.z);
    this.world.preloadAround(spawn.x, spawn.z, 2);
  }

  _teardownWorld() {
    this.isWorldActive = false;
    if (this.player) {
      this.player._rebuildHeldMesh(0);
      this.camera.remove(this.player.handRig);
      this.scene.remove(this.player.selectionWire);
      this.scene.remove(this.player.crackMesh);
      this.player.selectionWire.geometry.dispose();
      this.player.selectionWire.material.dispose();
      this.player.crackMesh.geometry.dispose();
      this.player.crackMat.dispose();
      this.player = null;
    }
    if (this.mobs) {
      this.mobs.dispose();
      this.mobs = null;
    }
    if (this.drops) {
      this.drops.dispose();
      this.drops = null;
    }
    if (this.particles) {
      this.particles.dispose();
      this.particles = null;
    }
    if (this.world) {
      this.world.dispose();
      this.world = null;
    }
    if (this.sky) {
      this.sky.dispose();
      this.sky = null;
    }
  }

  async startNewWorld({ name, seed, gameMode }) {
    this._teardownWorld();

    const id = `world_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.worldMeta = { id, name, seed };
    this.gameMode = gameMode || GAME_MODES.SURVIVAL;

    this._initSessionSystems(seed, null);

    const spawn = this.world.generator.findSafeSpawn();
    this.world.preloadAround(spawn.x, spawn.z, 2);

    const clearSpawn = this._findClearGroundSpawn(Math.floor(spawn.x), Math.floor(spawn.z));
    this.player.pos.copy(clearSpawn);
    this.player.spawnPoint.copy(this.player.pos);

    if (this.gameMode === GAME_MODES.CREATIVE) {
      this.inventory.clearAndLoadCreativeDefaults();
    }

    this.mobs.spawnInitialFauna(this.player.pos);
    this.isWorldActive = true;

    await this.saveCurrentWorld();
    this.ui.enterGameplayUI();
    this.requestPointerLock();
  }

  _findClearGroundSpawn(originX, originZ) {
    for (let r = 0; r <= 18; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const wx = originX + dx;
          const wz = originZ + dz;
          for (let y = 85; y >= 31; y--) {
            const id = this.world.getBlock(wx, y, wz);
            if (id === BLOCK.AIR || getDef(id).crossMesh) continue;
            if (
              id === BLOCK.OAK_LEAVES ||
              id === BLOCK.BIRCH_LEAVES ||
              id === BLOCK.SPRUCE_LEAVES ||
              id === BLOCK.WATER ||
              id === BLOCK.CACTUS
            ) {
              break; // Canopy or water column; try next column
            }
            const head1 = this.world.getBlock(wx, y + 1, wz);
            const head2 = this.world.getBlock(wx, y + 2, wz);
            if (!getDef(head1).solid && !getDef(head2).solid) {
              return new THREE.Vector3(wx + 0.5, y + 1.05, wz + 0.5);
            }
            break;
          }
        }
      }
    }
    return new THREE.Vector3(originX + 0.5, 44, originZ + 0.5);
  }

  async loadSavedWorld(worldId) {
    const record = await this.saveManager.loadWorld(worldId);
    if (!record) return;

    this._teardownWorld();

    this.worldMeta = {
      id: record.id,
      name: record.name,
      seed: record.seed,
    };
    this.gameMode = record.gameMode || GAME_MODES.SURVIVAL;

    this._initSessionSystems(record.seed, record.deltas || null);

    if (typeof record.timeOfDay === 'number') this.sky.timeOfDay = record.timeOfDay;
    if (typeof record.dayCount === 'number') this.sky.dayCount = record.dayCount;

    this.inventory.deserialize(record.inventory);
    this.progression.deserialize(record.progression);
    this.player.deserialize(record.player);

    this.world.preloadAround(this.player.pos.x, this.player.pos.z, 2);
    this.mobs.spawnInitialFauna(this.player.pos);

    this.isWorldActive = true;
    this.ui.enterGameplayUI();
    this.requestPointerLock();
  }

  _initSessionSystems(seed, savedDeltas) {
    this.sky = new SkyAtmosphere(this.scene);
    this.world = new World(this.scene, this.textures, seed, savedDeltas);

    this.inventory = new Inventory();
    this.inventory.onChange = () => {
      this.ui.renderHotbar();
      if (this.ui.activeScreen === 'inventory') {
        this.ui.renderInventoryGrids();
        this.ui.renderRecipes();
      }
      if (this.progression) {
        this.progression.update(this.inventory);
      }
    };

    this.progression = new ProgressionTracker();
    this.progression.onMilestoneComplete = (m) => {
      this.sound.playMilestone();
      this.ui.showToast(`Completed: ${m.title}`);
    };

    this.particles = new ParticleManager(this.scene, this.world);
    this.drops = new ItemDropsManager(this.scene, this.world, this.textures, this.inventory, this.sound);
    this.mobs = new MobManager(this.scene, this.world, this.drops, this.particles, this.sound);

    this.player = new PlayerController(
      this.camera,
      this.scene,
      this.world,
      this.inventory,
      this.textures,
      this.sound
    );
    this.player.gameMode = this.gameMode;
    this.player.sensitivity = this.settings.sensitivity;
    this.player.baseFov = this.settings.fov || 75;
    this.player.onToast = (msg) => this.ui.showToast(msg);

    this.player.onBlockBroken = (bx, by, bz, blockId, canHarvest) => {
      const def = getDef(blockId);
      this.particles.emitBlockBreak(bx, by, bz, def.particleColor || '#888888', 18);
      if (canHarvest && this.gameMode === GAME_MODES.SURVIVAL) {
        this.drops.spawnBlockHarvest(bx, by, bz, blockId);
      }
    };

    this.player.onBlockPlaced = (bx, by, bz, blockId) => {
      this.progression.recordBlockPlaced(blockId);
      this.progression.update(this.inventory);
    };

    this.player.onOpenStation = (stationType) => {
      this.ui.openInventory(stationType);
    };

    this.player.onAttackRay = (origin, dir, maxDist) => {
      return this.mobs.attackAlongRay(origin, dir, maxDist, this.player, this.inventory.getHeldId());
    };

    this.player.canPlaceAtEntityCheck = (bx, by, bz) => {
      return this.mobs.canPlaceBlockAt(bx, by, bz);
    };

    this.player.onPlayerDied = () => {
      this.ui.showToast('Respawned at camp');
    };
  }

  setGameMode(mode) {
    this.gameMode = mode;
    if (this.player) {
      this.player.gameMode = mode;
      if (mode !== GAME_MODES.CREATIVE) {
        this.player.isFlying = false;
      } else {
        // Ensure creative player has basic building blocks if hotbar is empty
        const hasAny = this.inventory.slots.some(Boolean);
        if (!hasAny) {
          this.inventory.clearAndLoadCreativeDefaults();
        }
      }
    }
    this.ui.showToast(`Switched to ${mode === GAME_MODES.CREATIVE ? 'Creative' : 'Survival'} Mode`);
  }

  applySettings() {
    const s = this.settings;
    this.sound.sfxVolume = s.soundVolume;
    this.sound.musicVolume = s.musicVolume;
    if (this.player) {
      this.player.sensitivity = s.sensitivity;
    }
    this.saveManager.saveSettings(s);
  }

  getNearbyStations() {
    if (!this.world || !this.player) return { workbench: false, furnace: false };
    const p = this.player.pos;
    return {
      workbench:
        this.gameMode === GAME_MODES.CREATIVE ||
        this.world.hasNearbyBlock(p.x, p.y + 0.8, p.z, BLOCK.CRAFTING_TABLE, 4.5),
      furnace:
        this.gameMode === GAME_MODES.CREATIVE ||
        this.world.hasNearbyBlock(p.x, p.y + 0.8, p.z, BLOCK.FURNACE, 4.5),
    };
  }

  dropHeldItem() {
    if (!this.isWorldActive || !this.player || !this.inventory) return;
    const slot = this.inventory.getHeldSlot();
    if (!slot) return;

    const itemId = slot.id;
    this.inventory.consumeHeld(1);

    const eye = this.player.getEyePosition();
    const dir = this.player.getLookDirection();
    const vel = dir.clone().multiplyScalar(5.5);
    vel.y += 2.0;

    this.drops.spawnDrop(
      eye.x + dir.x * 0.45,
      eye.y - 0.2,
      eye.z + dir.z * 0.45,
      itemId,
      1,
      vel,
      1.35
    );
  }

  async saveCurrentWorld() {
    if (!this.isWorldActive || !this.world || !this.player || !this.worldMeta) return;
    const record = {
      id: this.worldMeta.id,
      name: this.worldMeta.name,
      seed: this.worldMeta.seed,
      gameMode: this.gameMode,
      timeOfDay: this.sky.timeOfDay,
      dayCount: this.sky.dayCount,
      player: this.player.serialize(),
      inventory: this.inventory.serialize(),
      progression: this.progression.serialize(),
      deltas: this.world.serializeDeltas(),
    };
    await this.saveManager.saveWorld(record);
  }

  async exitToTitle() {
    await this.saveCurrentWorld();
    this._setupTitlePanorama();
    await this.ui.showTitleScreen();
  }

  requestPointerLock() {
    try {
      this.canvas.requestPointerLock?.();
    } catch {
      // Ignore pointer lock rejection in automated/restricted frames
    }
  }

  _bindGlobalEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('pointerdown', () => this.sound.unlock(), { passive: true });
    window.addEventListener('keydown', () => this.sound.unlock(), { passive: true });

    // Canvas mouse interactions
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.ui.activeScreen !== 'playing' || !this.isWorldActive) return;
      if (document.pointerLockElement !== this.canvas) {
        this.requestPointerLock();
      }
      if (e.button === 0) {
        this.player.mouseDownLeft = true;
      } else if (e.button === 2) {
        this.player.mouseDownRight = true;
        this.player.handleRightClickAction();
      } else if (e.button === 1) {
        e.preventDefault();
        this.player.pickTargetedBlock();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.player) return;
      if (e.button === 0) this.player.mouseDownLeft = false;
      if (e.button === 2) this.player.mouseDownRight = false;
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mousemove', (e) => {
      if (
        this.ui.activeScreen === 'playing' &&
        this.isWorldActive &&
        document.pointerLockElement === this.canvas
      ) {
        this.player.onMouseMove(e.movementX, e.movementY);
      }
    });

    window.addEventListener(
      'wheel',
      (e) => {
        if (this.ui.activeScreen !== 'playing' || !this.isWorldActive) return;
        if (e.deltaY === 0) return;
        const dir = e.deltaY > 0 ? 1 : -1;
        this.inventory.selectHotbar(this.inventory.selectedHotbar + dir);
      },
      { passive: true }
    );

    document.addEventListener('pointerlockchange', () => {
      if (
        document.pointerLockElement !== this.canvas &&
        this.ui.activeScreen === 'playing' &&
        this.isWorldActive
      ) {
        this.ui.openPauseMenu();
      }
    });

    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        if (e.code === 'Escape') document.activeElement.blur();
        return;
      }

      if (e.code === 'F3') {
        e.preventDefault();
        this.settings.showDiagnostics = !this.settings.showDiagnostics;
        this.applySettings();
        return;
      }

      if (!this.isWorldActive) return;

      if (e.code === 'KeyE') {
        e.preventDefault();
        if (this.ui.activeScreen === 'playing') {
          this.ui.openInventory();
        } else if (this.ui.activeScreen === 'inventory') {
          this.ui.resumeGameplay();
        }
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        if (this.ui.activeScreen === 'inventory') {
          this.ui.resumeGameplay();
        } else if (this.ui.activeScreen === 'settings') {
          this.ui.closeSettings();
        } else if (this.ui.activeScreen === 'controls') {
          this.ui.closeControls();
        } else if (this.ui.activeScreen === 'pause') {
          this.ui.resumeGameplay();
        } else if (this.ui.activeScreen === 'playing') {
          this.ui.openPauseMenu();
        }
        return;
      }

      if (this.ui.activeScreen !== 'playing') return;

      if (e.code === 'KeyQ' && !e.repeat) {
        this.dropHeldItem();
        return;
      }

      if (e.code === 'KeyF' && !e.repeat) {
        this.player.pickTargetedBlock();
        return;
      }

      this.player.handleKeyDown(e.code, e.repeat);
    });

    window.addEventListener('keyup', (e) => {
      if (this.player) {
        this.player.handleKeyUp(e.code);
      }
    });

    window.addEventListener('blur', () => {
      if (this.player) this.player.clearInputs();
    });

    window.addEventListener('beforeunload', () => {
      if (this.isWorldActive) {
        this.saveCurrentWorld();
      }
    });
  }

  _loop(now) {
    requestAnimationFrame((t) => this._loop(t));

    const rawDt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));
    this.fps += (1 / Math.max(0.001, rawDt) - this.fps) * 0.08;

    if (!this.isWorldActive) {
      // Title screen slow scenic orbit
      this.previewAngle += dt * 0.085;
      const radius = 22;
      const cx = this.previewCenter.x + Math.cos(this.previewAngle) * radius;
      const cz = this.previewCenter.z + Math.sin(this.previewAngle) * radius;
      this.camera.position.set(cx, this.previewCenter.y, cz);
      this.camera.lookAt(this.previewCenter.x, this.previewCenter.y - 6, this.previewCenter.z);

      if (this.world && this.sky) {
        this.world.updateStreaming(cx, cz, 3, 4.0);
        this.sky.update(dt * 0.4, this.camera.position, this.world.materials.uniforms, false, null);
      }
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const isPaused = this.ui.activeScreen === 'pause' || this.ui.activeScreen === 'settings' || this.ui.activeScreen === 'controls';
    const controlsActive = this.ui.activeScreen === 'playing';

    if (!isPaused) {
      this.player.update(dt, controlsActive);

      const biome = this.world.generator.getBiomeAt(
        Math.floor(this.player.pos.x),
        Math.floor(this.player.pos.z)
      );
      const heldId = this.inventory.getHeldId();
      const targetHeldLight = getDef(heldId).light ? getDef(heldId).light / 15.0 : 0.0;
      const curHeld = this.world.materials.uniforms.uHeldLight.value;
      this.world.materials.uniforms.uHeldLight.value = curHeld + (targetHeldLight - curHeld) * Math.min(1, dt * 10);

      const activeWeather = this.sky.update(
        dt,
        this.camera.position,
        this.world.materials.uniforms,
        this.player.headUnderwater,
        biome
      );

      this.world.updateStreaming(
        this.player.pos.x,
        this.player.pos.z,
        this.settings.renderDistance,
        5.5
      );

      this.drops.update(dt, this.player.pos);
      this.mobs.update(dt, this.player, this.sky.isNight(), this.settings.peacefulMobs);
      this.particles.update(dt, this.player.pos, activeWeather);
      this.sound.updateAmbientMusic(dt);

      // Periodic auto-save
      this.autoSaveTimer -= dt;
      if (this.autoSaveTimer <= 0) {
        this.autoSaveTimer = 25;
        this.saveCurrentWorld();
      }
    }

    this.ui.updateHUD(dt, this.fps);
    this.renderer.render(this.scene, this.camera);
  }
}
