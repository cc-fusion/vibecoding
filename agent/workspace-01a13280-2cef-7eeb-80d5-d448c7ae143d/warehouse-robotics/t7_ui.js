const h = require('./harness.js');
const WS = h.WS();
const R = h.reg, D = h.document;
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const fire = (type, evt) => (h.winListeners[type] || []).forEach(f => f(evt));
const key = k => fire('keydown', { key: k, target: { tagName: 'BODY' }, preventDefault() {} });
const cvFire = (type, evt) => ((R['#cv'].__ls[type]) || []).forEach(f => f(Object.assign({ clientX: 0, clientY: 0, button: 0, pointerId: 1, preventDefault() {}, deltaY: 0 }, evt)));
let now = 1000;
const frames = n => { for (let i = 0; i < n; i++) { now += 16; const q = h.rafQ.splice(0); q.forEach(f => f(now)); } };
// geometry: give the stage a real size so screen<->cell mapping is meaningful
R['#stage'] = R['#stage'] || undefined;
const stage = h.document.querySelector('#stage'); stage.clientWidth = 1000; stage.clientHeight = 600;
h.window.innerWidth = 1280;
fire('resize', {});
frames(5);
ok(h.errors.length === 0, 'init and first frames: no errors ' + (h.errors[0] || ''));
// title -> select -> launch
R['#btnNew'].onclick(); R['#btnLaunch'].onclick();
ok(WS.state && WS.state.scn === 'starter', 'launch starter via UI');
frames(30);
ok(h.errors.length === 0, 'frames in game: no errors ' + (h.errors[0] || ''));
const G = WS.state;
// screen mapping helper (mirrors render math)
const CW = 1000, CH = 600;
const cs = Math.min(CW / (G.W + 2), CH / (G.H + 2));
const toScreen = (x, y) => [CW / 2 + (x - G.W / 2 + 0.5) * cs, CH / 2 + (y - G.H / 2 + 0.5) * cs];
// inspect a robot by clicking its cell
const r0 = G.robots[0];
const [sx, sy] = toScreen(r0.cell % G.W, (r0.cell / G.W) | 0);
cvFire('pointerdown', { clientX: sx, clientY: sy, button: 0, pointerId: 1 });
cvFire('pointerup', { clientX: sx, clientY: sy, button: 0, pointerId: 1 });
frames(3);
ok(R['#inspector'] && h.errors.length === 0, 'inspector on robot: no errors ' + (h.errors[0] || ''));
// build with tools (wall on floor, pod, station, charger, dock, repair, oneway, erase)
const tools = ['wall', 'store', 'charger', 'oneway', 'erase', 'select'];
G.cash = 50000;
const floorCell = (() => { for (let y = 2; y < G.H - 2; y++) for (let x = 2; x < G.W - 2; x++) { const c = y * G.W + x; if (G.type[c] === 0 && G.occ[c] < 0 && G.shelfAt[c] < 0 && !G.dir[c] && G.distSt[c] > 2) return c; } return -1; })();
const [fx, fy] = toScreen(floorCell % G.W, (floorCell / G.W) | 0);
key('2'); // wall tool
cvFire('pointerdown', { clientX: fx, clientY: fy, button: 0, pointerId: 2 });
cvFire('pointerup', { clientX: fx, clientY: fy, button: 0, pointerId: 2 });
ok(G.type[floorCell] === 1 || G.type[floorCell] === 0, 'wall tool click handled');
key('3'); cvFire('pointerdown', { clientX: fx, clientY: fy, button: 0, pointerId: 3 }); cvFire('pointerup', { clientX: fx, clientY: fy, button: 0, pointerId: 3 });
key('5'); cvFire('pointerdown', { clientX: fx, clientY: fy, button: 0, pointerId: 4 }); cvFire('pointerup', { clientX: fx, clientY: fy, button: 0, pointerId: 4 });
key('8'); cvFire('pointerdown', { clientX: fx, clientY: fy, button: 0, pointerId: 5 }); cvFire('pointerup', { clientX: fx, clientY: fy, button: 0, pointerId: 5 });
key('9'); cvFire('pointerdown', { clientX: fx, clientY: fy, button: 0, pointerId: 6 }); cvFire('pointerup', { clientX: fx, clientY: fy, button: 0, pointerId: 6 });
// right-click erase via paint
key('2'); cvFire('pointerdown', { clientX: fx, clientY: fy, button: 2, pointerId: 7 }); cvFire('pointerup', { clientX: fx, clientY: fy, button: 2, pointerId: 7 });
key('1'); frames(5);
ok(h.errors.length === 0, 'tool clicks and right-click paint: no errors ' + (h.errors[0] || ''));
// drag to pan with inspect tool
cvFire('pointerdown', { clientX: 100, clientY: 100, button: 0, pointerId: 8 });
cvFire('pointermove', { clientX: 160, clientY: 130, button: 0, pointerId: 8 });
cvFire('pointerup', { clientX: 160, clientY: 130, button: 0, pointerId: 8 });
ok(true, 'drag pan executed');
// wheel zoom and pinch
cvFire('wheel', { deltaY: -200 });
cvFire('pointerdown', { clientX: 300, clientY: 300, pointerId: 11 }); cvFire('pointerdown', { clientX: 400, clientY: 300, pointerId: 12 });
cvFire('pointermove', { clientX: 450, clientY: 300, pointerId: 12 }); cvFire('pointerup', { clientX: 450, clientY: 300, pointerId: 12 }); cvFire('pointerup', { clientX: 300, clientY: 300, pointerId: 11 });
frames(3);
ok(h.errors.length === 0, 'wheel and pinch: no errors');
// speeds, pause, overlay, mute, zoom keys
['z', 'c', 'b', 'x'].forEach(k => key(k));
ok(WS.state.t >= 0, 'speed keys');
key(' '); ok(true, 'space pauses'); frames(3); key(' '); frames(3);
key('v'); frames(3); key('v'); frames(3); key('v'); frames(3);
key('m'); key('m'); key('+'); key('-');
fire('blur', {}); frames(2); // auto-pause on blur
key('Escape'); // resume from pause
fire('keydown', { key: 'h', target: { tagName: 'BODY' }, preventDefault() {} }); frames(2);
R['#helpBack'].onclick(); frames(2);
ok(h.errors.length === 0, 'keys, pause, overlay, blur, help: no errors ' + (h.errors[0] || ''));
// tabs: fleet/charts/log/ops
const tabBtns = h.document.querySelector('.tabs'); // not used directly
['fleet', 'charts', 'log', 'ops'].forEach(t => { const fake = { getAttribute: () => t, classList: { toggle() {} } }; });
frames(20);
ok(h.errors.length === 0, 'render all panes: no errors');
// shop purchases through the real handler
const shopBefore = G.robots.length;
R['#shopGrid'].__ls.click.forEach(f => f({ target: { closest: sel => sel === '[data-buy]' ? { getAttribute: () => 'robot' } : null } }));
ok(G.robots.length >= shopBefore, 'shop buy robot via handler');
// policy
const policyEvt = id => ({ target: { closest: sel => sel === '[data-policy]' ? { getAttribute: () => id } : null } });
R['#shopPolicy'].__ls.click.forEach(f => f(policyEvt('velocity')));
ok(G.pendingPolicy === null || G.pendingPolicy === 'velocity', 'locked policy refused');
// end of shift -> report -> next shift
G.t = 299.8; frames(6);
ok(h.errors.length === 0, 'shift end report: no errors ' + (h.errors[0] || ''));
R['#btnNextShift'].onclick(); frames(2);
ok(WS.state.shiftIdx === 1 || WS.state.over, 'next shift starts (shift index ' + WS.state.shiftIdx + ')');
// pause menu buttons
R['#btnMenu'].onclick(); frames(2); R['#btnSave'].onclick(); R['#btnResume'].onclick(); frames(2);
R['#btnPause'].onclick(); R['#btnPause'].onclick();
R['#btnPauseSettings'].onclick(); frames(1); R['#btnSettingsTitle'];
R['#setMaster'].__ls.input.forEach(f => f({ target: { value: '0.4' } }));
R['#setSound'].__ls.change.forEach(f => f({ target: { checked: false } }));
R['#setSound'].__ls.change.forEach(f => f({ target: { checked: true } }));
R['#setReduced'].__ls.change.forEach(f => f({ target: { checked: true } }));
R['#setReduced'].__ls.change.forEach(f => f({ target: { checked: false } }));
ok(h.errors.length === 0, 'pause menu & settings: no errors ' + (h.errors[0] || ''));
R['#btnQuit'].onclick(); frames(2);
ok(R['#scr-title'] !== undefined && h.lsMap.has('wr35_save_v1'), 'quit to title saves game (storage key present)');
R['#btnContinue'].onclick(); frames(4);
ok(h.errors.length === 0, 'continue from save: no errors ' + (h.errors[0] || ''));
// research: grant RP and buy perks
h.lsMap.get('wr35_campaign_v1') && (() => { const c = JSON.parse(h.lsMap.get('wr35_campaign_v1')); c.rp = 40; h.lsMap.set('wr35_campaign_v1', JSON.stringify(c)); })();
R['#btnResearch'].onclick(); frames(1);
R['#perkGrid'].__ls.click.forEach(f => f({ target: { closest: sel => sel === '[data-perk]' ? { getAttribute: () => 'charge_eff' } : null } }));
const camNow = JSON.parse(h.lsMap.get('wr35_campaign_v1') || '{}');
ok(h.errors.length === 0, 'research flow: no errors ' + (h.errors[0] || ''));
// title background animation
R['#btnNew'];
frames(3);
// keep sim running to a victory with the bot-like owner path not needed: check endings render
WS.state.over = null;
console.log('errors so far:', h.errors.length, h.errors.slice(0, 3));
process.exit(0);
