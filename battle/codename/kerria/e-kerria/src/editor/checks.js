import { getSuggestions } from './suggestions.js';
import { defaultUnits, validateUnits } from './units.js';
import { formatNumber, highPrecisionPi, truncatedNumber } from './math.js';
import Decimal from 'decimal.js';

export function runChecks() {
  const registry = defaultUnits();
  const results = [];
  const check = (name, actual, expected) => results.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
  const suggest = (input, settings = {}) => {
    const cursor = input.includes('|') ? input.indexOf('|') : input.length;
    return getSuggestions(input.replace('|', ''), cursor, settings, registry);
  };
  const primary = (input, settings) => suggest(input, settings)?.candidates[0]?.fullText ?? null;
  const cases = [
    ['1+1', '= 2'], ['1 + 1', ' = 2'], ['1  +  1', '  =  2'], ['1 +1', '= 2'], ['1+ 1', '= 2'],
    ['1', null], ['other text 1+1', '= 2'], ['text.1+1', '= 1.1'], ['text1+1', null], ['1+1+1', '= 3'],
    ['1+1=|4', '2'], ['1+1=|2', null], ['sin(30)', '= -0.988'], ['sin 30', '= -0.988'], ['1/7', '= 0.1429'],
    ['pi', '= 3.142'], ['pi=3.142', '15'], ['pi=3.1415', '9'], ['1/sqrt 2=0.7', '0'], ['1/sqrt 2=0.70', '7'],
    ['sin(30 deg)', '= 0.5'], ['sin(30 rad)', '= -0.988'], ['-1+1', '= 0'], ['-1+1=', '0'],
    ['0.1 + 0.2 = ', '0.3'], ['pi + 0.001 = ', '3.143'], ['pi + 0.000001 = ', '3.141593'],
    ['1kg + 2kg = ', '3kg'], ['1kg + 2000g = ', '3kg'], ['0.1kg + 0.1kg = ', '200g'], ['1000kg + 1000g = ', '1001kg'],
    ['0.1kg + 0.1kg to kg = ', '0.2kg'], ['10**-6 kg = ', '1mg'], ['1km + 1pm = ', '1km'],
    ['1km to mi', '=0.6214mi'], ['1km -> mi', '=0.6214mi'], ['1km -> mi = 0.62|mi', '1'], ['1km -> mi = 0.62mi|', null],
    ['1km * 2 = ', '2km'], ['1km + 2', null], ['1kg * 1m**2 / 1s**2 = ', '1J'], ['1 kg m2 s-2 * 2 = ', '2J'],
    ['1 kg2 * 2kg = ', '2 kg3'], ['2m**2 * 1 = ', '2m**2'], ['1500 g = ', '1.5kg'], ['40oz = ', '2.5lbs', { units: 'imperial' }],
    ['1kg + 2kg = ', '6.614lbs', { units: 'imperial' }], ['sin(30)', '= 0.5', { angle: 'deg' }],
    ['(2 + 3) * 4', ' = 20'], ['2pi', '= 6.283'], ['sqrt(9)', '= 3'], ['2^3^2', '= 512'], ['5!', '= 120'],
    ['ln(e)', '= 1'], ['log(100)', '= 2'], ['log2(8)', '= 3'], ['abs(-4)', '= 4'], ['100000', null],
    ['hello world', null], ['1 km -> mi = 0.62mi|', null],
  ];
  for (const [input, expected, settings] of cases) check(input, primary(input, settings), expected);
  check('Imperial alternative', suggest('1kg + 2kg = ')?.candidates[1]?.fullText, '6.614lbs');
  check('Metric alternative', suggest('1kg + 2kg = ', { units: 'imperial' })?.candidates[1]?.fullText, '3kg');
  check('Degree alternative', suggest('sin(30)')?.candidates[1]?.fullText, '= 0.5');
  check('Angle badges', suggest('sin(30)')?.candidates.map(c => c.badge), ['rad', 'deg']);
  check('Explicit angle has no mode badge', suggest('sin(30 deg)')?.candidates.map(c => c.badge), ['']);
  check('Targeted replacement range', (() => { const c = suggest('pi=3.142')?.candidates[0]; return [c?.start, c?.end]; })(), [7, 8]);
  check('Existing answer replacement range', (() => { const c = suggest('1+1=|4')?.candidates[0]; return [c?.start, c?.end]; })(), [4, 5]);
  check('Significant-digit rounding', formatNumber('1.2345', 4), '1.235');
  check('Rounding carries', formatNumber('9.9999', 4), '10');
  check('Decimal notation at threshold', primary('10**4'), '= 10000');
  check('Scientific alternative above threshold', suggest('10**5')?.candidates[1]?.fullText, '= 1e+5');
  check('Decimal notation at small threshold', primary('10**-4'), '= 0.0001');
  check('Scientific alternative below threshold', suggest('10**-5')?.candidates[1]?.fullText, '= 1e-5');
  check('Exclusive scientific notation, large', primary('10**1001'), '= 1e+1001');
  check('Exclusive scientific notation, small', primary('10**-1001'), '= 1e-1001');
  check('Long previews are truncated', suggest('10**500')?.candidates[0]?.text.endsWith('...'), true);
  check('Conversion dropdown has compatible units', suggest('1km to mi')?.context.unitOptions.every(u => u.dimension.m === 1 && Object.entries(u.dimension).every(([k, v]) => k === 'm' || v === 0)), true);
  const longPi = truncatedNumber(highPrecisionPi(1150), 1100);
  const piResult = suggest('pi=' + longPi);
  check('Pi continues beyond 1,000 digits', piResult?.candidates[0]?.fullText.length, 1);
  check('Pi continuation is the next digit', piResult?.candidates[0]?.fullText, truncatedNumber(highPrecisionPi(1150), 1101).slice(-1));
  const C = Decimal.clone({ precision: 1150 });
  const longSqrt = truncatedNumber(C.sqrt(2), 1100);
  const sqrtResult = suggest('sqrt 2=' + longSqrt);
  check('Square root continues beyond 1,000 digits', sqrtResult?.candidates[0]?.fullText, truncatedNumber(C.sqrt(2), 1101).slice(-1));
  let invalidRejected = false;
  try { validateUnits({ bad: { factor: -1, dimension: {} } }); } catch { invalidRejected = true; }
  check('Invalid unit definitions are rejected', invalidRejected, true);
  return { passed: results.filter(r => r.pass).length, total: results.length, results };
}
