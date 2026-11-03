import {
  MPMEngine,
  MPM as Solver,
  TextureFactory,
  SegmentMesh,
  TriangleMesh,
  Texture,
  LevelSet,
} from "./core/engine.js";
import { SCENES } from "./core/scenes.js";
import { Renderer } from "./render/renderer.js";

export const version = "1.0.0";
export const scenes = SCENES;
export {
  MPMEngine,
  Solver,
  TextureFactory,
  SegmentMesh,
  TriangleMesh,
  Texture,
  LevelSet,
  Renderer,
};

const materials = {
  sand: { density: 1600, friction_angle: 38, cohesion: 0, color: "#edbc72" },
  water: { density: 1000, color: "#7abde3" },
  jelly: { density: 600, E: 7000, nu: 0.3, color: "#b19de2" },
  snow: { density: 400, youngs_modulus: 10000, hardening: 8, color: "#e8e9df" },
  elastic: { density: 600, E: 10000, nu: 0.3, color: "#a5c78c" },
  von_mises: {
    density: 600,
    youngs_modulus: 10000,
    yield_stress: 150,
    color: "#e8998c",
  },
};
export const materialTypes = Object.keys(materials);

function finite(value, label, min = -Infinity, max = Infinity) {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new TypeError(
      `${label} must be a finite number between ${min} and ${max}.`,
    );
  return value;
}

function vector(value, size, label) {
  if (
    !Array.isArray(value) ||
    value.length !== size ||
    !value.every(Number.isFinite)
  )
    throw new TypeError(`${label} must contain ${size} finite numbers.`);
  return [...value];
}

