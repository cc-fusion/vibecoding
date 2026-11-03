import Decimal from 'decimal.js';
import { quantity, zeroDimension, combineDimensions, sameDimension, isDimensionless, matchUnit, readExponent, formatUnit, simplifyUnit } from './units.js';

export const BaseDecimal = Decimal.clone({ precision: 60, rounding: 4, maxE: 10000000, minE: -10000000 });
const piCache = new Map();

function bigintSqrt(n) {
  if (n < 2n) return n;
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
  while (true) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

// Chudnovsky's binary-splitting series, evaluated with exact integer ratios.
export function highPrecisionPi(precision, C = BaseDecimal) {
  const p = Math.min(12000, Math.max(40, Math.ceil(precision / 64) * 64));
  if (!piCache.has(p)) {
    const guard = 25;
    const scale = 10n ** BigInt(p + guard);
    const terms = Math.ceil((p + guard) / 14.181647462) + 2;
    function split(a, b) {
      if (b - a === 1) {
        let P, Q;
        if (a === 0) { P = 1n; Q = 1n; }
        else {
          const n = BigInt(a);
          P = (6n * n - 5n) * (2n * n - 1n) * (6n * n - 1n);
          Q = n * n * n * 10939058860032000n;
        }
        let T = P * (13591409n + 545140134n * BigInt(a));
        if (a & 1) T = -T;
        return { P, Q, T };
      }
      const m = Math.floor((a + b) / 2);
      const left = split(a, m), right = split(m, b);
      return { P: left.P * right.P, Q: left.Q * right.Q, T: left.T * right.Q + left.P * right.T };
    }
    const { Q, T } = split(0, terms);
    const numerator = Q * 426880n * bigintSqrt(10005n * scale * scale);
    const scaledPi = numerator / T;
    piCache.set(p, scaledPi.toString());
    if (piCache.size > 5) piCache.delete(piCache.keys().next().value);
  }
  const A = C.clone({ precision: Math.max(C.precision || 60, precision + 25), rounding: 4 });
  return new A(piCache.get(p)).div(new A(10).pow(p + 25)).toSignificantDigits(precision + 10);
}

function createMath(C, precision, metadata = {}) {
  const one = new C(1), zero = new C(0);
  const epsilon = () => new C(10).pow(-precision - 12);
  const pi = () => highPrecisionPi(precision + 20, C);
  const lnCache = new Map();
  function exp(x) {
    x = new C(x);
    if (x.isZero()) return one;
    if (x.abs().gt(1000000)) throw new Error('This exponential is too large to preview.');
    if (precision <= 80) return x.exp();
    const ln2 = ln(2);
    const n = x.div(ln2).round();
    const r = x.minus(n.mul(ln2));
    let term = one, sum = one;
    for (let k = 1; k < 10000; k++) {
      term = term.mul(r).div(k);
      sum = sum.plus(term);
      if (term.abs().lt(epsilon())) break;
    }
    return new C(2).pow(n).mul(sum);
  }
  function ln(value) {
    let x = new C(value);
    if (x.lte(0)) throw new Error('Logarithms require a positive number.');
    if (x.equals(one)) return zero;
    if (precision <= 80) return x.ln();
    const key = x.toSignificantDigits(precision + 10).toString();
    if (lnCache.has(key)) return lnCache.get(key);
    const exponent = x.equals(10) ? 0 : x.e;
    let y = x.div(new C(10).pow(exponent));
    let roots = 0;
    while (y.gt('1.1') || y.lt('0.9')) { y = y.sqrt(); roots++; }
    const z = y.minus(1).div(y.plus(1));
    let term = z, sum = z;
    for (let k = 1; k < 20000; k++) {
      term = term.mul(z).mul(z);
      const next = term.div(2 * k + 1);
      sum = sum.plus(next);
      if (next.abs().lt(epsilon())) break;
    }
    const result = sum.mul(2 ** (roots + 1)).plus(exponent ? new C(exponent).mul(ln(10)) : zero);
    lnCache.set(key, result);
    return result;
  }
  function atan(x) {
    x = new C(x);
    if (x.isNegative()) return atan(x.neg()).neg();
    if (x.gt(one)) return pi().div(2).minus(atan(one.div(x)));
    let reductions = 0;
    while (x.gt('0.08')) { x = x.div(one.plus(one.plus(x.mul(x)).sqrt())); reductions++; }
    let term = x, sum = x;
    for (let k = 1; k < 20000; k++) {
      term = term.mul(x).mul(x).neg();
      const next = term.div(2 * k + 1);
      sum = sum.plus(next);
      if (next.abs().lt(epsilon())) break;
    }
    return sum.mul(2 ** reductions);
  }
  function sin(x) {
    const period = pi().mul(2);
    if (x.abs().div(period).gt('1e12')) throw new Error('The angle is too large for a reliable preview.');
    x = x.minus(period.mul(x.div(period).round()));
    let term = x, sum = x;
    for (let k = 1; k < 10000; k++) {
      term = term.mul(x).mul(x).neg().div((2 * k) * (2 * k + 1));
      sum = sum.plus(term);
      if (term.abs().lt(epsilon())) break;
    }
    return sum.abs().lt(epsilon()) ? zero : sum;
  }
  function cos(x) { return sin(pi().div(2).minus(x)); }
  function trig(name, q, mode) {
    if (!isDimensionless(q.dimension)) throw new Error('Trigonometric arguments must be dimensionless angles.');
    let x = q.angle && q.angleValue !== undefined ? q.angleValue : q.value;
    const explicit = q.angle;
    if (!explicit) metadata.angleSensitive = true;
    const angleMode = explicit || mode;
    if (name === 'sin' || name === 'cos' || name === 'tan') {
      if (angleMode === 'deg') {
        const degrees = x.mod(360).plus(360).mod(360);
        if (name === 'sin' && degrees.equals(30)) return quantity('0.5');
        if (name === 'sin' && degrees.equals(150)) return quantity('0.5');
        if (name === 'cos' && degrees.equals(60)) return quantity('0.5');
        if (degrees.mod(90).isZero()) {
          const quadrant = degrees.div(90).toNumber();
          if (name === 'sin') return quantity([0, 1, 0, -1][quadrant]);
          if (name === 'cos') return quantity([1, 0, -1, 0][quadrant]);
          if (name === 'tan') {
            if (quadrant % 2) throw new Error('Tangent is undefined at this angle.');
            return quantity(0);
          }
        }
        x = x.mul(pi()).div(180);
      }
      if (name === 'sin') return quantity(sin(x));
      if (name === 'cos') return quantity(cos(x));
      const c = cos(x);
      if (c.abs().lt(epsilon())) throw new Error('Tangent is undefined at this angle.');
      return quantity(sin(x).div(c));
    }
    if (name === 'asin' || name === 'acos') {
      if (x.lt(-1) || x.gt(1)) throw new Error('This inverse trigonometric argument is outside [−1, 1].');
      let result;
      if (x.abs().equals(1)) result = pi().div(2).mul(x.s);
      else result = atan(x.div(one.minus(x.mul(x)).sqrt()));
      if (name === 'acos') result = pi().div(2).minus(result);
      return quantity(angleMode === 'deg' ? result.mul(180).div(pi()) : result);
    }
    const result = atan(x);
    return quantity(angleMode === 'deg' ? result.mul(180).div(pi()) : result);
  }
  return { exp, ln, atan, sin, cos, trig, pi };
}

const constants = new Set(['pi', 'π', 'e', 'tau', 'τ', 'phi']);
const functions = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'sqrt', 'cbrt', 'abs', 'ln', 'log', 'log2', 'log10', 'exp', 'round', 'floor', 'ceil', 'sign', 'min', 'max', 'hypot', 'atan2', 'mod', 'fact']);
const arity = { min: [1, 30], max: [1, 30], hypot: [1, 30], atan2: [2, 2], mod: [2, 2], log: [1, 2] };
const operatorNames = { '×': '*', '·': '*', '÷': '/', '−': '-', '–': '-', '√': 'sqrt' };

