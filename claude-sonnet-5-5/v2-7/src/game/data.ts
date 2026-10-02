// ───────── Core types & static content for Parliament of Crows ─────────
export type Issue = "wealth" | "order" | "welfare" | "nature";
export const ISSUES: Issue[] = ["wealth", "order", "welfare", "nature"];
export const ISSUE_META: Record<Issue, { name: string; emoji: string; color: string; neg: string; pos: string }> = {
  wealth: { name: "Wealth", emoji: "💰", color: "#fbbf24", neg: "Austerity", pos: "Prosperity" },
  order: { name: "Order", emoji: "⚖️", color: "#60a5fa", neg: "Liberty", pos: "Vigilance" },
  welfare: { name: "Commons", emoji: "🍞", color: "#fb923c", neg: "Thrift", pos: "Gleaning" },
  nature: { name: "Wilds", emoji: "🌿", color: "#34d399", neg: "Harvest", pos: "Hedgerow" },
};
export type Prefs = Record<Issue, number>;
export type FId = "crows" | "ravens" | "magpies" | "jackdaws" | "rooks" | "owls";
export const FACTION_ORDER: FId[] = ["jackdaws", "owls", "crows", "magpies", "rooks", "ravens"];

export interface FactionDef {
  id: FId; name: string; emoji: string; color: string; title: string; blurb: string;
  prefs: Prefs; greed: number; snitch: number; discipline: number; baseTrust: number; baseSeats: number;
  persuade: number; quirk: string;
}
export const FACTIONS: Record<FId, FactionDef> = {
  crows: { id: "crows", name: "The Murder", emoji: "🐦‍⬛", color: "#a78bfa", title: "Your Party", blurb: "Your loyal caucus. Mostly obedient — unless you ignore their ideals.", prefs: { wealth: 0, order: 0, welfare: 0, nature: 0 }, greed: 0, snitch: 0, discipline: 0.7, baseTrust: 40, baseSeats: 24, persuade: 1, quirk: "Loyal, but they still hold ideals." },
  ravens: { id: "ravens", name: "Ravens", emoji: "⚖️", color: "#60a5fa", title: "Order of the Black Robe", blurb: "Stern jurists. Nearly incorruptible and they report bribes to the press.", prefs: { wealth: 0, order: 2, welfare: -1, nature: 1 }, greed: 0.5, snitch: 2.4, discipline: 0.6, baseTrust: -5, baseSeats: 18, persuade: 0.9, quirk: "Refuse bribes when you are notorious. Bribery spikes Heat." },
  magpies: { id: "magpies", name: "Magpies", emoji: "💎", color: "#fbbf24", title: "Guild of Glittering Trade", blurb: "Merchants who love shiny things — and sell to the highest bidder.", prefs: { wealth: 2, order: -1, welfare: -1, nature: -1 }, greed: 1.5, snitch: 0.3, discipline: 0.45, baseTrust: 0, baseSeats: 16, persuade: 0.8, quirk: "Prices climb with every bribe. May double-cross you." },
  jackdaws: { id: "jackdaws", name: "Jackdaws", emoji: "🍞", color: "#fb923c", title: "The Commons Chorus", blurb: "Loud populists. Swayed by speeches and public mood, fickle with scandal.", prefs: { wealth: -1, order: -1, welfare: 2, nature: 1 }, greed: 0.9, snitch: 1.0, discipline: 0.3, baseTrust: 5, baseSeats: 17, persuade: 1.5, quirk: "Love speeches. Punish scandal hard." },
  rooks: { id: "rooks", name: "Rooks", emoji: "🌾", color: "#34d399", title: "Landed Rookeries", blurb: "Disciplined farmers who vote as one bloc. Slow to trust, brutal to betrayers.", prefs: { wealth: 0, order: 1, welfare: 1, nature: 2 }, greed: 0.7, snitch: 0.9, discipline: 0.88, baseTrust: 0, baseSeats: 14, persuade: 0.7, quirk: "Vote in tight blocs. Broken pledges cost double trust." },
  owls: { id: "owls", name: "Owls", emoji: "🦉", color: "#f43f5e", title: "Conclave of Wise Eyes", blurb: "Scholars who study YOU. They counter whichever tactic you lean on most.", prefs: { wealth: 2, order: 2, welfare: -1, nature: 0 }, greed: 0.4, snitch: 1.4, discipline: 0.75, baseTrust: -12, baseSeats: 10, persuade: 0.5, quirk: "Adaptive: counters your favourite tactic." },
};

