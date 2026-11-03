// Headless engine smoke tests (run with: npx tsx smoke.test.ts)
import { World, SEA, WORLD_H } from './src/game/world';
import { B, blockDrops, breakSeconds, blockDef } from './src/game/blocks';
import { matchRecipe, I, mkStack } from './src/game/items';
import { Inventory } from './src/game/inventory';
import { makeBody, moveBody, raycastVoxel } from './src/game/physics';
import * as THREE from 'three';

let pass = 0, fail = 0;
function ok(cond: boolean, name: string) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.error('  ✗ FAIL:', name); }
}

console.log('— recipes —');
{
  const planks = matchRecipe([mkStack(B.Log, 1), null, null, null], 2, 2);
  ok(!!planks && planks.out.id === B.Planks && planks.out.count === 4, 'log -> 4 planks (shapeless)');
  const grid9 = new Array(9).fill(null);
  grid9[0] = mkStack(B.Planks); grid9[1] = mkStack(B.Planks); grid9[2] = mkStack(B.Planks);
  grid9[4] = mkStack(I.Stick); grid9[7] = mkStack(I.Stick);
  const pick = matchRecipe(grid9, 3, 3);
  ok(!!pick && pick.out.id === I.WoodPick, 'wooden pickaxe shaped recipe');
  const torch = matchRecipe([mkStack(I.Coal), null, mkStack(I.Stick), null], 2, 2);
  ok(!!torch && torch.out.id === B.Torch && torch.out.count === 4, 'torch recipe');
  ok(matchRecipe([null, null, null, null], 2, 2) === null, 'empty grid -> no recipe');
}

console.log('— inventory —');
{
  const inv = new Inventory();
  ok(inv.add(mkStack(B.Dirt, 70)) === 0, 'add 70 dirt fits');
  ok(inv.count(B.Dirt) === 70, 'count merges stacks (64+6)');
  ok(inv.slots[0]?.count === 64 && inv.slots[1]?.count === 6, 'stack split 64/6 into hotbar');
}

console.log('— world generation —');
const world = new World(20240607);
const spawn = world.findSpawn();
console.log('  spawn:', spawn);
const t0 = performance.now();
const scx = Math.floor(spawn.x / 16), scz = Math.floor(spawn.z / 16);
for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) world.generateChunk(scx + dx, scz + dz);
const genMs = (performance.now() - t0) / 25;
console.log(`  avg chunk gen: ${genMs.toFixed(2)} ms`);
ok(genMs < 40, 'chunk gen fast enough (<40ms)');
{
  const sx = Math.floor(spawn.x), sz = Math.floor(spawn.z);
  const h = world.heightAt(sx, sz);
  ok(h > SEA, `spawn on dry land (h=${h} > SEA=${SEA})`);
  ok(world.getBlock(sx, 0, sz) === B.Bedrock, 'bedrock at y=0');
  const surfLight = world.getLightPacked(sx, h + 1, sz) >> 4;
  ok(surfLight === 15, `surface sunlight is 15 (got ${surfLight})`);
  const spawnBiome = world.biomeInfo(sx, sz).biome;
  ok(spawnBiome === 'plains' || spawnBiome === 'forest', `spawn biome is plains/forest (got ${spawnBiome})`);
  // find a dark underground air pocket (cave)
  let cave: { x: number; y: number; z: number } | null = null;
  let caveAir = 0, darkAir = 0;
  for (let x = sx - 38; x < sx + 38; x++) for (let z = sz - 38; z < sz + 38; z++) for (let y = 5; y < 28; y++) {
    if (world.getBlock(x, y, z) === B.Air) {
      caveAir++;
      if ((world.getLightPacked(x, y, z) >> 4) <= 2) { darkAir++; if (!cave) cave = { x, y, z }; }
    }
  }
  console.log(`  underground air cells: ${caveAir}, dark(sun<=2): ${darkAir}`);
  ok(caveAir > 200, 'caves carve significant volume');
  ok(!!cave && darkAir > 50, `dark cave pockets exist ${cave ? JSON.stringify(cave) : ''}`);
  // ores present somewhere underground
  let ores = 0;
  for (let x = sx - 32; x < sx + 32; x += 2) for (let z = sz - 32; z < sz + 32; z += 2) for (let y = 3; y < 40; y += 2) {
    const id = world.getBlock(x, y, z);
    if (id === B.CoalOre || id === B.IronOre || id === B.GoldOre || id === B.DiamondOre) ores++;
  }
  ok(ores > 4, `ores generate underground (sampled ${ores})`);
  // trees: count trunks in generated area + in a dedicated forest patch
  let trunks = 0;
  for (let x = sx - 40; x < sx + 40; x++) for (let z = sz - 40; z < sz + 40; z++) for (let y = SEA; y < SEA + 22; y++) {
    const id = world.getBlock(x, y, z);
    if (id === B.Log || id === B.BirchLog || id === B.PineLog) trunks++;
  }
  console.log(`  log blocks near spawn: ${trunks}`);
  // find a forest sample point via biome scan, generate 3x3 chunks there
  let forestLogs = 0;
  outer2: for (let gx = -500; gx < 500; gx += 16) for (let gz = -500; gz < 500; gz += 16) {
    if (world.biomeInfo(gx, gz).biome === 'forest') {
      const fcx = gx >> 4, fcz = gz >> 4;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) world.generateChunk(fcx + dx, fcz + dz);
      for (let x = gx - 16; x < gx + 32; x++) for (let z = gz - 16; z < gz + 32; z++) for (let y = SEA; y < SEA + 24; y++) {
        const id = world.getBlock(x, y, z);
        if (id === B.Log || id === B.BirchLog) forestLogs++;
      }
      break outer2;
    }
  }
  console.log(`  log blocks in forest patch: ${forestLogs}`);
  ok(trunks + forestLogs > 30, 'trees generate (logs found)');
}

