import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = 4200 + Math.floor(Math.random() * 1000);
const url = `http://127.0.0.1:${port}/`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' });
let browser;

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(url)).ok) return; } catch { /* Vite is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Vite did not start');
}

async function ready(page) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.loading-screen').waitFor({ state: 'hidden', timeout: 120000 });
  await page.waitForTimeout(1000);
}

async function look(page, movementY, times) {
  await page.evaluate(({ movementY, times }) => {
    for (let i = 0; i < times; i++) document.dispatchEvent(new MouseEvent('mousemove', { movementY, bubbles: true }));
  }, { movementY, times });
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 900, height: 650 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  assert.equal(await page.title(), 'Wilds | A Voxel Sandbox');
  await page.getByRole('button', { name: 'ENTER THE WORLD' }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.waitForTimeout(1000);
  const before = await page.locator('.player-info > span').innerText();
  await page.keyboard.down('w'); await page.waitForTimeout(2500); await page.keyboard.up('w');
  await page.waitForTimeout(700);
  assert.notEqual(await page.locator('.player-info > span').innerText(), before, 'WASD should move the player');
  await look(page, 150, 8);
  await page.locator('.target-name').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })));
  await page.waitForTimeout(5000);
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })));
  await page.keyboard.press('e');
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 15000 });
  const collected = await page.evaluate(() => {
    const count = name => Number(document.querySelector(`.pack-slot[title="${name}"] .pack-count`)?.textContent || 0);
    return !!document.querySelector('.pack-slot[title="Grass block"]') || count('Earth') > 24 || count('Cobblestone') > 18 || count('Sand') > 12 || count('Oak leaves') > 8;
  });
  assert.ok(collected, 'Mining should add a block to the pack');
  await page.getByRole('button', { name: 'Craft 4 Oak planks' }).click();
  assert.match(await page.locator('.pack-slot[title="Oak planks"]').innerText(), /28/, 'Crafting should consume a log and create four planks');
  await page.getByRole('button', { name: 'Close inventory' }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.locator('.is-playing').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  await page.keyboard.press('p');
  await page.waitForFunction(() => !document.pointerLockElement);
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('button', { name: 'SAVE NOW' }).click();
  let save = await page.evaluate(() => JSON.parse(localStorage.getItem('wilds-sandbox-world-v1')));
  assert.ok(save.stats.mined > 0 && save.stats.crafted === 1 && Object.keys(save.edits).length > 0, 'Progress and edits should save');
  await page.getByRole('button', { name: 'CLEAR', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'RAIN', exact: true }).count(), 1, 'Weather should change');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.loading-screen').waitFor({ state: 'hidden', timeout: 120000 });
  assert.match(await page.locator('.welcome h1').innerText(), /Welcome back/);
  save = await page.evaluate(() => JSON.parse(localStorage.getItem('wilds-sandbox-world-v1')));
  assert.ok(save.stats.mined > 0 && save.stats.crafted === 1, 'Progress should survive reload');
  await context.close();

  const buildContext = await browser.newContext({ viewport: { width: 900, height: 650 }, deviceScaleFactor: 1 });
  const buildPage = await buildContext.newPage();
  buildPage.on('pageerror', error => errors.push(error.message));
  buildPage.on('dialog', dialog => dialog.accept());
  await ready(buildPage);
  await buildPage.getByRole('button', { name: 'ENTER THE WORLD' }).click();
  await buildPage.waitForFunction(() => !!document.pointerLockElement);
  await buildPage.waitForTimeout(1000);
  await buildPage.keyboard.press('3');
  await look(buildPage, 150, 2);
  await buildPage.locator('.target-name').waitFor({ state: 'visible', timeout: 15000 });
  await buildPage.waitForTimeout(700);
  await buildPage.evaluate(() => window.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true, cancelable: true })));
  await buildPage.waitForFunction(() => document.querySelector('.hotbar-slot.selected')?.getAttribute('aria-label')?.includes('23'), null, { timeout: 15000 });
  await buildPage.keyboard.press('p');
  await buildPage.waitForFunction(() => !document.pointerLockElement);
  await buildPage.getByRole('button', { name: 'Open settings' }).click();
  await buildPage.getByRole('button', { name: 'SAVE NOW' }).click();
  const placed = await buildPage.evaluate(() => JSON.parse(localStorage.getItem('wilds-sandbox-world-v1')));
  assert.equal(placed.stats.placed, 1, 'Placing should consume a block and record an edit');
  const [editKey, editValue] = Object.entries(placed.edits).find(([, value]) => value === 8) ?? [];
  assert.equal(editValue, 8);
  await buildPage.reload({ waitUntil: 'domcontentloaded' });
  await buildPage.locator('.loading-screen').waitFor({ state: 'hidden', timeout: 120000 });
  assert.match(await buildPage.locator('.hotbar-slot.selected').getAttribute('aria-label'), /23/);
  const restoredBlock = await buildPage.evaluate(async key => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { VoxelWorld } = await import('/src/game/world.ts');
    const saved = JSON.parse(localStorage.getItem('wilds-sandbox-world-v1'));
    const world = new VoxelWorld(new THREE.Scene(), new THREE.Texture(), saved.seed, saved.edits);
    const [x, y, z] = key.split(',').map(Number);
    world.generateChunk(Math.floor(x / 16), Math.floor(z / 16));
    const block = world.getBlock(x, y, z); world.dispose(); return block;
  }, editKey);
  assert.equal(restoredBlock, 8, 'A saved block should be restored into regenerated terrain');
  await buildPage.getByRole('button', { name: 'Open settings' }).click();
  await buildPage.getByRole('button', { name: 'NEW WORLD', exact: true }).click();
  await buildPage.waitForLoadState('domcontentloaded');
  await buildPage.locator('.loading-screen').waitFor({ state: 'hidden', timeout: 120000 });
  const fresh = await buildPage.evaluate(() => JSON.parse(localStorage.getItem('wilds-sandbox-world-v1')));
  assert.notEqual(fresh.seed, placed.seed, 'New world should replace the previous seed');
  assert.equal(fresh.inventory.find(stack => stack?.id === 'log')?.count, 6);
  await buildContext.close();

  const physicsContext = await browser.newContext({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
  const physicsPage = await physicsContext.newPage();
  physicsPage.on('pageerror', error => errors.push(error.message));
  await ready(physicsPage);
  const physics = await physicsPage.evaluate(async () => {
    const { VoxelGame } = await import('/src/game/engine.ts');
    const { Block } = await import('/src/game/blocks.ts');
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;top:-1000px;width:320px;height:240px';
    document.body.appendChild(host);
    const game = new VoxelGame(host, { onSnapshot() {}, onLockChange() {}, onInventory() {}, onToast() {}, onReady() {} });
    game.world.setBlock(0, 30, 0, Block.Stone);
    game.world.setBlock(1, 31, 0, Block.Stone);
    game.position.set(0.5, 31.001, 0.5); game.velocity.set(5, 0, 0); game.moveAxis('x', 2);
    const wallX = game.position.x;
    game.position.set(0.5, 35, 0.5); game.velocity.y = -30; game.onGround = false; game.moveAxis('y', -6);
    const floorY = game.position.y, landed = game.onGround;
    game.keys.add('Space'); game.jumpQueued = true; game.updatePlayer(0.05);
    const jumped = game.velocity.y > 0 && game.position.y > floorY;
    game.world.setBlock(2, 31, 0, Block.Water); game.world.setBlock(2, 32, 0, Block.Water);
    game.position.set(2.5, 31, 0.5); game.velocity.set(0, 0, 0); game.onGround = false; game.updatePlayer(0.05);
    const swam = game.velocity.y > 0;
    game.world.setBlock(2, 31, 1, Block.Torch); game.updateTorchLights();
    const torchLit = game.torchLights[0].visible && game.torchLights[0].intensity > 0;
    game.scenery.update(0, 0.5, game.camera); const noon = game.scenery.hemi.intensity;
    game.scenery.update(0, 0, game.camera); const midnight = game.scenery.hemi.intensity;
    game.world.setBlock(0, 34, 7, Block.Stone); game.respawn();
    const safeRespawn = game.position.y > 35 && !game.collides(game.position.x, game.position.y, game.position.z);
    game.dispose(); host.remove();
    return { wallX, floorY, landed, jumped, swam, torchLit, noon, midnight, safeRespawn };
  });
  assert.ok(physics.wallX <= 0.701 && physics.wallX >= 0.69, 'A swept player should stop at a solid wall');
  assert.ok(physics.landed && Math.abs(physics.floorY - 31) < 0.01, 'A fast fall should land on the floor');
  assert.ok(physics.jumped && physics.swam, 'Jumping and swimming should apply upward motion');
  assert.ok(physics.safeRespawn, 'Respawn should avoid blocks built at the starting point');
  assert.ok(physics.torchLit && physics.noon > physics.midnight, 'Torches and the day/night light cycle should affect the scene');
  await physicsContext.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mobilePage = await mobile.newPage();
  mobilePage.on('pageerror', error => errors.push(error.message));
  await ready(mobilePage);
  await mobilePage.getByRole('button', { name: 'ENTER THE WORLD' }).tap();
  assert.equal(await mobilePage.locator('.touch-controls').count(), 1);
  const mobileBefore = await mobilePage.locator('.player-info > span').innerText();
  const button = await mobilePage.getByRole('button', { name: 'forward' }).boundingBox();
  const cdp = await mobile.newCDPSession(mobilePage);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: button.x + button.width / 2, y: button.y + button.height / 2 }] });
  await mobilePage.waitForTimeout(2000);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mobilePage.waitForTimeout(500);
  assert.notEqual(await mobilePage.locator('.player-info > span').innerText(), mobileBefore, 'Touch movement should move the player');
  await mobilePage.getByRole('button', { name: 'OPEN PACK' }).tap();
  assert.equal(await mobilePage.getByRole('dialog').count(), 1);
  await mobile.close();
  assert.deepEqual(errors, [], 'There should be no uncaught browser errors');
  console.log('Wilds smoke test passed: movement, collisions, jumping, swimming, mining, crafting, placement, lighting, persistence, reset, weather, and touch.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}