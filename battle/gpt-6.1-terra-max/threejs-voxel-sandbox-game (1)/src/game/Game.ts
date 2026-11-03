import * as THREE from 'three'
import { GameAudio } from './audio'
import { Block, BLOCK_DROPS, canCraft, countItem, isPlant, isSolid, ITEMS, RECIPES, STARTER_INVENTORY, type ItemId, type Slot } from './blocks'
import { VoxelWorld, WATER_LEVEL } from './world'

const SAVE_KEY = 'blockhaven-world-v1'
const NEXT_SEED_KEY = 'blockhaven-next-seed'
const PLAYER_HEIGHT = 1.8
const PLAYER_RADIUS = 0.3

export interface Progress {
  walked: boolean
  logs: number
  crafted: boolean
  placed: boolean
  tablePlaced: boolean
  stoneCrafted: boolean
  ironSmelted: boolean
}

export interface Workstations {
  table: boolean
  furnace: boolean
}

export interface GameState {
  ready: boolean
  started: boolean
  locked: boolean
  touch: boolean
  inventory: (Slot | null)[]
  selected: number
  biome: string
  position: [number, number, number]
  day: number
  timeOfDay: string
  weather: 'Clear' | 'Rain'
  health: number
  progress: Progress
  workstations: Workstations
  target: string | null
  mining: number
  sound: boolean
  seed: number
  saveAvailable: boolean
}

interface SaveData {
  version: number
  seed: number
  edits: Record<string, number>
  inventory: (Slot | null)[]
  position: [number, number, number]
  yaw: number
  pitch: number
  time: number
  day: number
  health: number
  progress: Progress
  sound: boolean
}

interface Target {
  x: number
  y: number
  z: number
  normal: THREE.Vector3
  block: Block
  distance: number
}

interface Sheep {
  group: THREE.Group
  body: THREE.Mesh
  legs: THREE.Mesh[]
  heading: number
  turnIn: number
  phase: number
  sheared: number
}

interface Particle {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  life: number
}

interface GameCallbacks {
  onState: (state: GameState) => void
  onInventory: () => void
  onPause: () => void
  onCloseOverlay: () => void
  onToast: (message: string) => void
}

function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const save = JSON.parse(raw) as SaveData
    if (save.version !== 1 || !Array.isArray(save.position) || !Array.isArray(save.inventory) || typeof save.seed !== 'number') return null
    return save
  } catch {
    return null
  }
}

function cloneInventory(inventory: (Slot | null)[]) {
  return Array.from({ length: 27 }, (_, i) => inventory[i] ? { ...inventory[i]! } : null)
}

function addToInventory(inventory: (Slot | null)[], id: ItemId, amount: number) {
  let remaining = amount
  for (const slot of inventory) {
    if (slot?.id === id && slot.count < 64) {
      const added = Math.min(64 - slot.count, remaining)
      slot.count += added
      remaining -= added
      if (!remaining) return true
    }
  }
  for (let i = 0; i < inventory.length; i++) {
    if (!inventory[i]) {
      const added = Math.min(64, remaining)
      inventory[i] = { id, count: added }
      remaining -= added
      if (!remaining) return true
    }
  }
  return remaining === 0
}

function removeFromInventory(inventory: (Slot | null)[], id: ItemId, amount: number) {
  let remaining = amount
  for (let i = 0; i < inventory.length && remaining; i++) {
    const slot = inventory[i]
    if (slot?.id !== id) continue
    const removed = Math.min(slot.count, remaining)
    slot.count -= removed
    remaining -= removed
    if (!slot.count) inventory[i] = null
  }
}

export class Game {
  private container: HTMLElement
  private callbacks: GameCallbacks
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private world: VoxelWorld
  private audio = new GameAudio()
  private player = new THREE.Vector3()
  private spawn = new THREE.Vector3()
  private velocityY = 0
  private grounded = false
  private yaw = 0.35
  private pitch = -0.14
  private keys = new Set<string>()
  private inventory: (Slot | null)[]
  private selected = 0
  private health = 10
  private progress: Progress = { walked: false, logs: 0, crafted: false, placed: false, tablePlaced: false, stoneCrafted: false, ironSmelted: false }
  private distanceWalked = 0
  private started = false
  private locked = false
  private touch = false
  private uiOpen = false
  private mining = false
  private miningProgress = 0
  private miningKey = ''
  private target: Target | null = null
  private targetOutline: THREE.LineSegments
  private hand = new THREE.Group()
  private handItem = new THREE.Group()
  private sheep: Sheep[] = []
  private particles: Particle[] = []
  private clouds = new THREE.Group()
  private sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>
  private stars: THREE.Points
  private sun: THREE.Mesh
  private moon: THREE.Mesh
  private rain: THREE.LineSegments
  private rainPositions: Float32Array
  private hemisphere: THREE.HemisphereLight
  private sunlight: THREE.DirectionalLight
  private time = 0.18
  private day = 1
  private weather: 'Clear' | 'Rain' = 'Clear'
  private elapsed = 0
  private stateTimer = 0
  private environmentTimer = 0
  private saveTimer = 0
  private stepTimer = 0
  private shadowTimer = 0
  private lastFrame = 0
  private frameId = 0
  private disposed = false
  private resetting = false
  private saveAvailable = true
  private seed: number
  private raycaster = new THREE.Raycaster()

