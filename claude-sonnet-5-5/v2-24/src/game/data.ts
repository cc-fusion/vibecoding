export const W = 36;
export const H = 24;
export const N = W * H;
export const TICK = 0.2; // seconds of sim time per tick
export const SEASON_TICKS = 100;
export const YEAR_TICKS = SEASON_TICKS * 4;

export type Kind =
  | 'none' | 'canal' | 'bridge' | 'tunnel' | 'reservoir' | 'sluice' | 'spillway' | 'pump'
  | 'drain' | 'house' | 'farm' | 'fountain' | 'bath' | 'mill' | 'treatment' | 'well' | 'grand' | 'rubble';

export type ToolId =
  | 'select' | 'canal' | 'bridge' | 'drain' | 'house' | 'farm' | 'well' | 'pump' | 'reservoir'
  | 'sluice' | 'spillway' | 'fountain' | 'bath' | 'mill' | 'treatment' | 'grand' | 'demolish';

export interface ToolDef {
  id: ToolId; name: string; icon: string; cost: number; key: string; tech?: string; group: string; desc: string;
}

export const TOOLS: ToolDef[] = [
  { id: 'select', name: 'Inspect', icon: '👆', cost: 0, key: 'Q', group: 'Tools', desc: 'Inspect tiles. Click a sluice to open/close it, a pump to rotate it, a cracked aqueduct or rubble to repair it.' },
  { id: 'canal', name: 'Canal', icon: '〰️', cost: 3, key: '1', group: 'Water', desc: 'Open channel laid on the ground. Its bed height equals the terrain. Water only runs downhill (or level). Drag to paint.' },
  { id: 'bridge', name: 'Aqueduct / Tunnel', icon: '🌉', cost: 14, key: '2', group: 'Water', desc: 'Keeps the water level of the adjoining conduit: an aqueduct over valleys (bed above ground) or a tunnel through hills (bed below ground). Up to 4 levels.' },
  { id: 'pump', name: 'Screw Pump', icon: '⚙️', cost: 60, key: '7', tech: 'screw', group: 'Water', desc: 'Lifts water from the conduit behind it into the conduit in front (R to rotate). Needs coin upkeep. Lift 3 levels.' },
  { id: 'reservoir', name: 'Reservoir', icon: '🛢️', cost: 60, key: '8', tech: 'reservoirs', group: 'Water', desc: 'Stores 40 units of water. Buffers droughts and absorbs storm water.' },
  { id: 'sluice', name: 'Sluice Gate', icon: '🚪', cost: 15, key: '9', tech: 'sluices', group: 'Water', desc: 'A canal tile you can open or close with a click. Divert water or isolate a section.' },
  { id: 'spillway', name: 'Spillway', icon: '🌊', cost: 25, key: '0', tech: 'spillways', group: 'Water', desc: 'Discards 2.5 water per tick. Protects against floods — but wastes water. Pair with a sluice!' },
  { id: 'well', name: 'Well', icon: '🪣', cost: 35, key: '6', group: 'Water', desc: 'Taps groundwater on low ground (height 1-3). Trickles water into adjacent conduits. Max 6. Pollution weakens it.' },
  { id: 'drain', name: 'Drain', icon: '🕳️', cost: 2, key: '3', group: 'Sanitation', desc: 'Sewer channel. Houses within 1 tile dump waste into it. Flows downhill to the sea (pollution!) or a treatment plant.' },
  { id: 'treatment', name: 'Treatment Plant', icon: '♻️', cost: 90, key: 'N', tech: 'sanitation', group: 'Sanitation', desc: 'Cleans 3 waste per tick from adjacent drains. Sells reclaimed water and fertilizes farms within 4 tiles.' },
  { id: 'house', name: 'Insula (Houses)', icon: '🏠', cost: 25, key: '4', group: 'City', desc: 'Citizens pay taxes and generate Knowledge. Draws water from conduits within 1 tile. Grows with fountains and baths nearby.' },
  { id: 'farm', name: 'Farm', icon: '🌾', cost: 30, key: '5', group: 'City', desc: 'Irrigated by conduits within 2 tiles. Harvests coin when the crop ripens. Hates floods and pollution.' },
  { id: 'fountain', name: 'Fountain', icon: '⛲', cost: 45, key: 'F', tech: 'fountains', group: 'City', desc: 'Public fountain: +happiness and enables bigger houses within 5 tiles. Drinks 0.25 water per tick.' },
  { id: 'bath', name: 'Bathhouse', icon: '🛁', cost: 70, key: 'B', tech: 'baths', group: 'City', desc: 'Heals disease and lifts happiness within 6 tiles. Needed for the largest villas.' },
  { id: 'mill', name: 'Water Mill', icon: '🎡', cost: 55, key: 'M', tech: 'mills', group: 'City', desc: 'Grinds grain for steady coin. Thirsty (0.7/tick) and noisy: lowers happiness within 3 tiles.' },
  { id: 'grand', name: 'Imperial Fountain', icon: '🏛️', cost: 400, key: 'G', tech: 'imperial', group: 'City', desc: 'Capstone wonder. +15 happiness citywide, +25% taxes and Knowledge. One per city.' },
  { id: 'demolish', name: 'Demolish', icon: '🔨', cost: 0, key: 'X', group: 'Tools', desc: 'Remove a structure and refund half its price. Drag to sweep.' },
];

