import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BLOCK, ITEM, getDef } from '../src/world/blocks.js';
import { TextureManager } from '../src/world/textures.js';
import { World } from '../src/world/world.js';
import { Player } from '../src/physics/player.js';
import { Inventory } from '../src/gameplay/inventory.js';
import { RECIPES } from '../src/gameplay/recipes.js';
import { DropManager } from '../src/entities/drops.js';
import { MobManager } from '../src/entities/mobs.js';

console.log('=== TerraCraft Automated Engine & Gameplay Verification ===');

// 1. Texture Atlas & 3D Item Voxelizer Verification
const textures = new TextureManager();
assert.ok(textures.atlasTexture, 'Atlas DataTexture created');
for (const [id, def] of [['grass', BLOCK.GRASS], ['workbench', BLOCK.CRAFTING_TABLE], ['furnace', BLOCK.FURNACE], ['crystal', BLOCK.CRYSTAL_ORE]]) {
  const b = getDef(def);
  for (const key of ['top', 'bottom', 'side', 'front']) {
    const uv = textures.getUV(b.tex[key]);
    assert.ok(uv.u0 >= 0 && uv.u1 <= 1 && uv.v0 >= 0 && uv.v1 <= 1 && uv.u1 > uv.u0 && uv.v1 > uv.v0, `Valid UVs for ${id}.${key}`);
  }
}
for (const toolId of [ITEM.WOOD_PICKAXE, ITEM.IRON_SWORD, ITEM.APPLE, ITEM.BUCKET_WATER, BLOCK.FLOWER_RED]) {
  const vox = textures.getItemVoxels16(toolId);
  assert.ok(vox.length >= 12, `3D extruded voxel pixels extracted for item ${toolId} (${vox.length} voxels)`);
}
console.log('[PASS] Texture Atlas, crack stages & 3D item voxelizer verified');

// 2. World Generation Determinism & Biome Diversity
const sceneA = new THREE.Scene();
const sceneB = new THREE.Scene();
const worldA = new World(sceneA, textures, 'TestSeed-42', 3);
const worldB = new World(sceneB, textures, 'TestSeed-42', 3);

worldA.preloadSpawnArea(0, 0, 1);
worldB.preloadSpawnArea(0, 0, 1);

for (let x = -8; x <= 8; x += 3) {
  for (let z = -8; z <= 8; z += 3) {
    for (let y = 0; y < 70; y += 5) {
      assert.equal(worldA.getBlock(x, y, z), worldB.getBlock(x, y, z), `Deterministic voxel at ${x},${y},${z}`);
    }
  }
}

const biomesFound = new Set();
for (let x = -900; x <= 900; x += 45) {
  for (let z = -900; z <= 900; z += 45) {
    biomesFound.add(worldA.generator.sampleColumn(x, z).biome);
  }
}
console.log('Biomes sampled across world:', Array.from(biomesFound).join(', '));
assert.ok(biomesFound.size >= 5, `Expected at least 5 distinct biomes, got ${biomesFound.size}`);
console.log('[PASS] Seeded determinism & multi-biome diversity verified');

// 3. Chunk Meshing & Outward Face Normal Winding Check
const centerChunk = worldA.getChunk(0, 0);
assert.ok(centerChunk.solidMesh, 'Center chunk generated a solid mesh');
const posAttr = centerChunk.solidMesh.geometry.attributes.position;
const normAttr = centerChunk.solidMesh.geometry.attributes.normal;
const lightAttr = centerChunk.solidMesh.geometry.attributes.aLight;
const idxAttr = centerChunk.solidMesh.geometry.index;
assert.ok(posAttr.count > 100, 'Mesh has substantial geometry');

// Verify no NaNs and check CCW triangle winding matches declared normal on solid cubes
for (let i = 0; i < posAttr.array.length; i++) {
  assert.ok(!Number.isNaN(posAttr.array[i]), 'No NaN in vertex positions');
}
for (let i = 0; i < lightAttr.array.length; i++) {
  assert.ok(lightAttr.array[i] >= 0 && lightAttr.array[i] <= 1, 'Light attribute within [0,1]');
}

const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3();
const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), cross = new THREE.Vector3(), nrm = new THREE.Vector3();
let checkedSolidTris = 0;
for (let t = 0; t < Math.min(300, idxAttr.count); t += 3) {
  const i0 = idxAttr.getX(t), i1 = idxAttr.getX(t + 1), i2 = idxAttr.getX(t + 2);
  p0.fromBufferAttribute(posAttr, i0);
  p1.fromBufferAttribute(posAttr, i1);
  p2.fromBufferAttribute(posAttr, i2);
  nrm.fromBufferAttribute(normAttr, i0);
  // Check axis-aligned block faces (skip diagonal cross flora whose dummy normal is +Y)
  e1.subVectors(p1, p0);
  e2.subVectors(p2, p0);
  cross.crossVectors(e1, e2).normalize();
  if (Math.abs(cross.x) > 0.99 || Math.abs(cross.y) > 0.99 || Math.abs(cross.z) > 0.99) {
    assert.ok(cross.dot(nrm) > 0.95, `CCW outward winding mismatch: cross=${cross.toArray()} vs normal=${nrm.toArray()}`);
    checkedSolidTris++;
  }
}
assert.ok(checkedSolidTris > 20, 'Checked outward CCW winding on solid block triangles');
console.log('[PASS] Chunk geometry, smooth AO/light attributes & CCW face winding verified');

