import { CurrentUser } from '../types';

export const mapBackendUser = (user: any): CurrentUser => ({
  id: user.id,
  name: user.fullName || user.name || 'Khách hàng',
  phone: user.phone || undefined,
  email: user.email || undefined,
  role: user.role || 'CUSTOMER',
  gender: user.gender === 'MALE' ? 'Nam' : user.gender === 'FEMALE' ? 'Nữ' : user.gender === 'OTHER' ? 'Others' : undefined,
  dateOfBirth: user.dateOfBirth || undefined,
  avatar: user.avatarUrl || undefined,
  memberTier: 'Standard',
  loyaltyPoints: user.loyaltyPoints ?? 0,
  points: user.loyaltyPoints ?? 0,
  bookingContactConfirmed: Boolean(user.bookingContactConfirmed),
});