export interface Mods {
  ap: number; startShinies: number; startRenown: number; income: number; bribeCost: number; bribeHeat: number;
  persuade: number; trustGain: number; clarity: number; heatDecay: number; scandalChance: number; riderSlots: number;
  riderCost: number; startSeats: number; pardon: number; startDirtAll: number; startDirt: number; snoopBonus: number;
  blackmailPower: number; pledgePower: number; renownPerSitting: number; heatMult: number;
}
export const BASE_MODS = (): Mods => ({
  ap: 0, startShinies: 0, startRenown: 0, income: 0, bribeCost: 0, bribeHeat: 0, persuade: 0, trustGain: 0, clarity: 0,
  heatDecay: 0, scandalChance: 0, riderSlots: 0, riderCost: 0, startSeats: 0, pardon: 0, startDirtAll: 0, startDirt: 0,
  snoopBonus: 0, blackmailPower: 0, pledgePower: 0, renownPerSitting: 0, heatMult: 0,
});

export interface LeaderDef { id: string; name: string; title: string; emoji: string; blurb: string; perks: string[]; prefs: Prefs; cost: number; mods: Partial<Mods>; }
export const LEADERS: LeaderDef[] = [
  { id: "schemer", name: "Mortimer Crowe", title: "The Schemer", emoji: "🎩", blurb: "A smooth fixer with deep pockets and a looser conscience.", perks: ["+12 starting shinies", "Bribes cost 15% less", "+10% Heat from everything"], prefs: { wealth: 1, order: 0, welfare: -1, nature: 0 }, cost: 0, mods: { startShinies: 12, bribeCost: 0.15, heatMult: 0.1 } },
  { id: "idealist", name: "Dame Corvina", title: "The Idealist", emoji: "🕯️", blurb: "Beloved orator. Speeches ring true — but bribes reek.", perks: ["+15 starting Renown", "+4 speech power", "Bribes cause +25% Heat"], prefs: { welfare: 2, nature: 1, wealth: -1, order: 0 }, cost: 0, mods: { startRenown: 15, persuade: 4, bribeHeat: -0.25 } },
  { id: "tribune", name: "Ebb the Tribune", title: "The Tribune", emoji: "📣", blurb: "A people's crow. Gains trust fast and keeps a bigger caucus.", perks: ["+4 starting seats", "+25% trust gained", "Pledges are 25% stronger"], prefs: { welfare: 1, order: -1, wealth: 0, nature: 1 }, cost: 25, mods: { startSeats: 4, trustGain: 0.25, pledgePower: 0.25 } },
  { id: "spymaster", name: "Hush", title: "The Spymaster", emoji: "🗝️", blurb: "Knows everyone's secrets before they do.", perks: ["Start with 1 Dirt on every faction", "Snoop yields +1 Dirt", "Blackmail 30% stronger"], prefs: { order: 1, wealth: 1, welfare: 0, nature: -1 }, cost: 60, mods: { startDirtAll: 1, snoopBonus: 1, blackmailPower: 0.3 } },
  { id: "firebrand", name: "Cinder", title: "The Firebrand", emoji: "🔥", blurb: "Reckless and fast: an extra action each sitting, but a short fuse.", perks: ["+1 Action Point", "Scandals are 20% likelier", "Start with 10 less Renown"], prefs: { order: -2, welfare: 1, wealth: 0, nature: 1 }, cost: 110, mods: { ap: 1, scandalChance: -0.2, startRenown: -10 } },
];

