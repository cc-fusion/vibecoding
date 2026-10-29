import { SCENES } from './scenes.js';
import { Renderer } from './renderer.js';

const COLOR_MODES = [
  { id: 0, label: 'Material colour' },
  { id: 1, label: 'Velocity' },
  { id: 2, label: 'CPIC side / affinity' },
  { id: 3, label: 'Constitutive model' },
  { id: 4, label: 'Plastic state (Jp, J)' },
];
const STAGES = [
  ['Sort + sparse grid', '#64748b'],
  ['Rigid collisions (MPR)', '#f472b6'],
  ['Articulations', '#c084fc'],
  ['Rasterize rigid (CPIC)', '#fb923c'],
  ['Gather CDF (CPIC)', '#facc15'],
  ['P2G (MLS-MPM)', '#38bdf8'],
  ['Grid update', '#2dd4bf'],
  ['Boundary conditions', '#a3e635'],
  ['G2P + plasticity', '#60a5fa'],
  ['Clean boundary', '#94a3b8'],
  ['Advect rigid bodies', '#f87171'],
];
const PORTED = [
  ['mpm.h / mpm.cpp', 'MPM<dim> driver: substep pipeline, particle sorting, page maps, boundary conditions, particle deletion, general actions'],
  ['transfer.cpp', 'MLS-MPM P2G/G2P with APIC affine momentum, RPIC/APIC damping, optimized non-rigid block path and CPIC path'],
  ['rigid_transfer.cpp', 'CPIC: rigid boundary rasterization (distance + affinity/side bits) and colored-distance-field reconstruction'],
  ['mpm_rigid_body.cpp', 'Rigid body creation from segment/triangle meshes, boundary particle sampling, advection, level-set collision'],
  ['particles.cpp', 'Snow, jelly, sand (Drucker–Prager), water, von Mises, elastic, linear and visco models with plasticity'],
  ['articulation.cpp', 'Rotation, frozen, distance, axial rotation, motor and stepper articulations'],
  ['rigid_body_solver.h', 'Rigid–rigid contact via a C++ port of libccd’s Minkowski Portal Refinement + impulse projection'],
  ['taichi (legacy)', 'Vectors/matrices, McAdams 3×3 SVD, polar decomposition, rotations, level sets, textures, config'],
  ['SPGrid → page maps', 'Block-sparse grid (8×8 / 4×4×4 blocks) with active, fat and rigid page maps and radix-sorted particles'],
  ['poisson_disk_sampler.h', 'Periodic Poisson-disk tiles, density textures and continuous PD sources (pd_source)'],
];

const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }) : '–');

// DOM refs
const els = {
  badgeReady: document.getElementById('badge-ready'),
  badgeSimd: document.getElementById('badge-simd'),
  canvas: document.getElementById('canvas'),
  canvasCard: document.getElementById('canvas-card'),
  overlayLoading: document.getElementById('overlay-loading'),
  overlayError: document.getElementById('overlay-error'),
  overlayGl: document.getElementById('overlay-glerror'),
  errorText: document.getElementById('error-text'),
  glErrorText: document.getElementById('glerror-text'),
  btnPlay: document.getElementById('btn-play'),
  btnStep: document.getElementById('btn-step'),
  btnReset: document.getElementById('btn-reset'),
  btnRetry: document.getElementById('btn-retry'),
  lblPlay: document.getElementById('lbl-play'),
  iconPlay: document.getElementById('icon-play'),
  iconPause: document.getElementById('icon-pause'),
  ctrlScene: document.getElementById('ctrl-scene'),
  ctrlFrame: document.getElementById('ctrl-frame'),
  ctrlTime: document.getElementById('ctrl-time'),
  progress: document.getElementById('progress-fill'),
  sceneName: document.getElementById('scene-name'),
  sceneOriginal: document.getElementById('scene-original'),
  sceneDesc: document.getElementById('scene-desc'),
  sceneFeatures: document.getElementById('scene-features'),
  grid2d: document.getElementById('grid-2d'),
  grid3d: document.getElementById('grid-3d'),
  selColor: document.getElementById('sel-color'),
  chkRigids: document.getElementById('chk-rigids'),
  chkBlocks: document.getElementById('chk-blocks'),
  rangeScale: document.getElementById('range-scale'),
  noteCpic: document.getElementById('note-cpic'),
  noteBlocks: document.getElementById('note-blocks'),
  profTotal: document.getElementById('prof-total'),
  profBar: document.getElementById('prof-bar'),
  profList: document.getElementById('prof-list'),
  stateGrid: document.getElementById('state-grid'),
  logBox: document.getElementById('log-box'),
  portedGrid: document.getElementById('ported-grid'),
};