export const TOOL_BY_ID: Record<string, ToolDef> = Object.fromEntries(TOOLS.map(t => [t.id, t]));

export interface TechDef { id: string; name: string; icon: string; cost: number; req: string[]; desc: string }
export const TECHS: TechDef[] = [
  { id: 'lined', name: 'Lined Canals', icon: '🧱', cost: 12, req: [], desc: 'Canal capacity +25% and evaporation halved.' },
  { id: 'sluices', name: 'Sluice Gates', icon: '🚪', cost: 10, req: [], desc: 'Unlocks Sluice Gates.' },
  { id: 'reservoirs', name: 'Cisterns', icon: '🛢️', cost: 14, req: [], desc: 'Unlocks Reservoirs.' },
  { id: 'screw', name: 'Archimedean Screw', icon: '⚙️', cost: 18, req: [], desc: 'Unlocks Screw Pumps (lift 3).' },
  { id: 'fountains', name: 'Public Fountains', icon: '⛲', cost: 14, req: [], desc: 'Unlocks Fountains.' },
  { id: 'sanitation', name: 'Sanitation Works', icon: '♻️', cost: 22, req: [], desc: 'Unlocks Treatment Plants.' },
  { id: 'rotation', name: 'Crop Rotation', icon: '🌱', cost: 18, req: [], desc: 'Farms grow 30% faster.' },
  { id: 'spillways', name: 'Spillways', icon: '🌊', cost: 16, req: ['sluices'], desc: 'Unlocks Spillways.' },
  { id: 'mills', name: 'Water Wheels', icon: '🎡', cost: 20, req: ['lined'], desc: 'Unlocks Water Mills.' },
  { id: 'pistons', name: 'Pressure Pistons', icon: '🔩', cost: 26, req: ['screw'], desc: 'Pumps lift 5 levels instead of 3.' },
  { id: 'baths', name: 'Thermae', icon: '🛁', cost: 24, req: ['fountains'], desc: 'Unlocks Bathhouses; disease recovers faster.' },
  { id: 'concrete', name: 'Roman Concrete', icon: '🏗️', cost: 28, req: ['lined'], desc: 'Aqueducts & tunnels cost 30% less and resist quakes.' },
  { id: 'wardens', name: 'Flood Wardens', icon: '🛡️', cost: 24, req: ['spillways'], desc: 'Floods recede twice as fast.' },
  { id: 'repair', name: 'Repair Guild', icon: '🧰', cost: 30, req: ['concrete'], desc: 'Crews auto-repair cracks and clear rubble for a small fee.' },
  { id: 'dowsing', name: 'Dowsing Rods', icon: '🔮', cost: 30, req: [], desc: 'Springs +20%; springs never fail.' },
  { id: 'imperial', name: 'Imperial Waterworks', icon: '🏛️', cost: 60, req: ['baths', 'concrete'], desc: 'Capstone: unlocks the Imperial Fountain.' },
];
export const TECH_BY_ID: Record<string, TechDef> = Object.fromEntries(TECHS.map(t => [t.id, t]));

