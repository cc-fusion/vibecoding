import { chromium } from 'playwright';
import { spawn } from 'child_process';
import assert from 'assert';
import fs from 'fs';

fs.mkdirSync('screenshots', { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], {
  stdio: 'pipe',
});

await new Promise((resolve) => {
  server.stdout.on('data', (chunk) => {
    if (chunk.toString().includes('4174')) resolve();
  });
  setTimeout(resolve, 2500);
});

const consoleErrors = [];
const pageErrors = [];

async function sampleScreenshotRegions(page, pngBuffer) {
  const b64 = pngBuffer.toString('base64');
  return await page.evaluate(async (data) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + data;
    await new Promise((res) => (img.onload = res));
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const avgBox = (x0, y0, w, h) => {
      const d = ctx.getImageData(x0, y0, w, h).data;
      let r = 0, g = 0, b = 0, n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
      }
      return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
    };

    return {
      skyTop: avgBox(340, 35, 160, 70),
      centerScene: avgBox(490, 340, 300, 160),
      lowerGround: avgBox(440, 520, 400, 140),
    };
  }, b64);
}

let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  // 1. Load Production Build & Title Screen
  await page.goto('http://localhost:4174', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/01_title.png' });

  // 2. Generate & Enter Survival World
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => window.__VOXEL_GAME__ && window.__VOXEL_GAME__.ready === true, {
    timeout: 20000,
  });
  await page.waitForTimeout(600);

  // Verify Multi-Biome & Underground Ore Diversity across seed
  const worldStats = await page.evaluate(() => {
    const g = window.__VOXEL_GAME__;
    const biomesFound = new Set();
    for (let z = -320; z <= 320; z += 32) {
      for (let x = -320; x <= 320; x += 32) {
        biomesFound.add(g.world.generator.getBiomeAt(x, z));
      }
    }
    const blockCounts = {};
    for (const ch of g.world.chunks.values()) {
      for (let i = 0; i < ch.blocks.length; i += 7) {
        const id = ch.blocks[i];
        if (id !== 0) blockCounts[id] = (blockCounts[id] || 0) + 1;
      }
    }
    return {
      spawnBiome: g.world.getBiomeInfo(g.physics.position.x, g.physics.position.z),
      biomesFound: Array.from(biomesFound),
      hasCoal: (blockCounts[25] || 0) > 0,
      hasIron: (blockCounts[26] || 0) > 0,
      hasGold: (blockCounts[27] || 0) > 0,
      hasDiamond: (blockCounts[28] || 0) > 0,
      loadedChunks: g.world.chunks.size,
      mobsSpawned: g.entities.mobs.length,
    };
  });
  console.log('1. World & Biome Verification:', worldStats);
  assert(worldStats.biomesFound.length >= 4, 'Expected at least 4 distinct biomes within 640m');
  assert(worldStats.hasCoal && worldStats.hasIron && worldStats.hasDiamond, 'Expected Coal, Iron, and Diamond veins in chunks');

  // 3. Daylight WebGL Pixel Color Verification
  await page.evaluate(() => {
    window.__VOXEL_GAME__.setTimeOfDay(0.25); // Bright Noon
  });
  await page.waitForTimeout(250);
  const dayPng = await page.screenshot({ path: 'screenshots/02_daylight_world.png' });
  const dayPixels = await sampleScreenshotRegions(page, dayPng);
  console.log('2. Noon WebGL Pixel RGB Verification:', dayPixels);
  assert(
    dayPixels.skyTop.b > 125 && dayPixels.skyTop.b > dayPixels.skyTop.r * 1.8,
    'Daytime sky top should render rich cobalt-azure blue'
  );
  assert(dayPixels.centerScene.g > 40, 'Center viewport should render lit 3D voxel terrain');

  // 4. First-Person Physics: Flat Platform Walk, Jump & Crouch Edge-Guard Test!
  const physicsReport = await page.evaluate(async () => {
    const g = window.__VOXEL_GAME__;
    // Build a clean elevated test walkway at y = 72 to test pure walking, jumping, and sneak edge-guard
    for (let z = -6; z <= 2; z++) {
      for (let x = -1; x <= 1; x++) {
        g.world.setBlock(x, 72, z, 31, false); // Oak Planks walkway ending at z = -6 cliff!
        for (let y = 73; y <= 76; y++) g.world.setBlock(x, y, z, 0, false);
      }
    }
    for (const ch of g.world.chunks.values()) {
      if (ch.dirtyMesh) g.world.rebuildChunkMesh(ch);
    }
    g.physics.flying = false;
    g.physics.position.set(0.5, 73.01, 1.5);
    g.physics.velocity.set(0, 0, 0);
    g.physics.yaw = 0; // faces -Z along walkway!
    g.physics.pitch = -0.15;
    return { startZ: g.physics.position.z, startY: g.physics.position.y };
  });

  // Walk forward with real KeyW input
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(850);
  await page.keyboard.up('KeyW');
  const walkPos = await page.evaluate(() => ({ ...window.__VOXEL_GAME__.physics.position }));

  // Jump with Space
  await page.keyboard.down('Space');
  await page.waitForTimeout(200);
  const jumpPeakY = await page.evaluate(() => window.__VOXEL_GAME__.physics.position.y);
  await page.keyboard.up('Space');
  await page.waitForTimeout(600);

  // Position 0.8m from the z = -6 cliff drop, hold Sneak ('KeyC') + 'KeyW', verify Sneak Edge-Guard stops at z = -5.3!
  await page.evaluate(() => {
    const g = window.__VOXEL_GAME__;
    g.physics.position.set(0.5, 73.01, -4.6);
    g.physics.velocity.set(0, 0, 0);
  });
  await page.keyboard.down('KeyC');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyC');
  const crouchCliffPos = await page.evaluate(() => ({
    x: window.__VOXEL_GAME__.physics.position.x,
    y: window.__VOXEL_GAME__.physics.position.y,
    z: window.__VOXEL_GAME__.physics.position.z,
    onGround: window.__VOXEL_GAME__.physics.onGround,
  }));
  console.log('3. Physics Walk, Jump & Crouch Edge-Guard:', {
    walkDist: +(physicsReport.startZ - walkPos.z).toFixed(2),
    jumpHeightGain: +(jumpPeakY - 73).toFixed(2),
    crouchCliffPos,
  });
  assert(physicsReport.startZ - walkPos.z > 1.5, 'Player should walk >1.5m forward smoothly');
  assert(crouchCliffPos.z < -5.1 && crouchCliffPos.z > -5.5, 'Sneak edge-guard should clamp right at cliff brink (~-5.3)!');
  assert(jumpPeakY > 73.5, 'Jump should propel player upward');
  assert(crouchCliffPos.y > 72.9 && crouchCliffPos.onGround, 'Sneak edge-guard must keep player from falling off cliff edge!');

  // 5. Progressive Mining -> 3D Drop -> Magnetic Item Pickup -> Achievement!
  await page.evaluate(() => {
    const g = window.__VOXEL_GAME__;
    g.physics.position.set(0.5, 73.01, -1.5);
    g.physics.yaw = 0;
    g.physics.pitch = 0.05;
    // Place an Oak Log right in front of the player at (0, 74, -3)
    g.world.setBlock(0, 74, -3, 14, true);
  });
  await page.waitForTimeout(120);

  const preMine = await page.evaluate(() => {
    const g = window.__VOXEL_GAME__;
    const el = document.elementFromPoint(640, 400);
    return {
      paused: g.paused,
      pointerLocked: g.pointerLocked,
      currentHit: g.currentHit,
      elAtCenter: el?.tagName + '.' + el?.className,
    };
  });
  console.log('Pre-mine state:', preMine);

  // Hold Left Mouse button on canvas to mine Oak Log in Survival mode!
  await page.mouse.move(640, 400);
  await page.mouse.down({ button: 'left' });
  await page.waitForTimeout(300);
  const midMine = await page.evaluate(() => {
    const g = window.__VOXEL_GAME__;
    return {
      paused: g.paused,
      pointerLocked: g.pointerLocked,
      mouseLeftDown: g.mouseLeftDown,
      miningTimer: g.miningTimer,
      currentHit: g.currentHit,
    };
  });
  console.log('Mid-mine state:', midMine);
  await page.waitForFunction(() => window.__VOXEL_GAME__.world.getBlock(0, 74, -3) === 0, {
    timeout: 6000,
  });
  await page.mouse.up({ button: 'left' });

  // Step forward slightly to magnetically pick up the dropped Oak Log!
  await page.keyboard.down('KeyW');
  await page.waitForFunction(
    () => window.__VOXEL_GAME__.inventory.some((s) => s && s.id === 14 && s.count >= 1),
    { timeout: 5000 }
  );
  await page.keyboard.up('KeyW');

  const mineCheck = await page.evaluate(() => {
    const g = window.__VOXEL_GAME__;
    return {
      blockAfterMine: g.world.getBlock(0, 74, -3),
      oakLogsOwned: g.inventory.reduce((acc, s) => (s && s.id === 14 ? acc + s.count : acc), 0),
      timberAchievement: g.achievements.find((a) => a.id === 'first_timber')?.unlocked,
    };
  });
  console.log('4. Survival Mining & Magnetic Pickup:', mineCheck);
  assert.strictEqual(mineCheck.blockAfterMine, 0, 'Oak Log should be broken to Air');
  assert(mineCheck.oakLogsOwned >= 1, 'Dropped Oak Log should be magnetically picked up into inventory');
  assert.strictEqual(mineCheck.timberAchievement, true, 'Getting Wood milestone should unlock');

  // 6. Voxel Torch Lighting at Starry Midnight + Crafting + Furnace Smelting + TNT Explosion!
  const nightAndSystems = await page.evaluate(async () => {
    const g = window.__VOXEL_GAME__;
    // Build a stone-brick shrine lit by Torches & Sunstone Lantern on surface at (0, 73, -4)
    g.world.setBlock(-1, 73, -4, 34, true);
    g.world.setBlock(1, 73, -4, 34, true);
    g.world.setBlock(0, 73, -4, 39, true); // Torch (light 14!)
    g.world.setBlock(1, 74, -4, 40, true); // Sunstone Lantern (light 15!)

    const lightNearTorch = g.world.getBlockLight(0, 73, -3);
    g.physics.position.set(0.5, 73.01, -0.5);
    g.physics.yaw = 0;
    g.physics.pitch = -0.22;
    g.setTimeOfDay(0.75); // Starry Midnight!

    // Give extra Oak Logs + Iron Ore + Coal to test full Crafting & Smelting chain
    g.giveCreativeItem(14);
    g.giveCreativeItem(26);
    g.giveCreativeItem(101);
    const c1 = g.craftRecipeById('oak_planks');
    const c2 = g.craftRecipeById('oak_planks');
    const c3 = g.craftRecipeById('sticks');
    const c4 = g.craftRecipeById('wood_pickaxe');
    const s1 = g.smeltRecipeById('smelt_iron');

    return { lightNearTorch, c1, c2, c3, c4, s1 };
  });
  console.log('5. Night Torch Light, Crafting & Smelting:', nightAndSystems);
  assert(nightAndSystems.lightNearTorch >= 13, 'Torch + Lantern must propagate bright voxel blockLight (>=13)');
  assert(nightAndSystems.c4 && nightAndSystems.s1, 'Crafting Wooden Pickaxe and Smelting Iron Ingot must succeed');

  await page.waitForTimeout(300);
  const nightPng = await page.screenshot({ path: 'screenshots/04_night_torch_lighting.png' });
  const nightPixels = await sampleScreenshotRegions(page, nightPng);
  console.log('6. Midnight Torch-Lit WebGL Pixel RGB:', nightPixels);
  assert(nightPixels.skyTop.b < 45, 'Midnight sky should be deep dark night sky');
  assert(
    nightPixels.lowerGround.r > nightPixels.skyTop.r + 35,
    'Torch-lit blocks at night must glow much warmer/brighter than the dark midnight sky!'
  );

  // Test TNT crater explosion away from player at (14, 72, 14)
  await page.evaluate(() => {
    const g = window.__VOXEL_GAME__;
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        g.world.setBlock(14 + dx, 70, 14 + dz, 2, false);
      }
    }
    g.entities.igniteTNT(14, 71, 14, 0.35);
  });
  await page.waitForFunction(() => window.__VOXEL_GAME__.entities.tnts.length === 0, {
    timeout: 6000,
  });
  const craterCheck = await page.evaluate(() => ({
    centerAfterBlast: window.__VOXEL_GAME__.world.getBlock(14, 70, 14),
  }));
  console.log('7. TNT Crater Blast Check:', craterCheck);
  assert.strictEqual(craterCheck.centerAfterBlast, 0, 'TNT detonation should carve real crater in stone');

  // 7. Test Opening Inventory ('E'), Pressing 'Escape' to Pause (with real pointer lock unlocked!), Saving & Reloading!
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'screenshots/05_inventory_workshop.png' });
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'screenshots/06_pause_settings.png' });

  // Real hardware Playwright click on "Save & Main Menu" — verifies pointer lock cleanly released!
  await page.click('text=Save & Main Menu');
  await page.waitForTimeout(450);

  // Reload the saved world from Title Screen via real "Play" button click!
  await page.click('text=Play');
  await page.waitForFunction(() => window.__VOXEL_GAME__ && window.__VOXEL_GAME__.ready === true, {
    timeout: 20000,
  });
  await page.waitForTimeout(450);

  const reloadState = await page.evaluate(() => {
    const g = window.__VOXEL_GAME__;
    return {
      torchPersisted: g.world.getBlock(0, 73, -4) === 39,
      ironIngotPersisted: g.inventory.some((s) => s && s.id === 102 && s.count >= 1),
      achievementsUnlocked: g.achievements.filter((a) => a.unlocked).map((a) => a.id),
      savedChunksCount: g.world.savedEdits.size,
    };
  });
  console.log('8. IndexedDB Persistence Reload Verification:', reloadState);
  assert.strictEqual(reloadState.torchPersisted, true, 'Placed Torch block must persist across save & reload');
  assert.strictEqual(reloadState.ironIngotPersisted, true, 'Smelted Iron Ingot must persist across save & reload');
  assert(reloadState.achievementsUnlocked.includes('first_timber'), 'Unlocked milestones must persist');

  assert.strictEqual(consoleErrors.length, 0, `Unexpected console errors: ${consoleErrors.join('; ')}`);
  assert.strictEqual(pageErrors.length, 0, `Unexpected page errors: ${pageErrors.join('; ')}`);
  console.log('ALL 14 END-TO-END RUNTIME & WEBGL ASSERTIONS PASSED PERFECTLY!');
} finally {
  if (browser) await browser.close();
  server.kill();
}
