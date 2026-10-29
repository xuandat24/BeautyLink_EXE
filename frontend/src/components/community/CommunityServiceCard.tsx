import type { CommunityServiceCard as Service } from '../../types/community';
export function CommunityServiceCard({ service, onView, onBook }: { service: Service; onView: (id: number) => void; onBook: (id: number) => void }) {
  return <section aria-label={`Dịch vụ ${service.name}`} className="flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-pink-100 bg-pink-50/60 p-3">
    {service.image && <img src={service.image} alt="" loading="lazy" className="h-16 w-16 rounded-xl object-cover" />}
    <div className="min-w-0 flex-1 basis-48"><p className="text-xs text-slate-500">Dịch vụ tham khảo · {service.salonName}</p><p className="break-words font-bold text-slate-900">{service.name}</p><p className="text-sm font-bold text-pink-700"><span className="whitespace-nowrap">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(service.price)}</span> <span className="font-normal text-slate-500">· {service.durationMinutes} phút</span></p>{service.reviewCount > 0 && <p className="text-xs text-slate-600">{service.rating.toFixed(1)} / 5 · {service.reviewCount} đánh giá đặt lịch</p>}</div>
    <div className="flex w-full flex-wrap gap-2 sm:w-auto"><button type="button" onClick={() => onView(service.id)} className="min-h-10 rounded-xl border border-pink-200 bg-white px-3 text-sm font-semibold text-pink-700">Xem dịch vụ</button><button type="button" onClick={() => onBook(service.id)} className="min-h-10 rounded-xl bg-pink-600 px-3 text-sm font-bold text-white">Đặt lịch</button></div>
  </section>;
}
