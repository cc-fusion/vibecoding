import type { Game } from './engine';
import {
  RES_LIST, RES_INFO, SHIPS, FACTIONS, FIRST, LAST, ROLE_SPEC, LAB, labCost, labData, clamp, dist, emptyBag, WORLD_W, WORLD_H,
} from './data';
import type { Res, Crew, Spec, Trait, ShipKind, Ship, Wreck } from './data';
import { audio } from './audio';
import { spawnWreck, addGuards } from './worldgen';

/* ================= Market ================= */
export function initMarket(g: Game) {
  const one = emptyBag();
  RES_LIST.forEach((r) => (one[r] = 1));
  g.market = {
    demand: { ...one }, impact: { ...one },
    hist: { scrap: [], alloy: [], cores: [], data: [], relics: [] }, events: [], tickT: 0, fuelBase: 3,
  };
}
export function sellPrice(g: Game, r: Res): number {
  const m = g.market;
  let p = RES_INFO[r].base * m.demand[r] * m.impact[r] * g.diff.price;
  for (const e of m.events) if (e.res === r && g.time < e.until) p *= e.mult;
  const haggle = Math.min(3, g.crew.filter((c) => c.trait === 'haggler').length);
  p *= 1 + 0.03 * g.m('haggle') + 0.04 * haggle + (g.rel[2] >= 40 ? 0.08 : 0);
  return p;
}
export function priceMods(g: Game): string[] {
  const out: string[] = [];
  const h = Math.min(3, g.crew.filter((c) => c.trait === 'haggler').length);
  if (g.m('haggle')) out.push(`License +${3 * g.m('haggle')}%`);
  if (h) out.push(`Hagglers +${4 * h}%`);
  if (g.rel[2] >= 40) out.push('Verdant ally +8%');
  return out;
}
export function fuelPrice(g: Game): number {
  let p = g.market.fuelBase * (g.mods.has('lean') ? 2 : 1);
  for (const e of g.market.events) if (e.res === 'fuel' && g.time < e.until) p *= e.mult;
  return p;
}
export function updateMarket(g: Game, dt: number) {
  const m = g.market;
  for (const r of RES_LIST) m.impact[r] = Math.min(1, m.impact[r] + (1 - m.impact[r]) * dt * 0.012);
  m.events = m.events.filter((e) => e.until > g.time);
  m.tickT -= dt;
  if (m.tickT <= 0) {
    m.tickT = 3;
    for (const r of RES_LIST) {
      m.demand[r] = clamp(m.demand[r] + (1 - m.demand[r]) * 0.07 + (g.rng() - 0.5) * 0.1, 0.55, 1.7);
      m.hist[r].push(sellPrice(g, r));
      if (m.hist[r].length > 40) m.hist[r].shift();
    }
  }
}
export function sellRes(g: Game, r: Res, n: number) {
  const k = Math.min(Math.floor(g.stock[r]), Math.floor(n));
  if (k <= 0) { audio.play('error'); return; }
  const p = sellPrice(g, r);
  const f = 1 - RES_INFO[r].impact;
  const rev = (p * (1 - Math.pow(f, k))) / (1 - f);
  g.stock[r] -= k;
  g.credits += rev;
  g.market.impact[r] = Math.max(0.3, g.market.impact[r] * Math.pow(f, k));
  g.stats.sells++;
  g.stats.earned += rev;
  g.ftext(g.station.x, g.station.y - 90, `+${Math.round(rev)}cr`, '#ffd36e', 16);
  audio.play('sell');
}
export function sellAll(g: Game) {
  let any = false;
  for (const r of RES_LIST) if (Math.floor(g.stock[r]) > 0) { any = true; sellRes(g, r, Math.floor(g.stock[r])); }
  if (!any) audio.play('error');
}
export function buyFuel(g: Game, n: number) {
  const k = Math.min(n, Math.floor(700 - g.fuel));
  const cost = Math.ceil(k * fuelPrice(g));
  if (k <= 0 || g.credits < cost) { audio.play('error'); return; }
  g.credits -= cost;
  g.stats.spent += cost;
  g.fuel += k;
  audio.play('buy');
}
export function refine(g: Game, n: number) {
  const k = Math.min(Math.floor(g.stock.cores), n);
  if (k <= 0) { audio.play('error'); return; }
  g.stock.cores -= k;
  g.fuel = Math.min(900, g.fuel + k * 9);
  g.ftext(g.station.x, g.station.y - 90, `+${k * 9} fuel`, '#5ef2c0', 14);
  audio.play('buy');
}