export interface MetaUpgrade { id: string; name: string; desc: string; cost: number; req?: string; branch: "Cunning" | "Charm" | "Intel" | "Power"; emoji: string; mods: Partial<Mods>; }
export const META_UPGRADES: MetaUpgrade[] = [
  { id: "c1", branch: "Cunning", emoji: "🪙", name: "Loose Change", desc: "+8 starting shinies", cost: 12, mods: { startShinies: 8 } },
  { id: "c2", branch: "Cunning", emoji: "📒", name: "Fixer's Rolodex", desc: "Bribes cost 10% less", cost: 28, req: "c1", mods: { bribeCost: 0.1 } },
  { id: "c3", branch: "Cunning", emoji: "📚", name: "Double Ledger", desc: "Bribes cause 25% less Heat", cost: 50, req: "c2", mods: { bribeHeat: 0.25 } },
  { id: "h1", branch: "Charm", emoji: "🎶", name: "Dawn Chorus", desc: "+3 speech power", cost: 12, mods: { persuade: 3 } },
  { id: "h2", branch: "Charm", emoji: "🌟", name: "Beloved Pest", desc: "+10 starting Renown", cost: 28, req: "h1", mods: { startRenown: 10 } },
  { id: "h3", branch: "Charm", emoji: "🤝", name: "Honest Broker", desc: "+35% trust gained", cost: 50, req: "h2", mods: { trustGain: 0.35 } },
  { id: "i1", branch: "Intel", emoji: "🔑", name: "Keyhole", desc: "Whip counts 30% clearer", cost: 18, mods: { clarity: 0.3 } },
  { id: "i2", branch: "Intel", emoji: "🕸️", name: "Whisper Network", desc: "Snoop yields +1 Dirt", cost: 34, req: "i1", mods: { snoopBonus: 1 } },
  { id: "i3", branch: "Intel", emoji: "👁️", name: "Spymaster's Eye", desc: "Whip counts 40% clearer", cost: 58, req: "i2", mods: { clarity: 0.4 } },
  { id: "p2", branch: "Power", emoji: "🏛️", name: "Stronghold Seats", desc: "+3 starting seats", cost: 35, mods: { startSeats: 3 } },
  { id: "p3", branch: "Power", emoji: "🪶", name: "Pardon Feather", desc: "Survive one impeachment (Heat resets to 50)", cost: 55, req: "p2", mods: { pardon: 1 } },
  { id: "p1", branch: "Power", emoji: "🪺", name: "Extra Perch", desc: "+1 Action Point each sitting", cost: 85, req: "p3", mods: { ap: 1 } },
];

export const DIFFS = {
  fledgling: { name: "Fledgling", emoji: "🐣", desc: "Gentler rivals, cheaper bribes, forgiving press.", shinies: 50, crows: 28, heat: 0.7, bribe: 0.8, income: 1.15, hidden: 0.6, aggro: 0.7, feather: 0.7, minSeats: 8 },
  corvid: { name: "Corvid", emoji: "🐦‍⬛", desc: "The intended experience. Fair but cunning rivals.", shinies: 36, crows: 24, heat: 1, bribe: 1, income: 1, hidden: 1, aggro: 1, feather: 1, minSeats: 12 },
  raven: { name: "Raven", emoji: "🦅", desc: "Ruthless press, pricey bribes, murky whip counts.", shinies: 28, crows: 21, heat: 1.3, bribe: 1.25, income: 0.88, hidden: 1.4, aggro: 1.35, feather: 1.6, minSeats: 16 },
} as const;
export type DiffId = keyof typeof DIFFS;

export const MANDATES = [
  { id: "press", name: "Hostile Press", emoji: "📰", desc: "Heat gains ×1.4", bonus: 0.2 },
  { id: "austerity", name: "Austerity", emoji: "🪙", desc: "Income ×0.7", bonus: 0.2 },
  { id: "fractured", name: "Fractured House", emoji: "💥", desc: "Seats waver ×1.3 more", bonus: 0.15 },
  { id: "ironbeak", name: "Ironbeak Owls", emoji: "🦉", desc: "Owls start with +10 seats and strike harder", bonus: 0.25 },
  { id: "short", name: "Short Sittings", emoji: "⏳", desc: "−1 Action Point per sitting", bonus: 0.3 },
] as const;

