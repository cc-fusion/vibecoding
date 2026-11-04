import Decimal from "decimal.js";
import {
  Dimension,
  UnitDef,
  UnitEngine,
  UnitSystemPreference,
  defaultUnitEngine,
  divideDimensions,
  isDimensionless,
  multiplyDimensions,
  normalizeDimension,
  powerDimension,
  sameDimension,
} from "./unitEngine";

export type AngleMode = "rad" | "deg";

export interface SuggestionCandidate {
  /** Text to insert when accepted */
  insertText: string;
  /** Text to display in the bottom-bar chip and inline preview (may be truncated with ... if very long) */
  displayText: string;
  /** Number of characters immediately BEFORE the cursor to replace when accepting */
  replaceBack: number;
  /** Optional angle mode badge ('rad' | 'deg'), shown ONLY when angle mode affects the result */
  angleBadge?: AngleMode;
  /** Optional unit associated with this candidate */
  unit?: UnitDef;
  /** System tag ('metric' | 'imperial') */
  unitSystem?: "metric" | "imperial";
  /** Notation tag ('decimal' | 'scientific') */
  notation?: "decimal" | "scientific";
}

export interface AutocompleteResult {
  candidates: SuggestionCandidate[];
  /** Whether the first candidate should be shown inline in the editor */
  showInline: boolean;
  /** Whether angle mode affected the result */
  angleDependent: boolean;
  /** Compatible units for the unit dropdown (only populated when a unit is being suggested) */
  compatibleUnits: UnitDef[];
  /** Currently active unit in the primary candidate (if any) */
  activeUnit?: UnitDef;
  /** Debug details for the developer console */
  debugInfo?: string;
}

// High-precision Pi cache using fast BigInt Machin-like / Euler series
let cachedPiDigits = 0;
let cachedPiString = "";

export function computePiString(digits: number): string {
  const target = Math.max(120, digits + 30);
  if (cachedPiDigits >= target && cachedPiString) {
    return cachedPiString.slice(0, digits + 2);
  }
  // Machin's formula: pi = 16 * atan(1/5) - 4 * atan(1/239)
  const guard = 25;
  const totalDigits = target + guard;
  const scale = 10n ** BigInt(totalDigits);

  function atanInv(k: bigint): bigint {
    const k2 = k * k;
    let term = scale / k;
    let sum = term;
    let n = 1n;
    let sign = -1n;
    while (term > 0n) {
      term = term / k2;
      const contrib = term / (2n * n + 1n);
      if (contrib === 0n) break;
      sum += sign * contrib;
      sign = -sign;
      n += 1n;
    }
    return sum;
  }

  const piBig = 16n * atanInv(5n) - 4n * atanInv(239n);
  const s = piBig.toString();
  cachedPiString = s[0] + "." + s.slice(1, 1 + target);
  cachedPiDigits = target;
  return cachedPiString.slice(0, digits + 2);
}

export function getPiDecimal(precision: number): Decimal {
  const str = computePiString(precision + 10);
  const Ctor = Decimal.clone({ precision: precision + 20 });
  return new Ctor(str);
}

interface EvalQuantity {
  /** Value in SI base units (if hasUnit is true) or pure numeric value */
  value: Decimal;
  dimension: Dimension;
  hasUnit: boolean;
  /** Explicit angle tag if user wrote 'deg' or 'rad' */
  explicitAngle?: AngleMode | null;
  /** First or primary unit used, for formatting hints */
  hintUnit?: UnitDef | null;
  /** Unit exponent style used in input ('none' | 'attached' | 'power') */
  exponentStyle: "none" | "attached" | "power";
  /** Whether a binary operator, function, or conversion was applied */
  isComposite: boolean;
  /** For A + B or A - B on dimensionless numbers, store the larger operand to detect small delta precision */
  dominantAddend?: Decimal | null;
}

interface ParseOutcome {
  quantity: EvalQuantity;
  usedImplicitAngle: boolean;
  targetUnit?: UnitDef | null;
  hasConversionKeyword: boolean;
  lastBinaryOpRightSpace: string;
  hasSpaceBetweenNumAndUnit: boolean;
}

type TokenType =
  | "number"
  | "ident"
  | "op"
  | "lparen"
  | "rparen"
  | "comma"
  | "arrow";

interface Token {
  type: TokenType;
  value: string;
  raw: string;
  start: number;
  end: number;
  spaceBefore: string;
  spaceAfter: string;
}

const TRIG_FUNCS = new Set(["sin", "cos", "tan", "sec", "csc", "cot"]);
const INV_TRIG_FUNCS = new Set([
  "asin",
  "acos",
  "atan",
  "arcsin",
  "arccos",
  "arctan",
]);
const OTHER_FUNCS = new Set([
  "sinh",
  "cosh",
  "tanh",
  "asinh",
  "acosh",
  "atanh",
  "sqrt",
  "cbrt",
  "ln",
  "log",
  "log10",
  "log2",
  "exp",
  "abs",
  "floor",
  "ceil",
  "round",
  "trunc",
  "sign",
]);

function isFuncName(name: string): boolean {
  const low = name.toLowerCase();
  return TRIG_FUNCS.has(low) || INV_TRIG_FUNCS.has(low) || OTHER_FUNCS.has(low);
}

function isConstantName(name: string): boolean {
  const low = name.toLowerCase();
  return (
    low === "pi" ||
    name === "π" ||
    low === "e" ||
    low === "tau" ||
    name === "τ" ||
    low === "phi" ||
    name === "φ"
  );
}

