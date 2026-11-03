// Voxelheim orchestrator: renderer, world streaming, input, interactions, loop.
import * as THREE from 'three';
import { World, CHUNK, HEIGHT, SEA, chunkKey, BIOME_NAMES, BIOME } from './world.js';
import { buildChunkMesh } from './mesher.js';
import { makeAtlasTexture, makeCrackTextures, makeBlockGeometry, makeIconTexture } from './textures.js';
import { B, I, BLOCKS, defOf, nameOf, isBlock, breakable } from './blocks.js';
import { Player } from './player.js';
import { Inventory } from './inventory.js';
import { EntityManager } from './entities.js';
import { Sky } from './sky.js';
import { Particles } from './particles.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { raycastBlocks, boxIntersectsBlock } from './physics.js';
import { doCraft, FUELS, SMELT_TIME } from './crafting.js';
import { loadSave, writeSave, clearSave, loadSettings, writeSettings, ACHIEVEMENTS } from './save.js';
import { hashString } from './noise.js';

const DEFAULT_SETTINGS = { renderDist: 5, fov: 75, sens: 100, volume: 80, music: true, shadows: true };

export class Game {
  constructor(container) {
    this.container = container;
    this.settings = { ...DEFAULT_SETTINGS, ...loadSettings() };
    this.state = 'boot';
    this.sessionActive = false;
    this.achievements = new Set();
    this.stats = { mined: 0, placed: 0, kills: 0 };
    this.keys = {};
    this.mouse = { l: false, r: false };
    this.mining = { target: null, progress: 0, soundTimer: 0 };
    this.attackCd = 0;
    this.placeCd = 0;
    this.lastSpace = 0;
    this.smeltState = { fuel: 0, current: null, progress: 0 };
    this.furnaceSession = false;
    this.furnaceNear = false;
    this.furnaceScan = 0;
    this.autosaveTimer = 25;
    this.waitingEnter = false;
    this.debugOn = false;
    this.fps = 60;
    this.envTimer = 0;
    this.statTimer = 0;
    this.smeltUiTimer = 0;

    this.initRenderer();
    this.audio = new AudioEngine();
    this.audio.setVolume(this.settings.volume / 100);
    this.audio.musicOn = this.settings.music;

    this.ui = new UI(container, this.uiCallbacks());
    this.ui.game = this;

    this.initMaterials();
    this.sky = new Sky(this.scene, { shadows: this.settings.shadows });
    this.particles = new Particles(this.scene);
    this.initHelpers();

    this.bindInput();

    // panorama world behind title screen
    const save = loadSave();
    this.ui.setContinueVisible(!!save);
    this.bootPanorama(save ? save.seed : 1337);
    this.ui.screen('title');

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
    window.addEventListener('beforeunload', () => { if (this.sessionActive) this.save(); });
  }

