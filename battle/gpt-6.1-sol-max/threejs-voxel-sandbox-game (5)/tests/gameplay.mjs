import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
let passed = 0;
function check(name, condition) { assert.ok(condition, name); console.log(`PASS ${++passed}: ${name}`); }
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, acceptDownloads: true });
  page.setDefaultTimeout(45000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await page.addInitScript(() => {
    if (!localStorage.getItem('everwild.settings.v1')) localStorage.setItem('everwild.settings.v1', JSON.stringify({ shadows: false, renderDistance: 3, volume: 0 }));
  });
  await page.goto('http://localhost:5173');
  await page.getByRole('button', { name: 'Enter your world', exact: true }).waitFor({ timeout: 90000 });
  check('The complete procedural world loads', await page.evaluate(() => window.__everwild.ready && window.__everwild.world.chunks.size > 20));
  check('Arrival overlook is dry and clear of collisions', await page.evaluate(() => window.__everwild.position.y > 30 && !window.__everwild.collides(window.__everwild.position)));

  const deterministic = await page.evaluate(async () => {
    const { VoxelWorld } = await import('/src/game/world.ts');
    const a = new VoxelWorld('TEST-SEED', []), b = new VoxelWorld('TEST-SEED', []);
    a.getChunk(0, 0); a.getChunk(-1, 0); b.getChunk(-1, 0); b.getChunk(0, 0);
    let matches = true;
    for (let x = -4; x < 5; x++) for (let z = 0; z < 16; z++) for (let y = 12; y < 50; y++) if (a.get(x, y, z) !== b.get(x, y, z)) matches = false;
    a.set(-1, 65, 0, 7); a.chunks.delete('-1,0');
    const retained = a.get(-1, 65, 0) === 7;
    a.dispose(); b.dispose(); return { matches, retained };
  });
  check('Generation is deterministic across chunk generation order', deterministic.matches);
  check('Edits survive negative-coordinate chunk eviction and regeneration', deterministic.retained);

  await page.getByRole('button', { name: 'Enter your world', exact: true }).click();
  await page.waitForTimeout(500);
  check('Desktop play captures the mouse', await page.evaluate(() => !!document.pointerLockElement));
  const start = await page.evaluate(() => window.__everwild.position.toArray());
  await page.keyboard.down('w');
  await page.waitForFunction(origin => Math.hypot(window.__everwild.position.x - origin[0], window.__everwild.position.z - origin[2]) > 0.5, start, { timeout: 15000 }).catch(() => {});
  console.log('INPUT_STATE', await page.evaluate(() => ({ position: window.__everwild.position.toArray(), active: window.__everwild.active, keys: [...window.__everwild.keys], velocity: window.__everwild.velocity.toArray(), fps: window.__everwild.fps, yaw: window.__everwild.yaw })));
  await page.keyboard.up('w');
  const moved = await page.evaluate(() => window.__everwild.position.toArray());
  check('Real WASD input moves the first-person player', Math.hypot(moved[0] - start[0], moved[2] - start[2]) > 0.3);

  const physics = await page.evaluate(() => {
    const e = window.__everwild;
    e.renderer.setAnimationLoop(null); e.active = true; e.keys.clear();
    for (let x = 20; x <= 31; x++) for (let z = 27; z <= 40; z++) {
      e.world.set(x, 32, z, 3);
      for (let y = 33; y <= 38; y++) e.world.set(x, y, z, 0);
    }
    for (let x = 20; x <= 31; x++) for (let y = 33; y <= 36; y++) e.world.set(x, y, 27, 3);
    e.position.set(25.5, 33.001, 35.5); e.velocity.set(0, 0, 0); e.yaw = 0; e.pitch = -0.8; e.grounded = true;
    e.setKey('KeyW', true); for (let i = 0; i < 450; i++) e.physics(1 / 90); e.setKey('KeyW', false);
    const wall = e.position.z >= 28.279 && e.position.z < 29;
    const floor = Math.abs(e.position.y - 33) < 0.01;
    e.velocity.set(0, 0, 0); e.setKey('Space', true); e.physics(1 / 90); e.setKey('Space', false);
    let peak = e.position.y;
    for (let i = 0; i < 180; i++) { e.physics(1 / 90); peak = Math.max(peak, e.position.y); }
    const jump = peak > 34.1 && Math.abs(e.position.y - 33) < 0.01;
    e.position.set(25.5, 33.001, 35.5); e.velocity.set(0, 0, 0);
    e.camera.position.copy(e.position); e.camera.position.y += 1.61; e.camera.rotation.set(-0.8, 0, 0, 'YXZ'); e.camera.updateMatrixWorld();
    e.updateTarget(0);
    const target = e.target;
    e.selected = 3;
    const before = e.inventory[7], placedBefore = e.stats.placed;
    e.touchPlace();
    const cell = [target.x + target.normal[0], target.y + target.normal[1], target.z + target.normal[2]];
    const place = e.world.get(...cell) === 7 && e.inventory[7] === before - 1 && e.stats.placed === placedBefore + 1;
    e.selected = 7; e.mouseDown = true;
    for (let i = 0; i < 60; i++) e.updateTarget(1 / 90);
    e.mouseDown = false;
    const mine = e.world.get(...cell) === 0 && e.inventory[7] === before && e.stats.gathered[7] >= 1;
    for (let i = 0; i < 3; i++) { e.world.set(26, 33, 33, 5); e.breakBlock({ x: 26, y: 33, z: 33, id: 5, normal: [0, 0, 1], distance: 2 }); }
    const progression = e.stats.completed.includes('timber') && e.inventory[106] === 7;
    e.health = 10; const apples = e.inventory[106]; e.eat();
    const eating = e.health === 16 && e.inventory[106] === apples - 1;
    e.emitSnapshot(); e.previousTime = 0; e.renderer.setAnimationLoop(e.frame);
    return { wall, floor, jump, place, mine, progression, eating, peak };
  });
  check('Swept player collision stops at a solid wall', physics.wall);
  check('Player rests stably on the voxel floor', physics.floor);
  check('Jump rises, falls, and lands without tunneling', physics.jump);
  check('Block placement changes the world and consumes inventory', physics.place);
  check('Holding mine breaks the aimed block and collects its resource', physics.mine);
  check('Gathering advances a quest and delivers the real reward', physics.progression);
  check('Eating consumes an apple and restores health', physics.eating);

  const advancedPhysics = await page.evaluate(() => {
    const e = window.__everwild; e.renderer.setAnimationLoop(null);
    e.position.set(25.5, 33.001, 32.5); e.velocity.set(0, 0, 0); e.grounded = true;
    e.world.set(25, 33, 30, 3); e.world.set(26, 33, 30, 3); e.setKey('KeyW', true);
    let stepPeak = 33;
    for (let i = 0; i < 90; i++) { e.physics(1 / 90); stepPeak = Math.max(stepPeak, e.position.y); }
    e.setKey('KeyW', false); e.world.set(25, 33, 30, 0); e.world.set(26, 33, 30, 0);
    const step = stepPeak > 34 && !e.collides(e.position);
    e.position.set(25.5, 33.001, 35.5); e.velocity.set(0, 0, 0); e.grounded = true;
    for (let x = 24; x <= 27; x++) for (let z = 34; z <= 37; z++) e.world.set(x, 35, z, 3);
    e.setKey('Space', true); e.physics(1 / 90); e.setKey('Space', false);
    let ceilingPeak = e.position.y;
    for (let i = 0; i < 90; i++) { e.physics(1 / 90); ceilingPeak = Math.max(ceilingPeak, e.position.y); }
    const ceiling = ceilingPeak < 33.23 && !e.collides(e.position);
    for (let x = 24; x <= 27; x++) for (let z = 34; z <= 37; z++) e.world.set(x, 35, z, 0);
    e.position.set(25.5, 40, 35.5); e.velocity.set(0, 0, 0); e.health = 20;
    for (let i = 0; i < 180; i++) { e.elapsed += 1 / 90; e.physics(1 / 90); }
    const fall = e.health < 20 && e.health > 0 && Math.abs(e.position.y - 33) < 0.01;
    for (let x = 23; x <= 28; x++) for (let z = 33; z <= 38; z++) for (let y = 33; y <= 37; y++) e.world.set(x, y, z, 10);
    e.position.set(25.5, 33.001, 35.5); e.velocity.set(0, 0, 0); e.air = 10;
    for (let i = 0; i < 180; i++) { e.elapsed += 1 / 90; e.physics(1 / 90); }
    const breath = e.air < 8.1 && e.inWater;
    e.setKey('Space', true);
    for (let i = 0; i < 220; i++) { e.elapsed += 1 / 90; e.physics(1 / 90); }
    e.setKey('Space', false);
    const swimming = e.position.y > 36 && e.air > 8.5;
    for (let x = 23; x <= 28; x++) for (let z = 33; z <= 38; z++) for (let y = 33; y <= 37; y++) e.world.set(x, y, z, 0);
    e.position.set(25.5, 33.001, 35.5); e.velocity.set(0, 0, 0); e.health = 16; e.air = 10;
    let validFog = true;
    for (const distance of [3, 4, 5, 6, 7]) { e.settings.renderDistance = distance; e.underwater = false; e.updateAtmosphere(); validFog &&= e.scene.fog.near < e.scene.fog.far; }
    e.settings.renderDistance = 3; e.updateAtmosphere(); e.previousTime = 0; e.renderer.setAnimationLoop(e.frame);
    return { step, ceiling, fall, breath, swimming, validFog };
  });
  check('Automatic stepping climbs one-block ledges without clipping', advancedPhysics.step);
  check('Jumping cannot tunnel through a low ceiling', advancedPhysics.ceiling);
  check('Long falls produce real health damage and a stable landing', advancedPhysics.fall);
  check('Submersion drains the player breath meter', advancedPhysics.breath);
  check('Swimming rises to the surface and restores breath', advancedPhysics.swimming);
  check('Atmospheric fog remains valid at every view-distance setting', advancedPhysics.validFog);

  await page.keyboard.press('KeyE');
  await page.getByRole('dialog', { name: 'Backpack and crafting' }).waitFor();
  await page.getByRole('button', { name: 'Craft workbench', exact: true }).click();
  await page.getByRole('button', { name: 'Sticks', exact: true }).click();
  await page.getByRole('button', { name: 'Craft 4 sticks', exact: true }).click();
  await page.getByRole('button', { name: 'Stone pickaxe', exact: true }).click();
  await page.getByRole('button', { name: 'Craft stone pickaxe', exact: true }).click();
  check('Crafting stations unlock a connected tool recipe chain', await page.evaluate(() => window.__everwild.inventory[16] === 1 && window.__everwild.inventory[103] === 1 && window.__everwild.stats.completed.includes('stone-age')));
  await page.getByRole('button', { name: 'Building', exact: true }).last().click();
  await page.getByRole('button', { name: 'Glass', exact: true }).click();
  check('Missing ingredients and furnace correctly disable crafting', await page.getByRole('button', { name: 'A few more things to gather', exact: true }).isDisabled());

  const environmental = await page.evaluate(() => {
    const e = window.__everwild; e.time = 0.9; e.updateAtmosphere();
    const night = !e.sunDisc.visible && e.stars.material.opacity > 0.8;
    e.updateSettings({ ...e.settings, weather: 'rain' }); e.updateRain(0.01);
    const rain = e.weather === 'rain' && e.rain.visible;
    e.world.set(25, 33, 34, 17); e.updateTorches();
    const lights = e.torchLights.some(l => l.intensity > 0);
    e.time = 0.35; e.updateSettings({ ...e.settings, weather: 'clear' });
    e.save(); return { night, rain, lights, edits: e.world.edits.size };
  });
  check('Day-night cycle changes the sun and reveals stars', environmental.night);
  check('Weather changes activate real rain geometry', environmental.rain);
  check('Placed torches produce nearby dynamic light', environmental.lights);

  await page.reload();
  await page.getByRole('button', { name: 'Enter your world', exact: true }).waitFor({ timeout: 90000 });
  check('Reload restores block edits, inventory, progression, and health', await page.evaluate(count => {
    const e = window.__everwild; return e.world.edits.size === count && e.inventory[103] === 1 && e.stats.completed.includes('timber') && e.health >= 16;
  }, environmental.edits));
  await page.getByRole('button', { name: 'Open pause menu' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save & export', exact: true }).click();
  const download = await downloadPromise; await download.saveAs('artifacts/test-world.everwild.json');
  const exported = JSON.parse(fs.readFileSync('artifacts/test-world.everwild.json', 'utf8'));
  check('World export downloads an actual complete save file', exported.edits.length === environmental.edits && exported.inventory[103] === 1);
  await page.getByRole('button', { name: 'Your worlds', exact: true }).click();
  await page.getByRole('button', { name: 'Somewhere new to call your own', exact: true }).click();
  await page.getByLabel('A name for your world', { exact: true }).fill('Browser test world');
  await page.getByLabel('A seed of possibility', { exact: false }).fill('TESTING-42');
  await page.getByRole('button', { name: 'Grow a new world', exact: true }).click();
  await page.getByRole('button', { name: 'Enter your world', exact: true }).waitFor({ timeout: 90000 });
  check('Creating a seeded world preserves both independent worlds', await page.evaluate(() => {
    const worlds = JSON.parse(localStorage.getItem('everwild.worlds.v1')); return worlds.length === 2 && worlds.some(w => w.seed === 'TESTING-42') && worlds.some(w => w.inventory[103] === 1);
  }));
  check('The newly created world is the active persistent world', await page.evaluate(() => localStorage.getItem('everwild.active.v1') === window.__everwild.saveData.id));
  await page.getByLabel('Import world file', { exact: true }).setInputFiles('artifacts/test-world.everwild.json');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('everwild.worlds.v1')).length === 3 && window.__everwild?.inventory[103] === 1, null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Enter your world', exact: true }).waitFor({ timeout: 90000 });
  check('World import restores the exported build and creates a separate world', await page.evaluate(() => JSON.parse(localStorage.getItem('everwild.worlds.v1')).length === 3 && window.__everwild.inventory[103] === 1));
  check('No browser runtime or WebGL shader errors', errors.length === 0);
  console.log(`\n${passed} checks passed.`, errors);
} finally { await browser.close(); }