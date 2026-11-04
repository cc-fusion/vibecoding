import "./index.css";
import { initSmartTextEditor } from "./editorApp.js";

const rootEl = document.getElementById("root") || document.body;
initSmartTextEditor(rootEl);
