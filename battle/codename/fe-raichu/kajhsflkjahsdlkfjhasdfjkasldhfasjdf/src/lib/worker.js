import { MPMEngine, TextureFactory, SegmentMesh } from './engine.js';
import { SCENES } from './scenes.js';
import { buildScene, addObject, validateScene, clone } from './scene-builder.js';

let engine, scene, mpm, runtime, frameUpdate;
let running = false, stepping = false, inFrame = false, broken = false, awaitingAck = false, pendingPost = false;
let frame = 0, res = 160, colorMode = 0, showBlocks = false, quality = 'medium', generation = 0, loading = false;
let lastStatsWall = 0, lastStatsSim = 0, lastPost = 0, substepCap = 8;
let controls = { gravity: -9.81, speed: 1, wheelSpeed: 90, automaticWheel: true, touch: true, gravityEnabled: true, frameDt: 0.01 };
let sceneDef = null, originalMotion = null, lastWheelAngle = 0;
let recentLogs = [], readyResolve;
const post = (message, transfer = []) => self.postMessage(message, transfer);
const log = (line, level = 'info') => { recentLogs.push(line); recentLogs = recentLogs.slice(-8); post({ type: 'log', line, level }); };
const state = (finished = false) => post({ type: 'state', running, finished });
const channel = new MessageChannel();
channel.port1.onmessage = () => tick();
const schedule = () => channel.port2.postMessage(0);
let enginePromise;
async function ensureEngine() {
  if (engine && !broken) return engine;
  if (!enginePromise) enginePromise = MPMEngine.create(log).then(e => { engine = e; post({ type: 'ready', simd: e.simd }); return e; }).catch(e => { enginePromise = null; throw e; });
  return enginePromise;
}
function fail(error, requestId) {
  running = false; stepping = false; loading = false;
  if (error instanceof WebAssembly.RuntimeError) { broken = true; engine = null; enginePromise = null; }
  post({ type: 'error', message: error.message || String(error), requestId }); state();
}
function postFrame(partial = false, force = false) {
  if (!engine || !scene || broken || loading) return;
  if (awaitingAck && !force) { pendingPost = true; return; }
  try {
    const { data, count } = engine.exportParticles(colorMode);
    const rigids = engine.exportRigids(), blocks = showBlocks ? engine.exportBlocks() : null;
    const raw = engine.exportStats();
    const now = performance.now(), wall = (now - lastStatsWall) / 1000, subs = raw[15];
    const stats = {
      t: raw[0], frame, substeps: raw[1], particles: count, rigidParticles: raw[3], blocks: raw[4], fatBlocks: raw[5], rigidBlocks: raw[6], cutting: raw[7], dt: raw[9], rigids: raw[10], totalBlocks: raw[11], nearBoundary: raw[12], blockSize: raw[14],
      msPerSubstep: subs > 0 ? raw[16] / subs : 0, substepsPerSec: wall > 0 ? subs / wall : 0, simSpeed: wall > 0 ? (raw[0] - lastStatsSim) / wall : 0,
      prof: Array.from(raw.subarray(17, 28)).map(v => subs > 0 ? v / subs : 0), memoryMB: engine.memoryMB(),
    };
    lastStatsWall = now; lastStatsSim = raw[0]; lastPost = now;
    const transfers = [data.buffer, rigids.buffer]; if (blocks) transfers.push(blocks.buffer);
    post({ type: 'frame', particles: data, count, rigids, blocks, stats, partial }, transfers);
    awaitingAck = true; pendingPost = false;
  } catch (e) { fail(e); }
}
function tick() {
  if (!running || !engine || !scene || broken || loading) return;
  const start = performance.now();
  try {
    while (performance.now() - start < Math.min(24, 24 * controls.speed)) {
      if (!inFrame) {
        const t = engine.time();
        if (scene.duration > 0 && !controls.continuous && t >= scene.duration - 1e-6) {
          running = false; state(true); postFrame(false, true); return;
        }
        frameUpdate?.(t, controls.frameDt);
        engine.beginStep(controls.frameDt * controls.speed);
        inFrame = true;
      }
      if (engine.advance(substepCap)) {
        inFrame = false; frame++;
        postFrame(false);
        if (stepping) {
          running = false; stepping = false; state(); postFrame(false, true); return;
        }
      }
    }
    if (inFrame && performance.now() - lastPost > 200) postFrame(true);
  } catch (e) { fail(e); return; }
  schedule();
}

