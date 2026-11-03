import * as THREE from 'three';
import { SoundEngine } from './audio';
import { BLOCKS, blockItemId, isSolidBlock } from './blocks';
import {
  CHUNK_SIZE,
  DAY_DURATION_SECONDS,
  PLAYER_EYE_HEIGHT,
  PLAYER_SNEAK_EYE_HEIGHT,
  REACH_DISTANCE,
  WORLD_HEIGHT,
  chunkKey,
  worldToChunkCoord,
  worldToLocalCoord,
} from './constants';
import {
  CREATIVE_PALETTE,
  ITEMS,
  canHarvestBlockDrop,
  computeBreakTimeSeconds,
} from './items';
import { computeChunkLighting } from './lighting';
import { createVoxelMaterials, VoxelMaterialBundle } from './materials';
import { buildChunkMeshes } from './mesher';
import { MobManager } from './mobs';
import { ParticleSystem } from './particles';
import {
  PlayerBodyState,
  PlayerInputState,
  stepPlayerPhysics,
  wouldBlockOverlapPlayer,
} from './physics';
import { RaycastHit, raycastVoxel } from './raycast';
import {
  CRAFTING_RECIPES,
  addItemToInventory,
  craftRecipeOnce,
  stepFurnace,
} from './recipes';
import { getAtlas, GeneratedAtlas, getTileUVRect } from './textures';
import {
  ActiveTNT,
  BiomeId,
  BlockId,
  DroppedItemEntity,
  EngineHUDState,
  FurnaceData,
  GameMode,
  GameSettings,
  InventorySlot,
  ItemId,
  WeatherKind,
  WorldSaveData,
  WorldSaveMeta,
} from './types';
import { ChunkData, WorldGenerator } from './worldGen';

interface ChunkRenderBundle {
  group: THREE.Group;
  opaque?: THREE.Mesh;
  cutout?: THREE.Mesh;
  translucent?: THREE.Mesh;
}

const DEFAULT_MILESTONES: Array<{ id: string; title: string; hint: string }> = [
  { id: 'gather_wood', title: 'First Timber', hint: 'Hold Left-Click on a tree trunk to gather Logs' },
  { id: 'craft_planks', title: 'Lumber Mill', hint: 'Press E and craft Wood Planks from Logs' },
  { id: 'craft_table', title: 'Master Workbench', hint: 'Craft a Crafting Table from 4 Planks & place it' },
  { id: 'wood_pickaxe', title: 'Miner’s Gear', hint: 'Right-click your Crafting Table to craft a Pickaxe' },
  { id: 'mine_cobble', title: 'Stone Age', hint: 'Mine Stone underground to collect Cobblestone' },
  { id: 'craft_torch', title: 'Light the Dark', hint: 'Craft Torches using Coal + Stick to light caves' },
  { id: 'smelt_ingot', title: 'Iron Metallurgy', hint: 'Smelt Iron or Gold Ore inside a Stone Furnace' },
  { id: 'find_diamond', title: 'Deep Fortune', hint: 'Discover Diamonds deep below Y=17!' },
];

export class VoxelEngine {
  readonly container: HTMLElement | null;
  readonly generator: WorldGenerator;
  readonly sound = new SoundEngine();

  private meta: WorldSaveMeta;
  private settings: GameSettings;
  private onHUDUpdate: (state: EngineHUDState) => void;

  // World & Chunks
  private chunks = new Map<string, ChunkData>();
  private chunkMeshes = new Map<string, ChunkRenderBundle>();
  private modifiedBlocks = new Map<string, BlockId>(); // "wx,wy,wz" -> BlockId
  private chunkGenQueue: Array<[number, number]> = [];
  private chunkGenSet = new Set<string>();
  private queueCenterCX = 999999;
  private queueCenterCZ = 999999;

  // Player & Gameplay State
  readonly player: PlayerBodyState;
  readonly inventory: (InventorySlot | null)[] = new Array(36).fill(null);
  selectedHotbar = 0;
  health = 20;
  maxHealth = 20;
  hunger = 20;
  maxHunger = 20;
  breath = 10;
  maxBreath = 10;
  timeOfDay = 0.32; // Sunny morning start!
  dayCount = 1;
  weather: WeatherKind = 'clear';
  private weatherTimer = 110;

  private furnaces = new Map<string, FurnaceData>();
  private litFurnaces = new Set<string>();
  private activeFurnaceKey: string | null = null;
  private nearCraftingTable = false;

  private completedMilestones = new Set<string>();
  private toastMessage: string | null = null;
  private toastTimer = 0;

  private droppedItems: DroppedItemEntity[] = [];
  private droppedMeshes = new Map<string, THREE.Mesh>();
  private activeTNTs: ActiveTNT[] = [];
  private tntMeshes = new Map<string, THREE.Mesh>();
  private nextEntityId = 1;

  // Input & Interaction
  private keys = new Set<string>();
  private mouseLeftDown = false;
  private mouseRightQueued = false;
  private miningTargetKey: string | null = null;
  private miningProgress = 0;
  private miningHitSoundTimer = 0;
  private actionCooldown = 0;
  private swingProgress = 0;
  private damageFlash = 0;
  private hungerTickTimer = 0;
  private regenTimer = 0;
  private emberTimer = 0;
  private lastSpacePressTime = 0;

  // UI Flags
  ready = false;
  loadingProgress = 0;
  loadingMessage = 'Sculpting continents & biomes...';
  paused = false;
  inventoryOpen = false;
  gameOver = false;
  pointerLocked = false;
  debugOpen = false;
  helpOpen = false;

  // Three.js Objects (null only when running headless tests)
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private atlas: GeneratedAtlas;
  private materials: VoxelMaterialBundle;
  private skyMat!: THREE.ShaderMaterial;
  private sunMesh!: THREE.Mesh;
  private moonMesh!: THREE.Mesh;
  private starsPoints!: THREE.Points;
  private cloudGroup!: THREE.Group;
  private highlightBox!: THREE.LineSegments;
  private crackOverlay!: THREE.Mesh;
  private handRoot!: THREE.Group;
  private handItemGroup!: THREE.Group;
  private lastHandSignature = '';
  private particles: ParticleSystem | null = null;
  readonly mobs: MobManager;

  // Loop & Perf
  private rafId = 0;
  private lastFrameMs = 0;
  private physicsAccumulator = 0;
  private hudEmitTimer = 0;
  private fpsFrames = 0;
  private fpsTimer = 0;
  private currentFps = 60;
  private disposed = false;
  private currentTargetHit: RaycastHit | null = null;

  constructor(
    container: HTMLElement | null,
    saveOrNew: {
      meta: WorldSaveMeta;
      savedData?: WorldSaveData | null;
    },
    settings: GameSettings,
    onHUDUpdate: (state: EngineHUDState) => void
  ) {
    this.container = container;
    this.meta = { ...saveOrNew.meta };
    this.settings = { ...settings };
    this.onHUDUpdate = onHUDUpdate;

    this.generator = new WorldGenerator(this.meta.seed);
    this.atlas = getAtlas();
    this.materials = createVoxelMaterials(this.atlas.texture);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, 16 / 9, 0.08, 420);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    const saved = saveOrNew.savedData;
    const spawn = this.generator.findSpawnPosition();

    this.player = {
      x: saved ? saved.player.x : spawn.x,
      y: saved ? saved.player.y : spawn.y,
      z: saved ? saved.player.z : spawn.z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: saved ? saved.player.yaw : 0.45,
      pitch: saved ? saved.player.pitch : -0.12,
      onGround: false,
      inWater: false,
      headUnderwater: false,
      flying: saved ? saved.player.flying : this.meta.mode === 'creative',
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      highestAirY: saved ? saved.player.y : spawn.y,
      stepAccumulator: 0,
    };

    if (saved) {
      this.health = saved.player.health;
      this.maxHealth = saved.player.maxHealth;
      this.hunger = saved.player.hunger;
      this.maxHunger = saved.player.maxHunger;
      this.breath = saved.player.breath;
      this.selectedHotbar = saved.player.selectedHotbar;
      this.timeOfDay = saved.timeOfDay;
      this.dayCount = saved.dayCount;
      this.weather = saved.weather;
      for (let i = 0; i < 36; i++) {
        this.inventory[i] = saved.inventory[i] ? { ...saved.inventory[i]! } : null;
      }
      for (const f of saved.furnaces) {
        this.furnaces.set(f.key, {
          ...f,
          input: f.input ? { ...f.input } : null,
          fuel: f.fuel ? { ...f.fuel } : null,
          output: f.output ? { ...f.output } : null,
        });
        if (f.burnRemaining > 0) this.litFurnaces.add(f.key);
      }
      for (const m of saved.milestones) {
        this.completedMilestones.add(m);
      }
      for (const [wx, wy, wz, bid] of saved.modifiedBlocks) {
        this.modifiedBlocks.set(`${wx},${wy},${wz}`, bid);
      }
    } else if (this.meta.mode === 'creative') {
      // Pre-load Creative Hotbar with signature building & lighting blocks!
      const starter: ItemId[] = [
        blockItemId(BlockId.OakPlanks),
        blockItemId(BlockId.Bricks),
        blockItemId(BlockId.Stone),
        blockItemId(BlockId.Glass),
        blockItemId(BlockId.Glowstone),
        blockItemId(BlockId.Torch),
        blockItemId(BlockId.CraftingTable),
        blockItemId(BlockId.TNT),
        'diamond_pickaxe',
      ];
      starter.forEach((id, idx) => {
        this.inventory[idx] = { itemId: id, count: ITEMS[id].maxStack === 1 ? 1 : 64 };
      });
    } else {
      // Survival: give explorer 3 Crisp Apples in last hotbar slot so food mechanic is immediately clear!
      this.inventory[8] = { itemId: 'apple', count: 3 };
    }

    this.sound.volume = this.settings.soundVolume;
    this.sound.musicEnabled = this.settings.musicEnabled;

    this.setupSceneVisuals();
    this.mobs = new MobManager(this.container ? this.scene : null);

