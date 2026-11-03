import * as THREE from 'three';
import { BLOCK, getItemDef } from './blocks.js';

export class HandAndTargetView {
  constructor(scene, camera, textures) {
    this.scene = scene;
    this.camera = camera;
    this.textures = textures;

    // 1. Targeted Voxel Outline
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    this.highlightLine = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x161922, transparent: true, opacity: 0.65 })
    );
    this.highlightLine.visible = false;
    this.scene.add(this.highlightLine);

    // 2. 3D Progressive Mining Crack Box
    const crackGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    this.crackMat = new THREE.MeshBasicMaterial({
      map: textures.crackTextures[0],
      transparent: true,
      depthWrite: false,
      opacity: 0.88,
    });
    this.crackMesh = new THREE.Mesh(crackGeo, this.crackMat);
    this.crackMesh.visible = false;
    this.crackMesh.renderOrder = 5;
    this.scene.add(this.crackMesh);

    // 3. First-Person Hand / Held Item attached to Camera
    this.handPivot = new THREE.Group();
    this.camera.add(this.handPivot);

    // Default Voxel Arm
    const armGeo = new THREE.BoxGeometry(0.18, 0.52, 0.18);
    const armMat = new THREE.MeshBasicMaterial({
      color: 0xe0ac84,
      depthTest: false,
    });
    this.armMesh = new THREE.Mesh(armGeo, armMat);
    this.armMesh.renderOrder = 999;
    this.armMesh.rotation.set(-0.55, -0.35, 0.28);
    this.handPivot.add(this.armMesh);

    // Held Block 3D Cube
    this.blockGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
    this.blockMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      depthTest: false,
    });
    this.heldBlockMesh = new THREE.Mesh(this.blockGeo, this.blockMat);
    this.heldBlockMesh.renderOrder = 999;
    this.heldBlockMesh.rotation.set(0.25, -0.68, 0.08);
    this.heldBlockMesh.visible = false;
    this.handPivot.add(this.heldBlockMesh);

    // Held Tool / Item Sprite Plane
    this.toolGeo = new THREE.PlaneGeometry(0.42, 0.42);
    this.toolMat = new THREE.MeshBasicMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.heldToolMesh = new THREE.Mesh(this.toolGeo, this.toolMat);
    this.heldToolMesh.renderOrder = 999;
    this.heldToolMesh.rotation.set(0.12, -0.45, -0.15);
    this.heldToolMesh.visible = false;
    this.handPivot.add(this.heldToolMesh);

    this.texCache = new Map();
    this.currentHeldId = -1;
    this.swingTime = 0;
    this.swingDuration = 0.24;
    this.bobPhase = 0;
  }

  getIconTex(id) {
    if (this.texCache.has(id)) return this.texCache.get(id);
    const url = this.textures.iconUrls[id];
    if (!url) return null;
    const tex = new THREE.TextureLoader().load(url);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    this.texCache.set(id, tex);
    return tex;
  }

  triggerSwing() {
    if (this.swingTime <= 0.06) {
      this.swingTime = this.swingDuration;
    }
  }

  setHeldItem(id) {
    const cleanId = id || 0;
    if (cleanId === this.currentHeldId) return;
    this.currentHeldId = cleanId;

    this.armMesh.visible = false;
    this.heldBlockMesh.visible = false;
    this.heldToolMesh.visible = false;

    if (!cleanId || cleanId === BLOCK.AIR) {
      this.armMesh.visible = true;
      return;
    }

    const def = getItemDef(cleanId);
    if (def.isBlock && def.renderType === 'cube') {
      // Map top/side tile from procedural tile canvases onto a crisp 6-material cube or single side texture
      const sideName = def.textures?.front || def.textures?.side || def.textures?.all || 'stone';
      const topName = def.textures?.top || def.textures?.all || sideName;
      const sideCanvas = this.textures.tiles[sideName];
      const topCanvas = this.textures.tiles[topName];

      const makeMat = (cnv, shade = 1.0, tint = null) => {
        const tex = new THREE.CanvasTexture(cnv);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        const col = new THREE.Color(shade, shade, shade);
        if (tint) col.multiply(new THREE.Color(tint[0], tint[1], tint[2]));
        return new THREE.MeshBasicMaterial({
          map: tex,
          color: col,
          transparent: Boolean(def.alphaTest || def.translucent),
          alphaTest: def.alphaTest ? 0.45 : 0,
          depthTest: false,
        });
      };

      const leafTint = def.tintType === 'leaf' ? [0.42, 0.78, 0.34] : null;
      const topTint = def.tintType === 'grass_top' ? [0.50, 0.84, 0.38] : leafTint;

      const mSide1 = makeMat(sideCanvas, 0.86, leafTint);
      const mSide2 = makeMat(sideCanvas, 0.72, leafTint);
      const mTop = makeMat(topCanvas, 1.0, topTint);
      const mBot = makeMat(sideCanvas, 0.55, leafTint);

      this.heldBlockMesh.material = [mSide2, mSide2, mTop, mBot, mSide1, mSide1];
      this.heldBlockMesh.visible = true;
    } else {
      const tex = this.getIconTex(cleanId);
      if (tex) {
        this.toolMat.map = tex;
        this.toolMat.needsUpdate = true;
        this.heldToolMesh.visible = true;
      } else {
        this.armMesh.visible = true;
      }
    }
  }

  updateTarget(rayHit, breakProgress = 0) {
    if (!rayHit) {
      this.highlightLine.visible = false;
      this.crackMesh.visible = false;
      return;
    }

    const yScale = rayHit.blockId === BLOCK.BED ? 0.5625 : 1.0;
    const centerY = rayHit.by + yScale * 0.5;

    this.highlightLine.scale.set(1, yScale, 1);
    this.highlightLine.position.set(rayHit.bx + 0.5, centerY, rayHit.bz + 0.5);
    this.highlightLine.visible = true;

    if (breakProgress > 0.02) {
      const stage = Math.min(5, Math.floor(breakProgress * 6));
      this.crackMat.map = this.textures.crackTextures[stage];
      this.crackMat.needsUpdate = true;
      this.crackMesh.scale.set(1, yScale, 1);
      this.crackMesh.position.set(rayHit.bx + 0.5, centerY, rayHit.bz + 0.5);
      this.crackMesh.visible = true;
    } else {
      this.crackMesh.visible = false;
    }
  }

  update(dt, moveSpeed, onGround, isMining) {
    if (isMining && this.swingTime <= 0.02) {
      this.swingTime = this.swingDuration;
    }

    if (this.swingTime > 0) {
      this.swingTime = Math.max(0, this.swingTime - dt);
    }

    if (onGround && moveSpeed > 0.3) {
      this.bobPhase += moveSpeed * dt * 2.1;
    } else {
      this.bobPhase *= 0.92;
    }

    const bobX = Math.cos(this.bobPhase) * 0.022;
    const bobY = Math.abs(Math.sin(this.bobPhase)) * -0.024;

    const swingProg = this.swingTime > 0 ? 1.0 - this.swingTime / this.swingDuration : 0;
    const swingArc = Math.sin(swingProg * Math.PI);

    this.handPivot.position.set(
      0.46 + bobX - swingArc * 0.14,
      -0.38 + bobY - swingArc * 0.08,
      -0.66 - swingArc * 0.12
    );
    this.handPivot.rotation.set(
      -swingArc * 0.78,
      swingArc * 0.32,
      swingArc * 0.25
    );
  }
}