  constructor(container: HTMLElement, callbacks: GameCallbacks) {
    this.container = container
    this.callbacks = callbacks
    const saved = loadSave()
    let nextSeed = 0
    try {
      nextSeed = Number(localStorage.getItem(NEXT_SEED_KEY)) || 0
      localStorage.removeItem(NEXT_SEED_KEY)
    } catch { this.saveAvailable = false }
    this.seed = saved?.seed ?? (nextSeed || 73145)
    this.inventory = cloneInventory(saved?.inventory ?? STARTER_INVENTORY)
    this.progress = { ...this.progress, ...saved?.progress }
    this.health = typeof saved?.health === 'number' ? Math.max(1, Math.min(10, saved.health)) : 10
    this.time = typeof saved?.time === 'number' ? saved.time : 0.18
    this.day = saved?.day || 1
    this.yaw = saved?.yaw ?? 0.35
    this.pitch = saved?.pitch ?? -0.14
    this.audio.enabled = saved?.sound ?? true

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
    const gl = this.renderer.getContext()
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const gpu = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : ''
    const softwareRenderer = /swiftshader|llvmpipe|software/i.test(gpu)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, softwareRenderer ? 0.7 : 1.5))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.14
    this.renderer.shadowMap.enabled = !softwareRenderer
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.domElement.className = 'world-canvas'
    this.renderer.domElement.setAttribute('aria-label', 'Blockhaven game world')
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 180)
    this.camera.rotation.order = 'YXZ'
    this.scene.add(this.camera)
    this.scene.background = new THREE.Color('#a9d9dc')
    this.scene.fog = new THREE.Fog('#c6dfd1', 42, 105)

    this.hemisphere = new THREE.HemisphereLight(0xe7f5e3, 0x6e8062, 2.05)
    this.scene.add(this.hemisphere)
    this.sunlight = new THREE.DirectionalLight(0xffefd3, 2.1)
    this.sunlight.castShadow = true
    this.sunlight.shadow.mapSize.set(1024, 1024)
    this.sunlight.shadow.camera.left = -30
    this.sunlight.shadow.camera.right = 30
    this.sunlight.shadow.camera.top = 30
    this.sunlight.shadow.camera.bottom = -30
    this.sunlight.shadow.camera.near = 1
    this.sunlight.shadow.camera.far = 130
    this.sunlight.shadow.bias = -0.0004
    this.sunlight.shadow.normalBias = 0.035
    this.scene.add(this.sunlight, this.sunlight.target)

    this.world = new VoxelWorld(this.scene, this.seed, saved?.edits)
    let spawnX = 0
    let spawnZ = 0
    if (this.world.heightAt(0, 0) <= WATER_LEVEL) {
      outer: for (let radius = 1; radius < 20; radius++) {
        for (let x = -radius; x <= radius; x++) for (let z = -radius; z <= radius; z++) {
          if (this.world.heightAt(x, z) > WATER_LEVEL + 1) { spawnX = x; spawnZ = z; break outer }
        }
      }
    }
    this.spawn.set(spawnX + 0.5, this.world.heightAt(spawnX, spawnZ) + 1.01, spawnZ + 0.5)
    this.player.copy(saved ? new THREE.Vector3(...saved.position) : this.spawn)
    this.world.initialize(this.player.x, this.player.z)

    this.targetOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006)),
      new THREE.LineBasicMaterial({ color: 0xf8f8e7, transparent: true, opacity: 0.9, depthTest: true }),
    )
    this.targetOutline.visible = false
    this.scene.add(this.targetOutline)

    this.sky = this.createSky()
    this.scene.add(this.sky)
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ color: 0xfff1c1, fog: false }))
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ color: 0xdce9ed, fog: false }))
    this.scene.add(this.sun, this.moon)
    this.createClouds()
    this.stars = this.createStars()
    this.scene.add(this.stars)
    const rain = this.createRain()
    this.rain = rain.lines
    this.rainPositions = rain.positions
    this.scene.add(this.rain)
    this.createHand()
    this.createSheep()
    this.updateHand()
    this.resize()
    this.updateEnvironment()
    this.updateCamera(0, false)
    this.renderer.shadowMap.needsUpdate = true
    this.renderer.render(this.scene, this.camera)

    window.addEventListener('resize', this.resize)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    window.addEventListener('beforeunload', this.save)
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
    document.addEventListener('mousemove', this.onMouseMove)
    document.addEventListener('mousedown', this.onMouseDown)
    document.addEventListener('mouseup', this.onMouseUp)
    document.addEventListener('wheel', this.onWheel, { passive: false })
    this.renderer.domElement.addEventListener('contextmenu', this.preventContextMenu)
    this.lastFrame = performance.now()
    this.frameId = requestAnimationFrame(this.frame)
    queueMicrotask(() => { if (!this.disposed) this.emit() })
  }

  private resize = () => {
    const width = this.container.clientWidth || window.innerWidth
    const height = this.container.clientHeight || window.innerHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  private createClouds() {
    const material = new THREE.MeshLambertMaterial({ color: 0xf6f6e8, transparent: true, opacity: 0.9, fog: false })
    const box = new THREE.BoxGeometry(1, 1, 1)
    for (let i = 0; i < 21; i++) {
      const a = i * 2.399
      const radius = 24 + (i % 5) * 13
      const cloud = new THREE.Group()
      cloud.position.set(Math.cos(a) * radius, 31 + (i % 4) * 3, Math.sin(a) * radius)
      for (let j = 0; j < 4; j++) {
        const puff = new THREE.Mesh(box, material)
        puff.position.set(j * 3.1 - 4.5, j === 1 || j === 2 ? 0.45 : 0, (j % 2) * 1.4)
        puff.scale.set(4.6, 1.15, 3.1)
        cloud.add(puff)
      }
      this.clouds.add(cloud)
    }
    this.scene.add(this.clouds)
  }

  private createSky() {
    const material = new THREE.ShaderMaterial({
      uniforms: { topColor: { value: new THREE.Color('#8dcbd5') }, horizonColor: { value: new THREE.Color('#d5e8d6') } },
      vertexShader: `
        varying vec3 worldPosition;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          worldPosition = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        varying vec3 worldPosition;
        void main() {
          float height = normalize(worldPosition - cameraPosition).y;
          float blend = smoothstep(-0.18, 0.65, height);
          gl_FragColor = vec4(mix(horizonColor, topColor, blend), 1.0);
          #include <colorspace_fragment>
        }
      `,
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false,
    })
    const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 24, 12), material)
    sky.renderOrder = -1000
    sky.frustumCulled = false
    return sky
  }

  private createStars() {
    const positions: number[] = []
    for (let i = 0; i < 180; i++) {
      const a = i * 2.399
      const y = 0.08 + ((i * 71) % 100) / 110
      const r = Math.sqrt(1 - y * y)
      positions.push(Math.cos(a) * r * 115, y * 115, Math.sin(a) * r * 115)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xf9f5db, size: 0.7, transparent: true, opacity: 0, fog: false, sizeAttenuation: false }))
  }

  private createRain() {
    const positions = new Float32Array(180 * 6)
    for (let i = 0; i < 180; i++) {
      const x = ((i * 73) % 200) / 10 - 10
      const y = ((i * 43) % 200) / 10
      const z = ((i * 97) % 200) / 10 - 10
      positions.set([x, y, z, x - 0.08, y - 0.65, z], i * 6)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
    return { lines: new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xd7eeec, transparent: true, opacity: 0.42, depthWrite: false })), positions }
  }

  private createHand() {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.43, 0.23), new THREE.MeshBasicMaterial({ color: 0xd5a27d }))
    arm.position.set(0.12, -0.16, 0)
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.23, 0.25), new THREE.MeshBasicMaterial({ color: 0x52776a }))
    sleeve.position.set(0.12, -0.29, 0)
    this.hand.add(arm, sleeve, this.handItem)
    this.hand.position.set(0.55, -0.54, -0.9)
    this.hand.rotation.set(-0.3, -0.45, 0.25)
    this.hand.scale.setScalar(0.74)
    this.camera.add(this.hand)
  }

  private updateHand() {
    while (this.handItem.children.length) {
      const child = this.handItem.children[0] as THREE.Mesh
      this.handItem.remove(child)
      child.geometry.dispose()
      ;(child.material as THREE.Material).dispose()
    }
    const slot = this.inventory[this.selected]
    if (!slot) return
    const item = ITEMS[slot.id]
    if (item.tool) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.45, 0.065), new THREE.MeshBasicMaterial({ color: 0x8f6542 }))
      handle.position.set(-0.02, 0.03, -0.07)
      const head = new THREE.Mesh(new THREE.BoxGeometry(item.tool === 'axe' ? 0.25 : 0.33, 0.11, 0.09), new THREE.MeshBasicMaterial({ color: item.color }))
      head.position.set(-0.03, 0.23, -0.07)
      this.handItem.add(handle, head)
    } else if (item.block) {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.29, 0.29), new THREE.MeshBasicMaterial({ color: item.top || item.color }))
      cube.position.set(-0.02, 0.12, -0.08)
      this.handItem.add(cube)
    }
  }

  private createSheep() {
    const candidates = [[3, -9], [-6, -12], [12, -18], [11, 7]]
    for (let i = 0; i < candidates.length; i++) {
      let [x, z] = candidates[i]
      if (this.world.heightAt(x, z) <= WATER_LEVEL) { x += 7; z += 7 }
      const y = this.world.heightAt(x, z) + 1
      const group = new THREE.Group()
      const wool = new THREE.MeshLambertMaterial({ color: 0xf1efdf })
      const face = new THREE.MeshLambertMaterial({ color: 0x8b8175 })
      const dark = new THREE.MeshLambertMaterial({ color: 0x393f39 })
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.72, 0.68), wool)
      body.position.y = 0.87
      body.castShadow = true
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.46, 0.42), face)
      head.position.set(0, 1.02, -0.49)
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.46), wool)
      cap.position.set(0, 1.28, -0.48)
      group.add(body, head, cap)
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.065, 0.03), dark)
        eye.position.set(side * 0.14, 1.07, -0.711)
        group.add(eye)
      }
      const legs: THREE.Mesh[] = []
      for (const lx of [-0.34, 0.34]) for (const lz of [-0.22, 0.22]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.47, 0.18), face)
        leg.position.set(lx, 0.25, lz)
        group.add(leg)
        legs.push(leg)
      }
      group.position.set(x + 0.5, y, z + 0.5)
      group.rotation.y = i * 1.7
      this.scene.add(group)
      this.sheep.push({ group, body, legs, heading: i * 1.7, turnIn: 2 + i, phase: i * 2, sheared: 0 })
    }
  }

  private updateSheep(dt: number) {
    this.sheep.forEach((sheep, i) => {
      sheep.turnIn -= dt
      if (sheep.turnIn <= 0) {
        sheep.heading += Math.sin(this.elapsed * 0.7 + i * 9) * 1.8
        sheep.turnIn = 3 + ((i * 7 + Math.floor(this.elapsed)) % 4)
      }
      const speed = 0.38
      const nx = sheep.group.position.x - Math.sin(sheep.heading) * speed * dt
      const nz = sheep.group.position.z - Math.cos(sheep.heading) * speed * dt
      const ground = this.world.heightAt(Math.floor(nx), Math.floor(nz)) + 1
      const canMove = ground > WATER_LEVEL + 1 && Math.abs(ground - sheep.group.position.y) <= 1.1 && !isSolid(this.world.getBlock(nx, ground, nz))
      if (canMove) {
        sheep.group.position.x = nx
        sheep.group.position.z = nz
        sheep.group.position.y = THREE.MathUtils.lerp(sheep.group.position.y, ground, Math.min(1, dt * 5))
      } else sheep.heading += dt * 2
      sheep.group.rotation.y = sheep.heading
      sheep.phase += dt * 5
      sheep.legs.forEach((leg, legIndex) => { leg.rotation.x = Math.sin(sheep.phase + (legIndex % 3 === 0 ? 0 : Math.PI)) * 0.28 })
      if (sheep.sheared > 0) {
        sheep.sheared -= dt
        if (sheep.sheared <= 0) (sheep.body.material as THREE.MeshLambertMaterial).color.set('#f1efdf')
      }
    })
  }

  private updateEnvironment() {
    const angle = this.time * Math.PI * 2
    const daylight = THREE.MathUtils.clamp(Math.sin(angle) * 1.25 + 0.22, 0.08, 1)
    this.weather = (this.seed + this.day * 17) % 3 !== 0 && this.time > 0.36 && this.time < 0.45 ? 'Rain' : 'Clear'
    const raining = this.weather === 'Rain'
    const sky = new THREE.Color('#25394d').lerp(new THREE.Color('#a8d9df'), daylight)
    const fog = new THREE.Color('#293e4a').lerp(new THREE.Color('#c6dfd2'), daylight)
    const skyTop = new THREE.Color('#182e47').lerp(new THREE.Color('#86c6d2'), daylight)
    const skyHorizon = new THREE.Color('#42535b').lerp(new THREE.Color('#d2e7d8'), daylight)
    if (raining) fog.lerp(new THREE.Color('#9eafb0'), 0.35)
    if (raining) { skyTop.lerp(new THREE.Color('#839ca6'), 0.55); skyHorizon.lerp(new THREE.Color('#a8bbb8'), 0.5) }
    ;(this.scene.background as THREE.Color).copy(sky)
    ;(this.scene.fog as THREE.Fog).color.copy(fog)
    ;(this.sky.material.uniforms.topColor.value as THREE.Color).copy(skyTop)
    ;(this.sky.material.uniforms.horizonColor.value as THREE.Color).copy(skyHorizon)
    this.sky.position.copy(this.player)
    this.hemisphere.intensity = (0.45 + daylight * 1.6) * (raining ? 0.8 : 1)
    this.sunlight.intensity = (0.12 + daylight * 1.98) * (raining ? 0.6 : 1)
    this.sunlight.position.set(this.player.x + 35, this.player.y + 55, this.player.z + 25)
    this.sunlight.target.position.copy(this.player)
    this.sun.position.set(this.player.x + Math.cos(angle) * 65, this.player.y + Math.sin(angle) * 65, this.player.z - 80)
    this.sun.lookAt(this.camera.position)
    this.sun.visible = Math.sin(angle) > -0.1 && !raining
    this.moon.position.set(this.player.x - Math.cos(angle) * 65, this.player.y - Math.sin(angle) * 65, this.player.z + 80)
    this.moon.lookAt(this.camera.position)
    this.moon.visible = Math.sin(angle) < 0.1
    ;(this.stars.material as THREE.PointsMaterial).opacity = (1 - daylight) * 0.85
    this.stars.position.copy(this.player)
    this.rain.visible = this.weather === 'Rain'
  }

  private updateRain(dt: number) {
    if (!this.rain.visible) return
    for (let i = 0; i < this.rainPositions.length; i += 6) {
      this.rainPositions[i + 1] -= dt * 13
      if (this.rainPositions[i + 1] < -2) this.rainPositions[i + 1] += 22
      this.rainPositions[i + 4] = this.rainPositions[i + 1] - 0.65
    }
    this.rain.position.copy(this.player)
    this.rain.geometry.attributes.position.needsUpdate = true
  }

  private collision(position: THREE.Vector3) {
    const minX = Math.floor(position.x - PLAYER_RADIUS)
    const maxX = Math.floor(position.x + PLAYER_RADIUS)
    const minY = Math.floor(position.y + 0.001)
    const maxY = Math.floor(position.y + PLAYER_HEIGHT - 0.001)
    const minZ = Math.floor(position.z - PLAYER_RADIUS)
    const maxZ = Math.floor(position.z + PLAYER_RADIUS)
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
      if (isSolid(this.world.getBlock(x, y, z))) return true
    }
    return false
  }

  private updatePlayer(dt: number) {
    const forward = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0)
    const strafe = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0)
    const length = Math.hypot(forward, strafe) || 1
    const water = this.world.getBlock(this.player.x, this.player.y + 0.6, this.player.z) === Block.Water
    const speed = water ? 2.7 : (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 6.3 : 4.25)
    const dx = (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe) / length * speed * dt
    const dz = (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe) / length * speed * dt
    const beforeX = this.player.x
    const beforeZ = this.player.z
    this.player.x += dx
    if (this.collision(this.player)) this.player.x -= dx
    this.player.z += dz
    if (this.collision(this.player)) this.player.z -= dz
    const moved = Math.hypot(this.player.x - beforeX, this.player.z - beforeZ)
    this.distanceWalked += moved
    if (!this.progress.walked && this.distanceWalked > 2) {
      this.progress.walked = true
      this.callbacks.onToast('First steps complete. There is plenty to discover!')
    }
    if (moved > 0 && this.grounded) {
      this.stepTimer -= dt
      if (this.stepTimer <= 0) { this.audio.play('step'); this.stepTimer = speed > 5 ? 0.27 : 0.38 }
    }

    if (water) {
      this.velocityY = Math.max(this.velocityY - 7 * dt, -3.2)
      if (this.keys.has('Space')) this.velocityY = 3.8
    } else this.velocityY = Math.max(this.velocityY - 22 * dt, -18)
    const previousVelocity = this.velocityY
    const dy = this.velocityY * dt
    this.player.y += dy
    this.grounded = false
    if (this.collision(this.player)) {
      if (dy < 0) {
        this.player.y = Math.floor(this.player.y + 0.001) + 1.001
        this.grounded = true
        if (previousVelocity < -11 && !water) {
          const damage = Math.max(1, Math.floor((-previousVelocity - 9) / 2.6))
          this.health -= damage
          this.audio.play('hurt')
          if (this.health <= 0) {
            this.player.copy(this.spawn)
            this.health = 10
            this.callbacks.onToast('You found your way home. Your belongings are safe.')
          } else this.callbacks.onToast('Watch your step!')
        }
      } else this.player.y = Math.floor(this.player.y + PLAYER_HEIGHT) - PLAYER_HEIGHT - 0.001
      this.velocityY = 0
    }
    if (this.player.y < -10) {
      this.player.copy(this.spawn)
      this.velocityY = 0
      this.health = 10
      this.callbacks.onToast('You found your way back home.')
    }
    this.updateCamera(dt, moved > 0 && this.grounded)
  }

  private updateCamera(_dt: number, walking: boolean) {
    const bob = walking ? Math.sin(this.elapsed * 10) * 0.025 : 0
    this.camera.position.set(this.player.x, this.player.y + 1.62 + bob, this.player.z)
    this.camera.rotation.set(this.pitch, this.yaw, 0)
    this.hand.position.y = -0.54 + (walking ? Math.abs(Math.sin(this.elapsed * 8)) * 0.025 : 0) - (this.mining ? Math.sin(this.elapsed * 18) * 0.07 : 0)
    this.hand.rotation.x = -0.3 + (this.mining ? Math.sin(this.elapsed * 18) * 0.35 : 0)
  }

  private castRay(): Target | null {
    const origin = this.camera.position
    const direction = new THREE.Vector3()
    this.camera.getWorldDirection(direction)
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z)
    const sx = direction.x >= 0 ? 1 : -1
    const sy = direction.y >= 0 ? 1 : -1
    const sz = direction.z >= 0 ? 1 : -1
    const deltaX = Math.abs(1 / direction.x), deltaY = Math.abs(1 / direction.y), deltaZ = Math.abs(1 / direction.z)
    let tx = direction.x === 0 ? Infinity : ((sx > 0 ? x + 1 - origin.x : origin.x - x) * deltaX)
    let ty = direction.y === 0 ? Infinity : ((sy > 0 ? y + 1 - origin.y : origin.y - y) * deltaY)
    let tz = direction.z === 0 ? Infinity : ((sz > 0 ? z + 1 - origin.z : origin.z - z) * deltaZ)
    let distance = 0
    const normal = new THREE.Vector3()
    for (let i = 0; i < 80 && distance <= 6; i++) {
      const block = this.world.getBlock(x, y, z)
      if (block !== Block.Air && block !== Block.Water && block !== Block.TallGrass) return { x, y, z, normal: normal.clone(), block, distance }
      if (tx < ty && tx < tz) { x += sx; distance = tx; tx += deltaX; normal.set(-sx, 0, 0) }
      else if (ty < tz) { y += sy; distance = ty; ty += deltaY; normal.set(0, -sy, 0) }
      else { z += sz; distance = tz; tz += deltaZ; normal.set(0, 0, -sz) }
    }
    return null
  }

  private miningDuration(block: Block) {
    const tool = this.inventory[this.selected] ? ITEMS[this.inventory[this.selected]!.id] : null
    if (block === Block.Flower || block === Block.TallGrass) return 0.12
    if (block === Block.Leaves) return 0.22
    if (block === Block.Log || block === Block.Planks || block === Block.CraftingTable) return tool?.tool === 'axe' ? 0.42 : 1.2
    if (block === Block.Stone || block === Block.Cobblestone || block === Block.CoalOre || block === Block.IronOre || block === Block.Furnace) return tool?.tool === 'pickaxe' ? (tool.tier === 3 ? 0.3 : tool.tier === 2 ? 0.46 : 0.7) : 2.0
    return 0.36
  }

  private updateTarget(dt: number) {
    this.target = this.castRay()
    this.targetOutline.visible = !!this.target && (this.locked || this.touch)
    if (this.target) this.targetOutline.position.set(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5)
    const currentKey = this.target ? `${this.target.x},${this.target.y},${this.target.z}` : ''
    if (currentKey !== this.miningKey) { this.miningProgress = 0; this.miningKey = currentKey }
    if (this.mining && this.target && (this.locked || this.touch) && !this.uiOpen) {
      this.miningProgress += dt / this.miningDuration(this.target.block)
      if (this.miningProgress >= 1) {
        this.breakBlock(this.target)
        this.miningProgress = 0
      }
    } else this.miningProgress = 0
  }

  private breakBlock(target: Target) {
    if (target.y <= 0) return
    const held = this.inventory[this.selected]
    if (target.block === Block.IronOre && (!held || ITEMS[held.id].tool !== 'pickaxe' || (ITEMS[held.id].tier || 0) < 2)) {
      this.mining = false
      this.callbacks.onToast('You need a stone pickaxe to collect iron ore.')
      return
    }
    const drop = BLOCK_DROPS[target.block]
    if (drop) {
      const next = cloneInventory(this.inventory)
      if (!addToInventory(next, drop, 1)) {
        this.mining = false
        this.callbacks.onToast('Your inventory is full.')
        return
      }
      this.inventory = next
    }
    if (this.world.setBlock(target.x, target.y, target.z, Block.Air)) {
      if (target.block === Block.Log) {
        this.progress.logs++
        if (this.progress.logs === 3) this.callbacks.onToast('Nice work! You gathered enough wood.')
      }
      this.spawnParticles(target.x + 0.5, target.y + 0.5, target.z + 0.5, drop ? ITEMS[drop].color : '#77a257')
      this.audio.play('break')
      this.updateHand()
      this.save()
      this.emit()
    }
  }

  placeBlock() {
    if (this.uiOpen || !(this.locked || this.touch)) return
    const target = this.castRay()
    if (!target) return
    if ((target.block === Block.CraftingTable || target.block === Block.Furnace) && !this.keys.has('ShiftLeft') && !this.keys.has('ShiftRight')) {
      this.callbacks.onInventory()
      return
    }
    const slot = this.inventory[this.selected]
    if (!slot) return
    const block = ITEMS[slot.id].block
    if (!block) { this.callbacks.onToast('Select a block in your hotbar to place it.'); return }
    const x = target.x + target.normal.x
    const y = target.y + target.normal.y
    const z = target.z + target.normal.z
    const existing = this.world.getBlock(x, y, z)
    if (existing !== Block.Air && existing !== Block.Water && !isPlant(existing)) return
    if (isSolid(block) && x < this.player.x + PLAYER_RADIUS && x + 1 > this.player.x - PLAYER_RADIUS && y < this.player.y + PLAYER_HEIGHT && y + 1 > this.player.y && z < this.player.z + PLAYER_RADIUS && z + 1 > this.player.z - PLAYER_RADIUS) return
    if (block === Block.Flower && !isSolid(this.world.getBlock(x, y - 1, z))) return
    if (this.world.setBlock(x, y, z, block)) {
      slot.count--
      if (slot.count <= 0) this.inventory[this.selected] = null
      if (!this.progress.placed) { this.progress.placed = true; this.callbacks.onToast('Your world is taking shape!') }
      if (block === Block.CraftingTable) this.progress.tablePlaced = true
      this.audio.play('place')
      this.spawnParticles(x + 0.5, y + 0.5, z + 0.5, ITEMS[slot.id].color, 4)
      this.updateHand()
      this.save()
      this.emit()
    }
  }

  private spawnParticles(x: number, y: number, z: number, color: string, count = 9) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshLambertMaterial({ color }))
      mesh.position.set(x + (Math.random() - 0.5) * 0.5, y + (Math.random() - 0.5) * 0.5, z + (Math.random() - 0.5) * 0.5)
      this.scene.add(mesh)
      this.particles.push({ mesh, velocity: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3 + 1, (Math.random() - 0.5) * 3), life: 0.4 + Math.random() * 0.35 })
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i]
      particle.life -= dt
      particle.velocity.y -= 10 * dt
      particle.mesh.position.addScaledVector(particle.velocity, dt)
      particle.mesh.rotation.x += dt * 5
      particle.mesh.rotation.z += dt * 3
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh)
        particle.mesh.geometry.dispose()
        ;(particle.mesh.material as THREE.Material).dispose()
        this.particles.splice(i, 1)
      }
    }
  }

  private tryShear() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera)
    const hits = this.raycaster.intersectObjects(this.sheep.map((animal) => animal.group), true)
    const hit = hits[0]
    if (!hit || hit.distance > 5.5 || (this.target && hit.distance > this.target.distance)) return false
    const animal = this.sheep.find((sheep) => sheep.group === hit.object.parent)
    if (!animal) return false
    const held = this.inventory[this.selected]
    if (!held || ITEMS[held.id].tool !== 'axe') {
      this.callbacks.onToast('Use your axe to gently gather wool from sheep.')
      return true
    }
    if (animal.sheared > 0) { this.callbacks.onToast('This sheep needs a little time to grow its wool back.'); return true }
    const next = cloneInventory(this.inventory)
    if (!addToInventory(next, 'wool', 1)) { this.callbacks.onToast('Your inventory is full.'); return true }
    this.inventory = next
    animal.sheared = 45
    ;(animal.body.material as THREE.MeshLambertMaterial).color.set('#b9b0a0')
    animal.heading += Math.PI
    this.audio.play('shear')
    this.callbacks.onToast('Collected soft wool. The sheep will grow it back!')
    this.save()
    this.emit()
    return true
  }

  private frame = (now: number) => {
    if (this.disposed) return
    const dt = Math.min((now - this.lastFrame) / 1000, 0.25)
    this.lastFrame = now
    this.elapsed += dt
    this.world.update(this.player.x, this.player.z)
    if (!this.uiOpen) {
      this.time += dt / 600
      if (this.time >= 1) { this.time -= 1; this.day++; this.health = Math.min(10, this.health + 2); this.callbacks.onToast(`A new day begins. Welcome to day ${this.day}!`) }
      if (this.locked || this.touch) {
        // Substeps keep collisions reliable even if a frame takes a long time.
        const steps = Math.ceil(dt / 0.035)
        for (let i = 0; i < steps; i++) this.updatePlayer(dt / steps)
      }
      else this.updateCamera(dt, false)
      this.updateTarget(dt)
      this.updateSheep(dt)
      this.updateParticles(dt)
      this.updateRain(dt)
    }
    this.clouds.position.set(this.player.x + Math.sin(this.elapsed * 0.008) * 3, 0, this.player.z)
    this.environmentTimer += dt
    if (this.environmentTimer > 0.35) { this.updateEnvironment(); this.environmentTimer = 0 }
    this.shadowTimer += dt
    if (this.shadowTimer > 1.5) { this.renderer.shadowMap.needsUpdate = true; this.shadowTimer = 0 }
    this.renderer.render(this.scene, this.camera)
    this.stateTimer += dt
    if (this.stateTimer > 0.18) { this.emit(); this.stateTimer = 0 }
    this.saveTimer += dt
    if (this.saveTimer > 10) { this.save(); this.saveTimer = 0 }
    this.frameId = requestAnimationFrame(this.frame)
  }

  private getTimeLabel() {
    if (this.time < 0.13) return 'Sunrise'
    if (this.time < 0.26) return 'Morning'
    if (this.time < 0.4) return 'Afternoon'
    if (this.time < 0.53) return 'Sunset'
    return 'Night'
  }

  private nearbyWorkstations(): Workstations {
    const result = { table: false, furnace: false }
    const px = Math.floor(this.player.x), py = Math.floor(this.player.y), pz = Math.floor(this.player.z)
    for (let x = px - 4; x <= px + 4; x++) for (let y = py - 2; y <= py + 3; y++) for (let z = pz - 4; z <= pz + 4; z++) {
      if ((x + 0.5 - this.player.x) ** 2 + (z + 0.5 - this.player.z) ** 2 > 20) continue
      const block = this.world.getBlock(x, y, z)
      if (block === Block.CraftingTable) result.table = true
      if (block === Block.Furnace) result.furnace = true
      if (result.table && result.furnace) return result
    }
    return result
  }

  private emit() {
    const drop = this.target ? BLOCK_DROPS[this.target.block] : undefined
    this.callbacks.onState({
      ready: true, started: this.started, locked: this.locked, touch: this.touch,
      inventory: cloneInventory(this.inventory), selected: this.selected,
      biome: this.world.biomeAt(this.player.x, this.player.z),
      position: [Math.floor(this.player.x), Math.floor(this.player.y), Math.floor(this.player.z)],
      day: this.day, timeOfDay: this.getTimeLabel(), weather: this.weather, health: this.health,
      progress: { ...this.progress }, workstations: this.nearbyWorkstations(), target: drop ? ITEMS[drop].name : null,
      mining: this.miningProgress, sound: this.audio.enabled, seed: this.seed, saveAvailable: this.saveAvailable,
    })
  }

  requestPlay() {
    this.audio.unlock()
    this.uiOpen = false
    if (window.matchMedia('(pointer: coarse)').matches) {
      this.touch = true
      this.started = true
      this.callbacks.onToast('Drag the world to look around. Hold the hammer to gather.')
      this.emit()
      return
    }
    const promise = this.renderer.domElement.requestPointerLock() as Promise<void> | void
    if (promise) void promise.catch(() => this.callbacks.onToast('Click the world to enable mouse look.'))
  }

  setUiOpen(open: boolean) {
    this.uiOpen = open
    this.keys.clear()
    this.mining = false
    if (open && document.pointerLockElement === this.renderer.domElement) document.exitPointerLock()
    this.emit()
  }

  setTouchKey(code: string, down: boolean) {
    if (down) this.keys.add(code)
    else this.keys.delete(code)
    if (code === 'Space' && down && this.grounded) { this.velocityY = 7.6; this.grounded = false }
  }

  touchLook(dx: number, dy: number) {
    if (!this.touch || this.uiOpen) return
    this.yaw -= dx * 0.004
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.004, -1.45, 1.45)
  }

  touchMine(down: boolean) {
    if (down && this.tryShear()) return
    this.mining = down
  }

  select(index: number) {
    this.selected = THREE.MathUtils.clamp(index, 0, 8)
    this.audio.play('select')
    this.updateHand()
    this.emit()
  }

  swapSlots(from: number, to: number) {
    if (from < 0 || from >= 27 || to < 0 || to >= 27 || from === to) return
    ;[this.inventory[from], this.inventory[to]] = [this.inventory[to], this.inventory[from]]
    this.updateHand()
    this.save()
    this.emit()
  }

  craft(recipeId: string) {
    const recipe = RECIPES.find((entry) => entry.id === recipeId)
    if (!recipe || !canCraft(this.inventory, recipe)) return false
    if (recipe.requires && !this.nearbyWorkstations()[recipe.requires]) {
      this.callbacks.onToast(`Place a ${recipe.requires === 'table' ? 'crafting table' : 'furnace'} nearby to make this.`)
      return false
    }
    const next = cloneInventory(this.inventory)
    recipe.ingredients.forEach((ingredient) => removeFromInventory(next, ingredient.id, ingredient.count))
    if (!addToInventory(next, recipe.output.id, recipe.output.count)) { this.callbacks.onToast('Make a little room in your inventory first.'); return false }
    this.inventory = next
    if (recipe.output.id === 'stone_pickaxe') this.progress.stoneCrafted = true
    if (recipe.output.id === 'iron_ingot') this.progress.ironSmelted = true
    if (!this.progress.crafted) { this.progress.crafted = true; this.callbacks.onToast('Your first creation! Keep making it yours.') }
    else this.callbacks.onToast(`Crafted ${recipe.output.count} ${ITEMS[recipe.output.id].name}.`)
    this.audio.play('craft')
    this.updateHand()
    this.save()
    this.emit()
    return true
  }

  toggleSound() {
    this.audio.enabled = !this.audio.enabled
    if (this.audio.enabled) this.audio.unlock()
    this.save()
    this.emit()
  }

  save = () => {
    if (this.resetting) return false
    try {
      const data: SaveData = {
        version: 1, seed: this.seed, edits: Object.fromEntries(this.world.edits),
        inventory: cloneInventory(this.inventory), position: [this.player.x, this.player.y, this.player.z],
        yaw: this.yaw, pitch: this.pitch, time: this.time, day: this.day, health: this.health,
        progress: { ...this.progress }, sound: this.audio.enabled,
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(data))
      this.saveAvailable = true
      return true
    } catch {
      if (this.saveAvailable) this.callbacks.onToast('Saving is unavailable in this browser. Your changes may be lost.')
      this.saveAvailable = false
      return false
    }
  }

  saveWithNotice() {
    this.callbacks.onToast(this.save() ? 'World saved on this device.' : 'Unable to save on this device.')
    this.emit()
  }

  newWorld() {
    this.resetting = true
    try {
      localStorage.removeItem(SAVE_KEY)
      localStorage.setItem(NEXT_SEED_KEY, String(Math.floor(Math.random() * 900000) + 10000))
    } catch { /* Reloading still creates a fresh in-memory world. */ }
    window.removeEventListener('beforeunload', this.save)
    window.location.reload()
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'KeyE' && !event.repeat) { event.preventDefault(); this.callbacks.onInventory(); return }
    if (event.code === 'Escape' && !event.repeat) {
      if (this.uiOpen) this.callbacks.onCloseOverlay()
      else if (this.started) {
        if (this.locked) document.exitPointerLock()
        this.callbacks.onPause()
      }
      return
    }
    if (this.uiOpen || !(this.locked || this.touch)) return
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault()
    if (event.code.startsWith('Digit')) {
      const index = Number(event.code.slice(5)) - 1
      if (index >= 0 && index < 9) this.select(index)
    }
    this.keys.add(event.code)
    if (event.code === 'Space' && !event.repeat && this.grounded) { this.velocityY = 7.6; this.grounded = false }
  }

  private onKeyUp = (event: KeyboardEvent) => { this.keys.delete(event.code) }
  private onBlur = () => { this.keys.clear(); this.mining = false; this.save() }
  private onPointerLockChange = () => {
    this.locked = document.pointerLockElement === this.renderer.domElement
    if (this.locked) { this.started = true; this.audio.unlock() }
    else { this.keys.clear(); this.mining = false }
    this.emit()
  }
  private onMouseMove = (event: MouseEvent) => {
    if (!this.locked || this.uiOpen) return
    this.yaw -= event.movementX * 0.0022
    this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.0022, -1.45, 1.45)
  }
  private onMouseDown = (event: MouseEvent) => {
    if (!this.locked || this.uiOpen) return
    if (event.button === 0) { if (!this.tryShear()) this.mining = true }
    if (event.button === 2) this.placeBlock()
  }
  private onMouseUp = (event: MouseEvent) => { if (event.button === 0) this.mining = false }
  private onWheel = (event: WheelEvent) => {
    if (!this.locked || this.uiOpen) return
    event.preventDefault()
    this.select((this.selected + (event.deltaY > 0 ? 1 : 8)) % 9)
  }
  private preventContextMenu = (event: Event) => event.preventDefault()

  dispose() {
    this.save()
    this.disposed = true
    cancelAnimationFrame(this.frameId)
    window.removeEventListener('resize', this.resize)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    window.removeEventListener('beforeunload', this.save)
    document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    document.removeEventListener('mousemove', this.onMouseMove)
    document.removeEventListener('mousedown', this.onMouseDown)
    document.removeEventListener('mouseup', this.onMouseUp)
    document.removeEventListener('wheel', this.onWheel)
    this.renderer.domElement.removeEventListener('contextmenu', this.preventContextMenu)
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock()
    this.world.dispose()
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      if (mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        materials.forEach((material) => material.dispose())
      }
    })
    this.audio.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

export function recipeAvailable(inventory: (Slot | null)[], id: string, workstations: Workstations) {
  const recipe = RECIPES.find((entry) => entry.id === id)
  return !!recipe && canCraft(inventory, recipe) && (!recipe.requires || workstations[recipe.requires])
}

export { countItem }