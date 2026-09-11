import { basename, extname } from "./paths";

/**
 * Single source of truth for language identity: extension mapping, Monaco mode,
 * explorer badge, and runner capability. Every other module imports from here.
 */
export interface LanguageInfo {
  id: string;
  label: string;
  /** Monaco language mode id. */
  monacoId: string;
  extensions: string[];
  /** Short badge used in the explorer/tabs. */
  badge: string;
  color: string;
  /** Whether the RunnerManager can execute files of this language. */
  runnable: boolean;
  /** Whether a "Build" step is meaningful (compilers). */
  buildable: boolean;
  /** Ordering preference when choosing a project entry point. */
  entryCandidates?: string[];
}

export const LANGUAGES: LanguageInfo[] = [
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
  { id: "plaintext", label: "Plain Text", monacoId: "plaintext", extensions: [".txt", ".log", ".gitignore"], badge: "TXT", color: "#5f6b7a", runnable: false, buildable: false },
];

const byId = new Map(LANGUAGES.map((l) => [l.id, l]));

export function languageById(id: string | undefined | null): LanguageInfo {
  return (id && byId.get(id)) || byId.get("plaintext")!;
}

/** Sorted longest-extension-first so ".as.ts" beats ".ts". */
const extensionTable: Array<[string, LanguageInfo]> = LANGUAGES.flatMap((l) => l.extensions.map((e) => [e, l] as [string, LanguageInfo])).sort((a, b) => b[0].length - a[0].length);

/**
 * Detect the language of a path. AssemblyScript shares TypeScript's extension;
 * the convention used here is `*.as.ts` or any `.ts` file inside an `assembly/` directory.
 */
export function detectLanguage(path: string): LanguageInfo {
  const lowerPath = path.toLowerCase();
  const name = basename(lowerPath);
  for (const [ext, lang] of extensionTable) {
    if (name.endsWith(ext) && name.length > ext.length) {
      if (lang.id === "typescript" && /(^|\/)assembly\//.test(lowerPath)) return byId.get("assemblyscript")!;
      return lang;
    }
  }
  if (name === "dockerfile" || name === "makefile") return byId.get("plaintext")!;
  if (!extname(lowerPath)) return byId.get("plaintext")!;
  return byId.get("plaintext")!;
}

export const SELECTABLE_LANGUAGES = LANGUAGES.filter((l) => l.id !== "plaintext" || true);
