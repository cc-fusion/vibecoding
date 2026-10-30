import { MPM, SegmentMesh, TriangleMesh, TextureFactory } from './engine.js';
import { SCENES as ORIGINAL_SCENES } from './scenes.js';

export const MATERIALS = ['water', 'jelly', 'snow', 'sand', 'von_mises', 'elastic'];
export const PALETTE = { water: '#57b8f5', jelly: '#e68ccf', snow: '#e3edf9', sand: '#efbc7e', von_mises: '#91d6aa', elastic: '#f5a17f' };
export const clone = (value) => JSON.parse(JSON.stringify(value));
export function hexColor(color, fallback = '#8d72f3') {
  if (Array.isArray(color)) return color;
  const s = /^#[0-9a-f]{6}$/i.test(color || '') ? color : fallback;
  return [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
}
export function validateScene(scene) {
  if (!scene || typeof scene !== 'object' || Array.isArray(scene)) throw new Error('A scene must be a JSON object.');
  if (scene.dim !== 2 && scene.dim !== 3) throw new Error('scene.dim must be 2 or 3.');
  if (scene.objects !== undefined && !Array.isArray(scene.objects)) throw new Error('scene.objects must be an array.');
  const dimension = scene.dim;
  const vec = (v, name, length = dimension) => {
    if (!Array.isArray(v) || v.length !== length || v.some(x => !Number.isFinite(x))) throw new Error(`${name} must contain ${length} finite numbers.`);
  };
  if (scene.gravity) vec(scene.gravity, 'gravity');
  for (const [i, obj] of (scene.objects || []).entries()) {
    if (obj.type === 'particles' && !MATERIALS.includes(obj.material)) throw new Error(`Object ${i}: unknown material "${obj.material}".`);
    if (!['particles', 'rigid', 'emitter'].includes(obj.type)) throw new Error(`Object ${i}: use particles, rigid, or emitter.`);
    if (obj.center) vec(obj.center, `objects[${i}].center`);
    if (obj.size) vec(obj.size, `objects[${i}].size`);
    if (obj.velocity) vec(obj.velocity, `objects[${i}].velocity`);
    if (obj.radius !== undefined && (!Number.isFinite(obj.radius) || obj.radius <= 0)) throw new Error(`objects[${i}].radius must be a positive number.`);
    if (obj.shape === 'polygon' && (!Array.isArray(obj.points) || obj.points.length < 3)) throw new Error(`Object ${i}: a polygon needs at least 3 points.`);
  }
  if (scene.levelset !== undefined) {
    const spec = scene.levelset;
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('scene.levelset must be an object.');
    for (const [i, plane] of (spec.planes || []).entries()) {
      vec(plane.normal, `levelset.planes[${i}].normal`);
      if (!Number.isFinite(plane.d)) throw new Error(`levelset.planes[${i}].d must be finite.`);
    }
    for (const kind of ['boxes', 'spheres', 'cylinders', 'polygons']) {
      if (spec[kind] !== undefined && !Array.isArray(spec[kind])) throw new Error(`levelset.${kind} must be an array.`);
    }
    for (const [i, box] of (spec.boxes || []).entries()) { vec(box.lower, `levelset.boxes[${i}].lower`); vec(box.upper, `levelset.boxes[${i}].upper`); }
    for (const [i, sphere] of (spec.spheres || []).entries()) { vec(sphere.center, `levelset.spheres[${i}].center`); if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) throw new Error(`levelset.spheres[${i}].radius must be positive.`); }
    for (const [i, cylinder] of (spec.cylinders || []).entries()) { vec(cylinder.center, `levelset.cylinders[${i}].center`); if (!Number.isFinite(cylinder.radius) || cylinder.radius <= 0) throw new Error(`levelset.cylinders[${i}].radius must be positive.`); }
    for (const [i, polygon] of (spec.polygons || []).entries()) { if (dimension !== 2) throw new Error('Polygon level sets are supported only in 2D.'); if (!Array.isArray(polygon.points) || polygon.points.length < 3) throw new Error(`levelset.polygons[${i}].points needs at least 3 vertices.`); }
    if (spec.friction !== undefined && !Number.isFinite(spec.friction)) throw new Error('levelset.friction must be finite.');
  }
  if (scene.resolution !== undefined && (!Number.isFinite(scene.resolution) || scene.resolution < 32 || scene.resolution > 384)) throw new Error('resolution must be between 32 and 384.');
  return true;
}

