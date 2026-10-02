import {
  BOONS, COLS, CW, CH, DIFFS, ENEMIES, INST, INST_ORDER, LANES, LEVELS, LH, LW, MODS, OX, OY, PLACE_COLS,
  SCALE, STEPS, TUTORIAL, TUT_TEXT, TUT_TOTAL, defaultPattern, genWave, isBossWave, PRESETS,
} from './data';
import type { DiffDef, EnemyId, InstId, LevelDef, Pattern, Spawn, Step } from './data';
import { audio } from './audio';
import { persist } from './save';
import type { SaveData } from './save';

export type Mode = 'playing' | 'paused' | 'interlude' | 'ended';
export const MAX_LVL = 3;

export interface Auto {
  id: number; inst: InstId; col: number; lane: number; hp: number; maxHp: number; lvl: number;
  pattern: Pattern; pressure: number; maxP: number; silence: number; flash: number; fire: number;
  spent: number; res: number; cogAcc: number;
}
interface Enemy {
  id: number; type: EnemyId; lane: number; vlane: number; x: number; vx: number; hp: number; maxHp: number;
  slow: number; stun: number; age: number; atk: number; flash: number; hop: number; lunge: number;
  dead: boolean; phase: number; splits: number; seed: number; cast: number;
}
interface Proj {
  x: number; lane: number; speed: number; dmg: number; inst: InstId; pierce: number; splash: number;
  slow: number; knock: number; step: number; hit: Set<number>; color: string; dead: boolean; accent: boolean;
}
interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string;
  kind: 'spark' | 'note' | 'gear' | 'ring' | 'star'; rot: number; vr: number; g: number;
}
interface FText { x: number; y: number; text: string; color: string; life: number; max: number; size: number; vy: number }
interface Link { ax: number; ay: number; bx: number; by: number; life: number }

export interface SelView {
  id: number; inst: InstId; col: number; lane: number; lvl: number; hp: number; maxHp: number;
  pressure: number; maxP: number; pattern: Pattern; silence: number; upgradeCost: number; sellValue: number;
  noteCost: number; barCost: number;
}
export interface Snapshot {
  mode: Mode; cogs: number; harmony: number; maxHarmony: number; wave: number; waves: number; phase: 'countdown' | 'active';
  countdown: number; bpm: number; crescendo: number; combo: number; forte: number; step: number; armed: InstId | null;
  selected: SelView | null; boss: { name: string; hp: number; max: number } | null;
  tutorial: { step: number; total: number; text: string; progress: number } | null; levelName: string; levelId: number;
  tempoMult: number; costs: Record<string, number>; unlocked: InstId[]; boonChoices: string[] | null;
  enemiesLeft: number; diffName: string; bossWave: boolean; root: number; boons: Record<string, number>;
  diffId: string; mods: string[]; isTutorial: boolean; opusMult: number;
}
export interface RunStats {
  time: number; kills: number; notes: number; perfect: number; good: number; miss: number; maxCombo: number;
  chords: number; damage: number; wavesCleared: number; cogsEarned: number; autosLost: number; fizzles: number; deflects: number;
}
export interface RunResult {
  victory: boolean; tutorial: boolean; levelId: number; levelName: string; stars: number; opus: number;
  stats: RunStats; diffName: string; harmonyLeft: number; maxHarmony: number; firstClear: boolean;
}
export interface RunConfig { levelId: number; diff: string; mods: string[]; tutorial?: boolean }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const axw = (col: number) => OX + (col + 0.5) * CW;
const lyw = (lane: number) => OY + (lane + 0.5) * CH;

export class Game {
  private canvas: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  private save: SaveData;
  level: LevelDef;
  private diff: DiffDef;
  private mods: Set<string>;
  private tutorial: boolean;
  private onEnd: (r: RunResult) => void;
  private listener: ((s: Snapshot) => void) | null = null;

  mode: Mode = 'playing';
  private raf = 0;
  private last = 0;
  private destroyed = false;
  private vt = 0;
  private snapAcc = 0;
  private dpr = 1;
  private scale = 1;
  private offX = 0;
  private offY = 0;
  private pxW = 1;
  private pxH = 1;
  private ro: ResizeObserver | null = null;

  // sequencer
  private bpm: number;
  private stepAcc = 0;
  private stepNo = -1;
  private curStep = -1;
  private beatNo = 0;
  private pulse = 0;
  private lastConductBeat = 0;
  private lastJudgedBeat = -99;
  private judge: { text: string; color: string; t: number } | null = null;

  // resources
  private cogs: number;
  private harmony: number;
  private maxHarmony: number;
  private crescendo = 0;
  private combo = 0;
  private forteBeats = 0;
  private boons: Record<string, number> = {};
  private intensity = 0;

  // entities
  private autos: Auto[] = [];
  private grid: (Auto | null)[][] = [];
  private enemies: Enemy[] = [];
  private projs: Proj[] = [];
  private parts: Particle[] = [];
  private texts: FText[] = [];
  private links: Link[] = [];
  private nid = 1;

  // waves
  private waveNum = 0;
  private phase: 'countdown' | 'active' = 'countdown';
  private countdown = 14;
  private spawnList: Spawn[] = [];
  private spawnIdx = 0;
  private waveBeat = 0;
  private curBossWave = false;
  private boonChoices: string[] | null = null;
  private banner: { text: string; sub: string; t: number; color: string } | null = null;

  // ui state
  private armed: InstId | null = null;
  private selected: Auto | null = null;
  private hover: { col: number; lane: number } | null = null;
  private cursor = { col: 0, lane: 2 };
  private kbCursor = false;
  private tut = { step: 0, progress: 0 };

  // fx
  private shakeAmt = 0;
  private flashRed = 0;
  private slowT = 0;
  private gears: { x: number; y: number; r: number; n: number; s: number }[] = [];

  stats: RunStats = { time: 0, kills: 0, notes: 0, perfect: 0, good: 0, miss: 0, maxCombo: 0, chords: 0, damage: 0, wavesCleared: 0, cogsEarned: 0, autosLost: 0, fizzles: 0, deflects: 0 };

  constructor(canvas: HTMLCanvasElement, save: SaveData, cfg: RunConfig, onEnd: (r: RunResult) => void) {
    this.canvas = canvas;
    this.c = canvas.getContext('2d')!;
    this.save = save;
    this.tutorial = !!cfg.tutorial;
    this.level = cfg.tutorial ? TUTORIAL : LEVELS[clamp(cfg.levelId, 0, LEVELS.length - 1)];
    this.diff = DIFFS.find((d) => d.id === cfg.diff) ?? DIFFS[1];
    this.mods = new Set(this.tutorial ? [] : cfg.mods);
    this.onEnd = onEnd;
    this.bpm = this.level.bpm;
    this.maxHarmony = this.tutorial ? 25 : this.diff.harmony + 3 * this.u('hall');
    this.harmony = this.maxHarmony;
    this.cogs = Math.max(60, 200 + this.diff.cogs + 30 * this.u('mainspring')) + (this.tutorial ? 150 : 0);
    this.countdown = this.tutorial ? 8 : 14;
    for (let l = 0; l < LANES; l++) this.grid.push(new Array(COLS).fill(null));
    for (let i = 0; i < 10; i++) this.gears.push({ x: 60 + ((i * 197) % (LW - 100)), y: 40 + ((i * 131) % (LH - 60)), r: 40 + (i % 4) * 22, n: 8 + (i % 5) * 2, s: (i % 2 ? 1 : -1) * (0.15 + (i % 3) * 0.08) });
    this.bindInput();
    this.resize();
    audio.stopMenu();
    audio.startAmbient(this.level.root);
    this.banner = { text: this.level.name, sub: this.tutorial ? 'Follow the instructions' : 'Compose your defence', t: 3, color: '#f4d58d' };
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ----------------------------------------------------------- helpers
  private u(id: string) { return this.save.upg[id] || 0; }
  private boon(id: string) { return this.boons[id] || 0; }
  subscribe(cb: ((s: Snapshot) => void) | null) { this.listener = cb; if (cb) cb(this.snapshot()); }
  private emit() { if (this.listener) this.listener(this.snapshot()); }
  unlockedInsts(): InstId[] {
    if (this.tutorial) return ['timpani', 'violin', 'musicbox'];
    return INST_ORDER.filter((i) => ['timpani', 'violin', 'musicbox'].includes(i) || this.save.unlocked.includes(i));
  }
  private costOf(inst: InstId) { return Math.round(INST[inst].cost * Math.pow(0.85, this.boon('cheap'))); }
  private maxHpOf(inst: InstId, lvl: number) { return INST[inst].hp * (1 + 0.15 * this.u('casing')) * (1 + 0.25 * this.boon('iron')) * (1 + 0.3 * (lvl - 1)); }
  private maxPOf(lvl: number) { return 60 * (1 + 0.15 * this.u('tank')) * (1 + 0.2 * (lvl - 1)); }
  private regenRate() { return 10 * (1 + 0.12 * this.u('regen')) * (1 + 0.25 * this.boon('valve')) * (this.mods.has('staccato') ? 0.65 : 1); }
  private dmgMult() { return (1 + 0.08 * this.u('dmg')) * (1 + 0.15 * this.boon('vivace')); }
  private tempoMult() { return clamp(0.8 + ((this.bpm - 70) / 80) * 0.5, 0.8, 1.3); }
  private cogMult() { return (1 + 0.1 * this.u('scrap')) * (1 + 0.25 * this.boon('fortune')) * this.tempoMult(); }
  private hpMult() {
    return this.diff.hp * (this.mods.has('detuned') ? 1.3 : 1) * (1 + Math.max(0, this.waveNum - 1) * 0.07 + Math.max(0, this.level.id) * 0.1);
  }
  private upgradeCost(a: Auto) { return Math.round(INST[a.inst].cost * 0.9 * a.lvl); }
  private sellValue(a: Auto) { return Math.round(a.spent * (0.5 + 0.08 * this.u('scrap'))); }
  private noteMidi(inst: InstId, deg: number) { return INST[inst].midi + this.level.root + SCALE[((deg % 7) + 7) % 7]; }

  private addCogs(n: number) { this.cogs += n; if (n > 0) this.stats.cogsEarned += n; }

  // ----------------------------------------------------------- snapshot
  snapshot(): Snapshot {
    const boss = this.enemies.find((e) => ENEMIES[e.type].boss && !e.dead);
    const sel = this.selected;
    const costs: Record<string, number> = {};
    INST_ORDER.forEach((i) => { costs[i] = this.costOf(i); });
    return {
      mode: this.mode, cogs: Math.floor(this.cogs), harmony: this.harmony, maxHarmony: this.maxHarmony, wave: this.waveNum,
      waves: this.level.id === 5 ? 0 : this.level.waves, phase: this.phase, countdown: this.countdown, bpm: this.bpm,
      crescendo: this.crescendo, combo: this.combo, forte: this.forteBeats, step: this.curStep, armed: this.armed,
      selected: sel ? {
        id: sel.id, inst: sel.inst, col: sel.col, lane: sel.lane, lvl: sel.lvl, hp: sel.hp, maxHp: sel.maxHp, pressure: sel.pressure,
        maxP: sel.maxP, pattern: sel.pattern, silence: sel.silence, upgradeCost: sel.lvl >= MAX_LVL ? 0 : this.upgradeCost(sel),
        sellValue: this.sellValue(sel), noteCost: INST[sel.inst].pc,
        barCost: Math.round(sel.pattern.reduce((s, p) => s + (p ? INST[sel.inst].pc * (p.a ? 1.5 : 1) : 0), 0)),
      } : null,
      boss: boss ? { name: ENEMIES[boss.type].name, hp: Math.max(0, boss.hp), max: boss.maxHp } : null,
      tutorial: this.tutorial ? { step: this.tut.step, total: TUT_TOTAL, text: TUT_TEXT[Math.min(this.tut.step, TUT_TEXT.length - 1)], progress: this.tut.progress } : null,
      levelName: this.level.name, levelId: this.level.id, tempoMult: this.tempoMult(), costs, unlocked: this.unlockedInsts(),
      boonChoices: this.boonChoices, enemiesLeft: this.enemies.filter((e) => !e.dead).length + Math.max(0, this.spawnList.length - this.spawnIdx),
      diffName: this.diff.name, bossWave: this.curBossWave, root: this.level.root, boons: { ...this.boons },
      diffId: this.diff.id, mods: Array.from(this.mods), isTutorial: this.tutorial,
      opusMult: this.diff.opus * (1 + Array.from(this.mods).reduce((s, id) => s + (MODS.find((m) => m.id === id)?.bonus ?? 0), 0)),
    };
  }

  setDifficulty(id: string) {
    const d = DIFFS.find((x) => x.id === id);
    if (!d || this.tutorial) return;
    this.diff = d;
    this.save.settings.difficulty = id;
    persist(this.save);
    audio.sfx('click');
    this.emit();
  }
  toggleMod(id: string) {
    if (this.tutorial || !MODS.some((m) => m.id === id)) return;
    if (this.mods.has(id)) this.mods.delete(id); else this.mods.add(id);
    audio.sfx('click');
    this.emit();
  }

  // ----------------------------------------------------------- lifecycle
  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.unbindInput();
    this.ro?.disconnect();
    audio.stopAmbient();
    this.listener = null;
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    audio.stopAmbient();
    this.emit();
  }
  resume() {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    audio.startAmbient(this.level.root);
    this.last = performance.now();
    this.emit();
  }

