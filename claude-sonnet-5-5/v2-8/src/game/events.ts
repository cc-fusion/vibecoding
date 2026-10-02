import { GOODS, GOOD_IDS, type GoodId } from "./data";
import { addBond, clampResources, derive, getBond, goodsTotal, newCrew, type Crew, type Run } from "./run";

export interface EventCtx {
  run: Run;
  say(text: string, color?: string): void;
  alive(): Crew[];
  pick(excludeId?: number): Crew | null;
  mood(c: Crew, d: number): void;
  moodAll(d: number): void;
  triggerQuake(): void;
  float(text: string, color: string): void;
}
export interface EventOpt { label: string; hint: string; run: (g: EventCtx) => string; }
export interface EventBuilt { icon: string; title: string; text: string; opts: EventOpt[]; }
export interface EventDef { id: string; weight: number; cond: (g: EventCtx) => boolean; build: (g: EventCtx) => EventBuilt; }

const pairBond = (g: EventCtx, a: Crew, b: Crew, d: number) => addBond(g.run, a.id, b.id, d);
const allPairs = (g: EventCtx, d: number) => {
  const al = g.alive();
  for (let i = 0; i < al.length; i++) for (let j = i + 1; j < al.length; j++) addBond(g.run, al[i].id, al[j].id, d);
};
const randGood = (): GoodId => GOOD_IDS[Math.floor(Math.random() * GOOD_IDS.length)];

