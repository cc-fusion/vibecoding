// ===========================================================================
// Geometry helpers, declarative config resolution, built-in scenes.
// ===========================================================================
var DEG = Math.PI / 180;
function constant(v) { return function () { return v; }; }
function pick(q, low, medium, high) { return q === 'low' ? low : q === 'medium' ? medium : high; }

function circleSegments(n, r, clockwise) {
  var m = new SegmentMesh();
  var s = clockwise === false ? 1 : -1;
  for (var i = 0; i < n; i++) {
    var a0 = (s * i * 2 * Math.PI) / n, a1 = (s * (i + 1) * 2 * Math.PI) / n;
    m.add_segment([r * Math.cos(a0), r * Math.sin(a0)], [r * Math.cos(a1), r * Math.sin(a1)]);
  }
  return m;
}
function polygonMesh(pts) {
  var m = new SegmentMesh();
  for (var i = 0; i < pts.length; i++) m.add_segment(pts[i], pts[(i + 1) % pts.length]);
  return m;
}
function boxPolygon(hw, hh) { return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]; }
function regularPolygon(n, r, phase) {
  phase = phase || 0;
  var out = [];
  for (var i = 0; i < n; i++) out.push([r * Math.cos(phase + (i * 2 * Math.PI) / n), r * Math.sin(phase + (i * 2 * Math.PI) / n)]);
  return out;
}
function starPolygon(n, ro, ri) {
  var pts = [];
  for (var i = 0; i < 2 * n; i++) {
    var r = i % 2 === 0 ? ro : ri, a = (i * Math.PI) / n;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}
/** 2D wheel: thin-shell circle + radial paddles in one codimensional body. */
function wheelMesh2D(radius, blades, hubRatio) {
  var m = circleSegments(28, radius * (hubRatio || 0.28), true);
  for (var i = 0; i < blades; i++) {
    var a = (i * 2 * Math.PI) / blades;
    m.add_segment([radius * (hubRatio || 0.28) * Math.cos(a), radius * (hubRatio || 0.28) * Math.sin(a)], [radius * Math.cos(a), radius * Math.sin(a)]);
  }
  return m;
}

function quad(a, b, c, d) { return [[a, b, c], [a, c, d]]; }
function boxMesh(hx, hy, hz) {
  var V = [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz], [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]];
  var F = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [2, 3, 7], [2, 7, 6], [1, 2, 6], [1, 6, 5], [0, 4, 7], [0, 7, 3]];
  return TriangleMesh.fromTriangles(F.map(function (f) { return f.map(function (i) { return V[i]; }); }));
}
function paddleWheelMesh(blades, rIn, rOut, hz, hubSegments) {
  hubSegments = hubSegments || 12;
  var tris = [];
  for (var i = 0; i < blades; i++) {
    var a = (i * 2 * Math.PI) / blades, c = Math.cos(a), s = Math.sin(a);
    tris.push.apply(tris, quad([rIn * c, rIn * s, -hz], [rOut * c, rOut * s, -hz], [rOut * c, rOut * s, hz], [rIn * c, rIn * s, hz]));
  }
  for (var j = 0; j < hubSegments; j++) {
    var a0 = (j * 2 * Math.PI) / hubSegments, a1 = ((j + 1) * 2 * Math.PI) / hubSegments;
    var p0 = [rIn * Math.cos(a0), rIn * Math.sin(a0)], p1 = [rIn * Math.cos(a1), rIn * Math.sin(a1)];
    tris.push.apply(tris, quad([p0[0], p0[1], -hz], [p1[0], p1[1], -hz], [p1[0], p1[1], hz], [p0[0], p0[1], hz]));
  }
  return TriangleMesh.fromTriangles(tris);
}
function sidePlatesMesh(rIn, rOut, hz, n) {
  n = n || 16;
  var tris = [];
  for (var z of [-hz, hz]) {
    for (var i = 0; i < n; i++) {
      var a0 = (i * 2 * Math.PI) / n, a1 = ((i + 1) * 2 * Math.PI) / n;
      tris.push.apply(tris, quad([rIn * Math.cos(a0), rIn * Math.sin(a0), z], [rOut * Math.cos(a0), rOut * Math.sin(a0), z],
        [rOut * Math.cos(a1), rOut * Math.sin(a1), z], [rIn * Math.cos(a1), rIn * Math.sin(a1), z]));
    }
  }
  return TriangleMesh.fromTriangles(tris);
}
function crossPaddleMesh(hw, hh) {
  return TriangleMesh.fromTriangles([].concat(
    quad([-hw, -hh, 0], [hw, -hh, 0], [hw, hh, 0], [-hw, hh, 0]),
    quad([0, -hh, -hw], [0, hh, -hw], [0, hh, hw], [0, -hh, hw])));
}
function bladeMesh(hh, hz) {
  return TriangleMesh.fromTriangles(quad([0, -hh, -hz], [0, hh, -hz], [0, hh, hz], [0, -hh, hz]));
}

