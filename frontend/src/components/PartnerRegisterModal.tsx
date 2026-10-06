import React, { useState, useEffect } from 'react';
import { X, Store, Sparkles, CheckCircle2 } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface PartnerRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PartnerRegisterModal: React.FC<PartnerRegisterModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [salonName, setSalonName] = useState('');
  const [category, setCategory] = useState('Spa & Dưỡng Sinh');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Lock body scroll when open
  useBodyScrollLock(isOpen);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 2500);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Blurred & Dimmed Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Pristine Modal Card */}
      <div
        className="relative z-10 w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-pink-100 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 bg-gradient-to-r from-[#be185d] via-[#db2777] to-[#e1146c] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-white" />
            <div>
              <h3 className="text-base font-extrabold tracking-tight">Đăng Ký Đối Tác BeautyLink</h3>
              <p className="text-[11px] text-pink-100/90 font-medium">Đồng hành phát triển cùng hệ sinh thái làm đẹp</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Đóng (ESC)"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">

        {isSuccess ? (
          <div className="p-8 text-center flex flex-col items-center justify-center my-auto">
            <div className="w-16 h-16 rounded-full bg-pink-100 text-[#e1146c] flex items-center justify-center mb-4 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-black text-slate-800">Đăng ký thành công!</h4>
            <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
              Cảm ơn cơ sở <strong>{salonName || 'của bạn'}</strong> đã quan tâm. Chuyên viên tư vấn phát triển mạng lưới sẽ liên hệ trong 24 giờ làm việc.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-3.5">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Tên cơ sở / Thương hiệu Spa <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Lotus Beauty & Spa"
                value={salonName}
                onChange={(e) => setSalonName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-pink-200 focus:outline-none focus:border-[#e1146c]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Mô hình kinh doanh <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-pink-200 bg-white focus:outline-none focus:border-[#e1146c]"
              >
                <option value="Spa & Dưỡng Sinh">Spa & Dưỡng Sinh</option>
                <option value="Thẩm Mỹ Viện & Clinic">Thẩm Mỹ Viện & Clinic</option>
                <option value="Nail & Eyelash Art">Nail & Mi Nghệ Thuật</option>
                <option value="Salon Tóc Chuyên Nghiệp">Salon Tóc</option>
                <option value="Nha Khoa Thẩm Mỹ">Nha Khoa Thẩm Mỹ</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Người đại diện <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Họ và tên"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-pink-200 focus:outline-none focus:border-[#e1146c]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="09xx xxx xxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-pink-200 focus:outline-none focus:border-[#e1146c]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Địa chỉ cơ sở <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Số nhà, đường, quận/huyện, tỉnh/thành..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-pink-200 focus:outline-none focus:border-[#e1146c]"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 rounded-full bg-gradient-to-r from-[#e1146c] via-[#db2777] to-[#be185d] text-white text-xs font-black shadow-lg shadow-pink-600/30 hover:opacity-95 transition-all uppercase tracking-wide"
              >
                Gửi thông tin đăng ký gian hàng
              </button>
              <p className="text-[10px] text-center text-slate-400 mt-2">
                Miễn phí đăng ký. Không thu phí duy trì ban đầu.
              </p>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
};
