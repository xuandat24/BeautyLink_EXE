export type AdminDetailRoute = { kind: 'salon' | 'account'; id: number | null; tab: string; edit: boolean; list?: boolean };
export function parseAdminDetailHash(hash: string): AdminDetailRoute | null {
  if (/^#admin-users\/edit\/?$/i.test(hash)) return { kind: 'account', id: null, tab: '', edit: true, list: true };
  const match = /^#admin-(salons|users)\/(.*)$/i.exec(hash);
  if (!match) return null;
  const [rawId, rawTab = '', ...extra] = match[2].split('/');
  const kind = match[1].toLowerCase() === 'salons' ? 'salon' : 'account';
  const tabs = kind === 'salon' ? ['', 'services', 'practitioners', 'bookings', 'payments'] : ['', 'bookings', 'edit'];
  const id = /^[1-9]\d*$/.test(rawId) && Number.isSafeInteger(Number(rawId)) && tabs.includes(rawTab) && extra.length === 0 ? Number(rawId) : null;
  return { kind, id, tab: rawTab, edit: kind === 'account' && rawTab === 'edit' };
}
export const adminDetailHash = (kind: 'salon' | 'account', id: number, tab = '') => `#admin-${kind === 'salon' ? 'salons' : 'users'}/${id}${tab ? `/${tab}` : ''}`;