var Helpers = {
  constant: constant, pick: pick, deg: DEG,
  circle: circleSegments, polygon: polygonMesh, box: boxPolygon, regular: regularPolygon,
  star: starPolygon, wheel: wheelMesh2D, boxMesh: boxMesh, paddleWheel: paddleWheelMesh,
  sidePlates: sidePlatesMesh, crossPaddle: crossPaddleMesh, blade: bladeMesh,
};

// --------------------------------------------------- script / texture / cfg
/** Scripted value: function | number | vec | "expr in t" | {spin: deg/s} | {expr}. */
function resolveScript(v) {
  if (typeof v === 'function') return v;
  if (typeof v === 'number' || Array.isArray(v)) return constant(v);
  // NOTE: direct eval keeps the library scope visible to developer scripts.
  if (typeof v === 'string') return eval('(function (t) { return (' + v + '); })');
  if (v && typeof v === 'object') {
    if (v.__fn) return eval('(' + v.__fn + ')');
    if (v.expr) return eval('(function (t) { return (' + v.expr + '); })');
    if (v.spin !== undefined) { var t0 = v.t0 || 0; return function (t) { return (t - t0) * v.spin; }; }
    if (v.value !== undefined) return constant(v.value);
  }
  return constant(0);
}

/** Declarative texture spec -> Texture. {type:'rect',center,size,mul,translate,...} */
function buildTexture(spec, engine, dim) {
  if (spec instanceof Texture) return spec;
  if (!spec || typeof spec !== 'object') throw new Error('MPM.js: invalid texture spec');
  var t;
  var type = spec.type || (spec.rect ? 'rect' : spec.sphere ? 'sphere' : spec.cylinder ? 'cylinder' : spec.ring ? 'ring' : spec.polygon ? 'polygon' : null);
  var p = spec[type] && typeof spec[type] === 'object' ? Object.assign({}, spec, spec[type]) : spec;
  var f = new TextureFactory(engine, dim);
  switch (type) {
    case 'rect': t = f.rect(p.center, p.size); break;
    case 'sphere': t = f.sphere(p.center, p.radius); break;
    case 'cylinder': t = f.cylinder(p.center, p.radius, p.height, p.axis); break;
    case 'ring': t = f.ring(p.outer, p.inner, p.center); break;
    case 'polygon': t = f.polygon(p.points); break;
    case 'union': case 'intersect': case 'subtract':
      t = buildTexture(p.a, engine, dim)[type](buildTexture(p.b, engine, dim)); break;
    default: throw new Error('MPM.js: unknown texture type "' + type + '"');
  }
  if (p.mul !== undefined) t = t.mul(p.mul);
  if (p.translate) t = t.translate(p.translate);
  if (p.rotate) t = t.rotate(p.rotate.angle || p.rotate, p.rotate.center, p.rotate.axis);
  if (p.bound) t = t.bound(p.bound.axis || p.bound[0], p.bound.lo !== undefined ? p.bound.lo : p.bound[1], p.bound.hi !== undefined ? p.bound.hi : p.bound[2]);
  return t;
}

