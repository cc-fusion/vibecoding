export type Settings = {
  dimension: number;
  scene: number;
  material: number;
  resolution: number;
  count: number;
  gravity: number;
  stiffness: number;
  friction: number;
  dt: number;
};

export type SimulationFrame = {
  particles: Float32Array;
  count: number;
  frame: number;
  time: number;
  substeps: number;
  blocks: number;
  memory: number;
  duration: number;
  generation: number;
};

export const initialSettings: Settings = {
  dimension: 3,
  scene: 0,
  material: 0,
  resolution: 64,
  count: 18000,
  gravity: -9.8,
  stiffness: 50000,
  friction: 30,
  dt: 0.0002,
};

export const materials = [
  {
    name: "Sand",
    color: "#9de8c1",
    model: "Drucker-Prager plasticity",
    description: "Grains that flow, settle, and hold their shape.",
  },
  {
    name: "Snow",
    color: "#dee9f5",
    model: "Elastoplastic snow",
    description: "Soft, compressible matter with a memory.",
  },
  {
    name: "Jelly",
    color: "#c0acf3",
    model: "Fixed-corotated elasticity",
    description: "A little bounce. A lot of deformation.",
  },
  {
    name: "Water",
    color: "#86c9f4",
    model: "Weakly compressible fluid",
    description: "A fluid that finds its own way.",
  },
  {
    name: "Plastic",
    color: "#efb89b",
    model: "Von Mises plasticity",
    description: "Elastic until its yield point, then permanently changed.",
  },
  {
    name: "Viscoelastic",
    color: "#e5bf7e",
    model: "Viscoelastic constitutive model",
    description: "Between a solid and a fluid.",
  },
  {
    name: "Elastic",
    color: "#e99dba",
    model: "Logarithmic elasticity",
    description: "Stretch it and let it recover.",
  },
  {
    name: "Linear",
    color: "#c0c7a0",
    model: "Linear elasticity",
    description: "Small-strain elastic material.",
  },
];

export const presets = [
  {
    name: "Sand collapse",
    label: "A study in falling grains",
    scene: 0,
    material: 0,
    tag: "GRANULAR",
    color: "#9de8c1",
  },
  {
    name: "Jelly drop",
    label: "Elasticity in motion",
    scene: 1,
    material: 2,
    tag: "ELASTIC",
    color: "#c0acf3",
  },
  {
    name: "Dam break",
    label: "Let the water find its way",
    scene: 2,
    material: 3,
    tag: "FLUID",
    color: "#86c9f4",
  },
  {
    name: "CPIC cutting",
    label: "Displacement discontinuities",
    scene: 3,
    material: 1,
    tag: "CUTTING",
    color: "#dee9f5",
  },
  {
    name: "Rigid coupling",
    label: "Two-way material interaction",
    scene: 4,
    material: 0,
    tag: "COUPLING",
    color: "#efb89b",
  },
];
