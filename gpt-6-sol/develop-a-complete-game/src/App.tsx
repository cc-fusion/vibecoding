import { useEffect, useRef, useState } from "react";

// NOVA DEFENSE is self-contained: gameplay, art, audio, and styles live in this file.
const W = 960, H = 600, SECTOR_LENGTH = 16, MAX_HULL = 5;
type Mode = "menu" | "playing" | "paused" | "won" | "lost";
type EnemyType = "scout" | "brute" | "boss";
type Enemy = { x: number; y: number; vy: number; r: number; hp: number; maxHp: number; type: EnemyType; phase: number; shoot: number };
type Bullet = { x: number; y: number; vx: number; vy: number; r: number; hostile: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string };
type Pickup = { x: number; y: number; kind: "repair" | "overdrive"; phase: number };
type Star = { x: number; y: number; size: number; speed: number; alpha: number };
type Game = { mode: Mode; x: number; y: number; hull: number; score: number; sector: number; time: number; sectorTime: number; spawn: number; fire: number; invuln: number; overdrive: number; shake: number; banner: number; enemies: Enemy[]; bullets: Bullet[]; particles: Particle[]; pickups: Pickup[]; stars: Star[] };
type Hud = { score: number; hull: number; sector: number; progress: number; overdrive: number; boss: number; best: number };
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function makeGame(mode: Mode = "menu"): Game {
  return { mode, x: W / 2, y: H - 85, hull: 3, score: 0, sector: 1, time: 0, sectorTime: 0, spawn: 1, fire: 0, invuln: 0, overdrive: 0, shake: 0, banner: 0, enemies: [], bullets: [], particles: [], pickups: [], stars: Array.from({ length: 85 }, () => ({ x: rand(0, W), y: rand(0, H), size: rand(.6, 2), speed: rand(12, 65), alpha: rand(.15, .7) })) };
}
function burst(g: Game, x: number, y: number, color: string, count: number, force = 130) {
  for (let i = 0; i < count; i++) { const angle = rand(0, Math.PI * 2), speed = rand(force * .25, force), life = rand(.25, .7); g.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, size: rand(1.5, 4), color }); }
}
function spawnEnemy(g: Game) {
  const brute = g.sector >= 2 && Math.random() < .15 + g.sector * .045;
  g.enemies.push({ x: rand(55, W - 55), y: -38, vy: brute ? 72 + g.sector * 12 : 106 + g.sector * 16, r: brute ? 27 : 19, hp: brute ? 5 : 2, maxHp: brute ? 5 : 2, type: brute ? "brute" : "scout", phase: rand(0, 6.28), shoot: rand(1.25, 3.2) });
}
function damagePlayer(g: Game, sound: (name: string) => void) {
  if (g.invuln > 0 || g.mode !== "playing") return;
  g.hull--; g.invuln = 1.4; g.shake = 11; burst(g, g.x, g.y, "#ff765c", 23, 180); sound("hurt");
  if (g.hull <= 0) { g.mode = "lost"; burst(g, g.x, g.y, "#9ff5ee", 48, 270); sound("lose"); }
}
function updateGame(g: Game, dt: number, keys: Set<string>, pointer: { active: boolean; x: number; y: number }, sound: (name: string) => void) {
  // The starfield continues behind menus; gameplay time stops completely on pause.
  for (const s of g.stars) { s.y += s.speed * dt * (g.mode === "playing" ? 1.6 : .42); if (s.y > H) { s.y = 0; s.x = rand(0, W); } }
  for (const p of g.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .98; p.vy *= .98; p.life -= dt; }
  g.particles = g.particles.filter(p => p.life > 0); g.shake = Math.max(0, g.shake - dt * 30);
  if (g.mode !== "playing") return;
  g.time += dt; g.sectorTime += dt; g.invuln = Math.max(0, g.invuln - dt); g.overdrive = Math.max(0, g.overdrive - dt); g.banner = Math.max(0, g.banner - dt);
  const dx = Number(keys.has("arrowright") || keys.has("d")) - Number(keys.has("arrowleft") || keys.has("a"));
  const dy = Number(keys.has("arrowdown") || keys.has("s")) - Number(keys.has("arrowup") || keys.has("w"));
  if (dx || dy) { const len = Math.hypot(dx, dy); g.x += dx / len * 390 * dt; g.y += dy / len * 390 * dt; }
  else if (pointer.active) { const distance = Math.hypot(pointer.x - g.x, pointer.y - g.y), step = Math.min(distance, 720 * dt); if (distance > 1) { g.x += (pointer.x - g.x) / distance * step; g.y += (pointer.y - g.y) / distance * step; } }
  g.x = clamp(g.x, 28, W - 28); g.y = clamp(g.y, 70, H - 31);
  // Auto-fire makes keyboard, mouse, and touch equally capable of finishing the game.
  g.fire -= dt;
  if (g.fire <= 0) { for (const offset of g.overdrive > 0 ? [-13, 13] : [0]) g.bullets.push({ x: g.x + offset, y: g.y - 26, vx: offset * 1.2, vy: -590, r: 4, hostile: false }); g.fire = g.overdrive > 0 ? .14 : .19; sound("fire"); }
  if (g.sector < 5) {
    g.spawn -= dt;
    if (g.spawn <= 0) { spawnEnemy(g); g.spawn = Math.max(.48, 1.28 - g.sector * .16) * rand(.7, 1.3); }
    if (g.sectorTime >= SECTOR_LENGTH) {
      g.sector++; g.sectorTime = 0; g.spawn = 1.1; g.banner = 2.4; g.hull = Math.min(MAX_HULL, g.hull + 1); g.enemies = []; g.bullets = g.bullets.filter(b => !b.hostile); sound("wave");
      if (g.sector === 5) g.enemies.push({ x: W / 2, y: -75, vy: 0, r: 58, hp: 55, maxHp: 55, type: "boss", phase: 0, shoot: 2 });
    }
  }
  for (const e of g.enemies) {
    if (e.type === "boss") {
      e.y = Math.min(105, e.y + 105 * dt); e.x = W / 2 + Math.sin(g.sectorTime * .65) * 190;
      if (e.y < 95) continue;
      e.shoot -= dt;
      if (e.shoot <= 0) { const angle = Math.atan2(g.y - e.y, g.x - e.x); for (const spread of [-.28, 0, .28]) { const a = angle + spread; g.bullets.push({ x: e.x, y: e.y + 38, vx: Math.cos(a) * 255, vy: Math.sin(a) * 255, r: 7, hostile: true }); } e.shoot = .9; sound("enemyFire"); }
    } else {
      e.y += e.vy * dt; e.x += Math.sin(g.time * 2.5 + e.phase) * (e.type === "scout" ? 28 : 12) * dt; e.shoot -= dt;
      if (e.shoot <= 0 && e.y < H - 170 && e.y > 50) { const angle = Math.atan2(g.y - e.y, g.x - e.x), speed = 200 + g.sector * 15; g.bullets.push({ x: e.x, y: e.y + 16, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 5, hostile: true }); e.shoot = e.type === "brute" ? 1.8 : 3.8; }
    }
  }
  for (const b of g.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.hostile) { if (Math.hypot(b.x - g.x, b.y - g.y) < b.r + 15) { b.y = H + 100; damagePlayer(g, sound); } }
    else for (const e of g.enemies) if (e.hp > 0 && Math.hypot(b.x - e.x, b.y - e.y) < b.r + e.r * (e.type === "boss" ? 1.35 : .76)) {
      e.hp--; b.y = -100; burst(g, b.x, e.y, e.type === "boss" ? "#ffc083" : "#ff946d", 3, 65);
      if (e.hp <= 0) { g.score += e.type === "boss" ? 5000 : e.type === "brute" ? 250 : 100; burst(g, e.x, e.y, e.type === "boss" ? "#ffb778" : "#ff795f", e.type === "boss" ? 100 : 19, e.type === "boss" ? 320 : 150); g.shake = e.type === "boss" ? 18 : 4; sound(e.type === "boss" ? "win" : "destroy"); if (e.type === "boss") g.mode = "won"; else if (Math.random() < .18) g.pickups.push({ x: e.x, y: e.y, kind: Math.random() < .35 ? "repair" : "overdrive", phase: 0 }); }
      break;
    }
  }
  g.bullets = g.bullets.filter(b => b.x > -30 && b.x < W + 30 && b.y > -40 && b.y < H + 40);
  for (const e of g.enemies) if (e.hp > 0 && e.type !== "boss" && Math.hypot(e.x - g.x, e.y - g.y) < e.r + 14) { e.hp = 0; burst(g, e.x, e.y, "#ff795f", 16); damagePlayer(g, sound); }
  g.enemies = g.enemies.filter(e => e.hp > 0 && e.y < H + 50);
  for (const item of g.pickups) { item.y += 105 * dt; item.phase += dt * 4; if (Math.hypot(item.x - g.x, item.y - g.y) < 30) { if (item.kind === "repair") g.hull = Math.min(MAX_HULL, g.hull + 1); else g.overdrive = 9; g.score += 50; burst(g, item.x, item.y, "#b5fbdf", 18); item.y = H + 100; sound("pickup"); } }
  g.pickups = g.pickups.filter(p => p.y < H + 20);
}
function polygon(ctx: CanvasRenderingContext2D, points: number[][], fill: string, stroke?: string, width = 2) {
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function drawGame(ctx: CanvasRenderingContext2D, g: Game) {
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#091c2b"); bg.addColorStop(.58, "#071623"); bg.addColorStop(1, "#10243a"); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(rand(-g.shake, g.shake), rand(-g.shake, g.shake));
  ctx.strokeStyle = "rgba(91,177,190,.065)"; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = "rgba(97,188,199,.16)"; ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
  for (const s of g.stars) { ctx.globalAlpha = s.alpha; ctx.fillStyle = "#b7ecf0"; ctx.fillRect(s.x, s.y, s.size, s.size * 2.2); } ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.strokeStyle = "rgba(117,207,211,.09)"; for (const r of [115, 225, 340]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); } ctx.restore();
  for (const item of g.pickups) { const bob = Math.sin(item.phase) * 4; ctx.save(); ctx.translate(item.x, item.y + bob); ctx.rotate(Math.PI / 4); ctx.shadowBlur = 20; ctx.shadowColor = item.kind === "repair" ? "#a9ffc4" : "#8cefff"; ctx.fillStyle = item.kind === "repair" ? "#b1f4bd" : "#91eefa"; ctx.fillRect(-10, -10, 20, 20); ctx.shadowBlur = 0; ctx.fillStyle = "#103142"; ctx.fillRect(-5, -5, 10, 10); ctx.restore(); }
  for (const e of g.enemies) {
    ctx.save(); ctx.translate(e.x, e.y);
    if (e.type === "boss") { ctx.shadowBlur = 35; ctx.shadowColor = "#fa7057"; polygon(ctx, [[-86,-12],[-45,-36],[-25,-22],[0,-43],[25,-22],[45,-36],[86,-12],[63,27],[27,16],[0,39],[-27,16],[-63,27]], "#402c39", "#ff9774", 3); ctx.shadowBlur = 0; polygon(ctx, [[-29,-15],[0,-29],[29,-15],[22,16],[0,28],[-22,16]], "#d95c53", "#ffc39b", 2); ctx.fillStyle = "#fff1c1"; ctx.fillRect(-8, -5, 16, 9); ctx.fillStyle = "#ffad80"; ctx.fillRect(-63, 4, 13, 7); ctx.fillRect(50, 4, 13, 7); }
    else if (e.type === "brute") { ctx.shadowBlur = 18; ctx.shadowColor = "#ff815f"; polygon(ctx, [[0,-28],[26,-10],[22,19],[0,29],[-22,19],[-26,-10]], "#62383e", "#ff9a70", 2.5); polygon(ctx, [[0,-12],[11,0],[0,14],[-11,0]], "#ffb27d"); }
    else { ctx.shadowBlur = 15; ctx.shadowColor = "#ff775b"; polygon(ctx, [[0,-21],[19,8],[0,20],[-19,8]], "#8b4746", "#ff9d76", 2); polygon(ctx, [[0,-8],[7,5],[0,11],[-7,5]], "#ffd2a0"); }
    ctx.restore();
  }
  for (const b of g.bullets) { ctx.save(); ctx.shadowBlur = 15; ctx.shadowColor = b.hostile ? "#ff8069" : "#7ef7e9"; ctx.fillStyle = b.hostile ? "#ffa080" : "#a5fff3"; if (b.hostile) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(b.x - 2.5, b.y - 12, 5, 22); ctx.restore(); }
  if (g.mode !== "lost" && (g.invuln <= 0 || Math.floor(g.invuln * 12) % 2 === 0)) { ctx.save(); ctx.translate(g.x, g.y); ctx.shadowBlur = 24; ctx.shadowColor = "#63e9e1"; polygon(ctx, [[0,-27],[11,-7],[22,16],[7,10],[0,17],[-7,10],[-22,16],[-11,-7]], "#72dedc", "#c4fff5", 2); ctx.shadowBlur = 0; polygon(ctx, [[0,-15],[7,5],[0,12],[-7,5]], "#123a50"); const flame = 12 + Math.sin(g.time * 34) * 5; polygon(ctx, [[-7,15],[0,15 + flame],[7,15]], "#ffb87e"); if (g.overdrive > 0) { ctx.strokeStyle = "rgba(133,247,230,.65)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 31, 0, Math.PI * 2); ctx.stroke(); } ctx.restore(); }
  for (const p of g.particles) { ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); } ctx.globalAlpha = 1; ctx.restore();
  const edge = ctx.createLinearGradient(0, 0, 0, H); edge.addColorStop(0, "rgba(4,15,26,.45)"); edge.addColorStop(.25, "rgba(4,15,26,0)"); edge.addColorStop(.8, "rgba(4,15,26,0)"); edge.addColorStop(1, "rgba(4,15,26,.55)"); ctx.fillStyle = edge; ctx.fillRect(0, 0, W, H);
  if (g.mode === "playing" && g.banner > 0) { ctx.globalAlpha = Math.min(1, g.banner, (2.4 - g.banner) * 2); ctx.textAlign = "center"; ctx.fillStyle = "#bafcf0"; ctx.font = "600 13px monospace"; ctx.fillText(g.sector === 5 ? "FINAL THREAT DETECTED" : `SECTOR 0${g.sector}  /  HULL RESTORED`, W / 2, 218); ctx.globalAlpha = 1; }
}
function IconSound({ muted }: { muted: boolean }) { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" />{muted ? <path d="m16 9 5 6m0-6-5 6" /> : <><path d="M15 9a4 4 0 0 1 0 6" /><path d="M18 6a8 8 0 0 1 0 12" /></>}</svg>; }

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null), gameRef = useRef<Game>(makeGame()), keysRef = useRef(new Set<string>()), pointerRef = useRef({ active: false, x: W / 2, y: H - 85 }), modeRef = useRef<Mode>("menu"), soundRef = useRef(true), audioRef = useRef<AudioContext | null>(null), bestRef = useRef(0);
  const [mode, setMode] = useState<Mode>("menu"), [muted, setMuted] = useState(false);
  const [hud, setHud] = useState<Hud>({ score: 0, hull: 3, sector: 1, progress: 0, overdrive: 0, boss: 1, best: 0 });
  const setGameMode = (next: Mode) => { gameRef.current.mode = next; modeRef.current = next; setMode(next); };
  const start = () => { gameRef.current = makeGame("playing"); keysRef.current.clear(); pointerRef.current.active = false; setGameMode("playing"); setHud({ score: 0, hull: 3, sector: 1, progress: 0, overdrive: 0, boss: 1, best: bestRef.current }); };
  const togglePause = () => { if (modeRef.current === "playing") setGameMode("paused"); else if (modeRef.current === "paused") setGameMode("playing"); };

  useEffect(() => {
    try { bestRef.current = Number(localStorage.getItem("nova-defense-best")) || 0; } catch { /* Storage can be disabled. */ }
    const keyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase(); if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
      if ((key === "p" || key === "escape") && !event.repeat) { const next = modeRef.current === "playing" ? "paused" : modeRef.current === "paused" ? "playing" : modeRef.current; gameRef.current.mode = next; modeRef.current = next; setMode(next); }
      else if (key === "enter" && !event.repeat && modeRef.current !== "playing") { if (modeRef.current === "paused") { gameRef.current.mode = "playing"; modeRef.current = "playing"; setMode("playing"); } else { gameRef.current = makeGame("playing"); modeRef.current = "playing"; setMode("playing"); } }
      else if (key === "r" && !event.repeat && (modeRef.current === "won" || modeRef.current === "lost")) { gameRef.current = makeGame("playing"); modeRef.current = "playing"; setMode("playing"); }
      keysRef.current.add(key);
    };
    const keyUp = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    const blur = () => { keysRef.current.clear(); if (modeRef.current === "playing") { gameRef.current.mode = "paused"; modeRef.current = "paused"; setMode("paused"); } };
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", blur); };
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return;
    let frame = 0, last = performance.now(), uiTick = 0;
    const sound = (name: string) => {
      if (!soundRef.current) return;
      try {
        if (!audioRef.current) audioRef.current = new AudioContext();
        const audio = audioRef.current; if (audio.state === "suspended") void audio.resume();
        const settings: Record<string, [number, number, number, OscillatorType]> = { fire: [470, 230, .035, "triangle"], destroy: [190, 65, .13, "sawtooth"], hurt: [160, 55, .27, "sawtooth"], pickup: [530, 960, .2, "sine"], wave: [330, 650, .3, "sine"], enemyFire: [130, 95, .08, "triangle"], win: [450, 1050, .7, "sine"], lose: [250, 55, .6, "sawtooth"] };
        const [from, to, duration, wave] = settings[name], now = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
        osc.type = wave; osc.frequency.setValueAtTime(from, now); osc.frequency.exponentialRampToValueAtTime(to, now + duration); gain.gain.setValueAtTime(name === "fire" ? .012 : .045, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration); osc.connect(gain); gain.connect(audio.destination); osc.start(now); osc.stop(now + duration);
      } catch { /* Audio is optional; gameplay never depends on it. */ }
    };
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, .035); last = now; const g = gameRef.current;
      updateGame(g, dt, keysRef.current, pointerRef.current, sound); drawGame(ctx, g);
      if (g.mode !== modeRef.current) { modeRef.current = g.mode; setMode(g.mode); if (g.mode === "won" || g.mode === "lost") { bestRef.current = Math.max(bestRef.current, g.score); try { localStorage.setItem("nova-defense-best", String(bestRef.current)); } catch { /* Storage can be disabled. */ } } }
      uiTick += dt; if (uiTick > .08) { uiTick = 0; const boss = g.enemies.find(e => e.type === "boss"); setHud({ score: g.score, hull: g.hull, sector: g.sector, progress: g.sector === 5 ? 1 : g.sectorTime / SECTOR_LENGTH, overdrive: g.overdrive, boss: boss ? Math.max(0, boss.hp / boss.maxHp) : 1, best: bestRef.current }); }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); void audioRef.current?.close(); audioRef.current = null; };
  }, []);
  const movePointer = (event: React.PointerEvent<HTMLCanvasElement>) => { const rect = event.currentTarget.getBoundingClientRect(); pointerRef.current = { active: true, x: (event.clientX - rect.left) / rect.width * W, y: (event.clientY - rect.top) / rect.height * H }; };

  return <div className="app-shell"><style>{styles}</style><div className="ambient ambient-one" /><div className="ambient ambient-two" /><main className="site-wrap">
    <header className="topbar"><div className="brand"><span className="brand-mark"><span /></span><span className="brand-name">NOVA<span>DEFENSE</span></span></div><div className="topbar-right"><span className="edition">ARCADE EDITION <span className="edition-line" /> 001</span><button className="icon-button" aria-label={muted ? "Unmute sound" : "Mute sound"} title={muted ? "Unmute sound" : "Mute sound"} onClick={() => { soundRef.current = muted; setMuted(!muted); }}><IconSound muted={muted} /></button></div></header>
    <section className="game-section" aria-label="Nova Defense game"><div className="game-topline"><div className="live-label"><span className="live-dot" /> {mode === "playing" ? "MISSION IN PROGRESS" : mode === "paused" ? "MISSION PAUSED" : "SINGLE PLAYER / SURVIVAL"}</div><div className="topline-right">DEFEND THE LAST LIGHT <span>//</span> 01 - 05</div></div>
      <div className="game-frame"><canvas ref={canvasRef} width={W} height={H} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); movePointer(e); }} onPointerMove={movePointer} onPointerLeave={e => { if (e.pointerType === "mouse") pointerRef.current.active = false; }} onPointerUp={e => { if (e.pointerType !== "mouse") pointerRef.current.active = false; }} aria-label="Game field. Move with WASD or arrow keys, or move and drag with pointer. Your ship fires automatically." />
        {mode === "playing" && <div className="infield-top" aria-hidden="true"><span>SECTOR {String(hud.sector).padStart(2, "0")} / 05</span><span>{hud.sector === 5 ? "ELIMINATE THE DREADNOUGHT" : "SURVIVE THE ASSAULT"}</span></div>}
        {mode === "playing" && hud.sector === 5 && <div className="boss-meter"><div className="boss-meter-label"><span>DREADNOUGHT</span><span>{Math.ceil(hud.boss * 100)}%</span></div><div className="boss-meter-track"><div style={{ width: `${hud.boss * 100}%` }} /></div></div>}
        {mode === "playing" && <button className="field-pause" onClick={togglePause} aria-label="Pause game">II <span>PAUSE</span></button>}
        {mode !== "playing" && <div className={`screen-overlay ${mode === "menu" ? "menu-overlay" : "result-overlay"}`}><div className="overlay-content" key={mode}><div className="overlay-eyebrow"><span className="mini-line" /> {mode === "menu" ? "A ONE-SHIP ARCADE ODYSSEY" : mode === "paused" ? "SYSTEMS ON STANDBY" : mode === "won" ? "MISSION COMPLETE" : "SIGNAL LOST"}</div>
          {mode === "menu" ? <><h1>NOVA<br /><em>DEFENSE.</em></h1><p>One ship. Five sectors. The last line between the stars and silence.</p></> : mode === "paused" ? <><h2>TAKE A<br /><em>BREATH.</em></h2><p>The universe can wait. Your mission is right where you left it.</p></> : mode === "won" ? <><h2>THE LIGHT<br /><em>LIVES ON.</em></h2><p>The dreadnought is gone. Against all odds, you held the line.</p></> : <><h2>THE LINE<br /><em>FELL.</em></h2><p>Even stars burn out. Take the controls and give it another shot.</p></>}
          {(mode === "won" || mode === "lost") && <div className="result-score"><span>FINAL SCORE</span><strong>{hud.score.toLocaleString()}</strong><span>BEST {hud.best.toLocaleString()}</span></div>}
          <div className="overlay-actions"><button className="primary-button" onClick={mode === "paused" ? togglePause : start}><span>{mode === "menu" ? "START MISSION" : mode === "paused" ? "RESUME MISSION" : "PLAY AGAIN"}</span><span className="button-arrow">↗</span></button>{mode === "paused" && <button className="text-button" onClick={start}>RESTART MISSION</button>}</div>
          {mode === "menu" && <div className="overlay-hint">MOVE WITH WASD / ARROWS OR DRAG <span>·</span> AUTO-FIRE ENABLED</div>}
        </div></div>}
        <div className="frame-corner tl" /><div className="frame-corner tr" /><div className="frame-corner bl" /><div className="frame-corner br" />
      </div>
      <div className="hud-row"><div className="hud-cell sector-cell"><span className="hud-label">SECTOR</span><div className="hud-value">{String(hud.sector).padStart(2, "0")} <span className="hud-muted">/ 05</span></div><div className="sector-track"><span style={{ width: `${hud.progress * 100}%` }} /></div></div><div className="hud-cell score-cell"><span className="hud-label">SCORE</span><div className="hud-value">{String(hud.score).padStart(6, "0")}</div></div><div className="hud-cell hull-cell"><span className="hud-label">HULL INTEGRITY</span><div className="hull-bars" aria-label={`${hud.hull} of ${MAX_HULL} hull points`}>{Array.from({ length: MAX_HULL }, (_, i) => <span key={i} className={i < hud.hull ? "filled" : ""} />)}</div></div><div className="hud-cell status-cell"><span className="hud-label">SYSTEM STATUS</span><div className="status-value"><span className="status-light" />{hud.overdrive > 0 ? `OVERDRIVE ${Math.ceil(hud.overdrive)}S` : mode === "playing" ? "WEAPONS ONLINE" : "AWAITING PILOT"}</div></div></div>
    </section><footer className="footer"><div className="footer-instruction"><span className="keycap">W</span><span className="keycap">A</span><span className="keycap">S</span><span className="keycap">D</span><span className="footer-or">/</span> ARROW KEYS <span className="footer-separator">OR</span> MOVE / DRAG TO STEER <span className="footer-separator">·</span> WEAPONS FIRE AUTOMATICALLY</div><div className="footer-pause">PRESS <span className="keycap">P</span> TO PAUSE</div></footer>
  </main></div>;
}

