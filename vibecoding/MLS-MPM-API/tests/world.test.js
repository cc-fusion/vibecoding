import { describe, expect, it } from "vitest";
import { World } from "../src/world.js";
import { Material } from "../src/types.js";
const noGravity = { gravity: { x: 0, y: 0 } };
describe("World API", () => {
  it("accepts custom particles without any asset files", () => {
    const world = new World({ gridSize: 32, maxParticles: 100, ...noGravity });
    expect(world.dx).toBe(1 / 32);
    expect(world.defaultParticleVolume).toBeCloseTo((0.5 / 32) ** 2, 14);
    const fluid = world.addParticle({ x: 0.5, y: 0.5, material: "fluid" });
    expect(fluid).toBe(0);
    expect(world.F.slice(0, 4)).toEqual(new Float64Array([1, 0, 0, 1]));
    const added = world.addParticles({
      positions: [0.3, 0.4, 0.6, 0.7],
      velocities: [1, 0, -1, 0],
      material: Material.Elastic
    });
    expect(added).toBe(2);
    expect(world.count).toBe(3);
    expect(world.materialCounts).toEqual([1, 2, 0]);
    expect(world.velocities[2]).toBe(1);
    expect(world.velocities[4]).toBe(-1);
  });
  it("samples rectangles, circles, and ellipses procedurally", () => {
    const world = new World({ gridSize: 32, maxParticles: 1e3 });
    expect(
      world.addRectangle({
        x: 0.1,
        y: 0.1,
        width: 0.2,
        height: 0.2,
        spacing: 0.025,
        material: "fluid"
      })
    ).toBe(64);
    const circleCount = world.addCircle({
      x: 0.7,
      y: 0.7,
      radiusX: 0.1,
      spacing: 0.025,
      material: "elastic"
    });
    const ellipseCount = world.addEllipse({
      x: 0.5,
      y: 0.75,
      radiusX: 0.12,
      radiusY: 0.06,
      spacing: 0.025,
      material: "snow"
    });
    expect(circleCount).toBeGreaterThan(30);
    expect(ellipseCount).toBeGreaterThan(20);
    expect(world.count).toBe(64 + circleCount + ellipseCount);
    expect(world.volumes[0]).toBeCloseTo(0.025 ** 2, 14);
    for (let p = 0; p < world.count; p++) {
      expect(world.positions[p * 2]).toBeGreaterThan(0);
      expect(world.positions[p * 2]).toBeLessThan(1);
    }
  });
  it("merges nested runtime parameters and returns defensive copies", () => {
    const world = new World();
    world.configure({
      gravity: { x: 2 },
      timeStep: 5e-5,
      fluid: { bulkModulus: 250 },
      snow: { minStretch: 0.95 }
    });
    const parameters = world.getParameters();
    expect(parameters.gravity).toEqual({ x: 2, y: -9.8 });
    expect(parameters.timeStep).toBe(5e-5);
    expect(parameters.fluid.bulkModulus).toBe(250);
    expect(parameters.snow.minStretch).toBe(0.95);
    expect(parameters.snow.maxStretch).toBe(1.0045);
    parameters.gravity.y = 0;
    expect(world.getParameters().gravity.y).toBe(-9.8);
    expect(() => world.configure({ elastic: { poissonRatio: 0.5 } })).toThrow();
    expect(world.getParameters().elastic.poissonRatio).toBe(0.2);
  });
  it("applies a custom gravity vector during the grid operation", () => {
    const world = new World({ gridSize: 32, gravity: { x: 1, y: -2 } });
    world.addParticle({ x: 0.5, y: 0.5, material: "elastic" });
    world.step();
    expect(world.velocities[0]).toBeCloseTo(world.timeStep, 12);
    expect(world.velocities[1]).toBeCloseTo(-2 * world.timeStep, 12);
    expect(world.lastGridMass).toBeCloseTo(world.defaultParticleVolume, 12);
  });
  it("uses per-particle volume and global density for grid mass", () => {
    const world = new World({ gridSize: 32, density: 2, ...noGravity });
    world.addParticle({ x: 0.5, y: 0.5, material: "fluid", volume: 5e-3 });
    world.step();
    expect(world.lastGridMass).toBeCloseTo(0.01, 12);
  });
  it("preserves uniform translation with numerical viscosity enabled", () => {
    const world = new World({ gridSize: 32, ...noGravity });
    world.addParticle({ x: 0.5, y: 0.5, material: "elastic", vx: 0.4, vy: -0.2 });
    world.step();
    expect(world.velocities[0]).toBeCloseTo(0.4, 12);
    expect(world.velocities[1]).toBeCloseTo(-0.2, 12);
    expect(world.positions[0]).toBeCloseTo(0.5 + world.timeStep * 0.4, 12);
  });
  it("honors custom snow plastic parameters", () => {
    const world = new World({
      gridSize: 32,
      ...noGravity,
      snow: { minStretch: 0.9, maxStretch: 1.01 }
    });
    world.addParticle({ x: 0.5, y: 0.5, material: "snow" });
    world.F[0] = 1.1;
    world.step();
    expect(world.F[0]).toBeCloseTo(1.01, 10);
    expect(world.Jp[0]).toBeCloseTo(1.1 / 1.01, 10);
  });
  it("saves and restores complete simulation states", () => {
    const world = new World({ gridSize: 32 });
    world.addRectangle({ x: 0.2, y: 0.2, width: 0.1, height: 0.1, material: "elastic" });
    const initial = world.getState();
    const initialPositions = new Float64Array(world.positions.slice(0, world.count * 2));
    for (let i = 0; i < 20; i++) world.step();
    expect(world.simulationTime).toBeGreaterThan(0);
    world.restore(initial);
    expect(world.simulationTime).toBe(0);
    expect(world.totalSteps).toBe(0);
    expect(world.positions.slice(0, world.count * 2)).toEqual(initialPositions);
    expect(world.C.slice(0, world.count * 4)).toEqual(initial.C);
  });
  it("validates capacity and malformed particle arrays", () => {
    const world = new World({ maxParticles: 1 });
    expect(() => world.addParticles({ positions: [0.5, 0.5, 0.6], material: "fluid" })).toThrow();
    world.addParticle({ x: 0.5, y: 0.5, material: "fluid" });
    expect(() => world.addParticle({ x: 0.6, y: 0.6, material: "snow" })).toThrow(/capacity/);
    expect(() => new World({ gridSize: 4 })).toThrow(/gridSize/);
  });
  it("runs mixed procedural scenes as a headless solver", () => {
    const world = new World({ gridSize: 40, maxParticles: 5e3 });
    world.addRectangle({ x: 0.1, y: 0.05, width: 0.2, height: 0.3, material: "fluid" });
    world.addCircle({ x: 0.65, y: 0.7, radiusX: 0.09, material: "elastic" });
    world.addEllipse({ x: 0.4, y: 0.7, radiusX: 0.1, radiusY: 0.07, material: "snow" });
    for (let step = 0; step < 150; step++) world.step();
    expect(world.totalSteps).toBe(150);
    expect(world.simulationTime).toBeCloseTo(150 * world.timeStep, 14);
    for (let p = 0; p < world.count * 2; p++) {
      expect(Number.isFinite(world.positions[p])).toBe(true);
      expect(Number.isFinite(world.velocities[p])).toBe(true);
    }
  });
});
