// ===== Pocket Valley renderer (Canvas 2D, all art is code-drawn) =====
import * as D from './data.js';
import * as M from './maps.js';

const T = D.TILE;
const GRASS = ['#6dbb58', '#55ad47', '#b5a24a', '#dde8ec'];
const GRASS_S = [['#7fcb68', '#5aa94a'], ['#66bd52', '#469a3c'], ['#c6b25a', '#9c8a3a'], ['#ffffff', '#c3d3da']];
const LEAF = [['#3f9a43', '#2f7a35'], ['#2f8a3a', '#236b2c'], ['#d4802b', '#a85a1c'], ['#e8f0f2', '#b9ccd3']];
const EMOJI = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

export function installRender(G) {
  const ctx = G.ctx, cache = {};
  const mkc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  let light = null, lctx = null;

  function tileImg(code, v, season, zone) {
    const key = code + '_' + v + '_' + season + '_' + zone;
    if (cache[key]) return cache[key];
    const c = mkc(T, T), g = c.getContext('2d'), r = D.rng(v * 977 + code * 131 + season * 7 + zone * 3 + 1);
    const speck = (cols, n, sz) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(Math.floor(r() * 14) * 2, Math.floor(r() * 14) * 2, sz || 2, sz || 2); } };
    if (code === M.GR) {
      g.fillStyle = GRASS[season]; g.fillRect(0, 0, T, T); speck(GRASS_S[season], 9, 2);
      if (season < 3 && v === 0) { g.fillStyle = season === 0 ? '#ffe36b' : '#ff9ac0'; const fx = 6 + Math.floor(r() * 18), fy = 6 + Math.floor(r() * 18); g.fillRect(fx, fy, 2, 2); g.fillRect(fx - 2, fy, 2, 2); g.fillStyle = '#fff'; g.fillRect(fx, fy - 2, 2, 2); }
      if (season === 2 && v === 1) { g.fillStyle = '#c0522a'; g.fillRect(8 + Math.floor(r() * 14), 8 + Math.floor(r() * 14), 3, 2); }
    } else if (code === M.DI) {
      g.fillStyle = season === 3 ? '#c9b8a0' : '#a8845a'; g.fillRect(0, 0, T, T); speck(['#8d6b43', '#b99468', '#9a7650'], 10, 2);
    } else if (code === M.SA) {
      g.fillStyle = '#e8d6a2'; g.fillRect(0, 0, T, T); speck(['#d6c28a', '#f3e5b8', '#cbb77c'], 12, 2);
    } else if (code === M.CO) {
      g.fillStyle = '#9d978c'; g.fillRect(0, 0, T, T);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const ox = (j % 2) * 4; g.fillStyle = ['#aaa49a', '#948e84', '#a39d92'][Math.floor(r() * 3)]; g.fillRect(i * 8 + ox - (ox ? 8 : 0) + (ox ? 8 : 0), j * 8 + 1, 7, 7); }
      g.fillStyle = 'rgba(70,64,56,.5)'; for (let k = 0; k < 4; k++) g.fillRect(0, k * 8, T, 1);
    } else if (code === M.WO) {
      g.fillStyle = '#b7824b'; g.fillRect(0, 0, T, T);
      for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#a9743f' : '#bc8a53'; g.fillRect(0, k * 8, T, 8); g.fillStyle = '#7d5530'; g.fillRect(0, k * 8, T, 1); }
      g.fillStyle = '#6a4626'; g.fillRect(3 + v * 4, 3, 2, 2); g.fillRect(25 - v * 3, 19, 2, 2);
    } else if (code === M.ST) {
      g.fillStyle = ['#6a6055', '#4f5a74', '#6a423a'][zone]; g.fillRect(0, 0, T, T); speck([['#7a7064', '#5a5046'], ['#5f6c88', '#434d66'], ['#7a4e44', '#5a342d']][zone], 12, 2);
    } else if (code === M.WL) {
      g.fillStyle = ['#2f2a25', '#262c3c', '#301a18'][zone]; g.fillRect(0, 0, T, T);
      for (let j = 0; j < 4; j++) { g.fillStyle = ['#3d3731', '#333b50', '#412420'][zone]; const o = (j % 2) * 8; for (let i = -1; i < 3; i++) g.fillRect(i * 16 + o + 1, j * 8 + 1, 14, 6); }
    } else if (code === M.TR) {
      g.fillStyle = season === 3 ? '#cfdde2' : '#2c6a30'; g.fillRect(0, 0, T, T);
      const L = LEAF[season];
      for (let i = 0; i < 4; i++) { const cx = 6 + (i % 2) * 16 + Math.floor(r() * 4), cy = 8 + Math.floor(i / 2) * 14; g.fillStyle = L[1]; g.beginPath(); g.arc(cx, cy + 3, 10, 0, 7); g.fill(); g.fillStyle = L[0]; g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.fill(); }
    } else if (code === M.HW) {
      g.fillStyle = '#d8c39b'; g.fillRect(0, 0, T, T); g.fillStyle = '#c4ac80'; for (let i = 0; i < 4; i++) g.fillRect(i * 8, 0, 1, T);
      g.fillStyle = '#8a6a43'; g.fillRect(0, T - 5, T, 5);
    } else { g.fillStyle = '#f0f'; g.fillRect(0, 0, T, T); }
    cache[key] = c; return c;
  }

  // ---------- small sprite helpers ----------
  const ell = (x, y, rx, ry, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); };
  const txt = (s, x, y, size, col, al, stroke) => {
    ctx.font = (size || 10) + 'px ' + EMOJI; ctx.textAlign = al || 'center'; ctx.textBaseline = 'middle';
    if (stroke) { ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.strokeText(s, x, y); }
    ctx.fillStyle = col || '#fff'; ctx.fillText(s, x, y);
  };
  function person(x, y, face, anim, pal, o) {
    o = o || {}; const bob = anim ? Math.abs(Math.sin(anim)) * 1.5 : 0, leg = anim ? Math.sin(anim) * 3 : 0;
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ell(x, y, 8, 3, 'rgba(0,0,0,.25)');
    ctx.fillStyle = pal.pants; ctx.fillRect(x - 5, y - 8, 4, 8 - Math.max(0, leg)); ctx.fillRect(x + 1, y - 8, 4, 8 - Math.max(0, -leg));
    ctx.fillStyle = pal.shirt; ctx.fillRect(x - 6, y - 19 - bob, 12, 12); ctx.fillRect(x - 8, y - 18 - bob, 2, 9); ctx.fillRect(x + 6, y - 18 - bob, 2, 9);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x - 6, y - 10 - bob, 12, 3);
    ctx.fillStyle = pal.skin; ctx.fillRect(x - 8, y - 10 - bob, 2, 2); ctx.fillRect(x + 6, y - 10 - bob, 2, 2); ctx.fillRect(x - 5, y - 28 - bob, 10, 10);
    ctx.fillStyle = pal.hair;
    if (face === 'up') ctx.fillRect(x - 5, y - 29 - bob, 10, 9); else { ctx.fillRect(x - 6, y - 30 - bob, 12, 5); ctx.fillRect(x - 6, y - 26 - bob, 2, 4); ctx.fillRect(x + 4, y - 26 - bob, 2, 4); }
    ctx.fillStyle = '#222';
    if (face === 'down') { ctx.fillRect(x - 3, y - 23 - bob, 2, 2); ctx.fillRect(x + 1, y - 23 - bob, 2, 2); } else if (face === 'left') ctx.fillRect(x - 4, y - 23 - bob, 2, 2); else if (face === 'right') ctx.fillRect(x + 2, y - 23 - bob, 2, 2);
    if (o.hat) { ell(x, y - 29 - bob, 10, 3, '#e3c26a'); ctx.fillStyle = '#d4af4f'; ctx.fillRect(x - 5, y - 34 - bob, 10, 5); }
    if (o.alpha !== undefined) ctx.globalAlpha = 1;
  }

  // ---------- objects ----------
  function drawTree(o, S) {
    const season = G.seasonOf(), x = o.x * T + 16 + (o.shk > 0 ? Math.sin(G.t * 60) * 1.6 : 0), y = (o.y + 1) * T, L = LEAF[season];
    ell(x, y - 2, 13, 4, 'rgba(0,0,0,.22)');
    ctx.fillStyle = '#6b4526'; ctx.fillRect(x - 5, y - 24, 10, 24); ctx.fillStyle = '#7f5530'; ctx.fillRect(x - 5, y - 24, 4, 24);
    const cy = y - 44 - (o.v || 0) * 2;
    ell(x, cy + 8, 22, 17, L[1]); ell(x - 10, cy, 15, 14, L[1]); ell(x + 11, cy + 1, 14, 13, L[1]);
    ell(x, cy, 21, 16, L[0]); ell(x - 11, cy - 4, 13, 12, L[0]); ell(x + 11, cy - 3, 12, 11, L[0]);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ell(x - 6, cy - 8, 8, 5, 'rgba(255,255,255,.16)');
    if (season === 2 && o.v === 1) { ctx.fillStyle = '#e8412c'; ctx.fillRect(x - 8, cy + 2, 3, 3); ctx.fillRect(x + 6, cy - 6, 3, 3); }
    void S;
  }
  function drawRock(o) {
    const m = G.map, x = o.x * T + 16 + (o.hit > 0 ? Math.sin(G.t * 80) * 1.5 : 0), y = (o.y + 1) * T;
    const zone = m.mine ? m.zone : 0, base = [['#9e9ea6', '#7c7c86', '#c4c4cc'], ['#8a93aa', '#69718a', '#b4bdd4'], ['#97726a', '#74524b', '#c39a90']][zone];
    ell(x, y - 3, 14, 5, 'rgba(0,0,0,.25)'); ctx.fillStyle = base[1]; ctx.beginPath(); ctx.ellipse(x, y - 12, 14, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = base[0]; ctx.beginPath(); ctx.ellipse(x - 1, y - 14, 12, 10, 0, 0, 7); ctx.fill(); ctx.fillStyle = base[2]; ctx.fillRect(x - 7, y - 21, 6, 2);
    const col = { copper: '#e08a45', iron: '#f0f4f8', gold: '#ffd23f', coal: '#1c1c22', gem: '#c07bff' }[o.k];
    if (col) { ctx.fillStyle = col; [[-6, -16], [3, -12], [-2, -8], [7, -17]].forEach(([dx, dy]) => ctx.fillRect(x + dx, y + dy, 4, 4)); if (o.k === 'gem') { ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, y - 17, 1, 2); } }
    if (o.hp < o.mhp) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x - 10, y - 30, 20, 3); ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 10, y - 30, 20 * Math.max(0, o.hp / o.mhp), 3); }
  }
  function drawObj(o, S) {
    const x = o.x * T, y = o.y * T, t = G.t, now = S ? G.abs() : 0;
    switch (o.t) {
      case 'tree': drawTree(o, S); break;
      case 'rock': drawRock(o); break;
      case 'bush': ell(x + 16, y + 28, 13, 4, 'rgba(0,0,0,.2)'); ell(x + 16, y + 20, 14, 11, LEAF[G.seasonOf()][1]); ell(x + 15, y + 17, 12, 9, LEAF[G.seasonOf()][0]); if (G.seasonOf() < 2) { ctx.fillStyle = '#ff6b8a'; ctx.fillRect(x + 9, y + 15, 3, 3); ctx.fillRect(x + 19, y + 19, 3, 3); } break;
      case 'bin': ell(x + 16, y + 29, 14, 4, 'rgba(0,0,0,.25)'); ctx.fillStyle = '#8a5a2e'; ctx.fillRect(x + 2, y + 10, 28, 20); ctx.fillStyle = '#6e4521'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 2 + i * 7, y + 10, 1, 20); ctx.fillStyle = '#a9743f'; ctx.fillRect(x, y + 6, 32, 6); ctx.fillStyle = '#3b2615'; ctx.fillRect(x + 4, y + 8, 24, 2); txt('📦', x + 16, y + 21, 10, '#fff'); break;
      case 'bed': { ctx.fillStyle = '#7a4a2a'; ctx.fillRect(x + 1, y - 8, 30, 40); ctx.fillStyle = '#e9e2d0'; ctx.fillRect(x + 4, y - 5, 24, 10); ctx.fillStyle = G.S ? G.S.look.shirt : '#3b82c4'; ctx.fillRect(x + 4, y + 7, 24, 22); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x + 4, y + 7, 24, 3); break; }
      case 'stove': ctx.fillStyle = '#585860'; ctx.fillRect(x + 1, y + 2, 30, 30); ctx.fillStyle = '#3a3a42'; ctx.fillRect(x + 4, y + 5, 24, 8); ctx.fillStyle = '#222'; ctx.fillRect(x + 6, y + 18, 20, 11); ctx.fillStyle = '#ff7a2e'; ctx.fillRect(x + 8 + Math.floor(t * 3) % 2, y + 24, 3, 4); ctx.fillRect(x + 18, y + 25, 3, 3); ctx.fillStyle = '#b0b0b8'; ctx.fillRect(x + 8, y + 7, 6, 3); ctx.fillRect(x + 18, y + 7, 6, 3); break;
      case 'tv': ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x + 4, y + 22, 24, 10); ctx.fillStyle = '#1b1b24'; ctx.fillRect(x + 2, y + 4, 28, 20); ctx.fillStyle = Math.floor(t * 2) % 2 ? '#3a6ea5' : '#4a86c5'; ctx.fillRect(x + 5, y + 7, 22, 14); ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 8, y + 10, 5, 5); break;
      case 'sprinkler': case 'qsprinkler': { const q = o.t === 'qsprinkler'; ell(x + 16, y + 27, 8, 3, 'rgba(0,0,0,.25)'); ctx.fillStyle = q ? '#d4af37' : '#a6b0ba'; ctx.fillRect(x + 12, y + 14, 8, 14); ctx.fillStyle = q ? '#ffe170' : '#d6dee6'; ctx.fillRect(x + 10, y + 10, 12, 6); ctx.fillStyle = '#4da3ff'; ctx.fillRect(x + 14, y + 6 + Math.floor(t * 4) % 2, 4, 4); break; }
      case 'scarecrow': ctx.fillStyle = '#7a5230'; ctx.fillRect(x + 14, y - 8, 4, 40); ctx.fillRect(x + 3, y + 4, 26, 4); ctx.fillStyle = '#c0532c'; ctx.fillRect(x + 9, y + 6, 14, 14); ctx.fillStyle = '#f0d9a0'; ctx.fillRect(x + 11, y - 6, 10, 10); ell(x + 16, y - 6, 12, 3, '#6b4526'); ctx.fillStyle = '#6b4526'; ctx.fillRect(x + 10, y - 14, 12, 8); ctx.fillStyle = '#222'; ctx.fillRect(x + 13, y - 2, 2, 2); ctx.fillRect(x + 18, y - 2, 2, 2); break;
      case 'furnace': ctx.fillStyle = '#6c6c76'; ctx.fillRect(x + 2, y + 4, 28, 28); ctx.fillStyle = '#8b8b96'; ctx.fillRect(x + 2, y + 4, 28, 5); ctx.fillStyle = '#26262c'; ctx.fillRect(x + 8, y + 16, 16, 12); if (o.st === 'busy') { ctx.fillStyle = Math.floor(t * 8) % 2 ? '#ff9a2e' : '#ffd23f'; ctx.fillRect(x + 11, y + 21, 10, 7); ctx.fillStyle = 'rgba(160,160,160,.5)'; ell(x + 16 + Math.sin(t * 3) * 3, y - 2 - (t * 12) % 8, 4, 4, 'rgba(180,180,180,.5)'); } if (o.st === 'done' || (o.st === 'busy' && now >= o.ready)) txt('✅', x + 16, y - 4 + Math.sin(t * 5) * 2, 14); break;
      case 'jar': ctx.fillStyle = '#a0603a'; ell(x + 16, y + 20, 11, 11, '#a0603a'); ctx.fillStyle = '#c47a4c'; ctx.fillRect(x + 9, y + 6, 14, 6); ctx.fillStyle = '#7a4524'; ctx.fillRect(x + 11, y + 3, 10, 4); if (o.st === 'busy' && now < o.ready) { ell(x + 14 + Math.sin(t * 4) * 2, y - (t * 10) % 8, 3, 3, 'rgba(255,200,230,.6)'); } if (o.st === 'done' || (o.st === 'busy' && now >= o.ready)) txt('✅', x + 16, y - 4 + Math.sin(t * 5) * 2, 14); break;
      default: break;
    }
  }
  function drawLow(o) {
    const x = o.x * T, y = o.y * T, t = G.t;
    switch (o.t) {
      case 'weed': { const w = G.seasonOf() === 3 ? '#a8bfa0' : ['#4ea53f', '#3b8f35', '#5bb54a'][o.v || 0]; ctx.fillStyle = w; for (let i = 0; i < 5; i++) { const bx = x + 7 + i * 4, h = 8 + ((i * 7 + (o.v || 0) * 3) % 7); ctx.fillRect(bx, y + 26 - h, 2, h); } ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + 11, y + 14, 2, 8); break; }
      case 'twig': ctx.fillStyle = '#7a5230'; ctx.save(); ctx.translate(x + 16, y + 20); ctx.rotate(-0.4); ctx.fillRect(-10, -1, 20, 3); ctx.restore(); ctx.save(); ctx.translate(x + 14, y + 22); ctx.rotate(0.6); ctx.fillRect(-7, -1, 14, 2); ctx.restore(); break;
      case 'forage': ell(x + 16, y + 26, 8, 3, 'rgba(0,0,0,.2)'); txt(D.ITEMS[o.item] ? D.ITEMS[o.item].icon : '?', x + 16, y + 17 + Math.sin(t * 3 + o.x) * 1.5, 16); if (Math.sin(t * 4 + o.x * 3) > 0.9) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 22, y + 8, 2, 2); } break;
      case 'egg': { const cols = ['#ff8fb8', '#8fd3ff', '#ffe36b', '#9be58f', '#c49bff']; ell(x + 16, y + 26, 7, 3, 'rgba(0,0,0,.2)'); ell(x + 16, y + 20, 6, 8, cols[o.c || 0]); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x + 12, y + 16, 8, 2); ctx.fillRect(x + 12, y + 21, 8, 2); break; }
      case 'up': ctx.fillStyle = '#17120e'; ctx.fillRect(x + 2, y + 2, 28, 28); ctx.fillStyle = '#9a7040'; ctx.fillRect(x + 7, y, 3, 32); ctx.fillRect(x + 22, y, 3, 32); for (let i = 0; i < 4; i++) ctx.fillRect(x + 7, y + 4 + i * 8, 18, 3); break;
      case 'down': ctx.fillStyle = '#17120e'; ctx.fillRect(x + 1, y + 1, 30, 30); for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#a39a8e', '#8c8378', '#756d63', '#5d564e'][i]; ctx.fillRect(x + 3 + i * 3, y + 3 + i * 7, 26 - i * 6, 6); } ctx.fillStyle = 'rgba(255,230,120,' + (0.2 + 0.15 * Math.sin(t * 4)) + ')'; ctx.fillRect(x, y, 32, 32); break;
      case 'sprinkler': case 'qsprinkler': drawObj(o, G.S); break;
      case 'bomb': { const bl = Math.floor(o.timer * 8) % 2; ell(x + 16, y + 20, 9, 9, bl ? '#a33' : '#222'); ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 15, y + 6, 3, 5); ctx.fillStyle = '#ff8a2e'; ctx.fillRect(x + 14 + (bl ? 1 : 0), y + 3, 4, 4); break; }
      default: break;
    }
  }
  const LOW = { weed: 1, twig: 1, forage: 1, egg: 1, up: 1, down: 1, sprinkler: 1, qsprinkler: 1, bomb: 1 };

  function drawCrop(m, x, y, sl) {
    const c = sl.crop, cd = D.CROPS[c.id]; if (!cd) return; const f = c.g / cd.d, px = x * T + 16, py = y * T + 28;
    ctx.fillStyle = '#3f9a43';
    if (f < 0.25) { ctx.fillStyle = '#5a3a1c'; ctx.fillRect(px - 5, py - 6, 3, 3); ctx.fillRect(px + 3, py - 8, 3, 3); ctx.fillStyle = '#7fe06a'; ctx.fillRect(px - 1, py - 12, 2, 4); }
    else if (f < 0.55) { ctx.fillRect(px - 1, py - 12, 3, 12); ctx.fillStyle = '#58b84a'; ctx.fillRect(px - 6, py - 14, 6, 4); ctx.fillRect(px + 2, py - 12, 6, 4); }
    else if (f < 1) { ctx.fillRect(px - 1, py - 18, 3, 18); ctx.fillStyle = '#58b84a'; ctx.fillRect(px - 9, py - 20, 8, 5); ctx.fillRect(px + 2, py - 16, 8, 5); ctx.fillRect(px - 6, py - 11, 6, 4); ctx.fillStyle = '#3d8a35'; ctx.fillRect(px + 4, py - 10, 5, 3); }
    else { ctx.fillRect(px - 1, py - 14, 3, 14); ctx.fillStyle = '#58b84a'; ctx.fillRect(px - 9, py - 14, 8, 5); ctx.fillRect(px + 2, py - 12, 8, 5); txt(cd.i, px, py - 20 + Math.sin(G.t * 3 + x) * 1, 17); if (Math.sin(G.t * 4 + x * 2 + y) > 0.85) { ctx.fillStyle = '#fff'; ctx.fillRect(px + 7, py - 30, 2, 2); } }
  }

  // ---------- buildings ----------
  function drawBld(b, dark) {
    const S = G.S, x = b.x * T, y = b.y * T, w = b.w * T, h = b.h * T, roofH = Math.min(h * 0.5, 64) + 8;
    ell(x + w / 2, y + h, w / 2 + 6, 6, 'rgba(0,0,0,.2)');
    if (b.glass) {
      ctx.fillStyle = '#d6eef2'; ctx.fillRect(x, y + 14, w, h - 14); ctx.fillStyle = 'rgba(140,200,215,.55)'; for (let i = 0; i <= b.w * 2; i++) ctx.fillRect(x + i * 16 - 1, y + 14, 2, h - 14);
      ctx.fillRect(x, y + 14, w, 2); ctx.fillRect(x, y + h / 2, w, 2); ctx.fillStyle = '#6fa8b8'; ctx.fillRect(x - 4, y + 4, w + 8, 14);
      if (S && S.flags.greenhouse) { for (let i = 0; i < 4; i++) txt(['🌿', '🌱', '🍅', '🌼'][i], x + 20 + i * 18, y + h - 20, 14); } else { ctx.fillStyle = 'rgba(40,30,20,.55)'; ctx.fillRect(x, y + 14, w, h - 14); ctx.fillStyle = '#6b4a2a'; ctx.fillRect(x + 6, y + 30, w - 12, 6); ctx.fillRect(x + 6, y + 52, w - 12, 6); }
    } else {
      ctx.fillStyle = b.wall; ctx.fillRect(x, y + roofH, w, h - roofH);
      ctx.fillStyle = 'rgba(0,0,0,.12)'; if (b.rock || b.center) { for (let j = 0; j < (h - roofH) / 10; j++) for (let i = 0; i < w / 16; i++) ctx.fillRect(x + i * 16 + (j % 2) * 8, y + roofH + j * 10, 1, 10); for (let j = 0; j < (h - roofH) / 10; j++) ctx.fillRect(x, y + roofH + j * 10, w, 1); }
      else for (let i = 0; i < w / 8; i++) ctx.fillRect(x + i * 8, y + roofH, 1, h - roofH);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, y + h - 5, w, 5);
      // roof
      ctx.fillStyle = b.roof; ctx.beginPath(); ctx.moveTo(x - 6, y + roofH); ctx.lineTo(x + 8, y + 2); ctx.lineTo(x + w - 8, y + 2); ctx.lineTo(x + w + 6, y + roofH); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let j = 1; j < roofH / 8; j++) ctx.fillRect(x - 6 + j * 1.2, y + 2 + j * 8, w + 12 - j * 2.4, 2);
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x + 8, y + 2, w - 16, 3); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - 6, y + roofH - 3, w + 12, 3);
      if (G.seasonOf() === 3) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 8, y, w - 16, 5); ctx.fillRect(x - 4, y + roofH - 6, w + 8, 4); }
      // windows
      const nw = Math.max(1, Math.floor(b.w / 3)), lit = dark > 0.25;
      if (!b.rock) for (let i = 0; i < nw; i++) { const wx = x + (i + 0.5) * w / nw - 9; if (Math.abs(wx + 9 - (b.dx + 0.5) * T) < 22) continue; ctx.fillStyle = '#5a3a1c'; ctx.fillRect(wx - 2, y + roofH + 8, 22, 20); ctx.fillStyle = lit ? '#ffd86b' : '#9bd6f0'; ctx.fillRect(wx, y + roofH + 10, 18, 16); ctx.fillStyle = 'rgba(90,58,28,.8)'; ctx.fillRect(wx + 8, y + roofH + 10, 2, 16); ctx.fillRect(wx, y + roofH + 17, 18, 2); }
      // door
      const dx = b.dx * T;
      if (b.rock) { ctx.fillStyle = '#0c0a08'; ctx.beginPath(); ctx.moveTo(dx - 4, y + h); ctx.lineTo(dx - 4, y + h - 30); ctx.quadraticCurveTo(dx + 16, y + h - 54, dx + 36, y + h - 30); ctx.lineTo(dx + 36, y + h); ctx.fill(); ctx.fillStyle = '#7a5230'; ctx.fillRect(dx - 8, y + h - 36, 5, 36); ctx.fillRect(dx + 35, y + h - 36, 5, 36); ctx.fillRect(dx - 8, y + h - 40, 48, 5); }
      else { ctx.fillStyle = '#4a2c14'; ctx.fillRect(dx + 1, y + h - 36, 30, 36); ctx.fillStyle = '#6b4326'; ctx.fillRect(dx + 3, y + h - 34, 26, 34); ctx.fillStyle = '#ffd23f'; ctx.fillRect(dx + 23, y + h - 18, 3, 3); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(dx + 15, y + h - 34, 1, 34); }
      if (b.sign) { const sw = Math.max(40, b.sign.length * 6 + 12); ctx.fillStyle = '#5a3a1c'; ctx.fillRect(x + w / 2 - sw / 2, y + roofH - 2 - 14 + 14 - 14, sw, 14); ctx.fillStyle = '#e8d3a0'; ctx.fillRect(x + w / 2 - sw / 2 + 2, y + roofH - 14 + 2 - 2, sw - 4, 10); txt(b.sign, x + w / 2, y + roofH - 9, 8, '#3a2410'); }
      if (b.name === 'Farmhouse') { ctx.fillStyle = '#7a4a3a'; ctx.fillRect(x + w - 28, y - 12, 12, 24); if (G.S && G.S.weather !== 'sun' || true) { for (let i = 0; i < 3; i++) ell(x + w - 22 + Math.sin(G.t * 1.4 + i) * 4, y - 16 - i * 8 - (G.t * 6) % 6, 4 + i, 4 + i, 'rgba(220,220,220,' + (0.35 - i * 0.1) + ')'); } }
      if (b.center) { ctx.fillStyle = '#c0392b'; ctx.fillRect(x + 12, y + roofH + 4, 3, 30); ctx.fillRect(x + w - 15, y + roofH + 4, 3, 30); ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 15, y + roofH + 6, 10, 8); ctx.fillRect(x + w - 25, y + roofH + 6, 10, 8); const done = G.S ? G.bundlesDone() : 0; txt('★'.repeat(Math.min(8, done)), x + w / 2, y + roofH + 28, 8, '#ffd23f'); }
    }
  }
  function drawDeco(d) {
    const x = d.x * T, y = d.y * T, t = G.t;
    if (d.t === 'fountain') { ell(x + 32, y + 50, 34, 14, 'rgba(0,0,0,.2)'); ell(x + 32, y + 38, 32, 22, '#8d8a84'); ell(x + 32, y + 36, 27, 18, '#4da3ff'); ell(x + 32, y + 36, 20 + Math.sin(t * 2) * 1, 12, '#7cc0ff'); ctx.fillStyle = '#a8a59d'; ctx.fillRect(x + 28, y + 12, 8, 26); ell(x + 32, y + 12, 8, 4, '#bdbab2'); for (let i = 0; i < 5; i++) { const a = t * 2 + i * 1.3; ell(x + 32 + Math.cos(a) * 6, y + 12 + ((t * 30 + i * 6) % 20), 1.8, 1.8, '#d6efff'); } }
    else if (d.t === 'bench') { ctx.fillStyle = '#6b4526'; ctx.fillRect(x + 2, y + 18, 4, 12); ctx.fillRect(x + 26, y + 18, 4, 12); ctx.fillStyle = '#a9743f'; ctx.fillRect(x, y + 14, 32, 6); ctx.fillRect(x, y + 6, 32, 5); }
    else if (d.t === 'lamp') { ctx.fillStyle = '#3a3a44'; ctx.fillRect(x + 14, y - 14, 4, 44); ctx.fillRect(x + 10, y + 28, 12, 4); ctx.fillStyle = (G.S && G.S.time > 1100) ? '#ffe9a0' : '#cfd8dc'; ctx.fillRect(x + 10, y - 22, 12, 10); ctx.fillStyle = '#3a3a44'; ctx.fillRect(x + 8, y - 24, 16, 3); }
  }
  function drawWater(x, y, m) {
    const t = G.t, ocean = m.fish === 'ocean' && y > 12;
    ctx.fillStyle = ocean ? '#2f78c4' : '#3f86d8'; ctx.fillRect(x * T, y * T, T + 0.5, T + 0.5);
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    for (let i = 0; i < 2; i++) { const o = Math.sin(t * 1.6 + x * 0.9 + y * 0.7 + i * 2) * 5; ctx.fillRect(x * T + 6 + i * 12 + o, y * T + 8 + i * 12, 10, 2); }
    if (!M.inb(m, x, y - 1) || m.g[(y - 1) * m.w + x] !== M.WA) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x * T, y * T, T, 3); }
    if (m.fish === 'pond' || m.fish === 'river') { ctx.fillStyle = 'rgba(30,70,140,.15)'; ctx.fillRect(x * T, y * T + 20, T, 12); }
    if (G.S && G.S.weather !== 'sun' && G.S.weather !== 'snow' && ((x * 7 + y * 13 + Math.floor(t * 3)) % 11 === 0)) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(x * T + 16, y * T + 16, 5 + (t * 8) % 6, 2.5, 0, 0, 7); ctx.stroke(); }
  }

  // ---------- monsters ----------
  function drawMonster(mo) {
    const x = mo.x, y = mo.y, t = mo.anim, d = mo.def, fl = mo.flash > 0;
    if (mo.hidden) { drawRock({ x: Math.floor(x / T), y: Math.floor(y / T), k: 'stone', hp: 1, mhp: 1 }); return; }
    const col = fl ? '#fff' : d.col;
    ell(x, y + mo.r * 0.7, mo.r * 0.9, mo.r * 0.35, 'rgba(0,0,0,.25)');
    switch (mo.type) {
      case 'slime': { const sq = mo.hop ? 1 + Math.sin(t * 14) * 0.15 : 1; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y + 2, 10 * sq, 8 / sq, 0, 0, 7); ctx.fill(); ell(x - 3, y - 2, 3, 2, 'rgba(255,255,255,.5)'); ctx.fillStyle = '#143'; ctx.fillRect(x - 4, y, 2, 3); ctx.fillRect(x + 2, y, 2, 3); break; }
      case 'bat': { const fl2 = Math.sin(t * 22) * 7; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 14, y - 6 + fl2); ctx.lineTo(x - 8, y + 3); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14, y - 6 + fl2); ctx.lineTo(x + 8, y + 3); ctx.closePath(); ctx.fill(); ell(x, y, 5, 5, fl ? '#fff' : '#4a2a6a'); ctx.fillStyle = '#f66'; ctx.fillRect(x - 3, y - 2, 2, 2); ctx.fillRect(x + 1, y - 2, 2, 2); break; }
      case 'crab': ell(x, y, 11, 8, col); ell(x, y - 2, 9, 5, fl ? '#fff' : '#a8a8b4'); ctx.fillStyle = col; ctx.fillRect(x - 15, y - 6 + Math.sin(t * 6) * 2, 5, 5); ctx.fillRect(x + 10, y - 6 - Math.sin(t * 6) * 2, 5, 5); ctx.fillStyle = '#222'; ctx.fillRect(x - 4, y - 5, 2, 3); ctx.fillRect(x + 2, y - 5, 2, 3); break;
      case 'skeleton': ctx.fillStyle = col; ctx.fillRect(x - 5, y - 4, 10, 12); ctx.fillRect(x - 6, y - 16, 12, 11); ctx.fillStyle = '#222'; ctx.fillRect(x - 4, y - 13, 3, 3); ctx.fillRect(x + 1, y - 13, 3, 3); ctx.fillRect(x - 3, y - 7, 6, 2); ctx.fillStyle = fl ? '#fff' : '#cfcab8'; ctx.fillRect(x - 7, y - 2 + Math.sin(t * 5) * 2, 3, 8); ctx.fillRect(x + 4, y - 2 - Math.sin(t * 5) * 2, 3, 8); break;
      case 'ghost': { ctx.globalAlpha = 0.65 + Math.sin(t * 3) * 0.15; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y - 4 + Math.sin(t * 3) * 2, 10, Math.PI, 0); ctx.lineTo(x + 10, y + 10); for (let i = 0; i < 4; i++) ctx.lineTo(x + 10 - (i + 1) * 5, y + 6 + (i % 2) * 5); ctx.fill(); ctx.fillStyle = '#334'; ctx.fillRect(x - 5, y - 6, 3, 4); ctx.fillRect(x + 2, y - 6, 3, 4); ctx.globalAlpha = 1; break; }
      case 'sprite': { const f2 = Math.sin(t * 12) * 2; ell(x, y, 10 + f2 * 0.4, 11, fl ? '#fff' : '#ff5a1e'); ell(x, y + 1, 7, 8, fl ? '#fff' : '#ffb02e'); ell(x, y + 3, 4, 5, '#ffe9a0'); ctx.fillStyle = '#222'; ctx.fillRect(x - 4, y - 2, 2, 3); ctx.fillRect(x + 2, y - 2, 2, 3); break; }
      case 'slimeking': { const sq = mo.st === 1 ? 0.75 : mo.st === 2 ? 1.25 : 1 + Math.sin(t * 3) * 0.04; const jz = mo.st === 2 ? -Math.sin((1 - mo.t / 0.55) * Math.PI) * 30 : 0; ctx.fillStyle = fl ? '#fff' : '#46b84f'; ctx.beginPath(); ctx.ellipse(x, y + 4 + jz, 28 / sq, 24 * sq, 0, 0, 7); ctx.fill(); ell(x - 8, y - 6 + jz, 9, 5, 'rgba(255,255,255,.35)'); ctx.fillStyle = '#143'; ctx.fillRect(x - 11, y - 2 + jz, 5, 7); ctx.fillRect(x + 6, y - 2 + jz, 5, 7); ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 14, y - 32 + jz, 28, 8); for (let i = 0; i < 4; i++) ctx.fillRect(x - 14 + i * 9, y - 40 + jz, 6, 9); break; }
      case 'bonelord': { if (mo.st === 1) { ctx.strokeStyle = 'rgba(255,60,60,.6)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + mo.jx * 260, y + mo.jy * 260); ctx.stroke(); } ctx.fillStyle = fl ? '#fff' : '#3a1a4a'; ctx.beginPath(); ctx.moveTo(x - 20, y + 18); ctx.lineTo(x, y - 14); ctx.lineTo(x + 20, y + 18); ctx.fill(); ctx.fillStyle = fl ? '#fff' : '#efe9d6'; ctx.fillRect(x - 9, y - 22, 18, 17); ctx.fillStyle = '#c33'; ctx.fillRect(x - 6, y - 17, 4, 4); ctx.fillRect(x + 2, y - 17, 4, 4); ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 10, y - 28, 20, 5); ctx.fillRect(x - 10, y - 32, 4, 5); ctx.fillRect(x - 2, y - 32, 4, 5); ctx.fillRect(x + 6, y - 32, 4, 5); ctx.fillStyle = fl ? '#fff' : '#efe9d6'; ctx.fillRect(x - 17, y - 4 + Math.sin(t * 4) * 3, 5, 18); ctx.fillRect(x + 12, y - 4 - Math.sin(t * 4) * 3, 5, 18); break; }
      case 'golem': { if (mo.st === 1) { const pr = 1 - mo.t / 0.95; ctx.strokeStyle = 'rgba(255,90,40,.7)'; ctx.fillStyle = 'rgba(255,90,40,' + 0.12 * pr + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y + 6, 100, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y + 6, 100 * pr, 0, 7); ctx.fill(); } const lift = mo.st === 1 ? -Math.sin((1 - mo.t / 0.95) * Math.PI) * 10 : 0; ctx.fillStyle = fl ? '#fff' : '#4a3a38'; ctx.fillRect(x - 26, y - 12 + lift, 52, 36); ctx.fillRect(x - 36, y - 8 + lift + Math.sin(t * 3) * 2, 12, 28); ctx.fillRect(x + 24, y - 8 + lift - Math.sin(t * 3) * 2, 12, 28); ctx.fillRect(x - 15, y - 34 + lift, 30, 24); ctx.fillStyle = fl ? '#fff' : '#d4502a'; for (let i = 0; i < 5; i++) ctx.fillRect(x - 22 + i * 10 + (i % 2) * 2, y - 6 + lift + (i % 3) * 8, 5, 3); ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 9, y - 27 + lift, 5, 5); ctx.fillRect(x + 4, y - 27 + lift, 5, 5); ctx.fillStyle = 'rgba(255,120,40,' + (0.2 + 0.1 * Math.sin(t * 6)) + ')'; ctx.fillRect(x - 26, y - 12 + lift, 52, 36); break; }
      default: ell(x, y, 8, 8, col);
    }
    if (mo.hp < mo.mhp || mo.boss) { const w = mo.boss ? 60 : 22, yy = y - mo.r - (mo.boss ? 28 : 14); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - w / 2 - 1, yy - 1, w + 2, 5); ctx.fillStyle = mo.boss ? '#e04040' : '#7fe06a'; ctx.fillRect(x - w / 2, yy, w * Math.max(0, mo.hp / mo.mhp), 3); if (mo.boss) txt(d.n, x, yy - 8, 10, '#fff', 'center', '#000'); }
  }

  // ---------- lighting / weather ----------
  function darkness() {
    const S = G.S, m = G.map; let d = 0; const t = S.time;
    if (m.mine) return m.boss ? 0.72 : 0.8;
    if (t >= 1020) d = Math.min(0.62, (t - 1020) / 180 * 0.62); else if (t < 400) d = 0.2 * (400 - t) / 40;
    if (S.weather === 'rain') d += 0.1; else if (S.weather === 'storm') d += 0.22; else if (S.weather === 'snow') d += 0.04;
    if (m.indoor) d *= 0.55;
    return Math.min(0.78, d);
  }
  function drawLighting(cx, cy, sc) {
    const S = G.S, m = G.map, d = darkness(), W = G.W, H = G.H;
    const dusk = !m.mine && S.time >= 1020 && S.time < 1260;
    if (d < 0.03 && !dusk) return;
    if (!light || light.width !== Math.floor(W * G.dpr) || light.height !== Math.floor(H * G.dpr)) { light = mkc(Math.floor(W * G.dpr), Math.floor(H * G.dpr)); lctx = light.getContext('2d'); }
    lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, light.width, light.height);
    const k = Math.max(0, Math.min(1, (S.time - 1020) / 200)); const rr = m.mine ? 8 : Math.round(255 + (12 - 255) * k), gg = m.mine ? 10 : Math.round(150 + (18 - 150) * k), bb = m.mine ? 30 : Math.round(70 + (58 - 70) * k);
    lctx.fillStyle = 'rgba(' + rr + ',' + gg + ',' + bb + ',' + Math.max(d, dusk ? 0.1 : 0) + ')'; lctx.fillRect(0, 0, light.width, light.height);
    lctx.globalCompositeOperation = 'destination-out';
    const hole = (wx, wy, rad, a) => {
      const sx = (wx * sc - cx * sc), sy = (wy * sc - cy * sc), r = rad * sc, g = lctx.createRadialGradient(sx, sy, r * 0.1, sx, sy, r);
      g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); lctx.fillStyle = g; lctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    };
    const p = G.p; hole(p.x, p.y - 12, m.mine ? 120 : 75, m.mine ? 1 : 0.8);
    if (!m.mine) {
      m.decos.forEach(q => { if (q.t === 'lamp') hole((q.x + 0.5) * T, q.y * T - 8, 80, 0.95); });
      m.blds.forEach(b => { if (!b.rock && !b.glass) hole((b.dx + 0.5) * T, (b.y + b.h) * T - 10, 70, 0.7); });
      m.objs.forEach(o => { if (o.t === 'furnace' && o.st === 'busy') hole((o.x + 0.5) * T, (o.y + 0.5) * T, 70, 0.9); });
    } else G.projs.forEach(q => { if (q.kind === 'fire') hole(q.x, q.y, 50, 0.9); });
    if (m.mine) G.monsters.forEach(mo => { if (mo.type === 'sprite' || mo.type === 'golem') hole(mo.x, mo.y, 70, 0.8); });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(light, 0, 0); ctx.restore();
  }
  function drawWeather(sc) {
    const S = G.S, m = G.map, W = G.W, H = G.H, t = G.t; if (!m.outdoor) return;
    ctx.save(); ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    if (S.weather === 'rain' || S.weather === 'storm') {
      const n = S.weather === 'storm' ? 220 : 130; ctx.strokeStyle = 'rgba(190,215,255,.55)'; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = 0; i < n; i++) { const x = ((i * 97.3 + t * (S.weather === 'storm' ? 260 : 120)) % (W + 80)) - 40, y = (i * 53.7 + t * 820) % (H + 40) - 20; ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 14); }
      ctx.stroke();
    } else if (S.weather === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 110; i++) { const x = (i * 83.1 + Math.sin(t * 0.8 + i) * 30 + t * 18) % (W + 20), y = (i * 47.9 + t * (40 + (i % 5) * 8)) % (H + 20); ctx.fillRect(x, y, 2 + (i % 3), 2 + (i % 3)); }
    } else if (G.seasonOf() === 2 && S.weather === 'sun') {
      for (let i = 0; i < 14; i++) { const x = (i * 131 + t * 25 + Math.sin(t + i) * 20) % (W + 30), y = (i * 71 + t * 30) % (H + 30); ctx.fillStyle = i % 2 ? '#d4802b' : '#c0522a'; ctx.fillRect(x, y, 4, 3); }
    }
    ctx.restore(); void sc;
  }

  // ---------- fishing UI ----------
  function drawFishing(sc, cx, cy) {
    const f = G.fishing, p = G.p; if (!f) return;
    const bx = (f.wx + 0.5) * T, by = (f.wy + 0.5) * T + Math.sin(G.t * 4) * 1.5 + (f.phase === 'bite' ? Math.sin(G.t * 40) * 2 : 0);
    if (f.phase !== 'game' || true) {
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x + p.fx * 10, p.y - 24); ctx.quadraticCurveTo((p.x + bx) / 2, Math.min(p.y, by) - 30, bx, by); ctx.stroke();
      ell(bx, by, 4, 4, '#fff'); ell(bx, by - 2, 4, 3, '#e04040');
      if (f.phase === 'bite') { txt('!', p.x, p.y - 46 + Math.sin(G.t * 30) * 2, 22, '#ffd23f', 'center', '#000'); ell(bx, by, 14 + (G.t * 40) % 10, 6, 'rgba(255,255,255,.35)'); }
    }
    if (f.phase === 'game') {
      ctx.save(); ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
      const u = Math.min(1.5, Math.max(0.8, G.H / 560)), sx = (p.x - cx) * sc, sy = (p.y - cy) * sc, h = 230 * u, w = 38 * u, x = Math.min(G.W - w - 50, Math.max(10, sx + 60)), y = Math.max(16, Math.min(G.H - h - 16, sy - h / 2 - 40));
      ctx.fillStyle = 'rgba(15,30,55,.88)'; ctx.fillRect(x - 6, y - 6, w + 36 * u, h + 12); ctx.strokeStyle = '#7fb8ff'; ctx.lineWidth = 2; ctx.strokeRect(x - 6, y - 6, w + 36 * u, h + 12);
      ctx.fillStyle = '#1d4a8a'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(80,230,110,.75)'; ctx.fillRect(x + 2, y + (f.bar) * h, w - 4, f.size * h); ctx.strokeStyle = '#b6ffc4'; ctx.strokeRect(x + 2, y + (f.bar) * h, w - 4, f.size * h);
      txt(f.fish ? f.fish.i : '🪵', x + w / 2, y + f.fp * h + 6, 22 * u);
      ctx.fillStyle = '#111'; ctx.fillRect(x + w + 8, y, 14 * u, h); const pg = Math.max(0, Math.min(1, f.prog)); ctx.fillStyle = pg > 0.66 ? '#6cf06c' : pg > 0.33 ? '#f0d85c' : '#f06c5c'; ctx.fillRect(x + w + 8, y + h * (1 - pg), 14 * u, h * pg);
      txt('Hold click / Space', x + w / 2 + 16, y + h + 18, 11, '#cfe6ff', 'center', '#000');
      ctx.restore();
    }
  }

  // ---------- title backdrop ----------
  function drawTitleBG() {
    const W = G.W, H = G.H, t = G.t; ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0); ctx.imageSmoothingEnabled = false;
    const g = ctx.createLinearGradient(0, 0, 0, H); const ph = (Math.sin(t * 0.05) + 1) / 2;
    g.addColorStop(0, ph > 0.5 ? '#7fc4ff' : '#ffb27a'); g.addColorStop(0.6, ph > 0.5 ? '#d9f1ff' : '#ffe0b5'); g.addColorStop(1, '#fdeccf'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ell(W * 0.78, H * 0.22, 46, 46, 'rgba(255,240,170,.95)'); ell(W * 0.78, H * 0.22, 70, 70, 'rgba(255,240,170,.25)');
    for (let i = 0; i < 6; i++) { const x = ((i * 280 + t * 14) % (W + 300)) - 150, y = H * (0.1 + (i % 3) * 0.08); ell(x, y, 60, 16, 'rgba(255,255,255,.85)'); ell(x + 30, y - 10, 36, 14, 'rgba(255,255,255,.85)'); }
    const hill = (col, base, amp, fr, off) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 16) ctx.lineTo(x, H * base + Math.sin(x * fr + off) * amp); ctx.lineTo(W, H); ctx.fill(); };
    hill('#9fd48a', 0.62, 24, 0.006, 1); hill('#7cc16a', 0.72, 20, 0.009, 3); hill('#5fae52', 0.82, 14, 0.012, 5);
    for (let r = 0; r < 4; r++) { ctx.fillStyle = '#6b4a2a'; for (let i = 0; i < Math.ceil(W / 40); i++) { const x = i * 40 + 10, y = H * 0.86 + r * 18; ctx.fillRect(x, y, 22, 4); const f = Math.sin(t * 2 + i + r) * 2; ctx.fillStyle = ['#ff7a3c', '#ffd23f', '#a0e060', '#ff6b8a'][(i + r) % 4]; ctx.fillRect(x + 8, y - 8 + f, 4, 8); ctx.fillStyle = '#6b4a2a'; } }
    for (let i = 0; i < 20; i++) { const x = (i * 97 + Math.sin(t * 0.7 + i) * 40 + t * 10) % W, y = H * 0.4 + ((i * 53) % (H * 0.45)) + Math.sin(t + i * 2) * 10; ctx.fillStyle = 'rgba(255,255,160,' + (0.4 + 0.4 * Math.sin(t * 3 + i)) + ')'; ctx.fillRect(x, y, 3, 3); }
  }

  // ---------- peek target ----------
  function peekTarget() {
    const p = G.p, t = G.ptile(); let x = t.x + p.fx, y = t.y + p.fy;
    if (G.mouse.active && !G.touch.on) { const mt = G.mouseTile(); if (Math.hypot(mt.fx - p.x / T, mt.fy - (p.y - 10) / T) <= 3.2) { x = mt.x; y = mt.y; } }
    return { x, y };
  }

  // ---------- main ----------
  G.render = (dt) => {
    const W = G.W, H = G.H;
    if (!G.map || !G.S || G.mode === 'title') { drawTitleBG(); return; }
    const S = G.S, m = G.map, p = G.p, sc = G.dpr * G.z, season = G.seasonOf(), zone = m.zone || 0;
    const shx = G.cam.shk ? (Math.random() - 0.5) * G.cam.shk : 0, shy = G.cam.shk ? (Math.random() - 0.5) * G.cam.shk : 0;
    const cx = G.cam.x + shx, cy = G.cam.y + shy, vw = W / G.z, vh = H / G.z;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = m.mine ? '#0b0907' : '#16120f'; ctx.fillRect(0, 0, cv_w(), cv_h());
    ctx.setTransform(sc, 0, 0, sc, -Math.round(cx * sc), -Math.round(cy * sc)); ctx.imageSmoothingEnabled = false;
    const x0 = Math.max(0, Math.floor(cx / T)), y0 = Math.max(0, Math.floor(cy / T)), x1 = Math.min(m.w - 1, Math.floor((cx + vw) / T)), y1 = Math.min(m.h - 1, Math.floor((cy + vh) / T));
    // ground
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * m.w + x, code = m.g[i];
      if (code === M.WA) { drawWater(x, y, m); continue; }
      ctx.drawImage(tileImg(code, D.hash2(x, y) & 3, season, zone), x * T, y * T, T + 0.6, T + 0.6);
      if (code === M.WL && y + 1 < m.h && m.g[i + m.w] !== M.WL) { ctx.fillStyle = ['#4d453d', '#414a63', '#5a312c'][zone]; ctx.fillRect(x * T, y * T + 20, T, 12); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x * T, y * T + 20, T, 2); }
      const sl = m.soil[i];
      if (sl) {
        ctx.fillStyle = sl.wet ? '#4b2f17' : '#7a5230'; ctx.fillRect(x * T, y * T, T + 0.5, T + 0.5); ctx.fillStyle = sl.wet ? '#3a2410' : '#5e3d1f';
        for (let k = 0; k < 3; k++) ctx.fillRect(x * T + 2, y * T + 5 + k * 10, T - 4, 3);
        if (sl.wet) { ctx.fillStyle = 'rgba(120,170,255,.12)'; ctx.fillRect(x * T, y * T, T, T); }
        if (sl.fert) { ctx.fillStyle = '#2d1c0c'; ctx.fillRect(x * T + 4, y * T + 3, 3, 3); ctx.fillRect(x * T + 22, y * T + 25, 3, 3); }
        if (sl.crop) drawCrop(m, x, y, sl);
      }
    }
    // ground-level doors highlight + buildings
    m.blds.forEach(b => { if (b.x + b.w >= x0 && b.x <= x1 + 1 && b.y + b.h >= y0 && b.y <= y1 + 1) drawBld(b, darkness()); });
    m.decos.forEach(d => { if (d.t !== 'lamp') drawDeco(d); });
    // festival banners
    if (G.mapName === 'town' && G.festWindow()) { ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(3 * T, 9 * T + 6); for (let x = 3 * T; x <= 44 * T; x += 16) ctx.lineTo(x, 9 * T + 6 + Math.sin(x * 0.05) * 4); ctx.stroke(); for (let x = 3 * T; x <= 44 * T; x += 32) { ctx.fillStyle = ['#ff5a7a', '#ffd23f', '#5ab0ff', '#7fe06a'][(x / 32) % 4]; ctx.beginPath(); ctx.moveTo(x, 9 * T + 6 + Math.sin(x * 0.05) * 4); ctx.lineTo(x + 12, 9 * T + 6 + Math.sin(x * 0.05) * 4); ctx.lineTo(x + 6, 9 * T + 22 + Math.sin(x * 0.05) * 4); ctx.fill(); } }
    // low objects
    const vis = (o) => o.x >= x0 - 2 && o.x <= x1 + 2 && o.y >= y0 - 3 && o.y <= y1 + 3;
    m.objs.forEach(o => { if (LOW[o.t] && vis(o)) drawLow(o); });
    // target cursor
    if (G.mode === 'play' && G.overlay === null && !G.fishing) {
      const sel = S.inv[S.sel]; if (sel) { const tg = peekTarget(); ctx.strokeStyle = 'rgba(255,255,255,' + (0.55 + 0.25 * Math.sin(G.t * 6)) + ')'; ctx.lineWidth = 2; ctx.strokeRect(tg.x * T + 2, tg.y * T + 2, T - 4, T - 4); }
    }
    // doors glow
    m.doors.forEach(d => { ctx.fillStyle = 'rgba(255,255,200,.07)'; ctx.fillRect(d.x * T, d.y * T, T, T); });
    // sortable list
    const list = [];
    m.objs.forEach(o => { if (!LOW[o.t] && vis(o)) list.push({ y: (o.y + 1) * T, o }); });
    G.npcs.forEach(n => { if (!n.hide) list.push({ y: n.y, n }); });
    G.monsters.forEach(mo => list.push({ y: mo.y + mo.r * 0.5, mo }));
    list.push({ y: p.y, pl: 1 });
    if (G.mapName === 'farm') S.animals.forEach((a, i) => { list.push({ y: animalPos(a, i).y, an: a, i }); });
    list.sort((a, b) => a.y - b.y);
    list.forEach(e => {
      if (e.o) drawObj(e.o, S);
      else if (e.n) drawNPC(e.n);
      else if (e.mo) drawMonster(e.mo);
      else if (e.an) drawAnimal(e.an, e.i);
      else drawPlayer();
    });
    // projectiles
    G.projs.forEach(q => { if (q.kind === 'fire') { ell(q.x, q.y, 7, 7, 'rgba(255,120,30,.5)'); ell(q.x, q.y, 4, 4, '#ffd23f'); } else { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(G.t * 12); ctx.fillStyle = '#efe9d6'; ctx.fillRect(-5, -2, 10, 4); ctx.restore(); } });
    drawFishing(sc, cx, cy);
    // particles
    G.parts.forEach(q => { const a = Math.max(0, q.life / q.max); ctx.globalAlpha = Math.min(1, a * 1.5); ctx.fillStyle = q.col; ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); });
    ctx.globalAlpha = 1;
    G.floats.forEach(f => { const a = Math.min(1, f.life / f.max * 2), pop = f.max - f.life < 0.15 ? 1 + (0.15 - (f.max - f.life)) * 4 : 1; ctx.globalAlpha = a; txt(f.text, f.x, f.y, 11 * pop, f.col, 'center', 'rgba(0,0,0,.75)'); });
    ctx.globalAlpha = 1;
    drawLighting(cx, cy, sc); drawWeather(sc);
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    if (G.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + G.flash * 0.7 + ')'; ctx.fillRect(0, 0, W, H); }
    if (G.hitFlash > 0) { G.hitFlash = Math.max(0, G.hitFlash - dt * 1.5); const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, 'rgba(255,0,0,' + G.hitFlash * 1.4 + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    if (S.energy < 15 && G.mode === 'play') { const a = 0.15 + 0.1 * Math.sin(G.t * 4); const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.85); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,0,40,' + a * 2 + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    if (G.fade.a > 0.001) { ctx.fillStyle = 'rgba(8,6,12,' + G.fade.a + ')'; ctx.fillRect(0, 0, W, H); }
    if (G.mode === 'over') { ctx.fillStyle = 'rgba(10,8,20,.55)'; ctx.fillRect(0, 0, W, H); }
  };
  const cv_w = () => G.cv.width, cv_h = () => G.cv.height;

  function drawPlayer() {
    const S = G.S, p = G.p, pal = { skin: '#f1c9a5', hair: S.look.hair, shirt: S.look.shirt, pants: '#3a4a7a' };
    const flick = p.inv > 0 && Math.floor(G.t * 20) % 2 === 0;
    person(p.x, p.y, p.face, p.moving ? p.anim : 0, pal, { hat: true, alpha: flick ? 0.35 : undefined });
    const sw = p.swing > 0 ? 1 - p.swing / (p.swingMax || 0.24) : -1;
    if (sw >= 0 && p.tool) {
      const tool = D.TOOLS[p.tool], ic = p.tool === 'seed' ? '🌱' : tool ? tool.i : '🔧', ang = (-1 + sw * 2) * 0.9;
      ctx.save(); ctx.translate(p.x + p.fx * 12, p.y - 14 + p.fy * 10); ctx.rotate(ang * (p.fx < 0 ? -1 : 1)); ctx.font = '16px ' + EMOJI; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ic, p.fx * 6, p.fy * 6 - 4); ctx.restore();
    }
    if (p.slash > 0) {
      p.slash -= 0.016; const a0 = Math.atan2(p.fy, p.fx), pr = 1 - p.slash / 0.22;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.9 - pr * 0.7) + ')'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y - 12, 34, a0 - 1.1 + pr * 0.5, a0 + 1.1 - 0.2 + pr * 0.5); ctx.stroke();
      ctx.strokeStyle = 'rgba(180,220,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y - 12, 28, a0 - 1, a0 + 0.9); ctx.stroke();
    }
    if (p.dash > 0) { ctx.globalAlpha = 0.3; ctx.fillStyle = S.look.shirt; ctx.fillRect(p.x - 10 - p.fx * 14, p.y - 28, 12, 28); ctx.globalAlpha = 1; }
    const sel = S.inv[S.sel]; if (sel && sel.tool === 'sword' && !p.swing) { void 0; }
  }
  function drawNPC(n) {
    const d = D.NPCS[n.id], pal = { skin: d.skin, hair: d.hair, shirt: d.shirt, pants: '#4a4a5a' };
    person(n.x, n.y, n.face, n.path.length ? n.anim : 0, pal);
    const p = G.p, near = Math.hypot(p.x - n.x, p.y - n.y) < 64;
    if (near || G.isBirthday(n.id)) { txt(d.n, n.x, n.y - 40, 9, '#fff', 'center', 'rgba(0,0,0,.8)'); }
    if (G.isBirthday(n.id)) txt('🎂', n.x, n.y - 52 + Math.sin(G.t * 3) * 2, 12);
    if (near && !G.isBirthday(n.id) && G.S.friends[n.id].talk !== G.S.day) txt('💬', n.x + 12, n.y - 44 + Math.sin(G.t * 4) * 1.5, 11);
    if (n.id === 'edda' && G.S.festIdx >= 0 && G.festWindow() && !G.S.festDone[G.S.day]) txt(D.FESTIVALS[G.S.festIdx].i, n.x, n.y - 54 + Math.sin(G.t * 4) * 2, 14);
  }
  function animalPos(a, i) {
    const t = G.t * 0.35 + i * 2.1 + (a.id % 7), chick = a.kind === 'chicken', idx = G.S.animals.filter(q => q.kind === a.kind).indexOf(a);
    if (chick) return { x: (35 + idx * 1.4 + Math.sin(t) * 0.7) * T, y: (7.6 + Math.cos(t * 1.3) * 0.5) * T + T / 2 };
    return { x: (34.5 + idx * 1.8 + Math.sin(t * 0.8) * 0.6) * T, y: (14.8 + Math.cos(t) * 0.5) * T + T / 2 };
  }
  function drawAnimal(a, i) {
    const pos = animalPos(a, i); ell(pos.x, pos.y + 2, 8, 3, 'rgba(0,0,0,.2)'); txt(a.kind === 'chicken' ? '🐔' : '🐄', pos.x, pos.y - 6, a.kind === 'chicken' ? 14 : 20);
    if (a.prod && a.pn > 0) txt(D.ITEMS[a.prod].icon, pos.x + 8, pos.y - 20 + Math.sin(G.t * 4) * 1.5, 10);
    if (!a.fed && Math.hypot(G.p.x - pos.x, G.p.y - pos.y) < 70) txt('🌾?', pos.x, pos.y - 22, 9);
  }
}
