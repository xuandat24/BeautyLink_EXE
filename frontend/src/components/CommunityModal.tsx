import React, { useState, useEffect } from 'react';
import { X, Users, Heart, MessageCircle, Star, Sparkles, Send, CheckCircle2 } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { communityCommentSchema } from '../lib/validation';
import { FieldError } from './FieldError';

interface CommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommunityModal: React.FC<CommunityModalProps> = ({ isOpen, onClose }) => {
  const [likes, setLikes] = useState<Record<number, number>>({ 1: 42, 2: 89, 3: 27 });
  const [hasLiked, setHasLiked] = useState<Record<number, boolean>>({});
  const [newComment, setNewComment] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [commentError, setCommentError] = useState('');

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

  const toggleLike = (id: number) => {
    if (hasLiked[id]) {
      setLikes((prev) => ({ ...prev, [id]: prev[id] - 1 }));
      setHasLiked((prev) => ({ ...prev, [id]: false }));
    } else {
      setLikes((prev) => ({ ...prev, [id]: prev[id] + 1 }));
      setHasLiked((prev) => ({ ...prev, [id]: true }));
    }
  };

  const handlePostComment = () => {
    const validation = communityCommentSchema.safeParse(newComment);
    if (!validation.success) {
      setCommentError(validation.error.issues[0].message);
      return;
    }
    setCommentError('');
    setSubmitSuccess(true);
    setNewComment('');
    setTimeout(() => setSubmitSuccess(false), 3500);
  };

  const posts = [
    {
      id: 1,
      author: 'Mai Phương (Q.3, TP.HCM)',
      avatar: 'MP',
      salon: 'An Miên Spa Dưỡng Sinh',
      service: 'Gội đầu bồ kết 12 vị + Đả thông cổ vai gáy',
      content:
        'Hôm nay đi làm về mỏi nhừ người, book qua BeautyLink được giảm 50k. Không gian thơm mùi sả chanh cực kỳ thư thái, bạn kỹ thuật viên massage rất êm tay!',
      rating: 5,
      time: '2 giờ trước',
    },
    {
      id: 2,
      author: 'Thu Thảo (Cầu Giấy, Hà Nội)',
      avatar: 'TT',
      salon: 'Lotus Wellness Clinic',
      service: 'Làm sạch mụn lưng chuẩn y khoa',
      content:
        'Đã điều trị được 2 buổi, mụn lưng giảm hẳn 80% không để lại vết thâm. Phòng khám chuẩn y tế sạch sẽ 10/10 nha cả nhà!',
      rating: 5,
      time: '5 giờ trước',
    },
    {
      id: 3,
      author: 'Ngọc Hân (Hải Châu, Đà Nẵng)',
      avatar: 'NH',
      salon: 'Euphorea Salon & Nail',
      service: 'Nail móng thạch hồng sen ombre',
      content:
        'Mẫu nail hồng sen xinh ngất ngây, sơn gel bóng đẹp bền màu hơn 3 tuần rồi vẫn nguyên vẹn.',
      rating: 5,
      time: '1 ngày trước',
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
        className="relative z-10 w-full max-w-lg max-h-[88vh] bg-white rounded-[2rem] shadow-2xl border border-pink-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#be185d] via-[#db2777] to-[#e1146c] text-white p-5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Cộng Đồng Làm Đẹp & Đánh Giá</h3>
              <p className="text-[11px] text-pink-100 font-medium">Chia sẻ trải nghiệm thực tế từ hội chị em</p>
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

        {/* Success Alert if submitted */}
        {submitSuccess && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 flex items-center gap-2 text-xs font-bold text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Cảm ơn bạn! Đánh giá đã được gửi và đang chờ duyệt hiển thị.</span>
          </div>
        )}

        {/* Content list */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1 overscroll-contain">
          {posts.map((post) => (
            <div
              key={post.id}
              className="p-4 rounded-2xl border border-pink-100 bg-[#FFF9FA] space-y-2.5 hover:border-pink-300 transition-colors shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-400 to-[#be185d] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                    {post.avatar}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">{post.author}</h5>
                    <span className="text-[10px] text-slate-400">{post.time}</span>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 text-amber-500">
                  {Array.from({ length: post.rating }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                  ))}
                </div>
              </div>

              <div className="bg-white p-2 rounded-xl border border-pink-100 text-[11px] text-[#be185d] font-semibold flex items-center justify-between">
                <span>📍 {post.salon}</span>
                <span className="text-slate-500 font-normal truncate max-w-[170px]">
                  {post.service}
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">{post.content}</p>

              <div className="pt-2 flex items-center gap-4 text-xs text-slate-500 border-t border-pink-100/60">
                <button
                  type="button"
                  onClick={() => toggleLike(post.id)}
                  className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                    hasLiked[post.id] ? 'text-[#e1146c] font-bold' : 'hover:text-[#e1146c]'
                  }`}
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      hasLiked[post.id] ? 'fill-[#e1146c]' : ''
                    }`}
                  />
                  <span>{likes[post.id]} Yêu thích</span>
                </button>
                <div className="flex items-center gap-1.5 hover:text-slate-700 cursor-pointer">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Bình luận</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input & Footer Action Bar */}
        <div className="p-3.5 sm:p-4 border-t border-pink-100 bg-white flex flex-col gap-2 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Chia sẻ cảm nhận làm đẹp của bạn..."
              value={newComment}
              onChange={(e) => { setNewComment(e.target.value); setCommentError(''); }}
              maxLength={500}
              aria-invalid={Boolean(commentError)}
              aria-describedby="community-comment-error"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePostComment();
              }}
              className="flex-1 px-4 py-2 text-xs rounded-full border border-pink-200 focus:outline-none focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100"
            />
            <button
              type="button"
              onClick={handlePostComment}
              className="px-4 py-2 rounded-full bg-[#e1146c] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#be185d] transition cursor-pointer shadow-sm active:scale-95"
            >
              <Send className="w-3 h-3" />
              <span>Đăng</span>
            </button>
          </div>
          <FieldError id="community-comment-error" message={commentError} />

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-3 py-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              Đóng cửa sổ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
