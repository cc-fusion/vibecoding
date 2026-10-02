export type DType =
  | "market" | "temple" | "nobles" | "apothecary" | "slums"
  | "university" | "barracks" | "docks" | "farms";

export interface DTypeInfo {
  label: string; icon: string; pop: number; density: number; income: number;
  food: number; med: number; research: number; mobility: number; calm: number;
  desc: string; names: string[];
}

export const DTYPES: Record<DType, DTypeInfo> = {
  market: { label: "Market Ward", icon: "🏪", pop: 1.2, density: 1.25, income: 1.4, food: 2, med: 0, research: 0, mobility: 1.4, calm: 0,
    desc: "Crowded trade hub. Strong income and many road links.", names: ["Copperstall Market", "Gilder's Square", "Tallow Market", "Bellwether Mart", "Saffron Cross"] },
  temple: { label: "Temple Quarter", icon: "⛪", pop: 0.8, density: 1.0, income: 0.3, food: 0, med: 0, research: 0, mobility: 1.0, calm: 1,
    desc: "Faithful soothe panic in themselves and their neighbours.", names: ["St. Ember's Close", "Vesper Cloister", "Hallowgate", "Lantern Abbey"] },
  nobles: { label: "Noble Hill", icon: "🏰", pop: 0.6, density: 0.7, income: 2.2, food: 0, med: 0, research: 0.3, mobility: 0.9, calm: 0,
    desc: "Wealthy, sparse, and quick to flee or demand favours.", names: ["Silkmoor Hill", "Duke's Rise", "Ivory Terrace", "Marchwood Heights"] },
  apothecary: { label: "Apothecary Row", icon: "⚗️", pop: 0.8, density: 1.0, income: 0.8, food: 0, med: 3.5, research: 0.5, mobility: 1.0, calm: 0,
    desc: "Brews the medicine your hospitals burn through.", names: ["Wormwood Row", "Alembic Lane", "Mandrake Walk", "Cinder & Sage"] },
  slums: { label: "The Warrens", icon: "🏚️", pop: 1.6, density: 1.6, income: 0.35, food: 0, med: 0, research: 0, mobility: 1.1, calm: 0,
    desc: "Packed lodgings. Plague spreads terribly here.", names: ["Ashgate Warrens", "Cinder Row", "Rat's Alley", "Gutterfield", "Pitch Court", "Mudlark Hollow"] },
  university: { label: "Scholars' College", icon: "📜", pop: 0.7, density: 1.0, income: 0.6, food: 0, med: 0, research: 4, mobility: 1.0, calm: 0,
    desc: "Source of research points toward a cure.", names: ["Collegium Vael", "Orrery Hall", "Quillmere College", "Athenaeum Row"] },
  barracks: { label: "Garrison", icon: "🛡️", pop: 0.7, density: 1.1, income: 0.5, food: 0, med: 0, research: 0, mobility: 0.9, calm: 0,
    desc: "Disciplined guards keep nearby quarantines obeyed.", names: ["Iron Keep", "Watchfire Barracks", "Halberd Yard", "Sentinel Post"] },
  docks: { label: "Harbour Docks", icon: "⚓", pop: 1.0, density: 1.2, income: 1.3, food: 4, med: 0.8, research: 0, mobility: 1.5, calm: 0,
    desc: "Imports food and herbs, but plague arrives by ship.", names: ["Saltmarket Docks", "Blackwater Quay", "Gull's Wharf", "Tidewrack Piers"] },
  farms: { label: "Farm Hamlet", icon: "🌾", pop: 0.9, density: 0.6, income: 0.4, food: 9, med: 0, research: 0, mobility: 0.8, calm: 0,
    desc: "Feeds the city. Seal it and the granaries run dry.", names: ["Barleycross", "Thistle Farm", "Millbrook", "Hollow Acre", "Greywheat"] },
};

export const TYPE_ORDER: DType[] = [
  "market", "temple", "nobles", "apothecary", "slums", "university", "slums", "barracks",
  "docks", "farms", "market", "farms", "slums", "apothecary", "temple", "docks", "slums", "university", "farms",
];

export type Branch = "Surveillance" | "Medicine" | "Society" | "Cure";
export interface Tech { id: string; name: string; icon: string; branch: Branch; cost: number; req: string[]; desc: string; }

