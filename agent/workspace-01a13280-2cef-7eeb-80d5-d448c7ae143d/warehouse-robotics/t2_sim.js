const h = require('./harness.js');
const WS = h.WS();
const scns = (process.argv[2] || 'starter,midmarket,megahub').split(',');
const diffs = (process.argv[3] || 'normal').split(',');
const seeds = Number(process.argv[4] || 1);
const N_TICKS = 3000;
for (const sc of scns) for (const df of diffs) {
  const rows = [];
  for (let sd = 1; sd <= seeds; sd++) {
    const g = WS.newGame(sc, df, 1000 + sd * 7919);
    WS.startShift(g, false);
    let t0 = Date.now();
    let ticks = 0;
    let thr = null;
    try {
      while (!g.over && ticks < N_TICKS) {
        WS.logicTick(g); ticks++;
        if (g.schedule.length === 0 && false) break;
      }
    } catch (e) { console.log('EXC', sc, df, e.stack); process.exit(1); }
    const f = WS.computeFill(g);
    const st = g.stat;
    const costs = Object.values(st.costs).reduce((a,b)=>a+b,0);
    rows.push({ sd, fill: f.fill, cash: g.cash, rep: g.rep, created: st.created, onTime: st.onTime, late: st.late, lost: st.lost,
      picks: st.picks, restocks: st.restocks, dl: st.deadlocks, fails: st.fails, strand: st.strandings, util: st.busyTicks/Math.max(1,st.robotTicks),
      profit: st.revenue - costs, over: g.over ? g.over.type + ':' + (g.over.why||'') : '-', gridlock: g.gridlock.toFixed(1), ms: Date.now()-t0, sched: g.schedule.map(e=>e.type+'@'+e.at).join(' ') });
  }
  const avg = k => rows.reduce((a,r)=>a+(typeof r[k]==='number'?r[k]:0),0)/rows.length;
  console.log(`== ${sc} ${df} (target ${(WS.SCENARIOS[sc].shifts[0].target*100).toFixed(0)}%)`);
  for (const r of rows) console.log(`  s${r.sd} fill=${(r.fill*100).toFixed(1)}% cash=${Math.round(r.cash)} rep=${r.rep.toFixed(0)} created=${r.created} ontime=${r.onTime} late=${r.late} lost=${r.lost} picks=${r.picks} restock=${r.restocks} dl=${r.dl} fail=${r.fails} strand=${r.strand} util=${(r.util*100).toFixed(0)}% profit=${Math.round(r.profit)} over=${r.over} gl=${r.gridlock} ms=${r.ms}`);
  console.log(`  sched: ${rows[0].sched}`);
}
console.log('errors:', h.errors.length, h.errors.slice(0,2));
process.exit(0);
