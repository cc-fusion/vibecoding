// Explicit scene schema + editor settings. Only plain data lives here; Matter.js
// runtime objects are never persisted directly.

export type BodyKind = "rectangle" | "square" | "circle" | "polygon" | "custom";
export type ConstraintKind = "link" | "anchor" | "spring" | "pin";
export type ToolId = "select" | BodyKind | ConstraintKind;
export type SimState = "stopped" | "running" | "paused";

export const BODY_KINDS: BodyKind[] = ["rectangle", "square", "circle", "polygon", "custom"];
export const CONSTRAINT_KINDS: ConstraintKind[] = ["link", "anchor", "spring", "pin"];

export interface Vec2 {
  x: number;
  y: number;
}

export type ShapeSpec =
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "square"; size: number }
  | { kind: "circle"; radius: number }
  | { kind: "polygon"; sides: number; radius: number }
  | { kind: "custom"; vertices: Vec2[] };

export interface BodyRenderProps {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  opacity: number;
}

export interface CollisionFilterData {
  group: number;
  category: number;
  mask: number;
}

export interface BodyPhysics {
  isStatic: boolean;
  isSensor: boolean;
  density: number;
  restitution: number;
  friction: number;
  frictionStatic: number;
  frictionAir: number;
  sleepThreshold: number;
  collisionFilter: CollisionFilterData;
}

export interface BodyData extends BodyPhysics {
  id: string;
  label: string;
  shape: ShapeSpec;
  position: Vec2;
  angle: number;
  velocity: Vec2;
  angularVelocity: number;
  render: BodyRenderProps;
}

export interface ConstraintRenderProps {
  strokeStyle: string;
  lineWidth: number;
  type: "line" | "spring";
  anchors: boolean;
}

export interface ConstraintData {
  id: string;
  kind: ConstraintKind;
  label: string;
  bodyA: string | null;
  bodyB: string | null;
  pointA: Vec2;
  pointB: Vec2;
  length: number;
  stiffness: number;
  damping: number;
  render: ConstraintRenderProps;
}

export interface SceneData {
  bodies: BodyData[];
  constraints: ConstraintData[];
}

// ---- Last-used creation settings (kept separate per tool) ----

export interface BodyDefaults extends BodyPhysics {
  render: BodyRenderProps;
}

export interface LastUsedBodies {
  rectangle: BodyDefaults & { width: number; height: number };
  square: BodyDefaults & { size: number };
  circle: BodyDefaults & { radius: number };
  polygon: BodyDefaults & { sides: number; radius: number };
  custom: BodyDefaults;
}

export interface ConstraintDefaults {
  stiffness: number;
  damping: number;
  lengthMode: "auto" | "fixed";
  length: number;
  render: ConstraintRenderProps;
}

export type LastUsedConstraints = Record<ConstraintKind, ConstraintDefaults>;

export interface LastUsed {
  bodies: LastUsedBodies;
  constraints: LastUsedConstraints;
}

// ---- World / editor settings ----

export interface WorldSettings {
  name: string;
  background: string;
}

export interface EngineSettings {
  timeScale: number;
  stepHz: number;
  enableSleeping: boolean;
  positionIterations: number;
  velocityIterations: number;
  constraintIterations: number;
}

export interface RenderSettings {
  wireframes: boolean;
  showBounds: boolean;
  showVelocity: boolean;
  showAxes: boolean;
  showSleeping: boolean;
  showLabels: boolean;
  showCollisions: boolean;
  showConstraintAnchors: boolean;
  showBoundaries: boolean;
}

export interface GravitySettings {
  mode: "auto" | "manual";
  x: number;
  y: number;
  scale: number;
  sensitivity: number;
  smoothing: number;
  invertX: boolean;
  invertY: boolean;
  calibration: { beta: number; gamma: number };
}

export interface BoundarySettings {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
  thickness: number;
  friction: number;
  restitution: number;
  visible: boolean;
  color: string;
}

export interface GridSettings {
  show: boolean;
  spacing: number;
  snap: boolean;
}

export interface UIPreferences {
  stickyMultiSelect: boolean;
  collapsed: Record<string, boolean>;
}

export interface EditorSettings {
  world: WorldSettings;
  engine: EngineSettings;
  render: RenderSettings;
  gravity: GravitySettings;
  boundaries: BoundarySettings;
  grid: GridSettings;
  ui: UIPreferences;
}

export const DOCUMENT_APP = "matter-level-editor";
export const DOCUMENT_VERSION = 1;

export interface EditorDocument {
  app: typeof DOCUMENT_APP;
  version: number;
  savedAt: string;
  scene: SceneData;
  settings: EditorSettings;
  lastUsed: LastUsed;
}

export interface SelectionRef {
  type: "body" | "constraint";
  id: string;
}

export type SensorStatus =
  | "unsupported"
  | "idle"
  | "needs-permission"
  | "requesting"
  | "active"
  | "no-data"
  | "denied"
  | "error";

export interface SensorDiagnostics {
  status: SensorStatus;
  message: string;
  raw: { alpha: number | null; beta: number | null; gamma: number | null };
  screenAngle: number;
  processed: Vec2;
  eventsPerSecond: number;
  lastEventAt: number | null;
}
