import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import * as Matter from "matter-js";
// poly-decomp does not publish TypeScript declarations.
// @ts-expect-error no declaration file for poly-decomp
import decomp from "poly-decomp";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronDown,
  Circle,
  CircleDot,
  Copy,
  Download,
  FileUp,
  Grid2X2,
  Grip,
  Layers3,
  Link2,
  LockKeyhole,
  MousePointer2,
  Pause,
  Pentagon,
  Play,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  SlidersHorizontal,
  Square,
  StepForward,
  Trash2,
  Video,
  X,
} from "lucide-react";

Matter.Common.setDecomp(decomp);

const { Body, Bodies, Composite, Constraint, Engine, Events, Mouse, MouseConstraint, Query, Sleeping } = Matter;
const STEP = 1000 / 60;
const FLOOR_TOP = 96;
const STORAGE_KEY = "kinetic-physics-lab-slots-v1";
const PALETTE = ["#8FCDBB", "#F09B78", "#BDADE2", "#F1C877", "#91BBDD", "#D3DCC5"];
const CATEGORY_OPTIONS = [
  { bit: 1, name: "Default" },
  { bit: 2, name: "Layer 2" },
  { bit: 4, name: "Layer 3" },
  { bit: 8, name: "Layer 4" },
  { bit: 16, name: "Layer 5" },
];

type Vec = { x: number; y: number };
type Tool = "select" | "shape" | "polygon" | "constraint" | "delete";
type Shape = "rectangle" | "circle" | "trapezoid" | "hexagon" | "custom" | "platform";
type LinkKind = "rigid" | "spring" | "pivot";
type PanelTab = "create" | "inspect" | "world" | "files";
type BoundSide = "floor" | "left" | "right" | "ceiling";

interface WorldSettings {
  gravityX: number;
  gravityY: number;
  timeScale: number;
  speed: number;
  enableSleeping: boolean;
  ccdSteps: 1 | 2 | 4 | 8;
  ccdThreshold: number;
  showGrid: boolean;
  bounds: Record<BoundSide, boolean>;
}

interface BodyMeta {
  uid: string;
  shape: Shape;
  color: string;
  boundary?: boolean;
}

interface LinkMeta {
  uid: string;
  kind: LinkKind;
}

interface SavedBody {
  uid: string;
  label: string;
  shape: Shape;
  color: string;
  position: Vec;
  angle: number;
  parts: Vec[][];
  circleRadius: number | null;
  velocity: Vec;
  angularVelocity: number;
  isStatic: boolean;
  isSensor: boolean;
  isSleeping: boolean;
  sleepThreshold: number;
  mass: number | null;
  density: number;
  friction: number;
  frictionStatic: number;
  frictionAir: number;
  restitution: number;
  collisionFilter: { category: number; mask: number; group: number };
}

interface SavedLink {
  uid: string;
  label: string;
  kind: LinkKind;
  bodyA: string | null;
  bodyB: string | null;
  pointA: Vec;
  pointB: Vec;
  length: number;
  stiffness: number;
  damping: number;
}

interface SavedScene {
  version: 1;
  name: string;
  settings: WorldSettings;
  elapsed: number;
  bodies: SavedBody[];
  links: SavedLink[];
  groups: { label: string; bodyUids: string[] }[];
}

interface SaveSlot {
  name: string;
  savedAt: string;
  scene: SavedScene;
}

interface SpawnPreview { start: Vec; current: Vec }
interface LinkStart { bodyId: number; point: Vec }
interface EditDrag {
  kind: "move" | "rotate" | "resize";
  start: Vec;
  ids: number[];
  positions?: { id: number; position: Vec }[];
  bodyId?: number;
  bodyAngle?: number;
  pointerAngle?: number;
  startLocal?: Vec;
  scaleX?: number;
  scaleY?: number;
}

interface DrawState {
  settings: WorldSettings;
  selectedIds: number[];
  selectedConstraintId: number | null;
  hoverId: number | null;
  polygon: Vec[];
  spawn: SpawnPreview | null;
  link: LinkStart | null;
  pointer: Vec;
  flashes: Map<number, number>;
  previous: Map<number, { x: number; y: number; angle: number }> | null;
  alpha: number;
  editableHandles: boolean;
}

const INITIAL_SETTINGS: WorldSettings = {
  gravityX: 0,
  gravityY: 1,
  timeScale: 1,
  speed: 1,
  enableSleeping: true,
  ccdSteps: 1,
  ccdThreshold: 9,
  showGrid: true,
  bounds: { floor: true, left: true, right: true, ceiling: false },
};

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function rotate(point: Vec, angle: number): Vec {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: point.x * c - point.y * s, y: point.x * s + point.y * c };
}

function metaOf(body: Matter.Body): BodyMeta {
  return (body.plugin as { studio?: BodyMeta }).studio || {
    uid: String(body.id), shape: "custom", color: PALETTE[0],
  };
}

function setMeta(body: Matter.Body, meta: BodyMeta) {
  (body.plugin as { studio?: BodyMeta }).studio = meta;
}

function linkMeta(link: Matter.Constraint): LinkMeta | undefined {
  return (link as Matter.Constraint & { plugin?: { studio?: LinkMeta } }).plugin?.studio;
}

function setLinkMeta(link: Matter.Constraint, meta: LinkMeta) {
  const tagged = link as Matter.Constraint & { plugin?: { studio?: LinkMeta } };
  tagged.plugin ||= {};
  tagged.plugin.studio = meta;
}

function sceneBodies(engine: Matter.Engine) {
  return Composite.allBodies(engine.world).filter((body) => !metaOf(body).boundary);
}

function sceneLinks(engine: Matter.Engine) {
  return Composite.allConstraints(engine.world).filter((link) => !!linkMeta(link));
}

function makePrimitive(shape: Shape, x: number, y: number, width: number, height: number, color: string, label: string, fixed = false) {
  const options: Matter.IChamferableBodyDefinition = {
    label,
    isStatic: fixed,
    density: 0.0013,
    friction: 0.24,
    frictionStatic: 0.75,
    frictionAir: 0.003,
    restitution: 0.56,
  };
  let body: Matter.Body;
  if (shape === "circle") body = Bodies.circle(x, y, Math.max(10, width / 2), options);
  else if (shape === "trapezoid") body = Bodies.trapezoid(x, y, width, height, 0.38, options);
  else if (shape === "hexagon") body = Bodies.polygon(x, y, 6, Math.max(12, width / 2), options);
  else body = Bodies.rectangle(x, y, width, height, options);
  setMeta(body, { uid: uid(), shape, color });
  return body;
}

function saveBody(body: Matter.Body): SavedBody {
  const meta = metaOf(body);
  const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
  return {
    uid: meta.uid,
    label: body.label,
    shape: meta.shape,
    color: meta.color,
    position: { ...body.position },
    angle: body.angle,
    parts: parts.map((part) => part.vertices.map((vertex) =>
      rotate({ x: vertex.x - body.position.x, y: vertex.y - body.position.y }, -body.angle))),
    circleRadius: body.circleRadius || null,
    velocity: { ...body.velocity },
    angularVelocity: body.angularVelocity,
    isStatic: body.isStatic,
    isSensor: body.isSensor,
    isSleeping: body.isSleeping,
    sleepThreshold: body.sleepThreshold,
    mass: Number.isFinite(body.mass) ? body.mass : null,
    density: Number.isFinite(body.density) ? body.density : 0.0013,
    friction: body.friction,
    frictionStatic: body.frictionStatic,
    frictionAir: body.frictionAir,
    restitution: body.restitution,
    collisionFilter: {
      category: body.collisionFilter.category ?? 1,
      mask: body.collisionFilter.mask ?? -1,
      group: body.collisionFilter.group ?? 0,
    },
  };
}

function restoreBody(saved: SavedBody): Matter.Body {
  const options: Matter.IBodyDefinition = {
    label: saved.label,
    friction: saved.friction,
    frictionStatic: saved.frictionStatic,
    frictionAir: saved.frictionAir,
    restitution: saved.restitution,
    density: saved.density || 0.0013,
    isSensor: saved.isSensor,
    collisionFilter: { ...saved.collisionFilter },
  };
  let body: Matter.Body;
  if (saved.shape === "circle" && saved.circleRadius && saved.circleRadius > 0) {
    body = Bodies.circle(saved.position.x, saved.position.y, saved.circleRadius, options);
  } else if (saved.parts.length > 1) {
    // fromVertices centers each convex set separately; explicit part positions preserve concave geometry.
    const parts = saved.parts.map((vertices) => {
      const worldVertices = vertices.map((vertex) => ({
        x: vertex.x + saved.position.x, y: vertex.y + saved.position.y,
      }));
      return Body.create({ ...options, position: Matter.Vertices.centre(worldVertices), vertices: worldVertices });
    });
    body = Body.create({ ...options, parts });
  } else {
    body = Bodies.fromVertices(saved.position.x, saved.position.y, saved.parts, options, true, 0.01, 2);
  }
  if (!body) throw new Error(`Could not restore ${saved.label}`);
  Body.setAngle(body, saved.angle);
  Body.setPosition(body, saved.position);
  if (saved.mass !== null && saved.mass > 0 && Number.isFinite(saved.mass)) Body.setMass(body, saved.mass);
  if (saved.isStatic) Body.setStatic(body, true);
  else {
    Body.setVelocity(body, saved.velocity);
    Body.setAngularVelocity(body, saved.angularVelocity);
  }
  body.sleepThreshold = saved.sleepThreshold;
  if (saved.isSleeping && !saved.isStatic) Sleeping.set(body, true);
  setMeta(body, { uid: saved.uid, shape: saved.shape, color: saved.color });
  return body;
}

function localSize(body: Matter.Body) {
  const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
  const points = parts.flatMap((part) => part.vertices.map((vertex) =>
    rotate({ x: vertex.x - body.position.x, y: vertex.y - body.position.y }, -body.angle)));
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

function seedScene(engine: Matter.Engine, width: number, height: number) {
  const s = clamp(Math.min(width / 960, height / 700), 0.68, 1.12);
  const add = (shape: Shape, x: number, y: number, w: number, h: number, color: string, label: string, angle = 0, fixed = false) => {
    const body = makePrimitive(shape, x, y, w * s, h * s, color, label, fixed);
    if (angle) Body.setAngle(body, angle);
    Composite.add(engine.world, body);
    return body;
  };

  add("platform", width * 0.30, height * 0.775, 190, 16, "#526878", "Left ramp", -0.17, true);
  add("platform", width * 0.73, height * 0.755, 182, 16, "#526878", "Right ramp", 0.15, true);
  const mint = add("circle", width * 0.275, height * 0.345, 108, 108, PALETTE[0], "Mint sphere");
  const coral = add("trapezoid", width * 0.47, height * 0.43, 132, 92, PALETTE[1], "Coral trapezoid", -0.14);
  add("hexagon", width * 0.365, height * 0.615, 92, 92, PALETTE[2], "Lilac hexagon", 0.23);
  add("circle", width * 0.555, height * 0.265, 58, 58, PALETTE[3], "Golden sphere");
  add("rectangle", width * 0.69, height * 0.545, 112, 88, PALETTE[4], "Blue block", 0.21);
  const bob = add("circle", width * 0.79, height * 0.31, 79, 79, PALETTE[1], "Pendulum bob");

  const spring = Constraint.create({
    label: "Soft spring",
    bodyA: mint,
    bodyB: coral,
    pointA: { x: 30 * s, y: 8 * s },
    pointB: { x: -43 * s, y: -4 * s },
    length: distance(mint.position, coral.position) * 0.74,
    stiffness: 0.018,
    damping: 0.045,
  });
  setLinkMeta(spring, { uid: uid(), kind: "spring" });
  const pendulum = Constraint.create({
    label: "Pendulum link",
    pointA: { x: width * 0.705, y: height * 0.105 },
    bodyB: bob,
    pointB: { x: 0, y: 0 },
    length: distance({ x: width * 0.705, y: height * 0.105 }, bob.position),
    stiffness: 0.95,
    damping: 0.015,
  });
  setLinkMeta(pendulum, { uid: uid(), kind: "rigid" });
  Composite.add(engine.world, [spring, pendulum]);
}

function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;
}

function segmentDistance(point: Vec, a: Vec, b: Vec) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return distance(point, { x: a.x + t * dx, y: a.y + t * dy });
}

