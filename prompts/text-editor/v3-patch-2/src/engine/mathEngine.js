import Decimal from "decimal.js";
import {
  DEG_UNIT,
  RAD_UNIT,
  defaultUnitEngine,
  divideDimensions,
  isDimensionless,
  multiplyDimensions,
  normalizeDimension,
  powerDimension,
  sameDimension,
} from "./unitEngine.js";

// High-precision Pi cache using fast BigInt Machin's formula
let cachedPiDigits = 0;
let cachedPiString = "";

export function computePiString(digits) {
  const target = Math.max(120, digits + 30);
  if (cachedPiDigits >= target && cachedPiString) {
    return cachedPiString.slice(0, digits + 2);
  }
  // Machin's formula: pi = 16 * atan(1/5) - 4 * atan(1/239)
  const guard = 25;
  const totalDigits = target + guard;
  const scale = 10n ** BigInt(totalDigits);

  function atanInv(k) {
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

export function getPiDecimal(precision) {
  const str = computePiString(precision + 10);
  const Ctor = Decimal.clone({ precision: precision + 20 });
  return new Ctor(str);
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

function isFuncName(name) {
  const low = name.toLowerCase();
  return TRIG_FUNCS.has(low) || INV_TRIG_FUNCS.has(low) || OTHER_FUNCS.has(low);
}

function isConstantName(name) {
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

function isValidCalendarDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1 || month < 1 || month > 12 || day < 1) {
    return false;
  }
  const daysInMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const fullYear = year < 100 ? 2000 + year : year;
  const isLeap = (fullYear % 4 === 0 && fullYear % 100 !== 0) || fullYear % 400 === 0;
  const maxDay = month === 2 && isLeap ? 29 : daysInMonths[month - 1];
  return day <= maxDay;
}

/**
 * Detects whether an expression string is a VALID calendar date (e.g. "12/31/2026").
 * Invalid dates (e.g. "13/31/2026", "12/32/2026") return false so they are always inlined.
 */
export function isValidDate(expr) {
  const s = expr.trim();
  // MM/DD/YYYY, M/D/YY, MM-DD-YYYY, M-D-YY
  const mdyMatch = s.match(/^(\d{1,2})([/-])(\d{1,2})\2(\d{2}|\d{4})$/);
  if (mdyMatch) {
    const month = parseInt(mdyMatch[1], 10);
    const day = parseInt(mdyMatch[3], 10);
    const year = parseInt(mdyMatch[4], 10);
    return isValidCalendarDate(year, month, day);
  }
  // YYYY/MM/DD or YYYY-MM-DD
  const ymdMatch = s.match(/^(\d{4})([/-])(\d{1,2})\2(\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[3], 10);
    const day = parseInt(ymdMatch[4], 10);
    return isValidCalendarDate(year, month, day);
  }
  return false;
}

/**
 * Detects whether an expression string looks like a phone number (e.g. "415-555-0132").
 */
export function isPhoneNumber(expr) {
  const s = expr.trim();
  if (/^(?:\+?\d{1,3}-)?(?:\(\d{3}\)\s*-?\s*|\d{3}-)\d{3}-\d{4}$/.test(s)) {
    return true;
  }
  if (/^\d{3}-\d{4}$/.test(s)) {
    return true;
  }
  return false;
}

export function isDateOrPhoneNumber(expr) {
  return isValidDate(expr) || isPhoneNumber(expr);
}

function tokenize(input) {
  const tokens = [];
  let i = 0;
  const n = input.length;

  const consumeSpaces = () => {
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
    if (
      (ch >= "0" && ch <= "9") ||
      (ch === "." && i + 1 < n && input[i + 1] >= "0" && input[i + 1] <= "9")
    ) {
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
    if (/[a-zA-Z_µμΩπτφ°]/.test(ch)) {
      let id = "";
      while (i < n && /[a-zA-Z_µμΩπτφ°²³]/.test(input[i])) {
        id += input[i++];
      }
      // Check if this identifier is immediately followed by an integer exponent for a unit, e.g. m2, kg2, s-2
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
          (defaultUnitEngine.lookupExactUnit(id) ||
            defaultUnitEngine.lookupExactUnit(id, { preferTemperature: true }))
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

function getUnitFactorDecimal(unitDef, D, piVal) {
  if (unitDef.conversionFactorDecimal) {
    return new D(unitDef.conversionFactorDecimal.toString());
  }
  if (unitDef.symbol === "deg") {
    return piVal.div(180);
  }
  if (unitDef.symbol === "rad") {
    return new D(1);
  }
  if (unitDef.symbol === "°F" || unitDef.symbol === "°R") {
    return new D(5).div(9);
  }
  return new D(String(unitDef.conversion_factor));
}

function parseSingleUnitTermFromTokens(tokenArray, startIdx, unitEngine, lookupOpts) {
  const tok = tokenArray[startIdx];
  if (!tok || tok.type !== "ident") return null;
  const low = tok.value.toLowerCase();
  if (low === "to" || isConstantName(tok.value)) return null;
  if (isFuncName(tok.value) && low !== "sec") return null;
  if (low === "sec" && tokenArray[startIdx + 1]?.type === "lparen") return null;

  let nextPos = startIdx + 1;
  let exp = 1;
  let style = "none";
  let baseUnit = null;
  let rawTermSymbol = "";

  const powOp = tokenArray[nextPos];
  if (powOp?.type === "op" && (powOp.value === "**" || powOp.value === "^")) {
    const next1 = tokenArray[nextPos + 1];
    const next2 = tokenArray[nextPos + 2];
    if (next1?.type === "number" && /^-?\d+$/.test(next1.value)) {
      const candidateBase = unitEngine.lookupExactUnit(tok.value, lookupOpts);
      if (candidateBase) {
        baseUnit = candidateBase;
        exp = parseInt(next1.value, 10);
        style = "power";
        rawTermSymbol = `${candidateBase.symbol}**${exp}`;
        nextPos += 2;
      }
    } else if (
      next1?.type === "op" &&
      (next1.value === "-" || next1.value === "+") &&
      next2?.type === "number" &&
      /^\d+$/.test(next2.value)
    ) {
      const candidateBase = unitEngine.lookupExactUnit(tok.value, lookupOpts);
      if (candidateBase) {
        baseUnit = candidateBase;
        exp = parseInt(next1.value + next2.value, 10);
        style = "power";
        rawTermSymbol = `${candidateBase.symbol}**${exp}`;
        nextPos += 3;
      }
    }
  }

  if (!baseUnit) {
    const resolved = unitEngine.resolveUnitToken(tok.value, lookupOpts);
    if (!resolved) return null;
    baseUnit = resolved.unitDef;
    exp = resolved.exponent;
    style = resolved.exponentStyle;
    if (exp === 1) {
      rawTermSymbol = baseUnit.symbol;
    } else if (style === "power") {
      rawTermSymbol = `${baseUnit.symbol}**${exp}`;
    } else {
      rawTermSymbol = `${baseUnit.symbol}${exp}`;
    }
  }

  return {
    baseUnit,
    exp,
    style,
    rawTermSymbol,
    nextPos,
  };
}

function parseUnitClusterFromTokens(tokenArray, startPos, unitEngine, lookupOpts, D, piVal) {
  let curPos = startPos;
  let factor = new D(1);
  let dimension = {};
  let explicitAngle = null;
  let hintUnit = null;
  let exponentStyle = "none";
  let count = 0;
  let combinedSymbol = "";

  const canParseAt = (idx) =>
    !!parseSingleUnitTermFromTokens(tokenArray, idx, unitEngine, lookupOpts);

  while (curPos < tokenArray.length) {
    let opSign = 1;
    let sep = count === 0 ? "" : " ";
    let termStart = curPos;

    if (count > 0) {
      const curTok = tokenArray[curPos];
      if (curTok?.type === "op" && curTok.value === "/") {
        if (!canParseAt(curPos + 1)) break;
        opSign = -1;
        sep = "/";
        termStart = curPos + 1;
      } else if (curTok?.type === "op" && curTok.value === "*" && curTok.raw === "·") {
        if (!canParseAt(curPos + 1)) break;
        opSign = 1;
        sep = "·";
        termStart = curPos + 1;
      } else if (!canParseAt(curPos)) {
        break;
      }
    } else if (!canParseAt(curPos)) {
      break;
    }

    const term = parseSingleUnitTermFromTokens(tokenArray, termStart, unitEngine, lookupOpts);
    if (!term) break;

    curPos = term.nextPos;
    const effectiveExp = opSign * term.exp;
    const { baseUnit, style } = term;

    if (sameDimension(baseUnit.dimension, { A: 1 }) && effectiveExp === 1 && count === 0) {
      explicitAngle = baseUnit.symbol === "deg" ? "deg" : "rad";
    } else {
      explicitAngle = null;
    }

    const unitFactor = getUnitFactorDecimal(baseUnit, D, piVal).pow(effectiveExp);
    factor = factor.mul(unitFactor);
    const unitDim = powerDimension(baseUnit.dimension, effectiveExp);
    dimension = multiplyDimensions(dimension, unitDim);

    if (style === "power") exponentStyle = "power";
    else if (style === "attached" && exponentStyle === "none") exponentStyle = "attached";

    combinedSymbol += sep + term.rawTermSymbol;
    count++;
  }

  if (count === 0) return null;

  const exactCombined = unitEngine.lookupExactUnit(combinedSymbol, lookupOpts);
  if (exactCombined) {
    hintUnit = exactCombined;
  }

  return {
    factor,
    dimension: normalizeDimension(dimension),
    explicitAngle,
    hintUnit,
    exponentStyle,
    count,
    combinedSymbol,
    nextPos: curPos,
  };
}

function resolveUnitTokensAsUnitDef(unitTokens, unitEngine, lookupOpts, D, piVal) {
  if (!unitTokens || unitTokens.length === 0) return null;
  const cluster = parseUnitClusterFromTokens(unitTokens, 0, unitEngine, lookupOpts, D, piVal);
  if (!cluster || cluster.nextPos !== unitTokens.length) return null;
  if (cluster.hintUnit) {
    return cluster.hintUnit;
  }
  return {
    unit: cluster.combinedSymbol,
    symbol: cluster.combinedSymbol,
    dimension: cluster.dimension,
    conversion_factor: cluster.factor.toNumber(),
    conversionFactorDecimal: cluster.factor,
    system: "SI",
  };
}

function evaluateExpressionTokensCore(
  tokens,
  angleMode,
  precision,
  unitEngine,
  preferTemperature
) {
  if (tokens.length === 0) return null;

  const lookupOpts = { preferTemperature };

  const basePrec = Math.max(1200, precision + 200);
  const D = Decimal.clone({
    precision: basePrec,
    rounding: Decimal.ROUND_HALF_UP,
    maxE: 1e15,
    minE: -1e15,
  });

  const piVal = getPiDecimal(basePrec);

  // Check for top-level conversion at the end: "... to <unit>" or "... -> <unit>"
  let targetUnit = null;
  let hasConversionKeyword = false;
  let conversionRightSpace = "";
  let exprTokens = tokens;

  const isToOrArrow = (tok) =>
    tok &&
    (tok.type === "arrow" || (tok.type === "ident" && tok.value.toLowerCase() === "to"));

  let toIdx = -1;
  for (let idx = tokens.length - 2; idx >= 1; idx--) {
    if (isToOrArrow(tokens[idx])) {
      toIdx = idx;
      break;
    }
  }

  if (toIdx !== -1) {
    const targetTokens = tokens.slice(toIdx + 1);
    const resolvedTarget = resolveUnitTokensAsUnitDef(
      targetTokens,
      unitEngine,
      lookupOpts,
      D,
      piVal
    );
    if (!resolvedTarget) return null;
    targetUnit = resolvedTarget;
    hasConversionKeyword = true;
    conversionRightSpace = tokens[toIdx].spaceAfter;
    exprTokens = tokens.slice(0, toIdx);
  }

  if (exprTokens.length === 0) return null;

  let pos = 0;
  let usedImplicitAngle = false;
  let lastBinaryOpRightSpace = "";
  let hasSpaceBetweenNumAndUnit = false;
  let inExponentDepth = 0;
  let allowBareUnit = false;
  let suppressAttachedUnits = false;

  const peek = (offset = 0) => exprTokens[pos + offset];
  const consume = () => exprTokens[pos++];

  // Check if token at idx starts a unit cluster
  function canParseUnitAt(idx) {
    return !!parseSingleUnitTermFromTokens(exprTokens, idx, unitEngine, lookupOpts);
  }

  // Parses one or more adjacent or slash-separated unit tokens (e.g. "kg", "m**2", "N m^-2", "kg m2 s-2", "g/mol", "cm/s")
  function parseUnitCluster() {
    const cluster = parseUnitClusterFromTokens(
      exprTokens,
      pos,
      unitEngine,
      lookupOpts,
      D,
      piVal
    );
    if (!cluster) return null;
    pos = cluster.nextPos;
    return cluster;
  }

  function attachOptionalUnits(base, hadSpaceBeforeUnit) {
    if (!canParseUnitAt(pos)) return base;
    const cluster = parseUnitCluster();
    if (!cluster) return base;
    if (
      hadSpaceBeforeUnit &&
      !base.isComposite &&
      cluster.count === 1 &&
      cluster.exponentStyle === "none"
    ) {
      hasSpaceBetweenNumAndUnit = true;
    }
    return {
      value: base.value.mul(cluster.factor),
      dimension: multiplyDimensions(base.dimension, cluster.dimension),
      hasUnit: true,
      explicitAngle: cluster.explicitAngle,
      hintUnit: !base.hasUnit ? cluster.hintUnit : null,
      exponentStyle:
        cluster.exponentStyle !== "none" ? cluster.exponentStyle : base.exponentStyle,
      isComposite: base.isComposite,
    };
  }

  function applyFunction(fnName, arg) {
    const low = fnName.toLowerCase();

    // Trig functions accept dimensionless or angle ({ A: 1 }) arguments
    if (TRIG_FUNCS.has(low)) {
      const isAngleDim = arg.hasUnit && sameDimension(arg.dimension, { A: 1 });
      if (arg.hasUnit && !isDimensionless(arg.dimension) && !isAngleDim) return null;

      let angleRad;
      let explicitDegVal = null;

      if (isAngleDim) {
        // arg.value is already in radians!
        angleRad = arg.value;
        if (arg.explicitAngle === "deg" || arg.hintUnit?.symbol === "deg") {
          explicitDegVal = arg.value.mul(180).div(piVal);
        }
      } else if (arg.explicitAngle === "deg") {
        explicitDegVal = arg.value;
        angleRad = arg.value.mul(piVal).div(180);
      } else if (arg.explicitAngle === "rad") {
        angleRad = arg.value;
      } else {
        usedImplicitAngle = true;
        if (angleMode === "deg") {
          explicitDegVal = arg.value;
          angleRad = arg.value.mul(piVal).div(180);
        } else {
          angleRad = arg.value;
        }
      }

      if (explicitDegVal !== null) {
        const degMod = explicitDegVal.mod(360).add(360).mod(360);
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
      }

      // Reduce angleRad modulo 2*pi for high precision stability
      // Keep trigPrec <= 450 so pr + x.sd() + 7 stays well under decimal.js PI_PRECISION (1025)
      const trigPrec = Math.min(450, Math.max(80, (precision === 1100 ? 80 : precision) + 30));
      const twoPi = piVal.mul(2);
      const reduced = angleRad.mod(twoPi).toSignificantDigits(trigPrec);
      const TrigD = Decimal.clone({ precision: trigPrec });
      const r = new TrigD(reduced.toString());

      let out;
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
      const trigPrec = Math.min(450, Math.max(80, (precision === 1100 ? 80 : precision) + 30));
      const TrigD = Decimal.clone({ precision: trigPrec });
      const v = new TrigD(arg.value.toSignificantDigits(trigPrec).toString());
      let radOut;
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
      const newDim = {};
      for (const [k, exp] of Object.entries(arg.dimension)) {
        if ((exp || 0) % 2 !== 0) return null;
        newDim[k] = (exp || 0) / 2;
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
      const newDim = {};
      for (const [k, exp] of Object.entries(arg.dimension)) {
        if ((exp || 0) % 3 !== 0) return null;
        newDim[k] = (exp || 0) / 3;
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

  function makePure(val, isComposite) {
    return {
      value: val,
      dimension: {},
      hasUnit: false,
      exponentStyle: "none",
      isComposite,
    };
  }

  function parseAddSub() {
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

        const newVal =
          tok.value === "+" ? left.value.add(right.value) : left.value.sub(right.value);

        let dominantAddend = null;
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

  function canStartImplicitMul() {
    const tok = peek();
    if (!tok) return false;
    if (tok.type === "lparen") return true;
    if (tok.type === "ident") {
      if (tok.value.toLowerCase() === "to") return false;
      if (isConstantName(tok.value) || isFuncName(tok.value)) return true;
    }
    return false;
  }

  function parseMulDiv() {
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

        // If dividing a dimensionless quantity by a number followed by a space-separated unit
        // (e.g. "pi/2 rad to deg" or "1/2 km to m"), do not attach the unit to the denominator;
        // instead attach it to the resulting quotient!
        const nextTok = peek();
        const deferUnitToQuotient =
          tok.value === "/" &&
          !left.hasUnit &&
          nextTok &&
          (nextTok.type === "number" || (nextTok.type === "ident" && isConstantName(nextTok.value))) &&
          nextTok.spaceAfter.length > 0;

        const prevSuppress = suppressAttachedUnits;
        if (deferUnitToQuotient) suppressAttachedUnits = true;
        const right = parseUnary();
        suppressAttachedUnits = prevSuppress;
        allowBareUnit = prevBare;
        if (!right) return null;

        if (tok.value === "*") {
          const newDim = multiplyDimensions(left.dimension, right.dimension);
          let hintUnit = null;
          if (left.hasUnit && !right.hasUnit) hintUnit = left.hintUnit || null;
          else if (!left.hasUnit && right.hasUnit) hintUnit = right.hintUnit || null;

          left = {
            value: left.value.mul(right.value),
            dimension: newDim,
            hasUnit: left.hasUnit || right.hasUnit,
            explicitAngle: left.explicitAngle || right.explicitAngle || null,
            hintUnit,
            exponentStyle:
              left.exponentStyle !== "none" ? left.exponentStyle : right.exponentStyle,
            isComposite: true,
          };
        } else if (tok.value === "/") {
          if (right.value.isZero()) return null;
          const newDim = divideDimensions(left.dimension, right.dimension);
          let hintUnit = null;
          if (left.hasUnit && !right.hasUnit) hintUnit = left.hintUnit || null;

          left = {
            value: left.value.div(right.value),
            dimension: newDim,
            hasUnit: left.hasUnit || right.hasUnit,
            explicitAngle: left.explicitAngle || null,
            hintUnit,
            exponentStyle:
              left.exponentStyle !== "none" ? left.exponentStyle : right.exponentStyle,
            isComposite: true,
          };

          if (deferUnitToQuotient && inExponentDepth === 0 && canParseUnitAt(pos)) {
            left = attachOptionalUnits(left, true);
          }
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
          explicitAngle: left.explicitAngle || right.explicitAngle || null,
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

  function parseUnary() {
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
      let arg = null;
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

  function parsePowerWithUnits() {
    const tok = peek();
    if (!tok) return null;

    let base = null;
    let spaceAfterAtom = "";

    if (tok.type === "number") {
      consume();
      spaceAfterAtom = tok.spaceAfter;
      base = makePure(new D(tok.value), false);
    } else if (tok.type === "ident" && isConstantName(tok.value)) {
      consume();
      spaceAfterAtom = tok.spaceAfter;
      const low = tok.value.toLowerCase();
      let cVal;
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
      (allowBareUnit || (pos === 0 && exprTokens.length > 1)) &&
      inExponentDepth === 0 &&
      canParseUnitAt(pos)
    ) {
      const wasAtStart = !allowBareUnit && pos === 0;
      const cluster = parseUnitCluster();
      if (!cluster) return null;
      if (wasAtStart && pos === exprTokens.length) {
        if (
          cluster.count <= 1 ||
          !cluster.factor.eq(1) ||
          cluster.hintUnit ||
          !unitEngine.pickBestMetricUnit(cluster.factor, cluster.dimension)
        ) {
          return null;
        }
      }
      return {
        value: cluster.factor,
        dimension: cluster.dimension,
        hasUnit: true,
        explicitAngle: cluster.explicitAngle,
        hintUnit: cluster.count === 1 ? cluster.hintUnit : null,
        exponentStyle: cluster.exponentStyle,
        isComposite: true,
      };
    } else {
      return null;
    }

    if (!suppressAttachedUnits && inExponentDepth === 0 && canParseUnitAt(pos)) {
      base = attachOptionalUnits(base, spaceAfterAtom.length > 0);
    }

    // Postfix factorial '!'
    while (peek()?.type === "op" && peek().value === "!") {
      const bang = consume();
      spaceAfterAtom = bang.spaceAfter;
      if (
        base.hasUnit ||
        !base.value.isInteger() ||
        base.value.isNegative() ||
        base.value.gt(1000)
      ) {
        return null;
      }
      let f = new D(1);
      const limit = base.value.toNumber();
      for (let k = 2; k <= limit; k++) f = f.mul(k);
      base = makePure(f, true);
    }

    // Power operator '**' or '^' (when not already consumed as a unit exponent)
    if (peek()?.type === "op" && (peek().value === "**" || peek().value === "^")) {
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
        if (
          expOperand.value.abs().gt(100000) &&
          !base.value.abs().eq(10) &&
          !base.value.abs().eq(1) &&
          !base.value.isZero()
        ) {
          return null;
        }
        // Ensure sufficient Decimal precision when raising to large integer powers (e.g. 2**1000)
        let powResult;
        if (expOperand.value.isInteger() && !base.value.isZero()) {
          const expNum = expOperand.value.toNumber();
          const baseNum = Math.max(2, base.value.abs().toNumber());
          const estDigits = Math.ceil(Math.abs(expNum) * Math.log10(baseNum)) + 100;
          if (estDigits > basePrec && estDigits <= 50000 && Number.isFinite(estDigits)) {
            const PowD = Decimal.clone({
              precision: estDigits,
              rounding: Decimal.ROUND_HALF_UP,
              maxE: 1e15,
              minE: -1e15,
            });
            powResult = new PowD(base.value.toString()).pow(expNum);
          } else {
            powResult = base.value.pow(expOperand.value);
          }
        } else {
          powResult = base.value.pow(expOperand.value);
        }
        base = makePure(powResult, true);
      }

      if (!suppressAttachedUnits && inExponentDepth === 0 && canParseUnitAt(pos)) {
        base = attachOptionalUnits(base, true);
      }
    }

    return base;
  }

  try {
    const quantity = parseAddSub();
    if (!quantity || pos !== exprTokens.length) return null;

    // Validate dimensional compatibility with explicit targetUnit right here so fallback passes can run
    if (targetUnit) {
      if (!quantity.hasUnit || !sameDimension(quantity.dimension, targetUnit.dimension)) {
        return null;
      }
    }

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
      piVal,
      D,
    };
  } catch {
    return null;
  }
}

export function evaluateExpressionTokens(
  tokens,
  angleMode,
  precision,
  unitEngine = defaultUnitEngine
) {
  // Pass 1: Standard SI interpretation (C/c = Coulomb, F/f = Farad)
  const standardOutcome = evaluateExpressionTokensCore(
    tokens,
    angleMode,
    precision,
    unitEngine,
    false
  );
  if (standardOutcome) {
    return standardOutcome;
  }

  // Pass 2: Special rule for Celsius / Coulomb ('C'/'c') and Fahrenheit / Farad ('F'/'f')
  const hasAmbiguousTempToken = tokens.some(
    (t) =>
      t.type === "ident" &&
      (t.value === "C" || t.value === "c" || t.value === "F" || t.value === "f")
  );
  if (hasAmbiguousTempToken) {
    return evaluateExpressionTokensCore(tokens, angleMode, precision, unitEngine, true);
  }

  return null;
}

/**
 * Formats a Decimal into ordinary decimal notation.
 * Never rounds away integer digits before the decimal point (e.g. 2**14 = 16384, 10000+10001 = 20001, 2**1000 = full 302 digits).
 * For numbers with fewer than `sigDigits` integer digits, rounds to `sigDigits` significant digits.
 */
export function formatOrdinaryDecimal(
  val,
  sigDigits = 4,
  rounding = Decimal.ROUND_HALF_UP
) {
  if (val.isZero()) return "0";
  const intDigits = val.e >= 0 ? val.e + 1 : 0;
  const targetSig = Math.max(sigDigits, intDigits);
  const rounded = val.toSignificantDigits(targetSig, rounding);
  return rounded.toFixed();
}

/**
 * Formats a Decimal in scientific notation (e.g. "1.234e5" or "1e-6").
 */
export function formatScientific(val, sigDigits = 4) {
  if (val.isZero()) return "0";
  const rounded = val.toSignificantDigits(sigDigits, Decimal.ROUND_HALF_UP);
  const expStr = rounded.toExponential();
  return expStr.replace(/e\+/i, "e");
}

/**
 * Truncates very long preview strings with "..." ONLY for bottom-bar chip display.
 */
export function truncatePreview(str, maxChars = 28) {
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars - 3) + "...";
}

function toExactFixedString(val) {
  if (val.isZero()) return "0";
  return val.toFixed();
}

/**
 * Computes the precision continuation (or targeted replacement) candidate when the user
 * has already typed `<lhs> = <rhsTyped>` at the cursor.
 */
function computePrecisionContinuation(val, rhsTyped) {
  const trimmedRhs = rhsTyped.trim();
  if (!trimmedRhs) return null;

  if (val.isNegative() && !trimmedRhs.startsWith("-")) return null;
  if (!val.isNegative() && trimmedRhs.startsWith("-")) return null;

  const exactFull = toExactFixedString(val);

  if (exactFull === trimmedRhs) {
    return null;
  }

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

  const unsigned = trimmedRhs.replace(/^[+-]/, "");
  const digitsOnly = unsigned.replace(".", "").replace(/^0+/, "");
  const sigCount = digitsOnly.length;
  if (sigCount === 0) return null;

  const roundedAtSig = val.toSignificantDigits(sigCount, Decimal.ROUND_HALF_UP).toFixed();
  if (roundedAtSig === trimmedRhs) {
    const targetPrefixLen = trimmedRhs.length + 1;
    if (exactFull.length < targetPrefixLen) return null;
    const targetStr = exactFull.slice(0, targetPrefixLen);

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
 * Formats a single numeric value (with optional unit string) into one or more SuggestionCandidates.
 */
function buildNumericCandidates(
  val,
  prefixBeforeVal,
  unitSuffix,
  dominantAddend,
  extraMeta
) {
  const results = [];
  const absVal = val.abs();

  let customOrdinaryStr = null;
  if (dominantAddend && !val.isZero()) {
    const baseSig = Math.max(
      4,
      val.e >= 0 ? val.e + 1 : 0,
      dominantAddend.e >= 0 ? dominantAddend.e + 1 : 0
    );
    const valBase = val.toSignificantDigits(baseSig, Decimal.ROUND_HALF_UP);
    const domBase = dominantAddend.toSignificantDigits(baseSig, Decimal.ROUND_HALF_UP);
    if (valBase.eq(domBase)) {
      for (let sd = baseSig + 1; sd <= baseSig + 25; sd++) {
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

  // Offer scientific notation as an alternative when |x| < 10^-4 or |x| > 10^4
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
  outcome,
  prefixBeforeVal,
  unitPreference,
  unitEngine,
  overrideTargetUnit
) {
  const { quantity } = outcome;
  const D = outcome.D || Decimal.clone({ precision: 1200 });
  const piVal = outcome.piVal || getPiDecimal(1200);
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
    outcome.hasSpaceBetweenNumAndUnit &&
    !outcome.quantity.isComposite &&
    !outcome.hasConversionKeyword
      ? " "
      : "";

  const explicitTarget = overrideTargetUnit || outcome.targetUnit;
  if (explicitTarget) {
    if (!sameDimension(dim, explicitTarget.dimension)) return null;
    const targetFactor = getUnitFactorDecimal(explicitTarget, D, piVal);
    const valInTarget = quantity.value.div(targetFactor);
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

  const metricCandidates = [];
  const imperialCandidates = [];

  if (metricUnit) {
    const factor = getUnitFactorDecimal(metricUnit, D, piVal);
    const valInMetric = quantity.value.div(factor);
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
    const factor = getUnitFactorDecimal(imperialUnit, D, piVal);
    const valInImperial = quantity.value.div(factor);
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

function parseBestSuffix(rawLhs, angleMode, precision, unitEngine) {
  const n = rawLhs.length;

  for (let i = 0; i < n; i++) {
    if (rawLhs[i] === " " || rawLhs[i] === "\t") continue;

    const prevChar = i > 0 ? rawLhs[i - 1] : "";
    const curChar = rawLhs[i];

    if (i > 0) {
      const isDotDigit =
        curChar === "." && i + 1 < n && rawLhs[i + 1] >= "0" && rawLhs[i + 1] <= "9";

      if (!isDotDigit) {
        if (!/[\s:,(;[{]/.test(prevChar)) {
          continue;
        }
      }
    }

    const candidateStr = rawLhs.slice(i);
    const tokens = tokenize(candidateStr);
    if (!tokens || tokens.length === 0) continue;

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

/**
 * Main entry point: analyzes the full editor text and cursor offset,
 * returning autocomplete candidates and metadata.
 */
export function analyzeEditorAtCursor(fullText, cursorOffset, options) {
  const unitEngine = options.unitEngine || defaultUnitEngine;

  const lastNewline = fullText.lastIndexOf("\n", cursorOffset - 1);
  const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
  const nextNewline = fullText.indexOf("\n", cursorOffset);
  const lineEnd = nextNewline === -1 ? fullText.length : nextNewline;

  const beforeCursor = fullText.slice(lineStart, cursorOffset);
  const afterCursor = fullText.slice(cursorOffset, lineEnd);

  if (!beforeCursor.trim()) return null;

  let workingBefore = beforeCursor;
  let isBulletLine = false;
  const bulletMatch = workingBefore.match(/^(\s*-\s+)(.*)$/);
  if (bulletMatch) {
    isBulletLine = true;
    workingBefore = bulletMatch[2];
  }

  const eqIndex = workingBefore.lastIndexOf("=");

  if (eqIndex !== -1) {
    const lhsRaw = workingBefore.slice(0, eqIndex);
    const rhsBefore = workingBefore.slice(eqIndex + 1);

    if (rhsBefore.trim() === "") {
      if (/^\s*[+-]?(?:\d|\.\d)/.test(afterCursor)) {
        return null;
      }
      if (afterCursor.length > 0 && !/^\s/.test(afterCursor)) {
        return null;
      }

      const parsed = parseBestSuffix(lhsRaw, options.angleMode, 1100, unitEngine);
      if (!parsed) return null;

      // Always inline when there is an equals sign (even for dates and phone numbers)
      const showInline = Boolean(options.inlineEnabled);

      return buildResultFromParsed(
        parsed.outcome,
        parsed.exprText,
        true,
        showInline,
        options,
        unitEngine,
        false
      );
    }

    // Precision continuation after '=' (supports cursor before unit or after unit)
    const rhsOnlyNumMatch = rhsBefore.match(/^\s*([+-]?(?:\d+\.?\d*|\.\d+))$/);
    const rhsNumWithUnitMatch = !rhsOnlyNumMatch
      ? rhsBefore.match(/^\s*([+-]?(?:\d+\.?\d*|\.\d+))(\s*[a-zA-ZµμΩ°].*)$/)
      : null;

    if (!rhsOnlyNumMatch && !rhsNumWithUnitMatch) {
      return null;
    }

    const rhsTyped = rhsOnlyNumMatch ? rhsOnlyNumMatch[1] : rhsNumWithUnitMatch[1];
    const unitSuffixInRhs = rhsNumWithUnitMatch ? rhsNumWithUnitMatch[2] : "";

    if (rhsNumWithUnitMatch) {
      if (/\s$/.test(unitSuffixInRhs)) return null;
      if (afterCursor.length > 0 && !/^\s/.test(afterCursor)) return null;
    }

    const neededPrecision = Math.max(1200, rhsTyped.length + 100);
    const parsed = parseBestSuffix(lhsRaw, options.angleMode, neededPrecision, unitEngine);
    if (!parsed) return null;

    const { outcome } = parsed;
    const D = outcome.D || Decimal.clone({ precision: neededPrecision });
    const piVal = outcome.piVal || getPiDecimal(neededPrecision);

    const resolveRhsUnitStr = (uStr) => {
      const uTokens = tokenize(uStr.trim());
      if (!uTokens || uTokens.length === 0) return null;
      return (
        resolveUnitTokensAsUnitDef(uTokens, unitEngine, { preferTemperature: false }, D, piVal) ||
        resolveUnitTokensAsUnitDef(uTokens, unitEngine, { preferTemperature: true }, D, piVal)
      );
    };

    let trailingUnitDef = null;
    if (rhsNumWithUnitMatch) {
      trailingUnitDef = resolveRhsUnitStr(unitSuffixInRhs);
      if (!trailingUnitDef) return null;
    } else {
      const afterTrimmed = afterCursor.trim();
      if (afterTrimmed.length > 0) {
        if (/^[+-]?(?:\d|\.\d)/.test(afterTrimmed)) return null;
        const unitMatch = afterCursor.match(/^(\s*[a-zA-ZµμΩ°*^0-9/-]+(?:\s+[a-zA-ZµμΩ°*^0-9/-]+)*)/);
        if (!unitMatch) return null;
        trailingUnitDef = resolveRhsUnitStr(unitMatch[1]);
        if (!trailingUnitDef) return null;
      }
    }

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
      const factor = getUnitFactorDecimal(unitToUse, D, piVal);
      targetVal = outcome.quantity.value.div(factor);
    } else if (trailingUnitDef) {
      return null;
    }

    const cont = computePrecisionContinuation(targetVal, rhsTyped);
    if (!cont) return null;

    const finalInsertText = unitSuffixInRhs
      ? cont.insertText + unitSuffixInRhs
      : cont.insertText;
    const finalReplaceBack = unitSuffixInRhs
      ? cont.replaceBack + unitSuffixInRhs.length
      : cont.replaceBack;

    const candidate = {
      insertText: finalInsertText,
      displayText: truncatePreview(finalInsertText),
      replaceBack: finalReplaceBack,
    };

    return {
      candidates: [candidate],
      showInline: Boolean(options.inlineEnabled),
      angleDependent: false,
      compatibleUnits: [],
      debugInfo: `Precision continuation (${rhsTyped.length} chars) -> "${finalInsertText}" (replaceBack=${finalReplaceBack})`,
    };
  }

  // No '=' before cursor:
  if (afterCursor.length > 0 && !/^\s/.test(afterCursor)) {
    return null;
  }
  if (/^\s*=/.test(afterCursor)) {
    return null;
  }

  const hasTrailingSpace = /\s$/.test(workingBefore);

  const parsed = parseBestSuffix(workingBefore, options.angleMode, 1100, unitEngine);
  if (!parsed) return null;

  const { outcome, exprText } = parsed;

  if (!outcome.quantity.isComposite && !outcome.hasConversionKeyword) {
    if (!outcome.quantity.hasUnit) {
      return null;
    }
    const normUnit =
      options.unitPreference === "imperial"
        ? unitEngine.pickBestImperialUnit(outcome.quantity.value, outcome.quantity.dimension)
        : unitEngine.pickBestMetricUnit(
            outcome.quantity.value,
            outcome.quantity.dimension,
            outcome.quantity.hintUnit
          );
    if (
      !normUnit ||
      (outcome.quantity.hintUnit && normUnit.symbol === outcome.quantity.hintUnit.symbol)
    ) {
      return null;
    }
  }

  const showInline =
    !isBulletLine &&
    !isValidDate(exprText) &&
    !isPhoneNumber(exprText) &&
    Boolean(options.inlineEnabled);

  return buildResultFromParsed(
    outcome,
    exprText,
    false,
    showInline,
    options,
    unitEngine,
    hasTrailingSpace
  );
}

function buildResultFromParsed(
  outcome,
  exprText,
  hasEquals,
  showInline,
  options,
  unitEngine,
  hasTrailingSpace = false
) {
  const eqSpace = outcome.lastBinaryOpRightSpace;
  const leftEqSpace = hasTrailingSpace ? "" : eqSpace;
  const rightEqSpace = eqSpace || (hasTrailingSpace ? " " : "");
  const prefixBeforeVal = hasEquals ? "" : `${leftEqSpace}=${rightEqSpace}`;

  // Case 1: Expression has physical or angle units
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
    const altAngleMode = options.angleMode === "rad" ? "deg" : "rad";
    const tokens = tokenize(exprText);
    const altOutcome = tokens
      ? evaluateExpressionTokens(tokens, altAngleMode, 1100, unitEngine)
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
        const taggedPrimary = {
          ...primaryCands[0],
          angleBadge: options.angleMode,
        };
        const taggedAlt = {
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

export { RAD_UNIT, DEG_UNIT };
