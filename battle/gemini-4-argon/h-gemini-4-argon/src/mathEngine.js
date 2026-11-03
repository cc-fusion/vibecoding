import Decimal from 'decimal.js';
import {
  zeroDims,
  isDimensionless,
  dimsEqual,
  addDims,
  subDims,
  scaleDims,
  formatExpSuffix,
} from './units.js';
import { logger } from './logger.js';

// High-precision Gauss-Legendre AGM cache for Pi (supports >5,000 digits cleanly)
let cachedPiDigits = 0;
let cachedPiStr = '';

export function getPiDecimal(precision = 80) {
  const targetDigits = Math.max(100, precision + 24);
  if (cachedPiDigits < targetDigits) {
    const D = Decimal.clone({ precision: targetDigits + 32, toExpNeg: -1000000, toExpPos: 1000000 });
    let a = new D(1);
    let b = new D(1).div(D.sqrt(2));
    let t = new D('0.25');
    let p = new D(1);
    const steps = Math.ceil(Math.log2(targetDigits)) + 2;

    for (let i = 0; i < steps; i++) {
      const aNext = a.plus(b).div(2);
      const bNext = D.sqrt(a.mul(b));
      const diff = a.minus(aNext);
      t = t.minus(p.mul(diff.mul(diff)));
      p = p.mul(2);
      a = aNext;
      b = bNext;
    }

    const sum = a.plus(b);
    const pi = sum.mul(sum).div(t.mul(4));
    cachedPiStr = pi.toFixed(targetDigits);
    cachedPiDigits = targetDigits;
  }

  const DOut = Decimal.clone({
    precision,
    toExpNeg: -1000000,
    toExpPos: 1000000,
  });
  return new DOut(cachedPiStr.slice(0, precision + 6));
}

// Arbitrary-precision Taylor sin/cos fallback when precision > 980 (exceeding decimal.js internal table)
function sinHighPrec(x, D, prec) {
  const twoPi = getPiDecimal(prec + 20).mul(2);
  let r = x.mod(twoPi);
  if (r.gt(twoPi.div(2))) r = r.minus(twoPi);
  if (r.lt(twoPi.div(-2))) r = r.plus(twoPi);

  const r2 = r.mul(r).neg();
  let term = r;
  let sum = r;
  const eps = new D(10).pow(-(prec + 6));
  for (let k = 1; k < 2500; k++) {
    term = term.mul(r2).div((2 * k) * (2 * k + 1));
    sum = sum.plus(term);
    if (term.abs().lt(eps)) break;
  }
  return sum;
}

function cosHighPrec(x, D, prec) {
  const twoPi = getPiDecimal(prec + 20).mul(2);
  let r = x.mod(twoPi);
  if (r.gt(twoPi.div(2))) r = r.minus(twoPi);
  if (r.lt(twoPi.div(-2))) r = r.plus(twoPi);

  const r2 = r.mul(r).neg();
  let term = new D(1);
  let sum = term;
  const eps = new D(10).pow(-(prec + 6));
  for (let k = 1; k < 2500; k++) {
    term = term.mul(r2).div((2 * k - 1) * (2 * k));
    sum = sum.plus(term);
    if (term.abs().lt(eps)) break;
  }
  return sum;
}

const FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'sec', 'csc', 'cot',
  'asin', 'arcsin', 'acos', 'arccos', 'atan', 'arctan', 'atan2',
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'sqrt', 'cbrt', 'exp', 'ln', 'log', 'log10', 'log2',
  'abs', 'floor', 'ceil', 'round', 'sign',
  'min', 'max', 'gcd', 'lcm', 'mod',
]);

const CONSTANTS = new Set(['pi', 'π', 'PI', 'tau', 'τ', 'TAU', 'e', 'phi', 'φ', 'PHI']);

const SUPERSCRIPT_MAP = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '7': '7', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-',
};

