import { useEffect, useRef } from "react";
import { mountGame } from "./game.js";

export default function App() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    return mountGame(host.current);
  }, []);

  return <div className="game-root" ref={host} />;
}