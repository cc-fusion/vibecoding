export type DiffId = "trainee" | "operator" | "sro";
export type ModId = "aging" | "volatile" | "blind" | "skeleton";
export type CompId = "pumpA" | "pumpB" | "turbine" | "sg" | "feed" | "rods" | "tower" | "diesel";
export type TripId = "flux" | "pressHigh" | "pressLow" | "tempHigh" | "tf" | "sgLow" | "steamHigh" | "flow" | "pc";

export interface DiffDef {
  id: DiffId;
  name: string;
  desc: string;
  wear: number;
  events: number;
  credit: number;
  quota: number;
  penalty: number;
  autoDiesel: boolean;
  autoAFW: boolean;
  autoSI: boolean;
  trips: TripId[];
}

export const DIFFS: Record<DiffId, DiffDef> = {
  trainee: {
    id: "trainee", name: "Trainee", desc: "Gentle wear, full automatic protection, auto diesel / AFW / safety injection. Lower payout.",
    wear: 0.6, events: 0.7, credit: 0.75, quota: 0.8, penalty: 0.5, autoDiesel: true, autoAFW: true, autoSI: true,
    trips: ["flux", "pressHigh", "pressLow", "tempHigh", "tf", "sgLow", "steamHigh", "flow", "pc"],
  },
  operator: {
    id: "operator", name: "Operator", desc: "Standard wear and events. Auto AFW and safety injection, partial trip set.",
    wear: 1, events: 1, credit: 1, quota: 1, penalty: 1, autoDiesel: false, autoAFW: true, autoSI: true,
    trips: ["flux", "pressHigh", "pressLow", "tempHigh", "tf", "sgLow", "pc"],
  },
  sro: {
    id: "sro", name: "Senior Reactor Op", desc: "Heavy wear, more faults, minimal protection. Every safety system is yours to start. Big payout.",
    wear: 1.4, events: 1.4, credit: 1.6, quota: 1.1, penalty: 1.3, autoDiesel: false, autoAFW: false, autoSI: false,
    trips: ["flux", "pressHigh", "tf"],
  },
};

export interface ModDef { id: ModId; name: string; desc: string; bonus: number }
export const MODS: ModDef[] = [
  { id: "aging", name: "Aging Plant", desc: "+50% component wear.", bonus: 0.2 },
  { id: "volatile", name: "Volatile Grid", desc: "Demand jitters and spikes unpredictably.", bonus: 0.2 },
  { id: "blind", name: "Flaky Instruments", desc: "Gauges are noisy and delayed.", bonus: 0.25 },
  { id: "skeleton", name: "Skeleton Crew", desc: "One fewer maintenance crew (min 1).", bonus: 0.2 },
];

export interface CompDef { id: CompId; name: string; icon: string; desc: string }
export const COMPS: CompDef[] = [
  { id: "pumpA", name: "Coolant Pump A", icon: "🌀", desc: "Primary loop pump. Wears with speed²." },
  { id: "pumpB", name: "Coolant Pump B", icon: "🌀", desc: "Primary loop pump. Wears with speed²." },
  { id: "turbine", name: "Turbine-Generator", icon: "⚙️", desc: "Converts steam to MW. Wears with load and valve slamming." },
  { id: "sg", name: "Steam Generator", icon: "♨️", desc: "Heat exchanger. Thermal cycling & overpressure wear. Failure = tube leak." },
  { id: "feed", name: "Feedwater Pump", icon: "💧", desc: "Keeps SG level. Offline = need AFW." },
  { id: "rods", name: "Rod Drive Mechanism", icon: "🎚️", desc: "Wears with every bit of rod travel. Offline = rods frozen (SCRAM still works)." },
  { id: "tower", name: "Cooling Tower", icon: "🏭", desc: "Condenser heat rejection. Wears with fan speed." },
  { id: "diesel", name: "Emergency Diesel", icon: "🛢️", desc: "Backup power. Wears while running." },
];

export interface UpgradeDef { id: string; name: string; icon: string; desc: string; max: number; costs: number[] }
export const UPGRADES: UpgradeDef[] = [
  { id: "rods", name: "Rod Drive Retrofit", icon: "🎚️", desc: "+35% rod speed and -20% rod wear per level.", max: 3, costs: [120, 220, 380] },
  { id: "pumps", name: "Pump Overhaul", icon: "🌀", desc: "-25% coolant pump wear per level.", max: 3, costs: [100, 180, 300] },
  { id: "crew", name: "Maintenance Crew", icon: "🧰", desc: "+1 repair crew and +30% repair speed per level.", max: 2, costs: [150, 320] },
  { id: "diag", name: "Diagnostics Suite", icon: "📡", desc: "L1: xenon forecast. L2: trend arrows & longer demand forecast. L3: component life estimates.", max: 3, costs: [90, 200, 350] },
  { id: "diesel", name: "Diesel Generators", icon: "🛢️", desc: "Faster start, more reliable, longer fuel per level.", max: 2, costs: [140, 260] },
  { id: "eccs", name: "ECCS Train", icon: "💉", desc: "Stronger injection and larger borated tank per level.", max: 2, costs: [160, 300] },
  { id: "vent", name: "Filtered Containment Vent", icon: "🧯", desc: "Venting releases 90% less activity.", max: 1, costs: [250] },
  { id: "turb", name: "Turbine Retrofit", icon: "⚡", desc: "+5% electrical efficiency per level (up to 1100 MW). More revenue, more headroom.", max: 2, costs: [200, 400] },
  { id: "training", name: "Operator Training", icon: "🎓", desc: "-15% compliance penalties per level.", max: 3, costs: [80, 160, 260] },
];

