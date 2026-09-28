import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, LoaderCircle, Sparkles } from 'lucide-react';
import { getCategoryShortcuts, popularBeautyNeeds } from '../data/categoryCatalog';
import { platformApi } from '../services/platformApi';
import type { ServiceCategory } from '../types';
import { localizedCategoryName, localizedContent, useLanguage } from '../lib/language';

interface FeaturedCategoriesProps {
  onSelectCategory: (category: ServiceCategory) => void;
}

const fallback: ServiceCategory[] = [
  { id: 1, slug: 'makeup', name: 'Trang điểm', description: 'Cá nhân, cô dâu và sự kiện', imageUrl: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=800&q=85' },
  { id: 2, slug: 'hair', name: 'Làm tóc', description: 'Cắt, nhuộm và tạo kiểu', imageUrl: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=800&q=85' },
  { id: 3, slug: 'spa', name: 'Spa & Massage', description: 'Thư giãn và phục hồi', imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=85' },
  { id: 4, slug: 'nails', name: 'Nail', description: 'Chăm sóc và thiết kế móng', imageUrl: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=800&q=85' },
  { id: 5, slug: 'skincare', name: 'Chăm sóc da', description: 'Liệu trình cá nhân hóa', imageUrl: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=85' },
];

export const FeaturedCategories: React.FC<FeaturedCategoriesProps> = React.memo(({ onSelectCategory }) => {
  const { language, text } = useLanguage();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [activeSlug, setActiveSlug] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    platformApi.categories()
      .then((items) => setCategories(items.length ? items : fallback))
      .catch(() => setCategories(fallback))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeSlug && categories.length) setActiveSlug(categories[0].slug);
  }, [activeSlug, categories]);

  const activeCategory = useMemo(
    () => categories.find((category) => category.slug === activeSlug) || categories[0],
    [activeSlug, categories],
  );

  const openActiveCategory = () => {
    if (activeCategory) onSelectCategory(activeCategory);
  };

  return (
    <section id="categories" className="mx-auto max-w-7xl scroll-mt-32 px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[#EB0F51]">
            <Sparkles className="h-4 w-4" /> {text('Chọn theo nhu cầu', 'Browse by need')}
          </p>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{text('Hôm nay bạn muốn làm đẹp gì?', 'What beauty service do you need today?')}</h2>
          <p className="mt-2 text-sm text-slate-500">{text('Chọn một nhóm dịch vụ để tìm đúng chuyên gia nhanh hơn.', 'Choose a category to find the right professional faster.')}</p>
        </div>
      </div>

      {loading ? (
        <div className="grid h-64 place-items-center rounded-[2rem] border border-pink-100 bg-white">
          <LoaderCircle className="h-7 w-7 animate-spin text-[#EB0F51]" />
        </div>
      ) : activeCategory ? (
        <div className="overflow-hidden rounded-[2rem] border border-pink-100 bg-white shadow-[0_20px_60px_-35px_rgba(180,45,88,0.35)]">
          <div className="grid lg:grid-cols-[280px_1fr]">
            <button type="button" onClick={openActiveCategory} className="group relative min-h-56 overflow-hidden text-left lg:min-h-[330px]">
              <img src={activeCategory.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-[#B42D58]/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                <span className="mb-3 inline-flex rounded-full bg-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] backdrop-blur-md">{text('Gợi ý cho bạn', 'Recommended for you')}</span>
                <h3 className="text-2xl font-black">{localizedCategoryName(activeCategory.slug, activeCategory.name, language)}</h3>
                <p className="mt-1 text-sm text-white/80">{language === 'vi' ? activeCategory.description : 'Services tailored to your beauty needs'}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold">{text('Khám phá ngay', 'Explore now')} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
              </div>
            </button>

            <div className="min-w-0 p-4 sm:p-6">
              <div className="flex gap-1 overflow-x-auto border-b border-slate-100 pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categories.map((category) => {
                  const isActive = category.slug === activeCategory.slug;
                  return (
                    <button key={category.slug} type="button" onClick={() => setActiveSlug(category.slug)} className={`relative shrink-0 px-4 py-3 text-sm font-extrabold transition sm:flex-1 ${isActive ? 'text-[#EB0F51]' : 'text-slate-600 hover:text-[#B42D58]'}`} aria-pressed={isActive}>
                      {localizedCategoryName(category.slug, category.name, language)}
                      <span className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#EB0F51] transition-transform ${isActive ? 'scale-x-100' : 'scale-x-0'}`} />
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                {getCategoryShortcuts(activeCategory.slug).map((item) => (
                  <button key={item.label} type="button" onClick={openActiveCategory} className="group rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left transition hover:-translate-y-0.5 hover:border-pink-200 hover:bg-pink-50 hover:shadow-md">
                    <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-white text-xl shadow-sm transition group-hover:scale-105">{item.icon}</span>
                    <span className="block text-sm font-extrabold text-slate-800">{localizedContent(item.label, language)}</span>
                    <span className="mt-1 block text-[11px] leading-4 text-slate-500">{localizedContent(item.caption, language)}</span>
                  </button>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <span className="mr-1 text-xs font-bold text-slate-400">{text('Phổ biến:', 'Popular:')}</span>
                {popularBeautyNeeds.map((need) => (
                  <button key={need} type="button" onClick={openActiveCategory} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-pink-300 hover:bg-pink-50 hover:text-[#B42D58]">{localizedContent(need, language)}</button>
                ))}
                <button type="button" onClick={openActiveCategory} className="ml-auto inline-flex items-center gap-1 px-2 py-1.5 text-xs font-black text-[#EB0F51] hover:text-[#B42D58]">
                  {text('Xem tất cả', 'View all')} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
});

FeaturedCategories.displayName = 'FeaturedCategories';
