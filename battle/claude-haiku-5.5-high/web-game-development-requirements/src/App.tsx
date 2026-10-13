import { useEffect, useRef } from "react";
import "./game/style.css";
import { mountGame } from "./game/main.js";

// React is only the outer deployment wrapper: it mounts the vanilla JS game once.
export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const teardown = mountGame(host);
    return () => teardown();
  }, []);

  return <div ref={hostRef} className="cm-root" />;
}
