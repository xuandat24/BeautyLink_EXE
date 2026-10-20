import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Footer } from '../src/components/Footer.tsx';

test('all frontend source stays free of AI-style sparkle icons, including data-driven labels', () => {
  const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
  const forbidden = /\b(?:Sparkles|Sparkle|WandSparkles|Wand2|Bot|BrainCircuit)\b|[\u2728\u2726\u{1FA84}\u{1F916}]/u;
  const violations: string[] = [];
  const inspect = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) inspect(path);
      else if (/\.(?:tsx?|jsx?|svg|css)$/.test(entry.name) && forbidden.test(readFileSync(path, 'utf8'))) violations.push(path);
    }
  };
  inspect(sourceRoot);
  assert.deepEqual(violations, [], 'remove both direct JSX icons and icon references/emoji in data');
});

test('footer has no AI-style brand icon or empty icon tile and keeps contact information usable', () => {
  const markup = renderToStaticMarkup(React.createElement(Footer));
  assert.doesNotMatch(markup, /lucide-sparkles/);
  assert.doesNotMatch(markup, /w-9 h-9 rounded-xl/);
  assert.match(markup, /BeautyLink/);
  assert.match(markup, /Hotline CSKH/);
  assert.match(markup, /Email hỗ trợ/);
  assert.match(markup, /lucide-phone/);
  assert.match(markup, /lucide-mail/);
  assert.match(markup, /lucide-map-pin/);
});
