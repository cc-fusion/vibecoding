import type { EditorManager } from "../editor/EditorManager";
import type { Diagnostic } from "./types";

export interface TypeScriptCompileResult {
  /** Emitted JavaScript keyed by output path ("/main.js"). */
  outputs: Record<string, string>;
  /** Output path -> source path. */
  sourceMap: Record<string, string>;
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  fileCount: number;
}

/**
 * Browser-only TypeScript compiler service.
 *
 * It uses the real TypeScript compiler that Monaco hosts in its TypeScript
 * language-service Web Worker. All TypeScript models in the virtual project are
 * synchronized to that worker, which builds a single `ts.Program` over them
 * (via the LanguageService) — so cross-file imports, semantic diagnostics and
 * emit all work project-wide without any source leaving the browser.
 *
 * The compile unit is deliberately the whole project so this layer can later be
 * swapped for a dedicated `ts.createProgram()` + virtual CompilerHost worker
 * without changing callers.
 */
export class TypeScriptCompiler {
  constructor(private editor: EditorManager) {}

  async compileProject(): Promise<TypeScriptCompileResult> {
    const monaco = this.editor.monaco;
    if (!monaco?.languages?.typescript) throw new Error("TypeScript compiler is not available: Monaco's TypeScript language service failed to initialize.");
    const models = this.editor.ensureModelsForLanguage("typescript");
    if (!models.length) throw new Error("No TypeScript files in the project.");

    let getWorker: any;
    try {
      getWorker = await monaco.languages.typescript.getTypeScriptWorker();
    } catch (err) {
      throw new Error(`TypeScript worker failed to start: ${(err as Error).message}`);
    }
    const client = await getWorker(...models.map((m: any) => m.uri));

    const outputs: Record<string, string> = {};
    const sourceMap: Record<string, string> = {};
    const diagnostics: Diagnostic[] = [];

    for (const model of models) {
      const uri = model.uri.toString();
      const path = model.uri.path as string;
      const [syntactic, semantic, emit] = await Promise.all([client.getSyntacticDiagnostics(uri), client.getSemanticDiagnostics(uri), client.getEmitOutput(uri)]);
      for (const d of [...syntactic, ...semantic]) diagnostics.push(this.convert(d, model, path));
      const js = (emit?.outputFiles ?? []).find((f: any) => /\.js$/.test(f.name));
      if (js) {
        const outPath = this.outputPath(js.name, path);
        outputs[outPath] = js.text;
        sourceMap[outPath] = path;
      }
    }

    return {
      outputs,
      sourceMap,
      diagnostics,
      errorCount: diagnostics.filter((d) => d.severity === "error").length,
      warningCount: diagnostics.filter((d) => d.severity === "warning").length,
      fileCount: models.length,
    };
  }

  outputPathFor(sourcePath: string): string {
    return sourcePath.replace(/\.(m|c)?tsx?$/, ".js");
  }

  private outputPath(emittedName: string, sourcePath: string): string {
    try {
      if (emittedName.startsWith("file://")) return decodeURIComponent(new URL(emittedName).pathname);
    } catch {
      /* fall through */
    }
    return this.outputPathFor(sourcePath);
  }

  private convert(d: any, model: any, path: string): Diagnostic {
    const start = typeof d.start === "number" ? d.start : 0;
    const length = typeof d.length === "number" ? d.length : 0;
    const s = model.getPositionAt(start);
    const e = model.getPositionAt(start + length);
    // ts.DiagnosticCategory: Warning=0, Error=1, Suggestion=2, Message=3
    const severity: Diagnostic["severity"] = d.category === 1 ? "error" : d.category === 0 ? "warning" : "info";
    return {
      severity,
      file: path,
      line: s.lineNumber,
      column: s.column,
      endLine: e.lineNumber,
      endColumn: e.column,
      message: flatten(d.messageText),
      source: "typescript",
      code: d.code != null ? `TS${d.code}` : undefined,
    };
  }
}

function flatten(msg: any, indent = 0): string {
  if (typeof msg === "string") return msg;
  if (!msg) return "";
  let out = "  ".repeat(indent) + String(msg.messageText ?? "");
  if (Array.isArray(msg.next)) for (const n of msg.next) out += "\n" + flatten(n, indent + 1);
  return out;
}
