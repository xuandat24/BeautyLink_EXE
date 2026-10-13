import React from 'react';

export function ReviewListStatus({ loading, error, total, page, pages, retry, previous, next }: {
  loading: boolean; error: string; total: number; page: number; pages: number;
  retry: () => void; previous: () => void; next: () => void;
}) {
  return <div aria-live="polite">
    {loading && <p role="status">Đang tải đánh giá…</p>}
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={retry}>Thử lại</button></div>}
    {!loading && !error && total === 0 && <p>Chưa có đánh giá cho lịch hẹn đã hoàn thành.</p>}
    {!loading && !error && pages > 1 && <nav aria-label="Trang đánh giá" className="flex gap-3">
      <button type="button" disabled={page === 0} onClick={previous}>Trang trước</button>
      <span>{page + 1} / {pages}</span>
      <button type="button" disabled={page + 1 >= pages} onClick={next}>Trang sau</button>
    </nav>}
  </div>;
}
