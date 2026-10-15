import { FluidSolver } from "./solver.js";
const $ = (id) => document.getElementById(id);
const paths = {
  book: "M12 5v16M12 6C9 3 5 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 2",
  camera: "M3 7h5l2-3h4l2 3h5v14H3zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  pause: "M8 5v14M16 5v14",
  play: "m7 4 13 8-13 8z",
  sliders: "M3 6h18M3 12h18M3 18h18M8 3v6m8 0v6m-6 0v6",
  wrap: "M4 8h11a5 5 0 0 1 0 10H8m4-4-4 4 4 4M2 3h18M2 13h4",
  check: "m5 12 4 4L20 5",
  pointer: "m4 3 5 18 3-7 7-3z",
  drop: "M12 2s-7 9-7 13a7 7 0 0 0 14 0c0-4-7-13-7-13",
  swirl: "M12 12c-3-3 1-7 4-4s0 10-6 9-9-9-4-13 13-2 15 5-3 14-10 13",
  info: "M12 11v6m0-10v.1M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0",
  layers: "m3 7 9-5 9 5-9 5zM3 12l9 5 9-5M3 17l9 5 9-5",
  bolt: "m13 2-9 12h7l-1 8 10-13h-7z",
  reset: "M20 10a8 8 0 0 0-14-5L3 8m0-6v6h6M4 14a8 8 0 0 0 14 5l3-3m0 6v-6h-6",
  step: "m4 4 11 8-11 8zM20 4v16",
  expand: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5",
  mouse: "M8 3h8a3 3 0 0 1 3 3v11a7 7 0 0 1-14 0V6a3 3 0 0 1 3-3M12 3v6",
  close: "m6 6 12 12M6 18 18 6",
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] ?? paths.info}"/></svg>`;
document
  .querySelectorAll("[data-icon]")
  .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
let solver,
  running = true,
  dirty = true,
  singleStep = false,
  raf = 0,
  frameFence = null,
  expanded = false,
  stirOnly = false;
let toastTimer,
  lastStats = performance.now(),
  frames = 0,
  lastFps = 0,
  history = [];
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 4000);
}
function fail(error) {
  console.error(error);
  $("loading").hidden = true;
  $("error-panel").hidden = false;
  $("error-message").textContent = error.message;
  $("backend-status").textContent = "Renderer unavailable";
  running = false;
}
function updateRange(el) {
  const v =
    ((Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min))) *
    100;
  el.style.background = `linear-gradient(to right,var(--accent) ${v}%,#37464e ${v}%)`;
}
document.querySelectorAll("input[type=range]").forEach(updateRange);
function openGuide() {
  $("guide").showModal();
}
$("guide-btn").onclick = openGuide;
$("hint-btn").onclick = openGuide;
$("shortcuts-btn").onclick = openGuide;
$("close-guide").onclick = () => $("guide").close();
$("guide").addEventListener("click", (e) => {
  if (e.target === $("guide")) {
    const r = $("guide").getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      $("guide").close();
  }
});
document.querySelectorAll("[data-panel]").forEach(
  (b) =>
    (b.onclick = () => {
      document
        .querySelectorAll("[data-panel]")
        .forEach((t) => t.classList.toggle("active", b === t));
      $("simulation-panel").hidden = b.dataset.panel !== "simulation";
      $("appearance-panel").hidden = b.dataset.panel !== "appearance";
    }),
);
$("settings-btn").onclick = () =>
  document.querySelector(".sidebar").classList.toggle("open");
$("retry-btn").onclick = () => {
  const url = new URL(location.href);
  url.searchParams.set("size", "256");
  location.href = url.href;
};

