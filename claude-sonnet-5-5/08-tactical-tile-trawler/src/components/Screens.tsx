import { CAPTAINS, CHARTS, relicById } from "../game/data";
import type { Game } from "../game/types";
import { ShipSprite } from "./Sprites";

const waveA = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='80'><path d='M0 40 Q100 0 200 40 T400 40 V80 H0Z' fill='rgba(22,95,150,0.45)'/></svg>"
)}")`;
const waveB = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='80'><path d='M0 40 Q75 10 150 40 T300 40 V80 H0Z' fill='rgba(10,60,100,0.6)'/></svg>"
)}")`;

function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: "linear-gradient(180deg,#14304d 0%,#0a1d33 45%,#040b14 100%)" }}>
      <div className="absolute inset-x-0 top-0 h-1/2 opacity-70" style={{ background: "radial-gradient(ellipse at 70% 0%, rgba(255,200,120,0.25), transparent 60%)" }} />
      <div className="wave-layer" style={{ top: "62%", backgroundImage: waveA, backgroundSize: "400px 80px", animationDuration: "22s" }} />
      <div className="wave-layer" style={{ top: "70%", backgroundImage: waveB, backgroundSize: "300px 80px", animationDuration: "14s", animationDirection: "reverse" }} />
      <div className="wave-layer" style={{ top: "80%", backgroundImage: waveA, backgroundSize: "400px 80px", animationDuration: "9s" }} />
      <div className="relative z-10 w-full h-full overflow-y-auto">{children}</div>
    </div>
  );
}

export function TitleScreen({ best, onStart, onHelp }: { best: number; onStart: () => void; onHelp: () => void }) {
  return (
    <Backdrop>
      <div className="min-h-full flex flex-col items-center justify-center text-center px-6 py-10">
        <svg width="120" height="110" viewBox="-30 -30 60 55" className="mb-2 drop-shadow-[0_8px_18px_rgba(0,0,0,0.6)]">
          <ShipSprite />
        </svg>
        <div className="text-xs md:text-sm tracking-[0.5em] text-sky-300/70 mb-2">A HEX-SEA ROGUE-LITE</div>
        <h1 className="font-display font-black text-5xl md:text-7xl text-brass-light leading-[1.05] drop-shadow-[0_4px_0_rgba(80,45,5,0.9)]">
          TACTICAL
          <br />
          TILE TRAWLER
        </h1>
        <p className="max-w-xl mt-5 text-sky-100/80 text-sm md:text-base">
          Chart the hexed waters. Cast nets on shifting shoals, dredge cursed relics from wrecks, burn fish for fuel, and
          harpoon the leviathans that hunt you — all before the squall catches up.
        </p>
        <div className="flex gap-3 mt-8 flex-wrap justify-center">
          <button onClick={onStart} className="brass-btn px-10 py-3.5 rounded-xl text-xl font-display">
            ⚓ Set Sail
          </button>
          <button onClick={onHelp} className="px-8 py-3.5 rounded-xl text-lg font-display bg-sky-900/60 hover:bg-sky-800/70 border border-sky-300/30">
            How to Play
          </button>
        </div>
        {best > 0 && <div className="mt-6 text-sm text-amber-200/90">🏆 Best voyage score: {best}</div>}
        <div className="mt-8 text-[11px] text-sky-200/40">5 charts · 4 harbors · 1 Abyssal Leviathan</div>
      </div>
    </Backdrop>
  );
}

