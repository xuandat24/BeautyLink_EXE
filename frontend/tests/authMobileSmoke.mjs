import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const targets = [
  ['mobile Chromium', chromium, devices['Pixel 7']],
  ['mobile WebKit', webkit, devices['iPhone 13']],
];

for (const [label, browserType, device] of targets) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext(device);
  const page = await context.newPage();
  let loginRequests = 0;
  const expectedPassword = 'Synthetic Mobile 123! ';
  try {
    await page.route('**/api/v1/auth/login', async route => {
      loginRequests++;
      const body = route.request().postDataJSON();
      assert.equal(body.identifier, '0901234567');
      assert.equal(body.password, expectedPassword);
      await new Promise(resolve => setTimeout(resolve, 100));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        accessToken: 'synthetic-browser-test-token',
        user: { id: 7001, fullName: 'Mobile Browser Test', phone: '0901234567', role: 'CUSTOMER' },
      }) });
    });
    await page.goto('http://127.0.0.1:5173/#login');
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
    console.log(`PASS: ${label} preserves the exact controlled password through show/hide and blocks duplicate submit.`);
  } finally {
    await browser.close();
  }
}
