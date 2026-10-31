import type { ReportingPaymentRow } from '../types/adminV2';

export function reportingPaymentCsv(rows: ReportingPaymentRow[]) {
  const cell = (value: string | number | null) => {
    let safe = String(value ?? ''); if (/^\s*[=+\-@]/.test(safe) || /^[\t\r\n]/.test(safe)) safe = `'${safe}`;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const lines = [['payment_id', 'source', 'batch_id', 'booking_id', 'booking_code', 'customer', 'salon', 'service', 'practitioner', 'appointment_date_vietnam', 'start_time_vietnam', 'end_time_vietnam', 'booking_status', 'paid_at_utc', 'service_value_vnd', 'payment_option', 'amount_vnd', 'remaining_at_salon_vnd'],
    ...rows.map(r => [r.id, r.source, r.batchId, r.bookingId, r.bookingCode, r.customerName, r.supplierName, r.serviceName, r.practitionerName, r.appointmentDate, r.startTime, r.endTime, r.bookingStatus, r.paidAt, r.serviceValue, r.paymentOption, r.amount, r.remainingAmount])];
  return new Blob(['\uFEFF', lines.map(row => row.map(cell).join(',')).join('\r\n'), '\r\n'], { type: 'text/csv;charset=utf-8' });
}
