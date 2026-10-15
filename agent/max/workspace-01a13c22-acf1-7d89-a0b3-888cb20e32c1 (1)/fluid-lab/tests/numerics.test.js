import test from "node:test";
import assert from "node:assert/strict";
import {
  validateSize,
  stableTimeStep,
  butterflyPasses,
  textureBytes,
} from "../src/numerics.js";
import {
  stockham1D,
  directDFT,
  fft2,
  ix,
  eigenvalue,
  project,
} from "./reference.js";
const maxError = (a, b) =>
  a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);
test("sizes are power-of-two and resource-bounded", () => {
  for (const n of [16, 32, 256, 512, 1024, 2048])
    assert.equal(validateSize(n), n);
  for (const n of [0, 3, 128.5, 1023, 4096, NaN])
    assert.throws(() => validateSize(n));
});
test("explicit diffusion number never exceeds 0.24", () => {
  for (const n of [256, 1024, 2048])
    for (const nu of [1e-8, 1e-6, 1e-4, 1])
      assert(stableTimeStep(0.04, nu, n) * nu * n * n <= 0.24000000001);
  assert.equal(stableTimeStep(0.016, 0, 1024), 0.016);
  assert.equal(stableTimeStep(0, 1, 1024), 0);
  assert.throws(() => stableTimeStep(0.1, -1, 32));
});
test("FFT butterfly count is logarithmic", () => {
  assert.equal(butterflyPasses(1024), 40);
  assert.equal(butterflyPasses(2048), 44);
});
test("texture storage includes fields, scratch, reductions, roots", () => {
  let sum = 80 * 1024 ** 2 + 16 * 1024;
  for (let n = 512; n >= 1; n /= 2) sum += 16 * n * n;
  assert.equal(textureBytes(1024), sum);
  assert.equal(textureBytes(2048), 357946704);
});
test("Stockham ordering and sign match an independent direct DFT", () => {
  const a = Float64Array.from(
    { length: 32 },
    (_, i) => Math.sin(i * 1.321) + Math.cos(i * 0.527),
  );
  assert(maxError(stockham1D(a), directDFT(a)) < 1e-12);
});
test("complex FFT forward/inverse normalization", () => {
  const a = Float64Array.from({ length: 64 }, (_, i) => Math.cos(i * 0.7));
  assert(maxError(stockham1D(stockham1D(a), true), a) < 1e-12);
});
test("2D FFT retains complex data through row/column transforms", () => {
  const a = Float64Array.from({ length: 16 * 16 * 2 }, (_, i) =>
    Math.sin(i * 0.213),
  );
  assert(maxError(fft2(fft2(a, 16), 16, true), a) < 1e-12);
});
test("periodic indexing wraps all four edges and corners", () => {
  assert.equal(ix(-1, 0, 32), 31);
  assert.equal(ix(32, 0, 32), 0);
  assert.equal(ix(0, -1, 32), 992);
  assert.equal(ix(-1, -1, 32), 1023);
});
test("discrete Laplacian Fourier symbol matches five-point stencil", () => {
  const n = 32,
    kx = 3,
    ky = 5,
    f = (x, y) => Math.cos((2 * Math.PI * (kx * x + ky * y)) / n),
    x = 7,
    y = 8;
  const lap =
    n *
    n *
    (f(x + 1, y) + f(x - 1, y) + f(x, y + 1) + f(x, y - 1) - 4 * f(x, y));
  assert(Math.abs(lap - eigenvalue(kx, ky, n) * f(x, y)) < 1e-10);
});
test("matching MAC divergence and gradient give a direct projection", () => {
  const n = 16,
    u = Float64Array.from({ length: n * n }, (_, i) => Math.sin(i * 1.73)),
    v = Float64Array.from({ length: n * n }, (_, i) => Math.cos(i * 0.37)),
    [a, b] = project(u, v, n);
  let max = 0;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      max = Math.max(
        max,
        Math.abs(
          n *
            (a[ix(x, y, n)] -
              a[ix(x - 1, y, n)] +
              b[ix(x, y, n)] -
              b[ix(x, y - 1, n)]),
        ),
      );
  assert(max < 1e-12);
});
test("constant flow and zero pressure mode remain finite", () => {
  const n = 16,
    u = new Float64Array(n * n).fill(0.2),
    v = new Float64Array(n * n).fill(-0.4),
    [a, b] = project(u, v, n);
  assert.equal(maxError(a, u), 0);
  assert.equal(maxError(b, v), 0);
});
