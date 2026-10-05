import React, { useEffect } from 'react';
import { X, Sparkles, BookOpen, Clock, Heart, Share2 } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface BlogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BlogModal: React.FC<BlogModalProps> = ({ isOpen, onClose }) => {
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

  const articles = [
    {
      id: 1,
      title: 'Top 5 Liệu Trình Trị Mụn Lưng & Chăm Da Khoa Học Mùa Nắng Nóng',
      author: 'Bác Sĩ Lê Minh Thư - Da Liễu',
      time: '6 phút đọc',
      category: 'Chăm Sóc Da',
      summary:
        'Mụn lưng xuất hiện chủ yếu do bít tắc tuyến bã nhờn kết hợp mồ hôi và vi khuẩn P.acnes. Khám phá quy trình làm sạch sâu bằng acid salicylic và ánh sáng sinh học dịu nhẹ.',
      image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=500&q=80',
    },
    {
      id: 2,
      title: 'Gội Đầu Dưỡng Sinh Đông Y Có Thực Sự Giúp Giảm Căng Thẳng & Ngủ Sâu?',
      author: 'Master Thảo Mộc Hương',
      time: '4 phút đọc',
      category: 'Dưỡng Sinh',
      summary:
        'Kết hợp nước cốt bồ kết cô đặc cùng kỹ thuật day ấn 14 huyệt vị vùng đầu - cổ - vai gáy giúp lưu thông khí huyết, giải tỏa áp lực công việc ngay sau 60 phút.',
      image: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=500&q=80',
    },
    {
      id: 3,
      title: 'Xu Hướng Phun Môi Tự Nhiên Collagen & Điêu Khắc Lông Mày 2026',
      author: 'Chuyên gia Bella Phun Xăm',
      time: '5 phút đọc',
      category: 'Phun Xăm',
      summary:
        'Tone hồng sen đào và hồng baby tự nhiên đang dẫn đầu xu hướng làm đẹp năm nay, mang lại vẻ rạng rỡ trẻ trung mà không cần makeup cầu kỳ.',
      image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=500&q=80',
    },
  ];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200"
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
        className="relative z-10 w-full max-w-2xl max-h-[88vh] bg-white rounded-[2rem] shadow-2xl border border-pink-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#be185d] via-[#db2777] to-[#e1146c] text-white p-5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Blog Làm Đẹp & Cẩm Nang Sắc Đẹp</h3>
              <p className="text-[11px] text-pink-100 font-medium">Bí quyết dưỡng nhan từ các chuyên gia da liễu</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white text-white hover:text-[#EB0F51] flex items-center justify-center transition-all shadow-sm cursor-pointer"
            title="Đóng (ESC)"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 overscroll-contain">
          {articles.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl border border-pink-100 bg-[#FFF9FA] hover:border-pink-300 transition-all flex flex-col sm:flex-row gap-4 shadow-xs"
            >
              <img
                src={item.image}
                alt={item.title}
                className="w-full sm:w-36 h-28 object-cover rounded-xl border border-pink-100 shrink-0"
              />
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    <span className="px-2 py-0.5 rounded-full bg-pink-100 text-[#be185d]">
                      {item.category}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#EB0F51]" />
                      {item.time}
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800 mt-1 line-clamp-2">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {item.summary}
                  </p>
                </div>
                <div className="mt-2 text-[10px] text-slate-400 font-medium flex items-center justify-between">
                  <span>Tác giả: {item.author}</span>
                  <span className="text-[#e1146c] font-bold cursor-pointer hover:underline">
                    Đọc tiếp →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">Cập nhật hàng tuần bởi chuyên gia BeautyLink</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
