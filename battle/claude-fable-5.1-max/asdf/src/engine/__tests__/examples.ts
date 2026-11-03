/* Acceptance tests derived from the specification examples. Run with: npx tsx src/engine/__tests__/examples.ts */
import { pi, decimalWithPrecision } from "../decimal";
import { suggest, type SuggestSettings } from "../suggest";
import { UnitRegistry } from "../units";
import { DEFAULT_UNITS } from "../unitsData";

const registry = new UnitRegistry(DEFAULT_UNITS);

interface Case {
  input: string; // '|' marks the cursor (default: end)
  inline: string | null; // expected inline completion text
  bar?: string[]; // expected leading bar labels (chip labels)
  settings?: Partial<SuggestSettings>;
  override?: string;
  name?: string;
}

const base: SuggestSettings = { system: "metric", angle: "rad", inlineEnabled: true };

function run(c: Case) {
  let cursor = c.input.indexOf("|");
  let line = c.input;
  if (cursor >= 0) line = c.input.slice(0, cursor) + c.input.slice(cursor + 1);
  else cursor = c.input.length;
  const res = suggest({ line, cursor, settings: { ...base, ...c.settings }, registry, unitOverride: c.override ?? null });
  const inline = res && res.inline ? res.items[0].text : null;
  const bar = res ? res.items.map((i) => i.label) : [];
  const problems: string[] = [];
  if (inline !== c.inline) problems.push(`inline: expected ${JSON.stringify(c.inline)} got ${JSON.stringify(inline)}`);
  if (c.bar) {
    for (let i = 0; i < c.bar.length; i++) {
      if (bar[i] !== c.bar[i]) problems.push(`bar[${i}]: expected ${JSON.stringify(c.bar[i])} got ${JSON.stringify(bar[i])}`);
    }
  } else if (c.inline === null && res) {
    problems.push(`expected no suggestions, got ${JSON.stringify(bar)}`);
  }
  return { problems, bar, inline, items: res?.items };
}

const piStr = pi(1100).toFixed(1090);
const piTyped = piStr.slice(0, 1005);
const piNext = piStr[1005];
const sqrt2 = decimalWithPrecision(1100).sqrt(2).toFixed(1090);
const sqrt2Typed = sqrt2.slice(0, 1012);
const sqrt2Next = sqrt2[1012];