  private frame = (ts: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.05);
    this.vt = ts / 1000;
    const raw = dt;
    if (this.slowT > 0) { this.slowT -= raw; dt *= 0.35; }
    if (this.mode === 'playing') this.update(dt);
    this.render();
    this.snapAcc += raw;
    if (this.snapAcc > 0.06) { this.snapAcc = 0; this.emit(); }
  };

  // ----------------------------------------------------------- update
  private update(dt: number) {
    this.stats.time += dt;
    const sd = 60 / this.bpm / 4;
    this.stepAcc += dt / sd;
    let guard = 0;
    while (this.stepAcc >= 1 && guard++ < 6) {
      this.stepAcc -= 1;
      this.stepNo++;
      this.onStep(this.stepNo);
      if (this.mode !== 'playing') return;
    }
    if (this.stepAcc >= 1) this.stepAcc = 0;

    this.addCogs(dt * 0.5);
    const regen = this.regenRate();
    for (const a of this.autos) {
      a.pressure = Math.min(a.maxP, a.pressure + regen * dt);
      a.fire = Math.max(0, a.fire - dt * 5);
      a.flash = Math.max(0, a.flash - dt * 4);
    }
    // enemies visuals
    for (const e of this.enemies) {
      e.vx += (e.x - e.vx) * Math.min(1, dt * 9);
      e.vlane += (e.lane - e.vlane) * Math.min(1, dt * 8);
      e.flash = Math.max(0, e.flash - dt * 5);
      e.hop = Math.max(0, e.hop - dt * 3.2);
      e.lunge = Math.max(0, e.lunge - dt * 4);
      e.cast = Math.max(0, e.cast - dt * 2);
    }
    this.updateProjectiles(dt);
    this.enemies = this.enemies.filter((e) => !e.dead);

    // wave completion
    if (this.phase === 'active' && this.spawnIdx >= this.spawnList.length && this.enemies.length === 0) this.waveClear();

    this.pulse = Math.max(0, this.pulse - dt * 3.5);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
    this.flashRed = Math.max(0, this.flashRed - dt * 1.6);
    if (this.judge) { this.judge.t -= dt; if (this.judge.t <= 0) this.judge = null; }
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    const target = Math.min(1, this.enemies.length / 10 + (this.forteBeats > 0 ? 0.3 : 0) + (this.enemies.some((e) => ENEMIES[e.type].boss) ? 0.35 : 0));
    this.intensity += (target - this.intensity) * Math.min(1, dt * 0.6);
    this.updateFx(dt);
  }

  private updateFx(dt: number) {
    for (const p of this.parts) {
      p.life -= dt;
      if (p.kind === 'ring') {
        p.size += p.vx * dt;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      p.rot += p.vr * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y += t.vy * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const l of this.links) l.life -= dt;
    this.links = this.links.filter((l) => l.life > 0);
  }

  private spark(x: number, y: number, color: string, n: number, speed = 160, kind: Particle['kind'] = 'spark', g = 200) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 520) return;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.8);
      const life = 0.35 + Math.random() * 0.5;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (kind === 'note' ? 60 : 0), life, max: life, size: 2 + Math.random() * 3, color, kind, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, g: kind === 'note' ? -30 : g });
    }
  }
  private ring(x: number, y: number, color: string, grow = 260, size = 8, life = 0.5) {
    if (this.parts.length > 540) return;
    this.parts.push({ x, y, vx: grow, vy: 0, life, max: life, size, color, kind: 'ring', rot: 0, vr: 0, g: 0 });
  }
  private ftext(x: number, y: number, text: string, color: string, size = 18, life = 0.9) {
    if (this.texts.length > 70) this.texts.shift();
    this.texts.push({ x, y, text, color, life, max: life, size, vy: -42 });
  }
  private shake(n: number) { this.shakeAmt = Math.max(this.shakeAmt, n * (this.save.settings.shake ?? 1)); }

  // ----------------------------------------------------------- sequencer
  private onStep(n: number) {
    const s = ((n % STEPS) + STEPS) % STEPS;
    this.curStep = s;
    if (s % 4 === 0) this.onBeat();

    const fired: { a: Auto; st: Step; chord: number }[] = [];
    for (const a of this.autos) {
      const st = a.pattern[s];
      if (!st) continue;
      if (a.silence > 0) { a.flash = 0.6; continue; }
      const cost = INST[a.inst].pc * (st.a ? 1.5 : 1);
      if (a.pressure < cost) {
        this.stats.fizzles++;
        this.ftext(axw(a.col), lyw(a.lane) - 30, '…fizzle', '#8aa0b8', 13, 0.6);
        audio.sfx('fizzle');
        continue;
      }
      a.pressure -= cost;
      fired.push({ a, st, chord: 1 });
    }
    // chords
    const nF = fired.length;
    if (nF > 1) {
      const k = 0.2 * (1 + 0.5 * this.boon('chords'));
      let best = 1;
      let bestI = -1;
      let anyChord = false;
      let linkN = 0;
      for (let i = 0; i < nF; i++) {
        let cons = 0;
        let diss = 0;
        for (let j = 0; j < nF; j++) {
          if (i === j) continue;
          const diff = (((fired[i].st.d - fired[j].st.d) % 7) + 7) % 7;
          if (diff === 1 || diff === 6) diss++;
          else {
            cons++;
            if (j > i && linkN < 14) {
              linkN++;
              this.links.push({ ax: axw(fired[i].a.col), ay: lyw(fired[i].a.lane), bx: axw(fired[j].a.col), by: lyw(fired[j].a.lane), life: 0.3 });
            }
          }
        }
        fired[i].chord = clamp(1 + k * cons - 0.12 * diss, 0.6, 2.4);
        if (cons > 0) anyChord = true;
        if (fired[i].chord > best) { best = fired[i].chord; bestI = i; }
      }
      if (anyChord) this.stats.chords++;
      if (bestI >= 0 && best >= 1.3) this.ftext(axw(fired[bestI].a.col), lyw(fired[bestI].a.lane) - 44, `♫ CHORD ×${best.toFixed(1)}`, '#ffe08a', 15, 0.8);
    }
    for (const f of fired) this.fire(f.a, f.st, f.chord, s);
    for (const a of this.autos) if (a.res > 0) a.res--;

    audio.musicStep(s, this.intensity, this.level.root);
    if (this.mode === 'playing') this.cleanupAutos();
  }

  private cleanupAutos() {
    if (this.autos.some((a) => a.hp <= 0)) {
      this.autos = this.autos.filter((a) => a.hp > 0);
    }
  }

  private onBeat() {
    this.beatNo++;
    this.pulse = 1;
    if (this.save.settings.tick) audio.sfx('tick');
    for (const a of this.autos) if (a.silence > 0) a.silence--;
    if (this.forteBeats > 0) {
      this.forteBeats--;
      if (this.forteBeats === 0) this.ftext(OX + 300, OY + 30, 'Fortissimo fades', '#f4d58d', 16);
    }
    this.crescendo = Math.max(0, this.crescendo - 1.2);
    if (this.combo > 0 && this.beatNo - this.lastConductBeat > 8) {
      this.combo = 0;
      this.ftext(50, OY + 40, 'combo lost', '#e4506c', 13);
    }
    // waves
    if (this.phase === 'countdown') {
      if (this.tutorial && this.tut.step < 3) {
        this.countdown = Math.max(this.countdown, 4);
      } else {
        this.countdown--;
        if (this.countdown <= 0) this.startWave();
      }
    } else {
      this.waveBeat++;
      while (this.spawnIdx < this.spawnList.length && this.spawnList[this.spawnIdx].beat <= this.waveBeat) {
        const sp = this.spawnList[this.spawnIdx++];
        this.spawnEnemy(sp.type, sp.lane);
      }
    }
    for (const e of this.enemies.slice()) if (!e.dead) this.enemyBeat(e);
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private startWave() {
    this.waveNum++;
    this.phase = 'active';
    this.waveBeat = 0;
    this.spawnIdx = 0;
    this.curBossWave = isBossWave(this.level, this.waveNum);
    this.spawnList = genWave(this.level, this.waveNum, this.tutorial ? 0.6 : this.diff.count, this.mods.has('swarm'));
    audio.sfx('wave');
    this.banner = {
      text: this.curBossWave ? 'BOSS WAVE' : `WAVE ${this.waveNum}${this.level.id === 5 ? '' : ' / ' + this.level.waves}`,
      sub: this.curBossWave ? 'Brace the orchestra' : 'Discord approaches', t: 2.2, color: this.curBossWave ? '#ff6b81' : '#f4d58d',
    };
  }

  callWave() {
    if (this.mode !== 'playing' || this.phase !== 'countdown') return;
    if (this.tutorial && this.tut.step < 3) return;
    const bonus = Math.ceil(this.countdown * 1.5);
    this.addCogs(bonus);
    this.ftext(OX + 100, OY + 20, `+${bonus} early bonus`, '#ffd166', 16);
    this.countdown = 0;
    this.startWave();
  }

  private waveClear() {
    this.stats.wavesCleared++;
    const bonus = 15 + this.waveNum * 5;
    this.addCogs(bonus);
    this.ftext(OX + 450, OY + 200, `Wave cleared  +${bonus} cogs`, '#9be7b5', 22, 1.6);
    audio.sfx('ready');
    if (this.level.id !== 5 && this.waveNum >= this.level.waves) {
      this.end(true);
      return;
    }
    this.phase = 'countdown';
    this.curBossWave = false;
    this.countdown = this.tutorial ? 6 : 12;
    const every = this.level.id === 5 ? 3 : 2;
    if (!this.tutorial && this.waveNum % every === 0) {
      const pool = BOONS.map((b) => b.id);
      const picks: string[] = [];
      while (picks.length < 3) {
        const p = pool[Math.floor(Math.random() * pool.length)];
        if (!picks.includes(p)) picks.push(p);
      }
      this.boonChoices = picks;
      this.mode = 'interlude';
      audio.sfx('boon');
      this.emit();
    }
  }

  pickBoon(id: string) {
    if (this.mode !== 'interlude' || !this.boonChoices || !this.boonChoices.includes(id)) return;
    this.boons[id] = (this.boons[id] || 0) + 1;
    if (id === 'stock') this.addCogs(150);
    if (id === 'mend') {
      this.harmony = Math.min(this.maxHarmony, this.harmony + 5);
      this.autos.forEach((a) => { a.hp = a.maxHp; });
    }
    if (id === 'iron') this.autos.forEach((a) => { const m = this.maxHpOf(a.inst, a.lvl); a.hp += m - a.maxHp; a.maxHp = m; });
    this.boonChoices = null;
    this.mode = 'playing';
    this.last = performance.now();
    audio.sfx('click');
    this.emit();
  }

  // ----------------------------------------------------------- enemies
  private spawnEnemy(type: EnemyId, lane: number, x = COLS + 0.3) {
    const def = ENEMIES[type];
    const hp = def.hp * this.hpMult();
    const e: Enemy = {
      id: this.nid++, type, lane, vlane: lane, x, vx: x, hp, maxHp: hp, slow: 0, stun: 0, age: 0, atk: 0, flash: 0, hop: 0,
      lunge: 0, dead: false, phase: 0, splits: 0, seed: Math.random() * 100, cast: 0,
    };
    this.enemies.push(e);
    if (def.boss) {
      audio.sfx('boss');
      this.shake(14);
      this.banner = { text: def.name.toUpperCase(), sub: def.desc, t: 3.5, color: def.color };
    }
    return e;
  }

  private blockerFor(e: Enemy): Auto | null {
    let best: Auto | null = null;
    for (const a of this.autos) {
      if (a.lane !== e.lane || a.hp <= 0) continue;
      if (a.col <= e.x + 0.2 && (!best || a.col > best.col)) best = a;
    }
    return best;
  }

  private enemyBeat(e: Enemy) {
    const def = ENEMIES[e.type];
    if (e.stun > 0) { e.stun--; return; }
    e.age++;
    if (def.boss) this.bossBeat(e);
    let dist = def.speed * this.diff.speed;
    if (e.type === 'cacophony' && e.phase === 2) dist *= 1.8;
    if (e.slow > 0) { e.slow--; dist *= 0.5; }
    const blk = this.blockerFor(e);
    if (e.type === 'mute') {
      const tgt = blk && e.x - blk.col <= 4.2 ? blk : null;
      if (tgt) {
        if (e.age % 4 === 0) {
          tgt.silence = Math.max(tgt.silence, 3);
          e.cast = 1;
          this.ring(axw(tgt.col), lyw(tgt.lane), '#7f93b2', 120, 6, 0.5);
          this.ftext(axw(tgt.col), lyw(tgt.lane) - 30, 'HUSH', '#9fb3d1', 15, 0.8);
          audio.sfx('mute');
        }
        return;
      }
    } else if (blk && e.x - blk.col <= 0.88) {
      e.atk++;
      if (e.atk % 2 === 0) {
        e.lunge = 1;
        this.damageAuto(blk, def.dmg * (this.mods.has('brittle') ? 2 : 1));
      }
      return;
    }
    e.hop = 1;
    const nx = e.x - dist;
    e.x = blk ? Math.min(e.x, Math.max(nx, blk.col + 0.85)) : nx;
    if (e.x <= -0.5) this.breach(e);
  }

  private bossBeat(e: Enemy) {
    const a = e.age;
    const rndAutos = (n: number) => {
      const pool = this.autos.filter((x) => x.hp > 0).sort(() => Math.random() - 0.5);
      return pool.slice(0, n);
    };
    const hopLane = () => {
      let l = Math.floor(Math.random() * LANES);
      if (l === e.lane) l = (l + 1 + Math.floor(Math.random() * (LANES - 1))) % LANES;
      e.lane = l;
      e.cast = 1;
      this.ftext(axw(e.x), lyw(l) - 60, 'JUMP', '#fff', 16);
    };
    switch (e.type) {
      case 'howler':
        if (a % 6 === 0) {
          const t = rndAutos(2);
          if (t.length) { e.cast = 1; this.shake(8); audio.sfx('mute'); }
          t.forEach((x) => { x.silence = Math.max(x.silence, 4); this.ring(axw(x.col), lyw(x.lane), '#ff4d6d', 140, 6, 0.5); this.ftext(axw(x.col), lyw(x.lane) - 30, 'FEEDBACK!', '#ff6b81', 15); });
        }
        break;
      case 'colossus':
        if (a % 8 === 0) {
          e.cast = 1;
          this.spawnEnemy('drone', e.lane, e.x + 0.2);
          this.spawnEnemy('drone', clamp(e.lane + (Math.random() < 0.5 ? -1 : 1), 0, LANES - 1), e.x + 0.4);
          this.ftext(axw(e.x), lyw(e.lane) - 70, 'SUMMON', '#b79bff', 16);
        }
        break;
      case 'tyrant':
        if (a % 8 === 0) hopLane();
        break;
      case 'choir':
        if (a % 6 === 0) hopLane();
        break;
      case 'cacophony':
        if (e.phase === 0 && a % 8 === 0) {
          const t = rndAutos(1)[0];
          if (t) {
            const sh = 1 + Math.floor(Math.random() * 15);
            const np: Pattern = new Array(STEPS).fill(null);
            t.pattern.forEach((p, i) => { if (p) np[(i + sh) % STEPS] = p; });
            t.pattern = np;
            t.silence = Math.max(t.silence, 2);
            this.ftext(axw(t.col), lyw(t.lane) - 30, 'SCRAMBLED!', '#ff2e63', 16);
            this.ring(axw(t.col), lyw(t.lane), '#ff2e63', 150, 6, 0.5);
            e.cast = 1;
            audio.sfx('mute');
          }
        } else if (e.phase === 1 && a % 6 === 0) {
          e.cast = 1;
          const types: EnemyId[] = ['screecher', 'echo', 'drone'];
          for (let i = 0; i < 2; i++) this.spawnEnemy(types[Math.floor(Math.random() * 3)], Math.floor(Math.random() * LANES), e.x + 0.3 + i * 0.3);
          this.ftext(axw(e.x), lyw(e.lane) - 80, 'SUMMON', '#ff7a95', 16);
        } else if (e.phase === 2) {
          if (a % 4 === 0) rndAutos(2).forEach((x) => { x.silence = Math.max(x.silence, 3); this.ring(axw(x.col), lyw(x.lane), '#ff2e63', 140, 6, 0.4); });
          if (a % 8 === 0) hopLane();
        }
        break;
      default:
        break;
    }
  }

  private breach(e: Enemy) {
    const def = ENEMIES[e.type];
    e.dead = true;
    this.harmony = Math.max(0, this.harmony - def.leak);
    this.flashRed = 1;
    this.shake(14 + def.leak);
    audio.sfx('breach');
    this.ftext(60, lyw(e.lane), `-${def.leak} Harmony`, '#ff5a6e', 22, 1.2);
    this.spark(OX - 10, lyw(e.lane), '#ff5a6e', 24, 260);
    this.combo = 0;
    if (this.harmony <= 0) this.end(false);
  }

  private damageAuto(a: Auto, d: number) {
    a.hp -= d;
    a.flash = 1;
    this.shake(2);
    audio.sfx('autoHit');
    this.spark(axw(a.col), lyw(a.lane), '#ff9f43', 5, 120);
    this.ftext(axw(a.col), lyw(a.lane) - 20, `-${Math.round(d)}`, '#ff9f43', 14, 0.6);
    if (a.hp <= 0) {
      this.stats.autosLost++;
      this.grid[a.lane][a.col] = null;
      this.spark(axw(a.col), lyw(a.lane), '#d4a24c', 22, 220, 'gear');
      this.ftext(axw(a.col), lyw(a.lane) - 30, 'DESTROYED', '#ff5a6e', 16);
      audio.sfx('autoDie');
      this.shake(6);
      if (this.selected === a) this.selected = null;
      this.autos = this.autos.filter((x) => x !== a);
    }
  }

  private hitEnemy(e: Enemy, dmgIn: number, o: { step?: number; slow?: number; stun?: number; knock?: number } = {}) {
    if (e.dead) return;
    const def = ENEMIES[e.type];
    const ex = axw(e.vx);
    const ey = lyw(e.vlane);
    if (o.step !== undefined) {
      const down = o.step % 4 === 0;
      const needDown = e.type === 'metronome' || e.type === 'tyrant' || (e.type === 'cacophony' && e.phase === 1);
      if ((e.type === 'syncopator' && down) || (needDown && !down)) {
        this.stats.deflects++;
        e.flash = 0.3;
        this.ftext(ex, ey - def.r - 6, 'DEFLECT', '#9ad8ff', 13, 0.6);
        this.spark(ex, ey, '#9ad8ff', 4, 140);
        audio.sfx('deflect');
        return;
      }
    }
    const dmg = Math.max(dmgIn * 0.25, dmgIn - def.armor);
    e.hp -= dmg;
    e.flash = 1;
    this.stats.damage += dmg;
    if (o.slow) e.slow = Math.max(e.slow, o.slow);
    if (o.stun) e.stun = Math.max(e.stun, o.stun);
    if (o.knock && !def.boss) e.x = Math.min(COLS + 0.3, e.x + o.knock);
    this.ftext(ex + (Math.random() - 0.5) * 16, ey - def.r - 4, `${Math.max(1, Math.round(dmg))}`, dmg > 30 ? '#ffd166' : '#fff', dmg > 30 ? 20 : 14, 0.6);
    this.spark(ex, ey, def.color, 4, 150);
    audio.sfx('hit');
    if (def.boss) {
      const f = e.hp / e.maxHp;
      if (e.type === 'choir') {
        const th = e.splits === 0 ? 0.66 : e.splits === 1 ? 0.33 : -1;
        if (th > 0 && f < th) {
          e.splits++;
          this.spawnEnemy('echo', clamp(e.lane - 1, 0, LANES - 1), e.x + 0.3);
          this.spawnEnemy('echo', clamp(e.lane + 1, 0, LANES - 1), e.x + 0.3);
          this.ftext(ex, ey - 90, 'SHATTER!', '#35e0a1', 20, 1.2);
          this.shake(12);
        }
      }
      if (e.type === 'cacophony') {
        const np = f > 0.66 ? 0 : f > 0.33 ? 1 : 2;
        if (np > e.phase) {
          e.phase = np;
          this.banner = { text: `PHASE ${np === 1 ? 'II' : 'III'}`, sub: np === 1 ? 'Only downbeats wound it. It summons!' : 'ENRAGED', t: 2.5, color: '#ff2e63' };
          this.shake(20);
          audio.sfx('boss');
          this.ring(ex, ey, '#ff2e63', 500, 20, 0.9);
        }
      }
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    const def = ENEMIES[e.type];
    const ex = axw(e.vx);
    const ey = lyw(e.vlane);
    const reward = Math.round(def.reward * this.cogMult());
    this.addCogs(reward);
    this.stats.kills++;
    this.ftext(ex, ey - 10, `+${reward}`, '#ffd166', def.boss ? 24 : 15, 1);
    this.spark(ex, ey, def.color, def.boss ? 70 : 16, def.boss ? 380 : 220);
    this.spark(ex, ey, '#d4a24c', def.boss ? 24 : 4, 200, 'gear');
    this.ring(ex, ey, def.color, 300, 8, 0.45);
    audio.sfx(def.boss ? 'bossDie' : 'kill');
    if (def.boss) { this.shake(30); this.slowT = 0.7; this.flashRed = 0; }
    else this.shake(2);
    if (e.type === 'echo') {
      this.spawnEnemy('drone', e.lane, e.x + 0.15);
      this.spawnEnemy('drone', e.lane, e.x - 0.15);
    }
    this.crescendo = Math.min(100, this.crescendo + (def.boss ? 15 : 0.8));
  }

  // ----------------------------------------------------------- firing
  private fire(a: Auto, st: Step, chord: number, step: number) {
    const def = INST[a.inst];
    const px = axw(a.col);
    const py = lyw(a.lane);
    a.fire = 1;
    this.stats.notes++;
    audio.playInst(a.inst, this.noteMidi(a.inst, st.d), st.a);
    this.spark(px + 10, py - 20, def.color, 2, 60, 'note');
    const lvlMult = 1 + 0.45 * (a.lvl - 1);
    const base = def.dmg * lvlMult * (st.a ? 1.8 : 1) * chord * this.dmgMult() * (1 + 0.01 * Math.min(this.combo, 30)) * (this.forteBeats > 0 ? 2 : 1) * (a.res > 0 ? 1.25 : 1);
    switch (a.inst) {
      case 'timpani': {
        const x0 = a.col + 0.4;
        const x1 = a.col + 3.8;
        for (const e of this.enemies) {
          if (e.dead || e.vx < x0 || e.vx > x1) continue;
          const dl = Math.abs(e.lane - a.lane);
          if (dl === 0) this.hitEnemy(e, base, { step, knock: st.a ? 0.35 : 0.08 });
          else if (dl === 1 && e.vx < x1 - 1) this.hitEnemy(e, base * 0.4, { step });
        }
        this.ring(px + 20, py, def.color, 340, 10, 0.4);
        this.shake(1.5);
        break;
      }
      case 'violin':
        this.proj(a, st, 16, base, st.a ? 3 : 2, 0, 0, 0, step);
        break;
      case 'horn':
        this.proj(a, st, 9, base, 1, 1.1, 0, 0, step);
        this.shake(2);
        break;
      case 'flute':
        this.proj(a, st, 12, base, 3, 0, st.a ? 5 : 3, 0.25, step);
        break;
      case 'cymbal': {
        const x0 = a.col + 0.4;
        const x1 = a.col + 2.9;
        for (const e of this.enemies) {
          if (e.dead || e.vx < x0 || e.vx > x1 || Math.abs(e.lane - a.lane) > 1) continue;
          this.hitEnemy(e, base, { step, stun: st.a ? 2 : 1 });
        }
        this.ring(px + 20, py, '#fff0a8', 300, 10, 0.4);
        this.ring(px + 20, py - CH, '#fff0a8', 200, 6, 0.3);
        this.ring(px + 20, py + CH, '#fff0a8', 200, 6, 0.3);
        this.shake(2);
        break;
      }
      case 'harp': {
        for (const o of this.autos) {
          if (o === a || o.hp <= 0 || Math.abs(o.col - a.col) > 1 || Math.abs(o.lane - a.lane) > 1) continue;
          const heal = (st.a ? 9 : 5) * chord * lvlMult;
          o.hp = Math.min(o.maxHp, o.hp + heal);
          o.pressure = Math.min(o.maxP, o.pressure + (st.a ? 11 : 6) * chord);
          o.res = 2;
          this.spark(axw(o.col), lyw(o.lane) - 10, '#c79bff', 3, 70, 'star', -40);
        }
        this.ring(px, py, '#c79bff', 160, 8, 0.5);
        break;
      }
      case 'musicbox': {
        a.cogAcc += (st.a ? 0.9 : 0.45) * chord * (1 + 0.25 * this.boon('fortune')) * (1 + 0.1 * this.u('scrap')) * lvlMult;
        if (a.cogAcc >= 1) {
          const n = Math.floor(a.cogAcc);
          a.cogAcc -= n;
          this.addCogs(n);
          this.ftext(px, py - 36, `+${n}`, '#ffd166', 15, 0.8);
          this.spark(px, py - 20, '#ffd166', 3, 80, 'gear');
        }
        break;
      }
    }
  }

  private proj(a: Auto, st: Step, speed: number, dmg: number, pierce: number, splash: number, slow: number, knock: number, step: number) {
    this.projs.push({ x: a.col + 0.7, lane: a.lane, speed, dmg, inst: a.inst, pierce, splash, slow, knock, step, hit: new Set(), color: INST[a.inst].color, dead: false, accent: st.a });
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projs) {
      p.x += p.speed * dt;
      if (Math.random() < 0.5) this.parts.push({ x: axw(p.x), y: lyw(p.lane), vx: -30, vy: (Math.random() - 0.5) * 30, life: 0.25, max: 0.25, size: 2, color: p.color, kind: 'spark', rot: 0, vr: 0, g: 0 });
      for (const e of this.enemies) {
        if (e.dead || p.dead || e.lane !== p.lane || p.hit.has(e.id)) continue;
        if (Math.abs(e.vx - p.x) > 0.5) continue;
        p.hit.add(e.id);
        this.hitEnemy(e, p.dmg, { step: p.step, slow: p.slow, knock: p.knock });
        if (p.splash > 0) {
          for (const o of this.enemies) {
            if (o === e || o.dead || Math.abs(o.lane - p.lane) > 1 || Math.abs(o.vx - p.x) > p.splash) continue;
            this.hitEnemy(o, p.dmg * (o.lane === p.lane ? 0.6 : 0.4) * (p.accent ? 1.2 : 1), { step: p.step });
          }
          this.ring(axw(p.x), lyw(p.lane), p.color, 260, 10, 0.4);
          this.spark(axw(p.x), lyw(p.lane), p.color, 12, 240);
        }
        p.pierce--;
        if (p.pierce <= 0) p.dead = true;
      }
      if (p.x > COLS + 1.2) p.dead = true;
    }
    this.projs = this.projs.filter((p) => !p.dead);
  }

  // ----------------------------------------------------------- player actions
  conduct() {
    if (this.mode !== 'playing') return;
    audio.ensure();
    const bd = 60 / this.bpm;
    const into = ((((this.stepNo % 4) + 4) % 4) + this.stepAcc) / 4; // 0..1 since last beat
    const off = (this.save.settings.offset || 0) / 1000 / bd;
    const ph = (((into - off) % 1) + 1) % 1;
    const nearestBeat = this.beatNo + (ph > 0.5 ? 1 : 0);
    const dsec = Math.min(ph, 1 - ph) * bd;
    const fright = this.mods.has('fright') ? 0.6 : 1;
    const perfect = (0.06 + 0.012 * this.u('calib')) * fright;
    const good = (0.13 + 0.012 * this.u('calib')) * fright;
    if (nearestBeat === this.lastJudgedBeat && dsec <= good) return; // already conducted this beat
    const gain = 1 + 0.15 * this.u('cresc') + 0.3 * this.boon('pitch');
    if (dsec <= good) {
      this.lastJudgedBeat = nearestBeat;
      this.lastConductBeat = this.beatNo;
      const isP = dsec <= perfect;
      this.combo++;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
      this.crescendo = Math.min(100, this.crescendo + (isP ? 9 : 4.5) * gain);
      const refill = (isP ? 6 : 3) * (1 + 0.5 * this.boon('pitch'));
      this.autos.forEach((a) => { a.pressure = Math.min(a.maxP, a.pressure + refill); });
      if (isP) this.stats.perfect++; else this.stats.good++;
      this.judge = { text: isP ? 'PERFECT' : 'GOOD', color: isP ? '#ffd166' : '#7fd6c2', t: 0.5 };
      this.ftext(50, OY + 70, this.judge.text + (this.combo > 2 ? ` ×${this.combo}` : ''), this.judge.color, 15, 0.7);
      this.ring(50, 38, this.judge.color, 160, 10, 0.4);
      audio.sfx(isP ? 'perfect' : 'good');
      if (this.crescendo >= 100 && this.forteBeats === 0) { this.ftext(OX + 20, OY + 10, 'FORTISSIMO READY — press F', '#ffd166', 18, 1.5); audio.sfx('ready'); }
      if (this.tutorial && this.tut.step === 2) {
        this.tut.progress++;
        if (this.tut.progress >= 4) { this.tut.step = 3; this.tut.progress = 0; }
      }
    } else {
      this.combo = 0;
      this.crescendo = Math.max(0, this.crescendo - 10);
      this.stats.miss++;
      this.judge = { text: 'OFF BEAT', color: '#e4506c', t: 0.5 };
      this.ftext(50, OY + 70, 'off beat', '#e4506c', 14, 0.6);
      audio.sfx('miss');
    }
  }

  forte() {
    if (this.mode !== 'playing') return;
    if (this.crescendo < 100 || this.forteBeats > 0) { audio.sfx('deny'); return; }
    this.crescendo = 0;
    this.forteBeats = 8;
    this.autos.forEach((a) => { a.pressure = a.maxP; a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.2); a.silence = 0; });
    this.ring(OX + 500, OY + 240, '#ffd166', 900, 20, 0.8);
    this.shake(12);
    audio.sfx('forte');
    this.banner = { text: 'FORTISSIMO!', sub: 'Double damage · steam refilled', t: 2, color: '#ffd166' };
  }

  setBpm(v: number) {
    this.bpm = clamp(Math.round(v), 70, 150);
    this.emit();
  }

  armInstrument(id: InstId | null) {
    if (id && !this.unlockedInsts().includes(id)) return;
    this.armed = this.armed === id ? null : id;
    audio.sfx('click');
    this.emit();
  }

  selectAuto(a: Auto | null) {
    this.selected = a;
    this.emit();
  }

  place(col: number, lane: number, inst: InstId): boolean {
    if (this.mode !== 'playing') return false;
    if (col < 0 || lane < 0 || lane >= LANES || col >= COLS) return false;
    if (col >= PLACE_COLS) {
      this.ftext(axw(col), lyw(lane), 'Too close to the foe', '#ff9f43', 14, 0.8);
      audio.sfx('deny');
      return false;
    }
    if (this.grid[lane][col]) return false;
    const cost = this.costOf(inst);
    if (this.cogs < cost) {
      this.ftext(axw(col), lyw(lane), 'Need cogs!', '#ff5a6e', 15, 0.8);
      audio.sfx('deny');
      return false;
    }
    this.cogs -= cost;
    const maxHp = this.maxHpOf(inst, 1);
    const empty = this.tutorial && this.tut.step === 0;
    const a: Auto = {
      id: this.nid++, inst, col, lane, hp: maxHp, maxHp, lvl: 1, pattern: empty ? new Array(STEPS).fill(null) : defaultPattern(inst),
      pressure: this.maxPOf(1), maxP: this.maxPOf(1), silence: 0, flash: 0, fire: 0, spent: cost, res: 0, cogAcc: 0,
    };
    this.autos.push(a);
    this.grid[lane][col] = a;
    this.selected = a;
    audio.sfx('place');
    this.spark(axw(col), lyw(lane), INST[inst].color, 14, 160, 'gear');
    this.ring(axw(col), lyw(lane), INST[inst].color, 200, 8, 0.4);
    if (this.tutorial && this.tut.step === 0) this.tut.step = 1;
    this.emit();
    return true;
  }

  private notesCount(p: Pattern) { return p.reduce((n, x) => n + (x ? 1 : 0), 0); }
  private touchPattern(a: Auto, np: Pattern) {
    a.pattern = np;
    if (this.tutorial && this.tut.step === 1 && this.notesCount(np) >= 3) { this.tut.step = 2; this.tut.progress = 0; }
    this.emit();
  }

  setNote(step: number, deg: number, accentClick: boolean) {
    const a = this.selected;
    if (!a || step < 0 || step >= STEPS) return;
    const np = a.pattern.slice();
    const cur = np[step];
    if (accentClick) {
      if (cur && cur.d === deg) np[step] = { d: cur.d, a: !cur.a };
      else np[step] = { d: deg, a: true };
    } else if (cur && cur.d === deg) np[step] = null;
    else np[step] = { d: deg, a: cur ? cur.a : false };
    if (np[step]) audio.playInst(a.inst, this.noteMidi(a.inst, deg), !!np[step]!.a, 0.8);
    this.touchPattern(a, np);
  }
  clearPattern() { if (this.selected) { audio.sfx('click'); this.touchPattern(this.selected, new Array(STEPS).fill(null)); } }
  applyPreset(i: number) {
    const a = this.selected;
    if (!a || !PRESETS[i]) return;
    const firstD = a.pattern.find(Boolean)?.d ?? INST[a.inst].defDeg;
    audio.sfx('click');
    this.touchPattern(a, PRESETS[i].make(firstD));
  }
  shiftPattern(dir: number) {
    const a = this.selected;
    if (!a) return;
    const np: Pattern = new Array(STEPS).fill(null);
    a.pattern.forEach((p, i) => { if (p) np[(i + dir + STEPS) % STEPS] = p; });
    audio.sfx('click');
    this.touchPattern(a, np);
  }
  transpose(dir: number) {
    const a = this.selected;
    if (!a) return;
    const np = a.pattern.map((p) => (p ? { d: (p.d + dir + 7) % 7, a: p.a } : null));
    const f = np.find(Boolean);
    if (f) audio.playInst(a.inst, this.noteMidi(a.inst, f.d), false, 0.8);
    this.touchPattern(a, np);
  }
  mirrorPattern() {
    const a = this.selected;
    if (!a) return;
    audio.sfx('click');
    const np: Pattern = a.pattern.slice();
    for (let i = 0; i < 8; i++) np[i + 8] = a.pattern[i] ? { ...a.pattern[i]! } : null;
    this.touchPattern(a, np);
  }

  upgradeSelected() {
    const a = this.selected;
    if (!a || this.mode !== 'playing') return;
    if (a.lvl >= MAX_LVL) { audio.sfx('deny'); return; }
    const cost = this.upgradeCost(a);
    if (this.cogs < cost) { this.ftext(axw(a.col), lyw(a.lane) - 30, 'Need cogs!', '#ff5a6e', 15, 0.8); audio.sfx('deny'); return; }
    this.cogs -= cost;
    a.spent += cost;
    a.lvl++;
    const nm = this.maxHpOf(a.inst, a.lvl);
    a.hp += nm - a.maxHp;
    a.maxHp = nm;
    a.maxP = this.maxPOf(a.lvl);
    a.pressure = a.maxP;
    audio.sfx('upgrade');
    this.ring(axw(a.col), lyw(a.lane), '#ffd166', 220, 8, 0.5);
    this.spark(axw(a.col), lyw(a.lane), '#ffd166', 18, 200, 'star', -40);
    this.ftext(axw(a.col), lyw(a.lane) - 34, `LEVEL ${a.lvl}`, '#ffd166', 16);
    this.emit();
  }

  sellSelected() {
    const a = this.selected;
    if (!a || this.mode !== 'playing') return;
    const v = this.sellValue(a);
    this.addCogs(0);
    this.cogs += v;
    this.grid[a.lane][a.col] = null;
    this.autos = this.autos.filter((x) => x !== a);
    this.selected = null;
    this.ftext(axw(a.col), lyw(a.lane), `+${v}`, '#ffd166', 16);
    this.spark(axw(a.col), lyw(a.lane), '#d4a24c', 10, 160, 'gear');
    audio.sfx('sell');
    this.emit();
  }

  // ----------------------------------------------------------- end of run
  private end(victory: boolean) {
    if (this.mode === 'ended') return;
    this.mode = 'ended';
    audio.stopAmbient();
    audio.sfx(victory ? 'victory' : 'defeat');
    const frac = this.harmony / this.maxHarmony;
    const stars = !victory ? 0 : frac >= 0.85 ? 3 : frac >= 0.5 ? 2 : 1;
    const lvIdx = Math.max(0, Math.min(4, this.level.id));
    const modBonus = Array.from(this.mods).reduce((s, id) => s + (MODS.find((m) => m.id === id)?.bonus ?? 0), 0);
    let opus = Math.round(((victory ? 25 + lvIdx * 12 + stars * 6 : 0) + this.stats.kills * 0.15 + this.stats.wavesCleared * 3) * this.diff.opus * (1 + modBonus));
    const key = String(this.level.id);
    const prev = this.save.cleared[key] || 0;
    const firstClear = victory && !prev;
    if (this.tutorial) {
      opus = this.save.tutorialDone ? 0 : 10;
      this.save.tutorialDone = true;
    } else {
      if (victory) this.save.cleared[key] = Math.max(prev, stars);
      this.save.best.kills += this.stats.kills;
      this.save.best.combo = Math.max(this.save.best.combo, this.stats.maxCombo);
      this.save.best.runs++;
      if (victory) this.save.best.victories++;
      if (this.level.id === 5) this.save.best.encoreWave = Math.max(this.save.best.encoreWave, this.stats.wavesCleared);
    }
    this.save.opus += opus;
    this.save.totalOpus += opus;
    persist(this.save);
    const result: RunResult = {
      victory, tutorial: this.tutorial, levelId: this.level.id, levelName: this.level.name, stars, opus, stats: { ...this.stats },
      diffName: this.diff.name, harmonyLeft: this.harmony, maxHarmony: this.maxHarmony, firstClear,
    };
    this.emit();
    window.setTimeout(() => { if (!this.destroyed) this.onEnd(result); }, victory ? 900 : 1200);
  }

  // ----------------------------------------------------------- input
  private onKey = (ev: KeyboardEvent) => {
    const tg = ev.target as HTMLElement | null;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'SELECT' || tg.tagName === 'TEXTAREA')) {
      if (ev.code !== 'Escape') return;
    }
    audio.ensure();
    if (ev.code === 'Escape' || ev.code === 'KeyP') {
      ev.preventDefault();
      if (this.mode === 'paused') this.resume();
      else if (this.mode === 'playing') {
        if (ev.code === 'Escape' && (this.armed || this.selected)) { this.armed = null; this.selected = null; this.emit(); } else this.pause();
      }
      return;
    }
    if (this.mode !== 'playing') return;
    switch (ev.code) {
      case 'Space':
        ev.preventDefault();
        if (!ev.repeat) this.conduct();
        return;
      case 'KeyF': case 'KeyQ': ev.preventDefault(); this.forte(); return;
      case 'KeyN': this.callWave(); return;
      case 'BracketLeft': this.setBpm(this.bpm - 5); return;
      case 'BracketRight': this.setBpm(this.bpm + 5); return;
      case 'Delete': case 'Backspace': case 'KeyX': this.sellSelected(); return;
      case 'KeyU': this.upgradeSelected(); return;
      case 'ArrowUp': case 'KeyW': ev.preventDefault(); this.moveCursor(0, -1); return;
      case 'ArrowDown': case 'KeyS': ev.preventDefault(); this.moveCursor(0, 1); return;
      case 'ArrowLeft': case 'KeyA': ev.preventDefault(); this.moveCursor(-1, 0); return;
      case 'ArrowRight': case 'KeyD': ev.preventDefault(); this.moveCursor(1, 0); return;
      case 'Enter': ev.preventDefault(); this.activateCell(this.cursor.col, this.cursor.lane); return;
      default:
        if (/^Digit[1-7]$/.test(ev.code)) {
          const id = INST_ORDER[Number(ev.code.slice(5)) - 1];
          if (id) this.armInstrument(id);
        }
    }
  };
  private onKeyUp = (ev: KeyboardEvent) => { if (ev.code === 'Space' && this.mode !== 'paused') ev.preventDefault(); };
  private onVis = () => { if (document.hidden) this.pause(); };
  private onResize = () => this.resize();

  private moveCursor(dc: number, dl: number) {
    this.kbCursor = true;
    this.cursor.col = clamp(this.cursor.col + dc, 0, PLACE_COLS - 1);
    this.cursor.lane = clamp(this.cursor.lane + dl, 0, LANES - 1);
  }
  private activateCell(col: number, lane: number) {
    const a = this.grid[lane]?.[col];
    if (this.armed && !a) this.place(col, lane, this.armed);
    else if (a) { this.selected = a; audio.sfx('click'); this.emit(); }
    else if (this.selected) { this.selected = null; this.emit(); }
  }

  private toWorld(ev: PointerEvent | MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left - this.offX) / this.scale, y: (ev.clientY - r.top - this.offY) / this.scale };
  }
  private cellAt(wx: number, wy: number) {
    const col = Math.floor((wx - OX) / CW);
    const lane = Math.floor((wy - OY) / CH);
    if (col < 0 || col >= COLS || lane < 0 || lane >= LANES) return null;
    return { col, lane };
  }
  private onPointerMove = (ev: PointerEvent) => {
    const w = this.toWorld(ev);
    this.hover = this.cellAt(w.x, w.y);
    if (this.hover && ev.pointerType === 'mouse') this.kbCursor = false;
  };
  private onPointerLeave = () => { this.hover = null; };
  private onPointerDown = (ev: PointerEvent) => {
    audio.ensure();
    if (ev.button === 2) { this.armed = null; this.emit(); return; }
    if (this.mode !== 'playing') return;
    const w = this.toWorld(ev);
    this.kbCursor = false;
    if (w.x < OX && w.y >= 0 && w.y < LH) { this.conduct(); return; }
    const cell = this.cellAt(w.x, w.y);
    if (!cell) { return; }
    this.hover = cell;
    this.cursor = { col: Math.min(cell.col, PLACE_COLS - 1), lane: cell.lane };
    this.activateCell(cell.col, cell.lane);
  };
  private onCtx = (ev: Event) => ev.preventDefault();

  private bindInput() {
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('visibilitychange', this.onVis);
    window.addEventListener('blur', this.onVis2);
    window.addEventListener('resize', this.onResize);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('contextmenu', this.onCtx);
    const parent = this.canvas.parentElement;
    if (parent && typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(parent);
    }
  }
  private onVis2 = () => { this.pause(); };
  private unbindInput() {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('visibilitychange', this.onVis);
    window.removeEventListener('blur', this.onVis2);
    window.removeEventListener('resize', this.onResize);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('contextmenu', this.onCtx);
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = Math.max(100, parent.clientWidth);
    const h = Math.max(100, parent.clientHeight);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.pxW = this.canvas.width;
    this.pxH = this.canvas.height;
    this.scale = Math.min(w / LW, h / LH);
    this.offX = (w - LW * this.scale) / 2;
    this.offY = (h - LH * this.scale) / 2;
  }

  // ----------------------------------------------------------- rendering
  private rr(x: number, y: number, w: number, h: number, r: number) {
    const c = this.c;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  private spikes(cx: number, cy: number, r1: number, r2: number, n: number, rot: number) {
    const c = this.c;
    c.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r1 : r2;
      const a = rot + (i * Math.PI) / n;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
  }

  private render() {
    const c = this.c;
    c.setTransform(1, 0, 0, 1, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, this.pxH);
    g.addColorStop(0, '#0a131b');
    g.addColorStop(1, '#17110c');
    c.fillStyle = g;
    c.fillRect(0, 0, this.pxW, this.pxH);
    const k = this.dpr * this.scale;
    let sx = 0;
    let sy = 0;
    if (this.shakeAmt > 0) { sx = (Math.random() - 0.5) * this.shakeAmt; sy = (Math.random() - 0.5) * this.shakeAmt; }
    c.setTransform(k, 0, 0, k, this.dpr * this.offX + sx * k, this.dpr * this.offY + sy * k);

    this.drawGears();
    this.drawStage();
    this.drawPodium();
    this.drawTransport();
    if (this.links.length) {
      c.lineWidth = 3;
      for (const l of this.links) {
        c.strokeStyle = `rgba(255,224,138,${l.life / 0.3})`;
        c.beginPath();
        c.moveTo(l.ax, l.ay);
        c.lineTo(l.bx, l.by);
        c.stroke();
      }
    }
    // draw order by lane for pseudo depth
    for (let lane = 0; lane < LANES; lane++) {
      for (const a of this.autos) if (a.lane === lane) this.drawAuto(a);
    }
    const sorted = this.enemies.slice().sort((a, b) => a.vlane - b.vlane);
    for (const e of sorted) this.drawEnemy(e);
    this.drawProjectiles();
    this.drawParticles();
    this.drawHover();
    this.drawTexts();
    this.drawBanner();
    if (this.flashRed > 0) {
      c.fillStyle = `rgba(255,40,70,${this.flashRed * 0.28})`;
      c.fillRect(-50, -50, LW + 100, LH + 100);
    }
    if (this.forteBeats > 0) {
      c.strokeStyle = `rgba(255,209,102,${0.35 + this.pulse * 0.3})`;
      c.lineWidth = 6;
      c.strokeRect(OX - 4, OY - 4, COLS * CW + 8, LANES * CH + 8);
    }
    if (this.mode === 'paused') {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = 'rgba(5,8,12,0.55)';
      c.fillRect(0, 0, this.pxW, this.pxH);
    }
  }

  private drawGears() {
    const c = this.c;
    c.lineWidth = 3;
    c.strokeStyle = `rgba(212,162,76,${0.05 + this.pulse * 0.03})`;
    for (const g of this.gears) {
      c.beginPath();
      const rot = this.vt * g.s;
      for (let i = 0; i < g.n * 2; i++) {
        const r = i % 2 ? g.r : g.r * 1.16;
        const a = rot + (i * Math.PI) / g.n;
        const px = g.x + Math.cos(a) * r;
        const py = g.y + Math.sin(a) * r;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
      c.stroke();
      c.beginPath();
      c.arc(g.x, g.y, g.r * 0.35, 0, 7);
      c.stroke();
    }
  }

  private drawStage() {
    const c = this.c;
    const hue = this.level.hue;
    for (let l = 0; l < LANES; l++) {
      c.fillStyle = l % 2 ? `hsla(${hue},25%,16%,0.95)` : `hsla(${hue},25%,13%,0.95)`;
      c.fillRect(OX, OY + l * CH, COLS * CW, CH);
    }
    c.fillStyle = 'rgba(212,162,76,0.07)';
    c.fillRect(OX, OY, PLACE_COLS * CW, LANES * CH);
    c.strokeStyle = 'rgba(212,162,76,0.5)';
    c.lineWidth = 2;
    c.setLineDash([8, 8]);
    c.beginPath();
    c.moveTo(OX + PLACE_COLS * CW, OY);
    c.lineTo(OX + PLACE_COLS * CW, OY + LANES * CH);
    c.stroke();
    c.setLineDash([]);
    c.strokeStyle = 'rgba(255,255,255,0.05)';
    c.lineWidth = 1;
    for (let i = 1; i < COLS; i++) {
      c.beginPath();
      c.moveTo(OX + i * CW, OY);
      c.lineTo(OX + i * CW, OY + LANES * CH);
      c.stroke();
    }
    c.strokeStyle = `rgba(212,162,76,${0.4 + this.pulse * 0.2})`;
    c.lineWidth = 2;
    for (let i = 0; i <= LANES; i++) {
      c.beginPath();
      c.moveTo(OX, OY + i * CH);
      c.lineTo(OX + COLS * CW, OY + i * CH);
      c.stroke();
    }
    // spawn zone
    c.fillStyle = 'rgba(228,80,108,0.07)';
    c.fillRect(OX + (COLS - 1) * CW, OY, CW, LANES * CH);
    // playhead column hint for selected auto row
    if (this.selected) {
      c.fillStyle = 'rgba(255,255,255,0.05)';
      c.fillRect(OX, OY + this.selected.lane * CH, COLS * CW, CH);
    }
  }

  private drawPodium() {
    const c = this.c;
    const gr = c.createLinearGradient(0, 0, OX, 0);
    gr.addColorStop(0, '#2a1b10');
    gr.addColorStop(1, '#4a3118');
    c.fillStyle = gr;
    c.fillRect(0, 0, OX, LH);
    c.strokeStyle = this.flashRed > 0 ? '#ff4d6d' : '#d4a24c';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(OX, 0);
    c.lineTo(OX, LH);
    c.stroke();
    // conductor
    const cy = OY + (LANES * CH) / 2;
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.ellipse(50, cy + 52, 34, 9, 0, 0, 7);
    c.fill();
    c.fillStyle = '#6b4a22';
    this.rr(18, cy + 18, 64, 36, 6);
    c.fill();
    c.strokeStyle = '#d4a24c';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#3a2a18';
    this.rr(30, cy - 24, 40, 46, 10);
    c.fill();
    c.fillStyle = '#d9b36a';
    c.beginPath();
    c.arc(50, cy - 34, 15, 0, 7);
    c.fill();
    c.fillStyle = '#111';
    c.fillRect(40, cy - 38, 7, 4);
    c.fillRect(53, cy - 38, 7, 4);
    // baton
    const sw = Math.sin(((this.stepNo + this.stepAcc) / 4) * Math.PI);
    c.strokeStyle = '#fff6d8';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(66, cy - 4);
    c.lineTo(66 + sw * 22 + 6, cy - 34 - Math.abs(sw) * 4 + (1 - Math.abs(sw)) * 14);
    c.stroke();
    // harmony hearts
    const hh = this.harmony / this.maxHarmony;
    c.fillStyle = 'rgba(0,0,0,0.5)';
    this.rr(14, cy + 62, 72, 8, 4);
    c.fill();
    c.fillStyle = hh > 0.5 ? '#6be3a1' : hh > 0.25 ? '#ffd166' : '#ff4d6d';
    this.rr(14, cy + 62, 72 * hh, 8, 4);
    c.fill();
    c.fillStyle = '#d9c9a3';
    c.font = 'bold 11px Georgia, serif';
    c.textAlign = 'center';
    c.fillText('HARMONY', 50, cy + 86);
  }

  private drawTransport() {
    const c = this.c;
    // conduct target + shrinking ring
    const into = ((((this.stepNo % 4) + 4) % 4) + this.stepAcc) / 4;
    const ringR = 16 + (1 - into) * 30;
    const j = this.judge;
    c.lineWidth = 3;
    c.strokeStyle = j ? j.color : '#d4a24c';
    c.beginPath();
    c.arc(50, 38, 16, 0, 7);
    c.stroke();
    if (this.mode === 'playing') {
      c.strokeStyle = `rgba(255,240,200,${0.3 + into * 0.6})`;
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(50, 38, ringR, 0, 7);
      c.stroke();
    }
    c.fillStyle = j ? j.color : `rgba(212,162,76,${0.25 + this.pulse * 0.6})`;
    c.beginPath();
    c.arc(50, 38, 8 + this.pulse * 3, 0, 7);
    c.fill();
    // pips
    const x0 = OX + 40;
    const x1 = OX + COLS * CW - 40;
    c.fillStyle = 'rgba(8,12,16,0.7)';
    this.rr(OX, 8, COLS * CW, 56, 10);
    c.fill();
    for (let i = 0; i < STEPS; i++) {
      const x = x0 + ((x1 - x0) * i) / (STEPS - 1);
      const on = i === this.curStep;
      const big = i % 4 === 0;
      const sel = this.selected?.pattern[i];
      c.beginPath();
      c.arc(x, 36, (big ? 9 : 5.5) + (on ? 3 : 0), 0, 7);
      c.fillStyle = on ? '#fff3c4' : big ? 'rgba(212,162,76,0.65)' : 'rgba(212,162,76,0.3)';
      c.fill();
      if (sel) {
        c.fillStyle = INST[this.selected!.inst].color;
        c.beginPath();
        c.arc(x, 36, sel.a ? 5 : 3, 0, 7);
        c.fill();
      }
      if (big) {
        c.fillStyle = 'rgba(255,255,255,0.45)';
        c.font = '10px Georgia, serif';
        c.textAlign = 'center';
        c.fillText(String(i / 4 + 1), x, 58);
      }
    }
  }

  private drawHover() {
    const c = this.c;
    let cell: { col: number; lane: number } | null = null;
    if (this.kbCursor) cell = { col: this.cursor.col, lane: this.cursor.lane };
    else if (this.hover) cell = this.hover;
    if (!cell) return;
    const x = OX + cell.col * CW;
    const y = OY + cell.lane * CH;
    const ok = cell.col < PLACE_COLS && !this.grid[cell.lane][cell.col];
    c.lineWidth = 2;
    c.strokeStyle = this.armed ? (ok ? '#7dffb2' : '#ff6b81') : 'rgba(255,255,255,0.25)';
    this.rr(x + 3, y + 3, CW - 6, CH - 6, 8);
    c.stroke();
    if (this.armed && ok) {
      c.globalAlpha = 0.45;
      c.font = '40px serif';
      c.textAlign = 'center';
      c.fillText(INST[this.armed].icon, x + CW / 2, y + CH / 2 + 14);
      c.globalAlpha = 1;
    }
  }

  private drawAuto(a: Auto) {
    const c = this.c;
    const def = INST[a.inst];
    const cx = axw(a.col);
    const cy = lyw(a.lane);
    const bob = Math.sin(this.vt * 3 + a.id) * 1.5;
    c.save();
    c.translate(cx, cy + bob);
    c.scale(1 + a.fire * 0.1, 1 - a.fire * 0.08);
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.ellipse(0, 34, 28, 7, 0, 0, 7);
    c.fill();
    // body
    c.fillStyle = a.flash > 0.5 ? '#ffd2a0' : '#7a5a2c';
    this.rr(-22, 4, 44, 30, 8);
    c.fill();
    c.strokeStyle = '#d4a24c';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#d4a24c';
    for (const rx of [-16, 16]) { c.beginPath(); c.arc(rx, 10, 2, 0, 7); c.fill(); }
    // head
    const hg = c.createRadialGradient(-4, -20, 2, 0, -16, 18);
    hg.addColorStop(0, '#f0d08a');
    hg.addColorStop(1, '#b8883c');
    c.fillStyle = a.flash > 0.5 ? '#fff' : hg;
    c.beginPath();
    c.arc(0, -16, 16, 0, 7);
    c.fill();
    c.strokeStyle = '#6b4a22';
    c.lineWidth = 2;
    c.stroke();
    const eye = a.silence > 0 ? '#555' : def.color;
    c.fillStyle = eye;
    c.beginPath(); c.arc(-6, -17, 3.5, 0, 7); c.arc(6, -17, 3.5, 0, 7); c.fill();
    // antenna
    c.strokeStyle = '#6b4a22';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -31); c.lineTo(0, -38); c.stroke();
    c.fillStyle = a.fire > 0 ? '#fff' : def.color;
    c.beginPath(); c.arc(0, -40, 3 + a.fire * 3, 0, 7); c.fill();
    this.drawInstrument(a);
    if (a.silence > 0) {
      c.fillStyle = 'rgba(30,40,55,0.6)';
      this.rr(-24, -34, 48, 70, 10);
      c.fill();
      c.strokeStyle = '#9fb3d1';
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(-12, -4); c.lineTo(12, 20); c.moveTo(12, -4); c.lineTo(-12, 20); c.stroke();
    }
    if (a.res > 0) {
      c.strokeStyle = 'rgba(199,155,255,0.8)';
      c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, 36, 0, 7); c.stroke();
    }
    c.restore();
    // bars
    const bx = cx - 28;
    const by = cy + CH / 2 - 10;
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(bx, by, 56, 4);
    const pf = a.pressure / a.maxP;
    c.fillStyle = pf < 0.15 ? '#ff5a6e' : '#5ec8ff';
    c.fillRect(bx, by, 56 * pf, 4);
    if (a.hp < a.maxHp) {
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.fillRect(bx, by - 6, 56, 4);
      c.fillStyle = '#6be3a1';
      c.fillRect(bx, by - 6, 56 * clamp(a.hp / a.maxHp, 0, 1), 4);
    }
    c.fillStyle = '#ffd166';
    for (let i = 0; i < a.lvl; i++) { c.beginPath(); c.arc(cx - 36 + i * 9, cy - 40, 3, 0, 7); c.fill(); }
    if (this.selected === a) {
      c.strokeStyle = '#fff3c4';
      c.lineWidth = 3;
      c.setLineDash([6, 5]);
      c.lineDashOffset = -this.vt * 20;
      this.rr(cx - CW / 2 + 4, cy - CH / 2 + 4, CW - 8, CH - 8, 10);
      c.stroke();
      c.setLineDash([]);
    }
  }

  private drawInstrument(a: Auto) {
    const c = this.c;
    const col = INST[a.inst].color;
    const f = a.fire;
    c.lineWidth = 3;
    switch (a.inst) {
      case 'timpani':
        c.fillStyle = '#b5651d';
        c.beginPath(); c.moveTo(-20, 16); c.quadraticCurveTo(0, 46, 20, 16); c.closePath(); c.fill();
        c.fillStyle = '#f3e2b8';
        c.beginPath(); c.ellipse(0, 16, 20, 7 + f * 2, 0, 0, 7); c.fill();
        c.strokeStyle = col;
        c.beginPath(); c.moveTo(-26, -2 + f * 14); c.lineTo(-6, 13); c.moveTo(26, 4 + (1 - f) * 0); c.lineTo(8, 14); c.stroke();
        break;
      case 'violin':
        c.save();
        c.translate(0, 18);
        c.rotate(-0.35);
        c.fillStyle = '#b5651d';
        c.beginPath(); c.ellipse(0, 6, 11, 9, 0, 0, 7); c.ellipse(0, -6, 8, 7, 0, 0, 7); c.fill();
        c.strokeStyle = '#3a2410';
        c.beginPath(); c.moveTo(0, -12); c.lineTo(0, -26); c.stroke();
        c.strokeStyle = col;
        c.lineWidth = 2;
        c.beginPath(); c.moveTo(-16 + f * 12, -4); c.lineTo(18 - f * 4, 8); c.stroke();
        c.restore();
        break;
      case 'horn':
        c.strokeStyle = col;
        c.lineWidth = 5;
        c.beginPath(); c.arc(-4, 20, 11, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.moveTo(6, 20); c.lineTo(26, 20 - 8 - f * 3); c.lineTo(26, 20 + 8 + f * 3); c.closePath();
        c.fillStyle = col; c.fill();
        break;
      case 'flute':
        c.strokeStyle = col;
        c.lineWidth = 6;
        c.beginPath(); c.moveTo(-22, 30); c.lineTo(24, 8 - f * 3); c.stroke();
        c.fillStyle = '#222';
        for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-10 + i * 8, 25 - i * 4.7, 1.8, 0, 7); c.fill(); }
        break;
      case 'harp':
        c.strokeStyle = col;
        c.lineWidth = 3;
        c.beginPath(); c.moveTo(-16, 34); c.lineTo(-16, 6); c.quadraticCurveTo(0, -4, 18, 8); c.lineTo(18, 34); c.stroke();
        c.lineWidth = 1.5;
        for (let i = 0; i < 5; i++) { const x = -10 + i * 6; c.beginPath(); c.moveTo(x, 32); c.lineTo(x, 7 + i * 1.2 + Math.sin(this.vt * 30 + i) * f * 2); c.stroke(); }
        break;
      case 'cymbal':
        c.strokeStyle = '#8a6a35';
        c.beginPath(); c.moveTo(0, 36); c.lineTo(0, 14); c.stroke();
        c.fillStyle = col;
        c.beginPath(); c.ellipse(0, 12 - f * 4, 22, 4, 0, 0, 7); c.fill();
        c.beginPath(); c.ellipse(0, 20 + f * 3, 22, 4, 0, 0, 7); c.fill();
        break;
      case 'musicbox':
        c.fillStyle = '#7b3f5a';
        this.rr(-22, 16, 44, 20, 4);
        c.fill();
        c.fillStyle = col;
        this.rr(-22, 12, 44, 8, 3);
        c.fill();
        c.strokeStyle = '#ffd166';
        c.lineWidth = 3;
        c.save();
        c.translate(26, 26);
        c.rotate(this.vt * 4 + f * 3);
        c.beginPath(); c.moveTo(0, 0); c.lineTo(8, 0); c.stroke();
        c.restore();
        break;
    }
  }

  private drawEnemy(e: Enemy) {
    const c = this.c;
    const def = ENEMIES[e.type];
    const cx = axw(e.vx) + e.lunge * -10;
    const cy = lyw(e.vlane);
    const r = def.r;
    const hopArc = Math.sin((1 - e.hop) * Math.PI) * (e.hop > 0 ? 9 : 0);
    const col = e.flash > 0.5 ? '#ffffff' : def.color;
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.ellipse(cx, cy + r * 0.85, r * 0.9, r * 0.22, 0, 0, 7);
    c.fill();
    c.translate(cx, cy - hopArc);
    const w = Math.sin(this.vt * 9 + e.seed);
    c.lineWidth = 3;
    switch (e.type) {
      case 'screecher':
        this.spikes(0, 0, r * 0.62, r, 10, this.vt * 0.9);
        c.fillStyle = col; c.fill();
        this.eyes(r * 0.3, -2, 6);
        c.fillStyle = '#2a0610'; c.font = `bold ${r}px serif`; c.textAlign = 'center'; c.fillText('♯', 0, r * 0.95);
        break;
      case 'drone': {
        c.beginPath();
        c.moveTo(0 + w, -r); c.lineTo(r + w * 2, 0); c.lineTo(0, r); c.lineTo(-r - w * 2, 0); c.closePath();
        c.fillStyle = col; c.fill();
        this.eyes(r * 0.35, 0, 3.5);
        break;
      }
      case 'brute':
        c.fillStyle = col;
        this.rr(-r, -r * 0.8, r * 2, r * 1.7, 12); c.fill();
        c.strokeStyle = '#d6c3ff'; c.lineWidth = 3; c.stroke();
        c.fillStyle = '#5a3a99';
        c.fillRect(-r * 0.7, -r * 0.2, r * 1.4, 6);
        c.fillRect(-r * 0.7, r * 0.2, r * 1.4, 6);
        this.spikes(0, -r * 0.8, 4, 10, 4, 0);
        c.fillStyle = '#ffcc00'; c.fill();
        c.fillStyle = '#ff4d4d';
        c.fillRect(-r * 0.5, -r * 0.5, 9, 5); c.fillRect(r * 0.5 - 9, -r * 0.5, 9, 5);
        break;
      case 'mute':
        c.fillStyle = col;
        c.beginPath();
        c.arc(0, -4, r * 0.85, Math.PI, 0);
        c.lineTo(r * 0.85, r * 0.8);
        for (let i = 4; i >= 0; i--) c.lineTo(-r * 0.85 + (i * (r * 1.7)) / 4, r * 0.8 + (i % 2 ? 8 : 0) + w * 2);
        c.closePath(); c.fill();
        c.fillStyle = '#0b1220';
        c.beginPath(); c.ellipse(-8, -8, 4, 7, 0, 0, 7); c.ellipse(8, -8, 4, 7, 0, 0, 7); c.fill();
        c.strokeStyle = '#0b1220'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(0, 4); c.lineTo(0, 16); c.stroke();
        if (e.cast > 0) { c.strokeStyle = `rgba(159,179,209,${e.cast})`; c.beginPath(); c.arc(0, 0, r + (1 - e.cast) * 24, 0, 7); c.stroke(); }
        break;
      case 'syncopator': {
        c.globalAlpha = 0.6 + 0.4 * Math.sin(this.vt * 8 + e.seed);
        c.rotate(this.vt * 1.2);
        c.fillStyle = col;
        this.rr(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4, 4); c.fill();
        c.rotate(-this.vt * 1.2);
        c.globalAlpha = 1;
        this.eyes(r * 0.3, 0, 4);
        c.fillStyle = '#04252c'; c.font = `bold ${r * 0.8}px serif`; c.textAlign = 'center'; c.fillText('♪', 0, r * 1.2);
        break;
      }
      case 'metronome':
        c.fillStyle = col;
        c.beginPath(); c.moveTo(-r * 0.8, r * 0.9); c.lineTo(r * 0.8, r * 0.9); c.lineTo(r * 0.3, -r * 0.9); c.lineTo(-r * 0.3, -r * 0.9); c.closePath(); c.fill();
        c.strokeStyle = '#6b5a22'; c.stroke();
        c.strokeStyle = '#222'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(0, r * 0.7); c.lineTo(Math.sin(this.vt * 6) * r * 0.5, -r * 0.8); c.stroke();
        this.eyes(r * 0.2, r * 0.3, 3);
        break;
      case 'echo':
        c.fillStyle = col;
        c.globalAlpha = 0.85;
        c.beginPath(); c.arc(-9, 0, r * 0.7, 0, 7); c.fill();
        c.beginPath(); c.arc(9, 0, r * 0.7, 0, 7); c.fill();
        c.globalAlpha = 1;
        this.eyes(r * 0.3, -2, 4);
        break;
      case 'howler': {
        this.spikes(0, 0, r * 0.75, r, 14, this.vt * 0.5);
        c.fillStyle = col; c.fill();
        c.fillStyle = '#1a0308';
        c.beginPath(); c.ellipse(0, 10, r * 0.45, r * 0.3 + Math.abs(w) * 6 + e.cast * 8, 0, 0, 7); c.fill();
        c.fillStyle = '#fff';
        for (let i = -2; i <= 2; i++) c.fillRect(i * 10 - 3, -r * 0.1, 6, 10);
        this.eyes(r * 0.35, -r * 0.35, 7);
        break;
      }
      case 'colossus':
        c.fillStyle = col;
        this.rr(-r, -r * 0.9, r * 2, r * 1.9, 16); c.fill();
        c.strokeStyle = '#d6c3ff'; c.lineWidth = 4; c.stroke();
        c.fillStyle = '#4b2fa0';
        for (let i = 0; i < 4; i++) c.fillRect(-r * 0.8, -r * 0.5 + i * r * 0.4, r * 1.6, 8);
        c.fillStyle = '#ff4d4d';
        c.fillRect(-r * 0.5, -r * 0.7, 14, 8); c.fillRect(r * 0.5 - 14, -r * 0.7, 14, 8);
        this.spikes(0, -r * 0.9, 8, 24, 5, 0); c.fillStyle = '#ffcc00'; c.fill();
        break;
      case 'tyrant':
        c.fillStyle = col;
        c.beginPath(); c.moveTo(-r * 0.9, r * 0.9); c.lineTo(r * 0.9, r * 0.9); c.lineTo(r * 0.35, -r * 0.9); c.lineTo(-r * 0.35, -r * 0.9); c.closePath(); c.fill();
        c.strokeStyle = '#6b5a22'; c.lineWidth = 4; c.stroke();
        c.strokeStyle = '#222'; c.lineWidth = 5;
        c.beginPath(); c.moveTo(0, r * 0.8); c.lineTo(Math.sin(this.vt * 5) * r * 0.6, -r * 1.1); c.stroke();
        c.fillStyle = '#ff4d4d'; c.beginPath(); c.arc(Math.sin(this.vt * 5) * r * 0.6, -r * 1.1, 8, 0, 7); c.fill();
        this.eyes(r * 0.2, r * 0.3, 5);
        break;
      case 'choir':
        for (let i = 0; i < 5; i++) {
          const a = this.vt * 0.8 + (i * Math.PI * 2) / 5;
          const px = Math.cos(a) * r * 0.6;
          const py = Math.sin(a) * r * 0.6;
          c.fillStyle = col;
          c.beginPath(); c.arc(px, py, r * 0.38, 0, 7); c.fill();
          c.fillStyle = '#04201a';
          c.beginPath(); c.ellipse(px, py + 2, 5, 3 + Math.abs(Math.sin(this.vt * 7 + i)) * 6, 0, 0, 7); c.fill();
        }
        c.fillStyle = col; c.beginPath(); c.arc(0, 0, r * 0.35, 0, 7); c.fill();
        this.eyes(r * 0.15, 0, 4);
        break;
      case 'cacophony': {
        const ph = e.phase;
        this.spikes(0, 0, r * 0.7, r * (1 + Math.abs(w) * 0.06), 18 + ph * 4, this.vt * (0.5 + ph * 0.6));
        c.fillStyle = ph === 2 ? '#ff0033' : col; c.fill();
        c.strokeStyle = '#ffd1dc'; c.lineWidth = 3; c.stroke();
        this.spikes(0, 0, r * 0.35, r * 0.55, 8, -this.vt);
        c.fillStyle = '#2b0010'; c.fill();
        c.fillStyle = '#fff';
        for (let i = 0; i < 3 + ph; i++) {
          const a = (i * Math.PI * 2) / (3 + ph) + this.vt;
          c.beginPath(); c.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, 6, 0, 7); c.fill();
        }
        c.fillStyle = '#ffd1dc'; c.font = `bold ${r * 0.7}px serif`; c.textAlign = 'center'; c.fillText('♯♭', 0, r * 0.22);
        break;
      }
    }
    if (e.slow > 0) { c.strokeStyle = 'rgba(127,214,194,0.8)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r + 5, 0, 7); c.stroke(); }
    if (e.stun > 0) {
      c.fillStyle = '#fff0a8';
      for (let i = 0; i < 3; i++) { const a = this.vt * 6 + i * 2.1; c.beginPath(); c.arc(Math.cos(a) * 18, -r - 8 + Math.sin(a) * 4, 4, 0, 7); c.fill(); }
    }
    c.restore();
    // tags / hp
    const isBoss = !!def.boss;
    if (e.hp < e.maxHp || isBoss) {
      const bw = isBoss ? 110 : 44;
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(cx - bw / 2, cy - r - 18, bw, 6);
      c.fillStyle = isBoss ? '#ff6b81' : '#e4506c';
      c.fillRect(cx - bw / 2, cy - r - 18, bw * clamp(e.hp / e.maxHp, 0, 1), 6);
    }
    let tag = '';
    if (e.type === 'syncopator') tag = 'OFFBEAT ONLY';
    else if (e.type === 'metronome' || e.type === 'tyrant') tag = 'DOWNBEAT ONLY';
    else if (e.type === 'cacophony' && e.phase === 1) tag = 'DOWNBEAT ONLY';
    else if (e.type === 'brute' || e.type === 'colossus') tag = 'ARMOURED';
    if (tag) {
      c.font = 'bold 9px Georgia, serif';
      c.textAlign = 'center';
      c.fillStyle = 'rgba(0,0,0,0.6)';
      const tw = c.measureText(tag).width + 8;
      c.fillRect(cx - tw / 2, cy + r + 6, tw, 13);
      c.fillStyle = '#ffe9a8';
      c.fillText(tag, cx, cy + r + 16);
    }
  }

  private eyes(dx: number, y: number, s: number) {
    const c = this.c;
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(-dx, y, s, 0, 7); c.arc(dx, y, s, 0, 7); c.fill();
    c.fillStyle = '#111';
    c.beginPath(); c.arc(-dx - 1, y, s * 0.5, 0, 7); c.arc(dx - 1, y, s * 0.5, 0, 7); c.fill();
  }

  private drawProjectiles() {
    const c = this.c;
    for (const p of this.projs) {
      const x = axw(p.x);
      const y = lyw(p.lane);
      c.fillStyle = p.color;
      c.strokeStyle = p.color;
      if (p.inst === 'horn') {
        c.beginPath(); c.arc(x, y, 12 + (p.accent ? 3 : 0), 0, 7); c.fill();
        c.fillStyle = '#fff6d0'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill();
      } else if (p.inst === 'flute') {
        c.lineWidth = 3;
        c.beginPath(); c.arc(x, y, 9, -1, 1); c.stroke();
        c.beginPath(); c.arc(x, y, 15, -0.8, 0.8); c.stroke();
      } else {
        c.font = `${p.accent ? 28 : 22}px serif`;
        c.textAlign = 'center';
        c.fillText('♪', x, y + 8);
      }
    }
  }

  private drawParticles() {
    const c = this.c;
    for (const p of this.parts) {
      const al = clamp(p.life / p.max, 0, 1);
      c.globalAlpha = al;
      c.fillStyle = p.color;
      c.strokeStyle = p.color;
      switch (p.kind) {
        case 'ring':
          c.lineWidth = 3 * al + 1;
          c.beginPath(); c.arc(p.x, p.y, p.size, 0, 7); c.stroke();
          break;
        case 'note':
          c.font = '16px serif';
          c.textAlign = 'center';
          c.fillText('♫', p.x, p.y);
          break;
        case 'gear':
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
          c.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
          c.rotate(0.78); c.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
          c.restore();
          break;
        case 'star':
          c.font = '14px serif'; c.textAlign = 'center'; c.fillText('✦', p.x, p.y);
          break;
        default:
          c.beginPath(); c.arc(p.x, p.y, p.size * (0.4 + al * 0.6), 0, 7); c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  private drawTexts() {
    const c = this.c;
    c.textAlign = 'center';
    for (const t of this.texts) {
      const al = clamp(t.life / t.max * 1.6, 0, 1);
      c.globalAlpha = al;
      const pop = 1 + Math.max(0, (t.life / t.max - 0.8)) * 1.5;
      c.font = `bold ${t.size * pop}px Georgia, serif`;
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(0,0,0,0.75)';
      c.strokeText(t.text, t.x, t.y);
      c.fillStyle = t.color;
      c.fillText(t.text, t.x, t.y);
    }
    c.globalAlpha = 1;
  }

  private drawBanner() {
    const b = this.banner;
    if (!b) return;
    const c = this.c;
    const a = clamp(Math.min(b.t, 1) * 1.2, 0, 1);
    const slide = (1 - a) * 30;
    c.globalAlpha = a;
    c.textAlign = 'center';
    c.font = 'bold 46px Cinzel, Georgia, serif';
    c.lineWidth = 8;
    c.strokeStyle = 'rgba(0,0,0,0.8)';
    c.strokeText(b.text, OX + (COLS * CW) / 2, OY + 200 + slide);
    c.fillStyle = b.color;
    c.fillText(b.text, OX + (COLS * CW) / 2, OY + 200 + slide);
    c.font = '18px Georgia, serif';
    c.lineWidth = 4;
    c.strokeText(b.sub.slice(0, 90), OX + (COLS * CW) / 2, OY + 232 + slide);
    c.fillStyle = '#e8dcc0';
    c.fillText(b.sub.slice(0, 90), OX + (COLS * CW) / 2, OY + 232 + slide);
    c.globalAlpha = 1;
  }
}

