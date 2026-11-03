import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';

fs.mkdirSync('screenshots', { recursive: true });

function startPreviewServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let resolved = false;
    const onData = (chunk) => {
      if (!resolved && chunk.toString().includes('4173')) {
        resolved = true;
        resolve(proc);
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(proc);
      }
    }, 2500);
    proc.on('error', reject);
  });
}

const server = await startPreviewServer();
const errors = [];
let browser;

try {
  browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--use-angle=swiftshader',
    ],
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  const page = await context.newPage();

  page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`CONSOLE_ERROR: ${msg.text()}`);
    }
  });

  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);

  // 1. Title Screen
  await page.screenshot({ path: 'screenshots/01_title_screen.png' });

  // 2. Create New Survival World
  await page.click('#btn-open-new-world');
  await page.waitForTimeout(150);
  await page.fill('#input-world-name', 'Emerald Test Realm');
  await page.click('[data-seed="EmeraldValley"]');
  await page.click('#btn-start-world');
  await page.waitForTimeout(1600);

  await page.evaluate(() => {
    const g = window.__TERRAVOX__;
    g.settings.renderDistance = 3;
    g.applySettings();
    g.player.pitch = -0.15;
    g.player.yaw = 0.6;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/02_gameplay_morning.png' });

  // 3. Test Real Progressive Block Mining & Magnetic Pickup
  const mineTest = await page.evaluate(async () => {
    const g = window.__TERRAVOX__;
    const waitSimSeconds = async (secs) => {
      const steps = Math.ceil(secs / 0.04);
      for (let i = 0; i < steps; i++) {
        await new Promise((r) => requestAnimationFrame(r));
      }
    };
    // Let player settle onto ground for a few frames, then aim directly at block underfoot-front
    await waitSimSeconds(0.2);
    g.player.yaw = 0;
    g.player.pitch = -1.05;
    await waitSimSeconds(0.08);
    const targetBefore = g.player.targetBlock ? { ...g.player.targetBlock } : null;

    g.player.mouseDownLeft = true;
    await waitSimSeconds(0.85);
    g.player.mouseDownLeft = false;

    const dropsSpawned = g.drops.drops.length;
    // Walk forward & let magnetic pickup pull drop into inventory
    g.player.handleKeyDown('KeyW');
    await waitSimSeconds(0.75);
    g.player.handleKeyUp('KeyW');

    return {
      targetBefore,
      dropsSpawned,
      dirtPickedUp: g.inventory.countIngredient(2),
    };
  });
  console.log('Real mining & magnetic pickup test:', mineTest);
  if (mineTest.dirtPickedUp < 1 && mineTest.dropsSpawned < 1) {
    throw new Error('Expected progressive mining to break block and spawn/collect drop');
  }

  // 4. Build a Cozy Camp right in front of player (Crafting Table + Furnace + Torch + Lantern)
  await page.evaluate(() => {
    const g = window.__TERRAVOX__;
    const px = Math.floor(g.player.pos.x);
    const py = Math.floor(g.player.pos.y);
    const pz = Math.floor(g.player.pos.z) - 3;

    // Ensure flat stone patio for camp
    for (let dx = -1; dx <= 2; dx++) {
      g.world.setBlock(px + dx, py - 1, pz, 4, false); // Cobblestone base
      g.world.setBlock(px + dx, py, pz, 0, false);
      g.world.setBlock(px + dx, py + 1, pz, 0, false);
    }
    g.world.setBlock(px, py, pz, 26, true); // Crafting Table
    g.world.setBlock(px + 1, py, pz, 27, true); // Stone Furnace
    g.world.setBlock(px, py + 1, pz, 30, true); // Torch on Crafting Table
    g.world.setBlock(px - 1, py, pz, 31, true); // Sunstone Lantern
    g.progression.recordBlockPlaced(26);
    g.progression.recordBlockPlaced(30);

    // Give logs, coal, and iron ore to test full crafting + furnace smelting
    g.inventory.addItem(16, 4); // Oak Logs
    g.inventory.addItem(102, 3); // Coal
    g.inventory.addItem(33, 3); // Iron Ore

    // Aim directly at our built camp
    g.player.yaw = 0;
    g.player.pitch = -0.22;
  });
  await page.waitForTimeout(250);

  // Open Inventory & Craft Planks, Sticks, Wooden Pickaxe, AND Smelt Iron Ingots!
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(250);

  const craftResults = await page.evaluate(() => {
    const clickRecipe = (titlePrefix) => {
      const card = Array.from(document.querySelectorAll('.recipe-card.craftable')).find((el) =>
        el.querySelector('.recipe-title')?.textContent.startsWith(titlePrefix)
      );
      if (card) {
        card.click();
        return true;
      }
      return false;
    };
    const r1 = clickRecipe('Oak Planks');
    const r2 = clickRecipe('Oak Planks');
    const r3 = clickRecipe('Wooden Stick');
    const r4 = clickRecipe('Wooden Pickaxe');
    const r5 = clickRecipe('Iron Ingot');
    const r6 = clickRecipe('Iron Ingot');
    const r7 = clickRecipe('Iron Ingot');
    const r8 = clickRecipe('Iron Pickaxe');
    return { r1, r2, r3, r4, r5, r6, r7, r8, stationText: document.getElementById('station-indicator')?.textContent };
  });
  console.log('Crafting & Smelting results:', craftResults);
  if (!craftResults.r8) {
    throw new Error('Expected Iron Pickaxe to be craftable after smelting 3 Iron Ingots');
  }

  await page.waitForTimeout(200);
  await page.screenshot({ path: 'screenshots/03_inventory_crafting.png' });
  await page.click('#btn-close-inventory');
  await page.waitForTimeout(250);

  // Equip Iron Pickaxe in hand & capture Sunset
  await page.evaluate(() => {
    const g = window.__TERRAVOX__;
    const idx = g.inventory.slots.findIndex((s) => s && s.id === 108); // Iron Pickaxe
    if (idx >= 0 && idx < 9) g.inventory.selectHotbar(idx);
    g.sky.setTimePreset('sunset');
    g.player.yaw = 0.45;
    g.player.pitch = -0.05;
  });
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'screenshots/04_sunset_vista.png' });

  // Capture Midnight looking directly at our glowing Camp (Crafting Table + Torch + Furnace + Sunstone Lantern)!
  await page.evaluate(() => {
    const g = window.__TERRAVOX__;
    g.sky.setTimePreset('night');
    g.player.yaw = 0;
    g.player.pitch = -0.22;
  });
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'screenshots/05_night_torchlight.png' });

  // 5. Save & Reload Verification
  await page.evaluate(async () => {
    await window.__TERRAVOX__.exitToTitle();
  });
  await page.waitForTimeout(400);
  await page.click('#btn-continue-world');
  await page.waitForTimeout(900);

  const reloadVerify = await page.evaluate(() => {
    const g = window.__TERRAVOX__;
    return {
      hasIronPickaxe: g.inventory.slots.some((s) => s && s.id === 108),
      stations: g.getNearbyStations(),
    };
  });
  console.log('Reloaded world verification:', reloadVerify);
  if (!reloadVerify.hasIronPickaxe || !reloadVerify.stations.workbench || !reloadVerify.stations.furnace) {
    throw new Error('World persistence check failed');
  }

  // 6. Test Creative Mode + Alpine Peaks Biome + Flight
  await page.evaluate(async () => {
    await window.__TERRAVOX__.exitToTitle();
  });
  await page.waitForTimeout(300);
  await page.click('#btn-open-new-world');
  await page.waitForTimeout(150);
  await page.fill('#input-world-name', 'Alpine Creative');
  await page.click('[data-seed="FrostpeakCrags"]');
  await page.click('[data-mode="creative"]');
  await page.click('#btn-start-world');
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const g = window.__TERRAVOX__;
    g.player.isFlying = true;
    g.player.pos.y += 14;
    g.player.pitch = -0.22;
    g.player.yaw = 0.8;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/06_creative_alpine.png' });

  if (errors.length > 0) {
    console.error('BROWSER ERRORS DETECTED:', errors);
    process.exitCode = 1;
  } else {
    console.log('ALL EXPANDED CHECKS PASSED WITH ZERO ERRORS!');
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
