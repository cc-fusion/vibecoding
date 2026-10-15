/** Pure typed-array mesher; runs unchanged in a Worker or in Node tests.
 * The source's exposed-face / corner-AO design is generalized to 3D chunks.
 * Greedy merging is conservative: non-uniform AO faces are never merged.
 */
export function meshChunk(data, palette, { greedy = true, ao = true } = {}) {
  const positions = [],
    normals = [],
    colors = [],
    indices = [];
  const sample = (p) => data[p[0] + 1 + 18 * (p[1] + 1 + 18 * (p[2] + 1))] || 0;
  const curve = [0.45, 0.65, 0.82, 1];
  let faces = 0,
    quads = 0;
  for (let d = 0; d < 3; d++)
    for (const sign of [-1, 1]) {
      const u = (d + 1) % 3,
        v = (d + 2) % 3;
      for (let slice = 0; slice < 16; slice++) {
        const mask = new Array(256).fill(null);
        for (let j = 0; j < 16; j++)
          for (let i = 0; i < 16; i++) {
            const p = [0, 0, 0];
            p[d] = slice;
            p[u] = i;
            p[v] = j;
            const id = sample(p);
            if (!id) continue;
            const n = p.slice();
            n[d] += sign;
            if (sample(n)) continue;
            faces++;
            const shades = [];
            for (const [a, b] of [
              [-1, -1],
              [1, -1],
              [1, 1],
              [-1, 1],
            ]) {
              if (!ao) {
                shades.push(3);
                continue;
              }
              const s1 = n.slice(),
                s2 = n.slice(),
                sc = n.slice();
              s1[u] += a;
              s2[v] += b;
              sc[u] += a;
              sc[v] += b;
              const A = !!sample(s1),
                B = !!sample(s2),
                C = !!sample(sc);
              shades.push(A && B ? 0 : 3 - Number(A) - Number(B) - Number(C));
            }
            const uniform = shades.every((s) => s === shades[0]);
            mask[i + j * 16] = {
              id,
              shades,
              key: uniform ? `${id}:${shades[0]}` : `unique:${i}:${j}`,
            };
          }
        for (let j = 0; j < 16; j++)
          for (let i = 0; i < 16; ) {
            const cell = mask[i + j * 16];
            if (!cell) {
              i++;
              continue;
            }
            let w = 1,
              h = 1;
            if (greedy) {
              while (i + w < 16 && mask[i + w + j * 16]?.key === cell.key) w++;
              outer: while (j + h < 16) {
                for (let k = 0; k < w; k++)
                  if (mask[i + k + (j + h) * 16]?.key !== cell.key) break outer;
                h++;
              }
            }
            const base = positions.length / 3,
              rgb = palette[cell.id] || [0.8, 0.2, 0.7];
            const corners = [
              [i, j],
              [i + w, j],
              [i + w, j + h],
              [i, j + h],
            ];
            for (let k = 0; k < 4; k++) {
              const p = [0, 0, 0],
                n = [0, 0, 0];
              p[d] = slice + (sign > 0 ? 1 : 0);
              p[u] = corners[k][0];
              p[v] = corners[k][1];
              n[d] = sign;
              positions.push(...p);
              normals.push(...n);
              const shade = curve[cell.shades[k]];
              colors.push(rgb[0] * shade, rgb[1] * shade, rgb[2] * shade);
            }
            const flip =
              cell.shades[0] + cell.shades[2] > cell.shades[1] + cell.shades[3];
            const idx = flip ? [0, 1, 3, 1, 2, 3] : [0, 1, 2, 0, 2, 3];
            if (sign < 0) {
              [idx[1], idx[2]] = [idx[2], idx[1]];
              [idx[4], idx[5]] = [idx[5], idx[4]];
            }
            indices.push(...idx.map((n) => base + n));
            quads++;
            for (let b = 0; b < h; b++)
              for (let a = 0; a < w; a++) mask[i + a + (j + b) * 16] = null;
            i += w;
          }
      }
    }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
    faces,
    quads,
  };
}