function isAngleUnitToken(name: string): AngleMode | null {
  const low = name.toLowerCase();
  if (low === "deg" || low === "degree" || low === "degrees" || name === "°") {
    return "deg";
  }
  if (low === "rad" || low === "radian" || low === "radians") {
    return "rad";
  }
  return null;
}

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;

  const consumeSpaces = (): string => {
    let s = "";
    while (i < n && (input[i] === " " || input[i] === "\t")) {
      s += input[i];
      i++;
    }
    return s;
  };

  let pendingSpace = consumeSpaces();

  while (i < n) {
    const start = i;
    const ch = input[i];

    // Arrow ->
    if (ch === "-" && input[i + 1] === ">") {
      i += 2;
      const spaceAfter = consumeSpaces();
      tokens.push({
        type: "arrow",
        value: "->",
        raw: "->",
        start,
        end: start + 2,
        spaceBefore: pendingSpace,
        spaceAfter,
      });
      pendingSpace = spaceAfter;
      continue;
    }

    // Power **
    if (ch === "*" && input[i + 1] === "*") {
      i += 2;
      const spaceAfter = consumeSpaces();
      tokens.push({
        type: "op",
        value: "**",
        raw: "**",
        start,
        end: start + 2,
        spaceBefore: pendingSpace,
        spaceAfter,
      });
      pendingSpace = spaceAfter;
      continue;
    }

    // Single-char operators
    if ("+-*/^%!·×÷".includes(ch)) {
      i++;
      const spaceAfter = consumeSpaces();
      let normOp = ch;
      if (ch === "×" || ch === "·") normOp = "*";
      if (ch === "÷") normOp = "/";
      tokens.push({
        type: "op",
        value: normOp,
        raw: ch,
        start,
        end: start + 1,
        spaceBefore: pendingSpace,
        spaceAfter,
      });
      pendingSpace = spaceAfter;
      continue;
    }

    if (ch === "(") {
      i++;
      const spaceAfter = consumeSpaces();
      tokens.push({
        type: "lparen",
        value: "(",
        raw: "(",
        start,
        end: start + 1,
        spaceBefore: pendingSpace,
        spaceAfter,
      });
      pendingSpace = spaceAfter;
      continue;
    }

    if (ch === ")") {
      i++;
      const spaceAfter = consumeSpaces();
      tokens.push({
        type: "rparen",
        value: ")",
        raw: ")",
        start,
        end: start + 1,
        spaceBefore: pendingSpace,
        spaceAfter,
      });
      pendingSpace = spaceAfter;
      continue;
    }

    if (ch === ",") {
      i++;
      const spaceAfter = consumeSpaces();
      tokens.push({
        type: "comma",
        value: ",",
        raw: ",",
        start,
        end: start + 1,
        spaceBefore: pendingSpace,
        spaceAfter,
      });
      pendingSpace = spaceAfter;
      continue;
    }

    // Number: digits with optional decimal point and optional scientific e notation
    if ((ch >= "0" && ch <= "9") || (ch === "." && i + 1 < n && input[i + 1] >= "0" && input[i + 1] <= "9")) {
      let numStr = "";
      while (i < n && input[i] >= "0" && input[i] <= "9") {
        numStr += input[i++];
      }
      if (i < n && input[i] === ".") {
        numStr += input[i++];
        while (i < n && input[i] >= "0" && input[i] <= "9") {
          numStr += input[i++];
        }
      }
      // Scientific notation e.g. 1e-5 or 1e5 (only if followed by digits or +/- digits)
      if (i < n && (input[i] === "e" || input[i] === "E")) {
        const next1 = input[i + 1];
        const next2 = input[i + 2];
        if (
          (next1 >= "0" && next1 <= "9") ||
          ((next1 === "+" || next1 === "-") && next2 >= "0" && next2 <= "9")
        ) {
          numStr += input[i++];
          if (input[i] === "+" || input[i] === "-") {
            numStr += input[i++];
          }
          while (i < n && input[i] >= "0" && input[i] <= "9") {
            numStr += input[i++];
          }
        }
      }
      const end = i;
      const spaceAfter = consumeSpaces();
      tokens.push({
        type: "number",
        value: numStr,
        raw: numStr,
        start,
        end,
        spaceBefore: pendingSpace,
        spaceAfter,
      });
      pendingSpace = spaceAfter;
      continue;
    }

    // Identifier / Unit symbol / Constant / Function name
    // Note: can include letters, µ, Ω, π, τ, φ, °, ², ³, and attached unit exponents like m2 or s-2
    if (/[a-zA-Z_µμΩπτφ°]/.test(ch)) {
      let id = "";
      while (i < n && /[a-zA-Z_µμΩπτφ°²³]/.test(input[i])) {
        id += input[i++];
      }
      // Check if this identifier is immediately followed by an integer exponent for a unit, e.g. m2, kg2, s-2
      // Wait: in "text1+1", "text" is NOT a unit or function (like log2/log10).
      // If followed immediately by digits (or -digits when id is a known unit like s-2):
      if (i < n) {
        if (input[i] >= "0" && input[i] <= "9") {
          let digits = "";
          while (i < n && input[i] >= "0" && input[i] <= "9") {
            digits += input[i++];
          }
          id += digits;
        } else if (
          input[i] === "-" &&
          i + 1 < n &&
          input[i + 1] >= "0" &&
          input[i + 1] <= "9" &&
          defaultUnitEngine.lookupExactUnit(id)
        ) {
          let negExp = "-";
          i++; // skip '-'
          while (i < n && input[i] >= "0" && input[i] <= "9") {
            negExp += input[i++];
          }
          id += negExp;
        }
      }

      const end = i;
      const spaceAfter = consumeSpaces();
      const normId = id.replace(/μ/g, "µ");
      tokens.push({
        type: "ident",
        value: normId,
        raw: id,
        start,
        end,
        spaceBefore: pendingSpace,
        spaceAfter,
      });
      pendingSpace = spaceAfter;
      continue;
    }

    // Unrecognized character
    return null;
  }

  return tokens;
}