const styles = `
:root{font-family:Arial,Helvetica,sans-serif}.brand-name,.overlay-content h1,.overlay-content h2,.hud-value,.result-score strong{font-family:Impact,'Arial Narrow',sans-serif}.edition,.game-topline,.hud-label,.status-value,.footer,.overlay-eyebrow,.overlay-hint,.result-score span,.infield-top,.boss-meter-label,.field-pause,.text-button,.primary-button{font-family:'Courier New',monospace}
:root{font-family:'DM Sans',sans-serif;color:#dce9e9;background:#07131e}*{box-sizing:border-box}body{margin:0}button{font:inherit;cursor:pointer}.app-shell{min-height:100vh;position:relative;overflow:hidden;background:radial-gradient(ellipse at 50% 10%,#142b3b 0%,#07131e 52%,#06111a 100%)}.ambient{position:absolute;pointer-events:none;filter:blur(90px);opacity:.17;border-radius:50%}.ambient-one{background:#38b8bd;width:450px;height:450px;top:-270px;left:-150px}.ambient-two{background:#bd6a50;width:400px;height:400px;right:-270px;bottom:-210px}.site-wrap{width:min(1190px,calc(100% - 64px));margin:auto;position:relative;padding-bottom:25px}.topbar{height:87px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(154,208,211,.16)}.brand{display:flex;align-items:center;gap:13px}.brand-mark{width:27px;height:27px;border:2px solid #8ce5df;transform:rotate(45deg);display:grid;place-items:center;box-shadow:0 0 14px #66d6d177}.brand-mark span{width:8px;height:8px;background:#d4fbef}.brand-name{font-family:'Barlow Condensed',sans-serif;font-size:25px;font-weight:800;letter-spacing:.035em;color:#e8f8f4;line-height:1}.brand-name span{font-weight:500;color:#76c9c9;margin-left:3px}.topbar-right{display:flex;align-items:center;gap:24px}.edition,.game-topline,.hud-label,.status-value,.footer,.overlay-eyebrow,.overlay-hint,.result-score span,.infield-top,.boss-meter-label,.field-pause,.text-button{font-family:'DM Mono',monospace;letter-spacing:.11em}.edition{font-size:10px;color:#75919c;display:flex;align-items:center;gap:10px}.edition-line{height:1px;width:28px;background:#486b75}.icon-button{border:1px solid #34515c;background:rgba(255,255,255,.025);color:#a5d5d5;width:35px;height:35px;display:grid;place-items:center;transition:.2s}.icon-button:hover{color:#fff;border-color:#8de6dc;background:#19404a}.game-section{margin-top:22px}.game-topline{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#87a0a7;margin-bottom:13px}.live-label{color:#a8d4d2;display:flex;align-items:center;gap:10px}.live-dot,.status-light{width:6px;height:6px;border-radius:50%;background:#a3e8cf;box-shadow:0 0 10px #8ef7cf}.live-dot{animation:pulse 2s infinite}.topline-right span{color:#d0a183;margin:0 5px}.game-frame{position:relative;width:100%;aspect-ratio:960/600;max-height:min(66vh,700px);background:#091924;border:1px solid #2a4c58;box-shadow:0 24px 70px #0007,0 0 0 5px #0b1a27;overflow:hidden}.game-frame canvas{display:block;width:100%;height:100%;touch-action:none}.frame-corner{position:absolute;width:20px;height:20px;pointer-events:none;border-color:#9de9df;border-style:solid;opacity:.75}.tl{top:0;left:0;border-width:2px 0 0 2px}.tr{top:0;right:0;border-width:2px 2px 0 0}.bl{bottom:0;left:0;border-width:0 0 2px 2px}.br{bottom:0;right:0;border-width:0 2px 2px 0}.screen-overlay{position:absolute;inset:0;display:flex;align-items:center;z-index:2;background:linear-gradient(90deg,rgba(5,19,31,.97) 0%,rgba(5,19,31,.89) 36%,rgba(5,19,31,.28) 100%)}.screen-overlay:after{content:'';position:absolute;right:7%;top:50%;width:min(32vw,350px);height:min(32vw,350px);border:1px solid rgba(124,217,216,.18);border-radius:50%;transform:translateY(-50%);box-shadow:0 0 0 55px rgba(122,211,211,.028),0 0 0 110px rgba(122,211,211,.025),inset 0 0 65px rgba(95,206,207,.045);pointer-events:none;animation:orbit 16s linear infinite}.screen-overlay:before{content:'';position:absolute;right:calc(7% + min(16vw,175px) - 5px);top:calc(50% - 5px);width:10px;height:10px;background:#94e7de;transform:rotate(45deg);box-shadow:0 0 25px #8ce9e3;pointer-events:none;z-index:1}.result-overlay{background:linear-gradient(90deg,rgba(5,19,31,.97) 0%,rgba(5,19,31,.88) 50%,rgba(5,19,31,.45) 100%)}.overlay-content{position:relative;z-index:2;padding-left:8%;padding-right:20px;animation:arrive .45s ease-out both}.overlay-eyebrow{color:#8edcd3;font-size:11px;font-weight:500;display:flex;align-items:center;gap:12px;margin-bottom:22px}.mini-line{display:block;width:23px;height:1px;background:#80dad2}.overlay-content h1,.overlay-content h2{font-family:'Barlow Condensed',sans-serif;font-weight:800;color:#e8f6ef;font-size:clamp(70px,10vw,132px);line-height:.78;letter-spacing:-.025em;margin:0;text-shadow:0 8px 40px #0005}.overlay-content h2{font-size:clamp(64px,9vw,116px)}.overlay-content h1 em,.overlay-content h2 em{font-style:normal;color:#8fe5dc}.overlay-content p{max-width:385px;color:#a8bec4;font-size:15px;line-height:1.6;margin:26px 0 0}.overlay-actions{display:flex;align-items:center;gap:23px;margin-top:29px}.primary-button{min-width:215px;border:0;background:#a5e9db;color:#102c36;padding:0 0 0 22px;height:51px;display:flex;align-items:center;justify-content:space-between;font-family:'DM Mono',monospace;font-size:11px;font-weight:500;letter-spacing:.08em;transition:transform .2s,background .2s,box-shadow .2s}.primary-button:hover{background:#d2fff2;transform:translateY(-3px);box-shadow:0 8px 25px #80ead04d}.button-arrow{height:51px;width:50px;border-left:1px solid #639f9b;display:grid;place-items:center;font-size:21px}.text-button{border:0;background:none;color:#a6c7c9;font-size:10px;padding:12px 0;border-bottom:1px solid #73999c}.text-button:hover{color:white}.overlay-hint{color:#729098;font-size:9px;margin-top:33px}.overlay-hint span{padding:0 10px;color:#9bd5d1}.result-score{display:flex;align-items:baseline;gap:18px;margin-top:23px}.result-score span{font-size:10px;color:#91b6b8}.result-score strong{font-family:'Barlow Condensed',sans-serif;font-size:38px;color:#eafff8;line-height:1}.result-score span:last-child{color:#668c94}.infield-top{position:absolute;top:25px;left:30px;right:30px;display:flex;justify-content:space-between;color:#8ab1b8;font-size:10px;pointer-events:none}.infield-top span:first-child{color:#b7e9e2}.field-pause{position:absolute;bottom:20px;right:24px;background:rgba(8,28,40,.72);border:1px solid #50737c;color:#c6edeb;padding:9px 13px;font-size:11px;z-index:1;transition:.2s}.field-pause:hover{background:#235060}.field-pause span{margin-left:8px;font-size:9px}.boss-meter{position:absolute;top:45px;left:50%;transform:translateX(-50%);width:260px;pointer-events:none}.boss-meter-label{display:flex;justify-content:space-between;font-size:9px;color:#ffa685;margin-bottom:7px}.boss-meter-track{height:4px;background:#633f46}.boss-meter-track div{height:100%;background:#ff9878;box-shadow:0 0 10px #ff765f;transition:width .1s}.hud-row{height:94px;display:grid;grid-template-columns:1.05fr 1.18fr 1.15fr 1.2fr;border-bottom:1px solid rgba(150,203,206,.18);background:rgba(13,32,44,.52)}.hud-cell{padding:18px 27px;border-right:1px solid rgba(150,203,206,.13);min-width:0}.hud-cell:last-child{border-right:0}.hud-label{display:block;color:#72929d;font-size:9px;margin-bottom:6px}.hud-value{font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:31px;line-height:1;color:#e0f3ef;letter-spacing:.05em}.hud-muted{font-size:16px;color:#5b7d88;vertical-align:3px}.sector-track{height:2px;background:#294855;width:90px;margin-top:7px}.sector-track span{display:block;height:100%;background:#8ce9dd;transition:width .1s}.hull-bars{display:flex;gap:6px;margin-top:15px}.hull-bars span{height:14px;width:27px;transform:skewX(-22deg);border:1px solid #4f777b;background:#172f3b}.hull-bars .filled{background:#9be6d7;border-color:#9be6d7;box-shadow:0 0 10px #92ead455}.status-value{display:flex;align-items:center;gap:10px;margin-top:14px;font-size:11px;color:#acd8d2;white-space:nowrap}.footer{display:flex;justify-content:space-between;align-items:center;color:#718c95;font-size:9px;margin-top:20px;gap:18px}.footer-instruction{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.keycap{display:inline-flex;justify-content:center;align-items:center;width:20px;height:20px;border:1px solid #3e626c;color:#a2c1c4;font-size:10px}.footer-or{margin:0 6px}.footer-separator{color:#3f6370;margin:0 12px}.footer-pause{white-space:nowrap;display:flex;align-items:center;gap:8px}@keyframes pulse{50%{opacity:.35;box-shadow:0 0 2px #8ef7cf}}@keyframes arrive{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:translateY(0)}}@keyframes orbit{50%{transform:translateY(-50%) rotate(180deg)}to{transform:translateY(-50%) rotate(360deg)}}
@media(max-width:800px){.site-wrap{width:calc(100% - 32px)}.topbar{height:70px}.edition{display:none}.game-frame{max-height:none}.overlay-content{padding-left:7%}.overlay-content h1{font-size:clamp(50px,11vw,95px)}.overlay-content h2{font-size:clamp(47px,10vw,82px)}.overlay-content p{font-size:12px;max-width:300px;margin-top:15px}.overlay-eyebrow{font-size:9px;margin-bottom:15px}.overlay-actions{margin-top:18px}.primary-button{height:42px;min-width:185px;font-size:10px}.button-arrow{height:42px;width:42px}.overlay-hint{margin-top:19px;font-size:8px}.hud-cell{padding:15px}.hud-row{height:78px}.hud-value{font-size:25px}.status-value{font-size:9px}.hull-bars span{width:19px;height:12px}.footer{line-height:1.8}.footer-pause{display:none}}
@media(max-width:560px){.site-wrap{width:100%;padding:0 12px 20px}.topbar{height:62px}.brand-name{font-size:22px}.game-section{margin-top:14px}.game-topline{font-size:8px;margin-bottom:9px}.topline-right{display:none}.game-frame{aspect-ratio:3/4}.game-frame canvas{width:100%;height:100%;object-fit:cover}.screen-overlay{background:linear-gradient(180deg,rgba(5,19,31,.90),rgba(5,19,31,.68))}.screen-overlay:after{width:210px;height:210px;right:-45px;opacity:.55}.screen-overlay:before{display:none}.overlay-content{padding:0 8%;width:100%}.overlay-content h1{font-size:clamp(67px,17vw,95px)}.overlay-content h2{font-size:clamp(60px,15vw,87px)}.overlay-content p{font-size:13px;max-width:285px}.overlay-hint{max-width:240px;line-height:1.6}.infield-top{top:17px;left:16px;right:16px;font-size:8px}.infield-top span:last-child{display:none}.boss-meter{top:41px;width:185px}.field-pause{right:12px;bottom:12px}.hud-row{grid-template-columns:repeat(3,1fr);height:79px}.hud-cell{padding:12px 10px}.hud-cell:last-child{display:none}.hud-label{font-size:8px}.hud-value{font-size:24px}.hull-bars{gap:4px}.hull-bars span{width:15px;height:11px}.footer{margin-top:15px;font-size:8px}.footer-separator{margin:0 5px}.footer-instruction{gap:4px}.result-score{gap:10px}.result-score span{font-size:8px}.result-score strong{font-size:31px}}
/* Keep the rendered canvas and pointer coordinate system identical on narrow screens. */
@media(max-width:560px){.game-frame canvas{object-fit:fill}}
/* These system stacks keep the single-file build visually complete offline. */
.brand-name,.overlay-content h1,.overlay-content h2,.hud-value,.result-score strong{font-family:Impact,'Arial Narrow',sans-serif}
.edition,.game-topline,.hud-label,.status-value,.footer,.overlay-eyebrow,.overlay-hint,.result-score span,.infield-top,.boss-meter-label,.field-pause,.text-button,.primary-button{font-family:'Courier New',monospace}
`;