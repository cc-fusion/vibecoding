import type { Game } from "./engine";
import { RELICS } from "./data";
import type { RelicId, Tile } from "./types";

export interface EventChoice {
  label: string;
  hint?: string;
  disabled?: (g: Game) => string | null;
  run: (g: Game) => string;
}
export interface EventDef {
  id: string;
  title: string;
  emoji: string;
  text: string;
  minTier?: number;
  choices: EventChoice[];
}
export interface LmAction {
  label: string;
  hint?: string;
  disabled?: string | null;
  run: () => string;
}

const needGold = (n: number) => (g: Game) => (g.gold < g.price(n) ? `Needs ${g.price(n)} gold` : g.tradeBlocked() ? "The Concord refuses you" : null);
const rr = (g: Game, a: number, b: number) => a + Math.floor(g.rng() * (b - a + 1));

export const EVENTS: EventDef[] = [
  {
    id: "camp", title: "Abandoned Camp", emoji: "🏕️",
    text: "A cold fire, torn tents, and a half-finished map pinned beneath a stone. Whoever lived here left in a hurry.",
    choices: [
      {
        label: "Search the tents", hint: "Supplies or a snare",
        run: (g) => {
          if (g.rng() < 0.65) { const s = rr(g, 3, 5); g.gain("supplies", s); g.gain("gold", rr(g, 3, 8)); return "You find rations and a few coins."; }
          g.gain("vigor", -4); return "A snare snaps shut on your ankle. You free yourself, bleeding.";
        },
      },
      { label: "Salvage the cartographic tools", hint: "+3 ink", run: (g) => { g.gain("ink", 3); return "Dried but usable pigments. Your inkwell is a little fuller."; } },
      { label: "Leave it be", run: () => "You respect the dead and walk on." },
    ],
  },
  {
    id: "traveller", title: "Wounded Traveller", emoji: "🩹",
    text: "A traveller sits against a boulder, clutching a bleeding side. They look at you with polite desperation.",
    choices: [
      {
        label: "Share a ration and bandage them", hint: "−2 supplies, reputation", disabled: (g) => (g.supplies < 2 ? "Needs 2 supplies" : null),
        run: (g) => {
          g.gain("supplies", -2);
          const f = g.rng() < 0.5 ? "wardens" : "hollow";
          g.addRep(f, 7);
          let out = `They bless you in the name of the ${f === "wardens" ? "Wardens" : "Hollow Folk"}.`;
          if (g.rng() < 0.5) out += " " + g.giveRumor();
          return out;
        },
      },
      { label: "Rob them", hint: "+gold, −sanity, −reputation", run: (g) => { g.gain("gold", 12); g.gain("sanity", -5); g.addRep("wardens", -4); return "Their purse is light, and so is your conscience, a little less each step."; } },
      { label: "Walk on", hint: "−2 sanity", run: (g) => { g.gain("sanity", -2); return "You do not look back. You hear them breathing for a long time."; } },
    ],
  },
  {
    id: "stones", title: "Whispering Stones", emoji: "🪨",
    text: "A ring of knee-high stones hums softly. Their carved faces seem to mouth directions in a language older than roads.",
    choices: [
      { label: "Listen closely", hint: "−8 sanity, +4 ink, chart radius 2", run: (g) => { g.gain("sanity", -8); g.gain("ink", 4); const n = g.chartArea(g.p, 2); return `The stones whisper a landscape. ${n} tiles are drawn into your map.`; } },
      { label: "Press a palm to the stone", hint: "−3 vigor, rumor", run: (g) => { g.gain("vigor", -3); return g.giveRumor(); } },
      { label: "Walk away", run: () => "Some voices are better unheard." },
    ],
  },
  {
    id: "caravan", title: "Concord Caravan", emoji: "🐫",
    text: "A train of lantern-hung wagons rolls to a halt. A factor in gilded gloves bows. 'Maps, friend? Provisions? Everything has a price.'",
    choices: [
      { label: "Buy provisions (+6 supplies)", hint: "7 gold, scaled by Concord favor", disabled: needGold(7), run: (g) => { g.gain("gold", -g.price(7)); g.gain("supplies", 6); return "A fair deal, sealed with a silver nod."; } },
      { label: "Sell a copy of your map", hint: "Gold for charted tiles", disabled: (g) => (g.tradeBlocked() ? "The Concord refuses you" : null), run: (g) => { const v = Math.max(3, Math.floor(g.sellValue() * 0.6)); g.gain("gold", v); g.addRep("concord", 4); return `They pay ${v} gold for a fair copy. Their clerks begin to draw.`; } },
      { label: "Decline politely", run: () => "The caravan rolls on without a word." },
    ],
  },
  {
    id: "elder", title: "Hollow Elder", emoji: "🧓",
    text: "An old walker with a staff of woven grass blocks the trail. 'Show me your map,' she says. 'I would like to see what you have done to the land.'",
    choices: [
      { label: "Offer a copy of your map", hint: "−3 ink, Hollow +10, chart radius 2", disabled: (g) => (g.ink < 3 ? "Needs 3 ink" : null), run: (g) => { g.gain("ink", -3); g.addRep("hollow", 10); const n = g.chartArea(g.p, 2); return `She smiles and shows you the old way. ${n} tiles are revealed.`; } },
      { label: "Ask for the old road", hint: "Needs Hollow 20; chart radius 3", disabled: (g) => (g.rep.hollow < 20 ? "Needs Hollow reputation 20" : null), run: (g) => { const n = g.chartArea(g.p, 3); g.addRep("hollow", 2); return `She walks you to a ridge and points. ${n} tiles fall into place.`; } },
      { label: "Bow and move on", run: (g) => { g.addRep("hollow", 1); return "She nods. Silence is also a kind of courtesy."; } },
    ],
  },
  {
    id: "surveyor", title: "Fallen Warden Surveyor", emoji: "🧑‍✈️",
    text: "The brass-buttoned coat of a Warden lies over a skeleton, a theodolite still tilted toward the horizon.",
    choices: [
      { label: "Take the field notes", hint: "Rumor, +2 ink, Wardens +3", run: (g) => { g.gain("ink", 2); g.addRep("wardens", 3); return g.giveRumor(); } },
      { label: "Bury them properly", hint: "+2 time, Wardens +8, +4 sanity", run: (g) => { g.advance(2); g.addRep("wardens", 8); g.gain("sanity", 4); return "You pile stones in a neat cairn and mark it on the map, as they would have wanted."; } },
      { label: "Take the quill", hint: "+5 ink, −3 Wardens", run: (g) => { g.gain("ink", 5); g.addRep("wardens", -3); return "A good quill. The dead hold no grudges, only maps."; } },
    ],
  },
  {
    id: "hymn", title: "Hymn of the Blank Page", emoji: "🎶",
    text: "Pale singers kneel in a circle, voices weaving a chord so pure it hurts. They do not seem to see you, but they leave a space in the ring.",
    minTier: 1,
    choices: [
      { label: "Join the hymn", hint: "+15 sanity, Choir +10, Wardens −4", run: (g) => { g.gain("sanity", 15); g.addRep("choir", 10); return "For a moment, the map feels like a wound, and the hymn feels like a bandage."; } },
      { label: "Transcribe the hymn", hint: "−5 sanity, +3 ink", run: (g) => { g.gain("sanity", -5); g.gain("ink", 3); return "The notes stain your fingers black. The ink is stronger for it."; } },
      { label: "Cover your ears and flee", hint: "−2 sanity", run: (g) => { g.gain("sanity", -2); return "The chord follows you for an hour."; } },
    ],
  },
  {
    id: "blackspring", title: "The Black Spring", emoji: "🫗",
    text: "A bubbling pool of ink-dark water. It sings faintly, and every bubble rings like a quill tapping on glass.",
    choices: [
      { label: "Fill your inkwell", hint: "+8 ink, −6 sanity", run: (g) => { g.gain("ink", 8); g.gain("sanity", -6); return "The ink is cold and eager. It writes on its own."; } },
      { label: "Drink deeply", hint: "+8 vigor, risk of madness", run: (g) => { g.gain("vigor", 8); if (g.rng() < 0.4) { g.gain("sanity", -10); return "Strength floods you, but the spring sings in your bones."; } return "It tastes like wet slate, and it heals."; } },
      { label: "Leave it", run: () => "You step back from the pool. It sighs." },
    ],
  },
  {
    id: "doppel", title: "The Other Mapper", emoji: "🪞",
    text: "A figure in your coat sits on a stump, drawing the very landscape you stand in. Their face is a smudge of ink. They look up and offer you their map.",
    minTier: 1,
    choices: [
      {
        label: "Trade maps", hint: "50%: chart radius 3. 50%: false lines",
        run: (g) => {
          if (g.rng() < 0.5) { const n = g.chartArea(g.p, 3); return `Their lines are true. ${n} tiles join your map.`; }
          g.gain("sanity", -8);
          const n = g.corruptSeen(7);
          return `Their lines are lies. ${n} glimpsed tiles in your map now show the wrong terrain. Chart them to correct them.`;
        },
      },
      { label: "Attack the impostor", hint: "Fight, relic reward", run: (g) => { g.startCombat("wraith", { tile: g.curTile(), onWin: (gg) => { const r = gg.giveRelic(); return r ? `Their satchel holds ${r.name}.` : "Their satchel is empty."; } }); return ""; } },
      { label: "Look away", hint: "−3 sanity", run: (g) => { g.gain("sanity", -3); return "You hear a quill scratching, and scratching, and scratching."; } },
    ],
  },
  {
    id: "toll", title: "The Toll Keeper", emoji: "🌉",
    text: "A rope bridge. A tall figure in a Concord sash holds a ledger. 'Toll's eight. Or you could try the river.'",
    choices: [
      { label: "Pay the toll", hint: "8 gold, Concord +3", disabled: needGold(8), run: (g) => { g.gain("gold", -g.price(8)); g.addRep("concord", 3); return "She stamps your map with a golden seal."; } },
      { label: "Argue", hint: "50% pass free, 50% brawl", run: (g) => { if (g.rng() < 0.5) { g.addRep("concord", -2); return "She sighs and waves you through. 'Just this once.'"; } g.startCombat("bandit", { tile: g.curTile(), intro: "She whistles. Her friends step out of the reeds." }); return ""; } },
      { label: "Force the bridge", hint: "Fight, you strike first", run: (g) => { g.addRep("concord", -4); g.startCombat("bandit", { tile: g.curTile(), firstStrike: true, intro: "You shove past! The keeper draws steel." }); return ""; } },
    ],
  },
  {
    id: "corpse", title: "The Previous Cartographer", emoji: "💀",
    text: "A skeleton leans against a tree, still holding a quill. Its journal lies open to a page that reads only: 'DO NOT DRAW THE SPIRE.'",
    minTier: 1,
    choices: [
      { label: "Read the journal", hint: "Lore page, −4 sanity", run: (g) => { g.gain("sanity", -4); return g.giveLore(); } },
      { label: "Take the pack", hint: "Relic, +3 supplies, −6 sanity", run: (g) => { g.gain("sanity", -6); g.gain("supplies", 3); const r = g.giveRelic(); return r ? `Inside, you find ${r.name}.` : "A few coins at the bottom."; } },
      { label: "Take the map", hint: "Chart radius 3, −3 sanity", run: (g) => { g.gain("sanity", -3); const n = g.chartArea(g.p, 3); return `Their dying chart reveals ${n} tiles.`; } },
    ],
  },
  {
    id: "starfall", title: "Starfall", emoji: "☄️",
    text: "A star scratches a white line across the sky and comes down in the distance with a sound like a closing book.",
    choices: [
      { label: "Make a wish", hint: "A gamble", run: (g) => { const r = g.rng(); if (r < 0.2) { const rel = g.giveRelic(); return rel ? `The star drops ${rel.name} at your feet.` : "Gold rains down."; } if (r < 0.7) { g.gain("sanity", 12); return "Peace falls over you like warm snow."; } g.gain("sanity", -6); return "The star winks out. Something else was listening."; } },
      { label: "Chart the constellations", hint: "+3 ink, +5 sanity", run: (g) => { g.gain("ink", 3); g.gain("sanity", 5); return "You sketch the sky, and the sky obligingly holds still."; } },
    ],
  },
  {
    id: "glade", title: "Quiet Glade", emoji: "🌿",
    text: "A hollow of soft grass, wind in the leaves, the unlikely sound of a bird. For a moment, the world remembers kindness.",
    choices: [
      { label: "Rest a while", hint: "+6 vigor, +8 sanity, +2 time", run: (g) => { g.gain("vigor", 6); g.gain("sanity", 8); g.advance(2); return "You sleep without dreaming."; } },
      { label: "Forage", hint: "+3 supplies", run: (g) => { g.gain("supplies", 3); return "Wild berries and something like thyme."; } },
      { label: "Press on", run: () => "You do not trust quiet places." },
    ],
  },
  {
    id: "peddler", title: "Peddler of Odd Things", emoji: "🎒",
    text: "A bent figure under a mountain of satchels. 'Trinkets, wayfarer. Each one has saved a life and ended another.'",
    choices: [
      { label: "Buy a mystery relic", hint: "40 gold", disabled: needGold(40), run: (g) => { g.gain("gold", -g.price(40)); const r = g.giveRelic(); return r ? `You receive ${r.emoji} ${r.name}: ${r.desc}` : "Nothing but gold in the satchel."; } },
      { label: "Haggle", hint: "Needs Concord 15; 25 gold", disabled: (g) => (g.rep.concord < 15 ? "Needs Concord reputation 15" : g.gold < 25 ? "Needs 25 gold" : null), run: (g) => { g.gain("gold", -25); const r = g.giveRelic(); return r ? `You receive ${r.emoji} ${r.name}: ${r.desc}` : "Nothing but gold in the satchel."; } },
      { label: "No thanks", run: () => "'Pity,' says the peddler, and is gone." },
    ],
  },
  {
    id: "pilgrims", title: "Pilgrims of the Margin", emoji: "🚶",
    text: "A column of grey-robed pilgrims shuffles past, each blindfolded and holding the shoulder of the one in front. The leader asks if you would like to walk with them.",
    minTier: 1,
    choices: [
      { label: "Walk with them for a while", hint: "+10 sanity, Choir +4, +2 time", run: (g) => { g.gain("sanity", 10); g.addRep("choir", 4); g.advance(2); return "The rhythm of their steps empties your head."; } },
      { label: "Ask what they seek", hint: "Rumor", run: (g) => g.giveRumor() },
      { label: "Warn them about the Unwriting", hint: "Wardens +5", run: (g) => { g.addRep("wardens", 5); return "'We know,' says the leader. 'That is where we are going.'"; } },
    ],
  },
];

