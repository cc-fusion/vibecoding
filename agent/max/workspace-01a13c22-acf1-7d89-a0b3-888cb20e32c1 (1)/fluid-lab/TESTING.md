# Validation record

## Environment

Chromium with software WebGL (SwiftShader) in the sandbox. These results establish numerical behavior and successful execution, **not representative hardware-GPU frame rates**. GPU timer queries were unavailable in this test environment; the UI correctly displayed `—`.

## Repeatable tests included

### Node — 11 tests

```sh
npm test
# equivalent: node --test tests/*.test.js
```

All pass:

1. Power-of-two grid validation and resource bounds.
2. Explicit-diffusion time-step cap.
3. Logarithmic FFT butterfly pass count.
4. Numerical texture-memory accounting.
5. Stockham ordering/sign vs. an independent direct DFT.
6. Complex 1D FFT normalization and round-trip.
7. Complex 2D row/column FFT round-trip.
8. Periodic wrap at all sides/corners.
9. Discrete five-point Laplacian eigenvalue.
10. Matched MAC divergence/gradient direct projection.
11. Constant-flow / zero-mode preservation.

These combine tests of production scalar helpers with a separate, double-precision CPU reference. They do not substitute for shader tests.

### Browser — 11 production-shader checks

Open `http://localhost:3000/tests/gpu.html` and select **Run validation**. The runner executes the actual production GLSL programs at 32², reads back results, and asserts:

| Check | Observed result |
| --- | --- |
| FFT forward/inverse maximum round-trip error | 2.3842 × 10⁻⁷ |
| Known Fourier mode amplitude | 512, expected 512 |
| MAC projection RMS divergence | 1.86536 → 1.66192 × 10⁻⁶ |
| Passive dye unchanged by projection | maximum error 0 |
| Uniform velocity / zero pressure mode | maximum error 0 |
| MAC Nyquist checkerboard is not a pressure nullspace | RMS divergence 9.05097 → 0 |
| Periodic bilinear advection vs. CPU reference | maximum error 1.3113 × 10⁻⁷ |
| Smooth periodic translation, basic semi-Lagrangian | RMS error 6.2751 × 10⁻³ |
| Same translation with BFECC | RMS error 4.7074 × 10⁻⁴ |
| Limiter: original dye extrema [0.1, 0.9] | result [0.103843, 0.896157] |
| Explicit diffusion number ν Δt / h² | 0.24 |
| WebGL error state | NO_ERROR |

The translation error comparison is one test with two reported results, yielding 11 checks in total. BFECC improves this particular transport test; it is not an all-flows accuracy guarantee. Test code intentionally uses CPU loops and synchronous full-field readbacks; the production app does not import it.

### Actual large-grid GPU solves

The separate **Test 1024² + 2048²** button runs one full BFECC + FFT + projection step at each resolution, with a GPU fence and reduced diagnostics. It needs substantial memory and asks for confirmation.

Both passed in the sandbox:

| Grid | Numerical textures | FFT butterflies | Total solve passes | RMS divergence before → after |
| --- | ---: | ---: | ---: | --- |
| 1024² | 85.34895 MiB | 40 | 48 | 1.33516 × 10⁻² → 2.47751 × 10⁻⁵ |
| 2048² | 341.36458 MiB | 44 | 52 | 1.33614 × 10⁻² → 1.02119 × 10⁻⁴ |

No WebGL errors were observed. The nonzero post-projection residual is Float32 numerical error, amplified by the fine-grid differentiation operators. There is no relaxation tolerance and no iterative correction. The tests explicitly report these residuals rather than calling them zero.

## Browser interaction checks performed

Desktop 1366 × 900 and 1440 × 960; mobile-width 390 × 844:

- Default 1024² app loaded, completed multiple steps, rendered, and paused without JS/WebGL errors.
- Pause / resume and exactly one single-step advance.
- BFECC toggling changed solve pass counts as expected (32 vs. 29 at 64²).
- Dye / velocity / pressure views, palette changes, grid and vector overlays.
- Solver-notes modal opening/closing.
- Pointer drawing injected nonzero dye into an initially empty domain.
- PNG download generated a nonempty file.
- Resolution rebuilding, correct cell count, and cancellation of the 2048² allocation confirmation.
- High-viscosity time-step bound.
- Expanded viewport and Escape restoration.
- Mobile controls drawer, Escape dismissal, and no horizontal page overflow.

Some software WebGL runs emitted driver performance warnings about readback. Production diagnostics use a one-pixel pixel-pack-buffer transfer followed by nonblocking fence polling, but drivers may still synchronize internally. No claim of zero driver stalls is made.

## Important limits of validation

This is not a convergence study or a validated CFD benchmark suite. Long-term energy/mass conservation, Reynolds-number fidelity, wall boundaries, obstacles, variable-density fluids, non-square grids, and engineering use are outside the current scope. Numerical tolerances can vary by GPU/driver. The included GPU test page is the preferred way to check a target device.
