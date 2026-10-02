// Static game data for Coup d'Etat Protocol

export type RoomId =
  | "library" | "tower" | "chamber" | "treasury"
  | "chapel" | "throne" | "ballroom" | "apothecary"
  | "kitchen" | "courtyard" | "dungeon"
  | "barracks" | "gate" | "armory";

export interface RoomDef {
  id: RoomId;
  name: string;
  icon: string;
  col: number;
  row: number;
  span: number;
  garrison: number;
  color: string;
  desc: string;
}

export const WORLD_W = 1000;
export const WORLD_H = 680;

export const ROOMS: RoomDef[] = [
  { id: "library", name: "Library", icon: "📚", col: 0, row: 0, span: 1, garrison: 1, color: "#2a2030", desc: "Archivists forge letters here. Quiet — few witnesses." },
  { id: "tower", name: "Spymaster's Tower", icon: "🗼", col: 1, row: 0, span: 1, garrison: 3, color: "#1f2230", desc: "The Master of Whispers' lair. Reports are buried here." },
  { id: "chamber", name: "Royal Chamber", icon: "🛏️", col: 2, row: 0, span: 1, garrison: 5, color: "#33202a", desc: "The Monarch flees here during a coup. Final stand." },
  { id: "treasury", name: "Treasury", icon: "💰", col: 3, row: 0, span: 1, garrison: 3, color: "#33291a", desc: "Skim the coffers. Held in a coup: mercenaries arrive." },
  { id: "chapel", name: "Chapel", icon: "⛪", col: 0, row: 1, span: 1, garrison: 1, color: "#262a33", desc: "Divine mandate flows from here. Held in a coup: +10% rebel fury." },
  { id: "throne", name: "Throne Room", icon: "👑", col: 1, row: 1, span: 1, garrison: 8, color: "#3a1e26", desc: "Seat of power. Held in a coup: loyalist damage -10%." },
  { id: "ballroom", name: "Ballroom", icon: "🎻", col: 2, row: 1, span: 1, garrison: 2, color: "#2d2236", desc: "Court gossip central. Salons are held here." },
  { id: "apothecary", name: "Apothecary", icon: "⚗️", col: 3, row: 1, span: 1, garrison: 1, color: "#1f2f2a", desc: "Tinctures and tonics. The physician's workshop." },
  { id: "kitchen", name: "Kitchens", icon: "🍷", col: 0, row: 2, span: 1, garrison: 1, color: "#332a20", desc: "Servants talk. Feasts are prepared here." },
  { id: "courtyard", name: "Grand Courtyard", icon: "⛲", col: 1, row: 2, span: 2, garrison: 5, color: "#1f2e26", desc: "The hub of the palace. Everyone passes through." },
  { id: "dungeon", name: "Dungeon", icon: "⛓️", col: 3, row: 2, span: 1, garrison: 3, color: "#202024", desc: "Arrested souls rot here. Held in a coup: prisoners join you." },
  { id: "barracks", name: "Barracks", icon: "⚔️", col: 0, row: 3, span: 1, garrison: 10, color: "#2f2222", desc: "Source of loyalist reinforcements. Hold it to stop them." },
  { id: "gate", name: "Gatehouse", icon: "🏰", col: 1, row: 3, span: 2, garrison: 6, color: "#262626", desc: "Held in a coup: relief army delayed by 45s." },
  { id: "armory", name: "Armory", icon: "🛡️", col: 3, row: 3, span: 1, garrison: 4, color: "#2a2a30", desc: "Held in a coup: +15% rebel damage." },
];

export const ROOM_MAP = Object.fromEntries(ROOMS.map((r) => [r.id, r])) as Record<RoomId, RoomDef>;