  // ---------------- setup ----------------
  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = this.settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.id = 'vh-canvas';
    this.container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, window.innerWidth / window.innerHeight, 0.08, 700);
    this.scene.add(this.camera);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initMaterials() {
    const atlas = makeAtlasTexture();
    this.solidMat = new THREE.MeshLambertMaterial({
      map: atlas, vertexColors: true, alphaTest: 0.15, transparent: true,
    });
    this.waterMat = new THREE.MeshLambertMaterial({
      map: atlas, vertexColors: true, transparent: true, opacity: 0.72,
      depthWrite: false, side: THREE.DoubleSide,
    });
    this.crackTexs = makeCrackTextures();
  }

  initHelpers() {
    // block highlight
    const hlGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
    this.highlight = new THREE.LineSegments(hlGeo, new THREE.LineBasicMaterial({ color: 0x0b0b0b, transparent: true, opacity: 0.65 }));
    this.highlight.visible = false;
    this.scene.add(this.highlight);
    // crack overlay
    this.crack = new THREE.Mesh(
      new THREE.BoxGeometry(1.002, 1.002, 1.002),
      new THREE.MeshBasicMaterial({ map: this.crackTexs[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
    );
    this.crack.visible = false;
    this.scene.add(this.crack);
    // held item viewmodel
    this.handGroup = new THREE.Group();
    this.camera.add(this.handGroup);
    this.handGroup.position.set(0.52, -0.48, -0.85);
    this.handMesh = null;
    this.swing = 0;
    this.iconTexCache = new Map();
    this.handGeoCache = new Map();
  }

  uiCallbacks() {
    return {
      clickSound: () => { this.audio.init(); this.audio.uiClick(); },
      hasSave: () => !!loadSave(),
      inGame: () => this.sessionActive,
      onContinue: () => { const s = loadSave(); if (s) this.startWorld(s.seed, s.mode, s); },
      onNewWorld: (seedStr, mode) => {
        const seed = seedStr ? (/^\d+$/.test(seedStr) ? Number(seedStr) >>> 0 : hashString(seedStr)) : (Math.random() * 0xffffffff) >>> 0;
        clearSave();
        this.startWorld(seed, mode, null);
      },
      onResume: () => this.resume(),
      onQuit: () => this.quitToTitle(),
      onRespawn: () => this.respawn(),
      onCloseInventory: () => this.closeInventory(),
      onCraft: (recipe) => this.craft(recipe),
      onSmelt: (recipe) => this.startSmelt(recipe),
      onSelectSlot: (i) => { this.inv.selected = i; this.inv.changed(); this.ui.showItemName(this.inv.held ? nameOf(this.inv.held.id) : ''); },
      onSetting: (key, v) => this.applySetting(key, v),
      getSettings: () => this.settings,
      getAchievements: () => this.achievements,
      onDropStack: (s) => this.entities?.dropItem(s.id, s.n, this.player.pos.x, this.player.pos.y + 1.2, this.player.pos.z, 1.2, s.dur),
    };
  }

  applySetting(key, v) {
    this.settings[key] = v;
    writeSettings(this.settings);
    if (key === 'volume') this.audio.setVolume(v / 100);
    if (key === 'music') this.audio.musicOn = v;
    if (key === 'fov') { this.camera.fov = v; this.camera.updateProjectionMatrix(); }
    if (key === 'shadows') {
      this.renderer.shadowMap.enabled = v;
      this.sky.sun.castShadow = v;
      this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    }
  }

  // ---------------- world lifecycle ----------------
  disposeWorld() {
    if (!this.world) return;
    for (const c of this.world.chunks.values()) this.disposeChunkMeshes(c);
    this.world.chunks.clear();
    if (this.entities) {
      for (const m of this.entities.mobs) this.scene.remove(m.group);
      for (const it of this.entities.items) this.scene.remove(it.mesh);
      this.entities.mobs = [];
      this.entities.items = [];
    }
    if (this.particles) this.particles.list = [];
  }

  disposeChunkMeshes(c) {
    if (c.mesh) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; }
    if (c.water) { this.scene.remove(c.water); c.water.geometry.dispose(); c.water = null; }
    c.lights = [];
  }

  bootPanorama(seed) {
    this.disposeWorld();
    this.world = new World(seed);
    this.panoramaSpawn = this.world.findSpawn();
    this.panoramaAngle = 0;
    this.entities = new EntityManager(this.scene, this.world, this.solidMat, this.entityHooks());
    this.state = 'title';
  }

  startWorld(seed, mode, save) {
    this.disposeWorld();
    this.world = new World(seed);
    if (save) {
      this.world.loadMods(save.mods);
      this.achievements = new Set(save.ach || []);
      this.stats = save.stats || { mined: 0, placed: 0, kills: 0 };
    } else {
      this.achievements = new Set();
      this.stats = { mined: 0, placed: 0, kills: 0 };
    }
    const spawn = save?.player?.spawn || this.world.findSpawn();
    this.player = new Player(this.world, spawn, mode);
    this.inv = new Inventory();
    this.inv.onChange = () => this.onInventoryChanged();
    if (save) {
      this.player.deserialize(save.player);
      this.inv.deserialize(save.inv);
      this.sky.deserialize(save.sky);
      this.smeltState = save.smelt || { fuel: 0, current: null, progress: 0 };
    } else {
      this.sky.deserialize({ time: 0.06, day: 1, weather: 'clear', weatherTimer: 150 });
      this.smeltState = { fuel: 0, current: null, progress: 0 };
      if (mode === 'creative') this.giveCreativeKit();
    }
    this.entities = new EntityManager(this.scene, this.world, this.solidMat, this.entityHooks());
    this.sessionActive = true;
    this.furnaceSession = false;
    this.seed = seed;
    this.mode = mode;

    // initial synchronous-ish load with progress
    this.state = 'loading';
    this.waitingEnter = false;
    this.ui.screen('loading');
    this.ui.setLoading(0, 'Shaping the land…');
    this.loadCenter = {
      cx: Math.floor(this.player.pos.x / CHUNK),
      cz: Math.floor(this.player.pos.z / CHUNK),
    };
    this.loadTargets = this.computeLoadTargets(this.loadCenter.cx, this.loadCenter.cz, 3, 2);
    const screenEl = this.ui.$('vh-screen-loading');
    this._enterHandler = () => {
      if (!this.waitingEnter) return;
      screenEl.removeEventListener('click', this._enterHandler);
      this.enterGame();
    };
    screenEl.addEventListener('click', this._enterHandler);
  }

  giveCreativeKit() {
    const kit = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.GLASS, B.TORCH, B.WOOL];
    kit.forEach((id, i) => { this.inv.slots[i] = { id, n: 64 }; });
    this.inv.slots[9] = { id: I.D_PICK, n: 1, dur: 1200 };
  }

  computeLoadTargets(cx, cz, dataR, meshR) {
    const data = [], mesh = [];
    for (let dz = -dataR; dz <= dataR; dz++)
      for (let dx = -dataR; dx <= dataR; dx++)
        data.push([cx + dx, cz + dz]);
    for (let dz = -meshR; dz <= meshR; dz++)
      for (let dx = -meshR; dx <= meshR; dx++)
        mesh.push([cx + dx, cz + dz]);
    return { data, mesh };
  }

  processInitialLoad() {
    const deadline = performance.now() + 24;
    const { data, mesh } = this.loadTargets;
    for (const [cx, cz] of data) {
      if (performance.now() > deadline) return;
      this.world.getChunk(cx, cz, true);
    }
    let done = 0;
    for (const [cx, cz] of mesh) {
      const c = this.world.chunks.get(chunkKey(cx, cz));
      if (c && !c.dirty) { done++; continue; }
      if (performance.now() > deadline) break;
      this.meshChunk(cx, cz);
      done++;
    }
    this.ui.setLoading(done / mesh.length, done / mesh.length > 0.6 ? 'Planting trees…' : 'Shaping the land…');
    if (done >= mesh.length) {
      this.waitingEnter = true;
      this.ui.setLoading(1, 'Click to enter world');
      this.ui.$('vh-screen-loading').classList.add('vh-clickable');
    }
  }

  enterGame() {
    this.ui.$('vh-screen-loading').classList.remove('vh-clickable');
    this.state = 'playing';
    this.ui.screen(null);
    this.ui.buildHotbar(this.inv);
    this.updateHandMesh();
    this.ui.hintFade();
    this.audio.init();
    this.requestLock();
    this.save();
  }

  requestLock() {
    const p = this.renderer.domElement.requestPointerLock?.();
    if (p && p.catch) p.catch(() => { /* user can click canvas */ });
  }

  entityHooks() {
    return {
      audio: this.audio,
      particles: this.particles,
      player: this.player,
      inv: this.inv,
      playerHooks: this.playerHooks(),
      mobKilled: (kind) => {
        this.stats.kills++;
        if (kind === 'zombie') this.unlock('zombie');
      },
      pickup: (id, n) => {
        if (id === B.LOG) this.unlock('wood');
        if (id === I.DIAMOND) this.unlock('diamond');
      },
    };
  }

  playerHooks() {
    return {
      step: (block) => this.audio.step(block),
      jump: () => {},
      land: (hard) => { if (hard) this.audio.hurt(); },
      splash: () => { this.audio.splash(); this.particles.splashAt(this.player.pos.x, this.player.pos.y + 0.4, this.player.pos.z); },
      hurt: (amount, cause) => {
        this.audio.hurt();
        this.ui.flashDamage();
      },
      died: (cause) => this.onDeath(cause),
    };
  }

  // ---------------- input ----------------
  bindInput() {
    const canvas = this.renderer.domElement;
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      if (!locked && this.state === 'playing') this.pause();
    });
    canvas.addEventListener('click', () => {
      if (this.state === 'playing' && document.pointerLockElement !== canvas) this.requestLock();
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas || this.state !== 'playing') return;
      const s = 0.0022 * (this.settings.sens / 100);
      this.player.yaw -= e.movementX * s;
      this.player.pitch -= e.movementY * s;
      this.player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.player.pitch));
    });
    document.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing' || document.pointerLockElement !== canvas) return;
      if (e.button === 0) { this.mouse.l = true; this.tryAttack(); }
      if (e.button === 2) { this.mouse.r = true; this.useAction(); }
      if (e.button === 1) { e.preventDefault(); this.pickBlock(); }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) { this.mouse.l = false; this.resetMining(); }
      if (e.button === 2) this.mouse.r = false;
    });
    document.addEventListener('contextmenu', (e) => {
      if (this.state === 'playing' || this.state === 'inv') e.preventDefault();
    });
    document.addEventListener('wheel', (e) => {
      if (this.state !== 'playing') return;
      const dir = Math.sign(e.deltaY);
      this.inv.selected = (this.inv.selected + dir + 9) % 9;
      this.inv.changed();
      this.ui.showItemName(this.inv.held ? nameOf(this.inv.held.id) : '');
    }, { passive: true });

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const code = e.code;
      this.keys[code] = true;
      if (code === 'F3') { e.preventDefault(); this.debugOn = !this.debugOn; if (!this.debugOn) this.ui.setDebug(null); }
      if (this.state === 'playing') {
        if (code === 'KeyE') { e.preventDefault(); this.openInventory('craft'); }
        if (code === 'KeyQ') this.dropHeld(e.ctrlKey);
        if (code.startsWith('Digit')) {
          const n = Number(code.slice(5));
          if (n >= 1 && n <= 9) {
            this.inv.selected = n - 1;
            this.inv.changed();
            this.ui.showItemName(this.inv.held ? nameOf(this.inv.held.id) : '');
          }
        }
        if (code === 'Space' && this.player.creative) {
          const now = performance.now();
          if (now - this.lastSpace < 280) {
            this.player.flying = !this.player.flying;
            this.player.vel.y = 0;
            this.ui.showItemName(this.player.flying ? 'Flight enabled' : 'Flight disabled');
          }
          this.lastSpace = now;
        }
      } else if (this.state === 'inv') {
        if (code === 'KeyE' || code === 'Escape') { e.preventDefault(); this.closeInventory(); }
      } else if (this.state === 'paused') {
        if (code === 'Escape' && this.ui.currentScreen === 'pause') this.resume();
      }
    });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
  }

  inputState() {
    return {
      forward: !!this.keys['KeyW'],
      back: !!this.keys['KeyS'],
      left: !!this.keys['KeyA'],
      right: !!this.keys['KeyD'],
      jump: !!this.keys['Space'],
      sprint: !!this.keys['ShiftLeft'] || !!this.keys['ShiftRight'],
      sneak: !!this.keys['ShiftLeft'] || !!this.keys['ShiftRight'],
    };
  }

  // ---------------- state transitions ----------------
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.mouse.l = this.mouse.r = false;
    this.resetMining();
    document.exitPointerLock?.();
    this.save();
    this.ui.screen('pause');
  }

  resume() {
    this.state = 'playing';
    this.ui.screen(null);
    this.requestLock();
  }

  openInventory(tab) {
    this.state = 'inv';
    this.mouse.l = this.mouse.r = false;
    this.resetMining();
    document.exitPointerLock?.();
    this.ui.openInventory(this.inv, tab);
  }

  closeInventory() {
    this.ui.closeInventory(this.inv);
    this.furnaceSession = false;
    this.state = 'playing';
    this.ui.screen(null);
    this.requestLock();
  }

  onDeath(cause) {
    this.state = 'dead';
    document.exitPointerLock?.();
    const causes = {
      fall: 'You fell from a high place', zombie: 'A zombie got you', starve: 'You starved',
      drown: 'You drowned', cactus: 'Prickly death by cactus', void: 'You fell out of the world',
    };
    this.ui.$('vh-death-cause').textContent = `${causes[cause] || 'The world was too much'} · survived ${this.sky.day} day${this.sky.day > 1 ? 's' : ''}`;
    this.ui.screen('death');
    this.save();
  }

  respawn() {
    this.player.respawn();
    this.entities.clearHostiles();
    this.state = 'playing';
    this.ui.screen(null);
    this.requestLock();
  }

  quitToTitle() {
    this.save();
    this.sessionActive = false;
    document.exitPointerLock?.();
    this.ui.setContinueVisible(true);
    this.bootPanorama(this.seed ?? 1337);
    this.ui.screen('title');
  }

  save() {
    if (!this.sessionActive || !this.player) return;
    const ok = writeSave({
      v: 1, seed: this.seed, mode: this.mode,
      player: this.player.serialize(),
      inv: this.inv.serialize(),
      sky: this.sky.serialize(),
      mods: this.world.serializeMods(),
      ach: [...this.achievements],
      stats: this.stats,
      smelt: this.smeltState,
    });
    return ok;
  }

  // ---------------- interactions ----------------
  lookRay(maxDist) {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return { origin: this.camera.position.clone(), dir };
  }

  tryAttack() {
    if (this.attackCd > 0) return;
    const { origin, dir } = this.lookRay(3.4);
    const mob = this.entities.attackRay(origin, dir, 3.4);
    this.swingHand();
    if (mob) {
      this.attackCd = 0.35;
      const held = this.inv.held;
      const def = held ? defOf(held.id) : null;
      const dmg = def?.damage || 1;
      const dirXZ = { x: dir.x, z: dir.z };
      const l = Math.hypot(dirXZ.x, dirXZ.z) || 1;
      this.entities.damageMob(mob, dmg, { x: dirXZ.x / l, z: dirXZ.z / l });
      this.audio.hit();
      if (!this.player.creative && def?.durability) {
        if (this.inv.damageHeld(def.tool === 'sword' ? 1 : 2)) this.audio.toolBreak();
      }
      this.resetMining();
    }
  }

  currentTarget() {
    const { origin, dir } = this.lookRay(this.player.creative ? 7 : 5);
    return raycastBlocks(this.world, origin, dir, this.player.creative ? 7 : 5);
  }

  resetMining() {
    this.mining.target = null;
    this.mining.progress = 0;
    this.crack.visible = false;
  }

  updateMining(dt) {
    const target = this.currentTarget();
    // highlight
    if (target) {
      this.highlight.visible = true;
      this.highlight.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
    } else this.highlight.visible = false;

    if (!this.mouse.l || !target) { this.resetMining(); if (!target) this.highlight.visible = false; return; }
    // if pointing at a mob, attacks are handled on click
    const { origin, dir } = this.lookRay(3.4);
    if (this.entities.attackRay(origin, dir, 3.4)) { this.resetMining(); return; }

    const id = target.id;
    if (!breakable(id)) { this.resetMining(); return; }
    const key = `${target.x},${target.y},${target.z}`;
    if (this.mining.target !== key) {
      this.mining.target = key;
      this.mining.progress = 0;
    }
    const def = BLOCKS[id];
    const held = this.inv.held;
    const heldDef = held ? defOf(held.id) : null;
    let speed = 1;
    if (heldDef?.tool && heldDef.tool === def.tool) speed = heldDef.speed;
    const breakTime = this.player.creative ? 0.05 : Math.max(0.05, def.hardness / speed);
    this.mining.progress += dt / breakTime;
    this.swingHandLoop();

    this.mining.soundTimer -= dt;
    if (this.mining.soundTimer <= 0) {
      this.mining.soundTimer = 0.22;
      this.audio.dig(id);
      this.particles.blockHit(target.x, target.y, target.z, id, target.face);
    }
    // crack overlay
    const stage = Math.min(9, Math.floor(this.mining.progress * 10));
    this.crack.visible = true;
    this.crack.position.copy(this.highlight.position);
    this.crack.material.map = this.crackTexs[stage];

    if (this.mining.progress >= 1) this.breakBlock(target);
  }

  breakBlock(target) {
    const { x, y, z, id } = target;
    const def = BLOCKS[id];
    this.world.setBlock(x, y, z, B.AIR);
    this.audio.breakBlock(id);
    this.particles.blockBreak(x, y, z, id);
    this.stats.mined++;
    this.player.exhaustion += 0.02;

    if (!this.player.creative) {
      // drops
      let drops = [];
      if (def.drops === 'leaves') {
        const r = Math.random();
        if (r < 0.06) drops = [{ id: I.APPLE, n: 1 }];
        else if (r < 0.16) drops = [{ id: I.STICK, n: 1 }];
      } else if (def.drops) {
        drops = def.drops;
      } else {
        drops = [{ id, n: 1 }];
      }
      const held = this.inv.held;
      const heldDef = held ? defOf(held.id) : null;
      const tier = heldDef?.tool === def.tool ? heldDef.tier : 0;
      const tierOk = !def.tier || tier >= def.tier;
      if (tierOk) {
        for (const d of drops) {
          const leftover = this.inv.add(d.id, d.n);
          if (leftover > 0) this.entities.dropItem(d.id, leftover, x + 0.5, y + 0.5, z + 0.5, 0.6);
          if (d.id === B.LOG) this.unlock('wood');
          if (d.id === I.DIAMOND) this.unlock('diamond');
        }
      }
      if (heldDef?.durability && heldDef.tool !== 'sword') {
        if (this.inv.damageHeld(1)) this.audio.toolBreak();
      }
    }
    this.resetMining();
  }

  useAction() {
    if (this.placeCd > 0) return;
    const held = this.inv.held;
    const heldDef = held ? defOf(held.id) : null;

    // eat
    if (heldDef?.food) {
      if (this.player.creative || this.player.eat(heldDef.food)) {
        if (!this.player.creative) this.inv.consumeSlot(this.inv.selected, 1);
        this.audio.eat();
        this.swingHand();
        this.placeCd = 0.4;
        if (held.id === I.PORK_COOKED) this.unlock('cooked');
      } else {
        this.ui.showItemName('Not hungry');
      }
      return;
    }

    const target = this.currentTarget();
    if (!target) return;

    // open stations
    const station = BLOCKS[target.id]?.station;
    if (station && !this.keys['ShiftLeft']) {
      if (station === 'smelt') this.furnaceSession = true;
      this.openInventory(station);
      return;
    }

    // place block
    if (!held || !isBlock(held.id)) return;
    const px = target.x + target.face[0];
    const py = target.y + target.face[1];
    const pz = target.z + target.face[2];
    if (py < 1 || py >= HEIGHT) return;
    const existing = this.world.getBlock(px, py, pz);
    if (existing !== B.AIR && existing !== B.WATER) return;
    const placeDef = BLOCKS[held.id];
    const solid = !placeDef.fluid && placeDef.shape !== 'torch';
    if (solid) {
      if (boxIntersectsBlock(this.player, px, py, pz)) return;
      for (const m of this.entities.mobs) {
        if (!m.dead && boxIntersectsBlock(m, px, py, pz)) return;
      }
    }
    if (held.id === B.TORCH) {
      // needs a solid neighbor
      const support = [[0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]
        .some(([dx, dy, dz]) => {
          const b = this.world.getBlock(px + dx, py + dy, pz + dz);
          return b !== B.AIR && BLOCKS[b] && !BLOCKS[b].fluid && !BLOCKS[b].transparent && !BLOCKS[b].cutout;
        });
      if (!support) return;
    }
    this.world.setBlock(px, py, pz, held.id);
    this.audio.place();
    this.swingHand();
    this.placeCd = 0.22;
    this.stats.placed++;
    if (!this.player.creative) this.inv.consumeSlot(this.inv.selected, 1);
    if (held.id === B.TORCH) this.unlock('torch');
    if (this.stats.placed >= 100) this.unlock('builder');
  }

  pickBlock() {
    const target = this.currentTarget();
    if (!target) return;
    const id = target.id;
    const existing = this.inv.slots.findIndex((s, i) => i < 9 && s && s.id === id);
    if (existing >= 0) {
      this.inv.selected = existing;
    } else if (this.player.creative) {
      this.inv.slots[this.inv.selected] = { id, n: 64 };
    } else return;
    this.inv.changed();
    this.ui.showItemName(nameOf(id));
  }

  dropHeld(all = false) {
    const s = this.inv.held;
    if (!s) return;
    const n = all ? s.n : 1;
    const { dir } = this.lookRay(1);
    const it = this.entities.dropItem(s.id, n, this.player.pos.x + dir.x * 0.6, this.player.pos.y + 1.3, this.player.pos.z + dir.z * 0.6, 1.4, s.dur);
    it.vel.x = dir.x * 6; it.vel.y = 2.5; it.vel.z = dir.z * 6;
    this.inv.consumeSlot(this.inv.selected, n);
  }

  craft(recipe) {
    if (doCraft(this.inv, recipe)) {
      this.audio.craft();
      const id = recipe.out.id;
      if (id === B.PLANKS) this.unlock('planks');
      if (id === B.TABLE) this.unlock('table');
      if (id === I.S_PICK) this.unlock('stone_pick');
      if (id === B.FURNACE) this.unlock('furnace');
      this.ui.showItemName('Crafted ' + nameOf(id));
    }
    this.ui.renderInventory(this.inv);
    this.ui.renderRecipes();
  }

  furnaceAvailable() {
    if (this.furnaceSession) return true;
    if (this.inv.count(B.FURNACE) > 0) return true;
    return this.furnaceNear;
  }

  startSmelt(recipe) {
    const st = this.smeltState;
    if (st.current || !this.furnaceAvailable()) return;
    if (this.inv.count(recipe.input) < 1) return;
    if (st.fuel <= 0) {
      const fuel = FUELS.find((f) => this.inv.count(f.id) > 0);
      if (!fuel) {
        this.ui.toast('No fuel', 'Smelting needs coal, logs or planks', 'flame');
        return;
      }
      this.inv.remove(fuel.id, 1);
      st.fuel += fuel.burns;
    }
    this.inv.remove(recipe.input, 1);
    st.fuel--;
    st.current = recipe;
    st.progress = 0;
    this.audio.furnace();
    this.ui.renderRecipes();
  }

  updateSmelt(dt) {
    const st = this.smeltState;
    if (!st.current) return;
    st.progress += dt;
    if (st.progress >= SMELT_TIME) {
      const out = st.current.output;
      const leftover = this.inv.add(out.id, out.n);
      if (leftover > 0) this.entities.dropItem(out.id, leftover, this.player.pos.x, this.player.pos.y + 1, this.player.pos.z, 0.8);
      if (out.id === I.IRON) this.unlock('iron');
      this.audio.pickup();
      st.current = null;
      st.progress = 0;
      if (this.state === 'inv') { this.ui.renderInventory(this.inv); this.ui.renderRecipes(); }
    }
  }

  unlock(id) {
    if (this.achievements.has(id)) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    this.achievements.add(id);
    this.ui.achievementToast(a);
    this.audio.achievement();
  }

  // ---------------- viewmodel ----------------
  updateHandMesh() {
    if (this.handMesh) {
      this.handGroup.remove(this.handMesh);
      this.handMesh = null;
    }
    const s = this.inv?.held;
    if (!s) return;
    if (isBlock(s.id) && s.id !== B.TORCH) {
      let geo = this.handGeoCache.get(s.id);
      if (!geo) { geo = makeBlockGeometry(s.id); this.handGeoCache.set(s.id, geo); }
      this.handMesh = new THREE.Mesh(geo, this.solidMat);
      this.handMesh.scale.setScalar(0.38);
      this.handMesh.rotation.y = Math.PI / 5;
    } else {
      let tex = this.iconTexCache.get(s.id);
      if (!tex) { tex = makeIconTexture(s.id); this.iconTexCache.set(s.id, tex); }
      this.handMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.5),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide })
      );
      this.handMesh.rotation.y = -Math.PI / 7;
      this.handMesh.rotation.z = Math.PI / 10;
    }
    this.handGroup.add(this.handMesh);
  }

  swingHand() { this.swing = 1; }
  swingHandLoop() { if (this.swing <= 0.3) this.swing = 0.8; }

  onInventoryChanged() {
    if (!this.sessionActive) return;
    this.ui.updateHotbar(this.inv);
    this.updateHandMesh();
    if (this.state === 'inv') {
      this.ui.renderInventory(this.inv);
      this.ui.renderRecipes();
    }
  }

  // ---------------- streaming ----------------
  meshChunk(cx, cz) {
    const c = this.world.chunks.get(chunkKey(cx, cz));
    if (!c) return false;
    // require neighbor data
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!this.world.chunks.has(chunkKey(cx + dx, cz + dz))) return false;
    }
    this.disposeChunkMeshes(c);
    const { solid, water, lights } = buildChunkMesh(this.world, c);
    if (solid) {
      const mesh = new THREE.Mesh(solid, this.solidMat);
      mesh.position.set(cx * CHUNK, 0, cz * CHUNK);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      c.mesh = mesh;
    }
    if (water) {
      const mesh = new THREE.Mesh(water, this.waterMat);
      mesh.position.set(cx * CHUNK, 0, cz * CHUNK);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.renderOrder = 1;
      this.scene.add(mesh);
      c.water = mesh;
    }
    c.lights = lights;
    c.dirty = false;
    return true;
  }

  streamChunks(budgetMs = 6) {
    const center = this.sessionActive ? this.player.pos : this.panoramaSpawn;
    const R = this.sessionActive ? this.settings.renderDist : 4;
    const ccx = Math.floor(center.x / CHUNK), ccz = Math.floor(center.z / CHUNK);
    const deadline = performance.now() + budgetMs;

    // collect needed, sorted by distance
    const needed = [];
    for (let dz = -R - 1; dz <= R + 1; dz++) {
      for (let dx = -R - 1; dx <= R + 1; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > (R + 1.5) * (R + 1.5)) continue;
        needed.push([ccx + dx, ccz + dz, d2]);
      }
    }
    needed.sort((a, b) => a[2] - b[2]);

    // generate data
    let gens = 0;
    for (const [cx, cz, d2] of needed) {
      if (performance.now() > deadline && gens > 0) break;
      if (!this.world.chunks.has(chunkKey(cx, cz))) {
        this.world.getChunk(cx, cz, true);
        gens++;
        if (gens >= 3) break;
      }
    }
    // mesh dirty chunks within R
    let meshes = 0;
    for (const [cx, cz, d2] of needed) {
      if (d2 > R * R + 1) continue;
      if (performance.now() > deadline && meshes > 0) break;
      const c = this.world.chunks.get(chunkKey(cx, cz));
      if (c && c.dirty) {
        if (this.meshChunk(cx, cz)) meshes++;
        if (meshes >= 3) break;
      }
    }
    // unload far chunks
    if (!this._unloadTimer) this._unloadTimer = 0;
    this._unloadTimer++;
    if (this._unloadTimer % 60 === 0) {
      for (const [key, c] of this.world.chunks) {
        const dx = c.cx - ccx, dz = c.cz - ccz;
        if (dx * dx + dz * dz > (R + 3) * (R + 3)) {
          this.disposeChunkMeshes(c);
          this.world.chunks.delete(key);
        }
      }
    }
  }

  collectLights() {
    const lights = [];
    for (const c of this.world.chunks.values()) {
      if (c.lights && c.lights.length) lights.push(...c.lights);
    }
    return lights;
  }

  // ---------------- main loop ----------------
  frame() {
    const rawDt = this.clock.getDelta();
    const dt = Math.min(0.05, rawDt);
    this.fps += ((rawDt > 0 ? 1 / rawDt : 60) - this.fps) * 0.05;

    // adaptive resolution: keep low-end devices playable
    this._qualityTimer = (this._qualityTimer || 0) + rawDt;
    if (this._qualityTimer > 3 && this.sessionActive) {
      this._qualityTimer = 0;
      const base = Math.min(window.devicePixelRatio, 2);
      const cur = this.renderer.getPixelRatio();
      if (this.fps < 28 && cur > 0.5) {
        this.renderer.setPixelRatio(Math.max(0.5, cur - 0.25));
      } else if (this.fps > 55 && cur < base) {
        this.renderer.setPixelRatio(Math.min(base, cur + 0.25));
      }
    }

    if (this.state === 'loading') {
      this.processInitialLoad();
      this.renderer.render(this.scene, this.camera);
      this.updatePanoramaCamera(dt);
      return;
    }

    const inGame = this.sessionActive;
    const simulating = inGame && (this.state === 'playing' || this.state === 'inv');

    if (!inGame) {
      // title panorama
      this.updatePanoramaCamera(dt);
      this.streamChunks(8);
      this.sky.update(dt, this.camera, this.panoramaSpawn, { renderDist: 4 });
      this.particles.update(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (simulating) {
      const input = this.state === 'playing' ? this.inputState() : { forward: false, back: false, left: false, right: false, jump: false, sprint: false, sneak: false };
      const prevEntitiesHooks = this.entities.hooks;
      prevEntitiesHooks.player = this.player;
      this.player.update(dt, input, this.playerHooks());
      this.attackCd = Math.max(0, this.attackCd - dt);
      this.placeCd = Math.max(0, this.placeCd - dt);

      if (this.state === 'playing') {
        this.updateMining(dt);
        if (this.mouse.r && this.placeCd <= 0) this.useAction();
      }

      this.streamChunks(6);
      const biome = this.world.biomeAt(Math.floor(this.player.pos.x), Math.floor(this.player.pos.z));
      const cold = biome === BIOME.SNOWY || biome === BIOME.MOUNTAIN;
      this.sky.update(dt, this.camera, this.player.pos, {
        coldBiome: cold,
        underwater: this.player.headUnder,
        renderDist: this.settings.renderDist,
        hooks: {
          thunder: () => this.audio.thunder(),
          newDay: () => { if (!this.player.dead) this.unlock('night'); },
          weatherStart: (type) => this.ui.toast(type === 'snow' ? 'Snow begins to fall' : 'Rain begins to fall', '', type === 'snow' ? 'snowflake' : 'cloud-rain'),
        },
      });
      this.sky.updateTorches(dt, this.collectLights(), this.camera);
      this.entities.updateMobs(dt, this.sky.daylight, this.player);
      this.entities.updateItems(dt, this.player, this.inv);
      this.entities.updateSpawning(dt, this.player, this.sky);
      this.particles.update(dt);
      this.updateSmelt(dt);
      this.audio.update(dt, { rain: this.sky.precipType === 'rain' ? this.sky.precip : 0, altitude: this.player.pos.y, night: this.sky.isNight });

      // torch ambience particles
      if (Math.random() < dt * 6) {
        const lights = this.collectLights();
        if (lights.length) {
          const l = lights[Math.floor(Math.random() * lights.length)];
          this.particles.flame(l[0], l[1] + 0.1, l[2]);
        }
      }

      // furnace proximity scan
      this.furnaceScan -= dt;
      if (this.furnaceScan <= 0) {
        this.furnaceScan = 0.8;
        this.furnaceNear = this.scanFurnace();
      }
      // smelt UI progress
      if (this.state === 'inv' && this.smeltState.current) {
        this.smeltUiTimer -= dt;
        if (this.smeltUiTimer <= 0) { this.smeltUiTimer = 0.2; this.ui.renderRecipes(); }
      }

      // achievements: depth
      if (this.player.pos.y < 12) this.unlock('deep');

      // autosave
      this.autosaveTimer -= dt;
      if (this.autosaveTimer <= 0) {
        this.autosaveTimer = 25;
        if (this.save()) this.ui.toast('World saved', '', 'save', 'vh-toast-mini');
      }

      this.updateCamera(dt);
      this.updateHud(dt, biome);
    } else {
      // paused / dead: still render, subtle sky freeze
      this.updateCamera(dt);
    }

    this.renderer.render(this.scene, this.camera);
  }

  scanFurnace() {
    const p = this.player.pos;
    const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
    for (let dy = -3; dy <= 3; dy++)
      for (let dz = -5; dz <= 5; dz++)
        for (let dx = -5; dx <= 5; dx++)
          if (this.world.getBlock(px + dx, py + dy, pz + dz) === B.FURNACE) return true;
    return false;
  }

  updatePanoramaCamera(dt) {
    this.panoramaAngle = (this.panoramaAngle || 0) + dt * 0.03;
    const s = this.panoramaSpawn;
    const groundY = this.world.heightAt(Math.floor(s.x), Math.floor(s.z));
    const r = 26;
    const cx = s.x + Math.cos(this.panoramaAngle) * r;
    const cz = s.z + Math.sin(this.panoramaAngle) * r;
    this.camera.position.set(cx, groundY + 16, cz);
    this.camera.lookAt(s.x, groundY + 4, s.z);
  }

  updateCamera(dt) {
    const p = this.player;
    const bob = p.onGround && !p.flying ? Math.sin(p.bobPhase * 2.2) * 0.045 : 0;
    this.camera.position.set(p.pos.x, p.pos.y + p.eye + bob, p.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = p.yaw;
    this.camera.rotation.x = p.pitch;
    this.camera.rotation.z = Math.sin(p.bobPhase * 1.1) * 0.003;

    // sprint FOV kick
    const targetFov = this.settings.fov + (p.sprinting ? 8 : 0) + (p.flying ? 5 : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
      this.camera.updateProjectionMatrix();
    }

    // hand swing animation
    this.swing = Math.max(0, this.swing - dt * 5);
    const sw = Math.sin(this.swing * Math.PI);
    this.handGroup.position.set(0.52 - sw * 0.25, -0.48 - sw * 0.2 + bob * 0.5, -0.85 - sw * 0.1);
    this.handGroup.rotation.x = -sw * 0.9;
    this.handGroup.visible = this.state === 'playing';

    this.ui.setUnderwater(p.headUnder);
  }

  updateHud(dt, biome) {
    this.statTimer -= dt;
    if (this.statTimer <= 0) {
      this.statTimer = 0.15;
      this.ui.updateStats(this.player);
    }
    this.envTimer -= dt;
    if (this.envTimer <= 0) {
      this.envTimer = 0.5;
      this.ui.setEnv({
        clock: this.sky.clockString(),
        day: this.sky.day,
        biome: BIOME_NAMES[biome],
        night: this.sky.isNight,
        weather: this.sky.precip > 0.25 ? this.sky.precipType : null,
      });
    }
    if (this.debugOn) {
      const p = this.player.pos;
      const info = this.renderer.info.render;
      const facing = ['south (+Z)', 'west (-X)', 'north (-Z)', 'east (+X)'][Math.round(((this.player.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 2)) % 4];
      this.ui.setDebug(
        `Voxelheim · ${Math.round(this.fps)} fps\n` +
        `XYZ: ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}\n` +
        `Chunk: ${Math.floor(p.x / CHUNK)}, ${Math.floor(p.z / CHUNK)} · loaded ${this.world.chunks.size}\n` +
        `Facing: ${facing} · biome ${BIOME_NAMES[biome]}\n` +
        `Draw calls: ${info.calls} · tris ${(info.triangles / 1000).toFixed(0)}k\n` +
        `Mobs: ${this.entities.mobs.length} · items: ${this.entities.items.length}\n` +
        `Seed: ${this.seed} · ${this.sky.clockString()} day ${this.sky.day}`
      );
    }
  }
}

export function initGame(container) {
  const game = new Game(container);
  window.__VH__ = game; // debug/testing handle
  return game;
}