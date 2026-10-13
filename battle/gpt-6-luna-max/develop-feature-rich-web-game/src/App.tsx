import { useEffect, useRef } from "react";
import { mountGame } from "./game.js";

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    return mountGame(host);
  }, []);

  return <div className="game-root" ref={mountRef} />;
}