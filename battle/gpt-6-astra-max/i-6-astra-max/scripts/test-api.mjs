import assert from "node:assert/strict";
import fs from "node:fs";
import createMPM from "../public/wasm/taichi-mpm.mjs";

const m = await createMPM({
  wasmBinary: fs.readFileSync(
    new URL("../public/wasm/taichi-mpm.wasm", import.meta.url),
  ),
});
const error = () => m.UTF8ToString(m._mpm_error());
const call = (name, config) =>
  m.ccall(name, "number", ["string"], [JSON.stringify(config)]);
assert.equal(
  m.ccall(
    "mpm_initialize_json",
    "number",
    ["number", "string"],
    [3, JSON.stringify({ res: [64, 64, 64], base_delta_t: 0.0001 })],
  ),
  1,
  error(),
);
assert.equal(m._mpm_count(), 0);
assert(
  call("mpm_add_json", {
    type: "sand",
    lower: [0.4, 0.4, 0.4],
    upper: [0.6, 0.6, 0.6],
    ppc: 4,
    density: 400,
  }),
  error(),
);
assert(m._mpm_count() > 1000);
assert.equal(
  call("mpm_config_json", { gravity: [0, -5, 0], rpic_damping: 0.1 }),
  1,
  error(),
);
assert.equal(
  call("mpm_levelset_json", {
    friction: 0.4,
    shapes: [{ type: "plane", normal: [0, 1, 0], d: -0.13 }],
  }),
  1,
  error(),
);
assert.equal(m._mpm_step(20), 1, error());
assert(m._mpm_time() > 0);
assert.equal(
  call("mpm_config_json", { res: [32, 32, 32] }),
  0,
  "Live grid geometry changes must be rejected",
);
assert.equal(
  m.ccall("mpm_initialize_json", "number", ["number", "string"], [3, "{"]),
  0,
  "Invalid JSON must be caught",
);
console.log(
  "General solver API: initialization, native sampling, config, boundaries, stepping, and error handling passed.",
);

assert.equal(m._mpm_init(3, 4, 0, 64, 1000, -9.8, 50000, 30, 0.0001), 1);
assert(
  call("mpm_add_json", {
    type: "rigid",
    codimensional: false,
    initial_position: [0.65, 0.65, 0.5],
    mesh_fn: "/body.obj",
    scale: [0.1, 0.1, 0.1],
    density: 200,
    friction: 0.2,
  }),
  error(),
);
assert(
  call("mpm_action_json", {
    action: "add_articulation",
    type: "distance",
    obj0: 1,
    obj1: 2,
    target_distance: 0.25,
    penalty: 1000,
  }),
  error(),
);
assert.equal(m._mpm_step(60), 1, error());
assert.equal(
  call("mpm_action_json", {
    action: "add_articulation",
    type: "distance",
    obj0: 99,
    obj1: 2,
  }),
  0,
  "Invalid rigid indices must be rejected",
);
console.log("Rigid mesh addition and distance articulation passed.");
