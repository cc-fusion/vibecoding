import type { Vec2 } from './schema';

export const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function signedArea(pts: Vec2[]): number {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a * 0.5;
}

export function centroid(pts: Vec2[]): Vec2 {
  const a = signedArea(pts);
  if (Math.abs(a) < 1e-9) {
    let x = 0, y = 0;
    for (const p of pts) { x += p.x; y += p.y; }
    return { x: x / Math.max(1, pts.length), y: y / Math.max(1, pts.length) };
  }
  let cx = 0, cy = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f; cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

function segsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const o = (p: Vec2, q: Vec2, r: Vec2) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export function isSelfIntersecting(pts: Vec2[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if (segsIntersect(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** Validate & repair a user polygon: removes duplicate points, enforces CW winding (Matter/y-down), rejects degenerate input. */
export function sanitizePolygon(raw: Vec2[], minArea = 400): { ok: true; pts: Vec2[] } | { ok: false; reason: string } {
  if (!Array.isArray(raw)) return { ok: false, reason: 'not an array' };
  const pts: Vec2[] = [];
  for (const p of raw) {
    if (!p || !isFiniteNum(p.x) || !isFiniteNum(p.y)) return { ok: false, reason: 'non-finite vertex' };
    const last = pts[pts.length - 1];
    if (last && Math.hypot(last.x - p.x, last.y - p.y) < 2) continue;
    pts.push({ x: p.x, y: p.y });
  }
  if (pts.length > 2) {
    const f = pts[0], l = pts[pts.length - 1];
    if (Math.hypot(f.x - l.x, f.y - l.y) < 2) pts.pop();
  }
  if (pts.length < 3) return { ok: false, reason: 'need at least 3 vertices' };
  if (pts.length > 64) return { ok: false, reason: 'too many vertices (max 64)' };
  const area = signedArea(pts);
  if (Math.abs(area) < minArea) return { ok: false, reason: 'polygon area is too small' };
  if (isSelfIntersecting(pts)) return { ok: false, reason: 'polygon self-intersects' };
  if (area < 0) pts.reverse(); // consistent winding: positive signed area in y-down space (clockwise on screen)
  return { ok: true, pts };
}

export function pointInPolygon(x: number, y: number, pts: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Point in polygon given flat typed array of (x,y) pairs. */
export function pointInRing(x: number, y: number, ring: Float32Array, n: number): boolean {
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[2 * i], yi = ring[2 * i + 1], xj = ring[2 * j], yj = ring[2 * j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export function rotate(p: Vec2, a: number): Vec2 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

export function snapValue(v: number, size: number, enabled: boolean): number {
  return enabled && size > 0 ? Math.round(v / size) * size : v;
}