// State
let ready = false;
let simd = null;
let sceneId = SCENES[0].id;
let quality = 'medium';
let info = null;
let running = false;
let finished = false;
let loading = true;
let colorMode = 0;
let showRigids = true;
let showBlocks = false;
let pointScale = 1;
let stats = null;
let logs = [];
let logId = 0;

const settings = { sceneId, quality, colorMode, showBlocks };
function syncSettings() {
  settings.sceneId = sceneId;
  settings.quality = quality;
  settings.colorMode = colorMode;
  settings.showBlocks = showBlocks;
}

const scene = () => SCENES.find(s => s.id === sceneId);

// Workers & renderer
let renderer = null;
let worker = null;
let autoLoaded = false;

// Helpers
function send(msg) {
  worker?.postMessage(msg);
}
function pushLog(line, level) {
  logs.push({ id: logId++, line, level });
  if (logs.length > 80) logs.shift();
  renderLogs();
}
function renderLogs() {
  if (logs.length === 0) {
    els.logBox.innerHTML = '<div class="log-empty">stderr of the WASM module appears here</div>';
    return;
  }
  els.logBox.innerHTML = logs.map(l => `<div class="log-line ${l.level}">${escapeHtml(l.line)}</div>`).join('');
  els.logBox.scrollTop = els.logBox.scrollHeight;
}
function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function load(id, q) {
  loading = true;
  finished = false;
  stats = null;
  syncSettings();
  updateOverlays();
  send({ type: 'load', sceneId: id, quality: q, colorMode, showBlocks });
}

function selectScene(id) {
  sceneId = id;
  syncSettings();
  updateSceneButtons();
  updateSceneInfo();
  if (ready) load(id, quality);
}
function selectQuality(q) {
  quality = q;
  syncSettings();
  updateQualityButtons();
  if (ready) load(sceneId, q);
}

function updateSceneButtons() {
  const renderGrid = (container, list) => {
    container.innerHTML = '';
    list.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'scene-btn' + (s.id === sceneId ? ' active' : '');
      btn.textContent = s.name;
      btn.addEventListener('click', () => selectScene(s.id));
      container.appendChild(btn);
    });
  };
  renderGrid(els.grid2d, SCENES.filter(s => s.dim === 2));
  renderGrid(els.grid3d, SCENES.filter(s => s.dim === 3));
}
function updateQualityButtons() {
  document.querySelectorAll('.q-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.q === quality);
  });
}
function updateSceneInfo() {
  const sc = scene();
  if (!sc) return;
  els.sceneName.textContent = sc.name;
  els.sceneOriginal.textContent = sc.original || '';
  els.sceneDesc.textContent = sc.description || '';
  els.sceneFeatures.innerHTML = '';
  (sc.features || []).forEach(f => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = f;
    els.sceneFeatures.appendChild(span);
  });
  els.ctrlScene.textContent = sc.name;
}

function updateOverlays() {
  if (els.overlayGl && !els.overlayGl.classList.contains('hidden')) return;
  if (loading) {
    els.overlayLoading.classList.remove('hidden');
    els.overlayError.classList.add('hidden');
  } else {
    els.overlayLoading.classList.add('hidden');
  }
  if (info && info.dim === 3) els.canvasCard.classList.add('canvas-3d');
  else els.canvasCard.classList.remove('canvas-3d');
}

