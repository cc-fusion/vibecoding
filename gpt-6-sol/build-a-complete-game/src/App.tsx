import { useCallback, useEffect, useRef, useState } from "react";

// A self-contained canvas arcade game. All gameplay, artwork, sound, and UI live here.
const W = 1120, H = 640, TAU = Math.PI * 2;
const GOALS = [12, 16, 20];
type Phase = "start" | "playing" | "paused" | "lost" | "won";
type Kind = "drifter" | "dart" | "sentinel";
type Enemy = { x: number; y: number; vx: number; vy: number; hp: number; r: number; kind: Kind; fire: number; angle: number };
type Bullet = { x: number; y: number; vx: number; vy: number; r: number; life: number; hostile: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string };
type Pickup = { x: number; y: number; life: number };
type Boss = { x: number; y: number; hp: number; fire: number; burst: number; summon: number; time: number };
type Game = {
  phase: Phase; wave: number; hp: number; score: number; kills: number; waveKills: number; spawned: number;
  time: number; spawn: number; transition: number; combo: number; comboTime: number; shake: number; flash: number;
  player: { x: number; y: number; angle: number; invincible: number; dashCooldown: number; dashTime: number; dashX: number; dashY: number; shot: number };
  enemies: Enemy[]; bullets: Bullet[]; particles: Particle[]; pickups: Pickup[]; boss: Boss | null;
};
type Input = { keys: Set<string>; x: number; y: number; firing: boolean; dash: boolean; move: { id: number; x: number; y: number; dx: number; dy: number } | null; aimId: number | null };
type Hud = { phase: Phase; wave: number; hp: number; score: number; kills: number; combo: number; dash: number; bossHp: number; transition: number };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const dist = (x: number, y: number) => Math.hypot(x, y);

function makeGame(): Game {
  return { phase: "start", wave: 1, hp: 5, score: 0, kills: 0, waveKills: 0, spawned: 0,
    time: 0, spawn: 1.1, transition: 0, combo: 0, comboTime: 0, shake: 0, flash: 0,
    player: { x: W / 2, y: H / 2, angle: -Math.PI / 2, invincible: 0, dashCooldown: 0, dashTime: 0, dashX: 0, dashY: 0, shot: 0 },
    enemies: [], bullets: [], particles: [], pickups: [], boss: null };
}
function snapshot(g: Game): Hud {
  return { phase: g.phase, wave: g.wave, hp: g.hp, score: g.score, kills: g.waveKills,
    combo: g.combo, dash: g.player.dashCooldown, bossHp: g.boss?.hp ?? 0, transition: g.transition };
}

let audio: AudioContext | null = null;
type Sound = "fire" | "hit" | "kill" | "hurt" | "dash" | "heal" | "win";
function tone(kind: Sound, enabled: boolean) {
  if (!enabled) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const notes = { fire: [520, 250, .065, .018], hit: [130, 75, .1, .035], kill: [260, 70, .15, .055],
      hurt: [180, 45, .26, .09], dash: [180, 660, .14, .045], heal: [410, 810, .25, .06], win: [370, 900, .6, .09] };
    const [a, b, length, volume] = notes[kind], now = audio.currentTime;
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = kind === "hurt" || kind === "kill" ? "sawtooth" : "sine";
    oscillator.frequency.setValueAtTime(a, now);
    oscillator.frequency.exponentialRampToValueAtTime(b, now + length);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + length);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now); oscillator.stop(now + length);
  } catch { /* Sound is optional in browsers that block Web Audio. */ }
}
function explode(g: Game, x: number, y: number, color: string, count: number, speed = 150) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, TAU), v = rand(speed * .25, speed), life = rand(.25, .65);
    g.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, size: rand(1.5, 4), color });
  }
}
function spawnEnemy(g: Game, forced?: Kind) {
  const edge = Math.floor(rand(0, 4));
  const x = edge === 0 ? -35 : edge === 1 ? W + 35 : rand(35, W - 35);
  const y = edge === 2 ? -35 : edge === 3 ? H + 35 : rand(40, H - 40);
  const kind: Kind = forced ?? (g.wave === 1 ? (Math.random() < .24 ? "dart" : "drifter") :
    Math.random() < (g.wave === 2 ? .23 : .31) ? "sentinel" : Math.random() < .39 ? "dart" : "drifter");
  g.enemies.push({ x, y, vx: 0, vy: 0, hp: kind === "sentinel" ? 3 : kind === "dart" ? 1 : 2,
    r: kind === "sentinel" ? 19 : kind === "dart" ? 12 : 16, kind, fire: rand(1.2, 2.2), angle: 0 });
}
function hostileShot(g: Game, x: number, y: number, a: number, speed: number, r = 5) {
  g.bullets.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, life: 4, hostile: true });
}
function hurt(g: Game, play: (s: Sound) => void) {
  const p = g.player;
  if (g.phase !== "playing" || p.invincible > 0 || p.dashTime > 0) return;
  g.hp--; p.invincible = 1.35; g.shake = 11; g.flash = .24;
  explode(g, p.x, p.y, "#ff647c", 18, 210); play("hurt");
  if (g.hp <= 0) { g.hp = 0; g.phase = "lost"; explode(g, p.x, p.y, "#7cefff", 50, 320); }
}

