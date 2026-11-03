import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const url = 'http://127.0.0.1:4175';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4175', '--strictPort'], { stdio: 'ignore' });
let browser;

try {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (attempt === 79) throw new Error('The Vite server did not start');
  }

  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 750 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('loam-world-v1') || 'null'));

  await page.goto(url);
  await page.getByRole('button', { name: 'Enter world' }).waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: 'Enter world' }).click();
  await page.waitForFunction(() => Boolean(document.pointerLockElement), null, { timeout: 10000 });
  await page.mouse.move(550, 375);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const before = await save();

  // Aim at the nearby ground in small increments, like relative mouse motion.
  await page.evaluate(({ yaw, pitch }) => {
    const dx = yaw / 0.0023;
    const dy = (pitch + 0.9) / 0.0023;
    for (let i = 0; i < 8; i++) document.dispatchEvent(new MouseEvent('mousemove', { movementX: dx / 8, movementY: dy / 8 }));
  }, before);
  await page.keyboard.press('Digit3');
  await page.locator('.target-label').waitFor({ timeout: 10000 });
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('loam-world-v1') || '{}').quest?.placed === 1, null, { timeout: 10000 });
  const placed = await save();
  assert.ok(Object.values(placed.edits).includes(1), 'placing creates a grass block edit');

  const placedKey = Object.entries(placed.edits).find(([, id]) => id === 1)[0];
  const [bx, by, bz] = placedKey.split(',').map(Number);
  const dx = bx + 0.5 - placed.position[0];
  const dy = by + 0.5 - (placed.position[1] + 1.62);
  const dz = bz + 0.5 - placed.position[2];
  const targetYaw = Math.atan2(-dx, -dz);
  const targetPitch = Math.atan2(dy, Math.hypot(dx, dz));
  await page.evaluate(({ yaw, pitch, targetYaw, targetPitch }) => {
    for (let i = 0; i < 8; i++) {
      document.dispatchEvent(new MouseEvent('mousemove', {
        movementX: (yaw - targetYaw) / 0.0023 / 8,
        movementY: (pitch - targetPitch) / 0.0023 / 8,
      }));
    }
  }, { yaw: placed.yaw, pitch: placed.pitch, targetYaw, targetPitch });
  await page.waitForTimeout(700);
  await page.mouse.down();
  await page.waitForTimeout(1500);
  await page.mouse.up();
  await page.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('loam-world-v1') || '{}').edits || {}).includes(0), null, { timeout: 10000 });
  const mined = await save();
  assert.ok(Object.values(mined.edits).includes(0), 'mining removes a block');

  await page.keyboard.press('KeyE');
  const inventory = page.getByRole('dialog', { name: 'Inventory and crafting' });
  await inventory.waitFor();
  await inventory.getByRole('button', { name: 'Craft', exact: true }).first().click();
  const crafted = await save();
  assert.equal(crafted.inventory[4].count, 7);
  assert.equal(crafted.inventory[5].count, 20);
  assert.equal(crafted.quest.crafted, 4);

  await page.reload();
  await page.getByRole('button', { name: 'Enter world' }).waitFor({ timeout: 90000 });
  const restored = await save();
  assert.deepEqual(restored.edits, mined.edits);
  assert.equal(restored.quest.placed, 1);
  assert.equal(restored.quest.crafted, 4);

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Clear skies' }).click();
  assert.equal((await save()).weather, 'Rain');
  assert.deepEqual(errors, []);
  await page.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.goto(url);
  await mobile.getByRole('button', { name: 'Enter world' }).waitFor({ timeout: 90000 });
  await mobile.getByRole('button', { name: /FIELD NOTES/ }).tap();
  assert.equal(await mobile.getByText('A good place to begin.').isVisible(), true);
  await mobile.getByRole('button', { name: 'Enter world' }).tap();
  assert.equal(await mobile.getByRole('button', { name: 'Move forward' }).isVisible(), true);
  await mobile.close();
  console.log('Smoke test passed: gameplay, crafting, save/restore, weather, and touch UI.');
} finally {
  if (browser) await browser.close();
  server.kill();
}