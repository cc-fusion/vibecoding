import { parseMath, formatNumber, significantDigits, truncatedNumber, BaseDecimal as D } from './math.js';
import { compileUnits, normalizeQuantity, alternativeQuantity, convertQuantity, unitOptions, formatUnit, isDimensionless, simplifyUnit } from './units.js';

const truncate = (text, length = 72) => text.length > length ? text.slice(0, length - 3) + '...' : text;
const numberPattern = '-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
const partialNumberPattern = '-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d*)?';

function coefficient(q, catalog) {
  if (!q.display?.factors?.length) return q.value;
  let factor = new D(1);
  for (const part of q.display.factors) {
    const unit = catalog.units[catalog.aliases[part.symbol]];
    if (!unit) return q.value;
    factor = factor.mul(unit.factor.pow(part.exponent));
  }
  return q.value.div(factor);
}

export function formatQuantity(q, catalog, precision = 4, notation = 'decimal', truncateDigits = false) {
  const normalized = normalizeQuantity(q, catalog, 'metric', true);
  const value = coefficient(normalized, catalog);
  const number = formatNumber(value, precision, notation);
  const display = isDimensionless(q.dimension) ? null : normalized.display;
  const unit = formatUnit(display);
  const gap = unit && display?.gap ? ' ' : '';
  const finalNumber = truncateDigits && precision > 4 && notation !== 'scientific' ? formatNumber(new D(value).toSignificantDigits(precision, 1), precision, notation) : number;
  return { text: finalNumber + gap + unit, number: finalNumber, unit, value, display };
}

function adaptivePrecision(parsed, q, catalog) {
  const value = coefficient(q, catalog).abs();
  if (value.isZero()) return 4;
  const nearby = parsed.operands.filter(operand => operand.isFinite() && !operand.minus(parsed.value.value).abs().equals(0));
  if (!nearby.length || (!parsed.hasConstant && !parsed.hasFunction)) return 4;
  for (let precision = 4; precision <= 24; precision++) {
    const rounded = formatNumber(value, precision);
    if (nearby.every(operand => !new D(rounded).equals(operand.toSignificantDigits(precision)))) return precision;
  }
  return 24;
}

function equationSpacing(expression) {
  let depth = 0;
  let spacing = '';
  for (let i = 0; i < expression.length; i++) {
    const char = expression[i];
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (depth === 0 && '+-*/^'.includes(char) && i > 0) {
      let left = 0, right = 0;
      for (let j = i - 1; j >= 0 && expression[j] === ' '; j--) left++;
      for (let j = i + 1; j < expression.length && expression[j] === ' '; j++) right++;
      if (left && right) spacing = ' '.repeat(Math.min(left, right));
    }
  }
  return /\s$/.test(expression) ? '' : spacing;
}

function findConversion(expression) {
  const match = /(?:->|→|\bto\b)\s*([^=]*)$/i.exec(expression);
  if (!match) return { source: expression, target: '', hasConversion: false };
  return { source: expression.slice(0, match.index).trimEnd(), target: match[1].trim(), hasConversion: true };
}