/* ================= Crew ================= */
export function makeCrew(g: Game, origin: number): Crew {
  const specs: Spec[] = ['pilot', 'rigger', 'gunner'];
  const traits: Trait[] = ['steady', 'reckless', 'haggler', 'scrapper', 'veteran'];
  const spec = g.pick(specs);
  let skill = 1 + Math.floor(g.rng() * 3);
  if (g.m('recruit') >= 2) skill = Math.min(5, skill + 1);
  const trait: Trait = origin > 0 && g.rng() < 0.45 ? 'turncoat' : g.pick(traits);
  if (trait === 'veteran') skill = Math.min(5, skill + 1);
  const wage = 8 + skill * 5 + (trait === 'veteran' ? 6 : 0) + (trait === 'haggler' ? 3 : 0);
  return { id: g.nextCrewId++, name: `${g.pick(FIRST)} ${g.pick(LAST)}`, spec, skill, xp: 0, morale: 60, wage, trait, origin, ship: null, kills: 0 };
}
export function genPool(g: Game) {
  const n = 4 + (g.m('recruit') > 0 ? 1 : 0) + (g.m('recruit') >= 3 ? 1 : 0);
  g.pool = [];
  for (let i = 0; i < n; i++) {
    let origin = g.rng() < 0.55 ? 0 : 1 + Math.floor(g.rng() * 3);
    if (origin > 0 && g.rel[origin] <= -30) origin = 0;
    g.pool.push(makeCrew(g, origin));
  }
}
export function hireCost(g: Game, c: Crew): number {
  return Math.round(c.wage * 7 * (c.origin > 0 && g.rel[c.origin] >= 30 ? 0.8 : 1) * (c.origin === 3 && g.rel[3] >= 40 ? 0.8 : 1));
}
export function autoAssign(g: Game, c: Crew) {
  const free = g.fleet().filter((s) => s.crew == null);
  if (!free.length) return;
  const match = free.find((s) => ROLE_SPEC[s.kind] === c.spec) ?? free[0];
  match.crew = c.id;
  c.ship = match.id;
}
export function hire(g: Game, id: number) {
  const c = g.pool.find((q) => q.id === id);
  if (!c) return;
  const cost = hireCost(g, c);
  if (g.credits < cost) { audio.play('error'); g.msg('Not enough credits to hire.', '#ff9a6b'); return; }
  g.credits -= cost;
  g.stats.spent += cost;
  g.pool = g.pool.filter((q) => q !== c);
  g.crew.push(c);
  autoAssign(g, c);
  g.stats.hires++;
  g.msg(`${c.name} (${SPEC_NAME[c.spec]}) joined the crew.`, '#9dffd0');
  audio.play('hire');
}
const SPEC_NAME: Record<Spec, string> = { pilot: 'Pilot', rigger: 'Rigger', gunner: 'Gunner' };
export function refreshPool(g: Game) {
  if (g.credits < 60) { audio.play('error'); return; }
  g.credits -= 60;
  g.stats.spent += 60;
  genPool(g);
  audio.play('click');
}
export function fireCrew(g: Game, id: number) {
  const c = g.findCrew(id);
  if (!c) return;
  const s = c.ship != null ? g.shipMap.get(c.ship) : undefined;
  if (s) s.crew = null;
  g.crew = g.crew.filter((q) => q !== c);
  g.crew.forEach((q) => (q.morale = Math.max(0, q.morale - 5)));
  g.msg(`${c.name} was dismissed.`, '#9ad');
  audio.play('click');
}
export function assignCrew(g: Game, cid: number, shipId: number | null) {
  const c = g.findCrew(cid);
  if (!c) return;
  const oldId = c.ship;
  const oldShip = oldId != null ? g.ships.find((s) => s.id === oldId) : undefined;
  if (shipId == null) {
    if (oldShip) oldShip.crew = null;
    c.ship = null;
    return;
  }
  const t = g.ships.find((s) => s.id === shipId && s.faction === 0);
  if (!t) return;
  const other = g.findCrew(t.crew);
  if (oldShip) oldShip.crew = null;
  if (other && other !== c) {
    if (oldShip) { oldShip.crew = other.id; other.ship = oldShip.id; } else other.ship = null;
  }
  t.crew = c.id;
  c.ship = t.id;
  audio.play('click');
}
export function wageTotal(g: Game): number {
  const pay = [0.7, 1, 1.4][g.payIdx];
  return Math.round(g.crew.reduce((a, c) => a + c.wage * (c.ship == null ? 0.5 : 1), 0) * pay);
}
export function updateCrew(g: Game, dt: number) {
  const pay = [0.7, 1, 1.4][g.payIdx];
  // consistency
  for (const c of g.crew) {
    if (c.ship != null) {
      const s = g.ships.find((q) => q.id === c.ship && !q.dead);
      if (!s || s.crew !== c.id) c.ship = null;
    }
  }
  for (const s of g.ships) if (s.faction === 0 && s.crew != null && !g.findCrew(s.crew)) s.crew = null;
  for (const c of [...g.crew]) {
    const target = 52 + (pay - 1) * 55 + g.moraleBoost - (c.trait === 'steady' ? 0 : g.fear) - (c.ship == null ? 4 : 0);
    c.morale = clamp(c.morale + (target - c.morale) * Math.min(1, dt * 0.06), 0, 100);
    if (c.xp >= c.skill * 100 && c.skill < 5) {
      c.xp -= c.skill * 100;
      c.skill++;
      c.wage += 4;
      g.msg(`${c.name} was promoted to skill ${c.skill}!`, '#ffd36e');
      const s = c.ship != null ? g.shipMap.get(c.ship) : undefined;
      if (s) g.ftext(s.x, s.y - 26, 'PROMOTED', '#ffd36e', 14);
      audio.play('level');
    }
    const drop = () => {
      const s = c.ship != null ? g.shipMap.get(c.ship) : undefined;
      if (s) s.crew = null;
      g.crew = g.crew.filter((q) => q !== c);
    };
    if (c.morale < 12 && g.rng() < dt * 0.02) {
      drop();
      g.msg(`${c.name} deserted: morale collapsed!`, '#ff6b57');
      audio.play('warn');
    } else if (c.trait === 'turncoat' && c.origin > 0 && g.rel[c.origin] <= -40 && c.morale < 55 && g.rng() < dt * 0.03) {
      drop();
      const loss = Math.min(g.credits, 80);
      g.credits -= loss;
      g.msg(`Turncoat ${c.name} defected to the ${FACTIONS[c.origin].name} and stole ${Math.round(loss)}cr!`, '#ff6b57');
      audio.play('warn');
    }
  }
  g.wageT -= dt;
  if (g.wageT <= 0) {
    g.wageT = 45;
    const total = wageTotal(g);
    if (total > 0) {
      if (g.credits >= total) {
        g.credits -= total;
        g.stats.wagesPaid += total;
        g.stats.spent += total;
        g.msg(`Wages paid: -${total}cr.`, '#9ad');
      } else {
        g.credits = 0;
        g.crew.forEach((c) => (c.morale = Math.max(0, c.morale - 22)));
        g.msg('Wages UNPAID! The crew is furious.', '#ff6b57');
        audio.play('warn');
      }
    }
  }
  g.poolT -= dt;
  if (g.poolT <= 0) { g.poolT = 90; genPool(g); }
}