// ---------------- landmark actions ----------------
const once = (t: Tile, k: string) => !!t.ls[k];
const mark = (t: Tile, k: string) => { t.ls[k] = 1; };
const usedMsg = "Already done here.";

export function landmarkActions(g: Game, t: Tile): LmAction[] {
  const f = t.feature;
  if (!f || f.kind !== "landmark") return [];
  const A: LmAction[] = [];
  const buy = (label: string, base: number, run: () => string) => {
    const p = g.price(base);
    A.push({
      label: `${label}`, hint: `${p} gold`,
      disabled: g.tradeBlocked() ? "The Concord refuses you" : g.gold < p ? "Not enough gold" : null,
      run: () => { g.gain("gold", -p); return run(); },
    });
  };
  const oneShot = (label: string, hint: string, key: string, run: () => string, extra?: () => string | null) => {
    A.push({ label, hint, disabled: once(t, key) ? usedMsg : extra ? extra() : null, run: () => { mark(t, key); return run(); } });
  };
  switch (f.id) {
    case "outpost":
      buy("Buy supplies (+5)", 5, () => { g.gain("supplies", 5); return "A crate of dried fruit and hardtack."; });
      buy("Buy a tonic", 12, () => { g.gain("tonics", 1); return "A stoppered bottle of bitter green liquid."; });
      oneShot("Take the Warden's briefing", "Rumor of a Sigil", "brief", () => { g.addRep("wardens", 2); return g.giveRumor(); });
      oneShot("Rest by the lamp", "+6 vigor, +10 sanity, +2 time", "rest", () => { g.gain("vigor", 6); g.gain("sanity", 10); g.advance(2); return "You sleep a little. The lamp flickers toward the north-east."; });
      break;
    case "village": {
      const hp = (b: number) => Math.max(1, Math.ceil(b * (1 - g.rep.hollow / 300)));
      oneShot("Rest by the fire", "+8 vigor, +12 sanity, +3 time", "rest", () => { g.gain("vigor", 8); g.gain("sanity", 12); g.advance(3); g.addRep("hollow", 1); return "Strangers pass you bowls of something hot and smoky."; });
      A.push({
        label: "Trade for supplies (+4)", hint: `${hp(5)} gold`, disabled: g.gold < hp(5) ? "Not enough gold" : null,
        run: () => { g.gain("gold", -hp(5)); g.gain("supplies", 4); return "Dried meat and flatbread, wrapped in a leaf."; },
      });
      A.push({
        label: "Share your map", hint: "−3 ink, Hollow +8", disabled: g.ink < 3 ? "Needs 3 ink" : null,
        run: () => { g.gain("ink", -3); g.addRep("hollow", 8); return "They study your lines with a gentle, unreadable amusement."; },
      });
      oneShot("Hire a guide", "12 gold, chart radius 2", "guide", () => { g.gain("gold", -12); const n = g.chartArea(g.p, 2); g.addRep("hollow", 1); return `Their guide draws in the dirt. ${n} tiles join your map.`; }, () => (g.gold < 12 ? "Needs 12 gold" : null));
      oneShot("Accept the Elder's gift", "Needs Hollow 30; relic", "gift", () => { const r = g.giveRelic(); return r ? `You receive ${r.emoji} ${r.name}.` : "They give you what coin they can."; }, () => (g.rep.hollow < 30 ? "Needs Hollow reputation 30" : null));
      break;
    }
    case "market": {
      buy("Supplies (+4)", 6, () => { g.gain("supplies", 4); return "A fine bundle."; });
      buy("Ink vials (+3)", 7, () => { g.gain("ink", 3); return "Three vials of black gall ink."; });
      buy("Tonic (+12 vigor)", 14, () => { g.gain("tonics", 1); return "Bitter, effective."; });
      buy("Laudanum (+20 sanity)", 14, () => { g.gain("laud", 1); return "A small blue bottle. 'For the whispers,' the vendor says."; });
      const keys = Object.keys(RELICS) as RelicId[];
      const offer = keys[(t.ls.offer ?? 0) % keys.length];
      const rp = g.price(55);
      A.push({
        label: `Curio: ${RELICS[offer].emoji} ${RELICS[offer].name}`, hint: `${rp} gold. ${RELICS[offer].desc}`,
        disabled: once(t, "curio") ? "Sold" : g.tradeBlocked() ? "The Concord refuses you" : g.gold < rp ? "Not enough gold" : null,
        run: () => { mark(t, "curio"); g.gain("gold", -rp); g.giveRelic(offer); return `You acquire ${RELICS[offer].name}.`; },
      });
      oneShot("Sell a copy of your map", `Earns ~${g.sellValue()} gold`, "sell", () => { const v = g.sellValue(); g.gain("gold", v); g.addRep("concord", 4); return `Clerks copy your chart in a heartbeat. They pay ${v} gold.`; }, () => (g.tradeBlocked() ? "The Concord refuses you" : null));
      break;
    }
    case "shrine":
      oneShot("Pray among the candles", "+20 sanity, Choir +4", "pray", () => { g.gain("sanity", 20); g.addRep("choir", 4); return "The candles lean toward you. Your thoughts go quiet and white."; });
      oneShot("Sing with the Choir", "−8 sanity, +5 ink, Choir +10", "sing", () => { g.gain("sanity", -8); g.gain("ink", 5); g.addRep("choir", 10); return "Your voice cracks, and then it joins."; });
      oneShot("Accept the Whisper", "Needs Choir 10. Relic, −8 max sanity", "whisper", () => { g.maxSanity -= 8; g.sanity = Math.min(g.sanity, g.maxSanity); const r = g.giveRelic(); return r ? `The Whisper gives you ${r.emoji} ${r.name}. Something of you is gone.` : "The Whisper gives you only gold."; }, () => (g.rep.choir < 10 ? "Needs Choir reputation 10" : null));
      break;
    case "tower":
      oneShot("Climb the tower", "Chart radius 3, Wardens +3", "climb", () => { const n = g.chartArea(g.p, 3); g.addRep("wardens", 3); return `From the top, the lens shows ${n} new tiles.`; }, () => (g.rep.wardens < -30 ? "The Wardens bar the gates" : null));
      oneShot("Request a rumor", "Needs Wardens 5", "rumor", () => g.giveRumor(), () => (g.rep.wardens < 5 ? "Needs Warden reputation 5" : null));
      oneShot("Donate your survey", "Wardens +, a little gold", "donate", () => { const r = 4 + Math.floor(g.pct() / 4); g.addRep("wardens", r); const v = Math.floor(g.sellValue() / 3); g.gain("gold", v); return `The Wardens catalogue your work. +${v} gold.`; }, () => (g.rep.wardens < -30 ? "The Wardens bar the gates" : null));
      oneShot("Train with the garrison", "15 gold, +1 strike damage", "train", () => { g.gain("gold", -15); g.bonusDmg++; return "A drill-sergeant corrects your stance until it hurts."; }, () => (g.gold < 15 ? "Needs 15 gold" : g.rep.wardens < -30 ? "The Wardens bar the gates" : null));
      break;
    case "library":
      oneShot("Read the stacks", "Lore page, rumor, +4 ink, −5 sanity", "read", () => { g.gain("sanity", -5); g.gain("ink", 4); return g.giveLore() + " " + g.giveRumor(); });
      oneShot("Take a forbidden volume", "Relic, −10 sanity", "take", () => { g.gain("sanity", -10); const r = g.giveRelic(); return r ? `Behind a false shelf you find ${r.emoji} ${r.name}.` : "Behind a false shelf: gold, dust, regret."; });
      break;
    case "spring":
      oneShot("Drink and rest", "Full vigor, +10 sanity, +3 supplies", "drink", () => { g.gain("vigor", 99); g.gain("sanity", 10); g.gain("supplies", 3); return "Cold, bright water. You feel unwritten in the best way."; });
      oneShot("Rinse the ink from your hands", "+15 sanity, −3 ink", "rinse", () => { g.gain("sanity", 15); g.gain("ink", -3); return "The ink runs black from your fingers. Your thoughts clear."; }, () => (g.ink < 3 ? "Needs 3 ink" : null));
      break;
    case "obelisk":
      oneShot("Touch the obelisk", "Chart radius 4, +2 ink, −10 sanity", "touch", () => { g.gain("sanity", -10); g.gain("ink", 2); const n = g.chartArea(g.p, 4); return `The stone shows you a map of here. ${n} tiles are charted.`; });
      oneShot("Take a rubbing", "Lore page, −3 sanity", "rub", () => { g.gain("sanity", -3); return g.giveLore(); });
      break;
    case "cave":
      oneShot("Explore the cave", "Treasure, danger, or madness", "explore", () => {
        const r = g.rng();
        if (r < 0.3) { const rel = g.giveRelic(); return rel ? `Among bones, you find ${rel.emoji} ${rel.name}.` : "Among bones, only dust."; }
        if (r < 0.58) { g.startCombat(g.pickEnemy(t, false), { tile: t, intro: "Something in the dark did not want visitors." }); return ""; }
        if (r < 0.82) { g.gain("gold", rr(g, 12, 26)); g.gain("supplies", 3); return "A smuggler's stash, long forgotten."; }
        g.gain("sanity", -8); g.gain("ink", 3); return "Glyphs crawl across the walls. You copy them without understanding.";
      });
      break;
    case "sigil": {
      const idx = t.ls.idx ?? 0;
      const guard = (["golem", "acolyte", "wraith"] as const)[idx % 3];
      if (!t.ls.guard) {
        A.push({
          label: "Wake the Guardian", hint: `A ${guard === "golem" ? "stone golem" : guard === "acolyte" ? "choir acolyte" : "hollow wraith"} sleeps here`,
          run: () => {
            g.startCombat(guard, { tile: t, intro: "The altar stones shudder. The guardian rises.", onWin: () => { t.ls.guard = 1; return "The altar is unguarded."; } });
            return "";
          },
        });
      } else {
        oneShot("Claim the Sigil", "Required to open the Spire", "claimed", () => {
          g.sigils++;
          g.gain("sanity", 8);
          g.gain("gold", 10);
          g.rumors = g.rumors.filter((r) => r.sigil !== idx);
          g.banner = { id: g.uid++, text: `Sigil ${g.sigils} / 3`, sub: g.sigils >= 3 ? "The Spire's gate trembles. Go." : "One fewer lock on the Spire.", t: 3.2 };
          g.fx.addShake(8);
          return `You lift the sigil from its altar. It is warm. (${g.sigils}/3)`;
        });
      }
      oneShot("Study the altar", "Rumor of another Sigil", "study", () => g.giveRumor());
      break;
    }
    case "spire":
      A.push({
        label: "Present the three Sigils", hint: g.sigils >= 3 ? "Begin the final confrontation" : `Sealed (${g.sigils}/3 Sigils)`,
        disabled: g.sigils >= 3 ? null : `Sealed. ${3 - g.sigils} Sigil${3 - g.sigils === 1 ? "" : "s"} missing`,
        run: () => { g.startBoss(); return ""; },
      });
      A.push({
        label: "Ask the Choir to open the gate", hint: "Needs Choir 50, no Sigils required",
        disabled: g.rep.choir >= 50 ? null : "Needs Choir reputation 50",
        run: () => { g.startBoss(); return ""; },
      });
      break;
  }
  return A;
}
