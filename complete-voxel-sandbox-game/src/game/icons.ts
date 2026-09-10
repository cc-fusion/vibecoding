// Renders inventory icons (isometric cubes for blocks, flat sprites for items) to data URLs.
import { BLOCKS, isBlock, itemTexture } from "./blocks";
import { getAtlas, TILE, ATLAS_COLS } from "./textures";

const cache = new Map<number, string>();

function tileRect(name: string): [number, number] {
  const idx = getAtlas().index.get(name) ?? 0;
  return [(idx % ATLAS_COLS) * TILE, Math.floor(idx / ATLAS_COLS) * TILE];
}

export function iconFor(id: number): string {
  const c = cache.get(id);
  if (c) return c;
  const atlas = getAtlas();
  const S = 64;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  const flat = (name: string) => {
    const [sx, sy] = tileRect(name);
    ctx.drawImage(atlas.canvas, sx, sy, TILE, TILE, 4, 4, S - 8, S - 8);
  };

  if (isBlock(id) && BLOCKS[id].model !== "cross") {
    const def = BLOCKS[id];
    const w = 26, h = 13, sh = 30;
    const cx = S / 2, y0 = 4;
    const face = (name: string, m: [number, number, number, number, number, number], shade: number) => {
      const [sx, sy] = tileRect(name);
      ctx.save();
      ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      ctx.drawImage(atlas.canvas, sx, sy, TILE, TILE, 0, 0, TILE, TILE);
      if (shade > 0) {
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = `rgba(0,0,0,${shade})`;
        ctx.fillRect(0, 0, TILE, TILE);
      }
      ctx.restore();
    };
    face(def.tex[2], [w / TILE, h / TILE, -w / TILE, h / TILE, cx, y0], 0);
    face(def.tex[1], [w / TILE, h / TILE, 0, sh / TILE, cx - w, y0 + h], 0.22);
    face(def.tex[4], [w / TILE, -h / TILE, 0, sh / TILE, cx, y0 + 2 * h], 0.4);
  } else {
    flat(itemTexture(id));
  }
  const url = canvas.toDataURL();
  cache.set(id, url);
  return url;
}