export function CaptainScreen({ onPick, onBack }: { onPick: (id: string) => void; onBack: () => void }) {
  return (
    <Backdrop>
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-10">
        <h2 className="font-display text-3xl md:text-4xl text-brass-light mb-1">Choose Your Captain</h2>
        <p className="text-sky-200/70 text-sm mb-7">Every captain starts with 10g and a dented trawler.</p>
        <div className="grid md:grid-cols-3 gap-5 max-w-4xl w-full">
          {CAPTAINS.map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className="group text-left rounded-2xl border border-sky-300/20 bg-[#0a2036]/85 hover:bg-[#0d2c4a] hover:border-brass p-5 transition hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(217,164,65,0.25)]"
            >
              <div className="text-5xl mb-2">{c.icon}</div>
              <div className="font-display text-xl text-white">{c.name}</div>
              <div className="text-xs text-brass-light tracking-widest mb-2">{c.title.toUpperCase()}</div>
              <div className="text-sm text-sky-100/75 mb-3">{c.blurb}</div>
              <ul className="text-xs text-emerald-300 space-y-0.5">
                {c.perks.map((p) => (
                  <li key={p}>▸ {p}</li>
                ))}
              </ul>
              <div className="mt-4 text-center brass-btn rounded-lg py-2 text-sm">Hire</div>
            </button>
          ))}
        </div>
        <button onClick={onBack} className="mt-8 text-sm text-sky-300/70 hover:text-white underline">
          ← Back
        </button>
      </div>
    </Backdrop>
  );
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <div className="flex gap-3 py-1.5 border-b border-sky-300/10 last:border-0">
      <div className="w-28 shrink-0 text-brass-light font-semibold text-sm">{k}</div>
      <div className="text-sm text-sky-100/80">{children}</div>
    </div>
  );
  return (
    <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-4 fade-in" onClick={onClose}>
      <div className="max-w-2xl w-full max-h-full overflow-y-auto rounded-2xl border border-brass/50 bg-[#0a1f34] p-6 pop-in" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-2xl text-brass-light mb-1">How to Trawl</h2>
        <p className="text-sm text-sky-100/70 mb-3">
          Every action is a turn. After it, currents carry you, monsters move, shoals drift and the squall creeps east.
        </p>
        <Row k="Goal">
          Sail from the ⚓ dock (west) to the harbor 🗼 (east) on each of 4 charts, paying a growing <b>levy</b> from gold earned by fishing.
          On chart 5, slay the <b>Abyssal Leviathan</b> to win.
        </Row>
        <Row k="⛵ Sail (1)">Move one hex for 1 fuel (kelp costs 2). Keys: Q W E / A S D. Ending a turn on a current slides you along it for free.</Row>
        <Row k="🕸️ Net (2)">
          Cast at a hex within range: hauls that hex and its 6 neighbours. Hold space is limited. Rocks fray the net. Beasts caught are tangled for 2 turns.
        </Row>
        <Row k="🔱 Harpoon (3)">Hit a monster in a straight line. Rocks block. Lodged harpoons return when it dies, plus a gold bounty.</Row>
        <Row k="🏺 Dredge (4)">Pull up wrecks for gold, artifacts (permanent perks), supplies... or an ambush. Costs 1 fuel.</Row>
        <Row k="🛢️ Render (5)">Turn your cheapest fish into fuel. Stranded? 🔥 Burn (B) planks for fuel at the cost of hull.</Row>
        <Row k="Fog & pings">You only see a few hexes. Red “?” marks are creatures stirring just beyond sight. Hover anything for details.</Row>
        <Row k="Squall ⛈️">Hexes swallowed by the storm hurt your hull every turn. It sweeps west → east, faster each chart.</Row>
        <Row k="Monsters">
          Razor Eels chase. Gloom Anglers lure you from 2 hexes then bite. Bonecrusher Whales hit hard every other turn. The Leviathan lashes
          within 2 hexes and hatches eels.
        </Row>
        <Row k="Harbor">Sell fish (prices fluctuate), pay the levy, then repair, refit, upgrade and buy relics. You can't sail if you can't pay.</Row>
        <Row k="Other keys">Space = wait · Esc = back to Sail · M = mute · H = this help</Row>
        <div className="text-center mt-4">
          <button onClick={onClose} className="brass-btn px-8 py-2 rounded-lg font-display">
            To the sea!
          </button>
        </div>
      </div>
    </div>
  );
}

