// Acceptance tests for the completion engine. Run with: node tests/examples.mjs
import Decimal from 'decimal.js';
import { complete } from '../src/engine/complete.js';
import { Registry } from '../src/engine/units.js';

const registry = new Registry();
let failed = 0;
let passed = 0;

function run(input, { system = 'metric', angle = 'rad', override = null } = {}) {
  const cursor = input.includes('|') ? input.indexOf('|') : input.length;
  const text = input.replace('|', '');
  const t0 = performance.now();
  const res = complete(text, cursor, { registry, system, angle, unitOverride: override, selStart: cursor, selEnd: cursor });
  return { res, text, ms: performance.now() - t0 };
}

/** expect: { inline: string|null, bar?: string[] } */
function t(name, input, expect, opts) {
  const { res, ms } = run(input, opts);
  const c = res.candidates;
  const inline = c.length ? c[0].text : null;
  const bar = c.map((x) => x.chip);
  let ok = inline === expect.inline;
  if (ok && expect.bar) ok = JSON.stringify(bar) === JSON.stringify(expect.bar);
  if (ok && expect.tags) ok = JSON.stringify(c.map((x) => x.tag)) === JSON.stringify(expect.tags);
  if (ok && expect.hidden != null) ok = c[0].end - c[0].start === expect.hidden;
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name}: ${JSON.stringify(input)}\n   expected ${JSON.stringify(expect)}\n   got      ${JSON.stringify({ inline, bar, tags: c.map((x) => x.tag) })}`);
  }
  if (ms > 400) console.log(`  (slow: ${name} took ${ms.toFixed(0)}ms)`);
}

const none = { inline: null };

// whitespace and cursor positioning
t('ws1', '1+1', { inline: '=2' });
t('ws2', '1 + 1', { inline: ' = 2' });
t('ws3', '1  +  1', { inline: '  =  2' });
t('ws4', '1 +1', { inline: '=2' });
t('ws5', '1+ 1', { inline: ' = 2' });
t('lone number', '1|', none);
t('mid text', 'other text 1+1| other text', { inline: '=2' });
t('dot number', 'text.1+1=', { inline: '1.1' });
t('word glued', 'text1+1|', none);
t('chain', '1+1+1', { inline: '=3' });
t('cursor before 4', '1+1=|4', none);
t('cursor before 2', '1+1=|2', none);
t('bar chip', '1+1', { inline: '=2', bar: ['=2'] });
t('after =', '1+1=', { inline: '2', bar: ['2'] });
t('bullet', '- 1+1', { inline: '=2' });
t('neg', '-1+1', { inline: '=0' });
t('neg =', '-1+1=', { inline: '0' });
t('1+1=2 nothing', '1+1=2', none);
t('1+1=3 wrong', '1+1=3', none);

// angle mode
t('sin(30) rad', 'sin(30)=', { inline: '-0.988', bar: ['-0.988', '0.5'], tags: ['rad', 'deg'] });
t('sin(30) deg', 'sin(30)=', { inline: '0.5', bar: ['0.5', '-0.988'], tags: ['deg', 'rad'] }, { angle: 'deg' });
t('sin 30', 'sin 30=', { inline: '-0.988', bar: ['-0.988', '0.5'] });
t('sin(30 deg)', 'sin(30 deg)=', { inline: '0.5', bar: ['0.5'], tags: [null] });
t('sin(30 rad)', 'sin(30 rad)=', { inline: '-0.988', bar: ['-0.988'], tags: [null] });
t('sin(30 deg) rad mode, no label', 'sin(30 deg)=', { inline: '0.5', tags: [null] }, { angle: 'rad' });
t('typed 0. narrows to deg', 'sin(30)=0.', { inline: '5', bar: ['0.5'] });
t('typed -0.9 narrows to rad', 'sin(30)=-0.9', { inline: '8', bar: ['-0.98'] });

// rounding / precision
t('1/7', '1/7=', { inline: '0.1429' });
t('pi', 'pi=', { inline: '3.142' });
t('pi=3.142', 'pi=3.142', { inline: '15', hidden: 1 });
t('pi=3.1415', 'pi=3.1415', { inline: '9', hidden: 0 });
t('1/sqrt 2=0.7', '1/sqrt 2=0.7', { inline: '0' });
t('1/sqrt 2=0.70', '1/sqrt 2=0.70', { inline: '7' });
t('0.1+0.2', '0.1 + 0.2 = ', { inline: '0.3' });
t('pi+0.001', 'pi + 0.001 = ', { inline: '3.143' });
t('pi+0.000001', 'pi + 0.000001 = ', { inline: '3.141594' });

// long constants
{
  Decimal.set({ precision: 1025 });
  const pi = Decimal.acos(-1).toFixed();
  const typed = pi.slice(0, 1002); // 3. + 1000 decimals
  t('pi 1000 digits', `pi=${typed}`, { inline: pi[1002] });
  console.log('   pi digits end with', typed.slice(-4), '-> next', pi[1002]);
  Decimal.set({ precision: 1300 });
  const s2 = new Decimal(2).sqrt().toFixed();
  const typed2 = s2.slice(0, 1203);
  t('sqrt2 1200 digits', `sqrt 2=${typed2}`, { inline: s2[1203] });
  Decimal.set({ precision: 50 });
}

// scientific notation
t('sci small', '10**-5 = ', { inline: '0.00001', bar: ['0.00001', '1e-5'] });
t('sci big', '12345*10 = ', { inline: '123500', bar: ['123500', '1.235e5'] });
t('sci none mid', '1000*3 = ', { inline: '3000', bar: ['3000'] });
t('sci only huge', '10**1500 = ', { inline: '1e1500', bar: ['1e1500'] });
t('sci only tiny', '10**-1500 = ', { inline: '1e-1500', bar: ['1e-1500'] });
t('exact 1e1000 uses sci too', '10**1000 = ', { inline: '1e1000' });

// units
t('metric 1kg+2kg', '1kg + 2kg = ', { inline: '3kg', bar: ['3kg', '6.614lbs'] });
t('imperial 1kg+2kg', '1kg + 2kg = ', { inline: '6.614lbs', bar: ['6.614lbs', '3kg'] }, { system: 'imperial' });
t('kg+g', '1kg + 2000g = ', { inline: '3kg' });
t('200g', '0.1kg + 0.1kg = ', { inline: '200g' });
t('1001kg', '1000kg + 1000g = ', { inline: '1001kg' });
t('to kg', '0.1kg + 0.1kg to kg = ', { inline: '0.2kg' });
t('1mg', '10**-6 kg = ', { inline: '1mg' });
t('km+pm', '1km + 1pm = ', { inline: '1km' });
t('to mi', '1km to mi', { inline: ' = 0.6214mi' });
t('-> mi', '1km -> mi', { inline: ' = 0.6214mi' });
t('mi progressive mid', '1km -> mi = 0.62|mi', { inline: '1' });
t('mi after unit', '1km -> mi = 0.62mi|', none);
t('km*2', '1km * 2 = ', { inline: '2km' });
t('km+2', '1km + 2|', none);
t('J', '1kg * 1m**2 / 1s**2 = ', { inline: '1J' });
t('J2', '1 kg m2 s-2 * 2 = ', { inline: '2J' });
t('kg3', '1 kg2 * 2kg = ', { inline: '2 kg3' });
t('m**2', '2m**2 * 1 = ', { inline: '2m**2' });
t('normalize g', '1500 g', { inline: ' = 1.5kg' });
t('normalize oz', '40oz', { inline: ' = 2.5lbs' }, { system: 'imperial' });
t('same unit lone literal', '5 kg', none);
t('5 am prose', 'meet at 5 am', none);
t('speed', '10 m / 1 s = ', { inline: '10m/s', bar: ['10m/s', '22.37mph'] });

// unit completion & dropdown
{
  const { res } = run('1km to ');
  console.log('   unit completion for "1km to ":', res.candidates.map((c) => c.chip).join(', '), '| dropdown:', res.unit && res.unit.selected);
  t('unit completion', '1km to ', { inline: 'mi' });
  t('unit completion no space', '1km ->', { inline: ' mi' });
  t('unit partial', '1km to f', { inline: 't' });
}
{
  const { res } = run('1km -> mi', { override: 'ft' });
  console.log('   override ft:', JSON.stringify(res.candidates[0]), res.unit && res.unit.selected);
  t('override', '1km -> mi', { inline: 'ft = 3281ft', hidden: 2 }, { override: 'ft' });
  t('override B', '1km -> mi = 0.6', { inline: 'ft = 3281ft', hidden: 8 }, { override: 'ft' });
}
t('dropdown present', '1km -> mi', { inline: ' = 0.6214mi' });
{
  const { res } = run('1kg + 2kg');
  console.log(res.unit === null ? '   no dropdown for non-conversion: ok' : 'FAIL dropdown should be absent');
  if (res.unit !== null) failed++;
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
