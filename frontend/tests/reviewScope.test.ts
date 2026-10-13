import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exploreReviewScope, serviceReviewSummary, supplierReviewSummary } from '../src/lib/reviewScope.ts';
import type { BackendService } from '../src/types/beauty.ts';

test('service and supplier aggregates remain separate', () => {
  const service = { rating: 3, serviceReviewCount: 2, supplierRating: 5, supplierReviewCount: 105 } as BackendService;
  assert.deepEqual(serviceReviewSummary(service), { rating: 3, reviewsCount: 2 });
  assert.deepEqual(supplierReviewSummary(service), { rating: 5, reviewsCount: 105 });
});
test('zero and missing counts never become sample review numbers', () => {
  const service = { rating: 4.9, supplierReviewCount: 0 } as BackendService;
  assert.deepEqual(serviceReviewSummary(service), { rating: 0, reviewsCount: 0 });
  assert.deepEqual(supplierReviewSummary(service), { rating: 0, reviewsCount: 0 });
});
test('Explore scopes use database IDs, never display IDs or names', () => {
  assert.deepEqual(exploreReviewScope({ type: 'deal', serviceId: 12, supplierId: 42 }), { targetType: 'SERVICE', id: 12 });
  for (const type of ['salon', 'partner'] as const) assert.deepEqual(exploreReviewScope({ type, serviceId: 12, supplierId: 42 }), { targetType: 'SUPPLIER', id: 42 });
});
test('missing or malformed scope fails closed instead of switching targets', () => {
  for (const serviceId of [undefined, 0, -1, NaN, Infinity, 1.5]) assert.equal(exploreReviewScope({ type: 'deal', serviceId, supplierId: 42 }), null);
  assert.equal(exploreReviewScope({ type: 'partner', serviceId: 12 }), null);
  assert.equal(exploreReviewScope(null), null);
});
