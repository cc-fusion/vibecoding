import { useEffect, useRef } from 'react';
import { mountGame } from './game/main.js';

// The entry component only mounts the vanilla JavaScript game.
export default function App() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    return mountGame(host.current);
  }, []);
  return <div ref={host} className="game-host" />;
}
