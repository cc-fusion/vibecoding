import { initSmartTextEditor } from "./editorApp.js";

export function App(container?: HTMLElement) {
  return initSmartTextEditor(container || document.getElementById("root") || document.body);
}

export default App;
