import type { PayOSPayment } from '../types/beauty';

export const PAYMENT_HTTP_TIMEOUT = 30000;
const recoveringMessage = 'Chưa xác minh được phiên thanh toán. Lịch hẹn được giữ nguyên; hãy mở Lịch hẹn của tôi để kiểm tra, không tạo lại đơn.';

function recoverable(error: unknown): boolean {
  const e = error as { code?: string; response?: { status?: number; data?: { code?: string } } };
  const status = e?.response?.status;
  return ['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'].includes(e?.code ?? '')
    || status === 429 || (status != null && status >= 500)
    || (status === 409 && e.response?.data?.code === 'PAYMENT_RECONCILING');
}

/** Exactly one create. Recovery reads the server's owned ledger; it never repeats a POST. */
export async function createWithRecovery(
  bookingId: number, create: () => Promise<PayOSPayment>, read: () => Promise<PayOSPayment>,
  current: () => boolean, wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
  onRecovery?: () => void,
): Promise<PayOSPayment> {
  try { return await create(); }
  catch (error) {
    if (!recoverable(error)) throw error;
    if (current()) onRecovery?.();
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!current()) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại từ lịch hẹn.');
      try {
        const payment = await read();
        if (!current()) throw new Error('Phiên đăng nhập đã thay đổi.');
        if (payment.bookingId !== bookingId) throw new Error('Thông tin lịch hẹn không khớp. Không chuyển tiền; vui lòng liên hệ hỗ trợ.');
        if (payment.requiresManualReview || payment.status !== 'PENDING' || payment.paymentLinkId) return payment;
      } catch (failure) {
        const status = (failure as { response?: { status?: number } })?.response?.status;
        if (!current() || (!recoverable(failure) && status !== 404)) throw failure;
      }
      if (attempt < 2) await wait(2000 * (attempt + 1));
    }
    throw new Error(recoveringMessage);
  }
}
