import { useEffect, useReducer, useState } from "react";
import Board from "./components/Board";
import Harbor from "./components/Harbor";
import { Hud, SidePanel } from "./components/Panels";
import { CaptainScreen, EndScreen, HelpModal, RelicModal, TitleScreen } from "./components/Screens";
import { createGame, reduce } from "./game/engine";
import { DIRS, R, type Hex } from "./game/hex";
import { isMuted, setAmbientLevel, setMuted, sfx, unlockAudio } from "./game/audio";
import type { Mode } from "./game/types";

const BEST_KEY = "tile-trawler-best";
const readBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0);
  } catch {
    return 0;
  }
};

export default function App() {
  const [screen, setScreen] = useState<"title" | "captain" | "play">("title");
  const [g, dispatch] = useReducer(reduce, "marrow", createGame);
  const [mode, setMode] = useState<Mode>("sail");
  const [hover, setHover] = useState<Hex | null>(null);
  const [help, setHelp] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [best, setBest] = useState(readBest);
  const [isBest, setIsBest] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  const p = g.p;

  // sound events
  useEffect(() => {
    for (const e of g.events) if (e.t === "snd") sfx(e.name);
  }, [g.evSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  // ambience follows the storm
  useEffect(() => {
    if (screen === "play") setAmbientLevel(Math.max(0, (g.stormQ + R) / (2 * R)));
  }, [g.stormQ, screen]);

  // record best score
  useEffect(() => {
    if (g.phase === "over" || g.phase === "won") {
      if (g.score > best) {
        try {
          localStorage.setItem(BEST_KEY, String(g.score));
        } catch {
          /* ignore */
        }
        setBest(g.score);
        setIsBest(true);
      } else setIsBest(false);
    }
  }, [g.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // drop unusable modes
  useEffect(() => {
    if (g.phase !== "sail") {
      setMode("sail");
      return;
    }
    if ((mode === "net" && p.nets <= 0) || (mode === "harpoon" && p.harpoons <= 0) || (mode === "dredge" && p.fuel < 1)) setMode("sail");
  }, [g.phase, p.nets, p.harpoons, p.fuel, mode]);

  useEffect(() => {
    if (!confirmAbandon) return;
    const t = setTimeout(() => setConfirmAbandon(false), 3000);
    return () => clearTimeout(t);
  }, [confirmAbandon]);

  const startRun = (captain: string) => {
    unlockAudio();
    dispatch({ type: "new", captain });
    setMode("sail");
    setHover(null);
    setHelp(false);
    setConfirmAbandon(false);
    setScreen("play");
    sfx("click");
  };

  const toggleMute = () => {
    const m = !isMuted();
    setMuted(m);
    setMutedState(m);
  };

  const pickMode = (m: Mode) => {
    if (g.phase !== "sail" || g.pending) return;
    if (m === "net" && p.nets <= 0) return;
    if (m === "harpoon" && p.harpoons <= 0) return;
    if (m === "dredge" && p.fuel < 1) return;
    sfx("click");
    setMode(m);
  };

  const onTile = (q: number, r: number) => {
    if (g.phase !== "sail" || g.pending) return;
    unlockAudio();
    dispatch({ type: mode === "sail" ? "move" : mode, q, r });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen !== "play") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "h") {
        setHelp((v) => !v);
        return;
      }
      if (k === "m") {
        toggleMute();
        return;
      }
      if (help) {
        if (k === "escape") setHelp(false);
        return;
      }
      if (g.pending) {
        if (k === "enter" || k === " ") {
          e.preventDefault();
          dispatch({ type: "ack" });
        }
        return;
      }
      if (g.phase !== "sail") return;
      const moveKeys = ["e", "w", "q", "a", "s", "d"];
      const mi = moveKeys.indexOf(k);
      if (mi >= 0) {
        setMode("sail");
        dispatch({ type: "move", q: p.q + DIRS[mi].q, r: p.r + DIRS[mi].r });
      } else if (k === "1") pickMode("sail");
      else if (k === "2") pickMode("net");
      else if (k === "3") pickMode("harpoon");
      else if (k === "4") pickMode("dredge");
      else if (k === "5") dispatch({ type: "oil" });
      else if (k === "b") dispatch({ type: "burn" });
      else if (k === " ") {
        e.preventDefault();
        dispatch({ type: "wait" });
      } else if (k === "escape") setMode("sail");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const ended = g.phase === "over" || g.phase === "won";

  if (screen === "title") {
    return (
      <div className="relative h-full w-full">
        <TitleScreen best={best} onStart={() => { unlockAudio(); sfx("click"); setScreen("captain"); }} onHelp={() => setHelp(true)} />
        {help && <HelpModal onClose={() => setHelp(false)} />}
      </div>
    );
  }
  if (screen === "captain") {
    return (
      <div className="relative h-full w-full">
        <CaptainScreen onPick={startRun} onBack={() => setScreen("title")} />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full flex flex-col bg-abyss">
      <Hud
        g={g}
        muted={muted}
        onMute={toggleMute}
        onHelp={() => setHelp(true)}
        confirmAbandon={confirmAbandon}
        onAbandon={() => {
          if (ended) return;
          if (!confirmAbandon) setConfirmAbandon(true);
          else {
            setConfirmAbandon(false);
            if (g.phase === "harbor") dispatch({ type: "forfeit" });
            else dispatch({ type: "abandon" });
          }
        }}
      />
      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        <div className="flex-1 min-h-0 min-w-0 relative">
          <Board g={g} mode={mode} hover={hover} onHover={setHover} onTile={onTile} />
          <div className="absolute left-3 bottom-2 max-w-[70%] text-[11px] text-amber-100/80 bg-black/40 rounded px-2 py-1 pointer-events-none">
            {g.chart < 5 ? "🎯 Reach the harbor 🗼 and afford the levy" : "🎯 Slay the Abyssal Leviathan — it hides in the east"}
          </div>
        </div>
        <div className="md:w-[340px] lg:w-[380px] h-[42%] md:h-full shrink-0 min-h-0">
          <SidePanel
            g={g}
            mode={mode}
            hover={hover}
            onMode={pickMode}
            onOil={() => dispatch({ type: "oil" })}
            onBurn={() => dispatch({ type: "burn" })}
            onWait={() => dispatch({ type: "wait" })}
          />
        </div>
      </div>

      {g.phase === "harbor" && <Harbor g={g} act={dispatch} />}
      {g.pending && <RelicModal id={g.pending} onClose={() => dispatch({ type: "ack" })} />}
      {ended && (
        <EndScreen
          g={g}
          best={best}
          isBest={isBest}
          onAgain={() => setScreen("captain")}
          onMenu={() => setScreen("title")}
        />
      )}
      {help && <HelpModal onClose={() => setHelp(false)} />}
    </div>
  );
}
