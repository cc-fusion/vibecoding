import * as THREE from 'three';
import { Block } from './blocks';
import { hash2 } from './noise';
import type { VoxelWorld } from './world';

interface Animal {
  group: THREE.Group;
  legs: THREE.Mesh[];
  direction: number;
  nextTurn: number;
  speed: number;
  phase: number;
}

export class Scenery {
  private scene: THREE.Scene;
  private world: VoxelWorld;
  private sky: THREE.Mesh;
  private skyMaterial: THREE.ShaderMaterial;
  private sun: THREE.Group;
  private moon: THREE.Mesh;
  private hemi: THREE.HemisphereLight;
  private sunlight: THREE.DirectionalLight;
  private clouds: THREE.Group[] = [];
  private cloudMaterial: THREE.MeshLambertMaterial;
  private animals: Animal[] = [];
  private rain: THREE.LineSegments;
  private rainPositions: Float32Array;
  private elapsed = 0;
  private weather: 'Clear' | 'Rain' = 'Clear';

  constructor(scene: THREE.Scene, world: VoxelWorld) {
    this.scene = scene; this.world = world;
    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: { topColor: { value: new THREE.Color('#78b7cd') }, bottomColor: { value: new THREE.Color('#d9e9d2') } },
      vertexShader: 'varying vec3 vDirection; void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vDirection; void main() { float h = max(normalize(vDirection).y, 0.0); gl_FragColor = vec4(mix(bottomColor, topColor, pow(h, 0.62)), 1.0); }',
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), this.skyMaterial);
    this.sky.renderOrder = -100; scene.add(this.sky);
    scene.fog = new THREE.Fog('#c5decf', 35, 89);
    this.hemi = new THREE.HemisphereLight('#e6f4e4', '#706958', 1.5); scene.add(this.hemi);
    this.sunlight = new THREE.DirectionalLight('#fff4d5', 1.5); this.sunlight.position.set(40, 70, -30); scene.add(this.sunlight);

    this.sun = new THREE.Group();
    const haloCanvas = document.createElement('canvas'); haloCanvas.width = 128; haloCanvas.height = 128;
    const haloContext = haloCanvas.getContext('2d')!;
    const glow = haloContext.createRadialGradient(64, 64, 4, 64, 64, 64);
    glow.addColorStop(0, 'rgba(255,246,203,0.75)'); glow.addColorStop(0.25, 'rgba(255,239,192,0.28)'); glow.addColorStop(1, 'rgba(255,239,192,0)');
    haloContext.fillStyle = glow; haloContext.fillRect(0, 0, 128, 128);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(25, 25), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(haloCanvas), transparent: true, depthWrite: false, fog: false }));
    const sunDisc = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5), new THREE.MeshBasicMaterial({ color: '#fff5d4', fog: false }));
    sunDisc.position.z = 0.1; this.sun.add(halo, sunDisc); scene.add(this.sun);
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: '#e6f0dd', fog: false })); scene.add(this.moon);

    this.cloudMaterial = new THREE.MeshLambertMaterial({ color: '#fffdf0', transparent: true, opacity: 0.85, depthWrite: false });
    this.createClouds();
    this.createAnimals();
    this.rainPositions = new Float32Array(460 * 6);
    for (let i = 0; i < 460; i++) {
      const x = (hash2(i, 1, 52) - 0.5) * 46, z = (hash2(i, 2, 52) - 0.5) * 46, y = hash2(i, 3, 52) * 24;
      this.rainPositions.set([x, y, z, x - 0.18, y - 1.1, z + 0.12], i * 6);
    }
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: '#d4e6df', transparent: true, opacity: 0.42, depthWrite: false }));
    this.rain.visible = false; scene.add(this.rain);
  }

  private createClouds() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 20; i++) {
      const group = new THREE.Group();
      const angle = i / 20 * Math.PI * 2 + hash2(i, 3, 4) * 0.4;
      const distance = 28 + hash2(i, 6, 9) * 65;
      group.position.set(Math.sin(angle) * distance, 31 + hash2(i, 8, 1) * 10, Math.cos(angle) * distance);
      const parts = 3 + Math.floor(hash2(i, 2, 6) * 3);
      for (let j = 0; j < parts; j++) {
        const mesh = new THREE.Mesh(geometry, this.cloudMaterial);
        mesh.position.set((j - parts / 2) * 4.5, (j % 2) * 0.7, (j % 3 - 1) * 2.2);
        mesh.scale.set(6 + hash2(i, j, 3) * 4, 1.1 + hash2(j, i, 2), 4.5 + hash2(i, j, 7) * 3);
        group.add(mesh);
      }
      this.clouds.push(group); this.scene.add(group);
    }
  }

  private createAnimals() {
    const makeBox = (parent: THREE.Group, size: [number, number, number], position: [number, number, number], material: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material); mesh.position.set(...position); parent.add(mesh); return mesh;
    };
    const locations: [number, number, boolean][] = [[6, -5, false], [-7, -13, true], [15, -5, true], [-14, -26, false], [23, -17, true], [-22, 2, false]];
    locations.forEach(([x, z, sheep], i) => {
      const group = new THREE.Group();
      const coat = new THREE.MeshLambertMaterial({ color: sheep ? '#eeeade' : '#d99b91' });
      const face = new THREE.MeshLambertMaterial({ color: sheep ? '#b8a891' : '#e8aca0' });
      const dark = new THREE.MeshLambertMaterial({ color: '#51483f' });
      makeBox(group, [0.9, 0.68, 1.3], [0, 0.75, 0], coat);
      makeBox(group, [0.63, 0.62, 0.62], [0, 1.02, -0.78], face);
      if (sheep) makeBox(group, [0.69, 0.24, 0.68], [0, 1.34, -0.78], coat);
      else makeBox(group, [0.38, 0.24, 0.12], [0, 0.95, -1.13], face);
      makeBox(group, [0.08, 0.09, 0.035], [-0.18, 1.1, -1.105], dark);
      makeBox(group, [0.08, 0.09, 0.035], [0.18, 1.1, -1.105], dark);
      const legs: THREE.Mesh[] = [];
      for (const lx of [-0.3, 0.3]) for (const lz of [-0.44, 0.44]) legs.push(makeBox(group, [0.22, 0.5, 0.22], [lx, 0.25, lz], face));
      group.position.set(x, this.world.surfaceAt(x, z), z);
      group.rotation.y = i * 1.4;
      this.scene.add(group);
      this.animals.push({ group, legs, direction: i * 1.4, nextTurn: i * 0.7 + 2, speed: 0.25 + i * 0.025, phase: i });
    });
  }

  setWeather(weather: 'Clear' | 'Rain') { this.weather = weather; this.rain.visible = weather === 'Rain'; }

  update(dt: number, time: number, camera: THREE.PerspectiveCamera) {
    this.elapsed += dt;
    const fraction = ((time % 1) + 1) % 1;
    const angle = (fraction - 0.25) * Math.PI * 2;
    const daylight = THREE.MathUtils.clamp(Math.sin(angle) * 1.1 + 0.28, 0.1, 1);
    const rainDim = this.weather === 'Rain' ? 0.77 : 1;
    const top = new THREE.Color('#172b4a').lerp(new THREE.Color('#77b8d0'), daylight * rainDim);
    const bottom = new THREE.Color('#394760').lerp(new THREE.Color('#dbead2'), daylight * rainDim);
    this.skyMaterial.uniforms.topColor.value.copy(top);
    this.skyMaterial.uniforms.bottomColor.value.copy(bottom);
    (this.scene.fog as THREE.Fog).color.copy(bottom).lerp(top, 0.22);
    (this.scene.fog as THREE.Fog).far = this.weather === 'Rain' ? 64 : 89;
    this.hemi.intensity = (0.33 + daylight * 1.18) * rainDim;
    this.sunlight.intensity = (0.12 + daylight * 1.35) * rainDim;
    this.sunlight.position.set(Math.cos(angle) * 70, Math.max(5, Math.sin(angle) * 85), -40);
    this.sky.position.copy(camera.position);
    this.sun.position.set(camera.position.x + Math.cos(angle) * 55, camera.position.y + Math.sin(angle) * 55, camera.position.z - 92);
    this.sun.quaternion.copy(camera.quaternion); this.sun.visible = Math.sin(angle) > -0.05;
    this.moon.position.set(camera.position.x - Math.cos(angle) * 55, camera.position.y - Math.sin(angle) * 55, camera.position.z + 92);
    this.moon.quaternion.copy(camera.quaternion); this.moon.visible = Math.sin(angle) < 0.08;
    this.cloudMaterial.color.set('#ffffff').multiplyScalar(0.48 + daylight * 0.52);
    this.clouds.forEach(cloud => {
      cloud.position.x += dt * 0.28;
      if (cloud.position.x - camera.position.x > 110) cloud.position.x = camera.position.x - 110;
      if (cloud.position.x - camera.position.x < -110) cloud.position.x = camera.position.x + 110;
      if (cloud.position.z - camera.position.z > 110) cloud.position.z = camera.position.z - 110;
      if (cloud.position.z - camera.position.z < -110) cloud.position.z = camera.position.z + 110;
    });
    this.animals.forEach(animal => {
      animal.nextTurn -= dt;
      if (animal.nextTurn <= 0) {
        animal.direction += (Math.random() - 0.5) * 2.2;
        animal.nextTurn = 2 + Math.random() * 5;
      }
      const x = animal.group.position.x - Math.sin(animal.direction) * animal.speed * dt;
      const z = animal.group.position.z - Math.cos(animal.direction) * animal.speed * dt;
      const ground = this.world.surfaceAt(x, z);
      const blockAbove = this.world.getBlock(x, ground, z);
      if (Math.abs(ground - animal.group.position.y) <= 1.1 && blockAbove !== Block.Water && blockAbove !== Block.Log && blockAbove !== Block.Leaves) {
        animal.group.position.set(x, THREE.MathUtils.lerp(animal.group.position.y, ground, Math.min(1, dt * 5)), z);
      } else animal.direction += Math.PI * 0.8;
      animal.group.rotation.y = animal.direction;
      animal.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(this.elapsed * 4 + animal.phase + (i % 3) * Math.PI) * 0.22; });
    });
    if (this.weather === 'Rain') {
      this.rain.position.set(camera.position.x, camera.position.y - 6, camera.position.z);
      for (let i = 0; i < this.rainPositions.length; i += 6) {
        this.rainPositions[i + 1] -= dt * 15;
        if (this.rainPositions[i + 1] < 0) this.rainPositions[i + 1] += 24;
        this.rainPositions[i + 4] = this.rainPositions[i + 1] - 1.1;
      }
      (this.rain.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  dispose() {
    this.scene.remove(this.sky, this.sun, this.moon, this.hemi, this.sunlight, this.rain);
    this.sky.geometry.dispose(); this.skyMaterial.dispose(); this.rain.geometry.dispose();
    (this.rain.material as THREE.Material).dispose();
    this.sun.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const material = object.material as THREE.MeshBasicMaterial;
        material.map?.dispose(); material.dispose();
      }
    });
    this.moon.geometry.dispose(); (this.moon.material as THREE.Material).dispose();
    if (this.clouds[0]?.children[0] instanceof THREE.Mesh) this.clouds[0].children[0].geometry.dispose();
    this.clouds.forEach(cloud => this.scene.remove(cloud));
    this.cloudMaterial.dispose();
    this.animals.forEach(animal => {
      this.scene.remove(animal.group);
      animal.group.traverse(object => {
        if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); }
      });
    });
  }
}