export const DEFAULT_SCENE = {
  id: 'my-first-scene', name: 'My first scene', description: 'A tiny experiment with big possibilities. Made entirely from JSON.', dim: 2,
  resolution: 160, duration: 0, frameDt: 0.01, gravity: [0, -9.81], boundaries: { floor: true, walls: true, friction: 0.4 },
  objects: [
    { id: 'jelly', type: 'particles', material: 'jelly', shape: 'rect', center: [0.32, 0.61], size: [0.17, 0.2], color: '#e68ccf', density: 4 },
    { id: 'water', type: 'particles', material: 'water', shape: 'sphere', center: [0.69, 0.53], radius: 0.11, color: '#57b8f5', density: 4 },
    { id: 'wheel', type: 'rigid', shape: 'wheel', center: [0.5, 0.25], radius: 0.14, blades: 8, color: '#e9b870', motion: { speed: 90, enabled: true } },
    { id: 'snow', type: 'particles', material: 'snow', shape: 'rect', center: [0.5, 0.82], size: [0.15, 0.13], color: '#e3edf9', density: 4 },
  ],
};

function segmentsFor(shape, radius, blades = 8, dim = 2, size = [0.2, 0.03]) {
  const m = new SegmentMesh();
  if (shape === 'box' || shape === 'rect' || shape === 'blade') {
    const w = (shape === 'blade' ? size[0] || 0.2 : size[0]) / 2;
    const h = (size[1] ?? 0.03) / 2;
    const pts = shape === 'blade' ? [[-w, 0], [w, 0]] : [[-w, -h], [w, -h], [w, h], [-w, h]];
    for (let i = 0; i < pts.length; i++) if (shape !== 'blade' || i === 0) m.add_segment(pts[i], pts[(i + 1) % pts.length]);
  } else {
    const count = 40;
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2, b = (i + 1) / count * Math.PI * 2;
      m.add_segment([radius * Math.cos(a), radius * Math.sin(a)], [radius * Math.cos(b), radius * Math.sin(b)]);
    }
    if (shape === 'wheel') for (let i = 0; i < blades; i++) {
      const a = i / blades * Math.PI * 2;
      m.add_segment([radius * 0.1 * Math.cos(a), radius * 0.1 * Math.sin(a)], [radius * Math.cos(a), radius * Math.sin(a)]);
    }
  }
  return m;
}
function mesh3D(shape, radius, size, blades = 8) {
  const triangles = [];
  const tri = (a, b, c) => triangles.push([a, b, c]);
  if (shape === 'sphere') {
    const p = (theta, phi) => [radius * Math.sin(theta) * Math.cos(phi), radius * Math.cos(theta), radius * Math.sin(theta) * Math.sin(phi)];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 12; j++) {
      const a = p(i / 8 * Math.PI, j / 12 * Math.PI * 2), b = p((i + 1) / 8 * Math.PI, j / 12 * Math.PI * 2);
      const c = p((i + 1) / 8 * Math.PI, (j + 1) / 12 * Math.PI * 2), d = p(i / 8 * Math.PI, (j + 1) / 12 * Math.PI * 2);
      tri(a, b, c); tri(a, c, d);
    }
  } else if (shape === 'wheel') {
    const depth = radius * 0.18;
    for (let i = 0; i < blades; i++) {
      const a = i / blades * Math.PI * 2, b = a + 0.12;
      const point = (r, angle, z) => [r * Math.cos(angle), r * Math.sin(angle), z];
      const p0 = point(radius * 0.08, a, -depth), p1 = point(radius, a, -depth), p2 = point(radius, b, depth), p3 = point(radius * 0.08, a, depth);
      tri(p0, p1, p2); tri(p0, p2, p3);
      tri(p3, p2, p1); tri(p3, p1, p0);
    }
  } else {
    const [hx, hy, hz] = size.map(v => v / 2);
    const v = [[-hx,-hy,-hz],[hx,-hy,-hz],[hx,hy,-hz],[-hx,hy,-hz],[-hx,-hy,hz],[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz]];
    [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[2,3,7],[2,7,6],[1,2,6],[1,6,5],[0,4,7],[0,7,3]].forEach(f => tri(...f.map(i => v[i])));
  }
  return TriangleMesh.fromTriangles(triangles);
}
function materialParameters(material) {
  return {
    water: { density: 1000, bulk_modulus: 1e4 }, jelly: { density: 400, E: 2e4, nu: 0.3 },
    snow: { density: 400, youngs_modulus: 3e4, hardening: 10 }, sand: { density: 1000, friction_angle: 35, cohesion: 0 },
    von_mises: { density: 600, youngs_modulus: 3e4, yield_stress: 150 }, elastic: { density: 400, E: 3e4, nu: 0.3 },
  }[material] || {};
}
function textureFor(tex, obj, dim) {
  const center = obj.center || (dim === 2 ? [0.5, 0.5] : [0.5, 0.5, 0.5]);
  const shape = obj.shape || 'sphere';
  const c = dim === 2 ? [center[0], center[1], 0.5] : center;
  if (shape === 'rect' || shape === 'box') return tex.rect(c, obj.size || Array(dim).fill(0.15));
  if (shape === 'polygon') return tex.polygon(obj.points || [[0.3,0.3],[0.7,0.3],[0.5,0.7]]);
  if (shape === 'ring') return tex.ring(obj.radius || 0.1, obj.innerRadius || 0.05, c);
  return tex.sphere(c, obj.radius || 0.1);
}

