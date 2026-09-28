import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, LoaderCircle, LocateFixed, MapPin, Sparkles, X } from 'lucide-react';
import { getApiErrorMessage } from '../lib/api';
import { localizedCategoryName, useLanguage } from '../lib/language';
import { getBrowserCoordinates, getLocationFailureMessage } from '../lib/geolocation';
import { platformApi } from '../services/platformApi';
import type { LocationOption, ServiceCategory } from '../types';

interface LocationSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocationId: number | null;
  categories?: ServiceCategory[];
  onSelectLocation: (location: LocationOption, label: string) => void;
  onSelectCategory?: (category: ServiceCategory) => void;
  onGpsLocated?: (latitude: number, longitude: number, source: 'device' | 'network') => void;
}

const supportedCities = new Set(['ha-noi', 'ho-chi-minh']);

export const LocationSelectModal: React.FC<LocationSelectModalProps> = ({
  isOpen,
  onClose,
  selectedLocationId,
  categories = [],
  onSelectLocation,
  onSelectCategory,
  onGpsLocated,
}) => {
  const { language, text } = useLanguage();
  const [cities, setCities] = useState<LocationOption[]>([]);
  const [choice, setChoice] = useState<LocationOption | null>(null);
  const [categoryChoice, setCategoryChoice] = useState<ServiceCategory | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError('');
    platformApi.locations()
      .then((items) => {
        const available = items.filter((item) => supportedCities.has(item.slug));
        setCities(available);
        setChoice(available.find((item) => item.id === selectedLocationId) || null);
      })
      .catch((requestError) => setError(getApiErrorMessage(requestError, 'Không thể tải danh sách thành phố.')))
      .finally(() => setLoading(false));
  }, [isOpen, selectedLocationId]);

  if (!isOpen) return null;

  const confirm = () => {
    if (choice) onSelectLocation(choice, choice.name);
    onClose();
    if (categoryChoice) onSelectCategory?.(categoryChoice);
  };

  const detectCity = async () => {
    setLocating(true);
    setError('');
    try {
        const coords = await getBrowserCoordinates();
        const hanoi = { latitude: 21.0285, longitude: 105.8542 };
        const hochiminh = { latitude: 10.8231, longitude: 106.6297 };
        const distance = (point: typeof hanoi) => (coords.latitude - point.latitude) ** 2 + (coords.longitude - point.longitude) ** 2;
        const nearestSlug = distance(hanoi) <= distance(hochiminh) ? 'ha-noi' : 'ho-chi-minh';
        setChoice(cities.find((city) => city.slug === nearestSlug) || null);
        onGpsLocated?.(coords.latitude, coords.longitude, coords.source);
    } catch (locationError) {
      setError(getLocationFailureMessage(locationError, language));
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="location-title">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-white/70 bg-white shadow-2xl">
        <div className="relative bg-[#FFF0F3] px-6 py-7 sm:px-8">
          <button onClick={onClose} className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-white text-slate-500 shadow-sm hover:text-[#B42D58]" aria-label={text('Đóng', 'Close')}><X className="h-4 w-4" /></button>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#EB0F51] text-white shadow-lg shadow-pink-500/20"><MapPin className="h-5 w-5" /></span>
          <h2 id="location-title" className="mt-5 text-2xl font-black tracking-tight text-slate-900">{text('Bạn muốn làm đẹp ở đâu?', 'Where would you like your beauty service?')}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{text('Chọn thành phố và nhu cầu để BeautyLink đưa bạn đến đúng dịch vụ. Bạn vẫn có thể đóng cửa sổ để xem tất cả.', 'Choose a city and service type for a focused experience, or close this window to browse everything.')}</p>
        </div>

        <div className="grid gap-7 p-6 sm:p-8 md:grid-cols-[0.85fr_1.15fr]">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-black text-slate-800">1. {text('Chọn khu vực', 'Choose your city')}</h3><button type="button" onClick={detectCity} disabled={locating || loading} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-extrabold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50">{locating ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}{locating ? text('Đang định vị...', 'Locating...') : text('Dùng GPS', 'Use GPS')}</button></div>
          {loading ? <div className="grid h-36 place-items-center"><LoaderCircle className="h-7 w-7 animate-spin text-[#EB0F51]" /></div> : (
            <div className="grid gap-3">
              {cities.map((city) => {
                const selected = choice?.id === city.id;
                return <button key={city.id} type="button" onClick={() => setChoice(city)} className={`flex min-h-24 items-center justify-between rounded-3xl border p-5 text-left transition ${selected ? 'border-[#EB0F51] bg-[#FFF0F3] text-[#B42D58] shadow-sm ring-2 ring-pink-100' : 'border-slate-200 bg-white text-slate-700 hover:border-pink-300 hover:bg-pink-50'}`}><span><span className="block text-base font-black">{city.slug === 'ha-noi' ? 'Hà Nội' : text('TP. Hồ Chí Minh', 'Ho Chi Minh City')}</span><span className="mt-1 block text-xs font-medium text-slate-500">{text('Xem dịch vụ trong thành phố', 'Browse services in this city')}</span></span>{selected && <span className="grid h-7 w-7 place-items-center rounded-full bg-[#EB0F51] text-white"><Check className="h-4 w-4" /></span>}</button>;
              })}
            </div>
          )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-black text-slate-800">2. {text('Chọn loại hình dịch vụ', 'Choose a service type')}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {categories.map((category) => {
                const selected = categoryChoice?.id === category.id;
                return <button key={category.id} type="button" onClick={() => setCategoryChoice(category)} className={`group overflow-hidden rounded-2xl border text-left transition ${selected ? 'border-[#EB0F51] bg-pink-50 ring-2 ring-pink-100' : 'border-slate-200 hover:border-pink-300'}`}><img src={category.imageUrl} alt="" className="h-20 w-full object-cover" /><span className="flex items-center justify-between gap-2 p-3"><span className="text-xs font-extrabold text-slate-800">{localizedCategoryName(category.slug, category.name, language)}</span>{selected && <Check className="h-4 w-4 shrink-0 text-[#EB0F51]" />}</span></button>;
              })}
            </div>
            {categories.length === 0 && <div className="grid min-h-36 place-items-center rounded-2xl bg-slate-50"><LoaderCircle className="h-6 w-6 animate-spin text-[#EB0F51]" /></div>}
          </section>

          {error && <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 md:col-span-2">{error}</p>}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between md:col-span-2">
            <button type="button" onClick={onClose} className="min-h-11 rounded-2xl border border-slate-200 px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-50">{text('Để sau, xem tất cả', 'Maybe later, browse all')}</button>
            <button type="button" onClick={confirm} disabled={!choice || !categoryChoice || loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#EB0F51] px-7 text-sm font-extrabold text-white shadow-lg shadow-pink-500/20 transition hover:bg-[#B42D58] disabled:cursor-not-allowed disabled:opacity-40"><Sparkles className="h-4 w-4" />{text('Khám phá dịch vụ phù hợp', 'Explore matching services')}<ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
};
