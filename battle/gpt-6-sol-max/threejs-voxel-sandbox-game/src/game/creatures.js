import * as THREE from "three";
import { WATER_LEVEL } from "./world.js";

function mosslingGeometry(shorn = false) {
  const positions = [], normals = [], colors = [], indices = [];
  const addBox = (size, center, hex) => {
    const geometry = new THREE.BoxGeometry(...size);
    geometry.translate(...center);
    const position = geometry.getAttribute("position").array;
    const normal = geometry.getAttribute("normal").array;
    const color = new THREE.Color(hex);
    const offset = positions.length / 3;
    for (let i = 0; i < position.length; i += 3) {
      positions.push(position[i], position[i + 1], position[i + 2]);
      normals.push(normal[i], normal[i + 1], normal[i + 2]);
      colors.push(color.r, color.g, color.b);
    }
    for (const index of geometry.index.array) indices.push(index + offset);
    geometry.dispose();
  };
  const wool = shorn ? "#a4a894" : "#e2e3ce";
  addBox([0.91, 0.69, 1.15], [0, 0.86, 0], wool);
  addBox([0.68, 0.23, 0.82], [0, 1.28, 0.04], shorn ? "#b9bca4" : "#f0eedc");
  addBox([0.36, 0.35, 0.3], [0, 0.93, 0.64], wool);
  addBox([0.55, 0.51, 0.42], [0, 0.95, -0.68], "#786755");
  addBox([0.24, 0.12, 0.08], [0, 0.82, -0.93], "#d3a99a");
  for (const side of [-1, 1]) {
    addBox([0.075, 0.08, 0.025], [side * 0.19, 1.05, -0.905], "#243d38");
    addBox([0.22, 0.19, 0.22], [side * 0.38, 1.22, -0.56], wool);
    for (const back of [-1, 1]) addBox([0.17, 0.49, 0.18], [side * 0.29, 0.28, back * 0.38], "#665a4d");
  }
  addBox([0.22, 0.055, 0.14], [0.13, 1.42, -0.57], "#7fa476");
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

export class Creatures {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.members = new Map();
    this.woolGeometry = mosslingGeometry();
    this.shornGeometry = mosslingGeometry(true);
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.lastSync = -10;
  }

  create(gx, gz) {
    const x = gx * 19 + 2 + this.world.hash(gx, gz, 700) * 14;
    const z = gz * 19 + 2 + this.world.hash(gx, gz, 701) * 14;
    const info = this.world.terrainInfo(Math.floor(x), Math.floor(z));
    const chance = info.biome === "meadow" ? 0.58 : info.biome === "woodland" ? 0.4 : info.biome === "drylands" ? 0.22 : 0;
    if (info.height <= WATER_LEVEL + 1 || this.world.hash(gx, gz, 702) > chance) return null;
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(this.woolGeometry, this.material);
    mesh.castShadow = true;
    group.add(mesh);
    group.position.set(x, info.height + 1, z);
    group.rotation.y = this.world.hash(gx, gz, 703) * Math.PI * 2;
    this.scene.add(group);
    return {
      key: `${gx},${gz}`, x, z, y: info.height + 1, group, mesh,
      heading: group.rotation.y, targetHeading: group.rotation.y,
      changeAt: 0, phase: this.world.hash(gx, gz, 704) * 10,
      shearedUntil: 0,
    };
  }

  sync(x, z, time) {
    if (time - this.lastSync < 2.5) return;
    this.lastSync = time;
    const centerX = Math.floor(x / 19), centerZ = Math.floor(z / 19);
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const gx = centerX + dx, gz = centerZ + dz, key = `${gx},${gz}`;
      if (this.members.has(key)) continue;
      const member = this.create(gx, gz);
      if (member) this.members.set(key, member);
    }
    for (const [key, member] of this.members) {
      if (Math.hypot(member.x - x, member.z - z) > 82) {
        this.scene.remove(member.group);
        this.members.delete(key);
      }
    }
  }

  update(dt, x, z, time) {
    this.sync(x, z, time);
    for (const member of this.members.values()) {
      const distance = Math.hypot(member.x - x, member.z - z);
      if (distance > 53) { member.group.visible = false; continue; }
      member.group.visible = true;
      if (time > member.changeAt) {
        member.changeAt = time + 2.5 + this.world.hash(Math.floor(time), Math.floor(member.x), 705) * 5;
        member.targetHeading += (this.world.hash(Math.floor(time), Math.floor(member.z), 706) - 0.5) * 2.5;
      }
      const headingDelta = Math.atan2(Math.sin(member.targetHeading - member.heading), Math.cos(member.targetHeading - member.heading));
      member.heading += headingDelta * Math.min(1, dt * 1.2);
      const pace = distance < 3.5 ? 1.12 : 0.42;
      const nextX = member.x - Math.sin(member.heading) * pace * dt;
      const nextZ = member.z - Math.cos(member.heading) * pace * dt;
      const next = this.world.terrainInfo(Math.floor(nextX), Math.floor(nextZ));
      if (next.height > WATER_LEVEL + 1 && Math.abs(next.height + 1 - member.y) <= 1 && next.biome !== "coast") {
        member.x = nextX; member.z = nextZ;
        member.y += (next.height + 1 - member.y) * Math.min(1, dt * 8);
      } else member.targetHeading += Math.PI * 0.78;
      member.group.position.set(member.x, member.y + Math.sin(time * 7 + member.phase) * 0.025, member.z);
      member.group.rotation.y = member.heading;
      if (member.shearedUntil && time > member.shearedUntil) {
        member.shearedUntil = 0;
        member.mesh.geometry = this.woolGeometry;
      }
    }
  }

  target(origin, direction, reach = 4) {
    let best = null;
    for (const member of this.members.values()) {
      if (!member.group.visible) continue;
      const center = new THREE.Vector3(member.x, member.y + 0.9, member.z);
      const projection = center.clone().sub(origin).dot(direction);
      if (projection < 0 || projection > reach || (best && projection >= best.distance)) continue;
      const closest = origin.clone().addScaledVector(direction, projection);
      if (closest.distanceTo(center) < 0.83) best = { member, distance: projection };
    }
    return best;
  }

  gather(member, time) {
    if (member.shearedUntil > time) return false;
    member.shearedUntil = time + 105;
    member.mesh.geometry = this.shornGeometry;
    return true;
  }

  dispose() {
    for (const member of this.members.values()) this.scene.remove(member.group);
    this.members.clear();
    this.woolGeometry.dispose();
    this.shornGeometry.dispose();
    this.material.dispose();
  }
}