function update(g: Game, input: Input, dt: number, play: (s: Sound) => void) {
  g.time += dt; g.shake = Math.max(0, g.shake - dt * 25); g.flash = Math.max(0, g.flash - dt);
  const p = g.player;
  p.invincible = Math.max(0, p.invincible - dt);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.shot -= dt; g.comboTime -= dt;
  if (g.comboTime <= 0) g.combo = 0;
  let mx = Number(input.keys.has("d") || input.keys.has("arrowright")) - Number(input.keys.has("a") || input.keys.has("arrowleft"));
  let my = Number(input.keys.has("s") || input.keys.has("arrowdown")) - Number(input.keys.has("w") || input.keys.has("arrowup"));
  if (input.move) { mx = input.move.dx; my = input.move.dy; }
  const m = dist(mx, my);
  if (m > 1) { mx /= m; my /= m; }
  if (input.dash && p.dashCooldown <= 0) {
    const a = dist(mx, my) > 0 ? Math.atan2(my, mx) : p.angle;
    p.dashX = Math.cos(a); p.dashY = Math.sin(a); p.dashTime = .18; p.dashCooldown = 3;
    explode(g, p.x, p.y, "#72edff", 16, 130); play("dash");
  }
  input.dash = false;
  const dashing = p.dashTime > 0;
  if (dashing) p.dashTime = Math.max(0, p.dashTime - dt);
  p.x = clamp(p.x + (dashing ? p.dashX * 850 : mx * 260) * dt, 22, W - 22);
  p.y = clamp(p.y + (dashing ? p.dashY * 850 : my * 260) * dt, 22, H - 22);
  if (dist(input.x - p.x, input.y - p.y) > 5) p.angle = Math.atan2(input.y - p.y, input.x - p.x);
  if ((input.firing || input.keys.has(" ")) && p.shot <= 0 && !dashing) {
    p.shot = .145;
    const a = p.angle + rand(-.025, .025);
    g.bullets.push({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
      vx: Math.cos(a) * 730, vy: Math.sin(a) * 730, r: 4, life: 1.35, hostile: false });
    explode(g, p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, "#98faff", 2, 50); play("fire");
  }

  if (g.transition > 0) {
    g.transition -= dt;
    if (g.transition <= 0) {
      g.transition = 0; g.wave++; g.waveKills = 0; g.spawned = 0; g.spawn = 1.1;
      g.enemies = []; g.bullets = [];
      if (g.wave === 4) {
        g.boss = { x: W / 2, y: 150, hp: 42, fire: 1.6, burst: 2.6, summon: 5, time: 0 };
        explode(g, W / 2, 150, "#ff6688", 45, 280);
      }
    }
  } else if (g.wave <= 3) {
    g.spawn -= dt;
    if (g.spawned < GOALS[g.wave - 1] && g.spawn <= 0) {
      spawnEnemy(g); g.spawned++; g.spawn = [1.03, .82, .65][g.wave - 1];
    }
  }
  if (g.boss) {
    const b = g.boss; b.time += dt;
    b.x += (W / 2 + Math.sin(b.time * .85) * 220 - b.x) * dt * 1.6;
    b.y += (148 + Math.sin(b.time * 1.25) * 42 - b.y) * dt * 1.5;
    b.fire -= dt; b.burst -= dt; b.summon -= dt;
    if (b.fire <= 0) {
      const a = Math.atan2(p.y - b.y, p.x - b.x);
      for (let i = -1; i <= 1; i++) hostileShot(g, b.x, b.y, a + i * .24, 255, 6);
      b.fire = 1.55;
    }
    if (b.burst <= 0) { for (let i = 0; i < 12; i++) hostileShot(g, b.x, b.y, b.time + i * TAU / 12, 175); b.burst = 3.1; }
    if (b.summon <= 0) { if (g.enemies.length < 4) { spawnEnemy(g, "dart"); spawnEnemy(g, "drifter"); } b.summon = 6; }
    if (dist(p.x - b.x, p.y - b.y) < 57) hurt(g, play);
  }
  for (const e of g.enemies) {
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.max(1, dist(dx, dy));
    e.angle = Math.atan2(dy, dx);
    const speed = e.kind === "dart" ? 172 + g.wave * 8 : e.kind === "sentinel" ? 75 : 100 + g.wave * 8;
    const direction = e.kind === "sentinel" && d < 245 ? -.65 : 1;
    e.vx += ((dx / d) * speed * direction - e.vx) * Math.min(1, dt * 4);
    e.vy += ((dy / d) * speed * direction - e.vy) * Math.min(1, dt * 4);
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.kind === "sentinel") {
      e.fire -= dt;
      if (e.fire <= 0) { hostileShot(g, e.x, e.y, e.angle, 235); e.fire = rand(1.7, 2.35); }
    }
    if (d < e.r + 14) hurt(g, play);
  }
  // Iterate backwards; a sector clear is committed after collision iteration so arrays stay valid.
  for (let i = g.bullets.length - 1; i >= 0; i--) {
    const b = g.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30) { g.bullets.splice(i, 1); continue; }
    if (b.hostile) {
      if (dist(b.x - p.x, b.y - p.y) < b.r + 12) { g.bullets.splice(i, 1); hurt(g, play); }
      continue;
    }
    let consumed = false;
    if (g.boss && dist(b.x - g.boss.x, b.y - g.boss.y) < b.r + 46) {
      g.boss.hp--; consumed = true; explode(g, b.x, b.y, "#ff7896", 4, 90);
      if (g.boss.hp <= 0) {
        explode(g, g.boss.x, g.boss.y, "#ff7a9a", 90, 400);
        g.score += 5000; g.boss = null; g.phase = "won"; g.shake = 19; play("win");
      }
    }
    if (!consumed) {
      for (let j = g.enemies.length - 1; j >= 0; j--) {
        const e = g.enemies[j];
        if (dist(b.x - e.x, b.y - e.y) < b.r + e.r) {
          consumed = true; e.hp--;
          explode(g, b.x, b.y, e.kind === "dart" ? "#ffba76" : "#bd9aff", 4, 75);
          if (e.hp <= 0) {
            explode(g, e.x, e.y, e.kind === "dart" ? "#ffb36b" : "#ad8aff", 15, 175);
            g.enemies.splice(j, 1); g.kills++;
            if (g.wave <= 3 && g.transition <= 0) g.waveKills++;
            g.combo = Math.min(5, g.combo + 1); g.comboTime = 3.5;
            g.score += (e.kind === "sentinel" ? 200 : e.kind === "dart" ? 150 : 100) * g.combo;
            if (g.kills % 9 === 0 && g.hp < 5) g.pickups.push({ x: e.x, y: e.y, life: 12 });
            play("kill");
            if (g.wave <= 3 && g.waveKills >= GOALS[g.wave - 1] && g.transition <= 0) {
              g.transition = 2.5; explode(g, W / 2, H / 2, "#7cefff", 35, 230);
            }
          } else play("hit");
          break;
        }
      }
    }
    if (consumed) g.bullets.splice(i, 1);
  }
  if (g.transition > 0) { g.enemies = []; g.bullets = []; }
  for (let i = g.pickups.length - 1; i >= 0; i--) {
    const item = g.pickups[i]; item.life -= dt;
    if (dist(item.x - p.x, item.y - p.y) < 28) {
      g.hp = Math.min(5, g.hp + 1); g.score += 250;
      explode(g, item.x, item.y, "#75f2bd", 20, 150); play("heal"); g.pickups.splice(i, 1);
    } else if (item.life <= 0) g.pickups.splice(i, 1);
  }
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const part = g.particles[i]; part.x += part.vx * dt; part.y += part.vy * dt;
    part.vx *= 1 - dt * 2; part.vy *= 1 - dt * 2; part.life -= dt;
    if (part.life <= 0) g.particles.splice(i, 1);
  }
}

