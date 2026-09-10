// Cross-system coupling between the FLIP grid/particles, Matter.js bodies and soft-body rings.
//  • Rigid bodies are rasterised into the MAC grid as moving solid cells (velocity boundary conditions).
//  • Fluid particles are pushed out of rigid and soft geometry; the inelastic normal impulse is fed back
//    to the body/nodes (equal and opposite), giving drag, splashing reaction and momentum transfer.
//  • Pressure from the projection acting on solid faces gives buoyancy/lift on rigid bodies.
//  • Soft nodes sample the particle density and grid velocity for buoyancy and drag.
import Matter from 'matter-js';
import { FlipFluid, CELL_FLUID } from './flip';
import { resolvePointInBody, pointVelocity, ImpulseAccumulator } from './rigid';
import type { SoftBody } from './soft';

const { Vertices } = Matter;
const tmpV = new Float32Array(2);
const tmpEdge = new Float32Array(4);

export function rasterizeSolids(fluid: FlipFluid, bodies: Matter.Body[]) {
  const { s, sStatic, solidU, solidV, cellOwner, h, numX, numY } = fluid;
  s.set(sStatic); solidU.fill(0); solidV.fill(0); cellOwner.fill(-1);
  const pt = { x: 0, y: 0 };
  for (let bi = 0; bi < bodies.length; bi++) {
    const b = bodies[bi];
    if (b.isSensor) continue;
    const bb = b.bounds;
    const i0 = Math.max(1, Math.floor(bb.min.x / h) + 1), i1 = Math.min(numX - 2, Math.floor(bb.max.x / h) + 1);
    const j0 = Math.max(1, Math.floor(bb.min.y / h) + 1), j1 = Math.min(numY - 2, Math.floor(bb.max.y / h) + 1);
    const parts = b.parts.length > 1 ? b.parts.slice(1) : b.parts;
    const moving = !b.isStatic;
    for (let i = i0; i <= i1; i++) {
      pt.x = (i - 0.5) * h;
      for (let j = j0; j <= j1; j++) {
        pt.y = (j - 0.5) * h;
        let inside = false;
        for (let k = 0; k < parts.length && !inside; k++) {
          const pb = parts[k].bounds;
          if (pt.x < pb.min.x || pt.x > pb.max.x || pt.y < pb.min.y || pt.y > pb.max.y) continue;
          inside = Vertices.contains(parts[k].vertices, pt);
        }
        if (!inside) continue;
        const c = i * numY + j;
        s[c] = 0; cellOwner[c] = bi;
        if (moving) { pointVelocity(b, pt.x, pt.y, tmpV); solidU[c] = tmpV[0]; solidV[c] = tmpV[1]; }
      }
    }
  }
}

/** Push fluid particles out of rigid bodies, exchanging normal momentum. Uses the fluid's particle hash. */
export function collideParticlesWithRigid(fluid: FlipFluid, bodies: Matter.Body[], impulses: ImpulseAccumulator, scale: number) {
  const { pos, vel, particleRadius: r, pInvSpacing, pNumX, pNumY, firstCellParticle, cellParticleIds, h } = fluid;
  const mP = fluid.particleMass * scale;
  for (let bi = 0; bi < bodies.length; bi++) {
    const b = bodies[bi];
    if (b.isSensor) continue;
    const bb = b.bounds;
    const x0 = Math.max(0, Math.floor((bb.min.x - r + h) * pInvSpacing)), x1 = Math.min(pNumX - 1, Math.floor((bb.max.x + r + h) * pInvSpacing));
    const y0 = Math.max(0, Math.floor((bb.min.y - r + h) * pInvSpacing)), y1 = Math.min(pNumY - 1, Math.floor((bb.max.y + r + h) * pInvSpacing));
    if (x1 < x0 || y1 < y0) continue;
    const dynamic = !b.isStatic;
    for (let xi = x0; xi <= x1; xi++) {
      for (let yi = y0; yi <= y1; yi++) {
        const c = xi * pNumY + yi;
        const first = firstCellParticle[c], last = firstCellParticle[c + 1];
        for (let k = first; k < last; k++) {
          const p = cellParticleIds[k];
          if (p >= fluid.numParticles) continue;
          const px = pos[2 * p], py = pos[2 * p + 1];
          const ct = resolvePointInBody(b, px, py);
          if (!ct) continue;
          const nx = ct.nx, ny = ct.ny, push = Math.min(ct.depth + r, 3 * h);
          pos[2 * p] = px + nx * push; pos[2 * p + 1] = py + ny * push;
          pointVelocity(b, px, py, tmpV);
          const vn = (vel[2 * p] - tmpV[0]) * nx + (vel[2 * p + 1] - tmpV[1]) * ny;
          if (vn < 0) {
            vel[2 * p] -= vn * nx; vel[2 * p + 1] -= vn * ny;
            if (dynamic) impulses.add(b, px, py, mP * vn * nx, mP * vn * ny);
          }
        }
      }
    }
  }
}

