import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { Header } from '../src/components/Header';

const asset = (name: string) => new URL(`../public/${name}`, import.meta.url);
test('official branding assets have correct dimensions, alpha and ICO frames', () => {
  for (const [name, size] of Object.entries({ 'beautylink-icon.png': 544, 'favicon-16x16.png': 16,
    'favicon-32x32.png': 32, 'apple-touch-icon.png': 180, 'android-chrome-192x192.png': 192,
    'android-chrome-512x512.png': 512 })) {
    const png = readFileSync(asset(name));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    assert.equal(png[25], 6, 'RGBA format is required');
  }
  const ico = readFileSync(asset('favicon.ico'));
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  assert.deepEqual([0, 1, 2].map(i => [ico[6 + i * 16], ico[7 + i * 16]]), [[16, 16], [32, 32], [48, 48]]);
});

test('HTML and manifest reference existing official icons without replacing SEO', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html);
  for (const link of dom.window.document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"],link[rel="manifest"]')) {
    const href = link.getAttribute('href')!;
    assert.ok(href.startsWith('/'));
    assert.ok(existsSync(asset(href.slice(1))), href);
  }
  assert.equal(dom.window.document.querySelectorAll('link[rel="icon"]').length, 3);
  assert.match(dom.window.document.title, /BeautyLink/);
  assert.ok(dom.window.document.querySelector('meta[name="description"]'));
  assert.doesNotMatch(html, /vite\.svg|react\.svg/);
  const manifest = JSON.parse(readFileSync(asset('site.webmanifest'), 'utf8'));
  assert.deepEqual(manifest.icons.map((icon: { sizes: string }) => icon.sizes), ['192x192', '512x512']);
  for (const icon of manifest.icons) assert.ok(existsSync(asset(icon.src.slice(1))));
  dom.window.close();
});

test('Header uses official B next to original wordmark and home link', () => {
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(Header, {
    cartCount: 0, onOpenCart() {}, onOpenPartnerModal() {}, onOpenAuthModal() {}, onSearch() {},
  })));
  const link = dom.window.document.querySelector('a[aria-label="BeautyLink — Trang chủ"]')!;
  assert.equal(link.getAttribute('href'), '/');
  assert.equal(link.querySelector('img')?.getAttribute('src'), '/beautylink-icon.png');
  assert.match(link.textContent!, /BeautyLink/);
  assert.match(link.textContent!, /Sắc Đẹp & Spa Uy Tín/);
  assert.equal(link.querySelector('img')?.getAttribute('alt'), '', 'wordmark supplies accessible name');
  dom.window.close();
});
