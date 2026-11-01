import type { AdminBooking } from '../types';
import { adminStatusPresentation } from '../components/admin/adminStatus';
import { csvRowsBlob } from './presentationAdminData';

// The export mirrors the visible booking table, including its action label (not an executable link).
export const BOOKING_TABLE_COLUMNS = ['Mã lịch', 'Khách hàng', 'Salon', 'Dịch vụ', 'Chuyên viên', 'Lịch hẹn', 'Trạng thái lịch', 'Thanh toán', 'Thu online xác minh', 'Thao tác'];
export const bookingAppointment = (booking: AdminBooking) => `${booking.appointmentDate} · ${booking.startTime.slice(0, 5)}`;
export const bookingOnlineAmount = (amount: number | null | undefined) => amount == null ? '—' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);

export function bookingRowsCsv(bookings: readonly AdminBooking[]): Blob {
  if (new Set(bookings.map(row => row.id)).size !== bookings.length) throw new Error('Danh sách lịch có dòng trùng; đã hủy xuất.');
  if (bookings.some(row => !Number.isSafeInteger(row.id) || !row.bookingCode || typeof row.customerName !== 'string' || typeof row.supplierName !== 'string' || typeof row.serviceName !== 'string' || !row.appointmentDate || !row.startTime || (row.verifiedOnlineAmount != null && !Number.isFinite(row.verifiedOnlineAmount)))) throw new Error('Dữ liệu lịch đặt không đầy đủ; đã hủy xuất.');
  return csvRowsBlob([BOOKING_TABLE_COLUMNS, ...bookings.map(row => [
    row.bookingCode, row.customerName, row.supplierName, row.serviceName, row.practitionerName || '—', bookingAppointment(row),
    adminStatusPresentation('booking', row.status).label,
    [adminStatusPresentation('payment', row.paymentStatus).label, ...(row.paymentReviewRequired ? [adminStatusPresentation('paymentReview', 'REVIEW_REQUIRED').label] : [])].join(' · '),
    bookingOnlineAmount(row.verifiedOnlineAmount), 'Xem chi tiết',
  ])]);
}
