import {
  VoxelWorld,
  SimplexNoise,
  hashString,
  mulberry32,
  THREE,
} from "../engine/engine.js";
export const PALETTE = [
  "#000000",
  "#8aaa69",
  "#c3ba91",
  "#a9987a",
  "#7a8177",
  "#446a50",
  "#5d8458",
  "#705744",
  "#cfdbba",
  "#ece7dc",
  "#b7beb4",
  "#688878",
];
export const MATERIALS = [
  ["Meadow", "#8aaa69"],
  ["Sandstone", "#c3ba91"],
  ["Earth", "#a9987a"],
  ["Slate", "#7a8177"],
  ["Pine", "#446a50"],
  ["Foliage", "#5d8458"],
  ["Timber", "#705744"],
  ["Limestone", "#ece7dc"],
];
export function createScene(kind = "island", seed = "evergreen") {
  const world = new VoxelWorld(),
    noise = new SimplexNoise(hashString(seed)),
    random = mulberry32(hashString(seed));
  const heights = new Map(),
    waterTiles = [];
  if (kind === "island") {
    for (let x = -32; x < 32; x++)
      for (let z = -32; z < 32; z++) {
        const ridge =
          18 * Math.exp(-((x + 15) ** 2 / 190 + (z + 12) ** 2 / 290));
        const hill = 9 * Math.exp(-((x - 19) ** 2 / 160 + (z + 7) ** 2 / 300));
        const river = Math.abs(x - (6 * Math.sin(z * 0.085) + 2));
        let h = Math.floor(
          4 + ridge + hill + noise.fbm2(x * 0.047, z * 0.047, 3) * 4,
        );
        if (river < 5.5 || (z > 17 && Math.abs(x) < 16 + (z - 17) * 0.5))
          h = Math.min(h, Math.floor(-1 + river * 0.16));
        else if (river < 8) h = Math.min(h, 3);
        heights.set(`${x},${z}`, h);
        for (let y = -8; y <= h; y++) {
          let id = y === h ? (h < 3 ? 2 : h > 18 ? 4 : 1) : y > h - 3 ? 3 : 4;
          if (y < -3) id = y === -5 || y === -6 ? 3 : 4;
          world.set(x, y, z, id);
        }
        if (h < 2) waterTiles.push([x, z]);
      }
    const planted = [];
    for (let t = 0; t < 90; t++) {
      const x = Math.floor(random() * 58) - 29,
        z = Math.floor(random() * 58) - 29,
        h = heights.get(`${x},${z}`);
      if (
        h < 5 ||
        h > 18 ||
        planted.some((p) => Math.hypot(p[0] - x, p[1] - z) < 6) ||
        (z > 14 && x < 0)
      )
        continue;
      planted.push([x, z]);
      const tall = 5 + Math.floor(random() * 4);
      for (let y = h + 1; y < h + tall; y++) world.set(x, y, z, 7);
      for (let layer = 0; layer < 4; layer++) {
        const radius = 3 - Math.floor(layer * 0.7),
          base = h + 3 + layer * 2;
        for (let a = -radius; a <= radius; a++)
          for (let b = -radius; b <= radius; b++) {
            if (Math.abs(a) + Math.abs(b) > radius + 1) continue;
            world.set(x + a, base, z + b, layer % 2 ? 6 : 5);
            if (Math.abs(a) + Math.abs(b) <= radius)
              world.set(x + a, base + 1, z + b, layer % 2 ? 6 : 5);
          }
      }
      world.set(x, h + 11, z, 6);
    }
  } else if (kind === "pavilion") {
    const box = (ax, ay, az, bx, by, bz, id) => {
      for (let x = ax; x <= bx; x++)
        for (let y = ay; y <= by; y++)
          for (let z = az; z <= bz; z++) world.set(x, y, z, id);
    };
    box(-26, -8, -24, 25, -3, 23, 10);
    box(-24, -2, -22, 23, -1, 21, 9);
    box(-20, 0, -18, 19, 0, 17, 9);
    box(-16, 1, -15, 15, 1, 8, 9);
    for (const x of [-15, -5, 5, 15])
      for (const z of [-14, 6]) box(x, 2, z, x + 1, 16, z + 1, 9);
    box(-17, 17, -16, 18, 18, 9, 9);
    box(-16, 19, -15, 17, 19, 8, 10);
    for (let x = -12; x < 13; x++)
      for (let z = 11; z < 18; z++) {
        world.set(x, 0, z, 11);
        waterTiles.push([x, z]);
      }
    for (let i = 0; i < 5; i++) box(-7, -1, -22 - i, 8, 3 - i, -22 - i, 9);
    for (let x = -20; x <= 20; x += 40)
      for (let z = -18; z <= 16; z += 17) {
        box(x, 0, z, x + 2, 2, z + 2, 10);
        box(x, 3, z, x + 2, 6, z + 2, 6);
      }
  } else {
    for (let x = -24; x < 24; x++)
      for (let z = -24; z < 24; z++) {
        world.set(x, -8, z, 10);
        const i = Math.floor((x + 24) / 8),
          j = Math.floor((z + 24) / 8);
        if ((x + 24) % 8 < 5 && (z + 24) % 8 < 5)
          for (let y = -7; y < -5 + (i + j) * 2; y++)
            world.set(x, y, z, 1 + ((i + j) % 6));
      }
  }
  const level = kind === "pavilion" ? 1.05 : 2.05;
  return {
    world,
    water: createWater(waterTiles, level),
    waterSpec: { tiles: waterTiles, level },
  };
}
export function createWater(waterTiles, level) {
  const water = new THREE.Group();
  water.name = "Water surface";
  const positions = [],
    indices = [];
  for (const [x, z] of waterTiles) {
    const i = positions.length / 3;
    positions.push(
      x,
      level,
      z,
      x,
      level,
      z + 1,
      x + 1,
      level,
      z + 1,
      x + 1,
      level,
      z,
    );
    indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  if (positions.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({
      color: "#64b5b1",
      transparent: true,
      opacity: 0.8,
      roughness: 0.24,
      metalness: 0.18,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = true;
    water.add(mesh);
  }
  return water;
}
export function disposeGroup(group) {
  group.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  group.removeFromParent();
}
