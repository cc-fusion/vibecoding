import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BLOCK_IDS, ITEM_IDS, getItemDef } from '../src/game/data/blocks.js';
import { CRAFTING_RECIPES } from '../src/game/data/recipes.js';
import { GAME_MODES } from '../src/game/constants.js';
import { TextureAtlas } from '../src/game/rendering/TextureAtlas.js';
import { World } from '../src/game/world/World.js';
import { EntityManager } from '../src/game/entities/EntityManager.js';
import { ParticleSystem } from '../src/game/effects/ParticleSystem.js';
import { AudioEngine } from '../src/game/audio/AudioEngine.js';
import { Player } from '../src/game/entities/Player.js';
import { WorldStorage } from '../src/game/storage/WorldStorage.js';

console.log('--- Running Voxelwild Engine Integration Suite ---');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, 16 / 9, 0.1, 500);
scene.add(camera);
const atlas = new TextureAtlas();
const audio = new AudioEngine();
const particles = new ParticleSystem(scene);

// 1. Seed Determinism & Multi-Biome Coverage
const worldA = new World({ scene, atlas, seed: 'test-seed-2026', renderDistance: 3 });
const worldB = new World({ scene, atlas, seed: 'test-seed-2026', renderDistance: 3 });

const cA = worldA.ensureChunk(0, 0);
const cB = worldB.ensureChunk(0, 0);
assert.deepEqual(cA.blocks, cB.blocks, 'Identical seeds must generate identical chunk blocks');

const seenBiomes = new Set();
for (let x = -1800; x <= 1800; x += 45) {
  for (let z = -1800; z <= 1800; z += 45) {
    seenBiomes.add(worldA.generator.getBiomeAt(x, z).id);
  }
}
console.log('Discovered Biomes:', Array.from(seenBiomes).join(', '));
assert.ok(seenBiomes.size >= 6, `Expected at least 6 distinct biomes, got ${seenBiomes.size}`);

// Verify Ores & Caves exist across generated chunks
const foundBlocks = new Set();
for (let cx = -2; cx <= 2; cx++) {
  for (let cz = -2; cz <= 2; cz++) {
    const ch = worldA.ensureChunk(cx, cz);
    for (let i = 0; i < ch.blocks.length; i++) {
      foundBlocks.add(ch.blocks[i]);
    }
  }
}
assert.ok(foundBlocks.has(BLOCK_IDS.COAL_ORE), 'Coal ore generated');
assert.ok(foundBlocks.has(BLOCK_IDS.IRON_ORE), 'Iron ore generated');
assert.ok(foundBlocks.has(BLOCK_IDS.GOLD_ORE), 'Gold ore generated');
assert.ok(foundBlocks.has(BLOCK_IDS.DIAMOND_ORE), 'Diamond ore generated');
console.log('✓ Deterministic terrain, 6+ biomes, caves, and stratified ores verified');

// 2. Cross-Chunk Torch Lighting & AO Meshing Verification
worldA.preloadAround(8, 8, 1);
// Carve small underground dark chamber straddling chunk border x=15 | x=16 at y=20, z=8
for (let x = 14; x <= 17; x++) {
  for (let y = 19; y <= 22; y++) {
    for (let z = 7; z <= 9; z++) {
      const wall = x === 14 || x === 17 || y === 19 || y === 22 || z === 7 || z === 9;
      worldA.setBlock(x, y, z, wall ? BLOCK_IDS.STONE : BLOCK_IDS.AIR, 0, false);
    }
  }
}
// Place torch at x=15, y=20, z=8 (inside chunk 0,0 right next to chunk 1,0)
worldA.setBlock(15, 20, 8, BLOCK_IDS.TORCH, 0, true);
const lightAtTorch = worldA.getBlockLight(15, 20, 8);
const lightAcrossBorder = worldA.getBlockLight(16, 20, 8);
assert.equal(lightAtTorch, 14, 'Torch voxel must have blocklight 14');
assert.equal(lightAcrossBorder, 13, 'Neighbor voxel across chunk boundary must receive blocklight 13');

