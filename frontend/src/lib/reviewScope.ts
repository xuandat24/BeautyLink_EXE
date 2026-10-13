import type { BackendService } from '../types';

export type ReviewScope = { targetType: 'SERVICE' | 'SUPPLIER'; id: number };
export const validDatabaseId = (id?: number): id is number => Number.isSafeInteger(id) && (id ?? 0) > 0;

export function exploreReviewScope(item?: { type: 'deal' | 'salon' | 'partner'; serviceId?: number; supplierId?: number } | null): ReviewScope | null {
  if (!item) return null;
  const id = item.type === 'deal' ? item.serviceId : item.supplierId;
  return validDatabaseId(id) ? { targetType: item.type === 'deal' ? 'SERVICE' : 'SUPPLIER', id } : null;
}

// Old API responses fail closed: missing counts must not turn legacy ratings into verified reviews.
export function serviceReviewSummary(service: BackendService) {
  const count = service.serviceReviewCount ?? 0;
  return { rating: count > 0 ? service.rating : 0, reviewsCount: count };
}
export function supplierReviewSummary(service: BackendService) {
  const count = service.supplierReviewCount ?? 0;
  return { rating: count > 0 ? (service.supplierRating ?? 0) : 0, reviewsCount: count };
}
