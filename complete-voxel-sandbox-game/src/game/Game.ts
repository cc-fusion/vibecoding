// Main game orchestrator: rendering, chunk streaming, input, interaction, day/night, saving.
import * as THREE from "three";
import { B, BLOCKS, ITEMS, isBlock, itemName, maxStack, RECIPES, type Recipe, type SoundKind } from "./blocks";
import { getAtlas, type Atlas } from "./textures";
import { World, chunkKey, type Chunk } from "./world";
import { CHUNK, HEIGHT, BIOME_NAMES } from "./worldgen";
import { buildChunkGeometry, LIGHT_CURVE } from "./mesher";
import { Player, type MoveInput } from "./player";
import { Inventory, HOTBAR, makeStack, type Stack } from "./inventory";
import { AudioSys } from "./audio";
import { DropManager, ParticleSystem, itemGeometry } from "./entities";
import { Saves, type Settings, type WorldSave, type WorldMeta } from "./save";
import { makeChunkMaterials } from "./shaders";

export type Screen = "none" | "inventory" | "pause" | "dead";
export interface Station {
  table: boolean;
  furnace: boolean;
}
export interface Toast {
  id: number;
  text: string;
  until: number;
}
export interface Target {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

const DAY_LENGTH = 600; // seconds per full day/night cycle
const REACH_SURVIVAL = 5;
const REACH_CREATIVE = 6.5;

export class Game {
  // three.js
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  handScene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  atlas: Atlas;
  private solidMat: THREE.ShaderMaterial;
  private waterMat: THREE.ShaderMaterial;
  private uniforms: ReturnType<typeof makeChunkMaterials>["uniforms"];
  private selectionBox: THREE.LineSegments;
  private crackMesh: THREE.Mesh;
  private crackMat: THREE.MeshBasicMaterial;
  private skyGroup = new THREE.Group();
  private sunMesh: THREE.Mesh;
  private moonMesh: THREE.Mesh;
  private stars: THREE.Points;
  private starsMat: THREE.PointsMaterial;
  private clouds: THREE.Mesh;
  private cloudTex: THREE.CanvasTexture;
  private handGroup = new THREE.Group();
  private handMesh: THREE.Mesh | null = null;
  private handMat: THREE.MeshBasicMaterial;
  private handItemId = -1;
  private swing = 1;
  private bobPhase = 0;

  // world & gameplay
  world: World;
  player = new Player();
  inventory = new Inventory();
  drops: DropManager;
  particles: ParticleSystem;
  audio = new AudioSys();
  meta: WorldMeta;
  settings: Settings;
  time = 0.05;
  spawn: [number, number, number] = [0, 70, 0];
  stats = { blocksMined: 0, blocksPlaced: 0, crafted: 0, deaths: 0, playTime: 0 };

  // ui state (read by React)
  screen: Screen = "none";
  station: Station = { table: false, furnace: false };
  cursorStack: Stack | null = null;
  toasts: Toast[] = [];
  debug = false;
  fps = 0;
  target: Target | null = null;
  breakProgress = 0;
  hurtFlash = 0;
  lastSlotChange = 0;
  running = false;
  disposed = false;
  loading = true;
  pointerLocked = false;
  private isNewWorld = true;
  private listeners = new Set<() => void>();
  private uiTimer = 0;
  private toastId = 0;

  // input
  private keys = new Set<string>();
  private mouseDown = [false, false, false];
  private breakingKey = "";
  private placeTimer = 0;
  private breakCooldown = 0;
  private lastSpaceTap = 0;
  private lastWTap = 0;
  private sprintToggle = false;
  private digSoundTimer = 0;
  private lockRequestedAt = 0;

  private lastFrame = 0;
  private raf = 0;
  private saveTimer = 0;
  private frames = 0;
  private fpsTimer = 0;
  private regenTimer = 0;
  private stationTimer = 0;
  private chunkOffsets: [number, number][] = [];
  private fov = 75;

