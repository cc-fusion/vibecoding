import * as THREE from 'three';
import { SoundEngine } from './audio';
import { ALL_CREATIVE_ITEMS, BLOCK, isLog, ITEMS } from './blocks';
import {
  Achievement,
  DAY_DURATION_SECONDS,
  GameHUDState,
  GameMode,
  HOTBAR_SIZE,
  InventorySlot,
  REACH_DISTANCE,
  WeatherType,
  WorldSaveMeta,
} from './constants';
import { EntityManager } from './entities';
import { ParticleSystem } from './particles';
import { MovementInput, PlayerPhysics } from './physics';
import { raycastVoxel, RaycastHit } from './raycast';
import {
  addItemToInventory,
  canCraftRecipe,
  consumeIngredient,
  CRAFTING_RECIPES,
  findFuelSlotIndex,
  SMELT_RECIPES,
} from './recipes';
import {
  createDefaultAchievements,
  createStarterInventory,
  SavedWorldPayload,
  saveWorldData,
} from './storage';
import { getAtlasTexture, getTileUV } from './textureAtlas';
import { VoxelWorld } from './world';

export class GameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private viewModelScene: THREE.Scene;
  private viewModelCamera: THREE.PerspectiveCamera;

  world: VoxelWorld;
  physics = new PlayerPhysics();
  particles = new ParticleSystem();
  entities = new EntityManager();
  audio = new SoundEngine();

  meta: WorldSaveMeta;
  inventory: (InventorySlot | null)[];
  selectedHotbar = 0;
  achievements: Achievement[];

  health = 20;
  maxHealth = 20;
  hunger = 20;
  maxHunger = 20;
  oxygen = 10;
  maxOxygen = 10;

  timeOfDay = 0.08; // Morning golden light
  dayCount = 1;
  weather: WeatherType = 'clear';
  fov = 75;

  paused = false;
  inventoryOpen = false;
  pointerLocked = false;
  isDead = false;
  ready = false;

  // Sky & Atmosphere Objects
  private skyDome!: THREE.Mesh;
  private skyUniforms!: {
    uTopColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
  };
  private celestialPivot = new THREE.Group();
  private sunMesh!: THREE.Mesh;
  private moonMesh!: THREE.Mesh;
  private starsPoints!: THREE.Points;
  private cloudsGroup = new THREE.Group();
  private weatherPoints!: THREE.Points;
  private entitySunLight!: THREE.DirectionalLight;
  private entityAmbientLight!: THREE.AmbientLight;

  // Selection Wireframe + Mining Crack Overlay
  private targetHighlight!: THREE.LineSegments;
  private breakOverlayMesh!: THREE.Mesh;

  // First-person Hand / Held Item Rig
  private handRig = new THREE.Group();
  private handMeshGroup = new THREE.Group();
  private lastRenderedHeldKey = '';
  private swingProgress = 0;
  private swinging = false;

  // Input & Mining State
  private keys = new Set<string>();
  private mouseLeftDown = false;
  private mouseRightDown = false;
  private lastMouseX: number | null = null;
  private lastMouseY: number | null = null;
  private rightDragMoved = false;
  private placeCooldown = 0;
  private attackCooldown = 0;
  private miningKey = '';
  private miningTimer = 0;
  private miningHitSoundTimer = 0;
  private currentHit: RaycastHit | null = null;
  private currentBreakProgress = 0;

  // Timers & Diagnostics
  private animFrameId = 0;
  private lastFrameTime = performance.now();
  private hudEmitTimer = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private currentFps = 60;
  private autoSaveTimer = 20;
  private weatherChangeTimer = 95;
  private survivalTickTimer = 1.0;
  private playerHurtCooldown = 0;
  private toastData: GameHUDState['toast'] = null;
  private toastTimer = 0;
  private toastSeq = 1;

  private onHUDUpdate: (state: GameHUDState) => void;
  private disposed = false;

  constructor(
    container: HTMLElement,
    initialData: {
      meta: WorldSaveMeta;
      saved?: SavedWorldPayload | null;
    },
    onHUDUpdate: (state: GameHUDState) => void
  ) {
    this.container = container;
    this.onHUDUpdate = onHUDUpdate;
    this.meta = initialData.meta;

    const saved = initialData.saved;
    this.inventory = saved?.inventory ?? createStarterInventory(this.meta.gameMode);
    this.achievements = saved?.achievements ?? createDefaultAchievements();
    this.timeOfDay = saved?.timeOfDay ?? 0.1;
    this.weather = saved?.weather ?? 'clear';

    // Renderer Setup
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.autoClear = false;
    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // Main Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      this.fov,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.08,
      450
    );
    this.camera.rotation.order = 'YXZ';

    // Viewmodel Scene & Camera (renders cleanly on top without clipping into walls!)
    this.viewModelScene = new THREE.Scene();
    this.viewModelCamera = new THREE.PerspectiveCamera(
      62,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.05,
      10
    );

    // World Setup
    this.world = new VoxelWorld(this.meta.seed, saved?.edits);
    this.scene.add(this.world.sceneGroup);
    this.scene.add(this.particles.mesh);
    this.scene.add(this.entities.group);

    this.setupSkyAndAtmosphere();
    this.setupSelectionOverlays();
    this.setupViewModel();
    this.bindEvents();
    (window as unknown as { __VOXEL_GAME__?: GameEngine }).__VOXEL_GAME__ = this;

    // Initialize World & Spawn asynchronously on next frame so loading bar renders cleanly
    this.emitHUD(5, 'Sculpting continents, caves & biomes...');
    requestAnimationFrame(() => {
      if (this.disposed) return;

      if (saved?.player) {
        this.physics.position.set(saved.player.x, saved.player.y, saved.player.z);
        this.physics.yaw = saved.player.yaw;
        this.physics.pitch = saved.player.pitch;
        this.health = saved.player.health ?? 20;
        this.hunger = saved.player.hunger ?? 20;
        this.physics.flying = saved.player.flying ?? this.meta.gameMode === 'creative';
        this.selectedHotbar = saved.player.selectedHotbar ?? 0;
      } else {
        const spawn = this.world.findSpawnPosition();
        this.physics.position.set(spawn.x, spawn.y, spawn.z);
        this.physics.flying = false;
        // Automatically face out across an open panoramic valley vista!
        this.physics.yaw = this.world.findScenicYaw(spawn.x, spawn.z);
        this.physics.pitch = -0.18;
      }

      this.world.prewarmAround(this.physics.position.x, this.physics.position.z, 4, (p) => {
        this.emitHUD(Math.round(p), 'Building ambient-occluded voxel meshes...');
      });

      // Spawn a few friendly creatures nearby so the world is immediately alive!
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + 0.3;
        const dist = 8 + (i % 3) * 5;
        const mx = Math.floor(this.physics.position.x + Math.cos(angle) * dist);
        const mz = Math.floor(this.physics.position.z + Math.sin(angle) * dist);
        const col = this.world.generator.sampleColumn(mx, mz);
        if (col.height > 35) {
          const kind = i % 3 === 0 ? 'sheep' : i % 3 === 1 ? 'pig' : 'cow';
          this.entities.spawnMob(kind, mx + 0.5, col.height + 1.1, mz + 0.5);
        }
      }

      this.ready = true;
      this.showToast(`Welcome to ${this.meta.name}`, 'Click the world to lock mouse & start exploring!', 'info');
      this.lastFrameTime = performance.now();
      this.emitHUD(100, 'Ready');
      this.loop();
    });
  }

  private setupSkyAndAtmosphere(): void {
    // 1. Gradient Sky Dome
    this.skyUniforms = {
      uTopColor: { value: new THREE.Color(0x3b82f6) },
      uHorizonColor: { value: new THREE.Color(0x93c5fd) },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vWorldDirection;
        void main() {
          vWorldDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        varying vec3 vWorldDirection;
        void main() {
          float h = clamp(vWorldDirection.y * 1.35 + 0.08, 0.0, 1.0);
          gl_FragColor = vec4(mix(uHorizonColor, uTopColor, pow(h, 0.72)), 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(320, 24, 16), skyMat);
    this.skyDome.frustumCulled = false;
    this.scene.add(this.skyDome);

    // 2. Orbiting Voxel Sun, Moon & Night Starfield
    this.scene.add(this.celestialPivot);

    this.sunMesh = new THREE.Mesh(
      new THREE.BoxGeometry(26, 26, 2),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    this.sunMesh.position.set(240, 0, 0);
    this.sunMesh.lookAt(0, 0, 0);
    this.celestialPivot.add(this.sunMesh);

    this.moonMesh = new THREE.Mesh(
      new THREE.BoxGeometry(20, 20, 2),
      new THREE.MeshBasicMaterial({ color: 0xe2e8f0 })
    );
    this.moonMesh.position.set(-240, 0, 0);
    this.moonMesh.lookAt(0, 0, 0);
    this.celestialPivot.add(this.moonMesh);

    const starPositions: number[] = [];
    for (let i = 0; i < 420; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 275;
      starPositions.push(
        r * Math.sin(phi) * Math.cos(theta),
        Math.abs(r * Math.cos(phi)) + 15,
        r * Math.sin(phi) * Math.sin(theta)
      );
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xf8fafc,
      size: 2.2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.starsPoints = new THREE.Points(starGeom, starMat);
    this.starsPoints.frustumCulled = false;
    this.scene.add(this.starsPoints);

    // 3. Fluffy Drifting 3D Voxel Clouds
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.84,
    });
    for (let i = 0; i < 26; i++) {
      const w = 14 + (i % 4) * 8;
      const d = 10 + ((i * 3) % 4) * 6;
      const cloud = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, d), cloudMat);
      cloud.position.set(
        ((i * 53) % 260) - 130,
        84 + (i % 3) * 2.5,
        ((i * 97) % 260) - 130
      );
      this.cloudsGroup.add(cloud);
    }
    this.scene.add(this.cloudsGroup);

    // 4. Dynamic Rain / Snow Weather Particles around Player
    const wCount = 650;
    const wPos = new Float32Array(wCount * 3);
    for (let i = 0; i < wCount; i++) {
      wPos[i * 3] = (Math.random() - 0.5) * 44;
      wPos[i * 3 + 1] = Math.random() * 28;
      wPos[i * 3 + 2] = (Math.random() - 0.5) * 44;
    }
    const wGeom = new THREE.BufferGeometry();
    wGeom.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
    const wMat = new THREE.PointsMaterial({
      color: 0xbfdbfe,
      size: 0.22,
      transparent: true,
      opacity: 0.78,
    });
    this.weatherPoints = new THREE.Points(wGeom, wMat);
    this.weatherPoints.visible = false;
    this.weatherPoints.frustumCulled = false;
    this.scene.add(this.weatherPoints);

    // 5. Scene Lights for Mobs & 3D Dropped Items
    this.entityAmbientLight = new THREE.AmbientLight(0xffffff, 0.72);
    this.scene.add(this.entityAmbientLight);
    this.entitySunLight = new THREE.DirectionalLight(0xfffbeb, 0.9);
    this.entitySunLight.position.set(40, 80, 30);
    this.scene.add(this.entitySunLight);
  }

  private setupSelectionOverlays(): void {
    const boxGeom = new THREE.BoxGeometry(1.008, 1.008, 1.008);
    const edges = new THREE.EdgesGeometry(boxGeom);
    boxGeom.dispose();
    this.targetHighlight = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.85 })
    );
    this.targetHighlight.visible = false;
    this.scene.add(this.targetHighlight);

    this.breakOverlayMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.014, 1.014, 1.014),
      new THREE.MeshBasicMaterial({
        color: 0x1e293b,
        wireframe: true,
        transparent: true,
        opacity: 0,
      })
    );
    this.breakOverlayMesh.visible = false;
    this.scene.add(this.breakOverlayMesh);
  }

  private setupViewModel(): void {
    const vmAmbient = new THREE.AmbientLight(0xffffff, 0.85);
    const vmDir = new THREE.DirectionalLight(0xfffbeb, 0.85);
    vmDir.position.set(2, 4, 3);
    this.viewModelScene.add(vmAmbient, vmDir);

    this.handRig.position.set(0.56, -0.5, -0.82);
    this.handRig.add(this.handMeshGroup);
    this.viewModelScene.add(this.handRig);
    this.rebuildHeldItemMesh();
  }

  private rebuildHeldItemMesh(): void {
    const slot = this.inventory[this.selectedHotbar];
    const itemId = slot?.id ?? 0;
    const key = `${itemId}`;
    if (key === this.lastRenderedHeldKey) return;
    this.lastRenderedHeldKey = key;

    while (this.handMeshGroup.children.length > 0) {
      const child = this.handMeshGroup.children.pop()!;
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).geometry.dispose();
        ((child as THREE.Mesh).material as THREE.Material).dispose();
      }
    }

    const def = ITEMS[itemId];
    if (!def || itemId === BLOCK.AIR) {
      // Classic voxel adventurer forearm
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.24, 0.68),
        new THREE.MeshLambertMaterial({ color: 0xe0a986 })
      );
      arm.rotation.set(0.25, -0.35, -0.15);
      this.handMeshGroup.add(arm);
      return;
    }

    if (def.isBlock && def.renderType === 'cube') {
      const atlas = getAtlasTexture();
      const geom = new THREE.BoxGeometry(0.42, 0.42, 0.42);
      const uvAttr = geom.attributes.uv as THREE.BufferAttribute;
      // BoxGeometry groups: +x, -x, +y, -y, +z, -z
      const faceTiles = [
        def.textures.side,
        def.textures.side,
        def.textures.top,
        def.textures.bottom,
        def.textures.side,
        def.textures.side,
      ];
      for (let f = 0; f < 6; f++) {
        const [u0, v0, u1, v1] = getTileUV(faceTiles[f]);
        const base = f * 4;
        uvAttr.setXY(base + 0, u0, v1);
        uvAttr.setXY(base + 1, u1, v1);
        uvAttr.setXY(base + 2, u0, v0);
        uvAttr.setXY(base + 3, u1, v0);
      }
      uvAttr.needsUpdate = true;
      const mesh = new THREE.Mesh(
        geom,
        new THREE.MeshLambertMaterial({
          map: atlas,
          transparent: def.transparent,
          alphaTest: def.transparent ? 0.35 : 0,
        })
      );
      mesh.rotation.set(0.22, 0.68, 0.05);
      this.handMeshGroup.add(mesh);
    } else if (def.renderType === 'torch') {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.48, 0.09),
        new THREE.MeshLambertMaterial({ color: 0x855a32 })
      );
      const flame = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.14, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      flame.position.set(0, 0.28, 0);
      this.handMeshGroup.add(post, flame);
      this.handMeshGroup.rotation.set(0.2, 0.2, 0.12);
      return;
    } else if (def.toolType) {
      // Crisp 3D voxel handle + tool/blade head!
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.56, 0.07),
        new THREE.MeshLambertMaterial({ color: 0x7c4f29 })
      );
      handle.rotation.z = -0.35;
      this.handMeshGroup.add(handle);

      const headMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(def.colorHex) });
      if (def.toolType === 'pickaxe') {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.09), headMat);
        bar.position.set(0.09, 0.22, 0);
        bar.rotation.z = -0.35;
        this.handMeshGroup.add(bar);
      } else if (def.toolType === 'axe') {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.08), headMat);
        blade.position.set(0.14, 0.2, 0);
        blade.rotation.z = -0.35;
        this.handMeshGroup.add(blade);
      } else if (def.toolType === 'shovel') {
        const spade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.06), headMat);
        spade.position.set(0.1, 0.26, 0);
        spade.rotation.z = -0.35;
        this.handMeshGroup.add(spade);
      } else if (def.toolType === 'sword') {
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.08), headMat);
        guard.position.set(-0.02, -0.02, 0);
        guard.rotation.z = -0.35;
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.52, 0.05), headMat);
        blade.position.set(0.09, 0.24, 0);
        blade.rotation.z = -0.35;
        this.handMeshGroup.add(guard, blade);
      }
      this.handMeshGroup.rotation.set(0.1, 0.55, 0);
      return;
    } else {
      // Held gem, ingot, coal, apple, steak
      const itemCube = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.26, 0.14),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(def.colorHex) })
      );
      itemCube.rotation.set(0.2, 0.5, 0.1);
      this.handMeshGroup.add(itemCube);
    }
    this.handMeshGroup.rotation.set(0, 0, 0);
  }

  private triggerSwing(): void {
    this.swinging = true;
    this.swingProgress = 0;
  }

  // --- Event Listeners ---
  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isDead) return;
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

    this.audio.unlock();
    this.keys.add(e.code);

    if (e.code === 'KeyE') {
      e.preventDefault();
      this.toggleInventory();
      return;
    }
    if (e.code === 'KeyP') {
      e.preventDefault();
      this.togglePause();
      return;
    }
    if (e.code === 'Escape') {
      if (this.inventoryOpen) {
        this.inventoryOpen = false;
        this.requestPointerLockSafe();
        this.emitHUD();
      } else {
        this.togglePause();
      }
      return;
    }

    if (this.paused || this.inventoryOpen) return;

    // Hotbar 1..9
    if (e.code.startsWith('Digit')) {
      const n = parseInt(e.code.slice(5), 10);
      if (n >= 1 && n <= 9) {
        this.selectHotbar(n - 1);
      }
    }

    // Toggle Flight ('F')
    if (e.code === 'KeyF') {
      this.physics.flying = !this.physics.flying;
      this.physics.velocity.y = 0;
      this.showToast(
        this.physics.flying ? 'Flight Mode Active' : 'Walking Mode Active',
        this.physics.flying ? 'Hold Space to ascend, C / Ctrl to descend' : 'Gravity & collisions engaged',
        'info'
      );
      this.emitHUD();
    }

    // Toss held item ('Q')
    if (e.code === 'KeyQ') {
      this.dropSelectedItem();
    }

    // Time of Day quick step ('[' and ']')
    if (e.code === 'BracketRight') {
      this.timeOfDay = (this.timeOfDay + 0.125) % 1;
      this.showToast('Time Shifted', this.getTimePhaseLabel(), 'info');
      this.emitHUD();
    }
    if (e.code === 'BracketLeft') {
      this.timeOfDay = (this.timeOfDay + 0.875) % 1;
      this.showToast('Time Rewound', this.getTimePhaseLabel(), 'info');
      this.emitHUD();
    }

    // Cycle Weather ('KeyV')
    if (e.code === 'KeyV') {
      const order: WeatherType[] = ['clear', 'rain', 'snow'];
      this.weather = order[(order.indexOf(this.weather) + 1) % order.length];
      this.showToast('Weather Changed', `Atmosphere: ${this.weather.toUpperCase()}`, 'info');
      this.emitHUD();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.paused || this.inventoryOpen || this.isDead) return;
    if (document.pointerLockElement === this.renderer.domElement) {
      this.physics.yaw -= e.movementX * 0.0022;
      this.physics.pitch -= e.movementY * 0.0022;
      this.physics.pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, this.physics.pitch));
    } else if (this.mouseRightDown || e.altKey) {
      // Seamless fallback mouse-drag look when playing inside iframes where Pointer Lock is blocked!
      if (this.lastMouseX !== null && this.lastMouseY !== null) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        if (Math.hypot(dx, dy) > 3) this.rightDragMoved = true;
        this.physics.yaw -= dx * 0.004;
        this.physics.pitch -= dy * 0.004;
        this.physics.pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, this.physics.pitch));
      }
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    } else {
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.paused || this.inventoryOpen || this.isDead) return;
    this.audio.unlock();
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    if (document.pointerLockElement !== this.renderer.domElement) {
      this.requestPointerLockSafe();
    }

    if (e.button === 0) {
      this.mouseLeftDown = true;
      this.tryPrimaryAttackOrInstantAction();
    } else if (e.button === 2) {
      this.mouseRightDown = true;
      this.rightDragMoved = false;
      this.performRightClickAction();
      this.placeCooldown = 0.22;
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.mouseLeftDown = false;
      this.miningTimer = 0;
      this.currentBreakProgress = 0;
    } else if (e.button === 2) {
      this.mouseRightDown = false;
      this.rightDragMoved = false;
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (this.paused || this.inventoryOpen || this.isDead) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    this.selectHotbar((this.selectedHotbar + dir + HOTBAR_SIZE) % HOTBAR_SIZE);
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private onPointerLockChange = () => {
    const wasLocked = this.pointerLocked;
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    if (wasLocked && !this.pointerLocked) {
      this.mouseLeftDown = false;
      this.mouseRightDown = false;
      if (!this.inventoryOpen && !this.paused && !this.isDead) {
        this.paused = true;
      }
    }
    this.emitHUD();
  };

  private onResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewModelCamera.aspect = w / h;
    this.viewModelCamera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    window.addEventListener('resize', this.onResize);
  }

  requestPointerLockSafe(): void {
    try {
      const promise = this.renderer.domElement.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {});
      }
    } catch {
      // Safely ignore in sandboxed iframes or headless environments
    }
  }

  exitPointerLockSafe(): void {
    try {
      if (document.pointerLockElement) document.exitPointerLock();
    } catch {
      // ignore
    }
  }

  // --- Gameplay Actions ---
  selectHotbar(index: number): void {
    this.selectedHotbar = Math.max(0, Math.min(HOTBAR_SIZE - 1, index));
    this.rebuildHeldItemMesh();
    this.emitHUD();
  }

  toggleInventory(): void {
    this.inventoryOpen = !this.inventoryOpen;
    if (this.inventoryOpen) {
      this.paused = false;
      this.exitPointerLockSafe();
    } else {
      this.requestPointerLockSafe();
    }
    this.rebuildHeldItemMesh();
    this.emitHUD();
  }

  togglePause(): void {
    this.paused = !this.paused;
    if (this.paused) {
      this.inventoryOpen = false;
      this.exitPointerLockSafe();
    } else {
      this.requestPointerLockSafe();
    }
    this.emitHUD();
  }

  resumeGame(): void {
    this.paused = false;
    this.inventoryOpen = false;
    this.requestPointerLockSafe();
    this.emitHUD();
  }

  respawn(): void {
    const spawn = this.world.findSpawnPosition();
    this.physics.position.set(spawn.x, spawn.y, spawn.z);
    this.physics.velocity.set(0, 0, 0);
    this.health = 20;
    this.hunger = 20;
    this.oxygen = 10;
    this.isDead = false;
    this.requestPointerLockSafe();
    this.emitHUD();
  }

  dropSelectedItem(): void {
    const slot = this.inventory[this.selectedHotbar];
    if (!slot) return;
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.physics.pitch, this.physics.yaw, 0, 'YXZ'));
    this.entities.spawnDrop(
      this.camera.position.x + dir.x * 0.8,
      this.camera.position.y - 0.2 + dir.y * 0.8,
      this.camera.position.z + dir.z * 0.8,
      slot.id,
      1,
      1.1
    );
    slot.count -= 1;
    if (slot.count <= 0) this.inventory[this.selectedHotbar] = null;
    this.rebuildHeldItemMesh();
    this.emitHUD();
  }

  swapInventorySlots(a: number, b: number): void {
    if (a === b || a < 0 || b < 0 || a >= this.inventory.length || b >= this.inventory.length) return;
    const slotA = this.inventory[a];
    const slotB = this.inventory[b];
    if (slotA && slotB && slotA.id === slotB.id && ITEMS[slotA.id]?.stackable) {
      const space = 64 - slotB.count;
      const move = Math.min(space, slotA.count);
      slotB.count += move;
      slotA.count -= move;
      if (slotA.count <= 0) this.inventory[a] = null;
    } else {
      this.inventory[a] = slotB;
      this.inventory[b] = slotA;
    }
    this.rebuildHeldItemMesh();
    this.emitHUD();
  }

  giveCreativeItem(itemId: number): void {
    addItemToInventory(this.inventory, itemId, ITEMS[itemId]?.stackable ? 64 : 1);
    this.audio.playPickup();
    this.rebuildHeldItemMesh();
    this.emitHUD();
  }

  craftRecipeById(recipeId: string): boolean {
    const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
    if (!recipe || !canCraftRecipe(this.inventory, recipe)) return false;

    for (const req of recipe.ingredients) {
      consumeIngredient(this.inventory, req.id, req.count);
    }
    addItemToInventory(this.inventory, recipe.outputId, recipe.outputCount);
    this.audio.playCraft();

    this.unlockAchievement('bench_maker');
    if (
      recipe.outputId === 122 ||
      recipe.outputId === 123 ||
      recipe.outputId === 125
    ) {
      this.unlockAchievement('demolitionist');
    }

    this.rebuildHeldItemMesh();
    this.emitHUD();
    return true;
  }

  smeltRecipeById(smeltId: string): boolean {
    const recipe = SMELT_RECIPES.find((r) => r.id === smeltId);
    if (!recipe) return false;

    // Check input item + fuel source
    let hasInput = false;
    for (const s of this.inventory) {
      if (s && s.id === recipe.inputId && s.count >= 1) {
        hasInput = true;
        break;
      }
    }
    const fuelIdx = findFuelSlotIndex(this.inventory);
    if (!hasInput || fuelIdx < 0) return false;

    consumeIngredient(this.inventory, recipe.inputId, 1);
    // Consume 1 unit of fuel
    const fuelSlot = this.inventory[fuelIdx]!;
    fuelSlot.count -= 1;
    if (fuelSlot.count <= 0) this.inventory[fuelIdx] = null;

    addItemToInventory(this.inventory, recipe.outputId, recipe.outputCount);
    this.audio.playCraft();

    if (recipe.outputId === 102) {
      this.unlockAchievement('iron_forge');
    }

    this.rebuildHeldItemMesh();
    this.emitHUD();
    return true;
  }

  private tryPrimaryAttackOrInstantAction(): void {
    this.triggerSwing();
    const lookDir = new THREE.Vector3(0, 0, -1).applyEuler(
      new THREE.Euler(this.physics.pitch, this.physics.yaw, 0, 'YXZ')
    );

    // Check melee combat against creatures first!
    if (this.attackCooldown <= 0) {
      const hitMob = this.entities.raycastMob(this.camera.position, lookDir, 4.2);
      if (hitMob && (!this.currentHit || this.camera.position.distanceTo(hitMob.pos) < this.currentHit.distance + 0.6)) {
        this.attackCooldown = 0.35;
        const held = ITEMS[this.inventory[this.selectedHotbar]?.id ?? 0];
        const dmg = held?.attackDamage ?? 2;
        this.entities.hitMob(hitMob, dmg, this.physics.position, this.particles, this.audio);
        this.damageHeldTool();
        return;
      }
    }

    this.audio.playSwing();
    if (this.meta.gameMode === 'creative' && this.currentHit) {
      this.completeBlockBreak(this.currentHit);
    }
  }

  private performRightClickAction(): void {
    const slot = this.inventory[this.selectedHotbar];
    const heldDef = slot ? ITEMS[slot.id] : undefined;

    // 1. Check interacting directly with targeted world block (Crafting Table, Furnace, TNT fuse!)
    if (this.currentHit) {
      const targetId = this.currentHit.blockId;
      if (targetId === BLOCK.TNT) {
        this.world.setBlock(this.currentHit.x, this.currentHit.y, this.currentHit.z, BLOCK.AIR, true);
        this.entities.igniteTNT(this.currentHit.x, this.currentHit.y, this.currentHit.z);
        this.audio.playFuse();
        this.triggerSwing();
        this.unlockAchievement('demolitionist');
        this.showToast('Fuse Lit!', 'Stand back — TNT detonating in 2.6s!', 'warning');
        return;
      }
      if (targetId === BLOCK.CRAFTING_TABLE || targetId === BLOCK.FURNACE) {
        this.toggleInventory();
        return;
      }
    }

    // 2. Eat Food if holding food item!
    if (slot && heldDef?.foodRestore) {
      if (this.hunger < this.maxHunger || this.health < this.maxHealth) {
        this.hunger = Math.min(this.maxHunger, this.hunger + heldDef.foodRestore);
        this.health = Math.min(this.maxHealth, this.health + Math.ceil(heldDef.foodRestore * 0.5));
        if (this.meta.gameMode !== 'creative') {
          slot.count -= 1;
          if (slot.count <= 0) this.inventory[this.selectedHotbar] = null;
        }
        this.triggerSwing();
        this.audio.playPickup();
        this.rebuildHeldItemMesh();
        this.emitHUD();
      }
      return;
    }

    // 3. Place Held Voxel Block onto Adjacent Face
    if (!slot || !heldDef || !heldDef.isBlock || slot.id === BLOCK.AIR || !this.currentHit) return;

    const px = this.currentHit.x + this.currentHit.nx;
    const py = this.currentHit.y + this.currentHit.ny;
    const pz = this.currentHit.z + this.currentHit.nz;
    if (py <= 0 || py >= 95) return;

    // Prevent placing a solid block directly overlapping the player body!
    if (heldDef.solid && this.physics.intersectsBlock(px, py, pz)) {
      return;
    }

    const existing = this.world.getBlock(px, py, pz);
    if (existing !== BLOCK.AIR && existing !== BLOCK.WATER && existing !== BLOCK.LAVA && existing !== BLOCK.TALL_GRASS) {
      return;
    }

    this.world.setBlock(px, py, pz, slot.id, true);
    this.audio.playBlockSound(heldDef.soundGroup, 'place');
    this.triggerSwing();

    if (slot.id === BLOCK.TORCH || slot.id === BLOCK.GLOWSTONE) {
      this.unlockAchievement('light_the_dark');
    }

    if (this.meta.gameMode !== 'creative') {
      slot.count -= 1;
      if (slot.count <= 0) {
        this.inventory[this.selectedHotbar] = null;
        this.rebuildHeldItemMesh();
      }
    }
    this.emitHUD();
  }

  private computeBreakDuration(blockId: number): number {
    if (this.meta.gameMode === 'creative') return 0.05;
    const def = ITEMS[blockId];
    if (!def || def.hardness < 0) return Infinity;
    if (def.hardness === 0) return 0.04;

    const held = ITEMS[this.inventory[this.selectedHotbar]?.id ?? 0];
    let speed = 1.0;
    if (held && held.toolType && held.toolType === def.preferredTool) {
      speed = held.toolSpeed ?? 2.0;
    } else if (def.minToolTier >= 2) {
      // Harder ores take noticeably longer without the matching pickaxe
      speed = 0.42;
    }
    return Math.max(0.06, def.hardness / speed);
  }

  private completeBlockBreak(hit: RaycastHit): void {
    const id = hit.blockId;
    const def = ITEMS[id];
    if (!def || (def.hardness < 0 && this.meta.gameMode !== 'creative')) return;

    this.world.setBlock(hit.x, hit.y, hit.z, BLOCK.AIR, true);
    this.particles.emitBlockBreak(hit.x, hit.y, hit.z, id, 22);
    this.audio.playBlockSound(def.soundGroup, 'break');

    if (this.meta.gameMode !== 'creative') {
      this.damageHeldTool();

      const dropId = def.dropId !== undefined ? def.dropId : id;
      const dropCount = def.dropCount !== undefined ? def.dropCount : 1;
      if (dropId !== BLOCK.AIR && dropCount > 0) {
        this.entities.spawnDrop(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, dropId, dropCount, 0.12);
      }

      // Bonus apple / stick drops from tree leaves!
      if (id === BLOCK.OAK_LEAVES || id === BLOCK.BIRCH_LEAVES || id === BLOCK.PINE_LEAVES) {
        if (Math.random() < 0.16) {
          this.entities.spawnDrop(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, 130, 1, 0.12); // Apple
        } else if (Math.random() < 0.25) {
          this.entities.spawnDrop(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, 100, 1, 0.12); // Stick
        }
      }
    }

    // Progression checks
    if (isLog(id)) this.unlockAchievement('first_timber');
    if (id === BLOCK.STONE || id === BLOCK.COAL_ORE || id === BLOCK.COBBLESTONE) {
      this.unlockAchievement('stone_age');
    }

    this.miningTimer = 0;
    this.currentBreakProgress = 0;
    this.emitHUD();
  }

  private damageHeldTool(): void {
    const slot = this.inventory[this.selectedHotbar];
    if (!slot || slot.durability === undefined || this.meta.gameMode === 'creative') return;
    slot.durability -= 1;
    if (slot.durability <= 0) {
      this.inventory[this.selectedHotbar] = null;
      this.audio.playBlockSound('glass', 'break');
      this.showToast('Tool Broke!', 'Craft a stronger replacement in your Workshop (E)', 'warning');
      this.rebuildHeldItemMesh();
    }
  }

  private unlockAchievement(id: string): void {
    const ach = this.achievements.find((a) => a.id === id);
    if (!ach || ach.unlocked) return;
    ach.unlocked = true;
    ach.unlockedAt = Date.now();
    this.audio.playCraft();
    this.showToast(`Milestone Unlocked: ${ach.title}`, ach.description, 'achievement');
  }

  showToast(title: string, subtitle?: string, type: 'achievement' | 'info' | 'warning' = 'info'): void {
    this.toastData = { id: this.toastSeq++, title, subtitle, type };
    this.toastTimer = 4.2;
    this.emitHUD();
  }

  applyPlayerDamage(amount: number, knockX = 0, knockZ = 0): void {
    if (this.meta.gameMode === 'creative' || this.isDead || this.playerHurtCooldown > 0) return;
    this.playerHurtCooldown = 0.55;
    this.health = Math.max(0, this.health - amount);
    this.audio.playHurt(false);
    this.physics.velocity.x += knockX * 5.5;
    this.physics.velocity.z += knockZ * 5.5;
    this.physics.velocity.y = Math.max(this.physics.velocity.y, 4.2);

    if (this.health <= 0) {
      this.isDead = true;
      this.exitPointerLockSafe();
    }
    this.emitHUD();
  }

  async saveNow(manualToast = false): Promise<void> {
    this.meta.dayCount = this.dayCount;
    const payload: SavedWorldPayload = {
      meta: this.meta,
      player: {
        x: this.physics.position.x,
        y: this.physics.position.y,
        z: this.physics.position.z,
        yaw: this.physics.yaw,
        pitch: this.physics.pitch,
        health: this.health,
        hunger: this.hunger,
        flying: this.physics.flying,
        selectedHotbar: this.selectedHotbar,
      },
      timeOfDay: this.timeOfDay,
      weather: this.weather,
      inventory: this.inventory,
      achievements: this.achievements,
      edits: this.world.serializeEdits(),
    };
    await saveWorldData(payload);
    if (manualToast) {
      this.showToast('World Saved', `Saved ${Object.keys(payload.edits).length} modified chunks to disk`, 'info');
    }
  }

  setGameMode(mode: GameMode): void {
    this.meta.gameMode = mode;
    if (mode === 'creative') {
      this.health = 20;
      this.hunger = 20;
      // Populate empty hotbar slots with fun blocks if empty
      for (let i = 0; i < Math.min(HOTBAR_SIZE, ALL_CREATIVE_ITEMS.length); i++) {
        if (!this.inventory[i]) {
          this.inventory[i] = { id: ALL_CREATIVE_ITEMS[i], count: 64 };
        }
      }
    } else {
      this.physics.flying = false;
    }
    this.rebuildHeldItemMesh();
    this.emitHUD();
  }

  setRenderDistance(rd: number): void {
    this.world.renderDistance = Math.max(3, Math.min(8, rd));
    this.emitHUD();
  }

  setFov(fov: number): void {
    this.fov = Math.max(60, Math.min(100, fov));
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    this.emitHUD();
  }

  setTimeOfDay(t: number): void {
    this.timeOfDay = ((t % 1) + 1) % 1;
    this.emitHUD();
  }

  setWeather(w: WeatherType): void {
    this.weather = w;
    this.emitHUD();
  }

  setSoundEnabled(flag: boolean): void {
    this.audio.enabled = flag;
    this.emitHUD();
  }

  getTimePhaseLabel(): string {
    const t = this.timeOfDay;
    if (t < 0.08 || t >= 0.94) return 'Sunrise';
    if (t < 0.44) return 'Daylight';
    if (t < 0.56) return 'Golden Sunset';
    return 'Starry Night';
  }

  // --- Main Real-Time Game Loop ---
  private loop = (): void => {
    if (this.disposed) return;
    this.animFrameId = requestAnimationFrame(this.loop);

    const now = performance.now();
    const rawDt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    const dt = Math.min(0.05, Math.max(0.0005, rawDt));

    this.fpsAccum += rawDt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    if (!this.paused && !this.isDead) {
      this.updateSimulation(dt, now * 0.001);
    }

    this.updateCameraAndAtmosphere(dt, now * 0.001);
    this.renderFrame();

    this.hudEmitTimer -= dt;
    if (this.hudEmitTimer <= 0) {
      this.hudEmitTimer = 0.08;
      this.emitHUD();
    }
  };

  private updateSimulation(dt: number, elapsedSec: number): void {
    // Arrow keys smoothly rotate camera for keyboard-only accessibility & automated tests
    if (!this.inventoryOpen) {
      const lookSpeed = 1.9 * dt;
      if (this.keys.has('ArrowLeft')) this.physics.yaw += lookSpeed;
      if (this.keys.has('ArrowRight')) this.physics.yaw -= lookSpeed;
      if (this.keys.has('ArrowUp')) this.physics.pitch = Math.min(1.54, this.physics.pitch + lookSpeed);
      if (this.keys.has('ArrowDown')) this.physics.pitch = Math.max(-1.54, this.physics.pitch - lookSpeed);
    }

    const input: MovementInput = this.inventoryOpen
      ? { forward: false, backward: false, left: false, right: false, jump: false, sprint: false, crouch: false }
      : {
          forward: this.keys.has('KeyW'),
          backward: this.keys.has('KeyS'),
          left: this.keys.has('KeyA'),
          right: this.keys.has('KeyD'),
          jump: this.keys.has('Space'),
          sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
          crouch: this.keys.has('KeyC') || this.keys.has('ControlLeft'),
        };

    const survivalActive = this.meta.gameMode === 'survival';
    const stepEvents = this.physics.update(this.world, dt, input, survivalActive);

    if (stepEvents.enteredWater) {
      this.audio.playBlockSound('water', 'break');
      this.particles.emitBurst(
        this.physics.position.x,
        this.physics.position.y + 0.3,
        this.physics.position.z,
        ['#60a5fa', '#e0f2fe', '#ffffff'],
        16,
        3.2,
        0.5,
        0.12
      );
    }
    if (stepEvents.footstepBlock) {
      const group = ITEMS[stepEvents.footstepBlock]?.soundGroup ?? 'grass';
      this.audio.playBlockSound(group, 'step');
    }
    if (stepEvents.landedHardDamage > 0) {
      this.applyPlayerDamage(stepEvents.landedHardDamage);
    }

    // Sprint dynamic FOV kick
    const targetFov = input.sprint && input.forward && !this.inventoryOpen ? this.fov + 7 : this.fov;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 9);
      this.camera.updateProjectionMatrix();
    }

    // Time of Day & Natural Weather Cycle
    this.timeOfDay += dt / DAY_DURATION_SECONDS;
    if (this.timeOfDay >= 1) {
      this.timeOfDay -= 1;
      this.dayCount++;
    }

    this.weatherChangeTimer -= dt;
    if (this.weatherChangeTimer <= 0) {
      this.weatherChangeTimer = 90 + Math.random() * 90;
      const biome = this.world.getBiomeInfo(this.physics.position.x, this.physics.position.z).id;
      const r = Math.random();
      this.weather = r < 0.68 ? 'clear' : biome === 'taiga' || biome === 'mountains' ? 'snow' : 'rain';
    }

    // Stream chunks seamlessly around player
    this.world.updateStreaming(this.physics.position.x, this.physics.position.z);

    // Raycast Targeted Voxel Block
    const eyeX = this.physics.position.x;
    const eyeY = this.physics.position.y + this.physics.eyeHeight;
    const eyeZ = this.physics.position.z;
    const lookDir = new THREE.Vector3(0, 0, -1).applyEuler(
      new THREE.Euler(this.physics.pitch, this.physics.yaw, 0, 'YXZ')
    );

    this.currentHit = raycastVoxel(
      this.world,
      eyeX,
      eyeY,
      eyeZ,
      lookDir.x,
      lookDir.y,
      lookDir.z,
      REACH_DISTANCE
    );

    // Progressive Block Breaking & Continuous Placement
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    this.playerHurtCooldown = Math.max(0, this.playerHurtCooldown - dt);

    if (this.mouseRightDown && !this.rightDragMoved && !this.inventoryOpen && this.placeCooldown <= 0) {
      this.performRightClickAction();
      this.placeCooldown = 0.22;
    }

    if (this.mouseLeftDown && !this.inventoryOpen && this.currentHit) {
      const hitKey = `${this.currentHit.x},${this.currentHit.y},${this.currentHit.z}`;
      if (hitKey !== this.miningKey) {
        this.miningKey = hitKey;
        this.miningTimer = 0;
      }
      const duration = this.computeBreakDuration(this.currentHit.blockId);
      if (Number.isFinite(duration)) {
        this.miningTimer += dt;
        this.currentBreakProgress = Math.min(1, this.miningTimer / duration);

        // Continuous arm swing + tap audio + chip particles while mining!
        if (!this.swinging) this.triggerSwing();
        this.miningHitSoundTimer -= dt;
        if (this.miningHitSoundTimer <= 0) {
          this.miningHitSoundTimer = 0.22;
          const def = ITEMS[this.currentHit.blockId];
          if (def) this.audio.playBlockSound(def.soundGroup, 'hit');
          this.particles.emitBlockBreak(this.currentHit.x, this.currentHit.y, this.currentHit.z, this.currentHit.blockId, 3);
        }

        if (this.miningTimer >= duration) {
          this.completeBlockBreak(this.currentHit);
        }
      }
    } else {
      this.miningTimer = 0;
      this.currentBreakProgress = 0;
    }

    // Survival Vitals: Oxygen bubbles underwater, Lava burn, Hunger & Natural Regeneration
    if (this.physics.headUnderwater) {
      this.oxygen = Math.max(0, this.oxygen - dt * 0.75);
      if (this.oxygen <= 0 && survivalActive) {
        this.applyPlayerDamage(2);
      }
    } else {
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + dt * 3.5);
    }

    if (this.physics.inLava && survivalActive) {
      this.applyPlayerDamage(4);
    }

    this.survivalTickTimer -= dt;
    if (this.survivalTickTimer <= 0) {
      this.survivalTickTimer = 2.5;
      if (survivalActive) {
        if (input.sprint && input.forward) {
          this.hunger = Math.max(0, this.hunger - 0.35);
        } else {
          this.hunger = Math.max(0, this.hunger - 0.06);
        }
        if (this.hunger >= 15 && this.health < this.maxHealth) {
          this.health = Math.min(this.maxHealth, this.health + 1);
        }
      }
    }

    // Entities, Particles & Ambient Audio
    const isNight = this.timeOfDay > 0.53 && this.timeOfDay < 0.96;
    this.entities.update(
      dt,
      this.world,
      this.physics.position,
      isNight,
      survivalActive,
      this.particles,
      this.audio,
      (id, count) => {
        const added = addItemToInventory(this.inventory, id, count);
        if (added) this.rebuildHeldItemMesh();
        return added;
      },
      (dmg, kx, kz) => this.applyPlayerDamage(dmg, kx, kz)
    );
    this.particles.update(dt, this.world);
    this.audio.updateAmbience(dt);

    // Periodic Auto-Save every 25 seconds
    this.autoSaveTimer -= dt;
    if (this.autoSaveTimer <= 0) {
      this.autoSaveTimer = 25;
      this.saveNow(false);
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastData = null;
    }

    // Subtle torch flame ember particles occasionally near player
    if (Math.floor(elapsedSec * 10) % 4 === 0 && Math.random() < 0.25) {
      const px = Math.floor(this.physics.position.x + (Math.random() - 0.5) * 14);
      const py = Math.floor(this.physics.position.y + (Math.random() - 0.5) * 8);
      const pz = Math.floor(this.physics.position.z + (Math.random() - 0.5) * 14);
      if (this.world.getBlock(px, py, pz) === BLOCK.TORCH) {
        this.particles.emitBurst(px + 0.5, py + 0.72, pz + 0.5, ['#fef08a', '#f97316'], 1, 0.5, -0.18, 0.06);
      }
    }
  }

  private updateCameraAndAtmosphere(dt: number, elapsedSec: number): void {
    const bobX = Math.cos(this.physics.walkBobPhase * 0.5) * 0.032;
    const bobY = Math.abs(Math.sin(this.physics.walkBobPhase)) * 0.045;

    this.camera.position.set(
      this.physics.position.x + bobX,
      this.physics.position.y + this.physics.eyeHeight + bobY,
      this.physics.position.z
    );
    this.camera.rotation.set(this.physics.pitch, this.physics.yaw, 0, 'YXZ');

    // Selection Highlight & Crack Progress Box
    if (this.currentHit && !this.isDead) {
      this.targetHighlight.visible = true;
      this.targetHighlight.position.set(
        this.currentHit.x + 0.5,
        this.currentHit.y + 0.5,
        this.currentHit.z + 0.5
      );
      if (this.currentBreakProgress > 0.02) {
        this.breakOverlayMesh.visible = true;
        this.breakOverlayMesh.position.copy(this.targetHighlight.position);
        const s = 1.015 - this.currentBreakProgress * 0.14;
        this.breakOverlayMesh.scale.set(s, s, s);
        (this.breakOverlayMesh.material as THREE.MeshBasicMaterial).opacity =
          0.25 + this.currentBreakProgress * 0.7;
      } else {
        this.breakOverlayMesh.visible = false;
      }
    } else {
      this.targetHighlight.visible = false;
      this.breakOverlayMesh.visible = false;
    }

    // Viewmodel Swing & Walk Bob Animation
    if (this.swinging) {
      this.swingProgress += dt * 4.8;
      if (this.swingProgress >= 1) {
        this.swingProgress = 0;
        this.swinging = false;
      }
    }
    const swingSin = Math.sin(this.swingProgress * Math.PI);
    this.handRig.position.set(
      0.56 - swingSin * 0.22 + bobX * 0.9,
      -0.48 + swingSin * 0.1 - bobY * 0.9,
      -0.82 - swingSin * 0.18
    );
    this.handRig.rotation.set(-swingSin * 0.95, swingSin * 0.35, swingSin * 0.3);

    // Day-Night Cycle Sky Colors, Fog, Sun/Moon Orbit & Shader Uniforms
    const angle = this.timeOfDay * Math.PI * 2; // 0 = sunrise, PI/2 = noon, PI = sunset, 3PI/2 = midnight
    const sunElev = Math.sin(angle); // [-1..1]

    this.skyDome.position.copy(this.camera.position);
    this.celestialPivot.position.copy(this.camera.position);
    this.celestialPivot.rotation.z = angle;
    this.starsPoints.position.copy(this.camera.position);

    const dayFactor = THREE.MathUtils.clamp((sunElev + 0.18) / 0.55, 0, 1);
    const sunsetFactor = Math.max(0, 1 - Math.abs(sunElev) * 3.8);

    const topDay = new THREE.Color(0x2563eb);
    const topNight = new THREE.Color(0x060b19);
    const horDay = new THREE.Color(0x93c5fd);
    const horNight = new THREE.Color(0x0f172a);
    const horSunset = new THREE.Color(0xf97316);

    const topCol = topNight.clone().lerp(topDay, dayFactor);
    const horCol = horNight.clone().lerp(horDay, dayFactor).lerp(horSunset, sunsetFactor * 0.72);

    if (this.weather !== 'clear') {
      topCol.lerp(new THREE.Color(0x334155), 0.58);
      horCol.lerp(new THREE.Color(0x64748b), 0.62);
    }

    if (this.physics.headUnderwater) {
      topCol.setHex(0x0369a1);
      horCol.setHex(0x075985);
    }

    this.skyUniforms.uTopColor.value.copy(topCol);
    this.skyUniforms.uHorizonColor.value.copy(horCol);

    const sunTint = new THREE.Color(0x94a3b8)
      .lerp(new THREE.Color(0xfffcf5), dayFactor)
      .lerp(new THREE.Color(0xfdba74), sunsetFactor * 0.55);

    const skyIntensity =
      (0.18 + dayFactor * 0.85) * (this.weather === 'clear' ? 1.0 : 0.76);

    this.world.uniforms.uSunColor.value.copy(sunTint);
    this.world.uniforms.uSkyIntensity.value = skyIntensity;
    this.world.uniforms.uTorchFlicker.value =
      0.97 + Math.sin(elapsedSec * 7.3) * 0.02 + Math.cos(elapsedSec * 13.1) * 0.015;
    this.world.uniforms.uFogColor.value.copy(horCol);
    this.world.uniforms.uTime.value = elapsedSec;

    const maxView = this.world.renderDistance * 16;
    this.world.uniforms.uFogNear.value = this.physics.headUnderwater ? 4 : maxView * 0.52;
    this.world.uniforms.uFogFar.value = this.physics.headUnderwater ? 26 : maxView * 0.96;

    (this.starsPoints.material as THREE.PointsMaterial).opacity = THREE.MathUtils.clamp(-sunElev * 1.4, 0, 0.9);
    this.entityAmbientLight.intensity = 0.25 + dayFactor * 0.55;
    this.entitySunLight.intensity = 0.15 + dayFactor * 0.85;

    // Drift 3D clouds around player
    this.cloudsGroup.position.set(
      Math.floor(this.camera.position.x / 260) * 260 + ((elapsedSec * 1.8) % 260),
      0,
      Math.floor(this.camera.position.z / 260) * 260
    );
    const firstCloud = this.cloudsGroup.children[0] as THREE.Mesh | undefined;
    if (firstCloud) {
      (firstCloud.material as THREE.MeshBasicMaterial).color
        .setHex(0xffffff)
        .multiplyScalar(0.28 + dayFactor * 0.72);
    }

    // Rain & Snow Particle Volume
    if (this.weather === 'clear' || this.physics.headUnderwater) {
      this.weatherPoints.visible = false;
    } else {
      this.weatherPoints.visible = true;
      this.weatherPoints.position.set(
        this.camera.position.x,
        this.camera.position.y - 10,
        this.camera.position.z
      );
      const pMat = this.weatherPoints.material as THREE.PointsMaterial;
      const isSnow = this.weather === 'snow';
      pMat.color.setHex(isSnow ? 0xf8fafc : 0x93c5fd);
      pMat.size = isSnow ? 0.24 : 0.16;

      const arr = this.weatherPoints.geometry.attributes.position.array as Float32Array;
      const fallSpeed = isSnow ? 3.4 : 21.0;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= fallSpeed * dt;
        if (isSnow) {
          arr[i] += Math.sin(elapsedSec * 1.6 + i) * dt * 0.9;
        }
        if (arr[i + 1] < 0) {
          arr[i + 1] = 28;
        }
      }
      this.weatherPoints.geometry.attributes.position.needsUpdate = true;
    }
  }

  private renderFrame(): void {
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (!this.isDead) {
      this.renderer.clearDepth();
      this.renderer.render(this.viewModelScene, this.viewModelCamera);
    }
  }

  emitHUD(loadingProgress = 100, loadingMessage = 'Ready'): void {
    const biome = this.world.getBiomeInfo(this.physics.position.x, this.physics.position.z);
    const targetDef = this.currentHit ? ITEMS[this.currentHit.blockId] : null;

    this.onHUDUpdate({
      ready: this.ready,
      loadingProgress,
      loadingMessage,
      worldName: this.meta.name,
      seed: this.meta.seed,
      gameMode: this.meta.gameMode,
      flying: this.physics.flying,
      paused: this.paused,
      inventoryOpen: this.inventoryOpen,
      pointerLocked: this.pointerLocked,
      health: this.health,
      maxHealth: this.maxHealth,
      hunger: this.hunger,
      maxHunger: this.maxHunger,
      oxygen: this.oxygen,
      maxOxygen: this.maxOxygen,
      underwater: this.physics.headUnderwater,
      inLava: this.physics.inLava,
      position: {
        x: Math.round(this.physics.position.x * 10) / 10,
        y: Math.round(this.physics.position.y * 10) / 10,
        z: Math.round(this.physics.position.z * 10) / 10,
      },
      yaw: this.physics.yaw,
      fps: this.currentFps,
      loadedChunks: this.world.chunks.size,
      entityCount: this.entities.mobs.length + this.entities.drops.length,
      biome: biome.id,
      biomeLabel: biome.label,
      timeOfDay: this.timeOfDay,
      dayCount: this.dayCount,
      weather: this.weather,
      selectedHotbar: this.selectedHotbar,
      inventory: this.inventory.map((s) => (s ? { ...s } : null)),
      targetBlock:
        this.currentHit && targetDef
          ? {
              x: this.currentHit.x,
              y: this.currentHit.y,
              z: this.currentHit.z,
              nx: this.currentHit.nx,
              ny: this.currentHit.ny,
              nz: this.currentHit.nz,
              blockId: this.currentHit.blockId,
              name: targetDef.name,
              breakProgress: this.currentBreakProgress,
            }
          : null,
      achievements: this.achievements.map((a) => ({ ...a })),
      toast: this.toastData ? { ...this.toastData } : null,
      isDead: this.isDead,
      renderDistance: this.world.renderDistance,
      fov: this.fov,
      soundEnabled: this.audio.enabled,
    });
  }

  async destroy(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animFrameId);
    await this.saveNow(false);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('resize', this.onResize);

    this.exitPointerLockSafe();
    this.world.dispose();
    this.particles.dispose();
    this.entities.dispose();
    this.renderer.dispose();
  }
}
