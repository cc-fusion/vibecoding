import { createContext, useContext, useSyncExternalStore } from "react";
import type { Editor } from "./Editor";

export const EditorContext = createContext<Editor | null>(null);

export function useEditor(): Editor {
  const editor = useContext(EditorContext);
  if (!editor) throw new Error("EditorContext missing");
  return editor;
}

/** Re-renders the calling component whenever the editor emits a change. */
export function useEditorVersion() {
  const editor = useEditor();
  return useSyncExternalStore(
    (cb) => editor.subscribe(cb),
    () => editor.version,
    () => editor.version,
  );
}

