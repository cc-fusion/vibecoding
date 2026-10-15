import { basename, extname } from "./paths.js";
const LANGUAGES = [
  { id: "javascript", label: "JavaScript", monacoId: "javascript", extensions: [".js", ".mjs", ".cjs", ".jsx"], badge: "JS", color: "#c9a227", runnable: true, buildable: false, entryCandidates: ["main.js", "index.js", "app.js", "script.js"] },
  { id: "typescript", label: "TypeScript", monacoId: "typescript", extensions: [".ts", ".mts", ".cts", ".tsx"], badge: "TS", color: "#3178c6", runnable: true, buildable: true, entryCandidates: ["main.ts", "index.ts", "app.ts"] },
  { id: "assemblyscript", label: "AssemblyScript", monacoId: "assemblyscript", extensions: [".as.ts"], badge: "AS", color: "#007acc", runnable: true, buildable: true, entryCandidates: ["assembly/index.ts", "index.as.ts", "main.as.ts"] },
  { id: "python", label: "Python", monacoId: "python", extensions: [".py", ".pyw"], badge: "PY", color: "#3b8ed0", runnable: true, buildable: false, entryCandidates: ["main.py", "app.py", "__main__.py"] },
  { id: "html", label: "HTML", monacoId: "html", extensions: [".html", ".htm"], badge: "<>", color: "#e5642f", runnable: true, buildable: false, entryCandidates: ["index.html"] },
  { id: "css", label: "CSS", monacoId: "css", extensions: [".css"], badge: "#", color: "#7b5fd6", runnable: false, buildable: false },
  { id: "json", label: "JSON", monacoId: "json", extensions: [".json", ".jsonc"], badge: "{}", color: "#8a8f98", runnable: false, buildable: false },
  { id: "cpp", label: "C++", monacoId: "cpp", extensions: [".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx"], badge: "C+", color: "#5d7fbf", runnable: true, buildable: true, entryCandidates: ["main.cpp"] },
  { id: "c", label: "C", monacoId: "c", extensions: [".c", ".h"], badge: "C", color: "#4d6fa8", runnable: true, buildable: true, entryCandidates: ["main.c"] },
  { id: "csharp", label: "C#", monacoId: "csharp", extensions: [".cs"], badge: "C#", color: "#8a4bd6", runnable: true, buildable: true, entryCandidates: ["Program.cs"] },
  { id: "java", label: "Java", monacoId: "java", extensions: [".java"], badge: "JV", color: "#c76b2a", runnable: true, buildable: true, entryCandidates: ["Main.java"] },
  { id: "markdown", label: "Markdown", monacoId: "markdown", extensions: [".md", ".markdown"], badge: "MD", color: "#5f6b7a", runnable: false, buildable: false },
  { id: "plaintext", label: "Plain Text", monacoId: "plaintext", extensions: [".txt", ".log", ".gitignore"], badge: "TXT", color: "#5f6b7a", runnable: false, buildable: false }
];
const byId = new Map(LANGUAGES.map((l) => [l.id, l]));
function languageById(id) {
  return id && byId.get(id) || byId.get("plaintext");
}
const extensionTable = LANGUAGES.flatMap((l) => l.extensions.map((e) => [e, l])).sort((a, b) => b[0].length - a[0].length);
function detectLanguage(path) {
  const lowerPath = path.toLowerCase();
  const name = basename(lowerPath);
  for (const [ext, lang] of extensionTable) {
    if (name.endsWith(ext) && name.length > ext.length) {
      if (lang.id === "typescript" && /(^|\/)assembly\//.test(lowerPath)) return byId.get("assemblyscript");
      return lang;
    }
  }
  if (name === "dockerfile" || name === "makefile") return byId.get("plaintext");
  if (!extname(lowerPath)) return byId.get("plaintext");
  return byId.get("plaintext");
}
const SELECTABLE_LANGUAGES = LANGUAGES.filter((l) => l.id !== "plaintext" || true);
export {
  LANGUAGES,
  SELECTABLE_LANGUAGES,
  detectLanguage,
  languageById
};