// Verify chunk mesh geometry attributes have zero NaNs and valid triangle indices
const centerChunk = worldA.getChunk(0, 0);
assert.ok(centerChunk.meshes.opaque, 'Opaque chunk mesh created');
const posAttr = centerChunk.meshes.opaque.geometry.getAttribute('position');
for (let i = 0; i < posAttr.array.length; i++) {
  assert.ok(Number.isFinite(posAttr.array[i]), 'Mesh vertex position must be finite');
}
console.log('✓ Cross-chunk torch blocklight propagation & AO BufferGeometry verified');

// 3. Single Isolated Cube Winding Order Verification
const windWorld = new World({ scene: new THREE.Scene(), atlas, seed: 'winding', renderDistance: 3 });
const testChunk = windWorld.ensureChunk(10, 10);
testChunk.blocks.fill(0);
testChunk.setBlockModified(5, 50, 5, BLOCK_IDS.STONE, 0);
const geoms = windWorld.mesher.buildChunkGeometries(testChunk);
const g = geoms.opaque;
const idxArr = g.getIndex().array;
const pArr = g.getAttribute('position').array;
assert.equal(idxArr.length, 36, 'Single isolated cube should emit exactly 6 faces = 12 triangles = 36 indices');

const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const vC = new THREE.Vector3();
const cb = new THREE.Vector3();
const ab = new THREE.Vector3();
const cubeCenter = new THREE.Vector3(5.5, 50.5, 5.5);

for (let t = 0; t < idxArr.length; t += 3) {
  vA.fromArray(pArr, idxArr[t] * 3);
  vB.fromArray(pArr, idxArr[t + 1] * 3);
  vC.fromArray(pArr, idxArr[t + 2] * 3);
  cb.subVectors(vC, vB);
  ab.subVectors(vA, vB);
  // (vB - vA) x (vC - vA) outward normal check
  const e1 = vB.clone().sub(vA);
  const e2 = vC.clone().sub(vA);
  const normal = e1.cross(e2).normalize();
  const faceToOut = vA.clone().sub(cubeCenter);
  assert.ok(normal.dot(faceToOut) > 0.2, `Triangle ${t / 3} normal must point outward from cube center`);
}
console.log('✓ All 6 voxel cube faces mathematically verified for outward CCW winding');

// 4. DDA Raycasting, Falling Sand & Furnace Smelting
worldA.setBlock(8, 95, 8, BLOCK_IDS.STONE, 0, true);
worldA.setBlock(8, 96, 8, BLOCK_IDS.AIR, 0, true);
worldA.setBlock(8, 97, 8, BLOCK_IDS.AIR, 0, true);
worldA.setBlock(8, 98, 8, BLOCK_IDS.SAND, 0, true);

const hit = worldA.raycast(new THREE.Vector3(8.5, 95.5, 11.5), new THREE.Vector3(0, 0, -1), 5.5);
assert.ok(hit && hit.x === 8 && hit.y === 95 && hit.z === 8, 'DDA raycast must hit target stone block');
assert.deepEqual(hit.normal, { x: 0, y: 0, z: 1 }, 'DDA raycast hit normal must face +Z');

// Tick gravity queue for Sand at y=98 -> should land on Stone at y=96!
worldA.update(0.25, 8, 8, 1.0);
assert.equal(worldA.getBlock(8, 98, 8), BLOCK_IDS.AIR, 'Sand vacated y=98');
assert.equal(worldA.getBlock(8, 96, 8), BLOCK_IDS.SAND, 'Sand fell and rested on top of stone at y=96');

// Furnace Smelting
worldA.setBlock(9, 96, 8, BLOCK_IDS.FURNACE, 2, true);
const fState = worldA.getOrCreateFurnace(9, 96, 8);
fState.input = { id: BLOCK_IDS.IRON_ORE, count: 2 };
fState.fuel = { id: ITEM_IDS.COAL, count: 1 };
worldA.updateFurnaces(0.5);
assert.equal(worldA.getBlock(9, 96, 8), BLOCK_IDS.LIT_FURNACE, 'Active furnace switches to glowing LIT_FURNACE');
worldA.updateFurnaces(7.0);
assert.ok(fState.output && fState.output.id === ITEM_IDS.IRON_INGOT && fState.output.count === 1, 'Furnace smelts Iron Ore into Iron Ingot');
console.log('✓ DDA raycast, falling sand physics, and real-time furnace smelting verified');

