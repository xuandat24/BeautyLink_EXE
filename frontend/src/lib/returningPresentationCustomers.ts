import type { AdminUserRow } from '../types/adminV2';

// Academic presentation cohort, not inferred repeat-booking history; no account or booking mutations.
export const returningPresentationCount = 71;
export function selectReturningPresentationCustomers(users: AdminUserRow[]): AdminUserRow[] {
  return [...new Map(users.map(user => [user.id, user])).values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    .slice(85).filter(user => user.role === 'CUSTOMER').slice(0, returningPresentationCount);
}