export function evaluateExpressionTokens(
  tokens: Token[],
  angleMode: AngleMode,
  precision: number,
  unitEngine: UnitEngine = defaultUnitEngine
): ParseOutcome | null {
  if (tokens.length === 0) return null;

  const D = Decimal.clone({
    precision: Math.max(100, precision + 50),
    rounding: Decimal.ROUND_HALF_UP,
    maxE: 1e15,
    minE: -1e15,
  });

  const piVal = getPiDecimal(Math.max(100, precision + 50));

  // Check for top-level conversion at the end: "... to <unit>" or "... -> <unit>"
  let targetUnit: UnitDef | null = null;
  let hasConversionKeyword = false;
  let conversionRightSpace = "";
  let exprTokens = tokens;

  if (tokens.length >= 3) {
    const secondLast = tokens[tokens.length - 2];
    const last = tokens[tokens.length - 1];
    if (
      (secondLast.type === "arrow" ||
        (secondLast.type === "ident" && secondLast.value.toLowerCase() === "to")) &&
      last.type === "ident"
    ) {
      const resolvedTarget = unitEngine.lookupExactUnit(last.value);
      if (!resolvedTarget) return null;
      targetUnit = resolvedTarget;
      hasConversionKeyword = true;
      conversionRightSpace = secondLast.spaceAfter;
      exprTokens = tokens.slice(0, tokens.length - 2);
    } else if (
      tokens.length >= 5 &&
      (tokens[tokens.length - 4].type === "arrow" ||
        (tokens[tokens.length - 4].type === "ident" &&
          tokens[tokens.length - 4].value.toLowerCase() === "to")) &&
      tokens[tokens.length - 3].type === "ident" &&
      tokens[tokens.length - 2].type === "op" &&
      tokens[tokens.length - 2].value === "**" &&
      tokens[tokens.length - 1].type === "number"
    ) {
      const combinedSym = `${tokens[tokens.length - 3].value}**${tokens[tokens.length - 1].value}`;
      const resolvedTarget = unitEngine.lookupExactUnit(combinedSym);
      if (!resolvedTarget) return null;
      targetUnit = resolvedTarget;
      hasConversionKeyword = true;
      conversionRightSpace = tokens[tokens.length - 4].spaceAfter;
      exprTokens = tokens.slice(0, tokens.length - 4);
    }
  }

  if (exprTokens.length === 0) return null;

  let pos = 0;
  let usedImplicitAngle = false;
  let lastBinaryOpRightSpace = "";
  let hasSpaceBetweenNumAndUnit = false;
  let inExponentDepth = 0;
  let allowBareUnit = false;

  const peek = (offset = 0): Token | undefined => exprTokens[pos + offset];
  const consume = (): Token => exprTokens[pos++];

  // Check if token at current position starts a unit cluster
  function canParseUnitAt(idx: number): boolean {
    const tok = exprTokens[idx];
    if (!tok || tok.type !== "ident") return false;
    if (tok.value.toLowerCase() === "to") return false;
    if (isAngleUnitToken(tok.value)) return true;
    // Check m**2 or m**-2
    if (
      exprTokens[idx + 1]?.type === "op" &&
      exprTokens[idx + 1].value === "**"
    ) {
      if (exprTokens[idx + 2]?.type === "number") {
        const base = unitEngine.lookupExactUnit(tok.value);
        if (base) return true;
      } else if (
        exprTokens[idx + 2]?.type === "op" &&
        (exprTokens[idx + 2].value === "-" || exprTokens[idx + 2].value === "+") &&
        exprTokens[idx + 3]?.type === "number"
      ) {
        const base = unitEngine.lookupExactUnit(tok.value);
        if (base) return true;
      }
    }
    return !!unitEngine.resolveUnitToken(tok.value);
  }

  // Parses one or more adjacent unit tokens (e.g. "kg", "m**2", "kg m2 s-2")
  function parseUnitCluster(): {
    factor: Decimal;
    dimension: Dimension;
    explicitAngle: AngleMode | null;
    hintUnit: UnitDef | null;
    exponentStyle: "none" | "attached" | "power";
    count: number;
  } | null {
    let factor = new D(1);
    let dimension: Dimension = {};
    let explicitAngle: AngleMode | null = null;
    let hintUnit: UnitDef | null = null;
    let exponentStyle: "none" | "attached" | "power" = "none";
    let count = 0;

    while (pos < exprTokens.length && canParseUnitAt(pos)) {
      const tok = consume();
      const angle = isAngleUnitToken(tok.value);
      if (angle) {
        explicitAngle = angle;
        count++;
        break;
      }

      // Check if followed by ** exponent (e.g. m**2 or s**-2)
      let exp = 1;
      let style: "none" | "attached" | "power" = "none";
      let baseUnit: UnitDef | null = null;

      if (peek()?.type === "op" && peek()!.value === "**") {
        const next1 = peek(1);
        const next2 = peek(2);
        if (next1?.type === "number" && /^-?\d+$/.test(next1.value)) {
          const candidateBase = unitEngine.lookupExactUnit(tok.value);
          if (candidateBase) {
            consume(); // **
            const expTok = consume();
            baseUnit = candidateBase;
            exp = parseInt(expTok.value, 10);
            style = "power";
          }
        } else if (
          next1?.type === "op" &&
          (next1.value === "-" || next1.value === "+") &&
          next2?.type === "number" &&
          /^\d+$/.test(next2.value)
        ) {
          const candidateBase = unitEngine.lookupExactUnit(tok.value);
          if (candidateBase) {
            consume(); // **
            const signTok = consume();
            const expTok = consume();
            baseUnit = candidateBase;
            exp = parseInt(signTok.value + expTok.value, 10);
            style = "power";
          }
        }
      }

      if (!baseUnit) {
        const resolved = unitEngine.resolveUnitToken(tok.value);
        if (!resolved) return null;
        baseUnit = resolved.unitDef;
        exp = resolved.exponent;
        style = resolved.exponentStyle;
      }

      const unitFactor = new D(baseUnit.conversion_factor).pow(exp);
      factor = factor.mul(unitFactor);
      const unitDim = powerDimension(baseUnit.dimension, exp);
      dimension = multiplyDimensions(dimension, unitDim);

      if (style === "power") exponentStyle = "power";
      else if (style === "attached" && exponentStyle === "none") exponentStyle = "attached";

      if (count === 0) {
        if (exp === 1) {
          hintUnit = baseUnit;
        } else if (style === "power") {
          const powSym = `${baseUnit.symbol}**${exp}`;
          hintUnit = unitEngine.lookupExactUnit(powSym) || null;
        }
      } else {
        hintUnit = null;
      }

      count++;
    }

    if (count === 0) return null;
    return { factor, dimension, explicitAngle, hintUnit, exponentStyle, count };
  }

  function attachOptionalUnits(base: EvalQuantity, hadSpaceBeforeUnit: boolean): EvalQuantity {
    if (!canParseUnitAt(pos)) return base;
    const cluster = parseUnitCluster();
    if (!cluster) return base;
    if (hadSpaceBeforeUnit && !base.isComposite) {
      hasSpaceBetweenNumAndUnit = true;
    }
    if (cluster.explicitAngle) {
      return {
        ...base,
        explicitAngle: cluster.explicitAngle,
        isComposite: true,
      };
    }
    return {
      value: base.value.mul(cluster.factor),
      dimension: multiplyDimensions(base.dimension, cluster.dimension),
      hasUnit: true,
      explicitAngle: null,
      hintUnit: !base.hasUnit && cluster.count === 1 ? cluster.hintUnit : null,
      exponentStyle:
        cluster.exponentStyle !== "none" ? cluster.exponentStyle : base.exponentStyle,
      isComposite: base.isComposite || cluster.count > 1 || cluster.exponentStyle !== "none",
    };
  }

  function applyFunction(fnName: string, arg: EvalQuantity): EvalQuantity | null {
    const low = fnName.toLowerCase();

    // Trig functions require dimensionless or explicit angle argument
    if (TRIG_FUNCS.has(low)) {
      if (arg.hasUnit && !isDimensionless(arg.dimension)) return null;
      let angleRad: Decimal;
      if (arg.explicitAngle === "deg") {
        angleRad = arg.value.mul(piVal).div(180);
      } else if (arg.explicitAngle === "rad") {
        angleRad = arg.value;
      } else {
        usedImplicitAngle = true;
        if (angleMode === "deg") {
          // Handle exact special angles in degrees (e.g. sin(30) = 0.5, cos(60) = 0.5, tan(45) = 1)
          const degMod = arg.value.mod(360).add(360).mod(360);
          if (low === "sin") {
            if (degMod.eq(0) || degMod.eq(180)) return makePure(new D(0), true);
            if (degMod.eq(30) || degMod.eq(150)) return makePure(new D("0.5"), true);
            if (degMod.eq(210) || degMod.eq(330)) return makePure(new D("-0.5"), true);
            if (degMod.eq(90)) return makePure(new D(1), true);
            if (degMod.eq(270)) return makePure(new D(-1), true);
          } else if (low === "cos") {
            if (degMod.eq(90) || degMod.eq(270)) return makePure(new D(0), true);
            if (degMod.eq(60) || degMod.eq(300)) return makePure(new D("0.5"), true);
            if (degMod.eq(120) || degMod.eq(240)) return makePure(new D("-0.5"), true);
            if (degMod.eq(0)) return makePure(new D(1), true);
            if (degMod.eq(180)) return makePure(new D(-1), true);
          } else if (low === "tan") {
            if (degMod.eq(0) || degMod.eq(180)) return makePure(new D(0), true);
            if (degMod.eq(45) || degMod.eq(225)) return makePure(new D(1), true);
            if (degMod.eq(135) || degMod.eq(315)) return makePure(new D(-1), true);
          }
          angleRad = arg.value.mul(piVal).div(180);
        } else {
          angleRad = arg.value;
        }
      }

      if (arg.explicitAngle === "deg") {
        const degMod = arg.value.mod(360).add(360).mod(360);
        if (low === "sin" && (degMod.eq(30) || degMod.eq(150))) return makePure(new D("0.5"), true);
        if (low === "sin" && (degMod.eq(210) || degMod.eq(330))) return makePure(new D("-0.5"), true);
        if (low === "sin" && (degMod.eq(0) || degMod.eq(180))) return makePure(new D(0), true);
        if (low === "cos" && (degMod.eq(60) || degMod.eq(300))) return makePure(new D("0.5"), true);
        if (low === "cos" && (degMod.eq(90) || degMod.eq(270))) return makePure(new D(0), true);
        if (low === "tan" && (degMod.eq(45) || degMod.eq(225))) return makePure(new D(1), true);
      }

      // Reduce angleRad modulo 2*pi for high precision stability
      const twoPi = piVal.mul(2);
      const reduced = angleRad.mod(twoPi);
      // Decimal trig works up to ~1000 digits; clone with capped 950 precision if higher
      const TrigD = Decimal.clone({ precision: Math.min(900, Math.max(100, precision + 30)) });
      const r = new TrigD(reduced.toString());

      let out: Decimal;
      if (low === "sin") out = r.sin();
      else if (low === "cos") out = r.cos();
      else if (low === "tan") out = r.tan();
      else if (low === "sec") out = new TrigD(1).div(r.cos());
      else if (low === "csc") out = new TrigD(1).div(r.sin());
      else out = new TrigD(1).div(r.tan());

      return makePure(new D(out.toString()), true);
    }

    if (INV_TRIG_FUNCS.has(low)) {
      if (arg.hasUnit && !isDimensionless(arg.dimension)) return null;
      const TrigD = Decimal.clone({ precision: Math.min(900, Math.max(100, precision + 30)) });
      const v = new TrigD(arg.value.toString());
      let radOut: Decimal;
      if (low === "asin" || low === "arcsin") {
        if (v.abs().gt(1)) return null;
        radOut = v.asin();
      } else if (low === "acos" || low === "arccos") {
        if (v.abs().gt(1)) return null;
        radOut = v.acos();
      } else {
        radOut = v.atan();
      }
      usedImplicitAngle = true;
      const fullRad = new D(radOut.toString());
      if (angleMode === "deg") {
        return makePure(fullRad.mul(180).div(piVal), true);
      }
      return makePure(fullRad, true);
    }

    if (low === "sqrt") {
      if (arg.value.isNegative()) return null;
      const newDim: Dimension = {};
      for (const [k, exp] of Object.entries(arg.dimension)) {
        if ((exp || 0) % 2 !== 0) return null;
        newDim[k as keyof Dimension] = (exp || 0) / 2;
      }
      return {
        value: arg.value.sqrt(),
        dimension: normalizeDimension(newDim),
        hasUnit: arg.hasUnit,
        exponentStyle: arg.exponentStyle,
        isComposite: true,
      };
    }

    if (low === "cbrt") {
      const newDim: Dimension = {};
      for (const [k, exp] of Object.entries(arg.dimension)) {
        if ((exp || 0) % 3 !== 0) return null;
        newDim[k as keyof Dimension] = (exp || 0) / 3;
      }
      return {
        value: arg.value.cbrt(),
        dimension: normalizeDimension(newDim),
        hasUnit: arg.hasUnit,
        exponentStyle: arg.exponentStyle,
        isComposite: true,
      };
    }

    if (arg.hasUnit && !isDimensionless(arg.dimension) && low !== "abs") return null;

    if (low === "abs") {
      return {
        ...arg,
        value: arg.value.abs(),
        isComposite: true,
      };
    }
    if (low === "ln") {
      if (arg.value.lte(0)) return null;
      return makePure(arg.value.ln(), true);
    }
    if (low === "log" || low === "log10") {
      if (arg.value.lte(0)) return null;
      return makePure(arg.value.log(10), true);
    }
    if (low === "log2") {
      if (arg.value.lte(0)) return null;
      return makePure(arg.value.log(2), true);
    }
    if (low === "exp") return makePure(arg.value.exp(), true);
    if (low === "sinh") return makePure(arg.value.sinh(), true);
    if (low === "cosh") return makePure(arg.value.cosh(), true);
    if (low === "tanh") return makePure(arg.value.tanh(), true);
    if (low === "asinh") return makePure(arg.value.asinh(), true);
    if (low === "acosh") {
      if (arg.value.lt(1)) return null;
      return makePure(arg.value.acosh(), true);
    }
    if (low === "atanh") {
      if (arg.value.abs().gte(1)) return null;
      return makePure(arg.value.atanh(), true);
    }
    if (low === "floor") return makePure(arg.value.floor(), true);
    if (low === "ceil") return makePure(arg.value.ceil(), true);
    if (low === "round") return makePure(arg.value.round(), true);
    if (low === "trunc") return makePure(arg.value.trunc(), true);
    if (low === "sign") {
      return makePure(new D(arg.value.isZero() ? 0 : arg.value.isNegative() ? -1 : 1), true);
    }

    return null;
  }

  function makePure(val: Decimal, isComposite: boolean): EvalQuantity {
    return {
      value: val,
      dimension: {},
      hasUnit: false,
      exponentStyle: "none",
      isComposite,
    };
  }

  // Grammar:
  // Expr := AddSub
  // AddSub := MulDiv ( ('+' | '-') MulDiv )*
  // MulDiv := Unary ( ('*' | '/' | '%' | implicitMul) Unary )*
  // Unary := ('+' | '-') Unary | PrefixFunc | PowerWithUnits
  // PowerWithUnits := Atom ('**' | '^' Unary)? [UnitCluster]

  function parseAddSub(): EvalQuantity | null {
    let left = parseMulDiv();
    if (!left) return null;

    while (pos < exprTokens.length) {
      const tok = peek();
      if (tok && tok.type === "op" && (tok.value === "+" || tok.value === "-")) {
        consume();
        lastBinaryOpRightSpace = tok.spaceAfter;
        const right = parseMulDiv();
        if (!right) return null;

        // Dimensional check: both must have the same dimension and same hasUnit status
        if (left.hasUnit !== right.hasUnit || !sameDimension(left.dimension, right.dimension)) {
          return null;
        }

        const newVal: Decimal =
          tok.value === "+" ? left.value.add(right.value) : left.value.sub(right.value);

        let dominantAddend: Decimal | null = null;
        if (!left.hasUnit && !left.value.isZero() && !right.value.isZero()) {
          dominantAddend = left.value.abs().gte(right.value.abs()) ? left.value : right.value;
        }

        left = {
          value: newVal,
          dimension: left.dimension,
          hasUnit: left.hasUnit,
          hintUnit: left.hintUnit || right.hintUnit,
          exponentStyle:
            left.exponentStyle !== "none" ? left.exponentStyle : right.exponentStyle,
          isComposite: true,
          dominantAddend,
        };
      } else {
        break;
      }
    }

    return left;
  }

  function canStartImplicitMul(): boolean {
    const tok = peek();
    if (!tok) return false;
    if (tok.type === "lparen") return true;
    if (tok.type === "ident") {
      if (tok.value.toLowerCase() === "to") return false;
      if (isConstantName(tok.value) || isFuncName(tok.value)) return true;
    }
    return false;
  }

  function parseMulDiv(): EvalQuantity | null {
    let left = parseUnary();
    if (!left) return null;

    while (pos < exprTokens.length) {
      const tok = peek();
      if (
        tok &&
        tok.type === "op" &&
        (tok.value === "*" || tok.value === "/" || tok.value === "%")
      ) {
        consume();
        lastBinaryOpRightSpace = tok.spaceAfter;
        const prevBare = allowBareUnit;
        allowBareUnit = tok.value === "*" || tok.value === "/";
        const right = parseUnary();
        allowBareUnit = prevBare;
        if (!right) return null;

        if (tok.value === "*") {
          const newDim = multiplyDimensions(left.dimension, right.dimension);
          // Preserve hintUnit if multiplying a unit quantity by a dimensionless scalar (e.g. 1km * 2 = 2km, 2m**2 * 1 = 2m**2)
          let hintUnit: UnitDef | null = null;
          if (left.hasUnit && !right.hasUnit) hintUnit = left.hintUnit || null;
          else if (!left.hasUnit && right.hasUnit) hintUnit = right.hintUnit || null;

          left = {
            value: left.value.mul(right.value),
            dimension: newDim,
            hasUnit: left.hasUnit || right.hasUnit,
            hintUnit,
            exponentStyle:
              left.exponentStyle !== "none" ? left.exponentStyle : right.exponentStyle,
            isComposite: true,
          };
        } else if (tok.value === "/") {
          if (right.value.isZero()) return null;
          const newDim = divideDimensions(left.dimension, right.dimension);
          let hintUnit: UnitDef | null = null;
          if (left.hasUnit && !right.hasUnit) hintUnit = left.hintUnit || null;

          left = {
            value: left.value.div(right.value),
            dimension: newDim,
            hasUnit: left.hasUnit || right.hasUnit,
            hintUnit,
            exponentStyle:
              left.exponentStyle !== "none" ? left.exponentStyle : right.exponentStyle,
            isComposite: true,
          };
        } else {
          if (right.value.isZero() || left.hasUnit || right.hasUnit) return null;
          left = makePure(left.value.mod(right.value), true);
        }
      } else if (canStartImplicitMul()) {
        const right = parseUnary();
        if (!right) return null;
        const newDim = multiplyDimensions(left.dimension, right.dimension);
        left = {
          value: left.value.mul(right.value),
          dimension: newDim,
          hasUnit: left.hasUnit || right.hasUnit,
          hintUnit: left.hasUnit && !right.hasUnit ? left.hintUnit : right.hintUnit,
          exponentStyle:
            left.exponentStyle !== "none" ? left.exponentStyle : right.exponentStyle,
          isComposite: true,
        };
      } else {
        break;
      }
    }

    return left;
  }

  function parseUnary(): EvalQuantity | null {
    const tok = peek();
    if (!tok) return null;

    if (tok.type === "op" && (tok.value === "+" || tok.value === "-")) {
      consume();
      const inner = parseUnary();
      if (!inner) return null;
      return {
        ...inner,
        value: tok.value === "-" ? inner.value.neg() : inner.value,
      };
    }

    // Prefix function call (with or without parentheses: sin(30) or sin 30 or 1/sqrt 2)
    if (tok.type === "ident" && isFuncName(tok.value)) {
      const fnTok = consume();
      let arg: EvalQuantity | null = null;
      if (peek()?.type === "lparen") {
        consume(); // '('
        arg = parseAddSub();
        if (!arg || peek()?.type !== "rparen") return null;
        consume(); // ')'
      } else {
        arg = parseUnary();
        if (!arg) return null;
      }
      const res = applyFunction(fnTok.value, arg);
      if (!res) return null;
      return attachOptionalUnits(res, true);
    }

    return parsePowerWithUnits();
  }

  function parsePowerWithUnits(): EvalQuantity | null {
    // 1. Parse base atom (number, constant, parenthesized expression, or bare unit)
    const tok = peek();
    if (!tok) return null;

    let base: EvalQuantity | null = null;
    let spaceAfterAtom = "";

    if (tok.type === "number") {
      consume();
      spaceAfterAtom = tok.spaceAfter;
      base = makePure(new D(tok.value), false);
    } else if (tok.type === "ident" && isConstantName(tok.value)) {
      consume();
      spaceAfterAtom = tok.spaceAfter;
      const low = tok.value.toLowerCase();
      let cVal: Decimal;
      if (low === "pi" || tok.value === "π") cVal = piVal;
      else if (low === "tau" || tok.value === "τ") cVal = piVal.mul(2);
      else if (low === "e") cVal = new D(1).exp();
      else cVal = new D(1).add(new D(5).sqrt()).div(2); // phi
      base = makePure(cVal, false);
    } else if (tok.type === "lparen") {
      consume();
      const inner = parseAddSub();
      if (!inner || peek()?.type !== "rparen") return null;
      const rp = consume();
      spaceAfterAtom = rp.spaceAfter;
      base = { ...inner, isComposite: true };
    } else if (
      (allowBareUnit ||
        (pos === 0 &&
          exprTokens.length > 1 &&
          exprTokens.some((t) => t.type === "op" || /[²³⁴]/.test(t.raw)))) &&
      inExponentDepth === 0 &&
      canParseUnitAt(pos)
    ) {
      // Bare unit (e.g. after * or / like "10 m / s", or compound "kg·m²/s²")
      const cluster = parseUnitCluster();
      if (!cluster) return null;
      return {
        value: cluster.factor,
        dimension: cluster.dimension,
        hasUnit: !cluster.explicitAngle,
        explicitAngle: cluster.explicitAngle,
        hintUnit: cluster.count === 1 ? cluster.hintUnit : null,
        exponentStyle: cluster.exponentStyle,
        isComposite: true,
      };
    } else {
      return null;
    }

    // 2. Notice: in "2m**2", 'm' comes immediately after '2' and BEFORE '**2'!
    // Whereas in "10**-6 kg", '**-6' comes immediately after '10' and BEFORE 'kg'!
    // So we first attach any unit cluster immediately following the atom (when not inside an exponent):
    if (inExponentDepth === 0 && canParseUnitAt(pos)) {
      base = attachOptionalUnits(base, spaceAfterAtom.length > 0);
    }

    // 3. Postfix factorial '!'
    while (peek()?.type === "op" && peek()!.value === "!") {
      const bang = consume();
      spaceAfterAtom = bang.spaceAfter;
      if (base.hasUnit || !base.value.isInteger() || base.value.isNegative() || base.value.gt(1000)) {
        return null;
      }
      let f = new D(1);
      const limit = base.value.toNumber();
      for (let k = 2; k <= limit; k++) f = f.mul(k);
      base = makePure(f, true);
    }

    // 4. Power operator '**' or '^' (when not already consumed as a unit exponent)
    if (peek()?.type === "op" && (peek()!.value === "**" || peek()!.value === "^")) {
      const powTok = consume();
      lastBinaryOpRightSpace = powTok.spaceAfter;
      inExponentDepth++;
      const expOperand = parseUnary();
      inExponentDepth--;
      if (!expOperand || expOperand.hasUnit) return null;

      if (base.hasUnit) {
        if (!expOperand.value.isInteger()) return null;
        const expInt = expOperand.value.toNumber();
        base = {
          value: base.value.pow(expInt),
          dimension: powerDimension(base.dimension, expInt),
          hasUnit: true,
          hintUnit: null,
          exponentStyle: "power",
          isComposite: true,
        };
      } else {
        // Guard against absurd exponents that would freeze Decimal.pow
        if (expOperand.value.abs().gt(100000) && !base.value.abs().eq(10) && !base.value.abs().eq(1) && !base.value.isZero()) {
          return null;
        }
        base = makePure(base.value.pow(expOperand.value), true);
      }

      // After a power expression like "10**-6 kg", attach any trailing unit cluster!
      if (inExponentDepth === 0 && canParseUnitAt(pos)) {
        base = attachOptionalUnits(base, true);
      }
    }

    return base;
  }

  try {
    const quantity = parseAddSub();
    if (!quantity || pos !== exprTokens.length) return null;

    if (hasConversionKeyword) {
      lastBinaryOpRightSpace = conversionRightSpace;
    }

    return {
      quantity,
      usedImplicitAngle,
      targetUnit,
      hasConversionKeyword,
      lastBinaryOpRightSpace,
      hasSpaceBetweenNumAndUnit,
    };
  } catch {
    return null;
  }
}

