import { ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useEditor, useEditorVersion } from "@/editor/useEditor";

export const MIXED = Symbol("mixed");
export type Mixed = typeof MIXED;

export function Row({ label, children, htmlFor }: { label: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field-row">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

export function Section({ id, title, children, defaultOpen = true, badge }: { id: string; title: string; children: ReactNode; defaultOpen?: boolean; badge?: ReactNode }) {
  const editor = useEditor();
  useEditorVersion();
  const collapsed = editor.settings.ui.collapsed[id] ?? !defaultOpen;
  return (
    <section className="section">
      <button type="button" className={`section-head ${collapsed ? "" : "is-open"}`} aria-expanded={!collapsed} onClick={() => editor.setCollapsed(id, !collapsed)}>
        <span>{title}</span>
        {badge}
        <ChevronRight size={14} className="chev" aria-hidden />
      </button>
      {!collapsed && <div className="section-body">{children}</div>}
    </section>
  );
}

interface NumberFieldProps {
  label?: ReactNode;
  value: number | Mixed;
  onCommit: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  decimals?: number;
  disabled?: boolean;
  slider?: boolean;
  title?: string;
  id?: string;
  bare?: boolean;
}

function fmt(v: number, decimals: number) {
  if (!Number.isFinite(v)) return "";
  const s = v.toFixed(decimals);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/** Numeric input that holds a draft while focused and commits on blur/Enter. Supports a mixed state. */
export function NumberField(props: NumberFieldProps) {
  const { label, value, onCommit, step = 1, min, max, unit, decimals = 2, disabled, slider, title, bare } = props;
  const autoId = useId();
  const id = props.id ?? autoId;
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const isMixed = value === MIXED;
  const display = draft !== null ? draft : isMixed ? "" : fmt(value as number, decimals);

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft.trim());
    if (draft.trim() === "" || !Number.isFinite(n)) {
      setInvalid(true);
      return;
    }
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    setDraft(null);
    setInvalid(false);
    if (isMixed || v !== value) onCommit(v);
  };

  const input = (
    <div className={`field-with-unit ${slider ? "flex items-center gap-2" : ""}`}>
      {slider && !isMixed && (
        <input
          type="range"
          aria-label={typeof label === "string" ? `${label} slider` : "slider"}
          min={min ?? 0}
          max={max ?? 1}
          step={step}
          value={value as number}
          disabled={disabled}
          onChange={(e) => onCommit(Number(e.target.value))}
        />
      )}
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className={`field-input ${isMixed && draft === null ? "is-mixed" : ""} ${invalid ? "is-invalid" : ""}`}
        style={slider ? { width: 76, flexShrink: 0 } : undefined}
        value={display}
        placeholder={isMixed ? "Mixed" : undefined}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        title={title}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          setDraft(e.target.value);
          setInvalid(false);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setDraft(null);
            setInvalid(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {unit && !slider && <span className="unit">{unit}</span>}
    </div>
  );
  if (bare || !label) return input;
  return (
    <Row label={label} htmlFor={id}>
      {input}
    </Row>
  );
}

export function TextField({ label, value, onCommit, placeholder, id: idProp }: { label: ReactNode; value: string | Mixed; onCommit: (v: string) => void; placeholder?: string; id?: string }) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [draft, setDraft] = useState<string | null>(null);
  const isMixed = value === MIXED;
  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    if (isMixed || draft !== value) onCommit(draft);
  };
  return (
    <Row label={label} htmlFor={id}>
      <input
        id={id}
        type="text"
        className={`field-input ${isMixed && draft === null ? "is-mixed" : ""}`}
        style={{ fontFamily: "var(--font-ui)" }}
        value={draft ?? (isMixed ? "" : (value as string))}
        placeholder={isMixed ? "Mixed" : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </Row>
  );
}

export function CheckField({ label, checked, onChange, hint, disabled }: { label: ReactNode; checked: boolean | Mixed; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const id = useId();
  const isMixed = checked === MIXED;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = isMixed;
  }, [isMixed]);
  return (
    <div className="field-row" style={{ gridTemplateColumns: "96px 1fr" }}>
      <label htmlFor={id}>{label}</label>
      <div className="flex items-center gap-2 min-h-[28px]">
        <input ref={ref} id={id} type="checkbox" checked={isMixed ? false : checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="hint">{isMixed ? "Mixed" : hint}</span>
      </div>
    </div>
  );
}

export function SelectField<T extends string>({ label, value, options, onChange }: { label: ReactNode; value: T | Mixed; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = useId();
  const isMixed = value === MIXED;
  return (
    <Row label={label} htmlFor={id}>
      <select id={id} className="field-select" value={isMixed ? "" : (value as string)} onChange={(e) => onChange(e.target.value as T)}>
        {isMixed && (
          <option value="" disabled>
            Mixed
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Row>
  );
}

export function ColorField({ label, value, onChange }: { label: ReactNode; value: string | Mixed; onChange: (v: string) => void }) {
  const id = useId();
  const isMixed = value === MIXED;
  const [draft, setDraft] = useState<string | null>(null);
  const hex = isMixed ? "#888888" : normalizeHex(value as string);
  const commitText = () => {
    if (draft === null) return;
    const v = draft.trim();
    setDraft(null);
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) onChange(v.toLowerCase());
  };
  return (
    <Row label={label} htmlFor={id}>
      <div className="flex items-center gap-2">
        <input id={id} type="color" className="field-input" value={hex} onChange={(e) => onChange(e.target.value)} aria-label={typeof label === "string" ? label : "color"} />
        <input
          type="text"
          className={`field-input flex-1 ${isMixed && draft === null ? "is-mixed" : ""}`}
          value={draft ?? (isMixed ? "" : (value as string))}
          placeholder={isMixed ? "Mixed" : "#rrggbb"}
          aria-label={`${typeof label === "string" ? label : "color"} hex`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commitText();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </div>
    </Row>
  );
}

function normalizeHex(v: string) {
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return "#888888";
}

/** Collapses a list of values into a single value or MIXED. */
export function shared<T>(values: T[]): T | Mixed {
  if (!values.length) return MIXED;
  const first = values[0];
  return values.every((v) => v === first) ? first : MIXED;
}
