import assert from "node:assert/strict";
import fs from "node:fs";
import createMPM from "../public/wasm/taichi-mpm.mjs";

const m = await createMPM({
  wasmBinary: fs.readFileSync(
    new URL("../public/wasm/taichi-mpm.wasm", import.meta.url),
  ),
});
const check = (value) => assert.equal(value, 1, m.UTF8ToString(m._mpm_error()));
function frame() {
  const count = m._mpm_count();
  const offset = m._mpm_data() / 4;
  return { count, data: m.HEAPF32.slice(offset, offset + count * 8) };
}

try {
  for (const dimension of [2, 3]) {
    for (let material = 0; material < 8; material++) {
      check(
        m._mpm_init(dimension, 0, material, 64, 1200, -9.8, 50000, 30, 0.0002),
      );
      const before = frame();
      const initialY =
        before.data.filter((_, i) => i % 8 === 1).reduce((a, b) => a + b) /
        before.count;
      check(m._mpm_step(80));
      const after = frame();
      assert.equal(
        after.count,
        1200,
        "Particles must not disappear in a short step",
      );
      assert(
        after.data.every(Number.isFinite),
        "All output attributes must be finite",
      );
      const finalY =
        after.data.filter((_, i) => i % 8 === 1).reduce((a, b) => a + b) /
        after.count;
      assert(finalY < initialY, "Material must accelerate under gravity");
      assert(m._mpm_time() > 0.015 && m._mpm_time() < 0.017);
      console.log(
        `PASS ${dimension}D material ${material}: finite, conserved count, gravity, and time`,
      );
    }
  }

  for (const dimension of [2, 3]) {
    for (const scene of [3, 4]) {
      check(
        m._mpm_init(
          dimension,
          scene,
          scene === 3 ? 1 : 0,
          64,
          2000,
          -9.8,
          50000,
          30,
          0.0002,
        ),
      );
      const before = frame();
      assert(before.count > 2000, "Rigid boundary particles must exist");
      assert(before.data.some((v, i) => i % 8 === 6 && v === 8));
      check(m._mpm_step(100));
      const after = frame();
      assert(after.data.every(Number.isFinite));
      assert(m._mpm_grid_blocks() > 0);
      console.log(
        `PASS ${dimension}D scene ${scene}: rigid boundary and CPIC pipeline`,
      );
    }
  }
  check(m._mpm_save());
  const state = m.FS.readFile("/snapshot.tcb");
  assert(state.length > 10000, "Snapshot must contain full particle state");
  console.log(
    `PASS full binary snapshot: ${state.length.toLocaleString()} bytes`,
  );

  check(m._mpm_init(3, 0, 0, 64, 18000, -9.8, 50000, 30, 0.0002));
  check(m._mpm_step(12));
  const start = performance.now();
  check(m._mpm_step(24));
  console.log(
    `Default scene: ${((performance.now() - start) / 24).toFixed(2)} ms / substep`,
  );
  console.log("All WebAssembly tests passed.");
} catch (error) {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
}