/** Push fluid particles out of soft rings; the impulse is distributed to the two nodes of the nearest edge. */
export function collideParticlesWithSoft(fluid: FlipFluid, softs: SoftBody[], scale: number) {
  const { pos, vel, particleRadius: r, pInvSpacing, pNumX, pNumY, firstCellParticle, cellParticleIds, h } = fluid;
  const mP = fluid.particleMass * scale;
  for (const sb of softs) {
    const x0 = Math.max(0, Math.floor((sb.minX - r + h) * pInvSpacing)), x1 = Math.min(pNumX - 1, Math.floor((sb.maxX + r + h) * pInvSpacing));
    const y0 = Math.max(0, Math.floor((sb.minY - r + h) * pInvSpacing)), y1 = Math.min(pNumY - 1, Math.floor((sb.maxY + r + h) * pInvSpacing));
    if (x1 < x0 || y1 < y0) continue;
    const invNodeMass = 1 / sb.nodeMass, n = sb.n;
    for (let xi = x0; xi <= x1; xi++) {
      for (let yi = y0; yi <= y1; yi++) {
        const c = xi * pNumY + yi;
        const first = firstCellParticle[c], last = firstCellParticle[c + 1];
        for (let k = first; k < last; k++) {
          const p = cellParticleIds[k];
          if (p >= fluid.numParticles) continue;
          const px = pos[2 * p], py = pos[2 * p + 1];
          if (!sb.containsPoint(px, py)) continue;
          const e = sb.nearestEdge(px, py, tmpEdge);
          const d = tmpEdge[0], t = tmpEdge[1], nx = tmpEdge[2], ny = tmpEdge[3];
          if (d > 3 * h) continue; // deep inside (e.g. spawned there): leave it, separation will drift it out
          const j = (e + 1) % n;
          const push = d + r;
          pos[2 * p] = px + nx * push; pos[2 * p + 1] = py + ny * push;
          const evx = sb.vel[2 * e] * (1 - t) + sb.vel[2 * j] * t, evy = sb.vel[2 * e + 1] * (1 - t) + sb.vel[2 * j + 1] * t;
          const vn = (vel[2 * p] - evx) * nx + (vel[2 * p + 1] - evy) * ny;
          if (vn < 0) {
            vel[2 * p] -= vn * nx; vel[2 * p + 1] -= vn * ny;
            // reaction on the edge nodes (impulse mP·vn·n split by barycentric weight)
            const jx = mP * vn * nx * invNodeMass, jy = mP * vn * ny * invNodeMass;
            sb.extDv[2 * e] += jx * (1 - t); sb.extDv[2 * e + 1] += jy * (1 - t);
            sb.extDv[2 * j] += jx * t; sb.extDv[2 * j + 1] += jy * t;
          }
        }
      }
    }
  }
}

/** Pressure on solid faces adjacent to fluid cells → force/torque on the owning dynamic body. */
export function applyPressureForces(fluid: FlipFluid, bodies: Matter.Body[], impulses: ImpulseAccumulator, dt: number, scale: number) {
  const { p, cellOwner, cellType, h, numX, numY } = fluid;
  const n = numY;
  for (let i = 1; i < numX - 1; i++) {
    for (let j = 1; j < numY - 1; j++) {
      const c = i * n + j;
      const owner = cellOwner[c];
      if (owner < 0) continue;
      const b = bodies[owner];
      if (b.isStatic) continue;
      const cx = (i - 0.5) * h, cy = (j - 0.5) * h;
      // left neighbour fluid pushes +x, right pushes −x, top pushes +y, bottom pushes −y
      if (cellType[c - n] === CELL_FLUID) impulses.add(b, cx - 0.5 * h, cy, p[c - n] * h * dt * scale, 0);
      if (cellType[c + n] === CELL_FLUID) impulses.add(b, cx + 0.5 * h, cy, -p[c + n] * h * dt * scale, 0);
      if (cellType[c - 1] === CELL_FLUID) impulses.add(b, cx, cy - 0.5 * h, 0, p[c - 1] * h * dt * scale);
      if (cellType[c + 1] === CELL_FLUID) impulses.add(b, cx, cy + 0.5 * h, 0, -p[c + 1] * h * dt * scale);
    }
  }
}

/** Linear drag on submerged dynamic rigid bodies from the local grid velocity (viscous coupling). */
export function applyRigidFluidDrag(fluid: FlipFluid, bodies: Matter.Body[], impulses: ImpulseAccumulator, dt: number, scale: number) {
  for (const b of bodies) {
    if (b.isStatic || b.isSensor) continue;
    const frac = Math.min(1, fluid.sampleDensity(b.position.x, b.position.y));
    if (frac < 0.1) continue;
    fluid.sampleVelocity(b.position.x, b.position.y, tmpV);
    const v = Matter.Body.getVelocity(b);
    const vx = v.x * 60, vy = v.y * 60;
    const k = 2.5 * frac * scale * dt; // fraction of relative velocity removed per step
    impulses.add(b, b.position.x, b.position.y, b.mass * (tmpV[0] - vx) * k, b.mass * (tmpV[1] - vy) * k);
  }
}

/** Buoyancy + drag accelerations for soft nodes from the fluid state (density field & grid velocity). */
export function computeSoftFluidForces(fluid: FlipFluid, sb: SoftBody, gx: number, gy: number, fluidDensity: number, scale: number) {
  const ext = sb.extAcc;
  ext.fill(0);
  const ratio = (fluidDensity / Math.max(sb.def.density, 0.01)) * scale;
  const kDrag = 6 * scale;
  for (let i = 0; i < sb.n; i++) {
    const x = sb.pos[2 * i], y = sb.pos[2 * i + 1];
    // boundary nodes see roughly half of a fully-fluid cell when submerged, hence the ×2
    const frac = Math.min(1, 2 * fluid.sampleDensity(x, y));
    if (frac < 0.08) continue;
    fluid.sampleVelocity(x, y, tmpV);
    ext[2 * i] = -gx * frac * ratio + kDrag * frac * (tmpV[0] - sb.vel[2 * i]);
    ext[2 * i + 1] = -gy * frac * ratio + kDrag * frac * (tmpV[1] - sb.vel[2 * i + 1]);
  }
}
