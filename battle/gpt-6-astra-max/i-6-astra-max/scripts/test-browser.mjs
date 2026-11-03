import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
const url = process.env.APP_URL || "http://localhost:5173";
const ready = () =>
  page.getByText("WASM ready", { exact: true }).waitFor({ timeout: 60000 });
const pause = async () => {
  const button = page.getByRole("button", {
    name: "Pause simulation",
    exact: true,
  });
  if (await button.count()) await button.click();
  await page.waitForTimeout(650);
};

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await ready();
  await page.waitForTimeout(1600);
  await pause();
  const before = await page.locator(".time-readout").innerText();
  await page.waitForTimeout(800);
  assert.equal(
    await page.locator(".time-readout").innerText(),
    before,
    "Pause must stop simulation time",
  );
  await page
    .getByRole("button", {
      name: "Advance one frame (Right arrow)",
      exact: true,
    })
    .click();
  await page.waitForTimeout(700);
  assert.notEqual(
    await page.locator(".time-readout").innerText(),
    before,
    "Step must advance simulation time",
  );
  console.log("PASS play, pause, and single-frame stepping");

  await page.getByRole("tab", { name: "Solver", exact: true }).click();
  await page.getByLabel("Particle count", { exact: true }).selectOption("4000");
  await page.getByRole("button", { name: "Apply & restart" }).click();
  await ready();
  await pause();
  assert.match(await page.locator(".simulation-status").innerText(), /4,000/);
  console.log("PASS solver configuration and restart");

  await page.getByRole("tab", { name: "Display", exact: true }).click();
  const ground = page.getByRole("switch", { name: "Ground grid", exact: true });
  await ground.click();
  assert.equal(await ground.getAttribute("aria-checked"), "false");
  await ground.click();
  await page
    .getByLabel("Color particles by", { exact: true })
    .selectOption("Velocity");
  await page
    .getByLabel("Color particles by", { exact: true })
    .selectOption("Material");
  await page.getByRole("tab", { name: "Scene", exact: true }).click();
  console.log("PASS display controls");

  for (const preset of ["1", "2", "3", "4"]) {
    await page.getByLabel("Scene preset", { exact: true }).selectOption(preset);
    await ready();
    await page.waitForTimeout(350);
    await pause();
    assert.equal(await page.locator(".error-overlay").count(), 0);
  }
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await page.getByRole("button", { name: "Apply & restart" }).click();
  await ready();
  await pause();
  assert.equal(await page.locator(".view-type").innerText(), "Front view");
  console.log("PASS all preset scenes and 2D switching");

  await page.getByRole("button", { name: "Export scene", exact: true }).click();
  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /Particle data & scene/ }).click();
  const json = await jsonDownload;
  const parsed = JSON.parse(await fs.readFile(await json.path(), "utf8"));
  assert.equal(parsed.solver, "taichi_mpm/full");
  assert.equal(parsed.settings.dimension, 2);
  assert(parsed.particles.length >= 4000);
  assert(parsed.particles.every((p) => p.position.every(Number.isFinite)));

  await page.getByRole("button", { name: "Export scene", exact: true }).click();
  const binaryDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /Full solver snapshot/ }).click();
  const binary = await binaryDownload;
  assert((await fs.stat(await binary.path())).size > 10000);
  console.log("PASS JSON particle export and native solver-state download");

  await page.getByRole("button", { name: "Examples", exact: true }).click();
  await page.getByRole("button", { name: /GRANULAR Sand collapse/ }).click();
  await ready();
  await pause();
  await page
    .getByRole("button", { name: "Documentation", exact: true })
    .click();
  assert.match(
    await page.getByRole("dialog").innerText(),
    /Not the compact 88-line demo/,
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  console.log("PASS examples, documentation, and keyboard dismissal");

  await fs.mkdir("artifacts", { recursive: true });
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await page.getByRole("tab", { name: "Solver", exact: true }).click();
  await page
    .getByLabel("Particle count", { exact: true })
    .selectOption("18000");
  await page.getByRole("button", { name: "Apply & restart" }).click();
  await ready();
  await page.getByRole("tab", { name: "Scene", exact: true }).click();
  await page.waitForTimeout(2000);
  await pause();
  await page.screenshot({
    path: "artifacts/desktop-final.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Mobile must not overflow horizontally",
  );
  await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
  console.log("PASS responsive mobile layout");
  assert.deepEqual(errors, [], "No browser runtime or WebGL errors");
  console.log("All browser tests passed.");
} finally {
  await browser.close();
}
