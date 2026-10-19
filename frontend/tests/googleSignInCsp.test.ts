import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('production CSP permits the Google Identity Services script and button frame', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const headers = config.headers.flatMap((route: { headers: { key: string; value: string }[] }) => route.headers);
  const policy = headers.find((header: { key: string }) => header.key.toLowerCase() === 'content-security-policy')?.value;

  assert.ok(policy);
  assert.match(policy, /script-src[^;]*https:\/\/accounts\.google\.com\/gsi\/client/);
  assert.match(policy, /frame-src[^;]*https:\/\/accounts\.google\.com\/gsi\//);
  assert.match(policy, /style-src[^;]*https:\/\/accounts\.google\.com\/gsi\/style/);
});