/* ================= Shipyard / Lab ================= */
export function fleetCap(g: Game) { return 8 + Math.floor(g.m('holds') / 2); }
export function shipCost(g: Game, kind: ShipKind) {
  return Math.round(SHIPS[kind].cost * (1 + 0.05 * g.fleet().length) * (g.rel[1] >= 40 ? 0.9 : 1));
}
export function shipLocked(g: Game, kind: ShipKind) {
  return (kind === 'hauler' && !g.m('hauler')) || (kind === 'frigate' && !g.m('frigate'));
}
const SHIP_NAMES = ['Rustbucket', 'Lucky Penny', 'Dust Devil', 'Sparrow', 'Tin Saint', 'Grease Monkey', 'Hungry Ghost', 'Salt Mule', 'Gravy Train', 'Bent Halo', 'Pocket Moon', 'Old Reliable'];
export function shipName(g: Game) { return `${g.pick(SHIP_NAMES)}`; }
export function buyShip(g: Game, kind: ShipKind): Ship | null {
  const cost = shipCost(g, kind);
  if (shipLocked(g, kind) || g.credits < cost || g.fleet().length >= fleetCap(g)) { audio.play('error'); return null; }
  g.credits -= cost;
  g.stats.spent += cost;
  const a = g.rng() * Math.PI * 2;
  const s = g.spawn(kind, 0, g.station.x + Math.cos(a) * 100, g.station.y + Math.sin(a) * 100);
  s.name = shipName(g);
  const free = g.crew.filter((c) => c.ship == null);
  if (free.length) {
    const c = free.find((q) => q.spec === ROLE_SPEC[kind]) ?? free[0];
    s.crew = c.id;
    c.ship = s.id;
  }
  g.msg(`${SHIPS[kind].name} "${s.name}" joins the fleet${s.crew == null ? ' (no captain, hire crew!)' : ''}.`, '#9dffd0');
  g.burst(s.x, s.y, 14, '#4de1ff', 100);
  audio.play('buy');
  return s;
}
export function scrapShip(g: Game, id: number) {
  const s = g.ships.find((q) => q.id === id && q.faction === 0);
  if (!s) return;
  const refund = Math.round(SHIPS[s.kind].cost * 0.35);
  g.credits += refund;
  const c = g.findCrew(s.crew);
  if (c) c.ship = null;
  g.detach(s);
  s.dead = true;
  g.sel = g.sel.filter((i) => i !== id);
  g.msg(`Scrapped ${SHIPS[s.kind].name} for ${refund}cr.`, '#9ad');
  audio.play('sell');
}
export function repairStation(g: Game) {
  const st = g.station;
  if (st.hp >= st.maxHp - 1 || g.credits < 150) { audio.play('error'); return; }
  g.credits -= 150;
  g.stats.spent += 150;
  st.hp = Math.min(st.maxHp, st.hp + st.maxHp * 0.25);
  g.ftext(st.x, st.y - 90, 'REPAIRED', '#9dffd0', 15);
  audio.play('buy');
}
export function buyLab(g: Game, id: string) {
  const d = LAB.find((l) => l.id === id);
  if (!d) return;
  const lvl = g.l(id);
  if (lvl >= d.max) return;
  const cc = labCost(lvl), dd = labData(lvl);
  if (g.credits < cc || g.stock.data < dd) { audio.play('error'); return; }
  g.credits -= cc;
  g.stock.data -= dd;
  g.stats.spent += cc;
  g.lab[id] = lvl + 1;
  g.stats.labBuys++;
  g.msg(`Research complete: ${d.name} ${lvl + 1}.`, '#9dffd0');
  audio.play('level');
}

