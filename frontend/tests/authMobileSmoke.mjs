import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
// Match the isolated Spring test profile's allowed origin; Vite proxies /api to H2.
const baseURL = 'http://localhost:5173';
const targets = [
  ['desktop Chromium', chromium, { viewport: { width: 1440, height: 900 } }],
  ['mobile Chromium', chromium, devices['Pixel 7']],
  ['mobile WebKit', webkit, devices['iPhone 13']],
];

for (const [label, browserType, device] of targets) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext(device);
  const page = await context.newPage();
  let loginRequests = 0;
  let issuedToken;
  let signedInUser;
  const expectedPassword = 'Synthetic Mobile 123! ';
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().startsWith(`${baseURL}/api/`) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  try {
    const locations = await (await context.request.get(`${baseURL}/api/v1/locations`)).json();
    assert.ok(locations[0]?.id);
    await context.addInitScript(location => {
      localStorage.setItem('beautylink_onboarding_v1', JSON.stringify({ version: 1, completedAt: Date.now(), locationId: location.id, city: location.name, category: 'all' }));
    }, locations[0]);
    await page.route('**/api/v1/auth/login', async route => {
      loginRequests++;
      const body = route.request().postDataJSON();
      assert.equal(body.identifier, '0901234567');
      assert.equal(body.password, expectedPassword);
      await new Promise(resolve => setTimeout(resolve, 100));
      // The isolated smoke server owns this synthetic account. Do not fake a JWT or /me.
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      const auth = await response.json();
      issuedToken = auth.accessToken;
      signedInUser = auth.user;
      assert.equal(typeof issuedToken, 'string');
      assert.equal(signedInUser.phone, '0901234567');
      assert.equal(signedInUser.role, 'CUSTOMER');
      await route.fulfill({ response });
    });
    await page.goto(`${baseURL}/#login`);
    const identifier = page.locator('#customer-identifier');
    const password = page.locator('#customer-password');
    await identifier.fill('0901234567');
    await password.pressSequentially(expectedPassword);
    assert.equal(await password.inputValue(), expectedPassword);
    await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
    assert.equal(await password.getAttribute('type'), 'text');
    assert.equal(await password.inputValue(), expectedPassword);
    await page.getByRole('button', { name: 'Ẩn mật khẩu' }).click();
    assert.equal(await password.getAttribute('type'), 'password');
    assert.equal(await password.inputValue(), expectedPassword);

    const submit = page.getByRole('button', { name: 'Đăng nhập ngay' });
    await submit.dblclick();
    await page.waitForFunction(() => location.hash !== '#login');
    assert.equal(loginRequests, 1);
    await page.getByTitle(/Đang đăng nhập: Mobile Browser Test/).click();
    await page.getByRole('heading', { name: 'Thông tin cá nhân & Định danh' }).waitFor();
    const profileHeading = await page.getByRole('heading', { name: 'Thông tin cá nhân & Định danh' }).elementHandle();
    const documentId = await page.evaluate(() => { window.__smokeDocument = Math.random(); return window.__smokeDocument; });
    await page.getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true }).click();
    const nameDraft = page.locator('form input[type="text"]').first();
    await nameDraft.fill('Unsaved Profile Draft');
    await page.getByTitle('Cập nhật ảnh đại diện').click();
    await page.getByRole('button', { name: 'Tải từ thiết bị', exact: true }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.locator('label').filter({ hasText: 'Bấm để chọn ảnh' }).click();
    await (await chooser).setFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') });
    await page.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
    await page.getByRole('status').filter({ hasText: 'Đang xử lý ảnh' }).waitFor({ state: 'hidden' });
    assert.equal(await profileHeading.evaluate(element => element.isConnected), true);
    assert.equal(await page.getByText('Đang kiểm tra quyền truy cập…', { exact: true }).count(), 0);
    const saved = page.waitForResponse(response => response.url().endsWith('/api/v1/auth/me/avatar') && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Lưu ảnh đại diện', exact: true }).dblclick();
    assert.equal((await saved).status(), 200);
    await page.getByRole('dialog', { name: 'Thay đổi ảnh đại diện' }).waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => window.__smokeDocument), documentId, 'file picker/upload must not reload document');
    assert.equal(await profileHeading.evaluate(element => element.isConnected), true, 'upload must not remount Profile');
    assert.equal(await nameDraft.inputValue(), 'Unsaved Profile Draft', 'avatar update preserves other unsaved profile fields');
    issuedToken = await page.evaluate(() => sessionStorage.getItem('beautylink_access_token'));
    const avatar = (await (await context.request.get(`${baseURL}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${issuedToken}` } })).json()).avatarUrl;
    assert.ok(avatar?.startsWith('data:image/'), 'isolated browser server uses legacy image storage without outbound Cloudinary');
    await page.getByRole('button', { name: 'Quay lại trang chủ' }).click();
    await page.getByTitle(/Đang đăng nhập: Mobile Browser Test/).click();
    await page.reload();
    await page.getByRole('heading', { name: 'Thông tin cá nhân & Định danh' }).waitFor();
    assert.equal(await page.getByRole('img', { name: 'Mobile Browser Test', exact: true }).getAttribute('src'), avatar);
    assert.deepEqual(errors, []);
    const headers = { Authorization: `Bearer ${issuedToken}` };
    const me = await context.request.get(`${baseURL}/api/v1/auth/me`, { headers });
    assert.equal(me.status(), 200);
    assert.equal((await me.json()).id, signedInUser.id);
    assert.equal((await context.request.post(`${baseURL}/api/v1/auth/session/logout`, { headers })).status(), 204);
    assert.equal((await context.request.get(`${baseURL}/api/v1/auth/me`, { headers })).status(), 401);
    console.log(`PASS: ${label} real login/session, Profile navigation/file picker/upload without remount, avatar persistence after reload and logout revocation.`);
  } finally {
    await browser.close();
  }
}
