import type {
  BodyDefaults,
  BodyKind,
  ConstraintDefaults,
  ConstraintKind,
  EditorSettings,
  LastUsed,
} from "./types";

const basePhysics = (): Omit<BodyDefaults, "render"> => ({
  isStatic: false,
  isSensor: false,
  density: 0.001,
  restitution: 0.1,
  friction: 0.3,
  frictionStatic: 0.5,
  frictionAir: 0.01,
  sleepThreshold: 60,
  collisionFilter: { group: 0, category: 0x0001, mask: 0xffffffff },
});

const palette: Record<BodyKind, string> = {
  rectangle: "#5b9cf6",
  square: "#f6a35b",
  circle: "#5bd8a0",
  polygon: "#c78cf6",
  custom: "#f65b8f",
};

const bodyDefaults = (kind: BodyKind): BodyDefaults => ({
  ...basePhysics(),
  render: { fillStyle: palette[kind], strokeStyle: "#0d1117", lineWidth: 1.5, opacity: 1 },
});

export function createDefaultLastUsed(): LastUsed {
  const constraint = (kind: ConstraintKind): ConstraintDefaults => {
    switch (kind) {
      case "link":
        return {
          stiffness: 1,
          damping: 0,
          lengthMode: "auto",
          length: 100,
          render: { strokeStyle: "#e6edf3", lineWidth: 2, type: "line", anchors: true },
        };
      case "anchor":
        return {
          stiffness: 0.9,
          damping: 0,
          lengthMode: "auto",
          length: 100,
          render: { strokeStyle: "#f6d95b", lineWidth: 2, type: "line", anchors: true },
        };
      case "spring":
        return {
          stiffness: 0.03,
          damping: 0.05,
          lengthMode: "auto",
          length: 100,
          render: { strokeStyle: "#5bd8a0", lineWidth: 2, type: "spring", anchors: true },
        };
      case "pin":
        return {
          stiffness: 1,
          damping: 0,
          lengthMode: "fixed",
          length: 0,
          render: { strokeStyle: "#f6a35b", lineWidth: 2, type: "line", anchors: true },
        };
    }
  };
  return {
    bodies: {
      rectangle: { ...bodyDefaults("rectangle"), width: 120, height: 40 },
      square: { ...bodyDefaults("square"), size: 50 },
      circle: { ...bodyDefaults("circle"), radius: 28 },
      polygon: { ...bodyDefaults("polygon"), sides: 6, radius: 36 },
      custom: bodyDefaults("custom"),
    },
    constraints: {
      link: constraint("link"),
      anchor: constraint("anchor"),
      spring: constraint("spring"),
      pin: constraint("pin"),
    },
  };
}

export function createDefaultSettings(): EditorSettings {
  return {
    world: { name: "Untitled level", background: "#0f141a" },
    engine: {
      timeScale: 1,
      stepHz: 60,
      enableSleeping: false,
      positionIterations: 6,
      velocityIterations: 4,
      constraintIterations: 2,
    },
    render: {
      wireframes: false,
      showBounds: false,
      showVelocity: false,
      showAxes: true,
      showSleeping: true,
      showLabels: false,
      showCollisions: false,
      showConstraintAnchors: true,
      showBoundaries: true,
    },
    gravity: {
      mode: "auto",
      x: 0,
      y: 1,
      scale: 0.001,
      sensitivity: 1,
      smoothing: 0.15,
      invertX: false,
      invertY: false,
      calibration: { beta: 0, gamma: 0 },
    },
    boundaries: {
      top: false,
      right: true,
      bottom: true,
      left: true,
      thickness: 60,
      friction: 0.5,
      restitution: 0.1,
      visible: true,
      color: "#2a3441",
    },
    grid: { show: true, spacing: 20, snap: false },
    ui: { stickyMultiSelect: false, collapsed: {} },
  };
}

/** Deep-merge `source` into a fresh copy of `target`, only copying keys that exist in target
 *  with matching primitive types. Unknown keys are ignored so malformed input cannot poison state. */
export function mergeInto<T>(target: T, source: unknown): T {
  if (source === null || typeof source !== "object" || Array.isArray(source)) return target;
  const out: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  const src = source as Record<string, unknown>;
  for (const key of Object.keys(out)) {
    if (!(key in src)) continue;
    const cur = out[key];
    const val = src[key];
    if (cur !== null && typeof cur === "object" && !Array.isArray(cur)) {
      // `collapsed` is a free-form map
      if (key === "collapsed" && val && typeof val === "object") {
        out[key] = { ...(val as Record<string, boolean>) };
      } else {
        out[key] = mergeInto(cur, val);
      }
    } else if (typeof cur === typeof val && val !== null) {
      if (typeof val === "number" && !Number.isFinite(val)) continue;
      out[key] = val;
    }
  }
  return out as T;
}
