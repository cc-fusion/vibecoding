import { useCallback, useEffect, useRef, useState } from 'react';

// A complete canvas arcade game. All art, audio and styling are generated here.
const W = 1000, H = 600, FINAL_WAVE = 4;
type Phase = 'start' | 'playing' | 'paused' | 'lost' | 'won';
type Kind = 'seeker' | 'striker' | 'brute' | 'boss';
type Enemy = { x: number; y: number; r: number; hp: number; max: number; speed: number; kind: Kind; angle: number; fire: number; hit: number };
type Bullet = { x: number; y: number; vx: number; vy: number; life: number; hostile: boolean; damage: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
type Pickup = { x: number; y: number; life: number };
type Game = {
  p: { x: number; y: number; angle: number; hp: number; inv: number; dash: number; cooldown: number; dx: number; dy: number; shot: number };
  enemies: Enemy[]; bullets: Bullet[]; particles: Particle[]; pickups: Pickup[];
  wave: number; remaining: number; spawn: number; transition: number; score: number; kills: number; time: number; shake: number;
};
const stars = Array.from({ length: 110 }, (_, i) => ({ x: (i * 7919.7) % W, y: (i * 3317.3) % H, r: i % 9 ? .7 : 1.5, phase: i * 1.71 }));
const fresh = (): Game => ({
  p: { x: 500, y: 300, angle: -Math.PI / 2, hp: 100, inv: 0, dash: 0, cooldown: 0, dx: 0, dy: -1, shot: 0 },
  enemies: [], bullets: [], particles: [], pickups: [], wave: 1, remaining: 8, spawn: 1.4, transition: 0, score: 0, kills: 0, time: 0, shake: 0,
});
const hit = (ax: number, ay: number, ar: number, bx: number, by: number, br: number) => (ax - bx) ** 2 + (ay - by) ** 2 < (ar + br) ** 2;

function burst(g: Game, x: number, y: number, color: string, count: number, force = 120) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * 6.283, v = (.3 + Math.random()) * force, life = .25 + Math.random() * .45;
    g.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, size: 1.5 + Math.random() * 3, color });
  }
  if (g.particles.length > 250) g.particles.splice(0, g.particles.length - 250);
}
function spawnEnemy(g: Game, kind: Kind) {
  const side = Math.floor(Math.random() * 4), x = side === 0 ? 35 : side === 1 ? W - 35 : 60 + Math.random() * 880;
  const y = side === 2 ? 35 : side === 3 ? H - 35 : 60 + Math.random() * 480;
  const stats = kind === 'boss' ? [42, 42, 49] : kind === 'brute' ? [23, 6, 61] : kind === 'striker' ? [13, 2, 145] : [15, 2, 91];
  g.enemies.push({ x, y, r: stats[0], hp: stats[1], max: stats[1], speed: stats[2] + (kind === 'boss' ? 0 : g.wave * 7), kind, angle: 0, fire: 1.8, hit: 0 });
  burst(g, x, y, kind === 'boss' ? '#bd8eff' : '#fb8575', 12, 70);
}
function poly(c: CanvasRenderingContext2D, sides: number, radius: number, rot = 0) {
  c.beginPath(); for (let i = 0; i < sides; i++) { const a = rot + i * Math.PI * 2 / sides; if (!i) c.moveTo(Math.cos(a) * radius, Math.sin(a) * radius); else c.lineTo(Math.cos(a) * radius, Math.sin(a) * radius); } c.closePath();
}
function draw(c: CanvasRenderingContext2D, g: Game, phase: Phase, t: number) {
  c.fillStyle = '#07111d'; c.fillRect(0, 0, W, H);
  const bg = c.createRadialGradient(500, 280, 20, 500, 280, 560); bg.addColorStop(0, '#112c35'); bg.addColorStop(.55, '#0b1b2a'); bg.addColorStop(1, '#07111d'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
  c.save(); if (g.shake > 0 && phase === 'playing') c.translate((Math.random() - .5) * g.shake * 9, (Math.random() - .5) * g.shake * 9);
  c.strokeStyle = '#85c5c511'; c.lineWidth = 1;
  for (let x = 0; x <= W; x += 50) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0; y <= H; y += 50) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.strokeStyle = '#78d6c41e'; c.strokeRect(21, 21, 958, 558);
  c.beginPath(); c.arc(500, 300, 188, 0, 7); c.stroke(); c.beginPath(); c.arc(500, 300, 280, 0, 7); c.stroke();
  for (const s of stars) { c.globalAlpha = .2 + .35 * (1 + Math.sin(t * 1.3 + s.phase)) / 2; c.fillStyle = '#b6f5f0'; c.beginPath(); c.arc(s.x, s.y, s.r, 0, 7); c.fill(); } c.globalAlpha = 1;
  for (const item of g.pickups) { c.save(); c.translate(item.x, item.y); c.rotate(t * 1.8); c.shadowBlur = 20; c.shadowColor = '#9ef2bd'; c.strokeStyle = '#a4f8bf'; c.lineWidth = 2; poly(c, 4, 14, Math.PI / 4); c.stroke(); c.rotate(-t * 1.8); c.fillStyle = '#b9ffd0'; c.fillRect(-2, -7, 4, 14); c.fillRect(-7, -2, 14, 4); c.restore(); }
  for (const b of g.bullets) { c.shadowBlur = 17; c.shadowColor = b.hostile ? '#ff8a79' : '#85ffe9'; c.fillStyle = b.hostile ? '#ff8a79' : '#a6ffed'; c.beginPath(); c.arc(b.x, b.y, b.hostile ? 5 : 4, 0, 7); c.fill(); } c.shadowBlur = 0;
  for (const e of g.enemies) {
    c.save(); c.translate(e.x, e.y); c.rotate(e.angle);
    const color = e.kind === 'boss' ? '#bc9aff' : e.kind === 'brute' ? '#f8ba77' : '#fa817a';
    c.shadowBlur = e.hit > 0 ? 35 : 20; c.shadowColor = color; c.fillStyle = e.hit > 0 ? '#fff' : color; c.strokeStyle = color; c.lineWidth = 2;
    if (e.kind === 'seeker') { poly(c, 4, e.r, Math.PI / 4); c.fill(); c.fillStyle = '#582d3b'; poly(c, 4, e.r * .45, Math.PI / 4); c.fill(); }
    else if (e.kind === 'striker') { c.beginPath(); c.moveTo(e.r + 5, 0); c.lineTo(-e.r, -e.r * .8); c.lineTo(-e.r * .45, 0); c.lineTo(-e.r, e.r * .8); c.closePath(); c.fill(); }
    else { poly(c, e.kind === 'boss' ? 8 : 6, e.r, t * .3); c.stroke(); poly(c, e.kind === 'boss' ? 8 : 6, e.r * .73, -t * .3); c.fill(); c.fillStyle = '#241e38'; c.beginPath(); c.arc(0, 0, e.r * .36, 0, 7); c.fill(); }
    c.restore(); if (e.hp < e.max && e.kind !== 'boss') { c.fillStyle = '#243847'; c.fillRect(e.x - e.r, e.y - e.r - 13, e.r * 2, 3); c.fillStyle = color; c.fillRect(e.x - e.r, e.y - e.r - 13, e.r * 2 * e.hp / e.max, 3); }
  }
  if (phase !== 'start') {
    const p = g.p; c.save(); c.translate(p.x, p.y); c.rotate(p.angle);
    if (p.inv <= 0 || Math.floor(t * 14) % 2 === 0) { c.shadowBlur = 24; c.shadowColor = '#7bf3e3'; c.fillStyle = '#d5fff4'; c.beginPath(); c.moveTo(23, 0); c.lineTo(-15, -13); c.lineTo(-9, 0); c.lineTo(-15, 13); c.closePath(); c.fill(); c.fillStyle = '#44bbaf'; c.beginPath(); c.moveTo(3, 0); c.lineTo(-12, -6); c.lineTo(-8, 0); c.lineTo(-12, 6); c.closePath(); c.fill(); c.fillStyle = p.dash > 0 ? '#bdfdf4' : '#eea96f'; c.beginPath(); c.moveTo(-12, -5); c.lineTo(-21 - Math.random() * 9, 0); c.lineTo(-12, 5); c.fill(); }
    if (p.inv > 0) { c.rotate(-p.angle); c.strokeStyle = '#86ffeb88'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 27, 0, 7); c.stroke(); } c.restore();
  }
  for (const part of g.particles) { c.globalAlpha = Math.max(0, part.life / part.max); c.fillStyle = part.color; c.beginPath(); c.arc(part.x, part.y, part.size * part.life / part.max, 0, 7); c.fill(); } c.globalAlpha = 1; c.restore();
  const boss = g.enemies.find(e => e.kind === 'boss'); if (boss && phase === 'playing') { c.fillStyle = '#b6a8c5'; c.font = '11px monospace'; c.textAlign = 'center'; c.fillText('THE HARBINGER', 500, 42); c.fillStyle = '#3b2d4e'; c.fillRect(375, 53, 250, 5); c.fillStyle = '#bc9aff'; c.fillRect(375, 53, 250 * boss.hp / boss.max, 5); }
}

