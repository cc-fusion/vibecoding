import { useMemo, useState } from "react";
import { CARDS, RELICS, RELIC_MAP, type CardDef, type RelicDef, type RunState, shuffle } from "../game/data";
import type { SaveData } from "../game/save";
import { audio } from "../game/audio";
import { cn } from "../utils/cn";
import CardView from "./CardView";

export function grantRelic(run: RunState, id: string) {
  if (run.relics.includes(id)) return;
  run.relics.push(id);
  if (id === "halo") { run.maxHp += 1; run.hp = Math.min(run.maxHp, run.hp + 1); }
}

function pickCards(save: SaveData, n: number, weights: [number, number, number]): CardDef[] {
  const pool = CARDS.filter((c) => !c.unlock || save.unlockedCards.includes(c.id));
  const out: CardDef[] = [];
  const guard = 60;
  let i = 0;
  while (out.length < n && i++ < guard) {
    const tot = weights[0] + weights[1] + weights[2];
    let r = Math.random() * tot;
    const rar = r < weights[0] ? "common" : (r -= weights[0]) < weights[1] ? "uncommon" : "rare";
    const sub = pool.filter((c) => c.rarity === rar && !out.includes(c));
    if (sub.length) out.push(sub[Math.floor(Math.random() * sub.length)]);
  }
  return out;
}

type Step = "card" | "relic" | "shrine";