function polygon(ctx: CanvasRenderingContext2D, sides: number, radius: number, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + i * TAU / sides;
    if (i === 0) ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
    else ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  ctx.closePath();
}
function draw(ctx: CanvasRenderingContext2D, g: Game, input: Input, now: number) {
  ctx.save(); ctx.clearRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(W * .52, H * .45, 30, W * .5, H * .5, 750);
  bg.addColorStop(0, "#101d31"); bg.addColorStop(.56, "#0a1324"); bg.addColorStop(1, "#060c18");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  if (g.shake > 0) ctx.translate(rand(-g.shake, g.shake), rand(-g.shake, g.shake));
  // Slow grid drift, orbital rings, and deterministic stars make an atmospheric arena.
  ctx.strokeStyle = "rgba(115,169,209,.065)"; ctx.lineWidth = 1;
  const offset = (now * 8) % 50;
  for (let x = -50 + offset; x < W + 50; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = -50 + offset; y < H + 50; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.save(); ctx.translate(W / 2, H / 2);
  for (const r of [165, 268, 380]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.strokeStyle = "rgba(85,177,221,.075)"; ctx.stroke(); }
  ctx.rotate(now * .035); ctx.strokeStyle = "rgba(79,194,225,.14)";
  for (let i = 0; i < 4; i++) { ctx.rotate(TAU / 4); ctx.beginPath(); ctx.arc(0, 0, 268, -.13, .13); ctx.stroke(); }
  ctx.restore();
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(170,211,236,${.09 + (Math.sin(now * 1.3 + i) + 1) * .08})`;
    const size = i % 9 === 0 ? 2 : 1; ctx.fillRect(i * 7919 % W, i * 4271 % H, size, size);
  }
  if (g.phase === "start") {
    ctx.save(); ctx.translate(825, 318); ctx.rotate(now * .12); ctx.shadowColor = "#46dffc"; ctx.shadowBlur = 38;
    for (let i = 0; i < 3; i++) {
      ctx.rotate(i === 0 ? 0 : Math.PI / 5); ctx.beginPath(); ctx.arc(0, 0, 130 + i * 39, .25, Math.PI * 1.78);
      ctx.strokeStyle = i === 0 ? "rgba(107,235,255,.65)" : "rgba(107,206,255,.23)"; ctx.lineWidth = i === 0 ? 2 : 1; ctx.stroke();
    }
    polygon(ctx, 6, 84, Math.PI / 6); ctx.fillStyle = "rgba(40,157,195,.11)"; ctx.fill(); ctx.strokeStyle = "rgba(119,237,255,.65)"; ctx.lineWidth = 2; ctx.stroke();
    polygon(ctx, 6, 52, Math.PI / 6); ctx.strokeStyle = "rgba(151,242,255,.48)"; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fillStyle = "#9df7ff"; ctx.fill(); ctx.restore();
  }
  for (const item of g.pickups) {
    ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(now * 1.5); ctx.shadowColor = "#61efb4"; ctx.shadowBlur = 20;
    polygon(ctx, 4, 13, Math.PI / 4); ctx.fillStyle = "#174e49"; ctx.fill(); ctx.strokeStyle = "#7ef5bd"; ctx.lineWidth = 2; ctx.stroke();
    ctx.rotate(-now * 1.5); ctx.fillStyle = "#b5ffdb"; ctx.fillRect(-1, -6, 2, 12); ctx.fillRect(-6, -1, 12, 2); ctx.restore();
  }
  for (const b of g.bullets) {
    ctx.save(); ctx.shadowBlur = 17; ctx.shadowColor = b.hostile ? "#ff648b" : "#62eaff";
    ctx.fillStyle = b.hostile ? "#ff7696" : "#a6faff"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.restore();
  }
  for (const e of g.enemies) {
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle);
    const color = e.kind === "dart" ? "#ffad6c" : e.kind === "sentinel" ? "#ed77b2" : "#a589ff";
    ctx.shadowColor = color; ctx.shadowBlur = 15; ctx.strokeStyle = color; ctx.lineWidth = 2;
    polygon(ctx, e.kind === "dart" ? 3 : e.kind === "sentinel" ? 4 : 6,
      e.kind === "sentinel" ? 21 : 17, e.kind === "sentinel" ? Math.PI / 4 : e.kind === "drifter" ? Math.PI / 6 : 0);
    ctx.fillStyle = e.kind === "dart" ? "#4b2b2a" : e.kind === "sentinel" ? "#492642" : "#2d2a51"; ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(7, 0); ctx.stroke();
    if (e.kind === "sentinel") { ctx.fillStyle = color; ctx.fillRect(-13, -28, 26 * e.hp / 3, 2); }
    ctx.restore();
  }
  if (g.boss) {
    const b = g.boss; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(now * .4);
    ctx.shadowColor = "#ff648a"; ctx.shadowBlur = 36;
    polygon(ctx, 6, 52, Math.PI / 6); ctx.fillStyle = "#472039"; ctx.fill(); ctx.strokeStyle = "#ff829c"; ctx.lineWidth = 3; ctx.stroke();
    ctx.rotate(-now * .85); polygon(ctx, 6, 38); ctx.strokeStyle = "#ff9eb2"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 16 + Math.sin(now * 5) * 2, 0, TAU); ctx.fillStyle = "#ff7192"; ctx.fill(); ctx.restore();
  }
  if (g.phase !== "start") {
    const p = g.player;
    if (g.phase !== "lost" || Math.floor(now * 10) % 2 === 0) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      if (p.invincible > 0 && Math.floor(now * 16) % 2 === 0) ctx.globalAlpha = .42;
      ctx.shadowColor = "#60e9ff"; ctx.shadowBlur = p.dashTime > 0 ? 34 : 20;
      ctx.beginPath(); ctx.moveTo(21, 0); ctx.lineTo(-14, -12); ctx.lineTo(-8, 0); ctx.lineTo(-14, 12); ctx.closePath();
      ctx.fillStyle = "#12516c"; ctx.fill(); ctx.strokeStyle = "#9af5ff"; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-13, -5); ctx.lineTo(-21 - Math.sin(now * 20) * 4, 0); ctx.lineTo(-13, 5); ctx.fillStyle = "#ffb676"; ctx.fill(); ctx.restore();
    }
    if (input.move) {
      ctx.beginPath(); ctx.arc(input.move.x, input.move.y, 40, 0, TAU); ctx.strokeStyle = "rgba(125,234,255,.35)"; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(input.move.x + input.move.dx * 28, input.move.y + input.move.dy * 28, 13, 0, TAU); ctx.fillStyle = "rgba(125,234,255,.45)"; ctx.fill();
    }
  }
  for (const part of g.particles) { ctx.globalAlpha = Math.max(0, part.life / part.max); ctx.fillStyle = part.color; ctx.fillRect(part.x, part.y, part.size, part.size); }
  ctx.globalAlpha = 1;
  if (g.flash > 0) { ctx.fillStyle = `rgba(255,74,111,${g.flash * .38})`; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}

const styles = `
* { box-sizing: border-box; } html, body, #root { margin: 0; min-height: 100%; }
body { background: #060b14; color: #e9f8ff; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
button { font: inherit; cursor: pointer; }
.page { min-height: 100vh; background: radial-gradient(ellipse 70% 45% at 50% -10%, #19324a 0%, transparent 70%), #060b14; padding: 0 42px 24px; overflow: hidden; }
.site-header { width: min(1180px, 100%); height: 89px; margin: auto; display: flex; align-items: center; justify-content: space-between; }
.brand { display: flex; align-items: center; gap: 12px; color: #e9faff; font-size: 17px; font-weight: 900; letter-spacing: .17em; }
.brand-mark { width: 29px; height: 29px; border: 2px solid #7defff; transform: rotate(45deg); display: grid; place-items: center; box-shadow: 0 0 17px #5ce8ff55; }
.brand-mark::after { content: ''; width: 9px; height: 9px; background: #82efff; box-shadow: 0 0 12px #82efff; }
.header-right { display: flex; align-items: center; gap: 28px; }
.edition { color: #63788c; font: 10px ui-monospace, monospace; letter-spacing: .2em; }
.sound-button { border: 0; background: transparent; color: #a8bac9; display: flex; align-items: center; gap: 9px; padding: 10px 0; font: 11px ui-monospace, monospace; letter-spacing: .12em; }
.sound-button:hover, .text-button:hover { color: #a4f5ff; }
.sound-indicator { width: 7px; height: 7px; border-radius: 50%; background: #7eeac2; box-shadow: 0 0 10px #7eeac2; }
.sound-indicator.off { background: #6d7b88; box-shadow: none; }
.game-frame { width: min(1180px, 100%); aspect-ratio: 1120 / 640; margin: 0 auto; position: relative; border: 1px solid #294057; overflow: hidden; background: #091321; box-shadow: 0 30px 100px #0008, 0 0 0 1px #07101c; user-select: none; }
.game-frame::before, .game-frame::after { content: ''; position: absolute; width: 20px; height: 20px; border-color: #80ebfb; z-index: 5; pointer-events: none; }
.game-frame::before { top: -1px; left: -1px; border-top: 2px solid; border-left: 2px solid; }
.game-frame::after { bottom: -1px; right: -1px; border-bottom: 2px solid; border-right: 2px solid; }
canvas { display: block; width: 100%; height: 100%; touch-action: none; cursor: crosshair; }
.scanlines { position: absolute; inset: 0; pointer-events: none; z-index: 1; opacity: .18; background: repeating-linear-gradient(to bottom, transparent 0, transparent 3px, #000 4px); }
.hud { position: absolute; z-index: 3; left: 0; right: 0; top: 0; padding: 25px 31px; display: flex; align-items: flex-start; justify-content: space-between; pointer-events: none; text-shadow: 0 2px 10px #000; }
.hud-group { width: 33%; } .hud-group.center { text-align: center; }
.hud-group.right { text-align: right; display: flex; justify-content: flex-end; gap: 26px; align-items: flex-start; }
.hud-label { display: block; color: #7795a9; font: 10px ui-monospace, monospace; letter-spacing: .2em; margin-bottom: 8px; }
.hearts { display: flex; gap: 7px; align-items: center; height: 21px; }
.heart { width: 14px; height: 14px; background: #ff718c; transform: rotate(45deg) scale(.82); box-shadow: 0 0 14px #ff607988; position: relative; margin: 3px 3px 0; }
.heart::before, .heart::after { content: ''; position: absolute; width: 14px; height: 14px; background: inherit; border-radius: 50%; }
.heart::before { left: -7px; } .heart::after { top: -7px; } .heart.empty { background: #384454; box-shadow: none; }
.score { font: 700 27px ui-monospace, monospace; color: #f3fcff; line-height: 1; letter-spacing: .09em; }
.combo { color: #ffc286; font: 700 10px ui-monospace, monospace; letter-spacing: .14em; margin-top: 7px; }
.wave-value { font: 700 18px ui-monospace, monospace; color: #e9faff; line-height: 1; }
.wave-value span { color: #86a7b7; font-size: 12px; }
.pause-button { pointer-events: auto; border: 1px solid #496278; color: #d0e8f2; background: #10243aab; height: 35px; width: 35px; display: grid; place-items: center; margin-top: 2px; transition: background .2s, border-color .2s; }
.pause-button:hover { background: #1c4056; border-color: #8feeff; }
.wave-track { width: 96px; height: 3px; background: #3a5061; margin-top: 10px; margin-left: auto; }
.wave-fill { display: block; height: 100%; background: #83ecff; box-shadow: 0 0 12px #83ecff; transition: width .2s; }
.bottom-hud { position: absolute; z-index: 3; bottom: 24px; left: 31px; right: 31px; display: flex; justify-content: space-between; align-items: flex-end; pointer-events: none; }
.dash-label { font: 10px ui-monospace, monospace; letter-spacing: .17em; color: #8ca7b7; margin-bottom: 9px; }
.dash-track { height: 3px; width: 115px; background: #385064; } .dash-fill { height: 100%; background: #81efff; box-shadow: 0 0 10px #74edff; }
.dash-ready { color: #b6f8ff; font: 10px ui-monospace, monospace; letter-spacing: .15em; margin-top: 7px; }
.sector-note { color: #63849a; font: 10px ui-monospace, monospace; letter-spacing: .18em; }
.boss-bar { position: absolute; z-index: 3; top: 88px; left: 50%; transform: translateX(-50%); width: min(350px, 40%); text-align: center; }
.boss-bar .hud-label { color: #ff9bad; } .boss-bar .wave-track { width: 100%; margin: 0; background: #57334a; height: 5px; }
.boss-bar .wave-fill { background: #ff7292; box-shadow: 0 0 15px #ff7292; }
.overlay { position: absolute; inset: 0; z-index: 4; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 8% 9%; background: linear-gradient(90deg, rgba(5,12,24,.95) 0%, rgba(5,12,24,.84) 37%, rgba(5,12,24,.13) 80%); animation: appear .35s ease-out both; }
.overlay:not(.start-overlay) { align-items: center; text-align: center; background: rgba(4,11,22,.82); backdrop-filter: blur(6px); }
.eyebrow { color: #7fe8f5; font: 700 11px ui-monospace, monospace; letter-spacing: .24em; text-transform: uppercase; margin: 0 0 19px; }
.eyebrow::before { content: ''; display: inline-block; vertical-align: middle; width: 23px; height: 1px; background: currentColor; margin-right: 11px; }
.game-title { font-family: Impact, "Arial Narrow", "Arial Black", sans-serif; font-size: clamp(75px, 10vw, 147px); line-height: .85; letter-spacing: .015em; color: #ecfbff; margin: 0; text-shadow: 0 7px 36px #0008; }
.game-title span { color: #83edff; }
.hero-copy { color: #b8cad7; font-size: clamp(14px, 1.35vw, 17px); line-height: 1.65; max-width: 350px; margin: 28px 0 29px; }
.primary-button { color: #04141d; background: #8bf0ff; border: 1px solid #b9f8ff; min-width: 206px; min-height: 54px; padding: 0 20px; display: inline-flex; align-items: center; justify-content: space-between; gap: 25px; font: 800 12px ui-monospace, monospace; letter-spacing: .11em; box-shadow: 0 0 28px #5de4ff30; transition: transform .2s, background .2s, box-shadow .2s; }
.primary-button:hover { transform: translateY(-3px); background: #c2faff; box-shadow: 0 8px 35px #5de4ff45; } .primary-button:active { transform: translateY(0); }
.start-controls { color: #7395a8; margin-top: 23px; font: 10px ui-monospace, monospace; letter-spacing: .13em; }
.start-controls strong { color: #b7d9e7; font-weight: 600; }
.touch-controls { display: none; }
.screen-title { font-family: Impact, "Arial Narrow", "Arial Black", sans-serif; font-size: clamp(64px, 8vw, 106px); line-height: .95; letter-spacing: .02em; margin: 0; color: #eefbff; }
.screen-title.danger { color: #ff829c; } .screen-title.victory { color: #9af4ff; }
.screen-copy { color: #a9becc; font-size: 16px; margin: 19px 0 25px; line-height: 1.5; }
.result-score { font: 700 26px ui-monospace, monospace; color: #f3fcff; letter-spacing: .1em; margin-bottom: 27px; }
.result-score small { display: block; color: #7895a8; font-size: 10px; letter-spacing: .2em; margin-bottom: 7px; }
.overlay-actions { display: flex; align-items: center; gap: 25px; }
.text-button { color: #a4bccb; border: 0; background: none; font: 700 11px ui-monospace, monospace; letter-spacing: .13em; padding: 12px 0; }
.wave-announcement { position: absolute; z-index: 3; pointer-events: none; left: 0; right: 0; top: 43%; text-align: center; color: #c8faff; font: 800 clamp(25px, 4vw, 45px) Impact, "Arial Narrow", sans-serif; letter-spacing: .15em; text-shadow: 0 0 28px #5ae5ff; animation: pulseIn .35s ease-out both; }
.wave-announcement small { display: block; font: 11px ui-monospace, monospace; letter-spacing: .25em; color: #8fb3c7; margin-top: 14px; }
.footer { width: min(1180px, 100%); margin: 0 auto; min-height: 70px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.controls-list { display: flex; gap: 26px; align-items: center; }
.control { color: #7892a3; font: 10px ui-monospace, monospace; letter-spacing: .09em; white-space: nowrap; }
.control kbd { color: #c1d7e2; font: inherit; border: 1px solid #344b60; padding: 5px 7px; margin-right: 7px; background: #101d2c; }
.footer-note { color: #526c7e; font: 10px ui-monospace, monospace; letter-spacing: .15em; white-space: nowrap; }
.mobile-dash { display: none; }
@keyframes appear { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulseIn { from { opacity: 0; transform: scale(.9); } to { opacity: 1; transform: scale(1); } }
@media (max-width: 800px) {
  .page { padding: 0 16px 20px; } .site-header { height: 70px; } .edition { display: none; }
  .game-frame { aspect-ratio: 1 / 1; } .overlay { padding: 8%; background: linear-gradient(90deg, rgba(5,12,24,.95), rgba(5,12,24,.7)); }
  .game-title { font-size: clamp(54px, 12vw, 100px); } .hero-copy { margin: 18px 0 22px; max-width: 260px; } .start-controls { display: none; }
  .touch-controls { display: block; color: #8bacbe; margin-top: 19px; font: 10px ui-monospace, monospace; letter-spacing: .08em; line-height: 1.6; }
  .hud { padding: 16px; } .hud-label { font-size: 8px; margin-bottom: 6px; } .score { font-size: 19px; } .hud-group.right { gap: 10px; } .wave-value { font-size: 15px; }
  .heart, .heart::before, .heart::after { width: 10px; height: 10px; } .heart::before { left: -5px; } .heart::after { top: -5px; } .hearts { gap: 3px; }
  .bottom-hud { left: 16px; right: 16px; bottom: 15px; } .sector-note { display: none; } .boss-bar { top: 67px; width: 48%; }
  .footer { min-height: 58px; } .controls-list { gap: 11px; flex-wrap: wrap; } .control { font-size: 9px; } .footer-note { display: none; }
  .mobile-dash { display: block; position: absolute; bottom: 16px; right: 16px; z-index: 3; border: 1px solid #79e6f4; background: #0e344bc9; color: #b5f7ff; padding: 13px; font: 700 11px ui-monospace, monospace; letter-spacing: .1em; }
}
@media (max-width: 520px) {
  .game-frame { aspect-ratio: 4 / 5; } .brand { font-size: 14px; } .sound-button { font-size: 10px; }
  .eyebrow { font-size: 9px; letter-spacing: .12em; } .game-title { font-size: clamp(48px, 13vw, 68px); } .hero-copy { font-size: 13px; }
  .primary-button { min-height: 48px; min-width: 178px; font-size: 10px; } .screen-title { font-size: 52px; } .screen-copy { font-size: 13px; }
  .overlay-actions { gap: 12px; flex-wrap: wrap; justify-content: center; } .hud-group { width: auto; }
  .hud-group.center { position: absolute; top: 57px; left: 16px; text-align: left; } .hud-group.center .hud-label { display: none; }
  .hud-group.right { margin-left: auto; } .boss-bar { top: 100px; } .footer .control:nth-child(n+3) { display: none; }
}
`;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game>(makeGame());
  const inputRef = useRef<Input>({ keys: new Set(), x: W / 2, y: H / 2 - 100, firing: false, dash: false, move: null, aimId: null });
  const [hud, setHud] = useState<Hud>(() => snapshot(gameRef.current));
  const [audioOn, setAudioOn] = useState(true);
  const audioOnRef = useRef(true);
  const play = useCallback((s: Sound) => tone(s, audioOnRef.current), []);
  const sync = useCallback(() => setHud(snapshot(gameRef.current)), []);
  const start = useCallback(() => {
    gameRef.current = makeGame(); gameRef.current.phase = "playing";
    const input = inputRef.current;
    input.keys.clear(); input.firing = false; input.dash = false; input.move = null; input.aimId = null;
    input.x = W / 2; input.y = H / 2 - 100;
    play("heal"); sync();
  }, [play, sync]);
  const pause = useCallback(() => {
    const g = gameRef.current;
    if (g.phase === "playing") { g.phase = "paused"; inputRef.current.firing = false; inputRef.current.keys.clear(); }
    else if (g.phase === "paused") g.phase = "playing";
    sync();
  }, [sync]);

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let frame = 0, previous = performance.now(), lastSync = 0;
    const tick = (timestamp: number) => {
      const dt = Math.min((timestamp - previous) / 1000, .035);
      previous = timestamp;
      const g = gameRef.current;
      if (g.phase === "playing") {
        update(g, inputRef.current, dt, play);
        if (timestamp - lastSync > 80 || g.phase !== "playing") { sync(); lastSync = timestamp; }
      }
      draw(ctx, g, inputRef.current, timestamp / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) e.preventDefault();
      if (key === "enter" && ["start", "won", "lost"].includes(gameRef.current.phase)) { start(); return; }
      if ((key === "p" || key === "escape") && ["playing", "paused"].includes(gameRef.current.phase)) { e.preventDefault(); pause(); return; }
      if (key === "r" && ["paused", "won", "lost"].includes(gameRef.current.phase)) { start(); return; }
      inputRef.current.keys.add(key);
      if (key === "shift" && !e.repeat) inputRef.current.dash = true;
    };
    const up = (e: KeyboardEvent) => inputRef.current.keys.delete(e.key.toLowerCase());
    const blur = () => {
      inputRef.current.keys.clear(); inputRef.current.firing = false; inputRef.current.move = null;
      if (gameRef.current.phase === "playing") { gameRef.current.phase = "paused"; sync(); }
    };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, [play, start, sync, pause]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width * W, y: (e.clientY - rect.top) / rect.height * H };
  };
  const pointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameRef.current.phase !== "playing") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e), input = inputRef.current;
    if (e.pointerType === "touch" && p.x < W * .48 && !input.move) input.move = { id: e.pointerId, x: p.x, y: p.y, dx: 0, dy: 0 };
    else { input.x = p.x; input.y = p.y; input.firing = true; if (e.pointerType === "touch") input.aimId = e.pointerId; }
  };
  const pointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = point(e), input = inputRef.current;
    if (input.move?.id === e.pointerId) {
      input.move.dx = clamp((p.x - input.move.x) / 50, -1, 1);
      input.move.dy = clamp((p.y - input.move.y) / 50, -1, 1);
    } else if (e.pointerType !== "touch" || input.aimId === e.pointerId) { input.x = p.x; input.y = p.y; }
  };
  const pointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const input = inputRef.current;
    if (input.move?.id === e.pointerId) input.move = null;
    else if (e.pointerType !== "touch" || input.aimId === e.pointerId) { input.firing = false; input.aimId = null; }
  };

  return <>
    <style>{styles}</style>
    <main className="page">
      <header className="site-header">
        <div className="brand"><span className="brand-mark" aria-hidden="true" />VOIDWARD</div>
        <div className="header-right"><span className="edition">AN ARCADE SURVIVAL GAME / 001</span>
          <button className="sound-button" onClick={() => { audioOnRef.current = !audioOnRef.current; setAudioOn(audioOnRef.current); }} aria-label={audioOn ? "Mute sound" : "Enable sound"}>
            <span className={`sound-indicator ${audioOn ? "" : "off"}`} /> SOUND {audioOn ? "ON" : "OFF"}
          </button>
        </div>
      </header>
      <section className="game-frame" aria-label="Voidward game arena">
        <canvas ref={canvasRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onContextMenu={e => e.preventDefault()} />
        <div className="scanlines" />
        {(hud.phase === "playing" || hud.phase === "paused") && <>
          <div className="hud">
            <div className="hud-group"><span className="hud-label">HULL INTEGRITY</span><div className="hearts" aria-label={`${hud.hp} of 5 health remaining`}>{Array.from({ length: 5 }, (_, i) => <span key={i} className={`heart ${i >= hud.hp ? "empty" : ""}`} />)}</div></div>
            <div className="hud-group center"><span className="hud-label">SCORE</span><div className="score">{String(hud.score).padStart(6, "0")}</div>{hud.combo > 1 && <div className="combo">{hud.combo}X COMBO</div>}</div>
            <div className="hud-group right"><div><span className="hud-label">{hud.wave === 4 ? "FINAL ENCOUNTER" : "SECTOR PROGRESS"}</span><div className="wave-value">{hud.wave === 4 ? "THE CORE" : <>0{hud.wave} <span>/ 03</span></>}</div>{hud.wave <= 3 && <div className="wave-track"><span className="wave-fill" style={{ width: `${hud.kills / GOALS[hud.wave - 1] * 100}%` }} /></div>}</div><button className="pause-button" onClick={pause} aria-label="Pause game">Ⅱ</button></div>
          </div>
          {hud.wave === 4 && <div className="boss-bar"><span className="hud-label">CORE STABILITY</span><div className="wave-track"><span className="wave-fill" style={{ width: `${hud.bossHp / 42 * 100}%` }} /></div></div>}
          <div className="bottom-hud"><div><div className="dash-label">DASH / SHIFT</div><div className="dash-track"><div className="dash-fill" style={{ width: `${(1 - hud.dash / 3) * 100}%` }} /></div><div className="dash-ready">{hud.dash <= 0 ? "READY" : `${hud.dash.toFixed(1)}S RECHARGING`}</div></div><div className="sector-note">SURVIVE THE SWARM. DESTROY THE CORE.</div></div>
          {hud.transition > 0 && <div className="wave-announcement">SECTOR CLEAR<small>{hud.wave === 3 ? "CORE SIGNAL DETECTED" : "PREPARE FOR NEXT SECTOR"}</small></div>}
          <button className="mobile-dash" onPointerDown={e => { e.stopPropagation(); inputRef.current.dash = true; }} aria-label="Dash">DASH</button>
        </>}
        {hud.phase === "start" && <div className="overlay start-overlay">
          <p className="eyebrow">THE LAST LIGHT IN THE DARK</p><h1 className="game-title">VOID<span>WARD</span></h1>
          <p className="hero-copy">One ship. Three hostile sectors. Break through the swarm and destroy the core.</p>
          <button className="primary-button" onClick={start}>INITIATE RUN <span aria-hidden="true">↗</span></button>
          <div className="start-controls"><strong>WASD</strong> MOVE &nbsp;·&nbsp; <strong>MOUSE</strong> AIM + FIRE &nbsp;·&nbsp; <strong>SHIFT</strong> DASH</div>
          <div className="touch-controls">TOUCH LEFT TO MOVE / TOUCH RIGHT TO AIM + FIRE</div>
        </div>}
        {hud.phase === "paused" && <div className="overlay">
          <p className="eyebrow">SYSTEMS ON STANDBY</p><h2 className="screen-title">PAUSED</h2><p className="screen-copy">Take a breath. The void can wait.</p>
          <div className="overlay-actions"><button className="primary-button" onClick={pause}>RESUME RUN <span>↗</span></button><button className="text-button" onClick={start}>RESTART RUN</button></div>
        </div>}
        {hud.phase === "lost" && <div className="overlay">
          <p className="eyebrow">SIGNAL LOST</p><h2 className="screen-title danger">SHIP DESTROYED</h2><p className="screen-copy">The void claimed this run. It does not get the next one.</p>
          <div className="result-score"><small>FINAL SCORE</small>{String(hud.score).padStart(6, "0")}</div>
          <button className="primary-button" onClick={start}>TRY AGAIN <span>↗</span></button>
        </div>}
        {hud.phase === "won" && <div className="overlay">
          <p className="eyebrow">MISSION COMPLETE</p><h2 className="screen-title victory">VOID CLEARED</h2><p className="screen-copy">The core is gone. The stars belong to you again.</p>
          <div className="result-score"><small>FINAL SCORE</small>{String(hud.score).padStart(6, "0")}</div>
          <button className="primary-button" onClick={start}>PLAY AGAIN <span>↗</span></button>
        </div>}
      </section>
      <footer className="footer">
        <div className="controls-list"><span className="control"><kbd>WASD</kbd> MOVE</span><span className="control"><kbd>CLICK / SPACE</kbd> FIRE</span><span className="control"><kbd>SHIFT</kbd> DASH</span><span className="control"><kbd>P / ESC</kbd> PAUSE</span></div>
        <span className="footer-note">NO SAVE POINTS. NO SECOND CHANCES.</span>
      </footer>
    </main>
  </>;
}