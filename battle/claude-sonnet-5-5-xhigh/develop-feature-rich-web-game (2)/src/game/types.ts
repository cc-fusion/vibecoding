import type { EnemyDef, NpcDef } from './data';
import type { Stack } from './world';

export interface Body { x: number; y: number; w: number; h: number; vx: number; vy: number; onGround: boolean; dir: number; }
export interface PStats {
  def: number; speed: number; dmg: number; crit: number; mine: number; melee: number; lava: boolean; noFall: boolean;
  doubleJump: boolean; wings: boolean; kbImmune: boolean; regen: number; owl: boolean; hermes: boolean;
}
export interface Hook { x: number; y: number; vx: number; vy: number; state: 'fly' | 'hang'; t: number; }
export interface Player extends Body {
  hp: number; maxHp: number; mana: number; maxMana: number;
  inv: Stack[]; armor: Stack[]; acc: Stack[]; sel: number; coins: number;
  buffs: Record<string, number>; invT: number; useCd: number;
  swing: { t: number; dur: number; dir: number; hits: Set<number>; id: string } | null;
  mine: { x: number; y: number; prog: number; snd: number; warn: boolean };
  jumps: number; coyote: number; jumpBuf: number; wasJump: boolean; flight: number; peakY: number; walk: number;
  dead: boolean; regenT: number; manaT: number; sleeping: boolean; recall: number; hook: Hook | null; windLeft: number; lavaT: number;
  st: PStats; spawnX: number; spawnY: number; lightT: number;
}
export interface Part { id: string; x: number; y: number; w: number; h: number; }
export interface Enemy extends Body {
  uid: number; def: EnemyDef; hp: number; maxHp: number; flash: number; t: number; a: Record<string, any>;
  hitCd: number; alpha: number; dead: boolean; ev?: string; rects: Part[]; boss: boolean; kbT: number; walk: number;
}
export interface Npc extends Body {
  id: string; def: NpcDef; hp: number; maxHp: number; home: number; t: number; tx: number; wait: number; flash: number;
  hitCd: number; deadT: number; walk: number; jumpCd: number;
}
export interface Proj {
  x: number; y: number; vx: number; vy: number; w: number; h: number; kind: string; dmg: number; friendly: boolean; life: number;
  grav: number; pierce: number; kb: number; hit: Set<number> | null; rot: number; col: string; t: number;
  fuse?: number; homing?: number; light?: number; fire?: boolean; crit?: number; big?: number;
}
export interface Drop extends Body { id: string; n: number; t: number; delay: number; star?: boolean; }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; col: string; grav: number; glow?: boolean; }
export interface FText { x: number; y: number; vy: number; txt: string; col: string; life: number; max: number; size: number; }
export interface Room { id: number; key: number; cx: number; cy: number; area: number; tiles: number[]; biome: number; }

export interface Settings { master: number; music: number; sfx: number; muted: boolean; shake: boolean; zoom: number; particles: number; numbers: boolean; touch: boolean; }
export interface Meta { shards: number; perks: Record<string, number>; totalKills: number; totalBosses: number; wins: number; worlds: number; bestDay: number; }
export interface Stats {
  mined: number; placed: Record<string, number>; crafted: Record<string, number>; collected: Record<string, number>; kills: number; deaths: number;
  dist: number; dmgDealt: number; dmgTaken: number; maxDepth: number; play: number; coinsEarned: number; bosses: Record<string, number>; npcsMet: number; chests: number; events: number;
}
export interface SlotInfo { name: string; diff: string; day: number; play: number; bosses: number; hardmode: boolean; saved: number; mods: string[]; }
