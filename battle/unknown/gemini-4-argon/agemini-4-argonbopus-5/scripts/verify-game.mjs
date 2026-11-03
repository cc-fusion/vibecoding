import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const SHOTS_DIR = path.resolve('test-shots');
fs.mkdirSync(SHOTS_DIR, { recursive: true });
const htmlContent = fs.readFileSync(path.resolve('dist/index.html'));

function startStaticServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlContent);
    });
    srv.listen(0, '127.0.0.1', () => {
      resolve({ srv, port: srv.address().port });
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const { srv, port } = await startStaticServer();
  const consoleErrors = [];
  const pageErrors = [];

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await sleep(900);

    // 1. Screenshot Title Screen over live 3D flyover
    await page.screenshot({ path: path.join(SHOTS_DIR, '01-title.png') });

    const titleCheck = await page.evaluate(() => ({
      state: window.terravox?.state,
      chunks: window.terravox?.world?.getStats().loadedChunks,
      tris: window.terravox?.world?.getStats().triangles,
    }));
    console.log('1. Title Screen Check:', titleCheck);

    // 2. Enter New Survival World
    await page.click('#btn-create-world');
    await sleep(1100);

    const spawnCheck = await page.evaluate(() => {
      const g = window.terravox;
      // Aim slightly toward horizon/landscape for scenic view
      g.player.pitch = -0.16;
      g.player.yaw = 0.65;
      return {
        state: g.state,
        pos: { x: g.player.pos.x, y: g.player.pos.y, z: g.player.pos.z },
        onGround: g.player.onGround,
        biome: document.getElementById('hud-biome')?.textContent,
        stats: g.world.getStats(),
        creatures: g.entities.creatures.length,
      };
    });
    console.log('2. Spawn & Physics Check:', spawnCheck);

    await sleep(400);
    await page.screenshot({ path: path.join(SHOTS_DIR, '02-daytime-gameplay.png') });

    // 3. Test WASD Movement & Jump
    await page.keyboard.down('KeyW');
    await sleep(350);
    await page.keyboard.press('Space');
    await sleep(350);
    await page.keyboard.up('KeyW');
    await sleep(400);

    const movedPos = await page.evaluate(() => ({
      x: window.terravox.player.pos.x,
      y: window.terravox.player.pos.y,
      z: window.terravox.player.pos.z,
    }));
    const distMoved = Math.hypot(movedPos.x - spawnCheck.pos.x, movedPos.z - spawnCheck.pos.z);
    console.log('3. Movement Distance:', distMoved.toFixed(2));

    // 4. Test Progressive Block Breaking + Magnetic Drop Pickup
    await page.evaluate(() => {
      const g = window.terravox;
      // Aim steeply down at adjacent Grass/Dirt block (hardness 0.65s)
      g.player.pitch = -1.28;
    });
    await sleep(150);

    const targetBefore = await page.evaluate(() => window.terravox.currentRayHit);
    console.log('4a. Raycast Target Before Mining:', targetBefore);

    await page.mouse.move(640, 360);
    await sleep(50);
    await page.evaluate(() => {
      if (window.terravox.state === 'paused') window.terravox.resumeGameplay();
    });
    await page.mouse.down({ button: 'left' });
    await sleep(450);
    const midMine = await page.evaluate(() => ({
      state: window.terravox.state,
      mouseDownLeft: window.terravox.mouseDownLeft,
      progress: window.terravox.mining.progress,
      hit: window.terravox.currentRayHit,
      locked: Boolean(document.pointerLockElement),
    }));
    console.log('4a-mid. Mid-Mine Snapshot:', midMine);
    await sleep(1700);
    await page.mouse.up({ button: 'left' });

    // Allow magnetic item drop to bounce and zip into player pack
    await sleep(950);

    const mineCheck = await page.evaluate(() => {
      const g = window.terravox;
      return {
        blocksMined: g.stats.blocksMined,
        nonEmptySlots: g.inventory.slots.filter(Boolean).length,
        playerPos: g.player.pos,
        drops: g.entities.drops.map((d) => ({ id: d.id, x: d.x, y: d.y, z: d.z, age: d.age })),
      };
    });
    console.log('4b. Mining & Drop Collection Check:', mineCheck);
    if (mineCheck.blocksMined < 1 || mineCheck.nonEmptySlots < 2) {
      throw new Error(`Mining or drop pickup failed: ${JSON.stringify(mineCheck)}`);
    }

    // 5. Test Crafting & Furnace Smelting Flow + Workshop UI Screenshot
    await page.evaluate(() => {
      const g = window.terravox;
      g.inventory.addItem(18, 3);  // OAK_LOG
      g.inventory.addItem(4, 8);   // COBBLESTONE
      g.inventory.addItem(103, 2); // RAW_IRON
      g.inventory.addItem(102, 1); // COAL
    });

    await page.keyboard.press('KeyE');
    await sleep(250);

    // Craft Oak Planks twice (8 planks total), then Sticks & Crafting Table!
    await page.evaluate(() => {
      const findCraftBtn = (substr) => {
        const cards = Array.from(document.querySelectorAll('#recipe-list .recipe-card'));
        const card = cards.find((c) => (c.querySelector('strong')?.textContent || '').includes(substr));
        return card?.querySelector('.btn-craft-action:not(:disabled)');
      };
      findCraftBtn('Oak Planks')?.click();
      findCraftBtn('Oak Planks')?.click();
      findCraftBtn('Crafting Table')?.click();
      findCraftBtn('Wooden Stick')?.click();
    });
    await sleep(220);
    await page.screenshot({ path: path.join(SHOTS_DIR, '03-inventory-crafting.png') });

    // Close inventory, place Crafting Table & Torch, test Night + Torchlight!
    await page.keyboard.press('KeyE');
    await sleep(200);

    const nightPlaceCheck = await page.evaluate(() => {
      const g = window.terravox;
      g.inventory.addItem(37, 2); // LANTERN
      g.inventory.addItem(36, 4); // TORCH
      g.ui.renderHotbar(g.inventory);

      const bx = Math.floor(g.player.pos.x) + 2;
      const bz = Math.floor(g.player.pos.z) + 2;
      const by = g.world.getSurfaceHeight(bx, bz) + 1;
      g.world.setBlock(bx, by, bz, 34, true); // Crafting Table
      g.world.setBlock(bx, by + 1, bz, 37, true); // Lantern on top of Table!
      g.world.setBlock(bx - 2, g.world.getSurfaceHeight(bx - 2, bz + 1) + 1, bz + 1, 36, true); // Torch
      g.world.setBlock(bx + 1, g.world.getSurfaceHeight(bx + 1, bz) + 1, bz, 35, true); // Stone Furnace

      // Look directly toward our glowing campsite at Night!
      const dx = (bx + 0.5) - g.player.pos.x;
      const dz = (bz + 0.5) - g.player.pos.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = -0.20;
      const torchSlot = g.inventory.slots.findIndex((s) => s?.id === 36);
      if (torchSlot >= 0 && torchSlot < 9) g.selectHotbarSlot(torchSlot);
      g.env.setTimeOfDay(0.03); // Starry night

      const pl = g.world.getPackedLight(bx, by + 1, bz + 1);
      return {
        placedTableId: g.world.getBlock(bx, by, bz),
        lanternNeighborBlockLight: pl & 0x0f,
        coords: { bx, by, bz },
      };
    });
    console.log('5. Night Torch/Lantern Light Check:', nightPlaceCheck);

    await sleep(450);
    await page.screenshot({ path: path.join(SHOTS_DIR, '04-night-torchlight.png') });

    // 6. Test Furnace Smelting (Raw Iron + Coal -> Iron Ingot)
    const smeltResult = await page.evaluate(() => {
      const g = window.terravox;
      g.openInventory('smelt', 'furnace');
      const cards = Array.from(document.querySelectorAll('#smelt-list .recipe-card'));
      const ironCard = cards.find((c) => c.textContent.includes('Iron Ingot'));
      ironCard?.querySelector('.btn-craft-action')?.click();
      const ingots = g.inventory.countItem(104); // IRON_INGOT
      const fuelChargesLeft = g.inventory.furnaceFuelCharges;
      g.resumeGameplay();
      return { ingots, fuelChargesLeft };
    });
    console.log('6. Furnace Smelt Check:', smeltResult);

    // 7. Test World Save, Return to Title, and Reload Persistence!
    await page.keyboard.press('Escape');
    await sleep(250);
    await page.screenshot({ path: path.join(SHOTS_DIR, '05-pause-settings.png') });

    await page.click('#btn-save-exit');
    await sleep(700);

    const savedRowsCount = await page.evaluate(() => {
      return document.querySelectorAll('.saved-world-row').length;
    });
    console.log('7a. Saved Worlds Listed on Title:', savedRowsCount);
    await page.screenshot({ path: path.join(SHOTS_DIR, '06-title-with-saved-world.png') });

    // Click Play on the saved world and verify placed Crafting Table & Iron Ingot persisted!
    await page.click('.saved-world-row .btn-primary');
    await sleep(900);

    const reloadCheck = await page.evaluate(({ bx, by, bz }) => {
      const g = window.terravox;
      return {
        state: g.state,
        ingotsPersisted: g.inventory.countItem(104),
        tableBlockPersisted: g.world.getBlock(bx, by, bz),
      };
    }, nightPlaceCheck.coords);
    console.log('7b. World Reload Persistence Check:', reloadCheck);

    if (smeltResult.ingots < 1 || smeltResult.fuelChargesLeft !== 7) {
      throw new Error(`Furnace smelt assertion failed: ${JSON.stringify(smeltResult)}`);
    }
    if (reloadCheck.ingotsPersisted < 1 || reloadCheck.tableBlockPersisted !== 34) {
      throw new Error(`World persistence assertion failed: ${JSON.stringify(reloadCheck)}`);
    }

    console.log('Console Errors:', consoleErrors);
    console.log('Page Errors:', pageErrors);

    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (browser) await browser.close();
    srv.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
