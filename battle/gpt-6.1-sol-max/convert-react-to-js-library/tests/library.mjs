import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  createScene,
  demoScene,
  scenes,
  materialTypes,
} from "../library/src/mpm.js";
import {
  MPM_WASM_BASE64,
  MPM_WASM_SIMD_BASE64,
} from "../library/src/core/wasm/mpmWasm.js";

assert.equal(scenes.length, 10);
assert.equal(materialTypes.length, 6);
for (const material of materialTypes)
  assert.equal(demoScene(material).kind, "declarative");
for (const options of [
  { dim: 4 },
  { resolution: 0 },
  { gravity: [0, NaN] },
  { frameDt: 0 },
  { particles: {} },
  { world: [0, 1] },
]) {
  assert.throws(() => createScene(options), TypeError);
}
assert.throws(() => demoScene("lava"), TypeError);
const upstream = JSON.parse(
  await readFile(new URL("../library/UPSTREAM.json", import.meta.url), "utf8"),
);
for (const [name, data] of Object.entries({
  MPM_WASM_BASE64,
  MPM_WASM_SIMD_BASE64,
})) {
  const recorded = upstream.integrity.wasm.find((entry) => entry.name === name);
  const hash = createHash("sha256")
    .update(Buffer.from(data, "base64"))
    .digest("hex");
  assert.equal(
    hash,
    recorded.sha256,
    `${name} differs from the original archive`,
  );
}
console.log(
  "PASS: scene validation, six materials, ten original scenes, and byte-preserved scalar/SIMD WASM payloads.",
);