    if (this.container) {
      this.initRendererAndEvents(this.container);
      this.bootstrapInitialChunksAsync();
    } else {
      // Synchronous bootstrap for deterministic headless test suite
      this.generateRadiusSync(2);
      this.ensurePlayerSafeHeight();
      this.ready = true;
      this.loadingProgress = 1;
    }
  }

  private setupSceneVisuals(): void {
    // Ambient & directional light for non-shader meshes (mobs, held items, dropped blocks)
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x4b5563, 1.05);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfffbeb, 0.9);
    dir.position.set(30, 60, 20);
    this.scene.add(dir);

    // Atmospheric Sky Dome
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTopColor: { value: new THREE.Color('#3b82f6') },
        uHorizonColor: { value: new THREE.Color('#93c5fd') },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y * 1.35 + 0.12, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.72));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(280, 24, 16), this.skyMat);
    skyDome.frustumCulled = false;
    this.scene.add(skyDome);

    // Sun & Moon voxel bodies
    this.sunMesh = new THREE.Mesh(
      new THREE.BoxGeometry(22, 22, 22),
      new THREE.MeshBasicMaterial({ color: 0xfff3a6 })
    );
    this.sunMesh.frustumCulled = false;
    this.scene.add(this.sunMesh);

    this.moonMesh = new THREE.Mesh(
      new THREE.BoxGeometry(17, 17, 17),
      new THREE.MeshBasicMaterial({ color: 0xe2e8f0 })
    );
    this.moonMesh.frustumCulled = false;
    this.scene.add(this.moonMesh);

    // Starfield
    const starCount = 520;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.92 + 0.08);
      const r = 240;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starsPoints = new THREE.Points(
      starGeom,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.5,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    this.starsPoints.frustumCulled = false;
    this.scene.add(this.starsPoints);

    // Drifting 3D Voxel Clouds
    this.cloudGroup = new THREE.Group();
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
    });
    for (let i = 0; i < 26; i++) {
      const w = 12 + Math.floor(Math.random() * 20);
      const d = 10 + Math.floor(Math.random() * 16);
      const cloud = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, d), cloudMat);
      cloud.position.set(
        (Math.random() - 0.5) * 320,
        104 + (i % 3) * 2.5,
        (Math.random() - 0.5) * 320
      );
      this.cloudGroup.add(cloud);
    }
    this.scene.add(this.cloudGroup);

    // Block Selection Wireframe Box
    const boxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    this.highlightBox = new THREE.LineSegments(
      boxEdges,
      new THREE.LineBasicMaterial({
        color: 0x111827,
        transparent: true,
        opacity: 0.72,
      })
    );
    this.highlightBox.visible = false;
    this.scene.add(this.highlightBox);

    // Progressive 3D Crack Overlay Cube
    this.crackOverlay = new THREE.Mesh(
      new THREE.BoxGeometry(1.01, 1.01, 1.01),
      new THREE.MeshBasicMaterial({
        map: this.atlas.crackTextures[0],
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      })
    );
    this.crackOverlay.visible = false;
    this.scene.add(this.crackOverlay);

    // First-person Right Hand / Held Item Viewmodel attached to Camera
    this.handRoot = new THREE.Group();
    this.handItemGroup = new THREE.Group();
    this.handRoot.position.set(0.42, -0.36, -0.62);
    this.handRoot.add(this.handItemGroup);
    this.camera.add(this.handRoot);

    if (this.container) {
      this.particles = new ParticleSystem(this.scene);
    }
  }

  private initRendererAndEvents(container: HTMLElement): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    this.handleResize();
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('wheel', this.handleWheel, { passive: false });
    window.addEventListener('contextmenu', this.handleContextMenu);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
  }

  private bootstrapInitialChunksAsync(): void {
    const pCx = worldToChunkCoord(this.player.x);
    const pCz = worldToChunkCoord(this.player.z);
    const coords: Array<[number, number]> = [];
    const r = Math.min(4, this.settings.renderDistance);
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        coords.push([pCx + dx, pCz + dz]);
      }
    }
    coords.sort((a, b) => (a[0] - pCx) ** 2 + (a[1] - pCz) ** 2 - ((b[0] - pCx) ** 2 + (b[1] - pCz) ** 2));

    let index = 0;
    const total = coords.length;

    const step = () => {
      if (this.disposed) return;
      const batchEnd = Math.min(total, index + 6);
      for (; index < batchEnd; index++) {
        const [cx, cz] = coords[index];
        this.ensureChunkGenerated(cx, cz);
      }

      this.loadingProgress = (index / total) * 0.78;
      this.loadingMessage =
        index < total
          ? `Generating terrain & caverns (${index}/${total} chunks)...`
          : ' propagating sunlight & building voxel meshes...';
      this.emitHUD();

      if (index < total) {
        requestAnimationFrame(step);
        return;
      }

      // Light & mesh initial chunks cleanly
      for (const chunk of this.chunks.values()) {
        computeChunkLighting(chunk, this.getChunkLookup, this.litFurnaces);
      }
      for (const chunk of this.chunks.values()) {
        this.rebuildChunkMesh(chunk);
      }

      this.ensurePlayerSafeHeight();
      this.ready = true;
      this.loadingProgress = 1;
      this.loadingMessage = 'Ready!';
      this.lastFrameMs = performance.now();
      this.emitHUD();
      this.rafId = requestAnimationFrame(this.loop);
    };

    requestAnimationFrame(step);
  }

  generateRadiusSync(radius: number): void {
    const pCx = worldToChunkCoord(this.player.x);
    const pCz = worldToChunkCoord(this.player.z);
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        this.ensureChunkGenerated(pCx + dx, pCz + dz);
      }
    }
    for (const chunk of this.chunks.values()) {
      computeChunkLighting(chunk, this.getChunkLookup, this.litFurnaces);
    }
    for (const chunk of this.chunks.values()) {
      this.rebuildChunkMesh(chunk);
    }
  }

  private ensurePlayerSafeHeight(): void {
    // Ensure spawn column has 2 air blocks for head clearance if tree leaves spawned overhead
    const bx = Math.floor(this.player.x);
    const bz = Math.floor(this.player.z);
    let fy = Math.floor(this.player.y);
    while (
      fy < WORLD_HEIGHT - 3 &&
      (isSolidBlock(this.getBlock(bx, fy, bz)) || isSolidBlock(this.getBlock(bx, fy + 1, bz)))
    ) {
      fy++;
    }
    this.player.y = fy + 0.05;
    this.player.highestAirY = this.player.y;
  }

  private getChunkLookup = (cx: number, cz: number): ChunkData | undefined => {
    return this.chunks.get(chunkKey(cx, cz));
  };

  getBlock = (wx: number, wy: number, wz: number): BlockId => {
    if (wy < 0 || wy >= WORLD_HEIGHT) return BlockId.Air;
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return BlockId.Air;
    return chunk.getBlock(worldToLocalCoord(wx), wy, worldToLocalCoord(wz));
  };

  getBiomeAt = (wx: number, wz: number): BiomeId => {
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return this.generator.sampleColumn(wx, wz).biome;
    const lx = worldToLocalCoord(wx);
    const lz = worldToLocalCoord(wz);
    return chunk.biomes[lz * CHUNK_SIZE + lx] ?? 'plains';
  };

  setBlock(wx: number, wy: number, wz: number, blockId: BlockId, recordEdit = true): boolean {
    if (wy < 0 || wy >= WORLD_HEIGHT) return false;
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const chunk = this.ensureChunkGenerated(cx, cz);
    const lx = worldToLocalCoord(wx);
    const lz = worldToLocalCoord(wz);

    const prevId = chunk.getBlock(lx, wy, lz);
    chunk.setBlock(lx, wy, lz, blockId);
    if (recordEdit) {
      this.modifiedBlocks.set(`${wx},${wy},${wz}`, blockId);
    }

    const lightRadius = Math.max(
      BLOCKS[prevId]?.lightEmission ?? 0,
      BLOCKS[blockId]?.lightEmission ?? 0,
      2
    );

    // Only refresh neighbor chunks actually within border/light range of the modified voxel!
    const neighborsToRefresh: ChunkData[] = [chunk];
    const borderChecks: Array<[boolean, number, number]> = [
      [lx < lightRadius, cx - 1, cz],
      [lx >= CHUNK_SIZE - lightRadius, cx + 1, cz],
      [lz < lightRadius, cx, cz - 1],
      [lz >= CHUNK_SIZE - lightRadius, cx, cz + 1],
    ];
    for (const [shouldUpdate, ncx, ncz] of borderChecks) {
      if (!shouldUpdate) continue;
      const n = this.chunks.get(chunkKey(ncx, ncz));
      if (n) {
        n.lightDirty = true;
        n.dirty = true;
        neighborsToRefresh.push(n);
      }
    }

    for (const c of neighborsToRefresh) {
      computeChunkLighting(c, this.getChunkLookup, this.litFurnaces);
    }
    for (const c of neighborsToRefresh) {
      this.rebuildChunkMesh(c);
    }

    return true;
  }

  private ensureChunkGenerated(cx: number, cz: number): ChunkData {
    const key = chunkKey(cx, cz);
    const existing = this.chunks.get(key);
    if (existing) return existing;

    const chunk = this.generator.generateChunk(cx, cz);
    // Apply any persistent modified block overrides belonging to this chunk!
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;
    for (const [mKey, bid] of this.modifiedBlocks.entries()) {
      const [xs, ys, zs] = mKey.split(',');
      const wx = Number(xs);
      const wy = Number(ys);
      const wz = Number(zs);
      if (wx >= baseX && wx < baseX + CHUNK_SIZE && wz >= baseZ && wz < baseZ + CHUNK_SIZE) {
        chunk.setBlock(wx - baseX, wy, wz - baseZ, bid);
      }
    }

    this.chunks.set(key, chunk);
    for (const [ncx, ncz] of [
      [cx - 1, cz],
      [cx + 1, cz],
      [cx, cz - 1],
      [cx, cz + 1],
    ]) {
      const neighbor = this.chunks.get(chunkKey(ncx, ncz));
      if (neighbor) {
        neighbor.lightDirty = true;
        neighbor.dirty = true;
      }
    }
    return chunk;
  }

  private rebuildChunkMesh(chunk: ChunkData): void {
    const key = chunkKey(chunk.cx, chunk.cz);
    const prev = this.chunkMeshes.get(key);
    if (prev) {
      this.disposeChunkBundle(prev);
      this.chunkMeshes.delete(key);
    }

    const res = buildChunkMeshes(chunk, this.getChunkLookup);
    const group = new THREE.Group();
    group.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);

    const bundle: ChunkRenderBundle = { group };
    if (res.opaque) {
      bundle.opaque = new THREE.Mesh(res.opaque, this.materials.opaque);
      group.add(bundle.opaque);
    }
    if (res.cutout) {
      bundle.cutout = new THREE.Mesh(res.cutout, this.materials.cutout);
      group.add(bundle.cutout);
    }
    if (res.translucent) {
      bundle.translucent = new THREE.Mesh(res.translucent, this.materials.translucent);
      bundle.translucent.renderOrder = 2;
      group.add(bundle.translucent);
    }

    this.scene.add(group);
    this.chunkMeshes.set(key, bundle);
  }

  private disposeChunkBundle(bundle: ChunkRenderBundle): void {
    this.scene.remove(bundle.group);
    bundle.opaque?.geometry.dispose();
    bundle.cutout?.geometry.dispose();
    bundle.translucent?.geometry.dispose();
  }

  private streamChunksBudgeted(): void {
    const pCx = worldToChunkCoord(this.player.x);
    const pCz = worldToChunkCoord(this.player.z);
    const rd = this.settings.renderDistance;

    if (pCx !== this.queueCenterCX || pCz !== this.queueCenterCZ) {
      this.queueCenterCX = pCx;
      this.queueCenterCZ = pCz;
      this.chunkGenQueue = [];
      this.chunkGenSet.clear();

      for (let dz = -rd; dz <= rd; dz++) {
        for (let dx = -rd; dx <= rd; dx++) {
          if (dx * dx + dz * dz > (rd + 0.6) ** 2) continue;
          const cx = pCx + dx;
          const cz = pCz + dz;
          const k = chunkKey(cx, cz);
          if (!this.chunks.has(k)) {
            this.chunkGenQueue.push([cx, cz]);
            this.chunkGenSet.add(k);
          }
        }
      }
      this.chunkGenQueue.sort(
        (a, b) => (a[0] - pCx) ** 2 + (a[1] - pCz) ** 2 - ((b[0] - pCx) ** 2 + (b[1] - pCz) ** 2)
      );

      // Unload distant chunks smoothly
      const maxUnloadDistSq = (rd + 2.5) ** 2;
      for (const [k, chunk] of this.chunks.entries()) {
        const dSq = (chunk.cx - pCx) ** 2 + (chunk.cz - pCz) ** 2;
        if (dSq > maxUnloadDistSq) {
          this.chunks.delete(k);
          const mesh = this.chunkMeshes.get(k);
          if (mesh) {
            this.disposeChunkBundle(mesh);
            this.chunkMeshes.delete(k);
          }
        }
      }
    }

    // Generate up to 2 chunks per frame
    let genBudget = 2;
    while (genBudget > 0 && this.chunkGenQueue.length > 0) {
      const [cx, cz] = this.chunkGenQueue.shift()!;
      this.chunkGenSet.delete(chunkKey(cx, cz));
      this.ensureChunkGenerated(cx, cz);
      genBudget--;
    }

    // Re-light & re-mesh up to 3 dirty chunks per frame nearest first
    let meshBudget = 3;
    for (const chunk of this.chunks.values()) {
      if (meshBudget <= 0) break;
      if (chunk.lightDirty || chunk.dirty) {
        if (chunk.lightDirty) {
          computeChunkLighting(chunk, this.getChunkLookup, this.litFurnaces);
        }
        this.rebuildChunkMesh(chunk);
        meshBudget--;
      }
    }
  }

  private loop = (nowMs: number): void => {
    if (this.disposed) return;
    const rawDt = Math.min(0.1, Math.max(0.0005, (nowMs - this.lastFrameMs) / 1000));
    this.lastFrameMs = nowMs;

    this.fpsFrames++;
    this.fpsTimer += rawDt;
    if (this.fpsTimer >= 0.5) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsTimer);
      this.fpsFrames = 0;
      this.fpsTimer = 0;
    }

    if (!this.paused && !this.gameOver) {
      this.tick(rawDt);
    }

    this.updateVisualFrame(rawDt);
    this.renderer?.render(this.scene, this.camera);

    this.hudEmitTimer += rawDt;
    if (this.hudEmitTimer >= 0.08) {
      this.hudEmitTimer = 0;
      this.emitHUD();
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  // Public deterministic step method (usable directly in headless tests too!)
  tick(dt: number): void {
    // 1. Day/Night & Weather Cycle
    const prevTime = this.timeOfDay;
    this.timeOfDay = (this.timeOfDay + dt / DAY_DURATION_SECONDS) % 1.0;
    if (this.timeOfDay < prevTime) {
      this.dayCount += 1;
    }

    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 95 + Math.random() * 140;
      const biome = this.getBiomeAt(Math.floor(this.player.x), Math.floor(this.player.z));
      if (this.weather !== 'clear') {
        this.weather = 'clear';
      } else if (Math.random() < 0.35) {
        this.weather = biome === 'mountains' ? 'snow' : biome === 'desert' ? 'clear' : 'rain';
      }
    }

    // 2. Fixed-substep Player Physics
    const input = this.readPlayerInput();
    this.physicsAccumulator += dt;
    const FIXED = 1 / 60;
    let guard = 0;
    while (this.physicsAccumulator >= FIXED && guard < 6) {
      this.physicsAccumulator -= FIXED;
      guard++;
      const out = stepPlayerPhysics(
        this.player,
        input,
        FIXED,
        this.getBlock,
        this.settings.autoStep
      );
      if (out.landedDistance > 3.6 && this.meta.mode === 'survival') {
        const dmg = Math.floor((out.landedDistance - 3.3) * 1.15);
        if (dmg > 0) this.applyPlayerDamage(dmg, 0, 0);
      }
      if (out.steppedFootstep) {
        const below = this.getBlock(
          Math.floor(this.player.x),
          Math.floor(this.player.y - 0.2),
          Math.floor(this.player.z)
        );
        if (below !== BlockId.Air) {
          this.sound.playMaterialSound(BLOCKS[below].soundMaterial, 'step');
        }
      }
      if (out.enteredWater) {
        this.sound.playMaterialSound('water', 'break');
      }
      if (out.hitCactus && this.meta.mode === 'survival') {
        this.applyPlayerDamage(1, -this.player.vx * 0.4, -this.player.vz * 0.4);
      }
    }

    // 3. Survival Breath, Hunger & Natural Regeneration
    this.updateSurvivalVitals(dt, input);

    // 4. Raycast Target Block & Mining / Placement / Interactions
    this.updateRaycastAndActions(dt);

    // 5. Furnaces Smelting Tick
    for (const [key, furnace] of this.furnaces.entries()) {
      const wasLit = furnace.burnRemaining > 0;
      const prevOutCount = furnace.output?.count ?? 0;
      stepFurnace(furnace, dt);
      const nowLit = furnace.burnRemaining > 0;
      if ((furnace.output?.count ?? 0) > prevOutCount) {
        if (
          furnace.output?.itemId === 'iron_ingot' ||
          furnace.output?.itemId === 'gold_ingot'
        ) {
          this.unlockMilestone('smelt_ingot');
        }
      }
      if (wasLit !== nowLit) {
        if (nowLit) this.litFurnaces.add(key);
        else this.litFurnaces.delete(key);
        const [xs, , zs] = key.split(',').map(Number);
        const fChunk = this.chunks.get(
          chunkKey(worldToChunkCoord(xs), worldToChunkCoord(zs))
        );
        if (fChunk) {
          fChunk.lightDirty = true;
          fChunk.dirty = true;
        }
      }
    }

    // Check nearby Crafting Table & Stone Furnace within 4 blocks for seamless Workshop access!
    this.nearCraftingTable = this.hasNearbyBlock(BlockId.CraftingTable, 4);
    if (!this.activeFurnaceKey || this.getBlockFromKey(this.activeFurnaceKey) !== BlockId.Furnace) {
      const nearbyFurnace = this.findNearbyBlockCoords(BlockId.Furnace, 4);
      if (nearbyFurnace) {
        const key = `${nearbyFurnace[0]},${nearbyFurnace[1]},${nearbyFurnace[2]}`;
        if (!this.furnaces.has(key)) {
          this.furnaces.set(key, {
            key,
            input: null,
            fuel: null,
            output: null,
            burnRemaining: 0,
            burnTotal: 1,
            cookProgress: 0,
          });
        }
        this.activeFurnaceKey = key;
      } else {
        this.activeFurnaceKey = null;
      }
    }

    // 6. Dropped 3D Items & Active TNT Fuses & Mobs
    this.updateDroppedItems(dt);
    this.updateActiveTNT(dt);

    const dayLightFactor = this.computeDayLightFactor();
    const isNight = dayLightFactor < 0.36;
    this.mobs.update(
      dt,
      this.player.x,
      this.player.y,
      this.player.z,
      isNight,
      this.settings.peacefulMobs,
      dayLightFactor,
      this.getBlock,
      this.getBiomeAt,
      {
        onPlayerDamaged: (amt, kx, kz) => {
          if (this.meta.mode === 'survival') {
            this.applyPlayerDamage(amt, kx, kz);
          }
        },
        onCreeperHiss: () => this.sound.playHiss(),
        onCreeperDetonate: (x, y, z) => this.detonateExplosion(x, y, z, 3.2),
        onDropLoot: (x, y, z, itemId, count) => this.spawnDroppedItem(x, y, z, itemId, count),
      }
    );

    // 7. Stream Chunks & Ambient Audio
    this.streamChunksBudgeted();
    this.sound.updateAmbientMusic(dt);

    if (this.toastTimer > 0) {
      this.toastTimer = Math.max(0, this.toastTimer - dt);
      if (this.toastTimer <= 0) this.toastMessage = null;
    }
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.6);
  }

  private updateSurvivalVitals(dt: number, input: PlayerInputState): void {
    if (this.meta.mode !== 'survival') {
      this.health = this.maxHealth;
      this.hunger = this.maxHunger;
      this.breath = this.maxBreath;
      return;
    }

    if (this.player.headUnderwater) {
      this.breath = Math.max(0, this.breath - dt * 0.75);
      if (this.breath <= 0) {
        this.regenTimer -= dt;
        if (this.regenTimer <= 0) {
          this.regenTimer = 1.0;
          this.applyPlayerDamage(2, 0, 0);
        }
      }
    } else {
      this.breath = Math.min(this.maxBreath, this.breath + dt * 3.5);
    }

    const moving = Math.hypot(this.player.vx, this.player.vz) > 0.5;
    if (moving) {
      this.hungerTickTimer += dt * (input.sprint ? 2.2 : 0.7);
      if (this.hungerTickTimer >= 22) {
        this.hungerTickTimer = 0;
        this.hunger = Math.max(2, this.hunger - 1);
      }
    }

    if (this.hunger >= 15 && this.health < this.maxHealth) {
      this.regenTimer += dt;
      if (this.regenTimer >= 2.2) {
        this.regenTimer = 0;
        this.health = Math.min(this.maxHealth, this.health + 1);
      }
    }
  }

  private getEyePosition(): [number, number, number] {
    const sneak = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const eyeH = sneak ? PLAYER_SNEAK_EYE_HEIGHT : PLAYER_EYE_HEIGHT;
    return [this.player.x, this.player.y + eyeH, this.player.z];
  }

  private getLookDirection(): [number, number, number] {
    const cp = Math.cos(this.player.pitch);
    return [
      -Math.sin(this.player.yaw) * cp,
      Math.sin(this.player.pitch),
      -Math.cos(this.player.yaw) * cp,
    ];
  }

  private updateRaycastAndActions(dt: number): void {
    const [ex, ey, ez] = this.getEyePosition();
    const [dx, dy, dz] = this.getLookDirection();
    this.currentTargetHit = raycastVoxel(
      ex,
      ey,
      ez,
      dx,
      dy,
      dz,
      REACH_DISTANCE,
      this.getBlock
    );

    this.actionCooldown = Math.max(0, this.actionCooldown - dt);

    // Handle Right-Click Interaction / Block Placement / Food Eating
    if (this.mouseRightQueued) {
      this.mouseRightQueued = false;
      this.performSecondaryAction();
    }

    // Handle Left-Click Combat / Block Mining
    if (this.mouseLeftDown && !this.inventoryOpen && !this.paused) {
      if (this.swingProgress <= 0) {
        this.swingProgress = 1.0;
        // First check if a creature is directly in crosshair within combat reach (4.0m)
        const heldSlot = this.inventory[this.selectedHotbar];
        const dmg = heldSlot ? ITEMS[heldSlot.itemId].attackDamage : 2;
        const hitMob = this.mobs.attackRay(ex, ey, ez, dx, dy, dz, 4.0, dmg, {
          onPlayerDamaged: () => {},
          onCreeperHiss: () => {},
          onCreeperDetonate: () => {},
          onDropLoot: (x, y, z, itemId, count) => this.spawnDroppedItem(x, y, z, itemId, count),
        });
        if (hitMob) {
          this.sound.playHurt();
          this.damageToolDurability();
          this.actionCooldown = 0.28;
          this.miningProgress = 0;
          return;
        }
      }

      if (this.currentTargetHit && this.actionCooldown <= 0) {
        const hit = this.currentTargetHit;
        const key = `${hit.wx},${hit.wy},${hit.wz}`;
        if (this.miningTargetKey !== key) {
          this.miningTargetKey = key;
          this.miningProgress = 0;
        }

        const heldSlot = this.inventory[this.selectedHotbar];
        const breakSecs =
          this.meta.mode === 'creative'
            ? 0.05
            : computeBreakTimeSeconds(
                hit.blockId,
                heldSlot?.itemId ?? null,
                this.player.headUnderwater,
                this.player.onGround
              );

        if (isFinite(breakSecs)) {
          this.miningProgress += dt / breakSecs;
          this.miningHitSoundTimer -= dt;
          if (this.miningHitSoundTimer <= 0) {
            this.miningHitSoundTimer = 0.2;
            const def = BLOCKS[hit.blockId];
            this.sound.playMaterialSound(def.soundMaterial, 'hit');
            this.particles?.emitMiningChip(
              hit.wx,
              hit.wy,
              hit.wz,
              hit.nx,
              hit.ny,
              hit.nz,
              def.particleColor
            );
          }

          if (this.miningProgress >= 1.0) {
            this.harvestBlock(hit.wx, hit.wy, hit.wz, hit.blockId);
            this.miningProgress = 0;
            this.miningTargetKey = null;
            this.actionCooldown = this.meta.mode === 'creative' ? 0.14 : 0.08;
          }
        }
      } else {
        this.miningProgress = 0;
        this.miningTargetKey = null;
      }
    } else {
      this.miningProgress = 0;
      this.miningTargetKey = null;
    }

    if (this.swingProgress > 0) {
      this.swingProgress = Math.max(0, this.swingProgress - dt * 4.2);
    }
  }

  harvestBlock(wx: number, wy: number, wz: number, existingId?: BlockId): void {
    const blockId = existingId ?? this.getBlock(wx, wy, wz);
    if (blockId === BlockId.Air) return;
    const def = BLOCKS[blockId];
    const heldSlot = this.inventory[this.selectedHotbar];

    this.setBlock(wx, wy, wz, BlockId.Air);
    this.sound.playMaterialSound(def.soundMaterial, 'break');
    this.particles?.emitBlockBreak(wx, wy, wz, def.particleColor, 24);

    // Clean up furnace contents if broken
    const fKey = `${wx},${wy},${wz}`;
    const fData = this.furnaces.get(fKey);
    if (fData) {
      if (fData.input) this.spawnDroppedItem(wx + 0.5, wy + 0.5, wz + 0.5, fData.input.itemId, fData.input.count);
      if (fData.fuel) this.spawnDroppedItem(wx + 0.5, wy + 0.5, wz + 0.5, fData.fuel.itemId, fData.fuel.count);
      if (fData.output) this.spawnDroppedItem(wx + 0.5, wy + 0.5, wz + 0.5, fData.output.itemId, fData.output.count);
      this.furnaces.delete(fKey);
      this.litFurnaces.delete(fKey);
    }

    if (this.meta.mode === 'survival') {
      this.damageToolDurability();

      if (canHarvestBlockDrop(blockId, heldSlot?.itemId ?? null)) {
        if (
          blockId === BlockId.OakLeaves ||
          blockId === BlockId.BirchLeaves ||
          blockId === BlockId.SpruceLeaves
        ) {
          const r = Math.random();
          if (r < 0.14) this.spawnDroppedItem(wx + 0.5, wy + 0.4, wz + 0.5, 'apple', 1);
          else if (r < 0.28) this.spawnDroppedItem(wx + 0.5, wy + 0.4, wz + 0.5, 'stick', 1);
        } else if (blockId === BlockId.Gravel && Math.random() < 0.3) {
          this.spawnDroppedItem(wx + 0.5, wy + 0.4, wz + 0.5, 'flint', 1);
        } else {
          const drop =
            def.dropItem === undefined ? blockItemId(blockId) : def.dropItem;
          if (drop) {
            this.spawnDroppedItem(
              wx + 0.5,
              wy + 0.4,
              wz + 0.5,
              drop,
              def.dropCount ?? 1
            );
          }
        }
      }
    }

    // Check progression milestones
    if (
      blockId === BlockId.OakLog ||
      blockId === BlockId.BirchLog ||
      blockId === BlockId.SpruceLog
    ) {
      this.unlockMilestone('gather_wood');
    } else if (blockId === BlockId.Stone || blockId === BlockId.Cobblestone) {
      this.unlockMilestone('mine_cobble');
    } else if (blockId === BlockId.DiamondOre) {
      this.unlockMilestone('find_diamond');
    }
  }

  performSecondaryAction(): boolean {
    this.swingProgress = 1.0;
    const hit = this.currentTargetHit;
    const held = this.inventory[this.selectedHotbar];
    const sneak = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    // 1. Interactive Target Blocks (unless holding Shift to place block against station!)
    if (hit && !sneak) {
      if (hit.blockId === BlockId.CraftingTable) {
        this.nearCraftingTable = true;
        this.activeFurnaceKey = null;
        this.openInventoryUI();
        return true;
      }
      if (hit.blockId === BlockId.Furnace) {
        const key = `${hit.wx},${hit.wy},${hit.wz}`;
        if (!this.furnaces.has(key)) {
          this.furnaces.set(key, {
            key,
            input: null,
            fuel: null,
            output: null,
            burnRemaining: 0,
            burnTotal: 1,
            cookProgress: 0,
          });
        }
        this.activeFurnaceKey = key;
        this.openInventoryUI();
        return true;
      }
      if (hit.blockId === BlockId.TNT) {
        this.igniteTNTBlock(hit.wx, hit.wy, hit.wz);
        return true;
      }
    }

    if (!held) return false;
    const itemDef = ITEMS[held.itemId];

    // 2. Edible Food Consumption
    if (itemDef.foodRestore && (this.hunger < this.maxHunger || this.health < this.maxHealth)) {
      this.hunger = Math.min(this.maxHunger, this.hunger + itemDef.foodRestore);
      this.health = Math.min(
        this.maxHealth,
        this.health + (itemDef.healthRestore ?? 2)
      );
      this.sound.playMaterialSound('grass', 'place');
      if (this.meta.mode === 'survival') {
        held.count -= 1;
        if (held.count <= 0) this.inventory[this.selectedHotbar] = null;
      }
      this.showToast(`Ate ${itemDef.name} (+${itemDef.healthRestore ?? 2} HP)`);
      return true;
    }

    // 3. Voxel Block Placement
    if (hit && itemDef.blockId !== undefined) {
      // Allow replacing tall grass directly or placing on adjacent face
      const replaceTarget = hit.blockId === BlockId.TallGrass;
      const px = replaceTarget ? hit.wx : hit.wx + hit.nx;
      const py = replaceTarget ? hit.wy : hit.wy + hit.ny;
      const pz = replaceTarget ? hit.wz : hit.wz + hit.nz;

      if (py < 0 || py >= WORLD_HEIGHT) return false;
      const currentAtDest = this.getBlock(px, py, pz);
      if (
        currentAtDest !== BlockId.Air &&
        currentAtDest !== BlockId.Water &&
        currentAtDest !== BlockId.TallGrass
      ) {
        return false;
      }

      const placeDef = BLOCKS[itemDef.blockId];
      if (placeDef.solid && wouldBlockOverlapPlayer(px, py, pz, this.player)) {
        return false;
      }

      this.setBlock(px, py, pz, itemDef.blockId);
      this.sound.playMaterialSound(placeDef.soundMaterial, 'place');

      if (this.meta.mode === 'survival') {
        held.count -= 1;
        if (held.count <= 0) this.inventory[this.selectedHotbar] = null;
      }

      if (itemDef.blockId === BlockId.CraftingTable) {
        this.unlockMilestone('craft_table');
      } else if (itemDef.blockId === BlockId.Torch) {
        this.unlockMilestone('craft_torch');
      }
      return true;
    }

    return false;
  }

  igniteTNTBlock(wx: number, wy: number, wz: number, initialFuse = 3.0): void {
    this.setBlock(wx, wy, wz, BlockId.Air);
    this.sound.playHiss();
    const id = `tnt_${this.nextEntityId++}`;
    const entity: ActiveTNT = {
      id,
      x: wx + 0.5,
      y: wy + 0.5,
      z: wz + 0.5,
      vx: (Math.random() - 0.5) * 1.6,
      vy: 4.2,
      vz: (Math.random() - 0.5) * 1.6,
      fuse: initialFuse,
    };
    this.activeTNTs.push(entity);

    if (this.container) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.96, 0.96, 0.96),
        new THREE.MeshLambertMaterial({ color: 0xef4444 })
      );
      mesh.position.set(entity.x, entity.y, entity.z);
      this.scene.add(mesh);
      this.tntMeshes.set(id, mesh);
    }
  }

  private updateActiveTNT(dt: number): void {
    for (let i = this.activeTNTs.length - 1; i >= 0; i--) {
      const t = this.activeTNTs[i];
      t.fuse -= dt;
      t.vy -= 24 * dt;

      const ny = t.y + t.vy * dt;
      if (isSolidBlock(this.getBlock(Math.floor(t.x), Math.floor(ny - 0.48), Math.floor(t.z)))) {
        t.y = Math.floor(ny - 0.48) + 1.48;
        t.vy = 0;
        t.vx *= 0.85;
        t.vz *= 0.85;
      } else {
        t.y = ny;
      }
      t.x += t.vx * dt;
      t.z += t.vz * dt;

      const mesh = this.tntMeshes.get(t.id);
      if (mesh) {
        mesh.position.set(t.x, t.y, t.z);
        const flash = Math.floor(t.fuse * 10) % 2 === 0;
        const s = 1 + (1 - Math.max(0, t.fuse) / 3.0) * 0.14;
        mesh.scale.set(s, s, s);
        (mesh.material as THREE.MeshLambertMaterial).color.setHex(
          flash ? 0xffffff : 0xdc2626
        );
      }

      if (t.fuse <= 0) {
        this.activeTNTs.splice(i, 1);
        if (mesh) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
          this.tntMeshes.delete(t.id);
        }
        this.detonateExplosion(t.x, t.y, t.z, 3.8);
      }
    }
  }

  detonateExplosion(cx: number, cy: number, cz: number, radius: number): void {
    this.sound.playExplosion();
    this.particles?.emitExplosion(cx, cy, cz);

    const rInt = Math.ceil(radius);
    const affectedChunks = new Set<ChunkData>();

    for (let dy = -rInt; dy <= rInt; dy++) {
      for (let dz = -rInt; dz <= rInt; dz++) {
        for (let dx = -rInt; dx <= rInt; dx++) {
          const dist = Math.hypot(dx, dy, dz);
          if (dist > radius) continue;
          const wx = Math.floor(cx) + dx;
          const wy = Math.floor(cy) + dy;
          const wz = Math.floor(cz) + dz;
          if (wy <= 0 || wy >= WORLD_HEIGHT) continue;

          const b = this.getBlock(wx, wy, wz);
          if (b === BlockId.Air || b === BlockId.Bedrock || b === BlockId.Water) continue;

          if (b === BlockId.TNT) {
            this.igniteTNTBlock(wx, wy, wz, 0.55 + Math.random() * 0.5);
            continue;
          }

          const chX = worldToChunkCoord(wx);
          const chZ = worldToChunkCoord(wz);
          const chunk = this.chunks.get(chunkKey(chX, chZ));
          if (chunk) {
            chunk.setBlock(worldToLocalCoord(wx), wy, worldToLocalCoord(wz), BlockId.Air);
            this.modifiedBlocks.set(`${wx},${wy},${wz}`, BlockId.Air);
            affectedChunks.add(chunk);
            if (Math.random() < 0.35) {
              const drop = BLOCKS[b].dropItem === undefined ? blockItemId(b) : BLOCKS[b].dropItem;
              if (drop) this.spawnDroppedItem(wx + 0.5, wy + 0.5, wz + 0.5, drop, 1);
            }
          }
        }
      }
    }

    // Batch re-light and re-mesh once for silky explosion performance!
    for (const c of affectedChunks) {
      computeChunkLighting(c, this.getChunkLookup, this.litFurnaces);
    }
    for (const c of affectedChunks) {
      this.rebuildChunkMesh(c);
    }

    // Player blast knockback & damage
    const distP = Math.hypot(this.player.x - cx, this.player.y + 0.9 - cy, this.player.z - cz);
    if (distP < radius * 1.9 && this.meta.mode === 'survival') {
      const factor = 1 - distP / (radius * 1.9);
      const dmg = Math.round(factor * 13);
      const inv = 1 / Math.max(0.2, distP);
      this.applyPlayerDamage(
        dmg,
        (this.player.x - cx) * inv * 10 * factor,
        (this.player.z - cz) * inv * 10 * factor
      );
      this.player.vy += 6.5 * factor;
    }
  }

  spawnDroppedItem(
    x: number,
    y: number,
    z: number,
    itemId: ItemId,
    count: number,
    pickupDelay = 0.28,
    vx?: number,
    vy?: number,
    vz?: number
  ): void {
    const id = `drop_${this.nextEntityId++}`;
    const ent: DroppedItemEntity = {
      id,
      itemId,
      count,
      x,
      y,
      z,
      vx: vx ?? (Math.random() - 0.5) * 1.35,
      vy: vy ?? 2.8 + Math.random() * 1.2,
      vz: vz ?? (Math.random() - 0.5) * 1.35,
      age: 0,
      pickupDelay,
    };
    this.droppedItems.push(ent);

    if (this.container) {
      const def = ITEMS[itemId];
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.28, 0.28),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(def?.accentColor ?? '#ffffff') })
      );
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.droppedMeshes.set(id, mesh);
    }
  }

  private updateDroppedItems(dt: number): void {
    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const d = this.droppedItems[i];
      d.age += dt;
      d.pickupDelay = Math.max(0, d.pickupDelay - dt);

      d.vy = Math.max(-20, d.vy - 18 * dt);
      const ny = d.y + d.vy * dt;
      if (isSolidBlock(this.getBlock(Math.floor(d.x), Math.floor(ny - 0.16), Math.floor(d.z)))) {
        d.y = Math.floor(ny - 0.16) + 1.16;
        d.vy = 0;
        d.vx *= 0.78;
        d.vz *= 0.78;
      } else {
        d.y = ny;
      }
      d.x += d.vx * dt;
      d.z += d.vz * dt;

      // Magnetic pickup toward player!
      const dx = this.player.x - d.x;
      const dy = this.player.y + 0.9 - d.y;
      const dz = this.player.z - d.z;
      const dist = Math.hypot(dx, dy, dz);

      if (d.pickupDelay <= 0 && dist < 3.8) {
        const pull = 14 * dt;
        d.x += (dx / Math.max(0.1, dist)) * pull;
        d.y += (dy / Math.max(0.1, dist)) * pull;
        d.z += (dz / Math.max(0.1, dist)) * pull;

        if (dist < 1.25) {
          const leftover = addItemToInventory(this.inventory, d.itemId, d.count, d.durability);
          if (leftover < d.count) {
            this.sound.playPickup();
            if (d.itemId === 'diamond') this.unlockMilestone('find_diamond');
            if (leftover === 0) {
              this.removeDroppedItemAt(i);
              continue;
            } else {
              d.count = leftover;
            }
          }
        }
      }

      if (d.age > 180) {
        this.removeDroppedItemAt(i);
        continue;
      }

      const mesh = this.droppedMeshes.get(d.id);
      if (mesh) {
        mesh.position.set(d.x, d.y + Math.sin(d.age * 3.2) * 0.08, d.z);
        mesh.rotation.y = d.age * 2.1;
      }
    }
  }

  private removeDroppedItemAt(idx: number): void {
    const d = this.droppedItems[idx];
    this.droppedItems.splice(idx, 1);
    const mesh = this.droppedMeshes.get(d.id);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.droppedMeshes.delete(d.id);
    }
  }

  dropActiveItem(): void {
    const slot = this.inventory[this.selectedHotbar];
    if (!slot) return;
    const [dx, dy, dz] = this.getLookDirection();
    const [ex, ey, ez] = this.getEyePosition();
    this.spawnDroppedItem(
      ex + dx * 0.5,
      ey - 0.2,
      ez + dz * 0.5,
      slot.itemId,
      1,
      1.1,
      dx * 5.2,
      dy * 4.0 + 1.8,
      dz * 5.2
    );
    slot.count -= 1;
    if (slot.count <= 0) this.inventory[this.selectedHotbar] = null;
    this.emitHUD();
  }

  private damageToolDurability(): void {
    const slot = this.inventory[this.selectedHotbar];
    if (!slot) return;
    const def = ITEMS[slot.itemId];
    if (!def.maxDurability) return;
    slot.durability = (slot.durability ?? def.maxDurability) - 1;
    if (slot.durability <= 0) {
      this.inventory[this.selectedHotbar] = null;
      this.sound.playMaterialSound('wood', 'break');
      this.showToast(`Your ${def.name} broke!`);
    }
  }

  private applyPlayerDamage(amount: number, knockX: number, knockZ: number): void {
    if (amount <= 0 || this.gameOver) return;
    this.health = Math.max(0, this.health - amount);
    this.player.vx += knockX;
    this.player.vz += knockZ;
    this.damageFlash = 1.0;
    this.sound.playHurt();

    if (this.health <= 0) {
      this.gameOver = true;
      this.releasePointerLock();
      this.emitHUD();
    }
  }

  respawnPlayer(): void {
    const spawn = this.generator.findSpawnPosition();
    this.player.x = spawn.x;
    this.player.y = spawn.y;
    this.player.z = spawn.z;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.vz = 0;
    this.player.highestAirY = spawn.y;
    this.ensurePlayerSafeHeight();
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this.breath = this.maxBreath;
    this.gameOver = false;
    this.paused = false;
    this.emitHUD();
    this.requestPointerLock();
  }

  private getBlockFromKey(key: string): BlockId {
    const [x, y, z] = key.split(',').map(Number);
    return this.getBlock(x, y, z);
  }

  private findNearbyBlockCoords(
    target: BlockId,
    radius: number
  ): [number, number, number] | null {
    const px = Math.floor(this.player.x);
    const py = Math.floor(this.player.y + 0.8);
    const pz = Math.floor(this.player.z);
    let best: [number, number, number] | null = null;
    let bestDistSq = Infinity;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (this.getBlock(px + dx, py + dy, pz + dz) === target) {
            const dSq = dx * dx + dy * dy + dz * dz;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              best = [px + dx, py + dy, pz + dz];
            }
          }
        }
      }
    }
    return best;
  }

  private hasNearbyBlock(target: BlockId, radius: number): boolean {
    return this.findNearbyBlockCoords(target, radius) !== null;
  }

  // Crafting, Inventory & Furnace UI Actions
  craft(recipeId: string, times = 1): boolean {
    const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return false;
    let craftedAny = false;
    for (let i = 0; i < times; i++) {
      if (craftRecipeOnce(recipe, this.inventory, this.nearCraftingTable)) {
        craftedAny = true;
      } else {
        break;
      }
    }
    if (craftedAny) {
      this.sound.playChime(false);
      if (recipe.id.endsWith('_planks')) this.unlockMilestone('craft_planks');
      if (recipe.id === 'crafting_table') this.unlockMilestone('craft_table');
      if (recipe.id === 'wood_pickaxe') this.unlockMilestone('wood_pickaxe');
      if (recipe.id === 'torches' || recipe.id === 'charcoal_torches') {
        this.unlockMilestone('craft_torch');
      }
      this.emitHUD();
    }
    return craftedAny;
  }

  giveCreativeItem(itemId: ItemId, count = 64): void {
    if (this.meta.mode !== 'creative') return;
    const def = ITEMS[itemId];
    if (!def) return;
    // Place in selected hotbar slot or add to inventory
    if (!this.inventory[this.selectedHotbar]) {
      this.inventory[this.selectedHotbar] = {
        itemId,
        count: Math.min(def.maxStack, count),
      };
    } else {
      addItemToInventory(this.inventory, itemId, Math.min(def.maxStack, count));
    }
    this.sound.playPickup();
    this.emitHUD();
  }

  moveInventorySlot(fromIndex: number, toIndex: number, halfSplit = false): void {
    if (fromIndex === toIndex) return;
    const a = this.inventory[fromIndex];
    const b = this.inventory[toIndex];
    if (!a) return;

    if (halfSplit && !b && a.count > 1) {
      const moveCount = Math.ceil(a.count / 2);
      a.count -= moveCount;
      this.inventory[toIndex] = { ...a, count: moveCount };
      this.emitHUD();
      return;
    }

    if (b && a.itemId === b.itemId && ITEMS[a.itemId].maxStack > 1) {
      const space = ITEMS[a.itemId].maxStack - b.count;
      const move = Math.min(space, a.count);
      b.count += move;
      a.count -= move;
      if (a.count <= 0) this.inventory[fromIndex] = null;
      this.emitHUD();
      return;
    }

    this.inventory[fromIndex] = b;
    this.inventory[toIndex] = a;
    this.emitHUD();
  }

  quickTransferInventorySlot(index: number): void {
    const slot = this.inventory[index];
    if (!slot) return;
    const targetRange = index < 9 ? [9, 36] : [0, 9];
    for (let i = targetRange[0]; i < targetRange[1]; i++) {
      const dest = this.inventory[i];
      if (dest && dest.itemId === slot.itemId && dest.count < ITEMS[slot.itemId].maxStack) {
        const move = Math.min(ITEMS[slot.itemId].maxStack - dest.count, slot.count);
        dest.count += move;
        slot.count -= move;
        if (slot.count <= 0) {
          this.inventory[index] = null;
          this.emitHUD();
          return;
        }
      }
    }
    for (let i = targetRange[0]; i < targetRange[1]; i++) {
      if (this.inventory[i] === null) {
        this.inventory[i] = slot;
        this.inventory[index] = null;
        this.emitHUD();
        return;
      }
    }
  }

  transferToFurnace(invIndex: number, role: 'input' | 'fuel'): boolean {
    if (!this.activeFurnaceKey) return false;
    const f = this.furnaces.get(this.activeFurnaceKey);
    const src = this.inventory[invIndex];
    if (!f || !src) return false;

    const existing = f[role];
    if (!existing) {
      f[role] = { ...src };
      this.inventory[invIndex] = null;
      this.emitHUD();
      return true;
    }
    if (existing.itemId === src.itemId) {
      const maxS = ITEMS[src.itemId].maxStack;
      const move = Math.min(maxS - existing.count, src.count);
      existing.count += move;
      src.count -= move;
      if (src.count <= 0) this.inventory[invIndex] = null;
      this.emitHUD();
      return true;
    }
    return false;
  }

  collectFromFurnace(role: 'input' | 'fuel' | 'output'): boolean {
    if (!this.activeFurnaceKey) return false;
    const f = this.furnaces.get(this.activeFurnaceKey);
    if (!f || !f[role]) return false;
    const slot = f[role]!;
    const leftover = addItemToInventory(this.inventory, slot.itemId, slot.count);
    if (leftover === 0) {
      f[role] = null;
    } else {
      slot.count = leftover;
    }
    if (role === 'output') {
      this.sound.playPickup();
      if (slot.itemId === 'iron_ingot' || slot.itemId === 'gold_ingot') {
        this.unlockMilestone('smelt_ingot');
      }
    }
    this.emitHUD();
    return true;
  }

  private unlockMilestone(id: string): void {
    if (this.completedMilestones.has(id)) return;
    this.completedMilestones.add(id);
    const step = DEFAULT_MILESTONES.find((m) => m.id === id);
    if (step) {
      this.sound.playChime(true);
      this.showToast(`Milestone Unlocked: ${step.title}!`);
    }
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    this.toastTimer = 3.6;
  }

  private computeDayLightFactor(): number {
    // 0.25 = sunrise, 0.50 = noon, 0.75 = sunset, 0.0 = midnight
    const sunElev = Math.sin((this.timeOfDay - 0.25) * Math.PI * 2);
    const raw = THREE.MathUtils.clamp(sunElev * 1.45 + 0.52, 0.11, 1.0);
    return this.weather === 'clear' ? raw : raw * 0.8;
  }

  private updateVisualFrame(dt: number): void {
    const [ex, ey, ez] = this.getEyePosition();
    this.camera.position.set(ex, ey, ez);
    this.camera.rotation.y = this.player.yaw;
    this.camera.rotation.x = this.player.pitch;

    // Sprint dynamic FOV kick
    const sprinting =
      (this.keys.has('ControlLeft') || this.keys.has('ControlRight')) &&
      this.keys.has('KeyW');
    const targetFov = this.settings.fov + (sprinting ? 6 : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, 10 * dt);
      this.camera.updateProjectionMatrix();
    }

    // Atmosphere, Sun, Moon, Stars & Uniforms
    const angle = (this.timeOfDay - 0.25) * Math.PI * 2;
    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle);
    const dayFactor = this.computeDayLightFactor();

    this.sunMesh.position.set(
      this.player.x + sunX * 225,
      this.player.y + sunY * 225,
      this.player.z - 40
    );
    this.sunMesh.visible = sunY > -0.18 && !this.player.headUnderwater;

    this.moonMesh.position.set(
      this.player.x - sunX * 225,
      this.player.y - sunY * 225,
      this.player.z + 40
    );
    this.moonMesh.visible = sunY < 0.18 && !this.player.headUnderwater;

    this.starsPoints.position.set(this.player.x, this.player.y * 0.2, this.player.z);
    const starMat = this.starsPoints.material as THREE.PointsMaterial;
    starMat.opacity =
      this.weather === 'clear' && !this.player.headUnderwater
        ? THREE.MathUtils.clamp(-sunY * 1.6, 0, 0.9)
        : 0;

    // Drift voxel clouds slowly
    for (const child of this.cloudGroup.children) {
      child.position.x += dt * 1.4;
      if (child.position.x > this.player.x + 170) child.position.x -= 340;
      if (child.position.x < this.player.x - 170) child.position.x += 340;
      if (child.position.z > this.player.z + 170) child.position.z -= 340;
      if (child.position.z < this.player.z - 170) child.position.z += 340;
    }
    const cloudMat = (this.cloudGroup.children[0] as THREE.Mesh)
      .material as THREE.MeshBasicMaterial;
    cloudMat.color.setScalar(Math.max(0.22, dayFactor));

    // Sky & Fog colors across dawn / day / dusk / night / rain / underwater
    const sunsetGlow = Math.max(0, 1 - Math.abs(sunY) * 3.4);
    const dayTop = new THREE.Color('#2b74eb');
    const dayHorizon = new THREE.Color('#9ad0ff');
    const nightTop = new THREE.Color('#070d1f');
    const nightHorizon = new THREE.Color('#13203d');
    const duskColor = new THREE.Color('#fb923c');

    const topCol = nightTop.clone().lerp(dayTop, THREE.MathUtils.smoothstep(sunY, -0.22, 0.28));
    const horCol = nightHorizon
      .clone()
      .lerp(dayHorizon, THREE.MathUtils.smoothstep(sunY, -0.22, 0.28))
      .lerp(duskColor, sunsetGlow * 0.58);

    if (this.weather !== 'clear') {
      topCol.lerp(new THREE.Color('#475569'), 0.65);
      horCol.lerp(new THREE.Color('#64748b'), 0.65);
    }

    if (this.player.headUnderwater) {
      topCol.set('#0c4a6e');
      horCol.set('#0284c7');
    }

    this.skyMat.uniforms.uTopColor.value.copy(topCol);
    this.skyMat.uniforms.uHorizonColor.value.copy(horCol);

    const u = this.materials.uniforms;
    u.uTime.value += dt;
    u.uDayLight.value = dayFactor;
    u.uFogColor.value.copy(horCol);
    const maxFog = this.player.headUnderwater ? 22 : this.settings.renderDistance * CHUNK_SIZE;
    u.uFogNear.value = maxFog * 0.56;
    u.uFogFar.value = maxFog * 0.98;
    u.uPlayerPos.value.set(ex, ey, ez);

    // Sky tint warms slightly during golden sunrise/sunset and cools slightly at night
    u.uSkyTint.value
      .set('#ffffff')
      .lerp(new THREE.Color('#ffd9a8'), sunsetGlow * 0.45)
      .lerp(new THREE.Color('#9dbaf8'), THREE.MathUtils.clamp(-sunY, 0, 1) * 0.45);

    // Dynamic handheld Torch / Sunstone Crystal light!
    const heldSlot = this.inventory[this.selectedHotbar];
    const heldBlock = heldSlot ? ITEMS[heldSlot.itemId]?.blockId : undefined;
    const isLightItem =
      heldBlock === BlockId.Torch || heldBlock === BlockId.Glowstone;
    u.uHeldLight.value = isLightItem ? 0.92 : 0.0;

    // Emit ambient torch embers around handheld torch occasionally
    if (isLightItem) {
      this.emberTimer -= dt;
      if (this.emberTimer <= 0) {
        this.emberTimer = 0.22;
        const [lx, ly, lz] = this.getLookDirection();
        this.particles?.emitEmber(ex + lx * 0.55, ey - 0.12 + ly * 0.4, ez + lz * 0.55);
      }
    }

    // Target Wireframe & Progressive Crack Overlay
    if (this.currentTargetHit && !this.inventoryOpen) {
      const h = this.currentTargetHit;
      this.highlightBox.visible = true;
      this.highlightBox.position.set(h.wx + 0.5, h.wy + 0.5, h.wz + 0.5);

      if (this.miningProgress > 0.02) {
        const stage = Math.min(9, Math.floor(this.miningProgress * 10));
        (this.crackOverlay.material as THREE.MeshBasicMaterial).map =
          this.atlas.crackTextures[stage];
        (this.crackOverlay.material as THREE.MeshBasicMaterial).needsUpdate = true;
        this.crackOverlay.position.set(h.wx + 0.5, h.wy + 0.5, h.wz + 0.5);
        this.crackOverlay.visible = true;
      } else {
        this.crackOverlay.visible = false;
      }
    } else {
      this.highlightBox.visible = false;
      this.crackOverlay.visible = false;
    }

    // First-person Hand / Held Item Viewmodel
    this.updateHandViewmodel();
    const walkSpeed = Math.hypot(this.player.vx, this.player.vz);
    const bobT = u.uTime.value * 8.5;
    const bobAmt = this.player.onGround && !this.player.flying ? Math.min(1, walkSpeed / 4.5) : 0;
    const swing = Math.sin(this.swingProgress * Math.PI);
    this.handRoot.position.set(
      0.42 + Math.cos(bobT * 0.5) * 0.025 * bobAmt - swing * 0.14,
      -0.36 + Math.abs(Math.sin(bobT)) * 0.03 * bobAmt - swing * 0.08,
      -0.62 - swing * 0.16
    );
    this.handRoot.rotation.set(
      -swing * 0.95,
      swing * 0.35,
      -swing * 0.35
    );

    this.particles?.update(
      dt,
      this.player.x,
      this.player.y,
      this.player.z,
      this.weather,
      this.getBlock
    );
  }

  private updateHandViewmodel(): void {
    const slot = this.inventory[this.selectedHotbar];
    const sig = slot ? slot.itemId : 'empty_hand';
    if (sig === this.lastHandSignature) return;
    this.lastHandSignature = sig;

    // Clear previous held mesh cleanly
    while (this.handItemGroup.children.length > 0) {
      const c = this.handItemGroup.children[0] as THREE.Mesh;
      this.handItemGroup.remove(c);
      c.geometry.dispose();
      if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
      else c.material.dispose();
    }

    if (!slot) {
      // Voxel explorer right forearm
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.16, 0.52),
        new THREE.MeshLambertMaterial({ color: 0xe0ac86 })
      );
      arm.rotation.set(0.28, -0.35, -0.18);
      arm.position.set(0.06, -0.05, 0.08);
      this.handItemGroup.add(arm);
      return;
    }

    const def = ITEMS[slot.itemId];
    if (def.blockId !== undefined && BLOCKS[def.blockId].shape === 'cube') {
      // Build authentic UV-mapped miniature 3D Voxel Block!
      const b = BLOCKS[def.blockId];
      const geom = new THREE.BoxGeometry(0.28, 0.28, 0.28);
      const uvAttr = geom.attributes.uv;
      // Three.js BoxGeometry face order: [+X(east), -X(west), +Y(top), -Y(bottom), +Z(south), -Z(north)]
      const faceMap = [b.faces[4], b.faces[5], b.faces[0], b.faces[1], b.faces[3], b.faces[2]];
      for (let f = 0; f < 6; f++) {
        const [u0, v0, u1, v1] = getTileUVRect(faceMap[f]);
        const idx = f * 4;
        uvAttr.setXY(idx + 0, u0, v0);
        uvAttr.setXY(idx + 1, u1, v0);
        uvAttr.setXY(idx + 2, u0, v1);
        uvAttr.setXY(idx + 3, u1, v1);
      }
      uvAttr.needsUpdate = true;
      const mat = new THREE.MeshLambertMaterial({
        map: this.atlas.texture,
        transparent: b.renderPass !== 'opaque',
        alphaTest: b.renderPass === 'cutout' ? 0.45 : 0,
      });
      const cube = new THREE.Mesh(geom, mat);
      cube.rotation.set(0.22, 0.65, 0.08);
      this.handItemGroup.add(cube);
      return;
    }

    if (def.blockId === BlockId.Torch) {
      const stick = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.36, 0.07),
        new THREE.MeshLambertMaterial({ color: 0x8a6236 })
      );
      stick.rotation.set(0.25, 0, -0.2);
      const flame = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.09, 0.09),
        new THREE.MeshBasicMaterial({ color: 0xffd15c })
      );
      flame.position.set(0.04, 0.19, 0.045);
      this.handItemGroup.add(stick, flame);
      return;
    }

    // Held Voxel Tool / Sword / Item
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.4, 0.055),
      new THREE.MeshLambertMaterial({ color: def.secondaryColor ?? '#7c5832' })
    );
    handle.rotation.set(0.45, -0.25, 0.2);
    this.handItemGroup.add(handle);

    const headMat = new THREE.MeshLambertMaterial({ color: def.accentColor });
    if (def.toolCategory === 'pickaxe') {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.065, 0.065), headMat);
      bar.position.set(-0.04, 0.16, -0.08);
      bar.rotation.set(0.45, -0.25, 0.2);
      this.handItemGroup.add(bar);
    } else if (def.toolCategory === 'sword') {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.035), headMat);
      blade.position.set(-0.04, 0.18, -0.09);
      blade.rotation.set(0.45, -0.25, 0.2);
      this.handItemGroup.add(blade);
    } else {
      const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.1), headMat);
      headMesh.position.set(-0.04, 0.15, -0.08);
      this.handItemGroup.add(headMesh);
    }
  }

  private readPlayerInput(): PlayerInputState {
    if (this.inventoryOpen || this.paused || this.gameOver) {
      return { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false };
    }
    const forward = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const strafe = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const jump = this.keys.has('Space');
    const sneak = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const sprint = this.keys.has('ControlLeft') || this.keys.has('ControlRight');
    return { forward, strafe, jump, sneak, sprint };
  }

  // Input Event Listeners
  private handleResize = (): void => {
    if (!this.container || !this.renderer) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handlePointerLockChange = (): void => {
    this.pointerLocked =
      Boolean(this.renderer) && document.pointerLockElement === this.renderer!.domElement;
    if (!this.pointerLocked && !this.inventoryOpen && !this.gameOver && this.ready) {
      this.paused = true;
      this.mouseLeftDown = false;
      this.keys.clear();
    }
    this.emitHUD();
  };

  requestPointerLock(): void {
    this.sound.unlock();
    if (!this.renderer) return;
    try {
      this.renderer.domElement.requestPointerLock();
    } catch {
      // ignore if user gesture needed
    }
  }

  releasePointerLock(): void {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        // ignore
      }
    }
  }

  openInventoryUI(): void {
    this.inventoryOpen = true;
    this.paused = false;
    this.mouseLeftDown = false;
    this.keys.clear();
    this.releasePointerLock();
    this.emitHUD();
  }

  closeInventoryUI(): void {
    this.inventoryOpen = false;
    this.emitHUD();
    this.requestPointerLock();
  }

  resumeGame(): void {
    this.paused = false;
    this.inventoryOpen = false;
    this.activeFurnaceKey = null;
    this.emitHUD();
    this.requestPointerLock();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) this.releasePointerLock();
    this.emitHUD();
  }

  updateSettings(next: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...next };
    this.sound.volume = this.settings.soundVolume;
    this.sound.musicEnabled = this.settings.musicEnabled;
    if (next.renderDistance !== undefined) {
      this.queueCenterCX = 999999; // trigger re-evaluation of chunk stream radius
    }
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
    this.emitHUD();
  }

  setGameMode(mode: GameMode): void {
    this.meta.mode = mode;
    if (mode === 'creative') {
      this.health = this.maxHealth;
      this.hunger = this.maxHunger;
      for (const itemId of CREATIVE_PALETTE.slice(0, 9)) {
        if (!this.inventory[0]) {
          addItemToInventory(this.inventory, itemId, ITEMS[itemId].maxStack);
        }
      }
    } else {
      this.player.flying = false;
    }
    this.showToast(`Switched to ${mode === 'creative' ? 'Creative' : 'Survival'} Mode`);
    this.emitHUD();
  }

  setTimePreset(timeOfDay: number, label: string): void {
    this.timeOfDay = timeOfDay;
    this.showToast(`Time set to ${label}`);
    this.emitHUD();
  }

  setWeatherPreset(weather: WeatherKind): void {
    this.weather = weather;
    this.weatherTimer = 150;
    this.showToast(`Weather set to ${weather}`);
    this.emitHUD();
  }

  toggleFlight(): void {
    this.player.flying = !this.player.flying;
    this.player.vy = 0;
    this.showToast(this.player.flying ? 'Flight Enabled (Space/Shift)' : 'Flight Disabled');
    this.emitHUD();
  }

  selectHotbar(slotIndex: number): void {
    this.selectedHotbar = ((slotIndex % 9) + 9) % 9;
    this.emitHUD();
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.ready || this.gameOver) return;
    this.sound.unlock();

    if (e.code === 'KeyE') {
      e.preventDefault();
      if (this.inventoryOpen) this.closeInventoryUI();
      else this.openInventoryUI();
      return;
    }

    if (e.code === 'Escape') {
      if (this.inventoryOpen) {
        this.closeInventoryUI();
      } else {
        this.paused = !this.paused;
        if (this.paused) this.releasePointerLock();
        else this.requestPointerLock();
        this.emitHUD();
      }
      return;
    }

    if (e.code === 'F3') {
      e.preventDefault();
      this.debugOpen = !this.debugOpen;
      this.emitHUD();
      return;
    }

    if (e.code === 'KeyH') {
      this.helpOpen = !this.helpOpen;
      this.emitHUD();
      return;
    }

    if (this.inventoryOpen || this.paused) return;

    if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5));
      if (n >= 1 && n <= 9) {
        this.selectHotbar(n - 1);
        return;
      }
    }

    if (e.code === 'KeyQ') {
      this.dropActiveItem();
      return;
    }

    if (e.code === 'KeyF') {
      this.toggleFlight();
      return;
    }

    // Double-tap Space also toggles Flight in Creative mode!
    if (e.code === 'Space' && !e.repeat) {
      const now = performance.now();
      if (now - this.lastSpacePressTime < 280 && this.meta.mode === 'creative') {
        this.toggleFlight();
      }
      this.lastSpacePressTime = now;
    }

    this.keys.add(e.code);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked || this.paused || this.inventoryOpen || this.gameOver) return;
    const sens = 0.0022 * this.settings.mouseSensitivity;
    this.player.yaw -= e.movementX * sens;
    const ySign = this.settings.invertY ? 1 : -1;
    this.player.pitch = THREE.MathUtils.clamp(
      this.player.pitch + e.movementY * sens * ySign,
      -Math.PI / 2 + 0.02,
      Math.PI / 2 - 0.02
    );
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (!this.ready || this.inventoryOpen || this.paused || this.gameOver) return;
    this.sound.unlock();
    if (!this.pointerLocked) {
      this.requestPointerLock();
      return;
    }
    if (e.button === 0) {
      this.mouseLeftDown = true;
    } else if (e.button === 2) {
      this.mouseRightQueued = true;
    } else if (e.button === 1 && this.currentTargetHit) {
      // Middle-click block pick!
      const pickItem = blockItemId(this.currentTargetHit.blockId);
      const existingIdx = this.inventory.findIndex((s) => s?.itemId === pickItem);
      if (existingIdx >= 0 && existingIdx < 9) {
        this.selectHotbar(existingIdx);
      } else if (this.meta.mode === 'creative') {
        this.giveCreativeItem(pickItem, 64);
      }
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseLeftDown = false;
  };

  private handleWheel = (e: WheelEvent): void => {
    if (!this.pointerLocked || this.inventoryOpen || this.paused) return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    this.selectHotbar(this.selectedHotbar + dir);
  };

  private handleContextMenu = (e: MouseEvent): void => {
    if (!this.inventoryOpen) e.preventDefault();
  };

  serializeWorld(): WorldSaveData {
    const modArray: Array<[number, number, number, BlockId]> = [];
    for (const [k, bid] of this.modifiedBlocks.entries()) {
      const [x, y, z] = k.split(',').map(Number);
      modArray.push([x, y, z, bid]);
    }
    this.meta.dayCount = this.dayCount;
    this.meta.updatedAt = Date.now();

    return {
      meta: { ...this.meta },
      player: {
        x: this.player.x,
        y: this.player.y,
        z: this.player.z,
        yaw: this.player.yaw,
        pitch: this.player.pitch,
        health: this.health,
        maxHealth: this.maxHealth,
        hunger: this.hunger,
        maxHunger: this.maxHunger,
        breath: this.breath,
        flying: this.player.flying,
        selectedHotbar: this.selectedHotbar,
      },
      timeOfDay: this.timeOfDay,
      dayCount: this.dayCount,
      weather: this.weather,
      inventory: this.inventory.map((s) => (s ? { ...s } : null)),
      furnaces: [...this.furnaces.values()].map((f) => ({
        ...f,
        input: f.input ? { ...f.input } : null,
        fuel: f.fuel ? { ...f.fuel } : null,
        output: f.output ? { ...f.output } : null,
      })),
      milestones: [...this.completedMilestones],
      modifiedBlocks: modArray,
    };
  }

  getHUDState(): EngineHUDState {
    const activeFurnace = this.activeFurnaceKey
      ? this.furnaces.get(this.activeFurnaceKey) ?? null
      : null;
    const dayLight = this.computeDayLightFactor();

    return {
      ready: this.ready,
      loadingProgress: this.loadingProgress,
      loadingMessage: this.loadingMessage,
      pointerLocked: this.pointerLocked,
      paused: this.paused,
      inventoryOpen: this.inventoryOpen,
      nearCraftingTable: this.nearCraftingTable,
      activeFurnaceKey: this.activeFurnaceKey,
      activeFurnace: activeFurnace
        ? {
            ...activeFurnace,
            input: activeFurnace.input ? { ...activeFurnace.input } : null,
            fuel: activeFurnace.fuel ? { ...activeFurnace.fuel } : null,
            output: activeFurnace.output ? { ...activeFurnace.output } : null,
          }
        : null,
      gameOver: this.gameOver,
      mode: this.meta.mode,
      worldName: this.meta.name,
      seed: this.meta.seed,
      fps: this.currentFps,
      x: this.player.x,
      y: this.player.y,
      z: this.player.z,
      chunkX: worldToChunkCoord(this.player.x),
      chunkZ: worldToChunkCoord(this.player.z),
      loadedChunks: this.chunks.size,
      biome: this.getBiomeAt(Math.floor(this.player.x), Math.floor(this.player.z)),
      weather: this.weather,
      timeOfDay: this.timeOfDay,
      dayCount: this.dayCount,
      isNight: dayLight < 0.36,
      health: this.health,
      maxHealth: this.maxHealth,
      hunger: this.hunger,
      maxHunger: this.maxHunger,
      breath: this.breath,
      maxBreath: this.maxBreath,
      underwater: this.player.headUnderwater,
      flying: this.player.flying,
      sprinting:
        (this.keys.has('ControlLeft') || this.keys.has('ControlRight')) &&
        this.keys.has('KeyW'),
      selectedHotbar: this.selectedHotbar,
      inventory: this.inventory.map((s) => (s ? { ...s } : null)),
      targetBlockName: this.currentTargetHit
        ? BLOCKS[this.currentTargetHit.blockId].name
        : null,
      targetBlockCoords: this.currentTargetHit
        ? [
            this.currentTargetHit.wx,
            this.currentTargetHit.wy,
            this.currentTargetHit.wz,
          ]
        : null,
      breakProgress: this.miningProgress,
      damageFlash: this.damageFlash,
      milestones: DEFAULT_MILESTONES.map((m) => ({
        ...m,
        completed: this.completedMilestones.has(m.id),
      })),
      toastMessage: this.toastMessage,
      debugOpen: this.debugOpen,
      helpOpen: this.helpOpen,
      entityCount:
        this.mobs.states.length + this.droppedItems.length + this.activeTNTs.length,
    };
  }

  private emitHUD(): void {
    this.onHUDUpdate(this.getHUDState());
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
    }

    if (typeof window !== 'undefined' && this.container) {
      window.removeEventListener('resize', this.handleResize);
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
      window.removeEventListener('mousemove', this.handleMouseMove);
      window.removeEventListener('mousedown', this.handleMouseDown);
      window.removeEventListener('mouseup', this.handleMouseUp);
      window.removeEventListener('wheel', this.handleWheel);
      window.removeEventListener('contextmenu', this.handleContextMenu);
      document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    }

    this.releasePointerLock();
    for (const bundle of this.chunkMeshes.values()) {
      this.disposeChunkBundle(bundle);
    }
    this.chunkMeshes.clear();
    this.mobs.dispose();
    this.particles?.dispose();
    this.sound.dispose();

    this.materials.opaque.dispose();
    this.materials.cutout.dispose();
    this.materials.translucent.dispose();

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
      this.renderer = null;
    }
  }
}
