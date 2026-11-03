import * as THREE from 'three';
import { VoxelWorld, CHUNK_HEIGHT, SEA_LEVEL, BLOCK } from './voxel-world.js';
import { CreatureSystem } from './creatures.js';
import { ITEM, ITEMS, RECIPES, addItem, canCraft, consumeItems, createStartingInventory, inventoryCount, normalizeInventory } from './items.js';

const SAVE_KEY = 'mosslight-world-v1';
const DAY_LENGTH = 390;
const PLAYER_HEIGHT = 1.72;
const PLAYER_RADIUS = 0.31;
const MAX_REACH = 5.8;

const ICONS = {
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 5l7 7-7 7"/></svg>',
  pack: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V6a5 5 0 0 1 10 0v2M5 8h14l1 13H4L5 8Z"/><path d="M9 12v2a3 3 0 0 0 6 0v-2"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M17 9a5 5 0 0 1 0 6M19 6a9 9 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4ZM18 9l4 6M22 9l-4 6"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6Z"/></svg>',
  jump: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V5M6 11l6-6 6 6"/></svg>',
};

const TITLE_MARK = '<span class="mark-tile tile-one"></span><span class="mark-tile tile-two"></span><span class="mark-tile tile-three"></span><span class="mark-tile tile-four"></span>';

function readSave() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!data || typeof data !== 'object' || !Number.isFinite(data.seed)) return null;
    return data;
  } catch {
    return null;
  }
}

function safeNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function createInterface(root) {
  root.innerHTML = `
    <div class="game-shell">
      <canvas class="game-canvas" aria-label="Mosslight first-person voxel world" tabindex="0"></canvas>
      <div class="world-vignette" aria-hidden="true"></div>
      <div class="damage-flash" aria-hidden="true"></div>

      <section class="title-screen" id="title-screen">
        <header class="title-topbar">
          <div class="brand-lockup">
            <span class="brand-mark" aria-hidden="true">${TITLE_MARK}</span>
            <span class="brand-caption">A SMALL WORLD<br><b>OF YOUR OWN</b></span>
          </div>
          <button class="sound-toggle title-sound" id="title-sound" type="button" aria-label="Toggle sound">
            ${ICONS.sound}<span>Sound on</span>
          </button>
        </header>
        <main class="title-copy">
          <div class="title-eyebrow"><span></span><p>WANDER · GATHER · MAKE A HOME</p></div>
          <h1>Mosslight<span class="title-spark">.</span></h1>
          <p class="title-description">A quiet wilderness made block by block.<br>Find your footing, follow the light, and leave a little mark.</p>
          <div class="title-actions">
            <button class="primary-button" id="enter-world" type="button"><span id="enter-label">Begin exploring</span>${ICONS.arrow}</button>
            <button class="quiet-button" id="new-world" type="button">Start a new world</button>
          </div>
          <p class="continue-caption" id="continue-caption" hidden>Your last valley is still here.</p>
        </main>
        <footer class="title-footer">
          <span class="footer-whisper">THE VALLEY IS YOURS TO SHAPE</span>
          <div class="intro-controls">
            <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><b>move</b></span>
            <span><kbd>SPACE</kbd><b>jump</b></span>
            <span><kbd>E</kbd><b>pack</b></span>
            <span><kbd>ESC</kbd><b>pause</b></span>
          </div>
        </footer>
      </section>

      <section class="hud" id="hud" hidden aria-label="Game controls">
        <div class="hud-header">
          <div class="location-readout">
            <span class="location-mark" aria-hidden="true">${TITLE_MARK}</span>
            <div class="location-copy">
              <span class="biome-name" id="biome-name">Wildflower meadow</span>
              <span class="day-readout" id="day-readout">DAY 01 <i>·</i> 09:00</span>
            </div>
          </div>
          <div class="hud-right">
            <div class="vitality" aria-label="Health">
              <div class="vitality-label"><span>VITALITY</span><b id="health-value">100</b></div>
              <div class="health-track"><span id="health-bar"></span></div>
            </div>
            <span class="coordinates" id="coordinates">X 0 · Z 0</span>
            <button class="hud-button pack-button" id="pack-open" type="button" aria-label="Open pack, E">
              ${ICONS.pack}<span>Pack</span><kbd>E</kbd>
            </button>
            <button class="hud-icon-button" id="pause-open" type="button" aria-label="Pause">
              ${ICONS.pause}
            </button>
          </div>
        </div>
        <div class="weather-label" id="weather-label" hidden><span></span>Light rain</div>

        <div class="aim-ui" aria-hidden="true">
          <div class="crosshair" id="crosshair"><i></i><i></i><i></i><i></i></div>
          <div class="target-label" id="target-label" hidden></div>
          <div class="mine-track" id="mine-track" hidden><span id="mine-bar"></span></div>
        </div>

        <div class="bottom-ui">
          <div class="hotbar" id="hotbar" role="toolbar" aria-label="Quick inventory"></div>
          <div class="bottom-hint" id="bottom-hint"><span>HOLD LEFT CLICK</span> mine <i>·</i> <span>RIGHT CLICK</span> place <i>·</i> <span>WHEEL</span> select</div>
        </div>
      </section>

      <div class="touch-ui" id="touch-ui" hidden>
        <div class="touch-stick" id="touch-stick" aria-label="Movement joystick"><span id="touch-knob"></span></div>
        <div class="touch-actions">
          <button class="touch-action" id="touch-pack" type="button" aria-label="Open pack">${ICONS.pack}</button>
          <button class="touch-action touch-break" id="touch-break" type="button" aria-label="Break block"><span class="touch-action-glyph">+</span></button>
          <button class="touch-action touch-place" id="touch-place" type="button" aria-label="Place block"><span class="touch-action-glyph">−</span></button>
          <button class="touch-action touch-jump" id="touch-jump" type="button" aria-label="Jump">${ICONS.jump}</button>
        </div>
      </div>

      <div class="toast" id="toast" role="status" aria-live="polite"></div>

      <section class="overlay-screen inventory-screen" id="inventory-screen" hidden>
        <div class="overlay-shade"></div>
        <div class="inventory-panel" role="dialog" aria-modal="true" aria-labelledby="inventory-title">
          <header class="panel-header">
            <div><span class="panel-eyebrow">YOUR FIELD KIT</span><h2 id="inventory-title">Pack & making</h2></div>
            <button class="panel-close" id="inventory-close" type="button" aria-label="Close pack">${ICONS.close}</button>
          </header>
          <div class="inventory-layout">
            <section class="inventory-section">
              <div class="section-heading"><span>INVENTORY</span><span>36 SLOTS</span></div>
              <div class="inventory-grid" id="inventory-grid"></div>
              <p class="inventory-tip" id="inventory-tip">Choose a slot, then choose another to swap.</p>
            </section>
            <section class="craft-section">
              <div class="section-heading"><span>FIELD RECIPES</span><span>MADE BY HAND</span></div>
              <div class="recipe-list" id="recipe-list"></div>
            </section>
          </div>
          <footer class="panel-footer"><span>1–9 select a quick slot</span><span>Press <kbd>E</kbd> to return</span></footer>
        </div>
      </section>

      <section class="overlay-screen pause-screen" id="pause-screen" hidden>
        <div class="overlay-shade"></div>
        <div class="pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <span class="panel-eyebrow">THE VALLEY CAN WAIT</span>
          <h2 id="pause-title">Take a breath.</h2>
          <p class="pause-description">Your world is saved as you go.</p>
          <button class="primary-button resume-button" id="resume-world" type="button"><span>Return to the valley</span>${ICONS.arrow}</button>
          <div class="settings-block">
            <div class="setting-row"><label for="sensitivity-range">Mouse sensitivity</label><input id="sensitivity-range" type="range" min="8" max="34" step="1" value="20"><span id="sensitivity-value">20</span></div>
            <button class="setting-audio" id="pause-sound" type="button">${ICONS.sound}<span>Sound on</span></button>
          </div>
          <div class="pause-links">
            <button class="quiet-button" id="save-title" type="button">Save & return to title</button>
            <button class="quiet-button danger-link" id="pause-new-world" type="button">Start a new world</button>
          </div>
        </div>
      </section>
    </div>`;
  return Object.fromEntries([...root.querySelectorAll('[id]')].map((element) => [element.id, element]));
}

export function bootGame(root) {
  const game = new MosslightGame(root);
  if (import.meta.env.DEV) window.__mosslightGame = game;
  game.startLoop();
  return { destroy: () => game.destroy() };
}