/** Resolve declarative sugar in an add_particles config into engine values. */
function resolveCfg(cfg, engine, dim) {
  var out = {};
  for (var key of Object.keys(cfg)) {
    var v = cfg[key];
    if (key === 'scripted_position' || key === 'scripted_rotation') out[key] = resolveScript(v);
    else if ((key === 'density_tex' || key === 'texture') && v && typeof v === 'object' && !(v instanceof Texture)) {
      out.density_tex = buildTexture(v, engine, dim);
    } else if (key === 'segments' && v) {
      out.segment_mesh = v instanceof SegmentMesh ? v : segmentsFromArray(v);
    } else if (key === 'triangles' && v) {
      out.mesh = v instanceof TriangleMesh ? v : TriangleMesh.fromTriangles(v);
    } else if (key === 'shape' && v) {
      // shape sugar: {circle:r} | {box:[hw,hh]} | {polygon:pts} | {star:[n,ro,ri]} | {wheel:[r,blades]}
      if (v.circle !== undefined) out.segment_mesh = circleSegments(v.segments || 28, v.circle, true);
      else if (v.box) out.segment_mesh = polygonMesh(boxPolygon(v.box[0], v.box[1]));
      else if (v.polygon) out.segment_mesh = polygonMesh(v.polygon);
      else if (v.star) out.segment_mesh = polygonMesh(starPolygon(v.star[0], v.star[1], v.star[2]));
      else if (v.wheel) out.segment_mesh = wheelMesh2D(v.wheel[0], v.wheel[1] || 8, v.wheel[2]);
      else if (v.segment) out.segment_mesh = new SegmentMesh().add_segment(v.segment[0], v.segment[1]);
      else if (v.boxMesh) out.mesh = boxMesh(v.boxMesh[0], v.boxMesh[1], v.boxMesh[2]);
      else if (v.paddleWheel) out.mesh = paddleWheelMesh(v.paddleWheel[0], v.paddleWheel[1], v.paddleWheel[2], v.paddleWheel[3]);
      else if (v.blade) out.mesh = bladeMesh(v.blade[0], v.blade[1]);
    } else if (v && v.__fn) out[key] = resolveScript(v);
    else out[key] = v;
  }
  return out;
}
function segmentsFromArray(v) {
  if (Array.isArray(v) && Array.isArray(v[0])) {
    var m = new SegmentMesh();
    for (var s of v) m.add_segment(s[0], s[1]);
    return m;
  }
  // flat [x0,y0,x1,y1, ...]
  var m2 = new SegmentMesh();
  for (var i = 0; i + 3 < v.length; i += 4) m2.add_segment([v[i], v[i + 1]], [v[i + 2], v[i + 3]]);
  return m2;
}

/** Build a wheel on a live solver. mode 'motor' (scripted spin) | 'free'. */
function buildWheel(solver, engine, opts, t0) {
  var center = opts.center || [0.5, 0.5];
  var radius = opts.radius || 0.14;
  var blades = opts.blades === undefined ? 8 : opts.blades;
  var mode = opts.mode || 'free';
  var speed = opts.speed === undefined ? 90 : opts.speed; // deg/s, sign = direction
  var color = opts.color || [0.95, 0.75, 0.4];
  if (solver.dim === 3) {
    center = pad3(center);
    var hz = opts.depth || radius * 0.5;
    var common = { type: 'rigid', codimensional: true, density: opts.density || 20, friction: opts.friction === undefined ? 0.2 : opts.friction, scripted_position: constant(center), rotation_axis: [0, 0, 1], angular_damping: opts.damping === undefined ? 1 : opts.damping, color: color };
    if (mode === 'motor') {
      return solver.add_particles(Object.assign({}, common, { mesh: paddleWheelMesh(blades, radius * 0.25, radius, hz), scripted_rotation: function (t) { return [0, 0, (t - t0) * speed]; } }));
    }
    var a = solver.add_particles(Object.assign({}, common, { mesh: paddleWheelMesh(blades, radius * 0.25, radius, hz) }));
    var b = solver.add_particles(Object.assign({}, common, { color: opts.plateColor || [0.7, 0.72, 0.8], mesh: sidePlatesMesh(radius * 0.25, radius, hz * 1.07) }));
    solver.add_articulation({ type: 'rotation', obj0: a, obj1: b });
    return a;
  }
  var cfg = {
    type: 'rigid', codimensional: true, density: opts.density || 60,
    scripted_position: constant(center), angular_damping: opts.damping === undefined ? 0.3 : opts.damping,
    friction: opts.friction === undefined ? 0.2 : opts.friction, color: color,
    segment_mesh: wheelMesh2D(radius, blades, opts.hubRatio),
  };
  if (mode === 'motor') cfg.scripted_rotation = function (t) { return (t - t0) * speed; };
  return solver.add_particles(cfg);
}

/** Declarative levelset spec -> applied to solver. */
function buildLevelset(solver, spec) {
  var ls = solver.create_levelset();
  var planes = spec.planes || [];
  for (var p of planes) ls.add_plane(p.normal || p[0], p.d !== undefined ? p.d : p[1]);
  if (spec.box) ls.add_box(spec.box.lower || spec.box[0], spec.box.upper || spec.box[1], spec.box.inside_out !== undefined ? spec.box.inside_out : true);
  if (spec.sphere) ls.add_sphere(spec.sphere.center, spec.sphere.radius, spec.sphere.inside_out);
  if (spec.cylinder) ls.add_cylinder(spec.cylinder.center, spec.cylinder.radius, spec.cylinder.inside_out !== undefined ? spec.cylinder.inside_out : true);
  if (spec.polygon) ls.add_polygon(spec.polygon.points || spec.polygon, spec.polygon.inside_out);
  if (spec.friction !== undefined) ls.set_friction(spec.friction);
  solver.set_levelset(ls);
  return ls;
}