export const TECHS: Tech[] = [
  { id: "logs", name: "Plague Ledgers", icon: "📒", branch: "Surveillance", cost: 10, req: [], desc: "Parish records speed up case detection by 50%." },
  { id: "registry", name: "Contact Registry", icon: "🕸️", branch: "Surveillance", cost: 16, req: ["logs"], desc: "+1 tracer team. Traces last longer and isolate contacts better." },
  { id: "assays", name: "Rapid Assays", icon: "🧪", branch: "Surveillance", cost: 22, req: ["logs"], desc: "Case detection x1.8 and far more accurate estimates." },
  { id: "serology", name: "Serology", icon: "🩸", branch: "Cure", cost: 32, req: ["assays"], desc: "Reveals incubating carriers in reports. Opens the cure path." },
  { id: "masks", name: "Beaked Masks", icon: "🐦", branch: "Medicine", cost: 10, req: [], desc: "Unlocks the Mask Edict policy (-25% transmission)." },
  { id: "poultice", name: "Herbal Poultices", icon: "🌿", branch: "Medicine", cost: 12, req: [], desc: "Hospital death rate -25%, medicine use -20%." },
  { id: "gardens", name: "Apothecary Gardens", icon: "🪴", branch: "Medicine", cost: 16, req: ["poultice"], desc: "Medicine production +60%." },
  { id: "pesthouse", name: "Pest Houses", icon: "🏥", branch: "Medicine", cost: 18, req: ["poultice"], desc: "Hospital beds +30%, hospital cost -25%." },
  { id: "wards", name: "Aerated Wards", icon: "💨", branch: "Medicine", cost: 26, req: ["pesthouse"], desc: "Patients barely infect others; faster admissions; deaths -15%." },
  { id: "sewers", name: "Sewer Reform", icon: "🚰", branch: "Society", cost: 16, req: [], desc: "Bodies decay faster; Warrens are less dense." },
  { id: "pulpit", name: "Public Pulpit", icon: "🗣️", branch: "Society", cost: 14, req: [], desc: "Public Address +50% stronger; rumours fade twice as fast." },
  { id: "protocols", name: "Quarantine Protocols", icon: "🚧", branch: "Society", cost: 20, req: ["masks"], desc: "Sealed districts leak 40% less and drain 40% less trust." },
  { id: "watch", name: "Vigilant Watch", icon: "🔔", branch: "Society", cost: 22, req: ["protocols"], desc: "+15% compliance everywhere." },
  { id: "culture", name: "Attenuated Cultures", icon: "🧫", branch: "Cure", cost: 30, req: ["serology"], desc: "Weakened plague cultures. Required for the cure." },
  { id: "prototype", name: "Cure Prototype", icon: "💉", branch: "Cure", cost: 50, req: ["culture"], desc: "Unlocks Administer Cure (50% effective)." },
  { id: "adaptive", name: "Adaptive Serum", icon: "✨", branch: "Cure", cost: 70, req: ["prototype"], desc: "Cure 90% effective. Resists the Crimson Mutation." },
];

export interface Perk { id: string; name: string; icon: string; desc: string; max: number; }
export const PERKS: Perk[] = [
  { id: "purse", name: "Seasoned Purse", icon: "💰", desc: "+120 starting funds per level.", max: 3 },
  { id: "guild", name: "Guild Connections", icon: "📦", desc: "+25 medicine and +20 food at start per level.", max: 3 },
  { id: "scholar", name: "Scholar's Legacy", icon: "🎓", desc: "+12% research speed per level.", max: 3 },
  { id: "tracers", name: "Veteran Tracers", icon: "🔍", desc: "+1 tracer team per level.", max: 2 },
  { id: "faith", name: "Trusted Physician", icon: "🕊️", desc: "+8 starting trust per level.", max: 3 },
  { id: "charter", name: "Hospital Charter", icon: "📜", desc: "-10% hospital cost per level.", max: 3 },
  { id: "whisper", name: "Crowd Whisperer", icon: "📣", desc: "+25% Public Address potency per level.", max: 3 },
  { id: "watchp", name: "Hardened Watch", icon: "⚔️", desc: "Sealed districts leak and drain 12% less per level.", max: 2 },
];
export const perkCost = (lvl: number) => 15 * (lvl + 1);