export function tokenizeExpression(input, unitEngine) {
  const tokens = [];
  let i = 0;
  const n = input.length;
  let pendingSpace = '';

  const attachTrailingSpaceToPrevOp = (sp) => {
    if (tokens.length > 0) {
      const prev = tokens[tokens.length - 1];
      if (prev.type === 'OP' || prev.type === 'CONVERT' || prev.type === 'POW') {
        prev.spaceAfter = sp;
      }
    }
  };

  while (i < n) {
    // 1. Whitespace
    const wsMatch = input.slice(i).match(/^[ \t]+/);
    if (wsMatch) {
      pendingSpace += wsMatch[0];
      i += wsMatch[0].length;
      continue;
    }

    attachTrailingSpaceToPrevOp(pendingSpace);
    const spaceBefore = pendingSpace;
    pendingSpace = '';

    const rest = input.slice(i);

    // 2. Conversion arrow -> or →
    if (rest.startsWith('->') || rest.startsWith('→')) {
      const raw = rest.startsWith('->') ? '->' : '→';
      tokens.push({ type: 'CONVERT', raw, spaceBefore, spaceAfter: '', pos: i });
      i += raw.length;
      continue;
    }

    // 3. Power ** or ^
    if (rest.startsWith('**')) {
      tokens.push({ type: 'POW', raw: '**', style: '**', spaceBefore, spaceAfter: '', pos: i });
      i += 2;
      continue;
    }
    if (rest[0] === '^') {
      tokens.push({ type: 'POW', raw: '^', style: '^', spaceBefore, spaceAfter: '', pos: i });
      i += 1;
      continue;
    }

    // 4. Unicode superscripts (e.g. ², ⁻²)
    const supMatch = rest.match(/^[⁺⁻]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+/);
    if (supMatch) {
      const norm = supMatch[0]
        .split('')
        .map((c) => SUPERSCRIPT_MAP[c] ?? c)
        .join('');
      tokens.push({ type: 'POW', raw: supMatch[0], style: 'super', spaceBefore, spaceAfter: '', pos: i });
      tokens.push({ type: 'NUMBER', raw: norm, spaceBefore: '', pos: i });
      i += supMatch[0].length;
      continue;
    }

    // 5. Middle dot · or ⋅
    if (rest[0] === '·' || rest[0] === '⋅') {
      tokens.push({ type: 'MIDDOT', raw: rest[0], spaceBefore, pos: i });
      i += 1;
      continue;
    }

    // 6. Standard single-char operators & delimiters
    if (rest[0] === '+' || rest[0] === '-' || rest[0] === '−') {
      const val = rest[0] === '−' ? '-' : rest[0];
      tokens.push({ type: 'OP', value: val, spaceBefore, spaceAfter: '', pos: i });
      i += 1;
      continue;
    }
    if (rest[0] === '*' || rest[0] === '×') {
      tokens.push({ type: 'OP', value: '*', spaceBefore, spaceAfter: '', pos: i });
      i += 1;
      continue;
    }
    if (rest[0] === '/' || rest[0] === '÷') {
      tokens.push({ type: 'OP', value: '/', spaceBefore, spaceAfter: '', pos: i });
      i += 1;
      continue;
    }
    if (rest[0] === '(') {
      tokens.push({ type: 'LPAREN', spaceBefore, pos: i });
      i += 1;
      continue;
    }
    if (rest[0] === ')') {
      tokens.push({ type: 'RPAREN', spaceBefore, pos: i });
      i += 1;
      continue;
    }
    if (rest[0] === ',') {
      tokens.push({ type: 'COMMA', spaceBefore, pos: i });
      i += 1;
      continue;
    }
    if (rest[0] === '√') {
      tokens.push({ type: 'FUNC', name: 'sqrt', spaceBefore, pos: i });
      i += 1;
      continue;
    }
    if (rest[0] === '°') {
      const degDef = unitEngine.lookup('deg');
      if (!degDef) return null;
      tokens.push({ type: 'UNIT', unitDef: degDef, raw: '°', spaceBefore, pos: i });
      i += 1;
      continue;
    }

    // 7. Number literal (integer, decimal, leading-dot .1, scientific 1e-5)
    const numMatch = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/);
    if (numMatch) {
      const raw = numMatch[0];
      // Reject malformed double-dot like 1.2.3
      if (rest[raw.length] === '.') return null;
      tokens.push({ type: 'NUMBER', raw, spaceBefore, pos: i });
      i += raw.length;
      continue;
    }

    // 8. Identifiers (functions, constants, conversion 'to', units, inline unit powers)
    const idMatch = rest.match(/^[a-zA-ZµμΩπτφ]+/);
    if (idMatch) {
      const word = idMatch[0];
      const afterWord = rest.slice(word.length);

      // 8a. Multi-char functions with digits (log10, log2, atan2)
      const fnDigitMatch = rest.match(/^(log10|log2|atan2)(?![a-zA-Z0-9_])/i);
      if (fnDigitMatch) {
        tokens.push({
          type: 'FUNC',
          name: fnDigitMatch[1].toLowerCase(),
          spaceBefore,
          pos: i,
        });
        i += fnDigitMatch[1].length;
        continue;
      }

      // 8b. Conversion keyword 'to'
      if (word.toLowerCase() === 'to' && !/^[0-9_]/.test(afterWord)) {
        tokens.push({ type: 'CONVERT', raw: word, spaceBefore, spaceAfter: '', pos: i });
        i += word.length;
        continue;
      }

      // 8c. Pure function name (not glued to trailing digits unless space/paren — wait: sin30? No, Ex #15 is `sin 30`, while `text1` is unknown!)
      const lowWord = word.toLowerCase();
      if (FUNCTIONS.has(lowWord) && !/^[0-9_]/.test(afterWord)) {
        tokens.push({ type: 'FUNC', name: lowWord, spaceBefore, pos: i });
        i += word.length;
        continue;
      }

      // 8d. Mathematical constants (pi, e, tau, phi)
      if (CONSTANTS.has(word) && !/^[0-9_]/.test(afterWord)) {
        tokens.push({ type: 'CONST', name: word, spaceBefore, pos: i });
        i += word.length;
        continue;
      }

      // 8e. Known Unit (with optional inline integer exponent like kg2, m2, s-2)
      const unitDef = unitEngine.lookup(word);
      if (unitDef) {
        const inlineExpMatch = afterWord.match(/^([-+]?\d+)(?![.\d]|[a-zA-ZµμΩ°_])/);
        if (inlineExpMatch) {
          const hasPriorQuantityToken = tokens.some(
            (t) => t.type === 'NUMBER' || t.type === 'UNIT' || t.type === 'CONVERT'
          );
          // Allow multi-letter units (kg2, cm2, ft2) anywhere, or single-letter units (m2, s-2) after number/unit/convert
          if (word.length >= 2 || hasPriorQuantityToken) {
            tokens.push({ type: 'UNIT', unitDef, raw: word, spaceBefore, pos: i });
            tokens.push({ type: 'POW', raw: '', style: 'inline', spaceBefore: '', spaceAfter: '', pos: i + word.length });
            tokens.push({ type: 'NUMBER', raw: inlineExpMatch[1], spaceBefore: '', pos: i + word.length });
            i += word.length + inlineExpMatch[1].length;
            continue;
          }
        }

        if (!/^[0-9_]/.test(afterWord)) {
          tokens.push({ type: 'UNIT', unitDef, raw: word, spaceBefore, pos: i });
          i += word.length;
          continue;
        }
      }

      // Unknown identifier (e.g. `text1`, `other`, `var`) -> invalid math expression
      return null;
    }

    // Any unrecognized character
    return null;
  }

  attachTrailingSpaceToPrevOp(pendingSpace);
  return tokens;
}