class MosslightGame {
  constructor(root) {
    this.root = root;
    this.ui = createInterface(root);
    this.saved = readSave();
    this.seed = this.saved?.seed ?? Math.floor(Math.random() * 2147483000) + 1;
    this.inventory = normalizeInventory(this.saved?.inventory);
    this.selectedSlot = Math.max(0, Math.min(8, Math.floor(this.saved?.selectedSlot ?? 0)));
    this.dayTime = safeNumber(this.saved?.dayTime, 0.29);
    this.dayNumber = Math.max(1, Math.floor(this.saved?.dayNumber ?? 1));
    this.health = Math.max(1, Math.min(100, safeNumber(this.saved?.health, 100)));
    this.audioEnabled = this.saved?.audioEnabled !== false;
    this.sensitivity = Math.max(0.0008, Math.min(0.0034, safeNumber(this.saved?.sensitivity, 0.002)));
    this.settingsSensitivityValue = Math.round(this.sensitivity * 10000);
    this.started = false;
    this.paused = true;
    this.inventoryOpen = false;
    this.disposed = false;
    this.pointerLocked = false;
    this.ignoreLockJump = false;
    this.mousePointer = null;
    this.lookPointer = null;
    this.moveKeys = new Set();
    this.touchMove = { x: 0, z: 0 };
    this.primaryDown = false;
    this.mineProgress = 0;
    this.mineKey = null;
    this.selectedInventorySlot = null;
    this.selectedTarget = null;
    this.toastTimer = null;
    this.uiTimer = 0;
    this.saveTimer = 0;
    this.time = 0;
    this.lastHurtAt = -100;
    this.regenTimer = 0;
    this.returningToTitle = false;
    this.weather = { raining: false, timer: 70 + Math.random() * 70, wetTimer: 0 };
    this.particles = [];
    this.particleLimit = 340;
    this.torchLights = new Map();
    this.audioContext = null;
    this.audioMaster = null;

    const width = window.innerWidth;
    const height = window.innerHeight;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(76, width / height, 0.08, 520);
    this.camera.rotation.order = 'YXZ';
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.ui['title-screen'].parentElement.querySelector('.game-canvas'),
      antialias: Math.min(window.devicePixelRatio || 1, 1.5) > 1,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.13;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.player = {
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      grounded: false,
      health: this.health,
      bob: 0,
      spawn: new THREE.Vector3(),
    };
    this.world = null;
    this.creatures = null;
    this.yaw = 0;
    this.pitch = 0;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = MAX_REACH;
    this.centerScreen = new THREE.Vector2(0, 0);
    this.clock = new THREE.Clock();
    this.createLighting();
    this.createSky();
    this.createParticles();
    this.setupWorld(this.saved);
    this.createTargetOutline();
    this.bindEvents();
    this.updateSoundButtons();
    this.ui['sensitivity-range'].value = String(this.settingsSensitivityValue);
    this.ui['sensitivity-value'].textContent = String(this.settingsSensitivityValue);
    this.updateTitleText();
    this.renderInventory();
    this.updateHud(true);
  }

