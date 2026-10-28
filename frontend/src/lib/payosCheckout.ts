import { sessionCredentialEpoch } from './authSession';
import type { PayOSPayment } from '../types/beauty';

export type QRCheckoutState = 'INITIALIZING' | 'PENDING' | 'VERIFYING' | 'NETWORK_ERROR' | 'QR_UNAVAILABLE' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'REVIEW_REQUIRED';

export function samePayment(a: PayOSPayment, b: PayOSPayment): boolean {
  return a.bookingId === b.bookingId && String(a.orderCode) === String(b.orderCode)
    && (a.paymentLinkId === b.paymentLinkId || (!b.paymentLinkId && typeof a.paymentLinkId === 'string' && Boolean(a.paymentLinkId.trim())))
    && a.amount === b.amount && a.remainingAmount === b.remainingAmount && a.paymentOption === b.paymentOption;
}

export function payableAttempt(payment: PayOSPayment, bookingId: number, now = Date.now()): boolean {
  return payment.bookingId === bookingId && payment.status === 'PENDING' && payment.requiresManualReview === false
    && payment.verificationPending !== true && Boolean(payment.paymentLinkId)
    && Number.isSafeInteger(payment.amount) && payment.amount > 0 && Number.isSafeInteger(payment.remainingAmount) && payment.remainingAmount >= 0
    && Date.parse(payment.expiresAt) > now
    && payment.checkoutAllowed === true && payment.verificationPending === false;
}

/** Inspect the provider's exact EMV payload, never construct payment instructions. */
export function usableProviderQr(value: string | null | undefined, amount: number): boolean {
  if (!value || !/6304[0-9a-f]{4}$/i.test(value)) return false;
  const bytes = new TextEncoder().encode(value);
  if (bytes.length < 20 || bytes.length > 2048) return false;
  let crc = 0xffff;
  for (const byte of bytes.slice(0, -4)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  if (crc !== parseInt(value.slice(-4), 16)) return false;
  const fields = new Map<string, string>(), decoder = new TextDecoder();
  for (let offset = 0; offset < bytes.length;) {
    const tag = decoder.decode(bytes.slice(offset, offset + 2)), length = decoder.decode(bytes.slice(offset + 2, offset + 4));
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(length) || fields.has(tag)) return false;
    const size = Number(length); offset += 4;
    if (offset + size > bytes.length) return false;
    fields.set(tag, decoder.decode(bytes.slice(offset, offset + size))); offset += size;
  }
  return fields.get('00') === '01' && fields.get('53') === '704' && fields.get('58') === 'VN'
    && Boolean(fields.get('38')?.includes('A000000727')) && /^\d+(?:\.\d{1,2})?$/.test(fields.get('54') ?? '') && Number(fields.get('54')) === amount;
}

export function retryDelay(error: unknown, failures: number): number {
  const seconds = Number((error as { response?: { headers?: Record<string, unknown> } })?.response?.headers?.['retry-after']);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(60000, Math.max(5000, seconds * 1000)) : Math.min(30000, 5000 * 2 ** (failures - 1));
}

// Live HTTP responses only: this lease is never serialized or restored from browser storage.
const liveObservations = new WeakMap<PayOSPayment, { until: number; token: string; epoch: number }>();
export function rememberPaymentObservation(payment: PayOSPayment, started: number, token: string | null, epoch: number, now = performance.now()): void {
  const duration = payment.instructionsFreshForMs;
  const elapsed = now - started;
  if (!token || !Number.isFinite(duration) || duration! <= 0 || elapsed < 0 || !Number.isFinite(elapsed)) { liveObservations.delete(payment); return; }
  const remaining = Math.min(15000, duration!) - elapsed; // deduct the WHOLE request, including transit/commit
  if (remaining <= 0) { liveObservations.delete(payment); return; }
  liveObservations.set(payment, { until: now + remaining, token, epoch });
}
export function freshObservation(payment: PayOSPayment, token: string | null, now = performance.now()): boolean {
  const lease = liveObservations.get(payment);
  return Boolean(token && lease && lease.token === token && lease.epoch === sessionCredentialEpoch() && lease.until > now);
}

/** Diagnostics must never prevent QR rendering on browsers without User Timing Level 3. */
export function recordCheckoutDuration(name: 'beautylink-qr-render', started: number): void {
  try { performance.clearMeasures(name); performance.measure(name, { start: started, end: performance.now() }); }
  catch { /* Numeric diagnostics only; payment behavior does not depend on User Timing support. */ }
}
