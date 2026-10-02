import type { Game } from "./game";

export type RoomId = "bridge" | "quarters" | "medbay" | "lab" | "mess" | "engine" | "security" | "cargo";
export type Zone = RoomId | "hall";
export interface P { x: number; y: number }
export interface Room { id: RoomId; name: string; short: string; x: number; y: number; w: number; h: number; top: boolean; color: string }

export const WORLD = { w: 1500, h: 900 };
export const HALL = { x: 80, y: 410, w: 1340, h: 80 };
export const DOOR_W = 70;
export const ROOMS: Room[] = [
  { id: "bridge", name: "Bridge", short: "BR", x: 80, y: 80, w: 320, h: 310, top: true, color: "#ffb347" },
  { id: "quarters", name: "Crew Quarters", short: "QU", x: 420, y: 80, w: 320, h: 310, top: true, color: "#b48cff" },
  { id: "medbay", name: "Medbay", short: "MD", x: 760, y: 80, w: 320, h: 310, top: true, color: "#4dffb0" },
  { id: "lab", name: "Research Lab", short: "LB", x: 1100, y: 80, w: 320, h: 310, top: true, color: "#5cc8ff" },
  { id: "mess", name: "Mess Hall", short: "MS", x: 80, y: 510, w: 320, h: 310, top: false, color: "#ff8fc8" },
  { id: "engine", name: "Engineering", short: "EN", x: 420, y: 510, w: 320, h: 310, top: false, color: "#ff7a45" },
  { id: "security", name: "Security", short: "SC", x: 760, y: 510, w: 320, h: 310, top: false, color: "#ff4d6d" },
  { id: "cargo", name: "Cargo Bay", short: "CG", x: 1100, y: 510, w: 320, h: 310, top: false, color: "#e3e35a" },
];
export const roomById = (id: string) => ROOMS.find((r) => r.id === id)!;
export const doorX = (r: Room) => r.x + r.w / 2;
export const innerDoorY = (r: Room) => (r.top ? r.y + r.h - 30 : r.y + 30);
export const gapY = (r: Room) => (r.top ? 390 : 490);

export function zoneAt(x: number, y: number): Zone | null {
  for (const r of ROOMS) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.id;
  if (y >= HALL.y - 20 && y <= HALL.y + HALL.h + 20 && x >= HALL.x && x <= HALL.x + HALL.w) return "hall";
  return null;
}

export function buildPath(fx: number, fy: number, tx: number, ty: number): P[] {
  const a = zoneAt(fx, fy);
  const b = zoneAt(tx, ty);
  if (a === b) return [{ x: tx, y: ty }];
  const pts: P[] = [];
  if (a && a !== "hall") {
    const r = roomById(a);
    pts.push({ x: doorX(r), y: innerDoorY(r) }, { x: doorX(r), y: 450 });
  }
  if (b && b !== "hall") {
    const r = roomById(b);
    pts.push({ x: doorX(r), y: 450 }, { x: doorX(r), y: innerDoorY(r) });
  }
  pts.push({ x: tx, y: ty });
  return pts;
}

export interface NpcDef { id: string; name: string; role: string; color: string; init: string; bio: string }
export const NPCS: NpcDef[] = [
  { id: "vance", name: "Cmdr. Ilsa Vance", role: "Station Commander", color: "#ffb347", init: "IV", bio: "Iron-willed. Keeps the station running and everyone's secrets filed." },
  { id: "okafor", name: "Dr. Teo Okafor", role: "Medical Officer", color: "#4dffb0", init: "TO", bio: "Soft-spoken, tired eyes, a medicine cabinet nobody else can open." },
  { id: "rook", name: "Rook Daley", role: "Chief Engineer", color: "#ff7a45", init: "RD", bio: "Grease-stained and blunt. Knows every pipe and every lie on the station." },
  { id: "quill", name: "Sgt. Mara Quill", role: "Security Chief", color: "#ff4d6d", init: "MQ", bio: "Watchful, unshakeable. If you are caught, she is who catches you." },
  { id: "nyx", name: "Dr. Nyx Ardent", role: "Xeno-physicist", color: "#c58bff", init: "NA", bio: "Brilliant, secretive, always three steps ahead of the conversation." },
  { id: "pip", name: "Pip Marlowe", role: "Steward & Cook", color: "#7dd3fc", init: "PM", bio: "Cheerful gossip. Hears everything that is said over a meal tray." },
];
export const npcDef = (id: string) => NPCS.find((n) => n.id === id)!;

