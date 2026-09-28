import React from 'react';
import { ArrowRight, Sparkles, BookOpen, Store, CheckCircle } from 'lucide-react';
import { useLanguage } from '../lib/language';

interface PartnerBlogCTAProps {
  onOpenPartnerModal: () => void;
  onOpenBlogModal: () => void;
}

export const PartnerBlogCTA: React.FC<PartnerBlogCTAProps> = ({
  onOpenPartnerModal,
  onOpenBlogModal,
}) => {
  const { text } = useLanguage();
  return (
    <section className="py-8 max-w-7xl mx-auto px-4 sm:px-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Trở thành Đối tác BeautyPink */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-pink-50 via-white to-pink-100/70 border border-pink-200/80 p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
          <div className="relative z-10">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              {text('Dành cho cơ sở Spa & Thẩm mỹ', 'For spas and beauty providers')}
            </span>
            <h3 className="mt-1 text-2xl sm:text-3xl font-black text-slate-800 tracking-tight leading-tight">
              {text('Trở thành', 'Become a')}
              <br />
              <span className="bg-gradient-to-r from-[#B42D58] to-[#EB0F51] bg-clip-text text-transparent">
                {text('Đối tác BeautyLink', 'BeautyLink Partner')}
              </span>
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-xs leading-relaxed">
              {text('Tiếp cận khách hàng tiềm năng, tối ưu lịch hẹn và phát triển doanh thu.', 'Reach more customers, optimize appointments, and grow your business.')}
            </p>

            <ul className="mt-3 space-y-1.5 text-xs text-slate-600 font-medium">
              <li className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#EB0F51]" />
                <span>{text('Miễn phí khởi tạo gian hàng & hướng dẫn 1-1', 'Free storefront setup and personal onboarding')}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#EB0F51]" />
                <span>{text('Hệ thống quản lý lịch đặt & doanh số thông minh', 'Smart booking and sales management')}</span>
              </li>
            </ul>
          </div>

          <div className="relative z-10 mt-6">
            <button
              onClick={onOpenPartnerModal}
              className="px-6 py-2.5 rounded-full border-2 border-slate-900 bg-white hover:bg-slate-900 hover:text-white text-slate-900 text-xs font-black tracking-wide uppercase transition-all shadow-sm flex items-center gap-2"
            >
              <span>{text('ĐĂNG KÝ NGAY', 'REGISTER NOW')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Decorative graphic background */}
          <div className="absolute right-4 bottom-4 w-32 h-32 md:w-44 md:h-44 rounded-full bg-gradient-to-tr from-pink-200 to-rose-200/40 blur-2xl pointer-events-none" />
          <div className="absolute right-6 bottom-6 opacity-85 hidden sm:block">
            <div className="w-24 h-24 rounded-2xl bg-white border border-pink-200 shadow-md p-3 flex flex-col justify-between rotate-6">
              <Store className="w-7 h-7 text-[#EB0F51]" />
              <div className="text-[10px] font-bold text-slate-700">
                {text('+15.000 Đơn/Tháng', '+15,000 Orders/Month')}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Khám phá Blog BeautyPink */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-purple-50/70 via-white to-pink-50 border border-pink-200/80 p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
          <div className="relative z-10">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              {text('Cẩm nang sắc đẹp & Dưỡng nhan', 'Beauty and wellness guide')}
            </span>
            <h3 className="mt-1 text-2xl sm:text-3xl font-black text-slate-800 tracking-tight leading-tight">
              {text('Khám phá', 'Explore')}
              <br />
              <span className="bg-gradient-to-r from-[#B42D58] to-[#B42D58] bg-clip-text text-transparent">
                Blog BeautyPink
              </span>
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-xs leading-relaxed">
              {text('Bí quyết chăm sóc da khoa học, cập nhật xu hướng nail, tạo hình mi và liệu pháp dưỡng sinh mới nhất.', 'Science-backed skincare advice and the latest nail, lash, and wellness trends.')}
            </p>

            <ul className="mt-3 space-y-1.5 text-xs text-slate-600 font-medium">
              <li className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#EB0F51]" />
                <span>{text('Chia sẻ kiến thức từ Bác Sĩ Da Liễu chuyên khoa', 'Advice from qualified skincare professionals')}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#EB0F51]" />
                <span>{text('Review thực tế không qua chỉnh sửa ảnh', 'Transparent, authentic reviews')}</span>
              </li>
            </ul>
          </div>

          <div className="relative z-10 mt-6">
            <button
              onClick={onOpenBlogModal}
              className="px-6 py-2.5 rounded-full border-2 border-slate-900 bg-white hover:bg-slate-900 hover:text-white text-slate-900 text-xs font-black tracking-wide uppercase transition-all shadow-sm flex items-center gap-2"
            >
              <span>{text('XEM BÀI VIẾT', 'READ ARTICLES')}</span>
              <BookOpen className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Decorative graphic background */}
          <div className="absolute right-4 bottom-4 w-32 h-32 md:w-44 md:h-44 rounded-full bg-gradient-to-tr from-purple-200 to-pink-200/40 blur-2xl pointer-events-none" />
          <div className="absolute right-6 bottom-6 opacity-85 hidden sm:block">
            <div className="w-24 h-24 rounded-2xl bg-white border border-pink-200 shadow-md p-3 flex flex-col justify-between -rotate-6">
              <Sparkles className="w-7 h-7 text-[#B42D58]" />
              <div className="text-[10px] font-bold text-slate-700">
                {text('120+ Mẹo Dưỡng Da', '120+ Skincare Tips')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
