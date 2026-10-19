import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('public privacy policy is a dedicated page linked from the homepage', () => {
  const policy = readFileSync(new URL('../public/privacy.html', import.meta.url), 'utf8');
  const footer = readFileSync(new URL('../src/components/Footer.tsx', import.meta.url), 'utf8');

  assert.match(policy, /<title>Chính sách quyền riêng tư \| BeautyLink<\/title>/);
  assert.match(policy, /<h1>Chính sách quyền riêng tư<\/h1>/);
  assert.match(policy, /Đăng nhập bằng Google:/);
  assert.match(policy, /beautylink\.system@gmail\.com/);
  assert.match(policy, /PayOS/);
  assert.match(footer, /href="\/privacy\.html"/);
});