/**
 * Formats a Decimal into ordinary decimal notation with `sigDigits` significant digits,
 * stripping unnecessary trailing zeros after the decimal point.
 */
export function formatOrdinaryDecimal(
  val: Decimal,
  sigDigits = 4,
  rounding: Decimal.Rounding = Decimal.ROUND_HALF_UP
): string {
  if (val.isZero()) return "0";
  const rounded = val.toSignificantDigits(sigDigits, rounding);
  // Expand to ordinary non-exponential decimal string
  return rounded.toFixed();
}

/**
 * Formats a Decimal in scientific notation (e.g. "1.234e5" or "1e-6").
 */
export function formatScientific(val: Decimal, sigDigits = 4): string {
  if (val.isZero()) return "0";
  const rounded = val.toSignificantDigits(sigDigits, Decimal.ROUND_HALF_UP);
  const expStr = rounded.toExponential();
  // Remove '+' after 'e' (e.g. 1e+5 -> 1e5)
  return expStr.replace(/e\+/i, "e");
}

/**
 * Truncates very long preview strings with "..." for chip/inline display.
 */
export function truncatePreview(str: string, maxChars = 28): string {
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars - 3) + "...";
}

/**
 * Converts a high-precision Decimal into a full fixed-point ordinary decimal string
 * with at least `minChars` characters, without scientific notation.
 */
