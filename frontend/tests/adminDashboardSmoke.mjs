import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = 'http://localhost:5173';
const browser = await chromium.launch({ headless: true });
try {
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height } }); const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(`${base}/api/`) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    const navigate = async label => {
      if (width < 1024) await page.getByRole('button', { name: 'Mở menu quản trị', exact: true }).click();
      await page.getByRole('navigation', { name: 'Điều hướng quản trị' }).getByRole('button', { name: label, exact: true }).click();
    };
    try {
      await page.goto(`${base}/#login`);
      await page.locator('#customer-identifier').fill('0901234599'); await page.locator('#customer-password').fill('Synthetic Admin123!');
      await page.getByRole('button', { name: 'Đăng nhập ngay', exact: true }).click();
      await page.getByTestId('admin-overview').waitFor();
      if (width < 1024) {
        const toggle = page.getByRole('button', { name: 'Mở menu quản trị', exact: true });
        await toggle.click(); await page.getByRole('button', { name: 'Đóng menu', exact: true }).waitFor();
        await page.keyboard.press('Escape'); assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        assert.equal(await toggle.evaluate(el => document.activeElement === el), true);
        await toggle.click(); await page.getByRole('button', { name: 'Đóng menu quản trị', exact: true }).click({ position: { x: width - 10, y: 100 } });
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      }
      const loaded = page.waitForResponse(r => r.url().includes('/admin/dashboard/insights?') && r.url().includes('includeDemo=true'));
      await page.getByLabel('Bao gồm dữ liệu demo/test').check(); const data = await (await loaded).json();
      await page.getByTestId('admin-overview').waitFor();
      const cards = page.getByRole('region', { name: 'Chỉ số kinh doanh' });
      // Named section is exposed as a region by its aria-label.
      assert.equal(await cards.locator('article').count(), 6);
      assert.ok((await cards.locator('article').first().textContent()).includes(String(data.totalBookings.value)));
      const todayResponse = page.waitForResponse(r => r.url().includes('/admin/dashboard/insights?') && r.url().includes('includeDemo=true'));
      await page.getByRole('button', { name: 'Hôm nay', exact: true }).click();
      const today = await (await todayResponse).json(); assert.ok(today.totalBookings.value < data.totalBookings.value, 'date range changes actual DB cohort');
      await page.getByTestId('admin-overview').waitFor();
      const monthResponse = page.waitForResponse(r => r.url().includes('/admin/dashboard/insights?') && r.url().includes('includeDemo=true'));
      await page.getByRole('button', { name: '30 ngày', exact: true }).click(); await monthResponse; await page.getByTestId('admin-overview').waitFor();
      for (const [grain, label] of [['WEEK', 'Theo tuần'], ['MONTH', 'Theo tháng'], ['DAY', 'Theo ngày']]) {
        const response = page.waitForResponse(r => r.url().includes('/admin/dashboard/insights?') && r.url().includes(`granularity=${grain}`));
        await page.getByRole('button', { name: label, exact: true }).click();
        assert.equal((await (await response).json()).granularity, grain); await page.getByTestId('admin-overview').waitFor();
        assert.equal(await page.getByRole('button', { name: label, exact: true }).getAttribute('aria-pressed'), 'true');
      }
      const point = page.locator('circle[aria-label^="Thu online"]').first(); await point.focus();
      assert.equal(await point.evaluate(el => document.activeElement === el), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${width}: whole page must not overflow`);
      await page.screenshot({ path: `backend/target/admin-v2-${width}.png`, fullPage: true });
      assert.ok(data.topSalons.length > 0);
      await page.getByRole('button', { name: `Xem salon ${data.topSalons[0].name}`, exact: true }).click();
      await page.getByRole('dialog', { name: 'Chi tiết salon', exact: true }).waitFor();
      await page.getByRole('heading', { name: data.topSalons[0].name, exact: true }).waitFor();
      assert.match(await page.getByRole('dialog', { name: 'Chi tiết salon', exact: true }).textContent(), /Chuyên viên & lịch làm việc/);
      await page.getByRole('button', { name: 'Đóng chi tiết salon', exact: true }).click();
      await navigate('Tổng quan'); await page.getByTestId('admin-overview').waitFor();
      if (!(await page.getByLabel('Bao gồm dữ liệu demo/test').isChecked())) { await page.getByLabel('Bao gồm dữ liệu demo/test').check(); await page.getByTestId('admin-overview').waitFor(); }
      await page.getByRole('button', { name: 'Xem chi tiết Lịch hẹn hoàn thành', exact: true }).click();
      await page.getByLabel('Trạng thái lịch', { exact: true }).waitFor(); assert.equal(await page.getByLabel('Trạng thái lịch', { exact: true }).inputValue(), 'COMPLETED');
      await page.goBack(); await page.getByTestId('admin-overview').waitFor();
      await page.goForward(); await page.getByLabel('Trạng thái lịch', { exact: true }).waitFor();
      await navigate('Tổng quan'); await page.getByTestId('admin-overview').waitFor();
      await page.getByRole('button', { name: 'Xem tất cả lịch đặt →', exact: true }).click();
      await page.getByLabel('Trạng thái lịch', { exact: true }).waitFor(); assert.equal(await page.getByLabel('Trạng thái lịch', { exact: true }).inputValue(), '');
      const search = page.getByLabel('Tìm lịch đặt', { exact: true }); await search.fill('SMOKE-MANUAL');
      await search.press('Enter'); await page.getByRole('button', { name: 'Chi tiết SMOKE-MANUAL', exact: true }).waitFor();
      await search.fill(''); await search.press('Enter');
      await navigate('Lịch đặt');
      if (!(await page.getByLabel('Bao gồm dữ liệu demo/test').isChecked())) await page.getByLabel('Bao gồm dữ liệu demo/test').check();
      const detail = page.getByRole('button', { name: /^Chi tiết / }).first(); await detail.waitFor(); await detail.click();
      await page.getByRole('dialog', { name: 'Chi tiết lịch hẹn' }).waitFor(); await page.getByRole('button', { name: 'Đóng', exact: true }).click();
      await navigate('Thanh toán'); await page.getByRole('heading', { name: 'Thanh toán đã xác minh', exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Bảng doanh thu online đã xác minh', exact: true }).waitFor();
      await navigate('Người dùng'); await page.getByLabel('Lọc vai trò').selectOption('ADMIN');
      await page.locator('tbody').getByText('Admin Browser Test', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Khách hàng & lịch sử / CSV', exact: true }).click();
      await page.getByRole('heading', { name: 'Tài khoản khách hàng', exact: true }).waitFor();
      await navigate('Đánh giá'); await page.getByRole('heading', { name: 'Đánh giá', exact: true }).waitFor();
      await navigate('Khuyến mãi'); await page.getByRole('heading', { name: 'Quản lý chiến dịch chưa được triển khai', exact: true }).waitFor();
      await navigate('Cài đặt'); await page.getByRole('heading', { name: 'Thông tin quản trị · chỉ đọc', exact: true }).waitFor();
      await navigate('Báo cáo'); await page.locator('main').waitFor();
      if (width === 1366 || width === 390) {
        const token = await page.evaluate(() => sessionStorage.getItem('beautylink_access_token'));
        assert.equal((await context.request.post(`${base}/api/v1/auth/session/logout`, { headers: { Authorization: `Bearer ${token}` } })).status(), 204);
        await navigate('Tổng quan'); // real read is rejected by the server after revocation
      } else await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
      await page.waitForFunction(() => sessionStorage.getItem('beautylink_access_token') === null);
      assert.equal(await page.getByRole('navigation', { name: 'Điều hướng quản trị' }).count(), 0);
      assert.deepEqual(errors, []);
      console.log(`PASS: Admin ${width}x${height}: real JWT/APIs/DB KPI, date filter, sidebar, booking/salon detail, users/customers, payments/reviews, responsive layout, KPI filters, DAY/WEEK/MONTH, keyboard focus, search, back/forward, logout/revocation; no API 5xx/page errors.`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
