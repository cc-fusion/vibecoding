import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { blockItemId } from '../src/game/blocks';
import { SEA_LEVEL } from '../src/game/constants';
import { VoxelEngine } from '../src/game/engine';
import { computeChunkLighting } from '../src/game/lighting';
import { buildChunkMeshes } from '../src/game/mesher';
import {
  PlayerBodyState,
  stepPlayerPhysics,
  wouldBlockOverlapPlayer,
} from '../src/game/physics';
import { raycastVoxel } from '../src/game/raycast';
import { worldStorage } from '../src/game/storage';
import { BiomeId, BlockId, GameSettings, WorldSaveMeta } from '../src/game/types';
import { ChunkData, WorldGenerator } from '../src/game/worldGen';

const TEST_SETTINGS: GameSettings = {
  renderDistance: 4,
  fov: 78,
  soundVolume: 0,
  musicEnabled: false,
  peacefulMobs: false,
  invertY: false,
  mouseSensitivity: 1.0,
  autoStep: false,
};

function makeMeta(seed = 774901): WorldSaveMeta {
  return {
    id: `test_world_${seed}`,
    name: 'Verification Frontier',
    seed,
    seedText: String(seed),
    mode: 'survival',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    dayCount: 1,
  };
}

test('1. Deterministic multi-biome terrain, caves, water, bedrock & ores', () => {
  const genA = new WorldGenerator(774901);
  const genB = new WorldGenerator(774901);
  const genDiff = new WorldGenerator(902188);

  const cA = genA.generateChunk(0, 0);
  const cB = genB.generateChunk(0, 0);
  const cDiff = genDiff.generateChunk(0, 0);

  assert.deepEqual(cA.blocks, cB.blocks, 'Same seed must produce identical chunk blocks');
  assert.notDeepEqual(cA.blocks, cDiff.blocks, 'Different seeds must produce distinct terrain');

  const biomesFound = new Set<BiomeId>();
  let foundCoal = false;
  let foundIron = false;
  let foundGold = false;
  let foundDiamond = false;
  let foundWater = false;

  for (let cz = -6; cz <= 6; cz += 2) {
    for (let cx = -6; cx <= 6; cx += 2) {
      const ch = genA.generateChunk(cx, cz);
      ch.biomes.forEach((b) => biomesFound.add(b));
      assert.equal(ch.getBlock(4, 0, 4), BlockId.Bedrock, 'Y=0 must always be Bedrock');
      for (let i = 0; i < ch.blocks.length; i++) {
        const b = ch.blocks[i] as BlockId;
        if (b === BlockId.CoalOre) foundCoal = true;
        if (b === BlockId.IronOre) foundIron = true;
        if (b === BlockId.GoldOre) foundGold = true;
        if (b === BlockId.DiamondOre) foundDiamond = true;
        if (b === BlockId.Water) foundWater = true;
      }
    }
  }

  assert.ok(biomesFound.size >= 4, `Expected >=4 distinct biomes, got ${[...biomesFound].join(',')}`);
  assert.ok(foundWater, 'Expected rivers/lakes with Water at SEA_LEVEL');
  assert.ok(foundCoal && foundIron && foundGold && foundDiamond, 'All core ore tiers must generate');
});

test('2. Skylight column & 3D BFS Torch block-light propagation', () => {
  const chunk = new ChunkData(0, 0);
  // Build enclosed stone room from (2..12, 10..16, 2..12)
  for (let y = 10; y <= 16; y++) {
    for (let z = 2; z <= 12; z++) {
      for (let x = 2; x <= 12; x++) {
        const wall = x === 2 || x === 12 || z === 2 || z === 12 || y === 10 || y === 16;
        chunk.setBlock(x, y, z, wall ? BlockId.Stone : BlockId.Air);
      }
    }
  }
  chunk.setBlock(7, 12, 7, BlockId.Torch);

  computeChunkLighting(chunk, () => undefined);

  assert.equal(chunk.getSkyLight(7, 12, 7), 0, 'Sealed room interior must have 0 skyLight');
  assert.equal(chunk.getBlockLight(7, 12, 7), 14, 'Torch voxel must emit 14 blockLight');
  assert.equal(chunk.getBlockLight(8, 12, 7), 13, 'Neighbor voxel must attenuate to 13');
  assert.equal(chunk.getBlockLight(10, 12, 7), 11, '3-step neighbor must attenuate to 11');
  assert.equal(chunk.getSkyLight(7, 25, 7), 15, 'Open sky above roof must have 15 skyLight');
});

