import React, { useEffect, useMemo, useState } from 'react';
import { BackendCategory } from '../types';
import { beautyApi, DEFAULT_CATEGORIES } from '../services/beautyApi';
import { OptimizedImage } from './OptimizedImage';

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
            return (
              <button
                key={category.slug}
                type="button"
                onClick={() => onSelectCategory(category)}
                aria-current={isActive ? 'page' : undefined}
                className={`group overflow-hidden rounded-2xl border bg-white text-left shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-pink-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1146c] ${
                  isActive ? 'border-[#e1146c] ring-1 ring-pink-200' : 'border-pink-100'
                }`}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-pink-50">
                  <OptimizedImage
                    src={category.imageUrl}
                    alt={category.name}
                    preset="category-thumb"
                    vignette
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    containerClassName="h-full w-full"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 to-transparent px-3 pb-2.5 pt-8">
                    <span className="text-sm font-black text-white">{category.name}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }
);

FeaturedCategories.displayName = 'FeaturedCategories';
