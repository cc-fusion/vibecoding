// UI smoke test (needs: npm install --no-save jsdom). Run: node tests/ui-smoke.mjs
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;
for (const k of ['window', 'document', 'localStorage', 'Event', 'KeyboardEvent', 'MouseEvent', 'HTMLElement', 'getComputedStyle']) {
  Object.defineProperty(globalThis, k, { value: k === 'window' ? window : window[k], configurable: true, writable: true });
}
window.document.execCommand = () => false; // force the setRangeText fallback

// main.js without the css import
const src = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8').replace("import './style.css';\n", '');
const tmp = path.join(root, 'tests/.main.tmp.mjs');
fs.writeFileSync(tmp, src.replaceAll("'./engine/", "'../src/engine/"));
await import(pathToFileURL(tmp).href);
fs.unlinkSync(tmp);

const $ = (s) => document.querySelector(s);
const editor = $('#editor');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

function type(text) {
  editor.value = text;
  editor.setSelectionRange(text.length, text.length);
  editor.dispatchEvent(new window.Event('input', { bubbles: true }));
}
const key = (k) => { const e = new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); editor.dispatchEvent(e); return e.defaultPrevented; };
const chips = () => [...document.querySelectorAll('.chip')].map((c) => c.firstChild.textContent);

type('1+1');
ok(JSON.stringify(chips()) === '["=2"]', 'chip for 1+1: ' + chips());
ok($('#mirror .ghost').textContent === '=2', 'ghost shows =2');
ok(editor.value === '1+1', 'editor text unchanged until accepted');
ok(key('Tab') === true, 'Tab accepted');
ok(editor.value === '1+1=2', 'accepted text: ' + editor.value);
ok(chips().length === 0 && !$('#mirror .ghost'), 'no suggestion after accept');

type('sin(30)=');
ok(chips().join() === '-0.988,0.5', 'rad/deg chips: ' + chips());
ok(document.querySelectorAll('.chip .tag').length === 2, 'tags shown when angle matters');
ok(key('ArrowLeft') === false, 'left at first candidate keeps native caret movement');
ok(key('ArrowRight') === true, 'right cycles');
ok($('#mirror .ghost').textContent === '0.5', 'ghost follows selected chip');
ok(key('ArrowRight') === false, 'right at last candidate is native');
ok(key('ArrowLeft') === true, 'left cycles back');
document.querySelectorAll('.chip')[1].dispatchEvent(new window.Event('click'));
ok(editor.value === 'sin(30)=0.5', 'clicking chip accepts: ' + editor.value);

type('pi=3.142');
ok($('#mirror .ghost').textContent === '15', 'replacement ghost');
ok($('#mirror .caret.fake'), 'fake caret while replacing');
key('Tab');
ok(editor.value === 'pi=3.1415', 'replacement accepted: ' + editor.value);

type('1km -> mi');
ok(!$('#unit-select').hidden, 'unit dropdown visible for conversion');
$('#unit-select').value = 'ft';
$('#unit-select').dispatchEvent(new window.Event('change'));
ok(chips()[0].startsWith('ft = 3281'), 'dropdown switches unit: ' + chips());
key('Tab');
ok(editor.value === '1km -> ft = 3281ft', 'accepted override: ' + editor.value);

type('1kg + 2kg');
ok($('#unit-select').hidden, 'dropdown hidden for non-conversion');
ok(chips().join() === '= 3kg,= 6.614lbs', 'unit chips: ' + chips());

// angle quick switch
document.querySelector('#angle-seg button[data-v="deg"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
type('sin(30)=');
ok(chips().join() === '0.5,-0.988', 'degrees remembered: ' + chips());
ok(JSON.parse(localStorage.getItem('smart-editor.settings.v1')).angle === 'deg', 'angle persisted');

// settings overlay
$('#settings-btn').click();
ok(!$('#overlay').hidden, 'overlay opens');
document.querySelector('[data-setting="theme"] [data-v="dark"]').click();
ok(document.documentElement.dataset.theme === 'dark', 'theme applies');
document.querySelector('[data-toggle="inline"]').click();
type('1+1');
ok(!$('#mirror .ghost') && chips().join() === '=2', 'inline disabled keeps bar chip only');
document.querySelector('#dev-toggle').click();
$('#units-json').value = '{ bad json';
$('#overlay').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
ok(!$('#overlay').hidden && !$('#units-error').hidden, 'invalid JSON keeps overlay open with an error');
$('#units-error button').click();
$('#overlay').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
ok($('#overlay').hidden, 'click outside closes overlay');

console.log(fails ? `${fails} FAILED` : 'UI smoke: all ok');
process.exit(fails ? 1 : 0);
