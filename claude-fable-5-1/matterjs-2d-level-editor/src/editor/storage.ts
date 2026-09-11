import { DocumentError, parseDocumentText } from "./serialization";
import type { EditorDocument } from "./types";

export const STORAGE_NAMESPACE = "matter-level-editor";
export const STORAGE_KEY = `${STORAGE_NAMESPACE}:v1:document`;

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function hasSavedDocument() {
  const s = storage();
  return Boolean(s && s.getItem(STORAGE_KEY));
}

export function saveDocument(doc: EditorDocument): void {
  const s = storage();
  if (!s) throw new DocumentError("localStorage is not available in this browser");
  s.setItem(STORAGE_KEY, JSON.stringify(doc));
}

/** Returns null when nothing is stored. Throws DocumentError when stored data is corrupt. */
export function loadDocument(): EditorDocument | null {
  const s = storage();
  if (!s) return null;
  const text = s.getItem(STORAGE_KEY);
  if (!text) return null;
  return parseDocumentText(text);
}

export function clearSavedDocument() {
  storage()?.removeItem(STORAGE_KEY);
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickJsonFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";
    document.body.appendChild(input);
    let settled = false;
    const done = (value: string | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return done(null);
      file
        .text()
        .then((t) => done(t))
        .catch(() => done(null));
    });
    // If the dialog is cancelled we never get change; clean up lazily on focus return.
    window.addEventListener("focus", () => setTimeout(() => done(null), 1500), { once: true });
    input.click();
  });
}
