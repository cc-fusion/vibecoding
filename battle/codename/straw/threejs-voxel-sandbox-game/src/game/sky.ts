// Day/night cycle, sky dome, sun/moon/stars, clouds and weather.
import * as THREE from 'three';
import { makeCanvas, canvasTexture, getCloudTexture } from './textures';
import { terrainUniforms } from './mesher';
import { clamp, lerpN, smoothstep } from './noise';

export const DAY_LENGTH = 720; // seconds per full cycle

const C = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const ZEN_DAY = C(0.32, 0.53, 0.94), HOR_DAY = C(0.72, 0.84, 0.97);
const ZEN_NIGHT = C(0.008, 0.015, 0.05), HOR_NIGHT = C(0.04, 0.06, 0.12);
const SUNSET = C(0.99, 0.52, 0.26);

export class Sky {
  group = new THREE.Group();
  time = 0.04; // 0=dawn, .25=noon, .5=dusk, .75=midnight
  dayCount = 1;
  dayFactor = 1;
  weather: 'clear' | 'rain' = 'clear';
  rainAmount = 0;
  onThunder: (() => void) | null = null;

  private domeMat: THREE.ShaderMaterial;
  private celestial = new THREE.Group();
  private stars: THREE.Points;
  private starMat: THREE.PointsMaterial;
  private sunMesh: THREE.Mesh;
  private moonMesh: THREE.Mesh;
  private clouds: THREE.Mesh;
  private cloudMat: THREE.MeshBasicMaterial;
  sunLight: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  private weatherTimer = 300 + Math.random() * 240;
  private thunderTimer = 20;
  private flash = 0;
  readonly sunDir = new THREE.Vector3(0, 1, 0);
  fogColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.domeMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color() },
        horizonColor: { value: new THREE.Color() },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunColor: { value: new THREE.Color(1, 0.9, 0.7) },
        uFlash: { value: 0 },
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 sunDir; uniform vec3 sunColor; uniform float uFlash;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -0.12, 1.0);
          vec3 col = mix(horizonColor, topColor, pow(max(h, 0.0), 0.55));
          float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          col += sunColor * (pow(s, 900.0) * 2.4 + pow(s, 18.0) * 0.28);
          col += vec3(0.7, 0.75, 0.9) * uFlash;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16), this.domeMat);
    dome.renderOrder = -10; dome.frustumCulled = false;
    this.group.add(dome);

    // stars
    const starGeo = new THREE.BufferGeometry();
    const sp: number[] = [];
    for (let i = 0; i < 800; i++) {
      const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      if (v.lengthSq() > 1 || v.lengthSq() < 0.1) continue;
      v.normalize().multiplyScalar(405);
      sp.push(v.x, v.y, v.z);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.frustumCulled = false;
    this.celestial.add(this.stars);

    // sun disc sprite texture
    const [sc, sctx] = makeCanvas(64, 64);
    const grad = sctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,250,220,1)');
    grad.addColorStop(0.35, 'rgba(255,236,170,0.95)');
    grad.addColorStop(1, 'rgba(255,220,130,0)');
    sctx.fillStyle = grad; sctx.fillRect(0, 0, 64, 64);
    const sunTex = canvasTexture(sc);
    this.sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(90, 90),
      new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sunMesh.position.set(395, 0, 40);
    this.celestial.add(this.sunMesh);

    const [mc, mctx] = makeCanvas(32, 32);
    mctx.fillStyle = '#e8ecf2'; mctx.beginPath(); mctx.arc(16, 16, 11, 0, Math.PI * 2); mctx.fill();
    mctx.fillStyle = '#c9d1dd';
    for (const [x, y, r] of [[12, 12, 3], [20, 18, 2.4], [15, 21, 1.8], [21, 10, 1.6]] as const) { mctx.beginPath(); mctx.arc(x, y, r, 0, Math.PI * 2); mctx.fill(); }
    const moonTex = canvasTexture(mc);
    this.moonMesh = new THREE.Mesh(new THREE.PlaneGeometry(46, 46),
      new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false }));
    this.moonMesh.position.set(-395, 0, -40);
    this.celestial.add(this.moonMesh);
    this.group.add(this.celestial);

    // clouds
    const cloudTex = getCloudTexture();
    cloudTex.repeat.set(7, 7);
    this.cloudMat = new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), this.cloudMat);
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.renderOrder = -5;
    this.clouds.frustumCulled = false;
    scene.add(this.clouds);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x554a38, 0.7);
    scene.add(this.sunLight); scene.add(this.sunLight.target); scene.add(this.hemi);
    scene.add(this.group);
  }

  get isNight() { return this.dayFactor < 0.22; }
  get raining() { return this.rainAmount > 0.25; }

  timeLabel(): string {
    const mins = Math.floor(((6 + this.time * 24) % 24) * 60);
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  update(dt: number, focus: THREE.Vector3, advanceTime = true) {
    if (advanceTime) {
      const prev = this.time;
      this.time = (this.time + dt / DAY_LENGTH) % 1;
      if (this.time < prev) this.dayCount++;
    }
    // weather state machine
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      if (this.weather === 'clear') { this.weather = 'rain'; this.weatherTimer = 90 + Math.random() * 150; }
      else { this.weather = 'clear'; this.weatherTimer = 280 + Math.random() * 380; }
    }
    this.rainAmount = clamp(this.rainAmount + dt * (this.weather === 'rain' ? 0.25 : -0.25), 0, 1);
    if (this.raining) {
      this.thunderTimer -= dt;
      if (this.thunderTimer <= 0) {
        this.thunderTimer = 9 + Math.random() * 26;
        this.flash = 0.5 + Math.random() * 0.5;
        this.onThunder?.();
      }
    }
    this.flash = Math.max(0, this.flash - dt * 2.4);

    const ang = this.time * Math.PI * 2;
    const elev = Math.sin(ang);
    this.sunDir.set(Math.cos(ang), elev, 0.18).normalize();
    let day = smoothstep(-0.09, 0.28, elev);
    day *= 1 - this.rainAmount * 0.28;
    this.dayFactor = day;
    terrainUniforms.uDay.value = day;
    terrainUniforms.uTime.value += dt;

    const sunsetAmt = clamp(1 - Math.abs(elev) * 3.2, 0, 1) * smoothstep(-0.25, 0.05, elev);
    const zen = ZEN_NIGHT.clone().lerp(ZEN_DAY, day);
    const hor = HOR_NIGHT.clone().lerp(HOR_DAY, day).lerp(SUNSET, sunsetAmt * 0.65);
    const dim = 1 - this.rainAmount * 0.4;
    zen.multiplyScalar(dim); hor.multiplyScalar(dim);
    this.domeMat.uniforms.topColor.value.copy(zen);
    this.domeMat.uniforms.horizonColor.value.copy(hor);
    this.domeMat.uniforms.sunDir.value.copy(this.sunDir);
    (this.domeMat.uniforms.sunColor.value as THREE.Color).setRGB(1, 0.85 - sunsetAmt * 0.3, 0.62 - sunsetAmt * 0.35).multiplyScalar(day * (1 - this.rainAmount * 0.85));
    this.domeMat.uniforms.uFlash.value = this.flash * 0.5;
    this.fogColor.copy(hor);

    this.group.position.copy(focus);
    this.celestial.rotation.z = ang;
    // billboard sun/moon toward camera focus (group-local origin)
    this.sunMesh.lookAt(this.group.position);
    this.moonMesh.lookAt(this.group.position);
    this.starMat.opacity = clamp(1 - day * 2.4, 0, 0.9) * (1 - this.rainAmount);
    (this.sunMesh.material as THREE.MeshBasicMaterial).opacity = clamp(elev * 4 + 0.6, 0, 1) * (1 - this.rainAmount * 0.9);
    (this.moonMesh.material as THREE.MeshBasicMaterial).opacity = clamp(-elev * 4 + 0.6, 0, 1) * (1 - this.rainAmount * 0.7);

    // clouds follow + drift (offset anchored to world so they don't swim)
    const ct = getCloudTexture();
    const tileWorld = 760 / 7;
    ct.offset.set(((focus.x + performance.now() * 0.0016) / tileWorld) % 1, ((focus.z) / tileWorld) % 1);
    this.clouds.position.set(focus.x, 96, focus.z);
    const cloudShade = 0.25 + day * 0.75;
    this.cloudMat.color.setRGB(cloudShade, cloudShade, cloudShade * 1.02);
    this.cloudMat.opacity = lerpN(0.42, 0.78, this.rainAmount);

    // entity lighting
    this.sunLight.position.copy(focus).addScaledVector(this.sunDir, 70);
    this.sunLight.target.position.copy(focus);
    const sunI = clamp(elev, 0, 1) * 1.25 * (1 - this.rainAmount * 0.5);
    const moonI = clamp(-elev, 0, 1) * 0.16;
    if (sunI >= moonI) { this.sunLight.intensity = sunI; this.sunLight.color.setRGB(1, 0.95 - sunsetAmt * 0.2, 0.88 - sunsetAmt * 0.3); }
    else { this.sunLight.intensity = moonI; this.sunLight.color.setRGB(0.65, 0.75, 1); this.sunLight.position.copy(focus).addScaledVector(this.sunDir, -70); }
    this.hemi.intensity = 0.14 + day * 0.55;
    this.hemi.color.copy(hor).lerp(new THREE.Color(1, 1, 1), 0.35);
  }

  setCloudsVisible(v: boolean) { this.clouds.visible = v; }
}
