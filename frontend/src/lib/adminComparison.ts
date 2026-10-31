import type { Metric, ReportingPeriod } from '../types/adminV2';

export const reportNumber = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
export const reportMoney = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
const units = { BOOKING: 'đơn', ACCOUNT: 'tài khoản', PARTNER: 'đối tác', CUSTOMER: 'khách', VND: '₫', PERCENT: '%' };
export function metricValue(metric: Metric, value: number | null): string {
  if (value == null) return '—';
  return metric.unit === 'VND' ? reportMoney(value) : `${reportNumber(value)} ${units[metric.unit]}`;
}
export function comparisonText(metric: Metric): string {
  const delta = metric.percentagePointChange ?? metric.absoluteChange;
  const direction = delta == null || delta === 0 ? '' : delta > 0 ? '↑ Tăng ' : '↓ Giảm ';
  switch (metric.comparisonStatus) {
    case 'INSUFFICIENT_HISTORY': return 'Chưa đủ dữ liệu lịch sử';
    case 'CURRENT_SNAPSHOT': return 'Số liệu hiện tại · không có lịch sử';
    case 'NO_DENOMINATOR': return 'Chưa có cơ sở so sánh tỷ lệ';
    case 'UNCHANGED': return 'Không thay đổi';
    case 'NEW_ACTIVITY': return `Phát sinh mới · +${metricValue(metric, delta)}`;
    case 'NEGATIVE_VALUE': return `Chênh lệch ${metricValue(metric, delta)} · có giá trị âm`;
    case 'LOW_BASE': return delta === 0 ? 'Không thay đổi' : `${direction}${metricValue(metric, Math.abs(delta!))}`;
    default:
      if (metric.unit === 'PERCENT') return `${direction}${reportNumber(Math.abs(delta!))} điểm %`;
      return `${direction}${reportNumber(Math.abs(metric.relativeChangePercent!))}%`;
  }
}
export function comparisonFormula(metric: Metric): string {
  if (metric.unit === 'PERCENT') {
    const ratio = (n: number | null, d: number | null) => d ? `${reportNumber(n!)} / ${reportNumber(d)} × 100` : 'không xác định (mẫu số 0)';
    return `Kỳ này: ${ratio(metric.currentNumerator, metric.currentDenominator)}; kỳ trước: ${ratio(metric.previousNumerator, metric.previousDenominator)}.${metric.percentagePointChange == null ? '' : ` Chênh lệch: ${reportNumber(metric.currentValue!)} − ${reportNumber(metric.previousValue!)} = ${reportNumber(metric.percentagePointChange)} điểm % (tính trên giá trị chưa làm tròn).`}`;
  }
  if (metric.previousValue == null || metric.currentValue == null) return 'Không tính phần trăm khi thiếu dữ liệu lịch sử.';
  if (metric.comparisonStatus === 'NEGATIVE_VALUE') return 'Có giá trị âm: chỉ hiển thị chênh lệch tuyệt đối; không chia cho nền âm hoặc suy diễn tăng trưởng.';
  if (metric.previousValue === 0) return 'Nền kỳ trước bằng 0: không tính phần trăm tăng trưởng.';
  return `${metric.relativeChangePercent! > 0 ? '+' : ''}${reportNumber(metric.relativeChangePercent!)}% = (${reportNumber(metric.currentValue)} − ${reportNumber(metric.previousValue)}) / ${reportNumber(metric.previousValue)} × 100`;
}
export function periodText(period: ReportingPeriod, timezone: string): string {
  const format = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  return `${format(period.startInclusive)} → trước ${format(period.endExclusive)}`;
}
