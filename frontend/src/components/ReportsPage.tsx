import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Loader2,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Save,
} from 'lucide-react';
import { BackendReport } from '../types';
import { beautyApi, getApiErrorMessage } from '../services/beautyApi';

interface ReportsPageProps {
  onBack: () => void;
}

const statusLabel: Record<string, string> = {
  OPEN: 'Mới',
  IN_REVIEW: 'Đang xử lý',
  RESOLVED: 'Đã giải quyết',
  REJECTED: 'Từ chối',
};

export const ReportsPage: React.FC<ReportsPageProps> = ({ onBack }) => {
  const [reports, setReports] = useState<BackendReport[]>([]);
  const [selected, setSelected] = useState<BackendReport | null>(null);
  const [status, setStatus] = useState<string>('IN_REVIEW');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    beautyApi
      .reports()
      .then((data) => {
        setReports(data);
        setSelected(data[0] || null);
      })
      .catch((err) => setError(getApiErrorMessage(err, 'Không thể tải báo cáo hỗ trợ.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selected) {
      setStatus(selected.status);
      setNote(selected.resolutionNote || '');
    }
  }, [selected]);

  const pendingCount = useMemo(
    () => reports.filter((r) => r.status === 'OPEN' || r.status === 'IN_REVIEW').length,
    [reports]
  );

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const updated = await beautyApi.updateReport(selected.id, status, note.trim() || undefined);
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSelected(updated);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể lưu kết quả xử lý.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-600 hover:text-pink-700 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Trang chủ
          </button>
          <span className="text-lg font-black tracking-tight">
            Beauty<span className="text-pink-600">Link</span> Operations
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-pink-600">
            Nhân viên & quản trị
          </p>
          <h1 className="mt-2 text-3xl font-black">Trung tâm hỗ trợ</h1>
          <p className="mt-2 text-sm text-slate-500">
            Tiếp nhận phản hồi, gán trạng thái và lưu kết quả xử lý.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">Tổng phản hồi</span>
              <FileText className="h-5 w-5 text-slate-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">{reports.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">Cần xử lý</span>
              <AlertCircle className="h-5 w-5 text-amber-500" />
            </div>
            <p className="mt-2 text-2xl font-black text-amber-600">{pendingCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">Đã kết thúc</span>
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-600">
              {reports.length - pendingCount}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid h-64 place-items-center">
            <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
            {/* Reports Queue */}
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4 text-sm font-black">
                Hàng đợi phản hồi
              </div>
              <div className="max-h-[620px] overflow-y-auto">
                {reports.length === 0 ? (
                  <p className="p-8 text-center text-sm text-slate-400">
                    Chưa có phản hồi nào.
                  </p>
                ) : (
                  reports.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelected(item)}
                      className={`w-full border-b border-slate-100 p-4 text-left transition ${
                        selected?.id === item.id ? 'bg-pink-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-400">
                          #{item.id} · {item.targetType}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-pink-700 shadow-sm">
                          {statusLabel[item.status] || item.status}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-1 text-sm font-black text-slate-800">
                        {item.reason}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                        {item.details}
                      </p>
                      <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-slate-400">
                        <Clock className="h-3 w-3" />
                        {new Date(item.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </section>

            {/* Report Detail & Action Pane */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {selected ? (
                <>
                  <div className="border-b border-slate-100 pb-5">
                    <p className="text-xs font-black uppercase tracking-wider text-pink-600">
                      Phản hồi #{selected.id}
                    </p>
                    <h2 className="mt-2 text-2xl font-black">{selected.reason}</h2>
                    <p className="mt-2 text-sm text-slate-500">
                      Người gửi: <strong>{selected.reporterName}</strong> · Đối tượng{' '}
                      {selected.targetType} #{selected.targetId}
                    </p>
                  </div>

                  <div className="py-5">
                    <p className="text-xs font-black uppercase text-slate-400">Nội dung</p>
                    <p className="mt-2 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                      {selected.details}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label>
                      <span className="mb-2 block text-xs font-black text-slate-700">
                        Trạng thái
                      </span>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-pink-400 bg-white"
                      >
                        <option value="OPEN">Mới</option>
                        <option value="IN_REVIEW">Đang xử lý</option>
                        <option value="RESOLVED">Đã giải quyết</option>
                        <option value="REJECTED">Từ chối</option>
                      </select>
                    </label>

                    <label>
                      <span className="mb-2 block text-xs font-black text-slate-700">
                        Ghi chú xử lý
                      </span>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={1000}
                        placeholder="Nội dung phản hồi hoặc phương án đã xử lý..."
                        className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-pink-400"
                      />
                    </label>
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-extrabold text-white hover:bg-pink-700 disabled:opacity-50 transition"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Lưu kết quả
                  </button>
                </>
              ) : (
                <div className="grid h-72 place-items-center text-sm text-slate-400">
                  Chọn một phản hồi để xử lý.
                </div>
              )}
            </section>
          </div>
        )}

        {error && (
          <p className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {error}
          </p>
        )}
      </main>
    </div>
  );
};
