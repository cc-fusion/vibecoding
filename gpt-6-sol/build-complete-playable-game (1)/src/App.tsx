import { useCallback, useEffect, useRef, useState } from "react";

// A self-contained arcade game: logic, procedural art, sound, and UI all live here.
const W = 960;
const H = 600;
const WAVE_TARGETS = [7, 10, 13, 16, 20];
const MAX_WAVE = WAVE_TARGETS.length;

type Status = "title" | "playing" | "paused" | "won" | "lost";
type EnemyKind = "drone" | "dart" | "brute";
type Point = { x: number; y: number };
type Bullet = Point & { vx: number; vy: number; life: number; damage: number };
type Enemy = Point & { kind: EnemyKind; hp: number; maxHp: number; speed: number; radius: number; phase: number; hit: number };
type Particle = Point & { vx: number; vy: number; life: number; maxLife: number; size: number; color: string };
type Pickup = Point & { life: number; phase: number };
type Game = {
  status: Status; player: Point; health: number; score: number; wave: number; kills: number;
  spawned: number; spawnClock: number; intermission: number; elapsed: number; cooldown: number;
  dashCooldown: number; invulnerable: number; shake: number; flash: number;
  bullets: Bullet[]; enemies: Enemy[]; particles: Particle[]; pickups: Pickup[];
  aim: Point; hasAimed: boolean; firing: boolean; keys: Set<string>; touchKeys: Set<string>;
};
type Snapshot = Pick<Game, "status" | "health" | "score" | "wave" | "kills" | "spawned" | "intermission" | "dashCooldown" | "elapsed">;

function newGame(status: Status = "title"): Game {
  return {
    status, player: { x: W / 2, y: H / 2 }, health: 100, score: 0,
    wave: 1, kills: 0, spawned: 0, spawnClock: 0.8, intermission: 0,
    elapsed: 0, cooldown: 0, dashCooldown: 0, invulnerable: 0,
    shake: 0, flash: 0, bullets: [], enemies: [], particles: [], pickups: [],
    aim: { x: W / 2, y: H / 2 - 100 }, hasAimed: false,
    firing: false, keys: new Set(), touchKeys: new Set(),
  };
}
function snapshot(g: Game): Snapshot {
  return { status: g.status, health: g.health, score: g.score, wave: g.wave,
    kills: g.kills, spawned: g.spawned, intermission: g.intermission,
    dashCooldown: g.dashCooldown, elapsed: g.elapsed };
}
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function distance(a: Point, b: Point) { return Math.hypot(a.x - b.x, a.y - b.y); }
function random(min: number, max: number) { return min + Math.random() * (max - min); }
const stars = Array.from({ length: 105 }, (_, i) => ({
  x: (i * 719.3 + 97) % W, y: (i * 439.7 + 53) % H,
  size: i % 9 === 0 ? 1.8 : 0.7, phase: i * 1.87,
}));

function emit(g: Game, x: number, y: number, color: string, count: number, force = 125) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2, speed = random(force * 0.2, force), life = random(0.25, 0.75);
    g.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life, maxLife: life, size: random(1.5, 4), color });
  }
}
function spawnEnemy(g: Game) {
  const side = Math.floor(Math.random() * 4), margin = 30;
  const x = side === 0 ? margin : side === 1 ? W - margin : random(margin, W - margin);
  const y = side === 2 ? margin : side === 3 ? H - margin : random(margin, H - margin);
  const roll = Math.random();
  const kind: EnemyKind = g.wave >= 3 && roll < 0.19 ? "brute" : g.wave >= 2 && roll < 0.49 ? "dart" : "drone";
  const stats = kind === "brute" ? { hp: 5, speed: 58, radius: 23 } :
    kind === "dart" ? { hp: 1, speed: 155, radius: 11 } : { hp: 2, speed: 92, radius: 16 };
  g.enemies.push({ x, y, kind, ...stats, maxHp: stats.hp, phase: random(0, 7), hit: 0 });
}
function nearestEnemy(g: Game): Point | null {
  if (!g.enemies.length) return null;
  let nearest = g.enemies[0], best = distance(g.player, nearest);
  for (const enemy of g.enemies) {
    const d = distance(g.player, enemy);
    if (d < best) { nearest = enemy; best = d; }
  }
  return nearest;
}
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}

