import type { BackendService } from '../types';
import type { AdminInsights, Metric } from '../types/adminV2';

// Classroom presentation values only; never written to accounts, reviews or bookings.
export const presentationEnabled = import.meta.env?.VITE_PRESENTATION_DATA === 'true';
export const presentationReport = { bookings: 90, customers: 78, completed: 59, commission: 1_906_000 };

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
  if (!enabled) return service;
  const result = { ...service };
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

function reportMetric(value: number, basis: string): Metric {
  return { value, previous: null, changePercent: null, basis };
}

// Cumulative rounding keeps chart and table totals exact, including integer VNĐ.
function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((value, weight) => value + weight, 0);
  let cumulative = 0, allocated = 0;
  return weights.map(weight => {
    cumulative += weight;
    const target = Math.round(total * cumulative / sum);
    const value = target - allocated; allocated = target;
    return value;
  });
}

export function presentationInsights(data: AdminInsights, enabled = presentationEnabled): AdminInsights {
  if (!enabled) return data;
  const { bookings, customers, completed, commission } = presentationReport;
  const points = data.trends.length ? data.trends : [{ date: data.range.toDate, bookings: 0, verifiedOnlineAmount: 0 }];
  const weights = points.map(point => Math.max(1, point.bookings));
  const trendBookings = distribute(bookings, weights), trendCommission = distribute(commission, weights);
  const salonWeights = data.topSalons.map(salon => Math.max(1, salon.bookings));
  const salonBookings = distribute(bookings, salonWeights), salonCommission = distribute(commission, salonWeights);
  const serviceBookings = distribute(bookings, data.popularServices.map(service => Math.max(1, service.bookings)));
  return {
    ...data,
    totalBookings: reportMetric(bookings, 'Tổng số đơn đặt lịch trong báo cáo hoạt động.'),
    completedBookings: reportMetric(completed, '59 lịch đã hoàn thành trong tổng số 90 đơn đặt lịch.'),
    commissionRevenue: reportMetric(commission, 'Tổng doanh thu hoa hồng ghi nhận trong báo cáo hoạt động Beauty Link.'),
    bookingCustomers: customers,
    onlinePaymentRate: reportMetric(82.2, '74 lịch đã thanh toán online / 90 đơn đặt lịch.'),
    paymentAttempts: 82, successfulAttempts: 74, paymentAttemptSuccessRate: 90.2,
    statuses: [{ status: 'PENDING', count: 7 }, { status: 'CONFIRMED', count: 19 }, { status: 'COMPLETED', count: completed }, { status: 'CANCELLED', count: 5 }],
    trends: points.map((point, index) => ({ ...point, bookings: trendBookings[index], commissionAmount: trendCommission[index] })),
    topSalons: data.topSalons.map((salon, index) => ({ ...salon, bookings: salonBookings[index], commissionAmount: salonCommission[index] })),
    popularServices: data.popularServices.map((service, index) => ({ ...service, bookings: serviceBookings[index], percentage: Math.round(serviceBookings[index] / bookings * 1000) / 10 })),
  };
}
