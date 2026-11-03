import {
  tokenizeExpression,
  evaluateTokens,
  formatDecimalPreview,
  truncateDisplayPreview,
  solvePrecisionContinuation,
} from './mathEngine.js';
import { logger } from './logger.js';

function isValidExpressionStart(segment, s) {
  const curr = segment[s];
  const prev = s > 0 ? segment[s - 1] : '';

  // Never split inside an alphanumeric/unit word or decimal (e.g. blocks "1+1" inside "text1+1" or "2+1" inside "1.2+1")
  if (/[a-zA-Z0-9µμΩπτφ√]/.test(curr)) {
    if (/[a-zA-Z0-9_µμΩπτφ.]/.test(prev)) return false;
  }

  // Leading-dot decimal like `.1+1` in `text.1+1=` is allowed after letters/punctuation, but NOT after digits/dot (`1.2.3`)
  if (curr === '.') {
    if (!/\d/.test(segment[s + 1] || '')) return false;
    if (/[0-9.]/.test(prev)) return false;
  }

  // Unary +/- at start of sub-expression
  if (curr === '+' || curr === '-' || curr === '−') {
    if (prev && !/[\s(\[:;,=]/.test(prev)) return false;
  }

  // Reject starting right after a dangling math operator from a broken left expression (e.g. `1km + 2 + 3`)
  const leftTrim = segment.slice(0, s).trimEnd();
  if (leftTrim.length > 0) {
    if (/[+*×/÷^·]$/.test(leftTrim) || leftTrim.endsWith('->') || leftTrim.endsWith('→')) {
      return false;
    }
    if ((curr === '+' || curr === '-' || curr === '−') && /[0-9.)°]$/.test(leftTrim)) {
      return false;
    }
    if (/[-−]$/.test(leftTrim)) {
      const beforeDash = leftTrim.slice(0, -1).trimEnd();
      if (beforeDash.length > 0 && /[0-9a-zA-Z.)°µμΩπτφ]$/.test(beforeDash)) {
        return false;
      }
    }
  }

  return true;
}

function findLongestSuffixTokens(segment, unitEngine) {
  const trimmedEnd = segment.trimEnd();
  if (!trimmedEnd) return null;

  for (let s = 0; s < trimmedEnd.length; s++) {
    if (trimmedEnd[s] === ' ' || trimmedEnd[s] === '\t') continue;
    if (!isValidExpressionStart(trimmedEnd, s)) continue;

    const slice = trimmedEnd.slice(s);
    const tokens = tokenizeExpression(slice, unitEngine);
    if (!tokens || tokens.length === 0) continue;

    // Quick sanity check that it evaluates cleanly under default settings
    const probe = evaluateTokens(tokens, { unitEngine, angleMode: 'rad', precision: 64, silent: true });
    if (probe) {
      return {
        exprText: slice,
        startOffsetInSegment: s,
        endOffsetInSegment: trimmedEnd.length,
        trailingSpaces: segment.slice(trimmedEnd.length),
        tokens,
      };
    }
  }

  return null;
}

function findLastSingleEquals(str) {
  for (let i = str.length - 1; i >= 0; i--) {
    if (str[i] === '=') {
      const prev = i > 0 ? str[i - 1] : '';
      const next = i + 1 < str.length ? str[i + 1] : '';
      if (prev !== '<' && prev !== '>' && prev !== '!' && prev !== '=' && next !== '=') {
        return i;
      }
    }
  }
  return -1;
}

function makeCandidate({
  insertText,
  deleteBefore = 0,
  deleteAfter = 0,
  allowInline = true,
  angleBadge = null,
  unitSystem = null,
  unitSymbol = null,
  chipLabel = null,
}) {
  const label = chipLabel ?? insertText;
  return {
    insertText,
    deleteBefore,
    deleteAfter,
    displayInline: truncateDisplayPreview(insertText, 28),
    displayChip: truncateDisplayPreview(label, 28),
    allowInline,
    angleBadge,
    unitSystem,
    unitSymbol,
  };
}

/**
 * Main entry point: analyzes document `text` at collapsed `cursor` position
 * and returns autocomplete candidates + compatible unit metadata without mutating `text`.
 */
