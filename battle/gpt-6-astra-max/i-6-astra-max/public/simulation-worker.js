import createMPM from "./wasm/taichi-mpm.mjs";

let engine;
let playing = false;
let timer;
let speed = 1;
let frameNumber = 0;
let settings;
let lastDuration = 0;
let loaded = false;
let generation = 0;
let bootError;

function reportError(error) {
  self.postMessage({
    type: "error",
    message: error.message || String(error),
    fatal: !engine || error instanceof WebAssembly.RuntimeError,
  });
}

function assertSuccess(result) {
  if (!result)
    throw new Error(
      engine.UTF8ToString(engine._mpm_error()) ||
        "The solver could not complete this operation.",
    );
}

function sendFrame() {
  const count = engine._mpm_count();
  const pointer = engine._mpm_data() / 4;
  // Copy after the call: memory growth invalidates previously cached WASM views.
  const particles = engine.HEAPF32.slice(pointer, pointer + count * 8);
  self.postMessage(
    {
      type: "frame",
      particles,
      count,
      frame: frameNumber,
      time: engine._mpm_time(),
      substeps: engine._mpm_substeps(),
      blocks: engine._mpm_grid_blocks(),
      memory: engine.HEAPU8.byteLength / 1048576,
      duration: lastDuration / 12,
      generation,
    },
    [particles.buffer],
  );
}

function tick() {
  if (!playing || !loaded) return;
  try {
    const start = performance.now();
    assertSuccess(engine._mpm_step(12));
    lastDuration = performance.now() - start;
    frameNumber += 1;
    sendFrame();
    // Throttle slow motion even when compute-bound; faster rates are best-effort.
    timer = setTimeout(
      tick,
      Math.max(0, Math.max(32, lastDuration) / speed - lastDuration),
    );
  } catch (error) {
    playing = false;
    reportError(error);
  }
}

const ready = createMPM({
  locateFile: (path) => new URL("./wasm/" + path, import.meta.url).href,
  print: () => {},
  printErr: (text) => console.warn("[Taichi WASM]", text),
})
  .then((module) => {
    engine = module;
    self.postMessage({ type: "ready" });
  })
  .catch((error) => {
    bootError = error;
    reportError(error);
  });

self.onmessage = async ({ data }) => {
  try {
    await ready;
    if (bootError) throw bootError;
    if (data.type === "init") {
      clearTimeout(timer);
      playing = false;
      loaded = false;
      settings = data.settings;
      generation = data.generation;
      frameNumber = 0;
      lastDuration = 0;
      const s = settings;
      assertSuccess(
        engine._mpm_init(
          s.dimension,
          s.scene,
          s.material,
          s.resolution,
          s.count,
          s.gravity,
          s.stiffness,
          s.friction,
          s.dt,
        ),
      );
      loaded = true;
      sendFrame();
      self.postMessage({ type: "initialized", generation });
      playing = data.play;
      if (playing) timer = setTimeout(tick, 60);
    } else if (data.type === "play") {
      clearTimeout(timer);
      playing = data.value;
      if (playing) tick();
    } else if (data.type === "step") {
      clearTimeout(timer);
      playing = false;
      const start = performance.now();
      assertSuccess(engine._mpm_step(12));
      lastDuration = performance.now() - start;
      frameNumber++;
      sendFrame();
    } else if (data.type === "speed") {
      speed = Math.max(0.25, Math.min(2, data.value));
    } else if (data.type === "impulse" && loaded) {
      engine._mpm_impulse(...data.position, 0.2, 1.5);
      sendFrame();
    } else if (data.type === "gravity") {
      engine._mpm_gravity(data.value);
    } else if (data.type === "export" && loaded) {
      assertSuccess(engine._mpm_save());
      const bytes = engine.FS.readFile("/snapshot.tcb");
      self.postMessage(
        { type: "snapshot", bytes, settings, time: engine._mpm_time() },
        [bytes.buffer],
      );
    }
  } catch (error) {
    playing = false;
    reportError(error);
  }
};
