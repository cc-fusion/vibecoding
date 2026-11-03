// End-to-End JSDOM + GameUI + Gameplay Integration Verification
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import * as THREE from 'three';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:5173/', pretendToBeVisual: true });

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Blob = dom.window.Blob;
globalThis.URL = dom.window.URL;

// Mock minimal 2D canvas context for buildIconDataUrls in headless JSDOM
dom.window.HTMLCanvasElement.prototype.getContext = function (type) {
  if (type === '2d') {
    return {
      imageSmoothingEnabled: false,
      fillStyle: '#fff',
      clearRect() {},
      fillRect() {},
      save() {},
      restore() {},
      transform() {},
      drawImage() {},
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData() {},
    };
  }
  return null;
};
dom.window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAA=';

const { GAME_MODES } = await import('../src/game/constants.js');
const { BLOCK, ITEM } = await import('../src/game/items.js');
const { buildTextureAtlas } = await import('../src/game/textures.js');
const { World } = await import('../src/game/world.js');
const { Inventory } = await import('../src/game/inventory.js');
const { Player } = await import('../src/game/player.js');
const { EntityManager } = await import('../src/game/entities.js');
const { ParticleSystem } = await import('../src/game/particles.js');
const { SkySystem } = await import('../src/game/sky.js');
const { SoundEngine } = await import('../src/game/audio.js');
const { WorldStorage } = await import('../src/game/storage.js');
const { GameUI } = await import('../src/game/ui.js');
const { createVoxelMaterials } = await import('../src/game/shader.js');

console.log('=== VoxelRealms JSDOM UI & End-to-End Gameplay Integration Test ===');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1.6, 0.1, 300);
scene.add(camera);
const { texture, iconUrls } = buildTextureAtlas();
const mats = createVoxelMaterials(texture);

// Build lightweight harness matching VoxelRealmsApp interface
const appHarness = {
  sound: new SoundEngine(),
  storage: new WorldStorage(),
  world: null,
  sky: new SkySystem(scene, mats.uniforms),
  particles: null,
  entities: null,
  inventory: null,
  player: null,
  gameMode: GAME_MODES.SURVIVAL,
  worldId: 'w_int_1',
  worldName: 'Test Valley',
  ui: null,
  requestLock() {},
  closeModalsAndLock() {
    this.ui.closeModals();
  },
  setGameMode(m) {
    this.gameMode = m;
    this.ui.renderStats();
  },
  async startNewWorld({ name, seed, mode }) {
    this.worldName = name;
    this.gameMode = mode;
    this.world = new World(null, null, seed);
    this.world.updateStreaming(0, 0, 1);
    this.particles = new ParticleSystem(scene);
    this.entities = new EntityManager(scene, this.world, this.particles, null);
    this.inventory = new Inventory();
    this.inventory.giveStarterKit(mode);
    this.player = new Player(camera, scene, this.world, this.inventory, this.entities, this.particles, null, texture);
    const sp = this.world.findSpawnPoint();
    this.player.pos.set(sp.x, sp.y, sp.z);
    this.inventory.onChange = () => this.ui.renderHotbar();
    this.player.onStatsChange = () => this.ui.renderStats();
    this.ui.showHUD();
    await this.saveCurrentWorld();
  },
  async saveCurrentWorld() {
    await this.storage.saveWorld({
      id: this.worldId,
      name: this.worldName,
      seed: this.world.seed,
      mode: this.gameMode,
      dayCount: this.sky.dayCount,
      timeOfDay: this.sky.timeOfDay,
      player: this.player.serialize(),
      inventory: this.inventory.serialize(),
      mods: this.world.exportMods(),
    });
  },
  async saveAndReturnToTitle() {
    await this.saveCurrentWorld();
    this.ui.showTitleScreen();
  },
};

const ui = new GameUI(appHarness, iconUrls);
appHarness.ui = ui;
ui.showTitleScreen();