export function computeAutocomplete(
  text,
  cursor,
  {
    unitEngine,
    angleMode = 'rad',
    unitSystem = 'metric',
    dropdownUnitOverride = null,
  } = {}
) {
  const empty = {
    candidates: [],
    compatibleUnits: [],
    activeUnitSymbol: null,
    exprKey: '',
  };

  if (typeof cursor !== 'number' || cursor < 0 || cursor > text.length) {
    return empty;
  }

  const lineStart = text.lastIndexOf('\n', cursor - 1) + 1;
  const nextNl = text.indexOf('\n', cursor);
  const lineEnd = nextNl === -1 ? text.length : nextNl;

  const before = text.slice(lineStart, cursor);
  const after = text.slice(cursor, lineEnd);

  if (!before.trim()) return empty;

  // Detect Markdown/plain-text bullet prefix `- ` (e.g. `- 1+1` -> bar-only `=2`, whereas `-1+1` -> inline `=0`)
  const bulletMatch = before.match(/^(\s*-\s+)/);
  const isBulletLine = Boolean(bulletMatch);
  const workingBefore = isBulletLine ? before.slice(bulletMatch[1].length) : before;

  if (!workingBefore.trim()) return empty;

  const eqIdx = findLastSingleEquals(workingBefore);

  // =========================================================================
  // CASE 1: Working line has `=`
  // =========================================================================
  if (eqIdx !== -1) {
    const lhsSegment = workingBefore.slice(0, eqIdx);
    const rhsSegment = workingBefore.slice(eqIdx + 1);

    // Subcase 1A: Empty RHS (`expr = |`)
    if (/^[ \t]*$/.test(rhsSegment)) {
      // Block if digits/expression already immediately follow cursor (e.g. `1+1=|4`, `1+1=|2`, `1+1=| 2`)
      if (after !== '' && (!/^[ \t]/.test(after) || /^[ \t]*[-+.\d]/.test(after))) {
        return empty;
      }

      const found = findLongestSuffixTokens(lhsSegment, unitEngine);
      if (!found) return empty;

      const spacesBeforeEq = found.trailingSpaces;
      const spacesTypedAfterEq = rhsSegment;
      const valueLeadSpace =
        spacesBeforeEq.length > spacesTypedAfterEq.length
          ? spacesBeforeEq.slice(spacesTypedAfterEq.length)
          : '';

      return buildEvaluationSuggestions({
        found,
        hasEquals: true,
        prefixBeforeValue: valueLeadSpace,
        extraCharsAfterExprToCursor: spacesBeforeEq.length + 1 + spacesTypedAfterEq.length,
        allowInline: true, // Explicit `=` always allows inline (even on `- 1+1="2"`)
        unitEngine,
        angleMode,
        unitSystem,
        dropdownUnitOverride,
      });
    }

    // Subcase 1B: Partial/Typed plain number on RHS (`pi=3.142|`, `1/sqrt 2=0.7|`, `1km -> mi = 0.62|"1"mi`)
    const rhsNumMatch = rhsSegment.match(/^[ \t]*([-+]?(?:\d+\.?\d*|\.\d+))$/);
    if (rhsNumMatch) {
      const rhsTyped = rhsNumMatch[1];

      // Inspect what immediately follows cursor: must be end/whitespace OR matching unit suffix (like `mi` in `0.62|mi`)
      let afterUnitDef = null;
      if (after !== '' && !/^[ \t]/.test(after)) {
        const afterUnitMatch = after.match(/^([a-zA-ZµμΩ°]+)(?=$|[ \t])/);
        if (!afterUnitMatch) return empty;
        afterUnitDef = unitEngine.lookup(afterUnitMatch[1]);
        if (!afterUnitDef) return empty;
      }

      const found = findLongestSuffixTokens(lhsSegment, unitEngine);
      if (!found) return empty;

      const neededPrec = Math.max(100, rhsTyped.replace(/[-+.]/g, '').length + 48);
      const altAngle = angleMode === 'rad' ? 'deg' : 'rad';

      const evalPrimary = evaluateTokens(found.tokens, {
        unitEngine,
        angleMode,
        precision: neededPrec,
      });
      if (!evalPrimary) return empty;

      const targetDecimals = [];

      if (evalPrimary.hasUnits) {
        if (afterUnitDef) {
          // Convert SI value directly into the unit immediately after the cursor (e.g. `mi` in `0.62|mi`)
          const coeff = unitEngine.getUnitCoeff(afterUnitDef, evalPrimary.D, evalPrimary.getPi);
          targetDecimals.push(evalPrimary.val.div(coeff));
        } else if (evalPrimary.targetUnitSpec) {
          targetDecimals.push(evalPrimary.val.div(evalPrimary.targetUnitSpec.coeff));
        } else {
          const reps = unitEngine.resolveDisplayUnits({
            siValue: evalPrimary.val,
            dims: evalPrimary.dims,
            isAngle: evalPrimary.isAngle,
            preferredSystem: unitSystem,
            expStyle: evalPrimary.expStyle,
            hadUnitSpace: evalPrimary.hadUnitSpace,
            usedVolumetric: evalPrimary.usedVolumetric,
            hintUnit: evalPrimary.hintUnit,
            D: evalPrimary.D,
            getPiFn: evalPrimary.getPi,
          });
          for (const r of reps) targetDecimals.push(r.value);
        }
      } else {
        targetDecimals.push(evalPrimary.val);
        if (evalPrimary.usedAngleMode) {
          const evalAlt = evaluateTokens(found.tokens, {
            unitEngine,
            angleMode: altAngle,
            precision: neededPrec,
          });
          if (evalAlt) targetDecimals.push(evalAlt.val);
        }
      }

      for (const targetDec of targetDecimals) {
        const cont = solvePrecisionContinuation(targetDec, rhsTyped);
        if (cont) {
          logger.log('continue', `${found.exprText} = ${rhsTyped} -> "${cont.insertText}" (del ${cont.deleteBefore})`);
          return {
            candidates: [
              makeCandidate({
                insertText: cont.insertText,
                deleteBefore: cont.deleteBefore,
                allowInline: true,
              }),
            ],
            compatibleUnits: [],
            activeUnitSymbol: null,
            exprKey: `cont:${found.exprText}:${rhsTyped}`,
          };
        }
      }

      return empty;
    }

    // Subcase 1C: Completed value + unit on RHS (`1km -> mi = 0.62mi|`) -> do NOT re-autocomplete!
    if (/^[ \t]*[-+]?(?:\d+\.?\d*|\.\d+)[ \t]*[a-zA-ZµμΩ°][a-zA-Z0-9µμΩ°*^·/-]*[ \t]*$/.test(rhsSegment)) {
      return empty;
    }

    // Subcase 1D: RHS itself is a new calculation (e.g. `total = 1 + 1` or `1+1=2 + 3`)
    if (after !== '' && (!/^[ \t]/.test(after) || /^[ \t]*=/.test(after))) {
      return empty;
    }
    const foundRhs = findLongestSuffixTokens(rhsSegment, unitEngine);
    if (!foundRhs || foundRhs.trailingSpaces.length > 0) return empty;

    return buildEvaluationSuggestions({
      found: foundRhs,
      hasEquals: false,
      prefixBeforeValue: null,
      extraCharsAfterExprToCursor: 0,
      allowInline: !isBulletLine,
      unitEngine,
      angleMode,
      unitSystem,
      dropdownUnitOverride,
    });
  }

  // =========================================================================
  // CASE 2: No `=` yet on the working line (`1+1`, `other text 1+1`, `1km -> mi`, `- 1+1`)
  // =========================================================================
  if (after !== '' && (!/^[ \t]/.test(after) || /^[ \t]*=/.test(after))) {
    return empty;
  }

  // Special check: trailing whitespace is ONLY allowed when user just typed `to ` or `-> ` (`1 km -> |`)
  const hasTrailingSpace = /[ \t]$/.test(workingBefore);
  const found = findLongestSuffixTokens(workingBefore, unitEngine);
  if (!found) return empty;

  const probe = evaluateTokens(found.tokens, { unitEngine, angleMode, precision: 64 });
  if (!probe) return empty;

  if (hasTrailingSpace && !probe.incompleteConversion) {
    return empty;
  }

  return buildEvaluationSuggestions({
    found,
    hasEquals: false,
    prefixBeforeValue: null,
    extraCharsAfterExprToCursor: found.trailingSpaces.length,
    allowInline: !isBulletLine,
    unitEngine,
    angleMode,
    unitSystem,
    dropdownUnitOverride,
  });
}

