import { createDefaultLastUsed, createDefaultSettings, mergeInto } from "./defaults";
import { validatePolygon } from "./geometry";
import {
  BODY_KINDS,
  CONSTRAINT_KINDS,
  DOCUMENT_APP,
  DOCUMENT_VERSION,
  type BodyData,
  type ConstraintData,
  type EditorDocument,
  type LastUsed,
  type SceneData,
  type ShapeSpec,
  type Vec2,
} from "./types";

export class DocumentError extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function num(o: Obj, key: string, fallback: number, path: string, required = false): number {
  const v = o[key];
  if (v === undefined) {
    if (required) throw new DocumentError(`${path}.${key} is missing`);
    return fallback;
  }
  if (!isNum(v)) throw new DocumentError(`${path}.${key} must be a finite number`);
  return v;
}

function bool(o: Obj, key: string, fallback: boolean): boolean {
  const v = o[key];
  return typeof v === "boolean" ? v : fallback;
}

function str(o: Obj, key: string, fallback: string): string {
  const v = o[key];
  return typeof v === "string" ? v : fallback;
}

function vec(o: Obj, key: string, path: string, fallback?: Vec2): Vec2 {
  const v = o[key];
  if (v === undefined && fallback) return { ...fallback };
  if (!isObj(v) || !isNum(v.x) || !isNum(v.y)) throw new DocumentError(`${path}.${key} must be {x, y}`);
  return { x: v.x, y: v.y };
}

function parseShape(raw: unknown, path: string): ShapeSpec {
  if (!isObj(raw)) throw new DocumentError(`${path}.shape is missing`);
  const kind = raw.kind;
  if (typeof kind !== "string" || !(BODY_KINDS as string[]).includes(kind)) {
    throw new DocumentError(`${path}.shape.kind "${String(kind)}" is not a supported shape`);
  }
  const p = `${path}.shape`;
  switch (kind) {
    case "rectangle":
      return { kind, width: Math.max(1, num(raw, "width", 0, p, true)), height: Math.max(1, num(raw, "height", 0, p, true)) };
    case "square":
      return { kind, size: Math.max(1, num(raw, "size", 0, p, true)) };
    case "circle":
      return { kind, radius: Math.max(1, num(raw, "radius", 0, p, true)) };
    case "polygon":
      return { kind, sides: Math.max(3, Math.round(num(raw, "sides", 0, p, true))), radius: Math.max(1, num(raw, "radius", 0, p, true)) };
    default: {
      const verts = raw.vertices;
      if (!Array.isArray(verts)) throw new DocumentError(`${p}.vertices must be an array`);
      const pts: Vec2[] = verts.map((v, i) => {
        if (!isObj(v) || !isNum(v.x) || !isNum(v.y)) throw new DocumentError(`${p}.vertices[${i}] must be {x, y}`);
        return { x: v.x, y: v.y };
      });
      const check = validatePolygon(pts);
      if (!check.ok) throw new DocumentError(`${p}: ${check.error}`);
      return { kind: "custom", vertices: check.vertices };
    }
  }
}

function parseBody(raw: unknown, index: number, defaults: LastUsed): BodyData {
  const path = `bodies[${index}]`;
  if (!isObj(raw)) throw new DocumentError(`${path} must be an object`);
  const id = raw.id;
  if (typeof id !== "string" || !id) throw new DocumentError(`${path}.id must be a non-empty string`);
  const shape = parseShape(raw.shape, path);
  const d = defaults.bodies[shape.kind];
  const cf = isObj(raw.collisionFilter) ? raw.collisionFilter : {};
  const render = isObj(raw.render) ? raw.render : {};
  return {
    id,
    label: str(raw, "label", shape.kind),
    shape,
    position: vec(raw, "position", path),
    angle: num(raw, "angle", 0, path),
    velocity: vec(raw, "velocity", path, { x: 0, y: 0 }),
    angularVelocity: num(raw, "angularVelocity", 0, path),
    isStatic: bool(raw, "isStatic", d.isStatic),
    isSensor: bool(raw, "isSensor", d.isSensor),
    density: Math.max(1e-6, num(raw, "density", d.density, path)),
    restitution: num(raw, "restitution", d.restitution, path),
    friction: num(raw, "friction", d.friction, path),
    frictionStatic: num(raw, "frictionStatic", d.frictionStatic, path),
    frictionAir: num(raw, "frictionAir", d.frictionAir, path),
    sleepThreshold: num(raw, "sleepThreshold", d.sleepThreshold, path),
    collisionFilter: {
      group: num(cf, "group", d.collisionFilter.group, `${path}.collisionFilter`),
      category: num(cf, "category", d.collisionFilter.category, `${path}.collisionFilter`),
      mask: num(cf, "mask", d.collisionFilter.mask, `${path}.collisionFilter`),
    },
    render: {
      fillStyle: str(render, "fillStyle", d.render.fillStyle),
      strokeStyle: str(render, "strokeStyle", d.render.strokeStyle),
      lineWidth: num(render, "lineWidth", d.render.lineWidth, `${path}.render`),
      opacity: num(render, "opacity", d.render.opacity, `${path}.render`),
    },
  };
}

