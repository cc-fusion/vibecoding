// Comprehensive Runtime Simulation & Verification Suite for VoxelRealms
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL, GAME_MODES } from '../src/game/constants.js';
import { SeededNoise } from '../src/game/noise.js';
import { BLOCK, ITEM, RECIPES, REGISTRY, getDef } from '../src/game/items.js';
import { buildTextureAtlas, getTileUVs } from '../src/game/textures.js';
import { createVoxelMaterials } from '../src/game/shader.js';
import { World } from '../src/game/world.js';
import { buildChunkGeometries } from '../src/game/mesher.js';
import { Inventory } from '../src/game/inventory.js';
import { Player } from '../src/game/player.js';
import { EntityManager } from '../src/game/entities.js';
import { ParticleSystem } from '../src/game/particles.js';
import { SkySystem } from '../src/game/sky.js';
import { WorldStorage } from '../src/game/storage.js';

console.log('=== VoxelRealms Automated Verification Suite ===');

// 1. Check BoxGeometry UV layout vs our setCrackStage / held cube
{
  const bg = new THREE.BoxGeometry(1, 1, 1);
  const pos = bg.getAttribute('position');
  const uv = bg.getAttribute('uv');
  console.log('1. Checking Three.js BoxGeometry face UV conventions...');
  // Face +Z (face 4 -> vertices 16..19)
  const y16 = pos.getY(16), y18 = pos.getY(18);
  const v16 = uv.getY(16), v18 = uv.getY(18);
  assert(y16 > y18 && v16 > v18, 'Expected BoxGeometry top vertices first with default v=1');
  console.log('   ✓ BoxGeometry vertex/UV ordering verified');
}

// 2. Deterministic Noise & Biome Diversity
{
  console.log('2. Testing deterministic noise & biome diversity...');
  const n1 = new SeededNoise('Emerald2026');
  const n2 = new SeededNoise('Emerald2026');
  for (let i = 0; i < 50; i++) {
    assert.equal(n1.fbm2D(i * 0.13, i * 0.27), n2.fbm2D(i * 0.13, i * 0.27));
    assert.equal(n1.noise3D(i * 0.1, i * 0.2, i * 0.3), n2.noise3D(i * 0.1, i * 0.2, i * 0.3));
  }

  const scene = new THREE.Scene();
  const { texture } = buildTextureAtlas();
  const mats = createVoxelMaterials(texture);
  const world = new World(scene, mats, 'Horizon2026');

  const seenBiomes = new Set();
  for (let z = -600; z <= 600; z += 24) {
    for (let x = -600; x <= 600; x += 24) {
      seenBiomes.add(world.terrain.getBiomeAt(x, z).id);
    }
  }
  console.log('   Discovered biomes:', [...seenBiomes].join(', '));
  assert(seenBiomes.size >= 5, `Expected at least 5 distinct biomes, got ${seenBiomes.size}`);
  world.dispose();
  console.log('   ✓ Noise determinism & multi-biome generation verified');
}

