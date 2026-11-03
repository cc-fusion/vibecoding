import * as THREE from 'three';
import { hash2 } from './noise';

export type Weather = 'Clear' | 'Rain';

export class Environment {
  private sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private sun: THREE.Sprite;
  private glow: THREE.Sprite;
  private clouds: THREE.InstancedMesh;
  private stars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private rain: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private hemisphere = new THREE.HemisphereLight(0xf7f4d8, 0x6e825f, 2.0);
  private sunlight = new THREE.DirectionalLight(0xfff4d9, 2.1);
  private wind = 0;
  private elapsed = 0;
  private glowTexture: THREE.CanvasTexture;

  constructor(private scene: THREE.Scene) {
    this.scene.fog = new THREE.Fog(0xd7e8de, 38, 115);
    this.scene.add(this.hemisphere, this.sunlight);
    this.sunlight.position.set(45, 80, 35);

    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x80bfda) },
        horizonColor: { value: new THREE.Color(0xe0eee5) },
      },
      vertexShader: `varying vec3 vDirection;
        void main() {
          vDirection = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `uniform vec3 topColor;
        uniform vec3 horizonColor;
        varying vec3 vDirection;
        void main() {
          float h = max(normalize(vDirection).y, 0.0);
          float blend = pow(h, 0.65);
          gl_FragColor = vec4(mix(horizonColor, topColor, blend), 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(230, 32, 20), skyMaterial);
    this.sky.renderOrder = -100;
    this.scene.add(this.sky);

    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 128;
    const ctx = glowCanvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 248, 205, 0.8)');
    gradient.addColorStop(0.25, 'rgba(255, 241, 189, 0.32)');
    gradient.addColorStop(1, 'rgba(255, 241, 189, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    this.glowTexture = new THREE.CanvasTexture(glowCanvas);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture, transparent: true, depthWrite: false, fog: false }));
    this.glow.scale.set(34, 34, 1);
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfff3bf, fog: false, depthWrite: false }));
    this.sun.scale.set(7.5, 7.5, 1);
    this.scene.add(this.glow, this.sun);

    const cloudGeometry = new THREE.BoxGeometry(1, 1, 1);
    const cloudMaterial = new THREE.MeshLambertMaterial({ color: 0xf8faf0, transparent: true, opacity: 0.88 });
    this.clouds = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, 96);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 24; i++) {
      const x = hash2(i, 9, 55) * 210 - 105;
      const z = hash2(i, 17, 89) * 190 - 125;
      const y = 40 + hash2(i, 22, 36) * 12;
      const width = 5 + hash2(i, 41, 51) * 6;
      for (let j = 0; j < 4; j++) {
        dummy.position.set(x + (j - 1.5) * width * 0.48, y + (j % 2) * 0.35, z + (j % 2) * 1.8);
        dummy.scale.set(width, 1.1 + (j % 2) * 0.4, 4 + (j % 3));
        dummy.updateMatrix();
        this.clouds.setMatrixAt(i * 4 + j, dummy.matrix);
      }
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    this.scene.add(this.clouds);

    const starPositions: number[] = [];
    for (let i = 0; i < 220; i++) {
      const theta = hash2(i, 3, 716) * Math.PI * 2;
      const y = 0.13 + hash2(i, 4, 934) * 0.86;
      const radius = Math.sqrt(1 - y * y);
      starPositions.push(Math.cos(theta) * radius * 180, y * 180, Math.sin(theta) * radius * 180);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    this.stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xf6f3db, size: 1.2, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.scene.add(this.stars);

    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(360 * 6), 3));
    this.rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: 0xd4e8e4, transparent: true, opacity: 0.48, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  update(minutes: number, weather: Weather, position: THREE.Vector3, dt: number) {
    this.elapsed += dt;
    this.wind += dt * 0.15;
    const clock = (minutes % 1440) / 1440;
    const angle = clock * Math.PI * 2 - Math.PI / 2;
    const daylight = THREE.MathUtils.clamp(Math.sin(angle) * 1.45 + 0.22, 0.08, 1);
    const rainy = weather === 'Rain';
    const dayTop = new THREE.Color(rainy ? 0x92aeb6 : 0x7cbdd5);
    const dayHorizon = new THREE.Color(rainy ? 0xc1d0ca : 0xe0eee3);
    const top = new THREE.Color(0x172d49).lerp(dayTop, daylight);
    const horizon = new THREE.Color(0x526a77).lerp(dayHorizon, daylight);
    this.sky.material.uniforms.topColor.value.copy(top);
    this.sky.material.uniforms.horizonColor.value.copy(horizon);
    (this.scene.fog as THREE.Fog).color.copy(horizon);
    (this.scene.fog as THREE.Fog).near = rainy ? 27 : 38;
    (this.scene.fog as THREE.Fog).far = rainy ? 86 : 115;
    this.hemisphere.intensity = 0.45 + daylight * (rainy ? 1.15 : 1.6);
    this.sunlight.intensity = 0.15 + daylight * (rainy ? 0.8 : 1.9);
    this.sunlight.position.set(Math.cos(angle) * 70, Math.max(10, Math.sin(angle) * 100), -50);
    this.sky.position.copy(position);
    this.stars.position.copy(position);
    this.stars.material.opacity = (1 - daylight) * 0.85;
    this.clouds.position.set(Math.floor(position.x / 120) * 120 + this.wind % 120, 0, Math.floor(position.z / 120) * 120);
    (this.clouds.material as THREE.MeshLambertMaterial).opacity = 0.3 + daylight * 0.58;
    const sunX = position.x + Math.cos(angle) * 83;
    const sunY = position.y + Math.sin(angle) * 100;
    const sunZ = position.z - 125;
    this.sun.position.set(sunX, sunY, sunZ);
    this.glow.position.copy(this.sun.position);
    (this.sun.material as THREE.SpriteMaterial).opacity = daylight;
    (this.glow.material as THREE.SpriteMaterial).opacity = daylight * (rainy ? 0.15 : 0.9);

    this.rain.visible = rainy;
    if (rainy) {
      const array = this.rain.geometry.getAttribute('position').array as Float32Array;
      for (let i = 0; i < 360; i++) {
        const x = position.x + hash2(i, 11, 92) * 38 - 19;
        const z = position.z + hash2(i, 27, 112) * 38 - 19;
        const y = position.y - 6 + ((hash2(i, 33, 184) * 25 - this.elapsed * 13 + 1000) % 25);
        array.set([x, y, z, x - 0.13, y - 0.8, z], i * 6);
      }
      this.rain.geometry.getAttribute('position').needsUpdate = true;
    }
  }

  dispose() {
    this.scene.remove(this.sky, this.sun, this.glow, this.clouds, this.stars, this.rain, this.hemisphere, this.sunlight);
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    (this.sun.material as THREE.Material).dispose();
    (this.glow.material as THREE.Material).dispose();
    this.glowTexture.dispose();
    this.clouds.geometry.dispose();
    (this.clouds.material as THREE.Material).dispose();
    this.stars.geometry.dispose();
    this.stars.material.dispose();
    this.rain.geometry.dispose();
    this.rain.material.dispose();
  }
}