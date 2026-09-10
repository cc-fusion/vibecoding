import type Matter from 'matter-js';
import type { SoftBody } from './SoftBody';

export interface Vec {
  x: number;
  y: number;
}

/** Tunable parameters of a soft body. */
export interface SoftParams {
  /** 0..1 — spring stiffness of the outline mesh */
  stiffness: number;
  /** 0..1 — internal velocity damping */
  damping: number;
  /** 0..1 — gas pressure (area preservation) */
  pressure: number;
  /** 0..1 — shape memory / elasticity (shape matching strength) */
  elasticity: number;
  /** mass multiplier (density) */
  mass: number;
  /** 0..1 surface friction */
  friction: number;
  /** 0..1 restitution */
  restitution: number;
  /** number of outline nodes */
  resolution: number;
}

export type RigidDef =
  | { shape: 'rect'; w: number; h: number }
  | { shape: 'circle'; r: number }
  | { shape: 'polygon'; verts: Vec[] };

export interface RigidObject {
  kind: 'rigid';
  id: number;
  body: Matter.Body;
  def: RigidDef;
  color: string;
}

export interface SoftObject {
  kind: 'soft';
  id: number;
  soft: SoftBody;
  color: string;
}

export type SimObject = RigidObject | SoftObject;

export interface DebugFlags {
  nodes: boolean;
  springs: boolean;
  shapes: boolean;
  velocities: boolean;
}

export interface WorldParams {
  gravityX: number;
  gravityY: number;
  speed: number;
  paused: boolean;
  grid: boolean;
  debug: DebugFlags;
}

export type Tool = 'select' | 'soft' | 'rect' | 'circle' | 'polygon';
export type SoftPreset = 'blob' | 'circle' | 'rect' | 'star';
export type BodyMode = 'dynamic' | 'static';
export type PolyTarget = 'soft' | 'dynamic' | 'static';

export interface ToolState {
  tool: Tool;
  softPreset: SoftPreset;
  bodyMode: BodyMode;
  polyTarget: PolyTarget;
}

export type Draft =
  | { kind: 'box'; tool: Tool; start: Vec; end: Vec; seed: number }
  | { kind: 'polygon'; points: Vec[]; cursor: Vec | null; valid: boolean; closing: boolean };

export interface GrabState {
  objectId: number;
  pointer: Vec;
  /** attached constraints (dynamic rigid / soft particles) */
  constraints: { c: Matter.Constraint; offset: Vec; baseAngle: number }[];
  /** for static bodies: pointer offset from body position */
  staticOffset: Vec | null;
}

export interface ThrowIndicator {
  pos: Vec;
  vel: Vec;
  t: number;
  objectId: number;
}

export interface Stats {
  fps: number;
  bodies: number;
  particles: number;
  constraints: number;
  simTime: number;
  stepMs: number;
}