export function tokenizeMath(input, catalog) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (/\s/.test(char)) { i++; continue; }
    const start = i;
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(input.slice(i));
    if (number) {
      const text = number[0];
      if (text.replace(/\D/g, '').length > 12000) throw new Error('Number is too long.');
      i += text.length;
      // An attached unit belongs to the number atom: 1/2s means 1/(2 s),
      // while 1 kg m2 s-2 is a readable product of unit factors.
      const attached = matchUnit(input, i, catalog);
      if (attached) {
        const exponent = readExponent(input, attached.end);
        tokens.push({ kind: 'quantity', text: input.slice(start, exponent?.end ?? attached.end), number: text, unit: attached.unit, symbol: attached.symbol, exponent: exponent?.exponent ?? 1, syntax: exponent?.syntax || '**', start, end: exponent?.end ?? attached.end });
        i = exponent?.end ?? attached.end;
      } else tokens.push({ kind: 'number', text, start, end: i });
      continue;
    }
    if (input.startsWith('**', i)) { tokens.push({ kind: 'operator', text: '^', start, end: i += 2 }); continue; }
    if ('+-*/^!(),'.includes(char)) {
      tokens.push({ kind: char === '(' ? 'left' : char === ')' ? 'right' : char === ',' ? 'comma' : 'operator', text: char, start, end: ++i });
      continue;
    }
    const normalized = operatorNames[char];
    if (normalized) {
      tokens.push({ kind: normalized === 'sqrt' ? 'function' : 'operator', text: normalized, start, end: ++i });
      continue;
    }
    const namedFunction = /^(?:log2|log10|atan2)(?=\s|\(|$)/.exec(input.slice(i));
    if (namedFunction) {
      tokens.push({ kind: 'function', text: namedFunction[0], start, end: i += namedFunction[0].length });
      continue;
    }
    const identifier = /^[a-zA-ZµμΩ°π τ%]+/.exec(input.slice(i));
    const word = identifier?.[0].trim();
    if (word && (functions.has(word) || constants.has(word))) {
      tokens.push({ kind: functions.has(word) ? 'function' : 'constant', text: word, start, end: i += word.length });
      continue;
    }
    const match = matchUnit(input, i, catalog);
    if (match) {
      const exponent = readExponent(input, match.end);
      tokens.push({ kind: 'unit', text: input.slice(i, exponent?.end ?? match.end), unit: match.unit, symbol: match.symbol, exponent: exponent?.exponent ?? 1, syntax: exponent?.syntax || '**', start, end: exponent?.end ?? match.end });
      i = exponent?.end ?? match.end;
      continue;
    }
    if (word) {
      // Split a readable unit run such as kmh into known symbols only when unambiguous.
      throw new Error(`Unknown expression near “${word}”.`);
    }
    throw new Error(`Unsupported character “${char}”.`);
  }
  return tokens;
}