// ===========================================================================
// Built-in scenes — ports of taichi_mpm/scripts/mls-cpic/*.py
// ===========================================================================
function defineScene(def) { MPM.scenes[def.id] = def; return def; }

defineScene({
  id: 'cutting', name: 'CPIC Cutting', dim: 2,
  description: 'Jelly, snow and plastic blocks fall onto fixed knives and a spinning blade. CPIC affinity lets materials split cleanly across zero-thickness shells.',
  features: ['Jelly', 'Snow', 'Von Mises', 'Codimensional cutting'],
  frameDt: 0.01, duration: 4,
  setup: function (ctx) {
    var engine = ctx.engine, tex = ctx.tex, quality = ctx.quality;
    var r = pick(quality, 160, 200, 256);
    var mpm = new Solver(engine, 2, { res: [r, r], base_delta_t: 2e-4 * Math.min(1, 200 / r), penalty: 1e4, pushing_force: 0 });
    var ls = mpm.create_levelset();
    ls.add_plane([0, 1], -0.06).add_plane([1, 0], -0.06).add_plane([-1, 0], 0.94).set_friction(0.5);
    mpm.set_levelset(ls);
    var knife = new SegmentMesh().add_segment([-0.14, 0], [0.14, 0]);
    mpm.add_particles({ type: 'rigid', codimensional: true, scripted_position: constant([0.2, 0.2]), scripted_rotation: constant(90), friction: 0.1, color: [0.85, 0.88, 0.95], segment_mesh: knife });
    mpm.add_particles({ type: 'rigid', codimensional: true, scripted_position: constant([0.5, 0.27]), scripted_rotation: function (t) { return 200 * t; }, friction: 0.1, color: [0.95, 0.8, 0.4], segment_mesh: new SegmentMesh().add_segment([-0.12, 0], [0.12, 0]) });
    mpm.add_particles({ type: 'rigid', codimensional: true, scripted_position: constant([0.79, 0.2]), scripted_rotation: constant(65), friction: 0.1, color: [0.85, 0.88, 0.95], segment_mesh: knife });
    var ppc = 4;
    mpm.add_particles({ type: 'jelly', E: 2.5e4, nu: 0.3, density: 400, color: [0.96, 0.42, 0.56], density_tex: tex.rect([0.2, 0.52], [0.16, 0.13]).mul(ppc) });
    mpm.add_particles({ type: 'snow', youngs_modulus: 3e4, hardening: 10, density: 400, color: [0.9, 0.95, 1.0], density_tex: tex.rect([0.5, 0.6], [0.18, 0.13]).mul(ppc) });
    mpm.add_particles({ type: 'von_mises', youngs_modulus: 3e4, yield_stress: 150, density: 600, color: [0.55, 0.85, 0.4], density_tex: tex.rect([0.79, 0.53], [0.16, 0.12]).mul(ppc) });
    return { mpm: mpm };
  },
});

defineScene({
  id: 'sand-wheel', name: 'Sand Wheel', dim: 2, original: 'sand_wheel_2D.py',
  description: 'A stream of Drucker-Prager sand drives a free-spinning thin-shell wheel: circle and blades tied by a rotation articulation over a sticky platform.',
  features: ['Sand', 'Thin-shell CPIC', 'Two-way coupling', 'Rotation articulation', 'PD source'],
  frameDt: 0.01, duration: 6,
  setup: function (ctx) {
    var engine = ctx.engine, tex = ctx.tex, quality = ctx.quality;
    var r = pick(quality, 160, 224, 320);
    var mpm = new Solver(engine, 2, { res: [r, r], penalty: 1e4 * (r / 400), pushing_force: 0, base_delta_t: (1e-4 * 256) / r });
    var damping = 2.7, density = 100, FF = -2.4;
    var circle = mpm.add_particles({ type: 'rigid', codimensional: true, density: density, scripted_position: constant([0.5, 0.35]), scale: [0.16, 0.16], angular_damping: damping, friction: FF, color: [0.75, 0.8, 0.9], segment_mesh: circleSegments(60, 1, true) });
    var blades = new SegmentMesh();
    var n = 18, ang = (2 * Math.PI) / n;
    for (var i = 0; i < n; i++) {
      var b0 = -i * ang, b1 = -(i + 1) * ang;
      blades.add_segment([1.7 * Math.cos(b0), 1.7 * Math.sin(b0)], [3 * Math.cos(b1), 3 * Math.sin(b1)]);
    }
    var rb = mpm.add_particles({ type: 'rigid', codimensional: true, density: density, scripted_position: constant([0.5, 0.35]), scale: [0.08, 0.08], friction: FF, angular_damping: damping, color: [0.55, 0.75, 0.95], segment_mesh: blades });
    mpm.add_particles({ type: 'rigid', codimensional: true, density: density, scripted_position: constant([0.1, 0.09]), scripted_rotation: constant(0), friction: -1, scale: [0.1, 0.1], color: [0.6, 0.6, 0.65], segment_mesh: new SegmentMesh().add_segment([0, 0.1], [20, 0.1]) });
    mpm.add_articulation({ type: 'rotation', obj0: circle, obj1: rb });
    var ls = mpm.create_levelset();
    ls.add_plane([0, 1], -0.04).add_plane([1, 0], -0.04).add_plane([-1, 0], 0.96).set_friction(0.9);
    mpm.set_levelset(ls);
    var source = tex.rect([0.32, 0.85], [0.06, 0.03]).mul(pick(quality, 2.5, 3, 3.5));
    return {
      mpm: mpm,
      frameUpdate: function (t, frameDt) {
        if (t < 4.4) mpm.add_particles({ type: 'sand', pd_source: true, density_tex: source, delta_t: frameDt, initial_velocity: [0.3, -0.5], density: 1200, friction_angle: 30, color: [0.93, 0.76, 0.45] });
      },
    };
  },
});

