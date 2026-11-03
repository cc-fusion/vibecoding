export const runnableCode = `<canvas id="world" style="width:100%;height:420px"></canvas>
<script src="./mpm.js"></script>
<script>
  (async () => {
    const sim = await MPM.create({
      canvas: '#world',
      scene: MPM.demoScene('sand'),
      interactions: { material: 'sand' }
    });
  })().catch(console.error);
</script>`;

export const sceneCode = `const scene = MPM.createScene({
  gravity: [0, -5],
  particles: [{
    material: 'sand',
    shape: 'circle',
    center: [0.5, 0.65],
    radius: 0.12,
    color: '#edbc72'
  }]
});

const sim = await MPM.create({ canvas: '#world', scene });`;

export const wheelCode = `// Add a little momentum. No restart needed.
const wheel = sim.addWheel({
  center: [0.5, 0.25],
  radius: 0.11,
  blades: 8,
  speed: 90
});

wheel.setSpeed(-120);  // Try the other direction.
wheel.stop();
wheel.start(90);`;

export const DOC_GROUPS = [
  {
    label: "GETTING STARTED",
    items: [
      {
        id: "overview",
        title: "Overview",
        icon: "overview",
        description:
          "Meet mpm.js, the framework-free material physics library.",
      },
      {
        id: "installation",
        title: "Installation",
        icon: "download",
        description:
          "A script tag is all it takes. Download and install the library.",
      },
      {
        id: "quick-start",
        title: "Quick start",
        icon: "zap",
        description:
          "Your first working simulation in a few lines of JavaScript.",
      },
    ],
  },
  {
    label: "CORE CONCEPTS",
    items: [
      {
        id: "scenes",
        title: "Creating scenes",
        icon: "box",
        description: "Build your own world with plain JavaScript objects.",
      },
      {
        id: "materials",
        title: "Materials",
        icon: "layers",
        description: "Sand, water, jelly, snow, elasticity, and plasticity.",
      },
      {
        id: "runtime",
        title: "Runtime controls",
        icon: "sliders",
        description:
          "Add particles, change gravity, and control a running simulation.",
        isNew: true,
      },
    ],
  },
  {
    label: "MAKE IT INTERACTIVE",
    items: [
      {
        id: "interactions",
        title: "Touch & mouse",
        icon: "pointer",
        description: "Pointer Events for mouse, touch, and pen interactions.",
      },
      {
        id: "wheels",
        title: "Automatic wheels",
        icon: "wheel",
        description:
          "Add physically coupled automatic wheels and change their speed.",
      },
      {
        id: "playground",
        title: "Playground",
        icon: "play",
        description:
          "Experiment with live materials, gravity, wheels, and original scenes.",
      },
    ],
  },
  {
    label: "RESOURCES",
    items: [
      {
        id: "api",
        title: "API reference",
        icon: "code",
        description:
          "The complete public API, events, and low-level solver exports.",
      },
      {
        id: "examples",
        title: "Examples",
        icon: "grid",
        description: "Explore 2D and 3D scenes and run a plain HTML example.",
      },
      {
        id: "changelog",
        title: "Changelog",
        icon: "clock",
        description: "What changed in the JavaScript library release.",
      },
    ],
  },
];

export const allDocs = DOC_GROUPS.flatMap((group) => group.items);

