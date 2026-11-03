import * as THREE from 'three';
import { BLOCK_SHAPES } from '../constants.js';
import { BLOCKS } from '../data/blocks.js';
import { getEntry } from '../data/items.js';

export class ViewModel {
  constructor(atlas) {
    this.atlas = atlas;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 10);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.75);
    this.dirLight = new THREE.DirectionalLight(0xfff6e5, 0.75);
    this.dirLight.position.set(1.5, 2.5, 2.0);
    this.scene.add(this.ambient);
    this.scene.add(this.dirLight);

    this.anchor = new THREE.Group();
    this.scene.add(this.anchor);

    this._currentItemId = -1;
    this._currentMesh = null;
    this._swingPhase = 0;
    this._swinging = false;
    this._bobPhase = 0;
    this._swayX = 0;
    this._swayY = 0;

    this._buildHeldMesh(0);
  }

  onResize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  triggerSwing() {
    if (!this._swinging || this._swingPhase > 0.45) {
      this._swinging = true;
      this._swingPhase = 0;
    }
  }

  addLookSway(dx, dy) {
    this._swayX = THREE.MathUtils.clamp(this._swayX - dx * 0.0005, -0.06, 0.06);
    this._swayY = THREE.MathUtils.clamp(this._swayY + dy * 0.0005, -0.06, 0.06);
  }

  _buildHeldMesh(itemId) {
    if (this._currentMesh) {
      this.anchor.remove(this._currentMesh);
      this._currentMesh.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material && obj.material !== this._sharedBlockMat) {
          if (obj.material.map && obj.material.map !== this.atlas.texture) {
            obj.material.map.dispose();
          }
          obj.material.dispose();
        }
      });
      this._currentMesh = null;
    }

    this._currentItemId = itemId;
    const entry = getEntry(itemId);

    if (!entry) {
      // Empty hand: crisp voxel forearm + sleeve
      const group = new THREE.Group();
      const armGeo = new THREE.BoxGeometry(0.18, 0.56, 0.18);
      const armMat = new THREE.MeshLambertMaterial({ color: 0xdca884 });
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.rotation.x = -0.85;
      arm.rotation.z = 0.25;
      arm.position.set(0.42, -0.44, -0.62);
      group.add(arm);
      this._currentMesh = group;
      this.anchor.add(group);
      return;
    }

    if (entry.isBlock && BLOCKS[itemId].shape !== BLOCK_SHAPES.CROSS && BLOCKS[itemId].shape !== BLOCK_SHAPES.TORCH) {
      const h = BLOCKS[itemId].shape === BLOCK_SHAPES.SLAB_BED ? 0.19 : 0.32;
      const geo = new THREE.BoxGeometry(0.32, h, 0.32);
      const uvAttr = geo.attributes.uv;
      const faceNames = ['side', 'side', 'top', 'bottom', 'front', 'side'];
      for (let f = 0; f < 6; f++) {
        const rect = this.atlas.getBlockFaceUV(itemId, faceNames[f]);
        const base = f * 4;
        uvAttr.setXY(base + 0, rect.u0, rect.v1);
        uvAttr.setXY(base + 1, rect.u1, rect.v1);
        uvAttr.setXY(base + 2, rect.u0, rect.v0);
        uvAttr.setXY(base + 3, rect.u1, rect.v0);
      }
      uvAttr.needsUpdate = true;

      if (!this._sharedBlockMat) {
        this._sharedBlockMat = new THREE.MeshLambertMaterial({
          map: this.atlas.texture,
          alphaTest: 0.4,
        });
      }
      const mesh = new THREE.Mesh(geo, this._sharedBlockMat);
      mesh.position.set(0.44, -0.34, -0.65);
      mesh.rotation.set(0.18, -0.68, 0.05);
      this._currentMesh = mesh;
      this.anchor.add(mesh);
      return;
    }

    // Tool / Item / Torch / Flora — build crisp 3D pixel-extruded voxel sprite!
    let srcCanvas;
    if (entry.isBlock) {
      const tileName = BLOCKS[itemId].textures.all || BLOCKS[itemId].textures.side || 'stone';
      srcCanvas = this.atlas.tiles[tileName] || this.atlas.tiles.stone;
    } else {
      srcCanvas = this.atlas.getItemCanvas(itemId);
    }

    const group = this._buildExtrudedPixelSprite(srcCanvas, 0.024);
    group.position.set(0.45, -0.36, -0.64);
    group.rotation.set(0.12, -1.25, -0.25);
    this._currentMesh = group;
    this.anchor.add(group);
  }

  _buildExtrudedPixelSprite(canvas, pxSize = 0.024) {
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, 16, 16).data;

    const positions = [];
    const colors = [];
    const normals = [];
    const indices = [];
    let vCount = 0;

    const pushFace = (verts, norm, r, g, b) => {
      const base = vCount;
      for (const v of verts) {
        positions.push(v[0], v[1], v[2]);
        normals.push(norm[0], norm[1], norm[2]);
        colors.push(r, g, b);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      vCount += 4;
    };

    const isSolid = (x, y) => {
      if (x < 0 || x >= 16 || y < 0 || y >= 16) return false;
      return data[(y * 16 + x) * 4 + 3] > 60;
    };

    const halfDepth = pxSize * 0.65;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = (y * 16 + x) * 4;
        if (data[i + 3] <= 60) continue;
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;

        const x0 = (x - 8) * pxSize;
        const x1 = (x - 7) * pxSize;
        const y0 = (15 - y - 8) * pxSize;
        const y1 = (16 - y - 8) * pxSize;
        const z0 = -halfDepth;
        const z1 = halfDepth;

        // Front & Back
        pushFace([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], r, g, b);
        pushFace([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], r, g, b);

        // Exposed 3D pixel edges
        if (!isSolid(x, y - 1)) {
          pushFace([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], r, g, b);
        }
        if (!isSolid(x, y + 1)) {
          pushFace([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], r, g, b);
        }
        if (!isSolid(x + 1, y)) {
          pushFace([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], r, g, b);
        }
        if (!isSolid(x - 1, y)) {
          pushFace([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], r, g, b);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    return new THREE.Mesh(geo, mat);
  }

  update(dt, heldItemId, horizSpeed, onGround, localBrightness = 1.0) {
    const targetId = heldItemId || 0;
    if (targetId !== this._currentItemId) {
      this._buildHeldMesh(targetId);
    }

    // Smoothly decay mouse sway
    this._swayX *= Math.pow(0.001, dt);
    this._swayY *= Math.pow(0.001, dt);

    // Walk bob
    if (onGround && horizSpeed > 0.25) {
      this._bobPhase += dt * horizSpeed * 2.1;
    } else {
      this._bobPhase += dt * 1.4;
    }
    const bobX = onGround && horizSpeed > 0.25 ? Math.cos(this._bobPhase * 0.5) * 0.022 : 0;
    const bobY = onGround && horizSpeed > 0.25 ? Math.abs(Math.sin(this._bobPhase * 0.5)) * 0.024 : Math.sin(this._bobPhase) * 0.006;

    // Swing arc
    let swingRotX = 0;
    let swingRotZ = 0;
    let swingPosZ = 0;
    if (this._swinging) {
      this._swingPhase += dt * 4.4;
      if (this._swingPhase >= 1.0) {
        this._swingPhase = 0;
        this._swinging = false;
      } else {
        const s = Math.sin(this._swingPhase * Math.PI);
        swingRotX = -s * 0.95;
        swingRotZ = s * 0.35;
        swingPosZ = -s * 0.14;
      }
    }

    this.anchor.position.set(this._swayX + bobX, this._swayY - bobY, swingPosZ);
    this.anchor.rotation.set(swingRotX, 0, swingRotZ);

    const b = Math.max(0.24, Math.min(1.1, localBrightness));
    this.ambient.intensity = b * 0.72;
    this.dirLight.intensity = b * 0.65;
  }

  render(renderer) {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
