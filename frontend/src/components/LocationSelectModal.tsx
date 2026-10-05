import React, { useState, useEffect } from 'react';
import {
  MapPin,
  X,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { BackendLocation } from '../types';
import { beautyApi } from '../services/beautyApi';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface LocationSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocationId: number | null;
  selectedIntentCategory?: string | null;
  required?: boolean;
  onSelectLocation: (location: BackendLocation, name: string, categorySlug?: string) => void;
}

interface ServiceCardOption {
  slug: string;
  name: string;
  desc: string;
  tag: string;
  bgImage: string;
  iconEmoji: string;
}

const SERVICE_CARD_OPTIONS: ServiceCardOption[] = [
  {
    slug: 'makeup',
    name: 'Trang Điểm & Makeup',
    desc: 'Dự tiệc, cô dâu, sự kiện & cá nhân',
    tag: 'Cô dâu & Tiệc',
    bgImage: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=700&q=80',
    iconEmoji: '💄',
  },
  {
    slug: 'hair',
    name: 'Làm Tóc & Tạo Kiểu',
    desc: 'Cắt layer, uốn sóng lơi, nhuộm & phục hồi',
    tag: 'Stylist tạo kiểu',
    bgImage: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=700&q=80',
    iconEmoji: '✂️',
  },
  {
    slug: 'spa',
    name: 'Spa & Massage Body',
    desc: 'Massage tinh dầu, đá nóng & thư giãn',
    tag: 'Thư giãn 5★',
    bgImage: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=700&q=80',
    iconEmoji: '💆',
  },
  {
    slug: 'nails',
    name: 'Nail & Nối Mi Thiết Kế',
    desc: 'Sơn gel thạch, móng mắt mèo & nối mi',
    tag: 'Chuẩn phong cách Hàn',
    bgImage: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=700&q=80',
    iconEmoji: '💅',
  },
  {
    slug: 'skincare',
    name: 'Chăm Sóc Da & Clinic',
    desc: 'Trị mụn y khoa, cấy vi chất & căng bóng da',
    tag: 'Chuẩn Y Khoa',
    bgImage: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=700&q=80',
    iconEmoji: '🫧',
  },
  {
    slug: 'duong-sinh',
    name: 'Gội Đầu Dưỡng Sinh',
    desc: 'Bồ kết 12 vị & đả thông kinh lạc cổ vai gáy',
    tag: 'Đông Y Thảo Mộc',
    bgImage: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=700&q=80',
    iconEmoji: '🌿',
  },
  {
    slug: 'all',
    name: 'Khám Phá Tất Cả',
    desc: 'Xem toàn bộ 2.000+ dịch vụ & ưu đãi hot nhất',
    tag: 'Toàn bộ danh mục',
    bgImage: 'https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=700&q=80',
    iconEmoji: '✨',
  },
];

const DEFAULT_HCM_LOC: BackendLocation = {
  id: 1,
  name: 'TP. Hồ Chí Minh',
  slug: 'ho-chi-minh',
  type: 'PROVINCE_CITY',
};

const DEFAULT_HN_LOC: BackendLocation = {
  id: 2,
  name: 'Hà Nội',
  slug: 'ha-noi',
  type: 'PROVINCE_CITY',
};

