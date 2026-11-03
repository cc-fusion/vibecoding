import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text().slice(0, 1400)); });
await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector('.world-ready', { timeout: 90000 });
await page.waitForTimeout(5000);
await page.screenshot({ path: 'artifacts/title.png', timeout: 60000 });
console.log('TITLE', await page.evaluate(() => {
  const g = window.__wildwood;
  return { mode: g.mode, chunks: g.world.chunks.size, queue: g.world.queue.length, triangles: g.renderer.info.render.triangles, calls: g.renderer.info.render.calls, camera: g.camera.position.toArray(), spawn: g.player.position.toArray(), biome: g.world.column(-12, 26) };
}));
await page.getByRole('button', { name: 'Enter the world', exact: false }).click();
await page.waitForTimeout(1500);
console.log('PLAY', await page.evaluate(() => ({ mode: window.__wildwood.mode, locked: !!document.pointerLockElement, pos: window.__wildwood.player.position.toArray(), grounded: window.__wildwood.player.grounded, collides: window.__wildwood.player.collides() })));
await page.screenshot({ path: 'artifacts/gameplay.png', timeout: 60000 });
await page.keyboard.press('KeyE');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'artifacts/inventory.png', timeout: 60000 });
console.log('INVENTORY', await page.locator('.inventory-panel').count());
console.log('ERRORS', errors);
await browser.close();
if (errors.length) process.exitCode = 1;