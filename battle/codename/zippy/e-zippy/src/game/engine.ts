import * as THREE from 'three';
import { World, buildChunkMesh, createChunkMaterials } from './world';
import { B, BLOCKS, isSolid, ITEMS, CHUNK, HEIGHT, SEA } from './blocks';
import { SoundEngine } from './audio';
import { spawnMob, updateMob, Mob, MobKind } from './mobs';
import { createCrackTexture } from './textures';
import { clamp, lerp } from './noise';

export interface GameState {
  health: number; hunger: number; xp: number; level: number;
  inventory: Record<string, number>; // item id or b<blockid>
  hotbar: (string | null)[];
  selected: number;
  pos: [number, number, number]; yaw: number; pitch: number;
  time: number; // 0..24000
  seed: number;
  fly: boolean;
  weather: 'clear' | 'rain' | 'storm';
  kills: number; blocksMined: number; blocksPlaced: number; distance: number;
  deaths: number;
}

export interface EngineCallbacks {
  onState: (s: Partial<GameState>) => void;
  onToast: (msg: string, icon?: string) => void;
  onDeath: () => void;
  onPickup: (item: string, count: number) => void;
}

const RENDER_DIST = 6;

export class GameEngine {
  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  world!: World;
  sound = new SoundEngine();
  keys = new Set<string>();
  yaw = 0; pitch = 0;
  pos = new THREE.Vector3(8, 40, 8);
  vel = new THREE.Vector3();
  onGround = false;
  fly = false;
  health = 20; hunger = 20; xp = 0; level = 0;
  inventory: Record<string, number> = {};
  hotbar: (string | null)[] = Array(9).fill(null);
  selected = 0;
  time = 6000; // morning
  weather: 'clear' | 'rain' | 'storm' = 'clear';
  weatherTimer = 0;
  mobs: Mob[] = [];
  particles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number }[] = [];
  pickups: { mesh: THREE.Mesh; item: string; count: number; vel: THREE.Vector3; life: number }[] = [];
  highlight!: THREE.LineSegments;
  crackMesh!: THREE.Mesh;
  breaking: { x: number; y: number; z: number; progress: number; need: number } | null = null;
  mouseDown = false; rightDown = false;
  lastStep = 0; stepDist = 0;
  inWater = false; headInWater = false;
  airTicks = 0;
  fallStartY = 0; wasOnGround = true;
  sun!: THREE.DirectionalLight; moon!: THREE.DirectionalLight; ambient!: THREE.AmbientLight; hemi!: THREE.HemisphereLight;
  sky!: THREE.Mesh; stars!: THREE.Points; clouds!: THREE.Group; rain!: THREE.Points;
  cloudOffset = 0;
  mobSpawnTimer = 0;
  saveTimer = 0;
  kills = 0; blocksMined = 0; blocksPlaced = 0; distance = 0; deaths = 0;
  cb: EngineCallbacks;
  disposed = false;
  fov = 75; sensitivity = 0.0022; renderDist = RENDER_DIST;
  paused = false;
  pointerLocked = false;
  lastPos = new THREE.Vector3();
  hungerTimer = 0;
  regenTimer = 0;
  tntTimers: { x: number; y: number; z: number; t: number }[] = [];
  arrows: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  bowCooldown = 0;
  elytra = false;
  private raf = 0;
  private lastTime = 0;

  constructor(private container: HTMLElement, seed: number, saved: Partial<GameState> | null, cb: EngineCallbacks) {
    this.cb = cb;
    this.initThree();
    this.world = new World(seed);
    if (saved?.seed === seed) {
      // modified blocks restored via localStorage in App
    }
    this.setupLightsSky();
    this.setupPlayer(saved);
    this.bindInput();
    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    this.updateChunks(true);
  }

  initThree() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = false;
    this.container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x87ceeb, 40, 140);
    this.camera = new THREE.PerspectiveCamera(this.fov, this.container.clientWidth / this.container.clientHeight, 0.1, 400);
    this.camera.rotation.order = 'YXZ';

    const { mat, waterMat } = createChunkMaterials();
    (this as unknown as { _mat: THREE.Material })._mat = mat;
    (this as unknown as { _waterMat: THREE.Material })._waterMat = waterMat;

    // highlight box
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
    this.highlight = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }));
    this.highlight.visible = false;
    this.scene.add(this.highlight);
    // crack overlay
    const crackTex = createCrackTexture();
    this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, opacity: 0.9, depthWrite: false }));
    this.crackMesh.visible = false;
    this.scene.add(this.crackMesh);

    // hand / held item viewmodel
    this.handGroup = new THREE.Group();
    this.camera.add(this.handGroup);
    this.scene.add(this.camera);
    this.updateHand();
  }
  handGroup!: THREE.Group;
  heldMesh: THREE.Mesh | null = null;

  setupLightsSky() {
    this.ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a6a4a, 0.5);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2cc, 1.2);
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.moon = new THREE.DirectionalLight(0x8899ff, 0.3);
    this.scene.add(this.moon); this.scene.add(this.moon.target);

    // sky dome
    const skyGeo = new THREE.SphereGeometry(300, 16, 12);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { topColor: { value: new THREE.Color(0x3a7bd5) }, bottomColor: { value: new THREE.Color(0xbfe3ff) }, offset: { value: 33 }, exponent: { value: 0.6 } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vW; void main(){ float h = normalize(vW+vec3(0.0,offset,0.0)).y; gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h,0.0), exponent),0.0)),1.0); }`,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
    (this as unknown as { _skyMat: THREE.ShaderMaterial })._skyMat = skyMat;

    // stars
    const starGeo = new THREE.BufferGeometry();
    const starPos: number[] = [];
    for (let i = 0; i < 800; i++) {
      const r = 280, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      starPos.push(r * Math.sin(ph) * Math.cos(th), Math.abs(r * Math.cos(ph)) + 10, r * Math.sin(ph) * Math.sin(th));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    // sun & moon sprites
    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffe98a, fog: false }));
    this.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 12), new THREE.MeshBasicMaterial({ color: 0xdde8ff, fog: false }));
    this.scene.add(this.sunMesh); this.scene.add(this.moonMesh);

    // clouds
    this.clouds = new THREE.Group();
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
    for (let i = 0; i < 40; i++) {
      const w = 8 + Math.random() * 20, d = 6 + Math.random() * 14;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), cloudMat);
      m.position.set((Math.random() - 0.5) * 400, 78 + Math.random() * 6, (Math.random() - 0.5) * 400);
      this.clouds.add(m);
    }
    this.scene.add(this.clouds);

    // rain
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) { rainPos[i * 3] = (Math.random() - 0.5) * 60; rainPos[i * 3 + 1] = Math.random() * 30; rainPos[i * 3 + 2] = (Math.random() - 0.5) * 60; }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    this.rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaaccee, size: 0.12, transparent: true, opacity: 0.7 }));
    this.rain.visible = false;
    this.scene.add(this.rain);
  }
  sunMesh!: THREE.Mesh; moonMesh!: THREE.Mesh;

  setupPlayer(saved: Partial<GameState> | null) {
    if (saved?.pos) {
      this.pos.set(saved.pos[0], saved.pos[1], saved.pos[2]);
      this.yaw = saved.yaw ?? 0; this.pitch = saved.pitch ?? 0;
      this.health = saved.health ?? 20; this.hunger = saved.hunger ?? 20;
      this.xp = saved.xp ?? 0; this.level = saved.level ?? 0;
      this.inventory = { ...(saved.inventory ?? {}) };
      this.hotbar = [...(saved.hotbar ?? Array(9).fill(null))];
      this.selected = saved.selected ?? 0;
      this.time = saved.time ?? 6000;
      this.fly = saved.fly ?? false;
      this.weather = (saved.weather as 'clear' | 'rain' | 'storm') ?? 'clear';
      this.kills = saved.kills ?? 0; this.blocksMined = saved.blocksMined ?? 0; this.blocksPlaced = saved.blocksPlaced ?? 0;
      this.distance = saved.distance ?? 0; this.deaths = saved.deaths ?? 0;
    } else {
      // starter kit
      this.hotbar = ['b1', 'b3', 'b5', 'b6', 'b9', 'b4', 'b20', 'wood_pick', 'wood_axe'];
      this.inventory = { b1: 32, b3: 16, b5: 16, b6: 8, b9: 8, b4: 16, b20: 4, wood_pick: 1, wood_axe: 1, stick: 8, apple: 3, bread: 2 };
      // spawn: find dry land near origin (spiral search)
      let sx = 8, sz = 8, sh = this.world.getHeightRaw(sx, sz);
      outer: for (let r = 0; r < 120; r += 8) {
        for (let a = 0; a < 8; a++) {
          const x = 8 + Math.cos((a / 8) * Math.PI * 2) * r;
          const z = 8 + Math.sin((a / 8) * Math.PI * 2) * r;
          const h = this.world.getHeightRaw(Math.floor(x), Math.floor(z));
          if (h > SEA + 1 && h < 50) { sx = Math.floor(x); sz = Math.floor(z); sh = h; break outer; }
        }
      }
      this.pos.set(sx + 0.5, sh + 2, sz + 0.5);
    }
    this.lastPos.copy(this.pos);
    this.emitState();
  }

  emitState() {
    this.cb.onState({
      health: Math.round(this.health), hunger: Math.round(this.hunger), xp: this.xp, level: this.level,
      inventory: { ...this.inventory }, hotbar: [...this.hotbar], selected: this.selected,
      pos: [this.pos.x, this.pos.y, this.pos.z], yaw: this.yaw, pitch: this.pitch,
      time: Math.floor(this.time), seed: this.world.seed, fly: this.fly, weather: this.weather,
      kills: this.kills, blocksMined: this.blocksMined, blocksPlaced: this.blocksPlaced, distance: Math.floor(this.distance), deaths: this.deaths,
    });
  }

  // ---------- Input ----------
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space') e.preventDefault();
    this.keys.add(e.code);
    if (e.code === 'KeyF') { this.fly = !this.fly; this.vel.y = 0; this.cb.onToast(this.fly ? 'Fly mode ON' : 'Fly mode OFF', '🕊️'); this.emitState(); }
    if (e.code === 'Digit1') this.selectSlot(0);
    if (e.code === 'Digit2') this.selectSlot(1);
    if (e.code === 'Digit3') this.selectSlot(2);
    if (e.code === 'Digit4') this.selectSlot(3);
    if (e.code === 'Digit5') this.selectSlot(4);
    if (e.code === 'Digit6') this.selectSlot(5);
    if (e.code === 'Digit7') this.selectSlot(6);
    if (e.code === 'Digit8') this.selectSlot(7);
    if (e.code === 'Digit9') this.selectSlot(8);
    if (e.code === 'KeyQ') this.dropSelected();
    if (e.code === 'KeyR') this.eatSelected();
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked || this.paused) return;
    this.yaw -= e.movementX * this.sensitivity;
    this.pitch -= e.movementY * this.sensitivity;
    this.pitch = clamp(this.pitch, -1.55, 1.55);
  };
  private onMouseDown = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    if (e.button === 0) { this.mouseDown = true; this.tryBreakStart(); }
    if (e.button === 2) { this.rightDown = true; this.tryPlace(); }
    if (e.button === 1) { e.preventDefault(); this.pickBlock(); }
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) { this.mouseDown = false; this.breaking = null; this.crackMesh.visible = false; }
    if (e.button === 2) this.rightDown = false;
  };
  private onWheel = (e: WheelEvent) => {
    if (!this.pointerLocked) return;
    const d = e.deltaY > 0 ? 1 : -1;
    this.selectSlot((this.selected + d + 9) % 9);
  };
  private onResize = () => {
    if (!this.container.clientWidth) return;
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  };
  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    if (!this.pointerLocked) { this.mouseDown = false; this.rightDown = false; this.breaking = null; this.crackMesh.visible = false; }
  };
  private onContextMenu = (e: Event) => e.preventDefault();

  bindInput() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  lockPointer() {
    this.sound.ensure();
    this.renderer.domElement.requestPointerLock();
  }
  unlockPointer() { document.exitPointerLock(); }

  selectSlot(i: number) {
    this.selected = i;
    this.updateHand();
    this.emitState();
  }

  selectedItem(): string | null { return this.hotbar[this.selected]; }

  updateHand() {
    if (this.heldMesh) { this.handGroup.remove(this.heldMesh); this.heldMesh.geometry.dispose(); (this.heldMesh.material as THREE.Material).dispose(); this.heldMesh = null; }
    const item = this.selectedItem();
    if (!item) return;
    let color = 0xffffff;
    if (item.startsWith('b')) {
      const b = BLOCKS[parseInt(item.slice(1))];
      color = b?.color ?? 0xffffff;
    } else {
      const def = ITEMS[item];
      color = def ? parseInt(def.color.slice(1), 16) : 0xffffff;
    }
    const geo = item.startsWith('b') ? new THREE.BoxGeometry(0.22, 0.22, 0.22) : new THREE.BoxGeometry(0.08, 0.35, 0.08);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
    mesh.position.set(0.45, -0.42, -0.7);
    mesh.rotation.set(0.3, 0.5, 0.1);
    this.handGroup.add(mesh);
    this.heldMesh = mesh;
  }

  // ---------- Voxel raycast (DDA) ----------
  raycast(maxDist = 6): { x: number; y: number; z: number; nx: number; ny: number; nz: number; block: number; dist: number } | null {
    const origin = new THREE.Vector3(this.pos.x, this.pos.y + 1.62, this.pos.z);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
    let tMaxX = dir.x !== 0 ? ((dir.x > 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX) : Infinity;
    let tMaxY = dir.y !== 0 ? ((dir.y > 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY) : Infinity;
    let tMaxZ = dir.z !== 0 ? ((dir.z > 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ) : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let i = 0; i < 128; i++) {
      const b = this.world.getBlock(x, y, z);
      if (b !== 0 && b !== B.Water && b !== B.Lava) return { x, y, z, nx, ny, nz, block: b, dist: t };
      if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0; }
      else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0; }
      else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ; }
      if (t > maxDist) return null;
    }
    return null;
  }

  raycastLiquid(maxDist = 6): { x: number; y: number; z: number; nx: number; ny: number; nz: number; block: number; dist: number } | null {
    const origin = new THREE.Vector3(this.pos.x, this.pos.y + 1.62, this.pos.z);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
    let tMaxX = dir.x !== 0 ? ((dir.x > 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX) : Infinity;
    let tMaxY = dir.y !== 0 ? ((dir.y > 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY) : Infinity;
    let tMaxZ = dir.z !== 0 ? ((dir.z > 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ) : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let i = 0; i < 128; i++) {
      const b = this.world.getBlock(x, y, z);
      if (b !== 0) return { x, y, z, nx, ny, nz, block: b, dist: t };
      if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0; }
      else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0; }
      else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ; }
      if (t > maxDist) return null;
    }
    return null;
  }

  toolMultiplier(blockId: number): number {
    const item = this.selectedItem();
    if (!item || item.startsWith('b')) return 1;
    const def = ITEMS[item];
    if (!def?.tool) return 1;
    const blockTool = BLOCKS[blockId]?.tool;
    if (def.tool === blockTool) return def.power;
    if (def.tool === 'sword' && blockTool === 'none') return def.power;
    return 1;
  }

  tryBreakStart() {
    const hit = this.raycast();
    if (!hit) return;
    const def = BLOCKS[hit.block];
    if (!def || def.hardness === Infinity) return;
    if (hit.block === B.TNT) { this.igniteTNT(hit.x, hit.y, hit.z); return; }
    this.breaking = { x: hit.x, y: hit.y, z: hit.z, progress: 0, need: def.hardness / this.toolMultiplier(hit.block) };
    this.crackMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    this.crackMesh.visible = true;
  }

  breakBlock(x: number, y: number, z: number) {
    const b = this.world.getBlock(x, y, z);
    if (b === 0) return;
    const def = BLOCKS[b];
    this.world.setBlock(x, y, z, 0);
    this.blocksMined++;
    this.sound.breakBlock();
    this.spawnBlockParticles(x, y, z, def?.color ?? 0x888888);
    // drops
    if (def?.drop && def.drop !== 0) {
      const dropId = `b${def.drop}`;
      // ores drop items
      let item = dropId;
      if (b === B.CoalOre) item = 'coal';
      else if (b === B.IronOre) item = 'iron_ingot';
      else if (b === B.GoldOre) item = 'gold_ingot';
      else if (b === B.DiamondOre) item = 'diamond';
      else if (b === B.EmeraldOre) item = 'emerald';
      else if (b === B.LapisOre) item = 'lapis';
      else if (b === B.RedstoneOre) item = 'redstone';
      else if (b === B.Grass) item = 'b2';
      else if (b === B.Leaves) {
        if (Math.random() < 0.15) item = 'apple';
        else if (Math.random() < 0.1) item = 'stick';
        else item = '';
      }
      if (item) this.spawnPickup(x + 0.5, y + 0.5, z + 0.5, item, 1);
    }
    if (def?.xp) this.addXp(def.xp);
    // TNT chain
    if (b === B.TNT) this.igniteTNT(x, y, z);
    this.emitState();
  }

  igniteTNT(x: number, y: number, z: number) {
    this.world.setBlock(x, y, z, 0);
    this.tntTimers.push({ x: x + 0.5, y: y + 0.5, z: z + 0.5, t: 1.2 });
    this.cb.onToast('TNT primed!', '🧨');
  }

  explode(cx: number, cy: number, cz: number, radius = 4) {
    this.sound.explode();
    const r2 = radius * radius;
    for (let x = Math.floor(cx - radius); x <= cx + radius; x++)
      for (let y = Math.floor(cy - radius); y <= cy + radius; y++)
        for (let z = Math.floor(cz - radius); z <= cz + radius; z++) {
          const d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 + (z + 0.5 - cz) ** 2;
          if (d2 > r2) continue;
          const b = this.world.getBlock(x, y, z);
          if (b !== 0 && b !== B.Bedrock && b !== B.Obsidian && Math.random() < 0.85) {
            if (b === B.TNT) { this.tntTimers.push({ x: x + 0.5, y: y + 0.5, z: z + 0.5, t: 0.3 + Math.random() * 0.5 }); }
            this.world.setBlock(x, y, z, 0);
          }
        }
    // damage player & mobs
    const pd = Math.hypot(this.pos.x - cx, this.pos.y + 1 - cy, this.pos.z - cz);
    if (pd < radius + 2) this.damagePlayer(Math.round((1 - pd / (radius + 2)) * 18) + 2, 'explosion');
    for (const m of this.mobs) {
      const d = Math.hypot(m.pos.x - cx, m.pos.y - cy, m.pos.z - cz);
      if (d < radius + 2) { m.health -= 20; m.hurtTimer = 0.3; if (m.health <= 0) this.killMob(m); }
    }
    this.spawnExplosionParticles(cx, cy, cz);
    this.emitState();
  }

  tryPlace() {
    const item = this.selectedItem();
    if (!item) return;
    // bucket logic uses liquid-aware raycast
    if (item === 'bucket_water' || item === 'bucket_lava' || item === 'bucket') {
      const lhit = this.raycastLiquid();
      if (lhit) this.useBucket(lhit);
      return;
    }
    const hit = this.raycast();
    if (!hit) return;
    if (item === 'bow') { this.shootArrow(); return; }
    if (!item.startsWith('b')) {
      // food / tool use
      const def = ITEMS[item];
      if (def?.food) { this.eatSelected(); return; }
      if (def?.tool === 'sword') { this.attackMob(); return; }
      return;
    }
    const blockId = parseInt(item.slice(1));
    const px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
    if (py < 0 || py >= HEIGHT) return;
    const existing = this.world.getBlock(px, py, pz);
    if (existing !== 0 && existing !== B.Water && existing !== B.Lava) return;
    // don't place inside player
    const playerMinX = Math.floor(this.pos.x - 0.3), playerMaxX = Math.floor(this.pos.x + 0.3);
    const playerMinY = Math.floor(this.pos.y), playerMaxY = Math.floor(this.pos.y + 1.8);
    const playerMinZ = Math.floor(this.pos.z - 0.3), playerMaxZ = Math.floor(this.pos.z + 0.3);
    if (px >= playerMinX && px <= playerMaxX && py >= playerMinY && py <= playerMaxY && pz >= playerMinZ && pz <= playerMaxZ) return;
    this.world.setBlock(px, py, pz, blockId);
    this.blocksPlaced++;
    this.sound.placeBlock();
    this.consumeItem(item, 1);
    if (blockId === B.TNT) { /* placed, not primed */ }
    this.emitState();
  }

  useBucket(hit: { x: number; y: number; z: number; nx: number; ny: number; nz: number }) {
    const item = this.selectedItem()!;
    if (item === 'bucket') {
      const b = this.world.getBlock(hit.x, hit.y, hit.z);
      if (b === B.Water) { this.world.setBlock(hit.x, hit.y, hit.z, 0); this.consumeItem('bucket', 1); this.addItem('bucket_water', 1); this.sound.splash(); }
      else if (b === B.Lava) { this.world.setBlock(hit.x, hit.y, hit.z, 0); this.consumeItem('bucket', 1); this.addItem('bucket_lava', 1); this.sound.splash(); }
      else {
        // place water adjacent
        const px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
        if (this.world.getBlock(px, py, pz) === 0) { this.world.setBlock(px, py, pz, B.Water); }
      }
    } else if (item === 'bucket_water' || item === 'bucket_lava') {
      const px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
      if (this.world.getBlock(px, py, pz) === 0 || this.world.getBlock(px, py, pz) === B.Water) {
        this.world.setBlock(px, py, pz, item === 'bucket_water' ? B.Water : B.Lava);
        this.consumeItem(item, 1); this.addItem('bucket', 1); this.sound.splash();
      }
    }
    this.emitState();
  }

  shootArrow() {
    if (this.bowCooldown > 0) return;
    this.bowCooldown = 0.5;
    this.sound.bowShoot();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const geo = new THREE.BoxGeometry(0.05, 0.05, 0.5);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xc8b898 }));
    mesh.position.copy(this.pos).add(new THREE.Vector3(0, 1.5, 0));
    mesh.lookAt(mesh.position.clone().add(dir));
    this.scene.add(mesh);
    this.arrows.push({ mesh, vel: dir.multiplyScalar(28), life: 3 });
    this.consumeItem('bow', 0); // bow not consumed; arrow consumed if present
    if ((this.inventory['arrow'] ?? 0) > 0) this.consumeItem('arrow', 1);
  }

  attackMob() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    let best: Mob | null = null, bestDist = 4;
    for (const m of this.mobs) {
      const to = m.pos.clone().add(new THREE.Vector3(0, 0.8, 0)).sub(this.pos.clone().add(new THREE.Vector3(0, 1.5, 0)));
      const d = to.length();
      if (d < bestDist && to.normalize().dot(dir) > 0.7) { best = m; bestDist = d; }
    }
    if (best) {
      const item = this.selectedItem();
      const power = item && !item.startsWith('b') ? (ITEMS[item]?.power ?? 1) : 1;
      const dmg = item && !item.startsWith('b') && ITEMS[item]?.tool === 'sword' ? power + 2 : 1;
      best.health -= dmg;
      best.hurtTimer = 0.3;
      this.sound.zombieHit();
      this.spawnHitParticles(best.pos);
      if (best.health <= 0) this.killMob(best);
      else {
        // knockback
        best.vel.x += dir.x * 4; best.vel.z += dir.z * 4;
      }
    }
  }

  pickBlock() {
    const hit = this.raycast();
    if (!hit) return;
    const id = `b${hit.block}`;
    this.hotbar[this.selected] = id;
    this.updateHand();
    this.emitState();
  }

  // ---------- Inventory ----------
  addItem(item: string, count: number) {
    this.inventory[item] = (this.inventory[item] ?? 0) + count;
    this.emitState();
  }
  consumeItem(item: string, count: number) {
    if (!this.inventory[item]) return;
    this.inventory[item] -= count;
    if (this.inventory[item] <= 0) delete this.inventory[item];
    // if hotbar slot empty, clear
    for (let i = 0; i < 9; i++) if (this.hotbar[i] === item && !this.inventory[item]) { /* keep slot but count 0 */ }
    this.emitState();
  }
  countItem(item: string) { return this.inventory[item] ?? 0; }

  dropSelected() {
    const item = this.selectedItem();
    if (!item) return;
    this.spawnPickup(this.pos.x, this.pos.y + 1.5, this.pos.z, item, 1);
    this.consumeItem(item, 1);
    this.emitState();
  }

  eatSelected() {
    const item = this.selectedItem();
    if (!item || item.startsWith('b')) return;
    const def = ITEMS[item];
    if (!def?.food) return;
    if (this.hunger >= 20) { this.cb.onToast('Hunger full!', '🍖'); return; }
    this.hunger = clamp(this.hunger + def.food, 0, 20);
    this.sound.eat();
    this.consumeItem(item, 1);
    this.emitState();
  }

  eatItem(item: string) {
    const def = ITEMS[item];
    if (!def?.food) return false;
    this.hunger = clamp(this.hunger + def.food, 0, 20);
    this.sound.eat();
    this.consumeItem(item, 1);
    this.emitState();
    return true;
  }

  addXp(n: number) {
    this.xp += n;
    const need = 7 + this.level * 2;
    if (this.xp >= need) { this.xp -= need; this.level++; this.sound.levelup(); this.cb.onToast(`Level ${this.level}!`, '✨'); }
    this.emitState();
  }

  damagePlayer(dmg: number, _cause = 'mob') {
    if (this.fly && _cause !== 'void') return;
    this.health -= dmg;
    this.sound.hurt();
    this.emitState();
    if (this.health <= 0) {
      this.deaths++;
      this.health = 20; this.hunger = 20;
      // respawn at world spawn (dry land search)
      let sx = 8, sz = 8, sh = this.world.getHeightRaw(sx, sz);
      outer2: for (let r = 0; r < 120; r += 8) {
        for (let a = 0; a < 8; a++) {
          const x = 8 + Math.cos((a / 8) * Math.PI * 2) * r;
          const z = 8 + Math.sin((a / 8) * Math.PI * 2) * r;
          const h = this.world.getHeightRaw(Math.floor(x), Math.floor(z));
          if (h > SEA + 1 && h < 50) { sx = Math.floor(x); sz = Math.floor(z); sh = h; break outer2; }
        }
      }
      this.pos.set(sx + 0.5, sh + 2, sz + 0.5);
      this.vel.set(0, 0, 0);
      this.cb.onDeath();
      this.emitState();
    }
  }

  killMob(m: Mob) {
    m.dead = true;
    this.kills++;
    this.sound.zombieHit();
    for (const d of m.drops) {
      if (ITEMS[d.item] || d.item.startsWith('b')) this.spawnPickup(m.pos.x, m.pos.y + 0.5, m.pos.z, d.item, d.count);
      else this.spawnPickup(m.pos.x, m.pos.y + 0.5, m.pos.z, 'bone', 1);
    }
    this.addXp(m.xp);
    this.spawnHitParticles(m.pos);
    this.emitState();
  }

  // ---------- Particles & pickups ----------
  spawnBlockParticles(x: number, y: number, z: number, color: number) {
    for (let i = 0; i < 18; i++) {
      const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
      mesh.position.set(x + 0.5 + (Math.random() - 0.5) * 0.6, y + 0.5 + (Math.random() - 0.5) * 0.6, z + 0.5 + (Math.random() - 0.5) * 0.6);
      this.scene.add(mesh);
      this.particles.push({ mesh, vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4), life: 0, maxLife: 0.6 + Math.random() * 0.4 });
    }
  }
  spawnHitParticles(pos: THREE.Vector3) {
    for (let i = 0; i < 10; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0xc03028 }));
      mesh.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5), Math.random(), (Math.random() - 0.5)));
      this.scene.add(mesh);
      this.particles.push({ mesh, vel: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3), life: 0, maxLife: 0.5 });
    }
  }
  spawnExplosionParticles(x: number, y: number, z: number) {
    for (let i = 0; i < 40; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), new THREE.MeshBasicMaterial({ color: [0xff6a1a, 0xffaa2a, 0x555555][i % 3] }));
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 6;
      this.particles.push({ mesh, vel: new THREE.Vector3(Math.cos(a) * r, Math.random() * 6, Math.sin(a) * r), life: 0, maxLife: 0.8 + Math.random() * 0.6 });
    }
  }
  spawnPickup(x: number, y: number, z: number, item: string, count: number) {
    let color = 0xffffff;
    if (item.startsWith('b')) color = BLOCKS[parseInt(item.slice(1))]?.color ?? 0xffffff;
    else if (ITEMS[item]) color = parseInt(ITEMS[item].color.slice(1), 16);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshLambertMaterial({ color, emissive: new THREE.Color(color).multiplyScalar(0.3) }));
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.pickups.push({ mesh, item, count, vel: new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2), life: 0 });
  }

  // ---------- Chunk streaming ----------
  updateChunks(force = false) {
    const pcx = Math.floor(this.pos.x / CHUNK), pcz = Math.floor(this.pos.z / CHUNK);
    const rd = this.renderDist;
    // queue missing chunks sorted by distance
    const missing: { cx: number; cz: number; d: number }[] = [];
    for (let dx = -rd; dx <= rd; dx++) for (let dz = -rd; dz <= rd; dz++) {
      const cx = pcx + dx, cz = pcz + dz;
      if (!this.world.chunks.has(this.world.key(cx, cz))) missing.push({ cx, cz, d: dx * dx + dz * dz });
    }
    missing.sort((a, b) => a.d - b.d);
    const toGen = force ? missing.slice(0, 16) : missing.slice(0, 3);
    for (const m of toGen) this.world.generateChunk(m.cx, m.cz);
    // mesh dirty / new chunks (budget per frame)
    let budget = force ? 14 : 5;
    const mat = (this as unknown as { _mat: THREE.Material })._mat;
    const waterMat = (this as unknown as { _waterMat: THREE.Material })._waterMat;
    for (const [, chunk] of this.world.chunks) {
      if (budget <= 0) break;
      const near = Math.abs(chunk.cx - pcx) <= rd + 1 && Math.abs(chunk.cz - pcz) <= rd + 1;
      if (!near) continue;
      if (chunk.dirty || (!chunk.mesh && !chunk.waterMesh)) {
        if (chunk.mesh) { this.scene.remove(chunk.mesh); chunk.mesh.geometry.dispose(); chunk.mesh = null; }
        if (chunk.waterMesh) { this.scene.remove(chunk.waterMesh); chunk.waterMesh.geometry.dispose(); chunk.waterMesh = null; }
        const { solid, water } = buildChunkMesh(this.world, chunk, mat, waterMat);
        if (solid) { chunk.mesh = solid; this.scene.add(solid); }
        if (water) { chunk.waterMesh = water; this.scene.add(water); }
        chunk.dirty = false;
        budget--;
      }
    }
    this.world.unloadFar(pcx, pcz, rd + 2, this.scene);
    // remove meshes of unloaded chunks handled by unload? need cleanup: iterate scene? simplified: chunks map deletion leaves meshes orphaned.
    // Cleanup orphan meshes: track via chunk.mesh removal in unloadFar replacement below
  }

  cleanupOrphans() {
    // remove meshes whose chunk no longer exists — we store chunk refs; simpler: on unload we already lost ref.
    // Instead, periodically prune scene children that are chunk meshes not in map: skip for now (memory ok for session)
  }

  // ---------- Physics ----------
  updatePlayer(dt: number) {
    const speedBase = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 6.8 : 4.4;
    const flySpeed = this.keys.has('ShiftLeft') ? 16 : 10;
    const speed = this.fly ? flySpeed : speedBase;

    // forward for yaw: camera looks -Z rotated by yaw. Use camera direction projected.
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    camDir.y = 0; camDir.normalize();
    const camRight = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();

    const wish = new THREE.Vector3();
    if (this.keys.has('KeyW')) wish.add(camDir);
    if (this.keys.has('KeyS')) wish.sub(camDir);
    if (this.keys.has('KeyD')) wish.add(camRight);
    if (this.keys.has('KeyA')) wish.sub(camRight);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    // water check
    const feetY = Math.floor(this.pos.y + 0.2);
    const feetBlock = this.world.getBlock(Math.floor(this.pos.x), feetY, Math.floor(this.pos.z));
    const eyeBlock = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 1.62), Math.floor(this.pos.z));
    this.inWater = feetBlock === B.Water;
    this.headInWater = eyeBlock === B.Water;
    const inLava = feetBlock === B.Lava;
    if (inLava) { this.damagePlayer(4, 'lava'); }

    if (this.inWater && !this.fly) {
      // swim
      this.vel.x = lerp(this.vel.x, wish.x * 0.6, dt * 8);
      this.vel.z = lerp(this.vel.z, wish.z * 0.6, dt * 8);
      this.vel.y -= 8 * dt;
      if (this.keys.has('Space')) this.vel.y = Math.min(this.vel.y + 30 * dt, 3.5);
      this.vel.y = clamp(this.vel.y, -4, 4);
      if (this.headInWater) {
        this.airTicks += dt;
        if (this.airTicks > 10) { this.damagePlayer(2, 'drown'); this.airTicks = 8; }
      } else this.airTicks = 0;
    } else if (this.fly) {
      this.vel.x = lerp(this.vel.x, wish.x, dt * 10);
      this.vel.z = lerp(this.vel.z, wish.z, dt * 10);
      let vy = 0;
      if (this.keys.has('Space')) vy += flySpeed * 0.8;
      if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) vy -= flySpeed * 0.8;
      // Shift is sprint on ground; in fly use C to descend too
      if (this.keys.has('KeyC')) vy -= flySpeed * 0.8;
      this.vel.y = lerp(this.vel.y, vy, dt * 10);
    } else {
      this.vel.x = lerp(this.vel.x, wish.x, dt * 12);
      this.vel.z = lerp(this.vel.z, wish.z, dt * 12);
      this.vel.y -= 28 * dt;
      this.vel.y = clamp(this.vel.y, -55, 20);
      if (this.keys.has('Space') && this.onGround) {
        this.vel.y = 8.8;
        this.onGround = false;
      }
    }

    // elytra glide
    if (this.elytra && this.vel.y < -2) {
      this.vel.y = Math.max(this.vel.y, -3);
      this.vel.x += camDir.x * 2 * dt;
      this.vel.z += camDir.z * 2 * dt;
    }

    // integrate with AABB collision (axis separated)
    const half = 0.3, height = 1.8;
    const collide = (axis: 'x' | 'y' | 'z') => {
      const minX = Math.floor(this.pos.x - half), maxX = Math.floor(this.pos.x + half);
      const minY = Math.floor(this.pos.y), maxY = Math.floor(this.pos.y + height);
      const minZ = Math.floor(this.pos.z - half), maxZ = Math.floor(this.pos.z + half);
      for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
        const b = this.world.getBlock(x, y, z);
        if (b !== 0 && isSolid(b)) {
          if (axis === 'y') {
            if (this.vel.y < 0) { this.pos.y = y + 1; this.onGround = true; }
            else this.pos.y = y - height - 0.001;
            this.vel.y = 0;
          } else if (axis === 'x') {
            this.pos.x = this.vel.x > 0 ? x - half - 0.001 : x + 1 + half + 0.001;
            this.vel.x = 0;
          } else {
            this.pos.z = this.vel.z > 0 ? z - half - 0.001 : z + 1 + half + 0.001;
            this.vel.z = 0;
          }
          return true;
        }
      }
      return false;
    };

    const prevY = this.pos.y;
    const wasGround = this.onGround;
    this.onGround = false;
    this.pos.y += this.vel.y * dt; collide('y');
    this.pos.x += this.vel.x * dt; collide('x');
    this.pos.z += this.vel.z * dt; collide('z');

    // fall damage
    if (wasGround && !this.onGround) this.fallStartY = prevY;
    if (!wasGround && this.onGround) {
      const fall = this.fallStartY - this.pos.y;
      if (fall > 4 && !this.fly && !this.inWater) {
        this.damagePlayer(Math.floor((fall - 3) * 1.2), 'fall');
        this.sound.step();
      }
    }
    if (this.pos.y < -10) this.damagePlayer(4, 'void');

    // step sounds & distance
    const moved = this.pos.distanceTo(this.lastPos);
    this.distance += moved;
    this.stepDist += moved;
    if (this.onGround && this.stepDist > 2.2) { this.stepDist = 0; this.sound.step(); }
    this.lastPos.copy(this.pos);

    // hunger drain
    this.hungerTimer += dt * (moved > 0.01 ? 1 : 0.3);
    if (this.hungerTimer > 8) { this.hungerTimer = 0; this.hunger = clamp(this.hunger - 0.5, 0, 20); }
    // regen
    if (this.hunger > 14 && this.health < 20) {
      this.regenTimer += dt;
      if (this.regenTimer > 3) { this.regenTimer = 0; this.health = clamp(this.health + 1, 0, 20); this.hunger = clamp(this.hunger - 1, 0, 20); }
    }
    if (this.hunger <= 0 && this.health > 1) {
      this.regenTimer += dt;
      if (this.regenTimer > 4) { this.regenTimer = 0; this.health -= 1; }
    }

    // camera
    this.camera.position.set(this.pos.x, this.pos.y + 1.62, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    // head bob
    if (this.onGround && moved > 0.001) {
      const bob = Math.sin(performance.now() * 0.012) * 0.04;
      this.camera.position.y += bob;
    }
    // FOV kick when sprinting
    const targetFov = (this.keys.has('ShiftLeft') && !this.fly) ? this.fov + 8 : this.fov;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) { this.camera.fov = lerp(this.camera.fov, targetFov, dt * 8); this.camera.updateProjectionMatrix(); }
    // underwater fog
    if (this.headInWater) { this.scene.fog = new THREE.Fog(0x1a4a8a, 2, 18); }
    else if (this.weather === 'rain') { this.scene.fog = new THREE.Fog(0x6a7a8a, 30, 110); }
    else if (this.weather === 'storm') { this.scene.fog = new THREE.Fog(0x4a5a6a, 20, 80); }
  }

  // ---------- Day/night & weather ----------
  updateSky(dt: number) {
    this.time = (this.time + dt * 20) % 24000; // full cycle ~20 min
    const dayFrac = this.time / 24000;
    const sunAngle = (dayFrac - 0.25) * Math.PI * 2; // sunrise at 0.25? tune: time 6000 = morning
    const sunX = Math.cos(sunAngle), sunY = Math.sin(sunAngle);
    const isDay = sunY > -0.1;
    const dayness = clamp(sunY * 1.5 + 0.5, 0, 1);

    const sunDir = new THREE.Vector3(sunX, sunY, 0.3).normalize();
    this.sun.position.copy(this.pos).add(sunDir.clone().multiplyScalar(80));
    this.sun.target.position.copy(this.pos);
    this.sun.intensity = 0.15 + dayness * 1.1;
    this.moon.position.copy(this.pos).add(sunDir.clone().multiplyScalar(-80));
    this.moon.target.position.copy(this.pos);
    this.moon.intensity = (1 - dayness) * 0.35;

    this.ambient.intensity = 0.25 + dayness * 0.45;
    this.hemi.intensity = 0.2 + dayness * 0.4;

    const skyMat = (this as unknown as { _skyMat: THREE.ShaderMaterial })._skyMat;
    const dayTop = new THREE.Color(0x3a7bd5), dayBot = new THREE.Color(0xbfe3ff);
    const nightTop = new THREE.Color(0x050510), nightBot = new THREE.Color(0x101828);
    const sunsetTop = new THREE.Color(0x4a3a6a), sunsetBot = new THREE.Color(0xff8a4a);
    const sunsetness = clamp(1 - Math.abs(sunY) * 3, 0, 1) * (sunY > -0.3 ? 1 : 0);
    const top = nightTop.clone().lerp(dayTop, dayness).lerp(sunsetTop, sunsetness * 0.6);
    const bot = nightBot.clone().lerp(dayBot, dayness).lerp(sunsetBot, sunsetness * 0.8);
    skyMat.uniforms.topColor.value.copy(top);
    skyMat.uniforms.bottomColor.value.copy(bot);
    this.scene.fog!.color.copy(bot);
    if (!this.headInWater && this.weather === 'clear' && this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = 40 + dayness * 20;
      this.scene.fog.far = 120 + dayness * 40;
    }

    this.sky.position.copy(this.pos);
    this.sunMesh.position.copy(this.pos).add(sunDir.clone().multiplyScalar(260));
    this.moonMesh.position.copy(this.pos).add(sunDir.clone().multiplyScalar(-260));
    this.stars.position.copy(this.pos);
    (this.stars.material as THREE.PointsMaterial).opacity = (1 - dayness) * 0.9;
    this.clouds.position.set(this.pos.x + this.cloudOffset, 0, this.pos.z);
    this.cloudOffset += dt * 1.2;
    const firstCloud = this.clouds.children[0] as THREE.Mesh | undefined;
    if (firstCloud) (firstCloud.material as THREE.MeshLambertMaterial).opacity = 0.4 + dayness * 0.35;

    // weather cycle
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 120 + Math.random() * 180;
      const r = Math.random();
      const next = r < 0.6 ? 'clear' : r < 0.85 ? 'rain' : 'storm';
      if (next !== this.weather) {
        this.weather = next as 'clear' | 'rain' | 'storm';
        if (this.weather === 'clear') this.sound.rainStop();
        else { this.sound.rainStart(); if (this.weather === 'storm') this.sound.thunder(); }
        this.cb.onToast(this.weather === 'clear' ? '☀️ The sky clears' : this.weather === 'rain' ? '🌧️ It starts raining' : '⛈️ A storm rolls in!', this.weather === 'clear' ? '☀️' : '🌧️');
        this.emitState();
      }
    }
    this.rain.visible = this.weather !== 'clear';
    if (this.rain.visible) {
      this.rain.position.set(this.pos.x, this.pos.y + 10, this.pos.z);
      const posAttr = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        let y = posAttr.getY(i) - dt * 22;
        if (y < 0) y = 30;
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;
      if (this.weather === 'storm' && Math.random() < 0.002) this.sound.thunder();
    }
    // ambient birds in day
    if (isDay && this.weather === 'clear' && Math.random() < 0.002) this.sound.birdChirp();
    return { isDay, dayness };
  }

  // ---------- Mobs ----------
  updateMobs(dt: number, isDay: boolean) {
    this.mobSpawnTimer -= dt;
    const isNight = !isDay;
    if (this.mobSpawnTimer <= 0) {
      this.mobSpawnTimer = 3;
      const count = this.mobs.length;
      const maxMobs = 14;
      if (count < maxMobs) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 18 + Math.random() * 22;
        const x = Math.floor(this.pos.x + Math.cos(angle) * dist);
        const z = Math.floor(this.pos.z + Math.sin(angle) * dist);
        const y = this.world.getHeight(x, z);
        if (y > SEA) {
          let kind: MobKind = 'pig';
          const r = Math.random();
          if (isNight) {
            kind = r < 0.35 ? 'zombie' : r < 0.6 ? 'skeleton' : r < 0.75 ? 'spider' : r < 0.9 ? 'creeper' : 'slime';
          } else {
            kind = r < 0.3 ? 'pig' : r < 0.55 ? 'cow' : r < 0.75 ? 'sheep' : r < 0.9 ? 'chicken' : 'wolf';
          }
          const mob = spawnMob(this.world, kind, x + 0.5, y + 1.01, z + 0.5);
          this.mobs.push(mob);
          this.scene.add(mob.group);
        }
      }
    }
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      updateMob(m, this.world, this.pos, dt, isNight, (dmg) => {
        // armor reduction
        let reduction = 0;
        if (this.inventory['helmet_iron'] || this.inventory['helmet_diamond']) reduction += 1;
        if (this.inventory['chest_iron'] || this.inventory['chest_diamond']) reduction += 2;
        if (this.inventory['boots_iron'] || this.inventory['boots_diamond']) reduction += 1;
        this.damagePlayer(Math.max(1, dmg - reduction), 'mob');
      });
      // creeper explosion
      if (m.kind === 'creeper' && !m.dead) {
        const d = Math.hypot(m.pos.x - this.pos.x, m.pos.z - this.pos.z);
        if (d < 2.5) {
          m.dead = true;
          this.explode(m.pos.x, m.pos.y + 0.5, m.pos.z, 3.5);
        }
      }
      if (m.dead) {
        this.scene.remove(m.group);
        this.mobs.splice(i, 1);
      }
    }
  }

  // ---------- Main loop ----------
  loop(now: number) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    if (this.paused) { this.renderer.render(this.scene, this.camera); return; }

    this.updatePlayer(dt);
    const { isDay } = this.updateSky(dt);
    this.updateMobs(dt, isDay);
    this.updateChunks();

    // breaking progress
    if (this.mouseDown && this.breaking) {
      const hit = this.raycast();
      if (!hit || hit.x !== this.breaking.x || hit.y !== this.breaking.y || hit.z !== this.breaking.z) {
        this.breaking = null; this.crackMesh.visible = false;
      } else {
        this.breaking.progress += dt;
        const frac = this.breaking.progress / this.breaking.need;
        this.crackMesh.scale.setScalar(1 + frac * 0.02);
        (this.crackMesh.material as THREE.MeshBasicMaterial).opacity = 0.4 + frac * 0.6;
        if (frac >= 1) {
          this.breakBlock(hit.x, hit.y, hit.z);
          this.breaking = null; this.crackMesh.visible = false;
          // auto-continue if still holding
          if (this.mouseDown) this.tryBreakStart();
        }
      }
    }
    // highlight
    const hit = this.raycast();
    if (hit) {
      this.highlight.visible = true;
      this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else this.highlight.visible = false;

    // TNT timers
    for (let i = this.tntTimers.length - 1; i >= 0; i--) {
      const t = this.tntTimers[i];
      t.t -= dt;
      if (t.t <= 0) { this.explode(t.x, t.y, t.z, 4); this.tntTimers.splice(i, 1); }
    }
    // arrows
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      a.vel.y -= 12 * dt;
      a.mesh.position.add(a.vel.clone().multiplyScalar(dt));
      let hitMob = false;
      for (const m of this.mobs) {
        if (a.mesh.position.distanceTo(m.pos.clone().add(new THREE.Vector3(0, 0.8, 0))) < 0.8) {
          m.health -= 5; m.hurtTimer = 0.3;
          if (m.health <= 0) this.killMob(m);
          hitMob = true; break;
        }
      }
      const b = this.world.getBlock(Math.floor(a.mesh.position.x), Math.floor(a.mesh.position.y), Math.floor(a.mesh.position.z));
      if (hitMob || a.life <= 0 || (b !== 0 && isSolid(b))) { this.scene.remove(a.mesh); this.arrows.splice(i, 1); }
    }
    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.vel.y -= 18 * dt;
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.mesh.rotation.x += dt * 5; p.mesh.rotation.y += dt * 7;
      if (p.life >= p.maxLife) { this.scene.remove(p.mesh); p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); this.particles.splice(i, 1); }
    }
    // pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.life += dt;
      p.vel.y -= 12 * dt;
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.mesh.rotation.y += dt * 3;
      // ground collide simple
      const gy = this.world.getHeight(Math.floor(p.mesh.position.x), Math.floor(p.mesh.position.z));
      if (p.mesh.position.y < gy + 1.3) { p.mesh.position.y = gy + 1.3; p.vel.y = 0; }
      const d = p.mesh.position.distanceTo(this.pos.clone().add(new THREE.Vector3(0, 1, 0)));
      if (d < 1.6) {
        this.addItem(p.item, p.count);
        this.sound.pickup();
        this.cb.onPickup(p.item, p.count);
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
      } else if (p.life > 120) { this.scene.remove(p.mesh); this.pickups.splice(i, 1); }
    }
    // hand swing animation
    if (this.heldMesh) {
      const t = performance.now() * 0.005;
      this.heldMesh.position.y = -0.42 + Math.sin(t) * 0.02;
      if (this.mouseDown) this.heldMesh.rotation.x = 0.3 + Math.sin(t * 4) * 0.4;
    }
    this.bowCooldown = Math.max(0, this.bowCooldown - dt);

    // periodic state emit (throttled)
    this.saveTimer += dt;
    if (this.saveTimer > 0.5) { this.saveTimer = 0; this.emitState(); }

    this.renderer.render(this.scene, this.camera);
  }

  getSnapshot(): GameState {
    return {
      health: Math.round(this.health), hunger: Math.round(this.hunger), xp: this.xp, level: this.level,
      inventory: { ...this.inventory }, hotbar: [...this.hotbar], selected: this.selected,
      pos: [this.pos.x, this.pos.y, this.pos.z], yaw: this.yaw, pitch: this.pitch,
      time: Math.floor(this.time), seed: this.world.seed, fly: this.fly, weather: this.weather,
      kills: this.kills, blocksMined: this.blocksMined, blocksPlaced: this.blocksPlaced, distance: Math.floor(this.distance), deaths: this.deaths,
    };
  }

  setPaused(p: boolean) { this.paused = p; }
  setFov(f: number) { this.fov = f; this.camera.fov = f; this.camera.updateProjectionMatrix(); }
  setSensitivity(s: number) { this.sensitivity = s; }
  setRenderDist(r: number) { this.renderDist = r; this.updateChunks(true); }
  setTime(t: number) { this.time = t; }
  teleport(x: number, y: number, z: number) { this.pos.set(x, y, z); this.vel.set(0, 0, 0); }
  giveItem(item: string, count = 1) { this.addItem(item, count); }
  heal() { this.health = 20; this.hunger = 20; this.emitState(); }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
