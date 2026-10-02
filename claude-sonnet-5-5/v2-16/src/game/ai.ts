import type { Game, Company, Station } from './sim';
import { CATCH, LOCOS } from './data';
import type { Town, Industry } from './world';
import { W } from './data';

type Node = Town | Industry;
const AI_STATION_COST = 800;

const kindOf = (n: Node) => (n.kind === 'town' ? 'town' : n.ik);
function compatible(a: Node, b: Node) {
  const ka = kindOf(a), kb = kindOf(b);
  const pair = (x: string, y: string) => (ka === x && kb === y) || (ka === y && kb === x);
  return pair('town', 'town') || pair('mine', 'factory') || pair('mine', 'town') || pair('farm', 'town') || pair('lumber', 'factory') || pair('factory', 'town');
}
function rate(n: Node) {
  if (n.kind === 'town') return n.pop / 9 + n.pop / 28;
  if (n.ik === 'mine') return 24 * n.level;
  if (n.ik === 'farm') return 22 * n.level;
  if (n.ik === 'lumber') return 20 * n.level;
  return 30 * n.level;
}

function planStation(g: Game, c: Company, n: Node, other: Node): { st?: Station; x: number; y: number } | null {
  const ex = g.stations.find((s) => s.owner === c.id && Math.abs(s.x - n.x) <= CATCH && Math.abs(s.y - n.y) <= CATCH);
  if (ex) return { st: ex, x: ex.x, y: ex.y };
  let best: { x: number; y: number } | null = null, bd = 1e9;
  for (let r = 0; r <= 2; r++) {
    for (let y = n.y - r; y <= n.y + r; y++) for (let x = n.x - r; x <= n.x + r; x++) {
      if (Math.max(Math.abs(x - n.x), Math.abs(y - n.y)) !== r) continue;
      if (g.canStation(x, y, c.id)) continue;
      const d = Math.abs(x - other.x) + Math.abs(y - other.y) + r * 3;
      if (d < bd) { bd = d; best = { x, y }; }
    }
    if (best) break;
  }
  return best;
}

function pickLoco(g: Game) {
  const years = g.monthCount / 12;
  if (years >= 8 && Math.random() < 0.5) return LOCOS[2];
  if (years >= 3.5) return LOCOS[1];
  return LOCOS[0];
}

function buildRoute(g: Game, c: Company): boolean {
  const nodes: Node[] = [...g.towns, ...g.inds];
  const chain = !!c.def?.boss && !c.spikeDone && !g.spike && Math.random() < 0.7;
  let pair: [Node, Node] | null = null;
  if (chain) {
    const ts = [...g.towns].sort((a, b) => a.x - b.x);
    for (let i = 0; i < ts.length - 1; i++) {
      const a = ts[i], b = ts[i + 1];
      if (c.failed.has(`${a.id}-${b.id}`)) continue;
      if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 36) continue;
      if (!g.townsConnected(c.id, a, b)) { pair = [a, b]; break; }
    }
  }
  if (!pair) {
    const cands: { a: Node; b: Node; s: number }[] = [];
    for (const a of nodes) for (const b of nodes) {
      if (a.id >= b.id || !compatible(a, b)) continue;
      const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (d < 6 || d > 26 || c.failed.has(`${a.id}-${b.id}`)) continue;
      if (c.routes.some((r) => { const sa = g.st(r.a), sb = g.st(r.b); return sa && sb && ((Math.abs(sa.x - a.x) <= CATCH && Math.abs(sb.x - b.x) <= CATCH && Math.abs(sa.y - a.y) <= CATCH && Math.abs(sb.y - b.y) <= CATCH)); })) continue;
      cands.push({ a, b, s: ((rate(a) + rate(b)) * Math.min(d, 16)) / (d + 8) * (0.6 + Math.random() * 0.8) });
    }
    cands.sort((x, y) => y.s - x.s);
    const top = cands.slice(0, 3);
    if (!top.length) return false;
    const p = top[Math.floor(Math.random() * top.length)];
    pair = [p.a, p.b];
  }
  const [a, b] = pair;
  const key = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
  const keyAlt = `${a.id}-${b.id}`;
  const pa = planStation(g, c, a, b), pb = planStation(g, c, b, a);
  if (!pa || !pb) { c.failed.add(key); c.failed.add(keyAlt); return false; }
  const ta = g.idx(pa.x, pa.y), tb = g.idx(pb.x, pb.y);
  if (ta === tb) { c.failed.add(key); c.failed.add(keyAlt); return false; }
  const path = g.findPath(ta, tb, c.id);
  if (!path) { c.failed.add(key); c.failed.add(keyAlt); return false; }
  const loco = pickLoco(g);
  const nTrains = Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 14 ? 2 : 1;
  const cost = g.pathCost(path, c.id) + (pa.st ? 0 : AI_STATION_COST) + (pb.st ? 0 : AI_STATION_COST) + loco.cost * nTrains;
  const room = g.creditLimit(c) - c.loan;
  if (cost > c.cash + room * 0.9) { c.nextThink = g.t + 8; return false; }
  if (cost > c.cash) { const b2 = Math.min(room, Math.ceil(cost - c.cash + 1500)); c.loan += b2; c.cash += b2; }
  const sa = pa.st || g.addStation(c.id, pa.x, pa.y);
  const sb = pb.st || g.addStation(c.id, pb.x, pb.y);
  if (!sa || !sb) return false;
  if (!pa.st) c.cash -= AI_STATION_COST;
  if (!pb.st) c.cash -= AI_STATION_COST;
  const tc = g.pathCost(path, c.id);
  g.layTrack(path, c.id);
  c.cash -= tc;
  for (let i = 0; i < nTrains; i++) {
    const r = g.buyTrain(c.id, loco.id, sa.id, sb.id);
    if (r.ok && 'id' in r) {
      const tr = g.trains.find((t) => t.id === r.id);
      if (tr && a.kind === 'ind') tr.sched[0].order = 'full';
      if (tr && i === 1) { tr.si = 1; tr.path = [sb.tile]; }
    }
  }
  c.routes.push({ a: sa.id, b: sb.id });
  if (g.tut.done) g.addNews(`${c.name} opens a line between ${sa.name} and ${sb.name}.`, 'info');
  return true;
}

