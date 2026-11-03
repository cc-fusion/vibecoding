import * as THREE from 'three';
import { B, RECIPES, getBlock, getItem, isPlaceable, xpLevel } from './blocks.js';
import { World, WORLD_HEIGHT } from './world.js';
import { Player } from './player.js';
import { Inventory } from './inventory.js';
import { EntityManager } from './entities.js';
import { Environment } from './environment.js';
import { ParticleSystem } from './particles.js';
import { AudioManager } from './audio.js';
import { seedFromString } from './noise.js';

const FIXED_STEP = 1 / 60;
const TIER_NAMES = ['', 'Wooden', 'Stone', 'Iron', 'Crystal'];

export class Game {
  constructor(ui, atlas, storage) {
    this.ui = ui;
    this.atlas = atlas;
    this.storage = storage;
    this.settings = storage.loadSettings();
    this.audio = new AudioManager(this.settings.volume);
    this.state = 'menu';
    this.world = null;
    this.meta = null;
    this.xp = 0;
    this.playTime = 0;
    this.stats = this.defaultStats();
    this.keys = {};
    this.mouseDown = false;
    this.mining = { key: '', progress: 0, soundTimer: 0 };
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.uiTimer = 0;
    this.saveTimer = 0;
    this.debugVisible = false;
    this.debugTimer = 0;
    this.fps = 60;
    this.viewSwing = 0;
    this.viewSignature = '';
    this.wasLocked = false;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    document.getElementById('app').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, window.innerWidth / window.innerHeight, 0.05, 700);
    this.scene.add(this.camera);
    this.createSelection();
    this.createViewModel();
    this.bindUI();
    this.bindInput();
    this.ui.applySettings(this.settings);
    this.ui.showMenu();
    requestAnimationFrame((time) => this.loop(time));
  }

  defaultStats() {
    return { blocksMined: 0, blocksPlaced: 0, kills: 0, crafted: {}, collected: {}, guardianDefeated: false, bossActive: false };
  }

  createSelection() {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.012, 1.012, 1.012));
    this.selection = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: '#182021', transparent: true, opacity: 0.85 }));
    this.selection.visible = false;
    this.selection.renderOrder = 4;
    this.scene.add(this.selection);
    this.crackCanvas = document.createElement('canvas');
    this.crackCanvas.width = 16; this.crackCanvas.height = 16;
    this.crackTexture = new THREE.CanvasTexture(this.crackCanvas);
    this.crackTexture.magFilter = THREE.NearestFilter;
    this.crackTexture.minFilter = THREE.NearestFilter;
    this.crackMaterial = new THREE.MeshBasicMaterial({ map: this.crackTexture, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.016, 1.016, 1.016), this.crackMaterial);
    this.crackMesh.visible = false;
    this.crackMesh.renderOrder = 4;
    this.scene.add(this.crackMesh);
    this.crackStage = -1;
  }

  createViewModel() {
    this.viewModel = new THREE.Group();
    this.viewModel.position.set(0.54, -0.5, -0.78);
    this.camera.add(this.viewModel);
    const armMaterial = new THREE.MeshLambertMaterial({ color: '#b9825e' });
    this.arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.48, 0.18), armMaterial);
    this.arm.position.set(0.09, -0.16, 0.1);
    this.arm.rotation.z = -0.2;
    this.viewModel.add(this.arm);
    this.heldGroup = new THREE.Group();
    this.viewModel.add(this.heldGroup);
    this.viewMaterialCache = new Map();
  }

  bindUI() {
    this.ui.setActions({
      createWorld: ({ name, seed, mode }) => {
        this.audio.ensure(); this.audio.play('click');
        const meta = this.storage.create(name, seed, mode);
        if (!meta) this.ui.toast('Could not create the world. Browser storage may be full.', 'error');
        else this.startWorld(meta, {});
      },
      loadWorld: (id) => {
        this.audio.ensure(); this.audio.play('click');
        const saved = this.storage.load(id);
        if (saved) this.startWorld(saved.meta, saved.data);
      },
      deleteWorld: (id) => { this.storage.delete(id); this.ui.renderWorlds(); },
      closeInventory: () => this.closeInventory(),
      moveSlot: (a, b) => { this.inventory?.swapSlots(a, b); this.ui.refreshInventory(); },
      sortInventory: () => { this.inventory?.sortBackpack(); this.ui.refreshInventory(); this.audio.play('click'); },
      craft: (id) => this.craft(id),
      resume: () => this.resume(),
      saveAndMenu: () => this.saveAndMenu(),
      respawn: () => this.respawn(),
      setting: (key, value) => this.changeSetting(key, value),
      sound: (name) => this.audio.play(name),
    });
  }

  bindInput() {
    const canvas = this.renderer.domElement;
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    });
    canvas.addEventListener('click', () => {
      if (this.state === 'playing' && document.pointerLockElement !== canvas) this.lockPointer();
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === canvas) {
        this.wasLocked = true;
        this.player?.clearKeys();
      } else {
        this.mouseDown = false;
        this.player?.clearKeys();
        if (this.state === 'playing' && this.wasLocked) this.pause();
      }
    });
    document.addEventListener('mousemove', (event) => {
      if (this.state === 'playing' && document.pointerLockElement === canvas) this.player?.mouseMove(event.movementX, event.movementY, this.settings.sensitivity);
    });
    document.addEventListener('mousedown', (event) => {
      if (this.state !== 'playing' || document.pointerLockElement !== canvas) return;
      if (event.button === 0) this.mouseDown = true;
      if (event.button === 2) this.useSelectedItem();
    });
    document.addEventListener('mouseup', (event) => {
      if (event.button === 0) {
        this.mouseDown = false;
        this.mining.progress = 0;
        this.mining.key = '';
      }
    });
    document.addEventListener('wheel', (event) => {
      if (this.state !== 'playing' || !this.inventory) return;
      event.preventDefault();
      this.inventory.selected = (this.inventory.selected + (event.deltaY > 0 ? 1 : 8)) % 9;
      this.viewSwing = Math.max(this.viewSwing, 0.25);
    }, { passive: false });
    document.addEventListener('keydown', (event) => {
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code) && this.state === 'playing') event.preventDefault();
      if (event.code === 'F3') {
        event.preventDefault();
        this.debugVisible = !this.debugVisible;
        return;
      }
      if (event.code === 'KeyE' && !event.repeat) {
        if (this.state === 'playing') this.openInventory();
        else if (this.state === 'inventory') this.closeInventory();
        return;
      }
      if (event.code === 'Escape' && !event.repeat) {
        if (this.state === 'inventory') this.closeInventory();
        else if (this.state === 'paused') this.resume();
        else if (this.state === 'playing' && document.pointerLockElement !== canvas) this.pause();
        return;
      }
      if (this.state === 'playing' && /^Digit[1-9]$/.test(event.code)) {
        this.inventory.selected = Number(event.code.slice(5)) - 1;
        this.viewSwing = Math.max(this.viewSwing, 0.25);
      }
      if (this.state === 'playing' && event.code === 'KeyQ' && !event.repeat) this.dropSelected(event.ctrlKey || event.metaKey);
      if (this.state === 'playing') this.player?.setKey(event.code, true);
    });
    document.addEventListener('keyup', (event) => this.player?.setKey(event.code, false));
    window.addEventListener('blur', () => {
      this.player?.clearKeys();
      if (this.state === 'playing' && this.wasLocked) this.pause();
    });
    window.addEventListener('beforeunload', () => this.saveGame());
  }

  lockPointer() {
    try {
      const result = this.renderer.domElement.requestPointerLock();
      if (result?.catch) result.catch(() => this.ui.toast('Click the world once more to capture the mouse.'));
    } catch {
      this.ui.toast('Click the world to enable mouse look.');
    }
  }

  async startWorld(meta, data) {
    this.disposeWorld();
    this.meta = meta;
    this.state = 'loading';
    this.wasLocked = false;
    this.ui.setLoading(0.12, 'Reading the seed');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    this.xp = Number(data.xp) || 0;
    this.playTime = Number(data.playTime) || 0;
    this.stats = { ...this.defaultStats(), ...(data.stats || {}) };
    this.stats.crafted = data.stats?.crafted || {};
    this.stats.collected = data.stats?.collected || {};
    this.world = new World(this.scene, seedFromString(meta.seed), this.atlas, data.edits || {});
    const spawn = this.world.findSpawn();
    this.ui.setLoading(0.3, 'Carving caves and forests');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    this.world.ensureAround(spawn, 1);
    let bestClearance = null;
    for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
      const x = Math.floor(spawn.x) + dx;
      const z = Math.floor(spawn.z) + dz;
      const terrainTop = this.world.terrainHeight(x, z) + 1;
      const actualTop = this.world.highestSolid(x, z, Math.min(WORLD_HEIGHT - 1, terrainTop + 14));
      if (actualTop >= terrainTop - 1 && actualTop <= terrainTop + 1 && !this.world.isWater(x, actualTop, z)) {
        const distance = dx * dx + dz * dz;
        if (!bestClearance || distance < bestClearance.distance) bestClearance = { x, z, y: actualTop, distance };
      }
    }
    if (bestClearance) spawn.set(bestClearance.x + 0.5, bestClearance.y + 0.02, bestClearance.z + 0.5);
    else spawn.y = this.world.highestSolid(spawn.x, spawn.z, Math.min(WORLD_HEIGHT - 1, spawn.y + 13)) + 0.02;
    this.inventory = new Inventory(data.inventory);
    this.particles = new ParticleSystem(this.scene);
    this.player = new Player(this.camera, this.world, data.player, {
      onDamage: () => { this.ui.damageFlash(); this.audio.play('hurt'); this.viewSwing = 0.6; },
      onDeath: (source) => this.onDeath(source),
      onStep: (sound, blockId) => this.audio.play(sound, getBlock(blockId).key),
    });
    this.player.baseFov = this.settings.fov;
    this.player.setSpawn(spawn);
    const wasDead = data.player && Number(data.player.health) <= 0;
    if (!data.player || wasDead) this.player.position.copy(spawn);
    if (wasDead) this.player.hunger = 20;
    let safety = 0;
    while (this.player.collisionsAt().length && safety++ < 12) this.player.position.y += 1;
    this.player.syncCamera(0);
    this.environment = new Environment(this.scene, this.camera, this.world, this.audio, data.environment || {});
    this.environment.onLightning = () => this.ui.lightningFlash();
    this.entities = new EntityManager(this.scene, this.world, this.player, this.inventory, this.particles, this.audio, {
      onKill: (entity) => this.onKill(entity),
      onPickup: (id, count) => this.onPickup(id, count),
      onBossPhase: (phase) => {
        this.ui.announce('The guardian changes', `Phase ${['I', 'II', 'III'][phase - 1]}`, phase === 2 ? 'Ranged bolts and reinforcements awaken.' : 'Its core burns hot. Keep moving.', 3000);
      },
      onBossDefeated: () => this.onBossDefeated(),
    }, meta.mode);
    if (data.boss && this.stats.bossActive) this.entities.spawn('guardian', new THREE.Vector3().fromArray(data.boss.position), data.boss);
    this.ui.setLoading(0.68, 'Lighting the horizon');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    this.world.update(this.player.position, this.settings.renderDistance, 5);
    this.environment.update(0, this.player);
    this.ui.setLoading(1, 'Your sanctuary awaits');
    this.ui.showGame();
    this.state = 'playing';
    this.saveTimer = 0;
    this.accumulator = 0;
    this.mining = { key: '', progress: 0, soundTimer: 0 };
    this.viewSignature = '';
    this.updateViewModel();
    this.lockPointer();
    this.ui.announce(meta.mode === 'peaceful' ? 'Peaceful frontier' : `Day ${this.environment.day}`, meta.name, this.stats.guardianDefeated ? 'The guardian is silent. Build your legacy.' : 'Gather wood before nightfall.', 3200);
    if (this.entities.boss) this.ui.toast('The Ancient Guardian remains in your world.', 'gold');
  }

  disposeWorld() {
    if (!this.world) return;
    this.entities?.dispose();
    this.environment?.dispose();
    this.particles?.dispose(this.scene);
    this.world.dispose();
    this.world = null;
    this.player = null;
    this.entities = null;
    this.environment = null;
    this.particles = null;
    this.selection.visible = false;
    this.crackMesh.visible = false;
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.mouseDown = false;
    this.player?.clearKeys();
    if (document.pointerLockElement) document.exitPointerLock();
    this.ui.openPause();
    this.saveGame();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.ui.closePause();
    this.state = 'playing';
    this.lockPointer();
  }

  openInventory() {
    if (this.state !== 'playing' || this.player.dead) return;
    this.state = 'inventory';
    this.mouseDown = false;
    this.player.clearKeys();
    if (document.pointerLockElement) document.exitPointerLock();
    this.ui.openInventory(this.inventory, this.craftingContext());
  }

  closeInventory() {
    if (this.state !== 'inventory') return;
    this.ui.closeInventory();
    this.state = 'playing';
    this.lockPointer();
  }

  craftingContext() {
    return {
      level: xpLevel(this.xp),
      stations: {
        crafting_table: this.world.hasBlockNear(B.CRAFTING_TABLE, this.player.position, 4),
        furnace: this.world.hasBlockNear(B.FURNACE, this.player.position, 4),
      },
      guardianDefeated: !!this.stats.guardianDefeated,
    };
  }

  craft(recipeId) {
    if (this.state !== 'inventory') return;
    const recipe = RECIPES.find((entry) => entry.id === recipeId);
    if (!recipe) return;
    const context = this.craftingContext();
    if (context.level < (recipe.level || 1) || (recipe.boss && !context.guardianDefeated) || (recipe.station && !context.stations[recipe.station]) || !this.inventory.hasIngredients(recipe.ingredients)) {
      this.audio.play('error');
      return;
    }
    this.inventory.consumeIngredients(recipe.ingredients);
    const leftover = this.inventory.addItem(recipe.out, recipe.count);
    if (leftover) this.entities.spawnDrop(recipe.out, leftover, this.player.position.clone().add(new THREE.Vector3(0, 1, 0)));
    this.stats.crafted[recipe.out] = (this.stats.crafted[recipe.out] || 0) + recipe.count;
    this.recordCollection(recipe.out, recipe.count);
    this.audio.play('craft');
    this.addXP(recipe.category === 'tools' ? 5 : 2);
    this.ui.toast(`${getItem(recipe.out).name} crafted`, recipe.out === 'guardian_idol' ? 'gold' : '');
    this.ui.craftingContext = this.craftingContext();
    this.ui.refreshInventory();
  }

  changeSetting(key, value) {
    this.settings[key] = value;
    if (key === 'renderDistance' && this.world) this.world.lastCenter = '';
    if (key === 'fov' && this.player) {
      this.player.baseFov = value;
      this.camera.fov = value;
      this.camera.updateProjectionMatrix();
    }
    if (key === 'volume') this.audio.setVolume(value);
    this.storage.saveSettings(this.settings);
  }

  miningDuration(def, item) {
    if (!Number.isFinite(def.hardness)) return Infinity;
    const correct = item && item.tool === def.tool;
    const speed = correct ? item.speed || 1 : 1;
    return Math.max(0.06, def.hardness / speed * (!correct && def.tool ? 1.25 : 1));
  }

  targetDetail(def, item) {
    if (!Number.isFinite(def.hardness)) return 'Unbreakable';
    const tier = item && item.tool === def.tool ? item.tier || 0 : 0;
    if (def.tier > tier) return `Requires ${TIER_NAMES[def.tier] || 'Stronger'} ${def.tool || 'tool'} for drops`;
    if (item) return item.name;
    return def.hardness <= 0.3 ? 'Breaks instantly' : 'Using hand';
  }

  updateInteraction(dt) {
    const origin = this.player.eyePosition(new THREE.Vector3());
    const direction = this.player.lookDirection(new THREE.Vector3());
    const blockHit = this.world.raycast(origin, direction, 5);
    const entityHit = this.entities.raycast(origin, direction, 4);
    const combat = entityHit && (!blockHit || entityHit.distance < blockHit.distance);
    this.currentBlockHit = blockHit;
    this.currentEntityHit = combat ? entityHit : null;
    this.ui.setCombatTarget(!!combat);
    if (combat) {
      this.selection.visible = false;
      this.crackMesh.visible = false;
      this.ui.updateEntityTarget(entityHit.entity);
      this.mining.progress = 0;
      this.mining.key = '';
      if (this.mouseDown && this.player.attackCooldown <= 0) this.attack(entityHit.entity, direction);
      return;
    }
    if (!blockHit) {
      this.selection.visible = false;
      this.crackMesh.visible = false;
      this.ui.updateTarget(null);
      this.mining.progress = 0;
      this.mining.key = '';
      return;
    }
    this.selection.visible = true;
    this.selection.position.set(blockHit.x + 0.5, blockHit.y + 0.5, blockHit.z + 0.5);
    const def = getBlock(blockHit.id);
    const item = this.inventory.selectedItem();
    this.ui.updateTarget(blockHit, this.mining.progress, this.targetDetail(def, item));
    if (!this.mouseDown || !Number.isFinite(def.hardness)) {
      this.crackMesh.visible = false;
      if (!this.mouseDown || !Number.isFinite(def.hardness)) { this.mining.progress = 0; this.mining.key = ''; }
      return;
    }
    const key = `${blockHit.x},${blockHit.y},${blockHit.z}`;
    if (this.mining.key !== key) {
      this.mining.key = key;
      this.mining.progress = 0;
      this.mining.soundTimer = 0;
    }
    const duration = this.miningDuration(def, item);
    this.mining.progress += dt / duration;
    this.mining.soundTimer -= dt;
    if (this.mining.soundTimer <= 0) {
      this.mining.soundTimer = 0.24;
      this.audio.play('mine', def.key);
      this.viewSwing = Math.max(this.viewSwing, 0.7);
    }
    this.crackMesh.visible = true;
    this.crackMesh.position.copy(this.selection.position);
    this.updateCracks(this.mining.progress);
    if (this.mining.progress >= 1) {
      this.breakBlock(blockHit);
      this.mining.progress = 0;
      this.mining.key = '';
      this.crackMesh.visible = false;
    }
  }

  updateCracks(progress) {
    const stage = Math.min(7, Math.floor(progress * 8));
    if (stage === this.crackStage) return;
    this.crackStage = stage;
    const ctx = this.crackCanvas.getContext('2d');
    ctx.clearRect(0, 0, 16, 16);
    ctx.strokeStyle = 'rgba(22,25,24,.9)';
    ctx.lineWidth = 1;
    const branches = 2 + stage;
    for (let i = 0; i < branches; i++) {
      const angle = (i / branches) * Math.PI * 2 + i * 1.7;
      ctx.beginPath(); ctx.moveTo(8, 8);
      let x = 8; let y = 8;
      for (let j = 0; j < 2 + Math.floor(stage / 2); j++) {
        x += Math.cos(angle + j * 0.35) * (2 + (i % 2));
        y += Math.sin(angle + j * 0.35) * (2 + ((i + 1) % 2));
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    this.crackTexture.needsUpdate = true;
  }

  breakBlock(hit) {
    const def = getBlock(hit.id);
    const item = this.inventory.selectedItem();
    const correctTool = item && item.tool === def.tool;
    const tier = correctTool ? item.tier || 0 : 0;
    const canHarvest = def.tier <= tier;
    if (!this.world.setBlock(hit.x, hit.y, hit.z, B.AIR)) return;
    this.stats.blocksMined++;
    this.particles.block(hit, hit.id);
    this.audio.play('break', def.tool === 'pickaxe' ? 'stone' : def.key);
    this.viewSwing = 1;
    if (canHarvest && Math.random() <= def.dropChance) {
      this.entities.spawnDrop(def.drop, 1, new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5));
      if ([B.OAK_LEAVES, B.PINE_LEAVES, B.JUNGLE_LEAVES].includes(hit.id) && Math.random() < 0.09) this.entities.spawnDrop('apple', 1, new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5));
    }
    if (canHarvest) this.addXP(def.xp || (def.tool === 'pickaxe' ? 1 : 0));
    if (item?.durability && def.hardness > 0.1) {
      const broken = this.inventory.damageSelected(1);
      if (broken) this.ui.toast(`${broken} broke`, 'error');
    }
    const above = this.world.getBlock(hit.x, hit.y + 1, hit.z);
    const aboveDef = getBlock(above);
    if (aboveDef.shape === 'cross') {
      this.world.setBlock(hit.x, hit.y + 1, hit.z, B.AIR);
      if (aboveDef.drop && Math.random() <= aboveDef.dropChance) this.entities.spawnDrop(aboveDef.drop, 1, new THREE.Vector3(hit.x + 0.5, hit.y + 1.5, hit.z + 0.5));
    }
    this.world.rebuildDirtyAround(hit.x, hit.z);
  }

  attack(entity, direction) {
    const item = this.inventory.selectedItem();
    const damage = item?.attack || 1;
    this.player.attackCooldown = item?.tool === 'sword' ? 0.38 : 0.55;
    this.viewSwing = 1;
    this.audio.play('swing');
    const knockback = direction.clone().setY(0).normalize();
    this.entities.damageEntity(entity, damage, knockback);
    if (item?.durability) {
      const broken = this.inventory.damageSelected(1);
      if (broken) this.ui.toast(`${broken} broke`, 'error');
    }
  }

  dropSelected(fullStack = false) {
    const slot = this.inventory?.selectedSlot();
    if (!slot) return;
    const count = fullStack ? slot.count : 1;
    const direction = this.player.lookDirection(new THREE.Vector3());
    const position = this.player.eyePosition(new THREE.Vector3()).addScaledVector(direction, 0.7);
    const velocity = direction.multiplyScalar(4.5).add(new THREE.Vector3(0, 1.8, 0));
    this.entities.spawnDrop(slot.id, count, position, velocity);
    this.inventory.removeSelected(count);
    this.audio.play('swing');
    this.viewSwing = 0.6;
  }

  useSelectedItem() {
    if (!this.inventory || this.player.dead) return;
    const hit = this.world.raycast(this.player.eyePosition(new THREE.Vector3()), this.player.lookDirection(new THREE.Vector3()), 5);
    if (hit && [B.CRAFTING_TABLE, B.FURNACE].includes(hit.id) && !this.player.keys.ShiftLeft) {
      this.openInventory();
      return;
    }
    const slot = this.inventory.selectedSlot();
    const item = this.inventory.selectedItem();
    if (!slot || !item) return;
    if (item.use === 'summon') {
      if (this.entities.boss) { this.ui.toast('The Ancient Guardian has already awakened.', 'error'); return; }
      this.inventory.removeSelected();
      this.entities.summonGuardian();
      this.stats.bossActive = true;
      this.ui.announce('An ancient seal breaks', 'Ancient Guardian', 'Watch the ground. Its attacks are telegraphed.', 4200);
      this.audio.play('boss');
      return;
    }
    if (item.food || item.heal) {
      if (this.player.consume(item)) {
        this.inventory.removeSelected();
        this.audio.play('eat');
        this.viewSwing = 0.7;
      } else this.ui.toast('You are not hungry right now.');
      return;
    }
    if (!isPlaceable(slot.id) || !hit) return;
    const x = hit.x + hit.normal.x; const y = hit.y + hit.normal.y; const z = hit.z + hit.normal.z;
    const existing = this.world.getBlock(x, y, z);
    if (existing !== B.AIR && existing !== B.WATER && getBlock(existing).shape !== 'cross') return;
    const def = getBlock(item.block);
    if (def.solid && this.player.intersectsBlock(x, y, z)) { this.ui.toast('Cannot place a block inside yourself.', 'error'); return; }
    if (def.solid && this.entities.entities.some((entity) => {
      const r = entity.width / 2;
      return entity.position.x + r > x && entity.position.x - r < x + 1 && entity.position.y + entity.height > y && entity.position.y < y + 1 && entity.position.z + r > z && entity.position.z - r < z + 1;
    })) return;
    if (this.world.setBlock(x, y, z, item.block)) {
      this.inventory.removeSelected();
      this.stats.blocksPlaced++;
      this.world.rebuildDirtyAround(x, z);
      this.audio.play('place');
      this.viewSwing = 0.65;
    }
  }

  onPickup(id, count) {
    this.recordCollection(id, count);
    if (id === 'crystal' || id === 'guardian_core') this.ui.toast(`${getItem(id).name} collected`, 'gold');
  }

  recordCollection(id, count) {
    this.stats.collected[id] = (this.stats.collected[id] || 0) + count;
  }

  onKill(entity) {
    this.stats.kills++;
    this.addXP(entity.xp);
    if (!entity.boss) this.ui.toast(`${entity.name} defeated · +${entity.xp} XP`);
  }

  onBossDefeated() {
    this.stats.guardianDefeated = true;
    this.stats.bossActive = false;
    this.player.heal(10);
    this.audio.play('level');
    this.ui.announce('The sanctuary endures', 'Guardian Defeated', 'The Guardian Edge recipe is now unlocked.', 5200);
    this.saveGame();
  }

  addXP(amount) {
    if (!amount) return;
    const oldLevel = xpLevel(this.xp);
    this.xp += amount;
    const newLevel = xpLevel(this.xp);
    if (newLevel > oldLevel) {
      this.audio.play('level');
      this.player.heal(2);
      this.ui.announce('Journey milestone', `Level ${newLevel}`, newLevel === 3 ? 'Crystal tools are now available.' : newLevel === 4 ? 'The Guardian Idol can now be crafted.' : 'Your crafting knowledge has grown.', 3200);
    }
  }

  objective() {
    const logs = (this.stats.collected.oak_log || 0) + (this.stats.collected.pine_log || 0);
    if (logs < 3) return { title: 'Gather wood', detail: `Logs collected ${logs}/3 · Hold LMB on a tree` };
    if (!this.stats.crafted.crafting_table) return { title: 'Make a workshop', detail: 'Craft planks, then a crafting table' };
    if (!this.stats.crafted.stone_pickaxe) return { title: 'Enter the stone age', detail: 'Mine stone and craft a stone pickaxe' };
    if (!this.stats.collected.iron_ingot) return { title: 'Smelt iron', detail: 'Build a furnace · Smelt raw iron with coal' };
    if (!this.stats.collected.crystal) return { title: 'Seek sky crystal', detail: 'Rare crystal ore sleeps below Y=17' };
    if (this.stats.guardianDefeated) return { title: 'Build your legacy', detail: `${this.stats.blocksPlaced} blocks placed · The frontier is yours` };
    if (this.stats.bossActive) return { title: 'Defeat the Guardian', detail: 'Read its attack rings and watch the core' };
    if (xpLevel(this.xp) < 4) return { title: 'Grow stronger', detail: `Reach level 4 · Currently level ${xpLevel(this.xp)}` };
    return { title: 'Awaken the Guardian', detail: 'Craft a Guardian Idol at a crafting table' };
  }

  onDeath(source) {
    this.state = 'dead';
    this.mouseDown = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.play('death');
    this.ui.showDeath(source);
    this.saveGame();
  }

  respawn() {
    if (this.state !== 'dead') return;
    this.player.respawn();
    this.ui.hideDeath();
    this.state = 'playing';
    this.lockPointer();
  }

  saveGame() {
    if (!this.world || !this.meta || !this.player) return { ok: false };
    const data = {
      version: 1,
      edits: this.world.serializeEdits(),
      inventory: this.inventory.serialize(),
      player: this.player.serialize(),
      environment: this.environment.serialize(),
      xp: this.xp,
      level: xpLevel(this.xp),
      playTime: this.playTime,
      stats: this.stats,
      boss: this.entities.serializeBoss(),
    };
    return this.storage.save(this.meta.id, data);
  }

  saveAndMenu() {
    const result = this.saveGame();
    if (!result.ok) {
      this.ui.toast(`Save failed${result.error ? `: ${result.error}` : ''}. Your world is still open.`, 'error');
      return;
    }
    this.state = 'menu';
    if (document.pointerLockElement) document.exitPointerLock();
    this.ui.closePause();
    this.disposeWorld();
    this.ui.showMenu();
  }

  updateViewModel() {
    if (!this.inventory) return;
    const slot = this.inventory.selectedSlot();
    const signature = slot ? slot.id : 'hand';
    if (signature === this.viewSignature) return;
    this.viewSignature = signature;
    const cachedMaterials = new Set(this.viewMaterialCache.values());
    while (this.heldGroup.children.length) {
      const child = this.heldGroup.children[0];
      this.heldGroup.remove(child);
      child.geometry?.dispose();
      if (child.material && !cachedMaterials.has(child.material)) child.material.dispose();
    }
    if (!slot) return;
    const item = getItem(slot.id);
    if (item.block) {
      const def = getBlock(item.block);
      let material = this.viewMaterialCache.get(slot.id);
      if (!material) {
        const tile = this.atlas.tileCanvases[def.tiles.side || def.tiles.top];
        const texture = new THREE.CanvasTexture(tile);
        texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.colorSpace = THREE.SRGBColorSpace;
        material = new THREE.MeshLambertMaterial({ map: texture, transparent: !def.opaque, alphaTest: def.category.includes('cutout') ? 0.35 : 0 });
        this.viewMaterialCache.set(slot.id, material);
      }
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), material);
      mesh.position.set(-0.03, 0.13, -0.03);
      mesh.rotation.set(0.2, 0.5, 0.1);
      this.heldGroup.add(mesh);
    } else if (item.tool) {
      const colors = { wood: '#a87342', stone: '#858a8c', iron: '#d4d9d5', crystal: '#65e4dc', guardian: '#e5c15e' };
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), new THREE.MeshLambertMaterial({ color: '#785033' }));
      handle.position.y = 0.1; handle.rotation.z = -0.25;
      this.heldGroup.add(handle);
      const head = new THREE.Mesh(new THREE.BoxGeometry(item.tool === 'sword' ? 0.09 : 0.38, item.tool === 'sword' ? 0.55 : 0.12, 0.08), new THREE.MeshLambertMaterial({ color: colors[item.material] || '#aaa' }));
      head.position.set(item.tool === 'sword' ? 0.1 : -0.04, item.tool === 'sword' ? 0.55 : 0.35, 0);
      if (item.tool === 'sword') head.rotation.z = -0.25;
      this.heldGroup.add(head);
    } else {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshLambertMaterial({ color: '#a9b78a' }));
      mesh.position.y = 0.15;
      this.heldGroup.add(mesh);
    }
  }

  animateViewModel(dt) {
    this.viewSwing = Math.max(0, this.viewSwing - dt * 3.7);
    const swing = Math.sin(this.viewSwing * Math.PI) * 0.75;
    const moving = this.player && Math.hypot(this.player.velocity.x, this.player.velocity.z) > 0.3 && this.player.onGround;
    const bob = moving ? Math.sin(this.player.bobTime * 3.1) * 0.018 : 0;
    this.viewModel.rotation.x = -swing * 0.7;
    this.viewModel.rotation.y = swing * 0.3;
    this.viewModel.position.y = -0.5 + bob - swing * 0.08;
  }

  loop(now) {
    requestAnimationFrame((time) => this.loop(time));
    const dt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.fps += ((dt > 0 ? 1 / dt : 60) - this.fps) * 0.06;
    if (this.world && this.player) {
      const active = this.state === 'playing' && document.pointerLockElement === this.renderer.domElement && !this.player.dead;
      if (active) {
        this.accumulator = Math.min(this.accumulator + dt, FIXED_STEP * 5);
        while (this.accumulator >= FIXED_STEP) {
          this.player.update(FIXED_STEP);
          this.environment.update(FIXED_STEP, this.player);
          this.entities.update(FIXED_STEP, this.environment);
          this.particles.update(FIXED_STEP);
          this.accumulator -= FIXED_STEP;
        }
        this.world.update(this.player.position, this.settings.renderDistance, 1);
        this.updateInteraction(dt);
        this.playTime += dt;
        this.saveTimer += dt;
        if (this.saveTimer >= 25) { this.saveTimer = 0; this.saveGame(); }
      } else {
        this.selection.visible = false;
        this.crackMesh.visible = false;
      }
      this.world.animate(now / 1000);
      this.updateViewModel();
      this.animateViewModel(dt);
      this.audio.update(dt, { rain: this.environment.rain, underwater: this.player.underwater, night: this.environment.isNight, active });
      this.uiTimer -= dt;
      if (this.uiTimer <= 0) {
        this.uiTimer = 0.12;
        this.ui.updateHUD({ player: this.player, inventory: this.inventory, environment: this.environment, world: this.world, xp: this.xp, objective: this.objective(), boss: this.entities.boss });
      }
      this.debugTimer -= dt;
      if (this.debugVisible && this.debugTimer <= 0) {
        this.debugTimer = 0.25;
        const p = this.player.position;
        this.ui.updateDebug(`Voxel Sanctuary · ${this.fps.toFixed(0)} FPS\nXYZ  ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}\nChunk  ${Math.floor(p.x / 16)}, ${Math.floor(p.z / 16)}\nLoaded chunks  ${this.world.chunks.size}\nCreatures  ${this.entities.entities.length} · Drops ${this.entities.drops.length}\nSeed  ${this.meta.seed}`, true);
      } else if (!this.debugVisible) this.ui.updateDebug('', false);
      this.renderer.render(this.scene, this.camera);
    }
  }
}
