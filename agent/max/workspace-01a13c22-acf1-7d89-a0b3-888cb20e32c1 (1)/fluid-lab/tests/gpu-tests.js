import { FluidSolver } from "../src/solver.js";

// Deliberate synchronous readbacks / CPU cell loops for validation only.
// Nothing in this module is loaded by the production simulation.
export async function runGPUChecks(canvas) {
  const s = new FluidSolver(canvas, { size: 32 }),
    gl = s.gl,
    n = s.config.size,
    report = [];
  const check = (name, pass, details) => {
    report.push({ name, pass, ...details });
    if (!pass) throw new Error(name + ": " + JSON.stringify(details));
  };
  const read = (t) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    const a = new Float32Array(n * n * 4);
    gl.readPixels(0, 0, n, n, gl.RGBA, gl.FLOAT, a);
    return a;
  };
  const upload = (t, data, complex = false) => {
    gl.bindTexture(gl.TEXTURE_2D, t.texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      n,
      n,
      complex ? gl.RG : gl.RGBA,
      gl.FLOAT,
      data,
    );
  };
  const project = (field) => {
    upload(s.state[2], field);
    s.draw("divergence", s.fftBuffers[0], { uState: s.state[2] });
    const div = read(s.fftBuffers[0]);
    const rhs = s.transform(s.fftBuffers[0]),
      dest = rhs === s.fftBuffers[0] ? s.fftBuffers[1] : s.fftBuffers[0];
    s.draw("poisson", dest, { uInput: rhs, uRoots: s.roots });
    const q = s.transform(dest, true);
    s.draw("project", s.state[0], { uState: s.state[2], uPressure: q });
    const output = read(s.state[0]);
    s.draw("divergence", s.fftBuffers[0], { uState: s.state[0] });
    const after = read(s.fftBuffers[0]);
    let before2 = 0,
      after2 = 0;
    for (let i = 0; i < n * n; i++) {
      before2 += div[i * 4] ** 2;
      after2 += after[i * 4] ** 2;
    }
    return {
      output,
      before: Math.sqrt(before2 / (n * n)),
      after: Math.sqrt(after2 / (n * n)),
    };
  };
  try {
    const a = new Float32Array(n * n * 2);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        a[2 * (x + n * y)] =
          Math.cos((2 * Math.PI * 3 * x) / n) +
          0.7 * Math.sin((2 * Math.PI * 2 * y) / n);
    upload(s.fftBuffers[0], a, true);
    const f = s.transform(s.fftBuffers[0]),
      freq = read(f),
      restored = read(s.transform(f, true));
    let err = 0;
    for (let i = 0; i < n * n; i++)
      err = Math.max(
        err,
        Math.abs(restored[i * 4] - a[i * 2]),
        Math.abs(restored[i * 4 + 1]),
      );
    check("FFT forward/inverse round-trip", err < 2e-6, { maxError: err });
    check(
      "FFT mode amplitude",
      Math.abs(freq[3 * 4] - (n * n) / 2) < 0.001 &&
        Math.abs(freq[3 * 4 + 1]) < 0.001,
      { actual: freq[3 * 4], expected: (n * n) / 2 },
    );
    const field = new Float32Array(n * n * 4);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const i = (x + n * y) * 4;
        field[i] =
          0.1 * Math.sin((2 * Math.PI * 3 * x) / n) +
          0.07 * Math.cos((2 * Math.PI * y) / n);
        field[i + 1] =
          0.15 * Math.sin((2 * Math.PI * 2 * y) / n) +
          0.03 * Math.cos((2 * Math.PI * x) / n);
        field[i + 2] = 1;
      }
    const projected = project(field);
    check(
      "MAC projection removes divergence",
      projected.after < projected.before * 1e-5,
      { rmsBefore: projected.before, rmsAfter: projected.after },
    );
    let dyeError = 0;
    for (let i = 0; i < n * n; i++)
      dyeError = Math.max(dyeError, Math.abs(projected.output[i * 4 + 2] - 1));
    check("Projection preserves passive dye", dyeError === 0, {
      maxError: dyeError,
    });
    for (let i = 0; i < n * n; i++) {
      field[i * 4] = 0.25;
      field[i * 4 + 1] = -0.125;
      field[i * 4 + 2] = 0.5;
    }
    const constant = project(field);
    err = 0;
    for (let i = 0; i < field.length; i++)
      err = Math.max(err, Math.abs(constant.output[i] - field[i]));
    check(
      "Zero mode finite; mean velocity preserved",
      err < 1e-7 && constant.after === 0,
      { maxError: err },
    );

    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const i = (x + n * y) * 4;
        field[i] = x % 2 ? -0.1 : 0.1;
        field[i + 1] = y % 2 ? -0.1 : 0.1;
      }
    const checker = project(field);
    check(
      "MAC Nyquist mode is not a spurious pressure nullspace",
      checker.after < 1e-5,
      { rmsBefore: checker.before, rmsAfter: checker.after },
    );

    const analytic = (x, y) =>
      0.5 +
      0.2 * Math.cos((2 * Math.PI * 3 * x) / n) +
      0.2 * Math.sin((2 * Math.PI * 2 * y) / n);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const i = (x + n * y) * 4;
        field[i] = 0.4;
        field[i + 1] = 0.3;
        field[i + 2] = analytic(x, y);
      }
    upload(s.state[1], field);
    s.advect(s.state[1], s.state[1], s.state[2], 1 / n);
    const basic = read(s.state[2]);
    const wrap = (k) => (k + n) % n;
    let sampleError = 0,
      basicError = 0;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const px = x - 0.4,
          py = y - 0.3,
          ix = Math.floor(px),
          iy = Math.floor(py),
          ax = px - ix,
          ay = py - iy;
        const get = (i, j) => field[(wrap(i) + n * wrap(j)) * 4 + 2];
        const expected =
          (1 - ay) * ((1 - ax) * get(ix, iy) + ax * get(ix + 1, iy)) +
          ay * ((1 - ax) * get(ix, iy + 1) + ax * get(ix + 1, iy + 1));
        sampleError = Math.max(
          sampleError,
          Math.abs(basic[(x + n * y) * 4 + 2] - expected),
        );
        basicError += (basic[(x + n * y) * 4 + 2] - analytic(px, py)) ** 2;
      }
    check("Periodic bilinear advection matches reference", sampleError < 2e-6, {
      maxError: sampleError,
    });
    s.advect(s.state[2], s.state[1], s.state[3], -1 / n);
    s.draw("correct", s.state[0], {
      uOriginal: s.state[1],
      uReverse: s.state[3],
    });
    s.advect(s.state[0], s.state[1], s.state[3], 1 / n, true, s.state[1]);
    const corrected = read(s.state[3]);
    let bfeccError = 0,
      min = Infinity,
      max = -Infinity;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const value = corrected[(x + n * y) * 4 + 2];
        bfeccError += (value - analytic(x - 0.4, y - 0.3)) ** 2;
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    check("BFECC reduces translation error", bfeccError < basicError * 0.8, {
      semiLagrangianRMS: Math.sqrt(basicError / (n * n)),
      bfeccRMS: Math.sqrt(bfeccError / (n * n)),
    });
    check(
      "BFECC limiter preserves original extrema",
      min >= 0.1 - 1e-6 && max <= 0.9 + 1e-6,
      { min, max },
    );
    s.config.viscosity = 0.1;
    s.config.dt = 0.04;
    s.step();
    check(
      "Explicit diffusion stability cap",
      s.effectiveDt * s.config.viscosity * n * n <= 0.24000001,
      { diffusionNumber: s.effectiveDt * s.config.viscosity * n * n },
    );
    check("No WebGL errors", gl.getError() === gl.NO_ERROR, {});
    return report;
  } finally {
    s.dispose();
  }
}