defineScene({
  id: 'water-wheel-2d', name: 'Water Wheel 2D', dim: 2, original: 'water_wheel.py (2D)',
  description: 'A weakly compressible water jet hits the paddles of a thin-shell wheel pinned in place but free to rotate. Momentum through incompatible CPIC nodes spins it.',
  features: ['Water (EOS)', 'Thin-shell paddles', 'Two-way coupling', 'PD source'],
  frameDt: 0.01, duration: 5,
  setup: function (ctx) {
    var engine = ctx.engine, tex = ctx.tex, quality = ctx.quality;
    var r = pick(quality, 144, 192, 256);
    var mpm = new Solver(engine, 2, { res: [r, r], base_delta_t: 2e-4, penalty: 1e3, pushing_force: 0 });
    var ls = mpm.create_levelset();
    ls.add_box([0.06, 0.06], [0.94, 1.5], true).set_friction(0);
    mpm.set_levelset(ls);
    var wheel = circleSegments(16, 0.045, true);
    for (var i = 0; i < 8; i++) {
      var a = (i * 2 * Math.PI) / 8;
      wheel.add_segment([0.045 * Math.cos(a), 0.045 * Math.sin(a)], [0.17 * Math.cos(a), 0.17 * Math.sin(a)]);
    }
    mpm.add_particles({ type: 'rigid', codimensional: true, density: 60, scripted_position: constant([0.5, 0.42]), angular_damping: 0.3, friction: 0.2, color: [0.95, 0.75, 0.4], segment_mesh: wheel });
    var source = tex.rect([0.62, 0.86], [0.045, 0.025]).mul(pick(quality, 2, 2, 2.5));
    return {
      mpm: mpm,
      frameUpdate: function (t, frameDt) {
        if (t < 3) mpm.add_particles({ type: 'water', pd_source: true, density_tex: source, delta_t: frameDt, initial_velocity: [0, -1.5], density: 1000, color: [0.3, 0.6, 1.0] });
      },
    };
  },
});

defineScene({
  id: 'buoyancy', name: 'Buoyancy', dim: 2, original: 'buoyancy.py (2D)',
  description: 'Solid rigid bodies of different densities (300–2500 kg/m³) splash into a water tank. CPIC pressure impulses make light bodies float while the heavy one sinks.',
  features: ['Water', 'Solid rigid bodies', 'Two-way coupling'],
  frameDt: 0.01, duration: 5,
  setup: function (ctx) {
    var engine = ctx.engine, tex = ctx.tex, quality = ctx.quality;
    var r = pick(quality, 128, 160, 224);
    var mpm = new Solver(engine, 2, { res: [r, r], base_delta_t: (2e-4 * 160) / r, penalty: 0, pushing_force: 0 });
    var ls = mpm.create_levelset();
    ls.add_box([0.06, 0.06], [0.94, 1.5], true).set_friction(0);
    mpm.set_levelset(ls);
    mpm.add_particles({ type: 'water', density: 1000, color: [0.25, 0.55, 0.95], density_tex: tex.rect([0.5, 0.25], [0.85, 0.37]).mul(2) });
    var body = function (poly, pos, rot, density, color) {
      return mpm.add_particles({ type: 'rigid', codimensional: false, initial_position: pos, initial_rotation: rot, density: density, friction: 0.2, color: color, segment_mesh: polygonMesh(poly) });
    };
    body(boxPolygon(0.07, 0.03), [0.25, 0.68], 15, 300, [0.85, 0.65, 0.4]);
    body(boxPolygon(0.04, 0.04), [0.5, 0.75], 0, 650, [0.95, 0.85, 0.5]);
    body(boxPolygon(0.035, 0.025), [0.76, 0.7], -20, 2500, [0.6, 0.62, 0.7]);
    body(regularPolygon(16, 0.045), [0.62, 0.9], 0, 500, [0.95, 0.5, 0.45]);
    return { mpm: mpm };
  },
});

