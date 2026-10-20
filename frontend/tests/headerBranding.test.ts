import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Header } from '../src/components/Header.tsx';

test('header removes AI-style sparkles while retaining brand, partner action and functional icons', () => {
  const markup = renderToStaticMarkup(React.createElement(Header, {
    cartCount: 1,
    notifications: [],
    onOpenCart() {},
    onOpenPartnerModal() {},
    onOpenAuthModal() {},
    onSearch() {},
  }));
  assert.doesNotMatch(markup, /lucide-sparkles/);
  assert.match(markup, /Beauty/);
  assert.match(markup, /Link/);
  assert.match(markup, /Trở thành đối tác/);
  assert.match(markup, /lucide-search/);
  assert.match(markup, /lucide-shopping-cart/);
  assert.match(markup, /lucide-bell/);
});
