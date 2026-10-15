import { VoxelEngine, VoxelWorld, THREE } from "../engine/engine.js";
import {
  createScene,
  createWater,
  disposeGroup,
  PALETTE,
  MATERIALS,
} from "./scenes.js";
import { icon, hydrateIcons } from "./icons.js";
const $ = (id) => document.getElementById(id);
hydrateIcons();
let engine,
  water,
  ground,
  waterSpec = { tiles: [], level: 2.05 },
  toastTimer,
  sceneKind = "island",
  logCount = 0,
  loadStart = 0,
  expanded = false;
let loaded = false,
  frameAfterLoad = false;
const history = [];
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 3000);
}
function log(text, level = "info") {
  const row = document.createElement("div");
  row.className = "log-row";
  const time = document.createElement("span");
  time.className = "log-time";
  time.textContent = new Date().toLocaleTimeString("en-GB");
  const tag = document.createElement("span");
  tag.className = `log-level ${level}`;
  tag.textContent = level;
  const message = document.createElement("span");
  message.className = "log-text";
  message.textContent = text;
  row.append(time, tag, message);
  $("console-content").append(row);
  while ($("console-content").children.length > 100)
    $("console-content").firstChild.remove();
  $("log-count").textContent = ++logCount;
  const body = document.querySelector(".console-body");
  body.scrollTop = body.scrollHeight;
}
function download(name, content, type = "application/json") {
  const blob = new Blob([content], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function loading(value) {
  $("loading").hidden = !value;
  $("status-text").textContent = value
    ? "Building scene geometry…"
    : "All systems ready";
  $("regenerate-btn").disabled = value;
}
function setTab(tab) {
  document
    .querySelectorAll(".console-tab")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  for (const t of ["console", "performance", "code"])
    $(t + "-content").hidden = t !== tab;
  $("console-panel").classList.remove("collapsed");
}
function openDocs() {
  $("docs-dialog").showModal();
}
$("docs-btn").onclick = openDocs;
$("quickstart-btn").onclick = openDocs;
$("shortcuts-btn").onclick = openDocs;
$("close-docs").onclick = () => $("docs-dialog").close();
$("docs-dialog").addEventListener("click", (e) => {
  if (e.target === $("docs-dialog")) {
    const r = $("docs-dialog").getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      $("docs-dialog").close();
  }
});
document
  .querySelectorAll(".console-tab")
  .forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
$("collapse-console").onclick = () =>
  $("console-panel").classList.toggle("collapsed");
$("clear-console").onclick = () => {
  $("console-content").replaceChildren();
  logCount = 0;
  $("log-count").textContent = "0";
};
for (const [name, color] of MATERIALS) {
  const b = document.createElement("button");
  b.className = "material";
  b.title = `${name} · ${color}`;
  b.innerHTML = `<span class="material-swatch" style="background:${color}"></span><span>${name}</span>`;
  b.onclick = () => {
    toast(`${name} · ${color} — edit the palette with engine.setPalette()`);
    log(
      `Material: ${name} (${color}). Palette colors are shared across all chunks.`,
    );
  };
  $("materials").append(b);
}
try {
  engine = new VoxelEngine($("viewport"), { palette: PALETTE });
  // Exposed for DevTools; the library itself is independent of this UI.
  window.engine = engine;
  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1500, 1500),
    new THREE.MeshStandardMaterial({ color: "#e3e9e3", roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -9;
  ground.receiveShadow = true;
  ground.name = "Workbench ground";
  engine.scene.add(ground);
  $("worker-count").textContent = `${engine.workers.length} threads`;
  $("worker-status").innerHTML =
    `<span class="tiny-dot"></span> ${engine.workers.length ? "Worker pool active" : "Main-thread fallback"}`;
  log("Voxel Core initialized · WebGL 2 · Three.js r" + THREE.REVISION);
  log(
    `Meshing pool ready · ${engine.workers.length} workers · 16³ chunks · face culling enabled`,
  );
  engine.on("error", (msg) => {
    log(msg, "error");
    toast(msg);
    loading(false);
  });
  engine.on("warning", (msg) => log(msg, "warn"));
  engine.on("ready", () => {
    loading(false);
    loaded = true;
    $("chunk-label").textContent = `${engine.meshes.size} render chunks`;
    if (frameAfterLoad) {
      engine.frameWorld();
      frameAfterLoad = false;
    }
    for (const m of engine.meshes.values())
      m.frustumCulled = $("culling").checked;
    log(
      `${$("scene-title").textContent} ready · ${engine.meshes.size} chunks · ${engine.world.voxelCount.toLocaleString()} voxels · ${((performance.now() - loadStart) / 1000).toFixed(2)}s`,
    );
  });
  engine.on("stats", (s) => {
    $("fps-overlay").textContent = s.fps;
    $("stat-voxels").textContent = s.voxels.toLocaleString();
    $("stat-chunks").textContent = `${s.visibleChunks} / ${s.chunks}`;
    $("stat-draws").textContent = s.drawCalls;
    $("stat-triangles").textContent = s.triangles.toLocaleString();
    $("perf-fps").innerHTML = `${s.fps} <em>fps</em>`;
    $("perf-reduction").textContent =
      (s.faces ? 100 * (1 - s.quads / s.faces) : 0).toFixed(1) + "%";
    $("perf-memory").innerHTML =
      `${(s.bufferBytes / 1048576).toFixed(2)} <em>MB</em>`;
    $("perf-mesh").innerHTML = `${s.meshMs.toFixed(1)} <em>ms</em>`;
    history.push(s.fps);
    if (history.length > 60) history.shift();
    const c = $("fps-chart"),
      ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#87a36c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((v, i) => {
      const x = (i / 59) * c.width,
        y = c.height - Math.min(v / 90, 1) * c.height;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    if (s.pending)
      $("chunk-label").textContent = `${s.chunks} chunks · ${s.pending} queued`;
    if (!s.pending && loaded)
      $("chunk-label").textContent = `${s.chunks} render chunks`;
  });
  generate();
} catch (error) {
  $("fatal-error").hidden = false;
  $("fatal-error").textContent =
    "Could not initialize WebGL 2. Enable hardware acceleration or use a WebGL 2-capable browser. " +
    error.message;
  $("loading").hidden = true;
  $("status-text").textContent = "Renderer unavailable";
  log(error.message, "error");
}
function generate() {
  if (!engine) return;
  if (engine.paused) pause(false);
  loading(true);
  loaded = false;
  loadStart = performance.now();
  sceneKind = $("scene-preset").value;
  const seed = $("seed-input").value.trim() || "evergreen";
  $("seed-input").value = seed;
  const names = {
    island: ["Evergreen valley", "A small world. A capable foundation.", "01"],
    pavilion: [
      "The quiet pavilion",
      "Simple geometry. Room for possibility.",
      "02",
    ],
    benchmark: ["Geometry study", "Fewer faces. More possibilities.", "03"],
  };
  const [name, subtitle, number] = names[sceneKind];
  $("scene-title").textContent = name;
  $("scene-subtitle").textContent = subtitle;
  $("scene-number").textContent = number;
  log(`Generating ${name.toLowerCase()} · seed “${seed}”`);
  requestAnimationFrame(() =>
    setTimeout(() => {
      try {
        const built = createScene(sceneKind, seed);
        if (water) disposeGroup(water);
        water = built.water;
        waterSpec = built.waterSpec;
        engine.scene.add(water);
        engine.setWorld(built.world);
        engine.controls.target.set(0, 5, 0);
        engine.camera.position.set(86, 65, 90);
        engine.controls.update();
        resetVisibility();
      } catch (error) {
        log(error.message, "error");
        loading(false);
        toast("Scene generation failed.");
      }
    }, 0),
  );
}
function objectFor(id) {
  return {
    terrain: engine.root,
    water,
    sun: engine.sun,
    ambient: engine.ambient,
    grid: engine.grid,
  }[id];
}
function resetVisibility() {
  for (const id of ["terrain", "water", "sun", "ambient", "grid"]) {
    const el = objectFor(id);
    if (el) el.visible = true;
  }
  document
    .querySelectorAll(".visibility")
    .forEach((b) => b.classList.remove("off"));
  $("grid-btn").classList.add("active");
}
function select(id) {
  document
    .querySelectorAll(".tree-row")
    .forEach((r) => r.classList.toggle("selected", r.dataset.object === id));
  const data = {
    terrain: ["Voxel terrain", "VoxelWorld · procedural", "cube"],
    water: ["Water surface", "Mesh · transparent surface", "waves"],
    sun: ["Directional light", "DirectionalLight · shadow caster", "sun"],
    ambient: ["Environment", "HemisphereLight · ambient fill", "globe"],
    grid: ["Reference grid", "GridHelper · 5-unit spacing", "grid"],
  }[id];
  $("selection-name").textContent = data[0];
  $("selection-type").textContent = data[1];
  $("selection-icon").innerHTML = icon(data[2]);
}
function toggleVisibility(id) {
  const o = objectFor(id);
  if (!o) return;
  o.visible = !o.visible;
  document
    .querySelector(`[data-object="${id}"] .visibility`)
    .classList.toggle("off", !o.visible);
  if (id === "grid") $("grid-btn").classList.toggle("active", o.visible);
  engine.render();
}
document.querySelectorAll(".tree-row").forEach((row) => {
  row.querySelector(".tree-select").onclick = () => select(row.dataset.object);
  row.querySelector(".visibility").onclick = () =>
    toggleVisibility(row.dataset.object);
});
$("scene-search").oninput = (e) => {
  const q = e.target.value.toLowerCase();
  document
    .querySelectorAll(".tree-row")
    .forEach(
      (row) => (row.hidden = !row.textContent.toLowerCase().includes(q)),
    );
  document.querySelector(".tree-detail").hidden = !!q;
};
$("regenerate-btn").onclick = generate;
$("scene-preset").onchange = generate;
$("random-seed").onclick = () => {
  $("seed-input").value = crypto
    .getRandomValues(new Uint32Array(1))[0]
    .toString(36);
  generate();
};
$("seed-input").onkeydown = (e) => {
  if (e.key === "Enter") generate();
};
function wireframe(value) {
  engine.material.wireframe = value;
  $("wire-btn").classList.toggle("active", value);
  $("shaded-btn").classList.toggle("active", !value);
  engine.render();
}
$("wire-btn").onclick = () => wireframe(true);
$("shaded-btn").onclick = () => wireframe(false);
$("grid-btn").onclick = () => toggleVisibility("grid");
$("frame-btn").onclick = () => {
  engine.frameWorld();
  toast("Camera framed to scene");
};
$("rotate-btn").onclick = () => {
  engine.controls.autoRotate = !engine.controls.autoRotate;
  $("rotate-btn").classList.toggle("active", engine.controls.autoRotate);
};
function tool(pan) {
  engine.controls.mouseButtons.LEFT = pan
    ? THREE.MOUSE.PAN
    : THREE.MOUSE.ROTATE;
  $("pan-btn").classList.toggle("active", pan);
  $("orbit-btn").classList.toggle("active", !pan);
  $("viewport").style.cursor = pan ? "grab" : "";
}
$("pan-btn").onclick = () => tool(true);
$("orbit-btn").onclick = () => tool(false);
function view(kind) {
  const t = engine.controls.target,
    dist = engine.camera.position.distanceTo(t);
  const v =
    kind === "top"
      ? new THREE.Vector3(0.001, 1, 0.001)
      : kind === "front"
        ? new THREE.Vector3(1, 0.1, 0)
        : new THREE.Vector3(1, 0.75, 1);
  engine.camera.position.copy(t).add(v.normalize().multiplyScalar(dist));
  engine.controls.update();
  engine.render();
  $("view-btn").innerHTML =
    `${kind === "top" ? "Top" : kind === "front" ? "Front" : "Perspective"} ${icon("chevron-down")}`;
}
document
  .querySelectorAll("[data-view]")
  .forEach((b) => (b.onclick = () => view(b.dataset.view)));
let viewIndex = 0;
$("view-btn").onclick = () => view(["top", "front", "iso"][viewIndex++ % 3]);
function expand(value) {
  expanded = value;
  $("viewport-area").classList.toggle("expanded", value);
  $("fullscreen-btn").setAttribute(
    "aria-label",
    value ? "Restore viewport" : "Expand viewport",
  );
  engine.resize();
}
$("fullscreen-btn").onclick = () => expand(!expanded);
function pause(value) {
  engine.setPaused(value);
  $("pause-btn").innerHTML = icon(value ? "play" : "pause");
  $("pause-btn").title = value ? "Resume render loop" : "Pause render loop";
  $("pause-btn").setAttribute("aria-label", $("pause-btn").title);
  $("runtime-label").textContent = value ? "Engine paused" : "Engine running";
  $("runtime-dot").style.background = value ? "#c0a265" : "";
  $("live-state").textContent = value ? "PAUSED" : "LIVE";
  if (value) $("fps-overlay").textContent = "—";
  log(
    value
      ? "Render loop paused. Camera controls remain available."
      : "Render loop resumed.",
  );
}
$("pause-btn").onclick = () => pause(!engine.paused);
$("render-scale").onchange = () => {
  engine.renderer.setPixelRatio(
    Math.min(devicePixelRatio, Number($("render-scale").value)),
  );
  engine.resize();
  log(`Pixel ratio cap set to ${$("render-scale").value}×`);
};
$("shadows").onchange = () => {
  engine.renderer.shadowMap.enabled = $("shadows").checked;
  engine.scene.traverse((o) => {
    if (o.material) o.material.needsUpdate = true;
  });
  engine.render();
};
for (const key of ["ao", "greedy"])
  $(key).onchange = () => {
    if (engine.paused) pause(false);
    loadStart = performance.now();
    loading(true);
    engine.setMeshing({ [key]: $(key).checked });
    log(
      `${key === "ao" ? "Ambient occlusion" : "Greedy meshing"} ${$(key).checked ? "enabled" : "disabled"} · rebuilding dirty chunks`,
    );
  };
$("fog").onchange = () => {
  engine.scene.fog = $("fog").checked
    ? new THREE.Fog("#e8eeeb", 160, 350)
    : null;
  engine.render();
};
$("exposure").oninput = () => {
  engine.renderer.toneMappingExposure = Number($("exposure").value);
  $("exposure-value").textContent = Number($("exposure").value).toFixed(2);
  engine.render();
};
$("culling").onchange = () => {
  for (const m of engine.meshes.values())
    m.frustumCulled = $("culling").checked;
  engine.render();
  log(`Chunk frustum culling ${$("culling").checked ? "enabled" : "disabled"}`);
};
$("screenshot-btn").onclick = () => {
  engine.render();
  engine.renderer.domElement.toBlob((blob) => {
    if (!blob) return;
    download("voxel-core-viewport.png", blob, "image/png");
    toast("Viewport PNG saved");
  });
};
$("export-btn").onclick = () => {
  const json = engine.world.toJSON();
  Object.assign(json, {
    palette: engine.palette,
    camera: {
      position: engine.camera.position.toArray(),
      target: engine.controls.target.toArray(),
    },
    demo: { kind: sceneKind, seed: $("seed-input").value, water: waterSpec },
    settings: {
      ...engine.options,
      shadows: $("shadows").checked,
      fog: $("fog").checked,
      culling: $("culling").checked,
      exposure: Number($("exposure").value),
      wireframe: engine.material.wireframe,
    },
    visibility: Object.fromEntries(
      ["terrain", "water", "sun", "ambient", "grid"].map((id) => [
        id,
        objectFor(id)?.visible ?? true,
      ]),
    ),
  });
  download("voxel-core-scene.json", JSON.stringify(json));
  toast("Scene exported as JSON");
  log(
    "Exported scene · voxel chunks, palette, environment, camera, and renderer settings",
  );
};
$("import-btn").onclick = () => $("import-file").click();
$("import-file").onchange = async () => {
  const file = $("import-file").files[0];
  if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024)
      throw new Error("Maximum scene file size is 20 MB.");
    const json = JSON.parse(await file.text()),
      world = VoxelWorld.fromJSON(json);
    const palette = json.palette || PALETTE;
    if (
      !Array.isArray(palette) ||
      palette.length > 256 ||
      !palette.every((c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c))
    )
      throw new Error("Invalid palette.");
    const spec = json.demo?.water || { tiles: [], level: 2.05 };
    if (
      !Array.isArray(spec.tiles) ||
      spec.tiles.length > 20000 ||
      !Number.isFinite(spec.level) ||
      Math.abs(spec.level) > 1000000 ||
      !spec.tiles.every(
        (t) =>
          Array.isArray(t) &&
          t.length === 2 &&
          t.every((v) => Number.isFinite(v) && Math.abs(v) <= 1000000),
      )
    )
      throw new Error("Invalid water geometry.");
    const vector = (v) =>
      Array.isArray(v) &&
      v.length === 3 &&
      v.every((n) => Number.isFinite(n) && Math.abs(n) <= 1000000);
    if (
      json.camera &&
      (!vector(json.camera.position) || !vector(json.camera.target))
    )
      throw new Error("Invalid camera.");
    if (engine.paused) pause(false);
    loading(true);
    loadStart = performance.now();
    loaded = false;
    engine.setPalette(palette);
    engine.setWorld(world);
    if (water) disposeGroup(water);
    waterSpec = spec;
    water = createWater(spec.tiles, spec.level);
    engine.scene.add(water);
    resetVisibility();
    for (const key of ["ao", "greedy", "shadows", "fog", "culling"])
      if (typeof json.settings?.[key] === "boolean") {
        $(key).checked = json.settings[key];
        $(key).onchange();
      }
    if (Number.isFinite(json.settings?.exposure)) {
      $("exposure").value = Math.max(
        0.4,
        Math.min(2.5, json.settings.exposure),
      );
      $("exposure").oninput();
    }
    wireframe(!!json.settings?.wireframe);
    for (const id of ["terrain", "water", "sun", "ambient", "grid"])
      if (json.visibility?.[id] === false) toggleVisibility(id);
    if (json.camera) {
      engine.camera.position.fromArray(json.camera.position);
      engine.controls.target.fromArray(json.camera.target);
      engine.controls.update();
    } else frameAfterLoad = true;
    $("scene-title").textContent = "Imported scene";
    $("scene-subtitle").textContent = file.name;
    $("scene-number").textContent = "—";
    if (["island", "pavilion", "benchmark"].includes(json.demo?.kind)) {
      sceneKind = json.demo.kind;
      $("scene-preset").value = sceneKind;
    }
    if (typeof json.demo?.seed === "string")
      $("seed-input").value = json.demo.seed.slice(0, 64);
    log(`Imported ${file.name} · ${world.chunks.size} data chunks`);
    toast("Scene imported");
    if (!world.chunks.size) {
      loading(false);
      loaded = true;
    }
  } catch (error) {
    log(error.message, "error");
    toast("Import rejected: " + error.message);
  } finally {
    $("import-file").value = "";
  }
};
$("viewport").addEventListener("dblclick", (e) => {
  const r = $("viewport").getBoundingClientRect(),
    hit = engine.pick(e.clientX - r.left, e.clientY - r.top);
  if (hit) {
    select("terrain");
    toast(`Voxel [${hit.position.join(", ")}] · palette ID ${hit.id}`);
    log(
      `Raycast hit [${hit.position.join(", ")}], normal [${hit.normal.join(", ")}], material ${hit.id}`,
    );
  }
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && expanded) {
    expand(false);
    return;
  }
  if (
    /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) ||
    $("docs-dialog").open ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  )
    return;
  const k = e.key.toLowerCase();
  if (k === "?") {
    e.preventDefault();
    openDocs();
    return;
  }
  if (!engine) return;
  if (k === "f") $("frame-btn").click();
  if (k === "g") $("grid-btn").click();
  if (k === "w") wireframe(!engine.material.wireframe);
  if (k === " ") {
    e.preventDefault();
    pause(!engine.paused);
  }
});
window.addEventListener("beforeunload", () => engine?.dispose());
