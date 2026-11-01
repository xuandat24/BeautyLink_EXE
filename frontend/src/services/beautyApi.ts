import axios from 'axios';
import { createWithRecovery, PAYMENT_HTTP_TIMEOUT } from '../lib/paymentCreation';
import { rememberPaymentObservation } from '../lib/payosCheckout';
import {
  BackendCategory,
  BackendService,
  BackendLocation,
  BackendPractitioner,
  BackendBooking,
  BookingReview,
  BackendSupplierProfile,
  ScheduleRule,
  BackendReport,
  AdminCustomer,
  AdminBooking,
  AdminDashboardSummary,
  AdminPaymentSummary,
  AdminRevenueRow,
  AdminPage,
  CurrentUser,
  HotDeal,
  Salon,
  NewPartner,
  CityDestination,
  Voucher,
  CategoryItem,
  BookingDetails,
  BookingSchema,
  PayOSPayment,
  PaymentOption,
  PaymentQuote,
} from '../types';
import {
  HOT_DEALS,
  NEARBY_SALONS,
  NEW_PARTNERS,
  CATEGORIES,
  CITIES,
  VOUCHERS,
} from '../data/mockData';
import { cache } from '../lib/cache';
import { bookingRowsCsv } from '../lib/adminBookingCsv';
import { presentationEnabled, presentationReviewAllocation, presentationService, type PresentationReviewAllocation } from '../lib/presentationData';
import { mergePersistentPresentationData, isPresentationBooking, isPresentationUser, mergePresentationBookings, presentationBookings, presentationCustomerCsv, presentationCustomers, presentationPage, type PresentationAdminData } from '../lib/presentationAdminData';
import type { AdminUserRow } from '../types/adminV2';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
import { clearSession, getSessionToken, installToken, peekAccessToken, sessionSnapshot, setSessionPhase, sessionCredentialEpoch } from '../lib/authSession';


export interface PublicReviewPage {
  content: Array<{ id: number; targetType: 'SERVICE' | 'SUPPLIER'; rating: number; comment: string | null; reviewerDisplayName: string; serviceId: number; serviceName: string; createdAt: string; images?: string[] }>;
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  rating: number;
}

// Local development uses Vite's /api proxy. Production supplies the Railway
// backend URL at build time through VITE_API_BASE_URL.
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || '/api';
// Offline sample data is useful only while developing locally. A production
// bundle must always reflect the API and real database, even if an environment
// variable was accidentally left enabled on the hosting provider.
const DEMO_FALLBACK_ENABLED = import.meta.env?.DEV && import.meta.env?.VITE_ENABLE_DEMO_FALLBACK === 'true';
let presentationCatalogPromise: Promise<BackendService[]> | null = null;
let presentationAllocation: PresentationReviewAllocation | null = null;
let adminPresentationPromise: Promise<PresentationAdminData | null> | null = null;
let adminPresentationToken: string | null = null;
let adminPresentationLoadedAt = 0;
let adminPresentationFrom = '', adminPresentationTo = '';

type BackendDay = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
type BackendScheduleRule = {
  id?: number;
  dayOfWeek: BackendDay;
  startTime: string;
  endTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  slotMinutes: number;
  active: boolean;
};

const BACKEND_DAYS: BackendDay[] = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
];

const fromBackendSchedule = (rule: BackendScheduleRule): ScheduleRule => ({
  id: rule.id,
  dayOfWeek: BACKEND_DAYS.indexOf(rule.dayOfWeek) + 1,
  isWorking: rule.active,
  startTime: rule.startTime,
  endTime: rule.endTime,
  breakStartTime: rule.breakStart ?? null,
  breakEndTime: rule.breakEnd ?? null,
  slotDurationMinutes: rule.slotMinutes,
});

const toBackendSchedule = (rule: ScheduleRule): Omit<BackendScheduleRule, 'id'> => ({
  dayOfWeek: BACKEND_DAYS[rule.dayOfWeek - 1],
  startTime: rule.startTime,
  endTime: rule.endTime,
  breakStart: rule.breakStartTime || null,
  breakEnd: rule.breakEndTime || null,
  slotMinutes: rule.slotDurationMinutes,
  active: rule.isWorking,
});

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const publicAuth = /\/auth\/(login|google|register|register-supplier|password-reset|registration-verification)(\/|$)/.test(config.url ?? '');
    if (publicAuth) { delete config.headers.Authorization; return config; }
    const communityRead = config.method === 'get' && /^\/v1\/community\/(config|services|posts(?:\/[^/?]+(?:\/comments)?)?)$/.test((config.url ?? '').split('?')[0]);
    if (communityRead) {
      const optional = getAccessToken();
      if (optional && sessionSnapshot().phase === 'verified') config.headers.Authorization = `Bearer ${optional}`;
      else delete config.headers.Authorization;
      return config;
    }
    const publicRead = config.method === 'get' && /\/(v1\/(locations|categories|catalog|services|suppliers|homepage)|products)(\/|$)/.test(config.url ?? '');
    if (publicRead) { delete config.headers.Authorization; return config; }
    if (config.url?.endsWith('/auth/session/logout') && config.headers.Authorization) return config;
    const token = getAccessToken();
    if (token) {
      const phase = sessionSnapshot().phase;
      if (phase !== 'verified' && !/\/auth\/(me$|session\/)/.test(config.url ?? '')) {
        throw new axios.CanceledError('Vui lòng xác minh lại phiên đăng nhập.');
      }
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      throw new axios.CanceledError('Phiên đăng nhập đã hết hạn.');
    }
  }
  return config;
});

apiClient.interceptors.response.use(response => response, error => {
  const authorization = error.config?.headers?.Authorization;
  if (error.response?.status === 401 && typeof authorization === 'string'
    && authorization === `Bearer ${peekAccessToken()}`) clearSession();
  else if (typeof authorization === 'string' && authorization === `Bearer ${peekAccessToken()}`
    && /\/auth\/(me$|session\/activity$)/.test(error.config?.url ?? '')
    && (!error.response || error.response.status >= 500)) {
    const token = peekAccessToken(); if (token) setSessionPhase('locked', token);
  }
  return Promise.reject(error);
});

async function reviewAllocation(): Promise<PresentationReviewAllocation | null> {
  if (!presentationEnabled) return null;
  if (presentationAllocation) return presentationAllocation;
  if (!presentationCatalogPromise) {
    presentationCatalogPromise = unwrap<BackendService[]>(apiClient.get('/v1/catalog/services'));
  }
  try {
    const catalog = await presentationCatalogPromise;
    presentationAllocation = presentationReviewAllocation(catalog);
    return presentationAllocation;
  } catch {
    presentationCatalogPromise = null;
    return null;
  }
}