export const ITEMS: Record<string, { name: string; icon: string }> = {
  coffee: { name: "Hot Coffee", icon: "☕" },
  lockpick: { name: "Lockpick Set", icon: "🔧" },
  card1: { name: "Lab Keycard (L1)", icon: "💳" },
  card2: { name: "Quill's Keycard (L2)", icon: "🪪" },
};

export interface Fact { id: string; kind: "evidence" | "note"; cat?: "means" | "motive" | "opportunity" | "secret"; title: string; text: string }
export interface Opt { label: string; cost?: number; illicit?: number; lock?: (g: Game) => string | null; run: (g: Game) => void }
export interface Obj { id: string; room: RoomId; fx: number; fy: number; icon: string; name: string; opts: Opt[] }
export interface Topic { id: string; label: string; trust?: number; need?: (g: Game) => string | null; gives?: string; reply: string; cost?: number }
export interface Overhear { id: string; room: RoomId; from: number; to: number; who: string[]; lines: [string, string][]; fact: string }
export interface StationEvent { id: string; min: number; dur: number; fact: string }
export interface Statement { text: string; truth: boolean; counter?: string; react: string }
export type Sched = [number, Zone, number?][];
export type Lock = { kind: "card"; lvl: number } | { kind: "code"; code: string };

export interface CaseDef {
  id: string; num: number; title: string; tagline: string; brief: string; killer: string; victim: string;
  crimeRoom: RoomId; crime: number; crimeText: string; pool: number; rootMidi: number;
  restricted: RoomId[]; cameras: RoomId[]; locks: Partial<Record<RoomId, Lock>>;
  sched: Record<string, Sched>; react: Record<string, RoomId>;
  events: StationEvent[]; overhears: Overhear[]; objs: Obj[]; topics: Record<string, Topic[]>;
  facts: Record<string, Fact>; evidence: string[]; hints: Record<string, string>;
  statements: Statement[]; bossTimer?: number; adaptive?: boolean; final?: boolean; winText: string;
}

