import { chromium } from "@playwright/test";
import fs from "node:fs";

fs.mkdirSync("artifacts", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto(process.env.APP_URL || "http://localhost:5173", {
  waitUntil: "domcontentloaded",
});
await page.getByText("WASM ready", { exact: true }).waitFor({ timeout: 60000 });
await page.waitForTimeout(2500);
await page
  .getByRole("button", { name: "Pause simulation", exact: true })
  .click();
await page.waitForTimeout(500);
await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
console.log("STATUS:", await page.locator(".simulation-status").innerText());
console.log("ERRORS:", errors);
await browser.close();
