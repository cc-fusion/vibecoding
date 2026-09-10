import type { ProjectManager } from "../project/ProjectManager";

export type OutputKind = "stdout" | "stderr" | "info" | "warn" | "error" | "success" | "system";

export interface Diagnostic {
  severity: "error" | "warning" | "info";
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  source: string;
  code?: string;
}

export type RunStatus = "completed" | "failed" | "stopped" | "unavailable";

export interface RunResult {
  status: RunStatus;
  exitCode: number | null;
  durationMs: number;
  summary?: string;
}

/** Sink for everything a runner wants to show the user. All text is rendered safely as text. */
export interface OutputSink {
  write(kind: OutputKind, text: string): void;
  build(kind: OutputKind, text: string): void;
  status(text: string): void;
}

export interface RunContext {
  project: ProjectManager;
  sink: OutputSink;
  /** Replace all diagnostics owned by `source`. */
  reportDiagnostics(source: string, diagnostics: Diagnostic[]): void;
}

/**
 * Every language adapter implements this. Adapters must be browser-only:
 * compilation and execution happen in Workers / sandboxed runtimes and never
 * leave the browser.
 */
export interface LanguageRunner {
  readonly id: string;
  readonly label: string;
  readonly languages: string[];
  readonly canBuild: boolean;
  run(path: string, ctx: RunContext): Promise<RunResult>;
  build?(entryPaths: string[], ctx: RunContext): Promise<RunResult>;
  stop(): void;
  dispose(): void;
}

export function stoppedResult(startedAt: number): RunResult {
  return { status: "stopped", exitCode: null, durationMs: performance.now() - startedAt, summary: "Stopped by user" };
}