function toExactFixedString(val: Decimal): string {
  if (val.isZero()) return "0";
  return val.toFixed();
}

/**
 * Computes the precision continuation (or targeted replacement) candidate when the user
 * has already typed `<lhs> = <rhsTyped>` at the cursor.
 */
function computePrecisionContinuation(
  val: Decimal,
  rhsTyped: string
): { insertText: string; replaceBack: number } | null {
  const trimmedRhs = rhsTyped.trim();
  if (!trimmedRhs) return null;

  // Validate that rhsTyped matches the sign of val
  if (val.isNegative() && !trimmedRhs.startsWith("-")) return null;
  if (!val.isNegative() && trimmedRhs.startsWith("-")) return null;

  const exactFull = toExactFixedString(val);

  // If the user has already typed the exact complete terminating value (e.g. "1+1=2" or "0.1+0.2=0.3"),
  // do NOT autocomplete anything further.
  if (exactFull === trimmedRhs) {
    return null;
  }

  // Case 1: trimmedRhs is an exact prefix of exactFull (e.g. pi=3.1415 -> "9", 1/sqrt 2=0.7 -> "0")
  if (exactFull.startsWith(trimmedRhs) && exactFull.length > trimmedRhs.length) {
    const nextChar = exactFull[trimmedRhs.length];
    if (nextChar === ".") {
      if (exactFull.length > trimmedRhs.length + 1) {
        return {
          insertText: exactFull.slice(trimmedRhs.length, trimmedRhs.length + 2),
          replaceBack: 0,
        };
      }
      return null;
    }
    return {
      insertText: nextChar,
      replaceBack: 0,
    };
  }

  // Case 2: trimmedRhs is a rounded prefix of val (e.g. pi=3.142 -> replace '2' with '15')
  // Count significant digits in trimmedRhs
  const unsigned = trimmedRhs.replace(/^[+-]/, "");
  const digitsOnly = unsigned.replace(".", "").replace(/^0+/, "");
  const sigCount = digitsOnly.length;
  if (sigCount === 0) return null;

  const roundedAtSig = val.toSignificantDigits(sigCount, Decimal.ROUND_HALF_UP).toFixed();
  if (roundedAtSig === trimmedRhs) {
    // We want to advance to (sigCount + 1) unrounded digits of exactFull
    const targetPrefixLen = trimmedRhs.length + 1;
    if (exactFull.length < targetPrefixLen) return null;
    const targetStr = exactFull.slice(0, targetPrefixLen);

    // Find common prefix between trimmedRhs and targetStr
    let common = 0;
    while (
      common < trimmedRhs.length &&
      common < targetStr.length &&
      trimmedRhs[common] === targetStr[common]
    ) {
      common++;
    }

    const replaceBack = trimmedRhs.length - common;
    const insertText = targetStr.slice(common);
    if (insertText.length > 0) {
      return { insertText, replaceBack };
    }
  }

  return null;
}

