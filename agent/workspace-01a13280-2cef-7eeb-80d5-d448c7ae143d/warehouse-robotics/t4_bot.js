// A competent-but-simple player: buys upgrades when affordable, adds stations near pods,
// keeps a reserve, sets velocity slotting if unlocked. Measures whether the campaign is passable.
const h = require('./harness.js');
const WS = h.WS();
const sc = process.argv[2] || 'starter', df = process.argv[3] || 'normal';
const seeds = Number(process.argv[4] || 3);
const reserve = Number(process.argv[5] || 800);
const S = WS.SCENARIOS[sc];
function tryStation(g) {
  // candidates: floor tiles adjacent to an aisle, not occupied, close to pods
  const cands = [];
  for (let c = 0; c < g.N; c++) if (g.type[c] === 0 && !g.dir[c] && g.shelfAt[c] < 0 && g.occ[c] < 0) cands.push(c);
  cands.sort((a, b) => (g.distSt[a] - g.distSt[b]) || (a - b));
  for (const c of cands) {
    if (g.distSt[c] < 2) continue;
    const before = g.cash; g.cash = 1e9;
    const beforeLog = g.log.length;
    WS.applyBuild(c, 'station', false);
    const ok = g.type[c] === 3;
    g.cash = before - (ok ? 900 : 0) ;
    if (ok) return true;
    g.cash = before;
  }
  return false;
}
function tryCharger(g) {
  const cands = [];
  for (let c = 0; c < g.N; c++) if (g.type[c] === 0 && !g.dir[c] && g.shelfAt[c] < 0 && g.occ[c] < 0) cands.push(c);
  cands.sort((a, b) => (g.distSt[b] - g.distSt[a]) || (a - b));
  for (const c of cands.slice(0, 200)) {
    const before = g.cash; g.cash = 1e9;
    WS.applyBuild(c, 'charger', false);
    const ok = g.type[c] === 4;
    g.cash = before - (ok ? 450 : 0);
    if (ok) return true; g.cash = before;
  }
  return false;
}
function botTurn(g) {
  // spend in priority order while keeping reserve
  const order = ['tech', 'picker', 'robot', 'grid', 'pack', 'drive'];
  let guard = 0;
  while (guard++ < 30) {
    const bought = [];
    const before = g.cash;
    let did = false;
    if (g.stations.length < 2 && g.cash > reserve + 900 && g.t > 0 && sc !== 'starter' || (sc === 'starter' && g.shiftIdx >= 1 && g.stations.length < 2 && g.cash > reserve + 900)) {
      if (tryStation(g)) { did = true; }
    }
    if (!did && g.chargers.length < 2 + Math.floor(g.robots.length / 4) && g.cash > reserve + 450) { if (tryCharger(g)) did = true; }
    if (!did) for (const id of order) {
      const cost = WS.shopCost(id);
      if (g.cash - cost < reserve) continue;
      if (id === 'traffic' && g.trafficAI) continue;
      const lvlNow = lvl(g, id);
      const max = { robot: 16, grid: 6, pack: 3, drive: 2, picker: 2, tech: 3, traffic: 1 }[id];
      if (lvlNow >= max) continue;
      const before2 = g.robots.length;
      const cashBefore = g.cash;
      WS.buyShop(id);
      if (g.cash < cashBefore) { did = true; break; }
    }
    if (!did) break;
  }
}
function lvl(g, id) {
  if (id === 'robot') return g.robots.length;
  if (id === 'grid') return g.gridCap - S.gridCap;
  if (id === 'pack') return g.pack;
  if (id === 'drive') return g.drive;
  if (id === 'picker') return g.stations.reduce((a, s) => a + Math.max(0, s.workers - 1), 0);
  if (id === 'tech') return g.techs.length - S.techs;
  if (id === 'traffic') return g.trafficAI ? 1 : 0;
  return 0;
}
const res = [];
for (let sd = 1; sd <= seeds; sd++) {
  const g = WS.newGame(sc, df, 5000 + sd * 104729);
  WS.setCurrent(g);
  const line = [];
  let cleared = true;
  for (let si = 0; si < S.shifts.length; si++) {
    g.shiftIdx = si;
    WS.startShift(g, false);
    botTurn(g);
    let n = 0;
    while (!g.over && n < 3000) { WS.logicTick(g); n++; }
    const f = WS.computeFill(g);
    const tgt = S.shifts[si].target + WS.DIFFS[df].target;
    const pass = f.fill >= tgt && !(g.over && g.over.type === 'fail');
    line.push(`${(f.fill*100).toFixed(0)}/${(tgt*100).toFixed(0)}${pass?'✓':'✗'}[c${Math.round(g.cash/100)/10}k r${g.robots.length} s${g.stations.length} ch${g.chargers.length}]`);
    if (f.fill < 0.7) { const st={}; g.robots.forEach(r=>st[r.state]=(st[r.state]||0)+1); console.log(`  DIAG seed${sd} shift${si} fill=${(f.fill*100).toFixed(0)} dl=${g.stat.deadlocks} resolved=${g.stat.resolved} dlTicks=${g.stat.deadlockTicks} fails=${g.stat.fails} strand=${g.stat.strandings} gl=${g.gridlock.toFixed(1)} cycles=${g.cycles.length} states=${JSON.stringify(st)} lowPods=${g.shelves.filter(s=>s&&s.stock<s.cap*0.4).length} openOrders=${g.orders.filter(o=>o.status==='open').length} costs=${JSON.stringify(Object.fromEntries(Object.entries(g.stat.costs).map(([k,v])=>[k,Math.round(v)])))} rev=${Math.round(g.stat.revenue)} picks=${g.stat.picks} restocks=${g.stat.restocks} stations=${g.stations.map(x=>x.workers+'/'+x.fatigue.toFixed(2)).join(',')} brk=${g.breakUntil.toFixed(0)} rep=${g.rep.toFixed(0)} cash=${Math.round(g.cash)} over=${g.over&&g.over.type+':'+g.over.why}`); }
    if (!pass) { cleared = false; break; }
    g.over = null;
  }
  res.push(`seed${sd} ${cleared ? 'CLEAR' : 'FAIL '}: ` + line.join(' | '));
}
console.log(`${sc}/${df} reserve=${reserve}`); res.forEach(r => console.log('  ' + r));
console.log('errors', h.errors.length, h.errors.slice(0,2));
process.exit(0);