  constructor(private container: HTMLElement, save: WorldSave, settings: Settings) {
    this.meta = save.meta;
    this.settings = settings;
    this.atlas = getAtlas();
    this.world = new World(save.meta.seed);
    this.world.loadEdits(save.edits ?? {});
    this.time = typeof save.time === "number" ? save.time : 0.05;
    this.spawn = save.spawn ?? [0, 70, 0];
    if (save.stats) this.stats = { ...this.stats, ...save.stats };
    this.inventory.load(save.inventory);
    this.player.creative = save.meta.mode === "creative";
    this.isNewWorld = !save.player;
    if (save.player) {
      this.player.pos.set(save.player.pos[0], save.player.pos[1], save.player.pos[2]);
      this.player.yaw = save.player.yaw;
      this.player.pitch = save.player.pitch;
      this.player.health = save.player.health;
      this.player.air = save.player.air ?? 20;
      this.player.flying = !!save.player.flying && this.player.creative;
    }

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(settings.fov, container.clientWidth / container.clientHeight, 0.05, 1500);
    this.fov = settings.fov;
    this.handScene.add(this.camera);

    const mats = makeChunkMaterials(this.atlas.texture);
    this.solidMat = mats.solid;
    this.waterMat = mats.water;
    this.uniforms = mats.uniforms;

    // selection outline + crack overlay
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
    this.selectionBox = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }));
    this.selectionBox.visible = false;
    this.scene.add(this.selectionBox);
    this.crackMat = new THREE.MeshBasicMaterial({ map: this.atlas.texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.crackMesh = new THREE.Mesh(this.crackGeometry(0), this.crackMat);
    this.crackMesh.visible = false;
    this.scene.add(this.crackMesh);

    // sky
    const sunGeo = new THREE.PlaneGeometry(1, 1);
    this.sunMesh = new THREE.Mesh(sunGeo, new THREE.MeshBasicMaterial({ map: this.discTexture([255, 245, 200], [255, 215, 120]), transparent: true, depthWrite: false, fog: false }));
    this.moonMesh = new THREE.Mesh(sunGeo, new THREE.MeshBasicMaterial({ map: this.discTexture([230, 235, 255], [170, 180, 210], true), transparent: true, depthWrite: false }));
    this.skyGroup.add(this.sunMesh, this.moonMesh);
    const starPos: number[] = [];
    for (let i = 0; i < 700; i++) {
      const v = new THREE.Vector3().randomDirection();
      if (v.y < -0.1) continue;
      starPos.push(v.x * 1000, v.y * 1000, v.z * 1000);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
    this.starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
    this.stars = new THREE.Points(starGeo, this.starsMat);
    this.skyGroup.add(this.stars);
    this.scene.add(this.skyGroup);
    this.cloudTex = this.makeCloudTexture();
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshBasicMaterial({ map: this.cloudTex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = HEIGHT + 8;
    this.scene.add(this.clouds);

    // entities
    this.drops = new DropManager(this.scene, this.atlas);
    this.particles = new ParticleSystem(this.scene, this.atlas);

    // first-person hand
    this.handMat = new THREE.MeshBasicMaterial({ map: this.atlas.texture, alphaTest: 0.5, vertexColors: true, side: THREE.DoubleSide });
    this.camera.add(this.handGroup);

    this.player.onEvent = (e, data) => this.onPlayerEvent(e, data);
    this.applySettings(settings);
    this.bindEvents();
  }

  // ---------------- setup helpers ----------------

  private discTexture(inner: number[], outer: number[], moon = false): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    if (moon) {
      ctx.fillStyle = `rgb(${outer.join(",")})`;
      ctx.fillRect(16, 16, 32, 32);
      ctx.fillStyle = `rgb(${inner.join(",")})`;
      ctx.fillRect(20, 20, 24, 24);
      ctx.fillStyle = `rgb(${outer.join(",")})`;
      ctx.fillRect(28, 24, 8, 8);
      ctx.fillRect(24, 36, 6, 6);
    } else {
      const g = ctx.createRadialGradient(32, 32, 6, 32, 32, 32);
      g.addColorStop(0, `rgba(${inner.join(",")},1)`);
      g.addColorStop(0.45, `rgba(${outer.join(",")},1)`);
      g.addColorStop(0.5, `rgba(${outer.join(",")},0.35)`);
      g.addColorStop(1, `rgba(${outer.join(",")},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private makeCloudTexture(): THREE.CanvasTexture {
    const N = 128;
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(N, N);
    const rnd = (x: number, y: number) => {
      const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };
    // value noise, tiled
    const grid = 16;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        let sum = 0, amp = 1, norm = 0;
        for (let o = 0; o < 3; o++) {
          const f = (1 << o) * (grid / N);
          const fx = x * f, fy = y * f;
          const x0 = Math.floor(fx), y0 = Math.floor(fy);
          const tx = fx - x0, ty = fy - y0;
          const per = grid * (1 << o);
          const v = (gx: number, gy: number) => rnd(((gx % per) + per) % per, ((gy % per) + per) % per);
          const a = v(x0, y0), b = v(x0 + 1, y0), cc = v(x0, y0 + 1), d = v(x0 + 1, y0 + 1);
          const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
          const n = a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy;
          sum += n * amp;
          norm += amp;
          amp *= 0.5;
        }
        const n = sum / norm;
        const on = n > 0.56;
        const i = (y * N + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = on ? 255 : 0;
      }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.repeat.set(1400 / 1024, 1400 / 1024);
    return t;
  }

  private crackGeometry(stage: number): THREE.BufferGeometry {
    const g = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const uv = this.atlas.tileUV(`crack_${stage}`);
    const attr = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < attr.count; i++) {
      const u = attr.getX(i), v = attr.getY(i);
      attr.setXY(i, uv[0] + u * (uv[2] - uv[0]), uv[1] + (1 - v) * (uv[3] - uv[1]));
    }
    attr.needsUpdate = true;
    return g;
  }

  private buildChunkOffsets(r: number) {
    const offs: [number, number][] = [];
    for (let dx = -r - 1; dx <= r + 1; dx++) for (let dz = -r - 1; dz <= r + 1; dz++) if (dx * dx + dz * dz <= (r + 1) * (r + 1) + 1) offs.push([dx, dz]);
    offs.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]));
    this.chunkOffsets = offs;
  }

  applySettings(s: Settings) {
    this.settings = s;
    this.buildChunkOffsets(s.renderDistance);
    const viewDist = s.renderDistance * CHUNK;
    this.uniforms.uFogFar.value = viewDist - 10;
    this.uniforms.uFogNear.value = Math.max(8, (viewDist - 10) * 0.55);
    this.fov = s.fov;
    this.audio.setVolumes(s.volume, s.musicVolume);
    Saves.saveSettings(s);
    this.notify();
  }

  // ---------------- UI plumbing ----------------

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  notify() {
    for (const l of this.listeners) l();
  }
  toast(text: string, ms = 2500) {
    this.toasts.push({ id: ++this.toastId, text, until: performance.now() + ms });
    if (this.toasts.length > 4) this.toasts.shift();
    this.notify();
  }

  // ---------------- lifecycle ----------------

  /** Generate & mesh the area around the player before showing the world. */
  async prepare(onProgress: (p: number, label: string) => void) {
    const r = Math.min(this.settings.renderDistance, 5);
    if (this.isNewWorld) {
      const [sx, sz] = this.world.findSpawn();
      this.world.ensureChunk(sx >> 4, sz >> 4);
      const h = this.world.gen.surfaceHeight(sx, sz);
      // prefer standing on the terrain surface (not on a tree canopy) if that spot is free
      const free = !this.world.isSolid(sx, h + 1, sz) && !this.world.isSolid(sx, h + 2, sz) && this.world.isSolid(sx, h, sz);
      const y = free ? h + 1 : this.world.highestSolid(sx, sz) + 1;
      this.spawn = [sx + 0.5, y, sz + 0.5];
      this.player.pos.set(sx + 0.5, y, sz + 0.5);
    }
    const pcx = Math.floor(this.player.pos.x) >> 4, pcz = Math.floor(this.player.pos.z) >> 4;
    const list = this.chunkOffsets.filter(([dx, dz]) => dx * dx + dz * dz <= (r + 1) * (r + 1));
    const total = list.length * 2;
    let done = 0;
    let last = performance.now();
    const yieldIfNeeded = async () => {
      if (performance.now() - last > 30) {
        onProgress(done / total, done < list.length ? "Generating terrain" : "Building meshes");
        await new Promise((res) => setTimeout(res, 0));
        last = performance.now();
      }
    };
    for (const [dx, dz] of list) {
      if (this.disposed) return;
      this.world.ensureChunk(pcx + dx, pcz + dz);
      done++;
      await yieldIfNeeded();
    }
    for (const [dx, dz] of list) {
      if (this.disposed) return;
      const c = this.world.getChunk(pcx + dx, pcz + dz);
      if (c && c.dirty && this.neighborsReady(c.cx, c.cz)) this.remesh(c);
      done++;
      await yieldIfNeeded();
    }
    // make sure the player isn't inside terrain (e.g. edits changed things)
    if (this.player.isStuck(this.world)) {
      const y = this.world.highestSolid(Math.floor(this.player.pos.x), Math.floor(this.player.pos.z)) + 1;
      this.player.pos.y = y;
    }
    this.loading = false;
    onProgress(1, "Ready");
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    this.audio.start();
    const loop = (t: number) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (t - this.lastFrame) / 1000);
      this.lastFrame = t;
      try {
        this.frame(dt);
      } catch (err) {
        console.error(err);
      }
    };
    this.raf = requestAnimationFrame(loop);
    if (this.stats.playTime < 1) this.toast("Welcome! Hold left click to mine, right click to place. Press E for inventory.", 6000);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unbindEvents();
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    for (const c of this.world.chunks.values()) this.disposeChunkMeshes(c);
    this.drops.clear();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
  }

  // ---------------- events ----------------

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    this.audio.start();
    const code = e.code;
    if (code === "F3") {
      e.preventDefault();
      this.debug = !this.debug;
      this.notify();
      return;
    }
    if (this.screen === "dead") return;
    if (this.screen === "inventory") {
      if (code === "KeyE" || code === "Escape") {
        e.preventDefault();
        this.closeScreen();
      }
      return;
    }
    if (this.screen === "pause") {
      if (code === "Escape") {
        e.preventDefault();
        this.closeScreen();
      }
      return;
    }
    this.keys.add(code);
    if (code === "KeyE") {
      e.preventDefault();
      this.openInventory();
    } else if (code === "Escape") {
      this.openPause();
    } else if (code.startsWith("Digit")) {
      const n = parseInt(code.slice(5)) - 1;
      if (n >= 0 && n < HOTBAR) this.selectSlot(n);
    } else if (code === "KeyQ") {
      this.dropHeld(e.ctrlKey || e.metaKey);
    } else if (code === "KeyF" && this.player.creative) {
      this.player.flying = !this.player.flying;
      this.toast(this.player.flying ? "Flying enabled" : "Flying disabled", 1200);
    } else if (code === "Space") {
      const now = performance.now();
      if (this.player.creative && now - this.lastSpaceTap < 280) {
        this.player.flying = !this.player.flying;
        this.lastSpaceTap = 0;
      } else this.lastSpaceTap = now;
    } else if (code === "KeyW") {
      const now = performance.now();
      if (now - this.lastWTap < 280) this.sprintToggle = true;
      this.lastWTap = now;
    }
    if (["Space", "Tab", "KeyW", "KeyA", "KeyS", "KeyD"].includes(code)) e.preventDefault();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === "KeyW") this.sprintToggle = false;
  };
  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked || this.screen !== "none") return;
    const s = 0.0022 * this.settings.sensitivity;
    this.player.yaw -= e.movementX * s;
    this.player.pitch -= e.movementY * s;
    const lim = Math.PI / 2 - 0.001;
    this.player.pitch = Math.max(-lim, Math.min(lim, this.player.pitch));
  };
  private onMouseDown = (e: MouseEvent) => {
    if (this.screen !== "none") return;
    if (!this.pointerLocked) {
      this.requestLock();
      return;
    }
    e.preventDefault();
    this.mouseDown[e.button] = true;
    if (e.button === 0) this.breakProgress = 0;
    if (e.button === 2) {
      this.placeTimer = 0;
      this.useItem();
    }
    if (e.button === 1) this.pickBlock();
  };
  private onMouseUp = (e: MouseEvent) => {
    this.mouseDown[e.button] = false;
    if (e.button === 0) {
      this.breakProgress = 0;
      this.crackMesh.visible = false;
    }
  };
  private onWheel = (e: WheelEvent) => {
    if (this.screen !== "none") return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    this.selectSlot((this.inventory.selected + dir + HOTBAR) % HOTBAR);
  };
  private onLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    if (!this.pointerLocked && this.screen === "none" && !this.loading) {
      // user pressed Esc (or lock lost): pause
      this.openPause(false);
    }
    this.notify();
  };
  private onResize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
  private onBlur = () => {
    this.keys.clear();
    this.mouseDown = [false, false, false];
  };
  private onBeforeUnload = () => {
    this.save(false);
  };
  private onContext = (e: Event) => e.preventDefault();

  private bindEvents() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    this.renderer.domElement.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    this.renderer.domElement.addEventListener("wheel", this.onWheel, { passive: false });
    this.renderer.domElement.addEventListener("contextmenu", this.onContext);
    document.addEventListener("pointerlockchange", this.onLockChange);
    window.addEventListener("resize", this.onResize);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("beforeunload", this.onBeforeUnload);
  }
  private unbindEvents() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    this.renderer.domElement.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.renderer.domElement.removeEventListener("wheel", this.onWheel);
    this.renderer.domElement.removeEventListener("contextmenu", this.onContext);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("beforeunload", this.onBeforeUnload);
  }

  requestLock() {
    if (this.pointerLocked || this.disposed) return;
    const now = performance.now();
    if (now - this.lockRequestedAt < 100) return;
    this.lockRequestedAt = now;
    this.audio.start();
    try {
      const p = this.renderer.domElement.requestPointerLock({ unadjustedMovement: true } as unknown as undefined) as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === "function") p.catch(() => {
        try {
          this.renderer.domElement.requestPointerLock();
        } catch {
          /* ignore */
        }
      });
    } catch {
      try {
        this.renderer.domElement.requestPointerLock();
      } catch {
        /* ignore */
      }
    }
  }

  // ---------------- screens ----------------

  openInventory() {
    this.screen = "inventory";
    this.station = this.nearStations();
    this.keys.clear();
    this.mouseDown = [false, false, false];
    this.crackMesh.visible = false;
    if (this.pointerLocked) document.exitPointerLock();
    this.audio.play("click");
    this.notify();
  }
  openPause(exitLock = true) {
    if (this.screen === "dead") return;
    this.screen = "pause";
    this.keys.clear();
    this.mouseDown = [false, false, false];
    this.crackMesh.visible = false;
    if (exitLock && this.pointerLocked) document.exitPointerLock();
    this.save(false);
    this.notify();
  }
  /** Resume play (from inventory / pause). */
  closeScreen() {
    if (this.screen === "inventory" && this.cursorStack) {
      const left = this.inventory.addStack(this.cursorStack);
      if (left > 0) this.spawnDrop({ ...this.cursorStack, count: left }, true);
      this.cursorStack = null;
    }
    this.screen = "none";
    this.notify();
    this.requestLock();
  }

  private nearStations(): Station {
    const p = this.player.pos;
    const s: Station = { table: false, furnace: false };
    const R = 4;
    for (let x = -R; x <= R; x++)
      for (let y = -2; y <= 3; y++)
        for (let z = -R; z <= R; z++) {
          const b = this.world.getBlock(Math.floor(p.x) + x, Math.floor(p.y) + y, Math.floor(p.z) + z);
          if (b === B.CRAFTING_TABLE) s.table = true;
          else if (b === B.FURNACE) s.furnace = true;
        }
    return s;
  }

  // ---------------- inventory UI actions ----------------

  selectSlot(i: number) {
    if (i === this.inventory.selected) return;
    this.inventory.selected = i;
    this.lastSlotChange = performance.now();
    this.breakProgress = 0;
    this.notify();
  }

  slotClick(i: number, button: number, shift: boolean) {
    const inv = this.inventory;
    const slot = inv.slots[i];
    const cur = this.cursorStack;
    if (shift && slot) {
      // move between hotbar and main
      const range = i < HOTBAR ? [HOTBAR, inv.slots.length] : [0, HOTBAR];
      const max = maxStack(slot.id);
      for (let j = range[0]; j < range[1] && slot.count > 0; j++) {
        const t = inv.slots[j];
        if (t && t.id === slot.id && t.count < max && max > 1) {
          const take = Math.min(max - t.count, slot.count);
          t.count += take;
          slot.count -= take;
        }
      }
      for (let j = range[0]; j < range[1] && slot.count > 0; j++) {
        if (!inv.slots[j]) {
          inv.slots[j] = { ...slot };
          slot.count = 0;
        }
      }
      if (slot.count <= 0) inv.slots[i] = null;
    } else if (button === 0) {
      if (!cur) {
        this.cursorStack = slot;
        inv.slots[i] = null;
      } else if (!slot) {
        inv.slots[i] = cur;
        this.cursorStack = null;
      } else if (slot.id === cur.id && maxStack(slot.id) > 1) {
        const take = Math.min(maxStack(slot.id) - slot.count, cur.count);
        slot.count += take;
        cur.count -= take;
        if (cur.count <= 0) this.cursorStack = null;
      } else {
        inv.slots[i] = cur;
        this.cursorStack = slot;
      }
    } else if (button === 2) {
      if (!cur) {
        if (slot) {
          const half = Math.ceil(slot.count / 2);
          this.cursorStack = { ...slot, count: half };
          slot.count -= half;
          if (slot.count <= 0) inv.slots[i] = null;
        }
      } else if (!slot) {
        inv.slots[i] = { ...cur, count: 1 };
        cur.count--;
        if (cur.count <= 0) this.cursorStack = null;
      } else if (slot.id === cur.id && slot.count < maxStack(slot.id)) {
        slot.count++;
        cur.count--;
        if (cur.count <= 0) this.cursorStack = null;
      }
    }
    inv.touch();
    this.audio.play("click", "stone", 0.6);
    this.notify();
  }

  /** creative palette click: grab a full stack */
  creativeGrab(id: number, button: number) {
    if (!this.player.creative) return;
    if (this.cursorStack && this.cursorStack.id === id) this.cursorStack = null;
    else if (button === 2) {
      // right click: send straight to hotbar
      const slot = this.inventory.firstEmptyHotbar();
      const dst = slot >= 0 ? slot : this.inventory.selected;
      this.inventory.slots[dst] = makeStack(id, maxStack(id));
      this.inventory.touch();
    } else this.cursorStack = makeStack(id, maxStack(id));
    this.audio.play("click", "stone", 0.6);
    this.notify();
  }

  /** drop the cursor stack into the world (clicked outside the inventory) */
  dropCursor() {
    if (!this.cursorStack) return;
    this.spawnDrop(this.cursorStack, true);
    this.cursorStack = null;
    this.notify();
  }

  /** delete cursor stack (creative trash) */
  trashCursor() {
    this.cursorStack = null;
    this.audio.play("click");
    this.notify();
  }

  craft(r: Recipe, all = false) {
    if (r.station === "table" && !this.station.table) {
      this.toast("You need a Crafting Table nearby");
      return;
    }
    if (r.station === "furnace" && !this.station.furnace) {
      this.toast("You need a Furnace nearby");
      return;
    }
    const times = all ? Math.min(this.inventory.craftableTimes(r), 64) : 1;
    let made = 0;
    for (let i = 0; i < times; i++) {
      if (!this.inventory.craft(r)) break;
      made++;
    }
    if (made > 0) {
      this.stats.crafted += made * r.count;
      this.audio.play("craft");
    } else if (this.inventory.canCraft(r)) this.toast("Inventory full");
    this.notify();
  }

  availableRecipes(): Recipe[] {
    return RECIPES;
  }

  dropHeld(all: boolean) {
    const s = this.inventory.held;
    if (!s) return;
    const n = all ? s.count : 1;
    const st: Stack = { ...s, count: n };
    this.inventory.consumeHeld(n);
    this.spawnDrop(st, true);
    this.notify();
  }

  private spawnDrop(stack: Stack, thrown: boolean) {
    const eye = this.player.eye;
    const d = this.player.direction();
    const vel = thrown
      ? new THREE.Vector3(d.x * 7 + (Math.random() - 0.5), d.y * 7 + 2, d.z * 7 + (Math.random() - 0.5))
      : new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2);
    this.drops.spawn(stack, eye.x + d.x * 0.5, eye.y - 0.3, eye.z + d.z * 0.5, vel, 1.2);
  }

  respawn() {
    this.player.respawn(this.spawn[0], this.spawn[1], this.spawn[2]);
    if (this.player.isStuck(this.world)) this.player.pos.y = this.world.highestSolid(Math.floor(this.spawn[0]), Math.floor(this.spawn[2])) + 1;
    this.screen = "none";
    this.notify();
    this.requestLock();
  }

  // ---------------- saving ----------------

  buildSave(): WorldSave {
    return {
      meta: { ...this.meta, lastPlayed: Date.now() },
      edits: this.world.serializeEdits(),
      player: {
        pos: [this.player.pos.x, this.player.pos.y, this.player.pos.z],
        yaw: this.player.yaw,
        pitch: this.player.pitch,
        health: this.player.health,
        air: this.player.air,
        flying: this.player.flying,
      },
      inventory: this.inventory.serialize(),
      time: this.time,
      spawn: this.spawn,
      stats: this.stats,
    };
  }

  save(showToast = true): boolean {
    if (this.loading) return false;
    const ok = Saves.save(this.buildSave());
    if (showToast) this.toast(ok ? "Game saved" : "Save failed (storage full?)");
    else if (!ok) this.toast("Save failed (storage full?)");
    this.saveTimer = 0;
    return ok;
  }

  // ---------------- chunk streaming ----------------

  private neighborsReady(cx: number, cz: number): boolean {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (!this.world.hasChunk(cx + dx, cz + dz)) return false;
    return true;
  }

  private disposeChunkMeshes(c: Chunk) {
    if (c.solidMesh) {
      this.scene.remove(c.solidMesh);
      c.solidMesh.geometry.dispose();
      c.solidMesh = null;
    }
    if (c.waterMesh) {
      this.scene.remove(c.waterMesh);
      c.waterMesh.geometry.dispose();
      c.waterMesh = null;
    }
  }

  private remesh(c: Chunk) {
    const { solid, water } = buildChunkGeometry(this.world, c, this.atlas);
    this.disposeChunkMeshes(c);
    if (solid) {
      const m = new THREE.Mesh(solid, this.solidMat);
      m.position.set(c.cx * CHUNK, 0, c.cz * CHUNK);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      this.scene.add(m);
      c.solidMesh = m;
    }
    if (water) {
      const m = new THREE.Mesh(water, this.waterMat);
      m.position.set(c.cx * CHUNK, 0, c.cz * CHUNK);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      m.renderOrder = 1;
      this.scene.add(m);
      c.waterMesh = m;
    }
    c.dirty = false;
    this.world.dirty.delete(chunkKey(c.cx, c.cz));
  }

  private streamChunks(budgetMs: number) {
    const start = performance.now();
    const pcx = Math.floor(this.player.pos.x) >> 4, pcz = Math.floor(this.player.pos.z) >> 4;
    const R = this.settings.renderDistance;

    // 1) urgent: dirty chunks very close to the player (edits)
    for (const key of [...this.world.dirty]) {
      const c = this.world.chunks.get(key);
      if (!c) {
        this.world.dirty.delete(key);
        continue;
      }
      if (Math.abs(c.cx - pcx) <= 1 && Math.abs(c.cz - pcz) <= 1 && this.neighborsReady(c.cx, c.cz)) this.remesh(c);
    }

    // 2) generate missing chunks nearest first, and mesh nearest dirty ones
    for (const [dx, dz] of this.chunkOffsets) {
      if (performance.now() - start > budgetMs) return;
      const cx = pcx + dx, cz = pcz + dz;
      let c = this.world.getChunk(cx, cz);
      if (!c) {
        c = this.world.ensureChunk(cx, cz);
        continue;
      }
      if (c.dirty && dx * dx + dz * dz <= R * R + 1 && this.neighborsReady(cx, cz)) this.remesh(c);
    }

    // 3) unload far chunks (occasionally)
    if (this.frames % 60 === 0) {
      const limit = (R + 3) * (R + 3);
      for (const c of [...this.world.chunks.values()]) {
        const dx = c.cx - pcx, dz = c.cz - pcz;
        if (dx * dx + dz * dz > limit) {
          this.disposeChunkMeshes(c);
          this.world.unloadChunk(c.cx, c.cz);
        }
      }
    }
  }

  // ---------------- interaction ----------------

  private raycast(): Target | null {
    const eye = this.player.eye;
    const d = this.player.direction();
    const maxDist = this.player.creative ? REACH_CREATIVE : REACH_SURVIVAL;
    let x = Math.floor(eye.x), y = Math.floor(eye.y), z = Math.floor(eye.z);
    const stepX = Math.sign(d.x), stepY = Math.sign(d.y), stepZ = Math.sign(d.z);
    const tDeltaX = d.x !== 0 ? Math.abs(1 / d.x) : Infinity;
    const tDeltaY = d.y !== 0 ? Math.abs(1 / d.y) : Infinity;
    const tDeltaZ = d.z !== 0 ? Math.abs(1 / d.z) : Infinity;
    let tMaxX = d.x > 0 ? (x + 1 - eye.x) * tDeltaX : d.x < 0 ? (eye.x - x) * tDeltaX : Infinity;
    let tMaxY = d.y > 0 ? (y + 1 - eye.y) * tDeltaY : d.y < 0 ? (eye.y - y) * tDeltaY : Infinity;
    let tMaxZ = d.z > 0 ? (z + 1 - eye.z) * tDeltaZ : d.z < 0 ? (eye.z - z) * tDeltaZ : Infinity;
    let nx = 0, ny = 0, nz = 0;
    let t = 0;
    for (let i = 0; i < 64 && t <= maxDist; i++) {
      const id = this.world.getBlock(x, y, z);
      if (id !== B.AIR && BLOCKS[id].model !== "liquid" && i > 0) return { x, y, z, nx, ny, nz };
      if (i === 0 && id !== B.AIR && BLOCKS[id].model !== "liquid") return { x, y, z, nx: 0, ny: 1, nz: 0 };
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
      }
    }
    return null;
  }

  /** seconds needed to break a block with the held item (Infinity = never) */
  breakTime(id: number): { time: number; drops: boolean; usesTool: boolean } {
    const def = BLOCKS[id];
    if (def.unbreakable) return { time: Infinity, drops: false, usesTool: false };
    if (this.player.creative) return { time: 0, drops: false, usesTool: false };
    const held = this.inventory.held;
    const tool = held ? ITEMS[held.id]?.tool : undefined;
    const tier = tool && tool.kind === "pickaxe" ? tool.tier : 0;
    const canDrop = def.minTier === 0 || (def.tool === "pickaxe" ? tier >= def.minTier : true);
    let speed = 1;
    if (tool && def.tool === tool.kind) speed = tool.speed;
    let time = def.hardness * (canDrop ? 1.5 : 5) / speed;
    if (def.hardness === 0) time = 0.05;
    if (this.player.inWater || this.player.headInWater) time *= this.player.headInWater ? 5 : 1.5;
    if (!this.player.onGround && !this.player.flying && !this.player.inWater) time *= 3;
    return { time, drops: canDrop, usesTool: !!tool && def.hardness > 0 };
  }

  private updateBreaking(dt: number) {
    this.breakCooldown = Math.max(0, this.breakCooldown - dt);
    const t = this.target;
    if (!this.mouseDown[0] || !t) {
      this.breakProgress = 0;
      this.crackMesh.visible = false;
      return;
    }
    const key = `${t.x},${t.y},${t.z}`;
    if (key !== this.breakingKey) {
      this.breakingKey = key;
      this.breakProgress = 0;
    }
    const id = this.world.getBlock(t.x, t.y, t.z);
    const info = this.breakTime(id);
    if (!isFinite(info.time)) {
      this.breakProgress = 0;
      this.crackMesh.visible = false;
      return;
    }
    if (this.swing >= 1) this.swing = 0; // keep swinging while mining
    if (this.player.creative) {
      if (this.breakCooldown <= 0) {
        this.breakBlock(t);
        this.breakCooldown = 0.2;
        this.swing = 0;
      }
      return;
    }
    this.breakProgress += dt / Math.max(0.05, info.time);
    this.digSoundTimer -= dt;
    if (this.digSoundTimer <= 0) {
      this.digSoundTimer = 0.22;
      this.audio.play("dig", BLOCKS[id].sound);
      this.particles.burst(t.x, t.y, t.z, id, 2, this.brightnessAt(t.x + t.nx, t.y + t.ny, t.z + t.nz), [t.nx, t.ny, t.nz]);
    }
    if (this.breakProgress >= 1) {
      this.breakBlock(t);
      this.breakProgress = 0;
      this.breakCooldown = 0.1;
      this.crackMesh.visible = false;
      return;
    }
    const stage = Math.min(7, Math.floor(this.breakProgress * 8));
    if (this.crackMesh.userData.stage !== stage) {
      this.crackMesh.geometry.dispose();
      this.crackMesh.geometry = this.crackGeometry(stage);
      this.crackMesh.userData.stage = stage;
    }
    this.crackMesh.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
    this.crackMesh.visible = true;
  }

  private brightnessAt(x: number, y: number, z: number) {
    const l = this.world.getLight(x, y, z);
    return Math.max(0.15, Math.max(LIGHT_CURVE[l >> 4] * this.uniforms.uSun.value, LIGHT_CURVE[l & 15]));
  }

  private breakBlock(t: Target) {
    const id = this.world.getBlock(t.x, t.y, t.z);
    if (id === B.AIR) return;
    const def = BLOCKS[id];
    if (def.unbreakable) return;
    const info = this.breakTime(id);
    this.world.setBlock(t.x, t.y, t.z, B.AIR);
    this.particles.burst(t.x, t.y, t.z, id, 22, this.brightnessAt(t.x + t.nx, t.y + t.ny, t.z + t.nz));
    this.audio.play("break", def.sound);
    this.stats.blocksMined++;
    this.swing = 0;
    if (!this.player.creative) {
      if (info.drops && def.drop !== null && Math.random() < def.dropChance) {
        const n = def.dropCount[0] + Math.floor(Math.random() * (def.dropCount[1] - def.dropCount[0] + 1));
        if (n > 0) this.drops.spawn(makeStack(def.drop, n), t.x + 0.5, t.y + 0.3, t.z + 0.5);
      }
      if (info.usesTool && this.inventory.damageHeld()) {
        this.audio.play("toolbreak");
        this.toast("Your tool broke!");
      }
    }
    // pop plants sitting on top
    const above = this.world.getBlock(t.x, t.y + 1, t.z);
    if (above !== B.AIR && BLOCKS[above].model === "cross") {
      this.world.setBlock(t.x, t.y + 1, t.z, B.AIR);
      const adef = BLOCKS[above];
      if (!this.player.creative && adef.drop !== null && Math.random() < adef.dropChance) this.drops.spawn(makeStack(adef.drop, 1), t.x + 0.5, t.y + 1.2, t.z + 0.5);
    }
    this.notify();
  }

  private useItem() {
    const held = this.inventory.held;
    const t = this.target;
    this.placeTimer = 0.25;
    // interact with stations
    if (t && !this.player.sneaking) {
      const tb = this.world.getBlock(t.x, t.y, t.z);
      if (tb === B.CRAFTING_TABLE || tb === B.FURNACE) {
        this.openInventory();
        return;
      }
    }
    if (!held) return;
    const idef = ITEMS[held.id];
    if (idef?.food) {
      if (this.player.health < this.player.maxHealth) {
        this.player.heal(idef.food);
        if (!this.player.creative) this.inventory.consumeHeld();
        this.audio.play("eat");
        this.swing = 0;
        this.notify();
      }
      return;
    }
    if (!t || !isBlock(held.id)) return;
    const targetDef = BLOCKS[this.world.getBlock(t.x, t.y, t.z)];
    let px = t.x + t.nx, py = t.y + t.ny, pz = t.z + t.nz;
    if (targetDef.replaceable) {
      px = t.x; py = t.y; pz = t.z;
    }
    if (py < 0 || py >= HEIGHT) return;
    const existing = BLOCKS[this.world.getBlock(px, py, pz)];
    if (!existing.replaceable) return;
    const def = BLOCKS[held.id];
    if (def.solid && this.intersectsPlayer(px, py, pz)) return;
    if (def.model === "cross" && def.id !== B.TORCH && !BLOCKS[this.world.getBlock(px, py - 1, pz)].solid) return;
    // torches need an adjacent solid block
    if (def.id === B.TORCH) {
      let ok = false;
      for (const [dx, dy, dz] of [[0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) if (BLOCKS[this.world.getBlock(px + dx, py + dy, pz + dz)].opaque) ok = true;
      if (!ok) return;
    }
    if (!this.world.hasChunk(px >> 4, pz >> 4)) return;
    this.world.setBlock(px, py, pz, held.id);
    if (!this.player.creative) this.inventory.consumeHeld();
    this.audio.play("place", def.sound);
    this.stats.blocksPlaced++;
    this.swing = 0;
    this.placeTimer = 0.25;
    this.notify();
  }

  private intersectsPlayer(bx: number, by: number, bz: number): boolean {
    const p = this.player.pos, hw = this.player.width / 2;
    return p.x + hw > bx && p.x - hw < bx + 1 && p.y + this.player.height > by && p.y < by + 1 && p.z + hw > bz && p.z - hw < bz + 1;
  }

  private pickBlock() {
    const t = this.target;
    if (!t) return;
    const id = this.world.getBlock(t.x, t.y, t.z);
    if (id === B.AIR) return;
    let want = id;
    if (!this.player.creative) {
      const i = this.inventory.findHotbar(want);
      if (i >= 0) this.selectSlot(i);
      return;
    }
    if (want === B.BEDROCK) want = B.STONE;
    const i = this.inventory.findHotbar(want);
    if (i >= 0) this.selectSlot(i);
    else {
      const empty = this.inventory.firstEmptyHotbar();
      const dst = empty >= 0 ? empty : this.inventory.selected;
      this.inventory.slots[dst] = makeStack(want, 1);
      this.inventory.touch();
      this.selectSlot(dst);
    }
    this.notify();
  }

  private tryPickup = (s: Stack): boolean => {
    const left = this.inventory.add(s.id, s.count, s.durability);
    if (left === s.count) return false;
    this.audio.play("pickup");
    s.count = left;
    this.notify();
    return left === 0;
  };

  private onPlayerEvent(e: string, data?: number) {
    const groundBlock = this.world.getBlock(Math.floor(this.player.pos.x), Math.floor(this.player.pos.y - 0.1), Math.floor(this.player.pos.z));
    const snd: SoundKind = BLOCKS[groundBlock]?.sound ?? "stone";
    switch (e) {
      case "step":
        this.audio.play("step", snd);
        break;
      case "jump":
        this.audio.play("jump");
        break;
      case "land":
        this.audio.play("land", snd, data && data > 0 ? 1.4 : 0.8);
        break;
      case "splash":
        this.audio.play("splash");
        break;
      case "hurt":
        this.audio.play("hurt");
        this.hurtFlash = 1;
        this.notify();
        break;
      case "death": {
        this.stats.deaths++;
        if (!this.player.creative) {
          for (let i = 0; i < this.inventory.slots.length; i++) {
            const s = this.inventory.slots[i];
            if (s) this.drops.spawn(s, this.player.pos.x, this.player.pos.y + 0.8, this.player.pos.z, undefined, 2);
          }
          this.inventory.clear();
        }
        this.cursorStack = null;
        this.screen = "dead";
        this.mouseDown = [false, false, false];
        this.keys.clear();
        if (this.pointerLocked) document.exitPointerLock();
        this.save(false);
        this.notify();
        break;
      }
    }
  }

  // ---------------- main loop ----------------

  private frame(dt: number) {
    this.frames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.frames / this.fpsTimer);
      this.frames = 0;
      this.fpsTimer = 0;
    }
    const playing = this.screen === "none" && !this.loading;
    if (!this.loading) {
      this.stats.playTime += dt;
      this.time = (this.time + dt / DAY_LENGTH) % 1;
    }

    // input -> movement
    const input: MoveInput = {
      forward: playing && this.keys.has("KeyW"),
      back: playing && this.keys.has("KeyS"),
      left: playing && this.keys.has("KeyA"),
      right: playing && this.keys.has("KeyD"),
      jump: playing && this.keys.has("Space"),
      sneak: playing && (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")),
      sprint: playing && (this.keys.has("ControlLeft") || this.keys.has("ControlRight") || this.sprintToggle),
    };
    if (this.screen !== "dead" && this.screen !== "pause" && !this.loading) {
      const steps = Math.max(1, Math.ceil(dt / 0.02));
      const sdt = dt / steps;
      for (let i = 0; i < steps; i++) this.player.update(sdt, input, this.world);
      if (this.player.pos.y > HEIGHT + 60) this.player.pos.y = HEIGHT + 60;
      // stuck inside a block (e.g. sand placed on head) -> nudge up
      if (this.player.isStuck(this.world) && this.frames % 10 === 0) this.player.pos.y += 0.1;
    }
    // slow natural regeneration
    if (!this.player.creative && !this.player.dead) {
      this.regenTimer += dt;
      if (this.regenTimer > 8) {
        this.regenTimer = 0;
        if (this.player.health < this.player.maxHealth) this.player.heal(1);
      }
    }

    // chunk streaming
    this.streamChunks(this.loading ? 0 : 7);

    // targeting & interaction
    if (playing) {
      this.target = this.raycast();
      this.updateBreaking(dt);
      this.placeTimer -= dt;
      if (this.mouseDown[2] && this.placeTimer <= 0) this.useItem();
    } else {
      this.target = null;
      this.crackMesh.visible = false;
    }
    if (this.target) {
      this.selectionBox.visible = true;
      this.selectionBox.position.set(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5);
    } else this.selectionBox.visible = false;

    if (this.screen === "inventory") {
      this.stationTimer += dt;
      if (this.stationTimer > 0.5) {
        this.stationTimer = 0;
        const s = this.nearStations();
        if (s.table !== this.station.table || s.furnace !== this.station.furnace) {
          this.station = s;
          this.notify();
        }
      }
    }

    // entities
    this.drops.sunLight = this.uniforms.uSun.value;
    this.drops.update(dt, this.world, this.player.pos, this.tryPickup, this.stats.playTime);
    this.particles.update(dt, this.world);

    // camera
    this.updateCamera(dt, input);
    this.updateSky();
    this.updateHand(dt);

    // audio
    this.audio.update(dt);
    this.audio.setUnderwater(this.player.headInWater);
    this.audio.setNight(Math.sin(this.time * Math.PI * 2) < -0.1);
    const ambient = 0.6 + Math.max(0, (this.player.pos.y - 70) / 60);
    this.audio.setAmbientLevel(this.player.headInWater ? 0.1 : ambient);

    // render
    this.renderer.info.reset();
    this.renderer.clear();
    this.camera.updateMatrixWorld();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.handScene, this.camera);

    // auto-save & UI ticks
    this.saveTimer += dt;
    if (this.saveTimer > 45 && !this.loading) this.save(false);
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);
    const now = performance.now();
    if (this.toasts.length && this.toasts[0].until < now) {
      this.toasts = this.toasts.filter((t) => t.until >= now);
      this.notify();
    }
    this.uiTimer += dt;
    if (this.uiTimer > 0.1) {
      this.uiTimer = 0;
      this.notify();
    }
  }

  private updateCamera(dt: number, input: MoveInput) {
    const p = this.player;
    const targetFov = this.fov + (p.sprinting && !p.flying ? 8 : 0) + (p.flying && p.sprinting ? 12 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 10);
    this.camera.updateProjectionMatrix();
    let bobX = 0, bobY = 0;
    const moving = (input.forward || input.back || input.left || input.right) && p.onGround && !p.inWater;
    if (this.settings.viewBobbing && moving) {
      this.bobPhase += dt * (p.sprinting ? 11 : 8);
      bobX = Math.sin(this.bobPhase) * 0.035;
      bobY = Math.abs(Math.cos(this.bobPhase)) * 0.045;
    } else this.bobPhase = 0;
    this.camera.position.set(p.pos.x + Math.cos(p.yaw) * bobX, p.pos.y + p.eyeHeight + bobY, p.pos.z - Math.sin(p.yaw) * bobX);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = p.yaw;
    this.camera.rotation.x = p.pitch;
    this.camera.rotation.z = this.hurtFlash > 0 ? Math.sin(this.hurtFlash * 12) * 0.02 : 0;
  }

  private updateSky() {
    const ang = this.time * Math.PI * 2;
    const elev = Math.sin(ang);
    const daylight = THREE.MathUtils.smoothstep(elev, -0.12, 0.25);
    const sun = 0.2 + 0.8 * daylight;
    this.uniforms.uSun.value = sun;
    // sky colours (sRGB)
    const night = new THREE.Color(0x0a0e22), dusk = new THREE.Color(0xf5905a), day = new THREE.Color(0x7fb7f5);
    let sky: THREE.Color;
    if (elev > 0.25) sky = day;
    else if (elev > 0) sky = dusk.clone().lerp(day, elev / 0.25);
    else if (elev > -0.2) sky = night.clone().lerp(dusk, (elev + 0.2) / 0.2);
    else sky = night;
    const duskAmount = Math.max(0, 1 - Math.abs(elev) / 0.2);
    this.uniforms.uSkyTint.value.set(1 - duskAmount * 0.1, 1 - duskAmount * 0.25, 1 - duskAmount * 0.35).lerp(new THREE.Color(0.75, 0.8, 1.0), 1 - daylight);
    const underwater = this.player.headInWater;
    if (underwater) {
      const wc = new THREE.Color(0x1c4fa8).multiplyScalar(0.25 + 0.75 * sun);
      this.renderer.setClearColor(wc);
      this.uniforms.uFogColor.value.copy(wc);
      this.uniforms.uFogNear.value = 2;
      this.uniforms.uFogFar.value = 22;
    } else {
      this.renderer.setClearColor(sky);
      this.uniforms.uFogColor.value.copy(sky).lerp(new THREE.Color(1, 1, 1), 0.12 * daylight);
      const viewDist = this.settings.renderDistance * CHUNK;
      this.uniforms.uFogFar.value = viewDist - 10;
      this.uniforms.uFogNear.value = Math.max(8, (viewDist - 10) * 0.55);
    }
    // sun & moon & stars follow the camera
    this.skyGroup.position.copy(this.camera.position);
    const dist = 1000;
    const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.25).normalize();
    this.sunMesh.position.copy(sunDir).multiplyScalar(dist);
    this.sunMesh.scale.setScalar(140);
    this.sunMesh.lookAt(this.camera.position);
    this.moonMesh.position.copy(sunDir).multiplyScalar(-dist);
    this.moonMesh.scale.setScalar(70);
    this.moonMesh.lookAt(this.camera.position);
    this.starsMat.opacity = (1 - daylight) * 0.9;
    this.stars.visible = this.starsMat.opacity > 0.02;
    this.stars.rotation.z = ang;
    this.sunMesh.visible = this.moonMesh.visible = !underwater;
    // clouds
    this.clouds.position.x = this.camera.position.x;
    this.clouds.position.z = this.camera.position.z;
    const drift = this.stats.playTime * 0.6;
    this.cloudTex.offset.set((this.camera.position.x + drift) / 1024, -(this.camera.position.z) / 1024);
    (this.clouds.material as THREE.MeshBasicMaterial).color.setScalar(0.35 + 0.65 * sun);
    (this.clouds.material as THREE.MeshBasicMaterial).opacity = underwater ? 0 : 0.8;
  }

  private updateHand(dt: number) {
    const held = this.inventory.held;
    const id = held ? held.id : -1;
    if (id !== this.handItemId) {
      this.handItemId = id;
      if (this.handMesh) {
        this.handGroup.remove(this.handMesh);
        this.handMesh = null;
      }
      if (id >= 0) {
        const geo = itemGeometry(id, this.atlas);
        this.handMesh = new THREE.Mesh(geo, this.handMat);
        const block = isBlock(id) && BLOCKS[id].model !== "cross";
        if (block) {
          this.handMesh.scale.setScalar(1.6);
          this.handMesh.rotation.set(0.15, -0.6, 0);
        } else {
          this.handMesh.scale.setScalar(1.7);
          this.handMesh.rotation.set(0.1, -0.35, 0.65);
        }
        this.handGroup.add(this.handMesh);
      }
    }
    this.swing = Math.min(1, this.swing + dt * 3.2);
    const s = Math.sin(this.swing * Math.PI);
    const bob = this.settings.viewBobbing ? Math.sin(this.bobPhase) * 0.02 : 0;
    this.handGroup.position.set(0.62 + bob - s * 0.25, -0.5 + Math.abs(bob) - s * 0.35, -0.9 + s * 0.15);
    this.handGroup.rotation.set(-s * 1.1, s * 0.5, 0);
    this.handGroup.visible = this.screen !== "dead";
    const p = this.player.pos;
    const l = this.world.getLight(Math.floor(p.x), Math.floor(p.y + this.player.eyeHeight), Math.floor(p.z));
    const b = Math.max(0.12, Math.max(LIGHT_CURVE[l >> 4] * this.uniforms.uSun.value, LIGHT_CURVE[l & 15]));
    this.handMat.color.setScalar(b);
  }

  // ---------------- debug info ----------------

  debugInfo(): string[] {
    const p = this.player.pos;
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    const l = this.world.getLight(bx, by, bz);
    const info = this.renderer.info.render;
    const hours = (6 + this.time * 24) % 24;
    return [
      `VoxelCraft  ${this.fps} fps`,
      `XYZ: ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,
      `Block: ${bx} ${by} ${bz}   Chunk: ${bx >> 4} ${bz >> 4}`,
      `Facing: ${["S", "W", "N", "E"][Math.round(((-this.player.yaw / (Math.PI / 2)) % 4 + 4) % 4) % 4]} (yaw ${((this.player.yaw * 180) / Math.PI).toFixed(1)})`,
      `Biome: ${BIOME_NAMES[this.world.biomeAt(bx, bz)]}`,
      `Light: sky ${l >> 4} block ${l & 15}`,
      `Chunks: ${this.world.chunks.size} loaded, ${this.world.dirty.size} dirty`,
      `Draw calls: ${info.calls}  Tris: ${info.triangles}`,
      `Drops: ${this.drops.drops.length}  Time: ${Math.floor(hours).toString().padStart(2, "0")}:${Math.floor((hours % 1) * 60).toString().padStart(2, "0")}`,
      `Target: ${this.target ? itemName(this.world.getBlock(this.target.x, this.target.y, this.target.z)) : "-"}`,
      `Seed: ${this.meta.seed}`,
    ];
  }

  clockString(): string {
    const hours = (6 + this.time * 24) % 24;
    return `${Math.floor(hours).toString().padStart(2, "0")}:${Math.floor((hours % 1) * 60).toString().padStart(2, "0")}`;
  }
}
