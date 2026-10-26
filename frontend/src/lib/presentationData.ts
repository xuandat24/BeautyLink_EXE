import type { BackendService } from '../types';
import type { AdminInsights } from '../types/adminV2';

// Classroom presentation values only; never written to accounts, reviews or bookings.
export const presentationEnabled = import.meta.env?.VITE_PRESENTATION_DATA === 'true';

function sampleRating(id: number) {
  return { rating: (46 + id % 4) / 10, count: 17 + (id * 13) % 89 };
}

export function presentationService(service: BackendService, enabled = presentationEnabled): BackendService {
  if (!enabled) return service;
  const result = { ...service };
  if (!((service.serviceReviewCount ?? 0) > 0) && Number.isSafeInteger(service.id) && service.id > 0) {
    const sample = sampleRating(service.id);
    result.rating = sample.rating;
    result.serviceReviewCount = sample.count;
  }
  if (!(service.supplierReviewCount > 0) && Number.isSafeInteger(service.supplierId) && service.supplierId > 0) {
    const sample = sampleRating(service.supplierId);
    result.supplierRating = sample.rating;
    result.supplierReviewCount = sample.count;
  }
  return result;
}

export function presentationEmail(email: string | null, enabled = presentationEnabled): string | null {
  if (!enabled || !email || !/@seed\.beautylink\.test$/i.test(email)) return email;
  const local = email.split('@')[0];
  const name = local.split('+')[0].replace(/[._-]?\d.*$/, '').replace(/[^a-zA-Z._-]/g, '').toLowerCase() || 'minhanh';
  let hash = 0;
  for (const character of local) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const domains = ['gmail.com', 'gmail.com', 'outlook.com', 'yahoo.com'];
  return `${name}${85 + hash % 15}@${domains[hash % domains.length]}`;
}

export function presentationAccount<T extends { email: string | null }>(account: T): T {
  return { ...account, email: presentationEmail(account.email) };
}

export function presentationInsights(data: AdminInsights, enabled = presentationEnabled): AdminInsights {
  if (!enabled) return data;
  return { ...data, completedBookings: { ...data.completedBookings, value: 59, previous: null, changePercent: null } };
}
