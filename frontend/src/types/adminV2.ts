import type { AdminBooking, AdminDateRange } from '../types';
export type ComparisonStatus = 'COMPARABLE' | 'LOW_BASE' | 'NEW_ACTIVITY' | 'UNCHANGED' | 'NO_DENOMINATOR' | 'INSUFFICIENT_HISTORY' | 'CURRENT_SNAPSHOT' | 'NEGATIVE_VALUE';
export type Metric = {
  currentValue: number | null; previousValue: number | null; absoluteChange: number | null;
  relativeChangePercent: number | null; percentagePointChange: number | null;
  comparisonStatus: ComparisonStatus; unit: 'BOOKING' | 'ACCOUNT' | 'PARTNER' | 'CUSTOMER' | 'VND' | 'PERCENT';
  metricDefinition: string; currentNumerator: number | null; currentDenominator: number | null;
  previousNumerator: number | null; previousDenominator: number | null; lowSample: boolean;
  /** Legacy aliases share the same nullable values, not a second business definition. */
  value: number | null; previous: number | null; changePercent: number | null; basis: string;
};
export type ReportingPeriod = { startInclusive: string; endExclusive: string };
export type AdminInsights = {
  range: AdminDateRange; granularity: 'DAY' | 'WEEK' | 'MONTH';
  currentPeriod: ReportingPeriod; previousPeriod: ReportingPeriod; timezone: string; asOf: string;
  lowBaseThreshold: number; smallRateDenominator: number;
  totalBookings: Metric; users: Metric; revenue: Metric; activePartners: Metric; onlinePaymentRate: Metric; completedBookings: Metric;
  commissionRevenue?: Metric;
  completedServiceValue?: Metric;
  reportPayments?: Metric;
  reportActivePartners?: Metric | null;
  reportOnlinePaymentRate?: Metric;
  completedBookingSnapshot?: Metric;
  returningCustomers?: Metric;
  bookingCustomers: number; paymentAttempts: number; successfulAttempts: number; paymentAttemptSuccessRate: number | null;
  trends: Array<{ date: string; bookings: number; verifiedOnlineAmount: number; reportPaymentAmount?: number; commissionAmount?: number; completedServiceValue?: number }>;
  statuses: Array<{ status: AdminBooking['status']; count: number }>;
  topSalons: Array<{ id: number; name: string; location: string | null; bookings: number; verifiedOnlineAmount: number; reportPaymentAmount?: number; commissionAmount?: number; completedServiceValue?: number }>;
  popularServices: Array<{ id: number; name: string; supplierName: string; bookings: number; percentage: number }>;
};
export type AdminUserRow = { id: number; fullName: string; email: string | null; role: 'CUSTOMER' | 'SUPPLIER' | 'STAFF' | 'ADMIN'; status: string; createdAt: string };
export type AdminSalonRow = { id: number; name: string; ownerName: string; ownerEmail: string; businessType: string; location: string | null; address: string; approvalStatus: string; active: boolean; serviceCount: number; practitionerCount: number; bookingCount: number };
export type AdminSalonDetail = { salon: AdminSalonRow; services: Array<{ id: number; name: string; price: number; durationMinutes: number; active: boolean }>; practitioners: Array<{ id: number; name: string; specialty: string | null; active: boolean }>; schedules: Array<{ practitionerId: number; day: string; start: string; end: string; breakStart: string | null; breakEnd: string | null; active: boolean }>; recentBookings: AdminBooking[] };
export type AdminReviewRow = { id: number; targetType: string; supplierName: string; serviceName: string; rating: number; comment: string | null; createdAt: string };
export type AdminAccountDetail = AdminUserRow & { phone: string | null; gender: 'MALE' | 'FEMALE' | 'OTHER' | null; dateOfBirth: string | null; updatedAt: string; salons: Array<{ id: number; name: string; approvalStatus: string }> };
export type AdminProfilePatch = { fullName: string; gender: 'MALE' | 'FEMALE' | 'OTHER' | null; dateOfBirth: string | null; expectedUpdatedAt: string; email?: string; phone?: string; confirmContactChange?: boolean };
export type AdminServiceDetail = { id: number; name: string; category: string; price: number; durationMinutes: number; active: boolean };
export type AdminPaymentRow = { id: number; orderCode: number; bookingId: number; bookingCode: string; supplierName: string; paymentOption: string; status: string; amount: number; remainingAmount: number; createdAt: string; paidAt: string | null; requiresManualReview: boolean; canonicalVerified: boolean; bookingPaymentStatus: string };
export type AdminPaymentLedger = { verifiedOnlineAmount: number; deposits: number; fullPayments: number; remainingAtSalon: number; attempts: number; reviewRequiredAttempts: number; failedAttempts: number; rows: import('../types').AdminPage<AdminPaymentRow> };
export type ReportingPaymentRow = { id: string; source: 'VERIFIED' | 'SIMULATED'; batchId: string | null; bookingId: number; bookingCode: string; customerId: number; customerName: string; supplierId: number; supplierName: string; serviceId: number; serviceName: string; practitionerId: number; practitionerName: string; appointmentDate: string; startTime: string; endTime: string; bookingStatus: AdminBooking['status']; bookingCreatedAt: string; serviceValue: number; paymentOption: string; amount: number; remainingAmount: number; paidAt: string };
export type ReportingPaymentSummary = { total: number; deposits: number; fullPayments: number; verifiedAmount: number; simulatedAmount: number; remainingAtSalon: number; transactions: number; uniqueBookings: number; asOf: string; rows: import('../types').AdminPage<ReportingPaymentRow> };

export type EditSnapshot<T> = { data: T; revision: string };
export type PartnerProfileEdit = { id?: number; name: string; businessType: string; description: string | null; addressLine: string; imageUrl: string | null; locationId: number | null; latitude: number | null; longitude: number | null };
export type PartnerServiceEdit = { id?: number; categoryId: number; name: string; description: string | null; price: number; originalPrice: number | null; durationMinutes: number; imageUrl: string | null; active: boolean };
export type PartnerPersonEdit = { id?: number; displayName: string; specialty: string | null; bio: string | null; avatarUrl: string | null; active: boolean; supportedServiceIds: number[]; serviceAssignmentsRestricted: boolean };
export type PartnerScheduleEdit = { id?: number; dayOfWeek: string; startTime: string; endTime: string; breakStart: string | null; breakEnd: string | null; slotMinutes: number; active: boolean };
