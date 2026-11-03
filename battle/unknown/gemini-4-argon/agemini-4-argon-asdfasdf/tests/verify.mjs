import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'test-artifacts');
fs.mkdirSync(OUT_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
};

function startStaticServer(baseDir, port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = decodeURIComponent(req.url.split('?')[0]);
      const rel = cleanUrl === '/' ? '/index.html' : cleanUrl;
      const full = path.join(baseDir, rel);
      if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(full);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(full).pipe(res);
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function runSuite() {
  // Test BOTH plain static root server AND built dist server!
  const rootServer = await startStaticServer(ROOT, 4178);
  const distServer = await startStaticServer(path.join(ROOT, 'dist'), 4179);

  const browser = await chromium.launch({
    channel: 'chromium',
    headless: true,
    args: [
      '--enable-webgl',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--ignore-gpu-blocklist',
      '--disable-dev-shm-usage',
      '--disable-features=CDPScreenshotNewSurface',
    ],
  });

  async function saveFramePNG(page, filename) {
    const dataUrl = await page.evaluate(() => {
      const g = window.__TERRACRAFT__;
      g.renderer.render(g.scene, g.camera);
      return g.canvas.toDataURL('image/png');
    });
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(path.join(OUT_DIR, filename), Buffer.from(base64, 'base64'));
  }

  const errors = [];
  try {
    // 1. Verify plain static HTML/JS/CSS server loads cleanly with importmap!
    const staticPage = await browser.newPage({ viewport: { width: 960, height: 600 } });
    staticPage.on('pageerror', (e) => errors.push(`[static pageerror] ${e.message}`));
    staticPage.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`[static console.error] ${msg.text()}`);
    });
    await staticPage.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' });
    await staticPage.waitForFunction(() => window.__TERRACRAFT__?.worldReady === true, { timeout: 10000 });
    console.log('✅ Plain HTML/ES-Module static server booted cleanly with live WebGL!');
    await staticPage.close();

    // 2. Full End-to-End Gameplay + Persistence + Visual Screenshot Suite on dist/index.html
    const context = await browser.newContext({ viewport: { width: 960, height: 600 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`[dist pageerror] ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`[dist console.error] ${msg.text()}`);
    });

    await page.goto('http://127.0.0.1:4179/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__TERRACRAFT__?.worldReady === true, { timeout: 10000 });
    await page.waitForTimeout(800);

    // Screenshot 1: Title screen over live 3D voxel landscape
    await saveFramePNG(page, '01-title.png');
    console.log('📸 Captured 01-title.png');

    // Click Create & Play New World
    await page.fill('#input-world-name', 'Verification Valley');
    await page.fill('#input-world-seed', 'Terra-2026');
    await page.click('#btn-create-world');
    await page.waitForTimeout(900);

    const startState = await page.evaluate(() => {
      const g = window.__TERRACRAFT__;
      const t0 = performance.now();
      g.worldGen.generateChunk(12, 12);
      const genMs = performance.now() - t0;

      const t1 = performance.now();
      g.chunkManager.rebuildChunkMesh(12, 12);
      const meshMs = performance.now() - t1;

      // Sample WebGL pixels from upper sky and lower terrain to confirm crisp live 3D rendering!
      const gl = g.renderer.getContext();
      g.renderer.render(g.scene, g.camera);
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const skyPx = new Uint8Array(4);
      const terrainPx = new Uint8Array(4);
      gl.readPixels((w * 0.5) | 0, (h * 0.85) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, skyPx);
      gl.readPixels((w * 0.5) | 0, (h * 0.28) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, terrainPx);

      return {
        modal: g.ui.activeModal,
        pos: { x: g.player.position.x, y: g.player.position.y, z: g.player.position.z },
        onGround: g.player.onGround,
        chunksMeshed: g.chunkManager.chunkMeshMap.size,
        mobsCount: g.mobs.mobs.length,
        genChunkMs: Number(genMs.toFixed(2)),
        meshChunkMs: Number(meshMs.toFixed(2)),
        skyRGBA: Array.from(skyPx),
        terrainRGBA: Array.from(terrainPx),
      };
    });
    console.log('🌍 Initial World State & Benchmarks:', startState);

    // Screenshot 2: Crisp morning gameplay HUD + 3D landscape + hand viewmodel
    await saveFramePNG(page, '02-gameplay-day.png');
    console.log('📸 Captured 02-gameplay-day.png');

    // Test walking + jumping physics
    await page.keyboard.down('KeyW');
    await page.keyboard.down('Space');
    await page.waitForTimeout(1350);
    await page.keyboard.up('Space');
    await page.keyboard.up('KeyW');

    const movedPos = await page.evaluate(() => ({
      x: window.__TERRACRAFT__.player.position.x,
      y: window.__TERRACRAFT__.player.position.y,
      z: window.__TERRACRAFT__.player.position.z,
    }));
    const movedDist = Math.hypot(movedPos.x - startState.pos.x, movedPos.z - startState.pos.z);
    console.log(`🏃 Player walked & jumped distance: ${movedDist.toFixed(2)} blocks`);
    if (movedDist < 0.8) throw new Error('Player movement failed!');

    // Aim directly downward at solid ground block & mine until a real drop is harvested into inventory!
    await page.evaluate(() => {
      const g = window.__TERRACRAFT__;
      g.player.pitch = -1.42;
      g.player.mouseButtons.left = true;
    });
    await page.waitForFunction(
      () => window.__TERRACRAFT__.inventory.totalCollected.size >= 1,
      { timeout: 12000 }
    );
    await page.evaluate(() => {
      window.__TERRACRAFT__.player.mouseButtons.left = false;
    });

    const afterMine = await page.evaluate(() => {
      const g = window.__TERRACRAFT__;
      return {
        modifiedBlocks: g.chunkManager.getModifiedBlockCount(),
        dirtCollected: g.inventory.countMatching('block:2'),
        activeDrops: g.drops.drops.length,
      };
    });
    console.log('⛏️ Mining & Drop Pickup Result:', afterMine);
    if (afterMine.modifiedBlocks < 1) throw new Error('Mining did not modify chunk blocks!');

    // Test Crafting Progression: Add 3 Oak Logs -> open Inventory [E] -> craft Oak Planks -> Sticks -> Wooden Pickaxe!
    await page.evaluate(() => {
      window.__TERRACRAFT__.inventory.addItem('block:14', 3); // 3 Oak Logs
    });
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(250);

    // Craft Oak Planks twice (8 planks) + Sticks once (4 sticks)
    await page.click('[data-recipe-id="oak_planks"] button');
    await page.click('[data-recipe-id="oak_planks"] button');
    await page.click('[data-recipe-id="sticks"] button');
    await page.waitForTimeout(150);

    // Screenshot 3: Inventory & Friendly Crafting Screen showing unlocked Wooden Tools at top!
    await saveFramePNG(page, '03-inventory-crafting.png');
    console.log('📸 Captured 03-inventory-crafting.png');

    await page.click('[data-recipe-id="wood_pickaxe"] button');
    const hasPickaxe = await page.evaluate(() =>
      window.__TERRACRAFT__.inventory.countMatching('tool:wood_pickaxe')
    );
    console.log(`🔨 Crafted Wooden Pickaxe count: ${hasPickaxe}`);
    if (hasPickaxe < 1) throw new Error('Crafting Wooden Pickaxe failed!');

    // Verify 0 broken icon images across the entire rendered UI!
    const brokenImages = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img')).filter((img) => !img.src || img.naturalWidth === 0).length
    );
    if (brokenImages > 0) throw new Error(`Found ${brokenImages} broken UI icons!`);
    console.log('✅ Verified 0 broken isometric/sprite UI icons across Inventory & Recipes!');

    // Test Furnace Smelting progression: Iron Ore + Coal -> Iron Ingot -> Iron Sword!
    await page.evaluate(() => {
      const inv = window.__TERRACRAFT__.inventory;
      inv.addItem('block:25', 2); // 2 Iron Ore
      inv.addItem('item:coal', 2);
    });
    await page.click('[data-station-tab="smelting"]');
    await page.click('[data-recipe-id="smelt_iron"] button');
    await page.click('[data-recipe-id="smelt_iron"] button');
    await page.click('[data-station-tab="crafting"]');
    await page.click('[data-recipe-id="iron_sword"] button');

    const hasIronSword = await page.evaluate(() =>
      window.__TERRACRAFT__.inventory.countMatching('tool:iron_sword')
    );
    console.log(`⚔️ Smelted Iron Ingots & forged Iron Sword: ${hasIronSword}`);
    if (hasIronSword < 1) throw new Error('Smelting Iron & forging Iron Sword failed!');

    await page.keyboard.press('KeyE'); // Close inventory
    await page.waitForTimeout(150);

    // Test Sneak Edge Guard on an isolated 1x1 sky block at y = 80!
    const sneakStayedSafe = await page.evaluate(async () => {
      const g = window.__TERRACRAFT__;
      const sx = Math.floor(g.player.position.x) + 10;
      const sz = Math.floor(g.player.position.z);
      // Clear air around (sx, 80, sz) and place single block at (sx, 79, sz)
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          for (let y = 76; y <= 84; y++) {
            g.chunkManager.setBlock(sx + dx, y, sz + dz, 0, false);
          }
        }
      }
      g.chunkManager.setBlock(sx, 79, sz, 31, true); // 1x1 Stone Brick platform
      g.player.position.set(sx + 0.5, 80.0002, sz + 0.5);
      g.player.velocity.set(0, 0, 0);
      g.player.onGround = true;
      g.player.yaw = 0;
      g.player.keys.add('ShiftLeft');
      g.player.keys.add('KeyW');
      for (let i = 0; i < 40; i++) {
        g.player.stepPhysics(1 / 60);
      }
      g.player.keys.delete('ShiftLeft');
      g.player.keys.delete('KeyW');
      const safeY = g.player.position.y;
      // Restore player nicely to spawn ground
      const ground = g.chunkManager.findSurfaceY(g.player.spawnPoint.x, g.player.spawnPoint.z);
      g.player.position.set(g.player.spawnPoint.x, ground.y + 0.001, g.player.spawnPoint.z);
      return safeY >= 79.99;
    });
    console.log(`🛡️ Sneak Edge-Fall Protection verified on 1x1 sky block: ${sneakStayedSafe}`);
    if (!sneakStayedSafe) throw new Error('Sneak edge guard failed!');

    // Test Live Creature Combat & Treasure Chest Loot!
    const combatAndChest = await page.evaluate(() => {
      const g = window.__TERRACRAFT__;
      const px = Math.floor(g.player.position.x);
      const py = Math.floor(g.player.position.y);
      const pz = Math.floor(g.player.position.z);

      // Test mob combat kill -> drops Wool + Raw Venison
      const testSheep = g.mobs.spawnMob('sheep', px, py + 0.1, pz - 2);
      const killed = g.mobs.damageMob(testSheep, 12, 0, -1);

      // Test opening a Treasure Chest block
      g.chunkManager.setBlock(px + 1, py, pz - 2, 46, true);
      const dropsBefore = g.drops.drops.length;
      g.player.openRuinChest(px + 1, py, pz - 2);
      const dropsAfter = g.drops.drops.length;

      return { killed, chestLootStacks: dropsAfter - dropsBefore };
    });
    console.log('🐉 Combat & Treasure Chest Verification:', combatAndChest);
    if (!combatAndChest.killed || combatAndChest.chestLootStacks < 4) {
      throw new Error('Combat or chest loot verification failed!');
    }

    // Build a cozy lit stone-brick & oak structure with Lanterns & Torches in front of camera for night lighting check!
    const placedPos = await page.evaluate(() => {
      const g = window.__TERRACRAFT__;
      const bx = Math.floor(g.player.position.x);
      const by = Math.floor(g.player.position.y);
      const bz = Math.floor(g.player.position.z) - 6;

      // Cozy arch / shrine of Oak Planks, Stone Bricks, Red Wool roof, Glass & Glowing Lanterns/Torches
      for (let x = -2; x <= 2; x++) {
        g.chunkManager.setBlock(bx + x, by - 1, bz, 31, false); // Stone Bricks foundation
        g.chunkManager.setBlock(bx + x, by + 3, bz, 44, false); // Crimson Wool roof
      }
      g.chunkManager.setBlock(bx - 2, by, bz, 14, false);
      g.chunkManager.setBlock(bx - 2, by + 1, bz, 14, false);
      g.chunkManager.setBlock(bx - 2, by + 2, bz, 14, false);
      g.chunkManager.setBlock(bx + 2, by, bz, 14, false);
      g.chunkManager.setBlock(bx + 2, by + 1, bz, 14, false);
      g.chunkManager.setBlock(bx + 2, by + 2, bz, 14, false);
      g.chunkManager.setBlock(bx - 1, by, bz, 15, false);
      g.chunkManager.setBlock(bx + 1, by, bz, 15, false);
      g.chunkManager.setBlock(bx - 1, by + 1, bz, 29, false); // Glass window
      g.chunkManager.setBlock(bx + 1, by + 1, bz, 29, false); // Glass window
      g.chunkManager.setBlock(bx, by, bz, 32, false);         // Crafting Table
      g.chunkManager.setBlock(bx, by + 2, bz + 1, 35, true);  // Glowing Lantern!
      g.chunkManager.setBlock(bx - 2, by + 1, bz + 1, 34, true); // Torch!
      g.chunkManager.setBlock(bx + 2, by + 1, bz + 1, 34, true); // Torch!

      // Spawn a Sheep & Cow right nearby so we can visually inspect 3D creatures too!
      g.mobs.spawnMob('sheep', bx - 1.5, by + 0.1, bz + 2.4);
      g.mobs.spawnMob('cow', bx + 1.8, by + 0.1, bz + 2.6);

      // Select Wooden Pickaxe in hand!
      const pickSlot = g.inventory.slots.findIndex((s) => s?.id === 'tool:wood_pickaxe');
      if (pickSlot >= 0) g.inventory.selectSlot(pickSlot);
      g.ui.renderHotbar();

      g.player.yaw = 0;
      g.player.pitch = -0.06;
      g.atmosphere.setTimePreset('sunset');
      return { bx, by, bz };
    });

    await page.waitForTimeout(500);
    await saveFramePNG(page, '04-sunset-build-mobs.png');
    console.log('📸 Captured 04-sunset-build-mobs.png');

    // Test Starlit Night + Torch/Lantern warm 3D light propagation + Rain!
    await page.evaluate(() => {
      const g = window.__TERRACRAFT__;
      g.atmosphere.setTimePreset('night');
      g.atmosphere.setWeather('rain');
    });
    await page.waitForTimeout(500);
    await saveFramePNG(page, '05-night-rain-torches.png');
    console.log('📸 Captured 05-night-rain-torches.png');

    // Also measure night torchlight warm pixel vs distant dark night sky pixel!
    const nightPixelStats = await page.evaluate(() => {
      const g = window.__TERRACRAFT__;
      g.renderer.render(g.scene, g.camera);
      const gl = g.renderer.getContext();
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const centerPx = new Uint8Array(4);
      const topSkyPx = new Uint8Array(4);
      gl.readPixels((w * 0.5) | 0, (h * 0.52) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, centerPx);
      gl.readPixels((w * 0.5) | 0, (h * 0.92) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, topSkyPx);
      return {
        litStructureCenterRGBA: Array.from(centerPx),
        nightSkyRGBA: Array.from(topSkyPx),
      };
    });
    console.log('🏮 Night Torch & Lantern Lighting Readback:', nightPixelStats);

    // Test Persistence: Save world via Pause Menu -> Reload page -> Continue World -> Verify everything persisted!
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await saveFramePNG(page, '06-pause-menu.png');
    console.log('📸 Captured 06-pause-menu.png');

    await page.click('#btn-save-now');
    await page.waitForTimeout(350);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__TERRACRAFT__?.worldReady === true, { timeout: 10000 });
    await page.waitForTimeout(300);

    // Click "Continue 'Verification Valley'" button!
    await page.click('#btn-continue-world');
    await page.waitForTimeout(600);

    const restored = await page.evaluate(({ bx, by, bz }) => {
      const g = window.__TERRACRAFT__;
      return {
        lanternBlock: g.chunkManager.getBlock(bx, by + 2, bz + 1),
        craftTableBlock: g.chunkManager.getBlock(bx, by, bz),
        pickaxeCount: g.inventory.countMatching('tool:wood_pickaxe'),
        weather: g.atmosphere.weather,
      };
    }, placedPos);

    console.log('💾 Reloaded Persistent World Verification:', restored);
    if (restored.lanternBlock !== 35 || restored.craftTableBlock !== 32 || restored.pickaxeCount < 1) {
      throw new Error('World persistence reload check failed!');
    }

    if (errors.length > 0) {
      console.error('❌ Runtime Errors Detected:', errors);
      process.exitCode = 1;
    } else {
      console.log('🎉 ALL RUNTIME TESTS PASSED WITH ZERO CONSOLE OR PAGE ERRORS!');
    }
  } finally {
    await browser.close();
    rootServer.close();
    distServer.close();
  }
}

runSuite();
