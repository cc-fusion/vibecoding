/* ===========================================================================
 *  standalone-app.js — vanilla JS front-end for the Navier–Stokes solver.
 *  Used by the generated single file "standalone.html" (core.js is inlined
 *  in front of this script, it publishes the global `NS`).
 * ========================================================================= */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var params = {
    N: 512,
    viscosity: 1.5e-4,
    cfl: 0.45,
    autoDt: true,
    dt: 0.02,
    bfecc: true,
    implicitDiffusion: false,
    confinement: 0.0,
    forceX: 0.0,
    forceY: 0.0,
    colorMode: 'vorticity',
    showDye: true,
    autoSteps: true,
    stepsPerFrame: 1,
    dyeAmount: 0.9,
    stirRadius: 0.03
  };

  var canvas = $('view');
  var ctx = canvas.getContext('2d');
  var engine = new NS.Engine({
    ctx: ctx,
    params: params,
    onStats: function (s) { stats = s; }
  });

  var stats = {};
  var running = false;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.parentNode.getBoundingClientRect();
    canvas.width = Math.max(320, Math.floor(r.width * dpr));
    canvas.height = Math.max(240, Math.floor(r.height * dpr));
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  /* ------------------------------------------------------------------ UI */
  function bind(id, key, transform, fmt) {
    var el = $(id);
    var out = $(id + '-val');
    function apply() {
      var raw = parseFloat(el.value);
      var v = transform ? transform(raw) : raw;
      params[key] = v;
      engine.setParams({});
      if (out) out.textContent = fmt ? fmt(v) : v;
    }
    el.addEventListener('input', apply);
    apply();
  }

  bind('viscosity', 'viscosity', function (r) { return Math.pow(10, -5 + r / 100 * 3); },
    function (v) { return v.toExponential(2); });
  bind('cfl', 'cfl', null, function (v) { return v.toFixed(2); });
  bind('confinement', 'confinement', null, function (v) { return v.toFixed(2); });
  bind('forceX', 'forceX', null, function (v) { return v.toFixed(2); });
  bind('forceY', 'forceY', null, function (v) { return v.toFixed(2); });
  bind('stirRadius', 'stirRadius', null, function (v) { return (v * 100).toFixed(1) + '%'; });

  $('resolution').addEventListener('change', function (e) {
    params.N = parseInt(e.target.value, 10);
    engine.setParams({ N: params.N });
  });
  $('colorMode').addEventListener('change', function (e) {
    params.colorMode = e.target.value;
    engine.setParams({});
  });
  $('bfecc').addEventListener('change', function (e) {
    params.bfecc = e.target.checked;
    engine.setParams({});
  });
  $('implicit').addEventListener('change', function (e) {
    params.implicitDiffusion = e.target.checked;
    engine.setParams({});
  });
  $('showDye').addEventListener('change', function (e) {
    params.showDye = e.target.checked;
    engine.setParams({});
  });
  $('autoDt').addEventListener('change', function (e) {
    params.autoDt = e.target.checked;
    engine.setParams({});
  });
  $('autoSteps').addEventListener('change', function (e) {
    params.autoSteps = e.target.checked;
    engine.setParams({});
  });
  $('steps').addEventListener('input', function (e) {
    params.stepsPerFrame = parseInt(e.target.value, 10);
    $('steps-val').textContent = params.stepsPerFrame;
    engine.setParams({});
  });

  $('play').addEventListener('click', function () {
    running = !running;
    if (running) engine.start(); else engine.stop();
    $('play').textContent = running ? 'Pause' : 'Run';
    $('play').classList.toggle('active', running);
  });
  $('step').addEventListener('click', function () {
    engine.stop(); running = false;
    $('play').textContent = 'Run';
    $('play').classList.remove('active');
    engine.stepOnce();
  });
  $('reset').addEventListener('click', function () { engine.reset(); });

  /* ------------------------------------------------------------- pointer */
  var last = null;
  function norm(e) {
    var r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width,
      y: 1 - (e.clientY - r.top) / r.height
    };
  }
  canvas.addEventListener('pointerdown', function (e) {
    canvas.setPointerCapture(e.pointerId);
    last = norm(e);
    engine.pointer(last.x, last.y, 0, 0, true);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!last) return;
    var p = norm(e);
    engine.pointer(p.x, p.y, p.x - last.x, p.y - last.y, true);
    last = p;
  });
  canvas.addEventListener('pointerup', function () { last = null; });
  canvas.addEventListener('pointerleave', function () { last = null; });

  /* --------------------------------------------------------------- stats */
  function fmt(v, d) {
    if (v === undefined || v === null || !isFinite(v)) return '—';
    return v.toFixed(d === undefined ? 2 : d);
  }
  setInterval(function () {
    $('s-fps').textContent = fmt(stats.fps, 1);
    $('s-step').textContent = fmt(stats.stepMs, 1) + ' ms';
    $('s-render').textContent = fmt(stats.renderMs, 1) + ' ms';
    $('s-div').textContent = stats.maxDiv !== undefined ? stats.maxDiv.toExponential(1) : '—';
    $('s-ke').textContent = stats.energy !== undefined ? stats.energy.toExponential(2) : '—';
    $('s-dt').textContent = stats.dt !== undefined ? stats.dt.toExponential(2) : '—';
    $('s-vmax').textContent = fmt(stats.vmax, 3);
    $('s-time').textContent = fmt(stats.simTime, 2) + ' s';
    $('s-steps').textContent = stats.steps || 0;
  }, 200);

  engine.start();
  running = true;
  $('play').textContent = 'Pause';
  $('play').classList.add('active');
})();
