export interface PushNotification {
  id: string;
  type: 'flash_sale' | 'deal_expiring' | 'new_promo' | 'system';
  title: string;
  message: string;
  timestamp: string;
  createdAt: number;
  dealId?: string;
  dealTitle?: string;
  dealPrice?: number;
  dealOriginalPrice?: number;
  salonName?: string;
  image?: string;
  discountBadge?: string;
  expiresIn?: string;
  isRead: boolean;
}

export const INITIAL_NOTIFICATIONS: PushNotification[] = [
  {
    id: 'notif-1',
    type: 'flash_sale',
    title: '🔥 FLASH SALE CHỚP NHOÁNG: Triệt lông Diode Laser 99K!',
    message: 'Giảm sốc 75% dịch vụ Triệt lông Diode Laser vĩnh viễn không đau tại Lotus Wellness Clinic. Chỉ còn 12 suất cuối trong khung giờ vàng!',
    timestamp: '2 phút trước',
    createdAt: Date.now() - 2 * 60 * 1000,
    dealId: 'deal-8',
    dealTitle: 'Triệt Lông Nách / Mép Diode Laser Vĩnh Viễn Không Đau',
    dealPrice: 99000,
    dealOriginalPrice: 400000,
    salonName: 'Lotus Wellness Clinic',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=300&q=80',
    discountBadge: '-75%',
    expiresIn: 'Còn 35 phút',
    isRead: false,
  },
  {
    id: 'notif-2',
    type: 'deal_expiring',
    title: '⏳ SẮP HẾT HẠN: Trị mụn ánh sáng sinh học 99K sắp đóng cổng!',
    message: 'Ưu đãi Điều Trị Mụn Bằng Ánh Sáng Sinh Học Phấn Hồng (Pink Clinic & Academy) sẽ kết thúc khi hết thời gian Flash Sale.',
    timestamp: '15 phút trước',
    createdAt: Date.now() - 15 * 60 * 1000,
    dealId: 'deal-3',
    dealTitle: 'Điều Trị Mụn Bằng Ánh Sáng Sinh Học Phấn Hồng',
    dealPrice: 99000,
    dealOriginalPrice: 250000,
    salonName: 'Pink Clinic & Academy',
    image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=300&q=80',
    discountBadge: '-60%',
    expiresIn: 'Còn 18 phút',
    isRead: false,
  },
  {
    id: 'notif-3',
    type: 'new_promo',
    title: '✨ CỰC HOT: Liệu Trình Trẻ Hóa Da PMT Radiance 199K vừa mở bán',
    message: 'Trải nghiệm trẻ hóa da công nghệ cao chuẩn y khoa, soi da 3D và điện di Collagen tươi giảm 92% (Giá gốc 2.500.000đ). Đặt chỗ ngay kẻo lỡ!',
    timestamp: '45 phút trước',
    createdAt: Date.now() - 45 * 60 * 1000,
    dealId: 'deal-9',
    dealTitle: 'Liệu Trình Trẻ Hóa Da Tức Thì Beauty Radiance 199K',
    dealPrice: 199000,
    dealOriginalPrice: 2500000,
    salonName: 'PMT Aesthetic Clinic',
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80',
    discountBadge: '-92%',
    expiresIn: 'Hôm nay',
    isRead: false,
  },
  {
    id: 'notif-4',
    type: 'deal_expiring',
    title: '⏳ SẮP HẾT HẠN: Voucher Giảm 50K "BEAUTYPINK50" của bạn',
    message: 'Mã giảm giá chào mừng tân thủ trị giá 50.000đ áp dụng cho mọi hóa đơn sẽ hết hạn vào 23:59 đêm nay.',
    timestamp: '1 giờ trước',
    createdAt: Date.now() - 60 * 60 * 1000,
    discountBadge: 'VOUCHER',
    expiresIn: 'Hôm nay',
    isRead: true,
  },
  {
    id: 'notif-5',
    type: 'flash_sale',
    title: '⚡ GIỜ VÀNG: Gội đầu dưỡng sinh 12 vị thảo dược chỉ 129K',
    message: 'Mộc Nhiên Dưỡng Sinh Đường mở thêm 20 suất gội đầu canh thảo dược bồ kết ấm nóng và massage đả thông kinh lạc.',
    timestamp: '2 giờ trước',
    createdAt: Date.now() - 120 * 60 * 1000,
    dealId: 'deal-11',
    dealTitle: 'Gội Đầu Dưỡng Sinh Thảo Dược 12 Vị + Massage Cổ Vai Gáy',
    dealPrice: 129000,
    dealOriginalPrice: 350000,
    salonName: 'Mộc Nhiên Dưỡng Sinh Đường',
    image: 'https://images.unsplash.com/photo-1519735777090-ec97162dc266?auto=format&fit=crop&w=300&q=80',
    discountBadge: '-63%',
    expiresIn: 'Còn 45 phút',
    isRead: true,
  },
];