/**
 * Formats a single numeric value (with optional unit string) into one or more SuggestionCandidates,
 * applying the 4-significant-digit rounding and scientific notation threshold rules.
 */
function buildNumericCandidates(
  val: Decimal,
  prefixBeforeVal: string,
  unitSuffix: string,
  dominantAddend: Decimal | null | undefined,
  extraMeta: Partial<SuggestionCandidate>
): SuggestionCandidate[] {
  const results: SuggestionCandidate[] = [];
  const absVal = val.abs();

  // Check if A + B or A - B needs extended precision to show the difference from dominantAddend
  // (e.g. pi + 0.000001 = "3.141593")
  let customOrdinaryStr: string | null = null;
  if (dominantAddend && !val.isZero()) {
    const val4 = val.toSignificantDigits(4, Decimal.ROUND_HALF_UP);
    const dom4 = dominantAddend.toSignificantDigits(4, Decimal.ROUND_HALF_UP);
    if (val4.eq(dom4)) {
      // Find first significant digit where unrounded val and dominantAddend differ
      for (let sd = 5; sd <= 25; sd++) {
        const vTrunc = val.toSignificantDigits(sd, Decimal.ROUND_DOWN);
        const dTrunc = dominantAddend.toSignificantDigits(sd, Decimal.ROUND_DOWN);
        if (!vTrunc.eq(dTrunc)) {
          customOrdinaryStr = vTrunc.toFixed();
          break;
        }
      }
    }
  }

  const tinyThreshold = new Decimal("1e-4");
  const hugeThreshold = new Decimal("1e4");
  const minExtreme = new Decimal("1e-1000");
  const maxExtreme = new Decimal("1e1000");

  const isExtreme =
    !absVal.isZero() && (absVal.lt(minExtreme) || absVal.gt(maxExtreme));
  const needsSciAlternative =
    !absVal.isZero() && (absVal.lt(tinyThreshold) || absVal.gt(hugeThreshold));

  if (isExtreme) {
    // Prefer scientific notation exclusively below 10^-1000 or above 10^1000
    const sciNum = formatScientific(val, 4);
    const fullText = `${prefixBeforeVal}${sciNum}${unitSuffix}`;
    results.push({
      insertText: fullText,
      displayText: truncatePreview(fullText),
      replaceBack: 0,
      notation: "scientific",
      ...extraMeta,
    });
    return results;
  }

  // Ordinary decimal notation by default
  const ordNum = customOrdinaryStr ?? formatOrdinaryDecimal(val, 4);
  const fullOrd = `${prefixBeforeVal}${ordNum}${unitSuffix}`;
  results.push({
    insertText: fullOrd,
    displayText: truncatePreview(fullOrd),
    replaceBack: 0,
    notation: "decimal",
    ...extraMeta,
  });

  // Offer scientific notation as an alternative when |x| < 10^-4 or |x| > 10^4 (for pure math or when no unit alternative)
  if (needsSciAlternative && !unitSuffix) {
    const sciNum = formatScientific(val, 4);
    const fullSci = `${prefixBeforeVal}${sciNum}${unitSuffix}`;
    if (fullSci !== fullOrd) {
      results.push({
        insertText: fullSci,
        displayText: truncatePreview(fullSci),
        replaceBack: 0,
        notation: "scientific",
        ...extraMeta,
      });
    }
  }

  return results;
}

/**
 * Formats a unit quantity into Metric/Imperial candidates (or explicit target unit).
 */
