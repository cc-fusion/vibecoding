/**
 * Loads the real Monaco Editor (pinned version) from jsDelivr using Monaco's
 * AMD loader. Language-service workers are created through a Blob proxy that
 * imports the CDN worker script, which is the documented approach for
 * cross-origin Monaco deployments. The application bundle itself stays a
 * single static file.
 */

// Monaco's public API surface is large; the ambient types come from the CDN
// build at runtime, so we treat the namespace structurally here.
export type Monaco = any;
export type ICodeEditor = any;
export type ITextModel = any;
export type IEditorViewState = any;

export const MONACO_VERSION = "0.52.2";
const MONACO_BASE = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min`;

let loading: Promise<Monaco> | null = null;

declare global {
  interface Window {
    monaco?: Monaco;
    require?: any;
    MonacoEnvironment?: any;
  }
}

export function loadMonaco(): Promise<Monaco> {
  if (window.monaco) return Promise.resolve(window.monaco);
  if (loading) return loading;

  loading = new Promise<Monaco>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`Timed out loading Monaco Editor from ${MONACO_BASE}`)), 60_000);

    const proxySource = `self.MonacoEnvironment = { baseUrl: '${MONACO_BASE}/' };\nimportScripts('${MONACO_BASE}/vs/base/worker/workerMain.js');`;
    const proxyBlob = new Blob([proxySource], { type: "text/javascript" });
    const proxyUrl = URL.createObjectURL(proxyBlob);
    window.MonacoEnvironment = {
      getWorkerUrl: () => proxyUrl,
    };

    const script = document.createElement("script");
    script.src = `${MONACO_BASE}/vs/loader.js`;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error(`Failed to download Monaco loader from ${MONACO_BASE}/vs/loader.js (offline or CDN blocked?)`));
    };
    script.onload = () => {
      const amdRequire = window.require;
      if (!amdRequire || typeof amdRequire.config !== "function") {
        window.clearTimeout(timeout);
        reject(new Error("Monaco AMD loader did not initialize."));
        return;
      }
      amdRequire.config({ paths: { vs: `${MONACO_BASE}/vs` } });
      amdRequire(
        ["vs/editor/editor.main"],
        () => {
          window.clearTimeout(timeout);
          if (!window.monaco) return reject(new Error("Monaco loaded but window.monaco is undefined."));
          resolve(window.monaco);
        },
        (err: unknown) => {
          window.clearTimeout(timeout);
          reject(err instanceof Error ? err : new Error(`Monaco module load failed: ${String(err)}`));
        }
      );
    };
    document.head.appendChild(script);
  });
  return loading;
}
