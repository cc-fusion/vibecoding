import { useEffect, useRef } from "react";
import { bootGame } from "./game";

export default function App() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const game = bootGame(host.current);
    return () => game.destroy();
  }, []);

  return <div className="app-frame" ref={host} />;
}