function buildUnitCandidates(
  outcome: ParseOutcome,
  prefixBeforeVal: string,
  unitPreference: UnitSystemPreference,
  unitEngine: UnitEngine,
  overrideTargetUnit?: UnitDef | null
): {
  candidates: SuggestionCandidate[];
  compatibleUnits: UnitDef[];
  activeUnit?: UnitDef;
} | null {
  const { quantity } = outcome;
  const dim = normalizeDimension(quantity.dimension);
  const compatibleUnits = unitEngine.getCompatibleUnits(dim);

  // Dimensionless result from cancelling units (e.g. 1km / 500m = 2)
  if (isDimensionless(dim)) {
    const cands = buildNumericCandidates(
      quantity.value,
      prefixBeforeVal,
      "",
      quantity.dominantAddend,
      {}
    );
    return { candidates: cands, compatibleUnits: [] };
  }

  const spaceBetween =
    outcome.hasSpaceBetweenNumAndUnit && !outcome.quantity.isComposite && !outcome.hasConversionKeyword
      ? " "
      : "";

  const explicitTarget = overrideTargetUnit || outcome.targetUnit;
  if (explicitTarget) {
    if (!sameDimension(dim, explicitTarget.dimension)) return null;
    const valInTarget = quantity.value.div(explicitTarget.conversion_factor);
    const cands = buildNumericCandidates(
      valInTarget,
      prefixBeforeVal,
      `${spaceBetween}${explicitTarget.symbol}`,
      null,
      {
        unit: explicitTarget,
        unitSystem: explicitTarget.system === "Imperial" ? "imperial" : "metric",
      }
    );
    return {
      candidates: cands,
      compatibleUnits,
      activeUnit: explicitTarget,
    };
  }

  // Automatic Metric & Imperial unit selection
  const metricUnit = unitEngine.pickBestMetricUnit(
    quantity.value,
    dim,
    quantity.hintUnit
  );
  const imperialUnit = unitEngine.pickBestImperialUnit(
    quantity.value,
    dim,
    metricUnit
  );

  // If no known unit matches this dimension (e.g. M^3 -> "2 kg3"), use fallback base units
  if (!metricUnit && !imperialUnit) {
    const fallbackSuffix = unitEngine.formatFallbackBaseUnits(dim, quantity.exponentStyle);
    const cands = buildNumericCandidates(
      quantity.value,
      prefixBeforeVal,
      fallbackSuffix,
      null,
      {}
    );
    return {
      candidates: cands,
      compatibleUnits: [],
    };
  }

  const metricCandidates: SuggestionCandidate[] = [];
  const imperialCandidates: SuggestionCandidate[] = [];

  if (metricUnit) {
    // Handle very small negligible addition in units like "1km + 1pm = 1km"
    const valInMetric = quantity.value.div(metricUnit.conversion_factor);
    metricCandidates.push(
      ...buildNumericCandidates(
        valInMetric,
        prefixBeforeVal,
        `${spaceBetween}${metricUnit.symbol}`,
        null,
        {
          unit: metricUnit,
          unitSystem: "metric",
        }
      )
    );
  }

  if (imperialUnit && (!metricUnit || imperialUnit.symbol !== metricUnit.symbol)) {
    const valInImperial = quantity.value.div(imperialUnit.conversion_factor);
    imperialCandidates.push(
      ...buildNumericCandidates(
        valInImperial,
        prefixBeforeVal,
        `${spaceBetween}${imperialUnit.symbol}`,
        null,
        {
          unit: imperialUnit,
          unitSystem: "imperial",
        }
      )
    );
  }

  const ordered =
    unitPreference === "imperial"
      ? [...imperialCandidates, ...metricCandidates]
      : [...metricCandidates, ...imperialCandidates];

  return {
    candidates: ordered,
    compatibleUnits,
    activeUnit: ordered[0]?.unit,
  };
}

/**
 * Attempts to find the longest valid math/unit expression suffix in `rawLhs`
 * that respects word boundaries (e.g. allows "other text 1+1" and "text.1+1",
 * but rejects "text1+1").
 */
