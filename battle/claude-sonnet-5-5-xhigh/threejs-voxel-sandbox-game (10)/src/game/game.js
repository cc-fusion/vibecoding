// Game orchestrator: renderer, input, session lifecycle, simulation loop, persistence.
import * as THREE from 'three';
import { World } from './world.js';
import { createVoxelUniforms, createVoxelMaterial } from './materials.js';
import { Sky } from './sky.js';
import { AudioEngine } from './audio.js';
import { Inventory } from './inventory.js';
import { Player } from './player.js';
import { Entities } from './entities.js';
import { Particles } from './particles.js';
import { MobManager } from './mobs.js';
import { Weather } from './weather.js';
import { Hand } from './hand.js';
import { UI } from './ui.js';
import { Advancements } from './advancements.js';
import { Storage, loadSettings } from './storage.js';
import { B, I, DEFS, dropsFor, LIQUID, OPACITY, SOLID, isLeaves, isLog, maxStack } from './blocks.js';
import { BIOME, BIOME_NAMES } from './worldgen.js';
import { DAY_LENGTH, CH } from './constants.js';
import { SMELTING, fuelTime } from './recipes.js';
import { makeCrackCanvases } from './textures.js';
import { seedFromString } from './noise.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const BACKDROP_SEED = 20240611;

