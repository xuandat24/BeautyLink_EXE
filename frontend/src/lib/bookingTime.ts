const zone = 'Asia/Ho_Chi_Minh';
export function bookingToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (key: string) => parts.find(p => p.type === key)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function bookingDay(offset = 0, now = new Date()): string {
  const d = new Date(`${bookingToday(now)}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10);
}
export function bookingMaxDate(now = new Date()): string {
  const [year, month, day] = bookingToday(now).split('-').map(Number);
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, last))).toISOString().slice(0, 10);
}
export function validBookingDate(value: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value >= bookingToday(now) && value <= bookingMaxDate(now);
}