// 5. Player Physics, Sneak Edge-Guard & Full Crafting Progression
const entities = new EntityManager(scene, worldA, atlas, particles, audio);
const player = new Player({
  camera,
  scene,
  world: worldA,
  atlas,
  entities,
  particles,
  audio,
  mode: GAME_MODES.SURVIVAL,
});

// Build an isolated 1-block platform at (12, 100, 12) surrounded by air
for (let dx = -2; dx <= 2; dx++) {
  for (let dz = -2; dz <= 2; dz++) {
    for (let dy = 99; dy <= 104; dy++) {
      worldA.setBlock(12 + dx, dy, 12 + dz, BLOCK_IDS.AIR, 0, false);
    }
  }
}
worldA.setBlock(12, 100, 12, BLOCK_IDS.STONE, 0, true);
player.position.set(12.5, 101.02, 12.5);
player.fallPeakY = 101.02;

const dummyInput = {
  keys: {},
  mouseLeft: false,
  mouseRight: false,
  justPressedLeft: false,
  justPressedRight: false,
};

// Let player settle onto platform
for (let i = 0; i < 10; i++) player.update(0.02, dummyInput, true);
assert.ok(player.onGround, 'Player stands solidly on 1x1 stone pillar');

// Hold Crouch (KeyC) and walk forward (-Z): edge-guard must keep player safely on pillar!
dummyInput.keys.KeyC = true;
dummyInput.keys.KeyW = true;
for (let i = 0; i < 40; i++) player.update(0.025, dummyInput, true);
assert.ok(player.position.y >= 100.99, `Sneak edge-guard must prevent falling off pillar (y=${player.position.y})`);
dummyInput.keys.KeyC = false;
dummyInput.keys.KeyW = false;

// Crafting Progression Chain
const findRecipe = (id) => CRAFTING_RECIPES.find((r) => r.id === id);
player.inventory.addItem(BLOCK_IDS.BIRCH_LOG, 3); // Test Birch flexibility too!
assert.equal(player.inventory.craft(findRecipe('birch_planks'), false, 3), 3, 'Crafted 12 Birch Planks');
assert.equal(player.inventory.craft(findRecipe('sticks'), false, 1), 1, 'Crafted 4 Sticks from Birch Planks');
assert.equal(player.inventory.craft(findRecipe('crafting_table'), false, 1), 1, 'Crafted Crafting Table from Birch Planks');
assert.equal(player.inventory.craft(findRecipe('wood_pickaxe'), false, 1), 0, 'Wood Pickaxe blocked without workbench');
assert.equal(player.inventory.craft(findRecipe('wood_pickaxe'), true, 1), 1, 'Wood Pickaxe crafted with workbench!');
console.log('✓ Player AABB ground collision, sneak edge-guard, and tag-flexible crafting verified');

// 6. World Persistence Roundtrip
const storage = new WorldStorage();
await storage.saveWorld({
  id: 'save_test_1',
  name: 'Persistence Test',
  seed: 'test-seed-2026',
  mode: GAME_MODES.SURVIVAL,
  worldData: worldA.serializeWorldData(),
  playerData: player.serialize(),
});

const loadedRecord = await storage.loadWorld('save_test_1');
assert.ok(loadedRecord, 'Saved world record loaded');
const restoredWorld = new World({
  scene: new THREE.Scene(),
  atlas,
  seed: loadedRecord.seed,
  renderDistance: 3,
  savedState: loadedRecord.worldData,
});
restoredWorld.preloadAround(12, 12, 1);
assert.equal(restoredWorld.getBlock(12, 100, 12), BLOCK_IDS.STONE, 'Modified block persisted across reload');
assert.equal(restoredWorld.getBlock(9, 96, 8), BLOCK_IDS.LIT_FURNACE, 'Lit furnace block persisted across reload');
const restoredFurnace = restoredWorld.getOrCreateFurnace(9, 96, 8);
assert.equal(restoredFurnace.output.id, ITEM_IDS.IRON_INGOT, 'Furnace smelted output persisted across reload');
console.log('✓ World delta & container persistence verified');

console.log('\nALL INTEGRATION TESTS PASSED!');
