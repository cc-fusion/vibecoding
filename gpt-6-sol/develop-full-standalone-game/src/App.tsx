import { useEffect, useRef, useState } from 'react';

type Screen = 'menu' | 'playing' | 'paused' | 'won' | 'lost';
type Enemy = { x: number; y: number; bx: number; by: number; hp: number; max: number; kind: 'scout' | 'armored' | 'boss'; phase: number; fire: number; r: number };
type Bullet = { x: number; y: number; vx: number; vy: number; friendly: boolean; r: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
type Star = { x: number; y: number; size: number; speed: number; alpha: number };
type Snapshot = { score: number; wave: number; hp: number; pulse: number; bossHp: number; bossMax: number; high: number; message: string };
const initial: Snapshot = { score: 0, wave: 1, hp: 4, pulse: 0, bossHp: 0, bossMax: 0, high: 0, message: '' };

// The complete game, including its styling and procedural artwork, lives in this file.
const css = `
*{box-sizing:border-box}html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}body{background:#050914;color:#f4f5ee;font-family:Arial,Helvetica,sans-serif}button{font:inherit;cursor:pointer}button:focus-visible{outline:2px solid #a8f0ed;outline-offset:5px}
.game{position:relative;width:100%;height:100dvh;overflow:hidden;background:#050914;isolation:isolate}.game canvas{position:absolute;inset:0;display:block;width:100%;height:100%;touch-action:none}.grain{position:absolute;inset:0;pointer-events:none;z-index:1;opacity:.13;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.78' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.45'/%3E%3C/svg%3E")}
.topbar{position:absolute;top:0;left:0;right:0;z-index:5;display:flex;align-items:center;justify-content:space-between;height:82px;padding:0 clamp(24px,5vw,76px);border-bottom:1px solid rgba(196,225,230,.12)}.mark{display:flex;align-items:center;gap:12px;font-size:15px;font-weight:900;letter-spacing:.06em;white-space:nowrap}.mark-glyph{display:inline-flex;width:29px;height:29px;align-items:center;justify-content:center;color:#a8f0ed;border:2px solid #a8f0ed;transform:rotate(-12deg);font-size:13px}.top-right{display:flex;align-items:center;gap:24px}.top-note{color:#91a1ae;font:10px 'Courier New',monospace;letter-spacing:.19em}.icon-button{width:35px;height:35px;display:grid;place-items:center;border:1px solid rgba(183,224,229,.27);background:rgba(5,12,25,.22);color:#e7efed;transition:border-color .2s,background .2s,transform .2s}.icon-button:hover{border-color:#a8f0ed;background:rgba(168,240,237,.1);transform:translateY(-2px)}
.menu{position:absolute;inset:82px 0 0;z-index:3;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:0 clamp(24px,8.2vw,130px) 34px;pointer-events:none}.menu-content{pointer-events:auto;max-width:680px;animation:reveal .8s cubic-bezier(.2,.8,.2,1) both}.eyebrow{display:flex;align-items:center;gap:13px;margin:0 0 21px;color:#a8f0ed;font:bold 11px 'Courier New',monospace;letter-spacing:.22em}.eyebrow:before{content:'';display:block;width:29px;height:1px;background:#a8f0ed}.hero-title{margin:0;font-family:Impact,'Arial Narrow','Arial Black',sans-serif;font-size:clamp(108px,15.8vw,252px);font-weight:900;letter-spacing:-.055em;line-height:.76;transform:skewX(-5deg);text-shadow:0 10px 60px rgba(0,0,0,.25)}.hero-title span{display:block}.hero-title .outline{color:transparent;-webkit-text-stroke:2px #e9f4f1;text-shadow:none;margin-left:5px}.menu-description{max-width:405px;margin:34px 0 30px;color:#b7c5c9;font-size:clamp(14px,1.25vw,17px);line-height:1.65}.action-row{display:flex;align-items:center;gap:23px;flex-wrap:wrap}.primary-button{display:inline-flex;align-items:center;justify-content:space-between;gap:45px;min-width:226px;height:57px;padding:0 20px 0 24px;border:1px solid #a8f0ed;background:#a8f0ed;color:#07111b;font:bold 12px 'Courier New',monospace;letter-spacing:.12em;box-shadow:0 0 35px rgba(111,230,225,.13);transition:transform .2s,background .2s,box-shadow .2s}.primary-button:hover{transform:translateY(-3px);background:#d7fff9;box-shadow:0 0 40px rgba(111,230,225,.28)}.primary-button span:last-child{font-size:23px;font-weight:normal;line-height:1}.micro-copy{color:#82919d;font:10px/1.8 'Courier New',monospace;letter-spacing:.1em}.bottom-line{position:absolute;bottom:28px;left:clamp(24px,5vw,76px);right:clamp(24px,5vw,76px);z-index:4;display:flex;justify-content:space-between;gap:20px;color:#7d8e9b;font:10px 'Courier New',monospace;letter-spacing:.14em;pointer-events:none}
.hud{position:absolute;z-index:4;top:102px;left:clamp(24px,5vw,76px);right:clamp(24px,5vw,76px);display:flex;justify-content:space-between;align-items:flex-start;pointer-events:none}.hud-group{display:flex;gap:clamp(26px,4vw,75px)}.hud-item{display:flex;flex-direction:column;gap:8px}.hud-label{color:#7e96a2;font:bold 10px 'Courier New',monospace;letter-spacing:.17em}.hud-value{color:#f4f5ee;font:bold 22px 'Courier New',monospace;line-height:1;letter-spacing:.02em}.hud-value small{color:#81939e;font-size:13px}.hull{display:flex;gap:5px;padding-top:2px}.hull i{display:block;width:17px;height:12px;background:#a8f0ed;clip-path:polygon(0 0,100% 0,80% 100%,20% 100%)}.hull i.empty{background:#334a55}.hud-pause{pointer-events:auto;margin-top:-3px}.boss-bar{position:absolute;z-index:4;top:162px;left:50%;width:min(320px,55vw);transform:translateX(-50%);text-align:center}.boss-bar span{display:block;margin-bottom:8px;color:#ffae9e;font:bold 10px 'Courier New',monospace;letter-spacing:.19em}.boss-track{height:4px;background:rgba(255,174,158,.2)}.boss-track div{height:100%;background:#ff9b89;box-shadow:0 0 13px #f87d76;transition:width .1s}.wave-message{position:absolute;z-index:4;top:29%;left:0;right:0;text-align:center;color:#eaf9f7;font:clamp(46px,7vw,90px) Impact,'Arial Black',sans-serif;letter-spacing:.035em;text-shadow:0 0 30px rgba(117,234,229,.35);pointer-events:none;animation:waveIn .35s ease-out both}.wave-message small{display:block;margin-bottom:10px;color:#a8f0ed;font:bold 11px 'Courier New',monospace;letter-spacing:.25em}.play-bottom{position:absolute;z-index:5;bottom:25px;left:clamp(24px,5vw,76px);right:clamp(24px,5vw,76px);display:flex;justify-content:space-between;align-items:flex-end;gap:20px}.pulse-button{width:190px;padding:10px 0;border:0;border-bottom:1px solid #a8f0ed;color:#a8f0ed;background:transparent;text-align:right;font:bold 11px 'Courier New',monospace;letter-spacing:.08em}.pulse-button:disabled{color:#687d89;border-color:#526574;cursor:not-allowed}.pulse-button:not(:disabled):hover{color:white;border-color:white}
.overlay{position:absolute;inset:0;z-index:7;display:flex;align-items:center;justify-content:center;padding:25px;background:rgba(3,8,18,.72);backdrop-filter:blur(11px);animation:fadeIn .25s ease-out}.result{width:min(580px,100%);text-align:center;animation:reveal .5s ease-out both}.result-kicker{margin:0 0 19px;color:#a8f0ed;font:bold 11px 'Courier New',monospace;letter-spacing:.23em}.result-title{margin:0;font:clamp(78px,11vw,148px)/.85 Impact,'Arial Black',sans-serif;letter-spacing:-.035em}.result-title.danger{color:#ff9b89}.result-desc{margin:24px auto 30px;max-width:390px;color:#a8b8c1;font-size:15px;line-height:1.6}.result-score{display:flex;justify-content:center;gap:48px;margin-bottom:33px}.result-score div{display:flex;flex-direction:column;gap:7px}.result-score strong{color:#f4f5ee;font:bold 27px 'Courier New',monospace}.result-actions{display:flex;align-items:center;justify-content:center;gap:25px;flex-wrap:wrap}.text-button{border:0;padding:12px 5px;background:none;color:#c7d5d7;font:bold 11px 'Courier New',monospace;letter-spacing:.12em}.text-button:hover{color:white}
@keyframes reveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes waveIn{from{opacity:0;transform:translateY(15px) scale(.94)}to{opacity:1;transform:translateY(0) scale(1)}}
@media(max-width:700px){.topbar{height:66px;padding:0 22px}.top-note{display:none}.menu{inset:66px 0 0;padding:0 27px 45px}.hero-title{font-size:clamp(91px,23vw,155px)}.menu-description{max-width:300px;margin:29px 0 25px}.action-row{gap:14px}.action-row .micro-copy{width:100%}.bottom-line{left:24px;right:24px;bottom:18px;font-size:9px}.bottom-line span:last-child{display:none}.hud{top:83px;left:21px;right:21px}.hud-group{gap:18px}.hud-label{font-size:9px}.hud-value{font-size:18px}.hull i{width:13px;height:10px}.boss-bar{top:145px}.play-bottom{left:21px;right:21px;bottom:18px}.play-bottom .micro-copy{max-width:140px;font-size:9px}.pulse-button{width:146px;font-size:10px}}
@media(max-height:650px){.menu-description{margin-top:18px;margin-bottom:18px}.hero-title{font-size:min(18vh,135px)}.eyebrow{margin-bottom:13px}.bottom-line{display:none}}
`;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const actions = useRef({ start: () => {}, pause: () => {}, menu: () => {}, pulse: () => {} });
  const soundRef = useRef(true);
  const audioRef = useRef<AudioContext | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [screen, setScreen] = useState<Screen>('menu');
  const [snap, setSnap] = useState<Snapshot>(initial);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let w = window.innerWidth, h = window.innerHeight, raf = 0, last = performance.now(), time = 0, uiTimer = 0;
    let high = 0;
    try { high = Number(localStorage.getItem('voidrun-high') || 0) || 0; } catch { /* Storage is optional. */ }
    const keys = new Set<string>();
    let stars: Star[] = [];
    const g = { phase: 'menu' as Screen, score: 0, wave: 1, hp: 4, x: w / 2, target: w / 2, pointer: false, invuln: 0, cooldown: 0, shoot: 0, waveTime: 0, transition: -1, message: '', messageTime: 0, shake: 0, enemies: [] as Enemy[], bullets: [] as Bullet[], particles: [] as Particle[] };

    function sound(freq: number, duration: number, type: OscillatorType = 'sine', volume = .045, end?: number) {
      if (!soundRef.current || !audioRef.current) return;
      try {
        const audio = audioRef.current;
        const osc = audio.createOscillator(), gain = audio.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, audio.currentTime);
        if (end) osc.frequency.exponentialRampToValueAtTime(end, audio.currentTime + duration);
        gain.gain.setValueAtTime(volume, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
        osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
      } catch { /* Audio feedback is nonessential. */ }
    }
    function unlockAudio() {
      try { if (!audioRef.current) audioRef.current = new AudioContext(); if (audioRef.current.state === 'suspended') void audioRef.current.resume(); } catch { /* Audio is optional. */ }
    }
    function publish() {
      const boss = g.enemies.find(e => e.kind === 'boss');
      setSnap({ score: g.score, wave: g.wave, hp: g.hp, pulse: g.cooldown, bossHp: boss?.hp || 0, bossMax: boss?.max || 0, high, message: g.messageTime > 0 ? g.message : '' });
    }
    function resize() {
      const old = w, rect = canvas!.getBoundingClientRect();
      w = rect.width || window.innerWidth; h = rect.height || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(w * dpr); canvas!.height = Math.round(h * dpr); ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.x = Math.max(26, Math.min(w - 26, g.x * w / old)); g.target = g.x;
      stars = Array.from({ length: Math.min(145, Math.floor(w * h / 7000)) }, () => ({ x: Math.random() * w, y: Math.random() * h, size: Math.random() * 1.5 + .35, speed: Math.random() * 23 + 9, alpha: Math.random() * .55 + .15 }));
    }
    function burst(x: number, y: number, color: string, count: number, force = 150) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, speed = (.2 + Math.random() * .8) * force, life = .25 + Math.random() * .5;
        g.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life, max: life, color, size: 1.5 + Math.random() * 3 });
      }
      if (g.particles.length > 260) g.particles.splice(0, g.particles.length - 260);
    }
    function spawnWave(n: number) {
      g.wave = n; g.waveTime = 0; g.transition = -1; g.bullets = []; g.enemies = [];
      g.message = n === 5 ? 'THE WARDEN' : `WAVE 0${n}`; g.messageTime = 2.2;
      if (n === 5) {
        const hp = w < 550 ? 36 : 54, y = Math.max(156, h * .23);
        g.enemies.push({ x: w / 2, y, bx: w / 2, by: y, hp, max: hp, kind: 'boss', phase: 0, fire: 1.8, r: 48 });
      } else {
        const cols = Math.max(4, Math.min(8, Math.floor((w - 35) / 90)));
        const rows = n === 1 ? 1 : n === 4 ? 3 : 2;
        const spacing = Math.min(92, (w - 68) / (cols - 1));
        for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
          const kind = n >= 2 && (row + col) % (n === 4 ? 2 : 3) === 0 ? 'armored' : 'scout';
          const hp = kind === 'armored' ? (n >= 4 ? 3 : 2) : 1;
          const x = w / 2 + (col - (cols - 1) / 2) * spacing, y = 155 + row * 62;
          g.enemies.push({ x, y, bx: x, by: y, hp, max: hp, kind, phase: col * .58 + row * .9, fire: 1.7 + Math.random() * 3.5, r: kind === 'armored' ? 18 : 15 });
        }
      }
      sound(470, .25, 'sine', .05, 190); publish();
    }
    function finish(won: boolean) {
      g.phase = won ? 'won' : 'lost';
      if (won) g.score += g.hp * 500;
      if (g.score > high) { high = g.score; try { localStorage.setItem('voidrun-high', String(high)); } catch { /* Ignore storage errors. */ } }
      sound(won ? 740 : 220, .48, won ? 'sine' : 'sawtooth', .09, won ? 1200 : 60);
      publish(); setScreen(g.phase);
    }
    function damage() {
      if (g.invuln > 0 || g.phase !== 'playing') return;
      g.hp--; g.invuln = 1.55; g.shake = 11; burst(g.x, h - 102, '#a8f0ed', 22, 190);
      sound(170, .32, 'sawtooth', .075, 50);
      if (g.hp <= 0) finish(false); else publish();
    }
    function destroy(e: Enemy) {
      g.enemies.splice(g.enemies.indexOf(e), 1);
      g.score += e.kind === 'boss' ? 3000 : e.kind === 'armored' ? 175 : 100;
      burst(e.x, e.y, e.kind === 'boss' ? '#ffb28e' : '#ff9385', e.kind === 'boss' ? 75 : 15, e.kind === 'boss' ? 260 : 125);
      g.shake = e.kind === 'boss' ? 15 : 3;
      sound(e.kind === 'boss' ? 110 : 230, e.kind === 'boss' ? .65 : .13, 'triangle', .045, 65);
      if (e.kind === 'boss') finish(true);
    }
    function pulse() {
      if (g.phase !== 'playing' || g.cooldown > 0) return;
      unlockAudio(); g.cooldown = 8; g.invuln = Math.max(g.invuln, .55);
      g.bullets = g.bullets.filter(b => b.friendly || Math.hypot(b.x - g.x, b.y - (h - 102)) > 220);
      burst(g.x, h - 102, '#a8f0ed', 46, 310); g.shake = 7;
      sound(190, .46, 'sine', .1, 760); publish();
    }
    function start() {
      unlockAudio(); keys.clear(); g.phase = 'playing'; g.score = 0; g.hp = 4; g.x = w / 2; g.target = w / 2; g.pointer = false;
      g.invuln = 1.4; g.cooldown = 0; g.shoot = .35; g.particles = []; g.shake = 0;
      spawnWave(1); setScreen('playing');
    }
    function pause() {
      if (g.phase === 'playing') { g.phase = 'paused'; keys.clear(); setScreen('paused'); }
      else if (g.phase === 'paused') { g.phase = 'playing'; last = performance.now(); setScreen('playing'); }
    }
    function menu() { g.phase = 'menu'; keys.clear(); g.bullets = []; g.enemies = []; g.particles = []; setScreen('menu'); }
    actions.current = { start, pause, menu, pulse };

    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'shift'].includes(key)) e.preventDefault();
      if (e.repeat && ['escape', 'p', 'enter', ' ', 'shift'].includes(key)) return;
      keys.add(key);
      if (key === 'escape' || key === 'p') pause();
      else if (key === 'enter' && ['menu', 'won', 'lost'].includes(g.phase)) start();
      else if (key === ' ' || key === 'shift') pulse();
    }
    function onKeyUp(e: KeyboardEvent) { keys.delete(e.key.toLowerCase()); }
    function onPointerMove(e: PointerEvent) {
      if (g.phase !== 'playing') return;
      if (e.pointerType === 'touch' && e.target !== canvas) return;
      const rect = canvas!.getBoundingClientRect();
      g.target = Math.max(26, Math.min(w - 26, e.clientX - rect.left)); g.pointer = true;
    }
    function onVisibility() { if (document.hidden && g.phase === 'playing') pause(); }

    function update(dt: number) {
      time += dt;
      for (const s of stars) { s.y += s.speed * dt * (g.phase === 'playing' ? 1.5 : .5); if (s.y > h) { s.y = 0; s.x = Math.random() * w; } }
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const p = g.particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(.97, dt * 60); p.vy *= Math.pow(.97, dt * 60); p.life -= dt;
        if (p.life <= 0) g.particles.splice(i, 1);
      }
      g.shake = Math.max(0, g.shake - dt * 30);
      if (g.phase !== 'playing') return;
      g.waveTime += dt; g.invuln = Math.max(0, g.invuln - dt); g.cooldown = Math.max(0, g.cooldown - dt); g.messageTime = Math.max(0, g.messageTime - dt);
      const direction = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
      if (direction) { g.x += direction * 510 * dt; g.target = g.x; }
      else if (g.pointer) g.x += (g.target - g.x) * Math.min(1, dt * 17);
      g.x = Math.max(26, Math.min(w - 26, g.x));
      g.shoot -= dt;
      if (g.shoot <= 0) { g.shoot += .135; g.bullets.push({ x: g.x, y: h - 126, vx: 0, vy: -760, r: 4, friendly: true }); }

      for (const e of g.enemies) {
        if (e.kind === 'boss') {
          e.x = w / 2 + Math.sin(g.waveTime * .95) * Math.max(0, Math.min(w * .29, w / 2 - 92));
          e.y = e.by + Math.sin(g.waveTime * 1.7) * 12; e.fire -= dt;
          if (e.fire <= 0) {
            e.fire = Math.max(.7, 1.25 - g.waveTime * .008);
            const angle = Math.atan2(h - 102 - e.y, g.x - e.x);
            for (let i = -2; i <= 2; i++) { const a = angle + i * .19; g.bullets.push({ x: e.x, y: e.y + 38, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, r: 6, friendly: false }); }
            sound(105, .12, 'triangle', .022, 75);
          }
        } else {
          e.x = Math.max(22, Math.min(w - 22, e.bx + Math.sin(g.waveTime * (1.3 + g.wave * .08) + e.phase) * Math.min(28, w * .045)));
          e.y = e.by + g.waveTime * (7 + g.wave * 2.4); e.fire -= dt;
          if (e.fire <= 0 && e.y < h - 190) {
            e.fire = Math.max(1.7, 4.6 - g.wave * .4) + Math.random() * 2.6;
            const a = Math.atan2(h - 102 - e.y, g.x - e.x), speed = 195 + g.wave * 20;
            g.bullets.push({ x: e.x, y: e.y + 14, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 5, friendly: false });
          }
        }
      }
      for (let i = g.bullets.length - 1; i >= 0; i--) {
        const b = g.bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y < -20 || b.y > h + 20 || b.x < -20 || b.x > w + 20) { g.bullets.splice(i, 1); continue; }
        if (b.friendly) {
          const target = g.enemies.find(e => Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r + (e.kind === 'boss' ? 18 : 0));
          if (target) { g.bullets.splice(i, 1); target.hp--; burst(b.x, b.y, '#baffef', 3, 55); if (target.hp <= 0) destroy(target); }
        } else if (Math.hypot(b.x - g.x, b.y - (h - 102)) < 15 + b.r) { g.bullets.splice(i, 1); damage(); }
        if (g.phase !== 'playing') return;
      }
      for (let i = g.enemies.length - 1; i >= 0; i--) {
        const e = g.enemies[i];
        if (e.kind !== 'boss' && e.y > h - 113) { g.enemies.splice(i, 1); burst(e.x, e.y, '#ff9385', 12); damage(); }
      }
      if (g.phase !== 'playing') return;
      if (!g.enemies.length && g.transition < 0) {
        g.transition = 1.8; g.score += g.wave * 300; g.message = 'SECTOR CLEAR'; g.messageTime = 1.5; g.hp = Math.min(4, g.hp + 1); sound(540, .36, 'sine', .06, 920);
      }
      if (g.transition >= 0) { g.transition -= dt; if (g.transition < 0) spawnWave(g.wave + 1); }
      uiTimer += dt; if (uiTimer > .08) { uiTimer = 0; publish(); }
    }

    function background() {
      const bg = ctx!.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#071321'); bg.addColorStop(.5, '#070d1b'); bg.addColorStop(1, '#090d19'); ctx!.fillStyle = bg; ctx!.fillRect(0, 0, w, h);
      const hero = g.phase === 'menu' || g.phase === 'won' || g.phase === 'lost';
      const px = hero ? w * (w < 700 ? .82 : .77) : w * .75, py = hero ? h * .52 : h * .39;
      const r = Math.min(w < 700 ? w * .68 : w * .34, h * .48);
      ctx!.save(); ctx!.globalAlpha = hero ? 1 : .35;
      const glow = ctx!.createRadialGradient(px, py, r * .55, px, py, r * 1.55);
      glow.addColorStop(0, 'rgba(39,122,139,.26)'); glow.addColorStop(1, 'rgba(39,122,139,0)'); ctx!.fillStyle = glow; ctx!.fillRect(px - r * 1.6, py - r * 1.6, r * 3.2, r * 3.2);
      ctx!.translate(px, py); ctx!.rotate(-.35); ctx!.strokeStyle = 'rgba(125,219,213,.17)'; ctx!.lineWidth = r * .16;
      ctx!.beginPath(); ctx!.ellipse(0, 0, r * 1.46, r * .42, 0, 0, Math.PI * 2); ctx!.stroke();
      ctx!.strokeStyle = 'rgba(169,239,224,.38)'; ctx!.lineWidth = 1.5; ctx!.beginPath(); ctx!.ellipse(0, 0, r * 1.5, r * .46, 0, 0, Math.PI * 2); ctx!.stroke();
      const planet = ctx!.createRadialGradient(-r * .42, -r * .45, r * .05, 0, 0, r);
      planet.addColorStop(0, '#2b6879'); planet.addColorStop(.43, '#183a51'); planet.addColorStop(.77, '#0b2035'); planet.addColorStop(1, '#071320');
      ctx!.fillStyle = planet; ctx!.shadowBlur = 45; ctx!.shadowColor = 'rgba(78,200,201,.4)'; ctx!.beginPath(); ctx!.arc(0, 0, r, 0, Math.PI * 2); ctx!.fill(); ctx!.shadowBlur = 0;
      ctx!.strokeStyle = 'rgba(142,232,222,.36)'; ctx!.lineWidth = 2; ctx!.beginPath(); ctx!.arc(0, 0, r, 0, Math.PI * 2); ctx!.stroke(); ctx!.restore();
      for (const s of stars) { ctx!.globalAlpha = s.alpha * (.7 + Math.sin(time * 2 + s.x) * .3); ctx!.fillStyle = '#c9eff2'; ctx!.fillRect(s.x, s.y, s.size, s.size); } ctx!.globalAlpha = 1;
      const floor = h * .62, fade = ctx!.createLinearGradient(0, floor, 0, h);
      fade.addColorStop(0, 'rgba(83,190,192,0)'); fade.addColorStop(1, 'rgba(83,190,192,.13)'); ctx!.strokeStyle = fade; ctx!.lineWidth = 1;
      for (let i = -8; i <= 8; i++) { ctx!.beginPath(); ctx!.moveTo(w / 2 + i * 18, floor); ctx!.lineTo(w / 2 + i * w * .16, h); ctx!.stroke(); }
      for (let i = 1; i < 8; i++) { const y = floor + (h - floor) * Math.pow(i / 8, 1.65); ctx!.beginPath(); ctx!.moveTo(0, y); ctx!.lineTo(w, y); ctx!.stroke(); }
      const vignette = ctx!.createRadialGradient(w / 2, h / 2, h * .1, w / 2, h / 2, Math.max(w, h) * .8);
      vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,3,12,.65)'); ctx!.fillStyle = vignette; ctx!.fillRect(0, 0, w, h);
    }
    function ship(x: number, y: number, scale = 1, alpha = 1) {
      ctx!.save(); ctx!.translate(x, y); ctx!.scale(scale, scale); ctx!.globalAlpha = alpha;
      const flame = 14 + Math.sin(time * 24) * 5;
      ctx!.fillStyle = '#ffab83'; ctx!.shadowColor = '#ff956a'; ctx!.shadowBlur = 22;
      ctx!.beginPath(); ctx!.moveTo(-7, 14); ctx!.lineTo(0, 14 + flame); ctx!.lineTo(7, 14); ctx!.fill();
      ctx!.fillStyle = '#d8fffa'; ctx!.shadowColor = '#8cebe7'; ctx!.shadowBlur = 22;
      ctx!.beginPath(); ctx!.moveTo(0, -26); ctx!.lineTo(9, -7); ctx!.lineTo(24, 13); ctx!.lineTo(8, 9); ctx!.lineTo(0, 15); ctx!.lineTo(-8, 9); ctx!.lineTo(-24, 13); ctx!.lineTo(-9, -7); ctx!.closePath(); ctx!.fill();
      ctx!.shadowBlur = 0; ctx!.fillStyle = '#194658'; ctx!.beginPath(); ctx!.moveTo(0, -16); ctx!.lineTo(6, 5); ctx!.lineTo(0, 9); ctx!.lineTo(-6, 5); ctx!.closePath(); ctx!.fill();
      ctx!.fillStyle = '#65d8dd'; ctx!.fillRect(-19, 8, 7, 3); ctx!.fillRect(12, 8, 7, 3); ctx!.restore();
    }
    function enemy(e: Enemy) {
      ctx!.save(); ctx!.translate(e.x, e.y); ctx!.shadowColor = '#ff826e'; ctx!.shadowBlur = e.kind === 'boss' ? 28 : 15;
      if (e.kind === 'boss') {
        ctx!.fillStyle = '#a94e56'; ctx!.beginPath(); ctx!.moveTo(-66, -25); ctx!.lineTo(-27, -13); ctx!.lineTo(0, -38); ctx!.lineTo(27, -13); ctx!.lineTo(66, -25); ctx!.lineTo(53, 20); ctx!.lineTo(21, 29); ctx!.lineTo(0, 42); ctx!.lineTo(-21, 29); ctx!.lineTo(-53, 20); ctx!.closePath(); ctx!.fill();
        ctx!.fillStyle = '#261a30'; ctx!.beginPath(); ctx!.moveTo(-49, -13); ctx!.lineTo(-19, 0); ctx!.lineTo(0, -21); ctx!.lineTo(19, 0); ctx!.lineTo(49, -13); ctx!.lineTo(37, 10); ctx!.lineTo(0, 19); ctx!.lineTo(-37, 10); ctx!.closePath(); ctx!.fill();
        ctx!.fillStyle = '#ffc0a2'; ctx!.beginPath(); ctx!.arc(0, 6, 12 + Math.sin(time * 8) * 2, 0, Math.PI * 2); ctx!.fill(); ctx!.fillRect(-48, 12, 11, 5); ctx!.fillRect(37, 12, 11, 5);
      } else {
        ctx!.fillStyle = e.kind === 'armored' ? '#c76e70' : '#ed9981'; ctx!.beginPath(); ctx!.moveTo(-e.r, -10); ctx!.lineTo(0, -3); ctx!.lineTo(e.r, -10); ctx!.lineTo(e.r - 4, 9); ctx!.lineTo(6, 13); ctx!.lineTo(0, 7); ctx!.lineTo(-6, 13); ctx!.lineTo(-e.r + 4, 9); ctx!.closePath(); ctx!.fill();
        ctx!.shadowBlur = 0; ctx!.fillStyle = '#351d30'; ctx!.fillRect(-6, -2, 12, 6); ctx!.fillStyle = '#ffd4ad'; ctx!.fillRect(-3, 0, 6, 3);
        if (e.kind === 'armored') { ctx!.strokeStyle = '#ffd0ae'; ctx!.lineWidth = 2; ctx!.strokeRect(-13, -11, 26, 21); }
      }
      ctx!.restore();
    }
    function draw() {
      ctx!.save(); if (g.shake > 0) ctx!.translate((Math.random() - .5) * g.shake, (Math.random() - .5) * g.shake);
      background();
      if (g.phase === 'menu') ship(w < 700 ? w * .8 : w * .76, h * .73 + Math.sin(time * 2) * 8, w < 700 ? 2.2 : 3.1, w < 700 ? .33 : .88);
      else {
        for (const e of g.enemies) enemy(e);
        for (const b of g.bullets) {
          ctx!.strokeStyle = b.friendly ? '#b2fff0' : '#ff9b83'; ctx!.shadowColor = ctx!.strokeStyle; ctx!.shadowBlur = 15; ctx!.lineWidth = b.friendly ? 3 : 4; ctx!.lineCap = 'round';
          ctx!.beginPath(); ctx!.moveTo(b.x, b.y); ctx!.lineTo(b.x - b.vx * .025, b.y - b.vy * .025); ctx!.stroke();
        }
        ctx!.shadowBlur = 0;
        if (g.phase === 'playing' || g.phase === 'paused') {
          ctx!.strokeStyle = 'rgba(170,239,233,.22)'; ctx!.lineWidth = 1; ctx!.beginPath(); ctx!.moveTo(0, h - 65); ctx!.lineTo(w, h - 65); ctx!.stroke();
          if (g.invuln <= 0 || Math.floor(time * 12) % 2 === 0) ship(g.x, h - 102);
          if (g.invuln > 0) { ctx!.strokeStyle = 'rgba(168,240,237,.42)'; ctx!.beginPath(); ctx!.arc(g.x, h - 102, 31, 0, Math.PI * 2); ctx!.stroke(); }
        }
      }
      for (const p of g.particles) { ctx!.globalAlpha = Math.max(0, p.life / p.max); ctx!.fillStyle = p.color; ctx!.fillRect(p.x, p.y, p.size, p.size); }
      ctx!.globalAlpha = 1; ctx!.restore();
    }
    function frame(now: number) { const dt = Math.min((now - last) / 1000, .033); last = now; update(dt); draw(); raf = requestAnimationFrame(frame); }
    resize(); publish();
    window.addEventListener('resize', resize); window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('pointermove', onPointerMove); canvas.addEventListener('pointerdown', onPointerMove); document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('pointermove', onPointerMove); canvas.removeEventListener('pointerdown', onPointerMove); document.removeEventListener('visibilitychange', onVisibility); void audioRef.current?.close(); audioRef.current = null; };
  }, []);

  const active = screen === 'playing' || screen === 'paused';
  return <div className="game">
    <style>{css}</style><canvas ref={canvasRef} aria-label="Void Run arcade game field" /><div className="grain" />
    <header className="topbar"><div className="mark"><span className="mark-glyph">V</span><span>VOID / RUN</span></div><div className="top-right"><span className="top-note">THE LAST LINE OF DEFENSE</span><button className="icon-button" aria-label={soundOn ? 'Mute sound' : 'Enable sound'} title={soundOn ? 'Mute sound' : 'Enable sound'} onClick={() => { soundRef.current = !soundOn; setSoundOn(!soundOn); }}>{soundOn ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a5 5 0 0 1 0 6M18 6a9 9 0 0 1 0 12"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/></svg>}</button></div></header>
    {screen === 'menu' && <><main className="menu"><div className="menu-content"><p className="eyebrow">A ONE-PILOT ARCADE ODYSSEY</p><h1 className="hero-title"><span>VOID</span><span className="outline">RUN</span></h1><p className="menu-description">Five waves. One ship. Hold the line against the swarm and bring down the Warden.</p><div className="action-row"><button className="primary-button" onClick={() => actions.current.start()}><span>INITIATE RUN</span><span aria-hidden="true">&#8599;</span></button><span className="micro-copy">MOVE: A / D, ARROWS, MOUSE OR DRAG<br />AUTO-FIRE ON &nbsp;·&nbsp; SPACE TO PULSE</span></div></div></main><div className="bottom-line"><span>01 / 05 &nbsp;·&nbsp; SECTOR DEFENSE</span><span>BUILT FOR THE BRAVE // EST. 2086</span></div></>}
    {active && <><div className="hud"><div className="hud-group"><div className="hud-item"><span className="hud-label">SCORE</span><span className="hud-value">{String(snap.score).padStart(6, '0')}</span></div><div className="hud-item"><span className="hud-label">WAVE</span><span className="hud-value">0{snap.wave}<small> / 05</small></span></div><div className="hud-item"><span className="hud-label">HULL</span><span className="hull" aria-label={`${snap.hp} of 4 hull points`}>{[0, 1, 2, 3].map(i => <i key={i} className={i >= snap.hp ? 'empty' : ''} />)}</span></div></div><button className="icon-button hud-pause" aria-label="Pause game" title="Pause game (Esc)" onClick={() => actions.current.pause()}><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="3" height="12"/><rect x="10" y="2" width="3" height="12"/></svg></button></div>{snap.bossMax > 0 && <div className="boss-bar"><span>THE WARDEN</span><div className="boss-track"><div style={{ width: `${snap.bossHp / snap.bossMax * 100}%` }} /></div></div>}{snap.message && screen === 'playing' && <div className="wave-message"><small>{snap.message === 'SECTOR CLEAR' ? 'SIGNAL CONFIRMED' : 'INCOMING HOSTILES'}</small>{snap.message}</div>}<div className="play-bottom"><span className="micro-copy">MOVE TO AIM<br />AUTO-FIRE ENGAGED</span><button className="pulse-button" disabled={snap.pulse > 0 || screen === 'paused'} onClick={() => actions.current.pulse()}>{snap.pulse > 0 ? `PULSE RECHARGING ${snap.pulse.toFixed(1)}S` : 'SPACE / PULSE READY'}</button></div></>}
    {screen === 'paused' && <div className="overlay"><div className="result"><p className="result-kicker">MISSION INTERRUPTED</p><h2 className="result-title">PAUSED</h2><p className="result-desc">Take a breath, pilot. The void can wait.</p><div className="result-actions"><button className="primary-button" onClick={() => actions.current.pause()}><span>RESUME RUN</span><span aria-hidden="true">&#8599;</span></button><button className="text-button" onClick={() => actions.current.menu()}>ABANDON RUN</button></div></div></div>}
    {(screen === 'won' || screen === 'lost') && <div className="overlay"><div className="result"><p className="result-kicker">{screen === 'won' ? 'MISSION COMPLETE // 05 OF 05' : `MISSION FAILED // WAVE 0${snap.wave}`}</p><h2 className={`result-title ${screen === 'lost' ? 'danger' : ''}`}>{screen === 'won' ? 'VICTORY' : 'GAME OVER'}</h2><p className="result-desc">{screen === 'won' ? 'The Warden has fallen. The stars are yours again.' : 'The line has broken. But there is always another run.'}</p><div className="result-score"><div><span className="hud-label">FINAL SCORE</span><strong>{String(snap.score).padStart(6, '0')}</strong></div><div><span className="hud-label">BEST SCORE</span><strong>{String(snap.high).padStart(6, '0')}</strong></div></div><div className="result-actions"><button className="primary-button" onClick={() => actions.current.start()}><span>FLY AGAIN</span><span aria-hidden="true">&#8599;</span></button><button className="text-button" onClick={() => actions.current.menu()}>MAIN MENU</button></div></div></div>}
  </div>;
}