/**
 * Quantity representation during evaluation:
 * {
 *   val: Decimal,      // Value in SI base units (or pure number; radians if isAngle)
 *   dims: number[7],   // [m, kg, s, A, K, mol, cd]
 *   isAngle: boolean,  // Explicit rad/deg tag
 *   pureUnit: boolean, // True if built solely from unit tokens without numeric scalar
 * }
 */
function makeNumber(d) {
  return { val: d, dims: zeroDims(), isAngle: false, pureUnit: false };
}

function isPureDimensionless(q) {
  return isDimensionless(q.dims) && !q.isAngle;
}

function gcdBig(a, b) {
  let x = a.abs().floor();
  let y = b.abs().floor();
  while (!y.isZero()) {
    const t = x.mod(y);
    x = y;
    y = t;
  }
  return x;
}

/**
 * Evaluates a tokenized math/unit expression under a specified `angleMode` ('rad' | 'deg')
 * and `precision` (Decimal significant digits).
 */
export function evaluateTokens(tokens, { unitEngine, angleMode = 'rad', precision = 80, silent = false } = {}) {
  if (!tokens || tokens.length === 0) return null;

  const D = Decimal.clone({
    precision: Math.max(60, precision),
    toExpNeg: -1000000,
    toExpPos: 1000000,
  });
  const getPi = () => getPiDecimal(Math.max(80, precision + 16));

  let pos = 0;
  let usedAngleMode = false;
  let hasWork = false; // operator, function, conversion, or unit composition
  let unitTokenCount = 0;
  let expStyle = null;
  let hadUnitSpace = null;
  let usedVolumetric = false;
  let hintUnit = null;
  let lastTopOpSpaceAfter = '';
  let topAddSubMajor = null;

  const peek = () => tokens[pos] || null;
  const consume = () => tokens[pos++];

  function evalFunction(name, args) {
    hasWork = true;
    const pi = getPi();

    if (name === 'min' || name === 'max') {
      if (args.length < 1) throw new Error('Empty min/max');
      const first = args[0];
      for (let k = 1; k < args.length; k++) {
        if (!dimsEqual(first.dims, args[k].dims) || first.isAngle !== args[k].isAngle) {
          throw new Error('Incompatible dimensions in min/max');
        }
      }
      let best = first.val;
      for (let k = 1; k < args.length; k++) {
        if (name === 'min' ? args[k].val.lt(best) : args[k].val.gt(best)) {
          best = args[k].val;
        }
      }
      return { val: best, dims: [...first.dims], isAngle: first.isAngle, pureUnit: false };
    }

    if (name === 'atan2') {
      if (args.length !== 2) throw new Error('atan2 expects 2 arguments');
      if (!dimsEqual(args[0].dims, args[1].dims)) throw new Error('atan2 dimension mismatch');
      const radRes = D.atan2(args[0].val, args[1].val);
      usedAngleMode = true;
      const outVal = angleMode === 'deg' ? radRes.mul(180).div(pi) : radRes;
      return makeNumber(outVal);
    }

    if (name === 'gcd' || name === 'lcm') {
      if (args.length !== 2 || !isPureDimensionless(args[0]) || !isPureDimensionless(args[1])) {
        throw new Error('gcd/lcm require 2 numbers');
      }
      const g = gcdBig(args[0].val, args[1].val);
      if (name === 'gcd') return makeNumber(g);
      if (g.isZero()) return makeNumber(new D(0));
      return makeNumber(args[0].val.abs().floor().mul(args[1].val.abs().floor()).div(g));
    }

    if (name === 'mod') {
      if (args.length !== 2 || !isPureDimensionless(args[0]) || !isPureDimensionless(args[1])) {
        throw new Error('mod requires 2 numbers');
      }
      return makeNumber(args[0].val.mod(args[1].val));
    }

    if (name === 'log' && args.length === 2) {
      if (!isPureDimensionless(args[0]) || !isPureDimensionless(args[1])) throw new Error('Dimensioned log');
      if (args[0].val.lte(0) || args[1].val.lte(0) || args[1].val.eq(1)) throw new Error('Log domain');
      return makeNumber(args[0].val.ln().div(args[1].val.ln()));
    }

    if (args.length !== 1) throw new Error(`${name} expects 1 argument`);
    const arg = args[0];

    // Roots can operate on compatible even/triple unit exponents!
    if (name === 'sqrt' || name === 'cbrt') {
      const root = name === 'sqrt' ? 2 : 3;
      if (name === 'sqrt' && arg.val.lt(0)) throw new Error('sqrt of negative');
      for (let d = 0; d < 7; d++) {
        if (arg.dims[d] % root !== 0) throw new Error('Fractional unit dimension in root');
      }
      const nextDims = arg.dims.map((e) => e / root);
      const nextVal = name === 'sqrt' ? arg.val.sqrt() : arg.val.cbrt();
      return { val: nextVal, dims: nextDims, isAngle: false, pureUnit: false };
    }

    if (name === 'abs') {
      return { val: arg.val.abs(), dims: [...arg.dims], isAngle: arg.isAngle, pureUnit: false };
    }

    // Trig functions (accept dimensionless OR explicit angle!)
    if (['sin', 'cos', 'tan', 'sec', 'csc', 'cot'].includes(name)) {
      if (!isDimensionless(arg.dims)) throw new Error('Trig argument must be angle or dimensionless');

      let radVal;
      let degExact = null;

      if (arg.isAngle) {
        // Explicit rad or deg was provided (e.g. `30 deg` or `30 rad`) -> independent of global angleMode!
        radVal = arg.val;
        degExact = radVal.mul(180).div(pi);
      } else {
        usedAngleMode = true;
        if (angleMode === 'deg') {
          degExact = arg.val;
          radVal = arg.val.mul(pi).div(180);
        } else {
          radVal = arg.val;
        }
      }

      // Exact special-angle handling in degrees so sin(30 deg) === exact 0.5, cos(90 deg) === exact 0, tan(90 deg) === undefined
      if (degExact !== null) {
        const mod360 = degExact.mod(360).plus(360).mod(360);
        const snapEps = new D(10).pow(-Math.max(30, precision - 16));
        const nearInt = mod360.round();
        if (mod360.minus(nearInt).abs().lt(snapEps)) {
          const degInt = nearInt.toNumber() % 360;
          if (name === 'sin') {
            if (degInt === 0 || degInt === 180) return makeNumber(new D(0));
            if (degInt === 30 || degInt === 150) return makeNumber(new D('0.5'));
            if (degInt === 90) return makeNumber(new D(1));
            if (degInt === 210 || degInt === 330) return makeNumber(new D('-0.5'));
            if (degInt === 270) return makeNumber(new D(-1));
          } else if (name === 'cos') {
            if (degInt === 90 || degInt === 270) return makeNumber(new D(0));
            if (degInt === 60 || degInt === 300) return makeNumber(new D('0.5'));
            if (degInt === 0) return makeNumber(new D(1));
            if (degInt === 120 || degInt === 240) return makeNumber(new D('-0.5'));
            if (degInt === 180) return makeNumber(new D(-1));
          } else if (name === 'tan') {
            if (degInt === 90 || degInt === 270) throw new Error('tan undefined at 90/270 deg');
            if (degInt === 0 || degInt === 180) return makeNumber(new D(0));
            if (degInt === 45 || degInt === 225) return makeNumber(new D(1));
            if (degInt === 135 || degInt === 315) return makeNumber(new D(-1));
          }
        }
      }

      const useSeries = precision > 980;
      const sinV = () => (useSeries ? sinHighPrec(radVal, D, precision) : radVal.sin());
      const cosV = () => (useSeries ? cosHighPrec(radVal, D, precision) : radVal.cos());

      const zeroSnap = new D(10).pow(-(Math.max(60, precision) - 8));
      const snapZero = (v) => (!radVal.isZero() && radVal.abs().gte('0.1') && v.abs().lt(zeroSnap) ? new D(0) : v);

      if (name === 'sin') return makeNumber(snapZero(sinV()));
      if (name === 'cos') return makeNumber(snapZero(cosV()));
      if (name === 'tan') {
        const c = snapZero(cosV());
        if (c.isZero()) throw new Error('tan pole');
        return makeNumber(snapZero(sinV()).div(c));
      }
      if (name === 'sec') {
        const c = snapZero(cosV());
        if (c.isZero()) throw new Error('sec pole');
        return makeNumber(new D(1).div(c));
      }
      if (name === 'csc') {
        const s = snapZero(sinV());
        if (s.isZero()) throw new Error('csc pole');
        return makeNumber(new D(1).div(s));
      }
      if (name === 'cot') {
        const s = snapZero(sinV());
        if (s.isZero()) throw new Error('cot pole');
        return makeNumber(snapZero(cosV()).div(s));
      }
    }

    // All remaining functions require pure dimensionless numbers
    if (!isPureDimensionless(arg)) throw new Error(`${name} requires dimensionless argument`);
    const v = arg.val;

    if (name === 'asin' || name === 'arcsin') {
      if (v.abs().gt(1)) throw new Error('asin domain');
      usedAngleMode = true;
      const r = v.asin();
      return makeNumber(angleMode === 'deg' ? r.mul(180).div(pi) : r);
    }
    if (name === 'acos' || name === 'arccos') {
      if (v.abs().gt(1)) throw new Error('acos domain');
      usedAngleMode = true;
      const r = v.acos();
      return makeNumber(angleMode === 'deg' ? r.mul(180).div(pi) : r);
    }
    if (name === 'atan' || name === 'arctan') {
      usedAngleMode = true;
      const r = v.atan();
      return makeNumber(angleMode === 'deg' ? r.mul(180).div(pi) : r);
    }
    if (name === 'sinh') return makeNumber(v.sinh());
    if (name === 'cosh') return makeNumber(v.cosh());
    if (name === 'tanh') return makeNumber(v.tanh());
    if (name === 'asinh') return makeNumber(v.asinh());
    if (name === 'acosh') {
      if (v.lt(1)) throw new Error('acosh domain');
      return makeNumber(v.acosh());
    }
    if (name === 'atanh') {
      if (v.abs().gte(1)) throw new Error('atanh domain');
      return makeNumber(v.atanh());
    }
    if (name === 'exp') return makeNumber(v.exp());
    if (name === 'ln') {
      if (v.lte(0)) throw new Error('ln domain');
      return makeNumber(v.ln());
    }
    if (name === 'log' || name === 'log10') {
      if (v.lte(0)) throw new Error('log10 domain');
      return makeNumber(D.log10(v));
    }
    if (name === 'log2') {
      if (v.lte(0)) throw new Error('log2 domain');
      return makeNumber(D.log2(v));
    }
    if (name === 'floor') return makeNumber(v.floor());
    if (name === 'ceil') return makeNumber(v.ceil());
    if (name === 'round') return makeNumber(v.round());
    if (name === 'sign') return makeNumber(new D(Decimal.sign(v)));

    throw new Error(`Unknown function ${name}`);
  }

  // Level 1: Primary (Number, Constant, Unit, Parenthesized, Function(args))
  function parsePrimary() {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end of expression');

    if (tok.type === 'NUMBER') {
      consume();
      return makeNumber(new D(tok.raw));
    }

    if (tok.type === 'CONST') {
      consume();
      const pi = getPi();
      const low = tok.name.toLowerCase();
      if (low === 'pi' || tok.name === 'π') return { ...makeNumber(pi), isConst: 'pi' };
      if (low === 'tau' || tok.name === 'τ') return { ...makeNumber(pi.mul(2)), isConst: 'tau' };
      if (tok.name === 'e') return { ...makeNumber(new D(1).exp()), isConst: 'e' };
      if (low === 'phi' || tok.name === 'φ') {
        return { ...makeNumber(new D(1).plus(D.sqrt(5)).div(2)), isConst: 'phi' };
      }
    }

    if (tok.type === 'UNIT') {
      consume();
      unitTokenCount++;
      if (hadUnitSpace === null && pos >= 2) {
        const prevTok = tokens[pos - 2];
        if (prevTok && prevTok.type === 'NUMBER') {
          hadUnitSpace = tok.spaceBefore.length > 0;
        }
      }
      if (tok.unitDef.volumetric) usedVolumetric = true;
      if (!hintUnit && !tok.unitDef.isAngle) hintUnit = tok.unitDef;

      const coeff = unitEngine.getUnitCoeff(tok.unitDef, D, getPi);
      return {
        val: coeff,
        dims: [...tok.unitDef.exponents],
        isAngle: tok.unitDef.isAngle,
        pureUnit: true,
      };
    }

    if (tok.type === 'LPAREN') {
      consume();
      const inner = parseAddSub(false);
      const close = peek();
      if (!close || close.type !== 'RPAREN') throw new Error('Unclosed parenthesis');
      consume();
      return { ...inner, pureUnit: false };
    }

    if (tok.type === 'FUNC') {
      consume();
      // Parenthesized call: fn(arg1, arg2, ...)
      if (peek() && peek().type === 'LPAREN') {
        consume();
        const args = [];
        if (!peek() || peek().type === 'RPAREN') throw new Error('Empty function arguments');
        args.push(parseAddSub(false));
        while (peek() && peek().type === 'COMMA') {
          consume();
          args.push(parseAddSub(false));
        }
        if (!peek() || peek().type !== 'RPAREN') throw new Error('Missing ) after function args');
        consume();
        return evalFunction(tok.name, args);
      }
      // Paren-less prefix call: sin 30, sqrt 2, sin 30 deg
      const arg = parseUnaryOrPrefixFunc();
      return evalFunction(tok.name, [arg]);
    }

    throw new Error(`Unexpected token ${tok.type}`);
  }

  // Level 2: Exponentiation (**, ^, superscripts, inline unit powers) — right-associative, supports unary +/- in exponent
  function parsePower() {
    let base = parsePrimary();
    if (peek() && peek().type === 'POW') {
      const powTok = consume();
      hasWork = true;
      if (base.pureUnit && !expStyle) {
        expStyle = powTok.style || '**';
      } else if (!expStyle && powTok.style === 'inline') {
        expStyle = 'inline';
      }

      let expVal = parsePowerSignedExponent();
      if (!isPureDimensionless(expVal)) {
        throw new Error('Exponent must be dimensionless');
      }

      if (!isDimensionless(base.dims)) {
        const expNum = expVal.val.toNumber();
        if (!Number.isInteger(expNum) || Math.abs(expNum) > 64) {
          throw new Error('Unit exponent must be an integer');
        }
        return {
          val: base.val.pow(expNum),
          dims: scaleDims(base.dims, expNum),
          isAngle: false,
          pureUnit: base.pureUnit,
        };
      }

      // Numeric power (supports massive integer exponents like 10**2000 and negative 10**-2000!)
      if (base.val.lt(0) && !expVal.val.isInteger()) {
        throw new Error('Negative base with fractional exponent');
      }
      if (base.val.isZero() && expVal.val.lt(0)) {
        throw new Error('Division by zero in negative power');
      }
      const nextVal = expVal.val.isInteger() ? base.val.pow(expVal.val) : D.pow(base.val, expVal.val);
      return makeNumber(nextVal);
    }
    return base;
  }

  function parsePowerSignedExponent() {
    if (peek() && peek().type === 'OP' && (peek().value === '+' || peek().value === '-')) {
      const signTok = consume();
      const rhs = parsePowerSignedExponent();
      return {
        ...rhs,
        val: signTok.value === '-' ? rhs.val.neg() : rhs.val,
      };
    }
    return parsePower();
  }

  // Level 3: Tight Unit Attachment (`2m**2`, `10**-6 kg`, `1 kg m2 s-2`, `kg·m²`)
  function parseUnitAttachment() {
    let left = parsePower();

    while (peek()) {
      const next = peek();
      if (next.type === 'MIDDOT') {
        consume();
        hasWork = true;
        const right = parsePower();
        left = multiplyQuantities(left, right, left.pureUnit && right.pureUnit);
        continue;
      }
      if (next.type === 'UNIT') {
        if (hadUnitSpace === null && !left.pureUnit) {
          hadUnitSpace = next.spaceBefore.length > 0;
        }
        if (left.pureUnit) hasWork = true;
        const rightUnit = parsePower();
        left = multiplyQuantities(left, rightUnit, left.pureUnit && rightUnit.pureUnit);
        continue;
      }
      break;
    }

    return left;
  }

  // Level 4: Prefix Unary +/- and Paren-less Function Calls
  function parseUnaryOrPrefixFunc() {
    const tok = peek();
    if (tok && tok.type === 'OP' && (tok.value === '+' || tok.value === '-')) {
      consume();
      const operand = parseUnaryOrPrefixFunc();
      return {
        val: tok.value === '-' ? operand.val.neg() : operand.val,
        dims: operand.dims,
        isAngle: operand.isAngle,
        pureUnit: false,
      };
    }
    return parseUnitAttachment();
  }

  function multiplyQuantities(a, b, pureUnit = false) {
    return {
      val: a.val.mul(b.val),
      dims: addDims(a.dims, b.dims),
      isAngle: (a.isAngle && isPureDimensionless(b)) || (b.isAngle && isPureDimensionless(a)),
      pureUnit,
    };
  }

  function divideQuantities(a, b, pureUnit = false) {
    if (b.val.isZero()) throw new Error('Division by zero');
    const nextDims = subDims(a.dims, b.dims);
    const sameAngle = a.isAngle && b.isAngle;
    return {
      val: a.val.div(b.val),
      dims: nextDims,
      isAngle: sameAngle ? false : a.isAngle && isPureDimensionless(b),
      pureUnit,
    };
  }

  // Check if next token starts an implicit multiplication (e.g. `2 pi`, `2(3+4)`, `(1+2)(3+4)`, `2 sin(30)`)
  // Note: NEVER implicitly multiply `Number Number` (e.g. "2024 2025")!
  function canImplicitMultiply(prevToken, nextToken) {
    if (!prevToken || !nextToken) return false;
    if (nextToken.type === 'LPAREN' || nextToken.type === 'CONST' || nextToken.type === 'FUNC') {
      return (
        prevToken.type === 'NUMBER' ||
        prevToken.type === 'CONST' ||
        prevToken.type === 'RPAREN' ||
        prevToken.type === 'UNIT'
      );
    }
    if (prevToken.type === 'RPAREN' && (nextToken.type === 'NUMBER' || nextToken.type === 'UNIT')) {
      return true;
    }
    return false;
  }

  // Level 5: Multiplication, Division, and Safe Implicit Multiplication
  function parseMulDiv(isTopLevel = false) {
    let left = parseUnaryOrPrefixFunc();

    while (peek()) {
      const next = peek();
      if (next.type === 'OP' && (next.value === '*' || next.value === '/')) {
        const opTok = consume();
        hasWork = true;
        if (isTopLevel) lastTopOpSpaceAfter = opTok.spaceAfter;
        const right = parseUnaryOrPrefixFunc();
        left =
          opTok.value === '*'
            ? multiplyQuantities(left, right, left.pureUnit && right.pureUnit)
            : divideQuantities(left, right, left.pureUnit && right.pureUnit);
        continue;
      }

      const prevTok = tokens[pos - 1];
      if (canImplicitMultiply(prevTok, next)) {
        hasWork = true;
        const right = parseUnaryOrPrefixFunc();
        left = multiplyQuantities(left, right, false);
        continue;
      }
      break;
    }

    return left;
  }

  // Level 6: Addition & Subtraction
  function parseAddSub(isTopLevel = false) {
    let left = parseMulDiv(isTopLevel);

    while (peek() && peek().type === 'OP' && (peek().value === '+' || peek().value === '-')) {
      const opTok = consume();
      hasWork = true;
      if (isTopLevel) lastTopOpSpaceAfter = opTok.spaceAfter;
      const right = parseMulDiv(isTopLevel);

      if (!dimsEqual(left.dims, right.dims) || left.isAngle !== right.isAngle) {
        throw new Error('Incompatible dimensions in addition/subtraction');
      }

      if (isTopLevel && !left.val.isZero() && !right.val.isZero()) {
        const signedRight = opTok.value === '-' ? right.val.neg() : right.val;
        topAddSubMajor = left.val.abs().gte(signedRight.abs()) ? left.val : signedRight;
      }

      left = {
        val: opTok.value === '+' ? left.val.plus(right.val) : left.val.minus(right.val),
        dims: [...left.dims],
        isAngle: left.isAngle,
        pureUnit: false,
      };
    }

    return left;
  }

  // Level 7 (Top): Optional explicit unit conversion (`<expr> to <unitExpr>` or `<expr> -> <unitExpr>`)
  try {
    const qty = parseAddSub(true);
    let targetUnitSpec = null;

    if (peek() && peek().type === 'CONVERT') {
      const convTok = consume();
      hasWork = true;
      lastTopOpSpaceAfter = convTok.spaceAfter;
      topAddSubMajor = null;

      const unitStartTokenIdx = pos;
      if (pos >= tokens.length) {
        // Incomplete explicit conversion (`1 km -> ` or `1 km to `)
        return {
          val: qty.val,
          dims: qty.dims,
          isAngle: qty.isAngle,
          hasUnits: !isDimensionless(qty.dims) || qty.isAngle,
          hasWork: true,
          incompleteConversion: true,
          convertToken: convTok,
          usedAngleMode,
          expStyle: expStyle || '**',
          hadUnitSpace: Boolean(hadUnitSpace),
          usedVolumetric,
          hintUnit,
          lastTopOpSpaceAfter,
          topAddSubMajor: null,
          D,
          getPi,
        };
      }

      const rhsUnit = parseMulDiv(false);
      if (pos !== tokens.length || !rhsUnit.pureUnit) {
        return null;
      }
      if (!dimsEqual(qty.dims, rhsUnit.dims) || qty.isAngle !== rhsUnit.isAngle) {
        return null;
      }

      const rawUnitTokens = tokens.slice(unitStartTokenIdx);
      const rawUnitSymbol = buildRawUnitString(rawUnitTokens, expStyle || '**');
      targetUnitSpec = {
        coeff: rhsUnit.val,
        dims: rhsUnit.dims,
        isAngle: rhsUnit.isAngle,
        symbol: rawUnitSymbol,
        startCharOffset: rawUnitTokens[0].pos,
      };
    }

    if (pos !== tokens.length) return null;
    if (!qty.val.isFinite()) return null;

    // Reject bare pure unit tokens with no number and no operator (e.g. typing word "m" or "in" in prose)
    if (qty.pureUnit && !hasWork) return null;

    return {
      val: qty.val,
      dims: qty.dims,
      isAngle: qty.isAngle,
      isConst: qty.isConst || null,
      hasUnits: !isDimensionless(qty.dims) || qty.isAngle,
      unitTokenCount,
      hasWork,
      incompleteConversion: false,
      targetUnitSpec,
      usedAngleMode,
      expStyle: expStyle || '**',
      hadUnitSpace: Boolean(hadUnitSpace),
      usedVolumetric,
      hintUnit,
      lastTopOpSpaceAfter,
      topAddSubMajor,
      D,
      getPi,
    };
  } catch (err) {
    if (!silent) {
      logger.log('eval-reject', err.message);
    }
    return null;
  }
}

