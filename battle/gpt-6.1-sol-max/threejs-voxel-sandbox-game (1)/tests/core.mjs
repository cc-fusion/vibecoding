import assert from 'node:assert/strict';
import * as THREE from 'three';
import { VoxelWorld, CHUNK, HEIGHT } from '../src/game/world.js';
import { Player } from '../src/game/player.js';
import { B } from '../src/game/blocks.js';
import { hash, fbm, seedNumber } from '../src/game/noise.js';

const results = [];
function test(name, fn) { fn(); results.push(name); console.log(`PASS ${name}`); }
function world(seed = 'wildwood', changes = {}) {
  const w = Object.create(VoxelWorld.prototype);
  Object.assign(w, { seed: seedNumber(seed), changes, chunks: new Map(), columns: new Map(), dirty: new Set() });
  return w;
}
const flat = { getBlock: (x, y) => Math.floor(y) <= 0 ? B.STONE : B.AIR };
const simulate = (p, seconds, keys = {}) => { for (let i = 0; i < seconds * 90; i++) p.update(1 / 90, keys); };

test('Seeded noise is deterministic, bounded, and seed-dependent', () => {
  assert.equal(hash(4, 5, 6, 99), hash(4, 5, 6, 99));
  assert.notEqual(hash(4, 5, 6, 99), hash(4, 5, 6, 100));
  for (let i = -100; i < 100; i++) assert.ok(Math.abs(fbm(i * 0.13, i * 0.37, 991)) <= 1);
});
test('Chunk terrain and vegetation regenerate identically', () => {
  const a = world(), b = world();
  assert.deepEqual(a.generate(-1, 1).data, b.generate(-1, 1).data);
  assert.equal(a.chunks.get('-1,1').data.length, CHUNK * CHUNK * HEIGHT);
  assert.notDeepEqual(a.chunks.get('-1,1').data, world('another-seed').generate(-1, 1).data);
});
test('All four biomes exist in the seeded world', () => {
  const w = world(), found = new Set();
  for (let z = -1800; z <= 1800; z += 40) for (let x = -1800; x <= 1800; x += 40) found.add(w.column(x, z).biome);
  assert.deepEqual([...found].sort(), ['Alpine', 'Dunes', 'Meadow', 'Woodland']);
});
test('Negative-coordinate edits dirty both sides of a chunk border', () => {
  const w = world(); w.generate(-1, 0); w.generate(0, 0); w.setBlock(-1, 40, 4, B.PLANKS);
  assert.equal(w.getBlock(-1, 40, 4), B.PLANKS); assert.ok(w.dirty.has('0,0'));
  const reloaded = world('wildwood', JSON.parse(JSON.stringify(w.changes))); reloaded.generate(-1, 0);
  assert.equal(reloaded.getBlock(-1, 40, 4), B.PLANKS);
  assert.equal(reloaded.getBlock(-2, 40, 4), w.getBlock(-2, 40, 4));
});
test('Voxel DDA handles zero axes, placement normals, and reach limits', () => {
  const w = world(); w.getBlock = (x, y, z) => x === -3 && y === 8 && z === 2 ? B.STONE : B.AIR;
  const hit = w.raycast(new THREE.Vector3(1.5, 8.5, 2.5), new THREE.Vector3(-1, 0, 0), 6);
  assert.equal(hit.x, -3); assert.deepEqual(hit.normal, [1, 0, 0]); assert.equal(hit.distance, 3.5);
  assert.equal(w.raycast(new THREE.Vector3(1.5, 8.5, 2.5), new THREE.Vector3(-1, 0, 0), 2), null);
});
test('Gravity settles on solid ground without penetration', () => {
  const p = new Player(flat, new THREE.Vector3(0.5, 5, 0.5)); simulate(p, 3);
  assert.equal(p.position.y, 1); assert.equal(p.grounded, true); assert.equal(p.collides(), false);
});
test('AABB movement cannot pass through a wall', () => {
  const w = { getBlock: (x, y) => Math.floor(y) <= 0 || (Math.floor(x) === 3 && y < 5) ? B.STONE : 0 };
  const p = new Player(w, new THREE.Vector3(0.5, 1, 0.5)); p.yaw = -Math.PI / 2; simulate(p, 4, { KeyW: true });
  assert.ok(p.position.x <= 3 - p.radius + 0.001); assert.ok(p.position.x > 2.5); assert.equal(p.collides(), false);
});
test('Jump clears a full block and returns safely to ground', () => {
  const p = new Player(flat, new THREE.Vector3(0.5, 1, 0.5)); simulate(p, 0.1); p.update(1 / 90, { Space: true });
  let apex = p.position.y;
  for (let i = 0; i < 100; i++) { p.update(1 / 90, {}); apex = Math.max(apex, p.position.y); }
  assert.ok(apex > 2.1 && apex < 2.4); assert.equal(p.position.y, 1); assert.equal(p.collides(), false);
});
test('Diagonal movement is normalized and stamina recovers', () => {
  const a = new Player(flat, new THREE.Vector3(0, 1, 0)), b = new Player(flat, new THREE.Vector3(0, 1, 0));
  a.yaw = b.yaw = 0; simulate(a, 2, { KeyW: true }); simulate(b, 2, { KeyW: true, KeyD: true });
  assert.ok(Math.abs(a.position.length() - b.position.length()) < 0.01);
  simulate(a, 2, { KeyW: true, ShiftLeft: true }); assert.ok(a.stamina < 90); simulate(a, 4); assert.equal(a.stamina, 100);
});
test('Water permits swimming and Creative flight rises predictably', () => {
  const wet = { getBlock: (x, y) => y <= 0 ? B.STONE : y < 5 ? B.WATER : 0 };
  const p = new Player(wet, new THREE.Vector3(0, 1, 0)); simulate(p, 0.5, { Space: true }); assert.ok(p.position.y > 2); assert.equal(p.collides(), false);
  const flyer = new Player(flat, new THREE.Vector3(0, 1, 0)); flyer.flying = true; simulate(flyer, 1, { Space: true }); assert.ok(flyer.position.y > 7);
});
console.log(`\n${results.length} core-system tests passed.`);