export interface CityDef { id: string; name: string; blurb: string; seed: number; count: number; popScale: number; seeds: number; tutorial?: boolean; }
export const CITIES: CityDef[] = [
  { id: "vellmoor", name: "Vellmoor", blurb: "A small market town. The perfect place to learn the trade.", seed: 11, count: 8, popScale: 0.9, seeds: 1, tutorial: true },
  { id: "alder", name: "Port Alder", blurb: "A harbour city. Ships bring grain, herbs... and rats.", seed: 23, count: 12, popScale: 1.0, seeds: 1 },
  { id: "hollow", name: "Black Hollow", blurb: "Dense, hungry, and already whispering. Two outbreaks at once.", seed: 37, count: 15, popScale: 1.1, seeds: 2 },
  { id: "aurelion", name: "Aurelion", blurb: "The grand capital. Nineteen wards, three outbreaks of rumour, one chance.", seed: 51, count: 19, popScale: 1.15, seeds: 2 },
];

export interface Difficulty { id: string; name: string; desc: string; r0: number; mort: number; res: number; bossDay: number; mult: number; color: string; }
export const DIFFS: Difficulty[] = [
  { id: "apprentice", name: "Apprentice", desc: "Slower plague, generous coffers, late mutation.", r0: 0.82, mort: 0.75, res: 1.4, bossDay: 42, mult: 0.7, color: "#8fcf74" },
  { id: "physician", name: "Physician", desc: "The intended struggle.", r0: 1.0, mort: 1.0, res: 1.0, bossDay: 36, mult: 1.0, color: "#e0a53f" },
  { id: "master", name: "Plague Master", desc: "Faster spread, scarcer supplies.", r0: 1.2, mort: 1.15, res: 0.82, bossDay: 32, mult: 1.5, color: "#d8742f" },
  { id: "blackdeath", name: "Black Death", desc: "Merciless. The mutation comes early.", r0: 1.4, mort: 1.3, res: 0.68, bossDay: 28, mult: 2.2, color: "#d8452f" },
];

export interface Modifier { id: string; name: string; icon: string; desc: string; mult: number; }
export const MODS: Modifier[] = [
  { id: "fog", name: "Thick Fog", icon: "🌫️", desc: "Cases are detected far more slowly.", mult: 0.25 },
  { id: "rumor", name: "Rumour Mill", icon: "🗯️", desc: "More rumours; panic spreads faster between districts.", mult: 0.2 },
  { id: "scarcity", name: "Lean Harvest", icon: "🥀", desc: "Food and medicine production -30%.", mult: 0.25 },
  { id: "mutating", name: "Restless Strain", icon: "🧬", desc: "The plague drifts every ~10 days; the Crimson Mutation comes 4 days sooner.", mult: 0.3 },
  { id: "poor", name: "Iron Treasury", icon: "🪙", desc: "Start with half the funds.", mult: 0.2 },
];

export interface Strain { name: string; r: number; mort: number; incub: number; escape: number; color: string; }
export const STRAINS: Strain[] = [
  { name: "Black Cough", r: 1.0, mort: 1.0, incub: 3, escape: 0, color: "#8fcf74" },
  { name: "Pneumonic Shift", r: 1.2, mort: 1.1, incub: 2.5, escape: 0.1, color: "#e0a53f" },
  { name: "Crimson Mutation", r: 1.45, mort: 1.5, incub: 2, escape: 0.4, color: "#ff3b2a" },
];

export const DEATH_LIMIT = 0.45; // lose if more than 45% of the city dies

export interface PolicyDef { id: string; name: string; icon: string; desc: string; upkeep: number; req?: string; }
export const POLICIES: PolicyDef[] = [
  { id: "masks", name: "Mask Edict", icon: "🐦", desc: "Everyone wears beaked masks. -25% transmission.", upkeep: 3, req: "masks" },
  { id: "curfew", name: "Curfew & Market Closure", icon: "🌙", desc: "-18% local spread. Income -35%, trust slowly erodes.", upkeep: 0 },
  { id: "carts", name: "Corpse Carts", icon: "🛒", desc: "Crews haul bodies away (45%/day). Bodies spread plague and panic.", upkeep: 4 },
  { id: "rations", name: "Rationing", icon: "🍞", desc: "Food use -28%. Panic and trust suffer a little.", upkeep: 0 },
];

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
