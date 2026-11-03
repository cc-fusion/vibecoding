import * as THREE from 'three';

const DAY_LENGTH = 600;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export class Environment {
  constructor(scene, camera, world, audio, saved = {}) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.audio = audio;
    this.time = Number.isFinite(saved.time) ? saved.time : 0.34;
    this.day = Math.max(1, saved.day | 0 || 1);
    this.weather = saved.weather || 'clear';
    this.weatherTimer = 80 + Math.random() * 100;
    this.rain = 0;
    this.flash = 0;
    this.lightningTimer = 8;
    this.elapsed = 0;
    this.lightTimer = 0;
    this.onLightning = null;
    this.sunDirection = new THREE.Vector3();

    this.skyUniforms = {
      topColor: { value: new THREE.Color('#5d9fc4') },
      bottomColor: { value: new THREE.Color('#d7e4ce') },
      sunDirection: { value: this.sunDirection },
      daylight: { value: 1 },
      flash: { value: 0 },
    };
    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vDirection;
        void main() {
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 sunDirection;
        uniform float daylight;
        uniform float flash;
        varying vec3 vDirection;
        void main() {
          vec3 dir = normalize(vDirection);
          float horizon = smoothstep(-0.22, 0.75, dir.y);
          vec3 color = mix(bottomColor, topColor, horizon);
          float sunDot = max(dot(dir, normalize(sunDirection)), 0.0);
          float sun = smoothstep(0.9991, 0.99965, sunDot);
          float halo = pow(sunDot, 24.0) * 0.28 * daylight;
          color += vec3(1.0, 0.73, 0.36) * halo;
          color = mix(color, vec3(1.0, 0.91, 0.65), sun * daylight);
          float moonDot = max(dot(dir, normalize(-sunDirection)), 0.0);
          float moon = smoothstep(0.99935, 0.9997, moonDot) * (1.0 - daylight);
          color = mix(color, vec3(0.77, 0.86, 0.91), moon * 0.85);
          color += vec3(0.65, 0.76, 1.0) * flash * 0.65;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      toneMapped: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(450, 24, 16), skyMaterial);
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    const starPositions = [];
    for (let i = 0; i < 900; i++) {
      const direction = new THREE.Vector3().randomDirection();
      if (direction.y < -0.15) direction.y = -direction.y;
      direction.multiplyScalar(420);
      starPositions.push(direction.x, direction.y, direction.z);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    this.starMaterial = new THREE.PointsMaterial({ color: '#dce9ef', size: 0.8, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.stars = new THREE.Points(starGeometry, this.starMaterial);
    scene.add(this.stars);

    this.hemisphere = new THREE.HemisphereLight('#b9d8e4', '#4c4537', 1);
    scene.add(this.hemisphere);
    this.sun = new THREE.DirectionalLight('#fff0d0', 1.4);
    this.sun.target = new THREE.Object3D();
    scene.add(this.sun, this.sun.target);
    scene.fog = new THREE.FogExp2('#b7d1d2', 0.014);

    this.cloudMaterial = new THREE.MeshLambertMaterial({ color: '#f0f2e9', transparent: true, opacity: 0.58, depthWrite: false });
    const cloudGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.clouds = new THREE.InstancedMesh(cloudGeometry, this.cloudMaterial, 96);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3(); const scale = new THREE.Vector3();
    for (let i = 0; i < 96; i++) {
      const cluster = Math.floor(i / 4);
      const baseX = (cluster % 6) * 48 - 130;
      const baseZ = Math.floor(cluster / 6) * 70 - 130;
      position.set(baseX + (Math.random() - 0.5) * 16, 67 + Math.random() * 8, baseZ + (Math.random() - 0.5) * 15);
      scale.set(12 + Math.random() * 16, 2 + Math.random() * 3, 8 + Math.random() * 14);
      matrix.compose(position, new THREE.Quaternion(), scale);
      this.clouds.setMatrixAt(i, matrix);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    scene.add(this.clouds);

    this.rainCount = 650;
    this.rainDrops = Array.from({ length: this.rainCount }, () => ({ x: 0, y: -100, z: 0 }));
    this.rainPositions = new Float32Array(this.rainCount * 6);
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.rainMaterial = new THREE.LineBasicMaterial({ color: '#b8d6df', transparent: true, opacity: 0.42, depthWrite: false });
    this.rainLines = new THREE.LineSegments(rainGeometry, this.rainMaterial);
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;
    scene.add(this.rainLines);

    this.torchLights = Array.from({ length: 6 }, () => {
      const light = new THREE.PointLight('#ffbd68', 0, 13, 2);
      scene.add(light);
      return light;
    });
  }

  get daylight() {
    return smoothstep(-0.14, 0.18, this.sunDirection.y);
  }

  get isNight() {
    return this.sunDirection.y < -0.08;
  }

  update(dt, player) {
    this.elapsed += dt;
    this.time += dt / DAY_LENGTH;
    if (this.time >= 1) { this.time -= 1; this.day++; }
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      const roll = Math.random();
      this.weather = roll < 0.52 ? 'clear' : roll < 0.84 ? 'rain' : 'storm';
      this.weatherTimer = this.weather === 'clear' ? 130 + Math.random() * 160 : 65 + Math.random() * 90;
    }
    const targetRain = this.weather === 'clear' ? 0 : this.weather === 'rain' ? 0.65 : 1;
    this.rain += (targetRain - this.rain) * Math.min(1, dt * 0.35);
    const angle = this.time * Math.PI * 2 - Math.PI / 2;
    this.sunDirection.set(Math.cos(angle) * 0.72, Math.sin(angle), Math.cos(angle) * 0.38).normalize();
    const daylight = this.daylight;
    const sunset = (1 - smoothstep(0.05, 0.5, Math.abs(this.sunDirection.y))) * smoothstep(-0.3, 0.15, this.sunDirection.y);
    const nightTop = new THREE.Color('#07101f'); const nightBottom = new THREE.Color('#1a2a3c');
    const dayTop = new THREE.Color('#5798c0'); const dayBottom = new THREE.Color('#d4e3d2');
    const top = nightTop.lerp(dayTop, daylight);
    const bottom = nightBottom.lerp(dayBottom, daylight);
    bottom.lerp(new THREE.Color('#e79b70'), sunset * 0.72);
    top.lerp(new THREE.Color('#675d88'), sunset * 0.32);
    if (this.rain > 0.05) {
      top.lerp(new THREE.Color('#465a68'), this.rain * 0.55);
      bottom.lerp(new THREE.Color('#71828a'), this.rain * 0.5);
    }
    this.skyUniforms.topColor.value.copy(top);
    this.skyUniforms.bottomColor.value.copy(bottom);
    this.skyUniforms.daylight.value = daylight;
    this.flash = Math.max(0, this.flash - dt * 2.8);
    this.skyUniforms.flash.value = this.flash;
    this.starMaterial.opacity = Math.pow(1 - daylight, 1.8) * (1 - this.rain * 0.7);
    this.stars.visible = this.starMaterial.opacity > 0.01;

    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    this.clouds.position.set(this.camera.position.x + ((this.elapsed * 0.45) % 48), 0, this.camera.position.z);
    this.cloudMaterial.color.set('#aab5c0').lerp(new THREE.Color('#f0f2e9'), daylight);
    this.cloudMaterial.opacity = 0.42 + this.rain * 0.25;
    this.sun.position.copy(this.camera.position).addScaledVector(this.sunDirection.y > -0.12 ? this.sunDirection : this.sunDirection.clone().negate(), 100);
    this.sun.target.position.copy(this.camera.position);
    this.sun.color.set('#a8c5ef').lerp(new THREE.Color('#fff0d0'), daylight);
    this.sun.intensity = 0.16 + daylight * 1.25 + this.flash * 1.5;
    this.hemisphere.intensity = 0.2 + daylight * 0.85 + this.flash * 0.8;
    this.hemisphere.color.set('#7287a8').lerp(new THREE.Color('#bad9e4'), daylight);

    const fogColor = bottom.clone().lerp(top, 0.35);
    let fogDensity = 0.013 + this.rain * 0.009;
    if (player?.underwater) {
      fogColor.set('#246c78');
      fogDensity = 0.065;
    }
    this.scene.fog.color.copy(fogColor);
    this.scene.fog.density = fogDensity;

    this.updateRain(dt);
    if (this.weather === 'storm' && this.rain > 0.7) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 6 + Math.random() * 13;
        this.flash = 1;
        this.audio.play('thunder');
        this.onLightning?.();
      }
    } else this.lightningTimer = Math.min(this.lightningTimer, 8);

    this.lightTimer -= dt;
    if (this.lightTimer <= 0) {
      this.lightTimer = 0.45;
      const lights = this.world.nearbyLights(this.camera.position, 15);
      this.torchLights.forEach((light, index) => {
        const source = lights[index];
        if (source) {
          light.position.set(source.x, source.y, source.z);
          light.intensity = source.strength * (1.4 + (1 - daylight) * 1.3);
          light.visible = true;
        } else {
          light.intensity = 0;
          light.visible = false;
        }
      });
    }
  }

  updateRain(dt) {
    this.rainLines.visible = this.rain > 0.04;
    if (!this.rainLines.visible) return;
    this.rainMaterial.opacity = 0.22 + this.rain * 0.3;
    for (let i = 0; i < this.rainCount; i++) {
      const drop = this.rainDrops[i];
      if (drop.y < -50) {
        drop.x = this.camera.position.x + (Math.random() - 0.5) * 46;
        drop.y = this.camera.position.y + Math.random() * 24;
        drop.z = this.camera.position.z + (Math.random() - 0.5) * 46;
      }
      drop.y -= dt * 24;
      drop.x += dt * 2.5;
      const dx = drop.x - this.camera.position.x; const dz = drop.z - this.camera.position.z;
      if (drop.y < this.camera.position.y - 8 || Math.abs(dx) > 25 || Math.abs(dz) > 25 || this.world.isSolid(drop.x, drop.y, drop.z)) {
        drop.x = this.camera.position.x + (Math.random() - 0.5) * 46;
        drop.y = this.camera.position.y + 14 + Math.random() * 10;
        drop.z = this.camera.position.z + (Math.random() - 0.5) * 46;
      }
      const offset = i * 6;
      this.rainPositions[offset] = drop.x; this.rainPositions[offset + 1] = drop.y; this.rainPositions[offset + 2] = drop.z;
      this.rainPositions[offset + 3] = drop.x - 0.05; this.rainPositions[offset + 4] = drop.y + 0.65; this.rainPositions[offset + 5] = drop.z;
    }
    this.rainLines.geometry.attributes.position.needsUpdate = true;
  }

  timeLabel() {
    const totalMinutes = Math.floor(this.time * 24 * 60);
    const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const minutes = (totalMinutes % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  serialize() {
    return { time: this.time, day: this.day, weather: this.weather };
  }

  dispose() {
    for (const object of [this.sky, this.stars, this.clouds, this.rainLines, this.sun, this.sun.target, this.hemisphere, ...this.torchLights]) this.scene.remove(object);
    this.sky.geometry.dispose(); this.sky.material.dispose();
    this.stars.geometry.dispose(); this.starMaterial.dispose();
    this.clouds.geometry.dispose(); this.cloudMaterial.dispose();
    this.rainLines.geometry.dispose(); this.rainMaterial.dispose();
  }
}