export interface Rect { x: number; y: number; w: number; h: number; cx: number; cy: number }
const MX = 24, MY = 24, PAD = 12;
export const RECT = Object.fromEntries(
  ROOMS.map((r) => {
    const cw = (WORLD_W - MX * 2) / 4;
    const ch = (WORLD_H - MY * 2) / 4;
    const x = MX + r.col * cw + PAD;
    const y = MY + r.row * ch + PAD;
    const w = cw * r.span - PAD * 2;
    const h = ch - PAD * 2;
    return [r.id, { x, y, w, h, cx: x + w / 2, cy: y + h / 2 }];
  })
) as Record<RoomId, Rect>;

export const EDGES: [RoomId, RoomId][] = [
  ["library", "tower"], ["tower", "chamber"], ["chamber", "treasury"],
  ["chapel", "throne"], ["throne", "ballroom"], ["ballroom", "apothecary"],
  ["library", "chapel"], ["tower", "throne"], ["chamber", "ballroom"], ["treasury", "apothecary"],
  ["chapel", "kitchen"], ["throne", "courtyard"], ["ballroom", "courtyard"], ["apothecary", "dungeon"],
  ["kitchen", "courtyard"], ["courtyard", "dungeon"], ["kitchen", "barracks"], ["courtyard", "gate"],
  ["dungeon", "armory"], ["barracks", "gate"], ["gate", "armory"],
];

export const ADJ: Record<RoomId, RoomId[]> = (() => {
  const a = {} as Record<RoomId, RoomId[]>;
  ROOMS.forEach((r) => (a[r.id] = []));
  EDGES.forEach(([p, q]) => {
    a[p].push(q);
    a[q].push(p);
  });
  return a;
})();

/** Shortest path excluding `from`, including `to`. */
export function bfs(from: RoomId, to: RoomId): RoomId[] {
  if (from === to) return [];
  const prev = new Map<RoomId, RoomId | null>();
  prev.set(from, null);
  const q: RoomId[] = [from];
  while (q.length) {
    const cur = q.shift()!;
    if (cur === to) break;
    for (const n of ADJ[cur]) {
      if (!prev.has(n)) {
        prev.set(n, cur);
        q.push(n);
      }
    }
  }
  if (!prev.has(to)) return [];
  const path: RoomId[] = [];
  let c: RoomId | null = to;
  while (c && c !== from) {
    path.unshift(c);
    c = prev.get(c) ?? null;
  }
  return path;
}

export type Role =
  | "monarch" | "champion" | "captain" | "general" | "treasurer" | "priest"
  | "spymaster" | "physician" | "scribe" | "chef" | "assassin" | "courtier" | "servant";

export interface AbilityDef {
  name: string;
  room: RoomId | "any";
  gold: number;
  infl: number;
  cd: number; // seconds of game time
  loud: number; // evidence
  desc: string;
}

export interface RoleDef {
  id: Role;
  title: string;
  icon: string;
  color: string;
  followers: number;
  sched: RoomId[]; // morning, midday, afternoon, evening, night
  ability?: AbilityDef;
  blurb: string;
}

