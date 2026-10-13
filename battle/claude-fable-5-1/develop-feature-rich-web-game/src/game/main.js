// ============ TETRIS ULTIMATE — GAME SHELL ============
import { Game, COLS, ROWS, HIDDEN, SHAPES, GARBAGE_INDEX } from './core.js';
import { Bot } from './bot.js';
import { AudioEngine } from './audio.js';

// ---------- persistence ----------
const LS = {
  get(k, d) { try { const v = localStorage.getItem('tu_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('tu_' + k, JSON.stringify(v)); } catch (e) {} },
};

// ---------- themes ----------
const THEMES = {
  neon: { name: 'Neon', unlock: 1, bg1: '#070a1c', bg2: '#131a42', frame: '#3346a8', grid: 'rgba(130,150,255,0.08)', accent: '#00e5ff', text: '#e8ecff', garbage: '#5a6075', pieces: ['#00e5ff', '#ffe600', '#c86bff', '#45f775', '#ff4560', '#4973ff', '#ff9a3d'] },
  retro: { name: 'Retro', unlock: 2, bg1: '#0f1a0f', bg2: '#1c2e18', frame: '#4a7a3a', grid: 'rgba(155,255,155,0.07)', accent: '#9bde7c', text: '#d8f5c8', garbage: '#4e5a44', pieces: ['#9bde7c', '#cfe877', '#7cbf6a', '#b4e55f', '#e0f09a', '#6aa84f', '#aacf6e'] },
  ocean: { name: 'Ocean', unlock: 3, bg1: '#03111f', bg2: '#082c47', frame: '#1a6a9e', grid: 'rgba(110,210,255,0.08)', accent: '#39c6ff', text: '#dbf2ff', garbage: '#44586a', pieces: ['#39c6ff', '#7ef3d0', '#6a8dff', '#3ee6a0', '#ff7eb6', '#2e7eff', '#ffd47e'] },
  sunset: { name: 'Sunset', unlock: 4, bg1: '#1c0a14', bg2: '#3d1430', frame: '#a8456e', grid: 'rgba(255,160,130,0.08)', accent: '#ff9966', text: '#ffe9dc', garbage: '#6a4a52', pieces: ['#ffcc5c', '#ff9966', '#ff5e7e', '#c86bff', '#ff4560', '#ff7eb6', '#ffa94d'] },
};

// ---------- difficulty / modes ----------
const DIFFS = {
  easy: { label: 'EASY', grav: 0.6, start: 1, xp: 0.8, blurb: 'Slow gravity' },
  normal: { label: 'NORMAL', grav: 1.0, start: 1, xp: 1.0, blurb: 'Standard guideline speed' },
  hard: { label: 'HARD', grav: 1.5, start: 5, xp: 1.5, blurb: 'Fast gravity, starts at level 5' },
};
const AI_DIFFS = {
  easy: { label: 'ROOKIE-9', speed: 2.5, err: 0.35, useHold: false, reaction: 650, xp: 1.0, blurb: 'Slow and sloppy' },
  normal: { label: 'VETERAN-77', speed: 4.5, err: 0.15, useHold: false, reaction: 380, xp: 1.6, blurb: 'Steady pressure' },
  hard: { label: 'ELITE-X', speed: 8, err: 0.04, useHold: true, reaction: 220, xp: 2.2, blurb: 'Fast, rarely misplays' },
  master: { label: 'MASTER CORE', speed: 13, err: 0, useHold: true, reaction: 90, xp: 3.5, boss: true, blurb: 'BOSS — perfect play + garbage surges' },
};
const MODES = {
  marathon: { name: 'MARATHON', icon: '🏁', desc: 'Survive the gravity curve and reach Level 15 to win. The classic campaign.' },
  sprint: { name: 'SPRINT', icon: '⚡', desc: 'Clear 40 lines as fast as you can. Pure speed — the clock is the enemy.' },
  ultra: { name: 'ULTRA', icon: '⏱', desc: '2-minute score attack. Stack T-spins, combos and back-to-backs for max points.' },
  zen: { name: 'ZEN', icon: '🧘', desc: 'Endless, pressure-free stacking. Topping out just resets the board.' },
  battle: { name: 'AI BATTLE', icon: '🤖', desc: 'Duel an AI. Line clears send garbage. Defeat the MASTER CORE boss to prove yourself.' },
};
const MODE_KEYS = ['marathon', 'sprint', 'ultra', 'zen', 'battle'];

const DAS = 140, ARR = 30;

function fmtTime(ms) {
  ms = Math.max(0, ms);
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), c = Math.floor((ms % 1000) / 10);
  return m + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0');
}
function metaLevel(xp) { let l = 1; while (xp >= 300 * l * (l + 1)) l++; return l; }
function xpFloor(l) { return l <= 1 ? 0 : 300 * (l - 1) * l; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ====================================================================
export function initTetris(container) {
  // ---------- DOM ----------
  container.innerHTML = `
    <canvas id="tu-canvas"></canvas>
    <div id="tu-ui"></div>
    <div id="tu-touch">
      <div class="tt-cluster tt-left">
        <button class="tt-btn" data-k="left">◀</button>
        <button class="tt-btn" data-k="soft">▼</button>
        <button class="tt-btn" data-k="right">▶</button>
      </div>
      <div class="tt-cluster tt-right">
        <button class="tt-btn" data-k="ccw">⟲</button>
        <button class="tt-btn" data-k="cw">⟳</button>
        <button class="tt-btn" data-k="hold">H</button>
        <button class="tt-btn tt-drop" data-k="hard">⤓</button>
      </div>
      <button class="tt-btn tt-pause" data-k="pause">❚❚</button>
    </div>
    <div id="tu-toasts"></div>`;
  const canvas = container.querySelector('#tu-canvas');
  const ctx = canvas.getContext('2d');
  const ui = container.querySelector('#tu-ui');
  const touchEl = container.querySelector('#tu-touch');
  const toastsEl = container.querySelector('#tu-toasts');

  // ---------- persistent state ----------
  const settings = Object.assign({ master: 0.8, music: 0.55, sfx: 0.8, muted: false, ghost: true, shake: true, theme: 'neon' }, LS.get('settings', {}));
  const meta = Object.assign({ xp: 0, games: 0, wins: 0, lines: 0, score: 0, tetris: 0, tspins: 0, best: {}, aiWins: { easy: 0, normal: 0, hard: 0, master: 0 } }, LS.get('meta', {}));
  const lb = LS.get('lb', {});
  const saveAll = () => { LS.set('settings', settings); LS.set('meta', meta); LS.set('lb', lb); };

  const audio = new AudioEngine(settings);

  // ---------- shell state ----------
  let state = 'title';           // title|modes|help|settings|records|play|pause|end
  let backTarget = 'title';
  let selMode = LS.get('selMode', 'marathon');
  let selDiff = LS.get('selDiff', 'normal');
  let selAiDiff = LS.get('selAiDiff', 'easy');
  let recTab = 'marathon';
  let run = null;
  let vw = 0, vh = 0, dpr = 1;
  let rafId = 0, lastT = 0, destroyed = false;
  let bgTime = 0;

  // juice
  let particles = [], floats = [], flashes = [];
  let shakeMag = 0, flashA = 0;
  let dispScore = 0;
  const bgPieces = [];
  for (let i = 0; i < 14; i++) {
    bgPieces.push({ t: (Math.random() * 7) | 0, x: Math.random(), y: Math.random(), r: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.3, vy: 0.02 + Math.random() * 0.05, s: 14 + Math.random() * 26, a: 0.05 + Math.random() * 0.08 });
  }

  // input
  const held = { left: false, right: false };
  const das = { dir: 0, t: 0, arr: 0 };
  let touchSeen = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  const layout = { p: null, a: null };
  const T = () => THEMES[settings.theme] || THEMES.neon;
  const masterUnlocked = () => metaLevel(meta.xp) >= 5 || meta.aiWins.hard > 0;

  // ================= helpers =================
  function toast(msg, icon) {
    const d = document.createElement('div');
    d.className = 'tu-toast';
    d.innerHTML = (icon || '✦') + ' ' + esc(msg);
    toastsEl.appendChild(d);
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, 3200);
  }

  function addFloat(x, y, text, color, size) {
    floats.push({ x, y, text, color: color || '#fff', size: size || 22, t: 0, life: 1100 });
    if (floats.length > 24) floats.shift();
  }
  function addParts(x, y, color, n, spread) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (spread || 120) * (0.3 + Math.random());
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, t: 0, life: 500 + Math.random() * 500, color, size: 2 + Math.random() * 4 });
    }
    if (particles.length > 650) particles.splice(0, particles.length - 650);
  }
  function shake(m) { if (settings.shake) shakeMag = Math.min(22, Math.max(shakeMag, m)); }

  // ================= run lifecycle =================
  function makeGameCfg(mode, diffKey, seed) {
    const d = DIFFS[diffKey] || DIFFS.normal;
    switch (mode) {
      case 'marathon': return { seed, gravityMult: d.grav, startLevel: d.start, linesPerLevel: 10, levelCap: 15 };
      case 'sprint': return { seed, gravityMult: d.grav, startLevel: 1, linesPerLevel: 999 };
      case 'ultra': return { seed, gravityMult: d.grav, startLevel: 1, linesPerLevel: 999 };
      case 'zen': return { seed, zen: true, gravityMult: 0.7, startLevel: 1, linesPerLevel: 10, gravityLevelCap: 6 };
      case 'battle': return { seed, gravityMult: 1, startLevel: 1, linesPerLevel: 12, gravityLevelCap: 9 };
      default: return { seed };
    }
  }

  function startRun(mode, diffKey, aiKey) {
    const seed = (Math.random() * 1e9) | 0;
    const game = new Game(makeGameCfg(mode, diffKey, seed));
    run = {
      mode, diff: diffKey, aiDiff: aiKey, game, aiGame: null, bot: null,
      time: 0, countdown: 3.4, over: false, result: null,
      surgeT: 0, surgeWarned: false, lastBeep: -1,
    };
    if (mode === 'battle') {
      run.aiGame = new Game(makeGameCfg(mode, diffKey, seed));
      const a = AI_DIFFS[aiKey] || AI_DIFFS.easy;
      run.bot = new Bot(run.aiGame, a);
    }
    particles = []; floats = []; flashes = [];
    shakeMag = 0; flashA = 0; dispScore = 0;
    das.dir = 0; held.left = held.right = false;
    audio.ensure();
    audio.setLevel(game.level);
    audio.stopMusic();
    audio.muffle(false);
    state = 'play';
    recalcLayout();
    renderUI();
  }

  function finishRun(win, reason) {
    if (!run || run.over) return;
    run.over = true; state = 'end';
    const g = run.game;
    audio.stopMusic(); audio.muffle(false);
    audio.sfx(win ? 'victory' : 'gameover');
    if (win) { flashA = 0.5; } else { shake(16); }

    // ----- meta / xp -----
    const diffMult = run.mode === 'battle' ? (AI_DIFFS[run.aiDiff] || AI_DIFFS.easy).xp : (DIFFS[run.diff] || DIFFS.normal).xp;
    let gained = Math.floor((Math.floor(g.score / 100) + g.lines * 5 + (win ? 150 : 25)) * diffMult);
    if (win && run.mode === 'battle' && run.aiDiff === 'master') gained += 500;
    const lvlBefore = metaLevel(meta.xp);
    meta.xp += gained; meta.games++; meta.lines += g.lines; meta.score += g.score;
    meta.tetris += g.stats.tetris; meta.tspins += g.stats.tspins;
    if (win) meta.wins++;
    if (win && run.mode === 'battle') meta.aiWins[run.aiDiff] = (meta.aiWins[run.aiDiff] || 0) + 1;
    const lvlAfter = metaLevel(meta.xp);
    const unlocks = [];
    if (lvlAfter > lvlBefore) {
      for (const [k, th] of Object.entries(THEMES)) {
        if (th.unlock > lvlBefore && th.unlock <= lvlAfter) unlocks.push(th.name + ' theme unlocked!');
      }
      if (lvlAfter >= 5 && lvlBefore < 5) unlocks.push('MASTER CORE boss unlocked!');
      unlocks.unshift('Pilot level ' + lvlAfter + ' reached!');
    }
    if (win && run.mode === 'battle' && run.aiDiff === 'hard' && meta.aiWins.hard === 1 && metaLevel(meta.xp) < 5) {
      unlocks.push('MASTER CORE boss unlocked!');
    }

    // ----- leaderboard -----
    let rank = -1;
    const lbKey = run.mode + '_' + (run.mode === 'battle' ? run.aiDiff : run.diff);
    const isSprint = run.mode === 'sprint';
    const record = isSprint ? (win ? run.time : null)
      : run.mode === 'battle' ? (win ? g.score : null)
      : (g.score > 0 ? g.score : null);
    if (record !== null) {
      const list = lb[lbKey] || [];
      list.push({ v: record, lines: g.lines, level: g.level, date: Date.now() });
      list.sort((a, b) => isSprint ? a.v - b.v : b.v - a.v);
      lb[lbKey] = list.slice(0, 5);
      rank = lb[lbKey].findIndex(e => e.v === record);
      if (rank > 4) rank = -1;
    }
    run.result = { win, reason, gained, lvlBefore, lvlAfter, rank, unlocks };
    saveAll();
    setTimeout(() => unlocks.forEach((u, i) => setTimeout(() => { toast(u, '🏆'); audio.sfx('unlock'); }, i * 600)), 600);
    renderUI();
  }

  function quitToMenu(target) {
    run = null;
    audio.stopMusic(); audio.muffle(false);
    state = target || 'modes';
    renderUI();
  }

  function togglePause() {
    if (state === 'play' && run && !run.over) {
      state = 'pause'; audio.muffle(true); renderUI();
    } else if (state === 'pause') {
      state = 'play'; run.countdown = Math.max(run.countdown, 0.9); audio.muffle(false); renderUI();
    }
  }

  // ================= event processing =================
  function boardOrigin(isPlayer) { return isPlayer ? layout.p : layout.a; }

  function processEvents(g, isPlayer) {
    const L = boardOrigin(isPlayer);
    for (const ev of g.events) {
      switch (ev.type) {
        case 'clear': {
          if (L) {
            const cx = L.x + COLS * L.cell / 2;
            for (const rd of ev.rows) {
              const ry = L.y + (rd.y - HIDDEN) * L.cell;
              flashes.push({ x: L.x, y: ry, w: COLS * L.cell, h: L.cell, t: 0, life: 260 });
              for (let x = 0; x < COLS; x++) {
                const v = rd.cells[x];
                const col = v === GARBAGE_INDEX ? T().garbage : T().pieces[v] || '#fff';
                if (Math.random() < (isPlayer ? 0.9 : 0.4)) addParts(L.x + x * L.cell + L.cell / 2, ry + L.cell / 2, col, isPlayer ? 3 : 1, 140);
              }
            }
            const midY = L.y + (ev.rows.length ? (ev.rows[0].y - HIDDEN) * L.cell : 200);
            if (ev.text) addFloat(cx, midY - 10, ev.text + (ev.b2b ? ' B2B!' : ''), ev.tspin ? '#c86bff' : ev.n === 4 ? T().accent : '#fff', ev.n >= 4 || ev.tspin ? 30 : 22);
            if (ev.points > 0) addFloat(cx, midY + 22, '+' + ev.points, '#ffe600', 17);
            if (ev.combo >= 2) addFloat(cx, midY + 46, ev.combo + ' COMBO', '#ff9a3d', 18);
            if (ev.pc) { addFloat(cx, L.y + 180, 'PERFECT CLEAR!', '#7ef3d0', 34); flashA = Math.max(flashA, 0.45); }
          }
          if (isPlayer) {
            audio.sfx(ev.pc ? 'pc' : ev.tspin ? 'tspin' : ev.n === 4 ? 'tetris' : ev.n >= 2 ? 'clear2' : 'clear1');
            shake(ev.pc ? 15 : ev.n === 4 ? 13 : ev.tspin ? 10 : ev.n * 2.5);
            if (ev.n === 4 || ev.pc) flashA = Math.max(flashA, 0.22);
          }
          // battle garbage routing
          if (run && run.aiGame && ev.attack > 0) {
            const from = g, to = isPlayer ? run.aiGame : run.game;
            let atk = ev.attack;
            const cancel = Math.min(from.pending, atk);
            from.pending -= cancel; atk -= cancel;
            if (atk > 0) {
              to.pending += atk;
              const TL = boardOrigin(!isPlayer);
              if (TL) addFloat(TL.x + COLS * TL.cell / 2, TL.y + 60, '⚠ +' + atk, '#ff4560', 22);
              if (!isPlayer) audio.sfx('warn');
            }
          }
          break;
        }
        case 'lock':
          if (isPlayer) { audio.sfx('lock'); shake(1.5); }
          break;
        case 'harddrop':
          if (isPlayer && L) {
            audio.sfx('harddrop'); shake(4);
            for (const [x, y] of ev.cells) {
              if (y >= HIDDEN) addParts(L.x + x * L.cell + L.cell / 2, L.y + (y - HIDDEN) * L.cell, T().accent, 1, 60);
            }
          }
          break;
        case 'levelup':
          if (isPlayer) {
            audio.sfx('levelup'); audio.setLevel(ev.level);
            if (L) addFloat(L.x + COLS * L.cell / 2, L.y + 140, 'LEVEL ' + ev.level, T().accent, 30);
            flashA = Math.max(flashA, 0.15);
          }
          break;
        case 'garbage':
          if (isPlayer) { audio.sfx('garbage'); shake(Math.min(12, 3 + ev.n * 2)); }
          break;
        case 'hold': if (isPlayer) audio.sfx('hold'); break;
        case 'zenreset':
          if (isPlayer) {
            audio.sfx('garbage'); shake(10);
            if (L) addFloat(L.x + COLS * L.cell / 2, L.y + 160, 'BOARD RESET', '#ff9a3d', 26);
          }
          break;
        default: break;
      }
    }
    g.events.length = 0;
  }

  // ================= update =================
  function updatePlay(dt) {
    if (!run) return;
    if (run.countdown > 0) {
      const prev = Math.ceil(run.countdown);
      run.countdown -= dt / 1000;
      const cur = Math.ceil(run.countdown);
      if (cur !== prev && cur > 0) audio.sfx('count');
      if (run.countdown <= 0) {
        audio.sfx('go');
        audio.setLevel(run.game.level);
        if (!audio.playing) audio.startMusic();
      }
      return;
    }
    run.time += dt;
    const g = run.game;

    // DAS
    if (das.dir !== 0) {
      das.t += dt;
      if (das.t > DAS) {
        das.arr += dt;
        let guard = 0;
        while (das.arr >= ARR && guard++ < 12) {
          das.arr -= ARR;
          if (!g.move(das.dir)) { das.arr = 0; break; }
        }
      }
    }

    g.update(dt);
    processEvents(g, true);

    if (run.aiGame && !run.aiGame.over) {
      run.bot.update(dt);
      run.aiGame.update(dt);
      processEvents(run.aiGame, false);
      // boss surge
      if (run.aiDiff === 'master' && !g.over) {
        run.surgeT += dt;
        if (run.surgeT > 22000 && !run.surgeWarned) {
          run.surgeWarned = true;
          audio.sfx('warn');
          const L = layout.p;
          if (L) addFloat(L.x + COLS * L.cell / 2, L.y + 90, '⚠ SURGE INCOMING ⚠', '#ff4560', 24);
        }
        if (run.surgeT >= 25000) {
          run.surgeT = 0; run.surgeWarned = false;
          g.pending += 2;
          audio.sfx('garbage');
          const L = layout.p;
          if (L) addFloat(L.x + COLS * L.cell / 2, L.y + 120, '+2 SURGE', '#ff4560', 26);
        }
      }
    }

    // ultra final-seconds beeps
    if (run.mode === 'ultra') {
      const left = 120000 - run.time;
      const sec = Math.ceil(left / 1000);
      if (sec <= 5 && sec >= 1 && sec !== run.lastBeep) { run.lastBeep = sec; audio.sfx('count'); }
    }

    // ----- win / lose checks -----
    if (g.over) { finishRun(false, run.mode === 'battle' ? 'Your stack topped out — ' + (AI_DIFFS[run.aiDiff] || {}).label + ' wins.' : 'Your stack reached the top.'); return; }
    switch (run.mode) {
      case 'marathon':
        if (g.level >= 15 && g.lines >= (15 - g.cfg.startLevel) * 10) finishRun(true, 'Level 15 conquered — marathon complete!');
        break;
      case 'sprint':
        if (g.lines >= 40) finishRun(true, '40 lines cleared in ' + fmtTime(run.time) + '!');
        break;
      case 'ultra':
        if (run.time >= 120000) finishRun(true, 'Time! Final score ' + g.score.toLocaleString() + '.');
        break;
      case 'battle':
        if (run.aiGame && run.aiGame.over) finishRun(true, (AI_DIFFS[run.aiDiff] || {}).label + ' has been defeated!');
        break;
      default: break;
    }
  }

  function updateFx(dt) {
    shakeMag *= Math.exp(-dt / 110);
    if (shakeMag < 0.1) shakeMag = 0;
    flashA *= Math.exp(-dt / 140);
    if (flashA < 0.01) flashA = 0;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000;
      p.vy += 420 * dt / 1000;
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.t += dt;
      if (f.t >= f.life) floats.splice(i, 1);
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      flashes[i].t += dt;
      if (flashes[i].t >= flashes[i].life) flashes.splice(i, 1);
    }
  }

  // ================= layout & rendering =================
  function resize() {
    vw = container.clientWidth || window.innerWidth;
    vh = container.clientHeight || window.innerHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(vw * dpr));
    canvas.height = Math.max(1, Math.round(vh * dpr));
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    recalcLayout();
  }

  function recalcLayout() {
    const visRows = ROWS - HIDDEN;
    if (run && run.mode === 'battle') {
      const cell = Math.max(8, Math.floor(Math.min(vh * 0.68 / visRows, vw * 0.21 / COLS)));
      const bw = cell * COLS, gap = Math.min(cell * 9, vw - bw * 2 - 20);
      const y = Math.max(40, (vh - cell * visRows) / 2);
      layout.p = { x: Math.round(vw / 2 - gap / 2 - bw), y: Math.round(y), cell };
      layout.a = { x: Math.round(vw / 2 + gap / 2), y: Math.round(y), cell };
    } else {
      const cell = Math.max(10, Math.floor(Math.min(vh * 0.74 / visRows, vw * 0.3 / COLS)));
      layout.p = { x: Math.round(vw / 2 - cell * COLS / 2), y: Math.round(Math.max(44, (vh - cell * visRows) / 2 + 8)), cell };
      layout.a = null;
    }
  }

  function txt(s, x, y, size, color, align, weight, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.font = (weight || 700) + ' ' + size + 'px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
    ctx.globalAlpha = 1;
  }

  function drawCellRect(x, y, s, color, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x + 0.5, y + 0.5, s - 1, s - 1);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x + 0.5, y + 0.5, s - 1, Math.max(1, s * 0.18));
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 0.5, y + s - Math.max(1, s * 0.18), s - 1, Math.max(1, s * 0.18) - 0.5);
    ctx.globalAlpha = 1;
  }

  function drawMini(type, cx, cy, s, color, alpha) {
    const cells = SHAPES[type][0];
    let mnx = 9, mxx = -9, mny = 9, mxy = -9;
    for (const [x, y] of cells) { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); }
    const ox = cx - ((mxx - mnx + 1) * s) / 2 - mnx * s;
    const oy = cy - ((mxy - mny + 1) * s) / 2 - mny * s;
    for (const [x, y] of cells) drawCellRect(ox + x * s, oy + y * s, s, color, alpha);
  }

  function panel(x, y, w, h, title) {
    ctx.fillStyle = 'rgba(5,8,20,0.7)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = T().frame; ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    if (title) txt(title, x + w / 2, y + 13, 11, T().accent, 'center', 700);
  }

  function drawBoard(g, L, o) {
    const { x: bx, y: by, cell } = L;
    const W = COLS * cell, H = (ROWS - HIDDEN) * cell;
    const th = T();
    // frame
    ctx.save();
    ctx.shadowColor = o.boss ? '#ff3355' : th.accent;
    ctx.shadowBlur = 16;
    ctx.fillStyle = 'rgba(4,6,16,0.85)';
    ctx.fillRect(bx - 3, by - 3, W + 6, H + 6);
    ctx.restore();
    ctx.strokeStyle = o.boss ? '#ff3355' : th.frame;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 3, by - 3, W + 6, H + 6);
    // grid
    ctx.strokeStyle = th.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) { ctx.moveTo(bx + x * cell, by); ctx.lineTo(bx + x * cell, by + H); }
    for (let y = 1; y < ROWS - HIDDEN; y++) { ctx.moveTo(bx, by + y * cell); ctx.lineTo(bx + W, by + y * cell); }
    ctx.stroke();
    // stack
    let topFilled = ROWS;
    for (let y = HIDDEN; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = g.grid[y][x];
        if (v !== null) {
          if (y < topFilled) topFilled = y;
          drawCellRect(bx + x * cell, by + (y - HIDDEN) * cell, cell, v === GARBAGE_INDEX ? th.garbage : th.pieces[v]);
        }
      }
    }
    // danger tint
    const stackH = ROWS - topFilled;
    if (stackH >= 16 && !g.over) {
      ctx.fillStyle = 'rgba(255,40,70,' + (0.08 + 0.07 * Math.sin(bgTime / 120)) + ')';
      ctx.fillRect(bx, by, W, H);
    }
    // ghost
    if (g.cur && !g.over && settings.ghost && !o.isAI) {
      const gy = g.ghostY();
      ctx.strokeStyle = th.pieces[['I', 'O', 'T', 'S', 'Z', 'J', 'L'].indexOf(g.cur.type)];
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.45;
      for (const [cx2, cy2] of SHAPES[g.cur.type][g.cur.rot]) {
        const ax = g.cur.x + cx2, ay = gy + cy2;
        if (ay >= HIDDEN) ctx.strokeRect(bx + ax * cell + 2, by + (ay - HIDDEN) * cell + 2, cell - 4, cell - 4);
      }
      ctx.globalAlpha = 1;
    }
    // current piece (blink while locking)
    if (g.cur && !g.over) {
      const idx = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'].indexOf(g.cur.type);
      const lockP = g.grounded() ? Math.min(1, g.lockTimer / g.cfg.lockDelay) : 0;
      const alpha = lockP > 0 ? 0.55 + 0.45 * Math.abs(Math.sin(bgTime / 90)) : 1;
      for (const [cx2, cy2] of SHAPES[g.cur.type][g.cur.rot]) {
        const ax = g.cur.x + cx2, ay = g.cur.y + cy2;
        if (ay >= HIDDEN) drawCellRect(bx + ax * cell, by + (ay - HIDDEN) * cell, cell, th.pieces[idx], alpha);
      }
    }
    // pending garbage meter
    if (g.pending > 0) {
      const mh = Math.min(H, g.pending * cell);
      ctx.fillStyle = 'rgba(255,60,80,0.9)';
      ctx.fillRect(bx - 8, by + H - mh, 4, mh);
    }
    // label
    if (o.label) txt(o.label, bx + W / 2, by - 16, 13, o.boss ? '#ff5577' : th.text, 'center', 800);

    // panels
    const ps = o.mini ? Math.max(7, cell * 0.55) : Math.max(9, cell * 0.62);
    const pw = ps * 5.4;
    if (o.panelsLeft) {
      panel(bx - pw - 14, by, pw, ps * 4.2, 'HOLD');
      if (g.hold) drawMini(g.hold, bx - pw - 14 + pw / 2, by + ps * 2.4, ps, g.canHold ? th.pieces[['I', 'O', 'T', 'S', 'Z', 'J', 'L'].indexOf(g.hold)] : '#5a5f72');
    }
    if (o.panelsRight) {
      const nx = bx + W + 14;
      panel(nx, by, pw, ps * 10.4, 'NEXT');
      for (let i = 0; i < 3; i++) {
        const t = g.queue[i];
        if (t) drawMini(t, nx + pw / 2, by + ps * (2.4 + i * 3), ps, th.pieces[['I', 'O', 'T', 'S', 'Z', 'J', 'L'].indexOf(t)], i === 0 ? 1 : 0.8);
      }
    }
  }

  function objectiveText() {
    const g = run.game;
    switch (run.mode) {
      case 'marathon': return 'GOAL: LEVEL 15 · ' + (Math.max(0, (15 - g.cfg.startLevel) * 10 - g.lines)) + ' LINES TO GO';
      case 'sprint': return 'LINES LEFT: ' + Math.max(0, 40 - g.lines);
      case 'ultra': return 'TIME LEFT: ' + fmtTime(120000 - run.time);
      case 'zen': return 'ZEN · SESSION ' + fmtTime(run.time) + (g.stats.zenResets ? ' · RESETS ' + g.stats.zenResets : '');
      case 'battle': return 'DESTROY ' + (AI_DIFFS[run.aiDiff] || {}).label;
      default: return '';
    }
  }

  function drawHUD() {
    const g = run.game, th = T(), L = layout.p;
    dispScore += (g.score - dispScore) * 0.18;
    if (Math.abs(g.score - dispScore) < 1) dispScore = g.score;
    const W = COLS * L.cell;

    txt(MODES[run.mode].name + '  ·  ' + objectiveText(), vw / 2, 22, Math.min(16, vw / 42), th.text, 'center', 800);

    if (run.mode === 'battle') {
      const a = run.aiGame;
      txt(Math.round(dispScore).toLocaleString(), L.x + W / 2, L.y + (ROWS - HIDDEN) * L.cell + 22, 20, th.accent, 'center', 800);
      txt('LINES ' + g.lines + ' · ATK ' + g.stats.attack + ' · LV ' + g.level, L.x + W / 2, L.y + (ROWS - HIDDEN) * L.cell + 44, 12, th.text, 'center', 600);
      if (a) {
        const AL = layout.a;
        txt(a.score.toLocaleString(), AL.x + W / 2, AL.y + (ROWS - HIDDEN) * AL.cell + 22, 20, '#ff7788', 'center', 800);
        txt('LINES ' + a.lines + ' · ATK ' + a.stats.attack, AL.x + W / 2, AL.y + (ROWS - HIDDEN) * AL.cell + 44, 12, th.text, 'center', 600);
      }
      if (run.aiDiff === 'master' && run.countdown <= 0) {
        const p = Math.min(1, run.surgeT / 25000);
        const bw = 160;
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(vw / 2 - bw / 2, 38, bw, 6);
        ctx.fillStyle = p > 0.85 ? '#ff4560' : '#ff9a3d';
        ctx.fillRect(vw / 2 - bw / 2, 38, bw * p, 6);
        txt('SURGE', vw / 2, 54, 10, '#ff7788', 'center', 700);
      }
    } else {
      // left info column
      const ix = L.x - 14 - Math.max(9, L.cell * 0.62) * 5.4 / 2 - 7;
      const iy = L.y + Math.max(9, L.cell * 0.62) * 4.2 + 30;
      txt('SCORE', ix, iy, 11, th.accent, 'center', 700);
      txt(Math.round(dispScore).toLocaleString(), ix, iy + 22, 20, th.text, 'center', 800);
      txt('LINES', ix, iy + 52, 11, th.accent, 'center', 700);
      txt(String(g.lines), ix, iy + 72, 18, th.text, 'center', 800);
      txt('LEVEL', ix, iy + 102, 11, th.accent, 'center', 700);
      txt(String(g.level), ix, iy + 122, 18, th.text, 'center', 800);
      txt('TIME', ix, iy + 152, 11, th.accent, 'center', 700);
      txt(fmtTime(run.time), ix, iy + 172, 15, th.text, 'center', 700);
      // right column: pps / b2b / combo
      const rx = L.x + W + 14 + Math.max(9, L.cell * 0.62) * 5.4 / 2;
      const ry = L.y + Math.max(9, L.cell * 0.62) * 10.4 + 26;
      const pps = g.stats.pieces / Math.max(0.001, run.time / 1000);
      txt(pps.toFixed(2) + ' PPS', rx, ry, 12, th.text, 'center', 600);
      if (g.b2b) txt('B2B ⚡', rx, ry + 22, 13, '#ffe600', 'center', 800);
      if (g.combo >= 1) txt('COMBO ×' + g.combo, rx, ry + 44, 13, '#ff9a3d', 'center', 800);
    }
  }

  function drawBg(dt) {
    const th = T();
    const grd = ctx.createLinearGradient(0, 0, 0, vh);
    grd.addColorStop(0, th.bg1);
    grd.addColorStop(1, th.bg2);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, vw, vh);
    // drifting pieces
    for (const b of bgPieces) {
      b.y -= b.vy * dt / 1000;
      b.r += b.vr * dt / 1000;
      if (b.y < -0.1) { b.y = 1.1; b.x = Math.random(); }
      ctx.save();
      ctx.translate(b.x * vw, b.y * vh);
      ctx.rotate(b.r);
      ctx.globalAlpha = b.a;
      const col = th.pieces[b.t];
      for (const [x, y] of SHAPES[['I', 'O', 'T', 'S', 'Z', 'J', 'L'][b.t]][0]) {
        ctx.strokeStyle = col;
        ctx.strokeRect(x * b.s - b.s, y * b.s - b.s, b.s - 2, b.s - 2);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function render(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBg(dt);

    const sx = shakeMag ? (Math.random() - 0.5) * shakeMag : 0;
    const sy = shakeMag ? (Math.random() - 0.5) * shakeMag : 0;
    ctx.save();
    ctx.translate(sx, sy);

    if (run) {
      const dim = state === 'pause';
      drawBoard(run.game, layout.p, {
        label: run.mode === 'battle' ? 'YOU' : '',
        panelsLeft: true, panelsRight: true,
      });
      if (run.aiGame) {
        drawBoard(run.aiGame, layout.a, {
          label: (AI_DIFFS[run.aiDiff] || {}).label,
          isAI: true, boss: run.aiDiff === 'master', mini: true, panelsRight: false, panelsLeft: false,
        });
      }
      drawHUD();
      // line flashes
      for (const f of flashes) {
        ctx.globalAlpha = 0.85 * (1 - f.t / f.life);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(f.x, f.y, f.w, f.h);
        ctx.globalAlpha = 1;
      }
      // countdown
      if (state === 'play' && run.countdown > 0) {
        const n = Math.ceil(run.countdown);
        const frac = run.countdown - Math.floor(run.countdown);
        const sc = 1 + 0.6 * frac;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, vw, vh);
        ctx.save();
        ctx.translate(vw / 2, vh / 2);
        ctx.scale(sc, sc);
        txt(n > 3 ? 'READY' : String(n), 0, 0, 72, T().accent, 'center', 900);
        ctx.restore();
      }
      if (dim) {
        ctx.fillStyle = 'rgba(2,4,12,0.68)';
        ctx.fillRect(0, 0, vw, vh);
      }
    }

    // particles
    for (const p of particles) {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    // floating text
    for (const f of floats) {
      const k = f.t / f.life;
      const pop = Math.min(1, f.t / 110);
      const scale = 0.6 + 0.4 * (1 - Math.pow(1 - pop, 3));
      ctx.save();
      ctx.translate(f.x, f.y - k * 46);
      ctx.scale(scale, scale);
      ctx.shadowColor = f.color; ctx.shadowBlur = 12;
      txt(f.text, 0, 0, f.size, f.color, 'center', 900, k > 0.7 ? (1 - k) / 0.3 : 1);
      ctx.restore();
    }
    ctx.restore();

    if (flashA > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + flashA.toFixed(3) + ')';
      ctx.fillRect(0, 0, vw, vh);
    }
  }

  // ================= main loop =================
  function loop(t) {
    if (destroyed) return;
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(50, lastT ? t - lastT : 16);
    lastT = t;
    bgTime += dt;
    if (state === 'play') updatePlay(dt);
    updateFx(dt);
    audio.update();
    render(dt);
  }

  // ================= UI screens =================
  function profileHTML() {
    const lvl = metaLevel(meta.xp);
    const lo = xpFloor(lvl), hi = xpFloor(lvl + 1);
    const pct = Math.min(100, Math.round(((meta.xp - lo) / Math.max(1, hi - lo)) * 100));
    return `<div class="tu-profile">
      <div class="tu-prow"><span class="tu-plvl">PILOT LV ${lvl}</span><span class="tu-pxp">${meta.xp.toLocaleString()} XP</span></div>
      <div class="tu-bar"><div class="tu-barfill" style="width:${pct}%"></div></div>
      <div class="tu-psub">${meta.games} games · ${meta.lines.toLocaleString()} lines · ${meta.tetris} tetrises · ${meta.tspins} t-spins</div>
    </div>`;
  }

  function titleScreen() {
    return `<div class="tu-screen tu-center">
      <div class="tu-logo">TETRIS<span>ULTIMATE</span></div>
      <div class="tu-menu">
        <button class="tu-btn tu-big" data-a="modes">▶ &nbsp;PLAY</button>
        <button class="tu-btn" data-a="help">HOW TO PLAY</button>
        <button class="tu-btn" data-a="records">RECORDS</button>
        <button class="tu-btn" data-a="settings" data-v="title">SETTINGS</button>
      </div>
      ${profileHTML()}
      <div class="tu-hint">ENTER to play · M to mute</div>
    </div>`;
  }

  function bestFor(mode) {
    const key = mode + '_' + (mode === 'battle' ? selAiDiff : selDiff);
    const list = lb[key];
    if (!list || !list.length) return '—';
    return mode === 'sprint' ? fmtTime(list[0].v) : list[0].v.toLocaleString();
  }

  function modesScreen() {
    const mu = masterUnlocked();
    const cards = MODE_KEYS.map(k => {
      const m = MODES[k];
      return `<button class="tu-card ${selMode === k ? 'sel' : ''}" data-a="mode" data-v="${k}">
        <div class="tu-cicon">${m.icon}</div>
        <div class="tu-cname">${m.name}</div>
        <div class="tu-cdesc">${m.desc}</div>
        <div class="tu-cbest">BEST: ${bestFor(k)}</div>
      </button>`;
    }).join('');
    let diffRow;
    if (selMode === 'battle') {
      diffRow = Object.entries(AI_DIFFS).map(([k, d]) => {
        const locked = k === 'master' && !mu;
        return `<button class="tu-pill ${selAiDiff === k ? 'sel' : ''} ${locked ? 'locked' : ''} ${d.boss ? 'boss' : ''}" data-a="aidiff" data-v="${k}" ${locked ? 'disabled' : ''}>
          ${locked ? '🔒 ' : d.boss ? '👑 ' : ''}${d.label}<small>${locked ? 'Reach Pilot LV5 or beat ELITE-X' : d.blurb}</small></button>`;
      }).join('');
    } else {
      diffRow = Object.entries(DIFFS).map(([k, d]) =>
        `<button class="tu-pill ${selDiff === k ? 'sel' : ''}" data-a="diff" data-v="${k}">${d.label}<small>${d.blurb}</small></button>`).join('');
    }
    return `<div class="tu-screen">
      <div class="tu-head"><button class="tu-btn tu-small" data-a="title">◀ BACK</button><h2>SELECT MODE</h2><span></span></div>
      <div class="tu-cards">${cards}</div>
      <div class="tu-diffrow">${diffRow}</div>
      <div class="tu-footer"><button class="tu-btn tu-big tu-go" data-a="start">START ▶</button></div>
    </div>`;
  }

  function helpScreen() {
    return `<div class="tu-screen tu-scroll">
      <div class="tu-head"><button class="tu-btn tu-small" data-a="back">◀ BACK</button><h2>HOW TO PLAY</h2><span></span></div>
      <div class="tu-help">
        <h3>⌨ CONTROLS</h3>
        <table class="tu-table">
          <tr><td>← / →</td><td>Move (hold for auto-repeat)</td></tr>
          <tr><td>↓</td><td>Soft drop (+1 pt/cell)</td></tr>
          <tr><td>SPACE</td><td>Hard drop (+2 pts/cell)</td></tr>
          <tr><td>↑ or X</td><td>Rotate clockwise</td></tr>
          <tr><td>Z or CTRL</td><td>Rotate counter-clockwise</td></tr>
          <tr><td>A</td><td>Rotate 180°</td></tr>
          <tr><td>C or SHIFT</td><td>Hold piece (once per piece)</td></tr>
          <tr><td>P or ESC</td><td>Pause</td></tr>
          <tr><td>R</td><td>Quick restart</td></tr>
          <tr><td>M</td><td>Mute</td></tr>
        </table>
        <h3>🧩 BASICS</h3>
        <p>Stack falling tetrominoes. Fill a full row to clear it. Clearing 4 rows at once is a <b>TETRIS</b> (800×level pts). The ghost outline shows where your piece will land. Gravity accelerates with level — use the <b>HOLD</b> box and the 3-piece preview to plan ahead.</p>
        <h3>🌀 T-SPINS</h3>
        <p>Rotate a <b>T piece</b> into a slot it couldn't fall into (its last action must be a rotation, with 3 of its 4 corners blocked). T-spin clears score huge: T-spin double = 1200×level, more than a tetris!</p>
        <h3>⚡ BACK-TO-BACK & COMBOS</h3>
        <p>Chaining tetrises and/or T-spin clears without a normal clear in between gives a <b>B2B ×1.5 bonus</b>. Clearing lines with consecutive pieces builds a <b>combo</b> for bonus points. A <b>Perfect Clear</b> (empty board) awards 3000×level.</p>
        <h3>🤖 AI BATTLE</h3>
        <p>Line clears send <b>garbage</b> to your opponent — doubles send 1, triples 2, tetrises 4, T-spin doubles 4, plus B2B and combo bonuses. Incoming garbage (red bar) can be <b>countered</b> by clearing lines before it lands. Topple the AI to win. The <b>MASTER CORE</b> boss plays perfectly and unleashes a +2 garbage SURGE every 25 seconds — watch the surge bar!</p>
        <h3>🏆 PROGRESSION</h3>
        <p>Every run earns <b>XP</b> based on score, lines, difficulty and victory. Pilot levels unlock new board themes (LV2–4) and the MASTER CORE boss (LV5 — or beat ELITE-X early). Records are saved per mode and difficulty.</p>
      </div>
    </div>`;
  }

  function settingsScreen() {
    const lvl = metaLevel(meta.xp);
    const themeBtns = Object.entries(THEMES).map(([k, t]) => {
      const locked = lvl < t.unlock;
      return `<button class="tu-pill ${settings.theme === k ? 'sel' : ''} ${locked ? 'locked' : ''}" data-a="theme" data-v="${k}" ${locked ? 'disabled' : ''}>
        ${locked ? '🔒 ' : ''}${t.name}<small>${locked ? 'Pilot LV' + t.unlock : ''}</small></button>`;
    }).join('');
    return `<div class="tu-screen tu-scroll">
      <div class="tu-head"><button class="tu-btn tu-small" data-a="back">◀ BACK</button><h2>SETTINGS</h2><span></span></div>
      <div class="tu-set">
        <h3>🔊 AUDIO</h3>
        <label>Master <input type="range" min="0" max="1" step="0.05" value="${settings.master}" data-s="master"></label>
        <label>Music <input type="range" min="0" max="1" step="0.05" value="${settings.music}" data-s="music"></label>
        <label>Effects <input type="range" min="0" max="1" step="0.05" value="${settings.sfx}" data-s="sfx"></label>
        <button class="tu-btn tu-small" data-a="mute">${settings.muted ? '🔇 UNMUTE' : '🔊 MUTE'}</button>
        <h3>🎮 GAMEPLAY</h3>
        <div class="tu-rowbtns">
          <button class="tu-btn tu-small" data-a="tog" data-v="ghost">GHOST PIECE: ${settings.ghost ? 'ON' : 'OFF'}</button>
          <button class="tu-btn tu-small" data-a="tog" data-v="shake">SCREEN SHAKE: ${settings.shake ? 'ON' : 'OFF'}</button>
        </div>
        <h3>🎨 THEME</h3>
        <div class="tu-diffrow tu-left">${themeBtns}</div>
        <h3>⚠ DATA</h3>
        <button class="tu-btn tu-small tu-danger" data-a="wipe">RESET ALL PROGRESS</button>
      </div>
    </div>`;
  }

  function recordsScreen() {
    const tabs = MODE_KEYS.map(k => `<button class="tu-pill ${recTab === k ? 'sel' : ''}" data-a="rectab" data-v="${k}">${MODES[k].name}</button>`).join('');
    const diffs = recTab === 'battle' ? Object.keys(AI_DIFFS) : Object.keys(DIFFS);
    const lists = diffs.map(d => {
      const list = lb[recTab + '_' + d] || [];
      const label = recTab === 'battle' ? AI_DIFFS[d].label : DIFFS[d].label;
      const rows = list.length ? list.map((e, i) =>
        `<tr><td>#${i + 1}</td><td>${recTab === 'sprint' ? fmtTime(e.v) : e.v.toLocaleString()}</td><td>${e.lines} ln</td><td>${new Date(e.date).toLocaleDateString()}</td></tr>`).join('')
        : '<tr><td colspan="4" class="tu-dim">No records yet</td></tr>';
      return `<div class="tu-lbblock"><h4>${label}</h4><table class="tu-table">${rows}</table></div>`;
    }).join('');
    return `<div class="tu-screen tu-scroll">
      <div class="tu-head"><button class="tu-btn tu-small" data-a="title">◀ BACK</button><h2>RECORDS</h2><span></span></div>
      ${profileHTML()}
      <div class="tu-diffrow">${tabs}</div>
      <div class="tu-lbwrap">${lists}</div>
    </div>`;
  }

  function pauseScreen() {
    return `<div class="tu-screen tu-center tu-overlay">
      <h2 class="tu-ptitle">PAUSED</h2>
      <div class="tu-menu">
        <button class="tu-btn tu-big" data-a="resume">▶ RESUME</button>
        <button class="tu-btn" data-a="restart">↻ RESTART</button>
        ${run && run.mode === 'zen' ? '<button class="tu-btn" data-a="endzen">✔ END SESSION</button>' : ''}
        <button class="tu-btn" data-a="settings" data-v="pause">SETTINGS</button>
        <button class="tu-btn" data-a="quit">✖ QUIT TO MENU</button>
      </div>
      <div class="tu-hint">ESC to resume</div>
    </div>`;
  }

  function endScreen() {
    const r = run.result, g = run.game;
    const title = r.win ? 'VICTORY!' : 'GAME OVER';
    const pps = (g.stats.pieces / Math.max(0.001, run.time / 1000)).toFixed(2);
    const stats = [
      ['Score', g.score.toLocaleString()],
      ['Time', fmtTime(run.time)],
      ['Lines', g.lines],
      ['Level', g.level],
      ['Pieces', g.stats.pieces + ' (' + pps + '/s)'],
      ['Max combo', g.stats.maxCombo > 0 ? '×' + g.stats.maxCombo : '—'],
      ['Tetrises', g.stats.tetris],
      ['T-spins', g.stats.tspins],
    ];
    if (g.stats.pcs) stats.push(['Perfect clears', g.stats.pcs]);
    if (run.mode === 'battle') stats.push(['Attack sent', g.stats.attack]);
    if (run.mode === 'zen' && g.stats.zenResets) stats.push(['Board resets', g.stats.zenResets]);
    const rows = stats.map(([k, v]) => `<div class="tu-stat"><span>${k}</span><b>${v}</b></div>`).join('');
    const lvl = metaLevel(meta.xp);
    const lo = xpFloor(lvl), hi = xpFloor(lvl + 1);
    const pct = Math.min(100, Math.round(((meta.xp - lo) / Math.max(1, hi - lo)) * 100));
    return `<div class="tu-screen tu-center tu-overlay">
      <h2 class="tu-ptitle ${r.win ? 'win' : 'lose'}">${title}</h2>
      <div class="tu-reason">${esc(r.reason)}</div>
      ${r.rank === 0 ? '<div class="tu-record">🏆 NEW BEST RECORD!</div>' : r.rank > 0 ? `<div class="tu-record">★ Top ${r.rank + 1} record</div>` : ''}
      <div class="tu-stats">${rows}</div>
      <div class="tu-xpbox">+${r.gained.toLocaleString()} XP · PILOT LV ${lvl}
        <div class="tu-bar"><div class="tu-barfill" style="width:${pct}%"></div></div></div>
      <div class="tu-menu tu-row">
        <button class="tu-btn tu-big" data-a="retry">↻ RETRY</button>
        <button class="tu-btn" data-a="quit">MODES</button>
        <button class="tu-btn" data-a="title2">TITLE</button>
      </div>
    </div>`;
  }

  function renderUI() {
    touchEl.className = touchSeen && (state === 'play') ? 'show' : '';
    switch (state) {
      case 'title': ui.innerHTML = titleScreen(); break;
      case 'modes': ui.innerHTML = modesScreen(); break;
      case 'help': ui.innerHTML = helpScreen(); break;
      case 'settings': ui.innerHTML = settingsScreen(); break;
      case 'records': ui.innerHTML = recordsScreen(); break;
      case 'pause': ui.innerHTML = pauseScreen(); break;
      case 'end': ui.innerHTML = endScreen(); break;
      default: ui.innerHTML = ''; break;
    }
    ui.style.display = state === 'play' ? 'none' : 'flex';
  }

  // ================= UI actions =================
  function handleAction(a, v) {
    audio.ensure();
    switch (a) {
      case 'modes': state = 'modes'; audio.sfx('menuselect'); break;
      case 'title': case 'title2': quitToMenu('title'); audio.sfx('menumove'); return;
      case 'help': backTarget = state === 'pause' ? 'pause' : 'title'; state = 'help'; audio.sfx('menuselect'); break;
      case 'records': state = 'records'; audio.sfx('menuselect'); break;
      case 'settings': backTarget = v === 'pause' ? 'pause' : 'title'; state = 'settings'; audio.sfx('menuselect'); break;
      case 'back': state = backTarget; audio.sfx('menumove'); break;
      case 'mode': selMode = v; LS.set('selMode', v); audio.sfx('menumove'); break;
      case 'diff': selDiff = v; LS.set('selDiff', v); audio.sfx('menumove'); break;
      case 'aidiff': selAiDiff = v; LS.set('selAiDiff', v); audio.sfx('menumove'); break;
      case 'rectab': recTab = v; audio.sfx('menumove'); break;
      case 'start': audio.sfx('menuselect'); startRun(selMode, selDiff, selAiDiff); return;
      case 'resume': togglePause(); return;
      case 'restart': audio.sfx('menuselect'); startRun(run.mode, run.diff, run.aiDiff); return;
      case 'retry': audio.sfx('menuselect'); startRun(run.mode, run.diff, run.aiDiff); return;
      case 'quit': quitToMenu('modes'); audio.sfx('menumove'); return;
      case 'endzen': finishRun(true, 'Zen session complete. Well stacked.'); return;
      case 'mute': settings.muted = !settings.muted; audio.applyVolumes(); saveAll(); break;
      case 'tog': settings[v] = !settings[v]; saveAll(); audio.sfx('menumove'); break;
      case 'theme': {
        if (metaLevel(meta.xp) >= THEMES[v].unlock) { settings.theme = v; saveAll(); audio.sfx('menuselect'); }
        break;
      }
      case 'wipe':
        if (window.confirm('Reset ALL progress, records and settings?')) {
          try { ['settings', 'meta', 'lb', 'selMode', 'selDiff', 'selAiDiff'].forEach(k => localStorage.removeItem('tu_' + k)); } catch (e) {}
          window.location.reload();
        }
        break;
      default: return;
    }
    renderUI();
  }

  ui.addEventListener('click', e => {
    const el = e.target.closest('[data-a]');
    if (el && !el.disabled) handleAction(el.dataset.a, el.dataset.v);
  });
  ui.addEventListener('input', e => {
    const s = e.target.dataset.s;
    if (s) { settings[s] = parseFloat(e.target.value); audio.ensure(); audio.applyVolumes(); saveAll(); }
  });

  // ================= gameplay input =================
  function pressAction(k) {
    if (k === 'pause') { if (state === 'play' || state === 'pause') togglePause(); return; }
    if (state !== 'play' || !run || run.over || run.countdown > 0) return;
    const g = run.game;
    switch (k) {
      case 'left': held.left = true; das.dir = -1; das.t = 0; das.arr = 0; if (g.move(-1)) audio.sfx('move'); break;
      case 'right': held.right = true; das.dir = 1; das.t = 0; das.arr = 0; if (g.move(1)) audio.sfx('move'); break;
      case 'soft': g.softActive = true; break;
      case 'hard': g.hardDrop(); break;
      case 'cw': if (g.rotate(1)) audio.sfx('rotate'); break;
      case 'ccw': if (g.rotate(-1)) audio.sfx('rotate'); break;
      case 'r180': if (g.rotate(2)) audio.sfx('rotate'); break;
      case 'hold': g.holdPiece(); break;
      default: break;
    }
  }
  function releaseAction(k) {
    if (!run) return;
    const g = run.game;
    switch (k) {
      case 'left': held.left = false; if (das.dir === -1) { das.dir = held.right ? 1 : 0; das.t = 0; das.arr = 0; } break;
      case 'right': held.right = false; if (das.dir === 1) { das.dir = held.left ? -1 : 0; das.t = 0; das.arr = 0; } break;
      case 'soft': g.softActive = false; break;
      default: break;
    }
  }

  const KEYMAP = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'soft', Space: 'hard',
    ArrowUp: 'cw', KeyX: 'cw', KeyZ: 'ccw', ControlLeft: 'ccw', ControlRight: 'ccw',
    KeyA: 'r180', KeyC: 'hold', ShiftLeft: 'hold', ShiftRight: 'hold',
  };

  function onKeyDown(e) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space'].includes(e.code)) e.preventDefault();
    audio.ensure();
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (state === 'play' || state === 'pause') { togglePause(); }
      else if (state === 'settings' || state === 'help') { state = backTarget; renderUI(); }
      else if (state === 'modes' || state === 'records') { state = 'title'; renderUI(); }
      return;
    }
    if (e.code === 'KeyM') {
      settings.muted = !settings.muted; audio.applyVolumes(); saveAll();
      toast(settings.muted ? 'Muted' : 'Sound on', '🔊');
      if (state === 'settings') renderUI();
      return;
    }
    if (e.code === 'KeyR' && run && (state === 'play' || state === 'end' || state === 'pause')) {
      startRun(run.mode, run.diff, run.aiDiff);
      return;
    }
    if (e.code === 'Enter') {
      if (state === 'title') { state = 'modes'; audio.sfx('menuselect'); renderUI(); return; }
      if (state === 'modes') { startRun(selMode, selDiff, selAiDiff); return; }
      if (state === 'end') { startRun(run.mode, run.diff, run.aiDiff); return; }
    }
    if (e.repeat) return;
    const k = KEYMAP[e.code];
    if (k) pressAction(k);
  }
  function onKeyUp(e) {
    const k = KEYMAP[e.code];
    if (k) releaseAction(k);
  }

  // touch buttons
  touchEl.querySelectorAll('.tt-btn').forEach(btn => {
    const k = btn.dataset.k;
    const down = e => { e.preventDefault(); touchSeen = true; audio.ensure(); pressAction(k); btn.classList.add('on'); };
    const up = e => { e.preventDefault(); releaseAction(k); btn.classList.remove('on'); };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  });

  function onBlur() { if (state === 'play' && run && !run.over) togglePause(); }
  function onVis() { if (document.hidden) onBlur(); }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', resize);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVis);

  resize();
  renderUI();
  rafId = requestAnimationFrame(loop);

  // cleanup for React unmount
  return function destroy() {
    destroyed = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', resize);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVis);
    if (audio.ctx) { try { audio.ctx.close(); } catch (e) {} }
    container.innerHTML = '';
  };
}
