import React, { useState } from 'react';
import { adminV2Api, adminRangeError, type AdminRange } from '../../services/adminApi';
import { beautyApi, getAccessToken, getApiErrorMessage } from '../../services/beautyApi';
import type { AdminBooking } from '../../types';
import type { ReportingPaymentRow } from '../../types/adminV2';
import { reportingPaymentCsv } from '../../lib/reportingPaymentCsv';
import { adminMoney } from './AdminOverview';
import { AdminRegion, AdminPagination, useAdminResource } from './AdminDataRegion';
import { AdminStatusBadge } from './AdminStatusBadge';
import { BookingDetail } from './AdminDashboardPage';

export function ReportingPaymentPanel({ range, salonId, active = true }: { range: AdminRange; salonId?: number; active?: boolean }) {
  const scope = `${range.from}:${range.to}:${salonId ?? 'all'}`;
  const [paging, setPaging] = useState({ scope, page: 0 }); const page = paging.scope === scope ? paging.page : 0;
  const [booking, setBooking] = useState<AdminBooking | null>(null); const [error, setError] = useState('');
  const [opening, setOpening] = useState(false); const [exporting, setExporting] = useState(false);
  const resource = useAdminResource(`report-payments:${scope}:${page}`, async () => { const invalid = adminRangeError(range); if (invalid) throw new Error(invalid); return adminV2Api.reportPayments({ from: range.from, to: range.to, salonId, page }); }, active);
  const open = async (row: ReportingPaymentRow) => {
    if (opening) return; const token = getAccessToken(); setOpening(true); setError('');
    try {
      const b = await beautyApi.adminBooking(row.bookingId);
      if (token !== getAccessToken()) return;
      if (b.id !== row.bookingId || b.bookingCode !== row.bookingCode || b.customerId !== row.customerId || b.totalAmount !== row.serviceValue || b.status !== row.bookingStatus || b.supplierId !== row.supplierId || b.appointmentDate !== row.appointmentDate || b.startTime !== row.startTime || b.endTime !== row.endTime || b.practitionerName !== row.practitionerName || b.serviceName !== row.serviceName) throw new Error('Dữ liệu lịch vừa thay đổi. Vui lòng làm mới để đối soát.');
      setBooking(b);
    } catch (e) { if (token === getAccessToken()) setError(getApiErrorMessage(e, 'Không thể tải lịch liên quan.')); }
    finally { if (token === getAccessToken()) setOpening(false); }
  };
  const download = async () => {
    if (exporting) return; const token = getAccessToken(); setExporting(true); setError('');
    try {
      const rows: ReportingPaymentRow[] = []; let expectedTotal: number | undefined, expectedRows: number | undefined;
      for (let p = 0; ; p++) {
        const result = await adminV2Api.reportPayments({ from: range.from, to: range.to, salonId, page: p, size: 100 });
        if (token !== getAccessToken()) return;
        if (expectedTotal !== undefined && (expectedTotal !== result.total || expectedRows !== result.rows.totalElements)) throw new Error('Dữ liệu vừa thay đổi. Vui lòng xuất lại báo cáo.');
        expectedTotal = result.total; expectedRows = result.rows.totalElements;
        rows.push(...result.rows.content); if (p + 1 >= result.rows.totalPages) break;
      }
      if (new Set(rows.map(r => r.id)).size !== rows.length || rows.length !== expectedRows) throw new Error('Danh sách thanh toán chưa đầy đủ. Vui lòng xuất lại báo cáo.');
      const url = URL.createObjectURL(reportingPaymentCsv(rows)); const link = document.createElement('a');
      link.href = url; link.download = `beautylink-thanh-toan-bao-cao-${range.from}-${range.to}.csv`; link.click(); URL.revokeObjectURL(url);
    } catch (e) { if (token === getAccessToken()) setError(getApiErrorMessage(e, 'Không thể xuất báo cáo.')); }
    finally { if (token === getAccessToken()) setExporting(false); }
  };
  const data = resource.data;
  return <AdminRegion {...resource} retry={resource.reload}>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Tổng thanh toán báo cáo</h2><button type="button" className="admin-action" disabled={exporting || !data} onClick={() => void download()}>{exporting ? 'Đang xuất…' : 'Tải báo cáo thanh toán CSV'}</button></div>
    <details className="mt-3 text-xs leading-5 text-slate-600"><summary className="cursor-pointer">Cách tính và nguồn dữ liệu</summary><p>Theo ngày ghi nhận, giờ Việt Nam: tiền PayOS xác minh cộng các khoản cọc mô phỏng của hồ sơ báo cáo. Mỗi khoản liên kết một booking; ngày hẹn, dịch vụ và chuyên viên được đọc từ chính booking đó. Không phải toàn bộ giá trị dịch vụ; số dư tại salon chưa được tính là tiền đã thu.</p><p>Sổ Đối soát PayOS và CSV giao dịch xác minh không bao gồm khoản mô phỏng. Metadata cọc phục hồi cũ không có receipt không được cộng lại.</p></details>
    {data && <><dl className="my-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ['Tổng thanh toán báo cáo', adminMoney(data.total)], ['Tiền cọc', adminMoney(data.deposits)], ['Thanh toán đủ', adminMoney(data.fullPayments)], ['Thu online PayOS xác minh', adminMoney(data.verifiedAmount)],
      ['Khoản từ hồ sơ báo cáo', adminMoney(data.simulatedAmount)], ['Còn tại salon khi ghi nhận', adminMoney(data.remainingAtSalon)], ['Số khoản thanh toán', String(data.transactions)], ['Số booking có thanh toán', String(data.uniqueBookings)],
    ].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-2 overflow-x-auto whitespace-nowrap font-bold tabular-nums">{value}</dd></div>)}</dl>
      <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="admin-table min-w-[1320px]"><thead><tr>{['Mã lịch', 'Khách hàng', 'Salon / dịch vụ', 'Chuyên viên', 'Ngày giờ hẹn', 'Trạng thái lịch', 'Ngày ghi nhận', 'Hình thức', 'Số tiền', 'Còn tại salon', 'Thao tác'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{data.rows.content.map(row => <tr key={row.id}>
        <td><strong>{row.bookingCode}</strong><details className="mt-1 max-w-44 text-xs text-slate-500"><summary className="cursor-pointer">Nguồn thanh toán</summary><p className="break-all">{row.source === 'VERIFIED' ? 'PayOS đã xác minh' : 'Hồ sơ báo cáo · khoản cọc mô phỏng'}<br />{row.id}</p></details></td><td><span className="cell-label">{row.customerName}</span></td><td><strong className="cell-label">{row.supplierName}</strong><span className="cell-label text-xs">{row.serviceName}</span></td><td>{row.practitionerName}</td><td className="whitespace-nowrap">{row.appointmentDate}<br />{row.startTime.slice(0, 5)}–{row.endTime.slice(0, 5)}</td><td><AdminStatusBadge kind="booking" value={row.bookingStatus} /></td><td>{new Date(row.paidAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</td><td>{row.paymentOption === 'FULL_100' ? 'Thanh toán đủ' : row.paymentOption === 'DEPOSIT_05' ? 'Cọc 5%' : 'Cọc 50% lịch sử'}</td><td className="numeric">{adminMoney(row.amount)}</td><td className="numeric">{adminMoney(row.remainingAmount)}</td><td><button type="button" className="admin-action" disabled={opening} onClick={() => void open(row)}>Xem lịch</button></td>
      </tr>)}</tbody></table></div>{!data.rows.content.length && <p className="p-8 text-center text-sm text-slate-500">Chưa có khoản thanh toán trong kỳ.</p>}<AdminPagination data={data.rows} page={page} onPage={page => setPaging({ scope, page })} disabled={resource.loading} /></div></>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}{booking && <BookingDetail booking={booking} onClose={() => setBooking(null)} />}
  </AdminRegion>;
}
