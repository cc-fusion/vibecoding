import * as THREE from 'three';
import { BLOCK, ITEM, getDef } from './world/blocks.js';
import { RENDER_TYPE, TOOL_TYPE } from './world/constants.js';
import { TextureManager } from './world/textures.js';
import { World } from './world/world.js';
import { Player } from './physics/player.js';
import { Inventory } from './gameplay/inventory.js';
import { DropManager } from './entities/drops.js';
import { MobManager } from './entities/mobs.js';
import { SkySystem } from './effects/sky.js';
import { ParticleSystem } from './effects/particles.js';
import { SoundEngine } from './audio/sound.js';
import { SaveManager } from './storage/save.js';
import { UIManager } from './ui/hud.js';

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
    this.renderer.autoClear = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 360);
    this.scene.add(this.camera);

    // Dedicated overlay scene & fixed-FOV camera for 3D held item/block viewmodel
    this.viewmodelScene = new THREE.Scene();
    this.viewmodelCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 10);
    this.vmHemiLight = new THREE.HemisphereLight(0xfff8ed, 0x6b7485, 0.95);
    this.vmDirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    this.vmDirLight.position.set(1.5, 2.5, 2.0);
    this.viewmodelScene.add(this.viewmodelCamera, this.vmHemiLight, this.vmDirLight);
    this.heldLightSmooth = 0;

    this.textures = new TextureManager();
    this.sound = new SoundEngine();
    this.saveManager = new SaveManager();
    this.inventory = new Inventory();

    this.prefs = {
      renderDistance: 5,
      volume: 0.65,
      sensitivity: 1.0,
      fov: 75,
      ...this.saveManager.loadPrefs(),
    };

    this.world = null;
    this.player = null;
    this.sky = null;
    this.particles = null;
    this.drops = null;
    this.mobs = null;

    this.worldMeta = null;
    this.hasActiveWorld = false;
    this.milestones = new Set();

    // Target highlight wireframe + 3D crack box
    this.buildTargetHighlightMeshes();

    // Mining & input state
    this.mouseDownLeft = false;
    this.mouseDownRight = false;
    this.rightPlaceCooldown = 0;
    this.creativeBreakCooldown = 0;
    this.mineTargetKey = '';
    this.mineProgress = 0;
    this.mineChipTimer = 0;
    this.pointerLocked = false;
    this.draggingLook = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Timing & FPS
    this.lastTime = performance.now();
    this.fpsAccum = 0;
    this.fpsFrames = 0;
    this.currentFps = 60;
    this.autoSaveTimer = 0;
    this.orbitAngle = 0;

    this.ui = new UIManager(this);
    this.inventory.onChange = () => {
      this.ui.renderHotbar();
    };

    this.applySavedPrefsToUI();
    this.bindInputEvents();

    // Build scenic background panorama immediately + load saved worlds list
    this.initBackgroundWorld();
    this.ui.refreshSavedWorldsList();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  buildTargetHighlightMeshes() {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x111622,
      transparent: true,
      opacity: 0.65,
    });
    this.selectionBox = new THREE.LineSegments(edges, lineMat);
    this.selectionBox.visible = false;
    this.scene.add(this.selectionBox);

    const crackGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    this.crackMat = new THREE.MeshBasicMaterial({
      map: this.textures.crackTextures[0],
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.crackBox = new THREE.Mesh(crackGeo, this.crackMat);
    this.crackBox.visible = false;
    this.scene.add(this.crackBox);
  }

  applySavedPrefsToUI() {
    this.sound.setVolume(this.prefs.volume);
    document.getElementById('rng-render-dist').value = String(this.prefs.renderDistance);
    document.getElementById('lbl-render-dist').textContent = `${this.prefs.renderDistance} chunks`;

    const volPct = Math.round(this.prefs.volume * 100);
    document.getElementById('rng-volume').value = String(volPct);
    document.getElementById('lbl-volume').textContent = `${volPct}%`;

    const sensPct = Math.round(this.prefs.sensitivity * 100);
    document.getElementById('rng-sens').value = String(sensPct);
    document.getElementById('lbl-sens').textContent = `${sensPct}%`;

    document.getElementById('rng-fov').value = String(this.prefs.fov);
    document.getElementById('lbl-fov').textContent = `${this.prefs.fov}°`;
    this.camera.fov = this.prefs.fov;
    this.camera.updateProjectionMatrix();
  }

  initBackgroundWorld() {
    this.teardownWorldSystems();
    this.world = new World(this.scene, this.textures, 'EmeraldVale', Math.min(4, this.prefs.renderDistance));
    this.sky = new SkySystem(this.scene, this.world.shaderUniforms);
    this.particles = new ParticleSystem(this.scene, this.world);
    this.drops = new DropManager(this.scene, this.world, this.textures, this.inventory, this.sound);
    this.mobs = new MobManager(this.scene, this.world, this.drops, this.particles, this.sound);
    this.player = new Player(this.camera, this.world, this.inventory, this.textures, this.sound);
    this.player.viewmodelGroup.visible = false;

    const spawn = this.world.generator.findSpawnPoint();
    this.world.preloadSpawnArea(spawn.x, spawn.z, 2);
    this.player.pos.set(spawn.x, spawn.y + 10, spawn.z);
  }

  teardownWorldSystems() {
    if (this.mobs) {
      this.mobs.clear();
      this.scene.remove(this.mobs.group);
    }
    if (this.drops) {
      this.drops.clear();
      this.scene.remove(this.drops.group);
    }
    if (this.particles) {
      this.scene.remove(this.particles.mesh);
      this.scene.remove(this.particles.fireflies);
    }
    if (this.sky) {
      this.scene.remove(this.sky.skyGroup);
      this.scene.remove(this.sky.cloudMesh);
      this.scene.remove(this.sky.precipPoints);
      this.scene.remove(this.sky.hemiLight);
      this.scene.remove(this.sky.dirLight);
    }
    if (this.player) {
      this.viewmodelCamera.remove(this.player.viewmodelGroup);
    }
    if (this.world) {
      this.world.dispose();
    }
  }

  setupWorldInstance(seed, mode, savedData = null) {
    this.teardownWorldSystems();

    this.world = new World(this.scene, this.textures, seed, this.prefs.renderDistance);
    if (savedData?.edits) {
      this.world.loadSerializedEdits(savedData.edits);
    }

    this.sky = new SkySystem(this.scene, this.world.shaderUniforms);
    if (savedData) {
      this.sky.timeOfDay = savedData.timeOfDay ?? 0.14;
      this.sky.dayNumber = savedData.dayNumber ?? 1;
      this.sky.setWeather(savedData.weather || 'clear');
    }

    this.particles = new ParticleSystem(this.scene, this.world);
    this.drops = new DropManager(this.scene, this.world, this.textures, this.inventory, this.sound);
    this.mobs = new MobManager(this.scene, this.world, this.drops, this.particles, this.sound);

    this.player = new Player(this.camera, this.world, this.inventory, this.textures, this.sound);
    this.player.sensitivity = 0.0022 * this.prefs.sensitivity;
    this.player.baseFov = this.prefs.fov;
    this.player.setMode(mode);
    this.player.viewmodelGroup.visible = true;
    this.viewmodelCamera.add(this.player.viewmodelGroup);

    this.player.onDamage = () => {
      const flash = document.getElementById('damage-flash');
      flash.style.opacity = '1';
      setTimeout(() => { flash.style.opacity = '0'; }, 180);
    };
    this.player.onDeath = () => {
      this.mouseDownLeft = false;
      this.ui.showRespawnModal();
    };

    const spawn = this.world.generator.findSpawnPoint();
    const startX = savedData?.player?.pos?.[0] ?? spawn.x;
    const startZ = savedData?.player?.pos?.[2] ?? spawn.z;

    this.world.preloadSpawnArea(startX, startZ, 2);

    if (savedData?.player) {
      this.player.deserialize(savedData.player);
    } else {
      const groundY = this.world.getSurfaceY(spawn.x, spawn.z);
      this.player.pos.set(spawn.x, groundY + 0.08, spawn.z);
      this.player.fallPeakY = this.player.pos.y;
    }

    if (savedData?.inventory) {
      this.inventory.deserialize(savedData.inventory);
    } else {
      this.inventory.populateStarterKit(mode);
    }

    this.milestones = new Set(savedData?.milestones || []);
    this.mobs.spawnInitialPassiveMobs(this.player.pos);

    this.hasActiveWorld = true;
    this.ui.syncModeButtons(this.player.mode);
    this.ui.renderHotbar();
    this.ui.hideMenusForGameplay();
    this.requestPointerLockSafe();
  }

  async startNewWorld({ name, seed, mode }) {
    this.worldMeta = {
      id: `world_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name,
      seed,
      mode,
    };
    this.setupWorldInstance(seed, mode, null);
    await this.saveCurrentWorld(false);
    this.ui.showToast(`Entered ${name}`);
  }

  async loadSavedWorld(worldId) {
    const saved = await this.saveManager.loadWorld(worldId);
    if (!saved) {
      this.ui.showToast('Could not load saved world');
      return;
    }
    this.worldMeta = {
      id: saved.id,
      name: saved.name,
      seed: saved.seed,
      mode: saved.mode || 'survival',
    };
    this.setupWorldInstance(saved.seed, this.worldMeta.mode, saved);
    this.ui.showToast(`Loaded ${saved.name}`);
  }

  async saveCurrentWorld(showNotification = false) {
    if (!this.hasActiveWorld || !this.worldMeta) return;
    const record = {
      id: this.worldMeta.id,
      name: this.worldMeta.name,
      seed: this.world.seed,
      mode: this.player.mode,
      dayNumber: this.sky.dayNumber,
      timeOfDay: this.sky.timeOfDay,
      weather: this.sky.weather,
      player: this.player.serialize(),
      inventory: this.inventory.serialize(),
      edits: this.world.serializeEdits(),
      milestones: Array.from(this.milestones),
    };
    await this.saveManager.saveWorld(record);
    if (showNotification) {
      this.ui.showToast('World saved');
    }
  }

  resumeGameplay() {
    if (!this.hasActiveWorld) return;
    this.ui.hideMenusForGameplay();
    this.requestPointerLockSafe();
  }

  respawnPlayer() {
    const spawn = this.world.generator.findSpawnPoint();
    this.world.preloadSpawnArea(spawn.x, spawn.z, 2);
    const groundY = this.world.getSurfaceY(spawn.x, spawn.z);
    this.player.respawn({ x: spawn.x, y: groundY + 0.1, z: spawn.z });
    this.requestPointerLockSafe();
  }

  setGameMode(mode) {
    if (!this.player) return;
    this.player.setMode(mode);
    if (this.worldMeta) this.worldMeta.mode = mode;
    this.ui.syncModeButtons(mode);
    this.ui.showToast(mode === 'creative' ? 'Creative Mode (Press F to Fly)' : 'Survival Mode');
  }

  setRenderDistance(chunks) {
    this.prefs.renderDistance = chunks;
    this.saveManager.savePrefs(this.prefs);
    if (this.world && this.hasActiveWorld) {
      this.world.setRenderDistance(chunks);
    }
  }

  setVolume(vol) {
    this.prefs.volume = vol;
    this.sound.setVolume(vol);
    this.saveManager.savePrefs(this.prefs);
  }

  setSensitivity(mult) {
    this.prefs.sensitivity = mult;
    if (this.player) this.player.sensitivity = 0.0022 * mult;
    this.saveManager.savePrefs(this.prefs);
  }

  setFov(fov) {
    this.prefs.fov = fov;
    if (this.player) this.player.baseFov = fov;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.saveManager.savePrefs(this.prefs);
  }

  requestPointerLockSafe() {
    try {
      const p = this.canvas.requestPointerLock?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      // Fallback drag-look still works if pointer lock is blocked
    }
  }

  tossItemStack(item) {
    if (!item || !this.player || !this.drops) return;
    const eye = this.player.getEyePosition();
    const dir = this.player.getLookDirection();
    const vel = dir.clone().multiplyScalar(5.5);
    vel.y += 2.2;
    this.drops.spawnDrop(
      eye.x + dir.x * 0.6,
      eye.y - 0.2,
      eye.z + dir.z * 0.6,
      item.id,
      item.count,
      item.durability,
      1.1,
      vel
    );
  }

  tossActiveSingleItem() {
    const slot = this.inventory.getActiveSlot();
    if (!slot) return;
    const single = { id: slot.id, count: 1, durability: slot.durability };
    this.inventory.consumeActive(1, false);
    this.tossItemStack(single);
  }

  unlockMilestone(key, text) {
    if (this.milestones.has(key)) return;
    this.milestones.add(key);
    this.ui.showToast(`★ ${text}`);
  }

  onItemCrafted(itemId) {
    if (itemId === BLOCK.CRAFTING_TABLE) {
      this.unlockMilestone('workbench', 'Crafted a Workbench — place it to unlock Stone & Iron gear');
    } else if (itemId === ITEM.STONE_PICKAXE) {
      this.unlockMilestone('stone_age', 'Stone Age — Stone Pickaxe forged');
    } else if (itemId === BLOCK.FURNACE) {
      this.unlockMilestone('furnace', 'Built a Stone Furnace — place it to smelt ores & glass');
    } else if (itemId === ITEM.IRON_INGOT) {
      this.unlockMilestone('iron_age', 'Iron Age — Smelted forged Iron Ingot');
    } else if (itemId === ITEM.CRYSTAL_PICKAXE || itemId === ITEM.CRYSTAL_SWORD) {
      this.unlockMilestone('crystal_master', 'Aether Masterwork crafted');
    }
  }

  bindInputEvents() {
    window.addEventListener('resize', () => {
      const aspect = window.innerWidth / window.innerHeight;
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
      this.viewmodelCamera.aspect = aspect;
      this.viewmodelCamera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (!this.pointerLocked) {
        this.mouseDownLeft = false;
        this.mouseDownRight = false;
        if (this.player) {
          Object.keys(this.player.keys).forEach((k) => { this.player.keys[k] = false; });
        }
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.hasActiveWorld || this.ui.isModalOpen()) return;
      this.sound.ensureContext();

      if (!this.pointerLocked) {
        this.requestPointerLockSafe();
        this.draggingLook = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }

      if (e.button === 0) {
        this.mouseDownLeft = true;
        this.handlePrimaryAttackOrStartMine();
      } else if (e.button === 2) {
        this.mouseDownRight = true;
        this.handleSecondaryAction();
        this.rightPlaceCooldown = 0.22;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouseDownLeft = false;
        this.resetMining();
      } else if (e.button === 2) {
        this.mouseDownRight = false;
      }
      this.draggingLook = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.hasActiveWorld || !this.player || this.ui.isModalOpen()) return;
      if (this.pointerLocked) {
        this.player.rotateLook(e.movementX, e.movementY);
      } else if (this.draggingLook) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.player.rotateLook(dx * 1.4, dy * 1.4);
      }
    });

    window.addEventListener('wheel', (e) => {
      if (!this.hasActiveWorld || this.ui.isModalOpen()) return;
      if (Math.abs(e.deltaY) > 0) {
        this.inventory.cycleHotbar(e.deltaY > 0 ? 1 : -1);
      }
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
      // Allow typing normally in New World text inputs
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'Escape') {
        if (!this.ui.invModalEl.classList.contains('hidden')) {
          this.ui.closeInventory(true);
        } else if (this.hasActiveWorld && this.ui.menuOverlayEl.classList.contains('hidden')) {
          this.ui.openPauseMenu();
        } else if (this.hasActiveWorld) {
          this.resumeGameplay();
        }
        return;
      }

      if (!this.hasActiveWorld) return;

      if (e.code === 'KeyE') {
        e.preventDefault();
        if (!this.ui.invModalEl.classList.contains('hidden')) {
          this.ui.closeInventory(true);
        } else if (!this.ui.isModalOpen()) {
          this.ui.openInventory();
        }
        return;
      }

      if (e.code === 'F3') {
        e.preventDefault();
        this.ui.showDebug = !this.ui.showDebug;
        this.ui.debugPanelEl.classList.toggle('hidden', !this.ui.showDebug);
        return;
      }

      if (this.ui.isModalOpen()) return;

      if (e.code.startsWith('Digit')) {
        const num = Number(e.code.slice(5));
        if (num >= 1 && num <= 9) {
          this.inventory.selectHotbar(num - 1);
          return;
        }
      }

      if (e.code === 'KeyF' && !e.repeat) {
        if (this.player.mode === 'creative') {
          const flying = this.player.toggleFlight();
          this.ui.showToast(flying ? 'Flight enabled' : 'Flight disabled');
        }
        return;
      }

      if (e.code === 'KeyQ' && !e.repeat) {
        this.tossActiveSingleItem();
        return;
      }

      this.setKey(e.code, true);
    });

    window.addEventListener('keyup', (e) => {
      if (this.player) this.setKey(e.code, false);
    });

    window.addEventListener('beforeunload', () => {
      this.saveCurrentWorld(false);
    });
  }

  setKey(code, pressed) {
    if (!this.player) return;
    const k = this.player.keys;
    switch (code) {
      case 'KeyW':
      case 'ArrowUp': k.forward = pressed; break;
      case 'KeyS':
      case 'ArrowDown': k.backward = pressed; break;
      case 'KeyA':
      case 'ArrowLeft': k.left = pressed; break;
      case 'KeyD':
      case 'ArrowRight': k.right = pressed; break;
      case 'Space': k.jump = pressed; break;
      case 'ShiftLeft':
      case 'ShiftRight': k.sprint = pressed; break;
      case 'KeyC':
      case 'ControlLeft': k.crouch = pressed; break;
    }
  }

  handlePrimaryAttackOrStartMine() {
    if (!this.player || !this.mobs) return;
    this.player.triggerSwing();

    // Check melee hit on nearby mob first
    const eye = this.player.getEyePosition();
    const dir = this.player.getLookDirection();
    const mobHit = this.mobs.raycastMob(eye, dir, 3.9);

    if (mobHit) {
      const activeDef = this.inventory.getActiveDef();
      const dmg = this.player.mode === 'creative' ? 25 : (activeDef?.attackDamage || 1.5);
      this.mobs.hitMob(mobHit, dmg, this.player.pos);
      const broke = this.inventory.damageActiveTool(1, this.player.mode === 'creative');
      if (broke) this.sound.playToolBreak();
      this.mouseDownLeft = false;
      return;
    }

    this.sound.playSwing();
  }

  handleSecondaryAction() {
    if (!this.player || !this.world) return;
    const eye = this.player.getEyePosition();
    const dir = this.player.getLookDirection();
    const activeSlot = this.inventory.getActiveSlot();
    const activeDef = activeSlot ? getDef(activeSlot.id) : null;

    // 1. Check Empty Bucket scooping water
    if (activeDef && activeDef.scoopsFluid) {
      const fluidHit = this.world.raycast(eye, dir, 5.5, true);
      if (fluidHit.hit && fluidHit.blockId === BLOCK.WATER) {
        this.world.setBlock(fluidHit.x, fluidHit.y, fluidHit.z, BLOCK.AIR, true);
        if (this.player.mode !== 'creative') {
          this.inventory.replaceActive(ITEM.BUCKET_WATER);
        }
        this.particles.emitWaterSplash(fluidHit.x + 0.5, fluidHit.y + 0.8, fluidHit.z + 0.5);
        this.sound.playSplash();
        this.player.triggerSwing();
        return;
      }
    }

    const hit = this.world.raycast(eye, dir, 5.6, false);

    // 2. Check Interactive Station (Crafting Table / Furnace) unless sneaking
    if (hit.hit && hit.def.interactive && !this.player.keys.crouch) {
      if (hit.def.interactive === 'workbench') {
        this.ui.openInventory('tools');
      } else if (hit.def.interactive === 'furnace') {
        this.ui.openInventory('smelting');
      }
      return;
    }

    if (!activeSlot || !activeDef) return;

    // 3. Check Water Bucket placement
    if (activeDef.placesFluid && hit.hit) {
      const { px, py, pz } = hit;
      const existing = this.world.getBlock(px, py, pz);
      if (existing === BLOCK.AIR || getDef(existing).renderType === RENDER_TYPE.CROSS) {
        this.world.setBlock(px, py, pz, activeDef.placesFluid, true);
        if (this.player.mode !== 'creative') {
          this.inventory.replaceActive(ITEM.BUCKET_EMPTY);
        }
        this.particles.emitWaterSplash(px + 0.5, py + 0.5, pz + 0.5);
        this.sound.playSplash();
        this.player.triggerSwing();
        return;
      }
    }

    // 4. Check eating food
    if (activeDef.food > 0) {
      if (this.player.tryEatActiveItem()) return;
    }

    // 5. Place Voxel Block
    if (activeDef.isBlock && hit.hit) {
      // Allow replacing tall grass / water directly if clicking tall grass, else place on adjacent face
      let tx = hit.px;
      let ty = hit.py;
      let tz = hit.pz;
      if (hit.blockId === BLOCK.TALL_GRASS) {
        tx = hit.x; ty = hit.y; tz = hit.z;
      }

      const targetExisting = this.world.getBlock(tx, ty, tz);
      const canReplace =
        targetExisting === BLOCK.AIR ||
        targetExisting === BLOCK.WATER ||
        targetExisting === BLOCK.TALL_GRASS;

      if (!canReplace) return;
      if (activeDef.solid && this.player.intersectsBlock(tx, ty, tz)) return;

      // Require solid ground below cross flora, and floor or adjacent wall support for torches
      if (activeDef.renderType === RENDER_TYPE.CROSS) {
        if (!getDef(this.world.getBlock(tx, ty - 1, tz)).solid) return;
      } else if (activeDef.renderType === RENDER_TYPE.TORCH) {
        const hasSupport =
          getDef(this.world.getBlock(tx, ty - 1, tz)).solid ||
          getDef(this.world.getBlock(tx + 1, ty, tz)).solid ||
          getDef(this.world.getBlock(tx - 1, ty, tz)).solid ||
          getDef(this.world.getBlock(tx, ty, tz + 1)).solid ||
          getDef(this.world.getBlock(tx, ty, tz - 1)).solid;
        if (!hasSupport) return;
      }

      if (this.world.setBlock(tx, ty, tz, activeSlot.id, true)) {
        this.inventory.consumeActive(1, this.player.mode === 'creative');
        this.sound.playBlockPlace(activeDef.sound);
        this.player.triggerSwing();
      }
    }
  }

  resetMining() {
    this.mineTargetKey = '';
    this.mineProgress = 0;
    this.crackBox.visible = false;
  }

  updateMiningAndTarget(dt) {
    if (this.creativeBreakCooldown > 0) {
      this.creativeBreakCooldown = Math.max(0, this.creativeBreakCooldown - dt);
    }
    if (this.rightPlaceCooldown > 0) {
      this.rightPlaceCooldown = Math.max(0, this.rightPlaceCooldown - dt);
    } else if (this.mouseDownRight && !this.ui.isModalOpen()) {
      this.handleSecondaryAction();
      this.rightPlaceCooldown = 0.22;
    }

    const eye = this.player.getEyePosition();
    const dir = this.player.getLookDirection();
    const hit = this.world.raycast(eye, dir, 5.6, false);

    if (!hit.hit) {
      this.selectionBox.visible = false;
      this.resetMining();
      this.ui.updateTargetFeedback(0, '');
      return;
    }

    this.selectionBox.visible = true;
    this.selectionBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);

    let contextText = '';
    if (hit.def.interactive === 'workbench') {
      contextText = 'Right-Click to Open Workbench';
    } else if (hit.def.interactive === 'furnace') {
      contextText = 'Right-Click to Use Furnace';
    }

    const activeDef = this.inventory.getActiveDef();
    const toolTier = (activeDef?.toolType === TOOL_TYPE.PICKAXE) ? activeDef.toolTier : 0;

    if (hit.def.minToolTier > 0 && toolTier < hit.def.minToolTier && this.player.mode === 'survival') {
      const reqNames = ['', 'Wood Pickaxe', 'Stone Pickaxe', 'Iron Pickaxe'];
      contextText = `Requires ${reqNames[hit.def.minToolTier]} to harvest ore`;
    }

    if (!this.mouseDownLeft || this.ui.isModalOpen()) {
      this.resetMining();
      this.ui.updateTargetFeedback(0, contextText);
      return;
    }

    // Unbreakable bedrock (except in Creative)
    if (hit.def.hardness < 0 && this.player.mode !== 'creative') {
      this.resetMining();
      this.ui.updateTargetFeedback(0, 'Bedrock cannot be broken');
      return;
    }

    // Creative instant break with slight hold repeat interval
    if (this.player.mode === 'creative') {
      if (this.creativeBreakCooldown <= 0) {
        this.creativeBreakCooldown = 0.16;
        this.breakTargetedBlock(hit, false);
      }
      this.ui.updateTargetFeedback(0, contextText);
      return;
    }

    const key = `${hit.x},${hit.y},${hit.z}:${hit.blockId}`;
    if (key !== this.mineTargetKey) {
      this.mineTargetKey = key;
      this.mineProgress = 0;
    }

    // Compute mining speed multiplier
    let speedMult = 1.0;
    if (activeDef && activeDef.toolType === hit.def.preferredTool) {
      speedMult = activeDef.miningSpeed;
    }
    if (hit.def.minToolTier > 0 && toolTier < hit.def.minToolTier) {
      speedMult *= 0.32;
    }
    if (!this.player.onGround || this.player.headUnderWater) {
      speedMult *= 0.65;
    }

    const breakDuration = Math.max(0.05, hit.def.hardness / speedMult);
    this.mineProgress += dt / breakDuration;

    // Swing arm & chip particles while mining
    this.player.triggerSwing();
    this.mineChipTimer += dt;
    if (this.mineChipTimer >= 0.2) {
      this.mineChipTimer = 0;
      this.sound.playMineHit(hit.def.sound);
      this.particles.emitMiningChip(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, hit.def.color);
    }

    if (this.mineProgress >= 1.0) {
      const canHarvest = hit.def.minToolTier === 0 || toolTier >= hit.def.minToolTier;
      this.breakTargetedBlock(hit, canHarvest);
      const broke = this.inventory.damageActiveTool(1, false);
      if (broke) {
        this.sound.playToolBreak();
        this.ui.showToast('Your tool wore out!');
      }
      this.resetMining();
      this.ui.updateTargetFeedback(0, contextText);
    } else {
      const stage = Math.min(9, Math.floor(this.mineProgress * 10));
      this.crackMat.map = this.textures.crackTextures[stage];
      this.crackBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      this.crackBox.visible = true;
      this.ui.updateTargetFeedback(this.mineProgress, contextText);
    }
  }

  breakTargetedBlock(hit, spawnDrops = true) {
    const { x, y, z, blockId, def } = hit;
    this.particles.emitBlockBreak(x, y, z, def.color, 20);
    this.sound.playBlockBreak(def.sound);
    this.player.triggerSwing();

    this.world.setBlock(x, y, z, BLOCK.AIR, true, (ax, ay, az, aboveId) => {
      if (this.player.mode === 'survival') {
        this.drops.spawnBlockDrops(ax, ay, az, aboveId);
      }
    });

    if (spawnDrops) {
      this.drops.spawnBlockDrops(x, y, z, blockId);
      if (blockId === BLOCK.OAK_LOG || blockId === BLOCK.BIRCH_LOG || blockId === BLOCK.PINE_LOG) {
        this.unlockMilestone('first_wood', 'Harvested timber — press E to craft planks & tools');
      } else if (blockId === BLOCK.CRYSTAL_ORE) {
        this.unlockMilestone('crystal_ore', 'Unearthed radiant Aether Crystal!');
      }
    }
  }

  animate(now) {
    requestAnimationFrame(this.animate);

    const rawDt = Math.max(0.001, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const dt = Math.min(0.05, rawDt);

    // FPS counter
    this.fpsAccum += rawDt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    if (!this.hasActiveWorld) {
      // Gentle scenic orbit on Title Screen
      this.orbitAngle += dt * 0.11;
      const cx = this.player.pos.x;
      const cz = this.player.pos.z;
      this.camera.position.set(
        cx + Math.cos(this.orbitAngle) * 18,
        this.player.pos.y + 6,
        cz + Math.sin(this.orbitAngle) * 18
      );
      this.camera.lookAt(cx, this.player.pos.y - 4, cz);
      const biome = this.world.generator.getBiomeInfoAt(cx, cz);
      this.world.update(cx, cz, dt, now * 0.001);
      this.sky.update(dt * 0.4, this.player, 4, biome);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const paused = !this.ui.menuOverlayEl.classList.contains('hidden');

    if (!paused) {
      this.player.update(dt);
      this.updateMiningAndTarget(dt);

      // Dynamic handheld torch / glowing item illumination
      const activeDef = this.inventory.getActiveDef();
      const targetHeldPower = activeDef?.light > 0 ? Math.min(1.0, activeDef.light / 15) : 0.0;
      this.heldLightSmooth += (targetHeldPower - this.heldLightSmooth) * Math.min(1, dt * 10);
      this.world.shaderUniforms.uHeldLightPower.value = this.heldLightSmooth;
      if (this.heldLightSmooth > 0.01) {
        this.world.shaderUniforms.uHeldLightPos.value.set(
          this.player.pos.x,
          this.player.pos.y + 1.25,
          this.player.pos.z
        );
      }

      // Sync viewmodel brightness with ambient daylight or held light
      const vmLum = Math.max(0.32, this.sky.sunBrightness, this.heldLightSmooth);
      this.vmHemiLight.intensity = 0.45 + vmLum * 0.55;
      this.vmDirLight.intensity = 0.3 + vmLum * 0.65;

      const biome = this.world.generator.getBiomeInfoAt(this.player.pos.x, this.player.pos.z);
      this.world.update(this.player.pos.x, this.player.pos.z, dt, now * 0.001);
      this.sky.update(dt, this.player, this.world.renderDistance, biome);
      this.drops.update(dt, this.player.pos);
      this.mobs.update(dt, this.player, this.sky.sunBrightness);
      this.particles.update(dt, this.player.pos, this.sky.sunBrightness);
      this.sound.updateAmbience(this.sky.weatherIntensity, this.player.headUnderWater);
      this.ui.updateHUD(dt, this.currentFps);

      // Periodic auto-save every 30s
      this.autoSaveTimer += dt;
      if (this.autoSaveTimer >= 30) {
        this.autoSaveTimer = 0;
        this.saveCurrentWorld(false);
      }
    }

    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.viewmodelScene, this.viewmodelCamera);
  }
}

const game = new TerraCraftGame();
window.__terracraft = game;
