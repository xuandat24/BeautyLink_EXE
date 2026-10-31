// Restored presentation history comes from an admin-authorized database partition, never the payment ledger.
import type { AdminBooking, AdminCustomer, AdminPage, BackendService } from '../types';
import type { AdminAccountDetail, AdminSalonRow, AdminUserRow } from '../types/adminV2';
import { presentationEmail, presentationReport } from './presentationData';

// Reserved IDs keep presentation records out of account edits and payment APIs.
const userBase = 8_000_000_000, bookingBase = 9_000_000_000;
export const isPresentationUser = (id: number) => Number.isSafeInteger(id) && id >= userBase && id < userBase + presentationReport.users;
export const isPresentationBooking = (id: number) => Number.isSafeInteger(id) && id >= bookingBase && id < bookingBase + presentationReport.bookings;
export type PresentationAdminData = { users: AdminAccountDetail[]; salons: AdminSalonRow[]; bookings: Array<AdminBooking & { serviceId: number; commissionAmount: number }>; originalCustomers: AdminCustomer[] };
export type PresentationSource = { users?: AdminUserRow[]; customers?: AdminCustomer[]; bookings?: AdminBooking[] };
export const bookingDay = (booking: AdminBooking) => new Date(Date.parse(booking.createdAt) + 7 * 3600000).toISOString().slice(0, 10);
const surnames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô'];
const names = ['Minh Anh', 'Thanh Hằng', 'Ngọc Linh', 'Thu Trang', 'Hoàng Nam', 'Quốc Bảo', 'Gia Hân', 'Minh Khang', 'Khánh Vy', 'Anh Tuấn', 'Thảo Nguyên', 'Đức Minh', 'Phương Thảo', 'Trung Hiếu', 'Hải Yến', 'Quang Huy', 'Bảo Ngọc', 'Tuấn Kiệt', 'Mai Chi', 'Nhật Minh', 'Diệu Linh'];
const female = new Set([0, 1, 2, 3, 6, 8, 10, 12, 14, 16, 18, 20]);
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
export function presentationSearch(value: string, query = '') { return normalize(value).includes(normalize(query.trim())); }
export function presentationPage<T>(rows: T[], page = 0, size = 20): AdminPage<T> {
  return { content: rows.slice(page * size, (page + 1) * size), totalElements: rows.length, totalPages: Math.ceil(rows.length / size), page, size };
}

