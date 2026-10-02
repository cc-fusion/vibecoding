import type { Trait } from "./types";

export interface Theme {
  id: string;
  title: string;
  crime: string;
  blurb: string;
  victim: string;
  weapon: string;
  clock: string;
  scene: number;
  rooms: { name: string; kind: string }[];
  motives: { doc: string; line: string }[];
}

export const THEMES: Theme[] = [
  {
    id: "waltz",
    title: "The Last Waltz at Hollowmere",
    crime: "Murder",
    blurb: "Lord Aldric Hollowmere collapsed mid-waltz with a blade in his ribs. Re-walk the manor in your memory and find the killer among his guests.",
    victim: "Lord Aldric",
    weapon: "silver dagger",
    clock: "grandfather clock",
    scene: 0,
    rooms: [
      { name: "Grand Ballroom", kind: "hall" },
      { name: "Library", kind: "study" },
      { name: "Conservatory", kind: "garden" },
      { name: "Wine Cellar", kind: "cellar" },
      { name: "Master Bedroom", kind: "bedroom" },
    ],
    motives: [
      { doc: "A crumpled IOU", line: "I owe you more than I can ever repay" },
      { doc: "A scorched draft of the will", line: "He means to cut me out entirely" },
      { doc: "A threatening letter", line: "Your secret dies with you, Aldric" },
    ],
  },
  {
    id: "ruby",
    title: "The Crimson Ruby Vanishes",
    crime: "Theft",
    blurb: "The legendary Orlova Ruby left a locked vault with no alarm raised. Somebody on the guest list has it. Reconstruct the heist from memory.",
    victim: "Madame Orlova",
    weapon: "glass cutter",
    clock: "motion sensor",
    scene: 4,
    rooms: [
      { name: "Marble Gallery", kind: "hall" },
      { name: "Curator's Office", kind: "study" },
      { name: "Restoration Lab", kind: "workshop" },
      { name: "Sculpture Garden", kind: "garden" },
      { name: "Basement Vault", kind: "cellar" },
    ],
    motives: [
      { doc: "A pawnbroker's receipt", line: "The ruby will clear every debt I have" },
      { doc: "A forged appraisal", line: "Orlova must never learn what it is really worth" },
      { doc: "A torn auction flyer", line: "Mine at last, whatever the cost" },
    ],
  },
  {
    id: "gala",
    title: "Poison at the Embassy Gala",
    crime: "Poisoning",
    blurb: "Ambassador Voss raised a toast, then fell. The poison was in the glass. Dig through the embassy's memory and unmask the poisoner.",
    victim: "Ambassador Voss",
    weapon: "arsenic vial",
    clock: "mantel clock",
    scene: 1,
    rooms: [
      { name: "Embassy Hall", kind: "hall" },
      { name: "Grand Kitchen", kind: "workshop" },
      { name: "Wine Cellar", kind: "cellar" },
      { name: "Ambassador's Suite", kind: "bedroom" },
      { name: "Rose Terrace", kind: "garden" },
      { name: "Cipher Study", kind: "study" },
    ],
    motives: [
      { doc: "A coded cable", line: "Voss knows what we sold across the border" },
      { doc: "A rejected visa", line: "He ruined my family with one signature" },
      { doc: "A hidden ledger page", line: "Pay up, or I tell the Council everything" },
    ],
  },
  {
    id: "dome",
    title: "Sabotage at Hale Observatory",
    crime: "Sabotage",
    blurb: "Professor Hale's life work, the Great Lens, was shattered hours before its unveiling. Someone in the observatory staff did it. Find out who.",
    victim: "Professor Hale",
    weapon: "acid flask",
    clock: "sidereal clock",
    scene: 1,
    rooms: [
      { name: "Dome Gallery", kind: "hall" },
      { name: "Lens Workshop", kind: "workshop" },
      { name: "Star Archive", kind: "study" },
      { name: "Boiler Room", kind: "cellar" },
      { name: "Dormitory", kind: "bedroom" },
      { name: "Garden Terrace", kind: "garden" },
    ],
    motives: [
      { doc: "A stolen research notebook", line: "Hale will take credit for my discovery again" },
      { doc: "A dismissal notice", line: "He fired me, and he'll regret the Lens" },
      { doc: "A rival's offer letter", line: "Destroy the Lens and the funding is yours" },
    ],
  },
  {
    id: "maestro",
    title: "The Silent Maestro",
    crime: "Kidnapping",
    blurb: "Maestro Lorenz never took the podium. The Opera House is locked from inside, and someone among the troupe has hidden him. Retrace the night.",
    victim: "Maestro Lorenz",
    weapon: "chloroform rag",
    clock: "metronome",
    scene: 4,
    rooms: [
      { name: "Concert Hall", kind: "hall" },
      { name: "Green Room", kind: "bedroom" },
      { name: "Score Library", kind: "study" },
      { name: "Instrument Workshop", kind: "workshop" },
      { name: "Under-Stage", kind: "cellar" },
      { name: "Courtyard", kind: "garden" },
    ],
    motives: [
      { doc: "A cut solo part", line: "He stole my solo, I'll steal his night" },
      { doc: "A ransom draft", line: "Fifty thousand, small bills, no police" },
      { doc: "A jealous diary page", line: "If I can't have the stage, nobody will" },
    ],
  },
  {
    id: "architect",
    title: "The Architect's Last Room",
    crime: "Murder (Capstone)",
    blurb: "Your mentor Ilya Penrose built the Mind Palace, and now he is dead. A phantom called the Architect guards the Locked Study. The killer is a master liar. This is the final case.",
    victim: "Ilya Penrose",
    weapon: "obsidian key",
    clock: "memory clock",
    scene: 1,
    rooms: [
      { name: "Mirror Hall", kind: "hall" },
      { name: "The Locked Study", kind: "study" },
      { name: "Cloister Garden", kind: "garden" },
      { name: "Archive Crypt", kind: "cellar" },
      { name: "Dreamer's Chamber", kind: "bedroom" },
      { name: "Clockwork Forge", kind: "workshop" },
    ],
    motives: [
      { doc: "A page of the Palace blueprints", line: "He built the maze, and I will own its heart" },
      { doc: "A blackmail draft", line: "Everything you hid is in my hands, Ilya" },
      { doc: "A forged will", line: "The Palace, the legacy, all mine" },
    ],
  },
];