export const ROLES: Record<Role, RoleDef> = {
  monarch: { id: "monarch", title: "Monarch", icon: "👑", color: "#e3b95a", followers: 0, sched: ["chamber", "throne", "throne", "ballroom", "chamber"], blurb: "The sovereign. Cannot be recruited — only deposed." },
  champion: { id: "champion", title: "Royal Champion", icon: "🛡️", color: "#9aa7c7", followers: 6, sched: ["chamber", "throne", "throne", "ballroom", "chamber"], blurb: "Shadow of the Monarch. A fearsome last defender in a coup." },
  captain: {
    id: "captain", title: "Captain of the Guard", icon: "⚔️", color: "#c9604a", followers: 10, sched: ["barracks", "gate", "throne", "courtyard", "barracks"],
    blurb: "Commands the palace garrison.",
    ability: { name: "Rotate the Watch", room: "barracks", gold: 0, infl: 12, cd: 40, loud: 3, desc: "Thins garrisons in Barracks, Gate & Throne Room (stacks up to 3×)." },
  },
  general: {
    id: "general", title: "Marshal", icon: "🎖️", color: "#d08a3c", followers: 14, sched: ["armory", "barracks", "throne", "ballroom", "barracks"],
    blurb: "Leads the army. Your largest potential force.",
    ability: { name: "Muster Troops", room: "barracks", gold: 40, infl: 0, cd: 40, loud: 4, desc: "Adds 6 soldiers to the Marshal's coup force (up to 24)." },
  },
  treasurer: {
    id: "treasurer", title: "Lord Treasurer", icon: "🪙", color: "#d9c15a", followers: 3, sched: ["treasury", "throne", "treasury", "ballroom", "treasury"],
    blurb: "Keeper of the royal purse.",
    ability: { name: "Skim the Coffers", room: "treasury", gold: 0, infl: 0, cd: 36, loud: 7, desc: "+70 gold. Audits may notice the missing coin." },
  },
  priest: {
    id: "priest", title: "High Priest", icon: "📿", color: "#c9c9e8", followers: 3, sched: ["chapel", "throne", "chapel", "ballroom", "chapel"],
    blurb: "Voice of the gods and the common folk.",
    ability: { name: "Divine Mandate", room: "chapel", gold: 0, infl: 10, cd: 30, loud: 2, desc: "+12 Legitimacy: stronger rebels, wavering loyalists." },
  },
  spymaster: {
    id: "spymaster", title: "Master of Whispers", icon: "🕵️", color: "#8a6fb8", followers: 4, sched: ["tower", "courtyard", "dungeon", "ballroom", "tower"],
    blurb: "Hunts conspirators. Your greatest threat — or greatest prize.",
    ability: { name: "Bury the Reports", room: "tower", gold: 0, infl: 8, cd: 28, loud: 0, desc: "-22 Evidence and -20 exposure on every agent. The case files vanish." },
  },
  physician: {
    id: "physician", title: "Court Physician", icon: "🩺", color: "#6fb89a", followers: 2, sched: ["apothecary", "chamber", "apothecary", "kitchen", "chamber"],
    blurb: "Tends the Monarch's health.",
    ability: { name: "Slow Tincture", room: "chamber", gold: 20, infl: 0, cd: 36, loud: 4, desc: "-15 Monarch Vigor: a weaker Champion in the final stand." },
  },
  scribe: {
    id: "scribe", title: "Royal Archivist", icon: "📜", color: "#cdb98a", followers: 2, sched: ["library", "library", "throne", "library", "library"],
    blurb: "Keeper of records and a fine forger.",
    ability: { name: "Forge Letters", room: "library", gold: 25, infl: 0, cd: 24, loud: 2, desc: "+1 Forgery (max 3). Forgeries frame enemies." },
  },
  chef: {
    id: "chef", title: "Head Chef", icon: "👨‍🍳", color: "#d6a07a", followers: 2, sched: ["kitchen", "courtyard", "kitchen", "ballroom", "kitchen"],
    blurb: "Feeds the court — and hears everything.",
    ability: { name: "Feast Preparations", room: "kitchen", gold: 30, infl: 0, cd: 60, loud: 1, desc: "Summons a Royal Feast: the whole court gathers in the Ballroom." },
  },
  assassin: {
    id: "assassin", title: "Shadow Blade", icon: "🗡️", color: "#7a7a88", followers: 3, sched: ["gate", "courtyard", "library", "ballroom", "gate"],
    blurb: "A blade for hire. Enables the Silence action.",
  },
  courtier: {
    id: "courtier", title: "Courtier", icon: "🎭", color: "#c77aa8", followers: 2, sched: ["ballroom", "throne", "courtyard", "ballroom", "ballroom"],
    blurb: "Gossip-prone socialite.",
    ability: { name: "Host a Salon", room: "ballroom", gold: 20, infl: 0, cd: 24, loud: 2, desc: "+22 Influence and warms the guests to your cause." },
  },
  servant: {
    id: "servant", title: "Chamberlain", icon: "🔔", color: "#a8a08a", followers: 1, sched: ["kitchen", "chamber", "ballroom", "courtyard", "kitchen"],
    blurb: "Unseen, ever-present eyes and ears.",
    ability: { name: "Gather Gossip", room: "any", gold: 0, infl: 5, cd: 20, loud: 1, desc: "Learn the stats and secret of a random unknown courtier." },
  },
};