  createLighting() {
    this.ambient = new THREE.HemisphereLight(0xd8eee7, 0x5b543e, 1.05);
    this.scene.add(this.ambient);
    this.sunLight = new THREE.DirectionalLight(0xffe1b1, 2.25);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1536, 1536);
    this.sunLight.shadow.camera.left = -42;
    this.sunLight.shadow.camera.right = 42;
    this.sunLight.shadow.camera.top = 42;
    this.sunLight.shadow.camera.bottom = -42;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 145;
    this.sunLight.shadow.normalBias = 0.035;
    this.sunLight.shadow.bias = -0.00015;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.scene.fog = new THREE.FogExp2(0x9bbcaf, 0.0088);
  }

  createSky() {
    this.skyUniforms = {
      uTopColor: { value: new THREE.Color('#75b9c6') },
      uHorizonColor: { value: new THREE.Color('#d6c5a0') },
      uSunColor: { value: new THREE.Color('#ffe2b0') },
      uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
      uNight: { value: 0 },
      uRain: { value: 0 },
    };
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: `varying vec3 vDirection; void main(){ vDirection = normalize((modelMatrix * vec4(position, 0.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        uniform vec3 uSunDirection;
        uniform float uNight;
        uniform float uRain;
        varying vec3 vDirection;
        void main(){
          vec3 d = normalize(vDirection);
          float height = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
          float horizon = smoothstep(0.04, 0.95, height);
          vec3 color = mix(uHorizonColor, uTopColor, horizon);
          float sunDot = max(dot(d, normalize(uSunDirection)), 0.0);
          float halo = pow(sunDot, 8.0) * 0.4 + pow(sunDot, 28.0) * 0.45;
          float disc = smoothstep(0.997, 0.999, sunDot);
          color += uSunColor * halo;
          color = mix(color, uSunColor, disc);
          vec3 night = mix(vec3(0.035, 0.065, 0.14), vec3(0.15, 0.19, 0.31), horizon * 0.55);
          color = mix(color, night, uNight * 0.93);
          color = mix(color, color * vec3(0.62, 0.72, 0.82), uRain * 0.24);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(380, 40, 24), skyMaterial);
    this.skyDome.frustumCulled = false;
    this.scene.add(this.skyDome);

    this.sunOrb = new THREE.Mesh(new THREE.SphereGeometry(3.8, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffe6b7, fog: false }));
    this.moonOrb = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 12), new THREE.MeshBasicMaterial({ color: 0xe3e9ff, fog: false }));
    this.scene.add(this.sunOrb, this.moonOrb);

    const stars = [];
    for (let i = 0; i < 420; i += 1) {
      const y = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const radius = 300;
      const spread = Math.sqrt(1 - y * y);
      stars.push(Math.cos(theta) * spread * radius, y * radius, Math.sin(theta) * spread * radius);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
    this.stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xddeaff, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    this.cloudGroup = new THREE.Group();
    const cloudMaterial = new THREE.MeshLambertMaterial({ color: 0xf2f0e5, transparent: true, opacity: 0.62, depthWrite: false });
    const cloudGeometry = new THREE.BoxGeometry(1, 1, 1);
    const cloudData = [];
    for (let cloud = 0; cloud < 20; cloud += 1) {
      const baseX = (Math.random() - 0.5) * 200;
      const baseZ = (Math.random() - 0.5) * 200;
      const blocks = 5 + Math.floor(Math.random() * 5);
      for (let part = 0; part < blocks; part += 1) {
        cloudData.push({
          x: baseX + (Math.random() - 0.5) * 7,
          y: 34 + Math.random() * 3 + (part % 3) * 0.6,
          z: baseZ + (Math.random() - 0.5) * 7,
          sx: 2.6 + Math.random() * 4.2,
          sy: 1.1 + Math.random() * 1.1,
          sz: 2.5 + Math.random() * 4.8,
        });
      }
    }
    this.cloudMesh = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, cloudData.length);
    this.cloudMesh.castShadow = false;
    this.cloudMesh.receiveShadow = false;
    const cloudDummy = new THREE.Object3D();
    cloudData.forEach((part, index) => {
      cloudDummy.position.set(part.x, part.y, part.z);
      cloudDummy.scale.set(part.sx, part.sy, part.sz);
      cloudDummy.updateMatrix();
      this.cloudMesh.setMatrixAt(index, cloudDummy.matrix);
    });
    this.cloudMesh.instanceMatrix.needsUpdate = true;
    this.cloudGroup.add(this.cloudMesh);
    this.scene.add(this.cloudGroup);

    const rainPositions = new Float32Array(280 * 2 * 3);
    this.rainDrops = Array.from({ length: 280 }, () => ({ x: (Math.random() - 0.5) * 28, y: 4 + Math.random() * 22, z: (Math.random() - 0.5) * 28, length: 0.55 + Math.random() * 0.6 }));
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    this.rainLines = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: 0xb7d9e8, transparent: true, opacity: 0.34, depthWrite: false }));
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;
    this.scene.add(this.rainLines);
  }

  createParticles() {
    this.particleDummy = new THREE.Object3D();
    this.particleGeometry = new THREE.BoxGeometry(0.105, 0.105, 0.105);
    this.particleMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
    this.particleMesh = new THREE.InstancedMesh(this.particleGeometry, this.particleMaterial, this.particleLimit);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.count = 0;
    this.particleMesh.frustumCulled = false;
    this.scene.add(this.particleMesh);
  }

  setupWorld(saveData = null) {
    if (this.creatures) this.creatures.dispose();
    if (this.world) this.world.dispose();
    for (const light of this.torchLights.values()) this.scene.remove(light);
    this.torchLights.clear();
    this.world = new VoxelWorld(this.scene, this.seed, saveData?.edits || []);
    const safe = this.findSpawn();
    const savedPlayer = saveData?.player;
    const validSavedPosition = savedPlayer && Number.isFinite(savedPlayer.x) && Number.isFinite(savedPlayer.y) && Number.isFinite(savedPlayer.z)
      && savedPlayer.y > 1 && savedPlayer.y < CHUNK_HEIGHT - 2;
    const spawnX = validSavedPosition ? savedPlayer.x : safe.x;
    const spawnZ = validSavedPosition ? savedPlayer.z : safe.z;
    const spawnY = validSavedPosition ? savedPlayer.y : safe.y;
    this.world.initialize(spawnX, spawnZ);
    this.player.position.set(spawnX, spawnY, spawnZ);
    this.player.velocity.set(0, 0, 0);
    this.player.grounded = false;
    this.player.spawn.set(safe.x, safe.y, safe.z);
    this.player.health = this.health;
    if (validSavedPosition && this.collideAt(spawnX, spawnY, spawnZ)) {
      this.player.position.set(safe.x, safe.y, safe.z);
      this.player.velocity.set(0, 0, 0);
    }
    this.yaw = safeNumber(savedPlayer?.yaw, -0.2);
    this.pitch = safeNumber(savedPlayer?.pitch, 0);
    this.camera.position.set(spawnX, spawnY + 1.58, spawnZ);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.creatures = new CreatureSystem(
      this.scene,
      this.world,
      this.player,
      (id, count, position) => this.onCreatureDrop(id, count, position),
      (position, color, count) => this.spawnParticles(position, color, count),
      (damage) => this.hurtPlayer(damage),
    );
    this.loadSavedTorchLights();
  }

  findSpawn() {
    if (this.world) {
      const isSafe = (x, z) => {
        const column = this.world.column(x, z);
        if (column.height <= SEA_LEVEL + 1 || column.biome === 'snowfield') return false;
        if (this.world.getBlock(x, column.height + 1, z) !== BLOCK.AIR
          || this.world.getBlock(x, column.height + 2, z) !== BLOCK.AIR) return false;
        for (let dz = -1; dz <= 1; dz += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dz === 0) continue;
            const neighbor = this.world.column(x + dx, z + dz);
            if (neighbor.height > column.height) return false;
            for (let bodyY = column.height + 1; bodyY <= column.height + 2; bodyY += 1) {
              const obstacle = this.world.getBlock(x + dx, bodyY, z + dz);
              if (obstacle !== BLOCK.AIR && obstacle !== BLOCK.WATER && obstacle !== BLOCK.TORCH) return false;
            }
          }
        }
        return true;
      };
      let best = null;
      let bestScore = -Infinity;
      for (let radius = 0; radius <= 16; radius += 1) {
        for (let x = -radius; x <= radius; x += 1) {
          for (let z = -radius; z <= radius; z += 1) {
            if (radius > 0 && Math.max(Math.abs(x), Math.abs(z)) !== radius) continue;
            if (!isSafe(x, z)) continue;
            const column = this.world.column(x, z);
            let nearbyTrees = 0;
            let nearestTree = 8;
            for (let tz = z - 5; tz <= z + 5; tz += 1) {
              for (let tx = x - 5; tx <= x + 5; tx += 1) {
                if (!this.world.treePlan(tx, tz)) continue;
                const distance = Math.hypot(tx - x, tz - z);
                if (distance < 7) nearbyTrees += 1;
                nearestTree = Math.min(nearestTree, distance);
              }
            }
            const biomeScore = column.biome === 'meadow' ? 13 : column.biome === 'shore' ? 4 : column.biome === 'woodland' ? -3 : 0;
            const heightScore = 4 - Math.abs(column.height - 15) * 0.35;
            const score = biomeScore + heightScore + Math.min(nearestTree, 7) * 0.65 - nearbyTrees * 1.2 - Math.hypot(x, z) * 0.12;
            if (score > bestScore) {
              bestScore = score;
              best = { x: x + 0.5, y: column.height + 1, z: z + 0.5 };
            }
          }
        }
      }
      if (best) return best;
    }
    return { x: 0.5, y: 15, z: 0.5 };
  }

  loadSavedTorchLights() {
    let count = 0;
    for (const [key, id] of this.world.edits) {
      if (id !== BLOCK.TORCH || count >= 16) continue;
      const [x, y, z] = key.split(',').map(Number);
      this.createTorchLight(x, y, z, key);
      count += 1;
    }
  }

  createTargetOutline() {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    this.targetOutline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xf7efce, transparent: true, opacity: 0.78, depthTest: true }));
    this.targetOutline.visible = false;
    this.targetOutline.renderOrder = 4;
    this.scene.add(this.targetOutline);
  }

  bindEvents() {
    this.onResize = () => this.resize();
    this.onPointerLock = () => this.pointerLockChanged();
    this.onMouseMove = (event) => this.mouseMove(event);
    this.onPointerMove = (event) => this.pointerMove(event);
    this.onPointerDown = (event) => this.pointerDown(event);
    this.onPointerUp = (event) => this.pointerUp(event);
    this.onKeyDown = (event) => this.keyDown(event);
    this.onKeyUp = (event) => this.keyUp(event);
    this.onVisibility = () => {
      if (document.hidden && this.started && !this.paused && !this.inventoryOpen) this.pauseGame();
    };
    this.onPageHide = () => {
      if (this.started || this.saved || this.world?.edits.size) this.saveNow();
    };

    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onPointerLock);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerup', this.onPointerUp);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('beforeunload', this.onPageHide);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.canvas.addEventListener('wheel', (event) => {
      if (!this.started || this.paused || this.inventoryOpen) return;
      this.selectSlot((this.selectedSlot + (event.deltaY > 0 ? 1 : 8)) % 9);
    }, { passive: true });

    this.ui['enter-world'].addEventListener('click', () => this.enterWorld());
    this.ui['new-world'].addEventListener('click', () => this.createNewWorld());
    this.ui['title-sound'].addEventListener('click', () => this.toggleSound());
    this.ui['pack-open'].addEventListener('click', () => this.openInventory());
    this.ui['pause-open'].addEventListener('click', () => this.pauseGame());
    this.ui['inventory-close'].addEventListener('click', () => this.closeInventory());
    this.ui['resume-world'].addEventListener('click', () => this.resumeWorld());
    this.ui['save-title'].addEventListener('click', () => this.returnToTitle());
    this.ui['pause-new-world'].addEventListener('click', () => this.createNewWorld());
    this.ui['pause-sound'].addEventListener('click', () => this.toggleSound());
    this.ui['sensitivity-range'].addEventListener('input', (event) => {
      this.settingsSensitivityValue = Number(event.currentTarget.value);
      this.sensitivity = this.settingsSensitivityValue / 10000;
      this.ui['sensitivity-value'].textContent = String(this.settingsSensitivityValue);
      this.queueSave();
    });
    this.ui['hotbar'].addEventListener('click', (event) => {
      const slot = event.target.closest('[data-slot]');
      if (slot) this.selectSlot(Number(slot.dataset.slot));
    });
    this.ui['inventory-grid'].addEventListener('click', (event) => {
      const slot = event.target.closest('[data-slot]');
      if (slot) this.handleInventorySlot(Number(slot.dataset.slot));
    });
    this.ui['recipe-list'].addEventListener('click', (event) => {
      const button = event.target.closest('[data-recipe]');
      if (button) this.craft(button.dataset.recipe);
    });

    this.ui['touch-stick'].addEventListener('pointerdown', (event) => this.touchStickDown(event));
    this.ui['touch-stick'].addEventListener('pointermove', (event) => this.touchStickMove(event));
    this.ui['touch-stick'].addEventListener('pointerup', (event) => this.touchStickUp(event));
    this.ui['touch-stick'].addEventListener('pointercancel', (event) => this.touchStickUp(event));
    this.ui['touch-pack'].addEventListener('click', () => this.openInventory());
    this.ui['touch-break'].addEventListener('pointerdown', (event) => { event.preventDefault(); this.primaryDown = true; this.refreshTarget(); });
    this.ui['touch-break'].addEventListener('pointerup', () => { this.primaryDown = false; this.mineProgress = 0; });
    this.ui['touch-break'].addEventListener('pointercancel', () => { this.primaryDown = false; this.mineProgress = 0; });
    this.ui['touch-place'].addEventListener('pointerdown', (event) => { event.preventDefault(); this.placeBlock(); });
    this.ui['touch-jump'].addEventListener('pointerdown', (event) => { event.preventDefault(); this.player.jumpRequested = true; });

    this.ui['inventory-screen'].addEventListener('pointerdown', (event) => {
      if (event.target === this.ui['inventory-screen'] || event.target.classList.contains('overlay-shade')) this.closeInventory();
    });
    this.ui['pause-screen'].addEventListener('pointerdown', (event) => {
      if (event.target === this.ui['pause-screen'] || event.target.classList.contains('overlay-shade')) return;
    });
  }

  get canvas() {
    return this.renderer.domElement;
  }

  updateTitleText() {
    if (this.saved) {
      this.ui['enter-label'].textContent = 'Continue your world';
      this.ui['new-world'].textContent = 'Create a new world';
      this.ui['continue-caption'].hidden = false;
    } else {
      this.ui['enter-label'].textContent = 'Begin exploring';
      this.ui['new-world'].textContent = 'Start a new world';
      this.ui['continue-caption'].hidden = true;
    }
  }

  enterWorld() {
    if (this.started && this.paused) {
      this.resumeWorld();
      return;
    }
    this.started = true;
    this.paused = false;
    this.returningToTitle = false;
    this.ui['title-screen'].hidden = true;
    this.ui['hud'].hidden = false;
    this.ui['touch-ui'].hidden = !this.isCoarsePointer();
    this.ensureAudio();
    this.requestPointerLock();
    this.canvas.focus({ preventScroll: true });
    this.updateHud(true);
    this.queueSave();
  }

  createNewWorld() {
    const hasPlayed = Boolean(this.saved || this.started || this.world?.edits.size);
    if (hasPlayed && !window.confirm('Start fresh? This replaces the saved valley on this device.')) return;
    this.unlockPointer();
    this.started = false;
    this.paused = true;
    this.inventoryOpen = false;
    this.ui['inventory-screen'].hidden = true;
    this.ui['pause-screen'].hidden = true;
    this.seed = Math.floor(Math.random() * 2147483000) + 1;
    this.saved = null;
    this.dayTime = 0.29;
    this.dayNumber = 1;
    this.health = 100;
    this.player.health = 100;
    this.inventory = createStartingInventory();
    this.selectedSlot = 0;
    this.sensitivity = 0.002;
    this.settingsSensitivityValue = 20;
    this.ui['sensitivity-range'].value = '20';
    this.ui['sensitivity-value'].textContent = '20';
    this.clearTorchLights();
    this.setupWorld(null);
    this.ui['title-screen'].hidden = false;
    this.ui['hud'].hidden = true;
    this.ui['touch-ui'].hidden = true;
    this.updateTitleText();
    this.renderInventory();
    this.updateHud(true);
    try { localStorage.removeItem(SAVE_KEY); } catch { /* Storage may be unavailable in private contexts. */ }
    this.showToast('A fresh valley is taking shape');
  }

  isCoarsePointer() {
    return window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 700;
  }

  requestPointerLock() {
    if (this.isCoarsePointer() || !this.canvas.requestPointerLock) return;
    try {
      const promise = this.canvas.requestPointerLock();
      if (promise?.catch) promise.catch(() => {});
    } catch { /* Older browsers may deny pointer lock without a gesture. */ }
  }

  unlockPointer() {
    if (document.pointerLockElement === this.canvas && document.exitPointerLock) document.exitPointerLock();
  }

  pointerLockChanged() {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    if (this.pointerLocked) {
      this.ignoreLockJump = true;
      this.paused = false;
      this.ui['pause-screen'].hidden = true;
      this.ui['inventory-screen'].hidden = true;
      this.inventoryOpen = false;
    } else if (this.started && !this.paused && !this.inventoryOpen && !this.returningToTitle && !this.isCoarsePointer()) {
      this.pauseGame(false);
    }
  }

  pauseGame(unlock = true) {
    if (!this.started || this.paused) return;
    this.paused = true;
    this.primaryDown = false;
    this.ui['pause-screen'].hidden = false;
    this.ui['inventory-screen'].hidden = true;
    this.inventoryOpen = false;
    this.ui['touch-ui'].hidden = true;
    this.saveNow();
    if (unlock) this.unlockPointer();
  }

  resumeWorld() {
    if (!this.started) return;
    this.paused = false;
    this.ui['pause-screen'].hidden = true;
    this.ui['touch-ui'].hidden = !this.isCoarsePointer();
    this.ensureAudio();
    this.requestPointerLock();
    this.canvas.focus({ preventScroll: true });
  }

  returnToTitle() {
    this.saveNow();
    this.returningToTitle = true;
    this.started = false;
    this.paused = true;
    this.inventoryOpen = false;
    this.primaryDown = false;
    this.unlockPointer();
    this.ui['pause-screen'].hidden = true;
    this.ui['inventory-screen'].hidden = true;
    this.ui['hud'].hidden = true;
    this.ui['touch-ui'].hidden = true;
    this.ui['title-screen'].hidden = false;
    this.saved = readSave();
    this.updateTitleText();
  }

  openInventory() {
    if (!this.started || this.paused || this.inventoryOpen) return;
    this.inventoryOpen = true;
    this.primaryDown = false;
    this.ui['inventory-screen'].hidden = false;
    this.ui['touch-ui'].hidden = true;
    this.selectedInventorySlot = null;
    this.renderInventory();
    this.unlockPointer();
  }

  closeInventory() {
    if (!this.inventoryOpen) return;
    this.inventoryOpen = false;
    this.ui['inventory-screen'].hidden = true;
    this.ui['touch-ui'].hidden = !this.isCoarsePointer();
    this.selectedInventorySlot = null;
    if (this.started && !this.paused) this.requestPointerLock();
  }

  mouseMove(event) {
    if (!this.pointerLocked) return;
    const dx = event.movementX || 0;
    const dy = event.movementY || 0;
    if (this.ignoreLockJump) {
      this.ignoreLockJump = false;
      if (Math.abs(dx) > 70 || Math.abs(dy) > 70) return;
    }
    this.look(dx, dy);
  }

  pointerMove(event) {
    if (!this.pointerLocked && this.mousePointer !== null && event.pointerId === this.mousePointer) {
      this.look(event.movementX || 0, event.movementY || 0);
    }
    if (this.lookPointer !== null && event.pointerId === this.lookPointer) {
      const dx = event.clientX - this.lookLastX;
      const dy = event.clientY - this.lookLastY;
      this.lookLastX = event.clientX;
      this.lookLastY = event.clientY;
      this.look(dx, dy);
    }
  }

  look(dx, dy) {
    if (!this.started || this.paused || this.inventoryOpen) return;
    this.yaw -= dx * this.sensitivity;
    this.pitch -= dy * this.sensitivity;
    this.pitch = Math.max(-1.48, Math.min(1.48, this.pitch));
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  pointerDown(event) {
    if (!this.started || this.paused || this.inventoryOpen) return;
    if (event.pointerType === 'touch') {
      this.lookPointer = event.pointerId;
      this.lookLastX = event.clientX;
      this.lookLastY = event.clientY;
      this.canvas.setPointerCapture?.(event.pointerId);
      return;
    }
    if (event.pointerType !== 'mouse') return;
    if (!this.pointerLocked) {
      this.mousePointer = event.pointerId;
      this.requestPointerLock();
      return;
    }
    if (event.button === 0) {
      this.refreshTarget();
      if (this.selectedTarget?.kind === 'creature') this.attackCreature(this.selectedTarget.entity);
      else {
        this.primaryDown = true;
        this.mineProgress = 0;
        this.mineKey = null;
      }
    } else if (event.button === 2) this.placeBlock();
    else if (event.button === 1) this.pickBlock();
  }

  pointerUp(event) {
    if (event.pointerId === this.mousePointer) this.mousePointer = null;
    if (event.pointerId === this.lookPointer) this.lookPointer = null;
    if (event.button === 0 || event.pointerType === 'touch') {
      this.primaryDown = false;
      this.mineProgress = 0;
    }
  }

  touchStickDown(event) {
    event.preventDefault();
    this.touchStickPointer = event.pointerId;
    this.ui['touch-stick'].setPointerCapture?.(event.pointerId);
    this.touchStickMove(event);
  }

  touchStickMove(event) {
    if (event.pointerId !== this.touchStickPointer) return;
    const rect = this.ui['touch-stick'].getBoundingClientRect();
    const radius = rect.width * 0.34;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.max(1, Math.hypot(dx, dy));
    const clamped = Math.min(radius, length);
    const nx = dx / length * clamped;
    const ny = dy / length * clamped;
    this.touchMove.x = nx / radius;
    this.touchMove.z = ny / radius;
    this.ui['touch-knob'].style.transform = `translate(${nx}px, ${ny}px)`;
  }

  touchStickUp(event) {
    if (event.pointerId !== this.touchStickPointer) return;
    this.touchStickPointer = null;
    this.touchMove.x = 0;
    this.touchMove.z = 0;
    this.ui['touch-knob'].style.transform = 'translate(0, 0)';
  }

  keyDown(event) {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (event.repeat) {
      if (event.code.startsWith('Digit')) return;
      return;
    }
    if (event.code === 'Escape') {
      if (this.inventoryOpen) this.closeInventory();
      else if (this.started && !this.paused) this.pauseGame();
      return;
    }
    if (event.code === 'KeyE') {
      if (this.inventoryOpen) this.closeInventory();
      else this.openInventory();
      return;
    }
    if (event.code.startsWith('Digit')) {
      const number = Number(event.code.slice(-1));
      if (number >= 1 && number <= 9) this.selectSlot(number - 1);
    }
    if (event.code === 'Space') this.player.jumpRequested = true;
    this.moveKeys.add(event.code);
  }

  keyUp(event) {
    this.moveKeys.delete(event.code);
  }

  selectSlot(index) {
    if (index < 0 || index > 8) return;
    this.selectedSlot = index;
    this.renderHotbar();
    this.queueSave();
  }

  selectedStack() {
    return this.inventory[this.selectedSlot] || null;
  }

  selectedItem() {
    const stack = this.selectedStack();
    return stack ? { ...ITEMS[stack.id], id: stack.id, count: stack.count, durability: stack.durability } : null;
  }

  handleInventorySlot(index) {
    if (this.selectedInventorySlot === null) {
      this.selectedInventorySlot = index;
      this.renderInventory();
      return;
    }
    if (this.selectedInventorySlot === index) {
      this.selectedInventorySlot = null;
      this.renderInventory();
      return;
    }
    const from = this.selectedInventorySlot;
    const a = this.inventory[from];
    const b = this.inventory[index];
    this.inventory[from] = b;
    this.inventory[index] = a;
    this.selectedInventorySlot = null;
    this.renderInventory();
    this.renderHotbar();
    this.queueSave();
  }

  craft(recipeId) {
    const recipe = RECIPES.find((entry) => entry.id === recipeId);
    if (!recipe || !canCraft(this.inventory, recipe)) return;
    for (const [id, amount] of recipe.ingredients) consumeItems(this.inventory, id, amount);
    const left = addItem(this.inventory, recipe.output, recipe.amount);
    if (left > 0) {
      for (const [id, amount] of recipe.ingredients) addItem(this.inventory, id, amount);
      this.showToast('Make room in your pack first');
      this.renderInventory();
      return;
    }
    const name = ITEMS[recipe.output].name;
    this.playTone(480, 'triangle', 0.08, 0.045);
    this.showToast(`Made ${recipe.amount > 1 ? `${recipe.amount} ` : ''}${name}`);
    this.renderInventory();
    this.renderHotbar();
    this.queueSave();
  }

  renderHotbar() {
    const html = [];
    for (let index = 0; index < 9; index += 1) {
      const stack = this.inventory[index];
      const meta = stack ? ITEMS[stack.id] : null;
      const icon = meta ? `<span class="item-icon icon-${meta.icon}" aria-hidden="true"></span>` : '<span class="empty-slot-mark"></span>';
      const durability = stack && meta?.durability ? `<span class="durability-track"><i style="width:${Math.max(0, (stack.durability ?? meta.durability) / meta.durability * 100)}%"></i></span>` : '';
      html.push(`<button class="hotbar-slot${index === this.selectedSlot ? ' is-selected' : ''}" data-slot="${index}" type="button" aria-label="Slot ${index + 1}${meta ? `, ${meta.name}, ${stack.count}` : ', empty'}"><span class="hotbar-key">${index + 1}</span>${icon}${stack && stack.count > 1 ? `<span class="stack-count">${stack.count}</span>` : ''}${durability}</button>`);
    }
    this.ui['hotbar'].innerHTML = html.join('');
    const stack = this.selectedStack();
    this.ui['bottom-hint'].dataset.selected = stack ? ITEMS[stack.id]?.name || '' : '';
    this.ui['bottom-hint'].title = stack ? ITEMS[stack.id]?.name || '' : 'Empty hand';
  }

  renderInventory() {
    if (!this.ui['inventory-grid']) return;
    this.ui['inventory-grid'].innerHTML = this.inventory.map((stack, index) => {
      const meta = stack ? ITEMS[stack.id] : null;
      const icon = meta ? `<span class="item-icon icon-${meta.icon}" aria-hidden="true"></span>` : '<span class="empty-slot-mark"></span>';
      const count = stack && stack.count > 1 ? `<span class="pack-count">${stack.count}</span>` : '';
      const durability = stack && meta?.durability ? `<span class="durability-track"><i style="width:${Math.max(0, (stack.durability ?? meta.durability) / meta.durability * 100)}%"></i></span>` : '';
      const hint = meta ? `${meta.name}${meta.durability ? ` · ${stack.durability ?? meta.durability} durability` : ''}` : 'Empty slot';
      return `<button class="pack-slot${index < 9 ? ' quick-slot' : ''}${this.selectedInventorySlot === index ? ' slot-picked' : ''}" data-slot="${index}" type="button" title="${hint}" aria-label="Slot ${index + 1}: ${hint}"><span class="pack-slot-key">${index < 9 ? index + 1 : ''}</span>${icon}${count}${durability}</button>`;
    }).join('');
    this.ui['recipe-list'].innerHTML = RECIPES.map((recipe) => {
      const output = ITEMS[recipe.output];
      const ready = canCraft(this.inventory, recipe);
      const ingredients = recipe.ingredients.map(([id, amount]) => {
        const name = ITEMS[id]?.name || 'Material';
        const have = inventoryCount(this.inventory, id);
        return `<span class="ingredient${have >= amount ? ' ingredient-ready' : ''}">${amount} ${name}</span>`;
      }).join('');
      return `<article class="recipe-row"><span class="recipe-icon"><span class="item-icon icon-${output.icon}" aria-hidden="true"></span></span><div class="recipe-copy"><div class="recipe-title">${output.name}${recipe.amount > 1 ? ` <span>× ${recipe.amount}</span>` : ''}</div><p>${recipe.note}</p><div class="recipe-cost">${ingredients}</div></div><button class="craft-button" type="button" data-recipe="${recipe.id}" ${ready ? '' : 'disabled'} aria-label="Craft ${output.name}">Make</button></article>`;
    }).join('');
    const help = this.selectedInventorySlot === null ? 'Choose a slot, then choose another to swap.' : `Slot ${this.selectedInventorySlot + 1} selected. Choose another slot to swap.`;
    this.ui['inventory-tip'].textContent = help;
  }

  updateSoundButtons() {
    for (const id of ['title-sound', 'pause-sound']) {
      const button = this.ui[id];
      if (!button) continue;
      button.innerHTML = `${this.audioEnabled ? ICONS.sound : ICONS.mute}<span>Sound ${this.audioEnabled ? 'on' : 'off'}</span>`;
      button.setAttribute('aria-pressed', String(this.audioEnabled));
    }
  }

  toggleSound() {
    this.audioEnabled = !this.audioEnabled;
    if (this.audioEnabled) this.ensureAudio();
    if (this.audioMaster) this.audioMaster.gain.setTargetAtTime(this.audioEnabled ? 0.42 : 0, this.audioContext.currentTime, 0.04);
    this.updateSoundButtons();
    this.queueSave();
    if (this.audioEnabled) this.playTone(420, 'sine', 0.075, 0.035);
  }

  ensureAudio() {
    if (!this.audioEnabled || this.audioContext) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    try {
      this.audioContext = new AudioCtor();
      this.audioMaster = this.audioContext.createGain();
      this.audioMaster.gain.value = 0.42;
      this.audioMaster.connect(this.audioContext.destination);
      if (this.audioContext.state === 'suspended') this.audioContext.resume();
    } catch {
      this.audioContext = null;
      this.audioMaster = null;
    }
  }

  playTone(frequency, type = 'triangle', duration = 0.12, volume = 0.055) {
    if (!this.audioEnabled) return;
    this.ensureAudio();
    if (!this.audioContext || !this.audioMaster) return;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const now = this.audioContext.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * 0.55), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.audioMaster);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  showToast(message) {
    const toast = this.ui.toast;
    toast.textContent = message;
    toast.classList.remove('toast-visible');
    void toast.offsetWidth;
    toast.classList.add('toast-visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => toast.classList.remove('toast-visible'), 2200);
  }

  queueSave() {
    this.savePending = true;
  }

  saveNow() {
    if (!this.world || !this.player) return;
    const save = {
      version: 1,
      seed: this.seed,
      edits: Array.from(this.world.edits.entries()),
      inventory: this.inventory,
      selectedSlot: this.selectedSlot,
      player: {
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
        yaw: this.yaw,
        pitch: this.pitch,
      },
      health: this.player.health,
      dayTime: this.dayTime,
      dayNumber: this.dayNumber,
      audioEnabled: this.audioEnabled,
      sensitivity: this.sensitivity,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      this.saved = save;
      this.savePending = false;
      this.updateTitleText();
    } catch {
      this.showToast('This browser could not save the valley');
    }
  }

  updateSave(dt) {
    this.saveTimer += dt;
    if (this.saveTimer >= 15) {
      this.saveTimer = 0;
      this.saveNow();
    } else if (this.savePending && this.saveTimer > 2) this.saveNow();
  }

  createTorchLight(x, y, z, key = `${x},${y},${z}`) {
    if (this.torchLights.has(key) || this.torchLights.size >= 18) return;
    const light = new THREE.PointLight(0xffbe73, 1.18, 8.2, 1.75);
    light.position.set(x + 0.5, y + 0.9, z + 0.5);
    this.scene.add(light);
    this.torchLights.set(key, light);
  }

  clearTorchLights() {
    for (const light of this.torchLights.values()) this.scene.remove(light);
    this.torchLights.clear();
  }

  syncTorchLight(x, y, z, id) {
    const key = `${x},${y},${z}`;
    const old = this.torchLights.get(key);
    if (old) {
      this.scene.remove(old);
      this.torchLights.delete(key);
    }
    if (id === BLOCK.TORCH) this.createTorchLight(x, y, z, key);
  }

  addToInventory(id, amount = 1) {
    const left = addItem(this.inventory, id, amount);
    if (left > 0) this.showToast(`Pack full · left ${left} ${ITEMS[id]?.name || 'items'}`);
    this.renderHotbar();
    if (this.inventoryOpen) this.renderInventory();
    this.queueSave();
    return left;
  }

  onCreatureDrop(id, count, position) {
    this.addToInventory(id, count);
    this.spawnParticles(position, id === ITEM.COAL ? 0x8c8be9 : 0xc7a17a, 12);
    this.playTone(id === ITEM.COAL ? 250 : 310, 'triangle', 0.16, 0.055);
    this.showToast(`Collected ${ITEMS[id].name}`);
  }

  selectedToolInfo() {
    const stack = this.selectedStack();
    return stack ? ITEMS[stack.id] : null;
  }

  miningDuration(blockId) {
    const toolStack = this.selectedStack();
    const tool = toolStack ? ITEMS[toolStack.id]?.tool : null;
    let base = 0.58;
    if ([BLOCK.GRASS, BLOCK.DIRT].includes(blockId)) base = 0.48;
    else if ([BLOCK.SAND, BLOCK.GRAVEL, BLOCK.SNOW].includes(blockId)) base = 0.38;
    else if (blockId === BLOCK.LEAVES) base = 0.23;
    else if (blockId === BLOCK.LOG) base = 0.58;
    else if ([BLOCK.STONE, BLOCK.COAL_ORE, BLOCK.IRON_ORE].includes(blockId)) base = 0.88;
    else if (blockId === BLOCK.TORCH) base = 0.16;
    if (blockId === BLOCK.LOG && tool === 'axe') base *= toolStack.id === ITEM.STONE_AXE ? 0.27 : 0.38;
    else if ([BLOCK.STONE, BLOCK.COAL_ORE, BLOCK.IRON_ORE].includes(blockId) && tool === 'pickaxe') {
      base *= toolStack.id === ITEM.IRON_PICK ? 0.26 : toolStack.id === ITEM.STONE_PICK ? 0.36 : 0.58;
    } else if (blockId === BLOCK.LEAVES && tool === 'axe') base *= 0.48;
    else if ([BLOCK.STONE, BLOCK.COAL_ORE, BLOCK.IRON_ORE].includes(blockId) && tool !== 'pickaxe') base *= 1.6;
    return Math.max(0.12, base);
  }

  blockDrop(blockId) {
    switch (blockId) {
      case BLOCK.GRASS: return [BLOCK.DIRT, 1];
      case BLOCK.DIRT: return [BLOCK.DIRT, 1];
      case BLOCK.STONE: return [BLOCK.STONE, 1];
      case BLOCK.SAND: return [BLOCK.SAND, 1];
      case BLOCK.LOG: return [BLOCK.LOG, 1];
      case BLOCK.LEAVES: return [BLOCK.LEAVES, Math.random() < 0.65 ? 1 : 0];
      case BLOCK.PLANK: return [BLOCK.PLANK, 1];
      case BLOCK.COAL_ORE: return [ITEM.COAL, 2 + Math.floor(Math.random() * 2)];
      case BLOCK.IRON_ORE: return [ITEM.RAW_IRON, 1];
      case BLOCK.GRAVEL: return [BLOCK.GRAVEL, 1];
      case BLOCK.SNOW: return [BLOCK.SNOW, 1];
      case BLOCK.TORCH: return [BLOCK.TORCH, 1];
      default: return null;
    }
  }

  breakBlock(target = this.selectedTarget) {
    if (!target || target.kind !== 'block' || target.id === BLOCK.BEDROCK || target.id === BLOCK.WATER) return;
    const drop = this.blockDrop(target.id);
    const color = this.blockParticleColor(target.id);
    if (!this.world.setBlock(target.x, target.y, target.z, BLOCK.AIR)) return;
    this.syncTorchLight(target.x, target.y, target.z, BLOCK.AIR);
    if (drop && drop[1] > 0) {
      this.addToInventory(drop[0], drop[1]);
      this.showToast(`+ ${drop[1]} ${ITEMS[drop[0]]?.name || 'material'}`);
    }
    const toolStack = this.selectedStack();
    if (toolStack && ITEMS[toolStack.id]?.tool) this.useToolDurability(this.selectedSlot);
    this.spawnParticles(new THREE.Vector3(target.x + 0.5, target.y + 0.5, target.z + 0.5), color, 16);
    this.playTone(190 + Math.random() * 70, 'triangle', 0.12, 0.06);
    this.mineProgress = 0;
    this.mineKey = null;
    this.primaryDown = false;
    this.selectedTarget = null;
    this.queueSave();
  }

  blockParticleColor(id) {
    return {
      [BLOCK.GRASS]: 0x79a64d,
      [BLOCK.DIRT]: 0x96714c,
      [BLOCK.STONE]: 0x91958f,
      [BLOCK.SAND]: 0xd3bf89,
      [BLOCK.LOG]: 0x9a704a,
      [BLOCK.LEAVES]: 0x6d9952,
      [BLOCK.PLANK]: 0xb68c60,
      [BLOCK.COAL_ORE]: 0x43494a,
      [BLOCK.IRON_ORE]: 0x9e8d70,
      [BLOCK.GRAVEL]: 0xa5a196,
      [BLOCK.SNOW]: 0xdce8e9,
      [BLOCK.TORCH]: 0xffbd6b,
    }[id] || 0xb3b3a8;
  }

  useToolDurability(slotIndex) {
    const stack = this.inventory[slotIndex];
    if (!stack) return;
    const meta = ITEMS[stack.id];
    if (!meta?.durability) return;
    stack.durability = Math.max(0, (stack.durability ?? meta.durability) - 1);
    if (stack.durability === 0) {
      this.inventory[slotIndex] = null;
      this.showToast(`${meta.name} broke`);
    }
    this.renderHotbar();
    if (this.inventoryOpen) this.renderInventory();
    this.queueSave();
  }

  placeBlock(target = this.selectedTarget) {
    if (!this.started || this.paused || this.inventoryOpen || !target || target.kind !== 'block') return false;
    const stack = this.selectedStack();
    if (!stack) return false;
    const meta = ITEMS[stack.id];
    if (!meta?.place || target.id === BLOCK.WATER) return false;
    const normal = target.normal;
    const x = Math.floor(target.point.x + normal.x * 0.51);
    const y = Math.floor(target.point.y + normal.y * 0.51);
    const z = Math.floor(target.point.z + normal.z * 0.51);
    if (y <= 0 || y >= CHUNK_HEIGHT - 1) return false;
    const existing = this.world.getBlock(x, y, z);
    if (existing !== BLOCK.AIR && existing !== BLOCK.WATER && existing !== BLOCK.TORCH) return false;
    if (stack.id === BLOCK.TORCH) {
      const support = this.world.getBlock(x, y - 1, z);
      if (support === BLOCK.AIR || support === BLOCK.WATER) return false;
    } else if (this.playerOverlapsBlock(x, y, z)) {
      this.showToast('There is not enough room there');
      return false;
    }
    if (!this.world.setBlock(x, y, z, meta.place)) return false;
    stack.count -= 1;
    if (stack.count <= 0) this.inventory[this.selectedSlot] = null;
    if (meta.place === BLOCK.TORCH) this.syncTorchLight(x, y, z, BLOCK.TORCH);
    this.renderHotbar();
    if (this.inventoryOpen) this.renderInventory();
    this.spawnParticles(new THREE.Vector3(x + 0.5, y + 0.55, z + 0.5), this.blockParticleColor(meta.place), 7);
    this.playTone(300, 'sine', 0.09, 0.045);
    this.queueSave();
    return true;
  }

  playerOverlapsBlock(x, y, z) {
    const p = this.player.position;
    return p.x + PLAYER_RADIUS > x && p.x - PLAYER_RADIUS < x + 1
      && p.z + PLAYER_RADIUS > z && p.z - PLAYER_RADIUS < z + 1
      && p.y + PLAYER_HEIGHT > y && p.y < y + 1;
  }

  pickBlock() {
    if (!this.selectedTarget || this.selectedTarget.kind !== 'block') return;
    const id = this.selectedTarget.id;
    const slot = this.inventory.findIndex((entry) => entry?.id === id);
    if (slot >= 0 && slot < 9) this.selectSlot(slot);
    else this.showToast('Gather a block before it can join your quick slots');
  }

  attackCreature(entity) {
    if (!entity) return;
    const stack = this.selectedStack();
    const meta = stack ? ITEMS[stack.id] : null;
    const didAttack = this.creatures.attack(entity, meta ? { ...meta, id: stack.id } : null);
    if (!didAttack) return;
    if (stack && meta?.tool) this.useToolDurability(this.selectedSlot);
    this.playTone(meta?.tool === 'sword' ? 230 : 155, 'triangle', 0.14, 0.06);
    this.queueSave();
  }

  refreshTarget() {
    if (!this.started || this.paused || this.inventoryOpen) return null;
    this.raycaster.setFromCamera(this.centerScreen, this.camera);
    const blockHits = this.raycaster.intersectObjects(this.world.raycastMeshes(), false);
    let blockTarget = null;
    for (const hit of blockHits) {
      if (hit.distance > MAX_REACH || !hit.face) continue;
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).round();
      const point = hit.point.clone();
      const x = Math.floor(point.x - normal.x * 0.015);
      const y = Math.floor(point.y - normal.y * 0.015);
      const z = Math.floor(point.z - normal.z * 0.015);
      const id = this.world.getBlock(x, y, z);
      if (id === BLOCK.AIR || id === BLOCK.WATER) continue;
      blockTarget = { kind: 'block', x, y, z, id, normal, point, distance: hit.distance };
      break;
    }
    const creatureHit = this.creatures.pick(this.raycaster);
    if (creatureHit && (!blockTarget || creatureHit.distance < blockTarget.distance)) {
      this.selectedTarget = { kind: 'creature', entity: creatureHit.entity };
      this.targetOutline.visible = false;
      this.ui['target-label'].hidden = false;
      this.ui['target-label'].textContent = creatureHit.entity.kind === 'gloam' ? 'GLOAMLING' : 'MOSS SPRITE';
      this.ui['crosshair'].classList.add('target-creature');
      if (this.primaryDown) this.attackCreature(creatureHit.entity);
      return this.selectedTarget;
    }
    this.selectedTarget = blockTarget;
    this.ui['crosshair'].classList.remove('target-creature');
    if (blockTarget) {
      this.targetOutline.visible = true;
      this.targetOutline.position.set(blockTarget.x + 0.5, blockTarget.y + 0.5, blockTarget.z + 0.5);
      this.ui['target-label'].hidden = false;
      this.ui['target-label'].textContent = ITEMS[blockTarget.id]?.name?.toUpperCase() || 'BLOCK';
    } else {
      this.targetOutline.visible = false;
      this.ui['target-label'].hidden = true;
    }
    return blockTarget;
  }

  updateMining(dt, target) {
    if (!this.primaryDown || !target || target.kind !== 'block') {
      if (!this.primaryDown) this.mineProgress = 0;
      this.ui['mine-track'].hidden = true;
      return;
    }
    const key = `${target.x},${target.y},${target.z}`;
    if (this.mineKey !== key) {
      this.mineKey = key;
      this.mineProgress = 0;
    }
    if (target.id === BLOCK.BEDROCK || target.id === BLOCK.WATER) return;
    this.mineProgress = Math.min(1, this.mineProgress + dt / this.miningDuration(target.id));
    this.ui['mine-track'].hidden = false;
    this.ui['mine-bar'].style.transform = `scaleX(${this.mineProgress})`;
    this.ui['crosshair'].classList.toggle('is-mining', this.mineProgress > 0);
    if (this.mineProgress >= 1) this.breakBlock(target);
  }

  spawnParticles(position, color, count = 12) {
    const tint = new THREE.Color(color);
    for (let i = 0; i < count; i += 1) {
      if (this.particles.length >= this.particleLimit) this.particles.shift();
      this.particles.push({
        position: position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.72, (Math.random() - 0.5) * 0.62, (Math.random() - 0.5) * 0.72)),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 3.5, 1.1 + Math.random() * 3.3, (Math.random() - 0.5) * 3.5),
        color: tint.clone().lerp(new THREE.Color(0xffffff), Math.random() * 0.24),
        life: 0.5 + Math.random() * 0.48,
        maxLife: 0.85,
        rotation: new THREE.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4),
      });
    }
  }

  updateParticles(dt) {
    const alive = [];
    for (const particle of this.particles) {
      particle.life -= dt;
      if (particle.life <= 0) continue;
      particle.velocity.y -= 7.8 * dt;
      particle.position.addScaledVector(particle.velocity, dt);
      particle.velocity.multiplyScalar(0.985);
      particle.rotation.x += dt * 2.3;
      particle.rotation.y += dt * 1.5;
      const index = alive.length;
      this.particleDummy.position.copy(particle.position);
      this.particleDummy.rotation.copy(particle.rotation);
      const scale = 0.55 + (particle.life / particle.maxLife) * 0.55;
      this.particleDummy.scale.setScalar(scale);
      this.particleDummy.updateMatrix();
      this.particleMesh.setMatrixAt(index, this.particleDummy.matrix);
      this.particleMesh.setColorAt(index, particle.color);
      alive.push(particle);
    }
    this.particles = alive;
    this.particleMesh.count = alive.length;
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
  }

  hurtPlayer(amount) {
    this.player.health = Math.max(0, this.player.health - amount);
    this.health = this.player.health;
    this.lastHurtAt = this.time;
    this.root.querySelector('.damage-flash')?.classList.add('damage-active');
    window.setTimeout(() => this.root.querySelector('.damage-flash')?.classList.remove('damage-active'), 270);
    this.playTone(92, 'sawtooth', 0.28, 0.075);
    this.updateHealthHud();
    if (this.player.health <= 0) this.respawn();
  }

  respawn() {
    this.player.position.copy(this.player.spawn);
    this.player.velocity.set(0, 0, 0);
    this.player.health = 70;
    this.health = 70;
    this.player.grounded = false;
    this.showToast('You find your way back to camp');
    this.updateHealthHud();
    this.queueSave();
  }

  collideAt(x, feetY, z) {
    const minX = Math.floor(x - PLAYER_RADIUS);
    const maxX = Math.floor(x + PLAYER_RADIUS);
    const minZ = Math.floor(z - PLAYER_RADIUS);
    const maxZ = Math.floor(z + PLAYER_RADIUS);
    const minY = Math.floor(feetY + 0.075);
    const maxY = Math.floor(feetY + PLAYER_HEIGHT - 0.06);
    for (let by = minY; by <= maxY; by += 1) {
      for (let bz = minZ; bz <= maxZ; bz += 1) {
        for (let bx = minX; bx <= maxX; bx += 1) {
          const id = this.world.getBlock(bx, by, bz);
          if (id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.TORCH) return true;
        }
      }
    }
    return false;
  }

  moveAxis(axis, amount) {
    const steps = Math.max(1, Math.ceil(Math.abs(amount) / 0.16));
    const step = amount / steps;
    for (let i = 0; i < steps; i += 1) {
      const next = this.player.position[axis] + step;
      if (this.collideAt(this.player.position.x + (axis === 'x' ? step : 0), this.player.position.y + (axis === 'y' ? step : 0), this.player.position.z + (axis === 'z' ? step : 0))) {
        if (axis === 'y') {
          if (step < 0) this.player.grounded = true;
          this.player.velocity.y = 0;
        } else this.player.velocity[axis] = 0;
        break;
      }
      this.player.position[axis] = next;
      if (axis === 'y') this.player.grounded = false;
    }
  }

  playerInWater() {
    const x = Math.floor(this.player.position.x);
    const y = Math.floor(this.player.position.y + 0.4);
    const z = Math.floor(this.player.position.z);
    return this.world.getBlock(x, y, z) === BLOCK.WATER;
  }

  updatePlayer(dt) {
    const forward = (this.moveKeys.has('KeyW') ? 1 : 0) - (this.moveKeys.has('KeyS') ? 1 : 0) - this.touchMove.z;
    const side = (this.moveKeys.has('KeyD') ? 1 : 0) - (this.moveKeys.has('KeyA') ? 1 : 0) + this.touchMove.x;
    const magnitude = Math.hypot(forward, side);
    const norm = magnitude > 1 ? 1 / magnitude : 1;
    const f = forward * norm;
    const s = side * norm;
    const sprint = this.moveKeys.has('ShiftLeft') || this.moveKeys.has('ShiftRight');
    const inWater = this.playerInWater();
    const speed = (sprint ? 7.05 : 5.25) * (inWater ? 0.55 : 1);
    const targetX = (-Math.sin(this.yaw) * f + Math.cos(this.yaw) * s) * speed;
    const targetZ = (-Math.cos(this.yaw) * f - Math.sin(this.yaw) * s) * speed;
    const response = Math.min(1, dt * (this.player.grounded ? 13 : 5.5));
    this.player.velocity.x += (targetX - this.player.velocity.x) * response;
    this.player.velocity.z += (targetZ - this.player.velocity.z) * response;
    if (magnitude < 0.04 && this.player.grounded) {
      this.player.velocity.x *= Math.max(0, 1 - dt * 10);
      this.player.velocity.z *= Math.max(0, 1 - dt * 10);
    }

    if (this.player.jumpRequested) {
      if (this.player.grounded) {
        this.player.velocity.y = 8.0;
        this.player.grounded = false;
      } else if (inWater) this.player.velocity.y = Math.max(this.player.velocity.y, 4.5);
      this.player.jumpRequested = false;
    }
    this.player.velocity.y = Math.max(-26, this.player.velocity.y - (inWater ? 5.5 : 22) * dt);
    this.moveAxis('x', this.player.velocity.x * dt);
    this.moveAxis('z', this.player.velocity.z * dt);
    this.moveAxis('y', this.player.velocity.y * dt);
    if (this.player.position.y < -5) this.respawn();

    const moving = Math.hypot(this.player.velocity.x, this.player.velocity.z) > 0.45;
    this.player.bob = moving && this.player.grounded ? this.player.bob + dt * (sprint ? 12 : 9) : this.player.bob * Math.max(0, 1 - dt * 8);
    const bob = moving && this.player.grounded ? Math.sin(this.player.bob) * 0.035 : 0;
    this.camera.position.set(this.player.position.x, this.player.position.y + 1.58 + bob, this.player.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  updateDaylight(dt) {
    const previous = this.dayTime;
    this.dayTime += dt / DAY_LENGTH;
    if (this.dayTime >= 1) {
      this.dayTime -= 1;
      this.dayNumber += 1;
      this.showToast(`Day ${this.dayNumber} begins`);
    }
    const angle = (this.dayTime - 0.25) * Math.PI * 2;
    const sunDirection = new THREE.Vector3(Math.cos(angle) * 0.75, Math.sin(angle), 0.18).normalize();
    const daylight = THREE.MathUtils.smoothstep(sunDirection.y, -0.12, 0.35);
    const nightAmount = 1 - daylight;
    const rainAmount = this.weather.raining ? 1 : 0;
    this.skyUniforms.uSunDirection.value.copy(sunDirection);
    this.skyUniforms.uNight.value = nightAmount;
    this.skyUniforms.uRain.value = rainAmount;
    const top = new THREE.Color('#79bdcb').lerp(new THREE.Color('#14213b'), nightAmount * 0.93);
    const horizon = new THREE.Color('#e3c7a0').lerp(new THREE.Color('#52617a'), nightAmount * 0.8);
    const sunColor = new THREE.Color('#fff0c9').lerp(new THREE.Color('#ef936e'), 1 - daylight);
    this.skyUniforms.uTopColor.value.copy(top);
    this.skyUniforms.uHorizonColor.value.copy(horizon);
    this.skyUniforms.uSunColor.value.copy(sunColor);
    this.scene.fog.color.copy(horizon).lerp(new THREE.Color('#455169'), rainAmount * 0.25);
    this.scene.fog.density = 0.0086 + nightAmount * 0.0012 + rainAmount * 0.0033;
    this.ambient.intensity = 0.58 + daylight * 0.85 - rainAmount * 0.13;
    this.ambient.color.set(daylight > 0.25 ? 0xd8eee7 : 0x8692b3);
    this.sunLight.color.copy(sunColor);
    this.sunLight.intensity = 0.08 + daylight * 2.15 - rainAmount * 0.5;
    this.sunLight.position.set(this.player.position.x + sunDirection.x * 85, this.player.position.y + sunDirection.y * 85, this.player.position.z + sunDirection.z * 85);
    this.sunLight.target.position.set(this.player.position.x, this.player.position.y + 2, this.player.position.z);
    this.sunLight.target.updateMatrixWorld();
    this.sunOrb.position.copy(this.camera.position).addScaledVector(sunDirection, 255);
    this.sunOrb.visible = sunDirection.y > -0.08;
    this.sunOrb.material.color.copy(sunColor);
    this.moonOrb.position.copy(this.camera.position).addScaledVector(sunDirection, -242);
    this.moonOrb.visible = nightAmount > 0.36;
    this.stars.position.copy(this.camera.position);
    this.stars.material.opacity = THREE.MathUtils.smoothstep(nightAmount, 0.42, 0.93) * 0.86;
    this.cloudGroup.position.set(Math.floor(this.player.position.x / 120) * 120, 0, Math.floor(this.player.position.z / 120) * 120);
    this.cloudMesh.material.opacity = (0.62 - nightAmount * 0.28) * (this.weather.raining ? 0.7 : 1);
    this.world.updateWater(this.time);
    if (previous > this.dayTime) this.queueSave();
    return nightAmount;
  }

  updateWeather(dt) {
    this.weather.timer -= dt;
    if (this.weather.timer <= 0) {
      this.weather.raining = !this.weather.raining;
      this.weather.timer = this.weather.raining ? 28 + Math.random() * 22 : 82 + Math.random() * 100;
      this.ui['weather-label'].hidden = !this.weather.raining;
      if (this.weather.raining) this.showToast('A soft rain crosses the valley');
    }
    this.rainLines.visible = this.weather.raining && this.started && !this.paused;
    this.rainLines.position.set(this.player.position.x, 0, this.player.position.z);
    if (!this.weather.raining) return;
    const position = this.rainLines.geometry.attributes.position;
    for (let i = 0; i < this.rainDrops.length; i += 1) {
      const drop = this.rainDrops[i];
      drop.y -= dt * 21;
      if (drop.y < -1) {
        drop.y = 18 + Math.random() * 12;
        drop.x = (Math.random() - 0.5) * 28;
        drop.z = (Math.random() - 0.5) * 28;
      }
      const at = i * 6;
      position.array[at] = drop.x;
      position.array[at + 1] = drop.y;
      position.array[at + 2] = drop.z;
      position.array[at + 3] = drop.x - 0.12;
      position.array[at + 4] = drop.y - drop.length;
      position.array[at + 5] = drop.z - 0.035;
    }
    position.needsUpdate = true;
  }

  updateHud(force = false) {
    if (!this.started && !force) return;
    const totalMinutes = Math.floor(this.dayTime * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const x = Math.floor(this.player.position.x);
    const z = Math.floor(this.player.position.z);
    this.ui['day-readout'].innerHTML = `DAY ${String(this.dayNumber).padStart(2, '0')} <i>·</i> ${clock}`;
    this.ui['biome-name'].textContent = this.world.biomeLabel(x, z);
    this.ui.coordinates.textContent = `X ${x} · Z ${z}`;
    this.updateHealthHud();
  }

  updateHealthHud() {
    this.ui['health-bar'].style.width = `${Math.max(0, this.player.health)}%`;
    this.ui['health-value'].textContent = String(Math.round(this.player.health));
    this.ui['health-bar'].classList.toggle('health-low', this.player.health < 35);
  }

  updateUi(dt) {
    this.uiTimer += dt;
    if (this.uiTimer < 0.16) return;
    this.uiTimer = 0;
    if (this.started) this.updateHud();
    const target = this.selectedTarget;
    if (this.primaryDown && target?.kind === 'block' && target.id !== BLOCK.BEDROCK && target.id !== BLOCK.WATER) {
      this.ui['mine-track'].hidden = false;
      this.ui['mine-bar'].style.transform = `scaleX(${this.mineProgress})`;
    }
  }

  resize() {
    if (this.disposed) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
    this.renderer.setSize(width, height);
    this.ui['touch-ui'].hidden = !this.started || this.paused || this.inventoryOpen || !this.isCoarsePointer();
  }

  frame() {
    if (this.disposed) return;
    const dt = Math.min(0.1, this.clock.getDelta());
    this.time += dt;
    const active = this.started && !this.paused && !this.inventoryOpen;
    if (active) {
      this.updatePlayer(dt);
      this.world.updateStreaming(this.player.position.x, this.player.position.z);
      const night = this.updateDaylight(dt);
      this.updateWeather(dt);
      this.creatures.update(dt, this.time, night, true);
      if (this.time - this.lastHurtAt > 20 && this.player.health < 100) {
        this.regenTimer += dt;
        if (this.regenTimer > 3.5) {
          this.regenTimer = 0;
          this.player.health = Math.min(100, this.player.health + 1);
          this.health = this.player.health;
          this.updateHealthHud();
        }
      }
      const target = this.refreshTarget();
      this.updateMining(dt, target);
      this.updateSave(dt);
    } else {
      const night = this.updateDaylight(0);
      this.updateWeather(0);
      this.creatures.update(0, this.time, night, false);
      if (!this.started) this.camera.position.y += Math.sin(this.time * 0.42) * 0.00025;
    }
    this.world.processMeshQueue(1);
    this.updateParticles(dt);
    this.updateUi(dt);
    this.renderer.render(this.scene, this.camera);
    this.animation = requestAnimationFrame(() => this.frame());
  }

  startLoop() {
    this.clock.start();
    this.frame();
  }

  destroy() {
    if (this.disposed) return;
    if (this.started || this.saved || this.world?.edits.size) this.saveNow();
    this.disposed = true;
    cancelAnimationFrame(this.animation);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerlockchange', this.onPointerLock);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerup', this.onPointerUp);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('beforeunload', this.onPageHide);
    this.unlockPointer();
    this.world?.dispose();
    this.creatures?.dispose();
    this.clearTorchLights();
    this.renderer.dispose();
    this.skyDome.geometry.dispose();
    this.skyDome.material.dispose();
    this.sunOrb.geometry.dispose();
    this.sunOrb.material.dispose();
    this.moonOrb.geometry.dispose();
    this.moonOrb.material.dispose();
    this.stars.geometry.dispose();
    this.stars.material.dispose();
    this.cloudMesh.geometry.dispose();
    this.cloudMesh.material.dispose();
    this.rainLines.geometry.dispose();
    this.rainLines.material.dispose();
    this.particleGeometry.dispose();
    this.particleMaterial.dispose();
    this.targetOutline.geometry.dispose();
    this.targetOutline.material.dispose();
    if (this.audioContext && this.audioContext.state !== 'closed') this.audioContext.close();
  }
}
