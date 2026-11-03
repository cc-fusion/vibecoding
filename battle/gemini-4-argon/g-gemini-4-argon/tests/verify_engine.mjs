import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BLOCK, ITEM, REGISTRY } from '../src/constants/Blocks.js';
import { RECIPES } from '../src/constants/Recipes.js';
import { WorldGenerator, CHUNK_SIZE, SEA_LEVEL, BIOME } from '../src/world/WorldGen.js';
import { World } from '../src/world/World.js';
import { Inventory } from '../src/game/Inventory.js';
import { PlayerController } from '../src/physics/PlayerController.js';

// Mock minimal atlas for headless Node testing
function createMockAtlas() {
  const uvMap = {};
  const sampleUv = { u0: 0.03, v0: 0.03, u1: 0.09, v1: 0.09 };
  for (const def of Object.values(REGISTRY)) {
    if (def.textures) {
      for (const k of Object.values(def.textures)) {
        uvMap[k] = sampleUv;
      }
    }
  }
  uvMap.stone = sampleUv;
  return {
    uvMap,
    iconUrls: {},
    solidMaterial: new THREE.MeshBasicMaterial(),
    waterMaterial: new THREE.MeshBasicMaterial({ transparent: true }),
    sharedUniforms: {
      uFogNear: { value: 40 },
      uFogFar: { value: 90 },
      uUnderwater: { value: 0 },
      uSunLevel: { value: 1 },
      uTime: { value: 0 },
    },
    crackMaterials: Array.from({ length: 8 }, () => new THREE.MeshBasicMaterial()),
    blockColors: {},
  };
}

const mockSound = {
  playStep() {}, playMineHit() {}, playBreak() {}, playPlace() {},
  playPickup() {}, playCraft() {}, playEat() {}, playSplash() {},
  playHitMob() {}, playHurt() {}, playToolBreak() {}, playFuse() {},
  playExplosion() {}, playClick() {},
};

const mockEntities = {
  spawnBlockParticles() {},
  spawnCustomParticles() {},
  spawnDrop() {},
  igniteTNT() {},
  raycastMob() { return null; },
  damageMob() {},
};

console.log('1. Testing deterministic WorldGenerator, biomes, ores, and spawn...');
{
  const genA = new WorldGenerator('EmeraldPeaks-777');
  const genB = new WorldGenerator('EmeraldPeaks-777');
  const chA = genA.generateChunk(0, 0);
  const chB = genB.generateChunk(0, 0);
  assert.deepEqual(chA.blocks, chB.blocks, 'Chunk generation must be 100% deterministic for identical seeds');

  // Verify spawn point is dry land above sea level
  const spawn = genA.findSpawnPoint();
  assert.ok(spawn.y > SEA_LEVEL + 1, `Spawn Y (${spawn.y}) must be above sea level (${SEA_LEVEL})`);

  // Sample wide grid to confirm diverse biomes exist
  const seenBiomes = new Set();
  for (let z = -600; z <= 600; z += 24) {
    for (let x = -600; x <= 600; x += 24) {
      seenBiomes.add(genA.getBiomeAt(x, z));
    }
  }
  console.log('   Discovered biomes:', Array.from(seenBiomes).join(', '));
  assert.ok(seenBiomes.size >= 5, `Expected at least 5 distinct biomes, got ${seenBiomes.size}`);

  // Verify ores & bedrock across a few chunks
  const counts = { bedrock: 0, coal: 0, iron: 0, diamond: 0, glow: 0 };
  for (let cx = 0; cx < 4; cx++) {
    const ch = genA.generateChunk(cx, 0);
    for (let i = 0; i < ch.blocks.length; i++) {
      if (ch.blocks[i] === BLOCK.BEDROCK) counts.bedrock++;
      if (ch.blocks[i] === BLOCK.COAL_ORE) counts.coal++;
      if (ch.blocks[i] === BLOCK.IRON_ORE) counts.iron++;
      if (ch.blocks[i] === BLOCK.DIAMOND_ORE) counts.diamond++;
      if (ch.blocks[i] === BLOCK.GLOW_CRYSTAL) counts.glow++;
    }
  }
  assert.equal(counts.bedrock, 4 * CHUNK_SIZE * CHUNK_SIZE, 'Every y=0 cell must be Bedrock');
  assert.ok(counts.coal > 0 && counts.iron > 0 && counts.diamond > 0 && counts.glow > 0, 'All underground ores must generate');
}

