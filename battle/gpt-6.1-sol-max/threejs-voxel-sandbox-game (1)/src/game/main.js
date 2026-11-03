import * as THREE from 'three';
import { VoxelWorld } from './world.js';
import { Player } from './player.js';
import { Environment, Particles } from './environment.js';
import { GameAudio } from './audio.js';
import { GameUI } from './ui.js';
import { B, I, BLOCKS, RECIPES, isSolid, itemName } from './blocks.js';
import { createWorld, loadSettings, saveSettings, saveWorld } from './storage.js';

class WildwoodGame {
  constructor(host) {
    this.host = host; this.settings = loadSettings(); this.data = createWorld();
    this.mode = 'loading'; this.hasSession = false; this.keys = {}; this.listeners = []; this.destroyed = false;
    this.mouseLeft = false; this.mouseRight = false; this.mining = 0; this.mineKey = ''; this.placeCooldown = 0;
    this.visualTime = 0; this.accumulator = 0; this.lastTime = 0; this.lastHud = 0; this.lastSave = 0;
    this.lastStream = ''; this.lastDamage = -100; this.breath = 0; this.lastRegen = 0; this.touchLook = null;
    this.audio = new GameAudio(this.settings.volume); this.ui = new GameUI(host, this);
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      host.querySelector('.loading-screen').innerHTML = '<h2>A little more graphics power is needed.</h2><p>Wildwood needs WebGL. Please enable hardware acceleration or try a current version of Chrome, Edge, Firefox, or Safari.</p>';
      return;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = this.settings.shadows; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0xc7ddce); this.renderer.domElement.setAttribute('aria-label', 'Interactive voxel world');
    this.renderer.domElement.tabIndex = -1; this.ui.viewport.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(this.settings.fov, 1, 0.08, 480); this.scene.add(this.camera);
    this.resize(); this.bindEvents();
    this.initTimer = setTimeout(() => {
      if (this.destroyed) return;
      try {
        this.buildWorld(this.data); this.mode = 'title'; this.setMenuCamera(0); this.ui.ready();
        this.animation = requestAnimationFrame(t => this.frame(t));
      } catch (error) {
        console.error(error); this.host.querySelector('.loading-screen p').textContent = 'The world could not be loaded. Please refresh to try again.';
      }
    }, 60);
    window.__wildwood = this;
  }

  buildWorld(data) {
    this.world?.dispose(); this.environment?.dispose(); this.particles?.dispose();
    this.selection && this.scene.remove(this.selection); this.cracks && this.scene.remove(this.cracks); this.held && this.camera.remove(this.held);
    this.selection?.geometry.dispose(); this.selection?.material.dispose(); this.cracks?.geometry.dispose(); this.cracks?.material.map?.dispose(); this.cracks?.material.dispose();
    this.data = data;
    this.data.stats = { broken: 0, placed: 0, crafted: 0, wood: 0, distance: 0, biomes: ['Meadow'], recipes: [], rewards: [], ...data.stats };
    this.world = new VoxelWorld(this.scene, data.seed, data.changes || {}, this.settings.distance);
    const start = data.position || [6, 30, 20]; this.world.initialize(start[0], start[2]);
    this.player = new Player(this.world, data.position ? new THREE.Vector3(...data.position) : this.world.findSpawn());
    if (data.rotation) { this.player.yaw = data.rotation[0]; this.player.pitch = data.rotation[1]; }
    this.player.health = data.health ?? 10; this.player.stamina = data.stamina ?? 100;
    if (this.player.health <= 0) { this.player.health = 10; this.player.position.copy(this.world.findSpawn()); }
    if (this.player.collides()) { this.player.position.copy(this.world.findSpawn()); }
    this.player.onStep = water => this.audio.step(water);
    this.player.onLand = damage => this.damage(damage);
    this.environment = new Environment(this.scene, this.renderer, this.camera, this.world, this.settings);
    this.particles = new Particles(this.scene);
    this.selection = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006)), new THREE.LineBasicMaterial({ color: 0xffffe7, transparent: true, opacity: 0.75 }));
    this.selection.visible = false; this.scene.add(this.selection);
    const crackCanvas = document.createElement('canvas'); crackCanvas.width = 64; crackCanvas.height = 64;
    const ctx = crackCanvas.getContext('2d'); ctx.strokeStyle = '#27392a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(32, 32); ctx.lineTo(20, 21); ctx.lineTo(23, 9); ctx.moveTo(20, 21); ctx.lineTo(7, 18); ctx.lineTo(0, 9);
    ctx.moveTo(32, 32); ctx.lineTo(43, 20); ctx.lineTo(42, 6); ctx.moveTo(43, 20); ctx.lineTo(60, 15);
    ctx.moveTo(32, 32); ctx.lineTo(27, 45); ctx.lineTo(12, 51); ctx.lineTo(7, 64); ctx.moveTo(27, 45); ctx.lineTo(34, 62);
    ctx.moveTo(32, 32); ctx.lineTo(48, 42); ctx.lineTo(54, 58); ctx.moveTo(48, 42); ctx.lineTo(64, 40); ctx.stroke();
    this.cracks = new THREE.Mesh(new THREE.BoxGeometry(1.009, 1.009, 1.009), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(crackCanvas), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    this.cracks.visible = false; this.scene.add(this.cracks); this.createHeldItem();
    this.lastSave = data.elapsed; this.lastStream = ''; this.mining = 0; this.breath = 0; this.visualTime = data.elapsed;
  }

  setMenuCamera(time) {
    this.camera.position.set(Math.sin(time * 0.055) * 0.65, 34 + Math.sin(time * 0.08) * 0.16, 50 + Math.cos(time * 0.055) * 0.65);
    this.camera.lookAt(18, 12, 0);
  }

  startWorld(data) {
    if (!data || this.mode === 'loading') return;
    this.audio.init(); this.requestLock();
    const same = data.id === this.data.id;
    const returning = !!data.position;
    this.hasSession = true;
    if (same) {
      this.mode = 'playing'; this.ui.showPlaying(); this.player.setCamera(this.camera, false); this.save(false);
      this.ui.toast(returning ? 'Welcome back. Your world is just as you left it.' : 'A fresh adventure. Make yourself at home.'); return;
    }
    this.mode = 'loading'; this.ui.showLoading('Finding your place in the world...');
    this.loadTimer = setTimeout(() => {
      if (this.destroyed) return;
      try {
        this.buildWorld(data); this.mode = 'playing'; this.ui.showPlaying(); this.ui.ready(); this.player.setCamera(this.camera, false); this.save(false);
        this.ui.toast(`Welcome to ${data.name}.`);
      } catch (error) { console.error(error); this.ui.ready(); this.mode = 'title'; this.hasSession = false; this.ui.showLanding(); this.ui.toast('This world could not be loaded. Try creating a fresh one.'); }
    }, 70);
  }

  openPanel() {
    if (this.mode === 'loading') return;
    this.mode = this.hasSession ? 'paused' : 'title'; this.clearInput(); this.mining = 0;
    if (document.pointerLockElement) document.exitPointerLock();
  }
  resume() {
    if (!this.hasSession) { this.mode = 'title'; this.ui.showLanding(); return; }
    this.mode = 'playing'; this.ui.showPlaying(); this.clearInput(); this.audio.init(); this.requestLock();
  }
  returnToTitle() {
    this.save(); this.hasSession = false; this.mode = 'title'; this.clearInput(); document.exitPointerLock?.();
    this.ui.showLanding(); this.selection.visible = false; this.cracks.visible = false; this.held.visible = false;
    this.world.stream(6, 20, true);
  }
  requestLock() {
    if (matchMedia('(pointer: coarse)').matches) return;
    if (document.pointerLockElement === this.renderer.domElement) return;
    try { const promise = this.renderer.domElement.requestPointerLock(); promise?.catch(() => this.pointerFallback()); } catch { this.pointerFallback(); }
  }
  pointerFallback() {
    if (this.lockNotice) return; this.lockNotice = true;
    this.ui.toast('Click and drag to look around. WASD still moves you.');
  }
  clearInput() { this.keys = {}; this.mouseLeft = false; this.mouseRight = false; this.dragLooking = false; }

  listen(target, event, fn, options) { target.addEventListener(event, fn, options); this.listeners.push(() => target.removeEventListener(event, fn, options)); }
  bindEvents() {
    const canvas = this.renderer.domElement;
    this.listen(window, 'resize', () => this.resize());
    this.listen(window, 'blur', () => { this.clearInput(); if (this.mode === 'playing') this.ui.open('pause'); });
    this.listen(document, 'visibilitychange', () => { if (document.hidden) { this.save(false); if (this.mode === 'playing') this.ui.open('pause'); } });
    this.listen(window, 'beforeunload', () => this.save(false));
    this.listen(this.host, 'contextmenu', e => e.preventDefault());
    this.listen(document, 'pointerlockchange', () => { if (!document.pointerLockElement && this.mode === 'playing') this.ui.open('pause'); });
    this.listen(document, 'pointerlockerror', () => this.pointerFallback());
    this.listen(document, 'keydown', e => this.keyDown(e));
    this.listen(document, 'keyup', e => { this.keys[e.code] = false; });
    this.listen(document, 'mousemove', e => {
      if (this.mode !== 'playing') return;
      if (Math.abs(e.movementX) > 150 || Math.abs(e.movementY) > 150) return;
      if (document.pointerLockElement === canvas || this.dragLooking) this.player.look(e.movementX, e.movementY, this.settings.sensitivity);
    });
    this.listen(canvas, 'mousedown', e => {
      if (this.mode !== 'playing') return;
      e.preventDefault(); this.audio.init();
      if (!document.pointerLockElement) { this.requestLock(); this.dragLooking = true; }
      if (e.button === 0) this.mouseLeft = true;
      if (e.button === 2) { this.mouseRight = true; this.placeCooldown = 0; }
    });
    this.listen(window, 'mouseup', e => { if (e.button === 0) this.mouseLeft = false; if (e.button === 2) this.mouseRight = false; this.dragLooking = false; });
    this.listen(canvas, 'wheel', e => { if (this.mode !== 'playing') return; e.preventDefault(); this.selectSlot((this.data.selected + (e.deltaY > 0 ? 1 : 8)) % 9); }, { passive: false });
    this.listen(canvas, 'pointerdown', e => { if (e.pointerType !== 'touch' || this.mode !== 'playing') return; this.touchLook = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
    this.listen(canvas, 'pointermove', e => { if (this.touchLook?.id !== e.pointerId || this.mode !== 'playing') return; this.player.look((e.clientX - this.touchLook.x) * 1.6, (e.clientY - this.touchLook.y) * 1.6, this.settings.sensitivity); this.touchLook.x = e.clientX; this.touchLook.y = e.clientY; });
    this.listen(canvas, 'pointerup', () => { this.touchLook = null; });
    const stick = this.host.querySelector('.touch-stick');
    const moveStick = e => {
      const rect = stick.getBoundingClientRect(), dx = (e.clientX - rect.left - rect.width / 2) / 35, dy = (e.clientY - rect.top - rect.height / 2) / 35;
      this.keys.KeyW = dy < -0.2; this.keys.KeyS = dy > 0.2; this.keys.KeyA = dx < -0.2; this.keys.KeyD = dx > 0.2;
      stick.querySelector('i').style.transform = `translate(${Math.max(-30, Math.min(30, dx * 30))}px,${Math.max(-30, Math.min(30, dy * 30))}px)`;
    };
    this.listen(stick, 'pointerdown', e => { this.stickId = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
    this.listen(stick, 'pointermove', e => { if (e.pointerId === this.stickId) moveStick(e); });
    const releaseStick = () => { this.stickId = null; this.keys.KeyW = this.keys.KeyS = this.keys.KeyA = this.keys.KeyD = false; stick.querySelector('i').style.transform = ''; };
    this.listen(stick, 'pointerup', releaseStick); this.listen(stick, 'pointercancel', releaseStick);
    for (const button of this.host.querySelectorAll('[data-touch]')) {
      this.listen(button, 'pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); const action = button.dataset.touch; if (action === 'break') this.mouseLeft = true; if (action === 'place') { this.mouseRight = true; this.placeCooldown = 0; } if (action === 'jump') this.keys.Space = true; if (action === 'interact') this.interact(); });
      this.listen(button, 'pointerup', () => { this.mouseLeft = this.mouseRight = false; this.keys.Space = false; });
      this.listen(button, 'pointercancel', () => { this.mouseLeft = this.mouseRight = false; this.keys.Space = false; });
    }
  }

  keyDown(e) {
    if (this.mode === 'loading') return;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if (e.code === 'Escape') {
      e.preventDefault(); if (this.ui.panel === 'death') return;
      if (this.ui.panel) this.ui.close(); else if (this.mode === 'playing') this.ui.open('pause');
      return;
    }
    if (e.code === 'Tab' && this.ui.panel) {
      const focusable = [...this.ui.modalRoot.querySelectorAll('button:not(:disabled), input, select')]; const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } return;
    }
    if (typing || e.repeat) return;
    if (this.ui.panel === 'death') return;
    if (this.hasSession && e.code === 'KeyE') { e.preventDefault(); if (this.ui.panel === 'inventory') this.ui.close(); else this.ui.open('inventory'); return; }
    if (this.hasSession && e.code === 'KeyJ') { e.preventDefault(); if (this.ui.panel === 'journal') this.ui.close(); else this.ui.open('journal'); return; }
    if (this.mode !== 'playing') return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'ControlLeft'].includes(e.code)) e.preventDefault();
    if (/^Digit[1-9]$/.test(e.code)) this.selectSlot(Number(e.code.slice(5)) - 1);
    if (e.code === 'KeyF') this.interact();
    if (e.code === 'KeyV' && this.data.mode === 'creative') { this.player.flying = !this.player.flying; this.player.velocity.set(0, 0, 0); this.ui.toast(this.player.flying ? 'A change of perspective. Space to rise, C to descend.' : 'Feet on the ground again.'); }
    this.keys[e.code] = true;
  }

  resize() {
    if (!this.renderer) return;
    const w = this.host.clientWidth || window.innerWidth, h = this.host.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  updateSetting(key, value) {
    this.settings[key] = value; saveSettings(this.settings);
    if (key === 'volume') { this.audio.init(); this.audio.setVolume(value); }
    if (key === 'fov') { this.camera.fov = value; this.camera.updateProjectionMatrix(); }
    if (key === 'shadows') { this.renderer.shadowMap.enabled = value; this.renderer.shadowMap.needsUpdate = true; this.scene.traverse(obj => { if (obj.material) obj.material.needsUpdate = true; }); }
    if (key === 'distance' && this.world) { this.world.distance = value; this.world.stream(this.hasSession ? this.player.position.x : 6, this.hasSession ? this.player.position.z : 20, true); }
  }

  selectSlot(index) {
    this.data.selected = index; this.mining = 0; this.ui.renderHotbar(); this.createHeldItem(); this.audio.ui();
  }
  createHeldItem() {
    if (!this.camera) return;
    if (this.held) { this.camera.remove(this.held); this.held.traverse(obj => { obj.geometry?.dispose(); obj.material?.dispose(); }); }
    this.held = new THREE.Group(); this.camera.add(this.held);
    const slot = this.data.inventory[this.data.selected], def = slot && BLOCKS[slot.id];
    const box = (sx, sy, sz, x, y, z, color) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshLambertMaterial({ color })); mesh.position.set(x, y, z); this.held.add(mesh); return mesh; };
    box(0.12, 0.3, 0.14, 0.02, -0.12, 0.08, 0x60775b);
    box(0.12, 0.12, 0.14, 0.02, 0.07, 0.08, 0xc5a380);
    if (def?.tool) { box(0.055, 0.49, 0.055, 0, 0.27, 0.02, 0x9b784a); box(0.32, 0.075, 0.065, 0.07, 0.48, 0.02, def.color); box(0.065, 0.16, 0.065, 0.25, 0.43, 0.02, def.color); }
    else if (slot?.id === B.TORCH) { box(0.055, 0.34, 0.055, 0, 0.23, 0, 0xa08155); const flame = box(0.08, 0.12, 0.08, 0, 0.44, 0, 0xffca74); flame.material.emissive.setHex(0xd79b38); }
    else if (def) { const cube = box(0.27, 0.27, 0.27, 0, 0.19, 0, def.color); cube.rotation.y = 0.3; }
    this.held.scale.setScalar(0.8); this.held.position.set(0.48, -0.42, -0.83); this.held.rotation.set(-0.12, -0.25, 0.12); this.held.visible = this.mode === 'playing';
  }

  itemCount(id) { return this.data.inventory.reduce((sum, slot) => sum + (slot?.id === id ? slot.count : 0), 0); }
  canAccept(id, count) {
    const max = BLOCKS[id]?.tool ? 1 : 64;
    let capacity = 0; for (const slot of this.data.inventory) capacity += !slot ? max : slot.id === id ? max - slot.count : 0;
    return capacity >= count;
  }
  addItem(id, count = 1, refresh = true) {
    if (!this.canAccept(id, count)) return false;
    const max = BLOCKS[id]?.tool ? 1 : 64;
    for (const slot of this.data.inventory) if (slot?.id === id && slot.count < max) { const add = Math.min(count, max - slot.count); slot.count += add; count -= add; if (!count) break; }
    while (count > 0) { const idx = this.data.inventory.findIndex(slot => !slot); if (idx < 0) return false; const add = Math.min(max, count); this.data.inventory[idx] = { id, count: add }; count -= add; }
    if (refresh) { this.ui.renderHotbar(); this.createHeldItem(); }
    return true;
  }
  removeItem(id, count) {
    for (let i = this.data.inventory.length - 1; i >= 0 && count > 0; i--) { const slot = this.data.inventory[i]; if (slot?.id !== id) continue; const take = Math.min(slot.count, count); slot.count -= take; count -= take; if (slot.count <= 0) this.data.inventory[i] = null; }
  }
  moveSlot(from, to) {
    if (from === to || !Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= 36 || to < 0 || to >= 36) return;
    const a = this.data.inventory[from], b = this.data.inventory[to]; if (!a) return;
    if (b?.id === a.id && !BLOCKS[a.id]?.tool) { const n = Math.min(a.count, 64 - b.count); b.count += n; a.count -= n; if (!a.count) this.data.inventory[from] = null; }
    else [this.data.inventory[from], this.data.inventory[to]] = [b, a];
    this.ui.renderHotbar(); this.createHeldItem();
  }
  quickMove(index) { const slot = this.data.inventory[index]; if (!slot) return; const start = index < 9 ? 9 : 0, end = index < 9 ? 36 : 9; let destination = -1; for (let i = start; i < end; i++) if (this.data.inventory[i]?.id === slot.id && this.data.inventory[i].count < 64) { destination = i; break; } if (destination < 0) for (let i = start; i < end; i++) if (!this.data.inventory[i]) { destination = i; break; } if (destination >= 0) this.moveSlot(index, destination); }
  nearBench() {
    if (!this.player) return false; const p = this.player.position;
    for (let y = Math.floor(p.y) - 2; y <= Math.floor(p.y) + 2; y++) for (let z = Math.floor(p.z) - 3; z <= Math.floor(p.z) + 3; z++) for (let x = Math.floor(p.x) - 3; x <= Math.floor(p.x) + 3; x++) if (this.world.getBlock(x, y, z) === B.BENCH) return true;
    return false;
  }
  canCraft(recipe) { return this.data.mode === 'creative' || ((!recipe.bench || this.nearBench()) && recipe.input.every(([id, count]) => this.itemCount(id) >= count)); }
  craft(id) {
    const recipe = RECIPES.find(r => r.id === id); if (!recipe || !this.canCraft(recipe)) return;
    if (!this.canAccept(recipe.out, recipe.count)) { this.ui.toast('Your backpack is full. Make a little room first.'); return; }
    if (this.data.mode !== 'creative') for (const [item, count] of recipe.input) this.removeItem(item, count);
    this.addItem(recipe.out, recipe.count); this.data.stats.crafted++; if (!this.data.stats.recipes.includes(id)) this.data.stats.recipes.push(id);
    this.audio.craft(); this.ui.toast(`${recipe.count} ${recipe.name.toLowerCase()}, made by you.`, 'check'); this.checkProgress();
  }

  interact() {
    const sheep = this.environment.sheep.find(s => s.group.position.distanceTo(this.player.position) < 3.5);
    if (sheep && this.itemCount(I.APPLE) > 0) {
      this.removeItem(I.APPLE, 1); sheep.happy = 6; sheep.moving = false; sheep.nextTurn = this.visualTime + 7;
      this.particles.burst(sheep.group.position.x, sheep.group.position.y + 1.5, sheep.group.position.z, '#e0a58c', 14, true);
      this.audio.craft(); this.ui.toast('A little kindness. A new woolly friend.', 'heart'); this.ui.renderHotbar(); return;
    }
    if (this.nearBench()) { this.ui.open('inventory'); return; }
    this.ui.toast('Use F beside a crafting table, or feed an apple to a sheep.');
  }

  breakBlock(hit) {
    const def = BLOCKS[hit.id]; if (hit.id === B.BEDROCK) return;
    let drop = def.drop ?? hit.id; if (hit.id === B.LEAVES && Math.random() < 0.18) drop = I.APPLE;
    if (drop && this.data.mode !== 'creative' && !this.canAccept(drop, 1)) { this.ui.toast('Your backpack is full. Free a slot with E.'); this.mouseLeft = false; return; }
    let replacement = 0;
    if (hit.y <= 14 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([x, z]) => this.world.getBlock(hit.x + x, hit.y, hit.z + z) === B.WATER)) replacement = B.WATER;
    this.world.setBlock(hit.x, hit.y, hit.z, replacement);
    const above = this.world.getBlock(hit.x, hit.y + 1, hit.z); if ([B.FLOWER, B.TUFT, B.TORCH].includes(above)) this.world.setBlock(hit.x, hit.y + 1, hit.z, 0);
    if (drop && this.data.mode !== 'creative') this.addItem(drop, 1);
    this.particles.burst(hit.x + 0.5, hit.y + 0.55, hit.z + 0.5, def.color, 22); this.audio.breakBlock();
    this.data.stats.broken++; if (hit.id === B.LOG) this.data.stats.wood++; this.checkProgress();
  }
  placeBlock(hit) {
    const slot = this.data.inventory[this.data.selected]; if (!slot) return;
    if (slot.id === I.APPLE) {
      if (this.player.health >= 10 && this.player.stamina > 95) { if (!this.eatNotice || this.visualTime - this.eatNotice > 4) { this.ui.toast('Save that apple for when you need a little energy.'); this.eatNotice = this.visualTime; } return; }
      this.player.health = Math.min(10, this.player.health + 4); this.player.stamina = Math.min(100, this.player.stamina + 40); if (this.data.mode !== 'creative') { slot.count--; if (!slot.count) this.data.inventory[this.data.selected] = null; }
      this.audio.craft(); this.ui.renderHotbar(); this.createHeldItem(); this.placeCooldown = 1; return;
    }
    if (!hit || BLOCKS[slot.id]?.item) return;
    const x = hit.x + hit.normal[0], y = hit.y + hit.normal[1], z = hit.z + hit.normal[2];
    if (y <= 0 || y >= 62 || this.player.intersectsBlock(x, y, z) || isSolid(this.world.getBlock(x, y, z))) return;
    if (!this.world.setBlock(x, y, z, slot.id)) return;
    if (this.data.mode !== 'creative') { slot.count--; if (!slot.count) this.data.inventory[this.data.selected] = null; }
    this.audio.place(); this.particles.burst(x + 0.5, y + 0.6, z + 0.5, BLOCKS[slot.id].color, 6);
    this.data.stats.placed++; this.ui.renderHotbar(); this.createHeldItem(); this.checkProgress();
  }
  updateInteraction(dt) {
    const direction = this.camera.getWorldDirection(new THREE.Vector3()); this.hit = this.world.raycast(this.camera.position, direction, this.data.mode === 'creative' ? 8 : 6);
    this.selection.visible = !!this.hit;
    if (this.hit) this.selection.position.set(this.hit.x + 0.5, this.hit.y + 0.5, this.hit.z + 0.5);
    const key = this.hit ? `${this.hit.x},${this.hit.y},${this.hit.z}` : '';
    if (this.mouseLeft && this.hit && this.hit.id !== B.BEDROCK) {
      if (key !== this.mineKey) { this.mining = 0; this.mineKey = key; }
      const def = BLOCKS[this.hit.id], held = this.data.inventory[this.data.selected];
      const tool = BLOCKS[held?.id]?.tool || 1;
      const duration = this.data.mode === 'creative' ? 0.13 : Math.max(0.12, def.hardness / ([B.STONE, B.COBBLE, B.COAL, B.COPPER, B.BRICK].includes(this.hit.id) ? tool : 1));
      this.mining += dt / duration;
      if (this.mining >= 1) { this.breakBlock(this.hit); this.mining = 0; }
      this.cracks.visible = true; this.cracks.position.copy(this.selection.position); this.cracks.material.opacity = Math.min(0.8, this.mining * 0.9);
    } else { this.mining = 0; this.cracks.visible = false; }
    this.placeCooldown -= dt;
    if (this.mouseRight && this.placeCooldown <= 0) { this.placeCooldown = 0.25; this.placeBlock(this.hit); }
    this.ui.updateTarget(this.hit, this.mining);
    this.held.visible = true;
    this.held.position.y = -0.42 + Math.sin(this.player.bob * 2) * 0.012;
    this.held.rotation.x = -0.12 - (this.mouseLeft ? Math.sin(this.visualTime * 18) * 0.22 : 0);
    this.held.rotation.z = 0.12 + (this.mouseLeft ? Math.sin(this.visualTime * 18) * 0.12 : 0);
  }

  damage(amount) {
    if (amount <= 0 || this.data.mode === 'creative' || this.visualTime - this.lastDamage < 0.65) return;
    this.lastDamage = this.visualTime; this.player.health = Math.max(0, this.player.health - amount); this.ui.damage(); this.audio.tone(90, 0.25, 0.15, 'triangle', 0, 45);
    if (this.player.health <= 0) this.ui.showDeath();
  }
  respawn() { this.player.position.copy(this.world.findSpawn()); this.player.velocity.set(0, 0, 0); this.player.health = 10; this.player.stamina = 100; this.breath = 0; this.save(false); }
  checkProgress() {
    const s = this.data.stats;
    const quests = [
      ['wood', s.wood >= 8, I.APPLE, 4, 'A good place to start'], ['bench', s.recipes.includes('bench'), I.COAL, 8, 'Made by you'],
      ['stonepick', s.recipes.includes('stonepick'), I.COPPER, 4, 'A little more possibility'], ['build', s.placed >= 30, B.GLASS, 16, 'Leave a little wonder'], ['explore', s.biomes.length >= 4, B.COPPER_BLOCK, 32, 'Beyond the familiar'],
    ];
    for (const [key, ready, id, count, name] of quests) if (ready && !s.rewards.includes(key) && this.canAccept(id, count)) { s.rewards.push(key); this.addItem(id, count); this.ui.toast(`Field note complete: ${name}. +${count} ${itemName(id).toLowerCase()}`, 'book'); this.audio.craft(); }
  }

  save(indicator = true) {
    if (!this.hasSession || !this.player) return false;
    this.data.position = this.player.position.toArray(); this.data.rotation = [this.player.yaw, this.player.pitch];
    this.data.health = this.player.health; this.data.stamina = this.player.stamina; this.data.changes = this.world.changes;
    const success = saveWorld(this.data); this.lastSave = this.data.elapsed;
    if (indicator && success) this.ui.saved();
    if (!success && !this.storageWarning) { this.storageWarning = true; this.ui.toast('Your browser could not save this world. Storage may be full or disabled.'); }
    return success;
  }

  frame(ms) {
    if (this.destroyed) return;
    this.animation = requestAnimationFrame(t => this.frame(t));
    const dt = Math.min(0.055, this.lastTime ? (ms - this.lastTime) / 1000 : 0.016); this.lastTime = ms; this.visualTime += dt;
    if (!this.world || !this.environment) return;
    if (this.mode === 'playing') {
      this.accumulator = Math.min(0.07, this.accumulator + dt);
      this.world.ensureNear(this.player.position.x, this.player.position.z);
      while (this.accumulator >= 1 / 90) { this.data.stats.distance += this.player.update(1 / 90, this.keys, this.data.mode === 'creative'); this.accumulator -= 1 / 90; }
      this.data.elapsed += dt; this.data.time = (this.data.time + dt / 720) % 1;
      this.player.setCamera(this.camera); this.updateInteraction(dt);
      this.world.stream(this.player.position.x, this.player.position.z);
      if (this.player.submerged) { this.breath += dt; if (this.breath > 12) this.damage(1); } else this.breath = Math.max(0, this.breath - dt * 3);
      if (this.visualTime - this.lastDamage > 20 && this.visualTime - this.lastRegen > 6 && this.player.stamina > 65 && this.player.health < 10) { this.player.health++; this.lastRegen = this.visualTime; }
      if (ms - this.lastHud > 240) {
        this.lastHud = ms; this.ui.updateHUD();
        if (this.data.elapsed > 25 || this.data.stats.distance > 12) this.host.querySelector('.first-hint').classList.add('dismissed');
        const biome = this.world.column(Math.floor(this.player.position.x), Math.floor(this.player.position.z)).biome;
        if (!this.data.stats.biomes.includes(biome)) { this.data.stats.biomes.push(biome); this.ui.toast(`A new discovery: ${biome}.`, 'compass'); this.checkProgress(); }
      }
      if (this.data.elapsed - this.lastSave > 30) this.save();
    } else {
      this.accumulator = 0; this.selection.visible = false; this.cracks.visible = false; this.held.visible = false;
      if (!this.hasSession) this.setMenuCamera(this.visualTime);
    }
    this.world.update(this.visualTime);
    this.environment.update(dt, this.visualTime, this.hasSession ? this.data.time : 0.34, this.mode === 'playing', this.mode === 'playing' && this.data.inventory[this.data.selected]?.id === B.TORCH);
    this.particles.update(dt); this.audio.update(this.visualTime, this.environment.daylight, this.environment.rain, this.mode === 'playing');
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.save(false); this.destroyed = true; cancelAnimationFrame(this.animation); clearTimeout(this.initTimer); clearTimeout(this.loadTimer);
    this.listeners.forEach(remove => remove()); this.ui.dispose(); this.world?.dispose(); this.environment?.dispose(); this.particles?.dispose();
    this.audio.destroy(); this.renderer?.dispose(); this.host.innerHTML = ''; if (window.__wildwood === this) delete window.__wildwood;
  }
}

export function mountGame(host) {
  const game = new WildwoodGame(host);
  return () => game.destroy();
}