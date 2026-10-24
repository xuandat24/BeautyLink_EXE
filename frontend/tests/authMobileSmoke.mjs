import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
// Match the isolated Spring test profile's allowed origin; Vite proxies /api to H2.
const baseURL = 'http://localhost:5173';
const targets = [
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
  try {
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
    const headers = { Authorization: `Bearer ${issuedToken}` };
    const me = await context.request.get(`${baseURL}/api/v1/auth/me`, { headers });
    assert.equal(me.status(), 200);
    assert.equal((await me.json()).id, signedInUser.id);
    assert.equal((await context.request.post(`${baseURL}/api/v1/auth/session/logout`, { headers })).status(), 204);
    assert.equal((await context.request.get(`${baseURL}/api/v1/auth/me`, { headers })).status(), 401);
    console.log(`PASS: ${label} preserves exact password, blocks duplicate submit, and verifies real Spring session/profile/logout revocation.`);
  } finally {
    await browser.close();
  }
}
