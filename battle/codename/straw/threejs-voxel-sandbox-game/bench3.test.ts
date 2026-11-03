import { World } from './src/game/world';

const w = new World(777);
let relightMs = 0;
const orig = w.relightRegion.bind(w);
(w as any).relightRegion = (...args: any[]) => {
  const t = performance.now();
  (orig as any)(...args);
  relightMs += performance.now() - t;
};
const N = 25;
const t = performance.now();
for (let i = 0; i < N; i++) w.generateChunk(i - 12, 3);
const total = performance.now() - t;
console.log(`total ${(total / N).toFixed(2)} ms/chunk, relight ${(relightMs / N).toFixed(2)} ms/chunk, rest ${((total - relightMs) / N).toFixed(2)} ms/chunk`);