export function parseMath(input, catalog, options = {}) {
  const precision = Math.max(24, Math.min(12000, options.precision || 48));
  const C = Decimal.clone({ precision: precision + 24, rounding: 4, maxE: 10000000, minE: -10000000 });
  const metadata = { hasOperation: false, hasFunction: false, hasConstant: false, hasUnit: false, angleSensitive: false, operands: [], precision, angle: options.angle || 'rad' };
  const math = createMath(C, precision + 10, metadata);
  const tokens = tokenizeMath(input, catalog);
  if (!tokens.length || tokens.length > 600) throw new Error('No complete expression.');
  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];
  const expect = text => { if (peek()?.text !== text) throw new Error(`Expected “${text}”.`); return take(); };
  const q = (value, dimension = zeroDimension(), extra = {}) => quantity(new C(value), dimension, extra);
  const scalar = value => { if (!isDimensionless(value.dimension)) throw new Error('This function needs a dimensionless argument.'); return value.value; };
  const startsAtom = token => token && ['number', 'quantity', 'unit', 'constant', 'function', 'left'].includes(token.kind);
  function binary(op, a, b) {
    metadata.hasOperation = true;
    if (op === '+' || op === '-') {
      if (!sameDimension(a.dimension, b.dimension)) throw new Error('The quantities have incompatible dimensions.');
      const display = !isDimensionless(a.dimension) ? a.display : b.display;
      return q(op === '+' ? a.value.plus(b.value) : a.value.minus(b.value), a.dimension, { display, angle: a.angle || b.angle });
    }
    if (op === '*' || op === '/') {
      const dimension = combineDimensions(a.dimension, b.dimension, op === '*' ? 1 : -1);
      const value = op === '*' ? a.value.mul(b.value) : a.value.div(b.value);
      let display = !isDimensionless(a.dimension) ? a.display : !isDimensionless(b.dimension) ? b.display : null;
      if (display && !isDimensionless(a.dimension) && !isDimensionless(b.dimension)) {
        const factors = [...(display.factors || [])];
        for (const factor of b.display?.factors || [{ symbol: formatUnit(simplifyUnit(b.dimension, catalog)), exponent: 1, syntax: '**' }]) {
          const existing = factors.find(f => f.symbol === factor.symbol);
          if (existing) { existing.exponent += (op === '*' ? 1 : -1) * factor.exponent; existing.syntax = factor.syntax === 'adjacent' ? factor.syntax : existing.syntax; }
          else factors.push({ ...factor, exponent: factor.exponent * (op === '*' ? 1 : -1) });
        }
        display = { ...display, factors: factors.filter(f => f.exponent), compound: factors.filter(f => f.exponent).length > 1, gap: true };
      }
      const angle = isDimensionless(dimension) ? (a.angle || b.angle) : undefined;
      const angleValue = angle ? (a.angle ? a.angleValue?.mul(op === '*' ? b.value : new C(1).div(b.value)) : b.angleValue?.mul(a.value)) : undefined;
      return q(value, dimension, { display, angle, angleValue });
    }
    if (op === '%') return q(a.value.mod(scalar(b)), a.dimension, { display: a.display });
    if (op === '^') {
      const exponent = scalar(b);
      if (exponent.abs().gt(100000)) throw new Error('Exponent is too large to preview.');
      if (!exponent.isInteger() && !isDimensionless(a.dimension)) throw new Error('A quantity can only be raised to an integer power.');
      if (a.value.isZero() && exponent.lt(0)) throw new Error('Division by zero.');
      const value = exponent.isInteger() ? a.value.pow(exponent) : math.exp(exponent.mul(math.ln(a.value)));
      const dimension = Object.fromEntries(Object.entries(a.dimension).map(([key, n]) => [key, n * exponent.toNumber()]));
      let display = null;
      if (!isDimensionless(dimension) && a.display) {
        display = { ...a.display, factors: a.display.factors.map(f => ({ ...f, exponent: f.exponent * exponent.toNumber(), syntax: b.display?.syntax || f.syntax })) };
      }
      return q(value, dimension, { display });
    }
    throw new Error('Unknown operator.');
  }
  function expression() {
    let left = multiplication();
    while (peek()?.kind === 'operator' && ['+', '-'].includes(peek().text)) {
      const op = take().text;
      left = binary(op, left, multiplication());
    }
    return left;
  }
  function multiplication() {
    let left = unary();
    while (peek()) {
      const token = peek();
      if (token.kind === 'operator' && ['*', '/', '%'].includes(token.text)) {
        const op = take().text;
        left = binary(op, left, unary());
      } else if (startsAtom(token)) left = binary('*', left, unary());
      else break;
    }
    return left;
  }
  function unary() {
    if (peek()?.kind === 'operator' && ['+', '-'].includes(peek().text)) {
      const op = take().text;
      const value = unary();
      return op === '-' ? q(value.value.neg(), value.dimension, { display: value.display, angle: value.angle }) : value;
    }
    return power();
  }
  function power() {
    let value = atom();
    while (peek()?.kind === 'operator' && peek().text === '!') {
      take();
      const n = scalar(value);
      if (!n.isInteger() || n.lt(0) || n.gt(1000)) throw new Error('Factorial requires an integer from 0 to 1000.');
      let result = new C(1);
      for (let k = 2; k <= n.toNumber(); k++) result = result.mul(k);
      value = q(result);
      metadata.hasFunction = true;
    }
    if (peek()?.kind === 'operator' && peek().text === '^') {
      take();
      value = binary('^', value, unary());
    }
    return value;
  }
  function unitQuantity(token) {
    const unit = token.unit;
    const exponent = token.exponent;
    if (Math.abs(exponent) > 100) throw new Error('Unit exponent is too large.');
    const dimension = Object.fromEntries(Object.entries(unit.dimension).map(([key, n]) => [key, n * exponent]));
    const value = unit.factor.pow(exponent);
    if (unit.angle && exponent === 1) metadata.hasUnit = false;
    else metadata.hasUnit = true;
    return q(value, dimension, { display: { symbol: exponent === 1 ? token.symbol : null, factors: [{ symbol: token.symbol, exponent, syntax: token.syntax }], compound: false, gap: false }, angle: exponent === 1 ? unit.angle : undefined, angleValue: exponent === 1 && unit.angle ? new C(1) : undefined });
  }
  function atom() {
    const token = take();
    if (!token) throw new Error('The expression is incomplete.');
    if (token.kind === 'number') {
      const value = q(token.text);
      if (!value.value.isFinite()) throw new Error('This number is outside the preview range.');
      metadata.operands.push(value.value);
      return value;
    }
    if (token.kind === 'quantity') {
      metadata.operands.push(new C(token.number));
      const unit = unitQuantity(token);
      return q(unit.value.mul(token.number), unit.dimension, { display: unit.display, angle: unit.angle, angleValue: unit.angleValue?.mul(token.number) });
    }
    if (token.kind === 'unit') return unitQuantity(token);
    if (token.kind === 'constant') {
      metadata.hasConstant = true;
      const value = token.text === 'e' ? math.exp(1) : token.text === 'pi' || token.text === 'π' ? math.pi() : token.text === 'phi' ? new C(5).sqrt().plus(1).div(2) : math.pi().mul(2);
      metadata.operands.push(value);
      return q(value);
    }
    if (token.kind === 'left') {
      const value = expression();
      expect(')');
      return value;
    }
    if (token.kind === 'function') {
      metadata.hasFunction = true;
      const args = [];
      if (peek()?.kind === 'left') {
        take();
        if (peek()?.kind !== 'right') {
          args.push(expression());
          while (peek()?.kind === 'comma') { take(); args.push(expression()); }
        }
        expect(')');
      } else {
        let argument = unary();
        while (peek()?.kind === 'unit') argument = binary('*', argument, unitQuantity(take()));
        args.push(argument);
      }
      const name = token.text;
      const [minimum, maximum] = arity[name] || [1, 1];
      if (args.length < minimum || args.length > maximum) throw new Error(`Incorrect number of arguments for ${name}.`);
      const a = args[0], x = a.value;
      if (['sin', 'cos', 'tan', 'asin', 'acos', 'atan'].includes(name)) return math.trig(name, a, metadata.angle);
      if (name === 'sqrt' || name === 'cbrt') {
        if (name === 'sqrt' && x.lt(0)) throw new Error('Square root requires a non-negative number.');
        const root = name === 'sqrt' ? x.sqrt() : x.cbrt();
        const dimension = Object.fromEntries(Object.entries(a.dimension).map(([key, n]) => [key, n / (name === 'sqrt' ? 2 : 3)]));
        if (Object.values(dimension).some(n => !Number.isInteger(n))) throw new Error('This root has fractional unit dimensions.');
        return q(root, dimension, { display: a.display });
      }
      if (['abs', 'round', 'floor', 'ceil', 'sign'].includes(name)) return q(x[name](), a.dimension, { display: a.display });
      if (name === 'exp') return q(math.exp(scalar(a)));
      if (name === 'ln') return q(math.ln(scalar(a)));
      if (name === 'log10' || name === 'log2') return q(math.ln(scalar(a)).div(math.ln(name === 'log10' ? 10 : 2)));
      if (name === 'log') return args.length === 2 ? q(math.ln(scalar(args[1])).div(math.ln(scalar(a)))) : q(math.ln(scalar(a)).div(math.ln(10)));
      if (name === 'sinh' || name === 'cosh' || name === 'tanh') {
        const ex = math.exp(scalar(a)), inverse = new C(1).div(ex);
        return q(name === 'sinh' ? ex.minus(inverse).div(2) : name === 'cosh' ? ex.plus(inverse).div(2) : ex.minus(inverse).div(ex.plus(inverse)));
      }
      if (name === 'min' || name === 'max' || name === 'hypot') {
        if (!args.every(arg => sameDimension(arg.dimension, a.dimension))) throw new Error('Arguments must have compatible units.');
        if (name === 'hypot') return q(C.hypot(...args.map(arg => scalar(arg))), a.dimension, { display: a.display });
        const chosen = args.reduce((best, arg) => arg.value[name](best.value).equals(arg.value) ? arg : best);
        return q(chosen.value, a.dimension, { display: chosen.display });
      }
      if (name === 'atan2') return math.trig('atan', q(scalar(a).div(scalar(args[1]))), metadata.angle);
      if (name === 'mod') return q(x.mod(scalar(args[1])), a.dimension, { display: a.display });
      if (name === 'fact') {
        if (!x.isInteger() || x.lt(0) || x.gt(1000)) throw new Error('Factorial requires an integer from 0 to 1000.');
        let result = new C(1);
        for (let k = 2; k <= x.toNumber(); k++) result = result.mul(k);
        return q(result);
      }
    }
    throw new Error('The expression is incomplete.');
  }
  const value = expression();
  if (index !== tokens.length) throw new Error('Unexpected end of expression.');
  if (!value.value.isFinite()) throw new Error('The result is not finite.');
  return { value, ...metadata, Decimal: C };
}

