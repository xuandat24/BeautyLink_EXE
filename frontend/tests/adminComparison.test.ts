import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { comparisonText, comparisonFormula, periodText } from '../src/lib/adminComparison';
import { AdminOverview } from '../src/components/admin/AdminOverview';
import { adminV2Api } from '../src/services/adminApi';
import { apiClient, beautyApi } from '../src/services/beautyApi';
import { insightsFixture, metricFixture, paymentFixture } from './adminV2Fixtures';
import type { Metric } from '../src/types/adminV2';

// Explicit API fixtures; formula calculation is tested in the backend, never duplicated in UI code.
const lowBase: Metric = { ...metricFixture(76), previousValue: 1, absoluteChange: 75, relativeChangePercent: 7500, comparisonStatus: 'LOW_BASE' };
test('low base shows absolute change, with uncapped 7500% available in the formula', () => {
  assert.equal(comparisonText(lowBase), '↑ Tăng 75 đơn');
  assert.equal(comparisonFormula(lowBase), '+7.500% = (76 − 1) / 1 × 100');
});
test('standard, zero, negative and insufficient comparisons remain distinguishable', () => {
  const cases: Array<[Partial<Metric>, string]> = [
    [{ currentValue: 120, previousValue: 100, absoluteChange: 20, relativeChangePercent: 20, comparisonStatus: 'COMPARABLE' }, '↑ Tăng 20%'],
    [{ currentValue: 80, previousValue: 100, absoluteChange: -20, relativeChangePercent: -20, comparisonStatus: 'COMPARABLE' }, '↓ Giảm 20%'],
    [{ currentValue: 0, previousValue: 10, absoluteChange: -10, relativeChangePercent: -100, comparisonStatus: 'COMPARABLE' }, '↓ Giảm 100%'],
    [{ currentValue: 10, previousValue: 0, absoluteChange: 10, comparisonStatus: 'NEW_ACTIVITY' }, 'Phát sinh mới · +10 đơn'],
    [{ currentValue: 0, previousValue: 0, absoluteChange: 0, comparisonStatus: 'UNCHANGED' }, 'Không thay đổi'],
    [{ currentValue: null, previousValue: null, comparisonStatus: 'INSUFFICIENT_HISTORY' }, 'Chưa đủ dữ liệu lịch sử'],
    [{ currentValue: 0, previousValue: null, comparisonStatus: 'CURRENT_SNAPSHOT' }, 'Số liệu hiện tại · không có lịch sử'],
  ];
  for (const [fields, expected] of cases) assert.equal(comparisonText({ ...metricFixture(), ...fields }), expected);
  const negative = { ...metricFixture(-1000, 'VND'), previousValue: -2000, absoluteChange: 1000, comparisonStatus: 'NEGATIVE_VALUE' as const };
  assert.match(comparisonText(negative), /có giá trị âm/); assert.match(comparisonFormula(negative), /không chia/);
});
test('rates show percentage points and zero denominator is not 0 percent', () => {
  const rate: Metric = { ...metricFixture(47.4, 'PERCENT'), currentNumerator: 237, currentDenominator: 500, previousNumerator: 2, previousDenominator: 5, previousValue: 40, absoluteChange: 7.4, percentagePointChange: 7.4, relativeChangePercent: null, comparisonStatus: 'COMPARABLE', lowSample: true };
  assert.equal(comparisonText(rate), '↑ Tăng 7,4 điểm %');
  assert.match(comparisonFormula(rate), /237 \/ 500 × 100/);
  assert.equal(comparisonText({ ...rate, currentValue: null, currentNumerator: 0, currentDenominator: 0, comparisonStatus: 'NO_DENOMINATOR' }), 'Chưa có cơ sở so sánh tỷ lệ');
  assert.match(periodText({ startInclusive: '2026-10-30T17:00:00Z', endExclusive: '2026-10-31T08:00:00Z' }, 'Asia/Ho_Chi_Minh'), /00:00 31\/10\/26.*15:00 31\/10\/26/);
});
test('insights API never merges or recalculates presentation records on the client', async () => {
  const dom = new JSDOM('', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, localStorage: dom.window.localStorage });
  const original = apiClient.get, calls: string[] = [], response = insightsFixture();
  apiClient.get = (async (url: string) => { calls.push(url); return { data: response }; }) as typeof apiClient.get;
  try {
    assert.equal(await adminV2Api.insights({ from: '2026-10-01', to: '2026-10-15', includeDemo: false, granularity: 'DAY' }), response);
    assert.deepEqual(calls, ['/v1/admin/dashboard/insights']);
    apiClient.get = (async () => ({ data: { totalBookings: { value: 76, changePercent: 7500 } } })) as typeof apiClient.get;
    await assert.rejects(adminV2Api.insights({ from: '2026-10-01', to: '2026-10-15', includeDemo: false, granularity: 'DAY' }), /chưa hỗ trợ so sánh kỳ trước/);
  } finally { apiClient.get = original; dom.window.close(); }
});
test('cards expose prior values, low sample counts, missing history and shared cutoff without success-color inference', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/#admin-dashboard' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const root = createRoot(document.getElementById('root')!);
  const original = { insights: adminV2Api.insights, payments: beautyApi.adminPaymentSummary, bookings: beautyApi.adminBookings };
  const data = insightsFixture(); data.totalBookings = lowBase;
  data.onlinePaymentRate = { ...metricFixture(47.4, 'PERCENT'), previousValue: 40, currentNumerator: 237, currentDenominator: 500, previousNumerator: 2, previousDenominator: 5, percentagePointChange: 7.4, absoluteChange: 7.4, comparisonStatus: 'COMPARABLE', lowSample: true };
  data.completedBookings = { ...metricFixture(), currentValue: null, previousValue: null, comparisonStatus: 'INSUFFICIENT_HISTORY', metricDefinition: 'Không có completedAt.' };
  adminV2Api.insights = async () => data; beautyApi.adminPaymentSummary = async () => paymentFixture();
  beautyApi.adminBookings = async () => ({ content: [], totalElements: 0, totalPages: 0, page: 0, size: 5 });
  try {
    await act(async () => root.render(React.createElement(AdminOverview, { params: { from: '2026-10-01', to: '2026-10-15', includeDemo: false }, renderBookings: () => null, onSalon() {}, onBookedCustomers() {} })));
    const articles = [...document.querySelectorAll('article')];
    assert.match(articles[0].textContent!, /↑ Tăng 75 đơn.*Kỳ trước: 1 đơn · Nền so sánh thấp/);
    assert.match(articles[0].querySelector('details')!.textContent!, /\+7\.500% = \(76 − 1\) \/ 1 × 100/);
    assert.doesNotMatch(articles[0].querySelector('.flex-1.text-xs')?.className ?? '', /emerald|rose/);
    assert.match(articles[4].textContent!, /Tăng 7,4 điểm %.*237\/500 đơn · Kỳ trước: 2\/5 đơn · Ít dữ liệu/);
    assert.equal(articles[5].querySelector('[data-admin-value]')!.textContent, '—');
    assert.match(articles[5].textContent!, /Chưa đủ dữ liệu lịch sử/);
    assert.match(document.body.textContent!, /Chốt lúc/); assert.doesNotMatch(document.body.textContent!, /Chưa có so sánh|NaN|Infinity/);
  } finally { await act(async () => root.unmount()); Object.assign(adminV2Api, { insights: original.insights }); beautyApi.adminPaymentSummary = original.payments; beautyApi.adminBookings = original.bookings; dom.window.close(); }
});
