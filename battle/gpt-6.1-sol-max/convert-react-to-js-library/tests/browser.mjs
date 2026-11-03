import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = process.env.TEST_BASE_URL ?? "http://localhost:5173";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const errors = [];
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.mpmDemo?.stats.particles > 0);
  await page.evaluate(() => window.mpmDemo.pause());
  assert.equal(await page.locator("h1").textContent(), "mpm.js");
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    1440,
  );
  console.log("PASS: overview runs the original WASM solver without overflow");

  await page.getByRole("tab", { name: "Water", exact: true }).click();
  assert.equal(await page.evaluate(() => window.mpmDemo.scene.id), "water");
  await page.getByRole("button", { name: "Add a wheel", exact: true }).click();
  assert.equal(await page.evaluate(() => window.mpmDemo.wheels.length), 1);
  assert.equal(
    await page.evaluate(() => Number.isFinite(window.mpmDemo.wheels[0].id)),
    true,
  );
  await page.evaluate(() => window.mpmDemo.wheels[0].setSpeed(-120));
  assert.equal(await page.evaluate(() => window.mpmDemo.wheels[0].speed), -120);
  await page.evaluate(async () => {
    await window.mpmDemo.step();
  });
  const before = await page.evaluate(() => window.mpmDemo.stats.particles);
  await page.evaluate(() =>
    window.mpmDemo.addParticles({
      material: "sand",
      center: [0.5, 0.32],
      radius: 0.03,
    }),
  );
  assert.ok(
    (await page.evaluate(() => window.mpmDemo.stats.particles)) > before,
  );
  await page.evaluate(() => window.mpmDemo.setGravity([0, -1]));
  console.log(
    "PASS: material switching, automatic wheels, live speed, stepping, particles, and gravity",
  );

  await page.getByRole("button", { name: "View code" }).click();
  await page
    .locator(".playground-code")
    .getByRole("button", { name: "Copy code" })
    .click();
  assert.match(
    await page.evaluate(() => navigator.clipboard.readText()),
    /MPM\.create/,
  );
  await page
    .getByRole("button", { name: "Reset simulation", exact: true })
    .click();
  assert.equal(await page.evaluate(() => window.mpmDemo.wheels.length), 0);
  console.log("PASS: live code, clipboard copying, and scene reset");

  await page
    .getByRole("button", { name: "Search documentation", exact: false })
    .first()
    .click();
  await page.getByRole("dialog").getByRole("textbox").fill("automatic");
  await page.keyboard.press("Enter");
  await page.waitForURL("**/#wheels");
  assert.match(await page.locator("h1").textContent(), /motion/);
  console.log("PASS: searchable documentation with keyboard navigation");

  for (const id of [
    "installation",
    "quick-start",
    "scenes",
    "materials",
    "runtime",
    "interactions",
    "api",
    "examples",
    "changelog",
  ]) {
    await page.goto(`${base}/#${id}`);
    await page.locator("h1").waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      1440,
      `${id} has horizontal overflow`,
    );
  }
  console.log("PASS: every documentation route and example collection");

  for (const file of [
    "mpm.js",
    "mpm.esm.js",
    "DOCUMENTATION.md",
    "mpm-js-1.0.0.zip",
  ]) {
    const response = await context.request.get(`${base}/downloads/${file}`);
    assert.equal(response.status(), 200);
    assert.ok((await response.body()).length > 1000);
  }
  console.log("PASS: library, module, Markdown, and ZIP downloads");

  await page.goto(`${base}/examples/index.html`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.sim?.stats.particles > 0);
  await page.evaluate(() => window.sim.pause());
  assert.equal(await page.evaluate(() => MPM.version), "1.0.0");
  const classic = await page.evaluate(async () => {
    const sim = window.sim;
    for (const material of MPM.materialTypes) {
      sim.loadScene(MPM.demoScene(material, 96));
      await sim.step();
      const { data, count } = sim.engine.exportParticles(0);
      if (!count) throw new Error(`${material} is empty`);
      for (let i = 0; i < count; i++)
        if (!Number.isFinite(data[i * 4 + 1]))
          throw new Error(`${material} contains NaN coordinates`);
    }
    let updates = 0;
    sim.loadScene(
      MPM.createScene({
        resolution: 96,
        particles: [{ material: "sand", center: [0.5, 0.6], radius: 0.08 }],
        setup({ sim: active }) {
          active.addWheel({ center: [0.5, 0.3], speed: 60 });
        },
        update() {
          updates++;
        },
      }),
    );
    await sim.step();
    return {
      updates,
      wheels: sim.wheels.length,
      count: sim.stats.particles,
      time: sim.stats.time,
    };
  });
  assert.ok(
    classic.updates > 0 &&
      classic.wheels === 1 &&
      classic.count > 0 &&
      classic.time > 0,
  );
  console.log(
    "PASS: classic script without React, all six materials, custom setup and update callbacks",
  );

  const moduleResult = await page.evaluate(async () => {
    const module = await import("/downloads/mpm.esm.js");
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:300px;height:200px";
    document.body.append(canvas);
    const sim = await module.create({
      canvas,
      autoplay: false,
      scene: module.createScene({
        resolution: 64,
        particles: [{ material: "water", center: [0.5, 0.6], radius: 0.1 }],
      }),
    });
    await sim.step();
    const result = { particles: sim.stats.particles, version: module.version };
    sim.destroy();
    canvas.remove();
    return result;
  });
  assert.ok(moduleResult.particles > 0 && moduleResult.version === "1.0.0");
  console.log(
    "PASS: ES module distribution, initialization, stepping, and lifecycle cleanup",
  );

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const touch = await mobile.newPage();
  touch.on("pageerror", (error) => errors.push(error.message));
  await touch.goto(base, { waitUntil: "networkidle" });
  await touch.waitForFunction(() => window.mpmDemo?.stats.particles > 0);
  await touch.evaluate(() => window.mpmDemo.pause());
  assert.equal(
    await touch.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await touch.evaluate(async () => {
    await window.mpmDemo.step();
  });
  const touchBefore = await touch.evaluate(
    () => window.mpmDemo.stats.particles,
  );
  await touch.locator("canvas").tap({ position: { x: 170, y: 115 } });
  assert.ok(
    (await touch.evaluate(() => window.mpmDemo.stats.particles)) > touchBefore,
  );
  await touch.getByRole("button", { name: "Open navigation" }).click();
  await touch
    .getByRole("button", { name: "Creating scenes", exact: true })
    .click();
  await touch.waitForURL("**/#scenes");
  assert.match(await touch.locator("h1").textContent(), /Your world/);
  console.log(
    "PASS: mobile layout, actual touchscreen pouring, and responsive navigation",
  );
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log("PASS: no uncaught browser errors");
} finally {
  await browser.close();
}
