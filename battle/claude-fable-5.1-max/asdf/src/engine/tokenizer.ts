export type TokType = "num" | "ident" | "op" | "other";

export interface Token {
  type: TokType;
  text: string;
  /** absolute offsets within the source line */
  start: number;
  end: number;
  /** whitespace immediately preceding this token */
  ws: string;
}

const NUM_RE = /(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?/y;
export const IDENT_RE = /[\p{L}_°µμΩ][\p{L}0-9_°µμΩ²³¹⁰⁴⁵⁶⁷⁸⁹⁻]*/uy;
const WS_RE = /\s+/y;
const OPS = ["**", "->", "→", "+", "-", "*", "/", "^", "(", ")", "=", ",", "%", "!", "·", "×", "÷"];

/** Tokenize `src` starting at `from`. Unknown characters become `other` tokens. */
export function tokenize(src: string, from = 0): Token[] {
  const out: Token[] = [];
  let i = from;
  let ws = "";
  while (i < src.length) {
    WS_RE.lastIndex = i;
    const w = WS_RE.exec(src);
    if (w) {
      ws = w[0];
      i += w[0].length;
      continue;
    }
    NUM_RE.lastIndex = i;
    const n = NUM_RE.exec(src);
    if (n) {
      out.push({ type: "num", text: n[0], start: i, end: i + n[0].length, ws });
      i += n[0].length;
      ws = "";
      continue;
    }
    IDENT_RE.lastIndex = i;
    const id = IDENT_RE.exec(src);
    if (id) {
      out.push({ type: "ident", text: id[0], start: i, end: i + id[0].length, ws });
      i += id[0].length;
      ws = "";
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) {
      out.push({ type: "op", text: op, start: i, end: i + op.length, ws });
      i += op.length;
      ws = "";
      continue;
    }
    const ch = String.fromCodePoint(src.codePointAt(i)!);
    out.push({ type: "other", text: ch, start: i, end: i + ch.length, ws });
    i += ch.length;
    ws = "";
  }
  return out;
}

export function numberText(text: string): string {
  return text.replace(/,/g, "");
}

/** Decimal places written in a numeric literal (e.g. "0.001" → 3, "1e-6" → 6). */
export function literalDecimals(text: string): number {
  const t = numberText(text);
  const m = /^(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(t);
  if (!m) return 0;
  const frac = (m[2] ?? "").length;
  const exp = m[3] ? Number(m[3]) : 0;
  return Math.max(0, frac - exp);
}
