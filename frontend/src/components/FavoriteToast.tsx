import React, { useEffect, useState } from 'react';
import { Heart, Sparkles, X, Check } from 'lucide-react';

export interface FavoriteToastInfo {
  id: string;
  title: string;
  salonName?: string;
  image?: string;
  isFavorited: boolean;
}

interface FavoriteToastProps {
  toast: FavoriteToastInfo | null;
  onClose: () => void;
  duration?: number;
}

export const FavoriteToast: React.FC<FavoriteToastProps> = ({
  toast,
  onClose,
  duration = 3000,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!toast) return;

    setProgress(100);
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onClose();
      }
    }, 30);

    return () => clearInterval(interval);
  }, [toast, duration, onClose]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-4 sm:right-6 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto"
    >
      <div className="bg-slate-950/95 text-white backdrop-blur-xl rounded-2xl p-3.5 sm:p-4 shadow-2xl border border-pink-500/30 flex items-start gap-3.5 relative overflow-hidden">
        {/* Animated Progress Bar at bottom */}
        <div
          className={`absolute bottom-0 left-0 h-1 transition-all duration-75 ${
            toast.isFavorited
              ? 'bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400'
              : 'bg-slate-600'
          }`}
          style={{ width: `${progress}%` }}
        />

        {/* Thumbnail or Icon */}
        <div className="relative shrink-0">
          {toast.image ? (
            <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-pink-400/40 bg-pink-950">
              <img
                src={toast.image}
                alt={toast.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <Heart
                  className={`w-5 h-5 drop-shadow-md ${
                    toast.isFavorited
                      ? 'fill-rose-500 text-rose-500 animate-pulse'
                      : 'text-white'
                  }`}
                />
              </div>
            </div>
          ) : (
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                toast.isFavorited
                  ? 'bg-gradient-to-tr from-pink-600 to-rose-500 text-white border-pink-400 shadow-md shadow-pink-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <Heart
                className={`w-5 h-5 ${
                  toast.isFavorited ? 'fill-white animate-pulse' : ''
                }`}
              />
            </div>
          )}
        </div>

        {/* Text Content */}
        <div className="min-w-0 flex-1 pr-4">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={`text-xs font-black flex items-center gap-1 ${
                toast.isFavorited ? 'text-pink-300' : 'text-slate-300'
              }`}
            >
              {toast.isFavorited ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                  <span>Đã lưu vào danh sách yêu thích</span>
                </>
              ) : (
                <span>Đã xóa khỏi danh sách yêu thích</span>
              )}
            </span>
          </div>

          <p className="text-xs font-bold text-white line-clamp-1 leading-snug">
            {toast.title}
          </p>

          {toast.salonName && (
            <p className="text-[11px] text-pink-200/80 font-medium truncate mt-0.5">
              {toast.salonName}
            </p>
          )}

          {toast.isFavorited && (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-emerald-400">
              <Check className="w-3 h-3 stroke-[3]" />
              <span>Được lưu trữ an toàn trong tài khoản của bạn</span>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông báo"
          className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
