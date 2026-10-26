import type { AdminBooking } from '../../types';

// Shared by the booking table, read-only drawer and dashboard donut.
export const bookingAppearance = {
  PENDING: { label: 'Chờ xác nhận', tone: 'amber', color: '#d97706' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'blue', color: '#2563eb' },
  COMPLETED: { label: 'Hoàn thành', tone: 'green', color: '#059669' },
  CANCELLED: { label: 'Đã hủy', tone: 'rose', color: '#e11d48' },
} as const satisfies Record<AdminBooking['status'], { label: string; tone: string; color: string }>;

export const paymentTone = {
  UNPAID: 'slate', PARTIALLY_PAID: 'amber', PAID: 'green', REFUNDED: 'violet',
} as const satisfies Record<AdminBooking['paymentStatus'], string>;

export const adminStatusGroups = {
  booking: bookingAppearance,
  payment: {
    UNPAID: { label: 'Chưa thanh toán', tone: paymentTone.UNPAID },
    PARTIALLY_PAID: { label: 'Đã đặt cọc', tone: paymentTone.PARTIALLY_PAID },
    PAID: { label: 'Đã thanh toán', tone: paymentTone.PAID },
    REFUNDED: { label: 'Đã hoàn tiền', tone: paymentTone.REFUNDED },
  },
  account: {
    ACTIVE: { label: 'Hoạt động', tone: 'green' },
    DISABLED: { label: 'Không hoạt động', tone: 'slate' },
    SUSPENDED: { label: 'Đã khóa', tone: 'rose' },
  },
  role: {
    CUSTOMER: { label: 'Khách hàng', tone: 'blue' },
    SUPPLIER: { label: 'Đối tác', tone: 'violet' },
    ADMIN: { label: 'Quản trị viên', tone: 'pink' },
    STAFF: { label: 'Nhân viên', tone: 'teal' },
  },
  approval: {
    PENDING: { label: 'Chờ duyệt', tone: 'amber' },
    VERIFIED: { label: 'Đã duyệt', tone: 'green' },
    REJECTED: { label: 'Bị từ chối', tone: 'rose' },
    SUSPENDED: { label: 'Tạm đình chỉ', tone: 'rose' },
  },
  report: {
    OPEN: { label: 'Mới', tone: 'amber' },
    IN_REVIEW: { label: 'Đang xử lý', tone: 'blue' },
    RESOLVED: { label: 'Đã giải quyết', tone: 'green' },
    REJECTED: { label: 'Từ chối', tone: 'rose' },
  },
  transaction: { PENDING: { label: 'Chờ thanh toán', tone: 'amber' }, PAID: { label: 'Đã thanh toán', tone: 'green' }, CANCELLED: { label: 'Đã hủy', tone: 'rose' }, EXPIRED: { label: 'Hết hạn', tone: 'slate' }, FAILED: { label: 'Thất bại', tone: 'rose' }, REVIEW_REQUIRED: { label: 'Cần đối soát', tone: 'rose' } },
  paymentReview: { REVIEW_REQUIRED: { label: 'Cần đối soát', tone: 'rose' } },
} as const;

export function adminStatusPresentation(kind: keyof typeof adminStatusGroups, value: string | null | undefined): { label: string; tone: string } {
  const group: Record<string, { label: string; tone: string }> = adminStatusGroups[kind];
  return value && Object.hasOwn(group, value) ? group[value] : { label: 'Không xác định', tone: 'slate' };
}
