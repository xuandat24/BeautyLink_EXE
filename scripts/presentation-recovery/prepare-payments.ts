import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

export const batchId = 'beautylink-report-payments-144-20261031-v1';
const base = 9_100_000_000, minute = 60_000;
type Row = Record<string, any>;
const weekday = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const millis = (day: string, time: string) => Date.parse(`${day}T${time.length === 5 ? `${time}:00` : time}+07:00`);
const dayOffset = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const timeText = (ms: number) => new Date(ms + 7 * 3600000).toISOString().slice(11, 19);
export const deposit = (price: number) => { assert.ok(Number.isSafeInteger(price) && price >= 0); return Math.floor((price + 10) / 20); };
const intersects = (a: number, b: number, c: number, d: number) => a < d && b > c;

export function preparePayments(source: Row, count = 144, target = 3_045_000) {
  assert.equal(count, 144); assert.ok(source.recovery.every((r: Row) => r.id !== batchId), 'Batch already exists; check/apply the saved plan, do not regenerate');
  const original = source.recovery.find((r: Row) => r.id === 'beautylink-presentation-20261031');
  assert.ok(original, 'Original recovery partition required');
  const recovered = JSON.parse(original.payload).data;
  const existing: Row[] = source.recovery.flatMap((r: Row) => JSON.parse(r.payload).data?.bookings ?? []);
  const people: Row[] = source.practitioners;
  const occupied: Row[] = [...source.occupied];
  for (const b of existing) if (b.status !== 'CANCELLED') {
    const matches = b.practitionerId ? people.filter(p => p.id === b.practitionerId) : people.filter(p => p.supplierId === b.supplierId && p.displayName === b.practitionerName);
    for (const p of matches) occupied.push({ ...b, practitionerId: p.id });
  }
  const reserved: Row[] = occupied.map(b => {
    const start = millis(b.appointmentDate, b.startTime), end = millis(b.appointmentDate, b.endTime);
    return { practitionerId: b.practitionerId, customerId: b.customerId, start, end: end <= start ? end + 86400000 : end };
  });
  const users: Row[] = [...source.customers, ...recovered.users.filter((u: Row) => u.role === 'CUSTOMER')];
  assert.equal(new Set(users.map(u => u.id)).size, users.length);
  const catalog: Row[] = source.catalog.filter((s: Row) => s.price > 0 && s.price <= 1_000_000 && deposit(s.price) >= 2000 && s.durationMinutes > 0 && people.some(p => p.supplierId === s.supplierId && (!p.restricted || source.assignments.some((a: Row) => a.practitionerId === p.id && a.serviceId === s.id))));
  const suppliers = [...new Set<number>(catalog.map(s => s.supplierId))].sort((a, b) => a - b);
  assert.ok(suppliers.length > 5);
  const supplierQueue: number[] = [];
  const weights = suppliers.map((id, i) => 0.7 + (id * 7 + i * 3) % 9 / 10);
  const quotas = weights.map(w => count * w / weights.reduce((a, b) => a + b, 0));
  const allocation = quotas.map(Math.floor);
  quotas.map((q, i) => ({ i, remainder: q % 1 })).sort((a, b) => b.remainder - a.remainder || a.i - b.i).slice(0, count - allocation.reduce((a, b) => a + b, 0)).forEach(x => allocation[x.i]++);
  while (supplierQueue.length < count) suppliers.forEach((id, i) => { if (allocation[i]-- > 0) supplierQueue.push(id); });
  const daily = [0.45, 1.8, 0.7, 1.2, 0.3, 2.3, 0.9, 1.5, 0.55, 2.0, 0.8];
  const days = Array.from({ length: 28 }, (_, i) => `2026-10-${String(i + 3).padStart(2, '0')}`);
  const dayQueue = days.flatMap((day, i) => Array.from({ length: Math.round(daily[i % daily.length] * 3) }, () => day));
  const options: Row[][] = [];
  for (let i = 0; i < count; i++) {
    const supplierId = supplierQueue[i]; let candidates: Row[] = [];
    for (let attempt = 0; attempt < days.length && !candidates.length; attempt++) {
      const day = attempt === 0 ? dayQueue[(i * 17 + Math.floor(i / 7)) % dayQueue.length] : days[(i + attempt) % days.length];
      const createdAt = millis(dayOffset(day, -1), '09:00') + (i * 23 % 360) * minute;
      const customers = users.filter(u => Date.parse(u.createdAt) <= createdAt);
      assert.ok(customers.length > 0);
      const customer = customers[(i * 37 + Math.floor(i / 11)) % customers.length];
      for (const service of catalog.filter(s => s.supplierId === supplierId)) {
        const workers = people.filter(p => p.supplierId === supplierId && (!p.restricted || source.assignments.some((a: Row) => a.practitionerId === p.id && a.serviceId === service.id)));
        let chosen: Row | undefined;
        for (let w = 0; w < workers.length && !chosen; w++) {
          const person = workers[(w + i) % workers.length];
          const override = source.exceptions.find((e: Row) => e.practitionerId === person.id && e.exceptionDate === day);
          if (override && !override.available) continue;
          const rule = source.rules.find((r: Row) => r.practitionerId === person.id && r.day === weekday[new Date(`${day}T12:00:00Z`).getUTCDay()]);
          if (!rule && (!override?.startTime || !override?.endTime)) continue;
          const startTime = override?.startTime ?? rule.startTime, endTime = override?.endTime ?? rule.endTime;
          const opening = millis(day, startTime); let closing = millis(day, endTime); if (closing <= opening) closing += 86400000;
          const step = rule?.slotMinutes ?? 30; assert.ok(step > 0);
          const breakStart = rule?.breakStart ? millis(day, rule.breakStart) : null;
          let breakEnd = rule?.breakEnd ? millis(day, rule.breakEnd) : null;
          if (breakStart !== null && breakEnd !== null && breakEnd <= breakStart) breakEnd += 86400000;
          for (let start = opening; start + service.durationMinutes * minute <= closing; start += step * minute) {
            const end = start + service.durationMinutes * minute;
            if (new Date(start + 7 * 3600000).toISOString().slice(0, 10) !== day || timeText(start) < '08:00:00' || timeText(end) > '22:00:00' || end >= millis(dayOffset(day, 1), '00:00')) continue;
            if (breakStart !== null && breakEnd !== null && intersects(start, end, breakStart, breakEnd)) continue;
            if (reserved.some(r => (r.practitionerId === person.id || r.customerId === customer.id) && intersects(start, end, r.start, r.end))) continue;
            chosen = { service, person, customer, day, start, end, createdAt }; break;
          }
        }
        if (chosen) candidates.push(chosen);
      }
    }
    assert.ok(candidates.length, `No conflict-free report slot for supplier ${supplierId}`);
    options.push(candidates);
    // Reserve every possible choice while planning; the eventual selected slot is a subset.
    candidates.forEach(c => reserved.push({ practitionerId: c.person.id, customerId: c.customer.id, start: c.start, end: c.end }));
  }
  const baseline = source.verified.reduce((n: number, p: Row) => n + p.amount, 0);
  const required = target - baseline; assert.ok(required > 0);
  const cap = Math.ceil((required + 100_000) / 50), infinity = 1e30;
  let scores = new Float64Array(cap + 1).fill(infinity); scores[0] = 0;
  const parents: Int16Array[] = [];
  for (let i = 0; i < options.length; i++) {
    const next = new Float64Array(cap + 1).fill(infinity), choices = new Int16Array(cap + 1).fill(-1);
    const desired = required / count * daily[Number(options[i][0].day.slice(-2)) % daily.length];
    options[i].forEach((c, index) => {
      const amount = deposit(c.service.price), units = amount / 50; assert.ok(Number.isInteger(units));
      const cost = ((amount - desired) / 1000) ** 2 + ((c.service.id * 13 + i * 7) % 23) / 100;
      for (let previous = 0; previous + units <= cap; previous++) if (scores[previous] < infinity && scores[previous] + cost < next[previous + units]) {
        next[previous + units] = scores[previous] + cost; choices[previous + units] = index;
      }
    });
    parents.push(choices); scores = next;
  }
  let sum = -1;
  for (let units = 0; units <= cap; units++) if (scores[units] < infinity && (sum < 0 || Math.abs(units * 50 - required) < Math.abs(sum * 50 - required) || Math.abs(units * 50 - required) === Math.abs(sum * 50 - required) && scores[units] < scores[sum])) sum = units;
  assert.ok(sum >= 0, 'No valid 144-booking price combination');
  const selected: Row[] = Array(count);
  for (let i = count - 1; i >= 0; i--) { selected[i] = options[i][parents[i][sum]]; sum -= deposit(selected[i].service.price) / 50; }
  assert.equal(sum, 0);
  const bookings = selected.map((c, i) => ({ id: base + i, batchId, source: 'SIMULATED', bookingCode: `BL2610R${String(i + 1).padStart(4, '0')}`,
    customerId: c.customer.id, customerName: c.customer.fullName, customerPhone: c.customer.phone ?? '', supplierId: c.service.supplierId, supplierName: c.service.supplierName,
    serviceId: c.service.id, serviceName: c.service.name, practitionerId: c.person.id, practitionerName: c.person.displayName,
    appointmentDate: c.day, startTime: timeText(c.start), endTime: timeText(c.end), totalAmount: c.service.price,
    status: 'COMPLETED', paymentStatus: 'PARTIALLY_PAID', createdAt: new Date(c.createdAt).toISOString(),
    completedAt: new Date(c.end + (10 + i % 16) * minute).toISOString(),
    simulatedOnlineAmount: deposit(c.service.price), simulatedPaymentOption: 'DEPOSIT_05', simulatedPaidAt: new Date(c.createdAt + (5 + i * 7 % 30) * minute).toISOString(),
    verifiedOnlineAmount: null, verifiedPaidAt: null, verifiedPaymentOption: null, paymentReviewRequired: false,
    remainingAtSalon: c.service.price - deposit(c.service.price), commissionAmount: 0 }));
  const payments = bookings.map((b, i) => ({ id: `${batchId}:${String(i + 1).padStart(4, '0')}`, batchId, source: 'SIMULATED',
    bookingId: b.id, paymentOption: 'DEPOSIT_05', serviceValue: b.totalAmount, amount: b.simulatedOnlineAmount, depositRate: '0.05',
    remainingAmount: b.remainingAtSalon, paidAt: b.simulatedPaidAt }));
  for (const b of bookings) { assert.ok(Date.parse(b.createdAt) < Date.parse(b.simulatedPaidAt)); assert.ok(Date.parse(b.simulatedPaidAt) < millis(b.appointmentDate, b.startTime)); assert.ok(Date.parse(b.completedAt) < Date.parse(source.asOf)); }
  const daysTotal = new Map<string, number>(); payments.forEach(p => { const d = new Date(Date.parse(p.paidAt) + 7 * 3600000).toISOString().slice(0, 10); daysTotal.set(d, (daysTotal.get(d) ?? 0) + p.amount); });
  const simulated = payments.reduce((n, p) => n + p.amount, 0);
  return { version: 1, batch: { id: batchId, version: 1, source: 'SIMULATED', purpose: 'Academic reporting only; not externally verified payments', createdAt: source.asOf,
    from: '2026-10-01', to: '2026-10-31', expectedRecoveryHash: source.recoveryHash, expectedReferenceHash: source.referenceHash, expectedBookingHash: source.bookingHash, expectedVerifiedHash: source.verifiedHash,
    baselineVerified: baseline, target, simulated, resultingReportTotal: baseline + simulated, differenceFromTarget: baseline + simulated - target },
    data: { bookings, reportingPayments: payments }, reconciliation: { rows: count, uniqueBookings: new Set(payments.map(p => p.bookingId)).size, deposits: simulated, fullPayments: 0, days: [...daysTotal].sort() } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [sourcePath, outputPath] = process.argv.slice(2); assert.ok(sourcePath && outputPath && sourcePath !== outputPath);
  const payload = preparePayments(JSON.parse(readFileSync(sourcePath, 'utf8')));
  writeFileSync(outputPath, JSON.stringify(payload));
  console.log(JSON.stringify({ batch: payload.batch, reconciliation: payload.reconciliation }, null, 2));
}