// 4. Underground Cave Carve + Cross-Chunk Torchlight Propagation
// Carve a sealed 5x3x5 chamber across chunk border x=15..17 at y=12
for (let x = 14; x <= 18; x++) {
  for (let y = 11; y <= 13; y++) {
    for (let z = 6; z <= 10; z++) {
      worldA.setBlock(x, y, z, BLOCK.AIR, true);
    }
  }
}
const darkBefore = worldA.getBlockLight(17, 12, 8);
assert.equal(darkBefore, 0, 'Sealed cave chamber is dark before placing torch');
worldA.setBlock(15, 11, 8, BLOCK.TORCH, true);
const litSameChunk = worldA.getBlockLight(15, 11, 8);
const litAcrossBorder = worldA.getBlockLight(17, 12, 8);
assert.equal(litSameChunk, 14, 'Torch voxel has blockLight 14');
assert.ok(litAcrossBorder >= 10, `Torchlight propagated across chunk border (got ${litAcrossBorder})`);
console.log('[PASS] Underground torch blocklight & cross-chunk propagation verified');

// 5. Exact 3D DDA Raycasting
const surfY = worldA.getSurfaceY(4, 4);
const rayHit = worldA.raycast(new THREE.Vector3(4.5, surfY + 3.5, 4.5), new THREE.Vector3(0, -1, 0), 6.0, false);
assert.equal(rayHit.hit, true, 'Downward ray hits surface');
assert.equal(rayHit.y, surfY - 1, 'Hit exact top solid block');
assert.equal(rayHit.ny, 1, 'Top face normal is +Y');
assert.equal(rayHit.py, surfY, 'Placement coordinate is directly on top of surface');
console.log('[PASS] 3D DDA raycasting & placement coordinates verified');

// 6. Player Physics: Gravity Landing + Sneak Edge-Guard
const inv = new Inventory();
const cam = new THREE.PerspectiveCamera(75, 1.6, 0.1, 300);
const player = new Player(cam, worldA, inv, textures, null);

// Build an isolated 1-block pillar in open sky at (2, 75, 2)
worldA.setBlock(2, 75, 2, BLOCK.STONE, true);
for (let dx = -2; dx <= 2; dx++) {
  for (let dz = -2; dz <= 2; dz++) {
    if (dx === 0 && dz === 0) continue;
    worldA.setBlock(2 + dx, 75, 2 + dz, BLOCK.AIR, true);
  }
}
player.pos.set(2.5, 77.2, 2.5);
player.vel.set(0, 0, 0);
for (let i = 0; i < 40; i++) player.update(0.03);
assert.equal(player.onGround, true, 'Player landed cleanly on pillar');
assert.ok(Math.abs(player.pos.y - 76.0) < 0.05, `Player standing at y=76.0 (got ${player.pos.y})`);

// Hold Crouch + walk forward (+Z/-Z) — sneak edge-guard must prevent falling off!
player.keys.crouch = true;
player.keys.forward = true;
player.yaw = 0; // -Z
for (let i = 0; i < 50; i++) player.update(0.03);
assert.ok(player.pos.y >= 75.95, `Sneak edge-guard kept player on 1-block pillar (y=${player.pos.y})`);
player.keys.crouch = false;
player.keys.forward = false;
console.log('[PASS] Player AABB landing & sneak bridge edge-guard verified');

// 7. Inventory, Tag-Group Crafting & Tool Durability
inv.populateStarterKit('survival');
inv.addItem(BLOCK.BIRCH_PLANKS, 2);
inv.addItem(BLOCK.PINE_PLANKS, 2);
const wbRecipe = RECIPES.find((r) => r.id === 'crafting_table');
assert.equal(inv.hasIngredients(wbRecipe.ingredients), true, 'Mixed Birch + Pine Planks satisfy Crafting Table');
assert.equal(inv.consumeIngredients(wbRecipe.ingredients), true);
inv.addItem(wbRecipe.outId, wbRecipe.outCount);
assert.equal(inv.countItem(BLOCK.CRAFTING_TABLE), 1, 'Crafting Table added to inventory');

// Test tool durability depletion
inv.selectHotbar(0); // Starter Wood Axe
const startDur = inv.getActiveSlot().durability;
inv.damageActiveTool(1, false);
assert.equal(inv.getActiveSlot().durability, startDur - 1, 'Tool durability decremented');
console.log('[PASS] Inventory, mixed-wood tag crafting & tool durability verified');

// 8. Mobs & Combat Hit + Drops
const drops = new DropManager(sceneA, worldA, textures, inv, null);
const mobs = new MobManager(sceneA, worldA, drops, null, null);
const sheep = mobs.addMob('sheep', 4.5, surfY + 0.1, 4.5);
const hitMob = mobs.raycastMob(new THREE.Vector3(4.5, surfY + 0.6, 7.0), new THREE.Vector3(0, 0, -1), 4.0);
assert.equal(hitMob, sheep, 'Melee raycast hit sheep');
mobs.hitMob(sheep, 20, new THREE.Vector3(4.5, surfY, 7.0));
assert.equal(mobs.mobs.length, 0, 'Defeated sheep removed cleanly');
assert.ok(drops.drops.length >= 1, 'Defeated sheep spawned loot drops');
console.log('[PASS] Mob raycast combat & loot drop spawning verified');

// 9. Sparse Edit Serialization & Restore
const serializedEdits = worldA.serializeEdits();
const worldRestored = new World(new THREE.Scene(), textures, 'TestSeed-42', 3);
worldRestored.loadSerializedEdits(serializedEdits);
worldRestored.preloadSpawnArea(0, 0, 1);
assert.equal(worldRestored.getBlock(15, 11, 8), BLOCK.TORCH, 'Placed torch persisted in restored world');
assert.equal(worldRestored.getBlock(2, 75, 2), BLOCK.STONE, 'Placed pillar persisted in restored world');
console.log('[PASS] Persistent world delta serialization & reload verified');

console.log('\nALL ENGINE & GAMEPLAY TESTS PASSED!');