export const TUTORIAL_THEME: Theme = {
  id: "tea",
  title: "Case Zero: The Poisoned Teacup",
  crime: "Training Case",
  blurb: "Aunt Margery's tea was tampered with. A gentle first case to learn the ropes of your Mind Palace. Follow the guidance on screen.",
  victim: "Aunt Margery",
  weapon: "tea tin",
  clock: "carriage clock",
  scene: 0,
  rooms: [
    { name: "Tea Room", kind: "hall" },
    { name: "Little Study", kind: "study" },
  ],
  motives: [{ doc: "A scribbled note", line: "Margery's tea will settle everything" }],
};

export const OBJECT_POOL: Record<string, { emoji: string; name: string }[]> = {
  study: [
    { emoji: "📚", name: "Bookshelf" }, { emoji: "🖋️", name: "Writing Desk" }, { emoji: "🕰️", name: "Mantel Clock" },
    { emoji: "🗄️", name: "Filing Cabinet" }, { emoji: "🔥", name: "Fireplace" }, { emoji: "🧳", name: "Old Trunk" }, { emoji: "🪞", name: "Mirror" },
  ],
  hall: [
    { emoji: "🖼️", name: "Portrait" }, { emoji: "🏺", name: "Vase" }, { emoji: "🪑", name: "Armchair" },
    { emoji: "🎹", name: "Piano" }, { emoji: "🕯️", name: "Candelabra" }, { emoji: "🧥", name: "Coat Rack" }, { emoji: "🗝️", name: "Key Cabinet" },
  ],
  garden: [
    { emoji: "🌹", name: "Rose Bed" }, { emoji: "⛲", name: "Fountain" }, { emoji: "🪴", name: "Planter" },
    { emoji: "🪵", name: "Bench" }, { emoji: "🧰", name: "Tool Shed" }, { emoji: "🗿", name: "Statue" }, { emoji: "🐦", name: "Birdbath" },
  ],
  cellar: [
    { emoji: "🍷", name: "Wine Rack" }, { emoji: "🛢️", name: "Barrel" }, { emoji: "📦", name: "Crate" },
    { emoji: "🪜", name: "Ladder" }, { emoji: "🕸️", name: "Cobwebs" }, { emoji: "⚙️", name: "Boiler" }, { emoji: "🧪", name: "Jar Shelf" },
  ],
  bedroom: [
    { emoji: "🛏️", name: "Bed" }, { emoji: "👗", name: "Wardrobe" }, { emoji: "💄", name: "Vanity" },
    { emoji: "🎁", name: "Jewelry Box" }, { emoji: "✉️", name: "Letter Tray" }, { emoji: "🪟", name: "Window Seat" }, { emoji: "🧺", name: "Laundry Hamper" },
  ],
  workshop: [
    { emoji: "🔧", name: "Workbench" }, { emoji: "🧲", name: "Tool Wall" }, { emoji: "🔬", name: "Microscope" },
    { emoji: "🧯", name: "Locker" }, { emoji: "⚗️", name: "Retort Stand" }, { emoji: "🧵", name: "Spool Rack" }, { emoji: "🗜️", name: "Vise" },
  ],
};