export type Trait = "greedy" | "ambitious" | "honorable" | "coward" | "pious" | "vain" | "ruthless";
export const TRAITS: Record<Trait, { name: string; desc: string; icon: string }> = {
  greedy: { name: "Greedy", icon: "🪙", desc: "Bribes work wonders on them." },
  ambitious: { name: "Ambitious", icon: "🔥", desc: "Hungry for power — easier to recruit." },
  honorable: { name: "Honorable", icon: "⚖️", desc: "Hard to recruit; may refuse bribes." },
  coward: { name: "Coward", icon: "🐇", desc: "Easily blackmailed, but fields fewer troops." },
  pious: { name: "Pious", icon: "🙏", desc: "Legitimacy sways them." },
  vain: { name: "Vain", icon: "🪞", desc: "A gossip: rumors spread through them fast." },
  ruthless: { name: "Ruthless", icon: "🐍", desc: "Reports suspicious acts eagerly." },
};
export const TRAIT_LIST = Object.keys(TRAITS) as Trait[];

export const SECRETS = [
  { id: "debts", name: "Crippling gambling debts" },
  { id: "lover", name: "A forbidden lover" },
  { id: "embezzle", name: "Embezzled royal funds" },
  { id: "heresy", name: "Secret heresy" },
  { id: "spy", name: "Paid by a foreign crown" },
  { id: "bastard", name: "A hidden illegitimate heir" },
];

export const FIRST_NAMES = ["Aldous", "Beatrix", "Cassian", "Delphine", "Evander", "Fenella", "Gideon", "Helene", "Isaura", "Jorin", "Kestrel", "Lucan", "Mirabel", "Nikolai", "Orsolya", "Percival", "Quinta", "Rowan", "Seraphine", "Tobias", "Ulric", "Valeria", "Wystan", "Xanthe", "Yorick", "Zephyra", "Corvin", "Marguerite", "Dorian", "Odalys"];
export const LAST_NAMES = ["Voss", "Ashgrove", "Blackwood", "Crane", "Duskmere", "Evermoor", "Falconer", "Greywater", "Holloway", "Ironside", "Kingsley", "Lorne", "Marchetti", "Nightingale", "Orlov", "Pellham", "Ravenscar", "Stroud", "Thorne", "Valmont", "Whitlock", "Yarrow"];

export interface PerkDef {
  id: string;
  branch: "tongue" | "shadow" | "steel";
  name: string;
  icon: string;
  desc: string; // per level
  costs: number[];
}

export const PERKS: PerkDef[] = [
  { id: "silver", branch: "tongue", name: "Silver Tongue", icon: "🗣️", desc: "+6% to recruit & blackmail odds per level.", costs: [3, 5, 8] },
  { id: "pockets", branch: "tongue", name: "Deep Pockets", icon: "👛", desc: "+45 starting gold per level.", costs: [3, 5, 8] },
  { id: "gossip", branch: "tongue", name: "Patron of Gossip", icon: "💬", desc: "+18% Influence regeneration per level.", costs: [4, 6, 9] },
  { id: "velvet", branch: "shadow", name: "Velvet Gloves", icon: "🧤", desc: "-12% Evidence from all sources per level.", costs: [3, 5, 8] },
  { id: "passages", branch: "shadow", name: "Hidden Passages", icon: "🚪", desc: "+25% conspirator movement speed per level.", costs: [3, 5, 8] },
  { id: "eyes", branch: "shadow", name: "Keen Eye", icon: "👁️", desc: "Start with 3 more courtiers fully investigated per level.", costs: [4, 6, 9] },
  { id: "cadre", branch: "steel", name: "Veteran Cadre", icon: "🪖", desc: "+2 followers in every conspirator's squad per level.", costs: [4, 6, 9] },
  { id: "rally", branch: "steel", name: "Rallying Cry", icon: "📯", desc: "+8% rebel damage in the coup per level.", costs: [4, 6, 9] },
  { id: "retainer", branch: "steel", name: "Loyal Retainers", icon: "🤝", desc: "Begin with one more sworn conspirator per level.", costs: [5, 8, 11] },
  { id: "night", branch: "steel", name: "Longer Night", icon: "🌙", desc: "+20s before the relief army arrives per level.", costs: [4, 6, 9] },
];
export const BRANCHES: Record<string, { name: string; color: string; blurb: string }> = {
  tongue: { name: "The Silver Tongue", color: "#e3b95a", blurb: "Persuasion, coin and whispers." },
  shadow: { name: "The Veiled Hand", color: "#8a6fb8", blurb: "Stealth, intel and mobility." },
  steel: { name: "The Iron Oath", color: "#c9604a", blurb: "Strength for the final night." },
};