function buildEvaluationSuggestions({
  found,
  hasEquals,
  prefixBeforeValue,
  extraCharsAfterExprToCursor,
  allowInline,
  unitEngine,
  angleMode,
  unitSystem,
  dropdownUnitOverride,
}) {
  const empty = {
    candidates: [],
    compatibleUnits: [],
    activeUnitSymbol: null,
    exprKey: '',
  };

  const altAngle = angleMode === 'rad' ? 'deg' : 'rad';
  const resPrimary = evaluateTokens(found.tokens, { unitEngine, angleMode, precision: 80 });
  if (!resPrimary) return empty;

  // Reject trivial standalone expressions when `=` was NOT typed (e.g., `1|` or `pi` without `=`)
  if (!hasEquals && !resPrimary.hasWork && !resPrimary.hasUnits) {
    return empty;
  }

  // Determine `=` formatting prefix when `hasEquals === false`
  const pad = resPrimary.hasWork
    ? (resPrimary.lastTopOpSpaceAfter ?? '')
    : (resPrimary.hadUnitSpace ? ' ' : '');
  const eqPrefix = hasEquals ? prefixBeforeValue : `${pad}=${pad}`;

  // =========================================================================
  // Branch A: Incomplete Explicit Unit Conversion (`1 km -> ` or `1 km to `)
  // =========================================================================
  if (resPrimary.incompleteConversion) {
    if (!resPrimary.hasUnits) return empty;
    const compat = unitEngine.getCompatibleUnits(resPrimary.dims, resPrimary.isAngle);
    if (compat.length === 0) return empty;

    const reps = unitEngine.resolveDisplayUnits({
      siValue: resPrimary.val,
      dims: resPrimary.dims,
      isAngle: resPrimary.isAngle,
      preferredSystem: unitSystem === 'metric' ? 'imperial' : 'metric', // Suggest cross-system first on `1km -> `
      expStyle: resPrimary.expStyle,
      hadUnitSpace: false,
      usedVolumetric: resPrimary.usedVolumetric,
      hintUnit: resPrimary.hintUnit,
      D: resPrimary.D,
      getPiFn: resPrimary.getPi,
    });

    const spaceNeed = extraCharsAfterExprToCursor > 0 ? '' : ' ';
    const outEq = extraCharsAfterExprToCursor > 0 ? ' = ' : '= ';
    const candidates = [];

    if (dropdownUnitOverride) {
      const uDef = unitEngine.lookup(dropdownUnitOverride);
      if (uDef) {
        const val = resPrimary.val.div(unitEngine.getUnitCoeff(uDef, resPrimary.D, resPrimary.getPi));
        const fmt = formatDecimalPreview(val);
        const ins = `${spaceNeed}${uDef.symbol}${extraCharsAfterExprToCursor > 0 ? ' = ' : '='}${fmt.primary}${uDef.symbol}`;
        candidates.push(
          makeCandidate({
            insertText: ins,
            allowInline,
            unitSymbol: uDef.symbol,
          })
        );
      }
    }

    for (const r of reps) {
      if (candidates.some((c) => c.unitSymbol === r.symbol)) continue;
      const fmt = formatDecimalPreview(r.value);
      const ins = `${spaceNeed}${r.symbol}${extraCharsAfterExprToCursor > 0 ? ' = ' : '='}${fmt.primary}${r.sep}${r.symbol}`;
      candidates.push(
        makeCandidate({
          insertText: ins,
          allowInline,
          unitSystem: r.system === 'metric' || r.system === 'imperial' ? r.system : null,
          unitSymbol: r.symbol,
        })
      );
    }

    return {
      candidates,
      compatibleUnits: compat.map((u) => u.symbol),
      activeUnitSymbol: candidates[0]?.unitSymbol || compat[0].symbol,
      exprKey: `incomp:${found.exprText}`,
    };
  }

  // =========================================================================
  // Branch B: Expression with Units (`1kg + 2kg = `, `1km -> mi`, `1kg * 1m**2 / 1s**2 = `)
  // =========================================================================
  if (resPrimary.hasUnits) {
    const compat = unitEngine.getCompatibleUnits(resPrimary.dims, resPrimary.isAngle);
    const candidates = [];

    // B1. Explicit conversion (`1km -> mi` or `0.1kg + 0.1kg to kg = `)
    if (resPrimary.targetUnitSpec) {
      const spec = resPrimary.targetUnitSpec;

      // Did the user select an alternative unit from the bottom-bar dropdown?
      if (dropdownUnitOverride && dropdownUnitOverride !== spec.symbol) {
        const overDef = unitEngine.lookup(dropdownUnitOverride);
        if (overDef) {
          const overCoeff = unitEngine.getUnitCoeff(overDef, resPrimary.D, resPrimary.getPi);
          const overVal = resPrimary.val.div(overCoeff);
          const fmt = formatDecimalPreview(overVal);
          // Replace from the start of the explicit target unit (`mi` in `1km -> mi` or `kg = ` in `... to kg = `)
          const charsInTargetUnit = found.exprText.length - spec.startCharOffset;
          const deleteBefore = charsInTargetUnit + extraCharsAfterExprToCursor;
          const eqStr = hasEquals ? `${found.trailingSpaces}=${prefixBeforeValue ? prefixBeforeValue : found.trailingSpaces}` : eqPrefix;
          const ins = `${overDef.symbol}${eqStr}${fmt.primary}${overDef.symbol}`;

          candidates.push(
            makeCandidate({
              insertText: ins,
              deleteBefore,
              allowInline,
              unitSymbol: overDef.symbol,
            })
          );
        }
      }

      const convVal = resPrimary.val.div(spec.coeff);
      const fmt = formatDecimalPreview(convVal);
      const mainIns = `${eqPrefix}${fmt.primary}${spec.symbol}`;
      candidates.push(
        makeCandidate({
          insertText: mainIns,
          allowInline,
          unitSymbol: spec.symbol,
        })
      );

      if (fmt.scientificAlt) {
        candidates.push(
          makeCandidate({
            insertText: `${eqPrefix}${fmt.scientificAlt}${spec.symbol}`,
            allowInline,
            unitSymbol: spec.symbol,
          })
        );
      }

      logger.log('unit-convert', `${found.exprText} -> ${fmt.primary}${spec.symbol}`);
      return {
        candidates,
        compatibleUnits: compat.map((u) => u.symbol),
        activeUnitSymbol: dropdownUnitOverride || spec.symbol,
        exprKey: `conv:${found.exprText}:${hasEquals}`,
      };
    }

    // B2. General unit arithmetic or normalization (`1kg + 2kg = `, `40oz`, `1kg * 1m**2 / 1s**2 = `)
    const reps = unitEngine.resolveDisplayUnits({
      siValue: resPrimary.val,
      dims: resPrimary.dims,
      isAngle: resPrimary.isAngle,
      preferredSystem: unitSystem,
      expStyle: resPrimary.expStyle,
      hadUnitSpace: resPrimary.hadUnitSpace,
      usedVolumetric: resPrimary.usedVolumetric,
      hintUnit: resPrimary.hintUnit,
      D: resPrimary.D,
      getPiFn: resPrimary.getPi,
    });

    // Standalone single-literal unit without `=` (e.g. `1500 g`, `40oz`, vs already-normalized `5km` in prose)
    const isStandaloneLiteral = !hasEquals && !resPrimary.hasWork;
    const normalizedInputText = found.exprText.replace(/\s+/g, '');

    if (dropdownUnitOverride) {
      const overDef = unitEngine.lookup(dropdownUnitOverride);
      if (overDef) {
        const overCoeff = unitEngine.getUnitCoeff(overDef, resPrimary.D, resPrimary.getPi);
        const overVal = resPrimary.val.div(overCoeff);
        const fmt = formatDecimalPreview(overVal);
        const valUnit = `${fmt.primary}${overDef.symbol}`;
        if (!isStandaloneLiteral || valUnit !== normalizedInputText) {
          candidates.push(
            makeCandidate({
              insertText: `${eqPrefix}${valUnit}`,
              allowInline,
              unitSymbol: overDef.symbol,
            })
          );
        }
      }
    }

    let primarySameSystemChanged = false;
    for (let idx = 0; idx < reps.length; idx++) {
      const r = reps[idx];
      if (!r) continue;
      if (candidates.some((c) => c.unitSymbol === r.symbol)) continue;

      // Apply small-perturbation check on SI majorAddend scaled into display unit
      let scaledMajor = null;
      if (resPrimary.topAddSubMajor && !resPrimary.val.isZero()) {
        const unitScale = resPrimary.val.div(r.value);
        if (!unitScale.isZero()) {
          scaledMajor = resPrimary.topAddSubMajor.div(unitScale);
        }
      }

      const fmt = formatDecimalPreview(r.value, { majorAddend: scaledMajor });
      const valUnit = `${fmt.primary}${r.sep}${r.symbol}`;

      if (isStandaloneLiteral && valUnit.replace(/\s+/g, '') === normalizedInputText) {
        continue;
      }

      if (idx === 0) primarySameSystemChanged = true;

      candidates.push(
        makeCandidate({
          insertText: `${eqPrefix}${valUnit}`,
          allowInline: isStandaloneLiteral ? allowInline && primarySameSystemChanged : allowInline,
          unitSystem: r.system === 'metric' || r.system === 'imperial' ? r.system : null,
          unitSymbol: r.symbol,
        })
      );

      if (idx === 0 && fmt.scientificAlt) {
        candidates.push(
          makeCandidate({
            insertText: `${eqPrefix}${fmt.scientificAlt}${r.sep}${r.symbol}`,
            allowInline,
            unitSymbol: r.symbol,
          })
        );
      }
    }

    if (candidates.length === 0) return empty;

    logger.log('unit-eval', `${found.exprText} -> ${candidates.map((c) => c.insertText.trim()).join(' | ')}`);
    return {
      candidates,
      compatibleUnits: compat.map((u) => u.symbol),
      activeUnitSymbol: candidates[0]?.unitSymbol || null,
      exprKey: `unit:${found.exprText}:${hasEquals}`,
    };
  }

  // =========================================================================
  // Branch C: Dimensionless Pure Math (`1+1`, `sin(30)=`, `pi=`, `1/7=`, `pi + 0.000001 = `)
  // =========================================================================
  let resAlt = null;
  let angleAffectsResult = false;

  if (resPrimary.usedAngleMode) {
    resAlt = evaluateTokens(found.tokens, { unitEngine, angleMode: altAngle, precision: 80 });
    if (resAlt) {
      const diff = resPrimary.val.minus(resAlt.val).abs();
      angleAffectsResult = diff.gt('1e-50');
    }
  }

  const fmtPrimary = formatDecimalPreview(resPrimary.val, {
    majorAddend: resPrimary.topAddSubMajor,
  });

  const candidates = [];
  candidates.push(
    makeCandidate({
      insertText: `${eqPrefix}${fmtPrimary.primary}`,
      allowInline,
      angleBadge: angleAffectsResult ? angleMode : null,
    })
  );

  if (fmtPrimary.scientificAlt) {
    candidates.push(
      makeCandidate({
        insertText: `${eqPrefix}${fmtPrimary.scientificAlt}`,
        allowInline,
        angleBadge: angleAffectsResult ? angleMode : null,
      })
    );
  }

  if (angleAffectsResult && resAlt) {
    const fmtAlt = formatDecimalPreview(resAlt.val, {
      majorAddend: resAlt.topAddSubMajor,
    });
    const altIns = `${eqPrefix}${fmtAlt.primary}`;
    if (!candidates.some((c) => c.insertText === altIns)) {
      candidates.push(
        makeCandidate({
          insertText: altIns,
          allowInline,
          angleBadge: altAngle,
        })
      );
    }
  }

  logger.log('math-eval', `${found.exprText} -> ${candidates.map((c) => c.insertText.trim()).join(' | ')}`);
  return {
    candidates,
    compatibleUnits: [],
    activeUnitSymbol: null,
    exprKey: `math:${found.exprText}:${hasEquals}`,
  };
}
