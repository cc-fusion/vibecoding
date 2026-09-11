import { useEffect, useMemo } from "react";
import { CanvasView } from "./components/CanvasView";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { Toolbar } from "./components/Toolbar";
import { Editor } from "./editor/Editor";
import { attachKeyboard } from "./editor/keyboard";
import { EditorContext } from "./editor/useEditor";

let sharedEditor: Editor | null = null;
function getEditor() {
  if (!sharedEditor) sharedEditor = new Editor();
  return sharedEditor;
}

export default function App() {
  const editor = useMemo(getEditor, []);

  useEffect(() => attachKeyboard(editor, () => editor.tools), [editor]);

  // Prevent pinch-zoom/double-tap zoom from hijacking canvas gestures on iOS Safari.
  useEffect(() => {
    const block = (e: Event) => {
      if ((e.target as HTMLElement | null)?.tagName === "CANVAS") e.preventDefault();
    };
    document.addEventListener("gesturestart", block, { passive: false });
    document.addEventListener("touchmove", block, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("touchmove", block);
    };
  }, []);

  return (
    <EditorContext.Provider value={editor}>
      <div className="app">
        <Toolbar />
        <CanvasView />
        <PropertiesPanel />
      </div>
    </EditorContext.Provider>
  );
}
