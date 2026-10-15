import { EventEmitter } from "../core/EventEmitter.js";
import { icons } from "../core/icons.js";
const MAX_LINES = 4e3;
class OutputManager extends EventEmitter {
  constructor(root, ui) {
    super();
    this.ui = ui;
    root.classList.add("panel");
    const header = el("div", "panel-header");
    const tabs = [["output", "Output"], ["terminal", "Terminal"], ["problems", "Problems"], ["build", "Build"]];
    this.problemsCount = el("span", "count");
    for (const [id, label] of tabs) {
      const b = el("button", "panel-tab");
      b.type = "button";
      b.textContent = label;
      b.setAttribute("role", "tab");
      if (id === "problems") b.appendChild(this.problemsCount);
      b.addEventListener("click", () => ui.set({ activePanelTab: id }));
      this.tabButtons.set(id, b);
      header.appendChild(b);
    }
    header.appendChild(el("span", "spacer"));
    header.append(
      this.iconButton("clear", "Clear", () => this.clear()),
      this.iconButton("copy", "Copy contents", () => void this.copy()),
      this.iconButton("scrollDown", "Scroll to bottom", () => this.scrollToBottom()),
      this.iconButton("collapse", "Collapse panel", () => ui.set({ panelVisible: false }))
    );
    const body = el("div", "panel-body");
    this.channels = { output: el("div", "channel output"), terminal: el("div", "channel terminal"), build: el("div", "channel build") };
    this.problemsContainer = el("div", "channel problems");
    for (const c of Object.values(this.channels)) {
      c.setAttribute("role", "log");
      c.setAttribute("aria-live", "polite");
    }
    this.terminalLog = el("div", "terminal-log");
    const inputRow = el("div", "terminal-input-row");
    const prompt = el("span", "prompt");
    prompt.textContent = "forge \u276F";
    this.terminalInput = document.createElement("input");
    this.terminalInput.type = "text";
    this.terminalInput.placeholder = "IDE command console \u2014 type `help` (this is not an OS shell)";
    this.terminalInput.setAttribute("aria-label", "IDE command console input");
    this.terminalInput.spellcheck = false;
    this.terminalInput.addEventListener("keydown", (e) => this.onTerminalKey(e));
    inputRow.append(prompt, this.terminalInput);
    this.channels.terminal.append(this.terminalLog, inputRow);
    this.channels.terminal.addEventListener("click", (e) => {
      if (e.target.closest(".terminal-log") && !window.getSelection()?.toString()) this.terminalInput.focus();
    });
    body.append(this.channels.output, this.channels.terminal, this.problemsContainer, this.channels.build);
    root.append(header, body);
    this.sink = {
      write: (kind, text) => this.append("output", kind, text),
      build: (kind, text) => this.append("build", kind, text),
      status: (text) => this.emit("status", { text })
    };
    ui.on("change", ({ changed }) => {
      if (changed.includes("activePanelTab")) this.renderActive();
    });
    this.renderActive();
    this.append("terminal", "system", "Forge IDE command console. Commands run inside the IDE (no operating-system shell is available in the browser). Type `help`.");
  }
  ui;
  sink;
  problemsContainer;
  channels;
  terminalLog;
  terminalInput;
  tabButtons = /* @__PURE__ */ new Map();
  problemsCount;
  history = [];
  historyIndex = -1;
  append(channel, kind, text) {
    const target = channel === "terminal" ? this.terminalLog : this.channels[channel];
    const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 40;
    const lines = String(text).split("\n");
    for (const lineText of lines) {
      const line = el("div", `line ${kind}`);
      line.textContent = lineText;
      target.appendChild(line);
    }
    while (target.childElementCount > MAX_LINES) target.removeChild(target.firstElementChild);
    if (nearBottom) target.scrollTop = target.scrollHeight;
  }
  terminalEcho(command) {
    const line = el("div", "line cmd");
    line.textContent = command;
    this.terminalLog.appendChild(line);
    this.terminalLog.scrollTop = this.terminalLog.scrollHeight;
  }
  show(tab) {
    this.ui.set({ panelVisible: true, activePanelTab: tab });
  }
  setProblemCount(errors, warnings) {
    const total = errors + warnings;
    this.problemsCount.textContent = total ? String(total) : "";
    this.problemsCount.classList.toggle("errors", errors > 0);
    this.problemsCount.style.display = total ? "" : "none";
  }
  clear(tab = this.ui.get().activePanelTab) {
    if (tab === "problems") return;
    const target = tab === "terminal" ? this.terminalLog : this.channels[tab];
    target.textContent = "";
  }
  async copy(tab = this.ui.get().activePanelTab) {
    const target = tab === "problems" ? this.problemsContainer : tab === "terminal" ? this.terminalLog : this.channels[tab];
    const text = Array.from(target.querySelectorAll(".line, .problem-row")).map((l) => l.innerText).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      this.emit("status", { text: "Copied panel contents" });
    } catch {
      this.emit("status", { text: "Clipboard access denied" });
    }
  }
  scrollToBottom(tab = this.ui.get().activePanelTab) {
    const target = tab === "problems" ? this.problemsContainer : tab === "terminal" ? this.terminalLog : this.channels[tab];
    target.scrollTop = target.scrollHeight;
  }
  focusTerminal() {
    this.terminalInput.focus();
  }
  renderActive() {
    const active = this.ui.get().activePanelTab;
    for (const [id, b] of this.tabButtons) {
      b.classList.toggle("active", id === active);
      b.setAttribute("aria-selected", String(id === active));
    }
    this.channels.output.classList.toggle("active", active === "output");
    this.channels.terminal.classList.toggle("active", active === "terminal");
    this.channels.build.classList.toggle("active", active === "build");
    this.problemsContainer.classList.toggle("active", active === "problems");
  }
  onTerminalKey(e) {
    if (e.key === "Enter") {
      const cmd = this.terminalInput.value.trim();
      this.terminalInput.value = "";
      if (!cmd) return;
      this.history.push(cmd);
      this.historyIndex = this.history.length;
      this.terminalEcho(cmd);
      this.emit("command", { command: cmd });
    } else if (e.key === "ArrowUp") {
      if (this.historyIndex > 0) this.terminalInput.value = this.history[--this.historyIndex];
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      if (this.historyIndex < this.history.length - 1) this.terminalInput.value = this.history[++this.historyIndex];
      else {
        this.historyIndex = this.history.length;
        this.terminalInput.value = "";
      }
      e.preventDefault();
    }
  }
  iconButton(icon, title, onClick) {
    const b = el("button", "icon-btn");
    b.type = "button";
    b.title = title;
    b.setAttribute("aria-label", title);
    b.innerHTML = icons[icon];
    b.addEventListener("click", onClick);
    return b;
  }
}
function el(tag, className) {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}
export {
  OutputManager
};
