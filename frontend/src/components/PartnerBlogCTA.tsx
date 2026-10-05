import React from 'react';
import { ArrowRight, Sparkles, BookOpen, Store, CheckCircle } from 'lucide-react';

interface PartnerBlogCTAProps {
  onOpenPartnerModal: () => void;
  onOpenBlogModal: () => void;
}

export const PartnerBlogCTA: React.FC<PartnerBlogCTAProps> = ({
  onOpenPartnerModal,
  onOpenBlogModal,
}) => {
  return (
    <section className="py-8 max-w-7xl mx-auto px-4 sm:px-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Trở thành Đối tác BeautyPink */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-pink-50 via-white to-pink-100/70 border border-pink-200/80 p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
          <div className="relative z-10">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Dành cho cơ sở Spa & Thẩm mỹ
            </span>
            <h3 className="mt-1 text-2xl sm:text-3xl font-black text-slate-800 tracking-tight leading-tight">
              Trở thành
              <br />
              <span className="bg-gradient-to-r from-[#be185d] to-[#e1146c] bg-clip-text text-transparent">
                Đối tác BeautyPink
              </span>
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-xs leading-relaxed">
              Tiếp cận hơn 500.000 khách hàng tiềm năng, tối ưu lịch hẹn & gia tăng doanh thu vượt bậc.
            </p>

            <ul className="mt-3 space-y-1.5 text-xs text-slate-600 font-medium">
              <li className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#e1146c]" />
                <span>Miễn phí khởi tạo gian hàng & hướng dẫn 1-1</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#e1146c]" />
                <span>Hệ thống quản lý lịch đặt & doanh số thông minh</span>
              </li>
            </ul>
          </div>

          <div className="relative z-10 mt-6">
            <button
              onClick={onOpenPartnerModal}
              className="px-6 py-2.5 rounded-full border-2 border-slate-900 bg-white hover:bg-slate-900 hover:text-white text-slate-900 text-xs font-black tracking-wide uppercase transition-all shadow-sm flex items-center gap-2"
            >
              <span>ĐĂNG KÝ NGAY</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Decorative graphic background */}
          <div className="absolute right-4 bottom-4 w-32 h-32 md:w-44 md:h-44 rounded-full bg-gradient-to-tr from-pink-200 to-rose-200/40 blur-2xl pointer-events-none" />
          <div className="absolute right-6 bottom-6 opacity-85 hidden sm:block">
            <div className="w-24 h-24 rounded-2xl bg-white border border-pink-200 shadow-md p-3 flex flex-col justify-between rotate-6">
              <Store className="w-7 h-7 text-[#e1146c]" />
              <div className="text-[10px] font-bold text-slate-700">
                +15.000 Đơn/Tháng
              </div>
            </div>
          </div>
        </div>

        {/* Right: Khám phá Blog BeautyPink */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-purple-50/70 via-white to-pink-50 border border-pink-200/80 p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
          <div className="relative z-10">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Cẩm nang sắc đẹp & Dưỡng nhan
            </span>
            <h3 className="mt-1 text-2xl sm:text-3xl font-black text-slate-800 tracking-tight leading-tight">
              Khám phá
              <br />
              <span className="bg-gradient-to-r from-[#9d174d] to-[#be185d] bg-clip-text text-transparent">
                Blog BeautyPink
              </span>
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-xs leading-relaxed">
              Bí quyết chăm sóc da khoa học, cập nhật xu hướng nail, tạo hình mi và liệu pháp dưỡng sinh đông y mới nhất.
            </p>

            <ul className="mt-3 space-y-1.5 text-xs text-slate-600 font-medium">
              <li className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#e1146c]" />
                <span>Chia sẻ kiến thức từ Bác Sĩ Da Liễu chuyên khoa</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#e1146c]" />
                <span>Review thực tế không qua chỉnh sửa ảnh</span>
              </li>
            </ul>
          </div>

          <div className="relative z-10 mt-6">
            <button
              onClick={onOpenBlogModal}
              className="px-6 py-2.5 rounded-full border-2 border-slate-900 bg-white hover:bg-slate-900 hover:text-white text-slate-900 text-xs font-black tracking-wide uppercase transition-all shadow-sm flex items-center gap-2"
            >
              <span>XEM BÀI VIẾT</span>
              <BookOpen className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Decorative graphic background */}
          <div className="absolute right-4 bottom-4 w-32 h-32 md:w-44 md:h-44 rounded-full bg-gradient-to-tr from-purple-200 to-pink-200/40 blur-2xl pointer-events-none" />
          <div className="absolute right-6 bottom-6 opacity-85 hidden sm:block">
            <div className="w-24 h-24 rounded-2xl bg-white border border-pink-200 shadow-md p-3 flex flex-col justify-between -rotate-6">
              <Sparkles className="w-7 h-7 text-[#be185d]" />
              <div className="text-[10px] font-bold text-slate-700">
                120+ Mẹo Dưỡng Da
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