function attachLiveMotion(eng) {
  const originalRegister = eng.registerScript.bind(eng);
  runtime ||= { controls: {} };
  eng.registerScript = (fn) => {
    const initial = fn(0);
    const next = fn(0.01);
    const dynamic = (typeof initial === 'number' && typeof next === 'number' && Math.abs(next - initial) > 1e-6)
      || (Array.isArray(initial) && Array.isArray(next) && initial.some((v, i) => Math.abs(v - next[i]) > 1e-6));
    if (!dynamic) return originalRegister(fn);
    const id = 'wheel-' + Object.keys(runtime.controls).length;
    const values = Array.isArray(initial) ? initial : [initial];
    const n = Array.isArray(next) ? next : [next];
    const speed = values.reduce((best, v, i) => Math.abs(n[i] - v) > Math.abs(best) ? n[i] - v : best, 0) * 100;
    const motion = { angle: values, speed, enabled: true, lastTime: 0, originalSpeed: speed };
    runtime.controls[id] = motion; controls.wheelSpeed = speed;
    return originalRegister((t) => {
      if (motion.enabled) {
        for (let i = 0; i < values.length; i++) motion.angle[i] += (t - motion.lastTime) * (n[i] - values[i]) * 100 * (motion.speed / motion.originalSpeed);
      }
      motion.lastTime = t;
      return Array.isArray(initial) ? [...motion.angle] : motion.angle[0];
    });
  };
  return () => { eng.registerScript = originalRegister; };
}
async function load(msg) {
  const token = ++generation;
  running = false; stepping = false; inFrame = false; frame = 0; awaitingAck = false; loading = true; controls.continuous = false;
  if (msg.quality) quality = msg.quality;
  colorMode = msg.colorMode ?? colorMode; showBlocks = msg.showBlocks ?? showBlocks;
  try {
    const eng = await ensureEngine();
    if (token !== generation) return;
    sceneDef = typeof msg.scene === 'object' && msg.scene !== null ? clone(msg.scene) : null;
    const preset = sceneDef ? null : SCENES.find(s => s.id === (msg.scene || msg.sceneId));
    if (!sceneDef && !preset) throw new Error(`Unknown scene: ${msg.scene || msg.sceneId}`);
    if (sceneDef) validateScene(sceneDef);
    scene = sceneDef ? { id: sceneDef.id || 'custom', name: sceneDef.name || 'Custom scene', dim: sceneDef.dim, duration: sceneDef.duration ?? 0, frameDt: sceneDef.frameDt || 0.01, description: sceneDef.description, camera: sceneDef.camera, decor: sceneDef.decor || [] } : preset;
    eng.reset();
    recentLogs = []; runtime = null; mpm = null;
    controls = { ...controls, frameDt: scene.frameDt, wheelSpeed: sceneDef?.wheelSpeed ?? 90, automaticWheel: true, speed: 1, gravity: sceneDef?.gravity?.[1] ?? -9.81, gravityEnabled: true };
    const ctx = { engine: eng, tex: new TextureFactory(eng, scene.dim), quality };
    const t0 = performance.now();
    if (sceneDef) {
      const result = buildScene(sceneDef, ctx); mpm = result.mpm; runtime = result.runtime; frameUpdate = result.frameUpdate;
      // A JSON scene can attach emitters and live wheels without any source changes.
      for (const [id, motion] of Object.entries(runtime.controls)) if (motion.speed) controls.wheelSpeed = motion.speed;
    } else {
      runtime = { controls: {} };
      const restoreMotion = attachLiveMotion(eng);
      const result = preset.setup(ctx); mpm = result.mpm; frameUpdate = result.frameUpdate;
      restoreMotion();
    }
    res = mpm.config.res[0];
    const ls = eng.exportLevelset();
    const info = { sceneId: scene.id, name: scene.name, dim: scene.dim, res, frameDt: controls.frameDt, duration: scene.duration, camera: scene.camera, decor: scene.decor || [], levelset: ls.nx > 0 ? ls : null, custom: !!sceneDef, controls: { ...controls } };
    loading = false;
    log(`Scene "${scene.name}" initialized in ${Math.round(performance.now() - t0)} ms`, 'info');
    post({ type: 'loaded', info }, info.levelset ? [info.levelset.data.buffer] : []);
    lastStatsWall = performance.now(); lastStatsSim = 0;
    postFrame(false, true); state();
    post({ type: 'result', requestId: msg.requestId, result: { loaded: true, sceneId: scene.id } });
    if (msg.autoPlay && token === generation) { running = true; state(); schedule(); }
  } catch (e) { if (token === generation) fail(e, msg.requestId); }
}
function setMotion(patch) {
  const updated = { ...controls, ...patch };
  if (patch.gravity !== undefined && !Number.isFinite(patch.gravity)) throw new Error('Gravity must be a finite number.');
  if (patch.speed !== undefined && (patch.speed < 0.1 || patch.speed > 3)) throw new Error('Simulation speed must be 0.1–3×.');
  if (patch.wheelSpeed !== undefined && !Number.isFinite(patch.wheelSpeed)) throw new Error('Wheel speed must be finite.');
  controls = updated;
  if (runtime?.controls) for (const motion of Object.values(runtime.controls)) {
    if (patch.wheelSpeed !== undefined) motion.speed = patch.wheelSpeed;
    if (patch.automaticWheel !== undefined) motion.enabled = patch.automaticWheel;
  }
  if (engine && mpm && (patch.gravity !== undefined || patch.gravityEnabled !== undefined)) {
    mpm.general_action({ action: 'set_config', gravity: [0, controls.gravityEnabled ? controls.gravity : 0, 0].slice(0, scene.dim) });
  }
  if (engine && mpm && (patch.friction !== undefined)) mpm.general_action({ action: 'set_config', pushing_force: Math.max(0, Math.min(20000, patch.friction)) });
  post({ type: 'controls', controls: { ...controls } });
}
self.onmessage = async (ev) => {
  const msg = ev.data;
  try {
    switch (msg.type) {
      case 'load': await load(msg); break;
      case 'play':
        if (!scene || broken || loading) return;
        controls.continuous = true;
        if (!running) { running = true; lastStatsWall = performance.now(); lastStatsSim = engine.time(); state(); schedule(); }
        break;
      case 'pause': running = false; stepping = false; state(); break;
      case 'step':
        if (!scene || broken || running || loading) return;
        controls.continuous = true; stepping = true; running = true; state(); schedule(); break;
      case 'update': setMotion(msg.patch || {}); break;
      case 'colorMode': colorMode = Number(msg.mode) || 0; postFrame(false, true); break;
      case 'showBlocks': showBlocks = !!msg.value; postFrame(false, true); break;
      case 'add':
        if (!mpm || loading) throw new Error('Load a scene before adding particles.');
        await ensureEngine();
        const object = msg.object;
        if (!object || !object.type) throw new Error('An object needs a type.');
        addObject(mpm, new TextureFactory(engine, scene.dim), { ...object, type: object.type, material: object.material || 'water' }, runtime || { controls: {} }, quality);
        postFrame(false, true); break;
      case 'emit': {
        if (!mpm || loading) return;
        const position = msg.position || [0.5, 0.7, 0.5];
        const dim = scene.dim;
        const obj = { type: 'particles', material: msg.material || 'water', shape: 'sphere', center: position, radius: 0.025, density: 3, velocity: msg.velocity || (dim === 2 ? [0, 0.4] : [0, 0.4, 0]), color: msg.color || '#65bbef' };
        addObject(mpm, new TextureFactory(engine, dim), obj, runtime || { controls: {} }, quality); postFrame(false, true); break;
      }
      case 'ack': awaitingAck = false; if (pendingPost && !running) postFrame(false); break;
      case 'dispose': running = false; engine?.reset(); break;
    }
    if (msg.requestId && !['load'].includes(msg.type)) post({ type: 'result', requestId: msg.requestId, result: { ok: true } });
  } catch (e) { fail(e, msg.requestId); }
};
void ensureEngine().catch(fail);