export interface BillTemplate { id: string; name: string; emoji: string; stance: Prefs; }
export const TEMPLATES: BillTemplate[] = [
  { id: "grain", name: "Grain Tithe Act", emoji: "🌾", stance: { wealth: -1, order: 0, welfare: 2, nature: 0 } },
  { id: "trade", name: "Beakmark Trade Act", emoji: "💰", stance: { wealth: 2, order: 1, welfare: 0, nature: 0 } },
  { id: "hedge", name: "Hedgerow Preservation", emoji: "🌿", stance: { wealth: -1, order: 0, welfare: 0, nature: 2 } },
  { id: "watch", name: "Nest Watch Act", emoji: "🛡️", stance: { wealth: 0, order: 2, welfare: -1, nature: 0 } },
  { id: "skies", name: "Open Skies Charter", emoji: "🕊️", stance: { wealth: 1, order: -2, welfare: 1, nature: 0 } },
  { id: "mine", name: "Shiny Hills Mining", emoji: "⛏️", stance: { wealth: 2, order: 0, welfare: 0, nature: -2 } },
  { id: "rent", name: "Roost Rent Ceiling", emoji: "🏚️", stance: { wealth: -2, order: 1, welfare: 1, nature: 0 } },
  { id: "sanct", name: "Wild Flock Sanctuary", emoji: "🦢", stance: { wealth: 0, order: -1, welfare: 1, nature: 2 } },
  { id: "scare", name: "Scarecrow Tax Reform", emoji: "🎃", stance: { wealth: 1, order: 1, welfare: -2, nature: 0 } },
  { id: "bell", name: "Tower Bell Levy", emoji: "🔔", stance: { wealth: 1, order: 1, welfare: 0, nature: -1 } },
];

export interface RiderDef { id: string; name: string; emoji: string; cost: number; desc: string; needsTarget?: boolean; }
export const RIDERS: RiderDef[] = [
  { id: "pork", name: "Pork Barrel", emoji: "🐖", cost: 12, desc: "+18 lean from the faction selected when you add it.", needsTarget: true },
  { id: "kickback", name: "Kickback Clause", emoji: "💸", cost: 0, desc: "If passed: +12 shinies, +8 Heat. Ravens & Owls −6 lean." },
  { id: "sunset", name: "Sunset Clause", emoji: "🌇", cost: 6, desc: "+6 lean from all, but nation effects are halved." },
  { id: "gag", name: "Gag Rider", emoji: "🤐", cost: 8, desc: "If passed: −12 Heat. Jackdaws −12, Rooks −4 lean." },
  { id: "emergency", name: "Emergency Powers", emoji: "🚨", cost: 5, desc: "If passed: Order +4 extra. Jackdaws −10, Owls +8 lean." },
  { id: "fanfare", name: "Public Fanfare", emoji: "🎺", cost: 10, desc: "If passed: +8 Renown. +3 lean from all." },
];

export const CRISES = [
  { id: "locust", name: "Locust Swarm", emoji: "🦗", issue: "welfare" as Issue, text: "Swarms devour the barley. The Commons demand relief." },
  { id: "fire", name: "Hedgerow Wildfire", emoji: "🔥", issue: "nature" as Issue, text: "Flames race across the wilds. Rookeries beg for action." },
  { id: "riot", name: "Riot at Gutter Market", emoji: "🔨", issue: "order" as Issue, text: "Crowds smash stalls. Someone must restore the peace." },
  { id: "crash", name: "Shiny Market Crash", emoji: "📉", issue: "wealth" as Issue, text: "Glitter prices plummet. Merchants are flocking to ruin." },
];

