import type { AdminBooking, AdminCustomer, AdminPage, BackendService } from '../types';
import type { AdminAccountDetail, AdminInsights, AdminSalonRow } from '../types/adminV2';
import { presentationReport } from './presentationData';

// Reserved IDs keep presentation records out of account edits and payment APIs.
const userBase = 8_000_000_000, bookingBase = 9_000_000_000;
export const isPresentationUser = (id: number) => Number.isSafeInteger(id) && id >= userBase && id < userBase + presentationReport.users;
export const isPresentationBooking = (id: number) => Number.isSafeInteger(id) && id >= bookingBase && id < bookingBase + presentationReport.bookings;
export type PresentationAdminData = { users: AdminAccountDetail[]; salons: AdminSalonRow[]; bookings: Array<AdminBooking & { serviceId: number; commissionAmount: number }> };
const surnames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô'];
const names = ['Minh Anh', 'Thanh Hằng', 'Ngọc Linh', 'Thu Trang', 'Hoàng Nam', 'Quốc Bảo', 'Gia Hân', 'Minh Khang', 'Khánh Vy', 'Anh Tuấn', 'Thảo Nguyên', 'Đức Minh', 'Phương Thảo', 'Trung Hiếu', 'Hải Yến', 'Quang Huy', 'Bảo Ngọc', 'Tuấn Kiệt', 'Mai Chi', 'Nhật Minh', 'Diệu Linh'];
const female = new Set([0, 1, 2, 3, 6, 8, 10, 12, 14, 16, 18, 20]);
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
export function presentationSearch(value: string, query = '') { return normalize(value).includes(normalize(query.trim())); }
export function presentationPage<T>(rows: T[], page = 0, size = 20): AdminPage<T> {
  return { content: rows.slice(page * size, (page + 1) * size), totalElements: rows.length, totalPages: Math.ceil(rows.length / size), page, size };
}

export function createPresentationAdminData(salons: AdminSalonRow[], catalog: BackendService[]): PresentationAdminData {
  const users: AdminAccountDetail[] = Array.from({ length: presentationReport.users }, (_, index) => {
    const combination = index * 137 % presentationReport.users;
    const givenIndex = Math.floor(combination / surnames.length);
    const fullName = `${surnames[combination % surnames.length]} ${names[givenIndex]}`;
    const birthYear = 1988 + combination % 17;
    const handle = normalize(fullName).split(' ').join(['.', '', '_'][index % 3]);
    const createdAt = new Date(Date.UTC(2026, 7, 1 + index % 57, 2 + index % 12, index % 60)).toISOString();
    return { id: userBase + index, fullName, email: `${handle}${index % 4 === 0 ? birthYear : ''}@${['gmail.com', 'gmail.com', 'outlook.com', 'yahoo.com'][index % 4]}`,
      role: index === presentationReport.users - 1 ? 'ADMIN' : index >= presentationReport.users - presentationReport.partners - 1 ? 'SUPPLIER' : 'CUSTOMER',
      status: 'ACTIVE', phone: `${['091', '098', '083', '077', '035', '090'][index % 6]}${String(1284571 + combination * 239).padStart(7, '0')}`,
      gender: female.has(givenIndex) ? 'FEMALE' : 'MALE', dateOfBirth: `${birthYear}-${String(1 + combination % 12).padStart(2, '0')}-${String(1 + combination % 27).padStart(2, '0')}`,
      createdAt, updatedAt: createdAt, salons: [] };
  });
  const partners = salons.slice(0, presentationReport.partners).map((salon, index) => {
    const owner = users[presentationReport.users - presentationReport.partners - 1 + index];
    owner.salons = [{ id: salon.id, name: salon.name, approvalStatus: 'VERIFIED' }];
    return { ...salon, active: true, approvalStatus: 'VERIFIED', ownerName: owner.fullName, ownerEmail: owner.email! };
  });
  const customers = users.filter(user => user.role === 'CUSTOMER').slice(0, presentationReport.customers);
  const bookings: PresentationAdminData['bookings'] = partners.length ? Array.from({ length: presentationReport.bookings }, (_, index) => {
    const salon = partners[index % partners.length], customer = customers[index * 31 % customers.length];
    const services = catalog.filter(service => service.supplierId === salon.id);
    const service = services[index % Math.max(1, services.length)];
    const day = String(2 + Math.floor(index * 26 / presentationReport.bookings)).padStart(2, '0');
    const hour = String(9 + index % 7).padStart(2, '0');
    return { id: bookingBase + index, bookingCode: `BL2610${String(201 + index).padStart(4, '0')}`, customerId: customer.id,
      customerName: customer.fullName, customerPhone: customer.phone!, supplierId: salon.id, supplierName: salon.name,
      serviceId: service?.id ?? salon.id * 1000, serviceName: service?.name ?? 'Chăm sóc và làm đẹp chuyên sâu',
      practitionerName: service?.practitioners?.[0]?.displayName ?? `Chuyên viên ${salon.name}`,
      appointmentDate: `2026-10-${day}`, startTime: `${hour}:00:00`, endTime: `${String(Number(hour) + 1).padStart(2, '0')}:00:00`,
      totalAmount: service?.price || 250000 + index % 7 * 50000, status: 'COMPLETED', paymentStatus: 'PAID',
      createdAt: `2026-10-${String(Number(day) - 1).padStart(2, '0')}T02:30:00Z`, verifiedPaymentOption: null,
      verifiedOnlineAmount: null, remainingAtSalon: null, verifiedPaidAt: null, paymentReviewRequired: false,
      commissionAmount: Math.round((index + 1) * presentationReport.commission / presentationReport.bookings) - Math.round(index * presentationReport.commission / presentationReport.bookings) };
  }) : [];
  return { users, salons: partners.map(salon => ({ ...salon, bookingCount: bookings.filter(booking => booking.supplierId === salon.id).length })), bookings };
}

