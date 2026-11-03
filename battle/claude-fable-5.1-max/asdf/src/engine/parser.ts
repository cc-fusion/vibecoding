import Decimal from "decimal.js";
import { literalDecimals, numberText, type Token } from "./tokenizer";
import { DEFAULT_STYLE, type DisplayUnit, type UnitPart, type UnitRegistry, type UnitStyle } from "./units";

export type Node =
  | { kind: "num"; value: Decimal; text: string }
  | { kind: "quantity"; value: Decimal; text: string; unit: DisplayUnit }
  | { kind: "unit"; unit: DisplayUnit }
  | { kind: "const"; name: string }
  | { kind: "unary"; op: "-" | "+"; arg: Node }
  | { kind: "binary"; op: "+" | "-" | "*" | "/" | "**" | "implicit"; left: Node; right: Node }
  | { kind: "postfix"; op: "%" | "!"; arg: Node }
  | { kind: "call"; name: string; args: Node[] }
  | { kind: "convert"; expr: Node; target: DisplayUnit };

export interface ParseMeta {
  style: UnitStyle;
  /** unit chains in order of appearance */
  inputUnits: DisplayUnit[];
  hasBinary: boolean;
  hasCall: boolean;
  hasConst: boolean;
  hasPostfix: boolean;
  isConvert: boolean;
  /** max decimal places among numeric literals */
  maxDecimals: number;
  /** index (into the token slice) of the last binary operator, -1 if none */
  lastBinaryOp: number;
  /** expression is a single (optionally signed) quantity literal */
  bareQuantity: boolean;
  /** absolute offset of the conversion target text, -1 if none */
  convertTargetStart: number;
}

export interface Parsed {
  node: Node;
  meta: ParseMeta;
  tokens: Token[];
}

export class ParseError extends Error {}

export const CONSTANTS = new Set(["pi", "π", "e", "tau", "τ", "phi", "φ"]);
export const FUNCTIONS = new Set([
  "sin", "cos", "tan", "sec", "csc", "cot",
  "asin", "acos", "atan", "arcsin", "arccos", "arctan",
  "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
  "sqrt", "cbrt", "root", "ln", "log", "log10", "log2", "lg", "exp",
  "abs", "floor", "ceil", "round", "trunc", "sign",
  "min", "max", "atan2", "hypot", "pow", "mod", "fact", "factorial",
]);

export interface ParseOptions {
  /** allow the expression to start with a bare unit (e.g. `kg to lb`) */
  allowBareUnitFirst?: boolean;
}

export function parse(tokens: Token[], registry: UnitRegistry, opts: ParseOptions = {}): Parsed {
  const p = new Parser(tokens, registry, opts);
  const node = p.parseAll();
  return { node, meta: p.meta, tokens };
}

class Parser {
  pos = 0;
  meta: ParseMeta = {
    style: { ...DEFAULT_STYLE },
    inputUnits: [],
    hasBinary: false,
    hasCall: false,
    hasConst: false,
    hasPostfix: false,
    isConvert: false,
    maxDecimals: 0,
    lastBinaryOp: -1,
    bareQuantity: false,
    convertTargetStart: -1,
  };
  private styleSeen = { exp: false, neg: false, mul: false };

  constructor(
    private toks: Token[],
    private reg: UnitRegistry,
    private opts: ParseOptions,
  ) {}

  private peek(o = 0): Token | undefined {
    return this.toks[this.pos + o];
  }
  private isOp(t: Token | undefined, ...names: string[]): boolean {
    return !!t && t.type === "op" && names.includes(t.text);
  }
  private fail(msg: string): never {
    throw new ParseError(msg);
  }
  private setStyle<K extends keyof UnitStyle>(k: K, v: UnitStyle[K]) {
    if (!this.styleSeen[k]) {
      this.styleSeen[k] = true;
      this.meta.style[k] = v;
    }
  }

  isConvKeywordAt(i: number): boolean {
    const t = this.toks[i];
    if (!t) return false;
    if (t.type === "op" && (t.text === "->" || t.text === "→")) return true;
    if (t.type === "ident") {
      if (t.text === "to") return true;
      if (t.text === "in") {
        const n = this.toks[i + 1];
        return !!n && n.type === "ident" && !!this.reg.resolveIdent(n.text);
      }
    }
    return false;
  }

  private unitIdentAt(i: number): boolean {
    const t = this.toks[i];
    return !!t && t.type === "ident" && !this.isConvKeywordAt(i) && !!this.reg.resolveIdent(t.text);
  }