function drawArena(ctx: CanvasRenderingContext2D, g: Game) {
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (g.shake > 0) ctx.translate(random(-g.shake, g.shake), random(-g.shake, g.shake));
  const bg = ctx.createRadialGradient(480, 300, 30, 480, 300, 590);
  bg.addColorStop(0, "#17283a"); bg.addColorStop(0.55, "#101c2a"); bg.addColorStop(1, "#0a1420");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // The restrained star map stays readable during crowded late waves.
  ctx.strokeStyle = "rgba(108, 170, 192, 0.065)"; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 48) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
  for (const star of stars) {
    ctx.globalAlpha = 0.22 + Math.sin(g.elapsed * 1.4 + star.phase) * 0.15;
    ctx.fillStyle = "#b5e8ef"; ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(91, 196, 204, 0.15)"; ctx.lineWidth = 1;
  ctx.strokeRect(23.5, 23.5, W - 47, H - 47);
  const bracket = (x: number, y: number, sx: number, sy: number) => {
    ctx.beginPath(); ctx.moveTo(x + sx * 23, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * 23); ctx.stroke();
  };
  ctx.strokeStyle = "rgba(105, 234, 221, 0.42)";
  bracket(23.5, 23.5, 1, 1); bracket(W - 23.5, 23.5, -1, 1);
  bracket(23.5, H - 23.5, 1, -1); bracket(W - 23.5, H - 23.5, -1, -1);

  if (g.status === "title") {
    // Animate an attract scene behind the start screen.
    for (let i = 0; i < 6; i++) {
      const a = g.elapsed * (i % 2 ? 0.22 : -0.18) + i * Math.PI / 3;
      drawEnemy(ctx, { x: 480 + Math.cos(a) * (225 + i * 12), y: 300 + Math.sin(a) * (135 + i * 8),
        kind: i % 3 === 0 ? "brute" : i % 2 ? "dart" : "drone", hp: 2, maxHp: 2,
        radius: i % 3 === 0 ? 23 : i % 2 ? 11 : 16, speed: 0, phase: i, hit: 0 }, g.elapsed);
    }
  }
  for (const pickup of g.pickups) {
    const pulse = Math.sin(g.elapsed * 5 + pickup.phase) * 2;
    ctx.save(); ctx.translate(pickup.x, pickup.y); ctx.rotate(Math.PI / 4);
    ctx.shadowColor = "#8bf3ac"; ctx.shadowBlur = 18;
    ctx.strokeStyle = "#9ef5b9"; ctx.lineWidth = 2; ctx.strokeRect(-10 - pulse, -10 - pulse, 20 + pulse * 2, 20 + pulse * 2);
    ctx.restore();
    ctx.fillStyle = "#bcffd0"; ctx.fillRect(pickup.x - 1.5, pickup.y - 6, 3, 12); ctx.fillRect(pickup.x - 6, pickup.y - 1.5, 12, 3);
  }
  for (const particle of g.particles) {
    ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.fillStyle = particle.color; ctx.shadowColor = particle.color; ctx.shadowBlur = 9;
    ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size * (particle.life / particle.maxLife), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  for (const bullet of g.bullets) {
    ctx.save(); ctx.translate(bullet.x, bullet.y); ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
    ctx.shadowColor = "#9cfbed"; ctx.shadowBlur = 18;
    ctx.fillStyle = "#bafff4"; roundedRect(ctx, -9, -2.5, 18, 5, 2.5); ctx.fill(); ctx.restore();
  }
  for (const enemy of g.enemies) drawEnemy(ctx, enemy, g.elapsed);
  drawShip(ctx, g.player.x, g.player.y, g, g.status === "title");
  if (g.status === "playing" && g.hasAimed) {
    const { x, y } = g.aim;
    ctx.strokeStyle = "rgba(157, 246, 231, 0.58)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.moveTo(x - 17, y); ctx.lineTo(x - 12, y);
    ctx.moveTo(x + 12, y); ctx.lineTo(x + 17, y);
    ctx.moveTo(x, y - 17); ctx.lineTo(x, y - 12);
    ctx.moveTo(x, y + 12); ctx.lineTo(x, y + 17); ctx.stroke();
  }
  if (g.intermission > 0 && g.status === "playing") {
    ctx.fillStyle = "rgba(6, 17, 27, 0.58)"; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#a3f6e9"; ctx.font = "600 13px monospace";
    ctx.fillText("SECTOR CLEARED", W / 2, H / 2 - 31);
    ctx.fillStyle = "#f0f7ef"; ctx.font = "700 46px Arial, sans-serif";
    ctx.fillText(`WAVE ${String(g.wave + 1).padStart(2, "0")} INCOMING`, W / 2, H / 2 + 22);
    ctx.fillStyle = "#9caeb8"; ctx.font = "14px Arial, sans-serif";
    ctx.fillText("Hull repaired +20", W / 2, H / 2 + 54);
  }
  if (g.flash > 0) { ctx.fillStyle = `rgba(255, 98, 101, ${g.flash * 0.12})`; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}
function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(time * (e.kind === "dart" ? -1.6 : 0.45) + e.phase);
  const color = e.kind === "brute" ? "#ffbb83" : e.kind === "dart" ? "#f17bb4" : "#f48980";
  ctx.shadowColor = color; ctx.shadowBlur = e.hit > 0 ? 28 : 13;
  ctx.strokeStyle = e.hit > 0 ? "#ffffff" : color;
  ctx.fillStyle = e.kind === "brute" ? "#482f36" : "#3c2b3b";
  ctx.lineWidth = e.kind === "brute" ? 3 : 2;
  ctx.beginPath();
  const sides = e.kind === "dart" ? 3 : e.kind === "brute" ? 6 : 4;
  for (let i = 0; i < sides; i++) {
    const a = i * Math.PI * 2 / sides - Math.PI / 2;
    const px = Math.cos(a) * e.radius, py = Math.sin(a) * e.radius;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.rotate(-time * 0.7);
  ctx.fillStyle = e.hit > 0 ? "#fff" : color;
  ctx.beginPath(); ctx.arc(0, 0, e.kind === "brute" ? 6 : 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  if (e.kind === "brute" && e.hp < e.maxHp) {
    ctx.fillStyle = "#533d43"; ctx.fillRect(e.x - 19, e.y - 32, 38, 3);
    ctx.fillStyle = "#ffbc85"; ctx.fillRect(e.x - 19, e.y - 32, 38 * e.hp / e.maxHp, 3);
  }
}
function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, g: Game, preview: boolean) {
  const target = preview ? { x: x + Math.cos(g.elapsed * 0.7) * 100, y: y + Math.sin(g.elapsed * 0.7) * 100 } :
    g.hasAimed ? g.aim : nearestEnemy(g) ?? { x, y: y - 100 };
  const angle = Math.atan2(target.y - y, target.x - x) + Math.PI / 2;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  if (g.invulnerable > 0 && Math.floor(g.elapsed * 15) % 2 === 0) ctx.globalAlpha = 0.48;
  ctx.shadowColor = "#67eee1"; ctx.shadowBlur = 27;
  ctx.fillStyle = "rgba(91, 231, 218, 0.07)";
  ctx.beginPath(); ctx.arc(0, 0, 30 + Math.sin(g.elapsed * 4) * 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(107, 233, 221, 0.34)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, 26, 0.25, Math.PI * 1.15); ctx.stroke();
  const flame = 7 + Math.sin(g.elapsed * 30) * 3;
  ctx.fillStyle = "#f0a66c"; ctx.beginPath(); ctx.moveTo(-5, 15); ctx.lineTo(0, 20 + flame); ctx.lineTo(5, 15); ctx.fill();
  ctx.fillStyle = "#a7fff1";
  ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(14, 14); ctx.lineTo(5, 10); ctx.lineTo(0, 15);
  ctx.lineTo(-5, 10); ctx.lineTo(-14, 14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#214456"; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(5, 6); ctx.lineTo(0, 2); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function stepGame(g: Game, dt: number, playSound: (kind: string) => void, onFinish: (status: Status, score: number) => void) {
  if (g.status === "playing" || g.status === "title") g.elapsed += dt;
  g.shake = Math.max(0, g.shake - dt * 24); g.flash = Math.max(0, g.flash - dt * 3);
  for (const p of g.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 2; p.vy *= 1 - dt * 2; p.life -= dt; }
  g.particles = g.particles.filter(p => p.life > 0);
  if (g.status !== "playing") return;
  g.cooldown = Math.max(0, g.cooldown - dt);
  g.dashCooldown = Math.max(0, g.dashCooldown - dt);
  g.invulnerable = Math.max(0, g.invulnerable - dt);
  if (g.intermission > 0) {
    g.intermission -= dt;
    if (g.intermission <= 0) {
      g.intermission = 0; g.wave++; g.spawned = 0; g.spawnClock = 0.6;
      g.health = Math.min(100, g.health + 20); playSound("wave");
    }
    return;
  }
  const down = (key: string) => g.keys.has(key) || g.touchKeys.has(key);
  let mx = Number(down("d") || down("arrowright")) - Number(down("a") || down("arrowleft"));
  let my = Number(down("s") || down("arrowdown")) - Number(down("w") || down("arrowup"));
  const magnitude = Math.hypot(mx, my);
  if (magnitude) { mx /= magnitude; my /= magnitude; }
  g.player.x = clamp(g.player.x + mx * 255 * dt, 41, W - 41);
  g.player.y = clamp(g.player.y + my * 255 * dt, 41, H - 41);
  if ((down("shift") || down("dash")) && g.dashCooldown <= 0) {
    let dx = mx, dy = my;
    if (!magnitude) {
      const aim = g.hasAimed ? g.aim : nearestEnemy(g) ?? { x: g.player.x, y: g.player.y - 1 };
      const len = Math.hypot(aim.x - g.player.x, aim.y - g.player.y) || 1;
      dx = (aim.x - g.player.x) / len; dy = (aim.y - g.player.y) / len;
    }
    emit(g, g.player.x, g.player.y, "#72f5df", 18, 100);
    g.player.x = clamp(g.player.x + dx * 135, 41, W - 41);
    g.player.y = clamp(g.player.y + dy * 135, 41, H - 41);
    g.dashCooldown = 4; g.invulnerable = 0.32; playSound("dash");
    g.touchKeys.delete("dash");
  }
  if ((g.firing || down(" ") || down("fire")) && g.cooldown <= 0) {
    const target = down(" ") || down("fire") || !g.hasAimed ? nearestEnemy(g) ?? g.aim : g.aim;
    const angle = Math.atan2(target.y - g.player.y, target.x - g.player.x);
    const spread = g.wave >= 4 ? [-0.105, 0, 0.105] : g.wave >= 2 ? [-0.075, 0.075] : [0];
    for (const offset of spread) {
      const a = angle + offset;
      g.bullets.push({ x: g.player.x + Math.cos(a) * 22, y: g.player.y + Math.sin(a) * 22,
        vx: Math.cos(a) * 680, vy: Math.sin(a) * 680, life: 1.35, damage: 1 });
    }
    g.cooldown = Math.max(0.12, 0.185 - g.wave * 0.008);
    emit(g, g.player.x + Math.cos(angle) * 22, g.player.y + Math.sin(angle) * 22, "#a9fff0", 2, 45);
    playSound("shoot");
  }
  if (g.spawned < WAVE_TARGETS[g.wave - 1]) {
    g.spawnClock -= dt;
    if (g.spawnClock <= 0) {
      spawnEnemy(g); g.spawned++;
      g.spawnClock = Math.max(0.49, 1.22 - g.wave * 0.14) * random(0.78, 1.2);
    }
  }
  for (const bullet of g.bullets) { bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; bullet.life -= dt; }
  for (const enemy of g.enemies) {
    enemy.hit = Math.max(0, enemy.hit - dt);
    const dx = g.player.x - enemy.x, dy = g.player.y - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    enemy.x += dx / len * enemy.speed * dt; enemy.y += dy / len * enemy.speed * dt;
    if (len < enemy.radius + 15 && g.invulnerable <= 0) {
      g.health = Math.max(0, g.health - (enemy.kind === "brute" ? 25 : 16));
      g.invulnerable = 0.85; g.shake = 7; g.flash = 1;
      enemy.x -= dx / len * 35; enemy.y -= dy / len * 35;
      emit(g, g.player.x, g.player.y, "#ff8e85", 19, 160); playSound("hurt");
      if (g.health <= 0) { g.status = "lost"; onFinish("lost", g.score); return; }
    }
  }
  for (const bullet of g.bullets) {
    if (bullet.life <= 0) continue;
    for (const enemy of g.enemies) {
      if (enemy.hp > 0 && distance(bullet, enemy) < enemy.radius + 4) {
        bullet.life = 0; enemy.hp -= bullet.damage; enemy.hit = 0.13;
        emit(g, bullet.x, bullet.y, enemy.kind === "brute" ? "#ffc18b" : "#f696a5", 5, 90);
        if (enemy.hp <= 0) {
          g.score += enemy.kind === "brute" ? 300 : enemy.kind === "dart" ? 150 : 100;
          g.kills++; g.shake = Math.max(g.shake, enemy.kind === "brute" ? 5 : 2);
          emit(g, enemy.x, enemy.y, enemy.kind === "brute" ? "#ffc18b" : "#f88f9a", enemy.kind === "brute" ? 24 : 14, 190);
          if (Math.random() < 0.085 && g.health < 85) g.pickups.push({ x: enemy.x, y: enemy.y, life: 9, phase: random(0, 6) });
          playSound("kill");
        } else playSound("hit");
        break;
      }
    }
  }
  g.bullets = g.bullets.filter(b => b.life > 0 && b.x > 0 && b.x < W && b.y > 0 && b.y < H);
  g.enemies = g.enemies.filter(e => e.hp > 0);
  for (const pickup of g.pickups) {
    pickup.life -= dt;
    if (distance(pickup, g.player) < 27) {
      g.health = Math.min(100, g.health + 25); pickup.life = 0;
      emit(g, pickup.x, pickup.y, "#a4f7b8", 18); playSound("heal");
    }
  }
  g.pickups = g.pickups.filter(p => p.life > 0);
  if (g.spawned === WAVE_TARGETS[g.wave - 1] && g.enemies.length === 0) {
    if (g.wave === MAX_WAVE) {
      g.score += Math.round(g.health) * 10 + 1000;
      g.status = "won"; playSound("win"); onFinish("won", g.score);
    } else { g.intermission = 2.5; g.bullets = []; playSound("wave"); }
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game>(newGame());
  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);
  const soundAtRef = useRef(0);
  const [ui, setUi] = useState<Snapshot>(() => snapshot(gameRef.current));
  const [muted, setMuted] = useState(false);
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem("last-signal-best")) || 0; } catch { return 0; } });

  const playSound = useCallback((kind: string) => {
    if (mutedRef.current) return;
    if (kind === "shoot" && performance.now() - soundAtRef.current < 80) return;
    if (kind === "shoot") soundAtRef.current = performance.now();
    try {
      const Ctx = window.AudioContext;
      if (!Ctx) return;
      const audio = audioRef.current ?? new Ctx(); audioRef.current = audio;
      if (audio.state === "suspended") void audio.resume();
      const osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
      const config: Record<string, [number, number, number, OscillatorType, number]> = {
        shoot: [440, 190, 0.065, "triangle", 0.035], hit: [200, 100, 0.09, "sawtooth", 0.045],
        kill: [320, 95, 0.17, "triangle", 0.07], hurt: [160, 48, 0.28, "sawtooth", 0.12],
        dash: [180, 530, 0.16, "sine", 0.08], heal: [370, 760, 0.28, "sine", 0.075],
        wave: [260, 560, 0.4, "sine", 0.08], win: [350, 880, 0.8, "sine", 0.11],
      };
      const [from, to, duration, type, volume] = config[kind] ?? config.hit;
      osc.type = type; osc.frequency.setValueAtTime(from, now);
      osc.frequency.exponentialRampToValueAtTime(to, now + duration);
      gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain); gain.connect(audio.destination); osc.start(now); osc.stop(now + duration);
    } catch { /* Audio is optional when the browser disallows it. */ }
  }, []);
  const finish = useCallback((status: Status, score: number) => {
    setUi(snapshot(gameRef.current));
    if (status === "won" || status === "lost") {
      setBest(current => {
        const next = Math.max(current, score);
        try { localStorage.setItem("last-signal-best", String(next)); } catch { /* Private browsing. */ }
        return next;
      });
    }
  }, []);
  const startGame = useCallback(() => {
    gameRef.current = newGame("playing"); setUi(snapshot(gameRef.current));
    playSound("wave"); canvasRef.current?.focus();
  }, [playSound]);
  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (g.status === "playing") { g.status = "paused"; g.firing = false; g.keys.clear(); g.touchKeys.clear(); }
    else if (g.status === "paused") g.status = "playing";
    else return;
    setUi(snapshot(g));
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let frame = 0, last = performance.now(), lastUi = 0;
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.04); last = now;
      stepGame(gameRef.current, dt, playSound, finish); drawArena(ctx, gameRef.current);
      if (now - lastUi > 100) { setUi(snapshot(gameRef.current)); lastUi = now; }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playSound, finish]);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "shift", "escape"].includes(key)) e.preventDefault();
      if ((key === "p" || key === "escape") && !e.repeat) { togglePause(); return; }
      if (key === "r" && !e.repeat && gameRef.current.status === "paused") { startGame(); return; }
      if (key === "enter" && !e.repeat && ["title", "won", "lost"].includes(gameRef.current.status)) { startGame(); return; }
      gameRef.current.keys.add(key);
    };
    const onKeyUp = (e: KeyboardEvent) => gameRef.current.keys.delete(e.key.toLowerCase());
    const onBlur = () => {
      const g = gameRef.current; g.keys.clear(); g.touchKeys.clear(); g.firing = false;
      if (g.status === "playing") { g.status = "paused"; setUi(snapshot(g)); }
    };
    window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp); window.addEventListener("blur", onBlur);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("blur", onBlur); };
  }, [startGame, togglePause]);
  const pointCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    gameRef.current.aim = { x: (e.clientX - rect.left) / rect.width * W, y: (e.clientY - rect.top) / rect.height * H };
    gameRef.current.hasAimed = true;
  };
  const touchControl = (key: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); gameRef.current.touchKeys.add(key); },
    onPointerUp: () => gameRef.current.touchKeys.delete(key),
    onPointerCancel: () => gameRef.current.touchKeys.delete(key),
    onLostPointerCapture: () => gameRef.current.touchKeys.delete(key),
  });
  const progress = ui.status === "won" ? 100 : ((ui.wave - 1) + Math.min(ui.spawned, WAVE_TARGETS[ui.wave - 1]) / WAVE_TARGETS[ui.wave - 1]) / MAX_WAVE * 100;
  const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

  return (
    <div className="app-shell">
      <style>{`
        * { box-sizing: border-box; }
        html, body, #root { min-height: 100%; margin: 0; }
        body { background: #09131c; color: #e8f4f1; font-family: 'Trebuchet MS', Arial, sans-serif; }
        button { font: inherit; cursor: pointer; }
        button:focus-visible, canvas:focus-visible { outline: 2px solid #94f7de; outline-offset: 4px; }
        .app-shell { min-height: 100vh; padding: 31px clamp(20px, 4.25vw, 76px) 22px; background: radial-gradient(circle at 55% 0%, #172a36 0, #0b1822 42%, #09131c 85%); overflow: hidden; }
        .topbar { max-width: 1510px; margin: auto; display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 1px solid #2c424a; padding-bottom: 23px; gap: 20px; }
        .brand-lockup { display: flex; align-items: flex-start; gap: 15px; }
        .brand-mark { width: 37px; height: 37px; flex: none; margin-top: 7px; color: #9df4df; }
        .brand-title { margin: 0; font-size: clamp(30px, 3.4vw, 53px); line-height: .95; letter-spacing: -.075em; font-weight: 700; color: #f0f6f2; }
        .brand-sub { color: #9db1b5; font-size: 12px; letter-spacing: .005em; margin: 11px 0 0; }
        .top-actions { display: flex; align-items: center; gap: 19px; padding-top: 9px; }
        .top-id, .micro { font-family: 'Courier New', monospace; font-size: 10px; font-weight: 500; letter-spacing: .15em; text-transform: uppercase; }
        .top-id { color: #718e98; white-space: nowrap; margin-right: 12px; }
        .plain-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid #35515a; background: transparent; color: #b9d1d1; border-radius: 3px; height: 34px; padding: 0 12px; font-family: 'Courier New', monospace; font-size: 10px; letter-spacing: .08em; transition: color .2s, border-color .2s, background .2s; white-space: nowrap; }
        .plain-button:hover { color: #adf9e7; border-color: #85cfbf; background: #142e34; }
        .game-layout { max-width: 1510px; margin: 33px auto 0; display: grid; grid-template-columns: minmax(0, 1fr) 238px; gap: clamp(25px, 3.4vw, 53px); align-items: start; }
        .play-column { min-width: 0; }
        .arena-topline { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 13px; }
        .eyebrow { color: #86e4d2; display: flex; gap: 10px; align-items: center; }
        .signal-dot { width: 6px; height: 6px; background: #93f1de; border-radius: 50%; box-shadow: 0 0 10px #80f2dc; animation: blink 2s infinite; }
        .arena-topline .right { color: #708f99; }
        .arena-wrap { position: relative; width: 100%; aspect-ratio: 8 / 5; border: 1px solid #35525c; box-shadow: 0 24px 70px #020c14a6, 0 0 0 5px #11222b; background: #101d2b; overflow: hidden; }
        .arena-wrap canvas { width: 100%; height: 100%; display: block; touch-action: none; cursor: crosshair; }
        .overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; background: radial-gradient(ellipse at center, rgba(9,22,31,.82) 0%, rgba(9,22,31,.64) 45%, rgba(9,22,31,.24) 100%); animation: enter .35s ease-out both; }
        .overlay .micro { color: #9df4df; }
        .overlay h2 { max-width: 650px; font-size: clamp(34px, 4.1vw, 65px); line-height: 1.04; letter-spacing: -.065em; margin: 22px 0 15px; color: #f2f8f4; font-weight: 600; }
        .overlay p { color: #bacbd0; font-size: clamp(13px, 1.2vw, 16px); line-height: 1.55; margin: 0; max-width: 410px; }
        .primary-button { margin-top: 30px; min-width: 205px; border: 0; background: #a4f4df; color: #10242a; border-radius: 3px; padding: 16px 21px; font-weight: 700; font-size: 14px; letter-spacing: -.02em; display: inline-flex; align-items: center; justify-content: space-between; gap: 32px; transition: transform .2s, background .2s, box-shadow .2s; box-shadow: 0 7px 30px #80f0d630; }
        .primary-button:hover { transform: translateY(-3px); background: #c0ffe9; box-shadow: 0 12px 35px #80f0d64a; }
        .restart-button { margin-top: 16px; padding: 3px 5px; color: #aac8c9; background: transparent; border: 0; border-bottom: 1px solid #648487; font-family: 'Courier New', monospace; font-size: 11px; letter-spacing: .07em; }
        .restart-button:hover { color: #baffea; border-color: #baffea; }
        .overlay-note { margin-top: 21px; color: #8aa3ac; }
        .end-score { color: #a5f5e4; font-size: 28px; letter-spacing: -.04em; margin-top: 17px; font-weight: 600; }
        .arena-bottomline { display: flex; justify-content: space-between; gap: 15px; padding-top: 18px; color: #7c9ca3; }
        .arena-bottomline strong { color: #bed4d2; font-weight: 500; }
        .sidebar { padding-top: 0; }
        .side-heading { color: #86e4d2; margin: 1px 0 21px; }
        .wave-number { display: flex; align-items: baseline; color: #f0f6f2; font-size: clamp(62px, 6.3vw, 90px); line-height: .86; letter-spacing: -.095em; font-weight: 600; }
        .wave-number span { color: #54727c; font-size: 29px; letter-spacing: -.055em; font-weight: 400; padding-left: 8px; }
        .wave-caption { color: #8faab0; margin-top: 13px; font-size: 13px; }
        .progress-track { height: 2px; background: #304a51; margin-top: 25px; overflow: hidden; }
        .progress-fill { height: 100%; background: #99efda; transition: width .25s linear; box-shadow: 0 0 9px #8af1d7; }
        .metric { border-top: 1px solid #28414a; padding: 24px 0 25px; }
        .metric.first { margin-top: 28px; }
        .metric-label { display: flex; justify-content: space-between; align-items: center; color: #86a0a8; }
        .metric-label span:last-child { color: #acc5c8; }
        .score-number { margin-top: 10px; color: #f0f6f2; font-size: 40px; line-height: 1; font-weight: 500; letter-spacing: -.06em; font-variant-numeric: tabular-nums; }
        .best-line { font-family: 'Courier New', monospace; color: #6e8a94; font-size: 10px; letter-spacing: .04em; margin-top: 10px; }
        .health-row { display: flex; align-items: baseline; gap: 5px; margin-top: 12px; }
        .health-value { font-size: 31px; line-height: 1; letter-spacing: -.055em; color: #f0f6f2; }
        .health-unit { color: #738f97; font-size: 12px; }
        .health-track { margin-top: 15px; height: 5px; background: #2b454c; overflow: hidden; }
        .health-fill { height: 100%; background: #9bf0dc; transition: width .2s, background .2s; }
        .health-fill.low { background: #fa898c; }
        .dash-line { margin-top: 14px; font-size: 11px; font-family: 'Courier New', monospace; color: #78949b; }
        .dash-line b { color: #a9ebdc; font-weight: 500; }
        .controls { border-top: 1px solid #28414a; padding-top: 23px; }
        .control-list { display: grid; gap: 13px; margin-top: 19px; }
        .control-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #819da4; font-size: 12px; }
        .key { color: #c1d8d7; font-family: 'Courier New', monospace; font-size: 10px; white-space: nowrap; }
        .footer { max-width: 1510px; margin: 32px auto 0; border-top: 1px solid #223b44; padding-top: 16px; display: flex; justify-content: space-between; gap: 15px; color: #5e7b85; }
        .touch-controls { display: none; }
        @keyframes blink { 50% { opacity: .3; } }
        @keyframes enter { from { opacity: 0; transform: scale(1.025); } to { opacity: 1; transform: scale(1); } }
        @media (max-width: 950px) { .game-layout { grid-template-columns: minmax(0,1fr) 190px; gap: 24px; } .top-id { display: none; } .sidebar .control-list { gap: 11px; } }
        @media (max-width: 720px) { .app-shell { padding: 22px 18px 24px; } .topbar { padding-bottom: 20px; align-items: center; } .brand-mark { width: 29px; height: 29px; margin-top: 3px; } .brand-lockup { gap: 9px; } .brand-sub { font-size: 10px; margin-top: 7px; } .top-actions { padding-top: 0; gap: 7px; } .top-actions .plain-button { padding: 0 9px; font-size: 9px; } .game-layout { display: flex; flex-direction: column; margin-top: 25px; gap: 26px; } .play-column { width: 100%; } .sidebar { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; } .sidebar-top { grid-column: 1 / -1; } .wave-number { font-size: 57px; } .wave-caption { margin-top: 7px; } .progress-track { margin-top: 16px; } .metric.first { margin-top: 20px; } .metric { padding: 18px 0; } .controls { grid-column: 1 / -1; } .control-list { grid-template-columns: 1fr 1fr; } .footer { margin-top: 25px; } }
        @media (max-width: 560px) { .arena-wrap { aspect-ratio: 8 / 6; } .overlay h2 { font-size: clamp(30px, 8vw, 44px); margin: 12px 0 10px; } .overlay p { font-size: 12px; } .overlay .micro { font-size: 9px; } .primary-button { margin-top: 18px; padding: 12px 16px; min-width: 170px; font-size: 12px; } .overlay-note { margin-top: 12px; font-size: 8px; } .arena-topline .right, .arena-bottomline span:last-child { display: none; } .arena-bottomline { font-size: 9px; padding-top: 13px; } .touch-controls { display: flex; justify-content: space-between; gap: 18px; margin-top: 18px; touch-action: none; user-select: none; } .dpad { display: grid; grid-template-columns: repeat(3, 43px); grid-template-rows: repeat(2, 43px); gap: 4px; } .touch-button { border: 1px solid #42636a; background: #182d36; color: #b4ece0; border-radius: 4px; font-family: 'DM Mono', monospace; font-size: 14px; touch-action: none; } .touch-button:active { background: #2a5a5c; } .dpad .up { grid-column: 2; } .dpad .left { grid-column: 1; grid-row: 2; } .dpad .down { grid-column: 2; grid-row: 2; } .dpad .right { grid-column: 3; grid-row: 2; } .action-pad { display: flex; align-items: end; gap: 8px; } .action-pad .touch-button { width: 59px; height: 59px; font-size: 10px; } .action-pad .fire { width: 72px; height: 72px; background: #8eebd4; color: #10262c; border: 0; font-weight: 700; } .footer { font-size: 8px; } }
        @media (hover: none) and (min-width: 561px) { .touch-controls { display: flex; justify-content: space-between; margin-top: 16px; touch-action: none; } .dpad { display: grid; grid-template-columns: repeat(3, 45px); grid-template-rows: repeat(2, 45px); gap: 4px; } .touch-button { border: 1px solid #42636a; background: #182d36; color: #b4ece0; border-radius: 4px; touch-action: none; } .dpad .up { grid-column: 2; } .dpad .left { grid-column: 1; grid-row: 2; } .dpad .down { grid-column: 2; grid-row: 2; } .dpad .right { grid-column: 3; grid-row: 2; } .action-pad { display: flex; align-items: end; gap: 8px; } .action-pad .touch-button { width: 60px; height: 60px; } .action-pad .fire { width: 72px; height: 72px; background: #8eebd4; color: #10262c; } }
        @media (max-width: 560px) {
          .topbar { flex-wrap: wrap; gap: 14px; }
          .top-actions { width: 100%; justify-content: flex-end; }
          .overlay { padding: 10px 15px; }
          .overlay h2 { font-size: clamp(27px, 7.6vw, 38px); margin: 7px 0 6px; line-height: 1.02; }
          .overlay p { font-size: 11px; line-height: 1.35; }
          .primary-button { margin-top: 11px; padding: 10px 14px; }
          .restart-button { margin-top: 9px; font-size: 10px; }
          .overlay-note { display: none; }
          .end-score { font-size: 20px; margin-top: 8px; }
        }
      `}</style>

      <header className="topbar">
        <div className="brand-lockup">
          <svg className="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 2 24 16 38 20 24 24 20 38 16 24 2 20 16 16 20 2Z" stroke="currentColor" strokeWidth="1.7"/><circle cx="20" cy="20" r="3" fill="currentColor"/></svg>
          <div><h1 className="brand-title">LAST SIGNAL<span style={{ color: "#9af0dc" }}>.</span></h1><p className="brand-sub">A small ship against an endless dark. Make it to dawn.</p></div>
        </div>
        <div className="top-actions"><span className="top-id">ARCADE / 001</span>
          <button className="plain-button" onClick={() => { mutedRef.current = !mutedRef.current; setMuted(mutedRef.current); }} aria-label={muted ? "Unmute sound" : "Mute sound"}>{muted ? "SOUND OFF" : "SOUND ON"}</button>
          <button className="plain-button" onClick={togglePause} disabled={ui.status !== "playing" && ui.status !== "paused"} style={{ opacity: ui.status === "playing" || ui.status === "paused" ? 1 : .45 }}>{ui.status === "paused" ? "RESUME" : "PAUSE"}</button>
        </div>
      </header>
      <main className="game-layout">
        <section className="play-column" aria-label="Last Signal game">
          <div className="arena-topline micro"><span className="eyebrow"><span className="signal-dot" /> {ui.status === "playing" ? "SIGNAL ACTIVE" : ui.status === "paused" ? "SIGNAL ON HOLD" : "SIGNAL AWAITING"}</span><span className="right">SECTOR 01 / DEEP SPACE</span></div>
          <div className="arena-wrap">
            <canvas ref={canvasRef} width={W * 2} height={H * 2} tabIndex={0} aria-label="Game arena. Move with WASD or arrow keys, aim with mouse and shoot with click or space."
              onPointerMove={e => { if (e.pointerType === "mouse") pointCanvas(e); }}
              onPointerDown={e => { if (e.pointerType === "mouse" && e.button !== 0) return; pointCanvas(e); gameRef.current.firing = true; e.currentTarget.setPointerCapture(e.pointerId); }}
              onPointerUp={() => { gameRef.current.firing = false; }}
              onPointerCancel={() => { gameRef.current.firing = false; }}
              onLostPointerCapture={() => { gameRef.current.firing = false; }} />
            {ui.status !== "playing" && <div className="overlay">
              <span className="micro">{ui.status === "title" ? "INCOMING TRANSMISSION / 001" : ui.status === "paused" ? "TRANSMISSION INTERRUPTED" : ui.status === "won" ? "TRANSMISSION COMPLETE" : "SIGNAL LOST"}</span>
              <h2>{ui.status === "title" ? "Keep the signal alive." : ui.status === "paused" ? "Take a breath." : ui.status === "won" ? "The light made it through." : "The dark caught up."}</h2>
              <p>{ui.status === "title" ? "Survive five escalating waves. Outmaneuver the swarm, collect repairs, and hold the line." : ui.status === "paused" ? "The stars can wait. Your ship is right where you left it." : ui.status === "won" ? "Five waves down. The signal lives to see another sunrise." : "Every last stand starts with another try. Get back out there."}</p>
              {(ui.status === "won" || ui.status === "lost") && <div className="end-score">{ui.score.toLocaleString()} PTS</div>}
              <button className="primary-button" onClick={ui.status === "paused" ? togglePause : startGame}><span>{ui.status === "title" ? "Launch mission" : ui.status === "paused" ? "Resume mission" : "Fly again"}</span><span aria-hidden="true">↗</span></button>
              {ui.status === "paused" && <button className="restart-button" onClick={startGame}>RESTART RUN</button>}
              <span className="overlay-note micro">{ui.status === "title" ? "PRESS ENTER TO START" : ui.status === "paused" ? "PRESS P OR ESC TO RESUME" : "PRESS ENTER TO RESTART"}</span>
            </div>}
          </div>
          <div className="arena-bottomline micro"><span><strong>OBJECTIVE</strong> / SURVIVE ALL 05 WAVES</span><span>TIME ELAPSED {formatTime(ui.elapsed)}</span></div>
          <div className="touch-controls" aria-label="Touch game controls">
            <div className="dpad"><button className="touch-button up" {...touchControl("arrowup")} aria-label="Move up">↑</button><button className="touch-button left" {...touchControl("arrowleft")} aria-label="Move left">←</button><button className="touch-button down" {...touchControl("arrowdown")} aria-label="Move down">↓</button><button className="touch-button right" {...touchControl("arrowright")} aria-label="Move right">→</button></div>
            <div className="action-pad"><button className="touch-button" {...touchControl("dash")}>DASH</button><button className="touch-button fire" {...touchControl("fire")}>FIRE</button></div>
          </div>
        </section>
        <aside className="sidebar" aria-label="Mission information">
          <div className="sidebar-top"><div className="side-heading micro">MISSION PROGRESS</div><div className="wave-number">{String(ui.wave).padStart(2, "0")}<span>/ 05</span></div><div className="wave-caption">{ui.status === "won" ? "All sectors cleared" : ui.intermission > 0 ? "Next wave incoming" : `Wave ${String(ui.wave).padStart(2, "0")} of ${String(MAX_WAVE).padStart(2, "0")}`}</div><div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div></div>
          <div className="metric first"><div className="metric-label micro"><span>SCORE</span><span>01 / 02</span></div><div className="score-number">{ui.score.toLocaleString().padStart(5, "0")}</div><div className="best-line">PERSONAL BEST {best.toLocaleString().padStart(5, "0")}</div></div>
          <div className="metric"><div className="metric-label micro"><span>HULL INTEGRITY</span><span>{ui.health <= 30 ? "CRITICAL" : "STABLE"}</span></div><div className="health-row"><span className="health-value">{ui.health}</span><span className="health-unit">/ 100</span></div><div className="health-track"><div className={`health-fill ${ui.health <= 30 ? "low" : ""}`} style={{ width: `${ui.health}%` }} /></div><div className="dash-line">DASH <b>{ui.dashCooldown <= 0 ? "READY" : `${ui.dashCooldown.toFixed(1)}s`}</b></div></div>
          <div className="controls"><div className="micro" style={{ color: "#86e4d2" }}>FLIGHT MANUAL</div><div className="control-list"><div className="control-item"><span>Move</span><span className="key">WASD / ARROWS</span></div><div className="control-item"><span>Aim</span><span className="key">MOUSE</span></div><div className="control-item"><span>Fire / auto-aim</span><span className="key">CLICK / SPACE</span></div><div className="control-item"><span>Dash</span><span className="key">SHIFT</span></div><div className="control-item"><span>Pause</span><span className="key">P / ESC</span></div></div></div>
        </aside>
      </main>
      <footer className="footer micro"><span>LAST SIGNAL © 2026</span><span>BUILT FOR THE BRAVE AND THE STUBBORN</span></footer>
    </div>
  );
}