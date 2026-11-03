// Job handler shared by the Web Worker and the main-thread fallback.
import { Terrain } from './terrain';
import { meshChunk, type GeoData } from './mesher';

let terrain: Terrain | null = null;

const bufs = (g: GeoData | null, out: ArrayBuffer[]) => {
  if (g) out.push(g.pos.buffer as ArrayBuffer, g.uv.buffer as ArrayBuffer, g.col.buffer as ArrayBuffer, g.lit.buffer as ArrayBuffer, g.idx.buffer as ArrayBuffer);
};

export function handleJob(msg: any): { res: any; transfer: ArrayBuffer[] } {
  if (msg.type === 'gen') {
    if (!terrain || terrain.seed !== msg.seed) terrain = new Terrain(msg.seed);
    const g = terrain.generate(msg.cx, msg.cz);
    return {
      res: { type: 'gen', id: msg.id, cx: msg.cx, cz: msg.cz, ...g },
      transfer: [g.blocks.buffer as ArrayBuffer, g.biome.buffer as ArrayBuffer, g.climate.buffer as ArrayBuffer, g.hm.buffer as ArrayBuffer],
    };
  }
  const m = meshChunk(msg);
  const transfer: ArrayBuffer[] = [];
  bufs(m.opaque, transfer);
  bufs(m.water, transfer);
  return { res: { type: 'mesh', id: msg.id, cx: msg.cx, cz: msg.cz, ...m }, transfer };
}
