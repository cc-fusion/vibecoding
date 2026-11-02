import { MPMEngine, MPM, TextureFactory, SegmentMesh, TriangleMesh, LevelSet } from './engine.js';
import { SCENES } from './scenes.js';
import { buildScene, addObject, validateScene, clone } from './scene-builder.js';

export function createWorkerRuntime(transport) {
let engine, scene, mpm, runtime, frameUpdate, sceneMessage;
let running = false, stepping = false, inFrame = false, broken = false, awaitingAck = false, pendingPost = false;
let frame = 0, res = 160, colorMode = 0, showBlocks = false, quality = 'medium', generation = 0, loading = false;
let lastStatsWall = 0, lastStatsSim = 0, lastPost = 0, substepCap = 8;
let controls = { gravity: -9.81, speed: 1, wheelSpeed: 90, automaticWheel: true, touch: true, gravityEnabled: true, frameDt: 0.01 };
let sceneDef = null, originalMotion = null, lastWheelAngle = 0;
let recentLogs = [], readyResolve;
const post = (message, transfer = []) => transport.postMessage(message, transfer);
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
    while (performance.now() - start < (transport.isMainThread ? Math.min(7, 7 * controls.speed) : Math.min(24, 24 * controls.speed))) {
      if (!inFrame) {
        const t = engine.time();
        if (scene.duration > 0 && !controls.continuous && t >= scene.duration - 1e-6) {
          running = false; state(true); postFrame(false, true); return;
        }
        frameUpdate?.(t, controls.frameDt, { engine, mpm, controls: { ...controls }, addParticles: (cfg) => addObject(mpm, new TextureFactory(engine, scene.dim), { type: 'particles', material: 'water', ...cfg }, runtime || { controls: {} }, quality), addRigid: (cfg) => addObject(mpm, new TextureFactory(engine, scene.dim), { type: 'rigid', ...cfg }, runtime || { controls: {} }, quality), emitParticles: (position, velocity, material = 'water', color) => addObject(mpm, new TextureFactory(engine, scene.dim), { type: 'particles', material, shape: 'sphere', center: position, radius: 0.025, density: 3, velocity, color }, runtime || { controls: {} }, quality) });
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
    const requested = msg.scene;
    const scriptScene = requested && typeof requested === 'object' && ['module', 'inline'].includes(requested.kind);
    sceneDef = requested && typeof requested === 'object' && !scriptScene ? clone(requested) : null;
    const preset = sceneDef || scriptScene ? null : SCENES.find(s => s.id === (requested || msg.sceneId));
    if (!sceneDef && !scriptScene && !preset) throw new Error(`Unknown scene: ${requested || msg.sceneId}`);
    if (sceneDef) validateScene(sceneDef);
    let scriptModule = null;
    sceneMessage = null;
    if (scriptScene) {
      if (requested.kind === 'module') {
        if (!requested.url) throw new Error('A module scene needs a url.');
        scriptModule = await import(requested.url);
      } else {
        if (!requested.source || typeof requested.source !== 'string') throw new Error('An inline scene needs JavaScript source.');
        const blobURL = URL.createObjectURL(new Blob([requested.source], { type: 'text/javascript' }));
        try { scriptModule = await import(blobURL); } finally { URL.revokeObjectURL(blobURL); }
      }
    }
    const metadata = scriptScene ? (scriptModule.metadata || scriptModule.scene || requested.metadata || {}) : {};
    if (scriptScene) {
      sceneMessage = scriptModule.onMessage || scriptModule.default?.onMessage || null;
      if (sceneMessage !== null && typeof sceneMessage !== 'function') throw new Error('The scene onMessage export must be a function.');
    }
    scene = sceneDef ? { id: sceneDef.id || 'custom', name: sceneDef.name || 'Custom scene', dim: sceneDef.dim, duration: sceneDef.duration ?? 0, frameDt: sceneDef.frameDt || 0.01, description: sceneDef.description, camera: sceneDef.camera, decor: sceneDef.decor || [] }
      : scriptScene ? { id: metadata.id || 'javascript-scene', name: metadata.name || 'JavaScript scene', dim: metadata.dim, duration: metadata.duration ?? 0, frameDt: metadata.frameDt || 0.01, description: metadata.description || 'JavaScript-authored scene', camera: metadata.camera, decor: metadata.decor || [] }
      : preset;
    if (scriptScene && scene.dim !== 2 && scene.dim !== 3) throw new Error('JavaScript scene metadata.dim must be 2 or 3.');
    eng.reset();
    recentLogs = []; runtime = null; mpm = null;
    controls = { ...controls, frameDt: scene.frameDt, wheelSpeed: sceneDef?.wheelSpeed ?? 90, automaticWheel: true, speed: 1, gravity: sceneDef?.gravity?.[1] ?? -9.81, gravityEnabled: true };
    const ctx = { engine: eng, tex: new TextureFactory(eng, scene.dim), quality };
    const t0 = performance.now();
    if (sceneDef) {
      const result = buildScene(sceneDef, ctx); mpm = result.mpm; runtime = result.runtime; frameUpdate = result.frameUpdate;
      // A JSON scene can attach emitters and live wheels without any source changes.
      for (const [id, motion] of Object.entries(runtime.controls)) if (motion.speed) controls.wheelSpeed = motion.speed;
    } else if (scriptScene) {
      runtime = { controls: {}, emitters: {} };
      const restoreMotion = attachLiveMotion(eng);
      const scriptContext = {
        ...ctx, MPM, TextureFactory, SegmentMesh, TriangleMesh, LevelSet,
        createMPM(config = {}) {
          const resolution = config.resolution || (scene.dim === 2 ? 160 : 48);
          const defaults = { res: Array(scene.dim).fill(resolution), base_delta_t: (scene.dim === 2 ? 1.5e-4 : 3e-4) * (160 / resolution), penalty: 1000, pushing_force: 0, gravity: scene.dim === 2 ? [0, -9.81] : [0, -9.81, 0] };
          const { resolution: _resolution, ...rest } = config;
          return new MPM(eng, scene.dim, { ...defaults, ...rest });
        },
        addObject(targetMPM, object) { return addObject(targetMPM, new TextureFactory(eng, scene.dim), object, runtime, quality); },
        addParticles(targetMPM, config) { return targetMPM.add_particles(config); },
        createLevelSet(targetMPM) { return targetMPM.create_levelset(); },
      };
      const setup = scriptModule.setup || scriptModule.default?.setup;
      if (typeof setup !== 'function') throw new Error('JavaScript scenes must export setup(ctx).');
      const result = await setup(scriptContext);
      mpm = result?.mpm || result;
      if (!mpm || typeof mpm.add_particles !== 'function') throw new Error('setup(ctx) must return an object containing an MPM instance as { mpm }.');
      frameUpdate = result?.frameUpdate || result?.update || scriptModule.update || scriptModule.default?.update || null;
      if (frameUpdate != null && typeof frameUpdate !== 'function') throw new Error('The scene update export must be a function.');
      restoreMotion();
    } else {
      runtime = { controls: {} };
      const restoreMotion = attachLiveMotion(eng);
      const result = preset.setup(ctx); mpm = result.mpm; frameUpdate = result.frameUpdate;
      restoreMotion();
    }
    res = mpm.config.res[0];
    const ls = eng.exportLevelset();
    const info = { sceneId: scene.id, name: scene.name, dim: scene.dim, res, frameDt: controls.frameDt, duration: scene.duration, camera: scene.camera, decor: scene.decor || [], levelset: ls.nx > 0 ? ls : null, custom: !!(sceneDef || scriptScene), controls: { ...controls } };
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
transport.onmessage = async (ev) => {
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
        if (!mpm || loading) throw new Error('Load a scene before adding objects.');
        await ensureEngine();
        const object = msg.object;
        if (!object || !object.type) throw new Error('An object needs a type.');
        addObject(mpm, new TextureFactory(engine, scene.dim), { ...object, type: object.type, material: object.material || 'water' }, runtime || { controls: {} }, quality);
        postFrame(false, true); break;
      case 'articulation':
        if (!mpm || loading) throw new Error('Load a scene before adding an articulation.');
        mpm.add_articulation(msg.config || {});
        postFrame(false, true);
        break;
      case 'action':
        if (!mpm || loading) throw new Error('Load a scene before running a solver action.');
        { const result = mpm.general_action(msg.config || {}); post({ type: 'result', requestId: msg.requestId, result }); }
        break;
      case 'sceneMessage': {
        if (!scene || loading) throw new Error('Load a scene before sending it input.');
        if (sceneMessage) {
          const api = {
            engine, mpm, controls: { ...controls },
            addParticles: (cfg) => addObject(mpm, new TextureFactory(engine, scene.dim), { type: 'particles', material: 'water', ...cfg }, runtime || { controls: {} }, quality),
            addRigid: (cfg) => addObject(mpm, new TextureFactory(engine, scene.dim), { type: 'rigid', ...cfg }, runtime || { controls: {} }, quality),
            addWheel: (cfg) => addObject(mpm, new TextureFactory(engine, scene.dim), { type: 'rigid', shape: 'wheel', ...cfg }, runtime || { controls: {} }, quality),
            emitParticles: (position, velocity, material = 'water', color) => addObject(mpm, new TextureFactory(engine, scene.dim), { type: 'particles', material, shape: 'sphere', center: position, radius: 0.025, density: 3, velocity, color }, runtime || { controls: {} }, quality),
            generalAction: (config) => mpm.general_action(config),
            updateControls: (patch) => setMotion(patch),
          };
          await sceneMessage(msg.name, msg.payload, api);
          post({ type: 'result', requestId: msg.requestId, result: { ok: true } });
        } else {
          post({ type: 'result', requestId: msg.requestId, result: { ok: false, handled: false } });
        }
        break;
      }
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
    if (msg.requestId && !['load', 'action', 'sceneMessage'].includes(msg.type)) post({ type: 'result', requestId: msg.requestId, result: { ok: true } });
  } catch (e) { fail(e, msg.requestId); }
};
void ensureEngine().catch(fail);
return { dispose() { running = false; stepping = false; loading = false; engine?.reset(); channel.port1.close?.(); channel.port2.close?.(); transport.onmessage = null; } };
}

// The generated classic worker starts itself. The same runtime is imported by
// the main-thread fallback, where it is started explicitly instead.
if (typeof document === 'undefined' && typeof self !== 'undefined') createWorkerRuntime(self);
