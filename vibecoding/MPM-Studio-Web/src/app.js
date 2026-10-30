import * as TaichiMPM from './lib/index.js';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const DEFAULT_JSON = {
  id: 'my-first-scene', name: 'My first scene', description: 'A small material showcase.', dim: 2,
  resolution: 160, duration: 0, frameDt: 0.01, gravity: [0, -9.81],
  boundaries: { floor: true, walls: true, friction: 0.4 },
  objects: [
    { id: 'jelly', type: 'particles', material: 'jelly', shape: 'rect', center: [0.32, 0.61], size: [0.17, 0.2], color: '#e68ccf', density: 4 },
    { id: 'water', type: 'particles', material: 'water', shape: 'sphere', center: [0.69, 0.53], radius: 0.11, color: '#57b8f5', density: 4 },
    { id: 'wheel', type: 'rigid', shape: 'wheel', center: [0.5, 0.25], radius: 0.14, blades: 8, color: '#e9b870', motion: { speed: 90, enabled: true } },
    { id: 'snow', type: 'particles', material: 'snow', shape: 'rect', center: [0.5, 0.82], size: [0.15, 0.13], color: '#e3edf9', density: 4 }
  ]
};
const INLINE_TEMPLATE = `export const metadata = {
  id: 'inline-experiment',
  name: 'Inline experiment',
  dim: 2,
  duration: 0,
  frameDt: 0.01
};

export function setup(ctx) {
  const mpm = ctx.createMPM({ resolution: 144, gravity: [0, -9.81] });
  const walls = mpm.create_levelset();
  walls.add_plane([0, 1], -0.06)
    .add_plane([1, 0], -0.06)
    .add_plane([-1, 0], 0.94)
    .set_friction(0.35);
  mpm.set_levelset(walls);

  const water = ctx.tex.sphere([0.5, 0.7, 0.5], 0.12).mul(4);
  mpm.add_particles({
    type: 'water', density: 1000, density_tex: water,
    color: [0.3, 0.62, 0.95]
  });
  return {
    mpm,
    update(t, dt, api) {
      // Add a droplet when the simulation reaches each second.
      if (Math.abs((t % 1) - dt) < dt * 0.6) {
        api.addParticles({ material: 'water', shape: 'sphere', center: [0.5, 0.88], radius: 0.025, density: 2 });
      }
    }
  };
}`;

const sceneIcons = ['◉', '◌', '◈', '◍', '◇', '▦', '◒', '◫', '◉', '⬡'];
let sim = null;
let currentSceneId = 'cutting';
let currentTab = 'json';
let scenes = [];
let frameRateAt = performance.now();
let frameCount = 0;
let interactionMode = 'touch';

