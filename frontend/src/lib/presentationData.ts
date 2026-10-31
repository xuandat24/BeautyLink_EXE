import type { BackendService } from '../types';
import { displayAccount, type DisplayMetadata } from './adminDisplayProfiles';

// Classroom presentation values only; never written to accounts, reviews or bookings.
export const presentationEnabled = import.meta.env?.VITE_PRESENTATION_DATA === 'true';
export const presentationReport = { users: 286, partners: 14, bookings: 147, customers: 78, completed: 147, commission: 1_906_000 };

function sampleRating(id: number) { return (46 + id % 4) / 10; }

export type PresentationReviewAllocation = { services: Map<number, number>; suppliers: Map<number, number> };

// One review budget is shared by the entire public catalog and its supplier summaries.
export function presentationReviewAllocation(catalog: BackendService[]): PresentationReviewAllocation {
  const offerings = [...new Map(catalog.map(service => [service.id, service])).values()];
  const services = new Map<number, number>();
  let remaining = presentationReport.bookings;
  for (const service of offerings) {
    const verified = Math.max(0, service.serviceReviewCount ?? 0);
    services.set(service.id, verified);
    remaining = Math.max(0, remaining - verified);
  }
  const booked = offerings.filter(service => (service.bookedOrCompletedCount ?? 0) > 0 && !services.get(service.id))
    .sort((a, b) => (b.bookedOrCompletedCount ?? 0) - (a.bookedOrCompletedCount ?? 0) || a.id - b.id);
  for (const service of booked) {
    const count = Math.min(remaining, service.bookedOrCompletedCount ?? 0);
    services.set(service.id, count);
    remaining -= count;
  }
  for (const service of offerings) {
    if (remaining === 0) break;
    if (services.get(service.id) || (service.bookedOrCompletedCount ?? 0) > 0) continue;
    const count = Math.min(remaining, 1 + service.id % 2);
    services.set(service.id, count);
    remaining -= count;
  }
  const suppliers = new Map<number, number>();
  for (const service of offerings) suppliers.set(service.supplierId,
    (suppliers.get(service.supplierId) ?? 0) + (services.get(service.id) ?? 0));
  return { services, suppliers };
}

export function presentationService(service: BackendService, allocation?: PresentationReviewAllocation | null, enabled = presentationEnabled): BackendService {
  const hasDemoPractitioner = service.practitioners?.some(person => /^\s*DEMO\s*[-–—:]\s*/i.test(person.specialty ?? '') || /^\s*DEMO BeautyLink(?:\s*\[[^\]]*\])?\s*$/i.test(person.bio ?? ''));
  const publicService = hasDemoPractitioner ? {
    ...service,
    practitioners: service.practitioners?.map(person => ({
      ...person,
      specialty: person.specialty?.replace(/^\s*DEMO\s*[-–—:]\s*/i, '').trim(),
      bio: /^\s*DEMO BeautyLink(?:\s*\[[^\]]*\])?\s*$/i.test(person.bio ?? '') ? undefined : person.bio,
    })),
  } : service;
  if (!enabled) return publicService;
  const result = { ...publicService };
  if (!((service.serviceReviewCount ?? 0) > 0) && Number.isSafeInteger(service.id) && service.id > 0) {
    const count = allocation?.services.get(service.id) ?? 0;
    result.rating = count > 0 ? sampleRating(service.id) : 0;
    result.serviceReviewCount = count;
  }
  if (!(service.supplierReviewCount > 0) && Number.isSafeInteger(service.supplierId) && service.supplierId > 0) {
    const count = allocation?.suppliers.get(service.supplierId) ?? 0;
    result.supplierRating = count > 0 ? sampleRating(service.supplierId) : 0;
    result.supplierReviewCount = count;
  }
  return result;
}

// Compatibility helpers never invent an address. A persisted ID mapping is mandatory.
export function presentationEmail(email: string | null, enabled = presentationEnabled, accountId?: number, metadata: DisplayMetadata = {}): string | null {
  return enabled && accountId !== undefined ? metadata.displayProfiles?.find(profile => profile.id === accountId)?.email ?? email : email;
}
export function presentationAccount<T extends { id: number; fullName: string; email: string | null }>(account: T, metadata: DisplayMetadata = {}): T {
  return displayAccount(account, metadata);
}
