import React from 'react';
import { Heart, Mail, MapPin, Phone, QrCode, ShieldCheck, Sparkles } from 'lucide-react';
import { useLanguage } from '../lib/language';

export const Footer: React.FC = () => {
  const { text } = useLanguage();
  const companyLinks = [text('Giới thiệu nền tảng', 'About the platform'), text('Danh sách đối tác', 'Partner directory'), text('Tuyển dụng', 'Careers'), text('Điều khoản sử dụng', 'Terms of use'), text('Chính sách bảo mật', 'Privacy policy')];
  const customerLinks = [text('Khuyến mãi hôm nay', 'Today’s promotions'), text('Hướng dẫn đặt lịch', 'Booking guide'), text('Chính sách hoàn hủy', 'Cancellation policy'), text('Trở thành đối tác', 'Become a partner'), text('Quy chế hoạt động', 'Platform policy')];

  return (
    <footer className="mt-12 border-t border-pink-200 bg-white pb-8 pt-12 text-slate-600">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-8 border-b border-pink-100 pb-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr from-[#EB0F51] to-[#f472b6] text-white shadow-md shadow-pink-500/20"><Sparkles className="h-5 w-5" /></span><span className="text-2xl font-black text-slate-900">Beauty<span className="text-[#EB0F51]">Link</span></span></div>
            <p className="max-w-sm text-xs leading-relaxed text-slate-500">{text('BeautyLink kết nối khách hàng với các nhà cung cấp dịch vụ làm đẹp, spa, salon và chuyên viên đã được xác minh.', 'BeautyLink connects customers with verified beauty providers, spas, salons, and professionals.')}</p>
            <div className="space-y-2 text-xs"><p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-[#EB0F51]" /><strong>{text('Hotline hỗ trợ:', 'Support hotline:')}</strong> 1900 8868</p><p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-[#EB0F51]" /><strong>{text('Email hỗ trợ:', 'Support email:')}</strong> support@beautylink.vn</p><p className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#EB0F51]" />{text('Phục vụ tại Hà Nội và Thành phố Hồ Chí Minh', 'Serving Hanoi and Ho Chi Minh City')}</p></div>
          </div>
          <FooterLinks title={text('Về BeautyLink', 'About BeautyLink')} items={companyLinks} />
          <FooterLinks title={text('Dành cho bạn', 'For you')} items={customerLinks} />
          <div className="space-y-3"><h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">{text('Ứng dụng BeautyLink', 'BeautyLink app')}</h4><p className="text-xs text-slate-500">{text('Quét mã QR để theo dõi lịch hẹn thuận tiện hơn.', 'Scan the QR code to manage appointments on the go.')}</p><div className="flex max-w-[200px] items-center gap-3 rounded-2xl border border-pink-200/60 bg-pink-50/70 p-3"><span className="grid h-14 w-14 place-items-center rounded-xl border border-pink-100 bg-white"><QrCode className="h-12 w-12 text-slate-800" /></span><span className="text-[10px] font-semibold"><strong className="block rounded bg-[#EB0F51] px-2 py-0.5 text-center text-white">iOS / Android</strong><span className="mt-1 block">4.9 ★</span></span></div><p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600"><ShieldCheck className="h-3.5 w-3.5" />{text('Bảo vệ dữ liệu người dùng', 'User data protected')}</p></div>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 pt-6 text-xs text-slate-400 sm:flex-row"><p>© 2026 BeautyLink. {text('Mọi quyền được bảo lưu.', 'All rights reserved.')}</p><div className="flex flex-wrap items-center justify-center gap-2"><span>{text('Bảo mật SSL', 'SSL secured')}</span><span>·</span><span>{text('Thanh toán đang mô phỏng', 'Payments are simulated')}</span><span>·</span><span className="inline-flex items-center gap-1 font-bold text-pink-600">Made with <Heart className="h-3 w-3 fill-current" /> in Vietnam</span></div></div>
      </div>
    </footer>
  );
};

const FooterLinks: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
  <div className="space-y-3"><h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">{title}</h4><ul className="space-y-2 text-xs">{items.map((item) => <li key={item}><a href="#" className="transition-colors hover:text-[#EB0F51]">{item}</a></li>)}</ul></div>
);