export type EventType =
  | "damage" | "pumpSeize" | "leakPipe" | "leakTube" | "rodStick" | "turbineTrip" | "loop" | "quake"
  | "heatwave" | "surge" | "dieselJam" | "flood" | "banner";

export interface EventDef {
  t: number;
  type: EventType;
  warn?: string;
  comp?: CompId;
  to?: number;
  rate?: number;
  idx?: number;
  dur?: number;
  amt?: number;
  mag?: number;
  count?: number;
  text?: string;
}

export interface ShiftDef {
  id: number;
  name: string;
  subtitle: string;
  brief: string;
  tips: string[];
  startHour: number;
  duration: number;
  demand: [number, number][];
  startPower: number;
  health: Partial<Record<CompId, number>>;
  events: EventDef[];
  quota: number;
  ambient: number;
  tutorial?: boolean;
  endless?: boolean;
  boss?: boolean;
}

export const SHIFTS: ShiftDef[] = [
  {
    id: 0, name: "Orientation Shift", subtitle: "Interactive training", startHour: 8, duration: 900, startPower: 0.35,
    brief: "A guided walk through the control room. Nothing here can hurt you — follow the coach, learn the panels, then take your first real shift.",
    tips: ["Follow the coach messages at the top of the screen.", "Hover controls for hints."],
    demand: [[0, 420], [0.5, 600], [1, 600]], health: {}, events: [], quota: 0, ambient: 0.2, tutorial: true,
  },
  {
    id: 1, name: "Day Shift", subtitle: "Steady state", startHour: 8, duration: 240, startPower: 0.62,
    brief: "A quiet day: demand drifts upward through the afternoon. Keep output matched to the grid, keep the reactor inside limits, and learn how rods, steam and temperature push on each other.",
    tips: ["Rod Autopilot holds Tavg on a load program — try it.", "A pump is already worn. Plan a repair before it fails.", "A demand surge is coming late in the shift."],
    demand: [[0, 650], [0.3, 720], [0.6, 800], [1, 760]], health: { pumpA: 52 },
    events: [
      { t: 100, type: "damage", comp: "pumpA", to: 24, warn: "Vibration trending high on Coolant Pump A." },
      { t: 170, type: "surge", amt: 130, dur: 25, warn: "Grid operator: industrial load coming online." },
    ],
    quota: 0.55, ambient: 0.25,
  },
  {
    id: 2, name: "Morning Ramp", subtitle: "Load following", startHour: 4, duration: 240, startPower: 0.5,
    brief: "Dawn demand nearly doubles in two hours. Ramp without overshooting, and don't let a turbine trip catch you with a hot reactor.",
    tips: ["Steam demand pulls reactor power up by itself — rods trim the rest.", "After a turbine trip the bypass valve is your pressure relief.", "Reset the turbine from the Systems tab."],
    demand: [[0, 500], [0.25, 520], [0.45, 850], [0.7, 950], [1, 900]], health: { feed: 55 },
    events: [
      { t: 60, type: "damage", comp: "feed", to: 18, warn: "Feedwater pump amps spiking." },
      { t: 140, type: "turbineTrip", warn: "Grid protection relay chattering at the switchyard." },
    ],
    quota: 0.6, ambient: 0.3,
  },
  {
    id: 3, name: "Night Cutback", subtitle: "Xenon pit", startHour: 18, duration: 240, startPower: 0.9,
    brief: "Demand collapses overnight then rebounds hard. Iodine-135 is decaying into xenon-135 behind you — the xenon pit will punish a deep cutback. A rod bank will also stick mid-shift.",
    tips: ["Xenon peaks ~40 s after a power drop and soaks up reactivity.", "Stuck rod = flux tilt. Re-align the other banks to match.", "Don't cut power more than you must."],
    demand: [[0, 900], [0.25, 880], [0.35, 300], [0.6, 300], [0.72, 880], [1, 950]], health: { rods: 60 },
    events: [
      { t: 40, type: "rodStick", idx: 2, warn: "Rod drive bank 3 showing erratic position signal." },
      { t: 130, type: "surge", amt: 90, dur: 20 },
    ],
    quota: 0.6, ambient: 0.2,
  },
  {
    id: 4, name: "Heat Wave", subtitle: "Condenser limits", startHour: 12, duration: 240, startPower: 0.8,
    brief: "A record heat wave chokes the cooling tower. Demand is huge; the condenser can't dump enough heat. Then a coolant line cracks.",
    tips: ["Tower at 100% still caps your output — accept a derate.", "Isolate the leak, then keep inventory up with ECCS.", "Containment spray lowers building pressure."],
    demand: [[0, 700], [0.4, 850], [0.7, 950], [1, 800]], health: { tower: 85 },
    events: [
      { t: 2, type: "heatwave", dur: 240, warn: "Heat advisory: ambient temperature record." },
      { t: 90, type: "leakPipe", rate: 0.004, warn: "Sump level rising in containment." },
      { t: 170, type: "pumpSeize", comp: "pumpB" },
    ],
    quota: 0.4, ambient: 0.85,
  },
  {
    id: 5, name: "Aging Plant", subtitle: "Everything breaks", startHour: 6, duration: 240, startPower: 0.75,
    brief: "Deferred maintenance comes due. Components are worn thin, a steam generator tube lets go, and the turbine trips when you least expect it.",
    tips: ["Triage repairs: only one or two crews.", "SG tube leak: isolate it and shut down if radiation rises.", "Watch component life estimates (Diagnostics L3)."],
    demand: [[0, 700], [0.3, 900], [0.5, 600], [0.8, 950], [1, 800]], health: { pumpA: 60, pumpB: 55, turbine: 58, sg: 50, rods: 55, tower: 62, feed: 60 },
    events: [
      { t: 50, type: "damage", comp: "sg", to: 20, warn: "Eddy-current alarm on SG tube bundle." },
      { t: 95, type: "leakTube", rate: 0.004, warn: "Secondary radiation monitor ticking up." },
      { t: 150, type: "turbineTrip" },
      { t: 190, type: "damage", comp: "rods", to: 12 },
    ],
    quota: 0.5, ambient: 0.4,
  },
  {
    id: 6, name: "Storm Front", subtitle: "Loss of offsite power", startHour: 20, duration: 270, startPower: 0.85,
    brief: "A violent storm severs the transmission lines. Pumps will coast down; diesels must carry you through cooldown until the grid returns.",
    tips: ["On LOOP: SCRAM, start diesel, open AFW.", "Diesels only give 60% pump speed.", "Diesel fuel is finite."],
    demand: [[0, 850], [0.5, 950], [1, 900]], health: { diesel: 80 },
    events: [
      { t: 60, type: "loop", dur: 75, warn: "Lightning strike on transmission corridor — switchyard unstable." },
      { t: 150, type: "damage", comp: "diesel", to: 32, warn: "Diesel exhaust temperature high." },
      { t: 190, type: "surge", amt: 100, dur: 25 },
      { t: 215, type: "pumpSeize", comp: "pumpA" },
    ],
    quota: 0.45, ambient: 0.3,
  },
  {
    id: 7, name: "Black Swan", subtitle: "Capstone emergency", startHour: 14, duration: 300, startPower: 0.9, boss: true,
    brief: "The big one. A major earthquake, a tsunami and a cascade of failures. There is no profit tonight — only survival. Keep the core covered, the containment intact, and hold the line until offsite power is restored.",
    tips: ["Phase 1 quake: SCRAM, check damage, start diesel (the first start will jam).", "Phase 2 flood takes out the diesel — repair or conserve.", "Phase 3 tube + pipe leaks: isolate, borate, spray.", "Survive until the shift ends."],
    demand: [[0, 800], [0.15, 900], [1, 900]], health: {},
    events: [
      { t: 38, type: "banner", text: "PHASE 1 — EARTHQUAKE", warn: "Seismic alarm: magnitude 7 expected!" },
      { t: 45, type: "quake", mag: 1 },
      { t: 46, type: "loop", dur: 230 },
      { t: 46, type: "dieselJam", count: 1 },
      { t: 120, type: "banner", text: "PHASE 2 — TSUNAMI", warn: "Tsunami warning: wave arriving at the site in 20 seconds." },
      { t: 135, type: "flood" },
      { t: 150, type: "leakPipe", rate: 0.005 },
      { t: 190, type: "banner", text: "PHASE 3 — CASCADE" },
      { t: 195, type: "leakTube", rate: 0.004, warn: "Aftershock — structural damage reported." },
      { t: 198, type: "quake", mag: 0.6 },
      { t: 235, type: "damage", comp: "feed", to: 0 },
    ],
    quota: 0, ambient: 0.4,
  },
  {
    id: 8, name: "Endless Shift", subtitle: "Endurance mode", startHour: 8, duration: 99999, startPower: 0.7, endless: true,
    brief: "No end to this shift. Faults escalate every minute. Survive as many hours as you can — your best run is recorded.",
    tips: ["Random faults of every kind.", "Repair early, stay ahead of xenon.", "Compliance is your life bar."],
    demand: [[0, 600], [0.1, 700], [0.25, 850], [0.4, 950], [0.55, 700], [0.7, 450], [0.85, 800], [1, 600]], health: {},
    events: [], quota: 0, ambient: 0.3,
  },
];