function color(value) {
  if (Array.isArray(value))
    return vector(value, 3, "color").map((x) => Math.max(0, Math.min(1, x)));
  if (typeof value !== "string" || !/^#([\da-f]{3}|[\da-f]{6})$/i.test(value))
    throw new TypeError(
      "color must be a hex color or an RGB array in the range 0..1.",
    );
  const hex =
    value.length === 4
      ? value
          .slice(1)
          .split("")
          .map((x) => x + x)
          .join("")
      : value.slice(1);
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

/** Scene descriptions are ordinary objects. Functions stay in the calling page, never eval'd. */
export function createScene(options = {}) {
  const dim = options.dim ?? 2;
  if (dim !== 2 && dim !== 3) throw new TypeError("dim must be 2 or 3.");
  const resolution = Math.round(
    finite(
      options.resolution ?? (dim === 3 ? 40 : 128),
      "resolution",
      32,
      dim === 3 ? 96 : 512,
    ),
  );
  const world = vector(
    options.world ?? (dim === 3 ? [1, 1, 1] : [1, 1]),
    dim,
    "world",
  );
  if (world.some((n) => n <= 0 || n > 4) || world[0] !== 1)
    throw new TypeError(
      "world must have positive lengths up to 4, with an x length of 1.",
    );
  const frameDt = finite(options.frameDt ?? 1 / 120, "frameDt", 1e-5, 0.1);
  if (!Array.isArray(options.particles ?? []))
    throw new TypeError("particles must be an array of material descriptions.");
  return {
    id: "custom",
    name: "Custom scene",
    ...options,
    dim,
    resolution,
    world,
    frameDt,
    kind: "declarative",
    gravity: vector(
      options.gravity ?? (dim === 3 ? [0, -5, 0] : [0, -5]),
      dim,
      "gravity",
    ),
    particles: options.particles ?? [],
  };
}

export function demoScene(material = "sand", resolution = 144) {
  if (!materials[material])
    throw new TypeError(`Unknown material: ${material}`);
  const base = { material, particlesPerCell: 2.8 };
  let particles;
  if (material === "sand") {
    particles = [
      {
        ...base,
        shape: "polygon",
        points: [
          [0.08, 0.068],
          [0.61, 0.068],
          [0.32, 0.365],
        ],
        color: "#efbc72",
      },
      {
        ...base,
        shape: "polygon",
        points: [
          [0.4, 0.068],
          [0.88, 0.068],
          [0.66, 0.29],
        ],
        color: "#d88d4e",
      },
      {
        ...base,
        shape: "polygon",
        points: [
          [0.68, 0.068],
          [0.94, 0.068],
          [0.83, 0.21],
        ],
        color: "#f5d7a1",
      },
    ];
  } else if (material === "water") {
    particles = [
      {
        ...base,
        shape: "rect",
        center: [0.3, 0.19],
        size: [0.4, 0.24],
        color: "#77b9d6",
      },
      {
        ...base,
        shape: "circle",
        center: [0.71, 0.32],
        radius: 0.09,
        color: "#a4dbe4",
      },
    ];
  } else {
    particles = [0.24, 0.5, 0.76].map((x, i) => ({
      ...base,
      shape: i === 1 ? "circle" : "rect",
      center: [x, 0.2 + i * 0.055],
      radius: 0.09,
      size: [0.17, 0.17],
      color:
        material === "snow"
          ? ["#e7e8df", "#c7d2cf", "#f1f0e5"][i]
          : ["#bca5e0", "#9981c3", "#d4c3ef"][i],
    }));
  }
  return createScene({
    id: material,
    name: `${material[0].toUpperCase()}${material.slice(1)} playground`,
    resolution,
    world: [1, 0.5],
    gravity: [0, -2.4],
    particles,
    render: {
      bounds: [0, 0.025, 1, 0.46],
      hideLevelset: true,
      showDomain: false,
      grid: true,
      pointScale: 1.15,
    },
  });
}

export class Simulation {
  constructor(canvas, engine, options) {
    this.canvas = canvas;
    this.engine = engine;
    this.renderer = new Renderer(canvas);
    this.options = { budget: 6, maxParticles: 35000, ...options };
    this.running = false;
    this.destroyed = false;
    this.inFrame = false;
    this.frame = 0;
    this.listeners = new Map();
    this.wheels = [];
    this.pending = [];
    this.raf = 0;
    this.stats = { particles: 0, time: 0, frame: 0, fps: 0, simd: engine.simd };
    this.lastStats = performance.now();
    this.draws = 0;
    this.tick = this.tick.bind(this);
  }

  assertAlive() {
    if (this.destroyed)
      throw new Error(
        "This simulation has been destroyed. Create a new instance.",
      );
  }

  on(event, callback) {
    if (typeof callback !== "function")
      throw new TypeError("Event listener must be a function.");
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
    return this;
  }

  emit(event, detail) {
    for (const callback of this.listeners.get(event) ?? [])
      callback(detail, this);
  }

  loadScene(description) {
    this.assertAlive();
    const def =
      typeof description === "string"
        ? SCENES.find((s) => s.id === description)
        : description;
    if (!def) throw new Error(`Unknown scene: ${description}`);
    const wasRunning = this.running;
    this.pause();
    this.disableInteractions();
    this.engine.reset();
    this.inFrame = false;
    this.pending = [];
    this.wheels = [];
    this.frame = 0;
    const nativeScene = SCENES.includes(def) || def.kind === "native";
    this.scene =
      def.kind === "declarative" || nativeScene ? def : createScene(def);
    this.textures = new TextureFactory(this.engine, this.scene.dim ?? 2);
    if (this.scene.kind === "declarative") {
      const { dim, resolution: r, world, gravity } = this.scene;
      this.solver = new Solver(this.engine, dim, {
        res: world.map((v) => Math.max(16, Math.round(r * v))),
        delta_x: 1 / r,
        gravity,
        base_delta_t: 3e-4,
        penalty: 1e3,
        pushing_force: 0,
        ...this.scene.config,
      });
      if (this.scene.boundaries !== false) {
        const wall = Math.max(0.035, 8 / r);
        const ls = this.solver.create_levelset();
        ls.add_plane(dim === 2 ? [0, 1] : [0, 1, 0], -wall);
        ls.add_plane(dim === 2 ? [1, 0] : [1, 0, 0], -wall);
        ls.add_plane(dim === 2 ? [-1, 0] : [-1, 0, 0], 1 - wall);
        if (dim === 3)
          ls.add_plane([0, 0, 1], -wall).add_plane([0, 0, -1], world[2] - wall);
        ls.set_friction(this.scene.friction ?? 0.4);
        this.solver.set_levelset(ls);
      }
      for (const particle of this.scene.particles)
        this.insertParticles(particle);
      this.scene.setup?.({
        sim: this,
        solver: this.solver,
        mpm: this.solver,
        textures: this.textures,
        tex: this.textures,
        engine: this.engine,
      });
      this.frameUpdate = (t, dt) => this.scene.update?.(this, t, dt);
    } else {
      const result = this.scene.setup({
        engine: this.engine,
        tex: this.textures,
        textures: this.textures,
        quality: this.options.quality ?? "low",
        sim: this,
      });
      this.solver = result.mpm;
      this.frameUpdate = result.frameUpdate;
    }
    this.renderer.options = {
      showRigids: true,
      showBlocks: false,
      pointScale: 1,
      ...this.scene.render,
    };
    const levelset = this.engine.exportLevelset();
    this.renderer.setScene(
      {
        dim: this.scene.dim ?? 2,
        res: this.solver.config.res[0],
        levelset: levelset.nx ? levelset : null,
      },
      this.scene.camera,
      this.scene.decor,
    );
    this.syncFrame(true);
    this.emit("scenechange", this.scene);
    if (wasRunning) this.play();
    return this;
  }

  insertParticles(options = {}) {
    const material = options.material ?? options.type ?? "sand";
    if (!materials[material])
      throw new TypeError(
        `Unsupported material: ${material}. Choose ${materialTypes.join(", ")}.`,
      );
    const dim = this.scene.dim ?? 2;
    const shape = options.shape ?? "circle";
    const center = vector(
      options.center ?? (dim === 3 ? [0.5, 0.65, 0.5] : [0.5, 0.7]),
      dim,
      "center",
    );
    const radius = finite(options.radius ?? 0.04, "radius", 0.005, 1);
    let texture;
    if (shape === "circle" || shape === "sphere")
      texture = this.textures.sphere(center, radius);
    else if (shape === "rect" || shape === "box")
      texture = this.textures.rect(
        center,
        vector(options.size ?? Array(dim).fill(0.15), dim, "size"),
      );
    else if (shape === "polygon" && dim === 2) {
      if (!Array.isArray(options.points) || options.points.length < 3)
        throw new TypeError("A polygon needs at least three points.");
      texture = this.textures.polygon(
        options.points.map((p) => vector(p, 2, "point")),
      );
    } else throw new TypeError(`Unsupported ${dim}D shape: ${shape}`);
    const defaults = materials[material];
    const { color: defaultColor, ...params } = defaults;
    const result = this.solver.add_particles({
      type: material,
      ...params,
      ...options.properties,
      color: color(options.color ?? defaultColor),
      density_tex: texture.mul(
        finite(options.particlesPerCell ?? 2, "particlesPerCell", 0.1, 16),
      ),
      initial_velocity: vector(
        options.velocity ?? Array(dim).fill(0),
        dim,
        "velocity",
      ),
    });
    return result;
  }

  mutate(callback) {
    this.assertAlive();
    // Structural mutations happen only at frame boundaries, not during a WASM substep batch.
    if (this.inFrame) this.pending.push(callback);
    else {
      callback();
      this.syncFrame(true);
    }
    return this;
  }

  addParticles(options) {
    return this.mutate(() => {
      if (this.stats.particles >= this.options.maxParticles) return;
      const added = this.insertParticles(options);
      this.emit("particlesadded", { added, options });
    });
  }

  setGravity(gravity) {
    const next = vector(gravity, this.scene.dim ?? 2, "gravity");
    return this.setConfig({ gravity: next });
  }

  setConfig(config) {
    for (const key of Object.keys(config))
      if (!["gravity", "penalty", "pushing_force"].includes(key))
        throw new TypeError(`${key} cannot be changed at runtime.`);
    if (config.gravity) vector(config.gravity, this.scene.dim ?? 2, "gravity");
    for (const key of ["penalty", "pushing_force"])
      if (key in config) finite(config[key], key, 0, 1e7);
    return this.mutate(() =>
      this.solver.general_action({ action: "set_config", ...config }),
    );
  }

  addWheel(options = {}) {
    this.assertAlive();
    if (this.scene.dim !== 2)
      throw new Error(
        "addWheel is a 2D helper. Use TriangleMesh with the low-level API for a 3D wheel.",
      );
    if (this.wheels.length >= 10)
      throw new Error("At most ten helper wheels can be added per scene.");
    const state = {
      center: vector(options.center ?? [0.5, 0.25], 2, "center"),
      speed: finite(options.speed ?? 90, "speed", -720, 720),
      radius: finite(options.radius ?? 0.11, "radius", 0.02, 0.4),
      blades: Math.round(finite(options.blades ?? 8, "blades", 3, 24)),
      angle: 0,
      epoch: this.engine.time(),
      id: null,
    };
    const angleAt = (t) => state.angle + (t - state.epoch) * state.speed;
    const handle = {
      get id() {
        return state.id;
      },
      get speed() {
        return state.speed;
      },
      setSpeed: (speed) => {
        finite(speed, "speed", -720, 720);
        const now = this.engine.time();
        state.angle = angleAt(now);
        state.epoch = now;
        state.speed = speed;
        this.emit("wheelchange", { speed, id: state.id });
        return handle;
      },
      move: (center) => {
        state.center = vector(center, 2, "center");
        return handle;
      },
      stop: () => handle.setSpeed(0),
      start: (speed = options.speed ?? 90) => handle.setSpeed(speed),
    };
    this.wheels.push(handle);
    this.mutate(() => {
      const mesh = new SegmentMesh();
      const hub = state.radius * 0.19;
      for (let i = 0; i < 32; i++) {
        const a = (-i * Math.PI) / 16,
          b = (-(i + 1) * Math.PI) / 16;
        mesh.add_segment(
          [hub * Math.cos(a), hub * Math.sin(a)],
          [hub * Math.cos(b), hub * Math.sin(b)],
        );
      }
      for (let i = 0; i < state.blades; i++) {
        const a = (i * Math.PI * 2) / state.blades;
        mesh.add_segment(
          [hub * Math.cos(a), hub * Math.sin(a)],
          [state.radius * Math.cos(a), state.radius * Math.sin(a)],
        );
      }
      state.id = this.solver.add_particles({
        type: "rigid",
        codimensional: true,
        density: 100,
        friction: 0.3,
        scripted_position: () => state.center,
        scripted_rotation: angleAt,
        color: color(options.color ?? "#eae5d9"),
        segment_mesh: mesh,
      });
    });
    return handle;
  }

  enableInteractions(options = {}) {
    this.assertAlive();
    if (this.scene.dim !== 2)
      throw new Error(
        "Built-in pouring is 2D. 3D scenes use drag-to-orbit controls.",
      );
    this.disableInteractions();
    const abort = new AbortController();
    this.interactionAbort = abort;
    this.previousTouchAction = this.canvas.style.touchAction;
    this.canvas.style.touchAction = "none";
    const pointers = new Map();
    let last = 0;
    const pour = (event, force = false) => {
      if (!pointers.has(event.pointerId)) return;
      const now = performance.now();
      if (!force && now - last < (options.interval ?? 65)) return;
      last = now;
      const point = this.renderer.screenToWorld(event.clientX, event.clientY);
      const margin = 9 / this.solver.config.res[0];
      const world = this.scene.world ?? [1, 1];
      if (
        point[0] < margin ||
        point[0] > world[0] - margin ||
        point[1] < margin ||
        point[1] > world[1] - margin
      )
        return;
      this.addParticles({
        material: options.material ?? "sand",
        center: point,
        radius: options.radius ?? 0.028,
        color: options.color,
        velocity: options.velocity ?? [0, -0.35],
        particlesPerCell: options.particlesPerCell ?? 2,
      });
      this.emit("pointer", {
        point,
        pressure: event.pressure,
        pointerType: event.pointerType,
        originalEvent: event,
      });
    };
    this.canvas.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0 && event.pointerType === "mouse") return;
        pointers.set(event.pointerId, true);
        this.canvas.setPointerCapture(event.pointerId);
        pour(event, true);
      },
      { signal: abort.signal },
    );
    this.canvas.addEventListener("pointermove", pour, { signal: abort.signal });
    const end = (event) => {
      pointers.delete(event.pointerId);
      if (this.canvas.hasPointerCapture(event.pointerId))
        this.canvas.releasePointerCapture(event.pointerId);
    };
    this.canvas.addEventListener("pointerup", end, { signal: abort.signal });
    this.canvas.addEventListener("pointercancel", end, {
      signal: abort.signal,
    });
    return this;
  }

  disableInteractions() {
    this.interactionAbort?.abort();
    if (this.interactionAbort)
      this.canvas.style.touchAction = this.previousTouchAction ?? "";
    this.interactionAbort = null;
    return this;
  }

  setRenderOptions(options) {
    this.assertAlive();
    Object.assign(this.renderer.options, options);
    this.renderer.requestRender();
    return this;
  }

  play() {
    this.assertAlive();
    if (!this.running) {
      this.running = true;
      this.emit("statechange", { running: true });
      this.raf = requestAnimationFrame(this.tick);
    }
    return this;
  }

  pause() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.running = false;
    if (this.stepReject) {
      const reject = this.stepReject;
      this.stepResolve = this.stepReject = this.stepPromise = null;
      this.singleStep = false;
      reject(
        new Error(
          "Single-step operation interrupted by pause, reset, or destroy.",
        ),
      );
    }
    this.emit("statechange", { running: false });
    return this;
  }

  step() {
    this.assertAlive();
    if (this.stepPromise) return this.stepPromise;
    this.pause();
    this.singleStep = true;
    this.stepPromise = new Promise((resolve, reject) => {
      this.stepResolve = resolve;
      this.stepReject = reject;
      this.running = true;
      this.raf = requestAnimationFrame(this.tick);
    });
    return this.stepPromise;
  }

  reset() {
    return this.loadScene(this.scene);
  }

  tick() {
    this.raf = 0;
    if (!this.running || this.destroyed) return;
    const start = performance.now();
    try {
      do {
        if (!this.inFrame) {
          const commands = this.pending.splice(0);
          for (const command of commands) command();
          const t = this.engine.time();
          const dt = this.scene.frameDt ?? 1 / 120;
          this.emit("beforeStep", { time: t, dt });
          this.frameUpdate?.(t, dt);
          this.engine.beginStep(dt);
          this.inFrame = true;
        }
        if (this.engine.advance(1)) {
          this.inFrame = false;
          this.frame++;
          this.emit("afterStep", {
            time: this.engine.time(),
            frame: this.frame,
          });
          if (this.singleStep) {
            const resolve = this.stepResolve;
            this.stepResolve = this.stepReject = this.stepPromise = null;
            this.singleStep = false;
            this.pause();
            this.syncFrame(true);
            resolve?.(this.stats);
            return;
          }
        }
      } while (this.running && performance.now() - start < this.options.budget);
      this.syncFrame();
      if (this.running) this.raf = requestAnimationFrame(this.tick);
    } catch (error) {
      const reject = this.stepReject;
      this.stepResolve = this.stepReject = this.stepPromise = null;
      this.pause();
      this.singleStep = false;
      reject?.(error);
      this.emit("error", error);
    }
  }

  syncFrame(force = false) {
    if (!this.solver || this.destroyed) return;
    const { data, count } = this.engine.exportParticles(
      this.options.colorMode ?? 0,
    );
    this.renderer.setFrame(
      data,
      count,
      this.engine.exportRigids(),
      this.renderer.options.showBlocks ? this.engine.exportBlocks() : null,
      this.scene.dim === 3 ? 4 : 8,
    );
    this.draws++;
    const now = performance.now();
    const elapsed = now - this.lastStats;
    this.stats = {
      ...this.stats,
      particles: count,
      time: this.engine.time(),
      frame: this.frame,
      memoryMB: this.engine.memoryMB(),
      simd: this.engine.simd,
    };
    if (elapsed > 450 || force) {
      if (elapsed > 450)
        this.stats.fps = Math.min(
          120,
          Math.round((this.draws * 1000) / elapsed),
        );
      this.lastStats = now;
      this.draws = 0;
      this.emit("stats", { ...this.stats });
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.pause();
    this.disableInteractions();
    this.renderer.dispose();
    this.engine.reset();
    this.destroyed = true;
    this.emit("destroy");
    this.listeners.clear();
    this.pending = [];
    this.wheels = [];
    this.engine = this.solver = null;
  }
}

export async function create(options = {}) {
  const canvas =
    typeof options.canvas === "string"
      ? document.querySelector(options.canvas)
      : options.canvas;
  if (!(canvas instanceof HTMLCanvasElement))
    throw new TypeError(
      "canvas must be a canvas element or a selector that matches one.",
    );
  const engine = await MPMEngine.create((line, level) =>
    options.onLog?.(line, level),
  );
  const sim = new Simulation(canvas, engine, options);
  try {
    sim.loadScene(options.scene ?? demoScene());
    if (options.interactions)
      sim.enableInteractions(
        typeof options.interactions === "object" ? options.interactions : {},
      );
    if (options.autoplay !== false) sim.play();
    return sim;
  } catch (error) {
    sim.destroy();
    throw error;
  }
}
