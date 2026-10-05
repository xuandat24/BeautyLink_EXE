import { z } from 'zod';

// ==========================================
// User & Auth Types
// ==========================================

export type UserRole = 'CUSTOMER' | 'SUPPLIER' | 'STAFF' | 'ADMIN';

export interface CurrentUser {
  id?: number | string;
  name: string;
  phone?: string;
  email?: string;
  avatar?: string;
  role: UserRole;
  memberTier?: 'Standard' | 'Silver' | 'Gold' | 'VIP' | string;
  loyaltyPoints?: number;
  points?: number;
  address?: string;
  citizenId?: string; // Số CCCD / CMND
  gender?: 'Nam' | 'Nữ' | 'Khác' | string;
  dateOfBirth?: string; // Ngày sinh
}

// ==========================================
// Backend Entity Types (from Railway API)
// ==========================================

export interface BackendCategory {
  id: number;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
}

export interface BackendPractitioner {
  id: number;
  name?: string;
  displayName?: string;
  specialty?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface BackendService {
  id: number;
  categoryId?: number;
  name: string;
  description?: string | null;
  price: number;
  originalPrice?: number;
  durationMinutes: number;
  imageUrl: string;
  categorySlug: string;
  categoryName?: string;
  featured?: boolean;
  rating: number;
  supplierId: number;
  supplierName: string;
  supplierAddress: string;
  supplierImageUrl?: string;
  supplierBusinessType: string;
  supplierReviewCount: number;
  supplierLatitude?: number | null;
  supplierLongitude?: number | null;
  supplierNearbyFeatured?: boolean;
  supplierNewPartner?: boolean;
  highlightText?: string;
  practitioners?: BackendPractitioner[];
  district?: string;
  availableTodaySlots?: string[];
}

export interface BackendLocation {
  id: number;
  name: string;
  slug: string;
  type: string;
  parentId?: number | null;
}

export interface ScheduleRule {
  id?: number;
  dayOfWeek: number; // 1 = Monday ... 7 = Sunday
  dayName?: string;
  isWorking: boolean;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  breakStartTime?: string | null;
  breakEndTime?: string | null;
  slotDurationMinutes: number;
}

export interface BackendBooking {
  id: number;
  bookingCode: string;
  serviceId: number;
  serviceName: string;
  supplierId: number;
  supplierName: string;
  practitionerId?: number;
  practitionerName: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  price?: number;
  totalAmount: number;
  status: 'CONFIRMED' | 'PENDING' | 'COMPLETED' | 'CANCELLED';
  note?: string;
  createdAt?: string;
  serviceImageUrl?: string | null;
  supplierImageUrl?: string | null;
  supplierAddress?: string | null;
  paymentStatus?: 'SIMULATED' | 'UNPAID' | 'PAID' | 'REFUNDED';
  reviewEligible?: boolean;
}

export interface BackendSupplierProfile {
  id: number;
  userId: number;
  name: string;
  businessType: string;
  locationId: number;
  address: string;
  addressLine?: string;
  imageUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
  specialty?: string;
  description?: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
}

export interface BackendReport {
  id: number;
  bookingId?: number;
  targetType: string;
  targetId: number;
  userId?: number;
  reporterName: string;
  reason: string;
  details: string;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
  resolutionNote?: string;
  createdAt: string;
}

// ==========================================
// Frontend Domain Entity Interfaces
// ==========================================

export interface HotDeal {
  id: string;
  serviceId?: number;
  title: string;
  brandName: string;
  brandLogo: string;
  image: string;
  originalPrice: number;
  salePrice: number;
  discountPercent: number;
  isNew?: boolean;
  rating: number;
  reviewsCount: number;
  duration: string;
  category: string;
  highlightText: string;
  distanceKm?: number;
  district?: string;
}

export interface Salon {
  id: string;
  serviceId?: number;
  name: string;
  category: 'spa' | 'tham-my-vien' | 'clinic' | 'massage' | 'nail' | 'salon-toc' | string;
  categoryLabel: string;
  address: string;
  district: string;
  distanceKm: number;
  rating: number;
  reviewsCount: number;
  image: string;
  logo: string;
  badge?: string;
  isFeatured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  hasExactDistance?: boolean;
}

export interface NewPartner {
  id: string;
  serviceId?: number;
  name: string;
  subTitle: string;
  address: string;
  image: string;
  logo: string;
  specialty: string;
  promoNotice: string;
}

export interface CityDestination {
  id: string;
  name: string;
  count: string;
  image: string;
}

export interface Voucher {
  code: string;
  title: string;
  discount: string;
  minOrder: string;
  expiry: string;
  tag: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  icon: string;
  count: string;
}

export interface CustomerReview {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  service: string;
  salon: string;
  content: string;
  date: string;
}

export interface CartItem {
  deal: HotDeal;
  quantity: number;
}

export interface BookingDetails {
  id?: string;
  serviceTitle: string;
  salonName: string;
  price: number;
  originalPrice: number;
  date: string;
  timeSlot: string;
  customerName: string;
  customerPhone: string;
  specialist?: string;
  note?: string;
  bookingCode?: string;
  status?: 'confirmed' | 'pending' | 'completed' | 'cancelled';
  createdAt?: number;
  paymentTime?: string; // Thời gian thanh toán tiền ngay dưới số tiền
  paidAmount?: number;
  remainingAmount?: number;
  depositType?: 'deposit50' | 'full100';
  paymentMethod?: string;
}

// ==========================================
// Zod Validation Schemas
// ==========================================

export const BookingSchema = z.object({
  serviceTitle: z.string().min(2, 'Tên dịch vụ không được để trống'),
  salonName: z.string().min(2, 'Tên cơ sở không được để trống'),
  price: z.number().positive('Giá tiền phải lớn hơn 0'),
  originalPrice: z.number().positive(),
  date: z.string().min(1, 'Vui lòng chọn ngày hẹn'),
  timeSlot: z.string().min(1, 'Vui lòng chọn khung giờ hẹn'),
  customerName: z.string().min(2, 'Tên người đặt phải từ 2 ký tự trở lên'),
  customerPhone: z
    .string()
    .regex(/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/, 'Số điện thoại không đúng định dạng Việt Nam'),
  specialist: z.string().optional(),
  note: z.string().max(300, 'Ghi chú tối đa 300 ký tự').optional(),
});

export const UserAuthSchema = z.object({
  name: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự').optional(),
  phone: z
    .string()
    .regex(/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/, 'Số điện thoại không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải từ 6 ký tự trở lên'),
});

export type BookingInput = z.infer<typeof BookingSchema>;
export type UserAuthInput = z.infer<typeof UserAuthSchema>;

export interface SearchFilters {
  priceRange: 'all' | 'under-300' | '300-800' | 'over-800';
  minRating: number; // 0 for all, or 4.0, 4.5, 4.8
  maxDistance: number; // 0 for all, or 2, 5, 10 (in km)
}