// Rotating pool of simulated push notifications to trigger automatically or on-demand
export const SIMULATED_NOTIFICATION_POOL: Omit<PushNotification, 'id' | 'createdAt' | 'timestamp' | 'isRead'>[] = [
  {
    type: 'flash_sale',
    title: '🔥 FLASH SALE BÙNG NỔ: Chăm sóc da lưng nặn mụn 400K (Giảm 47%)',
    message: 'Venus Beauty Spa tặng kèm tẩy tế bào chết cà phê muối biển cho 10 khách hàng đặt lịch sớm nhất!',
    dealId: 'deal-1',
    dealTitle: 'Chăm Sóc Da Lưng - Nặn Mụn & Làm Sạch Dịu Nhẹ',
    dealPrice: 400000,
    dealOriginalPrice: 750000,
    salonName: 'Venus Beauty Spa',
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=300&q=80',
    discountBadge: '-47%',
    expiresIn: 'Còn 20 phút',
  },
  {
    type: 'deal_expiring',
    title: '⏳ SẮP HẾT HẠN: Combo Sơn gel móng tay Hàn Quốc 189K!',
    message: 'Chỉ còn 3 khung giờ trống chiều nay tại Anail Boutique (Lê Văn Sỹ, Phú Nhuận). Tặng cắt da miễn phí!',
    dealId: 'deal-7',
    dealTitle: 'Sơn Gel Móng Tay Thiết Kế Hàn Quốc Tặng Cắt Da',
    dealPrice: 189000,
    dealOriginalPrice: 350000,
    salonName: 'Anail Boutique',
    image: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=300&q=80',
    discountBadge: '-46%',
    expiresIn: 'Còn 15 phút',
  },
  {
    type: 'flash_sale',
    title: '⚡ DEAL CHỚP NHOÁNG: Cấy tinh chất hoa hồng Damascus 599K',
    message: 'Bella Beauty Clinic kích hoạt giờ vàng căng bóng da mặt, phục hồi đa tầng da mỏng yếu. Giảm trực tiếp 50%!',
    dealId: 'deal-6',
    dealTitle: 'Cấy Tinh Chất Hoa Hồng - Trắng Sáng & Căng Bóng Da',
    dealPrice: 599000,
    dealOriginalPrice: 1200000,
    salonName: 'Bella Beauty Clinic',
    image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
    discountBadge: '-50%',
    expiresIn: 'Còn 28 phút',
  },
  {
    type: 'deal_expiring',
    title: '⏳ KHẨN CẤP: Điêu khắc chân mày Hairstroke 899K sắp hết suất!',
    message: 'Hồng Sen Beauty Academy chuẩn bị đóng cổng ưu đãi giảm 68% gói điêu khắc vi chạm sợi tự nhiên kèm dặm miễn phí 6 tháng.',
    dealId: 'deal-10',
    dealTitle: 'Điêu Khắc Chân Mày Hairstroke Vi Chạm & Tặng Phủ Bóng',
    dealPrice: 899000,
    dealOriginalPrice: 2800000,
    salonName: 'Hồng Sen Beauty Academy',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    discountBadge: '-68%',
    expiresIn: 'Còn 12 phút',
  },
  {
    type: 'new_promo',
    title: '🎁 MÃ GIẢM 100K DÀNH RIÊNG CHO BẠN: "FLASH100"',
    message: 'Áp dụng cho mọi hóa đơn dịch vụ spa hoặc clinic từ 500.000đ khi đặt lịch trước 18:00.',
    discountBadge: 'VOUCHER 100K',
    expiresIn: 'Hết hạn sau 45 phút',
  },
];
