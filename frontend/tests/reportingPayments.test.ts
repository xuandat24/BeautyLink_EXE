import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { ReportingPaymentPanel } from '../src/components/admin/ReportingPaymentPanel';
import { adminV2Api } from '../src/services/adminApi';
import { beautyApi } from '../src/services/beautyApi';
import { reportingPaymentCsv } from '../src/lib/reportingPaymentCsv';
import { isPresentationBooking } from '../src/lib/presentationAdminData';
import type { ReportingPaymentRow, ReportingPaymentSummary } from '../src/types/adminV2';
import type { AdminBooking } from '../src/types';
import { AdminOverview } from '../src/components/admin/AdminOverview';
import { insightsFixture, metricFixture, paymentFixture } from './adminV2Fixtures';
import { roundedReportMoney } from '../src/lib/adminComparison';

const row: ReportingPaymentRow = { id: 'report:1', batchId: 'batch', source: 'SIMULATED', bookingId: 9100000000, bookingCode: 'BL2610R0001', customerId: 7, customerName: 'Khách', supplierId: 3, supplierName: 'Salon', serviceId: 9, serviceName: 'Dịch vụ', practitionerId: 8, practitionerName: 'Chuyên viên', appointmentDate: '2026-10-20', startTime: '10:00:00', endTime: '11:00:00', bookingStatus: 'COMPLETED', bookingCreatedAt: '2026-10-19T02:00:00Z', serviceValue: 300000, paymentOption: 'DEPOSIT_05', amount: 15000, remainingAmount: 285000, paidAt: '2026-10-19T02:05:00Z' };
const summary = (): ReportingPaymentSummary => ({ total: 15000, deposits: 15000, fullPayments: 0, verifiedAmount: 0, simulatedAmount: 15000, remainingAtSalon: 285000, transactions: 1, uniqueBookings: 1, asOf: '2026-10-31T08:00:00Z', rows: { content: [row], totalElements: 1, totalPages: 1, page: 0, size: 20 } });
const booking = (): AdminBooking => ({ id: row.bookingId, batchId: 'batch', bookingCode: row.bookingCode, customerId: 7, customerName: 'Khách', customerPhone: '', supplierId: 3, supplierName: 'Salon', serviceName: 'Dịch vụ', practitionerName: row.practitionerName, appointmentDate: row.appointmentDate, startTime: row.startTime, endTime: row.endTime, status: 'COMPLETED', paymentStatus: 'PARTIALLY_PAID', totalAmount: row.serviceValue, createdAt: row.bookingCreatedAt, verifiedOnlineAmount: null, verifiedPaidAt: null, verifiedPaymentOption: null, paymentReviewRequired: false, remainingAtSalon: row.remainingAmount, simulatedOnlineAmount: row.amount, simulatedPaidAt: row.paidAt });
function environment() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/#admin-payments' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  return { dom, root: createRoot(document.getElementById('root')!) };
}
test('report booking IDs are read-only presentation IDs, not operational payment IDs', () => {
  assert.equal(isPresentationBooking(9100000143), true); assert.equal(isPresentationBooking(95), false); assert.equal(isPresentationBooking(10000000000), false);
});

test('report money rounds visibly without replacing precise receipts or ignoring changed filters', () => {
  assert.match(roundedReportMoney(3045208), /^≈ 3\.045\.000/);
  assert.match(roundedReportMoney(1829750), /^≈ 1\.830\.000/);
  assert.match(roundedReportMoney(210000), /^210\.000/);
});