function startsFor(text) {
  const starts = [];
  for (let i = 0; i < text.length; i++) {
    if (!/[a-zA-Z0-9.+\-(√πµμΩ°]/.test(text[i])) continue;
    const previous = text[i - 1];
    if (previous && /[a-zA-Z0-9_]/.test(previous)) {
      if (!(text[i] === '.' && /[a-zA-Z]/.test(previous))) continue;
    }
    if (text[i] === '.' && /\d/.test(text[i + 1] || '') && previous && /[a-zA-Z]/.test(previous)) starts.push(i + 1);
    starts.push(i);
  }
  return [...new Set(starts)].sort((a, b) => a - b).slice(-80);
}

function completionText(parsed, q, catalog, settings, precision, notation = 'decimal', extended = false) {
  const formatted = formatQuantity(q, catalog, precision, notation, extended);
  const spacing = equationSpacing(parsed.expression);
  const equals = spacing + '=' + (formatted.unit ? '' : (spacing || ' '));
  return { formatted, insertion: parsed.hasEquals ? formatted.text : equals + formatted.text };
}

function makeCandidate(parsed, q, catalog, settings, options) {
  const { precision, notation = 'decimal', angle, badge = '', extended = false, kind = 'inline' } = options;
  const { formatted, insertion } = completionText(parsed, q, catalog, settings, precision, notation, extended);
  if (!insertion) return null;
  return {
    text: truncate(parsed.hasEquals ? formatted.text : insertion, 84),
    fullText: insertion,
    preview: truncate(parsed.hasEquals ? formatted.text : insertion, 64),
    start: parsed.replaceStart,
    end: parsed.replaceEnd,
    kind,
    badge,
    notation,
    unit: formatted.unit,
    system: q.display?.symbol ? catalog.units[q.display.symbol]?.system : undefined,
    angle,
    title: `${notation === 'scientific' ? 'Scientific notation' : 'Accept completion'} · ${formatted.text}`,
  };
}

function analyzeAt(text, lineStart, cursor, start, catalog, settings, overrideUnit) {
  const prefix = text.slice(lineStart, cursor);
  const after = text.slice(cursor, text.indexOf('\n', cursor) === -1 ? text.length : text.indexOf('\n', cursor));
  const equals = /(?<![<>!])=(?!=)/g;
  let match, equalsIndex = -1;
  while ((match = equals.exec(prefix))) equalsIndex = match.index;
  if (start > (equalsIndex === -1 ? prefix.length : equalsIndex)) return null;
  const hasEquals = equalsIndex !== -1;
  const rawExpression = prefix.slice(start, hasEquals ? equalsIndex : prefix.length);
  const expression = rawExpression.trim();
  if (!expression || expression.length > 4000) return null;
  const conversion = findConversion(expression);
  const source = conversion.source.trim();
  if (!source || /^[+-]?\d+(?:\.\d*)?$/.test(source) && !conversion.hasConversion) return null;
  const beforeNumber = hasEquals ? prefix.slice(equalsIndex + 1) : '';
  const leadingWhitespace = /^\s*/.exec(beforeNumber)[0].length;
  const typedPrefix = beforeNumber.slice(leadingWhitespace);
  const numericBefore = new RegExp('^' + partialNumberPattern).exec(typedPrefix)?.[0] || '';
  if (hasEquals && typedPrefix && numericBefore !== typedPrefix) return null;
  if (hasEquals && !typedPrefix && after && !/^\s*(?:[-+.\d]|$)/.test(after) && !/^\s*$/.test(after)) return null;
  const numericAfter = /^(?:\d*(?:\.\d*)?(?:[eE][+-]?\d*)?)?/.exec(after)?.[0] || '';
  const typedFull = numericBefore + numericAfter;
  const validTypedNumber = typedFull && new RegExp('^' + numberPattern + '$').test(typedFull);
  const numericStart = cursor - numericBefore.length;
  const numericEnd = cursor + numericAfter.length;
  if (hasEquals && typedPrefix && !validTypedNumber && !/^[+-]?\d*\.?\d*$/.test(numericBefore)) return null;
  const requestedPrecision = validTypedNumber ? significantDigits(typedFull) + 1 : 4;
  const precision = Math.max(settings.calculationPrecision || 48, Math.min(12000, requestedPrecision + 20));
  let parsed;
  try { parsed = parseMath(source, catalog, { angle: settings.angle, precision }); }
  catch { return null; }
  if (!parsed.hasOperation && !parsed.hasFunction && !parsed.hasConstant && !parsed.hasUnit && !conversion.hasConversion) return null;
  const unitOnly = parsed.hasUnit && !parsed.hasOperation && !parsed.hasFunction && !conversion.hasConversion;
  let result = parsed.value;
  let targetUnit = null;
  let options = [];
  if (conversion.hasConversion) {
    options = unitOptions(result, catalog);
    if (conversion.target) {
      const targetSymbol = catalog.aliases[conversion.target];
      if (targetSymbol) targetUnit = catalog.units[targetSymbol];
      else {
        const compatible = options.filter(unit => unit.symbol.toLowerCase().startsWith(conversion.target.toLowerCase()));
        if (compatible.length) targetUnit = compatible[0];
        else if (!overrideUnit) return null;
      }
    }
    if (overrideUnit && options.some(unit => unit.symbol === overrideUnit)) targetUnit = catalog.units[overrideUnit];
    if (targetUnit) {
      try { result = convertQuantity(result, targetUnit, catalog); }
      catch { return null; }
    }
  }
  if (!options.length && !isDimensionless(result.dimension)) options = unitOptions(result, catalog);
  if (!conversion.hasConversion && overrideUnit && options.some(unit => unit.symbol === overrideUnit)) {
    try { result = convertQuantity(result, catalog.units[overrideUnit], catalog); targetUnit = catalog.units[overrideUnit]; }
    catch { return null; }
  }
  result = normalizeQuantity(result, catalog, settings.units, Boolean(targetUnit));
  const ordinary = formatQuantity(result, catalog, 4);
  if (unitOnly && !hasEquals && ordinary.text === source.replace(/\s+/g, '')) return null;
  const basePrecision = adaptivePrecision(parsed, result, catalog);
  const context = {
    ...parsed,
    expression: rawExpression,
    hasEquals,
    replaceStart: cursor,
    replaceEnd: cursor,
    source,
    result,
    targetUnit: targetUnit?.symbol || '',
    unitOptions: options,
    ordinary,
  };
  // A complete, ordinary answer is left alone. Constants and unfinished numbers
  // can continue, with a targeted replacement of a previously rounded digit.
  if (hasEquals && validTypedNumber && numericBefore && !overrideUnit) {
    const currentValue = coefficient(result, catalog);
    const typedValue = new D(typedFull);
    if (typedValue.equals(currentValue)) return null;
    if (typedValue.equals(currentValue.toSignificantDigits(basePrecision)) && !numericAfter && !parsed.hasConstant && !parsed.hasFunction && !conversion.hasConversion) return null;
    const desiredPrecision = Math.max(1, significantDigits(typedFull) + 1);
    const exact = truncatedNumber(currentValue, desiredPrecision);
    const normalizedTyped = typedFull.startsWith('-.') ? '-0.' + typedFull.slice(2) : typedFull.startsWith('.') ? '0.' + typedFull.slice(1) : typedFull;
    let common = 0;
    while (common < normalizedTyped.length && common < exact.length && normalizedTyped[common] === exact[common]) common++;
    const exactTyped = typedValue.equals(currentValue);
    if (exactTyped && !parsed.hasConstant && !parsed.hasFunction && !conversion.hasConversion && currentValue.toSignificantDigits(desiredPrecision).equals(typedValue)) return null;
    if (common === 0 && numericBefore) {
      context.replaceStart = numericStart;
      context.replaceEnd = numericEnd;
      return finish(context, result, catalog, settings, basePrecision, basePrecision > 4);
    }
    const offset = normalizedTyped.length - typedFull.length;
    const replacementStart = numericStart + Math.max(0, common - offset);
    const insertion = exact.slice(common);
    if (!insertion) return null;
    context.replaceStart = replacementStart;
    context.replaceEnd = numericEnd;
    const candidate = {
      text: insertion,
      fullText: insertion,
      preview: truncate(insertion, 64),
      start: replacementStart,
      end: numericEnd,
      kind: 'inline',
      badge: '',
      notation: 'decimal',
      unit: '',
      title: `Continue to ${desiredPrecision} significant digits`,
      continuation: true,
    };
    return { candidates: [candidate], context, precision: desiredPrecision };
  }
  if (hasEquals) {
    if (!numericBefore && numericAfter && new D(typedFull).equals(coefficient(result, catalog).toSignificantDigits(basePrecision)) && !overrideUnit) return null;
    context.replaceStart = numericBefore ? numericStart : cursor;
    context.replaceEnd = numericEnd;
    if (!numericBefore && numericAfter) {
      // The caret is in front of an existing answer: replace that answer, not
      // the expression before the caret.
      const tailUnit = /^\s*[a-zA-ZµμΩ°][a-zA-ZµμΩ°0-9/*^·⁻⁺⁰¹²³⁴⁵⁶⁸⁹-]*/.exec(after.slice(numericAfter.length))?.[0] || '';
      context.replaceEnd = numericEnd + tailUnit.length;
    }
  }
  return finish(context, result, catalog, settings, basePrecision, basePrecision > 4);
}

function finish(context, result, catalog, settings, precision, extended) {
  const candidates = [];
  const value = coefficient(result, catalog).abs();
  const extreme = !value.isZero() && (value.e < -1000 || value.e > 1000);
  const scientificAvailable = !value.isZero() && (value.e < -4 || value.e > 4);
  const primaryNotation = extreme ? 'scientific' : 'decimal';
  const primary = makeCandidate(context, result, catalog, settings, { precision, notation: primaryNotation, extended });
  if (primary) candidates.push(primary);
  {
    const alternative = alternativeQuantity(result, catalog, settings.units);
    if (alternative) {
      const candidate = makeCandidate(context, alternative, catalog, settings, { precision: 4, kind: 'bar' });
      if (candidate && candidate.fullText !== primary?.fullText) candidates.push(candidate);
    }
    if (context.angleSensitive) {
      try {
        const otherAngle = settings.angle === 'rad' ? 'deg' : 'rad';
        const alternate = parseMath(context.source, catalog, { angle: otherAngle, precision: settings.calculationPrecision || 48 });
        const alternateResult = normalizeQuantity(alternate.value, catalog, settings.units);
        if (!alternateResult.value.minus(result.value).abs().lte(new D(10).pow(-precision))) {
          const candidate = makeCandidate(context, alternateResult, catalog, settings, { precision: 4, kind: 'bar', badge: otherAngle, angle: otherAngle });
          if (candidate) {
            candidates[0].badge = settings.angle;
            candidates.push(candidate);
          }
        }
      } catch { /* An invalid alternative is simply not offered. */ }
    }
    if (scientificAvailable && !extreme) {
      const candidate = makeCandidate(context, result, catalog, settings, { precision: 4, notation: 'scientific', kind: 'bar' });
      if (candidate && !candidates.some(c => c.fullText === candidate.fullText)) candidates.push(candidate);
    }
  }
  return candidates.length ? { candidates, context, precision } : null;
}

export function getSuggestions(text, cursor, settings = {}, registry = {}, overrideUnit = '') {
  if (cursor < 0 || cursor > text.length || text.length > 250000) return null;
  const lineStart = text.lastIndexOf('\n', cursor - 1) + 1;
  const prefix = text.slice(lineStart, cursor);
  if (prefix.length > 16000) return null;
  const catalog = compileUnits(registry);
  const defaults = { angle: 'rad', units: 'metric', calculationPrecision: 48, ...settings };
  for (const start of startsFor(prefix)) {
    try {
      const result = analyzeAt(text, lineStart, cursor, lineStart + start, catalog, defaults, overrideUnit);
      if (result) return result;
    } catch { /* Incomplete expressions never modify the document or interrupt typing. */ }
  }
  return null;
}

export function describeSuggestion(result, catalog) {
  if (!result) return null;
  const q = result.context.result;
  return {
    expression: result.context.source,
    value: q.value.toString(),
    preview: result.context.ordinary.text,
    dimension: q.dimension,
    unit: formatUnit(q.display || simplifyUnit(q.dimension, catalog)),
    precision: result.precision,
    candidates: result.candidates.map(c => c.fullText),
  };
}
