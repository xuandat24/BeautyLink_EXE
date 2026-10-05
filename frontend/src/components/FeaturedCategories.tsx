import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BackendCategory } from '../types';
import { beautyApi } from '../services/beautyApi';
import { OptimizedImage } from './OptimizedImage';

export interface FeaturedCategoriesProps {
  onSelectCategory: (category: BackendCategory) => void;
  activeCategorySlug?: string | null;
}

interface CircleCategoryItem {
  id: string | number;
  name: string;
  image: string;
  slug: string;
}

const FEATURED_CIRCLE_ITEMS: CircleCategoryItem[] = [
  // Hàng 1
  {
    id: 'mat-ham',
    name: 'Thẩm Mỹ Mặt - Hàm',
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=260&q=80',
    slug: 'skincare',
  },
  {
    id: 'phun-xam',
    name: 'Phun Xăm',
    image: 'https://images.unsplash.com/photo-1512290900672-1f4a47890453?auto=format&fit=crop&w=260&q=80',
    slug: 'makeup',
  },
  {
    id: 'tri-lieu-da',
    name: 'Trị Liệu Da',
    image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=260&q=80',
    slug: 'skincare',
  },
  {
    id: 'tham-my-mat',
    name: 'Thẩm Mỹ Mắt',
    image: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=260&q=80',
    slug: 'makeup',
  },
  {
    id: 'tham-my-nguc',
    name: 'Thẩm Mỹ Ngực',
    image: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=260&q=80',
    slug: 'spa',
  },
  {
    id: 'cham-soc-co-the',
    name: 'Chăm Sóc Cơ Thể',
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=260&q=80',
    slug: 'spa',
  },
  {
    id: 'cham-soc-da-mat',
    name: 'Chăm Sóc Da Mặt',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=260&q=80',
    slug: 'skincare',
  },
  {
    id: 'trang-da',
    name: 'Trắng Da',
    image: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=260&q=80',
    slug: 'skincare',
  },

  // Hàng 2
  {
    id: 'khong-xam-lan',
    name: 'Thẩm Mỹ Viện Không Xâm Lấn',
    image: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=260&q=80',
    slug: 'skincare',
  },
  {
    id: 'giam-beo',
    name: 'Giảm Béo',
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=260&q=80',
    slug: 'spa',
  },
  {
    id: 'tai-tao-da',
    name: 'Tái Tạo Da',
    image: 'https://images.unsplash.com/photo-1506152983158-b4a74a01c721?auto=format&fit=crop&w=260&q=80',
    slug: 'skincare',
  },
  {
    id: 'tao-kieu-toc',
    name: 'Tạo Kiểu Tóc',
    image: 'https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=260&q=80',
    slug: 'hair',
  },
  {
    id: 'uon-duoi-nhuom',
    name: 'Uốn - Duỗi - Nhuộm',
    image: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=260&q=80',
    slug: 'hair',
  },
  {
    id: 'cham-soc-toc',
    name: 'Chăm Sóc Tóc',
    image: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=260&q=80',
    slug: 'hair',
  },
  {
    id: 'nail-nghe-thuat',
    name: 'Nail & Móng Đẹp',
    image: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=260&q=80',
    slug: 'nails',
  },
  {
    id: 'noi-mi-thiet-ke',
    name: 'Nối Mi Thiết Kế',
    image: 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=260&q=80',
    slug: 'nails',
  },
];

