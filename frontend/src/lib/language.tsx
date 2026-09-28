import React, { createContext, useContext, useMemo, useState } from 'react';

export type Language = 'vi' | 'en';

const CATEGORY_NAMES: Record<string, string> = {
  makeup: 'Makeup',
  hair: 'Hair',
  spa: 'Spa & Massage',
  nails: 'Nails',
  skincare: 'Skincare',
};

const CONTENT_ENGLISH: Record<string, string> = {
  'Dịch vụ nổi bật': 'Featured services', 'Được yêu thích nhất': 'Most loved', 'Gói trải nghiệm': 'Trial packages', 'Dành cho khách mới': 'For new customers', 'Chăm sóc chuyên sâu': 'Advanced care', 'Tư vấn theo nhu cầu': 'Personalized advice', 'Ưu đãi hôm nay': 'Today’s deals', 'Đặt lịch giá tốt': 'Book at a great price',
  'Trang điểm cô dâu': 'Bridal makeup', 'Rạng rỡ ngày trọng đại': 'Radiant on your big day', 'Trang điểm sự kiện': 'Event makeup', 'Tiệc, lễ và sân khấu': 'Parties, ceremonies, and stage', 'Makeup cá nhân': 'Personal makeup', 'Phong cách riêng của bạn': 'Your signature style', 'Makeup chụp ảnh': 'Photoshoot makeup', 'Lên hình thật nổi bật': 'Camera-ready results',
  'Cắt & tạo kiểu': 'Cut & styling', 'Kiểu tóc hợp khuôn mặt': 'Styles that suit your face', 'Nhuộm thời trang': 'Fashion coloring', 'Màu tóc mới, chuẩn gu': 'A color that fits your style', 'Uốn & duỗi': 'Perm & straightening', 'Tạo nếp bền đẹp': 'Long-lasting shape', 'Phục hồi tóc': 'Hair repair', 'Mềm mượt và chắc khỏe': 'Soft, smooth, healthy hair',
  'Massage toàn thân': 'Full-body massage', 'Thả lỏng và thư giãn': 'Relax and unwind', 'Gội đầu dưỡng sinh': 'Herbal head spa', 'Nhẹ đầu, khỏe tóc': 'Relaxed scalp, healthier hair', 'Chăm sóc body': 'Body care', 'Tái tạo năng lượng': 'Restore your energy', 'Spa thảo dược': 'Herbal spa', 'Liệu pháp từ thiên nhiên': 'Nature-inspired therapy',
  'Sơn gel': 'Gel polish', 'Bền màu, bóng đẹp': 'Long-lasting shine', 'Nail art': 'Nail art', 'Thiết kế theo phong cách': 'Designed for your style', 'Chăm sóc móng': 'Nail care', 'Móng khỏe và gọn đẹp': 'Healthy, polished nails', 'Nối mi': 'Lash extensions', 'Ánh nhìn tự nhiên': 'A natural-looking gaze',
  'Điều trị mụn': 'Acne treatment', 'Phác đồ theo tình trạng da': 'Plan tailored to your skin', 'Phục hồi da': 'Skin recovery', 'Củng cố hàng rào bảo vệ': 'Strengthen the skin barrier', 'Làm sáng da': 'Brightening', 'Đều màu và rạng rỡ': 'Even and radiant skin', 'Trẻ hóa da': 'Skin rejuvenation', 'Săn chắc và tươi mới': 'Firmer, refreshed skin',
  'Cô dâu': 'Bridal', 'Thư giãn': 'Relaxation', 'Tạo kiểu tóc': 'Hair styling', 'Chăm sóc tại nhà': 'At-home care',
};

export const localizedCategoryName = (slug: string, fallback: string, language: Language) => (
  language === 'en' ? CATEGORY_NAMES[slug] || fallback : fallback
);

export const localizedContent = (value: string, language: Language) => (
  language === 'en' ? CONTENT_ENGLISH[value] || value : value
);

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  text: (vietnamese: string, english: string) => string;
}

const LANGUAGE_KEY = 'beautylink_language';

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => (
    localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'vi'
  ));

  React.useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage: (nextLanguage) => {
      localStorage.setItem(LANGUAGE_KEY, nextLanguage);
      document.documentElement.lang = nextLanguage;
      setLanguageState(nextLanguage);
    },
    text: (vietnamese, english) => language === 'vi' ? vietnamese : english,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
