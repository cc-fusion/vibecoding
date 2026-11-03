import { useEffect, useRef } from 'react';
import { mountEditor } from './editor/editor.js';

export default function App() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    return mountEditor(rootRef.current);
  }, []);

  return <div ref={rootRef} className="editor-mount" />;
}
