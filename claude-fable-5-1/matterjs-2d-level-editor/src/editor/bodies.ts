import Matter, { Bodies, Body, Common, Vertices } from "matter-js";
import decomp from "poly-decomp";
import { polygonCentroid, regularPolygonVertices } from "./geometry";
import type { BodyData, BodyDefaults, BodyKind, BodyPhysics, ShapeSpec, Vec2 } from "./types";

// Enable concave decomposition for custom polygons.
Common.setDecomp(decomp);

export interface EditorBody {
  id: string;
  kind: BodyKind;
  shape: ShapeSpec;
  body: Body;
}

interface OriginalProps {
  restitution: number;
  friction: number;
  mass: number;
  inertia: number;
  density: number;
}

type BodyWithOriginal = Body & { _original?: OriginalProps };

export const EDITOR_PLUGIN_KEY = "levelEditor";

export function bodyEditorId(body: Body): string | null {
  const root = body.parent && body.parent !== body ? body.parent : body;
  const p = (root.plugin as Record<string, { id?: string; boundary?: boolean } | undefined>)[EDITOR_PLUGIN_KEY];
  return p?.id ?? null;
}

export function isBoundaryBody(body: Body) {
  const root = body.parent && body.parent !== body ? body.parent : body;
  const p = (root.plugin as Record<string, { boundary?: boolean } | undefined>)[EDITOR_PLUGIN_KEY];
  return Boolean(p?.boundary);
}

export function shapeVertices(shape: ShapeSpec): Vec2[] {
  switch (shape.kind) {
    case "rectangle":
      return Bodies.rectangle(0, 0, shape.width, shape.height).vertices.map((v) => ({ x: v.x, y: v.y }));
    case "square":
      return Bodies.rectangle(0, 0, shape.size, shape.size).vertices.map((v) => ({ x: v.x, y: v.y }));
    case "circle":
      return Bodies.circle(0, 0, shape.radius).vertices.map((v) => ({ x: v.x, y: v.y }));
    case "polygon":
      return regularPolygonVertices(shape.sides, shape.radius);
    case "custom":
      return shape.vertices.map((v) => ({ x: v.x, y: v.y }));
  }
}

/** Normalizes custom polygon vertices so their centroid is at the origin. */
export function centerVertices(vertices: Vec2[]): { vertices: Vec2[]; centroid: Vec2 } {
  const c = polygonCentroid(vertices);
  return { centroid: c, vertices: vertices.map((v) => ({ x: v.x - c.x, y: v.y - c.y })) };
}

function physicsOptions(p: BodyPhysics, render: BodyData["render"], label: string): Matter.IChamferableBodyDefinition {
  return {
    label,
    isStatic: false, // set via Body.setStatic after density is applied
    isSensor: p.isSensor,
    density: p.density,
    restitution: p.restitution,
    friction: p.friction,
    frictionStatic: p.frictionStatic,
    frictionAir: p.frictionAir,
    sleepThreshold: p.sleepThreshold,
    collisionFilter: { ...p.collisionFilter },
    render: { ...render, visible: true },
  };
}

export function createMatterBody(data: BodyData): Body {
  const opts = physicsOptions(data, data.render, data.label);
  const { x, y } = data.position;
  let body: Body;
  switch (data.shape.kind) {
    case "rectangle":
      body = Bodies.rectangle(x, y, data.shape.width, data.shape.height, opts);
      break;
    case "square":
      body = Bodies.rectangle(x, y, data.shape.size, data.shape.size, opts);
      break;
    case "circle":
      body = Bodies.circle(x, y, data.shape.radius, opts);
      break;
    case "polygon":
      body = Bodies.polygon(x, y, data.shape.sides, data.shape.radius, opts);
      break;
    case "custom": {
      body = Bodies.fromVertices(x, y, [data.shape.vertices.map((v) => ({ x: v.x, y: v.y }))], opts, true);
      // fromVertices may nudge the centre of mass; force exact placement.
      Body.setPosition(body, { x, y });
      break;
    }
  }
  Body.setAngle(body, data.angle);
  Body.setVelocity(body, { x: data.velocity.x, y: data.velocity.y });
  Body.setAngularVelocity(body, data.angularVelocity);
  if (data.isStatic) Body.setStatic(body, true);
  (body.plugin as Record<string, unknown>)[EDITOR_PLUGIN_KEY] = { id: data.id };
  return body;
}

export function makeBodyData(
  id: string,
  shape: ShapeSpec,
  position: Vec2,
  defaults: BodyDefaults,
  label: string,
): BodyData {
  return {
    id,
    label,
    shape,
    position: { ...position },
    angle: 0,
    velocity: { x: 0, y: 0 },
    angularVelocity: 0,
    isStatic: defaults.isStatic,
    isSensor: defaults.isSensor,
    density: defaults.density,
    restitution: defaults.restitution,
    friction: defaults.friction,
    frictionStatic: defaults.frictionStatic,
    frictionAir: defaults.frictionAir,
    sleepThreshold: defaults.sleepThreshold,
    collisionFilter: { ...defaults.collisionFilter },
    render: { ...defaults.render },
  };
}

/** Reads editor-facing physical values, looking through Matter's static overrides. */
export function readBodyPhysics(body: Body): BodyPhysics & { mass: number; area: number; inertia: number } {
  const b = body as BodyWithOriginal;
  const orig = body.isStatic ? b._original : undefined;
  return {
    isStatic: body.isStatic,
    isSensor: body.isSensor,
    density: orig ? orig.density : body.density,
    mass: orig ? orig.mass : body.mass,
    inertia: orig ? orig.inertia : body.inertia,
    area: body.area,
    restitution: orig ? orig.restitution : body.restitution,
    friction: orig ? orig.friction : body.friction,
    frictionStatic: body.frictionStatic,
    frictionAir: body.frictionAir,
    sleepThreshold: body.sleepThreshold,
    collisionFilter: {
      group: body.collisionFilter.group ?? 0,
      category: body.collisionFilter.category ?? 1,
      mask: body.collisionFilter.mask ?? 0xffffffff,
    },
  };
}