export function addObject(mpm, tex, obj, runtime, quality = 'medium') {
  const dim = mpm.dim;
  if (obj.type === 'particles' || obj.type === 'emitter') {
    const cfg = { ...materialParameters(obj.material), type: obj.material, color: hexColor(obj.color, PALETTE[obj.material]), density_tex: textureFor(tex, obj, dim).mul(obj.density ?? (quality === 'low' ? 2 : 4)) };
    if (obj.velocity) cfg.initial_velocity = obj.velocity;
    if (obj.type === 'emitter') { cfg.pd_source = true; cfg.delta_t = 0.01; }
    if (obj.massDensity) cfg.density = obj.massDensity;
    return mpm.add_particles(cfg);
  }
  const id = obj.id || 'rigid-' + Math.random().toString(36).slice(2, 7);
  const center = obj.center || [0.5, dim === 2 ? 0.35 : 0.5, 0.5].slice(0, dim);
  const rotation = obj.rotation ?? 0;
  const motion = { speed: obj.motion?.speed ?? 0, enabled: obj.motion?.enabled ?? false, center: [...center], angle: rotation, lastTime: mpm.engine?.time() || 0, ...runtime.controls?.[id] };
  runtime.controls[id] = motion;
  const scripted = obj.scripted !== false && (obj.motion || obj.automatic);
  const cfg = { type: 'rigid', codimensional: obj.codimensional ?? (obj.shape === 'wheel' || obj.shape === 'blade' || obj.shape === 'circle'), density: obj.massDensity || 400, friction: obj.friction ?? 0.3, color: hexColor(obj.color, '#e9b870'), restitution: obj.restitution ?? 0.1 };
  if (scripted) {
    cfg.scripted_position = () => motion.center;
    cfg.scripted_rotation = (t) => {
      if (motion.enabled) motion.angle += (t - motion.lastTime) * motion.speed;
      motion.lastTime = t;
      return dim === 2 ? motion.angle : [0, 0, motion.angle];
    };
  } else {
    cfg.initial_position = center;
    cfg.initial_rotation = rotation;
    if (obj.velocity) cfg.initial_velocity = obj.velocity;
  }
  const size = obj.size || [0.15, 0.035, 0.1];
  if (dim === 2) cfg.segment_mesh = segmentsFor(obj.shape || 'box', obj.radius || 0.12, obj.blades || 8, dim, size);
  else cfg.mesh = mesh3D(obj.shape || 'box', obj.radius || 0.1, size, obj.blades || 8);
  return mpm.add_particles(cfg);
}

