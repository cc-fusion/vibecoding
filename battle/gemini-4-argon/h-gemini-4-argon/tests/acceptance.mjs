import assert from 'assert';
import Decimal from 'decimal.js';
import { UnitEngine } from '../src/units.js';
import { getPiDecimal } from '../src/mathEngine.js';
import { computeAutocomplete } from '../src/autocomplete.js';

const unitEngine = new UnitEngine();

function runCase(label, rawWithPipe, opts, verifyFn) {
  let cursor = rawWithPipe.indexOf('|');
  let text = rawWithPipe;
  if (cursor !== -1) {
    text = rawWithPipe.slice(0, cursor) + rawWithPipe.slice(cursor + 1);
  } else {
    cursor = text.length;
  }

  const res = computeAutocomplete(text, cursor, { unitEngine, ...opts });
  try {
    verifyFn(res, text, cursor);
    console.log(`✓ ${label}`);
  } catch (err) {
    console.error(`✗ FAILED: ${label}`);
    console.error('  Input:', JSON.stringify(rawWithPipe), 'cursor:', cursor);
    console.error('  Result:', JSON.stringify(res, null, 2));
    throw err;
  }
}

function expectInline(label, input, expectedInline, expectedSecondChip = null, opts = {}) {
  runCase(label, input, opts, (res) => {
    assert.ok(res.candidates.length >= 1, `Expected at least 1 candidate, got 0`);
    const first = res.candidates[0];
    assert.strictEqual(first.allowInline, true, `Expected allowInline=true`);
    assert.strictEqual(first.insertText, expectedInline);
    if (expectedSecondChip !== null) {
      assert.ok(res.candidates.length >= 2, `Expected at least 2 candidates, got ${res.candidates.length}`);
      assert.strictEqual(res.candidates[1].insertText, expectedSecondChip);
    }
  });
}

function expectBarOnly(label, input, expectedBar, opts = {}) {
  runCase(label, input, opts, (res) => {
    assert.ok(res.candidates.length >= 1, `Expected bar candidate, got 0`);
    const first = res.candidates[0];
    assert.strictEqual(first.allowInline, false, `Expected bar-only (allowInline=false)`);
    assert.strictEqual(first.insertText, expectedBar);
  });
}

function expectNone(label, input, opts = {}) {
  runCase(label, input, opts, (res) => {
    assert.strictEqual(res.candidates.length, 0, `Expected NO completions, got ${JSON.stringify(res.candidates)}`);
  });
}

// === 1. Whitespace & Cursor Positioning ===
expectInline('1+1"=2"', '1+1', '=2');
expectInline('1 + 1" = 2"', '1 + 1', ' = 2');
expectInline('1  +  1"  =  2"', '1  +  1', '  =  2');
expectInline('1 +1"=2"', '1 +1', '=2');
expectInline('1+ 1" = 2"', '1+ 1', ' = 2');
expectNone('1| (no completion)', '1|');
expectInline('other text 1+1|"=2" other text', 'other text 1+1| other text', '=2');
expectInline('text.1+1="1.1"', 'text.1+1=', '1.1');
expectNone('text1+1| (no completion)', 'text1+1|');
expectInline('1+1+1"=3"', '1+1+1', '=3');
expectNone('1+1=|4 (no completion)', '1+1=|4');
expectNone('1+1=|2 (no completion)', '1+1=|2');

// === 2. Angle Mode & Trig Functions ===
runCase('sin(30)=="-0.988"`0.5` (rad default + badges)', 'sin(30)=', { angleMode: 'rad' }, (res) => {
  assert.strictEqual(res.candidates.length, 2);
  assert.strictEqual(res.candidates[0].insertText, '-0.988');
  assert.strictEqual(res.candidates[0].angleBadge, 'rad');
  assert.strictEqual(res.candidates[1].insertText, '0.5');
  assert.strictEqual(res.candidates[1].angleBadge, 'deg');
});

