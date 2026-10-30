export const metadata = {
  id: 'water-pulse-module',
  name: 'Water pulse · ES module',
  dim: 2,
  duration: 0,
  frameDt: 0.01,
  description: 'A scripted ES-module scene with a custom level set and periodic water injection.'
};

export function setup(ctx) {
  const mpm = ctx.createMPM({ resolution: 160, gravity: [0, -9.81] });
  const bounds = mpm.create_levelset();
  bounds.add_plane([0, 1], -0.06)
    .add_plane([1, 0], -0.06)
    .add_plane([-1, 0], 0.94)
    .set_friction(0.35);
  mpm.set_levelset(bounds);

  const floor = ctx.tex.rect([0.5, 0.13, 0.5], [0.7, 0.1, 1]).mul(3);
  mpm.add_particles({ type: 'sand', density: 1500, friction_angle: 35, color: [0.78, 0.57, 0.37], density_tex: floor });

  let lastPulse = -1;
  return {
    mpm,
    update(t, dt, api) {
      if (t - lastPulse >= 0.45 && t < 8) {
        api.addParticles({
          material: 'water', shape: 'sphere', center: [0.5, 0.78], radius: 0.035,
          density: 2, velocity: [0, -1.2], color: '#65bbef'
        });
        lastPulse = t;
      }
    }
  };
}

// Enable with sim.setInteraction({ mode: 'custom', forwardToScene: true }).
export function onMessage(name, payload, api) {
  if (name === 'pointerdown' && payload.position) {
    api.emitParticles(payload.position, [0, 0.45], 'water', '#65bbef');
  }
}
