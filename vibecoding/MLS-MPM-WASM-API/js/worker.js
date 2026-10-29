/*
 * Simulation worker: owns the WebAssembly instance of the taichi_mpm full
 * solver, executes scene scripts and streams particle / rigid-body data to the
 * main thread. Substeps are time-sliced so control messages stay responsive.
 */
import { MPMEngine, TextureFactory } from './engine.js';
import { SCENES } from './scenes.js';

const ctx = self;
const post = (msg, transfer = []) => ctx.postMessage(msg, transfer);

let engine = null;
let broken = false;
let scene = null;
let frameUpdate;
let running = false;
let stepping = false;
let inFrame = false;
let frame = 0;
let colorMode = 0;
let showBlocks = false;
let awaitingAck = false;
let pendingPost = false;
let ignoreDuration = false;
let lastPost = 0;
let lastStatsWall = performance.now();
let lastStatsSim = 0;
let recentLogs = [];
let res = 0;

const log = (line, level) => {
  recentLogs.push(line);
  if (recentLogs.length > 8) recentLogs.shift();
  post({ type: 'log', line, level });
};

async function ensureEngine() {
  if (!engine || broken) {
    engine = await MPMEngine.create(log);
    broken = false;
    post({ type: 'ready', simd: engine.simd });
  }
  return engine;
}

function fail(e) {
  running = false;
  stepping = false;
  const trap = e instanceof WebAssembly.RuntimeError;
  if (trap) broken = true;
  const detail = recentLogs.filter((l) => /error|assert|fail/i.test(l)).slice(-2).join(' | ');
  post({ type: 'error', message: `${trap ? 'WebAssembly trap' : 'Error'}: ${e?.message ?? e}${detail ? ' — ' + detail : ''}` });
  post({ type: 'state', running: false, finished: false });
}

function postFrame(partial, force = false) {
  if (!engine || broken) return;
  if (awaitingAck && !force) {
    pendingPost = true;
    return;
  }
  const { data, count } = engine.exportParticles(colorMode);
  const rigids = engine.exportRigids();
  const blocks = showBlocks ? engine.exportBlocks() : null;
  const s = engine.exportStats();
  const now = performance.now();
  const wall = (now - lastStatsWall) / 1000;
  const simAdvance = s[0] - lastStatsSim;
  const subs = s[15];
  const stats = {
    t: s[0],
    frame,
    substeps: s[1],
    particles: s[2],
    rigidParticles: s[3],
    blocks: s[4],
    fatBlocks: s[5],
    rigidBlocks: s[6],
    cutting: s[7],
    dt: s[9],
    rigids: s[10],
    totalBlocks: s[11],
    nearBoundary: s[12],
    blockSize: s[14],
    msPerSubstep: subs > 0 ? s[16] / subs : 0,
    substepsPerSec: wall > 0 ? subs / wall : 0,
    simSpeed: wall > 0 ? simAdvance / wall : 0,
    prof: Array.from(s.subarray(17, 28)).map((v) => (subs > 0 ? v / subs : 0)),
    memoryMB: engine.memoryMB(),
  };
  lastStatsWall = now;
  lastStatsSim = s[0];
  lastPost = now;
  const transfer = [data.buffer, rigids.buffer];
  if (blocks) transfer.push(blocks.buffer);
  post({ type: 'frame', particles: data, count, rigids, blocks, stats, partial }, transfer);
  awaitingAck = true;
  pendingPost = false;
}

const channel = new MessageChannel();
channel.port1.onmessage = () => tick();
const schedule = () => channel.port2.postMessage(0);

function tick() {
  if (!running || !engine || !scene || broken) return;
  const start = performance.now();
  try {
    while (performance.now() - start < 28) {
      if (!inFrame) {
        const t = engine.time();
        if (!ignoreDuration && t >= scene.duration - 1e-6) {
          running = false;
          post({ type: 'state', running: false, finished: true });
          postFrame(false, true);
          return;
        }
        if (frameUpdate) frameUpdate(t, scene.frameDt);
        engine.beginStep(scene.frameDt);
        inFrame = true;
      }
      if (engine.advance(1)) {
        inFrame = false;
        frame++;
        postFrame(false);
        if (stepping) {
          stepping = false;
          running = false;
          post({ type: 'state', running: false, finished: false });
          postFrame(false, true);
          return;
        }
      }
    }
    if (inFrame && performance.now() - lastPost > 200) postFrame(true);
  } catch (e) {
    fail(e);
    return;
  }
  schedule();
}

async function load(msg) {
  running = false;
  stepping = false;
  inFrame = false;
  frame = 0;
  ignoreDuration = false;
  awaitingAck = false;
  colorMode = msg.colorMode;
  showBlocks = msg.showBlocks;
  try {
    const eng = await ensureEngine();
    const def = SCENES.find((s) => s.id === msg.sceneId);
    if (!def) throw new Error(`unknown scene ${msg.sceneId}`);
    scene = def;
    eng.reset();
    recentLogs = [];
    const t0 = performance.now();
    const { mpm, frameUpdate: fu } = def.setup({ engine: eng, tex: new TextureFactory(eng, def.dim), quality: msg.quality });
    frameUpdate = fu;
    res = Number(mpm.config.res[0]);
    log(`Scene "${def.name}" (${def.dim}D, res ${res}) initialised in ${(performance.now() - t0).toFixed(0)} ms`, 'info');
    const ls = eng.exportLevelset();
    const info = { sceneId: def.id, dim: def.dim, res, frameDt: def.frameDt, duration: def.duration, levelset: ls.nx > 0 ? ls : null };
    post({ type: 'loaded', info }, info.levelset ? [info.levelset.data.buffer] : []);
    eng.exportStats();
    lastStatsWall = performance.now();
    lastStatsSim = 0;
    postFrame(false, true);
    post({ type: 'state', running: false, finished: false });
  } catch (e) {
    fail(e);
  }
}

ctx.onmessage = (ev) => {
  const msg = ev.data;
  switch (msg.type) {
    case 'load':
      load(msg);
      break;
    case 'play':
      if (!scene || broken) return;
      if (engine && engine.time() >= scene.duration - 1e-6) ignoreDuration = true;
      if (!running) {
        running = true;
        lastStatsWall = performance.now();
        engine?.exportStats();
        lastStatsSim = engine?.time() ?? 0;
        post({ type: 'state', running: true, finished: false });
        schedule();
      }
      break;
    case 'pause':
      running = false;
      stepping = false;
      post({ type: 'state', running: false, finished: false });
      break;
    case 'step':
      if (!scene || broken || running) return;
      ignoreDuration = true;
      stepping = true;
      running = true;
      post({ type: 'state', running: true, finished: false });
      schedule();
      break;
    case 'colorMode':
      colorMode = msg.mode;
      if (!running) postFrame(false, true);
      break;
    case 'showBlocks':
      showBlocks = msg.value;
      if (!running) postFrame(false, true);
      break;
    case 'ack':
      awaitingAck = false;
      if (pendingPost && !running) postFrame(false);
      break;
  }
};

ensureEngine().catch(fail);
