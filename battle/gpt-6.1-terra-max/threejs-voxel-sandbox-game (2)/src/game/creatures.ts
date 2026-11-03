import * as THREE from 'three';
import { hasTree, hash2, terrainHeight, WATER_LEVEL } from './noise';

interface Sheep {
  group: THREE.Group;
  body: THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>;
  legs: THREE.Mesh[];
  angle: number;
  changeIn: number;
  phase: number;
  shearedFor: number;
}

export class Creatures {
  private sheep: Sheep[] = [];
  private raycaster = new THREE.Raycaster();
  private elapsed = 0;

  constructor(private scene: THREE.Scene, private seed: number) {
    const locations = [[-5, -14], [6, -15], [-14, -27], [16, -31], [17, 6], [-22, 4]];
    locations.forEach(([x, z], index) => this.createSheep(x, z, index));
  }

  private createSheep(startX: number, startZ: number, index: number) {
    let x = startX;
    let z = startZ;
    for (let i = 0; i < 18; i++) {
      if (terrainHeight(x, z, this.seed) > WATER_LEVEL + 1 && !hasTree(x, z, this.seed)) break;
      x += i % 2 ? 1 : -1;
      z += 1;
    }
    const group = new THREE.Group();
    const makeBox = (size: [number, number, number], position: [number, number, number], color: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshLambertMaterial({ color }));
      mesh.position.set(...position);
      mesh.userData.sheepIndex = index;
      group.add(mesh);
      return mesh;
    };
    const body = makeBox([0.9, 0.72, 1.25], [0, 0.86, 0], 0xf0efe1);
    makeBox([0.62, 0.56, 0.58], [0, 1.03, -0.78], 0xf4f1e2);
    makeBox([0.48, 0.32, 0.18], [0, 0.89, -1.12], 0xcbbda8);
    makeBox([0.13, 0.12, 0.08], [-0.19, 1.12, -1.09], 0x3b3830);
    makeBox([0.13, 0.12, 0.08], [0.19, 1.12, -1.09], 0x3b3830);
    makeBox([0.2, 0.17, 0.27], [-0.4, 1.19, -0.73], 0xe1dfd0);
    makeBox([0.2, 0.17, 0.27], [0.4, 1.19, -0.73], 0xe1dfd0);
    const legs: THREE.Mesh[] = [];
    for (const lx of [-0.3, 0.3]) {
      for (const lz of [-0.4, 0.4]) legs.push(makeBox([0.21, 0.55, 0.22], [lx, 0.27, lz], 0x8b8072));
    }
    group.position.set(x + 0.5, terrainHeight(x, z, this.seed) + 1, z + 0.5);
    group.rotation.y = hash2(index, 5, this.seed) * Math.PI * 2;
    this.scene.add(group);
    this.sheep.push({ group, body, legs, angle: group.rotation.y, changeIn: 2 + index, phase: index * 2, shearedFor: 0 });
  }

  update(dt: number, active: boolean) {
    this.elapsed += dt;
    for (let i = 0; i < this.sheep.length; i++) {
      const animal = this.sheep[i];
      if (animal.shearedFor > 0) {
        animal.shearedFor -= dt;
        if (animal.shearedFor <= 0) animal.body.material.color.setHex(0xf0efe1);
      }
      if (!active) continue;
      animal.changeIn -= dt;
      if (animal.changeIn <= 0) {
        animal.angle += (hash2(i, Math.floor(this.elapsed), this.seed + 19) - 0.5) * 2.6;
        animal.changeIn = 2 + hash2(i, Math.floor(this.elapsed), this.seed + 23) * 4;
      }
      const x = animal.group.position.x - Math.sin(animal.angle) * dt * 0.34;
      const z = animal.group.position.z - Math.cos(animal.angle) * dt * 0.34;
      const ground = terrainHeight(Math.floor(x), Math.floor(z), this.seed) + 1;
      if (ground <= WATER_LEVEL + 1 || Math.abs(ground - animal.group.position.y) > 1.1 || Math.abs(x) > 48 || Math.abs(z) > 48) {
        animal.angle += Math.PI * 0.7;
        animal.changeIn = 2;
      } else {
        animal.group.position.x = x;
        animal.group.position.z = z;
        animal.group.position.y = THREE.MathUtils.lerp(animal.group.position.y, ground, Math.min(1, dt * 5));
      }
      animal.group.rotation.y = animal.angle;
      for (let leg = 0; leg < animal.legs.length; leg++) {
        animal.legs[leg].rotation.x = Math.sin(this.elapsed * 5 + animal.phase + (leg % 2 ? Math.PI : 0)) * 0.2;
      }
    }
  }

  target(camera: THREE.Camera, maxDistance: number): { index: number; distance: number } | null {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    this.raycaster.far = maxDistance;
    const hits = this.raycaster.intersectObjects(this.sheep.map((animal) => animal.group), true);
    if (!hits.length) return null;
    return { index: hits[0].object.userData.sheepIndex as number, distance: hits[0].distance };
  }

  shear(index: number) {
    const animal = this.sheep[index];
    if (!animal || animal.shearedFor > 0) return false;
    animal.shearedFor = 75;
    animal.body.material.color.setHex(0xbdb5a5);
    return true;
  }

  dispose() {
    for (const animal of this.sheep) {
      this.scene.remove(animal.group);
      animal.group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        }
      });
    }
    this.sheep = [];
  }
}