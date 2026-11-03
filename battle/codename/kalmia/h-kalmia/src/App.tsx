import { useEffect, useRef } from "react";
// The application body is plain HTML/JS/CSS (src/smart/*) — React only mounts it.
import { mountSmartEditor } from "./smart/app.js";

export default function App() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return mountSmartEditor(ref.current);
  }, []);
  return <div ref={ref} />;
}