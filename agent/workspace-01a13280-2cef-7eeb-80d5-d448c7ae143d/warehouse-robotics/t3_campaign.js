const h = require('./harness.js');
const WS = h.WS();
const sc = process.argv[2] || 'starter', df = process.argv[3] || 'normal';
const seeds = Number(process.argv[4] || 3);
const S = WS.SCENARIOS[sc];
const out = [];
for (let sd = 1; sd <= seeds; sd++) {
  const g = WS.newGame(sc, df, 5000 + sd * 104729);
  const line = [];
  for (let si = 0; si < S.shifts.length; si++) {
    g.shiftIdx = si;
    WS.startShift(g, false);
    let n = 0;
    while (!g.over && n < 3000) { WS.logicTick(g); n++; }
    const f = WS.computeFill(g);
    const tgt = S.shifts[si].target + WS.DIFFS[df].target;
    line.push(`${(f.fill*100).toFixed(0)}/${(tgt*100).toFixed(0)}${g.over && g.over.type==='fail' ? '✗'+g.over.why : (f.fill>=tgt?'✓':'✗')} cash=${Math.round(g.cash)} dl=${g.stat.deadlocks} fl=${g.stat.fails} cr=${g.stat.created} lost=${g.stat.lost}`);
    if (g.over) break;
    g.over = null;
  }
  console.log(`seed${sd}: ` + line.join(' | '));
}
console.log('errors', h.errors.length, h.errors.slice(0,2));
process.exit(0);
