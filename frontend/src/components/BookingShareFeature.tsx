import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  Calendar,
  Clock,
  MapPin,
  User,
  Tag,
  CalendarPlus,
  Sparkles,
  ExternalLink,
  MessageCircle,
  Heart,
  Users,
  CheckCircle2,
  BookmarkCheck,
} from 'lucide-react';

export interface AppointmentShareData {
  bookingCode: string;
  serviceName: string;
  supplierName: string;
  supplierAddress?: string;
  practitionerName?: string;
  practitionerSpecialty?: string;
  appointmentDate: string; // 'YYYY-MM-DD'
  startTime: string; // 'HH:MM'
  endTime?: string;
  totalAmount?: number;
  note?: string;
  imageUrl?: string;
}

interface BookingShareFeatureProps {
  data: AppointmentShareData;
  showCardPreview?: boolean;
  onViewMyBookings?: () => void;
  onDone?: () => void;
  initialTone?: MessageTone;
}

type MessageTone = 'busy' | 'invite' | 'excited' | 'details';

const formatAppointmentDate = (dateStr: string) => {
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[d.getDay()];
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${dayName}, ${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

const formatCurrency = (val?: number) => {
  if (val == null) return '';
  return new Intl.NumberFormat('vi-VN').format(val) + 'đ';
};

export const BookingShareFeature: React.FC<BookingShareFeatureProps> = ({
  data,
  showCardPreview = true,
  onViewMyBookings,
  onDone,
  initialTone = 'busy',
}) => {
  const [tone, setTone] = useState<MessageTone>(initialTone);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [shareSuccessFeedback, setShareSuccessFeedback] = useState<string | null>(null);

  const formattedDate = formatAppointmentDate(data.appointmentDate);
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}#bookings`
    : 'https://beautylink.vn#bookings';

  // Generate customized messages based on user's tone
  const getShareMessage = (type: MessageTone) => {
    const timeFormatted = `${data.startTime}${data.endTime ? ` - ${data.endTime}` : ''}`;
    const specialistText = data.practitionerName ? `\n👤 Chuyên viên: ${data.practitionerName}` : '';
    const addressText = data.supplierAddress ? `\n📍 Địa chỉ: ${data.supplierAddress}` : '';

    if (type === 'busy') {
      return `🌸 TẶNG / CHIA SẺ LỊCH LÀM ĐẸP (HÔM ĐÓ MÌNH BẬN) ✨\n` +
        `Chào bạn! Hôm đó mình có lịch bận đột xuất nên muốn chia sẻ lại lịch hẹn làm đẹp này cho bạn trải nghiệm nhé:\n` +
        `💅 Dịch vụ: ${data.serviceName}\n` +
        `🏢 Cơ sở: ${data.supplierName}${addressText}\n` +
        `⏰ Thời gian: ${timeFormatted} · ${formattedDate}${specialistText}\n` +
        `🎟️ Mã check-in BeautyPass: ${data.bookingCode}\n` +
        (data.totalAmount ? `💰 Đã thanh toán: ${formatCurrency(data.totalAmount)}\n` : '') +
        `\nBạn chỉ cần đến đọc mã ${data.bookingCode} tại quầy lễ tân để trải nghiệm trọn vẹn dịch vụ nha!\n` +
        `Xem chi tiết: ${shareUrl}`;
    }

    if (type === 'invite') {
      return `🌸 Cuối tuần này có ai muốn đi làm đẹp cùng mình không nè? ✨\n` +
        `Mình vừa đặt lịch hẹn làm đẹp tại ${data.supplierName}:\n` +
        `💅 Dịch vụ: ${data.serviceName}\n` +
        `⏰ Thời gian: ${timeFormatted} · ${formattedDate}${specialistText}${addressText}\n` +
        `🔖 Mã lịch hẹn: ${data.bookingCode}\n\n` +
        `Cùng đặt lịch làm đẹp và thư giãn tại BeautyLink nhé: ${shareUrl}`;
    }

    if (type === 'excited') {
      return `✨ Vừa săn được lịch làm đẹp cực ưng ý tại BeautyLink! 💖\n` +
        `Dịch vụ: ${data.serviceName}\n` +
        `Cơ sở: ${data.supplierName}\n` +
        `Lịch hẹn: ${timeFormatted} · ${formattedDate}${specialistText}\n` +
        `Mã hẹn: ${data.bookingCode}\n\n` +
        `Háo hức chờ đến ngày hẹn quá đi thôi 🥰 Tham khảo dịch vụ tại: ${shareUrl}`;
    }

    // Default: 'details'
    return `📋 Thông tin lịch hẹn làm đẹp tại BeautyLink:\n` +
      `• Mã lịch hẹn: ${data.bookingCode}\n` +
      `• Dịch vụ: ${data.serviceName}\n` +
      `• Cơ sở: ${data.supplierName}${addressText}\n` +
      `• Thời gian: ${timeFormatted} · ${formattedDate}${specialistText}\n` +
      (data.totalAmount ? `• Giá thanh toán: ${formatCurrency(data.totalAmount)}\n` : '') +
      `\nXem chi tiết tại: ${shareUrl}`;
  };

  const currentMessage = getShareMessage(tone);

  // Copy share message to clipboard
  const handleCopyMessage = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentMessage);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = currentMessage;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedText(true);
      setShareSuccessFeedback('Đã sao chép nội dung lịch hẹn vào bộ nhớ tạm!');
      setTimeout(() => {
        setCopiedText(false);
        setShareSuccessFeedback(null);
      }, 3000);
    } catch {
      setShareSuccessFeedback('Không thể tự động sao chép. Vui lòng chọn và sao chép thủ công.');
      setTimeout(() => setShareSuccessFeedback(null), 3000);
    }
  };

  // Copy booking code only
  const handleCopyCode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(data.bookingCode);
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // fallback
    }
  };

  // Native Web Share API
  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Lịch hẹn: ${data.serviceName} - BeautyLink`,
          text: currentMessage,
          url: shareUrl,
        });
        setShareSuccessFeedback('Đã mở giao diện chia sẻ!');
        setTimeout(() => setShareSuccessFeedback(null), 2500);
      } catch (err) {
        // User cancelled or share failed
        if ((err as Error).name !== 'AbortError') {
          handleCopyMessage();
        }
      }
    } else {
      handleCopyMessage();
    }
  };

  // Social Share Handlers
  const handleShareFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      shareUrl
    )}&quote=${encodeURIComponent(currentMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer,width=620,height=580');
  };

  const handleShareMessenger = () => {
    // For mobile web or desktop
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `fb-messenger://share?link=${encodeURIComponent(shareUrl)}`;
    } else {
      // Desktop Messenger fallback
      const url = `https://www.facebook.com/dialog/send?link=${encodeURIComponent(
        shareUrl
      )}&app_id=291494419107518&redirect_uri=${encodeURIComponent(shareUrl)}`;
      window.open(url, '_blank', 'noopener,noreferrer,width=620,height=580');
    }
  };

  const handleShareZalo = () => {
    // Zalo inline web share or copy text
    handleCopyMessage();
    const zaloShareUrl = `https://sp.zalo.me/share_inline?url=${encodeURIComponent(shareUrl)}`;
    window.open(zaloShareUrl, '_blank', 'noopener,noreferrer,width=600,height=540');
  };

  const handleShareTelegram = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(
      shareUrl
    )}&text=${encodeURIComponent(currentMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer,width=620,height=580');
  };

  const handleShareWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(
      currentMessage
    )}`;
    window.open(url, '_blank', 'noopener,noreferrer,width=620,height=580');
  };

  const handleShareTwitter = () => {
    const text = `🌸 Mình vừa đặt lịch làm đẹp tại BeautyLink: ${data.serviceName} ở ${data.supplierName} (${data.startTime} · ${formattedDate})! ✨`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text
    )}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer,width=620,height=580');
  };

  // Google Calendar URL Generator
  const getGoogleCalendarUrl = () => {
    try {
      const cleanDate = data.appointmentDate.replace(/-/g, '');
      const cleanTime = (data.startTime || '09:00').replace(':', '') + '00';
      let endCleanTime = '';
      if (data.endTime) {
        endCleanTime = data.endTime.replace(':', '') + '00';
      } else {
        const [h, m] = (data.startTime || '09:00').split(':').map(Number);
        const endH = String((h + 1) % 24).padStart(2, '0');
        const endM = String(m).padStart(2, '0');
        endCleanTime = `${endH}${endM}00`;
      }
      const dates = `${cleanDate}T${cleanTime}/${cleanDate}T${endCleanTime}`;
      const title = `Lịch làm đẹp: ${data.serviceName} - BeautyLink`;
      const details = `Dịch vụ: ${data.serviceName}\nCơ sở: ${data.supplierName}\nĐịa chỉ: ${data.supplierAddress || 'Theo lịch hẹn BeautyLink'}\nChuyên viên: ${data.practitionerName || 'Chuyên viên chỉ định'}\nMã đặt lịch: ${data.bookingCode}\n\nĐặt qua BeautyLink.`;
      const location = `${data.supplierName}, ${data.supplierAddress || 'Việt Nam'}`;

      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        title
      )}&dates=${dates}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(
        location
      )}`;
    } catch {
      return '#';
    }
  };

  return (
    <div className="space-y-6">
      {/* Appointment Ticket Card Preview */}
      {showCardPreview && (
        <div className="relative overflow-hidden rounded-3xl border border-pink-200/80 bg-gradient-to-br from-pink-500/10 via-white to-pink-500/5 p-5 sm:p-6 shadow-sm">
          {/* Subtle decorative background watermark */}
          <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-pink-200/40 blur-2xl pointer-events-none" />

          {/* Top Status & Code Header */}
          <div className="flex items-center justify-between gap-3 border-b border-pink-100/80 pb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
                <Check className="h-4 w-4 stroke-[3]" />
              </span>
              <div>
                <span className="text-xs font-black text-emerald-700 uppercase tracking-wider block">
                  Đã xác nhận đặt lịch
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  BeautyLink Booking Pass
                </span>
              </div>
            </div>

            {/* Booking Code with 1-click Copy */}
            <button
              type="button"
              onClick={handleCopyCode}
              className="group flex items-center gap-1.5 rounded-xl border border-pink-200 bg-white px-3 py-1.5 text-xs font-black text-pink-700 hover:border-pink-300 hover:bg-pink-50 transition cursor-pointer shadow-xs"
              title="Nhấn để sao chép mã"
            >
              <Tag className="h-3.5 w-3.5 text-pink-500" />
              <span>{data.bookingCode}</span>
              {copiedCode ? (
                <Check className="h-3.5 w-3.5 text-emerald-600 ml-0.5" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-slate-400 group-hover:text-pink-600 ml-0.5 transition" />
              )}
            </button>
          </div>

          {/* Appointment Core Details */}
          <div className="mt-4 space-y-3">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                {data.serviceName}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 text-xs sm:text-sm font-bold text-pink-600">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{data.supplierName}</span>
                {data.supplierAddress && (
                  <span className="text-slate-400 font-normal truncate hidden sm:inline">
                    · {data.supplierAddress}
                  </span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2.5 rounded-2xl bg-white/90 p-2.5 border border-pink-100/60 shadow-2xs">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-pink-100 text-pink-700">
                  <Calendar className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Ngày hẹn
                  </span>
                  <span className="block text-xs font-extrabold text-slate-800 truncate">
                    {formattedDate}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-2xl bg-white/90 p-2.5 border border-pink-100/60 shadow-2xs">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-pink-100 text-pink-700">
                  <Clock className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Khung giờ
                  </span>
                  <span className="block text-xs font-extrabold text-slate-800">
                    {data.startTime}{data.endTime ? ` - ${data.endTime}` : ''}
                  </span>
                </div>
              </div>

              {data.practitionerName && (
                <div className="flex items-center gap-2.5 rounded-2xl bg-white/90 p-2.5 border border-pink-100/60 shadow-2xs">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                    <User className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Chuyên viên
                    </span>
                    <span className="block text-xs font-extrabold text-slate-800 truncate">
                      {data.practitionerName}
                    </span>
                  </div>
                </div>
              )}

              {data.totalAmount != null && (
                <div className="flex items-center gap-2.5 rounded-2xl bg-white/90 p-2.5 border border-pink-100/60 shadow-2xs">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Giá dịch vụ
                    </span>
                    <span className="block text-xs font-black text-pink-700 truncate">
                      {formatCurrency(data.totalAmount)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Social Media Sharing Section */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-pink-600">
              <Share2 className="h-5 w-5" />
              <h4 className="text-base font-black text-slate-900">
                Chia sẻ lịch hẹn lên mạng xã hội
              </h4>
            </div>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              Rủ bạn bè đi cùng hoặc chia sẻ lịch làm đẹp qua các ứng dụng yêu thích
            </p>
          </div>

          {/* Native Web Share Button (Mobile & Desktop) */}
          <button
            type="button"
            onClick={handleNativeShare}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 px-4 py-2.5 text-xs font-black text-white hover:from-pink-700 hover:to-rose-700 transition cursor-pointer shadow-md shadow-pink-600/20 shrink-0"
          >
            <Share2 className="h-4 w-4" />
            <span>Chia sẻ nhanh</span>
          </button>
        </div>

        {/* 1-Click Social Media Platforms Grid */}
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
            Chọn nền tảng chia sẻ
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Facebook */}
            <button
              type="button"
              onClick={handleShareFacebook}
              className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 text-left hover:border-[#1877F2] hover:bg-[#1877F2]/5 transition cursor-pointer group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1877F2] text-white shadow-xs group-hover:scale-105 transition-transform">
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-black text-slate-800 group-hover:text-[#1877F2] transition truncate">
                  Facebook
                </span>
                <span className="block text-[10px] text-slate-400 font-medium truncate">
                  Đăng trang cá nhân
                </span>
              </div>
            </button>

            {/* Zalo */}
            <button
              type="button"
              onClick={handleShareZalo}
              className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 text-left hover:border-[#0068FF] hover:bg-[#0068FF]/5 transition cursor-pointer group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0068FF] text-white shadow-xs font-black text-xs group-hover:scale-105 transition-transform">
                Zalo
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-black text-slate-800 group-hover:text-[#0068FF] transition truncate">
                  Zalo
                </span>
                <span className="block text-[10px] text-slate-400 font-medium truncate">
                  Gửi bạn bè / Nhóm
                </span>
              </div>
            </button>

            {/* Messenger */}
            <button
              type="button"
              onClick={handleShareMessenger}
              className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 text-left hover:border-[#0084FF] hover:bg-[#0084FF]/5 transition cursor-pointer group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#00C6FF] to-[#0078FF] text-white shadow-xs group-hover:scale-105 transition-transform">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-black text-slate-800 group-hover:text-[#0084FF] transition truncate">
                  Messenger
                </span>
                <span className="block text-[10px] text-slate-400 font-medium truncate">
                  Tin nhắn riêng
                </span>
              </div>
            </button>

            {/* Telegram */}
            <button
              type="button"
              onClick={handleShareTelegram}
              className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 text-left hover:border-[#24A1DE] hover:bg-[#24A1DE]/5 transition cursor-pointer group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#24A1DE] text-white shadow-xs group-hover:scale-105 transition-transform">
                <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.832.942z" />
                </svg>
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-black text-slate-800 group-hover:text-[#24A1DE] transition truncate">
                  Telegram
                </span>
                <span className="block text-[10px] text-slate-400 font-medium truncate">
                  Gửi qua Telegram
                </span>
              </div>
            </button>

            {/* WhatsApp */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 text-left hover:border-[#25D366] hover:bg-[#25D366]/5 transition cursor-pointer group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-xs group-hover:scale-105 transition-transform">
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.979-.276-.1-.477-.15-.678.15-.201.3-.778.979-.954 1.18-.175.2-.351.226-.652.075-.301-.15-1.272-.469-2.423-1.496-.895-.798-1.5-1.783-1.676-2.084-.175-.301-.019-.464.132-.614.135-.136.301-.351.451-.527.151-.175.201-.301.301-.501.101-.2.05-.376-.025-.527-.075-.15-.678-1.635-.929-2.239-.244-.588-.493-.508-.678-.518-.175-.01-.376-.01-.577-.01-.201 0-.527.075-.803.376s-1.054 1.03-1.054 2.512c0 1.482 1.08 2.912 1.231 3.113.15.201 2.125 3.245 5.148 4.551.719.311 1.28.497 1.718.636.722.23 1.378.197 1.898.12.58-.087 1.78-.727 2.031-1.43.251-.703.251-1.305.176-1.43-.076-.125-.276-.201-.577-.351z" />
                </svg>
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-black text-slate-800 group-hover:text-[#25D366] transition truncate">
                  WhatsApp
                </span>
                <span className="block text-[10px] text-slate-400 font-medium truncate">
                  Trò chuyện bạn bè
                </span>
              </div>
            </button>

            {/* X / Twitter */}
            <button
              type="button"
              onClick={handleShareTwitter}
              className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 text-left hover:border-black hover:bg-slate-50 transition cursor-pointer group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-white shadow-xs group-hover:scale-105 transition-transform">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-black text-slate-800 group-hover:text-black transition truncate">
                  X (Twitter)
                </span>
                <span className="block text-[10px] text-slate-400 font-medium truncate">
                  Chia sẻ tweet
                </span>
              </div>
            </button>

            {/* Google Calendar */}
            <a
              href={getGoogleCalendarUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 text-left hover:border-[#4285F4] hover:bg-[#4285F4]/5 transition cursor-pointer group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4285F4] text-white shadow-xs group-hover:scale-105 transition-transform">
                <CalendarPlus className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-black text-slate-800 group-hover:text-[#4285F4] transition truncate">
                  Lưu Calendar
                </span>
                <span className="block text-[10px] text-slate-400 font-medium truncate">
                  Nhắc giờ hẹn
                </span>
              </div>
            </a>

            {/* Copy Full Text */}
            <button
              type="button"
              onClick={handleCopyMessage}
              className="flex items-center gap-2.5 rounded-2xl border border-pink-200 bg-pink-50/50 p-3 text-left hover:border-pink-300 hover:bg-pink-100/50 transition cursor-pointer group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-600 text-white shadow-xs group-hover:scale-105 transition-transform">
                {copiedText ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-black text-pink-700 truncate">
                  {copiedText ? 'Đã sao chép!' : 'Sao chép tin'}
                </span>
                <span className="block text-[10px] text-pink-500 font-medium truncate">
                  Dán vào bất kỳ đâu
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Message Tone & Preview Customizer */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Lời nhắn mẫu đính kèm
            </span>
            <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-extrabold flex-wrap gap-0.5">
              <button
                type="button"
                onClick={() => setTone('busy')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition cursor-pointer ${
                  tone === 'busy'
                    ? 'bg-white text-pink-700 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🎁 Nhượng lại (Hôm đó bận)</span>
              </button>
              <button
                type="button"
                onClick={() => setTone('invite')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition cursor-pointer ${
                  tone === 'invite'
                    ? 'bg-white text-pink-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="h-3 w-3" />
                <span>Rủ bạn</span>
              </button>
              <button
                type="button"
                onClick={() => setTone('excited')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition cursor-pointer ${
                  tone === 'excited'
                    ? 'bg-white text-pink-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Heart className="h-3 w-3" />
                <span>Khoe lịch</span>
              </button>
              <button
                type="button"
                onClick={() => setTone('details')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition cursor-pointer ${
                  tone === 'details'
                    ? 'bg-white text-pink-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookmarkCheck className="h-3 w-3" />
                <span>Chi tiết</span>
              </button>
            </div>
          </div>

          {/* Text preview box */}
          <div className="relative rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">
            {currentMessage}
            <button
              type="button"
              onClick={handleCopyMessage}
              className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[11px] font-extrabold text-slate-700 hover:bg-white hover:text-pink-600 border border-slate-200 shadow-2xs transition cursor-pointer"
            >
              {copiedText ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Sao chép</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {shareSuccessFeedback && (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800 animate-in fade-in duration-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{shareSuccessFeedback}</span>
          </div>
        )}
      </div>

      {/* Action Footer Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        {onViewMyBookings ? (
          <button
            type="button"
            onClick={onViewMyBookings}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black text-slate-700 hover:bg-slate-50 hover:text-pink-600 transition cursor-pointer shadow-xs"
          >
            <Calendar className="h-4 w-4" />
            <span>Xem danh sách lịch hẹn của tôi</span>
          </button>
        ) : (
          <div />
        )}

        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-xs font-black text-white hover:bg-pink-700 transition cursor-pointer shadow-md shadow-slate-900/10"
          >
            <span>Hoàn tất</span>
          </button>
        )}
      </div>
    </div>
  );
};
