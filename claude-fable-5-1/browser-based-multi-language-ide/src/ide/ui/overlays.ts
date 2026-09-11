import { icons, type IconName } from "../core/icons";

export interface MenuItem {
  label?: string;
  icon?: IconName;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  checked?: boolean;
  onSelect?: () => void;
}

let activeMenu: HTMLElement | null = null;
let activeMenuCleanup: (() => void) | null = null;

export function closeContextMenu(): void {
  activeMenuCleanup?.();
  activeMenuCleanup = null;
  activeMenu?.remove();
  activeMenu = null;
}

export function buildMenuItems(container: HTMLElement, items: MenuItem[], onClose: () => void): void {
  for (const item of items) {
    if (item.separator) {
      const sep = document.createElement("div");
      sep.className = "menu-separator";
      container.appendChild(sep);
      continue;
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "menu-item" + (item.danger ? " danger" : "");
    b.setAttribute("role", "menuitem");
    b.disabled = !!item.disabled;
    const left = document.createElement("span");
    left.style.display = "inline-flex";
    left.style.alignItems = "center";
    left.style.gap = "8px";
    if (item.checked !== undefined) {
      const chk = document.createElement("span");
      chk.style.width = "14px";
      chk.style.display = "inline-flex";
      if (item.checked) chk.innerHTML = icons.check; // static icon
      left.appendChild(chk);
    }
    const label = document.createElement("span");
    label.textContent = item.label ?? "";
    left.appendChild(label);
    b.appendChild(left);
    if (item.shortcut) {
      const kbd = document.createElement("kbd");
      kbd.textContent = item.shortcut;
      b.appendChild(kbd);
    }
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      onClose();
      item.onSelect?.();
    });
    container.appendChild(b);
  }
}

export function showContextMenu(x: number, y: number, items: MenuItem[]): void {
  closeContextMenu();
  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.setAttribute("role", "menu");
  buildMenuItems(menu, items, closeContextMenu);
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  menu.style.left = Math.max(4, Math.min(x, window.innerWidth - rect.width - 4)) + "px";
  menu.style.top = Math.max(4, Math.min(y, window.innerHeight - rect.height - 4)) + "px";
  activeMenu = menu;
  const focusables = () => Array.from(menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
  focusables()[0]?.focus();
  const onKey = (e: KeyboardEvent) => {
    const list = focusables();
    const idx = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      closeContextMenu();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(idx + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(idx - 1 + list.length) % list.length]?.focus();
    }
  };
  const onPointer = (e: Event) => {
    if (!menu.contains(e.target as Node)) closeContextMenu();
  };
  setTimeout(() => {
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", closeContextMenu);
    window.addEventListener("resize", closeContextMenu);
  }, 0);
  activeMenuCleanup = () => {
    document.removeEventListener("pointerdown", onPointer, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("blur", closeContextMenu);
    window.removeEventListener("resize", closeContextMenu);
  };
}

export interface PickerItem<T> {
  label: string;
  value: T;
  active?: boolean;
  detail?: string;
}

/** Small anchored list picker (language selector, indentation). */
export function showPicker<T>(anchor: HTMLElement, items: PickerItem<T>[], onPick: (value: T) => void): void {
  const rect = anchor.getBoundingClientRect();
  showContextMenu(rect.left, rect.top - 8, [] as MenuItem[]);
  const menu = activeMenu!;
  menu.className = "picker";
  buildMenuItems(
    menu,
    items.map((i) => ({ label: i.label + (i.detail ? `  ${i.detail}` : ""), checked: !!i.active, onSelect: () => onPick(i.value) })),
    closeContextMenu
  );
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - r.width - 4)) + "px";
  menu.style.top = Math.max(4, rect.top - r.height - 6) + "px";
  (menu.querySelector("button") as HTMLButtonElement | null)?.focus();
}

function overlay(center: boolean): HTMLElement {
  const backdrop = document.createElement("div");
  backdrop.className = "overlay-backdrop" + (center ? " center" : "");
  return backdrop;
}

export function confirmDialog(opts: { title: string; message: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    const backdrop = overlay(true);
    const dialog = document.createElement("div");
    dialog.className = "dialog";
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-modal", "true");
    const h = document.createElement("h3");
    h.textContent = opts.title;
    const p = document.createElement("p");
    p.textContent = opts.message;
    const actions = document.createElement("div");
    actions.className = "actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn";
    cancel.textContent = "Cancel";
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "btn " + (opts.danger ? "danger" : "primary");
    ok.textContent = opts.confirmLabel ?? "OK";
    actions.append(cancel, ok);
    dialog.append(h, p, actions);
    backdrop.appendChild(dialog);
    const done = (v: boolean) => {
      document.removeEventListener("keydown", onKey, true);
      backdrop.remove();
      resolve(v);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        done(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        done(true);
      }
    };
    cancel.addEventListener("click", () => done(false));
    ok.addEventListener("click", () => done(true));
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) done(false);
    });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(backdrop);
    ok.focus();
  });
}

export function promptDialog(opts: { title: string; message?: string; value?: string; placeholder?: string; confirmLabel?: string; validate?: (v: string) => string | null }): Promise<string | null> {
  return new Promise((resolve) => {
    const backdrop = overlay(false);
    const dialog = document.createElement("div");
    dialog.className = "dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    const h = document.createElement("h3");
    h.textContent = opts.title;
    dialog.appendChild(h);
    if (opts.message) {
      const p = document.createElement("p");
      p.textContent = opts.message;
      dialog.appendChild(p);
    }
    const input = document.createElement("input");
    input.className = "text";
    input.type = "text";
    input.value = opts.value ?? "";
    input.placeholder = opts.placeholder ?? "";
    input.spellcheck = false;
    const err = document.createElement("p");
    err.style.color = "var(--danger)";
    err.style.minHeight = "16px";
    err.style.margin = "-8px 0 10px";
    const actions = document.createElement("div");
    actions.className = "actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn";
    cancel.textContent = "Cancel";
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "btn primary";
    ok.textContent = opts.confirmLabel ?? "OK";
    actions.append(cancel, ok);
    dialog.append(input, err, actions);
    backdrop.appendChild(dialog);
    const done = (v: string | null) => {
      document.removeEventListener("keydown", onKey, true);
      backdrop.remove();
      resolve(v);
    };
    const submit = () => {
      const v = input.value;
      const problem = opts.validate?.(v) ?? null;
      if (problem) {
        err.textContent = problem;
        input.focus();
        return;
      }
      done(v);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        done(null);
      } else if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    };
    cancel.addEventListener("click", () => done(null));
    ok.addEventListener("click", submit);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) done(null);
    });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(backdrop);
    input.focus();
    input.select();
  });
}

export class Toasts {
  private host: HTMLElement;
  constructor() {
    this.host = document.createElement("div");
    this.host.className = "toasts";
    this.host.setAttribute("aria-live", "polite");
    document.body.appendChild(this.host);
  }
  show(text: string, kind: "info" | "error" | "warn" | "success" = "info", timeoutMs = 4500): void {
    const t = document.createElement("div");
    t.className = `toast ${kind}`;
    t.textContent = text;
    this.host.appendChild(t);
    while (this.host.childElementCount > 4) this.host.removeChild(this.host.firstElementChild!);
    window.setTimeout(() => t.remove(), timeoutMs);
  }
}
