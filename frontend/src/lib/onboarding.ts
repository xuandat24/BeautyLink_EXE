export const ONBOARDING_KEY = 'beautylink_onboarding_v1';
export const ONBOARDING_TTL = 24 * 60 * 60 * 1000;
export interface OnboardingSelection { version: 1; completedAt: number; locationId: number; city: string; category: string }
export function readOnboarding(raw: string | null, now = Date.now()): OnboardingSelection | null {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (value?.version !== 1 || !Number.isSafeInteger(value.locationId) || value.locationId <= 0
      || typeof value.city !== 'string' || !value.city.trim() || typeof value.category !== 'string'
      || !/^[a-z][a-z0-9-]*$/.test(value.category) || !Number.isFinite(value.completedAt)
      || value.completedAt <= 0 || now < value.completedAt || now - value.completedAt >= ONBOARDING_TTL) return null;
    return value;
  } catch { return null; }
}
export function eligibleOnboardingVisit(view: string, search: string, hash: string, bookingOpen = false) {
  const params = new URLSearchParams(search);
  return view === 'home' && !bookingOpen && ['', '#home', '#deals', '#nearby'].includes(hash.toLowerCase())
    && !params.has('payment') && !params.has('orderCode') && !params.has('bookingPayment');
}
