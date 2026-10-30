import assert from 'node:assert/strict';
import { createWorkerRuntime } from '../src/lib/worker.js';
import { DEFAULT_SCENE, validateScene } from '../src/lib/scene-builder.js';

const custom = structuredClone(DEFAULT_SCENE);
custom.levelset = {
  includeDefaultBoundaries: false,
  planes: [{ normal: [0, 1], d: -0.04 }],
  boxes: [{ lower: [0.2, 0.15], upper: [0.8, 0.2], insideOut: false }],
  spheres: [{ center: [0.5, 0.45], radius: 0.13, insideOut: true }],
  friction: 0.5,
};
assert.equal(validateScene(custom), true);
assert.throws(() => validateScene({ ...custom, levelset: { planes: [{ normal: [1, 0, 0], d: 0 }] } }), /normal must contain 2/);

const messages = [];
let incoming = null;
const transport = {
  isMainThread: true,
  postMessage(message) { messages.push(message); },
};
Object.defineProperty(transport, 'onmessage', { get: () => incoming, set: fn => { incoming = fn; } });
const runtime = createWorkerRuntime(transport);
const waitFor = async (predicate, timeout = 20000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = messages.find(predicate);
    if (found) return found;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for worker message. Seen: ' + messages.map(m => m.type).join(', '));
};
try {
  await waitFor(m => m.type === 'ready');
  incoming({ data: { type: 'load', scene: custom, quality: 'low', autoPlay: false, requestId: 1 } });
  const loadedJSON = await waitFor(m => m.type === 'loaded');
  assert.equal(loadedJSON.info.custom, true);
  assert.equal(loadedJSON.info.dim, 2);
  assert.ok(messages.some(m => m.type === 'frame' && m.stats.particles > 0));

  const moduleSource = `export const metadata = { id: 'module-check', name: 'Module check', dim: 2, duration: 0 };\nexport function setup(ctx) { const mpm = ctx.createMPM({ resolution: 96, gravity: [0, -9.81] }); const bounds = mpm.create_levelset(); bounds.add_plane([0, 1], -0.05); mpm.set_levelset(bounds); const field = ctx.tex.sphere([0.5, 0.7, 0.5], 0.1).mul(2); mpm.add_particles({ type: 'water', density: 1000, density_tex: field }); return { mpm, update(t, dt, api) { if (t > 0.2 && t < 0.2 + dt) api.addParticles({ material: 'jelly', center: [0.5, 0.8], radius: 0.02 }); } }; }
export function onMessage(name, payload, api) { if (name === 'probe' && payload.ok) api.generalAction({ action: 'set_config', gravity: [0, -6] }); }`;
  const dataURL = `data:text/javascript;charset=utf-8,${encodeURIComponent(moduleSource)}`;
  incoming({ data: { type: 'load', scene: { kind: 'module', url: dataURL }, quality: 'low', autoPlay: false, requestId: 2 } });
  const loadedModule = await waitFor(m => m.type === 'loaded' && m.info.sceneId === 'module-check');
  assert.equal(loadedModule.info.custom, true);
  assert.equal(loadedModule.info.dim, 2);
  assert.ok(messages.filter(m => m.type === 'frame').at(-1).stats.particles > 0);
  incoming({ data: { type: 'sceneMessage', name: 'probe', payload: { ok: true }, requestId: 3 } });
  const inputResult = await waitFor(m => m.type === 'result' && m.requestId === 3);
  assert.deepEqual(inputResult.result, { ok: true });

  incoming({ data: { type: 'dispose' } });
  console.log('PASS: JSON custom level sets, main-thread fallback runtime, ES-module import, worker-side input callback, and WASM frame export.');
} finally {
  runtime.dispose();
}
