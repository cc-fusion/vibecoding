export interface EditorElements {
  ta: HTMLTextAreaElement;
  mirror: HTMLElement;
  mi: HTMLElement;
  bar: HTMLElement;
  chipsEl: HTMLElement;
}

export function createEditor(els: EditorElements): { destroy(): void };