const mulberry = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const fmtTime = (m: number) => {
  const t = 19 * 60 + Math.floor(m);
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

const coffeeObj = (): Obj => ({
  id: "coffee", room: "mess", fx: 0.82, fy: 0.28, icon: "☕", name: "Coffee machine",
  opts: [{ label: "Pour a hot coffee", cost: 1, lock: (g) => (g.has("coffee") ? "You are already carrying one." : null), run: (g) => { g.give("coffee"); g.msg("You pour a steaming coffee. Someone might appreciate it."); } }],
});
const hackOpt = (label: string, ev: string, len: number, illicit: number, need?: (g: Game) => string | null): Opt => ({
  label, cost: 3, illicit,
  lock: (g) => (g.know(ev) ? "You already copied this." : need ? need(g) : null),
  run: (g) => g.mini("hack", { len }, () => g.learn(ev)),
});
const noteOpt = (label: string, fact: string, text: string): Opt => ({
  label, cost: 1, lock: (g) => (g.know(fact) ? "Already noted." : null),
  run: (g) => { g.msg(text); g.learn(fact); },
});

export function buildCase(id: string, seed: number): CaseDef {
  const r = mulberry(seed);
  const code = () => String(1000 + Math.floor(r() * 9000));
  if (id === "c1") {
    const c = code();
    return {
      id, num: 1, title: "Last Orders", tagline: "A cup of coffee. A cup of something else.",
      brief: "Meridian Zero Station, 19:00. At 20:15 Commander Vance collapses on the Bridge — dead — and the day snaps back to 19:00. Only you remember. The loop gives you unlimited reruns but not unlimited rewinds: the timeline is fraying. Learn the crew's routines, gather proof of MEANS, MOTIVE and OPPORTUNITY, then confront the killer before the clock runs out.",
      killer: "okafor", victim: "vance", crimeRoom: "bridge", crime: 75, pool: 8, rootMidi: 45,
      crimeText: "20:15 — Commander Vance slumps over her console. Poison. The station's lights flicker as time folds back.",
      winText: "Dr. Okafor surrenders the sedative case. The Commander lives to see 20:15. The loop holds — but the next day does not feel quite right…",
      restricted: ["security", "quarters"], cameras: ["security"], locks: {}, react: {},
      sched: {
        vance: [[0, "bridge"], [30, "mess"], [48, "bridge"]],
        okafor: [[0, "medbay"], [12, "mess"], [36, "medbay"], [66, "bridge"]],
        rook: [[0, "engine"], [40, "cargo"], [60, "engine"]],
        quill: [[0, "security"], [20, "hall", 760], [40, "mess"], [60, "security"], [68, "hall", 250]],
        nyx: [[0, "lab"], [50, "mess"], [65, "lab"]],
        pip: [[0, "mess"], [44, "cargo"], [58, "mess"]],
      },
      events: [],
      overhears: [{ id: "ov_code", room: "mess", from: 14, to: 34, who: ["okafor", "pip"], fact: "n_code", lines: [["pip", `Doc, you scribbled your cabinet code on a napkin again. ${c}, right? Your daughter's birthday.`], ["okafor", "Pip — keep your voice down."]] }],
      objs: [
        coffeeObj(),
        { id: "cab", room: "medbay", fx: 0.8, fy: 0.28, icon: "💊", name: "Locked drug cabinet", opts: [{ label: "Enter the keypad code", cost: 3, illicit: 55, lock: (g) => (g.know("e_vial") ? "Already examined." : null), run: (g) => g.mini("keypad", { code: c }, () => g.learn("e_vial")) }] },
        { id: "cterm", room: "bridge", fx: 0.76, fy: 0.3, icon: "💻", name: "Command terminal", opts: [hackOpt("Hack the Commander's drafts", "e_letter", 3, 50)] },
        { id: "roster", room: "security", fx: 0.5, fy: 0.22, icon: "📋", name: "Duty roster board", opts: [noteOpt("Read the roster", "n_roster", "Roster: Sgt. Quill patrols the hall ~19:20, lunches in the Mess ~19:40.")] },
        { id: "flask", room: "engine", fx: 0.25, fy: 0.3, icon: "🍶", name: "Stashed flask", opts: [noteOpt("Sniff the flask", "n_flask", "Rook's moonshine. Explains his 'inspections' of the Cargo Bay. A red herring.")] },
      ],
      topics: {
        okafor: [{ id: "o1", label: "Ask about his shift", reply: "Quiet. Charts, inventory, the occasional headache. Mine, mostly." }, { id: "o2", label: "Ask about the Commander", gives: "n_audit", reply: "She's exacting. We clashed over a medical audit. But who doesn't clash with Ilsa?" }],
        quill: [{ id: "q1", label: "Ask about her patrol", reply: "Hall at twenty past, Mess around twenty to. Same as always." }, { id: "q2", label: "Ask what she saw tonight", trust: 2, gives: "e_witness", reply: "You've been decent to me, so… I saw Dr. Okafor head for the Bridge with a covered cup at 20:06. Odd — he swore he never left Medbay." }],
        vance: [{ id: "v1", label: "Warn her about tonight", reply: "Paranoia is the first symptom of fatigue, Investigator. Get some rest." }],
        pip: [{ id: "p1", label: "Ask for gossip", trust: 1, gives: "n_code", reply: `Well… the Doc scribbles his cabinet code on napkins. ${c}. Shh!` }],
        rook: [{ id: "r1", label: "Ask about the flask", reply: "What flask? …Get lost." }],
        nyx: [{ id: "n1", label: "Ask about her research", reply: "Classified, and tedious, and none of your business." }],
      },
      facts: {
        n_code: { id: "n_code", kind: "note", title: "Cabinet code", text: `Dr. Okafor's drug-cabinet keypad code is ${c} (his daughter's birthday).` },
        n_roster: { id: "n_roster", kind: "note", title: "Quill's routine", text: "Quill patrols the hall around 19:20 and lunches in the Mess around 19:40." },
        n_flask: { id: "n_flask", kind: "note", title: "Rook's flask", text: "Rook hides a flask in Engineering. Not relevant to the murder." },
        n_audit: { id: "n_audit", kind: "note", title: "The audit", text: "Okafor admits he clashed with the Commander over a 'medical audit'." },
        e_vial: { id: "e_vial", kind: "evidence", cat: "means", title: "Empty Oblivane vial", text: "Medbay cabinet: a vial of slow-acting sedative Oblivane is missing, its tray tagged in Okafor's hand. Traces match the Commander's coffee." },
        e_letter: { id: "e_letter", kind: "evidence", cat: "motive", title: "Vance's unsent report", text: "Command terminal: Vance's draft accuses Dr. Okafor of falsifying medical logs to hide a narcotics habit. To be filed at 20:15." },
        e_witness: { id: "e_witness", kind: "evidence", cat: "opportunity", title: "Quill's sighting", text: "Sgt. Quill saw Okafor carrying a covered cup to the Bridge at 20:06 — while he claims never to have left Medbay." },
      },
      evidence: ["e_vial", "e_letter", "e_witness"],
      hints: {
        e_vial: "Okafor's drug cabinet needs a four-digit code. Someone might let it slip while he's in the Mess — and he must be out of Medbay when you try.",
        e_letter: "The Commander leaves the Bridge for a while around 19:30. The terminal needs hacking while she is away.",
        e_witness: "Sgt. Quill saw something, but she only talks to people she trusts. Everybody likes coffee.",
      },
      statements: [
        { text: "I was in Medbay all evening, running inventory. Ask anyone.", truth: false, counter: "e_witness", react: "…I may have stepped out. Briefly." },
        { text: "The sedatives are locked tight. I'd never misuse them.", truth: false, counter: "e_vial", react: "That vial… I never meant for it to go this far." },
        { text: "The Commander and I? Perfectly cordial colleagues.", truth: false, counter: "e_letter", react: "She was going to ruin me. I had no choice!" },
      ],
    };
  }
  if (id === "c2") {
    const order = ["A", "B", "C", "D", "E"].sort(() => r() - 0.5);
    return {
      id, num: 2, title: "Cold Storage", tagline: "Power, pressure, and one very warm solder joint.",
      brief: "A new day, same loop. At 20:30 Chief Engineer Rook Daley is blown out of Cargo Bay airlock. Now there are locks, cameras and keycards between you and the truth. Power failures strip cameras and unlock doors — and send crew running to Engineering. Use the blackout. Sequence your steps. Beware the security cameras.",
      killer: "nyx", victim: "rook", crimeRoom: "cargo", crime: 90, pool: 9, rootMidi: 43,
      crimeText: "20:30 — The Cargo Bay airlock cycles open. Rook is gone before the alarm sounds. The timeline shudders and rewinds.",
      winText: "Nyx's override chip clatters to the deck. Rook lives. Somewhere in the lab, a machine you were never meant to see hums louder…",
      restricted: ["security", "lab", "engine", "quarters"], cameras: ["lab"],
      locks: { lab: { kind: "card", lvl: 1 } },
      react: { nyx: "engine", rook: "engine" },
      sched: {
        vance: [[0, "bridge"], [45, "mess"], [62, "bridge"]],
        okafor: [[0, "medbay"], [40, "mess"], [62, "medbay"]],
        rook: [[0, "engine"], [25, "cargo"], [55, "engine"], [82, "cargo"]],
        quill: [[0, "security"], [18, "hall", 1000], [30, "medbay"], [50, "security"], [75, "bridge"]],
        nyx: [[0, "lab"], [35, "mess"], [52, "lab"], [62, "cargo"], [68, "lab"], [84, "cargo"]],
        pip: [[0, "mess"], [50, "medbay"], [70, "mess"]],
      },
      events: [],
      overhears: [{ id: "ov_chip", room: "mess", from: 40, to: 52, who: ["nyx", "okafor"], fact: "n_chip", lines: [["nyx", "The chip stays in my wall safe until it is needed."], ["okafor", "Needed for what, Nyx?"], ["nyx", "Nothing you'd understand, Teo."]] }],
      objs: [
        coffeeObj(),
        { id: "crate", room: "cargo", fx: 0.28, fy: 0.3, icon: "📦", name: "Rook's supply crate", opts: [{ label: "Pry open the lid", cost: 2, illicit: 25, lock: (g) => (g.know("n_breaker") ? "Already read." : null), run: (g) => { g.msg(`Scrawled inside the lid: 'Kill the lights in this order: ${order.join("-")}'.`); g.learn("n_breaker"); } }] },
        { id: "panel", room: "engine", fx: 0.82, fy: 0.25, icon: "⚡", name: "Breaker panel", opts: [{ label: "Work the breakers (cut power)", cost: 2, illicit: 35, lock: (g) => (g.blackout ? "Power is already out." : null), run: (g) => g.mini("breaker", { order }, () => g.startBlackout(14)) }] },
        { id: "tools", room: "engine", fx: 0.2, fy: 0.3, icon: "🧰", name: "Rook's toolbox", opts: [{ label: "Take a lockpick set", cost: 1, illicit: 30, lock: (g) => (g.has("lockpick") ? "You already have one." : null), run: (g) => { g.give("lockpick"); g.msg("A fine lockpick set. Rook never uses it."); } }] },
        { id: "audit", room: "engine", fx: 0.5, fy: 0.72, icon: "💻", name: "Audit terminal", opts: [hackOpt("Hack Rook's audit files", "e_data", 4, 50, (g) => (g.blackout ? "The terminal is dark." : null))] },
        { id: "rack", room: "security", fx: 0.2, fy: 0.3, icon: "🔑", name: "Key rack", opts: [{ label: "Take the Lab keycard", cost: 1, illicit: 45, lock: (g) => (g.has("card1") ? "You already have it." : null), run: (g) => { g.give("card1"); g.msg("Level 1 Lab keycard acquired."); } }] },
        { id: "arch", room: "security", fx: 0.76, fy: 0.3, icon: "📹", name: "Camera archive", opts: [hackOpt("Pull the Cargo footage", "e_footage", 4, 55, (g) => (g.blackout ? "The archive is offline." : null))] },
        { id: "safe", room: "lab", fx: 0.8, fy: 0.28, icon: "🔐", name: "Lab wall safe", opts: [{ label: "Pick the lock", cost: 4, illicit: 60, lock: (g) => (g.know("e_chip") ? "Already examined." : g.has("lockpick") ? null : "You need a lockpick set."), run: (g) => g.mini("safe", { hits: 3 }, () => g.learn("e_chip")) }] },
      ],
      topics: {
        pip: [{ id: "p1", label: "Ask about the Lab", trust: 1, gives: "n_labkey", reply: "Dr. Ardent keeps it locked. But the spare card hangs on the key rack in Security." }],
        rook: [{ id: "r1", label: "Ask about his toolbox", trust: 1, gives: "n_toolbox", reply: "Got a lockpick set in there I never use. I'm in Cargo from about 19:25 till 19:55." }],
        quill: [{ id: "q1", label: "Ask about the cameras", gives: "n_cams", reply: "Archive records everything. Dies during a power failure, though. Don't tell anyone." }],
        nyx: [{ id: "n1", label: "Ask about Rook", trust: 2, gives: "n_tension", reply: "He pokes at my power logs. Engineers. Always poking." }],
        okafor: [{ id: "o1", label: "Ask about Dr. Ardent", reply: "Brilliant. Cold. We chat over lunch, around twenty to eight." }],
        vance: [{ id: "v1", label: "Ask about the station", reply: "Everything's nominal, Investigator. Everything's always nominal." }],
      },
      facts: {
        n_breaker: { id: "n_breaker", kind: "note", title: "Breaker order", text: `Breaker sequence inside Rook's crate: ${order.join(" → ")}. Flip in order to cut station power.` },
        n_chip: { id: "n_chip", kind: "note", title: "'The chip'", text: "Overheard: Nyx keeps something she calls 'the chip' in her Lab wall safe." },
        n_labkey: { id: "n_labkey", kind: "note", title: "Spare keycard", text: "A spare Lab keycard hangs on the Security key rack." },
        n_toolbox: { id: "n_toolbox", kind: "note", title: "Rook's toolbox", text: "Rook's toolbox holds a lockpick set. Rook is in Cargo ~19:25 – 19:55." },
        n_cams: { id: "n_cams", kind: "note", title: "Camera blind spot", text: "Cameras and the archive die during a power failure; locked doors unlock." },
        n_tension: { id: "n_tension", kind: "note", title: "Ardent / Rook", text: "Nyx resents Rook poking into her power logs." },
        n_blackout: { id: "n_blackout", kind: "note", title: "Power failure", text: "During a blackout cameras die, doors unlock — and Nyx and Rook rush to Engineering." },
        e_data: { id: "e_data", kind: "evidence", cat: "motive", title: "Rook's audit", text: "Engineering terminal: Rook's draft reveals Dr. Ardent siphoning reactor power for illegal experiments, due to be reported at 20:30." },
        e_footage: { id: "e_footage", kind: "evidence", cat: "opportunity", title: "Archive footage", text: "Archive: at 20:02 Dr. Ardent spends six minutes at the Cargo airlock actuator, then flags the clip for deletion." },
        e_chip: { id: "e_chip", kind: "evidence", cat: "means", title: "Doctored override chip", text: "Lab wall safe: a hand-built airlock override chip, solder still fresh. The serial plate reads N. ARDENT." },
      },
      evidence: ["e_data", "e_footage", "e_chip"],
      hints: {
        e_data: "Rook's audit terminal in Engineering. Rook is in Cargo from about 19:25 to 19:55; Quill stays away too.",
        e_footage: "Quill leaves Security around 19:18. The archive is offline during blackouts.",
        e_chip: "The Lab is empty while Nyx lunches in the Mess (19:35–19:52). You need a way in — a keycard or a blackout — and a lockpick.",
      },
      statements: [
        { text: "I never left my lab until the alarm sounded. Check the cameras.", truth: false, counter: "e_footage", react: "That clip was deleted… how did you…" },
        { text: "Rook and I barely spoke. No friction at all.", truth: false, counter: "e_data", react: "He was going to expose everything!" },
        { text: "It's a tragedy. Rook was a good man.", truth: true, react: "…At least you believe me on that." },
        { text: "Override chips? I'm a biologist. I can't wire a doorbell.", truth: false, counter: "e_chip", react: "The chip is mine. It's mine." },
      ],
    };
  }
  const bc = code();
  return {
    id, num: 3, title: "Loop Zero", tagline: "The killer remembers, too.",
    brief: "The final day. At 20:50 Commander Vance dies again — and this time the killer is learning from every loop. Security Chief Quill grows warier each time you rewind, and a scheduled power surge at 20:00 is your one window into the station's most guarded systems. Five pieces of evidence. One interrogation under the clock. Break the loop.",
    killer: "quill", victim: "vance", crimeRoom: "bridge", crime: 110, pool: 11, rootMidi: 41, adaptive: true, final: true, bossTimer: 22,
    crimeText: "20:50 — Commander Vance falls on the Bridge. Quill's boots echo down the hall. The loop tightens.",
    winText: "Quill's override lock shatters. The Chronometer shuts down, the loop unravels, and a true 21:00 dawns on Meridian Zero. You are free.",
    restricted: ["security", "quarters", "lab", "bridge"], cameras: ["security", "lab"],
    locks: { quarters: { kind: "card", lvl: 2 } },
    react: { quill: "quarters", rook: "engine", nyx: "engine" },
    sched: {
      vance: [[0, "bridge"], [38, "mess"], [56, "bridge"]],
      okafor: [[0, "medbay"], [38, "mess"], [56, "medbay"], [100, "hall", 600]],
      rook: [[0, "engine"], [20, "cargo"], [50, "engine"], [85, "mess"]],
      quill: [[0, "security"], [28, "quarters"], [52, "hall", 900], [70, "cargo"], [96, "hall", 250], [106, "bridge"]],
      nyx: [[0, "lab"], [45, "engine"], [75, "lab"]],
      pip: [[0, "mess"], [38, "hall", 600], [56, "mess"], [85, "medbay"]],
    },
    events: [{ id: "surge", min: 60, dur: 18, fact: "n_blackout" }],
    overhears: [{ id: "ov_bridge", room: "mess", from: 40, to: 55, who: ["vance", "okafor"], fact: "n_bcode", lines: [["vance", "I file the order to dissolve Security at 20:40, Teo."], ["vance", `The papers go in my Bridge safe. Code ${bc}. Tell no one.`], ["okafor", "Quill will not take it quietly."]] }],
    objs: [
      coffeeObj(),
      { id: "bsafe", room: "bridge", fx: 0.78, fy: 0.28, icon: "🔐", name: "Commander's safe", opts: [{ label: "Enter the safe code", cost: 3, illicit: 60, lock: (g) => (g.know("e_orders") ? "Already examined." : null), run: (g) => g.mini("keypad", { code: bc }, () => g.learn("e_orders")) }] },
      { id: "crate", room: "cargo", fx: 0.28, fy: 0.3, icon: "📦", name: "Sealed crate", opts: [hackOpt("Crack the crate's lock", "e_ledger", 4, 55)] },
      { id: "sterm", room: "security", fx: 0.76, fy: 0.3, icon: "🖥️", name: "Log server", opts: [hackOpt("Dig out the deleted logs", "e_tamper", 5, 50, (g) => (g.blackout ? null : "The log server is locked down — until power drops."))] },
      { id: "desk", room: "security", fx: 0.22, fy: 0.3, icon: "🪪", name: "Duty desk", opts: [{ label: "Borrow Quill's keycard", cost: 1, illicit: 45, lock: (g) => (g.has("card2") ? "You already have it." : null), run: (g) => { g.give("card2"); g.msg("Level 2 keycard acquired."); } }] },
      { id: "tools", room: "engine", fx: 0.2, fy: 0.3, icon: "🧰", name: "Rook's toolbox", opts: [{ label: "Take a lockpick set", cost: 1, illicit: 30, lock: (g) => (g.has("lockpick") ? "You already have one." : null), run: (g) => { g.give("lockpick"); g.msg("Lockpick set acquired."); } }] },
      { id: "locker", room: "quarters", fx: 0.8, fy: 0.3, icon: "🗄️", name: "Quill's locker", opts: [{ label: "Pick the locker", cost: 4, illicit: 60, lock: (g) => (g.know("e_pistol") ? "Already examined." : g.has("lockpick") ? null : "You need a lockpick set."), run: (g) => g.mini("safe", { hits: 4 }, () => g.learn("e_pistol")) }] },
      { id: "chrono", room: "lab", fx: 0.78, fy: 0.28, icon: "⏱️", name: "Chronometer console", opts: [hackOpt("Read the Chronometer logs", "e_device", 5, 55)] },
    ],
    topics: {
      pip: [{ id: "p1", label: "Ask about Quill's rounds", trust: 1, gives: "n_cargo", reply: "Quill goes to Cargo alone every night around 20:10. Nobody else is ever allowed there then." }],
      rook: [{ id: "r1", label: "Ask about the toolbox", trust: 1, gives: "n_toolbox", reply: "Lockpicks are in the box. I'm in Cargo from 19:20 to 19:50, so don't touch anything." }],
      nyx: [{ id: "n1", label: "Ask about the Chronometer", trust: 2, gives: "n_chrono", reply: "A prototype in my Lab. Only top clearance can set it. Quill's override, specifically. Why?" }],
      okafor: [{ id: "o1", label: "Ask about the Commander's plans", trust: 1, gives: "n_plans", reply: "She files something enormous at 20:40. Security's future is in it. It's in the Bridge safe." }],
      quill: [{ id: "q1", label: "Ask about her keycard", reply: "It never leaves my person. Never. …Why do you ask?" }],
      vance: [{ id: "v1", label: "Warn her about tonight", reply: "I know. That is why I am moving tonight. Find your proof, Investigator." }],
    },
    facts: {
      n_bcode: { id: "n_bcode", kind: "note", title: "Bridge safe code", text: `Overheard: Vance keeps the dissolution order in her Bridge safe — code ${bc}.` },
      n_blackout: { id: "n_blackout", kind: "note", title: "Scheduled surge", text: "A power surge hits at 20:00 and lasts until about 20:18. Cameras and locks fail. Quill rushes to her quarters. Rook and Nyx rush to Engineering." },
      n_cargo: { id: "n_cargo", kind: "note", title: "Quill's cargo runs", text: "Quill visits Cargo alone around 20:10 every evening." },
      n_toolbox: { id: "n_toolbox", kind: "note", title: "Rook's toolbox", text: "Lockpick in Rook's toolbox. Rook is in Cargo ~19:20 – 19:50." },
      n_chrono: { id: "n_chrono", kind: "note", title: "The Chronometer", text: "A prototype in the Lab. Only Quill's override can set it." },
      n_plans: { id: "n_plans", kind: "note", title: "Vance's plans", text: "Vance files the order to dissolve Security at 20:40, safe in the Bridge." },
      n_caught: { id: "n_caught", kind: "note", title: "She's learning", text: "Quill reacts faster each time you rewind. The killer remembers, too." },
      e_orders: { id: "e_orders", kind: "evidence", cat: "motive", title: "Dissolution order", text: "Bridge safe: Vance's signed order to dissolve Security and arrest Quill for smuggling. Filing time: 20:40." },
      e_ledger: { id: "e_ledger", kind: "evidence", cat: "secret", title: "Smuggling ledger", text: "Sealed Cargo crate: a ledger of black-market shipments, every page countersigned M.Q." },
      e_tamper: { id: "e_tamper", kind: "evidence", cat: "opportunity", title: "Tampered logs", text: "Log server: Quill erased her own movement logs from 19:50 and 20:10, replacing them with a fake patrol." },
      e_pistol: { id: "e_pistol", kind: "evidence", cat: "means", title: "Modified sidearm", text: "Quarters locker: Quill's sidearm, silenced and re-chambered, the serial filed off. Her other standard-issue weapon is in the holster." },
      e_device: { id: "e_device", kind: "evidence", cat: "secret", title: "Chronometer log", text: "Chronometer: the loop was set at 20:50 under Quill's override. She is rehearsing the murder until it is perfect." },
    },
    evidence: ["e_orders", "e_ledger", "e_tamper", "e_pistol", "e_device"],
    hints: {
      e_orders: "Vance and Okafor talk in the Mess around 19:40 – 19:55. The Bridge safe needs a code, and the Commander must be away.",
      e_ledger: "Cargo is empty between about 19:50 and 20:10. Hack the crate then.",
      e_tamper: "The log server only opens when the scheduled power surge hits at 20:00. Be in Security then — Quill will be in her quarters.",
      e_pistol: "Quill's quarters are keycard-locked (Level 2 — try the Security duty desk). You also need Rook's lockpick set. Avoid the quarters while Quill is inside.",
      e_device: "The Lab is empty while Nyx works in Engineering (19:45 – 20:15), but its camera is live — wait for the 20:00 surge to blind it.",
    },
    statements: [
      { text: "I've served this crew for ten years. Nobody questions my loyalty.", truth: true, react: "…Good. Finally, someone sensible." },
      { text: "My sidearm has never left its holster.", truth: false, counter: "e_pistol", react: "You went through my locker?!" },
      { text: "The Commander and I had perfect trust. She'd never cut Security.", truth: false, counter: "e_orders", react: "She was going to bury me." },
      { text: "Smuggling? Idle rumor from bored engineers.", truth: false, counter: "e_ledger", react: "Those pages were burned! Burned!" },
      { text: "I was on patrol. The logs prove it. Every minute.", truth: false, counter: "e_tamper", react: "Nobody could have restored those logs…" },
      { text: "I'm exhausted. This whole interrogation is theatre.", truth: true, react: "Good. Now stop wasting my time." },
      { text: "Time? You think anyone could rewrite a day? You're delusional.", truth: false, counter: "e_device", react: "…Then how do you remember it? How do YOU remember it?!" },
    ],
  };
}

export const CASE_ORDER = ["c1", "c2", "c3"];
export const CASE_META = [
  { id: "c1", num: 1, title: "Last Orders", tagline: "A cup of coffee. A cup of something else." },
  { id: "c2", num: 2, title: "Cold Storage", tagline: "Power, pressure, and one very warm solder joint." },
  { id: "c3", num: 3, title: "Loop Zero", tagline: "The killer remembers, too." },
];

export const DIFFS = {
  easy: { name: "Apprentice", desc: "Slower clock, more loops, forgiving crew.", spm: 2.0, pool: 1.4, sus: 0.7, hp: 4, ins: 0.8 },
  normal: { name: "Investigator", desc: "The intended experience.", spm: 1.6, pool: 1, sus: 1, hp: 3, ins: 1 },
  hard: { name: "Chronomancer", desc: "Fast clock, few loops, sharp-eyed crew.", spm: 1.3, pool: 0.75, sus: 1.35, hp: 2, ins: 1.5 },
} as const;
export type DiffId = keyof typeof DIFFS;

export const MODS = [
  { id: "paranoid", name: "Paranoid Crew", desc: "+40% suspicion gain." },
  { id: "short", name: "Short Fuse", desc: "The clock runs 25% faster." },
  { id: "fragile", name: "Fragile Loop", desc: "3 fewer loops." },
];

export const UPGRADES = [
  { id: "stab", name: "Loop Stabilizer", desc: "+2 loops per case", max: 2, cost: [40, 90], icon: "⏳" },
  { id: "feet", name: "Soft Soles", desc: "−25% suspicion gain", max: 2, cost: [30, 70], icon: "👣" },
  { id: "legs", name: "Servo Legs", desc: "+12% walk speed", max: 2, cost: [25, 60], icon: "🦿" },
  { id: "pocket", name: "Chrono-Pocket", desc: "One item survives rewinds (pin it in the Journal)", max: 1, cost: [55], icon: "🧿" },
  { id: "pulse", name: "Sensor Pulse", desc: "[Q] Reveal everyone for 5s (25s cooldown)", max: 1, cost: [45], icon: "📡" },
  { id: "lie", name: "Lie Detector", desc: "Lies flicker during interrogations", max: 1, cost: [60], icon: "🫀" },
  { id: "nerve", name: "Steel Nerve", desc: "+1 composure in interrogations", max: 2, cost: [40, 85], icon: "🛡️" },
  { id: "rapport", name: "Memory Palace", desc: "Everyone starts at +1 trust", max: 1, cost: [35], icon: "🏛️" },
];
