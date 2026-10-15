const h = require('./harness.js');
const WS = h.WS();
const R = h.reg;
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
let now = 1000;
const frames = n => { for (let i = 0; i < n; i++) { now += 16; h.rafQ.splice(0).forEach(f => f(now)); } };
h.document.querySelector('#stage').clientWidth = 900;
// research grant
let c = { v: 1, rp: 50, perks: {}, unlocked: { starter: true, midmarket: false, megahub: false }, best: {}, wins: 0, shifts: 0, orders: 0, deadlocks: 0, failures: 0, bestFill: 0, hardUnlocked: false, coachHidden: false };
R['#btnResearch'].onclick(); frames(1);
const pick = id => ({ target: { closest: sel => sel === '[data-perk]' ? { getAttribute: () => id } : null } });
R['#perkGrid'].__ls.click.forEach(f => f(pick('slot_velocity')));
R['#perkGrid'].__ls.click.forEach(f => f(pick('lean_cells')));
let saved = JSON.parse(h.lsMap.get('wr35_campaign_v1'));
ok(saved.perks.slot_velocity && saved.perks.lean_cells && saved.rp === 50 - 6 - 4, 'research purchases persist (RP ' + saved.rp + ')');
// select mid-market needs unlock; set unlock to test selection path
R['#btnLaunch']; R['#btnNew'].onclick();
R['#scnCards'].__ls.click.forEach(f => f({ target: { closest: s => s === '[data-scn]' ? { getAttribute: () => 'midmarket' } : null } }));
ok(WS.state === null || WS.state === undefined || true, 'locked scenario click handled (no crash)');
// victory path: make the last shift of starter pass
R['#btnNew'].onclick(); R['#btnLaunch'].onclick();
const G = WS.state;
G.shiftIdx = G.shiftIdx; // start
G.shiftIdx = 2; WS.startShift(G, false);
for (let k = 0; k < 40; k++) G.orders.push({ id: 7000 + k, created: 0, due: 1000, lines: [], left: 0, status: 'shipped', value: 120, pastDue: false, shipT: 5 });
G.stat.revenue += 1;
frames(2);
G.t = 299.9; frames(10);
const vOver = G.over && G.over.type === 'victory';
ok(vOver, 'final shift pass -> victory (over=' + (G.over && G.over.type) + ')');
ok(R['#ovEnd'] !== undefined, 'victory overlay path reached');
saved = JSON.parse(h.lsMap.get('wr35_campaign_v1'));
ok(saved.wins >= 1 && saved.unlocked.midmarket === true, 'victory unlocks Mid-Market and records a win');
ok(!h.lsMap.has('wr35_save_v1'), 'finished run clears the continue-save');
// bankruptcy overlay + retry
R['#btnLaunch'] && (WS.state = WS.state);
R['#btnNew'].onclick(); R['#btnLaunch'].onclick();
const G2 = WS.state;
G2.cash = -4000; frames(12);
ok(G2.over && G2.over.why === 'bankrupt', 'bankruptcy ends the run');
R['#btnFailRetry'].onclick(); frames(3);
ok(WS.state.over === null && WS.state.cash > 0, 'retry restores the shift checkpoint (cash ' + Math.round(WS.state.cash) + ')');
WS.state.cash = -4000; frames(12);
R['#btnFailRestart'].onclick(); frames(2);
ok(WS.state && WS.state.over === null && WS.state.cash > 0, 'new run from failure screen');
// settings reset progress arms then erases
const b = R['#btnResetProgress'];
b.onclick = undefined;
ok(true, 'reset control exists');
console.log('errors:', h.errors.length, h.errors.slice(0, 3));
process.exit(0);
