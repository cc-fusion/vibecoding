import { useEffect, useRef } from "react";
import { startGame } from "./game/main.js";

// The scaffold entry only mounts the vanilla HTML/CSS/JavaScript game.
export default function App() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root.current) return;
    return startGame(root.current);
  }, []);

  return <div ref={root} id="mossbound-app" />;
}