export class Game {
  constructor(canvas) {
    THREE.ColorManagement.enabled = false;
    this.canvas = canvas;
    this.settings = loadSettings();
    this.settings.hostile = true;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.autoClear = false;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    r.setPixelRatio(this.pixelRatio);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xbfd4ff, 60, 120);
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, 1, 0.06, 700);
    this.camera.rotation.order = 'YXZ';
    this.shared = createVoxelUniforms();
    this.mats = { solid: createVoxelMaterial(this.shared), trans: createVoxelMaterial(this.shared, { transparent: true, alphaCut: 0.02 }) };
    this.audio = new AudioEngine(this.settings);
    this.sky = new Sky(this.scene, this.shared, 5);
    this.ui = new UI(this);
    this.inventory = new Inventory();
    this.player = new Player(this);
    this.advancements = new Advancements(this);
    this.entities = new Entities(this);
    this.particles = new Particles(this.scene, null);
    this.particles.lightFn = (x, y, z) => this.lightAt(x, y, z);
    this.mobs = new MobManager(this);
    this.weather = new Weather(this);
    this.hand = new Hand(this);
    this.world = null;
    this.state = 'boot';
    this.worldRec = null;
    this.worldTime = 0.06;
    this.day = 1;
    this.time = 0;
    this.acc = 0;
    this.last = performance.now();
    this.fps = 60; this.frames = 0; this.fpsT = 0; this.lowFpsT = 0;
    this.debugForceLock = false;
    this.locked = false;
    this.uiOpen = false;
    this.sleeping = false;
    this.fovCur = this.settings.fov;
    this.hurtTilt = 0; this.shake = 0;
    this.saveTimer = 45;
    this.randTick = 0; this.leafQueue = []; this.sprintTap = 0;
    this.camBob = 0;

    this.buildHelpers();
    this.bindInput();
    this.applySettings();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.startBackdrop();
    this.ui.show('menu');
    this.state = 'menu';
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---- helpers: crack overlay + selection box -------------------------------------------------------
  buildHelpers() {
    this.crackTex = makeCrackCanvases().map((c) => { const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; return t; });
    this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), new THREE.MeshBasicMaterial({ map: this.crackTex[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false }));
    this.crackMesh.visible = false;
    this.scene.add(this.crackMesh);
    this.selMesh = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, fog: false, depthTest: true }));
    this.selMesh.visible = false;
    this.scene.add(this.selMesh);
  }

  setCrack(t, stage) {
    if (!t || stage < 0) { this.crackMesh.visible = false; return; }
    this.crackMesh.visible = true;
    this.crackMesh.material.map = this.crackTex[Math.min(9, stage)];
    this.crackMesh.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
  }

  updateSelection() {
    const t = this.player.target;
    if (!t || this.state !== 'playing') { this.selMesh.visible = false; return; }
    const d = DEFS[t.id];
    let b = [0, 0, 0, 16, 16, 16];
    if (d.box) b = d.box; else if (d.sel) b = d.sel;
    const e = 0.004;
    this.selMesh.visible = true;
    this.selMesh.scale.set((b[3] - b[0]) / 16 + e, (b[4] - b[1]) / 16 + e, (b[5] - b[2]) / 16 + e);
    this.selMesh.position.set(t.x + (b[0] + b[3]) / 32, t.y + (b[1] + b[4]) / 32, t.z + (b[2] + b[5]) / 32);
  }

  // ---- settings ---------------------------------------------------------------------------------------
  applySettings() {
    const s = this.settings;
    if (this.world) this.world.setRenderDistance(this.state === 'menu' ? Math.min(7, s.renderDistance) : s.renderDistance);
    this.sky.cloudsOn = s.clouds;
    this.particles.enabled = s.particles;
    this.audio.applySettings();
    $('fps').classList.toggle('hidden', !s.showFps);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.hand.resize(w / h);
  }

  // ---- lighting helper for entities -----------------------------------------------------------------------
  lightAt(x, y, z) {
    if (!this.world) return 1;
    const raw = this.world.getLightRaw(Math.floor(x), Math.floor(y), Math.floor(z));
    const sky = (raw >> 4) / 15, blk = (raw & 15) / 15;
    const c = (v) => Math.pow(0.8, (1 - v) * 15);
    return clamp(Math.max(c(sky) * this.shared.uSky.value, c(blk) * 0.95, 0.05) + this.shared.uFlash.value, 0, 1);
  }

  // ---- input -------------------------------------------------------------------------------------------
  get isLocked() { return this.debugForceLock || this.locked; }
  canControl() { return this.state === 'playing' && !this.uiOpen && this.isLocked && !this.sleeping; }

  requestLock() {
    if (this.debugForceLock) return;
    try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
  }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  bindInput() {
    const inp = () => this.player.input;
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked && this.state === 'playing' && !this.uiOpen && !this.sleeping) this.pause();
    });
    document.addEventListener('pointerlockerror', () => { if (this.state === 'playing' && !this.uiOpen) this.pause(); });
    window.addEventListener('mousemove', (e) => {
      if (!this.canControl() || !document.pointerLockElement) return;
      const mx = clamp(e.movementX, -250, 250), my = clamp(e.movementY, -250, 250);
      const sens = 0.0022 * this.settings.sensitivity;
      const p = this.player;
      p.yaw -= mx * sens;
      p.pitch -= my * sens * (this.settings.invertY ? -1 : 1);
      p.pitch = clamp(p.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
    });
    this.canvas.addEventListener('mousedown', (e) => {
      this.audio.unlock();
      if (this.state !== 'playing' || this.uiOpen) return;
      if (!this.isLocked) { this.requestLock(); return; }
      if (!this.canControl()) return;
      const p = this.player;
      if (e.button === 0) { p.mouseL = true; p.attackQueued = true; }
      else if (e.button === 2) { p.mouseR = true; p.rightClicked = true; }
      else if (e.button === 1) { e.preventDefault(); this.pickBlock(); }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.player.mouseL = false; if (e.button === 2) this.player.mouseR = false; });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => {
      if (!this.canControl()) return;
      const dir = Math.sign(e.deltaY);
      this.inventory.selected = (this.inventory.selected + dir + 9) % 9;
    }, { passive: true });
    window.addEventListener('blur', () => { if (this.state === 'playing' && !this.uiOpen) this.pause(); });

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT') && e.code !== 'Escape') return;
      const code = e.code;
      const i = inp();
      if (this.state === 'playing' || this.uiOpen) {
        if (['Space', 'ArrowUp', 'ArrowDown', 'Tab', 'F3'].includes(code)) e.preventDefault();
      }
      if (code === 'F3') { $('debug').classList.toggle('hidden'); return; }
      if (code === 'Escape') {
        if (this.uiOpen) { this.ui.closeContainer(); return; }
        if (this.state === 'paused' && this.ui.current === 'pause') { this.resume(); return; }
        return;
      }
      if (this.uiOpen) {
        if (code === 'KeyE') { this.ui.closeContainer(); return; }
        const m = /^Digit([1-9])$/.exec(code);
        if (m && this.ui.hovered) this.ui.swapHotbar(this.ui.hovered, parseInt(m[1], 10) - 1);
        return;
      }
      if (this.state !== 'playing') return;
      if (e.repeat) { if (code === 'Space') i.jump = true; return; }
      switch (code) {
        case 'KeyW': {
          i.forward = true;
          const now = performance.now();
          if (now - this.sprintTap < 280) i.sprint = true;
          this.sprintTap = now;
          break;
        }
        case 'KeyS': i.back = true; break;
        case 'KeyA': i.left = true; break;
        case 'KeyD': i.right = true; break;
        case 'Space': {
          i.jump = true;
          const p = this.player;
          const now = performance.now();
          if (p.creative && now - (this.spaceTap || 0) < 280) { p.flying = !p.flying; if (p.flying) p.vy = 0; }
          this.spaceTap = now;
          break;
        }
        case 'ShiftLeft': case 'ShiftRight': i.sneak = true; break;
        case 'ControlLeft': case 'ControlRight': i.sprint = true; break;
        case 'KeyE': if (this.canControl()) this.openInventory(); break;
        case 'KeyQ': if (this.canControl()) this.dropHeld(e.ctrlKey); break;
        default: {
          const m = /^Digit([1-9])$/.exec(code);
          if (m) this.inventory.selected = parseInt(m[1], 10) - 1;
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      const i = inp();
      switch (e.code) {
        case 'KeyW': i.forward = false; i.sprint = false; break;
        case 'KeyS': i.back = false; break;
        case 'KeyA': i.left = false; break;
        case 'KeyD': i.right = false; break;
        case 'Space': i.jump = false; break;
        case 'ShiftLeft': case 'ShiftRight': i.sneak = false; break;
        case 'ControlLeft': case 'ControlRight': i.sprint = false; break;
        default: break;
      }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') { this.pause(); } });
    window.addEventListener('pagehide', () => { if (this.worldRec && this.world) this.saveWorld(false); });
  }

  clearInput() {
    const i = this.player.input;
    Object.keys(i).forEach((k) => { i[k] = false; });
    this.player.mouseL = this.player.mouseR = false;
  }

  // ---- menu backdrop ---------------------------------------------------------------------------------------
  startBackdrop() {
    if (this.world) this.world.dispose();
    this.world = new World({ seed: BACKDROP_SEED, scene: this.scene, materials: this.mats, renderDistance: 7 });
    this.particles.world = this.world;
    const sp = this.world.gen.findSpawn();
    this.backdrop = { cx: sp.x, cz: sp.z, a: 0 };
    this.worldTime = 0.07;
    this.applySettings();
    this.mobs.clear(); this.entities.clear();
  }

  updateBackdrop(dt) {
    const b = this.backdrop;
    b.a += dt * 0.035;
    const R = 46;
    const x = b.cx + Math.cos(b.a) * R, z = b.cz + Math.sin(b.a) * R;
    const col = this.world.gen.column(Math.floor(x), Math.floor(z));
    const targetY = Math.max(col.h, 38) + 22;
    b.y = b.y === undefined ? targetY : b.y + (targetY - b.y) * Math.min(1, dt * 0.8);
    this.camera.position.set(x, b.y, z);
    this.camera.rotation.set(-0.28, -b.a - Math.PI / 2 + 0.6, 0);
    this.world.update(x, z, 8, dt);
    this.worldTime += dt / 400;
    this.sky.update(0.07 + Math.sin(this.time * 0.01) * 0.0, this.camera, { rain: 0, flash: 0 }, dt, this.world.rd, this.time);
    this.syncFog(false);
  }

  // ---- world list / lifecycle -----------------------------------------------------------------------------
  async showWorlds() {
    const list = await Storage.listWorlds();
    this.ui.renderWorlds(list);
    this.ui.show('worlds');
  }

  async createWorld({ name, seed, mode, hostile }) {
    const rec = {
      id: 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      name, seed: seedFromString(seed), mode, hostile, created: Date.now(), played: Date.now(), thumb: null, data: null,
    };
    await Storage.putWorld(rec);
    await this.playWorld(rec.id);
  }

  async deleteWorld(id) {
    await Storage.deleteWorld(id);
    this.showWorlds();
  }

  async playWorld(id) {
    const rec = await Storage.getWorld(id);
    if (!rec) return;
    this.audio.unlock();
    this.ui.showHUD(false);
    this.ui.showLoading('Loading world', 0);
    this.state = 'loading';
    const saved = await Storage.loadChunks(id);
    this.setupSession(rec, saved);
    const d = rec.data;
    const p = this.player;
    this.ui.showLoading('Generating terrain', 0.02);
    await this.waitForChunks(3, 'Generating terrain');
    // place player on the surface for fresh worlds / unsafe positions
    if (!d || !d.player) {
      const sp = this.world.gen.findSpawn();
      const spot = this.findSafeSpot(sp.x, sp.z);
      p.x = spot.x; p.y = spot.y; p.z = spot.z;
      p.spawn0 = { x: p.x, y: p.y, z: p.z };
      p.yaw = Math.random() * Math.PI * 2;
    } else if (this.world.isSolid(Math.floor(p.x), Math.floor(p.y + 0.5), Math.floor(p.z)) || this.world.isSolid(Math.floor(p.x), Math.floor(p.y + 1.5), Math.floor(p.z))) {
      const spot = this.findSafeSpot(Math.floor(p.x), Math.floor(p.z));
      p.x = spot.x; p.y = spot.y; p.z = spot.z;
    }
    if (!p.spawn0) p.spawn0 = { x: p.x, y: p.y, z: p.z };
    if (!d || !d.populated) this.mobs.populate(14);
    this.beginPlay();
  }

  // nearest standing spot (solid ground, 2 free cells above, no liquid) around x,z
  findSafeSpot(x0, z0) {
    const w = this.world;
    const open = (x, y, z) => {
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 1; dy <= 4; dy++) {
        const id = w.getBlock(x + dx, y + dy, z + dz);
        if (id !== 0 && !LIQUID[id] && !(DEFS[id] && DEFS[id].plant)) return false;
      }
      return true;
    };
    for (const strict of [true, false]) {
      for (let r = 0; r <= 16; r++) {
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = x0 + dx, z = z0 + dz;
          if (!w.isLoaded(x, z)) continue;
          const y = w.topGroundY(x, z);
          if (y < 2 || LIQUID[w.getBlock(x, y, z)]) continue;
          if (w.isSolid(x, y + 1, z) || w.isSolid(x, y + 2, z) || LIQUID[w.getBlock(x, y + 1, z)]) continue;
          if (strict && !open(x, y, z)) continue;
          return { x: x + 0.5, y: y + 1, z: z + 0.5 };
        }
      }
    }
    return { x: x0 + 0.5, y: w.topSolidY(x0, z0) + 1, z: z0 + 0.5 };
  }

  setupSession(rec, saved) {
    if (this.world) this.world.dispose();
    this.worldRec = rec;
    const d = rec.data || {};
    const be = new Map(Object.entries(d.be || {}));
    this.world = new World({ seed: rec.seed, scene: this.scene, materials: this.mats, saved, renderDistance: this.settings.renderDistance, blockEntities: be });
    this.particles.world = this.world;
    this.settings.hostile = rec.hostile !== false;
    this.hookWorld();
    this.mobs.clear(); this.entities.clear();
    this.player = Object.assign(this.player, new Player(this));
    const p = this.player;
    p.creative = rec.mode === 'creative';
    p.load(d.player);
    this.inventory.load(d.inventory);
    this.inventory.selected = d.selected || 0;
    this.worldTime = d.worldTime !== undefined ? d.worldTime : 0.04;
    this.day = Math.floor(this.worldTime) + 1;
    this.weather.load(d.weather);
    this.advancements.load(d.adv);
    if (d.spawn0) p.spawn0 = d.spawn0;
    this.mobs.load(d.mobs);
    if (!d.player) { p.x = 0; p.z = 0; p.y = 90; }
    this.hand.curId = -2;
    this.ui.lastInvVersion = -1; this.ui.lastBars = ''; this.ui.lastSel = -1;
    this.saveTimer = 45;
    this.leafQueue.length = 0;
    this.clearInput();
    // hotbar defaults for creative worlds
    if (p.creative && !d.inventory) {
      [B.GRASS, B.STONE, B.PLANKS, B.GLASS, B.TORCH, B.CRAFTING_TABLE, B.CHEST, B.TNT, I.FLINT_STEEL].forEach((id, i) => { this.inventory.slots[i] = { id, count: id === I.FLINT_STEEL ? 1 : 64 }; });
    }
  }

  hookWorld() {
    const w = this.world;
    w.hooks.fall = (x, y, z, id) => { w.setBlock(x, y, z, 0); this.entities.spawnFalling(x, y, z, id); };
    w.hooks.breakNatural = (x, y, z, id) => {
      const drops = dropsFor(id, Math.random, true);
      w.setBlock(x, y, z, 0);
      this.particles.breakBlock(x, y, z, id, 8);
      this.audio.blockSound(id, 'break', [x + 0.5, y + 0.5, z + 0.5], 0.8);
      for (const [did, n] of drops) this.entities.spawnItem(x + 0.5, y + 0.4, z + 0.5, { id: did, count: n });
    };
    w.hooks.logRemoved = (x, y, z) => this.scheduleLeafDecay(x, y, z);
  }

  waitForChunks(radius, title) {
    return new Promise((resolve) => {
      this.loadTask = { radius, resolve, title, start: performance.now() };
      this.state = 'loading';
    });
  }

  stepLoading() {
    const t = this.loadTask;
    if (!t) return;
    const p = this.player;
    this.world.update(p.x, p.z, 24, 0);
    const prog = this.world.loadProgress(t.radius);
    this.ui.showLoading(t.title, Math.min(0.98, prog));
    this.camera.position.set(p.x, p.y + 20, p.z);
    if (prog > 0.985 || performance.now() - t.start > 30000) {
      this.loadTask = null;
      t.resolve();
    }
  }

  beginPlay() {
    this.ui.hideLoading();
    this.state = 'playing';
    this.ui.hideScreens();
    this.ui.showHUD(true);
    this.applySettings();
    this.world.setRenderDistance(this.settings.renderDistance);
    this.ui.flashItemName();
    this.requestLock();
    setTimeout(() => { if (this.state === 'playing' && !this.isLocked && !this.uiOpen) this.pause(); }, 700);
    if (this.worldRec && !this.worldRec.thumb) this.wantThumb = 2;
    if (this.player.creative) this.ui.toastSimple('Creative mode – double-tap Space to fly');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.clearInput();
    this.exitLock();
    this.ui.setPauseInfo(`${this.worldRec ? this.worldRec.name : ''} · Day ${this.day}`);
    this.ui.show('pause');
    this.setCrack(null, -1);
    this.saveWorld(false);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.hideScreens();
    this.last = performance.now();
    this.requestLock();
  }

  async quitToMenu() {
    if (this.worldRec) { this.wantThumb = 1; await this.saveWorld(true); }
    this.exitLock();
    this.clearInput();
    this.ui.closeContainer(true);
    this.uiOpen = false;
    this.ui.showHUD(false);
    this.worldRec = null;
    this.weather.load(null);
    this.player.dead = false;
    this.setCrack(null, -1);
    this.startBackdrop();
    this.state = 'menu';
    this.ui.show('menu');
    this.setFx(false, false);
  }

  // ---- saving ---------------------------------------------------------------------------------------------------
  async saveWorld(withThumb) {
    const rec = this.worldRec, w = this.world;
    if (!rec || !w) return;
    const p = this.player;
    const be = {};
    for (const [k, v] of w.blockEntities) be[k] = v;
    rec.data = {
      player: p.serialize(), inventory: this.inventory.serialize(), selected: this.inventory.selected, worldTime: this.worldTime, day: this.day,
      weather: this.weather.serialize(), adv: this.advancements.serialize(), be, mobs: this.mobs.serialize(), spawn0: p.spawn0, populated: true,
    };
    rec.played = Date.now();
    if (this.pendingThumb) { rec.thumb = this.pendingThumb; this.pendingThumb = null; }
    const chunks = w.collectSaveRecords();
    try {
      await Storage.putChunks(rec.id, chunks);
      await Storage.putWorld(JSON.parse(JSON.stringify(rec)));
    } catch (err) { console.warn('save failed', err); }
    void withThumb;
  }

  captureThumb() {
    try {
      const c = document.createElement('canvas');
      c.width = 192; c.height = 108;
      const ctx = c.getContext('2d');
      ctx.drawImage(this.canvas, 0, 0, c.width, c.height);
      this.pendingThumb = c.toDataURL('image/jpeg', 0.7);
      if (this.worldRec) this.worldRec.thumb = this.pendingThumb;
    } catch (e) { /* ignore */ }
  }

  // ---- inventory / containers -----------------------------------------------------------------------------------
  addToInventory(id, count, dmg = 0) {
    const left = this.inventory.add(id, count, dmg);
    if (left < count) this.advancements.onObtain(id);
    return left;
  }

  dropStack(stack, speed = 3.5) {
    if (!stack) return;
    const p = this.player;
    const [dx, dy, dz] = p.lookDir();
    this.entities.spawnItem(p.x + dx * 0.5, p.y + p.eyeH - 0.3, p.z + dz * 0.5, stack, dx * speed + (Math.random() - 0.5) * 0.5, dy * speed + 1.5, dz * speed + (Math.random() - 0.5) * 0.5, 1.4);
  }

  dropHeld(whole) {
    const s = this.inventory.held();
    if (!s) return;
    const n = whole ? s.count : 1;
    this.dropStack({ ...s, count: n });
    s.count -= n;
    if (s.count <= 0) this.inventory.slots[this.inventory.selected] = null;
    this.inventory.touch();
  }

  pickBlock() {
    const t = this.player.target;
    if (!t) return;
    let id = t.id;
    if (id === B.FURNACE_LIT) id = B.FURNACE;
    const inv = this.inventory;
    for (let i = 0; i < 9; i++) if (inv.slots[i] && inv.slots[i].id === id) { inv.selected = i; return; }
    if (this.player.creative) {
      let slot = inv.slots.findIndex((s, i) => i < 9 && !s);
      if (slot < 0) slot = inv.selected;
      inv.slots[slot] = { id, count: 64 }; inv.selected = slot; inv.touch();
    }
  }

  openInventory() {
    this.openContainer(this.player.creative ? 'creative' : 'inventory', {});
  }

  openContainer(kind, ctx) {
    this.uiOpen = true;
    this.clearInput();
    this.exitLock();
    this.player.mouseL = this.player.mouseR = false;
    this.setCrack(null, -1);
    this.ui.openContainer(kind, ctx);
    $('status').style.visibility = 'hidden';
  }

  onContainerClosed() {
    this.uiOpen = false;
    $('status').style.visibility = '';
    if (this.state === 'playing') {
      this.requestLock();
      setTimeout(() => { if (this.state === 'playing' && !this.uiOpen && !this.isLocked) this.pause(); }, 400);
    }
  }

  interactBlock(t) {
    const d = DEFS[t.id];
    const w = this.world;
    const key = w.beKey(t.x, t.y, t.z);
    if (d.ui === 'crafting') { this.audio.play('door', { vol: 0.5 }); this.openContainer('crafting', {}); }
    else if (d.ui === 'furnace') {
      let be = w.getBE(t.x, t.y, t.z);
      if (!be) { be = { type: 'furnace', input: null, fuel: null, output: null, burn: 0, burnMax: 0, cook: 0 }; w.setBE(t.x, t.y, t.z, be); }
      this.openContainer('furnace', { be, key });
    } else if (d.ui === 'chest') {
      let be = w.getBE(t.x, t.y, t.z);
      if (!be) { be = { type: 'chest', slots: new Array(27).fill(null) }; w.setBE(t.x, t.y, t.z, be); }
      this.audio.play('door', { vol: 0.6 });
      this.openContainer('chest', { be, key });
    } else if (d.ui === 'bed') this.trySleep(t.x, t.y, t.z);
  }

  spillBlockEntity(x, y, z, be) {
    const list = be.type === 'chest' ? be.slots : [be.input, be.fuel, be.output];
    for (const s of list) if (s) this.entities.spawnItem(x + 0.5, y + 0.5, z + 0.5, s);
  }

  onCraft(id, count) {
    this.advancements.onObtain(id);
    void count;
  }
  onSmeltTaken(id) { this.advancements.onObtain(id); }

  // ---- gameplay events -----------------------------------------------------------------------------------------------
  onBlockBroken() { this.advancements.stats.mined++; }
  onBlockPlaced(id) {
    const st = this.advancements.stats;
    st.placed++;
    if (id === B.TORCH) this.advancements.grant('torch');
    if (st.placed >= 200) this.advancements.grant('builder');
  }
  onMobKilled(mob) {
    this.advancements.stats.kills++;
    if (mob.def.hostile) this.advancements.grant('hunter');
  }
  onAte(id) {
    if ([I.COOKED_PORK, I.COOKED_BEEF, I.COOKED_MUTTON, I.COOKED_CHICKEN].includes(id)) this.advancements.grant('cook');
  }

  damagePlayer(amount, cause, kx, kz, kb, env = false) {
    const p = this.player;
    if (this.state !== 'playing' || p.dead || p.creative) return;
    if (p.invuln > 0 && !env) return;
    if (env && p.invuln > 0.35) return;
    p.health -= amount;
    p.invuln = env ? 0.4 : 0.55;
    if (kb) { p.vx += kx * kb; p.vz += kz * kb; p.vy = Math.max(p.vy, 4); p.onGround = false; }
    this.hurtTilt = (Math.random() < 0.5 ? -1 : 1) * 0.12;
    this.setHurtFx();
    this.audio.play('hurt', { vol: 0.9 });
    if (p.health <= 0) { p.health = 0; this.die(cause); }
  }

  setHurtFx() {
    const f = $('fx-hurt');
    f.classList.add('on');
    clearTimeout(this.hurtT);
    this.hurtT = setTimeout(() => f.classList.remove('on'), 160);
  }

  die(cause) {
    const p = this.player;
    p.dead = true;
    this.advancements.stats.deaths++;
    this.clearInput();
    this.uiOpen = false;
    this.ui.closeContainer(true);
    let lost = false;
    for (let i = 0; i < 36; i++) {
      const s = this.inventory.slots[i];
      if (s) {
        lost = true;
        this.entities.spawnItem(p.x, p.y + 1, p.z, s, (Math.random() - 0.5) * 5, 3 + Math.random() * 3, (Math.random() - 0.5) * 5, 1.5, 600);
        this.inventory.slots[i] = null;
      }
    }
    this.inventory.touch();
    this.audio.play('death');
    this.exitLock();
    this.ui.setDeathInfo(`The player ${cause}.${lost ? ` Your belongings lie at ${Math.floor(p.x)}, ${Math.floor(p.y)}, ${Math.floor(p.z)}.` : ''}`);
    this.state = 'dead';
    this.ui.show('death');
    this.ui.showHUD(false);
    this.setCrack(null, -1);
    this.setFx(false, false);
    this.saveWorld(false);
  }

  async respawn() {
    const p = this.player;
    p.respawnReset();
    p.vy = 0;
    const sp = p.spawn || p.spawn0 || { x: 0.5, y: 80, z: 0.5 };
    p.x = sp.x; p.y = sp.y + 0.1; p.z = sp.z;
    this.ui.hideScreens();
    this.ui.showHUD(false);
    await this.waitForChunks(2, 'Respawning');
    const w = this.world;
    // make sure we're not inside terrain
    if (w.isSolid(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) || w.isSolid(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z))) {
      const spot = this.findSafeSpot(Math.floor(p.x), Math.floor(p.z));
      p.x = spot.x; p.y = spot.y; p.z = spot.z;
    }
    this.ui.hideLoading();
    this.state = 'playing';
    this.ui.hideScreens();
    this.ui.showHUD(true);
    this.ui.lastBars = '';
    this.requestLock();
    setTimeout(() => { if (this.state === 'playing' && !this.isLocked && !this.uiOpen) this.pause(); }, 700);
  }

  // ---- sleeping ---------------------------------------------------------------------------------------------------
  trySleep(x, y, z) {
    const p = this.player;
    if (this.sky.sunElev > -0.02) { this.ui.toastSimple('You can only sleep at night'); return; }
    for (const m of this.mobs.mobs) if (m.def.hostile && m.dying <= 0 && Math.hypot(m.x - p.x, m.z - p.z) < 14) { this.ui.toastSimple('You may not rest now, there are monsters nearby'); return; }
    if (this.sleeping) return;
    this.sleeping = true;
    this.clearInput();
    p.spawn = { x: x + 0.5, y: y + 1, z: z + 0.5 };
    this.audio.play('sleep');
    $('fx-black').classList.add('on');
    setTimeout(() => {
      this.worldTime = Math.floor(this.worldTime) + 1.02;
      this.day = Math.floor(this.worldTime) + 1;
      this.weather.clearWeather();
      this.advancements.grant('sleep');
      this.ui.toastSimple('Spawn point set');
      $('fx-black').classList.remove('on');
      setTimeout(() => { this.sleeping = false; }, 900);
    }, 1800);
  }

  // ---- fluids & world rules ---------------------------------------------------------------------------------------------
  scheduleLeafDecay(x, y, z) {
    const w = this.world;
    for (let dx = -5; dx <= 5; dx++) for (let dy = -5; dy <= 5; dy++) for (let dz = -5; dz <= 5; dz++) {
      const id = w.getBlock(x + dx, y + dy, z + dz);
      if (isLeaves(id) && !this.leafSupported(x + dx, y + dy, z + dz)) {
        this.leafQueue.push({ x: x + dx, y: y + dy, z: z + dz, t: this.time + 0.6 + Math.random() * 7 });
      }
    }
  }

  leafSupported(x, y, z) {
    const w = this.world;
    const seen = new Set([x + ',' + y + ',' + z]);
    let frontier = [[x, y, z]];
    for (let depth = 0; depth < 5; depth++) {
      const next = [];
      for (const [cx, cy, cz] of frontier) {
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const nx = cx + dx, ny = cy + dy, nz = cz + dz, k = nx + ',' + ny + ',' + nz;
          if (seen.has(k)) continue;
          seen.add(k);
          const id = w.getBlock(nx, ny, nz);
          if (isLog(id)) return true;
          if (isLeaves(id)) next.push([nx, ny, nz]);
        }
      }
      frontier = next;
      if (!frontier.length) break;
    }
    return false;
  }

  updateLeafDecay() {
    const q = this.leafQueue;
    for (let i = q.length - 1; i >= 0; i--) {
      const e = q[i];
      if (e.t > this.time) continue;
      q.splice(i, 1);
      const id = this.world.getBlock(e.x, e.y, e.z);
      if (!isLeaves(id) || this.leafSupported(e.x, e.y, e.z)) continue;
      const drops = dropsFor(id, Math.random, true);
      this.world.setBlock(e.x, e.y, e.z, 0);
      this.particles.breakBlock(e.x, e.y, e.z, id, 5);
      for (const [did, n] of drops) this.entities.spawnItem(e.x + 0.5, e.y + 0.4, e.z + 0.5, { id: did, count: n });
    }
  }

  randomTicks() {
    const w = this.world, p = this.player;
    for (let n = 0; n < 90; n++) {
      const x = Math.floor(p.x + (Math.random() - 0.5) * 44), z = Math.floor(p.z + (Math.random() - 0.5) * 44);
      const y = Math.floor(p.y + (Math.random() - 0.5) * 28);
      if (y < 1 || y >= CH - 1 || !w.isLoaded(x, z)) continue;
      const id = w.getBlock(x, y, z);
      if (id === B.GRASS) {
        if (OPACITY[w.getBlock(x, y + 1, z)] >= 15) w.setBlock(x, y, z, B.DIRT);
      } else if (id === B.DIRT) {
        if (w.getBlock(x, y + 1, z) === 0 || OPACITY[w.getBlock(x, y + 1, z)] === 0) {
          if (w.getSky(x, y + 1, z) >= 9) {
            for (let k = 0; k < 4; k++) {
              const dx = ((Math.random() * 3) | 0) - 1, dz = ((Math.random() * 3) | 0) - 1, dy = ((Math.random() * 3) | 0) - 1;
              if (w.getBlock(x + dx, y + dy, z + dz) === B.GRASS) { w.setBlock(x, y, z, B.GRASS); break; }
            }
          }
        }
      } else if (id === B.SAPLING && Math.random() < 0.25) this.growTree(x, y, z);
    }
  }

  growTree(x, y, z) {
    const w = this.world;
    for (let k = 1; k <= 6; k++) {
      const b = w.getBlock(x, y + k, z);
      if (b !== 0 && !isLeaves(b) && !(DEFS[b] && DEFS[b].plant)) return false;
    }
    const [t, h] = w.getClimate(x, z);
    const r = Math.random();
    const type = t < -0.3 ? 'spruce' : h > 0.1 && r < 0.4 ? 'birch' : 'oak';
    w.setBlock(x, y, z, B.DIRT);
    w.gen.placeTree(type, x, y, z, Math.random(), (wx, wy, wz, id) => {
      const cur = w.getBlock(wx, wy, wz);
      if (isLeaves(id)) { if (cur === 0 || (DEFS[cur] && DEFS[cur].plant)) w.setBlock(wx, wy, wz, id); }
      else if (cur === 0 || isLeaves(cur) || (DEFS[cur] && DEFS[cur].replaceable) || (DEFS[cur] && DEFS[cur].plant)) w.setBlock(wx, wy, wz, id);
    });
    w.setBlock(x, y - 1 + 0, z, w.getBlock(x, y - 1, z) === B.GRASS ? B.GRASS : B.DIRT);
    this.particles.crumbs(x + 0.5, y + 1, z + 0.5, 0.3, 0.8, 0.3, 14);
    return true;
  }

  useBoneMeal(t) {
    const w = this.world, p = this.player;
    let used = false;
    if (t.id === B.SAPLING) used = this.growTree(t.x, t.y, t.z);
    else if (t.id === B.GRASS) {
      for (let k = 0; k < 24; k++) {
        const x = t.x + Math.floor((Math.random() - 0.5) * 7), z = t.z + Math.floor((Math.random() - 0.5) * 7);
        for (let y = t.y + 2; y >= t.y - 2; y--) {
          if (w.getBlock(x, y, z) === B.GRASS && w.getBlock(x, y + 1, z) === 0) {
            w.setBlock(x, y + 1, z, Math.random() < 0.12 ? (Math.random() < 0.5 ? B.FLOWER_RED : B.FLOWER_YELLOW) : B.TALL_GRASS);
            used = true; break;
          }
        }
      }
      if (used) this.particles.crumbs(t.x + 0.5, t.y + 1.2, t.z + 0.5, 0.4, 0.9, 0.4, 12);
    }
    if (used) {
      p.swing();
      this.audio.play('pickup', { pitch: 1.5 });
      if (!p.creative) this.inventory.decrementHeld();
    }
  }

  // ---- explosions -----------------------------------------------------------------------------------------------------------
  explode(x, y, z, power, source) {
    const w = this.world, p = this.player;
    this.audio.play('explode', { pos: [x, y, z], vol: 1 });
    this.particles.explosion(x, y, z, power / 3);
    const R = Math.ceil(power);
    const cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z);
    for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) {
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > power * (0.75 + Math.random() * 0.5)) continue;
      const bx = cx + dx, by = cy + dy, bz = cz + dz;
      if (by < 1) continue;
      const id = w.getBlock(bx, by, bz);
      if (!id || id === B.BEDROCK || LIQUID[id]) continue;
      if (id === B.TNT) {
        w.setBlock(bx, by, bz, 0);
        this.entities.spawnTNT(bx, by, bz, 0.4 + Math.random() * 0.9, (dx / (d || 1)) * 4, 3, (dz / (d || 1)) * 4);
        continue;
      }
      const be = w.getBE(bx, by, bz);
      if (be) { this.spillBlockEntity(bx, by, bz, be); w.removeBE(bx, by, bz); }
      if (Math.random() < 0.28) for (const [did, n] of dropsFor(id, Math.random, true)) this.entities.spawnItem(bx + 0.5, by + 0.4, bz + 0.5, { id: did, count: n });
      w.setBlock(bx, by, bz, 0);
    }
    // entities
    const reach = power * 2;
    for (const m of this.mobs.mobs) {
      if (m === source || m.dying > 0) continue;
      const dx = m.x - x, dz = m.z - z, d = Math.hypot(dx, m.y + m.h / 2 - y, dz);
      if (d < reach) m.hurt((1 - d / reach) * 22, (dx / (d || 1)) * 1.6, (dz / (d || 1)) * 1.6, false);
    }
    const dx = p.x - x, dy = p.y + 0.9 - y, dz = p.z - z, d = Math.hypot(dx, dy, dz);
    if (d < reach) {
      this.damagePlayer((1 - d / reach) * 20, 'was blown up', dx / (d || 1), dz / (d || 1), 9);
      this.advancements.grant('boom');
    }
    this.shake = Math.max(this.shake, clamp(1 - d / 24, 0, 1));
  }

  // ---- block entities (furnaces) ----------------------------------------------------------------------------------------------
  tickBlockEntities(dt) {
    const w = this.world;
    for (const [key, be] of w.blockEntities) {
      if (be.type !== 'furnace') continue;
      const [x, y, z] = key.split(',').map(Number);
      if (!w.isLoaded(x, z)) continue;
      const rec = be.input ? SMELTING.get(be.input.id) : null;
      const canSmelt = !!rec && (!be.output || (be.output.id === rec[0] && be.output.count + rec[1] <= maxStack(rec[0])));
      if (be.burn <= 0 && canSmelt && be.fuel) {
        const t = fuelTime(be.fuel.id);
        if (t > 0) {
          be.burn = be.burnMax = t;
          be.fuel.count--;
          if (be.fuel.count <= 0) be.fuel = null;
        }
      }
      let lit = false;
      if (be.burn > 0) {
        lit = true;
        be.burn = Math.max(0, be.burn - dt);
        if (canSmelt) {
          be.cook += dt;
          if (be.cook >= 8) {
            be.cook = 0;
            if (be.output) be.output.count += rec[1]; else be.output = { id: rec[0], count: rec[1] };
            be.input.count--;
            if (be.input.count <= 0) be.input = null;
          }
        } else be.cook = Math.max(0, be.cook - dt * 2);
      } else be.cook = Math.max(0, be.cook - dt * 2);
      const cur = w.getBlock(x, y, z);
      const want = lit ? B.FURNACE_LIT : B.FURNACE;
      if ((cur === B.FURNACE || cur === B.FURNACE_LIT) && cur !== want) w.setBlock(x, y, z, want, w.getMeta(x, y, z), { silent: true });
      if (lit && Math.random() < dt * 3) this.particles.smoke(x + 0.5, y + 1.05, z + 0.5, 1, 0.3, 0.1);
    }
  }

  // ---- fx ---------------------------------------------------------------------------------------------------------------------
  setFx(water, lava) {
    $('fx-water').classList.toggle('on', water);
    $('fx-lava').classList.toggle('on', lava);
  }

  syncFog(under, lava) {
    const S = this.shared;
    const sc = this.scene.fog;
    if (lava) { S.uFogColor.value.setRGB(1.0, 0.34, 0.05); S.uFogNear.value = 0.05; S.uFogFar.value = 3.2; }
    else if (under) {
      const day = 0.25 + this.sky.daylight * 0.75;
      S.uFogColor.value.setRGB(0.1 * day, 0.28 * day, 0.55 * day);
      S.uFogNear.value = 0.4; S.uFogFar.value = 18 + this.sky.daylight * 8;
    }
    sc.color.copy(S.uFogColor.value); sc.near = S.uFogNear.value; sc.far = S.uFogFar.value;
    this.renderer.setClearColor(S.uFogColor.value);
    this.sky.dome.visible = !under && !lava;
    this.sky.cloudMesh.visible = this.sky.cloudsOn && !under && !lava;
  }

  // ---- main loop -----------------------------------------------------------------------------------------------------------------
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.shared.uTime.value = this.time;
    // fps counter + adaptive resolution
    this.frames++; this.fpsT += dt;
    if (this.fpsT >= 0.5) {
      this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0;
      if (this.settings.showFps) $('fps').textContent = Math.round(this.fps) + ' FPS';
      if (this.fps < 28 && this.state === 'playing') { this.lowFpsT += 0.5; if (this.lowFpsT > 4 && this.pixelRatio > 0.7) { this.pixelRatio = Math.max(0.7, this.pixelRatio - 0.15); this.resize(); this.lowFpsT = 0; } } else this.lowFpsT = 0;
    }

    switch (this.state) {
      case 'menu': this.updateBackdrop(dt); break;
      case 'loading': this.stepLoading(); break;
      case 'playing': this.updatePlaying(dt); break;
      case 'paused': case 'dead': this.updateStatic(dt); break;
      default: break;
    }
    this.render();
  }

  updateStatic(dt) {
    // world is frozen but streaming and meshing may continue so edits made right before pausing finish
    if (this.world && this.player) this.world.update(this.player.x, this.player.z, 3, 0);
    if (this.state === 'dead') this.entities.update(dt * 0);
    this.particles.update(0);
  }

  updatePlaying(dt) {
    const p = this.player, w = this.world, cam = this.camera;
    // time of day
    this.worldTime += dt / DAY_LENGTH;
    this.day = Math.floor(this.worldTime) + 1;
    // fixed-step physics
    this.acc += dt;
    let steps = 0;
    while (this.acc >= 1 / 60 && steps < 6) { p.step(1 / 60); this.acc -= 1 / 60; steps++; }
    if (steps === 6) this.acc = 0;
    p.update(dt);
    p.updateSurvival(dt);
    this.advancements.stats.distance += p.distTravelled; p.distTravelled = 0;
    this.advancements.tick(dt);
    w.update(p.x, p.z, 6, dt);
    this.mobs.update(dt);
    this.entities.update(dt);
    this.particles.update(dt);
    this.weather.update(dt, cam);
    this.tickBlockEntities(dt);
    this.updateLeafDecay();
    this.randTick -= dt;
    if (this.randTick <= 0) { this.randTick = 0.25; this.randomTicks(); }
    this.saveTimer -= dt;
    if (this.saveTimer <= 0) { this.saveTimer = 45; this.saveWorld(false); }

    // camera
    const bob = this.settings.bobbing ? p.bobAmp : 0;
    const bobY = Math.abs(Math.sin(p.bobPhase * 0.5)) * 0.045 * bob, bobX = Math.cos(p.bobPhase * 0.5) * 0.03 * bob;
    const eye = p.eyeH;
    this.shake = Math.max(0, this.shake - dt * 1.4);
    const sx = (Math.random() - 0.5) * this.shake * 0.25, sy = (Math.random() - 0.5) * this.shake * 0.25;
    cam.position.set(p.x + Math.cos(p.yaw) * bobX + sx, p.y + eye - bobY + sy, p.z - Math.sin(p.yaw) * bobX);
    this.hurtTilt *= Math.max(0, 1 - dt * 6);
    cam.rotation.set(p.pitch, p.yaw, this.hurtTilt + Math.sin(p.bobPhase * 0.5) * 0.004 * bob);
    const targetFov = this.settings.fov + (p.sprinting ? 7 : 0) + (p.flying && p.sprinting ? 5 : 0);
    this.fovCur += (targetFov - this.fovCur) * Math.min(1, dt * 8);
    if (Math.abs(cam.fov - this.fovCur) > 0.05) { cam.fov = this.fovCur; cam.updateProjectionMatrix(); }

    // environment
    const wx = Math.floor(p.x), wz = Math.floor(p.z);
    this.sky.update(this.worldTime % 1, cam, this.weather, dt, w.rd, this.time);
    const underWater = p.headUnder, inLava = !!p.headLava;
    this.syncFog(underWater, inLava);
    this.setFx(underWater, inLava);
    if (p.dead) return;
    this.hand.update(dt, cam);
    this.audio.setUnderwater(underWater);
    const skyL = w.getSky(wx, Math.floor(p.y + 1), wz);
    const biome = w.getBiome(wx, wz);
    this.audio.setListener(cam.position.x, cam.position.y, cam.position.z, Math.cos(p.yaw), -Math.sin(p.yaw));
    this.audio.updateAmbient(dt, {
      rain: this.weather.rain * (this.weather.snowing ? 0.4 : 1), outdoors: Math.min(1, skyL / 14), underwater: underWater, altitude: p.y,
      underground: skyL < 3 && p.y < 56 && !underWater, day: this.sky.daylight, grassy: biome === BIOME.PLAINS || biome === BIOME.FOREST || biome === BIOME.BIRCH,
      pos: [p.x, p.y, p.z],
    });
    this.updateSelection();
    this.ui.updateHUD();
    if (this.uiOpen) this.ui.updateContainer();
    $('crosshair').classList.toggle('hit', !!p.mobTarget);
    this.updateHint();
    this.updateDebug();
  }

  updateHint() {
    const p = this.player, t = p.target;
    let text = '';
    if (t && !this.uiOpen) {
      const d = DEFS[t.id];
      if (d.ui === 'bed') text = this.sky.sunElev < -0.02 ? 'Right-click to sleep' : '';
    }
    if (text !== this.lastHint) { this.lastHint = text; this.ui.setHint(text); }
  }

  updateDebug() {
    const dbg = $('debug');
    if (dbg.classList.contains('hidden')) return;
    const p = this.player, w = this.world;
    const wx = Math.floor(p.x), wy = Math.floor(p.y), wz = Math.floor(p.z);
    const lr = w.getLightRaw(wx, wy, wz);
    const dirs = ['south', 'west', 'north', 'east'];
    const face = dirs[Math.round((((p.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2)) % 4];
    const tod = this.worldTime % 1;
    const hh = Math.floor(((tod + 0.25) % 1) * 24), mm = Math.floor((((tod + 0.25) % 1) * 24 - hh) * 60);
    dbg.textContent = [
      `Blockhaven · ${Math.round(this.fps)} fps`,
      `XYZ ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,
      `Block ${wx} ${wy} ${wz}  Chunk ${wx >> 4} ${wz >> 4}  Facing ${face}`,
      `Biome ${BIOME_NAMES[w.getBiome(wx, wz)]}  Light sky ${lr >> 4} block ${lr & 15}`,
      `Day ${this.day}  ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  Weather ${this.weather.rain > 0.1 ? (this.weather.storm ? 'storm' : this.weather.snowing ? 'snow' : 'rain') : 'clear'}`,
      `Chunks ${w.stats.chunks} (${w.stats.meshed} meshed)  Mobs ${this.mobs.mobs.length}  Items ${this.entities.items.length}`,
      `Draw calls ${this.renderer.info.render.calls}  Tris ${(this.renderer.info.render.triangles / 1000).toFixed(0)}k`,
      `Seed ${w.seed}  ${p.creative ? 'Creative' : 'Survival'}${p.flying ? ' (flying)' : ''}`,
    ].join('\n');
  }

  render() {
    const r = this.renderer;
    r.clear();
    r.render(this.scene, this.camera);
    if (this.state === 'playing' && !this.player.dead) this.hand.render(r);
    if (this.wantThumb && this.state === 'playing') {
      this.wantThumb -= 1;
      if (this.wantThumb <= 0) { this.wantThumb = 0; this.captureThumb(); }
    } else if (this.wantThumb === 1 && this.state !== 'playing') { this.captureThumb(); this.wantThumb = 0; }
  }
}

function $(id) { return document.getElementById(id); }
