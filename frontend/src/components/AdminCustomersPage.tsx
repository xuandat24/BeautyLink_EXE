import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { AdminCustomer } from '../types';
import { beautyApi, getApiErrorMessage } from '../services/beautyApi';

interface AdminCustomersPageProps {
  onBack: () => void;
  onOpenReports: () => void;
}

const genderLabel: Record<Exclude<AdminCustomer['gender'], null>, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
};

const displayBirthDate = (value: string | null) => {
  if (!value) return 'Chưa cập nhật';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

export const AdminCustomersPage: React.FC<AdminCustomersPageProps> = ({ onBack, onOpenReports }) => {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const loadCustomers = async () => {
    setLoading(true);
    setError('');
    try {
      setCustomers(await beautyApi.adminCustomers());
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể tải danh sách tài khoản khách hàng.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

  const visibleCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN');
    return customers
      .map((customer, index) => ({ customer, ordinal: index + 1 }))
      .filter(({ customer }) => {
        if (!normalizedQuery) return true;
        return [customer.fullName, customer.phone, customer.email]
          .some((value) => value?.toLocaleLowerCase('vi-VN').includes(normalizedQuery));
      });
  }, [customers, query]);

  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      const blob = await beautyApi.exportAdminCustomers();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `beautylink-customers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể tải xuống dữ liệu khách hàng.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-600 transition hover:text-pink-700"
          >
            <ArrowLeft className="h-4 w-4" /> Trang chủ
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenReports}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 transition hover:border-pink-200 hover:text-pink-700"
            >
              <FileText className="h-4 w-4" /> Phản hồi
            </button>
            <span className="text-lg font-black tracking-tight">
              Beauty<span className="text-pink-600">Link</span> Admin
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-pink-600">Quản trị hệ thống</p>
            <h1 className="mt-2 text-3xl font-black">Tài khoản khách hàng</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Danh sách chỉ bao gồm tài khoản khách hàng; nhà cung cấp, nhân viên và quản trị viên được loại trừ.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#be185d] px-5 py-3 text-sm font-black text-white shadow-lg shadow-pink-900/15 transition hover:bg-[#9d174d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            Tải toàn bộ dữ liệu (.CSV)
          </button>
        </div>

        <section className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-pink-50 text-pink-700">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">Tổng tài khoản khách hàng</p>
                <p className="text-2xl font-black text-slate-900">{customers.length}</p>
              </div>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <label className="relative min-w-0 flex-1 sm:w-80">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <span className="sr-only">Tìm khách hàng</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm theo tên, điện thoại, email"
                  className="min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-pink-400 focus:bg-white focus:ring-2 focus:ring-pink-100"
                />
              </label>
              <button
                type="button"
                onClick={() => void loadCustomers()}
                disabled={loading}
                aria-label="Tải lại danh sách"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-pink-200 hover:text-pink-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid min-h-72 place-items-center">
              <div className="text-center text-sm font-semibold text-slate-500">
                <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-pink-600" />
                Đang tải tài khoản khách hàng...
              </div>
            </div>
          ) : visibleCustomers.length === 0 ? (
            <div className="grid min-h-72 place-items-center px-6 text-center">
              <div>
                <Users className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 font-black text-slate-700">
                  {query ? 'Không tìm thấy khách hàng phù hợp' : 'Chưa có tài khoản khách hàng'}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {query ? 'Hãy thử tên, số điện thoại hoặc email khác.' : 'Tài khoản mới sẽ xuất hiện tại đây sau khi đăng ký.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left">
                <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="w-16 px-5 py-4 text-center">STT</th>
                    <th className="px-5 py-4">Tên người dùng</th>
                    <th className="px-5 py-4">Giới tính</th>
                    <th className="px-5 py-4">Ngày sinh</th>
                    <th className="px-5 py-4">Số điện thoại</th>
                    <th className="px-5 py-4">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleCustomers.map(({ customer, ordinal }) => (
                    <tr key={customer.id} className="transition hover:bg-pink-50/40">
                      <td className="px-5 py-4 text-center text-sm font-black text-slate-400">{ordinal}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pink-100 text-sm font-black text-pink-700">
                            {customer.fullName.trim().charAt(0).toLocaleUpperCase('vi-VN') || '?'}
                          </span>
                          <span className="text-sm font-black text-slate-800">{customer.fullName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-600">
                        {customer.gender ? genderLabel[customer.gender] : 'Chưa cập nhật'}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-600">{displayBirthDate(customer.dateOfBirth)}</td>
                      <td className="px-5 py-4 font-mono text-sm font-bold text-slate-700">{customer.phone}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-600">{customer.email || 'Chưa cập nhật'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {error && (
          <p role="alert" className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {error}
          </p>
        )}
      </main>
    </div>
  );
};
