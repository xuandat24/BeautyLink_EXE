import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FirstBookingPhoneConfirmationDialog } from './FirstBookingPhoneConfirmationDialog';
import { vietnamPhoneSchema } from '../lib/validation';
import { requiresFirstBookingPhoneConfirmation } from '../lib/firstBookingPhoneConfirmation';
import { CurrentUser } from '../types';

const baseProps = {
  open: true,
  currentPhone: '0912345678',
  error: '',
  onCancel: () => undefined,
  onRetry: () => undefined,
  onConfirm: () => undefined,
};

test('renders the saved phone and explains that confirmation is not SIM ownership proof', () => {
  const html = renderToStaticMarkup(
    <FirstBookingPhoneConfirmationDialog {...baseProps} phase="confirm" />
  );
  assert.match(html, /0912345678/);
  assert.match(html, /không phải xác thực sở hữu SIM/);
  assert.match(html, /Xác nhận và tiếp tục đặt lịch/);
});

test('renders retry state instead of silently bypassing backend history failure', () => {
  const html = renderToStaticMarkup(
    <FirstBookingPhoneConfirmationDialog {...baseProps} phase="error" error="Không thể kiểm tra lịch sử đặt lịch" />
  );
  assert.match(html, /Không thể kiểm tra lịch sử đặt lịch/);
  assert.match(html, /Thử lại/);
});

test('uses the shared Vietnamese phone rule', () => {
  assert.equal(vietnamPhoneSchema.safeParse('0388888877').success, true);
  assert.equal(vietnamPhoneSchema.safeParse('0712345678').success, false);
  assert.equal(vietnamPhoneSchema.safeParse('09123').success, false);
});

test('applies the confirmation guard only to authenticated customers', () => {
  assert.equal(requiresFirstBookingPhoneConfirmation({ role: 'CUSTOMER' } as CurrentUser), true);
  assert.equal(requiresFirstBookingPhoneConfirmation({ role: 'SUPPLIER' } as CurrentUser), false);
  assert.equal(requiresFirstBookingPhoneConfirmation(null), false);
});
