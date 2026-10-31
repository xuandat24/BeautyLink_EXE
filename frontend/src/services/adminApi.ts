import type { EditSnapshot, PartnerProfileEdit, PartnerServiceEdit, PartnerPersonEdit, PartnerScheduleEdit } from '../types/adminV2';
import { apiClient, adminPresentationData } from './beautyApi';
import { presentationAccount } from '../lib/presentationData';
import { isPresentationUser, mergePresentationBookings, presentationBookings, presentationPage, presentationSearch } from '../lib/presentationAdminData';
import type { AdminPage } from '../types';
import type { AdminInsights, AdminUserRow, AdminSalonRow, AdminSalonDetail, AdminReviewRow } from '../types/adminV2';
import type { AdminAccountDetail, AdminProfilePatch, AdminServiceDetail, AdminPaymentLedger } from '../types/adminV2';
import type { AdminBooking } from '../types';
import type { ReportingPaymentSummary } from '../types/adminV2';
export type AdminRange = { from: string; to: string; includeDemo: boolean };
export function adminRangeError({ from, to }: Pick<AdminRange, 'from' | 'to'>): string | null {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to)) return 'Vui lòng chọn ngày bắt đầu và kết thúc hợp lệ.';
  if (to < from) return 'Ngày kết thúc phải từ ngày bắt đầu trở đi.';
  if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 >= 366) return 'Khoảng thời gian tối đa là 366 ngày.';
  return null;
}
export const adminV2Api = {
  reportPayments: async (params: { from: string; to: string; salonId?: number; page: number; size?: number }): Promise<ReportingPaymentSummary> => (await apiClient.get('/v1/admin/report-payments', { params: { size: 20, ...params } })).data,
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
    const account = (await apiClient.get(`/v1/admin/users/${id}`)).data; return forEdit ? account : presentationAccount(account);
  },
  updateAccount: async (id: number, data: AdminProfilePatch): Promise<AdminAccountDetail> => {
    if (isPresentationUser(id)) throw new Error('Hồ sơ báo cáo chỉ hỗ trợ xem.');
    return (await apiClient.patch(`/v1/admin/users/${id}/profile`, data)).data;
  },
  salonHeader: async (id: number): Promise<AdminSalonDetail> => {
    const data: AdminSalonDetail = (await apiClient.get(`/v1/admin/salons/${id}`, { params: { includeDemo: false, headerOnly: true } })).data;
    const snapshot = await adminPresentationData(); const salon = snapshot?.salons.find(row => row.id === id);
    return salon ? { ...data, salon: { ...salon, name: data.salon.name } } : data;
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
    const data = (await apiClient.get<AdminPage<AdminUserRow>>('/v1/admin/users', { params })).data;
    if (forEdit) return data;
    const snapshot = await adminPresentationData();
    return snapshot ? presentationPage(snapshot.users.filter(user => (!params.role || user.role === params.role) && presentationSearch(`${user.fullName} ${user.email}`, params.query))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id), params.page, params.size) : { ...data, content: data.content.map(presentationAccount) };
  },
  salons: async (params: { query?: string; includeDemo: boolean; page: number; size: number }): Promise<AdminPage<AdminSalonRow>> => {
    const data = (await apiClient.get('/v1/admin/salons', { params })).data;
    const snapshot = await adminPresentationData();
    return snapshot ? presentationPage(snapshot.salons.filter(salon => presentationSearch(`${salon.name} ${salon.ownerName}`, params.query)), params.page, params.size) : data;
  },
  salon: async (id: number, includeDemo = false): Promise<AdminSalonDetail> => {
    const data: AdminSalonDetail = (await apiClient.get(`/v1/admin/salons/${id}`, { params: { includeDemo } })).data;
    const snapshot = await adminPresentationData(); const salon = snapshot?.salons.find(row => row.id === id);
    return salon ? { ...data, salon: { ...salon, name: data.salon.name }, recentBookings: presentationBookings(snapshot!, { supplierId: id }).slice(0, 10) } : data;
  },
  reviews: async (params: { includeDemo: boolean; page: number; size: number }): Promise<AdminPage<AdminReviewRow>> => (await apiClient.get('/v1/admin/reviews', { params })).data,
};
