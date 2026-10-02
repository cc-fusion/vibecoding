import { clamp, type DType } from "./data";
import { addLog, adjTrust, burst, floaterAt, neighbors, rnd, sfx, shake } from "./helpers";
import type { ActiveEvent, District, Sim } from "./types";

export interface EventChoice {
  label: string; desc: string;
  can?: (s: Sim) => boolean;
  apply: (s: Sim, d: District) => string;
}
export interface EventDef {
  id: string; icon: string; title: string; cooldown: number;
  cond: (s: Sim) => boolean; weight: (s: Sim) => number;
  pick: (s: Sim) => District | null;
  text: (s: Sim, d: District) => string;
  choices: EventChoice[];
}

const ofType = (s: Sim, t: DType) => s.districts.filter((d) => d.type === t);
const rand = <T,>(s: Sim, arr: T[]): T | null => (arr.length ? arr[Math.floor(rnd(s) * arr.length)] : null);
const maxBy = (arr: District[], f: (d: District) => number): District | null =>
  arr.reduce<District | null>((best, d) => (best === null || f(d) > f(best) ? d : best), null);
const pay = (s: Sim, n: number) => { s.funds = Math.max(0, s.funds - n); };
const funds = (n: number) => (s: Sim) => s.funds >= n;

function rumorSpread(s: Sim, d: District, amt: number, nb = 0.4) {
  d.rumor = clamp(d.rumor + amt, 0, 100);
  for (const n of neighbors(s, d)) n.rumor = clamp(n.rumor + amt * nb, 0, 100);
}
function panicSpread(s: Sim, d: District, amt: number, nb = 0.4) {
  d.panic = clamp(d.panic + amt, 0, 100);
  for (const n of neighbors(s, d)) n.panic = clamp(n.panic + amt * nb, 0, 100);
}
function seedExposure(_s: Sim, d: District, n: number) {
  const m = Math.min(n, d.S);
  d.S -= m; d.E += m;
}

