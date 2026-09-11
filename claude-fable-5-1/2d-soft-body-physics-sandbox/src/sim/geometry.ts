import type { Vec } from './types';

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

/** Signed area via the shoelace formula (positive = consistent winding for our normals). */
export function signedArea(pts: Vec[]): number {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function centroid(pts: Vec[]): Vec {
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / pts.length, y: cy / pts.length };
}

/** Area-weighted centroid (centre of mass of a uniform lamina). */
export function areaCentroid(pts: Vec[]): Vec {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const cross = p.x * q.y - q.x * p.y;
    a += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  if (Math.abs(a) < 1e-6) return centroid(pts);
  a *= 0.5;
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export function perimeter(pts: Vec[]): number {
  let l = 0;
  for (let i = 0, n = pts.length; i < n; i++) l += dist(pts[i], pts[(i + 1) % n]);
  return l;
}

/** Ensure positive signed area (so outward normal = (dy, -dx)). */
export function normalizeWinding(pts: Vec[]): Vec[] {
  return signedArea(pts) < 0 ? [...pts].reverse() : [...pts];
}

export function pointInPolygon(p: Vec, pts: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function orient(a: Vec, b: Vec, c: Vec): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Vec, b: Vec, c: Vec): boolean {
  return (
    Math.min(a.x, b.x) <= c.x && c.x <= Math.max(a.x, b.x) && Math.min(a.y, b.y) <= c.y && c.y <= Math.max(a.y, b.y)
  );
}

export function segmentsIntersect(p1: Vec, p2: Vec, p3: Vec, p4: Vec): boolean {
  const d1 = orient(p3, p4, p1);
  const d2 = orient(p3, p4, p2);
  const d3 = orient(p1, p2, p3);
  const d4 = orient(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  if (d1 === 0 && onSegment(p3, p4, p1)) return true;
  if (d2 === 0 && onSegment(p3, p4, p2)) return true;
  if (d3 === 0 && onSegment(p1, p2, p3)) return true;
  if (d4 === 0 && onSegment(p1, p2, p4)) return true;
  return false;
}

/** True if the closed polygon has no self-intersections (non-adjacent edges). */
export function isSimplePolygon(pts: Vec[]): boolean {
  const n = pts.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a1 = pts[i];
    const a2 = pts[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // skip adjacent edges
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      const b1 = pts[j];
      const b2 = pts[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

/** Would adding a new open segment (last -> p) cross the existing open polyline? */
export function polylineSegmentValid(points: Vec[], p: Vec): boolean {
  if (points.length < 2) return true;
  const last = points[points.length - 1];
  for (let i = 0; i < points.length - 2; i++) {
    if (segmentsIntersect(points[i], points[i + 1], last, p)) return false;
  }
  return true;
}

/** Remove near-duplicate consecutive points. */
export function dedupe(pts: Vec[], eps = 1): Vec[] {
  const out: Vec[] = [];
  for (const p of pts) {
    if (!out.length || dist(out[out.length - 1], p) > eps) out.push(p);
  }
  if (out.length > 1 && dist(out[0], out[out.length - 1]) <= eps) out.pop();
  return out;
}

/** Resample a closed polygon into `n` points evenly spaced along its perimeter. */
export function resamplePolygon(pts: Vec[], n: number): Vec[] {
  const total = perimeter(pts);
  const step = total / n;
  const out: Vec[] = [];
  // walk the boundary with a running arc-length cursor
  let seg = 0;
  let segStart = 0; // arc length at start of current segment
  let segLen = dist(pts[0], pts[1 % pts.length]);
  for (let k = 0; k < n; k++) {
    const target = k * step;
    while (target > segStart + segLen && seg < pts.length - 1) {
      segStart += segLen;
      seg++;
      segLen = dist(pts[seg], pts[(seg + 1) % pts.length]);
    }
    const a = pts[seg];
    const b = pts[(seg + 1) % pts.length];
    const u = segLen > 0 ? clamp((target - segStart) / segLen, 0, 1) : 0;
    out.push({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) });
  }
  return out;
}

/** Point on the closed polygon boundary at a given arc length. */
export function pointAtLength(pts: Vec[], target: number, total?: number): Vec {
  const tot = total ?? perimeter(pts);
  let t = ((target % tot) + tot) % tot;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const l = dist(a, b);
    if (t <= l || i === pts.length - 1) {
      const u = l > 0 ? clamp(t / l, 0, 1) : 0;
      return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
    }
    t -= l;
  }
  return { ...pts[0] };
}

/* ------------------------------------------------------------------ */
/* Preset outlines (centered at origin)                                */
/* ------------------------------------------------------------------ */

export function circleOutline(r: number, n = 32): Vec[] {
  const pts: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return pts;
}

export function ellipseOutline(rx: number, ry: number, n = 32): Vec[] {
  const pts: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry });
  }
  return pts;
}

export function rectOutline(w: number, h: number): Vec[] {
  const hw = w / 2;
  const hh = h / 2;
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
}

export function blobOutline(rx: number, ry: number, seed = Math.random() * 1000, n = 40): Vec[] {
  const pts: Vec[] = [];
  // a few low-frequency harmonics give an organic, non-self-intersecting outline
  const h1 = 0.12 + seededRand(seed) * 0.1;
  const h2 = 0.05 + seededRand(seed + 1) * 0.08;
  const p1 = seededRand(seed + 2) * Math.PI * 2;
  const p2 = seededRand(seed + 3) * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const f = 1 + h1 * Math.sin(a * 2 + p1) + h2 * Math.sin(a * 3 + p2);
    pts.push({ x: Math.cos(a) * rx * f, y: Math.sin(a) * ry * f });
  }
  return pts;
}

export function starOutline(rOuter: number, rInner: number, points = 5): Vec[] {
  const pts: Vec[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? rOuter : rInner;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return pts;
}

export function regularPolygon(r: number, sides: number, rot = 0): Vec[] {
  const pts: Vec[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + rot;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return pts;
}

function seededRand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function rotateVec(v: Vec, angle: number): Vec {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

export function boundsOf(pts: Vec[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}