export interface EventOption { label: string; desc: string; fn: (a: any) => string; }
export interface EventDef { id: string; title: string; emoji: string; text: string; options: EventOption[]; }
export const EVENTS: EventDef[] = [
  { id: "cache", title: "A Cache of Shinies", emoji: "🪙", text: "A rain-washed gutter reveals a forgotten hoard of glittering coins.", options: [
    { label: "Pocket it", desc: "+25 shinies, +8 Heat", fn: a => { a.shinies(25); a.heat(8); return "You quietly pocket the hoard."; } },
    { label: "Donate to the Commons", desc: "+8 Renown, Jackdaws +8 trust", fn: a => { a.renown(8); a.trust("jackdaws", 8); return "The Commons cheer your generosity."; } } ] },
  { id: "journo", title: "A Snooping Journalist", emoji: "📰", text: "A magpie reporter has been sniffing around your nest.", options: [
    { label: "Bribe her (−15)", desc: "−15 shinies, −8 Heat", fn: a => { if (!a.shinies(-15)) return "You can't afford it — the story runs. +6 Heat."; a.heat(-8); return "Her pen goes quiet."; } },
    { label: "Give an interview", desc: "+5 Renown, +4 Heat", fn: a => { a.renown(5); a.heat(4); return "You charm the press, mostly."; } },
    { label: "Ignore", desc: "+6 Heat", fn: a => { a.heat(6); return "The story simmers."; } } ] },
  { id: "harvest", title: "Harvest Festival", emoji: "🎑", text: "The Roost's greatest feast approaches. Funding is… optional.", options: [
    { label: "Fund it (−10)", desc: "+6 Renown, Commons +4, Wilds +3", fn: a => { if (!a.shinies(-10)) return "No funds. The feast is meagre."; a.renown(6); a.stat("welfare", 4); a.stat("nature", 3); return "A joyous night in the Roost."; } },
    { label: "Skip it", desc: "−2 Renown", fn: a => { a.renown(-2); return "Grumbles in the rookery."; } } ] },
  { id: "whistle", title: "Whistleblower", emoji: "📣", text: "A clerk has copied some of your 'discretionary' ledgers.", options: [
    { label: "Silence them (−18)", desc: "−18 shinies, +10 Heat, Jackdaws −6", fn: a => { a.shinies(-18); a.heat(10); a.trust("jackdaws", -6); return "The clerk finds a new nest. Far away."; } },
    { label: "Offer protection", desc: "+6 Renown, −8 Heat", fn: a => { a.renown(6); a.heat(-8); return "You're the hero who listens."; } } ] },
  { id: "fence", title: "The Magpie Fence", emoji: "🕵️", text: "A hooded magpie offers secrets about your rivals — for a price.", options: [
    { label: "Buy dirt (−14)", desc: "+2 Dirt on a random rival", fn: a => { if (!a.shinies(-14)) return "You come up short."; a.dirt(a.rival(), 2); return "A thick folder changes claws."; } },
    { label: "Refuse", desc: "+3 Renown", fn: a => { a.renown(3); return "You keep your claws clean."; } } ] },
  { id: "defect", title: "Defection Whispers", emoji: "🪽", text: "Backbenchers from a rival bloc are weary of their leadership.", options: [
    { label: "Court them (−12)", desc: "3 seats defect to you", fn: a => { if (!a.shinies(-12)) return "Your offer is too thin."; return a.defect(3); } },
    { label: "Decline", desc: "Nothing happens", fn: () => "You keep your distance." } ] },
  { id: "drought", title: "Drought over the Barley", emoji: "☀️", text: "The fields crack. Farmers appeal to the Parliament.", options: [
    { label: "Emergency aid (−20)", desc: "Commons +8, Wilds +4", fn: a => { if (!a.shinies(-20)) return "No funds for aid."; a.stat("welfare", 8); a.stat("nature", 4); return "Relief wagons roll out."; } },
    { label: "Let it ride", desc: "Commons −6, Rooks −6 trust", fn: a => { a.stat("welfare", -6); a.trust("rooks", -6); return "The Rooks remember."; } } ] },
  { id: "banquet", title: "A Rival's Banquet", emoji: "🍷", text: "An invitation arrives, sealed with an owl-feather.", options: [
    { label: "Attend", desc: "+6 trust with a random rival, +3 Heat", fn: a => { a.trust(a.rival(), 6); a.heat(3); return "Wine flows. So do secrets."; } },
    { label: "Host your own (−10)", desc: "+4 trust with all rivals", fn: a => { if (!a.shinies(-10)) return "Your pantry is bare."; a.trustAll(4); return "Your banquet is the talk of the Roost."; } } ] },
  { id: "customs", title: "Customs Seizure", emoji: "📦", text: "Inspectors seize a Magpie shipment. Paperwork is… flexible.", options: [
    { label: "Take a cut", desc: "+22 shinies, Wealth −4, +6 Heat", fn: a => { a.shinies(22); a.stat("wealth", -4); a.heat(6); return "A crate falls off the back of a cart."; } },
    { label: "Release it", desc: "Wealth +5, Magpies +8 trust", fn: a => { a.stat("wealth", 5); a.trust("magpies", 8); return "Magpie gratitude sparkles."; } } ] },
  { id: "mob", title: "Mob at the Gate", emoji: "🔥", text: "Torches gather outside the Roost.", options: [
    { label: "Disperse them", desc: "Order +6, Commons −4, Jackdaws −8", fn: a => { a.stat("order", 6); a.stat("welfare", -4); a.trust("jackdaws", -8); return "Batons and cold water clear the square."; } },
    { label: "Hear them out", desc: "Commons +4, Order −5, +4 Renown", fn: a => { a.stat("welfare", 4); a.stat("order", -5); a.renown(4); return "You promise much."; } } ] },
  { id: "omen", title: "Owl Prophecy", emoji: "🔮", text: "A cryptic Owl predicts your doom. Or your triumph. It is hard to tell.", options: [
    { label: "Pry into their files", desc: "+1 Dirt on Owls, Owls −4 trust", fn: a => { a.dirt("owls", 1); a.trust("owls", -4); return "You find something. They notice."; } },
    { label: "Smile politely", desc: "+3 Renown", fn: a => { a.renown(3); return "Unreadable, as always."; } } ] },
];