export default function Interlude({ run, kind, save, onDone, onAsh, healed: healedProp }: { run: RunState; kind: "wave" | "boss"; save: SaveData; onDone: () => void; onAsh: (n: number) => void; healed: boolean }) {
  const steps: Step[] = kind === "wave" ? ["card"] : ["relic", "shrine", "card"];
  const [si, setSi] = useState(0);
  const [, force] = useState(0);
  const [picker, setPicker] = useState<null | "smith" | "purge">(null);
  const [showDeck, setShowDeck] = useState(false);
  const step = steps[si];
  const cards = useMemo(() => pickCards(save, 3, kind === "wave" ? [60, 33, 7] : [25, 50, 25]), [save, kind]);
  const relics = useMemo<RelicDef[]>(() => {
    const avail = RELICS.filter((r) => !run.relics.includes(r.id));
    const common = shuffle(avail.filter((r) => !r.rare));
    const rare = shuffle(avail.filter((r) => r.rare));
    const out = common.slice(0, 2);
    if (rare.length && Math.random() < 0.6) out.push(rare[0]); else out.push(...common.slice(2, 3));
    return out.slice(0, 3);
  }, [run.relics]);
  const healed = healedProp ? 1 : 0;

  const next = () => { audio.sfx("ui"); if (si + 1 >= steps.length) onDone(); else setSi(si + 1); };
  const addCard = (c: CardDef) => {
    audio.sfx("buy");
    run.deck.push({ uid: ++run.uid, id: c.id, up: false });
    force((n) => n + 1);
    next();
  };
  const pickRelic = (r: RelicDef) => { audio.sfx("relic"); grantRelic(run, r.id); force((n) => n + 1); next(); };

  const upgradable = run.deck.filter((c) => !c.up);
  const doPick = (uid: number) => {
    if (picker === "smith") { const c = run.deck.find((d) => d.uid === uid); if (c) c.up = true; audio.sfx("buy"); }
    if (picker === "purge") { if (run.deck.length <= 5) return; run.deck = run.deck.filter((d) => d.uid !== uid); audio.sfx("boom"); }
    setPicker(null);
    next();
  };

  return (
    <div className="h-full w-full glass-bg overflow-y-auto p-3 sm:p-6">
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
        <div className="text-center fade-up">
          <div className="text-xs uppercase tracking-[0.4em] text-amber-200/70">{kind === "wave" ? `Act ${run.act} · Hymn complete` : `Act ${run.act} · Boss felled`}</div>
          <h2 className="text-2xl sm:text-4xl tracking-[0.2em] text-amber-100 title-glow">
            {step === "card" ? "ADD TO THE LITURGY" : step === "relic" ? "CLAIM A RELIC" : "THE SHRINE"}
          </h2>
          <div className="text-sm font-sans text-violet-100/80 mt-1 flex gap-4 justify-center flex-wrap">
            <span>♥ {run.hp}/{run.maxHp}</span><span>Deck {run.deck.length}</span>
            {healed > 0 && <span className="text-rose-300">+1 HP (verse blessing)</span>}
            <button className="underline decoration-dotted" onClick={() => setShowDeck((v) => !v)}>{showDeck ? "Hide deck" : "View deck"}</button>
          </div>
        </div>

        {showDeck && (
          <div className="panel rounded p-3 flex flex-wrap gap-2 justify-center max-h-[40vh] overflow-y-auto w-full">
            {run.deck.map((c) => <CardView key={c.uid} inst={c} size="mini" />)}
            {run.relics.map((r) => <span key={r} className="self-center text-xs font-sans px-2 py-1 border border-amber-200/30 rounded" title={RELIC_MAP[r].text}>{RELIC_MAP[r].icon} {RELIC_MAP[r].name}</span>)}
          </div>
        )}

        {step === "card" && !picker && (
          <>
            <div className="flex flex-wrap gap-4 justify-center">
              {cards.map((c, i) => <CardView key={c.id} inst={{ uid: 0, id: c.id, up: false }} onClick={() => addCard(c)} animDelay={i * 0.12} />)}
            </div>
            <button className="btn" onClick={() => { onAsh(10); next(); }}>Skip · +10 Ash</button>
          </>
        )}

        {step === "relic" && (
          <div className="flex flex-wrap gap-4 justify-center">
            {relics.map((r, i) => (
              <button key={r.id} onClick={() => pickRelic(r)} style={{ animationDelay: i * 0.12 + "s" }}
                className={cn("card-in panel rounded-md w-[200px] p-4 flex flex-col items-center gap-2 hover:-translate-y-2 transition cursor-pointer", r.rare && "!border-yellow-300 shadow-[0_0_24px_rgba(255,211,106,0.4)]")}>
                <div className="text-5xl">{r.icon}</div>
                <div className="font-bold text-amber-100 text-center">{r.name}</div>
                {r.rare && <div className="text-[10px] uppercase tracking-widest text-yellow-300">Rare</div>}
                <div className="text-sm font-sans text-violet-100/90 text-center">{r.text}</div>
              </button>
            ))}
            {relics.length === 0 && <button className="btn" onClick={next}>No relics remain · Continue</button>}
          </div>
        )}

        {step === "shrine" && !picker && (
          <div className="grid sm:grid-cols-3 gap-4 w-full">
            <button className="panel rounded p-4 flex flex-col items-center gap-2 hover:-translate-y-1 transition disabled:opacity-40" disabled={run.hp >= run.maxHp}
              onClick={() => { audio.sfx("relic"); run.hp = Math.min(run.maxHp, run.hp + 2); force((n) => n + 1); next(); }}>
              <div className="text-4xl">🕊</div><b className="text-amber-100">Rest</b><span className="text-sm font-sans text-center">Heal 2 HP.{run.hp >= run.maxHp ? " (Already whole.)" : ""}</span>
            </button>
            <button className="panel rounded p-4 flex flex-col items-center gap-2 hover:-translate-y-1 transition disabled:opacity-40" disabled={upgradable.length === 0} onClick={() => setPicker("smith")}>
              <div className="text-4xl">⚒</div><b className="text-amber-100">Illuminate</b><span className="text-sm font-sans text-center">Upgrade a card permanently (★).</span>
            </button>
            <button className="panel rounded p-4 flex flex-col items-center gap-2 hover:-translate-y-1 transition disabled:opacity-40" disabled={run.deck.length <= 5} onClick={() => setPicker("purge")}>
              <div className="text-4xl">🔥</div><b className="text-amber-100">Burn a Page</b><span className="text-sm font-sans text-center">Remove a card from your deck (min 5).</span>
            </button>
          </div>
        )}

        {picker && (
          <div className="w-full flex flex-col items-center gap-3">
            <div className="text-amber-100 tracking-widest uppercase text-sm">{picker === "smith" ? "Choose a card to illuminate" : "Choose a card to burn"}</div>
            <div className="flex flex-wrap gap-3 justify-center">
              {(picker === "smith" ? upgradable : run.deck).map((c) => (
                <div key={c.uid} className="scale-[0.8] origin-top -mb-12"><CardView inst={picker === "smith" ? { ...c, up: true } : c} onClick={() => doPick(c.uid)} /></div>
              ))}
            </div>
            <button className="btn" onClick={() => setPicker(null)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