function log(message, level = 'info') {
  const line = document.createElement('div');
  line.className = `log-line ${level}`;
  line.textContent = `${new Date().toLocaleTimeString()}  ${message}`;
  $('#logOutput').prepend(line);
  while ($('#logOutput').children.length > 60) $('#logOutput').lastElementChild.remove();
}
function setStatus(text, kind = 'ok') {
  $('#engineStatus').textContent = text;
  const dot = $('.sidebar-footer .live-dot');
  dot.style.background = kind === 'error' ? '#f28e9c' : kind === 'warn' ? '#f2c778' : 'var(--green)';
}
function updateButtons(enabled) {
  ['#playButton', '#stepButton', '#resetButton', '#snapshotButton'].forEach(id => { $(id).disabled = !enabled; });
}
function setPlayState(running) {
  $('#playButton').textContent = running ? 'Ⅱ Pause' : '▶ Play';
  $('#viewportState').textContent = running ? 'RUNNING' : 'PAUSED';
}
function showSceneInfo(info) {
  $('#currentSceneName').textContent = info.name || 'Custom scene';
  $('#sceneDimension').textContent = `${info.dim}D`;
  $('#canvasEmpty').classList.add('hidden');
  $('#viewportState').textContent = 'READY';
  updateButtons(true);
  setStatus('Engine ready');
  $('#jsonStatus').textContent = info.custom ? 'Custom scene loaded' : `Preset · ${info.sceneId}`;
}
function renderSceneList(filter = '') {
  const host = $('#sceneList');
  host.replaceChildren();
  const list = scenes.filter(scene => `${scene.name} ${scene.description || ''} ${scene.dim}`.toLowerCase().includes(filter.toLowerCase()));
  list.forEach((scene, index) => {
    const button = document.createElement('button');
    button.className = `scene-card ${scene.id === currentSceneId ? 'active' : ''}`;
    button.innerHTML = `<span class="scene-glyph">${sceneIcons[index % sceneIcons.length]}</span><span><strong>${escapeHTML(scene.name)}</strong><small>${scene.dim}D · ${escapeHTML((scene.description || '').slice(0, 70))}</small></span>`;
    button.addEventListener('click', async () => {
      if (!sim) return;
      try {
        currentSceneId = scene.id;
        renderSceneList($('#sceneSearch').value);
        $('#canvasEmpty').classList.remove('hidden');
        $('#canvasEmpty').textContent = `Loading ${scene.name}…`;
        await sim.loadScene(scene.id, { autoPlay: false, quality: $('#qualitySelect').value });
        setPlayState(false);
        log(`Loaded preset: ${scene.name}`);
      } catch (error) { showError(error); }
    });
    host.append(button);
  });
  if (!list.length) host.innerHTML = '<div class="log-line muted" style="padding:10px">No matching scenes.</div>';
}
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
function showError(error) {
  const message = error?.message || String(error);
  log(message, 'error');
  setStatus('Engine error', 'error');
  $('#canvasEmpty').textContent = message;
  $('#canvasEmpty').classList.remove('hidden');
}
function switchTab(tab) {
  currentTab = tab;
  $$('.tab').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
  $$('.editor-pane').forEach(pane => pane.classList.toggle('active', pane.id === `${tab}Pane`));
}
async function runJSON() {
  const definition = JSON.parse($('#jsonEditor').value);
  await sim.loadScene(definition, { autoPlay: false, quality: $('#qualitySelect').value });
  currentSceneId = definition.id || 'custom';
  renderSceneList($('#sceneSearch').value);
  log(`Applied JSON scene: ${definition.name || definition.id || 'Custom scene'}`);
  setPlayState(false);
}
async function runModule() {
  const url = $('#moduleURL').value.trim();
  if (!url) throw new Error('Enter a JavaScript module URL.');
  await sim.loadSceneModule(url, { autoPlay: false, quality: $('#qualitySelect').value });
  currentSceneId = 'javascript-module';
  renderSceneList($('#sceneSearch').value);
  log(`Loaded JavaScript module: ${url}`);
  setPlayState(false);
}
async function runInline() {
  const source = $('#inlineEditor').value;
  await sim.loadInlineScene(source, {}, { autoPlay: false, quality: $('#qualitySelect').value });
  currentSceneId = 'inline-script';
  renderSceneList($('#sceneSearch').value);
  log('Executed trusted inline JavaScript module (Blob import; no eval).', 'warn');
  setPlayState(false);
}
function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function init() {
  if (!TaichiMPM.create) throw new Error('TaichiMPM library did not load.');
  scenes = TaichiMPM.getScenes();
  renderSceneList();
  $('#jsonEditor').value = JSON.stringify(DEFAULT_JSON, null, 2);
  $('#inlineEditor').value = INLINE_TEMPLATE;
  updateButtons(false);
  sim = await TaichiMPM.create({ canvas: $('#simCanvas'), scene: 'cutting', quality: 'medium', autoPlay: false, renderOptions: { grid: true, showRigids: true, showBlocks: false, pointScale: 1 } });
  sim.on('ready', info => { log(`WebAssembly engine ready (${info.simd ? 'SIMD128' : 'scalar'})`); });
  sim.on('loaded', info => {
    showSceneInfo(info);
    currentSceneId = info.sceneId || currentSceneId;
    renderSceneList($('#sceneSearch').value);
    if (!info.custom && info.sceneId === 'my-first-scene') $('#jsonEditor').value = JSON.stringify(DEFAULT_JSON, null, 2);
  });
  sim.on('stats', stats => {
    $('#particleCount').textContent = Number(stats.particles || 0).toLocaleString();
    $('#simTime').textContent = `${Number(stats.t || 0).toFixed(3)}s`;
    $('#substeps').textContent = Number(stats.substeps || 0).toLocaleString();
    frameCount++;
    const now = performance.now();
    if (now - frameRateAt >= 1000) {
      $('#fps').textContent = `${Math.round(frameCount * 1000 / (now - frameRateAt))} fps`;
      frameRateAt = now; frameCount = 0;
    }
  });
  sim.on('state', state => setPlayState(state.running));
  sim.on('log', item => log(item.line, item.level));
  sim.on('fallback', info => {
    $('#executionMode').textContent = 'MAIN THREAD';
    log(`Worker unavailable; using main-thread fallback. ${info.reason}`, 'warn');
    setStatus('Main-thread fallback', 'warn');
  });
  sim.on('error', showError);
  sim.on('interact', event => {
    // Demo: the default engine interaction injects the selected material.
    // Applications can replace this with custom pointer-driven commands.
    if (event.position) $('#interactionHint').textContent = `World position: ${event.position.map(v => v.toFixed(2)).join(', ')} · pointer interaction is live.`;
  });
  sim.on('pointerdown', () => $('#simCanvas').focus());
  sim.on('keydown', event => {
    if (event.key === ' ') { event.originalEvent.preventDefault(); sim.running ? sim.pause() : sim.play(); }
  });
  $('#executionMode').textContent = sim.executionMode.toUpperCase();
}