async function readAdminPages<T extends { id: number }>(path: string, params: Record<string, unknown> = {}, guard: () => void = () => {}): Promise<T[]> {
  guard();
  const first = (await apiClient.get<AdminPage<T>>(path, { params: { ...params, page: 0, size: 100 } })).data;
  guard();
  if (!Number.isSafeInteger(first.totalElements) || first.totalElements < 0 || first.size !== 100 || first.totalPages !== Math.ceil(first.totalElements / 100)) throw new Error('Danh sách tải thiếu hoặc thay đổi; vui lòng tải lại.');
  const rows: T[] = [];
  for (let page = 0; page < Math.max(1, first.totalPages); page++) {
    const result = page === 0 ? first : (await apiClient.get<AdminPage<T>>(path, { params: { ...params, page, size: 100 } })).data;
    guard();
    if (result.page !== page || result.size !== first.size || result.totalElements !== first.totalElements || result.totalPages !== first.totalPages || result.content.length !== Math.min(first.size, first.totalElements - page * first.size)) throw new Error('Danh sách tải thiếu hoặc thay đổi; vui lòng tải lại.');
    rows.push(...result.content);
  }
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Danh sách tải về có dòng trùng; đã hủy xuất.');
  return rows;
}

export async function adminPresentationData(range?: { from?: string; to?: string }): Promise<PresentationAdminData | null> {
  const token = getAccessToken();
  if (!token) return null;
  if (!adminPresentationPromise || token !== adminPresentationToken || Date.now() - adminPresentationLoadedAt > 30000) {
    adminPresentationToken = token;
    adminPresentationLoadedAt = Date.now();
    adminPresentationTo = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    adminPresentationFrom = new Date(Date.parse(`${adminPresentationTo}T12:00:00Z`) - 365 * 86400000).toISOString().slice(0, 10);
    adminPresentationPromise = (async () => {
      const response = await apiClient.get<PresentationAdminData>('/v1/admin/presentation');
      if (response.status === 204 || !response.data?.bookings) return null;
      const [users, customers, bookings, salons] = await Promise.all([
        readAdminPages<AdminUserRow>('/v1/admin/users'),
        apiClient.get<AdminCustomer[]>('/v1/admin/customers'),
        readAdminPages<AdminBooking>('/v1/admin/bookings', { from: adminPresentationFrom, to: adminPresentationTo, includeDemo: false }),
        readAdminPages<import('../types/adminV2').AdminSalonRow>('/v1/admin/salons', { includeDemo: false }),
      ]);
      return mergePersistentPresentationData(response.data, { users, customers: customers.data, bookings, salons });
    })();
  }
  const pending = adminPresentationPromise;
  try {
    const snapshot = await pending;
    if (token !== getAccessToken()) throw new axios.CanceledError('Phiên đăng nhập đã thay đổi.');
    if (snapshot && range?.from && range?.to && (range.from < adminPresentationFrom || range.to > adminPresentationTo)) {
      const originals = await readAdminPages<AdminBooking>('/v1/admin/bookings', { from: range.from, to: range.to, includeDemo: false });
      return { ...snapshot, bookings: mergePresentationBookings(snapshot.bookings, originals) };
    }
    return snapshot;
  } catch (error) { if (adminPresentationPromise === pending) adminPresentationPromise = null; throw error; }
}

export function setAccessToken(token: string, rememberMe = false) {
  // Kept as a compatible argument for old callers; MVP persistent login is disabled.
  void rememberMe;
  if (typeof window !== 'undefined') installToken(token);
}

export function clearAccessToken() {
  if (typeof window !== 'undefined') clearSession();
}

export function getAccessToken(): string | null {
  if (typeof window !== 'undefined') {
    return getSessionToken();
  }
  return null;
}

export function hasPersistentSession(): boolean {
  return false;
}

export function getApiErrorMessage(err: unknown, defaultMessage = 'Đã xảy ra lỗi. Vui lòng thử lại.'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; fields?: Record<string, string> } | undefined;
    const firstFieldError = data?.fields ? Object.values(data.fields)[0] : undefined;
    if (firstFieldError) return firstFieldError;
    if (data?.message) return data.message;
    if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
      return 'Không thể kết nối đến máy chủ. Đang sử dụng chế độ dự phòng ngoại tuyến.';
    }
    return err.message || defaultMessage;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return defaultMessage;
}

export function getPaymentErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && ['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'].includes(err.code ?? ''))
    return 'Kết nối đang chậm hoặc bị gián đoạn. Lịch hẹn được giữ nguyên; hãy kiểm tra lại trạng thái, không tạo đơn mới hay chuyển tiền lần nữa.';
  return getApiErrorMessage(err, fallback);
}

export function getAuthErrorMessage(err: unknown): string {
  if (!axios.isAxiosError(err)) return getApiErrorMessage(err, 'Không thể xác thực tài khoản. Vui lòng thử lại.');
  const data = err.response?.data as { code?: string; message?: string; fields?: Record<string, string> } | undefined;
  if (data?.code === 'GOOGLE_ACCOUNT_LINK_REQUIRED' || data?.code === 'GOOGLE_CUSTOMER_ONLY'
      || data?.code === 'GOOGLE_AUTH_NOT_CONFIGURED' || data?.code === 'GOOGLE_TOKEN_INVALID'
      || data?.code === 'ACCOUNT_INACTIVE') {
    return data.message || 'Không thể đăng nhập bằng Google. Vui lòng dùng phương thức đăng nhập hiện có.';
  }
  if (err.response?.status === 401) {
    return 'Thông tin đăng nhập không chính xác';
  }
  if (err.response?.status === 429) {
    return data?.message || 'Bạn đã thử quá nhiều lần. Vui lòng đợi rồi thử lại.';
  }
  if (err.response?.status === 403) {
    return data?.message || 'Yêu cầu đăng nhập bị từ chối (403). Vui lòng tải lại trang hoặc liên hệ hỗ trợ.';
  }
  if (!err.response || err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.';
  }
  if (err.response.status >= 500) {
    return 'Dịch vụ đăng nhập đang tạm gián đoạn. Vui lòng thử lại sau.';
  }
  return getApiErrorMessage(err, 'Không thể xác thực tài khoản. Vui lòng thử lại.');
}

const unwrap = <T>(promise: Promise<{ data: T }>): Promise<T> => promise.then(({ data }) => data);

// Default fallbacks for robust operation
export const DEFAULT_LOCATIONS: BackendLocation[] = [
  { id: 2, name: 'Hà Nội', slug: 'ha-noi', type: 'PROVINCE_CITY', parentId: null },
  { id: 1, name: 'Thành phố Hồ Chí Minh', slug: 'ho-chi-minh', type: 'PROVINCE_CITY', parentId: null },
];

export const DEFAULT_CATEGORIES: BackendCategory[] = [
  {
    id: 1,
    slug: 'makeup',
    name: 'Trang điểm',
    description: 'Makeup cá nhân, cô dâu và sự kiện theo phong cách riêng.',
    imageUrl: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 2,
    slug: 'hair',
    name: 'Làm tóc',
    description: 'Cắt, nhuộm, uốn và tạo kiểu bởi stylist được xác minh.',
    imageUrl: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 3,
    slug: 'spa',
    name: 'Spa & Massage',
    description: 'Liệu trình thư giãn và phục hồi cơ thể.',
    imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 4,
    slug: 'nails',
    name: 'Nail',
    description: 'Chăm sóc móng và thiết kế nail theo xu hướng.',
    imageUrl: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=900&q=85',
  },
  {
    id: 5,
    slug: 'skincare',
    name: 'Chăm sóc da',
    description: 'Liệu trình da mặt được cá nhân hóa.',
    imageUrl: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=900&q=85',
  },
];

