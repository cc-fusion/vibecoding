const h = require('./harness.js');
const WS = h.WS();
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
// 1. layout validation on midmarket (choke gap at x=14,15 on row 7)
let g = WS.newGame('midmarket', 'normal', 42); WS.setCurrent(g);
const cell = (x, y) => y * g.W + x;
g.cash = 99999;
WS.applyBuild(cell(1, 7), 'wall', false);
WS.applyBuild(cell(28, 7), 'wall', false);
ok(g.type[cell(1, 7)] === 1 && g.type[cell(28, 7)] === 1, 'side openings can be walled while a route remains');
WS.applyBuild(cell(14, 7), 'wall', false);
ok(g.type[cell(14, 7)] === 1, 'single wall in the choke gap is allowed (alternate route exists)');
const cashBefore = g.cash;
WS.applyBuild(cell(15, 7), 'wall', false);
ok(g.type[cell(15, 7)] === 0, 'closing the last gap is refused (would trap the floor)');
ok(WS.layoutProblem(g) === null, 'layout still valid after refusal');
// 2. one-way lane cycling and clearing
WS.applyBuild(cell(5, 2), 'oneway', false);
ok(g.dir[cell(5, 2)] === 1, 'one-way lane first click sets N');
WS.applyBuild(cell(5, 2), 'oneway', false);
ok(g.dir[cell(5, 2)] === 2, 'second click rotates to E');
WS.applyBuild(cell(5, 2), 'oneway', true);
ok(g.dir[cell(5, 2)] === 0, 'right-click clears the lane');
// 3. facility placement & removal limits
const cashB = g.cash, nSt = g.stations.length;
WS.applyBuild(cell(20, 4), 'station', false);
ok(g.stations.length === nSt + 1 && g.cash === cashB - 900, 'station placed and charged $900');
WS.applyBuild(cell(20, 4), 'erase', false);
ok(g.stations.length === nSt && g.type[cell(20, 4)] === 0, 'station erased');
// cannot erase last station
const stBefore = g.stations.length;
g.stations.slice(1).forEach(s => { g.type[s.cell] = 0; });
g.stations = g.stations.slice(0, 1);
WS.applyBuild(g.stations[0].cell, 'erase', false);
ok(g.stations.length === 1, 'last pick station cannot be removed');
// 4. pod placement & erase
WS.applyBuild(cell(20, 3), 'store', false);
ok(g.shelves.filter(s => s).length >= 1 && g.type[cell(20, 3)] === 2, 'pod placed');
WS.applyBuild(cell(20, 3), 'erase', false);
ok(g.type[cell(20, 3)] === 0 && g.shelfAt[cell(20, 3)] < 0, 'empty pod erased');
// 5. spill blocks, then clears
g.t = 1; // ensure event handling
let pre = g.hazard.filter(x => x).length;
// place hazard manually via the event path: pick a floor cell in open area
const hc = cell(10, 3); g.hazard[hc] = g.t + 1; 
for (let i = 0; i < 20; i++) WS.logicTick(g);
ok(g.hazard[hc] === 0, 'spill clears after its timer');
// 6. save / restore roundtrip
let g2 = WS.newGame('starter', 'normal', 7); WS.setCurrent(g2); WS.startShift(g2, false);
for (let i = 0; i < 400; i++) WS.logicTick(g2);
const snap = JSON.stringify(g2);
const back = JSON.parse(snap);
WS.setCurrent(back);
for (let i = 0; i < 400; i++) WS.logicTick(back);
ok(back.t > 40 && back.robots.length === g2.robots.length, 'save/restore roundtrip continues simulating (' + snap.length + ' bytes)');
// 7. determinism: same seed yields identical result
const runA = WS.newGame('starter', 'normal', 99); WS.setCurrent(runA); WS.startShift(runA, false);
for (let i = 0; i < 800; i++) WS.logicTick(runA);
const runB = WS.newGame('starter', 'normal', 99); WS.setCurrent(runB); WS.startShift(runB, false);
for (let i = 0; i < 800; i++) WS.logicTick(runB);
ok(runA.stat.picks === runB.stat.picks && Math.abs(runA.cash - runB.cash) < 1e-6, 'seeded runs are reproducible (picks ' + runA.stat.picks + ')');
// 8. bankruptcy
let g3 = WS.newGame('starter', 'normal', 3); WS.setCurrent(g3); WS.startShift(g3, false);
g3.cash = -3000; WS.logicTick(g3);
ok(g3.over && g3.over.type === 'fail' && g3.over.why === 'bankrupt', 'deep negative cash triggers bankruptcy');
// 9. gridlock
let g4 = WS.newGame('starter', 'normal', 4); WS.setCurrent(g4); WS.startShift(g4, false);
for (let i = 0; i < 40; i++) WS.logicTick(g4);
g4.robots.forEach(r => { r.moveCd = 1e6; });
let guard = 0; while (!g4.over && guard++ < 4000) WS.logicTick(g4);
ok(g4.over && g4.over.why === 'gridlock', 'frozen fleet triggers gridlock after ~25 min (' + (g4.t).toFixed(0) + ' min)');
// 10. shift end pass -> report state, and victory on final shift
let g5 = WS.newGame('starter', 'normal', 11); WS.setCurrent(g5); WS.startShift(g5, false);
g5.shiftIdx = 0;
let n5 = 0; while (!g5.over && n5++ < 3500) WS.logicTick(g5);
ok(g5.over && (g5.over.type === 'shift' || g5.over.why === 'breach'), 'shift ends at 300 min (' + (g5.over.type) + ', fill ' + (g5.over.fill*100).toFixed(0) + '%)');
let g5b = WS.newGame('starter', 'normal', 13); WS.setCurrent(g5b); WS.startShift(g5b, false);
for (let k = 0; k < 30; k++) g5b.orders.push({ id: 8000 + k, created: 0, due: 100, lines: [], left: 0, status: 'shipped', value: 100, pastDue: false, shipT: 10 });
let n5b = 0; while (!g5b.over && n5b++ < 3500) WS.logicTick(g5b);
ok(g5b.over && g5b.over.type === 'shift' && g5b.over.pass === true && g5b.over.rp >= 2, 'passing shift yields a shift report with RP (stars ' + g5b.over.stars + ')');
// 11. breach: force orders to be lost at shift end
let g6 = WS.newGame('starter', 'normal', 12); WS.setCurrent(g6); WS.startShift(g6, false);
for (let i = 0; i < 1000; i++) WS.logicTick(g6);
for (let k = 0; k < 20; k++) g6.orders.push({ id: 9000 + k, created: 0, due: 1, lines: [], left: 0, status: 'lost', value: 0, pastDue: true, shipT: -1 });
g6.t = 299.9; let n6 = 0; while (!g6.over && n6++ < 20) WS.logicTick(g6);
ok(g6.over && g6.over.type === 'fail' && g6.over.why === 'breach', 'missing the shift target triggers contract breach');
console.log('errors:', h.errors.length, h.errors.slice(0, 2));
process.exit(0);
