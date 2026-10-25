import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

test('production CSP permits the Google Identity Services script and button frame', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const headers = config.headers.flatMap((route: { headers: { key: string; value: string }[] }) => route.headers);
  const policy = headers.find((header: { key: string }) => header.key.toLowerCase() === 'content-security-policy')?.value;

  assert.ok(policy);
  assert.match(policy, /script-src[^;]*https:\/\/accounts\.google\.com\/gsi\/client/);
  assert.match(policy, /frame-src[^;]*https:\/\/accounts\.google\.com\/gsi\//);
  assert.match(policy, /style-src[^;]*https:\/\/accounts\.google\.com\/gsi\/style/);
});

test('TopAIChat embed loads once with the supplied public token and production CSP permits its script and frame', () => {
  const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'));
  try {
    const scripts = dom.window.document.querySelectorAll('script[src="https://chat.topaichat.vn/sdk.js"]');
    assert.equal(scripts.length, 1);
    const script = scripts[0];
    assert.equal(script.getAttribute('data-token'), 'wgt_pub_918983beb229743e2cd783542b08a68a9d85');
    assert.equal(script.getAttribute('data-origin'), 'https://chat.topaichat.vn');
    assert.equal(script.getAttribute('data-no-optimize'), '1');
    assert.equal(script.getAttribute('data-cfasync'), 'false');
    assert.equal(script.hasAttribute('async'), true);
    const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    const policy = config.headers[0].headers.find((header: { key: string }) => header.key === 'Content-Security-Policy').value;
    assert.match(policy, /script-src[^;]*https:\/\/chat\.topaichat\.vn\/sdk\.js/);
    assert.match(policy, /frame-src[^;]*https:\/\/chat\.topaichat\.vn/);
  } finally {
    dom.window.close();
  }
});
