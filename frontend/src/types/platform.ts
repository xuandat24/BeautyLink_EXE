export type UserRole = 'CUSTOMER' | 'SUPPLIER' | 'STAFF' | 'ADMIN';

export interface ApiUser {
  id: number;
  fullName: string;
  phone: string;
  email?: string | null;
  role: UserRole;
  loyaltyPoints: number;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresInMs: number;
  user: ApiUser;
}

export interface SupplierProfile {
  id: number;
  name: string;
  slug: string;
  businessType: string;
  description?: string | null;
  locationId: number;
  locationName: string;
  addressLine: string;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  rating: number;
  reviewCount: number;
}

export interface SupplierRegistrationResponse {
  auth: AuthResponse;
  supplier: SupplierProfile;
}

export interface SupplierRegistrationRequest {
  ownerName: string;
  phone: string;
  email: string;
  password: string;
  businessName: string;
  businessType: string;
  locationId: number;
  addressLine: string;
  description?: string;
  specialty?: string;
  cccdNumber: string;
  cccdFrontImage: string;
  cccdBackImage: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
}

export interface LocationOption {
  id: number;
  name: string;
  slug: string;
  type: 'PROVINCE_CITY' | 'DISTRICT' | 'WARD_COMMUNE';
  parentId: number | null;
}

export interface ServiceCategory {
  id: number;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
}

export interface Practitioner {
  id: number;
  displayName: string;
  specialty: string;
  avatarUrl?: string | null;
  bio?: string | null;
}

export interface BeautyService {
  id: number;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  imageUrl: string;
  categorySlug: string;
  supplierId: number;
  supplierName: string;
  supplierAddress: string;
  rating: number;
  practitioners: Practitioner[];
  originalPrice: number;
  highlightText?: string | null;
  featured: boolean;
  supplierImageUrl?: string | null;
  supplierBusinessType: string;
  supplierReviewCount: number;
  supplierDemo: boolean;
  supplierNearbyFeatured: boolean;
  supplierNewPartner: boolean;
  supplierLatitude?: number | null;
  supplierLongitude?: number | null;
}

export interface SupplierService {
  id: number;
  categoryId: number;
  categorySlug: string;
  categoryName: string;
  name: string;
  description?: string | null;
  price: number;
  originalPrice?: number | null;
  durationMinutes: number;
  imageUrl?: string | null;
  active: boolean;
}

export interface SupplierServicePayload {
  categoryId: number;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number | null;
  durationMinutes: number;
  imageUrl?: string | null;
  active: boolean;
}

export interface BookingRecord {
  id: number;
  bookingCode: string;
  serviceName: string;
  supplierName: string;
  practitionerName: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'SIMULATED' | 'PAID' | 'REFUNDED';
}

export interface ScheduleRule {
  id?: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  slotMinutes: number;
  active: boolean;
}

export interface SupportReport {
  id: number;
  targetType: 'BOOKING' | 'USER' | 'SUPPLIER' | 'SERVICE' | 'REVIEW';
  targetId: number;
  reason: string;
  details: string;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
  reporterName: string;
  assignedStaffName?: string | null;
  resolutionNote?: string | null;
  createdAt: string;
}

export interface ApiErrorPayload {
  code?: string;
  message?: string;
  fields?: Record<string, string>;
}
