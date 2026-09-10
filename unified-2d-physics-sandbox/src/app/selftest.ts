// Headless verification of the physics core and persistence, run with `?selftest` in the URL.
// Uses throw-away World instances so the live scene is untouched. Results are logged to the console.
import { World } from '../sim/world';
import { defaultScene, emptyScene, makeRigidDef, makeSoftDef, makeRegionDef, makeConstraintDef } from '../sim/schema';
import { validateScene, parseSceneJson } from '../sim/validate';
import { sanitizePolygon } from '../sim/geometry';
import { getVelocity } from '../sim/rigid';

export interface TestResult { name: string; pass: boolean; info: string }
const DT = 1 / 60;

function run(name: string, fn: () => string | boolean, out: TestResult[]) {
  try {
    const r = fn();
    out.push({ name, pass: r !== false, info: typeof r === 'string' ? r : '' });
  } catch (e) { out.push({ name, pass: false, info: `threw: ${(e as Error).message}` }); }
}

const finiteWorld = (w: World) => w.fluid.isFinite() && [...w.soft.values()].every(s => s.isFinite()) && [...w.rigid.values()].every(e => Number.isFinite(e.body.position.x) && Number.isFinite(e.body.position.y));
const steps = (w: World, n: number) => { for (let i = 0; i < n; i++) w.step(DT); };

function fluidMeanSpeed(w: World) {
  const f = w.fluid; let s = 0;
  for (let i = 0; i < f.numParticles; i++) s += Math.hypot(f.vel[2 * i], f.vel[2 * i + 1]);
  return f.numParticles ? s / f.numParticles : 0;
}

function poolScene(extra: (s: ReturnType<typeof emptyScene>) => void) {
  const s = emptyScene();
  s.fluid.maxParticles = 6000; s.fluid.cellSize = 25;
  s.fluidRegions.push(makeRegionDef({ id: 'pool', type: 'fill', x: 0, y: 600, w: 1600, h: 400 }));
  extra(s);
  return s;
}

