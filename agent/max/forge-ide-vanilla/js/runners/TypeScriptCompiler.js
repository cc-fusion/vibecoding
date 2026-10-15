class TypeScriptCompiler {
  constructor(editor) {
    this.editor = editor;
  }
  editor;
  async compileProject() {
    const monaco = this.editor.monaco;
    if (!monaco?.languages?.typescript) throw new Error("TypeScript compiler is not available: Monaco's TypeScript language service failed to initialize.");
    const models = this.editor.ensureModelsForLanguage("typescript");
    if (!models.length) throw new Error("No TypeScript files in the project.");
    let getWorker;
    try {
      getWorker = await monaco.languages.typescript.getTypeScriptWorker();
    } catch (err) {
      throw new Error(`TypeScript worker failed to start: ${err.message}`);
    }
    const client = await getWorker(...models.map((m) => m.uri));
    const outputs = {};
    const sourceMap = {};
    const diagnostics = [];
    for (const model of models) {
      const uri = model.uri.toString();
      const path = model.uri.path;
      const [syntactic, semantic, emit] = await Promise.all([client.getSyntacticDiagnostics(uri), client.getSemanticDiagnostics(uri), client.getEmitOutput(uri)]);
      for (const d of [...syntactic, ...semantic]) diagnostics.push(this.convert(d, model, path));
      const js = (emit?.outputFiles ?? []).find((f) => /\.js$/.test(f.name));
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
      fileCount: models.length
    };
  }
  outputPathFor(sourcePath) {
    return sourcePath.replace(/\.(m|c)?tsx?$/, ".js");
  }
  outputPath(emittedName, sourcePath) {
    try {
      if (emittedName.startsWith("file://")) return decodeURIComponent(new URL(emittedName).pathname);
    } catch {
    }
    return this.outputPathFor(sourcePath);
  }
  convert(d, model, path) {
    const start = typeof d.start === "number" ? d.start : 0;
    const length = typeof d.length === "number" ? d.length : 0;
    const s = model.getPositionAt(start);
    const e = model.getPositionAt(start + length);
    const severity = d.category === 1 ? "error" : d.category === 0 ? "warning" : "info";
    return {
      severity,
      file: path,
      line: s.lineNumber,
      column: s.column,
      endLine: e.lineNumber,
      endColumn: e.column,
      message: flatten(d.messageText),
      source: "typescript",
      code: d.code != null ? `TS${d.code}` : void 0
    };
  }
}
function flatten(msg, indent = 0) {
  if (typeof msg === "string") return msg;
  if (!msg) return "";
  let out = "  ".repeat(indent) + String(msg.messageText ?? "");
  if (Array.isArray(msg.next)) for (const n of msg.next) out += "\n" + flatten(n, indent + 1);
  return out;
}
export {
  TypeScriptCompiler
};