function updateControls() {
  els.btnPlay.disabled = !info;
  els.btnStep.disabled = !info || running;
  els.btnReset.disabled = !ready;
  if (running) {
    els.lblPlay.textContent = 'Pause';
    els.btnPlay.classList.add('paused');
    els.iconPlay.style.display = 'none';
    els.iconPause.style.display = '';
  } else {
    els.lblPlay.textContent = finished ? 'Continue' : 'Play';
    els.btnPlay.classList.remove('paused');
    els.iconPlay.style.display = '';
    els.iconPause.style.display = 'none';
  }
  // pause state badge?
}

function updateBadges() {
  if (ready) {
    els.badgeReady.textContent = '● WASM ready';
    els.badgeReady.className = 'badge badge-ready';
  } else {
    els.badgeReady.textContent = '○ loading WASM…';
    els.badgeReady.className = 'badge badge-loading';
  }
  if (simd !== null) {
    els.badgeSimd.textContent = simd ? 'SIMD128 build' : 'scalar build';
    els.badgeSimd.classList.remove('hidden');
  }
}

function updateProgress() {
  const progress = info && stats ? Math.min(1, stats.t / info.duration) : 0;
  els.progress.style.width = `${progress * 100}%`;
  if (stats) {
    els.ctrlFrame.textContent = `frame ${stats.frame}`;
    els.ctrlTime.textContent = `· t=${stats.t.toFixed(2)} · ${fmt(stats.substeps)} substeps`;
  } else if (info) {
    els.ctrlFrame.textContent = 'frame 0';
    els.ctrlTime.textContent = '';
  }
}

function renderProfiler() {
  const total = stats ? stats.prof.reduce((a,b)=>a+b,0) : 0;
  els.profTotal.textContent = stats ? `${fmt(total,2)} ms / substep` : '– ms / substep';
  // bar
  els.profBar.innerHTML = '';
  if (stats) {
    STAGES.forEach(([name, col], i) => {
      const seg = document.createElement('div');
      seg.style.width = `${total > 0 ? (stats.prof[i]/total)*100 : 0}%`;
      seg.style.background = col;
      els.profBar.appendChild(seg);
    });
  }
  // list
  els.profList.innerHTML = '';
  STAGES.forEach(([name, col], i) => {
    const row = document.createElement('div');
    row.className = 'prof-item';
    row.innerHTML = `<span class="prof-item-left"><span class="prof-dot" style="background:${col}"></span>${name}</span><span class="prof-val">${stats ? fmt(stats.prof[i],3) : '–'}</span>`;
    els.profList.appendChild(row);
  });
}

function renderState() {
  const items = [
    ['Substeps', fmt(stats?.substeps ?? 0)],
    ['Rigid bodies', fmt(stats?.rigids ?? 0)],
    ['Active blocks', fmt(stats?.blocks ?? 0)],
    ['Fat blocks', fmt(stats?.fatBlocks ?? 0)],
    ['Rigid blocks', fmt(stats?.rigidBlocks ?? 0)],
    ['Total blocks', fmt(stats?.totalBlocks ?? 0)],
    ['Near boundary', fmt(stats?.nearBoundary ?? 0)],
    ['New affinities', fmt(stats?.cutting ?? 0)],
    ['WASM memory', `${fmt(stats?.memoryMB ?? 0)} MB`],
    ['Sim speed', stats ? `${fmt(stats.simSpeed,3)} s/s` : '–'],
  ];
  els.stateGrid.innerHTML = items.map(([k,v]) => `<div class="state-item"><span class="state-k">${k}</span><span class="state-v">${v}</span></div>`).join('');
}

function renderPorted() {
  els.portedGrid.innerHTML = PORTED.map(([file, desc]) => `
    <div class="ported-item">
      <div class="mono">${file}</div>
      <div>${desc}</div>
    </div>
  `).join('');
}