/** Large-grid smoke: actual BFECC + FFT + projection at 1024² and 2048².
 * Run separately: it requires substantial GPU memory. Not a performance benchmark.
 */
export async function runLargeGridChecks(canvas, sizes = [1024, 2048]) {
  const reports = [];
  for (const size of sizes) {
    const s = new FluidSolver(canvas, { size }),
      gl = s.gl;
    try {
      const start = performance.now();
      s.step();
      s.render();
      const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      await new Promise((resolve, reject) => {
        const wait = () => {
          const status = gl.clientWaitSync(fence, 0, 0);
          if (status === gl.TIMEOUT_EXPIRED) {
            if (performance.now() - start > 120000) {
              gl.deleteSync(fence);
              reject(new Error("GPU timeout"));
            } else requestAnimationFrame(wait);
          } else {
            gl.deleteSync(fence);
            status === gl.WAIT_FAILED
              ? reject(new Error("GPU fence failed"))
              : resolve();
          }
        };
        wait();
      });
      s.poll();
      const row = {
        size,
        textureMiB: s.bytes / 1048576,
        steps: s.steps,
        fftButterflies: 4 * Math.log2(size),
        totalSolvePasses: s.lastStepPasses,
        rmsBefore: s.metrics.before,
        rmsAfter: s.metrics.after,
        glError: gl.getError(),
      };
      if (
        !Number.isFinite(row.rmsAfter) ||
        row.rmsAfter > Math.max(3e-4, row.rmsBefore * 0.001) ||
        row.glError
      )
        throw new Error("Large-grid validation failed: " + JSON.stringify(row));
      reports.push(row);
    } finally {
      s.dispose();
    }
  }
  return reports;
}
