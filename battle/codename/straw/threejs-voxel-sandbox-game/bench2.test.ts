import { World } from './src/game/world';

const w = new World(777);
for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) w.generateChunk(dx, dz);

// full-chunk relight repeated (steady state: light already correct)
{
  const t = performance.now(); const M = 40;
  for (let i = 0; i < M; i++) w.relightRegion(0, 0, 0, 15, 79, 15);
  console.log(`full-chunk relight (steady): ${((performance.now() - t) / M).toFixed(2)} ms`);
}
// full-chunk relight from zeroed light (like generation: queue must flood everywhere)
{
  const t = performance.now(); const M = 20;
  const c = w.getChunk(0, 0)!;
  for (let i = 0; i < M; i++) {
    c.light.fill(0);
    w.relightRegion(0, 0, 0, 15, 79, 15);
  }
  console.log(`full-chunk relight (from dark): ${((performance.now() - t) / M).toFixed(2)} ms`);
}
// narrow tall box (like deep edit)
{
  const t = performance.now(); const M = 40;
  for (let i = 0; i < M; i++) w.relightRegion(-8, 10, -8, 8, 40, 8, 0, 0);
  console.log(`deep edit relight 17x31x17: ${((performance.now() - t) / M).toFixed(2)} ms`);
}
