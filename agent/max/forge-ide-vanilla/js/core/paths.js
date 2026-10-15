const ROOT = "/";
function normalizePath(input) {
  const parts = input.replace(/\\/g, "/").split("/");
  const out = [];
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
function joinPath(...segments) {
  return normalizePath(segments.join("/"));
}
function dirname(path) {
  const p = normalizePath(path);
  const idx = p.lastIndexOf("/");
  if (idx <= 0) return ROOT;
  return p.slice(0, idx);
}
function basename(path) {
  const p = normalizePath(path);
  const idx = p.lastIndexOf("/");
  return p.slice(idx + 1);
}
function extname(path) {
  const name = basename(path);
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return "";
  return name.slice(idx).toLowerCase();
}
function stripExt(path) {
  const ext = extname(path);
  return ext ? path.slice(0, -ext.length) : path;
}
function resolveRelative(fromDir, relative) {
  if (relative.startsWith("/")) return normalizePath(relative);
  return normalizePath(fromDir + "/" + relative);
}
function isAncestor(ancestor, path) {
  if (ancestor === ROOT) return path !== ROOT;
  return path.startsWith(ancestor + "/");
}
const INVALID_NAME_CHARS = /[<>:"|?*\u0000-\u001f]/;
function validateName(name) {
  if (!name || !name.trim()) return "Name cannot be empty.";
  if (name === "." || name === "..") return "Invalid name.";
  if (INVALID_NAME_CHARS.test(name)) return 'Name contains invalid characters (< > : " | ? *).';
  if (name.length > 255) return "Name is too long.";
  return null;
}
function validateRelativePath(input) {
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
export {
  ROOT,
  basename,
  dirname,
  extname,
  isAncestor,
  joinPath,
  normalizePath,
  resolveRelative,
  stripExt,
  validateName,
  validateRelativePath
};
