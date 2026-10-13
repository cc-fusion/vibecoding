import { useEffect, useRef, useState } from "react";
import { WildforgeGame, type GameSnapshot } from "./game/engine";
import { HUD, TitleScreen } from "./game/UI";
import { EndScreen, GamePanel, PauseScreen } from "./game/Menus";

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState<WildforgeGame | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const instance = new WildforgeGame(hostRef.current, setSnapshot);
    setGame(instance);
    return () => instance.dispose();
  }, []);

  return <div className={`app-shell phase-${snapshot?.phase || "loading"}`}>
    <div className="world-stage" ref={hostRef} />
    {game && snapshot ? <>
      {snapshot.phase === "title" && <TitleScreen game={game} s={snapshot} />}
      {snapshot.phase === "playing" && <HUD game={game} s={snapshot} />}
      {snapshot.phase === "paused" && <PauseScreen game={game} s={snapshot} />}
      {(snapshot.phase === "dead" || snapshot.phase === "won") && <EndScreen game={game} s={snapshot} />}
      {snapshot.panel && <GamePanel game={game} s={snapshot} />}
    </> : <div className="loading-screen"><span className="loading-mark">W.</span><span>BUILDING YOUR WORLD</span></div>}
  </div>;
}