function parseConstraint(raw: unknown, index: number, bodyIds: Set<string>, defaults: LastUsed): ConstraintData {
  const path = `constraints[${index}]`;
  if (!isObj(raw)) throw new DocumentError(`${path} must be an object`);
  const id = raw.id;
  if (typeof id !== "string" || !id) throw new DocumentError(`${path}.id must be a non-empty string`);
  const kind = raw.kind;
  if (typeof kind !== "string" || !(CONSTRAINT_KINDS as string[]).includes(kind)) {
    throw new DocumentError(`${path}.kind "${String(kind)}" is not a supported constraint type`);
  }
  const d = defaults.constraints[kind as ConstraintData["kind"]];
  const ref = (key: "bodyA" | "bodyB"): string | null => {
    const v = raw[key];
    if (v === null || v === undefined) return null;
    if (typeof v !== "string") throw new DocumentError(`${path}.${key} must be a body id or null`);
    if (!bodyIds.has(v)) throw new DocumentError(`${path}.${key} references unknown body "${v}"`);
    return v;
  };
  const bodyA = ref("bodyA");
  const bodyB = ref("bodyB");
  if (!bodyA && !bodyB) throw new DocumentError(`${path} must attach to at least one body`);
  const render = isObj(raw.render) ? raw.render : {};
  return {
    id,
    kind: kind as ConstraintData["kind"],
    label: str(raw, "label", kind),
    bodyA,
    bodyB,
    pointA: vec(raw, "pointA", path, { x: 0, y: 0 }),
    pointB: vec(raw, "pointB", path, { x: 0, y: 0 }),
    length: Math.max(0, num(raw, "length", 0, path)),
    stiffness: num(raw, "stiffness", d.stiffness, path),
    damping: num(raw, "damping", d.damping, path),
    render: {
      strokeStyle: str(render, "strokeStyle", d.render.strokeStyle),
      lineWidth: num(render, "lineWidth", d.render.lineWidth, `${path}.render`),
      type: render.type === "spring" ? "spring" : "line",
      anchors: bool(render, "anchors", d.render.anchors),
    },
  };
}

export function parseScene(raw: unknown, defaults: LastUsed): SceneData {
  if (!isObj(raw)) throw new DocumentError("scene must be an object");
  const bodiesRaw = raw.bodies ?? [];
  const consRaw = raw.constraints ?? [];
  if (!Array.isArray(bodiesRaw)) throw new DocumentError("scene.bodies must be an array");
  if (!Array.isArray(consRaw)) throw new DocumentError("scene.constraints must be an array");
  const bodies = bodiesRaw.map((b, i) => parseBody(b, i, defaults));
  const ids = new Set<string>();
  for (const b of bodies) {
    if (ids.has(b.id)) throw new DocumentError(`Duplicate body id "${b.id}"`);
    ids.add(b.id);
  }
  const constraints = consRaw.map((c, i) => parseConstraint(c, i, ids, defaults));
  const cids = new Set<string>();
  for (const c of constraints) {
    if (cids.has(c.id)) throw new DocumentError(`Duplicate constraint id "${c.id}"`);
    cids.add(c.id);
  }
  return { bodies, constraints };
}

/** Parses and validates a full document. Throws DocumentError on malformed input. */
export function parseDocument(raw: unknown): EditorDocument {
  if (!isObj(raw)) throw new DocumentError("Document must be a JSON object");
  if (raw.app !== DOCUMENT_APP) throw new DocumentError(`Not a ${DOCUMENT_APP} document (app="${String(raw.app)}")`);
  if (!isNum(raw.version)) throw new DocumentError("Document version is missing");
  if (raw.version > DOCUMENT_VERSION) {
    throw new DocumentError(`Document version ${raw.version} is newer than supported version ${DOCUMENT_VERSION}`);
  }
  const lastUsed = mergeInto(createDefaultLastUsed(), raw.lastUsed);
  const settings = mergeInto(createDefaultSettings(), raw.settings);
  const scene = parseScene(raw.scene ?? { bodies: [], constraints: [] }, lastUsed);
  return {
    app: DOCUMENT_APP,
    version: DOCUMENT_VERSION,
    savedAt: typeof raw.savedAt === "string" ? raw.savedAt : new Date().toISOString(),
    scene,
    settings,
    lastUsed,
  };
}

export function parseDocumentText(text: string): EditorDocument {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new DocumentError(`Invalid JSON: ${(err as Error).message}`);
  }
  return parseDocument(raw);
}

export function buildDocument(scene: SceneData, settings: EditorDocument["settings"], lastUsed: LastUsed): EditorDocument {
  return {
    app: DOCUMENT_APP,
    version: DOCUMENT_VERSION,
    savedAt: new Date().toISOString(),
    scene: JSON.parse(JSON.stringify(scene)) as SceneData,
    settings: JSON.parse(JSON.stringify(settings)) as EditorDocument["settings"],
    lastUsed: JSON.parse(JSON.stringify(lastUsed)) as LastUsed,
  };
}
