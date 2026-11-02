import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const service = { id: 701, name: 'Nail', price: 100000, originalPrice: 100000, durationMinutes: 60, imageUrl: 'https://example.test/service.jpg', categorySlug: 'nail', rating: 0, supplierId: 77, supplierName: 'Salon kiểm thử', supplierAddress: 'Hà Nội', supplierBusinessType: 'NAIL', supplierNearbyFeatured: true, supplierReviewCount: 0, practitioners: [] };
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1366, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.addInitScript(() => localStorage.setItem('beautylink_onboarding_v1', JSON.stringify({ version: 1, completedAt: Date.now(), locationId: 1, city: 'Hà Nội', category: 'all' })));
    await page.route('https://chat.topaichat.vn/sdk.js', route => route.abort());
    await page.route('**/api/v1/**', async route => {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,OPTIONS', 'access-control-allow-headers': 'content-type' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith('/homepage/services') || pathname.endsWith('/suppliers/77')) return route.fulfill({ json: [service], headers: cors });
      if (pathname.endsWith('/locations')) return route.fulfill({ json: [{ id: 1, name: 'Hà Nội', slug: 'ha-noi' }], headers: cors });
      await route.fulfill({ json: [], headers: cors });
    });
    await page.goto(process.env.SMOKE_BASE_URL || 'http://localhost:5173/');
    const nearby = page.locator('#nearby');
    const cards = nearby.locator('div.group').filter({ has: page.getByRole('button', { name: 'Yêu thích cơ sở' }) }).locator('h3');
    await cards.first().waitFor();
    const name = (await cards.first().textContent()).trim();
    await cards.first().click();
    await page.waitForURL(/#partner-detail$/);
    assert.equal((await page.getByTestId('partner-shop-name').textContent()).trim(), name);
    await page.close();
  }
  console.log('PASS nearby salon opens the matching partner on desktop and mobile');
} finally {
  await browser.close();
}