export const FeaturedCategories: React.FC<FeaturedCategoriesProps> = React.memo(
  ({ onSelectCategory }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [backendCategories, setBackendCategories] = useState<BackendCategory[]>([]);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    useEffect(() => {
      beautyApi
        .categories()
        .then((data) => {
          if (data && data.length > 0) {
            setBackendCategories(data);
          }
        })
        .catch(() => {});
    }, []);

    const updateScrollButtons = () => {
      if (!scrollContainerRef.current) return;
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 20);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 20);
    };

    const handleScroll = (direction: 'left' | 'right') => {
      if (!scrollContainerRef.current) return;
      const scrollAmount = 400;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    };

    const handleItemClick = (item: CircleCategoryItem) => {
      // Find matching backend category by slug
      const matched = backendCategories.find((c) => c.slug === item.slug);
      if (matched) {
        onSelectCategory(matched);
      } else {
        // Fallback category representation
        onSelectCategory({
          id: typeof item.id === 'number' ? item.id : 1,
          slug: item.slug,
          name: item.name,
          description: `Dịch vụ ${item.name} uy tín, chất lượng cao`,
          imageUrl: item.image,
        });
      }
    };

    // Split items into 2 rows (8 items per row)
    const row1 = FEATURED_CIRCLE_ITEMS.slice(0, 8);
    const row2 = FEATURED_CIRCLE_ITEMS.slice(8, 16);

    return (
      <section
        id="categories"
        className="mx-auto max-w-7xl px-4 sm:px-6 py-3.5 sm:py-4 bg-white rounded-2xl sm:rounded-3xl shadow-xs border border-pink-100/80 my-2 sm:my-3 relative"
      >
        {/* Header Title */}
        <div className="flex items-center justify-between mb-3 sm:mb-3.5">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Danh mục nổi bật
          </h2>

          {/* Arrow navigation buttons */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleScroll('left')}
              disabled={!canScrollLeft}
              className={`w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center transition-all ${
                canScrollLeft
                  ? 'bg-white text-slate-700 hover:bg-pink-50 hover:border-pink-300 hover:text-[#EB0F51] shadow-xs cursor-pointer'
                  : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
              }`}
              aria-label="Cuộn sang trái"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll('right')}
              disabled={!canScrollRight}
              className={`w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center transition-all ${
                canScrollRight
                  ? 'bg-white text-slate-700 hover:bg-pink-50 hover:border-pink-300 hover:text-[#EB0F51] shadow-xs cursor-pointer'
                  : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
              }`}
              aria-label="Cuộn sang phải"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable Container with 2 Rows of Circles */}
        <div
          ref={scrollContainerRef}
          onScroll={updateScrollButtons}
          className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-1"
        >
          <div className="min-w-[760px] space-y-3 sm:space-y-3.5">
            {/* Row 1 */}
            <div className="grid grid-cols-8 gap-2 sm:gap-3">
              {row1.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className="group flex flex-col items-center text-center p-1 cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1 focus:outline-none active:scale-95"
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-slate-100 p-0.5 border-2 border-pink-100/70 group-hover:border-[#EB0F51] shadow-xs group-hover:shadow-lg group-hover:shadow-pink-500/25 transition-all duration-300 ease-out transform group-hover:scale-110 mb-1.5">
                    <OptimizedImage
                      src={item.image}
                      alt={item.name}
                      preset="category-thumb"
                      className="w-full h-full object-cover rounded-full transition-transform duration-500 ease-out group-hover:scale-110"
                      containerClassName="w-full h-full rounded-full"
                    />
                  </div>
                  <span className="text-[11px] sm:text-xs font-medium text-slate-800 group-hover:text-[#EB0F51] transition-colors duration-200 leading-tight max-w-[85px] line-clamp-2 text-center group-hover:font-bold">
                    {item.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-8 gap-2 sm:gap-3">
              {row2.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className="group flex flex-col items-center text-center p-1 cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1 focus:outline-none active:scale-95"
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-slate-100 p-0.5 border-2 border-pink-100/70 group-hover:border-[#EB0F51] shadow-xs group-hover:shadow-lg group-hover:shadow-pink-500/25 transition-all duration-300 ease-out transform group-hover:scale-110 mb-1.5">
                    <OptimizedImage
                      src={item.image}
                      alt={item.name}
                      preset="category-thumb"
                      className="w-full h-full object-cover rounded-full transition-transform duration-500 ease-out group-hover:scale-110"
                      containerClassName="w-full h-full rounded-full"
                    />
                  </div>
                  <span className="text-[11px] sm:text-xs font-medium text-slate-800 group-hover:text-[#EB0F51] transition-colors duration-200 leading-tight max-w-[85px] line-clamp-2 text-center group-hover:font-bold">
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }
);

FeaturedCategories.displayName = 'FeaturedCategories';