/** Runs `fn` with the body temporarily dynamic so mass/density/restitution edits persist correctly. */
export function withDynamic(body: Body, fn: () => void) {
  if (body.isStatic) {
    Body.setStatic(body, false);
    try {
      fn();
    } finally {
      Body.setStatic(body, true);
    }
  } else {
    fn();
  }
}

export type BodyPropKey =
  | "label"
  | "x"
  | "y"
  | "angle"
  | "vx"
  | "vy"
  | "angularVelocity"
  | "isStatic"
  | "isSensor"
  | "density"
  | "mass"
  | "restitution"
  | "friction"
  | "frictionStatic"
  | "frictionAir"
  | "sleepThreshold"
  | "group"
  | "category"
  | "mask"
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "opacity";

export function applyBodyProp(body: Body, key: BodyPropKey, value: number | string | boolean) {
  const num = typeof value === "number" ? value : Number(value);
  switch (key) {
    case "label":
      body.label = String(value);
      break;
    case "x":
      Body.setPosition(body, { x: num, y: body.position.y });
      break;
    case "y":
      Body.setPosition(body, { x: body.position.x, y: num });
      break;
    case "angle":
      Body.setAngle(body, num);
      break;
    case "vx":
      Body.setVelocity(body, { x: num, y: body.velocity.y });
      break;
    case "vy":
      Body.setVelocity(body, { x: body.velocity.x, y: num });
      break;
    case "angularVelocity":
      Body.setAngularVelocity(body, num);
      break;
    case "isStatic":
      if (Boolean(value) !== body.isStatic) Body.setStatic(body, Boolean(value));
      break;
    case "isSensor":
      body.isSensor = Boolean(value);
      for (const part of body.parts) part.isSensor = Boolean(value);
      break;
    case "density":
      withDynamic(body, () => Body.setDensity(body, Math.max(1e-6, num)));
      break;
    case "mass":
      withDynamic(body, () => Body.setMass(body, Math.max(1e-6, num)));
      break;
    case "restitution":
      withDynamic(body, () => {
        body.restitution = num;
        for (const part of body.parts) part.restitution = num;
      });
      break;
    case "friction":
      withDynamic(body, () => {
        body.friction = num;
        for (const part of body.parts) part.friction = num;
      });
      break;
    case "frictionStatic":
      body.frictionStatic = num;
      for (const part of body.parts) part.frictionStatic = num;
      break;
    case "frictionAir":
      body.frictionAir = num;
      break;
    case "sleepThreshold":
      body.sleepThreshold = num;
      break;
    case "group":
      body.collisionFilter.group = Math.trunc(num);
      for (const part of body.parts) part.collisionFilter.group = Math.trunc(num);
      break;
    case "category":
      body.collisionFilter.category = Math.trunc(num) >>> 0;
      for (const part of body.parts) part.collisionFilter.category = Math.trunc(num) >>> 0;
      break;
    case "mask":
      body.collisionFilter.mask = Math.trunc(num) >>> 0;
      for (const part of body.parts) part.collisionFilter.mask = Math.trunc(num) >>> 0;
      break;
    case "fillStyle":
      body.render.fillStyle = String(value);
      break;
    case "strokeStyle":
      body.render.strokeStyle = String(value);
      break;
    case "lineWidth":
      body.render.lineWidth = num;
      break;
    case "opacity":
      body.render.opacity = Math.max(0, Math.min(1, num));
      break;
  }
}

/** Replaces the body's geometry with a new shape spec (non-compound shapes only). */
export function reshapeBody(entity: EditorBody, shape: ShapeSpec) {
  if (shape.kind === "custom") return; // custom polygons keep their vertex set
  const body = entity.body;
  const verts = shapeVertices(shape);
  Vertices.rotate(verts as Matter.Vector[], body.angle, { x: 0, y: 0 });
  withDynamic(body, () => {
    Body.setVertices(body, verts as Matter.Vector[]);
  });
  body.circleRadius = shape.kind === "circle" ? shape.radius : undefined;
  entity.shape = shape;
}

export function serializeBody(entity: EditorBody): BodyData {
  const { body } = entity;
  const phys = readBodyPhysics(body);
  return {
    id: entity.id,
    label: body.label,
    shape: JSON.parse(JSON.stringify(entity.shape)) as ShapeSpec,
    position: { x: body.position.x, y: body.position.y },
    angle: body.angle,
    velocity: { x: body.velocity.x, y: body.velocity.y },
    angularVelocity: body.angularVelocity,
    isStatic: phys.isStatic,
    isSensor: phys.isSensor,
    density: phys.density,
    restitution: phys.restitution,
    friction: phys.friction,
    frictionStatic: phys.frictionStatic,
    frictionAir: phys.frictionAir,
    sleepThreshold: phys.sleepThreshold,
    collisionFilter: { ...phys.collisionFilter },
    render: {
      fillStyle: String(body.render.fillStyle ?? "#888"),
      strokeStyle: String(body.render.strokeStyle ?? "#000"),
      lineWidth: body.render.lineWidth ?? 1,
      opacity: body.render.opacity ?? 1,
    },
  };
}

export const BODY_KIND_LABEL: Record<BodyKind, string> = {
  rectangle: "Rectangle",
  square: "Square",
  circle: "Circle",
  polygon: "Polygon",
  custom: "Custom polygon",
};