// 3. Chunk Generation, Ores, Meshing, Winding Normals & Smooth AO/Lighting
{
  console.log('3. Testing chunk generation, ore strata, mesh normals & AO/light attributes...');
  const scene = new THREE.Scene();
  const { texture } = buildTextureAtlas();
  const mats = createVoxelMaterials(texture);
  const world = new World(scene, mats, 'Horizon2026');
  world.updateStreaming(0, 0, 2);

  const oreCounts = {
    coal: 0,
    iron: 0,
    gold: 0,
    diamond: 0,
    crystal: 0,
  };

  for (const chunk of world.chunks.values()) {
    for (let i = 0; i < chunk.blocks.length; i++) {
      const b = chunk.blocks[i];
      if (b === BLOCK.COAL_ORE) oreCounts.coal++;
      else if (b === BLOCK.IRON_ORE) oreCounts.iron++;
      else if (b === BLOCK.GOLD_ORE) oreCounts.gold++;
      else if (b === BLOCK.DIAMOND_ORE) oreCounts.diamond++;
      else if (b === BLOCK.CRYSTAL_ORE) oreCounts.crystal++;
    }
  }
  console.log('   Ore counts in spawn region:', oreCounts);
  assert(oreCounts.coal > 0 && oreCounts.iron > 0, 'Expected Coal & Iron ores in spawn chunks');

  // Verify isolated single stone cube at (8, 80, 8) produces exact 6 outward CCW faces!
  const testWorld = new World(null, null, 'FlatTest');
  const c0 = testWorld.ensureChunkData(0, 0);
  c0.blocks.fill(0);
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) continue;
      testWorld.ensureChunkData(dx, dz).blocks.fill(0);
    }
  }
  testWorld.setBlock(8, 80, 8, BLOCK.STONE, false);
  testWorld.computeChunkLighting(0, 0);
  const geoms = buildChunkGeometries(testWorld, 0, 0);
  assert(geoms.opaque, 'Expected opaque geometry for single stone block');

  const pos = geoms.opaque.getAttribute('position');
  const lgt = geoms.opaque.getAttribute('aLight');
  const idx = geoms.opaque.getIndex();
  assert.equal(idx.count, 36, 'Single isolated cube must emit exactly 12 triangles (36 indices)');

  // Check every triangle normal points away from cube center (8.5, 80.5, 8.5)!
  const center = new THREE.Vector3(8.5, 80.5, 8.5);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), norm = new THREE.Vector3();
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(pos, idx.getX(i));
    b.fromBufferAttribute(pos, idx.getX(i + 1));
    c.fromBufferAttribute(pos, idx.getX(i + 2));
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    norm.crossVectors(ab, ac).normalize();
    const toFace = a.clone().sub(center);
    assert(norm.dot(toFace) > 0.1, `Triangle ${i / 3} normal ${norm.toArray()} is inverted!`);
  }

  // Verify no NaNs in light/AO attributes
  for (let i = 0; i < lgt.count * 3; i++) {
    const val = lgt.array[i];
    assert(Number.isFinite(val) && val >= 0 && val <= 1.01, `Invalid aLight value: ${val}`);
  }
  world.dispose();
  console.log('   ✓ Outward CCW face normals & smooth AO/light buffers verified');
}

// 4. Cross-Chunk Torch Lighting & Water Flow
{
  console.log('4. Testing cross-chunk Torch block-lighting & cellular Water flow...');
  const world = new World(null, null, 'CaveLightTest');
  for (let cz = -1; cz <= 1; cz++) {
    for (let cx = -1; cx <= 1; cx++) {
      const ch = world.ensureChunkData(cx, cz);
      ch.blocks.fill(BLOCK.STONE);
    }
  }
  // Carve an underground room spanning chunk border x = 14..18, y = 20..23, z = 8..11
  for (let x = 14; x <= 18; x++) {
    for (let y = 20; y <= 22; y++) {
      for (let z = 8; z <= 10; z++) {
        world.setBlock(x, y, z, BLOCK.AIR, false);
      }
    }
  }
  // Place Torch at x = 15 (chunk 0 border!) and check blockLight in chunk 1 (x = 16, 17)
  world.setBlock(15, 20, 9, BLOCK.TORCH, true);
  const lAtTorch = world.getPackedLight(15, 20, 9) & 15;
  const lCross1 = world.getPackedLight(16, 20, 9) & 15;
  const lCross2 = world.getPackedLight(17, 20, 9) & 15;
  assert.equal(lAtTorch, 14, 'Torch cell should have blockLight 14');
  assert.equal(lCross1, 13, 'Neighbor cell across chunk border should have blockLight 13');
  assert.equal(lCross2, 12, '2-step cell across chunk border should have blockLight 12');

  // Test Water cascade downward & horizontal spread
  for (let x = 4; x <= 8; x++) {
    for (let y = 40; y <= 44; y++) {
      for (let z = 4; z <= 8; z++) {
        world.setBlock(x, y, z, BLOCK.AIR, false);
      }
    }
  }
  world.setBlock(6, 43, 6, BLOCK.WATER, true);
  for (let step = 0; step < 12; step++) world.tickWater(0.25);
  assert.equal(world.getBlock(6, 40, 6), BLOCK.WATER, 'Water should cascade down to floor y=40');
  assert.equal(world.getBlock(7, 40, 6), BLOCK.WATER, 'Water should spread horizontally on floor');
  console.log('   ✓ Cross-chunk torch lighting & water cascade verified');
}