function buildRawUnitString(unitTokens, defaultExpStyle) {
  if (unitTokens.length === 1 && unitTokens[0].type === 'UNIT') {
    return unitTokens[0].unitDef.symbol;
  }
  let out = '';
  for (let i = 0; i < unitTokens.length; i++) {
    const t = unitTokens[i];
    if (t.spaceBefore && i > 0) out += ' ';
    if (t.type === 'UNIT') out += t.unitDef.symbol;
    else if (t.type === 'POW') out += t.raw || (defaultExpStyle === 'inline' ? '' : '**');
    else if (t.type === 'NUMBER') out += t.raw;
    else if (t.type === 'OP') out += t.value;
    else if (t.type === 'MIDDOT') out += '·';
  }
  return out;
}

/**
 * Formats a Decimal value according to Section 3 rules:
 * - 4 significant digits by default (standard half-up rounding).
 * - Preserves small perturbation in A ± B up to 12 sig figs (e.g. pi + 0.000001 = 3.141593, while 1km + 1pm = 1km).
 * - Ordinary decimal notation by default; offers scientific notation alternative when |x| < 1e-4 or |x| > 1e4.
 * - Uses scientific notation exclusively when |x| < 1e-1000 or |x| > 1e1000.
 */
export function formatDecimalPreview(val, { majorAddend = null, sigFigs = 4 } = {}) {
  const DOrd = Decimal.clone({
    precision: Math.max(60, (val.d ? val.d.length * 7 : 60) + 20),
    toExpNeg: -1005,
    toExpPos: 1005,
  });

  const x = new DOrd(val.toString());
  if (x.isZero()) {
    return { primary: '0', scientificAlt: null };
  }

  const absX = x.abs();
  const extremeSciOnly = absX.lt('1e-1000') || absX.gt('1e1000');
  const offerSciAlt = !extremeSciOnly && (absX.lt('1e-4') || absX.gt('1e4'));

  const r4 = x.toSignificantDigits(sigFigs, Decimal.ROUND_HALF_UP);
  const sciStr = r4.toExponential().replace('e+', 'e');

  if (extremeSciOnly) {
    return { primary: sciStr, scientificAlt: null };
  }

  let ordStr = r4.toString();

  // Check small-perturbation addition rule (e.g. `pi + 0.000001 = "3.141593"`, whereas `1km + 1pm = "1km"`)
  if (majorAddend !== null && !majorAddend.isZero()) {
    const maj = new DOrd(majorAddend.toString());
    const majR4 = maj.toSignificantDigits(sigFigs, Decimal.ROUND_HALF_UP).toString();
    if (ordStr === majR4 && !x.eq(maj)) {
      const diff = x.minus(maj).abs();
      // Estimate significant digit position where x differs from majorAddend
      const expX = x.e;
      const expDiff = diff.e;
      const neededSig = expX - expDiff + 1;
      if (neededSig > sigFigs && neededSig <= 12) {
        const trunc = x.toSignificantDigits(neededSig, Decimal.ROUND_DOWN);
        ordStr = trunc.toString();
      }
    }
  }

  return {
    primary: ordStr,
    scientificAlt: offerSciAlt && sciStr !== ordStr ? sciStr : null,
  };
}

