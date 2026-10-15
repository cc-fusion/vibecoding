import * as THREE from "../vendor/three.module.js";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { VoxelWorld } from "./world.js";
import { meshChunk } from "./mesher.js";
export { VoxelWorld } from "./world.js";
export { SimplexNoise, hashString, mulberry32 } from "./noise.js";
export { THREE };

/** A DOM-independent world plus a small, embeddable WebGL renderer. No game systems. */
export class VoxelEngine extends EventTarget {
  constructor(
    container,
    { palette = ["#000000", "#8da977"], pixelRatio = 1.5, workers = 2 } = {},
  ) {
    super();
    this.container = container;
    this.world = new VoxelWorld();
    this.epoch = 0;
    this.options = { greedy: true, ao: true };
    this.meshes = new Map();
    this.jobs = new Map();
    this.serial = 0;
    this.stats = {
      fps: 0,
      frameMs: 0,
      drawCalls: 0,
      triangles: 0,
      quads: 0,
      faces: 0,
      chunks: 0,
      visibleChunks: 0,
      voxels: 0,
      bufferBytes: 0,
      pending: 0,
      meshMs: 0,
    };
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#e8eeeb");
    this.scene.fog = new THREE.Fog("#e8eeeb", 160, 350);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 800);
    this.camera.position.set(86, 65, 90);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, pixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D scene. Drag to orbit, right drag to pan, scroll to zoom.",
    );
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 5, 0);
    this.controls.minDistance = 8;
    this.controls.maxDistance = 270;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.addEventListener("change", () => {
      if (this.paused) this.render();
    });
    this.root = new THREE.Group();
    this.root.name = "Voxel world";
    this.scene.add(this.root);
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0,
    });
    this.ambient = new THREE.HemisphereLight("#eaf4ff", "#b0b498", 2.1);
    this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight("#fff1d5", 3.1);
    this.sun.position.set(-45, 80, 35);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -65,
      right: 65,
      top: 65,
      bottom: -65,
      near: 1,
      far: 200,
    });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.15;
    this.scene.add(this.sun);
    this.grid = new THREE.GridHelper(240, 48, "#bdcbc4", "#d5dfd9");
    this.grid.position.y = -8.85;
    this.scene.add(this.grid);
    this.setPalette(palette);
    this.workers = [];
    if (typeof Worker !== "undefined")
      for (let i = 0; i < Math.min(4, Math.max(0, workers)); i++) {
        try {
          const worker = new Worker(
            new URL("./mesh-worker.js", import.meta.url),
            { type: "module" },
          );
          const slot = { worker, busy: false, job: null };
          worker.onmessage = ({ data }) => {
            slot.busy = false;
            this.complete(data);
          };
          worker.onerror = () => {
            const pending = this.jobs.get(slot.job);
            if (pending && pending.epoch === this.epoch)
              this.world.dirty.add(pending.key);
            this.jobs.delete(slot.job);
            worker.terminate();
            this.workers = this.workers.filter((s) => s !== slot);
            this.emit(
              "warning",
              "Meshing worker unavailable; continuing with available workers or main-thread fallback.",
            );
          };
          this.workers.push(slot);
        } catch {
          this.emit(
            "warning",
            "Workers unavailable. Using synchronous meshing.",
          );
          break;
        }
      }
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.clock = performance.now();
    this.sampleTime = this.clock;
    this.frameCount = 0;
    this.paused = false;
    this.disposed = false;
    this.tick = this.tick.bind(this);
    this.raf = requestAnimationFrame(this.tick);
  }
  on(type, callback) {
    const handler = (e) => callback(e.detail);
    this.addEventListener(type, handler);
    return () => this.removeEventListener(type, handler);
  }
  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
  setPalette(hexColors) {
    if (
      !Array.isArray(hexColors) ||
      hexColors.length > 256 ||
      !hexColors.every(
        (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c),
      )
    )
      throw new Error("Palette must contain at most 256 six-digit hex colors.");
    this.palette = [...hexColors];
    this.linearPalette = hexColors.map((hex) => new THREE.Color(hex).toArray());
    this.world.invalidate();
  }
  setWorld(world) {
    if (!(world instanceof VoxelWorld))
      throw new TypeError("Expected VoxelWorld");
    this.epoch++;
    for (const m of this.meshes.values()) m.geometry.dispose();
    this.root.clear();
    this.meshes.clear();
    this.world = world;
    world.invalidate();
    this.emit("worldchange", world);
    if (!world.chunks.size) {
      const epoch = this.epoch;
      queueMicrotask(() => {
        if (!this.disposed && this.epoch === epoch) this.emit("ready", { chunks: 0 });
      });
    }
  }
  setMeshing(options) {
    for (const key of ["greedy", "ao"]) {
      if (key in options && typeof options[key] !== "boolean") {
        throw new TypeError(`${key} must be a boolean`);
      }
    }
    for (const key of ["greedy", "ao"]) {
      if (key in options) this.options[key] = options[key];
    }
    this.world.invalidate();
    if (!this.world.chunks.size) {
      queueMicrotask(() => {
        if (!this.disposed) this.emit("ready", { chunks: 0 });
      });
    }
  }
  pump() {
    const limit = this.workers.length || 1;
    let sent = 0;
    for (const key of this.world.dirty) {
      if (sent >= limit) break;
      if (
        [...this.jobs.values()].some(
          (j) => j.key === key && j.epoch === this.epoch,
        )
      )
        continue;
      const slot = this.workers.find((s) => !s.busy);
      if (this.workers.length && !slot) break;
      const c = this.world.chunks.get(key);
      this.world.dirty.delete(key);
      if (!c) continue;
      const job = ++this.serial,
        data = this.world.snapshot(c);
      this.jobs.set(job, { key, version: c.version, epoch: this.epoch });
      sent++;
      if (slot) {
        slot.busy = true;
        slot.job = job;
        slot.worker.postMessage(
          { job, data, palette: this.linearPalette, options: this.options },
          [data.buffer],
        );
      } else {
        const start = performance.now();
        this.complete({
          job,
          result: meshChunk(data, this.linearPalette, this.options),
          ms: performance.now() - start,
        });
      }
    }
  }
  complete({ job, result, error, ms }) {
    const pending = this.jobs.get(job);
    this.jobs.delete(job);
    if (!pending || this.disposed || pending.epoch !== this.epoch) return;
    const c = this.world.chunks.get(pending.key);
    if (!c || c.version !== pending.version) return; // never install stale geometry
    if (error) {
      this.emit("error", error);
      return;
    }
    const old = this.meshes.get(c.key);
    if (old) {
      this.root.remove(old);
      old.geometry.dispose();
      this.meshes.delete(c.key);
    }
    if (result.indices.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.BufferAttribute(result.positions, 3),
      );
      geo.setAttribute("normal", new THREE.BufferAttribute(result.normals, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(result.colors, 3));
      geo.setIndex(new THREE.BufferAttribute(result.indices, 1));
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.position.set(c.x * 16, c.y * 16, c.z * 16);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = {
        key: c.key,
        quads: result.quads,
        faces: result.faces,
        bytes:
          result.positions.byteLength +
          result.normals.byteLength +
          result.colors.byteLength +
          result.indices.byteLength,
      };
      this.root.add(mesh);
      this.meshes.set(c.key, mesh);
    }
    this.stats.meshMs = ms;
    if (this.paused) this.render();
    if (
      !this.world.dirty.size &&
      ![...this.jobs.values()].some((j) => j.epoch === this.epoch)
    )
      this.emit("ready", { chunks: this.meshes.size });
  }
  resize() {
    const w = Math.max(1, this.container.clientWidth),
      h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.render();
  }
  render() {
    this.renderer.render(this.scene, this.camera);
  }
  tick(now) {
    if (this.disposed || this.paused) return;
    const dt = Math.min((now - this.clock) / 1000, 0.1);
    this.clock = now;
    this.pump();
    this.controls.update(dt);
    this.emit("frame", { dt, now });
    this.render();
    this.frameCount++;
    if (now - this.sampleTime >= 400) {
      this.stats.fps = Math.round(
        (this.frameCount * 1000) / (now - this.sampleTime),
      );
      this.stats.frameMs = (now - this.sampleTime) / this.frameCount;
      this.frameCount = 0;
      this.sampleTime = now;
      Object.assign(this.stats, {
        drawCalls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        chunks: this.meshes.size,
        voxels: this.world.voxelCount,
        pending:
          this.world.dirty.size +
          [...this.jobs.values()].filter((j) => j.epoch === this.epoch).length,
        quads: 0,
        faces: 0,
        bufferBytes: 0,
        visibleChunks: 0,
      });
      const frustum = new THREE.Frustum().setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(
          this.camera.projectionMatrix,
          this.camera.matrixWorldInverse,
        ),
      );
      for (const m of this.meshes.values()) {
        this.stats.quads += m.userData.quads;
        this.stats.faces += m.userData.faces;
        this.stats.bufferBytes += m.userData.bytes;
        if (this.root.visible && frustum.intersectsObject(m))
          this.stats.visibleChunks++;
      }
      this.emit("stats", { ...this.stats });
    }
    this.raf = requestAnimationFrame(this.tick);
  }
  setPaused(value) {
    this.paused = value;
    cancelAnimationFrame(this.raf);
    this.controls.enableDamping = !value;
    if (!value) {
      this.clock = this.sampleTime = performance.now();
      this.frameCount = 0;
      this.raf = requestAnimationFrame(this.tick);
    }
  }
  /** Returns the intersected voxel and face normal, or null. Coordinates are canvas-relative pixels. */
  pick(x, y) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        (x / this.container.clientWidth) * 2 - 1,
        1 - (y / this.container.clientHeight) * 2,
      ),
      this.camera,
    );
    const hit = ray.intersectObjects(this.root.children, false)[0];
    if (!hit) return null;
    const p = hit.point.clone().addScaledVector(hit.face.normal, -0.001);
    return {
      position: p.toArray().map(Math.floor),
      normal: hit.face.normal.toArray(),
      id: this.world.get(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)),
      distance: hit.distance,
    };
  }
  frameWorld() {
    const box = new THREE.Box3().setFromObject(this.root);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3()).length();
    this.controls.target.copy(center);
    this.camera.position
      .copy(center)
      .add(
        new THREE.Vector3(1, 0.8, 1).normalize().multiplyScalar(size * 1.25),
      );
    this.controls.update();
    this.render();
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    for (const s of this.workers) s.worker.terminate();
    this.jobs.clear();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material && o.material !== this.material)
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          m.dispose(),
        );
    });
    this.material.dispose();
    this.sun.shadow.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
