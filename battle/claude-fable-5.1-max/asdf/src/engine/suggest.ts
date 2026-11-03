import type { Dec } from "./decimal";
import { type AngleMode, type EvalContext, type Quantity, createContext, evaluate } from "./evaluator";
import { continueDigits, formatPlain, formatSci, sciLevel } from "./format";
import { dlog, isDebugEnabled } from "./log";
import { type Parsed, parse } from "./parser";
import { type Token, tokenize } from "./tokenizer";
import { chooseDisplayUnit, type SystemPref } from "./unitChoice";
import {
  type DisplayUnit,
  type UnitRegistry,
  dimEq,
  dimIsZero,
  dimKey,
  displayValue,
  formatUnit,
  unitKey,
  unitNeedsSpace,
} from "./units";

export type SuggestionKind = "result" | "alt-system" | "alt-angle" | "sci" | "unit" | "continuation";

export interface Suggestion {
  /** text inserted at the cursor */
  text: string;
  /** characters before the cursor replaced by `text` */
  replaceBefore: number;
  /** chip label */
  label: string;
  badge?: AngleMode;
  kind: SuggestionKind;
}

export interface UnitPickerInfo {
  options: { key: string; label: string }[];
  selected: string;
}

export interface SuggestResult {
  items: Suggestion[];
  inline: boolean;
  unitPicker: UnitPickerInfo | null;
  dimKey: string | null;
}

export interface SuggestSettings {
  system: SystemPref;
  angle: AngleMode;
  inlineEnabled: boolean;
}

export interface SuggestInput {
  line: string;
  cursor: number;
  settings: SuggestSettings;
  registry: UnitRegistry;
  /** unit key chosen from the unit picker */
  unitOverride?: string | null;
}

const BASE_PRECISION = 40;
const BULLET_RE = /^\s*(?:[-*•+]|\d+[.)])\s+/;
const WORD_RE = /^[\p{L}_°µμΩ][\p{L}0-9_°µμΩ²³¹⁰⁴⁵⁶⁷⁸⁹⁻]*/u;

type Mode = "fresh" | "answer" | "progressive";

interface Result {
  q: Quantity;
  ctx: EvalContext;
  badge?: AngleMode;
}

interface Cand {
  q: Quantity;
  unit: DisplayUnit | null;
  value: Dec;
  badge?: AngleMode;
  kind: SuggestionKind;
  /** the candidate replaces the explicitly typed conversion target */
  replaceTarget?: boolean;
}

function isConvOp(t: Token): boolean {
  return (t.type === "op" && (t.text === "->" || t.text === "→")) || (t.type === "ident" && t.text === "to");
}

function isInteresting(parsed: Parsed, q: Quantity, reg: UnitRegistry): boolean {
  const m = parsed.meta;
  if (m.hasBinary || m.hasCall || m.hasConst || m.hasPostfix || m.isConvert) return true;
  if (m.bareQuantity && m.inputUnits.length) {
    const inp = m.inputUnits[0];
    const own: SystemPref = inp.system === "imperial" ? "imperial" : "metric";
    const u = chooseDisplayUnit(q, own, m.inputUnits, reg);
    if (!u || unitKey(u) === unitKey(inp)) return false;
    const v = displayValue(q, u).abs();
    return v.gte(1) && v.lt(1000);
  }
  return false;
}

