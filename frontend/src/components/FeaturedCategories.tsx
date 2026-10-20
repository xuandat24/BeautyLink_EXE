import React, { useEffect, useMemo, useState } from 'react';
import { Flower2, Hand, Palette, Scissors, type LucideIcon } from 'lucide-react';
import { BackendCategory } from '../types';
import { beautyApi, DEFAULT_CATEGORIES } from '../services/beautyApi';

export interface FeaturedCategoriesProps {
  onSelectCategory: (category: BackendCategory) => void;
  activeCategorySlug?: string | null;
}

const FEATURED_CATEGORY_SLUGS = ['makeup', 'hair', 'spa', 'nails', 'skincare'] as const;
const FEATURED_CATEGORY_NAMES: Record<(typeof FEATURED_CATEGORY_SLUGS)[number], string> = {
  makeup: 'Trang điểm',
  hair: 'Làm tóc',
  spa: 'Spa & Massage',
  nails: 'Nail',
  skincare: 'Chăm sóc da',
};
const FEATURED_CATEGORY_ICONS: Record<(typeof FEATURED_CATEGORY_SLUGS)[number], LucideIcon> = {
  makeup: Palette,
  hair: Scissors,
  spa: Flower2,
  nails: Hand,
  skincare: Flower2,
};

export const FeaturedCategories: React.FC<FeaturedCategoriesProps> = React.memo(
  ({ onSelectCategory, activeCategorySlug }) => {
    const [backendCategories, setBackendCategories] = useState<BackendCategory[]>([]);

    useEffect(() => {
      let active = true;
      beautyApi
        .categories()
        .then((data) => {
          if (active) setBackendCategories(data);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []);

    const categories = useMemo(() => {
      const available = backendCategories.length > 0 ? backendCategories : DEFAULT_CATEGORIES;
      return FEATURED_CATEGORY_SLUGS.map((slug) => {
        const category =
          available.find((item) => item.slug === slug) ||
          DEFAULT_CATEGORIES.find((item) => item.slug === slug);
        return category ? { ...category, name: FEATURED_CATEGORY_NAMES[slug] } : undefined;
      }).filter((category): category is BackendCategory => Boolean(category));
    }, [backendCategories]);

    return (
      <section
        id="categories"
        className="relative mx-auto my-2 max-w-7xl rounded-2xl border border-pink-100/80 bg-white px-4 py-4 shadow-xs sm:my-3 sm:rounded-3xl sm:px-6 sm:py-5"
      >
        <div className="mb-4">
          <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
            Danh mục nổi bật
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Chọn loại hình làm đẹp để xem các đối tác phù hợp.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((category) => {
            const isActive = activeCategorySlug === category.slug;
            const Icon = FEATURED_CATEGORY_ICONS[
              category.slug as (typeof FEATURED_CATEGORY_SLUGS)[number]
            ];
            return (
              <button
                key={category.slug}
                type="button"
                onClick={() => onSelectCategory(category)}
                aria-current={isActive ? 'page' : undefined}
                className={`group flex min-h-24 items-center gap-3 rounded-2xl border bg-white px-4 py-4 text-left shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-pink-300 hover:bg-pink-50/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1146c] sm:flex-col sm:justify-center sm:text-center ${
                  isActive ? 'border-[#e1146c] ring-1 ring-pink-200' : 'border-pink-100'
                }`}
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-pink-100 to-rose-50 text-[#e1146c] ring-1 ring-pink-200 transition group-hover:scale-105 group-hover:bg-pink-100">
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <span className="text-sm font-black text-slate-800 transition group-hover:text-[#be185d]">
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }
);

FeaturedCategories.displayName = 'FeaturedCategories';
