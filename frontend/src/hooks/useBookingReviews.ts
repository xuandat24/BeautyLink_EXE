import { useEffect, useState } from 'react';
import { beautyApi, getApiErrorMessage } from '../services/beautyApi';
import type { ServiceReviewItem } from '../services/reviewService';
import { validDatabaseId } from '../lib/reviewScope';

export function useBookingReviews(supplierId?: number, serviceId?: number, refresh = 0, expectedTarget?: 'SERVICE' | 'SUPPLIER') {
  const targetType = expectedTarget ?? (serviceId !== undefined ? 'SERVICE' : 'SUPPLIER');
  const id = targetType === 'SERVICE' ? serviceId : supplierId;
  const key = `${targetType}:${id}:${refresh}`;
  const [request, setRequest] = useState({ key, page: 0, attempt: 0 });
  const page = request.key === key ? request.page : 0;
  const [state, setState] = useState<{ key: string; page: number; reviews: ServiceReviewItem[]; error: string; loading: boolean; total: number; rating: number; pages: number }>({ key: '', page: 0, reviews: [], error: '', loading: false, total: 0, rating: 0, pages: 0 });
  useEffect(() => {
    let active = true;
    const empty = { key, page, reviews: [], error: '', loading: true, total: 0, rating: 0, pages: 0 };
    setState(empty);
    if (!validDatabaseId(id)) {
      setState({ ...empty, loading: false, error: 'Không xác định được đối tượng đánh giá.' });
      return () => { active = false; };
    }
    beautyApi.publicBookingReviews(targetType, id, page).then((result) => {
      if (!active) return;
      setState({ key, page, loading: false, error: '', total: result.totalElements, rating: result.rating, pages: result.totalPages,
        reviews: result.content.map((item) => ({
          id: String(item.id), serviceId: item.serviceId, serviceTitle: item.serviceName, salonName: '',
          authorName: item.reviewerDisplayName, rating: item.rating, date: new Date(item.createdAt).toLocaleDateString('vi-VN'),
          content: item.comment ?? '', verifiedBooking: true, images: item.images ?? [],
        })),
      });
    }).catch((err) => { if (active) setState({ ...empty, loading: false, error: getApiErrorMessage(err, 'Không thể tải đánh giá.') }); });
    return () => { active = false; };
  }, [key, id, targetType, page, request.attempt]);
  // Never render the previous item's data before the new effect has run.
  const current = state.key === key && state.page === page ? state : { reviews: [], error: '', loading: true, total: 0, rating: 0, pages: 0 };
  return { reviews: current.reviews, error: current.error, loading: current.loading,
    total: current.total, rating: current.rating, pages: current.pages, page,
    retry: () => setRequest({ key, page, attempt: request.attempt + 1 }),
    previous: () => setRequest({ key, page: Math.max(0, page - 1), attempt: 0 }),
    next: () => setRequest({ key, page: Math.max(0, Math.min(current.pages - 1, page + 1)), attempt: 0 }),
  };
}