export type EventKind = 'storm' | 'drought' | 'quake' | 'slide' | 'plague' | 'springfail' | 'surge';

export const EVENT_INFO: Record<EventKind, { name: string; icon: string; blurb: string }> = {
  storm: { name: 'Torrential Storm', icon: '⛈️', blurb: 'Rain floods every open channel. Open spillways, close sluices, empty reservoirs.' },
  drought: { name: 'Drought', icon: '☀️', blurb: 'Springs dwindle and evaporation soars. Stored water is life.' },
  quake: { name: 'Earthquake', icon: '🌋', blurb: 'Aqueducts crack and leak until repaired.' },
  slide: { name: 'Landslide', icon: '🪨', blurb: 'A hillside collapses onto a channel.' },
  plague: { name: 'Plague Outbreak', icon: '☣️', blurb: 'Disease erupts in the dirtiest districts and spreads by contact.' },
  springfail: { name: 'Spring Failing', icon: '🕳️', blurb: 'A spring sputters and loses flow for a while.' },
  surge: { name: 'Sea Surge', icon: '🌊', blurb: 'Storm tides flood the coastal lowlands.' },
};

export interface BossPhase { at: number; kind: EventKind; power: number; dur: number }
export interface Scenario {
  id: string; name: string; blurb: string; seed: number; terrain: 'valley' | 'mesa' | 'delta' | 'capital';
  springs: number; years: number; goalPop: number; goalHappy: number; startCoins: number;
  hazards: EventKind[]; bossName: string; bossDesc: string; boss: BossPhase[]; icon: string; legacyReward: number;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'valley', name: 'Verdant Valley', icon: '🌄', seed: 1187, terrain: 'valley', springs: 3, years: 4,
    goalPop: 50, goalHappy: 55, startCoins: 520, legacyReward: 10,
    blurb: 'A gentle slope from alpine springs to the sea. Learn how water, waste and weather interlock.',
    hazards: ['storm', 'slide', 'plague'],
    bossName: 'The Spring Thaw Surge', bossDesc: 'Snowmelt and double storms hammer the valley.',
    boss: [{ at: 0, kind: 'storm', power: 1.5, dur: 110 }, { at: 140, kind: 'storm', power: 1.9, dur: 100 }],
  },
  {
    id: 'mesa', name: 'Dry Mesa', icon: '🏜️', seed: 4242, terrain: 'mesa', springs: 3, years: 5,
    goalPop: 80, goalHappy: 55, startCoins: 480, legacyReward: 16,
    blurb: 'Terraced cliffs and scarce springs. Tunnels, pumps and reservoirs decide who drinks.',
    hazards: ['drought', 'springfail', 'quake', 'slide', 'plague'],
    bossName: 'The Great Drought', bossDesc: 'Two seasons of scorched sky, capped by a tremor.',
    boss: [{ at: 0, kind: 'drought', power: 1.9, dur: 260 }, { at: 150, kind: 'quake', power: 1.8, dur: 1 }],
  },
  {
    id: 'delta', name: 'Saltmarsh Delta', icon: '🦆', seed: 777, terrain: 'delta', springs: 3, years: 5,
    goalPop: 110, goalHappy: 58, startCoins: 520, legacyReward: 22,
    blurb: 'Flat, fertile, and one storm from disaster. Keep waste moving and the sea out.',
    hazards: ['storm', 'surge', 'plague', 'springfail'],
    bossName: 'The Delta Deluge', bossDesc: 'A sea surge rides in under the heaviest storm in memory.',
    boss: [{ at: 0, kind: 'surge', power: 1.8, dur: 170 }, { at: 40, kind: 'storm', power: 2.0, dur: 120 }, { at: 200, kind: 'plague', power: 1.5, dur: 1 }],
  },
  {
    id: 'capital', name: 'Imperial Capital', icon: '🏛️', seed: 90210, terrain: 'capital', springs: 5, years: 6,
    goalPop: 170, goalHappy: 60, startCoins: 600, legacyReward: 32,
    blurb: 'Mountains ring a vast basin by the sea. Raise a city worthy of an empire — and survive the Century Storm.',
    hazards: ['storm', 'drought', 'quake', 'slide', 'plague', 'springfail', 'surge'],
    bossName: 'The Century Storm', bossDesc: 'Quakes, a monsoon, a surging sea, and the plague that follows.',
    boss: [
      { at: 0, kind: 'quake', power: 2.0, dur: 1 },
      { at: 30, kind: 'storm', power: 2.2, dur: 150 },
      { at: 70, kind: 'surge', power: 2.0, dur: 140 },
      { at: 190, kind: 'slide', power: 2.0, dur: 1 },
      { at: 230, kind: 'plague', power: 2.0, dur: 1 },
    ],
  },
];