export function buildScene(definition, ctx) {
  const def = clone(definition);
  validateScene(def);
  const { engine, quality, tex } = ctx;
  const dim = def.dim;
  const r = def.resolution || (dim === 2 ? 160 : 48);
  const resolution = Array(dim).fill(r);
  const mpm = new MPM(engine, dim, { res: resolution, base_delta_t: (dim === 2 ? 1.5e-4 : 3e-4) * (160 / r), penalty: 1000, pushing_force: 0, gravity: def.gravity || [0, -9.81, 0].slice(0, dim) });
  const runtime = { controls: {}, frameUpdate: null, emitters: [] };
  const ls = mpm.create_levelset();
  const boundarySpec = def.boundaries || {};
  const addDefaultBoundaries = !def.levelset || def.levelset.includeDefaultBoundaries === true;
  if (addDefaultBoundaries && boundarySpec.floor !== false) ls.add_plane([0, 1, 0].slice(0, dim), -0.06);
  if (addDefaultBoundaries && boundarySpec.walls !== false) {
    if (dim === 2) ls.add_plane([1, 0], -0.06).add_plane([-1, 0], 0.94);
    else ls.add_plane([1, 0, 0], -0.06).add_plane([-1, 0, 0], 0.94).add_plane([0, 0, 1], -0.06).add_plane([0, 0, -1], 0.94);
  }
  const custom = def.levelset || {};
  for (const plane of custom.planes || []) ls.add_plane(plane.normal, plane.d);
  for (const box of custom.boxes || []) ls.add_box(box.lower, box.upper, box.insideOut ?? box.inside_out ?? false);
  for (const sphere of custom.spheres || []) ls.add_sphere(sphere.center, sphere.radius, sphere.insideOut ?? sphere.inside_out ?? false);
  for (const cylinder of custom.cylinders || []) ls.add_cylinder(cylinder.center, cylinder.radius, cylinder.insideOut ?? cylinder.inside_out ?? false);
  for (const polygon of custom.polygons || []) ls.add_polygon(polygon.points, polygon.insideOut ?? polygon.inside_out ?? false);
  if (custom.friction !== undefined) ls.set_friction(custom.friction);
  else if (boundarySpec.friction !== undefined) ls.set_friction(boundarySpec.friction);
  mpm.set_levelset(ls);
  for (const obj of def.objects || []) {
    if (obj.type === 'emitter') runtime.emitters.push(obj);
    else addObject(mpm, tex, obj, runtime, quality);
  }
  return { mpm, runtime, frameUpdate: (t, dt) => {
    runtime.emitters.forEach((obj, i) => {
      if (t >= (obj.duration ?? 6)) return;
      addObject(mpm, tex, { ...obj, type: 'emitter' }, runtime, quality);
      // Particle sources are inserted at the current simulation time.
    });
  }};
}
export function getScenes() { return ORIGINAL_SCENES.map(s => ({ id: s.id, name: s.name, dim: s.dim, description: s.description, features: s.features, duration: s.duration })); }
export function sceneDefToJSON(scene) { return clone(scene); }
export function makeTextureFactory(engine, dim) { return new TextureFactory(engine, dim); }
export function findScene(id) { return ORIGINAL_SCENES.find(s => s.id === id); }
