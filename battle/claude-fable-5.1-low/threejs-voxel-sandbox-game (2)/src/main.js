import * as THREE from 'three';
import { buildAtlas } from './game/textures.js';
import { createMaterials } from './game/shaders.js';
import { setAtlasRows } from './game/mesher.js';
import { setDropAtlasRows, Drops } from './game/drops.js';
import { World } from './game/world.js';
import { Player } from './game/player.js';
import { Inventory } from './game/inventory.js';
import { Mobs } from './game/mobs.js';
import { Particles } from './game/particles.js';
import { Environment } from './game/environment.js';
import { AudioSys } from './game/audio.js';
import { UI } from './game/ui.js';
import { B, I, BLOCKS } from './game/blocks.js';
import { hashString } from './game/noise.js';
import { CX } from './game/worldgen.js';
import { createWorldMeta, updateWorldMeta, saveWorldData, loadWorldData, loadSettings, saveSettings } from './game/save.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 600);
    this.scene.add(this.camera);
    this.settings = loadSettings();
    this.atlas = buildAtlas();
    setAtlasRows(this.atlas.rows); setDropAtlasRows(this.atlas.rows);
    this.materials = createMaterials(this.atlas.texture);
    this.audio = new AudioSys();
    this.audio.setVolume(this.settings.volume);
    this.input = { keys: {}, mouse: { left: false, right: false } };
    this.state = 'menu';
    this.world = null; this.player = null; this.mode = 'survival'; this.day = 1; this.playtime = 0; this.autosaveT = 0; this.falling = [];
    this.ui = new UI(this);
    this.bindInput();
    this.ui.showMenu();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    addEventListener('resize', () => { this.renderer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); });
  }

  // ---------- input ----------
  bindInput() {
    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      this.input.keys[e.code] = true;
      if (this.state === 'inventory') { if (e.code === 'Escape' || e.code === 'KeyE') { e.preventDefault(); this.ui.closeInventory(); } return; }
      if (this.state !== 'playing') { if (e.code === 'Escape' && this.state === 'paused') this.resume(); return; }
      if (e.code === 'KeyE') { e.preventDefault(); this.ui.toggleInventory(); }
      else if (e.code.startsWith('Digit')) { const n = parseInt(e.code.slice(5)); if (n >= 1 && n <= 9) this.inventory.select(n - 1); }
      else if (e.code === 'KeyQ') this.player.dropHeld();
      else if (e.code === 'KeyF' && this.mode === 'creative') { this.player.flying = !this.player.flying; this.player.vel.y = 0; this.ui.message(this.player.flying ? 'Flying' : 'Walking'); }
      else if (e.code === 'Space' && this.mode === 'creative') { const now = performance.now(); if (now - this.player.lastJumpTap < 300) { this.player.flying = !this.player.flying; this.player.vel.y = 0; } this.player.lastJumpTap = now; }
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.input.keys[e.code] = false; });
    addEventListener('blur', () => { this.input.keys = {}; this.input.mouse.left = this.input.mouse.right = false; });
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state === 'playing' && document.pointerLockElement !== this.canvas) { this.lock(); return; }
      if (this.state !== 'playing') return;
      if (e.button === 0) this.input.mouse.left = true; if (e.button === 2) this.input.mouse.right = true;
      if (e.button === 1) { e.preventDefault(); this.pickBlock(); }
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.input.mouse.left = false; if (e.button === 2) this.input.mouse.right = false; });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (this.state !== 'playing' || document.pointerLockElement !== this.canvas) return;
      const s = 0.0022 * this.settings.sensitivity;
      this.player.yaw -= e.movementX * s; this.player.pitch -= e.movementY * s;
      this.player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.player.pitch));
    });
    addEventListener('wheel', (e) => { if (this.state !== 'playing') return; this.inventory.select(this.inventory.selected + (e.deltaY > 0 ? 1 : -1)); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.canvas && this.state === 'playing') this.pause();
    });
  }
  lock() { this.audio.init(); this.canvas.requestPointerLock && this.canvas.requestPointerLock(); }
  pickBlock() {
    const t = this.player.target; if (!t) return;
    const inv = this.inventory; const id = BLOCKS[t.block].drop === undefined ? t.block : t.block;
    const i = inv.slots.findIndex(s => s && s.id === id);
    if (i >= 0 && i < 9) inv.select(i);
    else if (i >= 9) { const tmp = inv.slots[inv.selected]; inv.slots[inv.selected] = inv.slots[i]; inv.slots[i] = tmp; inv.changed(); }
    else if (this.mode === 'creative') { inv.slots[inv.selected] = { id, count: 64 }; inv.changed(); }
  }

  // ---------- state ----------
  pause() { if (this.state !== 'playing') return; this.state = 'paused'; this.input.mouse.left = this.input.mouse.right = false; this.ui.showPause(); this.save(); }
  resume() { this.state = 'playing'; this.ui.hidePause(); this.lock(); }
  onUIOpen() { this.state = 'inventory'; this.input.mouse.left = this.input.mouse.right = false; document.exitPointerLock && document.exitPointerLock(); }
  onUIClose() { this.state = 'playing'; this.lock(); }
  onDeath(cause) { this.state = 'dead'; this.input.mouse.left = this.input.mouse.right = false; document.exitPointerLock && document.exitPointerLock(); this.ui.showDeath(cause); this.ui.updateStats(); }
  respawn() { this.player.respawn(); this.ui.hideDeath(); this.state = 'playing'; this.ui.updateStats(); this.lock(); }

  setRenderDistance(v) { if (this.world) { this.world.renderDistance = v; this.world.rebuildQueue(); } }
  saveSettings() { saveSettings(this.settings); }

  // ---------- world lifecycle ----------
  newWorld(name, seedStr, mode) {
    const seed = seedStr === '' ? Math.floor(Math.random() * 1e9) : (/^-?\d+$/.test(seedStr) ? parseInt(seedStr) : hashString(seedStr));
    const meta = createWorldMeta(name, seed, mode);
    this.startWorld(meta, null);
  }
  loadWorld(meta) { this.startWorld(meta, loadWorldData(meta.id)); }

  async startWorld(meta, data) {
    this.audio.init();
    this.meta = meta; this.mode = meta.mode; this.state = 'loading';
    this.ui.hide('menu'); this.ui.setLoading(0, 'Shaping terrain…');
    if (this.world) this.teardown();
    this.world = new World(this.scene, meta.seed, this.materials);
    this.world.renderDistance = this.settings.renderDistance;
    this.inventory = new Inventory();
    this.inventory.onChange = () => this.ui.renderHotbar();
    this.particles = new Particles(this.scene, this.atlas.canvas);
    this.drops = new Drops(this.scene, this.atlas.texture);
    this.mobs = new Mobs(this.scene, this.audio, this.particles, this.drops);
    this.env = new Environment(this.scene, this.audio);
    this.player = new Player(this);
    this.day = 1; this.playtime = meta.playtime || 0; this.falling = [];
    this.spawn = this.world.gen.findSpawn();
    if (data) {
      this.world.loadEdits(data.edits || {});
      this.inventory.load(data.inventory); this.env.load(data.env); this.player.load(data.player);
      this.day = data.day || 1; if (data.spawn) this.spawn = data.spawn;
    } else {
      this.player.setPosition(this.spawn.x, this.spawn.y, this.spawn.z);
      if (this.mode === 'creative') this.giveCreativeKit();
    }
    // preload chunks around player
    this.world.setCenter(this.player.pos.x, this.player.pos.z);
    const total = this.world.loadQueue.length;
    await new Promise(resolve => {
      const step = () => {
        const left = this.world.update(40);
        const tips = ['Shaping terrain…', 'Carving caves…', 'Planting forests…', 'Lighting the world…', 'Waking the animals…'];
        this.ui.setLoading(1 - left / Math.max(1, total), tips[Math.min(tips.length - 1, Math.floor((1 - left / Math.max(1, total)) * tips.length))]);
        if (left > 0) requestAnimationFrame(step); else resolve();
      };
      step();
    });
    // make sure player stands on ground (fresh worlds)
    if (!data) {
      let bx = Math.floor(this.player.pos.x), bz = Math.floor(this.player.pos.z);
      let sy = this.world.gen.column(bx, bz).height;
      // find a nearby column with clear sky above the ground (no trees / caves)
      outer: for (let r = 0; r < 12; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        const x = bx + dx, z = bz + dz, h = this.world.gen.column(x, z).height;
        if (this.world.isSolid(x, h, z) && !this.world.isSolid(x, h + 1, z) && !this.world.isSolid(x, h + 2, z) && this.world.getSky(x, h + 1, z) === 15) { bx = x; bz = z; sy = h; break outer; }
      }
      this.player.setPosition(bx + 0.5, sy + 1.01, bz + 0.5); this.spawn = { ...this.player.pos };
    }
    if (data) { this.mobs.load(data.mobs); this.drops.load(data.drops); }
    this.state = 'playing';
    this.ui.showGame();
    this.lock();
    this.ui.message(data ? `Welcome back to ${meta.name}` : (this.mode === 'creative' ? 'Creative mode — press F or double-tap Space to fly' : 'Punch trees to gather wood. Build shelter before night!'), 4000);
    this.autosaveT = 0;
  }
  giveCreativeKit() {
    const ids = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.LEAVES, B.GLASS, B.TORCH, B.SAND, B.SANDSTONE, B.BRICKS, B.STONE_BRICKS, B.WOOL, B.GLOWSTONE, B.CRAFTING_TABLE, B.FURNACE, B.BOOKSHELF, B.FENCE, B.LADDER, B.BIRCH_LOG, B.SPRUCE_LOG, B.SNOW, B.ICE, B.CACTUS, B.PUMPKIN, B.JACK_O_LANTERN, B.OBSIDIAN, B.MOSSY_COBBLE, B.CLAY, B.GRAVEL, B.FLOWER_RED, B.FLOWER_YELLOW, B.TALL_GRASS, B.WATER, B.LAVA];
    ids.forEach((id, i) => { if (i < 36) this.inventory.slots[i] = { id, count: 64 }; });
    this.inventory.changed();
  }
  teardown() {
    this.world.dispose(); this.mobs.clear(); this.drops.clear();
    this.scene.remove(this.particles.points);
    for (const o of [this.env.sky, this.env.sun, this.env.moon, this.env.stars, this.env.clouds, this.env.hemi, this.env.dir, this.env.rain]) this.scene.remove(o);
    this.scene.remove(this.player.outline, this.player.crack); this.camera.remove(this.player.heldGroup);
  }
  save() {
    if (!this.world || !this.meta) return;
    const data = { edits: this.world.serializeEdits(), inventory: this.inventory.serialize(), player: this.player.serialize(), env: this.env.serialize(), mobs: this.mobs.serialize(), drops: this.drops.serialize(), day: this.day, spawn: this.spawn };
    const ok = saveWorldData(this.meta.id, data);
    updateWorldMeta(this.meta.id, { played: Date.now(), playtime: this.playtime });
    if (!ok) this.ui.message('Save failed — storage full', 3000);
    return ok;
  }
  quitToMenu() {
    this.save(); this.state = 'menu'; document.exitPointerLock && document.exitPointerLock();
    this.teardown(); this.world = null;
    this.ui.showMenu();
  }

  // falling sand/gravel
  scheduleFall(x, y, z) { this.falling.push({ x, y, z, t: 0 }); }
  updateFalling(dt) {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i]; f.t += dt; if (f.t < 0.12) continue; f.t = 0;
      const id = this.world.getBlock(f.x, f.y, f.z);
      if (id !== B.SAND && id !== B.GRAVEL) { this.falling.splice(i, 1); continue; }
      const below = this.world.getBlock(f.x, f.y - 1, f.z);
      if (below === B.AIR || BLOCKS[below].liquid || (BLOCKS[below].shape === 'cross' && !BLOCKS[below].solid)) {
        this.world.setBlock(f.x, f.y, f.z, B.AIR); this.world.setBlock(f.x, f.y - 1, f.z, id); f.y--;
        const above = this.world.getBlock(f.x, f.y + 2, f.z); if (above === B.SAND || above === B.GRAVEL) this.scheduleFall(f.x, f.y + 2, f.z);
      } else { this.falling.splice(i, 1); this.audio.blockSound('place', id); }
    }
  }

  // ---------- main loop ----------
  loop(t) {
    requestAnimationFrame((n) => this.loop(n));
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    if (!this.world || this.state === 'menu' || this.state === 'loading') return;
    const active = this.state === 'playing';
    const simDt = active || this.state === 'inventory' ? dt : 0;
    const p = this.player;
    this.world.setCenter(p.pos.x, p.pos.z);
    this.world.update(active ? 7 : 12);
    if (simDt > 0) {
      this.playtime += simDt;
      const prevTime = this.env.time;
      const cold = this.world.gen.column(Math.floor(p.pos.x), Math.floor(p.pos.z)).t < 0.3;
      this.env.update(simDt, this.camera, p, this.world, cold);
      if (this.env.time < prevTime) { this.day++; this.ui.message(`Day ${this.day}`); }
      const inputs = active ? this.input : { keys: {}, mouse: { left: false, right: false } };
      p.update(simDt, inputs);
      this.mobs.update(simDt, this.world, p, this.env, this.mode);
      this.drops.update(simDt, this.world, p, (id, n) => { const left = this.inventory.add(id, n); if (left < n) this.audio.pickup(); return left; }, this.env.daylight);
      this.particles.update(simDt, this.world);
      this.updateFalling(simDt);
      this.autosaveT += simDt; if (this.autosaveT > 45) { this.autosaveT = 0; this.save(); }
    } else { p.updateCamera(dt); this.env.update(0, this.camera, p, this.world, false); }
    // uniforms / fog
    const u = this.materials.uniforms; const rd = this.world.renderDistance * CX;
    u.daylight.value = this.env.daylight; u.time.value = t / 1000;
    const night = 1 - THREE.MathUtils.smoothstep(this.env.daylight, 0.15, 0.7);
    u.skyTint.value.setRGB(1 - night * 0.25, 1 - night * 0.18, 1);
    if (p.underwater) { u.fogNear.value = 1; u.fogFar.value = 18 + 10 * this.env.daylight; }
    else { u.fogFar.value = rd - 6; u.fogNear.value = (rd - 6) * (this.env.raining ? 0.45 : 0.68); }
    u.fogColor.value.copy(this.env.fogColor);
    this.particles.mat.uniforms.fogColor.value.copy(this.env.fogColor); this.particles.mat.uniforms.fogNear.value = u.fogNear.value; this.particles.mat.uniforms.fogFar.value = u.fogFar.value;
    this.renderer.setClearColor(this.env.fogColor);
    this.ui.tick();
    this.renderer.render(this.scene, this.camera);
  }
}

window.game = new Game();
void I;
import { computeLight as __cl } from './game/lighting.js';
import { meshChunk as __mc } from './game/mesher.js';
window.game.__cl = __cl; window.game.__mc = __mc;
