// ── Suggestion pipeline: editor context → completion candidates ─────────────
import Decimal from "decimal.js";
import { evaluate } from "./mathengine.js";
import { isDimensionless, dimsKey } from "./units.js";
import { formatNumber, continuation, plain, intDigits, truncateLabel } from "./format.js";

const RUN_CHAR = /[0-9a-zA-Z.+\-*/^()= >·×÷µΩμπ√°⁰¹²³⁴⁵⁶⁷⁸⁹⁻→−]/;

function contextStarts(region) {
  const starts = [];
  for (let i = 0; i < region.length; i++) {
    if (/\s/.test(region[i])) continue;
    if (i === 0) { starts.push(i); continue; }
    const prev = region[i - 1];
    if (/\s/.test(prev)) { starts.push(i); continue; }
    if (region[i] === "." && /[a-zA-Z]/.test(prev) && /\d/.test(region[i + 1] || "")) starts.push(i);
  }
  return starts;
}

function parseRegion(region, opts, precision) {
  for (const s of contextStarts(region)) {
    const src = region.slice(s);
    try {
      const res = evaluate(src, { ...opts, precision });
      if (res.worthy) return { res, src, start: s };
    } catch { /* try a shorter suffix */ }
  }
  return null;
}

const other = (m) => (m === "rad" ? "deg" : "rad");

// fractional literals may demand digits beyond the 4-digit preview (pi + 0.000001)
const extendFor = (r) => (r.value.isZero() || r.maxLitDec === 0 ? 0 : r.maxLitDec + intDigits(r.value));

// Build value candidates (shared by "expr|" and "expr = |" states).
function valueCandidates(res, evalOpts, prefix, log, retryPrec, retryMode) {
  const { engine, system, angle } = evalOpts;
  const cands = [];
  let dropdown = null;

  const dimsless = isDimensionless(res.dims);

  if (dimsless) {
    let r = res;
    const extend = extendFor(r);
    if (extend > 55) {
      const again = retryPrec(extend + 25);
      if (again) r = again;
    }
    const fmt = formatNumber(r.value, extendFor(r));
    const primary = { insert: prefix + fmt.primary, replaceBefore: 0, label: truncateLabel(prefix + fmt.primary), badge: null, setAngle: null };
    cands.push(primary);
    if (r.hasTrig) {
      const altRes = retryMode(other(angle));
      if (altRes) {
        const altFmt = formatNumber(altRes.value, extendFor(altRes));
        if (altFmt.primary !== fmt.primary) {
          primary.badge = angle;
          cands.push({ insert: prefix + altFmt.primary, replaceBefore: 0, label: truncateLabel(prefix + altFmt.primary), badge: other(angle), setAngle: other(angle) });
        }
      }
    }
    if (fmt.alt) cands.push({ insert: prefix + fmt.alt, replaceBefore: 0, label: truncateLabel(prefix + fmt.alt), badge: null, setAngle: null, sci: true });
  } else {
    // unit-bearing result
    const si = res.siValue;
    const styleGap = (sym) => (res.firstQty && res.firstQty.sym === sym ? res.firstQty.gap : "");
    const mkLabel = (coefStr, sym) => coefStr + styleGap(sym) + sym;

    let primaryUnitLabel, primaryText;
    if (res.target) {
      primaryUnitLabel = res.target.label;
      primaryText = mkLabel(plain(res.value, 4), res.target.label);
    } else {
      const pick = engine.pick(si, res.dims, system);
      if (pick) {
        primaryUnitLabel = pick.unit.sym;
        primaryText = mkLabel(plain(pick.value, 4), pick.unit.sym);
      } else {
        const bp = engine.baseProduct(si, res.dims, res.styles);
        primaryUnitLabel = bp.label;
        primaryText = plain(bp.value, 4) + styleGap(bp.first) + bp.label;
      }
    }
    cands.push({ insert: prefix + primaryText, replaceBefore: 0, label: truncateLabel(prefix + primaryText), badge: null, setAngle: null, unit: primaryUnitLabel });

    // one alternative in the other measurement system
    const altSystem = system === "metric" ? "imperial" : "metric";
    const altPick = engine.pick(si, res.dims, altSystem);
    if (altPick && altPick.unit.sym !== primaryUnitLabel) {
      const altText = mkLabel(plain(altPick.value, 4), altPick.unit.sym);
      cands.push({ insert: prefix + altText, replaceBefore: 0, label: truncateLabel(prefix + altText), badge: null, setAngle: null, unit: altPick.unit.sym });
    }

    const options = engine.optionsFor(res.dims);
    if (options.length >= 2) dropdown = { options, active: primaryUnitLabel };
  }

  log?.("candidates", cands.map((c) => c.insert));
  return { candidates: cands, dropdown };
}

