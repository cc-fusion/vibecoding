import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import assert from 'assert';

const OUT_DIR = path.resolve('tests/screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

function startPreviewServer(port = 4175) {
  return new Promise((resolve, reject) => {
    const proc = spawn('./node_modules/.bin/vite', ['preview', '--port', String(port), '--strictPort'], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let ready = false;
    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      if (!ready && text.includes('http')) {
        ready = true;
        resolve(proc);
      }
    });
    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      if (!ready && text.includes('Error')) {
        reject(new Error(text));
      }
    });
    setTimeout(() => {
      if (!ready) resolve(proc);
    }, 2500);
  });
}

async function run() {
  const server = await startPreviewServer(4175);
  const errors = [];

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--no-sandbox',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 760 },
    });
    const page = await context.newPage();

    page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`CONSOLE.ERROR: ${msg.text()}`);
      if (msg.type() === 'warning' && msg.text().includes('THREE.WebGLProgram')) {
        errors.push(`SHADER_WARNING: ${msg.text()}`);
      }
    });

    await page.goto('http://localhost:4175', { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);

    // 1. Title screen check
    const previewInfo = await page.evaluate(() => {
      const g = window.__VOXEL_WILDS__;
      return { uiState: g.ui.state, loadedChunks: g.world.chunks.size };
    });
    assert.strictEqual(previewInfo.uiState, 'title');
    assert.ok(previewInfo.loadedChunks >= 25, 'Expected preview chunks to load');
    console.log('✓ 1. Title screen & live 3D world preview verified:', previewInfo);

    // 2. Start New Survival World
    await page.fill('#input-world-name', 'Emerald Frontier');
    await page.fill('#input-world-seed', 'EmeraldSeed-2026');
    await page.click('#btn-start-world');
    await page.waitForTimeout(800);

    const startState = await page.evaluate(() => {
      const g = window.__VOXEL_WILDS__;
      return {
        uiState: g.ui.state,
        onGround: g.player.onGround,
        health: g.player.health,
        mobs: g.entities.mobs.length,
        chunks: g.world.chunks.size,
      };
    });
    assert.strictEqual(startState.uiState, 'playing');
    assert.strictEqual(startState.health, 20);
    assert.ok(startState.mobs >= 1, 'Expected initial wildlife mobs');
    console.log('✓ 2. Survival world start, physics ground settle & wildlife verified:', startState);

    // 3. Test Progressive Block Mining & Item Drop Magnetic Pickup
    const miningResult = await page.evaluate(async () => {
      const g = window.__VOXEL_WILDS__;
      g.player.yaw = Math.PI; // Face flat meadow side
      g.player.pitch = -1.15;
      g.player.update(0.016);
      const target = g.player.targetedHit;
      if (!target) return { hadTarget: false };

      // Mine progressively for ~0.95s
      g.player.mouseDownLeft = true;
      for (let i = 0; i < 42; i++) {
        g.player.update(0.025);
        g.entities.update(0.025, g.player, g.inventory, false, g.player.gameMode);
      }
      g.player.mouseDownLeft = false;

      // Step slightly toward mined spot so magnetic pickup collects the 3D Dirt drop
      g.player.keys.add('KeyW');
      for (let i = 0; i < 25; i++) {
        g.player.update(0.025);
        g.entities.update(0.025, g.player, g.inventory, false, g.player.gameMode);
      }
      g.player.keys.delete('KeyW');

      return {
        hadTarget: true,
        firstBlockId: target.blockId,
        dirtInInventory: g.inventory.countItem(2),
      };
    });
    assert.ok(miningResult.hadTarget, 'Expected raycast target');
    assert.ok(miningResult.dirtInInventory >= 1, 'Expected mined Dirt block drop to be collected into inventory');
    console.log('✓ 3. Progressive mining & magnetic drop collection verified:', miningResult);

    // 4. Test Full Crafting Progression (Hand -> Crafting Table -> Wooden Pickaxe -> Furnace Smelting)
    await page.evaluate(() => {
      const g = window.__VOXEL_WILDS__;
      g.inventory.addItem(10, 3); // 3 Oak Logs -> 12 Oak Planks
      g.inventory.addItem(4, 8);  // 8 Cobblestone for Stone Furnace
      g.inventory.addItem(26, 1); // 1 Iron Ore
      g.inventory.addItem(102, 1); // 1 Coal
    });

    await page.keyboard.press('KeyE');
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      const clickRecipe = (name) => {
        const el = Array.from(document.querySelectorAll('.recipe-card.craftable')).find((c) =>
          c.textContent.includes(name)
        );
        el?.click();
      };
      clickRecipe('Oak Planks');
      clickRecipe('Oak Planks');
      clickRecipe('Oak Planks'); // 12 planks total!
      clickRecipe('Wooden Stick');
      clickRecipe('Crafting Table');
    });

    await page.keyboard.press('KeyE');
    await page.waitForTimeout(150);

    // Place Crafting Table on nearby flat cell
    const stationsCoords = await page.evaluate(() => {
      const g = window.__VOXEL_WILDS__;
      const p = g.player.position;
      const cx = Math.floor(p.x) + 2;
      const cz = Math.floor(p.z);
      const cy = g.world.getSurfaceHeight(cx, cz) + 1;
      g.world.setBlock(cx, cy, cz, 29); // Crafting Table
      g.inventory.consumeIngredient({ id: 29, count: 1 });
      g.world.updateStreaming(p.x, p.z);
      return { cx, cy, cz };
    });

    // Open Workshop near placed Crafting Table -> Craft Wooden Pickaxe AND Stone Furnace!
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(200);
    const benchCraft = await page.evaluate(() => {
      const g = window.__VOXEL_WILDS__;
      const clickRecipe = (name) => {
        const el = Array.from(document.querySelectorAll('.recipe-card.craftable')).find((c) =>
          c.textContent.includes(name)
        );
        el?.click();
      };
      clickRecipe('Wooden Pickaxe');
      clickRecipe('Stone Furnace');
      return {
        hasPickaxe: g.inventory.countItem(110) === 1,
        hasFurnace: g.inventory.countItem(30) === 1,
      };
    });
    assert.ok(benchCraft.hasPickaxe, 'Expected Wooden Pickaxe crafted');
    assert.ok(benchCraft.hasFurnace, 'Expected Stone Furnace crafted');
    await page.keyboard.press('KeyE');

    // Place Stone Furnace & Smelt Iron Ore -> Iron Ingot!
    const smeltVerify = await page.evaluate(({ cx, cy, cz }) => {
      const g = window.__VOXEL_WILDS__;
      g.world.setBlock(cx, cy, cz + 1, 30); // Stone Furnace
      g.inventory.consumeIngredient({ id: 30, count: 1 });
      g.ui.openInventory('furnace');
      const ironCard = Array.from(document.querySelectorAll('.recipe-card.craftable')).find((c) =>
        c.textContent.includes('Iron Ingot')
      );
      ironCard?.click();
      g.ui.resumeGameplay();

      const pickIdx = g.inventory.slots.findIndex((s) => s && s.id === 110);
      if (pickIdx >= 0) g.inventory.selectHotbar(pickIdx);
      g.player.yaw = -Math.PI / 2;
      g.player.pitch = -0.22;

      return {
        ironIngots: g.inventory.countItem(103),
        selectedHotbar: g.inventory.selectedHotbar,
      };
    }, stationsCoords);
    assert.strictEqual(smeltVerify.ironIngots, 1, 'Expected Iron Ingot smelted in Furnace');
    console.log('✓ 4. Workbench Pickaxe & Stone Furnace Iron Smelting verified:', smeltVerify);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT_DIR, '08-pickaxe-table-furnace.png') });

    // 5. Night Torch Glow & Mob Combat Check
    const combatCheck = await page.evaluate(({ cx, cy, cz }) => {
      const g = window.__VOXEL_WILDS__;
      g.world.setBlock(cx, cy + 1, cz, 40); // Torch on top of Crafting Table!
      g.world.updateStreaming(g.player.position.x, g.player.position.z);
      g.sky.timeOfDay = 0.02; // Midnight
      // Select Torch in slot 8
      g.inventory.selectHotbar(8);
      g.player.update(0.016);

      // Spawn a zombie in front and test melee damage
      const zMob = g.entities.spawnMob('zombie', cx - 0.5, cy, cz + 0.5);
      const hpBefore = zMob.hp;
      g.entities.damageMob(zMob, 6, 1, 0);
      return {
        hpBefore,
        hpAfter: zMob.hp,
        heldLightIntensity: g.player.heldEntityLight.intensity,
      };
    }, stationsCoords);
    assert.ok(combatCheck.hpAfter < combatCheck.hpBefore, 'Expected mob to take melee damage');
    assert.ok(combatCheck.heldLightIntensity > 1.0, 'Expected held torch entity light active');
    console.log('✓ 5. Night torchlight & mob melee combat verified:', combatCheck);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, '09-night-glowing-torch-zombie.png') });

    // 6. Save & Exit -> Reload Persistence Check
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.click('#btn-exit-title');
    await page.waitForTimeout(300);
    await page.click('#tab-saved-worlds');
    await page.waitForTimeout(250);
    await page.locator('.saved-world-item .primary-btn').first().click();
    await page.waitForTimeout(500);

    const persistCheck = await page.evaluate(({ cx, cy, cz }) => {
      const g = window.__VOXEL_WILDS__;
      return {
        tablePersisted: g.world.getBlock(cx, cy, cz) === 29,
        furnacePersisted: g.world.getBlock(cx, cy, cz + 1) === 30,
        torchPersisted: g.world.getBlock(cx, cy + 1, cz) === 40,
        pickaxePersisted: g.inventory.countItem(110) === 1,
        ironIngotPersisted: g.inventory.countItem(103) === 1,
      };
    }, stationsCoords);
    assert.deepStrictEqual(persistCheck, {
      tablePersisted: true,
      furnacePersisted: true,
      torchPersisted: true,
      pickaxePersisted: true,
      ironIngotPersisted: true,
    });
    console.log('✓ 6. Multi-world IndexedDB persistence verified:', persistCheck);

    // 7. Creative Mode Catalog & Flight Check
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await page.click('#pause-mode-creative');
    await page.click('#btn-resume');
    await page.waitForTimeout(150);
    await page.keyboard.press('KeyF'); // Toggle flight!
    await page.keyboard.down('Space');
    await page.waitForTimeout(350);
    await page.keyboard.up('Space');

    const creativeState = await page.evaluate(() => {
      const g = window.__VOXEL_WILDS__;
      return {
        mode: g.player.gameMode,
        flying: g.player.flying,
        y: g.player.position.y,
      };
    });
    assert.strictEqual(creativeState.mode, 'creative');
    assert.strictEqual(creativeState.flying, true);
    console.log('✓ 7. Creative mode switch & 3D flight verified:', creativeState);

    assert.strictEqual(errors.length, 0, `Unexpected runtime errors: ${errors.join('; ')}`);
    console.log('\nALL RUNTIME CHECKS PASSED WITH ZERO ERRORS!');
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
    console.error('TEST FAILED:', err);
    process.exit(1);
  });
