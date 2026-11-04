import { useEffect, useRef } from "react";
import { initSmartTextEditor } from "./editorApp";

export default function App() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const cleanup = initSmartTextEditor(hostRef.current);
    return () => {
      cleanup();
    };
  }, []);

  return <div ref={hostRef} style={{ width: "100vw", height: "100vh" }} />;
}