export function truncateDisplayPreview(str, maxLen = 24) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

function countSignificantDigitsInString(numStr) {
  const clean = numStr.replace(/^[-+]/, '');
  if (!clean.includes('.')) {
    const stripped = clean.replace(/^0+/, '');
    return Math.max(1, stripped.length);
  }
  const [intPart, fracPart] = clean.split('.');
  const allDigits = (intPart + fracPart).replace(/^0+/, '');
  return Math.max(1, allDigits.length);
}

/**
 * Builds the exact unrounded ordinary decimal prefix of `targetVal` containing `k` significant digits.
 */
function exactPrefixWithSigFigs(targetVal, k) {
  const sign = targetVal.isNeg() ? '-' : '';
  const absV = targetVal.abs();
  if (absV.isZero()) return '0';

  const exp = absV.e; // 3.14 -> 0, 0.707 -> -1, 123 -> 2
  const decimalPlaces = k - 1 - exp;

  const DLocal = Decimal.clone({
    precision: Math.max(80, k + Math.abs(exp) + 24),
    toExpNeg: -1000000,
    toExpPos: 1000000,
  });
  const v = new DLocal(absV.toString());

  if (decimalPlaces <= 0) {
    const trunc = v.toSignificantDigits(k, Decimal.ROUND_DOWN);
    return sign + trunc.toFixed(0);
  }

  const trunc = v.toDecimalPlaces(decimalPlaces, Decimal.ROUND_DOWN);
  return sign + trunc.toFixed(decimalPlaces);
}

