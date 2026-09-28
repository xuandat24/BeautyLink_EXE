import React from 'react';
import { Search, ThumbsUp, CalendarClock, QrCode, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../lib/language';

export const WhyChooseUs: React.FC = React.memo(() => {
  const { text } = useLanguage();
  const features = [
    {
      id: 1,
      title: text('Tìm kiếm nơi làm đẹp', 'Find beauty providers'),
      description:
        text('Khám phá và tìm kiếm Spa, Salon, Thẩm mỹ, Phòng khám uy tín gần bạn chỉ trong vài giây.', 'Discover trusted spas, salons, beauty institutes, and clinics near you in seconds.'),
      icon: Search,
      bg: 'from-pink-100 to-rose-50',
      iconColor: 'text-[#EB0F51]',
    },
    {
      id: 2,
      title: text('Các địa điểm uy tín', 'Trusted providers'),
      description:
        text('Mua đa dạng dịch vụ làm đẹp uy tín, an toàn với các đánh giá xác thực từ người dùng thật.', 'Book reliable beauty services with verified information and transparent reviews.'),
      icon: ThumbsUp,
      bg: 'from-rose-100 to-pink-50',
      iconColor: 'text-[#B42D58]',
    },
    {
      id: 3,
      title: text('Đặt lịch trực tuyến', 'Online booking'),
      description:
        text('Đặt lịch làm đẹp trực tuyến nhanh chóng 30s. Chọn trước chuyên viên, không cần chờ đợi.', 'Book in seconds, choose your professional in advance, and avoid waiting.'),
      icon: CalendarClock,
      bg: 'from-fuchsia-100 to-pink-50',
      iconColor: 'text-[#a21caf]',
    },
    {
      id: 4,
      title: text('Thanh toán VNPAY‑QR', 'VNPAY-QR payment'),
      description:
        text('Quét VNPAY‑QR trên trang thanh toán chuyên biệt. Giao dịch đang được mô phỏng trong giai đoạn demo.', 'Scan VNPAY-QR on a dedicated checkout page. Transactions remain simulated during the demo stage.'),
      icon: QrCode,
      bg: 'from-pink-100 to-purple-50',
      iconColor: 'text-[#EB0F51]',
    },
  ];

  return (
    <section className="py-10 max-w-7xl mx-auto px-4 sm:px-6">
      <div className="text-center max-w-xl mx-auto mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
          {text('Vì sao nên chọn', 'Why choose')} <span className="bg-gradient-to-r from-[#B42D58] to-[#EB0F51] bg-clip-text text-transparent">BeautyLink</span>?
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {text('Hệ sinh thái công nghệ giúp bạn an tâm trải nghiệm dịch vụ chất lượng.', 'A trusted technology platform for confident, high-quality beauty experiences.')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.id}
              className="flex flex-col items-center text-center p-6 rounded-3xl bg-white border border-pink-100/80 shadow-sm hover:shadow-md hover:border-pink-300 transition-all group"
            >
              <div
                className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${f.bg} flex items-center justify-center ${f.iconColor} mb-4 group-hover:scale-110 transition-transform duration-300 shadow-inner`}
              >
                <Icon className="w-8 h-8" />
              </div>

              <h3 className="text-base font-bold text-slate-800 group-hover:text-[#B42D58] transition-colors">
                {f.title}
              </h3>

              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                {f.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
});

WhyChooseUs.displayName = 'WhyChooseUs';