defineScene({
  id: 'sand-car', name: 'Motorized Crawler', dim: 2, original: 'robot.py (2D)',
  description: 'A rigid car body with two spiked wheels driven by motor articulations crawls over a sand bed and climbs a hill. Wheels push sand backwards through two-way coupling.',
  features: ['Motor articulation', 'Sand', 'Solid rigid bodies'],
  frameDt: 0.01, duration: 3,
  setup: function (ctx) {
    var engine = ctx.engine, tex = ctx.tex, quality = ctx.quality;
    var r = pick(quality, 128, 160, 224);
    var mpm = new Solver(engine, 2, { res: [r, r], base_delta_t: (1.5e-4 * 160) / r, penalty: 0, pushing_force: 0 });
    var ls = mpm.create_levelset();
    ls.add_plane([0, 1], -0.06).add_plane([1, 0], -0.06).add_plane([-1, 0], 0.94).set_friction(0.6);
    mpm.set_levelset(ls);
    mpm.add_particles({ type: 'sand', density: 1600, friction_angle: 40, color: [0.9, 0.72, 0.45], density_tex: tex.rect([0.5, 0.13], [0.86, 0.13]).mul(3) });
    mpm.add_particles({ type: 'sand', density: 1600, friction_angle: 40, color: [0.85, 0.6, 0.38], density_tex: tex.polygon([[0.55, 0.19], [0.8, 0.19], [0.67, 0.27]]).mul(3) });
    var car = mpm.add_particles({ type: 'rigid', codimensional: false, initial_position: [0.25, 0.32], density: 800, friction: 0.4, angular_damping: 2, color: [0.4, 0.75, 0.95], segment_mesh: polygonMesh(boxPolygon(0.09, 0.02)) });
    for (var x of [0.17, 0.33]) {
      var w = mpm.add_particles({ type: 'rigid', codimensional: false, initial_position: [x, 0.25], density: 500, friction: 0.8, angular_damping: 2, color: [0.95, 0.55, 0.4], segment_mesh: polygonMesh(starPolygon(10, 0.045, 0.034)) });
      mpm.add_articulation({ type: 'motor', obj0: w, obj1: car, power: -0.8, penalty: 1e4 });
    }
    return { mpm: mpm };
  },
});

defineScene({
  id: 'materials', name: 'Material Zoo', dim: 2,
  description: 'Every constitutive model side by side: snow, jelly, sand, water, von Mises plasticity and Hencky elasticity — plus a dynamic rigid hammer.',
  features: ['Snow', 'Jelly', 'Sand', 'Water', 'Von Mises', 'Elastic'],
  frameDt: 0.01, duration: 4,
  setup: function (ctx) {
    var engine = ctx.engine, tex = ctx.tex, quality = ctx.quality;
    var r = pick(quality, 160, 200, 256);
    var mpm = new Solver(engine, 2, { res: [r, r], base_delta_t: 1.5e-4 * Math.min(1, 200 / r), penalty: 0, pushing_force: 0 });
    var ls = mpm.create_levelset();
    ls.add_plane([0, 1], -0.06).add_plane([1, 0], -0.06).add_plane([-1, 0], 0.94).set_friction(0.4);
    mpm.set_levelset(ls);
    var ppc = 4;
    var mats = [
      ['snow', { youngs_modulus: 3e4, hardening: 10, density: 400 }, [0.92, 0.96, 1.0]],
      ['jelly', { E: 2e4, nu: 0.3, density: 400 }, [0.96, 0.42, 0.56]],
      ['sand', { density: 1000, friction_angle: 35 }, [0.93, 0.76, 0.45]],
      ['water', { density: 1000 }, [0.3, 0.6, 1.0]],
      ['von_mises', { youngs_modulus: 4e4, yield_stress: 200, density: 600 }, [0.55, 0.85, 0.4]],
      ['elastic', { E: 3e4, nu: 0.3, density: 400 }, [0.98, 0.62, 0.25]],
    ];
    mats.forEach(function (m, i) {
      var x = 0.15 + i * 0.14;
      mpm.add_particles(Object.assign({ type: m[0], color: m[2], density_tex: tex.rect([x, 0.5 + (i % 2) * 0.12], [0.11, 0.14]).mul(ppc) }, m[1]));
    });
    mpm.add_particles({ type: 'rigid', codimensional: false, initial_position: [0.5, 0.86], initial_rotation: 8, density: 400, friction: 0.3, color: [0.7, 0.72, 0.8], segment_mesh: polygonMesh(boxPolygon(0.2, 0.025)) });
    return { mpm: mpm };
  },
});

