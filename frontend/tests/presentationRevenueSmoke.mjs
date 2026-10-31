import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = 'http://127.0.0.1:5173';
const output = new URL('../../backend/target/presentation/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
const password = 'BeautyLinkTest123!'; // Disposable local seed credential, not a production account.
const report = { target: 3045000, environment: 'isolated H2 memory; real Spring API; no mocked admin responses', viewports: [] };
try {
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage(); const errors = [];
    await context.route('https://chat.topaichat.vn/**', route => route.abort());
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(`${base}/api/`) && response.status() >= 500) errors.push(`${response.status()} ${response.url()}`); });
    await page.addInitScript(() => localStorage.setItem('beautylink_onboarding_v1', JSON.stringify({ version: 1, completedAt: Date.now(), locationId: 1, city: 'Hà Nội', category: 'all' })));
    try {
      await page.goto(`${base}/#login`);
      await page.locator('#customer-identifier').fill('0900000004');
      await page.locator('#customer-password').fill(password);
      const firstInsights = page.waitForResponse(r => r.url().includes('/admin/dashboard/insights?'));
      await page.getByRole('button', { name: 'Đăng nhập ngay', exact: true }).click();
      let data = await (await firstInsights).json();
      await page.getByTestId('admin-overview').waitFor();
      const from = page.getByLabel('Từ ngày', { exact: true });
      if (await from.inputValue() !== '2026-10-01') {
        const changed = page.waitForResponse(r => r.url().includes('/dashboard/insights?') && r.url().includes('from=2026-10-01'));
        await from.fill('2026-10-01'); data = await (await changed).json();
      }
      assert.equal(Number(data.completedServiceValue.value), 3045000);
      assert.equal(Number(data.completedBookings.value), 9);
      assert.equal(Number(data.totalBookings.value), 12);
      assert.equal(Number(data.revenue.value), 0);
      const values = label => page.locator('[aria-label="Chỉ số kinh doanh"] article').filter({ has: page.getByRole('heading', { name: label, exact: true }) }).locator('[data-admin-value]');
      await values('Doanh thu').filter({ hasText: '3.045.000' }).waitFor();
      assert.equal(await values('Đơn hoàn thành').innerText(), '9');
      assert.equal(await page.getByText(/Khách đã đặt lịch|Chưa có so sánh/).count(), 0);
      const chartNode = await page.getByTestId('admin-overview').elementHandle();
      for (const [grain, label] of [['WEEK', 'Theo tuần'], ['MONTH', 'Theo tháng'], ['DAY', 'Theo ngày']]) {
        const changed = page.waitForResponse(r => r.url().includes('/dashboard/insights?') && r.url().includes(`granularity=${grain}`));
        await page.getByRole('button', { name: label, exact: true }).click();
        const result = await (await changed).json();
        assert.equal(result.trends.reduce((sum, row) => sum + Number(row.completedServiceValue), 0), 3045000);
        assert.equal(result.trends.reduce((sum, row) => sum + Number(row.bookings), 0), 12);
        assert.equal(await chartNode.evaluate(node => node.isConnected), true);
        if (grain === 'DAY') report.daily = result.trends;
      }
      assert.ok(new Set(report.daily.map(row => row.completedServiceValue)).size > 5);
      assert.ok(report.daily.some(row => Number(row.completedServiceValue) === 0));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.screenshot({ path: new URL(`admin-${viewport.width}.png`, output).pathname.replace(/^\/(?:([A-Z]:))/, '$1'), fullPage: true });
      await page.getByRole('button', { name: 'Xem chi tiết Đơn hoàn thành', exact: true }).click();
      await page.getByRole('heading', { name: '9 lịch phù hợp', exact: true }).waitFor();
      assert.equal(await page.getByLabel('Trạng thái lịch', { exact: true }).inputValue(), 'COMPLETED');
      assert.equal(await page.locator('tbody tr').count(), 9);
      const amounts = await page.locator('tbody tr td:nth-child(9)').allTextContents();
      assert.ok(amounts.every(value => value === '—'), 'No fictional online receipts appear in booking history');
      const logout = page.getByRole('button', { name: 'Đăng xuất', exact: true });
      await logout.click();
      await page.goto(`${base}/#login`);
      await page.locator('#customer-identifier').fill('0900000002');
      await page.locator('#customer-password').fill(password);
      const supplierResponse = page.waitForResponse(r => r.url().endsWith('/bookings/supplier'));
      await page.getByRole('button', { name: 'Đăng nhập ngay', exact: true }).click();
      const supplierRows = await (await supplierResponse).json();
      const supplierValue = supplierRows.filter(row => row.status === 'COMPLETED').reduce((sum, row) => sum + Number(row.totalAmount), 0);
      assert.equal(supplierValue, 2030000);
      const supplierCard = page.locator('div.rounded-3xl').filter({ has: page.getByText('Tổng giá trị dịch vụ', { exact: true }) }).last();
      await supplierCard.getByText('2.030.000đ', { exact: true }).waitFor();
      assert.ok(supplierRows.some(row => row.status !== 'COMPLETED'), 'Unfinished supplier orders are not counted as revenue');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.screenshot({ path: new URL(`supplier-${viewport.width}.png`, output).pathname.replace(/^\/(?:([A-Z]:))/, '$1'), fullPage: true });
      assert.deepEqual(errors, []);
      report.viewports.push({ ...viewport, adminValue: 3045000, completed: 9, total: 12, supplierValue, verifiedOnline: 0, consoleErrors: errors });
      console.log(`PASS ${viewport.width}: real authentication, Admin 3,045,000/9 completed/12 total, day/week/month reconciliation, Supplier 2,030,000, verified online 0`);
    } finally { await context.close(); }
  }
  await writeFile(new URL('reconciliation.json', output), JSON.stringify(report, null, 2));
} finally { await browser.close(); }