function sizing() {
  const stage = $("stage"),
    mobile = innerWidth <= 720;
  const side = Math.max(
    40,
    Math.floor(
      Math.min(
        stage.clientWidth - (mobile ? 42 : 100),
        stage.clientHeight - (mobile ? 120 : 65),
      ),
    ),
  );
  $("canvas-shell").style.width = side + "px";
  $("canvas-shell").style.height = side + "px";
  const n = Math.round(side * Math.min(devicePixelRatio, 1.5));
  if ($("canvas").width !== n || $("canvas").height !== n) {
    $("canvas").width = n;
    $("canvas").height = n;
    dirty = true;
  }
}
new ResizeObserver(sizing).observe($("stage"));
function domainLabels() {
  const n = solver.config.size;
  $("cell-count").textContent = (n * n).toLocaleString() + " cells";
  $("stage-resolution").textContent = n + "²";
  $("memory-note").textContent =
    (solver.bytes / 1048576).toFixed(1) + " MiB of GPU textures";
  $("fft-status").textContent = 4 * Math.log2(n) + " butterfly passes / step";
}
function pause(value) {
  running = !value;
  $("run-btn").innerHTML =
    icon(value ? "play" : "pause") +
    `<span id="run-text">${value ? "Run simulation" : "Pause simulation"}</span>`;
  $("paused-badge").hidden = !value;
  $("live-text").textContent = value ? "PAUSED" : "LIVE";
  $("live-dot").style.background = value ? "#7c8b94" : "";
  dirty = true;
}
function reset() {
  if (!solver) return;
  solver.reset(Number($("preset").value));
  dirty = true;
  toast("Flow field reset");
}
$("run-btn").onclick = () => {
  if (solver) pause(running);
};
$("reset-btn").onclick = reset;
$("preset").onchange = reset;
$("step-btn").onclick = () => {
  if (solver) {
    pause(true);
    singleStep = true;
    dirty = true;
  }
};
$("expand-btn").onclick = () => {
  expanded = !expanded;
  $("stage").classList.toggle("expanded", expanded);
  sizing();
};
$("resolution").onchange = async () => {
  if (!solver) return;
  const n = Number($("resolution").value),
    old = solver.config.size;
  if (
    n === 2048 &&
    !confirm(
      "2048² allocates approximately 341 MiB of numerical textures, plus browser/GPU overhead. Continue?",
    )
  ) {
    $("resolution").value = String(old);
    return;
  }
  $("loading").hidden = false;
  $("resolution").disabled = true;
  // Allow the allocation notice to paint before synchronous GL resource creation.
  await new Promise((resolve) =>
    requestAnimationFrame(() => setTimeout(resolve, 0)),
  );
  try {
    solver.resize(n);
    domainLabels();
    dirty = true;
    toast(`Domain rebuilt at ${n} × ${n}`);
  } catch (error) {
    $("resolution").value = String(old);
    toast(error.message);
  } finally {
    $("loading").hidden = true;
    $("resolution").disabled = false;
  }
};
const sliders = {
  dt: { key: "dt", format: (v) => v.toFixed(4) + " s" },
  viscosity: {
    key: "viscosity",
    scale: 1e-6,
    format: (v) => (v === 0 ? "0" : v.toExponential(1)),
  },
  "density-decay": { key: "densityDecay", format: (v) => v.toFixed(2) + " /s" },
  "velocity-decay": {
    key: "velocityDecay",
    format: (v) => v.toFixed(2) + " /s",
  },
  radius: { key: "radius", format: (v) => (v * 100).toFixed(1) + "%" },
  force: { key: "force", format: (v) => v.toFixed(1) + "×" },
  "dye-amount": { key: "dyeAmount", format: (v) => v.toFixed(1) + " /s" },
  exposure: { key: "exposure", format: (v) => v.toFixed(2) + "×" },
};
for (const [id, def] of Object.entries(sliders))
  $(id).oninput = () => {
    const el = $(id),
      v = Number(el.value) * (def.scale ?? 1);
    if (solver) solver.config[def.key] = v;
    $(id + "-value").textContent = def.format(v);
    updateRange(el);
    dirty = true;
  };
