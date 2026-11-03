import puppeteer from "puppeteer";
import http from "http";
import fs from "fs";
import path from "path";

const root = path.resolve("dist");
const server = http.createServer((req, res) => {
  const p = path.join(root, req.url === "/" ? "index.html" : req.url.split("?")[0]);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404);
    return res.end("nf");
  }
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(fs.readFileSync(p));
});
await new Promise((r) => server.listen(5055, r));

const browser = await puppeteer.launch({
  headless: "new",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--window-size=1280,760",
    "--disable-dev-shm-usage",
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 760 });

const logs = [];
page.on("console", (m) => {
  const t = m.text();
  if (!t.includes("404") && !t.includes("WEBGL_debug")) logs.push(`[${m.type()}] ${t}`);
});
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}\n${(e.stack ?? "").slice(0, 400)}`));

await page.goto("http://localhost:5055/", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: "test/shot-menu.png" });

const click = (txt) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes(t));
    if (b) b.click();
    return !!b;
  }, txt);

await click("New world");
await new Promise((r) => setTimeout(r, 200));
await page.evaluate(() => {
  const inputs = [...document.querySelectorAll("input")];
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(inputs[1], "alpha-test");
  inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 150));
const t0 = Date.now();
await click("Create");
await page.waitForFunction(() => !!window.__game, { timeout: 120000 });
console.log(`world ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// let chunks stream in
await new Promise((r) => setTimeout(r, 12000));
await page.screenshot({ path: "test/shot-game.png" });

const probe = async (label) => {
  const s = await page.evaluate(() => {
    const g = window.__game;
    return {
      fps: +g.snapshot.fps.toFixed(1),
      chunks: g.world.chunks.size,
      ready: [...g.world.chunks.values()].filter((c) => c.state === 3).length,
      tris: Math.round(g.snapshot.tris / 1000),
      calls: g.snapshot.drawCalls,
      pos: g.snapshot.pos.map((v) => +v.toFixed(1)),
      biome: g.snapshot.biome,
      time: g.snapshot.timeStr,
      mobs: g.mobs.length,
      items: g.items.length,
      health: +g.health.toFixed(1),
      perf: Object.fromEntries(Object.entries(g.world.perf).map(([k, v]) => [k, Math.round(v)])),
    };
  });
  console.log(label, JSON.stringify(s));
  return s;
};
await probe("after-load ");

// ── interactions ──────────────────────────────────────────────────────────
// walk forward
await page.evaluate(() => {
  const g = window.__game;
  g.keys.KeyW = true;
});
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => {
  window.__game.keys.KeyW = false;
});
await probe("after-walk ");

// break the block we're looking at (force downward look at ground)
const mined = await page.evaluate(async () => {
  const g = window.__game;
  g.pitch = -1.2;
  const before = g.inv.slots.filter(Boolean).length;
  g.mouseDown[0] = true;
  await new Promise((r) => setTimeout(r, 4000));
  g.mouseDown[0] = false;
  return { before, after: g.inv.slots.filter(Boolean).length, broken: g.stats.broken ?? 0, items: g.items.length };
});
console.log("mining    ", JSON.stringify(mined));

// place a block
const placed = await page.evaluate(async () => {
  const g = window.__game;
  g.inv.add("cobblestone", 10);
  for (let i = 0; i < 9; i++) if (g.inv.slots[i]?.id === "cobblestone") g.inv.selected = i;
  g.pitch = -1.2;
  g.useItem ? null : null;
  g.mouseDown[2] = true;
  await new Promise((r) => setTimeout(r, 700));
  g.mouseDown[2] = false;
  return { placedStat: g.stats.placed ?? 0 };
});
console.log("placing   ", JSON.stringify(placed));

// lighting test: place a torch and read light
const light = await page.evaluate(() => {
  const g = window.__game;
  const x = Math.floor(g.body.pos.x) + 2;
  const z = Math.floor(g.body.pos.z);
  const y = g.world.surfaceHeight(x, z);
  const before = g.world.getLight(x + 1, y, z) & 15;
  g.world.setBlock(x, y, z, 43); // TORCH
  const after = g.world.getLight(x + 1, y, z) & 15;
  return { before, after };
});
console.log("torchlight", JSON.stringify(light));

// inventory & crafting
await page.evaluate(() => {
  const g = window.__game;
  g.inv.add("oak_log", 8);
  g.setScreen("inventory");
  g.markUi();
});
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: "test/shot-inventory.png" });
const crafted = await page.evaluate(() => {
  const g = window.__game;
  const rec = g.availableRecipes();
  const planks = rec.find((r) => r.out.id.includes("planks"));
  if (planks) g.craftRecipe(planks.i);
  return { recipeCount: rec.length, planks: g.inv.countOf("oak_planks") };
});
console.log("crafting  ", JSON.stringify(crafted));
await page.evaluate(() => window.__game.closeScreen());

// night + weather
await page.evaluate(() => {
  const g = window.__game;
  g.worldTime = 600 * 0.95;
  g.rainState = "thunder";
  g.rainIntensity = 0.9;
  g.pitch = 0;
});
await new Promise((r) => setTimeout(r, 4000));
await page.screenshot({ path: "test/shot-night.png" });
await probe("night     ");

// underwater / ocean check: teleport to sea level in an ocean if we can find one
await page.evaluate(() => {
  const g = window.__game;
  g.worldTime = 600 * 0.45;
  g.rainState = "clear";
  g.rainIntensity = 0;
  // search for water
  for (let r = 0; r < 240; r += 6) {
    for (let a = 0; a < 16; a++) {
      const x = Math.floor(g.body.pos.x + Math.cos(a) * r);
      const z = Math.floor(g.body.pos.z + Math.sin(a) * r);
      if (g.world.gen.heightAt(x, z) < 40) {
        g.body.pos.set(x + 0.5, 52, z + 0.5);
        g.body.vel.set(0, 0, 0);
        return;
      }
    }
  }
});
await new Promise((r) => setTimeout(r, 9000));
await page.screenshot({ path: "test/shot-water.png" });
await probe("water     ");

// spawn mobs and screenshot
await page.evaluate(() => {
  const g = window.__game;
  g.worldTime = 600 * 0.4;
  for (let i = 0; i < 6; i++) g.trySpawn && g.trySpawn();
});
await new Promise((r) => setTimeout(r, 3000));

// underground
await page.evaluate(() => {
  const g = window.__game;
  g.setMode("creative");
  g.flying = true;
  g.body.pos.y = 22;
  g.pitch = 0;
});
await new Promise((r) => setTimeout(r, 6000));
await page.screenshot({ path: "test/shot-cave.png" });
await probe("cave      ");

// save/load round trip
const saved = await page.evaluate(async () => {
  const g = window.__game;
  await g.save();
  const { loadWorld } = window.__persist;
  const d = await loadWorld(g.worldKey);
  return { ok: !!d, edits: Object.keys(d?.edits ?? {}).length, inv: (d?.inventory ?? []).filter(Boolean).length };
});
console.log("save      ", JSON.stringify(saved));

console.log("\n--- console output ---");
console.log(logs.slice(0, 40).join("\n") || "(clean)");

await browser.close();
server.close();
