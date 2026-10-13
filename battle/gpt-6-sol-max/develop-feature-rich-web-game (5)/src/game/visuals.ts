import * as THREE from "three";
import { BLOCKS, type BlockId, type MobType } from "./data";
import { ALTAR, type VoxelWorld } from "./world";

function textureFor(block: BlockId, face: "top" | "side") {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext("2d")!;
  const info = BLOCKS[block];
  const isSide = face === "side";
  ctx.fillStyle = isSide ? info.side || info.color : info.top || info.color;
  ctx.fillRect(0, 0, 16, 16);
  let seed = block.split("").reduce((v, c) => v * 31 + c.charCodeAt(0), face === "top" ? 41 : 83);
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };

  if (block === "wood" || block === "pineWood" || block === "plank" || block === "workbench") {
    for (let i = 0; i < 16; i += block === "plank" ? 5 : 3) {
      ctx.fillStyle = "rgba(42,26,17,.21)";
      if (block === "wood" || block === "pineWood") ctx.fillRect(i, 0, 1, 16);
      else ctx.fillRect(0, i, 16, 1);
    }
    if (block === "workbench") {
      ctx.strokeStyle = "#60442f";
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, 12, 12);
      ctx.beginPath(); ctx.moveTo(8, 2); ctx.lineTo(8, 14); ctx.moveTo(2, 8); ctx.lineTo(14, 8); ctx.stroke();
    }
  }
  if (block === "farmland") {
    for (let x = 2; x < 16; x += 4) { ctx.fillStyle = "rgba(23,17,9,.28)"; ctx.fillRect(x, 0, 1, 16); }
  }
  if (block === "bed") {
    if (!isSide) { ctx.fillStyle = "#e4d6b7"; ctx.fillRect(2, 2, 12, 4); ctx.fillStyle = "#c2756e"; ctx.fillRect(2, 7, 12, 7); }
  }
  if (block === "furnace") {
    ctx.fillStyle = "#414647"; ctx.fillRect(3, 7, 10, 7);
    ctx.fillStyle = "#c7794a"; ctx.fillRect(5, 11, 6, 2);
    ctx.fillStyle = "#bfc0af"; ctx.fillRect(3, 3, 10, 2);
  }
  if (block === "enchanter") {
    ctx.fillStyle = "#29283e"; ctx.fillRect(2, 2, 12, 12);
    ctx.fillStyle = "#b796db"; ctx.fillRect(7, 3, 2, 9); ctx.fillRect(4, 7, 8, 2);
    ctx.fillStyle = "#e1b585"; ctx.fillRect(7, 6, 2, 2);
  }
  for (let i = 0; i < (block === "leaves" || block === "pineLeaves" ? 55 : 74); i++) {
    const x = Math.floor(rand() * 16);
    const y = Math.floor(rand() * 16);
    ctx.fillStyle = rand() > 0.54 ? "rgba(255,246,197,.13)" : "rgba(17,35,38,.13)";
    ctx.fillRect(x, y, rand() > 0.8 ? 2 : 1, rand() > 0.7 ? 2 : 1);
  }
  if (isSide && ["grass", "pineGrass", "snow"].includes(block)) {
    ctx.fillStyle = info.color;
    ctx.fillRect(0, 0, 16, block === "snow" ? 4 : 3);
    for (let i = 0; i < 9; i++) ctx.fillRect(Math.floor(rand() * 16), 3, 1, 1 + Math.floor(rand() * 3));
  }
  if (["coalOre", "ironOre", "diamondOre"].includes(block)) {
    const gem = block === "coalOre" ? "#27323a" : block === "ironOre" ? "#c67d54" : "#7febdf";
    const dark = block === "coalOre" ? "#4c5558" : block === "ironOre" ? "#6d5c55" : "#327d85";
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(rand() * 13) + 1; const y = Math.floor(rand() * 13) + 1;
      ctx.fillStyle = dark; ctx.fillRect(x - 1, y - 1, 4, 4);
      ctx.fillStyle = gem; ctx.fillRect(x, y, 2, 2);
    }
  }
  if (block === "basalt") {
    for (let i = 0; i < 9; i++) { ctx.fillStyle = "#b87558"; ctx.fillRect(Math.floor(rand() * 16), Math.floor(rand() * 16), 1, 1); }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createBlockMaterials() {
  const materials = {} as Record<BlockId, THREE.Material | THREE.Material[]>;
  const textures: THREE.Texture[] = [];
  (Object.keys(BLOCKS) as BlockId[]).forEach((block) => {
    if (block === "water") {
      materials[block] = new THREE.MeshPhongMaterial({ color: 0x63afbb, transparent: true, opacity: 0.69, shininess: 80, depthWrite: false });
    } else if (block === "glass") {
      materials[block] = new THREE.MeshPhongMaterial({ color: 0xb6dad5, transparent: true, opacity: 0.68, shininess: 90, depthWrite: false });
    } else if (block === "torch") {
      materials[block] = new THREE.MeshBasicMaterial({ color: 0xf9b967 });
    } else {
      const top = textureFor(block, "top");
      const side = textureFor(block, "side");
      textures.push(top, side);
      const topMat = new THREE.MeshLambertMaterial({ map: top, emissive: block === "diamondOre" ? 0x073737 : block === "enchanter" ? 0x181023 : 0x000000 });
      const sideMat = new THREE.MeshLambertMaterial({ map: side, emissive: block === "diamondOre" ? 0x062e2e : 0x000000 });
      materials[block] = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
    }
  });
  return {
    materials,
    dispose: () => {
      textures.forEach((t) => t.dispose());
      const seen = new Set<THREE.Material>();
      Object.values(materials).forEach((entry) => (Array.isArray(entry) ? entry : [entry]).forEach((mat) => { if (!seen.has(mat)) { mat.dispose(); seen.add(mat); } }));
    },
  };
}

export class VisualKit {
  private colors = new Map<string, THREE.MeshLambertMaterial>();
  private emissives = new Map<string, THREE.MeshBasicMaterial>();

  mat(color: string) {
    if (!this.colors.has(color)) this.colors.set(color, new THREE.MeshLambertMaterial({ color }));
    return this.colors.get(color)!;
  }
  glow(color: string) {
    if (!this.emissives.has(color)) this.emissives.set(color, new THREE.MeshBasicMaterial({ color }));
    return this.emissives.get(color)!;
  }
  box(parent: THREE.Group, w: number, h: number, d: number, color: string, x: number, y: number, z: number, lit = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lit ? this.mat(color) : this.glow(color));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  mob(type: MobType) {
    const group = new THREE.Group();
    const b = (w: number, h: number, d: number, c: string, x: number, y: number, z: number, lit = true) => this.box(group, w, h, d, c, x, y, z, lit);
    if (type === "zombie" || type === "skeleton" || type === "enderman") {
      const isEnd = type === "enderman";
      const isSkel = type === "skeleton";
      const skin = isEnd ? "#252634" : isSkel ? "#dad6c3" : "#6f9a74";
      const shirt = isEnd ? "#252634" : isSkel ? "#b2b2a2" : "#667e85";
      const leg = isEnd ? "#252634" : isSkel ? "#c6c7b4" : "#4f6375";
      b(isEnd ? .65 : .85, isEnd ? 1.05 : .82, .42, shirt, 0, isEnd ? 1.55 : 1.04, 0);
      b(isEnd ? .56 : .72, isEnd ? .65 : .68, .59, skin, 0, isEnd ? 2.38 : 1.83, -.02);
      b(.22, isEnd ? 1.35 : .65, .25, skin, -.54, isEnd ? 1.42 : 1.03, 0);
      b(.22, isEnd ? 1.35 : .65, .25, skin, .54, isEnd ? 1.42 : 1.03, 0);
      b(.29, isEnd ? 1.05 : .67, .32, leg, -.22, isEnd ? .52 : .34, 0);
      b(.29, isEnd ? 1.05 : .67, .32, leg, .22, isEnd ? .52 : .34, 0);
      const eye = isEnd ? "#b58bdf" : isSkel ? "#313b43" : "#d1c9a4";
      b(.13, .10, .025, eye, -.17, isEnd ? 2.42 : 1.9, -.325, false);
      b(.13, .10, .025, eye, .17, isEnd ? 2.42 : 1.9, -.325, false);
      if (isSkel) b(.31, .12, .06, "#464948", 0, 1.64, -.33);
    } else if (type === "creeper") {
      b(.67, 1.38, .59, "#719568", 0, 1.03, 0);
      for (const x of [-.23, .23]) for (const z of [-.18, .18]) b(.24, .42, .3, "#577f5b", x, .21, z);
      b(.16, .19, .025, "#243e39", -.17, 1.43, -.31);
      b(.16, .19, .025, "#243e39", .17, 1.43, -.31);
      b(.21, .3, .025, "#243e39", 0, 1.09, -.31);
    } else if (type === "spider") {
      b(.92, .38, 1.1, "#393b47", 0, .41, .15);
      b(.64, .43, .56, "#4d454d", 0, .46, -.63);
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
        const legBox = b(.52, .11, .12, "#393b47", s * .63, .38, -.59 + i * .35);
        legBox.rotation.z = s * .35;
      }
      for (const x of [-.19, 0, .19]) b(.095, .095, .025, "#d66c63", x, .53, -.923, false);
    } else {
      const palette = type === "pig" ? ["#d8958b", "#bf7975"] : type === "cow" ? ["#d4c9aa", "#746958"] : type === "sheep" ? ["#eee8d7", "#a99b8a"] : ["#d6b472", "#b48559"];
      const small = type === "chicken";
      b(small ? .54 : 1.04, small ? .55 : .83, small ? .62 : 1.33, palette[0], 0, small ? .52 : .78, .12);
      b(small ? .39 : .69, small ? .4 : .63, small ? .39 : .65, palette[1], 0, small ? .93 : 1.12, -.66);
      for (const x of [-.33, .33]) for (const z of [-.32, .48]) b(small ? .12 : .22, small ? .27 : .48, small ? .12 : .21, palette[1], x * (small ? .6 : 1), small ? .14 : .26, z * (small ? .7 : 1));
      for (const x of [-.17, .17]) b(.09, .09, .025, "#272f32", x, small ? .98 : 1.22, small ? -.87 : -1.0, false);
      if (type === "cow") { b(.39, .42, .04, "#766b5b", -.28, .8, -.57); b(.23, .34, .04, "#766b5b", .3, 1.01, .32); }
      if (type === "pig") b(.3, .21, .1, "#ad6867", 0, 1.03, -1.02);
      if (type === "chicken") b(.22, .14, .17, "#e4a35f", 0, .85, -.93);
    }
    return group;
  }

  dragon() {
    const group = new THREE.Group();
    const b = (w: number, h: number, d: number, c: string, x: number, y: number, z: number, lit = true) => this.box(group, w, h, d, c, x, y, z, lit);
    b(1.5, .9, 2.1, "#353445", 0, 0, 0);
    b(.96, .76, .96, "#424052", 0, .05, -1.45);
    b(.67, .31, .8, "#383544", 0, -.25, -1.9);
    for (const x of [-.28, .28]) b(.19, .13, .05, "#ff9d73", x, .2, -1.95, false);
    b(.55, .38, .8, "#373342", 0, -.08, 1.45);
    b(.3, .25, .72, "#4d3d4a", 0, -.05, 2.16);
    for (const x of [-.7, .7]) { b(.22, .74, .28, "#343444", x, -.63, .49); b(.24, .67, .29, "#343444", x, -.62, -.57); }
    for (let i = 0; i < 5; i++) b(.23, .26, .25, "#ae675b", 0, .58, -1 + i * .49);
    const wings: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * .7, .23, .1);
      const outer = this.box(wing, 2.5, .13, 1.7, "#51404e", side * 1.18, 0, .12);
      outer.rotation.y = side * .17;
      this.box(wing, 1.55, .04, 1.22, "#a46060", side * 1.35, -.09, .18);
      this.box(wing, .27, .22, 2.1, "#383444", side * 1.8, .06, -.08);
      group.add(wing);
      wings.push(wing);
    }
    return { group, wings };
  }

  altar(world: VoxelWorld) {
    const group = new THREE.Group();
    group.position.set(ALTAR.x, world.surfaceY(ALTAR.x, ALTAR.z), ALTAR.z);
    const stone = this.mat("#343b43");
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.58, .27, 8), stone);
    ring.position.y = .04; group.add(ring);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(1.58, 1.58, .31, 8), this.mat("#574e50"));
    inner.position.y = .12; group.add(inner);
    this.box(group, .9, 2.65, .9, "#353c45", 0, 1.5, 0);
    this.box(group, 1.13, .32, 1.13, "#4e5559", 0, 2.95, 0);
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2 + Math.PI / 4;
      this.box(group, .33, .96, .33, "#40474c", Math.sin(angle) * 1.72, .55, Math.cos(angle) * 1.72);
    }
    for (const x of [-.23, .23]) {
      this.box(group, .09, 1.46, .035, "#e9a56c", x, 1.63, -.48, false);
      this.box(group, .09, .48, .035, "#f4c184", x, 2.32, -.49, false);
    }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.13, .4, 65, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xf3b674, transparent: true, opacity: .105, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 34; group.add(beam);
    const light = new THREE.PointLight(0xffaa6a, 3, 15, 2);
    light.position.y = 2.7; group.add(light);
    return { group, beam, light };
  }

  disposeGroup(group: THREE.Object3D) {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    });
  }

  dispose() {
    this.colors.forEach((mat) => mat.dispose());
    this.emissives.forEach((mat) => mat.dispose());
  }
}

export function createSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uDay: { value: 1 }, uWarm: { value: 0 } },
    vertexShader: `varying vec3 vPosition; void main(){vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);}`,
    fragmentShader: `
      varying vec3 vPosition;
      uniform float uDay;
      uniform float uWarm;
      void main(){
        float h = normalize(vPosition).y;
        float t = smoothstep(-0.18, 0.82, h);
        vec3 day = mix(vec3(0.77,0.82,0.72), vec3(0.25,0.52,0.65), t);
        vec3 night = mix(vec3(0.16,0.23,0.28), vec3(0.025,0.055,0.11), t);
        vec3 sky = mix(night, day, uDay);
        sky = mix(sky, vec3(0.91,0.42,0.30), uWarm * (1.0 - t) * 0.48);
        gl_FragColor = vec4(sky, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(145, 24, 16), material);
  mesh.frustumCulled = false;
  return { mesh, material };
}