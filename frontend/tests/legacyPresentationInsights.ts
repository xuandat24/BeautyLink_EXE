// Historical seed-fixture assertions only. Runtime dashboard aggregation is exclusively backend-owned.
import type { AdminInsights } from '../src/types/adminV2';
import type { AdminBooking } from '../src/types';
import { presentationBookings, bookingDay, type PresentationAdminData } from '../src/lib/presentationAdminData';
export function presentationInsights(data: AdminInsights, snapshot: PresentationAdminData): AdminInsights {
  const bookings = presentationBookings(snapshot, { from: data.range.fromDate, to: data.range.toDate });
  const metric = (value: number, basis: string) => ({ value, previous: null, changePercent: null, basis, currentValue: value, previousValue: null, absoluteChange: null, relativeChangePercent: null, percentagePointChange: null, comparisonStatus: 'INSUFFICIENT_HISTORY' as const, unit: 'BOOKING' as const, metricDefinition: basis, currentNumerator: null, currentDenominator: null, previousNumerator: null, previousDenominator: null, lowSample: false });
  const bucket = (day: string) => {
    if (data.granularity === 'MONTH') return [`${day.slice(0, 7)}-01`, data.range.fromDate].sort().at(-1)!;
    if (data.granularity === 'WEEK') { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7); return [date.toISOString().slice(0, 10), data.range.fromDate].sort().at(-1)!; }
    return day;
  };
  const trends = new Map<string, AdminInsights['trends'][number]>();
  for (let day = data.range.fromDate; day <= data.range.toDate;) {
    const key = bucket(day); trends.set(key, { date: key, bookings: 0, verifiedOnlineAmount: data.trends.find(point => point.date === key)?.verifiedOnlineAmount ?? 0, completedServiceValue: 0 });
    day = new Date(Date.parse(`${day}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  }
  const services = new Map<number, AdminInsights['popularServices'][number]>();
  for (const booking of bookings) {
    const point = trends.get(bucket(bookingDay(booking)))!;
    point.bookings++; if (booking.status === 'COMPLETED') point.completedServiceValue! += booking.totalAmount;
    const service = services.get(booking.serviceId) ?? { id: booking.serviceId, name: booking.serviceName, supplierName: booking.supplierName, bookings: 0, percentage: 0 };
    service.bookings++; services.set(booking.serviceId, service);
  }
  return { ...data, totalBookings: metric(bookings.length, 'Tổng lịch được tạo trong kỳ.'), users: metric(snapshot.users.length, 'Tổng tài khoản trong hệ thống.'),
    activePartners: metric(snapshot.salons.filter(salon => salon.active).length, 'Đối tác đã duyệt và đang hoạt động.'),
    completedBookings: metric(bookings.filter(booking => booking.status === 'COMPLETED').length, 'Số lịch hoàn thành trong kỳ.'),
    returningCustomers: metric(new Set(bookings.filter(booking => booking.status !== 'CANCELLED').map(booking => booking.customerId)
      .filter((id, index, ids) => ids.indexOf(id) !== index)).size, 'Số khách có từ hai lịch không hủy trong kỳ; mỗi khách chỉ tính một lần.'),
    completedServiceValue: metric(bookings.filter(booking => booking.status === 'COMPLETED').reduce((sum, booking) => sum + booking.totalAmount, 0), 'Tổng giá trị các đơn hoàn thành trong bộ báo cáo; không phải tiền online đã xác minh.'),
    bookingCustomers: new Set(bookings.map(booking => booking.customerId)).size,
    onlinePaymentRate: metric(bookings.length ? Math.round(bookings.filter(booking => (booking.verifiedOnlineAmount ?? 0) > 0).length / bookings.length * 1000) / 10 : 0, 'Tỷ lệ lịch có khoản thu online trong bộ dữ liệu báo cáo.'),
    statuses: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map(status => ({ status: status as AdminBooking['status'], count: bookings.filter(booking => booking.status === status).length })),
    trends: [...trends.values()], topSalons: snapshot.salons.map(salon => {
      const rows = bookings.filter(booking => booking.supplierId === salon.id);
      return { id: salon.id, name: salon.name, location: salon.location, bookings: rows.length, verifiedOnlineAmount: rows.reduce((sum, booking) => sum + (booking.verifiedOnlineAmount ?? 0), 0), completedServiceValue: rows.filter(booking => booking.status === 'COMPLETED').reduce((sum, booking) => sum + booking.totalAmount, 0) };
    }).sort((a, b) => b.bookings - a.bookings),
    popularServices: [...services.values()].map(service => ({ ...service, percentage: bookings.length ? Math.round(service.bookings / bookings.length * 1000) / 10 : 0 })).sort((a, b) => b.bookings - a.bookings) };
}
