import * as THREE from 'three';
import { SEA } from './world.js';
import { hash } from './noise.js';

export class Environment {
  constructor(scene, renderer, camera, world, settings) {
    this.scene = scene; this.renderer = renderer; this.camera = camera; this.world = world; this.settings = settings;
    this.rain = 0; this.daylight = 1; this.clock = 0;
    scene.fog = new THREE.Fog(0xcddfce, 65, 142);
    this.hemi = new THREE.HemisphereLight(0xe3f1e3, 0x7f8b53, 1.4); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffedc5, 2.7); this.sun.castShadow = settings.shadows;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.autoUpdate = false;
    this.sun.shadow.needsUpdate = true;
    Object.assign(this.sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 0.5, far: 190 });
    this.sun.shadow.bias = -0.0003; this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 2;
    scene.add(this.sun, this.sun.target);
    this.skyUniforms = {
      topColor: { value: new THREE.Color(0x83bad0) }, bottomColor: { value: new THREE.Color(0xdbe5ce) },
      sunDirection: { value: new THREE.Vector3(0.6, 0.65, -0.6) }, glow: { value: 0.1 },
    };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(460, 20, 12), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: this.skyUniforms,
      vertexShader: 'varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec3 vDirection; uniform vec3 topColor; uniform vec3 bottomColor; uniform vec3 sunDirection; uniform float glow; void main(){vec3 dir=normalize(vDirection); float h=pow(max(0.0,dir.y),0.65); vec3 color=mix(bottomColor,topColor,h); float glowAmount=pow(max(0.0,dot(dir,sunDirection)),12.0)*glow; color+=vec3(0.22,0.12,0.015)*glowAmount; gl_FragColor=vec4(color,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    }));
    scene.add(this.sky);
    this.sunDisc = new THREE.Mesh(new THREE.BoxGeometry(9, 9, 1), new THREE.MeshBasicMaterial({ color: 0xfff4d4, fog: false, toneMapped: false }));
    this.moonDisc = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 1), new THREE.MeshBasicMaterial({ color: 0xd9e5d1, fog: false, toneMapped: false }));
    scene.add(this.sunDisc, this.moonDisc);
    const starPositions = [];
    for (let i = 0; i < 550; i++) {
      const theta = hash(i, 1, 1) * Math.PI * 2, y = hash(i, 1, 2), r = Math.sqrt(1 - y * y);
      starPositions.push(Math.cos(theta) * r * 360, y * 360, Math.sin(theta) * r * 360);
    }
    const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xe8f0e4, size: 0.6, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false })); scene.add(this.stars);
    this.cloudMaterial = new THREE.MeshLambertMaterial({ color: 0xfff9e8, transparent: true, opacity: 0.88, depthWrite: false });
    this.clouds = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.cloudMaterial, 150);
    this.cloudData = []; const dummy = new THREE.Object3D();
    for (let i = 0; i < 30; i++) {
      const x = hash(i, 19, 1) * 460 - 230, z = hash(i, 19, 2) * 460 - 230, y = 65 + hash(i, 19, 3) * 30;
      for (let j = 0; j < 5; j++) {
        const data = { x: x + (hash(i, j, 7) - 0.5) * 20, z: z + (hash(i, j, 8) - 0.5) * 12, y: y + hash(i, j, 9) * 2, sx: 10 + hash(i, j, 10) * 14, sy: 1.3 + hash(i, j, 11) * 2.3, sz: 5 + hash(i, j, 12) * 8 };
        this.cloudData.push(data); dummy.position.set(data.x, data.y, data.z); dummy.scale.set(data.sx, data.sy, data.sz); dummy.updateMatrix(); this.clouds.setMatrixAt(i * 5 + j, dummy.matrix);
      }
    }
    this.clouds.frustumCulled = false; scene.add(this.clouds); this.dummy = dummy;
    const rainPositions = new Float32Array(900 * 6);
    this.rainGeometry = new THREE.BufferGeometry(); this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    this.rainLines = new THREE.LineSegments(this.rainGeometry, new THREE.LineBasicMaterial({ color: 0xd3e2dc, transparent: true, opacity: 0, depthWrite: false })); this.rainLines.frustumCulled = false; scene.add(this.rainLines);
    const firePositions = new Float32Array(65 * 3);
    this.fireGeometry = new THREE.BufferGeometry(); this.fireGeometry.setAttribute('position', new THREE.BufferAttribute(firePositions, 3));
    this.fireflies = new THREE.Points(this.fireGeometry, new THREE.PointsMaterial({ color: 0xf0df95, size: 0.13, transparent: true, opacity: 0, toneMapped: false, depthWrite: false })); this.fireflies.frustumCulled = false; scene.add(this.fireflies);
    this.torchLights = Array.from({ length: 3 }, () => { const light = new THREE.PointLight(0xffbd69, 0, 11, 1.8); light.visible = false; scene.add(light); return light; });
    this.heldLight = new THREE.PointLight(0xffd28c, 0, 10, 1.5); this.heldLight.visible = false; scene.add(this.heldLight);
    this.lastTorchUpdate = -5;
    this.sheep = [];
    this.createSheep();
  }

  createSheep() {
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xeee9d4 }), faceMat = new THREE.MeshLambertMaterial({ color: 0xafa994 });
    const legMat = new THREE.MeshLambertMaterial({ color: 0x6b7260 }), eyeMat = new THREE.MeshLambertMaterial({ color: 0x35433b });
    this.animalMaterials = [bodyMat, faceMat, legMat, eyeMat];
    const addBox = (group, sx, sy, sz, x, y, z, mat) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
    };
    const locations = [[-5, 11], [-25, -10], [34, 12], [40, -21], [-31, 40], [37, 34]];
    for (let i = 0; i < locations.length; i++) {
      const [x, z] = locations[i], h = this.world.column(x, z).h;
      if (h <= SEA) continue;
      const group = new THREE.Group();
      addBox(group, 0.8, 0.65, 1.14, 0, 0.8, 0, bodyMat);
      const head = new THREE.Group(); head.position.set(0, 0.99, -0.64); group.add(head);
      addBox(head, 0.48, 0.45, 0.42, 0, 0, 0, faceMat);
      addBox(head, 0.51, 0.14, 0.38, 0, 0.2, 0.04, bodyMat);
      addBox(head, 0.09, 0.09, 0.035, -0.16, 0.02, -0.223, eyeMat);
      addBox(head, 0.09, 0.09, 0.035, 0.16, 0.02, -0.223, eyeMat);
      addBox(head, 0.15, 0.11, 0.19, -0.29, 0.07, 0.02, faceMat);
      addBox(head, 0.15, 0.11, 0.19, 0.29, 0.07, 0.02, faceMat);
      const legs = [];
      for (const lx of [-0.25, 0.25]) for (const lz of [-0.37, 0.37]) legs.push(addBox(group, 0.17, 0.45, 0.18, lx, 0.25, lz, legMat));
      group.position.set(x + 0.5, h + 1, z + 0.5); group.rotation.y = hash(i, 24) * Math.PI * 2;
      this.scene.add(group); this.sheep.push({ group, head, legs, nextTurn: 2 + i, moving: true, phase: i * 2, happy: 0 });
    }
  }

  update(dt, total, dayTime, active = false, heldTorch = false) {
    this.clock = total;
    const cameraPos = this.camera.position;
    const angle = dayTime * Math.PI * 2 - Math.PI / 2, solar = Math.sin(angle);
    this.daylight = THREE.MathUtils.smoothstep(solar, -0.16, 0.42);
    const sunset = 1 - Math.min(1, Math.abs(solar) * 2.8);
    const targetRain = this.settings.weather === 'rain' ? 1 : this.settings.weather === 'clear' ? 0 : (active && total % 360 > 230 && total % 360 < 310 ? 1 : 0);
    this.rain += (targetRain - this.rain) * Math.min(1, dt * 0.25);
    const daylight = this.daylight;
    const top = new THREE.Color(0x152940).lerp(new THREE.Color(0x76b9d3), daylight);
    const bottom = new THREE.Color(0x344a55).lerp(new THREE.Color(0xdce4cd), daylight);
    bottom.lerp(new THREE.Color(0xe3b99a), sunset * 0.48);
    top.lerp(new THREE.Color(0x778f90), this.rain * 0.65); bottom.lerp(new THREE.Color(0xa2b7ae), this.rain * 0.6);
    this.skyUniforms.topColor.value.copy(top); this.skyUniforms.bottomColor.value.copy(bottom); this.skyUniforms.glow.value = daylight * (1 - this.rain);
    const direction = new THREE.Vector3(Math.cos(angle) * 0.62, solar, -Math.cos(angle) * 0.78).normalize();
    this.skyUniforms.sunDirection.value.copy(direction);
    this.sky.position.copy(cameraPos); this.stars.position.copy(cameraPos);
    this.sunDisc.position.copy(cameraPos).addScaledVector(direction, 330); this.sunDisc.lookAt(cameraPos); this.sunDisc.visible = solar > -0.1 && this.rain < 0.7;
    this.moonDisc.position.copy(cameraPos).addScaledVector(direction, -320); this.moonDisc.lookAt(cameraPos); this.moonDisc.visible = solar < 0.1;
    this.stars.material.opacity = (1 - daylight) * (1 - this.rain) * 0.8;
    this.scene.fog.color.copy(bottom);
    this.scene.fog.near = (this.settings.distance * 16 - 15) * (1 - this.rain * 0.3);
    this.scene.fog.far = (this.settings.distance * 16 + 77) * (1 - this.rain * 0.38);
    this.sun.intensity = (0.08 + Math.max(0, solar) * 2.7) * (1 - this.rain * 0.75);
    this.sun.color.setHex(sunset > 0.4 ? 0xffcf9e : 0xfff2d2);
    this.hemi.intensity = (0.38 + daylight * 1.05) * (1 - this.rain * 0.22);
    this.hemi.color.setHex(daylight > 0.5 ? 0xd9ede2 : 0x8caac5);
    this.sun.target.position.set(Math.round(cameraPos.x / 8) * 8, 12, Math.round(cameraPos.z / 8) * 8);
    this.sun.position.copy(this.sun.target.position).addScaledVector(direction, 95); this.sun.position.y = Math.max(18, this.sun.position.y);
    this.sun.castShadow = this.settings.shadows && daylight > 0.2;
    if (!this.lastShadow || total - this.lastShadow > 0.25) { this.sun.shadow.needsUpdate = true; this.lastShadow = total; }
    this.cloudMaterial.color.setHex(daylight > 0.5 ? 0xfff9e8 : 0x879eac);
    this.cloudMaterial.opacity = 0.7 + this.rain * 0.2;
    for (let i = 0; i < this.cloudData.length; i++) {
      const data = this.cloudData[i];
      const x = ((data.x + total * 0.45 - cameraPos.x + 230) % 460 + 460) % 460 - 230 + cameraPos.x;
      this.dummy.position.set(x, data.y, data.z + Math.round(cameraPos.z / 460) * 460);
      this.dummy.scale.set(data.sx, data.sy, data.sz); this.dummy.updateMatrix(); this.clouds.setMatrixAt(i, this.dummy.matrix);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    const sheltered = cameraPos.y < this.world.column(Math.floor(cameraPos.x), Math.floor(cameraPos.z)).h + 1;
    this.rainLines.visible = this.rain > 0.01 && !sheltered;
    if (this.rainLines.visible) {
      this.rainLines.material.opacity = this.rain * 0.36;
      const pos = this.rainGeometry.attributes.position.array;
      for (let i = 0; i < 900; i++) {
        const x = cameraPos.x + hash(i, 11) * 42 - 21, z = cameraPos.z + hash(i, 12) * 42 - 21;
        const y = cameraPos.y + ((hash(i, 13) * 30 - total * 18) % 30 + 30) % 30 - 8;
        pos.set([x, y, z, x - 0.15, y + 1.3, z], i * 6);
      }
      this.rainGeometry.attributes.position.needsUpdate = true;
    }
    this.fireflies.material.opacity = (1 - daylight) * (1 - this.rain) * 0.9;
    if (daylight < 0.9) {
      const pos = this.fireGeometry.attributes.position.array;
      for (let i = 0; i < 65; i++) {
        const x = Math.round(cameraPos.x / 32) * 32 + hash(i, 31) * 70 - 35, z = Math.round(cameraPos.z / 32) * 32 + hash(i, 32) * 70 - 35;
        pos.set([x + Math.sin(total * 0.4 + i) * 1.4, Math.max(SEA + 1, this.world.column(Math.floor(x), Math.floor(z)).h + 1) + 0.9 + Math.sin(total + i) * 0.65, z + Math.cos(total * 0.3 + i)], i * 3);
      }
      this.fireGeometry.attributes.position.needsUpdate = true;
    }
    if (total - this.lastTorchUpdate > 0.6) {
      this.lastTorchUpdate = total;
      const positions = [...this.world.torches.values()].flat().sort((a, b) => a.distanceToSquared(cameraPos) - b.distanceToSquared(cameraPos));
      this.torchLights.forEach((light, i) => { light.visible = !!positions[i] && positions[i].distanceToSquared(cameraPos) < 1800; if (light.visible) { light.position.copy(positions[i]); light.intensity = 8; } });
    }
    this.heldLight.position.copy(cameraPos); this.heldLight.visible = heldTorch; this.heldLight.intensity = heldTorch ? 7 : 0;
    this.updateSheep(dt, total, active);
  }

  updateSheep(dt, total, active) {
    for (const sheep of this.sheep) {
      const { group, legs, head } = sheep;
      if (total > sheep.nextTurn) { sheep.nextTurn = total + 3 + Math.random() * 6; group.rotation.y += (Math.random() - 0.5) * 2; sheep.moving = Math.random() > 0.35; }
      if (sheep.happy > 0) { sheep.happy -= dt; head.rotation.x = Math.sin(total * 5) * 0.15; }
      else head.rotation.x = sheep.moving ? 0 : Math.sin(total * 0.8 + sheep.phase) * 0.25 + 0.2;
      if (sheep.moving) {
        const nx = group.position.x - Math.sin(group.rotation.y) * dt * 0.55, nz = group.position.z - Math.cos(group.rotation.y) * dt * 0.55;
        const h = this.world.column(Math.floor(nx), Math.floor(nz)).h + 1;
        if (h > SEA + 1 && Math.abs(h - group.position.y) < 1.1 && !this.world.getBlock(nx, h, nz)) {
          group.position.x = nx; group.position.z = nz; group.position.y += (h - group.position.y) * Math.min(1, dt * 10);
        } else group.rotation.y += dt * 2;
        legs.forEach((leg, i) => { leg.rotation.x = Math.sin(total * 6 + sheep.phase + i % 2 * Math.PI) * 0.32; });
      } else legs.forEach(leg => { leg.rotation.x *= 0.9; });
      if (active && group.position.distanceToSquared(this.camera.position) > 110 * 110) {
        const x = Math.floor(this.camera.position.x + Math.sin(total + sheep.phase) * 42), z = Math.floor(this.camera.position.z + Math.cos(total + sheep.phase) * 42);
        const col = this.world.column(x, z);
        if (col.h > SEA + 2 && col.biome !== 'Dunes' && col.biome !== 'Alpine' && !this.world.getBlock(x, col.h + 1, z)) {
          group.position.set(x + 0.5, col.h + 1, z + 0.5); group.visible = true;
        } else group.visible = false;
      } else group.visible = true;
    }
  }

  dispose() {
    const objects = [this.sky, this.sunDisc, this.moonDisc, this.stars, this.clouds, this.rainLines, this.fireflies, this.hemi, this.sun, this.sun.target, this.heldLight, ...this.torchLights];
    for (const object of objects) { this.scene.remove(object); object.geometry?.dispose(); if (object.material) object.material.dispose(); }
    for (const sheep of this.sheep) { this.scene.remove(sheep.group); sheep.group.traverse(obj => obj.geometry?.dispose()); }
    this.animalMaterials.forEach(mat => mat.dispose()); this.sun.shadow.map?.dispose();
  }
}

