import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { publicServiceShare } from '../src/lib/publicSharing';
import { BookingShareFeature } from '../src/components/BookingShareFeature';

test('public share allowlist never serializes booking details or the current private route', () => {
  const data = { serviceName: 'Nail art', supplierName: 'Salon', bookingCode: 'PRIVATE-CODE', totalAmount: 987654,
    appointmentDate: '2030-12-31', startTime: '23:42', practitionerName: 'PRIVATE-PERSON', note: 'PRIVATE-NOTE' };
  const value = publicServiceShare(data);
  assert.equal(value.url, 'https://beautylink.cloud/#filter-explore');
  for (const privateValue of ['PRIVATE-', '987654', '2030-12-31', '23:42']) assert.ok(!JSON.stringify(value).includes(privateValue));
  assert.equal(publicServiceShare({ ...data, serviceId: 42 }).url, 'https://beautylink.cloud/?serviceId=42');
});

test('every public tone/social sink excludes secrets; owner preview, code copy and callbacks remain', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://beautylink.cloud/admin/private?bookingPayment=88#account' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const exported: string[] = []; let clipboard = '', views = 0, done = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Desktop', share: async (data: unknown) => { exported.push(JSON.stringify(data)); }, clipboard: { writeText: async (s: string) => { clipboard = s; exported.push(s); } } } });
  dom.window.open = ((url: string) => { exported.push(decodeURIComponent(url)); return null; }) as any;
  const root = createRoot(document.getElementById('root')!);
  const data = { serviceName: 'Nail art', supplierName: 'Salon', bookingCode: 'SECRET-CHECKIN', totalAmount: 987654,
    appointmentDate: '2030-12-31', startTime: '23:42', endTime: '23:59', note: 'SECRET-NOTE', practitionerName: 'SECRET-PERSON' };
  try {
    for (const initialTone of ['busy', 'invite', 'excited', 'details'] as const) {
      await act(async () => root.render(React.createElement(BookingShareFeature, { data, initialTone, onViewMyBookings: () => views++, onDone: () => done++ })));
      const publicButtons = [...document.querySelectorAll('button')].filter(b => b.getAttribute('aria-label')?.startsWith('Chia sẻ qua') || /Sao chép tin/.test(b.textContent ?? ''));
      assert.ok(publicButtons.length >= 7);
      for (const button of publicButtons) await act(async () => button.click());
      const calendar = [...document.querySelectorAll('a')].find(a => a.href.includes('calendar.google.com'))!;
      assert.ok(calendar);
      assert.doesNotMatch(decodeURIComponent(calendar.href), /SECRET-|987654|987\.654/);
    }
    for (const value of exported) assert.doesNotMatch(value, /SECRET-|987654|987\.654|2030-12-31|23:42|admin\/private|bookingPayment|#bookings/);
    assert.match(document.body.textContent ?? '', /SECRET-CHECKIN/);
    await act(async () => (document.querySelector('button[title="Nhấn để sao chép mã"]') as HTMLButtonElement).click());
    assert.equal(clipboard, 'SECRET-CHECKIN');
    await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Xem danh sách lịch hẹn'))!.click());
    await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Hoàn tất'))!.click());
    assert.equal(views, 1); assert.equal(done, 1);
    assert.doesNotMatch(document.body.textContent ?? '', /Nhượng lại|chỉ cần đến đọc mã/);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
