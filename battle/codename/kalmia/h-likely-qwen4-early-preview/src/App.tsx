import { useEffect, useRef } from "react";
// The game itself is plain JavaScript (src/game/*). React only mounts it.
import { initGame } from "./game/game.js";

export default function App() {
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !ref.current) return;
    started.current = true;
    initGame(ref.current);
  }, []);

  return <div ref={ref} id="game-root" />;
}