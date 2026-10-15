import { basename } from "../core/paths.js";
class QuickOpen {
  constructor(project, onOpen) {
    this.project = project;
    this.onOpen = onOpen;
  }
  project;
  onOpen;
  backdrop = null;
  input;
  list;
  matches = [];
  index = 0;
  get isOpen() {
    return !!this.backdrop;
  }
  open() {
    if (this.backdrop) {
      this.input.focus();
      this.input.select();
      return;
    }
    const backdrop = document.createElement("div");
    backdrop.className = "overlay-backdrop";
    const box = document.createElement("div");
    box.className = "quick-open";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Quick Open");
    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.placeholder = "Search files by name or path\u2026";
    this.input.setAttribute("aria-label", "Search files");
    this.input.spellcheck = false;
    this.list = document.createElement("div");
    this.list.className = "results";
    this.list.setAttribute("role", "listbox");
    box.append(this.input, this.list);
    backdrop.appendChild(box);
    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) this.close();
    });
    this.input.addEventListener("input", () => this.update());
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.move(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.move(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        this.choose(this.index);
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    });
    document.body.appendChild(backdrop);
    this.backdrop = backdrop;
    this.update();
    this.input.focus();
  }
  close() {
    this.backdrop?.remove();
    this.backdrop = null;
  }
  update() {
    const query = this.input.value.trim();
    const files = this.project.allFiles().map((f) => f.path);
    this.matches = files.map((path) => fuzzy(query, path)).filter((m) => !!m).sort((a, b) => b.score - a.score || a.path.length - b.path.length).slice(0, 60);
    this.index = 0;
    this.renderList();
  }
  renderList() {
    this.list.textContent = "";
    if (!this.matches.length) {
      const empty = document.createElement("div");
      empty.className = "qo-empty";
      empty.textContent = "No matching files";
      this.list.appendChild(empty);
      return;
    }
    this.matches.forEach((m, i) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "qo-item" + (i === this.index ? " selected" : "");
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(i === this.index));
      const lang = this.project.languageOf(m.path);
      const icon = document.createElement("span");
      icon.className = "file-icon";
      icon.style.background = lang.color;
      icon.textContent = lang.badge;
      const name = document.createElement("span");
      name.className = "name";
      const dir = m.path.slice(0, m.path.length - basename(m.path).length);
      highlight(name, basename(m.path), m.positions.map((p) => p - dir.length).filter((p) => p >= 0));
      const path = document.createElement("span");
      path.className = "path";
      highlight(path, dir.replace(/^\//, ""), m.positions.filter((p) => p < dir.length).map((p) => p - 1));
      item.append(icon, name, path);
      item.addEventListener("mousemove", () => {
        if (this.index !== i) {
          this.index = i;
          this.renderList();
        }
      });
      item.addEventListener("click", () => this.choose(i));
      this.list.appendChild(item);
    });
  }
  move(delta) {
    if (!this.matches.length) return;
    this.index = (this.index + delta + this.matches.length) % this.matches.length;
    this.renderList();
    this.list.querySelector(".qo-item.selected")?.scrollIntoView({ block: "nearest" });
  }
  choose(i) {
    const m = this.matches[i];
    if (!m) return;
    this.close();
    this.onOpen(m.path);
  }
}
function highlight(target, text, positions) {
  const set = new Set(positions);
  let buffer = "";
  let marked = false;
  const flush = () => {
    if (!buffer) return;
    if (marked) {
      const mark = document.createElement("mark");
      mark.textContent = buffer;
      target.appendChild(mark);
    } else target.appendChild(document.createTextNode(buffer));
    buffer = "";
  };
  for (let i = 0; i < text.length; i++) {
    const isMarked = set.has(i);
    if (isMarked !== marked) {
      flush();
      marked = isMarked;
    }
    buffer += text[i];
  }
  flush();
}
function fuzzy(query, path) {
  if (!query) return { path, score: 0, positions: [] };
  const q = query.toLowerCase();
  const p = path.toLowerCase();
  const nameStart = p.lastIndexOf("/") + 1;
  const positions = [];
  let score = 0;
  let pi = 0;
  let last = -2;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    if (ch === " ") continue;
    const found = p.indexOf(ch, pi);
    if (found === -1) return null;
    positions.push(found);
    let gain = 1;
    if (found >= nameStart) gain += 3;
    if (found === last + 1) gain += 4;
    if (found === 0 || /[\/._\-]/.test(p[found - 1])) gain += 3;
    score += gain;
    last = found;
    pi = found + 1;
  }
  if (p.slice(nameStart).startsWith(q)) score += 20;
  if (p.slice(nameStart) === q) score += 40;
  score -= (path.length - q.length) * 0.05;
  return { path, score, positions };
}
export {
  QuickOpen
};
