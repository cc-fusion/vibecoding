import { MACGrid, FLUID, SOLID } from './grid';
import { SoftBody } from './solid';
import { Simulation, defaults } from './engine';
export type Check = { name: string; passed: boolean; detail: string };
// Executed in the browser and exposed in the numerical diagnostics panel.
// These are implementation-level sanity checks, not an exhaustive validation
// against experimental data or a guarantee for arbitrary material parameters.
export function runChecks(): Check[] {
  const g = new MACGrid(8, 6, 0.125), n = g.type.length;
  for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) g.type[x + y * 8] = FLUID;
  g.type[3 + 2 * 8] = SOLID; g.assemble(1 / 120);
  const x = new Float64Array(n), y = new Float64Array(n), ax = new Float64Array(n), ay = new Float64Array(n);
  for (let k = 0; k < n; k++) if (g.type[k] === FLUID) { x[k] = Math.sin(k * 1.73); y[k] = Math.cos(k * 0.81); }
  g.multiply(x, ax); g.multiply(y, ay);
  let xAy = 0, yAx = 0, xAx = 0;
  for (let k = 0; k < n; k++) { xAy += x[k] * ay[k]; yAx += y[k] * ax[k]; xAx += x[k] * ax[k]; }
  const symmetry = Math.abs(xAy - yAx);
  for (let k = 0; k < g.u.length; k++) g.u[k] = Math.sin(k * 0.51) * 0.4;
  for (let k = 0; k < g.v.length; k++) g.v[k] = Math.cos(k * 0.27) * 0.2;
  const s = new SoftBody(0.44, 0.3, 0.07);
  g.boundaries(s); g.assemble(1 / 120); g.solve(120); g.project(1 / 120, s);
  const c = s.contact(0.5, 0.3), before = s.nodes.reduce((sum, node) => sum + node.vx / node.invMass, 0);
  s.impulse(c, 7.25, -3.5);
  const delta = s.nodes.reduce((sum, node) => sum + node.vx / node.invMass, 0) - before;
  // An immersed body exercises pressure feedback immediately. Identical seeds
  // isolate coupling from differences in initialization or externally applied forces.
  const coupled = new Simulation({ ...defaults }, 'Buoyancy test', 1024);
  const uncoupled = new Simulation({ ...defaults, coupling: false }, 'Buoyancy test', 1024);
  const massBefore = coupled.particles.mass * coupled.particles.count;
  coupled.advance(1 / 120); uncoupled.advance(1 / 120);
  let solidDelta = 0, fluidDelta = 0;
  coupled.solid.nodes.forEach((node, i) => { solidDelta += Math.hypot(node.vx - uncoupled.solid.nodes[i].vx, node.vy - uncoupled.solid.nodes[i].vy); });
  for (let k = 0; k < coupled.particles.count; k++) fluidDelta += Math.hypot(coupled.particles.vx[k] - uncoupled.particles.vx[k], coupled.particles.vy[k] - uncoupled.particles.vy[k]);
  const finite = coupled.particles.x.every(Number.isFinite) && coupled.particles.vx.every(Number.isFinite) && coupled.particles.vy.every(Number.isFinite);
  const penetration = coupled.penetrationCount();
  return [
    { name: 'Pressure matrix symmetry', passed: symmetry < 1e-10, detail: `|xᵀAy − yᵀAx| = ${symmetry.toExponential(2)}` },
    { name: 'Positive quadratic form', passed: xAx > 0, detail: `xᵀAx = ${xAx.toFixed(4)}; A is a graph Laplacian + air/gauge diagonal.` },
    { name: 'Pressure projection', passed: g.divergenceAfter < g.divergenceBefore * 0.002, detail: `max |∇·u|: ${g.divergenceBefore.toFixed(4)} → ${g.divergenceAfter.toExponential(2)} s⁻¹` },
    { name: 'Weighted impulse conservation', passed: Math.abs(delta - 7.25) < 1e-9, detail: `Solid Δmomentum = ${delta.toFixed(8)} for Jx = 7.25 N·s` },
    { name: 'Fluid → solid feedback', passed: !coupled.failure && solidDelta > 1e-6, detail: `Coupling changes summed solid velocity by ${solidDelta.toExponential(3)} m/s.` },
    { name: 'Solid → fluid feedback', passed: !coupled.failure && fluidDelta > 1e-6, detail: `Coupling changes summed fluid velocity by ${fluidDelta.toExponential(3)} m/s.` },
    { name: 'Particle mass retention', passed: coupled.particles.mass * coupled.particles.count === massBefore, detail: `${massBefore.toFixed(5)} kg before and after the coupled step.` },
    { name: 'Finite state & nonpenetration smoke test', passed: finite && !coupled.failure && penetration === 0, detail: `${penetration} particles inside the filled body after an accepted step.` },
    { name: 'Default CFL bound', passed: (4 * (1 / 120) / 0.125) < 0.4 && coupled.lastCFL <= 0.400001, detail: `At 4 m/s: CFL = 0.267 < 0.4. Measured smoke-test CFL: ${coupled.lastCFL.toFixed(4)}.` },
  ];
}
