import { World } from './src/game/world';

const w = new World(777);
const N = 25;
const times: number[] = [];
for (let i = 0; i < N; i++) {
  const t = performance.now();
  w.generateChunk(i - 12, 3);
  times.push(performance.now() - t);
}
console.log('per-chunk gen ms:', times.map(t => t.toFixed(1)).join(' '));

// now relight one of those same chunks repeatedly (steady)
const c = w.getChunk(0, 3)!;
console.log('chunk(0,3) height range:', Math.min(...c.heightMap), Math.max(...c.heightMap));
{
  const t = performance.now(); const M = 40;
  for (let i = 0; i < M; i++) w.relightRegion(0, 0, 48, 15, 79, 63);
  console.log(`relight chunk(0,3) steady: ${((performance.now() - t) / M).toFixed(2)} ms`);
}
{
  const t = performance.now(); const M = 20;
  for (let i = 0; i < M; i++) { c.light.fill(0); w.relightRegion(0, 0, 48, 15, 79, 63); }
  console.log(`relight chunk(0,3) from dark: ${((performance.now() - t) / M).toFixed(2)} ms`);
}