/* ================= Rights: claims & auctions ================= */
export const maxClaims = () => 6;
export function claimCost(g: Game, w: Wreck) { return Math.max(40, Math.round(g.wreckValue(w) * 0.18)); }
export function claimsOwned(g: Game) { return g.wrecks.filter((w) => w.owner === 0 && w.fade === 0); }
export function stakeClaim(g: Game, wid: number) {
  const w = g.wreckMap.get(wid);
  if (!w || w.owner !== -1 || w.fade !== 0 || !w.revealed) { audio.play('error'); return; }
  const cost = claimCost(g, w);
  if (g.credits < cost || claimsOwned(g).length >= maxClaims() || w.special === 'leviathan') { audio.play('error'); return; }
  g.credits -= cost;
  g.stats.spent += cost;
  w.owner = 0;
  g.stats.claims++;
  g.msg(`Claim staked on ${w.name}.`, '#4de1ff');
  g.pings.push({ x: w.x, y: w.y, t: 0.8, color: '#4de1ff' });
  audio.play('buy');
}
export function sellClaim(g: Game, wid: number) {
  const w = g.wreckMap.get(wid);
  if (!w || w.owner !== 0) return;
  let f = 1;
  for (const k of [1, 2, 3]) if (g.rel[k] > g.rel[f]) f = k;
  const price = Math.round(g.wreckValue(w) * 0.5 * (1 + g.rel[f] / 200));
  g.credits += price;
  g.stats.earned += price;
  w.owner = f;
  g.rel[f] = Math.min(100, g.rel[f] + 5);
  g.msg(`Sold rights to ${w.name} to ${FACTIONS[f].name} for ${price}cr (+5 relations).`, '#ffd36e');
  audio.play('sell');
}
export function nextBid(a: { bid: number }) { return Math.round(a.bid * 1.1 + 10); }
export function bidAuction(g: Game, aid: number, big: boolean) {
  const a = g.auctions.find((q) => q.id === aid);
  if (!a || a.bidder === 0) { audio.play('error'); return; }
  const amt = big ? Math.round(a.bid * 1.3 + 20) : nextBid(a);
  if (g.credits < amt) { audio.play('error'); return; }
  g.credits -= amt;
  g.stats.spent += amt;
  a.bid = amt;
  a.bidder = 0;
  a.bidderName = 'You';
  if (g.time > a.end - 4) a.end += 4;
  audio.play('bid');
}
function startAuction(g: Game) {
  const kind = g.rng() < 0.5 ? 'relic' : 'vault';
  let x = 0, y = 0, ok = false;
  for (let i = 0; i < 60 && !ok; i++) {
    x = g.rr(300, WORLD_W - 300);
    y = g.rr(300, WORLD_H - 300);
    ok = dist(x, y, g.station.x, g.station.y) > 600 && [1, 2, 3, 4].every((f) => dist(x, y, FACTIONS[f].bx, FACTIONS[f].by) > 500) && !g.wrecks.some((w) => dist(w.x, w.y, x, y) < 140);
  }
  const w = spawnWreck(g, kind, x, y, 'prize');
  for (const r of RES_LIST) w.loot[r] = Math.round(w.loot[r] * 1.6);
  w.value0 = Math.max(1, g.wreckValue(w));
  w.name = `Prize: ${w.name}`;
  w.revealed = true;
  if (g.sector >= 2 && g.rng() < 0.5) addGuards(g, w);
  const a = { id: g.nextId++, wreckId: w.id, bid: Math.round(g.wreckValue(w) * 0.2), bidder: -1, end: g.time + 45, bidderName: '' };
  g.auctions.push(a);
  g.msg(`Salvage-rights auction opened: ${w.name} (~${Math.round(g.wreckValue(w))}cr). See the Rights tab (K).`, '#ffd36e');
  g.pings.push({ x: w.x, y: w.y, t: 1.2, color: '#ffd36e' });
  audio.play('alarm');
}
export function updateAuctions(g: Game, dt: number) {
  if (g.sd.id >= 1) {
    g.auctionT -= dt;
    if (g.auctionT <= 0) {
      g.auctionT = 60;
      if (g.auctions.length < 2) startAuction(g);
    }
  }
  for (const a of [...g.auctions]) {
    const w = g.wreckMap.get(a.wreckId);
    if (!w || w.fade !== 0) { if (a.bidder === 0) g.credits += a.bid; g.auctions = g.auctions.filter((q) => q !== a); continue; }
    const value = g.wreckValue(w);
    if (g.rng() < dt * 0.2) {
      const f = 1 + Math.floor(g.rng() * 3);
      const amt = nextBid(a);
      if (a.bidder !== f && amt < value * (0.5 + 0.07 * f) && g.rivals[f].credits > amt && g.rel[f] > -80) {
        if (a.bidder === 0) { g.credits += a.bid; g.msg(`Outbid by ${FACTIONS[f].name} on ${w.name}!`, '#ff9a6b'); audio.play('warn'); }
        a.bid = amt;
        a.bidder = f;
        a.bidderName = FACTIONS[f].name;
        if (g.time > a.end - 4) a.end += 3;
      }
    }
    if (g.time >= a.end) {
      g.auctions = g.auctions.filter((q) => q !== a);
      if (a.bidder === 0) {
        w.owner = 0;
        g.stats.auctions++;
        g.msg(`You won the rights to ${w.name} for ${a.bid}cr!`, '#ffd36e');
        audio.play('level');
      } else if (a.bidder > 0) {
        w.owner = a.bidder;
        g.rivals[a.bidder].credits = Math.max(0, g.rivals[a.bidder].credits - a.bid);
        g.msg(`${FACTIONS[a.bidder].name} won the rights to ${w.name}.`, '#ff9a6b');
      } else g.msg(`Nobody bid on ${w.name}: it is up for grabs!`, '#9ad');
    }
  }
}

