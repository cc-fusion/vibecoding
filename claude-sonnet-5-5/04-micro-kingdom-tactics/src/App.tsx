import { useCallback, useEffect, useRef, useState } from "react";
import Card from "./components/Card";
import Board, { FloatItem, GhostItem } from "./components/Board";
import { DeckModal, RulesModal } from "./components/Overlays";
import { CARDS, OPPONENTS, PERKS, Perk, STARTER_DECK, Side, TERRAIN_INFO, Terrain, rewardChoices } from "./game/cards";
import {
  Fx,
  Preview,
  State,
  Step,
  attackTargets,
  clone,
  endTurn,
  energyFor,
  enemyTurn,
  isPlayable,
  newBattle,
  playCard,
  previewPlay,
  shuffle,
  validTargets,
} from "./game/engine";
import { isMuted, setMuted, sfx, startMusic } from "./game/audio";

type Screen = "title" | "battle" | "reward" | "perk" | "win" | "lose";
interface Run {
  deck: string[];
  perks: string[];
  level: number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const newRun = (): Run => ({ deck: STARTER_DECK.slice(), perks: [], level: 0 });

function KeepBar(props: {
  side: Side;
  hp: number;
  max: number;
  name: string;
  art: string;
  floats: FloatItem[];
  hurt: boolean;
  hint: boolean;
  extra?: string;
}) {
  const pct = Math.max(0, Math.min(100, (props.hp / props.max) * 100));
  const color = props.side === "p" ? "linear-gradient(#7fc4ff,#2f7ad8)" : "linear-gradient(#ff9a8f,#d43b3b)";
  const target = props.side === "p" ? "kp" : "ke";
  return (
    <div className={`keep ${props.hint ? "hit-hint" : ""} ${props.hurt ? "hurt" : ""}`}>
      <div style={{ fontSize: "1.9rem", lineHeight: 1 }}>{props.art}</div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline text-sm">
          <b className="truncate">
            🏰 {props.name}
          </b>
          <span className="font-bold tabular-nums">
            {props.hp}/{props.max}
          </span>
        </div>
        <div className="hpbar mt-1">
          <div className="hpfill" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
      {props.extra && <div className="text-xs opacity-80 whitespace-nowrap">{props.extra}</div>}
      {props.floats
        .filter((f) => f.target === target)
        .map((f) => (
          <div key={f.id} className={`float ${f.kind}`} style={{ fontSize: "1.6rem", top: "-8px" }}>
            {f.text}
          </div>
        ))}
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const [run, setRun] = useState<Run>(newRun());
  const [game, setGame] = useState<State | null>(null);
  const [intro, setIntro] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [floats, setFloats] = useState<FloatItem[]>([]);
  const [ghosts, setGhosts] = useState<GhostItem[]>([]);
  const [flashes, setFlashes] = useState<Record<number, number>>({});
  const [lunge, setLunge] = useState<{ idx: number; dir: number } | null>(null);
  const [shake, setShake] = useState(false);
  const [hurt, setHurt] = useState<Side | null>(null);
  const [banner, setBanner] = useState<{ id: number; text: string } | null>(null);
  const [toast, setToast] = useState<string>("");
  const [rewardOpts, setRewardOpts] = useState<string[]>([]);
  const [perkOpts, setPerkOpts] = useState<Perk[]>([]);
  const [muted, setMutedState] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showDeck, setShowDeck] = useState(false);

  const idc = useRef(0);
  const token = useRef(0);
  const busyRef = useRef(false);

  const opp = OPPONENTS[Math.min(run.level, OPPONENTS.length - 1)];

  const say = useCallback((text: string) => {
    idc.current++;
    setBanner({ id: idc.current, text });
    const myId = idc.current;
    setTimeout(() => setBanner((b) => (b && b.id === myId ? null : b)), 1200);
  }, []);

  const applyFx = useCallback((fx: Fx[]) => {
    const played = new Set<string>();
    const nf: FloatItem[] = [];
    const ng: GhostItem[] = [];
    const fl: Record<number, number> = {};
    for (const f of fx) {
      switch (f.t) {
        case "float":
          nf.push({ id: ++idc.current, target: f.idx, text: f.text, kind: f.kind });
          break;
        case "keepFloat":
          nf.push({ id: ++idc.current, target: f.side === "p" ? "kp" : "ke", text: f.text, kind: f.kind });
          if (f.kind === "dmg") {
            setHurt(f.side);
            setTimeout(() => setHurt(null), 420);
          }
          break;
        case "lunge":
          setLunge({ idx: f.idx, dir: f.dir });
          setTimeout(() => setLunge(null), 240);
          break;
        case "ghost":
          ng.push({ id: ++idc.current, idx: f.idx, art: f.art });
          break;
        case "terra":
          fl[f.idx] = ++idc.current;
          break;
        case "sfx":
          if (!played.has(f.name)) {
            played.add(f.name);
            sfx(f.name);
          }
          break;
        case "shake":
          setShake(true);
          setTimeout(() => setShake(false), 460);
          break;
      }
    }
    if (nf.length) {
      setFloats((p) => [...p, ...nf]);
      setTimeout(() => setFloats((p) => p.filter((x) => !nf.includes(x))), 1050);
    }
    if (ng.length) {
      setGhosts((p) => [...p, ...ng]);
      setTimeout(() => setGhosts((p) => p.filter((x) => !ng.includes(x))), 850);
    }
    if (Object.keys(fl).length) {
      setFlashes((p) => ({ ...p, ...fl }));
    }
  }, []);

  const startBattle = useCallback((r: Run) => {
    token.current++;
    busyRef.current = false;
    setBusy(false);
    setRun(r);
    setGame(newBattle(r.deck, r.perks, OPPONENTS[r.level]));
    setSelected(null);
    setHover(null);
    setFloats([]);
    setGhosts([]);
    setFlashes({});
    setBanner(null);
    setToast("");
    setIntro(true);
    setScreen("battle");
  }, []);

  const startCampaign = () => {
    sfx("select");
    startBattle(newRun());
  };

  const beginBattle = () => {
    sfx("turn");
    setIntro(false);
    if (!isMuted()) startMusic();
    say("Your turn");
  };

  const playSteps = async (steps: Step[], tk: number): Promise<boolean> => {
    for (const st of steps) {
      if (tk !== token.current) return false;
      setGame(st.state);
      applyFx(st.fx);
      if (st.msg) say(st.msg);
      await sleep(st.delay);
    }
    return tk === token.current;
  };

  const finish = async (winner: Side | null) => {
    const tk = token.current;
    await sleep(1200);
    if (tk !== token.current) return;
    if (winner === "p") {
      sfx("win");
      if (run.level >= OPPONENTS.length - 1) {
        setScreen("win");
      } else {
        setRewardOpts(rewardChoices(run.deck));
        setScreen("reward");
      }
    } else {
      sfx("lose");
      setScreen("lose");
    }
  };

  const handleEndTurn = async () => {
    if (!game || busyRef.current || game.side !== "p" || game.over || intro) return;
    busyRef.current = true;
    setBusy(true);
    setSelected(null);
    setToast("");
    sfx("click");
    const tk = token.current;
    const steps = endTurn(game);
    if (!(await playSteps(steps, tk))) return;
    let last = steps[steps.length - 1].state;
    if (!last.over) {
      say(`${opp.name}'s turn`);
      await sleep(800);
      if (tk !== token.current) return;
      const es = enemyTurn(last, opp.skill);
      if (!(await playSteps(es, tk))) return;
      if (es.length) last = es[es.length - 1].state;
    }
    busyRef.current = false;
    setBusy(false);
    if (last.over) {
      finish(last.winner);
    } else {
      say(`Round ${last.round} · Your turn`);
    }
  };

  const castAt = (tile: number) => {
    if (!game || selected === null) return;
    const id = game.hand.p[selected];
    if (!id) return;
    const ns = clone(game);
    const fx: Fx[] = [];
    playCard(ns, "p", selected, tile, fx);
    setGame(ns);
    applyFx(fx);
    setSelected(null);
    setToast("");
    if (ns.over) {
      busyRef.current = true;
      finish(ns.winner);
    }
  };

  const clickCard = (idx: number) => {
    if (!game || intro || busy || game.side !== "p" || game.over) return;
    const id = game.hand.p[idx];
    if (!id) return;
    if (!isPlayable(game, "p", id)) {
      sfx("deny");
      const c = CARDS[id];
      setToast(c.cost > game.energy.p ? `Not enough energy for ${c.name}.` : `${c.name} has no valid target.`);
      return;
    }
    if (selected === idx) {
      if (CARDS[id].target === "none") castAt(-1);
      else setSelected(null);
      return;
    }
    sfx("select");
    setToast("");
    setSelected(idx);
  };

  const clickTile = (i: number) => {
    if (!game || busy || intro || selected === null || game.side !== "p") return;
    const id = game.hand.p[selected];
    if (!id) return;
    if (CARDS[id].target === "none") return;
    if (!validTargets(game, id).includes(i)) {
      sfx("deny");
      setToast(CARDS[id].target === "empty" ? "That tile is occupied." : "Needs a unit to target.");
      return;
    }
    castAt(i);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (screen !== "battle" || intro || showRules || showDeck || !game) return;
      if (e.key >= "1" && e.key <= "7") {
        clickCard(parseInt(e.key, 10) - 1);
      } else if (e.key === "Escape") {
        setSelected(null);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const id = selected !== null ? game.hand.p[selected] : undefined;
        if (id && CARDS[id].target === "none") castAt(-1);
        else void handleEndTurn();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const toggleMute = () => {
    const m = !muted;
    setMutedState(m);
    setMuted(m);
    if (!m && screen === "battle") startMusic();
  };

  const pickCard = (id: string | null) => {
    sfx("select");
    const r: Run = { ...run, deck: id ? [...run.deck, id] : run.deck };
    if (run.level === 1 || run.level === 3) {
      setRun(r);
      setPerkOpts(shuffle(PERKS.filter((p) => !r.perks.includes(p.id))).slice(0, 3));
      setScreen("perk");
    } else {
      startBattle({ ...r, level: r.level + 1 });
    }
  };

  const pickPerk = (p: Perk) => {
    sfx("select");
    startBattle({ ...run, perks: [...run.perks, p.id], level: run.level + 1 });
  };

  /* ------------------------------ Screens ------------------------------ */

  const overlays = (
    <>
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {showDeck && <DeckModal deck={run.deck} perks={run.perks} onClose={() => setShowDeck(false)} />}
    </>
  );

  if (screen === "title") {
    const terr: Terrain[] = ["forest", "mountain", "plains", "water", "lava"];
    return (
      <div className="app-bg h-full w-full flex flex-col items-center justify-center text-center px-4 overflow-y-auto">
        <div className="flex gap-2 mb-6 float-slow">
          {terr.map((t, i) => (
            <div
              key={t}
              className="flex items-center justify-center rounded-xl text-3xl"
              style={{
                width: 56,
                height: 56,
                background: TERRAIN_INFO[t].color,
                border: "3px solid rgba(0,0,0,.45)",
                transform: `translateY(${-TERRAIN_INFO[t].lift * 0.6}px)`,
                boxShadow: `0 ${TERRAIN_INFO[t].lift}px 0 #3a281b, 0 ${TERRAIN_INFO[t].lift + 8}px 14px rgba(0,0,0,.5)`,
                animationDelay: `${i * 0.2}s`,
              }}
            >
              {TERRAIN_INFO[t].icon}
            </div>
          ))}
        </div>
        <h1 className="title-glow font-black tracking-wide" style={{ fontSize: "clamp(2.4rem, 8vw, 5rem)", lineHeight: 1 }}>
          Micro-Kingdom
          <br />
          Tactics
        </h1>
        <p className="mt-4 max-w-xl opacity-85 text-base sm:text-lg">
          A tiny turn-based card battler on a <b>3×3 living board</b>. Every card you play{" "}
          <span style={{ color: "var(--gold)" }}>reshapes the land</span>: raise mountains, flood valleys, scorch the earth, slide whole
          rows of the world. Out-terraform five rival lords.
        </p>
        <div className="flex gap-3 mt-8 flex-wrap justify-center">
          <button className="btn text-xl px-8 py-3" onClick={startCampaign}>
            ⚔ Begin Campaign
          </button>
          <button
            className="btn btn-ghost text-base"
            onClick={() => {
              sfx("click");
              setShowRules(true);
            }}
          >
            How to Play
          </button>
          <button className="btn btn-ghost text-base" onClick={toggleMute}>
            {muted ? "🔇 Sound off" : "🔊 Sound on"}
          </button>
        </div>
        <div className="mt-8 text-xs opacity-60 max-w-md">
          Mountains empower, forests shield, water soothes, lava scorches — and Lava beside Water cools into stone.
        </div>
        {overlays}
      </div>
    );
  }

  if (screen === "reward") {
    return (
      <div className="app-bg h-full w-full flex flex-col items-center justify-center text-center px-4 py-6 overflow-y-auto">
        <h2 className="title-glow text-4xl font-black">Victory!</h2>
        <p className="mt-1 opacity-85">
          {OPPONENTS[run.level].name} is defeated. Choose a card to add to your deck ({run.deck.length} cards).
        </p>
        <div className="flex flex-wrap gap-6 justify-center mt-8">
          {rewardOpts.map((id) => (
            <Card key={id} id={id} clicky cw="clamp(120px, 26vw, 170px)" onClick={() => pickCard(id)} />
          ))}
        </div>
        <div className="flex gap-3 mt-10">
          <button className="btn btn-ghost" onClick={() => setShowDeck(true)}>
            View deck
          </button>
          <button className="btn btn-ghost" onClick={() => pickCard(null)}>
            Skip (keep deck lean)
          </button>
        </div>
        {overlays}
      </div>
    );
  }

  if (screen === "perk") {
    return (
      <div className="app-bg h-full w-full flex flex-col items-center justify-center text-center px-4 py-6 overflow-y-auto">
        <h2 className="title-glow text-4xl font-black">Royal Decree</h2>
        <p className="mt-1 opacity-85">Choose a permanent blessing for the rest of your campaign.</p>
        <div className="flex flex-wrap gap-5 justify-center mt-8">
          {perkOpts.map((p) => (
            <button key={p.id} className="panel p-5 w-60 hover:scale-105 transition-transform cursor-pointer" onClick={() => pickPerk(p)}>
              <div className="text-5xl mb-2">{p.icon}</div>
              <div className="font-bold text-lg" style={{ color: "var(--gold)" }}>
                {p.name}
              </div>
              <div className="text-sm opacity-85 mt-1">{p.text}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (screen === "win") {
    return (
      <div className="app-bg h-full w-full flex flex-col items-center justify-center text-center px-4 py-6 overflow-y-auto">
        <div className="text-7xl float-slow">👑</div>
        <h2 className="title-glow font-black mt-2" style={{ fontSize: "clamp(2.2rem,7vw,4.2rem)" }}>
          The Realm Is Yours
        </h2>
        <p className="mt-3 max-w-lg opacity-90">
          The Terraformer's last mountain crumbles and the Micro-Kingdom bows to your vision. Five lords are toppled, and the land
          remembers every scar and garden you shaped.
        </p>
        <div className="panel p-4 mt-6 text-sm">
          Final deck: <b>{run.deck.length} cards</b> · Decrees:{" "}
          <b>{run.perks.length ? run.perks.map((p) => PERKS.find((x) => x.id === p)!.icon).join(" ") : "none"}</b>
        </div>
        <div className="flex gap-3 mt-8">
          <button className="btn text-lg" onClick={() => startBattle(newRun())}>
            New Campaign
          </button>
          <button className="btn btn-ghost" onClick={() => setScreen("title")}>
            Title
          </button>
        </div>
      </div>
    );
  }

  if (screen === "lose") {
    return (
      <div className="app-bg h-full w-full flex flex-col items-center justify-center text-center px-4 py-6 overflow-y-auto">
        <div className="text-7xl">🏚️</div>
        <h2 className="font-black mt-2 text-5xl" style={{ color: "#ff8a7a", textShadow: "0 4px 0 #000" }}>
          Your Keep Has Fallen
        </h2>
        <p className="mt-3 max-w-lg opacity-85">
          {opp.name} raises a banner over the ruins. The land is patient, though. Reshape your plans and try again.
        </p>
        <div className="flex gap-3 mt-8 flex-wrap justify-center">
          <button className="btn text-lg" onClick={() => startBattle(run)}>
            ↻ Retry Battle {run.level + 1}
          </button>
          <button className="btn btn-ghost" onClick={() => startBattle(newRun())}>
            New Campaign
          </button>
          <button className="btn btn-ghost" onClick={() => setScreen("title")}>
            Title
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------ Battle ------------------------------ */
  if (!game) return null;

  const myTurn = game.side === "p" && !busy && !game.over;
  const selId = selected !== null ? game.hand.p[selected] : undefined;
  const selCard = selId ? CARDS[selId] : null;
  const valid = new Set<number>(selId && selCard && selCard.target !== "none" && myTurn ? validTargets(game, selId) : []);

  let preview: Preview | null = null;
  if (selCard && selected !== null && myTurn) {
    if (selCard.target === "none") preview = previewPlay(game, selected, -1);
    else if (hover !== null && valid.has(hover)) preview = previewPlay(game, selected, hover);
  }

  let hitTiles: number[] = [];
  let keepHint: Side | null = null;
  if (hover !== null && game.tiles[hover].unit) {
    const tg = attackTargets(game, hover);
    hitTiles = tg.units;
    if (tg.keep) keepHint = game.tiles[hover].unit!.owner === "p" ? "e" : "p";
  }

  let hint = "Select a card from your hand.";
  if (game.over) hint = game.winner === "p" ? "The enemy Keep has fallen!" : "Your Keep has fallen...";
  else if (game.side === "e" || busy) hint = "Resolving turn...";
  else if (toast) hint = toast;
  else if (selCard) hint = selCard.target === "none" ? `Press Cast (or click the card again) to play ${selCard.name}.` : `Choose a glowing tile for ${selCard.name}. Esc to cancel.`;
  else if (hover !== null) {
    const t = game.tiles[hover];
    const ti = TERRAIN_INFO[t.terrain];
    hint = `${ti.icon} ${ti.name}: ${ti.desc}`;
    if (t.unit) {
      const c = CARDS[t.unit.cardId];
      hint += `  ·  ${c.name} ${t.unit.ready ? "" : "(asleep until its next turn)"}`;
    }
  }

  const maxEnergy = energyFor(game, "p");
  const gems = Math.max(maxEnergy, game.energy.p);
  const pendingSleepers = game.tiles.filter((t) => t.unit && t.unit.owner === "p" && t.unit.ready).length;

  return (
    <div className="app-bg h-full w-full flex flex-col overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 gap-2" style={{ minHeight: 40 }}>
        <div className="text-sm min-w-0 truncate">
          <b style={{ color: "var(--gold)" }}>
            Battle {run.level + 1}/{OPPONENTS.length}
          </b>{" "}
          <span className="opacity-80 hidden sm:inline">vs {opp.name}</span>
        </div>
        <div className="text-sm font-bold whitespace-nowrap">
          Round {game.round}
          {game.round >= 10 && <span style={{ color: "#ff8a7a" }}> · Dusk</span>}
        </div>
        <div className="flex gap-1.5">
          <button className="btn btn-ghost" onClick={() => setShowDeck(true)}>
            Deck
          </button>
          <button className="btn btn-ghost" onClick={() => setShowRules(true)}>
            ?
          </button>
          <button className="btn btn-ghost" onClick={toggleMute}>
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 min-h-0 flex items-center justify-center gap-5 px-2">
        <aside className="hidden xl:flex flex-col gap-3 w-60 self-center">
          <div className="panel p-3 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-3xl">{opp.art}</span>
              <div>
                <div className="font-bold" style={{ color: "var(--gold)" }}>
                  {opp.name}
                </div>
                <div className="text-xs opacity-70">{opp.title}</div>
              </div>
            </div>
            <div className="text-xs opacity-85">{opp.blurb}</div>
          </div>
          <div className="panel p-3 text-xs space-y-1.5">
            <div className="font-bold text-sm" style={{ color: "var(--gold)" }}>
              Terrain
            </div>
            {(Object.keys(TERRAIN_INFO) as Terrain[]).map((t) => (
              <div key={t} className="flex gap-2">
                <span>{TERRAIN_INFO[t].icon}</span>
                <span>
                  <b>{TERRAIN_INFO[t].name}</b> — {TERRAIN_INFO[t].desc}
                </span>
              </div>
            ))}
            <div className="pt-1 opacity-80">🔥+🌊 Lava beside Water → Mountain. 🌲+🔥 Forest beside Lava → Plains.</div>
          </div>
        </aside>

        <div className="flex flex-col items-center gap-2 relative">
          <KeepBar
            side="e"
            hp={game.keep.e}
            max={game.keepMax.e}
            name={opp.name}
            art={opp.art}
            floats={floats}
            hurt={hurt === "e"}
            hint={keepHint === "e"}
            extra={`✋${game.hand.e.length} 📚${game.drawPile.e.length}`}
          />
          <div className={`board-wrap ${shake ? "shake" : ""}`}>
            <Board
              state={game}
              valid={valid}
              preview={preview}
              hover={hover}
              hitTiles={hitTiles}
              onTile={clickTile}
              onHover={setHover}
              floats={floats}
              lunge={lunge}
              ghosts={ghosts}
              flashes={flashes}
            />
          </div>
          <KeepBar
            side="p"
            hp={game.keep.p}
            max={game.keepMax.p}
            name="Your Keep"
            art="👑"
            floats={floats}
            hurt={hurt === "p"}
            hint={keepHint === "p"}
            extra={`⚔ ${pendingSleepers} ready`}
          />
          {banner && (
            <div key={banner.id} className="banner">
              {banner.text}
            </div>
          )}
        </div>

        <aside className="hidden xl:flex flex-col w-60 self-center panel p-3" style={{ height: "min(64vh, 520px)" }}>
          <div className="font-bold text-sm mb-1" style={{ color: "var(--gold)" }}>
            Chronicle
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin pr-1 flex flex-col-reverse">
            <div>
              {game.log.slice(-60).map((l, i) => (
                <div key={i} className="log-line">
                  {l}
                </div>
              ))}
            </div>
          </div>
          {run.perks.length > 0 && (
            <div className="mt-2 text-xs flex flex-wrap gap-1">
              {run.perks.map((p) => {
                const pk = PERKS.find((x) => x.id === p)!;
                return (
                  <span key={p} title={pk.text} className="rounded-full px-2 py-0.5" style={{ background: "rgba(243,201,105,.15)" }}>
                    {pk.icon} {pk.name}
                  </span>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {/* Footer: status + hand */}
      <div className="px-2 pb-2 pt-1">
        <div className="flex items-center justify-between gap-3 px-1 mb-1">
          <div className="flex items-center gap-2">
            <div className="flex gap-1 items-center" title="Energy">
              {Array.from({ length: gems }).map((_, i) => (
                <div key={i} className={`energy-gem ${i < game.energy.p ? "" : "off"}`} />
              ))}
            </div>
            <span className="text-xs opacity-80 whitespace-nowrap">
              {game.energy.p}/{maxEnergy}
            </span>
            <span className="text-xs opacity-60 hidden sm:inline whitespace-nowrap">
              📚{game.drawPile.p.length} · 🗑{game.discard.p.length}
            </span>
          </div>
          <div className="flex-1 text-center text-xs sm:text-sm opacity-90 min-w-0 truncate" style={{ minHeight: "1.3em" }}>
            {hint}
          </div>
          <div className="flex gap-2">
            {selCard && selCard.target === "none" && myTurn && (
              <button className="btn" onClick={() => castAt(-1)}>
                ✨ Cast
              </button>
            )}
            <button className={`btn ${myTurn && !selCard ? "btn-end" : ""}`} disabled={!myTurn} onClick={handleEndTurn}>
              End Turn ⏎
            </button>
          </div>
        </div>
        <div
          className="flex gap-2 sm:gap-3 overflow-x-auto scroll-thin px-2"
          style={{ paddingTop: "1.9em", paddingBottom: 6, justifyContent: "safe center" as "center", minHeight: "calc(var(--cw) * 1.45 + 2.6em)" }}
        >
          {game.hand.p.map((id, i) => (
            <Card
              key={`${id}-${i}`}
              id={id}
              selected={selected === i}
              dim={!isPlayable(game, "p", id) || !myTurn}
              onClick={() => clickCard(i)}
            />
          ))}
          {game.hand.p.length === 0 && <div className="text-sm opacity-60 self-center">Your hand is empty. End your turn to draw.</div>}
        </div>
      </div>

      {/* Battle intro */}
      {intro && (
        <div className="overlay" style={{ zIndex: 90 }}>
          <div className="panel p-6 max-w-md w-full text-center">
            <div className="text-xs tracking-widest uppercase opacity-70">
              Battle {run.level + 1} of {OPPONENTS.length}
            </div>
            <div className="text-7xl my-2 float-slow">{opp.art}</div>
            <h2 className="text-3xl font-black" style={{ color: "var(--gold)" }}>
              {opp.name}
            </h2>
            <div className="text-sm opacity-70 mb-3">{opp.title}</div>
            <p className="text-sm opacity-90">{opp.blurb}</p>
            <div className="text-sm mt-3">
              Enemy Keep: <b>{opp.keep}</b> · Your Keep: <b>{game.keepMax.p}</b>
            </div>
            <div className="flex gap-2 justify-center mt-5 flex-wrap">
              <button className="btn text-lg" onClick={beginBattle}>
                ⚔ To Battle!
              </button>
              <button className="btn btn-ghost" onClick={() => setShowRules(true)}>
                Rules
              </button>
            </div>
          </div>
        </div>
      )}
      {overlays}
    </div>
  );
}
