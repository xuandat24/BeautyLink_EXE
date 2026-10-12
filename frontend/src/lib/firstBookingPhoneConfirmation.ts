import { CurrentUser } from '../types';

export function requiresFirstBookingPhoneConfirmation(currentUser: CurrentUser | null): boolean {
  return currentUser?.role === 'CUSTOMER';
}