/* ================= Contracts ================= */
export function updateContracts(g: Game, dt: number) {
  g.contractT -= dt;
  if (g.contractT <= 0) {
    g.contractT = 40;
    if (g.contracts.length < 3) {
      const opts = [1, 2, 3].filter((f) => g.rel[f] > -35);
      if (opts.length) {
        const f = g.pick(opts);
        const res = g.pick<Res>(['scrap', 'alloy', 'alloy', 'cores', 'cores', 'data', 'relics']);
        const base: Record<Res, [number, number]> = { scrap: [60, 120], alloy: [20, 40], cores: [10, 18], data: [6, 10], relics: [2, 3] };
        const qty = Math.max(1, Math.round(g.rr(base[res][0], base[res][1]) * (1 + 0.15 * g.sector)));
        const reward = Math.round(qty * RES_INFO[res].base * 1.45);
        g.contracts.push({ id: g.nextId++, faction: f, res, qty, reward, rel: 8 + Math.floor(g.rng() * 6), deadline: g.time + g.rr(150, 220) });
        g.msg(`New contract from ${FACTIONS[f].name}: ${qty} ${RES_INFO[res].name}.`, '#9ad7ff');
      }
    }
  }
  for (const c of [...g.contracts]) {
    if (g.time > c.deadline) {
      g.contracts = g.contracts.filter((q) => q !== c);
      g.rel[c.faction] = Math.max(-100, g.rel[c.faction] - 3);
      g.msg(`Contract for ${FACTIONS[c.faction].name} expired.`, '#ff9a6b');
    }
  }
}
export function fulfill(g: Game, id: number) {
  const c = g.contracts.find((q) => q.id === id);
  if (!c || g.stock[c.res] < c.qty) { audio.play('error'); return; }
  g.stock[c.res] -= c.qty;
  g.credits += c.reward;
  g.stats.earned += c.reward;
  g.rel[c.faction] = Math.min(100, g.rel[c.faction] + c.rel);
  g.stats.contracts++;
  g.contracts = g.contracts.filter((q) => q !== c);
  g.msg(`Contract fulfilled for ${FACTIONS[c.faction].name}: +${c.reward}cr, +${c.rel} relations.`, '#ffd36e');
  g.ftext(g.station.x, g.station.y - 90, `+${c.reward}cr`, '#ffd36e', 18);
  audio.play('deliver');
}

/* ================= Diplomacy ================= */
export const GIFT_COST = 250;
export const TREATY_COST = 450;
export const SABOTAGE_COST = 350;
export const MERC_COST = 380;
export function giftCredits(g: Game, f: number) {
  if (g.credits < GIFT_COST) { audio.play('error'); return; }
  g.credits -= GIFT_COST;
  g.stats.spent += GIFT_COST;
  g.rel[f] = Math.min(100, g.rel[f] + 10);
  g.msg(`Gift sent to ${FACTIONS[f].name}: +10 relations.`, FACTIONS[f].color);
  audio.play('buy');
}
export function giftRelic(g: Game, f: number) {
  if (g.stock.relics < 1) { audio.play('error'); return; }
  g.stock.relics -= 1;
  g.rel[f] = Math.min(100, g.rel[f] + 18);
  g.msg(`A relic was gifted to ${FACTIONS[f].name}: +18 relations.`, FACTIONS[f].color);
  audio.play('buy');
}
export function signTreaty(g: Game, f: number) {
  if (g.credits < TREATY_COST || g.rel[f] <= -70) { audio.play('error'); return; }
  g.credits -= TREATY_COST;
  g.stats.spent += TREATY_COST;
  g.treaty[f] = 180;
  g.provoked[f] = 0;
  g.msg(`Non-aggression pact signed with ${FACTIONS[f].name} (180s).`, FACTIONS[f].color);
  audio.play('level');
}
export function sabotage(g: Game, f: number) {
  if (g.credits < SABOTAGE_COST || g.cool[f] > 0) { audio.play('error'); return; }
  g.credits -= SABOTAGE_COST;
  g.stats.spent += SABOTAGE_COST;
  g.cool[f] = 90;
  for (const s of g.ships) if (s.faction === f) s.disabled = 25;
  g.rivals[f].credits = Math.max(0, g.rivals[f].credits - 400);
  g.rel[f] = Math.max(-100, g.rel[f] - 30);
  g.msg(`Sabotage! ${FACTIONS[f].name} ships are dead in space for 25s.`, '#ffb050');
  audio.play('boom');
}
export function hireMercs(g: Game, f: number) {
  if (g.credits < MERC_COST || g.rel[f] < 5) { audio.play('error'); return; }
  g.credits -= MERC_COST;
  g.stats.spent += MERC_COST;
  for (let i = 0; i < 2; i++) {
    const s = g.spawn('gunship', 0, g.station.x + g.rr(-90, 90), g.station.y + g.rr(-90, 90), 'merc');
    s.temp = true;
    s.life = 120;
    s.name = 'Merc';
  }
  g.msg(`${FACTIONS[f].name} mercenaries answer your call (120s).`, FACTIONS[f].color);
  audio.play('buy');
}
export function updateDiplo(g: Game, dt: number) {
  for (let f = 1; f <= 3; f++) {
    if (g.treaty[f] > 0) g.treaty[f] -= dt;
    if (g.provoked[f] > 0) g.provoked[f] -= dt;
    if (g.cool[f] > 0) g.cool[f] -= dt;
    g.rel[f] = clamp(g.rel[f] + (g.rel[f] > 0 ? -0.02 : 0.02) * dt, -100, 100);
  }
  if (g.rel[3] >= 40 && Math.floor(g.time / 60) !== Math.floor((g.time - dt) / 60)) {
    const hidden = g.wrecks.filter((w) => !w.revealed && w.fade === 0);
    if (hidden.length) {
      const w = g.pick(hidden);
      w.revealed = true;
      g.msg(`Void Magpies tip you off: ${w.name} located.`, FACTIONS[3].color);
    }
  }
}

