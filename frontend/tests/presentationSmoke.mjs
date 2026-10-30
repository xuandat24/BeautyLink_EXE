import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { insightsFixture, paymentFixture } from './adminV2Fixtures.ts';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.PRESENTATION_SMOKE_BASE_URL || 'http://127.0.0.1:5182';
const browser = await chromium.launch({ headless: true });
const user = { id: 7, fullName: 'Nguyễn Minh Anh', email: 'nguyen.minhanh+492.351@seed.beautylink.test', role: 'CUSTOMER', status: 'ACTIVE', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', salons: [] };
const service = { id: 11, name: 'Chăm sóc da chuyên sâu', price: 250000, originalPrice: 350000, durationMinutes: 60, imageUrl: '', categorySlug: 'spa', rating: 0, serviceReviewCount: 0, bookedOrCompletedCount: 3, supplierId: 7, supplierRating: 0, supplierReviewCount: 0, supplierName: 'An Nhiên Spa', supplierBusinessType: 'SPA', supplierAddress: 'Quận 1', featured: true, supplierNearbyFeatured: true, supplierNewPartner: true, practitioners: [] };
const salons = Array.from({ length: 14 }, (_, index) => ({ id: 7 + index, name: `An Nhiên Spa ${index + 1}`, ownerName: 'Owner', ownerEmail: 'owner@example.com', businessType: 'Spa', location: 'Hà Nội', address: 'Hà Nội', active: false, approvalStatus: 'PENDING', serviceCount: 1, practitionerCount: 1, bookingCount: 0 }));
const originals = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map((status, index) => ({
  id: 101 + index, bookingCode: `BL-OLD-${101 + index}`, customerId: user.id, customerName: user.fullName, customerPhone: '0912345678',
  supplierId: 7, supplierName: salons[0].name, serviceName: service.name, practitionerName: 'Thanh Hằng',
  appointmentDate: '2026-10-16', startTime: '09:00:00', endTime: '10:00:00', totalAmount: 250000,
  status, paymentStatus: index === 1 ? 'PARTIALLY_PAID' : index === 2 ? 'PAID' : 'UNPAID', createdAt: '2026-10-15T02:30:00Z',
  verifiedPaymentOption: index === 2 ? 'FULL_100' : null, verifiedOnlineAmount: index === 1 ? 15000 : index === 2 ? 30000 : null,
  remainingAtSalon: null, verifiedPaidAt: null, paymentReviewRequired: false,
}));
const customer = { ...user, phone: '0912345678', gender: 'FEMALE', dateOfBirth: null, bookingsPlaced: 4, paidBookings: 2, completedBookings: 1, totalVerifiedOnlineAmount: 45000, lastBookingAt: originals[0].createdAt };
const paged = (rows, url) => {
  const page = Number(url.searchParams.get('page') || 0), size = Number(url.searchParams.get('size') || 20);
  return { content: rows.slice(page * size, (page + 1) * size), totalElements: rows.length, totalPages: Math.ceil(rows.length / size), page, size };
};
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage(); const errors = [];
    const adminWrites = [];
    await page.clock.setFixedTime(new Date('2026-10-30T03:00:00Z'));
    page.on('request', request => { if (request.url().includes('/admin/') && request.method() !== 'GET') adminWrites.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await context.route('https://chat.topaichat.vn/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
    await context.route('**/api/**', route => {
      const url = new URL(route.request().url()); const path = url.pathname;
      let json = [];
      if (/\/auth\/me$/.test(path)) json = { id: 1, fullName: 'Admin', role: 'ADMIN' };
      else if (path.endsWith('/dashboard/insights')) { json = insightsFixture(); json.range.fromDate = url.searchParams.get('from') || '2026-10-01'; json.range.toDate = url.searchParams.get('to') || '2026-10-29'; json.granularity = url.searchParams.get('granularity') || 'DAY'; }
      else if (path.endsWith('/dashboard/payments')) json = paymentFixture();
      else if (path.endsWith('/admin/users/7')) json = user;
      else if (path.endsWith('/admin/users')) json = { content: [user], totalElements: 1, totalPages: 1, page: 0, size: 20 };
      else if (path.endsWith('/admin/customers')) json = [customer];
      else if (path.endsWith('/admin/customers/7/bookings')) json = paged(originals, url);
      else if (path.endsWith('/admin/salons')) json = { content: salons, totalElements: 14, totalPages: 1, page: 0, size: 100 };
      else if (/\/admin\/salons\/\d+$/.test(path)) json = { salon: salons.find(salon => salon.id === Number(path.split('/').pop())), services: [], practitioners: [], schedules: [], recentBookings: [] };
      else if (path.endsWith('/admin/bookings')) json = paged(originals.filter(booking =>
        (!url.searchParams.get('status') || booking.status === url.searchParams.get('status')) &&
        (!url.searchParams.get('query') || booking.bookingCode.includes(url.searchParams.get('query')))), url);
      else if (path.endsWith('/categories')) json = [{ id: 1, name: 'Spa', slug: 'spa', imageUrl: '' }];
      else if (path.endsWith('/catalog/services') || path.endsWith('/homepage/services') || path.endsWith('/spa/services')) json = [service];
      return route.fulfill({ json });
    });
    await page.addInitScript(() => {
      localStorage.setItem('beautylink_onboarding_v1', JSON.stringify({ version: 1, completedAt: Date.now(), locationId: 1, city: 'Ho Chi Minh', category: 'all' }));
    });
    try {
      await page.goto(`${base}/#home`);
      await page.getByText('4.9', { exact: true }).first().waitFor();
      await page.getByText('4.9 (3)', { exact: true }).first().waitFor();
      assert.equal(await page.getByText('4.9 (168+)', { exact: true }).count(), 0);
      assert.equal(await page.getByText('4,850+ đã trải nghiệm', { exact: true }).count(), 0);
      await page.evaluate(() => {
        const sid = '11111111-1111-4111-8111-111111111111'; const expires = Date.now() + 3600000;
        const token = `header.${btoa(JSON.stringify({ sid, exp: Math.floor(expires / 1000) }))}.test-signature`;
        sessionStorage.setItem('beautylink_access_token', token);
        sessionStorage.setItem('beautylink_auth_meta_v1', JSON.stringify({ sid, lastActivityAt: Date.now(), absoluteExpiresAt: expires }));
      });
      await page.goto(`${base}/#admin-dashboard`); await page.reload();
      const completed = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Lịch hẹn hoàn thành', exact: true }) });
      await completed.locator('[data-admin-value]').filter({ hasText: '147' }).waitFor();
      const cards = page.locator('[aria-label="Chỉ số kinh doanh"] article');
      assert.deepEqual(await cards.locator('[data-admin-value]').allTextContents().then(values => values.slice(0, 4)), ['150', '286', new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(1906000), '14']);
      const returning = cards.filter({ has: page.getByRole('heading', { name: 'Khách hàng quay lại', exact: true }) });
      assert.ok(Number(await returning.locator('[data-admin-value]').innerText()) > 0);
      await page.getByRole('heading', { name: 'Doanh thu hoa hồng', exact: true }).waitFor();
      await page.locator('svg[aria-label="150 lịch trong kỳ"]').waitFor();
      for (const label of ['Chờ xác nhận', 'Đã xác nhận', 'Đã hủy']) {
        assert.match(await page.locator('li').filter({ hasText: label }).innerText(), /1 \(0\.7%\)/);
      }
      await page.getByRole('heading', { name: 'Kết quả kinh doanh & tài chính', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Khách đã đặt lịch: 78', exact: true }).click();
      const bookedCustomer = page.locator('tbody tr').filter({ hasText: '0912345678' });
      await bookedCustomer.waitFor();
      assert.equal(await bookedCustomer.locator('td').nth(4).innerText(), '6');
      assert.equal(await bookedCustomer.locator('td').nth(6).innerText(), '3');
      assert.equal(await bookedCustomer.locator('td').nth(7).innerText(), new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(65000));
      await bookedCustomer.getByRole('button', { name: 'Xem', exact: true }).click();
      await page.getByRole('dialog').getByText('BL-OLD-101', { exact: false }).waitFor();
      await page.getByRole('dialog').getByText('BL-OLD-104', { exact: false }).waitFor();
      await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).last().click();
      await page.goto(`${base}/#home`);
      await page.goto(`${base}/#admin-customers`);
      await page.reload();
      await page.getByText('286 kết quả', { exact: true }).waitFor();
      assert.equal(await page.locator('tbody tr').count(), 20);
      assert.deepEqual(await page.locator('thead th').allTextContents(), ['Người dùng', 'Email', 'Vai trò', 'Ngày tạo', 'Thao tác']);
      const row = page.locator('tbody tr').first();
      assert.equal(await row.locator('td').count(), 5);
      const firstName = await row.locator('td').nth(0).innerText(); const firstEmail = await row.locator('td').nth(1).innerText();
      assert.match(firstEmail, /@(gmail|outlook|yahoo)\.com/);
      assert.doesNotMatch(await row.innerText(), /seed\.beautylink\.test|\+492/);
      await row.getByRole('button', { name: 'Xem chi tiết', exact: true }).click();
      await page.getByRole('heading', { name: firstName, exact: true }).waitFor();
      await page.getByText(firstEmail, { exact: true }).waitFor();
      await page.goto(`${base}/#admin-customers`);
      await page.getByText('286 kết quả', { exact: true }).waitFor();
      await page.getByRole('combobox', { name: 'Lọc vai trò' }).selectOption('SUPPLIER');
      await page.getByText('14 kết quả', { exact: true }).waitFor();
      await page.goto(`${base}/#admin-salons`);
      await page.getByText('14 kết quả', { exact: true }).waitFor();
      assert.equal(await page.locator('tbody tr').count(), 14);
      assert.equal(await page.locator('tbody [data-admin-status="account"]').filter({ hasText: /^Hoạt động$/ }).count(), 14);
      await page.locator('tbody tr').first().getByRole('button', { name: 'Xem chi tiết', exact: true }).click();
      await page.getByRole('heading', { name: salons[0].name, exact: true }).waitFor();
      assert.equal(await page.locator('main header [data-admin-status="account"]').innerText(), 'Hoạt động');
      await page.goto(`${base}/#admin-bookings`);
      await page.getByRole('heading', { name: '150 lịch phù hợp', exact: true }).waitFor();
      assert.equal(await page.locator('tbody tr').count(), 20);
      assert.equal(await page.locator('tbody [data-admin-status="booking"]').filter({ hasText: /^Hoàn thành$/ }).count(), 20);
      for (const status of ['PENDING', 'CONFIRMED', 'CANCELLED']) {
        await page.getByRole('combobox', { name: 'Trạng thái lịch', exact: true }).selectOption(status);
        await page.getByRole('heading', { name: '1 lịch phù hợp', exact: true }).waitFor();
        await page.getByText(originals.find(booking => booking.status === status).bookingCode, { exact: true }).waitFor();
      }
      await page.getByRole('combobox', { name: 'Trạng thái lịch', exact: true }).selectOption('');
      await page.getByPlaceholder('Mã lịch, khách, salon, dịch vụ').fill('BL-OLD-103');
      await page.getByRole('heading', { name: '1 lịch phù hợp', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Chi tiết BL-OLD-103', exact: true }).click();
      await page.getByRole('dialog').getByText('30.000 ₫', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Đóng', exact: true }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.deepEqual(errors, []);
      assert.deepEqual(adminWrites, []);
      await context.route('**/api/v1/admin/users?*', route => route.fulfill({ status: 403, json: { message: 'Không có quyền xem danh sách người dùng.' } }));
      await page.goto(`${base}/#admin-customers`);
      await page.getByRole('alert').waitFor();
      assert.equal(await page.locator('tbody tr').count(), 0, 'presentation records do not bypass a denied admin request');
      console.log(`PASS ${viewport.width}x${viewport.height}: original bookings/payment retained, 150 total/147 completed, returning customers, 286 users, 14 active salons, no admin writes`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