const cases: Case[] = [
  { input: "1+1", inline: "=2", bar: ["=2"] },
  { input: "1 + 1", inline: " = 2", bar: ["= 2"] },
  { input: "1  +  1", inline: "  =  2" },
  { input: "1 +1", inline: "=2" },
  { input: "1+ 1", inline: " = 2" },
  { input: "1|", inline: null },
  { input: "other text 1+1| other text", inline: "=2" },
  { input: "text.1+1=", inline: "1.1" },
  { input: "text1+1|", inline: null },
  { input: "1+1+1", inline: "=3" },
  { input: "1+1=|4", inline: null },
  { input: "1+1=|2", inline: null },
  { input: "sin(30)=", inline: "-0.988", bar: ["-0.988", "0.5"] },
  { input: "sin(30)=", inline: "0.5", bar: ["0.5", "-0.988"], settings: { angle: "deg" }, name: "degrees selected" },
  { input: "sin 30=", inline: "-0.988", bar: ["-0.988", "0.5"] },
  { input: "1/7=", inline: "0.1429" },
  { input: "pi=", inline: "3.142" },
  { input: "pi=3.142", inline: "15" },
  { input: "pi=3.1415", inline: "9" },
  { input: "1/sqrt 2=0.7", inline: "0" },
  { input: "1/sqrt 2=0.70", inline: "7" },
  { input: `pi=${piTyped}`, inline: piNext, name: "pi beyond 1000 digits" },
  { input: `sqrt 2=${sqrt2Typed}`, inline: sqrt2Next, name: "sqrt 2 beyond 1000 digits" },
  { input: "sin(30 deg)=", inline: "0.5", bar: ["0.5"] },
  { input: "sin(30 rad)=", inline: "-0.988", bar: ["-0.988"] },
  { input: "- 1+1", inline: null, bar: ["=2"] },
  { input: "- 1+1=", inline: "2" },
  { input: "-1+1", inline: "=0" },
  { input: "-1+1=", inline: "0" },
  { input: "0.1 + 0.2 = ", inline: "0.3" },
  { input: "pi + 0.001 = ", inline: "3.143" },
  { input: "pi + 0.000001 = ", inline: "3.141593" },
  { input: "1kg + 2kg = ", inline: "3kg", bar: ["3kg", "6.614lbs"] },
  { input: "1kg + 2kg = ", inline: "6.614lbs", bar: ["6.614lbs", "3kg"], settings: { system: "imperial" } },
  { input: "1kg + 2000g = ", inline: "3kg" },
  { input: "0.1kg + 0.1kg = ", inline: "200g" },
  { input: "1000kg + 1000g = ", inline: "1001kg" },
  { input: "0.1kg + 0.1kg to kg = ", inline: "0.2kg" },
  { input: "10**-6 kg = ", inline: "1mg" },
  { input: "1km + 1pm = ", inline: "1km" },
  { input: "1km to mi", inline: " = 0.6214mi" },
  { input: "1km -> mi", inline: " = 0.6214mi" },
  { input: "1km -> mi = 0.62|mi", inline: "1" },
  { input: "1km -> mi = 0.62mi|", inline: null },
  { input: "1km * 2 = ", inline: "2km" },
  { input: "1km + 2|", inline: null },
  { input: "1kg * 1m**2 / 1s**2 = ", inline: "1J" },
  { input: "1 kg m2 s-2 * 2 = ", inline: "2J" },
  { input: "1 kg2 * 2kg = ", inline: "2 kg3" },
  { input: "2m**2 * 1 = ", inline: "2m**2" },
  // extra sanity checks
  { input: "1500 g", inline: " = 1.5kg", bar: ["= 1.5kg", "= 3.307lbs"] },
  { input: "40oz", inline: "=2.5lbs", bar: ["=2.5lbs", "=1.134kg"] },
  { input: "1km -> ", inline: "mi = 0.6214mi" },
  { input: "1km -> f", inline: "t = 3281ft" },
  { input: "1km to mi", inline: "ft = 3281ft", override: "ft", name: "override replaces explicit target" },
  { input: "1kg + 2kg = ", inline: "105.8oz", override: "oz", name: "override on plain result" },
  { input: "2**100", inline: "=1267650600228229401496703205376", bar: ["=1267650600228229401496703205376", "=1.268e30"] },
  { input: "1/30000", inline: "=0.00003333", bar: ["=0.00003333", "=3.333e-5"] },
  { input: "10**1000 * 10", inline: " = 1e1001", bar: ["= 1e1001"] },
  { input: "100 km/h * 2 = ", inline: "200 km/h", bar: ["200 km/h", "124.3mph"] },
  { input: "2 pi", inline: " = 6.283" },
  { input: "e", inline: "=2.718" },
  { input: "sin 30 * 2 = ", inline: "-1.976", bar: ["-1.976", "1"] },
  { input: "5 m + 3", inline: null },
  { input: "3 h + 30 min = ", inline: "3.5h" },
  { input: "72 °F to °C = ", inline: "22.22°C" },
  { input: "1 ft in m", inline: " = 0.3048m" },
  { input: "5 in + 2 in = ", inline: "17.78cm", bar: ["17.78cm", "7in"] },
  { input: "2 cups to mL = ", inline: "473.2mL" },
  { input: "(1+1", inline: "=2" },
  { input: "1,000 + 1", inline: " = 1001" },
  { input: "x = 1+1", inline: "=2" },
  { input: "1 + 1 = 2 + 3", inline: " = 5" },
  { input: "sqrt(16 m2) = ", inline: "4m" },
  { input: "1 kg·m²/s² = ", inline: "1J" },
  { input: "kg to lb", inline: " = 2.205lbs" },
  { input: "5 pm - 2 pm = ", inline: "3pm" },
  { input: "0.5 h = ", inline: "0.5h" },
  { input: "1 ft * 2 ft = ", inline: "2 ft2", settings: { system: "imperial" } },
  { input: "1/0", inline: null },
  { input: "The meeting is at 3 - 4", inline: " = -1" },
  { input: "10 m / 2 s = ", inline: "5 m/s" },
  { input: "5 ft + 6 in = ", inline: "1.676m", bar: ["1.676m", "5.5ft"] },
  { input: "20 degC to degF = ", inline: "68degF" },
  { input: "1+1 ", inline: "= 2" },
  { input: "1 + 1 = ", inline: "2" },
  { input: "12*12=14", inline: "4" },
  { input: "12*12=144", inline: null },
  { input: "I have 2 apples + 3 oranges", inline: null },
  { input: "at 5 pm", inline: null },
  { input: "2(3+4)", inline: "=14" },
  { input: "3! + 1", inline: " = 7" },
  { input: "50% * 80", inline: " = 40" },
  { input: "1kg + 2kg = 3", inline: "kg" },
  { input: "asin(0.5)=", inline: "0.5236", bar: ["0.5236", "30"] },
  { input: "1 A * 1 h = ", inline: "1Ah" },
  { input: "30 deg + 45 deg = ", inline: "75deg", bar: ["75deg", "1.309rad"] },
  { input: "1e3 + 1", inline: " = 1001" },
];

let failed = 0;
for (const c of cases) {
  const t0 = Date.now();
  const r = run(c);
  const dt = Date.now() - t0;
  const label = c.name ?? c.input.slice(0, 60);
  if (r.problems.length) {
    failed++;
    console.log(`FAIL  ${label}`);
    for (const p of r.problems) console.log(`      ${p}`);
    console.log(`      items: ${JSON.stringify(r.items?.map((i) => [i.text, i.replaceBefore, i.badge]))}`);
  } else {
    console.log(`ok    ${label}  ${JSON.stringify(r.bar)}${dt > 50 ? ` (${dt}ms)` : ""}`);
  }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