test('presentation target is 85.6 percent, measured report rate and verified funds stay separate', async () => {
  const env = environment();
  const original = { insights: adminV2Api.insights, payments: beautyApi.adminPaymentSummary, bookings: beautyApi.adminBookings };
  const data = insightsFixture();
  data.reportPayments = metricFixture(3045208, 'VND');
  data.reportOnlinePaymentRate = { ...metricFixture(49.58677686, 'PERCENT'), currentNumerator: 180, currentDenominator: 363 };
  data.onlinePaymentRate = metricFixture(9.91735537, 'PERCENT');
  data.revenue = metricFixture(1215458, 'VND');
  data.completedServiceValue = metricFixture(39640000, 'VND');
  adminV2Api.insights = async () => data; beautyApi.adminPaymentSummary = async () => paymentFixture();
  beautyApi.adminBookings = async () => ({ content: [], totalElements: 0, totalPages: 0, page: 0, size: 5 });
  const render = (from: string) => act(async () => env.root.render(React.createElement(AdminOverview, { params: { from, to: '2026-10-31', includeDemo: false }, renderBookings: () => null, onSalon() {}, onBookedCustomers() {} })));
  try {
    await render('2026-10-01');
    const card = (label: string) => [...document.querySelectorAll('article')].find(el => el.querySelector('h2')?.textContent === label)!;
    assert.equal(card('Tỷ lệ thanh toán online').querySelector('[data-admin-value]')!.textContent, '85,6%');
    assert.match(card('Tỷ lệ thanh toán online').textContent!, /Mục tiêu báo cáo/);
    assert.match(card('Tỷ lệ thanh toán online').querySelector('details')!.textContent!, /không phải tỷ lệ đo được.*180 \/ 363/);
    assert.match(card('Tổng thanh toán báo cáo').querySelector('[data-admin-value]')!.textContent!, /^≈ 3\.045\.000/);
    assert.match(card('Tổng thanh toán báo cáo').querySelector('details')!.textContent!, /3\.045\.208/);
    const payos = [...document.querySelectorAll('details')].find(el => el.querySelector('summary')?.textContent === 'Đối soát PayOS xác minh')!;
    assert.equal(payos.hasAttribute('open'), false); assert.match(payos.textContent!, /1\.215\.458/);
    assert.match(document.body.textContent!, /Giá niêm yết của dịch vụ, không phải doanh thu online/);
    data.reportPayments = metricFixture(210000, 'VND'); await render('2026-10-25');
    assert.match(card('Tổng thanh toán báo cáo').querySelector('[data-admin-value]')!.textContent!, /^210\.000/);
  } finally {
    adminV2Api.insights = original.insights; beautyApi.adminPaymentSummary = original.payments; beautyApi.adminBookings = original.bookings;
    await act(async () => env.root.unmount()); env.dom.window.close();
  }
});
test('report CSV is a separate explicit source export and retains booking calendar fields safely', async () => {
  const text = await reportingPaymentCsv([{ ...row, customerName: '=formula' }]).text();
  assert.match(text, /"source","batch_id","booking_id"/); assert.match(text, /SIMULATED/); assert.match(text, /2026-10-20/); assert.match(text, /10:00:00/); assert.match(text, /'\=formula/); assert.match(text, /15000/);assert.match(text,/285000/);
});
test('payment row opens the same booking and shows simulated deposit without claiming PayOS verification', async () => {
  const env = environment(); const original = { report: adminV2Api.reportPayments, booking: beautyApi.adminBooking };
  adminV2Api.reportPayments = async params => { assert.equal(params.salonId, 3); return summary(); };
  beautyApi.adminBooking = async id => { assert.equal(id, row.bookingId); return booking(); };
  try {
    await act(async () => env.root.render(React.createElement(ReportingPaymentPanel, { salonId: 3, range: { from: '2026-10-01', to: '2026-10-31', includeDemo: false } })));
    assert.match(document.body.textContent ?? '', /BL2610R0001/);assert.match(document.body.textContent ?? '', /2026-10-20/);
    await act(async () => [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Xem lịch')!.click());
    const dialog = document.querySelector('[role="dialog"]')!; assert.match(dialog.textContent ?? '', /10:00–11:00/); assert.match(dialog.textContent ?? '', /không phải biên nhận PayOS đã xác minh/);
    assert.match(dialog.textContent ?? '', /Đã thu online xác minhChưa có/);
  } finally { adminV2Api.reportPayments = original.report; beautyApi.adminBooking = original.booking; await act(async () => env.root.unmount());env.dom.window.close(); }
});
test('calendar drift is blocked and date changes query a new report instead of retaining a fixed target', async () => {
  const env = environment(); const original = { report: adminV2Api.reportPayments, booking: beautyApi.adminBooking };const calls: string[] = [];
  adminV2Api.reportPayments = async params => { calls.push(params.from); return summary(); };
  beautyApi.adminBooking = async () => ({ ...booking(), startTime: '12:00:00' });
  const render = (from: string) => act(async () => env.root.render(React.createElement(ReportingPaymentPanel, { range: { from, to: '2026-10-31', includeDemo: false } })));
  try {
    await render('2026-10-01');await act(async () => [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Xem lịch')!.click());
    assert.equal(document.querySelector('[role="dialog"]'), null);assert.match(document.body.textContent ?? '', /Dữ liệu lịch vừa thay đổi/);
    await render('2026-10-02');assert.deepEqual(calls, ['2026-10-01', '2026-10-02']);
  } finally { adminV2Api.reportPayments = original.report; beautyApi.adminBooking = original.booking;await act(async () => env.root.unmount());env.dom.window.close(); }
});
