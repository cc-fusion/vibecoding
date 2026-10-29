/*
 * Scene scripts. They follow the structure of taichi_mpm/scripts/mls-cpic/*.py:
 *   mpm = tc.dynamics.MPM(res=..., ...); mpm.add_particles(...); mpm.add_articulation(...)
 *   def frame_update(t, frame_dt): ... (sources)
 * Meshes referenced by the original scripts ($mpm/*.obj) are not part of the
 * repository, so equivalent geometry is generated procedurally here.
 */
import { MPM, MPMEngine, SegmentMesh, TextureFactory, TriangleMesh } from './engine.js';





const pick = (q, low, medium, high) => (q === 'low' ? low : q === 'medium' ? medium : high);
const constant = (v) => () => v;
const deg = Math.PI / 180;

// ------------------------------------------------------------- 2D geometry
function circleSegments(n, r, clockwise = true) {
  const m = new SegmentMesh();
  const s = clockwise ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const a0 = (s * i * 2 * Math.PI) / n, a1 = (s * (i + 1) * 2 * Math.PI) / n;
    m.add_segment([r * Math.cos(a0), r * Math.sin(a0)], [r * Math.cos(a1), r * Math.sin(a1)]);
  }
  return m;
}
function polygonMesh(pts) {
  const m = new SegmentMesh();
  for (let i = 0; i < pts.length; i++) m.add_segment(pts[i], pts[(i + 1) % pts.length]);
  return m;
}
const boxPolygon = (hw, hh) => [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
function regularPolygon(n, r, phase = 0) {
  return Array.from({ length: n }, (_, i) => [r * Math.cos(phase + (i * 2 * Math.PI) / n), r * Math.sin(phase + (i * 2 * Math.PI) / n)]);
}
function starPolygon(n, ro, ri) {
  const pts = [];
  for (let i = 0; i < 2 * n; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = (i * Math.PI) / n;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

// ------------------------------------------------------------- 3D geometry

const quad = (a, b, c, d) => [[a, b, c], [a, c, d]];
function boxMesh(hx, hy, hz) {
  const V = [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz], [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]];
  const F = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [2, 3, 7], [2, 7, 6], [1, 2, 6], [1, 6, 5], [0, 4, 7], [0, 7, 3]];
  return TriangleMesh.fromTriangles(F.map((f) => f.map((i) => V[i])));
}
/** Paddles (radial quads containing the z axis) + hub cylinder shell around z. */
function paddleWheelMesh(blades, rIn, rOut, hz, hubSegments = 12) {
  const tris = [];
  for (let i = 0; i < blades; i++) {
    const a = (i * 2 * Math.PI) / blades;
    const c = Math.cos(a), s = Math.sin(a);
    tris.push(...quad([rIn * c, rIn * s, -hz], [rOut * c, rOut * s, -hz], [rOut * c, rOut * s, hz], [rIn * c, rIn * s, hz]));
  }
  for (let i = 0; i < hubSegments; i++) {
    const a0 = (i * 2 * Math.PI) / hubSegments, a1 = ((i + 1) * 2 * Math.PI) / hubSegments;
    const p0 = [rIn * Math.cos(a0), rIn * Math.sin(a0)], p1 = [rIn * Math.cos(a1), rIn * Math.sin(a1)];
    tris.push(...quad([p0[0], p0[1], -hz], [p1[0], p1[1], -hz], [p1[0], p1[1], hz], [p0[0], p0[1], hz]));
  }
  return TriangleMesh.fromTriangles(tris);
}
/** Two annular side plates at z = +-hz. */
function sidePlatesMesh(rIn, rOut, hz, n = 16) {
  const tris = [];
  for (const z of [-hz, hz]) {
    for (let i = 0; i < n; i++) {
      const a0 = (i * 2 * Math.PI) / n, a1 = ((i + 1) * 2 * Math.PI) / n;
      tris.push(...quad([rIn * Math.cos(a0), rIn * Math.sin(a0), z], [rOut * Math.cos(a0), rOut * Math.sin(a0), z],
        [rOut * Math.cos(a1), rOut * Math.sin(a1), z], [rIn * Math.cos(a1), rIn * Math.sin(a1), z]));
    }
  }
  return TriangleMesh.fromTriangles(tris);
}
/** Two crossed vertical plates through the y axis (stirrer). */
function crossPaddleMesh(hw, hh) {
  return TriangleMesh.fromTriangles([
    ...quad([-hw, -hh, 0], [hw, -hh, 0], [hw, hh, 0], [-hw, hh, 0]),
    ...quad([0, -hh, -hw], [0, hh, -hw], [0, hh, hw], [0, -hh, hw]),
  ]);
}
/** A thin planar blade in the y-z plane. */
function bladeMesh(hh, hz) {
  return TriangleMesh.fromTriangles(quad([0, -hh, -hz], [0, hh, -hz], [0, hh, hz], [0, -hh, hz]));
}

// ------------------------------------------------------------------ scenes
export const SCENES = [
  {
    id: 'cutting',
    name: 'CPIC Cutting',
    dim: 2,
    description:
      'Displacement discontinuity: jelly, snow and plastic (von Mises) blocks fall onto two fixed knives and a spinning blade. CPIC affinity/side bits let the material split cleanly across the zero-thickness shells. Try the "CPIC side" colour mode.',
    features: ['Jelly', 'Snow', 'Von Mises', 'Codimensional cutting', 'Scripted rotation'],
    frameDt: 0.01,
    duration: 4,
    setup({ engine, tex, quality }) {
      const r = pick(quality, 160, 200, 256);
      const mpm = new MPM(engine, 2, { res: [r, r], base_delta_t: 2e-4 * Math.min(1, 200 / r), penalty: 1e4, pushing_force: 0 });
      const ls = mpm.create_levelset();
      ls.add_plane([0, 1], -0.06).add_plane([1, 0], -0.06).add_plane([-1, 0], 0.94).set_friction(0.5);
      mpm.set_levelset(ls);
      const knife = new SegmentMesh().add_segment([-0.14, 0], [0.14, 0]);
      mpm.add_particles({ type: 'rigid', codimensional: true, scripted_position: constant([0.2, 0.2]), scripted_rotation: constant(90), friction: 0.1, color: [0.85, 0.88, 0.95], segment_mesh: knife });
      mpm.add_particles({
        type: 'rigid', codimensional: true, scripted_position: constant([0.5, 0.27]), scripted_rotation: (t) => 200 * t,
        friction: 0.1, color: [0.95, 0.8, 0.4], segment_mesh: new SegmentMesh().add_segment([-0.12, 0], [0.12, 0]),
      });
      mpm.add_particles({ type: 'rigid', codimensional: true, scripted_position: constant([0.79, 0.2]), scripted_rotation: constant(65), friction: 0.1, color: [0.85, 0.88, 0.95], segment_mesh: knife });
      const ppc = 4;
      mpm.add_particles({ type: 'jelly', E: 2.5e4, nu: 0.3, density: 400, color: [0.96, 0.42, 0.56], density_tex: tex.rect([0.2, 0.52], [0.16, 0.13]).mul(ppc) });
      mpm.add_particles({ type: 'snow', youngs_modulus: 3e4, hardening: 10, density: 400, color: [0.9, 0.95, 1.0], density_tex: tex.rect([0.5, 0.6], [0.18, 0.13]).mul(ppc) });
      mpm.add_particles({ type: 'von_mises', youngs_modulus: 3e4, yield_stress: 150, density: 600, color: [0.55, 0.85, 0.4], density_tex: tex.rect([0.79, 0.53], [0.16, 0.12]).mul(ppc) });
      return { mpm };
    },
  },
  {
    id: 'sand-wheel',
    name: 'Sand Wheel',
    dim: 2,
    original: 'scripts/mls-cpic/sand_wheel_2D.py',
    description:
      'A stream of Drucker-Prager sand drives a free-spinning thin-shell wheel. Circle and blades are separate codimensional rigid bodies tied by a rotation articulation; the platform is a sticky scripted thin shell.',
    features: ['Sand (Drucker-Prager)', 'Thin-shell CPIC', 'Two-way coupling', 'Rotation articulation', 'PD source'],
    frameDt: 0.01,
    duration: 6,
    setup({ engine, tex, quality }) {
      const r = pick(quality, 160, 224, 320);
      const mpm = new MPM(engine, 2, { res: [r, r], penalty: 1e4 * (r / 400), pushing_force: 0, base_delta_t: (1e-4 * 256) / r });
      const damping = 2.7, density = 100, FF = -2.4;
      const circle = mpm.add_particles({
        type: 'rigid', codimensional: true, density, scripted_position: constant([0.5, 0.35]), scale: [0.16, 0.16],
        angular_damping: damping, friction: FF, color: [0.75, 0.8, 0.9], segment_mesh: circleSegments(60, 1, true),
      });
      const blades = new SegmentMesh();
      const n = 18, ang = (2 * Math.PI) / n;
      for (let i = 0; i < n; i++) {
        const b0 = -i * ang, b1 = -(i + 1) * ang;
        blades.add_segment([1.7 * Math.cos(b0), 1.7 * Math.sin(b0)], [3 * Math.cos(b1), 3 * Math.sin(b1)]);
      }
      const rb = mpm.add_particles({
        type: 'rigid', codimensional: true, density, scripted_position: constant([0.5, 0.35]), scale: [0.08, 0.08],
        friction: FF, angular_damping: damping, color: [0.55, 0.75, 0.95], segment_mesh: blades,
      });
      mpm.add_particles({
        type: 'rigid', codimensional: true, density, scripted_position: constant([0.1, 0.09]), scripted_rotation: constant(0),
        friction: -1, scale: [0.1, 0.1], color: [0.6, 0.6, 0.65], segment_mesh: new SegmentMesh().add_segment([0, 0.1], [20, 0.1]),
      });
      mpm.add_articulation({ type: 'rotation', obj0: circle, obj1: rb });
      const ppc = pick(quality, 1.5, 2, 2.5);
      const source = tex.ring(0.05).translate([0.1, 0.14]).mul(ppc);
      return {
        mpm,
        frameUpdate: (t, frameDt) => {
          if (t < 2.5)
            mpm.add_particles({
              type: 'sand', pd_source: true, friction_angle: 45, cohesion: 0, density_tex: source, delta_t: frameDt,
              initial_velocity: [-1, 0], density: 1000, color: [0.93, 0.62, 0.42],
            });
        },
      };
    },
  },
  {
    id: 'water-wheel-2d',
    name: 'Water Wheel 2D',
    dim: 2,
    original: 'scripts/mls-cpic/water_wheel.py (2D)',
    description:
      'A weakly compressible water jet hits the paddles of a thin-shell wheel that is pinned in place but free to rotate. Momentum transferred through incompatible CPIC nodes spins the wheel.',
    features: ['Water (EOS)', 'Thin-shell paddles', 'Two-way coupling', 'Level-set container', 'PD source'],
    frameDt: 0.01,
    duration: 5,
    setup({ engine, tex, quality }) {
      const r = pick(quality, 144, 192, 256);
      const mpm = new MPM(engine, 2, { res: [r, r], base_delta_t: 2e-4, penalty: 1e3, pushing_force: 0 });
      const ls = mpm.create_levelset();
      ls.add_box([0.06, 0.06], [0.94, 1.5], true).set_friction(0);
      mpm.set_levelset(ls);
      const wheel = circleSegments(16, 0.045, true);
      for (let i = 0; i < 8; i++) {
        const a = (i * 2 * Math.PI) / 8;
        wheel.add_segment([0.045 * Math.cos(a), 0.045 * Math.sin(a)], [0.17 * Math.cos(a), 0.17 * Math.sin(a)]);
      }
      mpm.add_particles({ type: 'rigid', codimensional: true, density: 60, scripted_position: constant([0.5, 0.42]), angular_damping: 0.3, friction: 0.2, color: [0.95, 0.75, 0.4], segment_mesh: wheel });
      const source = tex.rect([0.62, 0.86], [0.045, 0.025]).mul(pick(quality, 2, 2, 2.5));
      return {
        mpm,
        frameUpdate: (t, frameDt) => {
          if (t < 3)
            mpm.add_particles({ type: 'water', pd_source: true, density_tex: source, delta_t: frameDt, initial_velocity: [0, -1.5], density: 1000, color: [0.3, 0.6, 1.0] });
        },
      };
    },
  },
  {
    id: 'buoyancy',
    name: 'Buoyancy',
    dim: 2,
    original: 'scripts/mls-cpic/buoyancy.py (2D)',
    description:
      'Solid rigid bodies of different densities (300 to 2500 kg/m³) splash into a water tank. Pressure acting through CPIC impulses makes light bodies float while the heavy one sinks.',
    features: ['Water', 'Solid rigid bodies', 'Two-way coupling', 'Penalty contact'],
    frameDt: 0.01,
    duration: 5,
    setup({ engine, tex, quality }) {
      const r = pick(quality, 128, 160, 224);
      const mpm = new MPM(engine, 2, { res: [r, r], base_delta_t: (2e-4 * 160) / r, penalty: 0, pushing_force: 0 });
      const ls = mpm.create_levelset();
      ls.add_box([0.06, 0.06], [0.94, 1.5], true).set_friction(0);
      mpm.set_levelset(ls);
      mpm.add_particles({ type: 'water', density: 1000, color: [0.25, 0.55, 0.95], density_tex: tex.rect([0.5, 0.25], [0.85, 0.37]).mul(2) });
      const body = (poly, pos, rot, density, color) =>
        mpm.add_particles({ type: 'rigid', codimensional: false, initial_position: pos, initial_rotation: rot, density, friction: 0.2, color, segment_mesh: polygonMesh(poly) });
      body(boxPolygon(0.07, 0.03), [0.25, 0.68], 15, 300, [0.85, 0.65, 0.4]);
      body(boxPolygon(0.04, 0.04), [0.5, 0.75], 0, 650, [0.95, 0.85, 0.5]);
      body(boxPolygon(0.035, 0.025), [0.76, 0.7], -20, 2500, [0.6, 0.62, 0.7]);
      body(regularPolygon(16, 0.045), [0.62, 0.9], 0, 500, [0.95, 0.5, 0.45]);
      return { mpm };
    },
  },
  {
    id: 'sand-car',
    name: 'Motorized Crawler',
    dim: 2,
    original: 'scripts/mls-cpic/robot.py (motor articulation, 2D)',
    description:
      'A rigid car body with two spiked wheels connected by motor articulations (axial rotation constraints + torque) drives over a sand bed and climbs a sand hill. Wheels push sand backwards through two-way coupling.',
    features: ['Motor articulation', 'Distance constraints', 'Sand', 'Solid rigid bodies'],
    frameDt: 0.01,
    duration: 3,
    setup({ engine, tex, quality }) {
      const r = pick(quality, 128, 160, 224);
      const mpm = new MPM(engine, 2, { res: [r, r], base_delta_t: (1.5e-4 * 160) / r, penalty: 0, pushing_force: 0 });
      const ls = mpm.create_levelset();
      ls.add_plane([0, 1], -0.06).add_plane([1, 0], -0.06).add_plane([-1, 0], 0.94).set_friction(0.6);
      mpm.set_levelset(ls);
      mpm.add_particles({ type: 'sand', density: 1600, friction_angle: 40, color: [0.9, 0.72, 0.45], density_tex: tex.rect([0.5, 0.13], [0.86, 0.13]).mul(3) });
      mpm.add_particles({ type: 'sand', density: 1600, friction_angle: 40, color: [0.85, 0.6, 0.38], density_tex: tex.polygon([[0.55, 0.19], [0.8, 0.19], [0.67, 0.27]]).mul(3) });
      const car = mpm.add_particles({ type: 'rigid', codimensional: false, initial_position: [0.25, 0.32], density: 800, friction: 0.4, angular_damping: 2, color: [0.4, 0.75, 0.95], segment_mesh: polygonMesh(boxPolygon(0.09, 0.02)) });
      for (const x of [0.17, 0.33]) {
        const w = mpm.add_particles({ type: 'rigid', codimensional: false, initial_position: [x, 0.25], density: 500, friction: 0.8, angular_damping: 2, color: [0.95, 0.55, 0.4], segment_mesh: polygonMesh(starPolygon(10, 0.045, 0.034)) });
        mpm.add_articulation({ type: 'motor', obj0: w, obj1: car, power: -0.8, penalty: 1e4 });
      }
      return { mpm };
    },
  },
  {
    id: 'materials',
    name: 'Material Zoo',
    dim: 2,
    description:
      'Every constitutive model of the full solver side by side: snow (Stomakhin 2013), jelly (fixed corotated), sand (Drucker-Prager, Klár 2016), water (Tait EOS), von Mises plasticity and Hencky elasticity — plus a dynamic rigid hammer.',
    features: ['Snow', 'Jelly', 'Sand', 'Water', 'Von Mises', 'Elastic', 'Solid rigid'],
    frameDt: 0.01,
    duration: 4,
    setup({ engine, tex, quality }) {
      const r = pick(quality, 160, 200, 256);
      const mpm = new MPM(engine, 2, { res: [r, r], base_delta_t: 1.5e-4 * Math.min(1, 200 / r), penalty: 0, pushing_force: 0 });
      const ls = mpm.create_levelset();
      ls.add_plane([0, 1], -0.06).add_plane([1, 0], -0.06).add_plane([-1, 0], 0.94).set_friction(0.4);
      mpm.set_levelset(ls);
      const ppc = 4;
      const mats = [
        ['snow', { youngs_modulus: 3e4, hardening: 10, density: 400 }, [0.92, 0.96, 1.0]],
        ['jelly', { E: 2e4, nu: 0.3, density: 400 }, [0.96, 0.42, 0.56]],
        ['sand', { density: 1000, friction_angle: 35 }, [0.93, 0.76, 0.45]],
        ['water', { density: 1000 }, [0.3, 0.6, 1.0]],
        ['von_mises', { youngs_modulus: 4e4, yield_stress: 200, density: 600 }, [0.55, 0.85, 0.4]],
        ['elastic', { E: 3e4, nu: 0.3, density: 400 }, [0.98, 0.62, 0.25]],
      ];
      mats.forEach(([type, params, color], i) => {
        const x = 0.15 + i * 0.14;
        mpm.add_particles({ type, ...params, color, density_tex: tex.rect([x, 0.5 + (i % 2) * 0.12], [0.11, 0.14]).mul(ppc) });
      });
      mpm.add_particles({ type: 'rigid', codimensional: false, initial_position: [0.5, 0.86], initial_rotation: 8, density: 400, friction: 0.3, color: [0.7, 0.72, 0.8], segment_mesh: polygonMesh(boxPolygon(0.2, 0.025)) });
      return { mpm };
    },
  },
  // ---------------------------------------------------------------- 3D
  {
    id: 'water-wheel-3d',
    name: '3D Water Wheel',
    dim: 3,
    original: 'scripts/mls-cpic/water_wheel.py',
    description:
      'Port of the paper\'s water wheel: a falling water column drives a thin-shell paddle wheel (hub + 8 paddles) articulated to its side plates with a rotation articulation, rotating about the z axis.',
    features: ['3D water', 'Thin-shell meshes', 'Rotation articulation', 'rotation_axis', 'PD source'],
    frameDt: 0.01,
    duration: 4,
    camera: { target: [0.5, 0.42, 0.5], distance: 1.25, yaw: 28, pitch: 18 },
    decor: [{ kind: 'floor', y: 0.2 }],
    setup({ engine, tex, quality }) {
      const r = pick(quality, 40, 56, 72);
      const mpm = new MPM(engine, 3, { res: [r, r, r], base_delta_t: (3e-4 * 56) / r, penalty: 1e3, rigid_body_collision: false, pushing_force: 0 });
      const ls = mpm.create_levelset();
      ls.add_plane([0, 1, 0], -0.2).set_friction(0);
      mpm.set_levelset(ls);
      const common = { type: 'rigid', codimensional: true, density: 20, friction: 0.2, scripted_position: constant([0.5, 0.48, 0.5]), rotation_axis: [0, 0, 1], angular_damping: 1 };
      const a = mpm.add_particles({ ...common, color: [0.95, 0.75, 0.4], mesh: paddleWheelMesh(8, 0.035, 0.14, 0.07) });
      const b = mpm.add_particles({ ...common, color: [0.7, 0.72, 0.8], mesh: sidePlatesMesh(0.035, 0.14, 0.075) });
      mpm.add_articulation({ type: 'rotation', obj0: a, obj1: b });
      const source = tex.cylinder([0.59, 0.76, 0.5], 0.032, 0.03, 1).mul(pick(quality, 4, 4, 5));
      return {
        mpm,
        frameUpdate: (t, frameDt) => {
          if (t < 3)
            mpm.add_particles({ type: 'water', pd_source: true, density_tex: source, delta_t: frameDt, initial_velocity: [0, -1.2, 0], density: 1000, color: [0.3, 0.6, 1.0] });
        },
      };
    },
  },
  {
    id: 'sand-stir-3d',
    name: '3D Sand Stirring',
    dim: 3,
    original: 'scripts/mls-cpic/sand_stir.py',
    description:
      'A scripted crossed-paddle stirrer (thin shells, infinite mass and inertia) rotates inside a cylindrical tank of sand, continuously cutting through the granular medium with CPIC.',
    features: ['3D sand', 'Scripted rotation', 'Thin-shell cutting', 'Level-set cylinder'],
    frameDt: 0.01,
    duration: 4,
    camera: { target: [0.5, 0.3, 0.5], distance: 1.05, yaw: 20, pitch: 38 },
    decor: [{ kind: 'floor', y: 0.2 }, { kind: 'cylinder', center: [0.5, 0, 0.5], radius: 0.28, y0: 0.2, y1: 0.42 }],
    setup({ engine, tex, quality }) {
      const r = pick(quality, 40, 48, 64);
      const mpm = new MPM(engine, 3, { res: [r, r, r], base_delta_t: (3.5e-4 * 48) / r, penalty: 1e3, pushing_force: 0 });
      const ls = mpm.create_levelset();
      ls.add_cylinder([0.5, 0.5, 0.5], 0.28, true).add_plane([0, 1, 0], -0.2).set_friction(0.4);
      mpm.set_levelset(ls);
      mpm.add_particles({ type: 'sand', density: 1500, friction_angle: 35, color: [0.93, 0.72, 0.42], density_tex: tex.cylinder([0.5, 0.265, 0.5], 0.26, 0.12, 1).mul(2) });
      mpm.add_particles({
        type: 'rigid', codimensional: true, friction: 0.3, color: [0.6, 0.8, 0.95], scripted_position: constant([0.5, 0.31, 0.5]),
        scripted_rotation: (t) => [0, 140 * t, 0], mesh: crossPaddleMesh(0.16, 0.09),
      });
      return { mpm };
    },
  },
  {
    id: 'jelly-cut-3d',
    name: '3D Jelly Cutting',
    dim: 3,
    description:
      'A jelly cube and a snowball fall onto zero-thickness blades. CPIC tracks on which side of each triangle a particle lives, so the solids are sliced into separate pieces without remeshing.',
    features: ['3D jelly', 'Snow', 'Codimensional blades', 'CPIC affinity'],
    frameDt: 0.01,
    duration: 3,
    camera: { target: [0.5, 0.38, 0.5], distance: 1.1, yaw: 35, pitch: 22 },
    decor: [{ kind: 'floor', y: 0.2 }],
    setup({ engine, tex, quality }) {
      const r = pick(quality, 40, 56, 72);
      const mpm = new MPM(engine, 3, { res: [r, r, r], base_delta_t: (4e-4 * 56) / r, penalty: 1e3, pushing_force: 0 });
      const ls = mpm.create_levelset();
      ls.add_plane([0, 1, 0], -0.2).set_friction(0.4);
      mpm.set_levelset(ls);
      mpm.add_particles({ type: 'rigid', codimensional: true, friction: 0.1, color: [0.85, 0.88, 0.95], scripted_position: constant([0.36, 0.31, 0.5]), scripted_rotation: constant([0, 0, 0]), mesh: bladeMesh(0.11, 0.14) });
      mpm.add_particles({ type: 'rigid', codimensional: true, friction: 0.1, color: [0.95, 0.8, 0.45], scripted_position: constant([0.66, 0.31, 0.5]), scripted_rotation: constant([0, 0, 25]), mesh: bladeMesh(0.11, 0.14) });
      const ppc = pick(quality, 6, 6, 8);
      mpm.add_particles({ type: 'jelly', E: 2e4, nu: 0.3, density: 400, color: [0.96, 0.42, 0.56], density_tex: tex.rect([0.36, 0.56, 0.5], [0.17, 0.13, 0.17]).mul(ppc) });
      mpm.add_particles({ type: 'snow', youngs_modulus: 2e4, hardening: 6, density: 400, color: [0.92, 0.96, 1.0], density_tex: tex.sphere([0.66, 0.6, 0.5], 0.08).mul(ppc) });
      return { mpm };
    },
  },
  {
    id: 'rigid-pile-3d',
    name: '3D Rigid Bodies in Water',
    dim: 3,
    description:
      'Four solid rigid boxes of different densities fall into a water pool. Rigid–rigid contacts are found with the Minkowski Portal Refinement (libccd MPR) port and resolved with impulses; buoyancy comes from two-way MPM coupling.',
    features: ['3D water', 'Solid rigid meshes', 'MPR collisions', 'Two-way coupling'],
    frameDt: 0.01,
    duration: 4,
    camera: { target: [0.5, 0.36, 0.5], distance: 1.15, yaw: 30, pitch: 28 },
    decor: [{ kind: 'box', lower: [0.2, 0.2, 0.2], upper: [0.8, 0.52, 0.8] }],
    setup({ engine, tex, quality }) {
      const r = pick(quality, 40, 48, 64);
      const mpm = new MPM(engine, 3, { res: [r, r, r], base_delta_t: (3.5e-4 * 48) / r, penalty: 0, rigid_penalty: 1e3, pushing_force: 0 });
      const ls = mpm.create_levelset();
      ls.add_box([0.2, 0.2, 0.2], [0.8, 1.5, 0.8], true).set_friction(0.1);
      mpm.set_levelset(ls);
      mpm.add_particles({ type: 'water', density: 1000, color: [0.3, 0.6, 1.0], density_tex: tex.rect([0.5, 0.27, 0.5], [0.58, 0.13, 0.58]).mul(pick(quality, 1.5, 1.5, 2)) });
      const box = (h, pos, rot, density, color) =>
        mpm.add_particles({ type: 'rigid', codimensional: false, initial_position: pos, initial_rotation: rot, density, friction: 0.3, restitution: 0.1, color, mesh: boxMesh(h[0], h[1], h[2]) });
      box([0.05, 0.05, 0.05], [0.44, 0.44, 0.47], [0, 20, 0], 400, [0.85, 0.65, 0.4]);
      box([0.04, 0.04, 0.04], [0.5, 0.56, 0.53], [30, 10, 45], 700, [0.95, 0.85, 0.5]);
      box([0.08, 0.03, 0.05], [0.43, 0.66, 0.56], [10, 40, 0], 300, [0.6, 0.8, 0.95]);
      box([0.035, 0.035, 0.035], [0.58, 0.75, 0.45], [15, 0, 30], 2500, [0.6, 0.62, 0.7]);
      return { mpm };
    },
  },
];

export const deg2rad = deg;