export const DEFAULT_HOMEPAGE_SERVICES: BackendService[] = [
  {
    id: 101,
    name: 'Liệu trình Chăm Sóc Da Chuyên Sâu & Phục Hồi Bio-Hydra',
    description: 'Chăm sóc da chuyên sâu 12 bước với dưỡng chất tế bào gốc, làm dịu, phục hồi hàng rào bảo vệ da và cấp ẩm căng bóng tức thì.',
    price: 350000,
    originalPrice: 600000,
    durationMinutes: 60,
    imageUrl: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=900&q=85',
    categorySlug: 'skincare',
    categoryName: 'Chăm sóc da',
    supplierId: 1,
    supplierName: 'Venus Beauty Clinic & Spa',
    supplierBusinessType: 'Spa & Clinic',
    supplierAddress: '124 Nguyễn Trãi, Quận 1, TP. Hồ Chí Minh',
    district: 'Quận 1',
    supplierLatitude: 10.768,
    supplierLongitude: 106.69,
    supplierImageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
    rating: 4.9,
    supplierReviewCount: 342,
    highlightText: 'Tặng kèm mặt naga tinh chất vàng 24K',
    availableTodaySlots: ['09:00', '11:00', '14:30', '16:00', '18:30'],
    practitioners: [
      { id: 1, name: 'Nguyễn Thu Thảo', displayName: 'Thảo Nguyễn', specialty: 'Chuyên gia Trị liệu Da' },
      { id: 2, name: 'Trần Mai Lan', displayName: 'Mai Lan', specialty: 'Kỹ thuật viên Spa Cao cấp' },
    ],
  },
  {
    id: 102,
    name: 'Cắt, Uốn Phồng Chân Tóc & Phục Hồi Keratin Nano',
    description: 'Tạo kiểu tóc thời thượng chuẩn Hàn Quốc, bảo vệ tối đa cấu trúc tóc với tinh chất phục hồi nano keratin bóng mượt.',
    price: 450000,
    originalPrice: 750000,
    durationMinutes: 90,
    imageUrl: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=900&q=85',
    categorySlug: 'hair',
    categoryName: 'Làm tóc',
    supplierId: 2,
    supplierName: 'Pink Hair Lounge & Academy',
    supplierBusinessType: 'Hair Salon',
    supplierAddress: '45 Lê Văn Sỹ, Quận 3, TP. Hồ Chí Minh',
    district: 'Quận 3',
    supplierLatitude: 10.789,
    supplierLongitude: 106.678,
    supplierImageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80',
    rating: 4.85,
    supplierReviewCount: 215,
    highlightText: 'Sử dụng thuốc uốn hữu cơ không mùi',
    availableTodaySlots: ['10:00', '13:30', '15:30', '17:30', '19:00'],
    practitioners: [
      { id: 3, name: 'Lê Hoàng Tuấn', displayName: 'Master Tuấn', specialty: 'Nhà tạo mẫu tóc nghệ thuật' },
    ],
  },
  {
    id: 103,
    name: 'Nail Art Phong Cách Hàn Quốc & Chăm Sóc Móng OPI',
    description: 'Thiết kế móng nghệ thuật phong cách Hàn xẻng, đính đá xà cừ sang trọng kết hợp dưỡng móng phục hồi chuyên sâu.',
    price: 250000,
    originalPrice: 400000,
    durationMinutes: 45,
    imageUrl: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=900&q=85',
    categorySlug: 'nails',
    categoryName: 'Nail',
    supplierId: 3,
    supplierName: 'Rose Nails & Eyelashes',
    supplierBusinessType: 'Nail & Beauty Bar',
    supplierAddress: '88 Phan Xích Long, Phú Nhuận, TP. Hồ Chí Minh',
    district: 'Phú Nhuận',
    supplierLatitude: 10.798,
    supplierLongitude: 106.688,
    supplierImageUrl: 'https://images.unsplash.com/photo-1519014816548-bf7805542a1a?auto=format&fit=crop&w=600&q=80',
    rating: 4.95,
    supplierReviewCount: 180,
    highlightText: 'Bảo hành bong tróc sơn gel 10 ngày',
    availableTodaySlots: ['09:30', '11:30', '14:00', '16:00', '18:00', '20:00'],
    practitioners: [
      { id: 4, name: 'Vũ Mỹ Linh', displayName: 'Mỹ Linh', specialty: 'Nghệ nhân Nail Art' },
    ],
  },
  {
    id: 104,
    name: 'Trang Điểm Tiệc Nhẹ Tự Nhiên & Làm Tóc Đi Kèm',
    description: 'Phong cách trang điểm trong trẻo Glass-Skin, tôn đường nét tự nhiên và giữ nền lâu trôi suốt 12 tiếng không mốc nền.',
    price: 500000,
    originalPrice: 800000,
    durationMinutes: 60,
    imageUrl: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=900&q=85',
    categorySlug: 'makeup',
    categoryName: 'Trang điểm',
    supplierId: 4,
    supplierName: 'Glow Studio & Makeup Artist',
    supplierBusinessType: 'Makeup Studio',
    supplierAddress: '15 Mai Hắc Đế, Hai Bà Trưng, Hà Nội',
    district: 'Hai Bà Trưng',
    supplierLatitude: 21.012,
    supplierLongitude: 105.85,
    supplierImageUrl: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=600&q=80',
    rating: 5.0,
    supplierReviewCount: 96,
    highlightText: 'Mỹ phẩm chính hãng MAC, Dior, NARS',
    availableTodaySlots: ['08:30', '10:00', '13:00', '15:00', '17:00'],
    practitioners: [
      { id: 5, name: 'Đỗ Quỳnh Anh', displayName: 'Quỳnh Anh Makeup', specialty: 'Senior Makeup Artist' },
    ],
  },
  {
    id: 105,
    name: 'Massage Cổ Vai Gáy Đá Nóng Thảo Dược Thư Giãn',
    description: 'Giải tỏa đau nhức mỏi, đã thông kinh lạc với thảo dược thiên nhiên bí truyền và đá bazan núi lửa giữ nhiệt sâu.',
    price: 320000,
    originalPrice: 500000,
    durationMinutes: 60,
    imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=900&q=85',
    categorySlug: 'spa',
    categoryName: 'Spa & Massage',
    supplierId: 5,
    supplierName: 'Sen Vàng Therapy Spa',
    supplierBusinessType: 'Spa Trị Liệu',
    supplierAddress: '68 Hoàng Cầu, Đống Đa, Hà Nội',
    district: 'Đống Đa',
    supplierLatitude: 21.018,
    supplierLongitude: 105.822,
    supplierImageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
    rating: 4.88,
    supplierReviewCount: 260,
    highlightText: 'Tặng trà dưỡng nhan thảo mộc & ngâm chân',
    availableTodaySlots: ['11:00', '14:00', '16:00', '18:00', '20:30'],
    practitioners: [
      { id: 6, name: 'Bùi Thị Sen', displayName: 'KTV Thị Sen', specialty: 'Kỹ thuật viên Đông Y Dưỡng Sinh' },
    ],
  },
  {
    id: 106,
    name: 'Gội Đầu Dưỡng Sinh Trung Hoa & Massage Đầu Cổ',
    description: 'Quy trình 15 bước gội đầu thảo dược bồ kết cô đặc kết hợp massage bấm huyệt đả thông kinh lạc, trị mất ngủ và giảm rụng tóc.',
    price: 220000,
    originalPrice: 350000,
    durationMinutes: 75,
    imageUrl: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=900&q=85',
    categorySlug: 'spa',
    categoryName: 'Gội đầu dưỡng sinh',
    supplierId: 6,
    supplierName: 'Mộc Tâm Dưỡng Sinh Clinic',
    supplierBusinessType: 'Dưỡng Sinh Thảo Dược',
    supplierAddress: '32 Võ Văn Tần, Quận 3, TP. Hồ Chí Minh',
    district: 'Quận 3',
    supplierLatitude: 10.776,
    supplierLongitude: 106.691,
    supplierImageUrl: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=600&q=80',
    rating: 4.92,
    supplierReviewCount: 410,
    highlightText: 'Nước gội thảo dược đun tươi mỗi ngày',
    availableTodaySlots: ['09:00', '10:30', '12:00', '14:30', '16:30', '18:30'],
    practitioners: [
      { id: 7, name: 'Hoàng Ánh Tuyết', displayName: 'Ánh Tuyết', specialty: 'Chuyên gia Gội Đầu Dưỡng Sinh' },
    ],
  },
  {
    id: 107,
    name: 'Trị Mụn Y Khoa Chuẩn Da Liễu 14 Bước',
    description: 'Lấy nhân mụn vô khuẩn chuẩn y khoa, chiếu ánh sáng sinh học Blue-Light diệt khuẩn P.acnes, điện di tinh chất kháng viêm không để lại sẹo.',
    price: 490000,
    originalPrice: 850000,
    durationMinutes: 90,
    imageUrl: 'https://images.unsplash.com/photo-1512290900672-1f5be63fa7ba?auto=format&fit=crop&w=900&q=85',
    categorySlug: 'skincare',
    categoryName: 'Chăm sóc da',
    supplierId: 7,
    supplierName: 'Aura Derma Clinic',
    supplierBusinessType: 'Phòng Khám Da Liễu',
    supplierAddress: '198 Cầu Giấy, Cầu Giấy, Hà Nội',
    district: 'Cầu Giấy',
    supplierLatitude: 21.033,
    supplierLongitude: 105.795,
    supplierImageUrl: 'https://images.unsplash.com/photo-1512290900672-1f5be63fa7ba?auto=format&fit=crop&w=600&q=80',
    rating: 4.96,
    supplierReviewCount: 520,
    highlightText: 'Bác sĩ da liễu trực tiếp soi da và lên phác đồ',
    availableTodaySlots: ['10:00', '14:00', '16:30', '19:00'],
    practitioners: [
      { id: 8, name: 'Bác sĩ Lê Minh Tâm', displayName: 'BS. Minh Tâm', specialty: 'Bác sĩ Chuyên khoa Da liễu' },
    ],
  },
  {
    id: 108,
    name: 'Nối Mi Thiết Kế Baby Doll Tự Nhiên & Dưỡng Mi Collagen',
    description: 'Kỹ thuật nối mi từng sợi siêu nhẹ, không cộm ngứa, mắt to tròn tự nhiên giữ độ bền từ 4 - 6 tuần.',
    price: 280000,
    originalPrice: 450000,
    durationMinutes: 60,
    imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=85',
    categorySlug: 'nails',
    categoryName: 'Nail & Mi',
    supplierId: 8,
    supplierName: 'Lash & Brow Art Studio',
    supplierBusinessType: 'Eyelash & Brow Bar',
    supplierAddress: '56 Trần Quang Diệu, Đống Đa, Hà Nội',
    district: 'Đống Đa',
    supplierLatitude: 21.019,
    supplierLongitude: 105.823,
    supplierImageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80',
    rating: 4.87,
    supplierReviewCount: 165,
    highlightText: 'Sợi mi lông chồn lụa nhập khẩu Hàn Quốc',
    availableTodaySlots: ['09:00', '11:00', '13:30', '15:30', '17:30'],
    practitioners: [
      { id: 9, name: 'Nguyễn Bích Ngọc', displayName: 'Bích Ngọc', specialty: 'Chuyên viên Nối mi Nghệ thuật' },
    ],
  },
  {
    id: 109,
    name: 'Nhuộm Tóc Thời Trang & Phủ Bóng Collagen',
    description: 'Nhuộm các tông màu hot trend (nâu tây, xám khói, trà sữa) không cần tẩy tóc gắt gao, kết hợp phủ bóng collagen mềm mượt.',
    price: 650000,
    originalPrice: 1100000,
    durationMinutes: 120,
    imageUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=85',
    categorySlug: 'hair',
    categoryName: 'Làm tóc',
    supplierId: 9,
    supplierName: 'The Seoul Hair Salon',
    supplierBusinessType: 'Hair Salon',
    supplierAddress: '72 Nguyễn Thị Minh Khai, Quận 1, TP. Hồ Chí Minh',
    district: 'Quận 1',
    supplierLatitude: 10.778,
    supplierLongitude: 106.695,
    supplierImageUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
    rating: 4.91,
    supplierReviewCount: 290,
    highlightText: 'Thuốc nhuộm L’Oréal Paris chính hãng 100%',
    availableTodaySlots: ['10:30', '14:00', '16:00'],
    practitioners: [
      { id: 10, name: 'Kim Dong Wook', displayName: 'Stylist Dong Wook', specialty: 'Kỹ thuật viên Nhuộm Cao Cấp' },
    ],
  },
  {
    id: 110,
    name: 'Trang Điểm Cô Dâu & Mẹ Cô Dâu Ngày Cưới Sang Trọng',
    description: 'Trang điểm cô dâu tone cam đào hoặc hồng nude hoàng gia, dặm nền chống thấm nước 24h, tặng kèm son dặm và mấn cài tóc thủ công.',
    price: 1200000,
    originalPrice: 2000000,
    durationMinutes: 90,
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=85',
    categorySlug: 'makeup',
    categoryName: 'Trang điểm',
    supplierId: 10,
    supplierName: 'Luxury Bridal & Makeup',
    supplierBusinessType: 'Bridal Studio',
    supplierAddress: '104 Hàng Bông, Hoàn Kiếm, Hà Nội',
    district: 'Hoàn Kiếm',
    supplierLatitude: 21.031,
    supplierLongitude: 105.847,
    supplierImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    rating: 5.0,
    supplierReviewCount: 145,
    highlightText: 'Makeup tại nhà hoặc studio theo yêu cầu',
    availableTodaySlots: ['07:00', '09:30', '13:00', '15:30'],
    practitioners: [
      { id: 11, name: 'Hoàng Yến Chi', displayName: 'Yến Chi Bridal', specialty: 'Master Bridal Makeup Artist' },
    ],
  },
  {
    id: 111,
    name: 'Liệu Trình Nâng Cơ Trẻ Hóa Da HIFU Siêu Âm',
    description: 'Công nghệ sóng siêu âm hội tụ HIFU giúp nâng cơ thon gọn V-line, xóa mờ rãnh cười và kích thích tăng sinh collagen tầng sâu.',
    price: 1500000,
    originalPrice: 2800000,
    durationMinutes: 75,
    imageUrl: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=900&q=85',
    categorySlug: 'skincare',
    categoryName: 'Chăm sóc da',
    supplierId: 11,
    supplierName: 'Thẩm Mỹ Viện Quốc Tế Shiseido Care',
    supplierBusinessType: 'Thẩm Mỹ Viện',
    supplierAddress: '15 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
    district: 'Quận 1',
    supplierLatitude: 10.774,
    supplierLongitude: 106.704,
    supplierImageUrl: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=600&q=80',
    rating: 4.97,
    supplierReviewCount: 380,
    highlightText: 'Thấy rõ hiệu quả nâng cơ ngay sau 1 buổi',
    availableTodaySlots: ['11:00', '14:30', '17:00', '19:00'],
    practitioners: [
      { id: 12, name: 'Bác sĩ Đặng Quốc Bảo', displayName: 'BS. Quốc Bảo', specialty: 'Bác sĩ Thẩm mỹ Nội khoa' },
    ],
  },
  {
    id: 112,
    name: 'Combo Gội Đầu Thảo Dược + Massage Body Đá Nóng 90P',
    description: 'Trải nghiệm thư giãn toàn diện: 45 phút massage toàn thân giải tỏa căng thẳng kết hợp 45 phút gội đầu dưỡng sinh canh thuốc thảo dược bắc.',
    price: 390000,
    originalPrice: 650000,
    durationMinutes: 90,
    imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=900&q=85',
    categorySlug: 'spa',
    categoryName: 'Spa & Massage',
    supplierId: 12,
    supplierName: 'An Nhiên Dưỡng Sinh Đường',
    supplierBusinessType: 'Spa Trị Liệu',
    supplierAddress: '228 Phan Đăng Lưu, Phú Nhuận, TP. Hồ Chí Minh',
    district: 'Phú Nhuận',
    supplierLatitude: 10.803,
    supplierLongitude: 106.684,
    supplierImageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=600&q=80',
    rating: 4.89,
    supplierReviewCount: 312,
    highlightText: 'Miễn phí xông hơi đá muối Himalaya 15 phút',
    availableTodaySlots: ['10:00', '12:30', '15:00', '17:30', '19:30'],
    practitioners: [
      { id: 13, name: 'Trần Thị Hạnh', displayName: 'KTV Mỹ Hạnh', specialty: 'Kỹ thuật viên Trị liệu Cổ vai gáy' },
    ],
  },
];