runCase('sin(30)="0.5"`-0.988` (deg selected)', 'sin(30)=', { angleMode: 'deg' }, (res) => {
  assert.strictEqual(res.candidates.length, 2);
  assert.strictEqual(res.candidates[0].insertText, '0.5');
  assert.strictEqual(res.candidates[0].angleBadge, 'deg');
  assert.strictEqual(res.candidates[1].insertText, '-0.988');
  assert.strictEqual(res.candidates[1].angleBadge, 'rad');
});

expectInline('sin 30="-0.988"`0.5`', 'sin 30=', '-0.988', '0.5', { angleMode: 'rad' });

runCase('sin(30 deg)="0.5" (no angle badge when explicit)', 'sin(30 deg)=', { angleMode: 'rad' }, (res) => {
  assert.strictEqual(res.candidates.length, 1);
  assert.strictEqual(res.candidates[0].insertText, '0.5');
  assert.strictEqual(res.candidates[0].angleBadge, null);
});

runCase('sin(30 rad)="-0.988" (no angle badge when explicit)', 'sin(30 rad)=', { angleMode: 'deg' }, (res) => {
  assert.strictEqual(res.candidates.length, 1);
  assert.strictEqual(res.candidates[0].insertText, '-0.988');
  assert.strictEqual(res.candidates[0].angleBadge, null);
});

// === 3. Rounding, Targeted Replacement & Precision Continuation ===
expectInline('1/7="0.1429"', '1/7=', '0.1429');
expectInline('pi="3.142"', 'pi=', '3.142');

runCase('replace 2: pi=3.142"15"', 'pi=3.142', {}, (res, text, cursor) => {
  assert.strictEqual(res.candidates.length, 1);
  const c = res.candidates[0];
  assert.strictEqual(c.deleteBefore, 1);
  assert.strictEqual(c.insertText, '15');
  const accepted = text.slice(0, cursor - c.deleteBefore) + c.insertText + text.slice(cursor);
  assert.strictEqual(accepted, 'pi=3.1415');
});

expectInline('pi=3.1415"9"', 'pi=3.1415', '9');
expectInline('1/sqrt 2=0.7"0"', '1/sqrt 2=0.7', '0');
expectInline('1/sqrt 2=0.70"7"', '1/sqrt 2=0.70', '7');

// >1000-digit Pi & sqrt(2) precision continuation tests!
const piFull = getPiDecimal(1100).toFixed(1050);
const idx1989 = piFull.indexOf('1989');
const piPrefix1000 = piFull.slice(0, idx1989 + 4); // ends with "...1989" at >1000 chars!
assert.ok(piPrefix1000.length > 1000, 'Expected >1000 chars of pi');
expectInline('pi >1000 digits ...1989"3"', `pi=${piPrefix1000}`, '3');

const D1100 = Decimal.clone({ precision: 1100 });
const sq2Full = D1100.sqrt(2).toFixed(1050);
const idx8472 = sq2Full.indexOf('128229518488472');
const sq2Prefix1000 = sq2Full.slice(0, idx8472 + '128229518488472'.length);
assert.ok(sq2Prefix1000.length > 1000, 'Expected >1000 chars of sqrt 2');
expectInline('sqrt 2 >1000 digits ...128229518488472"0"', `sqrt 2=${sq2Prefix1000}`, '0');

// === 4. Bullet Minus vs Unary Minus & Decimals ===
expectBarOnly('- 1+1`=2` (bar only, no inline)', '- 1+1', '=2');
expectInline('- 1+1="2"', '- 1+1=', '2');
expectInline('-1+1"=0"', '-1+1', '=0');
expectInline('-1+1="0"', '-1+1=', '0');
expectInline('0.1 + 0.2 = "0.3"', '0.1 + 0.2 = ', '0.3');
expectInline('pi + 0.001 = "3.143"', 'pi + 0.001 = ', '3.143');
expectInline('pi + 0.000001 = "3.141593"', 'pi + 0.000001 = ', '3.141593');

