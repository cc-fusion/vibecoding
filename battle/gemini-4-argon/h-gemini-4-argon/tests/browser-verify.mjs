import { chromium } from 'playwright';
import { spawn } from 'child_process';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const SHOT_DIR = path.resolve('tests/screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

function startPreviewServer(port = 4177) {
  return new Promise((resolve, reject) => {
    const proc = spawn('./node_modules/.bin/vite', ['preview', '--port', String(port), '--strictPort'], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let ready = false;
    proc.stdout.on('data', (chunk) => {
      if (!ready && chunk.toString().includes('http')) {
        ready = true;
        resolve(proc);
      }
    });
    proc.stderr.on('data', (chunk) => {
      if (!ready && chunk.toString().includes('Error')) {
        reject(new Error(chunk.toString()));
      }
    });
    setTimeout(() => {
      if (!ready) resolve(proc);
    }, 2000);
  });
}

async function run() {
  const server = await startPreviewServer(4177);
  const errors = [];
  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
    });
    const context = await browser.newContext({ viewport: { width: 1200, height: 760 } });
    const page = await context.newPage();

    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('http://localhost:4177', { waitUntil: 'networkidle' });

    // 1. Clean initial state: no chips, no unit dropdown, 'rad' quick switch visible
    const initCheck = await page.evaluate(() => ({
      chips: document.querySelectorAll('.suggestion-chip').length,
      unitDropdownHidden: document.getElementById('unit-dropdown-wrap').classList.contains('hidden'),
      angleBtnText: document.getElementById('angle-quick-btn').textContent.trim(),
      theme: document.documentElement.getAttribute('data-theme'),
    }));
    assert.deepStrictEqual(initCheck, {
      chips: 0,
      unitDropdownHidden: true,
      angleBtnText: 'rad',
      theme: 'light',
    });
    console.log('✓ 1. Clean initial UI verified');

    // 2. Type math expression, verify editor.value stays untouched until Tab
    await page.click('#editor');
    await page.keyboard.type('1 + 1');
    const preAccept = await page.evaluate(() => ({
      value: document.getElementById('editor').value,
      ghost: document.querySelector('[data-inline-ghost]')?.textContent,
      chip0: document.querySelector('.suggestion-chip.selected .chip-text')?.textContent,
      unitDropdownHidden: document.getElementById('unit-dropdown-wrap').classList.contains('hidden'),
    }));
    assert.strictEqual(preAccept.value, '1 + 1');
    assert.strictEqual(preAccept.ghost, ' = 2');
    assert.strictEqual(preAccept.chip0, ' = 2');
    assert.strictEqual(preAccept.unitDropdownHidden, true);

    await page.keyboard.press('Tab');
    assert.strictEqual(await page.inputValue('#editor'), '1 + 1 = 2');
    console.log('✓ 2. Inline preview untouched pre-accept + Tab acceptance verified');

    // 3. Enter & ArrowRight/ArrowLeft candidate cycling + boundary cursor preservation + angle memory
    await page.keyboard.press('Enter');
    await page.keyboard.type('sin(30)=');
    await page.screenshot({ path: path.join(SHOT_DIR, '01-angle-suggestions.png') });

    const sinState = await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('.suggestion-chip')).map((el) => ({
        text: el.querySelector('.chip-text')?.textContent,
        badge: el.querySelector('.chip-badge')?.textContent,
        selected: el.classList.contains('selected'),
      }));
      return { chips, cursor: document.getElementById('editor').selectionStart };
    });
    assert.strictEqual(sinState.chips.length, 2);
    assert.deepStrictEqual(sinState.chips[0], { text: '-0.988', badge: 'rad', selected: true });
    assert.deepStrictEqual(sinState.chips[1], { text: '0.5', badge: 'deg', selected: false });

    // Left at first candidate moves cursor left!
    const cursorAtEq = sinState.cursor;
    await page.keyboard.press('ArrowLeft');
    const cursorAfterLeftAtFirst = await page.evaluate(() => document.getElementById('editor').selectionStart);
    assert.strictEqual(cursorAfterLeftAtFirst, cursorAtEq - 1);

    // Move back right to after '='
    await page.keyboard.press('ArrowRight');
    assert.strictEqual(await page.evaluate(() => document.getElementById('editor').selectionStart), cursorAtEq);

    // Now Right cycles to candidate 1 ('0.5 deg') WITHOUT moving cursor!
    await page.keyboard.press('ArrowRight');
    const afterCycleRight = await page.evaluate(() => ({
      cursor: document.getElementById('editor').selectionStart,
      selectedIdx: window.__SMART_EDITOR__.selectedIndex,
    }));
    assert.strictEqual(afterCycleRight.cursor, cursorAtEq);
    assert.strictEqual(afterCycleRight.selectedIdx, 1);

    // Accept '0.5 deg' with Tab -> remembers 'deg' mode!
    await page.keyboard.press('Tab');
    const afterAcceptDeg = await page.evaluate(() => ({
      val: document.getElementById('editor').value,
      angleBtn: document.getElementById('angle-quick-btn').textContent.trim(),
    }));
    assert.ok(afterAcceptDeg.val.endsWith('sin(30)=0.5'));
    assert.strictEqual(afterAcceptDeg.angleBtn, 'deg');
    console.log('✓ 3. Left/Right candidate cycling, boundary cursor movement & angle memory verified');

    // 4. Targeted replacement & UI hiding (`pi=3.142` hides `2` and shows `15`)
    await page.keyboard.press('Enter');
    await page.keyboard.type('pi=');
    await page.keyboard.press('Tab'); // -> pi=3.142
    await page.screenshot({ path: path.join(SHOT_DIR, '02-pi-targeted-replacement.png') });

    const piReplaceState = await page.evaluate(() => {
      const editorVal = document.getElementById('editor').value;
      const backdropText = document.getElementById('editor-backdrop').textContent;
      const ghostText = document.querySelector('[data-inline-ghost]')?.textContent;
      return { editorVal, backdropText, ghostText };
    });
    assert.ok(piReplaceState.editorVal.endsWith('pi=3.142'), 'Underlying textarea keeps 3.142 until accepted');
    assert.strictEqual(piReplaceState.ghostText, '15');
    assert.ok(piReplaceState.backdropText.trimEnd().endsWith('pi=3.1415'), 'Backdrop hides 2 and previews 3.1415!');

    await page.keyboard.press('Tab'); // -> pi=3.1415
    assert.ok((await page.inputValue('#editor')).endsWith('pi=3.1415'));
    await page.keyboard.press('Tab'); // -> pi=3.14159
    assert.ok((await page.inputValue('#editor')).endsWith('pi=3.14159'));
    console.log('✓ 4. Targeted replacement (`pi=3.142` hiding `2` -> `pi=3.1415` -> `pi=3.14159`) verified');

    // 5. Explicit unit conversion + Unit Dropdown switching
    await page.keyboard.press('Enter');
    await page.keyboard.type('1 km -> mi');
    await page.screenshot({ path: path.join(SHOT_DIR, '03-unit-conversion-dropdown.png') });

    const unitState = await page.evaluate(() => ({
      dropdownVisible: !document.getElementById('unit-dropdown-wrap').classList.contains('hidden'),
      selectedUnit: document.getElementById('unit-select').value,
      ghost: document.querySelector('[data-inline-ghost]')?.textContent,
    }));
    assert.strictEqual(unitState.dropdownVisible, true);
    assert.strictEqual(unitState.selectedUnit, 'mi');
    assert.strictEqual(unitState.ghost, ' = 0.6214mi');

    // Switch dropdown to 'ft' -> editor text still '1 km -> mi' until Tab!
    await page.selectOption('#unit-select', 'ft');
    assert.ok((await page.inputValue('#editor')).endsWith('1 km -> mi'));
    await page.keyboard.press('Tab');
    assert.ok((await page.inputValue('#editor')).endsWith('1 km -> ft = 3281ft'));
    console.log('✓ 5. Unit dropdown visibility & target unit switching verified');

    // 6. Settings overlay blur, Developer Menu logs & custom JSON unit editing + outside-click close & save
    await page.click('#settings-btn');
    await page.click('#dev-toggle-btn');
    await page.screenshot({ path: path.join(SHOT_DIR, '04-settings-and-devtools.png') });

    const modalCheck = await page.evaluate(() => ({
      overlayOpen: !document.getElementById('settings-overlay').classList.contains('hidden'),
      shellBlurred: document.getElementById('app-shell').classList.contains('blurred'),
      logCount: document.querySelectorAll('#dev-log-output .log-line').length,
    }));
    assert.strictEqual(modalCheck.overlayOpen, true);
    assert.strictEqual(modalCheck.shellBlurred, true);
    assert.ok(modalCheck.logCount > 0, 'Expected developer logs to be populated');

    // Add a custom unit "smoot" in Units JSON tab, then click outside settings card to close & save!
    await page.click('#dev-tab-units');
    await page.evaluate(() => {
      const ed = document.getElementById('units-json-editor');
      const arr = JSON.parse(ed.value);
      arr.push({
        symbol: 'smoot',
        aliases: ['smoots'],
        coeff: '1.7018',
        exponents: [1, 0, 0, 0, 0, 0, 0],
        system: 'imperial',
        autoScale: false,
      });
      ed.value = JSON.stringify(arr, null, 2);
      ed.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Click outside settings-card (top-left of settings-overlay)
    await page.mouse.click(20, 20);
    const closedState = await page.evaluate(() => ({
      overlayHidden: document.getElementById('settings-overlay').classList.contains('hidden'),
      shellBlurred: document.getElementById('app-shell').classList.contains('blurred'),
    }));
    assert.strictEqual(closedState.overlayHidden, true);
    assert.strictEqual(closedState.shellBlurred, false);

    // Verify newly added "smoot" unit works immediately in editor!
    await page.keyboard.press('Enter');
    await page.keyboard.type('10 smoot to m = ');
    const smootGhost = await page.evaluate(() => document.querySelector('[data-inline-ghost]')?.textContent);
    assert.strictEqual(smootGhost, '17.02m');
    console.log('✓ 6. Settings blur, outside-click save, Dev logs & custom JSON unit ("smoot") verified');

    assert.strictEqual(errors.length, 0, `Unexpected console/page errors: ${errors.join('; ')}`);
    console.log('\nALL BROWSER E2E VERIFICATIONS PASSED WITH ZERO ERRORS!');
  } finally {
    if (browser) await browser.close();
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {}
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('BROWSER TEST FAILED:', err);
    process.exit(1);
  });
