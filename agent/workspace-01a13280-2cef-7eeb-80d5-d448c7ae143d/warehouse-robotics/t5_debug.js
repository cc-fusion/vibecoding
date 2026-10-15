const h = require('./harness.js');
const WS = h.WS();
const sc = process.argv[2] || 'starter', df = 'normal', sd = Number(process.argv[3] || 2), si = Number(process.argv[4] || 1);
const g = WS.newGame(sc, df, 5000 + sd * 104729);
WS.setCurrent(g);
const S = WS.SCENARIOS[sc];
for (let k = 0; k <= si; k++) {
  g.shiftIdx = k; WS.startShift(g, false);
  let n = 0;
  if (k === si) {
    // print trace
    let lastPrint = -1;
    while (!g.over && n < 3000) {
      WS.logicTick(g); n++;
      if (Math.floor(g.t / 30) !== lastPrint) {
        lastPrint = Math.floor(g.t / 30);
        const st = {}; g.robots.forEach(r => st[r.state] = (st[r.state] || 0) + 1);
        const open = g.orders.filter(o => o.status === 'open').length;
        const f = WS.computeFill(g);
        console.log(`t=${g.t.toFixed(0)} fill=${(f.fill*100).toFixed(0)} open=${open} cash=${Math.round(g.cash)} rep=${g.rep.toFixed(0)} cyc=${g.cycles.length} gl=${g.gridlock.toFixed(0)} states=${JSON.stringify(st)} stations=${g.stations.map(s=>(s.occ>=0?'occ':'-')+'/'+s.workers+'/f'+s.fatigue.toFixed(2)).join(',')} brk=${g.breakUntil.toFixed(0)} dock=${g.docks.map(d=>d.blockedUntil.toFixed(0)).join(',')} haz=${g.hazard.filter(x=>x>1).length} lowPods=${g.shelves.filter(s=>s&&s.stock<s.cap*0.4).length} pend=${WS.pending ? '' : ''}`);
      }
    }
    console.log('costs', JSON.stringify(g.stat.costs), 'rev', g.stat.revenue, 'lost', g.stat.lost, 'late', g.stat.late, 'onTime', g.stat.onTime, 'fails', g.stat.fails);
    console.log('events', g.schedule.map(e => e.type + '@' + e.at).join(' '));
    console.log('log tail:', g.log.slice(0, 12).map(e => e.t + ' ' + e.text.slice(0, 90)).join('\n'));
  } else { while (!g.over && n < 3000) { WS.logicTick(g); n++; } g.over = null; }
}
process.exit(0);