function addTrain(g: Game, c: Company): boolean {
  for (const r of c.routes) {
    const sa = g.st(r.a), sb = g.st(r.b);
    if (!sa || !sb) continue;
    const n = g.trains.filter((t) => t.owner === c.id && t.sched.length === 2 && t.sched[0].st === r.a && t.sched[1].st === r.b).length;
    const waiting = [sa, sb].reduce((s, st) => s + Object.values(st.cargo).reduce((x, arr) => x + arr.reduce((y, p) => y + p.n, 0), 0), 0);
    if (n < 3 && waiting > 90 && g.edge(sa.tile, sa.tile) === false) {
      const loco = pickLoco(g);
      if (c.cash > loco.cost + 2500) { g.buyTrain(c.id, loco.id, r.a, r.b); return true; }
    }
  }
  return false;
}

export function aiThink(g: Game, c: Company) {
  const def = c.def;
  if (!def) return;
  const years = g.monthCount / 12;
  const diffBuild = g.diff.id === 'settler' ? 0.7 : g.diff.id === 'baron' ? 1.3 : 1;
  c.nextThink = g.t + (16 / (def.build * diffBuild * (1 + years * 0.05))) * (0.8 + Math.random() * 0.5);
  if (c.failed.size > 24) c.failed.clear();
  if (c.cash < 4000) { const b = Math.min(8000, g.creditLimit(c) - c.loan); if (b > 0) { c.loan += b; c.cash += b; } }
  if (g.ruins.some((r) => r.owner === c.id)) { g.repairRuins(c.id); }
  const want = 2 + years * 1.0;
  if (c.routes.length < want || Math.random() < 0.45) {
    if (!buildRoute(g, c)) addTrain(g, c);
  } else if (!addTrain(g, c)) buildRoute(g, c);
  // repay debt when flush
  if (c.cash > 30000 && c.loan > 0) { const p = Math.min(c.loan, 8000); c.loan -= p; c.cash -= p; }
  // stock play against the player
  if (def.boss && g.diff.takeover && g.t > 100 && c.cash > 20000) {
    const pubs = g.hold[0][-1] || 0;
    const stake = (g.hold[0][0] || 0) / g.pl.shares;
    const hunt = stake < 0.62;
    if (pubs > 0 && (hunt || Math.random() < 0.25)) {
      const n = Math.min(pubs, hunt ? 90 : 30, Math.floor((c.cash * (hunt ? 0.7 : 0.3)) / Math.max(1, g.pl.price * 1.05)));
      if (n > 0) {
        g.buyShares(c.id, 0, n);
        if (hunt && g.hold[0][c.id] > g.pl.shares * 0.3 && Math.random() < 0.4) g.addNews(`${c.name} is quietly accumulating shares of your company (${Math.round((g.hold[0][c.id] / g.pl.shares) * 100)}%)!`, 'warn');
      }
    }
  }
  void W;
}
