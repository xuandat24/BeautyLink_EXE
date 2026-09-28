import React, { useRef, useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Sparkles, MapPin } from 'lucide-react';
import { NewPartner } from '../data/mockData';
import { useLanguage } from '../lib/language';

interface NewPartnersSectionProps {
  partners: NewPartner[];
  onSelectPartner: (partner: NewPartner) => void;
  onViewAll: () => void;
}

export const NewPartnersSection: React.FC<NewPartnersSectionProps> = React.memo(({
  partners,
  onSelectPartner,
  onViewAll,
}) => {
  const { text } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 20);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 20);
    }
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      return () => el.removeEventListener('scroll', checkScroll);
    }
  }, [partners]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -560 : 560;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="py-6 max-w-7xl mx-auto px-4 sm:px-6 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <span>{text('Doanh nghiệp mới tham gia', 'New partners')}</span>
            <span className="px-2 py-0.5 rounded-full bg-pink-100 text-[#B42D58] text-[11px] font-black uppercase">
              NEW
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {text('Các cơ sở thẩm mỹ, spa & clinic uy tín vừa gia nhập hệ sinh thái BeautyLink', 'Trusted beauty institutes, spas, and clinics newly joined BeautyLink')}
          </p>
        </div>

        <button
          onClick={onViewAll}
          className="inline-flex items-center gap-1 text-sm font-bold text-[#B42D58] hover:text-[#B42D58] hover:underline transition-colors"
        >
          <span>{text('Xem thêm', 'View more')}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Carousel Track with Floating Navigation Button (matching user image) */}
      <div className="relative group/partners mt-2">
        {/* Floating Left Button */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll('left')}
            aria-label="Doanh nghiệp trước"
            className="absolute -left-3 sm:-left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 backdrop-blur-md shadow-xl shadow-pink-500/15 border border-pink-100 flex items-center justify-center text-[#6366f1] hover:text-[#EB0F51] hover:scale-110 active:scale-95 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 text-[#6366f1]" strokeWidth={2.5} />
          </button>
        )}

        {/* Floating Right Button */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll('right')}
            aria-label="Xem thêm doanh nghiệp mới khác"
            className="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 backdrop-blur-md shadow-xl shadow-pink-500/15 border border-pink-100 flex items-center justify-center text-[#6366f1] hover:text-[#EB0F51] hover:scale-110 active:scale-95 transition-all cursor-pointer"
          >
            <ChevronRight className="w-5 h-5 text-[#6366f1]" strokeWidth={2.5} />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex items-stretch gap-4 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1"
        >
          {partners.map((p) => (
            <div
              key={p.id}
              onClick={() => onSelectPartner(p)}
              className="group bg-white rounded-2xl border border-pink-100/90 hover:border-pink-300 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-pink-500/10 transition-all duration-300 cursor-pointer flex flex-col justify-between w-[270px] sm:w-[290px] shrink-0"
            >
              {/* Banner Photo */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-pink-50">
                <img
                  src={p.image}
                  alt={p.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-2 right-2 text-white">
                  <span className="text-[10px] font-extrabold tracking-wider uppercase text-pink-200 block truncate">
                    {p.subTitle}
                  </span>
                </div>
              </div>

              {/* Partner Details */}
              <div className="p-3.5 flex flex-col flex-1 justify-between">
                <div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-pink-50 border border-pink-200 shrink-0 flex items-center justify-center text-xs font-black text-[#EB0F51]">
                      {p.logo}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 group-hover:text-[#EB0F51] transition-colors truncate">
                        {p.name}
                      </h3>
                      <p className="text-[11px] text-pink-700/80 font-medium mt-0.5 truncate">
                        {p.specialty}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-start gap-1 text-[11px] text-slate-500">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2 leading-relaxed">{p.address}</span>
                  </div>
                </div>

                {/* Special Welcome Perk badge */}
                <div className="mt-3 pt-2.5 border-t border-pink-50 flex items-center justify-between text-[11px]">
                  <span className="text-[#B42D58] font-bold bg-pink-50 px-2 py-0.5 rounded-md truncate max-w-[210px]">
                    🎁 {p.promoNotice}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-pink-500 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

NewPartnersSection.displayName = 'NewPartnersSection';
