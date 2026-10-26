import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.CHAT_SMOKE_BASE_URL || 'http://localhost:5173';
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.addInitScript(() => localStorage.setItem('beautylink_onboarding_v1', JSON.stringify({ version: 1, completedAt: Date.now(), locationId: 1, city: 'Ho Chi Minh', category: 'all' })));
    // Reproduce the vendor's highest-z-index greeting without outbound chat traffic.
    await page.route('https://chat.topaichat.vn/sdk.js', route => route.fulfill({
      contentType: 'application/javascript', body: `
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;bottom:24px;right:24px;width:300px;height:170px;z-index:2147483647';
        const frame = document.createElement('iframe'); frame.title = 'TopAiChat Widget';
        frame.style.cssText = 'width:100%;height:100%;border:0';
        container.append(frame); document.body.append(container);
      `,
    }));
    try {
      await page.goto(`${base}/#login`, { waitUntil: 'domcontentloaded' });
      const frame = page.locator('iframe[title="TopAiChat Widget"]');
      await frame.waitFor({ state: 'visible' });
      assert.equal(await frame.count(), 1);
      await page.evaluate(() => {
        const dialog = document.createElement('div');
        dialog.id = 'chat-layering-test'; dialog.setAttribute('role', 'dialog');
        dialog.style.cssText = 'position:fixed;inset:0;z-index:50;background:white';
        const save = document.createElement('button'); save.textContent = 'Save test form';
        save.style.cssText = 'position:absolute;bottom:24px;right:24px;width:300px;height:170px';
        save.onclick = () => { window.__chatLayeringSaved = true; };
        dialog.append(save); document.body.append(dialog);
      });
      await page.getByRole('button', { name: 'Save test form', exact: true }).click({ timeout: 3000 });
      assert.equal(await page.evaluate(() => window.__chatLayeringSaved), true);
      await page.locator('#chat-layering-test').evaluate(node => node.remove());
      for (const hash of ['#account', '#home', '#login']) {
        await page.evaluate(hash => { location.hash = hash; }, hash);
        assert.equal(await frame.count(), 1);
        assert.equal(await frame.isVisible(), true);
      }
      console.log(`PASS ${viewport.width}x${viewport.height}: chat survives SPA routes and cannot intercept modal controls`);
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
