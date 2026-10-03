import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, BadgeCheck, Check, ChevronRight, Clock3, ExternalLink,
  LoaderCircle, MapPin, Search, Share2, ShieldCheck, ShoppingBag, Sparkles, Star,
  Store, Tag, UsersRound,
} from 'lucide-react';
import { getApiErrorMessage } from '../lib/api';
import { useLanguage } from '../lib/language';
import { platformApi } from '../services/platformApi';
import type { BeautyService, CurrentUser, PublicSupplierShop } from '../types';
import { BookingDialog } from './ServicePage';

type ShopTab = 'services' | 'reviews' | 'about';

interface ShopPageProps {
  supplierId: number;
  currentUser: CurrentUser | null;
  onBack: () => void;
  onNeedLogin: () => void;
  onBookingCreated: (message: string) => void;
}

const formatMoney = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
const categoryName: Record<string, string> = { makeup: 'Trang điểm', hair: 'Tóc', spa: 'Spa & massage', nails: 'Nail', skincare: 'Chăm sóc da' };

const RatingStars: React.FC<{ rating: number; size?: string }> = ({ rating, size = 'h-4 w-4' }) => (
  <span className="inline-flex" aria-label={`${rating} trên 5 sao`}>
    {[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`${size} ${star <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-200'}`} />)}
  </span>
);

const ShopImage: React.FC<{ src?: string | null; alt: string; className: string }> = ({ src, alt, className }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className={`${className} grid place-items-center bg-gradient-to-br from-pink-100 to-rose-50`}><Sparkles className="h-8 w-8 text-pink-400" /></div>;
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
};

