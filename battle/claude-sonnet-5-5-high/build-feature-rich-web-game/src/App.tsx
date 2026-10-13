import { useEffect, useRef } from "react";
// The entire game is plain vanilla JS (src/game/*). React only mounts and unmounts it.
// @ts-ignore - untyped vanilla JS module
import { startGame } from "./game/core.js";
import "./game/game.css";

export default function App() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const destroy = startGame(el) as () => void;
    return () => destroy();
  }, []);
  return <div ref={ref} style={{ position: "fixed", inset: 0 }} />;
}
