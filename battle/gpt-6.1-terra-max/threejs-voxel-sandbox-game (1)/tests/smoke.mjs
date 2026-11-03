import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chromium, devices } from '@playwright/test'

const port = 4174
const url = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
let browser

async function savedWorld(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('blockhaven-world-v1') || 'null'))
}

async function mouseButton(page, button, down = true) {
  await page.evaluate(({ button, down }) => document.dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', { button, bubbles: true })), { button, down })
}

try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(url)).ok) break } catch { /* Wait for Vite to listen. */ }
    await new Promise((resolve) => setTimeout(resolve, 250))
    if (attempt === 59) throw new Error('Vite did not start')
  }
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(url)
  await page.waitForSelector('.welcome', { timeout: 90000 })
  assert.equal(await page.locator('canvas').count(), 1)

  // Craft a table, move it into the hotbar, and place it in the actual world.
  await page.keyboard.press('e')
  await page.waitForSelector('.inventory-modal')
  assert.equal(await page.locator('.recipe-row').nth(5).locator('button').isEnabled(), false)
  await page.locator('.recipe-row').nth(0).locator('button').click()
  await page.locator('.recipe-row').nth(2).locator('button').click()
  await page.getByLabel(/Hotbar slot 4: Dirt/).click()
  await page.getByLabel(/Backpack slot 1: Crafting Table/).click()
  await page.locator('.modal-close').click()
  await page.locator('.play-button').click()
  await page.waitForFunction(() => !!document.pointerLockElement)
  await page.evaluate(() => document.dispatchEvent(new MouseEvent('mousemove', { movementY: 260, bubbles: true })))
  await page.waitForTimeout(400)
  assert.ok((await page.locator('.target-name').allInnerTexts()).length, 'a block should be targetable')
  await mouseButton(page, 2)
  await page.waitForTimeout(500)
  let save = await savedWorld(page)
  assert.ok(Object.values(save.edits).includes(12), 'crafting table should be placed')

  // Right-clicking the table opens its recipes and unlocks the stone pickaxe.
  await mouseButton(page, 2)
  await page.waitForSelector('.inventory-modal')
  assert.match(await page.locator('.workstation-status').innerText(), /CRAFTING TABLE NEARBY/)
  await page.locator('.recipe-row').nth(1).locator('button').click()
  assert.equal(await page.locator('.recipe-row').nth(5).locator('button').isEnabled(), true)
  await page.locator('.recipe-row').nth(5).locator('button').click()
  save = await savedWorld(page)
  assert.ok(save.inventory.some((slot) => slot?.id === 'stone_pickaxe'))
  assert.equal(save.progress.tablePlaced, true)
  assert.equal(save.progress.stoneCrafted, true)
  await page.locator('.modal-close').click()
  await page.locator('.resume-prompt').click()
  await page.waitForFunction(() => !!document.pointerLockElement)

  // Mine the table, place a grass block, and walk through the world.
  await page.keyboard.press('1')
  await mouseButton(page, 0)
  await page.waitForTimeout(1200)
  await mouseButton(page, 0, false)
  await page.waitForTimeout(300)
  save = await savedWorld(page)
  assert.ok(save.inventory.some((slot) => slot?.id === 'crafting_table'), 'mined blocks should be collected')
  assert.ok(Object.values(save.edits).includes(0), 'mined blocks should be recorded')
  await page.keyboard.press('3')
  await mouseButton(page, 2)
  await page.waitForTimeout(300)
  save = await savedWorld(page)
  assert.ok(Object.values(save.edits).includes(1), 'selected blocks should be placeable')
  const before = await page.locator('.coordinates').innerText()
  await page.keyboard.down('w')
  await page.waitForTimeout(1400)
  await page.keyboard.up('w')
  await page.waitForTimeout(300)
  assert.notEqual(await page.locator('.coordinates').innerText(), before, 'W should move the player')
  await page.keyboard.press('Escape')
  await page.waitForSelector('.pause-modal')
  await page.getByRole('button', { name: 'Save world' }).click()
  save = await savedWorld(page)
  assert.equal(save.progress.walked, true)
  const edits = JSON.stringify(save.edits)
  await page.reload()
  await page.waitForSelector('.welcome', { timeout: 90000 })
  assert.equal(JSON.stringify((await savedWorld(page)).edits), edits, 'edits should survive a reload')
  assert.deepEqual(errors, [])
  console.log('Desktop: movement, mining, placement, crafting, workstations, pause, and persistence passed.')

  const mobile = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  const touchPage = await mobile.newPage()
  await touchPage.goto(url)
  await touchPage.waitForSelector('.welcome', { timeout: 90000 })
  await touchPage.locator('.play-button').tap()
  assert.equal(await touchPage.locator('.touch-button').count(), 7)
  await touchPage.locator('.inventory-shortcut button').tap()
  await touchPage.waitForSelector('.inventory-modal')
  await touchPage.locator('.recipe-row').first().locator('button').tap()
  assert.equal((await savedWorld(touchPage)).progress.crafted, true)
  await touchPage.locator('.modal-close').tap()
  await touchPage.setViewportSize({ width: 844, height: 390 })
  assert.equal(await touchPage.getByLabel('Move forward').isVisible(), true, 'landscape touch controls should remain visible')
  console.log('Mobile: touch controls and crafting passed.')
  await mobile.close()
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
}