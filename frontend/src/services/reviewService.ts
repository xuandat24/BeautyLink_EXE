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

// Reviews are server-owned. Legacy localStorage entries are not verified bookings.
export const reviewService = {
  getReviewsForService(_serviceTitle: string, _serviceId?: number | string): ServiceReviewItem[] {
    return [];
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