console.log('2. Testing ChunkMesher, cross-chunk Torch BFS lighting, and Sand gravity...');
{
  const scene = new THREE.Scene();
  const atlas = createMockAtlas();
  const world = new World(scene, atlas, 'LightTestSeed');
  world.preloadAround(8, 8, 1);

  const testY = world.getSurfaceHeight(16, 8) + 3;
  // Clear small air pocket across chunk border (x = 15 in chunk 0, x = 16 in chunk 1)
  world.setBlock(15, testY, 8, BLOCK.AIR, true);
  world.setBlock(16, testY, 8, BLOCK.TORCH, true);

  assert.equal(world.getVoxelLight(16, testY, 8), 15, 'Torch cell must have light 15');
  assert.equal(world.getVoxelLight(15, testY, 8), 14, 'Neighbor chunk cell across border must receive light 14');

  // Remove torch and verify zero ghost light remains
  world.setBlock(16, testY, 8, BLOCK.AIR, true);
  assert.equal(world.getVoxelLight(16, testY, 8), 0, 'Removed torch cell light must drop to 0');
  assert.equal(world.getVoxelLight(15, testY, 8), 0, 'Neighbor chunk cell light must drop to 0 with no ghost light');

  // Test Sand gravity
  const surfY = world.getSurfaceHeight(10, 10);
  // Ensure solid floor at surfY and air above
  world.setBlock(10, surfY, 10, BLOCK.STONE, true);
  world.setBlock(10, surfY + 1, 10, BLOCK.AIR, true);
  world.setBlock(10, surfY + 2, 10, BLOCK.AIR, true);
  world.setBlock(10, surfY + 3, 10, BLOCK.SAND, true);

  for (let tick = 0; tick < 10; tick++) {
    world.update(10, 10, 0.1, 2);
  }
  assert.equal(world.getBlock(10, surfY + 1, 10), BLOCK.SAND, 'Sand must settle onto solid block below');
  assert.equal(world.getBlock(10, surfY + 3, 10), BLOCK.AIR, 'Original sand cell must become Air');

  // Verify delta serialization
  const exported = world.exportEdits();
  const worldReloaded = new World(new THREE.Scene(), atlas, 'LightTestSeed', exported);
  worldReloaded.preloadAround(10, 10, 1);
  assert.equal(worldReloaded.getBlock(10, surfY + 1, 10), BLOCK.SAND, 'Reloaded world must preserve settled Sand delta');
}

console.log('3. Testing Player AABB Physics, Shift-Sneak Edge Guard, and DDA Raycasting...');
{
  const scene = new THREE.Scene();
  const atlas = createMockAtlas();
  const world = new World(scene, atlas, 'PhysicsSeed');
  world.preloadAround(8, 8, 1);

  // Build isolated 1-block platform high in the sky at (8, 75, 8)
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let y = 70; y <= 82; y++) {
        world.setBlock(8 + dx, y, 8 + dz, BLOCK.AIR, false);
      }
    }
  }
  world.setBlock(8, 74, 8, BLOCK.STONE_BRICKS, true);

  const cam = new THREE.PerspectiveCamera(75, 1.6, 0.1, 300);
  const inv = new Inventory('survival');
  const player = new PlayerController(cam, scene, world, mockEntities, inv, atlas, mockSound, 'survival');
  player.pos.set(8.5, 76.2, 8.5);

  // Let player fall onto (8, 74, 8)
  for (let i = 0; i < 60; i++) player.update(0.016, true);
  assert.ok(player.onGround, 'Player must land on platform');
  assert.ok(Math.abs(player.pos.y - 75.0) < 0.02, `Player feet (${player.pos.y}) must rest on top of block y=75`);

  // Test Shift-Sneak Edge Guard: hold Shift + W, verify player does NOT fall off single block!
  player.keys.ShiftLeft = true;
  player.keys.KeyW = true;
  for (let i = 0; i < 90; i++) player.update(0.016, true);
  assert.ok(player.pos.y >= 74.99, `Sneaking player (${player.pos.y}) must not walk off cliff edge!`);
  player.keys = {};

  // Test DDA Raycast looking straight down at (8, 74, 8)
  player.pos.set(8.5, 75.0001, 8.5);
  player.pitch = -Math.PI / 2 + 0.03;
  player.update(0.016, true);
  const hit = player.raycastVoxel();
  assert.ok(hit && hit.bx === 8 && hit.by === 74 && hit.bz === 8, 'DDA raycast looking down must hit supporting block (8,74,8)');
}

console.log('4. Testing Survival Crafting & Smelting Progression...');
{
  const inv = new Inventory('survival');
  inv.slots.fill(null);
  inv.addItem(BLOCK.OAK_LOG, 4);

  const byId = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

  // Hand craft 12 planks -> 8 sticks -> crafting table
  assert.equal(inv.craft(byId.oak_planks, { table: false, furnace: false }), true);
  assert.equal(inv.craft(byId.oak_planks, { table: false, furnace: false }), true);
  assert.equal(inv.craft(byId.oak_planks, { table: false, furnace: false }), true);
  assert.equal(inv.craft(byId.sticks, { table: false, furnace: false }), true);
  assert.equal(inv.craft(byId.sticks, { table: false, furnace: false }), true);
  assert.equal(inv.craft(byId.crafting_table, { table: false, furnace: false }), true);

  // Without table nearby, wood_pickaxe must be locked
  assert.equal(inv.canCraft(byId.wood_pickaxe, { table: false, furnace: false }), false);
  // With table nearby, craft wood_pickaxe
  assert.equal(inv.craft(byId.wood_pickaxe, { table: true, furnace: false }), true);

  // Add cobblestone & raw iron ore -> craft furnace -> smelt iron ingot -> craft iron pickaxe
  inv.addItem(BLOCK.COBBLESTONE, 11);
  assert.equal(inv.craft(byId.furnace, { table: true, furnace: false }), true);
  assert.equal(inv.craft(byId.stone_pickaxe, { table: true, furnace: false }), true);

  inv.addItem(BLOCK.IRON_ORE, 3);
  inv.addItem(ITEM.COAL, 3);
  for (let i = 0; i < 3; i++) {
    assert.equal(inv.craft(byId.smelt_iron, { table: true, furnace: true }), true);
  }
  assert.equal(inv.craft(byId.iron_pickaxe, { table: true, furnace: true }), true);
}

console.log('✅ ALL ENGINE VERIFICATION TESTS PASSED!');
