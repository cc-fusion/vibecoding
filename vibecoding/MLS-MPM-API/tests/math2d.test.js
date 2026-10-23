import { describe, expect, it } from "vitest";
import { quadraticWeights, svd2 } from "../src/math2d.js";
function reconstruct(matrix) {
  const decomposition = new Float64Array(10);
  svd2(...matrix, decomposition);
  const [u00, u01, u10, u11, s0, s1, v00, v01, v10, v11] = decomposition;
  return {
    decomposition,
    reconstructed: [
      u00 * s0 * v00 + u01 * s1 * v01,
      u00 * s0 * v10 + u01 * s1 * v11,
      u10 * s0 * v00 + u11 * s1 * v01,
      u10 * s0 * v10 + u11 * s1 * v11
    ]
  };
}
describe("analytic 2x2 SVD", () => {
  const angle = 0.63;
  const matrices = [
    [1, 0, 0, 1],
    [2, 0, 0, 0.5],
    [Math.cos(angle), -Math.sin(angle), Math.sin(angle), Math.cos(angle)],
    [1.4, 0.35, -0.2, 0.8],
    [-0.8, 0.2, 0.1, 0.65],
    [1, 2, 2, 4],
    [0, 0, 0, 0]
  ];
  for (const [index, matrix] of matrices.entries()) {
    it(`reconstructs matrix ${index + 1} with orthonormal factors`, () => {
      const { decomposition: d, reconstructed } = reconstruct(matrix);
      for (let i = 0; i < 4; i++) expect(reconstructed[i]).toBeCloseTo(matrix[i], 9);
      expect(d[4]).toBeGreaterThanOrEqual(d[5]);
      expect(d[5]).toBeGreaterThanOrEqual(0);
      expect(d[0] * d[0] + d[2] * d[2]).toBeCloseTo(1, 10);
      expect(d[1] * d[1] + d[3] * d[3]).toBeCloseTo(1, 10);
      expect(d[0] * d[1] + d[2] * d[3]).toBeCloseTo(0, 10);
      expect(d[6] * d[6] + d[8] * d[8]).toBeCloseTo(1, 10);
      expect(d[7] * d[7] + d[9] * d[9]).toBeCloseTo(1, 10);
      expect(d[6] * d[7] + d[8] * d[9]).toBeCloseTo(0, 10);
    });
  }
  it("handles deterministic randomized matrices", () => {
    let seed = 305419896;
    const random = () => {
      seed = 1664525 * seed + 1013904223 >>> 0;
      return seed / 4294967295 * 4 - 2;
    };
    for (let sample = 0; sample < 100; sample++) {
      const matrix = [random(), random(), random(), random()];
      const { reconstructed } = reconstruct(matrix);
      for (let i = 0; i < 4; i++) expect(reconstructed[i]).toBeCloseTo(matrix[i], 8);
    }
  });
});
describe("quadratic MLS-MPM kernel", () => {
  it("forms a partition of unity", () => {
    const weights = new Float64Array(3);
    for (let sample = 0; sample <= 100; sample++) {
      quadraticWeights(sample / 100, weights);
      expect(weights[0] + weights[1] + weights[2]).toBeCloseTo(1, 14);
    }
  });
});
