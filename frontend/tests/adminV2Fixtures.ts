import type { AdminInsights } from '../src/types/adminV2';
import type { AdminPaymentSummary } from '../src/types';
const metric = (value = 0) => ({ value, previous: 0, changePercent: null, basis: 'Test metric from backend' });
export const insightsFixture = (): AdminInsights => ({
  range: { fromDate: '2026-10-01', toDate: '2026-10-15', timezone: 'Asia/Ho_Chi_Minh', includeDemo: false }, granularity: 'DAY',
  totalBookings: metric(5), users: metric(9), revenue: metric(30000), activePartners: metric(2), onlinePaymentRate: metric(20), completedBookings: metric(1), bookingCustomers: 2,
  paymentAttempts: 3, successfulAttempts: 1, paymentAttemptSuccessRate: 33.3,
  trends: [{ date: '2026-10-01', bookings: 5, verifiedOnlineAmount: 30000 }],
  statuses: [{ status: 'PENDING', count: 1 }, { status: 'CONFIRMED', count: 2 }, { status: 'COMPLETED', count: 1 }, { status: 'CANCELLED', count: 1 }],
  topSalons: [], popularServices: [],
});
export const paymentFixture = (): AdminPaymentSummary => ({ range: insightsFixture().range, verifiedOnlineCollected: 30000, verifiedDeposits: 30000, verifiedFullPayments: 0, remainingAtSalon: 570000, verifiedPaymentBookings: 2, depositBookings: 2, fullPaymentBookings: 0, reconciliationIssues: 0, generatedAt: '2026-10-19T00:00:00Z' });