/* ================= Events & raids ================= */
export function updateEvents(g: Game, dt: number) {
  g.eventT -= dt;
  if (g.eventT > 0) return;
  const ev = g.sd.events;
  if (ev <= 0) { g.eventT = 60; return; }
  g.eventT = (45 + g.rr(0, 35)) / (ev * (g.mods.has('storm') ? 2 : 1));
  const sm = g.mods.has('storm') ? 2 : 1;
  const opts: [string, number][] = [['market', 3 * sm], ['supply', 1.5], ['ping', 1.2], ['storm', g.storm ? 0 : 2 * sm], ['meteor', 1.5 * sm]];
  const tot = opts.reduce((a, o) => a + o[1], 0);
  let roll = g.rng() * tot;
  let pick = 'market';
  for (const o of opts) { roll -= o[1]; if (roll <= 0) { pick = o[0]; break; } }
  fireEvent(g, pick);
}
export function fireEvent(g: Game, kind: string) {
  const m = g.market;
  if (kind === 'market') {
    const fuel = g.rng() < 0.15;
    const r: Res | 'fuel' = fuel ? 'fuel' : g.pick(RES_LIST);
    const boom = g.rng() < 0.55;
    const mult = fuel ? (boom ? 0.6 : 1.7) : boom ? g.rr(1.35, 1.6) : g.rr(0.6, 0.75);
    const name = r === 'fuel' ? 'Fuel' : RES_INFO[r].name;
    const text = fuel ? (boom ? 'Fuel glut: prices crash' : 'Fuel shortage: prices spike') : boom ? `${name} boom: shipyards pay +${Math.round((mult - 1) * 100)}%` : `${name} glut: prices -${Math.round((1 - mult) * 100)}%`;
    m.events.push({ id: g.nextId++, text, res: r, mult, until: g.time + 55 });
    g.msg(`Market: ${text}.`, boom || fuel ? '#9dffd0' : '#ff9a6b');
  } else if (kind === 'supply') {
    for (let i = 0; i < 2; i++) {
      const a = g.rng() * Math.PI * 2, d = g.rr(430, 650);
      const w = spawnWreck(g, g.rng() < 0.5 ? 'cargo' : 'hull', clamp(g.station.x + Math.cos(a) * d, 100, WORLD_W - 100), clamp(g.station.y + Math.sin(a) * d, 100, WORLD_H - 100));
      w.revealed = true;
      g.pings.push({ x: w.x, y: w.y, t: 1, color: '#9dffd0' });
    }
    g.msg('Supply drop: two derelicts drifted into range.', '#9dffd0');
  } else if (kind === 'ping') {
    const hidden = g.wrecks.filter((w) => !w.revealed && w.fade === 0).sort((a, b) => g.wreckValue(b) - g.wreckValue(a)).slice(0, 3);
    hidden.forEach((w) => { w.revealed = true; g.pings.push({ x: w.x, y: w.y, t: 1.2, color: '#9ad7ff' }); });
    if (hidden.length) g.msg('Derelict beacon: valuable wrecks revealed on the map.', '#9ad7ff');
  } else if (kind === 'storm') {
    const edge = Math.floor(g.rng() * 4);
    const x = edge === 0 ? -300 : edge === 1 ? WORLD_W + 300 : g.rr(400, WORLD_W - 400);
    const y = edge === 2 ? -300 : edge === 3 ? WORLD_H + 300 : g.rr(300, WORLD_H - 300);
    const tx = g.station.x + g.rr(-700, 700), ty = g.station.y + g.rr(-500, 500);
    const d = Math.hypot(tx - x, ty - y) || 1;
    const sp = 38;
    g.storm = { x, y, vx: ((tx - x) / d) * sp, vy: ((ty - y) / d) * sp, r: 380, until: g.time + 95 };
    g.msg('⚡ Ion storm approaching! Ships inside are slowed and damaged; reactor hulks destabilise.', '#c9a6ff');
    audio.play('thunder');
  } else if (kind === 'meteor') {
    const cx = g.station.x + g.rr(-900, 900), cy = g.station.y + g.rr(-600, 600);
    const a = g.rng() * Math.PI;
    for (let i = 0; i < 9; i++) {
      const t = (i - 4) * 160 + g.rr(-60, 60);
      g.meteors.push({ x: clamp(cx + Math.cos(a) * t, 50, WORLD_W - 50), y: clamp(cy + Math.sin(a) * t, 50, WORLD_H - 50), t: 3 + i * 0.5 + g.rng(), r: 70 });
    }
    g.msg('☄ Meteor shower! Red circles mark impact zones.', '#ff9a6b');
    audio.play('warn');
  }
}
export function spawnRaid(g: Game) {
  const n = clamp(Math.round((2 + g.sector * 1.2 + g.heat / 28) * g.diff.hp * 0.9), 2, 16);
  const side = Math.floor(g.rng() * 3);
  let sx = FACTIONS[4].bx - 100, sy = FACTIONS[4].by - 100;
  if (side === 1) { sx = WORLD_W - 60; sy = g.rr(300, WORLD_H - 300); }
  if (side === 2) { sx = g.rr(WORLD_W / 2, WORLD_W - 300); sy = WORLD_H - 60; }
  for (let i = 0; i < n; i++) {
    g.spawn(i % 4 === 3 && g.sector >= 2 ? 'bomber' : 'raider', 4, sx + g.rr(-80, 80), sy + g.rr(-80, 80), 'raid');
  }
  g.stats.raids++;
  g.msg(`☠ Pirate raid: ${n} ships inbound!`, '#ff6b57');
  audio.play('alarm');
}
export function updateRaids(g: Game, dt: number) {
  if (g.raidT < 1e8) {
    g.raidT -= dt * (1 + g.heat / 60);
    if (!g.raidWarned && g.raidT <= 8) {
      g.raidWarned = true;
      g.msg('⚠ Long-range sensors detect a pirate raid forming. Brace for contact!', '#ffc933');
      audio.play('warn');
    }
    if (g.raidT <= 0) {
      spawnRaid(g);
      g.raidT = g.sd.raid * g.diff.raid;
      g.raidWarned = false;
    }
  }
  if (g.raidAlive > 0) g.raidWas = true;
  else if (g.raidWas) {
    g.raidWas = false;
    g.stats.repelled++;
    const b = 60 + 30 * g.sector;
    g.credits += b;
    g.stats.earned += b;
    g.heat = Math.max(0, g.heat - 15);
    g.msg(`Raid repelled! Salvage bounty +${b}cr.`, '#ffd36e');
    audio.play('deliver');
  }
}
export function updateRivals(g: Game, dt: number) {
  const sd = g.sd;
  if (sd.rivalTugs <= 0 && sd.rivalGuns <= 0) return;
  for (let f = 1; f <= 3; f++) {
    const r = g.rivals[f];
    const b = FACTIONS[f];
    r.spawnT -= dt;
    if (r.spawnT <= 0) {
      r.spawnT = 20;
      let tugs = 0, guns = 0;
      for (const s of g.ships) if (s.faction === f && !s.dead) { if (s.kind === 'tug') tugs++; else if (s.kind === 'gunship') guns++; }
      const maxT = sd.rivalTugs + Math.floor(g.sectorTime / 180);
      const maxG = sd.rivalGuns + Math.floor(g.sectorTime / 240);
      if (tugs < maxT && r.credits >= 260) {
        r.credits -= 260;
        const s = g.spawn('tug', f, b.bx + g.rr(-60, 60), b.by + g.rr(-60, 60), f === 3 && tugs % 2 === 0 ? 'thief' : 'salvage');
        s.name = b.tag;
      } else if (guns < maxG && r.credits >= 420) {
        r.credits -= 420;
        const s = g.spawn('gunship', f, b.bx + g.rr(-60, 60), b.by + g.rr(-60, 60), 'guard');
        s.name = b.tag;
      }
    }
    if (g.hostile(0, f) && sd.raid > 0 && sd.rivalGuns > 0) {
      r.raidT -= dt;
      if (r.raidT <= 0) {
        r.raidT = 75 * g.diff.raid;
        const n = 2 + Math.floor(g.sector / 2);
        for (let i = 0; i < n; i++) {
          const s = g.spawn('gunship', f, b.bx + g.rr(-80, 80), b.by + g.rr(-80, 80), 'raid');
          s.name = b.tag;
        }
        g.msg(`${b.name} launched a raid on your station!`, b.color);
        audio.play('alarm');
      }
    }
    if (f === 2 && g.rel[2] <= -35 && sd.events > 0) {
      r.embargoT -= dt;
      if (r.embargoT <= 0) {
        r.embargoT = 75;
        const res = g.pick(RES_LIST);
        g.market.events.push({ id: g.nextId++, text: `Verdant embargo on ${RES_INFO[res].name}`, res, mult: 0.7, until: g.time + 45 });
        g.msg(`Verdant Reclaimers embargo your ${RES_INFO[res].name}: -30% for 45s.`, FACTIONS[2].color);
      }
    }
  }
}

