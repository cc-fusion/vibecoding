/** Small pure helpers shared by the renderer and dependency-free Node tests. */
export function validateSize(n) {
  if (!Number.isInteger(n) || n < 16 || n > 2048 || n & (n - 1)) {
    throw new RangeError(
      "Grid size must be a power of two between 16 and 2048.",
    );
  }
  return n;
}
export function stableTimeStep(requested, viscosity, n) {
  if (
    !Number.isFinite(requested) ||
    requested < 0 ||
    !Number.isFinite(viscosity) ||
    viscosity < 0
  ) {
    throw new RangeError(
      "Time step and viscosity must be finite and nonnegative.",
    );
  }
  return Math.min(
    requested,
    viscosity > 0 ? 0.24 / (viscosity * n * n) : Infinity,
  );
}
export function butterflyPasses(n) {
  return 4 * Math.log2(validateSize(n));
}
export function textureBytes(n) {
  validateSize(n);
  // 4 RGBA32F fields, 2 RG32F FFT buffers, RGBA32F reduction pyramid, 1D roots.
  return 80 * n * n + (16 * (n * n - 1)) / 3 + 16 * n;
}