export type EventId =
  | "feast" | "inspection" | "riot" | "plague" | "audit" | "attempt" | "crackdown"
  | "envoy" | "informant" | "tea" | "letter";

export interface ScenarioDef {
  id: string;
  index: number;
  name: string;
  court: string;
  monarchName: string;
  blurb: string;
  objective: string;
  days: number;
  garrisonMul: number;
  evMul: number;
  unrest: number;
  paranoia: number;
  legit: number;
  baseCrown: number;
  startGold: number;
  champHp: number;
  champPower: number;
  reserve: number;
  eventRate: number;
  boss: boolean;
  spySkill: number;
  tutorial: boolean;
  accent: string;
  icon: string;
  eventWeights: Partial<Record<EventId, number>>;
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: "ashes", index: 0, name: "The Tarnished Crown", court: "Court of Ashes", monarchName: "King Aldric the Weary", icon: "🕯️", accent: "#c9a25a",
    blurb: "An aging king, a sleepy court, and a loyal-but-tired guard. The perfect place to learn the art of treason.",
    objective: "Depose King Aldric before his heir is crowned.",
    days: 9, garrisonMul: 0.8, evMul: 0.8, unrest: 8, paranoia: 15, legit: 10, baseCrown: 52, startGold: 130, champHp: 12, champPower: 9, reserve: 10, eventRate: 0.8, boss: false, spySkill: 0.8, tutorial: true,
    eventWeights: { feast: 3, inspection: 1, riot: 1, audit: 1, envoy: 2, informant: 3, letter: 2, tea: 1 },
  },
  {
    id: "gilded", index: 1, name: "The Gilded Cage", court: "Court of Gold", monarchName: "Queen Isolde the Radiant", icon: "🪞", accent: "#e3b95a",
    blurb: "Wealth buys loyalty here — and everyone has a price. Feasts are constant, and so are witnesses.",
    objective: "Unseat Queen Isolde amid the glittering gossip.",
    days: 10, garrisonMul: 1.0, evMul: 1.0, unrest: 10, paranoia: 25, legit: 8, baseCrown: 58, startGold: 160, champHp: 15, champPower: 11, reserve: 14, eventRate: 1.0, boss: false, spySkill: 1.0, tutorial: false,
    eventWeights: { feast: 5, inspection: 1, riot: 1, audit: 3, envoy: 2, informant: 2, tea: 2, attempt: 1, letter: 1 },
  },
  {
    id: "whispers", index: 2, name: "The Whispering Halls", court: "Court of Whispers", monarchName: "Regent Varek the Watchful", icon: "👁️", accent: "#8a6fb8",
    blurb: "A suspicious regent with an extraordinary spy network. Every corridor has ears.",
    objective: "Silence the Master of Whispers and topple Regent Varek.",
    days: 10, garrisonMul: 1.05, evMul: 1.35, unrest: 12, paranoia: 40, legit: 8, baseCrown: 60, startGold: 150, champHp: 16, champPower: 12, reserve: 15, eventRate: 1.1, boss: false, spySkill: 1.35, tutorial: false,
    eventWeights: { inspection: 3, crackdown: 3, tea: 3, informant: 2, audit: 1, attempt: 2, letter: 2, feast: 2 },
  },
  {
    id: "iron", index: 3, name: "The Winter of Iron", court: "Court of Frost", monarchName: "Emperor Dorian Ironbrow", icon: "❄️", accent: "#7aa7c9",
    blurb: "Famine grips the realm and the Emperor answers with iron. Large garrisons, restless streets.",
    objective: "Break the Emperor's garrison while the people starve.",
    days: 11, garrisonMul: 1.3, evMul: 1.1, unrest: 28, paranoia: 45, legit: 6, baseCrown: 62, startGold: 140, champHp: 20, champPower: 14, reserve: 20, eventRate: 1.2, boss: false, spySkill: 1.1, tutorial: false,
    eventWeights: { riot: 4, plague: 3, inspection: 2, attempt: 1, audit: 2, crackdown: 2, envoy: 2, informant: 2, feast: 1 },
  },
  {
    id: "eternal", index: 4, name: "The Eternal Regent", court: "Court of Eternity", monarchName: "Regent Malachar the Undying", icon: "💀", accent: "#b3263e",
    blurb: "Malachar has ruled for three hundred years, guarded by the Hollow Knight, a champion who does not fall easily. The capstone of your conspiracy.",
    objective: "End the Undying Regent's reign. Defeat the Hollow Knight, boss of the final stand.",
    days: 12, garrisonMul: 1.4, evMul: 1.3, unrest: 20, paranoia: 55, legit: 5, baseCrown: 66, startGold: 150, champHp: 32, champPower: 17, reserve: 24, eventRate: 1.3, boss: true, spySkill: 1.4, tutorial: false,
    eventWeights: { attempt: 2, crackdown: 3, inspection: 2, riot: 2, plague: 2, tea: 2, audit: 2, envoy: 1, informant: 2, letter: 2, feast: 2 },
  },
];

