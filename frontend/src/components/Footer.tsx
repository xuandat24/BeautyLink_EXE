import React from 'react';
import { Sparkles, Phone, Mail, MapPin, ShieldCheck, Heart, QrCode } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-pink-200 mt-12 pt-12 pb-8 text-slate-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-10 border-b border-pink-100">
          {/* Col 1: Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#e1146c] to-[#f472b6] flex items-center justify-center text-white shadow-md shadow-pink-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-black bg-gradient-to-r from-[#be185d] via-[#db2777] to-[#ec4899] bg-clip-text text-transparent">
                BeautyPink
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
              BeautyPink là nền tảng công nghệ kết nối khách hàng với hàng ngàn cơ sở làm đẹp, thẩm mỹ viện, spa, salon tóc và clinic uy tín hàng đầu Việt Nam.
            </p>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#e1146c]" />
                <span className="font-semibold">Hotline CSKH:</span>
                <span className="text-[#e1146c] font-bold">1900 8868 (8:00 - 22:00)</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#e1146c]" />
                <span className="font-semibold">Email hỗ trợ:</span>
                <span>cskh@beautypink.vn</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#e1146c] shrink-0 mt-0.5" />
                <span>Tòa nhà Innovation Hub, 180 Nguyễn Thị Minh Khai, Quận 3, TP. Hồ Chí Minh</span>
              </div>
            </div>
          </div>

          {/* Col 2: Về BeautyPink */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Về BeautyPink
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#deals" className="hover:text-[#e1146c] transition-colors">
                  Giới thiệu nền tảng
                </a>
              </li>
              <li>
                <a href="#nearby" className="hover:text-[#e1146c] transition-colors">
                  Danh sách đối tác
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#e1146c] transition-colors">
                  Tuyển dụng nhân tài
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#e1146c] transition-colors">
                  Điều khoản sử dụng
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#e1146c] transition-colors">
                  Chính sách bảo mật
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Khách hàng & Đối tác */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Dành cho bạn
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#deals" className="hover:text-[#e1146c] transition-colors">
                  Khuyến mãi Hot hôm nay
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#e1146c] transition-colors">
                  Hướng dẫn đặt lịch trực tuyến
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#e1146c] transition-colors">
                  Chính sách hoàn hủy lịch hẹn
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#e1146c] transition-colors">
                  Trở thành đối tác kinh doanh
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#e1146c] transition-colors">
                  Quy chế hoạt động sàn TMĐT
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Tải ứng dụng */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Tải ứng dụng BeautyPink
            </h4>
            <p className="text-xs text-slate-500">
              Quét mã QR để nhận ngay voucher giảm 50K khi tải app lần đầu:
            </p>

            <div className="flex items-center gap-3 bg-pink-50/70 p-3 rounded-2xl border border-pink-200/60 max-w-[200px]">
              <div className="w-14 h-14 bg-white p-1 rounded-xl shadow-sm flex items-center justify-center border border-pink-100">
                <QrCode className="w-12 h-12 text-slate-800" />
              </div>
              <div className="flex flex-col text-[10px] text-slate-600 font-semibold gap-1">
                <span className="px-2 py-0.5 rounded bg-[#e1146c] text-white text-center">
                  iOS / Android
                </span>
                <span>4.9 ★ (45k+)</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Đã xác thực Bộ Công Thương</span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© 2026 BeautyPink. All rights reserved. Nền tảng đặt lịch làm đẹp & spa.</p>
          <div className="flex items-center gap-4 text-xs">
            <span>Bảo mật SSL 256-bit</span>
            <span>·</span>
            <span>Thanh toán chuẩn PCI-DSS</span>
            <span>·</span>
            <span className="text-pink-600 font-bold">Made with ♥ in Vietnam</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
