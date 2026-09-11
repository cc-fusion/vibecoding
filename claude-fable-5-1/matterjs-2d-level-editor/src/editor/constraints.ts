import { Constraint, type Body } from "matter-js";
import type { ConstraintData, ConstraintDefaults, ConstraintKind, Vec2 } from "./types";
import { dist } from "./geometry";

export interface EditorConstraint {
  id: string;
  kind: ConstraintKind;
  constraint: Constraint;
  bodyAId: string | null;
  bodyBId: string | null;
}

export const CONSTRAINT_KIND_LABEL: Record<ConstraintKind, string> = {
  link: "Body link",
  anchor: "World anchor",
  spring: "Spring",
  pin: "Pin",
};

export interface ConstraintEndpoint {
  bodyId: string | null;
  body: Body | null;
  /** World position of the endpoint at creation time */
  world: Vec2;
}

export function endpointToData(ep: ConstraintEndpoint): { bodyId: string | null; point: Vec2 } {
  if (ep.body) {
    return { bodyId: ep.bodyId, point: { x: ep.world.x - ep.body.position.x, y: ep.world.y - ep.body.position.y } };
  }
  return { bodyId: null, point: { ...ep.world } };
}

export function makeConstraintData(
  id: string,
  kind: ConstraintKind,
  a: ConstraintEndpoint,
  b: ConstraintEndpoint,
  defaults: ConstraintDefaults,
  label: string,
): ConstraintData {
  const ea = endpointToData(a);
  const eb = endpointToData(b);
  const length = defaults.lengthMode === "auto" ? dist(a.world, b.world) : defaults.length;
  return {
    id,
    kind,
    label,
    bodyA: ea.bodyId,
    bodyB: eb.bodyId,
    pointA: ea.point,
    pointB: eb.point,
    length,
    stiffness: defaults.stiffness,
    damping: defaults.damping,
    render: { ...defaults.render },
  };
}

export function createMatterConstraint(data: ConstraintData, bodyA: Body | null, bodyB: Body | null): Constraint {
  return Constraint.create({
    label: data.label,
    bodyA: bodyA ?? undefined,
    bodyB: bodyB ?? undefined,
    pointA: { ...data.pointA },
    pointB: { ...data.pointB },
    length: data.length,
    stiffness: data.stiffness,
    damping: data.damping,
    render: {
      visible: true,
      strokeStyle: data.render.strokeStyle,
      lineWidth: data.render.lineWidth,
      type: data.render.type,
      anchors: data.render.anchors,
    },
  });
}

export function serializeConstraint(e: EditorConstraint): ConstraintData {
  const c = e.constraint;
  const render = c.render as unknown as { strokeStyle?: string; lineWidth?: number; type?: string; anchors?: boolean };
  return {
    id: e.id,
    kind: e.kind,
    label: c.label,
    bodyA: e.bodyAId,
    bodyB: e.bodyBId,
    pointA: { x: c.pointA.x, y: c.pointA.y },
    pointB: { x: c.pointB.x, y: c.pointB.y },
    length: c.length,
    stiffness: c.stiffness,
    damping: c.damping ?? 0,
    render: {
      strokeStyle: render.strokeStyle ?? "#fff",
      lineWidth: render.lineWidth ?? 2,
      type: render.type === "spring" ? "spring" : "line",
      anchors: render.anchors !== false,
    },
  };
}

export function constraintWorldPoints(c: Constraint): { a: Vec2; b: Vec2 } {
  return { a: Constraint.pointAWorld(c), b: Constraint.pointBWorld(c) };
}

export type ConstraintPropKey =
  | "label"
  | "length"
  | "stiffness"
  | "damping"
  | "pointAx"
  | "pointAy"
  | "pointBx"
  | "pointBy"
  | "strokeStyle"
  | "lineWidth"
  | "type"
  | "anchors";

export function applyConstraintProp(c: Constraint, key: ConstraintPropKey, value: number | string | boolean) {
  const num = typeof value === "number" ? value : Number(value);
  const render = c.render as unknown as Record<string, unknown>;
  switch (key) {
    case "label":
      c.label = String(value);
      break;
    case "length":
      c.length = Math.max(0, num);
      break;
    case "stiffness":
      c.stiffness = Math.min(1, Math.max(0, num));
      break;
    case "damping":
      c.damping = Math.min(1, Math.max(0, num));
      break;
    case "pointAx":
      c.pointA.x = num;
      break;
    case "pointAy":
      c.pointA.y = num;
      break;
    case "pointBx":
      c.pointB.x = num;
      break;
    case "pointBy":
      c.pointB.y = num;
      break;
    case "strokeStyle":
      render.strokeStyle = String(value);
      break;
    case "lineWidth":
      render.lineWidth = num;
      break;
    case "type":
      render.type = value === "spring" ? "spring" : "line";
      break;
    case "anchors":
      render.anchors = Boolean(value);
      break;
  }
}