export function RelicModal({ id, onClose }: { id: string; onClose: () => void }) {
  const r = relicById(id);
  return (
    <div className="absolute inset-0 z-40 bg-black/65 flex items-center justify-center p-4 fade-in">
      <div className="max-w-sm w-full rounded-2xl border-2 border-brass bg-gradient-to-b from-[#1a2f48] to-[#0a1626] p-7 text-center pop-in shadow-[0_0_60px_rgba(217,164,65,0.35)]">
        <div className="text-xs tracking-[0.4em] text-brass-light mb-2">ARTIFACT RECOVERED</div>
        <div className="text-7xl mb-2 drop-shadow-[0_0_20px_rgba(255,212,92,0.7)]">{r.icon}</div>
        <div className="font-display text-2xl text-white mb-2">{r.name}</div>
        <div className="text-sm text-emerald-300 mb-5">{r.desc}</div>
        <button onClick={onClose} autoFocus className="brass-btn px-8 py-2 rounded-lg font-display">
          Stow it
        </button>
        <div className="text-[10px] text-sky-200/40 mt-2">Enter / Space</div>
      </div>
    </div>
  );
}

export function EndScreen({
  g,
  best,
  isBest,
  onAgain,
  onMenu,
}: {
  g: Game;
  best: number;
  isBest: boolean;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const won = g.phase === "won";
  const s = g.stats;
  const Stat = ({ k, v }: { k: string; v: string | number }) => (
    <div className="rounded-lg bg-black/30 border border-sky-300/10 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-sky-200/60">{k}</div>
      <div className="text-xl font-bold text-white">{v}</div>
    </div>
  );
  return (
    <div className="absolute inset-0 z-40 bg-black/75 flex items-center justify-center p-4 fade-in overflow-y-auto">
      <div
        className={`max-w-lg w-full rounded-2xl border-2 p-7 text-center pop-in ${
          won ? "border-brass bg-gradient-to-b from-[#2b2a16] to-[#0a1626]" : "border-red-400/60 bg-gradient-to-b from-[#2a1018] to-[#0a1626]"
        }`}
      >
        <div className="text-6xl mb-1">{won ? "🏆" : "⚰️"}</div>
        <h2 className={`font-display text-4xl mb-1 ${won ? "text-brass-light" : "text-red-300"}`}>{won ? "LEVIATHAN SLAIN" : "LOST AT SEA"}</h2>
        <p className="text-sm text-sky-100/80 mb-5">
          {won ? "The Maw falls quiet. Songs will be sung in every harbor." : g.overCause}
        </p>
        <div className="text-xs tracking-widest text-sky-200/60">FINAL SCORE</div>
        <div className="text-5xl font-display font-black text-amber-300 mb-1">{g.score}</div>
        <div className="text-xs mb-5 text-sky-200/70">{isBest ? "🎉 New personal best!" : `Best: ${best}`}</div>
        <div className="grid grid-cols-3 gap-2 mb-6">
          <Stat k="Chart" v={`${Math.min(5, g.chart)}/5`} />
          <Stat k="Gold earned" v={s.earned} />
          <Stat k="Fish caught" v={s.fish} />
          <Stat k="Monsters" v={s.slain} />
          <Stat k="Artifacts" v={s.relics} />
          <Stat k="Turns" v={s.turns} />
        </div>
        {!won && <div className="text-[11px] text-sky-200/50 mb-4">Lost on chart {Math.min(5, g.chart)}: {CHARTS[Math.min(4, g.chart - 1)].name}</div>}
        <div className="flex gap-3 justify-center">
          <button onClick={onAgain} className="brass-btn px-6 py-2.5 rounded-lg font-display">
            ⚓ Sail Again
          </button>
          <button onClick={onMenu} className="px-6 py-2.5 rounded-lg bg-sky-900/60 hover:bg-sky-800/70 border border-sky-300/30 font-display">
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
