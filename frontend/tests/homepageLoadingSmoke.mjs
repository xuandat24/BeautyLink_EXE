import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
// Isolated Spring/H2 fixture only. External artwork is deterministic, not visual/provider evidence.
const base = 'http://localhost:5173';
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1366, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage(); const errors = [], homeQueries = []; let documents = 0, homeReads = 0, categoryReads = 0;
    page.on('domcontentloaded', () => documents++);
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { const u = new URL(r.url()); if (u.pathname === '/api/v1/homepage/services') { homeReads++; homeQueries.push(u.search); } if (/categories\/spa\/services$/.test(u.pathname)) categoryReads++; });
    await page.route('https://**/*', route => route.request().resourceType() === 'image'
      ? route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0TkAAAAASUVORK5CYII=', 'base64') })
      : route.fulfill({ contentType: 'application/javascript', body: '' }));
    const locations = await (await page.request.get(base + '/api/v1/locations')).json();
    await context.addInitScript(location => {
      localStorage.setItem('beautylink_onboarding_v1', JSON.stringify({ version: 1, completedAt: Date.now(), locationId: location.id, city: location.name, category: 'all' }));
    }, locations[0]);
    let releaseHome;
    await page.route('**/api/v1/homepage/services?*', async route => {
      if (homeReads === 1) await new Promise(resolve => { releaseHome = resolve; });
      await route.continue();
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const brand = page.getByRole('link', { name: 'BeautyLink — Trang chủ', exact: true });
    await brand.waitFor();
    await page.waitForFunction(() => document.querySelector('main img[fetchpriority="high"]')?.naturalWidth > 0);
    assert.equal(await page.locator('main').isVisible(), true, 'homepage shell renders while catalog is delayed');
    while (!releaseHome) await new Promise(resolve => setTimeout(resolve, 20));
    releaseHome();
    await page.getByTitle('Thêm vào giỏ', { exact: true }).first().waitFor();
    assert.equal(new Set(homeQueries).size, homeReads, 'no duplicate reads for the same location; validated onboarding may replace initial all-location scope');
    // Cards may be painted from the location-specific response while the earlier all-location
    // response is still pending. Reload only after both snapshots are persisted; otherwise
    // aborting the first document legitimately requires fetching that missing scope again.
    await page.waitForFunction(async locationId => {
      const { beautyApi } = await import('/src/services/beautyApi.ts');
      return beautyApi.cachedHomepageServices() !== null && beautyApi.cachedHomepageServices(locationId) !== null;
    }, locations[0].id);
    await page.screenshot({ path: `backend/target/homepage-loading-home-${width}.png`, fullPage: true });
    const initialReads = homeReads;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTitle('Thêm vào giỏ', { exact: true }).first().waitFor();
    assert.equal(homeReads, initialReads, 'fresh public snapshot survives reload without waiting for a second API request');
    const beforeNavigation = documents;
    let releaseChunk;
    await page.route('**/src/components/CategoryServicePage.tsx*', async route => {
      await new Promise(resolve => { releaseChunk = resolve; }); await route.continue();
    }, { times: 1 });
    await page.locator('#categories').getByRole('button', { name: 'Spa & Massage', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Đang mở nội dung' }).waitFor();
    assert.equal(await page.locator('#categories').isVisible(), true, 'old homepage remains visible while route chunk loads');
    while (!releaseChunk) await new Promise(resolve => setTimeout(resolve, 20));
    releaseChunk();
    await page.getByRole('heading', { name: 'Spa & Massage', exact: true }).waitFor();
    await page.getByText('Đang tìm đối tác…', { exact: true }).waitFor({ state: 'hidden' });
    const reads = categoryReads;
    await brand.click();
    await page.locator('#categories').waitFor();
    assert.equal(documents, beforeNavigation, 'logo exits via SPA without document reload');
    await page.locator('#categories').getByRole('button', { name: 'Spa & Massage', exact: true }).click();
    await page.getByRole('heading', { name: 'Spa & Massage', exact: true }).waitFor();
    assert.equal(categoryReads, reads, 'return visit uses same-location category snapshot');
    assert.equal(documents, beforeNavigation);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `backend/target/homepage-loading-${width}.png`, fullPage: true });
    results.push({ width, homeReads, categoryReads, spaDocumentReloads: documents - beforeNavigation });
    await context.close();
  }
  console.log('PASS homepage delayed API/chunk, cached reload/category return, logo SPA, desktop/mobile:', JSON.stringify(results));
} finally { await browser.close(); }
