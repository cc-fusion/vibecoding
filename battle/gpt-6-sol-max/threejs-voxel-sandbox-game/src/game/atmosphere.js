import * as THREE from "three";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export class Atmosphere {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.elapsed = 0;
    this.lightTimer = 0;
    scene.fog = new THREE.FogExp2(0xadc5ba, 0.028);

    this.skyUniforms = {
      topColor: { value: new THREE.Color("#78aec0") },
      horizonColor: { value: new THREE.Color("#d8ddc5") },
      bottomColor: { value: new THREE.Color("#b6cdbf") },
      sunColor: { value: new THREE.Color("#ffe6b8") },
      sunDirection: { value: new THREE.Vector3(0.55, 0.5, -0.65) },
      sunStrength: { value: 1 },
    };
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vDirection;
        void main() {
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `varying vec3 vDirection;
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        uniform vec3 sunColor;
        uniform vec3 sunDirection;
        uniform float sunStrength;
        void main() {
          float h = normalize(vDirection).y;
          vec3 color = mix(horizonColor, topColor, smoothstep(-0.03, 0.78, h));
          color = mix(bottomColor, color, smoothstep(-0.52, -0.01, h));
          float sunDot = max(dot(normalize(vDirection), normalize(sunDirection)), 0.0);
          color += sunColor * pow(sunDot, 480.0) * 2.0 * sunStrength;
          color += sunColor * pow(sunDot, 18.0) * 0.22 * sunStrength;
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(280, 32, 20), skyMaterial);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -100;
    scene.add(this.sky);

    this.hemisphere = new THREE.HemisphereLight(0xe4f1df, 0x6b7668, 1.42);
    scene.add(this.hemisphere);
    this.sun = new THREE.DirectionalLight(0xffefd4, 1.8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -38;
    this.sun.shadow.camera.right = 38;
    this.sun.shadow.camera.top = 38;
    this.sun.shadow.camera.bottom = -38;
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 150;
    this.sun.shadow.bias = -0.00038;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 2.1;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.moon = new THREE.DirectionalLight(0x8aa9c0, 0.12);
    scene.add(this.moon);

    let randomState = 59381;
    const rand = () => { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296; };
    const starPositions = [];
    for (let i = 0; i < 460; i++) {
      const angle = rand() * Math.PI * 2;
      const elevation = rand() * 0.96 + 0.04;
      const radius = Math.sqrt(1 - elevation * elevation) * 210;
      starPositions.push(Math.cos(angle) * radius, elevation * 210, Math.sin(angle) * radius);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    this.stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xfff3d9, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    this.cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xfff6dc, transparent: true, opacity: 0.6, depthWrite: false, fog: false });
    this.cloudGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.clouds = new THREE.InstancedMesh(this.cloudGeometry, this.cloudMaterial, 98);
    this.clouds.frustumCulled = false;
    const matrix = new THREE.Matrix4();
    let cloudIndex = 0;
    for (let i = 0; i < 23; i++) {
      const cx = (rand() - 0.5) * 220;
      const cz = (rand() - 0.5) * 220;
      const cy = 49 + rand() * 16;
      const width = 3.5 + rand() * 5;
      for (let j = 0; j < 4 && cloudIndex < 98; j++) {
        const position = new THREE.Vector3(cx + (j - 1.5) * width * 0.6, cy + (j === 1 ? 0.8 : (rand() - 0.5) * 1.4), cz + (rand() - 0.5) * 3);
        const scale = new THREE.Vector3(width * (0.75 + rand() * 0.5), 1.5 + rand() * 1.8, 3.5 + rand() * 3);
        matrix.compose(position, new THREE.Quaternion(), scale);
        this.clouds.setMatrixAt(cloudIndex++, matrix);
      }
    }
    this.clouds.count = cloudIndex;
    this.clouds.instanceMatrix.needsUpdate = true;
    scene.add(this.clouds);

    const drops = 290;
    this.rainDrops = Array.from({ length: drops }, () => ({ x: (rand() - 0.5) * 32, y: rand() * 22, z: (rand() - 0.5) * 32 }));
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(drops * 6), 3));
    this.rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: 0xd7ece9, transparent: true, opacity: 0.32, depthWrite: false, fog: false }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);

    const fireflyPositions = [];
    for (let i = 0; i < 75; i++) fireflyPositions.push((rand() - 0.5) * 43, (rand() - 0.5) * 6, (rand() - 0.5) * 43);
    const flyGeometry = new THREE.BufferGeometry();
    flyGeometry.setAttribute("position", new THREE.Float32BufferAttribute(fireflyPositions, 3));
    this.fireflies = new THREE.Points(flyGeometry, new THREE.PointsMaterial({ color: 0xffedaa, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.fireflies.frustumCulled = false;
    scene.add(this.fireflies);

    this.localLights = Array.from({ length: 7 }, () => {
      const light = new THREE.PointLight(0xffbe74, 0, 10, 2);
      scene.add(light);
      return light;
    });
  }

  update(dt, position, timeOfDay, weather, renderDistance = 3) {
    this.elapsed += dt;
    const angle = (timeOfDay - 0.25) * Math.PI * 2;
    const elevation = Math.sin(angle);
    const day = smoothstep(-0.16, 0.22, elevation);
    const dusk = Math.exp(-Math.pow((elevation - 0.02) / 0.34, 2));
    const rainy = weather === "rain";
    const misty = weather === "mist";
    const top = new THREE.Color("#10263a").lerp(new THREE.Color(rainy ? "#507e90" : "#458ba8"), day);
    const horizon = new THREE.Color("#344d62").lerp(new THREE.Color(rainy ? "#86a9ae" : "#88b7b6"), day).lerp(new THREE.Color("#eda978"), dusk * (rainy ? 0.08 : 0.38));
    const bottom = new THREE.Color("#263d49").lerp(new THREE.Color("#a3c3b2"), day);
    this.skyUniforms.topColor.value.copy(top);
    this.skyUniforms.horizonColor.value.copy(horizon);
    this.skyUniforms.bottomColor.value.copy(bottom);
    this.skyUniforms.sunColor.value.set(dusk > 0.5 ? "#ffd6a0" : "#fff0c9");
    const sunDirection = new THREE.Vector3(Math.cos(angle) * 0.83, elevation, -Math.cos(angle) * 0.56).normalize();
    this.skyUniforms.sunDirection.value.copy(sunDirection);
    this.skyUniforms.sunStrength.value = rainy ? day * 0.25 : day;
    this.sky.position.copy(position);
    this.stars.position.copy(position);
    this.stars.material.opacity = Math.pow(1 - day, 2) * (rainy ? 0.12 : 0.93);
    this.clouds.position.set(position.x + Math.sin(this.elapsed * 0.025) * 7, 0, position.z + Math.cos(this.elapsed * 0.014) * 5);
    this.cloudMaterial.opacity = 0.21 + day * (rainy ? 0.23 : 0.37);
    this.cloudMaterial.color.set(rainy ? "#b5c9c6" : dusk > 0.55 ? "#f7ddc2" : "#fff7e0");
    this.sun.position.copy(position).addScaledVector(sunDirection, 65);
    this.sun.target.position.set(position.x, position.y - 7, position.z);
    this.sun.target.updateMatrixWorld();
    this.sun.intensity = (0.12 + day * 1.75) * (rainy ? 0.55 : 1);
    this.sun.color.set(dusk > 0.45 ? "#ffd0a0" : "#fff2d9");
    this.hemisphere.intensity = (0.33 + day * 1.08) * (rainy ? 0.75 : 1);
    this.moon.intensity = (1 - day) * 0.32;
    this.moon.position.set(position.x - 30, position.y + 40, position.z + 25);
    this.scene.fog.color.copy(top).lerp(horizon, 0.24);
    this.scene.fog.density = (renderDistance === 2 ? 0.034 : renderDistance === 4 ? 0.02 : 0.024) * (rainy ? 1.48 : misty ? 1.3 : 1);
    this.fireflies.position.set(position.x, position.y + 2.2, position.z);
    this.fireflies.material.opacity = (1 - day) * (rainy ? 0.12 : 0.7) * (0.8 + Math.sin(this.elapsed * 2) * 0.16);

    this.rain.visible = rainy;
    if (rainy) {
      const positions = this.rain.geometry.attributes.position.array;
      this.rain.position.set(position.x, position.y, position.z);
      for (let i = 0; i < this.rainDrops.length; i++) {
        const drop = this.rainDrops[i];
        drop.y -= dt * (14 + (i % 5) * 2);
        drop.x -= dt * 2.5;
        if (drop.y < -5 || drop.x < -18) { drop.y = 15 + (i * 7 % 10); drop.x = (i * 97 % 34) - 17; }
        const index = i * 6;
        positions[index] = drop.x; positions[index + 1] = drop.y; positions[index + 2] = drop.z;
        positions[index + 3] = drop.x + 0.13; positions[index + 4] = drop.y + 0.7; positions[index + 5] = drop.z;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }

    this.lightTimer += dt;
    if (this.lightTimer > 0.33) {
      this.lightTimer = 0;
      const nearby = this.world.nearbyLights(position.x, position.z);
      this.localLights.forEach((light, i) => {
        const source = nearby[i];
        light.userData.active = Boolean(source);
        if (source) {
          light.position.set(source.x, source.y, source.z);
          light.distance = source.type === "campfire" ? 13 : 9;
          light.userData.base = source.type === "campfire" ? 1.9 : 1.35;
        }
      });
    }
    this.localLights.forEach((light, i) => { light.intensity = light.userData.active ? light.userData.base * (0.89 + Math.sin(this.elapsed * 13 + i * 5) * 0.11) : 0; });
    return day;
  }

  dispose() {
    this.scene.remove(this.sky, this.hemisphere, this.sun, this.sun.target, this.moon, this.stars, this.clouds, this.rain, this.fireflies);
    this.localLights.forEach((light) => this.scene.remove(light));
    this.sky.geometry.dispose(); this.sky.material.dispose();
    this.stars.geometry.dispose(); this.stars.material.dispose();
    this.cloudGeometry.dispose(); this.cloudMaterial.dispose();
    this.rain.geometry.dispose(); this.rain.material.dispose();
    this.fireflies.geometry.dispose(); this.fireflies.material.dispose();
    this.sun.dispose(); this.hemisphere.dispose(); this.moon.dispose();
    this.localLights.forEach((light) => light.dispose());
  }
}