import { useEffect, useRef } from "react";
import { createEditor } from "./editor/controller.js";

export default function App() {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const miRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = createEditor({
      ta: taRef.current!,
      mirror: mirrorRef.current!,
      mi: miRef.current!,
      bar: barRef.current!,
      chipsEl: chipsRef.current!,
    });
    return () => editor.destroy();
  }, []);

  return (
    <>
      <div id="mirror" ref={mirrorRef} aria-hidden="true">
        <div id="mi" ref={miRef} />
      </div>
      <textarea
        id="ed"
        ref={taRef}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        aria-label="Notes"
      />
      <div id="bar" ref={barRef}>
        <div id="chips" ref={chipsRef} />
        <div id="hint">Tab accept · ←→ switch</div>
      </div>
    </>
  );
}