export interface BoonDef { id: string; name: string; emoji: string; desc: string; apply: (g: any) => void; }
export const BOONS: BoonDef[] = [
  { id: "gavel", name: "Golden Gavel", emoji: "🔨", desc: "+1 Action Point each sitting.", apply: g => { g.mods.ap += 1; } },
  { id: "hush", name: "Hush Fund", emoji: "🤫", desc: "Heat decays 6 faster each sitting.", apply: g => { g.mods.heatDecay += 6; } },
  { id: "purse", name: "Loaded Purse", emoji: "👛", desc: "+8 shinies of income per sitting.", apply: g => { g.mods.income += 8; } },
  { id: "tongue", name: "Silver Tongue", emoji: "🗣️", desc: "+6 speech power.", apply: g => { g.mods.persuade += 6; } },
  { id: "ring", name: "Informant Ring", emoji: "🧿", desc: "Whip counts 35% clearer. Snoop yields +1 Dirt.", apply: g => { g.mods.clarity += 0.35; g.mods.snoopBonus += 1; } },
  { id: "door", name: "Open Door Policy", emoji: "🚪", desc: "Trust gains +50%.", apply: g => { g.mods.trustGain += 0.5; } },
  { id: "rider", name: "Rider's Friend", emoji: "📎", desc: "Riders cost half and you may attach 3.", apply: g => { g.mods.riderCost += 0.5; g.mods.riderSlots += 1; } },
  { id: "cloak", name: "Cloak of Feathers", emoji: "🧥", desc: "Scandals are 35% less likely.", apply: g => { g.mods.scandalChance += 0.35; } },
  { id: "bargain", name: "Bargain Bin", emoji: "🏷️", desc: "Bribes cost 25% less.", apply: g => { g.mods.bribeCost += 0.25; } },
  { id: "halo", name: "Martyr's Halo", emoji: "😇", desc: "+20 Renown now, +1 each sitting.", apply: g => { g.renown = Math.min(100, g.renown + 20); g.mods.renownPerSitting += 1; } },
  { id: "warm", name: "Seat Warmers", emoji: "🪑", desc: "+4 seats defect to you from the largest rival.", apply: g => { g.__defect = 4; } },
  { id: "dirt", name: "Dirt Collector", emoji: "🗂️", desc: "+1 Dirt on every faction. Blackmail 35% stronger.", apply: g => { g.__dirtAll = 1; g.mods.blackmailPower += 0.35; } },
  { id: "pardon", name: "Royal Pardon", emoji: "📜", desc: "Survive one impeachment.", apply: g => { g.mods.pardon += 1; } },
];

