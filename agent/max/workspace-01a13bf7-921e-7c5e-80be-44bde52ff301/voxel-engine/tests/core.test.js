import test from "node:test";
import assert from "node:assert/strict";
import { VoxelWorld, chunkKey } from "../engine/world.js";
import { meshChunk } from "../engine/mesher.js";
import { SimplexNoise, hashString, mulberry32 } from "../engine/noise.js";
const palette = [
  [0, 0, 0],
  [1, 1, 1],
  [0.2, 0.5, 0.7],
];
const build = (w, c = [...w.chunks.values()][0], options = {}) =>
  meshChunk(w.snapshot(c), palette, options);
test("negative coordinates and 3D chunk boundaries round-trip", () => {
  const w = new VoxelWorld();
  for (const p of [
    [-17, -17, -17],
    [-16, -16, -16],
    [-1, -1, -1],
    [0, 0, 0],
    [15, 15, 15],
    [16, 16, 16],
  ])
    w.set(...p, 2);
  assert.equal(w.chunks.size, 4);
  assert.equal(w.voxelCount, 6);
  assert.equal(w.get(-17, -17, -17), 2);
  assert.equal(w.get(-18, -17, -17), 0);
  w.set(-1, -1, -1, 0);
  assert.equal(w.voxelCount, 5);
});
test("no-op writes do not dirty or inflate counts", () => {
  const w = new VoxelWorld();
  w.set(1, 1, 1, 1);
  w.dirty.clear();
  w.set(1, 1, 1, 1);
  assert.equal(w.dirty.size, 0);
  assert.equal(w.voxelCount, 1);
  w.set(1, 1, 1, 2);
  assert.equal(w.voxelCount, 1);
});
test("coordinates and IDs are validated", () => {
  const w = new VoxelWorld();
  for (const args of [
    [0, 0, 0, 256],
    [0, 0, 0, -1],
    [0.5, 0, 0, 1],
    [Infinity, 0, 0, 1],
  ])
    assert.throws(() => w.set(...args), RangeError);
});
test("an isolated cube has 6 quads and 12 triangles", () => {
  const w = new VoxelWorld();
  w.set(0, 0, 0, 1);
  const m = build(w);
  assert.equal(m.quads, 6);
  assert.equal(m.indices.length, 36);
  assert.equal(m.positions.length, 72);
});
test("adjacent cubes cull their shared faces", () => {
  const w = new VoxelWorld();
  w.set(0, 0, 0, 1);
  w.set(1, 0, 0, 1);
  const m = build(w, undefined, { greedy: false });
  assert.equal(m.faces, 10);
  assert.equal(m.quads, 10);
});
test("greedy merging reduces a full chunk to 6 quads", () => {
  const w = new VoxelWorld();
  for (let x = 0; x < 16; x++)
    for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) w.set(x, y, z, 1);
  const m = build(w);
  assert.equal(m.faces, 1536);
  assert.equal(m.quads, 6);
});
test("greedy merging never merges different materials", () => {
  const w = new VoxelWorld();
  w.set(0, 0, 0, 1);
  w.set(1, 0, 0, 2);
  assert.equal(build(w).quads, 10);
});
test("culling crosses chunk boundaries", () => {
  const w = new VoxelWorld();
  w.set(15, 1, 1, 1);
  w.set(16, 1, 1, 1);
  assert.equal(
    [...w.chunks.values()].reduce((n, c) => n + build(w, c).faces, 0),
    10,
  );
});
test("corner edits invalidate diagonal AO neighbors", () => {
  const w = new VoxelWorld();
  for (let x = -1; x <= 0; x++)
    for (let y = -1; y <= 0; y++)
      for (let z = -1; z <= 0; z++) w.set(x * 16, y * 16, z * 16, 1);
  w.dirty.clear();
  w.set(0, 0, 0, 2);
  assert.equal(w.dirty.size, 8);
  assert(w.dirty.has(chunkKey(-1, -1, -1)));
});
test("all triangles are counterclockwise relative to outward normals", () => {
  const w = new VoxelWorld();
  w.set(1, 1, 1, 1);
  const m = build(w);
  for (let i = 0; i < m.indices.length; i += 3) {
    const [a, b, c] = Array.from(m.indices.slice(i, i + 3)).map((i) =>
      Array.from(m.positions.slice(i * 3, i * 3 + 3)),
    );
    const u = b.map((v, k) => v - a[k]),
      v = c.map((v, k) => v - a[k]),
      cross = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ],
      n = m.normals.slice(m.indices[i] * 3, m.indices[i] * 3 + 3);
    assert(cross.reduce((s, v, k) => s + v * n[k], 0) > 0);
  }
});
test("AO produces darker vertices and can be disabled", () => {
  const w = new VoxelWorld();
  w.set(1, 1, 1, 1);
  w.set(2, 2, 1, 1);
  const on = build(w, undefined, { ao: true }),
    off = build(w, undefined, { ao: false });
  assert(Math.min(...on.colors) < 1);
  assert.equal(Math.min(...off.colors), 1);
});
test("removing every voxel produces no geometry", () => {
  const w = new VoxelWorld();
  w.set(0, 0, 0, 1);
  w.set(0, 0, 0, 0);
  assert.equal(build(w).indices.length, 0);
});
test("world serialization preserves every chunk byte", () => {
  const w = new VoxelWorld();
  w.set(-1, 2, 16, 1);
  w.set(0, 10, 0, 2);
  const restored = VoxelWorld.fromJSON(JSON.parse(JSON.stringify(w)));
  assert.deepEqual(restored.toJSON(), w.toJSON());
  assert.equal(restored.voxelCount, 2);
});
test("malformed, oversized and duplicate imports are rejected", () => {
  assert.throws(() => VoxelWorld.fromJSON({ format: "wrong" }));
  assert.throws(() =>
    VoxelWorld.fromJSON({
      format: "voxel-core",
      version: 1,
      chunks: new Array(513),
    }),
  );
  const w = new VoxelWorld();
  w.set(0, 0, 0, 1);
  const j = w.toJSON();
  j.chunks.push(j.chunks[0]);
  assert.throws(() => VoxelWorld.fromJSON(j), /Duplicate/);
});
test("noise and PRNG are deterministic for the same seed", () => {
  const a = new SimplexNoise(hashString("test")),
    b = new SimplexNoise(hashString("test"));
  for (let i = 0; i < 100; i++)
    assert.equal(
      a.noise3D(i * 0.11, i * 0.05, i * 0.3),
      b.noise3D(i * 0.11, i * 0.05, i * 0.3),
    );
  const c = mulberry32(42),
    d = mulberry32(42);
  for (let i = 0; i < 10; i++) assert.equal(c(), d());
});
