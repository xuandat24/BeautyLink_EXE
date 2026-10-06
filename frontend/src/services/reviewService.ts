export interface ServiceStep {
  stepNumber: number;
  title: string;
  durationMinutes: number;
  imageUrl: string;
  description: string;
  keyProducts?: string;
}

export interface ServiceReviewItem {
  id: string;
  serviceId?: number | string;
  serviceTitle: string;
  salonName: string;
  bookingCode?: string;
  authorName: string;
  authorAvatar?: string;
  rating: number; // 1 to 5
  date: string;
  content: string;
  tags?: string[];
  images?: string[];
  likesCount?: number;
  verifiedBooking?: boolean;
}

const STORAGE_KEY_REVIEWS = 'beautylink_customer_reviews_v3';
const STORAGE_KEY_REVIEWED_BOOKINGS = 'beautylink_reviewed_bookings_v3';

// Default initial reviews database
const DEFAULT_REVIEWS: ServiceReviewItem[] = [
  {
    id: 'rev-init-1',
    serviceTitle: 'Chăm Sóc Da Lưng - Nặn Mụn & Làm Sạch Dịu Nhẹ',
    salonName: 'Venus Beauty Spa',
    authorName: 'Nguyễn Thảo My',
    authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
    rating: 5,
    date: 'Hôm qua',
    content: 'Trải nghiệm cực kỳ ưng ý! Lưng mình đợt rồi đi biển về bị mụn viêm li ti, kỹ thuật viên nặn mụn rất êm tay, không sưng đỏ nhiều. Sau khi chiếu ánh sáng sinh học và đắp mặt nạ bạc hà mát rượi, da dịu hẳn. Phòng ốc thơm mùi sả chanh.',
    tags: ['Kỹ thuật viên êm tay', 'Không sưng đỏ', 'Không gian sạch sẽ'],
    images: [
      'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=600&q=80',
    ],
    likesCount: 24,
    verifiedBooking: true,
  },
  {
    id: 'rev-init-2',
    serviceTitle: 'Gội Đầu Dưỡng Sinh Thảo Dược Chuẩn Trung Hoa',
    salonName: 'An Miên Spa Dưỡng Sinh',
    authorName: 'Trần Hương Ly',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    rating: 5,
    date: '3 ngày trước',
    content: 'Đúng chuẩn dưỡng sinh! Nước gội bồ kết nấu tươi thơm nức, bài massage cổ vai gáy bấm đúng chỗ mỏi gáy của dân văn phòng. Chuyên viên rất lịch sự, không chèo kéo mua thêm gói. Rất khuyến khích các bạn thử nhé!',
    tags: ['Massage cực đã', 'Nấu thảo dược tươi', 'Phục vụ chu đáo'],
    images: [
      'https://images.unsplash.com/photo-1519735777090-ec97162dc266?auto=format&fit=crop&w=600&q=80',
    ],
    likesCount: 38,
    verifiedBooking: true,
  },
  {
    id: 'rev-init-3',
    serviceTitle: 'Chăm sóc da Aqua Peel Hydro & Điện di tế bào gốc',
    salonName: 'Viện Thẩm Mỹ & Spa Radiant Skin',
    authorName: 'Vũ Minh Hằng',
    authorAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
    rating: 5,
    date: '5 ngày trước',
    content: 'Aqua Peel hút sạch mụn cám hai bên cánh mũi mà không hề rát đỏ hay khô căng. Điện di tế bào gốc lạnh làm da bóng mướt chuẩn Hàn Quốc. Đến công ty ai cũng khen da dạo này phát sáng!',
    tags: ['Da căng bóng', 'Công nghệ hiện đại', 'Bác sĩ da liễu theo dõi'],
    images: [
      'https://images.unsplash.com/photo-1512290900672-1f48644558e8?auto=format&fit=crop&w=600&q=80',
    ],
    likesCount: 19,
    verifiedBooking: true,
  },
  {
    id: 'rev-init-4',
    serviceTitle: 'Liệu Trình Trẻ Hóa Nâng Cơ Hifu Ultherapy',
    salonName: 'Lavish Aesthetic Clinic',
    authorName: 'Đặng Thanh Vân',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    rating: 5,
    date: '1 tuần trước',
    content: 'Bác sĩ trực tiếp thăm khám và đi máy Hifu, chỉnh năng lượng từng vùng rất kỹ. Làm xong nửa mặt soi gương thấy rãnh cười mờ hẳn và viền hàm gọn lên rõ rệt. Không cần nghỉ dưỡng gì cả.',
    tags: ['Viền hàm thon gọn', 'Bác sĩ trực tiếp làm', 'Rất xứng đáng'],
    images: [
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80',
    ],
    likesCount: 45,
    verifiedBooking: true,
  },
];