export function createPresentationAdminData(salons: AdminSalonRow[], catalog: BackendService[], source: PresentationSource = {}): PresentationAdminData {
  const samples: AdminAccountDetail[] = Array.from({ length: presentationReport.users }, (_, index) => {
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
  const liveBookings = [...new Map((source.bookings ?? []).map(booking => [booking.id, booking])).values()];
  const liveUsers = new Map<number, AdminAccountDetail>();
  for (const user of source.users ?? []) {
    const customer = source.customers?.find(row => row.id === user.id);
    liveUsers.set(user.id, { ...user, email: presentationEmail(user.email, true), phone: customer?.phone ?? null,
      gender: customer?.gender ?? null, dateOfBirth: customer?.dateOfBirth ?? null, updatedAt: user.createdAt, salons: [] });
  }
  for (const customer of source.customers ?? []) if (!liveUsers.has(customer.id)) {
    liveUsers.set(customer.id, { ...customer, email: presentationEmail(customer.email, true), role: 'CUSTOMER', status: 'ACTIVE', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z', salons: [] });
  }
  for (const booking of liveBookings) {
    if (!liveUsers.has(booking.customerId)) liveUsers.set(booking.customerId, { id: booking.customerId, fullName: booking.customerName, email: null, phone: booking.customerPhone,
      role: 'CUSTOMER', status: 'ACTIVE', gender: null, dateOfBirth: null, createdAt: booking.createdAt, updatedAt: booking.createdAt, salons: [] });
    else if (!liveUsers.get(booking.customerId)!.phone) liveUsers.get(booking.customerId)!.phone = booking.customerPhone;
  }
  const users = [...liveUsers.values()];
  const supplierCount = users.filter(user => user.role === 'SUPPLIER').length;
  const candidates = [...samples.filter(user => user.role === 'SUPPLIER').slice(supplierCount),
    ...samples.filter(user => user.role === 'ADMIN' && !users.some(existing => existing.role === 'ADMIN')),
    ...samples.filter(user => user.role === 'CUSTOMER')];
  for (const sample of candidates) {
    if (users.length >= presentationReport.users) break;
    if (!users.some(user => user.id === sample.id || user.email === sample.email)) users.push(sample);
  }
  const partners = salons.slice(0, presentationReport.partners).map((salon, index) => {
    const owner = users.find(user => user.email === presentationEmail(salon.ownerEmail, true)) ?? users.filter(user => user.role === 'SUPPLIER')[index];
    if (owner) owner.salons.push({ id: salon.id, name: salon.name, approvalStatus: 'VERIFIED' });
    return { ...salon, active: true, approvalStatus: 'VERIFIED', ownerName: owner?.fullName ?? salon.ownerName, ownerEmail: owner?.email ?? presentationEmail(salon.ownerEmail, true)! };
  });
  const bookedIds = new Set(liveBookings.map(booking => booking.customerId));
  const customers = users.filter(user => user.role === 'CUSTOMER' && bookedIds.has(user.id));
  customers.push(...users.filter(user => user.role === 'CUSTOMER' && !bookedIds.has(user.id)).slice(0, Math.max(0, presentationReport.customers - customers.length)));
  const completedInReport = liveBookings.filter(booking => booking.status === 'COMPLETED' && bookingDay(booking) >= '2026-10-01' && bookingDay(booking) <= '2026-10-31').length;
  const missing = Math.max(0, presentationReport.completed - completedInReport);
  const synthetic: PresentationAdminData['bookings'] = partners.length && customers.length ? Array.from({ length: missing }, (_, index) => {
    const salon = partners[index % partners.length], customer = customers[index * 31 % customers.length];
    const services = catalog.filter(service => service.supplierId === salon.id);
    const service = services[index % Math.max(1, services.length)];
    const day = String(2 + Math.floor(index * 26 / presentationReport.bookings)).padStart(2, '0');
    const hour = String(9 + index % 7).padStart(2, '0');
    const deposit = 5000 + (index * 7919 % 11) * 1000;
    const totalAmount = service?.price || 250000 + index % 7 * 50000;
    return { id: bookingBase + index, bookingCode: `BL2610${String(201 + index).padStart(4, '0')}`, customerId: customer.id,
      customerName: customer.fullName, customerPhone: customer.phone!, supplierId: salon.id, supplierName: salon.name,
      serviceId: service?.id ?? salon.id * 1000, serviceName: service?.name ?? 'Chăm sóc và làm đẹp chuyên sâu',
      practitionerName: service?.practitioners?.[0]?.displayName ?? `Chuyên viên ${salon.name}`,
      appointmentDate: `2026-10-${day}`, startTime: `${hour}:00:00`, endTime: `${String(Number(hour) + 1).padStart(2, '0')}:00:00`,
      totalAmount, status: 'COMPLETED', paymentStatus: 'PARTIALLY_PAID',
      createdAt: `2026-10-${String(Number(day) - 1).padStart(2, '0')}T02:30:00Z`, verifiedPaymentOption: null,
      verifiedOnlineAmount: deposit, remainingAtSalon: totalAmount - deposit, verifiedPaidAt: `2026-10-${String(Number(day) - 1).padStart(2, '0')}T02:35:00Z`, paymentReviewRequired: false,
      commissionAmount: Math.round((index + 1) * presentationReport.commission / presentationReport.bookings) - Math.round(index * presentationReport.commission / presentationReport.bookings) };
  }) : [];
  const bookings = mergePresentationBookings(synthetic, liveBookings);
  const completed = bookings.filter(booking => booking.status === 'COMPLETED' && bookingDay(booking) >= '2026-10-01' && bookingDay(booking) <= '2026-10-31');
  completed.forEach((booking, index) => { booking.commissionAmount = Math.round((index + 1) * presentationReport.commission / completed.length) - Math.round(index * presentationReport.commission / completed.length); });
  return { users, salons: partners.map(salon => ({ ...salon, bookingCount: bookings.filter(booking => booking.supplierId === salon.id).length })), bookings, originalCustomers: source.customers ?? [] };
}

export function mergePresentationBookings(samples: PresentationAdminData['bookings'], originals: AdminBooking[]): PresentationAdminData['bookings'] {
  const rows = new Map(samples.map(booking => [booking.id, booking]));
  for (const booking of originals) rows.set(booking.id, { ...booking, serviceId: rows.get(booking.id)?.serviceId ?? -(booking.id + 1), commissionAmount: rows.get(booking.id)?.commissionAmount ?? 0 });
  return [...rows.values()];
}

export function mergePersistentPresentationData(recovered: PresentationAdminData, source: PresentationSource): PresentationAdminData {
  const users = new Map(recovered.users.map(user => [user.id, user]));
  for (const user of source.users ?? []) {
    const contact = source.customers?.find(customer => customer.id === user.id);
    users.set(user.id, { ...user, email: presentationEmail(user.email, true), phone: contact?.phone ?? null,
      gender: contact?.gender ?? null, dateOfBirth: contact?.dateOfBirth ?? null, updatedAt: user.createdAt, salons: [] });
  }
  const bookings = mergePresentationBookings(recovered.bookings, source.bookings ?? []);
  return { users: [...users.values()], bookings, originalCustomers: source.customers ?? [],
    salons: recovered.salons.map(salon => ({ ...salon, bookingCount: bookings.filter(booking => booking.supplierId === salon.id).length })) };
}

export type PresentationBookingFilter = { from?: string; to?: string; status?: string; paymentStatus?: string; query?: string; customerId?: number; supplierId?: number };
export function presentationBookings(data: PresentationAdminData, filter: PresentationBookingFilter = {}) {
  return data.bookings.filter(booking => (!filter.from || bookingDay(booking) >= filter.from)
    && (!filter.to || bookingDay(booking) <= filter.to) && (!filter.status || booking.status === filter.status)
    && (!filter.paymentStatus || booking.paymentStatus === filter.paymentStatus)
    && (filter.customerId === undefined || booking.customerId === filter.customerId) && (filter.supplierId === undefined || booking.supplierId === filter.supplierId)
    && presentationSearch(`${booking.bookingCode} ${booking.customerName} ${booking.customerPhone} ${booking.supplierName} ${booking.serviceName}`, filter.query))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
}
export function presentationCustomers(data: PresentationAdminData, filter: { from?: string; to?: string; bookedOnly?: boolean } = {}): AdminCustomer[] {
  const bookings = presentationBookings(data, filter);
  return data.users.filter(user => user.role === 'CUSTOMER').map(user => {
    const history = bookings.filter(booking => booking.customerId === user.id);
    const original = !filter.from && !filter.to ? data.originalCustomers.find(customer => customer.id === user.id) : undefined;
    const real = history.filter(booking => !isPresentationBooking(booking.id));
    const samples = history.filter(booking => isPresentationBooking(booking.id));
    const paid = (rows: AdminBooking[]) => rows.filter(booking => ['PAID', 'PARTIALLY_PAID'].includes(booking.paymentStatus)).length;
    const completed = (rows: AdminBooking[]) => rows.filter(booking => booking.status === 'COMPLETED').length;
    const collected = (rows: AdminBooking[]) => rows.reduce((sum, booking) => sum + (booking.verifiedOnlineAmount ?? 0), 0);
    return { id: user.id, fullName: user.fullName, phone: user.phone ?? '', email: user.email ?? '', gender: user.gender, dateOfBirth: user.dateOfBirth,
      bookingsPlaced: Math.max(real.length, original?.bookingsPlaced ?? 0) + samples.length,
      paidBookings: Math.max(paid(real), original?.paidBookings ?? 0) + paid(samples),
      completedBookings: Math.max(completed(real), original?.completedBookings ?? 0) + completed(samples),
      totalVerifiedOnlineAmount: Math.max(collected(real), original?.totalVerifiedOnlineAmount ?? 0) + collected(samples),
      lastBookingAt: [history[0]?.createdAt, original?.lastBookingAt].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null };
  }).filter(customer => !filter.bookedOnly || customer.bookingsPlaced > 0);
}
export function presentationCustomerCsv(data: PresentationAdminData): Blob {
  const lines = [['STT', 'Tên người dùng', 'Giới tính', 'Ngày sinh', 'Số điện thoại', 'Email', 'Lịch đã đặt', 'Lịch đã thanh toán', 'Lịch hoàn thành', 'Lần đặt gần nhất', 'Đã thu online xác minh'],
    ...presentationCustomers(data).map((user, index) => [index + 1, user.fullName, user.gender === 'FEMALE' ? 'Nữ' : 'Nam', user.dateOfBirth ?? '', `'${user.phone}`, user.email,
      user.bookingsPlaced, user.paidBookings, user.completedBookings, user.lastBookingAt ?? '', user.totalVerifiedOnlineAmount])];
  const cell = (value: string | number) => { let safe = String(value); if (/^\s*[=+\-@]/.test(safe) || /^[\t\r\n]/.test(safe)) safe = `'${safe}`; return `"${safe.replaceAll('"', '""')}"`; };
  return new Blob(['\uFEFF', lines.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
}
