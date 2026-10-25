import type { AdminBooking } from '../../types';

// Shared by the booking table, read-only drawer and dashboard donut.
export const bookingAppearance = {
  PENDING: { tone: 'amber', color: '#d97706' },
  CONFIRMED: { tone: 'blue', color: '#2563eb' },
  COMPLETED: { tone: 'green', color: '#059669' },
  CANCELLED: { tone: 'rose', color: '#e11d48' },
} as const satisfies Record<AdminBooking['status'], { tone: string; color: string }>;

export const paymentTone = {
  UNPAID: 'slate', PARTIALLY_PAID: 'amber', PAID: 'green', REFUNDED: 'violet',
} as const satisfies Record<AdminBooking['paymentStatus'], string>;
