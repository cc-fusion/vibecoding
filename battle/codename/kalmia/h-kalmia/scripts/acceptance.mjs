// Acceptance tests from the specification, run directly against the engine.
import { getSuggestions } from "../src/smart/suggest.js";
import { UnitEngine } from "../src/smart/units.js";
import { evaluate } from "../src/smart/mathengine.js";

const engine = new UnitEngine();
let pass = 0, fail = 0;

function sug(input, opts = {}) {
  const caret = input.indexOf("|");
  const text = caret === -1 ? input : input.replace("|", "");
  return getSuggestions(text, caret === -1 ? text.length : caret, {
    engine, system: "metric", angle: "rad", ...opts,
  });
}

function check(input, expected, { rb = 0, chips = null, opts = {}, badges = null } = {}) {
  const r = sug(input, opts);
  const first = r.candidates[0] || null;
  const got = first ? first.insert : null;
  let ok = got === expected && (first ? first.replaceBefore : 0) === rb;
  let why = `insert ${JSON.stringify(got)} (want ${JSON.stringify(expected)}), rb=${first ? first.replaceBefore : "-"} (want ${rb})`;
  if (ok && chips) {
    const labels = r.candidates.map((c) => c.label);
    ok = chips.every((c, i) => labels[i] === c) && labels.length === chips.length;
    why += ` chips=${JSON.stringify(labels)} (want ${JSON.stringify(chips)})`;
  }
  if (ok && badges) {
    const bs = r.candidates.map((c) => c.badge);
    ok = badges.every((b, i) => bs[i] === b);
    why += ` badges=${JSON.stringify(bs)}`;
  }
  if (ok) { pass++; console.log(`  ✓ ${JSON.stringify(input)}`); }
  else { fail++; console.log(`  ✗ ${JSON.stringify(input)} → ${why}`); }
}

console.log("whitespace & cursor");
check("1+1|", "=2");
check("1 + 1|", " = 2");
check("1  +  1|", "  =  2");
check("1 +1|", "=2");
check("1+ 1|", " = 2");
check("1|", null);
check("other text 1+1|", "=2");
check("other text 1+1| other text", "=2");
check("text.1+1|", "=1.1");
check("text1+1|", null);
check("1+1+1|", "=3");
check("1+1=|4", null);
check("1+1=|2", null);

console.log("angle mode & functions");
check("sin(30)=|", "-0.988", { chips: ["-0.988", "0.5"], badges: ["rad", "deg"] });
check("sin(30)=|", "0.5", { chips: ["0.5", "-0.988"], badges: ["deg", "rad"], opts: { angle: "deg" } });
check("sin 30=|", "-0.988");
check("sin(30 deg)=|", "0.5", { chips: ["0.5"] });
check("sin(30 rad)=|", "-0.988", { chips: ["-0.988"] });
check("sin(0)=|", "0", { chips: ["0"] });

console.log("rounding & precision continuation");
check("1/7=|", "0.1429");
check("pi=|", "3.142");
check("pi=3.142|", "15", { rb: 1 });
check("pi=3.1415|", "9");
check("1/sqrt 2=0.7|", "0");
check("1/sqrt 2=0.70|", "7");
check("1+1=|", "2");
check("-1+1|", "=0");
check("-1+1=|", "0");
check("0.1 + 0.2 = |", "0.3");
check("pi + 0.001 = |", "3.143");
check("pi + 0.000001 = |", "3.141593");
check("1+1=2|", null);
check("1+1=2.|", null);

console.log("long constants beyond 1000 digits");
{
  const pi = evaluate("pi", { engine, precision: 1200 }).value.toFixed(1100);
  const typed = pi.slice(0, 1052); // "3." + 1050 decimals
  const next = pi[1052];
  check(`pi=${typed}|`, next);
  const pi50 = "3.14159265358979323846264338327950288419716939937510";
  if (!pi.startsWith(pi50)) { fail++; console.log("  ✗ pi digits wrong:", pi.slice(0, 52)); } else { pass++; console.log("  ✓ pi first 50 digits"); }
  const sq = evaluate("sqrt 2", { engine, precision: 1200 }).value.toFixed(1100);
  const sq50 = "1.41421356237309504880168872420969807856967187537694";
  if (!sq.startsWith(sq50)) { fail++; console.log("  ✗ sqrt2 digits wrong:", sq.slice(0, 52)); } else { pass++; console.log("  ✓ sqrt2 first 50 digits"); }
  const typedSq = sq.slice(0, 1048);
  check(`sqrt 2=${typedSq}|`, sq[1048]);
}

console.log("scientific notation thresholds");
check("10**5|", "=100000", { chips: ["=100000", "=1e5"] });
check("10**-5|", "=0.00001", { chips: ["=0.00001", "=1e-5"] });
check("10**4|", "=10000", { chips: ["=10000"] });
check("10**1001|", "=1e1001", { chips: ["=1e1001"] });
check("10**-1001|", "=1e-1001", { chips: ["=1e-1001"] });

console.log("units");
check("1kg + 2kg = |", "3kg", { chips: ["3kg", "6.614lbs"] });
check("1kg + 2kg = |", "6.614lbs", { chips: ["6.614lbs", "3kg"], opts: { system: "imperial" } });
check("1kg + 2000g = |", "3kg");
check("0.1kg + 0.1kg = |", "200g");
check("1000kg + 1000g = |", "1001kg");
check("0.1kg + 0.1kg to kg = |", "0.2kg");
check("10**-6 kg = |", "1mg");
check("1km + 1pm = |", "1km");
check("1km to mi|", " = 0.6214mi");
check("1km -> mi|", " = 0.6214mi");
check("1km -> mi = 0.62|mi", "1");
check("1km -> mi = 0.62mi|", null);
check("1km * 2 = |", "2km");
check("1km + 2|", null);
check("1kg * 1m**2 / 1s**2 = |", "1J");
check("1 kg m2 s-2 * 2 = |", "2J");
check("1 kg2 * 2kg = |", "2 kg3");
check("2m**2 * 1 = |", "2m**2");
check("40oz|", " = 2.5lbs", { opts: { system: "imperial" } });
check("1500 g|", " = 1.5kg");

console.log("extra regressions");
check("1/7=0|", ".");
check("pi=3|", ".");
check("pi=3.|", "1");
check("sin(30)=-0.988|", "0");
check("1km -> mi = 0.6214|mi", "37", { rb: 1 });
check("2m2 * 1 = |", "2m2");
check("1/0|", null);
check("sqrt(-1)|", null);
check("40oz|", " = 1.134kg", { chips: [" = 1.134kg", " = 2.5lbs"] });
check("hello = |", null);
check("1+1=2 and more|", null);
{
  // dropdown override: switch a suggested unit
  const r1 = sug("1km + 1pm = |");
  const key = r1.key;
  const r2 = sug("1km + 1pm = |", { targetOverride: { key, expr: "ft" } });
  const got = r2.candidates[0]?.insert;
  if (got === "3281ft") { pass++; console.log("  ✓ dropdown override → 3281ft"); }
  else { fail++; console.log("  ✗ dropdown override →", got); }
  if (r1.dropdown && r1.dropdown.options.some((o) => o.expr === "mi")) { pass++; console.log("  ✓ dropdown lists mi"); }
  else { fail++; console.log("  ✗ dropdown missing options"); }
}

console.log("implicit multiplication & constants");
check("2pi|", " = 6.283");
check("2(3+4)|", "=14");
check("(1+2)(3+4)|", "=21");
check("pi|", " = 3.142");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