export const BOSSES = {
  judge: { name: "Grand Judge Corvax", emoji: "👨‍⚖️", faction: "ravens" as FId, title: "Vote of No Confidence", text: "The Ravens' Grand Judge calls the House to censure you. Nation, press and caucus will be weighed." },
  queen: { name: "Queen Aurelia", emoji: "👑", faction: "magpies" as FId, title: "The Golden Coup", text: "The Magpie Queen buys half the House and demands your removal." },
  strix: { name: "Chancellor Strix", emoji: "🦉", faction: "owls" as FId, title: "The Great Charter", text: "Strix has studied your every move. Pass the Great Charter in three readings — win two — or be dissolved." },
};

export const TUTORIAL = [
  { id: "welcome", text: "Welcome to the Rookery, Leader. Pass bills by winning more than half the 99 seats. Everything you do shifts the whip count in the Chamber.", wait: "next" },
  { id: "slide", text: "Draft your bill: tap a template or drag the four sliders. Watch the forecast change as factions like or loathe your policy.", wait: "stance" },
  { id: "speech", text: "Select a faction (right) then give a Speech (1 Action Point) to nudge their lean in your favour.", wait: "speech" },
  { id: "bribe", text: "Short of votes? Bribe a faction with shinies. Powerful — but each bribe raises Heat. At 100 Heat you are impeached!", wait: "bribe" },
  { id: "vote", text: "When the forecast clears the majority line, CALL THE VOTE (Enter). Hidden factors may still surprise you. Good luck!", wait: "vote" },
];

export const HELP_PAGES = [
  { title: "The Goal", body: ["Lead The Murder through four Terms in the Rookery Parliament (99 seats). Each Term has four Sittings, ending in an Election. Term IV ends with the Great Charter showdown against Chancellor Strix of the Owls.", "You lose if you are impeached (Heat 100), a National stat falls to 0, you are ousted in an election (too few seats), or you lose a no-confidence vote or the final Charter."] },
  { title: "Bills & Whip Counts", body: ["Each bill has a stance from −2 to +2 on Wealth, Order, Commons and Wilds. Every faction has its own ideals; the closer a bill matches them, the more they lean 'Aye'.", "Each seat has a temperament; the Chamber shows lean as coloured rings. Hidden factors (rival bids, double-crosses) may still sway the real vote — Intel upgrades make the forecast clearer."] },
  { title: "Lobbying Actions", body: ["You have a few Action Points per sitting. Speech: free, builds trust. Bribe: costs shinies, strong, raises Heat. Pledge: promise a favour (+lean now, but you will owe a vote on their motion later). Snoop: gather Dirt. Blackmail: spend Dirt for a huge lean swing. Scandalize: spend Dirt to make 2 seats defect to you. Cover-up: spend shinies to lower Heat."] },
  { title: "Heat, Scandal & Renown", body: ["Heat is public suspicion. Bribes, snooping and kickbacks raise it. Each sitting there is a chance of a scandal hearing based on Heat — choose Deny, Spin, Scapegoat or Confess.", "Renown is public standing: it boosts speeches, elections and no-confidence votes."] },
  { title: "Nation & Elections", body: ["Passed bills change the nation's four stats. Stats drift downward every sitting; any stat hitting 0 collapses the nation. Wealth also pays your shinies income.", "At the end of a Term, voters judge how well the nation matches each party's ideals. Campaign wisely — seats shift, rival ideology adapts, and you choose a Boon."] },
  { title: "Rival Parties", body: ["Ravens: incorruptible, snitch on bribes. Magpies: greedy, double-cross. Jackdaws: love speeches, hate scandal. Rooks: bloc voters, harsh on betrayal. Owls: they COUNTER your most-used tactic.", "Rivals remember: bribes raise prices, broken pledges ruin trust, and coalition history builds loyalty. Sometimes they table motions; honour your pledges by supporting them."] },
  { title: "Controls", body: ["Mouse / touch: everything is clickable.", "Keys — 1-6: select faction · B: bribe · S: speech · P: pledge · N: snoop · K: blackmail · X: scandalize · C: cover-up · ←/→: adjust highlighted slider · ↑/↓: change slider · Enter/Space: call the vote · Esc: pause · M: mute."] },
];
