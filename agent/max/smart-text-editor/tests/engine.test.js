import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestFor } from '../src/suggest.js';
import { analyzeLine } from '../src/analyze.js';
import { configureFor, D, MAX_DIGITS, MAX_DECIMALS } from '../src/numeric.js';

const suggest = text => suggestFor(text, text.length);
function value(text) {
  configureFor(text);
  const result = analyzeLine(text, text.length);
  assert.ok(result?.lists.length, `No result for ${text}`);
  return result.lists[0].items[0].x;
}

for (const text of ['2c to k =', '2c to k = ', '2c to k', '2c -> k =', '2c → k =']) {
  test(`inline temperature: ${text}`, () => {
    const result = suggest(text)[0];
    assert.ok(result?.inlineEligible);
    assert.match(result.insertText, /275\.15k/);
  });
}
for (const [text, expected] of [
  ['0c to k =', '273.15'], ['-40c to f =', '-40'],
  ['32f to k =', '273.15'], ['212f to c =', '100'],
  ['2 °C to K =', '275.15'], ['2 celsius to kelvin =', '275.15'],
  ['273.15 K to c =', '0'], ['273.15 k to f =', '32'],
]) {
  test(`temperature value: ${text}`, () => {
    assert.ok(value(text).minus(expected).abs().lt('1e-40'));
  });
}

const factors = {
  Pa: '1', kPa: '1000', hPa: '100', MPa: '1000000',
  atm: '101325', torr: new D(101325).div(760),
  psi: new D('4.4482216152605').div(new D('0.0254').pow(2)),
  mmHg: '133.322387415', inHg: '3386.388640341', cmHg: '1333.22387415',
  bar: '100000', mbar: '100', Ba: '0.1', at: '98066.5',
  ksi: new D('4.4482216152605').div(new D('0.0254').pow(2)).times(1000)
};
for (const [from, a] of Object.entries(factors)) {
  test(`pressure conversion matrix from ${from}`, () => {
    for (const [to, b] of Object.entries(factors)) {
      const text = `1 ${from} to ${to} =`;
      const expected = new D(a).div(b);
      assert.ok(value(text).minus(expected).div(expected).abs().lt('1e-40'), text);
      assert.ok(suggest(text)[0]?.inlineEligible, text);
    }
  });
}
test('760 torr equals 1 atm', () => assert.equal(value('760 torr to atm =').toString(), '1'));
test('mercury units are distinguished from torr', () => {
  assert.ok(value('1 mmHg to torr =').gt(1));
  assert.equal(value('1 inHg to mmHg =').toString(), '25.4');
});
test('pressure aliases and casing', () => {
  for (const text of ['1 Torr to Pa =', '1 TORR to Pa =', '1 torr in pascals =', '1 torr -> Pa =', '1 torr → Pa =']) {
    assert.ok(value(text).minus(factors.torr).abs().lt('1e-40'));
  }
  assert.ok(value('1 PSI to Pa =').eq(factors.psi));
  assert.ok(value('1 mb to hPa =').eq(1));
});
test('pressure target completion', () => {
  assert.ok(suggest('1 atm to to').some(x => x.insertText.startsWith('rr = 760')));
  assert.ok(suggest('1 atm to mm').some(x => x.insertText.startsWith('Hg = ')));
  for (const unit of ['torr', 'psi', 'mmHg', 'inHg']) {
    assert.ok(suggest('1 atm to ').some(x => x.insertText.startsWith(unit + ' = ')), unit);
  }
});
test('incompatible dimensions never convert', () => {
  assert.deepEqual(suggest('1 torr to kg ='), []);
  assert.deepEqual(suggest('2c to Pa ='), []);
});

for (const [text, expected] of [
  ['1 + 2 =', '3'], ['0.1 + 0.2 =', '0.3'], ['2^100 =', '1267650600228229401496703205376'],
  ['sqrt(81) =', '9'], ['C(5,2) =', '10'], ['5! =', '120'],
  ['1 km to m =', '1000'], ['1 kg to g =', '1000'], ['1 h to min =', '60'],
  ['1 MB to B =', '1000000'], ['10 N / 2 m^2 to Pa =', '5'],
]) {
  test(`existing engine regression: ${text}`, () => assert.equal(value(text).toString(), expected));
}
test('precision ladder and typed digit continuation retained', () => {
  assert.ok(suggest('1/3 =').length > 1);
  const continuation = suggest('1/3 = 0.333');
  assert.ok(continuation.length > 0);
  assert.match(continuation[0].insertText, /^3+/);
  assert.equal(MAX_DIGITS, 1000);
  assert.equal(MAX_DECIMALS, 1000);
});
test('plain prose and invalid expressions are silent', () => {
  for (const text of ['ordinary notes', '1 / 0 =', 'sqrt(-1) =']) assert.deepEqual(suggest(text), []);
});
