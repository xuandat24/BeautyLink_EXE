import type { EditSnapshot, PartnerProfileEdit, PartnerServiceEdit, PartnerPersonEdit, PartnerScheduleEdit } from '../types/adminV2';
import { apiClient, adminPresentationData, getAccessToken } from './beautyApi';
import { alphabetic, displayAccount, displaySalon, type DisplayMetadata } from '../lib/adminDisplayProfiles';
import { isPresentationUser, mergePresentationBookings, presentationBookings, presentationPage, presentationSearch, accountRowsCsv } from '../lib/presentationAdminData';
import type { AdminPage } from '../types';
import type { AdminInsights, AdminUserRow, AdminSalonRow, AdminSalonDetail, AdminReviewRow } from '../types/adminV2';
import type { AdminAccountDetail, AdminProfilePatch, AdminServiceDetail, AdminPaymentLedger } from '../types/adminV2';
import type { AdminBooking } from '../types';
import type { ReportingPaymentSummary } from '../types/adminV2';
import { sessionCredentialEpoch, sessionSnapshot } from '../lib/authSession';
import { selectReturningPresentationCustomers } from '../lib/returningPresentationCustomers';
export type AdminRange = { from: string; to: string; includeDemo: boolean };
export function adminRangeError({ from, to }: Pick<AdminRange, 'from' | 'to'>): string | null {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to)) return 'Vui lòng chọn ngày bắt đầu và kết thúc hợp lệ.';
  if (to < from) return 'Ngày kết thúc phải từ ngày bắt đầu trở đi.';
  if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 >= 366) return 'Khoảng thời gian tối đa là 366 ngày.';
  return null;
}
export const adminV2Api = {
  salonRoster: async (): Promise<import('../types/adminV2').SalonRoster> => (await apiClient.get('/v1/admin/salon-directory')).data,
  displayProfiles: async (): Promise<DisplayMetadata> => (await apiClient.get('/v1/admin/presentation/profiles')).data,
  reportPayments: async (params: { from: string; to: string; salonId?: number; page: number; size?: number }): Promise<ReportingPaymentSummary> => {
    const data: ReportingPaymentSummary = (await apiClient.get('/v1/admin/report-payments', { params: { size: 20, ...params } })).data;
    const snapshot = await adminPresentationData(params); const users = new Map(snapshot?.users.map(user => [user.id, user]));
    return { ...data, rows: { ...data.rows, content: data.rows.content.map(row => ({ ...row, customerName: users.get(row.customerId)?.fullName ?? row.customerName })) } };
  },
  partnerProfile: async (id: number): Promise<EditSnapshot<PartnerProfileEdit>> => (await apiClient.get(`/v1/admin/salons/${id}/edit`)).data,
  updatePartnerProfile: async (id: number, data: PartnerProfileEdit, expectedRevision: string): Promise<EditSnapshot<PartnerProfileEdit>> => (await apiClient.put(`/v1/admin/salons/${id}/edit`, { data: { name: data.name, businessType: data.businessType, description: data.description, addressLine: data.addressLine, imageUrl: data.imageUrl, locationId: data.locationId, latitude: data.latitude, longitude: data.longitude }, expectedRevision })).data,
  partnerService: async (sid: number, id: number): Promise<EditSnapshot<PartnerServiceEdit>> => (await apiClient.get(`/v1/admin/salons/${sid}/services/${id}/edit`)).data,
  updatePartnerService: async (sid: number, id: number, data: PartnerServiceEdit, expectedRevision: string): Promise<EditSnapshot<PartnerServiceEdit>> => (await apiClient.put(`/v1/admin/salons/${sid}/services/${id}/edit`, { data: { categoryId: data.categoryId, name: data.name, description: data.description, price: data.price, originalPrice: data.originalPrice, durationMinutes: data.durationMinutes, imageUrl: data.imageUrl, active: data.active }, expectedRevision })).data,
  partnerPerson: async (sid: number, id: number): Promise<EditSnapshot<PartnerPersonEdit>> => (await apiClient.get(`/v1/admin/salons/${sid}/practitioners/${id}/edit`)).data,
  updatePartnerPerson: async (sid: number, id: number, data: PartnerPersonEdit, serviceIds: number[] | null, expectedRevision: string): Promise<EditSnapshot<PartnerPersonEdit>> => (await apiClient.put(`/v1/admin/salons/${sid}/practitioners/${id}/edit`, { data: { displayName: data.displayName, specialty: data.specialty, bio: data.bio, avatarUrl: data.avatarUrl }, active: data.active, serviceIds, expectedRevision })).data,
  partnerSchedule: async (sid: number, id: number): Promise<EditSnapshot<PartnerScheduleEdit[]>> => (await apiClient.get(`/v1/admin/salons/${sid}/practitioners/${id}/schedule/edit`)).data,
  updatePartnerSchedule: async (sid: number, id: number, rules: PartnerScheduleEdit[], expectedRevision: string): Promise<EditSnapshot<PartnerScheduleEdit[]>> => (await apiClient.put(`/v1/admin/salons/${sid}/practitioners/${id}/schedule/edit`, { data: { rules: rules.map(({ dayOfWeek, startTime, endTime, breakStart, breakEnd, slotMinutes, active }) => ({ dayOfWeek, startTime, endTime, breakStart, breakEnd, slotMinutes, active })) }, expectedRevision })).data,
  account: async (id: number, forEdit = false): Promise<AdminAccountDetail> => {
    if (isPresentationUser(id)) {
      if (forEdit) throw new Error('Hồ sơ báo cáo chỉ hỗ trợ xem.');
      await apiClient.get('/v1/admin/users', { params: { page: 0, size: 1 } });
      return (await adminPresentationData())!.users.find(user => user.id === id)!;
    }
    const account = (await apiClient.get(`/v1/admin/users/${id}`)).data; return forEdit ? account : displayAccount(account, await adminV2Api.displayProfiles());
  },
  updateAccount: async (id: number, data: AdminProfilePatch): Promise<AdminAccountDetail> => {
    if (isPresentationUser(id)) throw new Error('Hồ sơ báo cáo chỉ hỗ trợ xem.');
    return (await apiClient.patch(`/v1/admin/users/${id}/profile`, data)).data;
  },
  salonHeader: async (id: number): Promise<AdminSalonDetail> => {
    const data: AdminSalonDetail = (await apiClient.get(`/v1/admin/salons/${id}`, { params: { includeDemo: false, headerOnly: true } })).data;
    const snapshot = await adminPresentationData(); const salon = snapshot?.salons.find(row => row.id === id);
    return { ...data, salon: displaySalon({ ...data.salon, ...salon, ownerUserId: data.salon.ownerUserId, name: data.salon.name }, new Map(snapshot?.users.map(u => [u.id, u]))) };
  },
  salonServices: async (id: number, page = 0): Promise<AdminPage<AdminServiceDetail>> => (await apiClient.get(`/v1/admin/salons/${id}/services`, { params: { page, size: 20 } })).data,
  salonPractitioners: async (id: number, page = 0): Promise<AdminPage<AdminSalonDetail['practitioners'][number]>> => (await apiClient.get(`/v1/admin/salons/${id}/practitioners`, { params: { page, size: 20 } })).data,
  salonSchedule: async (id: number, personId: number): Promise<AdminSalonDetail['schedules']> => (await apiClient.get(`/v1/admin/salons/${id}/practitioners/${personId}/schedule`)).data,
  salonBookings: async (id: number, params: { from: string; to: string; status?: string; page: number }): Promise<AdminPage<AdminBooking>> => {
    const data = (await apiClient.get(`/v1/admin/salons/${id}/bookings`, { params: { ...params, size: 20 } })).data;
    const snapshot = await adminPresentationData(params);
    return snapshot ? presentationPage(presentationBookings({ ...snapshot, bookings: mergePresentationBookings(snapshot.bookings, data.content) }, { ...params, supplierId: id }), params.page) : data;
  },
  paymentLedger: async (params: { from: string; to: string; page: number; salonId?: number }): Promise<AdminPaymentLedger> => (await apiClient.get('/v1/admin/payments', { params: { ...params, size: 20 } })).data,
  insights: async (params: AdminRange & { granularity: 'DAY' | 'WEEK' | 'MONTH' }): Promise<AdminInsights> => {
    const data: AdminInsights = (await apiClient.get('/v1/admin/dashboard/insights', { params })).data;
    if (!data.currentPeriod || !data.previousPeriod || !data.asOf || !data.totalBookings?.comparisonStatus) throw new Error('API báo cáo chưa hỗ trợ so sánh kỳ trước. Vui lòng thử lại sau khi cập nhật backend.');
    return data;
  },
  users: async (params: { query?: string; role?: string; page: number; size: number }, forEdit = false): Promise<AdminPage<AdminUserRow>> => {
    const data = (await apiClient.get<AdminPage<AdminUserRow>>('/v1/admin/users', { params: { ...params, forEdit } })).data;
    if (forEdit) return data;
    const snapshot = await adminPresentationData();
    return snapshot ? presentationPage(alphabetic(snapshot.users, user => user.fullName).filter(user => (!params.role || user.role === params.role) && presentationSearch(`${user.fullName} ${user.email}`, params.query)), params.page, params.size) : data;
  },
  returningUsers: async (params: { query?: string; page: number; size: number }): Promise<AdminPage<AdminUserRow>> => {
    const snapshot = await adminPresentationData();
    let users: AdminUserRow[] = snapshot?.users ?? [];
    if (!snapshot) {
      const first = await adminV2Api.users({ page: 0, size: 100 });
      const rest = await Promise.all(Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, index) => adminV2Api.users({ page: index + 1, size: 100 })));
      users = [...first.content, ...rest.flatMap(page => page.content)];
    }
    const rows = snapshot?.returningCustomerIds ? users.filter(user => snapshot.returningCustomerIds!.includes(user.id)) : selectReturningPresentationCustomers(users);
    return presentationPage(alphabetic(rows.filter(user => presentationSearch(`${user.fullName} ${user.email}`, params.query)), user => user.fullName), params.page, params.size);
  },
  exportDirectory: async (params: { query?: string; role?: string; returning?: boolean }, isCurrent: () => boolean): Promise<Blob> => {
    const token = getAccessToken(), epoch = sessionCredentialEpoch();
    const guard = () => { if (!token || token !== getAccessToken() || epoch !== sessionCredentialEpoch() || sessionSnapshot().phase !== 'verified' || !isCurrent()) throw new Error('Đã hủy tải vì bộ lọc hoặc phiên đăng nhập thay đổi.'); };
    guard();
    const snapshot = await adminPresentationData(); guard();
    let rows: AdminUserRow[];
    if (snapshot) {
      rows = params.returning ? snapshot.returningCustomerIds ? snapshot.users.filter(user => snapshot.returningCustomerIds!.includes(user.id)) : selectReturningPresentationCustomers(snapshot.users) : snapshot.users;
      rows = rows.filter(user => (!params.role || user.role === params.role) && presentationSearch(`${user.fullName} ${user.email}`, params.query));
    } else {
      // Existing bulk/page endpoints only. No per-account detail requests and no fabricated history fields.
      const fetchPage = (page: number) => params.returning ? adminV2Api.returningUsers({ query: params.query, page, size: 100 }) : adminV2Api.users({ query: params.query, role: params.role, page, size: 100 });
      const first = await fetchPage(0); guard(); rows = [];
      if (!Number.isSafeInteger(first.totalElements) || first.totalElements < 0 || first.size !== 100 || first.totalPages !== Math.ceil(first.totalElements / first.size)) throw new Error('Danh sách không đầy đủ; vui lòng tải lại.');
      for (let page = 0; page < Math.max(1, first.totalPages); page++) {
        const result = page === 0 ? first : await fetchPage(page); guard();
        if (result.page !== page || result.size !== first.size || result.totalElements !== first.totalElements || result.totalPages !== first.totalPages || result.content.length !== Math.min(first.size, first.totalElements - page * first.size)) throw new Error('Danh sách thay đổi hoặc tải thiếu; vui lòng tải lại.');
        rows.push(...result.content);
      }
      if (rows.length !== first.totalElements) throw new Error('Không thể tải đầy đủ danh sách.');
    }
    if (new Set(rows.map(user => user.id)).size !== rows.length) throw new Error('Danh sách có hồ sơ trùng; đã hủy xuất.');
    guard(); const blob = accountRowsCsv(rows); guard(); return blob;
  },
  salons: async (params: { query?: string; includeDemo: boolean; page: number; size: number }): Promise<AdminPage<AdminSalonRow>> => {
    const data = (await apiClient.get('/v1/admin/salons', { params })).data;
    const snapshot = await adminPresentationData();
    return snapshot ? presentationPage(alphabetic(snapshot.salons, salon => salon.name).filter(salon => presentationSearch(`${salon.name} ${salon.ownerName} ${salon.ownerEmail}`, params.query)), params.page, params.size) : data;
  },
  salon: async (id: number, includeDemo = false): Promise<AdminSalonDetail> => {
    const data: AdminSalonDetail = (await apiClient.get(`/v1/admin/salons/${id}`, { params: { includeDemo } })).data;
    const snapshot = await adminPresentationData(); const salon = snapshot?.salons.find(row => row.id === id);
    return salon ? { ...data, salon: { ...salon, name: data.salon.name }, recentBookings: presentationBookings(snapshot!, { supplierId: id }).slice(0, 10) } : data;
  },
  reviews: async (params: { includeDemo: boolean; page: number; size: number }): Promise<AdminPage<AdminReviewRow>> => (await apiClient.get('/v1/admin/reviews', { params })).data,
};
