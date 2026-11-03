import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on('pageerror', e => console.log('ERROR', e.message));
  page.on('console', e => { if (e.type() === 'error') console.log('CONSOLE_ERROR', e.text()); });
  await page.addInitScript(() => localStorage.setItem('everwild.settings.v1', JSON.stringify({ shadows: false, renderDistance: 4 })));
  await page.goto('http://localhost:5173');
  await page.getByRole('button', { name: 'Enter your world', exact: true }).waitFor({ timeout: 90000 });
  console.log('READY', await page.evaluate(() => {
    const e = window.__everwild;
    return { ready: e.ready, scene: e.scene.children.length, chunks: e.world.chunks.size, meshes: [...e.world.chunks.values()].filter(c => c.group).length, render: e.renderer.info.render, memory: e.renderer.info.memory, pos: e.position.toArray(), fps: e.fps };
  }));
  await page.screenshot({ path: 'artifacts/diagnostic.png', timeout: 120000 });
  console.log('SCREENSHOT_COMPLETE');
} finally { await browser.close(); }