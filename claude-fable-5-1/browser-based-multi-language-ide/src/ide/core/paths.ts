/**
 * Path helpers for the virtual filesystem. All project paths are absolute,
 * POSIX-style, start with "/" and never end with "/" (except the root "/").
 */

export const ROOT = "/";

export function normalizePath(input: string): string {
  const parts = input.replace(/\\/g, "/").split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return "/" + out.join("/");
}

export function joinPath(...segments: string[]): string {
  return normalizePath(segments.join("/"));
}

export function dirname(path: string): string {
  const p = normalizePath(path);
  const idx = p.lastIndexOf("/");
  if (idx <= 0) return ROOT;
  return p.slice(0, idx);
}

export function basename(path: string): string {
  const p = normalizePath(path);
  const idx = p.lastIndexOf("/");
  return p.slice(idx + 1);
}

export function extname(path: string): string {
  const name = basename(path);
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return "";
  return name.slice(idx).toLowerCase();
}

export function stripExt(path: string): string {
  const ext = extname(path);
  return ext ? path.slice(0, -ext.length) : path;
}

/** Resolve `relative` against the directory `fromDir` (used by preview + module loaders). */
export function resolveRelative(fromDir: string, relative: string): string {
  if (relative.startsWith("/")) return normalizePath(relative);
  return normalizePath(fromDir + "/" + relative);
}

export function isAncestor(ancestor: string, path: string): boolean {
  if (ancestor === ROOT) return path !== ROOT;
  return path.startsWith(ancestor + "/");
}

const INVALID_NAME_CHARS = /[<>:"|?*\u0000-\u001f]/;

/** Validate a single path segment typed by the user. Returns an error string or null. */
export function validateName(name: string): string | null {
  if (!name || !name.trim()) return "Name cannot be empty.";
  if (name === "." || name === "..") return "Invalid name.";
  if (INVALID_NAME_CHARS.test(name)) return 'Name contains invalid characters (< > : " | ? *).';
  if (name.length > 255) return "Name is too long.";
  return null;
}

/** Validate a user-entered path that may include nested segments ("a/b/c.txt"). */
export function validateRelativePath(input: string): string | null {
  const trimmed = input.trim().replace(/\\/g, "/");
  if (!trimmed) return "Name cannot be empty.";
  if (trimmed.startsWith("/")) return "Path must be relative to the selected folder.";
  for (const segment of trimmed.split("/")) {
    if (segment === "") return "Path contains an empty segment.";
    const err = validateName(segment);
    if (err) return err;
  }
  return null;
}
