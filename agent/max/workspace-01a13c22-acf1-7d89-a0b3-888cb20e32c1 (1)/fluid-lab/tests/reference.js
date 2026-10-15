// Independent CPU reference for numerical tests only. Not imported by the app.
export function stockham1D(input, inverse = false) {
  const n = input.length / 2;
  let source = Float64Array.from(input);
  for (let m = 2; m <= n; m *= 2) {
    const dest = new Float64Array(input.length);
    for (let k = 0; k < n; k++) {
      const base = Math.floor(k / m) * (m / 2) + (k % (m / 2)),
        a = base * 2,
        b = (base + n / 2) * 2;
      const angle = ((inverse ? 2 : -2) * Math.PI * (k % m)) / m,
        c = Math.cos(angle),
        s = Math.sin(angle),
        scale = inverse ? 0.5 : 1;
      dest[2 * k] = (source[a] + c * source[b] - s * source[b + 1]) * scale;
      dest[2 * k + 1] =
        (source[a + 1] + s * source[b] + c * source[b + 1]) * scale;
    }
    source = dest;
  }
  return source;
}
export function directDFT(input) {
  const n = input.length / 2,
    out = new Float64Array(input.length);
  for (let k = 0; k < n; k++)
    for (let j = 0; j < n; j++) {
      const a = (-2 * Math.PI * k * j) / n,
        c = Math.cos(a),
        s = Math.sin(a);
      out[2 * k] += input[2 * j] * c - input[2 * j + 1] * s;
      out[2 * k + 1] += input[2 * j] * s + input[2 * j + 1] * c;
    }
  return out;
}
export function fft2(input, n, inverse = false) {
  let result = Float64Array.from(input);
  for (let axis = 0; axis < 2; axis++) {
    const next = new Float64Array(input.length);
    for (let line = 0; line < n; line++) {
      const data = new Float64Array(2 * n);
      for (let k = 0; k < n; k++) {
        const i = axis === 0 ? k + line * n : line + k * n;
        data[2 * k] = result[2 * i];
        data[2 * k + 1] = result[2 * i + 1];
      }
      const transformed = stockham1D(data, inverse);
      for (let k = 0; k < n; k++) {
        const i = axis === 0 ? k + line * n : line + k * n;
        next[2 * i] = transformed[2 * k];
        next[2 * i + 1] = transformed[2 * k + 1];
      }
    }
    result = next;
  }
  return result;
}
export const ix = (x, y, n) => (((x % n) + n) % n) + n * (((y % n) + n) % n);
export const eigenvalue = (x, y, n) =>
  -4 *
  n *
  n *
  (Math.sin((Math.PI * x) / n) ** 2 + Math.sin((Math.PI * y) / n) ** 2);
export function project(u, v, n) {
  const rhs = new Float64Array(n * n * 2);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = ix(x, y, n);
      rhs[2 * i] = n * (u[i] - u[ix(x - 1, y, n)] + v[i] - v[ix(x, y - 1, n)]);
    }
  const frequency = fft2(rhs, n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = 2 * ix(x, y, n),
        lambda = eigenvalue(x, y, n);
      frequency[i] = lambda ? frequency[i] / lambda : 0;
      frequency[i + 1] = lambda ? frequency[i + 1] / lambda : 0;
    }
  const q = fft2(frequency, n, true),
    outU = new Float64Array(n * n),
    outV = new Float64Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = ix(x, y, n);
      outU[i] = u[i] - n * (q[2 * ix(x + 1, y, n)] - q[2 * i]);
      outV[i] = v[i] - n * (q[2 * ix(x, y + 1, n)] - q[2 * i]);
    }
  return [outU, outV];
}
