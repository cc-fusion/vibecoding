/* Client access to the standalone MPM.js library.
 * Primary path: <script src="/lib/mpm.js"> in index.html (the documented usage).
 * Fallback: if the global is missing (e.g. single-file serving), evaluate the
 * bundled raw source and hand it to the worker spawner via __inlineSource. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MPMType = any;

declare global {
  interface Window {
    MPM?: MPMType;
  }
}

let promise: Promise<MPMType> | null = null;

export function loadMPM(): Promise<MPMType> {
  if (window.MPM) return Promise.resolve(window.MPM);
  if (!promise) {
    promise = import("../lib/mpm.js?raw").then((mod) => {
      const src: string = mod.default;
      // eslint-disable-next-line no-new-func
      new Function(src)();
      if (window.MPM) window.MPM.__inlineSource = src;
      return window.MPM;
    });
  }
  return promise;
}

export async function downloadLibrary() {
  const mod = await import("../lib/mpm.js?raw");
  triggerDownload(mod.default, "mpm.js", "text/javascript");
}

export async function downloadDocs() {
  const mod = await import("../docs.md?raw");
  triggerDownload(mod.default, "MPM.js-DOCS.md", "text/markdown");
}

export async function rawDocs(): Promise<string> {
  const mod = await import("../docs.md?raw");
  return mod.default;
}

function triggerDownload(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
