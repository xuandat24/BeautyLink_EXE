import React, { useRef, useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Sparkles, MapPin, Star, Users, ShieldCheck } from 'lucide-react';
import { NewPartner } from '../data/mockData';
import { useScrollReveal } from '../hooks/useScrollReveal';

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

  const { ref: sectionRef, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.08 });

  return (
    <section
      ref={sectionRef}
      className={`py-6 max-w-7xl mx-auto px-4 sm:px-6 relative reveal-on-scroll ${
        isVisible ? 'is-revealed' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <span>Doanh nghiệp mới tham gia</span>
            <span className="px-2 py-0.5 rounded-full bg-pink-100 text-[#be185d] text-[11px] font-black uppercase">
              NEW
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Các cơ sở thẩm mỹ, spa & clinic uy tín vừa gia nhập hệ sinh thái BeautyLink
          </p>
        </div>

        <button
          onClick={onViewAll}
          className="inline-flex items-center gap-1 text-sm font-bold text-[#be185d] hover:text-[#9d174d] hover:underline transition-colors"
        >
          <span>Xem thêm</span>
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
            className="absolute -left-3 sm:-left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 backdrop-blur-md shadow-xl shadow-pink-500/15 border border-pink-100 flex items-center justify-center text-[#6366f1] hover:text-[#e1146c] hover:scale-110 active:scale-95 transition-all cursor-pointer"
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
            className="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 backdrop-blur-md shadow-xl shadow-pink-500/15 border border-pink-100 flex items-center justify-center text-[#6366f1] hover:text-[#e1146c] hover:scale-110 active:scale-95 transition-all cursor-pointer"
          >
            <ChevronRight className="w-5 h-5 text-[#6366f1]" strokeWidth={2.5} />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex items-stretch gap-4 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1"
        >
          {partners.map((p, idx) => (
            <div
              key={p.id}
              onClick={() => onSelectPartner(p)}
              className={`group bg-white rounded-2xl border border-pink-100/90 hover:border-pink-300 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-pink-500/10 transition-all duration-300 cursor-pointer flex flex-col justify-between w-[270px] sm:w-[290px] shrink-0 stagger-item stagger-delay-${Math.min(
                idx,
                7
              )}`}
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                {/* Verified badge top left */}
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/90 backdrop-blur-xs text-white text-[9px] font-black shadow-xs">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  <span>Chứng chỉ Y tế</span>
                </div>

                <div className="absolute bottom-2 left-2 right-2 text-white flex items-center justify-between">
                  <span className="text-[10px] font-extrabold tracking-wider uppercase text-pink-200 block truncate">
                    {p.subTitle}
                  </span>
                  <div className="inline-flex items-center gap-0.5 bg-black/60 backdrop-blur-xs px-1.5 py-0.5 rounded-md text-[10px] font-black text-amber-300">
                    <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                    <span>4.9★</span>
                  </div>
                </div>
              </div>

              {/* Partner Details */}
              <div className="p-3.5 flex flex-col flex-1 justify-between space-y-2.5">
                <div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-pink-50 border border-pink-200 shrink-0 flex items-center justify-center text-xs font-black text-[#e1146c]">
                      {p.logo}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 group-hover:text-[#e1146c] transition-colors truncate">
                        {p.name}
                      </h3>
                      <p className="text-[11px] text-pink-700/80 font-medium mt-0.5 truncate">
                        {p.specialty}
                      </p>
                    </div>
                  </div>

                  {/* Rating cho dịch vụ & Số lượt người đã trải nghiệm để nhìn sơ qua là biết ngay */}
                  <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-900 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>4.9 (168+)</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-md">
                      <Users className="w-3 h-3 text-[#be185d]" />
                      <span>4,850+ đã trải nghiệm</span>
                    </span>
                  </div>

                  <div className="mt-2 flex items-start gap-1 text-[11px] text-slate-500">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-1 leading-relaxed">{p.address}</span>
                  </div>
                </div>

                {/* Special Welcome Perk badge */}
                <div className="pt-2 border-t border-pink-50 flex items-center justify-between text-[11px]">
                  <span className="text-[#be185d] font-bold bg-pink-50 px-2 py-0.5 rounded-md truncate max-w-[200px]">
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