function parseBestSuffix(
  rawLhs: string,
  angleMode: AngleMode,
  precision: number,
  unitEngine: UnitEngine
): { outcome: ParseOutcome; exprText: string } | null {
  const n = rawLhs.length;

  for (let i = 0; i < n; i++) {
    // Skip leading whitespace
    if (rawLhs[i] === " " || rawLhs[i] === "\t") continue;

    // Boundary check at index i:
    const prevChar = i > 0 ? rawLhs[i - 1] : "";
    const curChar = rawLhs[i];

    if (i > 0) {
      // Allow starting at '.1' even after letters (e.g. "text.1+1=" -> ".1+1")
      const isDotDigit =
        curChar === "." && i + 1 < n && rawLhs[i + 1] >= "0" && rawLhs[i + 1] <= "9";

      if (!isDotDigit) {
        // Otherwise, must follow whitespace or opening punctuation
        if (!/[\s:,(;[{]/.test(prevChar)) {
          continue;
        }
      }
    }

    const candidateStr = rawLhs.slice(i);
    const tokens = tokenize(candidateStr);
    if (!tokens || tokens.length === 0) continue;

    // Reject if the first token is an identifier that starts with letters and ends with digits
    // unless it is a valid function name (log10, log2)
    if (tokens[0].type === "ident" && /^[a-zA-Z]+\d+$/.test(tokens[0].value)) {
      if (!isFuncName(tokens[0].value)) {
        continue;
      }
    }

    const outcome = evaluateExpressionTokens(tokens, angleMode, precision, unitEngine);
    if (outcome) {
      return { outcome, exprText: candidateStr };
    }
  }

  return null;
}

export interface AnalyzeOptions {
  angleMode: AngleMode;
  unitPreference: UnitSystemPreference;
  inlineEnabled: boolean;
  unitEngine?: UnitEngine;
  overrideTargetUnit?: UnitDef | null;
}

/**
 * Main entry point: analyzes the full editor text and cursor offset,
 * returning autocomplete candidates and metadata.
 */
export function analyzeEditorAtCursor(
  fullText: string,
  cursorOffset: number,
  options: AnalyzeOptions
): AutocompleteResult | null {
  const unitEngine = options.unitEngine || defaultUnitEngine;

  // Extract current line around cursor
  const lastNewline = fullText.lastIndexOf("\n", cursorOffset - 1);
  const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
  const nextNewline = fullText.indexOf("\n", cursorOffset);
  const lineEnd = nextNewline === -1 ? fullText.length : nextNewline;

  const beforeCursor = fullText.slice(lineStart, cursorOffset);
  const afterCursor = fullText.slice(cursorOffset, lineEnd);

  if (!beforeCursor.trim()) return null;

  // Check if line starts with markdown bullet list prefix "- " (hyphen followed by whitespace)
  let workingBefore = beforeCursor;
  let isBulletLine = false;
  const bulletMatch = workingBefore.match(/^(\s*-\s+)(.*)$/);
  if (bulletMatch) {
    isBulletLine = true;
    workingBefore = bulletMatch[2];
  }

  // Check if there is an '=' in workingBefore
  const eqIndex = workingBefore.lastIndexOf("=");

  if (eqIndex !== -1) {
    // Expression has '=' before cursor: <lhs> = <rhsBeforeCursor>
    const lhsRaw = workingBefore.slice(0, eqIndex);
    const rhsBefore = workingBefore.slice(eqIndex + 1);

    // If rhsBefore is empty/whitespace:
    if (rhsBefore.trim() === "") {
      // Check afterCursor: if there is already a number right after the cursor (e.g. 1+1=|4 or 1+1=|2), do NOT autocomplete!
      if (/^\s*[+-]?(?:\d|\.\d)/.test(afterCursor)) {
        return null;
      }
      if (afterCursor.length > 0 && !/^\s/.test(afterCursor)) {
        return null;
      }

      const parsed = parseBestSuffix(lhsRaw, options.angleMode, 100, unitEngine);
      if (!parsed) return null;

      return buildResultFromParsed(
        parsed.outcome,
        parsed.exprText,
        true, // hasEquals
        true && options.inlineEnabled,
        options,
        unitEngine
      );
    }

    // Otherwise, rhsBefore is non-empty: check for precision continuation!
    // Must be a partial number (e.g. "3.142", "0.7", "0.62") at the end of rhsBefore
    const rhsNumMatch = rhsBefore.match(/^\s*([+-]?(?:\d+\.?\d*|\.\d+))$/);
    if (!rhsNumMatch) {
      return null;
    }
    const rhsTyped = rhsNumMatch[1];

    // Check what is allowed in afterCursor during precision continuation:
    // Either empty/whitespace, OR a unit symbol (like "mi" in "1km -> mi = 0.62|mi")
    const afterTrimmed = afterCursor.trim();
    let trailingUnitDef: UnitDef | null = null;
    if (afterTrimmed.length > 0) {
      // Must start immediately with unit letters, not digits
      const unitMatch = afterCursor.match(/^([a-zA-ZµΩ°*0-9-]+)(?:\s.*)?$/);
      if (!unitMatch || /^\d/.test(afterCursor)) return null;
      trailingUnitDef = unitEngine.lookupExactUnit(unitMatch[1]);
      if (!trailingUnitDef) return null;
    }

    const neededPrecision = Math.max(120, rhsTyped.length + 60);
    const parsed = parseBestSuffix(lhsRaw, options.angleMode, neededPrecision, unitEngine);
    if (!parsed) return null;

    const { outcome } = parsed;
    let targetVal = outcome.quantity.value;

    if (outcome.quantity.hasUnit && !isDimensionless(outcome.quantity.dimension)) {
      const unitToUse =
        trailingUnitDef ||
        options.overrideTargetUnit ||
        outcome.targetUnit ||
        (options.unitPreference === "imperial"
          ? unitEngine.pickBestImperialUnit(outcome.quantity.value, outcome.quantity.dimension)
          : unitEngine.pickBestMetricUnit(outcome.quantity.value, outcome.quantity.dimension));
      if (!unitToUse || !sameDimension(outcome.quantity.dimension, unitToUse.dimension)) {
        return null;
      }
      targetVal = outcome.quantity.value.div(unitToUse.conversion_factor);
    }

    const cont = computePrecisionContinuation(targetVal, rhsTyped);
    if (!cont) return null;

    const candidate: SuggestionCandidate = {
      insertText: cont.insertText,
      displayText: cont.insertText,
      replaceBack: cont.replaceBack,
    };

    return {
      candidates: [candidate],
      showInline: options.inlineEnabled,
      angleDependent: false,
      compatibleUnits: [],
      debugInfo: `Precision continuation (${rhsTyped.length} chars) -> "${cont.insertText}" (replaceBack=${cont.replaceBack})`,
    };
  }

  // No '=' before cursor:
  // If cursor is in the middle of a token or '=' already follows on the line, do not autocomplete
  if (afterCursor.length > 0 && !/^\s/.test(afterCursor)) {
    return null;
  }
  if (/^\s*=/.test(afterCursor)) {
    return null;
  }

  // Must not have trailing whitespace at the end of beforeCursor
  if (/\s$/.test(workingBefore)) {
    return null;
  }

  const parsed = parseBestSuffix(workingBefore, options.angleMode, 100, unitEngine);
  if (!parsed) return null;

  const { outcome, exprText } = parsed;

  // Without '=', a bare single number or bare constant ("1", "-1", "pi", "e") should NOT autocomplete
  if (!outcome.quantity.isComposite && !outcome.hasConversionKeyword) {
    // Allow single unit quantity ONLY if it normalizes to a different unit or has an imperial/metric conversion
    if (!outcome.quantity.hasUnit) {
      return null;
    }
    // Even for a single unit token like "1500 g" or "40oz", check if it normalizes
    const normUnit =
      options.unitPreference === "imperial"
        ? unitEngine.pickBestImperialUnit(outcome.quantity.value, outcome.quantity.dimension)
        : unitEngine.pickBestMetricUnit(outcome.quantity.value, outcome.quantity.dimension);
    if (!normUnit || (outcome.quantity.hintUnit && normUnit.symbol === outcome.quantity.hintUnit.symbol)) {
      return null;
    }
  }

  const showInline = !isBulletLine && options.inlineEnabled;

  return buildResultFromParsed(
    outcome,
    exprText,
    false, // hasEquals
    showInline,
    options,
    unitEngine
  );
}

function buildResultFromParsed(
  outcome: ParseOutcome,
  exprText: string,
  hasEquals: boolean,
  showInline: boolean,
  options: AnalyzeOptions,
  unitEngine: UnitEngine
): AutocompleteResult | null {
  const eqSpace = outcome.lastBinaryOpRightSpace;
  const prefixBeforeVal = hasEquals ? "" : `${eqSpace}=${eqSpace}`;

  // Case 1: Expression has physical units
  if (outcome.quantity.hasUnit && !isDimensionless(outcome.quantity.dimension)) {
    const unitBuilt = buildUnitCandidates(
      outcome,
      prefixBeforeVal,
      options.unitPreference,
      unitEngine,
      options.overrideTargetUnit
    );
    if (!unitBuilt || unitBuilt.candidates.length === 0) return null;
    return {
      candidates: unitBuilt.candidates,
      showInline,
      angleDependent: false,
      compatibleUnits: unitBuilt.compatibleUnits,
      activeUnit: unitBuilt.activeUnit,
      debugInfo: `Unit eval "${exprText}" -> ${unitBuilt.candidates.map((c) => c.displayText).join(" | ")}`,
    };
  }

  // Case 2: Angle-dependent trig expression (e.g. sin(30) or sin 30)
  if (outcome.usedImplicitAngle) {
    const altAngleMode: AngleMode = options.angleMode === "rad" ? "deg" : "rad";
    const tokens = tokenize(exprText);
    const altOutcome = tokens
      ? evaluateExpressionTokens(tokens, altAngleMode, 100, unitEngine)
      : null;

    const primaryCands = buildNumericCandidates(
      outcome.quantity.value,
      prefixBeforeVal,
      "",
      outcome.quantity.dominantAddend,
      {}
    );

    if (altOutcome) {
      const altCands = buildNumericCandidates(
        altOutcome.quantity.value,
        prefixBeforeVal,
        "",
        altOutcome.quantity.dominantAddend,
        {}
      );

      const primaryDisp = primaryCands[0]?.insertText;
      const altDisp = altCands[0]?.insertText;

      if (primaryDisp && altDisp && primaryDisp !== altDisp) {
        const taggedPrimary: SuggestionCandidate = {
          ...primaryCands[0],
          angleBadge: options.angleMode,
        };
        const taggedAlt: SuggestionCandidate = {
          ...altCands[0],
          angleBadge: altAngleMode,
        };
        return {
          candidates: [taggedPrimary, taggedAlt],
          showInline,
          angleDependent: true,
          compatibleUnits: [],
          debugInfo: `Trig eval "${exprText}" (${options.angleMode}) -> ${taggedPrimary.displayText} [${options.angleMode}], ${taggedAlt.displayText} [${altAngleMode}]`,
        };
      }
    }
  }

  // Case 3: Pure dimensionless math expression
  const cands = buildNumericCandidates(
    outcome.quantity.value,
    prefixBeforeVal,
    "",
    outcome.quantity.dominantAddend,
    {}
  );
  if (cands.length === 0) return null;

  return {
    candidates: cands,
    showInline,
    angleDependent: false,
    compatibleUnits: [],
    debugInfo: `Math eval "${exprText}" -> ${cands.map((c) => c.displayText).join(" | ")}`,
  };
}