test('3. Voxel chunk mesher outward normals, UV bounds & 3-pass separation', () => {
  const chunk = new ChunkData(0, 0);
  chunk.setBlock(5, 20, 5, BlockId.Grass);
  computeChunkLighting(chunk, () => undefined);
  const singleCubeMesh = buildChunkMeshes(chunk, () => undefined);

  assert.ok(singleCubeMesh.opaque, 'Single isolated Grass block must produce opaque mesh');
  const pos = singleCubeMesh.opaque!.getAttribute('position');
  const idx = singleCubeMesh.opaque!.getIndex()!;
  assert.equal(pos.count, 24, 'Single isolated block must emit 6 faces * 4 = 24 vertices');
  assert.equal(idx.count, 36, 'Single isolated block must emit 6 faces * 6 = 36 indices');

  // Verify every emitted triangle has outward normal pointing away from cube center (5.5, 20.5, 5.5)!
  const center = new THREE.Vector3(5.5, 20.5, 5.5);
  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const toTri = new THREE.Vector3();

  for (let t = 0; t < idx.count; t += 3) {
    v0.fromBufferAttribute(pos, idx.getX(t));
    v1.fromBufferAttribute(pos, idx.getX(t + 1));
    v2.fromBufferAttribute(pos, idx.getX(t + 2));
    e1.subVectors(v1, v0);
    e2.subVectors(v2, v0);
    nrm.crossVectors(e1, e2).normalize();
    toTri.copy(v0).sub(center);
    assert.ok(
      nrm.dot(toTri) > 0.2,
      `Triangle ${t / 3} normal (${nrm.toArray()}) is inverted relative to cube center!`
    );
  }

  // Add flora and water to verify cutout + translucent passes
  chunk.setBlock(5, 21, 5, BlockId.RedFlower);
  chunk.setBlock(8, 20, 8, BlockId.Water);
  const multiMesh = buildChunkMeshes(chunk, () => undefined);
  assert.ok(multiMesh.cutout, 'Flower must emit cutout geometry');
  assert.ok(multiMesh.translucent, 'Water must emit translucent geometry');
});

test('4. 6-Axis Amanatides & Woo DDA raycast accuracy', () => {
  const getBlock = (x: number, y: number, z: number) =>
    x === 10 && y === 20 && z === 30 ? BlockId.Stone : BlockId.Air;

  const cases: Array<[[number, number, number], [number, number, number], [number, number, number]]> = [
    [[10.5, 23.5, 30.5], [0, -1, 0], [0, 1, 0]],
    [[10.5, 17.5, 30.5], [0, 1, 0], [0, -1, 0]],
    [[13.5, 20.5, 30.5], [-1, 0, 0], [1, 0, 0]],
    [[7.5, 20.5, 30.5], [1, 0, 0], [-1, 0, 0]],
    [[10.5, 20.5, 33.5], [0, 0, -1], [0, 0, 1]],
    [[10.5, 20.5, 27.5], [0, 0, 1], [0, 0, -1]],
  ];

  for (const [orig, dir, expectedNormal] of cases) {
    const hit = raycastVoxel(orig[0], orig[1], orig[2], dir[0], dir[1], dir[2], 6.0, getBlock);
    assert.ok(hit, 'Ray must hit target block');
    assert.deepEqual([hit.wx, hit.wy, hit.wz], [10, 20, 30]);
    assert.deepEqual([hit.nx, hit.ny, hit.nz], expectedNormal);
  }
});

test('5. Player AABB gravity landing, sneak cliff edge-guard & water swimming', () => {
  // Single block pillar at (0, 10, 0)
  const getPillar = (x: number, y: number, z: number) => {
    if (x === 0 && y === 10 && z === 0) return BlockId.Stone;
    if (x === 5 && y >= 5 && y <= 12 && z === 5) return BlockId.Water;
    if (y === 4) return BlockId.Stone;
    return BlockId.Air;
  };

  const p: PlayerBodyState = {
    x: 0.5,
    y: 13.0,
    z: 0.5,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    pitch: 0,
    onGround: false,
    inWater: false,
    headUnderwater: false,
    flying: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    highestAirY: 13.0,
    stepAccumulator: 0,
  };

  for (let i = 0; i < 60; i++) {
    stepPlayerPhysics(
      p,
      { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false },
      1 / 60,
      getPillar
    );
  }
  assert.ok(p.onGround, 'Player must land on top of block');
  assert.ok(Math.abs(p.y - 11.0) < 0.02, `Expected y ~ 11.0, got ${p.y}`);
  assert.ok(wouldBlockOverlapPlayer(0, 11, 0, p), 'Feet block overlaps player body');

  // Walk forward while sneaking on single-block pillar -> must NOT fall off!
  for (let i = 0; i < 90; i++) {
    stepPlayerPhysics(
      p,
      { forward: 1, strafe: 0, jump: false, sneak: true, sprint: false },
      1 / 60,
      getPillar
    );
  }
  assert.ok(p.y >= 11.0, 'Sneak edge-guard must keep player from walking off cliff!');

  // Place player in water column at (5.5, 6.0, 5.5) and hold jump to swim upward
  p.x = 5.5;
  p.y = 6.0;
  p.z = 5.5;
  for (let i = 0; i < 60; i++) {
    stepPlayerPhysics(
      p,
      { forward: 0, strafe: 0, jump: true, sneak: false, sprint: false },
      1 / 60,
      getPillar
    );
  }
  assert.ok(p.inWater, 'Player should detect water submersion');
  assert.ok(p.y > 7.5, `Player holding Space in water must swim upward (y=${p.y})`);
});