export function getSuggestions(text, caret, opts) {
  const { engine, system = "metric", angle = "rad", targetOverride = null, log } = opts;
  const none = { candidates: [], dropdown: null, key: "" };

  // selection or mid-word caret handled by caller / forward scan
  let runStart = caret;
  while (runStart > 0) {
    const ch = text[runStart - 1];
    if (ch === "\n" || !RUN_CHAR.test(ch)) break;
    runStart--;
  }
  const run = text.slice(runStart, caret);
  if (!run.trim()) return none;
  const fwd = (/^[A-Za-zµΩ0-9]+/.exec(text.slice(caret)) || [""])[0];

  const eqIdx = run.lastIndexOf("=");
  const evalOpts = { engine, system, angle };

  if (eqIdx === -1) {
    if (fwd) return none; // caret inside a word/number → ordinary editing
    const parsed = parseRegion(run, evalOpts, 60);
    if (!parsed) { log?.("no completion", run); return none; }
    const { res, src, start } = parsed;
    const retryPrec = (p) => { try { return evaluate(src, { ...evalOpts, precision: p }); } catch { return null; } };
    const retryMode = (mode) => { try { return evaluate(src, { ...evalOpts, angle: mode, precision: 60 }); } catch { return null; } };
    const gap = res.lastGap != null ? res.lastGap : " ";
    const key = `${runStart + start}:${src}`;

    // dropdown override → treat as explicit conversion (supersedes a written target)
    let r = res;
    if (targetOverride && targetOverride.key === key) {
      try {
        const ov = evaluate(targetOverride.expr, { engine, precision: 60 });
        if (dimsKey(ov.dims) === dimsKey(res.dims) && !isDimensionless(ov.dims)) {
          r = { ...res, value: res.siValue.div(ov.value), target: { label: targetOverride.expr } };
        }
      } catch { /* invalid override ignored */ }
    }
    log?.("expression", { src, value: r.value.toString(), dims: r.dims });
    const out = valueCandidates(r, evalOpts, gap + "=" + gap, log, retryPrec, retryMode);
    return { ...out, key };
  }

  // ── "=" already typed ──
  const lhsRegion = run.slice(0, eqIdx);
  const typedRaw = run.slice(eqIdx + 1);
  const typed = typedRaw.replace(/^\s+/, "");
  if (/\s/.test(typed)) return none; // prose after a result → no suggestions
  const parsed = parseRegion(lhsRegion, evalOpts, 60);
  if (!parsed) return none;
  const { res, src, start } = parsed;
  const key = `${runStart + start}:${src}=`;

  if (typed === "") {
    if (fwd) return none; // e.g. "1+1=|4" → keep ordinary behavior
    const retryPrec = (p) => { try { return evaluate(src, { ...evalOpts, precision: p }); } catch { return null; } };
    const retryMode = (mode) => { try { return evaluate(src, { ...evalOpts, angle: mode, precision: 60 }); } catch { return null; } };
    let r = res;
    if (targetOverride && targetOverride.key === key) {
      try {
        const ov = evaluate(targetOverride.expr, { engine, precision: 60 });
        if (dimsKey(ov.dims) === dimsKey(res.dims) && !isDimensionless(ov.dims)) {
          r = { ...res, value: res.siValue.div(ov.value), target: { label: targetOverride.expr } };
        }
      } catch { /* ignore */ }
    }
    const out = valueCandidates(r, evalOpts, "", log, retryPrec, retryMode);
    return { ...out, key };
  }

  // ── digit continuation (progressive typing / repair of rounded tails) ──
  if (!/^-?[\d.]+$/.test(typed) || !/\d/.test(typed)) return none;
  const precision = Math.max(60, typed.length + 40);
  if (typed.length > 1240) return none;
  let r;
  try { r = evaluate(src, { ...evalOpts, precision }); } catch { return none; }

  let val = null;
  if (r.target) {
    if (fwd === "" || fwd === r.target.label) val = r.value;
    else {
      const def = engine.lookup(fwd);
      if (def && dimsKey(def.dims) === dimsKey(r.dims)) val = r.siValue.div(def.coefDec);
    }
  } else if (!isDimensionless(r.dims)) {
    if (fwd === "") {
      const pick = engine.pick(r.siValue, r.dims, system);
      val = pick ? pick.value : r.siValue;
    } else {
      const def = engine.lookup(fwd);
      if (def && dimsKey(def.dims) === dimsKey(r.dims)) val = r.siValue.div(def.coefDec);
    }
  } else {
    if (fwd) return none;
    val = r.value;
  }
  if (val == null) return none;

  const cont = continuation(typed, val, precision);
  if (!cont) { log?.("continuation exhausted", { typed }); return none; }
  log?.("continue digits", { typed, insert: cont.insert, replaceBefore: cont.replaceBefore });
  return {
    candidates: [{ insert: cont.insert, replaceBefore: cont.replaceBefore, label: truncateLabel(cont.insert), badge: null, setAngle: null }],
    dropdown: null,
    key,
  };
}