export const NAMES = [
  "Rhea Vance", "Cormac Dray", "Isolde Marsh", "Tobias Quill", "Marguerite Fox", "Anselm Roe",
  "Priya Lowe", "Dmitri Kask", "Odette Brandt", "Felix Harrow", "Wren Ashby", "Lucian Pike",
];
export const JOBS = ["Butler", "Heiress", "Chemist", "Reporter", "Gardener", "Surgeon", "Violinist", "Banker", "Curator", "Pilot", "Cook", "Lawyer"];
export const FACES = ["🤵", "👩‍🎤", "🧑‍🔬", "🧑‍💼", "🧑‍🌾", "👩‍⚕️", "🧑‍🍳", "👩‍⚖️", "🧑‍✈️", "🧓", "👨‍🎨", "👸"];
export const SIGS = ["green scarf", "brass monocle", "silver watch", "ivory cane", "jade ring", "crimson glove", "bone pen"];
export const INJURIES = ["splinted wrist", "bandaged hand", "sprained arm", "trembling palsy", "cast on the arm", "bruised shoulder"];
export const ALIBIS = ["stub 14B", "pass 77", "token 3C", "ticket 52", "chit 9F", "slip 28D"];
export const TIMES = ["9:15", "9:40", "10:05", "10:30", "11:20", "11:45", "12:10"];
export const TRAITS: Trait[] = ["nervous", "stoic", "charming", "arrogant", "evasive"];

export const TRAIT_INFO: Record<Trait, { label: string; tip: string; lie: number; fake: number; patience: number }> = {
  nervous: { label: "Nervous", tip: "Tells show often, even when honest. Short patience.", lie: 0.9, fake: 0.35, patience: 4 },
  stoic: { label: "Stoic", tip: "Rarely shows tells. Pay attention to the little ones.", lie: 0.35, fake: 0.04, patience: 6 },
  charming: { label: "Charming", tip: "Tells are unreliable. Fake tells are common.", lie: 0.55, fake: 0.32, patience: 5 },
  arrogant: { label: "Arrogant", tip: "Long patience, but wrong evidence costs double.", lie: 0.6, fake: 0.1, patience: 6 },
  evasive: { label: "Evasive", tip: "The first Press always gets deflected.", lie: 0.6, fake: 0.15, patience: 5 },
};

