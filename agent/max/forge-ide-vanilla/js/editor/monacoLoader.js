const MONACO_VERSION = "0.52.2";
const MONACO_BASE = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min`;
let loading = null;
function loadMonaco() {
  if (window.monaco) return Promise.resolve(window.monaco);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`Timed out loading Monaco Editor from ${MONACO_BASE}`)), 6e4);
    const proxySource = `self.MonacoEnvironment = { baseUrl: '${MONACO_BASE}/' };
importScripts('${MONACO_BASE}/vs/base/worker/workerMain.js');`;
    const proxyBlob = new Blob([proxySource], { type: "text/javascript" });
    const proxyUrl = URL.createObjectURL(proxyBlob);
    window.MonacoEnvironment = {
      getWorkerUrl: () => proxyUrl
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
        (err) => {
          window.clearTimeout(timeout);
          reject(err instanceof Error ? err : new Error(`Monaco module load failed: ${String(err)}`));
        }
      );
    };
    document.head.appendChild(script);
  });
  return loading;
}
export {
  MONACO_VERSION,
  loadMonaco
};
