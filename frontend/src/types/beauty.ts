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
  bookingContactConfirmed?: boolean;
  loyaltyPoints?: number;
  points?: number;
  address?: string;
  citizenId?: string; // Số CCCD / CMND
  gender?: 'Nam' | 'Nữ' | 'Others' | string;
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
  active?: boolean;
  serviceAssignmentsRestricted?: boolean;
  supportedServiceIds?: number[];
}

export interface ServiceCapacity {
  date: string;
  qualifiedPractitioners: number;
  slots: { time: string; availablePractitioners: number; state: 'AVAILABLE' | 'FULLY_BOOKED' }[];
  reason: 'NO_QUALIFIED_PRACTITIONER' | 'OUTSIDE_WORKING_HOURS' | null;
}

export interface BackendService {
  id: number;
  active?: boolean;
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
  serviceReviewCount?: number;
  bookedOrCompletedCount?: number;
  supplierRating?: number;
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
  paymentStatus?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
  reviewEligible?: boolean;
  completionEligible?: boolean;
  cancelEligible?: boolean;
  paymentEligible?: boolean;
  paymentBlockerReason?: string | null;
  paymentOption?: PaymentOption | null;
  paymentVoucherCode?: string | null;
  paymentAttemptActive?: boolean;
  paymentAmount?: number | null;
  paymentRemainingAmount?: number | null;
  serviceReview?: BookingReview | null;
  supplierReview?: BookingReview | null;
}

export interface BookingReview {
  id: number;
  bookingId: number;
  targetType: 'SERVICE' | 'SUPPLIER';
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayOSPayment {
    instructionsFreshForMs?: number;
  checkoutAllowed?: boolean;
  verificationPending?: boolean;
  qrCode?: string | null;
  bankBin?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  transferDescription?: string | null;
  bookingId: number;
  bookingCode: string;
  orderCode: number;
  paymentLinkId?: string | null;
  checkoutUrl: string | null;
  amount: number;
  remainingAmount: number;
  paymentOption: PaymentOption;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED' | 'FAILED' | 'REVIEW_REQUIRED';
  requiresManualReview: boolean;
  expiresAt: string;
}

export type PaymentOption = 'DEPOSIT_50' | 'DEPOSIT_05' | 'FULL_100';

export interface PaymentQuote {
  originalAmount: number;
  discountAmount: number;
  payableAmount: number;
  amount: number;
  remainingAmount: number;
  paymentOption: PaymentOption;
  paymentAvailable: boolean;
  unavailableReason: 'PAYMENT_UNAVAILABLE_ZERO' | 'DEPOSIT_TOO_LOW_USE_FULL_PAYMENT' | 'PAYMENT_UNAVAILABLE_AMOUNT_TOO_LOW' | null;
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

export interface AdminCustomer {
  id: number;
  fullName: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  dateOfBirth: string | null;
  phone: string;
  email: string;
  bookingsPlaced: number;
  paidBookings: number;
  completedBookings: number;
  lastBookingAt: string | null;
  totalVerifiedOnlineAmount: number;
}

export interface AdminDateRange {
  fromDate: string;
  toDate: string;
  timezone: string;
  includeDemo: boolean;
}

export interface AdminBooking {
  id: number;
  bookingCode: string;
  customerId: number;
  customerName: string;
  customerPhone: string;
  supplierId: number;
  supplierName: string;
  serviceName: string;
  practitionerName: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
  createdAt: string;
  verifiedPaymentOption: PaymentOption | null;
  verifiedOnlineAmount: number | null;
  remainingAtSalon: number | null;
  verifiedPaidAt: string | null;
  paymentReviewRequired: boolean;
}

export interface AdminPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface AdminDashboardSummary {
  range: AdminDateRange;
  registeredCustomers: number;
  customersWhoBooked: number;
  totalBookings: number;
  paidBookingCustomers: number;
  verifiedPaidBookings: number;
  upcomingBookings: number;
  reconciliationIssues: number;
  completedBookings: number;
  cancelledBookings: number;
  repeatCustomers: number;
  bookingToPaymentConversion: number;
  generatedAt: string;
  bookingTrends: Array<{ date: string; bookings: number; uniqueCustomers: number }>;
  recentBookings: AdminBooking[];
}

export interface AdminPaymentSummary {
  range: AdminDateRange;
  verifiedOnlineCollected: number;
  verifiedDeposits: number;
  verifiedFullPayments: number;
  remainingAtSalon: number;
  verifiedPaymentBookings: number;
  depositBookings: number;
  fullPaymentBookings: number;
  reconciliationIssues: number;
  generatedAt: string;
}

export interface AdminRevenueRow {
  paymentId: number;
  paidAt: string;
  bookingCode: string;
  supplierName: string;
  serviceName: string;
  paymentOption: 'DEPOSIT_05' | 'DEPOSIT_50' | 'FULL_100';
  amount: number;
  remainingAtSalon: number;
}

// ==========================================
// Frontend Domain Entity Interfaces
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
  serviceId?: number;
  supplierId?: number;
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
  supplierId?: number;
  serviceId?: number;
  rating?: number;
  reviewsCount?: number;
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
  depositType?: 'deposit05' | 'deposit50' | 'full100';
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
  password: z.string().min(8, 'Mật khẩu phải từ 8 ký tự trở lên'),
});

export type BookingInput = z.infer<typeof BookingSchema>;
export type UserAuthInput = z.infer<typeof UserAuthSchema>;

export interface SearchFilters {
  priceRange: 'all' | 'under-300' | '300-800' | 'over-800';
  minRating: number; // 0 for all, or 4.0, 4.5, 4.8
  maxDistance: number; // 0 for all, or 2, 5, 10 (in km)
}