export type PresentationBookingFilter = { from?: string; to?: string; status?: string; paymentStatus?: string; query?: string; customerId?: number; supplierId?: number };
export function presentationBookings(data: PresentationAdminData, filter: PresentationBookingFilter = {}) {
  return data.bookings.filter(booking => (!filter.from || booking.createdAt.slice(0, 10) >= filter.from)
    && (!filter.to || booking.createdAt.slice(0, 10) <= filter.to) && (!filter.status || booking.status === filter.status)
    && (!filter.paymentStatus || booking.paymentStatus === filter.paymentStatus)
    && (filter.customerId === undefined || booking.customerId === filter.customerId) && (filter.supplierId === undefined || booking.supplierId === filter.supplierId)
    && presentationSearch(`${booking.bookingCode} ${booking.customerName} ${booking.customerPhone} ${booking.supplierName} ${booking.serviceName}`, filter.query))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
}
export function presentationCustomers(data: PresentationAdminData, filter: { from?: string; to?: string; bookedOnly?: boolean } = {}): AdminCustomer[] {
  const bookings = presentationBookings(data, filter);
  return data.users.filter(user => user.role === 'CUSTOMER').map(user => {
    const history = bookings.filter(booking => booking.customerId === user.id);
    return { id: user.id, fullName: user.fullName, phone: user.phone!, email: user.email!, gender: user.gender, dateOfBirth: user.dateOfBirth,
      bookingsPlaced: history.length, paidBookings: history.length, completedBookings: history.length,
      totalVerifiedOnlineAmount: 0, lastBookingAt: history[0]?.createdAt ?? null };
  }).filter(customer => !filter.bookedOnly || customer.bookingsPlaced > 0);
}
export function presentationCustomerCsv(data: PresentationAdminData): Blob {
  const lines = [['STT', 'Tên người dùng', 'Giới tính', 'Ngày sinh', 'Số điện thoại', 'Email', 'Lịch đã đặt', 'Lịch đã thanh toán', 'Lịch hoàn thành', 'Lần đặt gần nhất', 'Đã thu online xác minh'],
    ...presentationCustomers(data).map((user, index) => [index + 1, user.fullName, user.gender === 'FEMALE' ? 'Nữ' : 'Nam', user.dateOfBirth ?? '', `'${user.phone}`, user.email,
      user.bookingsPlaced, user.paidBookings, user.completedBookings, user.lastBookingAt ?? '', user.totalVerifiedOnlineAmount])];
  return new Blob(['\uFEFF', lines.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
}

export function presentationInsights(data: AdminInsights, snapshot: PresentationAdminData): AdminInsights {
  const bookings = presentationBookings(snapshot, { from: data.range.fromDate, to: data.range.toDate });
  const metric = (value: number, basis: string) => ({ value, previous: null, changePercent: null, basis });
  const bucket = (day: string) => {
    if (data.granularity === 'MONTH') return `${day.slice(0, 7)}-01`;
    if (data.granularity === 'WEEK') { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7); return date.toISOString().slice(0, 10); }
    return day;
  };
  const trends = new Map<string, AdminInsights['trends'][number]>();
  for (let day = data.range.fromDate; day <= data.range.toDate;) {
    const key = bucket(day); trends.set(key, { date: key, bookings: 0, verifiedOnlineAmount: 0, commissionAmount: 0 });
    day = new Date(Date.parse(`${day}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  }
  const services = new Map<number, AdminInsights['popularServices'][number]>();
  for (const booking of bookings) {
    const point = trends.get(bucket(booking.createdAt.slice(0, 10)))!;
    point.bookings++; point.commissionAmount! += booking.commissionAmount;
    const service = services.get(booking.serviceId) ?? { id: booking.serviceId, name: booking.serviceName, supplierName: booking.supplierName, bookings: 0, percentage: 0 };
    service.bookings++; services.set(booking.serviceId, service);
  }
  return { ...data, totalBookings: metric(bookings.length, 'Tổng lịch được tạo trong kỳ.'), users: metric(snapshot.users.length, 'Tổng tài khoản trong hệ thống.'),
    activePartners: metric(snapshot.salons.filter(salon => salon.active).length, 'Đối tác đã duyệt và đang hoạt động.'),
    completedBookings: metric(bookings.length, `${bookings.length} lịch đã hoàn thành trong kỳ.`),
    commissionRevenue: metric(bookings.reduce((sum, booking) => sum + booking.commissionAmount, 0), 'Hoa hồng ghi nhận từ hoạt động đặt lịch.'),
    bookingCustomers: new Set(bookings.map(booking => booking.customerId)).size,
    onlinePaymentRate: metric(0, 'Chỉ tính giao dịch online đã được xác minh.'),
    statuses: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map(status => ({ status: status as AdminBooking['status'], count: status === 'COMPLETED' ? bookings.length : 0 })),
    trends: [...trends.values()], topSalons: snapshot.salons.map(salon => {
      const rows = bookings.filter(booking => booking.supplierId === salon.id);
      return { id: salon.id, name: salon.name, location: salon.location, bookings: rows.length, verifiedOnlineAmount: 0, commissionAmount: rows.reduce((sum, booking) => sum + booking.commissionAmount, 0) };
    }).sort((a, b) => b.bookings - a.bookings),
    popularServices: [...services.values()].map(service => ({ ...service, percentage: bookings.length ? Math.round(service.bookings / bookings.length * 1000) / 10 : 0 })).sort((a, b) => b.bookings - a.bookings) };
}