// Helper to normalize strings for matching
const normalize = (str?: string) => (str || '').toLowerCase().trim();

export const reviewService = {
  // Get all reviews
  getAllReviews(): ServiceReviewItem[] {
    if (typeof window === 'undefined') return DEFAULT_REVIEWS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_REVIEWS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return DEFAULT_REVIEWS;
  },

  // Get reviews specific to a service
  getReviewsForService(serviceTitle: string, serviceId?: number | string): ServiceReviewItem[] {
    const all = this.getAllReviews();
    const normTitle = normalize(serviceTitle);

    // Exact or loose match
    const matched = all.filter((r) => {
      if (serviceId && r.serviceId && String(r.serviceId) === String(serviceId)) {
        return true;
      }
      const rTitle = normalize(r.serviceTitle);
      return (
        rTitle === normTitle ||
        normTitle.includes(rTitle) ||
        rTitle.includes(normTitle) ||
        (normTitle.includes('mụn') && rTitle.includes('mụn')) ||
        (normTitle.includes('aqua') && rTitle.includes('aqua')) ||
        (normTitle.includes('dưỡng sinh') && rTitle.includes('dưỡng sinh'))
      );
    });

    if (matched.length > 0) return matched;

    // Provide tailored contextual reviews if none exist yet
    return [
      {
        id: `rev-gen-${serviceId || 'svc'}-1`,
        serviceTitle,
        salonName: 'Hệ thống đối tác BeautyLink',
        authorName: 'Khánh Linh',
        authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        rating: 5,
        date: 'Vừa xong',
        content: `Dịch vụ "${serviceTitle}" làm rất ưng ý. Kỹ thuật viên thao tác chuẩn chỉnh, nhẹ nhàng. Không gian cơ sở thoáng mát, tinh dầu thư giãn. Chắc chắn sẽ quay lại ủng hộ lần sau!`,
        tags: ['Chu đáo', 'Đúng giờ hẹn', 'Giá hợp lý'],
        verifiedBooking: true,
        likesCount: 12,
      },
      {
        id: `rev-gen-${serviceId || 'svc'}-2`,
        serviceTitle,
        salonName: 'Hệ thống đối tác BeautyLink',
        authorName: 'Bảo Trâm',
        authorAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
        rating: 5,
        date: '2 ngày trước',
        content: `Đặt lịch trước qua app nhanh gọn, đến nơi không phải chờ đợi phút nào. Nhân viên tư vấn đúng tình trạng thực tế của da/cơ thể chứ không bị ép sale. Rất hài lòng!`,
        tags: ['Không gian đẹp', 'Chuyên viên tay nghề cao'],
        verifiedBooking: true,
        likesCount: 8,
      },
    ];
  },

  // Save new review
  addReview(review: Omit<ServiceReviewItem, 'id' | 'date'> & { date?: string }): ServiceReviewItem {
    const all = this.getAllReviews();
    const newReview: ServiceReviewItem = {
      ...review,
      id: `rev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      date: review.date || 'Hôm nay',
      likesCount: 1,
      verifiedBooking: true,
    };

    const updated = [newReview, ...all];
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_REVIEWS, JSON.stringify(updated));
        if (review.bookingCode) {
          const reviewed = this.getReviewedBookings();
          reviewed[review.bookingCode] = true;
          localStorage.setItem(STORAGE_KEY_REVIEWED_BOOKINGS, JSON.stringify(reviewed));
        }
      } catch (err) {
        console.error('Failed to save review:', err);
      }
    }
    return newReview;
  },

  getReviewedBookings(): Record<string, boolean> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY_REVIEWED_BOOKINGS);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      const res: Record<string, boolean> = {};
      Object.keys(parsed).forEach((k) => {
        res[k] = Boolean(parsed[k]);
      });
      return res;
    } catch {
      return {};
    }
  },

  isBookingReviewed(bookingCode: string): boolean {
    const list = this.getReviewedBookings();
    return Boolean(list[bookingCode]);
  },

  // Generate realistic, step-by-step beauty workflows with photos
  getProcedureSteps(categorySlug?: string, serviceTitle?: string): ServiceStep[] {
    const slug = (categorySlug || '').toLowerCase();
    const title = (serviceTitle || '').toLowerCase();

    // 1. Skincare / Acne / Facial Peel / Light Therapy
    if (
      title.includes('mụn') ||
      title.includes('peel') ||
      title.includes('aqua') ||
      title.includes('da') ||
      title.includes('nặn') ||
      slug.includes('spa') ||
      slug.includes('tham-my')
    ) {
      return [
        {
          stepNumber: 1,
          title: 'Thăm khám da vi điểm & Tư vấn phác đồ y khoa',
          durationMinutes: 10,
          imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=600&q=80',
          description: 'Bác sĩ/chuyên viên dùng máy soi da phân tích độ ẩm, sắc tố melanin, mật độ bã nhờn và vi khuẩn P.acnes dưới biểu bì.',
          keyProducts: 'Máy soi da 3D đa tầng, hồ sơ bệnh lý cá nhân hóa',
        },
        {
          stepNumber: 2,
          title: 'Tẩy trang sinh học & Rửa mặt làm sạch sâu',
          durationMinutes: 10,
          imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
          description: 'Loại bỏ hoàn toàn lớp trang điểm, bụi mịn PM2.5 bằng dầu tẩy trang dịu nhẹ và sữa rửa mặt cân bằng pH 5.5.',
          keyProducts: 'Dược mỹ phẩm sinh học không chứa cồn, bọt làm sạch dịu nhẹ',
        },
        {
          stepNumber: 3,
          title: 'Xông hơi thảo dược & Hút bã nhờn chân không',
          durationMinutes: 15,
          imageUrl: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=600&q=80',
          description: 'Giãn nở lỗ chân lông tự nhiên bằng tinh dầu tràm trà & lavender, kết hợp đầu hút chân không Aqua Vortex hút sạch sợi bã nhờn.',
          keyProducts: 'Tinh dầu thảo mộc hữu cơ, dung dịch làm mềm cồi mụn Salicylic 2%',
        },
        {
          stepNumber: 4,
          title: 'Kỹ thuật lấy nhân mụn chuẩn y khoa 100% vô khuẩn',
          durationMinutes: 20,
          imageUrl: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=600&q=80',
          description: 'Sử dụng tăm bông vô trùng hoặc kim y tế dùng 1 lần, lấy sạch tận gốc nhân mụn mà không gây rách mô hay thâm sẹo.',
          keyProducts: 'Bộ dụng cụ tiệt trùng Autoclave đóng gói riêng từng khách',
        },
        {
          stepNumber: 5,
          title: 'Điện di tinh chất phục hồi & Chiếu ánh sáng sinh học Bio-Light',
          durationMinutes: 15,
          imageUrl: 'https://images.unsplash.com/photo-1512290900672-1f48644558e8?auto=format&fit=crop&w=600&q=80',
          description: 'Máy điện di Cool-Ion đẩy sâu HA đa tầng và Peptide tái tạo vào hạ bì, kết hợp ánh sáng xanh kháng khuẩn diệt mụn triệt để.',
          keyProducts: 'Serum HA B5 phục hồi, máy ánh sáng sinh học 7 dải màu',
        },
        {
          stepNumber: 6,
          title: 'Đắp mặt nạ hạ nhiệt, khóa ẩm & Thoa kem chống nắng',
          durationMinutes: 10,
          imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80',
          description: 'Mặt nạ thạch dừa collagen làm dịu da tức thì, kết hợp massage nhẹ nhàng vùng đầu cổ và thoa kem bảo vệ da khỏi tia UV.',
          keyProducts: 'Mặt nạ tế bào gốc tái tạo, kem chống nắng vật lý SPF 50+',
        },
      ];
    }

    // 2. Dưỡng sinh / Massage / Gội đầu
    if (
      title.includes('gội') ||
      title.includes('dưỡng sinh') ||
      title.includes('massage') ||
      slug.includes('massage')
    ) {
      return [
        {
          stepNumber: 1,
          title: 'Ngâm chân thảo dược & Khai thông huyệt đạo',
          durationMinutes: 10,
          imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
          description: 'Thư giãn bàn chân trong bồn nước ấm chứa gừng già, muối hồng Himalaya và ngải cứu giúp kích thích tuần hoàn máu.',
          keyProducts: 'Muối khoáng ngâm chân thảo mộc gia truyền',
        },
        {
          stepNumber: 2,
          title: 'Ấn huyệt Shiatsu vùng đầu, cổ, vai gáy',
          durationMinutes: 20,
          imageUrl: 'https://images.unsplash.com/photo-1519735777090-ec97162dc266?auto=format&fit=crop&w=600&q=80',
          description: 'Giải phóng bó cơ bị căng cứng do ngồi văn phòng lâu, ấn huyệt Bách Hội, Phong Trì, Kiên Tỉnh giúp ngủ ngon sâu giấc.',
          keyProducts: 'Tinh dầu gừng ấm dưỡng sinh, cao massage thảo dược',
        },
        {
          stepNumber: 3,
          title: 'Gội đầu 2 lần bằng nước bồ kết cô đặc nấu tươi',
          durationMinutes: 25,
          imageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80',
          description: 'Làm sạch da đầu, đánh bay gàu ngứa bằng thảo mộc bồ kết, hương nhu, vỏ bưởi, sả chanh giữ tóc chắc khỏe.',
          keyProducts: 'Nước bồ kết nấu tươi trong ngày, dầu xả bưởi dưỡng ngọn tóc',
        },
        {
          stepNumber: 4,
          title: 'Ủ tóc thảo dược & Massage vòm nước tuần hoàn thác ấm',
          durationMinutes: 15,
          imageUrl: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=600&q=80',
          description: 'Vòm nước ấm massage da đầu liên tục theo vòng tròn, kích thích nang tóc phát triển và mang lại cảm giác thư thái tột đỉnh.',
          keyProducts: 'Vòm nước thác tuần hoàn hydro-therapy',
        },
        {
          stepNumber: 5,
          title: 'Sấy khô tóc, xịt dưỡng tinh dầu bưởi & Thưởng trà thảo mộc',
          durationMinutes: 10,
          imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80',
          description: 'Sấy tóc với nhiệt độ ấm dịu không làm tổn hại biểu bì tóc, thoa serum dưỡng bóng mượt và dùng trà thanh nhiệt dưỡng nhan.',
          keyProducts: 'Serum dưỡng tóc Argan Morocco, trà thảo mộc hoa cúc táo đỏ',
        },
      ];
    }

    // 3. Nail / Móng
    if (title.includes('nail') || title.includes('móng') || slug.includes('nail')) {
      return [
        {
          stepNumber: 1,
          title: 'Ngâm tay/chân nước ấm & Làm mềm tế bào biểu bì',
          durationMinutes: 10,
          imageUrl: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=600&q=80',
          description: 'Ngâm dung dịch tinh dầu bơ hạt mỡ làm mềm phần da quanh viền móng an toàn.',
          keyProducts: 'Sữa dưỡng ngâm móng hoa hồng hữu cơ',
        },
        {
          stepNumber: 2,
          title: 'Nhặt da y tế & Tạo phom móng theo chuẩn thẩm mỹ',
          durationMinutes: 15,
          imageUrl: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=600&q=80',
          description: 'Sử dụng kìm tiệt trùng vô khuẩn tỉ mỉ cắt gọn da thừa, dũa phom vuông tròn, almond hay coffin theo yêu cầu.',
          keyProducts: 'Dũa móng OPI chuyên dụng, kìm tiệt trùng đóng túi',
        },
        {
          stepNumber: 3,
          title: 'Sơn kiềm dầu, liên kết Base coat & Hơ đèn LED UV',
          durationMinutes: 15,
          imageUrl: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=600&q=80',
          description: 'Khử dầu bề mặt móng giúp sơn bám bền từ 3-4 tuần, quét lớp liên kết bảo vệ móng thật không bị ố vàng.',
          keyProducts: 'Sơn lót Base Gel nhập khẩu Hàn Quốc/Nhật Bản',
        },
        {
          stepNumber: 4,
          title: 'Sơn màu gel nghệ thuật, vẽ hoa văn & Đính đá cao cấp',
          durationMinutes: 30,
          imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80',
          description: 'Sơn 2 lớp màu chuẩn tông, ẩn xà cừ, tráng gương hoặc đính đá Swarovski theo thiết kế thời thượng.',
          keyProducts: 'Gel màu không mùi an toàn, đá pha lê chống trầy',
        },
        {
          stepNumber: 5,
          title: 'Khóa Top coat bóng bẩy & Dưỡng viền móng tinh dầu hạnh nhân',
          durationMinutes: 10,
          imageUrl: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=600&q=80',
          description: 'Phủ lớp Top siêu bóng chống trầy xước và thoa tinh dầu dưỡng viền móng mềm mịn, không bong tróc da tay.',
          keyProducts: 'Top Diamond chống xước, tinh dầu Cuticle Oil hữu cơ',
        },
      ];
    }

    // 4. Default High-end Beauty Procedure
    return [
      {
        stepNumber: 1,
        title: 'Đón tiếp, tư vấn chuyên sâu & Phân tích hiện trạng',
        durationMinutes: 10,
        imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=600&q=80',
        description: 'Chuyên viên lắng nghe mong muốn, kiểm tra cụ thể và thiết kế phác đồ cá nhân hóa tối ưu hiệu quả.',
        keyProducts: 'Phiếu phân tích liệu trình chuyên biệt',
      },
      {
        stepNumber: 2,
        title: 'Vệ sinh chuẩn bị & Khử khuẩn thiết bị công nghệ cao',
        durationMinutes: 10,
        imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
        description: 'Vệ sinh bề mặt tiếp xúc, sử dụng khăn và vật dụng dùng riêng biệt cho từng khách hàng.',
        keyProducts: 'Dung dịch vô khuẩn chuẩn phòng lab',
      },
      {
        stepNumber: 3,
        title: 'Thực hiện liệu trình chính với kỹ thuật Master',
        durationMinutes: 35,
        imageUrl: 'https://images.unsplash.com/photo-1512290900672-1f48644558e8?auto=format&fit=crop&w=600&q=80',
        description: 'Ứng dụng tinh chất cao cấp kết hợp máy móc hiện đại nhập khẩu, mang lại kết quả rõ rệt ngay sau buổi đầu tiên.',
        keyProducts: 'Dược mỹ phẩm nhập khẩu chính hãng có tem bộ y tế',
      },
      {
        stepNumber: 4,
        title: 'Khóa dưỡng chất, làm dịu & Hướng dẫn chăm sóc tại nhà',
        durationMinutes: 15,
        imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80',
        description: 'Thoa sản phẩm bảo vệ, kết hợp massage thư giãn nhẹ nhàng và bàn giao cẩm nang chăm sóc duy trì vẻ đẹp lâu dài.',
        keyProducts: 'Kem dưỡng phục hồi, cẩm nang chăm sóc độc quyền',
      },
    ];
  },
};