$('#playButton').addEventListener('click', () => { if (!sim) return; sim.running ? sim.pause() : sim.play(); });
$('#stepButton').addEventListener('click', () => sim?.step());
$('#resetButton').addEventListener('click', async () => { try { await sim.reset({ autoPlay: false }); setPlayState(false); log('Simulation reset.'); } catch (e) { showError(e); } });
$('#snapshotButton').addEventListener('click', () => sim?.snapshot());
$('#qualitySelect').addEventListener('change', async () => { if (sim?.info) { try { await sim.reset({ autoPlay: false, quality: $('#qualitySelect').value }); } catch (e) { showError(e); } } });
$('#gravity').addEventListener('input', event => { const value = Number(event.target.value); $('#gravityValue').textContent = value.toFixed(2).replace('-', '−'); sim?.update({ gravity: value }); });
$('#speed').addEventListener('input', event => { const value = Number(event.target.value); $('#speedValue').textContent = `${value.toFixed(2)}×`; sim?.update({ speed: value }); });
$('#materialSelect').addEventListener('change', event => { if (sim) sim.options.material = event.target.value; });
$('#touchMode').addEventListener('click', () => { interactionMode = 'touch'; sim?.setInteraction({ mode: 'touch', enabled: true }); $('#touchMode').classList.add('active'); $('#orbitMode').classList.remove('active'); $('#interactionHint').textContent = 'Tap or drag in the viewport to inject material. Use Orbit to move the 3D camera.'; });
$('#orbitMode').addEventListener('click', () => { interactionMode = 'orbit'; sim?.setInteraction({ mode: 'orbit', enabled: true }); $('#orbitMode').classList.add('active'); $('#touchMode').classList.remove('active'); $('#interactionHint').textContent = 'Orbit mode: drag to rotate the 3D camera. Double-click to reset the camera.'; });
$('#gridToggle').addEventListener('click', event => { const active = event.currentTarget.classList.toggle('active'); sim?.setOptions({ grid: active }); });
$('#sceneSearch').addEventListener('input', event => renderSceneList(event.target.value));
$$('.tab').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
$('#applyJSON').addEventListener('click', async () => { try { await runJSON(); } catch (e) { showError(e); $('#jsonStatus').textContent = e.message; } });
$('#loadModule').addEventListener('click', async () => { try { await runModule(); } catch (e) { showError(e); } });
$('#runInline').addEventListener('click', async () => { try { await runInline(); } catch (e) { showError(e); } });
$('#newScene').addEventListener('click', () => { switchTab('json'); currentSceneId = 'custom'; $('#jsonEditor').value = JSON.stringify({ ...DEFAULT_JSON, id: 'new-scene', name: 'New scene', objects: [] }, null, 2); $('#jsonStatus').textContent = 'Unsaved scene'; });
$('#importButton').addEventListener('click', () => $('#fileInput').click());
$('#fileInput').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  const text = await file.text();
  if (file.name.endsWith('.json')) { switchTab('json'); $('#jsonEditor').value = text; $('#jsonStatus').textContent = `Imported ${file.name}`; }
  else { switchTab('inline'); $('#inlineEditor').value = text; log(`Imported ${file.name} as trusted inline code.`, 'warn'); }
  event.target.value = '';
});
$('#exportButton').addEventListener('click', () => {
  try { const scene = JSON.parse($('#jsonEditor').value); download(`${scene.id || 'scene'}.json`, JSON.stringify(scene, null, 2), 'application/json'); }
  catch (error) { showError(new Error(`Export is available for valid JSON scenes: ${error.message}`)); }
});

init().catch(showError);
