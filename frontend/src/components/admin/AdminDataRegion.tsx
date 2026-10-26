import React, { useEffect, useRef, useState } from 'react';
import { getAccessToken, getApiErrorMessage } from '../../services/beautyApi';
import type { AdminPage } from '../../types';

// Page-local cache only. Never shared across account IDs or persisted in browser storage.
export function useAdminResource<T>(key: string, load: () => Promise<T>, enabled = true) {
  const cache = useRef(new Map<string, { token: string | null; data: T }>()); const sequence = useRef(0);
  const [result, setResult] = useState<{ key: string; token: string | null; data: T } | null>(null);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  const loader = useRef(load); loader.current = load;
  useEffect(() => {
    const current = ++sequence.current; const token = getAccessToken(); setError('');
    if (!enabled) { setLoading(false); return; }
    const cached = cache.current.get(key);
    if (cached && cached.token === token) { setResult({ key, token, data: cached.data }); setLoading(false); return; }
    setLoading(true);
    loader.current().then(data => { if (current !== sequence.current || token !== getAccessToken()) return; cache.current.set(key, { token, data }); setResult({ key, token, data }); })
      .catch(e => { if (current === sequence.current && token === getAccessToken()) setError(getApiErrorMessage(e, 'Không thể tải dữ liệu.')); })
      .finally(() => { if (current === sequence.current && token === getAccessToken()) setLoading(false); });
    return () => { sequence.current++; };
  }, [key, enabled, retry]);
  return { data: result?.key === key && result.token === getAccessToken() ? result.data : null, loading, error, reload: () => { cache.current.delete(key); setRetry(v => v + 1); } };
}
export function AdminRegion({ loading, error, retry, children }: { loading: boolean; error: string; retry: () => void; children: React.ReactNode }) {
  return <section aria-busy={loading} className="min-w-0">{loading && <p role="status" className="py-3 text-sm text-slate-500">Đang cập nhật dữ liệu…</p>}{error && <p role="alert" className="my-3 text-sm text-rose-700">{error}<button type="button" onClick={retry} className="ml-3 underline">Thử lại</button></p>}{children}</section>;
}
export function AdminPagination({ data, page, onPage, disabled }: { data: Pick<AdminPage<unknown>, 'totalPages' | 'totalElements'>; page: number; onPage: (page: number) => void; disabled?: boolean }) {
  return <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 p-3 text-sm"><span className="mr-auto text-slate-500">{data.totalElements.toLocaleString('vi-VN')} kết quả</span><button type="button" className="admin-action" disabled={disabled || page === 0} onClick={() => onPage(page - 1)}>Trang trước</button><span>{page + 1}/{Math.max(1, data.totalPages)}</span><button type="button" className="admin-action" disabled={disabled || page + 1 >= data.totalPages} onClick={() => onPage(page + 1)}>Trang sau</button></div>;
}