export class Particles {
  constructor(scene) {
    this.scene = scene; this.capacity = 220; this.items = []; this.dummy = new THREE.Object3D();
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), this.capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false;
    this.mesh.count = 0; scene.add(this.mesh);
  }
  burst(x, y, z, color, count = 16, upward = false) {
    for (let i = 0; i < count; i++) {
      if (this.items.length >= this.capacity) this.items.shift();
      this.items.push({ x, y, z, vx: (Math.random() - 0.5) * 3, vy: upward ? 1 + Math.random() * 2 : Math.random() * 3, vz: (Math.random() - 0.5) * 3, life: 0.5 + Math.random() * 0.45, max: 1, size: 0.035 + Math.random() * 0.085, color: new THREE.Color(color) });
    }
  }
  update(dt) {
    this.items = this.items.filter(item => item.life > 0);
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i]; p.life -= dt; p.vy -= dt * 6; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      this.dummy.position.set(p.x, p.y, p.z); const scale = p.size * Math.min(1, p.life * 4); this.dummy.scale.setScalar(Math.max(0.001, scale)); this.dummy.rotation.set(p.life * 2, p.life * 3, 0.2); this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix); this.mesh.setColorAt(i, p.color);
    }
    this.mesh.count = this.items.length; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  dispose() { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}