defineScene({
  id: 'water-wheel-3d', name: '3D Water Wheel', dim: 3, original: 'water_wheel.py',
  description: 'The paper\u2019s water wheel: a falling water column drives a thin-shell paddle wheel articulated to its side plates, rotating about the z axis.',
  features: ['3D water', 'Thin-shell meshes', 'Rotation articulation', 'PD source'],
  frameDt: 0.01, duration: 4,
  camera: { target: [0.5, 0.42, 0.5], distance: 1.25, yaw: 28, pitch: 18 },
  decor: [{ kind: 'floor', y: 0.2 }],
  setup: function (ctx) {
    var engine = ctx.engine, tex = ctx.tex, quality = ctx.quality;
    var r = pick(quality, 40, 56, 72);
    var mpm = new Solver(engine, 3, { res: [r, r, r], base_delta_t: (3e-4 * 56) / r, penalty: 1e3, rigid_body_collision: false, pushing_force: 0 });
    var ls = mpm.create_levelset();
    ls.add_plane([0, 1, 0], -0.2).set_friction(0);
    mpm.set_levelset(ls);
    var common = { type: 'rigid', codimensional: true, density: 20, friction: 0.2, scripted_position: constant([0.5, 0.48, 0.5]), rotation_axis: [0, 0, 1], angular_damping: 1 };
    var a = mpm.add_particles(Object.assign({}, common, { color: [0.95, 0.75, 0.4], mesh: paddleWheelMesh(8, 0.035, 0.14, 0.07) }));
    var b = mpm.add_particles(Object.assign({}, common, { color: [0.7, 0.72, 0.8], mesh: sidePlatesMesh(0.035, 0.14, 0.075) }));
    mpm.add_articulation({ type: 'rotation', obj0: a, obj1: b });
    var source = tex.cylinder([0.59, 0.76, 0.5], 0.032, 0.03, 1).mul(pick(quality, 4, 4, 5));
    return {
      mpm: mpm,
      frameUpdate: function (t, frameDt) {
        if (t < 3) mpm.add_particles({ type: 'water', pd_source: true, density_tex: source, delta_t: frameDt, initial_velocity: [0, -1.2, 0], density: 1000, color: [0.3, 0.6, 1.0] });
      },
    };
  },
});

defineScene({
  id: 'sand-stir-3d', name: '3D Sand Stirring', dim: 3, original: 'sand_stir.py',
  description: 'A scripted crossed-paddle stirrer rotates inside a cylindrical tank of sand, continuously cutting through the granular medium with CPIC.',
  features: ['3D sand', 'Scripted rotation', 'Thin-shell cutting'],
  frameDt: 0.01, duration: 4,
  camera: { target: [0.5, 0.3, 0.5], distance: 1.05, yaw: 20, pitch: 38 },
  decor: [{ kind: 'floor', y: 0.2 }, { kind: 'cylinder', center: [0.5, 0, 0.5], radius: 0.28, y0: 0.2, y1: 0.42 }],
  setup: function (ctx) {
    var engine = ctx.engine, tex = ctx.tex, quality = ctx.quality;
    var r = pick(quality, 40, 48, 64);
    var mpm = new Solver(engine, 3, { res: [r, r, r], base_delta_t: (3.5e-4 * 48) / r, penalty: 1e3, pushing_force: 0 });
    var ls = mpm.create_levelset();
    ls.add_cylinder([0.5, 0.5, 0.5], 0.28, true).add_plane([0, 1, 0], -0.2).set_friction(0.4);
    mpm.set_levelset(ls);
    mpm.add_particles({ type: 'sand', density: 1500, friction_angle: 35, color: [0.93, 0.72, 0.42], density_tex: tex.cylinder([0.5, 0.265, 0.5], 0.26, 0.12, 1).mul(2) });
    mpm.add_particles({ type: 'rigid', codimensional: true, friction: 0.3, color: [0.6, 0.8, 0.95], scripted_position: constant([0.5, 0.31, 0.5]), scripted_rotation: function (t) { return [0, 140 * t, 0]; }, mesh: crossPaddleMesh(0.16, 0.09) });
    return { mpm: mpm };
  },
});

