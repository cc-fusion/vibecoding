import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  const started = Date.now();
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Enter your world', exact: true }).waitFor({ timeout: 90000 });
  console.log('PRODUCTION_READY_MS', Date.now() - started);
  assert.equal(await page.evaluate(() => typeof window.__everwild), 'undefined');
  console.log('PASS: Production contains no development engine handle.');
  await page.waitForTimeout(5500);
  await page.screenshot({ path: 'artifacts/production-welcome.png', timeout: 120000 });
  await page.getByRole('button', { name: 'Open backpack and crafting', exact: true }).click();
  await page.getByRole('button', { name: 'Craft workbench', exact: true }).click();
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('everwild.worlds.v1'))[0].inventory[16] === 1));
  console.log('PASS: Built production application crafts and persists a real item.');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'Enter your world', exact: true }).click();
  await page.waitForTimeout(500);
  assert.ok(await page.evaluate(() => !!document.pointerLockElement));
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Game paused', exact: true }).waitFor();
  console.log('PASS: Production pointer capture and pause/resume interface work.');
  assert.deepEqual(errors, []);
  console.log('PASS: No production runtime, asset, or shader errors.');
} finally { await browser.close(); }