/**
 * Computes targeted precision continuation when the user has already typed `<rhsTyped>` after `=`.
 * Supports:
 * - Replacing a rounded trailing digit (`pi=3.142` -> deleteBefore: 1, insertText: "15")
 * - Appending next exact digit (`pi=3.1415` -> "9", `1/sqrt 2=0.7` -> "0", `1/sqrt 2=0.70` -> "7")
 * - Continuing arbitrarily past 1,000+ digits (`pi=3.14159...1989` -> "3", `sqrt 2=1.41421...8472` -> "0")
 */
export function solvePrecisionContinuation(targetVal, rhsTyped) {
  if (!rhsTyped || !/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(rhsTyped)) return null;

  const sign = targetVal.isNeg() ? '-' : '';
  if (sign === '-' && !rhsTyped.startsWith('-')) return null;
  if (sign === '' && rhsTyped.startsWith('-')) return null;

  const digitCount = rhsTyped.replace(/[-+.]/g, '').length;
  const workPrec = Math.max(100, digitCount + 40);
  const DLocal = Decimal.clone({
    precision: workPrec,
    toExpNeg: -1000000,
    toExpPos: 1000000,
  });

  const exactTarget = new DLocal(targetVal.toString());
  const typedDec = new DLocal(rhsTyped);

  // If the number is already exact (e.g. `1+1=2` or `sin(30 deg)=0.5`), no further digits exist!
  if (typedDec.eq(exactTarget)) {
    return null;
  }

  // Generate unrounded fixed-point string with plenty of digits past rhsTyped
  const fracTypedLen = rhsTyped.includes('.') ? rhsTyped.split('.')[1].length : 0;
  const fracNeeded = Math.max(24, fracTypedLen + 12, -exactTarget.e + 12);
  const absTrunc = exactTarget.abs().toDecimalPlaces(fracNeeded, Decimal.ROUND_DOWN);
  let exactFull = sign + absTrunc.toFixed(fracNeeded);

  // If exactTarget actually terminates within fracNeeded places (e.g. 1/8 = 0.125), trim trailing zeros
  if (absTrunc.eq(exactTarget.abs())) {
    exactFull = exactFull.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
  }

  // Case 1: rhsTyped is already an exact prefix of exactFull!
  if (exactFull.startsWith(rhsTyped) && exactFull.length > rhsTyped.length) {
    const nextChar = exactFull[rhsTyped.length];
    // If next character is '.', include '.' + first fractional digit (e.g. `pi=3` -> `.1`)
    if (nextChar === '.' && exactFull.length > rhsTyped.length + 1) {
      return {
        deleteBefore: 0,
        insertText: exactFull.slice(rhsTyped.length, rhsTyped.length + 2),
      };
    }
    return {
      deleteBefore: 0,
      insertText: nextChar,
    };
  }

  // Case 2: rhsTyped was rounded (e.g. `pi=3.142` or `1/7=0.1429`!)
  const kTyped = countSignificantDigitsInString(rhsTyped);
  const candidateKs = kTyped === 4 ? [4] : [kTyped, 4];

  for (const k of candidateKs) {
    const roundedK = exactTarget
      .toSignificantDigits(k, Decimal.ROUND_HALF_UP)
      .toString();
    if (rhsTyped === roundedK) {
      const nextExactPrefix = exactPrefixWithSigFigs(exactTarget, k + 1);
      // Compute longest common prefix between rhsTyped and nextExactPrefix
      let lcp = 0;
      const minLen = Math.min(rhsTyped.length, nextExactPrefix.length);
      while (lcp < minLen && rhsTyped[lcp] === nextExactPrefix[lcp]) {
        lcp++;
      }
      const deleteBefore = rhsTyped.length - lcp;
      const insertText = nextExactPrefix.slice(lcp);
      if (insertText.length > 0) {
        return { deleteBefore, insertText };
      }
    }
  }

  return null;
}
