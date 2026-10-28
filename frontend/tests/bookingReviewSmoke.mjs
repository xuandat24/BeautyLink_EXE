import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Use an installed Playwright runtime, not an additional unit-test framework.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER_CHANNEL || undefined });
const page = await browser.newPage();
const failures = [];
page.on('pageerror', e => failures.push(e.message));
page.on('console', message => { if (message.type() === 'error') failures.push(message.text()); });
page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 400) failures.push(`${response.status()} ${new URL(response.url()).pathname}`); });
const card = code => page.locator('article').filter({ hasText: code });
try {
  await page.goto('http://localhost:5173/tests/review-smoke.html');
  await card('SMOKE-UNPAID').waitFor();
  // Pending local ledger + delayed provider PAID, no webhook: history must reconcile and remove checkout.
  await card('SMOKE-HISTORY-PAID').getByText('Đã thanh toán đủ', { exact: true }).waitFor();
  // Local filters keep the existing list; payment and booking statuses are separate.
  await page.getByLabel('Tìm lịch hẹn', { exact: true }).fill('SMOKE-HISTORY-PAID');
  await page.getByLabel('Trạng thái thanh toán', { exact: true }).selectOption('PAID');
  await page.getByLabel('Trạng thái lịch hẹn', { exact: true }).selectOption('CONFIRMED');
  assert.equal(await page.locator('article').count(), 1);
  for (const width of [1366, 390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (width < 640) {
      const toggle = page.getByRole('button', { name: /^Bộ lọc/ });
      await toggle.click(); assert.equal(await page.getByLabel('Trạng thái lịch hẹn', { exact: true }).isVisible(), true);
      await page.getByRole('button', { name: 'Thu gọn bộ lọc', exact: true }).click();
    }
    await page.screenshot({ path: `backend/target/booking-history-${width}.png`, fullPage: true });
  }
  await page.getByLabel('Tìm lịch hẹn', { exact: true }).fill('no-matching-booking');
  await page.getByRole('heading', { name: 'Không có lịch hẹn phù hợp', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).first().click();
  await page.setViewportSize({ width: 1366, height: 900 });

  assert.ok((await card('SMOKE-HISTORY-PAID').textContent()).includes('Đã xác nhận'));
  assert.equal(await card('SMOKE-HISTORY-PAID').getByRole('button', { name: 'Tiếp tục thanh toán', exact: true }).count(), 0);
  for (const code of ['SMOKE-FUTURE-DEPOSIT', 'SMOKE-FUTURE-FULL', 'SMOKE-PAST-DEPOSIT', 'SMOKE-PAST-FULL', 'SMOKE-MANUAL', 'SMOKE-UNCERTAIN-PAID']) {
    assert.equal(await card(code).getByRole('button', { name: 'Hủy lịch', exact: true }).count(), 0);
  }
  assert.equal(await card('SMOKE-MANUAL').getByRole('button', { name: /đánh giá/i }).count(), 0);
  assert.equal(await card('SMOKE-MANUAL').getByRole('button', { name: 'Đã sử dụng dịch vụ' }).count(), 0);
  for (const name of [/đánh giá/i, 'Đã sử dụng dịch vụ', /tiếp tục thanh toán/i]) {
    assert.equal(await card('SMOKE-UNCERTAIN-PAID').getByRole('button', { name }).count(), 0);
  }
  assert.ok((await card('SMOKE-UNCERTAIN-PAID').textContent()).includes('đối soát'));
  await card('SMOKE-PENDING-LINK').getByRole('button', { name: 'Hủy lịch', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('article')].some(a => a.textContent.includes('SMOKE-PENDING-LINK') && a.textContent.includes('Đã hủy')));
  for (const code of ['SMOKE-UNPAID', 'SMOKE-FUTURE-DEPOSIT', 'SMOKE-FUTURE-FULL', 'SMOKE-CANCELLED', 'SMOKE-REFUNDED']) {
    assert.equal(await card(code).getByRole('button', { name: 'Đã sử dụng dịch vụ' }).count(), 0);
    assert.equal(await card(code).getByRole('button', { name: /đánh giá/i }).count(), 0);
  }
  for (const code of ['SMOKE-PAST-DEPOSIT', 'SMOKE-PAST-FULL']) {
    await card(code).getByRole('button', { name: 'Đã sử dụng dịch vụ' }).click();
    await page.getByRole('button', { name: 'Xác nhận hoàn thành', exact: true }).click();
    await card(code).getByRole('button', { name: 'Đánh giá dịch vụ / nhà cung cấp', exact: true }).waitFor();
  }
  for (const target of ['SERVICE', 'SUPPLIER']) {
    for (const suffix of ['created', 'updated']) {
      await card('SMOKE-PAST-DEPOSIT').getByRole('button', { name: /đánh giá/i }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Đối tượng đánh giá').selectOption(target);
      await dialog.getByLabel('Nhận xét (tùy chọn)').fill(`SMOKE-${target}-${suffix}`);
      const saved = page.waitForResponse(r => r.url().endsWith(`/reviews/${target}`) && r.request().method() === 'PUT');
      await dialog.getByRole('button', { name: 'Lưu đánh giá' }).click();
      assert.equal((await saved).status(), 200);
      await dialog.waitFor({ state: 'hidden' });
    }
  }
  // Mid-service public review, image validation/preparation/storage and reload, without completing the booking.
  await card('SMOKE-MIDPOINT').getByRole('button', { name: /đánh giá/i }).click();
  const photoDialog = page.getByRole('dialog');
  const imageBytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 40;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ec4899'; ctx.fillRect(0, 0, 40, 40);
    return Array.from(new Uint8Array(await (await fetch(canvas.toDataURL('image/png'))).arrayBuffer()));
  });
  await photoDialog.locator('input[type=file]').setInputFiles({ name: 'experience.png', mimeType: 'image/png', buffer: Buffer.from(imageBytes) });
  await photoDialog.getByAltText('Ảnh trải nghiệm 1', { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: 'backend/target/review-midpoint-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({ path: 'backend/target/review-midpoint-desktop.png', fullPage: true });
  await photoDialog.getByLabel('Nhận xét (tùy chọn)').fill('SMOKE-MIDPOINT-PHOTO');
  const photoSaved = page.waitForResponse(r => r.url().endsWith('/reviews/SERVICE') && r.request().method() === 'PUT');
  await photoDialog.getByRole('button', { name: 'Lưu đánh giá' }).click();
  assert.equal((await photoSaved).status(), 200); assert.equal((await (await photoSaved).json()).images.length, 1);
  await photoDialog.waitFor({ state: 'hidden' });
  assert.ok((await card('SMOKE-MIDPOINT').textContent()).includes('Đã xác nhận'));
  await page.reload(); await card('SMOKE-MIDPOINT').getByRole('button', { name: /đánh giá/i }).click();
  await page.getByRole('dialog').getByAltText('Ảnh trải nghiệm 1', { exact: true }).waitFor();
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng đánh giá' }).click();
  await page.reload(); await card('SMOKE-PAST-DEPOSIT').waitFor();
  await card('SMOKE-PAST-DEPOSIT').getByRole('button', { name: /đánh giá/i }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nhận xét (tùy chọn)').waitFor();
  assert.equal(await dialog.getByLabel('Nhận xét (tùy chọn)').inputValue(), 'SMOKE-SERVICE-updated');
  await dialog.getByLabel('Đối tượng đánh giá').selectOption('SUPPLIER');
  await page.waitForFunction(() => document.querySelector('textarea')?.value === 'SMOKE-SUPPLIER-updated');
  await dialog.getByRole('button', { name: 'Đóng đánh giá' }).click();
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByRole('button', { name: 'Lịch hẹn & Lịch sử Booking', exact: true }).click();
  await card('SMOKE-PAST-DEPOSIT').getByRole('button', { name: /đánh giá/i }).waitFor();
  await page.getByRole('button', { name: 'Appointments', exact: true }).click();
  await card('SMOKE-PAST-DEPOSIT').getByRole('button', { name: /đánh giá/i }).waitFor();
  await page.getByRole('button', { name: 'Đóng lịch hẹn', exact: true }).click();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const deal = page.locator('article').filter({ hasText: 'Ảnh các bước' }).first();
  await deal.getByRole('button', { name: /đánh giá/i }).click();
  await page.getByText('SMOKE-SERVICE-updated', { exact: true }).waitFor();

  assert.equal(await page.getByText('SMOKE-SUPPLIER-updated', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Đã hiểu' }).click();
  await page.locator('article').last().getByRole('button', { name: /đánh giá/i }).click();
  await page.getByText('SMOKE-SUPPLIER-updated', { exact: true }).waitFor();
  assert.equal(await page.getByText('SMOKE-SERVICE-updated', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Đã hiểu' }).click();
  await page.getByRole('button', { name: 'Partner', exact: true }).click();
  const reviewedPartnerName = (await page.getByTestId('partner-shop-name').textContent())?.trim();
  assert.ok(reviewedPartnerName);
  await page.getByText('SMOKE-SUPPLIER-updated', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Service', exact: true }).click();
  await page.getByRole('button', { name: `Xem cửa hàng ${reviewedPartnerName}`, exact: true }).click();
  await page.getByTestId('partner-shop-name').waitFor();
  assert.equal((await page.getByTestId('partner-shop-name').textContent())?.trim(), reviewedPartnerName);
  await page.getByRole('button', { name: 'Tất cả dịch vụ & Đánh giá', exact: true }).waitFor();
  await page.getByText('SMOKE-SUPPLIER-updated', { exact: true }).waitFor();
  // Real createBooking -> real createPayment persistence, but never contact PayOS:
  // block the redirect and replace it with a visibly test-only local document.
  await page.route('https://pay.payos.vn/**', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<h1>FAKE GATEWAY — NO MONEY TRANSFER</h1>' }));
  let observedPayment, delayNextCreate = false, delayedCreates = 0;
  await page.route('**/api/v1/payments/payos/bookings/*', async route => {
    // Read the REAL backend response before navigation destroys Chrome's response body.
    const response = await route.fetch(); observedPayment = await response.json();
    if (delayNextCreate) { delayNextCreate = false; delayedCreates++; await new Promise(resolve => setTimeout(resolve, 11000)); }
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Bookings', exact: true }).click();
  let newBookings = 0;
  const trackBookings = request => { if (new URL(request.url()).pathname === '/api/v1/bookings' && request.method() === 'POST') newBookings++; };
  page.on('request', trackBookings);
  for (const [code, oldOrder, reuse] of [['SMOKE-RESUME', 9100002, true], ['SMOKE-RETRY', 9100003, false]]) {
    await card(code).getByRole('button', { name: /^(Tiếp tục thanh toán|Xem thanh toán)$/ }).click();
    const resumeUrl = page.url(); assert.match(resumeUrl, /bookingPayment=\d+/);
    await page.reload();
    if (!reuse) {
      await page.getByRole('button', { name: 'Mở thanh toán QR', exact: true }).click();
    }
    await page.getByRole('heading', { name: 'Thanh toán lịch hẹn', exact: true }).waitFor();
    const ownedId = new URL(page.url()).searchParams.get('bookingPayment');
    const recovered = await page.evaluate(async id => {
      const token = sessionStorage.getItem('beautylink_access_token');
      return (await fetch(`/api/v1/payments/payos/bookings/${id}/current`, { headers: { Authorization: `Bearer ${token}` } })).json();
    }, ownedId);
    assert.equal(recovered.orderCode === oldOrder, reuse);
    if (reuse) await page.getByRole('link', { name: 'Mở phiên trên PayOS' }).waitFor();
    else await page.getByRole('img', { name: /Mã QR PayOS/ }).waitFor();
    assert.equal(newBookings, 0);
    await page.reload(); await page.getByRole('heading', { name: 'Thanh toán lịch hẹn', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Quay lại lịch hẹn', exact: true }).click();
    assert.doesNotMatch(page.url(), /bookingPayment=/); assert.equal(newBookings, 0);
  }
  page.off('request', trackBookings);
  await page.getByRole('button', { name: 'Checkout', exact: true }).click();
  await page.getByRole('button', { name: /Tiếp tục: Chọn hình thức/ }).click();
  delayNextCreate = true;
  const openingStarted = Date.now();
  const [paymentResponse] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/payments/payos') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /Mở thanh toán QR/ }).click(),
  ]);
  assert.equal(paymentResponse.status(), 200);
  assert.ok(Date.now() - openingStarted >= 11000, 'real browser must survive a response slower than the former 10s cutoff');
  assert.equal(delayedCreates, 1);
  assert.equal(observedPayment.status, 'PENDING'); assert.equal(observedPayment.requiresManualReview, false);
  await page.locator('[data-checkout-state="VERIFYING"]').waitFor(); // inconclusive provider observation keeps instructions locked
  assert.equal(await page.getByRole('img', { name: /Mã QR PayOS/ }).count(), 0);
  // No second click: bounded status retry must recover this same attempt automatically.
  await page.getByRole('img', { name: /Mã QR PayOS/ }).waitFor({ timeout: 25000 });
  assert.equal(delayedCreates, 1);
  const brand = page.locator('[data-checkout-brand] img');
  assert.equal(await brand.getAttribute('src'), '/beautylink-icon.png');
  assert.equal(await brand.evaluate(image => image.complete && image.naturalWidth > 0), true);
  assert.equal(new URL(page.url()).hostname, 'localhost');
  await page.getByText('PayOS chưa cung cấp thông tin này', { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: 'backend/target/payos-qr-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'backend/target/payos-qr-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Quay lại lịch hẹn', exact: true }).click();
  await card('SMOKE-UNPAID').waitFor();
  assert.doesNotMatch(page.url(), /bookingPayment=/);
  assert.equal(await page.locator('[data-checkout-state]').count(), 0, 'return must not auto-open QR again');
  await page.reload(); await card('SMOKE-UNPAID').waitFor();
  assert.equal(await page.locator('[data-checkout-state]').count(), 0);
  // Actual App router restores the same observer immediately, without another payment POST.
  await page.goto(`http://localhost:5173/?bookingPayment=${observedPayment.bookingId}#account`);
  await page.getByRole('img', { name: /Mã QR PayOS/ }).waitFor();
  await page.reload(); await page.getByRole('img', { name: /Mã QR PayOS/ }).waitFor();
  await page.getByRole('button', { name: 'Quay lại lịch hẹn', exact: true }).click();
  assert.doesNotMatch(page.url(), /bookingPayment=/);
  assert.equal(new URL(page.url()).hash, '#bookings');
  await page.reload(); await page.getByRole('heading', { name: 'Lịch hẹn của tôi', exact: true }).waitFor();
  assert.equal(await page.locator('[data-checkout-state]').count(), 0);
  await page.goBack(); await card('SMOKE-UNPAID').waitFor();
  assert.equal(await page.locator('[data-checkout-state]').count(), 0);
  await page.goto(`http://localhost:5173/?bookingPayment=${observedPayment.bookingId}#account`);
  await page.getByRole('img', { name: /Mã QR PayOS/ }).waitFor();
  const callback = { success: true, code: '00', desc: 'SMOKE ONLY', signature: 'FAKE TEST GATEWAY ONLY', data: { code: '00', orderCode: observedPayment.orderCode, paymentLinkId: observedPayment.paymentLinkId, amount: observedPayment.amount, reference: 'SMOKE-VERIFIED', transactionDateTime: '2026-10-28 10:00:00' } };
  for(let duplicate=0;duplicate<2;duplicate++)assert.equal((await page.request.post('http://localhost:8080/api/v1/payments/payos/webhook',{data:callback})).status(),200);
  await page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click();
  await page.getByRole('heading', { name: 'Thanh toán thành công', exact: true }).waitFor();
  assert.equal(await page.getByRole('img', { name: /Mã QR PayOS/ }).count(),0);
  const jwt=await page.evaluate(()=>sessionStorage.getItem('beautylink_access_token'));
  const persisted=await (await page.request.get(`http://localhost:8080/api/v1/payments/payos/${observedPayment.orderCode}`,{headers:{Authorization:`Bearer ${jwt}`}})).json();
  assert.equal(persisted.status,'PAID');assert.equal(persisted.checkoutAllowed,false);assert.equal(persisted.qrCode,null);
  assert.deepEqual(failures, []);
  console.log('PASS: browser -> Spring/JWT/H2; paid history reconciliation without webhook, continuation reload/back navigation/reuse/safe expiry retry without new booking; paid/manual guards, pending cancellation, completion, midpoint review photo upload/reload on desktop/mobile, review upserts/reload, account/appointments/Explore/details, checkout -> fake gateway; no API/page/console errors.');
} catch (error) {
  await page.screenshot({ path: 'backend/target/booking-history-failure.png', fullPage: true }).catch(() => {});
  console.error('Local smoke diagnostic:', failures, await page.locator('[role="alert"]').allTextContents());
  throw error;
} finally { await browser.close(); }