  private canStartFactor(i: number): boolean {
    const t = this.toks[i];
    if (!t) return false;
    if (t.type === "num") return true;
    if (this.isOp(t, "(")) return true;
    if (t.type === "ident") {
      if (CONSTANTS.has(t.text) || FUNCTIONS.has(t.text)) return true;
      return this.unitIdentAt(i);
    }
    return false;
  }

  parseAll(): Node {
    if (!this.toks.length) this.fail("empty");
    let node = this.parseAdditive();
    if (this.isConvKeywordAt(this.pos)) {
      const opIdx = this.pos;
      this.pos++;
      const first = this.peek();
      if (!first) this.fail("missing conversion target");
      const startIdx = this.pos;
      const target = this.parseUnitChain();
      if (!target) this.fail("bad conversion target");
      target.text = this.toks
        .slice(startIdx, this.pos)
        .map((t, i) => (i ? t.ws : "") + t.text)
        .join("");
      node = { kind: "convert", expr: node, target };
      this.meta.isConvert = true;
      this.meta.lastBinaryOp = opIdx;
      this.meta.convertTargetStart = first.start;
    }
    if (this.pos < this.toks.length) this.fail(`unexpected ${this.peek()!.text}`);
    this.meta.bareQuantity =
      node.kind === "quantity" || (node.kind === "unary" && node.arg.kind === "quantity");
    return node;
  }

  private parseAdditive(): Node {
    let left = this.parseMultiplicative();
    for (;;) {
      const t = this.peek();
      if (!this.isOp(t, "+", "-")) break;
      this.meta.lastBinaryOp = this.pos;
      this.meta.hasBinary = true;
      this.pos++;
      const right = this.parseMultiplicative();
      left = { kind: "binary", op: t!.text as "+" | "-", left, right };
    }
    return left;
  }