export function runSelfTests(): TestResult[] {
  const out: TestResult[] = [];

  run('default scene builds & runs 10 s without NaN/explosion', () => {
    const w = new World(defaultScene());
    steps(w, 600);
    const maxSpeed = Math.max(...[...w.rigid.values()].map(e => Math.hypot(getVelocity(e.body).x, getVelocity(e.body).y)));
    return finiteWorld(w) && maxSpeed < 4000 ? `particles=${w.fluid.numParticles} maxRigidSpeed=${maxSpeed.toFixed(0)}` : false;
  }, out);

  run('fluid moves through solver and settles (energy decays)', () => {
    const s = emptyScene(); s.fluid.cellSize = 25;
    s.fluidRegions.push(makeRegionDef({ id: 'blk', type: 'fill', x: 100, y: 100, w: 400, h: 400 }));
    const w = new World(s);
    steps(w, 20); const early = fluidMeanSpeed(w);
    steps(w, 600); const late = fluidMeanSpeed(w);
    const f = w.fluid; let maxY = 0; for (let i = 0; i < f.numParticles; i++) maxY = Math.max(maxY, f.pos[2 * i + 1]);
    return early > 100 && late < early * 0.3 && maxY > 900 ? `early=${early.toFixed(0)} late=${late.toFixed(0)} settledY=${maxY.toFixed(0)}` : `early=${early.toFixed(0)} late=${late.toFixed(0)}`;
  }, out);

  run('FLIP ratio changes behaviour (PIC damps more than FLIP)', () => {
    const mk = (ratio: number) => { const s = emptyScene(); s.fluid.cellSize = 25; s.fluid.flipRatio = ratio; s.fluidRegions.push(makeRegionDef({ id: 'b', type: 'fill', x: 100, y: 100, w: 400, h: 400 })); return new World(s); };
    const a = mk(0), b = mk(0.95);
    steps(a, 150); steps(b, 150);
    const sa = fluidMeanSpeed(a), sb = fluidMeanSpeed(b);
    return sb > sa * 1.15 ? `PIC=${sa.toFixed(0)} FLIP=${sb.toFixed(0)}` : `PIC=${sa.toFixed(0)} FLIP=${sb.toFixed(0)} (expected FLIP livelier)`;
  }, out);

  run('light rigid body floats, heavy one sinks (pressure coupling)', () => {
    const s = poolScene(sc => {
      sc.bodies.push(makeRigidDef({ id: 'light', shape: 'rect', x: 400, y: 500, w: 100, h: 100, density: 0.3 }));
      sc.bodies.push(makeRigidDef({ id: 'heavy', shape: 'rect', x: 1200, y: 500, w: 100, h: 100, density: 3 }));
    });
    const w = new World(s);
    steps(w, 480);
    const yl = w.rigid.get('light')!.body.position.y, yh = w.rigid.get('heavy')!.body.position.y;
    return finiteWorld(w) && yl < 720 && yh > 880 ? `light y=${yl.toFixed(0)} heavy y=${yh.toFixed(0)}` : `light y=${yl.toFixed(0)} heavy y=${yh.toFixed(0)}`;
  }, out);

  run('falling body displaces fluid (particles move up near impact)', () => {
    const s = poolScene(sc => sc.bodies.push(makeRigidDef({ id: 'b', shape: 'circle', x: 800, y: 300, radius: 60, density: 2 })));
    const w = new World(s);
    steps(w, 60);
    const f = w.fluid; let up = 0;
    for (let i = 0; i < f.numParticles; i++) if (f.vel[2 * i + 1] < -50) up++;
    return up > 10 ? `${up} particles moving upward` : `${up} particles moving upward`;
  }, out);

  run('soft body deforms on impact and recovers area', () => {
    const s = emptyScene();
    s.softBodies.push(makeSoftDef({ id: 'sb', shape: 'blob', x: 800, y: 300, radius: 90, density: 0.6 }));
    const w = new World(s);
    const sb0 = w.soft.get('sb')!, rest = sb0.restArea;
    let minH = Infinity, maxDev = 0;
    for (let i = 0; i < 240; i++) { w.step(DT); const sb = w.soft.get('sb')!; const h = sb.maxY - sb.minY; minH = Math.min(minH, h); maxDev = Math.max(maxDev, Math.abs(sb.area() - rest) / rest); }
    const sb = w.soft.get('sb')!;
    const finalDev = Math.abs(sb.area() - rest) / rest;
    return sb.maxY > 990 && minH < 175 && finalDev < 0.08 && sb.isFinite() ? `minHeight=${minH.toFixed(0)} (rest 180) maxAreaDev=${(maxDev * 100).toFixed(1)}% final=${(finalDev * 100).toFixed(1)}%` : `minHeight=${minH.toFixed(0)} finalDev=${(finalDev * 100).toFixed(1)}% bottom=${sb.maxY.toFixed(0)}`;
  }, out);

  run('soft body collides with rigid ledge and stays on it', () => {
    const s = emptyScene();
    s.bodies.push(makeRigidDef({ id: 'ledge', shape: 'rect', x: 800, y: 700, w: 600, h: 30, isStatic: true }));
    s.softBodies.push(makeSoftDef({ id: 'sb', shape: 'rect', x: 800, y: 400, w: 200, h: 80 }));
    const w = new World(s);
    steps(w, 300);
    const sb = w.soft.get('sb')!;
    return sb.isFinite() && sb.maxY < 700 && sb.maxY > 660 ? `bottom=${sb.maxY.toFixed(1)} (ledge top 685)` : `bottom=${sb.maxY.toFixed(1)}`;
  }, out);

  run('soft body in fluid receives buoyancy', () => {
    const s = poolScene(sc => sc.softBodies.push(makeSoftDef({ id: 'sb', shape: 'blob', x: 800, y: 450, radius: 80, density: 0.4 })));
    const w = new World(s);
    steps(w, 480);
    const sb = w.soft.get('sb')!; const c = new Float32Array(2); sb.centroid(c);
    return sb.isFinite() && c[1] < 760 ? `centroid y=${c[1].toFixed(0)} (pool surface≈600-650, floor 1000)` : `centroid y=${c[1].toFixed(0)}`;
  }, out);

  run('soft body resting on a dynamic body pushes it (reaction)', () => {
    const s = emptyScene();
    s.bodies.push(makeRigidDef({ id: 'plank', shape: 'rect', x: 800, y: 900, w: 300, h: 30, density: 0.2 }));
    s.bodies.push(makeRigidDef({ id: 'pivot', shape: 'circle', x: 800, y: 960, radius: 25, isStatic: true }));
    s.softBodies.push(makeSoftDef({ id: 'sb', shape: 'blob', x: 900, y: 700, radius: 60, density: 2 }));
    const w = new World(s);
    steps(w, 240);
    const b = w.rigid.get('plank')!.body;
    return Number.isFinite(b.angle) && Math.abs(b.angle) > 0.05 ? `plank tilted ${(b.angle * 57.3).toFixed(1)}°` : `plank angle ${(b.angle * 57.3).toFixed(1)}°`;
  }, out);

  run('polygon validation rejects malformed input', () => {
    const tooFew = sanitizePolygon([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    const zeroArea = sanitizePolygon([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]);
    const bowtie = sanitizePolygon([{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }]);
    const nan = sanitizePolygon([{ x: 0, y: 0 }, { x: NaN, y: 100 }, { x: 100, y: 0 }]);
    const ok = sanitizePolygon([{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 0 }]);
    return !tooFew.ok && !zeroArea.ok && !bowtie.ok && !nan.ok && ok.ok ? 'few/zero-area/self-intersecting/NaN rejected, square accepted' : false;
  }, out);

  run('concave custom rigid polygon decomposes into a valid body', () => {
    const s = emptyScene();
    const L = [{ x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 50 }, { x: -50, y: 50 }];
    s.bodies.push(makeRigidDef({ id: 'L', shape: 'polygon', x: 800, y: 300, vertices: L, radius: 70 }));
    const w = new World(s);
    const b = w.rigid.get('L')?.body;
    if (!b) return false;
    steps(w, 200);
    return b.parts.length > 2 && Number.isFinite(b.position.y) && b.position.y > 800 ? `${b.parts.length - 1} convex parts, rests at y=${b.position.y.toFixed(0)}` : false;
  }, out);

  run('delete body removes attached constraints; duplicate is independent', () => {
    const s = emptyScene();
    s.bodies.push(makeRigidDef({ id: 'a', x: 300, y: 300 }), makeRigidDef({ id: 'b', x: 500, y: 300 }));
    s.constraints.push(makeConstraintDef({ id: 'c', kind: 'spring', bodyA: 'a', bodyB: 'b', length: 200 }));
    const w = new World(s);
    const dup = w.duplicate(['a', 'b', 'c']);
    const dupOk = dup.length === 3 && w.rigid.size === 4 && w.constraints.size === 2 && !dup.includes('a');
    w.removeRigid('a');
    const cleaned = !w.constraints.has('c') && w.constraints.size === 1 && w.rigid.size === 3;
    steps(w, 30);
    return dupOk && cleaned && finiteWorld(w) ? 'ok' : `dupOk=${dupOk} cleaned=${cleaned}`;
  }, out);

  run('reset restores authored state; clear empties scene', () => {
    const w = new World(defaultScene());
    const y0 = w.rigid.get('rb_ball')!.body.position.y;
    steps(w, 120);
    const moved = Math.abs(w.rigid.get('rb_ball')!.body.position.y - y0) > 50;
    w.reset();
    const restored = Math.abs(w.rigid.get('rb_ball')!.body.position.y - y0) < 1e-6 && w.fluid.numParticles > 0;
    w.clear();
    const cleared = w.rigid.size === 0 && w.soft.size === 0 && w.constraints.size === 0 && w.fluid.numParticles === 0;
    return moved && restored && cleared ? 'ok' : `moved=${moved} restored=${restored} cleared=${cleared}`;
  }, out);

  run('export → validate → import round-trips the scene', () => {
    const w = new World(defaultScene());
    steps(w, 30);
    const text = JSON.stringify(w.snapshot());
    const res = parseSceneJson(text);
    if (!res.ok || !res.scene) return `validation failed: ${res.errors.join(',')}`;
    const w2 = new World(res.scene);
    return w2.rigid.size === w.rigid.size && w2.soft.size === w.soft.size && w2.constraints.size === w.constraints.size && w2.regions.size === w.regions.size ? `${w2.rigid.size} rigid, ${w2.soft.size} soft, ${w2.constraints.size} constraints` : false;
  }, out);

  run('invalid imports are rejected without throwing', () => {
    const bad = [parseSceneJson('{not json'), validateScene(null), validateScene({ version: 99 }), validateScene({ version: 1, bodies: [{ id: 'x', x: NaN }], constraints: [{ id: 'c', bodyA: 'missing' }] })];
    const last = bad[3];
    const dropped = last.ok && last.scene!.constraints.length === 0 && last.scene!.bodies.length === 1 && Number.isFinite(last.scene!.bodies[0].x);
    return !bad[0].ok && !bad[1].ok && !bad[2].ok && dropped ? 'invalid JSON / null / bad version rejected; dangling constraint dropped, NaN sanitised' : false;
  }, out);

  run('emitter adds particles while running; sensor bodies ignored by fluid', () => {
    const s = emptyScene();
    s.fluidRegions.push(makeRegionDef({ id: 'em', type: 'emitter', x: 700, y: 100, w: 100, h: 40, rate: 600 }));
    s.bodies.push(makeRigidDef({ id: 'sensor', shape: 'rect', x: 750, y: 500, w: 400, h: 40, isStatic: true, isSensor: true }));
    const w = new World(s);
    steps(w, 300);
    const f = w.fluid; let below = 0; for (let i = 0; i < f.numParticles; i++) if (f.pos[2 * i + 1] > 600) below++;
    return f.numParticles > 200 && below > f.numParticles * 0.5 ? `${f.numParticles} emitted, ${below} passed through sensor` : `${f.numParticles} emitted, ${below} below`;
  }, out);

  return out;
}

export function reportSelfTests(): TestResult[] {
  const t0 = performance.now();
  const results = runSelfTests();
  const passed = results.filter(r => r.pass).length;
  console.group(`[selftest] ${passed}/${results.length} passed in ${(performance.now() - t0).toFixed(0)} ms`);
  for (const r of results) (r.pass ? console.info : console.error)(`${r.pass ? 'PASS' : 'FAIL'} — ${r.name}${r.info ? ` — ${r.info}` : ''}`);
  console.groupEnd();
  return results;
}