export const TELLS = ["👀 eyes dart away", "💧 a bead of sweat", "😬 a tight, forced smile", "🫢 bites a lip", "🤏 fidgets with a cuff", "😮‍💨 a shaky breath"];

export const DECOYS: { key: string; a: string; b: string }[] = [
  { key: "blue ribbon", a: "A frayed blue ribbon is caught on a nail, long forgotten.", b: "Someone once tied a blue ribbon around a gift here. It means nothing." },
  { key: "pastry", a: "A half-eaten pastry sits on a saucer, stale as a rumor.", b: "Crumbs of pastry trail toward a mouse hole." },
  { key: "pressed violet", a: "A pressed violet marks a page in a dull book.", b: "A vase holds one withered violet, long dead." },
  { key: "cat hair", a: "Orange cat hair coats a cushion.", b: "More cat hair, and a faint purr in the memory." },
  { key: "lamp oil", a: "A spilled stain of lamp oil, cleaned weeks ago.", b: "The smell of lamp oil lingers in the curtains." },
];

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  max: number;
  base: number;
  desc: (lvl: number) => string;
}

export const UPGRADES: UpgradeDef[] = [
  { id: "focus", name: "Iron Focus", icon: "🧠", max: 5, base: 25, desc: (l) => `+${l * 12} max Focus` },
  { id: "regen", name: "Deep Breaths", icon: "🌬️", max: 4, base: 30, desc: (l) => `+${(l * 0.6).toFixed(1)} Focus regen/sec` },
  { id: "nerves", name: "Steady Nerves", icon: "🛡️", max: 5, base: 28, desc: (l) => `-${l * 10}% sanity damage` },
  { id: "anchor", name: "Memory Anchor", icon: "⚓", max: 4, base: 32, desc: (l) => `-${l * 12}% memory decay` },
  { id: "lie", name: "Lie Sense", icon: "🫀", max: 4, base: 35, desc: (l) => `Tells more reliable (+${l * 8}% / -${l * 5}% false)` },
  { id: "tongue", name: "Silver Tongue", icon: "🗣️", max: 2, base: 45, desc: (l) => `+${l} suspect patience` },
  { id: "assoc", name: "Associative Mind", icon: "🔗", max: 1, base: 60, desc: () => "Board glows clues sharing a keyword with your selection" },
  { id: "feet", name: "Fleet Foot", icon: "👟", max: 3, base: 26, desc: (l) => `+${l * 7}% move speed` },
  { id: "intuit", name: "Intuition", icon: "💡", max: 3, base: 40, desc: (l) => `${l} Hint charge(s) per case (H)` },
  { id: "pulse", name: "Lucid Pulse", icon: "🔔", max: 4, base: 34, desc: (l) => `Pulse costs -${l * 3} Focus, radius +${l * 15}` },
];

export const DIFFS = [
  { name: "Apprentice", dawn: 780, regen: 1.25, enemy: 0.6, decay: 0.7, score: 1, patience: 1, desc: "Forgiving memories, slower night." },
  { name: "Detective", dawn: 600, regen: 1, enemy: 1, decay: 1, score: 1.25, patience: 0, desc: "The intended experience." },
  { name: "Inspector", dawn: 460, regen: 0.8, enemy: 1.4, decay: 1.4, score: 1.6, patience: -1, desc: "Dawn comes fast; the mind frays." },
];

export const MODS = [
  { id: "hazy", name: "Hazy Memory", icon: "🌫️", desc: "Rooms fade 60% faster.", score: 0.2 },
  { id: "liar", name: "Practiced Liars", icon: "🎭", desc: "Tells are 40% less reliable.", score: 0.25 },
  { id: "insomnia", name: "Insomnia", icon: "🌙", desc: "Focus regenerates at half rate.", score: 0.25 },
  { id: "nightmares", name: "Nightmares", icon: "👹", desc: "60% more intrusions.", score: 0.25 },
] as const;

export const RANKS = ["Rookie Sleuth", "Street Inspector", "Chief Examiner", "Master of Memory", "Palace Architect"];
