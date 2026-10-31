import type { AdminBooking } from '../types';
import type { AdminSalonRow } from '../types/adminV2';
export type DisplayProfile = { id: number; source: 'REPORT' | 'SEED_CUSTOMER' | 'SEED_PARTNER' | 'CONTACT_DISPLAY'; fullName: string; email: string; reportCreatedAt?: string; original?: { createdAt?: string } };
export type DisplayMetadata = { displayProfiles?: DisplayProfile[]; returningCustomerIds?: number[]; profileVersion?: number };
const collator = new Intl.Collator('vi', { sensitivity: 'base', numeric: true });
export const cleanName = (value?: string | null) => (value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
export function compareNames(left?: string | null, right?: string | null) {
  const a = cleanName(left), b = cleanName(right);
  return !a || !b ? (!a ? (!b ? 0 : 1) : -1) : collator.compare(a, b);
}
export function alphabetic<T extends { id: number }>(rows: readonly T[], name: (row: T) => string | null | undefined): T[] {
  return [...rows].sort((a, b) => compareNames(name(a), name(b)) || a.id - b.id);
}
export function displayAccount<T extends { id: number; fullName: string; email: string | null; createdAt?: string }>(user: T, metadata: DisplayMetadata): T {
  const profile = metadata.displayProfiles?.find(p => p.id === user.id);
  return profile ? { ...user, fullName: profile.fullName, email: profile.email, ...(profile.reportCreatedAt && { createdAt: profile.reportCreatedAt, reportCreatedAt: profile.reportCreatedAt, actualCreatedAt: profile.original?.createdAt ?? user.createdAt }) } : user;
}
export function displaySalon(salon: AdminSalonRow, users: ReadonlyMap<number, { fullName: string; email: string | null }>): AdminSalonRow {
  const owner = salon.ownerUserId == null ? undefined : users.get(salon.ownerUserId);
  return owner ? { ...salon, ownerName: owner.fullName, ownerEmail: owner.email ?? salon.ownerEmail } : salon;
}
export function displayBooking<T extends AdminBooking>(booking: T, users: ReadonlyMap<number, { fullName: string }>): T {
  const customer = users.get(booking.customerId);
  return customer ? { ...booking, customerName: customer.fullName } : booking;
}
export const rowOrdinal = (page: number, size: number, index: number) => page * size + index + 1;