export const EVENTS: EventDef[] = [
  {
    id: "cats", icon: "🐈", title: "The Cat Rumour", cooldown: 18,
    cond: (s) => s.day >= 4, weight: () => 1.2,
    pick: (s) => rand(s, s.districts.filter((d) => d.type !== "farms")),
    text: (_s, d) => `Whispers in ${d.name} claim the plague is carried by cats. Mobs have begun to hunt them through the streets.`,
    choices: [
      { label: "Debunk publicly", desc: "Costs 30 funds. Rumour -40 here, trust +2.", can: funds(30),
        apply: (s, d) => { pay(s, 30); rumorSpread(s, d, -40, 0.35); adjTrust(s, 2); return "Your heralds calm the mob. The rumour fades."; } },
      { label: "Let them cull", desc: "Panic eases, but rats multiply: +12% spread for 14 days.",
        apply: (s, d) => { panicSpread(s, d, -12, 0.2); s.temp.rats = 14; return "The cats are gone. The rats are delighted."; } },
      { label: "Ignore it", desc: "Rumour +25 here and +10 nearby.",
        apply: (s, d) => { rumorSpread(s, d, 25, 0.4); return "The rumour festers and spreads from door to door."; } },
    ],
  },
  {
    id: "caravan", icon: "🐫", title: "Merchant Caravan", cooldown: 16,
    cond: (s) => s.day >= 3 && s.districts.some((d) => d.type === "docks" || d.type === "market"), weight: () => 1.1,
    pick: (s) => rand(s, s.districts.filter((d) => d.type === "docks" || d.type === "market")),
    text: (_s, d) => `A caravan waits outside ${d.name}, offering grain and herbs at a fair price. No one can say where they have travelled from.`,
    choices: [
      { label: "Buy supplies", desc: "Costs 60 funds. +45 food, +25 medicine.", can: funds(60),
        apply: (s) => { pay(s, 60); s.food += 45; s.med += 25; sfx(s, "ok"); return "The wagons are unloaded at a fair price."; } },
      { label: "Trade & allow entry", desc: "+60 funds, +20 food. 50% chance of seeding unseen infection.",
        apply: (s, d) => {
          s.funds += 60; s.food += 20;
          if (rnd(s) < 0.5) { seedExposure(s, d, 5); return "Brisk trade! ...but a few traders were coughing as they left."; }
          return "Brisk trade, and everyone seemed healthy.";
        } },
      { label: "Turn them away", desc: "Trust +1. Nothing gained.",
        apply: (s) => { adjTrust(s, 1); return "The caravan leaves, grumbling."; } },
    ],
  },
  {
    id: "flagellants", icon: "⛪", title: "Flagellant Procession", cooldown: 20,
    cond: (s) => s.day >= 6 && s.districts.some((d) => d.panic > 35), weight: (s) => 1 + s.districts.filter((d) => d.panic > 45).length * 0.4,
    pick: (s) => maxBy(s.districts, (d) => d.panic),
    text: (_s, d) => `Penitents march through ${d.name}, scourging themselves and begging heaven for mercy. Thousands crowd the streets to join them.`,
    choices: [
      { label: "Allow the march", desc: "Panic -20 here, -8 nearby. Crowds spread plague. Trust +2.",
        apply: (s, d) => { panicSpread(s, d, -20, 0.4); seedExposure(s, d, Math.max(3, d.S * 0.01)); adjTrust(s, 2); return "Faith soothes the city. Contagion rides the crowd."; } },
      { label: "Disperse with guards", desc: "Costs 15 funds. Trust -3, panic +8 here.", can: funds(15),
        apply: (s, d) => { pay(s, 15); adjTrust(s, -3); panicSpread(s, d, 8, 0.2); shake(s, 8); return "Batons fall. The crowd scatters, furious."; } },
      { label: "Redirect to the temple", desc: "Costs 25 funds. Panic -10 with no crowding.", can: funds(25),
        apply: (s, d) => { pay(s, 25); panicSpread(s, d, -10, 0.2); return "Priests lead the faithful into the chapels in small groups."; } },
    ],
  },
  {
    id: "noble", icon: "👑", title: "A Noble Demands Exemption", cooldown: 22,
    cond: (s) => s.day >= 5 && ofType(s, "nobles").length > 0, weight: () => 0.9,
    pick: (s) => rand(s, ofType(s, "nobles")),
    text: (_s, d) => `The Duke of ${d.name} demands his household be exempt from all restrictions, and hints at a generous 'contribution' to the treasury.`,
    choices: [
      { label: "Grant exemption", desc: "+100 funds, trust -5. Lifts any seal on his hill.",
        apply: (s, d) => { s.funds += 100; adjTrust(s, -5); d.quarantine = false; return "Gold changes hands. The common folk notice."; } },
      { label: "Deny him", desc: "Trust +3. His servants flee and may carry plague.",
        apply: (s, d) => {
          adjTrust(s, 3); d.panic = clamp(d.panic + 20, 0, 100);
          const n = rand(s, neighbors(s, d));
          if (n) seedExposure(s, n, 4);
          return "The Duke storms out. Carriages rattle toward the countryside.";
        } },
      { label: "Send a private physician", desc: "Costs 8 medicine. Trust +1, no side effects.", can: (s) => s.med >= 8,
        apply: (s) => { s.med -= 8; adjTrust(s, 1); return "A compromise. The Duke is pacified."; } },
    ],
  },
  {
    id: "quack", icon: "🧙", title: "A Travelling Quack", cooldown: 18,
    cond: (s) => s.day >= 5, weight: () => 1,
    pick: (s) => rand(s, s.districts),
    text: (_s, d) => `A smiling stranger in ${d.name} sells 'Dr. Mortimer's Miraculous Plague Elixir'. Crowds are queuing up with coin in hand.`,
    choices: [
      { label: "Buy a sample", desc: "Costs 40 funds. 35% chance of +14 research, else trust -4.", can: funds(40),
        apply: (s) => {
          pay(s, 40);
          if (rnd(s) < 0.35) { s.rp += 14; return "Surprisingly, the tinctures contain useful herbs! +14 research."; }
          adjTrust(s, -4); return "Coloured water and snake oil. Your credibility suffers.";
        } },
      { label: "Arrest him", desc: "Trust +1, but rumour +10 (a martyr is born).",
        apply: (s, d) => { adjTrust(s, 1); rumorSpread(s, d, 10, 0.3); return "He is dragged away, shouting about conspiracies."; } },
      { label: "Hire as apprentice", desc: "Costs 15 funds. +4 research, +6 medicine.", can: funds(15),
        apply: (s) => { pay(s, 15); s.rp += 4; s.med += 6; return "The quack proves a decent herbalist, if no healer."; } },
    ],
  },
  {
    id: "hoarders", icon: "🌾", title: "Grain Hoarders", cooldown: 16,
    cond: (s) => s.food < 30 || s.foodRatio < 1, weight: (s) => (s.food < 15 ? 3 : 1.5),
    pick: (s) => maxBy(s.districts, (d) => d.hunger + d.panic / 100) || s.districts[0],
    text: (_s, d) => `Merchants in ${d.name} are sitting on full granaries while the city goes hungry. Mobs gather outside their doors.`,
    choices: [
      { label: "Seize the granaries", desc: "+35 food, trust -4.",
        apply: (s) => { s.food += 35; adjTrust(s, -4); return "Guards empty the granaries. The merchants will not forget."; } },
      { label: "Buy at inflated prices", desc: "Costs 80 funds. +40 food.", can: funds(80),
        apply: (s) => { pay(s, 80); s.food += 40; return "Expensive, but the bread lines move again."; } },
      { label: "Enforce rationing", desc: "Rationing policy on. Panic +10 here.",
        apply: (s, d) => { s.policies.rations = true; d.panic = clamp(d.panic + 10, 0, 100); return "Ration cards are issued. Grumbling follows."; } },
    ],
  },
  {
    id: "pits", icon: "⚰️", title: "Overflowing Plague Pits", cooldown: 14,
    cond: (s) => s.districts.some((d) => d.bodies > 30), weight: (s) => 2 + s.districts.filter((d) => d.bodies > 60).length,
    pick: (s) => maxBy(s.districts, (d) => d.bodies),
    text: (_s, d) => `The pits in ${d.name} can hold no more. Bodies lie in the street and the smell drifts over the rooftops.`,
    choices: [
      { label: "Burn the dead", desc: "Costs 20 funds. Clears every body here; panic +5.", can: funds(20),
        apply: (s, d) => { pay(s, 20); d.bodies = 0; d.panic = clamp(d.panic + 5, 0, 100); burst(s, d.x, d.y, "#ff8a3a", 24); return "Black smoke rises. The streets are clear."; } },
      { label: "Mass grave outside the walls", desc: "Bodies -70%. Rumour +15 here.",
        apply: (s, d) => { d.bodies *= 0.3; rumorSpread(s, d, 15, 0.3); return "Carts rumble out at night. People whisper about it."; } },
      { label: "Commission corpse carts", desc: "Enables the Corpse Carts policy (upkeep 4/day).",
        apply: (s) => { s.policies.carts = true; return "A permanent crew of carters is hired."; } },
    ],
  },
  {
    id: "donation", icon: "🏦", title: "Guild Donation", cooldown: 24,
    cond: (s) => s.day >= 4 && s.funds < 500, weight: () => 0.8,
    pick: (s) => rand(s, ofType(s, "market").concat(s.districts.slice(0, 2))) || s.districts[0],
    text: () => "The merchant guilds offer a donation to the quarantine effort, though a few men in fine coats seem to expect favours in return.",
    choices: [
      { label: "Accept with gratitude", desc: "+90 funds.", apply: (s) => { s.funds += 90; return "A modest, honest gift."; } },
      { label: "Promise a council seat", desc: "+160 funds, trust -2.", apply: (s) => { s.funds += 160; adjTrust(s, -2); return "The coffers swell. So do the rumours of corruption."; } },
      { label: "Decline", desc: "Trust +1.", apply: (s) => { adjTrust(s, 1); return "The people respect an incorruptible doctor."; } },
    ],
  },
  {
    id: "scholars", icon: "🎓", title: "Scholars' Breakthrough", cooldown: 20,
    cond: (s) => s.day >= 6 && ofType(s, "university").length > 0, weight: () => 0.9,
    pick: (s) => rand(s, ofType(s, "university")),
    text: (_s, d) => `The scholars of ${d.name} believe they are close to a breakthrough, if only they had the resources to dissect more cases.`,
    choices: [
      { label: "Fund the work", desc: "Costs 40 funds. +15 research.", can: funds(40), apply: (s) => { pay(s, 40); s.rp += 15; return "Late nights and bubbling flasks. A fruitful result."; } },
      { label: "Publish openly", desc: "+6 research, trust +2.", apply: (s) => { s.rp += 6; adjTrust(s, 2); return "Pamphlets spread. The public feels informed."; } },
      { label: "Keep it secret", desc: "+10 research, no side effects.", apply: (s) => { s.rp += 10; return "The findings are locked in your study."; } },
    ],
  },
  {
    id: "refugees", icon: "🚶", title: "Refugee Column", cooldown: 22,
    cond: (s) => s.day >= 8, weight: () => 1,
    pick: (s) => rand(s, s.districts.filter((d) => d.type === "farms" || d.type === "docks" || d.type === "barracks")) || s.districts[0],
    text: (_s, d) => `Hundreds of ragged refugees from the plague-stricken countryside beg for shelter at the edge of ${d.name}.`,
    choices: [
      { label: "Admit into shelters", desc: "Trust +3. +300 residents, a few carry plague unseen.",
        apply: (s, d) => { adjTrust(s, 3); d.S += 294; d.E += 6; d.pop0 += 300; return "The gates open. Some of them are already sick."; } },
      { label: "Turn them away", desc: "Trust -3.", apply: (s) => { adjTrust(s, -3); return "The gates stay shut. Wails echo outside."; } },
      { label: "Build a camp outside", desc: "Costs 50 funds. Trust +2, +10 food from their labour.", can: funds(50),
        apply: (s) => { pay(s, 50); adjTrust(s, 2); s.food += 10; return "A tent camp rises beyond the walls."; } },
    ],
  },
  {
    id: "rats", icon: "🐀", title: "Ships Arrive with Rats", cooldown: 20,
    cond: (s) => s.day >= 5 && ofType(s, "docks").length > 0, weight: () => 1,
    pick: (s) => rand(s, ofType(s, "docks")),
    text: (_s, d) => `A fleet puts in at ${d.name}. Dockworkers report rats the size of cats swarming from the holds.`,
    choices: [
      { label: "Fumigate the holds", desc: "Costs 25 funds and 3 medicine. Avoids the problem.", can: (s) => s.funds >= 25 && s.med >= 3,
        apply: (s) => { pay(s, 25); s.med -= 3; return "Sulphur smoke pours from the hatches."; } },
      { label: "Ignore it", desc: "+12% spread for 10 days. Unseen infection at the docks.",
        apply: (s, d) => { s.temp.rats = Math.max(s.temp.rats || 0, 10); seedExposure(s, d, 3); return "The rats scatter into the warehouses."; } },
      { label: "Seal the harbour", desc: "Costs 40 funds. Quarantines the docks district.", can: funds(40),
        apply: (s, d) => { pay(s, 40); d.quarantine = true; return "Chains stretch across the harbour mouth."; } },
    ],
  },
  {
    id: "wells", icon: "🪣", title: "Poisoned Wells", cooldown: 18,
    cond: (s) => s.day >= 7 && s.districts.some((d) => d.rumor > 15 || d.panic > 40), weight: () => 1.1,
    pick: (s) => maxBy(s.districts, (d) => d.rumor + d.panic / 2),
    text: (_s, d) => `A cry goes up in ${d.name}: the wells are poisoned by foreigners! Angry crowds are searching for someone to blame.`,
    choices: [
      { label: "Post guards at the wells", desc: "Costs 35 funds. Rumour cleared here.", can: funds(35),
        apply: (s, d) => { pay(s, 35); d.rumor = 0; rumorSpread(s, d, 0, 0); return "Armed watchmen guard every pump."; } },
      { label: "Investigate openly", desc: "Costs 15 funds. Trust +2, rumour -15.", can: funds(15),
        apply: (s, d) => { pay(s, 15); adjTrust(s, 2); rumorSpread(s, d, -15, 0.3); return "Your inquiry finds clean water. The crowd disperses."; } },
      { label: "Ignore it", desc: "Panic +15 here, +6 nearby.", apply: (s, d) => { panicSpread(s, d, 15, 0.4); return "A scapegoat is found and the district boils."; } },
    ],
  },
  {
    id: "priests", icon: "🕯️", title: "Priests Offer Sanctuary", cooldown: 22,
    cond: (s) => s.day >= 6 && ofType(s, "temple").length > 0, weight: () => 0.9,
    pick: (s) => rand(s, ofType(s, "temple")),
    text: (_s, d) => `The abbot of ${d.name} offers cloisters, herb gardens and prayers to the afflicted - if you will attend mass.`,
    choices: [
      { label: "Accept sanctuary", desc: "+8 medicine, trust +3, panic -15 here.",
        apply: (s, d) => { s.med += 8; adjTrust(s, 3); panicSpread(s, d, -15, 0.3); return "Bells ring out. The sick are given cots."; } },
      { label: "Politely refuse", desc: "+3 research from secular study; trust -2.", apply: (s) => { s.rp += 3; adjTrust(s, -2); return "The abbot withdraws, offended."; } },
    ],
  },
];

