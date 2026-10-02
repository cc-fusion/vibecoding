import type { SiteDef } from './data';

export const TILE = 40;
export const SURF = 3; // air rows above the waterline

export function mulberry(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Pt { x: number; y: number }

export interface Level {
  cols: number;
  rows: number;
  solid: Uint8Array;
  open: number[];
  nodePos: Pt[];
  corePos: Pt;
  arena: { x: number; y: number } | null;
  spawn: Pt;
  caves: Pt[];
  path: Pt[];
}

export function genLevel(site: SiteDef, rnd: () => number): Level {
  const training = site.id === -1;
  const cols = training ? 36 : 64;
  const rows = Math.round((site.depth * 10) / TILE) + SURF;
  const solid = new Uint8Array(cols * rows);
  const idx = (x: number, y: number) => y * cols + x;
  const edge = (x: number, y: number) => x < 2 || x >= cols - 2 || y >= rows - 2;
  const top = SURF + 3;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      solid[idx(x, y)] = y < top ? 0 : edge(x, y) ? 1 : rnd() < (training ? 0.2 : 0.46) ? 1 : 0;
    }
  }
  for (let it = 0; it < 4; it++) {
    const copy = solid.slice();
    for (let y = top; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (edge(x, y)) continue;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const xx = x + dx;
            const yy = y + dy;
            n += xx < 0 || yy < 0 || xx >= cols || yy >= rows ? 1 : copy[idx(xx, yy)];
          }
        }
        solid[idx(x, y)] = n >= 5 ? 1 : n <= 3 ? 0 : copy[idx(x, y)];
      }
    }
  }
  const carve = (cx: number, cy: number, r: number) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (x < 2 || x >= cols - 2 || y < 0 || y >= rows - 2) continue;
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) solid[idx(x, y)] = 0;
      }
    }
  };
  const corridor = (ax: number, ay: number, bx: number, by: number, r: number) => {
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) * 1.5));
    for (let i = 0; i <= n; i++) carve(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n, r);
  };
  // main shaft
  let tx = cols / 2;
  let vx = 0;
  const path: Pt[] = [];
  for (let y = SURF; y < rows - 8; y++) {
    vx += (rnd() - 0.5) * 0.5;
    vx *= 0.92;
    tx = Math.min(cols - 9, Math.max(9, tx + vx));
    carve(tx, y, training ? 3.6 : 3.2);
    if (y % 3 === 0) path.push({ x: tx, y });
  }
  const pathAt = (y: number) => path.reduce((b, p) => (Math.abs(p.y - y) < Math.abs(b.y - y) ? p : b), path[0] || { x: cols / 2, y });
  // terminals
  const nodePos: Pt[] = [];
  let side = rnd() < 0.5 ? -1 : 1;
  for (let i = 0; i < site.nodes; i++) {
    const fy = (i + 1) / (site.nodes + 1);
    const y = Math.floor(SURF + 6 + (rows - SURF - 22) * fy);
    const p = pathAt(y);
    side = -side;
    const cx = Math.min(cols - 9, Math.max(9, p.x + side * (training ? 6 : 10 + rnd() * 6)));
    carve(cx, y, training ? 3 : 4.5);
    corridor(p.x, y, cx, y, 2.3);
    nodePos.push({ x: cx * TILE + TILE / 2, y: y * TILE + TILE / 2 });
  }
  // vault / arena
  let corePos: Pt;
  let arena: { x: number; y: number } | null = null;
  if (site.boss) {
    const cy = rows - 12;
    for (let y = cy - 9; y <= cy + 9; y++) {
      for (let x = 0; x < cols; x++) {
        const dx = (x - cols / 2) / 21;
        const dy = (y - cy) / 8;
        if (dx * dx + dy * dy <= 1 && x >= 3 && x < cols - 3 && y < rows - 2) solid[idx(x, y)] = 0;
      }
    }
    // pillars to hide behind
    [-11, -4, 4, 11].forEach((ox, i) => {
      const px = Math.round(cols / 2 + ox);
      const py = cy + (i % 2 ? 2 : -2);
      for (let y = py - 1; y <= py + 1; y++) for (let x = px - 1; x <= px + 1; x++) solid[idx(x, y)] = 1;
    });
    corridor(tx, rows - 12 - 8, tx, cy - 4, 3);
    arena = { x: (cols / 2) * TILE, y: (cy - 1) * TILE };
    corePos = { x: (cols / 2) * TILE, y: (rows - 5.5) * TILE };
    carve(cols / 2, rows - 5.5, 1.6);
  } else if (!training) {
    carve(tx, rows - 8, 5.5);
    corridor(tx, rows - 12, tx, rows - 8, 3);
    corePos = { x: tx * TILE + TILE / 2, y: (rows - 8) * TILE + TILE / 2 };
  } else {
    corePos = { x: cols * TILE * 0.5, y: (rows - 4) * TILE };
  }
  // side caves
  const caves: Pt[] = [];
  const nCaves = training ? 2 : 7 + Math.floor(site.relics / 2);
  for (let i = 0; i < nCaves; i++) {
    const y = Math.floor(SURF + 8 + rnd() * (rows - SURF - 20));
    const p = pathAt(y);
    const s = rnd() < 0.5 ? -1 : 1;
    const cx = Math.min(cols - 7, Math.max(7, p.x + s * (7 + rnd() * 11)));
    const r = 2.3 + rnd() * 1.4;
    carve(cx, y, r);
    corridor(p.x, y, cx, y, 1.8);
    caves.push({ x: cx * TILE + TILE / 2, y: y * TILE + TILE / 2 });
  }
  // flood fill from the surface; seal unreachable pockets
  const seen = new Uint8Array(cols * rows);
  const stack = [idx(Math.floor(cols / 2), SURF + 1)];
  seen[stack[0]] = 1;
  while (stack.length) {
    const c = stack.pop() as number;
    const x = c % cols;
    const y = (c / cols) | 0;
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of nb) {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const k = idx(nx, ny);
      if (seen[k] || solid[k]) continue;
      seen[k] = 1;
      stack.push(k);
    }
  }
  const open: number[] = [];
  for (let y = SURF; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const k = idx(x, y);
      if (!solid[k] && !seen[k]) solid[k] = 1;
      else if (!solid[k] && y >= top + 1) open.push(k);
    }
  }
  return { cols, rows, solid, open, nodePos, corePos, arena, spawn: { x: (cols / 2) * TILE, y: SURF * TILE + 70 }, caves, path };
}
