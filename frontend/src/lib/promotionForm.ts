import type { Promotion } from '../types/promotions';
export const promotionLabels = { DRAFT: 'Bản nháp', SCHEDULED: 'Sắp diễn ra', ACTIVE: 'Đang chạy', PAUSED: 'Tạm dừng', EXPIRED: 'Đã kết thúc' };
export function vietnamDateInput(value: string | null) {
  if (!value) return ''; const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(p => p.type === type)?.value; return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
export function promotionInstant(value: string) { if (!value) return null; if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}+07:00`))) throw new Error('Thời gian không hợp lệ.'); const instant = new Date(`${value}+07:00`).toISOString(); if (vietnamDateInput(instant) !== value) throw new Error('Thời gian không hợp lệ.'); return instant; }
export function validatePromotion(p: Pick<Promotion, 'code' | 'name' | 'discountType' | 'value' | 'minimumOrder' | 'maximumDiscount' | 'startsAt' | 'endsAt'>) {
 if (!/^[A-Z0-9_-]{3,40}$/.test(p.code) || !p.name.trim() || p.name.trim().length > 120) throw new Error('Nhập tên và mã 3–40 ký tự gồm chữ, số, _ hoặc -.');
 if (!Number.isFinite(p.value) || p.value <= 0 || p.value > 1000000000 || Number(p.value.toFixed(2)) !== p.value) throw new Error('Giá trị giảm không hợp lệ.');
 if (!Number.isSafeInteger(p.minimumOrder) || p.minimumOrder < 0 || p.minimumOrder > 1000000000000) throw new Error('Đơn tối thiểu phải là số đồng nguyên, không âm.');
 if (p.discountType === 'FIXED' && (!Number.isSafeInteger(p.value) || p.maximumDiscount != null)) throw new Error('Số tiền giảm phải là số đồng nguyên.');
 if (p.discountType === 'PERCENT' && (p.value > 100 || !Number.isSafeInteger(p.maximumDiscount) || (p.maximumDiscount ?? 0) < 1 || (p.maximumDiscount ?? 0) > 1000000000)) throw new Error('Phần trăm từ 0,01 đến 100 và cần mức giảm tối đa.');
 if (p.endsAt && p.startsAt && Date.parse(p.endsAt) <= Date.parse(p.startsAt)) throw new Error('Ngày kết thúc phải sau ngày bắt đầu.');
}
