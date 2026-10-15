function installShortcuts(actions) {
  const handler = (e) => {
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
      const target = e.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      e.preventDefault();
      if (key === "f") actions.find();
      else actions.replace();
    }
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}
export {
  installShortcuts
};
