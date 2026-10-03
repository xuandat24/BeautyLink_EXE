import { z } from 'zod';

// ==========================================
// Domain Entity Interfaces
// ==========================================

export interface HotDeal {
  id: string;
  serviceId?: number;
  supplierId?: number;
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
  supplierId?: number;
  serviceId?: number;
  name: string;
  category: 'spa' | 'tham-my-vien' | 'clinic' | 'massage' | 'nail' | 'salon-toc';
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
  supplierId?: number;
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
}

export interface CurrentUser {
  id?: number;
  name: string;
  phone: string;
  email?: string;
  role?: 'CUSTOMER' | 'SUPPLIER' | 'STAFF' | 'ADMIN';
  avatar?: string;
  loyaltyPoints?: number;
  memberTier?: 'Standard' | 'Silver' | 'Gold' | 'VIP';
}

// ==========================================
// Zod Validation Schemas (Strict Data Validation)
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