let latestAuthentication = 0;
function startAuthentication() {
  const request = ++latestAuthentication, epoch = sessionCredentialEpoch();
  return (token: string, rememberMe = false) => {
    if (request !== latestAuthentication || epoch !== sessionCredentialEpoch()) throw new axios.CanceledError('Yêu cầu đăng nhập cũ đã bị hủy.');
    setAccessToken(token, rememberMe);
  };
}
export const beautyApi = {
  activePromotions: async (): Promise<import('../types/promotions').Promotion[]> => unwrap(apiClient.get('/v1/catalog/promotions')),
  async sessionActivity(): Promise<void> { await apiClient.post('/v1/auth/session/activity'); },
  async logoutSession(token: string): Promise<void> {
    await apiClient.post('/v1/auth/session/logout', {}, { headers: { Authorization: `Bearer ${token}` } });
  },
  // ==========================================
  // Auth & User Profile
  // ==========================================
  async login(identifier: string, password: string, rememberMe = false): Promise<{ user: any; accessToken: string }> {
    const accept = startAuthentication();
    const res = await unwrap<{ user: any; accessToken: string }>(
      apiClient.post('/v1/auth/login', { identifier, password })
    );
    if (res?.accessToken) {
      accept(res.accessToken, rememberMe);
    }
    return res;
  },

  async googleLogin(credential: string, rememberMe = false): Promise<{ user: any; accessToken: string }> {
    const accept = startAuthentication();
    const res = await unwrap<{ user: any; accessToken: string }>(apiClient.post('/v1/auth/google', { credential }));
    if (res?.accessToken) accept(res.accessToken, rememberMe);
    return res;
  },

  async startPasswordReset(identifier: string): Promise<{ challengeId: string; expiresInSeconds: number; message: string }> {
    return unwrap(apiClient.post('/v1/auth/password-reset/start', { identifier }));
  },

  async confirmPasswordReset(data: { challengeId: string; otpCode: string; newPassword: string }): Promise<{ message: string }> {
    return unwrap(apiClient.post('/v1/auth/password-reset/confirm', data));
  },

  async startRegistrationVerification(data: { phone: string; email: string; channel?: 'PHONE' | 'EMAIL' }): Promise<{ challengeId: string; expiresInSeconds: number; requiredChannels: string[] }> {
    return unwrap(apiClient.post('/v1/auth/registration-verification/start', data));
  },

  async confirmRegistrationVerification(data: { challengeId: string; phoneCode?: string; emailCode?: string }): Promise<{ registrationToken: string; expiresInSeconds: number }> {
    return unwrap(apiClient.post('/v1/auth/registration-verification/confirm', data));
  },

  async register(data: { fullName: string; phone: string; email: string; password: string; gender: 'MALE' | 'FEMALE' | 'OTHER'; dateOfBirth: string; verificationToken: string }, rememberMe = false): Promise<{ user: any; accessToken: string }> {
    const accept = startAuthentication();
    const res = await unwrap<{ user: any; accessToken: string }>(
      apiClient.post('/v1/auth/register', data)
    );
    if (res?.accessToken) {
      accept(res.accessToken, rememberMe);
    }
    return res;
  },

  async registerSupplier(data: any): Promise<{ auth: { accessToken: string; user: any }; supplier: any; user: any }> {
    const accept = startAuthentication();
    const response = await unwrap<{ auth: { accessToken: string; user: any }; supplier: any }>(
      apiClient.post('/v1/auth/register-supplier', data, { timeout: 30000 })
    );
    if (response?.auth?.accessToken) {
      accept(response.auth.accessToken);
    }
    return { ...response, user: response.auth.user };
  },

  async me(): Promise<any> {
    return unwrap(apiClient.get('/v1/auth/me'));
  },

  async updateCustomerAvatar(image: string): Promise<{ user: any; accessToken: string }> {
    const originalToken = getAccessToken();
    const res = await unwrap<{ user: any; accessToken: string }>(apiClient.patch('/v1/auth/me/avatar', { image }, { timeout: 30000 }));
    if (!originalToken || originalToken !== getAccessToken()) throw new axios.CanceledError('Phiên đã thay đổi. Vui lòng đăng nhập lại.');
    if (res?.accessToken) setAccessToken(res.accessToken);
    return res;
  },

  async updateCustomerProfile(data: {
    fullName?: string;
    phone?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    dateOfBirth?: string;
    confirmBookingContact?: boolean;
  }): Promise<{ user: any; accessToken: string }> {
    const originalToken = getAccessToken();
    const persistent = hasPersistentSession();
    const res = await unwrap<{ user: any; accessToken: string }>(apiClient.patch('/v1/auth/me/profile', data));
    if (!originalToken || originalToken !== getAccessToken()) throw new axios.CanceledError('Phiên đã thay đổi. Vui lòng đăng nhập lại.');
    if (res?.accessToken) setAccessToken(res.accessToken, persistent);
    return res;
  },

  // ==========================================
  // Locations & Categories
  // ==========================================
  async locations(parentId?: number): Promise<BackendLocation[]> {
    try {
      const res = await unwrap<BackendLocation[]>(
        apiClient.get('/v1/locations', { params: parentId ? { parentId } : {} })
      );
      return Array.isArray(res) ? res : [];
    } catch (error) {
      if (DEMO_FALLBACK_ENABLED) return DEFAULT_LOCATIONS;
      throw error;
    }
  },

  async categories(): Promise<BackendCategory[]> {
    try {
      const res = await unwrap<BackendCategory[]>(apiClient.get('/v1/categories'));
      const list = Array.isArray(res) ? res : [];
      return list.map((c) => ({
        ...c,
        imageUrl: getOptimizedImageUrl(c.imageUrl, 'category-thumb'),
      }));
    } catch (error) {
      if (DEMO_FALLBACK_ENABLED) return DEFAULT_CATEGORIES.map((c) => ({
        ...c,
        imageUrl: getOptimizedImageUrl(c.imageUrl, 'category-thumb'),
      }));
      throw error;
    }
  },

  // ==========================================
  // Services & Availability
  // ==========================================
  async services(categorySlug: string, locationId?: number): Promise<BackendService[]> {
    const allocation = await reviewAllocation();
    const mapServices = (list: BackendService[]) =>
      list.map((s) => ({
        ...presentationService(s, allocation),
        imageUrl: getOptimizedImageUrl(s.imageUrl, 'service-card'),
        supplierImageUrl: s.supplierImageUrl
          ? getOptimizedImageUrl(s.supplierImageUrl, 'salon-card')
          : s.supplierImageUrl,
      }));

    if (!categorySlug || categorySlug === 'all') {
      return this.homepageServices(locationId);
    }

    try {
      const res = await unwrap<BackendService[]>(
        apiClient.get(`/v1/categories/${categorySlug}/services`, {
          params: locationId ? { locationId } : {},
        })
      );
      if (Array.isArray(res)) return mapServices(res);
      return [];
    } catch (error) {
      if (!DEMO_FALLBACK_ENABLED) throw error;
      const filtered = DEFAULT_HOMEPAGE_SERVICES.filter((s) => {
        const target = categorySlug.toLowerCase();
        if (target === 'spa' && (s.categorySlug === 'spa')) return true;
        if (target === 'duong-sinh' || target === 'goi-dau-duong-sinh') {
          return s.categorySlug === 'spa' || s.name.toLowerCase().includes('gội đầu');
        }
        return s.categorySlug.toLowerCase() === target;
      });
      return mapServices(filtered.length > 0 ? filtered : DEFAULT_HOMEPAGE_SERVICES);
    }
  },

  async homepageServices(locationId?: number): Promise<BackendService[]> {
    const allocation = await reviewAllocation();
    const mapServices = (list: BackendService[]) =>
      list.map((s) => ({
        ...presentationService(s, allocation),
        imageUrl: getOptimizedImageUrl(s.imageUrl, 'service-card'),
        supplierImageUrl: s.supplierImageUrl
          ? getOptimizedImageUrl(s.supplierImageUrl, 'salon-card')
          : s.supplierImageUrl,
      }));

    try {
      const res = await unwrap<BackendService[]>(
        apiClient.get('/v1/homepage/services', {
          params: locationId ? { locationId } : {},
        })
      );
      return Array.isArray(res) ? mapServices(res) : [];
    } catch (error) {
      if (DEMO_FALLBACK_ENABLED) return mapServices(DEFAULT_HOMEPAGE_SERVICES);
      throw error;
    }
  },

  async availability(serviceId: number, practitionerId: number, date: string): Promise<{ availableSlots: string[] }> {
    try {
      const res = await unwrap<{ availableSlots: string[] }>(
        apiClient.get(`/v1/services/${serviceId}/availability`, {
          params: { practitionerId, date },
        })
      );
      return { availableSlots: Array.isArray(res?.availableSlots) ? res.availableSlots : [] };
    } catch (error) {
      if (DEMO_FALLBACK_ENABLED) {
        return { availableSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'] };
      }
      throw error;
    }
  },

  async serviceCapacity(serviceId: number, date: string): Promise<import('../types/beauty').ServiceCapacity> {
    return unwrap(apiClient.get(`/v1/services/${serviceId}/capacity`, { params: { date } }));
  },

  // ==========================================
  // Bookings (Customer)
  // ==========================================
  async createBooking(data: {
    serviceId: number;
    practitionerId?: number;
    appointmentDate: string;
    startTime: string;
    note?: string;
  }): Promise<BackendBooking> {
    return unwrap(apiClient.post('/v1/bookings', data));
  },

  async myBookings(): Promise<BackendBooking[]> {
    return unwrap(apiClient.get('/v1/bookings/mine'));
  },
  async myBooking(id: number): Promise<BackendBooking> {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Không xác định được lịch hẹn.');
    return unwrap(apiClient.get(`/v1/bookings/${id}`));
  },

  async publicBookingReviews(targetType: 'SERVICE' | 'SUPPLIER', id: number, page = 0): Promise<PublicReviewPage> {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Không xác định được đối tượng đánh giá.');
    const resource = targetType === 'SERVICE' ? 'services' : 'suppliers';
    return unwrap(apiClient.get(`/v1/${resource}/${id}/reviews`, { params: { page, size: 20 } }));
  },
  async publicSupplierServices(id: number): Promise<BackendService[]> {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Không xác định được nhà cung cấp.');
    const shop = await unwrap<{ services: BackendService[] }>(apiClient.get(`/v1/suppliers/${id}`));
    const allocation = await reviewAllocation();
    return shop.services.map(service => presentationService(service, allocation));
  },

  async completeBooking(id: number): Promise<BackendBooking> {
    return unwrap(apiClient.patch(`/v1/bookings/${id}/complete`));
  },

  async upsertBookingReview(id: number, target: 'SERVICE' | 'SUPPLIER', data: { rating: number; comment: string; images?: string[] }): Promise<BookingReview> {
    return unwrap(apiClient.put(`/v1/bookings/${id}/reviews/${target}`, data, { timeout: 60000 }));
  },

  async cancelBooking(id: number): Promise<BackendBooking> {
    return unwrap(apiClient.patch(`/v1/bookings/${id}/cancel`));
  },

  async createPayOSPayment(
    bookingId: number,
    data: { paymentOption: PaymentOption; voucherCode?: string },
    onRecovery?: () => void,
  ): Promise<PayOSPayment> {
    const token = getAccessToken(), epoch = sessionCredentialEpoch();
    const observe = async (request: () => Promise<{ data: PayOSPayment }>) => {
      const started = performance.now(); const payment = await unwrap(request());
      if (token === getAccessToken() && epoch === sessionCredentialEpoch()) rememberPaymentObservation(payment, started, token, epoch);
      return payment;
    };
    return createWithRecovery(bookingId,
      () => observe(() => apiClient.post(`/v1/payments/payos/bookings/${bookingId}`, data, { timeout: PAYMENT_HTTP_TIMEOUT })),
      () => observe(() => apiClient.get(`/v1/payments/payos/bookings/${bookingId}/current`, { timeout: PAYMENT_HTTP_TIMEOUT })),
      () => token === getAccessToken() && epoch === sessionCredentialEpoch(), undefined, onRecovery);
  },

  async servicePaymentQuote(serviceId: number, paymentOption: Exclude<PaymentOption, 'DEPOSIT_50'>, voucherCode?: string): Promise<PaymentQuote> {
    return unwrap(apiClient.get(`/v1/services/${serviceId}/payment-quote`, { params: { paymentOption, voucherCode } }));
  },

  async bookingPaymentQuote(bookingId: number, paymentOption: Exclude<PaymentOption, 'DEPOSIT_50'>, voucherCode?: string): Promise<PaymentQuote> {
    return unwrap(apiClient.get(`/v1/payments/payos/bookings/${bookingId}/quote`, { params: { paymentOption, voucherCode } }));
  },

  async currentBookingPayment(bookingId: number): Promise<PayOSPayment> {
    return unwrap(apiClient.get(`/v1/payments/payos/bookings/${bookingId}/current`, { timeout: PAYMENT_HTTP_TIMEOUT }));
  },

  async payOSPaymentStatus(orderCode: string, signal?: AbortSignal): Promise<PayOSPayment> {
    const token = getAccessToken(), epoch = sessionCredentialEpoch(), started = performance.now();
    const payment = await unwrap<PayOSPayment>(apiClient.get(`/v1/payments/payos/${encodeURIComponent(orderCode)}`, { signal, timeout: PAYMENT_HTTP_TIMEOUT }));
    if (token === getAccessToken() && epoch === sessionCredentialEpoch()) rememberPaymentObservation(payment, started, token, epoch);
    return payment;
  },

  // ==========================================
  // Supplier Portal
  // ==========================================
  async supplierProfile(): Promise<BackendSupplierProfile> {
    const profile = await unwrap<any>(apiClient.get('/v1/supplier/profile'));
    return { ...profile, address: profile.addressLine };
  },

  async updateSupplierProfile(data: Partial<BackendSupplierProfile>): Promise<BackendSupplierProfile> {
    const profile = await unwrap<any>(apiClient.put('/v1/supplier/profile', {
      name: data.name,
      businessType: data.businessType,
      description: data.description || null,
      addressLine: data.address || data.addressLine,
      imageUrl: data.imageUrl,
      latitude: data.latitude,
      longitude: data.longitude,
    }, { timeout: 30000 }));
    return { ...profile, address: profile.addressLine };
  },

  async supplierPractitioners(): Promise<BackendPractitioner[]> {
    return unwrap(apiClient.get('/v1/supplier/practitioners'));
  },

  async updatePractitionerAssignments(id: number, serviceIds: number[]): Promise<BackendPractitioner> {
    return unwrap(apiClient.put(`/v1/supplier/practitioners/${id}/assignments`, { serviceIds }));
  },

  async updatePractitionerStatus(id: number, active: boolean): Promise<BackendPractitioner> {
    return unwrap(apiClient.put(`/v1/supplier/practitioners/${id}/status`, { active }));
  },

  async createPractitioner(data: { name: string; specialty?: string; bio?: string; avatarUrl?: string }): Promise<BackendPractitioner> {
    return unwrap(apiClient.post('/v1/supplier/practitioners', { ...data, displayName: data.name }, { timeout: 30000 }));
  },

  async updatePractitioner(id: number, data: { name: string; specialty?: string; bio?: string; avatarUrl?: string }): Promise<BackendPractitioner> {
    return unwrap(apiClient.put(`/v1/supplier/practitioners/${id}`, { ...data, displayName: data.name }, { timeout: 30000 }));
  },

  async practitionerSchedule(practitionerId: number): Promise<ScheduleRule[]> {
    const rules = await unwrap<BackendScheduleRule[]>(apiClient.get(`/v1/supplier/practitioners/${practitionerId}/schedule`));
    return rules.map(fromBackendSchedule);
  },

  async replaceSchedule(practitionerId: number, rules: ScheduleRule[]): Promise<ScheduleRule[]> {
    const saved = await unwrap<BackendScheduleRule[]>(apiClient.put(`/v1/supplier/practitioners/${practitionerId}/schedule`, {
      rules: rules.map(toBackendSchedule),
    }));
    return saved.map(fromBackendSchedule);
  },

  async supplierServices(): Promise<BackendService[]> {
    const services = await unwrap<any[]>(apiClient.get('/v1/supplier/services'));
    return services.map((service) => ({
      ...service,
      supplierId: 0,
      supplierName: '',
      supplierAddress: '',
      supplierBusinessType: '',
      supplierReviewCount: 0,
      rating: 0,
    }));
  },

  async createSupplierService(data: any): Promise<BackendService> {
    return unwrap(apiClient.post('/v1/supplier/services', { ...data, active: true }, { timeout: 30000 }));
  },

  async updateSupplierService(id: number, data: any): Promise<BackendService> {
    return unwrap(apiClient.put(`/v1/supplier/services/${id}`, { ...data, active: true }, { timeout: 30000 }));
  },

  async deactivateSupplierService(id: number): Promise<void> {
    return unwrap(apiClient.delete(`/v1/supplier/services/${id}`));
  },

  async supplierBookings(): Promise<BackendBooking[]> {
    const [originals, history] = await Promise.all([
      unwrap<BackendBooking[]>(apiClient.get('/v1/bookings/supplier')),
      unwrap<Array<AdminBooking & { serviceId: number }>>(apiClient.get('/v1/supplier/presentation-bookings')),
    ]);
    const rows = new Map<number, BackendBooking>((history ?? []).map(booking => [booking.id, { ...booking,
      reviewEligible: false, completionEligible: false, cancelEligible: false, paymentEligible: false,
      paymentBlockerReason: 'BOOKING_READ_ONLY', paymentAmount: null, paymentRemainingAmount: null, paymentAttemptActive: false }]));
    originals.forEach(booking => rows.set(booking.id, booking));
    return [...rows.values()].sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate) || b.startTime.localeCompare(a.startTime));
  },

  // ==========================================
  // Reports / Support
  // ==========================================
  async reports(): Promise<BackendReport[]> {
    return unwrap(apiClient.get('/v1/reports'));
  },

  async updateReport(id: number, status: string, resolutionNote?: string): Promise<BackendReport> {
    return unwrap(apiClient.patch(`/v1/reports/${id}`, { status, resolutionNote }));
  },

  async createReport(data: { targetType: string; targetId: number; reason: string; details: string }): Promise<BackendReport> {
    return unwrap(apiClient.post('/v1/reports', data));
  },

  // ==========================================
  // Admin / Customer accounts
  // ==========================================
  async adminCustomers(params?: { from?: string; to?: string; bookedOnly?: boolean; includeDemo?: boolean }): Promise<AdminCustomer[]> {
    const customers = await unwrap<AdminCustomer[]>(apiClient.get('/v1/admin/customers', { params }));
    const snapshot = await adminPresentationData(params);
    return snapshot ? presentationCustomers(snapshot, params) : customers;
  },

  async exportAdminCustomers(): Promise<Blob> {
    const snapshot = await adminPresentationData();
    if (snapshot) return presentationCustomerCsv(snapshot);
    return (await apiClient.get('/v1/admin/customers/export', { responseType: 'blob' })).data;
  },

  async adminDashboardSummary(params: { from: string; to: string; includeDemo: boolean }): Promise<AdminDashboardSummary> {
    return unwrap(apiClient.get('/v1/admin/dashboard/summary', { params }));
  },

  async adminPaymentSummary(params: { from: string; to: string; includeDemo: boolean }): Promise<AdminPaymentSummary> {
    return unwrap(apiClient.get('/v1/admin/dashboard/payments', { params }));
  },

  async adminRevenue(params: { from: string; to: string; includeDemo: boolean; page: number; size: number }): Promise<AdminPage<AdminRevenueRow>> {
    return unwrap(apiClient.get('/v1/admin/dashboard/revenue', { params }));
  },

  async exportAdminRevenueCsv(params: { from: string; to: string; includeDemo: boolean }): Promise<Blob> {
    // The revenue JSON endpoint already powers the table. Build the CSV from
    // its paginated, admin-authorized rows so exports also work with backend
    // versions whose streaming CSV response fails during async dispatch.
    const csvCell = (value: string | number) => {
      let safe = String(value ?? '');
      if (/^\s*[=+\-@]/.test(safe) || /^[\t\r\n]/.test(safe)) safe = `'${safe}`;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const vietnamTime = (value: string) => {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      }).formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]));
      return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
    };
    const lines = ['paid_at_vietnam,booking_code,partner,service,payment_option,online_amount_vnd,remaining_at_salon_vnd,payment_id'];
    for (let page = 0; ; page += 1) {
      const batch = await beautyApi.adminRevenue({ ...params, page, size: 500 });
      for (const row of batch.content) {
        lines.push([
          vietnamTime(row.paidAt), row.bookingCode, row.supplierName, row.serviceName,
          row.paymentOption, row.amount, row.remainingAtSalon, row.paymentId,
        ].map(csvCell).join(','));
      }
      if (page + 1 >= batch.totalPages) break;
    }
    return new Blob(['\uFEFF', lines.join('\r\n'), '\r\n'], { type: 'text/csv;charset=utf-8' });
  },

  async adminBookings(params: {
    from: string; to: string; includeDemo: boolean; status?: string; paymentStatus?: string;
    query?: string; page?: number; size?: number;
  }): Promise<AdminPage<AdminBooking>> {
    const rows = await unwrap<AdminPage<AdminBooking>>(apiClient.get('/v1/admin/bookings', { params }));
    const snapshot = await adminPresentationData(params);
    return snapshot ? presentationPage(presentationBookings({ ...snapshot, bookings: mergePresentationBookings(snapshot.bookings, rows.content) }, params), params.page, params.size) : rows;
  },

  async exportAdminBookingsCsv(params: { from: string; to: string; status?: string; paymentStatus?: string; query?: string }, isCurrent: () => boolean): Promise<Blob> {
    const token = getAccessToken(), epoch = sessionCredentialEpoch();
    const guard = () => { if (!token || token !== getAccessToken() || epoch !== sessionCredentialEpoch() || sessionSnapshot().phase !== 'verified' || !isCurrent()) throw new Error('Đã hủy tải vì bộ lọc hoặc phiên đăng nhập thay đổi.'); };
    guard();
    const snapshot = await adminPresentationData(params); guard();
    // Reuse the same merged source, display profiles, filters and ordering as the booking table.
    const rows = snapshot ? presentationBookings(snapshot, params) : await readAdminPages<AdminBooking>('/v1/admin/bookings', { ...params, includeDemo: false }, guard);
    guard(); const blob = bookingRowsCsv(rows); guard(); return blob;
  },

  async adminBooking(id: number): Promise<AdminBooking> {
    if (isPresentationBooking(id)) {
      const row = (await adminPresentationData())?.bookings.find(booking => booking.id === id);
      if (row) return row;
    }
    const row: AdminBooking = await unwrap(apiClient.get(`/v1/admin/bookings/${id}`));
    const snapshot = await adminPresentationData();
    return { ...row, customerName: snapshot?.users.find(user => user.id === row.customerId)?.fullName ?? row.customerName };
  },

  async adminCustomerBookings(customerId: number, page = 0): Promise<AdminPage<AdminBooking>> {
    const snapshot = await adminPresentationData();
    if (snapshot && isPresentationUser(customerId)) return presentationPage(presentationBookings(snapshot, { customerId }), page);
    if (snapshot) {
      const originals = await readAdminPages<AdminBooking>(`/v1/admin/customers/${customerId}/bookings`);
      return presentationPage(presentationBookings({ ...snapshot, bookings: mergePresentationBookings(snapshot.bookings, originals) }, { customerId }), page);
    }
    return unwrap(apiClient.get(`/v1/admin/customers/${customerId}/bookings`, { params: { page, size: 20 } }));
  },

  // ==========================================
  // Mock fallback endpoints (preserved for offline/cache)
  // ==========================================
  async getHotDeals(category?: string): Promise<HotDeal[]> {
    return cache.getOrFetch(`hot_deals_${category || 'all'}`, () => {
      if (!category || category === 'all') return HOT_DEALS;
      return HOT_DEALS.filter((d) => d.category.toLowerCase() === category.toLowerCase());
    }, 15 * 60 * 1000);
  },

  async getNearbySalons(category?: string): Promise<Salon[]> {
    return cache.getOrFetch(`nearby_salons_${category || 'all'}`, () => {
      if (!category || category === 'all') return NEARBY_SALONS;
      return NEARBY_SALONS.filter((s) => s.category === category);
    }, 15 * 60 * 1000);
  },

  async getNewPartners(): Promise<NewPartner[]> {
    return cache.getOrFetch('new_partners', () => NEW_PARTNERS, 30 * 60 * 1000);
  },

  async getCategories(): Promise<CategoryItem[]> {
    return cache.getOrFetch('categories', () => CATEGORIES, 60 * 60 * 1000);
  },

  async getVouchers(): Promise<Voucher[]> {
    return cache.getOrFetch('vouchers', () => VOUCHERS, 30 * 60 * 1000);
  },

  async getCities(): Promise<CityDestination[]> {
    return cache.getOrFetch('cities', () => CITIES, 60 * 60 * 1000);
  },

  async submitBooking(data: unknown): Promise<{ success: boolean; data: BookingDetails }> {
    const validated = BookingSchema.parse(data);
    const bookingRecord: BookingDetails = {
      ...validated,
      bookingCode: `BL-${Date.now().toString(36).toUpperCase()}`,
      status: 'confirmed',
      createdAt: Date.now(),
    };
    return { success: true, data: bookingRecord };
  },
};