const styles = `
*{box-sizing:border-box}html{background:#080e18}body{margin:0;color:#e9f5f2;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button{font:inherit;cursor:pointer}button:focus-visible{outline:2px solid #9af8df;outline-offset:4px}
.app{min-height:100vh;background:radial-gradient(ellipse at 50% -20%,#183342 0%,#0b1622 43%,#080e18 90%);padding:0 30px 30px;overflow:hidden}.topbar{height:85px;max-width:1280px;margin:auto;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #28404a}.brand{display:flex;gap:12px;align-items:center;color:#f1f9f6;font-size:15px;font-weight:800;letter-spacing:.22em}.brand-mark{width:24px;height:24px;color:#9af3df}.top-right{display:flex;gap:22px;align-items:center}.edition,.sound,.eyebrow,.hud-label,.hint,.footer,.key,.result-label{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:.12em}.edition{color:#809aa2;font-size:11px}.sound{color:#b2c9ca;border:1px solid #34505a;background:transparent;border-radius:3px;padding:9px 13px;font-size:10px;transition:color .2s,border-color .2s}.sound:hover{color:#a2f5e1;border-color:#77b6af}.shell{max-width:1280px;margin:0 auto}.above{display:flex;justify-content:space-between;align-items:end;padding:29px 0 18px}.eyebrow{margin:0 0 8px;color:#75c9bb;font-size:11px;font-weight:700}.above h1{margin:0;font-size:clamp(25px,3vw,38px);font-weight:750;letter-spacing:-.055em;line-height:1}.above h1 span{color:#80e6d3}.session{text-align:right;color:#77939a;font-size:11px;line-height:1.8}.session strong{color:#c8dfda;font-weight:500}
.stage{position:relative;border:1px solid #3b6267;background:#07111d;overflow:hidden;box-shadow:0 22px 80px #01070b88,0 0 0 5px #0b1a23}canvas{width:100%;height:auto;aspect-ratio:5/3;display:block;cursor:crosshair;touch-action:none}.stage::after{content:'';position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,transparent 0px,transparent 3px,#0000000b 4px)}.hud{position:absolute;z-index:2;left:0;top:0;right:0;display:flex;align-items:flex-start;gap:28px;padding:22px 27px;pointer-events:none}.hud-block{min-width:78px}.hud-label{display:block;color:#789ba1;font-size:10px;margin-bottom:7px}.hud-value{font-family:ui-monospace,monospace;font-size:22px;font-weight:700;line-height:1;color:#e4f6ee}.hud-value small{color:#73949a;font-size:12px}.health{width:145px}.health-row{display:flex;align-items:center;gap:11px}.health-track,.dash-track{height:5px;background:#38505a;flex:1;overflow:hidden}.health-fill,.dash-fill{display:block;height:100%;transition:width .15s;background:#8debd2;box-shadow:0 0 10px #74f4d0}.health-fill.low{background:#ff857a;box-shadow:0 0 10px #ff857a}.dash-block{margin-left:auto;width:115px}.dash-track{margin-top:14px}
.veil{position:absolute;z-index:3;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:radial-gradient(ellipse at center,#07131ad9 0%,#07131adf 42%,#06111cea 100%);padding:22px}.start-veil{background:radial-gradient(ellipse at center,#07131ae8 0%,#07131acb 55%,#06111cd9 100%)}.tiny-line{display:flex;align-items:center;gap:13px;color:#8ce8d4;font:700 11px ui-monospace,monospace;letter-spacing:.28em}.tiny-line::before,.tiny-line::after{content:'';width:35px;height:1px;background:#62afa8}.hero-title{font-size:clamp(56px,10vw,134px);font-weight:800;letter-spacing:-.095em;line-height:.95;margin:25px 0 15px;color:#e9fbf3;text-shadow:0 0 60px #81e4cb44}.hero-title em{font-style:normal;color:#94efd9}.intro{max-width:440px;color:#b4c8c8;line-height:1.6;font-size:15px;margin:0 0 29px}.primary{border:0;background:#a8f2da;color:#09202a;font-weight:800;letter-spacing:.09em;text-transform:uppercase;padding:16px 30px;min-width:188px;font-size:12px;transition:transform .18s,background .18s,box-shadow .18s;box-shadow:0 8px 30px #72e8c52e}.primary:hover{transform:translateY(-3px);background:#d0ffe9;box-shadow:0 12px 34px #72e8c555}.hint{color:#77979c;font-size:10px;margin-top:27px}.result-label{color:#8ce8d4;font-size:11px}.result-title{font-size:clamp(42px,7vw,82px);letter-spacing:-.075em;line-height:1;margin:18px 0 12px}.result-copy{color:#afc7c7;line-height:1.6;max-width:360px;font-size:15px;margin:0 0 25px}.result-score{font:12px ui-monospace,monospace;color:#85a4a7;letter-spacing:.12em;margin-bottom:30px}.result-score strong{color:#e9f7ee;font-size:23px;letter-spacing:0;margin-left:8px}.pause-actions{display:flex;gap:12px}.secondary{border:1px solid #688e90;background:transparent;color:#d1e7e1;padding:15px 24px;text-transform:uppercase;letter-spacing:.08em;font-size:12px;font-weight:700}.secondary:hover{border-color:#a6f7df;color:#a6f7df}.wave-toast{position:absolute;z-index:2;top:48%;left:50%;transform:translate(-50%,-50%);pointer-events:none;text-align:center;white-space:nowrap;color:#ddfff2;font-weight:800;font-size:clamp(25px,5vw,46px);letter-spacing:-.05em;text-shadow:0 0 35px #76e4c1;animation:appear .3s ease-out}.wave-toast span{display:block;font:11px ui-monospace,monospace;letter-spacing:.25em;color:#92d9ca;margin-bottom:9px}@keyframes appear{from{opacity:0;transform:translate(-50%,-42%) scale(.94)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
.below{display:flex;justify-content:space-between;gap:35px;align-items:start;padding:24px 0 19px;border-bottom:1px solid #243b43}.mission{display:flex;gap:18px;max-width:480px}.mission-number{color:#81e6d3;font:12px ui-monospace,monospace;margin-top:3px}.mission h2{margin:0 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.12em}.mission p{margin:0;color:#8ca5a8;font-size:13px;line-height:1.5}.controls{display:flex;gap:22px;align-items:center;flex-wrap:wrap;justify-content:end}.control{color:#8fa8a9;font-size:11px;white-space:nowrap}.key{display:inline-block;color:#d2e8e2;border:1px solid #43616a;background:#142833;padding:7px 8px;margin-right:7px;font-size:10px}.footer{display:flex;justify-content:space-between;color:#607b84;font-size:10px;padding-top:16px}.touch-controls{display:none}
@media(max-width:800px){.app{padding:0 18px 25px}.topbar{height:70px}.edition,.session{display:none}.above{padding-top:23px}.below{flex-direction:column;gap:20px}.controls{justify-content:start;gap:10px}.hud{padding:12px;gap:13px}.hud-value{font-size:16px}.hud-label{font-size:8px}.hud-block{min-width:48px}.health{width:105px}.dash-block{width:60px}.hero-title{margin:13px 0}.intro{font-size:12px;margin-bottom:16px}.hint{margin-top:15px}}
@media(max-width:600px){.app{padding:0 12px 20px}.above h1{font-size:26px}.stage{margin:0 -12px;border-left:0;border-right:0}canvas{aspect-ratio:5/3}.veil{padding:14px}.hero-title{font-size:clamp(50px,13vw,75px)}.tiny-line{font-size:9px}.hint{display:none}.primary{padding:13px 20px;min-width:160px}.hud{gap:10px}.dash-block{display:none}.touch-controls{display:flex;align-items:center;justify-content:space-between;padding:19px 10px 7px;touch-action:none;user-select:none}.joystick{width:112px;height:112px;border:1px solid #476773;border-radius:50%;background:#142c36;display:grid;place-items:center;touch-action:none}.stick{width:46px;height:46px;border-radius:50%;background:#83d9c6;box-shadow:0 0 24px #70e0c477}.touch-right{display:flex;gap:12px;align-items:center}.touch-button{border:1px solid #75c9b8;background:#173f42;color:#d3f8e8;border-radius:50%;width:66px;height:66px;font:700 10px ui-monospace,monospace;letter-spacing:.08em;touch-action:none}.touch-button.fire{width:82px;height:82px;background:#8fe5ca;color:#09242c}.footer{font-size:9px}}
@media(max-width:390px){.hud{gap:7px}.health{width:85px}.hero-title{font-size:48px}.intro{font-size:11px}}
`;

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null), game = useRef<Game>(fresh()), phaseRef = useRef<Phase>('start');
  const keys = useRef(new Set<string>()), pointer = useRef({ x: 500, y: 200, active: false, down: false }), touch = useRef({ x: 0, y: 0, fire: false });
  const stick = useRef<HTMLDivElement>(null), audio = useRef<AudioContext | null>(null), mutedRef = useRef(false);
  const [phase, setPhaseState] = useState<Phase>('start');
  const [hud, setHud] = useState({ hp: 100, score: 0, wave: 1, cooldown: 0, transition: 0 });
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem('last-light-best')) || 0; } catch { return 0; } });
  const [muted, setMuted] = useState(false);
  const setPhase = useCallback((next: Phase) => { phaseRef.current = next; setPhaseState(next); }, []);
  const sound = useCallback((freq: number, duration: number, type: OscillatorType = 'sine', volume = .035) => {
    if (mutedRef.current) return;
    try { const a = audio.current ?? new AudioContext(); audio.current = a; if (a.state === 'suspended') void a.resume(); const osc = a.createOscillator(), gain = a.createGain(); osc.type = type; osc.frequency.setValueAtTime(freq, a.currentTime); osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * .55), a.currentTime + duration); gain.gain.setValueAtTime(volume, a.currentTime); gain.gain.exponentialRampToValueAtTime(.001, a.currentTime + duration); osc.connect(gain); gain.connect(a.destination); osc.start(); osc.stop(a.currentTime + duration); } catch { /* Audio is optional. */ }
  }, []);
  const finish = useCallback((result: 'lost' | 'won') => {
    const score = game.current.score; setBest(prev => { const next = Math.max(prev, score); try { localStorage.setItem('last-light-best', String(next)); } catch { /* Storage is optional. */ } return next; });
    setPhase(result); sound(result === 'won' ? 690 : 150, .55, result === 'won' ? 'sine' : 'sawtooth', .08);
  }, [setPhase, sound]);
  const start = useCallback(() => { game.current = fresh(); keys.current.clear(); pointer.current.down = false; touch.current.fire = false; setHud({ hp: 100, score: 0, wave: 1, cooldown: 0, transition: 0 }); setPhase('playing'); sound(560, .18, 'triangle', .06); canvas.current?.focus(); }, [setPhase, sound]);
  const dash = useCallback(() => {
    if (phaseRef.current !== 'playing') return; const p = game.current.p; if (p.cooldown > 0) return;
    let dx = Number(keys.current.has('KeyD') || keys.current.has('ArrowRight')) - Number(keys.current.has('KeyA') || keys.current.has('ArrowLeft')) + touch.current.x;
    let dy = Number(keys.current.has('KeyS') || keys.current.has('ArrowDown')) - Number(keys.current.has('KeyW') || keys.current.has('ArrowUp')) + touch.current.y;
    const len = Math.hypot(dx, dy); if (len) { dx /= len; dy /= len; } else { dx = Math.cos(p.angle); dy = Math.sin(p.angle); }
    p.dx = dx; p.dy = dy; p.dash = .22; p.cooldown = 3.2; p.inv = Math.max(p.inv, .32); burst(game.current, p.x, p.y, '#9af9e5', 18, 150); sound(330, .2, 'sawtooth', .04);
  }, [sound]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) { if (phaseRef.current === 'playing') setPhase('paused'); else if (phaseRef.current === 'paused') setPhase('playing'); }
      else if (e.code === 'Enter' && !e.repeat) { if (['start', 'lost', 'won'].includes(phaseRef.current)) start(); else if (phaseRef.current === 'paused') setPhase('playing'); }
      else if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) dash(); keys.current.add(e.code); };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => { keys.current.clear(); pointer.current.down = false; touch.current.fire = false; if (phaseRef.current === 'playing') setPhase('paused'); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [dash, setPhase, start]);
  useEffect(() => {
    const c = canvas.current?.getContext('2d'); if (!c) return; let frame = 0, last = 0, hudTick = 0;
    const tick = (stamp: number) => {
      const dt = Math.min((stamp - (last || stamp)) / 1000, .033); last = stamp;
      const g = game.current, p = g.p, playing = phaseRef.current === 'playing';
      if (playing) {
        g.time += dt; g.shake = Math.max(0, g.shake - dt * 4); p.inv = Math.max(0, p.inv - dt); p.cooldown = Math.max(0, p.cooldown - dt); p.shot -= dt;
        if (p.dash > 0) { p.dash -= dt; p.x += p.dx * 800 * dt; p.y += p.dy * 800 * dt; burst(g, p.x, p.y, '#67dcca', 2, 35); }
        else { let dx = Number(keys.current.has('KeyD') || keys.current.has('ArrowRight')) - Number(keys.current.has('KeyA') || keys.current.has('ArrowLeft')) + touch.current.x;
          let dy = Number(keys.current.has('KeyS') || keys.current.has('ArrowDown')) - Number(keys.current.has('KeyW') || keys.current.has('ArrowUp')) + touch.current.y;
          const len = Math.hypot(dx, dy); if (len) { dx /= Math.max(1, len); dy /= Math.max(1, len); p.x += dx * 270 * dt; p.y += dy * 270 * dt; } }
        p.x = Math.max(27, Math.min(W - 27, p.x)); p.y = Math.max(27, Math.min(H - 27, p.y));
        const near = g.enemies.reduce<Enemy | null>((n, e) => !n || Math.hypot(e.x - p.x, e.y - p.y) < Math.hypot(n.x - p.x, n.y - p.y) ? e : n, null);
        const aim = pointer.current.active && !touch.current.fire ? Math.atan2(pointer.current.y - p.y, pointer.current.x - p.x) : near ? Math.atan2(near.y - p.y, near.x - p.x) : p.angle; p.angle = aim;
        if ((keys.current.has('Space') || pointer.current.down || touch.current.fire) && p.shot <= 0) { g.bullets.push({ x: p.x + Math.cos(aim) * 23, y: p.y + Math.sin(aim) * 23, vx: Math.cos(aim) * 680, vy: Math.sin(aim) * 680, life: 1.15, hostile: false, damage: 1 }); p.shot = .145; burst(g, p.x + Math.cos(aim) * 24, p.y + Math.sin(aim) * 24, '#a5ffed', 3, 75); sound(710, .055, 'triangle', .012); }
        if (g.transition > 0) { g.transition -= dt; if (g.transition <= 0) { if (g.wave === FINAL_WAVE) finish('won'); else { g.wave++; g.remaining = [0, 8, 12, 16, 7][g.wave]; g.spawn = 1.2; p.hp = Math.min(100, p.hp + 20); p.inv = 1; if (g.wave === 4) spawnEnemy(g, 'boss'); sound(550, .4, 'sine', .06); } } }
        else if (g.remaining > 0) { g.spawn -= dt; if (g.spawn <= 0) { let kind: Kind = 'seeker'; if (g.wave >= 2 && Math.random() < .34) kind = 'striker'; if (g.wave >= 3 && Math.random() < .24) kind = 'brute'; spawnEnemy(g, kind); g.remaining--; g.spawn = Math.max(.4, 1.25 - g.wave * .14); } }
        else if (!g.enemies.length) { g.transition = 2.6; g.bullets = []; sound(840, .35, 'sine', .05); }
        for (const e of g.enemies) { e.hit = Math.max(0, e.hit - dt); const a = Math.atan2(p.y - e.y, p.x - e.x), distance = Math.hypot(p.x - e.x, p.y - e.y); e.angle = a;
          if (e.kind !== 'boss' || distance > 160) { e.x += Math.cos(a) * e.speed * dt; e.y += Math.sin(a) * e.speed * dt; }
          if (e.kind === 'boss') { e.fire -= dt; if (e.fire <= 0) { for (let i = 0; i < 10; i++) { const angle = i * Math.PI * 2 / 10 + g.time * .35; g.bullets.push({ x: e.x + Math.cos(angle) * 42, y: e.y + Math.sin(angle) * 42, vx: Math.cos(angle) * 175, vy: Math.sin(angle) * 175, life: 4, hostile: true, damage: 12 }); } e.fire = 1.85; sound(110, .25, 'sawtooth', .035); } }
          if (hit(e.x, e.y, e.r * .8, p.x, p.y, 13) && p.inv <= 0) { p.hp = Math.max(0, p.hp - (e.kind === 'boss' ? 25 : e.kind === 'brute' ? 21 : 16)); p.inv = .85; g.shake = 1; burst(g, p.x, p.y, '#ff857a', 18, 165); sound(140, .28, 'sawtooth', .08); } }
        for (let i = g.bullets.length - 1; i >= 0; i--) { const b = g.bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
          if (b.life <= 0 || b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) { g.bullets.splice(i, 1); continue; }
          if (b.hostile) { if (p.inv <= 0 && hit(b.x, b.y, 5, p.x, p.y, 13)) { p.hp = Math.max(0, p.hp - b.damage); p.inv = .7; g.shake = .8; burst(g, p.x, p.y, '#ff857a', 13, 145); sound(150, .2, 'sawtooth', .07); g.bullets.splice(i, 1); } }
          else { const target = g.enemies.find(e => hit(b.x, b.y, 4, e.x, e.y, e.r * .85)); if (target) { target.hp -= b.damage; target.hit = .07; burst(g, b.x, b.y, target.kind === 'boss' ? '#c4a1ff' : '#ffab8b', 3, 65); g.bullets.splice(i, 1);
              if (target.hp <= 0) { g.enemies.splice(g.enemies.indexOf(target), 1); g.kills++; g.score += target.kind === 'boss' ? 2500 : target.kind === 'brute' ? 200 : target.kind === 'striker' ? 150 : 100; burst(g, target.x, target.y, target.kind === 'boss' ? '#bc9aff' : '#ff927d', target.kind === 'boss' ? 55 : 20, 170); if (target.kind === 'boss') g.shake = 1.5; if (g.kills % 8 === 0 || (p.hp < 55 && Math.random() < .15)) g.pickups.push({ x: target.x, y: target.y, life: 12 }); sound(target.kind === 'boss' ? 480 : 230, target.kind === 'boss' ? .5 : .12, 'triangle', .045); } } } }
        for (let i = g.pickups.length - 1; i >= 0; i--) { const item = g.pickups[i]; item.life -= dt; if (hit(item.x, item.y, 15, p.x, p.y, 17)) { p.hp = Math.min(100, p.hp + 25); g.score += 50; burst(g, item.x, item.y, '#adffc5', 16, 110); g.pickups.splice(i, 1); sound(960, .3, 'sine', .055); } else if (item.life <= 0) g.pickups.splice(i, 1); }
        if (p.hp <= 0) finish('lost'); hudTick += dt; if (hudTick > .08) { hudTick = 0; setHud({ hp: p.hp, score: g.score, wave: g.wave, cooldown: p.cooldown, transition: g.transition }); }
      }
      if (playing || phaseRef.current === 'start') for (let i = g.particles.length - 1; i >= 0; i--) { const part = g.particles[i]; part.x += part.vx * dt; part.y += part.vy * dt; part.vx *= .98; part.vy *= .98; part.life -= dt; if (part.life <= 0) g.particles.splice(i, 1); }
      draw(c, g, phaseRef.current, stamp / 1000); frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [finish, sound]);
  const movePointer = (e: React.PointerEvent<HTMLCanvasElement>) => { if (e.pointerType === 'touch') return; const r = e.currentTarget.getBoundingClientRect(); pointer.current.x = (e.clientX - r.left) / r.width * W; pointer.current.y = (e.clientY - r.top) / r.height * H; pointer.current.active = true; };
  const moveStick = (e: React.PointerEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2, len = Math.max(1, Math.hypot(x, y)); touch.current.x = Math.min(1, len / 40) * x / len; touch.current.y = Math.min(1, len / 40) * y / len; if (stick.current) stick.current.style.transform = `translate(${touch.current.x * 32}px,${touch.current.y * 32}px)`; };
  const releaseStick = () => { touch.current.x = 0; touch.current.y = 0; if (stick.current) stick.current.style.transform = ''; };
  return <div className="app"><style>{styles}</style>
    <header className="topbar"><div className="brand"><svg className="brand-mark" viewBox="0 0 28 28" fill="none"><path d="M14 2 25 24 14 18 3 24 14 2Z" stroke="currentColor" strokeWidth="2"/><path d="M14 8v10" stroke="currentColor" strokeWidth="2"/></svg>NORTHSTAR</div><div className="top-right"><span className="edition">ARCADE SERIES / 001</span><button className="sound" onClick={() => { mutedRef.current = !mutedRef.current; setMuted(mutedRef.current); }}>{muted ? 'SOUND OFF' : 'SOUND ON'}</button></div></header>
    <main className="shell"><div className="above"><div><p className="eyebrow">A ONE-SHIP SURVIVAL GAME</p><h1>Last <span>Light.</span></h1></div><div className="session">HIGH SCORE <strong>{best.toLocaleString().padStart(5, '0')}</strong><br/>FOUR WAVES. ONE WAY OUT.</div></div>
    <div className="stage"><canvas ref={canvas} width={W} height={H} tabIndex={-1} aria-label="Last Light game arena" onPointerMove={movePointer} onPointerDown={e => { if (e.pointerType !== 'touch') { movePointer(e); pointer.current.down = true; } }} onPointerUp={() => { pointer.current.down = false; }} onPointerLeave={() => { pointer.current.down = false; }} onContextMenu={e => e.preventDefault()} />
      {phase !== 'start' && <div className="hud"><div className="hud-block"><span className="hud-label">WAVE</span><span className="hud-value">0{hud.wave}<small> / 04</small></span></div><div className="hud-block"><span className="hud-label">SCORE</span><span className="hud-value">{hud.score.toLocaleString().padStart(5, '0')}</span></div><div className="hud-block health"><span className="hud-label">HULL INTEGRITY</span><div className="health-row"><div className="health-track"><span className={`health-fill ${hud.hp <= 30 ? 'low' : ''}`} style={{ width: `${hud.hp}%` }}/></div><span className="hud-value" style={{ fontSize: 14 }}>{hud.hp}</span></div></div><div className="dash-block"><span className="hud-label">DASH {hud.cooldown <= 0 ? 'READY' : 'RECHARGING'}</span><div className="dash-track"><span className="dash-fill" style={{ width: `${(1 - hud.cooldown / 3.2) * 100}%` }}/></div></div></div>}
      {phase === 'playing' && hud.transition > 0 && <div className="wave-toast"><span>{hud.wave === FINAL_WAVE ? 'SECTOR SECURED' : 'SECTOR CLEARED'}</span>{hud.wave === FINAL_WAVE ? 'THE LIGHT SURVIVES' : `WAVE 0${hud.wave + 1} INCOMING`}</div>}
      {phase === 'start' && <div className="veil start-veil"><div className="tiny-line">NORTHSTAR PRESENTS</div><div className="hero-title">LAST <em>LIGHT</em></div><p className="intro">The signal is fading. Hold the line through four waves of the void and take down the Harbinger.</p><button className="primary" onClick={start}>Launch mission</button><div className="hint">WASD TO MOVE &nbsp; / &nbsp; MOUSE TO AIM &nbsp; / &nbsp; CLICK TO FIRE</div></div>}
      {phase === 'paused' && <div className="veil"><div className="result-label">MISSION INTERRUPTED</div><h2 className="result-title">On standby.</h2><p className="result-copy">Catch your breath. The void can wait.</p><div className="pause-actions"><button className="primary" onClick={() => setPhase('playing')}>Resume game</button><button className="secondary" onClick={start}>Restart</button></div><div className="hint">PRESS P OR ESC TO RESUME</div></div>}
      {(phase === 'lost' || phase === 'won') && <div className="veil"><div className="result-label">{phase === 'won' ? 'MISSION COMPLETE / ALL FOUR WAVES CLEARED' : `MISSION FAILED / WAVE 0${hud.wave}`}</div><h2 className="result-title">{phase === 'won' ? 'You are the light.' : 'Signal lost.'}</h2><p className="result-copy">{phase === 'won' ? 'The Harbinger is gone. The stars have one more night.' : 'The void got through this time. There is still a signal worth saving.'}</p><div className="result-score">FINAL SCORE <strong>{hud.score.toLocaleString().padStart(5, '0')}</strong></div><button className="primary" onClick={start}>Play again</button><div className="hint">PRESS ENTER TO RESTART</div></div>}
    </div>
    <div className="touch-controls"><div className="joystick" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); moveStick(e); }} onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) moveStick(e); }} onPointerUp={releaseStick} onPointerCancel={releaseStick}><div className="stick" ref={stick}/></div><div className="touch-right"><button className="touch-button" onPointerDown={e => { e.preventDefault(); dash(); }}>DASH</button><button className="touch-button fire" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); touch.current.fire = true; }} onPointerUp={() => { touch.current.fire = false; }} onPointerCancel={() => { touch.current.fire = false; }}>FIRE</button></div></div>
    <div className="below"><div className="mission"><span className="mission-number">01 /</span><div><h2>The mission</h2><p>Survive four escalating waves. Collect green repair drops, use your dash to evade danger, and destroy the final threat.</p></div></div><div className="controls"><span className="control"><span className="key">W A S D</span> Move</span><span className="control"><span className="key">CLICK / SPACE</span> Fire</span><span className="control"><span className="key">SHIFT</span> Dash</span><span className="control"><span className="key">P / ESC</span> Pause</span></div></div><footer className="footer"><span>NORTHSTAR / SMALL GAMES, BIG UNIVERSES</span><span>BUILT FOR THE BRAVE</span></footer></main>
  </div>;
}