export const ShopPage: React.FC<ShopPageProps> = ({ supplierId, currentUser, onBack, onNeedLogin, onBookingCreated }) => {
  const { text } = useLanguage();
  const [shop, setShop] = useState<PublicSupplierShop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<ShopTab>('services');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'featured' | 'price-asc' | 'rating'>('featured');
  const [bookingService, setBookingService] = useState<BeautyService | null>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    platformApi.supplierShop(supplierId)
      .then((result) => { if (active) setShop(result); })
      .catch((requestError) => { if (active) setError(getApiErrorMessage(requestError, 'Không thể tải cửa hàng.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [supplierId]);

  const categories = useMemo(() => Array.from(new Set(shop?.services.map((service) => service.categorySlug) ?? [])), [shop]);
  const filteredServices = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi');
    const result = (shop?.services ?? []).filter((service) =>
      (category === 'all' || service.categorySlug === category)
      && (!normalizedQuery || `${service.name} ${service.description}`.toLocaleLowerCase('vi').includes(normalizedQuery))
    );
    return [...result].sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'rating') return b.rating - a.rating;
      return Number(b.featured) - Number(a.featured) || b.id - a.id;
    });
  }, [shop, category, query, sort]);

  const shareShop = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShared(true);
      window.setTimeout(() => setShared(false), 1800);
    } catch {
      setShared(false);
    }
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#fff7f9]"><div className="text-center"><LoaderCircle className="mx-auto h-9 w-9 animate-spin text-pink-600" /><p className="mt-3 text-sm font-bold text-slate-500">{text('Đang mở cửa hàng...', 'Opening shop...')}</p></div></div>;
  if (error || !shop) return <div className="grid min-h-screen place-items-center bg-[#fff7f9] p-5"><div className="max-w-md rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-xl"><Store className="mx-auto h-10 w-10 text-rose-400" /><h1 className="mt-4 text-xl font-black">{text('Không thể mở cửa hàng', 'Unable to open shop')}</h1><p className="mt-2 text-sm text-slate-500">{error}</p><button onClick={onBack} className="mt-6 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white">{text('Về trang chủ', 'Back home')}</button></div></div>;

  const mapAvailable = shop.latitude != null && shop.longitude != null;
  const joined = new Date(shop.joinedAt).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#fff7f9] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-pink-100 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <button onClick={onBack} className="inline-flex shrink-0 items-center gap-2 rounded-full px-2 py-2 text-sm font-black text-slate-600 hover:bg-pink-50 hover:text-pink-700"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">{text('Trang chủ', 'Home')}</span></button>
          <div className="hidden shrink-0 items-center text-lg font-black sm:flex">Beauty<span className="text-pink-600">Link</span></div>
          <label className="relative mx-auto w-full max-w-2xl"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); setActiveTab('services'); }} placeholder={text(`Tìm trong ${shop.name}`, `Search in ${shop.name}`)} className="h-11 w-full rounded-full border border-pink-200 bg-pink-50/60 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-pink-400 focus:bg-white focus:ring-4 focus:ring-pink-100" /></label>
          <button onClick={shareShop} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-slate-200 px-3 text-xs font-black text-slate-600 hover:border-pink-200 hover:text-pink-700">{shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}<span className="hidden sm:inline">{shared ? text('Đã sao chép', 'Copied') : text('Chia sẻ', 'Share')}</span></button>
        </div>
      </header>

      <section className="relative overflow-hidden bg-slate-950 text-white">
        <ShopImage src={shop.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40 blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-[#9d174d]/65" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:py-14">
          <ShopImage src={shop.imageUrl} alt={shop.name} className="h-28 w-28 shrink-0 rounded-[1.8rem] border-4 border-white object-cover shadow-2xl sm:h-36 sm:w-36" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-1 text-[11px] font-black text-emerald-200 ring-1 ring-emerald-300/30"><BadgeCheck className="h-3.5 w-3.5" />{text('Đã xác minh', 'Verified')}</span><span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/80">{shop.businessType}</span></div>
            <h1 className="mt-3 truncate text-3xl font-black tracking-tight sm:text-4xl">{shop.name}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-white/70"><MapPin className="h-4 w-4 text-pink-300" />{shop.addressLine}{shop.locationName ? `, ${shop.locationName}` : ''}</p>
            <div className="mt-5 flex flex-wrap gap-x-7 gap-y-3 text-sm"><span><strong className="text-lg text-pink-300">{shop.rating.toFixed(1)}</strong><span className="ml-1.5 text-white/65">{text('Điểm', 'Rating')}</span></span><span><strong className="text-lg">{shop.reviewCount.toLocaleString('vi-VN')}</strong><span className="ml-1.5 text-white/65">{text('Đánh giá', 'Reviews')}</span></span><span><strong className="text-lg">{shop.services.length}</strong><span className="ml-1.5 text-white/65">{text('Dịch vụ', 'Services')}</span></span></div>
          </div>
          <button onClick={() => { setActiveTab('services'); document.getElementById('shop-content')?.scrollIntoView({ behavior: 'smooth' }); }} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#EB0F51] px-6 text-sm font-black text-white shadow-xl shadow-pink-950/30 transition hover:bg-pink-500"><ShoppingBag className="h-5 w-5" />{text('Đặt dịch vụ', 'Book a service')}</button>
        </div>
      </section>

      <nav className="border-b border-pink-100 bg-white">
        <div className="mx-auto flex max-w-7xl overflow-x-auto px-4 sm:px-6">
          {([['services', text('Dịch vụ', 'Services'), ShoppingBag], ['reviews', text('Đánh giá', 'Reviews'), Star], ['about', text('Thông tin & vị trí', 'About & location'), MapPin]] as const).map(([key, label, Icon]) => <button key={key} onClick={() => setActiveTab(key)} className={`relative inline-flex min-w-max items-center gap-2 px-5 py-4 text-sm font-black transition ${activeTab === key ? 'text-[#EB0F51]' : 'text-slate-500 hover:text-slate-900'}`}><Icon className="h-4 w-4" />{label}{activeTab === key && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#EB0F51]" />}</button>)}
        </div>
      </nav>

      <main id="shop-content" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {activeTab === 'services' && <>
          <div className="flex flex-col justify-between gap-4 rounded-3xl border border-pink-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2"><button onClick={() => setCategory('all')} className={`rounded-full px-4 py-2 text-xs font-black ${category === 'all' ? 'bg-[#EB0F51] text-white' : 'bg-slate-100 text-slate-600 hover:bg-pink-50'}`}>{text('Tất cả', 'All')} ({shop.services.length})</button>{categories.map((slug) => <button key={slug} onClick={() => setCategory(slug)} className={`rounded-full px-4 py-2 text-xs font-black ${category === slug ? 'bg-[#EB0F51] text-white' : 'bg-slate-100 text-slate-600 hover:bg-pink-50'}`}>{categoryName[slug] || slug}</button>)}</div>
            <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-pink-400"><option value="featured">{text('Nổi bật', 'Featured')}</option><option value="price-asc">{text('Giá thấp đến cao', 'Lowest price')}</option><option value="rating">{text('Đánh giá cao', 'Highest rated')}</option></select>
          </div>
          <div className="mt-5 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-pink-600">{text('Danh mục cửa hàng', 'Shop catalog')}</p><h2 className="mt-1 text-2xl font-black">{text('Dịch vụ đang mở bán', 'Available services')}</h2></div><span className="text-xs font-bold text-slate-400">{filteredServices.length} {text('kết quả', 'results')}</span></div>
          {filteredServices.length ? <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filteredServices.map((service) => <article key={service.id} className="group overflow-hidden rounded-3xl border border-pink-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-pink-950/10">
            <div className="relative h-48 overflow-hidden"><ShopImage src={service.imageUrl} alt={service.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />{service.featured && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#EB0F51] px-2.5 py-1 text-[10px] font-black text-white"><Tag className="h-3 w-3" />{text('Nổi bật', 'Featured')}</span>}</div>
            <div className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-pink-600">{categoryName[service.categorySlug] || service.categorySlug}</p><h3 className="mt-1.5 line-clamp-2 min-h-11 text-base font-black leading-snug">{service.name}</h3><div className="mt-2 flex items-center gap-2"><RatingStars rating={service.rating} size="h-3.5 w-3.5" /><span className="text-[11px] font-bold text-slate-400">({service.serviceReviewCount})</span></div><p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">{service.description}</p><div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-400"><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{service.durationMinutes} phút</span>{service.practitioners.length > 0 && <span className="inline-flex items-center gap-1"><UsersRound className="h-3.5 w-3.5" />{service.practitioners.length}</span>}</div><div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-4"><div>{service.originalPrice > service.price && <p className="text-[10px] text-slate-400 line-through">{formatMoney(service.originalPrice)}</p>}<p className="text-base font-black text-[#EB0F51]">{formatMoney(service.price)}</p></div><button onClick={() => setBookingService(service)} className="rounded-xl bg-slate-900 px-3.5 py-2.5 text-xs font-black text-white hover:bg-[#EB0F51]">{text('Đặt lịch', 'Book')}</button></div></div>
          </article>)}</div> : <div className="mt-5 rounded-3xl border border-dashed border-pink-200 bg-white p-12 text-center"><Search className="mx-auto h-9 w-9 text-pink-300" /><h3 className="mt-3 font-black">{text('Không tìm thấy dịch vụ', 'No services found')}</h3><button onClick={() => { setQuery(''); setCategory('all'); }} className="mt-3 text-xs font-black text-pink-700 hover:underline">{text('Xóa bộ lọc', 'Clear filters')}</button></div>}
        </>}

        {activeTab === 'reviews' && <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="h-fit rounded-3xl border border-pink-100 bg-white p-6 text-center shadow-sm lg:sticky lg:top-24"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{text('Điểm cửa hàng', 'Shop rating')}</p><p className="mt-2 text-6xl font-black text-[#EB0F51]">{shop.rating.toFixed(1)}</p><div className="mt-3 flex justify-center"><RatingStars rating={shop.rating} size="h-5 w-5" /></div><p className="mt-3 text-sm font-bold text-slate-500">{shop.reviewCount.toLocaleString('vi-VN')} {text('lượt đánh giá', 'ratings')}</p><p className="mt-5 rounded-2xl bg-emerald-50 p-3 text-xs font-semibold leading-5 text-emerald-800"><ShieldCheck className="mr-1 inline h-4 w-4" />{text('Đánh giá viết được xác thực từ đơn hàng đã thanh toán.', 'Written reviews are verified from paid bookings.')}</p></aside>
          <section><div className="mb-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-pink-600">{text('Khách hàng nói gì', 'Customer feedback')}</p><h2 className="mt-1 text-2xl font-black">{text('Đánh giá thực tế', 'Verified reviews')}</h2></div>{shop.reviews.length ? <div className="space-y-3">{shop.reviews.map((review) => <article key={review.id} className="rounded-3xl border border-pink-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-pink-100 text-sm font-black text-pink-700">{review.reviewerDisplayName.charAt(0)}</span><div><p className="text-sm font-black">{review.reviewerDisplayName}</p><p className="text-[11px] text-slate-400">{new Date(review.createdAt).toLocaleDateString('vi-VN')}</p></div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${review.targetType === 'SUPPLIER' ? 'bg-pink-50 text-pink-700' : 'bg-amber-50 text-amber-700'}`}>{review.targetType === 'SUPPLIER' ? text('Cửa hàng', 'Shop') : text('Dịch vụ', 'Service')}</span></div><div className="mt-3"><RatingStars rating={review.rating} /></div>{review.comment && <p className="mt-3 text-sm leading-6 text-slate-600">{review.comment}</p>}<button onClick={() => { setActiveTab('services'); setQuery(review.serviceName); }} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-pink-700 hover:underline">{review.serviceName}<ChevronRight className="h-3 w-3" /></button></article>)}</div> : <div className="rounded-3xl border border-dashed border-pink-200 bg-white p-12 text-center"><Star className="mx-auto h-9 w-9 text-pink-300" /><h3 className="mt-3 font-black">{text('Chưa có nhận xét bằng chữ', 'No written reviews yet')}</h3><p className="mt-1 text-sm text-slate-500">{text('Hãy là khách hàng đầu tiên chia sẻ trải nghiệm.', 'Be the first customer to share an experience.')}</p></div>}</section>
        </div>}

        {activeTab === 'about' && <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-3xl border border-pink-100 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.18em] text-pink-600">{text('Về cửa hàng', 'About this shop')}</p><h2 className="mt-1 text-2xl font-black">{shop.name}</h2><p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">{shop.description || text('Nhà cung cấp dịch vụ làm đẹp đã được BeautyLink xác minh.', 'A verified BeautyLink service provider.')}</p><dl className="mt-6 space-y-4 border-t border-slate-100 pt-5 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-400">{text('Loại hình', 'Business type')}</dt><dd className="text-right font-black">{shop.businessType}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-400">{text('Tham gia', 'Joined')}</dt><dd className="font-black">{joined}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-400">{text('Trạng thái', 'Status')}</dt><dd className="inline-flex items-center gap-1 font-black text-emerald-700"><BadgeCheck className="h-4 w-4" />{text('Đã xác minh', 'Verified')}</dd></div></dl></section>
          <section className="overflow-hidden rounded-3xl border border-pink-100 bg-white shadow-sm"><div className="flex items-start justify-between gap-4 p-5"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-pink-600">{text('Địa chỉ cửa hàng', 'Shop location')}</p><h2 className="mt-1 text-lg font-black">{shop.addressLine}</h2><p className="mt-1 text-xs font-semibold text-slate-400">{shop.locationName}</p></div>{mapAvailable && <a href={`https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-pink-700">{text('Mở bản đồ', 'Open map')}<ExternalLink className="h-3 w-3" /></a>}</div>{mapAvailable ? <iframe title={`Bản đồ ${shop.name}`} loading="lazy" className="h-[360px] w-full border-0" src={`https://www.openstreetmap.org/export/embed.html?bbox=${shop.longitude! - 0.01}%2C${shop.latitude! - 0.008}%2C${shop.longitude! + 0.01}%2C${shop.latitude! + 0.008}&layer=mapnik&marker=${shop.latitude}%2C${shop.longitude}`} /> : <div className="grid h-72 place-items-center bg-slate-100 text-center"><div><MapPin className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-2 text-sm font-bold text-slate-500">{text('Cửa hàng chưa cập nhật tọa độ GPS.', 'This shop has not added GPS coordinates yet.')}</p></div></div>}</section>
        </div>}
      </main>

      {bookingService && <BookingDialog service={bookingService} currentUser={currentUser} onClose={() => setBookingService(null)} onNeedLogin={onNeedLogin} onOpenShop={() => setBookingService(null)} onCreated={(code) => { setBookingService(null); onBookingCreated(text(`Đặt lịch thành công · Mã ${code}`, `Booking confirmed · Code ${code}`)); }} />}
    </div>
  );
};
