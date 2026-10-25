import { apiClient } from './beautyApi';
import type { AdminPage } from '../types';
import type { AdminInsights, AdminUserRow, AdminSalonRow, AdminSalonDetail, AdminReviewRow } from '../types/adminV2';
export type AdminRange = { from: string; to: string; includeDemo: boolean };
export function adminRangeError({ from, to }: Pick<AdminRange, 'from' | 'to'>): string | null {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to)) return 'Vui lòng chọn ngày bắt đầu và kết thúc hợp lệ.';
  if (to < from) return 'Ngày kết thúc phải từ ngày bắt đầu trở đi.';
  if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 >= 366) return 'Khoảng thời gian tối đa là 366 ngày.';
  return null;
}
export const adminV2Api = {
  insights: async (params: AdminRange & { granularity: 'DAY' | 'WEEK' | 'MONTH' }): Promise<AdminInsights> => (await apiClient.get('/v1/admin/dashboard/insights', { params })).data,
  users: async (params: { query?: string; role?: string; page: number; size: number }): Promise<AdminPage<AdminUserRow>> => (await apiClient.get('/v1/admin/users', { params })).data,
  salons: async (params: { query?: string; includeDemo: boolean; page: number; size: number }): Promise<AdminPage<AdminSalonRow>> => (await apiClient.get('/v1/admin/salons', { params })).data,
  salon: async (id: number, includeDemo = false): Promise<AdminSalonDetail> => (await apiClient.get(`/v1/admin/salons/${id}`, { params: { includeDemo } })).data,
  reviews: async (params: { includeDemo: boolean; page: number; size: number }): Promise<AdminPage<AdminReviewRow>> => (await apiClient.get('/v1/admin/reviews', { params })).data,
};
