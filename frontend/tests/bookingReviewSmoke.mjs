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
  await page.reload(); await card('SMOKE-PAST-DEPOSIT').waitFor();
  await card('SMOKE-PAST-DEPOSIT').getByRole('button', { name: /đánh giá/i }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nhận xét (tùy chọn)').waitFor();
  assert.equal(await dialog.getByLabel('Nhận xét (tùy chọn)').inputValue(), 'SMOKE-SERVICE-updated');
  await dialog.getByLabel('Đối tượng đánh giá').selectOption('SUPPLIER');
  await page.waitForFunction(() => document.querySelector('textarea')?.value === 'SMOKE-SUPPLIER-updated');
  await dialog.getByRole('button', { name: 'Đóng đánh giá' }).click();
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
  await page.getByText('SMOKE-SUPPLIER-updated', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Service', exact: true }).click();
  await page.getByRole('button', { name: 'Đánh giá (1)', exact: true }).first().click();
  await page.getByText('SMOKE-SERVICE-updated', { exact: true }).waitFor();
  assert.deepEqual(failures, []);
  console.log('PASS: real Spring/H2/JWT browser completion, both review upserts, reload, Explore and detail scopes; no API errors/page errors.');
} finally { await browser.close(); }
