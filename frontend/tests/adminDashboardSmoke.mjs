import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = 'http://localhost:5173';
const browser = await chromium.launch({ headless: true });
let customerLookupEmail = 'mobile-browser@example.com';
try {
  for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [1024, 768], [768, 1024], [390, 844], [360, 800]]) {
    const context = await browser.newContext({ viewport: { width, height } }); const page = await context.newPage(); const errors = [];
    const scopes = []; const adminRequests = []; let documentLoads = 0; page.on('domcontentloaded', () => { documentLoads++; });
    page.on('request', request => { const url = new URL(request.url()); if (url.pathname.includes('/admin/')) adminRequests.push(url.pathname + url.search); if (url.pathname.includes('/admin/') && url.searchParams.has('includeDemo')) scopes.push(url.searchParams.get('includeDemo')); });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(`${base}/api/`) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    const checkLayout = async () => {
      const layout = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('main, main section, main h2')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, classes: el.className, width: Math.round(el.getBoundingClientRect().width) })) }));
      const fits = layout.scrollWidth <= layout.viewport + 1;
      if (!fits) await page.screenshot({ path: `backend/target/admin-v2-${width}-overflow.png`, fullPage: true });
      assert.equal(fits, true, `${width}: page overflow ${JSON.stringify(layout)}`);
      assert.equal(await page.getByText(/Bao gồm.*demo\/test/).count(), 0);
      assert.equal(await page.getByText('Dữ liệu chỉ đọc; quyền thay đổi nghiệp vụ không được thêm trong Dashboard V2.', { exact: true }).count(), 0);
      assert.equal(await page.locator('[data-admin-value]').evaluateAll(nodes => nodes.every(n => n.scrollWidth <= n.clientWidth + 1)), true, 'KPI values fit without clipping');
      const contrast = await page.locator('[data-admin-status]').evaluateAll(nodes => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const ctx = canvas.getContext('2d');
        const luminance = color => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); const rgb = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(n => n / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4); return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722; };
        return nodes.every(node => { const css = getComputedStyle(node); const a = luminance(css.color); const b = luminance(css.backgroundColor); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5; });
      });
      assert.equal(contrast, true, 'badge text meets AA contrast against its own background');
    };
    const capture = async name => { await checkLayout(); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `backend/target/admin-v2-${width}${name ? `-${name}` : ''}.png`, fullPage: true }); };
    const navigate = async label => {
      if (width < 1024) await page.getByRole('button', { name: 'Mở menu quản trị', exact: true }).click();
      await page.getByRole('navigation', { name: 'Điều hướng quản trị' }).getByRole('button', { name: label, exact: true }).click();
    };
    try {
      await page.goto(`${base}/#login`);
      await page.locator('#customer-identifier').fill('0901234599'); await page.locator('#customer-password').fill('Synthetic Admin123!');
      const loaded = page.waitForResponse(r => r.url().includes('/admin/dashboard/insights?') && r.url().includes('includeDemo=false'));
      await page.getByRole('button', { name: 'Đăng nhập ngay', exact: true }).click();
      const data = await (await loaded).json();
      await page.getByTestId('admin-overview').waitFor();
      if (width < 1024) {
        const toggle = page.getByRole('button', { name: 'Mở menu quản trị', exact: true });
        await toggle.click(); await page.getByRole('button', { name: 'Đóng menu', exact: true }).waitFor();
        await page.keyboard.press('Escape'); assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        assert.equal(await toggle.evaluate(el => document.activeElement === el), true);
        await toggle.click(); await page.getByRole('button', { name: 'Đóng menu quản trị', exact: true }).click({ position: { x: width - 10, y: 100 } });
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      }
      const cards = page.getByRole('region', { name: 'Chỉ số kinh doanh' });
      // Named section is exposed as a region by its aria-label.
      assert.equal(await cards.locator('article').count(), 6);
      const expectedColumns = width >= 1800 ? 6 : width >= 1280 ? 3 : width >= 640 ? 2 : 1;
      assert.equal(await cards.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), expectedColumns, `${width}: responsive KPI columns`);
      assert.ok((await cards.locator('article').first().textContent()).includes(String(data.totalBookings.value)));
      const todayResponse = page.waitForResponse(r => r.url().includes('/admin/dashboard/insights?') && r.url().includes('includeDemo=false'));
      await page.getByRole('button', { name: 'Hôm nay', exact: true }).click();
      const today = await (await todayResponse).json(); assert.ok(today.totalBookings.value < data.totalBookings.value, 'date range changes actual DB cohort');
      await page.getByTestId('admin-overview').waitFor();
      const monthResponse = page.waitForResponse(r => r.url().includes('/admin/dashboard/insights?') && r.url().includes('includeDemo=false'));
      await page.getByRole('button', { name: '30 ngày', exact: true }).click(); await monthResponse; await page.getByTestId('admin-overview').waitFor();
      const unrelatedCalls = () => adminRequests.filter(url => url.includes('/dashboard/payments?') || url.includes('/admin/bookings?')).length;
      const beforeGrain = unrelatedCalls(); const overviewNode = await page.getByTestId('admin-overview').elementHandle();
      for (const [grain, label] of [['WEEK', 'Theo tuần'], ['MONTH', 'Theo tháng'], ['DAY', 'Theo ngày']]) {
        const response = page.waitForResponse(r => r.url().includes('/admin/dashboard/insights?') && r.url().includes(`granularity=${grain}`));
        await page.getByRole('button', { name: label, exact: true }).click();
        assert.equal(await overviewNode.evaluate(el => el.isConnected), true, 'dashboard stays mounted during chart request');
        assert.equal((await (await response).json()).granularity, grain); await page.getByTestId('admin-overview').waitFor();
        assert.equal(await page.getByRole('button', { name: label, exact: true }).getAttribute('aria-pressed'), 'true');
      }
      assert.equal(unrelatedCalls(), beforeGrain, 'chart grain never refetches payment summary/recent bookings'); assert.equal(documentLoads, 1, 'SPA controls do not reload document');
      const point = page.locator('circle[aria-label^="Thu online"]').first(); await point.focus();
      assert.equal(await point.evaluate(el => document.activeElement === el), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${width}: whole page must not overflow`);
      assert.equal(await cards.locator('article').evaluateAll(nodes => nodes.every(n => n.getBoundingClientRect().height < 250)), true, 'KPI cards remain compact');
      await capture('');
      // Deliberate UI-only stress response in this isolated test: not accounting evidence.
      await page.route('**/api/v1/admin/dashboard/insights?*', async route => { const response = await route.fetch(); const json = await response.json(); json.revenue.value = 1234567890123; await route.fulfill({ response, json }); }, { times: 1 });
      const stress = page.waitForResponse(r => r.url().includes('/admin/dashboard/insights?'));
      await page.getByRole('button', { name: 'Làm mới', exact: true }).click(); await stress;
      const formatted = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(1234567890123);
      await page.waitForFunction(value => document.querySelectorAll('[data-admin-value]')[2]?.textContent === value, formatted); await checkLayout();
      const restored = page.waitForResponse(r => r.url().includes('/admin/dashboard/insights?'));
      await page.getByRole('button', { name: 'Làm mới', exact: true }).click(); await restored; await page.getByTestId('admin-overview').waitFor();
      assert.ok(data.topSalons.length > 0);
      await page.getByRole('button', { name: `Xem salon ${data.topSalons[0].name}`, exact: true }).click();
      await page.getByRole('heading', { name: data.topSalons[0].name, exact: true }).waitFor();
      assert.equal(await page.getByRole('dialog', { name: 'Chi tiết salon' }).count(), 0);
      assert.ok(page.url().includes(`#admin-salons/${data.topSalons[0].id}`)); await capture('salon-detail');
      const salonNav = page.getByRole('navigation', { name: 'Nội dung salon' });
      const serviceCalls = () => adminRequests.filter(url => url.includes(`/admin/salons/${data.topSalons[0].id}/services?`)).length;
      await salonNav.getByRole('button', { name: 'Dịch vụ', exact: true }).click(); await page.locator('section:not([hidden]) table').getByText('Makeup trong trẻo cá nhân', { exact: true }).waitFor();
      const loadedServices = serviceCalls(); await salonNav.getByRole('button', { name: 'Thông tin chung', exact: true }).click(); await salonNav.getByRole('button', { name: 'Dịch vụ', exact: true }).click();
      assert.equal(serviceCalls(), loadedServices, 'tab cache avoids another services request');
      await salonNav.getByRole('button', { name: 'Chuyên viên', exact: true }).click(); await page.getByText('Xem lịch tuần', { exact: true }).first().waitFor(); await page.getByText('Xem lịch tuần', { exact: true }).first().click();
      await page.getByRole('columnheader', { name: 'Giờ làm', exact: true }).waitFor(); assert.equal(await page.locator('details[open] tbody tr').first().locator('td').first().textContent(), 'Thứ Hai'); await capture('salon-people');
      await salonNav.getByRole('button', { name: 'Lịch đặt', exact: true }).click(); await page.getByRole('heading', { name: 'Lịch đặt của salon', exact: true }).waitFor();
      await checkLayout(); await salonNav.getByRole('button', { name: 'Thanh toán', exact: true }).click(); await page.getByRole('heading', { name: 'Lượt thanh toán & đối soát', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Xem lịch', exact: true }).first().waitFor(); await checkLayout();
      const salonUrl = page.url(); await page.reload(); await page.getByRole('heading', { name: data.topSalons[0].name, exact: true }).waitFor(); assert.equal(page.url(), salonUrl);
      await page.getByRole('heading', { name: 'Lượt thanh toán & đối soát', exact: true }).waitFor();
      await page.getByRole('button', { name: '← Danh sách salon', exact: true }).click(); await page.getByRole('button', { name: 'Xem chi tiết', exact: true }).first().waitFor(); await capture('salons');
      await navigate('Tổng quan'); await page.getByTestId('admin-overview').waitFor();
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
      const detail = page.getByRole('button', { name: /^Chi tiết / }).first(); await detail.waitFor(); await detail.click();
      await page.getByRole('dialog', { name: 'Chi tiết lịch hẹn' }).waitFor(); await page.getByRole('button', { name: 'Đóng', exact: true }).click();
      await navigate('Thanh toán'); await page.getByRole('heading', { name: 'Thanh toán đã xác minh', exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Bảng doanh thu online đã xác minh', exact: true }).waitFor();
      await checkLayout();
      const revenueDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Tải CSV', exact: true }).click();
      assert.match((await revenueDownload).suggestedFilename(), /beautylink-revenue.*csv/);
      await navigate('Người dùng'); await page.locator('tbody tr').first().waitFor();
      await capture('users');
      const nextPage = page.waitForResponse(r => r.url().includes('/admin/users?') && r.url().includes('page=1'));
      await page.getByRole('button', { name: 'Trang sau', exact: true }).click(); await nextPage;
      await page.getByLabel('Lọc vai trò').selectOption('ADMIN');
      await page.locator('tbody').getByText('Admin Browser Test', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Xem chi tiết', exact: true }).first().click();
      await page.getByRole('navigation', { name: 'Nội dung tài khoản' }).waitFor(); assert.ok(page.url().includes('#admin-users/'));
      assert.equal(await page.locator('main a[href*="/edit"]').count(), 0); assert.equal(await page.getByRole('button', { name: /chỉnh sửa|edit/i }).count(), 0); await capture('account-detail');
      await page.getByRole('button', { name: '← Danh sách người dùng', exact: true }).click(); await page.getByLabel('Lọc vai trò').waitFor();
      assert.equal(await page.getByRole('button', { name: /^Sửa hồ sơ/ }).count(), 0, 'normal directory never advertises edit');
      await page.goto(`${base}/#admin-users/edit`);
      await page.getByText(/^Chế độ chỉnh sửa hồ sơ:/).waitFor(); await page.locator('tbody tr').first().waitFor();
      assert.equal(await page.locator('tbody tr').filter({ hasText: 'admin-browser@example.com' }).getByRole('button', { name: /^Sửa hồ sơ/ }).count(), 0);
      await capture('user-edit-directory');
      await page.reload(); await page.getByText(/^Chế độ chỉnh sửa hồ sơ:/).waitFor(); await page.getByLabel('Lọc vai trò').waitFor();
      await page.getByLabel('Lọc vai trò').selectOption('CUSTOMER'); await page.getByRole('textbox', { name: 'Tìm người dùng', exact: true }).fill(customerLookupEmail);
      await page.locator('tbody tr').filter({ hasText: customerLookupEmail }).getByRole('button', { name: /^Sửa hồ sơ/ }).click();
      await page.getByRole('heading', { name: 'Chỉnh sửa hồ sơ khách hàng', exact: true }).waitFor();
      assert.match(page.url(), /#admin-users\/[1-9]\d*\/edit$/); await capture('user-edit-form');
      if (width === 1366) {
        await page.getByLabel('Họ tên', { exact: true }).fill('Mobile Browser Test Updated'); await page.getByLabel('Giới tính', { exact: true }).selectOption('FEMALE'); await page.getByLabel('Ngày sinh', { exact: true }).fill('1995-01-01');
        await page.getByLabel('Email', { exact: true }).fill('admin-edited-customer@example.com'); await page.getByLabel('Số điện thoại', { exact: true }).fill('0938787878');
        await page.getByRole('checkbox', { name: 'Tôi xác nhận đã kiểm tra email và số điện thoại mới với chủ tài khoản.', exact: true }).check();
        await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click(); await page.getByText('Đã lưu hồ sơ khách hàng.', { exact: true }).waitFor();
        await page.getByRole('heading', { name: 'Mobile Browser Test Updated', exact: true }).waitFor();
        await page.reload(); await page.getByRole('heading', { name: 'Mobile Browser Test Updated', exact: true }).waitFor();
        assert.equal(await page.getByLabel('Giới tính', { exact: true }).inputValue(), 'FEMALE'); assert.equal(await page.getByLabel('Ngày sinh', { exact: true }).inputValue(), '1995-01-01');
        customerLookupEmail = 'admin-edited-customer@example.com'; assert.equal(await page.getByLabel('Email', { exact: true }).inputValue(), customerLookupEmail); assert.equal(await page.getByLabel('Số điện thoại', { exact: true }).inputValue(), '0938787878');
        const customerLogin = await context.request.post(`${base}/api/v1/auth/login`, { data: { identifier: customerLookupEmail, password: 'Synthetic Mobile 123! ' } }); assert.equal(customerLogin.status(), 200); const auth = await customerLogin.json();
        const me = await context.request.get(`${base}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${auth.accessToken}` } }); assert.equal(me.status(), 200); assert.equal((await me.json()).phone, '0938787878');
        assert.equal((await context.request.post(`${base}/api/v1/auth/session/logout`, { headers: { Authorization: `Bearer ${auth.accessToken}` } })).status(), 204);

      }
      await page.getByRole('button', { name: '← Danh sách người dùng', exact: true }).click(); await page.getByText(/^Chế độ chỉnh sửa hồ sơ:/).waitFor();
      assert.ok(page.url().endsWith('#admin-users/edit')); await page.getByLabel('Lọc vai trò').waitFor();
      if (width === 1366 || width === 390) {
        await page.getByRole('textbox', { name: 'Tìm người dùng', exact: true }).fill('supplier@beautylink.vn');
        await page.locator('tbody tr').filter({ hasText: 'supplier@beautylink.vn' }).getByRole('button', { name: /^Sửa hồ sơ/ }).click();
        await page.getByRole('heading', { name: 'Chỉnh sửa hồ sơ đối tác', exact: true }).waitFor();
        const partner = page.locator('section').filter({ has: page.getByRole('navigation', { name: 'Chỉnh sửa đối tác', exact: true }) }).last();
        await page.getByLabel('Tên salon', { exact: true }).waitFor(); await page.getByLabel('Tên salon', { exact: true }).fill('Lumière Beauty House Updated');
        await page.getByRole('button', { name: 'Lưu thay đổi đối tác', exact: true }).click(); await page.getByText('Đã lưu thay đổi đối tác.', { exact: true }).waitFor();
        await partner.getByRole('button', { name: 'Sửa dịch vụ', exact: true }).click(); await page.getByLabel('Chọn dịch vụ để sửa', { exact: true }).selectOption({ label: 'Makeup trong trẻo cá nhân' });
        await page.getByLabel('Giá bán (VND)', { exact: true }).fill('350000'); await page.getByRole('button', { name: 'Lưu thay đổi đối tác', exact: true }).click(); await page.getByText('Đã lưu thay đổi đối tác.', { exact: true }).waitFor();
        await capture('partner-service-edit');
        await partner.getByRole('button', { name: 'Sửa chuyên viên', exact: true }).click(); await page.getByLabel('Chọn chuyên viên để sửa', { exact: true }).selectOption({ index: 1 }); await page.getByLabel('Chuyên môn', { exact: true }).fill('Makeup & skincare');
        await page.getByRole('button', { name: 'Lưu thay đổi đối tác', exact: true }).click(); await page.getByText('Đã lưu thay đổi đối tác.', { exact: true }).waitFor();
        await partner.getByRole('button', { name: 'Sửa lịch làm việc', exact: true }).click(); await page.getByLabel('Thứ Hai bắt đầu', { exact: true }).waitFor();
        // The schedule reload replaces SaveForm immediately; assert committed API + persisted readback, not a transient toast.
        const scheduleSaved = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith('/schedule/edit'));
        await page.getByRole('button', { name: 'Lưu thay đổi đối tác', exact: true }).click();
        const scheduleResponse = await scheduleSaved; assert.equal(scheduleResponse.status(), 200);
        const savedSchedule = await scheduleResponse.json(); assert.ok(Array.isArray(savedSchedule.data)); assert.equal(savedSchedule.data.length, 7);
        const testToken = await page.evaluate(() => sessionStorage.getItem('beautylink_access_token'));
        const readbackResponse = await context.request.get(scheduleResponse.url(), { headers: { Authorization: `Bearer ${testToken}` } }); assert.equal(readbackResponse.status(), 200); assert.deepEqual((await readbackResponse.json()).data.sort((a, b) => a.dayOfWeek.localeCompare(b.dayOfWeek)), [...savedSchedule.data].sort((a, b) => a.dayOfWeek.localeCompare(b.dayOfWeek)));
        await page.getByLabel('Thứ Hai bắt đầu', { exact: true }).waitFor(); await capture('partner-schedule-edit');
        const editUrl = page.url(); await page.reload(); await page.getByLabel('Tên salon', { exact: true }).waitFor(); assert.equal(await page.getByLabel('Tên salon', { exact: true }).inputValue(), 'Lumière Beauty House Updated');
        if (width < 1024) await page.getByRole('button', { name: 'Mở menu quản trị', exact: true }).click();
        await page.getByRole('button', { name: 'BeautyLink — về trang chủ', exact: true }).click(); await page.waitForURL(url => !url.hash.includes('admin'));
        assert.equal(await page.getByRole('navigation', { name: 'Điều hướng quản trị' }).count(), 0); await page.reload(); assert.equal(await page.getByRole('navigation', { name: 'Điều hướng quản trị' }).count(), 0); assert.equal(await page.getByRole('heading', { name: /Chỉnh sửa hồ sơ/ }).count(), 0);
        await page.goto(editUrl); await page.getByLabel('Tên salon', { exact: true }).waitFor(); await page.getByRole('button', { name: '← Danh sách người dùng', exact: true }).click(); await page.getByLabel('Lọc vai trò').waitFor();
      }

      await page.getByRole('button', { name: 'Khách hàng & lịch sử / CSV', exact: true }).click();
      await page.getByRole('heading', { name: 'Tài khoản khách hàng', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Xem', exact: true }).first().waitFor(); await checkLayout();
      const customerDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Tải toàn bộ dữ liệu (.CSV)', exact: true }).click();
      assert.match((await customerDownload).suggestedFilename(), /beautylink-customers.*csv/);
      await page.getByRole('button', { name: 'Xem', exact: true }).first().click(); await page.getByRole('dialog', { name: 'Lịch sử khách hàng' }).waitFor(); await checkLayout();
      await page.getByRole('dialog', { name: 'Lịch sử khách hàng' }).getByRole('button', { name: 'Đóng', exact: true }).last().click();
      await navigate('Đánh giá'); await page.getByRole('heading', { name: 'Đánh giá', exact: true }).waitFor(); await checkLayout();
      await navigate('Khuyến mãi'); await page.getByRole('heading', { name: 'Quản lý chiến dịch chưa được triển khai', exact: true }).waitFor(); await checkLayout();
      await navigate('Cài đặt'); await page.getByRole('heading', { name: 'Thông tin quản trị · chỉ đọc', exact: true }).waitFor(); await checkLayout();
      const reportResponse = page.waitForResponse(r => r.url().includes('/api/v1/reports') && r.request().method() === 'GET');
      await navigate('Báo cáo'); const reports = await (await reportResponse).json();
      await page.getByRole('heading', { name: 'Trung tâm hỗ trợ', exact: true }).waitFor();
      const audit = reports.filter(row => row.reason.startsWith('ADMIN-PROFILE-AUDIT:')).sort((a, b) => b.reason.length - a.reason.length)[0];
      if (width <= 1366) assert.ok(audit, 'real edit audit available after the desktop edit flow');
      if (audit) {
        await page.getByRole('button').filter({ has: page.getByText(audit.reason, { exact: true }) }).first().click();
        await page.getByRole('heading', { name: audit.reason, exact: true }).waitFor();
      }
      await capture('reports');
      if (width === 1366 || width === 390) {
        const token = await page.evaluate(() => sessionStorage.getItem('beautylink_access_token'));
        assert.equal((await context.request.post(`${base}/api/v1/auth/session/logout`, { headers: { Authorization: `Bearer ${token}` } })).status(), 204);
        await navigate('Tổng quan'); // real read is rejected by the server after revocation
      } else await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
      await page.waitForFunction(() => sessionStorage.getItem('beautylink_access_token') === null);
      assert.equal(await page.getByRole('navigation', { name: 'Điều hướng quản trị' }).count(), 0);
      assert.ok(scopes.length > 0); assert.ok(scopes.every(value => value === 'false'), 'all scoped Admin calls exclude demo');
      assert.deepEqual(errors, []);
      console.log(`PASS: Admin ${width}x${height}: compact normal-scope UI, real JWT/APIs/DB KPI, date filter, sidebar, booking detail, salon/account full-page routes/tabs/refresh, scoped ledgers, users/customers, payments/reviews, responsive layout, KPI filters, DAY/WEEK/MONTH, keyboard focus, search, back/forward, logout/revocation; no API 5xx/page errors.`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
