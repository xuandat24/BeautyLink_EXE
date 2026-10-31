import type { AdminInsights, Metric } from '../src/types/adminV2';
import type { AdminPaymentSummary } from '../src/types';
export const metricFixture = (value = 0, unit: Metric['unit'] = 'BOOKING'): Metric => ({ value, previous: 0, changePercent: null, basis: 'Test metric from backend', currentValue: value, previousValue: 0, absoluteChange: value, relativeChangePercent: null, percentagePointChange: null, comparisonStatus: value ? 'NEW_ACTIVITY' : 'UNCHANGED', unit, metricDefinition: 'Test metric from backend', currentNumerator: null, currentDenominator: null, previousNumerator: null, previousDenominator: null, lowSample: false });
const metric = metricFixture;
export const insightsFixture = (): AdminInsights => ({
  range: { fromDate: '2026-10-01', toDate: '2026-10-15', timezone: 'Asia/Ho_Chi_Minh', includeDemo: false }, granularity: 'DAY',
  currentPeriod: { startInclusive: '2026-09-30T17:00:00Z', endExclusive: '2026-10-15T17:00:00Z' }, previousPeriod: { startInclusive: '2026-09-15T17:00:00Z', endExclusive: '2026-09-30T17:00:00Z' }, timezone: 'Asia/Ho_Chi_Minh', asOf: '2026-10-31T08:00:00Z', lowBaseThreshold: 4, smallRateDenominator: 20,
  totalBookings: metric(5), users: metric(9, 'ACCOUNT'), revenue: metric(30000, 'VND'), activePartners: metric(2, 'PARTNER'), onlinePaymentRate: { ...metric(20, 'PERCENT'), comparisonStatus: 'NO_DENOMINATOR', previousValue: null, currentNumerator: 1, currentDenominator: 5, previousNumerator: 0, previousDenominator: 0 }, completedBookings: metric(1), bookingCustomers: 2,
  paymentAttempts: 3, successfulAttempts: 1, paymentAttemptSuccessRate: 33.3,
  trends: [{ date: '2026-10-01', bookings: 5, verifiedOnlineAmount: 30000 }],
  statuses: [{ status: 'PENDING', count: 1 }, { status: 'CONFIRMED', count: 2 }, { status: 'COMPLETED', count: 1 }, { status: 'CANCELLED', count: 1 }],
  topSalons: [], popularServices: [],
});
export const paymentFixture = (): AdminPaymentSummary => ({ range: insightsFixture().range, verifiedOnlineCollected: 30000, verifiedDeposits: 30000, verifiedFullPayments: 0, remainingAtSalon: 570000, verifiedPaymentBookings: 2, depositBookings: 2, fullPaymentBookings: 0, reconciliationIssues: 0, generatedAt: '2026-10-19T00:00:00Z' });
