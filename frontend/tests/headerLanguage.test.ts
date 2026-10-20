import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Header } from '../src/components/Header';

test('header offers only Vietnamese and keeps Vietnamese authentication labels', () => {
  const html = renderToStaticMarkup(React.createElement(Header, {
    cartCount: 0, onOpenCart() {}, onOpenPartnerModal() {}, onOpenAuthModal() {}, onSearch() {},
  }));
  assert.match(html, /Tiếng Việt/);
  assert.match(html, /Đăng nhập/);
  assert.match(html, /Đăng ký/);
  assert.doesNotMatch(html, /English|🇬🇧|>EN<|Sign up|Log in|Partner with us/);
});
