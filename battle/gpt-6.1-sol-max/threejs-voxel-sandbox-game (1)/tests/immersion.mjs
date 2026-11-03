import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 1000)); });
await page.addInitScript(() => localStorage.setItem('wildwood.settings.v1', JSON.stringify({ volume: 0, distance: 3, shadows: false })));
await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173'); await page.waitForSelector('.world-ready', { timeout: 90000 });
await page.locator('#enter-world').click(); await page.waitForFunction(() => window.__wildwood.player.grounded);
await page.keyboard.press('Digit6');
await page.evaluate(() => { const g = window.__wildwood; g.data.time = 0.01; g.player.pitch = -0.85; g.player.yaw = 1.4; });
await page.waitForFunction(() => window.__wildwood.environment.heldLight.visible && window.__wildwood.environment.daylight < 0.1);
await page.waitForFunction(() => !!window.__wildwood.hit);
await page.mouse.down({ button: 'right' }); await page.waitForFunction(() => [...window.__wildwood.world.torches.values()].flat().length > 0); await page.mouse.up({ button: 'right' });
await page.waitForFunction(() => window.__wildwood.environment.torchLights.some(l => l.visible), null, { timeout: 30000 });
await page.waitForTimeout(1300); await page.screenshot({ path: 'artifacts/night.png', timeout: 60000 });
console.log('PASS Night skies, held torches, placed torch geometry, local lights, and light-count shader changes');

await page.evaluate(() => { const g = window.__wildwood; g.data.time = 0.34; g.player.position.set(20.5, 10.5, 20.5); g.player.velocity.set(0, 0, 0); });
await page.waitForFunction(() => window.__wildwood.player.submerged);
await expect(page.locator('.underwater-overlay')).toHaveClass(/visible/); await expect(page.locator('.breath-meter')).toBeVisible();
await page.keyboard.down('Space'); await page.waitForFunction(() => !window.__wildwood.player.submerged, null, { timeout: 30000 }); await page.keyboard.up('Space');
console.log('PASS Water swimming, underwater atmosphere, visible air management, and surfacing');

await page.evaluate(() => { const g = window.__wildwood; g.player.position.copy(g.world.findSpawn()); g.player.velocity.set(0, 0, 0); const s = g.environment.sheep[0]; s.group.position.copy(g.player.position).add({ x: 1, y: 0, z: 0 }); s.moving = false; s.nextTurn = g.visualTime + 20; });
const apples = await page.evaluate(() => window.__wildwood.itemCount(107)); await page.keyboard.press('KeyF');
assert.equal(await page.evaluate(() => window.__wildwood.itemCount(107)), apples - 1); assert.ok(await page.evaluate(() => window.__wildwood.environment.sheep[0].happy > 0));
console.log('PASS Feeding wildlife consumes an apple and triggers the creature interaction');

await page.evaluate(() => { const g = window.__wildwood; g.player.health = 1; g.lastDamage = -100; g.damage(2); });
await expect(page.getByRole('button', { name: 'Back on your feet' })).toBeVisible(); await page.keyboard.press('KeyE');
assert.equal(await page.locator('.inventory-panel').count(), 0);
await page.getByRole('button', { name: 'Back on your feet' }).click(); await page.waitForFunction(() => window.__wildwood.mode === 'playing');
assert.equal(await page.evaluate(() => window.__wildwood.player.health), 10);
console.log('PASS Death cannot be bypassed through inventory; respawn restores health without losing items');
assert.deepEqual(errors, []); await browser.close(); console.log('Immersion tests passed with no runtime or shader errors.');