export function formatNumber(value, significantDigits = 4, notation = 'decimal') {
  const C = Decimal.clone({ precision: Math.max(40, significantDigits + 10), rounding: 4, maxE: 10000000, minE: -10000000 });
  const number = new C(value).toSignificantDigits(significantDigits, 4);
  if (number.isZero()) return '0';
  if (notation === 'scientific' || number.e > 1000 || number.e < -1000) {
    let [mantissa, exponent] = number.toExponential(significantDigits - 1).split('e');
    if (mantissa.includes('.')) mantissa = mantissa.replace(/0+$/, '').replace(/\.$/, '');
    return mantissa + 'e' + exponent;
  }
  let result = number.toFixed();
  if (result.includes('.')) result = result.replace(/0+$/, '').replace(/\.$/, '');
  return result;
}

export function significantDigits(text) {
  const [mantissa] = text.toLowerCase().split('e');
  const digits = mantissa.replace(/[^0-9]/g, '').replace(/^0+/, '');
  return digits.length || 1;
}

export function truncatedNumber(value, significantDigits) {
  const C = Decimal.clone({ precision: Math.max(40, significantDigits + 10), rounding: 1 });
  const number = new C(value).toSignificantDigits(significantDigits, 1);
  if (number.e > 5000 || number.e < -5000) return number.toExponential(significantDigits - 1);
  return number.toFixed(Math.max(0, significantDigits - 1 - number.e));
}
