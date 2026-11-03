// First-person held item / arm rendered in its own overlay scene.
import * as THREE from 'three';
import { DEFS } from './blocks.js';
import { createItemMesh, setItemMeshLight, isFlatItem } from './itemmodels.js';
import { createVoxelMaterial } from './materials.js';

export class Hand {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.02, 10);
    this.holder = new THREE.Group();
    this.scene.add(this.holder);
    this.mesh = null;
    this.curId = -2;
    this.drop = 0;
    this.light = 1;
    this.bob = 0;
    // bare arm
    const armMat = new THREE.MeshBasicMaterial({ color: 0xc89472 });
    this.arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.75), armMat);
    this.armMat = armMat;
  }

  resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }

  setItem(id) {
    if (this.mesh) { this.holder.remove(this.mesh); this.mesh = null; }
    this.curId = id;
    this.drop = 1;
    if (id < 0) {
      this.mesh = this.arm;
    } else {
      this.mesh = createItemMesh(id, () => createVoxelMaterial(this.game.shared));
      if (isFlatItem(id)) this.mesh.scale.setScalar(0.62);
      else this.mesh.scale.setScalar(0.25);
    }
    this.holder.add(this.mesh);
  }

  update(dt, camera) {
    const g = this.game, p = g.player;
    const held = g.inventory.held();
    const id = held ? held.id : -1;
    if (id !== this.curId) this.setItem(id);
    this.drop = Math.max(0, this.drop - dt * 4.5);
    const flat = id >= 0 && isFlatItem(id);
    const swing = p.swingT, t = 1 - swing;
    const sw = swing > 0 ? Math.sin(t * Math.PI) : 0;
    const sw2 = swing > 0 ? Math.sin(Math.sqrt(t) * Math.PI) : 0;
    const bobAmp = g.settings.bobbing ? p.bobAmp : 0;
    const bx = Math.cos(p.bobPhase * 0.5) * 0.025 * bobAmp, by = -Math.abs(Math.sin(p.bobPhase * 0.5)) * 0.03 * bobAmp;
    const m = this.holder;
    if (id < 0) {
      this.mesh.position.set(0, 0, 0);
      m.position.set(0.5 + bx - sw * 0.1, -0.44 + by - sw2 * 0.22 - this.drop * 0.6, -0.55 - sw * 0.3);
      m.rotation.set(-0.35 - sw * 0.9, 0.18 - sw2 * 0.5, 0.15);
    } else if (flat) {
      m.position.set(0.5 + bx - sw2 * 0.28, -0.36 + by - sw2 * 0.18 - this.drop * 0.6, -0.7 - sw * 0.22);
      m.rotation.set(0.1 - sw * 0.9, -0.8 - sw2 * 0.4, 0.55 - sw2 * 0.3);
    } else {
      m.position.set(0.5 + bx - sw2 * 0.22, -0.4 + by - sw2 * 0.18 - this.drop * 0.6, -0.8 - sw * 0.25);
      m.rotation.set(0.1 - sw * 0.7, -0.7 - sw2 * 0.4, 0.04);
    }
    if (p.eating) {
      const e = p.eatT;
      m.position.set(0.1 + Math.sin(e * 28) * 0.012, -0.22 + Math.abs(Math.sin(e * 14)) * 0.05, -0.55);
      m.rotation.set(-0.5 + Math.sin(e * 28) * 0.05, flat ? -0.3 : -0.5, flat ? 0.2 : 0);
    }
    // lighting follows the local light level
    const L = g.lightAt(p.x, p.y + 1.2, p.z);
    this.light += (L - this.light) * Math.min(1, dt * 6);
    if (id < 0) this.armMat.color.setRGB(0.78 * this.light, 0.58 * this.light, 0.45 * this.light);
    else setItemMeshLight(this.mesh, this.light);
    void camera;
  }

  render(renderer) {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }

  static name(id) { return DEFS[id] ? DEFS[id].name : ''; }
}