export const articles = {
  installation: {
    eyebrow: "GETTING STARTED",
    title: "Less setup. More simulation.",
    description:
      "No bundler. No framework. Just a canvas, a script tag, and your imagination.",
    sections: [
      {
        id: "download",
        title: "01",
        heading: "Get the library",
        text: "Download the complete JavaScript package, or just the single-file bundle. The WebAssembly engine is already included, so there are no extra files to configure.",
        download: true,
      },
      {
        id: "script-tag",
        title: "02",
        heading: "Drop in a script tag",
        text: "Place mpm.js next to your HTML file. Give your canvas a visible CSS width and height, then wait for the engine to initialize.",
        code: runnableCode,
        language: "HTML",
      },
      {
        id: "es-modules",
        title: "03",
        heading: "Prefer ES modules?",
        text: "Use the module build for native browser imports or your existing JavaScript project. Both builds expose the same API.",
        code: `import { create, demoScene } from './mpm.esm.js';

const sim = await create({
  canvas: '#world',
  scene: demoScene('water')
});`,
        language: "JavaScript",
      },
      {
        id: "requirements",
        heading: "Built for modern browsers",
        text: "You need WebAssembly, WebGL2, and ES2022 support. SIMD is detected automatically. Serve your files over HTTP or HTTPS; a local Python server is enough.",
        code: "python3 -m http.server 8000",
        language: "Terminal",
        note: "The JavaScript bundle includes the real scalar and SIMD WASM solver. Its download is approximately 1 MB before compression.",
      },
    ],
  },
  "quick-start": {
    eyebrow: "GETTING STARTED",
    title: "Your first world, in minutes.",
    description:
      "Start with something small. Make it move. Then make it yours.",
    sections: [
      {
        id: "first-scene",
        title: "01",
        heading: "Give physics a home",
        text: "Create a canvas and load the single-file library. This complete example initializes the engine, creates a sand scene, and enables click-and-drag pouring.",
        code: runnableCode,
        language: "HTML",
        example: true,
      },
      {
        id: "make-it-yours",
        title: "02",
        heading: "Make it your own",
        text: "Every scene is an ordinary JavaScript object. Add materials, choose their shapes, and adjust gravity without touching the library source.",
        code: sceneCode,
        language: "JavaScript",
      },
      {
        id: "keep-going",
        title: "03",
        heading: "Change things while they run",
        text: "Your simulation is a live object. Add a wheel, slow down gravity, or bring in another material whenever you like.",
        code: `sim.setGravity([0, -2]);
sim.addParticles({
  material: 'water',
  center: [0.7, 0.7],
  radius: 0.08
});
sim.addWheel({ center: [0.5, 0.3], speed: 90 });`,
        language: "JavaScript",
      },
    ],
  },
  scenes: {
    eyebrow: "CORE CONCEPTS",
    title: "Your world. Your rules.",
    description: "Build scenes with plain objects, not library source edits.",
    sections: [
      {
        id: "scene-definition",
        heading: "Start with a scene description",
        text: "Use createScene() to describe a physical world. Choose materials, geometry, initial velocities, and colors. The same description can be loaded or reset at any time.",
        code: sceneCode,
        language: "JavaScript",
      },
      {
        id: "coordinates",
        heading: "Think from the ground up",
        text: "The origin is at the bottom left. X points right and Y points up. A standard world is 1 by 1; world: [1, 0.5] gives you a landscape scene. Keep geometry at least eight grid cells inside the domain.",
        code: `const landscape = MPM.createScene({
  resolution: 128,
  world: [1, 0.5],
  render: { bounds: [0, 0, 1, 0.5], grid: true },
  particles: [{ material: 'sand', center: [0.5, 0.3] }]
});`,
        language: "JavaScript",
      },
      {
        id: "custom-setup",
        heading: "Go a little deeper",
        text: "Setup callbacks give you the original solver, texture factory, and engine. Keep your custom logic in your own application. No source patches or string evaluation required.",
        code: `const scene = MPM.createScene({
  setup({ solver, textures }) {
    solver.add_particles({
      type: 'jelly', E: 9000, nu: 0.3, density: 600,
      color: [0.7, 0.6, 0.9],
      density_tex: textures.rect([0.5, 0.6], [0.2, 0.2]).mul(3)
    });
  }
});`,
        language: "JavaScript",
      },
    ],
  },
  materials: {
    eyebrow: "CORE CONCEPTS",
    title: "A little material magic.",
    description:
      "Granular, fluid, elastic, or somewhere in between. Pick what your world is made of.",
    sections: [
      {
        id: "choose-material",
        heading: "Six materials. Different personalities.",
        text: "The high-level API provides sensible interactive defaults for six materials. You can mix them within the same scene and override their physical properties.",
        materials: true,
      },
      {
        id: "geometry",
        heading: "Give your material a shape",
        text: "Use circles or spheres, rectangles or boxes, and 2D polygons. particlesPerCell changes sampling density, rather than specifying an exact particle count.",
        code: `sim.addParticles({
  material: 'jelly',
  shape: 'rect',
  center: [0.5, 0.6],
  size: [0.2, 0.15],
  color: '#b19de2',
  particlesPerCell: 3,
  properties: { E: 9000, nu: 0.3, density: 600 }
});`,
        language: "JavaScript",
      },
      {
        id: "performance",
        heading: "Find your balance",
        text: "More particles and a finer grid cost more computation. Start at resolution 128 in 2D, or 40 in 3D. Increase detail gradually. Stiffer materials may require smaller solver time steps.",
        note: "These are genuine constitutive material models, not particle animations. Simulation speed depends on scene complexity and your device.",
      },
    ],
  },
  runtime: {
    eyebrow: "CORE CONCEPTS",
    title: "Nothing is set in stone.",
    description: "Keep the world running. Change almost everything around it.",
    sections: [
      {
        id: "playback",
        heading: "Take control of time",
        text: "Pause, play, or advance exactly one logical frame. Reset reloads your scene description and preserves the playback state.",
        code: `sim.pause();
await sim.step();
sim.play();
sim.reset();`,
        language: "JavaScript",
      },
      {
        id: "live-changes",
        heading: "Make changes, in motion",
        text: "Add material or change gravity without recreating the simulation. Structural changes are queued at safe frame boundaries.",
        code: `sim.setGravity([0, -2]);
sim.setConfig({ penalty: 1000 });
sim.addParticles({
  material: 'water',
  center: [0.5, 0.7],
  radius: 0.06,
  velocity: [0.3, -0.5]
});`,
        language: "JavaScript",
      },
      {
        id: "callbacks",
        heading: "Give it a life of its own",
        text: "Listen to simulation events and close over your own state. This emitter uses simulation time, so it pauses naturally with your world.",
        code: `let nextDrop = 0;
const unsubscribe = sim.on('beforeStep', ({ time }) => {
  if (time < nextDrop) return;
  nextDrop = time + 0.15;
  sim.addParticles({
    material: 'sand', center: [0.5, 0.7], radius: 0.025
  });
});

// Stop the emitter whenever you want.
unsubscribe();`,
        language: "JavaScript",
      },
    ],
  },
  interactions: {
    eyebrow: "MAKE IT INTERACTIVE",
    title: "Go on. Get hands-on.",
    description:
      "One pointer API for a mouse, a pen, or the tips of your fingers.",
    sections: [
      {
        id: "pouring",
        heading: "Make it touchable",
        text: "Enable click-and-drag pouring in 2D. Pointer capture keeps the interaction consistent, and touch-action is managed for you.",
        code: `sim.enableInteractions({
  material: 'sand',
  radius: 0.028,
  velocity: [0, -0.35],
  interval: 65
});

// Switch material by enabling it again.
sim.enableInteractions({ material: 'water' });
sim.disableInteractions();`,
        language: "JavaScript",
      },
      {
        id: "custom-gestures",
        heading: "Your gestures. Your logic.",
        text: "Listen for pointer events and map screen coordinates into world space. Then call any runtime API. The built-in tool adds particles; it is not a grabbing or force-brush tool.",
        code: `canvas.addEventListener('pointerdown', (event) => {
  const center = sim.renderer.screenToWorld(
    event.clientX, event.clientY
  );
  sim.addParticles({ material: 'water', center, radius: 0.05 });
});`,
        language: "JavaScript",
      },
      {
        id: "three-d",
        heading: "A different perspective",
        text: "In 3D scenes, drag to orbit, scroll to zoom, and double-click to reset the camera. The built-in pouring helper is 2D only.",
        note: "Loading or resetting a scene removes the old pouring bindings. Call enableInteractions() again for the new scene.",
      },
    ],
  },
  wheels: {
    eyebrow: "MAKE IT INTERACTIVE",
    title: "Set something in motion.",
    description:
      "Drop in an automatic wheel. Let your materials take it from there.",
    sections: [
      {
        id: "add-wheel",
        heading: "A wheel, in a few lines",
        text: "Create a motor-driven thin-shell paddle wheel in any high-level 2D scene. It couples physically to the material around it. Add it while the simulation runs.",
        code: wheelCode,
        language: "JavaScript",
        wheelDemo: true,
      },
      {
        id: "wheel-options",
        heading: "Fine-tune the momentum",
        text: "Speed is in degrees per simulated second. Negative values reverse direction. Change speed without an angle jump, or move the center with wheel.move([x, y]).",
        table: [
          ["Option", "Default", "Description"],
          ["center", "[0.5, 0.25]", "World position of the axle"],
          ["radius", "0.11", "Wheel radius in world units"],
          ["blades", "8", "Between 3 and 24 paddles"],
          ["speed", "90", "Degrees per simulation second"],
          ["color", "#eae5d9", "Hex or normalized RGB color"],
        ],
      },
      {
        id: "native-wheels",
        heading: "More than a helper",
        text: "The original scenes include free-spinning wheels, motor articulations, and 3D water wheels. Use the low-level solver for custom rigid-body geometry and constraints.",
        note: "The helper is motor-driven, not torque-limited. Keep the whole wheel inside the safe domain. Reset the scene to remove added wheels.",
      },
    ],
  },
  api: {
    eyebrow: "REFERENCE",
    title: "Small API. Open possibilities.",
    description:
      "Everything you need to build, control, and extend your simulation.",
    sections: [
      {
        id: "namespace",
        heading: "The MPM namespace",
        text: "The classic script exposes window.MPM. The ES module build provides matching named exports.",
        table: [
          ["Export", "Returns", "Purpose"],
          [
            "create(options)",
            "Promise<Simulation>",
            "Initialize an engine and a canvas",
          ],
          ["createScene(options)", "Scene", "Define a custom world"],
          [
            "demoScene(material, resolution)",
            "Scene",
            "Create a landscape material demo",
          ],
          ["scenes", "Scene[]", "Ten original 2D and 3D scenes"],
          ["materialTypes", "string[]", "Supported high-level materials"],
        ],
      },
      {
        id: "simulation",
        heading: "Your simulation instance",
        text: "Most mutation methods return the simulation for chaining. step() resolves when a logical frame is complete; addWheel() returns a live wheel handle.",
        table: [
          ["Method", "Purpose"],
          ["play() / pause()", "Control playback"],
          ["step()", "Advance one logical frame"],
          ["reset() / loadScene(scene)", "Reset or replace the world"],
          ["addParticles(options)", "Add a material shape"],
          ["setGravity(vector)", "Update gravity live"],
          ["setConfig(options)", "Update gravity, penalty, pushing_force"],
          ["addWheel(options)", "Add a 2D automatic wheel"],
          ["enableInteractions(options)", "Enable pointer-based pouring"],
          ["disableInteractions()", "Remove pouring listeners"],
          [
            "setRenderOptions(options)",
            "Change point size, grid, and visibility",
          ],
          [
            "on(event, callback) / off(event, callback)",
            "Subscribe or unsubscribe",
          ],
          ["mutate(callback)", "Queue low-level structural changes safely"],
          ["destroy()", "Release engine, renderer, and listeners"],
        ],
      },
      {
        id: "events",
        heading: "Stay in the loop",
        text: "Callbacks receive event data and the simulation instance. on() returns an unsubscribe function.",
        code: `const stop = sim.on('stats', (stats, simulation) => {
  console.log(stats.particles, stats.time, stats.fps);
});

sim.on('error', (error) => console.error(error));
stop();`,
        language: "JavaScript",
        note: "Events: beforeStep, afterStep, stats, statechange, scenechange, particlesadded, wheelchange, pointer, error, and destroy.",
      },
      {
        id: "low-level",
        heading: "The original engine, still here",
        text: "MPMEngine, Solver, TextureFactory, Texture, SegmentMesh, TriangleMesh, LevelSet, and Renderer are exported. The active engine, solver, textures, and renderer are accessible on your simulation.",
        code: `sim.mutate(() => {
  sim.solver.add_particles({
    type: 'snow', density: 400, youngs_modulus: 10000,
    color: [0.9, 0.95, 1],
    density_tex: sim.textures.sphere([0.5, 0.7], 0.1).mul(2)
  });
});`,
        language: "JavaScript",
      },
    ],
  },
  changelog: {
    eyebrow: "RESOURCES",
    title: "A fresh start for matter.",
    description: "The original simulation, opened up for the JavaScript web.",
    sections: [
      {
        id: "version-one",
        heading: "1.0.0 / The JavaScript release",
        text: "A framework-free public library, packaged as a classic script and an ES module. The original scalar and SIMD WebAssembly payloads are preserved.",
        list: [
          "Converted the engine, scenes, worker, renderer, and native test from TypeScript to JavaScript.",
          "Replaced the original React demo with a plain HTML and JavaScript application.",
          "Added declarative scenes and page-defined setup and update callbacks.",
          "Added live particle emission, gravity and configuration controls, and safe frame-boundary mutations.",
          "Added automatic 2D paddle wheels with live speed and position controls.",
          "Added mouse, pen, and touch pouring via Pointer Events.",
          "Preserved all ten original scenes, including the 3D simulations.",
          "Included readable source, runnable examples, migration notes, and a full Markdown guide.",
        ],
      },
      {
        id: "provenance",
        heading: "Built on real work",
        text: "This release is based on the supplied i-opus-55-max archive and the taichi_mpm MLS-MPM + CPIC solver lineage. Native source was not recompiled. See the migration notes and documentation for attribution and licensing details.",
        migration: true,
      },
    ],
  },
};

export const materialRows = [
  ["sand", "Granular, flowing, and beautifully messy.", "#dca15e"],
  ["water", "Fluid motion with pressure and splashes.", "#78b1cb"],
  ["jelly", "Elastic, squishy, and a little unpredictable.", "#ab95ce"],
  ["snow", "Soft shapes with lasting plastic deformation.", "#d1d6c9"],
  ["elastic", "Stretch it. Watch it find its way back.", "#9eb588"],
  ["von_mises", "Plastic solids that yield under stress.", "#d88e7f"],
];