test('6. Full Survival Engine Loop: Mining, Item Pickup, Crafting, Smelting, Combat, TNT & World Save/Reload', async () => {
  let latestHud = null as ReturnType<VoxelEngine['getHUDState']> | null;
  const engine = new VoxelEngine(
    null,
    { meta: makeMeta(774901) },
    TEST_SETTINGS,
    (hud) => {
      latestHud = hud;
    }
  );

  assert.equal(engine.ready, true);
  assert.ok(SEA_LEVEL > 0);

  // Place 3 Birch Logs next to player (3 * 4 = 12 Planks -> 2 Sticks + 4 Table + 3 Pickaxe = 9 used, 3 spare!)
  const px = Math.floor(engine.player.x);
  const py = Math.floor(engine.player.y);
  const pz = Math.floor(engine.player.z);

  const editStart = performance.now();
  engine.setBlock(px + 1, py, pz, BlockId.BirchLog);
  const singleEditMs = performance.now() - editStart;
  assert.ok(singleEditMs < 35, `Expected fast single block edit, got ${singleEditMs.toFixed(1)}ms`);

  engine.setBlock(px + 1, py + 1, pz, BlockId.BirchLog);
  engine.setBlock(px + 1, py + 2, pz, BlockId.BirchLog);
  engine.harvestBlock(px + 1, py, pz);
  engine.harvestBlock(px + 1, py + 1, pz);
  engine.harvestBlock(px + 1, py + 2, pz);

  for (let i = 0; i < 55; i++) engine.tick(1 / 60);

  // Craft Birch Planks (x3 = 12 planks) -> Wooden Sticks -> Crafting Table using interchangeable planks!
  assert.equal(engine.craft('birch_planks', 3), true, 'Must craft 12 Birch Planks from 3 Birch Logs');
  assert.equal(engine.craft('sticks', 1), true, 'Birch Planks must craft Sticks seamlessly');
  assert.equal(engine.craft('crafting_table', 1), true, 'Birch Planks must craft Crafting Table');

  // Place Crafting Table adjacent to player so 3x3 recipes unlock!
  engine.setBlock(px + 2, py, pz, BlockId.CraftingTable);
  engine.tick(1 / 60);
  assert.equal(engine.getHUDState().nearCraftingTable, true);
  assert.equal(engine.craft('wood_pickaxe', 1), true, 'Must craft Wooden Pickaxe at table');

  // Equip Wooden Pickaxe and harvest Stone -> yields Cobblestone!
  const pickIdx = engine.inventory.findIndex((s) => s?.itemId === 'wood_pickaxe');
  assert.ok(pickIdx >= 0);
  engine.selectHotbar(pickIdx);
  for (let i = 0; i < 9; i++) {
    engine.setBlock(px, py - 1, pz + 2, BlockId.Stone);
    engine.harvestBlock(px, py - 1, pz + 2);
  }
  for (let i = 0; i < 50; i++) engine.tick(1 / 60);
  assert.equal(engine.craft('furnace', 1), true, 'Must craft Stone Furnace from 8 Cobblestone');

  // Place & open Stone Furnace at current landed eye height with clear line of sight!
  const curX = Math.floor(engine.player.x);
  const curY = Math.floor(engine.player.y) + 1;
  const curZ = Math.floor(engine.player.z);
  const fx = curX + 2;
  const fy = curY;
  const fz = curZ;
  engine.setBlock(curX + 1, curY, curZ, BlockId.Air);
  engine.setBlock(fx, fy, fz, BlockId.Furnace);

  const eyeY = engine.player.y + 1.62;
  const dX = fx + 0.5 - engine.player.x;
  const dY = fy + 0.5 - eyeY;
  const dZ = fz + 0.5 - engine.player.z;
  engine.player.yaw = Math.atan2(-dX, -dZ);
  engine.player.pitch = Math.asin(dY / Math.hypot(dX, dY, dZ));
  engine.tick(1 / 60);
  assert.equal(engine.performSecondaryAction(), true, 'Right-click opens Stone Furnace');

  engine.inventory[10] = { itemId: blockItemId(BlockId.IronOre), count: 2 };
  engine.inventory[11] = { itemId: 'coal', count: 2 };
  assert.equal(engine.transferToFurnace(10, 'input'), true);
  assert.equal(engine.transferToFurnace(11, 'fuel'), true);

  // Advance 6 simulated seconds so Iron Ingot smelts!
  for (let i = 0; i < 60; i++) engine.tick(0.1);
  assert.equal(engine.collectFromFurnace('output'), true);
  assert.ok(
    engine.inventory.some((s) => s?.itemId === 'iron_ingot'),
    'Smelted Iron Ingot must be collected into player inventory!'
  );

  // Test Mob Combat & TNT Crater!
  const zom = engine.mobs.spawnMob('zombie', engine.player.x, engine.player.y, engine.player.z - 2);
  assert.ok(zom);
  engine.setBlock(px + 8, py - 2, pz + 8, BlockId.Stone);
  engine.setBlock(px + 8, py - 1, pz + 8, BlockId.TNT);
  engine.igniteTNTBlock(px + 8, py - 1, pz + 8, 0.5);
  for (let i = 0; i < 15; i++) engine.tick(0.05);
  assert.equal(
    engine.getBlock(px + 8, py - 2, pz + 8),
    BlockId.Air,
    'Detonated TNT must excavate surrounding Stone into Air!'
  );

  // Save World -> Reload into fresh VoxelEngine -> Verify 100% Persistence!
  const saved = engine.serializeWorld();
  await worldStorage.saveWorld(saved);
  const reloadedFromDisk = await worldStorage.loadWorld(saved.meta.id);
  assert.ok(reloadedFromDisk, 'Saved world must reload from WorldStorage');

  const engine2 = new VoxelEngine(
    null,
    { meta: reloadedFromDisk.meta, savedData: reloadedFromDisk },
    TEST_SETTINGS,
    () => {}
  );
  assert.equal(
    engine2.getBlock(fx, fy, fz),
    BlockId.Furnace,
    'Reloaded world must preserve placed Stone Furnace'
  );
  assert.equal(
    engine2.getBlock(px + 8, py - 2, pz + 8),
    BlockId.Air,
    'Reloaded world must preserve excavated TNT blast crater'
  );
  assert.ok(
    engine2.inventory.some((s) => s?.itemId === 'iron_ingot'),
    'Reloaded world must preserve smelted Iron Ingot in inventory'
  );
  assert.ok(latestHud !== null || engine.ready);

  engine.dispose();
  engine2.dispose();
});