export const LocationSelectModal: React.FC<LocationSelectModalProps> = ({
  isOpen,
  onClose,
  selectedLocationId,
  selectedIntentCategory = 'all',
  required = false,
  onSelectLocation,
}) => {
  const [locations, setLocations] = useState<BackendLocation[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<BackendLocation>(
    selectedLocationId === 2 ? DEFAULT_HN_LOC : DEFAULT_HCM_LOC
  );
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setStep(1);
      beautyApi
        .locations()
        .then((data) => {
          if (data && data.length > 0) {
            setLocations(data);
            const found = data.find((l) => l.id === selectedLocationId);
            if (found) setSelectedLoc(found);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen, selectedLocationId]);

  // Lock body scroll when modal is open
  useBodyScrollLock(isOpen);

  // Close on ESC key if not required
  useEffect(() => {
    if (!isOpen || required) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, required, onClose]);

  const currentCityName =
    selectedLoc?.slug === 'ha-noi' ? 'Hà Nội' : 'TP. Hồ Chí Minh';

  const hcmLoc = locations.find((l) => l.slug === 'ho-chi-minh') || DEFAULT_HCM_LOC;
  const hnLoc = locations.find((l) => l.slug === 'ha-noi') || DEFAULT_HN_LOC;

  // Bấm chọn thành phố -> chuyển mượt sang Bước 2
  const handleSelectCity = (loc: BackendLocation) => {
    setSelectedLoc(loc);
    setStep(2);
  };

  // Bấm chọn dịch vụ -> đóng modal và nhảy thẳng sang trang dịch vụ đó
  const handleSelectServiceAndProceed = (serviceSlug: string) => {
    onSelectLocation(selectedLoc, currentCityName, serviceSlug);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 overflow-hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Blurred & Dimmed Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 cursor-pointer"
        onClick={() => !required && onClose()}
        aria-hidden="true"
      />

      {/* Pristine Modal Card */}
      <div
        className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-[2rem] border border-pink-100/80 bg-white shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Thanh Lịch */}
        <div className="shrink-0 bg-gradient-to-r from-pink-50/90 via-white to-pink-50/90 px-6 py-4 sm:px-7 sm:py-5 border-b border-pink-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-[#EB0F51] to-[#B42D58] text-white flex items-center justify-center shrink-0 shadow-md shadow-pink-500/20">
              {step === 1 ? <MapPin className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base sm:text-xl font-black text-slate-900 leading-tight">
                {step === 1 ? 'Chọn thành phố của bạn' : 'Hôm nay bạn muốn làm đẹp gì?'}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {step === 1
                  ? 'Chọn khu vực để khám phá chuyên gia uy tín và ưu đãi gần bạn nhất'
                  : `Đang chọn: ${currentCityName} · Nhấp vào dịch vụ để khám phá ngay`}
              </p>
            </div>
          </div>

          {!required && (
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 hover:text-[#EB0F51] hover:bg-pink-100 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
              title="Đóng (ESC)"
            >
              <X className="h-4 w-4 stroke-[2.5]" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-5 sm:p-7 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="grid h-44 place-items-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#EB0F51]" />
            </div>
          ) : step === 1 ? (
            /* BƯỚC 1: CHỌN THÀNH PHỐ VỚI HÌNH NỀN BACKGROUND NỔI BẬT & LỚN HƠN */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. TP. Hồ Chí Minh */}
                <button
                  type="button"
                  onClick={() => handleSelectCity(hcmLoc)}
                  className={`group relative h-44 sm:h-52 rounded-3xl overflow-hidden cursor-pointer border-2 text-left p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-pink-500/30 ${
                    selectedLoc.slug === 'ho-chi-minh'
                      ? 'border-[#EB0F51] ring-2 ring-pink-400/40 shadow-xl'
                      : 'border-white/40 hover:border-[#EB0F51]'
                  }`}
                >
                  {/* Background Image với hiệu ứng zoom */}
                  <img
                    src="https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=900&q=80"
                    alt="TP. Hồ Chí Minh"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
                  />
                  {/* Lớp phủ gradient tối mịn */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-slate-900/20" />

                  {/* Top Badge */}
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-bold border border-white/20 shadow-xs">
                      ✦ 1.500+ Địa điểm
                    </span>
                    {selectedLoc.slug === 'ho-chi-minh' && (
                      <span className="w-7 h-7 rounded-full bg-[#EB0F51] text-white flex items-center justify-center shadow-md">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    )}
                  </div>

                  {/* Bottom Content */}
                  <div className="relative z-10 text-white">
                    <h4 className="text-xl sm:text-2xl font-black tracking-tight group-hover:text-pink-200 transition-colors">
                      TP. Hồ Chí Minh
                    </h4>
                    <p className="text-xs text-white/80 line-clamp-1 mt-1 font-medium">
                      Sôi động với hàng ngàn salon tóc, spa trị liệu & clinic làm đẹp
                    </p>
                    <span className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-black text-pink-300 group-hover:text-white transition-colors">
                      Chọn khu vực này <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </button>

                {/* 2. Hà Nội */}
                <button
                  type="button"
                  onClick={() => handleSelectCity(hnLoc)}
                  className={`group relative h-44 sm:h-52 rounded-3xl overflow-hidden cursor-pointer border-2 text-left p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-pink-500/30 ${
                    selectedLoc.slug === 'ha-noi'
                      ? 'border-[#EB0F51] ring-2 ring-pink-400/40 shadow-xl'
                      : 'border-white/40 hover:border-[#EB0F51]'
                  }`}
                >
                  {/* Background Image với hiệu ứng zoom */}
                  <img
                    src="https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=900&q=80"
                    alt="Hà Nội"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
                  />
                  {/* Lớp phủ gradient tối mịn */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-slate-900/20" />

                  {/* Top Badge */}
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-bold border border-white/20 shadow-xs">
                      ✦ 1.200+ Địa điểm
                    </span>
                    {selectedLoc.slug === 'ha-noi' && (
                      <span className="w-7 h-7 rounded-full bg-[#EB0F51] text-white flex items-center justify-center shadow-md">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    )}
                  </div>

                  {/* Bottom Content */}
                  <div className="relative z-10 text-white">
                    <h4 className="text-xl sm:text-2xl font-black tracking-tight group-hover:text-pink-200 transition-colors">
                      Hà Nội
                    </h4>
                    <p className="text-xs text-white/80 line-clamp-1 mt-1 font-medium">
                      Dưỡng sinh Đông y, trị liệu da chuẩn y khoa & làm tóc cao cấp
                    </p>
                    <span className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-black text-pink-300 group-hover:text-white transition-colors">
                      Chọn khu vực này <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            /* BƯỚC 2: HÔM NAY BẠN MUỐN LÀM ĐẸP GÌ VỚI HÌNH NỀN BACKGROUND MỖI LỰA CHỌN */
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-pink-700 hover:text-[#EB0F51] transition cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Đổi thành phố ({currentCityName})
                </button>
                <span className="text-[11px] text-slate-500 font-semibold">
                  Chạm vào lựa chọn để xem dịch vụ ngay
                </span>
              </div>

              {/* Lưới các dịch vụ có hình nền Background đẹp mắt */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                {SERVICE_CARD_OPTIONS.map((opt) => (
                  <button
                    key={opt.slug}
                    type="button"
                    onClick={() => handleSelectServiceAndProceed(opt.slug)}
                    className="group relative h-28 sm:h-32 rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer border-2 border-white/50 hover:border-[#EB0F51] text-left p-3.5 sm:p-4 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-xl hover:shadow-pink-500/25 active:scale-98"
                  >
                    {/* Background Image */}
                    <img
                      src={opt.bgImage}
                      alt={opt.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
                    />
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-slate-950/30" />

                    {/* Top Tag & Emoji */}
                    <div className="relative z-10 flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[10px] font-bold border border-white/20 shadow-xs">
                        {opt.tag}
                      </span>
                      <span className="text-lg filter drop-shadow-sm group-hover:scale-110 transition-transform">
                        {opt.iconEmoji}
                      </span>
                    </div>

                    {/* Bottom Details: Tên & Mô tả đầy đủ, rõ ràng */}
                    <div className="relative z-10 text-white">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm sm:text-base font-black tracking-tight group-hover:text-pink-200 transition-colors drop-shadow-xs">
                          {opt.name}
                        </h4>
                        <ArrowRight className="w-4 h-4 text-pink-300 group-hover:text-white transition-transform group-hover:translate-x-1 shrink-0 ml-1" />
                      </div>
                      <p className="text-[11px] text-white/80 line-clamp-1 mt-0.5 font-medium">
                        {opt.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
