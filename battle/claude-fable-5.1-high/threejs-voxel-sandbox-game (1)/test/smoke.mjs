import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync } from 'fs';

const html = readFileSync('dist/index.html');
const server = createServer((req, res) => { res.writeHead(200, {'Content-Type':'text/html'}); res.end(html); }).listen(4173);

const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto('http://localhost:4173/');
await page.waitForTimeout(800);
await page.screenshot({ path: 'test/01_menu.png' });
await page.click('text=Create New World');
await page.fill('input[placeholder*="emerald"]', '12345');
await page.screenshot({ path: 'test/02_create.png' });
const t0 = Date.now();
await page.click('text=Create World');
await page.waitForFunction(() => document.body.innerText.includes('Click to play'), null, { timeout: 120000 });
console.log('Loaded in', Date.now() - t0, 'ms');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'test/03_game.png' });
const info = await page.evaluate(() => {
  const g = window.__game;
  return { pos: [g.player.body.x, g.player.body.y, g.player.body.z], chunks: g.world.chunks.size, meshed: g.world.stats.meshed, fps: g.fps, calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, onGround: g.player.body.onGround, mobs: g.mobs.mobs.length };
});
console.log(JSON.stringify(info));
// Simulate: look down a bit, break block in front, place
const sim = await page.evaluate(async () => {
  const g = window.__game;
  const log = [];
  g.player.pitch = -0.6;
  await new Promise(r => setTimeout(r, 300));
  log.push('target: ' + JSON.stringify(g['target']));
  // creative-like instant break for test via breakBlock
  const t = g['target'];
  if (t) { g.breakBlock(t.x, t.y, t.z, true); }
  await new Promise(r => setTimeout(r, 1500));
  log.push('items: ' + g.items.items.length + ' inv: ' + JSON.stringify(g.inventory.slots.filter(Boolean)));
  // walk forward for 2 seconds
  g.keys.add('KeyW');
  const start = [g.player.body.x, g.player.body.z];
  await new Promise(r => setTimeout(r, 1500));
  g.keys.delete('KeyW');
  log.push('moved: ' + Math.hypot(g.player.body.x - start[0], g.player.body.z - start[1]).toFixed(2));
  log.push('fps: ' + g.fps + ' light: ' + g.world.getLight(Math.floor(g.player.body.x), Math.floor(g.player.eyeY), Math.floor(g.player.body.z)));
  // night test
  g.sky.time = 0.7;
  await new Promise(r => setTimeout(r, 500));
  return log;
});
console.log(sim.join('\n'));
await page.screenshot({ path: 'test/04_night.png' });
await page.evaluate(() => { const g = window.__game; g.sky.time = 0.2; g.openUI('table'); });
await page.waitForTimeout(500);
await page.screenshot({ path: 'test/05_inventory.png' });
console.log('Errors:', errors.slice(0, 10));
await browser.close();
server.close();
