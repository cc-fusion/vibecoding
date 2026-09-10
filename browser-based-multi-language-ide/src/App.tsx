import { useEffect, useRef } from "react";
import { IDE } from "./ide/IDE";

/**
 * React is only used as the mount point required by the project scaffold.
 * The IDE itself is a framework-free, class-based ES-module application that
 * renders and manages its own DOM (see src/ide/IDE.ts).
 */
export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const ideRef = useRef<IDE | null>(null);

  useEffect(() => {
    if (!hostRef.current || ideRef.current) return;
    const ide = new IDE(hostRef.current);
    ideRef.current = ide;
    void ide.start();
    return () => {
      ide.dispose();
      ideRef.current = null;
    };
  }, []);

  return <div ref={hostRef} className="ide-host" />;
}
