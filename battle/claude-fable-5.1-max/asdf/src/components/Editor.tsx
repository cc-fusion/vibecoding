import { forwardRef, useEffect, useRef, type KeyboardEvent, type ChangeEvent, type SyntheticEvent } from "react";
import { truncatePreview } from "@/engine/format";

export interface Ghost {
  text: string;
  replaceBefore: number;
}

interface EditorProps {
  text: string;
  caret: number;
  ghost: Ghost | null;
  fontSize: number;
  onChange: (text: string, start: number, end: number) => void;
  onSelectionChange: (start: number, end: number) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}

const GHOST_MAX = 200;

export const Editor = forwardRef<HTMLTextAreaElement, EditorProps>(function Editor(
  { text, caret, ghost, fontSize, onChange, onSelectionChange, onKeyDown },
  ref,
) {
  const markerRef = useRef<HTMLSpanElement>(null);
  const lastText = useRef(text);

  // Keep the caret visible while typing near the bottom of the page.
  useEffect(() => {
    if (lastText.current !== text) {
      lastText.current = text;
      markerRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [text, caret]);

  const ghostStart = ghost ? Math.max(0, caret - ghost.replaceBefore) : caret;
  const before = text.slice(0, ghostStart);
  const after = text.slice(caret);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value, e.target.selectionStart, e.target.selectionEnd);
  };
  const handleSelect = (e: SyntheticEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget;
    onSelectionChange(t.selectionStart, t.selectionEnd);
  };

  return (
    <div className="relative w-full" style={{ fontSize: `${fontSize}px`, lineHeight: 1.65 }}>
      <pre className="editor-layer editor-overlay" aria-hidden="true">
        {before}
        <span ref={markerRef} className="caret-marker" />
        {ghost && <span className="ghost">{truncatePreview(ghost.text, GHOST_MAX)}</span>}
        {after}
        {text.length === 0 && !ghost && (
          <span className="ghost">Start typing — try 1 + 1, sin 30, 1500 g or 1 km to mi</span>
        )}
        {"\u200b"}
      </pre>
      <textarea
        ref={ref}
        className="editor-layer editor-textarea"
        value={text}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyUp={handleSelect}
        onClick={handleSelect}
        onKeyDown={onKeyDown}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        autoFocus
        aria-label="Text editor"
      />
    </div>
  );
});
