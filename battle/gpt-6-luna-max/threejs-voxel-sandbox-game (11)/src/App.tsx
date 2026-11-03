import { useEffect, useRef } from "react";
// The playable world is deliberately written as plain JavaScript and CSS.
// @ts-expect-error JavaScript game module has no TypeScript declaration by design.
import { mountVoxelGame } from "./game/game.js";

export default function App() {
  const host = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!host.current) return;
    return mountVoxelGame(host.current);
  }, []);

  return <main className="game-root" ref={host} />;
}