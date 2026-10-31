import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const errors = []; const capacityPaths = []; let writes = 0;
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 500) errors.push(`API ${response.status()}`); });
page.on('request', request => { const path=new URL(request.url()).pathname; if (request.method()==='GET' && /\/services\/\d+\/capacity$/.test(path)) capacityPaths.push(path); if (request.method() === 'POST' && /\/api\/v1\/(bookings$|payments\/payos\/bookings\/)/.test(new URL(request.url()).pathname)) writes++; });
const slots = () => page.locator('button').evaluateAll(nodes => nodes.filter(node => /^\d{2}:\d{2}/.test(node.textContent.trim())).map(node => ({ label: node.textContent.trim(), disabled: node.disabled })));
let workingDate;
async function schedule() {
  const dateInput = page.locator('input[type=date]');
  await dateInput.waitFor();
  if (!capacityPaths.length) await page.waitForRequest(request => /\/services\/\d+\/capacity$/.test(new URL(request.url()).pathname));
  if (!workingDate) {
    // Tomorrow can be a closed Sunday; use actual server capacity, not a weekday assumption.
    workingDate = await page.evaluate(async ({ path, first }) => {
      for (let offset = 0; offset < 7; offset++) {
        const date = new Date(`${first}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + offset);
        const day = date.toISOString().slice(0, 10);
        const response = await fetch(`${path}?date=${day}`);
        if (response.ok && (await response.json()).slots.some(slot => slot.availablePractitioners > 0)) return day;
      }
      return null;
    }, { path: capacityPaths.at(-1), first: await dateInput.inputValue() });
    assert.ok(workingDate, 'seeded service must have capacity within the next working week');
  }
  if (await dateInput.inputValue() !== workingDate) await dateInput.fill(workingDate);
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => /^\d{2}:\d{2}/.test(button.textContent.trim()) && !button.disabled));
  assert.equal(await page.getByRole('dialog').count(), 0, 'direct checkout must not open the obsolete booking modal');
  return slots();
}
try {
  // Deterministic vendor greeting, as in chatWidgetSmoke; never contacts the external chat service.
  await page.route('https://chat.topaichat.vn/sdk.js', route => route.fulfill({ contentType: 'application/javascript', body: `
    const box=document.createElement('div'); box.style.cssText='position:fixed;bottom:24px;right:24px;width:300px;height:170px;z-index:2147483647';
    const frame=document.createElement('iframe'); frame.title='TopAiChat Widget'; frame.style.cssText='width:100%;height:100%';
    box.append(frame); document.body.append(box);
  ` }));
  // Existing isolated harness performs real password login. No production credentials or auth bypass.
  await page.goto('http://localhost:5173/tests/review-smoke.html');
  await page.locator('article').filter({ hasText: 'SMOKE-UNPAID' }).waitFor();
  await page.evaluate(async () => {
    const locations = await (await fetch('/api/v1/locations')).json();
    const location = locations[0];
    localStorage.setItem('beautylink_onboarding_v1', JSON.stringify({ version: 1, completedAt: Date.now(), locationId: location.id, city: location.name || location.city || 'Test city', category: 'all' }));
  });
  await page.goto('http://localhost:5173/');
  const firstCard = page.getByTitle('Thêm vào giỏ', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"group")][1]');
  const serviceName = await firstCard.locator('h3').textContent();
  assert.ok(serviceName?.trim());
  await firstCard.locator('h3').click();
  await page.waitForURL(/#checkout$/);
  const direct = await schedule();
  assert.equal(await page.locator('iframe[title="TopAiChat Widget"]').isVisible(), false);
  await page.screenshot({ path: 'backend/target/checkout-shared-direct-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
  const sameCard = page.getByTitle('Thêm vào giỏ', { exact: true }).locator('xpath=ancestor::div[contains(@class,"group")][1]').filter({ has: page.getByRole('heading', { name: serviceName.trim(), exact: true }) }).first();
  await sameCard.getByTitle('Thêm vào giỏ', { exact: true }).click();
  await page.getByTitle('Giỏ dịch vụ & Lịch hẹn', { exact: true }).click();
  await page.getByRole('button', { name: 'Tiến hành thanh toán', exact: true }).click();
  await page.waitForURL(/#checkout$/);
  assert.deepEqual(await schedule(), direct, 'direct and cart must show identical server availability');
  assert.ok(capacityPaths.length >= 2); assert.equal(new Set(capacityPaths).size, 1, 'both entries retain the actual service ID');
  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `backend/target/checkout-shared-cart-${width}.png`, fullPage: true });
  }
  const time = page.getByRole('button').filter({ hasText: /^\d{2}:\d{2}/ }).filter({ hasNotText: 'Hết chỗ' }).first();
  await time.click();
  await page.getByRole('button', { name: /Tiếp tục: Chọn hình thức/ }).click();
  await page.getByText(/Tóm tắt dịch vụ đã chọn/).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: 'backend/target/checkout-shared-confirmation-360.png', fullPage: true });
  assert.equal(await page.getByRole('button', { name: /Tiếp tục: Tóm tắt/ }).count(), 0);
  assert.equal(writes, 0, 'selecting a service/schedule must not reserve slots or create payments');
  assert.deepEqual(errors, []);
  console.log('PASS actual App: product/direct and cart share one two-step checkout and identical capacity; 1366/390/360 layouts; zero booking/payment writes.');
} finally { await browser.close(); }
