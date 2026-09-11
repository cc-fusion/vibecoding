// A filled, triangulated disk. XPBD distance and signed-area constraints
// avoid the explicit-spring timestep restriction when stiffness increases.
export type Node = { x: number; y: number; ox: number; oy: number; vx: number; vy: number; invMass: number };
type Edge = { a: number; b: number; rest: number; lambda: number };
type Triangle = { a: number; b: number; c: number; rest: number; lambda: number };
export type Contact = { a: number; b: number; t: number; x: number; y: number; nx: number; ny: number; distance: number; inside: boolean };
export class SoftBody {
  nodes: Node[] = []; edges: Edge[] = []; triangles: Triangle[] = []; boundary: number[] = [];
  stiffness = 0.72; density = 650; enabled = true;
  bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  constructor(cx = 6.5, cy = 2.7, radius = 0.79) {
    const spokes = 20;
    const mass = this.density * Math.PI * radius * radius / 61;
    const add = (x: number, y: number) => this.nodes.push({ x, y, ox: x, oy: y, vx: 0, vy: 0, invMass: 1 / mass });
    add(cx, cy);
    for (let ring = 1; ring <= 3; ring++) for (let j = 0; j < spokes; j++) {
      const a = j * Math.PI * 2 / spokes + 0.13;
      const r = radius * ring / 3 * (1 + 0.035 * Math.sin(3 * a));
      add(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      if (ring === 3) this.boundary.push(this.nodes.length - 1);
    }
    const tri = (a: number, b: number, c: number) => {
      const A = this.nodes[a], B = this.nodes[b], C = this.nodes[c];
      this.triangles.push({ a, b, c, rest: ((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x)) / 2, lambda: 0 });
    };
    for (let j = 0; j < spokes; j++) tri(0, 1 + j, 1 + (j + 1) % spokes);
    for (let ring = 1; ring < 3; ring++) for (let j = 0; j < spokes; j++) {
      const a = 1 + (ring - 1) * spokes + j, b = 1 + (ring - 1) * spokes + (j + 1) % spokes;
      const c = 1 + ring * spokes + j, d = 1 + ring * spokes + (j + 1) % spokes;
      tri(a, c, d); tri(a, d, b);
    }
    const seen = new Set<string>();
    for (const t of this.triangles) for (const [a, b] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
      const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      if (!seen.has(key)) { seen.add(key); const A = this.nodes[a], B = this.nodes[b]; this.edges.push({ a, b, rest: Math.hypot(A.x - B.x, A.y - B.y), lambda: 0 }); }
    }
    this.updateBounds();
  }
  setDensity(density: number) {
    const ratio = this.density / density;
    for (const n of this.nodes) n.invMass *= ratio;
    this.density = density;
  }
  updateBounds() {
    this.bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    for (const n of this.nodes) {
      this.bounds.minX = Math.min(this.bounds.minX, n.x); this.bounds.maxX = Math.max(this.bounds.maxX, n.x);
      this.bounds.minY = Math.min(this.bounds.minY, n.y); this.bounds.maxY = Math.max(this.bounds.maxY, n.y);
    }
  }
  contains(x: number, y: number) {
    const b = this.bounds;
    if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) return false;
    let inside = false;
    for (let i = 0, j = this.boundary.length - 1; i < this.boundary.length; j = i++) {
      const a = this.nodes[this.boundary[i]], c = this.nodes[this.boundary[j]];
      if ((a.y > y) !== (c.y > y) && x < (c.x - a.x) * (y - a.y) / (c.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  contact(x: number, y: number): Contact {
    let best = Infinity, result: Contact = { a: 0, b: 0, t: 0, x: 0, y: 0, nx: 0, ny: 1, distance: 0, inside: this.contains(x, y) };
    for (let i = 0; i < this.boundary.length; i++) {
      const ai = this.boundary[i], bi = this.boundary[(i + 1) % this.boundary.length];
      const a = this.nodes[ai], b = this.nodes[bi], dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / Math.max(len2, 1e-12)));
      const px = a.x + t * dx, py = a.y + t * dy, d2 = (x - px) ** 2 + (y - py) ** 2;
      if (d2 < best) { best = d2; const l = Math.sqrt(len2) || 1; result = { a: ai, b: bi, t, x: px, y: py, nx: dy / l, ny: -dx / l, distance: Math.sqrt(d2), inside: result.inside }; }
    }
    return result;
  }
  velocity(c: Contact) { const a = this.nodes[c.a], b = this.nodes[c.b]; return { x: (1 - c.t) * a.vx + c.t * b.vx, y: (1 - c.t) * a.vy + c.t * b.vy }; }
  impulse(c: Contact, x: number, y: number) {
    const a = this.nodes[c.a], b = this.nodes[c.b];
    a.vx += x * (1 - c.t) * a.invMass; a.vy += y * (1 - c.t) * a.invMass;
    b.vx += x * c.t * b.invMass; b.vy += y * c.t * b.invMass;
  }
  advance(dt: number, gravity: number, width: number, height: number, drag?: { x: number; y: number; node: number }) {
    for (const n of this.nodes) { n.ox = n.x; n.oy = n.y; n.vy -= gravity * dt; n.x += n.vx * dt; n.y += n.vy * dt; }
    for (const e of this.edges) e.lambda = 0;
    for (const t of this.triangles) t.lambda = 0;
    // Compliance / dt² makes stiffness much less sensitive to substep count.
    const alpha = Math.pow(10, -3 - 5 * this.stiffness) / (dt * dt);
    const areaAlpha = 1e-9 / (dt * dt);
    // A pointer is an external actuator, not a teleport. Bound its displacement
    // by 4 m/s so adaptive retries can actually satisfy the relative CFL limit.
    let target: { x: number; y: number; node: number } | undefined;
    if (drag) {
      const n = this.nodes[drag.node], dx = drag.x - n.x, dy = drag.y - n.y;
      const fraction = Math.min(1, 4 * dt / Math.max(1e-12, Math.hypot(dx, dy)));
      target = { node: drag.node, x: n.x + dx * fraction, y: n.y + dy * fraction };
    }
    for (let iteration = 0; iteration < 10; iteration++) {
      for (const e of this.edges) {
        const a = this.nodes[e.a], b = this.nodes[e.b];
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1e-9;
        const dl = (-(len - e.rest) - alpha * e.lambda) / (a.invMass + b.invMass + alpha);
        e.lambda += dl;
        a.x -= a.invMass * dl * dx / len; a.y -= a.invMass * dl * dy / len;
        b.x += b.invMass * dl * dx / len; b.y += b.invMass * dl * dy / len;
      }
      for (const t of this.triangles) {
        const a = this.nodes[t.a], b = this.nodes[t.b], c = this.nodes[t.c];
        const area = ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
        const ax = (b.y - c.y) / 2, ay = (c.x - b.x) / 2, bx = (c.y - a.y) / 2, by = (a.x - c.x) / 2, cx = (a.y - b.y) / 2, cy = (b.x - a.x) / 2;
        const denom = a.invMass * (ax * ax + ay * ay) + b.invMass * (bx * bx + by * by) + c.invMass * (cx * cx + cy * cy) + areaAlpha;
        const dl = (-(area - t.rest) - areaAlpha * t.lambda) / denom;
        t.lambda += dl;
        a.x += a.invMass * dl * ax; a.y += a.invMass * dl * ay;
        b.x += b.invMass * dl * bx; b.y += b.invMass * dl * by;
        c.x += c.invMass * dl * cx; c.y += c.invMass * dl * cy;
      }
      if (target) { const n = this.nodes[target.node]; n.x += (target.x - n.x) * 0.2; n.y += (target.y - n.y) * 0.2; }
      for (const n of this.nodes) { n.x = Math.max(0.045, Math.min(width - 0.045, n.x)); n.y = Math.max(0.045, Math.min(height - 0.045, n.y)); }
    }
    for (const n of this.nodes) { n.vx = (n.x - n.ox) / dt * 0.999; n.vy = (n.y - n.oy) / dt * 0.999; }
    this.updateBounds();
  }
}