// === 5. Scientific Notation Thresholds (10^-4 / 10^4 and 10^-1000 / 10^1000) ===
expectInline('|x| > 10^4 offers sci alt', '10**5 = ', '100000', '1e5');
expectInline('|x| < 10^-4 offers sci alt', '10**-5 = ', '0.00001', '1e-5');
runCase('|x| > 10^1000 prefers sci exclusively', '10**1001 = ', {}, (res) => {
  assert.strictEqual(res.candidates.length, 1);
  assert.strictEqual(res.candidates[0].insertText, '1e1001');
});
runCase('|x| < 10^-1000 prefers sci exclusively', '10**-1001 = ', {}, (res) => {
  assert.strictEqual(res.candidates.length, 1);
  assert.strictEqual(res.candidates[0].insertText, '1e-1001');
});

// === 6. Unit Engine Examples ===
expectInline('Metric: 1kg + 2kg = "3kg"`6.614lbs`', '1kg + 2kg = ', '3kg', '6.614lbs', { unitSystem: 'metric' });
expectInline('Imperial: 1kg + 2kg = "6.614lbs"`3kg`', '1kg + 2kg = ', '6.614lbs', '3kg', { unitSystem: 'imperial' });
expectInline('1kg + 2000g = "3kg"', '1kg + 2000g = ', '3kg', null, { unitSystem: 'metric' });
expectInline('0.1kg + 0.1kg = "200g"', '0.1kg + 0.1kg = ', '200g', null, { unitSystem: 'metric' });
expectInline('1000kg + 1000g = "1001kg"', '1000kg + 1000g = ', '1001kg', null, { unitSystem: 'metric' });
expectInline('0.1kg + 0.1kg to kg = "0.2kg"', '0.1kg + 0.1kg to kg = ', '0.2kg', null, { unitSystem: 'metric' });
expectInline('10**-6 kg = "1mg"', '10**-6 kg = ', '1mg', null, { unitSystem: 'metric' });
expectInline('1km + 1pm = "1km"', '1km + 1pm = ', '1km', null, { unitSystem: 'metric' });
expectInline('1km to mi" = 0.6214mi"', '1km to mi', ' = 0.6214mi', null, { unitSystem: 'metric' });
expectInline('1km -> mi" = 0.6214mi"', '1km -> mi', ' = 0.6214mi', null, { unitSystem: 'metric' });
expectInline('1km -> mi = 0.62|"1"mi', '1km -> mi = 0.62|mi', '1', null, { unitSystem: 'metric' });
expectNone('1km -> mi = 0.62mi| (no completion)', '1km -> mi = 0.62mi|', { unitSystem: 'metric' });
expectInline('1km * 2 = "2km"', '1km * 2 = ', '2km', null, { unitSystem: 'metric' });
expectNone('1km + 2| (incompatible dimensions)', '1km + 2|', { unitSystem: 'metric' });
expectInline('1kg * 1m**2 / 1s**2 = "1J"', '1kg * 1m**2 / 1s**2 = ', '1J', null, { unitSystem: 'metric' });
expectInline('1 kg m2 s-2 * 2 = "2J"', '1 kg m2 s-2 * 2 = ', '2J', null, { unitSystem: 'metric' });
expectInline('1 kg2 * 2kg = "2 kg3"', '1 kg2 * 2kg = ', '2 kg3', null, { unitSystem: 'metric' });
expectInline('2m**2 * 1 = "2m**2"', '2m**2 * 1 = ', '2m**2', null, { unitSystem: 'metric' });
expectInline('kg·m²/s² = "1J"', 'kg·m²/s² = ', '1J', null, { unitSystem: 'metric' });
expectInline('40oz = "2.5lbs" (imperial)', '40oz = ', '2.5lbs', '1.134kg', { unitSystem: 'imperial' });
expectInline('1500g = "1.5kg" (metric)', '1500g = ', '1.5kg', '3.307lbs', { unitSystem: 'metric' });

console.log('\nALL 45 ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
