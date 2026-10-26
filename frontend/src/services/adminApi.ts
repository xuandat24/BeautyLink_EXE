import { apiClient } from './beautyApi';
import { presentationAccount, presentationInsights } from '../lib/presentationData';
import type { AdminPage } from '../types';
import type { AdminInsights, AdminUserRow, AdminSalonRow, AdminSalonDetail, AdminReviewRow } from '../types/adminV2';
import type { AdminAccountDetail, AdminProfilePatch, AdminServiceDetail, AdminPaymentLedger } from '../types/adminV2';
import type { AdminBooking } from '../types';
export type AdminRange = { from: string; to: string; includeDemo: boolean };
export function adminRangeError({ from, to }: Pick<AdminRange, 'from' | 'to'>): string | null {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to)) return 'Vui lòng chọn ngày bắt đầu và kết thúc hợp lệ.';
  if (to < from) return 'Ngày kết thúc phải từ ngày bắt đầu trở đi.';
  if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 >= 366) return 'Khoảng thời gian tối đa là 366 ngày.';
  return null;
}
export const adminV2Api = {
  account: async (id: number): Promise<AdminAccountDetail> => presentationAccount((await apiClient.get(`/v1/admin/users/${id}`)).data),
  updateAccount: async (id: number, data: AdminProfilePatch): Promise<AdminAccountDetail> => presentationAccount((await apiClient.patch(`/v1/admin/users/${id}/profile`, data)).data),
  salonHeader: async (id: number): Promise<AdminSalonDetail> => (await apiClient.get(`/v1/admin/salons/${id}`, { params: { includeDemo: false, headerOnly: true } })).data,
  salonServices: async (id: number, page = 0): Promise<AdminPage<AdminServiceDetail>> => (await apiClient.get(`/v1/admin/salons/${id}/services`, { params: { page, size: 20 } })).data,
  salonPractitioners: async (id: number, page = 0): Promise<AdminPage<AdminSalonDetail['practitioners'][number]>> => (await apiClient.get(`/v1/admin/salons/${id}/practitioners`, { params: { page, size: 20 } })).data,
  salonSchedule: async (id: number, personId: number): Promise<AdminSalonDetail['schedules']> => (await apiClient.get(`/v1/admin/salons/${id}/practitioners/${personId}/schedule`)).data,
  salonBookings: async (id: number, params: { from: string; to: string; status?: string; page: number }): Promise<AdminPage<AdminBooking>> => (await apiClient.get(`/v1/admin/salons/${id}/bookings`, { params: { ...params, size: 20 } })).data,
  paymentLedger: async (params: { from: string; to: string; page: number; salonId?: number }): Promise<AdminPaymentLedger> => (await apiClient.get('/v1/admin/payments', { params: { ...params, size: 20 } })).data,
  insights: async (params: AdminRange & { granularity: 'DAY' | 'WEEK' | 'MONTH' }): Promise<AdminInsights> => presentationInsights((await apiClient.get('/v1/admin/dashboard/insights', { params })).data),
  users: async (params: { query?: string; role?: string; page: number; size: number }): Promise<AdminPage<AdminUserRow>> => {
    const page = (await apiClient.get<AdminPage<AdminUserRow>>('/v1/admin/users', { params })).data;
    return { ...page, content: page.content.map(presentationAccount) };
  },
  salons: async (params: { query?: string; includeDemo: boolean; page: number; size: number }): Promise<AdminPage<AdminSalonRow>> => (await apiClient.get('/v1/admin/salons', { params })).data,
  salon: async (id: number, includeDemo = false): Promise<AdminSalonDetail> => (await apiClient.get(`/v1/admin/salons/${id}`, { params: { includeDemo } })).data,
  reviews: async (params: { includeDemo: boolean; page: number; size: number }): Promise<AdminPage<AdminReviewRow>> => (await apiClient.get('/v1/admin/reviews', { params })).data,
};