export function getEventDef(id: string): EventDef | undefined { return EVENTS.find((e) => e.id === id); }

export function pickEvent(s: Sim): ActiveEvent | null {
  const pool = EVENTS.filter((e) => e.cond(s) && s.day - (s.eventLast[e.id] ?? -999) >= e.cooldown);
  if (!pool.length) return null;
  const total = pool.reduce((a, e) => a + Math.max(0.01, e.weight(s)), 0);
  let r = rnd(s) * total;
  for (const e of pool) {
    r -= Math.max(0.01, e.weight(s));
    if (r <= 0) {
      const d = e.pick(s);
      if (!d) continue;
      s.eventLast[e.id] = s.day;
      return { id: e.id, did: d.id };
    }
  }
  return null;
}

export function resolveEvent(s: Sim, idx: number): string {
  const ev = s.pendingEvent;
  if (!ev) return "";
  const def = getEventDef(ev.id);
  const d = s.districts[ev.did];
  if (!def || !d) { s.pendingEvent = null; return ""; }
  const ch = def.choices[idx];
  if (!ch || (ch.can && !ch.can(s))) return "";
  const msg = ch.apply(s, d);
  s.stats.events++;
  addLog(s, `${def.title}: ${msg}`, "event");
  floaterAt(s, d, def.icon, "#e8d9b5", 20);
  sfx(s, "ok");
  s.pendingEvent = null;
  return msg;
}
