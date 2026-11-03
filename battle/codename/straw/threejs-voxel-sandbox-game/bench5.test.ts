import { World } from './src/game/world';

// warm up JIT thoroughly first
const warm = new World(4242);
for (let i = 0; i < 30; i++) warm.generateChunk(i - 15, 0);

const w = new World(777);
const times: number[] = [];
const N = 60;
for (let i = 0; i < N; i++) {
  const t = performance.now();
  w.generateChunk((i % 10) - 5, ((i / 10) | 0) - 3);
  times.push(performance.now() - t);
}
times.sort((a, b) => a - b);
const avg = times.reduce((s, t) => s + t, 0) / N;
console.log(`warm gen+light: avg ${avg.toFixed(2)} ms, median ${times[N >> 1].toFixed(2)} ms, p90 ${times[(N * 0.9) | 0].toFixed(2)} ms, max ${times[N - 1].toFixed(2)} ms`);

// edit-relight timing warm
{
  const t = performance.now(); const M = 80;
  for (let i = 0; i < M; i++) w.relightRegion(-15, 25, -15, 15, 55, 15, 0, 0);
  console.log(`warm edit relight: ${((performance.now() - t) / M).toFixed(2)} ms`);
}