$("bfecc").onchange = () => {
  if (solver) solver.config.bfecc = $("bfecc").checked;
  $("advection-mode").textContent = $("bfecc").checked ? "BFECC" : "SL";
  dirty = true;
  toast(
    $("bfecc").checked
      ? "BFECC enabled · forward, backward, correct, forward"
      : "Standard semi-Lagrangian advection",
  );
};
for (const id of ["grid", "vectors"])
  $(id).onchange = () => {
    if (solver) solver.config[id] = $(id).checked;
    dirty = true;
  };
$("palette").onchange = () => {
  if (solver) solver.config.palette = Number($("palette").value);
  $("palette-preview").style.background = [
    "linear-gradient(90deg,#0a0c0e,#3b0b07,#f45321,#ffdda1)",
    "linear-gradient(90deg,#0a0c0e,#103749,#35b4cc,#dcf5e5)",
    "linear-gradient(90deg,#0a0c0e,#535757,#d6dbd1)",
  ][$("palette").value];
  dirty = true;
};
document.querySelectorAll("[data-view]").forEach(
  (b) =>
    (b.onclick = () => {
      if (solver) solver.config.view = Number(b.dataset.view);
      document
        .querySelectorAll("[data-view]")
        .forEach((t) => t.classList.toggle("active", t === b));
      dirty = true;
    }),
);
function setTool(stir) {
  stirOnly = stir;
  $("stir-tool").classList.toggle("active", stir);
  $("ink-tool").classList.toggle("active", !stir);
  if (solver) solver.pointer.injectDye = !stir;
}
$("ink-tool").onclick = () => setTool(false);
$("stir-tool").onclick = () => setTool(true);
const canvas = $("canvas");
function point(event) {
  const r = canvas.getBoundingClientRect();
  return [
    Math.min(1, Math.max(0, (event.clientX - r.left) / r.width)),
    Math.min(1, Math.max(0, 1 - (event.clientY - r.top) / r.height)),
  ];
}
canvas.addEventListener("pointerdown", (e) => {
  if (!solver || !running) return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  const p = point(e),
    s = solver.pointer;
  s.point = p;
  s.previous = [...p];
  s.impulse = [0, 0];
  s.down = true;
  s.hover = true;
  s.injectDye = !stirOnly && e.button !== 2;
  dirty = true;
});
canvas.addEventListener("pointermove", (e) => {
  if (!solver) return;
  const p = point(e),
    s = solver.pointer;
  if (s.down) {
    s.impulse[0] += (p[0] - s.point[0]) * 4;
    s.impulse[1] += (p[1] - s.point[1]) * 4;
  }
  s.point = p;
  s.hover = true;
  dirty = true;
});
const release = (e) => {
  if (!solver) return;
  solver.pointer.down = false;
  solver.pointer.impulse = [0, 0];
  if (canvas.hasPointerCapture(e.pointerId))
    canvas.releasePointerCapture(e.pointerId);
  dirty = true;
};
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);
canvas.addEventListener("lostpointercapture", () => {
  if (solver) solver.pointer.down = false;
});
canvas.addEventListener("pointerleave", () => {
  if (solver) {
    solver.pointer.hover = false;
    dirty = true;
  }
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("blur", () => {
  if (solver) {
    solver.pointer.down = false;
    solver.pointer.impulse = [0, 0];
  }
});
canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  cancelAnimationFrame(raf);
  fail(
    new Error(
      "The GPU context was lost. Reload at a smaller resolution to reduce memory pressure.",
    ),
  );
});
$("snapshot-btn").onclick = () => {
  if (!solver) return;
  solver.render();
  canvas.toBlob((blob) => {
    if (!blob) {
      toast("Could not capture viewport.");
      return;
    }
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `flux-${solver.config.size}-${solver.steps}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Viewport saved as PNG");
  });
};
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (expanded) {
      expanded = false;
      $("stage").classList.remove("expanded");
      sizing();
    }
    document.querySelector(".sidebar").classList.remove("open");
    return;
  }
  if (
    /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) ||
    $("guide").open ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  )
    return;
  if (e.key === "?") {
    e.preventDefault();
    openGuide();
    return;
  }
  if (!solver) return;
  if (e.code === "Space") {
    e.preventDefault();
    pause(running);
  }
  if (e.key.toLowerCase() === "r") reset();
  if (e.key.toLowerCase() === "n") $("step-btn").click();
  if (e.key.toLowerCase() === "g") {
    $("grid").checked = !$("grid").checked;
    $("grid").onchange();
  }
});
function stats(now) {
  if (now - lastStats < 750) return;
  lastFps = Math.round((frames * 1000) / (now - lastStats));
  frames = 0;
  lastStats = now;
  $("fps").textContent = running ? lastFps : "—";
  $("gpu-time").textContent =
    solver.metrics.gpuMs === null ? "—" : solver.metrics.gpuMs.toFixed(1);
  $("gpu-time").title = solver.timerExt
    ? "Asynchronous GPU time for the numerical step, excluding display and diagnostics."
    : "GPU timer queries are unavailable on this browser.";
  $("divergence").textContent =
    solver.metrics.after === null ? "—" : solver.metrics.after.toExponential(1);
  $("divergence").title =
    solver.metrics.before === null
      ? "Waiting for GPU reduction"
      : `Before projection: ${solver.metrics.before.toExponential(3)}; after: ${solver.metrics.after.toExponential(3)} (domain units/s per unit length).`;
  $("sim-time").textContent = solver.time.toFixed(2);
  $("step-count").textContent = solver.steps.toLocaleString() + " steps";
  const dt = solver.effectiveDt ?? solver.config.dt,
    limited = dt < solver.config.dt - 1e-8;
  $("dt-status").textContent =
    `Δt ${dt.toFixed(5)} s${limited ? " · limited" : ""}`;
  $("stability-note").hidden = !limited;
  if (running) {
    history.push(lastFps);
    if (history.length > 45) history.shift();
  }
  const chart = $("fps-chart"),
    ctx = chart.getContext("2d");
  ctx.clearRect(0, 0, chart.width, chart.height);
  ctx.strokeStyle = "#b99078";
  ctx.lineWidth = 1;
  ctx.beginPath();
  history.forEach((v, i) => {
    const x = (i / 44) * chart.width,
      y = chart.height - 2 - Math.min(v / 70, 1) * (chart.height - 4);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
}
function frame(now) {
  raf = requestAnimationFrame(frame);
  if (!solver) return;
  // Keep only one GPU frame in flight. Never build an unbounded GPU command queue.
  const gl = solver.gl;
  if (frameFence) {
    const status = gl.clientWaitSync(frameFence, 0, 0);
    if (status === gl.TIMEOUT_EXPIRED) {
      stats(now);
      return;
    }
    gl.deleteSync(frameFence);
    frameFence = null;
  }
  solver.poll();
  if (running || singleStep || dirty) {
    if (running || singleStep) {
      solver.step(now);
      singleStep = false;
    }
    solver.render();
    dirty = false;
    frames++;
    frameFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
  }
  stats(now);
}
// Query override is useful for validation on software-rendered/headless browsers.
requestAnimationFrame(() =>
  setTimeout(() => {
    try {
      const requested = Number(
        new URLSearchParams(location.search).get("size"),
      );
      const size =
        Number.isInteger(requested) &&
        requested >= 16 &&
        requested <= 2048 &&
        !(requested & (requested - 1))
          ? requested
          : 1024;
      solver = new FluidSolver(canvas, { size });
      window.fluid = solver;
      if (!$("resolution").querySelector(`option[value="${size}"]`))
        $("resolution").add(
          new Option(`${size} × ${size} · validation`, String(size)),
        );
      $("resolution").value = String(size);
      domainLabels();
      sizing();
      $("loading").hidden = true;
      raf = requestAnimationFrame(frame);
    } catch (error) {
      fail(error);
    }
  }, 0),
);
window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(raf);
  if (frameFence && solver) solver.gl.deleteSync(frameFence);
  solver?.dispose();
});