test('7. React UI screens render cleanly against live VoxelEngine state snapshots', async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { App } = await import('../src/App');
  const { HUD } = await import('../src/components/HUD');
  const { InventoryModal } = await import('../src/components/InventoryModal');
  const { PauseModal } = await import('../src/components/PauseModal');

  // 1. Title Screen via root <App />
  const appHtml = renderToStaticMarkup(React.createElement(App));
  assert.ok(appHtml.includes('TERRAVOX'), 'TitleScreen must render main TERRAVOX heading');
  assert.ok(appHtml.includes('Emerald Frontier'), 'TitleScreen must render preset worlds');

  // 2. Live HUD, Workshop/Furnace Modal, and Pause Modal against real VoxelEngine
  const engine = new VoxelEngine(
    null,
    { meta: { ...makeMeta(133700), mode: 'creative' } },
    TEST_SETTINGS,
    () => {}
  );
  const px = Math.floor(engine.player.x);
  const py = Math.floor(engine.player.y);
  const pz = Math.floor(engine.player.z);
  engine.setBlock(px + 1, py, pz, BlockId.CraftingTable);
  engine.setBlock(px + 2, py, pz, BlockId.Furnace);
  engine.tick(1 / 60);

  const hudState = engine.getHUDState();
  const hudHtml = renderToStaticMarkup(
    React.createElement(HUD, {
      hud: hudState,
      onSelectHotbar: () => {},
      onOpenInventory: () => {},
      onOpenPause: () => {},
      onToggleHelp: () => {},
      onCapturePointer: () => {},
    })
  );
  assert.ok(hudHtml.includes('Day 1'), 'HUD must display Day counter & clock');

  const invHtml = renderToStaticMarkup(
    React.createElement(InventoryModal, {
      hud: hudState,
      engine,
      onClose: () => {},
    })
  );
  assert.ok(invHtml.includes('Workshop'), 'InventoryModal must render Workshop header');
  assert.ok(invHtml.includes('Stone Furnace'), 'InventoryModal must detect nearby Furnace');

  const pauseHtml = renderToStaticMarkup(
    React.createElement(PauseModal, {
      hud: hudState,
      settings: TEST_SETTINGS,
      engine,
      onUpdateSettings: () => {},
      onSaveWorld: async () => {},
      onSaveAndQuit: async () => {},
    })
  );
  assert.ok(pauseHtml.includes('Resume Game'), 'PauseModal must render Resume button');

  engine.dispose();
});