export interface Difficulty { id: string; name: string; desc: string; cost: number; income: number; hazard: number; spring: number; legacy: number }
export const DIFFS: Difficulty[] = [
  { id: 'pilgrim', name: 'Pilgrim', desc: 'Cheaper builds, richer taxes, gentler omens.', cost: 0.8, income: 1.25, hazard: 0.6, spring: 1.15, legacy: 0.7 },
  { id: 'engineer', name: 'Engineer', desc: 'The intended challenge.', cost: 1, income: 1, hazard: 1, spring: 1, legacy: 1 },
  { id: 'architect', name: 'Architect', desc: 'Costly stone, thin purses, relentless fate.', cost: 1.2, income: 0.85, hazard: 1.6, spring: 0.9, legacy: 1.7 },
];

export interface Modifier { id: string; name: string; icon: string; desc: string; legacy: number }
export const MODS: Modifier[] = [
  { id: 'fragile', name: 'Fragile Stone', icon: '🪨', desc: 'Quakes crack twice as many aqueducts.', legacy: 0.2 },
  { id: 'parched', name: 'Parched Land', icon: '🌵', desc: 'Springs −20%, evaporation doubled.', legacy: 0.25 },
  { id: 'stormy', name: 'Stormy Years', icon: '🌩️', desc: 'Storms are more frequent and fierce.', legacy: 0.25 },
  { id: 'frugal', name: 'Frugal Council', icon: '🪙', desc: 'Begin with half the coin.', legacy: 0.2 },
  { id: 'foul', name: 'Foul Airs', icon: '☣️', desc: 'Disease spreads much faster.', legacy: 0.2 },
];

export interface LegacyDef { id: string; name: string; icon: string; max: number; cost: number; desc: string }
export const LEGACY: LegacyDef[] = [
  { id: 'coffers', name: 'Surveyors’ Coffers', icon: '💰', max: 3, cost: 6, desc: '+12% starting coin per rank.' },
  { id: 'masons', name: 'Master Masons', icon: '⛏️', max: 3, cost: 8, desc: '−8% construction cost per rank.' },
  { id: 'hydro', name: 'Hydrologist’s Charter', icon: '💧', max: 3, cost: 8, desc: '+8% spring flow per rank.' },
  { id: 'scholars', name: 'Scholar Lineage', icon: '📜', max: 3, cost: 7, desc: '+15% Knowledge per rank.' },
  { id: 'seers', name: 'Storm Prophets', icon: '🔭', max: 2, cost: 10, desc: 'Omens appear 10 s earlier per rank.' },
  { id: 'cistern', name: 'Ancestral Cistern', icon: '🏺', max: 1, cost: 12, desc: 'Cisterns & Sluices are known from the start.' },
  { id: 'gift', name: 'Founder’s Gift', icon: '🎁', max: 1, cost: 14, desc: 'Begin with Lined Canals researched.' },
];

