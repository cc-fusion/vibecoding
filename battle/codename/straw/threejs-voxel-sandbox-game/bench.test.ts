// Quick phase timing for chunk generation
import { World } from './src/game/world';

const N = 25;
// full pipeline
{
  const w = new World(777);
  const t = performance.now();
  for (let i = 0; i < N; i++) w.generateChunk(i - 12, 3);
  console.log(`full gen+light: ${((performance.now() - t) / N).toFixed(2)} ms/chunk`);
}
// without relight
{
  const w = new World(777);
  (w as any).relightRegion = () => {};
  const t = performance.now();
  for (let i = 0; i < N; i++) w.generateChunk(i - 12, 3);
  console.log(`gen only (no relight): ${((performance.now() - t) / N).toFixed(2)} ms/chunk`);
}
// relight alone on generated chunks (edit-sized box like setBlock)
{
  const w = new World(777);
  for (let i = 0; i < 9; i++) w.generateChunk((i % 3) - 1, ((i / 3) | 0) - 1);
  const t = performance.now();
  const M = 60;
  for (let i = 0; i < M; i++) w.relightRegion(-16, 24, -16, 16, 56, 16);
  console.log(`edit relight (33x33x33 box): ${((performance.now() - t) / M).toFixed(2)} ms`);
}
