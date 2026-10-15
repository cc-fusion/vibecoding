const vm = require('vm'), fs = require('fs');
const src = fs.readFileSync(process.env.GAME || '/home/user/warehouse-robotics/game.js', 'utf8');

function makeStub(name) {
  const cache = Object.create(null);
  const listeners = {};
  const stub = new Proxy(function () {}, {
    get(t, p) {
      if (p === Symbol.toPrimitive) return () => 0;
      if (p === '__ls') return listeners;
      if (p === 'addEventListener') return (ty, f) => { (listeners[ty] = listeners[ty] || []).push(f); };
      if (p === Symbol.iterator || p === 'then') return undefined;
      if (p === 'length') return 0;
      if (p in cache) return cache[p];
      if (p === 'style') return (cache[p] = new Proxy({}, { get: (o, k) => (k in o ? o[k] : ''), set: (o, k, v) => { o[k] = v; return true; } }));
      cache[p] = makeStub(String(p));
      return cache[p];
    },
    set(t, p, v) { cache[p] = v; return true; },
    apply() { return stub; }
  });
  return stub;
}
const errors = [];
const AUDIO_ON = !!process.env.AUDIO;
const reg = Object.create(null);
const lsMap = new Map();
const rafQ = [];
if (process.env.PRELOAD_CAMP) lsMap.set('wr35_campaign_v1', process.env.PRELOAD_CAMP);
const winListeners = {};
const docListeners = {};
const NOLS = !!process.env.NOLS;
const window = {
  devicePixelRatio: 1, innerWidth: 1280, innerHeight: 800,
  localStorage: NOLS ? { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('denied'); } } : {
    getItem: k => (lsMap.has(k) ? lsMap.get(k) : null),
    setItem: (k, v) => { lsMap.set(k, String(v)); },
    removeItem: k => { lsMap.delete(k); }
  },
  addEventListener: (t, f) => { (winListeners[t] = winListeners[t] || []).push(f); },
  removeEventListener: () => {},
  requestAnimationFrame: f => { rafQ.push(f); return rafQ.length; },
  getComputedStyle: () => makeStub('cs'),
  confirm: () => true
};
if (AUDIO_ON) { window.AudioContext = function () { return makeStub('AudioContext'); }; }
const document = {
  readyState: 'complete', hidden: false,
  getElementById: id => (reg['#' + id] = reg['#' + id] || makeStub(id)),
  querySelector: sel => (reg[sel] = reg[sel] || makeStub(sel)),
  querySelectorAll: () => [],
  createElement: t => makeStub(t),
  body: makeStub('body'), documentElement: makeStub('html'),
  addEventListener: (t, f) => { (docListeners[t] = docListeners[t] || []).push(f); }
};
const ctx = {
  window, document, console: { log: () => {}, warn: () => {}, info: () => {}, error: e => errors.push(String(e && e.stack || e)) },
  setTimeout: () => 0, clearTimeout: () => {}, requestAnimationFrame: window.requestAnimationFrame,
  performance, Math, JSON, Date, Float64Array, Int32Array, Uint8Array, Map, Set, Object, Array, String, Number, Promise
};
ctx.globalThis = ctx;
vm.createContext(ctx);
try { vm.runInContext(src, ctx, { filename: 'game.js' }); }
catch (e) { errors.push('LOAD: ' + (e && e.stack || e)); }
module.exports = { ctx, window, document, reg, errors, rafQ, lsMap, winListeners, docListeners, WS: () => window.WarehouseSim };