/* ================= Setup helpers ================= */
export function initialCrewAndFleet(g: Game) {
  const st = g.station;
  const kinds: ShipKind[] = ['tug', 'tug', 'cutter', 'scout'];
  const specs: Spec[] = ['rigger', 'rigger', 'rigger', 'pilot'];
  kinds.forEach((k, i) => {
    const a = (i / kinds.length) * Math.PI * 2;
    const s = g.spawn(k, 0, st.x + Math.cos(a) * 100, st.y + Math.sin(a) * 100);
    s.name = shipName(g);
    const c = makeCrew(g, 0);
    c.spec = specs[i];
    c.skill = i === 0 ? 2 : 1;
    c.wage = 8 + c.skill * 5;
    if (c.trait === 'veteran') c.trait = 'steady';
    c.ship = s.id;
    s.crew = c.id;
    g.crew.push(c);
  });
}
export function spawnDebris(g: Game, x: number, y: number, boss: boolean): Wreck | null {
  const loot = emptyBag();
  if (boss) { loot.scrap = 80; loot.alloy = 80; loot.cores = 20; loot.data = 30; loot.relics = 6; }
  else { loot.scrap = Math.round(g.rr(14, 30)); loot.alloy = Math.round(g.rr(0, 4)); }
  const w = spawnWreck(g, 'hull', x, y, boss ? 'maw' : 'debris', loot, boss ? 60 : 14, boss ? 200 : 25);
  w.name = boss ? 'MAW Flagship Remains' : 'Wreckage';
  return w;
}
export function applyBoon(g: Game, id: string) {
  switch (id) {
    case 'cash': g.credits += 700; break;
    case 'gunship': {
      const s = g.spawn('gunship', 0, g.station.x + 90, g.station.y, '');
      s.name = shipName(g);
      const c = makeCrew(g, 0);
      c.spec = 'gunner';
      c.skill = 3;
      c.wage = 8 + 3 * 5;
      if (c.trait === 'turncoat') c.trait = 'steady';
      c.ship = s.id;
      s.crew = c.id;
      g.crew.push(c);
      break;
    }
    case 'diplomacy': for (let f = 1; f <= 3; f++) g.rel[f] = Math.min(100, g.rel[f] + 20); g.heat = 0; break;
    case 'cache': g.stock.data += 14; g.stock.relics += 2; break;
    case 'plating': g.boon.hull *= 1.2; break;
    case 'winch': g.boon.tow *= 1.15; break;
    case 'fuel': g.fuel = Math.min(900, g.fuel + 250); break;
    case 'thrust': g.boon.speed *= 1.08; g.boon.dmg *= 1.1; break;
  }
  if (g.sd.id >= 0) genPool(g);
}

