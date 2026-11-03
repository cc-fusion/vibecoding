export const QUICK_START = `<!-- Add a canvas container to your page. -->
<div id="simulation" style="height: 480px"></div>
<script src="./taichi-mpm.js"></script>
<script type="module">
  const sim = await TaichiMPM.create({
    container: '#simulation',
    scene: 'cutting',
    quality: 'medium',
    autoPlay: true
  });
</script>`;
export const CUSTOM_SCENE = JSON.stringify({
  id: 'my-first-scene', name: 'My first scene', dim: 2, resolution: 160,
  gravity: [0, -9.81], duration: 0,
  boundaries: { floor: true, walls: true, friction: 0.4 },
  objects: [
    { id: 'water', type: 'particles', material: 'water', shape: 'sphere', center: [0.35, 0.7], radius: 0.1, color: '#57b8f5', density: 4 },
    { id: 'wheel', type: 'rigid', shape: 'wheel', center: [0.5, 0.28], radius: 0.15, blades: 8, color: '#e9b870', motion: { enabled: true, speed: 90 } },
  ],
}, null, 2);
export const LIVE_EXAMPLE = `// These changes apply immediately. No reload needed.
sim.update({
  gravity: -4.5,
  wheelSpeed: 120,
  automaticWheel: true,
  speed: 1
});

// Add material to the running simulation.
await sim.addParticles({
  material: 'jelly',
  shape: 'sphere',
  center: [0.5, 0.7],
  radius: 0.08,
  color: '#e68ccf'
});

// Connect a pointer to a custom emitter.
sim.setInteraction({ enabled: true, mode: 'custom' });
sim.on('interact', ({ position }) => {
  sim.emitParticles(position, [0, 0.6], 'water');
});`;
export const WHEEL_EXAMPLE = `const scene = TaichiMPM.starterScene;
const sim = await TaichiMPM.create({
  container: '#simulation',
  scene,
  autoPlay: true
});

// Built-in motion is part of the scene definition.
// Change speed and direction while it is running.
sim.update({ wheelSpeed: 180 });
setTimeout(() => sim.update({ automaticWheel: false }), 5000);
setTimeout(() => sim.update({
  automaticWheel: true,
  wheelSpeed: -90
}), 8000);`;
export const PRESET_IDS = [
  ['cutting','CPIC Cutting','2D'], ['sand-wheel','Sand Wheel','2D'], ['water-wheel-2d','Water Wheel','2D'], ['buoyancy','Buoyancy','2D'], ['sand-car','Motorized Crawler','2D'], ['materials','Material Zoo','2D'], ['water-wheel-3d','3D Water Wheel','3D'], ['sand-stir-3d','3D Sand Stirring','3D'], ['jelly-cut-3d','3D Jelly Cutting','3D'], ['rigid-pile-3d','3D Rigid Bodies','3D'],
];
export const API_METHODS = [
  ['create(options)', 'Promise<Simulation>', 'Create a canvas and start the local WebAssembly worker.'],
  ['sim.loadScene(scene, options)', 'Promise', 'Load a preset id or a JSON scene. Resolves after initialization.'],
  ['sim.play() / sim.pause()', 'Simulation', 'Start or pause the simulation without losing state.'],
  ['sim.step()', 'Simulation', 'Advance exactly one simulation frame while paused.'],
  ['sim.reset()', 'Promise', 'Rebuild the current scene and reset simulation time.'],
  ['sim.update(patch)', 'Simulation', 'Apply live gravity, wheel, or playback-speed changes.'],
  ['sim.addParticles(object)', 'Promise', 'Insert particles, with material, shape, center, size and density.'],
  ['sim.addRigid(object)', 'Promise', 'Insert a rigid body with optional motion and geometry.'],
  ['sim.emitParticles(position, velocity, material, color)', 'Simulation', 'Add a small burst at the requested position.'],
  ['sim.setOptions(options)', 'Simulation', 'Update particle size, color mode, grid and rigid visibility.'],
  ['sim.setCamera(camera)', 'Simulation', 'Set 3D target, distance, yaw and pitch.'],
  ['sim.resetCamera() / sim.snapshot()', 'Simulation / void', 'Reset the camera or download a PNG of the current viewport.'],
  ['sim.on(event, handler)', 'Function', 'Subscribe to ready, loaded, stats, state, frame, log, error or interact. Returns an unsubscribe function.'],
  ['sim.getStats() / sim.getCamera()', 'Object / null', 'Read a defensive copy of current metrics or camera.'],
  ['sim.dispose()', 'void', 'Stop the worker, release listeners and remove the canvas.'],
  ['registerScene(scene)', 'Object', 'Register a validated JSON scene for loading by its id.'],
  ['getRegisteredScenes() / unregisterScene(id)', 'Array / boolean', 'List or remove registered scenes.'],
];
