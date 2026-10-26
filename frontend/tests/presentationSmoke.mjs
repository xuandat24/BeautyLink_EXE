import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { insightsFixture, paymentFixture } from './adminV2Fixtures.ts';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.PRESENTATION_SMOKE_BASE_URL || 'http://127.0.0.1:5182';
const browser = await chromium.launch({ headless: true });
const user = { id: 7, fullName: 'Nguyễn Minh Anh', email: 'nguyen.minhanh+492.351@seed.beautylink.test', role: 'CUSTOMER', status: 'ACTIVE', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', salons: [] };
const service = { id: 11, name: 'Chăm sóc da chuyên sâu', price: 250000, originalPrice: 350000, durationMinutes: 60, imageUrl: '', categorySlug: 'spa', rating: 0, serviceReviewCount: 0, supplierId: 7, supplierRating: 0, supplierReviewCount: 0, supplierName: 'An Nhiên Spa', supplierBusinessType: 'SPA', supplierAddress: 'Quận 1', featured: true, supplierNearbyFeatured: true, supplierNewPartner: true, practitioners: [] };
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('https://chat.topaichat.vn/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
    await context.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      let json = [];
      if (/\/auth\/me$/.test(path)) json = { id: 1, fullName: 'Admin', role: 'ADMIN' };
      else if (path.endsWith('/dashboard/insights')) json = insightsFixture();
      else if (path.endsWith('/dashboard/payments')) json = paymentFixture();
      else if (path.endsWith('/admin/users/7')) json = user;
      else if (path.endsWith('/admin/users')) json = { content: [user], totalElements: 1, totalPages: 1, page: 0, size: 20 };
      else if (path.endsWith('/admin/bookings')) json = { content: [], totalElements: 0, totalPages: 0, page: 0, size: 5 };
      else if (path.endsWith('/categories')) json = [{ id: 1, name: 'Spa', slug: 'spa', imageUrl: '' }];
      else if (path.endsWith('/homepage/services') || path.endsWith('/spa/services')) json = [service];
      return route.fulfill({ json });
    });
    await page.addInitScript(() => {
      localStorage.setItem('beautylink_onboarding_v1', JSON.stringify({ version: 1, completedAt: Date.now(), locationId: 1, city: 'Ho Chi Minh', category: 'all' }));
    });
    try {
      await page.goto(`${base}/#home`);
      await page.getByText('4.9', { exact: true }).first().waitFor();
      await page.evaluate(() => {
        const sid = '11111111-1111-4111-8111-111111111111'; const expires = Date.now() + 3600000;
        const token = `header.${btoa(JSON.stringify({ sid, exp: Math.floor(expires / 1000) }))}.test-signature`;
        sessionStorage.setItem('beautylink_access_token', token);
        sessionStorage.setItem('beautylink_auth_meta_v1', JSON.stringify({ sid, lastActivityAt: Date.now(), absoluteExpiresAt: expires }));
      });
      await page.goto(`${base}/#admin-dashboard`); await page.reload();
      const completed = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Lịch hẹn hoàn thành', exact: true }) });
      await completed.locator('[data-admin-value]').filter({ hasText: '59' }).waitFor();
      const cards = page.locator('[aria-label="Chỉ số kinh doanh"] article');
      assert.deepEqual(await cards.locator('[data-admin-value]').allTextContents().then(values => values.slice(0, 3)), ['90', '78', new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(1906000)]);
      await page.getByRole('heading', { name: 'Doanh thu hoa hồng', exact: true }).waitFor();
      await page.locator('svg[aria-label="90 lịch trong kỳ"]').waitFor();
      await page.getByRole('heading', { name: 'Kết quả kinh doanh & tài chính', exact: true }).waitFor();
      await page.goto(`${base}/#admin-customers`);
      await page.locator('tbody').getByText('Nguyễn Minh Anh', { exact: true }).waitFor();
      assert.deepEqual(await page.locator('thead th').allTextContents(), ['Người dùng', 'Email', 'Vai trò', 'Ngày tạo', 'Thao tác']);
      const row = page.locator('tbody tr').first();
      assert.equal(await row.locator('td').count(), 5);
      assert.match(await row.innerText(), /nguyen\.minhanh\d{2}@(gmail|outlook|yahoo)\.com/);
      assert.doesNotMatch(await row.innerText(), /seed\.beautylink\.test|\+492/);
      await row.getByRole('button', { name: 'Xem chi tiết', exact: true }).click();
      await page.getByText(/nguyen\.minhanh\d{2}@(gmail|outlook|yahoo)\.com/).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.deepEqual(errors, []);
      console.log(`PASS ${viewport.width}x${viewport.height}: stars, 90 bookings, 78 customers, 59 completed, 1,906,000 commission, matching donut and user columns/emails`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