console.log('— lighting edits —');
{
  // find cave again, place torch, check propagation & removal
  const sx = Math.floor(spawn.x), sz = Math.floor(spawn.z);
  let cave: { x: number; y: number; z: number } | null = null;
  outer: for (let x = sx - 38; x < sx + 38 && !cave; x++) for (let z = sz - 38; z < sz + 38 && !cave; z++) for (let y = 8; y < 28; y++) {
    if (world.getBlock(x, y, z) === B.Air && blockDef(world.getBlock(x, y - 1, z)).solid && (world.getLightPacked(x, y, z) >> 4) <= 2) { cave = { x, y, z }; break outer; }
  }
  if (cave) {
    world.setBlock(cave.x, cave.y, cave.z, B.Torch);
    const here = world.getLightPacked(cave.x, cave.y, cave.z) & 15;
    const near = world.getLightPacked(cave.x + 1, cave.y, cave.z) & 15;
    ok(here === 14, `torch cell block-light 14 (got ${here})`);
    ok(near >= 10, `torch light propagates to neighbour (got ${near})`);
    world.setBlock(cave.x, cave.y, cave.z, B.Air);
    const after = world.getLightPacked(cave.x, cave.y, cave.z) & 15;
    ok(after <= 2, `removing torch darkens cell again (got ${after})`);
  } else ok(false, 'cave found for torch test');
}

console.log('— mining rules —');
{
  ok(blockDrops(B.Stone, { type: 'pickaxe', tier: 0 }, Math.random)[0]?.id === B.Cobble, 'stone + pickaxe -> cobblestone');
  ok(blockDrops(B.Stone, null, Math.random).length === 0, 'stone bare-handed -> no drop');
  ok(blockDrops(B.IronOre, { type: 'pickaxe', tier: 0 }, Math.random).length === 0, 'iron ore needs stone pickaxe');
  ok(blockDrops(B.IronOre, { type: 'pickaxe', tier: 1 }, Math.random).length === 1, 'iron ore + stone pickaxe drops');
  ok(blockDrops(B.Grass, null, Math.random)[0]?.id === B.Dirt, 'grass -> dirt');
  ok(!isFinite(breakSeconds(B.Bedrock, { type: 'pickaxe', tier: 3 })), 'bedrock unbreakable');
  const fast = breakSeconds(B.Stone, { type: 'pickaxe', tier: 2 });
  const slow = breakSeconds(B.Stone, null);
  ok(fast < slow, `iron pick (${fast.toFixed(2)}s) faster than hand (${slow.toFixed(2)}s) on stone`);
}

console.log('— physics & raycast —');
{
  const sx = Math.floor(spawn.x), sz = Math.floor(spawn.z);
  const h = world.heightAt(sx, sz);
  const body = makeBody(new THREE.Vector3(spawn.x, h + 18, spawn.z), 0.3, 1.8);
  for (let i = 0; i < 400; i++) {
    body.vel.y -= 28 / 60;
    moveBody(world, body, 1 / 60);
  }
  ok(body.onGround, 'falling body lands (onGround)');
  ok(Math.abs(body.pos.y - (h + 1)) < 1.6, `lands near ground top (y=${body.pos.y.toFixed(2)}, ground=${h + 1})`);
  const hit = raycastVoxel(world, new THREE.Vector3(spawn.x, h + 5, spawn.z), new THREE.Vector3(0, -1, 0), 20);
  ok(!!hit && hit.ny === 1, 'downward raycast hits ground with up-normal');
  ok(!!hit && Math.abs(hit.y - h) <= 1, `raycast ground y=${hit?.y} ≈ heightmap ${h}`);
}

console.log('— gravity blocks & fluids —');
{
  const sx = Math.floor(spawn.x) + 3, sz = Math.floor(spawn.z) + 3;
  const h = world.heightAt(sx, sz);
  // clear a little column then put sand in the air
  world.setBlock(sx, h + 5, sz, B.Sand);
  for (let i = 0; i < 60; i++) world.tick(0.1);
  const sandY = world.heightAt(sx, sz);
  ok(world.getBlock(sx, sandY, sz) === B.Sand, `sand fell and rests on ground (top y=${sandY})`);
  // water flows downward from a floating source
  const wx = sx + 2, wz = sz;
  const wh = world.heightAt(wx, wz);
  world.setBlock(wx, wh + 3, wz, B.Water);
  let flowed = false;
  for (let i = 0; i < 80 && !flowed; i++) {
    world.tick(0.1);
    if (world.getBlock(wx, wh + 2, wz) === B.Water || world.getBlock(wx, wh + 1, wz) === B.Water) flowed = true;
  }
  ok(flowed, 'water flows downward');
}

console.log('— edits persistence shape —');
{
  const edits = [...world.edits.entries()];
  ok(edits.length > 0, `edits recorded (${edits.length} chunk buckets)`);
  // regenerate a fresh world with same seed + edits applied -> torch cell edit persists
  const w2 = new World(20240607);
  for (const [k, m] of world.edits) w2.edits.set(k, new Map(m));
  const sx = Math.floor(spawn.x) + 3, sz = Math.floor(spawn.z) + 3;
  w2.generateChunk(sx >> 4, sz >> 4);
  const idAtSand = w2.getBlock(sx, world.heightAt(sx, sz), sz);
  ok(idAtSand === B.Sand, 'edits reapplied on regeneration (sand present)');
  void WORLD_H;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
