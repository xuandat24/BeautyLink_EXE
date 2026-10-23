// Browser credentials are session-only. Public activity/revocation hints contain no bearer token.
export const TOKEN_KEY = 'beautylink_access_token';
export const SESSION_META_KEY = 'beautylink_auth_meta_v1';
export const AUTH_EVENT_KEY = 'beautylink_auth_event_v1';
export const IDLE_MS = 10 * 60 * 1000;
export type SessionPhase = 'anonymous' | 'checking' | 'verified' | 'locked';
type Meta = { sid: string; lastActivityAt: number; absoluteExpiresAt: number };
let phase: SessionPhase = 'anonymous';
let revision = 0;
let credentialEpoch = 0;
let locallyClearedCredential: string | null = null;
export const sessionCredentialEpoch = () => credentialEpoch;
const listeners = new Set<() => void>();
let notificationPending = false;
const emit = () => {
  revision++;
  if (notificationPending) return;
  notificationPending = true;
  queueMicrotask(() => { notificationPending = false; listeners.forEach(listener => listener()); });
};
export const subscribeSession = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const sessionSnapshot = () => ({ phase, revision });

export function tokenIdentity(token: string): { sid: string; expires: number } | null {
  try {
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof claims.sid === 'string' && /^[a-f0-9-]{36}$/i.test(claims.sid) && Number.isFinite(claims.exp)
      ? { sid: claims.sid, expires: claims.exp * 1000 } : null;
  } catch { return null; }
}
function readMeta(now = Date.now()): Meta | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_META_KEY) ?? 'null');
    if (!value || typeof value.sid !== 'string' || !Number.isFinite(value.lastActivityAt) || !Number.isFinite(value.absoluteExpiresAt)) return null;
    const shared = Number(localStorage.getItem(`beautylink_activity:${value.sid}`));
    if (shared > value.lastActivityAt && shared <= now) value.lastActivityAt = shared;
    return value;
  } catch { return null; }
}
export function peekAccessToken(): string | null {
  try {
    const value = typeof window === 'undefined' ? null : sessionStorage.getItem(TOKEN_KEY);
    return value === locallyClearedCredential ? null : value;
  } catch { return null; }
}
export function clearSession(broadcast = true) {
  credentialEpoch++;
  const token = peekAccessToken();
  if (token) locallyClearedCredential = token;
  const sid = token ? tokenIdentity(token)?.sid : undefined;
  try {
    for (const key of [TOKEN_KEY, SESSION_META_KEY, 'beautylink_session_user', 'beautylink_user_profile_data_v2']) {
      sessionStorage.removeItem(key); localStorage.removeItem(key);
    }
    if (broadcast && sid) localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify({ sid, at: Date.now(), nonce: Math.random() }));
  } catch { /* Credentials remain unusable: getAccessToken fails closed when storage is unavailable. */ }
  if (phase !== 'anonymous' || token) { phase = 'anonymous'; emit(); }
}
export function getSessionToken(now = Date.now()): string | null {
  const token = peekAccessToken(), meta = readMeta(now), identity = token ? tokenIdentity(token) : null;
  if (!token) return null;
  if (!meta || !identity || identity.sid !== meta.sid || now < meta.lastActivityAt
    || now - meta.lastActivityAt >= IDLE_MS || now >= Math.min(meta.absoluteExpiresAt, identity.expires)) {
    clearSession(); return null;
  }
  return token;
}
export function installToken(token: string) {
  const identity = tokenIdentity(token), now = Date.now();
  if (!identity || identity.expires <= now) throw new Error('Máy chủ trả về phiên đăng nhập không hợp lệ.');
  const previous = readMeta();
  // Profile replacement retains activity/absolute deadline, never silently creates a fresh session.
  const meta: Meta = previous?.sid === identity.sid ? { ...previous, absoluteExpiresAt: Math.min(previous.absoluteExpiresAt, identity.expires) }
    : { sid: identity.sid, lastActivityAt: now, absoluteExpiresAt: identity.expires };
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('beautylink_session_user'); sessionStorage.removeItem('beautylink_session_user');
  sessionStorage.setItem(TOKEN_KEY, token); sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
  locallyClearedCredential = null;
  credentialEpoch++; phase = 'verified'; emit();
}
export function initializeSession() {
  // The old default-true persistent login is not consent: do not migrate its bearer/profile into a session.
  try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('beautylink_session_user'); sessionStorage.removeItem('beautylink_session_user'); }
  catch { clearSession(false); return; }
  if (getSessionToken()) { phase = 'checking'; emit(); } else { clearSession(false); }
}
export function setSessionPhase(next: SessionPhase, token: string) {
  if (token !== getSessionToken()) return false;
  phase = next; emit(); return true;
}
export function recordUserActivity(now = Date.now()) {
  if (!getSessionToken(now) || phase !== 'verified') return false;
  const meta = readMeta(); if (!meta) return false;
  meta.lastActivityAt = now;
  try {
    sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
    localStorage.setItem(`beautylink_activity:${meta.sid}`, String(now));
  } catch { return false; }
  return true;
}
export function receiveSessionStorage(event: StorageEvent) {
  if (event.key === null) { clearSession(false); return; }
  if (event.key !== AUTH_EVENT_KEY || !event.newValue) return;
  try {
    const sid = JSON.parse(event.newValue).sid;
    const current = peekAccessToken();
    if (current && tokenIdentity(current)?.sid === sid) clearSession(false);
  } catch { /* Ignore malformed non-credential broadcasts. */ }
}

export function isAuthStorageEvent(event: StorageEvent) {
  return event.key == null || event.key === AUTH_EVENT_KEY || event.key === TOKEN_KEY || event.key === 'beautylink_session_user';
}