defineScene({
  id: 'jelly-cut-3d', name: '3D Jelly Cutting', dim: 3,
  description: 'A jelly cube and a snowball fall onto zero-thickness blades. CPIC tracks which side of each triangle a particle lives on, slicing solids without remeshing.',
  features: ['3D jelly', 'Snow', 'Codimensional blades'],
  frameDt: 0.01, duration: 3,
  camera: { target: [0.5, 0.38, 0.5], distance: 1.1, yaw: 35, pitch: 22 },
  decor: [{ kind: 'floor', y: 0.2 }],
  setup: function (ctx) {
    var engine = ctx.engine, tex = ctx.tex, quality = ctx.quality;
    var r = pick(quality, 40, 56, 72);
    var mpm = new Solver(engine, 3, { res: [r, r, r], base_delta_t: (4e-4 * 56) / r, penalty: 1e3, pushing_force: 0 });
    var ls = mpm.create_levelset();
    ls.add_plane([0, 1, 0], -0.2).set_friction(0.4);
    mpm.set_levelset(ls);
    mpm.add_particles({ type: 'rigid', codimensional: true, friction: 0.1, color: [0.85, 0.88, 0.95], scripted_position: constant([0.36, 0.31, 0.5]), scripted_rotation: constant([0, 0, 0]), mesh: bladeMesh(0.11, 0.14) });
    mpm.add_particles({ type: 'rigid', codimensional: true, friction: 0.1, color: [0.95, 0.8, 0.45], scripted_position: constant([0.66, 0.31, 0.5]), scripted_rotation: constant([0, 0, 25]), mesh: bladeMesh(0.11, 0.14) });
    var ppc = pick(quality, 6, 6, 8);
    mpm.add_particles({ type: 'jelly', E: 2e4, nu: 0.3, density: 400, color: [0.96, 0.42, 0.56], density_tex: tex.rect([0.36, 0.56, 0.5], [0.17, 0.13, 0.17]).mul(ppc) });
    mpm.add_particles({ type: 'snow', youngs_modulus: 2e4, hardening: 6, density: 400, color: [0.92, 0.96, 1.0], density_tex: tex.sphere([0.66, 0.6, 0.5], 0.08).mul(ppc) });
    return { mpm: mpm };
  },
});

defineScene({
  id: 'rigid-pile-3d', name: '3D Rigids in Water', dim: 3,
  description: 'Four rigid boxes of different densities fall into a water pool. Rigid contacts use Minkowski Portal Refinement; buoyancy comes from two-way MPM coupling.',
  features: ['3D water', 'Solid rigid meshes', 'MPR collisions'],
  frameDt: 0.01, duration: 4,
  camera: { target: [0.5, 0.36, 0.5], distance: 1.15, yaw: 30, pitch: 28 },
  decor: [{ kind: 'box', lower: [0.2, 0.2, 0.2], upper: [0.8, 0.52, 0.8] }],
  setup: function (ctx) {
    var engine = ctx.engine, tex = ctx.tex, quality = ctx.quality;
    var r = pick(quality, 40, 48, 64);
    var mpm = new Solver(engine, 3, { res: [r, r, r], base_delta_t: (3.5e-4 * 48) / r, penalty: 0, rigid_penalty: 1e3, pushing_force: 0 });
    var ls = mpm.create_levelset();
    ls.add_box([0.2, 0.2, 0.2], [0.8, 1.5, 0.8], true).set_friction(0.1);
    mpm.set_levelset(ls);
    mpm.add_particles({ type: 'water', density: 1000, color: [0.3, 0.6, 1.0], density_tex: tex.rect([0.5, 0.27, 0.5], [0.58, 0.13, 0.58]).mul(pick(quality, 1.5, 1.5, 2)) });
    var box = function (h, pos, rot, density, color) {
      return mpm.add_particles({ type: 'rigid', codimensional: false, initial_position: pos, initial_rotation: rot, density: density, friction: 0.3, restitution: 0.1, color: color, mesh: boxMesh(h[0], h[1], h[2]) });
    };
    box([0.05, 0.05, 0.05], [0.44, 0.44, 0.47], [0, 20, 0], 400, [0.85, 0.65, 0.4]);
    box([0.04, 0.04, 0.04], [0.5, 0.56, 0.53], [30, 10, 45], 700, [0.95, 0.85, 0.5]);
    box([0.08, 0.03, 0.05], [0.43, 0.66, 0.56], [10, 40, 0], 300, [0.6, 0.8, 0.95]);
    box([0.035, 0.035, 0.035], [0.58, 0.75, 0.45], [15, 0, 30], 2500, [0.6, 0.62, 0.7]);
    return { mpm: mpm };
  },
});