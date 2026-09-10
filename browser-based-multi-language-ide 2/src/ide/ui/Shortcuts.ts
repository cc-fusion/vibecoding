export interface ShortcutActions {
  quickOpen(): void;
  toggleSidebar(): void;
  togglePanel(): void;
  runFile(): void;
  runProject(): void;
  find(): void;
  replace(): void;
  editorHasFocus(): boolean;
}

/**
 * Global keyboard shortcuts. Monaco registers the same bindings as editor
 * commands (which call preventDefault), so this handler skips already-handled
 * events to avoid double execution. Ctrl/Cmd+S is deliberately not intercepted:
 * saving is automatic.
 */
export function installShortcuts(actions: ShortcutActions): () => void {
  const handler = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (e.key === "F5" && !mod && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      actions.runProject();
      return;
    }
    if (!mod || e.altKey) return;
    if (key === "p" && !e.shiftKey) {
      e.preventDefault();
      actions.quickOpen();
    } else if (key === "b" && !e.shiftKey) {
      e.preventDefault();
      actions.toggleSidebar();
    } else if (key === "j" && !e.shiftKey) {
      e.preventDefault();
      actions.togglePanel();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      actions.runFile();
    } else if ((key === "f" || key === "h") && !e.shiftKey && !actions.editorHasFocus()) {
      // Outside Monaco: route Find/Replace into the editor instead of the browser page search.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      e.preventDefault();
      if (key === "f") actions.find();
      else actions.replace();
    }
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}
