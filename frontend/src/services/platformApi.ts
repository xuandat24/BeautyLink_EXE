import { apiClient, saveAccessToken } from '../lib/api';
import type {
  ApiUser,
  AuthResponse,
  BeautyService,
  BookingRecord,
  LocationOption,
  Practitioner,
  ScheduleRule,
  ServiceCategory,
  SupportReport,
  SupplierProfile,
  SupplierRegistrationRequest,
  SupplierRegistrationResponse,
  SupplierService,
  SupplierServicePayload,
} from '../types';

const unwrap = <T,>(request: Promise<{ data: T }>) => request.then(({ data }) => data);

export const platformApi = {
  login: async (identifier: string, password: string) => {
    const data = await unwrap<AuthResponse>(apiClient.post('/v1/auth/login', { identifier, password }));
    saveAccessToken(data.accessToken);
    return data;
  },
  register: async (payload: { fullName: string; phone: string; email?: string; password: string }) => {
    const data = await unwrap<AuthResponse>(apiClient.post('/v1/auth/register', payload));
    saveAccessToken(data.accessToken);
    return data;
  },
  registerSupplier: async (payload: SupplierRegistrationRequest) => {
    const data = await unwrap<SupplierRegistrationResponse>(apiClient.post('/v1/auth/register-supplier', payload));
    saveAccessToken(data.auth.accessToken);
    return data;
  },
  me: () => unwrap<ApiUser>(apiClient.get('/v1/auth/me')),
  locations: (parentId?: number) => unwrap<LocationOption[]>(apiClient.get('/v1/locations', { params: parentId ? { parentId } : {} })),
  categories: () => unwrap<ServiceCategory[]>(apiClient.get('/v1/categories')),
  services: (slug: string, locationId?: number | null) => unwrap<BeautyService[]>(apiClient.get(`/v1/categories/${slug}/services`, { params: locationId ? { locationId } : {} })),
  homepageServices: (locationId?: number | null) => unwrap<BeautyService[]>(apiClient.get('/v1/homepage/services', { params: locationId ? { locationId } : {} })),
  availability: (serviceId: number, practitionerId: number, date: string) => unwrap<{ practitionerId: number; date: string; availableSlots: string[] }>(apiClient.get(`/v1/services/${serviceId}/availability`, { params: { practitionerId, date } })),
  createBooking: (payload: { serviceId: number; practitionerId: number; appointmentDate: string; startTime: string; note?: string }) => unwrap<BookingRecord>(apiClient.post('/v1/bookings', payload)),
  myBookings: () => unwrap<BookingRecord[]>(apiClient.get('/v1/bookings/mine')),
  cancelBooking: (id: number) => unwrap<BookingRecord>(apiClient.patch(`/v1/bookings/${id}/cancel`)),
  supplierPractitioners: () => unwrap<Practitioner[]>(apiClient.get('/v1/supplier/practitioners')),
  supplierProfile: () => unwrap<SupplierProfile>(apiClient.get('/v1/supplier/profile')),
  updateSupplierProfile: (payload: Pick<SupplierProfile, 'name' | 'businessType' | 'description' | 'addressLine' | 'imageUrl' | 'latitude' | 'longitude'>) => unwrap<SupplierProfile>(apiClient.put('/v1/supplier/profile', payload)),
  supplierServices: () => unwrap<SupplierService[]>(apiClient.get('/v1/supplier/services')),
  createSupplierService: (payload: SupplierServicePayload) => unwrap<SupplierService>(apiClient.post('/v1/supplier/services', payload)),
  updateSupplierService: (id: number, payload: SupplierServicePayload) => unwrap<SupplierService>(apiClient.put(`/v1/supplier/services/${id}`, payload)),
  deactivateSupplierService: (id: number) => unwrap<void>(apiClient.delete(`/v1/supplier/services/${id}`)),
  createPractitioner: (payload: { displayName: string; specialty?: string; bio?: string; avatarUrl?: string }) => unwrap<Practitioner>(apiClient.post('/v1/supplier/practitioners', payload)),
  updatePractitioner: (id: number, payload: { displayName: string; specialty?: string; bio?: string; avatarUrl?: string }) => unwrap<Practitioner>(apiClient.put(`/v1/supplier/practitioners/${id}`, payload)),
  practitionerSchedule: (id: number) => unwrap<ScheduleRule[]>(apiClient.get(`/v1/supplier/practitioners/${id}/schedule`)),
  replaceSchedule: (id: number, rules: ScheduleRule[]) => unwrap<ScheduleRule[]>(apiClient.put(`/v1/supplier/practitioners/${id}/schedule`, { rules })),
  supplierBookings: () => unwrap<BookingRecord[]>(apiClient.get('/v1/bookings/supplier')),
  reports: () => unwrap<SupportReport[]>(apiClient.get('/v1/reports')),
  updateReport: (id: number, status: SupportReport['status'], resolutionNote?: string) => unwrap<SupportReport>(apiClient.patch(`/v1/reports/${id}`, { status, resolutionNote })),
  createReport: (payload: { targetType: SupportReport['targetType']; targetId: number; reason: string; details: string }) => unwrap<SupportReport>(apiClient.post('/v1/reports', payload)),
};