/** Computes autocomplete suggestions for the cursor position within a single line. */
export function suggest(input: SuggestInput): SuggestResult | null {
  const { line, cursor, settings, registry } = input;
  const before = line.slice(0, cursor);
  const after = line.slice(cursor);

  // Never run into a number that follows the cursor, or into an existing answer.
  if (/^\d/.test(after) || /^\.\d/.test(after)) return null;
  if (/^\s*=/.test(after)) return null;
  const afterWord = WORD_RE.exec(after)?.[0] ?? null;

  const bulletMatch = BULLET_RE.exec(before);
  const bullet = !!bulletMatch;
  const toks = tokenize(before, bulletMatch ? bulletMatch[0].length : 0);
  const trailingWs = /\s*$/.exec(before)![0];
  if (!toks.length) return null;

  // --- '=' handling -------------------------------------------------------
  let eqIdx = -1;
  for (let i = toks.length - 1; i >= 0; i--) {
    if (toks[i].type === "op" && toks[i].text === "=") {
      eqIdx = i;
      break;
    }
  }
  let mode: Mode = "fresh";
  let typed: string | null = null;
  let eqTok: Token | null = null;
  let exprToks = toks;
  if (eqIdx >= 0) {
    const ans = toks.slice(eqIdx + 1);
    if (ans.length === 0) {
      mode = "answer";
      eqTok = toks[eqIdx];
      exprToks = toks.slice(0, eqIdx);
    } else {
      let i = 0;
      let sign = "";
      if (ans[0].type === "op" && (ans[0].text === "-" || ans[0].text === "+")) {
        sign = ans[0].text;
        i = 1;
      }
      const numTok = ans[i];
      if (numTok && numTok.type === "num" && (!sign || numTok.ws === "")) {
        if (i === ans.length - 1) {
          if (trailingWs) return null; // the typed answer is closed by whitespace
          mode = "progressive";
          typed = sign + numTok.text;
          eqTok = toks[eqIdx];
          exprToks = toks.slice(0, eqIdx);
        } else if (ans.slice(i + 1).every((t) => t.type === "ident")) {
          return null; // number and unit already present
        }
      }
    }
  }

  // --- explicit conversion with a missing / partial target ----------------
  let conv: { opTok: Token; partial: string; sp: string } | null = null;
  if (mode === "fresh" && exprToks.length >= 2) {
    const last = exprToks[exprToks.length - 1];
    const prev = exprToks[exprToks.length - 2];
    const lastIsIn = last.type === "ident" && last.text === "in" && trailingWs !== "";
    if (isConvOp(last) || lastIsIn) {
      conv = { opTok: last, partial: "", sp: trailingWs || last.ws };
      exprToks = exprToks.slice(0, -1);
    } else if (
      last.type === "ident" &&
      !trailingWs &&
      exprToks.length >= 3 &&
      (isConvOp(prev) || (prev.type === "ident" && prev.text === "in")) &&
      !registry.resolveIdent(last.text)
    ) {
      conv = { opTok: prev, partial: last.text, sp: last.ws };
      exprToks = exprToks.slice(0, -2);
    }
  }
  if (!exprToks.length) return null;

  // --- find the longest valid expression ending at the cursor -------------
  let found: { slice: Token[]; parsed: Parsed; q: Quantity; ctx: EvalContext } | null = null;
  for (let s = 0; s < exprToks.length; s++) {
    const slice = exprToks.slice(s);
    const f = slice[0];
    if (f.type === "other" || (f.type === "op" && !["(", "-", "+"].includes(f.text))) continue;
    let parsed: Parsed;
    try {
      parsed = parse(slice, registry, { allowBareUnitFirst: !!conv });
    } catch {
      continue;
    }
    const ctx = createContext(BASE_PRECISION, settings.angle);
    let q: Quantity;
    try {
      q = evaluate(parsed.node, ctx);
    } catch {
      continue;
    }
    if (conv) {
      if (dimIsZero(q.dim)) continue;
    } else if (mode !== "fresh" && parsed.meta.bareQuantity) {
      // after `=` any quantity with a unit is worth answering (normalised form + alternatives)
    } else if (!isInteresting(parsed, q, registry)) continue;
    found = { slice, parsed, q, ctx };
    break;
  }
  if (!found) return null;
  const { parsed } = found;
  const meta = parsed.meta;
  const inputUnits = meta.inputUnits;

  // --- evaluate alternatives / higher precision ---------------------------
  const evalAll = (precision: number): Result[] => {
    const out: Result[] = [];
    const modes: AngleMode[] = found!.ctx.usedAngleMode
      ? [settings.angle, settings.angle === "rad" ? "deg" : "rad"]
      : [settings.angle];
    for (const angle of modes) {
      const ctx = createContext(precision, angle);
      try {
        const q = evaluate(parsed.node, ctx);
        out.push({ q, ctx, badge: ctx.usedAngleMode ? angle : undefined });
      } catch {
        /* skip */
      }
    }
    return out;
  };
  let results: Result[] = evalAll(BASE_PRECISION);
  if (!results.length) return null;
  if (mode === "progressive" && typed) {
    results = evalAll(Math.max(BASE_PRECISION, typed.length + 24));
  } else {
    const v = results[0].q.v;
    const e = v.isZero() ? 0 : v.abs().e;
    if (e > 28 && e < 1100) results = evalAll(e + 12);
  }
  if (!results.length) return null;

  const otherSystem: SystemPref = settings.system === "metric" ? "imperial" : "metric";
  const override = input.unitOverride ? registry.parseUnitString(input.unitOverride) : null;

  const candidatesFor = (r: Result): Cand[] => {
    const q = r.q;
    if (dimIsZero(q.dim)) return [{ q, unit: null, value: q.v, badge: r.badge, kind: "result" }];
    let forced = r.ctx.forcedUnit;
    let replaceTarget = false;
    if (override && dimEq(override.dim, q.dim)) {
      replaceTarget = !!forced && unitKey(forced) !== unitKey(override) && mode === "fresh";
      forced = override;
    }
    if (forced) return [{ q, unit: forced, value: displayValue(q, forced), badge: r.badge, kind: "result", replaceTarget }];
    let primary = chooseDisplayUnit(q, settings.system, inputUnits, registry);
    let alt = chooseDisplayUnit(q, otherSystem, inputUnits, registry);
    if (meta.bareQuantity && inputUnits.length) {
      const own: SystemPref = inputUnits[0].system === "imperial" ? "imperial" : "metric";
      if (own !== settings.system) [primary, alt] = [alt, primary];
    }
    const out: Cand[] = [];
    if (primary) out.push({ q, unit: primary, value: displayValue(q, primary), badge: r.badge, kind: "result" });
    if (alt && (!primary || unitKey(alt) !== unitKey(primary))) {
      out.push({ q, unit: alt, value: displayValue(q, alt), badge: r.badge, kind: "alt-system" });
    }
    return out;
  };

  const unitText = (u: DisplayUnit, value?: Dec) => formatUnit(u, meta.style, value);
  const withUnit = (num: string, u: DisplayUnit | null, value: Dec) => {
    if (!u) return num;
    const us = unitText(u, value);
    return num + (unitNeedsSpace(us) ? " " : "") + us;
  };
  const body = (c: Cand, sci: boolean): string | null => {
    const level = sciLevel(c.value);
    let num: string;
    if (level === "only") {
      if (sci) return null;
      num = formatSci(c.value);
    } else if (sci) {
      if (level !== "alt") return null;
      num = formatSci(c.value);
    } else {
      num = formatPlain(c.value, { minDecimals: meta.maxDecimals });
    }
    return withUnit(num, c.unit, c.value);
  };

  const opSp = (() => {
    const i = meta.lastBinaryOp;
    if (i >= 0 && i + 1 < found!.slice.length) return found!.slice[i + 1].ws;
    // no binary operator: mirror whether the expression itself uses spaces (`1500 g`, `sin 30`)
    return found!.slice.some((t, idx) => idx > 0 && t.ws !== "") ? " " : "";
  })();

  const items: Suggestion[] = [];
  const pushItem = (text: string | null, replaceBefore: number, kind: SuggestionKind, badge?: AngleMode) => {
    if (!text) return;
    if (items.some((x) => x.text === text && x.replaceBefore === replaceBefore)) return;
    items.push({ text, replaceBefore, label: text.replace(/\s+/g, " ").trim(), kind, badge });
  };

  let primaryUnit: DisplayUnit | null = null;

  if (mode === "progressive" && typed) {
    let afterUnit: DisplayUnit | null = null;
    if (afterWord) {
      const p = registry.resolveIdent(afterWord);
      if (!p) return null;
      afterUnit = registry.makeUnit([p]);
    }
    const precision = results[0].ctx.D.precision;
    for (const r of results) {
      let cands = candidatesFor(r);
      if (afterUnit) {
        if (!dimEq(afterUnit.dim, r.q.dim)) continue;
        cands = [{ q: r.q, unit: afterUnit, value: displayValue(r.q, afterUnit), badge: r.badge, kind: "result" }];
      }
      for (const c of cands) {
        const cont = continueDigits(typed, c.value, precision);
        if (cont === null) continue;
        if (!primaryUnit && c.unit) primaryUnit = c.unit;
        const unitSuffix = c.unit && !afterWord ? (unitNeedsSpace(unitText(c.unit, c.value)) ? " " : "") + unitText(c.unit, c.value) : null;
        if (cont === "done") {
          pushItem(unitSuffix, 0, "unit", c.badge);
          continue;
        }
        pushItem(cont.text, cont.replaceBefore, "continuation", c.badge);
        pushItem(unitSuffix, 0, "unit", c.badge);
      }
    }
  } else if (conv) {
    const q0 = results[0].q;
    const sourceUnit = [...inputUnits].reverse().find((u) => dimEq(u.dim, q0.dim)) ?? null;
    const srcSystem: SystemPref = sourceUnit ? (sourceUnit.system === "imperial" ? "imperial" : "metric") : settings.system;
    const otherSrc: SystemPref = srcSystem === "metric" ? "imperial" : "metric";
    const ordered: DisplayUnit[] = [];
    const addU = (u: DisplayUnit | null) => {
      if (u && !ordered.some((x) => unitKey(x) === unitKey(u))) ordered.push(u);
    };
    if (override && dimEq(override.dim, q0.dim)) addU(override);
    addU(chooseDisplayUnit(q0, otherSrc, inputUnits, registry));
    addU(chooseDisplayUnit(q0, srcSystem, inputUnits, registry));
    // remaining units ordered by how readable the converted value is
    const rest = registry
      .allUnitsForDim(q0.dim)
      .filter((u) => !ordered.some((x) => unitKey(x) === unitKey(u)))
      .map((u) => {
        const a = displayValue(q0, u).abs();
        const lg = a.isZero() || !a.isFinite() ? 0 : a.log(10).toNumber();
        const dist = a.gte(1) && a.lt(1000) ? 0 : a.lt(1) ? -lg : lg - 3;
        return { u, dist };
      })
      .sort((x, y) => x.dist - y.dist);
    for (const r of rest) addU(r.u);
    let list = ordered.filter((u) => (override && u === override) || !sourceUnit || unitKey(u) !== unitKey(sourceUnit));
    if (conv.partial) list = list.filter((u) => unitText(u).startsWith(conv!.partial));
    if (!list.length) return null;
    primaryUnit = list[0];
    for (const u of list.slice(0, 6)) {
      const value = displayValue(q0, u);
      const num = sciLevel(value) === "only" ? formatSci(value) : formatPlain(value, { minDecimals: meta.maxDecimals });
      const text = unitText(u).slice(conv.partial.length) + conv.sp + "=" + conv.sp + withUnit(num, u, value);
      pushItem(text, 0, "result");
    }
  } else {
    if (afterWord) return null;
    const lead = trailingWs ? "" : mode === "answer" ? eqTok!.ws : opSp;
    const trail = mode === "answer" ? "" : trailingWs ? trailingWs : opSp;
    const allCands = results.flatMap(candidatesFor);
    primaryUnit = allCands[0]?.unit ?? null;
    const emit = (c: Cand, sci: boolean, kind: SuggestionKind) => {
      const b = body(c, sci);
      if (!b) return;
      if (c.replaceTarget && c.unit && meta.convertTargetStart >= 0) {
        const text = unitText(c.unit) + opSp + "=" + opSp + b;
        pushItem(text, cursor - meta.convertTargetStart, kind, c.badge);
        return;
      }
      pushItem(mode === "answer" ? lead + b : lead + "=" + trail + b, 0, kind, c.badge);
    };
    for (const c of allCands) emit(c, false, c.badge && c !== allCands[0] && c.badge !== settings.angle ? "alt-angle" : c.kind);
    for (const c of allCands) emit(c, true, "sci");
  }

  if (!items.length) return null;

  // --- unit picker --------------------------------------------------------
  let unitPicker: UnitPickerInfo | null = null;
  const q0 = results[0].q;
  if (!dimIsZero(q0.dim) && primaryUnit) {
    const seen = new Set<string>();
    const options: { key: string; label: string }[] = [];
    const all = [primaryUnit, ...inputUnits.filter((u) => dimEq(u.dim, q0.dim)), ...registry.allUnitsForDim(q0.dim)];
    for (const u of all) {
      const key = unitKey(u);
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({ key, label: unitText(u) });
    }
    unitPicker = { options, selected: unitKey(primaryUnit) };
  }

  const inline = settings.inlineEnabled && !(bullet && mode === "fresh");
  if (isDebugEnabled()) {
    dlog("suggest", {
      mode,
      bullet,
      expr: found.slice.map((t) => t.text).join(" "),
      typed,
      conv: conv ? { partial: conv.partial } : null,
      angleDependent: found.ctx.usedAngleMode,
      items: items.map((i) => ({ text: i.text, replaceBefore: i.replaceBefore, kind: i.kind, badge: i.badge })),
      inline,
    });
  }
  return { items, inline, unitPicker, dimKey: dimIsZero(q0.dim) ? null : dimKey(q0.dim) };
}

/** Convenience wrapper: locate the cursor's line within a multi-line document. */
export function suggestInDocument(
  text: string,
  caret: number,
  settings: SuggestSettings,
  registry: UnitRegistry,
  unitOverride?: string | null,
): SuggestResult | null {
  const lineStart = text.lastIndexOf("\n", caret - 1) + 1;
  let lineEnd = text.indexOf("\n", caret);
  if (lineEnd < 0) lineEnd = text.length;
  const line = text.slice(lineStart, lineEnd);
  try {
    return suggest({ line, cursor: caret - lineStart, settings, registry, unitOverride });
  } catch (err) {
    dlog("suggest:error", String(err));
    return null;
  }
}