// 5. 3D DDA Raycast, Player Physics, Jump, Wall-Slide & Sneak Ledge-Guard
{
  console.log('5. Testing 3D DDA raycast & Player physics (jump, wall-slide, sneak ledge-guard)...');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1.6, 0.1, 300);
  const { texture } = buildTextureAtlas();
  const world = new World(null, null, 'PhysicsArena');
  const ch = world.ensureChunkData(0, 0);
  ch.blocks.fill(0);
  // Build flat stone floor at y = 30
  for (let z = 0; z < 16; z++) {
    for (let x = 0; x < 16; x++) {
      world.setBlock(x, 30, z, BLOCK.STONE, false);
    }
  }
  // Place target block at (8, 32, 5)
  world.setBlock(8, 32, 5, BLOCK.OAK_LOG, false);

  const hit = world.raycast(new THREE.Vector3(8.5, 32.5, 9.5), new THREE.Vector3(0, 0, -1), 6.0);
  assert(hit && hit.x === 8 && hit.y === 32 && hit.z === 5, 'DDA raycast must hit (8,32,5)');
  assert(hit.nx === 0 && hit.ny === 0 && hit.nz === 1, 'Hit face normal must be +Z');
  assert(hit.placeZ === 6, 'Placement cell must be z=6');

  const inv = new Inventory();
  const player = new Player(camera, scene, world, inv, null, null, null, texture);
  player.pos.set(8.5, 36.0, 8.5);
  player.highestAirY = 36.0;

  // Simulate falling onto floor y=30 in Survival -> fall Dist = 5.0 -> should land at y = 31.0002 & take fall damage!
  for (let i = 0; i < 90; i++) player.update(1 / 60, GAME_MODES.SURVIVAL, true);
  assert(player.onGround, 'Player should rest on ground');
  assert(Math.abs(player.pos.y - 31) < 0.02, `Expected y ~ 31, got ${player.pos.y}`);
  assert(player.health < 20, 'Expected fall damage from 5-block drop');

  // Test Jump apex clears > 1.15 blocks
  player.onKeyDown('Space', GAME_MODES.SURVIVAL);
  let maxJumpY = player.pos.y;
  for (let i = 0; i < 45; i++) {
    player.update(1 / 60, GAME_MODES.SURVIVAL, true);
    if (player.pos.y > maxJumpY) maxJumpY = player.pos.y;
  }
  player.onKeyUp('Space');
  for (let i = 0; i < 45; i++) player.update(1 / 60, GAME_MODES.SURVIVAL, true);
  assert(maxJumpY - 31.0 > 1.25, `Jump height too low: ${maxJumpY - 31.0}`);

  // Test Sneak Ledge-Guard on isolated 1x1 pillar at (4, 45, 4)!
  world.setBlock(4, 45, 4, BLOCK.STONE, false);
  player.pos.set(4.5, 46.0002, 4.5);
  player.vel.set(0, 0, 0);
  player.onGround = true;
  player.yaw = 0; // facing -Z
  player.onKeyDown('ShiftLeft', GAME_MODES.SURVIVAL);
  player.onKeyDown('KeyW', GAME_MODES.SURVIVAL);
  for (let i = 0; i < 90; i++) {
    player.update(1 / 60, GAME_MODES.SURVIVAL, true);
  }
  assert(player.pos.y >= 46.0, `Sneak ledge-guard failed! Player fell to y=${player.pos.y}`);
  player.clearInputs();
  console.log('   ✓ DDA raycast, gravity, fall damage, jump apex & sneak ledge-guard verified');
}