export const EVENTS: EventDef[] = [
  {
    id: "dispute", weight: 3, cond: (g) => g.alive().length >= 2,
    build: (g) => {
      const a = g.pick()!; const b = g.pick(a.id)!;
      return {
        icon: "🍲", title: "Ration Dispute",
        text: `${a.name} and ${b.name} are shouting over who got the bigger portion. The whole caravan can hear it over the engine.`,
        opts: [
          { label: `Side with ${a.name}`, hint: `${a.name} +morale, ${b.name} −morale, bond drops`, run: () => { g.mood(a, 8); g.mood(b, -12); pairBond(g, a, b, -10); return `${b.name} sulks. ${a.name} feels vindicated.`; } },
          { label: "Split the portions (−3 food)", hint: "Bond improves, small morale gain", run: () => { g.run.food = Math.max(0, g.run.food - 3); g.mood(a, 4); g.mood(b, 4); pairBond(g, a, b, 8); return "Peace is restored over a shared pot."; } },
          { label: "Tell them to walk it off", hint: "Both lose morale, bond slips", run: () => { g.mood(a, -5); g.mood(b, -5); pairBond(g, a, b, -4); return "They glare at each other for the next hour."; } },
        ],
      };
    },
  },
  {
    id: "song", weight: 3, cond: () => true,
    build: (g) => {
      const c = g.pick()!;
      return {
        icon: "🎻", title: "Campfire Song",
        text: `${c.name} pulls out a battered fiddle and starts a slow tune that carries across the ice.`,
        opts: [
          { label: "Join the singalong", hint: "+8 morale for all, bonds grow", run: () => { g.moodAll(8); allPairs(g, 2); return "A rare moment of togetherness warms the crew."; } },
          { label: "Pass around hot cocoa (−2 food)", hint: "+14 morale for all", run: () => { g.run.food = Math.max(0, g.run.food - 2); g.moodAll(14); return "Cocoa and song. Spirits soar."; } },
          { label: "Keep your eyes on the ice", hint: "No effect", run: () => "The tune fades into the wind." },
        ],
      };
    },
  },
  {
    id: "frostbite", weight: 3, cond: (g) => g.alive().length > 0,
    build: (g) => {
      const al = g.alive().sort((a, b) => a.warmth - b.warmth);
      const c = al[0];
      return {
        icon: "🥶", title: "Frostbite Scare",
        text: `${c.name}'s fingers have gone white and numb. They have been hiding it for hours.`,
        opts: [
          { label: "Treat with Medicine (1 unit)", hint: "Requires medicine cargo. Heals, +morale", run: () => {
            if (g.run.goods.medicine < 1) { c.health = Math.max(1, c.health - 8); return "You have no medicine. The fingers worsen."; }
            g.run.goods.medicine -= 1; g.run.goodsCost.medicine = Math.max(0, g.run.goodsCost.medicine - 50);
            c.health = Math.min(100, c.health + 30); g.mood(c, 6); return `${c.name} is treated and recovers.`; } },
          { label: "Warm them at the stove (−3 fuel)", hint: "Restores warmth", run: () => { g.run.fuel = Math.max(0, g.run.fuel - 3); c.warmth = Math.min(100, c.warmth + 45); c.health = Math.min(100, c.health + 6); return `${c.name} thaws out beside the stove.`; } },
          { label: "Tell them to tough it out", hint: "−15 health, −morale", run: () => { c.health = Math.max(1, c.health - (c.trait === "hardy" || c.trait === "brave" ? 6 : 15)); g.mood(c, -7); return `${c.name} grits their teeth.`; } },
        ],
      };
    },
  },
  {
    id: "stowaway", weight: 1.5, cond: (g) => g.alive().length < derive(g.run).crewCap,
    build: (g) => ({
      icon: "🧥", title: "Stowaway!",
      text: "A half-frozen stranger crawls out from under a cargo tarp, begging for passage to Polaris Station.",
      opts: [
        { label: "Take them in (−4 food)", hint: "Gain a new crew member", run: () => {
          const c = newCrew(g.run, Math.random, undefined, g.run.crew.map((x) => x.name)); c.morale = 85;
          for (const o of g.run.crew) addBond(g.run, c.id, o.id, Math.round(Math.random() * 30 - 5));
          g.run.crew.push(c); g.run.food = Math.max(0, g.run.food - 4); return `${c.name} (${c.role}) joins the caravan.`; } },
        { label: "Give a ration and send them off (−3 food)", hint: "+4 morale for all", run: () => { g.run.food = Math.max(0, g.run.food - 3); g.moodAll(4); return "The stranger trudges back onto the ice, grateful."; } },
        { label: "Leave them behind", hint: "−8 morale for all (guilt)", run: () => { g.moodAll(-8); return "Nobody speaks for a long while."; } },
      ],
    }),
  },
  {
    id: "wreck", weight: 2.5, cond: () => true,
    build: (g) => ({
      icon: "🛞", title: "Wreck on the Ice",
      text: "The skeleton of an old caravan juts from the snow. Crates, still frozen shut, are visible through the ribs.",
      opts: [
        { label: "Quick salvage", hint: "60%: loot. 40%: the ice groans — a tremor!", run: () => {
          if (Math.random() < 0.6) {
            const gd = randGood(); const d = derive(g.run);
            const n = Math.min(2 + Math.floor(Math.random() * 2), d.cargoCap - goodsTotal(g.run));
            if (n > 0) { g.run.goods[gd] += n; g.run.goodsCost[gd] += n * 10; } g.run.planks = Math.min(d.plankCap, g.run.planks + 2); clampResources(g.run);
            return n > 0 ? `Salvaged ${n}× ${GOODS[gd].name} and two planks!` : "Salvaged two planks (cargo bays full).";
          }
          g.triggerQuake(); return "The wreck shifts — the ice begins to shake!"; } },
        { label: "Careful search (−2 food)", hint: "Safe: +12 fuel", run: () => { g.run.food = Math.max(0, g.run.food - 2); g.run.fuel += 12; clampResources(g.run); return "A half-full jerrycan, still sloshing."; } },
        { label: "Move on", hint: "No effect", run: () => "Better not to disturb the dead." },
      ],
    }),
  },
  {
    id: "homesick", weight: 2, cond: (g) => g.alive().length > 0,
    build: (g) => {
      const c = g.pick()!;
      return {
        icon: "✉️", title: "Homesick",
        text: `${c.name} has been staring at the same crumpled letter for hours. The next village is still far away.`,
        opts: [
          { label: "Let them read it aloud", hint: "+10 morale for them, +3 for others", run: () => { g.mood(c, 10); for (const o of g.alive()) if (o.id !== c.id) { g.mood(o, 3); addBond(g.run, c.id, o.id, 3); } return "The letter is lovely. Several eyes are wet."; } },
          { label: "Pay them a bonus (−40 scrip)", hint: "+20 morale for them", run: () => { if (g.run.credits < 40) return "You can't afford it — the moment passes."; g.run.credits -= 40; g.mood(c, 20); return `${c.name} pockets the scrip and nods.`; } },
          { label: "Tell them to focus", hint: "−10 morale for them", run: () => { g.mood(c, -10); return `${c.name} puts the letter away.`; } },
        ],
      };
    },
  },
  {
    id: "theft", weight: 2, cond: (g) => g.alive().length >= 2 && g.run.fuel > 20,
    build: (g) => {
      const t = g.pick()!;
      return {
        icon: "🕵️", title: "Fuel Theft",
        text: `You catch ${t.name} siphoning fuel into a private canister. "It's for emergencies," they claim.`,
        opts: [
          { label: "Punish them", hint: `${t.name} −morale, crew respects order`, run: () => { g.mood(t, -16); for (const o of g.alive()) if (o.id !== t.id) { g.mood(o, 3); addBond(g.run, t.id, o.id, -6); } return `${t.name} is stripped of watch duties.`; } },
          { label: "Forgive (−8 fuel)", hint: "Bonds grow, you lose fuel", run: () => { g.run.fuel = Math.max(0, g.run.fuel - 8); for (const o of g.alive()) if (o.id !== t.id) addBond(g.run, t.id, o.id, 4); g.mood(t, 8); return `${t.name} is relieved and promises to repay the debt.`; } },
        ],
      };
    },
  },
  {
    id: "trader", weight: 2.5, cond: () => true,
    build: (g) => ({
      icon: "🛷", title: "Wandering Trader",
      text: "A lone trader's dog sled slides alongside your tractor, flags waving. They want to swap.",
      opts: [
        { label: "Buy 15 fuel (45 scrip)", hint: "Top up the tanks", run: () => { if (g.run.credits < 45) return "You can't afford it."; g.run.credits -= 45; g.run.fuel += 15; clampResources(g.run); return "Fuel secured."; } },
        { label: "Sell 2 cargo at a premium", hint: "Sell your two most valuable units at +30%", run: () => {
          let sold = 0, earned = 0;
          const order = [...GOOD_IDS].sort((a, b) => GOODS[b].base - GOODS[a].base);
          for (const gd of order) while (sold < 2 && g.run.goods[gd] > 0) { g.run.goods[gd]--; g.run.goodsCost[gd] = Math.max(0, g.run.goodsCost[gd] - GOODS[gd].base * 0.7); sold++; earned += Math.round(GOODS[gd].base * 1.3); }
          g.run.credits += earned; return sold ? `Sold ${sold} units for ${earned} scrip.` : "You have nothing to sell."; } },
        { label: "Wave them off", hint: "No effect", run: () => "The sled peels away across the ice." },
      ],
    }),
  },
  {
    id: "feud", weight: 4,
    cond: (g) => { const al = g.alive(); for (let i = 0; i < al.length; i++) for (let j = i + 1; j < al.length; j++) if (getBond(g.run, al[i].id, al[j].id) < -35) return true; return false; },
    build: (g) => {
      const al = g.alive(); let a = al[0], b = al[1], worst = 999;
      for (let i = 0; i < al.length; i++) for (let j = i + 1; j < al.length; j++) { const v = getBond(g.run, al[i].id, al[j].id); if (v < worst) { worst = v; a = al[i]; b = al[j]; } }
      return {
        icon: "💢", title: "Open Feud",
        text: `${a.name} and ${b.name} have stopped speaking — and now they are throwing tools. This will tear the crew apart.`,
        opts: [
          { label: "Separate them", hint: "−5 morale each, bond +10", run: () => { g.mood(a, -5); g.mood(b, -5); pairBond(g, a, b, 10); return "A cold peace settles over the caravan."; } },
          { label: "Make them share a task", hint: "50%: bond +25. 50%: bond −15", run: () => { if (Math.random() < 0.5) { pairBond(g, a, b, 25); return "Working together, they find common ground."; } pairBond(g, a, b, -15); g.mood(a, -6); g.mood(b, -6); return "It goes badly. Very badly."; } },
          { label: "Ignore it", hint: "Morale loss for everyone", run: () => { g.moodAll(-5); return "The tension is felt by everyone."; } },
        ],
      };
    },
  },
];