  private parseMultiplicative(): Node {
    let left = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (!this.isOp(t, "*", "/", "·", "×", "÷")) break;
      this.meta.lastBinaryOp = this.pos;
      this.meta.hasBinary = true;
      this.pos++;
      const right = this.parseUnary();
      const op = t!.text === "/" || t!.text === "÷" ? "/" : "*";
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseUnary(): Node {
    const t = this.peek();
    if (this.isOp(t, "-", "+")) {
      this.pos++;
      const arg = this.parseUnary();
      return { kind: "unary", op: t!.text as "-" | "+", arg };
    }
    return this.parseJuxta();
  }

  private parseJuxta(): Node {
    const first = this.pos === 0 && !this.opts.allowBareUnitFirst && !this.isConvKeywordAt(1);
    let left = this.parsePower(true, !first);
    for (;;) {
      if (!this.canStartFactor(this.pos)) break;
      const t = this.peek()!;
      const prev = this.toks[this.pos - 1];
      if (t.type === "num" && prev && prev.type === "num") break; // "2 3" is not a product
      const right = this.parsePower(true, true);
      this.meta.hasBinary = true;
      left = { kind: "binary", op: "implicit", left, right };
    }
    return left;
  }

  private parsePower(allowUnits: boolean, allowBareUnit: boolean): Node {
    const base = this.parsePostfix(allowUnits, allowBareUnit);
    const t = this.peek();
    if (this.isOp(t, "**", "^")) {
      this.meta.lastBinaryOp = this.pos;
      this.meta.hasBinary = true;
      this.pos++;
      const exp = this.parseExponent();
      return { kind: "binary", op: "**", left: base, right: exp };
    }
    return base;
  }

  private parseExponent(): Node {
    const t = this.peek();
    if (this.isOp(t, "-", "+")) {
      this.pos++;
      return { kind: "unary", op: t!.text as "-" | "+", arg: this.parseExponent() };
    }
    return this.parsePower(false, false);
  }

  private parsePostfix(allowUnits: boolean, allowBareUnit: boolean): Node {
    let node = this.parsePrimary(allowUnits, allowBareUnit);
    for (;;) {
      const t = this.peek();
      if (!this.isOp(t, "%", "!")) break;
      this.pos++;
      this.meta.hasPostfix = true;
      node = { kind: "postfix", op: t!.text as "%" | "!", arg: node };
    }
    return node;
  }

  private parsePrimary(allowUnits: boolean, allowBareUnit: boolean): Node {
    const t = this.peek();
    if (!t) this.fail("unexpected end");
    if (t.type === "num") {
      this.pos++;
      const value = new Decimal(numberText(t.text));
      this.meta.maxDecimals = Math.max(this.meta.maxDecimals, literalDecimals(t.text));
      if (allowUnits && this.unitIdentAt(this.pos)) {
        const unit = this.parseUnitChain();
        if (unit) return { kind: "quantity", value, text: t.text, unit };
      }
      return { kind: "num", value, text: t.text };
    }
    if (this.isOp(t, "(")) {
      this.pos++;
      const inner = this.parseAdditive();
      if (!this.isOp(this.peek(), ")")) this.fail("missing )");
      this.pos++;
      return inner;
    }
    if (t.type === "ident") {
      if (CONSTANTS.has(t.text)) {
        this.pos++;
        this.meta.hasConst = true;
        return { kind: "const", name: t.text };
      }
      if (FUNCTIONS.has(t.text)) {
        this.pos++;
        this.meta.hasCall = true;
        const n = this.peek();
        if (this.isOp(n, "(")) {
          this.pos++;
          const args: Node[] = [];
          if (!this.isOp(this.peek(), ")")) {
            args.push(this.parseAdditive());
            while (this.isOp(this.peek(), ",")) {
              this.pos++;
              args.push(this.parseAdditive());
            }
          }
          if (!this.isOp(this.peek(), ")")) this.fail("missing )");
          this.pos++;
          return { kind: "call", name: t.text, args };
        }
        if (n && (this.canStartFactor(this.pos) || this.isOp(n, "-", "+"))) {
          const arg = this.parseUnary();
          return { kind: "call", name: t.text, args: [arg] };
        }
        this.fail("missing argument");
      }
      if (this.unitIdentAt(this.pos)) {
        if (!allowBareUnit) this.fail("bare unit");
        const unit = this.parseUnitChain();
        if (unit) return { kind: "unit", unit };
      }
      this.fail(`unknown identifier ${t.text}`);
    }
    this.fail(`unexpected ${t.text}`);
  }

  /** Parses a chain like `kg`, `m**2`, `kg m2 s-2`, `km/h`, `kg·m²/s²`. */
  parseUnitChain(): DisplayUnit | null {
    const parts: UnitPart[] = [];
    let inDen = false;
    const startIdx = this.pos;
    for (;;) {
      if (!this.unitIdentAt(this.pos)) break;
      const t = this.peek()!;
      const part = this.reg.resolveIdent(t.text)!;
      this.pos++;
      let exp = part.exp;
      if (/[⁰¹²³⁴⁵⁶⁷⁸⁹]/u.test(t.text)) this.setStyle("exp", "sup");
      else if (part.exp !== 1) this.setStyle("exp", "digits");

      const n = this.peek();
      if (this.isOp(n, "**", "^") && n!.ws === "") {
        let j = this.pos + 1;
        let sign = 1;
        if (this.isOp(this.toks[j], "-", "+") && this.toks[j].ws === "") {
          sign = this.toks[j].text === "-" ? -1 : 1;
          j++;
        }
        const nt = this.toks[j];
        if (nt && nt.type === "num" && nt.ws === "" && /^\d+$/.test(nt.text)) {
          exp = part.exp * sign * Number(nt.text);
          this.pos = j + 1;
          this.setStyle("exp", n!.text === "**" ? "**" : "^");
          if (n!.text === "**") this.setStyle("mul", "*");
        }
      } else if (this.isOp(n, "-") && n!.ws === "") {
        const nt = this.toks[this.pos + 1];
        const after = this.toks[this.pos + 2];
        const letterFollows = !!after && after.ws === "" && (after.type === "ident" || after.type === "num");
        if (nt && nt.type === "num" && nt.ws === "" && /^\d$/.test(nt.text) && !letterFollows) {
          exp = -Number(nt.text);
          this.pos += 2;
          this.setStyle("neg", "digits");
        }
      }
      parts.push({ ...part, exp: inDen ? -exp : exp });

      const c = this.peek();
      if (this.isOp(c, "/") && this.unitIdentAt(this.pos + 1)) {
        this.pos++;
        inDen = true;
        this.setStyle("neg", "slash");
        continue;
      }
      if (this.isOp(c, "*", "·", "×") && this.unitIdentAt(this.pos + 1)) {
        this.pos++;
        inDen = false;
        this.setStyle("mul", c!.text === "·" ? "·" : c!.text === "*" ? "*" : " ");
        continue;
      }
      if (c && c.type === "ident" && c.ws !== "" && this.unitIdentAt(this.pos)) continue;
      break;
    }
    if (!parts.length) {
      this.pos = startIdx;
      return null;
    }
    const unit = this.reg.makeUnit(parts);
    this.meta.inputUnits.push(unit);
    return unit;
  }
}