export const DISTRICT_NAMES = ['Forum', 'Subura', 'Aventine', 'Palatine', 'Esquiline', 'Caelian', 'Viminal', 'Quirinal', 'Janiculum', 'Campus', 'Velabrum', 'Trastevere'];

export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const SEASON_ICON = ['🌸', '☀️', '🍂', '❄️'];
export const SEASON_SPRING = [1.3, 0.7, 1.0, 0.9];
export const SEASON_DEMAND = [1, 1.3, 1, 0.8];
export const SEASON_EVAP = [1, 2.2, 1, 0.4];
export const SEASON_GROW = [1.2, 1, 0.7, 0.2];
export const SEASON_RAIN_W: Record<string, number[]> = {
  storm: [2, 0.4, 2, 0.5], drought: [0.2, 2, 0.3, 0.1], quake: [1, 1, 1, 1], slide: [1, 0.5, 1.5, 1],
  plague: [0.7, 1.5, 0.8, 1.2], springfail: [0.5, 1.5, 0.8, 0.8], surge: [1, 0.3, 2, 1],
};

export const HELP_PAGES: { title: string; body: string[] }[] = [
  { title: 'The Goal', body: [
    'Grow a thriving Roman-style city by delivering clean water — and carrying away the dirty water.',
    'Each scenario asks for a population and average happiness target. A great calamity (the Boss) strikes late in the final year. Survive it and meet your goals to win.',
    'You lose if unrest hits 100% (a revolt), the treasury stays in debt for a full minute, or the city is abandoned.',
  ] },
  { title: 'Water Flows Downhill', body: [
    'Every tile has a terrain height (0 = sea, 9 = peak). Press H to show heights. Springs (blue bubbling tiles) sit on high plateaus and trickle water into adjacent channels.',
    'A channel\'s BED height decides where water can go: it flows to neighbours whose bed is lower, and levels out with neighbours at the same height. Never uphill.',
    'Canals follow the ground. To cross a valley, use the Aqueduct tool next to an existing channel — it keeps that channel\'s bed height above the ground. To pass a ridge, the same tool digs a Tunnel below ground. Hover to preview the bed height and cost.',
    'Screw Pumps (research) lift water up to 3 levels from the channel behind to the channel in front. They need coin upkeep.',
  ] },
  { title: 'Houses, Farms & Amenities', body: [
    'Houses draw water from channels within 1 tile, farms within 2. Thirsty houses shrink; happy, watered houses grow, and with fountains and baths nearby upgrade into bigger villas.',
    'Farms harvest coin; mills turn water into coin but make noise; fountains and baths raise happiness; baths also cure disease.',
    'Demand surges in summer. Springs swell in spring and dwindle in summer. Reservoirs smooth the swings.',
  ] },
  { title: 'Sanitation & Plague', body: [
    'Houses turn water into waste. Build Drains within 1 tile so waste can flow downhill. Without drains waste builds up, citizens fall sick, and sickness spreads between neighbours.',
    'Press C for the contact-tracing graph: nodes are houses, lines are contact links, red means infected.',
    'Drains that reach the sea dump sewage and raise Pollution, which hurts happiness and crops. Treatment Plants clean it. Drains with no outlet overflow into dirty floods.',
  ] },
  { title: 'Storms, Floods & Omens', body: [
    'Channels have a capacity. Rain, a blocked outlet, or a closed sluice can overfill them and flood nearby land. Floods destroy houses and crops, and dirty floods spread disease.',
    'The Omen bar shows incoming events with a countdown. Prepare: open spillways, close sluices, build reservoirs, drain your reservoirs before a storm, or fill them before a drought.',
    'Earthquakes crack aqueducts (click to repair, 10 coin) and landslides bury channels in rubble (click to clear).',
  ] },
  { title: 'Progression', body: [
    'Knowledge flows from your citizens. Spend it in the Tech tab (T) on new structures and improvements — this resets each city.',
    'Winning (or even losing) grants Legacy Points, spent in the Legacy hall on permanent bonuses. Winning unlocks the next scenario. Difficulty and modifiers multiply your Legacy reward.',
  ] },
];
