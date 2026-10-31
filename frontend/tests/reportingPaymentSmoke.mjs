import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.BEAUTYLINK_SMOKE_URL || 'http://localhost:5173';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Isolated local browser fixture only');
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.url().startsWith(`${base}/api/`) && r.status() >= 500) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    await context.route('https://chat.topaichat.vn/**', r => r.fulfill({ contentType: 'application/javascript', body: '' }));
    const navigate = async label => {
      if (width < 1024) await page.getByRole('button', { name: 'Mở menu quản trị', exact: true }).click();
      await page.getByRole('navigation', { name: 'Điều hướng quản trị' }).getByRole('button', { name: label, exact: true }).click();
    };
    const layout = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}: no page overflow`);
    try {
      await page.goto(`${base}/#login`);
      await page.locator('#customer-identifier').fill('0901234599'); await page.locator('#customer-password').fill('Synthetic Admin123!');
      await page.getByRole('button', { name: 'Đăng nhập ngay', exact: true }).click();
      await page.getByTestId('admin-overview').waitFor();
      await page.getByLabel('Từ ngày', { exact: true }).fill('2026-10-01'); await page.getByLabel('Đến ngày', { exact: true }).fill('2026-10-31');
      await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
      const token = await page.evaluate(() => sessionStorage.getItem('beautylink_access_token'));
      const get = async path => { const response = await context.request.get(base + path, { headers: { Authorization: `Bearer ${token}` } }); assert.equal(response.status(), 200); return response.json(); };
      const data = await get('/api/v1/admin/presentation'); const report = await get('/api/v1/admin/report-payments?from=2026-10-01&to=2026-10-31&size=100');
      const verified = await get('/api/v1/admin/dashboard/payments?from=2026-10-01&to=2026-10-31');
      const rows = [];
      for (let p = 0; p < report.rows.totalPages; p++) rows.push(...(await get(`/api/v1/admin/report-payments?from=2026-10-01&to=2026-10-31&size=100&page=${p}`)).rows.content);
      assert.equal(rows.filter(r => r.source === 'SIMULATED').length, 144);
      assert.equal(new Set(rows.map(r => r.id)).size, rows.length); assert.equal(new Set(rows.map(r => r.bookingId)).size, rows.length);
      assert.equal(report.total, report.deposits + report.fullPayments); assert.equal(report.verifiedAmount, verified.verifiedOnlineCollected);
      assert.equal(report.uniqueBookings, verified.verifiedPaymentBookings + 144);
      for (const r of rows.filter(r => r.source === 'SIMULATED')) {
        const b = data.bookings.find(b => b.id === r.bookingId); assert.ok(b);
        for (const field of ['bookingCode', 'customerId', 'supplierId', 'serviceId', 'practitionerId', 'appointmentDate', 'startTime', 'endTime']) assert.equal(r[field], b[field], field);
        assert.equal(r.bookingStatus, b.status); assert.equal(r.amount, Math.round(b.totalAmount * 0.05)); assert.equal(r.amount + r.remainingAmount, b.totalAmount);
        assert.equal(b.verifiedOnlineAmount, null);
      }
      for (const grain of ['DAY', 'WEEK', 'MONTH']) {
        const insight = await get(`/api/v1/admin/dashboard/insights?from=2026-10-01&to=2026-10-31&granularity=${grain}`);
        assert.equal(insight.reportPayments.currentValue, report.total); assert.equal(insight.revenue.currentValue, report.verifiedAmount);
        assert.equal(insight.trends.reduce((n, x) => n + x.reportPaymentAmount, 0), report.total);
        assert.equal(insight.reportOnlinePaymentRate.currentNumerator, report.uniqueBookings);
        assert.equal(insight.reportOnlinePaymentRate.currentDenominator, insight.totalBookings.currentValue);
      }
      const amountCard = page.locator('[aria-label="Chỉ số kinh doanh"] article').filter({ has: page.getByRole('heading', { name: 'Tổng thanh toán báo cáo', exact: true }) });
      await amountCard.waitFor(); await layout(); await page.screenshot({ path: `backend/target/report-payments-${width}-overview.png`, fullPage: true });
      const rateCard=page.locator('[aria-label="Chỉ số kinh doanh"] article').filter({has:page.getByRole('heading',{name:'Tỷ lệ thanh toán online',exact:true})});
      assert.equal(await rateCard.locator('[data-admin-value]').innerText(),'85,6%');
      assert.ok((await rateCard.innerText()).includes('Mục tiêu báo cáo'));
      await navigate('Thanh toán'); await page.getByRole('heading', { name: 'Tổng thanh toán báo cáo', exact: true }).waitFor();
      const paymentRow = page.locator('tbody tr').filter({ hasText: 'BL2610R' }).first(); await paymentRow.waitFor();
      const code = (await paymentRow.locator('strong').first().textContent()).trim(); const expected = data.bookings.find(b => b.bookingCode === code);assert.ok(expected);
      await paymentRow.getByRole('button', { name: 'Xem lịch', exact: true }).click();
      const detail = page.getByRole('dialog', { name: 'Chi tiết lịch hẹn' }); await detail.waitFor();
      const text = await detail.innerText(); assert.ok(text.includes(expected.appointmentDate)); assert.ok(text.includes(`${expected.startTime.slice(0, 5)}–${expected.endTime.slice(0, 5)}`)); assert.ok(text.includes(expected.practitionerName));
      await page.getByRole('button', { name: 'Đóng', exact: true }).click();await layout();
      await page.screenshot({ path: `backend/target/report-payments-${width}-ledger.png`, fullPage: true });
      const downloadReport = page.waitForEvent('download'); await page.getByRole('button', { name: 'Tải báo cáo thanh toán CSV', exact: true }).click();
      const reportFile = await downloadReport;const stream = await reportFile.createReadStream();let csv='';for await(const chunk of stream)csv+=chunk.toString();
      assert.equal((csv.match(/"SIMULATED"/g) || []).length, 144);assert.ok(csv.includes('appointment_date_vietnam'));
      await page.getByText('Biên nhận PayOS xác minh và CSV riêng', { exact: true }).click();
      const downloadVerified = page.waitForEvent('download');await page.getByRole('button', { name: 'Tải CSV', exact: true }).click();
      const realFile=await downloadVerified;const realStream=await realFile.createReadStream();let realCsv='';for await(const chunk of realStream)realCsv+=chunk.toString();
      assert.ok(!realCsv.includes('BL2610R')&&!realCsv.includes('SIMULATED'));
      await navigate('Lịch đặt');await page.getByPlaceholder('Mã lịch, khách, salon, dịch vụ', { exact: true }).fill(code);
      await page.getByRole('button', { name: `Chi tiết ${code}`, exact: true }).click();await detail.waitFor();
      const bookingText=await detail.innerText();assert.equal(bookingText,text,'Payment and booking views open the identical record');
      await page.getByRole('button', { name: 'Đóng', exact: true }).click();await layout();
      await page.screenshot({ path: `backend/target/report-payments-${width}-booking.png`, fullPage: true });
      const changed = await get('/api/v1/admin/report-payments?from=2026-10-25&to=2026-10-31&size=100');assert.ok(changed.total<report.total,'Date filter derives totals from rows');
      assert.deepEqual(errors,[]);console.log(`PASS report payments ${width}: 144 linked records, real JWT/API/H2, money, DAY/WEEK/MONTH, payment↔booking calendar, scoped dates, separate CSVs, layout; verified ledger unchanged`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