export const HELP_SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "The Job",
    body: [
      "You are the shift supervisor of a 1000 MW pressurized-water reactor. Match electrical output to the grid demand curve, keep every safety limit, and bring the plant through the shift.",
      "You lose if: the core melts (fuel integrity 0), containment ruptures (>4 bar), the reactor vessel overpressures (>200 bar), or your regulator compliance hits 0 (license revoked). Missing the grid quota also fails the shift.",
      "Each shift pays credits (revenue, stars). Spend them in the Plant Office on upgrades. Progress and upgrades are saved in your browser.",
    ],
  },
  {
    title: "Reactor & Xenon",
    body: [
      "Four control-rod banks. Insert (higher %) = less reactivity. Power is the balance of rods, temperature feedback, xenon, voids and boron. Hotter coolant and fuel pull power DOWN (negative feedback), so steam demand drags power along.",
      "Rod Autopilot walks the banks to hold coolant average temperature (Tavg) on a load-based program. Manual control lets you pre-empt changes.",
      "Xenon-135 builds after a power drop (iodine decay) and absorbs neutrons for minutes. Cut deeply and you dig a xenon pit that makes restart hard. Keep banks aligned: a rod tilt raises fuel hot-spot temperature.",
      "SCRAM drops every free rod. Decay heat (about 6%) keeps coming for minutes — cooling must continue. A tripped reactor stays latched until you press RESET TRIP.",
    ],
  },
  {
    title: "Coolant, Steam, Grid",
    body: [
      "Two coolant pumps move heat from the core to the steam generator. Less flow = hotter coolant. Pressurizer heaters/spray hold primary pressure (Auto does it for you). Low pressure + hot coolant = boiling voids.",
      "Steam pressure feeds the turbine governor. Auto governor opens the valve to meet demand; manual lets you set it. Bypass dumps surplus steam to the condenser; the cooling tower sets how much heat the condenser can shed (heat waves hurt).",
      "Feedwater keeps SG level. If the feed pump is down, switch on AFW. Safety: ECCS injects borated water (and poisons the core), RHR adds cooling, containment spray cuts building pressure, Vent dumps pressure but releases activity.",
      "Power sources: offsite grid or the emergency diesel (60% pump speed, finite fuel). Without any power pumps coast down and rods can't move — but SCRAM always works.",
    ],
  },
  {
    title: "Wear & Maintenance",
    body: [
      "Every component has health. Stress wears it: pump speed, turbine load, thermal cycling, rod travel, fan speed. Below 40% it runs degraded; at low health it can fail at random.",
      "Assign a crew in the Maintenance tab: the part is tagged out (offline) while crews work, then restored to 100% for a parts cost. Choose your moment — taking a pump offline mid-ramp has consequences.",
    ],
  },
  {
    title: "Alarms & Events",
    body: [
      "Annunciator tiles flash until acknowledged (A key or ACK button). Unacknowledged alarms sound the horn repeatedly. Events: pump seizure, coolant leak (pipe), SG tube leak, stuck rod, turbine trip, loss of offsite power, earthquake, heat wave, demand surge, diesel jam, flood.",
      "Leaks must be isolated (takes a few seconds). Pipe leaks fill containment; tube leaks release activity out the secondary side.",
      "Modifiers on the briefing screen add risk and credit multipliers. Difficulty can be changed live in Settings.",
    ],
  },
];

export const KEYS_REF: [string, string][] = [
  ["W / ↑", "Withdraw all rods (hold Shift = coarse)"],
  ["S / ↓", "Insert all rods"],
  ["Space", "SCRAM (emergency trip)"],
  ["R", "Reset reactor trip"],
  ["T", "Toggle rod autopilot"],
  ["A", "Acknowledge alarms"],
  ["1 / 2 / 3", "Game speed 1x / 2x / 4x"],
  ["P / Esc", "Pause menu"],
  ["M", "Mute / unmute"],
  ["Gamepad", "Stick: rods · A: autopilot · X: ack · Y: SCRAM · Start: pause"],
  ["Touch", "All controls are on-screen sliders and buttons"],
];

export const STORY_RANKS = ["Trainee", "Control Operator", "Shift Technical Advisor", "Senior Reactor Operator", "Plant Supervisor", "Chief Nuclear Officer"];
