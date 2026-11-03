// Headless runtime test (puppeteer installed in /tmp). Run: node scripts/rt.mjs
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
const require = createRequire('/tmp/package.json');
const puppeteer = require('puppeteer');

const html = fs.readFileSync(new URL('../dist/index.html', import.meta.url));
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); });
await new Promise((r) => server.listen(8931, r));

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--window-size=1280,720'],
});
const page = await browser.newPage();
// small viewport + no shadows: SwiftShader software rendering is ~20x slower than a GPU
await page.setViewport({ width: 800, height: 450 });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto('http://localhost:8931', { waitUntil: 'networkidle0', timeout: 60000 });
await sleep(4000);
await page.screenshot({ path: '/tmp/shot-title.png' });
console.log('state:', await page.evaluate(() => window.__VH__?.state));

// create survival world with fixed seed
await page.evaluate(() => { const g = window.__VH__; g.applySetting('shadows', false); g.applySetting('renderDist', 3); });
await page.click('#vh-new');
await sleep(300);
await page.type('#vh-seed', '424242');
await page.click('#vh-create');
const t0 = Date.now();
let ready = false;
while (Date.now() - t0 < 60000) {
  ready = await page.evaluate(() => window.__VH__?.waitingEnter === true);
  if (ready) break;
  await sleep(500);
}
console.log('world loaded:', ready, 'in', Date.now() - t0, 'ms');
await page.screenshot({ path: '/tmp/shot-loading.png' });
await page.click('#vh-screen-loading');
await sleep(2500);
console.log('state after enter:', await page.evaluate(() => window.__VH__?.state));
console.log('pointer locked:', await page.evaluate(() => !!document.pointerLockElement));
await page.screenshot({ path: '/tmp/shot-game.png' });

// movement
const posBefore = await page.evaluate(() => ({ ...window.__VH__.player.pos }));
await page.keyboard.down('KeyW');
await sleep(1500);
await page.keyboard.up('KeyW');
const posAfter = await page.evaluate(() => ({ ...window.__VH__.player.pos }));
console.log('moved distance:', Math.hypot(posAfter.x - posBefore.x, posAfter.z - posBefore.z).toFixed(2),
  'onGround:', await page.evaluate(() => window.__VH__.player.onGround));

// jump
await page.keyboard.press('Space');
await sleep(300);
console.log('jump vel.y:', (await page.evaluate(() => window.__VH__.player.vel.y)).toFixed(2));
await sleep(1000);

// inventory + crafting
await page.keyboard.press('KeyE');
await sleep(500);
console.log('inv state:', await page.evaluate(() => window.__VH__.state));
await page.evaluate(() => { window.__VH__.inv.add(7, 10); });
await sleep(300);
await page.screenshot({ path: '/tmp/shot-inv.png' });
await page.click('.vh-recipe');
await sleep(300);
console.log('planks after craft:', await page.evaluate(() => window.__VH__.inv.count(9)));
await page.keyboard.press('KeyE');
await sleep(500);
console.log('back to:', await page.evaluate(() => window.__VH__.state));

// mining (wait a frame after aiming so the camera matrix updates)
await page.evaluate(() => { window.__VH__.player.pitch = -Math.PI / 2 + 0.05; });
await sleep(400);
const mined = await page.evaluate(() => {
  const g = window.__VH__;
  const t = g.currentTarget();
  if (!t) return 'no target';
  const idBefore = t.id;
  g.breakBlock(t);
  return { idBefore, nowAir: g.world.getBlock(t.x, t.y, t.z) === 0 };
});
console.log('mining result:', JSON.stringify(mined));

// placing
const placed = await page.evaluate(() => {
  const g = window.__VH__;
  const i = g.inv.slots.findIndex((s) => s && s.id < 100);
  if (i < 0) return 'no block in inv';
  if (i >= 9) { g.inv.slots[0] = g.inv.slots[i]; g.inv.slots[i] = null; g.inv.selected = 0; }
  else g.inv.selected = i;
  g.inv.changed();
  const t = g.currentTarget();
  if (!t) return 'no target';
  g.placeCd = 0;
  g.useAction();
  return { id: g.world.getBlock(t.x + t.face[0], t.y + t.face[1], t.z + t.face[2]) };
});
console.log('placing result:', JSON.stringify(placed));
await sleep(500);
await page.screenshot({ path: '/tmp/shot-game2.png' });

// mobs
await page.evaluate(() => {
  const g = window.__VH__;
  const p = g.player.pos;
  g.entities.spawnMob('pig', p.x + 4, p.y + 2, p.z + 4);
  g.entities.spawnMob('zombie', p.x - 5, p.y + 2, p.z - 5);
});
await sleep(2000);
console.log('mobs:', await page.evaluate(() => window.__VH__.entities.mobs.map((m) => m.kind + '@' + m.pos.y.toFixed(1))));

// night + rain visuals
await page.evaluate(() => { const g = window.__VH__; g.sky.time = 0.55; g.sky.weather = 'precip'; g.sky.weatherTimer = 60; });
await sleep(2500);
await page.screenshot({ path: '/tmp/shot-night-rain.png' });

// pause + save
await page.evaluate(() => window.__VH__.pause());
await sleep(300);
await page.screenshot({ path: '/tmp/shot-pause.png' });
console.log('save exists:', await page.evaluate(() => !!localStorage.getItem('voxelheim_save_v1')));
console.log('approx fps (swiftshader):', Math.round(await page.evaluate(() => window.__VH__.fps)));

console.log('ERRORS:', errors.length ? errors.slice(0, 12) : 'none');
await browser.close();
server.close();