function drawScene(ctx: CanvasRenderingContext2D, engine: Matter.Engine, width: number, height: number, dpr: number, view: DrawState) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#14212b";
  ctx.fillRect(0, 0, width, height);

  const light = ctx.createRadialGradient(width * 0.53, height * 0.37, 40, width * 0.53, height * 0.37, Math.max(width, height) * 0.76);
  light.addColorStop(0, "rgba(43,67,77,0.45)");
  light.addColorStop(1, "rgba(13,24,34,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, width, height);

  if (view.settings.showGrid) {
    ctx.fillStyle = "rgba(139,168,178,0.14)";
    for (let x = 16; x < width; x += 32) {
      for (let y = 16; y < height; y += 32) ctx.fillRect(x, y, 1.5, 1.5);
    }
  }

  if (view.settings.bounds.floor) {
    const floor = height - FLOOR_TOP;
    const fill = ctx.createLinearGradient(0, floor, 0, height);
    fill.addColorStop(0, "#253744");
    fill.addColorStop(1, "#1a2a35");
    ctx.fillStyle = fill;
    ctx.fillRect(0, floor, width, FLOOR_TOP);
    ctx.strokeStyle = "#6c8690";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, floor + 0.5); ctx.lineTo(width, floor + 0.5); ctx.stroke();
    ctx.strokeStyle = "rgba(181,207,206,0.10)";
    ctx.lineWidth = 1;
    for (let x = -20; x < width + 20; x += 28) {
      ctx.beginPath(); ctx.moveTo(x, floor + 17); ctx.lineTo(x + 8, floor + 17); ctx.stroke();
    }
  }
  ctx.strokeStyle = "rgba(158,188,190,0.24)";
  ctx.lineWidth = 2;
  if (view.settings.bounds.left) { ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(1, height); ctx.stroke(); }
  if (view.settings.bounds.right) { ctx.beginPath(); ctx.moveTo(width - 1, 0); ctx.lineTo(width - 1, height); ctx.stroke(); }
  if (view.settings.bounds.ceiling) { ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(width, 1); ctx.stroke(); }

  const renderedPosition = (body: Matter.Body): Vec => {
    const prev = view.previous?.get(body.id);
    return prev
      ? { x: prev.x + (body.position.x - prev.x) * view.alpha, y: prev.y + (body.position.y - prev.y) * view.alpha }
      : body.position;
  };

  for (const link of sceneLinks(engine)) {
    const a = Constraint.pointAWorld(link);
    const b = Constraint.pointBWorld(link);
    if (link.bodyA) {
      const p = renderedPosition(link.bodyA);
      a.x += p.x - link.bodyA.position.x; a.y += p.y - link.bodyA.position.y;
    }
    if (link.bodyB) {
      const p = renderedPosition(link.bodyB);
      b.x += p.x - link.bodyB.position.x; b.y += p.y - link.bodyB.position.y;
    }
    const kind = linkMeta(link)?.kind || "rigid";
    const selected = view.selectedConstraintId === link.id;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = selected ? 3 : 2;
    ctx.strokeStyle = selected ? "#F2C477" : kind === "spring" ? "#A7D9CC" : "#B9C9C9";
    if (kind === "spring" && distance(a, b) > 35) {
      const length = distance(a, b);
      const nx = -(b.y - a.y) / length;
      const ny = (b.x - a.x) / length;
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      for (let i = 1; i < 16; i++) {
        const t = i / 16;
        const offset = i === 1 || i === 15 ? 0 : (i % 2 ? 7 : -7);
        ctx.lineTo(a.x + (b.x - a.x) * t + nx * offset, a.y + (b.y - a.y) * t + ny * offset);
      }
      ctx.lineTo(b.x, b.y); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const p of [a, b]) {
      ctx.beginPath(); ctx.arc(p.x, p.y, kind === "pivot" ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = "#172832"; ctx.fill(); ctx.stroke();
    }
    if (kind === "pivot" && (!link.bodyA || !link.bodyB)) {
      const pin = link.bodyA ? b : a;
      ctx.beginPath(); ctx.arc(pin.x, pin.y, 10, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  const bodies = sceneBodies(engine);
  for (const body of [...bodies.filter((b) => b.isStatic), ...bodies.filter((b) => !b.isStatic)]) {
    const meta = metaOf(body);
    const prev = view.previous?.get(body.id);
    const position = renderedPosition(body);
    const angle = prev ? prev.angle + (body.angle - prev.angle) * view.alpha : body.angle;
    const flashed = (view.flashes.get(body.id) || 0) > performance.now();
    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(angle - body.angle);
    ctx.translate(-body.position.x, -body.position.y);
    ctx.globalAlpha = body.isSleeping ? 0.76 : 1;
    ctx.beginPath();
    if (body.circleRadius && body.parts.length === 1) {
      ctx.arc(body.position.x, body.position.y, body.circleRadius, 0, Math.PI * 2);
    } else {
      for (const part of body.parts.length > 1 ? body.parts.slice(1) : [body]) {
        if (!part.vertices.length) continue;
        ctx.moveTo(part.vertices[0].x, part.vertices[0].y);
        for (let i = 1; i < part.vertices.length; i++) ctx.lineTo(part.vertices[i].x, part.vertices[i].y);
        ctx.closePath();
      }
    }
    ctx.shadowColor = flashed ? "rgba(244,196,111,0.9)" : "rgba(2,10,17,0.42)";
    ctx.shadowBlur = flashed ? 26 : 22;
    ctx.shadowOffsetY = flashed ? 0 : 13;
    ctx.fillStyle = body.isSensor ? `${meta.color}55` : meta.color;
    ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.lineWidth = body.isSensor ? 2 : 1.5;
    ctx.strokeStyle = body.isSensor ? meta.color : "rgba(255,255,255,0.27)";
    if (body.isSensor) ctx.setLineDash([7, 5]);
    ctx.stroke(); ctx.setLineDash([]);
    if (body.circleRadius && !body.isSensor) {
      ctx.strokeStyle = "rgba(20,35,42,0.28)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(body.position.x + Math.cos(body.angle - 0.6) * body.circleRadius * 0.47, body.position.y + Math.sin(body.angle - 0.6) * body.circleRadius * 0.47);
      ctx.lineTo(body.position.x + Math.cos(body.angle - 0.6) * body.circleRadius * 0.75, body.position.y + Math.sin(body.angle - 0.6) * body.circleRadius * 0.75);
      ctx.stroke();
    }
    if (body.isSensor) {
      ctx.fillStyle = meta.color;
      ctx.beginPath(); ctx.arc(body.position.x, body.position.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  if (view.hoverId !== null && !view.selectedIds.includes(view.hoverId)) {
    const hovered = bodies.find((body) => body.id === view.hoverId);
    if (hovered) {
      ctx.save(); ctx.strokeStyle = "rgba(229,241,238,0.52)"; ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
      ctx.strokeRect(hovered.bounds.min.x - 7, hovered.bounds.min.y - 7,
        hovered.bounds.max.x - hovered.bounds.min.x + 14, hovered.bounds.max.y - hovered.bounds.min.y + 14);
      ctx.restore();
    }
  }

  for (const id of view.selectedIds) {
    const body = bodies.find((item) => item.id === id);
    if (!body) continue;
    const b = body.bounds;
    ctx.save();
    ctx.strokeStyle = "#E8F4EF"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
    ctx.strokeRect(b.min.x - 9, b.min.y - 9, b.max.x - b.min.x + 18, b.max.y - b.min.y + 18);
    ctx.setLineDash([]);
    if (view.selectedIds.length === 1 && view.editableHandles) {
      const resize = { x: b.max.x + 9, y: b.max.y + 9 };
      const rotation = { x: (b.min.x + b.max.x) / 2, y: b.min.y - 29 };
      ctx.strokeStyle = "rgba(232,244,239,0.8)";
      ctx.beginPath(); ctx.moveTo(rotation.x, b.min.y - 9); ctx.lineTo(rotation.x, rotation.y); ctx.stroke();
      for (const point of [resize, rotation]) {
        ctx.beginPath(); ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#E7F5EE"; ctx.fill();
        ctx.strokeStyle = "#294550"; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    ctx.restore();
  }

  if (view.link) {
    ctx.save(); ctx.setLineDash([7, 7]); ctx.lineWidth = 2;
    ctx.strokeStyle = "#F3C783";
    ctx.beginPath(); ctx.moveTo(view.link.point.x, view.link.point.y); ctx.lineTo(view.pointer.x, view.pointer.y); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = "#F3C783";
    ctx.beginPath(); ctx.arc(view.link.point.x, view.link.point.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  if (view.polygon.length) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(view.polygon[0].x, view.polygon[0].y);
    for (let i = 1; i < view.polygon.length; i++) ctx.lineTo(view.polygon[i].x, view.polygon[i].y);
    ctx.lineTo(view.pointer.x, view.pointer.y);
    if (view.polygon.length >= 3) ctx.closePath();
    ctx.fillStyle = "rgba(143,205,187,0.15)"; ctx.fill();
    ctx.strokeStyle = "#A8DCCB"; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);
    view.polygon.forEach((point, index) => {
      ctx.beginPath(); ctx.arc(point.x, point.y, index === 0 ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = index === 0 ? "#F2C877" : "#B9E7D8"; ctx.fill();
    });
    ctx.restore();
  }

  if (view.spawn) {
    const { start, current } = view.spawn;
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const w = Math.max(16, Math.abs(start.x - current.x));
    const h = Math.max(16, Math.abs(start.y - current.y));
    ctx.save(); ctx.strokeStyle = "#F2C877"; ctx.fillStyle = "rgba(242,200,119,0.12)";
    ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke(); ctx.restore();
  }
}

function RangeRow({ label, value, min, max, step, unit = "", digits = 2, displayValue, onChange, disabled = false }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string; digits?: number;
  displayValue?: string; onChange: (value: number) => void; disabled?: boolean;
}) {
  const fill = `${clamp(((value - min) / (max - min)) * 100, 0, 100)}%`;
  return (
    <div className="range-row">
      <div className="range-label"><span>{label}</span><strong>{displayValue ?? `${value.toFixed(digits)}${unit}`}</strong></div>
      <input type="range" min={min} max={max} step={step} value={clamp(value, min, max)}
        style={{ "--fill": fill } as CSSProperties} disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))} aria-label={label} />
    </div>
  );
}

function NumberField({ label, value, onChange, min, max, step = 1, suffix, disabled = false }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; max?: number;
  step?: number; suffix?: string; disabled?: boolean;
}) {
  const formatted = Number.isFinite(value) ? String(Number(value.toFixed(3))) : "";
  const [draft, setDraft] = useState(formatted);
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setDraft(formatted); }, [formatted, focused]);
  return (
    <label className="number-field">
      <span>{label}</span>
      <span className="number-wrap"><input type="number" value={focused ? draft : formatted}
        min={min} max={max} step={step} disabled={disabled}
        onFocus={() => { setFocused(true); setDraft(formatted); }}
        onBlur={() => { setFocused(false); if (draft === "" || !Number.isFinite(Number(draft))) setDraft(formatted); }}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          const next = Number(text);
          if (text !== "" && Number.isFinite(next)) onChange(clamp(next, min ?? -100000, max ?? 100000));
        }} />{suffix && <em>{suffix}</em>}</span>
    </label>
  );
}