/* ================= Tutorial ================= */
interface TutStep { text: string; done: (g: Game) => boolean; enter?: (g: Game) => void }
export const TUT: TutStep[] = [
  { text: 'Welcome, Chief! Click one of your ships (or drag a box around several) to select it. Try a Tractor Tug 🛰️.', done: (g) => g.stats.selects > 0 },
  { text: 'With a tug selected, RIGHT-CLICK a bright wreck near the station. The tug will tractor it home. (Touch: tap the wreck.)', done: (g) => g.stats.towOrders > 0 },
  { text: 'Watch the beam haul it to the station. Deliver your first wreck: loot goes into stock and counts toward the quota.', done: (g) => g.stats.towed >= 1 },
  { text: 'Open the Market (press M) and sell some Scrap. Prices move with demand and drop as you sell. Sell in batches!', done: (g) => g.stats.sells > 0 },
  { text: 'Cutters strip wrecks in place. Select the Plasma Cutter and right-click a wreck, or press Q to toggle AUTO for selected ships.', done: (g) => g.stats.cutOrders > 0 || g.stats.autoToggles > 0 },
  { text: 'Open Crew (press C) and hire a candidate. Match specialties to ships: Riggers for tugs and cutters, Gunners for gunships, Pilots for scouts.', done: (g) => g.stats.hires > 0 },
  { text: 'Open Rights (press K) and stake a claim on a revealed wreck. Claims make rivals back off, or pay the price for poaching.', done: (g) => g.stats.claims > 0 },
  { text: 'Open the Lab (press U). Upgrades cost credits plus Data Shards from vaults. You do not have to buy one now.', done: (g) => g.tabsSeen.has('lab') },
  {
    text: 'Pirates incoming! Buy a Gunship in Fleet (press B) if you have none, and let your guns and the station turret destroy 2 raiders.',
    enter: (g) => { for (let i = 0; i < 2; i++) g.spawn('raider', 4, g.station.x + 800 + i * 40, g.station.y + 100 * i, 'raid'); audio.play('alarm'); },
    done: (g) => g.stats.kills >= 2,
  },
  { text: 'Final exam: deliver wrecks until you reach the training quota. Watch heat, fuel and wages in the top bar. Good luck!', done: () => false },
];
export function tutorialText(g: Game): string | null {
  if (!g.tutOn) return null;
  const s = TUT[g.tutStep];
  return s ? s.text : null;
}
export function tutorialUpdate(g: Game) {
  if (!g.tutOn) return;
  const s = TUT[g.tutStep];
  if (!s) return;
  if (s.done(g)) {
    g.tutStep++;
    audio.play('level');
    TUT[g.tutStep]?.enter?.(g);
  }
}
