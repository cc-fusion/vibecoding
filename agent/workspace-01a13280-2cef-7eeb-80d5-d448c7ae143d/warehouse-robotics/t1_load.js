const h = require('./harness.js');
console.log('load errors:', h.errors.length, h.errors.slice(0,3));
console.log('raf queued:', h.rafQ.length);
const WS = h.WS();
console.log('WS exposed:', !!WS, Object.keys(WS||{}));
// click through UI: new campaign -> select -> launch
h.reg['#btnNew'].onclick();
h.reg['#btnLaunch'].onclick();
console.log('after launch errors:', h.errors.length, h.errors.slice(0,3));
const G = WS.state;
console.log('G', G && G.scn, G && G.diff, 'robots', G && G.robots.length, 'shelves', G && G.shelves.filter(s=>s).length, 'stations', G && G.stations.length, 'chargers', G && G.chargers.length, 'docks', G && G.docks.length, 'repairs', G && G.repairs.length, 'cash', G && G.cash);
// drive frames
let now = 1000;
const step = (n, dt) => { for (let i=0;i<n;i++){ now += dt; const q = h.rafQ.splice(0); q.forEach(f=>f(now)); } };
step(120, 16);
console.log('after 120 frames errors:', h.errors.length, h.errors.slice(0,3));
console.log('t after frames', WS.state.t.toFixed(2), 'orders', WS.state.orders.length, 'picks', WS.state.stat.picks);