function ToggleRow({ label, description, checked, onChange, disabled = false }: {
  label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className="toggle-row">
      <span><strong>{label}</strong>{description && <small>{description}</small>}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const mouseConstraintRef = useRef<Matter.MouseConstraint | null>(null);
  const boundaryRef = useRef<Matter.Body[]>([]);
  const sizeRef = useRef({ width: 900, height: 650, dpr: 1 });
  const selectedIdsRef = useRef<number[]>([]);
  const selectedConstraintRef = useRef<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  const pointerRef = useRef<Vec>({ x: 0, y: 0 });
  const polygonRef = useRef<Vec[]>([]);
  const spawnRef = useRef<SpawnPreview | null>(null);
  const linkStartRef = useRef<LinkStart | null>(null);
  const editDragRef = useRef<EditDrag | null>(null);
  const previousFrameRef = useRef(new Map<number, { x: number; y: number; angle: number }>());
  const flashesRef = useRef(new Map<number, number>());
  const elapsedRef = useRef(0);
  const checkpointRef = useRef<SavedScene | null>(null);
  const labelCounterRef = useRef(9);
  const colorCounterRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoUrlRef = useRef<string | null>(null);

  const [tab, setTab] = useState<PanelTab>("create");
  const [tool, setTool] = useState<Tool>("select");
  const toolRef = useRef<Tool>(tool);
  toolRef.current = tool;
  const [shape, setShape] = useState<Shape>("rectangle");
  const shapeRef = useRef<Shape>(shape);
  shapeRef.current = shape;
  const [linkKind, setLinkKind] = useState<LinkKind>("spring");
  const linkKindRef = useRef<LinkKind>(linkKind);
  linkKindRef.current = linkKind;
  const [isPlaying, setIsPlaying] = useState(false);
  const playingRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedConstraintId, setSelectedConstraintId] = useState<number | null>(null);
  const [polygonCount, setPolygonCount] = useState(0);
  const [hasLinkStart, setHasLinkStart] = useState(false);
  const [sceneName, setSceneName] = useState("Untitled experiment");
  const sceneNameRef = useRef(sceneName);
  sceneNameRef.current = sceneName;
  const [settings, setSettings] = useState<WorldSettings>(INITIAL_SETTINGS);
  const settingsRef = useRef<WorldSettings>(settings);
  settingsRef.current = settings;
  const [stats, setStats] = useState({ bodies: 0, links: 0, groups: 0, fps: 60, elapsed: 0, sensors: 0, x: 0, y: 0 });
  const [, setRevision] = useState(0);
  const [toast, setToast] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFilename, setVideoFilename] = useState("kinetic-render.webm");
  const [slots, setSlots] = useState<(SaveSlot | null)[]>(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(parsed)) return [0, 1, 2].map((index) => parsed[index] || null);
    } catch { /* Damaged or unavailable storage starts with empty slots. */ }
    return [null, null, null];
  });

  function notify(message: string) {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 3500);
  }

  function getBody(id: number) {
    const engine = engineRef.current;
    return engine ? Composite.get(engine.world, id, "body") as Matter.Body | null : null;
  }

  function getLink(id: number) {
    const engine = engineRef.current;
    return engine ? Composite.get(engine.world, id, "constraint") as Matter.Constraint | null : null;
  }

  function groupFor(body: Matter.Body) {
    const engine = engineRef.current;
    return engine ? Composite.allComposites(engine.world).find((group) => group !== engine.world && group.bodies.includes(body)) : undefined;
  }

  function serializeScene(): SavedScene {
    const engine = engineRef.current;
    if (!engine) throw new Error("The laboratory is not ready yet.");
    return {
      version: 1,
      name: sceneNameRef.current.trim() || "Untitled experiment",
      settings: { ...settingsRef.current, bounds: { ...settingsRef.current.bounds } },
      elapsed: elapsedRef.current,
      bodies: sceneBodies(engine).map(saveBody),
      links: sceneLinks(engine).map((link) => ({
        uid: linkMeta(link)!.uid,
        label: link.label,
        kind: linkMeta(link)!.kind,
        bodyA: link.bodyA ? metaOf(link.bodyA).uid : null,
        bodyB: link.bodyB ? metaOf(link.bodyB).uid : null,
        pointA: { ...(link.pointA || { x: 0, y: 0 }) },
        pointB: { ...(link.pointB || { x: 0, y: 0 }) },
        length: link.length,
        stiffness: link.stiffness,
        damping: link.damping,
      })),
      groups: Composite.allComposites(engine.world)
        .filter((group) => group !== engine.world && group.bodies.length > 0)
        .map((group) => ({ label: group.label, bodyUids: group.bodies.map((body) => metaOf(body).uid) })),
    };
  }

  function commitEdit() {
    setRevision((value) => value + 1);
    if (engineRef.current && !playingRef.current && !recordingRef.current) checkpointRef.current = serializeScene();
  }

  function rebuildBounds() {
    const engine = engineRef.current;
    if (!engine) return;
    for (const body of boundaryRef.current) Composite.remove(engine.world, body, true);
    boundaryRef.current = [];
    const { width, height } = sizeRef.current;
    const enabled = settingsRef.current.bounds;
    const add = (side: BoundSide, x: number, y: number, w: number, h: number) => {
      if (!enabled[side]) return;
      const wall = Bodies.rectangle(x, y, w, h, { isStatic: true, label: `${side} boundary`, friction: 0.6, restitution: 0.4 });
      setMeta(wall, { uid: `bound-${side}`, shape: "platform", color: "#263a46", boundary: true });
      boundaryRef.current.push(wall);
      Composite.add(engine.world, wall);
    };
    add("floor", width / 2, height - FLOOR_TOP + 70, width + 180, 140);
    add("left", -45, height / 2, 90, height + 180);
    add("right", width + 45, height / 2, 90, height + 180);
    add("ceiling", width / 2, -45, width + 180, 90);
  }

  function updateSettings(patch: Partial<WorldSettings>) {
    if (recordingRef.current) return;
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    const engine = engineRef.current;
    if (engine) {
      engine.gravity.x = next.gravityX;
      engine.gravity.y = next.gravityY;
      engine.timing.timeScale = next.timeScale;
      engine.enableSleeping = next.enableSleeping;
      if (!next.enableSleeping) sceneBodies(engine).forEach((body) => Sleeping.set(body, false));
    }
    if (patch.bounds) rebuildBounds();
    commitEdit();
  }

  function clearSelection() {
    selectedIdsRef.current = [];
    selectedConstraintRef.current = null;
    setSelectedIds([]);
    setSelectedConstraintId(null);
  }

  function selectBodies(ids: number[]) {
    selectedIdsRef.current = ids;
    selectedConstraintRef.current = null;
    setSelectedIds(ids);
    setSelectedConstraintId(null);
    if (ids.length) setTab("inspect");
  }

  function selectLink(id: number) {
    selectedIdsRef.current = [];
    selectedConstraintRef.current = id;
    setSelectedIds([]);
    setSelectedConstraintId(id);
    setTab("inspect");
  }

  function restoreScene(scene: SavedScene, makeCheckpoint = true) {
    const engine = engineRef.current;
    if (!engine || recordingRef.current) return;
    playingRef.current = false;
    setIsPlaying(false);
    const mc = mouseConstraintRef.current;
    if (mc) { mc.body = null as unknown as Matter.Body; mc.constraint.bodyB = null; mc.mouse.button = -1; }
    sceneLinks(engine).forEach((link) => Composite.remove(engine.world, link, true));
    sceneBodies(engine).forEach((body) => Composite.remove(engine.world, body, true));
    Composite.allComposites(engine.world).filter((group) => group !== engine.world)
      .forEach((group) => Composite.remove(engine.world, group, true));

    const lookup = new Map<string, Matter.Body>();
    for (const saved of scene.bodies) {
      const body = restoreBody(saved);
      Composite.add(engine.world, body);
      lookup.set(saved.uid, body);
    }
    for (const saved of scene.links) {
      const bodyA = saved.bodyA ? lookup.get(saved.bodyA) : undefined;
      const bodyB = saved.bodyB ? lookup.get(saved.bodyB) : undefined;
      if ((saved.bodyA && !bodyA) || (saved.bodyB && !bodyB)) continue;
      const link = Constraint.create({
        label: saved.label, bodyA, bodyB,
        pointA: { ...saved.pointA }, pointB: { ...saved.pointB },
        length: saved.length, stiffness: saved.stiffness, damping: saved.damping,
      });
      setLinkMeta(link, { uid: saved.uid, kind: saved.kind });
      Composite.add(engine.world, link);
    }
    for (const saved of scene.groups) {
      const members = saved.bodyUids.map((id) => lookup.get(id)).filter((body): body is Matter.Body => !!body);
      if (!members.length) continue;
      const group = Composite.create({ label: saved.label });
      Composite.add(engine.world, group);
      members.forEach((body) => { Composite.remove(engine.world, body, true); Composite.add(group, body); });
    }

    const next: WorldSettings = {
      ...INITIAL_SETTINGS, ...scene.settings,
      bounds: { ...INITIAL_SETTINGS.bounds, ...scene.settings.bounds },
    };
    settingsRef.current = next;
    setSettings(next);
    engine.gravity.x = next.gravityX;
    engine.gravity.y = next.gravityY;
    engine.timing.timeScale = next.timeScale;
    engine.enableSleeping = next.enableSleeping;
    if (!next.enableSleeping) sceneBodies(engine).forEach((body) => Sleeping.set(body, false));
    rebuildBounds();
    Engine.clear(engine);
    elapsedRef.current = scene.elapsed || 0;
    sceneNameRef.current = scene.name;
    setSceneName(scene.name);
    clearSelection();
    polygonRef.current = [];
    setPolygonCount(0);
    linkStartRef.current = null;
    setHasLinkStart(false);
    previousFrameRef.current.clear();
    setRevision((value) => value + 1);
    if (makeCheckpoint) checkpointRef.current = serializeScene();
  }

  function removeBodies(ids: number[]) {
    const engine = engineRef.current;
    if (!engine || recordingRef.current) return;
    const removeSet = new Set(ids);
    sceneLinks(engine).filter((link) => (link.bodyA && removeSet.has(link.bodyA.id)) || (link.bodyB && removeSet.has(link.bodyB.id)))
      .forEach((link) => Composite.remove(engine.world, link, true));
    ids.forEach((id) => {
      const body = getBody(id);
      if (body) Composite.remove(engine.world, body, true);
    });
    Composite.allComposites(engine.world).filter((group) => group !== engine.world && group.bodies.length === 0)
      .forEach((group) => Composite.remove(engine.world, group, true));
    clearSelection();
    commitEdit();
  }

  function deleteSelection() {
    if (recordingRef.current) return;
    if (selectedIdsRef.current.length) removeBodies(selectedIdsRef.current);
    else if (selectedConstraintRef.current !== null) {
      const link = getLink(selectedConstraintRef.current);
      if (link && engineRef.current) Composite.remove(engineRef.current.world, link, true);
      clearSelection();
      commitEdit();
    }
  }

  function duplicateSelected() {
    const engine = engineRef.current;
    if (!engine || recordingRef.current || !selectedIdsRef.current.length) return;
    const copies: Matter.Body[] = [];
    for (const id of selectedIdsRef.current) {
      const body = getBody(id);
      if (!body) continue;
      const saved = saveBody(body);
      saved.uid = uid();
      saved.label = `${body.label} copy`;
      saved.position = { x: saved.position.x + 28, y: saved.position.y - 28 };
      saved.velocity = { x: 0, y: 0 };
      saved.angularVelocity = 0;
      saved.isSleeping = false;
      const copy = restoreBody(saved);
      Composite.add(engine.world, copy);
      copies.push(copy);
    }
    if (copies.length) {
      selectBodies(copies.map((body) => body.id));
      commitEdit();
      notify(`${copies.length} object${copies.length === 1 ? "" : "s"} duplicated`);
    }
  }

  function groupSelected() {
    const engine = engineRef.current;
    if (!engine || recordingRef.current || selectedIdsRef.current.length < 2) return;
    const bodies = selectedIdsRef.current.map(getBody).filter((body): body is Matter.Body => !!body);
    const group = Composite.create({ label: `Group ${Composite.allComposites(engine.world).length + 1}` });
    Composite.add(engine.world, group);
    bodies.forEach((body) => { Composite.remove(engine.world, body, true); Composite.add(group, body); });
    Composite.allComposites(engine.world).filter((item) => item !== engine.world && item !== group && item.bodies.length === 0)
      .forEach((item) => Composite.remove(engine.world, item, true));
    commitEdit();
    notify("Objects grouped as a composite");
  }

  function ungroupSelected() {
    const engine = engineRef.current;
    if (!engine || recordingRef.current) return;
    const groups = new Set(selectedIdsRef.current.map((id) => getBody(id)).filter((body): body is Matter.Body => !!body)
      .map(groupFor).filter((group): group is Matter.Composite => !!group));
    groups.forEach((group) => {
      [...group.bodies].forEach((body) => Composite.move(group, [body], engine.world));
      Composite.remove(engine.world, group, true);
    });
    if (groups.size) { commitEdit(); notify("Composite ungrouped"); }
  }

  function nextColor() {
    return PALETTE[colorCounterRef.current++ % PALETTE.length];
  }

  function spawnShape(at: Vec, width?: number, height?: number) {
    const engine = engineRef.current;
    if (!engine || recordingRef.current) return;
    const kind = shapeRef.current;
    const defaults = kind === "circle" ? [86, 86] : kind === "hexagon" ? [96, 96] : kind === "trapezoid" ? [126, 86] : [124, 84];
    const w = width || defaults[0];
    const h = height || defaults[1];
    const size = kind === "circle" || kind === "hexagon" ? Math.max(w, h) : w;
    const body = makePrimitive(kind, at.x, at.y, size, h, nextColor(), `${kind.charAt(0).toUpperCase() + kind.slice(1)} ${labelCounterRef.current++}`);
    Composite.add(engine.world, body);
    selectBodies([body.id]);
    commitEdit();
  }

  function finishPolygon() {
    if (recordingRef.current) return;
    const points = polygonRef.current;
    if (points.length < 3) { notify("Place at least three points to close a polygon"); return; }
    const area = Math.abs(points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0)) / 2;
    if (area < 200) { notify("This polygon is too small. Spread the points apart."); return; }
    if (!decomp.isSimple(points.map((point: Vec) => [point.x, point.y]))) {
      notify("Edges cannot cross. Adjust the polygon and try again."); return;
    }
    const engine = engineRef.current;
    if (!engine) return;
    try {
      const center = {
        x: (Math.min(...points.map((p) => p.x)) + Math.max(...points.map((p) => p.x))) / 2,
        y: (Math.min(...points.map((p) => p.y)) + Math.max(...points.map((p) => p.y))) / 2,
      };
      const vertices = points.map((point) => ({ x: point.x - center.x, y: point.y - center.y }));
      const body = Bodies.fromVertices(center.x, center.y, [vertices], {
        label: `Polygon ${labelCounterRef.current++}`,
        friction: 0.24, frictionStatic: 0.75, frictionAir: 0.003, restitution: 0.56,
      }, true, 0.01, 4);
      if (!body || !Number.isFinite(body.position.x)) throw new Error("Invalid geometry");
      setMeta(body, { uid: uid(), shape: "custom", color: nextColor() });
      Composite.add(engine.world, body);
      polygonRef.current = [];
      setPolygonCount(0);
      setTool("select");
      toolRef.current = "select";
      selectBodies([body.id]);
      commitEdit();
      notify(body.parts.length > 1 ? "Concave polygon decomposed into rigid parts" : "Polygon added to scene");
    } catch { notify("Couldn't make that polygon. Try a simpler outline."); }
  }

  function changeTool(next: Tool) {
    if (recordingRef.current) return;
    toolRef.current = next;
    setTool(next);
    polygonRef.current = [];
    setPolygonCount(0);
    spawnRef.current = null;
    linkStartRef.current = null;
    setHasLinkStart(false);
    if (next === "shape" || next === "polygon" || next === "constraint") setTab("create");
  }

  function chooseShape(next: Shape) {
    shapeRef.current = next;
    setShape(next);
    changeTool("shape");
  }

  function chooseLinkKind(next: LinkKind) {
    linkKindRef.current = next;
    setLinkKind(next);
    changeTool("constraint");
  }

  function pickBody(point: Vec) {
    const engine = engineRef.current;
    if (!engine) return null;
    const found = Query.point(sceneBodies(engine), point);
    return found.length ? found[found.length - 1] : null;
  }

  function pickLink(point: Vec) {
    const engine = engineRef.current;
    if (!engine) return null;
    return [...sceneLinks(engine)].reverse().find((link) =>
      segmentDistance(point, Constraint.pointAWorld(link), Constraint.pointBWorld(link)) < 11) || null;
  }

  function createLink(start: LinkStart, end: Vec, target: Matter.Body | null) {
    const engine = engineRef.current;
    const first = getBody(start.bodyId);
    if (!engine || !first) return;
    const second = target && target.id !== first.id ? target : undefined;
    const kind = linkKindRef.current;
    const link = Constraint.create({
      label: `${kind.charAt(0).toUpperCase() + kind.slice(1)} ${sceneLinks(engine).length + 1}`,
      bodyA: first,
      pointA: { x: start.point.x - first.position.x, y: start.point.y - first.position.y },
      bodyB: second,
      pointB: second ? { x: end.x - second.position.x, y: end.y - second.position.y }
        : kind === "pivot" ? { ...start.point } : { ...end },
      length: kind === "pivot" ? 0 : distance(start.point, end),
      stiffness: kind === "spring" ? 0.025 : kind === "pivot" ? 0.88 : 0.95,
      damping: kind === "spring" ? 0.055 : 0.02,
    });
    setLinkMeta(link, { uid: uid(), kind });
    Composite.add(engine.world, link);
    selectLink(link.id);
    commitEdit();
    notify(kind === "pivot" ? "Revolving pivot placed" : `${kind === "spring" ? "Spring" : "Rigid link"} connected`);
  }

  function canvasPoint(event: ReactPointerEvent<HTMLCanvasElement>): Vec {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onCanvasDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 || recordingRef.current) return;
    event.currentTarget.focus();
    const point = canvasPoint(event);
    pointerRef.current = point;
    const currentTool = toolRef.current;
    if (currentTool === "shape") {
      spawnRef.current = { start: point, current: point };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (currentTool === "polygon") {
      if (polygonRef.current.length >= 3 && (distance(point, polygonRef.current[0]) < 16 || event.detail >= 2)) {
        finishPolygon(); return;
      }
      if (polygonRef.current.length >= 24) { notify("Use 24 points or fewer for a clean polygon"); return; }
      if (!polygonRef.current.length || distance(point, polygonRef.current[polygonRef.current.length - 1]) > 8) {
        polygonRef.current = [...polygonRef.current, point];
        setPolygonCount(polygonRef.current.length);
      }
      return;
    }
    const hit = pickBody(point);
    if (currentTool === "constraint") {
      if (!linkStartRef.current) {
        if (!hit) { notify("Click a body to start a connection"); return; }
        linkStartRef.current = { bodyId: hit.id, point };
        setHasLinkStart(true);
      } else {
        createLink(linkStartRef.current, point, hit);
        linkStartRef.current = null;
        setHasLinkStart(false);
      }
      return;
    }
    if (currentTool === "delete") {
      if (hit) removeBodies([hit.id]);
      else {
        const link = pickLink(point);
        if (link && engineRef.current) { Composite.remove(engineRef.current.world, link, true); clearSelection(); commitEdit(); }
      }
      return;
    }

    if (!playingRef.current && selectedIdsRef.current.length === 1) {
      const active = getBody(selectedIdsRef.current[0]);
      if (active) {
        const bounds = active.bounds;
        const resize = { x: bounds.max.x + 9, y: bounds.max.y + 9 };
        const rotation = { x: (bounds.min.x + bounds.max.x) / 2, y: bounds.min.y - 29 };
        if (distance(point, resize) < 15 || distance(point, rotation) < 15) {
          const isResize = distance(point, resize) < 15;
          editDragRef.current = {
            kind: isResize ? "resize" : "rotate", start: point, ids: [active.id], bodyId: active.id,
            bodyAngle: active.angle,
            pointerAngle: Math.atan2(point.y - active.position.y, point.x - active.position.x),
            startLocal: rotate({ x: point.x - active.position.x, y: point.y - active.position.y }, -active.angle),
            scaleX: 1, scaleY: 1,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }
      }
    }

    if (hit) {
      let ids: number[];
      if (event.shiftKey) {
        ids = selectedIdsRef.current.includes(hit.id)
          ? selectedIdsRef.current.filter((id) => id !== hit.id)
          : [...selectedIdsRef.current, hit.id];
      } else {
        const group = groupFor(hit);
        ids = group ? group.bodies.map((body) => body.id) : [hit.id];
      }
      selectBodies(ids);
      if (playingRef.current) event.currentTarget.setPointerCapture(event.pointerId);
      if (!playingRef.current && !event.shiftKey && ids.length) {
        editDragRef.current = {
          kind: "move", start: point, ids,
          positions: ids.map((id) => getBody(id)).filter((body): body is Matter.Body => !!body)
            .map((body) => ({ id: body.id, position: { ...body.position } })),
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    } else {
      const link = pickLink(point);
      if (link) selectLink(link.id);
      else if (!event.shiftKey) clearSelection();
    }
  }

  function onCanvasMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const point = canvasPoint(event);
    pointerRef.current = point;
    if (recordingRef.current) return;
    if (spawnRef.current) { spawnRef.current.current = point; return; }
    const drag = editDragRef.current;
    if (drag) {
      if (drag.kind === "move") {
        drag.positions?.forEach(({ id, position }) => {
          const body = getBody(id);
          if (body) {
            Sleeping.set(body, false);
            Body.setPosition(body, { x: position.x + point.x - drag.start.x, y: position.y + point.y - drag.start.y });
            Body.setVelocity(body, { x: 0, y: 0 });
          }
        });
      } else {
        const body = drag.bodyId !== undefined ? getBody(drag.bodyId) : null;
        if (body) {
          Sleeping.set(body, false);
          if (drag.kind === "rotate") {
            const angle = Math.atan2(point.y - body.position.y, point.x - body.position.x);
            Body.setAngle(body, (drag.bodyAngle || 0) + angle - (drag.pointerAngle || 0));
            Body.setAngularVelocity(body, 0);
          } else if (drag.startLocal) {
            const local = rotate({ x: point.x - body.position.x, y: point.y - body.position.y }, -(drag.bodyAngle || 0));
            const sx = clamp(Math.abs(local.x / (drag.startLocal.x || 1)), 0.25, 4);
            const sy = clamp(Math.abs(local.y / (drag.startLocal.y || 1)), 0.25, 4);
            const uniform = metaOf(body).shape === "circle" || metaOf(body).shape === "hexagon" || metaOf(body).shape === "custom";
            const targetX = uniform ? Math.max(sx, sy) : sx;
            const targetY = uniform ? targetX : sy;
            Body.scale(body, targetX / (drag.scaleX || 1), targetY / (drag.scaleY || 1));
            drag.scaleX = targetX;
            drag.scaleY = targetY;
          }
        }
      }
      setRevision((value) => value + 1);
      return;
    }
    hoverRef.current = pickBody(point)?.id ?? null;
  }

  function onCanvasUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (recordingRef.current) return;
    const point = canvasPoint(event);
    if (spawnRef.current) {
      const start = spawnRef.current.start;
      const dx = Math.abs(point.x - start.x);
      const dy = Math.abs(point.y - start.y);
      const dragged = Math.hypot(dx, dy) > 14;
      spawnRef.current = null;
      spawnShape(dragged ? { x: (start.x + point.x) / 2, y: (start.y + point.y) / 2 } : start,
        dragged ? Math.max(30, dx) : undefined, dragged ? Math.max(30, dy) : undefined);
    }
    if (editDragRef.current) { editDragRef.current = null; commitEdit(); }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function onCanvasCancel(event: ReactPointerEvent<HTMLCanvasElement>) {
    spawnRef.current = null;
    if (editDragRef.current) { editDragRef.current = null; commitEdit(); }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function changeSelectedBody(mutate: (body: Matter.Body) => void) {
    if (recordingRef.current || selectedIdsRef.current.length !== 1) return;
    const body = getBody(selectedIdsRef.current[0]);
    if (!body) return;
    mutate(body);
    commitEdit();
  }

  function changeSelectedLink(mutate: (link: Matter.Constraint) => void) {
    if (recordingRef.current || selectedConstraintRef.current === null) return;
    const link = getLink(selectedConstraintRef.current);
    if (!link) return;
    mutate(link);
    commitEdit();
  }

  function setPlaying(next: boolean) {
    if (recordingRef.current || !engineRef.current) return;
    if (next && !playingRef.current) checkpointRef.current = serializeScene();
    playingRef.current = next;
    setIsPlaying(next);
  }

  function stepFrame() {
    const engine = engineRef.current;
    if (!engine || playingRef.current || recordingRef.current) return;
    const config = settingsRef.current;
    for (let i = 0; i < config.ccdSteps; i++) Engine.update(engine, STEP / config.ccdSteps);
    elapsedRef.current += STEP * engine.timing.timeScale;
    setRevision((value) => value + 1);
  }

  function resetSimulation() {
    if (recordingRef.current || !checkpointRef.current) return;
    restoreScene(checkpointRef.current, false);
    notify("Simulation restored to its last starting point");
  }

  function startRecording() {
    const canvas = canvasRef.current;
    if (!canvas || recordingRef.current) return;
    if (typeof MediaRecorder === "undefined" || typeof canvas.captureStream !== "function") {
      notify("Video recording is not supported in this browser"); return;
    }
    try {
      const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
      const mimeType = types.find((type) => MediaRecorder.isTypeSupported(type));
      const stream = canvas.captureStream(60);
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 5_000_000 } : undefined);
      const chunks: BlobPart[] = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        if (!chunks.length) { notify("No video frames were captured. Try a longer run."); return; }
        const type = recorder.mimeType || mimeType || "video/webm";
        const blob = new Blob(chunks, { type });
        if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
        const url = URL.createObjectURL(blob);
        videoUrlRef.current = url;
        setVideoUrl(url);
        const anchor = document.createElement("a");
        anchor.href = url;
        const filename = `${(sceneNameRef.current || "kinetic-scene").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-render.${type.includes("mp4") ? "mp4" : "webm"}`;
        anchor.download = filename;
        setVideoFilename(filename);
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
        notify("Interpolated video is ready and downloading");
      };
      recorder.onerror = () => { stopRecording(); notify("Video capture stopped unexpectedly"); };
      checkpointRef.current = serializeScene();
      clearSelection();
      previousFrameRef.current = new Map(sceneBodies(engineRef.current!).map((body) =>
        [body.id, { x: body.position.x, y: body.position.y, angle: body.angle }]));
      recorder.start(1000);
      recordingRef.current = true;
      playingRef.current = true;
      setIsRecording(true);
      setIsPlaying(true);
      notify("Recording 60 FPS interpolated video. Editing is locked.");
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      notify("Could not start recording on this device");
    }
  }

  function stopRecording() {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    playingRef.current = false;
    setIsRecording(false);
    setIsPlaying(false);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function saveSlot(index: number) {
    if (recordingRef.current || !engineRef.current) return;
    const entry: SaveSlot = { name: sceneNameRef.current.trim() || "Untitled experiment", savedAt: new Date().toISOString(), scene: serializeScene() };
    const next = [...slots];
    next[index] = entry;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSlots(next);
      notify(`Saved to slot ${String(index + 1).padStart(2, "0")}`);
    } catch { notify("Storage is full or unavailable. Export a JSON copy instead."); }
  }

  function loadSlot(index: number) {
    const entry = slots[index];
    if (!entry || recordingRef.current) return;
    try { restoreScene(entry.scene); notify(`Loaded ${entry.name}`); setTab("files"); }
    catch { notify("This slot could not be loaded"); }
  }

  function deleteSlot(index: number) {
    if (recordingRef.current) return;
    const next = [...slots];
    next[index] = null;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setSlots(next); notify("Save slot cleared"); }
    catch { notify("Could not update local storage"); }
  }

  function exportJson() {
    if (recordingRef.current || !engineRef.current) return;
    const blob = new Blob([JSON.stringify(serializeScene(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(sceneNameRef.current || "kinetic-scene").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Scene JSON exported");
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || recordingRef.current) return;
    if (file.size > 2_000_000) { notify("That file is too large for a scene"); return; }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || (parsed as SavedScene).version !== 1 ||
        !Array.isArray((parsed as SavedScene).bodies) || !Array.isArray((parsed as SavedScene).links) ||
        !Array.isArray((parsed as SavedScene).groups) || !(parsed as SavedScene).settings) throw new Error("Invalid scene");
      restoreScene(parsed as SavedScene);
      notify("Scene imported successfully");
    } catch { notify("Invalid scene file. Use a Kinetic JSON export."); }
  }

  function newScene() {
    if (recordingRef.current) return;
    restoreScene({ version: 1, name: "Untitled experiment", settings: settingsRef.current, elapsed: 0, bodies: [], links: [], groups: [] });
    setTab("create");
    notify("New blank scene ready");
  }

  function loadDemo() {
    const engine = engineRef.current;
    if (!engine || recordingRef.current) return;
    restoreScene({ version: 1, name: "Untitled experiment", settings: INITIAL_SETTINGS, elapsed: 0, bodies: [], links: [], groups: [] }, false);
    seedScene(engine, sizeRef.current.width, sizeRef.current.height);
    checkpointRef.current = serializeScene();
    setTab("create");
    setRevision((value) => value + 1);
    notify("Starter scene restored");
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !viewport || !context) return;
    const engine = Engine.create({ enableSleeping: true, positionIterations: 8, velocityIterations: 8, constraintIterations: 4 });
    engine.gravity.x = settingsRef.current.gravityX;
    engine.gravity.y = settingsRef.current.gravityY;
    engine.timing.timeScale = settingsRef.current.timeScale;
    engineRef.current = engine;
    const mouse = Mouse.create(canvas);
    const mc = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.18, damping: 0.13, render: { visible: false } },
    });
    mc.collisionFilter.mask = 0;
    mouseConstraintRef.current = mc;
    Composite.add(engine.world, mc);
    let seeded = false;
    const resize = () => {
      const rect = viewport.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;
      const width = rect.width;
      const height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      mouse.pixelRatio = dpr;
      sizeRef.current = { width, height, dpr };
      rebuildBounds();
      if (!seeded) {
        seedScene(engine, width, height);
        seeded = true;
        checkpointRef.current = serializeScene();
        setRevision((value) => value + 1);
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    resize();

    const onCollision = (event: unknown) => {
      const pairs = (event as { pairs: { bodyA: Matter.Body; bodyB: Matter.Body }[] }).pairs;
      for (const pair of pairs) {
        if (pair.bodyA.isSensor) flashesRef.current.set(pair.bodyA.id, performance.now() + 450);
        if (pair.bodyB.isSensor) flashesRef.current.set(pair.bodyB.id, performance.now() + 450);
      }
    };
    Events.on(engine, "collisionStart", onCollision);

    let frameId = 0;
    let lastTime = performance.now();
    let lastStats = 0;
    let accumulator = 0;
    let smoothDelta = STEP;
    const frame = (now: number) => {
      const delta = Math.min(55, Math.max(0, now - lastTime));
      lastTime = now;
      smoothDelta = smoothDelta * 0.88 + (delta || STEP) * 0.12;
      if (playingRef.current) {
        const physicsStep = recordingRef.current ? STEP * 2 : STEP;
        accumulator += delta * settingsRef.current.speed;
        let iterations = 0;
        while (accumulator >= physicsStep && iterations < 5) {
          if (recordingRef.current) {
            previousFrameRef.current = new Map(sceneBodies(engine).map((body) =>
              [body.id, { x: body.position.x, y: body.position.y, angle: body.angle }]));
          }
          const config = settingsRef.current;
          const fastBody = config.ccdSteps > 1 && sceneBodies(engine).some((body) =>
            !body.isStatic && Math.hypot(body.velocity.x, body.velocity.y) * (physicsStep / STEP) > config.ccdThreshold);
          const substeps = fastBody ? config.ccdSteps : 1;
          for (let i = 0; i < substeps; i++) Engine.update(engine, physicsStep / substeps);
          elapsedRef.current += physicsStep * engine.timing.timeScale;
          accumulator -= physicsStep;
          iterations++;
        }
        if (iterations === 5) accumulator = Math.min(accumulator, physicsStep);
      } else {
        accumulator = 0;
        previousFrameRef.current.clear();
      }
      const size = sizeRef.current;
      drawScene(context, engine, size.width, size.height, size.dpr, {
        settings: settingsRef.current,
        selectedIds: selectedIdsRef.current,
        selectedConstraintId: selectedConstraintRef.current,
        hoverId: hoverRef.current,
        polygon: polygonRef.current,
        spawn: spawnRef.current,
        link: linkStartRef.current,
        pointer: pointerRef.current,
        flashes: flashesRef.current,
        previous: recordingRef.current ? previousFrameRef.current : null,
        alpha: recordingRef.current ? clamp(accumulator / (STEP * 2), 0, 1) : 1,
        editableHandles: !playingRef.current,
      });
      if (now - lastStats > 240) {
        lastStats = now;
        for (const [id, until] of flashesRef.current) if (until <= now) flashesRef.current.delete(id);
        setStats({
          bodies: sceneBodies(engine).length,
          links: sceneLinks(engine).length,
          groups: Composite.allComposites(engine.world).filter((group) => group !== engine.world).length,
          fps: Math.min(99, Math.round(1000 / Math.max(smoothDelta, 1))),
          elapsed: elapsedRef.current,
          sensors: flashesRef.current.size,
          x: pointerRef.current.x, y: pointerRef.current.y,
        });
        if (playingRef.current && selectedIdsRef.current.length) setRevision((value) => value + 1);
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameId);
      Events.off(engine, "collisionStart", onCollision);
      if (recorderRef.current) recorderRef.current.onstop = null;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      Engine.clear(engine);
      engineRef.current = null;
      mouseConstraintRef.current = null;
    };
  }, []);

  useEffect(() => {
    const mc = mouseConstraintRef.current;
    if (!mc) return;
    const enabled = isPlaying && tool === "select" && !isRecording;
    mc.collisionFilter.mask = enabled ? -1 : 0;
    if (!enabled) {
      mc.body = null as unknown as Matter.Body;
      mc.constraint.bodyB = null;
      mc.mouse.button = -1;
    }
  }, [tool, isPlaying, isRecording]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (recordingRef.current) return;
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName) || target.isContentEditable) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelected(); return; }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveSlot(0); return; }
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteSelection(); return; }
      if (event.key === " ") { event.preventDefault(); setPlaying(!playingRef.current); return; }
      if (event.key === "Enter" && toolRef.current === "polygon") { event.preventDefault(); finishPolygon(); return; }
      if (event.key === "Escape") {
        polygonRef.current = []; setPolygonCount(0);
        linkStartRef.current = null; setHasLinkStart(false);
        spawnRef.current = null;
        changeTool("select"); return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        const shortcuts: Record<string, Tool> = { v: "select", b: "shape", p: "polygon", l: "constraint", x: "delete" };
        if (shortcuts[event.key.toLowerCase()]) changeTool(shortcuts[event.key.toLowerCase()]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const selectedBodies = selectedIds.map(getBody).filter((body): body is Matter.Body => !!body);
  const selectedBody = selectedBodies.length === 1 ? selectedBodies[0] : null;
  const selectedLink = selectedConstraintId !== null ? getLink(selectedConstraintId) : null;
  const selectedGroup = selectedBody ? groupFor(selectedBody) : undefined;
  const dimensions = selectedBody ? localSize(selectedBody) : null;

  // The interface and its CSS are kept here so Vite emits one self-contained HTML file.
  return (
    <>
      <style>{STYLES}</style>
      <div className="studio-shell">
        <header className="topbar">
          <div className="brand" aria-label="Kinetic physics workbench">
            <span className="brand-mark"><i /><i /><i /></span>
            <span className="brand-copy"><strong>kinetic<span>.</span></strong><small>PHYSICS WORKBENCH</small></span>
          </div>

          <div className="transport" aria-label="Simulation controls">
            <button className="transport-icon" onClick={resetSimulation} disabled={isRecording} title="Reset to last starting point" aria-label="Reset simulation"><RotateCcw size={17} /></button>
            <button className="transport-icon" onClick={stepFrame} disabled={isPlaying || isRecording} title="Advance one physics frame" aria-label="Step one frame"><StepForward size={18} /></button>
            <span className="transport-divider" />
            <button className={`play-button ${isPlaying ? "playing" : ""}`} onClick={() => setPlaying(!isPlaying)} disabled={isRecording}>
              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              <span>{isPlaying ? "Pause" : "Play"}</span>
            </button>
            <span className="time-display">{formatTime(stats.elapsed)}</span>
          </div>

          <div className="header-right">
            <div className="project-title"><small>CURRENT SCENE</small><strong>{sceneName}</strong></div>
            <button className={`record-button ${isRecording ? "is-recording" : ""}`} onClick={isRecording ? stopRecording : startRecording}>
              {isRecording ? <span className="stop-square" /> : <Video size={17} strokeWidth={2.1} />}
              <span>{isRecording ? "Stop & export" : "Run interpolation"}</span>
            </button>
          </div>
        </header>

        <main className="workspace">
          <section className="viewport" ref={viewportRef} aria-label="Interactive physics canvas">
            <canvas ref={canvasRef} className={`physics-canvas tool-${tool}`} tabIndex={0}
              onPointerDown={onCanvasDown} onPointerMove={onCanvasMove} onPointerUp={onCanvasUp}
              onPointerCancel={onCanvasCancel} onPointerLeave={() => { if (!editDragRef.current) hoverRef.current = null; }}
              aria-label="Physics sandbox. Use tools to create and manipulate objects." />

            <div className="stage-intro">
              <span className="stage-kicker"><span className="kicker-line" /> OPEN PLAYGROUND / 001</span>
              <h1>Ideas in motion<span>.</span></h1>
              <p>{tool === "polygon" ? "Click to place vertices. Close the outline to create a body."
                : tool === "constraint" ? "Click a body, then click another body or empty space."
                  : tool === "shape" ? "Click to drop a shape, or drag to give it a size."
                    : tool === "delete" ? "Click any object or connection to remove it."
                      : "Select, drag, and see what happens."}</p>
            </div>

            <div className="stage-view-control">
              <button onClick={() => updateSettings({ showGrid: !settings.showGrid })} disabled={isRecording} title="Toggle canvas grid">
                <Grid2X2 size={15} /><span>Grid {settings.showGrid ? "on" : "off"}</span>
              </button>
              <span className="view-separator" />
              <span className="view-label">2D VIEW</span>
            </div>

            <div className="tool-rail" role="toolbar" aria-label="Canvas tools">
              {([
                { id: "select" as Tool, name: "Select / move (V)", Icon: MousePointer2 },
                { id: "shape" as Tool, name: "Spawn shape (B)", Icon: Square },
                { id: "polygon" as Tool, name: "Draw polygon (P)", Icon: Pentagon },
                { id: "constraint" as Tool, name: "Create connection (L)", Icon: Link2 },
                { id: "delete" as Tool, name: "Delete tool (X)", Icon: Trash2 },
              ]).map(({ id, name, Icon }, index) => (
                <div className={index === 4 ? "tool-with-divider" : ""} key={id}>
                  <button className={`tool-button ${tool === id ? "active" : ""}`} onClick={() => changeTool(id)}
                    disabled={isRecording} title={name} aria-label={name} aria-pressed={tool === id}><Icon size={19} strokeWidth={tool === id ? 2.3 : 1.9} /></button>
                </div>
              ))}
            </div>

            {tool === "polygon" && polygonCount > 0 && !isRecording && (
              <div className="canvas-action">
                <span><Pentagon size={16} /> {polygonCount} point{polygonCount === 1 ? "" : "s"} placed</span>
                <button onClick={finishPolygon} disabled={polygonCount < 3}>Close polygon <ArrowUpRight size={15} /></button>
                <button className="canvas-action-close" onClick={() => { polygonRef.current = []; setPolygonCount(0); }} title="Cancel polygon" aria-label="Cancel polygon"><X size={16} /></button>
              </div>
            )}
            {tool === "constraint" && hasLinkStart && !isRecording && (
              <div className="canvas-action link-action">
                <span><Link2 size={16} /> Choose the second endpoint</span>
                <button className="canvas-action-close" onClick={() => { linkStartRef.current = null; setHasLinkStart(false); }} title="Cancel connection" aria-label="Cancel connection"><X size={16} /></button>
              </div>
            )}

            {isRecording && <div className="record-lock" aria-live="polite"><span className="record-lock-badge"><span className="record-dot" /> CAPTURING 60 FPS</span><span><LockKeyhole size={14} /> Editing locked during interpolation</span></div>}

            <div className="stage-bottom">
              <div className="simulation-state"><span className={`live-dot ${isPlaying ? "on" : ""} ${isRecording ? "capturing" : ""}`} />{isRecording ? "RENDERING VIDEO" : isPlaying ? "SIMULATION RUNNING" : "SIMULATION PAUSED"}</div>
              <div className="stage-counts"><span>{String(stats.bodies).padStart(2, "0")} BODIES</span><span className="metric-dot" /><span>{String(stats.links).padStart(2, "0")} LINKS</span>{stats.groups > 0 && <><span className="metric-dot" /><span>{stats.groups} GROUPS</span></>}{stats.sensors > 0 && <><span className="metric-dot" /><span>{stats.sensors} TRIGGERS</span></>}</div>
              <div className="stage-coordinates"><span>X {Math.round(stats.x)} / Y {Math.round(stats.y)}</span><span className="metric-dot" /><span>{stats.fps} FPS</span></div>
            </div>
            {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
          </section>

          <aside className="side-panel" aria-label="Physics controls and inspector">
            <nav className="panel-tabs" aria-label="Control panel tabs">
              {([
                { id: "create" as PanelTab, label: "Create", Icon: Plus },
                { id: "inspect" as PanelTab, label: "Inspect", Icon: SlidersHorizontal },
                { id: "world" as PanelTab, label: "World", Icon: Settings2 },
                { id: "files" as PanelTab, label: "Files", Icon: Save },
              ]).map(({ id, label, Icon }) => (
                <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}>
                  <Icon size={16} strokeWidth={1.9} /><span>{label}</span>{id === "inspect" && selectedIds.length + (selectedConstraintId !== null ? 1 : 0) > 0 && <i />}
                </button>
              ))}
            </nav>

            <div className="panel-scroll" key={tab}>
              <fieldset className="panel-fieldset" disabled={isRecording}>
                {tab === "create" && <>
                  <div className="panel-heading"><span className="overline">OBJECT LIBRARY</span><h2>Build your scene<span>.</span></h2><p>Pick a shape, then click or drag anywhere on the canvas to place it.</p></div>
                  <div className="section-heading"><span>PRIMITIVES</span><small>01 / SHAPES</small></div>
                  <div className="shape-grid">
                    {([
                      { id: "rectangle" as Shape, label: "Rectangle", number: "01", Icon: Square, color: "mint" },
                      { id: "circle" as Shape, label: "Circle", number: "02", Icon: Circle, color: "coral" },
                      { id: "trapezoid" as Shape, label: "Trapezoid", number: "03", Icon: Grip, color: "yellow" },
                      { id: "hexagon" as Shape, label: "Hexagon", number: "04", Icon: Pentagon, color: "lilac" },
                    ]).map(({ id, label, number, Icon, color }) => (
                      <button key={id} className={`shape-option ${tool === "shape" && shape === id ? "active" : ""}`} onClick={() => chooseShape(id)} aria-pressed={tool === "shape" && shape === id}>
                        <span className={`shape-art ${color}`}>{id === "trapezoid" ? <span className="trapezoid-art" /> : <Icon size={36} strokeWidth={1.55} />}</span>
                        <span className="shape-name">{label}</span><span className="shape-number">{number}</span>
                      </button>
                    ))}
                  </div>
                  <button className="drop-button" onClick={() => spawnShape({ x: sizeRef.current.width * 0.5, y: sizeRef.current.height * 0.3 })}>
                    <Plus size={17} /> Drop a {shape} in the canvas <ArrowUpRight size={16} />
                  </button>

                  <div className="section-heading section-spaced"><span>CUSTOM GEOMETRY</span><small>02 / DRAW</small></div>
                  <button className={`feature-row ${tool === "polygon" ? "active" : ""}`} onClick={() => changeTool("polygon")}>
                    <span className="feature-icon polygon-icon"><Pentagon size={21} /></span>
                    <span className="feature-copy"><strong>Draw a polygon</strong><small>Convex or concave, point by point</small></span>
                    <ArrowUpRight size={17} />
                  </button>
                  {tool === "polygon" && <p className="inline-instruction">Click to add vertices. Click the first point or press Enter to finish.</p>}

                  <div className="section-heading section-spaced"><span>CONNECTIONS</span><small>03 / LINK</small></div>
                  <div className="connection-list">
                    {([
                      { id: "rigid" as LinkKind, label: "Rigid link", detail: "Fixed distance", Icon: Link2 },
                      { id: "spring" as LinkKind, label: "Elastic spring", detail: "Stretch and rebound", Icon: Grip },
                      { id: "pivot" as LinkKind, label: "Revolving pivot", detail: "Rotate around a point", Icon: CircleDot },
                    ]).map(({ id, label, detail, Icon }) => (
                      <button key={id} className={`connection-row ${tool === "constraint" && linkKind === id ? "active" : ""}`} onClick={() => chooseLinkKind(id)} aria-pressed={tool === "constraint" && linkKind === id}>
                        <span className="connection-icon"><Icon size={20} strokeWidth={1.7} /></span>
                        <span><strong>{label}</strong><small>{detail}</small></span>
                        <span className="connection-arrow"><ArrowUpRight size={16} /></span>
                      </button>
                    ))}
                  </div>
                  <p className="panel-note">Select a connection, then click two endpoints. Click empty space for a world anchor.</p>
                </>}

                {tab === "inspect" && !selectedBody && selectedBodies.length === 0 && !selectedLink && <>
                  <div className="panel-heading"><span className="overline">OBJECT INSPECTOR</span><h2>The details<span>.</span></h2><p>Every object has a story. Select one on the canvas to see its physics.</p></div>
                  <div className="empty-inspector"><div className="empty-orbit"><span /><span /><span /></div><h3>Nothing selected yet</h3><p>Click any shape or connection to edit its transform, material, and behavior.</p><button onClick={() => setTab("create")}>Explore shapes <ArrowUpRight size={16} /></button></div>
                  <div className="shortcut-list"><div><span>Select multiple</span><kbd>SHIFT + CLICK</kbd></div><div><span>Duplicate selection</span><kbd>CTRL / CMD + D</kbd></div><div><span>Play or pause</span><kbd>SPACE</kbd></div></div>
                </>}

                {tab === "inspect" && selectedBodies.length > 1 && <>
                  <div className="panel-heading"><span className="overline">MULTI-SELECTION</span><h2>{selectedBodies.length} objects<span>.</span></h2><p>Selected together for quick actions and composite grouping.</p></div>
                  <div className="selection-list">{selectedBodies.map((body) => <div key={body.id}><span className="object-swatch" style={{ background: metaOf(body).color }} /><span>{body.label}</span><small>#{body.id}</small></div>)}</div>
                  <div className="multi-actions"><button className="primary-action" onClick={groupSelected}><Layers3 size={17} /> Group as composite</button><button onClick={duplicateSelected}><Copy size={16} /> Duplicate all</button>{selectedBodies.some((body) => !!groupFor(body)) && <button onClick={ungroupSelected}><Layers3 size={16} /> Ungroup</button>}<button className="danger-text" onClick={deleteSelection}><Trash2 size={16} /> Delete selected</button></div>
                  <p className="panel-note">Composites keep objects organized. Their bodies remain independently simulated. Drag a group together while paused.</p>
                </>}

                {tab === "inspect" && selectedLink && <>
                  <div className="panel-heading"><span className="overline">CONNECTION INSPECTOR</span><h2>Stay connected<span>.</span></h2><p>Fine-tune how this joint behaves in the simulation.</p></div>
                  <div className="selected-object"><span className="selected-object-icon"><Link2 size={22} /></span><span><strong>{selectedLink.label}</strong><small>CONSTRAINT #{selectedLink.id}</small></span></div>
                  <div className="section-heading section-spaced"><span>CONNECTION</span><small>MATTER.CONSTRAINT</small></div>
                  <label className="select-field"><span>Behavior</span><span className="select-wrap"><select value={linkMeta(selectedLink)?.kind || "rigid"} onChange={(event) => changeSelectedLink((link) => {
                    const next = event.target.value as LinkKind;
                    setLinkMeta(link, { uid: linkMeta(link)?.uid || uid(), kind: next });
                    link.stiffness = next === "spring" ? 0.025 : next === "pivot" ? 0.88 : 0.95;
                    link.damping = next === "spring" ? 0.055 : 0.02;
                    if (next === "pivot") link.length = 0;
                  })}><option value="rigid">Rigid link</option><option value="spring">Elastic spring</option><option value="pivot">Revolving pivot</option></select><ChevronDown size={15} /></span></label>
                  <div className="endpoint-list"><div><span>FROM</span><strong>{selectedLink.bodyA?.label || "World anchor"}</strong></div><div><span>TO</span><strong>{selectedLink.bodyB?.label || "World anchor"}</strong></div></div>
                  <div className="section-heading section-spaced"><span>JOINT PROPERTIES</span><small>LIVE EDIT</small></div>
                  <NumberField label="Rest length" value={selectedLink.length} min={0} max={2000} step={1} suffix="px" onChange={(value) => changeSelectedLink((link) => { link.length = value; })} />
                  <RangeRow label="Stiffness" value={selectedLink.stiffness} min={0.001} max={1} step={0.001} digits={3} onChange={(value) => changeSelectedLink((link) => { link.stiffness = value; })} />
                  <RangeRow label="Damping" value={selectedLink.damping} min={0} max={1} step={0.005} digits={3} onChange={(value) => changeSelectedLink((link) => { link.damping = value; })} />
                  <button className="delete-object" onClick={deleteSelection}><Trash2 size={16} /> Delete connection</button>
                </>}

                {tab === "inspect" && selectedBody && dimensions && <>
                  <div className="panel-heading compact-heading"><span className="overline">OBJECT INSPECTOR / #{selectedBody.id}</span><h2>Make it yours<span>.</span></h2><p>Changes apply to the live Matter.js body.</p></div>
                  <div className="selected-object"><span className="selected-object-icon" style={{ background: metaOf(selectedBody).color }}><span className={`mini-shape ${metaOf(selectedBody).shape}`} /></span><span className="selected-object-fields"><input aria-label="Object name" value={selectedBody.label} maxLength={40} onChange={(event) => changeSelectedBody((body) => { body.label = event.target.value; })} /><small>{metaOf(selectedBody).shape.toUpperCase()} {selectedGroup ? `/ ${selectedGroup.label.toUpperCase()}` : "/ RIGID BODY"}</small></span></div>
                  <div className="object-actions"><button onClick={duplicateSelected} title="Duplicate object"><Copy size={15} /> Duplicate</button>{selectedGroup && <button onClick={ungroupSelected} title="Ungroup composite"><Layers3 size={15} /> Ungroup</button>}<button className="remove-action" onClick={deleteSelection} title="Delete object"><Trash2 size={16} /></button></div>

                  <div className="section-heading section-spaced"><span>TRANSFORM</span><small>PX / DEGREES</small></div>
                  <div className="field-grid"><NumberField label="Position X" value={selectedBody.position.x} step={1} onChange={(value) => changeSelectedBody((body) => Body.setPosition(body, { x: value, y: body.position.y }))} /><NumberField label="Position Y" value={selectedBody.position.y} step={1} onChange={(value) => changeSelectedBody((body) => Body.setPosition(body, { x: body.position.x, y: value }))} />
                    <NumberField label="Width" value={dimensions.width} min={12} max={900} step={1} onChange={(value) => changeSelectedBody((body) => { const ratio = value / localSize(body).width; Body.scale(body, ratio, metaOf(body).shape === "circle" || metaOf(body).shape === "hexagon" ? ratio : 1); })} />
                    <NumberField label="Height" value={dimensions.height} min={12} max={900} step={1} onChange={(value) => changeSelectedBody((body) => { const ratio = value / localSize(body).height; Body.scale(body, metaOf(body).shape === "circle" || metaOf(body).shape === "hexagon" ? ratio : 1, ratio); })} />
                  </div>
                  <NumberField label="Rotation" value={selectedBody.angle * 180 / Math.PI} min={-3600} max={3600} step={1} suffix="deg" onChange={(value) => changeSelectedBody((body) => Body.setAngle(body, value * Math.PI / 180))} />
                  <div className="swatch-row"><span>COLOR</span><div>{PALETTE.map((color) => <button key={color} className={metaOf(selectedBody).color === color ? "active" : ""} style={{ background: color }} title={`Set color ${color}`} aria-label={`Set color ${color}`} onClick={() => changeSelectedBody((body) => setMeta(body, { ...metaOf(body), color }))} />)}</div></div>

                  <div className="section-heading section-spaced"><span>MATERIAL</span><small>PHYSICS PROPERTIES</small></div>
                  <RangeRow label="Mass" value={selectedBody.isStatic ? 0.1 : selectedBody.mass} min={0.1} max={100} step={0.1} digits={1} displayValue={selectedBody.isStatic ? "Fixed" : undefined} onChange={(value) => changeSelectedBody((body) => Body.setMass(body, value))} disabled={selectedBody.isStatic} />
                  <RangeRow label="Density" value={selectedBody.isStatic ? 0.0001 : selectedBody.density} min={0.0001} max={0.02} step={0.0001} digits={4} displayValue={selectedBody.isStatic ? "Fixed" : undefined} onChange={(value) => changeSelectedBody((body) => Body.setDensity(body, value))} disabled={selectedBody.isStatic} />
                  <RangeRow label="Bounce / restitution" value={selectedBody.restitution} min={0} max={1} step={0.01} onChange={(value) => changeSelectedBody((body) => { body.restitution = value; })} />
                  <RangeRow label="Kinetic friction" value={selectedBody.friction} min={0} max={1} step={0.01} onChange={(value) => changeSelectedBody((body) => { body.friction = value; })} />
                  <RangeRow label="Static friction" value={selectedBody.frictionStatic} min={0} max={2} step={0.01} onChange={(value) => changeSelectedBody((body) => { body.frictionStatic = value; })} />
                  <RangeRow label="Air resistance" value={selectedBody.frictionAir} min={0} max={0.1} step={0.001} digits={3} onChange={(value) => changeSelectedBody((body) => { body.frictionAir = value; })} />

                  <details className="advanced-details"><summary><span>COLLISION & STATE</span><ChevronDown size={16} /></summary><div className="advanced-content">
                    <ToggleRow label="Static body" description="Stays fixed in the world" checked={selectedBody.isStatic} onChange={(checked) => changeSelectedBody((body) => Body.setStatic(body, checked))} />
                    <ToggleRow label="Sensor / trigger" description="Detects contact without a collision response" checked={selectedBody.isSensor} onChange={(checked) => changeSelectedBody((body) => { body.isSensor = checked; })} />
                    <ToggleRow label="Sleeping" description="Temporarily stops simulating this body" checked={selectedBody.isSleeping} disabled={selectedBody.isStatic || !settings.enableSleeping} onChange={(checked) => changeSelectedBody((body) => Sleeping.set(body, checked))} />
                    <NumberField label="Sleep threshold" value={selectedBody.sleepThreshold} min={1} max={600} onChange={(value) => changeSelectedBody((body) => { body.sleepThreshold = value; })} />
                    <div className="subsection-label">COLLISION FILTER</div>
                    <label className="select-field"><span>Category</span><span className="select-wrap"><select value={selectedBody.collisionFilter.category ?? 1} onChange={(event) => changeSelectedBody((body) => { body.collisionFilter.category = Number(event.target.value); })}>{CATEGORY_OPTIONS.map((option) => <option key={option.bit} value={option.bit}>{option.name} (0x{option.bit.toString(16).padStart(4, "0")})</option>)}</select><ChevronDown size={15} /></span></label>
                    <div className="mask-label">COLLIDES WITH</div>
                    <div className="mask-grid">{CATEGORY_OPTIONS.map((option) => <label key={option.bit}><input type="checkbox" checked={!!((selectedBody.collisionFilter.mask ?? -1) & option.bit)} onChange={(event) => changeSelectedBody((body) => { body.collisionFilter.mask = event.target.checked ? (body.collisionFilter.mask ?? -1) | option.bit : (body.collisionFilter.mask ?? -1) & ~option.bit; })} /><span>{option.name}</span></label>)}</div>
                    <NumberField label="Collision group" value={selectedBody.collisionFilter.group ?? 0} min={-10000} max={10000} onChange={(value) => changeSelectedBody((body) => { body.collisionFilter.group = Math.trunc(value); })} />
                    <p className="advanced-note">Matching positive groups always collide; matching negative groups never do. Group 0 uses category masks.</p>
                  </div></details>
                </>}

                {tab === "world" && <>
                  <div className="panel-heading"><span className="overline">ENVIRONMENT CONTROLS</span><h2>Set the rules<span>.</span></h2><p>Shape the forces and boundaries of your entire scene.</p></div>
                  <div className="section-heading"><span>GRAVITY VECTOR</span><small>X / Y AXIS</small></div>
                  <RangeRow label="Horizontal force" value={settings.gravityX} min={-2} max={2} step={0.05} onChange={(value) => updateSettings({ gravityX: value })} />
                  <RangeRow label="Vertical force" value={settings.gravityY} min={-2} max={2} step={0.05} onChange={(value) => updateSettings({ gravityY: value })} />
                  <div className="section-heading section-spaced"><span>SIMULATION CLOCK</span><small>ENGINE TIMING</small></div>
                  <RangeRow label="Time scale" value={settings.timeScale} min={0.1} max={2} step={0.05} unit="x" onChange={(value) => updateSettings({ timeScale: value })} />
                  <RangeRow label="Playback speed" value={settings.speed} min={0.25} max={2} step={0.05} unit="x" onChange={(value) => updateSettings({ speed: value })} />
                  <ToggleRow label="Allow sleeping" description="Resting bodies conserve computation" checked={settings.enableSleeping} onChange={(checked) => updateSettings({ enableSleeping: checked })} />

                  <div className="section-heading section-spaced"><span>SPATIAL BOUNDS</span><small>WORLD EDGES</small></div>
                  <div className="bounds-grid">{([
                    { id: "floor" as BoundSide, label: "Floor" }, { id: "ceiling" as BoundSide, label: "Ceiling" },
                    { id: "left" as BoundSide, label: "Left wall" }, { id: "right" as BoundSide, label: "Right wall" },
                  ]).map(({ id, label }) => <label key={id} className={settings.bounds[id] ? "checked" : ""}><span>{label}</span><input type="checkbox" checked={settings.bounds[id]} onChange={(event) => updateSettings({ bounds: { ...settingsRef.current.bounds, [id]: event.target.checked } })} /><span className="bound-check"><Check size={13} /></span></label>)}</div>

                  <div className="section-heading section-spaced"><span>CCD ASSIST</span><small>FAST BODIES</small></div>
                  <div className="ccd-options">{([1, 2, 4, 8] as const).map((steps) => <button key={steps} className={settings.ccdSteps === steps ? "active" : ""} onClick={() => updateSettings({ ccdSteps: steps })}>{steps === 1 ? "Off" : `${steps}x`}</button>)}</div>
                  <RangeRow label="Speed threshold" value={settings.ccdThreshold} min={2} max={35} step={1} digits={0} unit=" px" disabled={settings.ccdSteps === 1} onChange={(value) => updateSettings({ ccdThreshold: value })} />
                  <p className="panel-note ccd-note">Matter.js uses discrete collision detection. Adaptive substeps reduce tunneling for fast bodies, but are not true swept CCD.</p>
                  <div className="section-heading section-spaced"><span>DISPLAY</span><small>VIEWPORT</small></div>
                  <ToggleRow label="Dot grid" description="Visual alignment guide" checked={settings.showGrid} onChange={(checked) => updateSettings({ showGrid: checked })} />
                  <div className="world-engine-note">POWERED BY MATTER.JS <span>v{(Matter as unknown as { version: string }).version}</span></div>
                </>}

                {tab === "files" && <>
                  <div className="panel-heading"><span className="overline">PROJECT SPACE</span><h2>Keep exploring<span>.</span></h2><p>Save your experiments locally and pick up where you left off.</p></div>
                  <label className="project-name-label">SCENE NAME<input type="text" maxLength={60} value={sceneName} onChange={(event) => { sceneNameRef.current = event.target.value; setSceneName(event.target.value); }} onBlur={commitEdit} placeholder="Name this experiment" /></label>
                  <div className="section-heading section-spaced"><span>LOCAL SAVE SLOTS</span><small>THIS BROWSER</small></div>
                  <div className="slot-list">{slots.map((slot, index) => <div className={`save-slot ${slot ? "occupied" : ""}`} key={index}>
                    <div className="slot-top"><span>SLOT {String(index + 1).padStart(2, "0")}</span><span className={`slot-indicator ${slot ? "saved" : ""}`} /></div>
                    <strong>{slot?.name || "Empty slot"}</strong><small>{slot ? new Date(slot.savedAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Your next experiment goes here"}</small>
                    <div className="slot-actions"><button onClick={() => saveSlot(index)}><Save size={14} /> {slot ? "Overwrite" : "Save here"}</button>{slot && <><button onClick={() => loadSlot(index)}><ArrowDownToLine size={14} /> Load</button><button className="slot-delete" onClick={() => deleteSlot(index)} title="Clear save slot" aria-label={`Clear slot ${index + 1}`}><Trash2 size={15} /></button></>}</div>
                  </div>)}</div>

                  <div className="section-heading section-spaced"><span>PORTABLE FILES</span><small>JSON FORMAT</small></div>
                  <div className="file-actions"><button onClick={exportJson}><Download size={17} /> Export scene <ArrowUpRight size={15} /></button><button onClick={() => fileInputRef.current?.click()}><FileUp size={17} /> Import scene <ArrowUpRight size={15} /></button></div>
                  <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden-file-input" onChange={importJson} />
                  {videoUrl && <a className="last-video" href={videoUrl} download={videoFilename}><Video size={17} /> Download last video <ArrowUpRight size={15} /></a>}
                  <div className="section-heading section-spaced"><span>START FRESH</span><small>SCENE ACTIONS</small></div>
                  <div className="fresh-actions"><button onClick={newScene}><Plus size={16} /> New blank scene</button><button onClick={loadDemo}><RotateCcw size={16} /> Restore starter scene</button></div>
                  <p className="panel-note">Save slots stay in this browser. Export JSON to keep a portable copy. Run interpolation above to record an interpolated video.</p>
                </>}
              </fieldset>
            </div>
            <div className="panel-footer"><span><span className="footer-spark" /> {isRecording ? "RECORDING IN PROGRESS" : "YOUR IDEAS, IN MOTION"}</span><span>SPACE TO {isPlaying ? "PAUSE" : "PLAY"}</span></div>
          </aside>
        </main>
      </div>
    </>
  );
}

const STYLES = `
  * { box-sizing: border-box; }
  html, body, #root { margin: 0; min-width: 320px; min-height: 100%; }
  body { background: #f9f8f4; }
  button, input, select { font: inherit; }
  button { cursor: pointer; }
  button:disabled, input:disabled, select:disabled { cursor: not-allowed; }
  button:focus-visible, input:focus-visible, select:focus-visible, canvas:focus-visible, summary:focus-visible, a:focus-visible { outline: 2px solid #db765a; outline-offset: 2px; }
  .studio-shell { width: 100%; height: 100dvh; min-height: 620px; display: flex; flex-direction: column; overflow: hidden; color: #243238; background: #fbfaf7; font-family: "Avenir Next", Avenir, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
  .topbar { position: relative; z-index: 4; height: 75px; flex: 0 0 75px; display: grid; grid-template-columns: minmax(212px, 1fr) auto minmax(315px, 1fr); align-items: center; padding: 0 24px; background: #fbfaf7; border-bottom: 1px solid #e9e9e4; }
  .brand { display: flex; align-items: center; gap: 11px; min-width: 0; }
  .brand-mark { position: relative; display: block; width: 37px; height: 37px; flex: 0 0 37px; border-radius: 11px; background: #233941; overflow: hidden; }
  .brand-mark i { position: absolute; display: block; border-radius: 50%; }
  .brand-mark i:nth-child(1) { width: 21px; height: 21px; border: 2px solid #afdfcb; left: 7px; top: 8px; }
  .brand-mark i:nth-child(2) { width: 7px; height: 7px; background: #ef9a78; right: 5px; top: 5px; box-shadow: 0 0 0 2px #233941; }
  .brand-mark i:nth-child(3) { width: 5px; height: 5px; background: #afdfcb; left: 5px; bottom: 5px; }
  .brand-copy { display: flex; flex-direction: column; line-height: 1; }
  .brand-copy strong { font-size: 25px; line-height: 25px; font-weight: 800; letter-spacing: -1.65px; color: #25383d; }
  .brand-copy strong span, .panel-heading h2 span, .stage-intro h1 span { color: #e28466; }
  .brand-copy small { margin-top: 5px; font-family: "SFMono-Regular", Consolas, monospace; font-size: 8px; line-height: 1; font-weight: 700; letter-spacing: 1.08px; color: #9aa5a0; }
  .transport { display: flex; align-items: center; height: 43px; padding: 4px; gap: 3px; background: #f0f1ed; border: 1px solid #e5e8e2; border-radius: 11px; }
  .transport-icon { width: 34px; height: 33px; display: grid; place-items: center; border: 0; border-radius: 7px; color: #586a6a; background: transparent; transition: background .18s, color .18s, transform .18s; }
  .transport-icon:hover:not(:disabled) { color: #1d343b; background: #fff; transform: translateY(-1px); }
  .transport-icon:disabled { color: #bfc7c2; }
  .transport-divider { width: 1px; height: 20px; background: #dce1dc; margin: 0 4px; }
  .play-button { min-width: 84px; height: 33px; display: flex; align-items: center; justify-content: center; gap: 7px; border: 0; border-radius: 7px; background: #263e42; color: #fff; font-size: 12px; font-weight: 750; transition: background .2s, transform .2s; }
  .play-button:hover:not(:disabled) { background: #34565b; transform: translateY(-1px); }
  .play-button.playing { background: #405f5d; }
  .play-button:disabled { opacity: .48; }
  .time-display { min-width: 67px; padding: 0 7px 0 12px; font-family: "SFMono-Regular", Consolas, monospace; color: #74837f; font-size: 11px; font-variant-numeric: tabular-nums; }
  .header-right { display: flex; justify-content: flex-end; align-items: center; gap: 19px; min-width: 0; }
  .project-title { display: flex; flex-direction: column; min-width: 0; text-align: right; gap: 3px; }
  .project-title small { font: 700 9px "SFMono-Regular", Consolas, monospace; letter-spacing: 1px; color: #a4adaa; }
  .project-title strong { display: block; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 700; color: #334447; }
  .record-button { display: flex; justify-content: center; align-items: center; gap: 9px; min-height: 38px; padding: 0 15px; white-space: nowrap; border: 1px solid #da795f; border-radius: 8px; background: #df8165; color: #fff; font-size: 11px; font-weight: 800; letter-spacing: .1px; box-shadow: 0 4px 13px rgba(210, 113, 85, .13); transition: background .2s, transform .2s, box-shadow .2s; }
  .record-button:hover { background: #ce6c51; transform: translateY(-1px); box-shadow: 0 6px 15px rgba(210, 113, 85, .2); }
  .record-button.is-recording { background: #293f42; border-color: #293f42; }
  .stop-square { width: 12px; height: 12px; border-radius: 2px; background: #fff; }
  .workspace { flex: 1; min-height: 0; display: flex; overflow: hidden; }
  .viewport { position: relative; flex: 1; min-width: 0; min-height: 0; overflow: hidden; background: #14212b; isolation: isolate; }
  .physics-canvas { display: block; width: 100%; height: 100%; outline: none; touch-action: none; cursor: default; }
  .physics-canvas.tool-select { cursor: grab; }
  .physics-canvas.tool-select:active { cursor: grabbing; }
  .physics-canvas.tool-shape, .physics-canvas.tool-polygon, .physics-canvas.tool-constraint { cursor: crosshair; }
  .physics-canvas.tool-delete { cursor: not-allowed; }
  .stage-intro { position: absolute; z-index: 1; top: 31px; left: 106px; pointer-events: none; animation: stageReveal .6s ease both; }
  .stage-kicker { display: flex; align-items: center; gap: 9px; color: #91b5aa; font: 700 10px "SFMono-Regular", Consolas, monospace; letter-spacing: 1.45px; }
  .kicker-line { width: 18px; height: 1px; background: #91b5aa; }
  .stage-intro h1 { margin: 10px 0 3px; color: #edf3ee; font-size: clamp(24px, 2.35vw, 34px); line-height: 1.1; letter-spacing: -1.5px; font-weight: 700; }
  .stage-intro p { margin: 0; max-width: 380px; color: #9db1b6; font-size: 12px; line-height: 1.5; }
  .stage-view-control { position: absolute; z-index: 2; top: 30px; right: 25px; display: flex; align-items: center; gap: 13px; color: #758e95; font: 700 10px "SFMono-Regular", Consolas, monospace; letter-spacing: .9px; }
  .stage-view-control button { display: flex; align-items: center; gap: 7px; padding: 7px 9px; border: 1px solid rgba(173,201,204,.19); border-radius: 6px; background: rgba(28,46,57,.74); color: #b1c5c4; font: inherit; letter-spacing: .2px; transition: background .2s; }
  .stage-view-control button:hover:not(:disabled) { background: #2a4751; }
  .stage-view-control button:disabled { opacity: .5; }
  .view-separator { height: 16px; width: 1px; background: rgba(178,201,201,.25); }
  .view-label { white-space: nowrap; }
  .tool-rail { position: absolute; z-index: 5; top: 148px; left: 21px; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px; border: 1px solid rgba(184,213,215,.16); border-radius: 12px; background: rgba(28,44,54,.96); box-shadow: 0 13px 31px rgba(4,13,21,.21); }
  .tool-button { display: grid; place-items: center; width: 43px; height: 43px; border: 0; border-radius: 8px; background: transparent; color: #a4b8bc; transition: color .18s, background .18s, transform .18s; }
  .tool-button:hover:not(:disabled) { color: #eef5ef; background: #344c56; transform: scale(1.04); }
  .tool-button.active { color: #21333c; background: #a9d8c6; box-shadow: 0 3px 12px rgba(142,205,187,.16); }
  .tool-button:disabled { opacity: .38; }
  .tool-with-divider { padding-top: 7px; margin-top: 5px; border-top: 1px solid rgba(173,203,203,.15); }
  .stage-bottom { position: absolute; z-index: 3; left: 0; right: 0; bottom: 0; min-height: 47px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 24px; border-top: 1px solid rgba(181,203,204,.14); background: rgba(16,28,38,.83); color: #8da5a9; font: 700 10px "SFMono-Regular", Consolas, monospace; letter-spacing: .75px; pointer-events: none; }
  .simulation-state, .stage-counts, .stage-coordinates { display: flex; align-items: center; gap: 9px; white-space: nowrap; }
  .simulation-state { color: #c7d9d8; }
  .live-dot { width: 7px; height: 7px; border-radius: 50%; background: #7c8d91; box-shadow: 0 0 0 4px rgba(124,141,145,.11); }
  .live-dot.on { background: #9bd8bb; box-shadow: 0 0 0 4px rgba(155,216,187,.13); animation: statusPulse 2.3s ease-in-out infinite; }
  .live-dot.capturing { background: #ec886d; box-shadow: 0 0 0 4px rgba(236,136,109,.15); }
  .metric-dot { width: 3px; height: 3px; border-radius: 50%; background: #6d8286; }
  .canvas-action { position: absolute; z-index: 7; left: 50%; bottom: 65px; transform: translateX(-50%); display: flex; align-items: center; gap: 13px; padding: 6px 7px 6px 14px; border: 1px solid rgba(197,220,217,.25); border-radius: 9px; background: #263d45; color: #e9f2ed; white-space: nowrap; font-size: 11px; font-weight: 700; box-shadow: 0 10px 32px rgba(5,15,21,.23); }
  .canvas-action > span { display: flex; align-items: center; gap: 8px; }
  .canvas-action > button:not(.canvas-action-close) { display: flex; align-items: center; gap: 7px; height: 31px; padding: 0 10px; border: 0; border-radius: 5px; background: #a9d8c6; color: #20383b; font-size: 11px; font-weight: 800; }
  .canvas-action > button:disabled { opacity: .45; }
  .canvas-action-close { display: grid; place-items: center; width: 27px; height: 27px; padding: 0; border: 0; background: transparent; color: #a8c0c2; }
  .link-action { padding: 8px 9px 8px 14px; }
  .record-lock { position: absolute; z-index: 8; inset: 0 0 47px; display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-start; gap: 9px; padding: 103px 26px 0; background: rgba(11,24,33,.06); cursor: not-allowed; }
  .record-lock-badge { display: flex; align-items: center; gap: 8px; padding: 8px 11px; border: 1px solid rgba(238,155,130,.35); border-radius: 6px; background: rgba(25,37,46,.92); color: #f7ab92; font: 700 10px "SFMono-Regular", Consolas, monospace; letter-spacing: 1px; }
  .record-dot { width: 7px; height: 7px; border-radius: 50%; background: #f29174; animation: statusPulse 1.2s infinite; }
  .record-lock > span:last-child { display: flex; align-items: center; gap: 6px; color: #aec2c4; font-size: 11px; text-shadow: 0 1px 3px #172730; }
  .toast { position: absolute; z-index: 12; right: 22px; bottom: 62px; display: flex; align-items: center; gap: 9px; max-width: min(400px, calc(100% - 40px)); padding: 12px 15px; border: 1px solid rgba(171,215,197,.36); border-radius: 8px; background: #284a4b; color: #e9f5ef; box-shadow: 0 12px 28px rgba(4,17,22,.24); font-size: 12px; font-weight: 650; animation: toastIn .22s ease both; }
  .toast svg { flex: 0 0 auto; color: #a9d8c6; }

  .side-panel { flex: 0 0 380px; width: 380px; min-width: 0; display: flex; flex-direction: column; overflow: hidden; border-left: 1px solid #e5e8e2; background: #fbfaf7; }
  .panel-tabs { flex: 0 0 62px; display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid #e5e8e2; }
  .panel-tabs button { position: relative; display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 0; border: 0; background: transparent; color: #8a9793; font-size: 11px; font-weight: 700; transition: color .2s, background .2s; }
  .panel-tabs button:hover { color: #304b4c; background: #f4f5f0; }
  .panel-tabs button.active { color: #d77357; }
  .panel-tabs button.active::after { position: absolute; content: ""; height: 2px; left: 12px; right: 12px; bottom: -1px; background: #df8063; }
  .panel-tabs button i { position: absolute; width: 4px; height: 4px; top: 15px; right: 8px; border-radius: 50%; background: #e38d70; }
  .panel-scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 28px 26px 30px; scrollbar-width: thin; scrollbar-color: #d8ded8 transparent; animation: panelIn .26s ease both; }
  .panel-scroll::-webkit-scrollbar { width: 6px; }
  .panel-scroll::-webkit-scrollbar-thumb { background: #d8ded8; border-radius: 10px; }
  .panel-fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
  .panel-fieldset:disabled { opacity: .53; }
  .panel-heading { margin: 0 0 27px; }
  .panel-heading.compact-heading { margin-bottom: 18px; }
  .overline { display: inline-block; color: #d0765d; font: 800 10px "SFMono-Regular", Consolas, monospace; letter-spacing: 1.35px; }
  .panel-heading h2 { margin: 9px 0 5px; font-size: 29px; line-height: 1.15; font-weight: 730; letter-spacing: -1.45px; color: #26373a; }
  .panel-heading p { max-width: 310px; margin: 0; color: #7b8987; font-size: 12px; line-height: 1.58; }
  .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 13px; color: #405452; }
  .section-heading span { font: 800 10px "SFMono-Regular", Consolas, monospace; letter-spacing: 1.15px; white-space: nowrap; }
  .section-heading small { font: 700 9px "SFMono-Regular", Consolas, monospace; letter-spacing: .45px; color: #a8b1ad; white-space: nowrap; }
  .section-spaced { margin-top: 30px; }
  .shape-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
  .shape-option { position: relative; display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; height: 112px; min-width: 0; padding: 13px 14px 12px; text-align: left; border: 1px solid #e4e8e2; border-radius: 10px; background: #fff; color: #30413f; transition: border-color .2s, background .2s, transform .2s, box-shadow .2s; }
  .shape-option:hover:not(:disabled) { border-color: #b8cbc4; transform: translateY(-2px); box-shadow: 0 7px 15px rgba(27,54,52,.05); }
  .shape-option.active { border-color: #dd8e72; background: #fffaf6; box-shadow: inset 0 0 0 1px rgba(221,142,114,.31); }
  .shape-art { display: grid; place-items: center; width: 55px; height: 55px; border-radius: 9px; }
  .shape-art.mint { color: #68b99e; background: #eaf5ef; }
  .shape-art.coral { color: #e99375; background: #fff0e9; }
  .shape-art.yellow { color: #ddad56; background: #faf2df; }
  .shape-art.lilac { color: #ab98d2; background: #f2ecf8; }
  .trapezoid-art { width: 34px; height: 28px; background: #e5b765; clip-path: polygon(23% 0, 77% 0, 100% 100%, 0 100%); }
  .shape-name { font-size: 12px; font-weight: 750; }
  .shape-number { position: absolute; right: 13px; bottom: 12px; color: #b8c1bb; font: 700 10px "SFMono-Regular", Consolas, monospace; }
  .drop-button { display: flex; align-items: center; gap: 8px; width: 100%; height: 40px; margin-top: 11px; padding: 0 12px; border: 0; border-radius: 7px; background: #294349; color: #edf5ef; text-align: left; font-size: 11px; font-weight: 750; transition: background .2s, transform .2s; }
  .drop-button:hover:not(:disabled) { background: #38585c; transform: translateY(-1px); }
  .drop-button svg:last-child { margin-left: auto; }
  .feature-row { display: flex; align-items: center; gap: 11px; width: 100%; min-height: 65px; padding: 8px 2px; border: 0; border-top: 1px solid #e5e9e3; border-bottom: 1px solid #e5e9e3; background: transparent; text-align: left; color: #3b504e; transition: color .2s, background .2s; }
  .feature-row:hover:not(:disabled), .feature-row.active { color: #ca7659; background: #fcf4ed; }
  .feature-icon { display: grid; place-items: center; width: 39px; height: 39px; flex: 0 0 39px; border-radius: 8px; color: #719e94; background: #eaf2ed; }
  .feature-copy { display: flex; flex: 1; flex-direction: column; gap: 3px; }
  .feature-copy strong { font-size: 12px; font-weight: 750; }
  .feature-copy small { font-size: 10px; color: #98a4a0; }
  .feature-row > svg { color: #a9b5ad; }
  .inline-instruction { margin: 11px 0 0; padding-left: 9px; border-left: 2px solid #dfa284; color: #778984; font-size: 11px; line-height: 1.5; }
  .connection-list { border-top: 1px solid #e6eae4; }
  .connection-row { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 58px; padding: 7px 2px; border: 0; border-bottom: 1px solid #e6eae4; background: transparent; text-align: left; color: #455755; transition: color .2s, background .2s; }
  .connection-row:hover:not(:disabled), .connection-row.active { color: #d3785b; background: #fcf5ef; }
  .connection-icon { display: grid; place-items: center; width: 34px; height: 34px; flex: 0 0 34px; color: #739f96; }
  .connection-row > span:nth-child(2) { display: flex; flex: 1; flex-direction: column; gap: 3px; }
  .connection-row strong { font-size: 12px; font-weight: 750; }
  .connection-row small { font-size: 10px; color: #9aa7a1; }
  .connection-arrow { color: #b4bdb6; }
  .panel-note { margin: 14px 0 0; color: #929e99; font-size: 11px; line-height: 1.6; }
  .panel-footer { flex: 0 0 43px; display: flex; align-items: center; justify-content: space-between; gap: 5px; padding: 0 25px; border-top: 1px solid #e9ebe6; color: #9aa7a1; font: 700 9px "SFMono-Regular", Consolas, monospace; letter-spacing: .55px; white-space: nowrap; }
  .panel-footer > span:first-child { display: flex; align-items: center; gap: 7px; }
  .footer-spark { width: 6px; height: 6px; border-radius: 50%; background: #d9896c; }

  .empty-inspector { display: flex; flex-direction: column; align-items: center; padding: 30px 18px 32px; text-align: center; border-top: 1px solid #e9ece6; border-bottom: 1px solid #e9ece6; }
  .empty-orbit { position: relative; width: 90px; height: 90px; margin: 0 0 18px; border: 1px solid #c4d6d0; border-radius: 50%; }
  .empty-orbit::before { content: ""; position: absolute; inset: 17px; border: 1px solid #d5e0d9; border-radius: 50%; }
  .empty-orbit span:nth-child(1) { position: absolute; top: 14px; right: -2px; width: 17px; height: 17px; border-radius: 50%; background: #edaa8c; }
  .empty-orbit span:nth-child(2) { position: absolute; left: 28px; top: 29px; width: 31px; height: 31px; border-radius: 7px; transform: rotate(-17deg); background: #9cc9b7; }
  .empty-orbit span:nth-child(3) { position: absolute; left: -4px; bottom: 11px; width: 9px; height: 9px; border-radius: 50%; background: #bdaddd; }
  .empty-inspector h3 { margin: 0 0 6px; font-size: 15px; letter-spacing: -.35px; color: #2e4242; }
  .empty-inspector p { margin: 0; color: #91a09a; font-size: 11px; line-height: 1.55; }
  .empty-inspector button { display: flex; align-items: center; gap: 5px; margin-top: 16px; padding: 7px 2px; border: 0; background: transparent; color: #d57859; font-size: 11px; font-weight: 750; }
  .shortcut-list { margin-top: 20px; }
  .shortcut-list div { display: flex; align-items: center; justify-content: space-between; padding: 9px 0; color: #8b9a94; font-size: 11px; }
  .shortcut-list kbd { color: #a3ada7; font: 700 9px "SFMono-Regular", Consolas, monospace; }
  .selected-object { display: flex; align-items: center; gap: 11px; min-height: 61px; padding: 5px 0 11px; border-bottom: 1px solid #e9ece6; }
  .selected-object-icon { display: grid; place-items: center; width: 47px; height: 47px; flex: 0 0 47px; border-radius: 9px; background: #e6efeb; color: #436b66; }
  .selected-object > span:nth-child(2) { min-width: 0; display: flex; flex: 1; flex-direction: column; gap: 4px; }
  .selected-object strong { font-size: 14px; color: #314547; }
  .selected-object small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #a1aca6; font: 700 9px "SFMono-Regular", Consolas, monospace; letter-spacing: .55px; }
  .selected-object-fields input { width: 100%; min-width: 0; padding: 0; border: 0; outline: none; background: transparent; color: #2c3e3e; font-size: 15px; font-weight: 750; }
  .selected-object-fields input:focus { color: #c86f54; }
  .mini-shape { display: block; width: 22px; height: 22px; border: 2px solid rgba(31,58,59,.58); border-radius: 3px; transform: rotate(-12deg); }
  .mini-shape.circle { border-radius: 50%; }
  .mini-shape.hexagon, .mini-shape.custom { clip-path: polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%); background: rgba(31,58,59,.45); border: 0; }
  .mini-shape.trapezoid { clip-path: polygon(25% 0,75% 0,100% 100%,0 100%); background: rgba(31,58,59,.45); border: 0; }
  .object-actions { display: flex; gap: 8px; margin-top: 11px; }
  .object-actions button { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 33px; padding: 0 11px; border: 1px solid #e1e7df; border-radius: 6px; background: #fff; color: #647772; font-size: 10px; font-weight: 750; transition: color .2s, border-color .2s; }
  .object-actions button:hover:not(:disabled) { border-color: #b8cdc1; color: #34594f; }
  .object-actions button.remove-action { min-width: 34px; padding: 0; margin-left: auto; color: #ce806c; }
  .field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 9px; }
  .number-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 11px; color: #6b7d78; font-size: 11px; font-weight: 650; }
  .number-wrap { position: relative; display: block; }
  .number-wrap input { display: block; width: 100%; height: 37px; padding: 0 10px; border: 1px solid #dfe6df; border-radius: 6px; outline: none; background: #fff; color: #314749; font-size: 12px; font-variant-numeric: tabular-nums; transition: border-color .2s; }
  .number-wrap input:focus { border-color: #dc937a; }
  .number-wrap input:disabled { background: #f5f6f2; color: #aab5ae; }
  .number-wrap em { position: absolute; top: 50%; right: 10px; transform: translateY(-50%); color: #a4afa9; font-size: 10px; font-style: normal; pointer-events: none; }
  .number-wrap:has(em) input { padding-right: 35px; }
  .swatch-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px; }
  .swatch-row > span { color: #82908a; font: 700 10px "SFMono-Regular", Consolas, monospace; letter-spacing: .75px; }
  .swatch-row > div { display: flex; gap: 7px; }
  .swatch-row button { width: 20px; height: 20px; padding: 0; border: 2px solid #fbfaf7; border-radius: 50%; transition: transform .2s, box-shadow .2s; }
  .swatch-row button:hover:not(:disabled) { transform: scale(1.12); }
  .swatch-row button.active { box-shadow: 0 0 0 1.5px #405d5a; }
  .range-row { margin: 0 0 17px; }
  .range-label { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 8px; color: #687b75; font-size: 11px; }
  .range-label strong { color: #425955; font: 700 11px "SFMono-Regular", Consolas, monospace; font-variant-numeric: tabular-nums; }
  .range-row input[type="range"] { display: block; width: 100%; height: 5px; margin: 0; border: 0; border-radius: 10px; appearance: none; -webkit-appearance: none; outline: none; background: linear-gradient(to right, #df886b 0%, #df886b var(--fill), #e6eae4 var(--fill), #e6eae4 100%); cursor: pointer; }
  .range-row input[type="range"]::-webkit-slider-thumb { width: 15px; height: 15px; border: 3px solid #fff; border-radius: 50%; appearance: none; -webkit-appearance: none; background: #df886b; box-shadow: 0 1px 5px rgba(33,55,51,.22); }
  .range-row input[type="range"]::-moz-range-thumb { width: 10px; height: 10px; border: 3px solid #fff; border-radius: 50%; background: #df886b; box-shadow: 0 1px 5px rgba(33,55,51,.22); }
  .range-row input[type="range"]:disabled { opacity: .42; cursor: not-allowed; }
  .toggle-row { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 56px; padding: 8px 0; border-bottom: 1px solid #e8ebe6; cursor: pointer; }
  .toggle-row > span:first-child { display: flex; flex-direction: column; gap: 4px; }
  .toggle-row strong { color: #485e59; font-size: 12px; font-weight: 700; }
  .toggle-row small { color: #9aa8a1; font-size: 10px; line-height: 1.35; }
  .toggle-row input { position: absolute; right: 0; width: 36px; height: 22px; opacity: 0; cursor: pointer; }
  .toggle-row .switch { position: relative; width: 36px; height: 21px; flex: 0 0 36px; border-radius: 20px; background: #d9dfda; pointer-events: none; transition: background .2s; }
  .toggle-row .switch::after { content: ""; position: absolute; left: 3px; top: 3px; width: 15px; height: 15px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(37,56,51,.16); transition: transform .2s; }
  .toggle-row input:checked + .switch { background: #80b7a0; }
  .toggle-row input:checked + .switch::after { transform: translateX(15px); }
  .toggle-row input:focus-visible + .switch { outline: 2px solid #d98568; outline-offset: 2px; }
  .advanced-details { margin-top: 25px; border-top: 1px solid #e4e9e2; }
  .advanced-details summary { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; list-style: none; cursor: pointer; color: #4b625c; font: 800 10px "SFMono-Regular", Consolas, monospace; letter-spacing: 1px; }
  .advanced-details summary::-webkit-details-marker { display: none; }
  .advanced-details summary svg { transition: transform .2s; }
  .advanced-details[open] summary svg { transform: rotate(180deg); }
  .advanced-content { padding: 0 0 12px; }
  .advanced-content > .number-field { margin-top: 13px; }
  .subsection-label, .mask-label { margin: 25px 0 11px; color: #799088; font: 800 10px "SFMono-Regular", Consolas, monospace; letter-spacing: .9px; }
  .mask-label { margin: 17px 0 9px; }
  .select-field { display: flex; flex-direction: column; gap: 7px; color: #71817a; font-size: 11px; font-weight: 650; }
  .select-wrap { position: relative; display: block; }
  .select-wrap select { width: 100%; height: 38px; padding: 0 32px 0 10px; border: 1px solid #e0e6df; border-radius: 6px; appearance: none; background: #fff; color: #37504b; outline: none; font-size: 11px; }
  .select-wrap select:focus { border-color: #db9378; }
  .select-wrap svg { position: absolute; right: 10px; top: 11px; color: #a0aca4; pointer-events: none; }
  .mask-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 4px; }
  .mask-grid label { display: flex; align-items: center; gap: 6px; color: #657972; font-size: 10px; cursor: pointer; }
  .mask-grid input { width: 14px; height: 14px; margin: 0; accent-color: #db8568; }
  .advanced-note { margin: 0; color: #a0aaa4; font-size: 10px; line-height: 1.5; }
  .selection-list { border-top: 1px solid #e7ebe5; }
  .selection-list > div { display: flex; align-items: center; gap: 9px; min-height: 45px; border-bottom: 1px solid #e7ebe5; color: #50645f; font-size: 12px; font-weight: 650; }
  .object-swatch { width: 17px; height: 17px; flex: 0 0 17px; border-radius: 5px; }
  .selection-list small { margin-left: auto; color: #aab6ae; font: 10px "SFMono-Regular", Consolas, monospace; }
  .multi-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 21px; }
  .multi-actions button { display: flex; align-items: center; justify-content: center; gap: 8px; height: 37px; border: 1px solid #dde5dd; border-radius: 7px; background: #fff; color: #57716a; font-size: 11px; font-weight: 750; }
  .multi-actions button.primary-action { border-color: #304f51; background: #304f51; color: #fff; }
  .multi-actions button.danger-text { color: #c67660; }
  .endpoint-list { margin-top: 17px; border-top: 1px solid #e7ebe5; }
  .endpoint-list div { display: flex; justify-content: space-between; align-items: center; min-height: 37px; border-bottom: 1px solid #e7ebe5; }
  .endpoint-list span { color: #99a8a0; font: 700 9px "SFMono-Regular", Consolas, monospace; letter-spacing: .8px; }
  .endpoint-list strong { color: #50645f; font-size: 11px; font-weight: 700; }
  .delete-object { display: flex; align-items: center; gap: 8px; margin-top: 26px; padding: 8px 0; border: 0; background: transparent; color: #c67a62; font-size: 11px; font-weight: 750; }

  .bounds-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .bounds-grid label { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-height: 40px; padding: 0 9px 0 11px; border: 1px solid #e2e7e0; border-radius: 6px; background: #fff; color: #798a82; font-size: 11px; font-weight: 700; cursor: pointer; transition: background .2s, border-color .2s; }
  .bounds-grid label.checked { border-color: #c6dbcd; background: #f0f7f1; color: #466a5b; }
  .bounds-grid input { position: absolute; opacity: 0; width: 0; height: 0; }
  .bound-check { display: grid; place-items: center; width: 18px; height: 18px; border: 1px solid #d5ded5; border-radius: 4px; color: transparent; background: #f5f7f3; }
  .checked .bound-check { border-color: #81b59b; background: #81b59b; color: #fff; }
  .bounds-grid label:has(input:focus-visible) { outline: 2px solid #dd8d70; outline-offset: 2px; }
  .ccd-options { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; padding: 3px; margin-bottom: 17px; border-radius: 7px; background: #edf0eb; }
  .ccd-options button { height: 30px; border: 0; border-radius: 5px; background: transparent; color: #93a19a; font-size: 11px; font-weight: 750; transition: color .2s, background .2s; }
  .ccd-options button.active { color: #344d48; background: #fff; box-shadow: 0 1px 5px rgba(42,65,55,.08); }
  .ccd-note { margin-top: -4px; }
  .world-engine-note { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e6eae4; color: #aab5ad; font: 700 9px "SFMono-Regular", Consolas, monospace; letter-spacing: .65px; }

  .project-name-label { display: flex; flex-direction: column; gap: 8px; color: #687c73; font: 800 10px "SFMono-Regular", Consolas, monospace; letter-spacing: .85px; }
  .project-name-label input { width: 100%; height: 39px; padding: 0 11px; border: 1px solid #dce5dd; border-radius: 6px; background: #fff; color: #344b45; outline: none; font: 700 12px "Avenir Next", Avenir, "Segoe UI", sans-serif; letter-spacing: 0; }
  .project-name-label input:focus { border-color: #df967a; }
  .slot-list { border-top: 1px solid #e7ebe5; }
  .save-slot { padding: 14px 0 15px; border-bottom: 1px solid #e7ebe5; }
  .slot-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px; color: #a7b3ab; font: 800 9px "SFMono-Regular", Consolas, monospace; letter-spacing: 1px; }
  .slot-indicator { width: 6px; height: 6px; border-radius: 50%; background: #d8dfd7; }
  .slot-indicator.saved { background: #8abda4; }
  .save-slot > strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #405651; font-size: 12px; font-weight: 750; }
  .save-slot > small { display: block; margin-top: 3px; color: #a0aea5; font-size: 10px; }
  .slot-actions { display: flex; gap: 6px; margin-top: 12px; }
  .slot-actions button { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 29px; padding: 0 9px; border: 1px solid #dfe7df; border-radius: 5px; background: #fff; color: #547165; font-size: 10px; font-weight: 750; transition: border-color .2s, background .2s; }
  .slot-actions button:hover:not(:disabled) { border-color: #aac9b6; background: #f4faf4; }
  .slot-actions button:first-child { color: #ca785b; }
  .slot-actions button.slot-delete { width: 29px; padding: 0; margin-left: auto; color: #ba8d7f; }
  .file-actions { display: flex; flex-direction: column; gap: 7px; }
  .file-actions button, .last-video { display: flex; align-items: center; gap: 9px; min-height: 37px; padding: 0 11px; border: 1px solid #e0e7df; border-radius: 6px; background: #fff; color: #557166; text-decoration: none; font-size: 11px; font-weight: 750; }
  .file-actions button:hover:not(:disabled), .last-video:hover { border-color: #b8d0be; background: #f6faf5; }
  .file-actions svg:last-child, .last-video svg:last-child { margin-left: auto; color: #9eada4; }
  .hidden-file-input { display: none; }
  .last-video { margin-top: 7px; color: #c9795d; }
  .fresh-actions { display: flex; gap: 8px; }
  .fresh-actions button { display: flex; align-items: center; justify-content: center; gap: 6px; flex: 1; min-height: 38px; padding: 3px 7px; border: 1px solid #e2e8df; border-radius: 6px; background: transparent; color: #6c8278; font-size: 10px; font-weight: 750; }
  .fresh-actions button:hover:not(:disabled) { border-color: #abc8b4; color: #3c6653; background: #f5faf4; }

  @keyframes panelIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes stageReveal { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes toastIn { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes statusPulse { 0%, 100% { opacity: 1; } 50% { opacity: .48; } }
  @media (max-width: 1190px) {
    .side-panel { flex-basis: 355px; width: 355px; }
    .topbar { grid-template-columns: minmax(175px, 1fr) auto minmax(210px, 1fr); padding: 0 18px; }
    .project-title { display: none; }
    .stage-intro { left: 99px; }
    .stage-coordinates { display: none; }
  }
  @media (max-width: 940px) {
    .side-panel { flex-basis: 326px; width: 326px; }
    .panel-scroll { padding-left: 21px; padding-right: 21px; }
    .panel-footer { padding: 0 19px; }
    .topbar { grid-template-columns: minmax(135px, 1fr) auto minmax(175px, 1fr); gap: 10px; }
    .brand-copy small { display: none; }
    .brand-copy strong { font-size: 22px; }
    .stage-view-control .view-label, .view-separator { display: none; }
    .stage-counts { display: none; }
  }
  @media (max-width: 760px) {
    .studio-shell { height: auto; min-height: 100dvh; overflow: visible; }
    .topbar { flex: none; height: 108px; min-height: 108px; grid-template-columns: 1fr auto; grid-template-rows: 53px 45px; gap: 0; padding: 3px 16px 7px; }
    .brand { grid-column: 1; grid-row: 1; }
    .brand-copy small { display: block; font-size: 7px; }
    .transport { grid-column: 1 / -1; grid-row: 2; justify-self: center; }
    .header-right { grid-column: 2; grid-row: 1; }
    .record-button { min-height: 34px; padding: 0 10px; font-size: 10px; }
    .workspace { flex-direction: column; overflow: visible; }
    .viewport { flex: none; height: min(63vh, 580px); min-height: 440px; }
    .side-panel { flex: none; width: 100%; min-height: 500px; overflow: visible; border-left: 0; border-top: 1px solid #dfe4dc; }
    .panel-scroll { flex: none; min-height: 0; overflow: visible; padding: 29px max(23px, calc((100vw - 600px) / 2)) 38px; }
    .panel-footer { flex: 0 0 43px; }
    .tool-rail { top: auto; bottom: 62px; left: 50%; transform: translateX(-50%); flex-direction: row; gap: 3px; }
    .tool-with-divider { padding-top: 0; margin-top: 0; padding-left: 7px; margin-left: 5px; border-top: 0; border-left: 1px solid rgba(173,203,203,.15); }
    .stage-intro { left: 23px; top: 22px; }
    .stage-intro h1 { font-size: 28px; }
    .stage-view-control { top: 22px; right: 17px; }
    .canvas-action { bottom: 123px; }
    .record-lock { padding-top: 105px; }
    .stage-counts { display: flex; }
  }
  @media (max-width: 480px) {
    .brand-mark { width: 33px; height: 33px; flex-basis: 33px; }
    .brand-copy strong { font-size: 21px; }
    .record-button span:last-child { max-width: 93px; overflow: hidden; text-overflow: ellipsis; }
    .stage-view-control { display: none; }
    .stage-intro p { max-width: 265px; }
    .stage-bottom { padding: 0 13px; font-size: 9px; letter-spacing: .15px; }
    .stage-counts { gap: 6px; }
    .canvas-action { max-width: calc(100% - 24px); gap: 8px; font-size: 10px; }
    .canvas-action > button:not(.canvas-action-close) { padding: 0 7px; }
    .panel-tabs button { font-size: 10px; gap: 4px; }
    .panel-tabs button svg { width: 14px; }
    .panel-scroll { padding: 26px 20px 37px; }
    .panel-footer { padding: 0 18px; font-size: 8px; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
  }
`;