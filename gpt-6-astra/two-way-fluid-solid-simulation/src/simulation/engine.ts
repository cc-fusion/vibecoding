import { MACGrid, type Particles } from './grid';
import { SoftBody } from './solid';
export type Preset = 'Wave tank' | 'Dam break' | 'Buoyancy test' | 'Zero gravity';
export interface Settings { flip: number; stiffness: number; gravity: number; density: number; substeps: number; iterations: number; coupling: boolean; speed: number }
export const defaults: Settings = { flip: 0.95, stiffness: 0.72, gravity: 9.81, density: 650, substeps: 2, iterations: 60, coupling: true, speed: 1 };
export interface Stats { time: number; stepMs: number; fps: number; dt: number; cfl: number; residual: number; iterations: number; contacts: number; momentumError: number; penetration: number; divergenceBefore: number; divergenceAfter: number; steps: number }
export class Simulation {
  grid = new MACGrid(); solid: SoftBody; particles: Particles; settings: Settings;
  width = 10; height = 5.5; time = 0; lastDt = 1 / 120; steps = 0; contacts = 0; contactMomentumError = 0;
  stepMs = 0; lastCFL = 0; failure: string | null = null;
  drag?: { x: number; y: number; node: number }; preset: Preset;
  constructor(settings: Settings = defaults, preset: Preset = 'Wave tank', count = 4096) {
    this.settings = { ...settings }; this.preset = preset;
    this.solid = new SoftBody(preset === 'Dam break' ? 6.9 : 6.35, preset === 'Buoyancy test' ? 1.3 : 2.75);
    this.particles = { count, x: new Float64Array(count), y: new Float64Array(count), vx: new Float64Array(count), vy: new Float64Array(count), mass: 1 };
    // Deterministic low-discrepancy seeding; mass is fixed after initialization.
    const radical = (n: number, base: number) => { let f = 1, r = 0; while (n) { f /= base; r += f * (n % base); n = Math.floor(n / base); } return r; };
    let k = 0, attempts = 0;
    while (k < count && attempts < count * 30) {
      const a = ++attempts, x = 0.07 + radical(a, 2) * (this.width - 0.14), y = 0.07 + radical(a, 3) * (this.height - 0.14);
      const surface = preset === 'Dam break' ? (x < 3.1 ? 4.05 : 0.12) : preset === 'Buoyancy test' ? 2.75 : 1.16 + 1.68 * Math.exp(-(((x - 1.1) / 2.5) ** 2)) + 0.17 * Math.sin(x * 1.4);
      if (y > surface || this.solid.contains(x, y)) continue;
      this.particles.x[k] = x; this.particles.y[k] = y;
      this.particles.vx[k] = preset === 'Wave tank' ? 0.7 * Math.max(0, 1 - x / 7) : preset === 'Zero gravity' ? 0.4 * Math.sin(y * 2) : 0;
      k++;
    }
    this.particles.count = k;
    this.particles.mass = (this.width - 0.14) * (this.height - 0.14) * 1000 / attempts;
    this.syncSettings(); this.grid.transfer(this.particles, this.solid);
  }
  syncSettings() { this.solid.stiffness = this.settings.stiffness; this.solid.enabled = this.settings.coupling; this.solid.setDensity(this.settings.density); }
  speeds() {
    let fluid = 0, solid = 0;
    for (let k = 0; k < this.particles.count; k++) fluid = Math.max(fluid, Math.hypot(this.particles.vx[k], this.particles.vy[k]));
    for (const n of this.solid.nodes) solid = Math.max(solid, Math.hypot(n.vx, n.vy));
    return { fluid, solid };
  }
  advance(frameDt = 1 / 60) {
    if (this.failure) return;
    const start = performance.now(); this.syncSettings();
    let remaining = Math.min(frameDt, 1 / 30) * this.settings.speed, done = 0;
    this.contactMomentumError = 0; this.contacts = 0;
    // At most 8 substeps: when the budget is exhausted we slow simulation time,
    // NEVER enlarge dt to catch up. Dragged bodies are included in the CFL bound.
    while (remaining > 1e-7 && done < 8) {
      const speeds = this.speeds();
      let speed = speeds.fluid + speeds.solid;
      if (this.drag) speed += 4;
      const maxDt = 1 / (60 * this.settings.substeps);
      let dt = Math.min(remaining, maxDt, 0.4 * this.grid.h / Math.max(0.1, speed + Math.sqrt(2 * this.settings.gravity * this.grid.h)));
      const p = this.particles, body = this.solid;
      const savedParticles = [p.x.slice(), p.y.slice(), p.vx.slice(), p.vy.slice()];
      const savedSolid = body.nodes.flatMap(n => [n.x, n.y, n.vx, n.vy]);
      const savedTime = this.time, savedContacts = this.contacts, savedError = this.contactMomentumError;
      const restore = () => {
        p.x.set(savedParticles[0]); p.y.set(savedParticles[1]); p.vx.set(savedParticles[2]); p.vy.set(savedParticles[3]);
        body.nodes.forEach((n, i) => { n.x = n.ox = savedSolid[i * 4]; n.y = n.oy = savedSolid[i * 4 + 1]; n.vx = savedSolid[i * 4 + 2]; n.vy = savedSolid[i * 4 + 3]; });
        body.updateBounds(); this.time = savedTime; this.contacts = savedContacts; this.contactMomentumError = savedError;
      };
      let accepted = false;
      // Pressure and contact can accelerate particles AFTER the predictive CFL
      // estimate. Retry from a complete Lagrangian snapshot if that estimate fails.
      for (let retry = 0; retry < 7; retry++) {
        this.substep(dt);
        const after = this.speeds(), cfl = (after.fluid + after.solid) * dt / this.grid.h;
        const validMesh = body.triangles.every(t => {
          const a = body.nodes[t.a], b = body.nodes[t.b], c = body.nodes[t.c];
          return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 1e-12;
        });
        if (Number.isFinite(cfl) && cfl <= 0.400001 && validMesh && this.penetrationCount() === 0) {
          accepted = true; this.lastDt = dt; this.lastCFL = cfl; break;
        }
        restore(); dt *= 0.5;
      }
      if (!accepted) {
        this.failure = 'Safety pause: an unsafe step was rolled back. Reset the scene or restore defaults.';
        this.grid.transfer(p, body); break;
      }
      remaining -= dt; done++;
    }
    this.steps = done; this.stepMs = performance.now() - start;
  }
  substep(dt: number) {
    const { solid, grid, particles: p, settings: s } = this;
    // Partitioned coupling: predict solid -> prescribe its grid boundary ->
    // pressure reaction -> FLIP -> advect -> conservative particle contact.
    solid.advance(dt, s.gravity, this.width, this.height, this.drag);
    this.collide(false); // Remove overlaps introduced by the moving solid before P2G.
    grid.transfer(p, solid); grid.applyForces(dt, s.gravity); grid.boundaries(solid);
    grid.assemble(dt); grid.solve(s.iterations); grid.project(dt, solid); grid.gather(p, s.flip);
    // Updated Lagrangian velocity advection, bounded by adaptive relative CFL.
    for (let k = 0; k < p.count; k++) { p.x[k] += p.vx[k] * dt; p.y[k] += p.vy[k] * dt; }
    this.collide(true); this.time += dt;
  }
  collide(countContacts: boolean) {
    const p = this.particles, body = this.solid, r = this.grid.h * 0.16, b = body.bounds;
    for (let k = 0; k < p.count; k++) {
      if (p.x[k] < r) { p.x[k] = r; p.vx[k] = Math.max(0, p.vx[k]); }
      if (p.x[k] > this.width - r) { p.x[k] = this.width - r; p.vx[k] = Math.min(0, p.vx[k]); }
      if (p.y[k] < r) { p.y[k] = r; p.vy[k] = Math.max(0, p.vy[k]); }
      if (p.y[k] > this.height - r) { p.y[k] = this.height - r; p.vy[k] = Math.min(0, p.vy[k]); }
      if (!body.enabled || p.x[k] < b.minX - r || p.x[k] > b.maxX + r || p.y[k] < b.minY - r || p.y[k] > b.maxY + r) continue;
      const c = body.contact(p.x[k], p.y[k]);
      if (!c.inside && c.distance >= r) continue;
      p.x[k] = c.x + c.nx * (r + 1e-5); p.y[k] = c.y + c.ny * (r + 1e-5);
      const v = body.velocity(c), a = body.nodes[c.a], z = body.nodes[c.b];
      const rx = p.vx[k] - v.x, ry = p.vy[k] - v.y, vn = rx * c.nx + ry * c.ny;
      if (vn < 0) {
        const inv = 1 / p.mass + (1 - c.t) ** 2 * a.invMass + c.t ** 2 * z.invMass;
        const normal = -vn / inv;
        const tangentSpeed = rx * -c.ny + ry * c.nx;
        // Coulomb-limited tangential drag; zero restitution avoids impact energy gain.
        const tangent = Math.max(-0.12 * normal, Math.min(0.12 * normal, -tangentSpeed / inv));
        const jx = normal * c.nx - tangent * c.ny, jy = normal * c.ny + tangent * c.nx;
        const beforeX = p.mass * p.vx[k] + a.vx / a.invMass + z.vx / z.invMass;
        const beforeY = p.mass * p.vy[k] + a.vy / a.invMass + z.vy / z.invMass;
        p.vx[k] += jx / p.mass; p.vy[k] += jy / p.mass; body.impulse(c, -jx, -jy);
        const errX = p.mass * p.vx[k] + a.vx / a.invMass + z.vx / z.invMass - beforeX;
        const errY = p.mass * p.vy[k] + a.vy / a.invMass + z.vy / z.invMass - beforeY;
        this.contactMomentumError = Math.max(this.contactMomentumError, Math.hypot(errX, errY));
      }
      if (countContacts) this.contacts++;
    }
  }
  stir(x: number, y: number, dx: number, dy: number) {
    const p = this.particles;
    for (let k = 0; k < p.count; k++) {
      const distance = Math.hypot(p.x[k] - x, p.y[k] - y);
      if (distance < 1.0) { const w = (1 - distance) ** 2; p.vx[k] += Math.max(-2, Math.min(2, dx * 14)) * w; p.vy[k] += Math.max(-2, Math.min(2, dy * 14)) * w; }
    }
  }
  splash() {
    const p = this.particles;
    for (let k = 0; k < p.count; k++) { const d = Math.hypot(p.x[k] - 3.5, p.y[k] - 0.9); if (d < 2) { p.vy[k] += 3 * (1 - d / 2); p.vx[k] += (p.x[k] - 3.5) * (1 - d / 2); } }
  }
  penetrationCount() { let n = 0; if (this.solid.enabled) for (let k = 0; k < this.particles.count; k++) if (this.solid.contains(this.particles.x[k], this.particles.y[k])) n++; return n; }
  stats(fps: number): Stats { return { time: this.time, stepMs: this.stepMs, fps, dt: this.lastDt, cfl: this.lastCFL, residual: this.grid.relativeResidual, iterations: this.grid.iterations, contacts: this.contacts, momentumError: this.contactMomentumError, penetration: this.penetrationCount(), divergenceBefore: this.grid.divergenceBefore, divergenceAfter: this.grid.divergenceAfter, steps: this.steps }; }
}
