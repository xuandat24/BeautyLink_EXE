import { useEffect, useState } from 'react';
import { beautyApi, getApiErrorMessage } from '../services/beautyApi';
import type { ServiceReviewItem } from '../services/reviewService';

export function useBookingReviews(supplierId?: number, serviceId?: number, refresh = 0) {
  const [reviews, setReviews] = useState<ServiceReviewItem[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setReviews([]); setError('');
    if (!supplierId || !Number.isFinite(supplierId)) return;
    beautyApi.publicBookingReviews(supplierId).then((items) => {
      if (!active) return;
      setReviews(items.filter((item) => serviceId !== undefined ? item.targetType === 'SERVICE' && item.serviceId === serviceId : item.targetType === 'SUPPLIER').map((item) => ({
        id: String(item.id), serviceId: item.serviceId, serviceTitle: item.serviceName, salonName: '',
        authorName: item.reviewerDisplayName, rating: item.rating, date: new Date(item.createdAt).toLocaleDateString('vi-VN'),
        content: item.comment ?? '', verifiedBooking: true,
      })));
    }).catch((err) => { if (active) setError(getApiErrorMessage(err, 'Không thể tải đánh giá.')); });
    return () => { active = false; };
  }, [supplierId, serviceId, refresh]);
  return { reviews, error };
}
