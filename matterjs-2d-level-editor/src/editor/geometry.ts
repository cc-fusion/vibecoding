import type { Vec2 } from "./types";

export const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

export function snapValue(v: number, spacing: number) {
  return Math.round(v / spacing) * spacing;
}

export function snapPoint(p: Vec2, spacing: number): Vec2 {
  return { x: snapValue(p.x, spacing), y: snapValue(p.y, spacing) };
}

export function polygonArea(pts: Vec2[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function polygonCentroid(pts: Vec2[]): Vec2 {
  const area = polygonArea(pts);
  if (Math.abs(area) < 1e-9) {
    const s = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: s.x / pts.length, y: s.y / pts.length };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const cross = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

function orient(a: Vec2, b: Vec2, c: Vec2) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Vec2, b: Vec2, p: Vec2) {
  return (
    Math.min(a.x, b.x) - 1e-9 <= p.x &&
    p.x <= Math.max(a.x, b.x) + 1e-9 &&
    Math.min(a.y, b.y) - 1e-9 <= p.y &&
    p.y <= Math.max(a.y, b.y) + 1e-9
  );
}

export function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2) {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
  if (Math.abs(o1) < 1e-9 && onSegment(a, b, c)) return true;
  if (Math.abs(o2) < 1e-9 && onSegment(a, b, d)) return true;
  if (Math.abs(o3) < 1e-9 && onSegment(c, d, a)) return true;
  if (Math.abs(o4) < 1e-9 && onSegment(c, d, b)) return true;
  return false;
}

export function isSelfIntersecting(pts: Vec2[]) {
  const n = pts.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // skip adjacent edges (they share a vertex)
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      const c = pts[j];
      const d = pts[(j + 1) % n];
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

export interface PolygonValidation {
  ok: boolean;
  /** Cleaned vertices (duplicates removed) */
  vertices: Vec2[];
  error: string | null;
  removedDuplicates: number;
}

export const MIN_VERTEX_DISTANCE = 3;
export const MIN_POLYGON_AREA = 40;

/** Validates a user-drawn polygon. Returns cleaned vertices or a descriptive error. */
export function validatePolygon(points: Vec2[]): PolygonValidation {
  const cleaned: Vec2[] = [];
  let removed = 0;
  for (const p of points) {
    if (cleaned.length && dist(cleaned[cleaned.length - 1], p) < MIN_VERTEX_DISTANCE) {
      removed++;
      continue;
    }
    cleaned.push({ x: p.x, y: p.y });
  }
  // closing duplicate
  while (cleaned.length > 1 && dist(cleaned[0], cleaned[cleaned.length - 1]) < MIN_VERTEX_DISTANCE) {
    cleaned.pop();
    removed++;
  }
  if (cleaned.length < 3) {
    return { ok: false, vertices: cleaned, error: `Need at least 3 distinct vertices (${cleaned.length} placed)`, removedDuplicates: removed };
  }
  // non-adjacent near-duplicates
  for (let i = 0; i < cleaned.length; i++) {
    for (let j = i + 1; j < cleaned.length; j++) {
      if (dist(cleaned[i], cleaned[j]) < MIN_VERTEX_DISTANCE) {
        return { ok: false, vertices: cleaned, error: `Vertices ${i + 1} and ${j + 1} overlap`, removedDuplicates: removed };
      }
    }
  }
  const area = Math.abs(polygonArea(cleaned));
  if (area < MIN_POLYGON_AREA) {
    return { ok: false, vertices: cleaned, error: "Polygon has effectively zero area (points are collinear or too small)", removedDuplicates: removed };
  }
  if (isSelfIntersecting(cleaned)) {
    return { ok: false, vertices: cleaned, error: "Edges cross each other — polygon must be a simple outline", removedDuplicates: removed };
  }
  return { ok: true, vertices: cleaned, error: null, removedDuplicates: removed };
}

export function pointToSegmentDistance(p: Vec2, a: Vec2, b: Vec2) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function regularPolygonVertices(sides: number, radius: number): Vec2[] {
  const out: Vec2[] = [];
  const theta = (2 * Math.PI) / sides;
  const offset = theta * 0.5;
  for (let i = 0; i < sides; i++) {
    const angle = offset + i * theta;
    out.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return out;
}

export function roundTo(v: number, decimals = 2) {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

let idCounter = 0;
export function makeId(prefix: string) {
  idCounter = (idCounter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
