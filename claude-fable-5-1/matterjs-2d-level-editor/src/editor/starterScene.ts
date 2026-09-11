import { createDefaultLastUsed } from "./defaults";
import { makeBodyData } from "./bodies";
import type { SceneData } from "./types";

/** A small demonstration level used when no saved document exists. */
export function createStarterScene(): SceneData {
  const lu = createDefaultLastUsed();
  const platform = makeBodyData("b_platform", { kind: "rectangle", width: 320, height: 24 }, { x: 300, y: 420 }, lu.bodies.rectangle, "Platform");
  platform.isStatic = true;
  platform.render.fillStyle = "#3d4b5c";
  platform.angle = -0.08;

  const crateA = makeBodyData("b_crate_a", { kind: "square", size: 48 }, { x: 260, y: 300 }, lu.bodies.square, "Crate A");
  const crateB = makeBodyData("b_crate_b", { kind: "square", size: 48 }, { x: 320, y: 300 }, lu.bodies.square, "Crate B");
  const ball = makeBodyData("b_ball", { kind: "circle", radius: 26 }, { x: 520, y: 140 }, lu.bodies.circle, "Ball");
  ball.restitution = 0.6;
  const hex = makeBodyData("b_hex", { kind: "polygon", sides: 6, radius: 34 }, { x: 640, y: 320 }, lu.bodies.polygon, "Hex");
  const wedge = makeBodyData(
    "b_wedge",
    { kind: "custom", vertices: [{ x: -60, y: 30 }, { x: 60, y: 30 }, { x: 60, y: 0 }, { x: 0, y: -30 }, { x: -60, y: 0 }] },
    { x: 150, y: 200 },
    lu.bodies.custom,
    "Wedge",
  );
  const pendulum = makeBodyData("b_pendulum", { kind: "circle", radius: 18 }, { x: 560, y: 260 }, lu.bodies.circle, "Pendulum bob");
  pendulum.render.fillStyle = "#f6d95b";

  return {
    bodies: [platform, crateA, crateB, ball, hex, wedge, pendulum],
    constraints: [
      {
        id: "c_spring",
        kind: "spring",
        label: "Ball spring",
        bodyA: null,
        bodyB: "b_ball",
        pointA: { x: 520, y: 40 },
        pointB: { x: 0, y: 0 },
        length: 100,
        stiffness: 0.03,
        damping: 0.05,
        render: { ...lu.constraints.spring.render },
      },
      {
        id: "c_pendulum",
        kind: "anchor",
        label: "Pendulum arm",
        bodyA: null,
        bodyB: "b_pendulum",
        pointA: { x: 660, y: 120 },
        pointB: { x: 0, y: 0 },
        length: 172,
        stiffness: 1,
        damping: 0,
        render: { ...lu.constraints.anchor.render },
      },
    ],
  };
}