// 1. Verify Title Screen clean state
assert(document.getElementById('saved-worlds-section').classList.contains('hidden'), 'Saved worlds section should be hidden when empty');
const oldSeed = document.getElementById('world-seed-input').value;
document.getElementById('random-seed-btn').click();
assert.notEqual(document.getElementById('world-seed-input').value, oldSeed, 'Random seed button should generate new seed');
console.log('1. ✓ Title screen & seed randomizer verified');

// 2. Click Create & Play
document.getElementById('create-world-btn').click();
await new Promise((r) => setTimeout(r, 30));
assert(document.getElementById('title-screen').classList.contains('hidden'), 'Title screen should hide on world start');
assert(!document.getElementById('hud').classList.contains('hidden'), 'HUD should appear on world start');
assert.equal(document.querySelectorAll('#hotbar .slot').length, 9, 'Hotbar should render 9 slots');
assert.equal(document.querySelectorAll('#hearts-bar .heart-icon').length, 10, 'Survival HUD should render 10 hearts');
console.log('2. ✓ World launch & HUD rendering verified');

// 3. Test Inventory Modal & Real DOM 1-Click Recipe Crafting
appHarness.inventory.addItem(BLOCK.OAK_LOG, 2);
ui.openInventory();
assert(!document.getElementById('inventory-modal').classList.contains('hidden'), 'Inventory modal should open');
assert.equal(document.querySelectorAll('#backpack-grid .slot').length, 27, 'Backpack should render 27 slots');

const craftBtns = [...document.querySelectorAll('#recipe-list .craft-action-btn:not(:disabled)')];
assert(craftBtns.length >= 1, 'Oak Planks recipe should be enabled after adding Oak Log');
craftBtns[0].click();
assert(appHarness.inventory.countMatching({ id: BLOCK.OAK_PLANKS }) >= 4, 'Clicking Craft button should craft 4 Oak Planks');
console.log('3. ✓ Inventory modal & 1-click DOM recipe crafting verified');

// 4. Test Creative Mode Tab & Creative Palette Click
appHarness.setGameMode(GAME_MODES.CREATIVE);
ui.openInventory();
assert(!document.getElementById('tab-creative').classList.contains('hidden'), 'Creative tab should appear in Creative mode');
document.getElementById('tab-creative').click();
const firstPaletteSlot = document.querySelector('#creative-grid .slot');
firstPaletteSlot.click();
assert(appHarness.inventory.countMatching({ id: BLOCK.GRASS }) >= 16, 'Clicking Creative Palette slot should grant blocks');
console.log('4. ✓ Creative mode palette verified');

// 5. Test Pick Block & Toss Item
const px = Math.floor(appHarness.player.pos.x);
const py = Math.floor(appHarness.player.pos.y + 1);
const pz = Math.floor(appHarness.player.pos.z - 2);
appHarness.world.setBlock(px, py, pz + 2, BLOCK.AIR, false);
appHarness.world.setBlock(px, py, pz + 1, BLOCK.AIR, false);
appHarness.world.setBlock(px, py, pz, BLOCK.DIAMOND_ORE, true);
appHarness.player.yaw = 0;
appHarness.player.pitch = 0;
appHarness.player.currentEyeH = 1.0;
const picked = appHarness.player.pickBlock(true);
assert(picked && appHarness.inventory.getSelected().id === BLOCK.DIAMOND_ORE, 'Pick Block in Creative should equip targeted block');

const dropsBefore = appHarness.entities.drops.length;
appHarness.player.tossSelectedItem(false);
assert.equal(appHarness.entities.drops.length, dropsBefore + 1, 'Toss item (Q) should spawn physics drop');
console.log('5. ✓ Pick Block & Toss Item verified');

// 6. Test Save & Return to Title populates Saved Worlds list
await appHarness.saveAndReturnToTitle();
await new Promise((r) => setTimeout(r, 30));
assert(!document.getElementById('saved-worlds-section').classList.contains('hidden'), 'Saved Worlds section should now be visible');
assert.equal(document.querySelectorAll('#saved-worlds-list .world-item').length, 1, 'Saved World item should appear in list');
console.log('6. ✓ Persistent World Manager UI verified');

console.log('\nALL JSDOM UI & INTEGRATION TESTS PASSED!');