// Init UI
updateSceneButtons();
updateQualityButtons();
updateSceneInfo();
renderProfiler();
renderState();
renderPorted();
updateBadges();
updateOverlays();
updateControls();

// Event listeners
els.selColor.addEventListener('change', (e) => {
  colorMode = Number(e.target.value);
  syncSettings();
  const showCpic = colorMode === 2;
  els.noteCpic.classList.toggle('hidden', !showCpic);
  send({ type: 'colorMode', mode: colorMode });
});
els.chkRigids.addEventListener('change', (e) => {
  showRigids = e.target.checked;
  if (renderer) {
    renderer.options.showRigids = showRigids;
    renderer.requestRender();
  }
});
els.chkBlocks.addEventListener('change', (e) => {
  showBlocks = e.target.checked;
  syncSettings();
  els.noteBlocks.classList.toggle('hidden', !showBlocks);
  if (renderer) {
    renderer.options.showBlocks = showBlocks;
    renderer.requestRender();
  }
  send({ type: 'showBlocks', value: showBlocks });
});
els.rangeScale.addEventListener('input', (e) => {
  pointScale = Number(e.target.value);
  if (renderer) {
    renderer.options.pointScale = pointScale;
    renderer.requestRender();
  }
});
document.querySelectorAll('.q-btn').forEach(btn => {
  btn.addEventListener('click', () => selectQuality(btn.dataset.q));
});
els.btnPlay.addEventListener('click', () => {
  if (!info) return;
  if (running) send({ type: 'pause' });
  else send({ type: 'play' });
});
els.btnStep.addEventListener('click', () => send({ type: 'step' }));
els.btnReset.addEventListener('click', () => load(sceneId, quality));
els.btnRetry.addEventListener('click', () => load(sceneId, quality));

// Renderer init
try {
  renderer = new Renderer(els.canvas);
} catch (e) {
  els.overlayGl.classList.remove('hidden');
  els.overlayLoading.classList.add('hidden');
  els.glErrorText.textContent = e.message;
}

// Worker init
worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
worker.onmessage = (ev) => {
  const msg = ev.data;
  switch (msg.type) {
    case 'ready':
      ready = true;
      simd = msg.simd;
      updateBadges();
      updateControls();
      pushLog(`WebAssembly module ready (${msg.simd ? 'SIMD128' : 'scalar'} build)`, 'info');
      if (autoLoaded || !renderer) break;
      autoLoaded = true;
      send({ type: 'load', sceneId: settings.sceneId, quality: settings.quality, colorMode: settings.colorMode, showBlocks: settings.showBlocks });
      break;
    case 'loaded': {
      const def = SCENES.find(s => s.id === msg.info.sceneId);
      info = msg.info;
      loading = false;
      renderer?.setScene(msg.info, def?.camera, def?.decor || []);
      send({ type: 'play' });
      updateOverlays();
      updateControls();
      updateProgress();
      break;
    }
    case 'frame':
      renderer?.setFrame(msg.particles, msg.count, msg.rigids, msg.blocks, msg.stats.blockSize);
      stats = msg.stats;
      renderProfiler();
      renderState();
      updateProgress();
      requestAnimationFrame(() => send({ type: 'ack' }));
      break;
    case 'state':
      running = msg.running;
      if (msg.finished) finished = true;
      updateControls();
      break;
    case 'log':
      pushLog(msg.line, msg.level);
      break;
    case 'error':
      loading = false;
      els.overlayError.classList.remove('hidden');
      els.overlayLoading.classList.add('hidden');
      els.errorText.textContent = msg.message;
      pushLog(msg.message, 'error');
      updateControls();
      break;
  }
};

// keep renderer options in sync
// initial options
if (renderer) {
  renderer.options = { showRigids, showBlocks, pointScale };
}

// handle visibility: show notes initially
els.noteCpic.classList.toggle('hidden', colorMode !== 2);
els.noteBlocks.classList.toggle('hidden', !showBlocks);