// 6. Full Survival Crafting & Smelting Progression + Persistence
{
  console.log('6. Testing full Survival Crafting/Smelting progression & WorldStorage...');
  // Validate every recipe references valid definitions
  for (const r of RECIPES) {
    assert(REGISTRY[r.output.id], `Missing output def in recipe ${r.id}`);
    for (const ing of r.ingredients) {
      if (ing.id !== undefined) assert(REGISTRY[ing.id], `Missing ing def in recipe ${r.id}`);
    }
  }

  const inv = new Inventory();
  inv.addItem(BLOCK.OAK_LOG, 3);
  const planksRecipe = RECIPES.find((r) => r.id === 'oak_planks');
  inv.craft(planksRecipe, { crafting: false, smelting: false });
  inv.craft(planksRecipe, { crafting: false, smelting: false });
  assert.equal(inv.countMatching({ tag: 'planks' }), 8);

  const tableRecipe = RECIPES.find((r) => r.id === 'crafting_table');
  inv.craft(tableRecipe, { crafting: false, smelting: false });

  const sticksRecipe = RECIPES.find((r) => r.id === 'sticks');
  inv.craft(sticksRecipe, { crafting: false, smelting: false });

  inv.addItem(BLOCK.OAK_PLANKS, 3);
  const woodPickRecipe = RECIPES.find((r) => r.id === 'wood_pickaxe');
  assert.equal(inv.canCraft(woodPickRecipe, { crafting: false, smelting: false }), false, 'Wood pickaxe requires Crafting Table');
  assert.equal(inv.canCraft(woodPickRecipe, { crafting: true, smelting: false }), true, 'Wood pickaxe craftable near Crafting Table');
  inv.craft(woodPickRecipe, { crafting: true, smelting: false });
  assert.equal(inv.countMatching({ id: ITEM.WOOD_PICKAXE }), 1);

  // Smelting Raw Iron + Coal -> Iron Ingot near Furnace
  inv.addItem(ITEM.RAW_IRON, 3);
  inv.addItem(ITEM.COAL, 3);
  const smeltIron = RECIPES.find((r) => r.id === 'smelt_iron');
  inv.craft(smeltIron, { crafting: true, smelting: true });
  assert.equal(inv.countMatching({ id: ITEM.IRON_INGOT }), 1);

  // Persistence roundtrip
  const storage = new WorldStorage();
  await storage.saveWorld({
    id: 'test_w1',
    name: 'Verification Realm',
    seed: 'Verify123',
    mode: 'survival',
    dayCount: 2,
    inventory: inv.serialize(),
    mods: { '0,0': [120, BLOCK.TORCH] },
  });
  const list = await storage.listWorlds();
  assert.equal(list.length, 1);
  const loaded = await storage.getWorld('test_w1');
  assert.equal(loaded.name, 'Verification Realm');
  const inv2 = new Inventory();
  inv2.deserialize(loaded.inventory);
  assert.equal(inv2.countMatching({ id: ITEM.WOOD_PICKAXE }), 1);
  console.log('   ✓ Full Survival crafting/smelting tree & persistence verified');
}

// 7. Entities: Dropped Item Pickup & Mob Combat
{
  console.log('7. Testing EntityManager (dropped items & mob raycast/combat/loot)...');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const { texture } = buildTextureAtlas();
  const world = new World(null, null, 'EntityTest');
  const ch = world.ensureChunkData(0, 0);
  ch.blocks.fill(0);
  for (let z = 0; z < 16; z++) {
    for (let x = 0; x < 16; x++) world.setBlock(x, 20, z, BLOCK.GRASS, false);
  }
  const particles = new ParticleSystem(scene);
  const entities = new EntityManager(scene, world, particles, null);
  const inv = new Inventory();
  const player = new Player(camera, scene, world, inv, entities, particles, null, texture);
  player.pos.set(8.5, 21.0002, 8.5);

  entities.spawnMob('sheep', 8.5, 21.05, 6.0);
  const hitMob = entities.raycastMob(new THREE.Vector3(8.5, 22.5, 8.5), new THREE.Vector3(0, -0.35, -1).normalize(), 4.0);
  assert(hitMob && hitMob.type === 'sheep', 'Expected raycastMob to hit sheep in front of player');

  // Defeat sheep and verify Wool + Meat drops spawn and get magnetically picked up!
  entities.hitMob(hitMob, 20, 0, -1);
  assert.equal(entities.mobs.length, 0, 'Sheep should be removed when HP <= 0');
  assert(entities.drops.length >= 2, 'Defeated sheep should spawn Wool + Raw Venison drops');

  // Move player onto drops and simulate 1 second so magnetic pickup collects them
  player.pos.set(8.5, 21.0002, 6.0);
  for (let i = 0; i < 60; i++) entities.update(1 / 60, player, false, GAME_MODES.SURVIVAL);
  assert(inv.countMatching({ id: BLOCK.WOOL }) >= 1, 'Player should magnetically pick up dropped Wool');
  entities.dispose();
  particles.dispose();
  console.log('   ✓ Mob raycasting, combat knockback, loot drops & magnetic pickup verified');
}

console.log('\nALL 7 VERIFICATION SUITES PASSED SUCCESSFULLY!');