export interface DifficultyDef {
  id: string; name: string; desc: string; ev: number; gold: number; garrison: number; recruit: number; loyal: number; mult: number;
}
export const DIFFICULTIES: DifficultyDef[] = [
  { id: "courtier", name: "Courtier", desc: "Gentle suspicion, fatter purse, thinner guards.", ev: 0.7, gold: 1.4, garrison: 0.8, recruit: 0.1, loyal: 0.9, mult: 0.7 },
  { id: "schemer", name: "Schemer", desc: "The intended intrigue.", ev: 1, gold: 1, garrison: 1, recruit: 0, loyal: 1, mult: 1 },
  { id: "machiavelli", name: "Machiavelli", desc: "Paranoid spies, lean coffers, hardened guards.", ev: 1.4, gold: 0.75, garrison: 1.2, recruit: -0.08, loyal: 1.15, mult: 1.6 },
];

export interface ModDef { id: string; name: string; icon: string; desc: string; bonus: number }
export const MODS: ModDef[] = [
  { id: "paranoid", name: "Paranoid Monarch", icon: "😨", desc: "Paranoia starts +20 and rises faster.", bonus: 0.25 },
  { id: "purse", name: "Empty Purse", icon: "🕳️", desc: "Start with no gold; lower gold income.", bonus: 0.2 },
  { id: "iron", name: "Iron Guard", icon: "🪖", desc: "Garrisons are 30% larger.", bonus: 0.25 },
  { id: "fuse", name: "Short Fuse", icon: "🧨", desc: "Two fewer days until the succession.", bonus: 0.2 },
  { id: "loose", name: "Loose Lips", icon: "👄", desc: "Witnesses report acts more readily.", bonus: 0.15 },
];

export const ROLE_ORDER: Role[] = ["monarch", "champion", "captain", "general", "treasurer", "priest", "spymaster", "physician", "scribe", "chef", "assassin", "courtier", "courtier", "courtier", "servant", "servant"];
