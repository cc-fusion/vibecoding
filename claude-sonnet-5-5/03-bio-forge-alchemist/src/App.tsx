import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { type Game, newGame, beginDayPrep, saveBest, totalScore } from "./game/data";
import { initAudio, isMuted, setMuted, sfx, startMusic, stopMusic } from "./game/audio";
import Forge from "./components/Forge";
import Shop from "./components/Shop";
import { Title, Summary, EndScreen } from "./components/Screens";

type Screen = "title" | "forge" | "shop" | "summary" | "over" | "victory";

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const gRef = useRef<Game>(newGame());
  const [runId, setRunId] = useState(0);
  const [, bumpState] = useReducer((x: number) => x + 1, 0);
  const [muted, setMutedState] = useState(false);
  const bump = useCallback(() => bumpState(), []);
  const g = gRef.current;

  useEffect(() => {
    document.title = "Bio-Forge Alchemist";
  }, []);

  // 1-6 select ingredient is handled inside Forge; here we just manage music per screen
  useEffect(() => {
    if (screen === "forge" || screen === "summary" || screen === "title") startMusic("calm");
    if (screen === "over" || screen === "victory") stopMusic();
  }, [screen]);

  const startNew = () => {
    initAudio();
    gRef.current = newGame();
    beginDayPrep(gRef.current);
    setRunId((r) => r + 1);
    setScreen("forge");
  };

  const finishNight = (result: "done" | "over") => {
    const cur = gRef.current;
    if (result === "over") {
      saveBest(totalScore(cur));
      setScreen("over");
      return;
    }
    cur.totals.days++;
    if (cur.day >= 10 && !cur.endless) {
      saveBest(totalScore(cur));
      sfx.win();
      setScreen("victory");
      return;
    }
    setScreen("summary");
  };

  const nextDay = () => {
    const cur = gRef.current;
    cur.day++;
    beginDayPrep(cur);
    sfx.click();
    setScreen("forge");
  };

  const toggleMute = () => {
    initAudio();
    const m = !isMuted();
    setMuted(m);
    setMutedState(m);
  };

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: "radial-gradient(ellipse at 50% 0%, #2a1a45 0%, #140f22 55%, #0b0814 100%)", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}
      onPointerDown={() => initAudio()}
    >
      <button
        onClick={toggleMute}
        className="fixed right-3 top-3 z-40 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white/80 ring-1 ring-white/20 hover:bg-black/80"
        title="Toggle sound"
      >
        {muted ? "Sound: OFF" : "Sound: ON"}
      </button>

      {screen === "title" && <Title onStart={startNew} />}
      {screen === "forge" && <Forge key={`f${runId}-${g.day}`} g={g} bump={bump} onOpenShop={() => setScreen("shop")} />}
      {screen === "shop" && <Shop key={`s${runId}-${g.day}`} g={g} onFinish={finishNight} />}
      {screen === "summary" && <Summary key={`u${runId}-${g.day}`} g={g} bump={bump} onNext={nextDay} />}
      {screen === "over" && <EndScreen g={g} won={false} onRestart={startNew} />}
      {screen === "victory" && (
        <EndScreen
          g={g}
          won
          onRestart={startNew}
          onContinue={() => {
            g.endless = true;
            setScreen("summary");
          }}
        />
      )}
    </div>
  );
}
