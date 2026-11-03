import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
const require = createRequire('/tmp/package.json');
const puppeteer = require('puppeteer');
const { PNG } = require('pngjs');
const html = fs.readFileSync(new URL('../dist/index.html', import.meta.url));
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); });
await new Promise((r) => server.listen(8938, r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:8938', { waitUntil: 'networkidle0' });
await sleep(3000);
await page.screenshot({ path: '/tmp/f-title.png' });
await page.evaluate(() => { const g = window.__VH__; g.applySetting('shadows', false); g.applySetting('renderDist', 4); });
await page.click('#vh-new'); await page.type('#vh-seed', 'hello world'); await page.click('#vh-create');
let t0 = Date.now();
while (Date.now() - t0 < 60000 && !(await page.evaluate(() => window.__VH__?.waitingEnter))) await sleep(300);
await page.click('#vh-screen-loading');
await sleep(1500);

// walk toward clear direction using sim probe, then real keys
await page.evaluate(() => {
  const g = window.__VH__;
  const spawn = { ...g.player.pos };
  let best = { d: -1, yaw: 0 };
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    g.player.pos = { ...spawn }; g.player.vel = { x: 0, y: 0, z: 0 }; g.player.yaw = yaw;
    g.keys['KeyW'] = true;
    for (let i = 0; i < 60; i++) g.player.update(1 / 60, g.inputState(), g.playerHooks());
    const d = Math.hypot(g.player.pos.x - spawn.x, g.player.pos.z - spawn.z);
    if (d > best.d) best = { d, yaw };
  }
  g.keys['KeyW'] = false;
  g.player.pos = spawn; g.player.vel = { x: 0, y: 0, z: 0 }; g.player.yaw = best.yaw;
  g.player.pitch = -0.12;
});
await page.keyboard.down('KeyW');
await sleep(1500);
await page.keyboard.up('KeyW');
await page.screenshot({ path: '/tmp/f-game.png' });

// pause via API (now releases lock) then click through menus
await page.evaluate(() => window.__VH__.pause());
await sleep(250);
await page.click('#vh-pause-ach');
await sleep(250);
console.log('ach screen:', await page.evaluate(() => window.__VH__.ui.currentScreen));
await page.screenshot({ path: '/tmp/f-ach.png' });
await page.click('#vh-ach-back');
await sleep(200);
await page.click('#vh-pause-settings');
await sleep(200);
console.log('settings screen:', await page.evaluate(() => window.__VH__.ui.currentScreen));
await page.screenshot({ path: '/tmp/f-settings.png' });
// move render distance slider
await page.evaluate(() => { const el = document.querySelector('#vh-rd'); el.value = 3; el.dispatchEvent(new Event('input')); });
console.log('renderDist now:', await page.evaluate(() => window.__VH__.settings.renderDist));
await page.click('#vh-settings-back');
await sleep(200);
await page.click('#vh-resume');
await sleep(400);
console.log('resumed state:', await page.evaluate(() => window.__VH__.state));

// zombies at night chase & attack (fixed-step sim)
const zomb = await page.evaluate(() => {
  const g = window.__VH__;
  g.sky.time = 0.6;
  const p = g.player.pos;
  const z = g.entities.spawnMob('zombie', p.x + 8, p.y + 1, p.z);
  const d0 = Math.hypot(z.pos.x - p.x, z.pos.z - p.z);
  const hp0 = g.player.hp;
  for (let i = 0; i < 60 * 8; i++) {
    g.entities.updateMobs(1 / 60, 0, g.player);
    g.player.update(1 / 60, { forward: false, back: false, left: false, right: false, jump: false, sprint: false, sneak: false }, g.playerHooks());
    if (g.player.dead) break;
  }
  const d1 = Math.hypot(z.pos.x - p.x, z.pos.z - p.z);
  const res = { approached: d0 - d1 > 4, damagedPlayer: g.player.hp < hp0, zombieState: z.state };
  // fight back
  g.player.hp = 20; g.player.dead = false;
  const zhp0 = z.hp;
  g.entities.damageMob(z, 25, { x: 0, z: 1 });
  res.zombieDied = z.dead;
  res.achMonster = g.achievements.has('zombie');
  return res;
});
console.log('zombie AI:', JSON.stringify(zomb));
await sleep(800);
await page.screenshot({ path: '/tmp/f-night.png' });

const stats = (f) => {
  const p = PNG.sync.read(fs.readFileSync('/tmp/' + f + '.png'));
  let s = [0, 0, 0]; const set = new Set();
  for (let i = 0; i < p.width * p.height; i++) { s[0] += p.data[i*4]; s[1] += p.data[i*4+1]; s[2] += p.data[i*4+2]; if (i % 9 === 0) set.add((p.data[i*4] >> 4) + ',' + (p.data[i*4+1] >> 4) + ',' + (p.data[i*4+2] >> 4)); }
  return { avg: s.map((v) => Math.round(v / (p.width * p.height))), variety: set.size };
};
for (const f of ['f-title', 'f-game', 'f-night', 'f-ach', 'f-settings']) console.log(f, JSON.stringify(stats(f)));
console.log('ERRORS:', errors.length ? errors.slice(0, 8) : 'none');
await browser.close(); server.close();
